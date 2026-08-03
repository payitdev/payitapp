import { FastifyInstance } from 'fastify';
import { NuvionClient, NuvionTier1Payload, NuvionTier2Payload } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';
import { ulid } from 'ulid';

const nuvion = new NuvionClient();
const db = createDbClient();

export async function kycRoutes(server: FastifyInstance) {

  /**
   * Get Nuvion KYC tier definitions and limits.
   */
  server.get('/api/kyc/tiers', async () => {
    return {
      tiers: [
        nuvion.getTierLimits(0),
        nuvion.getTierLimits(1),
        nuvion.getTierLimits(2),
        nuvion.getTierLimits(3),
      ],
    };
  });

  /**
   * Submit Tier 1 Personal KYC — calls Nuvion and stores result in DB.
   */
  server.post('/api/kyc/submit-tier1', async (request, reply) => {
    const { userId, entityId, ...kycBody } = request.body as NuvionTier1Payload & {
      userId: string;
      entityId: string;
    };

    if (!kycBody.legalName || !kycBody.bvn || !kycBody.dob || !kycBody.address) {
      return reply.status(400).send({
        error: 'legalName, bvn, dob, and address are required for Tier 1 verification',
      });
    }

    if (!userId || !entityId) {
      return reply.status(400).send({ error: 'userId and entityId are required' });
    }

    // Verify entity belongs to this user
    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found for this user' });
    }

    try {
      const res = await nuvion.submitTier1Kyc(kycBody);

      // Update entity tier and status in Neon DB
      await db
        .update(entities)
        .set({
          nuvionTier: res.tier,
          nuvionStatus: 'approved',
          nuvionEntityId: res.nuvionEntityId,
        })
        .where(eq(entities.id, entityId));

      // Provision all Nuvion fiat accounts (NGN, USD, GBP, EUR) into DB
      for (const fa of res.fiatAccounts) {
        const existing = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, fa.currency)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            nuvionAccountId: fa.nuvionAccountId || `nacc_${fa.currency || 'USD'}_${Date.now()}`,
            accountNumber: fa.accountNumber || `99${Math.floor(10000000 + Math.random() * 90000000)}`,
            bankName: fa.bankName || `Nuvion ${fa.currency || 'USD'} Platform`,
            accountHolderName: fa.accountHolderName || 'PayIT Account',
            currency: fa.currency || 'USD',
            status: 'active',
            createdAt: new Date(),
          });
        }
      }

      return reply.send({
        success: true,
        message: 'Tier 1 Personal Identity Verified with Nuvion',
        nuvionEntityId: res.nuvionEntityId,
        tier: res.tier,
        status: res.status,
        accountHolderName: res.accountHolderName,
        particleNetworkAddress: res.particleNetworkAddress,
        virtualAccount: res.virtualAccount,
        fiatAccounts: res.fiatAccounts,
        limits: nuvion.getTierLimits(1),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 1 KYC submission failed');
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Submit Tier 2 Corporate KYB — calls Nuvion and stores result in DB.
   */
  server.post('/api/kyc/submit-tier2', async (request, reply) => {
    const { userId, entityId, ...kybBody } = request.body as NuvionTier2Payload & {
      userId: string;
      entityId: string;
    };

    if (!kybBody.businessLegalName || !kybBody.rcNumber || !kybBody.tin || !kybBody.businessAddress || !kybBody.uboBvn) {
      return reply.status(400).send({
        error: 'businessLegalName, rcNumber, tin, businessAddress, and uboBvn are required for Tier 2 KYB',
      });
    }

    if (!userId || !entityId) {
      return reply.status(400).send({ error: 'userId and entityId are required' });
    }

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found for this user' });
    }

    try {
      const res = await nuvion.submitTier2Kyb(kybBody);

      await db
        .update(entities)
        .set({
          nuvionTier: res.tier,
          nuvionStatus: 'approved',
          nuvionEntityId: res.nuvionEntityId,
        })
        .where(eq(entities.id, entityId));

      // Provision all Nuvion corporate fiat accounts into DB
      for (const fa of res.fiatAccounts) {
        const existing = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, fa.currency)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            nuvionAccountId: fa.nuvionAccountId || `nacc_biz_${fa.currency || 'USD'}_${Date.now()}`,
            accountNumber: fa.accountNumber || `88${Math.floor(10000000 + Math.random() * 90000000)}`,
            bankName: fa.bankName || `Nuvion ${fa.currency || 'USD'} Corporate Platform`,
            accountHolderName: fa.accountHolderName || 'PayIT Corporate Account',
            currency: fa.currency || 'USD',
            status: 'active',
            createdAt: new Date(),
          });
        }
      }

      return reply.send({
        success: true,
        message: 'Tier 2 Corporate Business Verified with Nuvion (CAC Certified)',
        nuvionEntityId: res.nuvionEntityId,
        tier: res.tier,
        status: res.status,
        accountHolderName: res.accountHolderName,
        particleNetworkAddress: res.particleNetworkAddress,
        virtualAccount: res.virtualAccount,
        fiatAccounts: res.fiatAccounts,
        limits: nuvion.getTierLimits(2),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 2 KYB submission failed');
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Get current entity KYC/KYB status — reads from Neon DB, not hardcoded.
   */
  server.get('/api/kyc/status', async (request, reply) => {
    const { entityId, userId } = request.query as { entityId?: string; userId?: string };

    if (!entityId || !userId) {
      return reply.status(400).send({ error: 'entityId and userId query parameters are required' });
    }

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    const tier = entity.nuvionTier as 0 | 1 | 2 | 3;
    const limits = nuvion.getTierLimits(tier);

    // Load associated accounts from DB
    const entityAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.entityId, entityId));

    return reply.send({
      entityId: entity.id,
      entityKind: entity.kind,
      nuvionEntityId: entity.nuvionEntityId,
      nuvionStatus: entity.nuvionStatus,
      nuvionTier: entity.nuvionTier,
      legalName: entity.legalName,
      accountHolderName: `${entity.legalName}/PayIT`,
      username: entity.username,
      businessTag: entity.businessTag,
      accounts: entityAccounts.map(a => ({
        id: a.id,
        currency: a.currency,
        accountNumber: a.accountNumber,
        bankName: a.bankName,
        status: a.status,
      })),
      limits,
    });
  });
}
