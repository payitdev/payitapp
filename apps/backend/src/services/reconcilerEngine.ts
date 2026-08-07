import { createDbClient, sql } from '@payit/db';
import { ledgerEntries, auditLogs, reconciliationLogs } from '@payit/db/schema';
import { ulid } from 'ulid';

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
   * Persists discrepancy logs into reconciliationLogs database table (Issue 16).
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
      isBalanced: isBalanced && unbalancedTransactions.length === 0,
      discrepancy,
      unbalancedTransactions,
    };

    // Log reconciliation run to audit logs
    await db.insert(auditLogs).values({
      id: ulid(),
      userId: 'SYSTEM_RECONCILER',
      entityId: 'SYSTEM',
      action: 'RECONCILIATION_RUN',
      metadata: JSON.stringify(report),
      createdAt: new Date(),
    });

    // Persist to reconciliationLogs table in DB (Issue 16)
    await db.insert(reconciliationLogs).values({
      id: ulid(),
      userId: 'SYSTEM_RECONCILER',
      entityId: 'SYSTEM',
      ledgerBalance: String(totalDebits),
      onChainBalance: String(totalCredits),
      discrepancy: String(discrepancy),
      status: report.isBalanced ? 'MATCHED' : 'DISCREPANCY_DETECTED',
      createdAt: new Date(),
    });

    if (!report.isBalanced) {
      console.error(`🚨 ALERT: Financial Reconciliation Mismatch Detected! Discrepancy: $${discrepancy}. Unbalanced TXs:`, unbalancedTransactions);
    } else {
      console.log(`✅ Reconciliation Audit Passed: Sum(Debits)=$${totalDebits} == Sum(Credits)=$${totalCredits}. Zero Drift!`);
    }

    return report;
  }
}
