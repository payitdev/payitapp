import { BrailsClient, BrailsCustomerPayload } from './brailsClient.js';

export type PaymentProviderType = 'brails';

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
  private activeProvider: PaymentProviderType = 'brails';

  constructor(_activeProvider?: PaymentProviderType) {
    this.brails = new BrailsClient();
  }

  getActiveProvider(): PaymentProviderType {
    return this.activeProvider;
  }

  setActiveProvider(_provider: PaymentProviderType) {
    this.activeProvider = 'brails';
  }

  /**
  * Submit Tier 1 KYC through Brails.
   */
  async submitTier1Kyc(payload: BrailsCustomerPayload & { legalName?: string }): Promise<ProviderVerificationResult> {
    return this.submitBrailsTier1(payload);
  }

  private async submitBrailsTier1(payload: BrailsCustomerPayload & { legalName?: string }): Promise<ProviderVerificationResult> {
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
    const bank = (process.env.BRAILS_VIRTUAL_ACCOUNT_BANK || 'providus') as 'safehaven' | 'providus';

    const ngnAccRes = await this.brails.createVirtualAccount({
      customerId,
      currency: 'NGN',
      bank,
      type: 'INDIVIDUAL',
      firstName,
      lastName,
      bvn: payload.bvn,
      nin: payload.nin || payload.bvn,
    });

    const usdAccRes = await this.brails.createVirtualAccount({
      customerId,
      currency: 'USD',
      bank,
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

}

function usdAccDataAccountNumber(usdAccRes: any): string {
  return usdAccRes.data?.accountNumber || '';
}
