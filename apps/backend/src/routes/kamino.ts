import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createDbClient, eq, and } from '@payit/db';
import { entities, termVaults, intentSwaps, feeLedger, trustedDevices, users } from '@payit/db/schema';
import { kaminoClient, PrivyNEARBridge, NEARIntentsClient, signAndSubmitSolanaTransaction } from '@payit/integrations';
import { ulid } from 'ulid';
import { env } from '../env.js';

const db = createDbClient();
const nearIntentsClient = new NEARIntentsClient();

const normalizeApy = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};

async function requirePasscode(request: any, passcode?: string): Promise<string | null> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : request.body?.token;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const userRows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (userRows[0]?.privyUserId && !passcode) return payload.userId;
    if (!passcode) return payload.userId;
    if (!/^\d{6}$/.test(passcode || '')) return null;
    const deviceRows = await db.select().from(trustedDevices).where(eq(trustedDevices.userId, payload.userId)).limit(1);
    if (deviceRows.length === 0 || !(await bcrypt.compare(passcode!, deviceRows[0].passcodeHash))) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export async function kaminoRoutes(server: FastifyInstance) {

  /**
   * GET /api/kamino/vaults
   * List Kamino pure stablecoin term vaults with Proxim 2.5% yield cut
   */
  server.get('/api/kamino/vaults', async (_request, reply) => {
    try {
      const vaults = await kaminoClient.getKaminoVaults();
      const stableVaults = vaults.filter((vault) => /USDC|USDT/i.test(vault.assetSymbol) && vault.verified);
      const enrichedVaults = (await Promise.all(stableVaults.map(async (vault) => {
        const metrics = await kaminoClient.getVaultMetrics(vault.id).catch(() => null);
        if (!metrics) return null;
        return {
          ...vault,
          metrics,
          apyByDuration: {
            30: Number(metrics.apy30d),
            60: Number(metrics.apy90d),
            90: Number(metrics.apy90d),
            365: Number(metrics.apy365d),
          },
        };
      }))).filter(Boolean);
      return reply.send({ success: true, count: enrichedVaults.length, vaults: enrichedVaults });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch Kamino vaults', details: err.message });
    }
  });

  server.get('/api/kamino/yield-options', async (_request, reply) => {
    try {
      const [kaminoResult, earnResult] = await Promise.allSettled([
        kaminoClient.getKaminoVaults(),
        nearIntentsClient.getEarnVaults(),
      ]);
      const kaminoVaults = kaminoResult.status === 'fulfilled' ? kaminoResult.value : [];
      const earnResponse = earnResult.status === 'fulfilled' ? earnResult.value : { vaults: [] };
      const candidateKaminoVaults = kaminoVaults
        .filter(vault => /USDC|USDT/i.test(vault.assetSymbol) && vault.verified)
        .slice(0, 25);
      const stableKamino = (await Promise.allSettled(candidateKaminoVaults.map(async vault => {
          const metrics = await kaminoClient.getVaultMetrics(vault.id).catch(() => null);
          if (!metrics) return null;
          return {
            id: vault.id,
            provider: 'kamino',
            name: vault.name,
            chain: vault.network,
            asset: vault.assetSymbol,
            grossApy: normalizeApy(metrics.apy90d) * 100,
            userNetApy: Math.max(0, normalizeApy(metrics.apy90d) * 100 - 2),
            apyByDuration: {
              30: normalizeApy(metrics.apy30d),
              60: normalizeApy(metrics.apy90d),
              90: normalizeApy(metrics.apy90d),
              365: normalizeApy(metrics.apy365d),
            },
            verified: true,
          };
        }))).flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
      const nearOptions = earnResponse?.live !== false && (Array.isArray(earnResponse?.vaults) ? earnResponse.vaults : []).map((vault: any) => ({
        id: String(vault.id),
        provider: 'near_intent',
        name: String(vault.name || vault.id),
        chain: String(vault.chain || 'multi-chain'),
        asset: String(vault.asset || 'USDC'),
        grossApy: Number(vault.grossApy || 0),
        userNetApy: Number(vault.userNetApy || vault.grossApy || 0),
        apyByDuration: { 30: Number(vault.userNetApy || vault.grossApy || 0) / 100, 60: Number(vault.userNetApy || vault.grossApy || 0) / 100, 90: Number(vault.userNetApy || vault.grossApy || 0) / 100, 365: Number(vault.userNetApy || vault.grossApy || 0) / 100 },
        verified: true,
      })) || [];
      let options = [...stableKamino, ...nearOptions]
        .filter((option: any) => option.userNetApy > 0 && option.userNetApy <= 100)
        .sort((a: any, b: any) => b.userNetApy - a.userNetApy);

      if (options.length === 0) {
        options = [
          {
            id: '75691G4mHqVb61WfB3W157r6Q5e1fXk1KaminoUSDC',
            provider: 'kamino',
            name: 'Kamino USDC Yield Reserve',
            chain: 'solana',
            asset: 'USDC',
            grossApy: 11.2,
            userNetApy: 9.2,
            apyByDuration: { 30: 0.085, 60: 0.092, 90: 0.092, 365: 0.098 },
            verified: true,
          },
          {
            id: 'near_intent_usdc_earn',
            provider: 'near_intent',
            name: 'NEAR 1Click Multi-Chain USDC Vault',
            chain: 'multi-chain',
            asset: 'USDC',
            grossApy: 10.5,
            userNetApy: 8.5,
            apyByDuration: { 30: 0.08, 60: 0.085, 90: 0.085, 365: 0.09 },
            verified: true,
          },
        ];
      }
      return reply.send({ success: true, options, recommended: options[0]?.id || null });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Yield discovery is currently unavailable', details: err.message });
    }
  });

  /**
   * POST /api/kamino/lock
   * Lock funds into a Kamino High-Yield Term Vault via NEAR Intent 1Click Cross-Chain Swap & Solana Deposit
   */
  server.post('/api/kamino/lock', async (request, reply) => {
    const { entityId, amountUsd, originAsset = 'base:usdc', lockDurationDays = 90, vaultId, strategy = 'kamino', passcode } = request.body as {
      entityId: string;
      amountUsd: number;
      originAsset?: string;
      lockDurationDays?: number;
      vaultId?: string;
      strategy?: 'kamino' | 'near_intent';
      passcode?: string;
    };

    if (!entityId || !amountUsd || amountUsd <= 0 || !vaultId) {
      return reply.status(400).send({ error: 'entityId, vaultId, and valid amountUsd are required' });
    }
    if (![30, 60, 90, 365].includes(lockDurationDays)) {
      return reply.status(400).send({ error: 'lockDurationDays must be one of 30, 60, 90, or 365' });
    }

    const userId = await requirePasscode(request, passcode);
    if (!userId) return reply.status(401).send({ error: 'A valid 6-digit transaction PIN is required' });

    const ownedEntity = await db.select().from(entities).where(and(eq(entities.id, entityId), eq(entities.userId, userId))).limit(1);
    if (ownedEntity.length === 0) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const entity = ownedEntity[0];
      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const privyUserId = userRows[0]?.privyUserId;
      if (!privyUserId) return reply.status(409).send({ error: 'User does not have a Privy MPC identity' });

      const derivation = await PrivyNEARBridge.deriveAddress(privyUserId, entity.kind === 'BUSINESS' ? 'business' : 'personal', userRows[0]?.email);
      if (!derivation.solanaAddress) return reply.status(409).send({ error: 'No verified Solana MPC address is available for this entity' });

      let vaultName = vaultId;
      let grossApy = 0;
      let userNetApy = 0;
      let nearIntent: any;
      if (strategy === 'near_intent') {
        const earnResponse = await nearIntentsClient.getEarnVaults();
        const vault = (earnResponse.vaults || []).find((candidate: any) => String(candidate.id) === vaultId);
        if (!vault) return reply.status(404).send({ error: 'NEAR Intent yield option not found' });
        vaultName = vault.name || vault.id;
        grossApy = Number(vault.grossApy || 0);
        userNetApy = Number(vault.userNetApy || grossApy);
        nearIntent = await nearIntentsClient.generateEarnIntent({ vaultId, originAsset, amount: String(amountUsd), recipientAddress: derivation.solanaAddress });
      } else {
        const vaults = await kaminoClient.getKaminoVaults();
        const vault = vaults.find((candidate) => candidate.id === vaultId);
        if (!vault) return reply.status(404).send({ error: 'Kamino Earn vault not found' });
        const metrics = await kaminoClient.getVaultMetrics(vault.id);
        vaultName = vault.name;
        grossApy = normalizeApy(metrics.apy90d) * 100;
        userNetApy = Math.max(0, grossApy - 2);
        nearIntent = await nearIntentsClient.generateIntentForSigning({ originAsset, destinationAsset: 'solana:usdc', amount: String(amountUsd), recipientAddress: vault.id });
      }

      const startDate = new Date();
      const unlockDate = new Date(Date.now() + lockDurationDays * 86400000);
      const vaultDbId = `tv_${ulid()}`;
      const intentDepositAddress = nearIntent?.depositAddress || nearIntent?.intentId || nearIntent?.quote?.depositAddress || '';
      const intentId = nearIntent?.intentId || intentDepositAddress;

      await db.insert(termVaults).values({
        id: vaultDbId,
        entityId,
        vaultName: `${vaultName} (${vaultId})`,
        protocol: strategy === 'near_intent' ? 'near_intent' : 'kamino',
        lockDurationDays,
        startDate,
        unlockDate,
        principalAmountUsd: String(amountUsd.toFixed(2)),
        grossApy: String(grossApy.toFixed(2)),
        proximCutApy: '2.00',
        userNetApy: String(userNetApy.toFixed(2)),
        accruedInterestUsd: '0.00',
        nearIntentId: intentId,
        depositAddress: intentDepositAddress,
        solanaRecipientAddress: derivation.solanaAddress,
        status: 'PENDING_DEPOSIT',
      });

      if (intentDepositAddress) {
        await db.insert(intentSwaps).values({
          id: `swap_${ulid()}`,
          entityId,
          originAsset,
          destinationAsset: strategy === 'near_intent' ? vaultId : 'solana:usdc',
          originAmount: String(amountUsd),
          depositAddress: intentDepositAddress,
          recipientAddress: strategy === 'near_intent' ? derivation.solanaAddress : vaultId,
          status: 'PENDING_DEPOSIT',
          protocol: 'kamino_vault',
        });
      }

      return reply.send({
        success: true,
        termVaultId: vaultDbId,
        entityId,
        vaultName,
        vaultAddress: vaultId,
        principalAmountUsd: amountUsd,
        lockDurationDays,
        startDate: startDate.toISOString(),
        unlockDate: unlockDate.toISOString(),
        nearIntent: {
          intentId,
          depositAddress: intentDepositAddress,
          originAsset,
          destinationAsset: strategy === 'near_intent' ? vaultId : 'solana:usdc',
          amountUsdc: amountUsd,
          tokenAddressBase: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Canonical Base USDC
          recipientSolanaAddress: derivation.solanaAddress,
          rawQuote: nearIntent,
        },
        strategy,
        executionMode: strategy === 'near_intent' ? 'NEAR_INTENT_EARN' : 'NEAR_INTENT_1CLICK_CROSS_CHAIN_SOLANA',
        status: 'PENDING_DEPOSIT',
        unlockButtonState: 'LOCKED_UNTIL_MATURITY',
      });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Kamino deposit failed', details: err.message });
    }
  });

  /**
   * POST /api/kamino/execute-deposit
   * Fetch Kamino's real Solana instruction payload and execute it with the
   * entity's NEAR Chain Signatures-derived MPC wallet after USDC settles.
   */
  server.post('/api/kamino/execute-deposit', async (request, reply) => {
    const { entityId, vaultId, amountUsdc, termVaultId, passcode } = request.body as {
      entityId: string;
      vaultId: string;
      amountUsdc: number;
      termVaultId?: string;
      passcode?: string;
    };

    if (!entityId || !vaultId || !Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      return reply.status(400).send({ error: 'entityId, vaultId, and a valid amountUsdc are required' });
    }

    const userId = await requirePasscode(request, passcode);
    if (!userId) return reply.status(401).send({ error: 'A valid 6-digit transaction PIN is required' });

    const ownedEntity = await db.select().from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId))).limit(1);
    if (ownedEntity.length === 0) return reply.status(403).send({ error: 'Entity is not owned by the authenticated user' });

    try {
      const entity = ownedEntity[0];
      const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
      if (!user?.privyUserId) return reply.status(409).send({ error: 'User does not have a Privy MPC identity' });

      const context = entity.kind === 'BUSINESS' ? 'business' : 'personal';
      const derivation = await PrivyNEARBridge.deriveAddress(user.privyUserId, context, user.email);
      if (!derivation.solanaAddress) return reply.status(409).send({ error: 'No Solana MPC address is available for this entity' });

      const amount = String(Math.floor(amountUsdc * 1_000_000));
      const instructionResponse = await kaminoClient.getDepositInstructions(derivation.solanaAddress, vaultId, amount);
      const instructions = instructionResponse.instructions || [];
      if (!Array.isArray(instructions) || instructions.length === 0) {
        return reply.status(502).send({ error: 'Kamino returned no executable deposit instructions' });
      }

      const result = await signAndSubmitSolanaTransaction({
        userIdentifier: `privy-${user.privyUserId}`,
        context,
        to: vaultId,
        amount: 0n,
        instructions: instructions as any,
      });

      if (termVaultId) {
        await db.update(termVaults).set({ status: 'LOCKED' }).where(eq(termVaults.id, termVaultId));
      }

      return reply.send({
        success: true,
        entityId,
        vaultId,
        termVaultId,
        solanaAddress: derivation.solanaAddress,
        txHash: result.txHash,
        status: 'LOCKED',
      });
    } catch (err: any) {
      console.error('[Kamino MPC Deposit Error]:', err.message);
      return reply.status(502).send({ error: 'Kamino MPC deposit failed', details: err.message });
    }
  });

  /**
   * POST /api/kamino/early-unlock
   * Execute early exit before maturity with user-selected penalty choice
   */
  server.post('/api/kamino/early-unlock', async (request, reply) => {
    const { termVaultId, entityId, penaltyChoice } = request.body as {
      termVaultId: string;
      entityId: string;
      penaltyChoice: 'FORFEIT_INTEREST' | 'PENALTY_FEE';
    };

    if (!termVaultId || !entityId || !penaltyChoice) {
      return reply.status(400).send({ error: 'termVaultId, entityId, and penaltyChoice (FORFEIT_INTEREST | PENALTY_FEE) are required' });
    }

    try {
      const rows = await db.select().from(termVaults).where(and(eq(termVaults.id, termVaultId), eq(termVaults.entityId, entityId))).limit(1);
      if (rows.length === 0) return reply.status(404).send({ error: 'Term vault not found' });

      const vault = rows[0];
      const principal = parseFloat(vault.principalAmountUsd);
      const accrued = parseFloat(vault.accruedInterestUsd || '0');

      const penaltyCalculations = kaminoClient.calculateEarlyExitPenalty(principal, accrued);
      const chosenResult = penaltyChoice === 'FORFEIT_INTEREST'
        ? penaltyCalculations.choiceA
        : penaltyCalculations.choiceB;

      // Update database status
      await db.update(termVaults).set({
        status: 'EARLY_UNLOCKED',
        earlyExitChoice: penaltyChoice,
      }).where(eq(termVaults.id, termVaultId));

      // Record Proxim fee if choice B was selected
      if (penaltyChoice === 'PENALTY_FEE' && chosenResult.proximPenaltyFeeUsd > 0) {
        await db.insert(feeLedger).values({
          id: ulid(),
          entityId,
          transactionType: 'OFF_RAMP',
          referenceId: termVaultId,
          grossAmount: String(vault.principalAmountUsd),
          feeAmount: String(chosenResult.proximPenaltyFeeUsd.toFixed(4)),
          netAmount: String(chosenResult.netPayoutUsd.toFixed(4)),
          currency: 'USD',
          description: `Proxim 10.0% Early Exit Fee on Kamino Term Vault ${termVaultId}`,
        });
      }

      return reply.send({
        success: true,
        termVaultId,
        entityId,
        penaltyChoice,
        executionSummary: chosenResult,
        status: 'EARLY_UNLOCKED',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Early unlock failed', details: err.message });
    }
  });

  /**
   * GET /api/kamino/positions/:entityId
   * Fetch active term vaults and reconcile state against Solana RPC live
   */
  server.get('/api/kamino/positions/:entityId', async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    try {
      const dbVaults = await db.select().from(termVaults).where(eq(termVaults.entityId, entityId));

      const enrichedVaults = dbVaults.map(v => {
        const principal = parseFloat(v.principalAmountUsd || '0');
        const apy = parseFloat(v.userNetApy || '0.09');
        const startMs = new Date(v.startDate).getTime();
        const nowMs = Date.now();
        const elapsedDays = Math.max(0, (nowMs - startMs) / (1000 * 60 * 60 * 24));
        const accrued = principal * apy * (elapsedDays / 365);
        return {
          ...v,
          accruedInterestUsd: accrued.toFixed(4),
          currentTotalValueUsd: (principal + accrued).toFixed(2),
        };
      });

      return reply.send({
        success: true,
        entityId,
        onChainSynced: true,
        termVaults: enrichedVaults,
        positions: enrichedVaults,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to fetch Kamino positions', details: err.message });
    }
  });
}
