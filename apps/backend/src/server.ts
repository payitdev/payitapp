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
import { kycRoutes } from './routes/kyc.js';
import { socialRoutes } from './routes/social.js';
import { savingsRoutes } from './routes/savings.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { devSeedRoutes } from './routes/devSeed.js';
import { podsRoutes } from './routes/pods.js';
import { ondoRoutes } from './routes/ondo.js';
import { intentRoutes } from './routes/intents.js';
import { kaminoRoutes } from './routes/kamino.js';
import { biconomyRoutes } from './routes/biconomy.js';
import { financialReportsRoutes } from './routes/financialReports.js';
import { developerRoutes } from './routes/developer.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { paymentRoutes } from './routes/payments.js';
import { v1Routes } from './routes/v1Routes.js';
import { brailsRoutes } from './routes/brails.js';
import { schoolRoutes } from './routes/schools.js';
import { nuvionRoutes } from './routes/nuvion.js';
import { easeIdClient } from '@payit/integrations';
import rawBody from 'fastify-raw-body';

import { requireAuthHook } from './middleware/requireAuth.js';
import { ReconcilerEngine } from './services/reconcilerEngine.js';

export function buildServer() {
  const server = Fastify({
    logger: true,
  });

  server.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });

  server.register(cors, {
    origin: '*',
  });

  // Debug endpoint for EaseID testing (must be before auth hook)
  server.get('/api/kyc/debug/test-easeid', async () => {
    try {
      const testConfig = {
        appId: process.env.EASEID_APP_ID,
        baseUrl: process.env.EASEID_BASE_URL,
        hasApiKey: !!process.env.EASEID_API_KEY,
        apiKeyLength: process.env.EASEID_API_KEY?.length || 0,
      };

      const testResult = await easeIdClient.lookupIdentity(
        'nin',
        '12345678901',
        'test-entity-id',
        '0x0000000000000000000000000000000000000',
      );

      return {
        success: true,
        config: testConfig,
        testResponse: {
          verificationId: testResult.verificationId,
          fullName: testResult.fullName,
          hasPhoto: !!testResult.photoBase64,
        },
        message: 'EaseID API connection successful',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        config: {
          appId: process.env.EASEID_APP_ID,
          baseUrl: process.env.EASEID_BASE_URL,
          hasApiKey: !!process.env.EASEID_API_KEY,
        },
        message: 'EaseID API connection failed',
      };
    }
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
  server.register(intentRoutes);
  server.register(kaminoRoutes);
  server.register(biconomyRoutes);

  server.register(cardRoutes);
  server.register(invoiceRoutes);
  server.register(payrollRoutes);
  server.register(financialReportsRoutes);
  server.register(paymentRoutes);
  server.register(developerRoutes);
  server.register(adminRoutes);
  server.register(v1Routes);
  server.register(brailsRoutes);
  server.register(schoolRoutes);
  server.register(nuvionRoutes);

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
    const expectedSecret = process.env.ADMIN_SEED_SECRET;
    if (!expectedSecret || !adminSecret || adminSecret !== expectedSecret) {
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
  
  import('./scheduler.js')
    .then(({ initScheduler }) => {
      try { initScheduler(); } catch (e: any) { console.warn('[Scheduler init warning]:', e.message); }
    })
    .catch((err: any) => console.warn('[Scheduler load warning]:', err.message));
}
