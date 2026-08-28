import { createDbClient, eq, and, sql } from '@payit/db';
import { transfers, ledgerAccounts, ledgerEntries, feeLedger } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

export interface ReversalResult {
  success: boolean;
  reversalId: string;
  transferId: string;
  originalAmount: number;
  reversedFee: number;
  currency: string;
  reason: string;
  reversalTimestamp: string;
}

export class ReversalEngine {
  /**
   * Atomically process a transfer reversal or bank recall with compensating double-entry and tax credit note
   */
  public static async processReversal(
    transferId: string,
    reason: string = 'Bank recall or chargeback'
  ): Promise<ReversalResult> {
    const reversalId = `rev_${ulid()}`;
    const timestamp = new Date().toISOString();

    // 1. Locate original transfer record
    const txRows = await db.select().from(transfers).where(eq(transfers.id, transferId)).limit(1);
    if (txRows.length === 0) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    const tx = txRows[0];
    if (tx.status === 'reversed') {
      throw new Error(`Transfer ${transferId} is already reversed`);
    }

    const entityId = tx.entityId;
    const currency = (tx.sourceCurrency || 'NGN').toUpperCase();
    const sourceAmount = parseFloat(tx.sourceAmount || '0');
    const feeAmount = parseFloat(tx.feeAmount || '0');

    // 2. Insert Compensating Double-Entry Ledger Entries
    const ledgerAccId = `${entityId}_cash_${currency}`;
    const ledgerOutId = `${entityId}_outbound_${currency}`;

    try {
      await db.insert(ledgerEntries).values([
        {
          id: ulid(),
          entityId,
          transactionId: reversalId,
          ledgerAccountId: ledgerAccId,
          type: 'CREDIT', // Reversing debit back to cash account
          amount: String(sourceAmount.toFixed(4)),
        },
        {
          id: ulid(),
          entityId,
          transactionId: reversalId,
          ledgerAccountId: ledgerOutId,
          type: 'DEBIT', // Reversing credit from clearing account
          amount: String(sourceAmount.toFixed(4)),
        },
      ]);

      // 3. Insert Atomic Tax Credit Note / Fee Reversal in feeLedger
      await db.insert(feeLedger).values({
        id: ulid(),
        entityId,
        transactionType: 'OFF_RAMP',
        referenceId: reversalId,
        grossAmount: String((-sourceAmount).toFixed(4)),
        feeAmount: String((-feeAmount).toFixed(4)),
        netAmount: String((-(sourceAmount - feeAmount)).toFixed(4)),
        currency,
        description: `[REVERSAL] ${reason} (Original Ref: ${transferId})`,
      });

      // 4. Update original transfer status to reversed
      await db.update(transfers).set({ status: 'reversed' }).where(eq(transfers.id, transferId));

      return {
        success: true,
        reversalId,
        transferId,
        originalAmount: sourceAmount,
        reversedFee: feeAmount,
        currency,
        reason,
        reversalTimestamp: timestamp,
      };
    } catch (err: any) {
      console.error('[ReversalEngine Error]:', err.message);
      throw err;
    }
  }
}
