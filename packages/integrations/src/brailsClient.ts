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

export interface BrailsVirtualAccountPayload {
  customerId?: string;
  currency: 'NGN' | 'USD' | 'EUR' | 'GBP' | 'KES' | 'UGX' | 'GHS';
  bank?: string;
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
  cardUserId: string;
  currency: 'USD' | 'NGN';
  amount: number;
  cardType?: 'VIRTUAL';
  brand?: 'VISA' | 'MASTERCARD';
  billingAddress?: BrailsAddress;
}

export interface BrailsPayoutPayload {
  walletId?: string;
  amount: number;
  currency: string;
  beneficiaryId?: string;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
  narration?: string;
  reference: string;
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
}

export class BrailsClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.BRAILS_API_KEY || '';
    this.baseUrl = baseUrl || process.env.BRAILS_API_BASE_URL || 'https://api.brails.com/v1';

    if (!this.apiKey) {
      console.warn('⚠️ WARNING: BRAILS_API_KEY environment variable is not set. Network requests to Brails will fail until credentials are provided.');
    }
  }

  private async request<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, data?: any): Promise<T> {
    if (!this.apiKey) {
      throw new Error('BRAILS_API_KEY is missing. Please configure BRAILS_API_KEY in your environment variables.');
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error(`Brails API Error [${method} ${endpoint}]:`, errorMsg);
      throw new Error(`Brails API Error (${err.response?.status || 500}): ${errorMsg}`);
    }
  }

  /**
   * 1. Create a Customer record on Brails (Real HTTP Call)
   */
  async createCustomer(payload: BrailsCustomerPayload) {
    return this.request('POST', '/customers', payload);
  }

  /**
   * 2. Create a Dedicated Multi-Currency Virtual Account (Real HTTP Call)
   */
  async createVirtualAccount(payload: BrailsVirtualAccountPayload) {
    return this.request('POST', '/virtual-accounts', payload);
  }

  /**
   * 3. Register a Card User for Virtual Cards Issuance (Real HTTP Call)
   */
  async registerCardUser(payload: { customerId: string; firstName: string; lastName: string; email: string; phoneNumber?: string }) {
    return this.request('POST', '/virtual-cards/register-card-user', payload);
  }

  /**
   * 4. Create a Virtual Debit Card (Real HTTP Call)
   */
  async createVirtualCard(payload: BrailsVirtualCardPayload) {
    return this.request('POST', '/virtual-cards/create-card', payload);
  }

  /**
   * 5. Top-up Virtual Debit Card (Real HTTP Call)
   */
  async topUpCard(cardId: string, amount: number, currency = 'USD') {
    return this.request('POST', '/virtual-cards/top-up', { cardId, amount, currency });
  }

  /**
   * 6. Withdraw Funds from Virtual Debit Card back to Wallet (Real HTTP Call)
   */
  async withdrawCard(cardId: string, amount: number, currency = 'USD') {
    return this.request('POST', '/virtual-cards/withdrawal', { cardId, amount, currency });
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
    return this.request('POST', '/collections', payload);
  }

  /**
   * 9. Initiate Cross-Border Payout / Transfer (Real HTTP Call)
   */
  async initiatePayout(payload: BrailsPayoutPayload) {
    return this.request('POST', '/wallets/initiate-payout', payload);
  }

  /**
   * 10. Get Swap Quote (Fiat <-> Stablecoins) (Real HTTP Call)
   */
  async getQuote(fromCurrency: string, toCurrency: string, amount: number) {
    return this.request('GET', `/wallets/quote?fromCurrency=${fromCurrency}&toCurrency=${toCurrency}&amount=${amount}`);
  }

  /**
   * 11. Verify Webhook HMAC Signature
   */
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.BRAILS_WEBHOOK_SECRET;
    if (!webhookSecret) return true;

    try {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const computed = hmac.update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    } catch (err) {
      return false;
    }
  }
}
