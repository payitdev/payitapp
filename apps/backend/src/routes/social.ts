import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { createDbClient, eq, and, or, sql } from '@payit/db';
import { entities, accounts, friendships, paymentRequests, auditLogs, ledgerEntries, ledgerAccounts, contacts } from '@payit/db/schema';
import { ulid } from 'ulid';
import { NuvionClient } from '@payit/integrations';
import { assertEntityApproved } from './kyc.js';
import { generateUniqueUsername } from '../utils/username.js';
import { getEntityBalance } from '../utils/balance.js';
import { checkIdempotencyKey, saveIdempotencyResponse } from '../middleware/idempotency.js';
import { DeterministicRiskEngine } from '@payit/security';

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
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, newUsername } = request.body as {
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
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, targetUsernameOrId } = request.body as {
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
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, friendshipId, action } = request.body as {
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
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, payerUsernameOrId, amount, currency, narration } = request.body as {
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
   * Fulfill Payment Request (Payer approves & transfers money/crypto).
   * Enforces idempotency, risk evaluation, and locked database transactions (H8 & C8).
   */
  server.post('/api/payments/fulfill', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, requestId } = request.body as {
      entityId: string;
      requestId: string;
    };

    const idempotencyKey = (request.headers['x-idempotency-key'] as string) || (request.body as any)?.idempotencyKey;
    if (idempotencyKey) {
      const { isDuplicate, record } = await checkIdempotencyKey(idempotencyKey, entityId);
      if (isDuplicate && record) {
        if (record.status === 'PROCESSING') {
          return reply.status(409).send({ error: 'A payment fulfill request with this idempotency key is processing. Please wait.' });
        }
        return reply.status(record.statusCode || 200).send(record.response);
      }
    }

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 403, { error: err.message });
      return reply.status(403).send({ error: err.message });
    }

    const reqRows = await db.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1);
    if (reqRows.length === 0) {
      if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 404, { error: 'Payment request not found' });
      return reply.status(404).send({ error: 'Payment request not found' });
    }
    const pr = reqRows[0];

    if (pr.payerEntityId !== entityId) {
      if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 403, { error: 'Only designated payer can fulfill request' });
      return reply.status(403).send({ error: 'Only the designated payer can fulfill this payment request' });
    }

    if (pr.status !== 'PENDING') {
      if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 400, { error: `Request already ${pr.status}` });
      return reply.status(400).send({ error: `Payment request is already in status '${pr.status}'` });
    }

    const numAmount = parseFloat(pr.amount);

    // Entity approval check
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length > 0) {
      try {
        assertEntityApproved(entityRows[0]);
      } catch (err: any) {
        if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 403, { error: err.message });
        return reply.status(403).send({ error: err.message });
      }
    }

    // Risk engine check (H8)
    const riskEngine = new DeterministicRiskEngine();
    const riskAssessment = riskEngine.evaluate({
      userId: session.userId,
      entityId,
      amount: numAmount,
      recipientTagOrAccount: pr.requesterEntityId,
      deviceId: 'mobile_app',
      userKnownRecipients: [pr.requesterEntityId],
      userHistory: [],
    });

    if (riskAssessment.riskLevel === 'HIGH') {
      const errResp = { error: 'Payment request held due to security risk policy' };
      if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 422, errResp);
      return reply.status(422).send(errResp);
    }

    // Atomic Balance Check & Double-Entry Transaction with Row Locking (C8)
    let txId = ulid();
    try {
      await db.transaction(async (tx) => {
        const reqCurr = (pr.currency || 'NGN').toUpperCase();
        const currentBalance = await getEntityBalance(tx, entityId, reqCurr);
        if (currentBalance < numAmount) {
          throw new Error(`INSUFFICIENT_FUNDS:${currentBalance}`);
        }

        const payerLedgerAcc = `${entityId}_cash_${reqCurr}`;
        const requesterLedgerAcc = `${pr.requesterEntityId}_cash_${reqCurr}`;

        // Ensure currency-scoped ledger account exists for requester
        const existingReqAcc = await tx.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, requesterLedgerAcc)).limit(1);
        if (existingReqAcc.length === 0) {
          await tx.insert(ledgerAccounts).values([
            { id: requesterLedgerAcc, entityId: pr.requesterEntityId, name: `Cash / Wallet (${reqCurr})`, type: 'ASSET', currency: reqCurr, createdAt: new Date() },
          ]);
        }

        await tx.insert(ledgerEntries).values([
          { id: ulid(), entityId, transactionId: txId, ledgerAccountId: payerLedgerAcc, type: 'DEBIT', amount: String(numAmount), createdAt: new Date() },
          { id: ulid(), entityId: pr.requesterEntityId, transactionId: txId, ledgerAccountId: requesterLedgerAcc, type: 'CREDIT', amount: String(numAmount), createdAt: new Date() },
        ]);

        await tx.update(paymentRequests).set({ status: 'PAID' }).where(eq(paymentRequests.id, requestId));

        await tx.insert(auditLogs).values({
          id: ulid(),
          userId: session.userId,
          entityId,
          action: 'PAYMENT_REQUEST_FULFILLED',
          metadata: JSON.stringify({ requestId, txId, amount: numAmount, currency: pr.currency, requesterId: pr.requesterEntityId }),
          createdAt: new Date(),
        });
      });
    } catch (err: any) {
      if (err.message?.startsWith('INSUFFICIENT_FUNDS')) {
        const bal = err.message.split(':')[1];
        const errResp = { error: `Insufficient funds to fulfill this request. Your current available balance is ${parseFloat(bal).toLocaleString('en-US', { minimumFractionDigits: 2 })}` };
        if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 422, errResp);
        return reply.status(422).send(errResp);
      }
      if (idempotencyKey) await saveIdempotencyResponse(idempotencyKey, entityId, 500, { error: err.message });
      return reply.status(500).send({ error: err.message || 'Payment fulfillment failed' });
    }

    const successResponse = {
      success: true,
      requestId,
      transactionId: txId,
      amount: numAmount,
      currency: pr.currency,
      status: 'PAID',
      message: 'Payment request fulfilled successfully!',
    };

    if (idempotencyKey) {
      await saveIdempotencyResponse(idempotencyKey, entityId, 200, successResponse);
    }

    return reply.send(successResponse);
  });



  /**
   * Universal Identity Resolution Endpoint
   * Accepts any query (@username, 10-digit BAN, EVM address, Solana address)
   * Resolves target entity and checks mutual relationship status with caller.
   */
  server.get('/api/users/resolve-identity', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { query, entityId } = request.query as { query?: string; entityId?: string };
    if (!query || !entityId) {
      return reply.status(400).send({ error: 'query and entityId parameters are required' });
    }

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const cleanQuery = query.trim();
    const formattedUsername = cleanQuery.startsWith('@') ? cleanQuery.toLowerCase() : `@${cleanQuery.toLowerCase()}`;

    // 1. Search by Username, entityId, businessTag, or solanaAddress
    let matchedEntity: any = null;
    const directMatches = await db
      .select()
      .from(entities)
      .where(
        or(
          eq(entities.id, cleanQuery),
          sql`LOWER(${entities.username}) = ${formattedUsername}`,
          sql`LOWER(${entities.businessTag}) = ${cleanQuery.toUpperCase()}`,
          eq(entities.solanaAddress, cleanQuery)
        )
      )
      .limit(1);

    if (directMatches.length > 0) {
      matchedEntity = directMatches[0];
    } else {
      // 2. Search by Account Number (Nuvion BAN)
      const accMatches = await db
        .select()
        .from(accounts)
        .where(eq(accounts.accountNumber, cleanQuery))
        .limit(1);

      if (accMatches.length > 0) {
        const entRows = await db.select().from(entities).where(eq(entities.id, accMatches[0].entityId)).limit(1);
        if (entRows.length > 0) matchedEntity = entRows[0];
      }
    }

    if (!matchedEntity) {
      return reply.status(404).send({ found: false, message: 'No PayIT user found for this identifier' });
    }

    // 3. Resolve Primary Account Number
    const targetAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.entityId, matchedEntity.id))
      .limit(1);

    const primaryAccount = targetAccounts[0] || null;

    // 4. Check Mutual Relationship Status
    let relationshipStatus: 'MUTUAL_CONTACT' | 'ONE_WAY_CONTACT' | 'STRANGER' = 'STRANGER';

    if (matchedEntity.id === entityId) {
      relationshipStatus = 'MUTUAL_CONTACT';
    } else {
      const mySavedContact = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.entityId, entityId), or(eq(contacts.targetEntityId, matchedEntity.id), sql`LOWER(${contacts.paytag}) = ${matchedEntity.username?.toLowerCase() || ''}`)))
        .limit(1);

      const theirSavedContact = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.entityId, matchedEntity.id), eq(contacts.targetEntityId, entityId)))
        .limit(1);

      const friendshipRows = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              and(eq(friendships.requesterEntityId, entityId), eq(friendships.addresseeEntityId, matchedEntity.id)),
              and(eq(friendships.requesterEntityId, matchedEntity.id), eq(friendships.addresseeEntityId, entityId))
            ),
            eq(friendships.status, 'ACCEPTED')
          )
        )
        .limit(1);

      if (friendshipRows.length > 0 || (mySavedContact.length > 0 && theirSavedContact.length > 0)) {
        relationshipStatus = 'MUTUAL_CONTACT';
      } else if (mySavedContact.length > 0) {
        relationshipStatus = 'ONE_WAY_CONTACT';
      }
    }

    return reply.send({
      found: true,
      identity: {
        entityId: matchedEntity.id,
        legalName: matchedEntity.legalName || 'PayIT User',
        username: matchedEntity.username || `@user_${matchedEntity.id.slice(-4).toLowerCase()}`,
        businessTag: matchedEntity.businessTag,
        accountNumber: primaryAccount?.accountNumber || null,
        bankName: primaryAccount?.bankName || 'Nuvion Partner Bank',
        solanaAddress: matchedEntity.solanaAddress || null,
        relationshipStatus,
        isSelf: matchedEntity.id === entityId,
      },
    });
  });

  /**
   * Save a new contact / beneficiary with Universal Binding
   */
  server.post('/api/social/contacts', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, name, paytag, accountNumber, bankCode, bankName } = request.body as {
      entityId: string;
      name: string;
      paytag?: string;
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
    };

    if (!entityId || !name) {
      return reply.status(400).send({ error: 'entityId and name are required' });
    }

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    let type: 'INTERNAL' | 'EXTERNAL' = 'INTERNAL';
    let targetEntityId: string | null = null;
    let resolvedPaytag = paytag ? paytag.replace(/^\$/, '').toLowerCase() : null;

    if (paytag) {
      const formattedPaytag = `@${resolvedPaytag}`;
      const targetUser = await db
        .select()
        .from(entities)
        .where(sql`LOWER(${entities.username}) = ${formattedPaytag}`)
        .limit(1);

      if (targetUser.length > 0) {
        targetEntityId = targetUser[0].id;
        resolvedPaytag = targetUser[0].username;
      }
    } else if (accountNumber) {
      const accMatch = await db
        .select()
        .from(accounts)
        .where(eq(accounts.accountNumber, accountNumber))
        .limit(1);

      if (accMatch.length > 0) {
        targetEntityId = accMatch[0].entityId;
        const entMatch = await db.select().from(entities).where(eq(entities.id, targetEntityId!)).limit(1);
        if (entMatch.length > 0) {
          resolvedPaytag = entMatch[0].username;
        }
      } else if (bankCode) {
        type = 'EXTERNAL';
      }
    }

    // Auto-create/upgrade friendship if both users have saved each other
    if (targetEntityId && targetEntityId !== entityId) {
      const inverseContact = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.entityId, targetEntityId), eq(contacts.targetEntityId, entityId)))
        .limit(1);

      if (inverseContact.length > 0) {
        const existingFriendship = await db
          .select()
          .from(friendships)
          .where(
            or(
              and(eq(friendships.requesterEntityId, entityId), eq(friendships.addresseeEntityId, targetEntityId)),
              and(eq(friendships.requesterEntityId, targetEntityId), eq(friendships.addresseeEntityId, entityId))
            )
          )
          .limit(1);

        if (existingFriendship.length === 0) {
          await db.insert(friendships).values({
            id: ulid(),
            requesterEntityId: entityId,
            addresseeEntityId: targetEntityId,
            status: 'ACCEPTED',
            createdAt: new Date(),
          });
        } else if (existingFriendship[0].status !== 'ACCEPTED') {
          await db.update(friendships).set({ status: 'ACCEPTED' }).where(eq(friendships.id, existingFriendship[0].id));
        }
      }
    }

    const contactId = ulid();
    await db.insert(contacts).values({
      id: contactId,
      entityId,
      targetEntityId: targetEntityId || null,
      name,
      paytag: resolvedPaytag,
      accountNumber: accountNumber || null,
      bankCode: bankCode || null,
      bankName: bankName || null,
      type,
      createdAt: new Date(),
    });

    return reply.status(201).send({
      success: true,
      contact: {
        id: contactId,
        entityId,
        targetEntityId,
        name,
        paytag: resolvedPaytag,
        accountNumber,
        bankCode,
        bankName,
        type,
      },
    });
  });

  /**
   * Fetch all saved contacts with relationship status
   */
  server.get('/api/social/contacts', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId query parameter required' });

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const userContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.entityId, entityId));

    return reply.send({ contacts: userContacts });
  });

  /**
   * Get Inbound & Outbound Payment Requests (Separated into Trusted vs Stranger Inbox)
   */
  server.get('/api/payments/requests', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId query parameter required' });

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const inbound = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.payerEntityId, entityId));

    const outbound = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterEntityId, entityId));

    // Map requester details
    const trustedInbound: any[] = [];
    const strangerInbound: any[] = [];

    for (const reqItem of inbound) {
      const reqEntityRows = await db.select().from(entities).where(eq(entities.id, reqItem.requesterEntityId)).limit(1);
      const reqEntity = reqEntityRows[0] || null;

      // Check if mutual contact
      const isMutual = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              and(eq(friendships.requesterEntityId, entityId), eq(friendships.addresseeEntityId, reqItem.requesterEntityId)),
              and(eq(friendships.requesterEntityId, reqItem.requesterEntityId), eq(friendships.addresseeEntityId, entityId))
            ),
            eq(friendships.status, 'ACCEPTED')
          )
        )
        .limit(1);

      const itemData = {
        id: reqItem.id,
        amount: reqItem.amount,
        currency: reqItem.currency,
        narration: reqItem.narration,
        status: reqItem.status,
        createdAt: reqItem.createdAt,
        requester: {
          entityId: reqItem.requesterEntityId,
          legalName: reqEntity?.legalName || 'PayIT User',
          username: reqEntity?.username || `@user_${reqItem.requesterEntityId.slice(-4).toLowerCase()}`,
        },
        isMutualContact: isMutual.length > 0,
      };

      if (isMutual.length > 0) {
        trustedInbound.push(itemData);
      } else {
        strangerInbound.push(itemData);
      }
    }

    return reply.send({
      inbound: {
        trusted: trustedInbound,
        strangers: strangerInbound,
      },
      outbound,
    });
  });

  /**
   * Decline Payment Request
   */
  server.post('/api/payments/decline', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, requestId } = request.body as { entityId: string; requestId: string };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const reqRows = await db.select().from(paymentRequests).where(eq(paymentRequests.id, requestId)).limit(1);
    if (reqRows.length === 0) return reply.status(404).send({ error: 'Payment request not found' });

    if (reqRows[0].payerEntityId !== entityId) {
      return reply.status(403).send({ error: 'Only the designated payer can decline this request' });
    }

    await db.update(paymentRequests).set({ status: 'DECLINED' }).where(eq(paymentRequests.id, requestId));

    return reply.send({ success: true, message: 'Payment request declined' });
  });
}

