import { createDbClient, eq } from '@payit/db';
import { idempotencyKeys } from '@payit/db/schema';
import crypto from 'crypto';

const db = createDbClient();

export interface IdempotencyRecord {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  response?: any;
  statusCode?: number;
  createdAt: number;
  requestHash: string;
}

// Memory L1 cache (120s TTL) for high throughput
const memoryStore = new Map<string, IdempotencyRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now - record.createdAt > 120_000) {
      memoryStore.delete(key);
    }
  }
}, 60_000);

/**
 * Check idempotency key across L1 Memory & L2 Neon PostgreSQL DB.
 * Guarantees zero duplicate execution even across backend server restarts.
 */
export async function checkIdempotencyKey(
  key: string,
  entityId: string,
  requestPayload?: any
): Promise<{ isDuplicate: boolean; record?: IdempotencyRecord }> {
  const compositeKey = `${entityId}_${key}`;
  const now = Date.now();
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestPayload || {})).digest('hex');

  // 1. Check L1 Memory cache
  const cached = memoryStore.get(compositeKey);
  if (cached && cached.status !== 'FAILED') {
    if (cached.requestHash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
    return { isDuplicate: true, record: cached };
  }

  // 2. Check L2 Neon DB durable store
  try {
    const dbRows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, compositeKey)).limit(1);
    if (dbRows.length > 0) {
      const dbRow = dbRows[0];
      if (dbRow.status !== 'FAILED') {
        if (dbRow.requestHash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
        const parsedPayload = dbRow.responsePayload ? JSON.parse(dbRow.responsePayload) : null;
        const rec: IdempotencyRecord = {
          status: dbRow.status as any,
          statusCode: parsedPayload?.statusCode || 200,
          response: parsedPayload?.response || parsedPayload,
          createdAt: dbRow.createdAt.getTime(),
          requestHash: dbRow.requestHash,
        };
        memoryStore.set(compositeKey, rec);
        return { isDuplicate: true, record: rec };
      } else {
        // Clear FAILED row so a fresh attempt can lock
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, compositeKey));
        memoryStore.delete(compositeKey);
      }
    }

    // Insert lock into DB
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000); // 24-hour durable hold

    await db.insert(idempotencyKeys).values({
      key: compositeKey,
      entityId,
      requestHash,
      status: 'PROCESSING',
      createdAt: new Date(),
      expiresAt,
    });

    const rec: IdempotencyRecord = { status: 'PROCESSING', createdAt: now, requestHash };
    memoryStore.set(compositeKey, rec);
    return { isDuplicate: false };

  } catch (dbErr) {
    if ((dbErr as any)?.message === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD') throw dbErr;
    if ((dbErr as any)?.code === '23505') {
      const racedRows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, compositeKey)).limit(1);
      const raced = racedRows[0];
      if (raced?.requestHash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
      return { isDuplicate: true, record: { status: raced.status as any, createdAt: raced.createdAt.getTime(), requestHash: raced.requestHash } };
    }
    // Fallback to L1 if DB error occurs
    memoryStore.delete(compositeKey); // Remove from memory since we failed to lock
    throw new Error('Database unavailable for idempotency lock. Failing safe to prevent duplicate processing.');
  }
}

/**
 * Save final completed response in both L1 Memory and L2 Neon DB.
 */
export async function saveIdempotencyResponse(
  key: string,
  entityId: string,
  statusCode: number,
  response: any
): Promise<void> {
  const compositeKey = `${entityId}_${key}`;
  const now = Date.now();
  const existing = memoryStore.get(compositeKey);
  const rec: IdempotencyRecord = {
    status: 'COMPLETED',
    statusCode,
    response,
    createdAt: now,
    requestHash: existing?.requestHash || '',
  };

  memoryStore.set(compositeKey, rec);

  try {
    await db
      .update(idempotencyKeys)
      .set({
        status: 'COMPLETED',
        responsePayload: JSON.stringify({ statusCode, response }),
      })
      .where(eq(idempotencyKeys.key, compositeKey));
  } catch (err) {
    // Non-blocking log
    console.warn('Failed to save idempotency response to DB:', err);
  }
}
