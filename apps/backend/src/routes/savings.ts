import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { createDbClient, eq, and } from '@payit/db';
import { auditLogs, entities, savingsGoals, ledgerAccounts, ledgerEntries } from '@payit/db/schema';
import { getEntityBalance } from '../utils/balance.js';
import { ulid } from 'ulid';

const db = createDbClient();

export async function savingsRoutes(server: FastifyInstance) {
  /**
   * Get Savings summary & pools for an entity derived from real ledger.
   */
  server.get('/api/savings/summary', async (request, reply) => {
    const { entityId, currency = 'NGN' } = request.query as { entityId?: string; currency?: string };
    if (!entityId) return reply.send({ savingsPool: 0, roundUpEnabled: true, goals: [] });

    const currUpper = (currency || 'NGN').toUpperCase();
    const savingsPool = await getEntityBalance(db, entityId, currUpper, 'savings');

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
  server.post('/api/savings/goals', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, name, targetAmount, currency, lockPeriodDays } = request.body as {
      entityId: string;
      name: string;
      targetAmount: number;
      currency?: string;
      lockPeriodDays?: number;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!name || !targetAmount || targetAmount <= 0) {
      return reply.status(400).send({ error: 'Goal name and positive target amount are required' });
    }

    const goalId = ulid();
    const lockPeriodEnd = lockPeriodDays && lockPeriodDays > 0
      ? new Date(Date.now() + lockPeriodDays * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(savingsGoals).values({
      id: goalId,
      entityId,
      name,
      targetAmount: String(targetAmount),
      currentAmount: '0.00',
      currency: (currency || 'NGN').toUpperCase(),
      lockPeriodEnd,
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
        currency: (currency || 'NGN').toUpperCase(),
        lockPeriodEnd: lockPeriodEnd ? lockPeriodEnd.toISOString() : null,
      },
      message: `Savings goal "${name}" created successfully!`,
    });
  });

  /**
   * Deposit or Withdraw from Savings pool with real double-entry ledger execution (C14 & Issue 13).
   */
  server.post('/api/savings/action', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, goalId, type, amount, currency = 'NGN' } = request.body as {
      entityId: string;
      goalId?: string;
      type: 'DEPOSIT' | 'WITHDRAW';
      amount: number;
      currency?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Amount must be greater than zero' });
    }

    const currUpper = (currency || 'NGN').toUpperCase();

    let targetGoal: any = null;
    if (goalId) {
      const goalRows = await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.entityId, entityId))).limit(1);
      if (goalRows.length > 0) {
        targetGoal = goalRows[0];
        if (type === 'WITHDRAW' && targetGoal.lockPeriodEnd && new Date() < new Date(targetGoal.lockPeriodEnd)) {
          return reply.status(400).send({
            error: 'VAULT_LOCKED',
            message: `Cannot withdraw from savings vault until lock period ends on ${new Date(targetGoal.lockPeriodEnd).toLocaleDateString('en-US')}`,
            lockPeriodEnd: targetGoal.lockPeriodEnd,
          });
        }
      }
    }

    const txId = ulid();
    const cashAccId = `${entityId}_cash_${currUpper}`;
    const savingsAccId = `${entityId}_savings_${currUpper}`;

    try {
      await db.transaction(async (tx) => {
        // Ensure cash and savings ledger accounts exist
        const existingAccs = await tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.entityId, entityId));
        const hasCash = existingAccs.some(a => a.id === cashAccId);
        const hasSavings = existingAccs.some(a => a.id === savingsAccId);

        if (!hasCash) {
          await tx.insert(ledgerAccounts).values({
            id: cashAccId,
            entityId,
            name: `Cash / Wallet (${currUpper})`,
            type: 'ASSET',
            currency: currUpper,
            createdAt: new Date(),
          });
        }
        if (!hasSavings) {
          await tx.insert(ledgerAccounts).values({
            id: savingsAccId,
            entityId,
            name: `Savings Vault (${currUpper})`,
            type: 'ASSET',
            currency: currUpper,
            createdAt: new Date(),
          });
        }

        if (type === 'DEPOSIT') {
          const cashBal = await getEntityBalance(tx, entityId, currUpper, 'cash');
          if (cashBal < amount) {
            throw new Error(`INSUFFICIENT_CASH_FUNDS:${cashBal}`);
          }

          // Move money: debit cash, credit savings
          await tx.insert(ledgerEntries).values([
            { id: ulid(), entityId, transactionId: txId, ledgerAccountId: cashAccId, type: 'DEBIT', amount: String(amount), createdAt: new Date() },
            { id: ulid(), entityId, transactionId: txId, ledgerAccountId: savingsAccId, type: 'CREDIT', amount: String(amount), createdAt: new Date() },
          ]);

          if (targetGoal) {
            const newGoalAmt = parseFloat(targetGoal.currentAmount || '0') + amount;
            await tx.update(savingsGoals).set({ currentAmount: String(newGoalAmt) }).where(eq(savingsGoals.id, targetGoal.id));
          }
        } else {
          // WITHDRAW
          const savingsBal = await getEntityBalance(tx, entityId, currUpper, 'savings');
          if (savingsBal < amount) {
            throw new Error(`INSUFFICIENT_SAVINGS_FUNDS:${savingsBal}`);
          }

          // Move money: debit savings, credit cash
          await tx.insert(ledgerEntries).values([
            { id: ulid(), entityId, transactionId: txId, ledgerAccountId: savingsAccId, type: 'DEBIT', amount: String(amount), createdAt: new Date() },
            { id: ulid(), entityId, transactionId: txId, ledgerAccountId: cashAccId, type: 'CREDIT', amount: String(amount), createdAt: new Date() },
          ]);

          if (targetGoal) {
            const newGoalAmt = Math.max(0, parseFloat(targetGoal.currentAmount || '0') - amount);
            await tx.update(savingsGoals).set({ currentAmount: String(newGoalAmt) }).where(eq(savingsGoals.id, targetGoal.id));
          }
        }

        const action = type === 'DEPOSIT' ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAW';
        await tx.insert(auditLogs).values({
          id: ulid(),
          userId: session.userId,
          entityId,
          action,
          metadata: JSON.stringify({ amount, currency: currUpper, goalId, txId, timestamp: new Date().toISOString() }),
          createdAt: new Date(),
        });
      });
    } catch (err: any) {
      if (err.message?.startsWith('INSUFFICIENT_CASH_FUNDS')) {
        const bal = err.message.split(':')[1];
        return reply.status(422).send({ error: `Insufficient spendable balance. Available: ${currUpper} ${bal}` });
      }
      if (err.message?.startsWith('INSUFFICIENT_SAVINGS_FUNDS')) {
        const bal = err.message.split(':')[1];
        return reply.status(422).send({ error: `Insufficient savings balance. Available in savings: ${currUpper} ${bal}` });
      }
      return reply.status(500).send({ error: `Savings action failed: ${err.message}` });
    }

    return reply.send({
      success: true,
      action: type === 'DEPOSIT' ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAW',
      amount,
      currency: currUpper,
      txId,
      message: `${type === 'DEPOSIT' ? 'Deposited' : 'Withdrawn'} ${currUpper} ${amount} ${type === 'DEPOSIT' ? 'to' : 'from'} Savings Vault successfully!`,
    });
  });
}
