import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
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
import { podsRoutes } from './routes/pods.js';
import { ondoRoutes } from './routes/ondo.js';

import { requireAuthHook } from './middleware/requireAuth.js';
import { ReconcilerEngine } from './services/reconcilerEngine.js';

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

  // Serve static document uploads for Brails CDN document verification
  server.get('/uploads/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'uploads', safeName);
    if (fs.existsSync(filePath)) {
      const stream = fs.createReadStream(filePath);
      return reply.type('application/octet-stream').send(stream);
    }
    return reply.status(404).send({ error: 'Document not found' });
  });

  // Register single-source routes
  server.register(authRoutes);
  server.register(entityRoutes);
  server.register(kycRoutes);
  server.register(socialRoutes);
  server.register(savingsRoutes);
  server.register(waitlistRoutes);
  server.register(transferRoutes);
  server.register(podsRoutes);
  server.register(ondoRoutes);

  server.register(cardRoutes);
  server.register(invoiceRoutes);
  server.register(payrollRoutes);
  server.register(webhookRoutes);

  // Dev/Staging only — seed routes for local testing
  if (env.NODE_ENV !== 'production') {
    server.register(devSeedRoutes);
  }

  /**
   * M7 Remediation: Admin manual audit reconciliation trigger.
   * Header-gated via x-admin-secret.
   */
  server.post('/api/admin/reconcile', async (request, reply) => {
    const adminSecret = request.headers['x-admin-secret'];
    const expectedSecret = process.env.ADMIN_SEED_SECRET || 'dev_seed_secret';
    if (!adminSecret || adminSecret !== expectedSecret) {
      return reply.status(403).send({ error: 'UNAUTHORIZED_ADMIN_REQUEST', message: 'Valid x-admin-secret header required' });
    }

    try {
      const report = await ReconcilerEngine.runAuditReconciliation();
      return reply.send({ success: true, report });
    } catch (err: any) {
      return reply.status(500).send({ error: `Reconciliation audit failed: ${err.message}` });
    }
  });

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  // M7 Remediation: Scheduled 15-minute automated double-entry reconciliation audit
  setInterval(async () => {
    try {
      await ReconcilerEngine.runAuditReconciliation();
    } catch (err: any) {
      console.error('[ReconcilerEngine Scheduled Task Error]:', err.message);
    }
  }, 15 * 60 * 1000);
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
