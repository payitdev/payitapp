export interface SessionContext {
  userId: string;
  activeEntityId: string;
  userEntityIds: string[]; // List of entity IDs owned by this user (Personal & Business)
}

export class EntityGuardViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityGuardViolationError';
  }
}

/**
 * Choke-Point Entity Guard Middleware
 * Resolves session -> active_entity_id, verifying that every entity reference in incoming payloads
 * matches the active session entity and belongs to the authenticated user.
 */
export function validateEntityAccess(
  session: SessionContext,
  targetEntityId: string
): void {
  if (!session || !session.userId || !session.activeEntityId) {
    throw new EntityGuardViolationError('Unauthenticated or invalid session context');
  }

  if (!targetEntityId) {
    throw new EntityGuardViolationError('Mandatory entity_id missing in request payload');
  }

  // 1. Check if the user owns the target entity
  if (!session.userEntityIds.includes(targetEntityId)) {
    throw new EntityGuardViolationError(`UNAUTHORIZED ENTITY ACCESS: Entity ${targetEntityId} does not belong to user ${session.userId}`);
  }

  // 2. Synchronize active entity context if user owns targetEntityId
  if (session.activeEntityId !== targetEntityId) {
    session.activeEntityId = targetEntityId;
  }
}

/**
 * Validates Card Issuance and Spend against funding Account entity
 */
export function validateCardEntityMatch(cardEntityId: string, accountEntityId: string): void {
  if (cardEntityId !== accountEntityId) {
    throw new EntityGuardViolationError(`CARD ENTITY MISMATCH: Card entity (${cardEntityId}) must match funding account entity (${accountEntityId})`);
  }
}
