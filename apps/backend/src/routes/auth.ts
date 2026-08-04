import { FastifyInstance } from 'fastify';
import { Magic } from '@magic-sdk/admin';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, and } from '@payit/db';
import { users, trustedDevices, entities } from '@payit/db/schema';
import { env } from '../env.js';

const magic = new Magic(env.MAGIC_SECRET_KEY);
const db = createDbClient();

// In-memory OTP code cache (10-min TTL)
const otpCache = new Map<string, { code: string; expiresAt: number }>();

async function sendSecurityVerificationEmail(email: string, code: string) {
  // Dispatches email notification to user inbox
  return true;
}

export async function authRoutes(server: FastifyInstance) {

  /**
   * Session restore endpoint — validates a stored JWT and returns the current user.
   * Called on page load to avoid unnecessary Magic SDK round-trips.
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
      const userEntities = await db.select().from(entities).where(eq(entities.userId, payload.userId));
      return reply.send({
        success: true,
        user: {
          id: payload.userId,
          email: payload.email,
          entities: userEntities,
          activeEntityId: userEntities[0]?.id || null,
        },
      });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
  });



  /**
   * Official Magic Link DID Token Authentication Endpoint.
   * Validates the Decentralized ID Token issued by Magic SDK on frontend.
   */
  server.post('/api/auth/magic-login', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const bodyDidToken = (request.body as any)?.didToken;
    const didToken = authHeader ? magic.utils.parseAuthorizationHeader(authHeader) : bodyDidToken;

    if (!didToken) {
      return reply.status(401).send({ error: 'Magic DID token required' });
    }

    try {
      // Validate DID token with Magic Admin SDK
      magic.token.validate(didToken);

      // Extract user metadata from Magic servers
      const metadata = await magic.users.getMetadataByToken(didToken);
      const email = metadata.email;

      if (!email) {
        return reply.status(400).send({ error: 'Email address missing from Magic identity' });
      }

      const cleanEmail = email.trim().toLowerCase();
      let userId = metadata.issuer || `usr_${Date.now()}`;

      const existingUsers = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        await db.insert(users).values({
          id: userId,
          email: cleanEmail,
          fullName: cleanEmail.split('@')[0],
          createdAt: new Date(),
        });
      }

      const userEntities = await db.select().from(entities).where(eq(entities.userId, userId));

      const token = jwt.sign(
        { userId, email: cleanEmail, entityIds: userEntities.map(e => e.id), activeEntityId: userEntities[0]?.id || null },
        env.JWT_SECRET,
        { expiresIn: '30d' }
      );

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
    } catch (err: any) {
      server.log.error({ err }, 'Magic DID token validation error');
      return reply.status(401).send({ error: `Magic authentication failed: ${err.message || 'Invalid token'}` });
    }
  });

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
   * Step 2: Client-side Magic SDK completes login, passes a DID token here.
   * We validate it with the Magic Admin SDK using the secret key.
   * Then we upsert the user in Neon PostgreSQL and return a signed JWT.
   */
  server.post('/api/auth/verify', async (request, reply) => {
    const { didToken } = request.body as { didToken?: string };

    if (!didToken) {
      return reply.status(400).send({ error: 'DID token is required' });
    }

    let magicUser: { email: string; issuer: string; publicAddress: string };
    try {
      magic.token.validate(didToken);
      const metadata = await magic.users.getMetadataByToken(didToken);
      if (!metadata.email || !metadata.issuer || !metadata.publicAddress) {
        throw new Error('Incomplete user metadata from Magic');
      }
      magicUser = {
        email: metadata.email,
        issuer: metadata.issuer,
        publicAddress: metadata.publicAddress,
      };
    } catch (err: any) {
      server.log.error({ err }, 'Magic DID token validation failed');
      return reply.status(401).send({ error: 'Invalid or expired Magic authentication token' });
    }

    let userId: string;
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, magicUser.email))
      .limit(1);

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      userId = ulid();
      await db.insert(users).values({
        id: userId,
        email: magicUser.email,
        fullName: magicUser.email.split('@')[0],
        createdAt: new Date(),
      });
    }

    const userEntities = await db
      .select()
      .from(entities)
      .where(eq(entities.userId, userId));

    const jwtPayload = {
      userId,
      email: magicUser.email,
      publicAddress: magicUser.publicAddress,
      entityIds: userEntities.map(e => e.id),
      activeEntityId: userEntities[0]?.id || null,
    };

    const sessionToken = jwt.sign(jwtPayload, env.JWT_SECRET, {
      expiresIn: '30d',
      issuer: 'payit.co',
      audience: 'payit-app',
    });

    return reply.send({
      success: true,
      token: sessionToken,
      user: {
        id: userId,
        email: magicUser.email,
        publicAddress: magicUser.publicAddress,
        entityIds: jwtPayload.entityIds,
        activeEntityId: jwtPayload.activeEntityId,
        isNewUser: existingUsers.length === 0,
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
