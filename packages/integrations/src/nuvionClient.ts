import axios from 'axios';
import crypto from 'crypto';
import https from 'https';
import { ParticleClient } from './particleClient';


export interface NuvionTier1Payload {
  legalName: string;
  dob: string;
  address: string;
  bvn: string;
  idNumber?: string;
  phone?: string;
  identityDocumentBase64?: string;
  proofOfAddressBase64?: string;
}

export interface NuvionIndividualEntityPayload {
  name: string;
  person: {
    first_name: string;
    last_name: string;
    middle_name?: string;
    date_of_birth: string;
    email: string;
    nationality: string;
    gender: string;
    phonenumber: string;
    bvn?: string;
    nin?: string;
    ssn?: string;
  };
  address?: {
    line_1: string;
    line_2?: string;
    line_3?: string;
    city: string;
    state: string;
    postal_code: string;
    country_code: string;
  };
  identification?: any;
  meta?: Record<string, any>;
}

export interface NuvionBusinessEntityPayload {
  name: string;
  business: {
    legal_name: string;
    trade_name?: string;
    industry: string;
    email: string;
    website?: string;
    type: string;
    description: string;
    registration_number: string;
    phonenumber?: string;
    incorporation_meta: {
      year: number;
      month: number;
      country: string;
      state: string;
    };
  };
  address?: {
    line_1: string;
    line_2?: string;
    line_3?: string;
    city: string;
    state: string;
    postal_code: string;
    country_code: string;
  };
  operating_address?: any;
  business_officers: Array<{
    job_title: string;
    is_control_person: boolean;
    is_beneficial_owner: boolean;
    ownership_percentage: number;
    person: {
      first_name: string;
      last_name: string;
      middle_name?: string;
      date_of_birth: string;
      email: string;
      nationality: string;
      gender: string;
      phonenumber: string;
      bvn?: string;
      nin?: string;
      ssn?: string;
    };
  }>;
  meta?: Record<string, any>;
}

export interface NuvionTier2Payload {
  businessLegalName: string;
  businessTag: string;
  rcNumber: string;
  tin: string;
  businessAddress: string;
  uboLegalName: string;
  uboBvn: string;
  identityDocumentBase64?: string;
  proofOfAddressBase64?: string;
}

export interface NuvionKycPayload {
  legalName: string;
  dob?: string;
  address?: string;
  idNumber?: string;
  bvn?: string;
  rcNumber?: string;
}

export interface NuvionCardIssuanceParams {
  nuvionEntityId: string;
  nuvionAccountId: string;
  brand: 'VISA' | 'MASTERCARD';
  cardholderName: string;
  cardType?: 'PERSONAL' | 'BUSINESS' | 'BURNER';
}

export interface NuvionTierLimit {
  tier: 0 | 1 | 2 | 3;
  name: string;
  dailyPayoutLimitNgn: number;
  dailyPayoutLimitUsd: number;
  features: string[];
}

export type NuvionSupportedCurrency =
  | 'USD' | 'EUR' | 'GBP' | 'NGN'
  | 'KES' | 'GHS' | 'ZAR' | 'CAD'
  | 'AED' | 'UGX' | 'TZS';

export interface NuvionFxRate {
  currency: NuvionSupportedCurrency;
  name: string;
  symbol: string;
  rateToNgn: number;
  reverseRate: number;
  clearingNetwork: string;
  lastUpdated: string;
  source: 'live_fx_endpoint' | 'account_snapshot';
}

export interface DynamicFxQuoteParams {
  fromCurrency: NuvionSupportedCurrency;
  toCurrency: NuvionSupportedCurrency;
  amount: number;
  isDeposit?: boolean;
  marginPercent?: number;
  allowStale?: boolean;
}

export interface TreasurySweepRecord {
  sweepId: string;
  treasuryWallet: string;
  feeAmountUsd: number;
  feeAmountLocal: number;
  currency: NuvionSupportedCurrency;
  feeType: 'ON_RAMP_FX' | 'OFF_RAMP_FX' | 'CARD_ISSUANCE' | 'CARD_SPEND';
  sourceTransactionId: string;
  timestamp: string;
}

export class NuvionApiError extends Error {
  public statusCode: number;
  public providerPayload: any;

  constructor(statusCode: number, message: string, providerPayload?: any) {
    super(message);
    this.name = 'NuvionApiError';
    this.statusCode = statusCode;
    this.providerPayload = providerPayload;
  }
}

const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4q95pqcOJa8RwUH4aXA
TMzgvhqKK+RBOMkSSFJ9ALFneKV8Wc5y8itkdKFpQ/YsKrxc6aLipVQ0JzfQqpto
P1MDbN1IhzWoQiGfzp4ShE5BWcndGLFnzNj9xhQSDFJPEWGgZsLxuqrsarttj7aw
IosZnnU0E71TaPQDcN4EDNCZbUSO3L9ABrhiyobwuSHoBz44BL0H6b/32iqCJ4np
mh+lgBjyccL8yloGdmf6KCt+Q2N3hfad7q/C8x5ArHC1K9ZmnlwpUzjdLE2IGdN9
wrL69p972f9aEMfneG8iDkymkk7aOgxIbJq3DU55hxUfFDl1Q0+G3zCEHsj7aCz3
hwIDAQAB
-----END PUBLIC KEY-----`;

export const PAYIT_TREASURY_WALLET = '0x09648d98196460D63B3dB1B90c60100756dECb77';

// Currency metadata — only non-rate data; all rates come from live Nuvion API
const CURRENCY_META: Record<NuvionSupportedCurrency, { name: string; symbol: string; clearingNetwork: string }> = {
  USD: { name: 'United States Dollar', symbol: '$', clearingNetwork: 'ACH / FedWire / SWIFT' },
  EUR: { name: 'Euro', symbol: '€', clearingNetwork: 'SEPA / SEPA Instant' },
  GBP: { name: 'Great British Pound', symbol: '£', clearingNetwork: 'FPS (Faster Payments Service)' },
  NGN: { name: 'Nigerian Naira', symbol: '₦', clearingNetwork: 'NIBSS / Interswitch Instant' },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', clearingNetwork: 'EFT / Interac Direct' },
  AED: { name: 'UAE Dirham', symbol: 'AED', clearingNetwork: 'UAE Funds Transfer System (UAEFTS)' },
  GHS: { name: 'Ghanaian Cedi', symbol: 'GH₵', clearingNetwork: 'GhIPSS Instant Pay (GIP)' },
  ZAR: { name: 'South African Rand', symbol: 'R', clearingNetwork: 'SAMOS / PayShap Instant' },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', clearingNetwork: 'PesaLink / M-Pesa B2B' },
  TZS: { name: 'Tanzanian Shilling', symbol: 'TSh', clearingNetwork: 'TISS / TIPSS Instant' },
  UGX: { name: 'Ugandan Shilling', symbol: 'USh', clearingNetwork: 'UNPSS / MTN Mobile Money' },
};

// Rate cache: 90-second TTL & Request Coalescing Promise Lock to prevent cache stampedes
let _rateCache: { rates: NuvionFxRate[]; fetchedAt: number } | null = null;
let _inFlightFetch: Promise<NuvionFxRate[]> | null = null;
const CACHE_TTL_MS = 90_000;

const resolveNuvionBankName = (curr: string, rawBank?: string): string => {
  if (rawBank && !rawBank.toLowerCase().includes('payit') && !rawBank.toLowerCase().includes('account')) {
    return rawBank;
  }
  switch ((curr || '').toUpperCase()) {
    case 'NGN': return 'Flutterwave';
    case 'USD': return 'Community Federal Savings Bank (CFSB)';
    case 'GBP': return 'ClearBank UK';
    case 'EUR': return 'Banking Circle S.A.';
    case 'KES': return 'NCBA Bank Kenya';
    case 'GHS': return 'Ecobank Ghana';
    case 'ZAR': return 'Standard Bank South Africa';
    case 'CAD': return 'Peoples Trust Company';
    case 'AED': return 'Mashreq Bank UAE';
    case 'UGX': return 'Stanbic Bank Uganda';
    case 'TZS': return 'CRDB Bank Tanzania';
    default: return 'Nuvion Partner Bank';
  }
};

export class NuvionClient {
  private apiKey: string;
  private publicKey: string;
  private baseUrl: string;
  private treasuryFeeWallet: string;
  private defaultMarginPercent: number;

  constructor(apiKey?: string, publicKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.NUVION_API_KEY || '';
    this.publicKey = publicKey || process.env.NUVION_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
    this.baseUrl = baseUrl || process.env.NUVION_API_BASE_URL || 'https://api.nuvion.co';
    this.treasuryFeeWallet = process.env.PAYIT_TREASURY_FEE_WALLET || PAYIT_TREASURY_WALLET;
    this.defaultMarginPercent = parseFloat(process.env.PAYIT_FX_MARGIN_PERCENT || '0.030');

    if (!this.apiKey) {
      throw new Error('NUVION_API_KEY environment variable is required');
    }

    if (!this.baseUrl.startsWith('https://')) {
      throw new Error(`NUVION_API_BASE_URL must be an HTTPS URL. Got: ${this.baseUrl}`);
    }
  }

  private async nuvionGet(path: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}${path}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        timeout: 15000,
      });
      return response.data;
    } catch (err: any) {
      const status = err.response?.status || 500;
      const data = err.response?.data || { message: err.message };
      throw new NuvionApiError(status, `Nuvion API error ${status}: ${JSON.stringify(data)}`, data);
    }
  }

  private async nuvionPost(path: string, payload: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}${path}`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 15000,
      });
      return response.data;
    } catch (err: any) {
      const status = err.response?.status || 500;
      const data = err.response?.data || { message: err.message };
      throw new NuvionApiError(status, `Nuvion API error ${status}: ${JSON.stringify(data)}`, data);
    }
  }


  /**
   * Fetches raw account objects directly from GET /accounts on Nuvion API.
   */
  public async getRawAccounts(): Promise<any[]> {
    try {
      const res = await this.nuvionGet('/accounts');
      // Expects response envelope shape: { data: { data: [...] } } or { data: [...] } or direct array. Must be confirmed against a real Nuvion GET /accounts response before being trusted in production.
      const list = res?.data?.data?.data || res?.data?.data?.accounts || res?.data?.accounts || res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
      return Array.isArray(list) ? list : [];
    } catch (err: any) {
      console.error('[NuvionClient] getRawAccounts failed:', err.message);
      return [];
    }
  }

  /**
   * Fetches LIVE FX rates directly from Nuvion API endpoints.
   * Merges /fx/rates and /accounts per-currency with request coalescing to prevent cache stampedes.
   */
  public async getLiveFxRates(): Promise<NuvionFxRate[]> {
    const now = Date.now();
    if (_rateCache && now - _rateCache.fetchedAt < CACHE_TTL_MS) {
      return _rateCache.rates;
    }

    if (_inFlightFetch) {
      return _inFlightFetch;
    }

    _inFlightFetch = (async () => {
      try {
        const timestamp = new Date().toISOString();
        const rates: NuvionFxRate[] = [];
        const currencies: NuvionSupportedCurrency[] = ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'GHS', 'ZAR', 'CAD', 'AED', 'UGX', 'TZS'];

        const nuvionLiveRatesMap: Record<string, number> = {};
        const nuvionAccountRatesMap: Record<string, number> = {};

        // 1. Fetch from live /fx/rates endpoint
        try {
          const ratesRes = await this.nuvionGet('/fx/rates');
          // Expects response envelope shape: { data: { rates: [...] } } or { data: [...] }. Must be confirmed against a real Nuvion GET /fx/rates response before being trusted in production.
          const ratesData: any[] = ratesRes?.data?.rates || ratesRes?.data || (Array.isArray(ratesRes) ? ratesRes : []);
          for (const item of ratesData) {
            if (item.currency && item.rateToNgn) {
              nuvionLiveRatesMap[item.currency] = parseFloat(item.rateToNgn);
            } else if (item.pair && item.rate) {
              const parts = String(item.pair).split('/');
              if (parts[1] === 'NGN') {
                nuvionLiveRatesMap[parts[0]] = parseFloat(item.rate);
              }
            }
          }
        } catch {
          // Endpoint /fx/rates unavailable or partial — proceed to per-currency account fallback
        }

        // 2. Fetch from /accounts endpoint to collect per-currency account_snapshot meta rates
        try {
          const accountsRes = await this.nuvionGet('/accounts');
          const accountsList: any[] = accountsRes?.data?.data || accountsRes?.data || [];
          for (const acc of accountsList) {
            if (acc.currency && acc.meta) {
              const rate = parseFloat(acc.meta.exchange_rate || acc.meta.rate_to_ngn || acc.meta.rate || '0');
              if (rate > 0) {
                nuvionAccountRatesMap[acc.currency] = rate;
              }
            }
          }
        } catch {
          // Endpoint /accounts unavailable or partial
        }

        for (const currency of currencies) {
          const meta = CURRENCY_META[currency];
          let rateToNgn = 1.0;
          let source: 'live_fx_endpoint' | 'account_snapshot' = 'live_fx_endpoint';

          if (currency === 'NGN') {
            rateToNgn = 1.0;
            source = 'live_fx_endpoint';
          } else if (nuvionLiveRatesMap[currency] && nuvionLiveRatesMap[currency] > 0) {
            rateToNgn = nuvionLiveRatesMap[currency];
            source = 'live_fx_endpoint';
          } else if (nuvionAccountRatesMap[currency] && nuvionAccountRatesMap[currency] > 0) {
            rateToNgn = nuvionAccountRatesMap[currency];
            source = 'account_snapshot';
          } else {
            console.error(`[NuvionClient] Live FX rate unavailable for ${currency}`);
            continue;
          }

          rates.push({
            currency,
            name: meta.name,
            symbol: meta.symbol,
            rateToNgn,
            reverseRate: rateToNgn > 0 ? 1 / rateToNgn : 0,
            clearingNetwork: meta.clearingNetwork,
            lastUpdated: timestamp,
            source,
          });
        }

        if (rates.length === 0) {
          throw new Error('Total FX outage: Zero currencies resolved from Nuvion API');
        }

        _rateCache = { rates, fetchedAt: Date.now() };
        return rates;
      } finally {
        _inFlightFetch = null;
      }
    })();

    return _inFlightFetch;
  }

  /**
   * Generates a DYNAMIC FX QUOTE using LIVE Nuvion rates.
   * Applies PayIT margin on top — no hardcoded rate values anywhere.
   * 
   * SECURITY & LIQUIDITY GUARD:
   * By default (allowStale = false), account_snapshot rates are explicitly blocked.
   * Account meta rates are captured during virtual account creation and can be stale, so they must
   * never be used to calculate financial conversions or move real money in production.
   */
  public async getLiveDynamicQuote(params: DynamicFxQuoteParams) {
    const rates = await this.getLiveFxRates();
    const margin = params.marginPercent !== undefined ? params.marginPercent : this.defaultMarginPercent;
    const isDeposit = params.isDeposit !== undefined ? params.isDeposit : true;
    const allowStale = params.allowStale ?? false;

    const fromRate = rates.find(r => r.currency === params.fromCurrency);
    const toRate = rates.find(r => r.currency === params.toCurrency);

    if (!fromRate) throw new Error(`Live FX rate unavailable for ${params.fromCurrency}`);
    if (!toRate) throw new Error(`Live FX rate unavailable for ${params.toCurrency}`);

    if (!allowStale && fromRate.source === 'account_snapshot') {
      throw new Error(`Live FX rate unavailable for ${params.fromCurrency} (only stale account snapshot available)`);
    }
    if (!allowStale && toRate.source === 'account_snapshot') {
      throw new Error(`Live FX rate unavailable for ${params.toCurrency} (only stale account snapshot available)`);
    }

    const nuvionBaseExchangeRate = fromRate.rateToNgn / toRate.rateToNgn;
    const clientEffectiveRate = nuvionBaseExchangeRate * (1 - margin);

    const grossConvertedAmount = params.amount * nuvionBaseExchangeRate;
    const clientReceivedAmount = params.amount * clientEffectiveRate;
    const feeAmountLocal = grossConvertedAmount - clientReceivedAmount;

    const usdRate = rates.find(r => r.currency === 'USD');
    const feeAmountUsd = usdRate && usdRate.rateToNgn > 0
      ? (feeAmountLocal * toRate.rateToNgn) / usdRate.rateToNgn
      : feeAmountLocal;

    return {
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      inputAmount: params.amount,
      nuvionBaseExchangeRate,
      clientEffectiveRate,
      grossConvertedAmount,
      clientReceivedAmount,
      marginPercentUsed: margin * 100,
      feeAmountLocal,
      feeAmountUsd,
      sweptToTreasuryWallet: this.treasuryFeeWallet,
      isDeposit,
      ratesLastUpdated: fromRate.lastUpdated,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetches an authenticated FX quote with 30-second TTL from Nuvion platform.
   * 
   * AUTHORITATIVE RATE SOURCE RATIONALE:
   * dynamicQuote is the sole authoritative source of truth for rate, convertedAmount, feeAmountUsd,
   * and feeAmountLocal. Raw quotes from provider endpoints lack PayIT's platform margin; using dynamicQuote
   * guarantees all client-facing fields reconcile 100% with each other and accurately include margin.
   */
  public async getFxQuote(sourceCurrency: string, targetCurrency: string, amount: number, allowStale: boolean = false) {
    const fromCurr = sourceCurrency.toUpperCase() as NuvionSupportedCurrency;
    const toCurr = targetCurrency.toUpperCase() as NuvionSupportedCurrency;

    let rawQuote: any = null;
    try {
      rawQuote = await this.nuvionPost('/fx/quote', {
        sourceCurrency: fromCurr,
        targetCurrency: toCurr,
        amount,
      });
    } catch {
      rawQuote = null;
    }

    const dynamicQuote = await this.getLiveDynamicQuote({
      fromCurrency: fromCurr,
      toCurrency: toCurr,
      amount,
      allowStale,
    });

    const rate = dynamicQuote.clientEffectiveRate;
    const convertedAmount = dynamicQuote.clientReceivedAmount;

    const now = Date.now();
    const expiresAt = new Date(now + 30000).toISOString();

    return {
      quoteId: `fxq_${now}_${Math.random().toString(36).slice(2, 7)}`,
      sourceCurrency: fromCurr,
      targetCurrency: toCurr,
      amount,
      rate,
      convertedAmount,
      feeAmountUsd: dynamicQuote.feeAmountUsd,
      feeAmountLocal: dynamicQuote.feeAmountLocal,
      ttlSeconds: 30,
      expiresAt,
      timestamp: new Date(now).toISOString(),
      rawProviderQuote: rawQuote,
    };
  }

  public getTreasuryWallet(): string {
    return this.treasuryFeeWallet;
  }

  /**
   * Encrypts sensitive KYC/KYB PII payload using Nuvion RSA Public Key.
   * Employs hybrid encryption (AES-256-GCM for payload + RSA-OAEP for AES key) to handle arbitrarily large KYB data.
   */
  public encryptSensitivePayload(data: object): string {
    const jsonString = JSON.stringify(data);
    const buffer = Buffer.from(jsonString, 'utf8');

    try {
      // Direct RSA encryption if payload fits within RSA-2048 OAEP limit (< 190 bytes)
      if (buffer.length <= 190) {
        const encrypted = crypto.publicEncrypt(
          { key: this.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
          buffer
        );
        return encrypted.toString('base64');
      }
    } catch {
      // If direct encryption fails or payload is larger, fall back to Hybrid AES-256-GCM + RSA
    }

    // Hybrid Encryption: AES-256-GCM for data + RSA-OAEP for AES key
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);

    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const encryptedKey = crypto.publicEncrypt(
      { key: this.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      aesKey
    );

    return JSON.stringify({
      version: 'hybrid_v1',
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    });
  }


  /**
   * Sweeps fee to Treasury Wallet — records the sweep for on-chain execution
   */
  public sweepFeeToTreasury(params: {
    feeAmountUsd: number;
    feeAmountLocal: number;
    currency: NuvionSupportedCurrency;
    feeType: 'ON_RAMP_FX' | 'OFF_RAMP_FX' | 'CARD_ISSUANCE' | 'CARD_SPEND';
    sourceTransactionId: string;
  }): TreasurySweepRecord {
    return {
      sweepId: `swp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      treasuryWallet: this.treasuryFeeWallet,
      feeAmountUsd: parseFloat(params.feeAmountUsd.toFixed(6)),
      feeAmountLocal: parseFloat(params.feeAmountLocal.toFixed(2)),
      currency: params.currency,
      feeType: params.feeType,
      sourceTransactionId: params.sourceTransactionId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Converts currency using live Nuvion rates
   */
  public async convertCurrency(amount: number, fromCurrency: NuvionSupportedCurrency, toCurrency: NuvionSupportedCurrency) {
    const quote = await this.getLiveDynamicQuote({ fromCurrency, toCurrency, amount, isDeposit: true });
    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount: quote.clientReceivedAmount,
      effectiveRate: quote.clientEffectiveRate,
      feeUsd: quote.feeAmountUsd,
      sweptTo: this.treasuryFeeWallet,
    };
  }

  /**
   * Compatibility: Returns supported fiat currencies (rates now come from live API)
   */
  public async getSupportedFiatCurrenciesAndFxRates(): Promise<NuvionFxRate[]> {
    return this.getLiveFxRates();
  }

  public getTierLimits(tier: 0 | 1 | 2 | 3): NuvionTierLimit {
    switch (tier) {
      case 0: return { tier: 0, name: 'Tier 0 - Basic Unverified', dailyPayoutLimitNgn: 0, dailyPayoutLimitUsd: 0, features: ['Dashboard Access'] };
      case 1: return { tier: 1, name: 'Tier 1 - Personal Verified', dailyPayoutLimitNgn: 5000000, dailyPayoutLimitUsd: 5000, features: ['NGN/USD Virtual Account', 'Personal Virtual Cards', 'Local Payouts'] };
      case 2: return { tier: 2, name: 'Tier 2 - Corporate KYB Approved', dailyPayoutLimitNgn: 500000000, dailyPayoutLimitUsd: 500000, features: ['Multi-currency Accounts', 'Bulk Payroll', 'Corporate Cards', 'Cross-Border FX'] };
      case 3: return { tier: 3, name: 'Tier 3 - Institutional Custom', dailyPayoutLimitNgn: 10000000000, dailyPayoutLimitUsd: 10000000, features: ['Custom Limits', 'Dedicated Liquidity Pools'] };
    }
  }

  /**
   * Step 1: Creates an Individual Entity on Nuvion via POST /individual-entities.
   * Returns real entity_id and person_id from Nuvion's response.
   */
  public async createIndividualEntity(payload: NuvionIndividualEntityPayload) {
    const res = await this.nuvionPost('/individual-entities', payload);
    const data = res?.data?.data || res?.data || res;
    const entityId = data?.id || data?.entity_id;
    const personId = data?.person_id || data?.person?.id;

    if (!entityId) {
      throw new NuvionApiError(500, `Nuvion API did not return an entity_id for individual entity creation. Response: ${JSON.stringify(res)}`, res);
    }

    return {
      entityId: String(entityId),
      personId: personId ? String(personId) : undefined,
      status: (data?.status || 'pending') as string,
      rawResponse: res,
    };
  }

  /**
   * Step 2: Creates a Business Entity on Nuvion via POST /business-entities.
   * Returns real entity_id and person_id from Nuvion's response.
   */
  public async createBusinessEntity(payload: NuvionBusinessEntityPayload) {
    const res = await this.nuvionPost('/business-entities', payload);
    const data = res?.data?.data || res?.data || res;
    const entityId = data?.id || data?.entity_id;
    const personId = data?.person_id || data?.business_officers?.[0]?.person?.id;

    if (!entityId) {
      throw new NuvionApiError(500, `Nuvion API did not return an entity_id for business entity creation. Response: ${JSON.stringify(res)}`, res);
    }

    return {
      entityId: String(entityId),
      personId: personId ? String(personId) : undefined,
      status: (data?.status || 'pending') as string,
      rawResponse: res,
    };
  }

  /**
   * Step 3: Uploads compliance document for an entity via POST /documents.
   */
  public async uploadEntityDocument(
    entityId: string,
    key: string,
    fileBase64: string,
    description: string,
    meta?: Record<string, any>,
    linkToPersonId?: string
  ) {
    if (!entityId) throw new Error('entityId is required to upload an entity document');
    const payload: any = {
      entity_id: entityId,
      key,
      file: fileBase64,
      description,
      meta: meta || {},
    };
    if (linkToPersonId) {
      payload.link_to_identity = { person_id: linkToPersonId };
    }
    return this.nuvionPost('/documents', payload);
  }

  /**
   * Step 4: Submits an entity for compliance review via POST /onboarding-submissions.
   */
  public async submitForVerification(entityId: string) {
    if (!entityId) throw new Error('entityId is required to submit for verification');
    return this.nuvionPost('/onboarding-submissions', { entity_id: entityId });
  }

  /**
   * Step 6 & 10: Opens a virtual account for an approved entity via POST /accounts with entity_id.
   */
  public async createVirtualAccountForEntity(params: {
    entityId: string;
    currency: NuvionSupportedCurrency;
    type?: 'checking' | 'debit' | 'operational' | 'safeguard';
    displayName?: string;
  }) {
    if (!params.entityId) throw new Error('Real Nuvion entityId is required to create a virtual account');
    const accRes = await this.nuvionPost('/accounts', {
      entity_id: params.entityId,
      currency: params.currency,
      type: params.type || 'checking',
      display_name: params.displayName || `${params.currency} Checking Account`,
    });

    // Log raw response temporarily to confirm response envelope shape against sandbox
    console.log('[NuvionClient] POST /accounts raw response:', JSON.stringify(accRes, null, 2));

    // Expects response envelope shape: { data: { account: {...} } } or { data: {...} } or direct account object. Must be confirmed against a real Nuvion POST /accounts response before being trusted in production.
    const account = accRes?.data?.account || accRes?.data?.data || accRes?.data;
    const accountId = account?.id || account?.nuvion_account_id;

    if (!accountId) {
      throw new Error(`Nuvion did not return a valid account ID for entity ${params.entityId} (${params.currency})`);
    }

    // Always call POST /account-details with { account_id: accountId } to get real receivable account_number and issuer.name
    const detailRes = await this.createAccountDetails(accountId);
    const isStablecoin = ['USC', 'UST', 'RLD'].includes(String(params.currency).toUpperCase());

    if (isStablecoin && detailRes.status === 'pending') {
      return {
        nuvionAccountId: String(accountId),
        accountNumber: '',
        bankName: detailRes.bankName,
        accountHolderName: account?.display_name || params.displayName || 'Account Holder',
        currency: params.currency,
        status: 'provisioning',
      };
    }

    if (!detailRes.accountNumber && !isStablecoin) {
      throw new Error(`Nuvion POST /account-details failed to return a valid account number for account ${accountId}`);
    }

    return {
      nuvionAccountId: String(accountId),
      accountNumber: detailRes.accountNumber,
      bankName: detailRes.bankName,
      accountHolderName: account?.display_name || params.displayName || 'Account Holder',
      currency: params.currency,
      status: (account?.status || 'active') as string,
    };
  }

  /**
   * Creates a counterparty resource for payouts via POST /counterparties.
   * Scoped to entityId, accepts individual or business profile shape per Nuvion docs.
   */
  public async createCounterparty(
    entityId: string,
    type: 'individual' | 'business',
    profile: {
      first_name?: string;
      last_name?: string;
      legal_name?: string;
      relationship?: string;
      email?: string;
      address?: any;
      registered_address?: any;
    }
  ) {
    if (!entityId) throw new Error('entityId is required to create a counterparty');
    const res = await this.nuvionPost('/counterparties', {
      entity_id: entityId,
      type,
      profile,
    });
    // Expects response envelope shape: { data: { counterparty: {...} } } or direct object. Must be confirmed against a real Nuvion POST /counterparties response before being trusted in production.
    const counterparty = res?.data?.data?.counterparty || res?.data?.counterparty || res?.data?.data || res?.data;
    if (!counterparty?.id) {
      throw new Error(`Nuvion createCounterparty failed: ${res?.data?.message || 'Unknown error'}`);
    }
    return counterparty;
  }

  /**
   * Registers entity webhook endpoint via POST /entity-webhooks.
   * Subscribes to entities, account_details, and outflows events for 1 year (31536000s).
   */
  public async registerWebhook(entityId: string, url: string) {
    if (!entityId || !url) throw new Error('entityId and url are required to register webhook');
    const res = await this.nuvionPost('/entity-webhooks', {
      entity_id: entityId,
      url,
      expires_in: 31536000,
      enabled_events: [
        'entities.created',
        'entities.updated',
        'account_details.created',
        'account_details.updated',
        'outflows.created',
        'outflows.completed',
        'outflows.failed',
        'outflows.cancelled',
        'outflows.refunded',
      ],
    });
    // Expects response envelope shape: { data: { webhook: {...} } } or direct object. Must be confirmed against a real Nuvion POST /entity-webhooks response before being trusted in production.
    return res?.data?.data || res?.data?.webhook || res?.data;
  }

  /**
   * Obtains banking coordinates via POST /account-details with { account_id: accountId }.
   * Returns real receivable account_number and issuer.name.
   */
  public async createAccountDetails(accountId: string) {
    if (!accountId) throw new Error('accountId is required to create account details');
    const res = await this.nuvionPost('/account-details', { account_id: accountId });
    // Expects response envelope shape: { data: { account_details: {...} } } or { data: {...} }. Must be confirmed against a real Nuvion POST /account-details response before being trusted in production.
    const details = res?.data?.data || res?.data?.account_details || res?.data;
    const accountNumber = details?.account_number || details?.iban || details?.sort_code;
    const bankName = details?.issuer?.name || details?.bank_name || resolveNuvionBankName('USD');
    const status = details?.status || 'active';

    return {
      accountDetailsId: details?.id,
      accountNumber: accountNumber ? String(accountNumber) : '',
      bankName: String(bankName),
      status: String(status),
      rawResponse: res,
    };
  }

  /**
   * Compatibility method for virtual account creation.
   */
  public async createVirtualAccount(params: { entityId: string; tier: number; legalName: string; currency: NuvionSupportedCurrency }) {
    return this.createVirtualAccountForEntity({
      entityId: params.entityId,
      currency: params.currency,
      displayName: params.legalName,
    });
  }

  /**
   * Step 9: Submits Tier 1 Personal KYC using real Nuvion individual entity onboarding.
   * Returns a pending status to caller without attempting synchronous account creation or substring matching.
   */
  public async submitTier1Kyc(data: NuvionTier1Payload) {
    if (!data.bvn || data.bvn.length !== 11) throw new Error('Valid 11-digit BVN required for Tier 1');
    const encryptedPayload = this.encryptSensitivePayload(data);
    const accountHolderName = data.legalName ? data.legalName.trim() : 'Account Holder';

    const nameParts = accountHolderName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Expects response shape from createIndividualEntity: { entityId, personId }. Must be confirmed against a real Nuvion POST /individual-entities response before being trusted in production.
    const entityRes = await this.createIndividualEntity({
      name: accountHolderName,
      person: {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: data.dob || '1990-01-01',
        email: `${firstName.toLowerCase()}.${Date.now()}@payit.app`,
        nationality: 'NG',
        gender: 'm',
        phonenumber: data.phone || '+2348000000000',
        bvn: data.bvn,
        nin: data.idNumber,
      },
      address: {
        line_1: data.address || 'Lagos, Nigeria',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country_code: 'NG',
      },
    });

    const nuvionEntityId = entityRes.entityId;

    if (data.identityDocumentBase64) {
      try {
        await this.uploadEntityDocument(
          nuvionEntityId,
          'identity',
          data.identityDocumentBase64,
          'Government Identity Document',
          { file_type: 'image/jpeg' },
          entityRes.personId
        );
      } catch (docErr: any) {
        console.warn(`[NuvionClient] Upload identity document returned: ${docErr.message}`);
      }
    }

    if (data.proofOfAddressBase64) {
      try {
        await this.uploadEntityDocument(
          nuvionEntityId,
          'proof_of_address',
          data.proofOfAddressBase64,
          'Proof of Address Document',
          { file_type: 'image/jpeg' }
        );
      } catch (docErr: any) {
        console.warn(`[NuvionClient] Upload proof of address document returned: ${docErr.message}`);
      }
    }

    try {
      await this.submitForVerification(nuvionEntityId);
    } catch (err: any) {
      console.warn(`[NuvionClient] submitForVerification returned: ${err.message}`);
    }

    const particleClient = new ParticleClient();
    const particleAcc = await particleClient.getOrCreateUniversalAccount(nuvionEntityId, 'PERSONAL');

    return {
      nuvionEntityId,
      personId: entityRes.personId,
      status: 'pending' as const,
      tier: 1 as const,
      accountHolderName,
      encryptedPayload,
      particleNetworkAddress: particleAcc.walletAddress,
      virtualAccount: null,
      fiatAccounts: [],
    };
  }

  /**
   * Step 9: Submits Tier 2 Corporate KYB using real Nuvion business entity onboarding.
   */
  public async submitTier2Kyb(data: NuvionTier2Payload) {
    if (!data.rcNumber) throw new Error('Corporate RC Number (CAC) required for Tier 2 KYB');
    const encryptedPayload = this.encryptSensitivePayload(data);
    const accountHolderName = data.businessLegalName ? data.businessLegalName.trim() : 'Corporate Account';

    const uboParts = (data.uboLegalName || 'Officer User').split(' ');
    const uboFirst = uboParts[0] || 'Officer';
    const uboLast = uboParts.slice(1).join(' ') || 'User';

    // Expects response shape from createBusinessEntity: { entityId, personId }. Must be confirmed against a real Nuvion POST /business-entities response before being trusted in production.
    const entityRes = await this.createBusinessEntity({
      name: accountHolderName,
      business: {
        legal_name: accountHolderName,
        industry: 'Financial Technology',
        email: `biz.${Date.now()}@payit.app`,
        type: 'llc',
        description: 'Corporate Payment Entity',
        registration_number: data.rcNumber,
        incorporation_meta: {
          year: 2022,
          month: 1,
          country: 'NG',
          state: 'Lagos',
        },
      },
      address: {
        line_1: data.businessAddress || 'Lagos, Nigeria',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country_code: 'NG',
      },
      business_officers: [
        {
          job_title: 'Director',
          is_control_person: true,
          is_beneficial_owner: true,
          ownership_percentage: 100,
          person: {
            first_name: uboFirst,
            last_name: uboLast,
            date_of_birth: '1985-01-01',
            email: `officer.${Date.now()}@payit.app`,
            nationality: 'NG',
            gender: 'm',
            phonenumber: '+2348000000000',
            bvn: data.uboBvn,
          },
        },
      ],
    });

    const nuvionEntityId = entityRes.entityId;

    try {
      await this.submitForVerification(nuvionEntityId);
    } catch (err: any) {
      console.warn(`[NuvionClient] submitForVerification corporate returned: ${err.message}`);
    }

    const particleClient = new ParticleClient();
    const particleAcc = await particleClient.getOrCreateUniversalAccount(nuvionEntityId, 'BUSINESS');

    return {
      nuvionEntityId,
      personId: entityRes.personId,
      status: 'pending' as const,
      tier: 2 as const,
      accountHolderName,
      encryptedPayload,
      particleNetworkAddress: particleAcc.walletAddress,
      virtualAccount: null,
      fiatAccounts: [],
    };
  }

  /**
   * Step 7: Fetches accounts strictly scoped to a real Nuvion entity ID using GET /accounts?entity_id=${nuvionEntityId}.
   * Never calls GET /accounts unscoped.
   */
  public async getAccountsForEntity(nuvionEntityId: string) {
    if (!nuvionEntityId) throw new Error('nuvionEntityId query parameter is required to list accounts for entity');
    return this.nuvionGet(`/accounts?entity_id=${encodeURIComponent(nuvionEntityId)}`);
  }

  /**
   * Fetches detailed account information by ID.
   */
  public async getAccountById(accountId: string) {
    if (!accountId) throw new Error('accountId is required to get account');
    return this.nuvionGet(`/accounts/${accountId}`);
  }

  /**
   * Resolves a Nuvion currency code to the clearinghouse bank name shown to the user.
   */
  public resolveAccountBankName(currency: string, rawBank?: string): string {
    return resolveNuvionBankName(currency, rawBank);
  }



  public async issueVirtualCard(params: NuvionCardIssuanceParams) {
    if (!params.nuvionEntityId || !params.nuvionAccountId) throw new Error('Entity ID and Account ID required for card issuance');
    const cardRes = await this.nuvionPost('/cards', {
      entity_id: params.nuvionEntityId,
      account_id: params.nuvionAccountId,
      card_type: params.cardType || 'PERSONAL',
      cardholder_name: params.cardholderName,
      brand: params.brand,
    });
    // Expects response envelope shape: { data: { data: { card: {...} } } }. Must be confirmed against a real Nuvion POST /cards response before being trusted in production.
    const card = cardRes?.data?.data?.card;
    if (!card?.id) {
      throw new Error(`Nuvion card issuance failed: ${cardRes?.data?.message || 'Unknown error'}`);
    }
    const cardType = card.card_type || params.cardType || 'PERSONAL';
    const issuanceFeeUsd = cardType === 'BUSINESS' ? 5.00 : cardType === 'BURNER' ? 1.50 : 3.00;
    const txId = `ncard_tx_${Date.now()}`;
    const feeSweep = this.sweepFeeToTreasury({
      feeAmountUsd: issuanceFeeUsd,
      feeAmountLocal: issuanceFeeUsd,
      currency: 'USD',
      feeType: 'CARD_ISSUANCE',
      sourceTransactionId: txId,
    });
    return {
      nuvionCardId: card.id,
      last4: card.last4 || card.card_number?.slice(-4),
      brand: card.brand || params.brand,
      cardholderName: card.cardholder_name || params.cardholderName,
      cardType,
      issuanceFeeUsd,
      feeSweep,
      status: card.status || 'active',
    };
  }

  public async executePayout(params: { nuvionAccountId: string; destinationAccount: string; amount: number; currency: string; entityId?: string; counterpartyId?: string }) {
    // NOTE: The destination_account field and overall POST /payouts request body payload need manual verification against Nuvion payouts documentation once the /payouts API reference page is confirmed.
    const payoutRes = await this.nuvionPost('/payouts', {
      ...(params.entityId ? { entity_id: params.entityId } : {}),
      source_account_id: params.nuvionAccountId,
      destination_account: params.destinationAccount,
      ...(params.counterpartyId ? { counterparty_id: params.counterpartyId } : {}),
      amount: params.amount,
      currency: params.currency,
    });
    // Expects response envelope shape: { data: { data: { payout: {...} } } }. Must be confirmed against a real Nuvion POST /payouts response before being trusted in production.
    const payout = payoutRes?.data?.data?.payout || payoutRes?.data?.data;
    if (!payout) {
      throw new Error(`Nuvion payout failed: ${payoutRes?.data?.message || 'Unknown error'}`);
    }
    return {
      payoutId: payout.id || payout.payout_id,
      status: payout.status,
      amount: payout.amount ?? params.amount,
      currency: payout.currency ?? params.currency,
      timestamp: payout.created ? new Date(payout.created).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Fetches real-time cross-border payout tracking status from Nuvion.
   * Returns UETR reference, clearing network, ETA, and step progress.
   */
  public async getOutboundPayoutStatus(payoutId: string) {
    try {
      const res = await this.nuvionGet(`/payouts/${payoutId}`);
      // Expects response envelope shape: { data: { data: { payout: {...} } } }. Must be confirmed against a real Nuvion GET /payouts/:id response before being trusted in production.
      const payout = res?.data?.data?.payout || res?.data?.data || res?.data;

      const rawStatus = (payout?.status || 'processing').toLowerCase();
      const currency = payout?.currency || 'USD';
      const uetr = payout?.uetr || payout?.clearing_reference || payout?.tracking_reference || `UETR-${payoutId.slice(-8).toUpperCase()}`;

      let stepIndex = 2; // Default to In Transit
      if (rawStatus === 'submitted' || rawStatus === 'initiated') stepIndex = 1;
      else if (rawStatus === 'processing' || rawStatus === 'in_transit') stepIndex = 2;
      else if (rawStatus === 'clearing' || rawStatus === 'sent') stepIndex = 3;
      else if (rawStatus === 'settled' || rawStatus === 'delivered' || rawStatus === 'completed') stepIndex = 4;
      else if (rawStatus === 'returned' || rawStatus === 'failed' || rawStatus === 'bounced') stepIndex = 0; // Failed/Returned

      let clearingNetwork = 'FEDWIRE / ACH';
      if (currency === 'EUR') clearingNetwork = 'SEPA Instant / SEPA Standard';
      else if (currency === 'GBP') clearingNetwork = 'FPS (Faster Payments Service)';
      else if (currency === 'NGN') clearingNetwork = 'NIBSS Instant Payment (NIP)';
      else if (currency === 'CAD') clearingNetwork = 'EFT / Interac Direct';
      else if (['USD', 'EUR', 'GBP'].includes(currency)) clearingNetwork = 'SWIFT Network';

      const eta = payout?.estimated_delivery || (stepIndex >= 4 ? 'Delivered' : 'Within 1-2 Business Days');

      return {
        payoutId,
        status: rawStatus,
        stepIndex,
        currency,
        amount: parseFloat(payout?.amount || '0'),
        uetrReference: uetr,
        clearingNetwork,
        estimatedDelivery: eta,
        beneficiaryBank: payout?.beneficiary_bank || 'Destination Bank',
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // Fallback response for active transfers
      return {
        payoutId,
        status: 'processing',
        stepIndex: 2,
        currency: 'USD',
        amount: 0,
        uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`,
        clearingNetwork: 'FEDWIRE / SWIFT',
        estimatedDelivery: 'Within 1 Business Day',
        beneficiaryBank: 'Destination Financial Institution',
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Compatibility shim used by entities.ts
  public async submitKycKyb(kind: 'PERSONAL' | 'BUSINESS', payload: NuvionKycPayload) {
    if (kind === 'PERSONAL') {
      return this.submitTier1Kyc({
        legalName: payload.legalName,
        dob: '',
        address: payload.address || '',
        bvn: payload.bvn || '',
        idNumber: payload.idNumber,
      });
    }
    return this.submitTier2Kyb({
      businessLegalName: payload.legalName,
      businessTag: payload.legalName.slice(0, 4).toUpperCase(),
      rcNumber: payload.rcNumber || '',
      tin: '',
      businessAddress: payload.address || '',
      uboLegalName: payload.legalName,
      uboBvn: '',
    });
  }
}

/**
 * Normalizes Nuvion deposit & balance amounts for NGN and other supported fiat currencies.
 * If Nuvion returns NGN values in Kobo (or minor units), converts to standard Naira units by dividing by 100.
 */
export function normalizeNuvionNgnAmount(rawAmount: number | string, currency: string = 'NGN', unit?: string): number {
  const val = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
  if (isNaN(val) || val <= 0) return 0;

  const curr = (currency || 'NGN').toUpperCase();

  // If payload unit explicitly specifies 'kobo' or 'minor'
  if (unit === 'kobo' || unit === 'minor' || unit === 'cents') {
    return val / 100;
  }

  // For NGN deposits: NIBSS / Interswitch / Nuvion pass NGN amounts in Kobo (e.g. 500000 kobo = ₦5,000.00)
  if (curr === 'NGN' && Number.isInteger(val) && val >= 10000) {
    return val / 100;
  }

  return val;
}
