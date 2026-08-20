import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface DueCustomerParams {
  type: 'individual' | 'business';
  email: string;
  name: string;
  country: string;
  phoneNumber?: string;
  metadata?: Record<string, any>;
}

export interface DueVirtualAccountParams {
  customerId: string;
  currency: 'EUR' | 'USD' | 'GBP' | 'NGN' | 'BRL' | 'MXN' | 'AED' | string;
  rail?: string; // 'sepa' | 'ach' | 'fedwire' | 'fps' | 'nip' | 'spei' | 'pix'
  destinationAddress: string;
  destinationNetwork?: string; // 'base' | 'polygon' | 'solana' | 'ethereum' | 'arbitrum'
  destinationAsset?: string; // 'USDC' | 'EURC' | 'USDT'
  accountHolderName?: string;
}

export interface DueQuoteParams {
  sourceCurrency: string;
  targetCurrency: string;
  amount: string | number;
  direction?: 'buy' | 'sell';
}

export interface DueTransferParams {
  quoteId: string;
  sourceCurrency: string;
  targetCurrency: string;
  amount: string | number;
  destinationAddress: string;
  destinationNetwork?: string;
  recipientDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    accountNumber?: string;
    bankCode?: string;
  };
  metadata?: Record<string, any>;
}

export interface DuePayoutParams {
  amount: string | number;
  currency: string;
  rail: string;
  recipient: {
    name: string;
    accountNumber: string;
    bankCode?: string;
    bankName?: string;
    phoneNumber?: string; // For MoMo
    network?: string; // For MoMo: MTN, Airtel, M-Pesa, etc.
  };
  reference?: string;
  metadata?: Record<string, any>;
}

export class DueClient {
  private client: AxiosInstance;
  private webhookSecret: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; webhookSecret?: string }) {
    const apiKey = config?.apiKey || process.env.DUE_API_KEY || '';
    const baseURL = config?.baseUrl || process.env.DUE_BASE_URL || 'https://api.due.network';
    this.webhookSecret = config?.webhookSecret || process.env.DUE_WEBHOOK_SECRET || '';

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Create or retrieve a Due Customer (Individual KYC or Business KYB)
   */
  async createCustomer(params: DueCustomerParams): Promise<any> {
    try {
      const response = await this.client.post('/v1/customers', {
        type: params.type,
        email: params.email,
        name: params.name,
        country: params.country,
        phone_number: params.phoneNumber,
        metadata: params.metadata,
      });
      return response.data;
    } catch (error: any) {
      this.handleError('createCustomer', error);
    }
  }

  /**
   * Get Customer Details & Status
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/customers/${customerId}`);
      return response.data;
    } catch (error: any) {
      this.handleError('getCustomer', error);
    }
  }

  /**
   * Initiate Hosted KYC / Identity Verification Session
   */
  async createKycSession(customerId: string, redirectUrl?: string): Promise<{ verification_url: string; session_id: string }> {
    try {
      const response = await this.client.post(`/v1/customers/${customerId}/verifications`, {
        redirect_url: redirectUrl,
      });
      return response.data;
    } catch (error: any) {
      this.handleError('createKycSession', error);
    }
  }

  /**
   * Request Named or Standard Virtual Account Endorsement
   */
  async requestEndorsement(customerId: string, endorsement: string): Promise<any> {
    try {
      const response = await this.client.post(`/v1/customers/${customerId}/endorsements`, {
        endorsement,
      });
      return response.data;
    } catch (error: any) {
      this.handleError('requestEndorsement', error);
    }
  }

  /**
   * Provision a Static Virtual Account (EUR, USD, GBP, NGN, BRL, MXN)
   */
  async createVirtualAccount(params: DueVirtualAccountParams): Promise<any> {
    try {
      const response = await this.client.post('/v1/virtual_accounts', {
        customer_id: params.customerId,
        currency: params.currency,
        rail: params.rail || this.getDefaultRail(params.currency),
        settlement: {
          target_asset: params.destinationAsset || 'USDC',
          network: params.destinationNetwork || 'base',
          destination_address: params.destinationAddress,
        },
        holder_name: params.accountHolderName,
      });
      return response.data;
    } catch (error: any) {
      this.handleError('createVirtualAccount', error);
    }
  }

  /**
   * Get Virtual Account by ID
   */
  async getVirtualAccount(virtualAccountId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/virtual_accounts/${virtualAccountId}`);
      return response.data;
    } catch (error: any) {
      this.handleError('getVirtualAccount', error);
    }
  }

  /**
   * List Virtual Accounts for a Customer
   */
  async listVirtualAccounts(customerId: string): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/virtual_accounts', {
        params: { customer_id: customerId },
      });
      return response.data?.data || response.data || [];
    } catch (error: any) {
      this.handleError('listVirtualAccounts', error);
    }
  }

  /**
   * Create Guaranteed FX Quote (Valid for 2 mins)
   */
  async createQuote(params: DueQuoteParams): Promise<any> {
    try {
      const response = await this.client.post('/v1/quotes', {
        source_currency: params.sourceCurrency,
        target_currency: params.targetCurrency,
        amount: params.amount,
        direction: params.direction || 'buy',
      });
      return response.data;
    } catch (error: any) {
      this.handleError('createQuote', error);
    }
  }

  /**
   * Create Dynamic Transfer / Invoice Intent (Active for 2 hours)
   */
  async createTransfer(params: DueTransferParams): Promise<any> {
    try {
      const response = await this.client.post('/v1/transfers', {
        quote_id: params.quoteId,
        source_currency: params.sourceCurrency,
        target_currency: params.targetCurrency,
        amount: params.amount,
        settlement: {
          target_asset: params.targetCurrency,
          network: params.destinationNetwork || 'base',
          destination_address: params.destinationAddress,
        },
        recipient: params.recipientDetails,
        metadata: params.metadata,
      });
      return response.data;
    } catch (error: any) {
      this.handleError('createTransfer', error);
    }
  }

  /**
   * Get Transfer Status
   */
  async getTransfer(transferId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/transfers/${transferId}`);
      return response.data;
    } catch (error: any) {
      this.handleError('getTransfer', error);
    }
  }

  /**
   * Create Fiat / Mobile Money Payout (for Payroll & Disbursements)
   */
  async createPayout(params: DuePayoutParams): Promise<any> {
    try {
      const response = await this.client.post('/v1/payouts', {
        amount: params.amount,
        currency: params.currency,
        rail: params.rail,
        recipient: params.recipient,
        reference: params.reference,
        metadata: params.metadata,
      });
      return response.data;
    } catch (error: any) {
      this.handleError('createPayout', error);
    }
  }

  /**
   * Cryptographically Verify Incoming Webhook Signature
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, timestamp?: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[DueClient] DUE_WEBHOOK_SECRET is not configured; skipping signature verification.');
      return true;
    }

    try {
      const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (err) {
      console.error('[DueClient] Error verifying webhook signature:', err);
      return false;
    }
  }

  private getDefaultRail(currency: string): string {
    switch (currency.toUpperCase()) {
      case 'EUR': return 'sepa';
      case 'USD': return 'ach';
      case 'GBP': return 'fps';
      case 'NGN': return 'nip';
      case 'BRL': return 'pix';
      case 'MXN': return 'spei';
      case 'GHS': return 'momo';
      case 'KES': return 'mpesa';
      default: return 'bank_transfer';
    }
  }

  private handleError(method: string, error: any): never {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown Due API error';
    const status = error.response?.status;
    console.error(`[DueClient] Error in ${method} (${status}):`, error.response?.data || error.message);
    throw new Error(`Due API Error [${method}]: ${message}`);
  }
}

export const dueClient = new DueClient();
