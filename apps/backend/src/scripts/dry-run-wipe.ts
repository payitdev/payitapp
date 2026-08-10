import 'dotenv/config';
import { createDbClient, sql } from '@payit/db';

const db = createDbClient();

interface TableSummary {
  tableName: string;
  rowCount: number;
  foreignKeyDependents: string;
  deletionOrderIndex: number;
  userDataType: string;
}

const TABLE_METADATA: Record<string, { fkDependents: string; order: number; dataType: string }> = {
  // Level 3 (Deepest FK dependents - must delete first)
  'payroll_items': { fkDependents: 'Belongs to payroll_runs', order: 1, dataType: 'Payroll recipient line items' },
  'invoice_items': { fkDependents: 'Belongs to invoices', order: 2, dataType: 'Invoice line items' },
  'ledger_entries': { fkDependents: 'Belongs to ledger_accounts', order: 3, dataType: 'Double-entry debit/credit ledger lines' },
  'savings_contributions': { fkDependents: 'Belongs to savings_goals', order: 4, dataType: 'Savings goal contributions' },

  // Level 2 (Entity / Account dependents)
  'cards': { fkDependents: 'Belongs to entities, accounts', order: 5, dataType: 'Virtual card issuance records' },
  'invoices': { fkDependents: 'Belongs to entities', order: 6, dataType: 'Customer invoice records' },
  'payroll_runs': { fkDependents: 'Belongs to entities', order: 7, dataType: 'Payroll batch run records' },
  'ledger_accounts': { fkDependents: 'Belongs to entities', order: 8, dataType: 'Ledger account definitions' },
  'archived_accounts': { fkDependents: 'Belongs to entities', order: 9, dataType: 'Archived/historical account records' },
  'accounts': { fkDependents: 'Belongs to entities', order: 10, dataType: 'Virtual bank accounts (NGN/USD/etc)' },
  'wallets': { fkDependents: 'Belongs to entities', order: 11, dataType: 'Particle wallet address records' },
  'payment_requests': { fkDependents: 'Belongs to entities (requester/payer)', order: 12, dataType: 'P2P payment request records' },
  'friendships': { fkDependents: 'Belongs to entities (requester/addressee)', order: 13, dataType: 'Social network graph records' },
  'idempotency_keys': { fkDependents: 'Belongs to entities', order: 14, dataType: 'API idempotency key store' },
  'savings_goals': { fkDependents: 'Belongs to entities', order: 15, dataType: 'User savings goal targets' },
  'contacts': { fkDependents: 'Belongs to entities', order: 16, dataType: 'Saved beneficiaries & paytags' },
  'reconciliation_logs': { fkDependents: 'Tied to users/entities', order: 17, dataType: 'Reconciliation audit logs' },

  // Level 1 (User dependents)
  'trusted_devices': { fkDependents: 'Belongs to users', order: 18, dataType: 'User trusted hardware devices & passcodes' },
  'entities': { fkDependents: 'Belongs to users; Parent of accounts, wallets, ledger', order: 19, dataType: 'Personal & business entity profiles, Nuvion IDs, UA addresses' },

  // Level 0 (Standalone & Root)
  'audit_logs': { fkDependents: 'Tied to users & entities', order: 20, dataType: 'Insert-only security audit trail' },
  'risk_events': { fkDependents: 'Tied to users & entities', order: 21, dataType: 'Security risk scoring logs' },
  'raw_webhooks': { fkDependents: 'Standalone provider logs', order: 22, dataType: 'Raw inbound webhooks log' },
  'users': { fkDependents: 'Root Table; Parent of entities & trusted_devices', order: 23, dataType: 'User identity records, emails, names' },
};

async function dryRun() {
  console.log('===========================================================');
  console.log(' STEP 2: DRY RUN — PRE-RESET TABLE INVENTORY & ROW COUNTS  ');
  console.log('===========================================================\n');

  const summaries: TableSummary[] = [];
  let totalRowsToDelete = 0;

  for (const [table, meta] of Object.entries(TABLE_METADATA)) {
    try {
      const res: any[] = await db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM "${table}"`));
      const count = res[0]?.count || 0;
      summaries.push({
        tableName: table,
        rowCount: count,
        foreignKeyDependents: meta.fkDependents,
        deletionOrderIndex: meta.order,
        userDataType: meta.dataType,
      });
      totalRowsToDelete += count;
    } catch (err: any) {
      summaries.push({
        tableName: table,
        rowCount: 0,
        foreignKeyDependents: meta.fkDependents + ' (Table does not exist yet)',
        deletionOrderIndex: meta.order,
        userDataType: meta.dataType,
      });
    }
  }

  // Sort by deletion order
  summaries.sort((a, b) => a.deletionOrderIndex - b.deletionOrderIndex);

  console.log('TABLE NAME                  | ROW COUNT | DELETION ORDER | FK DEPENDENCIES & SCOPE');
  console.log('---------------------------------------------------------------------------------------------------');
  for (const s of summaries) {
    const tableStr = s.tableName.padEnd(27, ' ');
    const countStr = String(s.rowCount).padStart(9, ' ');
    const orderStr = String(s.deletionOrderIndex).padStart(14, ' ');
    console.log(`${tableStr} | ${countStr} | ${orderStr} | ${s.foreignKeyDependents}`);
  }
  console.log('---------------------------------------------------------------------------------------------------');
  console.log(`TOTAL ROWS IDENTIFIED FOR RESET: ${totalRowsToDelete}\n`);

  console.log('===========================================================');
  console.log('⚠️ DRY RUN SUMMARY: NO DATA HAS BEEN DELETED OR MODIFIED.');
  console.log('   Waiting for explicit user approval before executing Step 3.');
  console.log('===========================================================\n');
}

dryRun().catch((err) => {
  console.error('❌ ERROR IN DRY RUN:', err);
  process.exit(1);
}).finally(() => process.exit(0));
