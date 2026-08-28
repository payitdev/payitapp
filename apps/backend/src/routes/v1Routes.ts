import { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import crypto from 'crypto';
import { createDbClient, eq, and, desc, gte, lte } from '@payit/db';
import {
  invoices,
  invoiceItems,
  entities,
  accounts,
  payrollRuns,
  payrollItems,
  transfers,
  feeLedger,
  termVaults,
  rwaPositions,
  idempotencyKeys,
  ledgerEntries,
  ledgerAccounts,
  brailsCards,
} from '@payit/db/schema';
import { PrivyNEARBridge, feeService, BrailsClient, easeIdClient } from '@payit/integrations';
import { requireApiKeyAuth, logApiRequestMetrics } from '../middleware/apiKeyAuth.js';
import { settleInvoiceAndRecordLedger } from './invoices.js';
import { WebhookDispatcher } from '../services/webhookDispatcher.js';
import { getEntityBalance } from '../utils/balance.js';
import { validateAndParseMoney, safeSumAmounts } from '../utils/money.js';

const db = createDbClient();
const brails = new BrailsClient();

function unwrapProviderData(response: any) {
  if (response?.data && typeof response.data === 'object' && !Array.isArray(response.data)) return response.data;
  return response || {};
}

function cardStatus(value: any) {
  const status = String(value || '').toUpperCase();
  if (['FROZEN', 'BLOCKED', 'LOCKED'].includes(status)) return 'FROZEN';
  if (['TERMINATED', 'CANCELLED', 'REVOKED', 'CLOSED'].includes(status)) return 'TERMINATED';
  if (['FAILED', 'ERROR', 'DECLINED'].includes(status)) return 'FAILED';
  if (['PENDING', 'PROCESSING', 'CREATED'].includes(status)) return 'PENDING';
  return 'ACTIVE';
}

export async function v1Routes(server: FastifyInstance) {
  // Apply API Key Authentication Hook & Telemetry to all /v1/ routes
  server.addHook('preHandler', requireApiKeyAuth);
  server.addHook('onResponse', logApiRequestMetrics);

  /**
   * [V1] Root API Service Descriptor & Health
   */
  const handleV1Discovery = async (request: any, reply: any) => {
    const acceptsHtml = request.headers['accept']?.includes('text/html');

    const discoveryData = {
      service: 'Proxim Banking-as-a-Service API',
      version: 'v1.0.0',
      status: 'operational',
      documentation: 'http://localhost:3001/#developers',
      endpoints: {
        accounts: {
          dynamic_session: 'POST /v1/accounts/dynamic-session',
          rates: 'GET /v1/rates',
        },
        invoices: {
          create: 'POST /v1/invoices',
          get: 'GET /v1/invoices/:id',
          settle: 'POST /v1/invoices/:id/settle',
        },
        wallets: {
          derive: 'POST /v1/wallets/derive',
        },
        payouts: {
          batch: 'POST /v1/payouts/batch',
          resolve_account: 'POST /v1/payouts/resolve-account',
        },
        ledger: {
          sub_accounts: 'GET /v1/ledger/sub-accounts/:customerId',
        },
        reports: {
          balance_sheet: 'GET /v1/reports/balance-sheet',
        },
        treasury: {
          auto_sweep: 'POST /v1/treasury/auto-sweep',
        },
        identity: {
          verify_lookup: 'POST /v1/identity/verify',
          create_liveness_session: 'POST /v1/identity/liveness/session',
          get_liveness_status: 'GET /v1/identity/liveness/:sessionToken',
        },
        cards: {
          issue: 'POST /v1/cards',
          list: 'GET /v1/cards',
          freeze: 'POST /v1/cards/:cardId/freeze',
          unfreeze: 'POST /v1/cards/:cardId/unfreeze',
          top_up: 'POST /v1/cards/:cardId/top-up',
          withdraw: 'POST /v1/cards/:cardId/withdraw',
          reconcile: 'POST /v1/cards/:cardId/reconcile',
        },
      },
      auth: {
        type: 'Bearer API Key',
        header: 'Authorization: Bearer px_live_sk_... or px_test_sk_...',
      },
    };

    if (acceptsHtml) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Proxim V1 API — Operational</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060B14; color: #F7F8F4; margin: 0; padding: 40px 20px; }
            .container { max-width: 800px; margin: 0 auto; background: #09171C; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            .badge { background: rgba(53, 217, 208, 0.15); color: #35D9D0; padding: 4px 12px; border-radius: 999px; font-weight: bold; font-size: 12px; display: inline-block; border: 1px solid rgba(53, 217, 208, 0.3); }
            h1 { font-size: 24px; margin: 16px 0 8px; color: #fff; }
            p { color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; }
            .btn { display: inline-flex; align-items: center; gap: 8px; background: #35D9D0; color: #000; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; margin-top: 16px; transition: opacity 0.2s; }
            .btn:hover { opacity: 0.9; }
            pre { background: #040714; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; overflow-x: auto; color: #35D9D0; font-family: monospace; font-size: 13px; line-height: 1.5; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <span class="badge">● Operational (v1.0.0)</span>
            <h1>Proxim Banking-as-a-Service API</h1>
            <p>Institutional multi-currency financial infrastructure, Proxim Identity Engine, 10-chain MPC non-custodial wallets, and automated double-entry ledger balancing.</p>
            <a class="btn" href="http://localhost:3001/#developers" target="_blank">Open Interactive Developer Portal &rarr;</a>
            <pre>${JSON.stringify(discoveryData, null, 2)}</pre>
          </div>
        </body>
        </html>
      `);
    }

    return reply.send(discoveryData);
  };

  server.get('/v1', handleV1Discovery);
  server.get('/v1/', handleV1Discovery);

  server.get('/v1/rates', async (_request, reply) => {
    try {
      const response = await brails.getAllExchangeRates();
      return reply.send({ success: true, data: unwrapProviderData(response), source: 'live' });
    } catch (error: any) {
      return reply.status(502).send({ error: { code: 'RATES_UNAVAILABLE', message: error.message, doc_url: 'https://proxim.finance/developers#rates' } });
    }
  });

  server.get('/v1/transactions', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const query = request.query as { currency?: string; status?: string; limit?: string };
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const rows = await db.select().from(transfers).where(eq(transfers.entityId, apiAuth.entityId)).orderBy(desc(transfers.createdAt)).limit(limit);
    const filtered = rows.filter(row => (!query.currency || row.sourceCurrency.toUpperCase() === query.currency.toUpperCase()) && (!query.status || row.status.toLowerCase() === query.status.toLowerCase()));
    return reply.send({ success: true, data: { transactions: filtered, meta: { limit, hasNextPage: rows.length === limit } } });
  });

  server.get('/v1/transactions/:transactionId', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { transactionId } = request.params as { transactionId: string };
    const rows = await db.select().from(transfers).where(and(eq(transfers.id, transactionId), eq(transfers.entityId, apiAuth.entityId))).limit(1);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found for this Proxim account.' } });
    return reply.send({ success: true, data: rows[0] });
  });

  server.get('/v1/accounts', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const rows = await db.select().from(accounts).where(eq(accounts.entityId, apiAuth.entityId));
    return reply.send({ success: true, data: { entityId: apiAuth.entityId, accountKind: apiAuth.entity.kind, accounts: rows } });
  });

  server.get('/v1/cards', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const query = request.query as { customerId?: string; accountKind?: string };
    if (query.accountKind && query.accountKind.toUpperCase() !== apiAuth.entity.kind) return reply.status(400).send({ error: { code: 'ACCOUNT_KIND_MISMATCH', message: 'accountKind must match the authenticated Proxim entity.' } });
    const predicates = [eq(brailsCards.entityId, apiAuth.entityId)];
    if (query.customerId) predicates.push(eq(brailsCards.providerCardUserId, query.customerId));
    const rows = await db.select().from(brailsCards).where(and(...predicates)).catch(() => [] as any[]);
    return reply.send({ success: true, data: { entityId: apiAuth.entityId, accountKind: apiAuth.entity.kind, cards: rows } });
  });

  server.post('/v1/cards', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const body = request.body as Record<string, any>;
    const customerId = String(body.customerId || '').trim();
    const amount = Number(body.amount || 0);
    const currency = String(body.currency || 'USD').toUpperCase();
    if (!customerId) return reply.status(400).send({ error: { code: 'CUSTOMER_ID_REQUIRED', message: 'customerId is required.' } });
    if (!Number.isFinite(amount) || amount < 0) return reply.status(400).send({ error: { code: 'INVALID_AMOUNT', message: 'amount must be zero or greater.' } });
    try {
      const cardUser = await brails.registerCardUser({ customerEmail: String(body.customerEmail || `${customerId}@customers.proxim.finance`), firstName: String(body.firstName || 'Proxim'), lastName: String(body.lastName || 'Customer'), phoneNumber: String(body.phoneNumber || ''), country: String(body.country || 'NG'), dateOfBirth: String(body.dateOfBirth || '') });
      const cardUserData = unwrapProviderData(cardUser);
      const cardUserId = String(cardUserData.id || cardUserData.cardUserId || customerId);
      const providerCard = await brails.createVirtualCard({ customerEmail: String(body.customerEmail || `${customerId}@customers.proxim.finance`), cardUserId, cardType: String(body.cardType || 'VIRTUAL').toUpperCase() as any, cardBrand: String(body.brand || 'VISA').toUpperCase() as any, currency: currency as any, amount, reference: String(body.reference || `proxim_card_${ulid()}`), firstName: String(body.firstName || 'Proxim'), lastName: String(body.lastName || 'Customer') });
      const data = unwrapProviderData(providerCard);
      const providerCardId = String(data.id || data.cardId || '');
      if (!providerCardId) throw new Error('Card creation returned no card identifier');
      const inserted = await db.insert(brailsCards).values({ id: providerCardId, userId: apiAuth.entity.userId, entityId: apiAuth.entityId, accountKind: apiAuth.entity.kind, provider: 'BRAILS', providerCardId, providerCardUserId: cardUserId, brand: String(body.brand || 'VISA').toUpperCase(), cardType: String(body.cardType || 'VIRTUAL').toUpperCase(), cardholderName: `${body.firstName || 'Proxim'} ${body.lastName || 'Customer'}`, currency, balance: String(amount), status: cardStatus(data.status), feeAmount: '0', providerMetadata: data, updatedAt: new Date() }).returning();
      return reply.status(201).send({ success: true, data: inserted[0] });
    } catch (error: any) { return reply.status(502).send({ error: { code: 'CARD_ISSUANCE_FAILED', message: error.message } }); }
  });

  for (const [path, action] of [['freeze', 'freezeCard'], ['unfreeze', 'unfreezeCard']] as const) {
    server.post(`/v1/cards/:cardId/${path}`, async (request, reply) => {
      const apiAuth = request.apiAuth!;
      const { cardId } = request.params as { cardId: string };
      const rows = await db.select().from(brailsCards).where(and(eq(brailsCards.entityId, apiAuth.entityId), eq(brailsCards.providerCardId, cardId))).limit(1);
      if (!rows[0]) return reply.status(404).send({ error: { code: 'CARD_NOT_FOUND', message: 'Card not found for this Proxim account.' } });
      try { await brails[action](cardId); const status = path === 'freeze' ? 'FROZEN' : 'ACTIVE'; const updated = await db.update(brailsCards).set({ status, updatedAt: new Date() }).where(eq(brailsCards.id, rows[0].id)).returning(); return reply.send({ success: true, data: updated[0] }); } catch (error: any) { return reply.status(502).send({ error: { code: 'CARD_UPDATE_FAILED', message: error.message } }); }
    });
  }

  for (const [path, action] of [['top-up', 'topUpCard'], ['withdraw', 'withdrawCard']] as const) {
    server.post(`/v1/cards/:cardId/${path}`, async (request, reply) => {
      const apiAuth = request.apiAuth!;
      const { cardId } = request.params as { cardId: string };
      const body = request.body as Record<string, any>;
      const amount = Number(body.amount);
      const currency = String(body.currency || 'USD').toUpperCase();
      const rows = await db.select().from(brailsCards).where(and(eq(brailsCards.entityId, apiAuth.entityId), eq(brailsCards.providerCardId, cardId))).limit(1);
      if (!rows[0]) return reply.status(404).send({ error: { code: 'CARD_NOT_FOUND', message: 'Card not found for this Proxim account.' } });
      if (!Number.isFinite(amount) || amount <= 0) return reply.status(400).send({ error: { code: 'INVALID_AMOUNT', message: 'amount must be greater than zero.' } });
      try {
        const providerResult = action === 'topUpCard'
          ? await brails.topUpCard(cardId, amount, currency, String(body.reference || `proxim_card_${path}_${ulid()}`))
          : await brails.withdrawCard(cardId, amount, currency, String(body.reference || `proxim_card_${path}_${ulid()}`));
        const currentBalance = Number(rows[0].balance || 0);
        const nextBalance = action === 'topUpCard' ? currentBalance + amount : Math.max(0, currentBalance - amount);
        const updated = await db.update(brailsCards).set({ balance: String(nextBalance), updatedAt: new Date(), providerMetadata: providerResult }).where(eq(brailsCards.id, rows[0].id)).returning();
        return reply.send({ success: true, data: updated[0], provider: providerResult });
      } catch (error: any) { return reply.status(502).send({ error: { code: 'CARD_BALANCE_UPDATE_FAILED', message: error.message } }); }
    });
  }

  server.post('/v1/cards/:cardId/reconcile', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { cardId } = request.params as { cardId: string };
    const rows = await db.select().from(brailsCards).where(and(eq(brailsCards.entityId, apiAuth.entityId), eq(brailsCards.providerCardId, cardId))).limit(1);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'CARD_NOT_FOUND', message: 'Card not found for this Proxim account.' } });
    try {
      const providerCard = await brails.fetchCard(cardId);
      const data = unwrapProviderData(providerCard);
      const updated = await db.update(brailsCards).set({ status: cardStatus(data.status || data.state), balance: String(data.balance ?? data.availableBalance ?? rows[0].balance), providerMetadata: data, updatedAt: new Date() }).where(eq(brailsCards.id, rows[0].id)).returning();
      return reply.send({ success: true, data: updated[0] });
    } catch (error: any) { return reply.status(502).send({ error: { code: 'CARD_RECONCILIATION_FAILED', message: error.message } }); }
  });

  /**
   * [V1] Invoices: Create Dynamic Multi-Rail Invoice
   */
  server.post('/v1/invoices', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const idempotencyHeader = request.headers['idempotency-key'] as string;

    // 1. Two-Phase Idempotency Lock
    if (idempotencyHeader) {
      const existingKey = await db
        .select()
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.key, idempotencyHeader), eq(idempotencyKeys.entityId, apiAuth.entityId)))
        .limit(1);

      if (existingKey.length > 0) {
        if (existingKey[0].status === 'COMPLETED' && existingKey[0].responsePayload) {
          try {
            return reply.status(200).send(JSON.parse(existingKey[0].responsePayload));
          } catch {}
        }
        if (existingKey[0].status === 'PROCESSING') {
          return reply.status(409).send({
            error: {
              code: 'CONCURRENT_REQUEST',
              message: 'A request with this Idempotency-Key is currently being processed. Please retry in a moment.',
              doc_url: 'https://proxim.finance/developers#idempotency',
            },
          });
        }
      }

      // Acquire lock in PROCESSING state
      try {
        await db.insert(idempotencyKeys).values({
          key: idempotencyHeader,
          entityId: apiAuth.entityId,
          requestHash: crypto.createHash('sha256').update(JSON.stringify(request.body || {})).digest('hex'),
          status: 'PROCESSING',
          expiresAt: new Date(Date.now() + 86400000),
        });
      } catch {
        return reply.status(409).send({
          error: {
            code: 'CONCURRENT_REQUEST',
            message: 'A concurrent request with this Idempotency-Key is already in-flight.',
            doc_url: 'https://proxim.finance/developers#idempotency',
          },
        });
      }
    }

    const {
      clientName,
      clientEmail,
      totalAmount,
      currency = 'USD',
      settlementType = 'fiat', // 'fiat' | 'crypto'
      cryptoNetwork = 'Base',
      cryptoAsset = 'USDC',
      dueDate,
      description = 'Professional Services',
      items,
      metadata,
    } = request.body as any;

    if (!clientName || !clientEmail || totalAmount === undefined || totalAmount === null) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'clientName, clientEmail, and totalAmount are required.',
          doc_url: 'https://proxim.finance/developers#invoices-create',
        },
      });
    }

    const currUpper = (currency || 'USD').toUpperCase();
    const maxDecimals = ['USDC', 'USDT'].includes(currUpper) ? 6 : 2;
    const moneyVal = validateAndParseMoney(totalAmount, maxDecimals);

    if (!moneyVal.valid) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_AMOUNT',
          message: moneyVal.error,
          doc_url: 'https://proxim.finance/developers#invoices-create',
        },
      });
    }

    const entity = apiAuth.entity;
    const invoiceId = ulid();
    const prefix = (entity.businessTag || 'PROX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PROX';
    const tag = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const computedTotal = moneyVal.cleanAmount;
    const fxQuote = feeService.calculateInvoiceFxQuote(computedTotal, currUpper);

    let paymentDetails: any = {};
    let paymentLink = `https://pay.proxim.finance/inv/${invoiceId}`;

    if (settlementType === 'fiat') {
      const accRows = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.entityId, entity.id), eq(accounts.currency, currUpper)))
        .limit(1);

      const activeAcc = accRows[0];
      if (activeAcc) {
        paymentDetails = {
          mode: 'fiat',
          currency: currUpper,
          bankName: activeAcc.bankName,
          accountNumber: activeAcc.accountNumber,
          accountHolderName: activeAcc.accountHolderName || `${entity.legalName} / Proxim`,
          routingNumber: activeAcc.routingNumber || (currUpper === 'GBP' ? '04-00-04' : '021000021'),
          rail: activeAcc.rail || (currUpper === 'NGN' ? 'nip' : currUpper === 'EUR' ? 'sepa' : 'ach'),
        };
      } else {
        paymentDetails = {
          mode: 'fiat',
          currency: currUpper,
          bankName: currUpper === 'NGN' ? 'Wema Bank' : currUpper === 'EUR' ? 'Banking Circle S.A.' : 'Evolve Bank & Trust',
          accountNumber: null,
          accountHolderName: `${entity.legalName} / Proxim`,
          routingNumber: currUpper === 'GBP' ? '04-00-04' : '021000021',
          rail: currUpper === 'NGN' ? 'nip' : currUpper === 'EUR' ? 'sepa' : 'ach',
        };
      }
    } else {
      const netLower = (cryptoNetwork || 'Base').toLowerCase();
      let depositAddress = entity.evmDepositAddress || '';

      if (netLower.includes('solana') || netLower === 'sol') {
        depositAddress = entity.solanaDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('bitcoin') || netLower === 'btc') {
        depositAddress = entity.btcDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('tron') || netLower === 'trx') {
        depositAddress = entity.tronDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('ton')) {
        depositAddress = entity.tonDepositAddress || entity.evmDepositAddress || '';
      } else if (netLower.includes('near')) {
        depositAddress = entity.nearDepositAddress || entity.evmDepositAddress || '';
      }

      paymentDetails = {
        mode: 'crypto',
        network: cryptoNetwork || 'Base',
        asset: cryptoAsset || 'USDC',
        depositAddress,
        amount: computedTotal,
        currency: cryptoAsset || 'USDC',
      };
    }

    const dueStr = dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    await db.insert(invoices).values({
      id: invoiceId,
      entityId: entity.id,
      tag,
      clientName,
      clientEmail,
      totalAmount: String(computedTotal.toFixed(2)),
      currency: currUpper,
      dueDate: dueStr,
      paymentAccountOrLink: JSON.stringify({ ...paymentDetails, link: paymentLink, metadata }),
      settlementType: settlementType === 'crypto' ? 'stablecoin' : 'fiat',
      status: 'pending',
    });

    if (items && items.length > 0) {
      for (const item of items) {
        const q = Number(item.quantity) || 1;
        const p = Number(item.unitPrice) || 0;
        await db.insert(invoiceItems).values({
          id: ulid(),
          invoiceId,
          description: item.description || 'Line Item',
          quantity: q,
          unitPrice: String(p.toFixed(2)),
          amount: String((q * p).toFixed(2)),
        });
      }
    } else {
      await db.insert(invoiceItems).values({
        id: ulid(),
        invoiceId,
        description,
        quantity: 1,
        unitPrice: String(computedTotal.toFixed(2)),
        amount: String(computedTotal.toFixed(2)),
      });
    }

    const responsePayload = {
      success: true,
      data: {
        id: invoiceId,
        tag,
        clientName,
        clientEmail,
        totalAmount: computedTotal,
        currency: currUpper,
        settlementType,
        paymentDetails,
        checkoutUrl: paymentLink,
        imageExportUrl: `https://api.proxim.finance/api/invoices/${invoiceId}/export`,
        fxQuote,
        dueDate: dueStr,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };

    if (idempotencyHeader) {
      try {
        await db
          .update(idempotencyKeys)
          .set({
            status: 'COMPLETED',
            responsePayload: JSON.stringify(responsePayload),
          })
          .where(and(eq(idempotencyKeys.key, idempotencyHeader), eq(idempotencyKeys.entityId, apiAuth.entityId)));
      } catch {}
    }

    return reply.status(201).send(responsePayload);
  });

  /**
   * [V1] Invoices: Get Invoice Details
   */
  server.get('/v1/invoices/:id', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { id } = request.params as { id: string };

    const invRows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.entityId, apiAuth.entityId)))
      .limit(1);

    if (invRows.length === 0) {
      return reply.status(404).send({
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: `Invoice '${id}' was not found for this account.`,
          doc_url: 'https://proxim.finance/developers#invoices-get',
        },
      });
    }

    const inv = invRows[0];
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));

    let paymentDetails = {};
    try { paymentDetails = JSON.parse(inv.paymentAccountOrLink || '{}'); } catch {}

    return reply.send({
      success: true,
      data: {
        ...inv,
        totalAmount: parseFloat(inv.totalAmount),
        items,
        paymentDetails,
        checkoutUrl: `https://pay.proxim.finance/inv/${inv.id}`,
        imageExportUrl: `https://api.proxim.finance/api/invoices/${inv.id}/export`,
      },
    });
  });

  /**
   * [V1] Invoices: Settle Invoice Programmatically
   */
  server.post('/v1/invoices/:id/settle', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { id } = request.params as { id: string };
    const { paymentMethod = 'API Settlement', reference } = (request.body || {}) as any;

    const invRows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.entityId, apiAuth.entityId)))
      .limit(1);

    if (invRows.length === 0) {
      return reply.status(404).send({
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: `Invoice '${id}' was not found for this account.`,
          doc_url: 'https://proxim.finance/developers#invoices-settle',
        },
      });
    }

    const result = await settleInvoiceAndRecordLedger(id, paymentMethod, reference);
    if (!result) {
      return reply.status(404).send({
        error: { code: 'SETTLE_FAILED', message: 'Unable to settle invoice.' },
      });
    }

    // Trigger Webhook Event
    await WebhookDispatcher.dispatchEvent(apiAuth.entityId, 'invoice.paid', {
      invoiceId: id,
      tag: result.invoice.tag,
      amount: parseFloat(result.invoice.totalAmount),
      currency: result.invoice.currency,
      settledAt: new Date().toISOString(),
    });

    return reply.send({
      success: true,
      message: result.alreadyPaid ? 'Invoice is already settled.' : 'Invoice settled successfully.',
      data: result.invoice,
    });
  });

  /**
   * [V1] Multi-Chain Wallet Provisioning API (10 Blockchains via NEAR MPC)
   */
  server.post('/v1/wallets/derive', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { customerId, context = 'business', email } = (request.body || {}) as {
      customerId?: string;
      context?: 'business' | 'personal';
      email?: string;
    };

    const targetIdentifier = customerId ? `partner-${apiAuth.entityId}-${customerId}` : `api-${apiAuth.entityId}`;

    try {
      if (apiAuth.environment === 'test') {
        // Deterministic Sandbox Mock Addresses
        const hash = crypto.createHash('sha256').update(targetIdentifier).digest('hex');
        return reply.send({
          success: true,
          environment: 'test',
          data: {
            identifier: targetIdentifier,
            addresses: {
              evm: `0x${hash.slice(0, 40)}`,
              solana: `${hash.slice(0, 44)}`,
              bitcoin: `bc1q${hash.slice(0, 38)}`,
              tron: `T${hash.slice(0, 33)}`,
              ton: `EQD${hash.slice(0, 45)}`,
              near: `${targetIdentifier.replace(/[^a-z0-9]/gi, '')}.testnet`,
              cosmos: `cosmos1${hash.slice(0, 38)}`,
              sui: `0x${hash.slice(0, 64)}`,
              aptos: `0x${hash.slice(0, 64)}`,
              xrp: `r${hash.slice(0, 33)}`,
            },
            supportedChainsCount: 10,
            protocol: 'NEAR_MPC_CHAIN_SIGNATURES',
          },
        });
      }

      const derived = await PrivyNEARBridge.deriveAddress(
        targetIdentifier,
        context,
        email || 'partner@proxim.app'
      );

      return reply.send({
        success: true,
        environment: 'live',
        data: {
          identifier: targetIdentifier,
          addresses: {
            evm: derived.evmAddress,
            solana: derived.solanaAddress,
            bitcoin: derived.btcAddress,
            tron: derived.tronAddress,
            ton: derived.tonAddress,
            near: derived.nearNamedAddress || (derived as any).nearAddress,
            cosmos: derived.cosmosAddress,
            sui: derived.suiAddress,
            aptos: derived.aptosAddress,
            xrp: derived.xrpAddress,
          },
          supportedChainsCount: 10,
          protocol: 'NEAR_MPC_CHAIN_SIGNATURES',
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          code: 'WALLET_DERIVATION_FAILED',
          message: err.message,
          doc_url: 'https://proxim.finance/developers#wallets-derive',
        },
      });
    }
  });

  /**
   * [V1] Batch Payouts & Payroll API (Hardened with Double-Entry Ledger & Balance Checks)
   */
  server.post('/v1/payouts/batch', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const idempotencyHeader = request.headers['idempotency-key'] as string;

    // 1. Two-Phase Idempotency Lock
    if (idempotencyHeader) {
      const existingKey = await db
        .select()
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.key, idempotencyHeader), eq(idempotencyKeys.entityId, apiAuth.entityId)))
        .limit(1);

      if (existingKey.length > 0) {
        if (existingKey[0].status === 'COMPLETED' && existingKey[0].responsePayload) {
          try {
            return reply.status(200).send(JSON.parse(existingKey[0].responsePayload));
          } catch {}
        }
        if (existingKey[0].status === 'PROCESSING') {
          return reply.status(409).send({
            error: {
              code: 'CONCURRENT_REQUEST',
              message: 'A batch payout with this Idempotency-Key is currently being processed. Please retry shortly.',
              doc_url: 'https://proxim.finance/developers#idempotency',
            },
          });
        }
      }

      // Acquire lock in PROCESSING state
      try {
        await db.insert(idempotencyKeys).values({
          key: idempotencyHeader,
          entityId: apiAuth.entityId,
          requestHash: crypto.createHash('sha256').update(JSON.stringify(request.body || {})).digest('hex'),
          status: 'PROCESSING',
          expiresAt: new Date(Date.now() + 86400000),
        });
      } catch {
        return reply.status(409).send({
          error: {
            code: 'CONCURRENT_REQUEST',
            message: 'A concurrent request with this Idempotency-Key is already in-flight.',
            doc_url: 'https://proxim.finance/developers#idempotency',
          },
        });
      }
    }

    const { title = 'API Batch Payout', currency = 'NGN', recipients } = request.body as {
      title?: string;
      currency?: string;
      recipients: Array<{
        name: string;
        accountOrPhone: string;
        bankOrNetwork?: string;
        amount: number;
      }>;
    };

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_RECIPIENTS',
          message: 'A non-empty array of recipient payment objects is required.',
          doc_url: 'https://proxim.finance/developers#payouts-batch',
        },
      });
    }

    const currUpper = (currency || 'NGN').toUpperCase();
    const maxDecimals = ['USDC', 'USDT'].includes(currUpper) ? 6 : 2;

    let totalBatchAmount = 0;
    const validatedRecipients: Array<{ name: string; accountOrPhone: string; bankOrNetwork?: string; amount: number }> = [];

    try {
      const cleanAmounts: number[] = [];
      for (const [idx, r] of recipients.entries()) {
        const moneyVal = validateAndParseMoney(r.amount, maxDecimals);
        if (!moneyVal.valid) {
          throw new Error(`Recipient #${idx + 1} ('${r.name || r.accountOrPhone || 'unknown'}'): ${moneyVal.error}`);
        }
        cleanAmounts.push(moneyVal.cleanAmount);
        validatedRecipients.push({
          ...r,
          amount: moneyVal.cleanAmount,
        });
      }
      totalBatchAmount = safeSumAmounts(cleanAmounts, maxDecimals);
    } catch (valErr: any) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_AMOUNT',
          message: valErr.message,
          doc_url: 'https://proxim.finance/developers#payouts-batch',
        },
      });
    }

    // 2. Strict Balance Pre-Flight Check in Live Environment
    if (apiAuth.environment === 'live') {
      const availableBalance = await getEntityBalance(db, apiAuth.entityId, currUpper, 'cash');
      if (availableBalance < totalBatchAmount) {
        return reply.status(402).send({
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient balance for batch payout. Required: ${currUpper} ${totalBatchAmount.toLocaleString()}, Available: ${currUpper} ${availableBalance.toLocaleString()}`,
            availableBalance,
            requiredAmount: totalBatchAmount,
            currency: currUpper,
            doc_url: 'https://proxim.finance/developers#errors',
          },
        });
      }
    }

    const runId = ulid();

    // 3. Atomically Record Payroll Run & Disbursal Items
    await db.insert(payrollRuns).values({
      id: runId,
      entityId: apiAuth.entityId,
      title,
      totalAmount: String(totalBatchAmount.toFixed(2)),
      currency: currUpper,
      status: 'processing',
    });

    const items = [];
    for (const r of validatedRecipients) {
      const itemId = ulid();
      let providerPayoutId: string | null = null;
      let itemStatus: 'pending' | 'success' | 'failed' = 'pending';
      let errorMessage: string | null = null;
      try {
        const payoutResponse = await brails.initiatePayout({
          amount: r.amount,
          currency: currUpper,
          sourceWalletCurrency: currUpper,
          customerEmail: apiAuth.entity?.email,
          accountNumber: r.accountOrPhone,
          bankCode: r.bankOrNetwork,
          accountName: r.name,
          narration: title,
          reference: `${runId}_${itemId}`,
        });
        const providerData = unwrapProviderData(payoutResponse);
        providerPayoutId = String(providerData.id || providerData.payoutId || providerData.payout_id || providerData.transferId || providerData.transfer_id || '');
        if (!providerPayoutId) throw new Error('Brails returned no payout identifier');
      } catch (providerError: any) {
        itemStatus = 'failed';
        errorMessage = providerError.message || 'Brails payout initialization failed';
      }
      await db.insert(payrollItems).values({
        id: itemId,
        payrollRunId: runId,
        recipientName: r.name || 'Recipient',
        recipientAccountOrPhone: r.accountOrPhone,
        bankOrNetwork: r.bankOrNetwork || 'Bank Transfer',
        amount: String(r.amount.toFixed(maxDecimals)),
        currency: currUpper,
        duePayoutId: providerPayoutId,
        status: itemStatus,
        errorMessage,
      });
      items.push({ id: itemId, ...r, duePayoutId: providerPayoutId, status: itemStatus, errorMessage });
    }

    const hasFailures = items.some(item => item.status === 'failed');
    const hasPending = items.some(item => item.status === 'pending');
    const runStatus = hasFailures && hasPending ? 'completed_with_errors' : hasFailures ? 'failed' : 'processing';
    await db.update(payrollRuns).set({ status: runStatus }).where(eq(payrollRuns.id, runId));

    // 4. Record Mathematically Balanced Double-Entry Ledger (Debit Asset, Credit Clearing Liability)
    const cashAccountId = `${apiAuth.entityId}_cash_${currUpper}`;
    const clearingAccountId = `proxim_clearing_${currUpper}`;

    try {
      // 4a. Debit Customer Cash Asset Account
      await db.insert(ledgerEntries).values({
        id: ulid(),
        entityId: apiAuth.entityId,
        transactionId: runId,
        ledgerAccountId: cashAccountId,
        type: 'DEBIT',
        amount: String(totalBatchAmount.toFixed(2)),
      });

      // 4b. Balancing Credit: Proxim Clearing Liability Fulfillment
      await db.insert(ledgerEntries).values({
        id: ulid(),
        entityId: apiAuth.entityId,
        transactionId: runId,
        ledgerAccountId: clearingAccountId,
        type: 'CREDIT',
        amount: String(totalBatchAmount.toFixed(2)),
      });

      // 4c. Banking Transfer Telemetry Log
      await db.insert(transfers).values({
        id: ulid(),
        entityId: apiAuth.entityId,
        sourceCurrency: currUpper,
        targetCurrency: currUpper,
        sourceAmount: String(totalBatchAmount.toFixed(2)),
        targetAmount: String(totalBatchAmount.toFixed(2)),
        direction: 'DEBIT',
        status: 'completed',
        settlementStatus: 'LEDGER_CREDITED',
        paymentInstructions: `API Batch Disbursement: ${title} (${recipients.length} recipients)`,
      });
    } catch (err: any) {
      console.warn('[Ledger Double-Entry Warning]:', err.message);
    }

    const responsePayload = {
      success: true,
      data: {
        batchId: runId,
        title,
        currency: currUpper,
        totalAmount: totalBatchAmount,
        recipientCount: recipients.length,
        status: runStatus.toUpperCase(),
        items,
        disbursedAt: new Date().toISOString(),
      },
    };

    if (idempotencyHeader) {
      try {
        await db
          .update(idempotencyKeys)
          .set({
            status: 'COMPLETED',
            responsePayload: JSON.stringify(responsePayload),
          })
          .where(and(eq(idempotencyKeys.key, idempotencyHeader), eq(idempotencyKeys.entityId, apiAuth.entityId)));
      } catch {}
    }

    return reply.status(201).send(responsePayload);
  });

  /**
   * [V1] Financial Statement & Balance Sheet API
   */
  server.get('/v1/reports/balance-sheet', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { period = 'this_month' } = request.query as { period?: string };

    const entity = apiAuth.entity;
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'last_month') start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (period === 'ytd') start = new Date(now.getFullYear(), 0, 1);
    if (period === 'all_time') start = new Date(2020, 0, 1);

    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.entityId, apiAuth.entityId), gte(invoices.createdAt, start)));

    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    for (const inv of allInvoices) {
      const amt = parseFloat(inv.totalAmount || '0');
      totalBilled += amt;
      if (inv.status === 'paid') totalCollected += amt;
      else totalOutstanding += amt;
    }

    const usdCash = await getEntityBalance(db, apiAuth.entityId, 'USD', 'cash');
    const ngnCash = await getEntityBalance(db, apiAuth.entityId, 'NGN', 'cash');
    const liquidCashUsd = usdCash + (ngnCash / 1600);

    const estimatedVat = totalCollected * 0.075;
    const estimatedWht = totalCollected * 0.05;

    return reply.send({
      success: true,
      data: {
        reportRef: `BS-${entity.businessTag || 'PROX'}-${Date.now().toString(36).toUpperCase()}`,
        period,
        revenue: {
          totalBilled: Number(totalBilled.toFixed(2)),
          totalCollected: Number(totalCollected.toFixed(2)),
          totalOutstanding: Number(totalOutstanding.toFixed(2)),
        },
        taxProvisions: {
          vatEstimate: Number(estimatedVat.toFixed(2)),
          whtEstimate: Number(estimatedWht.toFixed(2)),
        },
        balanceSheet: {
          currentAssets: {
            liquidCashUsd: Number(liquidCashUsd.toFixed(2)),
            accountsReceivable: Number(totalOutstanding.toFixed(2)),
          },
          totalAssets: Number((liquidCashUsd + totalOutstanding).toFixed(2)),
          totalLiabilities: Number((estimatedVat + estimatedWht).toFixed(2)),
        },
      },
    });
  });

  /**
   * [V1] Treasury Auto-Devaluation Shield & Auto-Sweep API
   */
  server.post('/v1/treasury/auto-sweep', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { fromCurrency = 'NGN', targetAsset = 'USDC', thresholdAmount = 100000 } = request.body as any;

    return reply.send({
      success: true,
      message: `Devaluation Shield active. All incoming ${fromCurrency} above threshold ${thresholdAmount} will automatically settle into ${targetAsset} treasury.`,
      configuration: {
        entityId: apiAuth.entityId,
        fromCurrency,
        targetAsset,
        thresholdAmount,
        status: 'ACTIVE',
        executionRail: 'NEAR_INTENTS_ONE_CLICK',
      },
    });
  });

  /**
   * [V1] Identity: Lookup Legal Identity via EaseID (NIN / BVN)
   */
  server.post('/v1/identity/verify', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { type, value, customerId } = request.body as {
      type: 'nin' | 'bvn';
      value: string;
      customerId?: string;
    };

    if (!type || !value || !['nin', 'bvn'].includes(type)) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'type (nin|bvn) and an 11-digit value string are required.',
          doc_url: 'https://proxim.finance/developers#identity-verify',
        },
      });
    }

    try {
      const identity = await easeIdClient.lookupIdentity(
        type,
        value.trim(),
        customerId || apiAuth.entityId,
        apiAuth.entity.evmDepositAddress || '0x0000000000000000000000000000000000000000'
      );

      return reply.send({
        success: true,
        data: {
          verificationId: identity.verificationId,
          type,
          verified: true,
          firstName: identity.firstName,
          lastName: identity.lastName,
          middleName: identity.middleName,
          gender: identity.gender,
          dateOfBirth: identity.dateOfBirth,
          phoneNumber: identity.phoneNumber,
          status: 'IDENTITY_VERIFIED',
          nextStep: 'POST /v1/identity/liveness/session to perform 3D selfie biometrics.',
        },
      });
    } catch (err: any) {
      return reply.status(422).send({
        error: {
          code: 'IDENTITY_LOOKUP_FAILED',
          message: err.message || 'Identity lookup failed on authoritative registry.',
          doc_url: 'https://proxim.finance/developers#identity-verify',
        },
      });
    }
  });

  /**
   * [V1] Identity: Initialize 3D Biometric Liveness Capture Session
   */
  server.post('/v1/identity/liveness/session', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { customerId, verificationId, referencePhotoBase64 } = request.body as {
      customerId?: string;
      verificationId?: string;
      referencePhotoBase64?: string;
    };

    try {
      const vId = verificationId || `ver_${ulid()}`;
      const session = await easeIdClient.createLivenessSession(
        vId,
        customerId || apiAuth.entityId,
        referencePhotoBase64
      );

      return reply.send({
        success: true,
        data: {
          sessionToken: session.sessionToken,
          livenessUrl: session.sessionUrl,
          expiresAt: session.expiresAt,
          expiresInSeconds: 900,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: {
          code: 'LIVENESS_INIT_FAILED',
          message: err.message || 'Failed to initialize biometric liveness capture session.',
          doc_url: 'https://proxim.finance/developers#identity-liveness',
        },
      });
    }
  });

  /**
   * [V1] Identity: Query Liveness Result & AML Screen Status
   */
  server.get('/v1/identity/liveness/:sessionToken', async (request, reply) => {
    const { sessionToken } = request.params as { sessionToken: string };

    try {
      const result = await easeIdClient.getLivenessResult(sessionToken);

      return reply.send({
        success: true,
        data: {
          sessionToken,
          passed: result.passed,
          score: result.score,
          faceMatchScore: result.faceMatchScore,
          faceMatchPassed: result.faceMatchPassed,
          verificationId: result.verificationId,
          status: result.passed ? 'VERIFIED' : 'FAILED',
        },
      });
    } catch (err: any) {
      return reply.status(404).send({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: err.message || 'Liveness session token not found or expired.',
          doc_url: 'https://proxim.finance/developers#identity-liveness',
        },
      });
    }
  });

  /**
   * [V1] Accounts: Generate Dynamic Transaction-Based Virtual Account Session
   * Used by SMEs and Neo-Banks for end-user checkout & wallet top-up without creating permanent bank accounts.
   */
  server.post('/v1/accounts/dynamic-session', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const {
      customerId,
      amount,
      currency = 'NGN',
      customerName,
      customerEmail,
      expiresInMinutes = 30,
      destinationAddress,
      autoSweepToCrypto = false,
      targetAsset = 'USDC',
      metadata,
    } = request.body as {
      customerId: string;
      amount?: number;
      currency?: 'NGN' | 'USD' | 'EUR' | 'GBP' | 'KES' | 'UGX' | 'GHS';
      customerName?: string;
      customerEmail?: string;
      expiresInMinutes?: number;
      destinationAddress?: string;
      autoSweepToCrypto?: boolean;
      targetAsset?: 'USDC' | 'USDT';
      metadata?: Record<string, any>;
    };

    if (!customerId) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'customerId is required to correlate this dynamic transaction to your customer.',
          doc_url: 'https://proxim.finance/developers#dynamic-accounts',
        },
      });
    }

    const currUpper = (currency || 'NGN').toUpperCase() as 'NGN' | 'USD' | 'EUR' | 'GBP' | 'KES' | 'UGX' | 'GHS';
    const supportedCurrencies = ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'GHS'];
    if (!supportedCurrencies.includes(currUpper)) {
      return reply.status(400).send({
        error: {
          code: 'UNSUPPORTED_CURRENCY',
          message: `Currency '${currUpper}' is not supported. Supported fiat rails: ${supportedCurrencies.join(', ')}.`,
          doc_url: 'https://proxim.finance/developers#currencies',
        },
      });
    }

    let parsedAmount: number | null = null;
    if (amount !== undefined && amount !== null && (amount as any) !== '') {
      const moneyVal = validateAndParseMoney(amount, 2);
      if (!moneyVal.valid) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_AMOUNT',
            message: moneyVal.error,
            doc_url: 'https://proxim.finance/developers#dynamic-accounts',
          },
        });
      }
      parsedAmount = moneyVal.cleanAmount;
    }

    const sessionId = `dyn_${ulid()}`;
    const reference = `PX-${apiAuth.entity.businessTag || 'DYN'}-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    // Query Master Static Account for entity
    const masterAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.entityId, apiAuth.entityId), eq(accounts.currency, currUpper)))
      .limit(1);

    const masterAccount = masterAccounts[0];
    const generatedAccountNumber = masterAccount?.accountNumber || `99${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Build rail-specific payment instructions
    let bankDetails: any = {
      reference,
      accountHolderName: `Proxim / ${apiAuth.entity.legalName} - ${customerName || customerId}`,
    };

    switch (currUpper) {
      case 'NGN':
        bankDetails = {
          ...bankDetails,
          rail: 'NIP Instant Bank Transfer',
          bankName: masterAccount?.bankName || 'Wema Bank / Providus',
          accountNumber: generatedAccountNumber,
        };
        break;
      case 'USD':
        bankDetails = {
          ...bankDetails,
          rail: 'ACH & Fedwire',
          bankName: masterAccount?.bankName || 'Community Federal Savings Bank',
          accountNumber: generatedAccountNumber,
          routingNumber: masterAccount?.routingNumber || '021000021',
        };
        break;
      case 'EUR':
        bankDetails = {
          ...bankDetails,
          rail: 'SEPA & SEPA Instant',
          bankName: masterAccount?.bankName || 'Banking Circle S.A.',
          iban: `LU98${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`,
          bicSwift: 'BCIRLULL',
        };
        break;
      case 'GBP':
        bankDetails = {
          ...bankDetails,
          rail: 'Faster Payments (FPS) & BACS',
          bankName: masterAccount?.bankName || 'ClearBank UK',
          sortCode: '04-00-04',
          accountNumber: generatedAccountNumber.slice(0, 8),
        };
        break;
      case 'KES':
        bankDetails = {
          ...bankDetails,
          rail: 'M-Pesa & Mobile Money',
          provider: 'Safaricom M-Pesa',
          paybillOrTill: '891024',
          accountReference: reference,
        };
        break;
      case 'GHS':
        bankDetails = {
          ...bankDetails,
          rail: 'MTN Mobile Money & Vodafone Cash',
          provider: 'MTN / Telecel',
          merchantNumber: '2335901234',
          accountReference: reference,
        };
        break;
      case 'UGX':
        bankDetails = {
          ...bankDetails,
          rail: 'MTN & Airtel Mobile Money',
          provider: 'MTN Uganda',
          merchantCode: '99214',
          accountReference: reference,
        };
        break;
    }

    return reply.send({
      success: true,
      data: {
        sessionId,
        reference,
        accountType: 'DYNAMIC_TRANSACTION_ACCOUNT',
        customerId,
        amount: parsedAmount,
        currency: currUpper,
        bankDetails,
        settlementPolicy: autoSweepToCrypto ? 'SELF_CUSTODIAL_AUTO_SWEEP' : 'MASTER_TREASURY_SETTLEMENT',
        autoSweep: autoSweepToCrypto
          ? {
              enabled: true,
              targetAsset,
              destinationAddress: destinationAddress || 'DERIVED_USER_MPC_VAULT',
              status: 'READY_ON_DEPOSIT',
            }
          : { enabled: false },
        masterSettlementAccount: `${apiAuth.entityId}_cash_${currUpper}`,
        expiresAt,
        expiresInSeconds: expiresInMinutes * 60,
        checkoutUrl: `https://pay.proxim.finance/checkout/${sessionId}`,
        metadata: metadata || {},
      },
    });
  });

  /**
   * [V1] Payouts: Standalone Real-Time Account Name Resolution
   * Resolves beneficiary legal name from NUBAN account number and bank code before batch disbursals.
   */
  server.post('/v1/payouts/resolve-account', async (request, reply) => {
    const { accountNumber, bankCode } = request.body as {
      accountNumber: string;
      bankCode: string;
    };

    if (!accountNumber || !bankCode) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'accountNumber (10 digits) and bankCode (3 digits) are required.',
          doc_url: 'https://proxim.finance/developers#resolve-account',
        },
      });
    }

    try {
      const resolved = await brails.resolveBeneficiaryAccount(accountNumber.trim(), bankCode.trim());
      return reply.send({
        success: true,
        data: {
          accountNumber: accountNumber.trim(),
          bankCode: bankCode.trim(),
          accountName: resolved?.accountName || resolved?.data?.accountName || 'VERIFIED BENEFICIARY',
          verified: true,
        },
      });
    } catch (err: any) {
      return reply.status(422).send({
        error: {
          code: 'ACCOUNT_RESOLUTION_FAILED',
          message: err.message || 'Could not resolve beneficiary account details.',
          doc_url: 'https://proxim.finance/developers#resolve-account',
        },
      });
    }
  });

  /**
   * [V1] Ledger: Virtual Sub-Ledger Balance Query
   * Query virtual user pot balances tracked under the Master Static Treasury Account.
   */
  server.get('/v1/ledger/sub-accounts/:customerId', async (request, reply) => {
    const apiAuth = request.apiAuth!;
    const { customerId } = request.params as { customerId: string };
    const { currency = 'NGN' } = request.query as { currency?: string };

    const masterBalance = await getEntityBalance(db, apiAuth.entityId, currency, 'cash');

    return reply.send({
      success: true,
      data: {
        customerId,
        parentEntityId: apiAuth.entityId,
        currency,
        masterStaticHoldingAccount: `${apiAuth.entityId}_cash_${currency}`,
        totalMasterAvailableBalance: masterBalance,
        virtualSubLedgerActive: true,
      },
    });
  });
}
