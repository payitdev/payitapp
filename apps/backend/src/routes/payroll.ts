import { FastifyInstance } from 'fastify';
import { createDbClient, eq, desc } from '@payit/db';
import { payrollRuns, payrollItems, entities, feeLedger } from '@payit/db/schema';
import { BrailsClient, feeService } from '@payit/integrations';
import { ulid } from 'ulid';

const db = createDbClient();
const brails = new BrailsClient();

export async function payrollRoutes(server: FastifyInstance) {

  /**
   * List Payroll Runs for an Entity
   */
  server.get('/api/payroll', async (request, reply) => {
    const { entityId } = request.query as { entityId: string };
    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const runs = await db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.entityId, entityId))
      .orderBy(desc(payrollRuns.createdAt));

    const result = [];
    for (const run of runs) {
      const items = await db.select().from(payrollItems).where(eq(payrollItems.payrollRunId, run.id));
      result.push({
        ...run,
        recipientsCount: items.length,
        employeeCount: items.length || 1,
        items,
      });
    }

    return reply.send({ success: true, runs: result, payrollRuns: result });
  });

  const handleExecutePayroll = async (request: any, reply: any) => {
    const { entityId, title, currency = 'NGN', totalAmount, employeeCount = 1, recipients } = request.body as {
      entityId: string;
      title: string;
      currency?: string;
      totalAmount?: number;
      employeeCount?: number;
      recipients?: Array<{
        name: string;
        accountOrPhone: string;
        bankOrNetwork?: string;
        amount: number;
      }>;
    };

    if (!entityId || !title) {
      return reply.status(400).send({ error: 'entityId and title are required' });
    }

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) {
      return reply.status(404).send({ error: 'Entity not found' });
    }

    const recipientList = recipients && recipients.length > 0
      ? recipients
      : Array.from({ length: employeeCount || 1 }, (_, i) => ({
          name: `Employee ${i + 1}`,
          accountOrPhone: `012345678${i}`,
          bankOrNetwork: 'Bank Transfer',
          amount: totalAmount ? totalAmount / (employeeCount || 1) : 50000,
        }));

    const totalDisbursement = totalAmount || recipientList.reduce((sum, r) => sum + r.amount, 0);
    const feeCalculation = feeService.calculatePayrollFee(totalDisbursement, recipientList.length, currency);
    const runId = ulid();

    await db.insert(payrollRuns).values({
      id: runId,
      entityId,
      title: title || `Payroll Run - ${new Date().toLocaleDateString()}`,
      totalAmount: String(totalDisbursement.toFixed(2)),
      feeAmount: String(feeCalculation.feeAmount.toFixed(2)),
      currency,
      status: 'completed',
    });

    await db.insert(feeLedger).values({
      id: ulid(),
      entityId,
      transactionType: 'PAYROLL',
      referenceId: runId,
      grossAmount: String(feeCalculation.grossAmount.toFixed(4)),
      feeAmount: String(feeCalculation.feeAmount.toFixed(4)),
      netAmount: String(feeCalculation.netAmount.toFixed(4)),
      currency,
      description: feeCalculation.feeBreakdown.description,
    });

    const itemResults = [];

    for (const recipient of recipientList) {
      const itemId = ulid();
      let payoutId = null;
      let status: 'pending' | 'success' | 'failed' = 'success';

      try {
        const payout = await brails.initiatePayout({
          amount: recipient.amount,
          currency,
          reference: `proxim_pay_${itemId}`,
          accountNumber: recipient.accountOrPhone,
          accountName: recipient.name,
          narration: `Payroll: ${title}`,
          bankCode: recipient.bankOrNetwork,
        });

        payoutId = payout?.id || payout?.payout_id;
        if (!payoutId) throw new Error('Brails returned no payout identifier.');
      } catch (err: any) {
        console.error(`[Brails Payroll] ${recipient.name}:`, err.message);
        status = 'failed';
      }

      await db.insert(payrollItems).values({
        id: itemId,
        payrollRunId: runId,
        recipientName: recipient.name,
        recipientAccountOrPhone: recipient.accountOrPhone,
        bankOrNetwork: recipient.bankOrNetwork || null,
        amount: String(recipient.amount.toFixed(2)),
        currency,
        duePayoutId: payoutId,
        status,
      });

      itemResults.push({
        id: itemId,
        recipientName: recipient.name,
        amount: recipient.amount,
        status,
      });
    }

    return reply.send({
      success: true,
      payrollRun: {
        id: runId,
        title,
        totalAmount: totalDisbursement,
        currency,
        employeeCount: recipientList.length,
        feeAmount: feeCalculation.feeAmount,
        status: 'COMPLETED',
        recipients: itemResults,
      },
    });
  };

  /**
   * Run / Execute Payroll (supports both /api/payroll/run and /api/payroll/execute)
   */
  server.post('/api/payroll/run', handleExecutePayroll);
  server.post('/api/payroll/execute', handleExecutePayroll);
}
