/**
 * Shared Ledger Balance Summation Utility (M5)
 * Computes exact available balance (sum CREDIT - sum DEBIT) for an entity's cash ledger account.
 */

import { eq } from '@payit/db';
import { ledgerEntries } from '@payit/db/schema';

export async function getEntityBalance(db: any, entityId: string): Promise<number> {
  const accountId = `${entityId}_cash`;
  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.ledgerAccountId, accountId));

  let totalCredit = 0;
  let totalDebit = 0;

  for (const entry of entries) {
    const amt = parseFloat(entry.amount || '0');
    if (entry.type === 'CREDIT') {
      totalCredit += amt;
    } else if (entry.type === 'DEBIT') {
      totalDebit += amt;
    }
  }

  const balance = totalCredit - totalDebit;
  return Math.max(0, Math.round(balance * 100) / 100);
}
