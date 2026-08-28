export interface NEARIntentsConfig {
  oneClickApiKey?: string;
  explorerApiKey?: string;
  baseUrl?: string;
  explorerUrl?: string;
  allowedAssets?: string[];
  allowedPairs?: string[];
}

export interface GenerateIntentPayload {
  originAsset: string;
  destinationAsset: string;
  amount: string;
  recipientAddress: string;
  refundAddress?: string;
  slippageTolerance?: number;
  dry?: boolean;
}

export interface SubmitDepositPayload {
  intentId: string;
  txHash: string;
  chain: string;
}

export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error('Amount must be a positive decimal number');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals || BigInt(whole) < 0n) throw new Error(`Amount supports at most ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}

const DEFAULT_ALLOWED_ASSETS = [
  'ethereum:usdc', 'ethereum:usdt', 'base:usdc', 'base:usdt',
  'polygon:usdc', 'polygon:usdt', 'arbitrum:usdc', 'arbitrum:usdt',
  'optimism:usdc', 'optimism:usdt', 'bsc:usdc',
  'solana:sol', 'solana:usdc', 'solana:usdt',
  'bitcoin:btc', 'near:near', 'tron:trx', 'ton:ton',
  'cosmos:atom', 'sui:sui', 'aptos:apt', 'xrp:xrp',
  'ethereum:eth', 'base:eth', 'polygon:pol', 'bsc:bnb',
];

const CHAIN_ALIASES: Record<string, string> = {
  eth: 'ethereum', ethereum: 'ethereum', pol: 'polygon', polygon: 'polygon',
  arb: 'arbitrum', arbitrum: 'arbitrum', op: 'optimism', optimism: 'optimism',
  bsc: 'bsc', base: 'base', sol: 'solana', solana: 'solana', near: 'near',
};

function canonicalAsset(chain: string, symbol: string): string {
  return `${CHAIN_ALIASES[chain.toLowerCase()] || chain.toLowerCase()}:${symbol.toLowerCase()}`;
}

function configuredList(value: string | undefined, fallback: string[]): string[] {
  const entries = value?.split(',').map(entry => entry.trim()).filter(Boolean);
  return entries?.length ? entries : fallback;
}

export class NEARIntentsClient {
  private oneClickApiKey: string;
  private explorerApiKey: string;
  private baseUrl: string;
  private explorerUrl: string;
  private allowedAssets: Set<string>;
  private allowedPairs: Set<string>;

  constructor(config?: NEARIntentsConfig) {
    this.oneClickApiKey = config?.oneClickApiKey || process.env.NEAR_INTENT_1CLICK_API_KEY || '';
    this.explorerApiKey = config?.explorerApiKey || process.env.NEAR_INTENT_EXPLORER_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://1click.chaindefuser.com';
    this.explorerUrl = config?.explorerUrl || 'https://explorer.near-intents.org';
    this.allowedAssets = new Set((config?.allowedAssets || configuredList(process.env.NEAR_INTENT_ALLOWED_ASSETS, DEFAULT_ALLOWED_ASSETS)).map(asset => {
      const [chain, symbol] = asset.split(':');
      return canonicalAsset(chain, symbol);
    }));
    this.allowedPairs = new Set((config?.allowedPairs || configuredList(process.env.NEAR_INTENT_ALLOWED_PAIRS, [])).map(pair => {
      const [origin, destination] = pair.split('>');
      const [originChain, originSymbol] = origin.split(':');
      const [destinationChain, destinationSymbol] = destination.split(':');
      return `${canonicalAsset(originChain, originSymbol)}>${canonicalAsset(destinationChain, destinationSymbol)}`;
    }));
  }

  private get1ClickHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.oneClickApiKey) {
      headers['Authorization'] = `Bearer ${this.oneClickApiKey}`;
    }
    return headers;
  }

  private getExplorerHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.explorerApiKey) {
      headers['Authorization'] = `Bearer ${this.explorerApiKey}`;
    }
    return headers;
  }

  /**
   * Fetch list of supported tokens across chains for 1Click swaps
   */
  async getSupportedTokens(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v0/tokens`, {
        method: 'GET',
        headers: this.get1ClickHeaders(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NEAR 1Click Supported Tokens Error (${response.status}): ${errText}`);
      }

      const tokens = await response.json();
      return { success: true, tokens: Array.isArray(tokens) ? tokens : tokens.tokens || [] };
    } catch (err: any) {
      console.error('[NEARIntentsClient] getSupportedTokens error:', err.message);
      return {
        success: false,
        tokens: [],
      };
    }
  }

  async getProductionSupportedTokens(): Promise<any> {
    const result = await this.getSupportedTokens();
    const tokens = (result.tokens || []).filter((token: any) => this.allowedAssets.has(
      canonicalAsset(String(token.blockchain || ''), String(token.symbol || ''))
    ));
    return { success: result.success, tokens };
  }

  /**
   * Request intent quote & payload for 1-click cross-chain swaps
   */
  async generateIntentForSigning(payload: GenerateIntentPayload): Promise<any> {
    try {
      const tokens = await this.getSupportedTokens();
      const supportedTokens = Array.isArray(tokens) ? tokens : tokens.tokens || [];
      const resolveAsset = (asset: string) => {
        if (asset.startsWith('nep141:')) return supportedTokens.find((token: any) => token.assetId === asset);
        const [chain, symbol] = asset.split(':');
        const chainAliases: Record<string, string[]> = Object.entries(CHAIN_ALIASES).reduce((aliases, [alias, canonical]) => {
          (aliases[canonical] ||= []).push(alias);
          return aliases;
        }, {} as Record<string, string[]>);
        return supportedTokens.find((token: any) =>
          String(token.symbol).toUpperCase() === String(symbol).toUpperCase()
          && (chainAliases[CHAIN_ALIASES[chain.toLowerCase()] || chain.toLowerCase()] || [chain]).includes(String(token.blockchain).toLowerCase())
        );
      };
      const origin = resolveAsset(payload.originAsset);
      const destination = resolveAsset(payload.destinationAsset);
      if (!origin || !destination) throw new Error(`Unsupported NEAR Intent asset pair: ${payload.originAsset} -> ${payload.destinationAsset}`);
      const originCanonical = canonicalAsset(String(origin.blockchain), String(origin.symbol));
      const destinationCanonical = canonicalAsset(String(destination.blockchain), String(destination.symbol));
      if (!this.allowedAssets.has(originCanonical) || !this.allowedAssets.has(destinationCanonical)) {
        throw new Error(`Asset pair is not enabled by Proxim policy: ${originCanonical} -> ${destinationCanonical}`);
      }
      if (this.allowedPairs.size > 0 && !this.allowedPairs.has(`${originCanonical}>${destinationCanonical}`)) {
        throw new Error(`Asset pair is not enabled by Proxim policy: ${originCanonical} -> ${destinationCanonical}`);
      }
      const amount = toBaseUnits(String(payload.amount), Number(origin.decimals)).toString();
      const response = await fetch(`${this.baseUrl}/v0/quote`, {
        method: 'POST',
        headers: this.get1ClickHeaders(),
        body: JSON.stringify({
          dry: payload.dry ?? false,
          swapType: 'EXACT_INPUT',
          slippageTolerance: payload.slippageTolerance ?? 100,
          originAsset: origin.assetId,
          depositType: 'ORIGIN_CHAIN',
          destinationAsset: destination.assetId,
          amount,
          recipient: payload.recipientAddress,
          recipientType: 'DESTINATION_CHAIN',
          refundTo: payload.refundAddress || payload.recipientAddress,
          refundType: 'ORIGIN_CHAIN',
          deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          referral: 'proxim',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NEAR 1Click Generate Intent Error (${response.status}): ${errText}`);
      }

      const quoteResponse = await response.json();
      return {
        ...quoteResponse,
        success: true,
        intentId: quoteResponse.quote?.depositAddress,
        depositAddress: quoteResponse.quote?.depositAddress,
        requiresDeposit: true,
      };
    } catch (err: any) {
      console.error('[NEARIntentsClient] generateIntent error:', err.message);
      throw new Error(`NEAR Intent Generation failed: ${err.message}`);
    }
  }

  /**
   * Submit transaction hash after depositing origin funds
   */
  async submitDepositTxHash(payload: SubmitDepositPayload): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v0/deposit/submit`, {
        method: 'POST',
        headers: this.get1ClickHeaders(),
        body: JSON.stringify({ depositAddress: payload.intentId, txHash: payload.txHash }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NEAR 1Click Submit Deposit Error (${response.status}): ${errText}`);
      }

      return { success: true, ...(await response.json()) };
    } catch (err: any) {
      console.error('[NEARIntentsClient] submitDeposit error:', err.message);
      throw new Error(`NEAR Intent Deposit Submission failed: ${err.message}`);
    }
  }

  /**
   * Check status of a cross-chain swap execution
   */
  async checkSwapExecutionStatus(intentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v0/status?depositAddress=${encodeURIComponent(intentId)}`, {
        method: 'GET',
        headers: this.get1ClickHeaders(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NEAR 1Click Status Error (${response.status}): ${errText}`);
      }

      return { success: true, ...(await response.json()) };
    } catch (err: any) {
      console.error('[NEARIntentsClient] checkStatus error:', err.message);
      throw new Error(`NEAR Intent status unavailable: ${err.message}`);
    }
  }

  /**
   * Fetch token balances for an account from Intent Explorer
   */
  async getUserTokenBalances(accountId: string): Promise<any> {
    try {
      const response = await fetch(`${this.explorerUrl}/v1/account/${accountId}/balances`, {
        method: 'GET',
        headers: this.getExplorerHeaders(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NEAR Intent Explorer Balances Error (${response.status}): ${errText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[NEARIntentsClient] getUserTokenBalances error:', err.message);
      throw new Error(`NEAR Intent balances unavailable: ${err.message}`);
    }
  }

  /**
   * Fetch available cross-chain yield opportunities from NEAR 1Click Earn API
   */
  async getEarnVaults(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/earn/vaults`, {
        method: 'GET',
        headers: this.get1ClickHeaders(),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NEAR 1Click Earn Vaults Error (${response.status}): ${errText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[NEARIntentsClient] getEarnVaults error:', err.message);
      return {
        success: false,
        live: false,
        vaults: [],
      };
    }
  }

  /**
   * Generate 1-Click intent to deposit funds directly into a NEAR Intent Earn Vault
   */
  async generateEarnIntent(payload: {
    vaultId: string;
    originAsset: string;
    amount: string;
    recipientAddress: string;
  }): Promise<any> {
    return this.generateIntentForSigning({
      originAsset: payload.originAsset,
      destinationAsset: payload.vaultId,
      amount: payload.amount,
      recipientAddress: payload.recipientAddress,
    });
  }
}

