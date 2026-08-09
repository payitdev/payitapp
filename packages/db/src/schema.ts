import { pgTable, text, timestamp, integer, numeric, uniqueIndex, check } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  fullName: text('full_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trustedDevices = pgTable('trusted_devices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull(),
  passcodeHash: text('passcode_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Entity table with strict PostgreSQL UNIQUE(user_id, kind) constraint
export const entities = pgTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['PERSONAL', 'BUSINESS'] }).notNull(),
  legalName: text('legal_name').notNull(),
  username: text('username').unique(), // Personal entity unique handle
  usernameCustomized: integer('username_customized').default(0).notNull(), // 0 = false (can edit once), 1 = true (locked)
  businessTag: text('business_tag').unique(), // Business entity tag (e.g. ACME)
  nuvionTier: integer('nuvion_tier').default(1).notNull(),
  nuvionStatus: text('nuvion_status', { enum: ['incomplete', 'pending', 'approved', 'rejected'] }).default('incomplete').notNull(),
  nuvionEntityId: text('nuvion_entity_id'),
  xpub: text('xpub'), // HD Wallet Extended Public Key (KMS isolate)
  solanaAddress: text('solana_address'), // Solana Universal Account Address (Base58)
  accountBackfilled: integer('account_backfilled').default(0).notNull(),
  accountBackfilledAt: timestamp('account_backfilled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userKindIdx: uniqueIndex('idx_entities_user_kind').on(table.userId, table.kind),
    nuvionEntityIdx: uniqueIndex('idx_entities_nuvion_entity_id').on(table.nuvionEntityId),
  };
});

// Accounts table with mandatory non-nullable entity_id
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  nuvionAccountId: text('nuvion_account_id').notNull(),
  accountNumber: text('account_number').notNull().unique(),
  bankName: text('bank_name').notNull(),
  accountHolderName: text('account_holder_name').notNull(),
  currency: text('currency').notNull(), // NGN, USD, etc.
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    nuvionAccountIdx: uniqueIndex('idx_accounts_nuvion_account_id').on(table.nuvionAccountId),
    entityCurrencyIdx: uniqueIndex('idx_accounts_entity_currency').on(table.entityId, table.currency),
  };
});

// Archived accounts table to preserve old account history for audit purposes
export const archivedAccounts = pgTable('archived_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  nuvionAccountId: text('nuvion_account_id').notNull(),
  accountNumber: text('account_number').notNull(),
  bankName: text('bank_name').notNull(),
  accountHolderName: text('account_holder_name'),
  currency: text('currency').notNull(),
  archivedReason: text('archived_reason').default('MISASSIGNED_MERCHANT_ACCOUNT_BACKFILL').notNull(),
  archivedAt: timestamp('archived_at').defaultNow().notNull(),
});

// Wallets table with mandatory non-nullable entity_id
export const wallets = pgTable('wallets', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  particleWalletAddress: text('particle_wallet_address').notNull(),
  chainId: integer('chain_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    particleWalletIdx: uniqueIndex('idx_wallets_particle_address').on(table.particleWalletAddress),
  };
});

// Cards table with mandatory non-nullable entity_id and account_id FK
export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  accountId: text('account_id').notNull().references(() => accounts.id),
  nuvionCardId: text('nuvion_card_id').notNull(),
  last4: text('last4').notNull(),
  brand: text('brand').notNull(),
  cardholderName: text('cardholder_name'),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Invoices table with HD wallet address derivation parameters
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  tag: text('tag').notNull().unique(), // e.g. ACME-014
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  dueDate: text('due_date').notNull(),
  hdIndex: integer('hd_index').notNull(),
  hdReceivingAddress: text('hd_receiving_address').notNull(),
  settlementType: text('settlement_type', { enum: ['fiat', 'stablecoin'] }).notNull(),
  status: text('status', { enum: ['pending', 'paid', 'partially_paid', 'overpaid', 'overdue', 'cancelled'] }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
});

// Payroll runs table
export const payrollRuns = pgTable('payroll_runs', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  title: text('title').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  status: text('status', { enum: ['draft', 'reviewing', 'processing', 'completed', 'completed_with_errors', 'failed'] }).default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrollItems = pgTable('payroll_items', {
  id: text('id').primaryKey(),
  payrollRunId: text('payroll_run_id').notNull().references(() => payrollRuns.id),
  recipientName: text('recipient_name').notNull(),
  recipientAccountOrTag: text('recipient_account_or_tag').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  status: text('status', { enum: ['pending', 'success', 'failed'] }).default('pending').notNull(),
  errorMessage: text('error_message'),
});

// Ledger accounts table with mandatory non-nullable entity_id
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] }).notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Double-entry ledger entries table with mandatory non-nullable entity_id
export const ledgerEntries = pgTable('ledger_entries', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  transactionId: text('transaction_id').notNull(),
  ledgerAccountId: text('ledger_account_id').notNull().references(() => ledgerAccounts.id),
  type: text('type', { enum: ['DEBIT', 'CREDIT'] }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Insert-Only Audit Log
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  metadata: text('metadata').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Friendships table (Mutual friends network)
export const friendships = pgTable('friendships', {
  id: text('id').primaryKey(),
  requesterEntityId: text('requester_entity_id').notNull().references(() => entities.id),
  addresseeEntityId: text('addressee_entity_id').notNull().references(() => entities.id),
  status: text('status', { enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED'] }).default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Peer-to-Peer Payment Requests table (Mutual Friends Gated)
export const paymentRequests = pgTable('payment_requests', {
  id: text('id').primaryKey(),
  requesterEntityId: text('requester_entity_id').notNull().references(() => entities.id),
  payerEntityId: text('payer_entity_id').notNull().references(() => entities.id),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  narration: text('narration'),
  status: text('status', { enum: ['PENDING', 'PAID', 'DECLINED', 'EXPIRED'] }).default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Deterministic Risk Events Log
export const riskEvents = pgTable('risk_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  entityId: text('entity_id').notNull(),
  score: numeric('score', { precision: 6, scale: 2 }).notNull(),
  riskLevel: text('risk_level', { enum: ['LOW', 'MEDIUM', 'HIGH'] }).notNull(),
  rulesTriggered: text('rules_triggered').notNull(),
  decisionReason: text('decision_reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Durable Idempotency Store (Persists across backend restarts)
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(), // Composite: ${entityId}_${key}
  entityId: text('entity_id').notNull().references(() => entities.id),
  requestHash: text('request_hash').notNull(),
  status: text('status', { enum: ['PROCESSING', 'COMPLETED', 'FAILED'] }).notNull(),
  responsePayload: text('response_payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Inbound Raw Webhooks Log (Edge Case #2 Protection)
export const rawWebhooks = pgTable('raw_webhooks', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['NUVION', 'PARTICLE'] }).notNull(),
  eventId: text('event_id').notNull().unique(),
  payload: text('payload').notNull(),
  status: text('status', { enum: ['RECEIVED', 'PROCESSED', 'FAILED'] }).default('RECEIVED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User Savings Goals
export const savingsGoals = pgTable('savings_goals', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  currency: text('currency').default('USD').notNull(),
  lockPeriodEnd: timestamp('lock_period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Saved Contacts & Beneficiaries table
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  targetEntityId: text('target_entity_id').references(() => entities.id),
  name: text('name').notNull(),
  paytag: text('paytag'),
  accountNumber: text('account_number'),
  bankCode: text('bank_code'),
  bankName: text('bank_name'),
  type: text('type', { enum: ['INTERNAL', 'EXTERNAL'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Persisted Reconciliation Audit Logs
export const reconciliationLogs = pgTable('reconciliation_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  entityId: text('entity_id'),
  ledgerBalance: numeric('ledger_balance', { precision: 18, scale: 2 }),
  onChainBalance: numeric('on_chain_balance', { precision: 18, scale: 2 }),
  discrepancy: numeric('discrepancy', { precision: 18, scale: 2 }),
  status: text('status', { enum: ['MATCHED', 'DISCREPANCY_DETECTED'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Waitlist Signups table
export const waitlist = pgTable('waitlist', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  persona: text('persona', { enum: ['freelancer', 'founder', 'sme', 'interested'] }).notNull(),
  preferredPlatform: text('preferred_platform', { enum: ['webapp', 'telegram', 'both'] }).default('webapp').notNull(),
  source: text('source').default('website').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

