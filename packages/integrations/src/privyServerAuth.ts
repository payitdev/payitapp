/**
 * Privy Server Auth Verification Service
 * 
 * Verifies Privy JWT Bearer authentication tokens on the backend
 * Implements Privy's official security guidelines for server-side verification
 */

import { PrivyClient } from '@privy-io/server-auth';

export class PrivyServerAuth {
  private static getClient() {
    const appId = process.env.PRIVY_APP_ID || '';
    const appSecret = process.env.PRIVY_APP_SECRET || '';
    return { appId, client: new PrivyClient(appId, appSecret) };
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
      const { appId, client } = PrivyServerAuth.getClient();
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
      const { client } = PrivyServerAuth.getClient();
      const user = await (client as any).getUser(verified.privyUserId);
      const email = user?.email?.address || user?.linkedAccounts?.find((account: any) => account.type === 'email')?.address;
      if (!email) return { valid: false, error: 'Privy account has no verified email address' };
      return { valid: true, privyUserId: verified.privyUserId, email: String(email).toLowerCase().trim() };
    } catch (err: any) {
      return { valid: false, error: `Privy user lookup failed: ${err.message}` };
    }
  }
}
