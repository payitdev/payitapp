/**
 * Ondo Global Markets Client for Proxim Stock/ETF Trading
 *
 * Integrates Pods Finance's Ondo Global Markets for tokenized stocks & ETFs
 * Operates on BSC for positions, with Base funding and payout support
 *
 * Signing: NEAR MPC wallet only (via signAndSubmitTransaction in chainSignaturesBackend)
 * Stocks:  Ondo Global Markets only (no Pods Finance for stocks)
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================
// TYPES
// ============================================================

export interface OndoMarketStatus {
  isOpen: boolean;
  marketStatus?: string;
  nextOpen?: string;
  nextClose?: string;
  offhours?: {
    isOpen: boolean;
  };
  asset: {
    symbol: string;
    tradable: boolean;
    limited: boolean;
    blockingReason: {
      code: string;
      message: string;
    } | null;
    paused: boolean;
    status: any;
    marketData?: any;
  } | null;
}

export interface OndoToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  category: string[];
  priceInUSD: string;
  logoURI?: string;
  id?: string;
}

export interface OndoStrategy {
  id: string;
  protocol: string;
  assetName: string;
  network: string;
  networkId: number;
  asset: string;
  assetDecimals: number;
  apy: number;
  paused: boolean;
  fee: string;
  availableActions: string[];
}

export interface OndoBytecodeResponse {
  feeCharged: string;
  chainIdIn: number;
  chainIdOut: number;
  id: string;
  crossChain: {
    isCrossChain: boolean;
    chainIdIn: number;
    chainIdOut: number;
  };
  quote: OndoQuote | null;
  bytecode: Array<{
    to: string;
    data: string;
    value: string;
    chainId: number;
  }>;
  orderUid?: string;
  singleUseAddress?: string;
}

export interface OndoQuote {
  bridge?: string;
  sender?: string;
  fromChainId?: number;
  fromTokenAddress?: string;
  toChainId?: number;
  toTokenAddress?: string;
  inputAmount: {
    value: string;
    decimals: number;
    humanized: string;
    symbol: string;
  };
  outputAmount: {
    value: string;
    decimals: number;
    humanized: string;
    symbol: string;
  };
  minimumOutputAmount: {
    value: string;
    decimals: number;
    humanized: string;
    symbol: string;
  };
}

export interface OndoPosition {
  spotPosition: {
    currentPositionInShares: {
      value: string;
      decimals: number;
      humanized: string;
      symbol: string;
    };
    currentPosition: {
      value: string;
      decimals: number;
      humanized: string;
      symbol: string;
    };
    profit: {
      value: string;
      decimals: number;
      humanized: string;
      symbol: string;
    };
    principal: {
      value: string;
      decimals: number;
      humanized: string;
      symbol: string;
    };
    underlyingBalanceUSD: number;
    apy: number;
  };
  strategy: {
    id: string;
    protocol: string;
    assetName: string;
    network: string;
    networkId: number;
    asset: string;
    assetDecimals: number;
  };
}

export interface OndoActionStatus {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'EXPIRED' | 'CANCELLED';
  suw?: {
    phase: string;
    currentStep?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// POLYGON.IO PRICE ENRICHMENT
// ============================================================

/**
 * Fetch live stock prices from Polygon.io for a batch of tickers.
 * Returns a map of ticker → USD price string.
 */
async function fetchPolygonPrices(symbols: string[]): Promise<Map<string, string>> {
  const priceMap = new Map<string, string>();
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || symbols.length === 0) return priceMap;

  // Normalize symbols: strip 'on' suffix (e.g. AAPLon → AAPL)
  const normalized = symbols.map(s => s.replace(/on$/i, '').toUpperCase());
  const tickerList = normalized.join(',');

  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickerList)}&apiKey=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) {
      console.warn(`[Polygon.io] Price fetch failed: ${response.status} ${response.statusText}`);
      return priceMap;
    }
    const data = await response.json() as { tickers?: Array<{ ticker: string; day?: { c?: number }; lastTrade?: { p?: number } }> };
    for (const ticker of data.tickers || []) {
      const price = ticker.day?.c || ticker.lastTrade?.p;
      if (price && price > 0) {
        // Map back: both the raw ticker and the 'on' version
        priceMap.set(ticker.ticker.toUpperCase(), price.toFixed(4));
        priceMap.set(`${ticker.ticker.toLowerCase()}on`, price.toFixed(4));
        priceMap.set(`${ticker.ticker.toUpperCase()}on`, price.toFixed(4));
      }
    }
  } catch (err: any) {
    console.warn('[Polygon.io] Live price enrichment unavailable:', err.message);
  }

  return priceMap;
}

// ============================================================
// MAIN CLIENT CLASS
// ============================================================

export class OndoClient {
  private _client: AxiosInstance | null = null;
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey?: string) {
    // Store credentials without validating — defer validation to first API call
    // This allows the ondo.ts route guard to deny requests cleanly when ENABLE_ONDO_FINANCE=false
    this.apiKey = apiKey || process.env.PODS_API_KEY || '';
    this.baseURL = process.env.PODS_BASE_URL || process.env.PODS_API_BASE_URL || '';
  }

  /**
   * Lazily initialise and return the Axios client.
   * Throws a clear error if credentials are missing at the point of first use.
   */
  private getClient(): AxiosInstance {
    if (this._client) return this._client;
    if (!this.apiKey) throw new Error('Ondo provider API key is not configured. Set PODS_API_KEY.');
    if (!this.baseURL) throw new Error('Ondo provider base URL is not configured. Set PODS_BASE_URL or PODS_API_BASE_URL.');
    this._client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    });
    return this._client;
  }

  /**
   * Helper to determine live US stock market trading hours
   * 9:30 AM to 4:00 PM EST (Monday - Friday)
   */
  private checkUsMarketHours(): boolean {
    const now = new Date();
    const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const estDate = new Date(estString);
    const day = estDate.getDay();
    const hours = estDate.getHours();
    const minutes = estDate.getMinutes();

    if (day === 0 || day === 6) return false;

    const timeInMinutes = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 30;
    const marketClose = 16 * 60;

    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  }

  /**
   * STEP 1: Check market status for a specific ticker
   */
  async getMarketStatus(symbol: string): Promise<OndoMarketStatus> {
    try {
      const { data } = await this.getClient().get<OndoMarketStatus>(`/ondo/stocks/market-status`, {
        params: { symbol: symbol.toLowerCase() },
      });
      return data;
    } catch (error: any) {
      throw new Error(`Ondo market status unavailable: ${error.message}`);
    }
  }

  /**
   * STEP 2: List available stocks/ETFs on BSC with live Polygon.io price enrichment.
   * Throws if the live API is unavailable — no fallback to a stale catalog.
   */
  async listStocksAndETFs(): Promise<OndoToken[]> {
    const { data } = await this.getClient().get<{ data?: { tokens?: OndoToken[] }; tokens?: OndoToken[] }>('/tokens', {
      params: {
        chainId: 56, // BSC
        limit: 300,
      },
    });

    const tokens = data?.data?.tokens || data?.tokens || [];
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new Error('Ondo returned no live stock assets');
    }

    const liveTokens = tokens.filter(token =>
      (token.category || []).includes('stock') ||
      (token.category || []).includes('etf') ||
      (token.category || []).includes('rwa')
    );

    if (liveTokens.length === 0) {
      throw new Error('Ondo returned no stock or ETF assets');
    }

    // Enrich with live Polygon.io prices
    const symbols = liveTokens.map(t => t.symbol);
    const polygonPrices = await fetchPolygonPrices(symbols);

    return liveTokens.map(token => {
      const livePrice = polygonPrices.get(token.symbol.toUpperCase()) || polygonPrices.get(token.symbol);
      return {
        ...token,
        priceInUSD: livePrice || token.priceInUSD || '0.00',
      };
    });
  }

  /**
   * STEP 2: Resolve strategy ID for a given token address
   */
  async resolveStrategyId(tokenAddress: string): Promise<string | null> {
    try {
      const { data } = await this.getClient().get<{ data: OndoStrategy[] }>('/strategies', {
        params: {
          protocol: 'Ondo',
          network: 'bsc',
        },
      });

      const strategy = data?.data?.find(s =>
        s.asset.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (strategy) return strategy.id;
    } catch (error: any) {
      console.warn('[OndoClient] Live strategy resolution failed:', error.message);
    }

    return null;
  }

  /**
   * STEP 3: Buy stock (request-lend) — returns EVM bytecode for NEAR MPC signing
   */
  async buyStock(params: {
    strategyId: string;
    usdAmount: number;
    userWallet: string;
  }): Promise<OndoBytecodeResponse> {
    try {
      const amount = Math.floor(params.usdAmount * 1_000_000).toString();

      const { data } = await this.getClient().get<OndoBytecodeResponse>(
        `/strategies/${params.strategyId}/bytecode`,
        {
          params: {
            action: 'request-lend',
            amount,
            wallet: params.userWallet,
            fromChainId: 8453, // Base
            fromTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
          },
        }
      );

      return data;
    } catch (error: any) {
      throw new Error(`Ondo buy quote unavailable: ${error.message}`);
    }
  }

  /**
   * STEP 4: Sell stock (request-withdraw) — returns EVM bytecode for NEAR MPC signing
   */
  async sellStock(params: {
    strategyId: string;
    shareAmountWei: string;
    userWallet: string;
  }): Promise<OndoBytecodeResponse> {
    try {
      const { data } = await this.getClient().get<OndoBytecodeResponse>(
        `/strategies/${params.strategyId}/bytecode`,
        {
          params: {
            action: 'request-withdraw',
            amountInShares: params.shareAmountWei,
            wallet: params.userWallet,
            toChainId: 8453,
            toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          },
        }
      );

      return data;
    } catch (error: any) {
      throw new Error(`Ondo sell quote unavailable: ${error.message}`);
    }
  }

  /**
   * STEP 5: Check action status
   */
  async getActionStatus(actionId: string): Promise<OndoActionStatus> {
    try {
      const { data } = await this.getClient().get<OndoActionStatus>(`/actions/${actionId}`);
      return data;
    } catch (error: any) {
      throw new Error(`Ondo action status unavailable: ${error.message}`);
    }
  }

  /**
   * STEP 6: Get user's stock positions
   */
  async getUserStockPositions(walletAddress: string): Promise<OndoPosition[]> {
    try {
      const { data } = await this.getClient().get<{
        earn: {
          positions: OndoPosition[];
        };
      }>(`/v2/wallets/${walletAddress}`, {
        params: {
          include: 'all',
        },
      });

      return data?.earn?.positions?.filter(p => p.strategy.protocol === 'Ondo') || [];
    } catch (error: any) {
      return [];
    }
  }
}