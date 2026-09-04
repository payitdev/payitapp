import { pgTable, text, timestamp, integer, numeric, uniqueIndex, index, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  fullName: text('full_name').notNull(),
  privyUserId: text('privy_user_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const telegramUserLinks = pgTable('telegram_user_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  privyUserId: text('privy_user_id'),
  telegramUserId: integer('telegram_user_id'),
  telegramUsername: text('telegram_username'),
  nonce: text('nonce').notNull().unique(),
  status: text('status', { enum: ['pending', 'linked', 'revoked'] }).default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  linkedAt: timestamp('linked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userLinkIdx: uniqueIndex('idx_telegram_user_links_user').on(table.userId),
  telegramUserIdx: uniqueIndex('idx_telegram_user_links_telegram_user').on(table.telegramUserId),
}));

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
  registrationNumber: text('registration_number'),
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
  autoSaveEnabled: integer('auto_save_enabled').default(0).notNull(),
  autoSaveLiquidBufferUsd: numeric('auto_save_liquid_buffer_usd', { precision: 18, scale: 2 }).default('50.00').notNull(),
  autoSaveIdleSince: timestamp('auto_save_idle_since'),
  autoSaveStrategyId: text('auto_save_strategy_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userKindIdx: uniqueIndex('idx_entities_user_kind').on(table.userId, table.kind),
    dueCustomerIdx: uniqueIndex('idx_entities_due_customer_id').on(table.dueCustomerId),
  };
});

// Nuvion resources are isolated from legacy Due/Brails account records.
export const nuvionEntities = pgTable('nuvion_entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  entityId: text('entity_id').notNull().unique(),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  context: text('context', { enum: ['PERSONAL', 'BUSINESS'] }).notNull(),
  entityType: text('entity_type', { enum: ['individual', 'business'] }).notNull(),
  personId: text('person_id'),
  businessId: text('business_id'),
  status: text('status', { enum: ['incomplete', 'pending', 'approved', 'rejected', 'suspended'] }).default('incomplete').notNull(),
  rejectionReason: text('rejection_reason'),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  localContextIdx: uniqueIndex('idx_nuvion_entities_local_context').on(table.localEntityId, table.context),
}));

export const nuvionAccounts = pgTable('nuvion_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull().references(() => nuvionEntities.entityId),
  accountId: text('account_id').notNull().unique(),
  type: text('type').notNull(),
  currency: text('currency').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').default('active').notNull(),
  balanceAvailableMinor: numeric('balance_available_minor', { precision: 28, scale: 0 }).default('0').notNull(),
  balanceCurrentMinor: numeric('balance_current_minor', { precision: 28, scale: 0 }).default('0').notNull(),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  entityCurrencyIdx: uniqueIndex('idx_nuvion_accounts_entity_currency').on(table.nuvionEntityId, table.currency),
}));

export const nuvionAccountDetails = pgTable('nuvion_account_details', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull(),
  accountId: text('account_id').notNull().references(() => nuvionAccounts.accountId),
  accountDetailId: text('account_detail_id').notNull().unique(),
  currency: text('currency').notNull(),
  assetType: text('asset_type').default('fiat').notNull(),
  chain: text('chain'),
  status: text('status').default('pending').notNull(),
  accountNumber: text('account_number'),
  routingNumber: text('routing_number'),
  iban: text('iban'),
  sortCode: text('sort_code'),
  swiftBic: text('swift_bic'),
  issuer: jsonb('issuer'),
  beneficiaryName: text('beneficiary_name'),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  accountCurrencyIdx: uniqueIndex('idx_nuvion_details_account_currency_chain').on(table.accountId, table.currency, table.chain),
}));

export const nuvionWebhookEvents = pgTable('nuvion_webhook_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  event: text('event').notNull(),
  payload: text('payload').notNull(),
  status: text('status', { enum: ['RECEIVED', 'PROCESSED', 'FAILED'] }).default('RECEIVED').notNull(),
  errorMessage: text('error_message'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

export const nuvionCounterparties = pgTable('nuvion_counterparties', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull(),
  counterpartyId: text('counterparty_id').notNull().unique(),
  type: text('type', { enum: ['individual', 'business'] }).notNull(),
  nickname: text('nickname'),
  profile: jsonb('profile').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  entityCounterpartyIdx: index('idx_nuvion_counterparties_entity').on(table.localEntityId, table.nuvionEntityId),
}));

export const nuvionPaymentDetails = pgTable('nuvion_payment_details', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  counterpartyId: text('counterparty_id').notNull().references(() => nuvionCounterparties.counterpartyId),
  paymentDetailId: text('payment_detail_id').notNull().unique(),
  paymentMethod: text('payment_method').notNull(),
  currency: text('currency').notNull(),
  country: text('country').notNull(),
  accountHolderName: text('account_holder_name').notNull(),
  accountNumber: text('account_number'),
  routingNumber: text('routing_number'),
  iban: text('iban'),
  sortCode: text('sort_code'),
  swiftBic: text('swift_bic'),
  bankCode: text('bank_code'),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const nuvionTransfers = pgTable('nuvion_transfers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull(),
  accountId: text('account_id').notNull(),
  transferId: text('transfer_id').notNull().unique(),
  counterpartyId: text('counterparty_id').notNull(),
  paymentDetailId: text('payment_detail_id').notNull(),
  amountMinor: numeric('amount_minor', { precision: 28, scale: 0 }).notNull(),
  currency: text('currency').notNull(),
  paymentType: text('payment_type').notNull(),
  narration: text('narration').notNull(),
  uniqueReference: text('unique_reference').notNull().unique(),
  feeMinor: numeric('fee_minor', { precision: 28, scale: 0 }).default('0').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] }).default('pending').notNull(),
  statusReason: text('status_reason'),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  transferEntityIdx: index('idx_nuvion_transfers_entity').on(table.localEntityId, table.status),
}));

export const nuvionCards = pgTable('nuvion_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull(),
  accountId: text('account_id').notNull(),
  cardId: text('card_id').notNull().unique(),
  type: text('type', { enum: ['debit', 'prepaid', 'virtual'] }).notNull(),
  displayName: text('display_name'),
  cardholderName: text('cardholder_name').notNull(),
  brand: text('brand').default('VISA').notNull(),
  lastFour: text('last_four').notNull(),
  expiry: text('expiry').notNull(),
  status: text('status', { enum: ['pending', 'issued', 'active', 'blocked', 'cancelled'] }).default('pending').notNull(),
  spendingLimits: jsonb('spending_limits'),
  internationalSpending: boolean('international_spending').default(true).notNull(),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  cardEntityIdx: index('idx_nuvion_cards_entity').on(table.localEntityId, table.status),
}));

export const nuvionFundingSessions = pgTable('nuvion_funding_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull(),
  accountId: text('account_id').notNull(),
  fundingSessionId: text('funding_session_id').notNull().unique(),
  fundingType: text('funding_type', { enum: ['open-banking', 'momo', 'crypto'] }).notNull(),
  amountMinor: numeric('amount_minor', { precision: 28, scale: 0 }).notNull(),
  currency: text('currency').notNull(),
  uniqueReference: text('unique_reference').notNull().unique(),
  checkoutUrl: text('checkout_url'),
  checkoutId: text('checkout_id'),
  status: text('status', { enum: ['awaiting_user', 'processing', 'settled', 'failed', 'expired'] }).default('awaiting_user').notNull(),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  expiresAt: timestamp('expires_at'),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fundingEntityIdx: index('idx_nuvion_funding_entity').on(table.localEntityId, table.status),
}));

export const nuvionSavingsGoals = pgTable('nuvion_savings_goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  nuvionEntityId: text('nuvion_entity_id').notNull(),
  accountId: text('account_id').notNull(),
  goalId: text('goal_id').notNull().unique(),
  name: text('name').notNull(),
  targetAmountMinor: numeric('target_amount_minor', { precision: 28, scale: 0 }).notNull(),
  currentAmountMinor: numeric('current_amount_minor', { precision: 28, scale: 0 }).default('0').notNull(),
  currency: text('currency').default('USD').notNull(),
  targetDate: timestamp('target_date'),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }),
  status: text('status', { enum: ['active', 'completed', 'cancelled'] }).default('active').notNull(),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const providerDepositIntents = pgTable('provider_deposit_intents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  provider: text('provider', { enum: ['NUVION', 'BRAILS'] }).notNull(),
  providerEntityId: text('provider_entity_id').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  providerAccountDetailId: text('provider_account_detail_id'),
  fiatCurrency: text('fiat_currency').notNull(),
  fiatAmountMinor: numeric('fiat_amount_minor', { precision: 28, scale: 0 }).notNull(),
  destinationAsset: text('destination_asset').notNull().default('USC'),
  expectedDestinationMinor: numeric('expected_destination_minor', { precision: 28, scale: 0 }),
  quoteId: text('quote_id'),
  uniqueReference: text('unique_reference').notNull().unique(),
  status: text('status', { enum: ['QUOTED', 'AWAITING_FUNDS', 'SETTLED', 'FAILED', 'EXPIRED'] }).default('QUOTED').notNull(),
  expiresAt: timestamp('expires_at'),
  providerData: jsonb('provider_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const providerTransactions = pgTable('provider_transactions', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['NUVION', 'BRAILS'] }).notNull(),
  providerTransactionId: text('provider_transaction_id').notNull(),
  localEntityId: text('local_entity_id').notNull().references(() => entities.id),
  direction: text('direction', { enum: ['INFLOW', 'OUTFLOW'] }).notNull(),
  currency: text('currency').notNull(),
  amountMinor: numeric('amount_minor', { precision: 28, scale: 0 }).notNull(),
  status: text('status').notNull(),
  reference: text('reference'),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  providerTransactionIdx: uniqueIndex('idx_provider_transactions_resource').on(table.provider, table.providerTransactionId),
}));


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

// School administration and fee collection records.
export const schoolCampuses = pgTable('school_campuses', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  address: text('address'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schoolClasses = pgTable('school_classes', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  campusId: text('campus_id').references(() => schoolCampuses.id),
  name: text('name').notNull(),
  academicSession: text('academic_session'),
  term: text('term'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schoolStudents = pgTable('school_students', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  classId: text('class_id').notNull().references(() => schoolClasses.id),
  studentNumber: text('student_number').notNull(),
  fullName: text('full_name').notNull(),
  parentName: text('parent_name'),
  parentEmail: text('parent_email'),
  parentPhone: text('parent_phone'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  entityStudentNumberIdx: uniqueIndex('idx_school_students_entity_number').on(table.entityId, table.studentNumber),
}));

export const studentPaymentAccounts = pgTable('student_payment_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  studentId: text('student_id').notNull().references(() => schoolStudents.id),
  currency: text('currency').notNull(),
  mode: text('mode', { enum: ['SCHOOL_MASTER_REFERENCE'] }).notNull(),
  masterAccountId: text('master_account_id').notNull().references(() => accounts.id),
  paymentReference: text('payment_reference').notNull().unique(),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  studentCurrencyIdx: uniqueIndex('idx_student_payment_accounts_student_currency').on(table.studentId, table.currency),
}));

export const schoolFeeSchedules = pgTable('school_fee_schedules', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  classId: text('class_id').notNull().references(() => schoolClasses.id),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  dueDate: text('due_date'),
  academicSession: text('academic_session'),
  term: text('term'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schoolStaff = pgTable('school_staff', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  staffNumber: text('staff_number').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role'),
  department: text('department'),
  employmentType: text('employment_type').default('EMPLOYEE').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  entityStaffNumberIdx: uniqueIndex('idx_school_staff_entity_number').on(table.entityId, table.staffNumber),
}));

export const staffBankAccounts = pgTable('staff_bank_accounts', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull().references(() => schoolStaff.id),
  bankName: text('bank_name').notNull(),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  bankCode: text('bank_code'),
  isDefault: boolean('is_default').default(false).notNull(),
  status: text('status').default('PENDING_VERIFICATION').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schoolSavingsPolicies = pgTable('school_savings_policies', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  mode: text('mode', { enum: ['PERCENTAGE_OF_PAYMENT', 'MANUAL'] }).notNull(),
  percentage: numeric('percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  fixedAmount: numeric('fixed_amount', { precision: 18, scale: 2 }),
  targetAmount: numeric('target_amount', { precision: 18, scale: 2 }),
  currency: text('currency').notNull(),
  status: text('status', { enum: ['ACTIVE', 'DISABLED'] }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schoolApplications = pgTable('school_applications', {
  id: text('id').primaryKey(),
  schoolLegalName: text('school_legal_name').notNull(),
  registrationNumber: text('registration_number').notNull(),
  adminName: text('admin_name').notNull(),
  adminEmail: text('admin_email').notNull(),
  adminPhone: text('admin_phone').notNull(),
  country: text('country').notNull(),
  status: text('status', { enum: ['SUBMITTED', 'KYB_REVIEW', 'APPROVED', 'REJECTED'] }).default('SUBMITTED').notNull(),
  brailsCustomerId: text('brails_customer_id'),
  brailsStatus: text('brails_status'),
  brailsPayload: jsonb('brails_payload'),
  applicationData: jsonb('application_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  sourceAmount: numeric('source_amount', { precision: 28, scale: 18 }).notNull(),
  targetAmount: numeric('target_amount', { precision: 28, scale: 18 }).notNull(),
  feeAmount: numeric('fee_amount', { precision: 28, scale: 18 }).default('0.00').notNull(),
  direction: text('direction', { enum: ['CREDIT', 'DEBIT'] }).default('CREDIT').notNull(),
  paymentInstructions: text('payment_instructions'),
  settlementStatus: text('settlement_status', { enum: ['RECEIVED', 'QUOTED', 'SOURCE_SUBMITTED', 'INTENT_DEPOSITED', 'SETTLED_ON_BASE', 'LEDGER_CREDITED', 'FAILED', 'REFUNDED', 'MANUAL_REVIEW'] }).default('RECEIVED').notNull(),
  intentSwapId: text('intent_swap_id'),
  sourceTxHash: text('source_tx_hash'),
  intentFundingTxHash: text('intent_funding_tx_hash'),
  destinationTxHash: text('destination_tx_hash'),
  settledAsset: text('settled_asset'),
  settledAmount: numeric('settled_amount', { precision: 28, scale: 8 }),
  settlementError: text('settlement_error'),
  status: text('status', { enum: ['pending', 'completed', 'failed', 'expired', 'reversed'] }).default('pending').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const brailsCollections = pgTable('brails_collections', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  invoiceId: text('invoice_id').references(() => invoices.id),
  reference: text('reference').notNull().unique(),
  providerTransactionId: text('provider_transaction_id').unique(),
  providerAccountId: text('provider_account_id'),
  country: text('country', { enum: ['NG', 'KE', 'UG'] }).notNull(),
  currency: text('currency').notNull(),
  amountMinor: numeric('amount_minor', { precision: 28, scale: 0 }).notNull(),
  amountReceivedMinor: numeric('amount_received_minor', { precision: 28, scale: 0 }),
  mode: text('mode', { enum: ['STATIC_ACCOUNT', 'TRANSACTION_ACCOUNT'] }).notNull(),
  status: text('status', { enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REVERSED'] }).default('PENDING').notNull(),
  accountNumber: text('account_number'),
  bankName: text('bank_name'),
  expiresAt: timestamp('expires_at'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const brailsCards = pgTable('brails_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  entityId: text('entity_id').notNull().references(() => entities.id),
  accountKind: text('account_kind', { enum: ['PERSONAL', 'BUSINESS'] }).notNull(),
  provider: text('provider', { enum: ['BRAILS'] }).notNull().default('BRAILS'),
  providerCardId: text('provider_card_id').notNull().unique(),
  providerCardUserId: text('provider_card_user_id'),
  brand: text('brand').notNull(),
  cardType: text('card_type').notNull(),
  cardholderName: text('cardholder_name').notNull(),
  currency: text('currency').notNull(),
  balance: numeric('balance', { precision: 18, scale: 4 }).default('0.00').notNull(),
  status: text('status', { enum: ['PENDING', 'ACTIVE', 'FROZEN', 'TERMINATED', 'FAILED'] }).default('PENDING').notNull(),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }).default('0.00').notNull(),
  providerMetadata: jsonb('provider_metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  entityKindStatusIdx: index('idx_brails_cards_entity_status').on(table.entityId, table.status),
  userAccountKindIdx: index('idx_brails_cards_user_account_kind').on(table.userId, table.accountKind),
}));

// Platform Multi-Stream Fee & Revenue Ledger
export const feeLedger = pgTable('fee_ledger', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  transactionType: text('transaction_type', {
    enum: ['PAY_IN', 'INVOICE', 'PAYROLL', 'ALTCOIN_SWAP', 'OFF_RAMP', 'SUBSCRIPTION', 'YIELD'],
  }).notNull(),
  referenceId: text('reference_id').notNull(),
  grossAmount: numeric('gross_amount', { precision: 18, scale: 4 }).notNull(),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }).notNull(),
  netAmount: numeric('net_amount', { precision: 18, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  referenceIdx: uniqueIndex('idx_fee_ledger_reference').on(table.transactionType, table.referenceId),
}));

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
  withdrawalTxHash: text('withdrawal_tx_hash'),
  solanaRecipientAddress: text('solana_recipient_address'),
  sharesMinted: numeric('shares_minted', { precision: 28, scale: 8 }),
  harvestTxHash: text('harvest_tx_hash'),
  harvestIntentId: text('harvest_intent_id'),
  harvestFeeAmount: numeric('harvest_fee_amount', { precision: 18, scale: 6 }),
  harvestStatus: text('harvest_status', { enum: ['NOT_STARTED', 'REDEMPTION_SUBMITTED', 'FEE_PENDING', 'FEE_SUBMITTED', 'COMPLETED', 'FAILED'] }).default('NOT_STARTED').notNull(),
  status: text('status', { enum: ['PENDING_DEPOSIT', 'SOLVING', 'LOCKED', 'MATURED', 'EARLY_UNLOCKED', 'WITHDRAWN_EXTERNAL'] }).default('LOCKED').notNull(),
  onChainSyncTimestamp: timestamp('on_chain_sync_timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  intentIdx: uniqueIndex('idx_term_vaults_near_intent').on(table.nearIntentId),
  depositIdx: uniqueIndex('idx_term_vaults_deposit_address').on(table.depositAddress),
  harvestIntentIdx: uniqueIndex('idx_term_vaults_harvest_intent').on(table.harvestIntentId),
}));

// Tokenized Stocks & Real World Assets (Ondo Global Markets)
export const rwaPositions = pgTable('rwa_positions', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  shares: numeric('shares', { precision: 18, scale: 6 }).notNull(),
  reservedShares: numeric('reserved_shares', { precision: 18, scale: 6 }).default('0').notNull(),
  averageCostBasisUsd: numeric('average_cost_basis_usd', { precision: 18, scale: 4 }).notNull(),
  currentPriceUsd: numeric('current_price_usd', { precision: 18, scale: 4 }).notNull(),
  totalValueUsd: numeric('total_value_usd', { precision: 18, scale: 2 }).notNull(),
  network: text('network').default('BSC').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  entitySymbolIdx: uniqueIndex('idx_rwa_positions_entity_symbol').on(table.entityId, table.symbol),
}));

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
  quoteId: text('quote_id'),
  sourceChain: text('source_chain'),
  destinationChain: text('destination_chain'),
  failureReason: text('failure_reason'),
  status: text('status', { enum: ['PENDING_DEPOSIT', 'SUBMITTED', 'SOLVING', 'COMPLETED', 'FAILED', 'REFUNDED', 'RETRYING'] }).default('PENDING_DEPOSIT').notNull(),
  protocol: text('protocol', { enum: ['kamino_vault', 'cross_chain_swap', 'earn_vault'] }).default('cross_chain_swap').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  depositIdx: uniqueIndex('idx_intent_swaps_deposit_address').on(table.depositAddress),
}));

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

export const paymentRequests = pgTable('payment_requests', {
  id: text('id').primaryKey(),
  requesterEntityId: text('requester_entity_id').notNull().references(() => entities.id),
  payerEntityId: text('payer_entity_id').references(() => entities.id),
  payerUsername: text('payer_username'),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: text('currency').notNull(),
  narration: text('narration'),
  status: text('status', { enum: ['PENDING', 'PAID', 'DECLINED', 'EXPIRED'] }).default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
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

export const automationPolicies = pgTable('automation_policies', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  status: text('status', { enum: ['PENDING_SIGNATURE', 'ACTIVE', 'REVOKED', 'EXPIRED'] }).default('PENDING_SIGNATURE').notNull(),
  allowedAssets: text('allowed_assets').default('USDC,USDT').notNull(),
  allowedProtocols: text('allowed_protocols').default('pods,kamino,near_intent').notNull(),
  maxPerTransactionUsd: numeric('max_per_transaction_usd', { precision: 18, scale: 2 }).notNull(),
  maxDailyUsd: numeric('max_daily_usd', { precision: 18, scale: 2 }).notNull(),
  maxMonthlyUsd: numeric('max_monthly_usd', { precision: 18, scale: 2 }).notNull(),
  approvalReference: text('approval_reference'),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  entityIdx: uniqueIndex('idx_automation_policies_entity').on(table.entityId),
}));

export const gasSponsorships = pgTable('gas_sponsorships', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  relatedTransactionId: text('related_transaction_id'),
  chain: text('chain').notNull(),
  nativeAsset: text('native_asset').notNull(),
  userWallet: text('user_wallet').notNull(),
  treasuryWallet: text('treasury_wallet').notNull(),
  intentSwapId: text('intent_swap_id'),
  estimatedGasNative: numeric('estimated_gas_native', { precision: 28, scale: 18 }),
  requestedAmountNative: numeric('requested_amount_native', { precision: 28, scale: 18 }).notNull(),
  actualGasNative: numeric('actual_gas_native', { precision: 28, scale: 18 }),
  nativeUsdPrice: numeric('native_usd_price', { precision: 28, scale: 8 }),
  priceTimestamp: timestamp('price_timestamp'),
  reservedStablecoin: numeric('reserved_stablecoin', { precision: 28, scale: 8 }),
  chargedStablecoin: text('charged_stablecoin').default('USDC').notNull(),
  chargedAmount: numeric('charged_amount', { precision: 28, scale: 8 }),
  releasedAmount: numeric('released_amount', { precision: 28, scale: 8 }),
  fundingTxHash: text('funding_tx_hash'),
  userTxHash: text('user_tx_hash'),
  status: text('status', { enum: ['ESTIMATED', 'RESERVED', 'GAS_FUNDED', 'TRANSACTION_SUBMITTED', 'CONFIRMED', 'COST_CALCULATED', 'CHARGED', 'RESERVE_RELEASED', 'FUNDING_FAILED', 'TRANSACTION_FAILED', 'RECEIPT_TIMEOUT', 'PRICE_UNAVAILABLE', 'MANUAL_REVIEW', 'REQUESTED', 'FUNDED', 'EXECUTED', 'REFUNDED', 'FAILED'] }).default('ESTIMATED').notNull(),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  relatedTransactionIdx: uniqueIndex('idx_gas_sponsorships_related_transaction').on(table.relatedTransactionId),
}));

// Deposit Sync Cursor: Track last processed block/transaction per network to ensure idempotent deposit detection
export const depositSyncCursors = pgTable('deposit_sync_cursors', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  network: text('network').notNull(), // 'ethereum', 'base', 'solana', 'bitcoin', 'near', etc.
  lastProcessedBlockHeight: numeric('last_processed_block_height', { precision: 28, scale: 0 }).notNull().default('0'),
  lastProcessedTxHash: text('last_processed_tx_hash'), // For UTXO-based chains (Bitcoin), track last tx
  lastProcessedAt: timestamp('last_processed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  entityNetworkIdx: uniqueIndex('idx_deposit_sync_cursors_entity_network').on(table.entityId, table.network),
}));

// Raw Inbound Webhooks Store
export const rawWebhooks = pgTable('raw_webhooks', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: ['DUE', 'BRAILS'] }).notNull(),
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

// Developer & BaaS API Keys
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(), // e.g. px_live_sk_... (first 14 chars)
  hashedKey: text('hashed_key').notNull().unique(), // SHA-256 hash of the full secret key
  environment: text('environment', { enum: ['live', 'test'] }).default('live').notNull(),
  scopes: text('scopes').default('["invoices:all","wallets:all","payouts:all","reports:all","treasury:all"]').notNull(), // JSON string array of granted scopes
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Developer Webhook Endpoints (Outbound dispatch from Proxim)
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  url: text('url').notNull(),
  secret: text('secret').notNull(), // e.g. whsec_...
  events: text('events').default('["invoice.paid","payout.completed","deposit.detected","treasury.swept"]').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Developer API Request Logs
export const apiLogs = pgTable('api_logs', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  apiKeyId: text('api_key_id'),
  method: text('method').notNull(),
  endpoint: text('endpoint').notNull(),
  statusCode: integer('status_code').notNull(),
  ipAddress: text('ip_address'),
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Durable Outbox Delivery Log for Webhooks with Exponential Retries
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => entities.id),
  webhookEndpointId: text('webhook_endpoint_id').notNull().references(() => webhookEndpoints.id),
  event: text('event').notNull(),
  payload: text('payload').notNull(),
  signature: text('signature').notNull(),
  status: text('status', { enum: ['PENDING', 'DELIVERED', 'FAILED', 'RETRYING'] }).default('PENDING').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  nextAttemptAt: timestamp('next_attempt_at'),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Error Logs for centralized error tracking and escalation
export const errorLogs = pgTable('error_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  context: text('context').notNull(),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).default('low').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
