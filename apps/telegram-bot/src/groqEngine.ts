import { UserSession } from './sessionManager.js';
import { invoiceImageRenderer } from './invoiceImageRenderer.js';
import { liveDataService } from './liveDataService.js';

export interface ToolCallResult {
  messageText: string;
  keyboard?: any;
  actionRequired?: any;
  photoSvg?: string;
}

export class GroqEngine {
  private groqApiKey = process.env.GROQ_API_KEY || '';


  /**
   * System persona enforcing Invisible Crypto Principles & calm banking tone.
   */
  private readonly SYSTEM_PROMPT = `
You are Proxim AI, a calm, intelligent, and premium banking assistant for a Telegram-native multi-currency financial OS.
Key Guidelines:
1. Tone: Calm, confident, helpful, and transparent. Never use hype words ("Boom!", "Awesome!", "Congratulations!").
2. Invisible Crypto Principle: NEVER use technical crypto terms (Blockchain, Wallet Address, Gas Fee, Network, Token, Bridge, RPC, Smart Contract, Layer 2, Private Key, Seed Phrase, Chain, Mainnet).
3. Standard terms: "Send Money", "Available Balance", "Cards", "Savings", "Deposit Funds", "Where should we send it?".
4. Always request interactive confirmation before executing outbound payments or card creations.
`;

  /**
   * Transcribe Telegram voice memo using Groq Whisper-large-v3
   */
  public async transcribeVoiceNote(audioBuffer: Buffer): Promise<string> {
    if (!this.groqApiKey) {
      return '';
    }

    try {
      const formData = new FormData();
      const uint8 = new Uint8Array(audioBuffer);
      formData.append('file', new Blob([uint8]), 'voice.ogg');
      formData.append('model', 'whisper-large-v3');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.groqApiKey}` },
        body: formData,
      });

      const data = await response.json();
      return data.text || '';
    } catch {
      return '';
    }
  }

  /**
   * Natural Language Intent & Tool-Calling Dispatcher
   */
  public async processMessage(
    userText: string,
    session: UserSession
  ): Promise<ToolCallResult> {
    const text = userText.trim();
    const entityLabel = session.activeEntity === 'PERSONAL' ? 'Personal Account' : 'Business Account';
    const entityId = session.activeEntity === 'BUSINESS'
      ? (session.businessEntityId || `ent_tg_${session.telegramUserId}_business`)
      : (session.localEntityId || `ent_tg_${session.telegramUserId}_personal`);
    const mpcAddress = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
    const nearName = session.activeEntity === 'BUSINESS' ? session.mpcBusinessNearAddress : session.mpcPersonalNearAddress;

    // 1. Check for Entity Switching Intent
    if (/switch\s+to\s+(business|personal)/i.test(text) || text.includes('Switch Account') || text.includes('Switch to')) {
      const target = /business/i.test(text) ? 'BUSINESS' : 'PERSONAL';
      session.activeEntity = target;
      const nextAddress = target === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      return {
        messageText: `Switched to **${target === 'PERSONAL' ? '👤 Personal Account' : '🏢 Business Account'}**.\nBase Coordinates: \`${nextAddress}\`\nAll balances and payments are now active under this entity.`,
      };
    }

    // 2. Check for Balance / Accounts Request (Live DB Query)
    if (/balance|how\s+much|accounts|portfolio|my\s+money/i.test(text)) {
      const balances = await liveDataService.getEntityBalances(entityId);
      const kycBadge = session.kycStatus === 'APPROVED' ? 'Tier 2 (Full Banking)' : 'Tier 1 (On-Chain Active • Zero ID)';
      return {
        messageText: `**${entityLabel} — Available Balance**\n────────────────────────\n💵 Base USDC: $${balances.usdc}\n🇳🇬 Nigerian Naira: ₦${Number(balances.ngn).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n🇺🇸 US Dollar: $${Number(balances.usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n🇬🇧 British Pound: £${Number(balances.gbp).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n🇪🇺 Euro: €${Number(balances.eur).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n🇰🇪 Kenyan Shilling: KSh ${Number(balances.kes).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n**Total Portfolio:** $${balances.totalEstimatedUsd}\n**Status:** ${kycBadge}\n**Receiving Address:** \`${mpcAddress}\``,
      };
    }

    // 3. Check for Send Money / Transfer Intent
    const transferMatch = text.match(/(?:send|transfer|pay)\s+(?:₦|\$|USD|NGN)?\s*([\d,.]+)\s+to\s+(.+)/i);
    if (transferMatch) {
      const amount = parseFloat(transferMatch[1].replace(/,/g, ''));
      const rawRecipient = transferMatch[2].trim();
      const isUsd = text.includes('$') || /usd/i.test(text) || rawRecipient.startsWith('0x') || rawRecipient.includes('.near');
      const currency = isUsd ? 'USD' : 'NGN';

      session.pendingAction = {
        type: 'TRANSFER',
        recipientName: rawRecipient,
        accountNumber: rawRecipient,
        amount,
        currency,
        narration: `Transfer to ${rawRecipient}`,
        feeMinor: 0,
      };
      session.step = 'AWAITING_PIN';

      return {
        messageText: `📤 **Confirm Transfer**\n────────────────────────\n**Recipient:** \`${rawRecipient}\`\n**Amount:** ${currency === 'NGN' ? '₦' : '$'}${amount.toLocaleString()}\n**Transfer Fee:** Free\n**Debiting:** ${entityLabel}\n\n🔒 *Please verify with your 6-digit PIN below to authorize.*`,
        actionRequired: 'PIN_PROMPT',
      };
    }

    // 4. Check for Card Issuing Intent
    if (/create\s+(a\s+)?(virtual|debit|prepaid)?\s*card|issue\s+card|new\s+card/i.test(text)) {
      if (session.kycStatus !== 'APPROVED') {
        return {
          messageText: `💳 **Virtual & Physical Cards**\n────────────────────────\nCards connect to international payment networks (VISA/Mastercard) and require quick Tier 2 verification (takes 2 minutes).\n\nYour on-chain account (\`${mpcAddress}\`) is 100% active right now for zero-fee transfers and high-yield savings.\n\nTap below to unlock Cards & Fiat Bank Accounts:`,
          actionRequired: 'KYC_PROMPT',
        };
      }

      const cardType = /debit/i.test(text) ? 'debit' : /prepaid/i.test(text) ? 'prepaid' : 'virtual';
      session.pendingAction = {
        type: 'ISSUE_CARD',
        cardType,
        displayName: 'Online Purchases',
        dailyLimitUsd: 500,
        monthlyLimitUsd: 2000,
      };
      session.step = 'AWAITING_PIN';

      return {
        messageText: `💳 **Confirm Card Issuance**\n────────────────────────\n**Card Type:** ${cardType.toUpperCase()} Card\n**Cardholder:** ${session.username ? `@${session.username}` : 'Valued Client'}\n**Daily Limit:** $500.00\n**Monthly Limit:** $2,000.00\n**Debiting:** ${entityLabel}\n\n🔒 *Enter your 6-digit PIN to activate your card instantly.*`,
        actionRequired: 'PIN_PROMPT',
      };
    }

    // 5. Check for Invoice Creation Intent
    const invoiceMatch = text.match(/invoice\s+(.+?)(?:\s+for\s+|\s*:\s*)(?:₦|\$)?([\d,.]+)/i);
    if (invoiceMatch || text.includes('Create Invoice')) {
      const clientName = invoiceMatch ? invoiceMatch[1].trim() : 'Acme Client Ltd';
      const amount = invoiceMatch ? parseFloat(invoiceMatch[2].replace(/,/g, '')) : 1500;
      const invNumber = `INV-${Date.now().toString().slice(-6)}`;

      const svg = invoiceImageRenderer.generateInvoiceSvg({
        invoiceNumber: invNumber,
        businessName: session.activeEntity === 'BUSINESS' ? (session.username ? `${session.username} Enterprise` : 'Proxim Business Ltd') : (session.username ? `@${session.username}` : 'Proxim Personal'),
        clientName,
        currency: 'USD',
        dueDate: 'In 14 Days',
        paymentUrl: `https://payit.me/pay/${mpcAddress}?ref=${invNumber}`,
        items: [
          { description: 'Professional Services & Consulting', quantity: 1, unitPrice: amount },
        ],
      });

      return {
        messageText: `📄 **Invoice #${invNumber} Created**\n────────────────────────\n**Client:** ${clientName}\n**Amount Due:** $${amount.toLocaleString()} (USDC on Base)\n**Settlement Address:** \`${mpcAddress}\`\n**Due Date:** In 14 Days\n**Payment Link:** https://payit.me/pay/${mpcAddress}?ref=${invNumber}`,
        photoSvg: svg,
      };
    }

    // 6. Check for Savings & High-Yield Vaults
    if (/save|savings|yield|kamino|ondo|vault/i.test(text)) {
      return {
        messageText: `📈 **Savings & High-Yield Vaults (Zero KYC Required)**\n────────────────────────\nGrow your money with institutional yield:\n\n• **Kamino Liquidity Vaults:** Up to 7.80% APY on USD\n• **Ondo Institutional Yield:** 5.15% APY with US Treasury backing\n• **Custom Target Goals:** Automate savings towards a project\n\nChoose an option below to begin earning directly with your Base USDC:`,
      };
    }

    // 7. Check for Deposit / Add Money Intent
    if (/deposit|fund|add\s+money|receive/i.test(text)) {
      const isCryptoSpecific = /crypto|on-chain|token|base|solana|bitcoin|btc|near/i.test(text);

      if (isCryptoSpecific) {
        const solAddr = session.activeEntity === 'BUSINESS' ? session.mpcBusinessSolanaAddress : session.mpcPersonalSolanaAddress;
        const btcAddr = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBtcAddress : session.mpcPersonalBtcAddress;

        return {
          messageText: `⚡ **Multi-Chain Receiving Coordinates (${entityLabel})**\n────────────────────────\nDeposit any token on any of the networks below. Every deposit is automatically converted to **Base USDC** via NEAR Intent under the hood.\n\n🔷 **EVM (Base / Ethereum / BSC / Polygon / Arbitrum):**\n\`${mpcAddress}\`\n\n🟣 **Solana (SOL & SPL Tokens):**\n\`${solAddr}\`\n\n🟠 **Bitcoin (BTC Network):**\n\`${btcAddr}\`\n\n🟢 **NEAR Protocol:**\n\`${nearName}\`\n\n🔄 *Zero-Action Auto-Swap:* Funds settle directly in your available balance as Base USDC.`,
        };
      }

      const bankAccounts = await liveDataService.getEntityBankAccounts(entityId);
      if (session.kycStatus !== 'APPROVED' || bankAccounts.length === 0) {
        return {
          messageText: `📥 **Receive & Deposit Money**\n────────────────────────\nChoose your preferred funding source below:\n\n• **⚡ Digital Assets (Multi-Chain Auto-Swap):** Receive any token across EVM, Solana, Bitcoin, and NEAR with instant 1-click conversion to Base USDC.\n• **🏦 Local Bank Accounts:** Receive NGN, USD, EUR, and GBP directly via dedicated NUBAN and ACH accounts.\n\n_Select an option below to proceed:_`,
        };
      }

      const bankList = bankAccounts.map(b => `• **${b.currency} (${b.bankName}):** \`${b.accountNumber}\``).join('\n');
      return {
        messageText: `📥 **Add Money to ${entityLabel}**\n────────────────────────\n**Local Bank Accounts:**\n${bankList}\n\n**⚡ Multi-Chain Base Coordinates:**\n\`${mpcAddress}\`\n\n*All multi-chain deposits automatically swap to Base USDC via NEAR Intent.*`,
      };
    }


    // 8. Default Calm Banking Response
    return {
      messageText: `Hello! I can help you send money, manage cards, create invoices, check balances, or grow your savings in both **Personal** and **Business** accounts.\n\n⚡ *Your Base USDC account (\`${mpcAddress}\`) is active for instant transfers and high yield.*\n\nTry asking: *"Deposit money"* or *"Send $50 to Sarah"* or *"Create an invoice for Acme"*.`,
    };
  }
}

export const groqEngine = new GroqEngine();


