import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
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

const BACKEND_BASE_URL = process.env.PAYIT_BACKEND_URL || process.env.BACKEND_PUBLIC_URL;
if (!BACKEND_BASE_URL) throw new Error('PAYIT_BACKEND_URL or BACKEND_PUBLIC_URL is required to start the Telegram bot');
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
if (process.env.NODE_ENV === 'production' && !WEBHOOK_SECRET) throw new Error('TELEGRAM_WEBHOOK_SECRET is required in production');

function hasValidWebhookSecret(request: { headers: Record<string, any> }) {
  if (!WEBHOOK_SECRET) return process.env.NODE_ENV !== 'production';
  const received = String(request.headers['x-telegram-bot-api-secret-token'] || '');
  const expected = Buffer.from(WEBHOOK_SECRET);
  const actual = Buffer.from(received);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function confirmTelegramLink(nonce: string, telegramUserId: number, telegramUsername?: string) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/auth/telegram/link/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce, telegramUserId, telegramUsername }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch (error: any) {
    return {
      ok: false,
      data: { error: error.message || 'Unable to reach the backend to confirm the link.' },
    };
  }
}

export const server = Fastify({ logger: true });


// Webhook endpoint for Telegram updates
server.post('/telegram/webhook', async (request, reply) => {
  if (!hasValidWebhookSecret(request)) return reply.status(401).send({ error: 'Invalid Telegram webhook secret' });
  const update = request.body as any;
  if (!update) return reply.send({ ok: true });

  // Handle Callback Queries (Inline button taps)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const userId = cq.from?.id;
    const data = cq.data || '';
    let session;
    try {
      session = await sessionManager.getSessionAsync(chatId, userId, cq.from?.username);
    } catch (error: any) {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `🔒 This Telegram account is not linked to a Proxim account yet. Open the web app, sign in, link Telegram, then try again.\n\n${error.message || 'Account provisioning is unavailable.'}`,
      });
    }

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

    if (data === 'save_kamino' || data === 'save_ondo' || data === 'save_goal' || data === 'withdraw_savings') {
      const isWithdraw = data === 'withdraw_savings';
      const routeLabel = data === 'save_ondo' ? 'Ondo Institutional Yield' : data === 'save_goal' ? 'Custom Savings Goal' : 'Kamino Liquidity Vaults';
      const caption = isWithdraw
        ? `📤 **Withdraw from Savings**\n────────────────────────\nThis bot does not execute real on-chain withdrawals, and this action is not executed from Telegram.\n\nTelegram PIN/session system is separate from the app auth: the Kamino backend route requires a web JWT or backend trusted-device passcode. Because of that auth gap, a Telegram action here is not a real withdrawal and no Solana transaction is signed or submitted from this bot.\n\nUse the main app / Savings Hub to verify your position, review fees, and complete the actual withdrawal flow with the proper authenticated session.`
        : `📈 **${routeLabel}**\n────────────────────────\n${data === 'save_kamino' ? 'Earn up to 7.80% APY on Base USDC through the live Kamino savings pool.' : data === 'save_ondo' ? 'Access USDY/OUSG yield with institutional treasury-backed returns.' : 'Set a custom target amount and automate recurring transfers into your savings reserve.'}\n\nUse the app’s Savings Hub to complete the live deposit, or type a message like: *"Save $250 for 90 days"* or *"Set a $2,000 savings goal"*.`;

      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: caption,
        parse_mode: 'Markdown',
        reply_markup: telegramUi.getSavingsActionKeyboard(),
      });
    }

    if (data === 'kyc_prompt' || data === 'kyc_start') {
      session.step = 'AWAITING_KYC_INPUT';
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `🪪 **Tier 2 Banking Verification (2 Mins)**\n────────────────────────\nUse the secure verification button below to submit your details and documents inside Telegram. Documents sent as ordinary chat messages are not processed.`,
        reply_markup: telegramUi.getKycPromptKeyboard(),
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
    let session;
    try {
      session = await sessionManager.getSessionAsync(chatId, userId, username);
    } catch (error: any) {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `🔒 This Telegram account is not linked to a Proxim account yet. Open the web app, sign in, link Telegram, then try again.\n\n${error.message || 'Account provisioning is unavailable.'}`,
      });
    }

    const rawText = (msg.text || '').trim();

    // Check for KYC Document Upload (Photos / Documents)
    if (msg.photo || msg.document || session.step === 'AWAITING_KYC_INPUT') {
      session.step = 'IDLE';
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: `🪪 **KYC must be completed in the authenticated web app**\n────────────────────────\nTelegram does not have the same backend session or wallet-auth context as the web app, so uploaded documents are not treated as a real verification event.\n\nPlease complete the secure verification flow in the main app to unlock local bank accounts and virtual cards.`,
        reply_markup: telegramUi.getKycPromptKeyboard(),
      });
    }

    if (rawText === '/start' || rawText.startsWith('/link')) {
      if (rawText.startsWith('/link')) {
        const nonce = rawText.replace(/^\/link\s*/i, '').trim();
        if (!nonce) {
          return reply.send({
            method: 'sendMessage',
            chat_id: chatId,
            text: '🔗 Link your Telegram to the web app by starting the flow in the app, then send this command with the nonce:\n\n/link <nonce>\n\nExample: /link 4bc2c6a2f0d7a1e4f7c9d2b6a7f1229a',
          });
        }

        const result = await confirmTelegramLink(nonce, userId, username);
        if (result.ok && result.data?.success) {
          return reply.send({
            method: 'sendMessage',
            chat_id: chatId,
            text: `✅ Linked successfully! Your Telegram account (${username || userId}) is now connected to your web app identity.`,
          });
        }

        return reply.send({
          method: 'sendMessage',
          chat_id: chatId,
          text: `⚠️ Unable to link Telegram right now: ${result.data?.error || 'The link nonce is invalid or expired.'}`,
        });
      }

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
