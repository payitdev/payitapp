import { TurnkeyClient, createActivityPoller } from '@turnkey/http';
import { ApiKeyStamper } from '@turnkey/api-key-stamper';

export interface TurnkeyUserWallets {
  subOrganizationId: string;
  personalWallet: {
    walletId: string;
    evmAddress: string;
    solanaAddress: string;
  };
  businessWallet: {
    walletId: string;
    evmAddress: string;
    solanaAddress: string;
  };
  // Root user id created inside Turnkey for this sub-organization (if provided)
  rootUserId?: string;
}

export class TurnkeyService {
  private client: TurnkeyClient | null = null;
  private organizationId: string;
  private apiPublicKey: string;
  private apiPrivateKey: string;
  private baseUrl: string;

  constructor() {
    this.organizationId = process.env.TURNKEY_ORGANIZATION_ID || '';
    this.apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY || '';
    this.apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY || '';
    this.baseUrl = process.env.TURNKEY_BASE_URL || 'https://api.turnkey.com';

    if (this.organizationId && this.apiPublicKey && this.apiPrivateKey) {
      const stamper = new ApiKeyStamper({
        apiPublicKey: this.apiPublicKey,
        apiPrivateKey: this.apiPrivateKey,
      });

      this.client = new TurnkeyClient(
        { baseUrl: this.baseUrl },
        stamper
      );
    }
  }

  /**
   * Create a new Turnkey Sub-Organization for a user with Dual Wallets (Personal + Business)
   */
  async createUserSubOrganization(params: {
    userId: string;
    email: string;
    passkeyChallenge?: string;
    attestation?: any;
  }): Promise<TurnkeyUserWallets> {
    if (!this.client) {
      throw new Error('TurnkeyClient is not configured. Please provide TURNKEY environment variables.');
    }

    const activityPoller = createActivityPoller({
      client: this.client,
      requestFn: this.client.createSubOrganization,
    });

    const subOrgName = `proxim_user_${params.userId}`;

    // Create Sub-Org with Root User and Wallets
    const activity = await activityPoller({
      type: 'ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V8',
      organizationId: this.organizationId,
      parameters: {
        subOrganizationName: subOrgName,
        rootUsers: [
          {
            userName: params.email,
            userEmail: params.email,
            apiKeys: [],
            authenticators: params.attestation
              ? [
                  {
                    authenticatorName: 'Passkey',
                    challenge: params.passkeyChallenge || '',
                    attestation: params.attestation,
                  },
                ]
              : [],
            oauthProviders: [],
          },
        ],
        rootQuorumThreshold: 1,
        wallet: {
          walletName: 'Personal Wallet',
          accounts: [
            {
              curve: 'CURVE_SECP256K1',
              pathFormat: 'PATH_FORMAT_BIP32',
              path: "m/44'/60'/0'/0/0", // EVM Standard Path
              addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
            },
            {
              curve: 'CURVE_ED25519',
              pathFormat: 'PATH_FORMAT_BIP32',
              path: "m/44'/501'/0'/0'", // Solana Standard Path
              addressFormat: 'ADDRESS_FORMAT_SOLANA',
            },
          ],
        },
      },
      timestampMs: String(Date.now()),
    });

    const subOrgResult = (activity.result as any)?.createSubOrganizationResultV8 || (activity.result as any)?.createSubOrganizationResultV7;
    const subOrgId = subOrgResult?.subOrganizationId || '';
    const personalWalletId = subOrgResult?.wallet?.walletId || '';
    const personalAccounts = subOrgResult?.wallet?.addresses || [];
    const rootUserId = subOrgResult?.rootUserId || (subOrgResult?.rootUsers && subOrgResult.rootUsers[0]?.userId) || '';

    const personalEvm = personalAccounts.find((a: string) => a.startsWith('0x')) || personalAccounts[0] || '';
    const personalSolana = personalAccounts.find((a: string) => !a.startsWith('0x')) || personalAccounts[1] || '';

    // Next, Create Business Wallet inside the same Sub-Org
    const businessWalletResult = await this.createWalletInSubOrg(subOrgId, 'Business Wallet');

    return {
      subOrganizationId: subOrgId,
      personalWallet: {
        walletId: personalWalletId,
        evmAddress: personalEvm,
        solanaAddress: personalSolana,
      },
      businessWallet: {
        walletId: businessWalletResult.walletId,
        evmAddress: businessWalletResult.evmAddress,
        solanaAddress: businessWalletResult.solanaAddress,
      },
      rootUserId: rootUserId || undefined,
    };
  }

  /**
   * Create an additional Wallet (e.g. Business Wallet) inside a Sub-Org
   */
  async createWalletInSubOrg(subOrgId: string, walletName: string): Promise<{ walletId: string; evmAddress: string; solanaAddress: string }> {
    if (!this.client) {
      throw new Error('TurnkeyClient is not configured.');
    }

    const activityPoller = createActivityPoller({
      client: this.client,
      requestFn: this.client.createWallet,
    });

    const activity = await activityPoller({
      type: 'ACTIVITY_TYPE_CREATE_WALLET',
      organizationId: subOrgId,
      parameters: {
        walletName,
        accounts: [
          {
            curve: 'CURVE_SECP256K1',
            pathFormat: 'PATH_FORMAT_BIP32',
            path: "m/44'/60'/0'/0/0",
            addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
          },
          {
            curve: 'CURVE_ED25519',
            pathFormat: 'PATH_FORMAT_BIP32',
            path: "m/44'/501'/0'/0'",
            addressFormat: 'ADDRESS_FORMAT_SOLANA',
          },
        ],
      },
      timestampMs: String(Date.now()),
    });

    const walletResult = (activity.result as any)?.createWalletResult;
    const walletId = walletResult?.walletId || '';
    const addresses = walletResult?.addresses || [];
    const evm = addresses.find((a: string) => a.startsWith('0x')) || addresses[0] || '';
    const solana = addresses.find((a: string) => !a.startsWith('0x')) || addresses[1] || '';

    return {
      walletId,
      evmAddress: evm,
      solanaAddress: solana,
    };
  }

  /**
   * Automated Headless Server-side Transaction Signing for Sweeping & Relaying
   */
  async signTransaction(subOrgId: string, signWith: string, unsignedPayload: string): Promise<{ signedTransaction: string }> {
    if (!this.client) {
      throw new Error('TurnkeyClient is not configured.');
    }

    const activityPoller = createActivityPoller({
      client: this.client,
      requestFn: this.client.signTransaction,
    });

    const activity = await activityPoller({
      type: 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2',
      organizationId: subOrgId,
      parameters: {
        signWith,
        type: 'TRANSACTION_TYPE_ETHEREUM',
        unsignedTransaction: unsignedPayload,
      },
      timestampMs: String(Date.now()),
    });

    const result = (activity.result as any)?.signTransactionResult;
    return {
      signedTransaction: result?.signedTransaction || '',
    };
  }
}

export const turnkeyService = new TurnkeyService();
