import { FastifyInstance } from 'fastify';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { entities, accounts, users } from '@payit/db/schema';
import { ulid } from 'ulid';

const nuvion = new NuvionClient();
const db = createDbClient();

export async function entityRoutes(server: FastifyInstance) {

  /**
   * Verify KYC (Personal) or KYB (Business) and register entity in Neon DB.
   * No mock entity IDs — real ulid, real DB insert.
   */
  server.post('/api/entities/verify', async (request, reply) => {
    const { userId, kind, legalName, bvn, rcNumber, address, dob, idNumber, tin, uboLegalName, uboBvn, businessAddress } =
      request.body as {
        userId: string;
        kind: 'PERSONAL' | 'BUSINESS';
        legalName: string;
        bvn?: string;
        rcNumber?: string;
        address?: string;
        dob?: string;
        idNumber?: string;
        tin?: string;
        uboLegalName?: string;
        uboBvn?: string;
        businessAddress?: string;
      };

    if (!userId || !kind || !legalName) {
      return reply.status(400).send({ error: 'userId, kind, and legalName are mandatory' });
    }

    // Verify user exists
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return reply.status(404).send({ error: 'User not found. Complete authentication before entity verification.' });
    }

    // Check that a PERSONAL entity doesn't already exist for this user
    // (Unique constraint enforced at DB level: UNIQUE(user_id, kind))
    const existingEntity = await db
      .select()
      .from(entities)
      .where(and(eq(entities.userId, userId), eq(entities.kind, kind)))
      .limit(1);

    if (existingEntity.length > 0) {
      return reply.status(409).send({
        error: `A ${kind} entity already exists for this user`,
        entity: existingEntity[0],
      });
    }

    // Submit KYC/KYB to Nuvion with real payload
    let kycResult: any;
    try {
      kycResult = await nuvion.submitKycKyb(kind, {
        legalName,
        bvn,
        rcNumber,
        address,
        dob,
        idNumber,
      });
    } catch (err: any) {
      server.log.error({ err }, 'Nuvion KYC/KYB submission failed');
      return reply.status(502).send({ error: `KYC/KYB submission failed: ${err.message}` });
    }

    const entityId = ulid();
    const username = kind === 'PERSONAL'
      ? legalName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
      : undefined;
    const businessTag = kind === 'BUSINESS'
      ? legalName.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()
      : undefined;

    // Insert entity into Neon DB
    await db.insert(entities).values({
      id: entityId,
      userId,
      kind,
      legalName,
      username,
      businessTag,
      nuvionTier: kycResult.tier,
      nuvionStatus: kycResult.status,
      nuvionEntityId: kycResult.nuvionEntityId,
      xpub: null, // Set during invoice creation
      createdAt: new Date(),
    });

    // Create default virtual account (NGN for Personal, USD for Business)
    const defaultCurrency = kind === 'PERSONAL' ? 'NGN' : 'USD';
    const accountId = ulid();
    await db.insert(accounts).values({
      id: accountId,
      entityId,
      nuvionAccountId: kycResult.virtualAccount.nuvionAccountId,
      accountNumber: kycResult.virtualAccount.accountNumber,
      bankName: kycResult.virtualAccount.bankName,
      accountHolderName: kycResult.virtualAccount.accountHolderName,
      currency: defaultCurrency,
      status: 'active',
      createdAt: new Date(),
    });

    return reply.send({
      entity: {
        id: entityId,
        userId,
        kind,
        legalName,
        accountHolderName: kycResult.accountHolderName,
        username,
        businessTag,
        nuvionTier: kycResult.tier,
        nuvionStatus: kycResult.status,
        nuvionEntityId: kycResult.nuvionEntityId,
        createdAt: new Date().toISOString(),
      },
      defaultAccount: {
        id: accountId,
        currency: defaultCurrency,
        accountNumber: kycResult.virtualAccount.accountNumber,
        bankName: kycResult.virtualAccount.bankName,
      },
    });
  });

  /**
   * Switch active entity context — validates entity belongs to the user in DB.
   */
  server.post('/api/entities/switch-context', async (request, reply) => {
    const { userId, targetEntityId } = request.body as { userId: string; targetEntityId: string };

    if (!userId || !targetEntityId) {
      return reply.status(400).send({ error: 'userId and targetEntityId are required' });
    }

    // Verify the target entity belongs to this user
    const entityRows = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, targetEntityId), eq(entities.userId, userId)))
      .limit(1);

    if (entityRows.length === 0) {
      return reply.status(403).send({ error: 'Target entity does not belong to this user' });
    }

    return reply.send({
      activeEntityId: targetEntityId,
      activeEntityKind: entityRows[0].kind,
      message: `Active session context switched to ${entityRows[0].kind} entity`,
    });
  });

  /**
   * Get all entities for a user from DB.
   */
  server.get('/api/entities', async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    if (!userId) return reply.status(400).send({ error: 'userId query parameter required' });

    const userEntities = await db
      .select()
      .from(entities)
      .where(eq(entities.userId, userId));

    return reply.send({ entities: userEntities });
  });
}
