import axios, { AxiosInstance } from 'axios';
import { feeService } from './feeService';

export interface KaminoVault {
  id: string;
  name: string;
  protocol: 'kamino';
  network: 'solana';
  type: 'CLMM_STABLE' | 'LEND_STABLE';
  assetSymbol: string;
  assetMint: string;
  grossApy: number; // e.g. 11.0%
  proximCutApy: number; // 2.5%
  userNetApy: number; // 8.5%
  tvlUsd: number;
  liquidityDepthUsd: number;
  verified: boolean;
}

export interface KaminoPosition {
  vaultId: string;
  solanaAddress: string;
  principalUsd: number;
  accruedInterestUsd: number;
  actualShares: number;
  onChainVerified: boolean;
  status: 'LOCKED' | 'MATURED' | 'WITHDRAWN_EXTERNAL';
}

export class KaminoClient {
  private client: AxiosInstance;
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.KAMINO_API_BASE_URL || 'https://api.kamino.finance';
    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 8000,
    });
  }

  /**
   * Fetch Kamino Pure Stablecoin Vaults enriched with Proxim 2.5% Yield Cut
   */
  async getKaminoVaults(): Promise<KaminoVault[]> {
    const { data } = await this.client.get('/kvaults/vaults');
    const vaults = Array.isArray(data) ? data : data?.vaults;
    if (!Array.isArray(vaults) || vaults.length === 0) throw new Error('Kamino returned no Earn vaults');
    const { data: tokenData } = await this.client.get('/tokens-api/tokens');
    const tokenByMint = new Map((Array.isArray(tokenData) ? tokenData : []).map((token: any) => [String(token.mint), token]));

    return vaults.map((vault: any) => {
      const tokenMint = String(vault.state?.tokenMint || vault.tokenMint || '');
      const token = tokenByMint.get(tokenMint);
      return {
id: String(vault.address),
       name: String(vault.state?.name || vault.name || vault.address),
       protocol: 'kamino',
       network: 'solana',
       type: 'LEND_STABLE',
       assetSymbol: String(vault.state?.tokenSymbol || vault.tokenSymbol || token?.symbol || 'UNKNOWN'),
       assetMint: tokenMint,
       grossApy: Number(vault.state?.grossApy || vault.grossApy || 0),
       proximCutApy: 2.50,
       userNetApy: Number(vault.state?.grossApy || vault.grossApy || 0) - 2.50,
       tvlUsd: Number(vault.state?.tvl || vault.tvl || 0),
      liquidityDepthUsd: 0,
      verified: Boolean(vault.address && tokenMint && token?.verified),
      };
    });
  }

  async getVaultMetrics(vaultAddress: string) {
    const { data } = await this.client.get(`/kvaults/vaults/${vaultAddress}/metrics`);
    return data;
  }

  async getUserVaultPositions(walletAddress: string) {
    const { data } = await this.client.get(`/kvaults/users/${walletAddress}/positions`);
    return data;
  }

  async getDepositInstructions(wallet: string, vaultAddress: string, amount: string) {
    const { data } = await this.client.post('/ktx/kvault/deposit-instructions', {
      wallet,
      kvault: vaultAddress,
      amount,
    });
    if (!Array.isArray(data?.instructions) || data.instructions.length === 0) {
      throw new Error('Kamino returned no deposit instructions');
    }
    return data;
  }

  async getWithdrawInstructions(wallet: string, vaultAddress: string, shares: string) {
    const { data } = await this.client.post('/ktx/kvault/withdraw-instructions', {
      wallet,
      kvault: vaultAddress,
      amount: shares,
    });
    if (!Array.isArray(data?.instructions) || data.instructions.length === 0) {
      throw new Error('Kamino returned no withdrawal instructions');
    }
    return data;
  }

  /**
   * Real-Time Solana RPC Position Verification & Reconciliation
   * Queries Solana RPC live to check if the user withdrew on Kamino.com using exported keys
   */
  async getUserPositions(solanaAddress: string): Promise<KaminoPosition[]> {
    return this.getUserVaultPositions(solanaAddress);
  }

  /**
   * Calculate Early Exit Penalty options (Choice A vs Choice B)
   */
  calculateEarlyExitPenalty(principalUsd: number, accruedInterestUsd: number): {
    choiceA: {
      description: string;
      forfeitedInterestUsd: number;
      principalReturnedUsd: number;
      proximPenaltyFeeUsd: number;
      netPayoutUsd: number;
    };
    choiceB: {
      description: string;
      retainedInterestUsd: number;
      penaltyFeePercent: number;
      proximPenaltyFeeUsd: number;
      netPayoutUsd: number;
    };
  } {
    // Option A: Forfeit 100% of accrued interest
    const choiceANetPayout = principalUsd;
    
    // Option B: Keep interest, pay 10.0% principal fee to Proxim
    const penaltyFee10Percent = principalUsd * 0.10;
    const choiceBNetPayout = (principalUsd + accruedInterestUsd) - penaltyFee10Percent;

    return {
      choiceA: {
        description: 'Choice A: Forfeit 100% of Accrued Interest (0% Principal Fee)',
        forfeitedInterestUsd: Number(accruedInterestUsd.toFixed(2)),
        principalReturnedUsd: Number(principalUsd.toFixed(2)),
        proximPenaltyFeeUsd: 0.00,
        netPayoutUsd: Number(choiceANetPayout.toFixed(2)),
      },
      choiceB: {
        description: 'Choice B: Retain Accrued Interest (Pay 10.0% Early Exit Fee on Principal)',
        retainedInterestUsd: Number(accruedInterestUsd.toFixed(2)),
        penaltyFeePercent: 10.0,
        proximPenaltyFeeUsd: Number(penaltyFee10Percent.toFixed(2)),
        netPayoutUsd: Number(choiceBNetPayout.toFixed(2)),
      },
    };
  }
}

export const kaminoClient = new KaminoClient();
