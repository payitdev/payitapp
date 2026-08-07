import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { authRoutes } from './routes/auth.js';
import { entityRoutes } from './routes/entities.js';
import { transferRoutes } from './routes/transfers.js';
import { cardRoutes } from './routes/cards.js';
import { invoiceRoutes } from './routes/invoices.js';
import { payrollRoutes } from './routes/payroll.js';
import { webhookRoutes } from './routes/webhooks.js';
import { kycRoutes } from './routes/kyc.js';
import { socialRoutes } from './routes/social.js';
import { savingsRoutes } from './routes/savings.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { devSeedRoutes } from './routes/devSeed.js';

import { requireAuthHook } from './middleware/requireAuth.js';

export function buildServer() {
  const server = Fastify({
    logger: true,
  });

  server.register(cors, {
    origin: '*',
  });

  // Global authentication hook enforcing server-derived JWT session
  server.addHook('onRequest', requireAuthHook);

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'healthy', app: 'PayIT Backend API', timestamp: new Date().toISOString() };
  });

  // Register single-source routes
  server.register(authRoutes);
  server.register(entityRoutes);
  server.register(kycRoutes);
  server.register(socialRoutes);
  server.register(savingsRoutes);
  server.register(waitlistRoutes);
  server.register(transferRoutes);

  server.register(cardRoutes);
  server.register(invoiceRoutes);
  server.register(payrollRoutes);
  server.register(webhookRoutes);

  // Dev/Staging only — seed routes for local testing
  if (env.NODE_ENV !== 'production') {
    server.register(devSeedRoutes);
  }

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason: any) => {
    if (reason?.code === 'ECONNRESET' || reason?.message?.includes('ECONNRESET')) {
      console.warn('⚡ [Database Proxy Warning] Handled ECONNRESET idle socket reset gracefully.');
      return;
    }
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (err: any) => {
    if (err?.code === 'ECONNRESET' || err?.message?.includes('ECONNRESET')) {
      console.warn('⚡ [Database Proxy Warning] Handled ECONNRESET socket reset gracefully.');
      return;
    }
    console.error('Uncaught Exception:', err);
  });

  const server = buildServer();
  server.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error('Fastify startup error:', err);
      process.exit(1);
    }
    console.log(`🚀 PayIT Backend API running on ${address}`);
  });
}
