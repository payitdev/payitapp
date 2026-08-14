/**
 * NEAR Auth User Info Types & Helper utilities
 * Replaces Particle Network Auth with NEAR Auth (Fast Auth)
 */

export interface NearAuthUserInfo {
  email: string;
  nearPublicKey: string;
  accountId: string;
  name?: string;
  avatar?: string;
  token?: string;
}

/**
 * Normalizes user info returned by NEAR Auth hooks.
 * Extracts user identity from Auth0 JWT claims.
 */
export function formatNearAuthUserInfo(
  user: any,
  publicKey: string,
  accountId: string
): NearAuthUserInfo {
  if (!user) {
    throw new Error("We couldn't complete your sign in. Please try again.");
  }

  // Extract email from Auth0 user info
  const email = user?.email || user?.name || `user_${accountId.slice(0, 8)}@near-auth-user.com`;

  // Extract name from Auth0 user info
  const name = user?.name || user?.nickname || (email.includes('@') ? email.split('@')[0] : 'Authenticated User');

  return {
    email,
    name,
    avatar: user?.picture || user?.avatar,
    nearPublicKey: publicKey,
    accountId,
    token: user?.sub || user?.user_id || '',
  };
}
