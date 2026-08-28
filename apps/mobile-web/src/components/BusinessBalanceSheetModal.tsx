import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, X, Calendar, DollarSign, Users, TrendingUp, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface Props {
  entityId: string;
  onClose: () => void;
  token?: string | null;
}

export const BusinessBalanceSheetModal: React.FC<Props> = ({ entityId, onClose, token }) => {
  const [period, setPeriod] = useState<string>('this_month');
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport(period);
  }, [entityId, period]);

  const fetchReport = async (selectedPeriod: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/reports/balance-sheet?entityId=${encodeURIComponent(entityId)}&period=${encodeURIComponent(selectedPeriod)}`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate financial statement.');
      setReport(data.report);
    } catch (err: any) {
      setError(err.message || 'Unable to fetch report.');
    } finally {
      setIsLoading(false);
    }
  };

  const periods = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'qtd', label: 'Quarter to Date (QTD)' },
    { key: 'ytd', label: 'Year to Date (YTD)' },
    { key: 'all_time', label: 'All Time' },
  ];

  const fmt = (num: number = 0) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5, 8, 17, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#0D1424', border: '1px solid rgba(53, 217, 208, 0.3)', borderRadius: 24, width: '100%', maxWidth: 740, maxHeight: '90vh', overflowY: 'auto', color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif", padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(53, 217, 208, 0.15)', color: '#35D9D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Bricolage Grotesque', margin: 0 }}>Business Financial Statement & Balance Sheet</h2>
              <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.6)', marginTop: 2 }}>Audited P&L, Invoicing, Payroll, Tax Provision & Double-Entry Ledger</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#F7F8F4', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Period Selector Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
          {periods.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: period === p.key ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.08)',
                background: period === p.key ? 'rgba(53, 217, 208, 0.15)' : 'rgba(255,255,255,0.03)',
                color: period === p.key ? '#35D9D0' : '#F7F8F4',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(53, 217, 208, 0.2)', borderTopColor: '#35D9D0', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.6)' }}>Aggregating Double-Entry Ledger & Accounts…</div>
          </div>
        ) : error || !report ? (
          <div style={{ padding: 30, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 16, textAlign: 'center' }}>
            <AlertCircle size={32} color="#EF4444" style={{ margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: 13, color: '#FCA5A5' }}>{error || 'Failed to load report.'}</p>
          </div>
        ) : (
          <div>
            {/* Top Stat Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(5, 8, 17, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', fontWeight: 700 }}>COLLECTED REVENUE</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#35D9D0', marginTop: 4 }}>${fmt(report.revenueAndReceivables.totalCollected)}</div>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.6)', marginTop: 4 }}>{report.revenueAndReceivables.invoicesCount.paid} Paid Invoices</div>
              </div>
              <div style={{ background: 'rgba(5, 8, 17, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', fontWeight: 700 }}>OUTSTANDING RECEIVABLES</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#FBBF24', marginTop: 4 }}>${fmt(report.revenueAndReceivables.totalOutstanding)}</div>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.6)', marginTop: 4 }}>{report.revenueAndReceivables.invoicesCount.pending + report.revenueAndReceivables.invoicesCount.overdue} Unpaid Invoices</div>
              </div>
              <div style={{ background: 'rgba(5, 8, 17, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', fontWeight: 700 }}>PAYROLL & SALARIES</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#F87171', marginTop: 4 }}>${fmt(report.payrollAndPersonnel.totalDisbursed)}</div>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.6)', marginTop: 4 }}>{report.payrollAndPersonnel.totalRuns} Disbursal Runs</div>
              </div>
              <div style={{ background: 'rgba(5, 8, 17, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', fontWeight: 700 }}>NET OPERATING INCOME</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: report.performance.netOperatingIncome >= 0 ? '#4ADE80' : '#EF4444', marginTop: 4 }}>
                  ${fmt(report.performance.netOperatingIncome)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.6)', marginTop: 4 }}>Margin: {report.performance.profitMarginPercent}%</div>
              </div>
            </div>

            {/* Income & Expense Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {/* Income / Invoicing */}
              <div style={{ background: 'rgba(5, 8, 17, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#35D9D0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} /> Revenue & Receivables
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Total Invoices Billed:</span>
                    <strong style={{ color: '#ffffff' }}>${fmt(report.revenueAndReceivables.totalBilled)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Settled Revenue (Paid):</span>
                    <strong style={{ color: '#4ADE80' }}>${fmt(report.revenueAndReceivables.totalCollected)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Pending Due Receivables:</span>
                    <strong style={{ color: '#FBBF24' }}>${fmt(report.revenueAndReceivables.totalOutstanding - report.revenueAndReceivables.totalOverdue)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Past Due / Overdue:</span>
                    <strong style={{ color: '#EF4444' }}>${fmt(report.revenueAndReceivables.totalOverdue)}</strong>
                  </div>
                </div>
              </div>

              {/* Operating Outflows & Taxes */}
              <div style={{ background: 'rgba(5, 8, 17, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#F87171', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} /> OPEX, Salaries & Tax Provisions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Salaries Disbursed:</span>
                    <strong style={{ color: '#ffffff' }}>${fmt(report.payrollAndPersonnel.totalDisbursed)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Vendor / Outbound Payouts:</span>
                    <strong style={{ color: '#ffffff' }}>${fmt(report.operatingExpenses.vendorPayouts)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Platform Processing Fees:</span>
                    <strong style={{ color: '#ffffff' }}>${fmt(report.operatingExpenses.platformFees)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.6)' }}>Est. VAT & WHT Provisions:</span>
                    <strong style={{ color: '#FBBF24' }}>${fmt(report.taxProvision.totalTaxEstimate)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Formal Balance Sheet Table */}
            <div style={{ background: 'rgba(5, 8, 17, 0.85)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 18, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#35D9D0' }}>Balance Sheet Statement</div>
                <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)', fontFamily: 'monospace' }}>Ref: {report.reportRef}</div>
              </div>

              {/* ASSETS */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#F7F8F4', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>1. Assets</div>
                <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>Liquid Cash & Bank Reserves:</span>
                    <span>${fmt(report.balanceSheet.assets.currentAssets.liquidCash)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>Accounts Receivable (Unpaid Invoices):</span>
                    <span>${fmt(report.balanceSheet.assets.currentAssets.accountsReceivable)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>High-Yield Term Vault Reserves:</span>
                    <span>${fmt(report.balanceSheet.assets.nonCurrentAssets.vaultHoldings)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>Tokenized Equities & Stock Assets:</span>
                    <span>${fmt(report.balanceSheet.assets.nonCurrentAssets.tokenizedAssets)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, fontWeight: 800, color: '#35D9D0' }}>
                    <span>TOTAL ASSETS:</span>
                    <span>${fmt(report.balanceSheet.assets.totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* LIABILITIES & EQUITY */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#F7F8F4', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>2. Liabilities & Owner Equity</div>
                <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>Pending Payroll Commitments:</span>
                    <span>${fmt(report.balanceSheet.liabilities.currentLiabilities.pendingPayroll)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>Estimated Taxes Payable (VAT / WHT):</span>
                    <span>${fmt(report.balanceSheet.liabilities.currentLiabilities.taxPayable)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(247, 248, 244, 0.7)' }}>Retained Operating Earnings:</span>
                    <span>${fmt(report.balanceSheet.equity.retainedEarnings)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, fontWeight: 800, color: '#4ADE80' }}>
                    <span>TOTAL LIABILITIES & EQUITY:</span>
                    <span>${fmt(report.balanceSheet.liabilities.totalLiabilities + report.balanceSheet.equity.totalOwnerEquity)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions: Print / Export */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.5)' }}>
                Generated: {new Date(report.generatedAt).toLocaleString()} · Period: {report.period.label}
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                style={{ background: '#35D9D0', color: '#050811', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={15} /> Export / Print PDF Statement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
