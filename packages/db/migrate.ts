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

      ALTER TABLE entities ADD COLUMN IF NOT EXISTS registration_number TEXT;

      CREATE TABLE IF NOT EXISTS deposit_sync_cursors (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        network TEXT NOT NULL,
        last_processed_block_height NUMERIC(28,0) DEFAULT '0' NOT NULL,
        last_processed_tx_hash TEXT,
        last_processed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_sync_cursors_entity_network ON deposit_sync_cursors (entity_id, network);
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
      CREATE TABLE IF NOT EXISTS term_vaults (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        vault_name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        lock_duration_days INTEGER NOT NULL,
        start_date TIMESTAMP DEFAULT NOW() NOT NULL,
        unlock_date TIMESTAMP NOT NULL,
        principal_amount_usd NUMERIC(18,2) NOT NULL,
        gross_apy NUMERIC(5,2) NOT NULL,
        proxim_cut_apy NUMERIC(5,2) NOT NULL,
        user_net_apy NUMERIC(5,2) NOT NULL,
        accrued_interest_usd NUMERIC(18,2) DEFAULT 0.00 NOT NULL,
        near_intent_id TEXT,
        deposit_address TEXT,
        source_tx_hash TEXT,
        solana_tx_hash TEXT,
        withdrawal_tx_hash TEXT,
        solana_recipient_address TEXT,
        shares_minted NUMERIC(28,8),
        harvest_tx_hash TEXT,
        harvest_intent_id TEXT,
        harvest_fee_amount NUMERIC(18,6),
        harvest_status TEXT DEFAULT 'NOT_STARTED' NOT NULL,
        status TEXT DEFAULT 'LOCKED' NOT NULL,
        on_chain_sync_timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
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
        retry_count INTEGER DEFAULT 0 NOT NULL,
        next_retry_at TIMESTAMP,
        last_error TEXT,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_ledger_reference ON fee_ledger (transaction_type, reference_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_term_vaults_near_intent ON term_vaults (near_intent_id) WHERE near_intent_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_term_vaults_deposit_address ON term_vaults (deposit_address) WHERE deposit_address IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_swaps_deposit_address ON intent_swaps (deposit_address);
      ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS harvest_tx_hash TEXT;
      ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS harvest_intent_id TEXT;
      ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS harvest_fee_amount NUMERIC(18,6);
      ALTER TABLE term_vaults ADD COLUMN IF NOT EXISTS harvest_status TEXT DEFAULT 'NOT_STARTED' NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_term_vaults_harvest_intent ON term_vaults (harvest_intent_id) WHERE harvest_intent_id IS NOT NULL;

      ALTER TABLE entities ADD COLUMN IF NOT EXISTS auto_save_enabled INTEGER DEFAULT 0 NOT NULL;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS auto_save_liquid_buffer_usd NUMERIC(18,2) DEFAULT 50.00 NOT NULL;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS auto_save_idle_since TIMESTAMP;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS auto_save_strategy_id TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS evm_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS solana_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS btc_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS tron_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS ton_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS cosmos_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS sui_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS aptos_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS xrp_deposit_address TEXT;
      ALTER TABLE entities ADD COLUMN IF NOT EXISTS near_deposit_address TEXT;

      CREATE TABLE IF NOT EXISTS nuvion_entities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        entity_id TEXT NOT NULL UNIQUE,
        local_entity_id TEXT NOT NULL REFERENCES entities(id),
        context TEXT NOT NULL CHECK (context IN ('PERSONAL', 'BUSINESS')),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'business')),
        person_id TEXT,
        business_id TEXT,
        status TEXT DEFAULT 'incomplete' NOT NULL CHECK (status IN ('incomplete', 'pending', 'approved', 'rejected', 'suspended')),
        rejection_reason TEXT,
        provider_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_nuvion_entities_local_context UNIQUE (local_entity_id, context)
      );

      CREATE TABLE IF NOT EXISTS nuvion_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        local_entity_id TEXT NOT NULL REFERENCES entities(id),
        nuvion_entity_id TEXT NOT NULL REFERENCES nuvion_entities(entity_id),
        account_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        currency TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        balance_available_minor NUMERIC(28,0) DEFAULT 0 NOT NULL,
        balance_current_minor NUMERIC(28,0) DEFAULT 0 NOT NULL,
        provider_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_nuvion_accounts_entity_currency UNIQUE (nuvion_entity_id, currency)
      );

      CREATE TABLE IF NOT EXISTS nuvion_account_details (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        local_entity_id TEXT NOT NULL REFERENCES entities(id),
        nuvion_entity_id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES nuvion_accounts(account_id),
        account_detail_id TEXT NOT NULL UNIQUE,
        currency TEXT NOT NULL,
        asset_type TEXT DEFAULT 'fiat' NOT NULL,
        chain TEXT,
        status TEXT DEFAULT 'pending' NOT NULL,
        account_number TEXT,
        routing_number TEXT,
        issuer JSONB,
        beneficiary_name TEXT,
        provider_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_nuvion_details_account_currency_chain UNIQUE (account_id, currency, chain)
      );

      CREATE TABLE IF NOT EXISTS nuvion_webhook_events (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        event TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'RECEIVED' NOT NULL CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
        error_message TEXT,
        received_at TIMESTAMP DEFAULT NOW() NOT NULL,
        processed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS provider_deposit_intents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        local_entity_id TEXT NOT NULL REFERENCES entities(id),
        provider TEXT NOT NULL CHECK (provider IN ('NUVION', 'BRAILS')),
        provider_entity_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        provider_account_detail_id TEXT,
        fiat_currency TEXT NOT NULL,
        fiat_amount_minor NUMERIC(28,0) NOT NULL,
        destination_asset TEXT DEFAULT 'USC' NOT NULL,
        expected_destination_minor NUMERIC(28,0),
        quote_id TEXT,
        unique_reference TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'QUOTED' NOT NULL,
        expires_at TIMESTAMP,
        provider_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_transactions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('NUVION', 'BRAILS')),
        provider_transaction_id TEXT NOT NULL,
        local_entity_id TEXT NOT NULL REFERENCES entities(id),
        direction TEXT NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
        currency TEXT NOT NULL,
        amount_minor NUMERIC(28,0) NOT NULL,
        status TEXT NOT NULL,
        reference TEXT,
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_provider_transactions_resource UNIQUE (provider, provider_transaction_id)
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        due_virtual_account_id TEXT NOT NULL,
        account_number TEXT NOT NULL UNIQUE,
        routing_number TEXT,
        bank_name TEXT NOT NULL,
        account_holder_name TEXT NOT NULL,
        currency TEXT NOT NULL,
        rail TEXT DEFAULT 'bank_transfer' NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_virtual_account_id TEXT;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS nuvion_account_id TEXT;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS routing_number TEXT;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rail TEXT DEFAULT 'bank_transfer' NOT NULL;
      UPDATE accounts SET due_virtual_account_id = COALESCE(due_virtual_account_id, nuvion_account_id) WHERE due_virtual_account_id IS NULL;

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

      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'RECEIVED' NOT NULL;
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS intent_swap_id TEXT;
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS source_tx_hash TEXT;
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS intent_funding_tx_hash TEXT;
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS destination_tx_hash TEXT;
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS settled_asset TEXT;
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS settled_amount NUMERIC(28,8);
      ALTER TABLE transfers ADD COLUMN IF NOT EXISTS settlement_error TEXT;
      ALTER TABLE transfers ALTER COLUMN source_amount TYPE NUMERIC(28,18);
      ALTER TABLE transfers ALTER COLUMN target_amount TYPE NUMERIC(28,18);
      ALTER TABLE transfers ALTER COLUMN fee_amount TYPE NUMERIC(28,18);

      CREATE TABLE IF NOT EXISTS brails_collections (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        invoice_id TEXT REFERENCES invoices(id),
        reference TEXT NOT NULL UNIQUE,
        provider_transaction_id TEXT UNIQUE,
        provider_account_id TEXT,
        country TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount_minor NUMERIC(28,0) NOT NULL,
        amount_received_minor NUMERIC(28,0),
        mode TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING' NOT NULL,
        account_number TEXT,
        bank_name TEXT,
        expires_at TIMESTAMP,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS brails_cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        entity_id TEXT NOT NULL REFERENCES entities(id),
        account_kind TEXT NOT NULL CHECK (account_kind IN ('PERSONAL', 'BUSINESS')),
        provider TEXT NOT NULL DEFAULT 'BRAILS' CHECK (provider IN ('BRAILS')),
        provider_card_id TEXT NOT NULL UNIQUE,
        provider_card_user_id TEXT,
        brand TEXT NOT NULL,
        card_type TEXT NOT NULL,
        cardholder_name TEXT NOT NULL,
        currency TEXT NOT NULL,
        balance NUMERIC(18,4) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'FROZEN', 'TERMINATED', 'FAILED')),
        fee_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
        provider_metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_brails_cards_entity_status ON brails_cards(entity_id, status);
      CREATE INDEX IF NOT EXISTS idx_brails_cards_user_account_kind ON brails_cards(user_id, account_kind);

      CREATE TABLE IF NOT EXISTS automation_policies (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        status TEXT DEFAULT 'PENDING_SIGNATURE' NOT NULL,
        allowed_assets TEXT DEFAULT 'USDC,USDT' NOT NULL,
        allowed_protocols TEXT DEFAULT 'pods,kamino,near_intent' NOT NULL,
        max_per_transaction_usd NUMERIC(18,2) NOT NULL,
        max_daily_usd NUMERIC(18,2) NOT NULL,
        max_monthly_usd NUMERIC(18,2) NOT NULL,
        approval_reference TEXT,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT automation_policies_entity_unique UNIQUE (entity_id)
      );

      CREATE TABLE IF NOT EXISTS gas_sponsorships (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        related_transaction_id TEXT,
        chain TEXT NOT NULL,
        native_asset TEXT NOT NULL,
        user_wallet TEXT NOT NULL,
        treasury_wallet TEXT NOT NULL,
        intent_swap_id TEXT,
        estimated_gas_native NUMERIC(28,18),
        requested_amount_native NUMERIC(28,18) NOT NULL,
        actual_gas_native NUMERIC(28,18),
        native_usd_price NUMERIC(28,8),
        price_timestamp TIMESTAMP,
        reserved_stablecoin NUMERIC(28,8),
        charged_stablecoin TEXT DEFAULT 'USDC' NOT NULL,
        charged_amount NUMERIC(28,8),
        released_amount NUMERIC(28,8),
        funding_tx_hash TEXT,
        user_tx_hash TEXT,
        status TEXT DEFAULT 'REQUESTED' NOT NULL,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payment_requests (
        id TEXT PRIMARY KEY,
        requester_entity_id TEXT NOT NULL REFERENCES entities(id),
        payer_entity_id TEXT REFERENCES entities(id),
        payer_username TEXT,
        amount NUMERIC(18,4) NOT NULL,
        currency TEXT NOT NULL,
        narration TEXT,
        status TEXT DEFAULT 'PENDING' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        paid_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS raw_webhooks (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('DUE', 'BRAILS')),
        event_id TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'RECEIVED' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rwa_positions (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        shares NUMERIC(18,6) NOT NULL,
        reserved_shares NUMERIC(18,6) DEFAULT 0 NOT NULL,
        average_cost_basis_usd NUMERIC(18,4) NOT NULL,
        current_price_usd NUMERIC(18,4) NOT NULL,
        total_value_usd NUMERIC(18,2) NOT NULL,
        network TEXT DEFAULT 'BSC' NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rwa_positions_entity_symbol ON rwa_positions (entity_id, symbol);
      ALTER TABLE rwa_positions ADD COLUMN IF NOT EXISTS reserved_shares NUMERIC(18,6) DEFAULT 0 NOT NULL;

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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rwa_orders_action_id ON rwa_orders (action_id) WHERE action_id IS NOT NULL;

      ALTER TABLE gas_sponsorships ADD COLUMN IF NOT EXISTS related_transaction_id TEXT;
      ALTER TABLE gas_sponsorships ADD COLUMN IF NOT EXISTS estimated_gas_native NUMERIC(28,18);
      ALTER TABLE gas_sponsorships ADD COLUMN IF NOT EXISTS native_usd_price NUMERIC(28,8);
      ALTER TABLE gas_sponsorships ADD COLUMN IF NOT EXISTS price_timestamp TIMESTAMP;
      ALTER TABLE gas_sponsorships ADD COLUMN IF NOT EXISTS reserved_stablecoin NUMERIC(28,8);
      ALTER TABLE gas_sponsorships ADD COLUMN IF NOT EXISTS released_amount NUMERIC(28,8);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_gas_sponsorships_related_transaction
        ON gas_sponsorships (related_transaction_id)
        WHERE related_transaction_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS school_campuses (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        name TEXT NOT NULL,
        address TEXT,
        status TEXT DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS school_classes (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        campus_id TEXT REFERENCES school_campuses(id),
        name TEXT NOT NULL,
        academic_session TEXT,
        term TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS school_students (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        class_id TEXT NOT NULL REFERENCES school_classes(id),
        student_number TEXT NOT NULL,
        full_name TEXT NOT NULL,
        parent_name TEXT,
        parent_email TEXT,
        parent_phone TEXT,
        status TEXT DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_school_students_entity_number UNIQUE (entity_id, student_number)
      );
      CREATE TABLE IF NOT EXISTS student_payment_accounts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        student_id TEXT NOT NULL REFERENCES school_students(id),
        currency TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('SCHOOL_MASTER_REFERENCE')),
        master_account_id TEXT NOT NULL REFERENCES accounts(id),
        payment_reference TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_student_payment_accounts_student_currency UNIQUE (student_id, currency)
      );
      CREATE TABLE IF NOT EXISTS school_fee_schedules (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        class_id TEXT NOT NULL REFERENCES school_classes(id),
        name TEXT NOT NULL,
        amount NUMERIC(18,2) NOT NULL,
        currency TEXT NOT NULL,
        due_date TEXT,
        academic_session TEXT,
        term TEXT,
        status TEXT DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS school_staff (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        staff_number TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT,
        department TEXT,
        employment_type TEXT DEFAULT 'EMPLOYEE' NOT NULL,
        status TEXT DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_school_staff_entity_number UNIQUE (entity_id, staff_number)
      );
      CREATE TABLE IF NOT EXISTS staff_bank_accounts (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL REFERENCES school_staff(id),
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        bank_code TEXT,
        is_default BOOLEAN DEFAULT FALSE NOT NULL,
        status TEXT DEFAULT 'PENDING_VERIFICATION' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS school_savings_policies (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        name TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('PERCENTAGE_OF_PAYMENT', 'MANUAL')),
        percentage NUMERIC(5,2) DEFAULT 0 NOT NULL,
        fixed_amount NUMERIC(18,2),
        target_amount NUMERIC(18,2),
        currency TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS school_applications (
        id TEXT PRIMARY KEY,
        school_legal_name TEXT NOT NULL,
        registration_number TEXT NOT NULL,
        admin_name TEXT NOT NULL,
        admin_email TEXT NOT NULL,
        admin_phone TEXT NOT NULL,
        country TEXT NOT NULL,
        status TEXT DEFAULT 'SUBMITTED' NOT NULL CHECK (status IN ('SUBMITTED', 'KYB_REVIEW', 'APPROVED', 'REJECTED')),
        brails_customer_id TEXT,
        brails_status TEXT,
        brails_payload JSONB,
        application_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      ALTER TABLE school_applications ADD COLUMN IF NOT EXISTS brails_customer_id TEXT;
      ALTER TABLE school_applications ADD COLUMN IF NOT EXISTS brails_status TEXT;
      ALTER TABLE school_applications ADD COLUMN IF NOT EXISTS brails_payload JSONB;
      ALTER TABLE school_applications ADD COLUMN IF NOT EXISTS application_data JSONB;
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
