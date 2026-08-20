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

import { ethers, JsonRpcProvider } from 'ethers';
import { PublicKey } from '@solana/web3.js';

// Lazy-loaded heavy modules — only imported when first used
let _chainAdapters: any = null;
let _KeyPair: any = null;

async function getChainAdapters() {
  if (!_chainAdapters) {
    const mod = await import('chainsig.js');
    _chainAdapters = mod.chainAdapters;
  }
  return _chainAdapters;
}

async function getNearKeyPair() {
  if (!_KeyPair) {
    const mod = await import('@near-js/crypto');
    _KeyPair = mod.KeyPair;
  }
  return _KeyPair;
}


// Dynamic resolution for PayIT's NEAR relayer account
function getRelayerAccountId(): string {
  return process.env.NEAR_RELAYER_ACCOUNT_ID || '';
}

let relayerKeyCounter = 0;

function getRelayerPrivateKey(): string {
  const keysStr = process.env.NEAR_RELAYER_PRIVATE_KEYS;
  if (keysStr) {
    const keys = keysStr.split(',').map(k => k.trim().replace(/^"/, '').replace(/"$/, '')).filter(Boolean);
    if (keys.length > 0) {
      const selectedKey = keys[relayerKeyCounter % keys.length];
      relayerKeyCounter++;
      return selectedKey;
    }
  }
  return process.env.NEAR_RELAYER_PRIVATE_KEY || '';
}

// Contract IDs based on network
const NETWORK_ID = process.env.NEAR_NETWORK_ID || "mainnet";
const CONTRACT_ID = NETWORK_ID === "mainnet" 
  ? "v1.signer" 
  : "v1.signer-prod.testnet";

// RPC URLs for Base and BSC (supports dedicated RPC overrides)
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-datase.binance.org";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || '';

/**
 * Build derivation path for a user and context
 * Format: proxim-{context}-{userIdentifier}
 */
export function buildDerivationPath(userIdentifier: string, context: "personal" | "business"): string {
  return `proxim-${context}-${userIdentifier}`;
}

/**
 * Initialize the Chain Signature Contract with Proxim's relayer account
 * Using dynamic import to avoid type conflicts
 */
async function getChainSignatureContract() {
  const relayerId = getRelayerAccountId();
  const relayerKey = getRelayerPrivateKey();

  if (!relayerId || !relayerKey) {
    throw new Error(
      "NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY must be set in environment"
    );
  }

  const KeyPair = await getNearKeyPair();
  const keypair = KeyPair.fromString(relayerKey as any);

  // Use lazy-loaded chainAdapters
  const chainsig = await import("chainsig.js");
  const ContractClass = (chainsig as any).contracts?.ChainSignatureContract || (chainsig as any).ChainSignatureContract;
  
  const contract = new ContractClass({
    networkId: NETWORK_ID,
    contractId: CONTRACT_ID,
    accountId: relayerId,
    keypair,
  });

  return contract;
}


/**
 * Derive NEAR Named Address from user email or identifier
 * Format: {cleanHandle}.{relayer} for Personal
 * Format: {cleanHandle}-biz.{relayer} for Business
 */
export function deriveNearNamedAddress(userIdentifier: string, context: "personal" | "business", email?: string): string {
  const baseSource = email ? email.split('@')[0] : userIdentifier.replace(/^privy-/, '');
  const cleanHandle = baseSource.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'user';
  const parentAccount = getRelayerAccountId();
  if (!parentAccount) throw new Error('NEAR_RELAYER_ACCOUNT_ID is required to derive a named account');
  const suffix = parentAccount.endsWith('.near') ? parentAccount : `${parentAccount}.near`;
  
  if (context === 'business') {
    return `${cleanHandle}-biz.${suffix}`;
  }
  return `${cleanHandle}.${suffix}`;
}

export const CHAIN_MAINNET_RPC_POOLS = {
  near: [
    process.env.NEAR_RPC_URL,
    'https://rpc.mainnet.near.org',
    'https://rpc.intea.rs',
    'https://archival-rpc.mainnet.near.org',
    'https://near.lava.build',
  ].filter(Boolean) as string[],

  base: [
    process.env.BASE_RPC_URL,
    'https://mainnet.base.org',
    'https://developer-access-mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.meowrpc.com',
    'https://1rpc.io/base',
  ].filter(Boolean) as string[],

  bsc: [
    process.env.BSC_RPC_URL,
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed1.ninicoin.io',
    'https://bsc.meowrpc.com',
    'https://1rpc.io/bnb',
  ].filter(Boolean) as string[],

  solana: [
    process.env.SOLANA_RPC_URL,
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com',
    'https://solana.drpc.org',
  ].filter(Boolean) as string[],

  ethereum: [
    process.env.ETH_RPC_URL,
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum-rpc.publicnode.com',
    'https://1rpc.io/eth',
  ].filter(Boolean) as string[],

  sui: [
    process.env.SUI_RPC_URL,
    'https://fullnode.mainnet.sui.io',
    'https://sui-mainnet-rpc.allthatnode.com',
  ].filter(Boolean) as string[],

  aptos: [
    process.env.APTOS_RPC_URL,
    'https://fullnode.mainnet.aptoslabs.com/v1',
    'https://rpc.mainnet.aptos.gateway.fm',
  ].filter(Boolean) as string[],

  ton: [
    process.env.TON_RPC_URL,
    'https://toncenter.com/api/v2/jsonRPC',
    'https://ton-mainnet.rpc.groove.tech',
  ].filter(Boolean) as string[],

  cosmos: [
    process.env.COSMOS_RPC_URL,
    'https://rpc.cosmos.network',
    'https://cosmos-rpc.publicnode.com',
  ].filter(Boolean) as string[],

  tron: [
    process.env.TRON_RPC_URL,
    'https://api.trongrid.io',
    'https://api.tronstack.org',
  ].filter(Boolean) as string[],

  xrp: [
    process.env.XRP_RPC_URL,
    'https://s1.ripple.com:51234',
    'https://xrplcluster.com',
  ].filter(Boolean) as string[],
};

const TESTNET_NEAR_RPCS = [
  process.env.NEAR_RPC_URL,
  'https://archival-rpc.testnet.near.org',
  'https://rpc.testnet.near.org',
].filter(Boolean) as string[];

export async function getNearProvider(): Promise<{ provider: any; rpcUrl: string }> {
  const nearApi: any = await import('near-api-js');
  const { JsonRpcProvider } = nearApi;

  const rpcList = NETWORK_ID === 'mainnet' ? CHAIN_MAINNET_RPC_POOLS.near : TESTNET_NEAR_RPCS;

  for (const rpcUrl of rpcList) {
    try {
      const provider = new JsonRpcProvider({ url: rpcUrl });
      await provider.viewAccount({ accountId: getRelayerAccountId() || 'proximfi.near' });
      return { provider, rpcUrl };
    } catch (err: any) {
      console.warn(`[NEAR RPC Failover] RPC ${rpcUrl} unavailable or rate-limited (${err.message}). Trying fallback...`);
    }
  }

  const defaultUrl = rpcList[0] || 'https://rpc.mainnet.near.org';
  return { provider: new JsonRpcProvider({ url: defaultUrl }), rpcUrl: defaultUrl };
}

/**
 * Register and verify a NEAR named account on-chain via the relayer.
 */
export async function registerNearAccountOnChain(newAccountId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const relayerId = getRelayerAccountId();
  const relayerKey = getRelayerPrivateKey();

  if (!relayerId || !relayerKey) {
    console.warn(`[NEAR Relayer] Account or key not configured in .env. Skipping on-chain transaction for ${newAccountId}`);
    return { success: false, error: 'Relayer credentials not set' };
  }

  try {
    const nearApi: any = await import('near-api-js');
    const { Account, KeyPair } = nearApi;

    const { provider, rpcUrl } = await getNearProvider();
    console.log(`🌐 [NEAR RPC] Connected to ${rpcUrl} for account registration`);
    const masterAccount = new Account(relayerId, rpcUrl, relayerKey);

    try {
      const existingAccount = await provider.viewAccount({ accountId: newAccountId });
      if (existingAccount && (existingAccount.amount !== undefined || existingAccount.storage_usage !== undefined)) {
        console.log(`ℹ️ [NEAR Blockchain] Account ${newAccountId} already exists on-chain.`);
        return { success: true };
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (!msg.includes('does not exist') && !msg.includes('UNKNOWN_ACCOUNT') && !msg.includes('AccountNotFound')) {
        // Some RPC error, continue attempt
      }
    }

    const newKeyPair = KeyPair.fromRandom('ed25519');

    console.log(`🚀 [NEAR Blockchain] Registering on-chain account: ${newAccountId} via ${relayerId}...`);

    let txHash: string | undefined;
    try {
      const result = await masterAccount.createSubAccount({
        accountOrPrefix: newAccountId,
        publicKey: newKeyPair.getPublicKey(),
        nearToTransfer: BigInt(5e22), // 0.05 NEAR storage rent
      });
      txHash = result.transaction?.hash || result.transaction_outcome?.id || (result as any).status?.SuccessValue || result.receipts_outcome?.[0]?.id;
    } catch (err: any) {
      if (err.message?.includes('already exists') || err.message?.includes('AccountAlreadyExists')) {
        console.log(`ℹ️ [NEAR Blockchain] Account ${newAccountId} already registered on-chain.`);
        return { success: true };
      }
      throw err;
    }

    const account = await provider.viewAccount({ accountId: newAccountId });
    if (!account || account.amount === undefined) {
      throw new Error(`NEAR account ${newAccountId} was not found at finality`);
    }

    console.log(`✅ [NEAR Blockchain VERIFIED] Account ${newAccountId} exists on ${NETWORK_ID}.`);
    return { success: true, txHash };
  } catch (err: any) {
    console.warn(`⚠️ [NEAR Blockchain] Account registration note for ${newAccountId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Derive multi-chain addresses deterministically from a user identifier + context.
 * 
 * Strategy (in order):
 *   1. Try live NEAR MPC derivation via chainsig.js (requires funded relayer).
 *   2. If MPC is unavailable, fall back to deterministic ethers HD-wallet derivation.
 *      This produces real, stable EVM/Solana addresses from a hash of the user ID.
 * 
 * NEAR on-chain account registration is always non-blocking (fire-and-forget).
 */
export async function deriveUserAddresses(
  userIdentifier: string,
  context: "personal" | "business",
  email?: string
) {
  const path = buildDerivationPath(userIdentifier, context);
  const nearNamedAddress = deriveNearNamedAddress(userIdentifier, context, email);

  // Register on-chain as fire-and-forget — never blocks login
  setImmediate(() => {
    registerNearAccountOnChain(nearNamedAddress).catch(e =>
      console.warn(`[NEAR Registration background] ${nearNamedAddress}:`, e.message)
    );
  });

  const relayerId = getRelayerAccountId();
  const relayerKey = getRelayerPrivateKey();

  // ── Attempt 1: Live NEAR MPC via chainsig.js ──────────────────────────────
  if (relayerId && relayerKey) {
    try {
      const contract = await getChainSignatureContract();
      const provider = new JsonRpcProvider(BASE_RPC_URL);

      const chainAdapters = await getChainAdapters();
      const evmChain = new chainAdapters.evm.EVM({
        publicClient: provider as any,
        contract
      });

      const { address: evmAddress, publicKey } = await evmChain.deriveAddressAndPublicKey(
        relayerId,
        path
      );

      let solanaAddress = '';
      try {
        if (chainAdapters?.solana?.Solana) {
          const solanaChain = new chainAdapters.solana.Solana({ contract } as any);
          const derivedSol = await solanaChain.deriveAddressAndPublicKey(relayerId, path);
          solanaAddress = derivedSol.address || '';
        }
      } catch (solErr: any) {
        console.warn(`[NEAR MPC] Solana derivation note: ${solErr.message}`);
      }

      let btcAddress = '';
      try {
        const btcAdapter = chainAdapters?.btc;
        const BtcClass = btcAdapter?.Bitcoin || btcAdapter?.BTC;
        if (BtcClass) {
          const MempoolClass = btcAdapter?.Mempool;
          const btcRpcAdapter = MempoolClass ? new MempoolClass({ network: 'mainnet' }) : undefined;
          const btcChain = new BtcClass({ network: 'mainnet', contract, btcRpcAdapter } as any);
          const derivedBtc = await btcChain.deriveAddressAndPublicKey(relayerId, path);
          btcAddress = derivedBtc.address || '';
        }
      } catch (btcErr: any) {
        console.warn(`[NEAR MPC] BTC derivation note: ${btcErr.message}`);
      }

      console.log(`[NEAR MPC] ✅ Live MPC derivation succeeded for ${userIdentifier} (${context}): ${evmAddress}`);
      return {
        address: evmAddress, evmAddress, solanaAddress, btcAddress,
        tronAddress: '', tonAddress: '', cosmosAddress: '',
        suiAddress: '', aptosAddress: '', xrpAddress: '',
        nearAddress: nearNamedAddress, nearNamedAddress, publicKey, path,
      };
    } catch (mpcError: any) {
      console.warn(`[NEAR MPC] Live MPC unavailable, using deterministic fallback: ${mpcError.message}`);
    }
  } else {
    console.warn('[NEAR MPC] Relayer credentials not configured — using deterministic fallback.');
  }

  // ── Fallback: Deterministic HD-wallet derivation via ethers ───────────────
  // Derives stable, real addresses from a hash of the Proxim-scoped path.
  // Addresses are always the same for the same user+context combination.
  try {
    const crypto = await import('crypto');
    const seed = crypto.createHmac('sha256', 'proxim-v1-address-derivation')
      .update(`${userIdentifier}:${context}`)
      .digest();

    // EVM — derive from seed as a private key (ethers v6 requires hex string)
    const evmWallet = new ethers.Wallet('0x' + seed.toString('hex'));
    const evmAddress = evmWallet.address;

    // Solana — use the same seed to generate a Solana public key
    let solanaAddress = '';
    try {
      const solanaSeed = crypto.createHmac('sha256', 'proxim-v1-solana')
        .update(`${userIdentifier}:${context}`)
        .digest();
      const solPubKey = new PublicKey(solanaSeed);
      solanaAddress = solPubKey.toBase58();
    } catch { /* solana optional */ }

    console.log(`[Proxim HD] ✅ Deterministic fallback addresses derived for ${userIdentifier} (${context}): EVM=${evmAddress}, SOL=${solanaAddress}`);

    return {
      address: evmAddress, evmAddress, solanaAddress, btcAddress: '',
      tronAddress: '', tonAddress: '', cosmosAddress: '',
      suiAddress: '', aptosAddress: '', xrpAddress: '',
      nearAddress: nearNamedAddress, nearNamedAddress,
      publicKey: evmWallet.signingKey.publicKey, path,
    };
  } catch (fallbackError: any) {
    throw new Error(`Address derivation failed (both MPC and fallback): ${fallbackError.message}`);
  }
}


const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(buffer: Uint8Array): string {
  let carry = 0;
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result += BASE58_ALPHABET[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

/**
 * Backward compatible alias for deriveUserAddresses
 */
export const deriveUserAddress = deriveUserAddresses;

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
  
  const chainAdapters = await getChainAdapters();
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

export async function signAndSubmitSolanaTransaction(params: {
  userIdentifier: string;
  context: 'personal' | 'business';
  to: string;
  amount: bigint;
  instructions: Array<{
    programAddress: string;
    data?: string | null;
    accounts: Array<{ address: string; role: string; signer?: { address: string } }>;
  }>;
}) {
  if (!SOLANA_RPC_URL) throw new Error('SOLANA_RPC_URL is required for Solana transactions');

  const contract = await getChainSignatureContract();
  const { Connection: SolConnection, Transaction: SolTransaction, TransactionInstruction: SolTxInstruction } = await import('@solana/web3.js');
  const chainAdapters = await getChainAdapters();
  const connection = new SolConnection(SOLANA_RPC_URL, 'confirmed');
  const solanaChain = new chainAdapters.solana.Solana({
    solanaConnection: connection,
    contract,
  });
  const path = buildDerivationPath(params.userIdentifier, params.context);
  const derived = await solanaChain.deriveAddressAndPublicKey(getRelayerAccountId(), path);
  const sender = new PublicKey(derived.address);
  const destination = new PublicKey(params.to);

  if (params.instructions.length === 0) throw new Error('Solana transaction has no instructions');

  const instructions = params.instructions.map((instruction) => new SolTxInstruction({
    programId: new PublicKey(instruction.programAddress),
    data: instruction.data ? Buffer.from(instruction.data, 'base64') : Buffer.alloc(0),
    keys: instruction.accounts.map((account) => ({
      pubkey: new PublicKey(account.address),
      isSigner: account.role.includes('SIGNER') || account.signer?.address === sender.toBase58(),
      isWritable: account.role.includes('WRITABLE'),
    })),
  }));

  const transaction = new SolTransaction();
  transaction.feePayer = sender;
  transaction.add(...instructions);
  const prepared = await solanaChain.prepareTransactionForSigning({
    from: sender.toBase58(),
    to: destination.toBase58(),
    amount: params.amount,
    feePayer: sender,
    instructions,
  });

  const signature = await contract.sign({
    payload: prepared.hashesToSign[0],
    path,
    key_version: 0,
  });

  const serialized = solanaChain.finalizeTransactionSigning({
    transaction: prepared.transaction.transaction,
    rsvSignatures: signature,
    senderAddress: sender.toBase58(),
  });
  const result = await solanaChain.broadcastTx(serialized);

  return {
    txHash: result.hash,
    senderAddress: sender.toBase58(),
    path,
  };
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
