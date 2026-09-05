import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ulid } from 'ulid';
import { createDbClient, eq, inArray, and, gt } from '@payit/db';
import { users, trustedDevices, entities, accounts, telegramUserLinks } from '@payit/db/schema';
import { PrivyNEARBridge, PrivyServerAuth, registerNearAccountOnChain, deriveUserAddresses } from '@payit/integrations';
import { env } from '../env.js';

const db = createDbClient();

function verifyTelegramInitData(initData: string, botToken: string): { id: number; username?: string } {
  if (!initData || !botToken) throw new Error('Telegram Mini App authentication is not configured');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !Number.isInteger(authDate) || Math.abs(Date.now() / 1000 - authDate) > 10 * 60) {
    throw new Error('Telegram authentication data is missing or expired');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const received = Buffer.from(receivedHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('Telegram authentication signature is invalid');
  }

  const userJson = params.get('user');
  if (!userJson) throw new Error('Telegram user data is missing');
  const user = JSON.parse(userJson) as { id?: number; username?: string };
  if (!Number.isSafeInteger(user.id)) throw new Error('Telegram user identity is invalid');
  const telegramUserId = user.id as number;
  return { id: telegramUserId, username: user.username };
}

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

  server.post('/api/auth/telegram/mini-app', async (request, reply) => {
    try {
      const body = request.body as { initData?: string };
      const telegramUser = verifyTelegramInitData(body?.initData || '', env.TELEGRAM_BOT_TOKEN);
      const links = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.telegramUserId, telegramUser.id)).limit(1);
      let link = links[0];
      if (!link || link.status !== 'linked' || !link.userId) {
        const userId = `tg_${telegramUser.id}`;
        const email = `${userId}@telegram.proxim.app`;
        const fullName = telegramUser.username ? `@${telegramUser.username}` : `Telegram User ${telegramUser.id}`;
        const personalEntityId = `ent_${userId}_personal`;
        const businessEntityId = `ent_${userId}_business`;
        const personal = await deriveUserAddresses(userId, 'personal', email);
        const business = await deriveUserAddresses(userId, 'business', email);

        await db.insert(users).values({ id: userId, email, fullName }).onConflictDoNothing();
        await db.insert(entities).values([
          { id: personalEntityId, userId, kind: 'PERSONAL', legalName: fullName, username: `tg_${telegramUser.id}`, evmDepositAddress: personal.evmAddress, nearDepositAddress: personal.nearNamedAddress, solanaDepositAddress: personal.solanaAddress, btcDepositAddress: personal.btcAddress, tronDepositAddress: personal.tronAddress, tonDepositAddress: personal.tonAddress, cosmosDepositAddress: personal.cosmosAddress, suiDepositAddress: personal.suiAddress, aptosDepositAddress: personal.aptosAddress, xrpDepositAddress: personal.xrpAddress, dueStatus: 'incomplete' },
          { id: businessEntityId, userId, kind: 'BUSINESS', legalName: `${fullName} Business`, businessTag: `TG_${telegramUser.id}_BIZ`, evmDepositAddress: business.evmAddress, nearDepositAddress: business.nearNamedAddress, solanaDepositAddress: business.solanaAddress, btcDepositAddress: business.btcAddress, tronDepositAddress: business.tronAddress, tonDepositAddress: business.tonAddress, cosmosDepositAddress: business.cosmosAddress, suiDepositAddress: business.suiAddress, aptosDepositAddress: business.aptosAddress, xrpDepositAddress: business.xrpAddress, dueStatus: 'incomplete' },
        ]).onConflictDoNothing();
        await db.insert(telegramUserLinks).values({ id: ulid(), userId, nonce: crypto.randomBytes(24).toString('hex'), status: 'linked', telegramUserId: telegramUser.id, telegramUsername: telegramUser.username || null, expiresAt: new Date('2099-01-01T00:00:00.000Z'), linkedAt: new Date() }).onConflictDoNothing();
        const createdLinks = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.telegramUserId, telegramUser.id)).limit(1);
        link = createdLinks[0];
      }
      if (!link || link.status !== 'linked' || !link.userId) return reply.status(409).send({ error: 'Unable to provision a canonical Telegram account' });

      const userRows = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);
      if (userRows.length === 0) return reply.status(404).send({ error: 'Linked application user not found' });
      const rawEntities = await db.select().from(entities).where(eq(entities.userId, link.userId)).orderBy(entities.kind);
      if (rawEntities.length === 0) return reply.status(409).send({ error: 'Linked user has no account entity' });
      const populatedEntities = await populateEntitiesWithAccounts(rawEntities);
      const personalEntity = populatedEntities.find(e => e.kind === 'PERSONAL');
      const token = jwt.sign(
        { userId: link.userId, email: userRows[0].email, telegramUserId: telegramUser.id, channel: 'telegram-mini-app' },
        env.JWT_SECRET,
        { expiresIn: '1h' },
      );

      return reply.send({
        success: true,
        token,
        user: {
          id: link.userId,
          email: userRows[0].email,
          fullName: userRows[0].fullName,
          entities: populatedEntities,
          activeEntityId: personalEntity?.id || populatedEntities[0].id,
        },
      });
    } catch (error: any) {
      return reply.status(401).send({ error: error.message || 'Telegram authentication failed' });
    }
  });

  server.post('/api/auth/telegram/web-claim/start', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Telegram Mini App authentication required' });
    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as { userId: string; telegramUserId?: number; channel?: string };
      if (payload.channel !== 'telegram-mini-app' || !payload.telegramUserId) return reply.status(403).send({ error: 'This session cannot create a web claim' });
      const claimNonce = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const updated = await db.update(telegramUserLinks).set({ nonce: claimNonce, expiresAt, updatedAt: new Date() }).where(and(
        eq(telegramUserLinks.userId, payload.userId),
        eq(telegramUserLinks.telegramUserId, payload.telegramUserId),
        eq(telegramUserLinks.status, 'linked'),
      )).returning({ id: telegramUserLinks.id });
      if (updated.length === 0) return reply.status(404).send({ error: 'Telegram account link not found' });
      const claimToken = jwt.sign({ userId: payload.userId, telegramUserId: payload.telegramUserId, claimNonce, purpose: 'telegram-web-claim' }, env.JWT_SECRET, { expiresIn: '10m' });
      const webUrl = `${env.TELEGRAM_MINI_APP_URL || ''}?telegram_claim=${encodeURIComponent(claimToken)}`;
      return reply.send({ success: true, claimToken, webUrl });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired Telegram session' });
    }
  });

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

  server.post('/api/auth/telegram/link/start', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as { userId: string; email: string };
      const userRows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (userRows.length === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const nonce = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const existing = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.userId, payload.userId)).limit(1);

      if (existing.length > 0) {
        await db.update(telegramUserLinks)
          .set({ nonce, status: 'pending', telegramUserId: null, telegramUsername: null, expiresAt, updatedAt: new Date() })
          .where(eq(telegramUserLinks.id, existing[0].id));
      } else {
        await db.insert(telegramUserLinks).values({
          id: ulid(),
          userId: payload.userId,
          privyUserId: userRows[0].privyUserId || null,
          nonce,
          status: 'pending',
          expiresAt,
        });
      }

      return reply.send({
        success: true,
        nonce,
        expiresAt: expiresAt.toISOString(),
        botCommand: `/link ${nonce}`,
        botUrl: `https://t.me/proximfi_bot?start=link_${nonce}`,
      });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
  });

  server.post('/api/auth/telegram/link/confirm', async (request, reply) => {
    const { nonce, telegramUserId, telegramUsername } = request.body as {
      nonce?: string;
      telegramUserId?: number;
      telegramUsername?: string;
    };

    if (!nonce || !telegramUserId) {
      return reply.status(400).send({ error: 'nonce and telegramUserId are required' });
    }

    const rows = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.nonce, nonce)).limit(1);
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Link nonce not found or already used' });
    }

    const pending = rows[0];
    if (pending.status !== 'pending') {
      return reply.status(409).send({ error: 'Link request has already been consumed or revoked' });
    }
    const expiresAt = pending.expiresAt ? new Date(pending.expiresAt) : new Date(0);
    if (expiresAt.getTime() < Date.now()) {
      return reply.status(410).send({ error: 'Link request expired. Please request a new one.' });
    }

    const linkedRows = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.telegramUserId, telegramUserId)).limit(1);
    if (linkedRows.length > 0 && linkedRows[0].id !== pending.id) {
      return reply.status(409).send({
        error: 'This Telegram account is already linked to another user',
      });
    }

    const consumed = await db.update(telegramUserLinks)
      .set({
        telegramUserId,
        telegramUsername: telegramUsername || pending.telegramUsername || null,
        status: 'linked',
        linkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(telegramUserLinks.id, pending.id),
        eq(telegramUserLinks.status, 'pending'),
        gt(telegramUserLinks.expiresAt, new Date()),
      )).returning({ id: telegramUserLinks.id });

    if (consumed.length === 0) {
      return reply.status(409).send({ error: 'Link request was already consumed or expired' });
    }

    return reply.send({
      success: true,
      linked: true,
      userId: pending.userId,
      telegramUserId,
      telegramUsername: telegramUsername || pending.telegramUsername || null,
    });
  });

  server.get('/api/auth/telegram/link/status', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as { userId: string };
      const rows = await db.select().from(telegramUserLinks).where(eq(telegramUserLinks.userId, payload.userId)).limit(1);
      if (rows.length === 0 || rows[0].status !== 'linked') {
        return reply.send({ success: true, linked: false });
      }

      return reply.send({
        success: true,
        linked: true,
        telegramUserId: rows[0].telegramUserId,
        telegramUsername: rows[0].telegramUsername,
      });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired session' });
    }
  });

  server.post('/api/auth/telegram/unlink', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as { userId: string };
      await db.delete(telegramUserLinks).where(eq(telegramUserLinks.userId, payload.userId));
      return reply.send({ success: true, unlinked: true });
    } catch {
      return reply.status(401).send({ error: 'Invalid session' });
    }
  });

  /**
   * Privy Social Login Handler
   * Handles login via Privy (Google, Apple, Email)
   */
  server.post('/api/auth/privy/login', async (request, reply) => {
    const { privyUserId, walletAddress, telegramClaimToken } = request.body as {
      privyUserId: string;
      walletAddress?: string;
      telegramClaimToken?: string;
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
      let claimedUserId: string | undefined;
      let claimLinkId: string | undefined;
      if (telegramClaimToken) {
        const claim = jwt.verify(telegramClaimToken, env.JWT_SECRET) as { userId?: string; telegramUserId?: number; claimNonce?: string; purpose?: string };
        if (claim.purpose !== 'telegram-web-claim' || !claim.userId || !claim.telegramUserId || !claim.claimNonce) throw new Error('Invalid Telegram web claim');
        const claimRows = await db.select().from(telegramUserLinks).where(and(
          eq(telegramUserLinks.userId, claim.userId),
          eq(telegramUserLinks.telegramUserId, claim.telegramUserId),
          eq(telegramUserLinks.nonce, claim.claimNonce),
          eq(telegramUserLinks.status, 'linked'),
          gt(telegramUserLinks.expiresAt, new Date()),
        )).limit(1);
        if (claimRows.length === 0) throw new Error('Telegram web claim is invalid or expired');
        claimedUserId = claim.userId;
        claimLinkId = claimRows[0].id;
      }

      let userRows = claimedUserId ? await db.select().from(users).where(eq(users.id, claimedUserId)).limit(1) : await db.select().from(users).where(eq(users.privyUserId, privyUserId)).limit(1);
      if (!claimedUserId && userRows.length === 0) userRows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
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
        // Update existing user with Privy ID if not set or if user was re-authenticated with new Privy user ID
        userId = userRows[0].id;
        if (claimedUserId && userRows[0].privyUserId && userRows[0].privyUserId !== privyUserId) {
          return reply.status(409).send({ error: 'Telegram account is already linked to another Privy identity' });
        }
        if (userRows[0].privyUserId && userRows[0].privyUserId !== privyUserId) {
          return reply.status(409).send({ error: 'This email is already linked to another Privy identity' });
        }
        if (!userRows[0].privyUserId) {
          await db.update(users).set({ privyUserId }).where(eq(users.id, userId));
        }
        if (claimLinkId) {
          await db.update(telegramUserLinks).set({ nonce: crypto.randomBytes(24).toString('hex'), expiresAt: new Date('2099-01-01T00:00:00.000Z'), updatedAt: new Date() }).where(and(eq(telegramUserLinks.id, claimLinkId), eq(telegramUserLinks.nonce, (jwt.verify(telegramClaimToken!, env.JWT_SECRET) as any).claimNonce)));
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
            evmDepositAddress: null,
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
      const token = jwt.sign({ userId, email: cleanEmail }, env.JWT_SECRET, { expiresIn: '7d' });

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

  /**
   * Demo / Preview Session Generator
   * Generates a fully verified demo session with backend JWT and Neon DB entities.
   */
  server.post('/api/auth/demo', async (request, reply) => {
    const demoEmail = 'alex.morgan@proxim.app';
    const demoPrivyId = 'did:privy:demo_user_proxim_001';

    let userRows = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);
    let userId: string;

    if (userRows.length === 0) {
      userId = ulid();
      await db.insert(users).values({
        id: userId,
        email: demoEmail,
        fullName: 'Alex Morgan',
        privyUserId: demoPrivyId,
      });
    } else {
      userId = userRows[0].id;
    }

    let userEntities = await db.select().from(entities).where(eq(entities.userId, userId));
    if (userEntities.length === 0) {
      const personalEntityId = ulid();
      const businessEntityId = ulid();
      await db.insert(entities).values({
        id: personalEntityId,
        userId,
        kind: 'PERSONAL',
        legalName: 'Alex Morgan',
        username: 'alexmorgan',
        dueStatus: 'approved',
      });
      await db.insert(entities).values({
        id: businessEntityId,
        userId,
        kind: 'BUSINESS',
        legalName: 'Alex Morgan Ventures',
        businessTag: 'ALEXBIZ',
        dueStatus: 'approved',
      });
    }

    const rawEntities = await db.select().from(entities).where(eq(entities.userId, userId)).orderBy(entities.kind);
    const populatedEntities = await populateEntitiesWithAccounts(rawEntities);
    const token = jwt.sign({ userId, email: demoEmail }, env.JWT_SECRET, { expiresIn: '7d' });

    return reply.send({
      success: true,
      token,
      user: {
        id: userId,
        email: demoEmail,
        fullName: 'Alex Morgan',
        entities: populatedEntities,
        activeEntityId: populatedEntities.find(e => e.kind === 'PERSONAL')?.id || populatedEntities[0]?.id,
        hasPasscode: false,
      },
    });
  });
}
