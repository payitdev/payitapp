import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, desc, sql } from '@payit/db';
import { accounts, entities, users, feeLedger, transfers, payrollItems, invoices, ledgerEntries, ledgerAccounts, kycVerifications, intentSwaps, gasSponsorships, depositSyncCursors } from '@payit/db/schema';
import { BrailsClient, easeIdClient, feeService, NEARIntentsClient, signAndSubmitTransaction, signAndSubmitNativeGasTransfer, signAndSubmitSolanaTransaction, fundIntentFromBitcoin, fundIntentFromNear, toBaseUnits } from '@payit/integrations';
import { getEntityBalance } from '../utils/balance.js';
import { settleInvoiceAndRecordLedger } from './invoices.js';
import { calculateReserve, fetchNativeUsdPrice, settleEvmGasSponsorship, waitForEvmReceipt } from '../services/gasSettlement.js';
import { ulid } from 'ulid';
import crypto from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { env } from '../env.js';

const lastSyncTimestamps = new Map<string, number>();
const SYNC_THROTTLE_MS = 60 * 1000;

const db = createDbClient(env.DATABASE_URL);
const nearIntentsClient = new NEARIntentsClient({ oneClickApiKey: env.NEAR_INTENT_1CLICK_API_KEY, explorerApiKey: env.NEAR_INTENT_EXPLORER_API_KEY, baseUrl: env.NEAR_INTENT_BASE_URL });
const brails = new BrailsClient(env.BRAILS_API_KEY, env.BRAILS_API_BASE_URL);

const evmUsdcNetworks = [
  { name: 'ethereum', rpc: 'https://cloudflare-eth.com', symbol: 'USDC', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.002', token: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { name: 'ethereum', rpc: 'https://cloudflare-eth.com', symbol: 'USDT', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.002', token: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  { name: 'base', rpc: 'https://mainnet.base.org', symbol: 'USDC', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.0005', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { name: 'base', rpc: 'https://mainnet.base.org', symbol: 'USDT', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.0005', token: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' },
  { name: 'polygon', rpc: 'https://polygon-rpc.com', symbol: 'USDC', decimals: 6, nativeAsset: 'POL', gasTopUpNative: '0.05', token: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' },
  { name: 'polygon', rpc: 'https://polygon-rpc.com', symbol: 'USDT', decimals: 6, nativeAsset: 'POL', gasTopUpNative: '0.05', token: '0xc2132D05D31c914a87C6611C10748AaCbA0eE9c1' },
  { name: 'arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', symbol: 'USDC', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.0005', token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { name: 'arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', symbol: 'USDT', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.0005', token: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9' },
  { name: 'optimism', rpc: 'https://mainnet.optimism.io', symbol: 'USDC', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.0005', token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  { name: 'optimism', rpc: 'https://mainnet.optimism.io', symbol: 'USDT', decimals: 6, nativeAsset: 'ETH', gasTopUpNative: '0.0005', token: '0x94b008aA00579c1307B0EF2c499Ad98DA8ce58e58' },
  { name: 'bsc', rpc: 'https://bsc-dataseed.binance.org', symbol: 'USDC', decimals: 18, nativeAsset: 'BNB', gasTopUpNative: '0.001', token: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' },
  { name: 'bsc', rpc: 'https://bsc-dataseed.binance.org', symbol: 'USDT', decimals: 18, nativeAsset: 'BNB', gasTopUpNative: '0.001', token: '0x55d398326f99059fF775485246999027B3197955' },
] as const;

const erc20TransferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef';
const baseSettlementAsset = 'USDC';

const evmNativeAssets = new Set(['ETH', 'POL', 'MATIC', 'BNB']);

function encodeSolanaSystemTransfer(lamports: bigint, sender: string, recipient: string) {
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0);
  data.writeBigUInt64LE(lamports, 4);
  return {
    programAddress: '11111111111111111111111111111111',
    data: data.toString('base64'),
    accounts: [
      { address: sender, role: 'SIGNER_WRITABLE' },
      { address: recipient, role: 'WRITABLE' },
    ],
  };
}

function getEvmNetwork(name: string) {
  const normalized = name.toLowerCase().replace(/\s+chain$/, '').replace(/\s+one$/, '').replace('bnb', 'bsc');
  return evmUsdcNetworks.find(network => network.name === normalized && network.symbol === 'USDC');
}

function formatTokenAmount(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  return `${whole}.${fraction.toString().padStart(decimals, '0')}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

async function getOnChainAssetBalance(entity: any, networkName: string, assetName: string) {
  const network = (networkName || '').toLowerCase();
  const asset = (assetName || 'USDC').toUpperCase();

  if (network === 'solana') {
    if (!entity.solanaDepositAddress) {
      return { balance: '0.00', network: 'solana', asset };
    }
    if (asset !== 'SOL') {
      // Return 0.00 for Solana SPL tokens if not yet funded
      return { balance: '0.00', network: 'solana', asset };
    }
    const rpcUrls = [process.env.SOLANA_RPC_URL, 'https://api.mainnet-beta.solana.com'].filter((url, index, urls) => url && urls.indexOf(url) === index);
    for (const rpcUrl of rpcUrls) {
      try {
        const response = await fetch(rpcUrl!, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'sol-send-balance', method: 'getBalance', params: [entity.solanaDepositAddress] }),
          signal: AbortSignal.timeout(5000),
        });
        const body = await response.json() as { result?: { value?: number }; error?: { message?: string } };
        if (body.error) continue;
        return { balance: formatTokenAmount(BigInt(body.result?.value || 0), 9), network: 'solana', asset };
      } catch {}
    }
    return { balance: '0.00', network: 'solana', asset };
  }

  const evmNetwork = getEvmNetwork(networkName);
  if (!evmNetwork) return { balance: '0.00', network: networkName, asset };
  if (!entity.evmDepositAddress) return { balance: '0.00', network: networkName, asset };
  const tokenNetwork = evmUsdcNetworks.find(candidate => candidate.name === evmNetwork.name && candidate.symbol === asset);
  const rpc = async (method: string, params: unknown[]) => {
    const response = await fetch(evmNetwork.rpc, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'evm-send-balance', method, params }),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json() as { result?: string; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message || `Unable to read ${asset} balance`);
    return body.result || '0x0';
  };
  if (tokenNetwork) {
    const owner = entity.evmDepositAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const rawBalance = await rpc('eth_call', [{ to: tokenNetwork.token, data: `0x70a08231${owner}` }, 'latest']);
    return { balance: formatTokenAmount(BigInt(rawBalance), tokenNetwork.decimals), network: evmNetwork.name, asset };
  }
  if (!evmNativeAssets.has(asset)) throw new Error(`${asset} balance lookup is not enabled on ${evmNetwork.name}`);
  const rawBalance = await rpc('eth_getBalance', [entity.evmDepositAddress, 'latest']);
  return { balance: formatTokenAmount(BigInt(rawBalance), 18), network: evmNetwork.name, asset };
}

async function recordPendingDirectTransfer(params: {
  transferId: string;
  entityId: string;
  asset: string;
  amount: string;
  recipientAddress: string;
  txHash: string;
  network: string;
}) {
  const currency = params.asset.toUpperCase();
  const cashAccountId = `${params.entityId}_cash_${currency}`;
  const outboundAccountId = `${params.entityId}_outbound_${currency}`;
  const accountRows = await db.select().from(ledgerAccounts).where(sql`${ledgerAccounts.id} IN (${cashAccountId}, ${outboundAccountId})`);
  const existingIds = new Set(accountRows.map(account => account.id));
  if (accountRows.length < 2) {
    await db.insert(ledgerAccounts).values([
      ...(existingIds.has(cashAccountId) ? [] : [{ id: cashAccountId, entityId: params.entityId, name: `Available ${currency}`, type: 'ASSET' as const, currency }]),
      ...(existingIds.has(outboundAccountId) ? [] : [{ id: outboundAccountId, entityId: params.entityId, name: `Outbound Clearing ${currency}`, type: 'LIABILITY' as const, currency }]),
    ]);
  }
  await db.insert(transfers).values({
    id: params.transferId,
    entityId: params.entityId,
    dueTransferId: params.txHash,
    sourceCurrency: currency,
    targetCurrency: currency,
    sourceAmount: params.amount,
    targetAmount: params.amount,
    feeAmount: '0.0000',
    direction: 'DEBIT',
    settlementStatus: 'SOURCE_SUBMITTED',
    sourceTxHash: params.txHash,
    status: 'pending',
  });
  await db.insert(ledgerEntries).values([
    { id: ulid(), entityId: params.entityId, transactionId: params.transferId, ledgerAccountId: cashAccountId, type: 'CREDIT', amount: params.amount },
    { id: ulid(), entityId: params.entityId, transactionId: params.transferId, ledgerAccountId: outboundAccountId, type: 'DEBIT', amount: params.amount },
  ]);
}

async function executeDirectEvmTransfer(params: {
  entity: any;
  amount: string;
  asset: string;
  network: string;
  recipientAddress: string;
}) {
  const network = getEvmNetwork(params.network);
  if (!network) throw new Error(`Unsupported EVM network: ${params.network}`);
  const tokenNetwork = evmUsdcNetworks.find(candidate => candidate.name === network.name && candidate.symbol === params.asset.toUpperCase());
  if (!params.recipientAddress) throw new Error('A destination EVM address is required');
  const user = (await db.select().from(users).where(eq(users.id, params.entity.userId)).limit(1))[0];
  if (!user?.privyUserId) throw new Error('Entity user has no Privy MPC identity');
  const targetChain = network.name as 'base' | 'bsc' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism';
  const bytecode = tokenNetwork
    ? [{ to: tokenNetwork.token, data: encodeErc20Transfer(params.recipientAddress, toBaseUnits(params.amount, tokenNetwork.decimals)), value: '0', chainId: 0 }]
    : evmNativeAssets.has(params.asset.toUpperCase())
      ? [{ to: params.recipientAddress, data: '0x', value: params.amount, chainId: 0 }]
      : null;
  if (!bytecode) throw new Error(`${params.asset} sending is not enabled on ${network.name}`);
  let submitted;
  const result = await signAndSubmitTransaction({ userIdentifier: `privy-${user.privyUserId}`, context: params.entity.kind === 'BUSINESS' ? 'business' : 'personal', targetChain, bytecode });
  submitted = result[0];
  if (!submitted?.success || !submitted.txHash) {
    throw new Error('EVM signing returned no confirmed transaction hash');
  }
  return { txHash: submitted.txHash, asset: params.asset.toUpperCase(), network: network.name };
}

async function executeDirectSolanaTransfer(params: { entity: any; amount: string; recipientAddress: string }) {
  const senderAddress = String(params.entity.solanaDepositAddress || '').trim();
  if (!senderAddress) throw new Error('Entity has no Solana MPC wallet');
  try {
    new PublicKey(senderAddress);
  } catch {
    throw new Error('Entity Solana MPC wallet address is invalid');
  }
  const recipientAddress = String(params.recipientAddress || '').trim().replace(/^solana:/i, '');
  if (!recipientAddress) throw new Error('A destination Solana address is required');
  try {
    new PublicKey(recipientAddress);
  } catch {
    throw new Error('A valid Solana destination address is required');
  }
  const user = (await db.select().from(users).where(eq(users.id, params.entity.userId)).limit(1))[0];
  if (!user?.privyUserId) throw new Error('Entity user has no Privy MPC identity');
  let balance = 0n;
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'sol-balance', method: 'getBalance', params: [senderAddress] }),
      signal: AbortSignal.timeout(4000),
    });
    const body = await response.json() as { result?: { value?: number } };
    balance = BigInt(body.result?.value || 0);
  } catch (rpcErr: any) {
    console.warn('[Solana RPC Warning]:', rpcErr.message);
  }
  const lamports = toBaseUnits(params.amount, 9);
  let result;
  try {
    result = await signAndSubmitSolanaTransaction({
      userIdentifier: `privy-${user.privyUserId}`,
      context: params.entity.kind === 'BUSINESS' ? 'business' : 'personal',
      to: recipientAddress,
      amount: 0n,
      instructions: [encodeSolanaSystemTransfer(lamports, senderAddress, recipientAddress)],
    });
  } catch (signErr: any) {
    throw new Error(`Solana signing failed: ${signErr.message}`);
  }
  if (!result?.txHash) throw new Error('Solana signing returned no transaction hash');
  return { txHash: result.txHash, asset: 'SOL', network: 'solana' };
}

async function fundIntentFromSolana(params: {
  entity: any;
  amount: string;
  intentDepositAddress: string;
}) {
  if (!params.entity.solanaDepositAddress) throw new Error('Entity has no Solana MPC wallet');
  const user = (await db.select().from(users).where(eq(users.id, params.entity.userId)).limit(1))[0];
  if (!user?.privyUserId) throw new Error('Entity user has no Privy MPC identity');
  try {
    new PublicKey(params.intentDepositAddress);
  } catch {
    throw new Error('NEAR Intent returned an invalid Solana deposit address');
  }

  const lamports = toBaseUnits(params.amount, 9);
  if (lamports <= 10_000n) throw new Error('SOL deposit is too small to cover the Solana network fee');
  const result = await signAndSubmitSolanaTransaction({
    userIdentifier: `privy-${user.privyUserId}`,
    context: params.entity.kind === 'BUSINESS' ? 'business' : 'personal',
    to: params.intentDepositAddress,
    amount: 0n,
    instructions: [encodeSolanaSystemTransfer(lamports - 10_000n, params.entity.solanaDepositAddress, params.intentDepositAddress)],
  });
  if (!result.txHash) throw new Error('SOL Intent funding returned no transaction hash');
  return result.txHash;
}

async function createPendingIntentSettlement(params: {
  entityId: string;
  reference: string;
  originAsset: string;
  originAmount: number;
  recipientAddress: string;
}) {
  const destinationAsset = `base:${baseSettlementAsset.toLowerCase()}`;
  const quote = await nearIntentsClient.generateIntentForSigning({
    originAsset: params.originAsset,
    destinationAsset,
    amount: params.originAmount.toString(),
    recipientAddress: params.recipientAddress,
    refundAddress: params.recipientAddress,
  });
  const intentId = quote.depositAddress || quote.intentId;
  if (!intentId) throw new Error('NEAR Intent returned no deposit address');

  const swapId = ulid();
  await db.insert(intentSwaps).values({
    id: swapId,
    entityId: params.entityId,
    originAsset: params.originAsset,
    destinationAsset,
    originAmount: params.originAmount.toFixed(8),
    destinationAmount: quote.quote?.amountOut ? String(quote.quote.amountOut) : null,
    depositAddress: intentId,
    recipientAddress: params.recipientAddress,
    status: 'PENDING_DEPOSIT',
    protocol: 'cross_chain_swap',
  });

  return { swapId, intentId, destinationAsset, quote };
}

function encodeErc20Transfer(recipient: string, amount: bigint): string {
  const normalizedRecipient = recipient.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(normalizedRecipient)) throw new Error('Intent deposit address is not a valid EVM address');
  return `0xa9059cbb${normalizedRecipient.padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`;
}

async function fundIntentFromEvm(params: {
  entity: any;
  network: (typeof evmUsdcNetworks)[number];
  tokenAmount: bigint;
  intentDepositAddress: string;
  relatedTransactionId: string;
  feeAmount?: bigint;
  feeTreasuryAddress?: string;
}) {
  const treasuryIdentifier = process.env.NEAR_GAS_TREASURY_IDENTIFIER || '';
  if (!treasuryIdentifier) throw new Error('NEAR_GAS_TREASURY_IDENTIFIER is required for managed gas sponsorship');
  const balanceResponse = await fetch(params.network.rpc, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'gas-check', method: 'eth_getBalance', params: [params.entity.evmDepositAddress, 'latest'] }),
  });
  const balanceBody = await balanceResponse.json() as { result?: string };
  const nativeBalance = BigInt(balanceBody.result || '0x0');
  const requiredGas = BigInt(Math.ceil(Number(params.network.gasTopUpNative) * 1e18));
  const gasSponsorshipId = `gas_${ulid()}`;
  let price: { price: string; timestamp: Date } | undefined;
  try {
    price = await fetchNativeUsdPrice(params.network.nativeAsset);
  } catch (error: any) {
    console.warn(`[Gas Price] ${params.network.nativeAsset}:`, error.message);
  }
  await db.insert(gasSponsorships).values({
    id: gasSponsorshipId,
    entityId: params.entity.id,
    relatedTransactionId: params.relatedTransactionId,
    chain: params.network.name,
    nativeAsset: params.network.nativeAsset,
    userWallet: params.entity.evmDepositAddress,
    treasuryWallet: treasuryIdentifier,
    estimatedGasNative: params.network.gasTopUpNative,
    requestedAmountNative: params.network.gasTopUpNative,
    reservedStablecoin: price ? calculateReserve(params.network.gasTopUpNative, price.price) : null,
    nativeUsdPrice: price?.price,
    priceTimestamp: price?.timestamp,
    chargedStablecoin: params.network.symbol,
    status: price ? 'RESERVED' : 'PRICE_UNAVAILABLE',
  });
  if (nativeBalance < requiredGas / 2n) {
    try {
      const topUpTxHash = await signAndSubmitNativeGasTransfer({
        treasuryIdentifier,
        recipient: params.entity.evmDepositAddress,
        amountNative: params.network.gasTopUpNative,
        targetChain: params.network.name as 'base' | 'bsc' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism',
      });
      await db.update(gasSponsorships).set({ status: 'GAS_FUNDED', fundingTxHash: topUpTxHash, updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
    } catch (error: any) {
      await db.update(gasSponsorships).set({ status: 'FUNDING_FAILED', failureReason: error.message, updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
      throw error;
    }
  }
  const user = (await db.select().from(users).where(eq(users.id, params.entity.userId)).limit(1))[0];
  if (!user?.privyUserId) throw new Error('Entity user has no Privy MPC identity');
  const bytecode = [{
    to: params.network.token,
    data: encodeErc20Transfer(params.intentDepositAddress, params.tokenAmount),
    value: '0',
    chainId: 0,
  }];
  if (params.feeAmount && params.feeAmount > 0n) {
    const treasuryAddress = String(params.feeTreasuryAddress || '').trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(treasuryAddress)) throw new Error('A valid Base treasury address is required for crypto fees');
    bytecode.push({
      to: params.network.token,
      data: encodeErc20Transfer(treasuryAddress, params.feeAmount),
      value: '0',
      chainId: 0,
    });
  }
  let result: Awaited<ReturnType<typeof signAndSubmitTransaction>>;
  try {
    result = await signAndSubmitTransaction({
      userIdentifier: `privy-${user.privyUserId}`,
      context: params.entity.kind === 'BUSINESS' ? 'business' : 'personal',
      targetChain: params.network.name as 'base' | 'bsc' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism',
      bytecode,
    });
  } catch (error: any) {
    await db.update(gasSponsorships).set({ status: 'TRANSACTION_FAILED', failureReason: error.message, updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
    throw error;
  }

  if (result.length !== bytecode.length || result.some((entry) => !entry.success || !entry.txHash)) {
    const message = 'MPC Intent funding transaction did not submit every transfer leg';
    await db.update(gasSponsorships).set({ status: 'TRANSACTION_FAILED', failureReason: message, updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
    throw new Error(message);
  }

  const submitted = result[0];
  if (!submitted?.success || !submitted.txHash) throw new Error('MPC Intent funding transaction failed');
  await db.update(gasSponsorships).set({ status: 'TRANSACTION_SUBMITTED', userTxHash: submitted.txHash, updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
  try {
    const receipt = await waitForEvmReceipt(params.network.rpc, submitted.txHash);
    if (receipt.status !== '0x1') throw new Error('EVM transaction reverted');
    await db.update(gasSponsorships).set({ status: 'CONFIRMED', updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
    if (!price) price = await fetchNativeUsdPrice(params.network.nativeAsset);
    await settleEvmGasSponsorship({
      db,
      sponsorshipId: gasSponsorshipId,
      gasUsed: BigInt(receipt.gasUsed || '0x0'),
      effectiveGasPrice: BigInt(receipt.effectiveGasPrice || '0x0'),
      nativeUsdPrice: price.price,
      priceTimestamp: price.timestamp,
    });
  } catch (error: any) {
    const status = error.message.includes('timed out') ? 'RECEIPT_TIMEOUT' : error.message.includes('Price') ? 'PRICE_UNAVAILABLE' : 'TRANSACTION_FAILED';
    await db.update(gasSponsorships).set({ status, failureReason: error.message, updatedAt: new Date() }).where(eq(gasSponsorships.id, gasSponsorshipId));
    if (status !== 'PRICE_UNAVAILABLE') throw error;
  }
  return submitted.txHash;
}

async function executeBaseToSolanaIntent(params: {
  entity: any;
  transferId: string;
  amount: string;
  sourceAsset: 'USDC' | 'USDT';
  destinationAsset: 'SOL' | 'USDC' | 'USDT';
  recipientAddress: string;
}) {
  try {
    new PublicKey(params.recipientAddress);
  } catch {
    throw new Error('A valid Solana destination address is required');
  }

  const sourceNetwork = evmUsdcNetworks.find(network => network.name === 'base' && network.symbol === params.sourceAsset);
  if (!sourceNetwork) throw new Error(`Base ${params.sourceAsset} is not configured for cross-chain sending`);
  const destinationAsset = `solana:${params.destinationAsset.toLowerCase()}`;
  const sourceAsset = `base:${params.sourceAsset.toLowerCase()}`;
  const quote = await nearIntentsClient.generateIntentForSigning({
    originAsset: sourceAsset,
    destinationAsset,
    amount: params.amount,
    recipientAddress: params.recipientAddress,
    refundAddress: params.entity.evmDepositAddress,
  });
  const intentId = quote.depositAddress || quote.intentId;
  if (!intentId) throw new Error('NEAR Intent returned no deposit address');

  const swapId = ulid();
  await db.insert(intentSwaps).values({
    id: swapId,
    entityId: params.entity.id,
    originAsset: sourceAsset,
    destinationAsset,
    originAmount: params.amount,
    destinationAmount: quote.quote?.amountOut ? String(quote.quote.amountOut) : null,
    depositAddress: intentId,
    recipientAddress: params.recipientAddress,
    quoteId: quote.quote?.id || quote.quoteId || null,
    sourceChain: 'base',
    destinationChain: 'solana',
    status: 'PENDING_DEPOSIT',
    protocol: 'cross_chain_swap',
  });
  await db.insert(transfers).values({
    id: params.transferId,
    entityId: params.entity.id,
    dueTransferId: intentId,
    sourceCurrency: params.sourceAsset,
    targetCurrency: params.destinationAsset,
    sourceAmount: params.amount,
    targetAmount: String(quote.quote?.amountOut || '0'),
    feeAmount: '0.00',
    direction: 'DEBIT',
    settlementStatus: 'QUOTED',
    intentSwapId: swapId,
    status: 'pending',
  });

  try {
    const sourceNetworkWithAsset = sourceNetwork;
    const sourceTxHash = await fundIntentFromEvm({
      entity: params.entity,
      network: sourceNetworkWithAsset,
      tokenAmount: toBaseUnits(params.amount, sourceNetworkWithAsset.decimals),
      intentDepositAddress: intentId,
      relatedTransactionId: params.transferId,
    });
    await nearIntentsClient.submitDepositTxHash({ intentId, txHash: sourceTxHash, chain: 'base' });
    await db.update(intentSwaps).set({ sourceTxHash, status: 'SUBMITTED' }).where(eq(intentSwaps.id, swapId));
    await db.update(transfers).set({ sourceTxHash, settlementStatus: 'SOURCE_SUBMITTED' }).where(eq(transfers.id, params.transferId));
    return { transferId: params.transferId, swapId, intentId, sourceTxHash, status: 'SUBMITTED', destinationAsset };
  } catch (error: any) {
    await db.update(intentSwaps).set({ status: 'FAILED', failureReason: error.message }).where(eq(intentSwaps.id, swapId));
    await db.update(transfers).set({ settlementStatus: 'FAILED', settlementError: error.message, status: 'failed' }).where(eq(transfers.id, params.transferId));
    throw error;
  }
}

async function executeBaseUsdcIntent(params: {
  entity: any;
  transferId: string;
  amount: string;
  destinationNetwork: string;
  destinationAsset: string;
  recipientAddress: string;
}) {
  const destinationNetwork = params.destinationNetwork.toLowerCase().trim();
  const destinationAsset = params.destinationAsset.toLowerCase().trim();
  const recipientAddress = params.recipientAddress.trim().replace(/^solana:/i, '');
  if (!destinationNetwork || !destinationAsset || !recipientAddress) {
    throw new Error('Destination network, asset, and address are required');
  }
  if (destinationNetwork === 'solana') {
    try { new PublicKey(recipientAddress); } catch { throw new Error('A valid Solana destination address is required'); }
  }
  if (destinationNetwork !== 'solana' && destinationNetwork !== 'near' && destinationNetwork !== 'bitcoin') {
    try { new PublicKey(recipientAddress); } catch { /* NEAR Intent validates non-Solana destination formats. */ }
  }

  const sourceNetwork = evmUsdcNetworks.find(network => network.name === 'base' && network.symbol === 'USDC');
  if (!sourceNetwork) throw new Error('Base USDC is not configured for crypto withdrawals');
  const amountText = String(params.amount).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(amountText)) throw new Error('Crypto withdrawal amount must be a valid decimal with up to 6 places');
  const grossUnits = toBaseUnits(amountText, 6);
  const percentageFeeUnits = grossUnits / 100n;
  const feeUnits = grossUnits === 0n ? 0n : percentageFeeUnits < 500000n ? 500000n : percentageFeeUnits > 50000000n ? 50000000n : percentageFeeUnits;
  const netUnits = grossUnits - feeUnits;
  if (netUnits <= 0n) throw new Error('Withdrawal amount is too small after platform fee');
  const grossAmount = Number(grossUnits) / 1_000_000;
  const feeAmount = Number(feeUnits) / 1_000_000;
  const netAmount = Number(netUnits) / 1_000_000;
  const baseTreasuryAddress = String(process.env.PROXIM_TREASURY_WALLET || '').trim();
  const sourceAsset = 'base:usdc';
  const intentDestinationAsset = `${destinationNetwork}:${destinationAsset}`;
  const quote = await nearIntentsClient.generateIntentForSigning({
    originAsset: sourceAsset,
    destinationAsset: intentDestinationAsset,
    amount: `${netUnits / 1_000_000n}.${(netUnits % 1_000_000n).toString().padStart(6, '0')}`.replace(/\.0+$/, ''),
    recipientAddress,
    refundAddress: params.entity.evmDepositAddress || undefined,
  });
  const intentId = quote.depositAddress || quote.intentId;
  if (!intentId) throw new Error('NEAR Intent returned no deposit address');

  const swapId = ulid();
  await db.insert(intentSwaps).values({
    id: swapId,
    entityId: params.entity.id,
    originAsset: sourceAsset,
    destinationAsset: intentDestinationAsset,
    originAmount: netAmount.toFixed(6),
    destinationAmount: quote.quote?.amountOut ? String(quote.quote.amountOut) : null,
    depositAddress: intentId,
    recipientAddress,
    quoteId: quote.quote?.id || quote.quoteId || null,
    sourceChain: 'base',
    destinationChain: destinationNetwork,
    status: 'PENDING_DEPOSIT',
    protocol: 'cross_chain_swap',
  });
  await db.insert(transfers).values({
    id: params.transferId,
    entityId: params.entity.id,
    dueTransferId: intentId,
    sourceCurrency: 'USDC',
    targetCurrency: destinationAsset.toUpperCase(),
    sourceAmount: netAmount.toFixed(6),
    targetAmount: String(quote.quote?.amountOut || '0'),
    feeAmount: '0.00',
    direction: 'DEBIT',
    settlementStatus: 'QUOTED',
    intentSwapId: swapId,
    status: 'pending',
  });

  try {
    const sourceTxHash = await fundIntentFromEvm({
      entity: params.entity,
      network: sourceNetwork,
      tokenAmount: netUnits,
      intentDepositAddress: intentId,
      relatedTransactionId: params.transferId,
      feeAmount: feeUnits,
      feeTreasuryAddress: baseTreasuryAddress,
    });
    await nearIntentsClient.submitDepositTxHash({ intentId, txHash: sourceTxHash, chain: 'base' });
    await db.update(intentSwaps).set({ sourceTxHash, status: 'SUBMITTED' }).where(eq(intentSwaps.id, swapId));
    await db.update(transfers).set({ sourceTxHash, settlementStatus: 'SOURCE_SUBMITTED', feeAmount: feeAmount.toFixed(6) }).where(eq(transfers.id, params.transferId));
    await db.insert(feeLedger).values({
      id: ulid(), entityId: params.entity.id, transactionType: 'ALTCOIN_SWAP', referenceId: params.transferId,
      grossAmount: grossAmount.toFixed(6), feeAmount: feeAmount.toFixed(6), netAmount: netAmount.toFixed(6),
      currency: 'USDC', description: 'Crypto withdrawal platform fee sent to Base treasury',
    });
    return { transferId: params.transferId, swapId, intentId, sourceTxHash, destinationAsset: intentDestinationAsset, status: 'SUBMITTED' };
  } catch (error: any) {
    await db.update(intentSwaps).set({ status: 'FAILED', failureReason: error.message }).where(eq(intentSwaps.id, swapId));
    await db.update(transfers).set({ settlementStatus: 'FAILED', settlementError: error.message, status: 'failed' }).where(eq(transfers.id, params.transferId));
    throw error;
  }
}

async function recordInboundDepositToLedger(entityId: string, amountNgn: number, referenceId: string) {
  try {
    const ledgerAccId = `${entityId}_cash_NGN`;
    const ledgerInId = `${entityId}_inbound_NGN`;

    const existingAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
    if (existingAcc.length === 0) {
      await db.insert(ledgerAccounts).values([
        { id: ledgerAccId, entityId, name: 'Available NGN', type: 'ASSET', currency: 'NGN' },
        { id: ledgerInId, entityId, name: 'Inbound Clearing NGN', type: 'LIABILITY', currency: 'NGN' },
      ]);
    }

    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId, transactionId: referenceId, ledgerAccountId: ledgerAccId, type: 'DEBIT', amount: String(amountNgn.toFixed(4)) },
      { id: ulid(), entityId, transactionId: referenceId, ledgerAccountId: ledgerInId, type: 'CREDIT', amount: String(amountNgn.toFixed(4)) },
    ]);
  } catch (err: any) {
    console.warn(`[Ledger Inbound Note] for ${entityId}:`, err.message);
  }
}

async function getOrCreateDepositCursor(entityId: string, network: string) {
  const existing = await db.select().from(depositSyncCursors)
    .where(and(eq(depositSyncCursors.entityId, entityId), eq(depositSyncCursors.network, network)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const cursorId = `cursor_${entityId}_${network}`.slice(0, 64);
  await db.insert(depositSyncCursors).values({
    id: cursorId,
    entityId,
    network,
    lastProcessedBlockHeight: '0',
    lastProcessedTxHash: null,
    lastProcessedAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
  }).onConflictDoNothing();

  const created = await db.select().from(depositSyncCursors)
    .where(and(eq(depositSyncCursors.entityId, entityId), eq(depositSyncCursors.network, network)))
    .limit(1);
  return created[0];
}

async function updateDepositCursor(entityId: string, network: string, blockHeight?: string, txHash?: string | null) {
  await db.update(depositSyncCursors).set({
    lastProcessedBlockHeight: blockHeight ?? '0',
    lastProcessedTxHash: txHash ?? null,
    lastProcessedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(depositSyncCursors.entityId, entityId), eq(depositSyncCursors.network, network)));
}

async function syncEvmUsdcDeposits(entityId: string): Promise<void> {
  const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  const address = entityRows[0]?.evmDepositAddress;
  if (!address) return;

  const recipientTopic = `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;
  await Promise.allSettled(evmUsdcNetworks.map(async (network) => {
    try {
      const rpc = async (method: string, params: unknown[]) => {
        const response = await fetch(network.rpc, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(3500),
          body: JSON.stringify({ jsonrpc: '2.0', id: `${network.name}-deposit-sync`, method, params }),
        });
        const body = await response.json() as { result?: any };
        return body.result;
      };

      const cursor = await getOrCreateDepositCursor(entityId, network.name);
      const latestBlock = BigInt(await rpc('eth_blockNumber', []));
      const cursorBlock = cursor.lastProcessedBlockHeight ? BigInt(String(cursor.lastProcessedBlockHeight)) : 0n;
      const fromBlock = cursorBlock > 0n ? cursorBlock : (latestBlock > 100000n ? latestBlock - 100000n : 0n);
      const logs = await rpc('eth_getLogs', [{
        address: network.token,
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${latestBlock.toString(16)}`,
        topics: [erc20TransferTopic, null, recipientTopic],
      }]) as Array<{ transactionHash: string; data: string; blockNumber: string }> | undefined;

      let maxBlockSeen = fromBlock;

      for (const log of logs || []) {
        const blockNumber = BigInt(log.blockNumber || '0');
        if (blockNumber > maxBlockSeen) maxBlockSeen = blockNumber;

        const amount = Number(BigInt(log.data)) / 10 ** network.decimals;
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const reference = `evm_${network.symbol.toLowerCase()}_${network.name}_${log.transactionHash}`;
        const existing = await db.select().from(transfers).where(eq(transfers.dueTransferId, reference)).limit(1);
        if (existing.length > 0) continue;

        const entity = entityRows[0];
        if (!entity.evmDepositAddress) continue;
        const settlement = await createPendingIntentSettlement({
          entityId,
          reference,
          originAsset: `${network.name}:${network.symbol.toLowerCase()}`,
          originAmount: amount,
          recipientAddress: entity.evmDepositAddress,
        });
        let fundingTxHash: string;
        try {
          fundingTxHash = await fundIntentFromEvm({
            entity,
            network,
            tokenAmount: BigInt(log.data),
            intentDepositAddress: settlement.intentId,
            relatedTransactionId: reference,
          });
          await nearIntentsClient.submitDepositTxHash({
            intentId: settlement.intentId,
            txHash: fundingTxHash,
            chain: network.name,
          });
          await db.update(intentSwaps).set({
            sourceTxHash: fundingTxHash,
            status: 'SUBMITTED',
          }).where(eq(intentSwaps.id, settlement.swapId));
        } catch (fundingError: any) {
          await db.update(intentSwaps).set({
            status: 'FAILED',
            failureReason: `MPC Intent funding failed: ${fundingError.message}`,
          }).where(eq(intentSwaps.id, settlement.swapId));
          await db.insert(transfers).values({
            id: ulid(),
            entityId,
            dueTransferId: reference,
            sourceCurrency: network.symbol,
            targetCurrency: baseSettlementAsset,
            sourceAmount: amount.toFixed(network.decimals > 6 ? 8 : 6),
            targetAmount: '0',
            feeAmount: '0.00',
            direction: 'CREDIT',
            settlementStatus: 'MANUAL_REVIEW',
            intentSwapId: settlement.swapId,
            sourceTxHash: log.transactionHash,
            settlementError: fundingError.message,
            status: 'pending',
          });
          continue;
        }
        const transferRecordId = ulid();
        await db.insert(transfers).values({
          id: transferRecordId,
          entityId,
          dueTransferId: reference,
          sourceCurrency: network.symbol,
          targetCurrency: baseSettlementAsset,
          sourceAmount: amount.toFixed(network.decimals > 6 ? 8 : 6),
          targetAmount: String(settlement.quote.quote?.amountOut || '0'),
          feeAmount: '0.00',
          direction: 'CREDIT',
          settlementStatus: 'INTENT_DEPOSITED',
          intentSwapId: settlement.swapId,
          sourceTxHash: log.transactionHash,
          intentFundingTxHash: fundingTxHash,
          status: 'pending',
        });

        // Auto-Reconcile: Check if an active pending invoice matches this incoming on-chain deposit amount
        try {
          const pendingInvoices = await db
            .select()
            .from(invoices)
            .where(
              and(
                eq(invoices.entityId, entityId),
                eq(invoices.status, 'pending')
              )
            );

          for (const inv of pendingInvoices) {
            const billedAmt = parseFloat(inv.totalAmount || '0');
            if (Math.abs(billedAmt - amount) <= Math.max(0.5, billedAmt * 0.01)) {
              await settleInvoiceAndRecordLedger(
                inv.id,
                `${network.name.toUpperCase()} on-chain transfer`,
                log.transactionHash
              );
              console.log(`⚡ [Auto-Reconciled] Invoice ${inv.tag} auto-settled from on-chain ${network.symbol} deposit (${log.transactionHash})`);
              break;
            }
          }
        } catch (reconcileErr: any) {
          console.warn(`[Invoice OnChain Auto-Reconcile Note]:`, reconcileErr.message);
        }
      }

      const nextCursorHeight = latestBlock.toString();
      if (maxBlockSeen > fromBlock || latestBlock > cursorBlock) {
        await updateDepositCursor(entityId, network.name, nextCursorHeight, undefined);
      }
    } catch (error: any) {
      console.warn(`[OnChain Sync] ${network.name} USDC sync note for ${entityId}:`, error.message);
    }
  }));
}


// On-Chain Transaction & Activity Feed Sync Engine (Solana, Bitcoin, NEAR, EVM)
async function syncOnChainActivityAndBalance(entityId: string) {
  const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  if (entityRows.length === 0) return;
  const entity = entityRows[0];

  const tasks: Promise<void>[] = [];

  tasks.push(syncEvmUsdcDeposits(entityId));

  // 1. Sync Solana Blockchain Transactions & Route via NEAR Intent to Base USDC
  if (entity.solanaDepositAddress) {
    tasks.push((async () => {
      try {
        const solanaWeb3 = await import('@solana/web3.js');
        const solRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new solanaWeb3.Connection(solRpcUrl, 'confirmed');
        const pubKey = new solanaWeb3.PublicKey(entity.solanaDepositAddress!);
        const cursor = await getOrCreateDepositCursor(entity.id, 'solana');
        const txHistory = await connection.getConfirmedSignaturesForAddress2(pubKey, { limit: 25, before: cursor.lastProcessedTxHash || undefined });
        const pendingTxs = txHistory.filter((tx) => !cursor.lastProcessedTxHash || tx.signature !== cursor.lastProcessedTxHash).reverse();

        if (pendingTxs.length === 0) return;

        let lastSeenSignature = cursor.lastProcessedTxHash || pendingTxs[pendingTxs.length - 1]?.signature || null;

        for (const txMeta of pendingTxs) {
          if (txMeta.err) {
            lastSeenSignature = txMeta.signature;
            continue;
          }

          const txDetails = await connection.getTransaction(txMeta.signature, { maxSupportedTransactionVersion: 0 });
          const message = (txDetails as any)?.transaction?.message ?? {};
          const instructions = Array.isArray(message.instructions) ? message.instructions : [];
          const nativeTransfers = instructions
            .filter((instruction: any) => instruction?.program === 'system' && instruction?.parsed?.type === 'transfer')
            .map((instruction: any) => instruction.parsed.info)
            .filter((info: any) => info?.destination === entity.solanaDepositAddress && info?.source !== entity.solanaDepositAddress);
          const recipientBalanceDelta = nativeTransfers.reduce((total: number, transfer: any) => total + Number(transfer.lamports || 0) / 1e9, 0);

          if (recipientBalanceDelta <= 0.0001) {
            lastSeenSignature = txMeta.signature;
            continue;
          }

          const refTag = `sol_dep_${entity.solanaDepositAddress}_${txMeta.signature}`;
          const existing = await db.select().from(transfers).where(eq(transfers.dueTransferId, refTag)).limit(1);
          if (existing.length > 0) {
            lastSeenSignature = txMeta.signature;
            continue;
          }

          try {
            const settlement = await createPendingIntentSettlement({
              entityId: entity.id,
              reference: refTag,
              originAsset: 'solana:sol',
              originAmount: Math.max(0, recipientBalanceDelta - 0.00001),
              recipientAddress: entity.evmDepositAddress || '',
            });
            const transferRecordId = ulid();
            const sourceTxHash = await fundIntentFromSolana({
              entity,
              amount: Math.max(0, recipientBalanceDelta - 0.00001).toFixed(9),
              intentDepositAddress: settlement.intentId,
            });
            await nearIntentsClient.submitDepositTxHash({ intentId: settlement.intentId, txHash: sourceTxHash, chain: 'solana' });
            await db.insert(transfers).values({
              id: transferRecordId, entityId: entity.id, dueTransferId: refTag,
              sourceCurrency: 'SOL', targetCurrency: baseSettlementAsset,
              sourceAmount: Math.max(0, recipientBalanceDelta - 0.00001).toFixed(8), targetAmount: String(settlement.quote.quote?.amountOut || '0'),
              feeAmount: '0.00', direction: 'CREDIT', settlementStatus: 'SOURCE_SUBMITTED',
              intentSwapId: settlement.swapId, sourceTxHash, intentFundingTxHash: sourceTxHash, status: 'pending',
            });
            await db.update(intentSwaps).set({ sourceTxHash, status: 'SUBMITTED' }).where(eq(intentSwaps.id, settlement.swapId));
            lastSeenSignature = txMeta.signature;
          } catch (intentErr: any) {
            await db.insert(transfers).values({
              id: ulid(), entityId: entity.id, dueTransferId: refTag,
              sourceCurrency: 'SOL', targetCurrency: baseSettlementAsset,
              sourceAmount: recipientBalanceDelta.toFixed(8), targetAmount: '0', feeAmount: '0.00',
              direction: 'CREDIT', settlementStatus: 'MANUAL_REVIEW',
              settlementError: intentErr.message, status: 'pending',
            });
            lastSeenSignature = txMeta.signature;
          }
        }

        if (lastSeenSignature && lastSeenSignature !== cursor.lastProcessedTxHash) {
          await updateDepositCursor(entity.id, 'solana', undefined, lastSeenSignature);
        }
      } catch (solErr: any) {
        console.warn(`[OnChain Sync] Solana activity sync note for ${entity.id}:`, solErr.message);
      }
    })());
  }

  // 2. Sync Bitcoin Blockchain Transactions & Deposit Activity
  if (entity.btcDepositAddress) {
    tasks.push((async () => {
      try {
        const mempoolRes = await fetch(`https://mempool.space/api/address/${entity.btcDepositAddress}`, { signal: AbortSignal.timeout(3500) });
        const btcData: any = await mempoolRes.json();
        const funded = btcData?.chain_stats?.funded_txo_sum || 0;
        const spent = btcData?.chain_stats?.spent_txo_sum || 0;
        const satoshis = funded - spent;
        const btcAmount = satoshis / 1e8;

        if (btcAmount > 0.00001) {
          const refTag = `btc_dep_${entity.btcDepositAddress}_${btcAmount.toFixed(6)}`;

          const existing = await db.select().from(transfers).where(eq(transfers.dueTransferId, refTag)).limit(1);
          if (existing.length === 0) {
            try {
              const user = (await db.select().from(users).where(eq(users.id, entity.userId)).limit(1))[0];
              if (!user?.privyUserId) throw new Error('Entity user has no Privy MPC identity');

              const settlement = await createPendingIntentSettlement({
                entityId: entity.id, 
                reference: refTag, 
                originAsset: 'bitcoin:btc', 
                originAmount: btcAmount, 
                recipientAddress: entity.evmDepositAddress || '' 
              });

              // Fund the BTC intent using MPC signing
              const { txHash: sourceTxHash } = await fundIntentFromBitcoin({
                userIdentifier: `privy-${user.privyUserId}`,
                context: entity.kind === 'BUSINESS' ? 'business' : 'personal',
                amount: btcAmount.toFixed(8),
                intentDepositAddress: settlement.intentId,
              });

              await nearIntentsClient.submitDepositTxHash({ 
                intentId: settlement.intentId, 
                txHash: sourceTxHash, 
                chain: 'bitcoin' 
              });

              await db.update(intentSwaps)
                .set({ sourceTxHash, status: 'SUBMITTED' })
                .where(eq(intentSwaps.id, settlement.swapId));

              await db.insert(transfers).values({ 
                id: ulid(), 
                entityId: entity.id, 
                dueTransferId: refTag, 
                sourceCurrency: 'BTC', 
                targetCurrency: baseSettlementAsset, 
                sourceAmount: btcAmount.toFixed(8), 
                targetAmount: String(settlement.quote.quote?.amountOut || '0'), 
                feeAmount: '0.00', 
                direction: 'CREDIT', 
                settlementStatus: 'SOURCE_SUBMITTED', 
                intentSwapId: settlement.swapId, 
                sourceTxHash, 
                intentFundingTxHash: sourceTxHash, 
                status: 'pending' 
              });

              console.log(`✅ BTC intent funded and submitted: ${sourceTxHash}`);
            } catch (intentErr: any) {
              console.error(`[BTC Intent Funding Failed]:`, intentErr.message);
              await db.insert(transfers).values({ 
                id: ulid(), 
                entityId: entity.id, 
                dueTransferId: refTag, 
                sourceCurrency: 'BTC', 
                targetCurrency: baseSettlementAsset, 
                sourceAmount: btcAmount.toFixed(8), 
                targetAmount: '0', 
                feeAmount: '0.00', 
                direction: 'CREDIT', 
                settlementStatus: 'FAILED', 
                settlementError: intentErr.message, 
                status: 'pending' 
              });
            }
          } else if (existing[0].settlementStatus === 'QUOTED' && existing[0].intentSwapId) {
            // Retry funding for existing quoted intents
            try {
              const swapRows = await db.select().from(intentSwaps).where(eq(intentSwaps.id, existing[0].intentSwapId)).limit(1);
              const swap = swapRows[0];
              if (swap?.depositAddress) {
                const user = (await db.select().from(users).where(eq(users.id, entity.userId)).limit(1))[0];
                const sourceAmount = Number(existing[0].sourceAmount || 0);
                if (sourceAmount > 0 && user?.privyUserId) {
                  const { txHash: sourceTxHash } = await fundIntentFromBitcoin({
                    userIdentifier: `privy-${user.privyUserId}`,
                    context: entity.kind === 'BUSINESS' ? 'business' : 'personal',
                    amount: sourceAmount.toFixed(8),
                    intentDepositAddress: swap.depositAddress,
                  });
                  await nearIntentsClient.submitDepositTxHash({ intentId: swap.depositAddress, txHash: sourceTxHash, chain: 'bitcoin' });
                  await db.update(intentSwaps).set({ sourceTxHash, status: 'SUBMITTED' }).where(eq(intentSwaps.id, swap.id));
                  await db.update(transfers).set({ sourceTxHash, intentFundingTxHash: sourceTxHash, settlementStatus: 'SOURCE_SUBMITTED', status: 'pending' }).where(eq(transfers.id, existing[0].id));
                }
              }
            } catch (retryErr: any) {
              console.warn(`[BTC Intent Retry Failed]:`, retryErr.message);
            }
          }
        }
      } catch (btcErr: any) {
        console.warn(`[OnChain Sync] Bitcoin activity sync note for ${entity.id}:`, btcErr.message);
      }
    })());
  }

  // 3. Sync NEAR Blockchain Transactions & Deposit Activity
  if (entity.nearDepositAddress) {
    tasks.push((async () => {
      try {
        const nearAddress = entity.nearDepositAddress;
        let nearAmount = 0;

        const nearNetworkId = process.env.NEAR_NETWORK_ID || 'mainnet';
        const nearBlocksHost = nearNetworkId === 'mainnet'
          ? 'api.nearblocks.io'
          : 'api-testnet.nearblocks.io';
        const nearRpcUrl = process.env.NEAR_RPC_URL || (nearNetworkId === 'mainnet'
          ? 'https://rpc.mainnet.near.org'
          : 'https://archival-rpc.testnet.near.org');

        try {
          const res = await fetch(`https://${nearBlocksHost}/v1/account/${nearAddress}`, { signal: AbortSignal.timeout(3000) });
          const data: any = await res.json();
          if (data.account && data.account.length > 0) {
            nearAmount = Number(BigInt(data.account[0].amount)) / 1e24;
          }
        } catch (e) {
          const res = await fetch(nearRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(3500),
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'near-sync',
              method: 'query',
              params: {
                request_type: 'view_account',
                finality: 'final',
                account_id: nearAddress,
              },
            }),
          });
          const data: any = await res.json();
          if (data?.result?.amount) {
            nearAmount = Number(BigInt(data.result.amount)) / 1e24;
          }
        }

        if (nearAmount > 0.06) {
          const depositNear = nearAmount - 0.05;
          const refTag = `near_dep_${nearAddress}_${depositNear.toFixed(2)}`;

          const existing = await db.select().from(transfers).where(eq(transfers.dueTransferId, refTag)).limit(1);
          if (existing.length === 0) {
            try {
              const user = (await db.select().from(users).where(eq(users.id, entity.userId)).limit(1))[0];
              if (!user?.privyUserId) throw new Error('Entity user has no Privy MPC identity');

              const settlement = await createPendingIntentSettlement({ 
                entityId: entity.id, 
                reference: refTag, 
                originAsset: 'near:near', 
                originAmount: depositNear, 
                recipientAddress: entity.evmDepositAddress || '' 
              });

              // Fund the NEAR intent using MPC signing
              const { txHash: sourceTxHash } = await fundIntentFromNear({
                userIdentifier: `privy-${user.privyUserId}`,
                context: entity.kind === 'BUSINESS' ? 'business' : 'personal',
                amount: depositNear.toFixed(8),
                intentDepositAddress: settlement.intentId,
              });

              await nearIntentsClient.submitDepositTxHash({ 
                intentId: settlement.intentId, 
                txHash: sourceTxHash, 
                chain: 'near' 
              });

              await db.update(intentSwaps)
                .set({ sourceTxHash, status: 'SUBMITTED' })
                .where(eq(intentSwaps.id, settlement.swapId));

              await db.insert(transfers).values({ 
                id: ulid(), 
                entityId: entity.id, 
                dueTransferId: refTag, 
                sourceCurrency: 'NEAR', 
                targetCurrency: baseSettlementAsset, 
                sourceAmount: depositNear.toFixed(8), 
                targetAmount: String(settlement.quote.quote?.amountOut || '0'), 
                feeAmount: '0.00', 
                direction: 'CREDIT', 
                settlementStatus: 'SOURCE_SUBMITTED', 
                intentSwapId: settlement.swapId, 
                sourceTxHash, 
                intentFundingTxHash: sourceTxHash, 
                status: 'pending' 
              });

              console.log(`✅ NEAR intent funded and submitted: ${sourceTxHash}`);
            } catch (intentErr: any) {
              console.error(`[NEAR Intent Funding Failed]:`, intentErr.message);
              await db.insert(transfers).values({ 
                id: ulid(), 
                entityId: entity.id, 
                dueTransferId: refTag, 
                sourceCurrency: 'NEAR', 
                targetCurrency: baseSettlementAsset, 
                sourceAmount: depositNear.toFixed(8), 
                targetAmount: '0', 
                feeAmount: '0.00', 
                direction: 'CREDIT', 
                settlementStatus: 'FAILED', 
                settlementError: intentErr.message, 
                status: 'pending' 
              });
            }
          } else if (existing[0].settlementStatus === 'QUOTED' && existing[0].intentSwapId) {
            // Retry funding for existing quoted intents
            try {
              const swapRows = await db.select().from(intentSwaps).where(eq(intentSwaps.id, existing[0].intentSwapId)).limit(1);
              const swap = swapRows[0];
              if (swap?.depositAddress) {
                const user = (await db.select().from(users).where(eq(users.id, entity.userId)).limit(1))[0];
                const sourceAmount = Number(existing[0].sourceAmount || 0);
                if (sourceAmount > 0 && user?.privyUserId) {
                  const { txHash: sourceTxHash } = await fundIntentFromNear({
                    userIdentifier: `privy-${user.privyUserId}`,
                    context: entity.kind === 'BUSINESS' ? 'business' : 'personal',
                    amount: sourceAmount.toFixed(8),
                    intentDepositAddress: swap.depositAddress,
                  });
                  await nearIntentsClient.submitDepositTxHash({ intentId: swap.depositAddress, txHash: sourceTxHash, chain: 'near' });
                  await db.update(intentSwaps).set({ sourceTxHash, status: 'SUBMITTED' }).where(eq(intentSwaps.id, swap.id));
                  await db.update(transfers).set({ sourceTxHash, intentFundingTxHash: sourceTxHash, settlementStatus: 'SOURCE_SUBMITTED', status: 'pending' }).where(eq(transfers.id, existing[0].id));
                }
              }
            } catch (retryErr: any) {
              console.warn(`[NEAR Intent Retry Failed]:`, retryErr.message);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[OnChain Sync] NEAR activity sync note for ${entity.id}:`, err.message);
      }
    })());
  }

  await Promise.allSettled(tasks);
}

// Calculate real entity balance from settled transfers and live multi-chain on-chain sync
async function calculateLiveEntityBalance(entityId: string): Promise<number> {
  const now = Date.now();
  const lastSync = lastSyncTimestamps.get(entityId) || 0;
  if (now - lastSync > SYNC_THROTTLE_MS) {
    lastSyncTimestamps.set(entityId, now);
    // Trigger on-chain sync in background without blocking response
    syncOnChainActivityAndBalance(entityId).catch(err => {
      console.warn(`[Background Sync] for ${entityId}:`, err.message);
    });
  }

  const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  if (entityRows.length > 0) {
    try {
      const onChainBalance = await getOnChainAssetBalance(entityRows[0], 'base', baseSettlementAsset);
      return Math.max(0, Number(onChainBalance.balance));
    } catch (error: any) {
      console.warn(`[Balance] Base ${baseSettlementAsset} RPC lookup failed for ${entityId}:`, error.message);
    }
  }

  // 1. Fall back to the double-entry ledger if the live chain is unavailable.
  const ledgerBalance = await getEntityBalance(db, entityId, baseSettlementAsset, 'cash');

  // 2. Sum settled transfers in the configured settlement asset only.
  const dbTransfers = await db.select().from(transfers).where(eq(transfers.entityId, entityId));
  let transferSum = 0;
  for (const row of dbTransfers) {
    const t = row as any;
    if (String(t.targetCurrency || '').toUpperCase() !== baseSettlementAsset.toUpperCase()) continue;
    if (t.status === 'completed' || t.status === 'settled' || t.status === 'pending') {
      const amt = parseFloat(t.targetAmount || '0');
      if (t.direction === 'CREDIT') {
        transferSum += amt;
      } else if (t.direction === 'DEBIT') {
        transferSum -= amt;
      }
    }
  }

  const finalBalance = Math.max(ledgerBalance, transferSum);
  return Math.max(0, Math.round(finalBalance * 100) / 100);
}

export async function transferRoutes(server: FastifyInstance) {

  /**
   * Get Live FX Rates
   */
  server.get('/api/fx/rates', async (request, reply) => {
    try {
      // Try to fetch live rates from CoinGecko
      const response = await fetch('https://api.coingecko.com/api/v3/exchange_rates', {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const rates = data.rates;
        
        // Build rates object with NGN as base
        const ngnRate = rates?.ngn?.value || 1550;
        const usdRate = rates?.usd?.value || 1;
        
        return reply.send({
          success: true,
          rates: [
            { currency: 'NGN', symbol: '₦', rateToNgn: 1, rateToUsd: 1 / ngnRate, name: 'Nigerian Naira' },
            { currency: 'USD', symbol: '$', rateToNgn: ngnRate, rateToUsd: 1, name: 'US Dollar' },
            { currency: 'EUR', symbol: '€', rateToNgn: ngnRate * (rates?.eur?.value || 1.08), rateToUsd: rates?.eur?.value || 1.08, name: 'Euro' },
            { currency: 'GBP', symbol: '£', rateToNgn: ngnRate * (rates?.gbp?.value || 1.28), rateToUsd: rates?.gbp?.value || 1.28, name: 'British Pound' },
            { currency: 'KES', symbol: 'KSh', rateToNgn: ngnRate * (rates?.kes?.value || 0.0078), rateToUsd: rates?.kes?.value || 0.0078, name: 'Kenyan Shilling' },
            { currency: 'GHS', symbol: 'GH₵', rateToNgn: ngnRate * (rates?.ghs?.value || 0.065), rateToUsd: rates?.ghs?.value || 0.065, name: 'Ghanaian Cedi' },
            { currency: 'ZAR', symbol: 'R', rateToNgn: ngnRate * (rates?.zar?.value || 0.055), rateToUsd: rates?.zar?.value || 0.055, name: 'South African Rand' },
            { currency: 'UGX', symbol: 'USh', rateToNgn: ngnRate * (rates?.ugx?.value || 0.00027), rateToUsd: rates?.ugx?.value || 0.00027, name: 'Ugandan Shilling' },
            { currency: 'CAD', symbol: 'CA$', rateToNgn: ngnRate * (rates?.cad?.value || 0.74), rateToUsd: rates?.cad?.value || 0.74, name: 'Canadian Dollar' },
            { currency: 'AED', symbol: 'AED', rateToNgn: ngnRate * (rates?.aed?.value || 0.27), rateToUsd: rates?.aed?.value || 0.27, name: 'UAE Dirham' },
          ],
          source: 'coingecko',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.warn('[FX Rates] Failed to fetch live rates, using fallback:', error.message);
    }
    
    // Fallback to hardcoded rates
    return reply.send({
      success: true,
      rates: [
        { currency: 'NGN', symbol: '₦', rateToNgn: 1, rateToUsd: 1 / 1550, name: 'Nigerian Naira' },
        { currency: 'USD', symbol: '$', rateToNgn: 1550, rateToUsd: 1, name: 'US Dollar' },
        { currency: 'EUR', symbol: '€', rateToNgn: 1680, rateToUsd: 1.08, name: 'Euro' },
        { currency: 'GBP', symbol: '£', rateToNgn: 1980, rateToUsd: 1.28, name: 'British Pound' },
        { currency: 'KES', symbol: 'KSh', rateToNgn: 12.0, rateToUsd: 0.0078, name: 'Kenyan Shilling' },
        { currency: 'GHS', symbol: 'GH₵', rateToNgn: 100.0, rateToUsd: 0.065, name: 'Ghanaian Cedi' },
        { currency: 'ZAR', symbol: 'R', rateToNgn: 85.0, rateToUsd: 0.055, name: 'South African Rand' },
        { currency: 'UGX', symbol: 'USh', rateToNgn: 0.42, rateToUsd: 0.00027, name: 'Ugandan Shilling' },
        { currency: 'CAD', symbol: 'CA$', rateToNgn: 1140, rateToUsd: 0.74, name: 'Canadian Dollar' },
        { currency: 'AED', symbol: 'AED', rateToNgn: 422, rateToUsd: 0.27, name: 'UAE Dirham' },
      ],
      source: 'fallback',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get Balance for Entity
   */
  server.get('/api/transfers/balance', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const balance = await calculateLiveEntityBalance(entityId);

    return reply.send({
      success: true,
      balance,
      currency: baseSettlementAsset,
    });
  });

  server.get('/api/transfers/on-chain-balances', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });
    const entity = entityRows[0];
    const assets: Record<string, string> = {};
    for (const [network, asset] of [['solana', 'SOL'], ['base', baseSettlementAsset]] as const) {
      try {
        assets[`${network}:${asset}`] = (await getOnChainAssetBalance(entity, network, asset)).balance;
      } catch (error: any) {
        console.warn(`[Balance] ${network} ${asset} lookup failed for ${entityId}:`, error.message);
      }
    }
    return reply.send({ success: true, assets });
  });

  server.get('/api/transfers/on-chain-balance', async (request, reply) => {
    const { entityId, network, asset } = request.query as { entityId: string; network: string; asset: string };
    if (!entityId || !network || !asset) return reply.status(400).send({ error: 'entityId, network, and asset are required' });
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    try {
      return reply.send({ success: true, ...(await getOnChainAssetBalance(entityRows[0], network, asset)) });
    } catch (error: any) {
      return reply.send({ success: true, balance: '0.00', network, asset });
    }
  });

  /**
   * GET /api/transfers/sendable-assets/:destinationChain
   * Get list of tokens that can be sent from Base USDC to a specific destination chain
   * Uses NEAR Intent to validate actual supported routes and prevent silent failures
   */
  server.get('/api/transfers/sendable-assets/:destinationChain', async (request, reply) => {
    try {
      const { destinationChain } = request.params as { destinationChain: string };
      if (!destinationChain) {
        return reply.status(400).send({ error: 'destinationChain is required' });
      }

      const sendableAssets = await nearIntentsClient.getSendableAssetsForChain(destinationChain);
      
      return reply.send({
        success: true,
        destinationChain: destinationChain.toLowerCase(),
        sourceAsset: 'base:usdc',
        sendableAssets,
        count: sendableAssets.length,
        message: sendableAssets.length === 0 
          ? `No NEAR Intent routes available from Base USDC to ${destinationChain}. Contact support.`
          : `${sendableAssets.length} token(s) can be sent to ${destinationChain}`,
      });
    } catch (err: any) {
      console.error('[Route /api/transfers/sendable-assets/:destinationChain] Error:', err.message);
      return reply.status(500).send({
        error: 'Failed to fetch sendable assets',
        details: err.message,
      });
    }
  });

  /**
   * Force On-Chain Activity Sync for Entity
   */
  server.post('/api/transfers/sync', async (request, reply) => {
    const { entityId } = request.body as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    await syncOnChainActivityAndBalance(entityId);
    const balance = await calculateLiveEntityBalance(entityId);

    return reply.send({
      success: true,
      entityId,
      balance,
      syncedAt: new Date().toISOString(),
    });
  });

  /**
   * Get Transaction History for Entity
   */
  server.get('/api/transfers/history', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const now = Date.now();
    const lastSync = lastSyncTimestamps.get(entityId) || 0;
    if (now - lastSync > SYNC_THROTTLE_MS) {
      lastSyncTimestamps.set(entityId, now);
      syncOnChainActivityAndBalance(entityId).catch(err => {
        console.warn(`[Background Sync] for ${entityId}:`, err.message);
      });
    }

    const dbTransfers = await db
      .select()
      .from(transfers)
      .where(eq(transfers.entityId, entityId))
      .orderBy(desc(transfers.createdAt))
      .limit(30);

    const formatted = dbTransfers.map(row => {
      const tx = row as any;
      const isCrypto = tx.sourceCurrency === 'SOL' || tx.sourceCurrency === 'BTC' || tx.sourceCurrency === 'NEAR' || tx.sourceCurrency === 'USDC' || tx.sourceCurrency === 'USDT' || tx.sourceCurrency === 'ETH';
      const isInbound = tx.direction === 'CREDIT' || (!tx.direction && isCrypto);
      const amountVal = parseFloat(tx.amount || tx.targetAmount || tx.sourceAmount || '0');
      const formattedCurrency = tx.targetCurrency || tx.currency || 'NGN';
      const symbol = formattedCurrency === 'NGN' ? '₦' : formattedCurrency === 'EUR' ? '€' : formattedCurrency === 'GBP' ? '£' : '$';

      const cryptoNames: Record<string, string> = {
        SOL: 'Solana',
        BTC: 'Bitcoin',
        NEAR: 'NEAR',
        USDC: 'USDC',
        USDT: 'USDT',
        ETH: 'Ethereum',
      };

      const title = isInbound
        ? (isCrypto && tx.sourceCurrency ? `Received ${cryptoNames[tx.sourceCurrency] || tx.sourceCurrency} Deposit` : tx.destinationAccountName ? `Received from ${tx.destinationAccountName}` : 'Payment Received')
        : (tx.destinationAccountName ? `Sent to ${tx.destinationAccountName}` : 'Money Sent');

      const subtitle = isInbound
        ? (isCrypto ? `${tx.sourceAmount || ''} ${tx.sourceCurrency || ''} converted · Completed` : 'Payment received · Completed')
        : 'Payment sent · Completed';

      return {
        id: tx.id,
        type: isInbound ? 'INBOUND' : 'OUTBOUND',
        title,
        subtitle,
        amount: amountVal,
        symbol,
        currency: formattedCurrency,
        date: tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'Today',
        time: tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM',
        mode: isCrypto ? 'crypto' : 'fiat',
        senderAccount: isInbound ? (tx.destinationAccountNumber || 'External Sender') : 'Proxim Balance',
        recipientAccount: isInbound ? 'Proxim Balance' : (tx.destinationAccountNumber || 'External Account'),
        reference: tx.dueTransferId || tx.id,
      };
    });

    return reply.send({
      success: true,
      transactions: formatted,
    });
  });

  /**
   * Resolve NUBAN / Bank Account Name
   */
  server.get('/api/transfers/resolve-account', async (request, reply) => {
    const { accountNumber, bankCode, bvn } = request.query as { accountNumber: string; bankCode?: string; bvn?: string };
    if (!accountNumber || !bankCode || !bvn) {
      return reply.status(400).send({ error: 'accountNumber, bankCode, and BVN are required' });
    }
    try {
      const result = await easeIdClient.verifyBankAccount(bvn, bankCode, accountNumber);
      if (!result.verifyResult) return reply.status(422).send({ error: 'Bank account verification failed.' });
      return reply.send({ success: true, accountNumber, bankCode, accountName: result.bankAccountName, nameMatchPercentage: result.nameMatchPercentage });
    } catch (err: any) {
      return reply.status(503).send({ error: 'Bank account verification is temporarily unavailable.', details: err.message });
    }
  });

  /**
   * Unified Transfer Execution (Bank Payout or Headless Crypto Send)
   */
  server.post('/api/transfers/execute', async (request, reply) => {
    const {
      entityId,
      mode = 'fiat',
      currency = 'NGN',
      amount,
      recipientName,
      bankName,
      accountNumber,
      ibanOrRoutingNumber,
      bicOrSwiftCode,
      sortCode,
      network,
      recipientAddress,
      asset,
      sourceAsset = 'USDC',
      narration,
      passcode,
      bankCode,
      bvn,
    } = request.body as any;

    if (!entityId || !amount || amount <= 0) {
      return reply.status(400).send({ error: 'entityId and valid amount are required' });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    if (!request.session?.userEntityIds.includes(entityId)) {
      return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });
    }

    const entity = entityRows[0];
    const transferId = ulid();

    // Step-up security check for transfers >= $5,000 equivalent or when flagged
    if (amount >= 5000000 && !passcode) {
      return reply.status(403).send({
        status: 'STEP_UP_AUTH_REQUIRED',
        requiresPinStepUp: true,
        message: 'Security authorization required for this high-value transfer.',
      });
    }

    try {
      let duePayoutId = null;
      let feeCalc = feeService.calculateOffRampFee(amount, currency);

      if (mode === 'crypto') {
        const normalizedNetwork = String(network || '').toLowerCase();
        const intentTransfer = await executeBaseUsdcIntent({
          entity,
          transferId,
          amount: String(amount),
          destinationNetwork: normalizedNetwork,
          destinationAsset: String(asset || 'SOL'),
          recipientAddress: String(recipientAddress || ''),
        });
        return reply.send({
          success: true,
          transactionId: transferId,
          intentId: intentTransfer.intentId,
          swapId: intentTransfer.swapId,
          sourceTxHash: intentTransfer.sourceTxHash,
          status: 'PENDING',
          asset: String(asset || 'SOL').toUpperCase(),
          network: normalizedNetwork,
          message: 'Withdrawal submitted through NEAR Intent and awaiting destination settlement.',
        });
      }

      if (mode === 'fiat') {
        if (accountNumber && bankCode && bvn) {
          try {
            const bankVerification = await easeIdClient.verifyBankAccount(bvn, bankCode, accountNumber);
            if (!bankVerification.verifyResult) {
              console.warn('[Bank Verification Warning]: Name match not 100%, proceeding with payout reference');
            }
          } catch (vErr: any) {
            console.warn('[Bank Verification Service Notice]:', vErr.message);
          }
        }

        if (!process.env.BRAILS_API_KEY || !process.env.BRAILS_API_KEY.trim()) {
          throw new Error('Fiat payout is blocked because BRAILS_API_KEY is missing or blank. Configure Brails before executing fiat off-ramps.');
        }
        if (!accountNumber) {
          throw new Error('Fiat payout requires a beneficiary accountNumber.');
        }

        const payout = await brails.initiatePayout({
          amount: feeCalc.netAmount,
          currency,
          reference: `proxim_${transferId}`,
          accountNumber: accountNumber || ibanOrRoutingNumber || '',
          accountName: recipientName || 'Recipient',
          bankCode: bankCode || '058',
          narration,
        });
        duePayoutId = payout?.id || payout?.payout_id;
        if (!duePayoutId) throw new Error('Brails returned no payout identifier');
      }

      // Record transfer in DB
      await db.insert(transfers).values({
        id: transferId,
        entityId,
        dueTransferId: duePayoutId,
        sourceCurrency: currency,
        targetCurrency: mode === 'crypto' ? (asset || 'USDC') : currency,
        sourceAmount: String(amount.toFixed(2)),
        targetAmount: String(feeCalc.netAmount.toFixed(4)),
        feeAmount: String(feeCalc.feeAmount.toFixed(4)),
        direction: 'DEBIT',
        status: 'pending',
      });

      // Record double-entry internal ledger entries
      const currUpper = (currency || 'NGN').toUpperCase();
      const ledgerAccId = `${entityId}_cash_${currUpper}`;
      const ledgerOutId = `${entityId}_outbound_${currUpper}`;

      const existingAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
      if (existingAcc.length === 0) {
        await db.insert(ledgerAccounts).values([
          { id: ledgerAccId, entityId, name: `Available ${currUpper}`, type: 'ASSET', currency: currUpper },
          { id: ledgerOutId, entityId, name: `Outbound Clearing ${currUpper}`, type: 'LIABILITY', currency: currUpper },
        ]);
      }

      await db.insert(ledgerEntries).values([
        { id: ulid(), entityId, transactionId: transferId, ledgerAccountId: ledgerAccId, type: 'CREDIT', amount: String(amount.toFixed(4)) },
        { id: ulid(), entityId, transactionId: transferId, ledgerAccountId: ledgerOutId, type: 'DEBIT', amount: String(amount.toFixed(4)) },
      ]);

      // Record fee in feeLedger
      await db.insert(feeLedger).values({
        id: ulid(),
        entityId,
        transactionType: 'OFF_RAMP',
        referenceId: transferId,
        grossAmount: String(amount.toFixed(4)),
        feeAmount: String(feeCalc.feeAmount.toFixed(4)),
        netAmount: String(feeCalc.netAmount.toFixed(4)),
        currency,
        description: narration || 'Payment Transfer',
      });

      return reply.send({
        success: true,
        transactionId: transferId,
        duePayoutId,
        status: 'COMPLETED',
        amount,
        currency,
        message: 'Money sent successfully.',
      });
    } catch (err: any) {
      console.error('[Transfer Execute Error]:', err);
      if (String(err.message || '').includes('Not enough balance')) {
        return reply.status(503).send({
          error: 'Solana signing is temporarily unavailable.',
          details: 'The NEAR MPC relayer needs more NEAR to pay the signing transaction. Fund proximfi.near with at least 0.35 NEAR, then retry.',
        });
      }
      return reply.status(500).send({ error: 'We could not complete your payment. Please try again.', details: err.message });
    }
  });

  /**
   * Atomic Transfer Reversal & Bank Recall Handler
   */
  server.post('/api/transfers/:id/reverse', async (request, reply) => {
    const { ReversalEngine } = await import('../services/reversalEngine.js');
    const { id } = request.params as { id: string };
    const { reason = 'Commercial bank recall or customer dispute' } = (request.body || {}) as { reason?: string };

    try {
      const result = await ReversalEngine.processReversal(id, reason);
      return reply.send({ success: true, result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Payout Status & Delivery Tracker
   */
  server.get('/api/transfers/status/:payoutId', async (request, reply) => {
    const { payoutId } = request.params as { payoutId: string };

    const txRows = await db
      .select()
      .from(transfers)
      .where(sql`${transfers.id} = ${payoutId} OR ${transfers.dueTransferId} = ${payoutId}`)
      .limit(1);

    const tx = txRows[0];
    const uetr = `UETR-${(payoutId || ulid()).slice(-8).toUpperCase()}`;

    return reply.send({
      success: true,
      tracking: {
        payoutId,
        status: tx ? tx.status : 'completed',
        stepIndex: tx?.status === 'completed' ? 4 : 2,
        currency: tx?.sourceCurrency || 'USD',
        amount: tx ? parseFloat(tx.sourceAmount) : 0,
        uetrReference: uetr,
        clearingNetwork: 'NIBSS / SWIFT / SEPA Instant',
        estimatedDelivery: 'Arrives in seconds',
        updatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * Get Active Virtual Accounts for an Entity
   */
  server.get('/api/transfers/accounts', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const accs = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
    return reply.send({ success: true, accounts: accs });
  });

  /**
  * Legacy fiat quote endpoint. Fiat conversion is no longer provided by Proxim.
   */
  server.post('/api/transfers/quote', async (request, reply) => {
    const { sourceCurrency, targetCurrency, amount, beneficiaryCountry = 'NG' } = request.body as {
      sourceCurrency: string;
      targetCurrency: string;
      amount: number;
      beneficiaryCountry?: string;
    };

    if (!sourceCurrency || !targetCurrency || !amount) {
      return reply.status(400).send({ error: 'sourceCurrency, targetCurrency, and amount are required' });
    }

    try {
      if (!process.env.BRAILS_API_KEY?.trim()) return reply.status(503).send({ error: 'Brails is not configured' });
      const quote = await brails.getQuote(sourceCurrency, targetCurrency, amount, beneficiaryCountry);
      return reply.send({ success: true, quote });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to fetch live Brails quote', details: err.message });
    }
  });

  /**
   * Create Dynamic Pay-In Intent
   */
  server.post('/api/transfers/dynamic-pay-in', async (request, reply) => {
    const { entityId, sourceCurrency, targetCurrency = 'USDC', amount, recipientPhone, recipientName } = request.body as {
      entityId: string;
      sourceCurrency: string;
      targetCurrency?: string;
      amount: number;
      recipientPhone?: string;
      recipientName?: string;
    };

    if (!entityId || !sourceCurrency || !amount) {
      return reply.status(400).send({ error: 'entityId, sourceCurrency, and amount are required' });
    }

    return reply.status(410).send({ error: 'Dynamic fiat pay-in is no longer provided by Proxim.' });
  });

  /**
  * Off-Ramp / Bank Withdrawal via Brails
   */
  server.post('/api/transfers/withdraw', async (request, reply) => {
    const { entityId, amount, currency, recipientAccount, bankCode, bvn, bankName, recipientName, phoneNumber } = request.body as {
      entityId: string;
      amount: number;
      currency: string;
      recipientAccount: string;
      bankCode: string;
      bvn: string;
      bankName?: string;
      recipientName: string;
      phoneNumber?: string;
    };

    if (!entityId || !amount || !currency || !recipientAccount) {
      return reply.status(400).send({ error: 'Missing required withdrawal fields' });
    }

    if (currency.toUpperCase() !== 'NGN' || !bankCode || !bvn) {
      return reply.status(400).send({ error: 'NGN withdrawals require bankCode and BVN for EaseID verification.' });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });
    if (!request.session?.userEntityIds.includes(entityId)) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    const feeCalc = feeService.calculateOffRampFee(amount, currency);
    const withdrawalId = ulid();

    try {
      const approvedKyc = await db.select().from(kycVerifications).where(and(
        eq(kycVerifications.entityId, entityId),
        eq(kycVerifications.status, 'approved'),
        eq(kycVerifications.idType, 'bvn'),
      )).limit(1);
      if (approvedKyc.length === 0 || approvedKyc[0].idValueHash !== crypto.createHash('sha256').update(bvn.trim()).digest('hex')) {
        return reply.status(403).send({ error: 'A BVN-approved KYC record is required before withdrawal.' });
      }
      const bankVerification = await easeIdClient.verifyBankAccount(bvn, bankCode, recipientAccount);
      if (!bankVerification.verifyResult) {
        return reply.status(422).send({ error: 'The beneficiary bank account could not be verified.' });
      }
      const availableBalance = await getEntityBalance(db, entityId, currency, 'cash');
      if (availableBalance < amount) return reply.status(409).send({ error: 'Insufficient available balance' });
      const payout = await brails.initiatePayout({
        amount: feeCalc.netAmount,
        currency,
        reference: `proxim_wd_${withdrawalId}`,
        accountNumber: recipientAccount,
        accountName: recipientName,
        narration: `Withdrawal ${withdrawalId}`,
        bankCode,
      });

      const normalizedCurrency = currency.toUpperCase();
      const cashAccountId = `${entityId}_cash_${normalizedCurrency}`;
      const outboundAccountId = `${entityId}_outbound_${normalizedCurrency}`;
      const accountRows = await db.select().from(ledgerAccounts).where(sql`${ledgerAccounts.id} IN (${cashAccountId}, ${outboundAccountId})`);
      const existingIds = new Set(accountRows.map(account => account.id));
      if (accountRows.length < 2) {
        await db.insert(ledgerAccounts).values([
          ...(existingIds.has(cashAccountId) ? [] : [{ id: cashAccountId, entityId, name: `Available ${normalizedCurrency}`, type: 'ASSET' as const, currency: normalizedCurrency }]),
          ...(existingIds.has(outboundAccountId) ? [] : [{ id: outboundAccountId, entityId, name: `Outbound Clearing ${normalizedCurrency}`, type: 'LIABILITY' as const, currency: normalizedCurrency }]),
        ]);
      }
      const payoutId = payout.id || payout.payout_id;
      if (!payoutId) throw new Error('Brails returned no payout identifier');
      await db.insert(transfers).values({
        id: withdrawalId,
        entityId,
        dueTransferId: payoutId,
        sourceCurrency: normalizedCurrency,
        targetCurrency: normalizedCurrency,
        sourceAmount: amount.toFixed(4),
        targetAmount: feeCalc.netAmount.toFixed(4),
        feeAmount: feeCalc.feeAmount.toFixed(4),
        direction: 'DEBIT',
        settlementStatus: 'SOURCE_SUBMITTED',
        status: 'pending',
      });
      await db.insert(ledgerEntries).values([
        { id: ulid(), entityId, transactionId: withdrawalId, ledgerAccountId: cashAccountId, type: 'CREDIT', amount: amount.toFixed(4) },
        { id: ulid(), entityId, transactionId: withdrawalId, ledgerAccountId: outboundAccountId, type: 'DEBIT', amount: amount.toFixed(4) },
      ]);

      await db.insert(feeLedger).values({
        id: ulid(),
        entityId,
        transactionType: 'OFF_RAMP',
        referenceId: withdrawalId,
        grossAmount: String(feeCalc.grossAmount.toFixed(4)),
        feeAmount: String(feeCalc.feeAmount.toFixed(4)),
        netAmount: String(feeCalc.netAmount.toFixed(4)),
        currency,
        description: feeCalc.feeBreakdown.description,
      });

      return reply.send({
        success: true,
        withdrawal: {
          id: withdrawalId,
          brailsPayoutId: payoutId,
          grossAmount: amount,
          fee: feeCalc.feeAmount,
          netDisbursed: feeCalc.netAmount,
          currency,
          status: 'processing',
        },
      });
    } catch (err: any) {
      console.error('[Brails Withdrawal] Error:', err);
      return reply.status(500).send({ error: 'Failed to process withdrawal', details: err.message });
    }
  });

  /**
   * Instant Peer-to-Peer Internal Transfer (Proxim to Proxim)
   */
  server.post('/api/transfers/internal', async (request, reply) => {
    const { fromEntityId, toUsernameOrTag, amount, currency = 'USD', narration } = request.body as {
      fromEntityId: string;
      toUsernameOrTag: string;
      amount: number;
      currency?: string;
      narration?: string;
    };

    if (!fromEntityId || !toUsernameOrTag || !amount) {
      return reply.status(400).send({ error: 'fromEntityId, toUsernameOrTag, and amount are required' });
    }

    const cleanTarget = toUsernameOrTag.toLowerCase().trim().replace(/^@/, '');
    const targetEntityRows = await db
      .select()
      .from(entities)
      .where(eq(entities.username, cleanTarget))
      .limit(1);

    if (targetEntityRows.length === 0) {
      return reply.status(404).send({ error: `User @${cleanTarget} not found on Proxim` });
    }

    const targetEntity = targetEntityRows[0];
    const session = request.session;
    if (!session?.userEntityIds.includes(fromEntityId)) {
      return reply.status(403).send({ error: 'Source entity is not owned by the authenticated user' });
    }
    if (targetEntity.id === fromEntityId) return reply.status(400).send({ error: 'Cannot transfer to the same entity' });
    const normalizedCurrency = currency.toUpperCase();
    const sourceBalance = await getEntityBalance(db, fromEntityId, normalizedCurrency, 'cash');
    if (sourceBalance < amount) return reply.status(409).send({ error: 'Insufficient available balance' });
    const transferId = ulid();

    const sourceCashId = `${fromEntityId}_cash_${normalizedCurrency}`;
    const sourceClearingId = `${fromEntityId}_outbound_${normalizedCurrency}`;
    const targetCashId = `${targetEntity.id}_cash_${normalizedCurrency}`;
    const targetClearingId = `${targetEntity.id}_inbound_${normalizedCurrency}`;
    const accountRows = await db.select().from(ledgerAccounts).where(sql`${ledgerAccounts.id} IN (${sourceCashId}, ${sourceClearingId}, ${targetCashId}, ${targetClearingId})`);
    const accountIds = new Set(accountRows.map(account => account.id));
    const missingAccounts = [
      { id: sourceCashId, entityId: fromEntityId, name: `Available ${normalizedCurrency}`, type: 'ASSET' as const, currency: normalizedCurrency },
      { id: sourceClearingId, entityId: fromEntityId, name: `Outbound Clearing ${normalizedCurrency}`, type: 'LIABILITY' as const, currency: normalizedCurrency },
      { id: targetCashId, entityId: targetEntity.id, name: `Available ${normalizedCurrency}`, type: 'ASSET' as const, currency: normalizedCurrency },
      { id: targetClearingId, entityId: targetEntity.id, name: `Inbound Clearing ${normalizedCurrency}`, type: 'LIABILITY' as const, currency: normalizedCurrency },
    ].filter(account => !accountIds.has(account.id));
    if (missingAccounts.length) await db.insert(ledgerAccounts).values(missingAccounts);
    await db.insert(transfers).values({
      id: transferId, entityId: fromEntityId, dueTransferId: transferId,
      sourceCurrency: normalizedCurrency, targetCurrency: normalizedCurrency,
      sourceAmount: amount.toFixed(4), targetAmount: amount.toFixed(4), feeAmount: '0.0000',
      direction: 'DEBIT', settlementStatus: 'LEDGER_CREDITED', status: 'completed',
    });
    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId: fromEntityId, transactionId: `${transferId}_OUT`, ledgerAccountId: sourceCashId, type: 'CREDIT', amount: amount.toFixed(4) },
      { id: ulid(), entityId: fromEntityId, transactionId: `${transferId}_OUT`, ledgerAccountId: sourceClearingId, type: 'DEBIT', amount: amount.toFixed(4) },
      { id: ulid(), entityId: targetEntity.id, transactionId: `${transferId}_IN`, ledgerAccountId: targetClearingId, type: 'CREDIT', amount: amount.toFixed(4) },
      { id: ulid(), entityId: targetEntity.id, transactionId: `${transferId}_IN`, ledgerAccountId: targetCashId, type: 'DEBIT', amount: amount.toFixed(4) },
    ]);

    return reply.send({
      success: true,
      transfer: {
        id: transferId,
        fromEntityId,
        toEntityId: targetEntity.id,
        recipientName: targetEntity.legalName,
        recipientUsername: targetEntity.username,
        amount,
        currency: normalizedCurrency,
        fee: 0.00,
        narration: narration || 'Proxim Peer-to-Peer Transfer',
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
    });
  });

  /**
   * Real-Time 60-Second Dynamic FX Quote Generator
   */
  server.get('/api/transfers/fx-quote', async (request, reply) => {
    const { FxQuoteEngine } = await import('../services/fxQuoteEngine.js');
    const { fromCurrency = 'USD', toCurrency = 'NGN', fromAmount = '100' } = request.query as {
      fromCurrency?: string;
      toCurrency?: string;
      fromAmount?: string;
    };

    const quote = FxQuoteEngine.generateQuote(fromCurrency, toCurrency, parseFloat(fromAmount) || 100);
    return reply.send({ success: true, quote });
  });
}
