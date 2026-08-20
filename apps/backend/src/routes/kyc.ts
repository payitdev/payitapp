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
import { easeIdClient, BrailsClient, PrivyNEARBridge, registerNearAccountOnChain } from '@payit/integrations';
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

/**
 * Provision Brails virtual accounts for an entity and persist to DB.
 * All accounts are tagged with the entity's EVM deposit address so the
 * off-ramp settlement engine knows exactly which on-chain wallet to credit.
 */
async function provisionBrailsAccounts(
  brails: BrailsClient,
  entityId: string,
  brailsCustomerId: string,
  legalName: string,
  email: string,
  bvn: string | undefined,
  nin: string | undefined,
  evmAddress: string,
  currencies: string[],
  isBusinessAccount: boolean,
  businessLegalName?: string,
  rcNumber?: string,
  identityDetails?: {
    dateOfBirth?: string;
    phoneNumber?: string;
    gender?: 'male' | 'female' | 'other';
    nationality?: string;
    address?: {
      streetLine1?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
    businessInformation?: Record<string, any>;
  },
  auditId?: string,
): Promise<Array<Record<string, any>>> {
  const created: Array<Record<string, any>> = [];
  const accountPayloads: Array<Record<string, any>> = [];

  for (const currency of currencies) {
    // Check if account already exists for this currency
    const existing = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.entityId, entityId), eq(accounts.currency, currency)))
      .limit(1);

    if (existing.length > 0) {
      created.push(existing[0]);
      continue;
    }

    try {
      const vaPayload: any = {
        customerId: brailsCustomerId,
        currency: currency as any,
        type: isBusinessAccount ? 'BUSINESS' : 'INDIVIDUAL',
        firstName: isBusinessAccount ? undefined : legalName.split(' ')[0],
        lastName: isBusinessAccount ? undefined : legalName.split(' ').slice(1).join(' ') || legalName.split(' ')[0],
        bvn: isBusinessAccount ? undefined : bvn,
        nin: isBusinessAccount ? undefined : nin,
        customerEmail: email,
        phoneNumber: identityDetails?.phoneNumber,
        dateOfBirth: identityDetails?.dateOfBirth,
        businessLegalName: isBusinessAccount ? businessLegalName : undefined,
        rcNumber: isBusinessAccount ? rcNumber : undefined,
        businessInformation: isBusinessAccount ? identityDetails?.businessInformation : undefined,
        // On-chain binding: narrates the EVM address in the account reference
        // so the settlement engine can identify this user's exact wallet
        reference: `proxim_${entityId}_${evmAddress.slice(0, 10)}_${currency}`,
        personalInformation: isBusinessAccount
          ? undefined
          : {
              gender: identityDetails?.gender || 'other',
              primaryNationality: identityDetails?.nationality || 'NG',
              address: identityDetails?.address,
            },
      };

      if (auditId) {
        await db.update(kycVerifications).set({
          brailsAccountPayloads: [...accountPayloads, vaPayload],
        }).where(eq(kycVerifications.id, auditId));
      }

      const va = await brails.createVirtualAccount(vaPayload);

      const bankNameMap: Record<string, string> = {
        NGN: va.bank_name || 'Providus Bank',
        USD: va.bank_name || 'Evolve Bank & Trust',
        EUR: va.bank_name || 'Banking Circle S.A.',
        GBP: va.bank_name || 'ClearBank',
        KES: va.bank_name || 'NCBA Bank Kenya',
        UGX: va.bank_name || 'Stanbic Bank Uganda',
        GHS: va.bank_name || 'Ecobank Ghana',
      };

      const railMap: Record<string, string> = {
        NGN: 'nip',
        USD: 'ach',
        EUR: 'sepa',
        GBP: 'fps',
        KES: 'pesalink',
        UGX: 'unpss',
        GHS: 'ghipss',
      };

      const newAcc = {
        id: ulid(),
        entityId,
        dueVirtualAccountId: va.id || va.account_id || ulid(),
        accountNumber: va.account_number || va.iban || va.accountNumber || '',
        routingNumber: va.routing_number || va.sort_code || va.bic || null,
        bankName: bankNameMap[currency] || 'Partner Bank',
        accountHolderName: isBusinessAccount ? businessLegalName! : legalName,
        currency,
        rail: va.rail || railMap[currency] || 'bank_transfer',
        status: 'active',
      };

      await db.insert(accounts).values(newAcc);
      accountPayloads.push(vaPayload);
      created.push(newAcc);
    } catch (vaErr: any) {
      console.error(`[Brails VA] Failed to create ${currency} account for entity ${entityId}:`, vaErr.message);
    }
  }

  return created;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function kycRoutes(server: FastifyInstance) {
  const brails = new BrailsClient();

  /**
   * GET /api/kyc/status
   * Returns current KYC/KYB status and all fiat accounts for an entity.
   * Also auto-backfills any missing wallet addresses.
   */
  server.get('/api/kyc/status', async (request, reply) => {
    const { entityId, userId } = request.query as { entityId: string; userId: string };
    if (!entityId || !userId) {
      return reply.status(400).send({ error: 'entityId and userId are required' });
    }

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    let entity = entityRows[0];

    // Auto-backfill missing wallet addresses (derived from NEAR chain signatures)
    if (
      !entity.nearDepositAddress ||
      !entity.evmDepositAddress ||
      entity.nearDepositAddress.includes('undefined')
    ) {
      try {
        const uRows = await db.select().from(users).where(eq(users.id, entity.userId)).limit(1);
        if (uRows.length > 0) {
          const u = uRows[0];
          const identifier = u.privyUserId || `user-${u.id}`;
          const context = entity.kind.toLowerCase() as 'personal' | 'business';
          const derivation = await PrivyNEARBridge.deriveAddress(identifier, context, u.email || undefined);

          const updates: any = {
            evmDepositAddress: derivation.evmAddress,
            solanaDepositAddress: derivation.solanaAddress,
            btcDepositAddress: derivation.btcAddress,
            tronDepositAddress: derivation.tronAddress,
            tonDepositAddress: derivation.tonAddress,
            cosmosDepositAddress: derivation.cosmosAddress,
            suiDepositAddress: derivation.suiAddress,
            aptosDepositAddress: derivation.aptosAddress,
            xrpDepositAddress: derivation.xrpAddress,
            nearDepositAddress: derivation.nearDepositAddress,
          };

          await db.update(entities).set(updates).where(eq(entities.id, entity.id));
          entity = { ...entity, ...updates };

          if (derivation.nearDepositAddress) {
            registerNearAccountOnChain(derivation.nearDepositAddress).catch(() => {});
          }
        }
      } catch (err: any) {
        console.warn(`[KYC Status] Address auto-backfill note for entity ${entity.id}:`, err.message);
      }
    }

    const fiatAccounts = await getEntityAccounts(entity.id);

    return reply.send({
      entityId: entity.id,
      entityKind: entity.kind,
      kind: entity.kind,
      legalName: entity.legalName,
      username: entity.username,
      usernameCustomized: entity.usernameCustomized,
      // kycStatus mirrors the old dueStatus field name for frontend compatibility
      kycStatus: entity.dueStatus,
      dueStatus: entity.dueStatus,
      // Tier: 0 = unverified, 1 = personal KYC passed, 2 = business KYB passed
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

    // Get EVM address for on-chain binding
    let evmAddress = entity.evmDepositAddress;
    if (!evmAddress) {
      const uRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (uRows.length > 0) {
        const u = uRows[0];
        const identifier = u.privyUserId || `user-${u.id}`;
        const context = entity.kind.toLowerCase() as 'personal' | 'business';
        try {
          const derivation = await PrivyNEARBridge.deriveAddress(identifier, context, u.email || undefined);
          evmAddress = derivation.evmAddress;
          await db
            .update(entities)
            .set({ evmDepositAddress: evmAddress })
            .where(eq(entities.id, entityId));
        } catch (err: any) {
          console.warn('[KYC Lookup] Could not derive wallet address:', err.message);
        }
      }
    }

    try {
      const identity = await easeIdClient.lookupIdentity(
        type,
        value,
        entityId,
        evmAddress || '0x0000000000000000000000000000000000000000',
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
   *   - Create Brails customer + virtual accounts (tied to on-chain address)
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
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const email = userRows[0]?.email || `${entityId}@proxim.finance`;
    const evmAddress = entity.evmDepositAddress || '0x0000000000000000000000000000000000000000';

    try {
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

      // 2. AML screening (non-blocking: allow through with LOW/MEDIUM risk; flag HIGH/CRITICAL for manual review)
      let amlRisk = 'LOW';
      try {
        const aml = await easeIdClient.screenAML(fullName, dateOfBirth || '', 'NG');
        amlRisk = aml.riskLevel;
        await db.update(kycVerifications).set({
          amlStatus: 'completed',
          amlRiskLevel: aml.riskLevel,
          amlFlagged: aml.flagged ? 1 : 0,
          status: aml.flagged && (aml.riskLevel === 'HIGH' || aml.riskLevel === 'CRITICAL') ? 'under_review' : 'aml_cleared',
        }).where(eq(kycVerifications.id, kycVerificationId));
        if (aml.flagged && (aml.riskLevel === 'HIGH' || aml.riskLevel === 'CRITICAL')) {
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
        console.warn('[EaseID AML] Screening failed (non-fatal):', amlErr.message);
      }

      // 3. Create Brails customer (idempotent — skip if already exists)
      let brailsCustomerId = entity.dueCustomerId;

      if (!brailsCustomerId) {
        const customerPayload: any = {
          firstName: firstName || fullName.split(' ')[0],
          lastName: lastName || fullName.split(' ').slice(1).join(' ') || fullName.split(' ')[0],
          email,
          phoneNumber: phone,
          dob: dateOfBirth || undefined,
          bvn: bvn || undefined,
          nin: nin || undefined,
        };

        await db.update(kycVerifications).set({ brailsCustomerPayload: customerPayload }).where(eq(kycVerifications.id, kycVerificationId));
        const brailsCustomer = await brails.createCustomer(customerPayload);
        brailsCustomerId = brailsCustomer?.id || brailsCustomer?.customer_id || ulid();
      }

      // 4. Update entity status → approved and store Brails customer ID
      const computedLegalName = fullName || entity.legalName;
      await db
        .update(entities)
        .set({
          dueCustomerId: brailsCustomerId,
          dueStatus: 'approved',
          legalName: computedLegalName,
        })
        .where(eq(entities.id, entityId));

      // 5. Provision NGN (primary) + USD virtual accounts on Brails
      //    Both are tagged with the entity's EVM address for settlement binding
      const newAccounts = await provisionBrailsAccounts(
        brails,
        entityId,
        brailsCustomerId!,
        computedLegalName,
        email,
        bvn,
        nin,
        evmAddress,
        ['NGN', 'USD'],
        false, // personal account
        undefined,
        undefined,
        { dateOfBirth, phoneNumber: phone, gender: 'other', nationality: 'NG' },
        kycVerificationId,
      );

      await db.update(kycVerifications).set({
        status: 'approved',
        brailsCustomerId,
        brailsAccountIds: newAccounts.map((account) => account.dueVirtualAccountId),
        completedAt: new Date(),
      }).where(eq(kycVerifications.id, kycVerificationId));

      return reply.send({
        success: true,
        status: 'approved',
        legalName: computedLegalName,
        brailsCustomerId,
        fiatAccounts: newAccounts,
        amlRisk,
        message: 'Identity verified. Your account is ready.',
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
  server.post('/api/kyc/easeid-liveness-callback', async (request, reply) => {
    const body = request.body as any;
    const entityId = body?.metadata?.proxim_entity_id;

    if (!entityId) {
      return reply.status(200).send({ received: true });
    }

    console.log(`[EaseID Callback] Liveness session completed for entity: ${entityId}`, {
      status: body?.status,
      verification_id: body?.verification_id,
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

    const {
      userId,
      entityId,
      firstName,
      middleName,
      surname,
      legalName,
      phone,
      bvn,
      nin,
      dob,
    } = request.body as any;

    if (!userId || !entityId) {
      return reply.status(400).send({ error: 'userId and entityId are required' });
    }

    if (!bvn && !nin) {
      return reply.status(400).send({ error: 'Either BVN or NIN is required for identity verification.' });
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
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const email = userRows[0]?.email || `${entityId}@proxim.finance`;
    const computedLegalName = legalName || `${firstName || ''} ${middleName ? middleName + ' ' : ''}${surname || ''}`.trim() || entity.legalName;
    const evmAddress = entity.evmDepositAddress || '0x0000000000000000000000000000000000000000';

    try {
      // Run EaseID identity lookup
      const idType: 'nin' | 'bvn' = nin ? 'nin' : 'bvn';
      const idValue = nin || bvn;

      const identity = await easeIdClient.lookupIdentity(idType, idValue, entityId, evmAddress);
      const resolvedName = identity.fullName || computedLegalName;

      // Run AML screening
      try {
        const aml = await easeIdClient.screenAML(resolvedName, dob || identity.dateOfBirth || '', 'NG');
        if (aml.flagged && (aml.riskLevel === 'HIGH' || aml.riskLevel === 'CRITICAL')) {
          await db.update(entities).set({ dueStatus: 'pending', legalName: resolvedName }).where(eq(entities.id, entityId));
          return reply.status(202).send({
            success: false,
            status: 'under_review',
            message: 'Your account is under review. We will be in touch shortly.',
          });
        }
      } catch (amlErr: any) {
        console.warn('[KYC Tier1] AML non-fatal:', amlErr.message);
      }

      // Create Brails customer + accounts
      let brailsCustomerId = entity.dueCustomerId;
      if (!brailsCustomerId) {
        const bc = await brails.createCustomer({
          firstName: identity.firstName || firstName || resolvedName.split(' ')[0],
          lastName: identity.lastName || surname || resolvedName.split(' ').slice(1).join(' ') || resolvedName.split(' ')[0],
          email,
          phoneNumber: phone || identity.phoneNumber,
          bvn: bvn || undefined,
          nin: nin || undefined,
        });
        brailsCustomerId = bc?.id || bc?.customer_id || ulid();
      }

      await db.update(entities).set({
        dueCustomerId: brailsCustomerId,
        dueStatus: 'approved',
        legalName: resolvedName,
      }).where(eq(entities.id, entityId));

      const fiatAccounts = await provisionBrailsAccounts(
        brails, entityId, brailsCustomerId!, resolvedName, email,
        bvn, nin, evmAddress, ['NGN', 'USD'], false,
      );

      return reply.send({
        success: true,
        status: 'approved',
        tier: 1,
        legalName: resolvedName,
        brailsCustomerId,
        fiatAccounts,
        message: 'Identity verified.',
      });
    } catch (err: any) {
      console.error('[KYC Tier1] Error:', err);
      return reply.status(500).send({ error: 'Identity verification failed. Please try again.', details: err.message });
    }
  });

  /**
   * POST /api/kyc/submit-tier2
   * Business KYB: Director EaseID verification + CAC business details → Brails business account.
   */
  server.post('/api/kyc/submit-tier2', async (request, reply) => {
    const {
      userId,
      entityId,
      businessLegalName,
      businessTag,
      rcNumber,
      tin,
      businessAddress,
      city,
      state,
      postalCode,
      // Director (UBO) details — required
      uboLegalName,
      uboBvn,
      uboNin,
      industryCategory,
    } = request.body as any;

    if (!userId || !entityId) {
      return reply.status(400).send({ error: 'userId and entityId are required' });
    }

    if (!businessLegalName || !rcNumber) {
      return reply.status(400).send({ error: 'businessLegalName and rcNumber are required for business verification.' });
    }

    if (!uboBvn && !uboNin) {
      return reply.status(400).send({ error: 'Director BVN or NIN is required to anchor the business account.' });
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
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const email = userRows[0]?.email || `${entityId}@proxim.finance`;
    const evmAddress = entity.evmDepositAddress || '0x0000000000000000000000000000000000000000';

    try {
      // Step 1: Verify director identity via EaseID
      const directorIdType: 'nin' | 'bvn' = uboNin ? 'nin' : 'bvn';
      const directorIdValue = uboNin || uboBvn;

      const directorIdentity = await easeIdClient.lookupIdentity(
        directorIdType,
        directorIdValue,
        entityId,
        evmAddress,
      );

      const kycVerificationId = ulid();
      await db.insert(kycVerifications).values({
        id: kycVerificationId,
        userId,
        entityId,
        entityKind: entity.kind,
        idType: directorIdType,
        idValueHash: hashIdentityValue(directorIdValue),
        status: 'identity_verified',
        identityVerificationId: directorIdentity.verificationId,
        identityData: {
          fullName: directorIdentity.fullName,
          firstName: directorIdentity.firstName,
          lastName: directorIdentity.lastName,
          dateOfBirth: directorIdentity.dateOfBirth,
          gender: directorIdentity.gender,
          phoneNumber: directorIdentity.phoneNumber,
          hasPhoto: Boolean(directorIdentity.photoBase64),
        },
      });

      // Step 2: CAC business registration lookup
      let cacVerified = false;
      let cacRegisteredName = businessLegalName;
      try {
        const cacResult = await easeIdClient.verifyCACRegistration(rcNumber, businessLegalName);
        cacVerified = cacResult.verified;
        cacRegisteredName = cacResult.registeredName || businessLegalName;
      } catch (cacErr: any) {
        console.warn('[KYB] CAC lookup non-fatal:', cacErr.message);
        // Allow submission to proceed — Brails will do secondary verification
      }

      // Step 3: AML screening on director
      try {
        const aml = await easeIdClient.screenAML(directorIdentity.fullName, directorIdentity.dateOfBirth || '', 'NG');
        await db.update(kycVerifications).set({
          amlStatus: 'completed',
          amlRiskLevel: aml.riskLevel,
          amlFlagged: aml.flagged ? 1 : 0,
          status: aml.flagged && (aml.riskLevel === 'HIGH' || aml.riskLevel === 'CRITICAL') ? 'under_review' : 'aml_cleared',
        }).where(eq(kycVerifications.id, kycVerificationId));
        if (aml.flagged && (aml.riskLevel === 'HIGH' || aml.riskLevel === 'CRITICAL')) {
          await db.update(entities).set({ dueStatus: 'pending' }).where(eq(entities.id, entityId));
          return reply.status(202).send({
            success: false,
            status: 'under_review',
            message: 'Business account is under review. We will notify you within 1–2 business days.',
          });
        }
      } catch (amlErr: any) {
        console.warn('[KYB] AML screening non-fatal:', amlErr.message);
      }

      // Step 4: Create Brails business customer + virtual accounts
      let brailsCustomerId = entity.dueCustomerId;

      const businessAddressPayload = {
        streetLine1: businessAddress || undefined,
        city: city || undefined,
        state: state || undefined,
        country: 'NG',
        postalCode: postalCode || undefined,
      };
      const customerPayload = {
          firstName: directorIdentity.firstName,
          lastName: directorIdentity.lastName,
          email,
          phoneNumber: directorIdentity.phoneNumber,
          dob: directorIdentity.dateOfBirth || undefined,
          bvn: uboBvn || undefined,
          nin: uboNin || undefined,
          address: businessAddressPayload,
      };

      await db.update(kycVerifications).set({ brailsCustomerPayload: customerPayload }).where(eq(kycVerifications.id, kycVerificationId));

      if (!brailsCustomerId) {
        const bc = await brails.createCustomer(customerPayload);
        brailsCustomerId = bc?.id || bc?.customer_id || ulid();
      }

      await db.update(entities).set({
        dueCustomerId: brailsCustomerId,
        dueStatus: 'approved',
        legalName: cacRegisteredName,
        businessTag: businessTag || entity.businessTag,
      }).where(eq(entities.id, entityId));

      const fiatAccounts = await provisionBrailsAccounts(
        brails,
        entityId,
        brailsCustomerId!,
        cacRegisteredName,
        email,
        undefined,
        undefined,
        evmAddress,
        ['NGN', 'USD', 'GBP'],
        true, // business account
        cacRegisteredName,
        rcNumber,
        {
          dateOfBirth: directorIdentity.dateOfBirth,
          phoneNumber: directorIdentity.phoneNumber,
          gender: 'other',
          nationality: 'NG',
          address: businessAddressPayload,
          businessInformation: {
            description: businessTag || cacRegisteredName,
            registrationNumber: rcNumber,
            email,
            type: 'corporate',
            industry: industryCategory || undefined,
            address: businessAddressPayload,
            taxInformation: tin ? { taxId: tin, taxIdType: 'TIN', taxCountry: 'NG' } : undefined,
          },
        },
        kycVerificationId,
      );

      await db.update(kycVerifications).set({
        status: 'approved',
        brailsCustomerId,
        brailsAccountIds: fiatAccounts.map((account) => account.dueVirtualAccountId),
        completedAt: new Date(),
      }).where(eq(kycVerifications.id, kycVerificationId));

      return reply.send({
        success: true,
        status: 'approved',
        tier: 2,
        businessLegalName: cacRegisteredName,
        directorVerified: true,
        directorName: directorIdentity.fullName,
        cacVerified,
        brailsCustomerId,
        fiatAccounts,
        message: 'Business account verified and ready.',
      });
    } catch (err: any) {
      console.error('[KYB Tier2] Error:', err);
      return reply.status(500).send({
        error: 'Business verification failed. Please check your details and try again.',
        details: err.message,
      });
    }
  });

  /**
   * POST /api/kyc/request-account
   * Add an additional currency account (EUR, GBP, KES, UGX, GHS) to an approved entity.
   * Requires entity to already be KYC approved.
   */
  server.post('/api/kyc/request-account', async (request, reply) => {
    const { userId, entityId, currency } = request.body as {
      userId: string;
      entityId: string;
      currency: string;
    };

    if (!entityId || !currency) {
      return reply.status(400).send({ error: 'entityId and currency are required' });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];

    if (entity.dueStatus !== 'approved') {
      return reply.status(403).send({
        error: 'Identity verification required before adding new currency accounts.',
      });
    }

    if (!entity.dueCustomerId) {
      return reply.status(400).send({ error: 'Brails customer record not found.' });
    }

    const userRows = await db.select().from(users).where(eq(users.id, entity.userId)).limit(1);
    const email = userRows[0]?.email || `${entityId}@proxim.finance`;
    const evmAddress = entity.evmDepositAddress || '0x0000000000000000000000000000000000000000';

    try {
      const newAccounts = await provisionBrailsAccounts(
        brails,
        entityId,
        entity.dueCustomerId,
        entity.legalName,
        email,
        undefined,
        undefined,
        evmAddress,
        [currency.toUpperCase()],
        entity.kind === 'BUSINESS',
      );

      return reply.send({ success: true, accounts: newAccounts });
    } catch (err: any) {
      console.error(`[Brails] Error issuing ${currency} account:`, err);
      return reply.status(500).send({ error: `We could not add a ${currency} account. Please try again.`, details: err.message });
    }
  });

  /**
   * POST /api/kyc/provision-virtual-accounts
   * Bulk provision virtual accounts for an already-approved entity.
   * Used by the auto-provisioning scheduler.
   */
  server.post('/api/kyc/provision-virtual-accounts', async (request, reply) => {
    const { entityId, userId, currencies } = request.body as {
      entityId: string;
      userId: string;
      currencies?: string[];
    };

    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const entity = entityRows[0];
    const userRows = await db.select().from(users).where(eq(users.id, entity.userId)).limit(1);
    const email = userRows[0]?.email || `${entityId}@proxim.finance`;
    const evmAddress = entity.evmDepositAddress || '0x0';
    const targetCurrencies = currencies || ['NGN', 'USD'];

    if (!entity.dueCustomerId) {
      return reply.status(400).send({ error: 'No Brails customer found for this entity. Complete KYC first.' });
    }

    try {
      const createdAccounts = await provisionBrailsAccounts(
        brails,
        entityId,
        entity.dueCustomerId,
        entity.legalName,
        email,
        undefined,
        undefined,
        evmAddress,
        targetCurrencies,
        entity.kind === 'BUSINESS',
      );

      return reply.send({ success: true, accounts: createdAccounts });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Account provisioning failed.', details: err.message });
    }
  });
}

// ─── Named export for kyc status helper ──────────────────────────────────────
export function assertEntityApproved(entity: { id: string; dueStatus: string }) {
  if (entity.dueStatus !== 'approved') {
    throw new Error(`Entity ${entity.id} is in status '${entity.dueStatus}'. Feature requires 'approved' verification status.`);
  }
}
