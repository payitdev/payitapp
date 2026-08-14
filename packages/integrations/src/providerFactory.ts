import { BrailsClient, BrailsCustomerPayload, BrailsVirtualAccountPayload } from './brailsClient.js';
import { NuvionClient, NuvionTier1Payload, NuvionTier2Payload } from './nuvionClient.js';

export type PaymentProviderType = 'brails' | 'nuvion';

export interface ProviderVerificationResult {
  provider: PaymentProviderType;
  entityId: string;
  status: string;
  fiatAccounts: Array<{
    currency: string;
    accountNumber: string;
    bankName: string;
    accountName: string;
    routingNumber?: string;
  }>;
}

export class PaymentProviderFactory {
  private brails: BrailsClient;
  private nuvion: NuvionClient;
  private activeProvider: PaymentProviderType;

  constructor(activeProvider?: PaymentProviderType) {
    this.brails = new BrailsClient();
    this.nuvion = new NuvionClient();
    this.activeProvider = activeProvider || (process.env.PAYMENT_PROVIDER as PaymentProviderType) || 'brails';
  }

  getActiveProvider(): PaymentProviderType {
    return this.activeProvider;
  }

  setActiveProvider(provider: PaymentProviderType) {
    this.activeProvider = provider;
  }

  /**
   * Submit Tier 1 KYC with automatic provider fallback if primary fails.
   */
  async submitTier1Kyc(payload: NuvionTier1Payload & BrailsCustomerPayload): Promise<ProviderVerificationResult> {
    const primary = this.activeProvider;
    const secondary: PaymentProviderType = primary === 'brails' ? 'nuvion' : 'brails';

    try {
      if (primary === 'brails') {
        return await this.submitBrailsTier1(payload);
      } else {
        return await this.submitNuvionTier1(payload);
      }
    } catch (err: any) {
      console.warn(`⚠️ Primary payment provider (${primary}) failed: ${err.message}. Attempting fallback to secondary provider (${secondary})...`);
      if (secondary === 'brails') {
        return await this.submitBrailsTier1(payload);
      } else {
        return await this.submitNuvionTier1(payload);
      }
    }
  }

  private async submitBrailsTier1(payload: NuvionTier1Payload & BrailsCustomerPayload): Promise<ProviderVerificationResult> {
    const nameParts = (payload.legalName || `${payload.firstName || ''} ${payload.lastName || ''}`).trim().split(' ');
    const firstName = payload.firstName || nameParts[0] || 'Valued';
    const lastName = payload.lastName || nameParts.slice(1).join(' ') || 'User';

    const customerRes = await this.brails.createCustomer({
      firstName,
      lastName,
      email: payload.email || `${firstName.toLowerCase()}.${Date.now()}@payit.app`,
      bvn: payload.bvn,
      nin: payload.nin || payload.bvn,
      dob: payload.dob,
      address: typeof payload.address === 'string' ? { streetLine1: payload.address } : payload.address,
    });

    const customerId = customerRes.data?.id || customerRes.id;

    const ngnAccRes = await this.brails.createVirtualAccount({
      customerId,
      currency: 'NGN',
      type: 'INDIVIDUAL',
      firstName,
      lastName,
      bvn: payload.bvn,
      nin: payload.nin || payload.bvn,
    });

    const usdAccRes = await this.brails.createVirtualAccount({
      customerId,
      currency: 'USD',
      type: 'INDIVIDUAL',
      firstName,
      lastName,
      bvn: payload.bvn,
      nin: payload.nin || payload.bvn,
    });

    const fiatAccounts = [];
    if (ngnAccRes.data?.accountNumber) {
      fiatAccounts.push({
        currency: 'NGN',
        accountNumber: ngnAccRes.data.accountNumber,
        bankName: ngnAccRes.data.bankName || 'Globus Bank',
        accountName: ngnAccRes.data.accountName || payload.legalName,
      });
    }
    if (usdAccRes.data?.accountNumber) {
      fiatAccounts.push({
        currency: 'USD',
        accountNumber: usdAccDataAccountNumber(usdAccRes),
        bankName: usdAccRes.data.bankName || 'Community Federal Savings Bank',
        accountName: usdAccRes.data.accountName || payload.legalName,
        routingNumber: usdAccRes.data.routingNumber || '026073150',
      });
    }

    return {
      provider: 'brails',
      entityId: customerId,
      status: 'approved',
      fiatAccounts,
    };
  }

  private async submitNuvionTier1(payload: NuvionTier1Payload): Promise<ProviderVerificationResult> {
    const res = await this.nuvion.submitTier1Kyc(payload);
    return {
      provider: 'nuvion',
      entityId: res.nuvionEntityId,
      status: 'pending',
      fiatAccounts: [],
    };
  }
}

function usdAccDataAccountNumber(usdAccRes: any): string {
  return usdAccRes.data?.accountNumber || '';
}
