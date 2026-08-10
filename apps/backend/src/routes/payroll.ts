import { FastifyInstance } from 'fastify';
import { GeminiOcrParser } from '@payit/ai';
import { validateEntityAccess } from '@payit/ledger';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq, and } from '@payit/db';
import { payrollRuns, payrollItems, entities, accounts, ledgerEntries } from '@payit/db/schema';
import { ulid } from 'ulid';
import { assertEntityApproved } from './kyc.js';
import { getEntityBalance } from '../utils/balance.js';

const ocr = new GeminiOcrParser();
const nuvion = new NuvionClient();
const db = createDbClient();

export async function payrollRoutes(server: FastifyInstance) {

  /**
   * Step 1: Upload and OCR-extract payroll file using Gemini Flash.
   */
  server.post('/api/payroll/extract', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId } = request.body as { entityId: string };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }
    const entity = entityRows[0];

    try {
      assertEntityApproved(entity);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    const files = (request as any).files;
    let fileBuffer: Buffer;
    let fileName: string;

    if (files && files.payrollFile) {
      const file = files.payrollFile;
      fileBuffer = Buffer.from(await file.toBuffer());
      fileName = file.filename || 'payroll.pdf';
    } else if ((request as any).rawBody) {
      fileBuffer = Buffer.from((request as any).rawBody);
      fileName = (request.headers['x-filename'] as string) || 'payroll.pdf';
    } else {
      return reply.status(400).send({
        error: 'Payroll file is required. Send as multipart form-data with field name "payrollFile".',
      });
    }

    let extractedItems: any[];
    try {
      extractedItems = await ocr.extractPayrollFromFile(fileBuffer, fileName);
    } catch (err: any) {
      server.log.error({ err }, 'Gemini OCR extraction failed');
      return reply.status(422).send({ error: `OCR extraction failed: ${err.message}` });
    }

    if (extractedItems.length === 0) {
      return reply.status(422).send({ error: 'No payroll items found in the uploaded document. Please verify the file format.' });
    }

    const totalAmount = extractedItems.reduce((acc, item) => acc + item.amount, 0);
    const payrollRunId = ulid();

    await db.insert(payrollRuns).values({
      id: payrollRunId,
      entityId,
      title: `Payroll Run — ${new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}`,
      totalAmount: String(totalAmount),
      status: 'reviewing',
      createdAt: new Date(),
    });

    await db.insert(payrollItems).values(
      extractedItems.map(item => ({
        id: ulid(),
        payrollRunId,
        recipientName: item.recipientName,
        recipientAccountOrTag: item.recipientAccountOrTag,
        amount: String(item.amount),
        status: 'pending' as const,
        errorMessage: null,
      }))
    );

    return reply.send({
      message: 'File parsed successfully. MANDATORY BLOCKING REVIEW REQUIRED before execution.',
      requiresReview: true,
      payrollRun: {
        id: payrollRunId,
        entityId,
        title: `Payroll Run — ${new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}`,
        totalAmount,
        status: 'reviewing',
        items: extractedItems,
        lowConfidenceItems: extractedItems.filter(i => i.confidenceScore < 0.85),
      },
    });
  });

  /**
   * Step 2: Execute approved payroll run.
   * Enforces server-side session, balance verification, real account lookup, and ledger journal entries.
   */
  server.post('/api/payroll/execute', async (request, reply) => {
    const session = request.session;
    if (!session) return reply.status(401).send({ error: 'Authentication required' });

    const { entityId, payrollRunId, approvedItems } = request.body as {
      entityId: string;
      payrollRunId: string;
      approvedItems: Array<{
        id: string;
        recipientName: string;
        recipientAccountOrTag: string;
        amount: number;
        currency?: string;
      }>;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    if (!payrollRunId || !approvedItems || approvedItems.length === 0) {
      return reply.status(400).send({ error: 'payrollRunId and at least one approved item are required' });
    }

    const runRows = await db.select().from(payrollRuns).where(eq(payrollRuns.id, payrollRunId)).limit(1);
    if (runRows.length === 0 || runRows[0].entityId !== entityId) {
      return reply.status(403).send({ error: 'Payroll run not found or does not belong to this entity' });
    }

    // 1. Balance verification check (C11)
    const totalRequired = approvedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const availableBalance = await getEntityBalance(db, entityId);

    if (availableBalance < totalRequired) {
      return reply.status(422).send({
        error: `Insufficient funds for payroll run. Required: NGN ${totalRequired.toLocaleString('en-US')}, Available: NGN ${availableBalance.toLocaleString('en-US')}`,
      });
    }

    // 2. Real Nuvion account lookup (C11)
    const accountRows = await db.select().from(accounts).where(eq(accounts.entityId, entityId)).limit(1);
    if (accountRows.length === 0) {
      return reply.status(400).send({ error: 'No active bank account found for entity. Complete KYC first.' });
    }
    const nuvionAccountId = accountRows[0].nuvionAccountId;

    await db.update(payrollRuns).set({ status: 'processing' }).where(eq(payrollRuns.id, payrollRunId));

    const results: any[] = [];
    const ledgerAccId = `${entityId}_cash`;
    const payrollClearingAccId = `${entityId}_payroll_clearing`;

    for (const item of approvedItems) {
      if (!item.recipientAccountOrTag || item.amount <= 0) {
        const result = { ...item, status: 'failed' as const, errorMessage: 'Invalid recipient or zero amount' };
        results.push(result);
        await db.update(payrollItems)
          .set({ status: 'failed', errorMessage: 'Invalid recipient or zero amount' })
          .where(eq(payrollItems.id, item.id));
        continue;
      }

      // 3. Skip already successful items on retry to prevent double payment (C11)
      const existingDbItem = await db.select().from(payrollItems).where(eq(payrollItems.id, item.id)).limit(1);
      if (existingDbItem.length > 0 && existingDbItem[0].status === 'success') {
        server.log.info({ itemId: item.id }, 'Payroll item already executed successfully. Skipping retry to prevent double payment.');
        results.push({ ...item, status: 'success' as const });
        continue;
      }

      try {
        await nuvion.executePayout({
          accountId: nuvionAccountId,
          paymentDetailId: (item as any).paymentDetailId || `pd_pay_${item.id}`,
          amount: item.amount,
          narration: `Payroll disbursement for ${item.recipientName || item.id}`,
          uniqueReference: `pay_ref_${Date.now()}_${item.id}`,
          paymentType: 'bank-transfer',
        });

        // 4. Record double-entry ledger entries upon successful payout (C11)
        const txId = ulid();
        await db.insert(ledgerEntries).values([
          { id: ulid(), entityId, transactionId: txId, ledgerAccountId: ledgerAccId, type: 'DEBIT', amount: String(item.amount), createdAt: new Date() },
          { id: ulid(), entityId, transactionId: txId, ledgerAccountId: payrollClearingAccId, type: 'CREDIT', amount: String(item.amount), createdAt: new Date() },
        ]);

        results.push({ ...item, status: 'success' as const });
        await db.update(payrollItems)
          .set({ status: 'success' })
          .where(eq(payrollItems.id, item.id));
      } catch (err: any) {
        const errMsg = err.message || 'Payout failed';
        results.push({ ...item, status: 'failed' as const, errorMessage: errMsg });
        await db.update(payrollItems)
          .set({ status: 'failed', errorMessage: errMsg })
          .where(eq(payrollItems.id, item.id));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const finalStatus = failedCount === 0 ? 'completed' : 'completed_with_errors';

    await db.update(payrollRuns).set({ status: finalStatus }).where(eq(payrollRuns.id, payrollRunId));

    return reply.send({
      payrollRunId,
      status: finalStatus,
      summary: {
        totalItems: results.length,
        successCount,
        failedCount,
        executedTotalAmount: results
          .filter(r => r.status === 'success')
          .reduce((acc, i) => acc + i.amount, 0),
      },
      lineItemResults: results,
    });
  });

  /**
   * List all payroll runs for an entity from DB.
   */
  const handleGetPayrollRuns = async (request: any, reply: any) => {
    const query = request.query as { entityId?: string; activeEntityId?: string };
    const targetEntityId = query.entityId || query.activeEntityId;
    if (!targetEntityId) return reply.status(400).send({ error: 'entityId query parameter required' });

    try {
      const runs = await db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.entityId, targetEntityId));

      return reply.send({ payrollRuns: runs });
    } catch {
      return reply.send({ payrollRuns: [] });
    }
  };

  server.get('/api/payroll', handleGetPayrollRuns);
  server.get('/api/payroll/runs', handleGetPayrollRuns);
}
