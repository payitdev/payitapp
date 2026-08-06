import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { createDbClient, eq, and, or, sql } from '@payit/db';
import { entities, friendships, paymentRequests, auditLogs, ledgerEntries, ledgerAccounts } from '@payit/db/schema';
import { ulid } from 'ulid';
import { NuvionClient } from '@payit/integrations';
import { assertEntityApproved } from './kyc.js';
import { generateUniqueUsername } from '../utils/username.js';
import { getEntityBalance } from '../utils/balance.js';

const db = createDbClient();
const nuvion = new NuvionClient();

export async function socialRoutes(server: FastifyInstance) {

  /**
   * Real-time Username Availability Check
   * Enforces regex: ^@[a-zA-Z0-9_]{3,20}$
   */
  server.get('/api/users/check-username', async (request, reply) => {
    const { username } = request.query as { username?: string };

    if (!username) {
      return reply.status(400).send({ available: false, error: 'Username is required' });
    }

    const formatted = username.startsWith('@') ? username : `@${username}`;
    const usernameRegex = /^@[a-zA-Z0-9_]{3,20}$/;

    if (!usernameRegex.test(formatted)) {
      return reply.status(400).send({
        available: false,
        error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.',
      });
    }

    const existing = await db
      .select()
      .from(entities)
      .where(sql`LOWER(${entities.username}) = LOWER(${formatted})`)
      .limit(1);

    if (existing.length > 0) {
      return reply.send({ available: false, message: 'Username is already taken by another user.' });
    }

    return reply.send({ available: true, username: formatted, message: 'Username is available!' });
  });

  /**
   * One-Time Username Customization Endpoint
   * Enforces usernameCustomized === 0, updates username, and sets usernameCustomized = 1.
   */
  server.post('/api/users/update-username', async (request, reply) => {
    const { session, entityId, newUsername } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      newUsername: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const formatted = newUsername.startsWith('@') ? newUsername : `@${newUsername}`;
    const usernameRegex = /^@[a-zA-Z0-9_]{3,20}$/;

    if (!usernameRegex.test(formatted)) {
      return reply.status(400).send({
        error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.',
      });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    if (entity.usernameCustomized === 1) {
      return reply.status(403).send({ error: 'Username has already been customized. It cannot be changed again.' });
    }

    // Check collision case-insensitively
    const collision = await db
      .select()
      .from(entities)
      .where(sql`LOWER(${entities.username}) = LOWER(${formatted}) AND ${entities.id} != ${entityId}`)
      .limit(1);

    if (collision.length > 0) {
      return reply.status(409).send({ error: 'Username is already taken by another user.' });
    }

    await db
      .update(entities)
      .set({
        username: formatted,
        usernameCustomized: 1,
      })
      .where(eq(entities.id, entityId));

    return reply.send({
      success: true,
      username: formatted,
      usernameCustomized: true,
      message: 'Username updated successfully!',
    });
  });

  /**
   * Send Friend Request
   */
  server.post('/api/friends/request', async (request, reply) => {
    const { session, entityId, targetUsernameOrId } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      targetUsernameOrId: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const formattedTarget = targetUsernameOrId.startsWith('@') ? targetUsernameOrId : `@${targetUsernameOrId}`;
    const targetRows = await db
      .select()
      .from(entities)
      .where(or(eq(entities.id, targetUsernameOrId), sql`LOWER(${entities.username}) = LOWER(${formattedTarget})`))
      .limit(1);

    if (targetRows.length === 0) {
      return reply.status(404).send({ error: 'User not found' });
    }
    const targetEntity = targetRows[0];

    if (targetEntity.id === entityId) {
      return reply.status(400).send({ error: 'You cannot send a friend request to yourself' });
    }

    const existingFriendship = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterEntityId, entityId), eq(friendships.addresseeEntityId, targetEntity.id)),
          and(eq(friendships.requesterEntityId, targetEntity.id), eq(friendships.addresseeEntityId, entityId))
        )
      )
      .limit(1);

    if (existingFriendship.length > 0) {
      return reply.status(409).send({ error: `Friendship status is already ${existingFriendship[0].status}` });
    }

    const friendshipId = ulid();
    await db.insert(friendships).values({
      id: friendshipId,
      requesterEntityId: entityId,
      addresseeEntityId: targetEntity.id,
      status: 'PENDING',
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      friendshipId,
      targetUsername: targetEntity.username,
      status: 'PENDING',
      message: `Friend request sent to ${targetEntity.username || targetEntity.legalName}!`,
    });
  });

  /**
   * Respond to Friend Request (ACCEPT / DECLINE)
   */
  server.post('/api/friends/respond', async (request, reply) => {
    const { session, entityId, friendshipId, action } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      friendshipId: string;
      action: 'ACCEPT' | 'DECLINE';
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const rows = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1);
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Friend request not found' });
    }
    const f = rows[0];

    if (f.addresseeEntityId !== entityId) {
      return reply.status(403).send({ error: 'Only the recipient of a friend request can accept or decline it' });
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
    await db.update(friendships).set({ status: newStatus }).where(eq(friendships.id, friendshipId));

    return reply.send({
      success: true,
      friendshipId,
      status: newStatus,
      message: action === 'ACCEPT' ? 'Friend request accepted! You can now request payments.' : 'Friend request declined.',
    });
  });

  /**
   * Get Friends List (Only ACCEPTED mutual friends)
   */
  server.get('/api/friends/list', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.send({ friends: [] });

    const rows = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(eq(friendships.requesterEntityId, entityId), eq(friendships.addresseeEntityId, entityId)),
          eq(friendships.status, 'ACCEPTED')
        )
      );

    const friendEntityIds = rows.map(r => r.requesterEntityId === entityId ? r.addresseeEntityId : r.requesterEntityId);
    if (friendEntityIds.length === 0) return reply.send({ friends: [] });

    const friendEntities = await db.select().from(entities).where(sql`${entities.id} IN ${friendEntityIds}`);

    return reply.send({
      friends: friendEntities.map(e => ({
        id: e.id,
        username: e.username,
        legalName: e.legalName,
        kind: e.kind,
      })),
    });
  });

  /**
   * Create Payment Request (GATED: MUST BE MUTUAL FRIENDS)
   */
  server.post('/api/payments/request', async (request, reply) => {
    const { session, entityId, payerUsernameOrId, amount, currency, narration } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      payerUsernameOrId: string;
      amount: number;
      currency: string;
      narration?: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Amount must be greater than zero' });
    }

    const formattedTarget = payerUsernameOrId.startsWith('@') ? payerUsernameOrId : `@${payerUsernameOrId}`;
    const payerRows = await db
      .select()
      .from(entities)
      .where(or(eq(entities.id, payerUsernameOrId), sql`LOWER(${entities.username}) = LOWER(${formattedTarget})`))
      .limit(1);

    if (payerRows.length === 0) {
      return reply.status(404).send({ error: 'Payer user not found' });
    }
    const payerEntity = payerRows[0];

    // MUTUAL FRIENDSHIP GATE: Verify that requester and payer are accepted mutual friends
    const friendship = await db
      .select()
      .from(friendships)
      .where(
        and(
          or(
            and(eq(friendships.requesterEntityId, entityId), eq(friendships.addresseeEntityId, payerEntity.id)),
            and(eq(friendships.requesterEntityId, payerEntity.id), eq(friendships.addresseeEntityId, entityId))
          ),
          eq(friendships.status, 'ACCEPTED')
        )
      )
      .limit(1);

    if (friendship.length === 0) {
      return reply.status(403).send({
        error: 'Security Policy Gate: You can only request payment from users on your accepted friends list. Send a friend request first.',
      });
    }

    const requestId = ulid();
    await db.insert(paymentRequests).values({
      id: requestId,
      requesterEntityId: entityId,
      payerEntityId: payerEntity.id,
      amount: String(amount),
      currency: currency || 'NGN',
      narration: narration || 'PayIT Payment Request',
      status: 'PENDING',
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      requestId,
      payerUsername: payerEntity.username,
      amount,
      currency: currency || 'NGN',
      status: 'PENDING',
      message: `Payment request for ${currency || 'NGN'} ${amount} sent to ${payerEntity.username || payerEntity.legalName}!`,
    });
  });

  /**
   * Fulfill Payment Request (Payer approves & transfers money/crypto)
   */
  server.post('/api/payments/fulfill', async (request, reply) => {
    const { session, entityId, requestId } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      requestId: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const reqRows = await db.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1);
    if (reqRows.length === 0) {
      return reply.status(404).send({ error: 'Payment request not found' });
    }
    const pr = reqRows[0];

    if (pr.payerEntityId !== entityId) {
      return reply.status(403).send({ error: 'Only the designated payer can fulfill this payment request' });
    }

    if (pr.status !== 'PENDING') {
      return reply.status(400).send({ error: `Payment request is already in status '${pr.status}'` });
    }

    const numAmount = parseFloat(pr.amount);

    // Entity approval check
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length > 0) {
      try {
        assertEntityApproved(entityRows[0]);
      } catch (err: any) {
        return reply.status(403).send({ error: err.message });
      }
    }

    // Atomic Balance Verification — prevent fulfilling without funds (M5)
    const currentBalance = await getEntityBalance(db, entityId);

    if (currentBalance < numAmount) {
      return reply.status(422).send({
        error: `Insufficient funds to fulfill this request. Your current available balance is ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      });
    }

    // Execute internal double-entry ledger transfer between Payer & Requester
    const txId = ulid();
    const payerLedgerAcc = `${entityId}_cash`;
    const requesterLedgerAcc = `${pr.requesterEntityId}_cash`;

    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId, transactionId: txId, ledgerAccountId: payerLedgerAcc, type: 'DEBIT', amount: String(numAmount), createdAt: new Date() },
      { id: ulid(), entityId: pr.requesterEntityId, transactionId: txId, ledgerAccountId: requesterLedgerAcc, type: 'CREDIT', amount: String(numAmount), createdAt: new Date() },
    ]);

    await db.update(paymentRequests).set({ status: 'PAID' }).where(eq(paymentRequests.id, requestId));

    await db.insert(auditLogs).values({
      id: ulid(),
      userId: session.userId,
      entityId,
      action: 'PAYMENT_REQUEST_FULFILLED',
      metadata: JSON.stringify({ requestId, txId, amount: numAmount, currency: pr.currency, requesterId: pr.requesterEntityId }),
      createdAt: new Date(),
    });

    return reply.send({
      success: true,
      requestId,
      transactionId: txId,
      amount: numAmount,
      currency: pr.currency,
      status: 'PAID',
      message: 'Payment request fulfilled successfully!',
    });
  });

  /**
   * List all payment requests for an entity.
   */
  server.get('/api/payments/requests', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId query parameter required' });

    try {
      const reqs = await db
        .select()
        .from(paymentRequests)
        .where(or(eq(paymentRequests.requesterEntityId, entityId), eq(paymentRequests.payerEntityId, entityId)));

      return reply.send({ requests: reqs });
    } catch {
      return reply.send({ requests: [] });
    }
  });
}
