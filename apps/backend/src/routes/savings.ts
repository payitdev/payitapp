import { FastifyInstance } from 'fastify';
import { createDbClient, eq } from '@payit/db';
import { savingsGoals } from '@payit/db/schema';
import { PodsClient, OndoClient, KaminoClient, NEARIntentsClient, PodsStrategy, OndoToken } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();
const podsClient = new PodsClient();
const ondoClient = new OndoClient();
const kaminoClient = new KaminoClient();
const nearIntentsClient = new NEARIntentsClient();

export async function savingsRoutes(server: FastifyInstance) {
  /**
   * GET /api/savings/summary
   * Get combined savings summary across Pods, Ondo, Kamino, and NEAR Intent Earn
   */
  server.get('/api/savings/summary', async (request, reply) => {
    const { entityId, currency = 'USD' } = request.query as { entityId?: string; currency?: string };

    let dbGoals: any[] = [];
    if (entityId) {
      try {
        dbGoals = await db.select().from(savingsGoals).where(eq(savingsGoals.entityId, entityId));
      } catch (err: any) {
        server.log.warn({ err: err.message }, 'savingsGoals table query failed');
      }
    }

    return reply.send({
      success: true,
      currency: (currency || 'USD').toUpperCase(),
      savingsPool: 0,
      roundUpEnabled: true,
      activeAdapters: ['biconomy_mee_pods', 'biconomy_mee_ondo', 'near_intent_1click_kamino', 'near_intent_1click_earn'],
      goals: dbGoals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: parseFloat(g.targetAmount),
        currentAmount: parseFloat(g.currentAmount),
        currency: g.currency,
      })),
    });
  });

  /**
   * GET /api/savings/yield-comparison
   * Compare live yield across Pods (Base), Ondo (EVM), Kamino (Solana), and NEAR Intent 1Click Earn
   */
  server.get('/api/savings/yield-comparison', async (_request, reply) => {
    try {
      const [podsStrategies, ondoTokens, nearEarnData] = await Promise.all([
        podsClient.getBaseStrategies().catch(() => []),
        ondoClient.listStocksAndETFs().catch(() => []),
        nearIntentsClient.getEarnVaults().catch(() => ({ vaults: [] })),
      ]);

      const podsYieldOptions = podsStrategies.map((s: PodsStrategy) => ({
        id: s.id,
        name: s.assetName,
        protocol: s.protocol,
        network: 'Base (8453)',
        grossApy: `${(s.apy * 100).toFixed(1)}%`,
        userNetApy: `${((s.userNetApy || (s.apy * 100) - 2.0)).toFixed(1)}%`,
        proximCutApy: '2.0%',
        executionEngine: 'Biconomy MEE (Gasless)',
        insured: Boolean(s.isInsured),
      }));

      const ondoYieldOptions = ondoTokens.filter((t: OndoToken) => t.category.includes('yield') || t.category.includes('treasury')).map((t: OndoToken) => ({
        id: t.id || t.symbol,
        name: t.name,
        protocol: 'Ondo Global Markets',
        network: 'Base -> BSC Cross-Chain',
        grossApy: '5.2%',
        userNetApy: '4.2%',
        proximCutApy: '1.0%',
        executionEngine: 'Biconomy MEE Supertransaction',
        insured: true,
      }));

      const kaminoYieldOptions = [
        {
          id: 'kamino-usdc-solana',
          name: 'Kamino Solana High-Yield Earn Vault',
          protocol: 'Kamino Finance',
          network: 'Solana',
          grossApy: '8.5%',
          userNetApy: '6.5%',
          proximCutApy: '2.0%',
          executionEngine: 'NEAR Intent 1Click API',
          insured: false,
        },
      ];

      const nearEarnVaults = (nearEarnData?.vaults || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        protocol: 'NEAR Intent 1Click Earn',
        network: v.chain ? v.chain.toUpperCase() : 'MULTI-CHAIN',
        grossApy: `${v.grossApy}%`,
        userNetApy: `${v.userNetApy}%`,
        proximCutApy: `${v.proximCutApy}%`,
        executionEngine: 'NEAR Intent Solver Network',
        insured: false,
      }));

      return reply.send({
        success: true,
        comparison: {
          pods: podsYieldOptions,
          ondo: ondoYieldOptions,
          kamino: kaminoYieldOptions,
          nearIntentsEarn: nearEarnVaults,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to generate yield comparison', details: err.message });
    }
  });

  /**
   * POST /api/savings/goals
   * Create New Savings Goal for Entity
   */
  server.post('/api/savings/goals', async (request, reply) => {
    const { entityId, name, targetAmount, currency = 'USD', lockPeriodDays } = request.body as {
      entityId: string;
      name: string;
      targetAmount: number;
      currency?: string;
      lockPeriodDays?: number;
    };

    if (!entityId || !name || !targetAmount) {
      return reply.status(400).send({ error: 'entityId, name, and targetAmount are required' });
    }

    const goalId = ulid();
    const lockPeriodEnd = lockPeriodDays ? new Date(Date.now() + lockPeriodDays * 86400000) : null;

    await db.insert(savingsGoals).values({
      id: goalId,
      entityId,
      name,
      targetAmount: String(targetAmount.toFixed(2)),
      currentAmount: '0.00',
      currency: (currency || 'USD').toUpperCase(),
      lockPeriodEnd,
    });

    return reply.send({
      success: true,
      goal: {
        id: goalId,
        name,
        targetAmount,
        currentAmount: 0,
        currency,
        lockPeriodEnd,
      },
    });
  });

  /**
   * GET /api/savings/three-tiers
   * Returns Proxim's 3-Tier Savings & Growth options in plain non-blockchain language
   */
  server.get('/api/savings/three-tiers', async (_request, reply) => {
    return reply.send({
      success: true,
      tiers: [
        {
          tierId: 'tier-1-idle-booster',
          title: 'Idle Balance Booster',
          badge: 'Automated (5-Hour Trigger)',
          tagline: 'Earns daily interest on unspent balance after sitting idle for 5 hours.',
          netApy: '6.2% p.a.',
          grossApy: '8.2% p.a.',
          proximCutApy: '2.0% p.a.',
          liquidity: 'Instant Access (Spent / Withdrawn Anytime)',
          lockPeriod: 'None',
          feeStructure: 'Automated 2.0% yield split deducted at source',
          providerName: 'Proxim Checking Liquidity Pool',
        },
        {
          tierId: 'tier-2-fixed-vaults',
          title: 'Fixed Growth Vaults',
          badge: 'Guaranteed Lock',
          tagline: 'Lock funds for 30–365 days to secure our highest guaranteed growth rate.',
          netApy: '8.5% p.a.',
          grossApy: '10.5% p.a.',
          proximCutApy: '2.0% p.a.',
          liquidity: 'Locked until maturity (Early exit subject to options)',
          lockPeriodOptions: ['30 days', '60 days', '90 days', '365 days'],
          feeStructure: '2.0% yield split + Early Exit choice (Forfeit Interest OR 10% Principal Fee)',
          providerName: 'Proxim Term Vaults',
        },
        {
          tierId: 'tier-3-yield-optimizer',
          title: 'Max Yield Optimizer',
          badge: 'Dynamic Rate Router',
          tagline: 'Automated rate-hunting across global markets to capture top returns.',
          netApy: '9.5% p.a. (Dynamic)',
          grossApy: '10.0% p.a.',
          proximCutApy: '0.50% (50 bps)',
          liquidity: 'Flexible (12-second execution)',
          lockPeriod: 'None',
          feeStructure: '0.50% (50 bps) partner routing fee',
          providerName: 'Proxim Universal Optimizer',
        },
      ],
    });
  });
}

