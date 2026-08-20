import { pgTable, text, timestamp, integer, numeric, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  fullName: text('full_name').notNull(),
  privyUserId: text('privy_user_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trustedDevices = pgTable('trusted_devices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull(),
  passcodeHash: text('passcode_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Dual Account Entity model (PERSONAL vs BUSINESS)
export const entities = pgTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['PERSONAL', 'BUSINESS'] }).notNull(),
  legalName: text('legal_name').notNull(),
  username: text('username').unique(), // Personal handle (e.g. musa)
  usernameCustomized: integer('username_customized').default(0).notNull(),
  businessTag: text('business_tag').unique(), // Business tag (e.g. ACME)
  turnkeySubOrgId: text('turnkey_sub_org_id'),
  turnkeyUserId: text('turnkey_user_id'),
  dueCustomerId: text('due_customer_id'),
  dueStatus: text('due_status', { enum: ['incomplete', 'pending', 'approved', 'rejected'] }).default('incomplete').notNull(),
  evmDepositAddress: text('evm_deposit_address'), // MPC EVM Address (Ethereum, Base, BSC, Polygon, Arbitrum, Optimism)
  solanaDepositAddress: text('solana_deposit_address'), // MPC Solana Address
  btcDepositAddress: text('btc_deposit_address'), // MPC Bitcoin Address
  tronDepositAddress: text('tron_deposit_address'), // MPC TRON Address
  tonDepositAddress: text('ton_deposit_address'), // MPC TON Address
  cosmosDepositAddress: text('cosmos_deposit_address'), // MPC Cosmos Address
  suiDepositAddress: text('sui_deposit_address'), // MPC Sui Address
  aptosDepositAddress: text('aptos_deposit_address'), // MPC Aptos Address
  xrpDepositAddress: text('xrp_deposit_address'), // MPC XRP Address
  nearDepositAddress: text('near_deposit_address'), // MPC NEAR Named Address (e.g. musa.payit.testnet / musa-biz.payit.testnet)
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userKindIdx: uniqueIndex('idx_entities_user_kind').on(table.userId, table.kind),
    dueCustomerIdx: uniqueIndex('idx_entities_due_customer_id').on(table.dueCustomerId),
  };
});

// Static Virtual Accounts issued by Due (EUR SEPA vIBAN, USD ACH/Wire, NGN NIP, GBP FPS)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  dueVirtualAccountId: text('due_virtual_account_id').notNull(),
  accountNumber: text('account_number').notNull(), // Account Number or IBAN
  routingNumber: text('routing_number'), // Routing Number, Sort Code, or BIC
  bankName: text('bank_name').notNull(),
  accountHolderName: text('account_holder_name').notNull(),
  currency: text('currency').notNull(), // EUR, USD, GBP, NGN, BRL, MXN
  rail: text('rail').default('bank_transfer').notNull(), // sepa, ach, nip, fps, etc.
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    dueAccountIdx: uniqueIndex('idx_accounts_due_account_id').on(table.dueVirtualAccountId),
    entityCurrencyIdx: uniqueIndex('idx_accounts_entity_currency').on(table.entityId, table.currency),
  };
});

export const kycVerifications = pgTable('kyc_verifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  entityId: text('entity_id').notNull().references(() => entities.id),
  entityKind: text('entity_kind', { enum: ['PERSONAL', 'BUSINESS'] }).notNull(),
  idType: text('id_type').notNull(),
  idValueHash: text('id_value_hash').notNull(),
  status: text('status').notNull(),
  identityVerificationId: text('identity_verification_id'),
  identityData: jsonb('identity_data'),
  livenessSessionId: text('liveness_session_id'),
  livenessStatus: text('liveness_status'),
  livenessScore: numeric('liveness_score', { precision: 8, scale: 6 }),
  faceMatchScore: numeric('face_match_score', { precision: 8, scale: 6 }),
  amlStatus: text('aml_status'),
  amlRiskLevel: text('aml_risk_level'),
  amlFlagged: integer('aml_flagged'),
  brailsCustomerId: text('brails_customer_id'),
  brailsCustomerPayload: jsonb('brails_customer_payload'),
  brailsAccountPayloads: jsonb('brails_account_payloads'),
  brailsAccountIds: jsonb('brails_account_ids'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Invoices table with Due dynamic quotes and transfer tracking
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  tag: text('tag').notNull().unique(), // e.g. PROXIM-001
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  dueDate: text('due_date').notNull(),
  dueQuoteId: text('due_quote_id'),
  dueTransferId: text('due_transfer_id'),
  paymentAccountOrLink: text('payment_account_or_link'),
  expiresAt: timestamp('expires_at'),
  settlementType: text('settlement_type', { enum: ['fiat', 'stablecoin'] }).default('stablecoin').notNull(),
  status: text('status', { enum: ['draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'] }).default('pending').notNull(),
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

// Payroll runs table for bulk disbursals
export const payrollRuns = pgTable('payroll_runs', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  title: text('title').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  currency: text('currency').default('USDC').notNull(),
  status: text('status', { enum: ['draft', 'reviewing', 'processing', 'completed', 'completed_with_errors', 'failed'] }).default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrollItems = pgTable('payroll_items', {
  id: text('id').primaryKey(),
  payrollRunId: text('payroll_run_id').notNull().references(() => payrollRuns.id),
  recipientName: text('recipient_name').notNull(),
  recipientAccountOrPhone: text('recipient_account_or_phone').notNull(),
  bankOrNetwork: text('bank_or_network'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  duePayoutId: text('due_payout_id'),
  status: text('status', { enum: ['pending', 'success', 'failed'] }).default('pending').notNull(),
  errorMessage: text('error_message'),
});

// Dynamic Pay-ins & Transfers Log
export const transfers = pgTable('transfers', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  dueTransferId: text('due_transfer_id').unique(),
  sourceCurrency: text('source_currency').notNull(),
  targetCurrency: text('target_currency').notNull(),
  sourceAmount: numeric('source_amount', { precision: 18, scale: 2 }).notNull(),
  targetAmount: numeric('target_amount', { precision: 18, scale: 4 }).notNull(),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }).default('0.00').notNull(),
  direction: text('direction', { enum: ['CREDIT', 'DEBIT'] }).default('CREDIT').notNull(),
  paymentInstructions: text('payment_instructions'),
  status: text('status', { enum: ['pending', 'completed', 'failed', 'expired'] }).default('pending').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Platform Multi-Stream Fee & Revenue Ledger
export const feeLedger = pgTable('fee_ledger', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  transactionType: text('transaction_type', {
    enum: ['PAY_IN', 'INVOICE', 'PAYROLL', 'ALTCOIN_SWAP', 'OFF_RAMP', 'SUBSCRIPTION'],
  }).notNull(),
  referenceId: text('reference_id').notNull(),
  grossAmount: numeric('gross_amount', { precision: 18, scale: 4 }).notNull(),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Double-Entry Internal Ledger Accounts
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] }).notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ledgerEntries = pgTable('ledger_entries', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  transactionId: text('transaction_id').notNull(),
  ledgerAccountId: text('ledger_account_id').notNull().references(() => ledgerAccounts.id),
  type: text('type', { enum: ['DEBIT', 'CREDIT'] }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Savings Goals & Idle Yield (Pods Finance)
export const savingsGoals = pgTable('savings_goals', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  currency: text('currency').default('USD').notNull(),
  strategyId: text('strategy_id'),
  lockPeriodEnd: timestamp('lock_period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// High-Yield Term Vaults (Kamino & Pods Term Locks with On-Chain Sync)
export const termVaults = pgTable('term_vaults', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  vaultName: text('vault_name').notNull(),
  protocol: text('protocol', { enum: ['kamino', 'pods', 'near_intent'] }).default('kamino').notNull(),
  lockDurationDays: integer('lock_duration_days').notNull(), // 30, 60, 90, 365
  startDate: timestamp('start_date').defaultNow().notNull(),
  unlockDate: timestamp('unlock_date').notNull(),
  principalAmountUsd: numeric('principal_amount_usd', { precision: 18, scale: 2 }).notNull(),
  grossApy: numeric('gross_apy', { precision: 5, scale: 2 }).notNull(),
  proximCutApy: numeric('proxim_cut_apy', { precision: 5, scale: 2 }).notNull(), // 2.5%
  userNetApy: numeric('user_net_apy', { precision: 5, scale: 2 }).notNull(),
  accruedInterestUsd: numeric('accrued_interest_usd', { precision: 18, scale: 2 }).default('0.00').notNull(),
  earlyExitChoice: text('early_exit_choice', { enum: ['FORFEIT_INTEREST', 'PENALTY_FEE'] }),
  nearIntentId: text('near_intent_id'),
  depositAddress: text('deposit_address'),
  sourceTxHash: text('source_tx_hash'),
  solanaTxHash: text('solana_tx_hash'),
  solanaRecipientAddress: text('solana_recipient_address'),
  sharesMinted: numeric('shares_minted', { precision: 28, scale: 8 }),
  status: text('status', { enum: ['PENDING_DEPOSIT', 'SOLVING', 'LOCKED', 'MATURED', 'EARLY_UNLOCKED', 'WITHDRAWN_EXTERNAL'] }).default('LOCKED').notNull(),
  onChainSyncTimestamp: timestamp('on_chain_sync_timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tokenized Stocks & Real World Assets (Ondo Global Markets)
export const rwaPositions = pgTable('rwa_positions', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  shares: numeric('shares', { precision: 18, scale: 6 }).notNull(),
  averageCostBasisUsd: numeric('average_cost_basis_usd', { precision: 18, scale: 4 }).notNull(),
  currentPriceUsd: numeric('current_price_usd', { precision: 18, scale: 4 }).notNull(),
  totalValueUsd: numeric('total_value_usd', { precision: 18, scale: 2 }).notNull(),
  network: text('network').default('BSC').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rwaOrders = pgTable('rwa_orders', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  symbol: text('symbol').notNull(),
  side: text('side', { enum: ['BUY', 'SELL'] }).notNull(),
  usdAmount: numeric('usd_amount', { precision: 18, scale: 2 }).notNull(),
  shares: numeric('shares', { precision: 18, scale: 6 }).notNull(),
  status: text('status', { enum: ['PENDING', 'SUBMITTED', 'COMPLETED', 'FAILED'] }).default('PENDING').notNull(),
  biconomyQuoteId: text('biconomy_quote_id'),
  biconomyTxHash: text('biconomy_tx_hash'),
  actionId: text('action_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// NEAR Intent 1Click Cross-Chain Swap Swaps & Solvers
export const intentSwaps = pgTable('intent_swaps', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  originAsset: text('origin_asset').notNull(),
  destinationAsset: text('destination_asset').notNull(),
  originAmount: numeric('origin_amount', { precision: 28, scale: 8 }).notNull(),
  destinationAmount: numeric('destination_amount', { precision: 28, scale: 8 }),
  depositAddress: text('deposit_address').notNull(),
  recipientAddress: text('recipient_address').notNull(),
  sourceTxHash: text('source_tx_hash'),
  destinationTxHash: text('destination_tx_hash'),
  status: text('status', { enum: ['PENDING_DEPOSIT', 'SUBMITTED', 'SOLVING', 'COMPLETED', 'FAILED', 'REFUNDED'] }).default('PENDING_DEPOSIT').notNull(),
  protocol: text('protocol', { enum: ['kamino_vault', 'cross_chain_swap', 'earn_vault'] }).default('cross_chain_swap').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Beneficiaries / Saved Contacts
export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  targetEntityId: text('target_entity_id').references(() => entities.id),
  name: text('name').notNull(),
  paytag: text('paytag'),
  accountNumber: text('account_number'),
  bankCode: text('bank_code'),
  bankName: text('bank_name'),
  phoneOrMomo: text('phone_or_momo'),
  type: text('type', { enum: ['INTERNAL', 'EXTERNAL'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Durable Idempotency Store
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  requestHash: text('request_hash').notNull(),
  status: text('status', { enum: ['PROCESSING', 'COMPLETED', 'FAILED'] }).notNull(),
  responsePayload: text('response_payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Raw Inbound Webhooks Store
export const rawWebhooks = pgTable('raw_webhooks', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['DUE', 'TURNKEY'] }).notNull(),
  eventId: text('event_id').notNull().unique(),
  payload: text('payload').notNull(),
  status: text('status', { enum: ['RECEIVED', 'PROCESSED', 'FAILED'] }).default('RECEIVED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Waitlist for Proxim
export const waitlist = pgTable('waitlist', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  persona: text('persona', { enum: ['freelancer', 'founder', 'sme', 'interested'] }).notNull(),
  preferredPlatform: text('preferred_platform', { enum: ['webapp', 'telegram', 'both'] }).default('webapp').notNull(),
  source: text('source').default('website').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
