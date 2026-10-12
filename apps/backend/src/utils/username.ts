/**
 * Shared Username & Business Tag Generator Utility
 * Generates unique handles for Personal entities and unique business tags for Business entities.
 */

import crypto from 'crypto';
import { eq } from '@payit/db';
import { entities } from '@payit/db/schema';

/**
 * Sanitizes and generates a unique personal username handle (alphanumeric, no leading '@').
 */
export async function generateUniqueUsername(
  db: any,
  baseName: string
): Promise<string> {
  const cleanBase = baseName
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);

  const prefix = cleanBase.length >= 3 ? cleanBase : 'user';
  let candidate = prefix;

  const existing = await db.select({ id: entities.id }).from(entities).where(eq(entities.username, candidate)).limit(1);
  if (existing.length === 0) {
    return candidate;
  }

  // Retry with numeric suffixes
  for (let i = 1; i <= 20; i++) {
    const retryCandidate = `${prefix.slice(0, 16)}${i}`;
    const match = await db.select({ id: entities.id }).from(entities).where(eq(entities.username, retryCandidate)).limit(1);
    if (match.length === 0) {
      return retryCandidate;
    }
  }

  // Random fallback
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix.slice(0, 15)}${randomSuffix}`;
}

/**
 * Sanitizes and generates a unique business tag (uppercase alphanumeric, max 6-8 chars, no leading '@').
 */
export async function generateUniqueBusinessTag(
  db: any,
  baseName: string
): Promise<string> {
  const cleanBase = baseName
    .toUpperCase()
    .replace(/^@+/, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

  const prefix = cleanBase.length >= 2 ? cleanBase : 'BIZ';
  let candidate = prefix;

  const existing = await db.select({ id: entities.id }).from(entities).where(eq(entities.businessTag, candidate)).limit(1);
  if (existing.length === 0) {
    return candidate;
  }

  // Retry with numeric suffixes: e.g. IGBO1, IGBO2, ...
  const trimmed = prefix.slice(0, 5);
  for (let i = 1; i <= 9; i++) {
    const retryCandidate = `${trimmed}${i}`;
    const match = await db.select({ id: entities.id }).from(entities).where(eq(entities.businessTag, retryCandidate)).limit(1);
    if (match.length === 0) {
      return retryCandidate;
    }
  }

  // Random fallback with 3 hex chars
  for (let i = 0; i < 10; i++) {
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 3);
    const retryCandidate = `${prefix.slice(0, 4)}${rand}`;
    const match = await db.select({ id: entities.id }).from(entities).where(eq(entities.businessTag, retryCandidate)).limit(1);
    if (match.length === 0) {
      return retryCandidate;
    }
  }

  return `BZ${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
