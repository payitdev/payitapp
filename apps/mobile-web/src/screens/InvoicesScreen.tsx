import React from 'react';
import { FileText } from 'lucide-react';
import { useInvoices } from '../hooks/useInvoices';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';
import type { SecondaryScreen } from '../types/navigation';

interface InvoicesScreenProps {
  onNavigate: (screen: PrimaryScreen | SecondaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const InvoicesScreen: React.FC<InvoicesScreenProps> = ({ onNavigate }) => {
  const {
    invoicesList,
    invoiceStatusFilter,
    setInvoiceStatusFilter,
    setSelectedInvoiceForModal,
    loading,
    error,
    fetchInvoices,
  } = useInvoices(undefined);

  const filtered = invoicesList.filter(
    (inv: any) => invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter
  );

  const getStatusChip = (status: string) => {
    if (status === 'paid') return <Chip tone="success">Paid</Chip>;
    if (status === 'overdue') return <Chip tone="danger">Overdue</Chip>;
    if (status === 'pending') return <Chip tone="warning">Unpaid</Chip>;
    return <Chip tone="neutral">{status}</Chip>;
  };

  const totalBilled = invoicesList.reduce(
    (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || inv.amount || '0'),
    0
  );
  const totalCollected = invoicesList
    .filter((inv: any) => inv.status === 'paid')
    .reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount || inv.amount || '0'), 0);
  const totalOutstanding = totalBilled - totalCollected;

  return (
    <div className="screen-container">
      <ScreenHeader title="Invoices" onBack={() => onNavigate('home')} />

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Billed', value: `$${totalBilled.toLocaleString()}`, color: 'var(--text-primary)' },
            { label: 'Collected', value: `$${totalCollected.toLocaleString()}`, color: 'var(--success)' },
            { label: 'Outstanding', value: `$${totalOutstanding.toLocaleString()}`, color: 'var(--warning)' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--type-11)',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                  marginBottom: 4,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 'var(--type-15)',
                  fontWeight: 800,
                  color: stat.color,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Primary action */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            triggerLightHaptic();
            onNavigate('invoice-new');
          }}
          style={{ marginBottom: 20 }}
        >
          New invoice
        </Button>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['all', 'unpaid', 'paid', 'overdue'] as const).map((f) => {
            const isActive = invoiceStatusFilter === f;
            const counts: Record<string, number> = {
              all: invoicesList.length,
              unpaid: invoicesList.filter((i: any) => i.status === 'unpaid' || i.status === 'pending').length,
              paid: invoicesList.filter((i: any) => i.status === 'paid').length,
              overdue: invoicesList.filter((i: any) => i.status === 'overdue').length,
            };
            const label = f === 'all' ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`;
            return (
              <button
                key={f}
                onClick={() => {
                  triggerLightHaptic();
                  setInvoiceStatusFilter(f);
                }}
                style={{
                  background: isActive ? 'rgba(53, 217, 208, 0.15)' : 'transparent',
                  color: isActive ? 'var(--accent-teal)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '6px 10px',
                  fontSize: 'var(--type-11)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading && invoicesList.length === 0 ? (
          <LoadingState rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchInvoices()} />
        ) : filtered.length === 0 ? (
          <EmptyState message="No invoices yet — tap 'New invoice' to create your first." />
        ) : (
          <div>
            {filtered.map((inv: any) => (
              <ListRow
                key={inv.id}
                icon={<FileText size={16} />}
                title={inv.clientName || 'Valued client'}
                meta={`Due ${inv.dueDate || '14 days'} · ${inv.tag || inv.id?.slice(0, 8)}`}
                amount={`${inv.currency || 'USD'} ${parseFloat(inv.amount || inv.totalAmount || '0').toLocaleString()}`}
                isIncoming={inv.status === 'paid'}
                statusChip={getStatusChip(inv.status)}
                onClick={() => {
                  triggerLightHaptic();
                  setSelectedInvoiceForModal(inv);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
