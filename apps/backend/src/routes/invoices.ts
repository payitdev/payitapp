import { FastifyInstance } from 'fastify';
import { KMSKeyEnclave } from '@payit/security';
import { validateEntityAccess } from '@payit/ledger';
import { InvoiceSchema, omitPrivateKey } from '@payit/contracts';
import { createDbClient, eq, and } from '@payit/db';
import { invoices, invoiceItems, entities } from '@payit/db/schema';
import { ulid } from 'ulid';

const kms = new KMSKeyEnclave();
const db = createDbClient();

export async function invoiceRoutes(server: FastifyInstance) {

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

    // Verify entity exists in DB
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    // Determine or generate xpub for this entity (stored once, reused for all invoices)
    let xpub = entity.xpub;
    if (!xpub && settlementType === 'stablecoin') {
      xpub = await kms.generateEntityXpub(entityId);
      await db.update(entities).set({ xpub }).where(eq(entities.id, entityId));
    }

    // Get current invoice count for auto-sequencing if no sequenceNumber provided
    let seqNum = sequenceNumber;
    if (!seqNum) {
      const existingInvoices = await db.select().from(invoices).where(eq(invoices.entityId, entityId));
      seqNum = existingInvoices.length + 1;
    }

    const formattedSeq = String(seqNum).padStart(3, '0');
    const code = (businessCode || entity.businessTag || entity.username || 'PAYIT').toUpperCase();
    const tag = `${code}-${formattedSeq}`;
    const invoiceId = ulid();

    // Derive dedicated HD address for this invoice (crypto only)
    let hdReceivingAddress = entity.xpub || ''; // For fiat: no crypto address needed
    if (settlementType === 'stablecoin' && xpub) {
      const hdDerivation = kms.deriveInvoiceAddress(xpub, seqNum!);
      hdReceivingAddress = hdDerivation.receivingAddress;
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
   * List invoices for an entity — reads from Neon DB only.
   */
  server.get('/api/invoices', async (request, reply) => {
    const { activeEntityId } = request.query as { activeEntityId?: string };
    if (!activeEntityId) return reply.status(400).send({ error: 'activeEntityId query parameter required' });

    const entityInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.entityId, activeEntityId));

    return reply.send({ invoices: entityInvoices });
  });

  /**
   * Mark invoice as paid — updates DB status.
   */
  server.patch('/api/invoices/:invoiceId/status', async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const { status } = request.body as { status: 'paid' | 'cancelled' | 'overdue' };

    if (!['paid', 'cancelled', 'overdue'].includes(status)) {
      return reply.status(400).send({ error: 'status must be paid, cancelled, or overdue' });
    }

    await db.update(invoices).set({ status }).where(eq(invoices.id, invoiceId));

    return reply.send({ success: true, invoiceId, status });
  });
}
