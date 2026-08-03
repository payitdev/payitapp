export interface LedgerEntryInput {
  entityId: string;
  ledgerAccountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

export interface TransactionPostingInput {
  transactionId: string;
  transactionType: 'PAYMENT' | 'INVOICE_SETTLEMENT' | 'CARD_SPEND' | 'INTERNAL_ENTITY_TRANSFER';
  entries: LedgerEntryInput[];
}

export interface LedgerAccountState {
  id: string;
  entityId: string;
  name: string;
  balance: number;
}

export class LedgerEngine {
  private accountsStore: Map<string, LedgerAccountState> = new Map();
  private entriesStore: Array<{
    id: string;
    entityId: string;
    transactionId: string;
    ledgerAccountId: string;
    type: 'DEBIT' | 'CREDIT';
    amount: number;
    createdAt: Date;
  }> = [];

  constructor() {}

  public registerAccount(account: LedgerAccountState): void {
    if (!account.entityId) {
      throw new Error('Mandatory non-nullable entity_id missing on ledger_account');
    }
    this.accountsStore.set(account.id, { ...account });
  }

  public getAccountBalance(ledgerAccountId: string, entityId: string): number {
    const acc = this.accountsStore.get(ledgerAccountId);
    if (!acc) throw new Error(`Ledger account ${ledgerAccountId} not found`);
    if (acc.entityId !== entityId) {
      throw new Error(`Cross-entity access violation: Account entity ${acc.entityId} does not match requested entity ${entityId}`);
    }
    return acc.balance;
  }

  public postTransaction(input: TransactionPostingInput): void {
    if (!input.entries || input.entries.length < 2) {
      throw new Error('Double-entry accounting requires at least 2 entries (debit & credit)');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of input.entries) {
      if (!entry.entityId) {
        throw new Error('Mandatory non-nullable entity_id missing on ledger_entry');
      }
      if (entry.amount <= 0) {
        throw new Error('Ledger entry amount must be greater than zero');
      }

      const account = this.accountsStore.get(entry.ledgerAccountId);
      if (!account) {
        throw new Error(`Ledger account ${entry.ledgerAccountId} not found`);
      }

      // CRITICAL: Fund separation check - entry entity_id must match account entity_id
      if (account.entityId !== entry.entityId) {
        throw new Error(`CRITICAL FUND SEPARATION VIOLATION: Entry entity_id (${entry.entityId}) does not match Account entity_id (${account.entityId})`);
      }

      if (entry.type === 'DEBIT') totalDebit += entry.amount;
      if (entry.type === 'CREDIT') totalCredit += entry.amount;
    }

    // Floating-point equality check using fixed precision
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new Error(`Unbalanced double-entry transaction! Debits: ${totalDebit}, Credits: ${totalCredit}`);
    }

    // Apply entries atomically
    for (const entry of input.entries) {
      const account = this.accountsStore.get(entry.ledgerAccountId)!;
      if (entry.type === 'DEBIT') {
        account.balance -= entry.amount;
      } else {
        account.balance += entry.amount;
      }

      this.entriesStore.push({
        id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entityId: entry.entityId,
        transactionId: input.transactionId,
        ledgerAccountId: entry.ledgerAccountId,
        type: entry.type,
        amount: entry.amount,
        createdAt: new Date(),
      });
    }
  }

  /**
   * Explicit Inter-Entity Transfer Ledgering (Personal <-> Business self-transfers)
   * Posts as two full, audited double-entry transactions (outbound from source, inbound to target).
   */
  public postInterEntityTransfer(params: {
    transactionId: string;
    sourceEntityId: string;
    sourceAccountId: string;
    targetEntityId: string;
    targetAccountId: string;
    amount: number;
  }): void {
    if (params.sourceEntityId === params.targetEntityId) {
      throw new Error('Inter-entity transfer requires two distinct entities');
    }

    // Transaction 1: Source Entity Outbound (Debit Cash/Account, Credit Transfer Out)
    this.postTransaction({
      transactionId: `${params.transactionId}_OUT`,
      transactionType: 'INTERNAL_ENTITY_TRANSFER',
      entries: [
        { entityId: params.sourceEntityId, ledgerAccountId: params.sourceAccountId, type: 'DEBIT', amount: params.amount },
        { entityId: params.sourceEntityId, ledgerAccountId: `${params.sourceEntityId}_CLEARING`, type: 'CREDIT', amount: params.amount },
      ],
    });

    // Transaction 2: Target Entity Inbound (Debit Transfer In, Credit Cash/Account)
    this.postTransaction({
      transactionId: `${params.transactionId}_IN`,
      transactionType: 'INTERNAL_ENTITY_TRANSFER',
      entries: [
        { entityId: params.targetEntityId, ledgerAccountId: `${params.targetEntityId}_CLEARING`, type: 'DEBIT', amount: params.amount },
        { entityId: params.targetEntityId, ledgerAccountId: params.targetAccountId, type: 'CREDIT', amount: params.amount },
      ],
    });
  }
}
