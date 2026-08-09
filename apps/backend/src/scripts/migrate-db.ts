import 'dotenv/config';
import { createDbClient } from '@payit/db';
import { sql } from 'drizzle-orm';

const db = createDbClient();

async function migrate() {
  console.log('Running database DDL migrations...');

  try {
    await db.execute(sql`
      ALTER TABLE entities 
      ADD COLUMN IF NOT EXISTS account_backfilled INTEGER DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS account_backfilled_at TIMESTAMP;
    `);
    console.log('✓ Added account_backfilled and account_backfilled_at columns to entities table');
  } catch (err: any) {
    console.error('Migration error on entities table:', err.message);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS archived_accounts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        nuvion_account_id TEXT NOT NULL,
        account_number TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        account_holder_name TEXT,
        currency TEXT NOT NULL,
        archived_reason TEXT DEFAULT 'MISASSIGNED_MERCHANT_ACCOUNT_BACKFILL' NOT NULL,
        archived_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✓ Created archived_accounts table');
  } catch (err: any) {
    console.error('Migration error on archived_accounts table:', err.message);
  }

  console.log('✅ Database migration completed successfully!');
}

migrate().catch(console.error).finally(() => process.exit(0));
