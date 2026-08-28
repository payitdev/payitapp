import { and, eq } from '@payit/db';
import { gasSponsorships, ledgerAccounts, ledgerEntries } from '@payit/db/schema';
import type { DbClient } from '@payit/db/client';
import { ulid } from 'ulid';

const NATIVE_SCALE = 18n;
const USD_SCALE = 8n;

function decimalToUnits(value: string, scale: bigint): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error(`Invalid decimal value: ${value}`);
  const [whole, fraction = ''] = normalized.split('.');
  const padded = fraction.padEnd(Number(scale), '0').slice(0, Number(scale));
  return BigInt(whole) * 10n ** scale + BigInt(padded || '0');
}

function unitsToDecimal(units: bigint, scale: bigint): string {
  const base = 10n ** scale;
  const whole = units / base;
  const fraction = (units % base).toString().padStart(Number(scale), '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function calculateEvmGasCost(params: {
  gasUsed: string | bigint;
  effectiveGasPrice: string | bigint;
  nativeUsdPrice: string;
}) {
  const nativeUnits = BigInt(params.gasUsed) * BigInt(params.effectiveGasPrice);
  const priceUnits = decimalToUnits(params.nativeUsdPrice, USD_SCALE);
  const chargeUnits = (nativeUnits * priceUnits) / 10n ** NATIVE_SCALE;
  return {
    actualGasNative: unitsToDecimal(nativeUnits, NATIVE_SCALE),
    chargedAmount: unitsToDecimal(chargeUnits, USD_SCALE),
  };
}

export function calculateReserve(estimatedGasNative: string, nativeUsdPrice: string): string {
  const nativeUnits = decimalToUnits(estimatedGasNative, NATIVE_SCALE);
  const priceUnits = decimalToUnits(nativeUsdPrice, USD_SCALE);
  return unitsToDecimal((nativeUnits * priceUnits) / 10n ** NATIVE_SCALE, USD_SCALE);
}

export async function fetchNativeUsdPrice(nativeAsset: string): Promise<{ price: string; timestamp: Date }> {
  const ids: Record<string, string> = { ETH: 'ethereum', POL: 'matic-network', BNB: 'binancecoin' };
  const id = ids[nativeAsset.toUpperCase()];
  if (!id) throw new Error(`No approved price asset mapping for ${nativeAsset}`);
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, {
    headers: process.env.COINGECKO_API_KEY ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY } : undefined,
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error(`Price provider returned HTTP ${response.status}`);
  const body = await response.json() as Record<string, { usd?: number }>;
  const price = body[id]?.usd;
  if (!price || !Number.isFinite(price) || price <= 0) throw new Error('Price provider returned no valid USD price');
  return { price: price.toFixed(8), timestamp: new Date() };
}

export async function waitForEvmReceipt(rpcUrl: string, txHash: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'gas-receipt', method: 'eth_getTransactionReceipt', params: [txHash] }),
      signal: AbortSignal.timeout(3500),
    });
    const body = await response.json() as { result?: { status?: string; gasUsed?: string; effectiveGasPrice?: string } };
    if (body.result) return body.result;
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error('EVM receipt confirmation timed out');
}

export async function settleEvmGasSponsorship(params: {
  db: DbClient;
  sponsorshipId: string;
  gasUsed: string | bigint;
  effectiveGasPrice: string | bigint;
  nativeUsdPrice: string;
  priceTimestamp: Date;
}) {
  const cost = calculateEvmGasCost(params);
  const rows = await params.db.select().from(gasSponsorships).where(eq(gasSponsorships.id, params.sponsorshipId)).limit(1);
  const sponsorship = rows[0];
  if (!sponsorship) throw new Error('Gas sponsorship operation not found');
  if (sponsorship.status === 'RESERVE_RELEASED' || sponsorship.status === 'CHARGED') return cost;

  await params.db.update(gasSponsorships).set({
    actualGasNative: cost.actualGasNative,
    nativeUsdPrice: params.nativeUsdPrice,
    priceTimestamp: params.priceTimestamp,
    chargedAmount: cost.chargedAmount,
    status: 'COST_CALCULATED',
    updatedAt: new Date(),
  }).where(and(eq(gasSponsorships.id, params.sponsorshipId), eq(gasSponsorships.status, 'CONFIRMED')));

  const cashAccountId = `${sponsorship.entityId}_cash_${sponsorship.chargedStablecoin}`;
  const recoveryAccountId = `${sponsorship.entityId}_gas_recovery_${sponsorship.chargedStablecoin}`;
  const accounts = await params.db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, cashAccountId)).limit(1);
  if (accounts.length === 0) {
    await params.db.insert(ledgerAccounts).values([
      { id: cashAccountId, entityId: sponsorship.entityId, name: `Available ${sponsorship.chargedStablecoin}`, type: 'ASSET', currency: sponsorship.chargedStablecoin },
      { id: recoveryAccountId, entityId: sponsorship.entityId, name: `Gas Recovery ${sponsorship.chargedStablecoin}`, type: 'EXPENSE', currency: sponsorship.chargedStablecoin },
    ]);
  }
  const transactionId = `gas:${sponsorship.id}`;
  const existingEntries = await params.db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, transactionId)).limit(1);
  if (existingEntries.length === 0 && decimalToUnits(cost.chargedAmount, USD_SCALE) > 0n) {
    await params.db.insert(ledgerEntries).values([
      { id: ulid(), entityId: sponsorship.entityId, transactionId, ledgerAccountId: cashAccountId, type: 'CREDIT', amount: cost.chargedAmount },
      { id: ulid(), entityId: sponsorship.entityId, transactionId, ledgerAccountId: recoveryAccountId, type: 'DEBIT', amount: cost.chargedAmount },
    ]);
  }
  const reserved = decimalToUnits(sponsorship.reservedStablecoin || '0', USD_SCALE);
  const charged = decimalToUnits(cost.chargedAmount, USD_SCALE);
  const releasedAmount = unitsToDecimal(reserved > charged ? reserved - charged : 0n, USD_SCALE);
  await params.db.update(gasSponsorships).set({ status: 'RESERVE_RELEASED', releasedAmount, updatedAt: new Date() }).where(eq(gasSponsorships.id, params.sponsorshipId));
  return cost;
}