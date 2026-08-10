import { FastifyInstance } from 'fastify';
import { NuvionClient, ParticleClient, NuvionTier1Payload, NuvionTier2Payload } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';
import { ulid } from 'ulid';
import { generateUniqueUsername } from '../utils/username.js';

const nuvion = new NuvionClient();
const particle = new ParticleClient();
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
   * Submit Tier 1 Personal KYC — submits payload to Nuvion, marks status 'pending' unconditionally.
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

      // Set status to 'pending' unconditionally. Approval occurs exclusively via Nuvion webhook.
      const newStatus = 'pending';

      let uniqueUsername = entityRows[0].username;
      if (!uniqueUsername) {
        uniqueUsername = await generateUniqueUsername(db, kycBody.legalName, 'PERSONAL');
      }

      await db
        .update(entities)
        .set({
          legalName: kycBody.legalName,
          ...(uniqueUsername ? { username: uniqueUsername, usernameCustomized: 0 } : {}),
          nuvionTier: 1,
          nuvionStatus: newStatus,
          nuvionEntityId: res.nuvionEntityId,
        })
        .where(eq(entities.id, entityId));

      return reply.send({
        success: true,
        message: 'Tier 1 Personal Identity Submitted to Nuvion (Awaiting Webhook Approval)',
        nuvionEntityId: res.nuvionEntityId,
        tier: 1,
        status: newStatus,
        legalName: kycBody.legalName,
        username: uniqueUsername,
        particleNetworkAddress: res.particleNetworkAddress,
        fiatAccounts: [],
        limits: nuvion.getTierLimits(1),
      });
    } catch (err: any) {
      server.log.error({ err }, 'Tier 1 KYC submission failed');
      return reply.status(400).send({ error: err.message || 'KYC submission failed on Nuvion API' });
    }
  });

  /**
   * Submit Tier 2 Corporate KYB — submits payload to Nuvion, marks status 'pending' unconditionally.
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

      const newStatus = 'pending';

      // Sanitize & validate business tag, storing it directly into entities.businessTag
      let rawTag = kybBody.businessTag || kybBody.businessLegalName || 'BUSINESS';
      let resolvedTag = rawTag.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 15);
      if (resolvedTag.length < 3) resolvedTag = `BIZ_${resolvedTag}`;

      let tagCandidate = resolvedTag;
      let counter = 1;
      while (true) {
        const existing = await db.select().from(entities).where(eq(entities.businessTag, tagCandidate)).limit(1);
        if (existing.length === 0 || existing[0].id === entityId) {
          break;
        }
        tagCandidate = `${resolvedTag.slice(0, 10)}${counter}`;
        counter++;
      }

      await db
        .update(entities)
        .set({
          legalName: kybBody.businessLegalName,
          businessTag: tagCandidate,
          nuvionTier: 2,
          nuvionStatus: newStatus,
          nuvionEntityId: res.nuvionEntityId,
          solanaAddress: (res as any).solanaAddress || res.particleNetworkAddress,
        })
        .where(eq(entities.id, entityId));

      return reply.send({
        success: true,
        message: 'Business details submitted to Nuvion. Verification pending approval.',
        nuvionEntityId: res.nuvionEntityId,
        tier: 2,
        status: newStatus,
        legalName: kybBody.businessLegalName,
        businessTag: tagCandidate,
        particleNetworkAddress: res.particleNetworkAddress,
        fiatAccounts: [],
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

    let currentStatus = entity.nuvionStatus;
    let currentTier = entity.nuvionTier;

    // SECONDARY POLLING FALLBACK: Query live Nuvion entity status & entity-scoped accounts
    if (entity.nuvionEntityId && currentStatus !== 'approved') {
      try {
        const entRes = await nuvion.getEntityById(entity.nuvionEntityId);
        const liveStatus = (entRes?.data?.entity?.status || entRes?.data?.status || '').toLowerCase();
        if (liveStatus && liveStatus !== currentStatus) {
          server.log.info({ entityId, oldStatus: currentStatus, liveStatus }, '[Secondary Polling Fallback] Entity status updated from live Nuvion API check');
          await db.update(entities).set({ nuvionStatus: liveStatus }).where(eq(entities.id, entityId));
          currentStatus = liveStatus;
        }
      } catch (entErr: any) {
        server.log.warn({ entErr: entErr.message, nuvionEntityId: entity.nuvionEntityId }, 'Could not check live Nuvion entity status');
      }
    }

    if (entityAccounts.length === 0 && (entity.nuvionTier >= 1 || entity.nuvionStatus === 'pending') && entity.nuvionEntityId) {
      try {
        server.log.info({ entityId, nuvionEntityId: entity.nuvionEntityId }, '[Secondary Polling Fallback] Checking live entity-scoped Nuvion accounts');
        const nuvRes = await nuvion.getAccountsForEntity(entity.nuvionEntityId);
        const liveAccounts = nuvRes?.data?.data?.data || nuvRes?.data?.data?.accounts || nuvRes?.data?.data || (Array.isArray(nuvRes?.data) ? nuvRes.data : []);

        if (Array.isArray(liveAccounts) && liveAccounts.length > 0) {
          const newTier = entity.kind === 'BUSINESS' ? 2 : 1;
          await db.update(entities).set({ nuvionStatus: 'approved', nuvionTier: newTier }).where(eq(entities.id, entityId));
          currentStatus = 'approved';
          currentTier = newTier;
        }

        for (const a of liveAccounts) {
          // Strict entity isolation check: verify account is scoped to this Nuvion entity ID
          const accEntityId = a.entity_id || a.meta?.entity_id;
          if (accEntityId && accEntityId !== entity.nuvionEntityId) {
            continue;
          }

          const currency = a.currency || 'NGN';

          const existing = await db.select().from(accounts)
            .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, currency)))
            .limit(1);

          if (existing.length === 0) {
            let detailAccNumber = a.nuvion_ban || a.account_number;
            let detailBankName = nuvion.resolveAccountBankName(currency, a.bank_name || a.bankName || '');

            if (!detailAccNumber && a.id) {
              try {
                const detailRes = await nuvion.createAccountDetails(a.id);
                detailAccNumber = detailRes.accountNumber;
                if (detailRes.bankName) detailBankName = detailRes.bankName;
              } catch (err: any) {
                server.log.warn({ accId: a.id, err: err.message }, 'Could not fetch account_details; using primary account number');
              }
            }

            if (!detailAccNumber) continue;

            await db.insert(accounts).values({
              id: ulid(),
              entityId,
              nuvionAccountId: a.id,
              accountNumber: detailAccNumber,
              bankName: detailBankName,
              accountHolderName: a.display_name || entity.legalName || 'Account Holder',
              currency,
              status: 'active',
              createdAt: new Date(),
            });
          }
        }

        entityAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
        server.log.info({ entityId, count: entityAccounts.length }, 'Synced entity-scoped live Nuvion accounts to DB via secondary polling fallback');
      } catch (syncErr: any) {
        server.log.warn({ syncErr: syncErr.message, entityId }, 'Secondary polling fallback sync failed');
      }
    }

    let activeUsername = entity.username;
    if (currentStatus === 'approved' && !activeUsername) {
      activeUsername = await generateUniqueUsername(db, entity.legalName || 'user', entity.kind as 'PERSONAL' | 'BUSINESS');
      await db.update(entities).set({ username: activeUsername }).where(eq(entities.id, entity.id));
    }

    const particleAcc = await particle.getOrCreateUniversalAccount(entity.id, entity.kind as 'PERSONAL' | 'BUSINESS');
    if (particleAcc.solanaAddress && !entity.solanaAddress) {
      await db.update(entities).set({ solanaAddress: particleAcc.solanaAddress }).where(eq(entities.id, entity.id));
    }

    return reply.send({
      entityId: entity.id,
      entityKind: entity.kind,
      nuvionEntityId: entity.nuvionEntityId,
      nuvionStatus: currentStatus,
      nuvionTier: currentTier,
      legalName: entity.legalName,
      accountHolderName: entity.legalName || '',
      username: activeUsername,
      usernameCustomized: Boolean(entity.usernameCustomized),
      businessTag: entity.businessTag,
      particleNetworkAddress: particleAcc.walletAddress,
      solanaAddress: particleAcc.solanaAddress,
      accounts: entityAccounts.map(a => ({
        id: a.id,
        nuvionAccountId: a.nuvionAccountId,
        currency: a.currency,
        accountNumber: a.accountNumber,
        bankName: a.bankName,
        accountHolderName: a.accountHolderName || entity.legalName || 'PayIT Account',
        status: a.status,
      })),
      limits,
    });
  });
}
