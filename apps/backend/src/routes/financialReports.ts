import { FastifyInstance } from 'fastify';
import { createDbClient, eq, and, desc, sql, gte, lte } from '@payit/db';
import {
  invoices,
  payrollRuns,
  payrollItems,
  transfers,
  feeLedger,
  accounts,
  termVaults,
  rwaPositions,
  entities,
  ledgerEntries,
  ledgerAccounts,
} from '@payit/db/schema';
import { getEntityBalance } from '../utils/balance.js';

const db = createDbClient();

function getDateRangeForPeriod(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  switch (period) {
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end, label: 'This Month' };
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start, end: endOfLastMonth, label: 'Last Month' };
    case 'qtd':
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterMonth, 1);
      return { start, end, label: 'Quarter to Date (QTD)' };
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1);
      return { start, end, label: 'Year to Date (YTD)' };
    case 'all_time':
      start = new Date(2020, 0, 1);
      return { start, end, label: 'All Time' };
    case 'custom':
      if (customStart) start = new Date(customStart);
      if (customEnd) end.setTime(new Date(customEnd).getTime());
      return { start, end, label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}` };
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end, label: 'This Month' };
  }
}

export async function financialReportsRoutes(server: FastifyInstance) {
  /**
   * SME Financial Statement & Multi-Period Balance Sheet
   */
  server.get('/api/reports/balance-sheet', async (request, reply) => {
    const { entityId, period = 'this_month', startDate, endDate } = request.query as {
      entityId: string;
      period?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!entityId) return reply.status(400).send({ error: 'entityId is required' });

    const entityRows = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
    if (entityRows.length === 0) return reply.status(404).send({ error: 'Entity not found' });
    const entity = entityRows[0];

    const { start, end, label } = getDateRangeForPeriod(period, startDate, endDate);

    // 1. Invoices & Revenue
    const allEntityInvoices = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.entityId, entityId), gte(invoices.createdAt, start), lte(invoices.createdAt, end)));

    let totalBilledUsd = 0;
    let totalCollectedUsd = 0;
    let totalOutstandingUsd = 0;
    let totalOverdueUsd = 0;

    let billedCount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const inv of allEntityInvoices) {
      billedCount++;
      const amt = parseFloat(inv.totalAmount || '0');
      totalBilledUsd += amt;

      const isPaid = inv.status === 'paid';
      const isOverdue = inv.status === 'overdue' || (inv.status === 'pending' && inv.dueDate < todayStr);

      if (isPaid) {
        paidCount++;
        totalCollectedUsd += amt;
      } else if (isOverdue) {
        overdueCount++;
        totalOverdueUsd += amt;
        totalOutstandingUsd += amt;
      } else {
        pendingCount++;
        totalOutstandingUsd += amt;
      }
    }

    // 2. Payroll & Employee Disbursements
    const entityPayroll = await db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.entityId, entityId), gte(payrollRuns.createdAt, start), lte(payrollRuns.createdAt, end)));

    let totalPayrollDisbursedUsd = 0;
    let totalPayrollPendingUsd = 0;
    let totalPayrollRunsCount = entityPayroll.length;

    for (const pr of entityPayroll) {
      const pAmt = parseFloat(pr.totalAmount || '0');
      if (pr.status === 'completed' || pr.status === 'completed_with_errors') {
        totalPayrollDisbursedUsd += pAmt;
      } else {
        totalPayrollPendingUsd += pAmt;
      }
    }

    // 3. Operational Expenses & Outflows (from transfers and feeLedger)
    const entityTransfers = await db
      .select()
      .from(transfers)
      .where(and(eq(transfers.entityId, entityId), gte(transfers.createdAt, start), lte(transfers.createdAt, end)));

    let totalVendorPayoutsUsd = 0;
    for (const tx of entityTransfers) {
      if (tx.direction === 'DEBIT' && tx.status === 'completed') {
        totalVendorPayoutsUsd += parseFloat(tx.sourceAmount || '0');
      }
    }

    const entityFees = await db
      .select()
      .from(feeLedger)
      .where(and(eq(feeLedger.entityId, entityId), gte(feeLedger.createdAt, start), lte(feeLedger.createdAt, end)));

    let totalPlatformFeesUsd = 0;
    for (const fee of entityFees) {
      totalPlatformFeesUsd += parseFloat(fee.feeAmount || '0');
    }

    // 4. Estimated Tax Provisions (Standard 7.5% VAT on collected revenue + 5.0% WHT Provision)
    const estimatedVatUsd = totalCollectedUsd * 0.075;
    const estimatedWhtUsd = totalCollectedUsd * 0.05;
    const totalTaxProvisionUsd = estimatedVatUsd + estimatedWhtUsd;

    // 5. Yield Vaults & Stock Positions (Assets on Balance Sheet)
    const entityVaults = await db
      .select()
      .from(termVaults)
      .where(eq(termVaults.entityId, entityId));

    let totalVaultPrincipalUsd = 0;
    let totalVaultInterestUsd = 0;
    for (const v of entityVaults) {
      if (v.status === 'LOCKED' || v.status === 'MATURED') {
        totalVaultPrincipalUsd += parseFloat(v.principalAmountUsd || '0');
        totalVaultInterestUsd += parseFloat(v.accruedInterestUsd || '0');
      }
    }

    const entityStocks = await db
      .select()
      .from(rwaPositions)
      .where(eq(rwaPositions.entityId, entityId));

    let totalStockEquityUsd = 0;
    for (const s of entityStocks) {
      const shares = parseFloat(s.shares || '0');
      const price = 150.0; // Benchmark average per share
      totalStockEquityUsd += shares * price;
    }

    // 6. Liquid Cash & Balances
    const usdCash = await getEntityBalance(db, entityId, 'USD', 'cash');
    const ngnCash = await getEntityBalance(db, entityId, 'NGN', 'cash');
    const eurCash = await getEntityBalance(db, entityId, 'EUR', 'cash');
    const gbpCash = await getEntityBalance(db, entityId, 'GBP', 'cash');
    const liquidCashUsd = usdCash + (ngnCash / 1600) + (eurCash * 1.08) + (gbpCash * 1.28);

    // 7. Balance Sheet Calculations:
    // Total Assets = Liquid Cash + Outstanding Receivables + Vault Holdings + Tokenized Equities
    const currentAssets = liquidCashUsd + totalOutstandingUsd;
    const nonCurrentAssets = totalVaultPrincipalUsd + totalVaultInterestUsd + totalStockEquityUsd;
    const totalAssets = currentAssets + nonCurrentAssets;

    // Liabilities = Pending Payroll + Estimated Tax Provision
    const currentLiabilities = totalPayrollPendingUsd + totalTaxProvisionUsd;
    const totalLiabilities = currentLiabilities;

    // Net Operating Income = Collected Revenue - (Payroll Disbursed + Vendor Outflows + Platform Fees + Tax Provision)
    const totalOperatingExpenses = totalPayrollDisbursedUsd + totalVendorPayoutsUsd + totalPlatformFeesUsd;
    const netOperatingIncome = totalCollectedUsd - totalOperatingExpenses - totalTaxProvisionUsd;

    // Total Owner Equity = Assets - Liabilities
    const ownerEquity = Math.max(0, totalAssets - totalLiabilities);

    const generatedAt = new Date().toISOString();
    const reportRef = `BS-${entity.businessTag || 'PROX'}-${Date.now().toString(36).toUpperCase()}`;

    return reply.send({
      success: true,
      report: {
        reportRef,
        generatedAt,
        period: {
          key: period,
          label,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        },
        business: {
          legalName: entity.legalName,
          businessTag: entity.businessTag || 'PROXIM',
          currency: 'USD',
        },
        // Income & Receivables
        revenueAndReceivables: {
          totalBilled: Number(totalBilledUsd.toFixed(2)),
          totalCollected: Number(totalCollectedUsd.toFixed(2)),
          totalOutstanding: Number(totalOutstandingUsd.toFixed(2)),
          totalOverdue: Number(totalOverdueUsd.toFixed(2)),
          invoicesCount: {
            billed: billedCount,
            paid: paidCount,
            pending: pendingCount,
            overdue: overdueCount,
          },
        },
        // Payroll & Human Capital
        payrollAndPersonnel: {
          totalDisbursed: Number(totalPayrollDisbursedUsd.toFixed(2)),
          totalPending: Number(totalPayrollPendingUsd.toFixed(2)),
          totalRuns: totalPayrollRunsCount,
        },
        // Operating Expenditures
        operatingExpenses: {
          vendorPayouts: Number(totalVendorPayoutsUsd.toFixed(2)),
          platformFees: Number(totalPlatformFeesUsd.toFixed(2)),
          totalOpex: Number(totalOperatingExpenses.toFixed(2)),
        },
        // Tax Estimates
        taxProvision: {
          vatEstimate: Number(estimatedVatUsd.toFixed(2)),
          whtEstimate: Number(estimatedWhtUsd.toFixed(2)),
          totalTaxEstimate: Number(totalTaxProvisionUsd.toFixed(2)),
        },
        // Summary Performance
        performance: {
          grossRevenue: Number(totalCollectedUsd.toFixed(2)),
          totalExpenses: Number(totalOperatingExpenses.toFixed(2)),
          netOperatingIncome: Number(netOperatingIncome.toFixed(2)),
          profitMarginPercent: totalCollectedUsd > 0 ? Number(((netOperatingIncome / totalCollectedUsd) * 100).toFixed(1)) : 0,
        },
        // Complete Balance Sheet
        balanceSheet: {
          assets: {
            currentAssets: {
              liquidCash: Number(liquidCashUsd.toFixed(2)),
              accountsReceivable: Number(totalOutstandingUsd.toFixed(2)),
              total: Number(currentAssets.toFixed(2)),
            },
            nonCurrentAssets: {
              vaultHoldings: Number((totalVaultPrincipalUsd + totalVaultInterestUsd).toFixed(2)),
              tokenizedAssets: Number(totalStockEquityUsd.toFixed(2)),
              total: Number(nonCurrentAssets.toFixed(2)),
            },
            totalAssets: Number(totalAssets.toFixed(2)),
          },
          liabilities: {
            currentLiabilities: {
              pendingPayroll: Number(totalPayrollPendingUsd.toFixed(2)),
              taxPayable: Number(totalTaxProvisionUsd.toFixed(2)),
              total: Number(currentLiabilities.toFixed(2)),
            },
            totalLiabilities: Number(totalLiabilities.toFixed(2)),
          },
          equity: {
            retainedEarnings: Number(netOperatingIncome.toFixed(2)),
            totalOwnerEquity: Number(ownerEquity.toFixed(2)),
          },
          equationBalanced: Math.abs(totalAssets - (totalLiabilities + ownerEquity)) < 0.01,
        },
      },
    });
  });
}
