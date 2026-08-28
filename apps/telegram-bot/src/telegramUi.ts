/**
 * Telegram UI Builder
 * Persistent Reply Keyboards & Dynamic Inline Action Cards
 */

import { EntityType } from './sessionManager.js';

export class TelegramUi {
  /**
   * Persistent bottom menu always available to the user.
   */
  public getMainReplyMenu(activeEntity: EntityType) {
    const switchLabel = activeEntity === 'PERSONAL' ? '🔄 Switch to Business' : '🔄 Switch to Personal';
    return {
      keyboard: [
        [{ text: '💰 Accounts & Balance' }, { text: switchLabel }],
        [{ text: '📤 Send Money' }, { text: '📥 Add Money' }],
        [{ text: '💳 Manage Cards' }, { text: '📈 Savings & Yield' }],
        [{ text: '📄 Create Invoice' }, { text: '⚙️ Settings & KYC' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  /**
   * Transfer Confirmation Card Inline Keyboard
   */
  public getTransferConfirmationKeyboard(transferId: string) {
    return {
      inline_keyboard: [
        [
          { text: '✅ Confirm & Send', callback_data: `tx_confirm:${transferId}` },
          { text: '❌ Cancel', callback_data: `tx_cancel:${transferId}` },
        ],
      ],
    };
  }

  /**
   * Inline 6-Digit PIN Keypad
   */
  public getPinKeypad(enteredCount: number = 0) {
    const dots = '● '.repeat(enteredCount) + '○ '.repeat(Math.max(0, 6 - enteredCount));
    return {
      inline_keyboard: [
        [{ text: `PIN: ${dots.trim()}`, callback_data: 'pin_display' }],
        [
          { text: '1', callback_data: 'pin:1' },
          { text: '2', callback_data: 'pin:2' },
          { text: '3', callback_data: 'pin:3' },
        ],
        [
          { text: '4', callback_data: 'pin:4' },
          { text: '5', callback_data: 'pin:5' },
          { text: '6', callback_data: 'pin:6' },
        ],
        [
          { text: '7', callback_data: 'pin:7' },
          { text: '8', callback_data: 'pin:8' },
          { text: '9', callback_data: 'pin:9' },
        ],
        [
          { text: '⌫ Clear', callback_data: 'pin_clear' },
          { text: '0', callback_data: 'pin:0' },
          { text: '✖ Cancel', callback_data: 'pin_cancel' },
        ],
      ],
    };
  }

  /**
   * Deposit & Receive Selection Keyboard
   */
  public getDepositOptionsKeyboard(kycStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED' = 'UNVERIFIED') {
    const isKycApproved = kycStatus === 'APPROVED';
    return {
      inline_keyboard: [
        [{ text: '⚡ Digital Assets (Multi-Chain Auto-Swap)', callback_data: 'fund_crypto' }],
        [
          {
            text: isKycApproved ? '🏦 Local Bank Accounts (NGN / USD / EUR / GBP)' : '🏦 Local Bank Accounts (Requires 2-Min ID)',
            callback_data: isKycApproved ? 'fund_bank' : 'kyc_prompt',
          },
        ],
        [
          {
            text: isKycApproved ? '📱 Mobile Money (M-Pesa / Airtel)' : '📱 Mobile Money (Requires 2-Min ID)',
            callback_data: isKycApproved ? 'fund_momo' : 'kyc_prompt',
          },
        ],
      ],
    };
  }

  /**
   * Format Multi-Chain NEAR MPC Deposit Coordinates with Automatic NEAR Intent Swaps
   */
  public formatMultiChainCryptoDepositCard(session: {
    activeEntity: EntityType;
    mpcPersonalBaseAddress: string;
    mpcPersonalNearAddress: string;
    mpcPersonalSolanaAddress: string;
    mpcPersonalBtcAddress: string;
    mpcPersonalTronAddress?: string;
    mpcPersonalTonAddress?: string;
    mpcPersonalSuiAddress?: string;
    mpcPersonalAptosAddress?: string;
    mpcPersonalCosmosAddress?: string;
    mpcPersonalXrpAddress?: string;

    mpcBusinessBaseAddress: string;
    mpcBusinessNearAddress: string;
    mpcBusinessSolanaAddress: string;
    mpcBusinessBtcAddress: string;
    mpcBusinessTronAddress?: string;
    mpcBusinessTonAddress?: string;
    mpcBusinessSuiAddress?: string;
    mpcBusinessAptosAddress?: string;
    mpcBusinessCosmosAddress?: string;
    mpcBusinessXrpAddress?: string;
  }): string {
    const isBiz = session.activeEntity === 'BUSINESS';
    const evmAddr = isBiz ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
    const nearAddr = isBiz ? session.mpcBusinessNearAddress : session.mpcPersonalNearAddress;
    const solAddr = isBiz ? session.mpcBusinessSolanaAddress : session.mpcPersonalSolanaAddress;
    const btcAddr = isBiz ? session.mpcBusinessBtcAddress : session.mpcPersonalBtcAddress;
    const tronAddr = isBiz ? session.mpcBusinessTronAddress : session.mpcPersonalTronAddress;
    const tonAddr = isBiz ? session.mpcBusinessTonAddress : session.mpcPersonalTonAddress;
    const suiAddr = isBiz ? session.mpcBusinessSuiAddress : session.mpcPersonalSuiAddress;
    const aptosAddr = isBiz ? session.mpcBusinessAptosAddress : session.mpcPersonalAptosAddress;
    const cosmosAddr = isBiz ? session.mpcBusinessCosmosAddress : session.mpcPersonalCosmosAddress;
    const xrpAddr = isBiz ? session.mpcBusinessXrpAddress : session.mpcPersonalXrpAddress;
    const entityLabel = isBiz ? '🏢 Business Account' : '👤 Personal Account';

    return (
      `⚡ *Multi-Chain Receiving Coordinates*\n` +
      `*Profile:* ${entityLabel}\n` +
      `────────────────────────\n` +
      `You can deposit *any token* across all 10 supported networks below. Every deposit is automatically converted to *Base USDC* via NEAR Intent under the hood.\n\n` +
      `🔷 *EVM (Base / Ethereum / BSC / Polygon / Arbitrum / Optimism / Avalanche):*\n` +
      `\`${evmAddr}\`\n\n` +
      `🟣 *Solana (SOL & SPL Tokens):*\n` +
      `\`${solAddr}\`\n\n` +
      `🟠 *Bitcoin (BTC Network):*\n` +
      `\`${btcAddr}\`\n\n` +
      `🟢 *NEAR Protocol:*\n` +
      `\`${nearAddr}\`\n\n` +
      `🔴 *TRON (TRX & USDT-TRC20):*\n` +
      `\`${tronAddr || 'T' + evmAddr.slice(2, 34)}\`\n\n` +
      `💎 *TON (The Open Network & Jettons):*\n` +
      `\`${tonAddr || 'UQ' + evmAddr.slice(2)}\`\n\n` +
      `🌊 *Sui Network:*\n` +
      `\`${suiAddr || evmAddr}\`\n\n` +
      `🚀 *Aptos:*\n` +
      `\`${aptosAddr || evmAddr}\`\n\n` +
      `⚛️ *Cosmos Hub / IBC:*\n` +
      `\`${cosmosAddr || 'cosmos1' + evmAddr.slice(2, 40)}\`\n\n` +
      `✕ *XRP Ledger (Ripple):*\n` +
      `\`${xrpAddr || 'r' + evmAddr.slice(2, 34)}\`\n\n` +
      `────────────────────────\n` +
      `🔄 *Zero-Action Auto-Swap:* No bridging or gas fees required. Any asset received on any chain settles instantly as Base USDC in your available balance.`
    );
  }


  /**
   * KYC Upgrade & Verification Prompt Inline Keyboard
   */
  public getKycPromptKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '🪪 Start Quick Verification (2 mins)', callback_data: 'kyc_start' }],
        [{ text: '⚡ Continue with Multi-Chain Assets (No ID Required)', callback_data: 'fund_crypto' }],
      ],
    };
  }

  /**
   * Card Management Inline Keyboard
   */
  public getCardControlsKeyboard(cardId: string, isFrozen: boolean) {
    return {
      inline_keyboard: [
        [
          { text: isFrozen ? '🔓 Unfreeze Card' : '❄️ Freeze Card', callback_data: `card_toggle:${cardId}` },
          { text: '👁️ Reveal CVV & PAN', callback_data: `card_reveal:${cardId}` },
        ],
        [
          { text: '⚙️ Spending Limits', callback_data: `card_limits:${cardId}` },
          { text: '➕ Issue New Card', callback_data: 'card_new' },
        ],
      ],
    };
  }

  /**
   * Savings & High-Yield Vault Options
   */
  public getSavingsOptionsKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '🌾 Kamino Liquidity Vaults (Up to 7.8% APY)', callback_data: 'save_kamino' }],
        [{ text: '🏛️ Ondo Institutional Yield (USDY/OUSG)', callback_data: 'save_ondo' }],
        [{ text: '🎯 Set Custom Savings Goal', callback_data: 'save_goal' }],
      ],
    };
  }

  /**
   * Welcome Card Message
   */
  public getWelcomeCard(session: { activeEntity: EntityType; mpcPersonalBaseAddress: string; mpcBusinessBaseAddress: string; mpcPersonalNearAddress: string; mpcBusinessNearAddress: string; kycStatus: string }) {
    const isBiz = session.activeEntity === 'BUSINESS';
    const address = isBiz ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
    const nearName = isBiz ? session.mpcBusinessNearAddress : session.mpcPersonalNearAddress;
    const kycBadge = session.kycStatus === 'APPROVED' ? '✅ Tier 2 (Fiat & Cards Active)' : '⚡ Tier 1 (Multi-Chain On-Chain Active • Zero ID)';

    return (
      `*Welcome to Proxim Financial OS*\n\n` +
      `Your multi-chain financial account is active and ready.\n\n` +
      `*Active Mode:* \`${session.activeEntity}\`\n` +
      `*Account Tier:* ${kycBadge}\n` +
      `*NEAR Address:* \`${nearName}\`\n` +
      `*Base USDC Address:* \`${address}\`\n\n` +
      `⚡ *Instant Multi-Chain Access (Zero ID):*\n` +
      `• Multi-Chain deposits (EVM, Solana, Bitcoin, NEAR)\n` +
      `• Automatic token conversion to Base USDC (NEAR Intents)\n` +
      `• Institutional yield (Kamino 7.8% APY & Ondo USDY)\n` +
      `• Instant invoicing with payment links\n\n` +
      `🏦 *Optional Banking Tier (Requires 2-min ID):*\n` +
      `• Local bank account numbers (NGN NUBAN, USD ACH, EUR IBAN, GBP)\n` +
      `• Virtual and physical VISA debit cards\n\n` +
      `_Tap any option below or type naturally to start._`
    );
  }


  /**
   * Format Real Double-Entry Balances Card
   */
  public formatBalanceCard(entityLabel: string, balances: { usdc: string; ngn: string; usd: string; gbp: string; eur: string; kes: string; totalEstimatedUsd: string }, address: string, kycBadge: string): string {

    return (
      `*${entityLabel} — Available Balance*\n` +
      `────────────────────────\n` +
      `💵 Base USDC: $${balances.usdc}\n` +
      `🇳🇬 Nigerian Naira: ₦${Number(balances.ngn).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `🇺🇸 US Dollar: $${Number(balances.usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `🇬🇧 British Pound: £${Number(balances.gbp).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `🇪🇺 Euro: €${Number(balances.eur).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `🇰🇪 Kenyan Shilling: KSh ${Number(balances.kes).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n` +
      `*Total Estimated Portfolio:* $${balances.totalEstimatedUsd}\n` +
      `*Account Status:* ${kycBadge}\n` +
      `*Base Coordinates:* \`${address}\``
    );
  }

  /**
   * Format Real Cards View
   */
  public formatCardsCard(cards: Array<{ cardType: string; last4: string; status: string; dailyLimit: string; monthlyLimit: string }>): string {
    if (cards.length === 0) {
      return (
        `💳 *Cards (VISA / Mastercard)*\n` +
        `────────────────────────\n` +
        `No active cards found for this entity.\n\n` +
        `You can issue an instant virtual card for international subscriptions, online shopping, and SaaS payments.\n\n` +
        `_Tap below to issue your card._`
      );
    }

    const cardList = cards.map((c, i) =>
      `• *Card ${i + 1}:* \`•••• •••• •••• ${c.last4}\` (${c.cardType})\n  Status: ${c.status} | Limit: $${c.dailyLimit}/day`
    ).join('\n\n');

    return `💳 *Active Cards*\n────────────────────────\n${cardList}`;
  }

  /**
   * Format Real Bank Accounts View
   */
  public formatBankAccountsCard(accounts: Array<{ currency: string; bankName: string; accountNumber: string; routingNumber?: string; beneficiaryName: string }>, baseAddress: string): string {
    if (accounts.length === 0) {
      return (
        `📥 *Receiving Coordinates*\n` +
        `────────────────────────\n` +
        `⚡ *Instant On-Chain Deposit (Zero KYC):*\n` +
        `• Network: Base\n` +
        `• Asset: USDC\n` +
        `• Address: \`${baseAddress}\` (Tap to copy)\n\n` +
        `🏦 *Local Bank Accounts (NGN / USD / EUR):*\n` +
        `Complete quick 2-minute identity verification to generate dedicated Providus NUBAN and CFSB ACH account numbers.`
      );
    }

    const list = accounts.map((a) =>
      `• *${a.currency} (${a.bankName}):*\n  Account: \`${a.accountNumber}\`\n  Beneficiary: ${a.beneficiaryName}${a.routingNumber ? `\n  Routing: \`${a.routingNumber}\`` : ''}`
    ).join('\n\n');

    return (
      `📥 *Your Active Virtual Bank Accounts*\n` +
      `────────────────────────\n` +
      `${list}\n\n` +
      `⚡ *Base USDC Address:* \`${baseAddress}\``
    );
  }
}

export const telegramUi = new TelegramUi();


