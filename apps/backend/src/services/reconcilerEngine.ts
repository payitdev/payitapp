import { createDbClient, sql } from '@payit/db';
import { ledgerEntries } from '@payit/db/schema';

const db = createDbClient();

export interface ReconciliationReport {
  timestamp: string;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  discrepancy: number;
  unbalancedTransactions: string[];
}

export class ReconcilerEngine {
  /**
   * Run automated audit check of double-entry ledger equality:
   * Sum(DEBIT) must equal Sum(CREDIT) globally and per transaction_id.
   */
  public static async runAuditReconciliation(): Promise<ReconciliationReport> {
    const timestamp = new Date().toISOString();

    // 1. Calculate global ledger sums
    const totals = await db
      .select({
        totalDebits: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEBIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'CREDIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
      })
      .from(ledgerEntries);

    const totalDebits = parseFloat(totals[0]?.totalDebits || '0');
    const totalCredits = parseFloat(totals[0]?.totalCredits || '0');
    const discrepancy = Math.abs(totalDebits - totalCredits);
    const isBalanced = discrepancy < 0.001;

    // 2. Check per-transaction double-entry balance
    const perTxBalances = await db
      .select({
        transactionId: ledgerEntries.transactionId,
        debitSum: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'DEBIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
        creditSum: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerEntries.type} = 'CREDIT' THEN ${ledgerEntries.amount} ELSE 0 END), 0)`,
      })
      .from(ledgerEntries)
      .groupBy(ledgerEntries.transactionId);

    const unbalancedTransactions: string[] = [];
    for (const row of perTxBalances) {
      const d = parseFloat(row.debitSum);
      const c = parseFloat(row.creditSum);
      if (Math.abs(d - c) >= 0.001) {
        unbalancedTransactions.push(row.transactionId);
      }
    }

    const report: ReconciliationReport = {
      timestamp,
      totalDebits,
      totalCredits,
      isBalanced,
      discrepancy,
      unbalancedTransactions,
    };

    if (!isBalanced) {
      console.warn('⚠️ [ReconcilerEngine Audit Warning]: Double-entry discrepancy detected!', report);
    }

    return report;
  }
}
