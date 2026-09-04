/**
 * Intent Retry Manager
 * 
 * Handles exponential backoff retry logic for failed intent fundings
 * Automatically retries transient failures with increasing delays
 */

import { createDbClient, eq, and, lte } from '@payit/db';
import { intentSwaps, users, entities } from '@payit/db/schema';
import { fundIntentFromBitcoin, fundIntentFromNear, signAndSubmitTransaction, signAndSubmitSolanaTransaction, toBaseUnits } from '@payit/integrations';
import { NEARIntentsClient } from '@payit/integrations';
import { env } from '../env.js';

const db = createDbClient(env.DATABASE_URL);
const nearIntentsClient = new NEARIntentsClient({
  oneClickApiKey: env.NEAR_INTENT_1CLICK_API_KEY,
  explorerApiKey: env.NEAR_INTENT_EXPLORER_API_KEY,
  baseUrl: env.NEAR_INTENT_BASE_URL,
});

export class IntentRetryManager {
  private static readonly RETRY_INTERVALS = [
    1 * 60 * 1000,      // 1 minute
    5 * 60 * 1000,      // 5 minutes
    15 * 60 * 1000,     // 15 minutes
    1 * 60 * 60 * 1000, // 1 hour
    6 * 60 * 60 * 1000, // 6 hours
  ];
  private static readonly MAX_RETRIES = 5;

  /**
   * Schedule a retry for a failed intent
   */
  static async scheduleRetry(intentId: string, attemptNumber: number, error: string) {
    if (attemptNumber >= this.MAX_RETRIES) {
      // Max retries reached - mark as permanently failed
      await db.update(intentSwaps)
        .set({ 
          status: 'FAILED', 
          failureReason: `Max retries exceeded: ${error}`,
          retryCount: attemptNumber,
          nextRetryAt: null,
        })
        .where(eq(intentSwaps.id, intentId));
      
      console.error(`[Intent Retry] Max retries exceeded for intent ${intentId}`);
      return;
    }
    
    const nextRetryAt = new Date(Date.now() + this.RETRY_INTERVALS[attemptNumber]);
    
    await db.update(intentSwaps)
      .set({
        status: 'RETRYING',
        retryCount: attemptNumber + 1,
        nextRetryAt,
        lastError: error,
      })
      .where(eq(intentSwaps.id, intentId));
    
    console.log(`[Intent Retry] Scheduled retry ${attemptNumber + 1}/${this.MAX_RETRIES} for intent ${intentId} at ${nextRetryAt.toISOString()}`);
  }

  /**
   * Process all intents due for retry
   */
  static async processRetries() {
    try {
      const now = new Date();
      const retryingIntents = await db
        .select()
        .from(intentSwaps)
        .where(
          and(
            eq(intentSwaps.status, 'RETRYING'),
            lte(intentSwaps.nextRetryAt, now)
          )
        )
        .limit(25);
      
      if (retryingIntents.length === 0) {
        return;
      }

      console.log(`[Intent Retry] Processing ${retryingIntents.length} retrying intents`);

      for (const intent of retryingIntents) {
        try {
          await this.retryIntent(intent);
        } catch (error: any) {
          console.warn(`[Intent Retry] Retry failed for intent ${intent.id}:`, error.message);
          await this.scheduleRetry(intent.id, intent.retryCount + 1, error.message);
        }
      }
    } catch (error: any) {
      console.error('[Intent Retry] Batch processing error:', error.message);
    }
  }

  /**
   * Retry funding a single intent
   */
  static async retryIntent(intent: any) {
    console.log(`[Intent Retry] Retrying intent ${intent.id} (attempt ${(intent.retryCount || 0) + 1})`);
    
    const entity = await db.select().from(entities).where(eq(entities.id, intent.entityId)).limit(1);
    
    if (!entity[0]) {
      throw new Error('Entity not found');
    }

    const user = await db.select().from(users).where(eq(users.id, entity[0].userId)).limit(1);
    if (!user[0]?.privyUserId) {
      throw new Error('Entity user has no Privy MPC identity');
    }

    const userIdentifier = `privy-${user[0].privyUserId}`;
    const context = entity[0].kind === 'BUSINESS' ? 'business' : 'personal';
    
    let sourceTxHash: string;

    // Retry based on origin chain
    if (intent.originAsset.startsWith('solana:')) {
      sourceTxHash = await this.retrySolanaIntent(intent, userIdentifier, context, entity[0]);
    } else if (intent.originAsset.startsWith('bitcoin:')) {
      sourceTxHash = await this.retryBitcoinIntent(intent, userIdentifier, context, entity[0]);
    } else if (intent.originAsset.startsWith('near:')) {
      sourceTxHash = await this.retryNearIntent(intent, userIdentifier, context, entity[0]);
    } else {
      sourceTxHash = await this.retryEvmIntent(intent, userIdentifier, context, entity[0]);
    }

    const originChain = intent.originAsset.split(':')[0];
    await nearIntentsClient.submitDepositTxHash({
      intentId: intent.depositAddress,
      txHash: sourceTxHash,
      chain: originChain,
    });

    // Update intent status
    await db.update(intentSwaps)
      .set({ 
        sourceTxHash, 
        status: 'SUBMITTED',
        nextRetryAt: null,
        lastError: null,
      })
      .where(eq(intentSwaps.id, intent.id));

    console.log(`✅ [Intent Retry] Successfully retried intent ${intent.id}: ${sourceTxHash}`);
  }

  /**
   * Retry Solana intent funding
   */
  static async retrySolanaIntent(intent: any, userIdentifier: string, context: string, entity: any) {
    if (!entity.solanaDepositAddress) throw new Error('Entity has no Solana MPC wallet');

    const lamports = toBaseUnits(intent.originAmount, 9);
    
    const result = await signAndSubmitSolanaTransaction({
      userIdentifier,
      context: context as 'personal' | 'business',
      to: intent.depositAddress,
      amount: 0n,
      instructions: [{
        programAddress: '11111111111111111111111111111111',
        data: Buffer.alloc(12).toString('base64'),
        accounts: [
          { address: entity.solanaDepositAddress, role: 'SIGNER_WRITABLE' },
          { address: intent.depositAddress, role: 'WRITABLE' },
        ],
      }],
    });

    if (!result.txHash) throw new Error('Solana retry returned no tx hash');
    return result.txHash;
  }

  /**
   * Retry Bitcoin intent funding
   */
  static async retryBitcoinIntent(intent: any, userIdentifier: string, context: string, entity: any) {
    if (!entity.btcDepositAddress) throw new Error('Entity has no BTC MPC wallet');

    const result = await fundIntentFromBitcoin({
      userIdentifier,
      context: context as 'personal' | 'business',
      amount: intent.originAmount,
      intentDepositAddress: intent.depositAddress,
    });

    return result.txHash;
  }

  /**
   * Retry NEAR intent funding
   */
  static async retryNearIntent(intent: any, userIdentifier: string, context: string, entity: any) {
    if (!entity.nearDepositAddress) throw new Error('Entity has no NEAR MPC wallet');

    const result = await fundIntentFromNear({
      userIdentifier,
      context: context as 'personal' | 'business',
      amount: intent.originAmount,
      intentDepositAddress: intent.depositAddress,
    });

    return result.txHash;
  }

  /**
   * Retry EVM intent funding
   */
  static async retryEvmIntent(intent: any, userIdentifier: string, context: string, entity: any) {
    if (!entity.evmDepositAddress) throw new Error('Entity has no EVM MPC wallet');

    // Determine network from origin asset
    const network = intent.originAsset.split(':')[0] as 'base' | 'bsc' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism';
const tokenAddress = this.getTokenAddress(network, intent.originAsset.split(':')[1]);
      
      const decimals = intent.originAsset.includes('usdc') || intent.originAsset.includes('usdt') ? 6 : 18;
      
      const bytecode = tokenAddress
        ? [{ 
            to: tokenAddress, 
            data: this.encodeErc20Transfer(intent.depositAddress, toBaseUnits(intent.originAmount, decimals)), 
            value: '0', 
            chainId: 0 
          }]
        : [{ to: intent.depositAddress, data: '0x', value: intent.originAmount, chainId: 0 }];

    const result = await signAndSubmitTransaction({
      userIdentifier,
      context: context as 'personal' | 'business',
      targetChain: network,
      bytecode,
    });

    const submitted = result[0];
      if (!submitted || !submitted.success || !submitted.txHash) {
        throw new Error('EVM retry failed');
      }

    return submitted.txHash;
  }

  /**
   * Get token address for EVM network
   */
  private static getTokenAddress(network: string, symbol: string): string {
    const tokenMap: Record<string, Record<string, string>> = {
      base: {
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      },
      bsc: {
        usdc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        usdt: '0x55d398326f99059fF775485246999027B3197955',
      },
      ethereum: {
        usdc: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
      polygon: {
        usdc: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        usdt: '0xc2132D05D31c914a87C6611C10748AaCbA0eE9c1',
      },
      arbitrum: {
        usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      },
      optimism: {
        usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        usdt: '0x94b008aA00579c1307B0EF2c499Ad98DA8ce58e58',
      },
    };

    return tokenMap[network]?.[symbol.toLowerCase()] || '';
  }

  /**
   * Encode ERC20 transfer
   */
  private static encodeErc20Transfer(recipient: string, amount: bigint): string {
    const normalizedRecipient = recipient.toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{40}$/.test(normalizedRecipient)) throw new Error('Invalid recipient address');
    return `0xa9059cbb${normalizedRecipient.padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`;
  }
}
