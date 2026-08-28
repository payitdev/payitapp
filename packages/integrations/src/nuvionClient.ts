import axios, { AxiosError, AxiosInstance } from 'axios';
import crypto from 'node:crypto';

const defaultSandboxUrl = 'https://api.nuvion.dev';
const defaultProductionUrl = 'https://api.nuvion.co';

export const NUVION_API_VERSION = '2026-02-06';

export interface NuvionResponse<T> {
  status: 'success' | 'error' | string;
  message?: string;
  type?: string;
  data: T;
  validations?: Array<Record<string, { error_type: string; message: string }>>;
}

export interface NuvionPaginationMeta {
  pagination?: {
    limit: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
    next_cursor: string | null;
    previous_cursor: string | null;
  };
  filters_applied?: Record<string, unknown>;
}

export interface NuvionPaginatedResponse<T> {
  status: 'success' | 'error' | string;
  message?: string;
  data: {
    data: T[];
    meta?: NuvionPaginationMeta;
  };
}

// ─── Entity & Person Models ──────────────────────────────────────────────────

export interface NuvionAddress {
  line_1: string;
  line_2?: string;
  line_3?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string; // ISO 3166-1 alpha-2 (e.g. NG, US, GB, KE)
}

export interface NuvionIdentification {
  document: {
    type: 'international_passport' | 'drivers_license' | 'national_id';
    number: string;
    issue_date?: string; // YYYY-MM-DD
    expiry_date?: string; // YYYY-MM-DD
    issuing_country: string; // ISO alpha-2
    issuing_authority: string;
    type_specific?: {
      id_subtype?: 'BVN' | 'SSN' | 'NIN' | string;
    };
  };
  proof_of_address?: {
    type: 'utility_bill' | 'bank_statement';
  };
}

export interface NuvionPerson {
  id?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string; // YYYY-MM-DD
  email: string;
  nationality: string; // ISO alpha-2
  gender: 'm' | 'f';
  phonenumber: string; // + country code e.g. +2348012345678
  ssn?: string;
  bvn?: string;
  nin?: string;
  identification?: NuvionIdentification;
  address?: NuvionAddress;
}

export interface NuvionBusinessOfficer {
  job_title: string;
  is_control_person: boolean;
  is_beneficial_owner: boolean;
  ownership_percentage: number;
  person: NuvionPerson;
}

export interface NuvionIndividualEntityPayload {
  name: string;
  person: NuvionPerson;
  address: NuvionAddress;
  identification: NuvionIdentification;
  business?: {
    name?: string;
    description?: string;
    category_code?: string;
    website?: string;
  };
  meta?: {
    tax_id?: string;
    monthly_payments_count?: string;
    monthly_transaction_value?: string;
    max_transfer_amount?: string;
    annual_turnover?: string;
    customer_types?: string;
    funding_source?: string;
  };
}

export interface NuvionBusinessEntityPayload {
  name: string;
  business: {
    legal_name: string;
    trade_name?: string;
    industry: string;
    email: string;
    website?: string;
    type: 'llc' | 'corporation' | 'partnership' | 'sole_proprietorship';
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
  address: NuvionAddress;
  operating_address?: NuvionAddress;
  business_officers: NuvionBusinessOfficer[];
  meta?: Record<string, unknown>;
}

export interface NuvionDocumentUploadPayload {
  entity_id: string;
  key: 'identity' | 'proof_of_address' | 'tax_verification' | 'certificate_of_incorporation' | 'memorandum_of_association';
  description: string;
  file: string; // Base64 encoded content
  file_back?: string; // Optional Base64 encoded back
  meta: {
    file_type: 'application/pdf' | 'image/jpeg' | 'image/png' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | string;
  };
  link_to_identity?: {
    person_id: string;
  };
}

export interface NuvionEntityRecord {
  id: string;
  type: 'individual' | 'business';
  status: 'incomplete' | 'pending' | 'approved' | 'rejected' | 'suspended';
  name: string;
  person_id?: string;
  business_id?: string;
  rejection_reasons?: string[] | Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Accounts & Account Details ──────────────────────────────────────────────

export interface NuvionAccountRecord {
  id: string;
  entity_id: string;
  type: 'checking' | 'debit' | 'operational' | 'safeguard';
  currency: string;
  display_name: string;
  status?: string;
  nuvion_ban?: string;
  balance?: {
    available: number;
    current: number;
    overdraft_used?: number;
  };
  [key: string]: unknown;
}

export interface NuvionCreateAccountPayload {
  entity_id: string;
  type: 'checking' | 'debit' | 'operational' | 'safeguard';
  currency: string; // ISO 4217 fiat or USC/UST
  display_name: string;
}

export interface NuvionAccountDetailsRecord {
  id: string;
  entity_id: string;
  account_id: string;
  account_number?: string;
  routing_number?: string;
  iban?: string;
  swift_bic?: string;
  sort_code?: string;
  bank_code?: string;
  issuer?: { name?: string; code?: string; meta?: Record<string, unknown> };
  status: 'pending' | 'active';
  currency?: string;
  asset_type?: 'fiat' | 'stablecoin';
  chain?: 'base' | 'eth' | 'matic' | 'sol' | string;
  beneficiary_name?: string;
  [key: string]: unknown;
}

// ─── On-Ramp / Funding Sessions ──────────────────────────────────────────────

export interface NuvionFundingSessionPayload {
  entity_id: string;
  amount: number; // Smallest unit: 10000 = £100.00
  account_id: string;
  funding_type: 'open-banking' | 'momo' | 'crypto';
  redirect_url?: string;
  unique_reference: string;
  narration?: string;
  currency?: string;
  meta?: {
    msisdn?: string;
    channel?: 'TZ-AIRTEL-C2B' | 'TZ-TIGO-C2B' | 'TZ-HALOTEL-C2B' | 'KE-SAFARICOM-C2B' | string;
    [key: string]: unknown;
  };
}

export interface NuvionFundingSessionRecord {
  id: string;
  entity_id: string;
  account_id: string;
  amount: number;
  currency: string;
  funding_type: 'open-banking' | 'momo' | 'crypto';
  status: 'awaiting_user' | 'processing' | 'settled' | 'failed' | 'expired';
  checkout_url?: string;
  checkout_id?: string;
  expires_at?: string;
  unique_reference: string;
  failure_code?: string;
  failure_message?: string;
  [key: string]: unknown;
}

// ─── Off-Ramp / Counterparties, Payment Details & Transfers ──────────────────

export interface NuvionCounterpartyPayload {
  entity_id: string;
  type: 'individual' | 'business';
  nickname?: string;
  profile: {
    first_name?: string;
    last_name?: string;
    legal_name?: string;
    trading_name?: string;
    relationship: 'vendor' | 'employee' | 'contractor' | 'friend' | 'family' | 'supplier' | 'partner' | 'customer';
    email: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state_or_province?: string;
      postal_code?: string;
      country: string; // ISO alpha-2
    };
    registered_address?: {
      line1: string;
      line2?: string;
      city: string;
      state_or_province?: string;
      postal_code?: string;
      country: string;
    };
    phone?: {
      number: string;
      type: 'mobile' | 'work' | 'home' | 'other';
      country: string;
    };
    identification?: Array<{
      type: 'P' | 'D' | 'N' | 'L';
      number: string;
      issuing_country: string;
    }>;
  };
}

export interface NuvionPaymentDetailsPayload {
  entity_id: string;
  counterparty_id: string;
  payment_method: 'bank-transfer' | 'wire' | 'local-transfer' | 'momo';
  currency: string;
  country: string;
  account_holder_name: string;
  account_number?: string;
  routing_number?: string;
  swift_bic?: string;
  iban?: string;
  sort_code?: string;
  bank_code?: string;
  meta?: Record<string, unknown>;
}

export interface NuvionTransferPayload {
  entity_id: string;
  account_id: string;
  payment_detail_id: string;
  counterparty_id: string;
  amount: number; // Smallest unit
  currency: string;
  narration: string;
  payment_type: 'bank-transfer' | 'wire' | 'local-transfer';
  unique_reference: string;
}

export interface NuvionTransferRecord {
  id: string;
  entity_id: string;
  account_id: string;
  payment_detail_id: string;
  counterparty_id: string;
  amount: number;
  currency: string;
  narration: string;
  payment_type: string;
  unique_reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  status_reason?: string;
  applicable_fee?: number;
  [key: string]: unknown;
}

// ─── Card Issuing (3 Card Types) ─────────────────────────────────────────────

export interface NuvionCardSpendingLimits {
  daily?: number; // In smallest unit
  monthly?: number;
  transaction?: number;
}

export interface NuvionCreateCardPayload {
  entity_id: string;
  account_id: string;
  type: 'debit' | 'prepaid' | 'virtual';
  display_name?: string;
  cardholder_name: string;
  spending_limits?: NuvionCardSpendingLimits;
  international_spending?: boolean;
}

export interface NuvionCardRecord {
  id: string;
  entity_id: string;
  account_id: string;
  type: 'debit' | 'prepaid' | 'virtual';
  display_name?: string;
  cardholder_name: string;
  status: 'pending' | 'issued' | 'active' | 'blocked' | 'cancelled';
  token?: string;
  last_four: string;
  expiry: string; // MM/YY
  pan?: string; // Momentary reveal only upon creation
  cvv?: string; // Momentary reveal only upon creation
  spending_limits?: NuvionCardSpendingLimits;
  international_spending?: boolean;
  brand?: string;
  [key: string]: unknown;
}

export interface NuvionCardTransactionRecord {
  id: string;
  card_id: string;
  amount: number;
  currency: string;
  merchant_name: string;
  merchant_category?: string;
  status: 'successful' | 'failed' | 'pending';
  created_at: string;
  [key: string]: unknown;
}

// ─── Savings & Earn ──────────────────────────────────────────────────────────

export interface NuvionSavingsGoalPayload {
  entity_id: string;
  account_id: string;
  name: string;
  target_amount: number; // Smallest unit
  target_date?: string; // ISO 8601
}

export interface NuvionSavingsGoalRecord {
  id: string;
  entity_id: string;
  account_id: string;
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string;
  interest_rate?: number; // APY percentage
  projected_interest?: number;
  [key: string]: unknown;
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

export function verifyNuvionWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceMs = 300000,
): boolean {
  if (!rawBody || !signature || !timestamp || !secret) {
    return false;
  }

  // Validate timestamp freshness (prevent replay attacks)
  const timestampNum = Number(timestamp);
  if (!Number.isFinite(timestampNum)) {
    return false;
  }
  const age = Math.abs(Date.now() - (timestampNum > 1e11 ? timestampNum : timestampNum * 1000));
  if (age > toleranceMs) {
    return false;
  }

  const payload = `${timestamp}.${rawBody}`;
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (signature.length !== computed.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(computed, 'utf8'));
  } catch {
    return false;
  }
}

// ─── Nuvion Client Class ──────────────────────────────────────────────────────

export class NuvionClient {
  private readonly http: AxiosInstance;
  private readonly configured: boolean;

  constructor(options?: { apiKey?: string; baseUrl?: string; apiVersion?: string }) {
    const isProd = process.env.NUVION_ENV === 'production';
    const envBaseUrl = isProd
      ? process.env.NUVION_PRODUCTION_BASE_URL || defaultProductionUrl
      : process.env.NUVION_SANDBOX_BASE_URL || defaultSandboxUrl;

    const apiKey = options?.apiKey || process.env.NUVION_API_KEY;
    const configuredBaseUrl = options?.baseUrl || envBaseUrl;
    this.configured = Boolean(apiKey && configuredBaseUrl);

    this.http = axios.create({
      baseURL: configuredBaseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Version': options?.apiVersion || process.env.NUVION_API_VERSION || NUVION_API_VERSION,
      },
      timeout: 30_000,
    });

    // Response Interceptor for Error Normalization
    this.http.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError<unknown>) => {
        if (error.response) {
          const body = error.response.data as {
            error?: { code?: string; message?: string; type?: string; validations?: unknown[] };
            message?: string;
            type?: string;
            code?: string;
            validations?: unknown[];
          } | undefined;

          const providerError = (body?.error || body) as {
            code?: string;
            message?: string;
            type?: string;
            validations?: unknown[];
          } | undefined;

          const code = providerError?.type || providerError?.code || String(error.response.status);
          const message = providerError?.message || error.message;

          const normalized = new Error(`Nuvion API Error [${code}]: ${message}`);
          Object.assign(normalized, {
            status: error.response.status,
            code,
            type: providerError?.type || code,
            validations: providerError?.validations,
            requestId: error.response.headers['x-request-id'],
            rawResponse: error.response.data,
          });
          throw normalized;
        }
        throw error;
      },
    );
  }

  // ─── Transient Error Retry Helper ──────────────────────────────────────────

  private async requestWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1000): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        const status = err.status || err.response?.status;
        const isTransient = status === 429 || status === 500 || status === 503 || status === 504;
        if (!isTransient || attempt >= maxRetries) {
          throw err;
        }
        attempt++;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private assertConfigured() {
    if (!this.configured) {
      throw new Error('Nuvion API configuration is required: set NUVION_API_KEY and the appropriate Nuvion base URL.');
    }
  }

  private get<T>(path: string, params?: Record<string, unknown>) {
    this.assertConfigured();
    return this.requestWithRetry(() => this.http.get<T>(path, { params }) as unknown as Promise<T>);
  }

  private post<T>(path: string, data: unknown) {
    this.assertConfigured();
    return this.requestWithRetry(() => this.http.post<T>(path, data) as unknown as Promise<T>);
  }

  private patch<T>(path: string, data: unknown) {
    this.assertConfigured();
    return this.requestWithRetry(() => this.http.patch<T>(path, data) as unknown as Promise<T>);
  }

  private put<T>(path: string, data: unknown) {
    this.assertConfigured();
    return this.requestWithRetry(() => this.http.put<T>(path, data) as unknown as Promise<T>);
  }

  private delete<T>(path: string) {
    this.assertConfigured();
    return this.requestWithRetry(() => this.http.delete<T>(path) as unknown as Promise<T>);
  }

  // ─── 3. Entity & Account Management ────────────────────────────────────────

  async createIndividualEntity(payload: NuvionIndividualEntityPayload | Record<string, unknown>) {
    return this.post<NuvionResponse<{ entity: NuvionEntityRecord; person: NuvionPerson }>>('/individual-entities', payload);
  }

  async updateIndividualEntity(entityId: string, payload: Record<string, unknown>) {
    return this.patch<NuvionResponse<{ entity: NuvionEntityRecord }>>(`/individual-entities/${entityId}`, payload);
  }

  async createBusinessEntity(payload: NuvionBusinessEntityPayload | Record<string, unknown>) {
    return this.post<NuvionResponse<{ entity: NuvionEntityRecord; business: Record<string, unknown> }>>('/business-entities', payload);
  }

  async updateBusinessEntity(entityId: string, payload: Record<string, unknown>) {
    return this.patch<NuvionResponse<{ entity: NuvionEntityRecord }>>(`/business-entities/${entityId}`, payload);
  }

  async getEntity(entityId: string, entityScope?: string) {
    return this.get<NuvionResponse<{ entity: NuvionEntityRecord }>>(`/entities/${entityId}`, entityScope ? { entity_id: entityScope } : undefined);
  }

  async listEntities(params?: { entity_id?: string; status?: string; limit?: number; cursor?: string }) {
    return this.get<NuvionPaginatedResponse<NuvionEntityRecord>>('/entities', params as Record<string, unknown>);
  }

  // ─── 4. KYC Documents & Verification ───────────────────────────────────────

  async uploadDocument(payload: NuvionDocumentUploadPayload) {
    return this.post<NuvionResponse<{ document: { id: string; status: string; key: string } }>>('/documents', payload);
  }

  async submitEntityForReview(entityId: string) {
    return this.post<NuvionResponse<{ entity: { id: string; status: string } }>>('/onboarding-submissions', { entity_id: entityId });
  }

  // ─── Accounts Management ───────────────────────────────────────────────────

  async createAccount(payload: NuvionCreateAccountPayload | Record<string, unknown>) {
    return this.post<NuvionResponse<{ account: NuvionAccountRecord }>>('/accounts', payload);
  }

  async getAccount(accountId: string, entityId: string) {
    return this.get<NuvionResponse<{ account: NuvionAccountRecord }>>(`/accounts/${accountId}`, { entity_id: entityId });
  }

  async listAccounts(params?: { entity_id: string; currency?: string; type?: string; limit?: number; cursor?: string }) {
    return this.get<NuvionPaginatedResponse<NuvionAccountRecord>>('/accounts', params as Record<string, unknown>);
  }

  async updateAccount(accountId: string, payload: { display_name?: string; entity_id: string }) {
    return this.patch<NuvionResponse<{ account: NuvionAccountRecord }>>(`/accounts/${accountId}`, payload);
  }

  // ─── 5. Account Details & Coordinates (Fiat & Base Stablecoin) ──────────────

  async createAccountDetails(payload: { entity_id: string; account_id: string; chain?: 'base' | 'eth' | 'matic' | 'sol' | string }) {
    return this.post<NuvionResponse<{ account_details: NuvionAccountDetailsRecord }>>('/account-details', payload);
  }

  async listAccountDetails(params?: { entity_id?: string; account_id?: string; limit?: number; cursor?: string }) {
    return this.get<NuvionPaginatedResponse<NuvionAccountDetailsRecord>>('/account-details', params as Record<string, unknown>);
  }

  async getAccountDetails(id: string) {
    return this.get<NuvionResponse<{ account_details: NuvionAccountDetailsRecord }>>(`/account-details/${id}`);
  }

  // ─── 5. On-Ramp / Funding Sessions (Open Banking, MoMo, Crypto) ────────────

  async createFundingSession(payload: NuvionFundingSessionPayload) {
    return this.post<NuvionResponse<{ funding_session: NuvionFundingSessionRecord }>>('/funding-sessions', payload);
  }

  async getFundingSession(id: string) {
    return this.get<NuvionResponse<{ funding_session: NuvionFundingSessionRecord }>>(`/funding-sessions/${id}`);
  }

  // ─── 6. Off-Ramp / Counterparties, Payment Details & Transfers ─────────────

  async createCounterparty(payload: NuvionCounterpartyPayload) {
    return this.post<NuvionResponse<{ counterparty: { id: string; status: string; type: string } }>>('/counterparties', payload);
  }

  async getCounterparty(id: string, entityId?: string) {
    return this.get<NuvionResponse<{ counterparty: Record<string, unknown> }>>(`/counterparties/${id}`, entityId ? { entity_id: entityId } : undefined);
  }

  async listCounterparties(params?: { entity_id: string; limit?: number; cursor?: string }) {
    return this.get<NuvionPaginatedResponse<Record<string, unknown>>>('/counterparties', params as Record<string, unknown>);
  }

  async createPaymentDetails(payload: NuvionPaymentDetailsPayload) {
    return this.post<NuvionResponse<{ payment_detail: { id: string; currency: string; payment_method: string } }>>('/payment-details', payload);
  }

  async getPaymentDetails(id: string) {
    return this.get<NuvionResponse<{ payment_detail: Record<string, unknown> }>>(`/payment-details/${id}`);
  }

  async createTransfer(payload: NuvionTransferPayload) {
    return this.post<NuvionResponse<{ transfer: NuvionTransferRecord }>>('/transfers', payload);
  }

  async getTransfer(id: string, entityId?: string) {
    return this.get<NuvionResponse<{ transfer: NuvionTransferRecord }>>(`/transfers/${id}`, entityId ? { entity_id: entityId } : undefined);
  }

  async createRefund(payload: { entity_id: string; payment_intent_action_id: string; amount?: number; reference: string; reason?: string }) {
    return this.post<NuvionResponse<{ refund: Record<string, unknown> }>>('/payment-refunds', payload);
  }

  // ─── 7. Card Issuing (Debit, Prepaid, Virtual) ──────────────────────────────

  async createCard(payload: NuvionCreateCardPayload) {
    return this.post<NuvionResponse<{ card: NuvionCardRecord }>>('/cards', payload);
  }

  async getCard(cardId: string, entityId?: string) {
    return this.get<NuvionResponse<{ card: NuvionCardRecord }>>(`/cards/${cardId}`, entityId ? { entity_id: entityId } : undefined);
  }

  async listCards(params?: { entity_id: string; account_id?: string; type?: string; status?: string; limit?: number; cursor?: string }) {
    return this.get<NuvionPaginatedResponse<NuvionCardRecord>>('/cards', params as Record<string, unknown>);
  }

  async updateCard(cardId: string, payload: { entity_id: string; spending_limits?: NuvionCardSpendingLimits; international_spending?: boolean; status?: 'active' | 'blocked' }) {
    return this.put<NuvionResponse<{ card: NuvionCardRecord }>>(`/cards/${cardId}`, payload);
  }

  async blockCard(cardId: string, payload: { entity_id: string; reason?: string }) {
    return this.post<NuvionResponse<{ card: { id: string; status: 'blocked' } }>>(`/cards/${cardId}/block`, payload);
  }

  async unblockCard(cardId: string, payload: { entity_id: string; reason?: string }) {
    return this.post<NuvionResponse<{ card: { id: string; status: 'active' } }>>(`/cards/${cardId}/unblock`, payload);
  }

  async getCardTransactions(cardId: string, params?: { entity_id: string; status?: string; limit?: number; cursor?: string }) {
    return this.get<NuvionPaginatedResponse<NuvionCardTransactionRecord>>('/card-transactions', { card_id: cardId, ...params });
  }

  // ─── 9. Earn / Savings Features ─────────────────────────────────────────────

  async createSavingsGoal(payload: NuvionSavingsGoalPayload) {
    return this.post<NuvionResponse<{ savings_goal: NuvionSavingsGoalRecord }>>('/savings-goals', payload);
  }

  async getSavingsGoals(params?: { entity_id: string; account_id?: string }) {
    return this.get<NuvionPaginatedResponse<NuvionSavingsGoalRecord>>('/savings-goals', params as Record<string, unknown>);
  }
}

export const nuvionClient = new NuvionClient();