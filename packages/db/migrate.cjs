// migrate.cjs — CommonJS migration runner for Neon PostgreSQL
// Run with: node migrate.cjs
'use strict';

const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_FzVIWi01hden@ep-frosty-lab-ay6rqcus.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

const MIGRATION_SQL = `
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
  account_number TEXT NOT NULL,
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

ALTER TABLE entities ADD COLUMN IF NOT EXISTS username_customized INTEGER DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_entity_id TEXT NOT NULL REFERENCES entities(id),
  addressee_entity_id TEXT NOT NULL REFERENCES entities(id),
  status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  requester_entity_id TEXT NOT NULL REFERENCES entities(id),
  payer_entity_id TEXT NOT NULL REFERENCES entities(id),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  narration TEXT,
  status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'PAID', 'DECLINED', 'EXPIRED')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  response_payload TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_webhooks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('NUVION', 'PARTICLE', 'DUE', 'TURNKEY')),
  event_id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'RECEIVED' NOT NULL CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_user_id TEXT;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS turnkey_sub_org_id TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS turnkey_user_id TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS due_customer_id TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS due_status TEXT DEFAULT 'none';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_virtual_account_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS routing_number TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rail TEXT DEFAULT 'ACH';

ALTER TABLE entities ADD COLUMN IF NOT EXISTS evm_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS solana_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS btc_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS tron_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS ton_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS near_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS cosmos_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS sui_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS aptos_deposit_address TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS xrp_deposit_address TEXT;

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  due_transfer_id TEXT UNIQUE,
  source_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  source_amount NUMERIC(18,4) NOT NULL,
  target_amount NUMERIC(18,4) NOT NULL,
  fee_amount NUMERIC(18,4) DEFAULT 0.00 NOT NULL,
  direction TEXT DEFAULT 'CREDIT' NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  payment_instructions TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE transfers ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'CREDIT' NOT NULL;


CREATE TABLE IF NOT EXISTS fee_ledger (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  transaction_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  gross_amount NUMERIC(18,4) NOT NULL,
  fee_amount NUMERIC(18,4) NOT NULL,
  net_amount NUMERIC(18,4) NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  target_entity_id TEXT REFERENCES entities(id),
  name TEXT NOT NULL,
  paytag TEXT,
  account_number TEXT,
  bank_code TEXT,
  bank_name TEXT,
  phone_or_momo TEXT,
  type TEXT NOT NULL CHECK (type IN ('INTERNAL', 'EXTERNAL')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  target_amount NUMERIC(18,2) NOT NULL,
  current_amount NUMERIC(18,2) DEFAULT 0.00 NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  strategy_id TEXT,
  lock_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS term_vaults (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  vault_name TEXT NOT NULL,
  protocol TEXT DEFAULT 'kamino' NOT NULL,
  lock_duration_days INTEGER NOT NULL,
  start_date TIMESTAMP DEFAULT NOW() NOT NULL,
  unlock_date TIMESTAMP NOT NULL,
  principal_amount_usd NUMERIC(18,2) NOT NULL,
  gross_apy NUMERIC(5,2) NOT NULL,
  proxim_cut_apy NUMERIC(5,2) NOT NULL,
  user_net_apy NUMERIC(5,2) NOT NULL,
  accrued_interest_usd NUMERIC(18,2) DEFAULT 0.00 NOT NULL,
  early_exit_choice TEXT,
  near_intent_id TEXT,
  deposit_address TEXT,
  source_tx_hash TEXT,
  solana_tx_hash TEXT,
  solana_recipient_address TEXT,
  shares_minted NUMERIC(28,8),
  status TEXT DEFAULT 'LOCKED' NOT NULL,
  on_chain_sync_timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS near_intent_id TEXT;
ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS deposit_address TEXT;
ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS source_tx_hash TEXT;
ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS solana_tx_hash TEXT;
ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS solana_recipient_address TEXT;
ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS shares_minted NUMERIC(28,8);

CREATE TABLE IF NOT EXISTS rwa_positions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  shares NUMERIC(18,6) NOT NULL,
  average_cost_basis_usd NUMERIC(18,4) NOT NULL,
  current_price_usd NUMERIC(18,4) NOT NULL,
  total_value_usd NUMERIC(18,2) NOT NULL,
  network TEXT DEFAULT 'BSC' NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS rwa_orders (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  usd_amount NUMERIC(18,2) NOT NULL,
  shares NUMERIC(18,6) NOT NULL,
  status TEXT DEFAULT 'PENDING' NOT NULL,
  biconomy_quote_id TEXT,
  biconomy_tx_hash TEXT,
  action_id TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS intent_swaps (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  origin_asset TEXT NOT NULL,
  destination_asset TEXT NOT NULL,
  origin_amount NUMERIC(28,8) NOT NULL,
  destination_amount NUMERIC(28,8),
  deposit_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  source_tx_hash TEXT,
  destination_tx_hash TEXT,
  status TEXT DEFAULT 'PENDING_DEPOSIT' NOT NULL,
  protocol TEXT DEFAULT 'cross_chain_swap' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(18,2) DEFAULT 0.00 NOT NULL;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USDC' NOT NULL;
`;

async function migrate() {
  const sql = postgres(DATABASE_URL, {
    ssl: { rejectUnauthorized: false },
    max: 1,
    idle_timeout: 30,
    max_lifetime: 120,
    connect_timeout: 30,
    prepare: false,
    keep_alive: 15,
    onnotice: () => {},
  });

  try {
    console.log('🔄 Connecting to Neon PostgreSQL...');
    console.log('🏗️  Creating all PayIT tables (CREATE TABLE IF NOT EXISTS — safe to re-run)...');
    
    // Split statements and execute individually
    const statements = MIGRATION_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      let attempts = 0;
      while (attempts < 3) {
        try {
          await sql.unsafe(stmt);
          break;
        } catch (e) {
          attempts++;
          if (attempts >= 3) throw e;
          console.warn(`[Migrate] Retrying statement (attempt ${attempts}):`, e.message);
          await new Promise(res => setTimeout(res, 500));
        }
      }
    }

    // Verify tables exist
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log('✅ Tables in Neon PostgreSQL:');
    result.forEach(r => console.log('  •', r.table_name));
    console.log('\n🚀 PayIT database migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
