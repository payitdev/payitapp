import { FastifyInstance } from 'fastify';
import { KMSKeyEnclave } from '@payit/security';
import { validateEntityAccess } from '@payit/ledger';
import { InvoiceSchema, omitPrivateKey } from '@payit/contracts';
import { createDbClient, eq, and } from '@payit/db';
import { invoices, invoiceItems, entities, auditLogs } from '@payit/db/schema';
import { ulid } from 'ulid';
import { assertEntityApproved } from './kyc.js';
import { BrailsClient } from '@payit/integrations';

const kms = new KMSKeyEnclave();
const brails = new BrailsClient();
const db = createDbClient();

export async function invoiceRoutes(server: FastifyInstance) {

  /**
   * Generate Brails Mobile Money / Online Payment Collection Link for Invoice
   */
  server.post('/api/invoices/generate-collection-link', async (request, reply) => {
    const { invoiceId, entityId, channel = 'mobile_money', provider = 'mpesa', phoneNumber } = request.body as {
      invoiceId: string;
      entityId: string;
      channel?: 'mobile_money' | 'card' | 'bank_transfer' | 'ussd';
      provider?: 'mpesa' | 'mtn' | 'airtel';
      phoneNumber?: string;
    };

    if (!invoiceId || !entityId) {
      return reply.status(400).send({ error: 'invoiceId and entityId are required' });
    }

    const invRows = await db.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.entityId, entityId))).limit(1);
    if (invRows.length === 0) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    const inv = invRows[0];
    try {
      server.log.info({ invoiceId, channel, provider }, 'Generating Brails collection payment checkout session');
      const collectionRes = await brails.createCollection({
        amount: Number(inv.totalAmount),
        currency: (inv.currency as any) || 'KES',
        channel: channel || 'mobile_money',
        paymentProvider: provider || 'mpesa',
        phoneNumber: phoneNumber || '+254700000000',
        email: inv.clientEmail,
        customerName: inv.clientName,
        reference: `inv_${inv.id}_${Date.now()}`,
        description: `PayIT Invoice #${inv.tag || inv.id.slice(0, 8)} payment`,
      });

      const checkoutUrl = collectionRes.data?.checkoutUrl || collectionRes.checkout_url || collectionRes.data?.paymentLink || `https://checkout.brails.com/pay/${inv.id}`;

      return reply.send({
        success: true,
        invoiceId: inv.id,
        invoiceNumber: inv.tag || inv.id.slice(0, 8),
        checkoutUrl,
        provider,
        amount: inv.totalAmount,
        currency: inv.currency,
      });
    } catch (err: any) {
      server.log.error({ err: err.message }, 'Failed to generate mobile money collection link');
      return reply.status(400).send({ error: err.message || 'Could not generate mobile money payment link' });
    }
  });

  /**
   * Create invoice with real HD address derivation and DB persistence.
   */
  server.post('/api/invoices/create', async (request, reply) => {
    const {
      session,
      entityId,
      businessCode,
      sequenceNumber,
      clientName,
      clientEmail,
      totalAmount,
      currency,
      dueDate,
      settlementType,
      items,
      description,
      chain,
    } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      businessCode: string;
      sequenceNumber?: number;
      clientName: string;
      clientEmail: string;
      totalAmount: number;
      currency: string;
      dueDate?: string;
      settlementType: 'fiat' | 'stablecoin';
      items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
      description?: string;
      chain?: string;
    };

    if (!clientName || !clientEmail || !totalAmount || !currency) {
      return reply.status(400).send({ error: 'clientName, clientEmail, totalAmount, and currency are required' });
    }

    // Entity guard
    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // Load entity and enforce entity approval gate
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    try {
      assertEntityApproved(entity);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // Determine or generate xpub for this entity
    let xpub = entity.xpub;
    if (!xpub && settlementType === 'stablecoin') {
      xpub = await kms.generateEntityXpub(entityId);
      await db.update(entities).set({ xpub }).where(eq(entities.id, entityId));
    }

    // Auto-sequencing with uniqueness check against collisions
    let seqNum = sequenceNumber;
    if (!seqNum) {
      const existingInvoices = await db.select().from(invoices).where(eq(invoices.entityId, entityId));
      seqNum = existingInvoices.length + 1;
    }

    const code = (businessCode || entity.businessTag || entity.username || 'PAYIT').toUpperCase();
    let tag = `${code}-${String(seqNum).padStart(3, '0')}`;

    // Tag uniqueness check against collisions
    const tagCollisions = await db.select().from(invoices).where(eq(invoices.tag, tag)).limit(1);
    if (tagCollisions.length > 0) {
      seqNum += 10;
      tag = `${code}-${String(seqNum).padStart(3, '0')}`;
    }

    const invoiceId = ulid();

    // Derive dedicated HD address for this invoice (normalized to lowercase for matching)
    let hdReceivingAddress = '';
    if (settlementType === 'stablecoin' && xpub) {
      const hdDerivation = kms.deriveInvoiceAddress(xpub, seqNum!);
      hdReceivingAddress = (hdDerivation.receivingAddress || '').toLowerCase();
    }

    const resolvedDueDate = dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    // Insert invoice into Neon DB
    await db.insert(invoices).values({
      id: invoiceId,
      entityId,
      tag,
      clientName,
      clientEmail,
      totalAmount: String(totalAmount),
      currency: currency.toUpperCase(),
      dueDate: resolvedDueDate,
      hdIndex: seqNum,
      hdReceivingAddress: hdReceivingAddress || '',
      settlementType,
      status: 'pending',
      createdAt: new Date(),
    });

    // Insert invoice line items
    if (items && items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map(item => ({
          id: ulid(),
          invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          amount: String(item.amount),
        }))
      );
    }

    const invoiceData = {
      id: invoiceId,
      entityId,
      tag,
      clientName,
      clientEmail,
      totalAmount,
      currency: currency.toUpperCase(),
      dueDate: resolvedDueDate,
      hdIndex: seqNum,
      hdReceivingAddress,
      settlementType,
      status: 'pending' as const,
      items: items || [],
      createdAt: new Date().toISOString(),
    };

    const validated = InvoiceSchema.parse(invoiceData);
    const sanitized = omitPrivateKey(validated);

    return reply.send({
      invoice: sanitized,
      publicUrl: `payit.co/i/${tag}`,
      qrData: settlementType === 'stablecoin'
        ? `ethereum:${hdReceivingAddress}?amount=${totalAmount}&chain=${chain || 'ethereum'}`
        : null,
    });
  });

  /**
   * Get all invoices for an entity.
   */
  server.get('/api/invoices', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId query parameter required' });

    const entityInvoices = await db.select().from(invoices).where(eq(invoices.entityId, entityId));
    return reply.send({ invoices: entityInvoices });
  });

  /**
   * Get public invoice details by public tag.
   */
  server.get('/api/invoices/public/:tag', async (request, reply) => {
    const { tag } = request.params as { tag: string };
    const matched = await db.select().from(invoices).where(eq(invoices.tag, tag.toUpperCase())).limit(1);

    if (matched.length === 0) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    const inv = matched[0];
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));

    return reply.send({
      invoice: {
        ...inv,
        items,
      },
    });
  });

  /**
   * Manual Invoice Status Override — Gated strictly to Invoice Entity Owner.
   */
  server.post('/api/invoices/pay', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { invoiceId, tag } = request.body as {
      invoiceId?: string;
      tag?: string;
    };

    let targetInvoice: any;

    if (invoiceId) {
      const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
      targetInvoice = rows[0];
    } else if (tag) {
      const rows = await db.select().from(invoices).where(eq(invoices.tag, tag.toUpperCase())).limit(1);
      targetInvoice = rows[0];
    }

    if (!targetInvoice) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    // Entity Owner Guard Validation (C10)
    try {
      validateEntityAccess(session, targetInvoice.entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: 'Only the invoice owner can manually update invoice status' });
    }

    if (targetInvoice.status === 'paid') {
      return reply.status(409).send({ error: 'Invoice has already been paid' });
    }

    await db.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, targetInvoice.id));

    await db.insert(auditLogs).values({
      id: ulid(),
      userId: session.userId,
      entityId: targetInvoice.entityId,
      action: 'INVOICE_MANUALLY_MARKED_PAID_BY_OWNER',
      metadata: JSON.stringify({ invoiceId: targetInvoice.id, tag: targetInvoice.tag }),
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      invoiceId: targetInvoice.id,
      tag: targetInvoice.tag,
      status: 'paid',
      message: `Invoice ${targetInvoice.tag} marked as paid successfully!`,
    });
  });
}
