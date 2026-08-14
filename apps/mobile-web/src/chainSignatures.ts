/**
 * Chain Signatures Address Derivation for PayIT
 * 
 * IMPORTANT ARCHITECTURE NOTE:
 * NEAR Auth users have no private key - MPC derives their key on demand from a fresh Auth0 JWT.
 * The chainsig.js library requires a real NEAR_PRIVATE_KEY to call the MPC contract.
 * These two facts are incompatible.
 * 
 * SOLUTION: PayIT uses its own separate, PayIT-controlled NEAR relayer account as the calling
 * account for all chain-signature derivations. We derive a unique, deterministic address per
 * user per account-context (Personal/Business) via the path parameter.
 * 
 * NEAR Auth's job: verify the logged-in user before PayIT's backend triggers a derivation/sign.
 */

import { chainAdapters, contracts } from "chainsig.js";
import { KeyPair, type KeyPairString } from "@near-js/crypto";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Environment variables for PayIT's relayer account
// These should be set in the backend, not frontend
const RELAYER_ACCOUNT_ID = process.env.NEAR_RELAYER_ACCOUNT_ID || "";
const RELAYER_PRIVATE_KEY = process.env.NEAR_RELAYER_PRIVATE_KEY as KeyPairString;

// Contract IDs (testnet for now)
const NETWORK_ID = "testnet";
const CONTRACT_ID = "v1.signer-prod.testnet"; // mainnet: "v1.signer"

/**
 * Build derivation path for a user and context
 * Format: payit-{context}-{userIdentifier}
 * 
 * @param userIdentifier - Unique user identifier (e.g., userId, email, or nuvionEntityId)
 * @param context - "personal" or "business"
 * @returns derivation path string
 */
export function buildDerivationPath(userIdentifier: string, context: "personal" | "business"): string {
  return `payit-${context}-${userIdentifier}`;
}

/**
 * Initialize the Chain Signature Contract with PayIT's relayer account
 * This should be called from the backend, not frontend
 */
export function initializeChainSignatureContract() {
  if (!RELAYER_ACCOUNT_ID || !RELAYER_PRIVATE_KEY) {
    throw new Error(
      "NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY must be set in environment"
    );
  }

  const keypair = KeyPair.fromString(RELAYER_PRIVATE_KEY);

  const contract = new contracts.near.ChainSignatureContract({
    networkId: NETWORK_ID,
    contractId: CONTRACT_ID,
    accountId: RELAYER_ACCOUNT_ID,
    keypair,
  });

  return contract;
}

/**
 * Derive a Base address for a user in a specific context
 * 
 * @param userIdentifier - Unique user identifier
 * @param context - "personal" or "business"
 * @returns Object with address, publicKey, and path
 */
export async function deriveUserAddress(
  userIdentifier: string,
  context: "personal" | "business"
) {
  const contract = initializeChainSignatureContract();
  
  // Set up viem public client for Base
  const publicClient = createPublicClient({ 
    chain: base, 
    transport: http() 
  });
  
  const evmChain = new chainAdapters.evm.EVM({ publicClient, contract });
  
  const path = buildDerivationPath(userIdentifier, context);
  
  // Derive address and public key using PayIT's relayer account + user-specific path
  const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
    RELAYER_ACCOUNT_ID,
    path
  );
  
  return { address, publicKey, path };
}

/**
 * Check balance of a derived address
 * 
 * @param address - The derived Base address
 * @returns Balance information
 */
export async function checkDerivedAddressBalance(address: string) {
  const contract = initializeChainSignatureContract();
  const publicClient = createPublicClient({ chain: base, transport: http() });
  const evmChain = new chainAdapters.evm.EVM({ publicClient, contract });
  
  const { balance, decimals } = await evmChain.getBalance(address);
  
  return { balance, decimals };
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
