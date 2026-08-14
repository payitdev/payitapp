/**
 * Ondo Global Markets Client for PayIT Stock/ETF Trading
 * 
 * Integrates Pods Finance's Ondo Global Markets for tokenized stocks & ETFs
 * Operates on BSC for positions, with Base funding and payout support
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
// MAIN CLIENT CLASS
// ============================================================

export class OndoClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PODS_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('PODS_API_KEY is required. Set it in environment or pass to constructor.');
    }

    this.client = axios.create({
      baseURL: 'https://api.pods.finance',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * STEP 1: Check market status for a specific ticker
   */
  async getMarketStatus(symbol: string): Promise<OndoMarketStatus> {
    try {
      const { data } = await this.client.get<OndoMarketStatus>(`/ondo/stocks/market-status`, {
        params: { symbol },
      });
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch market status for ${symbol}: ${error.message}`);
    }
  }

  /**
   * STEP 2: List available stocks/ETFs on BSC
   */
  async listStocksAndETFs(): Promise<OndoToken[]> {
    try {
      const { data } = await this.client.get<{ tokens: OndoToken[] }>('/tokens', {
        params: {
          chainId: 56, // BSC
          limit: 300,
        },
      });
      
      // Filter for stocks and ETFs (category array contains 'stock' or 'etf')
      return data.tokens.filter(token => 
        token.category.includes('stock') || token.category.includes('etf')
      );
    } catch (error: any) {
      throw new Error(`Failed to list stocks/ETFs: ${error.message}`);
    }
  }

  /**
   * STEP 2: Resolve strategy ID for a given token address
   */
  async resolveStrategyId(tokenAddress: string): Promise<string | null> {
    try {
      const { data } = await this.client.get<{ data: OndoStrategy[] }>('/strategies', {
        params: {
          protocol: 'Ondo',
          network: 'bsc',
        },
      });

      // Find strategy where asset matches the token address
      const strategy = data.data.find(s => 
        s.asset.toLowerCase() === tokenAddress.toLowerCase()
      );

      return strategy ? strategy.id : null;
    } catch (error: any) {
      throw new Error(`Failed to resolve strategy ID: ${error.message}`);
    }
  }

  /**
   * STEP 3: Buy stock (request-lend)
   */
  async buyStock(params: {
    strategyId: string;
    usdAmount: number;
    userWallet: string;
  }): Promise<OndoBytecodeResponse> {
    try {
      // Convert USD to Base USDC base units (6 decimals)
      const amount = Math.floor(params.usdAmount * 1_000_000).toString();

      const { data } = await this.client.get<OndoBytecodeResponse>(
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
      throw new Error(`Failed to generate buy bytecode: ${error.message}`);
    }
  }

  /**
   * STEP 4: Sell stock (request-withdraw)
   */
  async sellStock(params: {
    strategyId: string;
    shareAmountWei: string;
    userWallet: string;
  }): Promise<OndoBytecodeResponse> {
    try {
      const { data } = await this.client.get<OndoBytecodeResponse>(
        `/strategies/${params.strategyId}/bytecode`,
        {
          params: {
            action: 'request-withdraw',
            amountInShares: params.shareAmountWei,
            wallet: params.userWallet,
            toChainId: 8453, // Base for payout
            toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
          },
        }
      );

      return data;
    } catch (error: any) {
      throw new Error(`Failed to generate sell bytecode: ${error.message}`);
    }
  }

  /**
   * STEP 5: Check action status
   */
  async getActionStatus(actionId: string): Promise<OndoActionStatus> {
    try {
      const { data } = await this.client.get<OndoActionStatus>(`/actions/${actionId}`);
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch action status: ${error.message}`);
    }
  }

  /**
   * STEP 5: Check strategy status (HTTP fallback for polling)
   */
  async getStrategyStatus(strategyId: string, walletAddress: string): Promise<any> {
    try {
      const { data } = await this.client.get(`/strategies/${strategyId}/status`, {
        params: { wallet: walletAddress },
      });
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch strategy status: ${error.message}`);
    }
  }

  /**
   * STEP 6: Get user's stock positions
   */
  async getUserStockPositions(walletAddress: string): Promise<OndoPosition[]> {
    try {
      const { data } = await this.client.get<{
        earn: {
          positions: OndoPosition[];
        };
      }>(`/v2/wallets/${walletAddress}`, {
        params: {
          include: 'all',
        },
      });

      // Filter for Ondo protocol positions
      return data.earn.positions.filter(p => p.strategy.protocol === 'Ondo');
    } catch (error: any) {
      throw new Error(`Failed to fetch stock positions: ${error.message}`);
    }
  }

  /**
   * Helper: Get stock strategy details
   */
  async getStockStrategyDetails(strategyId: string): Promise<any> {
    try {
      const { data } = await this.client.get(`/v2/strategies/${strategyId}`);
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch strategy details: ${error.message}`);
    }
  }
}