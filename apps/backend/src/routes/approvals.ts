import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, desc } from '@payit/db';
import { multiSigApprovals, multiSigApprovalSigners } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

function formatApproval(row: any, signers: any[]) {
  const signedCount = signers.filter(s => s.status === 'SIGNED').length;
  return {
    id: row.id,
    title: row.title,
    amount: parseFloat(row.amount || '0'),
    currency: row.currency,
    description: row.description,
    status: row.status,
    requiredSignatures: row.requiredSignatures,
    signedCount,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    signers: signers.map(s => ({
      id: s.id,
      label: s.label,
      keyNote: s.keyNote,
      status: s.status,
      signedAt: s.signedAt ? new Date(s.signedAt).toISOString() : null,
    })),
  };
}

async function loadApprovals(entityId: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED') {
  const rows = await db
    .select()
    .from(multiSigApprovals)
    .where(
      and(
        eq(multiSigApprovals.entityId, entityId),
        status ? eq(multiSigApprovals.status, status) : undefined,
      ),
    )
    .orderBy(desc(multiSigApprovals.createdAt))
    .limit(100);
  return Promise.all(
    rows.map(async row => {
      const signers = await db
        .select()
        .from(multiSigApprovalSigners)
        .where(eq(multiSigApprovalSigners.approvalId, row.id));
      return formatApproval(row, signers);
    }),
  );
}

export async function approvalRoutes(server: FastifyInstance) {
  /**
   * Pending approvals for an entity — feeds the dashboard banner.
   * Shape matches the Flutter PendingApproval model.
   */
  server.get('/api/approvals/pending', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }
    const approvals = await loadApprovals(entityId, 'PENDING');
    return reply.send({ success: true, entityId, approvals });
  });

  /**
   * Full approval list (any status) with signer detail.
   */
  server.get('/api/approvals', async (request, reply) => {
    const { entityId, status } = request.query as { entityId?: string; status?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED'] as const;
    const filtered = validStatuses.find(s => s === status?.toUpperCase());
    const approvals = await loadApprovals(entityId, filtered);
    return reply.send({ success: true, entityId, approvals });
  });

  /**
   * Create a multi-sig approval request with its signer slots.
   */
  server.post('/api/approvals', async (request, reply) => {
    const body = (request.body || {}) as {
      entityId?: string;
      title?: string;
      description?: string;
      amount?: number | string;
      currency?: string;
      requiredSignatures?: number;
      signers?: { label?: string; keyNote?: string }[];
    };
    const session = request.session;
    if (!session?.userId) return reply.status(401).send({ error: 'Authentication required' });
    if (!body.entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!session.userEntityIds.includes(body.entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }
    if (!body.title) return reply.status(400).send({ error: 'title is required' });

    const signers = Array.isArray(body.signers) ? body.signers : [];
    if (signers.length === 0) return reply.status(400).send({ error: 'At least one signer is required' });
    const requiredSignatures = Math.max(1, Math.min(Number(body.requiredSignatures) || signers.length, signers.length));

    const approvalId = ulid();
    const now = new Date();
    await db.insert(multiSigApprovals).values({
      id: approvalId,
      entityId: body.entityId,
      title: body.title,
      description: body.description ?? null,
      amount: String(body.amount ?? 0),
      currency: (body.currency || 'USDC').toUpperCase(),
      requiredSignatures,
      status: 'PENDING',
      createdBy: session.userId,
      createdAt: now,
      updatedAt: now,
    });
    for (const signer of signers) {
      await db.insert(multiSigApprovalSigners).values({
        id: ulid(),
        approvalId,
        label: signer.label || 'Signer',
        keyNote: signer.keyNote ?? null,
        status: 'PENDING',
        createdAt: now,
      });
    }
    const [approval] = await loadApprovals(body.entityId);
    return reply.status(201).send({ success: true, approval });
  });

  /**
   * Sign (or reject) an approval on behalf of a signer slot. Once the
   * signature threshold is met the approval flips to APPROVED (or REJECTED).
   */
  server.post('/api/approvals/:id/sign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { signerId?: string; action?: 'sign' | 'reject' };
    const session = request.session;
    if (!session?.userId) return reply.status(401).send({ error: 'Authentication required' });
    if (!body.signerId) return reply.status(400).send({ error: 'signerId is required' });

    const rows = await db.select().from(multiSigApprovals).where(eq(multiSigApprovals.id, id)).limit(1);
    if (rows.length === 0) return reply.status(404).send({ error: 'Approval not found' });
    const approval = rows[0];
    if (!session.userEntityIds.includes(approval.entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }
    if (approval.status !== 'PENDING') {
      return reply.status(409).send({ error: `Approval is already ${approval.status}` });
    }

    const signerRows = await db
      .select()
      .from(multiSigApprovalSigners)
      .where(and(eq(multiSigApprovalSigners.id, body.signerId), eq(multiSigApprovalSigners.approvalId, id)))
      .limit(1);
    if (signerRows.length === 0) return reply.status(404).send({ error: 'Signer not found on this approval' });

    const action = body.action === 'reject' ? 'REJECTED' : 'SIGNED';
    await db
      .update(multiSigApprovalSigners)
      .set({ status: action, signedAt: action === 'SIGNED' ? new Date() : null })
      .where(eq(multiSigApprovalSigners.id, body.signerId));

    const signers = await db.select().from(multiSigApprovalSigners).where(eq(multiSigApprovalSigners.approvalId, id));
    const signed = signers.filter(s => s.status === 'SIGNED').length;
    const rejected = signers.filter(s => s.status === 'REJECTED').length;

    let nextStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
    if (rejected > 0) nextStatus = 'REJECTED';
    else if (signed >= approval.requiredSignatures) nextStatus = 'APPROVED';
    if (nextStatus !== 'PENDING') {
      await db.update(multiSigApprovals).set({ status: nextStatus, updatedAt: new Date() }).where(eq(multiSigApprovals.id, id));
    }

    const [updated] = await loadApprovals(approval.entityId);
    return reply.send({ success: true, approval: updated });
  });
}
