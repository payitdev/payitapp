import { FastifyInstance } from 'fastify';
import { createDbClient, eq, desc } from '@payit/db';
import { calculateLiveEntityBalance } from './transfers.js';
import { transfers } from '@payit/db/schema';

const db = createDbClient();

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

interface TxRow {
  direction: string | null;
  targetAmount: string | null;
  sourceAmount: string | null;
  createdAt: Date | null;
}

function txAmount(tx: TxRow): number {
  return parseFloat(tx.targetAmount || tx.sourceAmount || '0');
}

function isInbound(tx: TxRow): boolean {
  return tx.direction === 'CREDIT';
}

export async function treasuryMetricsRoutes(server: FastifyInstance) {
  /**
   * Precomputed treasury metrics for an entity: balance, burn rate,
   * runway, 30-day inflow with month-over-month change — all derived
   * server-side from the full transfer history (no 30-row cap).
   */
  server.get('/api/treasury/metrics', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }

    const rows = (await db
      .select({
        direction: transfers.direction,
        targetAmount: transfers.targetAmount,
        sourceAmount: transfers.sourceAmount,
        createdAt: transfers.createdAt,
      })
      .from(transfers)
      .where(eq(transfers.entityId, entityId))
      .orderBy(desc(transfers.createdAt))
      .limit(2000)) as TxRow[];

    const now = Date.now();

    // Burn rate: average monthly net outflow over the observed window.
    const debits = rows.filter(tx => !isInbound(tx));
    const oldest = rows.length > 0 && rows[rows.length - 1].createdAt
      ? new Date(rows[rows.length - 1].createdAt!).getTime()
      : now;
    const windowMs = Math.max(now - oldest, 1);
    const windowMonths = windowMs / MONTH_MS;
    const totalDebit = debits.reduce((sum, tx) => sum + txAmount(tx), 0);
    const monthlyBurn = windowMonths >= 1 ? totalDebit / windowMonths : totalDebit;
    const estimated = windowMonths < 1;

    // Balance: computed from the live rail (same source as /api/transfers/balance).
    const balance = await calculateLiveEntityBalance(entityId).catch(() => 0);

    const runwayMonths = monthlyBurn > 0 ? balance / monthlyBurn : null;

    // 30-day inflow + MoM change.
    const inflowBetween = (from: number, to: number) =>
      rows
        .filter(tx => isInbound(tx) && tx.createdAt)
        .filter(tx => {
          const t = new Date(tx.createdAt!).getTime();
          return t >= from && t < to;
        })
        .reduce((sum, tx) => sum + txAmount(tx), 0);

    const inflow30d = inflowBetween(now - 30 * 24 * 60 * 60 * 1000, now);
    const inflowPrev30d = inflowBetween(now - 60 * 24 * 60 * 60 * 1000, now - 30 * 24 * 60 * 60 * 1000);
    const momChangePercent = inflowPrev30d > 0 ? ((inflow30d - inflowPrev30d) / inflowPrev30d) * 100 : null;

    return reply.send({
      success: true,
      entityId,
      balance,
      monthlyBurn,
      burnEstimated: estimated,
      runwayMonths,
      inflow30d,
      inflowPrev30d,
      momChangePercent,
      historyMonths: Number(windowMonths.toFixed(2)),
      sampleSize: rows.length,
      computedAt: new Date().toISOString(),
    });
  });
}
