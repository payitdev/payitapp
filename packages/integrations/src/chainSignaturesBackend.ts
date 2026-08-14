/**
 * Chain Signatures Backend Integration for PayIT
 * 
 * Backend version of chain signatures for Pods integration
 * Uses PayIT's NEAR relayer account for MPC signing on Base and BSC
 * 
 * ⚠️ EIP-7702 LIMITATION: Waiting for chainsig.js EIP-7702 support per user decision
 * Current implementation uses individual transaction signing (non-atomic) via ethers.js
 * Atomic batching will be implemented when chainsig.js adds EIP-7702 support
 */

import { chainAdapters } from "chainsig.js";
import { KeyPair, type KeyPairString } from "@near-js/crypto";
import { ethers, JsonRpcProvider } from 'ethers';

// Environment variables for PayIT's relayer account
const RELAYER_ACCOUNT_ID = process.env.NEAR_RELAYER_ACCOUNT_ID || "";
const RELAYER_PRIVATE_KEY = process.env.NEAR_RELAYER_PRIVATE_KEY as KeyPairString;

// Contract IDs based on network
const NETWORK_ID = process.env.NEAR_NETWORK_ID || "testnet";
const CONTRACT_ID = NETWORK_ID === "mainnet" 
  ? "v1.signer" 
  : "v1.signer-prod.testnet";

// RPC URLs for Base and BSC
const BASE_RPC_URL = "https://mainnet.base.org";
const BSC_RPC_URL = "https://bsc-datase.binance.org";

// Log configuration on module load
console.log(`🔗 NEAR Chain Signatures Configuration:`);
console.log(`   Network: ${NETWORK_ID}`);
console.log(`   Contract: ${CONTRACT_ID}`);
console.log(`   Relayer Account: ${RELAYER_ACCOUNT_ID ? '✅ Configured' : '❌ Not configured'}`);

/**
 * Build derivation path for a user and context
 * Format: payit-{context}-{userIdentifier}
 */
export function buildDerivationPath(userIdentifier: string, context: "personal" | "business"): string {
  return `payit-${context}-${userIdentifier}`;
}

/**
 * Initialize the Chain Signature Contract with PayIT's relayer account
 * Using dynamic import to avoid type conflicts
 */
async function getChainSignatureContract() {
  if (!RELAYER_ACCOUNT_ID || !RELAYER_PRIVATE_KEY) {
    throw new Error(
      "NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY must be set in environment"
    );
  }

  const keypair = KeyPair.fromString(RELAYER_PRIVATE_KEY);

  // Dynamic import to avoid type issues
  const chainsig = await import("chainsig.js");
  
  // @ts-ignore - chainsig.js type definitions are incomplete
  const contract = new chainsig.ChainSignatureContract({
    networkId: NETWORK_ID,
    contractId: CONTRACT_ID,
    accountId: RELAYER_ACCOUNT_ID,
    keypair,
  });

  return contract;
}

/**
 * Derive a Base address for a user in a specific context
 * Uses chainsig.js for proper NEAR MPC derivation
 */
export async function deriveUserAddress(
  userIdentifier: string,
  context: "personal" | "business"
) {
  const contract = await getChainSignatureContract();
  
  // Set up ethers provider for Base
  const provider = new JsonRpcProvider(BASE_RPC_URL);
  
  const evmChain = new chainAdapters.evm.EVM({ 
    publicClient: provider as any, 
    contract 
  });
  
  const path = buildDerivationPath(userIdentifier, context);
  
  // Derive address and public key using NEAR MPC
  const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
    RELAYER_ACCOUNT_ID,
    path
  );
  
  return { address, publicKey, path };
}

/**
 * Sign and submit individual transactions using chainsig.js with NEAR MPC
 * 
 * ⚠️ INDIVIDUAL SIGNING (Non-Atomic): Does NOT meet Pods' atomic batching requirement
 * Waiting for chainsig.js EIP-7702 support per user decision
 * 
 * This is REAL signing (not simulated) using NEAR MPC with ethers.js
 * Transactions are submitted individually to the blockchain
 */
export async function signAndSubmitTransaction(params: {
  userIdentifier: string;
  context: "personal" | "business";
  bytecode: Array<{ to: string; data: string; value: string; chainId: number }>;
  targetChain?: 'base' | 'bsc';
}) {
  console.log(`🔐 Real NEAR MPC Signing with ethers.js (individual, non-atomic)`);
  console.log(`⚠️  Does NOT meet Pods' atomic batching requirement (EIP-7702 not supported by chainsig.js)`);
  console.log(`📝 Processing ${params.bytecode.length} transaction legs individually`);
  console.log(`🌐 Target chain: ${params.targetChain || 'base'}`);
  
  const contract = await getChainSignatureContract();
  
  // Set up ethers provider for target chain
  const targetChain = params.targetChain === 'bsc' ? BSC_RPC_URL : BASE_RPC_URL;
  const provider = new JsonRpcProvider(targetChain);
  
  const evmChain = new chainAdapters.evm.EVM({ 
    publicClient: provider as any, 
    contract 
  });
  
  const path = buildDerivationPath(params.userIdentifier, params.context);
  
  // First, derive the address to confirm it matches
  const { address } = await deriveUserAddress(params.userIdentifier, params.context);
  
  console.log(`🔐 Signing for derived address: ${address} with path: ${path}`);
  
  const results = [];
  
  // Sign and submit each leg individually using chainsig.js with NEAR MPC
  for (const leg of params.bytecode) {
    try {
      console.log(`📝 Preparing transaction leg for ${leg.to} on chain ${leg.chainId}`);
      
      // Prepare transaction for signing using chainsig.js
      const { transaction, hashesToSign } = await evmChain.prepareTransactionForSigning({
        from: address.toLowerCase() as any,
        to: leg.to.toLowerCase() as any,
        data: leg.data as any,
        value: ethers.parseEther(leg.value || '0'),
      });
      
      console.log(`🔐 Requesting NEAR MPC signature for leg ${leg.to}`);
      
      // Sign with MPC using chainsig.js contract
      const signature = await contract.sign({
        payload: hashesToSign[0],
        path: path,
        key_version: 0,
      });
      
      console.log(`✅ Signature received, finalizing transaction`);
      
      // Finalize transaction using chainsig.js with correct method name
      // @ts-ignore - chainsig.js type definitions are incomplete
      const signedTx = evmChain.finalizeTransactionSigning({
        transaction,
        rsvSignatures: [signature],
      });
      
      console.log(`📡 Broadcasting to ${params.targetChain || 'base'} (chainId ${leg.chainId})`);
      
      // Broadcast to target chain using ethers.js
      const txHash = await provider.broadcastTransaction(signedTx);
      
      console.log(`✅ Leg submitted: ${leg.to} -> txHash: ${txHash}`);
      
      results.push({
        leg: leg.to,
        txHash,
        success: true,
        chain: params.targetChain || 'base',
      });
      
    } catch (error: any) {
      console.error(`❌ Failed to sign/submit leg for ${leg.to}:`, error.message);
      results.push({
        leg: leg.to,
        success: false,
        error: error.message,
        chain: params.targetChain || 'base',
      });
    }
  }
  
  // Check if all legs succeeded
  const allSuccess = results.every(r => r.success);
  if (!allSuccess) {
    console.warn(`⚠️  Some transaction legs failed. Atomicity not guaranteed.`);
  }
  
  return results;
}

/**
 * Type for stored chain signature addresses
 */
export interface ChainSignatureAddress {
  nearRelayerPersonalPath?: string;
  nearRelayerPersonalAddress?: string;
  nearRelayerBusinessPath?: string;
  nearRelayerBusinessAddress?: string;
}
