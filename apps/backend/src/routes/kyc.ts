import { FastifyInstance } from 'fastify';
import { NuvionClient, NuvionTier1Payload, NuvionTier2Payload } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';
import { ulid } from 'ulid';

const nuvion = new NuvionClient();
const db = createDbClient();

export function assertEntityApproved(entity: { id: string; nuvionStatus: string }) {
  if (entity.nuvionStatus !== 'approved') {
    throw new Error(`Entity ${entity.id} is in status '${entity.nuvionStatus}'. Feature requires 'approved' KYC/KYB status.`);
  }
}

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
   * Submit Tier 1 Personal KYC — submits payload to Nuvion, marks status 'pending'.
   * Status flips to 'approved' EXCLUSIVELY via Nuvion webhook.
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

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found for this user' });
    }

    try {
      server.log.info({ entityId, kycBody }, 'Submitting Tier 1 KYC payload to Nuvion API');
      const res = await nuvion.submitTier1Kyc(kycBody);

      server.log.info({ res }, 'Raw Nuvion Tier 1 KYC response');

      // Update entity status to 'pending' — webhook flips to 'approved'
      await db
        .update(entities)
        .set({
          nuvionTier: res.tier,
          nuvionStatus: 'pending',
          nuvionEntityId: res.nuvionEntityId,
        })
        .where(eq(entities.id, entityId));

      // Provision returned accounts without generating random math fallbacks
      for (const fa of res.fiatAccounts) {
        if (!fa.accountNumber) {
          server.log.warn({ fa }, 'Skipping account provisioning: Nuvion returned missing accountNumber');
          continue;
        }

        const existing = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, fa.currency)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            nuvionAccountId: fa.nuvionAccountId,
            accountNumber: fa.accountNumber,
            bankName: fa.bankName,
            accountHolderName: `${kycBody.legalName}/PayIT`,
            currency: fa.currency,
            status: 'active',
            createdAt: new Date(),
          });
        }
      }

      return reply.send({
        success: true,
        message: 'Tier 1 Personal Identity Submitted to Nuvion (Awaiting Webhook Approval)',
        nuvionEntityId: res.nuvionEntityId,
        tier: res.tier,
        status: 'pending',
        accountHolderName: `${kycBody.legalName}/PayIT`,
        particleNetworkAddress: res.particleNetworkAddress,
        virtualAccount: res.virtualAccount,
        fiatAccounts: res.fiatAccounts,
        limits: nuvion.getTierLimits(1),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 1 KYC submission failed');
      return reply.status(400).send({ error: err.message || 'KYC submission failed on Nuvion API' });
    }
  });

  /**
   * Submit Tier 2 Corporate KYB — submits payload to Nuvion, marks status 'pending'.
   * Status flips to 'approved' EXCLUSIVELY via Nuvion webhook.
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
      server.log.info({ entityId, kybBody }, 'Submitting Tier 2 KYB payload to Nuvion API');
      const res = await nuvion.submitTier2Kyb(kybBody);

      server.log.info({ res }, 'Raw Nuvion Tier 2 KYB response');

      await db
        .update(entities)
        .set({
          nuvionTier: res.tier,
          nuvionStatus: 'pending',
          nuvionEntityId: res.nuvionEntityId,
        })
        .where(eq(entities.id, entityId));

      for (const fa of res.fiatAccounts) {
        if (!fa.accountNumber) {
          server.log.warn({ fa }, 'Skipping corporate account provisioning: Nuvion returned missing accountNumber');
          continue;
        }

        const existing = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, fa.currency)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(accounts).values({
            id: ulid(),
            entityId,
            nuvionAccountId: fa.nuvionAccountId,
            accountNumber: fa.accountNumber,
            bankName: fa.bankName,
            accountHolderName: `${kybBody.businessLegalName}/PayIT`,
            currency: fa.currency,
            status: 'active',
            createdAt: new Date(),
          });
        }
      }

      return reply.send({
        success: true,
        message: 'Tier 2 Corporate Business Submitted to Nuvion (Awaiting Webhook Approval)',
        nuvionEntityId: res.nuvionEntityId,
        tier: res.tier,
        status: 'pending',
        accountHolderName: `${kybBody.businessLegalName}/PayIT`,
        particleNetworkAddress: res.particleNetworkAddress,
        virtualAccount: res.virtualAccount,
        fiatAccounts: res.fiatAccounts,
        limits: nuvion.getTierLimits(2),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 2 KYB submission failed');
      return reply.status(400).send({ error: err.message || 'KYB submission failed on Nuvion API' });
    }
  });

  /**
   * Get current entity KYC/KYB status from Neon DB.
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

    let entityAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.entityId, entityId));

    // If entity is verified (tier >= 1) but has no accounts in DB,
    // pull live accounts from Nuvion and persist them now.
    if (entityAccounts.length === 0 && entity.nuvionTier >= 1) {
      try {
        server.log.info({ entityId }, 'Verified entity has no accounts in DB — fetching live from Nuvion');
        const nuvRes = await nuvion.getAccountsForEntity(entityId);
        const liveAccounts = nuvRes?.data?.data?.data || nuvRes?.data?.data?.accounts || nuvRes?.data?.data || (Array.isArray(nuvRes?.data) ? nuvRes.data : []);

        // Sort live accounts: prioritize accounts with platform_user_id, then newest created first
        liveAccounts.sort((a: any, b: any) => {
          const aHasUser = a.meta?.platform_user_id ? 1 : 0;
          const bHasUser = b.meta?.platform_user_id ? 1 : 0;
          if (aHasUser !== bHasUser) return bHasUser - aHasUser;
          return (b.created || 0) - (a.created || 0);
        });

        for (const a of liveAccounts) {
          const accNum = a.nuvion_ban || a.account_number || a.accountNumber || a.virtual_account_number;
          const currency = a.currency || 'NGN';
          if (!accNum) continue;

          const existing = await db.select().from(accounts)
            .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, currency)))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(accounts).values({
              id: ulid(),
              entityId,
              nuvionAccountId: a.id,
              accountNumber: accNum,
              bankName: nuvion.resolveAccountBankName(currency, a.bank_name || a.bankName || ''),
              accountHolderName: a.display_name || entity.legalName || 'Account Holder',
              currency,
              status: 'active',
              createdAt: new Date(),
            });
          }
        }

        // Re-fetch from DB after sync
        entityAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
        server.log.info({ entityId, count: entityAccounts.length }, 'Synced live Nuvion accounts to DB');
      } catch (syncErr: any) {
        server.log.warn({ syncErr: syncErr.message, entityId }, 'Failed to sync live Nuvion accounts — returning empty');
      }
    }

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
