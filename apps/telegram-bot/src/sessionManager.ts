import bcrypt from 'bcryptjs';

export type EntityType = 'PERSONAL' | 'BUSINESS';

export interface PendingTransfer {
  type: 'TRANSFER';
  recipientName: string;
  bankNameOrCode?: string;
  accountNumber: string;
  amount: number;
  currency: string;
  narration?: string;
  feeMinor: number;
}

export interface PendingCardIssue {
  type: 'ISSUE_CARD';
  cardType: 'debit' | 'prepaid' | 'virtual';
  displayName: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
}

export interface PendingSavingsDeposit {
  type: 'SAVINGS_DEPOSIT';
  protocol: 'kamino' | 'ondo' | 'pods' | 'nuvion';
  goalName?: string;
  amount: number;
  currency: string;
}

export interface PendingInvoice {
  type: 'CREATE_INVOICE';
  clientName: string;
  clientEmail?: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
  currency: string;
  dueDate: string;
}

export type PendingAction =
  | PendingTransfer
  | PendingCardIssue
  | PendingSavingsDeposit
  | PendingInvoice;


export interface UserSession {
  chatId: number;
  telegramUserId: number;
  username?: string;
  activeEntity: EntityType;
  step: 'IDLE' | 'AWAITING_PIN' | 'AWAITING_PARAM' | 'AWAITING_KYC_DOC' | 'AWAITING_KYC_INPUT';
  pendingAction?: PendingAction;
  pinHash?: string;
  pinAttempts: number;
  lockedUntil?: number;
  lastActive: number;
  localEntityId?: string;
  businessEntityId?: string;
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED';
  mpcPersonalBaseAddress: string;
  mpcPersonalNearAddress: string;
  mpcPersonalSolanaAddress: string;
  mpcPersonalBtcAddress: string;
  mpcPersonalTronAddress: string;
  mpcPersonalTonAddress: string;
  mpcPersonalSuiAddress: string;
  mpcPersonalAptosAddress: string;
  mpcPersonalCosmosAddress: string;
  mpcPersonalXrpAddress: string;
  mpcBusinessBaseAddress: string;
  mpcBusinessNearAddress: string;
  mpcBusinessSolanaAddress: string;
  mpcBusinessBtcAddress: string;
  mpcBusinessTronAddress: string;
  mpcBusinessTonAddress: string;
  mpcBusinessSuiAddress: string;
  mpcBusinessAptosAddress: string;
  mpcBusinessCosmosAddress: string;
  mpcBusinessXrpAddress: string;
}

import { liveDataService } from './liveDataService.js';

export class SessionManager {
  private sessions = new Map<number, UserSession>();
  private readonly INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_PIN_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minute lockout

  public async getSessionAsync(chatId: number, telegramUserId: number, username?: string): Promise<UserSession> {
    if (chatId !== telegramUserId) throw new Error('Financial Telegram sessions are only available in private chats');
    const now = Date.now();
    const sessionKey = telegramUserId;
    let session = this.sessions.get(sessionKey);

    if (!session) {
      const dbEntities = await liveDataService.getOrCreateUserEntities(telegramUserId, username);

      session = {
        chatId,
        telegramUserId,
        username,
        activeEntity: 'PERSONAL',
        step: 'IDLE',
        pinAttempts: 0,
        lastActive: now,
        localEntityId: dbEntities.personalEntityId,
        businessEntityId: dbEntities.businessEntityId,
        kycStatus: dbEntities.kycStatus,
        mpcPersonalBaseAddress: dbEntities.personalMpc.evmAddress,
        mpcPersonalNearAddress: dbEntities.personalMpc.nearNamedAddress,
        mpcPersonalSolanaAddress: dbEntities.personalMpc.solanaAddress,
        mpcPersonalBtcAddress: dbEntities.personalMpc.btcAddress,
        mpcPersonalTronAddress: dbEntities.personalMpc.tronAddress || '',
        mpcPersonalTonAddress: dbEntities.personalMpc.tonAddress || '',
        mpcPersonalSuiAddress: dbEntities.personalMpc.suiAddress || '',
        mpcPersonalAptosAddress: dbEntities.personalMpc.aptosAddress || '',
        mpcPersonalCosmosAddress: dbEntities.personalMpc.cosmosAddress || '',
        mpcPersonalXrpAddress: dbEntities.personalMpc.xrpAddress || '',

        mpcBusinessBaseAddress: dbEntities.businessMpc.evmAddress,
        mpcBusinessNearAddress: dbEntities.businessMpc.nearNamedAddress,
        mpcBusinessSolanaAddress: dbEntities.businessMpc.solanaAddress,
        mpcBusinessBtcAddress: dbEntities.businessMpc.btcAddress,
        mpcBusinessTronAddress: dbEntities.businessMpc.tronAddress || '',
        mpcBusinessTonAddress: dbEntities.businessMpc.tonAddress || '',
        mpcBusinessSuiAddress: dbEntities.businessMpc.suiAddress || '',
        mpcBusinessAptosAddress: dbEntities.businessMpc.aptosAddress || '',
        mpcBusinessCosmosAddress: dbEntities.businessMpc.cosmosAddress || '',
        mpcBusinessXrpAddress: dbEntities.businessMpc.xrpAddress || '',
      };
      this.sessions.set(sessionKey, session);
      return session;
    }

    if (now - session.lastActive > this.INACTIVITY_TIMEOUT_MS) {
      session.step = 'IDLE';
      session.pendingAction = undefined;
    }

    session.lastActive = now;
    if (username) session.username = username;
    return session;
  }

  public getSession(chatId: number, telegramUserId: number, username?: string): UserSession {
    if (chatId !== telegramUserId) throw new Error('Financial Telegram sessions are only available in private chats');
    const now = Date.now();
    let session = this.sessions.get(telegramUserId);

    if (!session) {
      throw new Error('Synchronous Telegram sessions require an existing authenticated session; use getSessionAsync for new users.');

      /*
      const personalMpc = deriveTelegramMpcAddress(telegramUserId, 'personal');
      const businessMpc = deriveTelegramMpcAddress(telegramUserId, 'business');
      session = {
        chatId,
        telegramUserId,
        username,
        activeEntity: 'PERSONAL',
        step: 'IDLE',
        pinAttempts: 0,
        lastActive: now,
        localEntityId: `ent_tg_${telegramUserId}_personal`,
        businessEntityId: `ent_tg_${telegramUserId}_business`,
        kycStatus: 'UNVERIFIED',
        mpcPersonalBaseAddress: personalMpc.baseAddress,
        mpcPersonalNearAddress: personalMpc.nearAddress,
        mpcPersonalSolanaAddress: personalMpc.solanaAddress,
        mpcPersonalBtcAddress: personalMpc.btcAddress,
        mpcPersonalTronAddress: personalMpc.tronAddress,
        mpcPersonalTonAddress: personalMpc.tonAddress,
        mpcPersonalSuiAddress: personalMpc.suiAddress,
        mpcPersonalAptosAddress: personalMpc.aptosAddress,
        mpcPersonalCosmosAddress: personalMpc.cosmosAddress,
        mpcPersonalXrpAddress: personalMpc.xrpAddress,

        mpcBusinessBaseAddress: businessMpc.baseAddress,
        mpcBusinessNearAddress: businessMpc.nearAddress,
        mpcBusinessSolanaAddress: businessMpc.solanaAddress,
        mpcBusinessBtcAddress: businessMpc.btcAddress,
        mpcBusinessTronAddress: businessMpc.tronAddress,
        mpcBusinessTonAddress: businessMpc.tonAddress,
        mpcBusinessSuiAddress: businessMpc.suiAddress,
        mpcBusinessAptosAddress: businessMpc.aptosAddress,
        mpcBusinessCosmosAddress: businessMpc.cosmosAddress,
        mpcBusinessXrpAddress: businessMpc.xrpAddress,
      };
      this.sessions.set(chatId, session);

      // Async DB and MPC sync in background
      liveDataService.getOrCreateUserEntities(telegramUserId, username).then((dbEntities) => {
        if (session) {
          session.localEntityId = dbEntities.personalEntityId;
          session.businessEntityId = dbEntities.businessEntityId;
          session.kycStatus = dbEntities.kycStatus;
          session.mpcPersonalBaseAddress = dbEntities.personalMpc.evmAddress;
          session.mpcPersonalNearAddress = dbEntities.personalMpc.nearNamedAddress;
          session.mpcPersonalSolanaAddress = dbEntities.personalMpc.solanaAddress || session.mpcPersonalSolanaAddress;
          session.mpcPersonalBtcAddress = dbEntities.personalMpc.btcAddress || session.mpcPersonalBtcAddress;
          session.mpcPersonalTronAddress = dbEntities.personalMpc.tronAddress || session.mpcPersonalTronAddress;
          session.mpcPersonalTonAddress = dbEntities.personalMpc.tonAddress || session.mpcPersonalTonAddress;
          session.mpcPersonalSuiAddress = dbEntities.personalMpc.suiAddress || session.mpcPersonalSuiAddress;
          session.mpcPersonalAptosAddress = dbEntities.personalMpc.aptosAddress || session.mpcPersonalAptosAddress;
          session.mpcPersonalCosmosAddress = dbEntities.personalMpc.cosmosAddress || session.mpcPersonalCosmosAddress;
          session.mpcPersonalXrpAddress = dbEntities.personalMpc.xrpAddress || session.mpcPersonalXrpAddress;

          session.mpcBusinessBaseAddress = dbEntities.businessMpc.evmAddress;
          session.mpcBusinessNearAddress = dbEntities.businessMpc.nearNamedAddress;
          session.mpcBusinessSolanaAddress = dbEntities.businessMpc.solanaAddress || session.mpcBusinessSolanaAddress;
          session.mpcBusinessBtcAddress = dbEntities.businessMpc.btcAddress || session.mpcBusinessBtcAddress;
          session.mpcBusinessTronAddress = dbEntities.businessMpc.tronAddress || session.mpcBusinessTronAddress;
          session.mpcBusinessTonAddress = dbEntities.businessMpc.tonAddress || session.mpcBusinessTonAddress;
          session.mpcBusinessSuiAddress = dbEntities.businessMpc.suiAddress || session.mpcBusinessSuiAddress;
          session.mpcBusinessAptosAddress = dbEntities.businessMpc.aptosAddress || session.mpcBusinessAptosAddress;
          session.mpcBusinessCosmosAddress = dbEntities.businessMpc.cosmosAddress || session.mpcBusinessCosmosAddress;
          session.mpcBusinessXrpAddress = dbEntities.businessMpc.xrpAddress || session.mpcBusinessXrpAddress;
        }
      }).catch((e) => console.warn('[SessionManager] DB/MPC sync note:', e.message));

      return session;
      */
    }



    if (now - session.lastActive > this.INACTIVITY_TIMEOUT_MS) {
      session.step = 'IDLE';
      session.pendingAction = undefined;
    }

    session.lastActive = now;
    if (username) session.username = username;
    return session;
  }

  public getActiveEntityId(session: UserSession): string {
    const entityId = session.activeEntity === 'BUSINESS' ? session.businessEntityId : session.localEntityId;
    if (!entityId) throw new Error('Authenticated session has no active entity');
    return entityId;
  }


  public switchEntity(chatId: number, targetEntity?: EntityType): EntityType {
    const session = this.sessions.get(chatId);
    if (!session) return 'PERSONAL';

    if (targetEntity) {
      session.activeEntity = targetEntity;
    } else {
      session.activeEntity = session.activeEntity === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL';
    }
    return session.activeEntity;
  }

  public setPendingAction(chatId: number, action: PendingAction) {
    const session = this.sessions.get(chatId);
    if (session) {
      session.pendingAction = action;
      session.step = 'AWAITING_PIN';
    }
  }

  public clearPendingAction(chatId: number) {
    const session = this.sessions.get(chatId);
    if (session) {
      session.pendingAction = undefined;
      session.step = 'IDLE';
    }
  }

  public async setPin(chatId: number, plainPin: string): Promise<boolean> {
    if (!/^\d{4,6}$/.test(plainPin)) return false;
    const session = this.sessions.get(chatId);
    if (session) {
      session.pinHash = await bcrypt.hash(plainPin, 10);
      session.pinAttempts = 0;
      session.lockedUntil = undefined;
      return true;
    }
    return false;
  }

  public async verifyPin(chatId: number, inputPin: string): Promise<{ success: boolean; locked: boolean; remainingAttempts: number }> {
    const session = this.sessions.get(chatId);
    if (!session) return { success: false, locked: false, remainingAttempts: 0 };

    const now = Date.now();
    if (session.lockedUntil && now < session.lockedUntil) {
      return { success: false, locked: true, remainingAttempts: 0 };
    }

    if (!session.pinHash) {
      return { success: false, locked: false, remainingAttempts: 0 };
    }

    const targetHash = session.pinHash;
    const isMatch = await bcrypt.compare(inputPin, targetHash);

    if (isMatch) {
      session.pinAttempts = 0;
      session.lockedUntil = undefined;
      return { success: true, locked: false, remainingAttempts: this.MAX_PIN_ATTEMPTS };
    }

    session.pinAttempts += 1;
    const remaining = Math.max(0, this.MAX_PIN_ATTEMPTS - session.pinAttempts);

    if (session.pinAttempts >= this.MAX_PIN_ATTEMPTS) {
      session.lockedUntil = now + this.LOCKOUT_DURATION_MS;
      session.pendingAction = undefined;
      session.step = 'IDLE';
      return { success: false, locked: true, remainingAttempts: 0 };
    }

    return { success: false, locked: false, remainingAttempts: remaining };
  }
}

export const sessionManager = new SessionManager();
