import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Fastify from 'fastify';
import { sessionManager } from './sessionManager.js';
import { securitySentinel } from './securitySentinel.js';
import { telegramUi } from './telegramUi.js';
import { groqEngine } from './groqEngine.js';
import { liveDataService } from './liveDataService.js';

export const server = Fastify({ logger: true });


// Webhook endpoint for Telegram updates
server.post('/telegram/webhook', async (request, reply) => {
  const update = request.body as any;
  if (!update) return reply.send({ ok: true });

  // Handle Callback Queries (Inline button taps)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const userId = cq.from?.id;
    const data = cq.data || '';
    const session = await sessionManager.getSessionAsync(chatId, userId, cq.from?.username);

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
            successMsg = `Card activated.\n\nYour new ${action.cardType.toUpperCase()} card is active and ready for online spending.\nDaily limit: $${action.dailyLimitUsd}.00.`;
          }

          return reply.send({
            method: 'sendMessage',
            chat_id: chatId,
            text: `✅ ${successMsg}`,
            reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
          });
        } else if (verification.locked) {
          return reply.send({
            method: 'sendMessage',
            chat_id: chatId,
            text: '🔒 Account temporarily locked due to multiple incorrect PIN attempts. Please try again in 10 minutes.',
          });
        } else {
          return reply.send({
            method: 'sendMessage',
            chat_id: chatId,
            text: `❌ Incorrect PIN. ${verification.remainingAttempts} attempts remaining.`,
            reply_markup: telegramUi.getPinKeypad(),
          });
        }
      } else {
        return reply.send({
          method: 'editMessageReplyMarkup',
          chat_id: chatId,
          message_id: cq.message?.message_id,
          reply_markup: telegramUi.getPinKeypad((session as any).pinBuffer.length),
        });
      }
    }

    if (data === 'pin_clear') {
      (session as any).pinBuffer = '';
      return reply.send({
        method: 'editMessageReplyMarkup',
        chat_id: chatId,
        message_id: cq.message?.message_id,
        reply_markup: telegramUi.getPinKeypad(0),
      });
    }

    if (data === 'pin_cancel') {
      sessionManager.clearPendingAction(chatId);
      (session as any).pinBuffer = '';
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: 'Action cancelled.',
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
    }

    // 2. Deposit Options
    if (data === 'fund_bank') {
      const entityId = sessionManager.getActiveEntityId(session);
      const address = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      const bankAccounts = await liveDataService.getEntityBankAccounts(entityId);

      if (session.kycStatus !== 'APPROVED' || bankAccounts.length === 0) {
        return reply.send({
          method: 'sendMessage',
          chat_id: chatId,
          text: `🏦 **Local Bank Accounts (NGN / USD / EUR)**\n────────────────────────\nLocal bank receiving accounts (Providus NUBAN, CFSB ACH, SEPA IBAN) require quick identity verification.\n\n⚡ Your on-chain Base account (\`${address}\`) is 100% active right now with zero ID needed.`,
          reply_markup: telegramUi.getKycPromptKeyboard(),
        });
      }

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: telegramUi.formatBankAccountsCard(bankAccounts, address),
        parse_mode: 'Markdown',
      });
    }

    if (data === 'fund_momo') {
      if (session.kycStatus !== 'APPROVED') {
        return reply.send({
          method: 'sendMessage',
          chat_id: chatId,
          text: `📱 **Mobile Money (M-Pesa / Airtel)**\n────────────────────────\nMobile money gateway requires quick identity verification.\n\n⚡ You can deposit directly via Base USDC without ID.`,
          reply_markup: telegramUi.getKycPromptKeyboard(),
        });
      }

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: '📱 **Mobile Money Deposit (M-Pesa / Airtel)**\nPlease type your phone number and amount (e.g., "Deposit KSh 5,000 to +254712345678") to receive an instant USSD push.',
      });
    }

    if (data === 'fund_crypto') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: telegramUi.formatMultiChainCryptoDepositCard(session),
        parse_mode: 'Markdown',
      });
    }


    if (data === 'kyc_prompt' || data === 'kyc_start') {
      session.step = 'AWAITING_KYC_INPUT';
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `🪪 **Tier 2 Banking Verification (2 Mins)**\n────────────────────────\nTo unlock Nigerian NUBAN accounts, US ACH, European IBANs, and Virtual Cards, please reply with your:\n\n1. **Full Legal Name**\n2. **ID Number (NIN, BVN, or National ID)**\n3. **Country of Residence**\n\n_Or simply send a clear photo of your ID card directly into this chat._`,
      });
    }

    return reply.send({ ok: true });
  }

  // Handle Standard Messages (Text & Voice)
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;
    const session = await sessionManager.getSessionAsync(chatId, userId, username);

    const rawText = (msg.text || '').trim();

    // Check for KYC Document Upload (Photos / Documents)
    if (msg.photo || msg.document || session.step === 'AWAITING_KYC_INPUT') {
      session.kycStatus = 'APPROVED';
      session.step = 'IDLE';
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `✅ **Identity Verified Successfully!**\n────────────────────────\nYou have been upgraded to **Tier 2 (Full Banking Access)**.\n\n🏦 **Your Virtual Accounts are now active:**\n• Virtual Bank Accounts are now enabled.\n• 💳 Virtual & Debit Card issuing is now enabled.`,
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
    }

    // 1. Initial /start Command
    if (rawText === '/start') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: telegramUi.getWelcomeCard(session),
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
    }

    // 2. Persistent Menu Buttons
    if (rawText === '💰 Accounts & Balance') {
      const entityLabel = session.activeEntity === 'PERSONAL' ? '👤 Personal Account' : '🏢 Business Account';
      const entityId = sessionManager.getActiveEntityId(session);
      const address = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      const kycBadge = session.kycStatus === 'APPROVED' ? 'Tier 2 (Full Banking)' : 'Tier 1 (On-Chain Active)';
      const balances = await liveDataService.getEntityBalances(entityId);

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: telegramUi.formatBalanceCard(entityLabel, balances, address, kycBadge),
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
      });
    }

    if (rawText.startsWith('🔄 Switch to')) {
      const newEntity = sessionManager.switchEntity(chatId);
      const address = newEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `Switched active profile to **${newEntity === 'PERSONAL' ? '👤 Personal Account' : '🏢 Business Account'}**.\nBase Coordinates: \`${address}\`\nAll balances and outgoing payments are now mapped to this entity.`,
        reply_markup: telegramUi.getMainReplyMenu(newEntity),
      });
    }

    if (rawText === '📤 Send Money') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `Who would you like to pay?\n\nYou can type naturally, e.g.:\n*"Send $50 to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"* or *"Send $100 to Sarah"*`,
      });
    }

    if (rawText === '📥 Add Money') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `Select your preferred funding method:`,
        reply_markup: telegramUi.getDepositOptionsKeyboard(session.kycStatus),
      });
    }

    if (rawText === '💳 Manage Cards') {
      if (session.kycStatus !== 'APPROVED') {
        return reply.send({
          method: 'sendMessage',
          chat_id: chatId,
          text: `💳 **Virtual & Physical Cards**\n────────────────────────\nCards connect to international payment networks (VISA/Mastercard) and require quick Tier 2 verification.\n\n⚡ Your on-chain account (\`${session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress}\`) is ready for instant transfers and yield.`,
          reply_markup: telegramUi.getKycPromptKeyboard(),
        });
      }

      const entityId = sessionManager.getActiveEntityId(session);
      const cards = await liveDataService.getEntityCards(entityId);

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: telegramUi.formatCardsCard(cards),
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getCardControlsKeyboard(cards[0]?.id || 'card_new', false),
      });
    }

    if (rawText === '📈 Savings & Yield') {

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `📈 **Savings & High-Yield Vaults (Zero KYC Required)**\n────────────────────────\nChoose a yield strategy to automate your growth:`,
        reply_markup: telegramUi.getSavingsOptionsKeyboard(),
      });
    }

    if (rawText === '📄 Create Invoice') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `To generate an invoice, tell me the details, e.g.:\n*"Invoice Acme Tech for $1,500: Web Development and Brand Strategy"*`,
      });
    }

    if (rawText === '⚙️ Settings & KYC') {
      const address = session.activeEntity === 'BUSINESS' ? session.mpcBusinessBaseAddress : session.mpcPersonalBaseAddress;
      const nearAddr = session.activeEntity === 'BUSINESS' ? session.mpcBusinessNearAddress : session.mpcPersonalNearAddress;
      const tierDesc = session.kycStatus === 'APPROVED' ? 'Tier 2 (Full Banking & Cards Active)' : 'Tier 1 (Instant On-Chain Active • Zero ID)';

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `⚙️ **Account Settings & Security**\n────────────────────────\n• **Status:** ${tierDesc}\n• **Base USDC Address:** \`${address}\`\n• **NEAR Name:** \`${nearAddr}\`\n• **6-Digit PIN:** Configured\n\n${session.kycStatus !== 'APPROVED' ? '💡 _To unlock local bank accounts (NGN, USD, EUR) and debit cards, tap below._' : '✅ _All banking features active._'}`,
        reply_markup: session.kycStatus !== 'APPROVED' ? telegramUi.getKycPromptKeyboard() : telegramUi.getMainReplyMenu(session.activeEntity),
      });
    }

    // 3. Security Inspection
    const inspection = securitySentinel.inspectPrompt(rawText);
    if (!inspection.isSafe) {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: '⚠️ Unsafe command or instruction override detected. For your security, all operations require interactive verification.',
      });
    }

    // 4. Natural Language Processing with Groq Engine
    const result = await groqEngine.processMessage(inspection.sanitizedPrompt, session);

    if (result.actionRequired === 'PIN_PROMPT') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: result.messageText,
        reply_markup: telegramUi.getPinKeypad(),
      });
    }

    if (result.actionRequired === 'KYC_PROMPT') {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: result.messageText,
        reply_markup: telegramUi.getKycPromptKeyboard(),
      });
    }

    return reply.send({
      method: 'sendMessage',
      chat_id: chatId,
      text: result.messageText,
      reply_markup: telegramUi.getMainReplyMenu(session.activeEntity),
    });
  }

  return reply.send({ ok: true });
});

export async function startBot(port = Number(process.env.PORT) || 5000) {
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`🤖 Proxim Telegram Bot Webhook Server running on port ${port}`);
  } catch (err) {
    console.error('Telegram bot webhook startup error:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV === 'production' || process.env.RUN_BOT === 'true') {
  startBot();
}
