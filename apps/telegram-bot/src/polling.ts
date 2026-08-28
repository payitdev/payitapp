/**
 * Telegram Bot Long Polling Runner
 * Enables real-time local testing without requiring a public HTTPS webhook tunnel.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sessionManager } from './sessionManager.js';
import { securitySentinel } from './securitySentinel.js';
import { telegramUi } from './telegramUi.js';
import { groqEngine } from './groqEngine.js';
import { liveDataService } from './liveDataService.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8883261709:AAGIJLcIjUVmuIOcih-B14SX0iIqIwksNto';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;


async function telegramApi(method: string, body: Record<string, any>) {
  try {
    const res = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json() as any;
    if (!json.ok) {
      console.error(`[Telegram API Error] ${method}:`, json.description);
      // Auto-fallback: If Telegram rejects markdown formatting, retry cleanly as plain text
      if (json.description?.includes("can't parse entities") && body.parse_mode) {
        const fallbackBody = { ...body };
        delete fallbackBody.parse_mode;
        const retryRes = await fetch(`${API_BASE}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackBody),
        });
        return await retryRes.json();
      }
    }
    return json;
  } catch (err: any) {
    console.error(`[Telegram API Error] ${method}:`, err.message);
    return { ok: false, error: err.message };
  }
}


export async function processTelegramUpdate(update: any) {
  // Handle Callback Queries (Inline Button Clicks)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const userId = cq.from?.id;
    const data = cq.data || '';
    const messageId = cq.message?.message_id;
    const session = sessionManager.getSession(chatId, userId, cq.from?.username);

    // 1. PIN Keypad Interaction
    if (data.startsWith('pin:')) {
      const digit = data.split(':')[1];
      (session as any).pinBuffer = ((session as any).pinBuffer || '') + digit;

      if ((session as any).pinBuffer.length >= 6) {
        const pin = (session as any).pinBuffer;
        (session as any).pinBuffer = '';

        const verification = await sessionManager.verifyPin(chatId, pin);
        if (verification.success) {
          const action = session.pendingAction;
          sessionManager.clearPendingAction(chatId);

          let successMsg = 'Action completed successfully.';
          if (action?.type === 'TRANSFER') {
            successMsg = `Money sent.\n\nSuccessfully transferred ${action.currency === 'NGN' ? '₦' : '$'}${action.amount.toLocaleString()} to ${action.recipientName}.\nReference: PX-${Date.now().toString().slice(-6)}\n\nYour new available balance is updated.`;
          } else if (action?.type === 'ISSUE_CARD') {
            successMsg = `Card activated.\n\nYour new ${action.cardType.toUpperCase()} card (•••• 4912) is active and ready for online spending.\nDaily limit: $${action.dailyLimitUsd}.00.`;
          }

          await telegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ ${successMsg}`,
            reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
          });
        } else if (verification.locked) {
          await telegramApi('sendMessage', {
            chat_id: chatId,
            text: '🔒 Account temporarily locked due to multiple incorrect PIN attempts. Please try again in 10 minutes.',
          });
        } else {
          await telegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ Incorrect PIN. ${verification.remainingAttempts} attempts remaining.`,
            reply_markup: telegramUi.getPinKeypad(),
          });
        }
      } else {
        await telegramApi('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: telegramUi.getPinKeypad((session as any).pinBuffer.length),
        });
      }
      return;
    }

    if (data === 'pin_clear') {
      (session as any).pinBuffer = '';
      await telegramApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: telegramUi.getPinKeypad(0),
      });
      return;
    }

    if (data === 'pin_cancel') {
      sessionManager.clearPendingAction(chatId);
      (session as any).pinBuffer = '';
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: 'Action cancelled.',
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
      return;
    }

    // 2. Deposit Options
    if (data === 'fund_bank') {
      const entityId = sessionManager.getActiveEntityId(session);
      const address = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      const bankAccounts = await liveDataService.getEntityBankAccounts(entityId);

      if (session.kycStatus !== 'APPROVED' || bankAccounts.length === 0) {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: `🏦 **Local Bank Accounts (NGN / USD / EUR)**\n────────────────────────\nLocal bank receiving accounts (Providus NUBAN, CFSB ACH, SEPA IBAN) require quick identity verification.\n\n⚡ Your on-chain Base account (\`${address}\`) is 100% active right now with zero ID needed.`,
          reply_markup: telegramUi.getKycPromptKeyboard(),
        });
        return;
      }

      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: telegramUi.formatBankAccountsCard(bankAccounts, address),
        parse_mode: 'Markdown',
      });
      return;
    }

    if (data === 'fund_momo') {
      if (session.kycStatus !== 'APPROVED') {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: `📱 **Mobile Money (M-Pesa / Airtel)**\n────────────────────────\nMobile money gateway requires quick identity verification.\n\n⚡ You can deposit directly via Base USDC without ID.`,
          reply_markup: telegramUi.getKycPromptKeyboard(),
        });
        return;
      }

      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: '📱 **Mobile Money Deposit (M-Pesa / Airtel)**\nPlease type your phone number and amount (e.g., "Deposit KSh 5,000 to +254712345678") to receive an instant USSD push.',
      });
      return;
    }

    if (data === 'fund_crypto') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: telegramUi.formatMultiChainCryptoDepositCard(session),
        parse_mode: 'Markdown',
      });
      return;
    }


    if (data === 'kyc_prompt' || data === 'kyc_start') {
      session.step = 'AWAITING_KYC_INPUT';
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `🪪 **Tier 2 Banking Verification (2 Mins)**\n────────────────────────\nTo unlock Nigerian NUBAN accounts, US ACH, European IBANs, and Virtual Cards, please reply with your:\n\n1. **Full Legal Name**\n2. **ID Number (NIN, BVN, or National ID)**\n3. **Country of Residence**\n\n_Or simply send a clear photo of your ID card directly into this chat._`,
      });
      return;
    }
  }

  // Handle Standard Text Messages & Photos
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat?.id;
    const userId = msg.from?.id;
    const username = msg.from?.username;
    if (!chatId || !userId) return;

    const session = await sessionManager.getSessionAsync(chatId, userId, username);
    const rawText = (msg.text || '').trim();

    // Check for KYC Document Upload (Photos / Documents)
    if (msg.photo || msg.document || session.step === 'AWAITING_KYC_INPUT') {
      session.kycStatus = 'APPROVED';
      session.step = 'IDLE';
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `✅ **Identity Verified Successfully!**\n────────────────────────\nYou have been upgraded to **Tier 2 (Full Banking Access)**.\n\n🏦 **Your Virtual Accounts are now active:**\n• Virtual Bank Account coordinates are now enabled.\n• 💳 Virtual & Debit Card issuing is now enabled.`,
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
      return;
    }

    // 1. Initial /start Command
    if (rawText === '/start') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: telegramUi.getWelcomeCard(session),
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
      return;
    }

    // 2. Persistent Menu Buttons
    if (rawText === '💰 Accounts & Balance') {
      const entityLabel = session.activeEntity === 'PERSONAL' ? '👤 Personal Account' : '🏢 Business Account';
      const entityId = sessionManager.getActiveEntityId(session);
      const address = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      const kycBadge = session.kycStatus === 'APPROVED' ? 'Tier 2 (Full Banking)' : 'Tier 1 (On-Chain Active)';
      const balances = await liveDataService.getEntityBalances(entityId);

      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: telegramUi.formatBalanceCard(entityLabel, balances, address, kycBadge),
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
      return;
    }

    if (rawText.startsWith('🔄 Switch to')) {
      const newEntity = sessionManager.switchEntity(chatId);
      const address = newEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `Switched active profile to **${newEntity === 'PERSONAL' ? '👤 Personal Account' : '🏢 Business Account'}**.\nBase Coordinates: \`${address}\`\nAll balances and outgoing payments are now mapped to this entity.`,
        reply_markup: telegramUi.getMainReplyMenu(newEntity),
      });
      return;
    }

    if (rawText === '📤 Send Money') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `Who would you like to pay?\n\nYou can type naturally, e.g.:\n*"Send $50 to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"* or *"Send $100 to Sarah"*`,
      });
      return;
    }

    if (rawText === '📥 Add Money') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `Select your preferred funding method:`,
        reply_markup: telegramUi.getDepositOptionsKeyboard(session.kycStatus),
      });
      return;
    }

    if (rawText === '💳 Manage Cards') {
      if (session.kycStatus !== 'APPROVED') {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: `💳 **Virtual & Physical Cards**\n────────────────────────\nCards connect to international payment networks (VISA/Mastercard) and require quick Tier 2 verification.\n\n⚡ Your on-chain account (\`${session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress}\`) is ready for instant transfers and yield.`,
          reply_markup: telegramUi.getKycPromptKeyboard(),
        });
        return;
      }

      const entityId = sessionManager.getActiveEntityId(session);
      const cards = await liveDataService.getEntityCards(entityId);

      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: telegramUi.formatCardsCard(cards),
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getCardControlsKeyboard(cards[0]?.id || 'card_new', false),
      });
      return;
    }


    if (rawText === '📈 Savings & Yield') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `📈 **Savings & High-Yield Vaults (Zero KYC Required)**\n────────────────────────\nChoose a yield strategy to automate your growth:`,
        reply_markup: telegramUi.getSavingsOptionsKeyboard(),
      });
      return;
    }

    if (rawText === '📄 Create Invoice') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `To generate an invoice, tell me the details, e.g.:\n*"Invoice Acme Tech for $1,500: Web Development and Brand Strategy"*`,
      });
      return;
    }

    if (rawText === '⚙️ Settings & KYC') {
      const address = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      const nearAddr = session.activeEntity === 'BUSINESS' ? session.mpcBusinessNearAddress : session.mpcPersonalNearAddress;
      const tierDesc = session.kycStatus === 'APPROVED' ? 'Tier 2 (Full Banking & Cards Active)' : 'Tier 1 (Instant On-Chain Active • Zero ID)';

      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: `⚙️ **Account Settings & Security**\n────────────────────────\n• **Status:** ${tierDesc}\n• **Base USDC Address:** \`${address}\`\n• **NEAR Name:** \`${nearAddr}\`\n• **6-Digit PIN:** Configured\n\n${session.kycStatus !== 'APPROVED' ? '💡 _To unlock local bank accounts (NGN, USD, EUR) and debit cards, tap below._' : '✅ _All banking features active._'}`,
        reply_markup: session.kycStatus !== 'APPROVED' ? telegramUi.getKycPromptKeyboard() : telegramUi.getMainReplyMenu(session.activeEntity),
      });
      return;
    }

    // 3. Security Inspection
    const inspection = securitySentinel.inspectPrompt(rawText);
    if (!inspection.isSafe) {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: '⚠️ Unsafe command or instruction override detected. For your security, all operations require interactive verification.',
      });
      return;
    }

    // 4. Natural Language Processing with Groq Engine
    const result = await groqEngine.processMessage(inspection.sanitizedPrompt, session);

    if (result.actionRequired === 'PIN_PROMPT') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: result.messageText,
        reply_markup: telegramUi.getPinKeypad(),
      });
      return;
    }

    if (result.actionRequired === 'KYC_PROMPT') {
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: result.messageText,
        reply_markup: telegramUi.getKycPromptKeyboard(),
      });
      return;
    }

    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: result.messageText,
      reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
    });
  }
}

export async function startPolling() {

  console.log(`🤖 Starting Proxim Telegram Bot in Long Polling mode...`);
  await telegramApi('deleteWebhook', { drop_pending_updates: true });

  const me = await telegramApi('getMe', {});
  if (me.ok) {
    console.log(`✅ Connected as @${me.result.username} (${me.result.first_name})`);
  }

  let offset = 0;
  while (true) {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=25`);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await processTelegramUpdate(update).catch((err) => console.error('Error handling update:', err));
        }
      }
    } catch (err: any) {
      console.error('Polling connection error, retrying in 3s...', err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

if (process.argv[1]?.includes('polling')) {
  startPolling();
}
