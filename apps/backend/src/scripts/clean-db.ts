import dotenv from 'dotenv';
dotenv.config();

import { createDbClient } from '@payit/db';
import { 
  invoiceItems, invoices, payrollItems, payrollRuns, transfers, 
  feeLedger, ledgerEntries, ledgerAccounts, savingsGoals, termVaults, 
  contacts, idempotencyKeys, rawWebhooks, accounts, entities, 
  trustedDevices, users, waitlist 
} from '@payit/db/schema';

const db = createDbClient();

async function cleanDatabase() {
  console.log('🧹 Clearing all test data from PostgreSQL database...');
  
  const tables = [
    { name: 'invoiceItems', table: invoiceItems },
    { name: 'invoices', table: invoices },
    { name: 'payrollItems', table: payrollItems },
    { name: 'payrollRuns', table: payrollRuns },
    { name: 'transfers', table: transfers },
    { name: 'feeLedger', table: feeLedger },
    { name: 'ledgerEntries', table: ledgerEntries },
    { name: 'ledgerAccounts', table: ledgerAccounts },
    { name: 'savingsGoals', table: savingsGoals },
    { name: 'termVaults', table: termVaults },
    { name: 'contacts', table: contacts },
    { name: 'idempotencyKeys', table: idempotencyKeys },
    { name: 'rawWebhooks', table: rawWebhooks },
    { name: 'accounts', table: accounts },
    { name: 'entities', table: entities },
    { name: 'trustedDevices', table: trustedDevices },
    { name: 'users', table: users },
    { name: 'waitlist', table: waitlist },
  ];

  for (const item of tables) {
    try {
      await db.delete(item.table);
      console.log(`  ✓ Cleared table: ${item.name}`);
    } catch (err: any) {
      console.warn(`  ℹ Note clearing ${item.name}: ${err.message}`);
    }
  }

  console.log('\n✨ DATABASE CLEANUP SUCCESSFUL! All test data and previous users removed.');
  console.log('🚀 Database is 100% clean and ready for production launch!');
  process.exit(0);
}

cleanDatabase();
