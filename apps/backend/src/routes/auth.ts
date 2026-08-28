import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ulid } from 'ulid';
import { createDbClient, eq, inArray } from '@payit/db';
import { users, trustedDevices, entities, accounts } from '@payit/db/schema';
import { PrivyNEARBridge, PrivyServerAuth, registerNearAccountOnChain } from '@payit/integrations';
import { env } from '../env.js';

const db = createDbClient();
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
      fiatAccounts: accs.map(a => ({
        id: a.id,
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
   */
  server.post('/api/auth/privy/login', async (request, reply) => {
    const { privyUserId, walletAddress } = request.body as {
      privyUserId: string;
      walletAddress?: string;
    };

    if (!privyUserId) {
      return reply.status(400).send({ error: 'Privy user ID is required' });
    }

    const bearer = request.headers.authorization;
    if (!bearer?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'A verified Privy bearer token is required' });
    }
    const verifiedPrivy = await PrivyServerAuth.getVerifiedIdentity(bearer.slice(7));
    if (!verifiedPrivy.valid || verifiedPrivy.privyUserId !== privyUserId) {
      console.warn('[Privy Login] Token verification failed:', {
        reason: verifiedPrivy.error || 'Privy user ID mismatch',
        tokenUserId: verifiedPrivy.privyUserId,
        requestUserId: privyUserId,
      });
      return reply.status(401).send({
        error: 'Privy identity verification failed',
        details: verifiedPrivy.error || 'The Privy token user does not match the signed-in user.',
      });
    }

    const cleanEmail = verifiedPrivy.email!;

    try {
      let userRows = await db.select().from(users).where(eq(users.privyUserId, privyUserId)).limit(1);
      if (userRows.length === 0) userRows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
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
        if (userRows[0].privyUserId && userRows[0].privyUserId !== privyUserId) {
          return reply.status(409).send({ error: 'This email is already linked to a different Privy account' });
        }
        if (!userRows[0].privyUserId) {
          await db.update(users)
            .set({ privyUserId })
            .where(eq(users.id, userId));
        }
      }

      // Check if entities exist
      let userEntities = await db.select().from(entities).where(eq(entities.userId, userId));

      if (userEntities.length === 0) {
        // Create default entities
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
            evmDepositAddress: walletAddress || null,
            dueStatus: 'incomplete',
          },
          {
            id: businessEntityId,
            userId,
            kind: 'BUSINESS',
            legalName: `${cleanEmail.split('@')[0]} Business`,
            businessTag: prefix.toUpperCase().slice(0, 6),
            dueStatus: 'incomplete',
          },
        ]);
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
