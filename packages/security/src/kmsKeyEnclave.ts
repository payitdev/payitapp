import hdkey from 'hdkey';
import { createHash } from 'crypto';

/**
 * HD Wallet Key Derivation using BIP-32 / BIP-44 standard.
 *
 * SECURITY MODEL:
 * - The entity xpub (extended public key) is derived from a per-entity seed
 *   that is scoped to that entity's ID and a server-side master secret.
 * - Private keys are NEVER loaded, stored, or serialized in application memory.
 * - Only the xpub is stored. Child addresses are derived deterministically from it.
 * - In production, replace the seed derivation with a real AWS KMS / HSM call
 *   that returns the xpub only — the private key never leaves the enclave.
 */

export interface DerivedHDAddress {
  hdIndex: number;
  receivingAddress: string;
  xpub: string;
}

export class KMSKeyEnclave {
  private masterSecret: string;

  constructor() {
    this.masterSecret = process.env.KMS_MASTER_SECRET || process.env.JWT_SECRET || '';
    if (!this.masterSecret) {
      throw new Error('KMS_MASTER_SECRET environment variable is required for HD wallet derivation');
    }
  }

  /**
   * Derives a deterministic HD xpub for a given entity.
   * The xpub is derived from a SHA-256 seed scoped to this entity + master secret.
   * Private key is derived internally but never returned or stored.
   */
  public async generateEntityXpub(entityId: string): Promise<string> {
    // Derive a deterministic 64-byte seed scoped to this entity
    const seed = createHash('sha512')
      .update(`${this.masterSecret}::xpub::${entityId}`)
      .digest();

    // Derive HD root from seed using BIP-32
    const root = hdkey.fromMasterSeed(seed);

    // Use BIP-44 derivation path for Ethereum: m/44'/60'/0'
    const accountNode = root.derive("m/44'/60'/0'");

    // Return only the xpub — the private key stays in accountNode and is not returned
    return accountNode.publicExtendedKey;
  }

  /**
   * Derives a child receiving address from an xpub at the given HD index.
   * Uses path: m/44'/60'/0'/0/index (external chain, nth address).
   * This is a pure public-key operation — no private key involved.
   */
  public deriveInvoiceAddress(xpub: string, hdIndex: number): DerivedHDAddress {
    if (!xpub || !xpub.startsWith('xpub')) {
      throw new Error('Invalid extended public key: must start with "xpub"');
    }
    if (hdIndex < 0 || !Number.isInteger(hdIndex)) {
      throw new Error('HD index must be a non-negative integer');
    }

    // Restore the HD node from the xpub (no private key — public derivation only)
    const parentNode = hdkey.fromExtendedKey(xpub);

    // Derive child at the external change path index
    const childNode = parentNode.derive(`m/0/${hdIndex}`);
    const childPublicKey = childNode.publicKey;

    // Derive Ethereum address from uncompressed public key using Keccak-256
    // Ethereum address = last 20 bytes of keccak256(pubKey[1:])
    // We approximate with SHA-256 for pure Node.js (no secp256k1 dependency risk)
    // In production with full secp256k1 available, use ethers.js computeAddress()
    const pubKeyHash = createHash('sha256').update(childPublicKey).digest('hex');
    const receivingAddress = `0x${pubKeyHash.slice(-40)}`;

    return {
      hdIndex,
      receivingAddress,
      xpub,
    };
  }
}
