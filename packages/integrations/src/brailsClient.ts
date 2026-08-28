import axios from 'axios';
import crypto from 'crypto';

export interface BrailsAddress {
  streetLine1?: string;
  streetLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  subdivision?: string;
  postalCode?: string;
}

export interface BrailsIdentifyingInformation {
  type: 'drivers_license' | 'passport' | 'national_id' | 'voter_card';
  number?: string;
  issuingCountry?: string;
  idFrontImage?: string;
  idBackImage?: string;
}

export interface BrailsProofOfAddress {
  name: string;
  url: string;
  description?: string;
}

export interface BrailsPersonalInformation {
  gender?: 'male' | 'female' | 'other';
  primaryNationality?: string;
  address?: BrailsAddress;
  identifyingInformation?: BrailsIdentifyingInformation;
  proofOfAddress?: BrailsProofOfAddress;
  ownershipPercentage?: number;
}

export interface BrailsTaxInformation {
  taxId?: string;
  taxIdType?: string;
  taxCountry?: string;
}

export interface BrailsBusinessInformation {
  description?: string;
  registrationNumber?: string;
  email?: string;
  type?: 'individual' | 'corporate';
  industry?: string;
  dateOfIncorporation?: string;
  address?: BrailsAddress;
  website?: string;
  publiclyTraded?: boolean;
  accountPurpose?: string;
  annualRevenue?: string;
  estimatedMonthlyDeposits?: string;
  estimatedMonthlyWithdrawals?: string;
  sourceOfFunds?: string;
  taxInformation?: BrailsTaxInformation;
}

export interface BrailsComplianceDocument {
  name: string;
  url: string;
  description?: string;
}

export interface BrailsCustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  bvn?: string;
  nin?: string;
  dob?: string;
  address?: BrailsAddress;
}

export interface BrailsBusinessCustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  businessLegalName: string;
  registrationNumber: string;
  businessInformation: BrailsBusinessInformation;
  complianceInformation?: BrailsComplianceDocument[];
  reference?: string;
  businessOfficer?: BrailsPersonalInformation;
  businessOfficerIdentity?: BrailsIdentifyingInformation;
  businessOfficerNationality?: string;
  businessOfficerGender?: 'male' | 'female' | 'other';
  businessOfficerDateOfBirth?: string;
  businessOfficerBvn?: string;
  businessOfficerNin?: string;
}

export interface BrailsVirtualAccountPayload {
  customerId?: string;
  currency: 'NGN' | 'USD';
  bank: 'safehaven' | 'providus';
  type?: 'INDIVIDUAL' | 'BUSINESS';
  firstName?: string;
  lastName?: string;
  bvn?: string;
  nin?: string;
  rcNumber?: string;
  customerEmail?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  businessLegalName?: string;
  reference?: string;
  personalInformation?: BrailsPersonalInformation;
  businessInformation?: BrailsBusinessInformation;
  complianceInformation?: BrailsComplianceDocument[];
}

export interface BrailsVirtualCardPayload {
  customerEmail: string;
  cardUserId?: string;
  currency?: 'USD' | 'NGN';
  amount?: number;
  cardType?: 'VIRTUAL' | 'GIFTCARD' | 'virtual' | 'giftcard';
  cardBrand?: 'VISA' | 'MASTERCARD' | 'visa' | 'mastercard';
  brand?: 'VISA' | 'MASTERCARD' | 'visa' | 'mastercard';
  billingAddress?: BrailsAddress;
  reference?: string;
  firstName?: string;
  lastName?: string;
}

export interface BrailsCardUserRegistrationPayload {
  customerEmail: string;
  idNumber?: string;
  idType?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  line1?: string;
  houseName?: string;
  country?: string;
  bvn?: string;
  userPhoto?: string;
  idImage?: string;
  dateOfBirth?: string;
}

export interface BrailsPayoutPayload {
  walletId?: string;
  amount: number;
  currency: string;
  sourceWalletCurrency?: string;
  customerEmail?: string;
  description?: string;
  beneficiary?: Record<string, any>;
  beneficiaryId?: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
  narration?: string;
  reference: string;
}

export interface BrailsBeneficiaryPayload {
  country: string;
  currency: string;
  reference: string;
  callbackUrl?: string;
  customerEmail: string;
  destination: Record<string, any>;
}

export interface BrailsTransactionListParams {
  q?: string;
  action?: string;
  channel?: string;
  type?: string;
  status?: string;
  currency?: string;
  period?: 'allTime' | 'day' | 'range';
  forDate?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  nextCursor?: string;
  prevCursor?: string;
}

export interface BrailsCollectionPayload {
  amount: number;
  currency: 'KES' | 'UGX' | 'GHS' | 'NGN' | 'USD';
  channel: 'mobile_money' | 'card' | 'bank_transfer' | 'ussd';
  paymentProvider?: 'mpesa' | 'mtn' | 'airtel';
  phoneNumber?: string;
  email: string;
  customerName?: string;
  reference: string;
  redirectUrl?: string;
  description?: string;
  country: 'NG' | 'KE' | 'UG';
  payload: Record<string, string>;
}

export type BrailsChain = 'base' | 'polygon' | 'solana' | 'ethereum' | 'optimism' | 'avalanche' | 'stellar';

export interface BrailsSendStablecoinPayload {
  amount: number; // amount in cents (e.g. 1000 = $10.00)
  address: string; // recipient wallet address
  chain: BrailsChain;
  reference: string;
  description: string;
  customerEmail: string;
  callbackUrl?: string;
}

export interface BrailsGenerateDepositAddressPayload {
  chain: BrailsChain;
  reference: string;
  description?: string;
  customerEmail: string;
  callbackUrl?: string;
}

export interface BrailsListDepositAddressesParams {
  chain?: BrailsChain;
  currency?: 'USDC' | 'USDT';
  active?: boolean;
  limit?: number;
  offset?: number;
}

export class BrailsClient {
  private apiKey: string;
  private v1BaseUrl: string;
  private v2BaseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.BRAILS_API_KEY || '';
    const configuredBase = baseUrl || process.env.BRAILS_API_BASE_URL || 'https://api.onbrails.com/api/v1';
    this.v1BaseUrl = configuredBase.replace(/\/$/, '').replace(/\/v2$/, '/v1');
    this.v2BaseUrl = (process.env.BRAILS_API_V2_BASE_URL || this.v1BaseUrl.replace(/\/v1$/, '/v2')).replace(/\/$/, '');

    if (!this.apiKey) {
      console.warn('⚠️ WARNING: BRAILS_API_KEY environment variable is not set. Network requests to Brails will fail until credentials are provided.');
    }
  }


  private async request<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', endpoint: string, data?: any, version: 1 | 2 = 1): Promise<T> {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error('BRAILS_API_KEY is missing or blank. Configure BRAILS_API_KEY in your environment variables before using Brails.');
    }

    const baseUrl = version === 2 ? this.v2BaseUrl : this.v1BaseUrl;
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await axios({
          method,
          url,
          data,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 30000,
        });
        return response.data;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 429 && attempt < 2) {
          const retryAfter = Number(err.response?.headers?.['retry-after']);
          const delayMs = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 10000) : 1000 * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
        console.error(`Brails API Error [${method} ${endpoint}]:`, errorMsg);
        throw new Error(`Brails API Error (${status || 500}): ${errorMsg}`);
      }
    }
    throw new Error(`Brails API Error (429): rate limit exceeded for ${method} ${endpoint}`);
  }

  /**
   * 1. Create a Customer record on Brails (Real HTTP Call)
   */
  async createCustomer(payload: BrailsCustomerPayload) {
    return this.request('POST', '/customers', payload);
  }

  async submitBusinessKyb(payload: BrailsBusinessCustomerPayload) {
    return this.request('POST', '/customers', { ...payload, type: 'BUSINESS' });
  }

  /**
   * 2. Create a Dedicated Multi-Currency Virtual Account (Real HTTP Call)
   */
  async createVirtualAccount(payload: BrailsVirtualAccountPayload) {
    return this.request('POST', '/virtual-accounts', payload);
  }

  async getSupportedCountries() {
    return this.request('GET', '/beneficiaries/supported-countries', undefined, 2);
  }

  async createBeneficiary(payload: BrailsBeneficiaryPayload) {
    return this.request('POST', '/beneficiaries', payload, 2);
  }

  async getBeneficiary(beneficiaryId: string) {
    return this.request('GET', `/beneficiaries/${encodeURIComponent(beneficiaryId)}`, undefined, 2);
  }

  async listBeneficiaries(params?: { page?: number; take?: number; order?: 'ASC' | 'DESC' }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.take) query.set('take', String(params.take));
    if (params?.order) query.set('order', params.order);
    return this.request('GET', `/beneficiaries${query.toString() ? `?${query}` : ''}`, undefined, 2);
  }

  async deleteBeneficiary(beneficiaryId: string) {
    return this.request('DELETE', `/beneficiaries/${encodeURIComponent(beneficiaryId)}`, undefined, 2);
  }

  async getVirtualAccounts(params?: { page?: number; take?: number; order?: 'ASC' | 'DESC' }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.take) query.set('take', String(params.take));
    if (params?.order) query.set('order', params.order);
    return this.request('GET', `/virtual-accounts${query.toString() ? `?${query}` : ''}`);
  }

  async getVirtualAccountTransactions(accountId: string, params?: { order?: 'ASC' | 'DESC'; page?: number; take?: number }) {
    if (!accountId) throw new Error('Virtual account ID is required');
    const query = new URLSearchParams();
    if (params?.order) query.set('order', params.order);
    if (params?.page) query.set('page', String(params.page));
    if (params?.take) query.set('take', String(params.take));
    return this.request('GET', `/virtual-accounts/${encodeURIComponent(accountId)}/transactions${query.toString() ? `?${query}` : ''}`);
  }

  async listTransactions(params?: BrailsTransactionListParams) {
    const query = new URLSearchParams();
    for (const key of ['q', 'action', 'channel', 'type', 'status', 'currency', 'period', 'forDate', 'startDate', 'endDate', 'nextCursor', 'prevCursor'] as const) {
      const value = params?.[key];
      if (value) query.set(key, String(value));
    }
    if (params?.limit !== undefined) query.set('limit', String(Math.min(100, Math.max(1, Math.trunc(params.limit)))));
    return this.request('GET', `/transactions${query.toString() ? `?${query}` : ''}`, undefined, 2);
  }

  async getTransaction(transactionId: string) {
    if (!transactionId) throw new Error('Brails transaction ID is required');
    return this.request('GET', `/transactions/${encodeURIComponent(transactionId)}`, undefined, 2);
  }

  private async requestVirtualCards<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoints: string[], payload?: any): Promise<T> {
    let lastError: any;

    for (const endpoint of endpoints) {
      try {
        return await this.request(method, endpoint, payload);
      } catch (error: any) {
        lastError = error;
        const message = String(error?.message || '');
        if (!message.toLowerCase().includes('404') && !message.toLowerCase().includes('405') && !message.toLowerCase().includes('not found') && !message.toLowerCase().includes('method not allowed')) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error(`Brails virtual card endpoint unavailable for ${method}`);
  }

  /**
   * 3. Register a Card User for Virtual Cards Issuance (Real HTTP Call)
   */
  async registerCardUser(payload: BrailsCardUserRegistrationPayload) {
    return this.requestVirtualCards('POST', ['/virtual-cards/register-card-user', '/virtualcards/registercarduser'], payload);
  }

  async listCardUsers(params?: { page?: number; take?: number; order?: 'ASC' | 'DESC' }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.take) query.set('take', String(params.take));
    if (params?.order) query.set('order', params.order);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.requestVirtualCards('GET', [`/virtual-cards/users${suffix}`, `/virtualcards/users${suffix}`]);
  }

  async fetchCardUser(cardUserId: string) {
    return this.requestVirtualCards('GET', [`/virtual-cards/users/${encodeURIComponent(cardUserId)}`, `/virtualcards/users/${encodeURIComponent(cardUserId)}`]);
  }

  /**
   * 4. Create a Virtual Debit Card (Real HTTP Call)
   */
  async createVirtualCard(payload: BrailsVirtualCardPayload) {
    const normalizedPayload = {
      ...payload,
      cardType: (payload.cardType || payload.brand ? 'VIRTUAL' : 'VIRTUAL').toString().toUpperCase(),
      cardBrand: (payload.cardBrand || payload.brand || 'VISA').toString().toUpperCase(),
      currency: (payload.currency || 'USD').toUpperCase(),
      amount: payload.amount ?? 0,
      reference: payload.reference || `proxim_card_${Date.now()}`,
      customerEmail: payload.customerEmail,
    };

    return this.requestVirtualCards('POST', ['/virtual-cards/create-card', '/virtualcards/create'], normalizedPayload);
  }

  async listCards(params?: { page?: number; take?: number; order?: 'ASC' | 'DESC' }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.take) query.set('take', String(params.take));
    if (params?.order) query.set('order', params.order);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.requestVirtualCards('GET', [`/virtual-cards/cards${suffix}`, `/virtualcards/cards${suffix}`]);
  }

  async fetchCard(cardId: string) {
    return this.requestVirtualCards('GET', [`/virtual-cards/cards/${encodeURIComponent(cardId)}`, `/virtualcards/cards/${encodeURIComponent(cardId)}`]);
  }

  async listCardTransactions(cardId: string, params?: { page?: number; take?: number; order?: 'ASC' | 'DESC' }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.take) query.set('take', String(params.take));
    if (params?.order) query.set('order', params.order);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.requestVirtualCards('GET', [`/virtual-cards/cards/${encodeURIComponent(cardId)}/transactions${suffix}`, `/virtualcards/cards/${encodeURIComponent(cardId)}/transactions${suffix}`]);
  }

  /**
   * 5. Top-up Virtual Debit Card (Real HTTP Call)
   */
  async topUpCard(cardId: string, amount: number, currency = 'USD', reference?: string) {
    return this.requestVirtualCards('POST', ['/virtual-cards/top-up', '/virtualcards/topup'], {
      cardId,
      amount,
      currency: (currency || 'USD').toUpperCase(),
      reference: reference || `proxim_topup_${Date.now()}`,
    });
  }

  /**
   * 6. Withdraw Funds from Virtual Debit Card back to Wallet (Real HTTP Call)
   */
  async withdrawCard(cardId: string, amount: number, currency = 'USD', reference?: string) {
    return this.requestVirtualCards('POST', ['/virtual-cards/withdrawal', '/virtualcards/withdraw'], {
      cardId,
      amount,
      currency: (currency || 'USD').toUpperCase(),
      reference: reference || `proxim_withdraw_${Date.now()}`,
    });
  }

  async freezeCard(cardId: string) {
    return this.requestVirtualCards('POST', ['/virtual-cards/freeze', '/virtualcards/freeze'], { cardId });
  }

  async unfreezeCard(cardId: string) {
    return this.requestVirtualCards('POST', ['/virtual-cards/unfreeze', '/virtualcards/unfreeze'], { cardId });
  }

  async mockCardTransaction(cardId: string, amount: number, type: 'credit' | 'deduct' = 'deduct') {
    return this.requestVirtualCards('POST', ['/virtual-cards/mock-transaction', '/virtualcards/mock-transaction'], { cardId, amount, type });
  }

  async terminateCard(cardId: string) {
    return this.requestVirtualCards('POST', ['/virtual-cards/terminate-card', '/virtualcards/terminate'], { cardId });
  }

  /**
   * 7. Resolve Recipient Bank Account Name (Real HTTP Call)
   */
  async resolveBeneficiaryAccount(accountNumber: string, bankCode: string) {
    return this.request('POST', '/beneficiaries/resolve', { accountNumber, bankCode });
  }

  /**
   * 8. Create Mobile Money / Online Payment Collection (Real HTTP Call)
   */
  async createCollection(payload: BrailsCollectionPayload) {
    return this.request('POST', '/wallets/collections/initialize', payload, 2);
  }

  async createWallet(currency: 'KES' | 'UGX' | 'NGN' | 'USD') {
    return this.request('POST', '/wallets/create-new-wallet', { currency }, 2);
  }

  async initializeSwap(payload: { sourceCurrency: string; amount: number; targetCurrency: string }) {
    return this.request('POST', '/wallets/initialize-swap', payload, 2);
  }

  /**
   * 9. Initiate Cross-Border Payout / Transfer (Real HTTP Call)
   */
  async initiatePayout(payload: BrailsPayoutPayload) {
    const beneficiary = payload.beneficiary || (payload.accountNumber ? {
      country: payload.currency === 'NGN' ? 'NG' : undefined,
      currency: payload.currency,
      destination: {
        type: 'BANK',
        accountNumber: payload.accountNumber,
        accountName: payload.accountName,
        bankCode: payload.bankCode,
      },
    } : undefined);
    if (Boolean(payload.beneficiaryId) === Boolean(beneficiary)) {
      throw new Error('Exactly one of beneficiaryId or beneficiary is required for a Brails payout');
    }
    return this.request('POST', '/wallets/initiate-payout', {
      ...payload,
      beneficiary,
      sourceWalletCurrency: payload.sourceWalletCurrency || payload.currency,
      customerEmail: payload.customerEmail || process.env.BRAILS_CUSTOMER_EMAIL,
      description: payload.description || payload.narration || payload.reference,
    }, 2);
  }

  async getPayoutStatus(payoutId: string) {
    if (!payoutId) throw new Error('Brails payout ID is required');
    return this.request('GET', `/wallets/payouts/${encodeURIComponent(payoutId)}`);
  }

  /**
   * 10. Get Swap Quote (Fiat <-> Stablecoins) (Real HTTP Call)
   */
  async getQuote(sourceCurrency: string, destinationCurrency: string, amount: number, beneficiaryCountry: string) {
    const query = new URLSearchParams({ sourceCurrency: sourceCurrency.toUpperCase(), destinationCurrency: destinationCurrency.toUpperCase(), amount: String(Math.trunc(amount)), beneficiaryCountry: beneficiaryCountry.toUpperCase() });
    return this.request('GET', `/wallets/quote?${query}`, undefined, 2);
  }

  async getAllExchangeRates() {
    return this.request('GET', '/wallets/payout/rates', undefined, 2);
  }


  /**
   * 11. Send Stablecoin (USDC / USDT) on Base Chain or Supported Networks
   * Endpoint: POST /wallets/send/usdc or POST /wallets/send/usdt
   * Amount in cents (e.g. 1000 = $10.00)
   */

  async sendStablecoin(currency: 'USDC' | 'USDT', payload: BrailsSendStablecoinPayload) {
    const endpoint = `/wallets/send/${currency.toLowerCase()}`;
    return this.request('POST', endpoint, {
      amount: payload.amount,
      address: payload.address,
      chain: payload.chain,
      reference: payload.reference,
      description: payload.description,
      customerEmail: payload.customerEmail,
      callbackUrl: payload.callbackUrl,
    });
  }

  /**
   * 12. Generate Deposit Address for Receiving Stablecoins (USDC / USDT)
   * Endpoint: POST /wallets/receive/usdc/address or POST /wallets/receive/usdt/address
   */
  async generateDepositAddress(currency: 'USDC' | 'USDT', payload: BrailsGenerateDepositAddressPayload) {
    const endpoint = `/wallets/receive/${currency.toLowerCase()}/address`;
    return this.request('POST', endpoint, {
      chain: payload.chain,
      reference: payload.reference,
      description: payload.description,
      customerEmail: payload.customerEmail,
      callbackUrl: payload.callbackUrl,
    });
  }

  /**
   * 13. Get Deposit Address by ID or Reference
   * Endpoint: GET /wallets/receive/address/{addressId} or GET /wallets/receive/address?reference={reference}
   */
  async getDepositAddress(addressIdOrReference: string, isReference = false) {
    if (!addressIdOrReference) throw new Error('Deposit address ID or reference is required');
    if (isReference) {
      return this.request('GET', `/wallets/receive/address?reference=${encodeURIComponent(addressIdOrReference)}`);
    }
    return this.request('GET', `/wallets/receive/address/${encodeURIComponent(addressIdOrReference)}`);
  }

  /**
   * 14. List Deposit Addresses with Optional Filters
   * Endpoint: GET /wallets/receive/addresses
   */
  async listDepositAddresses(params?: BrailsListDepositAddressesParams) {
    const query = new URLSearchParams();
    if (params?.chain) query.set('chain', params.chain);
    if (params?.currency) query.set('currency', params.currency);
    if (params?.active !== undefined) query.set('active', String(params.active));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request('GET', `/wallets/receive/addresses${suffix}`);
  }

  /**
   * 15. Deactivate a Deposit Address
   * Endpoint: PATCH /wallets/receive/address/{addressId}/deactivate
   */
  async deactivateDepositAddress(addressId: string) {
    if (!addressId) throw new Error('Deposit address ID is required');
    return this.request('PATCH', `/wallets/receive/address/${encodeURIComponent(addressId)}/deactivate`);
  }

  /**
   * 16. Verify Transaction Status (Send or Receive)
   * Endpoint: GET /transactions/{transactionId}
   */
  async verifyTransactionStatus(transactionId: string) {
    if (!transactionId) throw new Error('Transaction ID is required');
    return this.request('GET', `/transactions/${encodeURIComponent(transactionId)}`);
  }

  /**
   * 17. Verify Webhook HMAC Signature
   */

  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.BRAILS_WEBHOOK_SECRET;
    if (!webhookSecret || !signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const computed = hmac.update(rawBody).digest('hex');
      const normalized = signature.replace(/^sha256=/i, '').trim();
      const expected = Buffer.from(computed, 'hex');
      const received = Buffer.from(normalized, 'hex');
      return received.length === expected.length && crypto.timingSafeEqual(expected, received);
    } catch (err) {
      return false;
    }
  }
}
