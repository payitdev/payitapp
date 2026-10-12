/**
 * Privy Server Auth Verification Service
 * 
 * Verifies Privy JWT Bearer authentication tokens on the backend
 * Implements Privy's official security guidelines for server-side verification
 */

import { PrivyClient } from '@privy-io/server-auth';

export class PrivyServerAuth {
  private static clientInstance: any = null;
  private static async getClient() {
    const appId = process.env.PRIVY_APP_ID || '';
    const appSecret = process.env.PRIVY_APP_SECRET || '';
    if (!PrivyServerAuth.clientInstance) {
      if (!appId || !appSecret) throw new Error('Privy server credentials are not configured');
      const mod = await import('@privy-io/server-auth');
      PrivyServerAuth.clientInstance = new mod.PrivyClient(appId, appSecret);
    }
    return { appId, client: PrivyServerAuth.clientInstance };
  }

  /**
   * Verify an incoming Privy JWT session token
   * Validates claims, expiration, and issuer per Privy Security Guidelines
   */
  static async verifySessionToken(token: string): Promise<{ valid: boolean; privyUserId?: string; error?: string }> {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Missing or invalid token string' };
    }

    try {
      const { appId, client } = await PrivyServerAuth.getClient();
      if (!appId || !process.env.PRIVY_APP_SECRET) {
        return { valid: false, error: 'Privy server credentials are not configured' };
      }
      const claims = await client.verifyAuthToken(token);
      return { valid: true, privyUserId: claims.userId };
    } catch (err: any) {
      return { valid: false, error: `JWT verification failed: ${err.message}` };
    }
  }

  static async getVerifiedIdentity(token: string): Promise<{ valid: boolean; privyUserId?: string; email?: string; error?: string }> {
    const verified = await PrivyServerAuth.verifySessionToken(token);
    if (!verified.valid || !verified.privyUserId) return verified;
    try {
      const { client } = await PrivyServerAuth.getClient();
      const user = await (client as any).getUser(verified.privyUserId);
      const email = user?.email?.address ||
        user?.google?.email ||
        user?.apple?.email ||
        user?.github?.email ||
        user?.discord?.email ||
        user?.linkedAccounts?.find((account: any) => account.type === 'email')?.address ||
        user?.linkedAccounts?.find((account: any) => account.type === 'google_oauth' || account.type === 'google')?.email ||
        user?.linkedAccounts?.find((account: any) => account.type === 'apple_oauth' || account.type === 'apple')?.email ||
        user?.linkedAccounts?.find((account: any) => account.type === 'github_oauth' || account.type === 'github')?.email ||
        user?.linkedAccounts?.find((account: any) => account.type === 'discord_oauth' || account.type === 'discord')?.email ||
        user?.linkedAccounts?.find((account: any) => account.email)?.email ||
        user?.linkedAccounts?.find((account: any) => typeof account.address === 'string' && account.address.includes('@'))?.address;

      if (email) {
        return { valid: true, privyUserId: verified.privyUserId, email: String(email).toLowerCase().trim() };
      }

      // If no direct email address found, derive a fallback identity email based on phone, wallet, or privy ID
      const phone = user?.phone?.number || user?.linkedAccounts?.find((a: any) => a.type === 'phone')?.number;
      if (phone) {
        const cleanPhone = String(phone).replace(/[^0-9]/g, '');
        return { valid: true, privyUserId: verified.privyUserId, email: `${cleanPhone}@phone.proxim.app` };
      }

      const wallet = user?.wallet?.address || user?.linkedAccounts?.find((a: any) => a.type === 'wallet')?.address;
      if (wallet) {
        return { valid: true, privyUserId: verified.privyUserId, email: `${String(wallet).toLowerCase()}@wallet.proxim.app` };
      }

      // Deterministic fallback using the verified Privy user ID
      const sanitizedPrivyId = verified.privyUserId.replace(/^did:privy:/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (sanitizedPrivyId) {
        return { valid: true, privyUserId: verified.privyUserId, email: `${sanitizedPrivyId}@privy.proxim.app` };
      }

      return { valid: false, error: 'Privy account identity could not be resolved' };
    } catch (err: any) {
      return { valid: false, error: `Privy user lookup failed: ${err.message}` };
    }
  }
}
