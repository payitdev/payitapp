/**
 * Shared Username Generator & Formatting Utility (M4)
 * Generates unique @username handles for Personal entities and @businessTag for Business entities.
 */

import { eq } from '@payit/db';
import { entities } from '@payit/db/schema';

/**
 * Sanitizes and generates a unique handle with automatic collision check and retry logic.
 */
export async function generateUniqueUsername(
  db: any,
  baseName: string,
  kind: 'PERSONAL' | 'BUSINESS' = 'PERSONAL'
): Promise<string> {
  const cleanBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);

  const prefix = cleanBase.length >= 3 ? cleanBase : 'payituser';
  let candidate = `@${prefix}`;

  const col = kind === 'BUSINESS' ? entities.businessTag : entities.username;
  const existing = await db.select().from(entities).where(eq(col, candidate)).limit(1);

  if (existing.length === 0) {
    return candidate;
  }

  // Retry with numeric suffixes
  for (let i = 1; i <= 20; i++) {
    const retryCandidate = `@${prefix}${i}`;
    const match = await db.select().from(entities).where(eq(col, retryCandidate)).limit(1);
    if (match.length === 0) {
      return retryCandidate;
    }
  }

  // Random fallback
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `@${prefix}${randomSuffix}`;
}
