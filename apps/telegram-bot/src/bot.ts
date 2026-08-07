import Fastify from 'fastify';
import bcrypt from 'bcryptjs';

const server = Fastify({ logger: true });

// 5-minute (300,000ms) session inactivity expiration lock map
interface ChatSession {
  lastActive: number;
  isPinVerified: boolean;
  pendingTransfer?: {
    recipient: string;
    amount: number;
  };
}

const chatSessions = new Map<number, ChatSession>();
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function getValidSession(chatId: number): ChatSession {
  const now = Date.now();
  const session = chatSessions.get(chatId);

  if (!session || (now - session.lastActive) > INACTIVITY_TIMEOUT_MS) {
    const newSession: ChatSession = {
      lastActive: now,
      isPinVerified: false,
    };
    chatSessions.set(chatId, newSession);
    return newSession;
  }

  session.lastActive = now;
  return session;
}

// Telegram Mini App Webhook Handler with PIN Guard & Inactivity Lock (Issue 2)
server.post('/telegram/webhook', async (request, reply) => {
  const update = request.body as any;
  if (!update || !update.message) return reply.send({ ok: true });

  const chatId = update.message.chat.id;
  const text = (update.message.text || '').trim();
  const session = getValidSession(chatId);

  if (text === '/start') {
    return reply.send({
      method: 'sendMessage',
      chat_id: chatId,
      text: 'Welcome to PayIT Mini App! Launch your non-custodial personal & business wallet below.',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Open PayIT App', web_app: { url: process.env.PAYIT_MOBILE_WEB_URL || 'https://payit.co' } }],
        ],
      },
    });
  }

  // Handle transfer / send command initiation
  const transferMatch = text.match(/^\/(?:transfer|send)\s+([\d,.]+)\s+to\s+(.+)$/i);
  if (transferMatch) {
    const amount = parseFloat(transferMatch[1].replace(/,/g, ''));
    const recipient = transferMatch[2].trim();

    session.pendingTransfer = { recipient, amount };

    return reply.send({
      method: 'sendMessage',
      chat_id: chatId,
      text: `🔒 Security Check Required:\nTo confirm transfer of $${amount} to ${recipient}, please reply with your 4-digit PayIT transaction PIN.`,
    });
  }

  // Handle PIN input validation when pending transfer exists
  if (session.pendingTransfer && /^\d{4}$/.test(text)) {
    const pin = text;
    const { recipient, amount } = session.pendingTransfer;

    const mockHash = await bcrypt.hash('1234', 10);
    const isValid = await bcrypt.compare(pin, mockHash);

    if (!isValid) {
      return reply.send({
        method: 'sendMessage',
        chat_id: chatId,
        text: '❌ Invalid 4-digit PIN. Transfer cancelled for your security.',
      });
    }

    session.isPinVerified = true;
    session.pendingTransfer = undefined;

    return reply.send({
      method: 'sendMessage',
      chat_id: chatId,
      text: `✅ Money Sent!\nSuccessfully transferred $${amount} to ${recipient}.\n\n🔒 Session secured for 5 minutes.`,
    });
  }

  return reply.send({ ok: true });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen({ port: 5000, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error('Telegram bot webhook startup error:', err);
      process.exit(1);
    }
    console.log('🤖 PayIT Telegram Bot Webhook Server running on port 5000');
  });
}
