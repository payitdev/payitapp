/**
 * KYC / KYB Routes — EaseID + Brails Integration
 *
 * Architecture:
 *   1. User POSTs NIN or BVN → EaseID lookup → returns verified legal identity
 *   2. Liveness session created → frontend embeds URL → user completes selfie
 *   3. AML screening runs silently in background
 *   4. On pass → Brails customer + virtual account provisioned with on-chain binding
 *   5. Account number immediately returned to user
 *
 * On-chain binding: every Brails virtual account is tagged with the user's
 * EVM deposit address (derived by NEAR Chain Signatures / PrivyNEARBridge).
 * This makes fiat → crypto settlement deterministic and user-unique.
 */

import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts, users, kycVerifications } from '@payit/db/schema';
import { BrailsClient, easeIdClient } from '@payit/integrations';
import { ulid } from 'ulid';
import crypto from 'crypto';

const db = createDbClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireEvmAddress(entity: { evmDepositAddress?: string | null }): string {
  if (!entity.evmDepositAddress) {
    throw new Error('Wallet was not created yet — please try again in a moment.');
  }
  return entity.evmDepositAddress;
}

function hashIdentityValue(value: string): string {
  return crypto.createHash('sha256').update(value.trim()).digest('hex');
}

async function getEntityAccounts(entityId: string) {
  const accs = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
  return accs.map((a) => ({
    id: a.id,
    accountNumber: a.accountNumber,
    routingNumber: a.routingNumber,
    bankName: a.bankName,
    currency: a.currency,
    rail: a.rail,
    accountHolderName: a.accountHolderName,
    status: a.status,
  }));
}

function responseValue(response: any, ...keys: string[]) {
  for (const key of keys) {
    if (response?.[key] !== undefined) return response[key];
    if (response?.data?.[key] !== undefined) return response.data[key];
    if (response?.data?.data?.[key] !== undefined) return response.data.data[key];
  }
  return undefined;
}

async function provisionBrailsAccounts(params: {
  brails: BrailsClient;
  entity: any;
  user: any;
  identity: Record<string, any>;
  bvn?: string;
  nin?: string;
  currencies?: string[];
}): Promise<any[]> {
  const { brails, entity, user, identity, bvn, nin } = params;
  const names = String(identity.fullName || entity.legalName).trim().split(/\s+/);
    let customerId = entity.dueCustomerId || '';
    if (!customerId) {
      const customer = await brails.createCustomer({
        firstName: identity.firstName || names[0] || entity.legalName,
        lastName: identity.lastName || names.slice(1).join(' ') || names[0] || entity.legalName,
        email: user.email,
        phoneNumber: identity.phoneNumber,
        bvn,
        nin,
        dob: identity.dateOfBirth,
      });
      customerId = String(responseValue(customer, 'id', 'customerId', 'customer_id') || '');
      if (customerId) {
        await db.update(entities).set({ dueCustomerId: customerId }).where(and(eq(entities.id, entity.id), eq(entities.userId, entity.userId)));
      }
    }
  if (!customerId) throw new Error('Brails returned no customer ID');
    const currencies = (params.currencies || (process.env.BRAILS_ACCOUNT_CURRENCIES || 'NGN').split(',')).map(value => value.trim().toUpperCase()).filter(Boolean);
    const supportedCurrencies = new Set(['NGN', 'USD']);
    if (currencies.some(currency => !supportedCurrencies.has(currency))) throw new Error('Brails virtual accounts support only NGN and USD in this integration');
  const bank = (process.env.BRAILS_VIRTUAL_ACCOUNT_BANK || 'providus').toLowerCase() as 'safehaven' | 'providus';
  if (!['safehaven', 'providus'].includes(bank)) throw new Error('BRAILS_VIRTUAL_ACCOUNT_BANK must be safehaven or providus');
  const accountsCreated: any[] = [];
  for (const currency of currencies) {
    const existing = await db.select().from(accounts).where(and(eq(accounts.entityId, entity.id), eq(accounts.currency, currency))).limit(1);
    if (existing.length > 0) {
      accountsCreated.push(existing[0]);
      continue;
    }
    const accountResponse = await brails.createVirtualAccount({
      customerId,
      currency: currency as any,
      type: entity.kind === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL',
      bank,
      firstName: identity.firstName || names[0] || entity.legalName,
      lastName: identity.lastName || names.slice(1).join(' ') || names[0] || entity.legalName,
      bvn,
      nin,
      customerEmail: user.email,
      phoneNumber: identity.phoneNumber,
      dateOfBirth: identity.dateOfBirth,
      rcNumber: entity.kind === 'BUSINESS' ? entity.rcNumber : undefined,
      businessLegalName: entity.kind === 'BUSINESS' ? entity.legalName : undefined,
      reference: `proxim_${entity.id}_${currency.toLowerCase()}`,
      personalInformation: { address: identity.address },
    });
    const account = responseValue(accountResponse, 'account', 'virtualAccount', 'virtual_account') || accountResponse;
    const accountId = String(responseValue(account, 'id', 'accountId', 'account_id') || '');
    const accountNumber = String(responseValue(account, 'accountNumber', 'account_number', 'accountNo', 'account_no') || '');
    if (!accountId || !accountNumber) throw new Error(`Brails returned incomplete ${currency} virtual account data`);
    const created = await db.insert(accounts).values({
      id: `brails_${entity.id}_${currency.toLowerCase()}`,
      entityId: entity.id,
      dueVirtualAccountId: accountId,
      accountNumber,
      routingNumber: responseValue(account, 'routingNumber', 'routing_number', 'bankCode', 'bank_code'),
      bankName: String(responseValue(account, 'bankName', 'bank_name', 'bank') || 'Brails'),
      accountHolderName: entity.legalName,
      currency,
      rail: 'bank_transfer',
      status: 'active',
    }).onConflictDoNothing().returning();
    accountsCreated.push(created[0] || account);
  }
  await db.update(entities).set({ dueCustomerId: customerId, dueStatus: 'approved' }).where(eq(entities.id, entity.id));
  return accountsCreated;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function kycRoutes(server: FastifyInstance) {
  const brails = new BrailsClient();

  /**
   * GET /api/kyc/status
   * Returns current KYC/KYB status for an entity.
   * Temporarily simplified to skip wallet address backfill and Brails account checks.
   */
  server.get('/api/kyc/status', async (request, reply) => {
    const { entityId, userId } = request.query as { entityId: string; userId: string };
    if (!entityId || !userId) {
      return reply.status(400).send({ error: 'entityId and userId are required' });
    }

    let entityRows: any[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        entityRows = await db
          .select()
          .from(entities)
          .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
          .limit(1);
        break;
      } catch (err: any) {
        if (attempt === 2) {
          console.warn('[KYC Status DB Retry Warning]:', err.message);
          return reply.status(503).send({ error: 'Database service is temporarily reconnecting. Please retry.' });
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    const fiatAccounts = await getEntityAccounts(entity.id);

    return reply.send({
      entityId: entity.id,
      entityKind: entity.kind,
      kind: entity.kind,
      legalName: entity.legalName,
      username: entity.username,
      usernameCustomized: entity.usernameCustomized,
      kycStatus: entity.dueStatus,
      dueStatus: entity.dueStatus,
      kycTier: entity.dueStatus === 'approved' ? (entity.kind === 'PERSONAL' ? 1 : 2) : 0,
      dueTier: entity.dueStatus === 'approved' ? (entity.kind === 'PERSONAL' ? 1 : 2) : 0,
      dueCustomerId: entity.dueCustomerId,
      evmDepositAddress: entity.evmDepositAddress,
      solanaDepositAddress: entity.solanaDepositAddress,
      btcDepositAddress: entity.btcDepositAddress,
      tronDepositAddress: entity.tronDepositAddress,
      tonDepositAddress: entity.tonDepositAddress,
      nearDepositAddress: entity.nearDepositAddress,
      cosmosDepositAddress: entity.cosmosDepositAddress,
      suiDepositAddress: entity.suiDepositAddress,
      aptosDepositAddress: entity.aptosDepositAddress,
      xrpDepositAddress: entity.xrpDepositAddress,
      accounts: fiatAccounts,
    });
  });

  /**
   * POST /api/kyc/lookup
   * Step 1 of personal KYC: Look up identity by NIN or BVN via EaseID.
   * Returns the verified identity preview to display to user ("Welcome, Full Name").
   * Does NOT yet mark KYC as passed — that happens after liveness check.
   */
  server.post('/api/kyc/lookup', async (request, reply) => {
    const { userId, entityId, type, value } = request.body as {
      userId: string;
      entityId: string;
      type: 'nin' | 'bvn';
      value: string;
    };

    if (!userId || !entityId || !type || !value) {
      return reply.status(400).send({ error: 'userId, entityId, type (nin|bvn), and value are required' });
    }

    if (!['nin', 'bvn'].includes(type)) {
      return reply.status(400).send({ error: 'type must be nin or bvn' });
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

    try {
      const evmAddress = requireEvmAddress(entity);

      const identity = await easeIdClient.lookupIdentity(
        type,
        value,
        entityId,
        evmAddress,
      );

      const kycVerificationId = ulid();
      await db.insert(kycVerifications).values({
        id: kycVerificationId,
        userId,
        entityId,
        entityKind: entity.kind,
        idType: type,
        idValueHash: hashIdentityValue(value),
        status: 'identity_verified',
        identityVerificationId: identity.verificationId,
        identityData: {
          fullName: identity.fullName,
          firstName: identity.firstName,
          middleName: identity.middleName,
          lastName: identity.lastName,
          dateOfBirth: identity.dateOfBirth,
          gender: identity.gender,
          phoneNumber: identity.phoneNumber,
          photoBase64: identity.photoBase64,
          hasPhoto: Boolean(identity.photoBase64),
        },
      });

      return reply.send({
        success: true,
        kycVerificationId,
        verificationId: identity.verificationId,
        fullName: identity.fullName,
        firstName: identity.firstName,
        middleName: identity.middleName,
        lastName: identity.lastName,
        dateOfBirth: identity.dateOfBirth,
        gender: identity.gender,
        phoneNumber: identity.phoneNumber,
          photoBase64: identity.photoBase64,
        hasPhoto: Boolean(identity.photoBase64),
      });
    } catch (err: any) {
      console.error('[EaseID Lookup] Error:', err.message);
      return reply.status(422).send({
        error: 'We could not verify your identity. Please check your details and try again.',
        details: err.message,
      });
    }
  });

  /**
   * POST /api/kyc/liveness/create
   * Step 2 of personal KYC: Create an EaseID liveness session URL.
   * Frontend embeds the URL in an iframe or opens it for the selfie capture.
   */
  server.post('/api/kyc/liveness/create', async (request, reply) => {
    const { entityId, verificationId, referencePhotoBase64 } = request.body as {
      entityId: string;
      verificationId: string;
      referencePhotoBase64?: string;
    };

    if (!entityId || !verificationId) {
      return reply.status(400).send({ error: 'entityId and verificationId are required' });
    }

    const verificationRows = await db
      .select()
      .from(kycVerifications)
      .where(and(eq(kycVerifications.entityId, entityId), eq(kycVerifications.identityVerificationId, verificationId)))
      .limit(1);
    if (verificationRows.length === 0) {
      return reply.status(404).send({ error: 'Identity verification record not found.' });
    }

    try {
      const session = await easeIdClient.createLivenessSession(
        verificationId,
        entityId,
        referencePhotoBase64,
      );

      return reply.send({
        success: true,
        sessionUrl: session.sessionUrl,
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
      });
    } catch (err: any) {
      console.error('[EaseID Liveness] Session creation error:', err.message);
      return reply.status(500).send({
        error: 'We could not start the identity verification check. Please try again.',
        details: err.message,
      });
    }
  });

  /**
   * POST /api/kyc/liveness/verify
   * Step 3: Poll the liveness result, run AML, and on full pass:
   *   - Mark entity as approved
   *   - Skip Brails account provisioning for now (awaiting credentials)
   */
  server.post('/api/kyc/liveness/verify', async (request, reply) => {
    const {
      userId,
      entityId,
      sessionToken,
      verificationId,
      kycVerificationId,
      fullName,
      firstName,
      lastName,
      dateOfBirth,
      nin,
      bvn,
      phone,
    } = request.body as {
      userId: string;
      entityId: string;
      sessionToken: string;
      verificationId: string;
      kycVerificationId: string;
      fullName: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      nin?: string;
      bvn?: string;
      phone?: string;
    };

    if (!userId || !entityId || !sessionToken || !verificationId || !kycVerificationId) {
      return reply.status(400).send({ error: 'userId, entityId, sessionToken, verificationId, and kycVerificationId are required' });
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

    const verificationRows = await db
      .select()
      .from(kycVerifications)
      .where(and(
        eq(kycVerifications.id, kycVerificationId),
        eq(kycVerifications.userId, userId),
        eq(kycVerifications.entityId, entityId),
        eq(kycVerifications.identityVerificationId, verificationId),
      ))
      .limit(1);
    if (verificationRows.length === 0) {
      return reply.status(404).send({ error: 'Identity verification record not found.' });
    }
    const verification = verificationRows[0];
    const identityData = (verification.identityData || {}) as Record<string, any>;
    const verifiedFullName = identityData.fullName || '';
    const verifiedDateOfBirth = identityData.dateOfBirth || '';
    const verifiedPhone = identityData.phoneNumber || undefined;
    const submittedIdValue = verification.idType === 'nin' ? nin : bvn;
    if (!submittedIdValue || hashIdentityValue(submittedIdValue) !== verification.idValueHash) {
      return reply.status(400).send({ error: 'The identity number does not match the verification request.' });
    }

    try {
      const blacklist = await easeIdClient.queryBlacklist({
        bvnNo: verification.idType === 'bvn' ? submittedIdValue : undefined,
        ninNo: verification.idType === 'nin' ? submittedIdValue : undefined,
        phoneNumber: verifiedPhone,
      });
      if (blacklist.hit) {
        await db.update(kycVerifications).set({
          amlStatus: 'blacklisted',
          amlFlagged: 1,
          status: 'rejected',
          failureReason: 'EaseID blacklist hit',
        }).where(eq(kycVerifications.id, kycVerificationId));
        await db.update(entities).set({ dueStatus: 'rejected' }).where(eq(entities.id, entityId));
        return reply.status(403).send({ error: 'Identity verification failed.' });
      }

      // 1. Get liveness result
      const liveness = await easeIdClient.getLivenessResult(sessionToken);

      await db.update(kycVerifications).set({
        livenessSessionId: sessionToken,
        livenessStatus: liveness.passed ? 'passed' : 'failed',
        livenessScore: String(liveness.score),
        faceMatchScore: liveness.faceMatchScore == null ? null : String(liveness.faceMatchScore),
        status: liveness.passed ? 'liveness_verified' : 'rejected',
        failureReason: liveness.passed ? null : 'Liveness verification failed',
      }).where(eq(kycVerifications.id, kycVerificationId));

      if (!liveness.passed) {
        return reply.status(422).send({
          error: 'Identity check did not pass. Please ensure good lighting and try again.',
          score: liveness.score,
        });
      }

      if (liveness.faceMatchPassed === false) {
        await db.update(kycVerifications).set({
          status: 'rejected',
          failureReason: 'EaseID face match failed',
        }).where(eq(kycVerifications.id, kycVerificationId));
        return reply.status(422).send({ error: 'The selfie does not match the verified identity.' });
      }

      const referenceImage = identityData.photoBase64;
      const selfieImage = liveness.raw?.photoBase64;
      let faceMatchVerified = liveness.faceMatchPassed === true;
      if (referenceImage && selfieImage) {
        const faceMatch = await easeIdClient.compareFaces(selfieImage, referenceImage);
        faceMatchVerified = faceMatch.passed;
        await db.update(kycVerifications).set({
          faceMatchScore: String(faceMatch.similarity),
        }).where(eq(kycVerifications.id, kycVerificationId));
        if (!faceMatch.passed) {
          await db.update(kycVerifications).set({
            status: 'rejected',
            failureReason: 'EaseID face similarity below threshold',
          }).where(eq(kycVerifications.id, kycVerificationId));
          return reply.status(422).send({ error: 'The selfie does not match the verified identity.' });
        }
      }
      if (!faceMatchVerified) {
        await db.update(kycVerifications).set({
          status: 'rejected',
          failureReason: 'EaseID face match result unavailable',
        }).where(eq(kycVerifications.id, kycVerificationId));
        return reply.status(422).send({ error: 'We could not confirm that the selfie matches the verified identity.' });
      }

      // 2. AML screening (non-blocking: allow through with LOW/MEDIUM risk; flag HIGH/CRITICAL for manual review)
      let amlRisk = 'LOW';
      try {
        const aml = await easeIdClient.screenAML(verifiedFullName, verifiedDateOfBirth, 'NG');
        amlRisk = aml.riskLevel;
        await db.update(kycVerifications).set({
          amlStatus: 'completed',
          amlRiskLevel: aml.riskLevel,
          amlFlagged: aml.flagged ? 1 : 0,
          status: aml.flagged && (aml.riskLevel === 'HIGH' || aml.riskLevel === 'CRITICAL') ? 'under_review' : 'aml_cleared',
        }).where(eq(kycVerifications.id, kycVerificationId));
        if (aml.flagged) {
          await db
            .update(entities)
            .set({ dueStatus: 'pending' })
            .where(eq(entities.id, entityId));
          return reply.status(202).send({
            success: false,
            status: 'under_review',
            message: 'Your account is under review. We will notify you when verification is complete.',
          });
        }
      } catch (amlErr: any) {
        await db.update(kycVerifications).set({
          amlStatus: 'error',
          status: 'under_review',
          failureReason: 'EaseID risk screening unavailable',
        }).where(eq(kycVerifications.id, kycVerificationId));
        return reply.status(503).send({ error: 'Identity screening is temporarily unavailable. Please try again.' });
      }

      const computedLegalName = verifiedFullName || entity.legalName;
      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!userRows[0]) return reply.status(404).send({ error: 'User not found' });
      await db
        .update(entities)
        .set({
          dueStatus: 'pending',
          legalName: computedLegalName,
        })
        .where(eq(entities.id, entityId));

      await db.update(kycVerifications).set({
        status: 'account_provisioning_pending',
      }).where(eq(kycVerifications.id, kycVerificationId));

      const accountsCreated = await provisionBrailsAccounts({
        brails,
        entity: { ...entity, legalName: computedLegalName },
        user: userRows[0],
        identity: identityData,
        bvn,
        nin,
      });
      await db.update(kycVerifications).set({
        status: 'approved',
        completedAt: new Date(),
      }).where(eq(kycVerifications.id, kycVerificationId));

      return reply.send({
        success: true,
        status: 'approved',
        legalName: computedLegalName,
        amlRisk,
        message: 'Identity verified and Brails accounts provisioned.',
        fiatAccounts: accountsCreated,
      });
    } catch (err: any) {
      console.error('[KYC Verify] Error during liveness verification:', err);
      return reply.status(500).send({
        error: 'We could not complete your verification. Please try again.',
        details: err.message,
      });
    }
  });

  /**
   * POST /api/kyc/easeid-liveness-callback
   * EaseID webhook callback when a liveness session completes (server-to-server).
   * This provides real-time completion notification without polling.
   */
  server.get('/api/kyc/easeid-liveness-callback', async (request, reply) => {
    const body = request.body as any;
    const query = request.query as { transactionId?: string; result?: string };
    const entityId = body?.metadata?.proxim_entity_id || body?.userId;

    if (!entityId) {
      return reply.status(200).send({ received: true });
    }

    console.log(`[EaseID Callback] Liveness session completed for entity: ${entityId}`, {
      status: query.result || body?.status,
      transactionId: query.transactionId || body?.transactionId,
    });

    return reply.status(200).send({ received: true });
  });

  /**
   * POST /api/kyc/submit-tier1
   * Legacy compat endpoint. Wraps the new EaseID flow for any existing clients.
   * Kept for backward compatibility with the existing App.tsx forms.
   */
  server.post('/api/kyc/submit-tier1', async (request, reply) => {
    return reply.status(410).send({
      error: 'This endpoint has been removed. Complete EaseID liveness verification before onboarding.',
    });
  });

  /**
   * POST /api/kyc/submit-tier2
  * Business KYB provisioning requires completed director identity and liveness.
   */
  server.post('/api/kyc/submit-tier2', async (request, reply) => {
    const body = request.body as any;
    if (!body?.entityId || !request.session?.userEntityIds.includes(body.entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    const entity = (await db.select().from(entities).where(and(eq(entities.id, body.entityId), eq(entities.userId, request.session!.userId))).limit(1))[0];
    if (!entity || entity.kind !== 'BUSINESS') return reply.status(400).send({ error: 'A business entity is required' });
    if (!body.verificationId || !body.kycVerificationId || !body.sessionToken) return reply.status(400).send({ error: 'Complete director identity lookup and liveness before KYB provisioning' });
    return reply.status(409).send({ error: 'Complete director liveness verification first, then retry business provisioning.' });
  });

  /**
   * POST /api/kyc/request-account
  * Provision one additional Brails currency account.
   */
  server.post('/api/kyc/request-account', async (request, reply) => {
    const { entityId, currency } = request.body as { entityId: string; currency: string };
    if (!entityId || !currency) return reply.status(400).send({ error: 'entityId and currency are required' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    try {
      const entity = (await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1))[0];
      const user = (await db.select().from(users).where(eq(users.id, request.session!.userId)).limit(1))[0];
      if (!entity || !user?.privyUserId || entity.dueStatus !== 'approved') return reply.status(409).send({ error: 'Approved Brails onboarding is required' });
      const verification = (await db.select().from(kycVerifications).where(eq(kycVerifications.entityId, entityId)).orderBy(kycVerifications.createdAt).limit(1))[0];
      const created = await provisionBrailsAccounts({ brails, entity, user, identity: (verification?.identityData || {}) as any, currencies: [currency] });
      return reply.send({ success: true, accounts: created });
    } catch (err: any) { return reply.status(502).send({ error: 'Brails account creation failed', details: err.message }); }
  });

  /**
   * POST /api/kyc/provision-virtual-accounts
  * Provision missing Brails currency accounts.
   */
  server.post('/api/kyc/provision-virtual-accounts', async (request, reply) => {
    const { entityId, currencies } = request.body as { entityId: string; currencies?: string[] };
    if (!entityId || !request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    try {
      const entity = (await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, request.session!.userId))).limit(1))[0];
      const user = (await db.select().from(users).where(eq(users.id, request.session!.userId)).limit(1))[0];
      if (!entity || !user?.privyUserId || entity.dueStatus !== 'approved') return reply.status(409).send({ error: 'Approved Brails onboarding is required' });
      const verification = (await db.select().from(kycVerifications).where(eq(kycVerifications.entityId, entityId)).orderBy(kycVerifications.createdAt).limit(1))[0];
      const created = await provisionBrailsAccounts({ brails, entity, user, identity: (verification?.identityData || {}) as any, currencies });
      return reply.send({ success: true, accounts: created });
    } catch (err: any) { return reply.status(502).send({ error: 'Brails account provisioning failed', details: err.message }); }
  });
}

// ─── Named export for kyc status helper ──────────────────────────────────────
export function assertEntityApproved(entity: { id: string; dueStatus: string }) {
  if (entity.dueStatus !== 'approved') {
    throw new Error(`Entity ${entity.id} is in status '${entity.dueStatus}'. Feature requires 'approved' verification status.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW KYC SCHEMA & VERIFICATION ENDPOINTS (Brails + Nuvion)
// ═══════════════════════════════════════════════════════════════════════════════
//
// These endpoints support dynamic KYC form rendering for:
// - Personal Accounts (Brails NGN): 7-field simple flow
// - Business Accounts (Nuvion): 20+ field comprehensive flow
//
// Architecture:
// 1. GET /api/kyc/schema?accountType=personal|business
//    → Returns provider-agnostic schema (sections, fields, validation rules)
// 2. POST /api/kyc/verify
//    → Accepts normalized form data, routes to correct provider
//    → Async: returns verificationId for polling
// 3. GET /api/kyc/verification-status?verificationId=...
//    → Poll status of KYC verification
//    → Returns account details when approved

export async function registerNewKycRoutes(server: FastifyInstance) {
  const { 
    getKycSchema, 
    getProviderForAccountType
  } = require('@payit/integrations');
  const { NuvionClient } = require('@payit/integrations');

  const brailsClient = new BrailsClient();
  const nuvionClient = new NuvionClient();

  /**
   * GET /api/kyc/schema?accountType=personal|business
   * Returns the complete KYC schema (sections, fields, validation) for the account type.
   * No hardcoded values — all driven from schema registry.
   */
  server.get<{ Querystring: { accountType: string } }>('/api/kyc/schema', async (request, reply) => {
    const { accountType } = request.query;
    
    if (!accountType || !['personal', 'business'].includes(accountType)) {
      return reply.status(400).send({
        error: 'accountType is required and must be personal or business',
      });
    }

    try {
      const schema = getKycSchema(accountType);
      return reply.send({
        success: true,
        accountType,
        provider: schema.provider,
        schema: {
          title: schema.title,
          description: schema.description,
          estimatedTimeMinutes: schema.estimatedTimeMinutes,
          currenciesSupported: schema.currenciesSupported,
          sections: schema.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            description: section.description,
            fields: section.fields.map((field: any) => ({
              name: field.name,
              type: field.type,
              label: field.label,
              required: field.required,
              placeholder: field.placeholder,
              pattern: field.pattern,
              help: field.help,
              options: field.options,
              maxLength: field.maxLength,
              accept: field.accept,
            })),
          })),
        },
      });
    } catch (err: any) {
      console.error('[KYC Schema] Error:', err.message);
      return reply.status(400).send({
        error: err.message,
      });
    }
  });

  /**
   * POST /api/kyc/verify
   * Submit normalized KYC form data for verification.
   */
  server.post<{ Body: any }>('/api/kyc/verify', async (request, reply) => {
    const body = request.body as { entityId?: string; accountType?: string; formData?: Record<string, any> };
    const { entityId, accountType, formData } = body;
    const userId = request.session!.userId;

    if (!entityId || !accountType || !formData) {
      return reply.status(400).send({
        error: 'entityId, accountType, and formData are required',
      });
    }

    if (!['personal', 'business'].includes(accountType)) {
      return reply.status(400).send({
        error: 'accountType must be personal or business',
      });
    }

    try {
      // Verify entity ownership
      const entity = await db.select().from(entities).where(
        and(eq(entities.id, entityId), eq(entities.userId, userId))
      ).limit(1);

      if (!entity || entity.length === 0) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const verificationId = ulid();
      const provider = getProviderForAccountType(accountType);

      // Store normalized form data
      const verification = await db.insert(kycVerifications).values({
        id: verificationId,
        userId,
        entityId,
        entityKind: (accountType === 'personal' ? 'PERSONAL' : 'BUSINESS'),
        idType: accountType,
        idValueHash: ulid(),
        status: 'pending',
        identityData: formData,
      }).returning();

      if (!verification || verification.length === 0) {
        return reply.status(500).send({ error: 'Failed to create verification record' });
      }

      // Route to appropriate provider (async, non-blocking)
      if (provider === 'brails') {
        queueBrailsVerification(verificationId, entityId, userId, formData).catch(err => 
          console.error(`[KYC] Brails queue error: ${err.message}`)
        );
      } else if (provider === 'nuvion') {
        queueNuvionVerification(verificationId, entityId, userId, formData).catch(err =>
          console.error(`[KYC] Nuvion queue error: ${err.message}`)
        );
      }

      return reply.status(202).send({
        success: true,
        verificationId,
        status: 'pending',
        message: 'Your KYC verification has been submitted. You will be notified when it is complete.',
      });
    } catch (err: any) {
      console.error('[KYC Verify] Error:', err.message);
      return reply.status(500).send({
        error: 'Failed to submit KYC verification',
        details: err.message,
      });
    }
  });

  /**
   * GET /api/kyc/verification-status?verificationId=...
   * Poll the status of a KYC verification.
   */
  server.get<{ Querystring: { verificationId: string } }>('/api/kyc/verification-status', async (request, reply) => {
    const { verificationId } = request.query;
    const userId = request.session!.userId;

    if (!verificationId) {
      return reply.status(400).send({ error: 'verificationId is required' });
    }

    try {
      const verification = await db.select().from(kycVerifications).where(
        and(eq(kycVerifications.id, verificationId), eq(kycVerifications.userId, userId))
      ).limit(1);

      if (!verification || verification.length === 0) {
        return reply.status(404).send({ error: 'Verification not found' });
      }

      const v = verification[0];
      let response: any = {
        verificationId: v.id,
        status: v.status,
        entityId: v.entityId,
        entityKind: v.entityKind,
      };

      if (v.status === 'approved') {
        response.message = 'Verification approved! Your account is ready.';
        
        const accts = await db.select().from(accounts).where(
          eq(accounts.entityId, v.entityId)
        ).limit(1);
        
        if (accts && accts.length > 0) {
          const acc = accts[0];
          response.virtualAccount = {
            accountNumber: acc.accountNumber,
            routingNumber: acc.routingNumber,
            bankName: acc.bankName,
            currency: acc.currency,
          };
        }
      } else if (v.status === 'pending') {
        response.message = 'Your KYC verification is being processed...';
      } else if (v.status === 'rejected') {
        response.message = `Verification rejected: ${v.failureReason || 'Please contact support'}`;
      }

      return reply.send({
        success: v.status !== 'rejected',
        ...response,
      });
    } catch (err: any) {
      console.error('[KYC Status] Error:', err.message);
      return reply.status(500).send({
        error: 'Failed to fetch verification status',
      });
    }
  });

  // ─── Helper Functions ─────────────────────────────────────────────────────

  async function queueBrailsVerification(
    verificationId: string,
    entityId: string,
    userId: string,
    formData: Record<string, any>
  ) {
    try {
      const firstName = formData.firstName || '';
      const lastName = formData.lastName || '';
      const email = formData.email || '';
      const phoneNumber = formData.phoneNumber || '';
      const bvn = formData.bvn || '';
      const bank = formData.bank || 'providus';

      if (!firstName || !lastName || !email || !phoneNumber || !bvn) {
        throw new Error('Missing required Brails personal fields');
      }

      const brailsResponse = await brailsClient.createVirtualAccount({
        firstName,
        lastName,
        email,
        phoneNumber,
        bvn,
        bank: bank as 'providus' | 'safehaven',
        reference: `kyc_${verificationId}`,
      } as any);

      const customerId = brailsResponse?.customerId || brailsResponse?.customer_id;
      const accountId = brailsResponse?.account?.id || brailsResponse?.id;
      const accountNumber = brailsResponse?.account?.accountNumber || brailsResponse?.accountNumber;

      await db.update(kycVerifications).set({
        brailsCustomerId: customerId,
        brailsCustomerPayload: formData,
        brailsAccountIds: [accountId],
        status: 'approved',
        completedAt: new Date(),
      }).where(eq(kycVerifications.id, verificationId));

      if (accountNumber) {
        await db.insert(accounts).values({
          id: `brails_${verificationId}`,
          entityId,
          dueVirtualAccountId: accountId,
          accountNumber,
          routingNumber: brailsResponse?.routingNumber,
          bankName: 'Brails',
          accountHolderName: `${firstName} ${lastName}`,
          currency: 'NGN',
          rail: 'bank_transfer',
          status: 'active',
        }).onConflictDoNothing();
      }

      await db.update(entities).set({
        dueStatus: 'approved',
        dueCustomerId: customerId,
      }).where(eq(entities.id, entityId));

      console.log(`[KYC] Brails verification approved for ${verificationId}`);
    } catch (err: any) {
      console.error(`[KYC] Brails verification failed for ${verificationId}:`, err.message);
      
      await db.update(kycVerifications).set({
        status: 'rejected',
        failureReason: err.message,
      }).where(eq(kycVerifications.id, verificationId));
    }
  }

  async function queueNuvionVerification(
    verificationId: string,
    entityId: string,
    userId: string,
    formData: Record<string, any>
  ) {
    try {
      const personData = {
        first_name: formData.firstName || '',
        last_name: formData.lastName || '',
        date_of_birth: formData.dateOfBirth || '',
        email: formData.email || '',
        nationality: formData.nationality || 'NG',
        gender: formData.gender || 'm',
        phonenumber: formData.phonenumber || '',
      };

      const addressData = {
        line_1: formData['address.line_1'] || '',
        line_2: formData['address.line_2'],
        city: formData['address.city'] || '',
        state: formData['address.state'] || '',
        postal_code: formData['address.postal_code'] || '',
        country_code: formData['address.country_code'] || 'NG',
      };

      const identificationData = {
        document: {
          type: formData['identification.document.type'] || 'international_passport',
          number: formData['identification.document.number'] || '',
          issuing_country: formData['identification.document.issuing_country'] || 'NG',
          issuing_authority: formData['identification.document.issuing_authority'] || '',
        },
      };

      if (!personData.first_name || !personData.last_name || !addressData.line_1) {
        throw new Error('Missing required Nuvion business fields');
      }

      const nuvionResponse = await nuvionClient.createEntity({
        name: formData['business.legal_name'] || '',
        person: personData,
        address: addressData,
        identification: identificationData,
        meta: {
          verificationId,
          reference: `kyc_${verificationId}`,
        },
      });

      const status = nuvionResponse?.status || 'pending';

      await db.update(kycVerifications).set({
        identityData: formData,
        status: status === 'approved' ? 'approved' : 'pending',
        completedAt: status === 'approved' ? new Date() : null,
      }).where(eq(kycVerifications.id, verificationId));

      console.log(`[KYC] Nuvion verification queued for ${verificationId}, status: ${status}`);
    } catch (err: any) {
      console.error(`[KYC] Nuvion verification failed for ${verificationId}:`, err.message);
      
      await db.update(kycVerifications).set({
        status: 'rejected',
        failureReason: err.message,
      }).where(eq(kycVerifications.id, verificationId));
    }
  }
}
