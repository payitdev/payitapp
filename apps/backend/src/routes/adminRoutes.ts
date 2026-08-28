import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, desc, sql } from '@payit/db';
import {
  entities,
  users,
  accounts,
  transfers,
  invoices,
  payrollRuns,
  payrollItems,
  apiKeys,
  apiLogs,
  webhookDeliveries,
  feeLedger,
} from '@payit/db/schema';
import { ulid } from 'ulid';
import { entityStatusOverrides } from '../middleware/apiKeyAuth.js';

const db = createDbClient();

export async function adminRoutes(server: FastifyInstance) {
  /**
   * [Admin] Global Platform Metrics & Visualization Data
   */
  server.get('/api/admin/metrics', async (request, reply) => {
    let allEntities: any[] = [];
    let allUsers: any[] = [];
    let allApiKeys: any[] = [];

    try {
      allEntities = await db.select().from(entities);
      allUsers = await db.select().from(users);
      allApiKeys = await db.select().from(apiKeys).where(eq(apiKeys.isActive, true));
    } catch {}

    const developerEntityIds = new Set(allApiKeys.map(k => k.entityId));
    const developersCount = developerEntityIds.size;
    const businessesCount = allEntities.filter(e => e.kind === 'BUSINESS' && !developerEntityIds.has(e.id)).length;
    const individualsCount = allEntities.filter(e => e.kind === 'PERSONAL').length;

    // 2. Transaction Volumes & Counts
    let allTransfers: any[] = [];
    let allInvoices: any[] = [];
    let allPayroll: any[] = [];

    try {
      allTransfers = await db.select().from(transfers);
      allInvoices = await db.select().from(invoices);
      allPayroll = await db.select().from(payrollRuns);
    } catch {}

    const usdTransfers = allTransfers.filter(transfer => ['USD', 'USDC'].includes(String(transfer.sourceCurrency || '').toUpperCase()));
    const totalVolumeUsd = usdTransfers.reduce((sum, transfer) => sum + Number(transfer.sourceAmount || 0), 0);
    const inboundVolumeUsd = usdTransfers.filter(transfer => transfer.direction !== 'DEBIT').reduce((sum, transfer) => sum + Number(transfer.sourceAmount || 0), 0);
    const outboundVolumeUsd = usdTransfers.filter(transfer => transfer.direction === 'DEBIT').reduce((sum, transfer) => sum + Number(transfer.sourceAmount || 0), 0);

    // Currency Volume Distribution
    const currencyTotals = new Map<string, number>();
    for (const transfer of allTransfers) {
      const currency = String(transfer.sourceCurrency || 'UNKNOWN').toUpperCase();
      currencyTotals.set(currency, (currencyTotals.get(currency) || 0) + Math.abs(Number(transfer.sourceAmount || 0)));
    }
    const currencyTotal = [...currencyTotals.values()].reduce((sum, amount) => sum + amount, 0);
    const currencyVolumes = [...currencyTotals.entries()].map(([currency, amount]) => ({ currency, amountUsd: currency === 'USD' || currency === 'USDC' ? amount : null, amount, percentage: currencyTotal ? Number((amount / currencyTotal * 100).toFixed(2)) : 0, localSymbol: currency, color: '#35D9D0' }));

    // Chain Activity: Highest Deposits vs Withdrawals
    const chainActivity: any[] = [];

    // 30-Day Historical Daily Velocity for Area Charts
    const dailyVelocity = [...new Set(allTransfers.map(transfer => new Date(transfer.createdAt).toISOString().slice(0, 10)))].sort().slice(-30).map(day => {
      const dayTransfers = allTransfers.filter(transfer => new Date(transfer.createdAt).toISOString().slice(0, 10) === day && ['USD', 'USDC'].includes(String(transfer.sourceCurrency || '').toUpperCase()));
      const inflowsUsd = dayTransfers.filter(transfer => transfer.direction !== 'DEBIT').reduce((sum, transfer) => sum + Number(transfer.sourceAmount || 0), 0);
      const outflowsUsd = dayTransfers.filter(transfer => transfer.direction === 'DEBIT').reduce((sum, transfer) => sum + Number(transfer.sourceAmount || 0), 0);
      return { day, inflowsUsd, outflowsUsd, netClearedUsd: inflowsUsd - outflowsUsd };
    });

    const apiRequestCount = await db.select().from(apiLogs).where(sql`${apiLogs.createdAt} >= NOW() - INTERVAL '24 hours'`).catch(() => [] as any[]);
    const successfulApiRequests = apiRequestCount.filter(log => log.statusCode >= 200 && log.statusCode < 400);
    const revenueUsd = allTransfers.filter(transfer => ['USD', 'USDC'].includes(String(transfer.sourceCurrency || '').toUpperCase())).reduce((sum, transfer) => sum + Number(transfer.feeAmount || 0), 0);

    return reply.send({
      success: true,
      data: {
        users: {
          totalUsers: allUsers.length,
          individualsCount,
          businessesCount,
          developersCount,
          totalSubAccountsEstimate: 0,
        },
        financials: {
          totalGrossVolumeUsd: totalVolumeUsd,
          inboundVolumeUsd,
          outboundVolumeUsd,
          platformRevenueUsd: revenueUsd,
          activeSettlementReservesUsd: 0,
        },
        currencyVolumes,
        chainActivity,
        dailyVelocity,
        apiHealth: {
          successRatePercent: apiRequestCount.length ? successfulApiRequests.length / apiRequestCount.length * 100 : 0,
          avgLatencyMs: apiRequestCount.length ? apiRequestCount.reduce((sum, log) => sum + Number(log.durationMs || 0), 0) / apiRequestCount.length : 0,
          totalRequests24h: apiRequestCount.length,
          activeWebhooksCount: 0,
          webhookDeliverySuccessPercent: 0,
        },
      },
    });
  });

  /**
   * [Admin] List All Entities with Risk & Developer Management Controls
   */
  server.get('/api/admin/entities', async (request, reply) => {
    let allEntities: any[] = [];
    let allApiKeys: any[] = [];
    let allInvoices: any[] = [];

    try {
      allEntities = await db.select().from(entities).orderBy(desc(entities.createdAt));
      allApiKeys = await db.select().from(apiKeys);
      allInvoices = await db.select().from(invoices);
    } catch {}

    const enriched = allEntities.map(e => {
      const keys = allApiKeys.filter(k => k.entityId === e.id);
      const isDeveloper = keys.length > 0;
      const entityInvoices = allInvoices.filter(i => i.entityId === e.id);
      const override = entityStatusOverrides.get(e.id);

      return {
        id: e.id,
        legalName: e.legalName,
        kind: e.kind,
        classification: isDeveloper ? 'DEVELOPER' : e.kind,
        username: e.username || e.businessTag || 'unnamed',
        businessTag: e.businessTag,
        status: override?.status || 'ACTIVE',
        statusReason: override?.reason || null,
        statusUpdatedAt: override?.updatedAt || null,
        dueStatus: e.dueStatus,
        activeApiKeysCount: keys.length,
        totalInvoicesCreated: entityInvoices.length,
        totalProcessedUsd: 0,
        subUsersCount: 0,
        evmAddress: e.evmDepositAddress,
        solanaAddress: e.solanaDepositAddress,
        createdAt: e.createdAt,
      };
    });

    return reply.send({ success: true, entities: enriched });
  });

  /**
   * [Admin] Update Developer / Entity Risk Status (Throttle, Suspend Payouts, Freeze)
   */
  server.post('/api/admin/entities/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, reason = 'Admin manual security review' } = request.body as {
      status: 'ACTIVE' | 'THROTTLED' | 'SUSPENDED_PAYOUTS' | 'FROZEN';
      reason?: string;
    };

    if (!['ACTIVE', 'THROTTLED', 'SUSPENDED_PAYOUTS', 'FROZEN'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status. Must be ACTIVE, THROTTLED, SUSPENDED_PAYOUTS, or FROZEN.' });
    }

    entityStatusOverrides.set(id, {
      status,
      reason,
      updatedAt: new Date().toISOString(),
    });

    return reply.send({
      success: true,
      message: `Entity '${id}' status updated to '${status}'.`,
      entityId: id,
      status,
      reason,
    });
  });

  /**
   * [Admin] Live Cross-Tenant Global Transaction Feed
   */
  server.get('/api/admin/transactions', async (request, reply) => {
    let allTransfers: any[] = [];
    let allEntities: any[] = [];

    try {
      allTransfers = await db.select().from(transfers).orderBy(desc(transfers.createdAt)).limit(50);
      allEntities = await db.select().from(entities);
    } catch {}

    const entityMap = new Map(allEntities.map(e => [e.id, e]));

    const liveFeed = allTransfers.map(tx => {
      const ent = entityMap.get(tx.entityId);
      const amount = parseFloat(tx.sourceAmount || '0');
      const fee = parseFloat(tx.feeAmount || '0');
      const curr = (tx.sourceCurrency || 'NGN').toUpperCase();

      return {
        id: tx.id,
        entityName: ent ? ent.legalName : 'Unknown Entity',
        entityType: ent ? (ent.kind === 'BUSINESS' ? 'BUSINESS' : 'DEVELOPER') : 'DEVELOPER',
        rail: `${curr} Clearing Rail`,
        direction: tx.direction === 'DEBIT' ? 'OUTBOUND_PAYOUT' : 'INBOUND',
        amount: `${amount.toLocaleString()} ${curr}`,
        currency: curr,
        amountUsd: curr === 'USD' || curr === 'USDC' ? amount : amount * 0.00065,
        feeUsd: fee * 0.00065,
        status: (tx.status || 'COMPLETED').toUpperCase(),
        createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
        customer: tx.paymentInstructions || 'Direct Settlement',
      };
    });

    return reply.send({ success: true, transactions: liveFeed });
  });

  /**
   * [Admin] Live Anomaly & Security Alerts Monitor
   */
  server.get('/api/admin/alerts', async (request, reply) => {
    const failedLogs = await db.select().from(apiLogs).where(sql`${apiLogs.statusCode} >= 400`).orderBy(desc(apiLogs.createdAt)).limit(50).catch(() => [] as any[]);
    const alerts = failedLogs.map(log => ({
      id: `api_error_${log.id}`,
      severity: log.statusCode >= 500 ? 'HIGH' : 'MEDIUM',
      title: `API request returned ${log.statusCode}`,
      entityName: log.entityId,
      description: `${log.method} ${log.endpoint}`,
      timestamp: log.createdAt,
    }));

    return reply.send({ success: true, alerts });
  });

  /**
   * [Admin] Groq AI Security Sentinel Telemetry Evaluation
   */
  server.post('/api/admin/sentinel/evaluate', async (request, reply) => {
    const { GroqSecuritySentinel } = await import('../services/groqSecuritySentinel.js');
    const body = request.body as any;
    const telemetry = {
      entityId: body.entityId || 'ent_test_01',
      entityName: body.entityName || 'Test Developer',
      totalRequests: body.totalRequests || 100,
      failedRequests: body.failedRequests || 65,
      errorRate: body.errorRate || 0.65,
      recentEndpoints: body.recentEndpoints || ['/v1/payouts/batch', '/v1/wallets/derive'],
      recentStatusCodes: body.recentStatusCodes || [400, 422, 500],
      payloadPatterns: body.payloadPatterns || ['Rapid fuzzing of recipient account arrays'],
    };

    const decision = await GroqSecuritySentinel.analyzeAndMitigate(telemetry);
    return reply.send({ success: true, decision });
  });
}
