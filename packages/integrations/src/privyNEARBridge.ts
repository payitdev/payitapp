/**
 * Privy-NEAR Bridge Service
 * 
 * Bridges Privy authentication with NEAR Chain Signatures for MPC signing
 * Allows users to login via Privy social auth while using NEAR MPC for crypto operations
 */

import { buildDerivationPath, deriveUserAddress, signAndSubmitTransaction } from './chainSignaturesBackend.js';

/**
 * Bridge Privy user ID to NEAR Chain Signatures
 * Uses Privy user ID as the identifier for NEAR MPC address derivation
 */
export class PrivyNEARBridge {
  /**
   * Derive multi-chain EVM, Solana, and BTC addresses for a Privy user using NEAR Chain Signatures
   * This creates deterministic addresses based on the Privy user ID and context (personal/business)
   */
  static async deriveAddress(privyUserId: string, context: 'personal' | 'business' = 'personal', email?: string) {
    try {
      const userIdentifier = `privy-${privyUserId}`;
      const result = await deriveUserAddress(userIdentifier, context, email);
      
      return {
        address: result.address,
        evmAddress: result.evmAddress || result.address,
        solanaAddress: result.solanaAddress || '',
        btcAddress: result.btcAddress || '',
        tronAddress: result.tronAddress || '',
        tonAddress: result.tonAddress || '',
        cosmosAddress: result.cosmosAddress || '',
        suiAddress: result.suiAddress || '',
        aptosAddress: result.aptosAddress || '',
        xrpAddress: result.xrpAddress || '',
        nearDepositAddress: result.nearNamedAddress || '',
        nearNamedAddress: result.nearNamedAddress || '',
        publicKey: result.publicKey,
        path: result.path,
        userIdentifier,
        context,
      };
    } catch (error: any) {
      console.error('Failed to derive multi-chain addresses from Privy user ID:', error);
      throw new Error(`Address derivation failed: ${error.message}`);
    }
  }

  /**
   * Sign transaction using NEAR MPC for a Privy user
   * Bridges Privy authentication with NEAR Chain Signatures
   */
  static async signTransaction(params: {
    privyUserId: string;
    context: 'personal' | 'business';
    bytecode: Array<{ to: string; data: string; value: string; chainId: number }>;
    targetChain?: 'base' | 'bsc';
  }) {
    try {
      // Use Privy user ID as the identifier for NEAR MPC signing
      const userIdentifier = `privy-${params.privyUserId}`;
      
      const results = await signAndSubmitTransaction({
        userIdentifier,
        context: params.context,
        bytecode: params.bytecode,
        targetChain: params.targetChain,
      });
      
      return results;
    } catch (error: any) {
      console.error('Failed to sign transaction for Privy user:', error);
      throw new Error(`Transaction signing failed: ${error.message}`);
    }
  }

  /**
   * Get the derivation path for a Privy user
   * Useful for storing in database for future reference
   */
  static getDerivationPath(privyUserId: string, context: 'personal' | 'business' = 'personal'): string {
    return buildDerivationPath(`privy-${privyUserId}`, context);
  }

  /**
   * Compare Privy wallet address with NEAR MPC derived address
   * Useful for validation and debugging
   */
  static async compareAddresses(privyUserId: string, privyWalletAddress: string, context: 'personal' | 'business' = 'personal') {
    try {
      const { address: mpcAddress, solanaAddress, btcAddress } = await this.deriveAddress(privyUserId, context);
      
      return {
        privyWalletAddress: privyWalletAddress.toLowerCase(),
        mpcDerivedAddress: mpcAddress.toLowerCase(),
        mpcSolanaAddress: solanaAddress,
        mpcBtcAddress: btcAddress,
        match: privyWalletAddress.toLowerCase() === mpcAddress.toLowerCase(),
      };
    } catch (error: any) {
      console.error('Failed to compare addresses:', error);
      throw new Error(`Address comparison failed: ${error.message}`);
    }
  }
}

/**
 * Configuration for Privy-NEAR integration
 */
export interface PrivyNEARConfig {
  privyUserId: string;
  privyWalletAddress?: string;
  context: 'personal' | 'business';
}

/**
 * Helper function to set up Privy-NEAR integration for a user
 */
export async function setupPrivyNEARIntegration(config: PrivyNEARConfig) {
  try {
    const derivation = await PrivyNEARBridge.deriveAddress(config.privyUserId, config.context);
    
    let addressMatch = false;
    if (config.privyWalletAddress) {
      const comparison = await PrivyNEARBridge.compareAddresses(
        config.privyUserId,
        config.privyWalletAddress,
        config.context
      );
      addressMatch = comparison.match;
    }
    
    return {
      mpcAddress: derivation.address,
      evmAddress: derivation.evmAddress,
      solanaAddress: derivation.solanaAddress,
      btcAddress: derivation.btcAddress,
      derivationPath: derivation.path,
      privyWalletAddress: config.privyWalletAddress,
      addressMatch,
      // Canonical NEAR MPC derived EVM deposit address for non-custodial settlement
      recommendedAddress: derivation.evmAddress,
    };
  } catch (error: any) {
    console.error('Failed to set up Privy-NEAR integration:', error);
    throw new Error(`Integration setup failed: ${error.message}`);
  }
}