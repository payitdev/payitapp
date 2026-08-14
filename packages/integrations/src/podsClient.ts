/**
 * Pods Finance Client for PayIT Savings Engine
 * 
 * Integrates Pods Finance's yield strategies as PayIT's savings engine
 * Operates exclusively on Base (chainId 8453) with NEAR MPC signing
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================
// TYPES
// ============================================================

export interface PodsStrategy {
  id: string;
  protocol: string;
  assetName: string;
  network: string;
  networkId: number;
  asset: string; // Contract address
  assetDecimals: number;
  apy: number;
  paused: boolean;
  fee: string;
  performanceFeeBps?: string;
  availableActions: string[];
}

export interface PodsBytecodeResponse {
  feeCharged: string;
  chainIdIn: number;
  chainIdOut: number;
  id: string;
  crossChain: {
    isCrossChain: boolean;
    chainIdIn: number;
    chainIdOut: number;
  };
  quote: PodsQuote | null;
  bytecode: Array<{
    to: string;
    data: string;
    value: string;
    chainId: number;
  }>;
}

export interface PodsQuote {
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

export interface PodsPosition {
  spotPosition: {
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
    cumulativeProfit?: {
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
    apy: number; // gross APY, before Pods fees
    grossAPY?: number;
    netAPY?: number;
    avgApy?: number;
    inceptionApy?: number;
  };
  strategy: {
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
  };
}

export interface PodsWalletResponse {
  earn: {
    positions: PodsPosition[];
    summary: {
      totalProfitInUSD: number;
      totalUnderlyingBalanceUSD: number;
    };
  };
  history?: {
    items: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}

export interface PodsStrategiesResponse {
  data: PodsStrategy[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================================
// MAIN CLIENT CLASS
// ============================================================

export class PodsClient {
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
   * STEP 1: Fetch real available strategies from Pods API
   * Filters for Base network strategies specifically
   */
  async getBaseStrategies(): Promise<PodsStrategy[]> {
    try {
      const { data } = await this.client.get<PodsStrategiesResponse>('/strategies', {
        params: {
          network: 'base',
        },
      });

      return data.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch Base strategies: ${error.message}`);
    }
  }

  /**
   * Fetch all strategies across all networks
   */
  async getAllStrategies(): Promise<PodsStrategy[]> {
    try {
      const { data } = await this.client.get<PodsStrategiesResponse>('/strategies');
      return data.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch all strategies: ${error.message}`);
    }
  }

  /**
   * Get strategies by protocol filter
   */
  async getStrategiesByProtocol(protocol: string, network: string = 'base'): Promise<PodsStrategy[]> {
    try {
      const { data } = await this.client.get<PodsStrategiesResponse>('/strategies', {
        params: {
          protocol,
          network,
        },
      });

      return data.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch ${protocol} strategies: ${error.message}`);
    }
  }

  /**
   * STEP 2: Build deposit bytecode function
   * Covers all three savings flavors via strategyId selection
   */
  async getSavingsDepositBytecode(params: {
    strategyId: string;
    amount: string;
    sourceWallet: string;
    destinationWallet: string;
    fromTokenAddress?: string;
    fromChainId?: number;
  }): Promise<PodsBytecodeResponse> {
    try {
      const { data } = await this.client.get<PodsBytecodeResponse>(
        `/strategies/${params.strategyId}/bytecode`,
        {
          params: {
            action: 'request-lend',
            amount: params.amount,
            wallet: params.sourceWallet,
            destinationAddress: params.destinationWallet,
            ...(params.fromTokenAddress && { fromTokenAddress: params.fromTokenAddress }),
            ...(params.fromChainId && { fromChainId: params.fromChainId }),
          },
        }
      );

      return data;
    } catch (error: any) {
      throw new Error(`Failed to generate deposit bytecode: ${error.message}`);
    }
  }

  /**
   * STEP 5: Withdrawal bytecode function (mirror of deposit)
   */
  async getSavingsWithdrawBytecode(params: {
    strategyId: string;
    amount: string;
    sourceWallet: string;
    destinationWallet: string;
    toChainId?: number;
    toTokenAddress?: string;
  }): Promise<PodsBytecodeResponse> {
    try {
      const { data } = await this.client.get<PodsBytecodeResponse>(
        `/strategies/${params.strategyId}/bytecode`,
        {
          params: {
            action: 'request-withdraw',
            amount: params.amount,
            wallet: params.sourceWallet,
            destinationAddress: params.destinationWallet,
            ...(params.toChainId && { toChainId: params.toChainId }),
            ...(params.toTokenAddress && { toTokenAddress: params.toTokenAddress }),
          },
        }
      );

      return data;
    } catch (error: any) {
      throw new Error(`Failed to generate withdrawal bytecode: ${error.message}`);
    }
  }

  /**
   * STEP 4: Position tracking function
   * Returns yield positions for a specific wallet address
   */
  async getUserSavingsPosition(walletAddress: string): Promise<PodsWalletResponse['earn']> {
    try {
      const { data } = await this.client.get<PodsWalletResponse>(
        `/v2/wallets/${walletAddress}`,
        {
          params: {
            include: 'earn',
          },
        }
      );

      return data.earn;
    } catch (error: any) {
      throw new Error(`Failed to fetch wallet positions: ${error.message}`);
    }
  }

  /**
   * Get strategy details by ID
   */
  async getStrategyDetails(strategyId: string): Promise<any> {
    try {
      const { data } = await this.client.get(`/v2/strategies/${strategyId}`);
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch strategy details: ${error.message}`);
    }
  }

  /**
   * Check action status for async operations
   */
  async getActionStatus(actionId: string): Promise<any> {
    try {
      const { data } = await this.client.get(`/actions/${actionId}`);
      return data;
    } catch (error: any) {
      throw new Error(`Failed to fetch action status: ${error.message}`);
    }
  }

  /**
   * Helper: Find strategies matching specific token on Base
   * Used to determine free like-for-like tier vs 20bps swap tier
   */
  async findStrategiesByToken(tokenAddress: string): Promise<PodsStrategy[]> {
    const allStrategies = await this.getBaseStrategies();
    return allStrategies.filter(strategy => 
      strategy.asset.toLowerCase() === tokenAddress.toLowerCase()
    );
  }

  /**
   * Helper: Check for OpenCover-insured strategies on Base
   * Follows naming convention: {protocol}-covered{asset}-{network}
   */
  async findOpenCoverStrategies(): Promise<PodsStrategy[]> {
    const allStrategies = await this.getBaseStrategies();
    return allStrategies.filter(strategy => 
      strategy.id.toLowerCase().includes('covered') ||
      strategy.protocol.toLowerCase().includes('opencover')
    );
  }
}
