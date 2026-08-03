import Fastify from 'fastify';

const server = Fastify({ logger: true });

// Stateless Telegram Mini App Webhook Handler
server.post('/telegram/webhook', async (request, reply) => {
  const update = request.body as any;

  if (update && update.message && update.message.text === '/start') {
    return reply.send({
      method: 'sendMessage',
      chat_id: update.message.chat.id,
      text: 'Welcome to PayIT Mini App! Launch your non-custodial personal & business wallet below.',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Open PayIT App', web_app: { url: process.env.PAYIT_MOBILE_WEB_URL || 'https://payit.co' } }],
        ],
      },
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
