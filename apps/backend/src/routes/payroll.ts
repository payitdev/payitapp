import { FastifyInstance } from 'fastify';
import { GeminiOcrParser } from '@payit/ai';
import { validateEntityAccess } from '@payit/ledger';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq } from '@payit/db';
import { payrollRuns, payrollItems, entities } from '@payit/db/schema';
import { ulid } from 'ulid';

const ocr = new GeminiOcrParser();
const nuvion = new NuvionClient();
const db = createDbClient();

export async function payrollRoutes(server: FastifyInstance) {

  /**
   * Step 1: Upload and OCR-extract payroll file using Gemini Flash.
   * Requires multipart form upload with file buffer.
   * Saves draft payroll run to DB for mandatory human review.
   */
  server.post('/api/payroll/extract', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const { session, entityId } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
    };

    try {
      validateEntityAccess(session, entityId);
    } catch (err: any) {
      return reply.status(403).send({ error: err.message });
    }

    // Verify entity exists
    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    // Get file from multipart OR raw body
    const files = (request as any).files;
    let fileBuffer: Buffer;
    let fileName: string;

    if (files && files.payrollFile) {
      const file = files.payrollFile;
      fileBuffer = Buffer.from(await file.toBuffer());
      fileName = file.filename || 'payroll.pdf';
    } else if ((request as any).rawBody) {
      // Fallback: accept raw body with filename header
      fileBuffer = Buffer.from((request as any).rawBody);
      fileName = (request.headers['x-filename'] as string) || 'payroll.pdf';
    } else {
      return reply.status(400).send({
        error: 'Payroll file is required. Send as multipart form-data with field name "payrollFile".',
      });
    }

    // Call real Gemini Flash OCR
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

    // Save draft payroll run to DB
    await db.insert(payrollRuns).values({
      id: payrollRunId,
      entityId,
      title: `Payroll Run — ${new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}`,
      totalAmount: String(totalAmount),
      status: 'reviewing',
      createdAt: new Date(),
    });

    // Save extracted line items to DB
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
   * Step 2: Execute approved payroll run. Each line item executes independently.
   * One failed item does not block the rest. Results updated in DB.
   */
  server.post('/api/payroll/execute', async (request, reply) => {
    const { session, entityId, payrollRunId, approvedItems } = request.body as {
      session: { userId: string; activeEntityId: string; userEntityIds: string[] };
      entityId: string;
      payrollRunId: string;
      approvedItems: Array<{
        id: string;
        recipientName: string;
        recipientAccountOrTag: string;
        amount: number;
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

    // Verify the payroll run belongs to this entity
    const runRows = await db.select().from(payrollRuns).where(eq(payrollRuns.id, payrollRunId)).limit(1);
    if (runRows.length === 0 || runRows[0].entityId !== entityId) {
      return reply.status(403).send({ error: 'Payroll run not found or does not belong to this entity' });
    }

    // Update status to processing
    await db.update(payrollRuns).set({ status: 'processing' }).where(eq(payrollRuns.id, payrollRunId));

    // Execute each item independently via Nuvion payout
    const results: any[] = [];
    for (const item of approvedItems) {
      if (!item.recipientAccountOrTag || item.amount <= 0) {
        const result = { ...item, status: 'failed' as const, errorMessage: 'Invalid recipient or zero amount' };
        results.push(result);
        await db.update(payrollItems)
          .set({ status: 'failed', errorMessage: 'Invalid recipient or zero amount' })
          .where(eq(payrollItems.id, item.id));
        continue;
      }

      try {
        // Execute payout via Nuvion
        await nuvion.executePayout({
          nuvionAccountId: `nacc_${entityId}`,
          destinationAccount: item.recipientAccountOrTag,
          amount: item.amount,
          currency: 'NGN',
        });

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
    const finalStatus = failedCount === 0 ? 'completed' : 'completed';

    // Update payroll run status in DB
    await db.update(payrollRuns).set({ status: finalStatus }).where(eq(payrollRuns.id, payrollRunId));

    return reply.send({
      payrollRunId,
      status: failedCount === 0 ? 'completed' : 'completed_with_errors',
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
  server.get('/api/payroll/runs', async (request, reply) => {
    const { activeEntityId } = request.query as { activeEntityId?: string };
    if (!activeEntityId) return reply.status(400).send({ error: 'activeEntityId query parameter required' });

    const runs = await db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.entityId, activeEntityId));

    return reply.send({ payrollRuns: runs });
  });
}
