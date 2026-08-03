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

export function buildServer() {
  const server = Fastify({
    logger: true,
  });

  server.register(cors, {
    origin: '*',
  });

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'healthy', app: 'PayIT Backend API', timestamp: new Date().toISOString() };
  });

  // Register single-source routes
  server.register(authRoutes);
  server.register(entityRoutes);
  server.register(kycRoutes);
  server.register(transferRoutes);
  server.register(cardRoutes);
  server.register(invoiceRoutes);
  server.register(payrollRoutes);
  server.register(webhookRoutes);

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  const server = buildServer();
  server.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error('Fastify startup error:', err);
      process.exit(1);
    }
    console.log(`🚀 PayIT Backend API running on ${address}`);
  });
}
