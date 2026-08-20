import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts, invoices, rawWebhooks, feeLedger, transfers, payrollItems } from '@payit/db/schema';
import { dueClient, feeService } from '@payit/integrations';
import { ulid } from 'ulid';

function requireEvmDepositAddress(entity: { evmDepositAddress?: string | null }): string {
  if (!entity.evmDepositAddress) {
    throw new Error('Wallet was not created, come back later');
  }
  return entity.evmDepositAddress;
}

const db = createDbClient();

export async function webhookRoutes(server: FastifyInstance) {

  /**
   * Main Inbound Webhook Endpoint for Due Network
   */
  server.post('/api/webhooks/due', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);
    const signature = request.headers['x-due-signature'] as string || '';
    const timestamp = request.headers['x-due-timestamp'] as string || '';

    // Verify webhook cryptographic signature
    if (signature && !dueClient.verifyWebhookSignature(rawBody, signature, timestamp)) {
      server.log.warn('[Due Webhook] Invalid signature rejected');
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }

    const payload = request.body as any;
    const eventType = payload.event || payload.type;
    const eventId = payload.id || payload.event_id || ulid();

    server.log.info({ eventType, eventId }, '[Due Webhook] Received webhook event');

    // Idempotency: Check if webhook was already processed
    const existing = await db.select().from(rawWebhooks).where(eq(rawWebhooks.eventId, eventId)).limit(1);
    if (existing.length > 0) {
      server.log.info({ eventId }, '[Due Webhook] Duplicate webhook skipped');
      return reply.send({ received: true, duplicate: true });
    }

    await db.insert(rawWebhooks).values({
      id: ulid(),
      provider: 'DUE',
      eventId,
      payload: JSON.stringify(payload),
      status: 'RECEIVED',
    });

    try {
      switch (eventType) {
        /**
         * Event 1: Customer KYC / KYB Approved
         */
        case 'customer.verified':
        case 'customer.approved': {
          const customerId = payload.data?.customer_id || payload.data?.id || payload.customer_id;
          if (customerId) {
            const entityRows = await db.select().from(entities).where(eq(entities.dueCustomerId, customerId)).limit(1);
            if (entityRows.length > 0) {
              const entity = entityRows[0];
              await db
                .update(entities)
                .set({ dueStatus: 'approved' })
                .where(eq(entities.id, entity.id));

              server.log.info({ entityId: entity.id, customerId }, '[Due Webhook] Entity KYC approved');

              // Provision default virtual accounts for approved entity
              const defaultCurrencies = entity.kind === 'BUSINESS' ? ['EUR', 'USD', 'NGN', 'GBP'] : ['EUR', 'USD', 'NGN'];
              for (const curr of defaultCurrencies) {
                try {
                  const existingAcc = await db
                    .select()
                    .from(accounts)
                    .where(and(eq(accounts.entityId, entity.id), eq(accounts.currency, curr)))
                    .limit(1);

                  if (existingAcc.length === 0) {
                    const va = await dueClient.createVirtualAccount({
                      customerId,
                      currency: curr,
                      destinationAddress: requireEvmDepositAddress(entity),
                      destinationNetwork: 'base',
                      destinationAsset: 'USDC',
                      accountHolderName: entity.legalName,
                    });

                    await db.insert(accounts).values({
                      id: ulid(),
                      entityId: entity.id,
                      dueVirtualAccountId: va.id || ulid(),
                      accountNumber: va.account_number || va.iban || `ACC-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
                      routingNumber: va.routing_number || va.bic || va.sort_code || null,
                      bankName: va.bank_name || (curr === 'EUR' ? 'Banking Circle' : curr === 'USD' ? 'Evolve Bank' : 'Wema Bank'),
                      accountHolderName: va.holder_name || entity.legalName,
                      currency: curr,
                      rail: va.rail || (curr === 'EUR' ? 'sepa' : curr === 'USD' ? 'ach' : 'nip'),
                      status: 'active',
                    });
                  }
                } catch (vaErr: any) {
                  server.log.error({ curr, err: vaErr.message }, '[Due Webhook] Error auto-provisioning virtual account');
                }
              }
            }
          }
          break;
        }

        /**
         * Event 2: Static Virtual Account Credited
         */
        case 'virtual_account.credited':
        case 'deposit.settled': {
          const vaId = payload.data?.virtual_account_id || payload.virtual_account_id;
          const grossAmount = Number(payload.data?.amount || payload.amount || 0);
          const currency = (payload.data?.currency || payload.currency || 'USD').toUpperCase();

          const accRows = await db.select().from(accounts).where(eq(accounts.dueVirtualAccountId, vaId)).limit(1);
          if (accRows.length > 0) {
            const acc = accRows[0];
            const feeCalc = feeService.calculatePayInFee(grossAmount, currency);

            // Record fee split in feeLedger
            await db.insert(feeLedger).values({
              id: ulid(),
              entityId: acc.entityId,
              transactionType: 'PAY_IN',
              referenceId: vaId,
              grossAmount: String(feeCalc.grossAmount.toFixed(4)),
              feeAmount: String(feeCalc.feeAmount.toFixed(4)),
              netAmount: String(feeCalc.netAmount.toFixed(4)),
              currency,
              description: `Virtual Account Inflow (${currency}) via ${acc.bankName}`,
            });

            server.log.info({
              entityId: acc.entityId,
              grossAmount,
              fee: feeCalc.feeAmount,
              net: feeCalc.netAmount,
            }, '[Due Webhook] Processed virtual account credit and fee split');
          }
          break;
        }

        /**
         * Event 3: Dynamic Transfer / Invoice Completed
         */
        case 'transfer.completed':
        case 'transfer.settled': {
          const transferId = payload.data?.transfer_id || payload.data?.id || payload.transfer_id;
          if (transferId) {
            // Check if tied to an invoice
            const invRows = await db.select().from(invoices).where(eq(invoices.dueTransferId, transferId)).limit(1);
            if (invRows.length > 0) {
              const inv = invRows[0];
              await db.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, inv.id));

              const feeCalc = feeService.calculateInvoiceFee(Number(inv.totalAmount), inv.currency);
              await db.insert(feeLedger).values({
                id: ulid(),
                entityId: inv.entityId,
                transactionType: 'INVOICE',
                referenceId: inv.id,
                grossAmount: String(feeCalc.grossAmount.toFixed(4)),
                feeAmount: String(feeCalc.feeAmount.toFixed(4)),
                netAmount: String(feeCalc.netAmount.toFixed(4)),
                currency: inv.currency,
                description: `Paid Invoice #${inv.tag}`,
              });

              server.log.info({ invoiceId: inv.id, tag: inv.tag }, '[Due Webhook] Invoice marked as paid');
            }

            // Check if tied to transfers log
            await db
              .update(transfers)
              .set({ status: 'completed' })
              .where(eq(transfers.dueTransferId, transferId));
          }
          break;
        }

        /**
         * Event 4: Payout Completed (Payroll / Off-ramp)
         */
        case 'payout.completed': {
          const payoutId = payload.data?.payout_id || payload.data?.id || payload.payout_id;
          if (payoutId) {
            await db
              .update(payrollItems)
              .set({ status: 'success' })
              .where(eq(payrollItems.duePayoutId, payoutId));

            server.log.info({ payoutId }, '[Due Webhook] Payout confirmed completed');
          }
          break;
        }

        default:
          server.log.info({ eventType }, '[Due Webhook] Unhandled event type');
      }

      await db
        .update(rawWebhooks)
        .set({ status: 'PROCESSED' })
        .where(eq(rawWebhooks.eventId, eventId));

      return reply.send({ received: true, processed: true });
    } catch (err: any) {
      server.log.error({ err: err.message, eventId }, '[Due Webhook] Processing failure');
      await db
        .update(rawWebhooks)
        .set({ status: 'FAILED' })
        .where(eq(rawWebhooks.eventId, eventId));

      return reply.status(500).send({ error: 'Webhook processing error', details: err.message });
    }
  });
}
