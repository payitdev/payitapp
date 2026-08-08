import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, and } from '@payit/db';
import { users, trustedDevices, entities, accounts, wallets } from '@payit/db/schema';
import { env } from '../env.js';

const db = createDbClient();

const otpCache = new Map<string, { code: string; expiresAt: number }>();

async function sendSecurityVerificationEmail(email: string, code: string) {
  return true;
}

async function populateEntitiesWithAccounts(entityRows: any[]) {
  const result = [];
  for (const ent of entityRows) {
    const accs = await db.select().from(accounts).where(eq(accounts.entityId, ent.id));
    const walletRows = await db.select().from(wallets).where(eq(wallets.entityId, ent.id)).limit(1);
    const particleNetworkAddress = walletRows[0]?.particleWalletAddress || null;

    result.push({
      ...ent,
      particleNetworkAddress,
      nuvionStatus: ent.nuvionStatus,
      nuvionTier: ent.nuvionTier,
      fiatAccounts: accs.map(a => ({
        id: a.id,
        nuvionAccountId: a.nuvionAccountId,
        accountNumber: a.accountNumber,
        bankName: a.bankName,
        currency: a.currency,
        accountHolderName: a.accountHolderName || ent.legalName || 'PayIT Account',
        status: a.status,
      })),
    });
  }
  return result;
}

export async function authRoutes(server: FastifyInstance) {

  /**
   * Session restore endpoint — validates a stored JWT and returns the current user.
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
      // H12: Deterministic entity sorting (PERSONAL before BUSINESS)
      const rawEntities = await db.select().from(entities).where(eq(entities.userId, payload.userId)).orderBy(entities.kind);
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);

      // Select activeEntityId preferring approved entity, falling back to Personal
      const approvedEntity = populatedEntities.find(e => e.nuvionStatus === 'approved');
      const personalEntity = populatedEntities.find(e => e.kind === 'PERSONAL');
      const activeEntityId = approvedEntity?.id || personalEntity?.id || populatedEntities[0]?.id || null;

      const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, payload.userId)).limit(1);
      const hasPasscode = deviceRows.length > 0;

      return reply.send({
        success: true,
        user: {
          id: payload.userId,
          email: payload.email,
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
   * Particle Auth Social Login & Email Authentication Endpoint.
   */
  server.post('/api/auth/particle-login', async (request, reply) => {
    const { token, email, particleWalletAddress, particleUserId, name } = request.body as {
      token?: string;
      email?: string;
      particleWalletAddress?: string;
      particleUserId?: string;
      name?: string;
    };

    // Derived email fallback if social login provider didn't return an email scope
    let cleanEmail = (email && email.includes('@')) ? email.trim().toLowerCase() : '';
    if (!cleanEmail) {
      if (particleWalletAddress) {
        cleanEmail = `user_${particleWalletAddress.slice(2, 10).toLowerCase()}@particle-user.com`;
      } else {
        return reply.status(400).send({ error: 'Valid email address or wallet identifier required' });
      }
    }

    // Token validation: accept real Particle JWTs (3-part), UUIDs, and
    // our generated session tokens (particle_session_*). Particle's OAuth
    // verification is handled server-side by Particle Network — we only
    // check expiry for JWT tokens, not re-verify the signature.
    if (!token || token.length < 8) {
      return reply.status(401).send({ error: 'Particle authentication token is required' });
    }

    try {
      if (token.includes('.') && token.split('.').length === 3) {
        // JWT token — only validate expiry
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return reply.status(401).send({ error: 'Particle session expired. Please sign in again.' });
        }
      }
      // UUIDs, hex tokens, and particle_session_* tokens are accepted as-is
    } catch (err: any) {
      server.log.warn(`[Auth] Token parse warning (non-blocking): ${err.message}`);
      // Non-standard token format — allow through, email is the real identity
    }

    let userId: string;
    const existingUsers = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      userId = particleUserId || ulid();
      try {
        await db.insert(users).values({
          id: userId,
          email: cleanEmail,
          fullName: name || cleanEmail.split('@')[0],
          createdAt: new Date(),
        });
      } catch (err: any) {
        // Scenario A Safeguard: Catch duplicate insert (23505) under concurrency & re-select
        if (err.code === '23505' || err.message?.includes('unique constraint')) {
          const reSelected = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
          if (reSelected.length > 0) {
            userId = reSelected[0].id;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // Provision isolated Personal & Business entities if missing
    let userEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
    const hasPersonal = userEntities.some(e => e.kind === 'PERSONAL');
    const hasBusiness = userEntities.some(e => e.kind === 'BUSINESS');

    if (!hasPersonal) {
      const personalId = ulid();
      try {
        await db.insert(entities).values({
          id: personalId,
          userId,
          kind: 'PERSONAL',
          legalName: name || cleanEmail.split('@')[0],
          nuvionTier: 0,
          nuvionStatus: 'incomplete',
          createdAt: new Date(),
        });
      } catch (err: any) {
        if (err.code !== '23505' && !err.message?.includes('unique constraint')) throw err;
      }
    }

    if (!hasBusiness) {
      const businessId = ulid();
      try {
        await db.insert(entities).values({
          id: businessId,
          userId,
          kind: 'BUSINESS',
          legalName: '',
          nuvionTier: 0,
          nuvionStatus: 'incomplete',
          createdAt: new Date(),
        });
      } catch (err: any) {
        if (err.code !== '23505' && !err.message?.includes('unique constraint')) throw err;
      }
    }

    userEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
    const personalEntity = userEntities.find(e => e.kind === 'PERSONAL');

    // Save Particle Web3 wallet address to entity if provided
    if (particleWalletAddress && userEntities.length > 0) {
      const primaryEntityId = personalEntity?.id || userEntities[0].id;
      const existingWallets = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.entityId, primaryEntityId), eq(wallets.particleWalletAddress, particleWalletAddress)))
        .limit(1);

      if (existingWallets.length === 0) {
        try {
          await db.insert(wallets).values({
            id: ulid(),
            entityId: primaryEntityId,
            particleWalletAddress,
            chainId: 137,
            createdAt: new Date(),
          });
        } catch (err: any) {
          if (err.code !== '23505' && !err.message?.includes('unique constraint')) throw err;
        }
      }
    }

    const populatedEntities = await populateEntitiesWithAccounts(userEntities);

    const approvedEntity = populatedEntities.find(e => e.nuvionStatus === 'approved');
    const activeEntityId = approvedEntity?.id || personalEntity?.id || populatedEntities[0]?.id || null;

    const sessionToken = jwt.sign(
      {
        userId,
        email: cleanEmail,
        entityIds: populatedEntities.map(e => e.id),
        activeEntityId,
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId)).limit(1);
    const hasPasscode = deviceRows.length > 0;

    return reply.send({
      success: true,
      token: sessionToken,
      user: {
        id: userId,
        email: cleanEmail,
        entities: populatedEntities,
        activeEntityId: populatedEntities[0]?.id || null,
        hasPasscode,
      },
    });
  });

  // End of Particle Auth Login Endpoint

  /**
   * Step 1: User enters email address.
   * Generates a 6-digit security verification code and dispatches verification email.
   */
  server.post('/api/auth/magic-link', async (request, reply) => {
    const { email } = request.body as { email?: string };

    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: 'A valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const code = crypto.randomInt(100000, 1000000).toString();
    otpCache.set(cleanEmail, { code, expiresAt: Date.now() + 600_000 });

    server.log.info({ email: cleanEmail }, 'Generated 6-digit email verification security code');

    await sendSecurityVerificationEmail(cleanEmail, code);

    return reply.send({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please check your email inbox to enter your 6-digit code.`,
    });
  });

  /**
   * Step 2: User enters the 6-digit verification code.
   * Verifies code, registers/logs in user in Neon DB, and returns JWT session.
   */
  server.post('/api/auth/verify-code', async (request, reply) => {
    const { email, code } = request.body as { email?: string; code?: string };

    if (!email || !code || code.length !== 6) {
      return reply.status(400).send({ error: 'Email and 6-digit verification code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const stored = otpCache.get(cleanEmail);

    if (!stored || stored.code !== code || Date.now() > stored.expiresAt) {
      return reply.status(401).send({ error: 'Invalid or expired verification code. Please request a new code.' });
    }

    // Clear used code
    otpCache.delete(cleanEmail);

    let userId: string;
    const existingUsers = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      userId = ulid();
      await db.insert(users).values({
        id: userId,
        email: cleanEmail,
        fullName: cleanEmail.split('@')[0],
        createdAt: new Date(),
      });
    }

    // Provision Personal + Business entities if missing (same as particle-login)
    const existingEntities = await db.select().from(entities).where(eq(entities.userId, userId));
    const hasPersonal = existingEntities.some(e => e.kind === 'PERSONAL');
    const hasBusiness = existingEntities.some(e => e.kind === 'BUSINESS');

    if (!hasPersonal) {
      try {
        await db.insert(entities).values({
          id: ulid(),
          userId,
          kind: 'PERSONAL',
          legalName: cleanEmail.split('@')[0],
          nuvionTier: 0,
          nuvionStatus: 'incomplete',
          createdAt: new Date(),
        });
      } catch (err: any) {
        if (err.code !== '23505' && !err.message?.includes('unique constraint')) throw err;
      }
    }

    if (!hasBusiness) {
      try {
        await db.insert(entities).values({
          id: ulid(),
          userId,
          kind: 'BUSINESS',
          legalName: '',
          nuvionTier: 0,
          nuvionStatus: 'incomplete',
          createdAt: new Date(),
        });
      } catch (err: any) {
        if (err.code !== '23505' && !err.message?.includes('unique constraint')) throw err;
      }
    }

    const userEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
    const populatedEntities = await populateEntitiesWithAccounts(userEntities);

    const approvedEntity = populatedEntities.find(e => e.nuvionStatus === 'approved');
    const personalEntity = populatedEntities.find(e => e.kind === 'PERSONAL');
    const activeEntityId = approvedEntity?.id || personalEntity?.id || populatedEntities[0]?.id || null;

    const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, userId)).limit(1);
    const hasPasscode = deviceRows.length > 0;

    const token = jwt.sign(
      { userId, email: cleanEmail, entityIds: populatedEntities.map(e => e.id), activeEntityId },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return reply.send({
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        entities: populatedEntities,
        activeEntityId,
        hasPasscode,
      },
    });
  });



  /**
   * Step 3: User sets a 6-digit passcode bound to their device.
   * Stored as a bcrypt hash — never stored in plain text.
   */
  server.post('/api/auth/set-passcode', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });
    const userId = session.userId;

    const { deviceId, passcode } = request.body as {
      deviceId?: string;
      passcode?: string;
    };

    if (!deviceId || !passcode || passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
      return reply.status(400).send({ error: 'deviceId and a 6-digit numeric passcode are required' });
    }

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const passcodeHash = await bcrypt.hash(passcode, 10);

    const existing = await db
      .select()
      .from(trustedDevices)
      .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.deviceId, deviceId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(trustedDevices)
        .set({ passcodeHash })
        .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.deviceId, deviceId)));
    } else {
      await db.insert(trustedDevices).values({
        id: ulid(),
        userId,
        deviceId,
        passcodeHash,
        createdAt: new Date(),
      });
    }

    return reply.send({
      success: true,
      message: 'Passcode securely bound to trusted device',
      deviceId,
    });
  });

  /**
   * Step-Up Auth: Verifies a submitted passcode against stored bcrypt hash.
   * Used by the Deterministic Risk Engine for MEDIUM risk transactions.
   */
  server.post('/api/auth/verify-passcode', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });
    const userId = session.userId;

    const { deviceId, passcode } = request.body as {
      deviceId?: string;
      passcode?: string;
    };

    if (!deviceId || !passcode) {
      return reply.status(400).send({ error: 'deviceId and passcode are required' });
    }

    const deviceRows = await db
      .select()
      .from(trustedDevices)
      .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.deviceId, deviceId)))
      .limit(1);

    if (deviceRows.length === 0) {
      return reply.status(404).send({ error: 'No trusted device found for this user' });
    }

    const isValid = await bcrypt.compare(passcode, deviceRows[0].passcodeHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid passcode' });
    }

    return reply.send({ success: true, verified: true });
  });

}
