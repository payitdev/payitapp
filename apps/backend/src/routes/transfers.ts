import { FastifyInstance } from 'fastify';
import { validateEntityAccess } from '@payit/ledger';
import { DeterministicRiskEngine } from '@payit/security';
import { GroqIntentParser } from '@payit/ai';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { accounts, entities, auditLogs, riskEvents, ledgerEntries, ledgerAccounts } from '@payit/db/schema';
import { ulid } from 'ulid';
import bcrypt from 'bcryptjs';
import { trustedDevices } from '@payit/db/schema';

const riskEngine = new DeterministicRiskEngine();
const groq = new GroqIntentParser();
const nuvion = new NuvionClient();
const db = createDbClient();

export async function transferRoutes(server: FastifyInstance) {

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
        .limit(20);

      const transactions = logs.map(l => ({
        id: l.id,
        type: l.action.includes('INBOUND') ? 'INBOUND' : 'OUTBOUND',
        title: l.action,
        subtitle: 'Payment Activity',
        amount: 0,
        currency: 'NGN',
        symbol: '₦',
        date: new Date(l.createdAt).toLocaleDateString(),
        time: new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: 'fiat',
        senderAccount: 'Nuvion MFB',
        recipientAccount: 'Destination Account',
        reference: l.id,
      }));

      return reply.send({ transactions });
    } catch {
      return reply.send({ transactions: [] });
    }
  });

  /**
   * Dynamic live FX quote with PayIT margin applied.
   * Shows end-amount only — margin is never exposed in the response.
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

      // Return end-amount to client — do NOT expose nuvionBaseExchangeRate or margin
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
   * Execute Transfer — production implementation.
   * Flow:
   * 1. Entity guard (prevents cross-entity access)
   * 2. Load entity + account from DB
   * 3. Deterministic risk evaluation
   * 4. Step-up auth verification via bcrypt against DB hash
   * 5. Get live FX quote for fee calculation
   * 6. Execute payout via Nuvion
   * 7. Record double-entry ledger posting to DB
   * 8. Sweep fee record to treasury
   * 9. Write audit log to DB
   */
  server.post('/api/transfers/execute', async (request, reply) => {
    const {
      session,
      entityId,
      recipientTagOrAccount,
      amount,
      currency,
      narration,
      stepUpPin,
      deviceId,
      sendMode,
      sendCurrency,
      recipientBankName,
      recipientChain,
      recipientCryptoAddress,
    } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      recipientTagOrAccount: string;
      amount: number;
      currency: string;
      narration?: string;
      stepUpPin?: string;
      deviceId?: string;
      sendMode?: 'fiat' | 'crypto';
      sendCurrency?: string;
      recipientBankName?: string;
      recipientChain?: string;
      recipientCryptoAddress?: string;
    };

    // 1. Entity guard
    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Amount must be greater than zero' });
    }

    // 2. Load entity and account from Neon DB
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    const entityAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId)).limit(1);
    if (entityAccounts.length === 0) {
      return reply.status(400).send({ error: 'No account found for this entity. Complete KYC first.' });
    }
    const account = entityAccounts[0];

    // 3. Deterministic risk evaluation
    const riskAssessment = riskEngine.evaluate({
      userId: session.userId,
      entityId,
      amount,
      recipientTagOrAccount: recipientTagOrAccount || recipientCryptoAddress || '',
      deviceId: deviceId || 'unknown_device',
      userKnownRecipients: [],  // Production: load from DB contacts table
      userHistory: [],          // Production: load from DB transfer history
    });

    // Write risk event to DB
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
      if (!stepUpPin || !deviceId) {
        return reply.status(401).send({
          status: 'STEP_UP_AUTH_REQUIRED',
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

      const pinValid = await bcrypt.compare(stepUpPin, deviceRows[0].passcodeHash);
      if (!pinValid) {
        return reply.status(401).send({ error: 'Incorrect passcode. Transaction blocked.' });
      }
    }

    // 5. Get live FX quote to determine fee
    const fromCurr = (sendCurrency || currency || 'NGN') as any;
    const toCurr = 'USD' as any;
    let feeAmountUsd = 0;
    let feeAmountLocal = 0;
    let effectiveRate = 1;

    try {
      const quote = await nuvion.getLiveDynamicQuote({
        fromCurrency: fromCurr,
        toCurrency: toCurr,
        amount,
        isDeposit: false,
      });
      feeAmountUsd = quote.feeAmountUsd;
      feeAmountLocal = quote.feeAmountLocal;
      effectiveRate = quote.clientEffectiveRate;
    } catch (err: any) {
      server.log.warn({ err }, 'FX quote failed during transfer — proceeding without fee calculation');
    }

    // 6. Execute outbound payout via Nuvion
    const txId = ulid();
    try {
      await nuvion.executePayout({
        nuvionAccountId: account.nuvionAccountId,
        destinationAccount: recipientTagOrAccount || recipientCryptoAddress || '',
        amount,
        currency: currency || 'NGN',
      });
    } catch (err: any) {
      server.log.error({ err }, 'Nuvion payout execution failed');
      return reply.status(502).send({ error: `Transfer failed: ${err.message}` });
    }

    // 7. Record double-entry ledger entries in Neon DB
    // Load or create ledger accounts for this entity
    const ledgerAccId = `${entityId}_cash`;
    const ledgerClearId = `${entityId}_outbound`;

    const existingLedgerAcc = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, ledgerAccId)).limit(1);
    if (existingLedgerAcc.length === 0) {
      await db.insert(ledgerAccounts).values([
        { id: ledgerAccId, entityId, name: 'Cash / Wallet', type: 'ASSET', currency: currency || 'NGN', createdAt: new Date() },
        { id: ledgerClearId, entityId, name: 'Outbound Transfer Clearing', type: 'LIABILITY', currency: currency || 'NGN', createdAt: new Date() },
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
        amount,
        currency,
        recipient: recipientTagOrAccount || recipientCryptoAddress,
        sendMode,
        chain: recipientChain,
        riskLevel: riskAssessment.riskLevel,
        feeSweepId: feeSweep.sweepId,
        treasuryWallet: feeSweep.treasuryWallet,
      }),
      createdAt: new Date(),
    });

    return reply.send({
      status: 'SUCCESS',
      transactionId: txId,
      amount,
      currency: currency || 'NGN',
      recipient: recipientTagOrAccount || recipientCryptoAddress,
      narration: narration || 'PayIT Transfer',
      transferFeeChargedToUser: 0, // 0 Transfer Fee Guarantee — fee absorbed from FX margin
      effectiveRate,
      feeSweep: {
        sweepId: feeSweep.sweepId,
        treasuryWallet: feeSweep.treasuryWallet,
        timestamp: feeSweep.timestamp,
      },
      riskLevel: riskAssessment.riskLevel,
      timestamp: new Date().toISOString(),
    });
  });
}
