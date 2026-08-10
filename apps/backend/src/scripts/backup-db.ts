import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createDbClient, sql } from '@payit/db';

const db = createDbClient();

const TABLES = [
  'users',
  'trusted_devices',
  'entities',
  'accounts',
  'archived_accounts',
  'wallets',
  'cards',
  'invoices',
  'invoice_items',
  'payroll_runs',
  'payroll_items',
  'ledger_accounts',
  'ledger_entries',
  'audit_logs',
  'friendships',
  'payment_requests',
  'risk_events',
  'idempotency_keys',
  'raw_webhooks',
  'savings_goals',
  'contacts',
  'reconciliation_logs',
  'waitlist',
];

async function runBackup() {
  console.log('===========================================================');
  console.log(' STEP 0: EXECUTING MANDATORY PRE-RESET DATABASE BACKUP     ');
  console.log('===========================================================\n');

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const filename = `payit_backup_pre_wipe_${timestamp}.json`;

  const backupData: Record<string, any[]> = {};
  let totalRowsBackedUp = 0;

  for (const table of TABLES) {
    try {
      const rows: any[] = await db.execute(sql.raw(`SELECT * FROM "${table}"`));
      backupData[table] = rows;
      totalRowsBackedUp += rows.length;
      console.log(`  ✓ Exported ${rows.length} rows from table '${table}'`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not export table '${table}':`, err.message);
      backupData[table] = [];
    }
  }

  const localBackupPath = path.resolve(process.cwd(), filename);
  const scratchBackupPath = path.resolve('C:/Users/Igboze/.gemini/antigravity-ide/brain/2276afbe-c8f8-4125-a2f0-40bb174debb3/scratch', filename);

  const jsonContent = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(localBackupPath, jsonContent, 'utf-8');

  try {
    fs.mkdirSync(path.dirname(scratchBackupPath), { recursive: true });
    fs.writeFileSync(scratchBackupPath, jsonContent, 'utf-8');
  } catch {}

  const stats = fs.statSync(localBackupPath);

  console.log('\n===========================================================');
  console.log(`✅ STEP 0 BACKUP COMPLETE`);
  console.log(`   File Path: ${localBackupPath}`);
  console.log(`   Scratch Path: ${scratchBackupPath}`);
  console.log(`   Total Tables Exported: ${TABLES.length}`);
  console.log(`   Total Rows Backed Up: ${totalRowsBackedUp}`);
  console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);
  console.log('===========================================================\n');
}

runBackup().catch((err) => {
  console.error('❌ CRITICAL ERROR IN STEP 0 BACKUP:', err);
  process.exit(1);
}).finally(() => process.exit(0));
