import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { createDbClient, eq } from '@payit/db';
import { auditLogs, entities, savingsGoals } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

export async function savingsRoutes(server: FastifyInstance) {
  /**
   * Get Savings summary & pools for an entity.
   */
  server.get('/api/savings/summary', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.send({ savingsPool: 0, roundUpEnabled: true, goals: [] });

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, entityId));
    let savingsPool = 0;

    for (const l of logs) {
      if (l.action === 'SAVINGS_DEPOSIT') {
        try {
          const meta = JSON.parse(l.metadata || '{}');
          savingsPool += parseFloat(meta.amount || 0);
        } catch {}
      } else if (l.action === 'SAVINGS_WITHDRAW') {
        try {
          const meta = JSON.parse(l.metadata || '{}');
          savingsPool -= parseFloat(meta.amount || 0);
        } catch {}
      }
    }

    let dbGoals: any[] = [];
    try {
      dbGoals = await db.select().from(savingsGoals).where(eq(savingsGoals.entityId, entityId));
    } catch (err: any) {
      server.log.warn({ err: err.message }, 'savingsGoals table query failed; returning empty goals array');
    }

    return reply.send({
      savingsPool: Math.max(0, savingsPool),
      roundUpEnabled: true,
      goals: dbGoals.map(g => ({
        id: g.id,
        name: g.name,
        targetAmount: parseFloat(g.targetAmount),
        currentAmount: parseFloat(g.currentAmount),
        currency: g.currency,
      })),
    });
  });

  /**
   * Create New Savings Goal for Entity.
   */
  server.post('/api/savings/goal', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, name, targetAmount, currency } = request.body as {
      entityId: string;
      name: string;
      targetAmount: number;
      currency?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!name || !targetAmount || targetAmount <= 0) {
      return reply.status(400).send({ error: 'Goal name and valid target amount required' });
    }

    const goalId = ulid();
    await db.insert(savingsGoals).values({
      id: goalId,
      entityId,
      name,
      targetAmount: String(targetAmount),
      currentAmount: '0.00',
      currency: currency || 'USD',
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      goal: {
        id: goalId,
        entityId,
        name,
        targetAmount,
        currentAmount: 0.00,
        currency: currency || 'USD',
      },
      message: `Savings goal "${name}" created successfully!`,
    });
  });

  /**
   * Deposit or Withdraw from Savings pool.
   */
  server.post('/api/savings/action', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, type, amount } = request.body as {
      entityId: string;
      type: 'DEPOSIT' | 'WITHDRAW';
      amount: number;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Amount must be greater than zero' });
    }

    const action = type === 'DEPOSIT' ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAW';
    await db.insert(auditLogs).values({
      id: ulid(),
      userId: session.userId,
      entityId,
      action,
      metadata: JSON.stringify({ amount, timestamp: new Date().toISOString() }),
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      action,
      amount,
      message: `${type === 'DEPOSIT' ? 'Deposited' : 'Withdrawn'} $${amount} ${type === 'DEPOSIT' ? 'to' : 'from'} Savings Pool successfully!`,
    });
  });
}
