import 'dotenv/config';
import { createDbClient, sql } from '@payit/db';

const db = createDbClient();

const DELETION_ORDER = [
  // Level 3 (Deepest FK dependents - must delete first)
  'payroll_items',
  'invoice_items',
  'ledger_entries',
  'savings_contributions',

  // Level 2 (Entity / Account dependents)
  'cards',
  'invoices',
  'payroll_runs',
  'ledger_accounts',
  'archived_accounts',
  'accounts',
  'wallets',
  'payment_requests',
  'friendships',
  'idempotency_keys',
  'savings_goals',
  'contacts',
  'reconciliation_logs',

  // Level 1 (User dependents)
  'trusted_devices',
  'entities',

  // Level 0 (Standalone & Root)
  'audit_logs',
  'risk_events',
  'raw_webhooks',
  'users',
];

async function executeWipe() {
  console.log('===========================================================');
  console.log(' STEP 3: EXECUTING FULL DESTRUCTIVE RESET OF USER DATA    ');
  console.log('===========================================================\n');

  const deletionResults: Record<string, number> = {};

  for (const table of DELETION_ORDER) {
    try {
      // Row-level DELETE preserving table structure, schema, and indexes
      const res: any = await db.execute(sql.raw(`DELETE FROM "${table}"`));
      const deletedCount = res.rowCount ?? res.length ?? 0;
      deletionResults[table] = deletedCount;
      console.log(`  ✓ Cleared ${deletedCount} rows from table '${table}'`);
    } catch (err: any) {
      if (err.message?.includes('does not exist') || err.cause?.code === '42P01') {
        console.log(`  ℹ Table '${table}' does not exist in DB, skipped.`);
        deletionResults[table] = 0;
      } else {
        console.error(`❌ CRITICAL FAILURE on table '${table}':`, err.message);
        throw err; // Stop immediately on any real error
      }
    }
  }

  console.log('\n===========================================================');
  console.log(' STEP 5: VERIFYING POST-WIPE ZERO-ROW COUNTS             ');
  console.log('===========================================================\n');

  const postWipeCounts: Record<string, number> = {};
  let totalRemainingRows = 0;

  console.log('TABLE NAME                  | PRE-WIPE  | POST-WIPE | STATUS');
  console.log('----------------------------------------------------------------------');

  for (const table of DELETION_ORDER) {
    try {
      const res: any[] = await db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM "${table}"`));
      const count = res[0]?.count || 0;
      postWipeCounts[table] = count;
      totalRemainingRows += count;

      const preCountStr = String(deletionResults[table] || 0).padStart(9, ' ');
      const postCountStr = String(count).padStart(9, ' ');
      const statusStr = count === 0 ? '✅ 0 ROWS (CLEARED)' : '❌ REMAINING ROWS!';
      console.log(`${table.padEnd(27, ' ')} | ${preCountStr} | ${postCountStr} | ${statusStr}`);
    } catch (err: any) {
      console.log(`${table.padEnd(27, ' ')} | ${'0'.padStart(9, ' ')} | ${'0'.padStart(9, ' ')} | N/A (Non-existent)`);
    }
  }

  console.log('----------------------------------------------------------------------');
  console.log(`TOTAL REMAINING ROWS ACROSS ALL TABLES: ${totalRemainingRows}\n`);

  if (totalRemainingRows === 0) {
    console.log('===========================================================');
    console.log('🎉 SUCCESS: DATABASE HAS BEEN FULLY RESET TO 0 ROWS!');
    console.log('   All user identity, Nuvion, Particle, and ledger records cleared.');
    console.log('===========================================================\n');
  } else {
    console.error('❌ WARNING: SOME ROWS REMAIN IN DATABASE!');
    process.exit(1);
  }
}

executeWipe().catch((err) => {
  console.error('❌ CRITICAL ERROR IN STEP 3 EXECUTION:', err);
  process.exit(1);
}).finally(() => process.exit(0));
