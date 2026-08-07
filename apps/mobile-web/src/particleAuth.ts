/**
 * Particle Network User Info Types & Helper utilities
 */

export interface ParticleUserInfo {
  email: string;
  particleWalletAddress: string;
  name?: string;
  avatar?: string;
  token?: string;
}

/**
 * Normalizes user info returned by Particle useConnect() hook.
 * Strictly requires valid wallet address and auth token from Particle SDK (C2).
 */
export function formatParticleUserInfo(userInfo: any, provider: string, defaultEmailInput?: string): ParticleUserInfo {
  const walletAddress = userInfo?.wallets?.[0]?.public_address || userInfo?.walletAddress;
  const token = userInfo?.token || userInfo?.uuid;

  if (!walletAddress) {
    throw new Error('Particle Network authentication failed: No valid wallet address returned from provider.');
  }

  if (!token) {
    throw new Error('Particle Network authentication failed: Missing session authentication token.');
  }

  const email = userInfo?.email || defaultEmailInput || `user_${provider}_${walletAddress.slice(2, 10).toLowerCase()}@particle-user.com`;

  return {
    email,
    name: userInfo?.name || userInfo?.phone || email.split('@')[0] || 'Authenticated User',
    avatar: userInfo?.avatar,
    particleWalletAddress: walletAddress,
    token,
  };
}
