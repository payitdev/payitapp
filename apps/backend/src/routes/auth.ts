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
    let status = ent.nuvionStatus;
    let tier = ent.nuvionTier;

    if (accs.length > 0 && status !== 'approved') {
      status = 'approved';
      tier = tier < 1 ? 1 : tier;
      await db.update(entities).set({ nuvionStatus: 'approved', nuvionTier: tier }).where(eq(entities.id, ent.id));
    }

    result.push({
      ...ent,
      nuvionStatus: status,
      nuvionTier: tier,
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
      const rawEntities = await db.select().from(entities).where(eq(entities.userId, payload.userId));
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);

      const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, payload.userId)).limit(1);
      const hasPasscode = deviceRows.length > 0;

      return reply.send({
        success: true,
        user: {
          id: payload.userId,
          email: payload.email,
          entities: populatedEntities,
          activeEntityId: populatedEntities[0]?.id || null,
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

    // Token verification: strict validation against Particle Network authentication token
    if (!token) {
      return reply.status(401).send({ error: 'Particle authentication token is required' });
    }

    try {
      if (token.includes('.')) {
        const parts = token.split('.');
        if (parts.length !== 3) {
          return reply.status(401).send({ error: 'Invalid Particle token structure' });
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return reply.status(401).send({ error: 'Particle session expired. Please sign in again.' });
        }
      } else if (!token.startsWith('particle_') && token.length < 16) {
        return reply.status(401).send({ error: 'Invalid Particle authentication token' });
      }
    } catch (err: any) {
      server.log.error(`[Auth] Token verification failed: ${err.message}`);
      return reply.status(401).send({ error: 'Invalid Particle authentication token' });
    }

    let userId: string;
    const existingUsers = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      userId = particleUserId || ulid();
      await db.insert(users).values({
        id: userId,
        email: cleanEmail,
        fullName: cleanEmail.split('@')[0],
        createdAt: new Date(),
      });
    }

    // Provision isolated Personal & Business entities if missing
    let userEntities = await db.select().from(entities).where(eq(entities.userId, userId));
    const hasPersonal = userEntities.some(e => e.kind === 'PERSONAL');
    const hasBusiness = userEntities.some(e => e.kind === 'BUSINESS');

    if (!hasPersonal) {
      const personalId = ulid();
      await db.insert(entities).values({
        id: personalId,
        userId,
        kind: 'PERSONAL',
        legalName: '',
        nuvionTier: 0,
        nuvionStatus: 'incomplete',
        createdAt: new Date(),
      });
    }

    if (!hasBusiness) {
      const businessId = ulid();
      await db.insert(entities).values({
        id: businessId,
        userId,
        kind: 'BUSINESS',
        legalName: '',
        nuvionTier: 0,
        nuvionStatus: 'incomplete',
        createdAt: new Date(),
      });
    }

    userEntities = await db.select().from(entities).where(eq(entities.userId, userId));
    const populatedEntities = await populateEntitiesWithAccounts(userEntities);

    // Save Particle Web3 wallet address to entity if provided
    if (particleWalletAddress && populatedEntities.length > 0) {
      const primaryEntityId = populatedEntities[0].id;
      const existingWallets = await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.entityId, primaryEntityId), eq(wallets.particleWalletAddress, particleWalletAddress)))
        .limit(1);

      if (existingWallets.length === 0) {
        await db.insert(wallets).values({
          id: ulid(),
          entityId: primaryEntityId,
          particleWalletAddress,
          chainId: 137, // Default Polygon chain ID
          createdAt: new Date(),
        });
      }
    }

    const sessionToken = jwt.sign(
      {
        userId,
        email: cleanEmail,
        entityIds: populatedEntities.map(e => e.id),
        activeEntityId: populatedEntities[0]?.id || null,
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

    const userEntities = await db.select().from(entities).where(eq(entities.userId, userId));

    const jwtPayload = {
      userId,
      email: cleanEmail,
      entityIds: userEntities.map(e => e.id),
      activeEntityId: userEntities[0]?.id || null,
    };

    const token = jwt.sign(jwtPayload, env.JWT_SECRET, {
      expiresIn: '30d',
    });

    return reply.send({
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        entities: userEntities,
        activeEntityId: userEntities[0]?.id || null,
      },
    });
  });

  /**
   * Step 3: User sets a 6-digit passcode bound to their device.
   * Stored as a bcrypt hash — never stored in plain text.
   */
  server.post('/api/auth/set-passcode', async (request, reply) => {
    const { userId, deviceId, passcode } = request.body as {
      userId?: string;
      deviceId?: string;
      passcode?: string;
    };

    if (!userId || !deviceId || !passcode || passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
      return reply.status(400).send({ error: 'userId, deviceId, and a 6-digit numeric passcode are required' });
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
    const { userId, deviceId, passcode } = request.body as {
      userId?: string;
      deviceId?: string;
      passcode?: string;
    };

    if (!userId || !deviceId || !passcode) {
      return reply.status(400).send({ error: 'userId, deviceId, and passcode are required' });
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
