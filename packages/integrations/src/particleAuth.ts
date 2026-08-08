/**
 * Particle Network User Info Types & Helper utilities
 */

export interface ParticleUserInfo {
  email: string;
  particleWalletAddress: string;
  solanaAddress?: string;
  name?: string;
  avatar?: string;
  token?: string;
}

/**
 * Normalizes user info returned by Particle useConnect() hook.
 * Robustly unwraps nested payload structures (userInfo, data, user).
 */
export function formatParticleUserInfo(rawUserInfo: any, provider: string, defaultEmailInput?: string): ParticleUserInfo {
  if (!rawUserInfo) {
    throw new Error("We couldn't complete your sign in. Please try again.");
  }

  // Unwrap nested object wrappers (e.g., rawUserInfo.userInfo, rawUserInfo.data, rawUserInfo.user)
  const userInfo = rawUserInfo.userInfo || rawUserInfo.data || rawUserInfo.user || rawUserInfo;

  const evmWallet = Array.isArray(userInfo?.wallets)
    ? userInfo.wallets.find((w: any) => w?.public_address?.startsWith('0x') || w?.chain_name === 'evm_chain')
    : null;

  const solanaWallet = Array.isArray(userInfo?.wallets)
    ? userInfo.wallets.find((w: any) => (w?.public_address && !w.public_address.startsWith('0x')) || w?.chain_name === 'solana')
    : null;

  const walletAddress =
    evmWallet?.public_address ||
    evmWallet?.address ||
    userInfo?.wallets?.[0]?.public_address ||
    userInfo?.wallets?.[0]?.address ||
    userInfo?.walletAddress ||
    userInfo?.tokenPayload?.walletAddress ||
    userInfo?.public_address ||
    rawUserInfo?.wallets?.[0]?.public_address ||
    rawUserInfo?.wallets?.[0]?.address ||
    rawUserInfo?.walletAddress ||
    '';

  const solanaAddress =
    solanaWallet?.public_address ||
    solanaWallet?.address ||
    userInfo?.solanaAddress ||
    rawUserInfo?.solanaAddress ||
    '';

  const token =
    userInfo?.token ||
    userInfo?.uuid ||
    userInfo?.idToken ||
    userInfo?.tokenPayload?.token ||
    userInfo?.signature ||
    rawUserInfo?.token ||
    rawUserInfo?.uuid ||
    '';

  const extractedEmail =
    userInfo?.email ||
    userInfo?.google_email ||
    userInfo?.apple_email ||
    userInfo?.thirdparty_email ||
    rawUserInfo?.email ||
    rawUserInfo?.google_email ||
    defaultEmailInput ||
    '';

  const finalWalletAddress = walletAddress || '';

  const cleanWalletSegment = finalWalletAddress.length > 10 ? finalWalletAddress.slice(2, 10).toLowerCase() : 'account';
  const email = (extractedEmail && extractedEmail.includes('@'))
    ? extractedEmail
    : `user_${provider}_${cleanWalletSegment}@particle-user.com`;

  const rawName = userInfo?.name || userInfo?.phone || userInfo?.nick_name || rawUserInfo?.name;
  const name = rawName || (email.includes('@') ? email.split('@')[0] : 'Authenticated User');

  return {
    email,
    name,
    avatar: userInfo?.avatar || userInfo?.avatar_url || rawUserInfo?.avatar,
    particleWalletAddress: finalWalletAddress,
    solanaAddress,
    token,
  };
}


