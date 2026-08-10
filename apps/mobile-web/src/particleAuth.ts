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
export function formatParticleUserInfo(
  rawUserInfo: any,
  provider: string,
  walletAddress: string,
  solanaAddress?: string,
  defaultEmailInput?: string
): ParticleUserInfo {
  if (!rawUserInfo) {
    throw new Error("We couldn't complete your sign in. Please try again.");
  }

  // Unwrap nested object wrappers (e.g., rawUserInfo.userInfo, rawUserInfo.data, rawUserInfo.user)
  const userInfo = rawUserInfo.userInfo || rawUserInfo.data || rawUserInfo.user || rawUserInfo;

  const finalWalletAddress = walletAddress || '';
  const finalSolanaAddress = solanaAddress || '';

  const token = userInfo?.uuid || rawUserInfo?.uuid || '';

  const extractedEmail =
    userInfo?.email ||
    userInfo?.google_email ||
    userInfo?.apple_email ||
    userInfo?.discord_email ||
    userInfo?.facebook_email ||
    userInfo?.github_email ||
    userInfo?.linkedin_email ||
    userInfo?.microsoft_email ||
    userInfo?.twitch_email ||
    userInfo?.twitter_email ||
    userInfo?.thirdparty_user_info?.user_info?.email ||
    rawUserInfo?.email ||
    rawUserInfo?.google_email ||
    defaultEmailInput ||
    '';

  const cleanWalletSegment = finalWalletAddress.length > 10 ? finalWalletAddress.slice(2, 10).toLowerCase() : 'account';
  const email = (extractedEmail && extractedEmail.includes('@'))
    ? extractedEmail
    : `user_${provider}_${cleanWalletSegment}@particle-user.com`;

  const rawName = userInfo?.name || rawUserInfo?.name;
  const name = rawName || (email.includes('@') ? email.split('@')[0] : 'Authenticated User');

  return {
    email,
    name,
    avatar: userInfo?.avatar || rawUserInfo?.avatar,
    particleWalletAddress: finalWalletAddress,
    solanaAddress: finalSolanaAddress,
    token,
  };
}


