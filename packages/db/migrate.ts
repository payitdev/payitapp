/**
 * PayIT Database Migration Runner
 * Pushes the Drizzle schema directly to Neon PostgreSQL using drizzle-kit push.
 * Run with: node --loader ts-node/esm migrate.ts
 */
import { createDbClient } from './src/client.js';
import { sql } from 'drizzle-orm';

async function runMigrations() {
  console.log('🔄 Connecting to Neon PostgreSQL...');
  const db = createDbClient();

  console.log('🏗️  Acquiring PostgreSQL advisory lock (123456)...');
  await db.execute(sql`SELECT pg_advisory_lock(123456)`);

  try {
    console.log('🏗️  Running PayIT schema migrations...');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        full_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trusted_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        device_id TEXT NOT NULL,
        passcode_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK (kind IN ('PERSONAL', 'BUSINESS')),
        legal_name TEXT NOT NULL,
        username TEXT UNIQUE,
        business_tag TEXT UNIQUE,
        nuvion_tier INTEGER DEFAULT 1 NOT NULL,
        nuvion_status TEXT DEFAULT 'incomplete' NOT NULL CHECK (nuvion_status IN ('incomplete', 'pending', 'approved', 'rejected')),
        nuvion_entity_id TEXT,
        xpub TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_entities_user_kind UNIQUE (user_id, kind)
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        nuvion_account_id TEXT NOT NULL,
        account_number TEXT NOT NULL UNIQUE,
        bank_name TEXT NOT NULL,
        account_holder_name TEXT NOT NULL,
        currency TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        particle_wallet_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        nuvion_card_id TEXT NOT NULL,
        last4 TEXT NOT NULL,
        brand TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        tag TEXT NOT NULL UNIQUE,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        total_amount NUMERIC(18,2) NOT NULL,
        currency TEXT NOT NULL,
        due_date TEXT NOT NULL,
        hd_index INTEGER NOT NULL,
        hd_receiving_address TEXT NOT NULL,
        settlement_type TEXT NOT NULL CHECK (settlement_type IN ('fiat', 'stablecoin')),
        status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(18,2) NOT NULL,
        amount NUMERIC(18,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payroll_runs (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        title TEXT NOT NULL,
        total_amount NUMERIC(18,2) NOT NULL,
        status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'reviewing', 'processing', 'completed', 'failed')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payroll_items (
        id TEXT PRIMARY KEY,
        payroll_run_id TEXT NOT NULL REFERENCES payroll_runs(id),
        recipient_name TEXT NOT NULL,
        recipient_account_or_tag TEXT NOT NULL,
        amount NUMERIC(18,2) NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS ledger_accounts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
        currency TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        transaction_id TEXT NOT NULL,
        ledger_account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
        type TEXT NOT NULL CHECK (type IN ('DEBIT', 'CREDIT')),
        amount NUMERIC(18,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kyc_verifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        entity_id TEXT NOT NULL REFERENCES entities(id),
        entity_kind TEXT NOT NULL CHECK (entity_kind IN ('PERSONAL', 'BUSINESS')),
        id_type TEXT NOT NULL,
        id_value_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        identity_verification_id TEXT,
        identity_data JSONB,
        liveness_session_id TEXT,
        liveness_status TEXT,
        liveness_score NUMERIC(8,6),
        face_match_score NUMERIC(8,6),
        aml_status TEXT,
        aml_risk_level TEXT,
        aml_flagged INTEGER,
        brails_customer_id TEXT,
        brails_customer_payload JSONB,
        brails_account_payloads JSONB,
        brails_account_ids JSONB,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS risk_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        score NUMERIC(6,2) NOT NULL,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
        rules_triggered TEXT NOT NULL,
        decision_reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        name TEXT NOT NULL,
        paytag TEXT,
        account_number TEXT,
        bank_code TEXT,
        bank_name TEXT,
        type TEXT NOT NULL CHECK (type IN ('INTERNAL', 'EXTERNAL')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reconciliation_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        entity_id TEXT,
        ledger_balance NUMERIC(18,2),
        on_chain_balance NUMERIC(18,2),
        discrepancy NUMERIC(18,2),
        status TEXT NOT NULL CHECK (status IN ('MATCHED', 'DISCREPANCY_DETECTED')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log('✅ All PayIT tables created/verified in Neon PostgreSQL.');
  } finally {
    console.log('🔓 Releasing PostgreSQL advisory lock (123456)...');
    await db.execute(sql`SELECT pg_advisory_unlock(123456)`);
  }

  process.exit(0);
}

runMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
