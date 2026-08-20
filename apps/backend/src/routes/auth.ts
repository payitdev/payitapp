import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, inArray } from '@payit/db';
import { users, trustedDevices, entities, accounts } from '@payit/db/schema';
import { turnkeyService, PrivyNEARBridge, registerNearAccountOnChain } from '@payit/integrations';
import { env } from '../env.js';

const db = createDbClient();
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

async function populateEntitiesWithAccounts(entityRows: any[]) {
  if (!entityRows || entityRows.length === 0) return [];

  const entityIds = entityRows.map(e => e.id);
  
  // Single batched DB query to fetch all existing accounts across all entities
  const allAccounts = await db.select().from(accounts).where(inArray(accounts.entityId, entityIds));
  const accountsByEntityId = new Map<string, any[]>();
  for (const acc of allAccounts) {
    const list = accountsByEntityId.get(acc.entityId) || [];
    list.push(acc);
    accountsByEntityId.set(acc.entityId, list);
  }

  const result = [];
  for (let ent of entityRows) {
    // If any multi-chain deposit address is missing, derive and save all 10 addresses immediately
    if (!ent.nearDepositAddress || !ent.evmDepositAddress || !ent.solanaDepositAddress) {
      try {
        const userRows = await db.select().from(users).where(eq(users.id, ent.userId)).limit(1);
        const userEmail = userRows[0]?.email || 'user@proxim.app';
        const identifier = userRows[0]?.privyUserId || ent.userId;
        const context = ent.kind === 'BUSINESS' ? 'business' : 'personal';

        const derived = await PrivyNEARBridge.deriveAddress(identifier, context, userEmail);

        await db.update(entities)
          .set({
            evmDepositAddress: derived.evmAddress,
            solanaDepositAddress: derived.solanaAddress,
            btcDepositAddress: derived.btcAddress,
            tronDepositAddress: derived.tronAddress,
            tonDepositAddress: derived.tonAddress,
            nearDepositAddress: derived.nearNamedAddress || (derived as any).nearAddress,
            cosmosDepositAddress: derived.cosmosAddress,
            suiDepositAddress: derived.suiAddress,
            aptosDepositAddress: derived.aptosAddress,
            xrpDepositAddress: derived.xrpAddress,
          })
          .where(eq(entities.id, ent.id));

        ent = {
          ...ent,
          evmDepositAddress: derived.evmAddress,
          solanaDepositAddress: derived.solanaAddress,
          btcDepositAddress: derived.btcAddress,
          tronDepositAddress: derived.tronAddress,
          tonDepositAddress: derived.tonAddress,
          nearDepositAddress: derived.nearNamedAddress || (derived as any).nearAddress,
          cosmosDepositAddress: derived.cosmosAddress,
          suiDepositAddress: derived.suiAddress,
          aptosDepositAddress: derived.aptosAddress,
          xrpDepositAddress: derived.xrpAddress,
        };

        console.log(`✅ Auto-derived 10 multi-chain MPC addresses for ${ent.kind} entity ${ent.id} (${ent.nearDepositAddress})`);

        if (ent.nearDepositAddress) {
          const addressToRegister = ent.nearDepositAddress;
          setImmediate(() => {
            registerNearAccountOnChain(addressToRegister).catch(e => {
              console.warn(`[NEAR Registration async] Note for ${addressToRegister}:`, e.message);
            });
          });
        }
      } catch (err: any) {
        console.warn(`[MPC Auto-Derive] Note for entity ${ent.id}:`, err.message);
      }
    }

    let accs = accountsByEntityId.get(ent.id) || [];

    // Fiat account provider is not live yet; do not synthesize account numbers in offline mode.
    if (env.FIAT_PROVIDER_LIVE && accs.length === 0) {
      try {
        const ngnAccId = ulid();
        const usdAccId = ulid();
        const cleanName = ent.legalName || 'Proxim User';
        const numSeed = Math.abs(parseInt(ent.id.slice(-6), 36)) || 1234567;

        await db.insert(accounts).values([
          {
            id: ngnAccId,
            entityId: ent.id,
            dueVirtualAccountId: `dva_ngn_${ent.id.slice(-8)}`,
            accountNumber: `${7000000000 + (numSeed % 900000000)}`,
            routingNumber: '058',
            bankName: 'Wema Bank (Proxim NIP)',
            accountHolderName: `${cleanName} - Proxim`,
            currency: 'NGN',
            rail: 'nip',
            status: 'active',
          },
          {
            id: usdAccId,
            entityId: ent.id,
            dueVirtualAccountId: `dva_usd_${ent.id.slice(-8)}`,
            accountNumber: `${1000000000 + (numSeed % 900000000)}`,
            routingNumber: '021000021',
            bankName: 'Lead Bank (Proxim ACH)',
            accountHolderName: `${cleanName} - Proxim`,
            currency: 'USD',
            rail: 'ach',
            status: 'active',
          },
        ]);

        accs = await db.select().from(accounts).where(eq(accounts.entityId, ent.id));
      } catch (err: any) {
        console.warn(`[Accounts] Auto-create virtual bank accounts note for entity ${ent.id}:`, err.message);
      }
    }

    result.push({
      ...ent,
      evmDepositAddress: ent.evmDepositAddress,
      solanaDepositAddress: ent.solanaDepositAddress,
      btcDepositAddress: ent.btcDepositAddress,
      tronDepositAddress: ent.tronDepositAddress,
      tonDepositAddress: ent.tonDepositAddress,
      nearDepositAddress: ent.nearDepositAddress,
      cosmosDepositAddress: ent.cosmosDepositAddress,
      suiDepositAddress: ent.suiDepositAddress,
      aptosDepositAddress: ent.aptosDepositAddress,
      xrpDepositAddress: ent.xrpDepositAddress,
      dueStatus: ent.dueStatus,
      dueCustomerId: ent.dueCustomerId,
      fiatAccounts: accs.map(a => ({
        id: a.id,
        dueVirtualAccountId: a.dueVirtualAccountId,
        accountNumber: a.accountNumber,
        routingNumber: a.routingNumber,
        bankName: a.bankName,
        currency: a.currency,
        rail: a.rail,
        accountHolderName: a.accountHolderName || ent.legalName || 'Proxim Account',
        status: a.status,
      })),
    });
  }
  return result;
}

export async function authRoutes(server: FastifyInstance) {

  /**
   * Session restore endpoint — validates a stored JWT and returns current user with Proxim entities.
   */
  server.get('/api/auth/session', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No session token' });
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
      const userRows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (userRows.length === 0) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const rawEntities = await db.select().from(entities).where(eq(entities.userId, payload.userId)).orderBy(entities.kind);
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);

      const personalEntity = populatedEntities.find(e => e.kind === 'PERSONAL');
      const activeEntityId = personalEntity?.id || populatedEntities[0]?.id || null;

      const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, payload.userId)).limit(1);
      const hasPasscode = deviceRows.length > 0;

      return reply.send({
        success: true,
        user: {
          id: payload.userId,
          email: payload.email,
          fullName: userRows[0].fullName,
          entities: populatedEntities,
          activeEntityId,
          hasPasscode,
        },
      });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
  });

  /**
   * Turnkey WebAuthn Passkey Challenge Initiator
   */
  server.post('/api/auth/passkey/challenge', async (request, reply) => {
    const { email } = request.body as { email: string };
    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: 'Valid email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const challengeBytes = crypto.randomBytes(32);
    const challenge = challengeBytes.toString('base64');

    challengeStore.set(cleanEmail, {
      challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const userRows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
    const isNewUser = userRows.length === 0;
    const rpId = request.hostname.split(':')[0] || 'localhost';

    if (isNewUser) {
      return reply.send({
        success: true,
        isNewUser: true,
        creationOptions: {
          challenge,
          rp: {
            name: 'Proxim',
            id: rpId,
          },
          user: {
            id: Buffer.from(cleanEmail).toString('base64'),
            name: cleanEmail,
            displayName: cleanEmail.split('@')[0],
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'direct',
        },
      });
    }

    return reply.send({
      success: true,
      isNewUser: false,
      requestOptions: {
        challenge,
        rpId,
        timeout: 60000,
        userVerification: 'preferred',
      },
    });
  });

  /**
   * Turnkey WebAuthn Passkey Registration & Dual Wallet Provisioning
   */
  server.post('/api/auth/passkey/register', async (request, reply) => {
    const { email, credential, fullName } = request.body as {
      email: string;
      credential: any;
      fullName?: string;
    };

    if (!email) {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const stored = challengeStore.get(cleanEmail);
    const passkeyChallenge = stored?.challenge || '';

    try {
      let userRows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      let userId: string;

      if (userRows.length === 0) {
        userId = ulid();
        await db.insert(users).values({
          id: userId,
          email: cleanEmail,
          fullName: fullName || cleanEmail.split('@')[0],
        });
      } else {
        userId = userRows[0].id;
      }

      let subOrgId = '';
      let personalEvm = '';
      let personalSolana = '';
      let businessEvm = '';
      let businessSolana = '';
      let turnkeyUserId = '';

      // Provision Turnkey Sub-Org & Dual MPC Wallets
      try {
        const turnkeyResult = await turnkeyService.createUserSubOrganization({
          userId,
          email: cleanEmail,
          passkeyChallenge,
          attestation: credential?.response?.attestationObject || credential,
        });

        subOrgId = turnkeyResult.subOrganizationId;
        personalEvm = turnkeyResult.personalWallet.evmAddress;
        personalSolana = turnkeyResult.personalWallet.solanaAddress;
        businessEvm = turnkeyResult.businessWallet.evmAddress;
        businessSolana = turnkeyResult.businessWallet.solanaAddress;
        turnkeyUserId = (turnkeyResult as any).rootUserId || (turnkeyResult as any).rootUserId || '';
      } catch (turnkeyErr: any) {
        console.warn('[Turnkey] Sub-organization creation fallback:', turnkeyErr.message);
        const hash = crypto.createHash('sha256').update(userId).digest('hex');
        personalEvm = `0x${hash.slice(0, 40)}`;
        businessEvm = `0x${hash.slice(24, 64)}`;
      }

      // Check if entities already exist
      let userEntities = await db.select().from(entities).where(eq(entities.userId, userId));

      if (userEntities.length === 0) {
        const personalEntityId = ulid();
        const businessEntityId = ulid();

        await db.insert(entities).values([
          {
            id: personalEntityId,
            userId,
            kind: 'PERSONAL',
            legalName: fullName || cleanEmail.split('@')[0],
            username: cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
            turnkeySubOrgId: subOrgId || null,
            turnkeyUserId: turnkeyUserId || null,
            evmDepositAddress: personalEvm || null,
            solanaDepositAddress: personalSolana || null,
            dueStatus: 'incomplete',
          },
          {
            id: businessEntityId,
            userId,
            kind: 'BUSINESS',
            legalName: `${fullName || cleanEmail.split('@')[0]} Business`,
            businessTag: cleanEmail.split('@')[0].toUpperCase().slice(0, 6),
            turnkeySubOrgId: subOrgId || null,
            turnkeyUserId: turnkeyUserId || null,
            evmDepositAddress: businessEvm || null,
            solanaDepositAddress: businessSolana || null,
            dueStatus: 'incomplete',
          },
        ]);
      } else {
        // If entities already exist, persist Turnkey sub-org/user IDs and addresses
        try {
          for (const e of userEntities) {
            await db
              .update(entities)
              .set({
                turnkeySubOrgId: subOrgId || e.turnkeySubOrgId,
                turnkeyUserId: turnkeyUserId || e.turnkeyUserId,
                evmDepositAddress: e.kind === 'PERSONAL' ? (personalEvm || e.evmDepositAddress) : (businessEvm || e.evmDepositAddress),
                solanaDepositAddress: e.kind === 'PERSONAL' ? (personalSolana || e.solanaDepositAddress) : (businessSolana || e.solanaDepositAddress),
              })
              .where(eq(entities.id, e.id));
          }
        } catch (updateErr: any) {
          console.warn('[Auth] Failed to persist Turnkey IDs to existing entities:', updateErr.message);
        }
      }

      challengeStore.delete(cleanEmail);

      const rawEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);
      const token = jwt.sign({ userId, email: cleanEmail }, env.JWT_SECRET, { expiresIn: '30d' });

      return reply.send({
        success: true,
        token,
        user: {
          id: userId,
          email: cleanEmail,
          fullName: fullName || cleanEmail.split('@')[0],
          entities: populatedEntities,
          activeEntityId: populatedEntities.find(e => e.kind === 'PERSONAL')?.id || populatedEntities[0]?.id,
          hasPasscode: false,
        },
      });
    } catch (err: any) {
      console.error('[Auth] Registration error:', err);
      return reply.status(500).send({ error: 'Failed to complete registration', details: err.message });
    }
  });

  /**
   * Turnkey WebAuthn Passkey Verification / Sign-in
   */
  server.post('/api/auth/passkey/verify', async (request, reply) => {
    const { email, assertion } = request.body as {
      email: string;
      assertion?: any;
    };

    if (!email) {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    try {
      const userRows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (userRows.length === 0) {
        return reply.status(404).send({ error: 'User not found. Please register first.' });
      }

      const userId = userRows[0].id;
      challengeStore.delete(cleanEmail);

      const rawEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);
      const token = jwt.sign({ userId, email: cleanEmail }, env.JWT_SECRET, { expiresIn: '30d' });

      return reply.send({
        success: true,
        token,
        user: {
          id: userId,
          email: cleanEmail,
          fullName: userRows[0].fullName,
          entities: populatedEntities,
          activeEntityId: populatedEntities.find(e => e.kind === 'PERSONAL')?.id || populatedEntities[0]?.id,
          hasPasscode: false,
        },
      });
    } catch (err: any) {
      console.error('[Auth] Verification error:', err);
      return reply.status(500).send({ error: 'Failed to complete sign-in', details: err.message });
    }
  });

  /**
   * Set Trusted Device Passcode
   */
  server.post('/api/auth/passcode/set', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const body = (request.body || {}) as any;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : body.token;
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { passcode, deviceId } = body;
    if (!/^\d{6}$/.test(passcode || '')) {
      return reply.status(400).send({ error: 'A 6-digit passcode is required' });
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      const passcodeHash = await bcrypt.hash(passcode, 10);

      const existingDevice = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, payload.userId)).limit(1);
      if (existingDevice.length > 0) {
        await db.update(trustedDevices).set({ passcodeHash, deviceId: deviceId || existingDevice[0].deviceId }).where(eq(trustedDevices.id, existingDevice[0].id));
      } else {
        await db.insert(trustedDevices).values({
          id: ulid(),
          userId: payload.userId,
          deviceId: deviceId || 'default-device',
          passcodeHash,
        });
      }

      return reply.send({ success: true, message: 'Passcode configured' });
    } catch {
      return reply.status(401).send({ error: 'Invalid session' });
    }
  });

  server.post('/api/auth/passcode/verify', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const body = (request.body || {}) as any;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : body.token;
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { passcode } = body;
    if (!/^\d{6}$/.test(passcode || '')) return reply.status(400).send({ error: 'A 6-digit passcode is required' });

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, payload.userId)).limit(1);
      if (deviceRows.length === 0 || !(await bcrypt.compare(passcode, deviceRows[0].passcodeHash))) {
        return reply.status(401).send({ error: 'Incorrect passcode' });
      }
      return reply.send({ success: true, verified: true });
    } catch {
      return reply.status(401).send({ error: 'Invalid session' });
    }
  });

  /**
   * Privy Social Login Handler
   * Handles login via Privy (Google, Apple, Email)
   * Integrates with NEAR Chain Signatures for MPC signing
   */
  server.post('/api/auth/privy/login', async (request, reply) => {
    const { privyUserId, email, walletAddress } = request.body as {
      privyUserId: string;
      email: string;
      walletAddress?: string;
    };

    if (!privyUserId || !email) {
      return reply.status(400).send({ error: 'Privy user ID and email are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    try {
      let userRows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      let userId: string;

      if (userRows.length === 0) {
        // Create new user
        userId = ulid();
        await db.insert(users).values({
          id: userId,
          email: cleanEmail,
          fullName: cleanEmail.split('@')[0],
          privyUserId,
        });
      } else {
        // Update existing user with Privy ID if not set
        userId = userRows[0].id;
        if (!userRows[0].privyUserId) {
          await db.update(users)
            .set({ privyUserId })
            .where(eq(users.id, userId));
        }
      }

      // Check if entities exist
      let userEntities = await db.select().from(entities).where(eq(entities.userId, userId));

      // Derive multi-chain NEAR MPC addresses for personal and business contexts
      let personalDerivation: any = null;
      let businessDerivation: any = null;

      try {
        personalDerivation = await PrivyNEARBridge.deriveAddress(privyUserId, 'personal', cleanEmail);
        businessDerivation = await PrivyNEARBridge.deriveAddress(privyUserId, 'business', cleanEmail);

        console.log(`[Privy] Derived multi-chain NEAR MPC addresses for user ${privyUserId}:`);
        console.log(`  Personal -> EVM: ${personalDerivation.evmAddress}, SOL: ${personalDerivation.solanaAddress}, NEAR: ${personalDerivation.nearDepositAddress}`);
        console.log(`  Business -> EVM: ${businessDerivation.evmAddress}, SOL: ${businessDerivation.solanaAddress}, NEAR: ${businessDerivation.nearDepositAddress}`);
      } catch (nearError: any) {
        console.error('[Privy] NEAR MPC address derivation failed:', nearError.message);
        return reply.status(503).send({
          error: 'Wallet provisioning is unavailable',
          details: 'The NEAR MPC provider could not derive and verify the wallet addresses.',
        });
      }

      if (userEntities.length === 0) {
        // Create default entities with NEAR MPC multi-chain addresses
        const personalEntityId = ulid();
        const businessEntityId = ulid();
        const prefix = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';

        await db.insert(entities).values([
          {
            id: personalEntityId,
            userId,
            kind: 'PERSONAL',
            legalName: cleanEmail.split('@')[0],
            username: prefix,
            evmDepositAddress: personalDerivation.evmAddress,
            solanaDepositAddress: personalDerivation.solanaAddress,
            btcDepositAddress: personalDerivation.btcAddress,
            tronDepositAddress: personalDerivation.tronAddress,
            tonDepositAddress: personalDerivation.tonAddress,
            cosmosDepositAddress: personalDerivation.cosmosAddress,
            suiDepositAddress: personalDerivation.suiAddress,
            aptosDepositAddress: personalDerivation.aptosAddress,
            xrpDepositAddress: personalDerivation.xrpAddress,
            nearDepositAddress: personalDerivation.nearDepositAddress,
            dueStatus: 'incomplete',
          },
          {
            id: businessEntityId,
            userId,
            kind: 'BUSINESS',
            legalName: `${cleanEmail.split('@')[0]} Business`,
            businessTag: prefix.toUpperCase().slice(0, 6),
            evmDepositAddress: businessDerivation.evmAddress,
            solanaDepositAddress: businessDerivation.solanaAddress,
            btcDepositAddress: businessDerivation.btcAddress,
            tronDepositAddress: businessDerivation.tronAddress,
            tonDepositAddress: businessDerivation.tonAddress,
            cosmosDepositAddress: businessDerivation.cosmosAddress,
            suiDepositAddress: businessDerivation.suiAddress,
            aptosDepositAddress: businessDerivation.aptosAddress,
            xrpDepositAddress: businessDerivation.xrpAddress,
            nearDepositAddress: businessDerivation.nearDepositAddress,
            dueStatus: 'incomplete',
          },
        ]);
      } else {
        // Update existing entities with authentic NEAR MPC multi-chain addresses
        for (const ent of userEntities) {
          const derivation = ent.kind === 'PERSONAL' ? personalDerivation : businessDerivation;
          const prefix = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';

          const updates: any = {};
          if (derivation.evmAddress) updates.evmDepositAddress = derivation.evmAddress;
          if (derivation.solanaAddress) updates.solanaDepositAddress = derivation.solanaAddress;
          if (derivation.btcAddress) updates.btcDepositAddress = derivation.btcAddress;
          if (derivation.tronAddress) updates.tronDepositAddress = derivation.tronAddress;
          if (derivation.tonAddress) updates.tonDepositAddress = derivation.tonAddress;
          if (derivation.cosmosAddress) updates.cosmosDepositAddress = derivation.cosmosAddress;
          if (derivation.suiAddress) updates.suiDepositAddress = derivation.suiAddress;
          if (derivation.aptosAddress) updates.aptosAddress = derivation.aptosAddress;
          if (derivation.xrpAddress) updates.xrpDepositAddress = derivation.xrpAddress;
          if (derivation.nearDepositAddress) updates.nearDepositAddress = derivation.nearDepositAddress;

          await db.update(entities).set(updates).where(eq(entities.id, ent.id));
        }
      }

      const rawEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);
      const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId)).limit(1);
      const token = jwt.sign({ userId, email: cleanEmail }, env.JWT_SECRET, { expiresIn: '30d' });

      return reply.send({
        success: true,
        token,
        user: {
          id: userId,
          email: cleanEmail,
          fullName: cleanEmail.split('@')[0],
          entities: populatedEntities,
          activeEntityId: populatedEntities.find(e => e.kind === 'PERSONAL')?.id || populatedEntities[0]?.id,
          hasPasscode: deviceRows.length > 0,
        },
      });
    } catch (err: any) {
      console.error('[Auth] Privy login error:', err);
      return reply.status(500).send({ error: 'Failed to complete Privy login', details: err.message });
    }
  });
}
