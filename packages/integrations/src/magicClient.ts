import { Magic } from '@magic-sdk/admin';
import jwt from 'jsonwebtoken';

export interface MagicUserSession {
  email: string;
  issuer: string;
  publicAddress: string;
}

/**
 * Production Magic Link client.
 * Validates DID tokens using the Magic Admin SDK against the live Magic secret key.
 * Never simulates or mocks the validation.
 */
export class MagicClient {
  private magic: Magic;
  private jwtSecret: string;

  constructor() {
    const secretKey = process.env.MAGIC_SECRET_KEY;
    if (!secretKey) {
      throw new Error('MAGIC_SECRET_KEY environment variable is required');
    }
    this.magic = new Magic(secretKey);
    this.jwtSecret = process.env.JWT_SECRET || '';
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Validates a DID token from the Magic Link SDK client.
   * Calls the live Magic API to verify the token is genuine.
   */
  public async validateDidToken(didToken: string): Promise<MagicUserSession> {
    if (!didToken) throw new Error('DID token is required');

    this.magic.token.validate(didToken);
    const metadata = await this.magic.users.getMetadataByToken(didToken);

    if (!metadata.email || !metadata.issuer || !metadata.publicAddress) {
      throw new Error('Incomplete user metadata returned from Magic');
    }

    return {
      email: metadata.email,
      issuer: metadata.issuer,
      publicAddress: metadata.publicAddress,
    };
  }

  public getJwtSecret(): string {
    return this.jwtSecret;
  }

  /**
   * Verifies a PayIT JWT session token.
   */
  public verifySessionToken(token: string): any {
    return jwt.verify(token, this.jwtSecret, {
      issuer: 'payit.co',
      audience: 'payit-app',
    });
  }
}
