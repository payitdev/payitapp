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
 * Normalizes user info returned by Particle useConnect() hook
 */
export function formatParticleUserInfo(userInfo: any, provider: string, defaultEmailInput?: string): ParticleUserInfo {
  const walletAddress = userInfo?.wallets?.[0]?.public_address || userInfo?.walletAddress || '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const email = userInfo?.email || defaultEmailInput || `user_${provider}_${walletAddress.slice(2, 10).toLowerCase()}@particle-user.com`;

  return {
    email,
    name: userInfo?.name || userInfo?.phone || email.split('@')[0] || 'Authenticated User',
    avatar: userInfo?.avatar,
    particleWalletAddress: walletAddress,
    token: userInfo?.token || userInfo?.uuid || `token_${Date.now()}`,
  };
}
