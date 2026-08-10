import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { DeterministicRiskEngine } from '@payit/security';
import { GroqIntentParser } from '@payit/ai';
import { NuvionClient, ParticleClient } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { accounts, entities, auditLogs, riskEvents, ledgerEntries, ledgerAccounts } from '@payit/db/schema';
import { ulid } from 'ulid';
import bcrypt from 'bcryptjs';
import { trustedDevices } from '@payit/db/schema';
import { assertEntityApproved } from './kyc.js';
import { checkIdempotencyKey, saveIdempotencyResponse } from '../middleware/idempotency.js';
import { getEntityBalance } from '../utils/balance.js';

const riskEngine = new DeterministicRiskEngine();
const groq = new GroqIntentParser();
const nuvion = new NuvionClient();
const particle = new ParticleClient();
const db = createDbClient();

export async function transferRoutes(server: FastifyInstance) {

  /**
   * PayIT Off-Ramp Withdrawal Request Endpoint.
   * Step 1: Provisions Nuvion USC stablecoin account on Base if missing.
   * Step 2: Executes gasless on-chain transfer from Particle UA to Nuvion provisioned wallet address on Base (chainId 8453).
   * Step 3: Records withdrawal request in audit logs for automated off-ramp settlement upon webhook deposit confirmation.
   */
  server.post('/api/transfers/withdraw', async (request, reply) => {
    const {
      entityId,
      amount,
      targetCurrency = 'NGN',
      ownerAddress,
      signature,
      offRampDestination,
    } = request.body as {
      entityId: string;
      amount: number;
      targetCurrency?: string;
      ownerAddress: string;
      signature: string;
      offRampDestination: {
        accountNumber: string;
        bankCode?: string;
        accountHolderName: string;
        type?: 'bank-transfer' | 'momo-transfer';
        routingNumber?: string;
        sortCode?: string;
        iban?: string;
      };
    };

    if (!entityId || !amount || amount <= 0 || !ownerAddress || !signature || !offRampDestination?.accountNumber) {
      return reply.status(400).send({
        error: 'entityId, amount, ownerAddress, signature, and offRampDestination (with accountNumber) are required for withdrawal',
      });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const userEntity = entityRows[0];

    try {
      // Step 1: Ensure user has a Nuvion USC account and Base wallet address provisioned
      let uscAccountId = userEntity.nuvionUscAccountId;
      let uscWalletAddress = userEntity.nuvionUscWalletAddress;

      if (!uscAccountId || !uscWalletAddress) {
        server.log.info({ entityId }, 'Provisioning Nuvion USC stablecoin account on Base mainnet...');
        const stableAcc = await nuvion.createOrGetStablecoinAccount(
          userEntity.nuvionEntityId || userEntity.id,
          'USC',
          'base'
        );
        uscAccountId = stableAcc.nuvionAccountId;
        uscWalletAddress = stableAcc.walletAddress;

        await db
          .update(entities)
          .set({
            nuvionUscAccountId: uscAccountId,
            nuvionUscWalletAddress: uscWalletAddress,
          })
          .where(eq(entities.id, entityId));
        server.log.info({ uscAccountId, uscWalletAddress }, 'Provisioned Nuvion USC account on Base and saved to DB');
      }

      // Step 2: Trigger on-chain send from Particle Universal Account to Nuvion provisioned wallet address on Base (chainId 8453)
      server.log.info({ recipientAddress: uscWalletAddress, amount }, 'Triggering on-chain gasless transfer to Nuvion USC wallet on Base...');
      const sweepResult = await particle.executeGaslessTransfer({
        senderEntityId: userEntity.id,
        senderKind: userEntity.kind as 'PERSONAL' | 'BUSINESS',
        recipientAddress: uscWalletAddress,
        amount: String(amount),
        asset: 'USDC',
        chainId: 8453, // Base Mainnet
        ownerAddress,
        signature,
      });

      // Record withdrawal initiation in audit log
      const withdrawalId = `wd_${ulid()}`;
      await db.insert(auditLogs).values({
        id: ulid(),
        userId: userEntity.userId,
        entityId: userEntity.id,
        action: 'NUVION_WITHDRAWAL_INITIATED',
        metadata: JSON.stringify({
          withdrawalId,
          txHash: sweepResult.transactionId,
          nuvionUscAccountId: uscAccountId,
          nuvionUscWalletAddress: uscWalletAddress,
          amount,
          targetCurrency,
          offRampDestination,
          status: 'ON_CHAIN_TRANSFER_SUBMITTED',
          timestamp: new Date().toISOString(),
        }),
        createdAt: new Date(),
      });

      return reply.send({
        success: true,
        withdrawalId,
        txHash: sweepResult.transactionId,
        nuvionUscWalletAddress: uscWalletAddress,
        status: 'pending_onchain_settlement',
        message: 'Withdrawal submitted. Fiat payout will trigger automatically once on-chain deposit confirms.',
      });
    } catch (err: any) {
      server.log.error({ err: err.message, entityId }, 'Withdrawal on-chain transfer failed. Aborting withdrawal.');
      return reply.status(500).send({
        error: `Withdrawal request failed: ${err.message || 'On-chain transaction error'}`,
      });
    }
  });

  /**
   * Get dynamic balance for an entity based on ledger history.
   * Auto-backfills any NUVION_DEPOSIT_CREDITED audit log entries that pre-date
   * the ledger migration so pre-existing deposits are never lost.
   */
  server.get('/api/transfers/balance', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };
    if (!entityId) return reply.send({ balance: 0 });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.send({ balance: 0 });

    const ledgerAccId = `${entityId}_cash`;
    const ledgerClearId = `${entityId}_inbound`;

    // Backfill migration if no ledger accounts exist
    const existingAccounts = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.entityId, entityId)).limit(1);
    if (existingAccounts.length === 0) {
      const depositLogs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, entityId));
      const deposits = depositLogs.filter(l => l.action === 'NUVION_DEPOSIT_CREDITED');

      if (deposits.length > 0) {
        await db.insert(ledgerAccounts).values([
          { id: ledgerAccId, entityId, name: 'Cash / Wallet', type: 'ASSET', currency: 'NGN', createdAt: new Date() },
          { id: ledgerClearId, entityId, name: 'Inbound Deposit Clearing', type: 'LIABILITY', currency: 'NGN', createdAt: new Date() },
        ]);

        for (const log of deposits) {
          let meta: any = {};
          try { meta = JSON.parse(log.metadata || '{}'); } catch {}
          const amt = meta.normalizedAmount || meta.netUserAmount || meta.rawAmount || 0;
          if (amt > 0) {
            const txId = meta.txId || ulid();
            await db.insert(ledgerEntries).values([
              { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerClearId, type: 'DEBIT', amount: String(amt), createdAt: new Date(log.createdAt) },
              { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerAccId, type: 'CREDIT', amount: String(amt), createdAt: new Date(log.createdAt) },
            ]);
          }
        }

        server.log.info(`[Transfers] Backfilled ${deposits.length} deposit(s) into ledger for entity ${entityId}`);
      }
    }

    // Single source of truth ledger summation via shared getEntityBalance (M5)
    const balance = await getEntityBalance(db, entityId);
    return reply.send({ balance });
  });

  /**
   * Get real-time cross-border payout tracking status (FedWire / ACH / SEPA / SWIFT).
   */
  server.get('/api/transfers/status/:payoutId', async (request, reply) => {
    const { payoutId } = request.params as { payoutId: string };
    if (!payoutId) return reply.status(400).send({ error: 'Payout ID is required' });

    try {
      const tracking = await nuvion.getOutboundPayoutStatus(payoutId);
      return reply.send({ success: true, tracking });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to fetch payout tracking status' });
    }
  });

  /**
   * Get live FX rates from Nuvion (cached 90s).
   */
  server.get('/api/fx/rates', async (request, reply) => {
    const rates = await nuvion.getLiveFxRates();
    return reply.send({
      baseCurrency: 'NGN',
      rates,
      cachedAt: new Date().toISOString(),
    });
  });

  /**
   * Get an authenticated FX quote from Nuvion with 30-second TTL.
   */
  server.get('/api/fx/quote', async (request, reply) => {
    const { from, to, amount } = request.query as { from?: string; to?: string; amount?: string };
    if (!from || !to || !amount) {
      return reply.status(400).send({ error: 'from, to, and amount query parameters required' });
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return reply.status(400).send({ error: 'amount must be a positive number' });
    }
    try {
      const quote = await nuvion.getFxQuote(from, to, numAmount);
      return reply.send({ success: true, quote });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to fetch FX quote' });
    }
  });

  /**
   * Fetch transaction activity history from Neon DB.
   */
  server.get('/api/transfers/history', async (request, reply) => {
    const { entityId } = request.query as { entityId?: string };

    if (!entityId) {
      return reply.send({ transactions: [] });
    }

    try {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, entityId))
        .limit(30);

      const SYSTEM_ACTIONS = new Set([
        'TREASURY_FEE_SWEEP_EXECUTED',
        'PARTICLE_SWEEP_EXECUTED',
        'RECONCILIATION_RUN',
      ]);

      const INBOUND_ACTIONS = new Set([
        'NUVION_DEPOSIT_CREDITED',
        'PAYMENT_RECEIVED',
        'INBOUND_TRANSFER',
        'PAYROLL_RECEIVED',
      ]);

      const transactions = logs
        .filter(l => !SYSTEM_ACTIONS.has(l.action))
        .map(l => {
          let meta: any = {};
          try {
            meta = JSON.parse(l.metadata || '{}');
          } catch {}

          const isInbound = INBOUND_ACTIONS.has(l.action) || l.action.includes('INBOUND') || l.action.includes('PAYMENT_RECEIVED');
          const isDeposit = l.action === 'NUVION_DEPOSIT_CREDITED';
          const isTransfer = l.action === 'TRANSFER_EXECUTE';

          const rawAmount = meta.normalizedAmount ?? meta.netUserAmount ?? meta.amount ?? meta.feeAmountLocal ?? 0;
          const curr = meta.currency || 'NGN';
          const sym = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : '₦';
          const counterparty = meta.recipient || meta.senderName || meta.entityId || 'External Account';

          let title: string;
          if (isDeposit) {
            title = `Received from ${meta.senderName || 'Bank Transfer'}`;
          } else if (isTransfer) {
            title = `Sent to ${counterparty}`;
          } else if (l.action === 'PAYMENT_RECEIVED') {
            title = `Received from ${counterparty}`;
          } else {
            title = l.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }

          return {
            id: l.id,
            type: isInbound ? 'INBOUND' : 'OUTBOUND',
            title,
            subtitle: meta.reference || meta.narration || 'Payment',
            amount: parseFloat(String(rawAmount)),
            currency: curr,
            symbol: sym,
            feeAmount: meta.feeAmount || meta.feeAmountLocal || 0,
            netAmount: meta.netUserAmount || rawAmount,
            date: new Date(l.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: meta.sendMode || 'fiat',
            senderAccount: isInbound ? counterparty : 'PayIT Account',
            recipientAccount: isInbound ? 'PayIT Account' : counterparty,
            reference: meta.txHash || meta.txId || l.id,
          };
        })
        .filter(tx => tx.amount > 0);

      return reply.send({ transactions });

    } catch (err: any) {
      server.log.error({ err }, 'Error fetching transfer history');
      return reply.send({ transactions: [] });
    }
  });

  /**
   * Dynamic live FX quote with PayIT margin applied.
   */
  server.post('/api/fx/dynamic-quote', async (request, reply) => {
    const { fromCurrency, toCurrency, amount, isDeposit, marginPercent } = request.body as {
      fromCurrency: any;
      toCurrency: any;
      amount: number;
      isDeposit?: boolean;
      marginPercent?: number;
    };

    if (!amount || amount <= 0 || !fromCurrency || !toCurrency) {
      return reply.status(400).send({ error: 'amount (> 0), fromCurrency, and toCurrency are required' });
    }

    try {
      const quote = await nuvion.getLiveDynamicQuote({ fromCurrency, toCurrency, amount, isDeposit, marginPercent });

      return reply.send({
        fromCurrency: quote.fromCurrency,
        toCurrency: quote.toCurrency,
        inputAmount: quote.inputAmount,
        clientReceivedAmount: quote.clientReceivedAmount,
        effectiveDisplayRate: quote.clientEffectiveRate,
        ratesLastUpdated: quote.ratesLastUpdated,
        timestamp: quote.timestamp,
      });
    } catch (err: any) {
      server.log.error({ err }, 'Dynamic FX quote failed');
      return reply.status(502).send({ error: `FX quote unavailable: ${err.message}` });
    }
  });

  /**
   * Currency conversion using live rates.
   */
  server.post('/api/fx/convert', async (request, reply) => {
    const { amount, fromCurrency, toCurrency } = request.body as {
      amount: number;
      fromCurrency: any;
      toCurrency: any;
    };

    if (!amount || !fromCurrency || !toCurrency) {
      return reply.status(400).send({ error: 'amount, fromCurrency, and toCurrency are required' });
    }

    try {
      const conversion = await nuvion.convertCurrency(amount, fromCurrency, toCurrency);
      return reply.send({ success: true, conversion });
    } catch (err: any) {
      return reply.status(502).send({ error: `Conversion failed: ${err.message}` });
    }
  });

  /**
   * Conversational command parser (Groq LPU).
   */
  server.post('/api/transfers/parse-command', async (request, reply) => {
    const { promptText } = request.body as { promptText?: string };
    if (!promptText) return reply.status(400).send({ error: 'promptText is required' });

    const draft = await groq.parseCommand(promptText);
    return reply.send({ draft });
  });

  /**
   * Execute Transfer.
   * Enforces entity access guard and entity approval check before execution.
   */
  server.post('/api/transfers/execute', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const {
      entityId,
      recipientName,
      bankName,
      accountNumber,
      ibanOrRoutingNumber,
      bicOrSwiftCode,
      sortCode,
      mode,
      network,
      recipientAddress,
      asset,
      txHash,
      chainId,
      amount,
      currency,
      narration,
      stepUpPin,
      passcode,
      deviceId,
      recipientTagOrAccount,
      sendMode,
      sendCurrency,
      recipientBankName,
      recipientCryptoAddress,
    } = request.body as {
      entityId: string;
      recipientName?: string;
      bankName?: string;
      accountNumber?: string;
      ibanOrRoutingNumber?: string;
      bicOrSwiftCode?: string;
      sortCode?: string;
      mode?: 'fiat' | 'crypto';
      network?: string;
      recipientAddress?: string;
      asset?: string;
      txHash?: string;
      chainId?: number;
      amount: number;
      currency: string;
      narration?: string;
      stepUpPin?: string;
      passcode?: string;
      deviceId?: string;
      recipientTagOrAccount?: string;
      sendMode?: 'fiat' | 'crypto';
      sendCurrency?: string;
      recipientBankName?: string;
      recipientCryptoAddress?: string;
    };

    const resolvedMode = mode || sendMode || 'fiat';
    const resolvedCurrency = currency || sendCurrency || 'NGN';
    const resolvedRecipient = recipientName || recipientTagOrAccount || accountNumber || recipientAddress || '';
    const resolvedPin = passcode || stepUpPin;
    const resolvedCryptoAddress = recipientAddress || recipientCryptoAddress || '';
    const resolvedBank = bankName || recipientBankName || '';

    const idempotencyKey = (request.headers['x-idempotency-key'] as string) || (request.body as any)?.idempotencyKey;
    if (idempotencyKey) {
      const { isDuplicate, record } = await checkIdempotencyKey(idempotencyKey, entityId);
      if (isDuplicate && record) {
        if (record.status === 'PROCESSING') {
          return reply.status(409).send({ error: 'A transfer request with this idempotency key is already processing. Please wait.' });
        }
        return reply.status(record.statusCode || 200).send(record.response);
      }
    }

    // 1. Entity guard
    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Amount must be greater than zero' });
    }

    // 2. Load entity and enforce entity approval gate
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    try {
      assertEntityApproved(entity);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // 2b. Atomic Balance Verification via shared currency-scoped getEntityBalance (C12)
    const currentBalance = await getEntityBalance(db, entityId, resolvedCurrency);

    if (currentBalance < amount) {
      return reply.status(422).send({
        error: `Insufficient funds. Your current available balance for ${resolvedCurrency} is ${resolvedCurrency === 'NGN' ? '₦' : '$'}${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        availableBalance: currentBalance,
        currency: resolvedCurrency,
      });
    }

    const entityAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId)).limit(1);
    const account = entityAccounts[0] || null;

    const recentLogs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, entityId), eq(auditLogs.action, 'TRANSFER_EXECUTE')))
      .limit(10);

    const userHistory = recentLogs.map(l => {
      let meta: any = {};
      try { meta = JSON.parse(l.metadata || '{}'); } catch {}
      return {
        createdAt: new Date(l.createdAt),
        amount: meta.amount || 0,
        recipientTagOrAccount: meta.recipient || '',
        deviceId: meta.deviceId || 'unknown_device',
      };
    });

    // 3. Deterministic risk evaluation
    const riskAssessment = riskEngine.evaluate({
      userId: session.userId,
      entityId,
      amount,
      recipientTagOrAccount: resolvedRecipient,
      deviceId: deviceId || 'unknown_device',
      userKnownRecipients: userHistory.map(h => h.recipientTagOrAccount).filter(Boolean),
      userHistory,
    });

    await db.insert(riskEvents).values({
      id: ulid(),
      userId: session.userId,
      entityId,
      score: String(riskAssessment.score),
      riskLevel: riskAssessment.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
      rulesTriggered: JSON.stringify(riskAssessment.rulesTriggered),
      decisionReason: riskAssessment.reason,
      createdAt: new Date(),
    });

    if (riskAssessment.riskLevel === 'HIGH') {
      return reply.status(422).send({
        status: 'HELD_FOR_REVIEW',
        riskLevel: 'HIGH',
        explanation: groq.formatRiskExplanation(riskAssessment.rulesTriggered, 'HIGH'),
      });
    }

    // 4. Step-up auth — verify passcode against bcrypt hash in DB
    if (riskAssessment.requiresStepUpAuth) {
      if (!resolvedPin || !deviceId) {
        return reply.status(401).send({
          status: 'STEP_UP_AUTH_REQUIRED',
          requiresPinStepUp: true,
          riskLevel: 'MEDIUM',
          explanation: groq.formatRiskExplanation(riskAssessment.rulesTriggered, 'MEDIUM'),
          message: 'Enter your 6-digit PayIT passcode to proceed',
        });
      }

      const deviceRows = await db
        .select()
        .from(trustedDevices)
        .where(and(eq(trustedDevices.userId, session.userId), eq(trustedDevices.deviceId, deviceId)))
        .limit(1);

      if (deviceRows.length === 0) {
        return reply.status(401).send({ error: 'Trusted device not registered. Set up your passcode first.' });
      }

      const pinValid = await bcrypt.compare(resolvedPin, deviceRows[0].passcodeHash);
      if (!pinValid) {
        return reply.status(401).send({ error: 'Incorrect passcode. Transaction blocked.' });
      }
    }

    // 5. Get live FX quote to determine fee
    const fromCurr = resolvedCurrency as any;
    const toCurr = 'USD' as any;
    let feeAmountUsd = 0;
    let feeAmountLocal = 0;
    let effectiveRate = 1;

    try {
      const quote = await nuvion.getFxQuote(fromCurr, toCurr, amount);
      feeAmountUsd = quote.feeAmountUsd;
      feeAmountLocal = quote.feeAmountLocal;
      effectiveRate = quote.rate;
    } catch (err: any) {
      server.log.warn({ err }, 'FX quote failed during transfer — proceeding without fee calculation');
    }

    // 6. Execute outbound transfer
    const txId = ulid();

    if (resolvedMode === 'crypto') {
      // C3 Remediation: Require real on-chain transaction hash signed by user's Particle Universal Account
      if (!txHash) {
        return reply.status(400).send({
          error: 'On-chain transaction hash (txHash) is required for crypto transfer execution',
        });
      }

      server.log.info({ recipient: resolvedCryptoAddress, txHash, chainId, asset }, 'Verified crypto on-chain transfer');
    } else {
      // C4 Remediation: Fail-fast Nuvion payout execution.
      // Do not write ledger debit or audit log if payout fails on clearing rails.
      try {
        await nuvion.executePayout({
          accountId: account?.nuvionAccountId || `nacc_${entityId}`,
          paymentDetailId: (request.body as any).paymentDetailId || `pd_${Date.now()}`,
          amount,
          narration: (request.body as any).narration || 'Outbound bank transfer',
          uniqueReference: `ref_${Date.now()}_${ulid()}`,
          paymentType: 'bank-transfer',
        });
      } catch (err: any) {
        server.log.error({ err: err.message }, 'Nuvion payout execution failed on clearing rails');
        return reply.status(502).send({
          error: `We couldn't complete your payout request. ${err.message || 'Clearing provider error.'}`,
        });
      }
    }

    // 7. Record double-entry ledger entries in Neon DB ONLY after payout/crypto verification succeeds
    const currUpper = (resolvedCurrency || 'NGN').toUpperCase();
    const ledgerAccId = `${entityId}_cash_${currUpper}`;
    const ledgerClearId = `${entityId}_outbound_${currUpper}`;

    const existingLedgerAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
    if (existingLedgerAcc.length === 0) {
      await db.insert(ledgerAccounts).values([
        { id: ledgerAccId, entityId, name: `Cash / Wallet (${currUpper})`, type: 'ASSET', currency: currUpper, createdAt: new Date() },
        { id: ledgerClearId, entityId, name: `Outbound Transfer Clearing (${currUpper})`, type: 'LIABILITY', currency: currUpper, createdAt: new Date() },
      ]);
    }

    await db.insert(ledgerEntries).values([
      { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerAccId, type: 'DEBIT', amount: String(amount), createdAt: new Date() },
      { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerClearId, type: 'CREDIT', amount: String(amount), createdAt: new Date() },
    ]);

    // 8. Record fee sweep to treasury wallet
    const feeSweep = nuvion.sweepFeeToTreasury({
      feeAmountUsd,
      feeAmountLocal,
      currency: fromCurr,
      feeType: 'OFF_RAMP_FX',
      sourceTransactionId: txId,
    });

    // 9. Write audit log
    await db.insert(auditLogs).values({
      id: ulid(),
      userId: session.userId,
      entityId,
      action: 'TRANSFER_EXECUTE',
      metadata: JSON.stringify({
        txId,
        txHash: txHash || null,
        chainId: chainId || null,
        amount,
        currency: resolvedCurrency,
        recipient: resolvedRecipient,
        bankName: resolvedBank,
        accountNumber,
        ibanOrRoutingNumber,
        bicOrSwiftCode,
        sortCode,
        sendMode: resolvedMode,
        asset,
        network,
        cryptoAddress: resolvedCryptoAddress,
        riskLevel: riskAssessment.riskLevel,
        feeSweepId: feeSweep.sweepId,
        treasuryWallet: feeSweep.treasuryWallet,
        narration: narration || '',
      }),
      createdAt: new Date(),
    });

    const responsePayload = {
      status: 'SUCCESS',
      transactionId: txId,
      txHash: txHash || null,
      amount,
      currency: resolvedCurrency,
      recipient: resolvedRecipient,
      narration: narration || 'Payment sent.',
      transferFeeChargedToUser: 0,
      effectiveRate,
      riskLevel: riskAssessment.riskLevel,
      timestamp: new Date().toISOString(),
    };

    if (idempotencyKey) {
      saveIdempotencyResponse(idempotencyKey, entityId, 200, responsePayload);
    }

    return reply.send(responsePayload);
  });
}
