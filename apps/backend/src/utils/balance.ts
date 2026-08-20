/**
 * Shared Ledger Balance Summation Utility (M5)
 * Computes exact available balance (sum CREDIT - sum DEBIT) for an entity's cash ledger account.
 */

import { eq } from '@payit/db';
import { ledgerEntries, ledgerAccounts } from '@payit/db/schema';

export async function getEntityBalance(
  db: any,
  entityId: string,
  currency: string = 'NGN',
  accountType: 'cash' | 'savings' = 'cash'
): Promise<number> {
  const curr = (currency || 'NGN').toUpperCase();
  const accountId = `${entityId}_${accountType}_${curr}`;
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

  // Look up account type to apply proper double-entry accounting rules
  const accRows = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.id, accountId)).limit(1);
  const isAsset = accRows.length === 0 || accRows[0].type === 'ASSET';

  // For ASSET accounts: Normal balance is DEBIT (Deposits increase on DEBIT, spending decreases on CREDIT)
  // For LIABILITY/EQUITY: Normal balance is CREDIT (Funding increases on CREDIT, payout on DEBIT)
  const balance = isAsset ? (totalDebit - totalCredit) : (totalCredit - totalDebit);
  return Math.max(0, Math.round(balance * 100) / 100);
}

export async function getAllEntityBalances(db: any, entityId: string): Promise<Array<{ currency: string; balance: number; accountType: string }>> {
  const accounts = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.entityId, entityId));
  const results: Array<{ currency: string; balance: number; accountType: string }> = [];

  for (const acc of accounts) {
    const parts = acc.id.split('_');
    const accountType = parts[1] || 'cash';
    const currency = acc.currency.toUpperCase();
    const balance = await getEntityBalance(db, entityId, currency, accountType as any);
    results.push({ currency, balance, accountType });
  }

  return results;
}
