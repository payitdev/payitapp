import React from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useTransactions, Transaction } from '../hooks/useTransactions';
import { ListRow } from '../components/ListRow';
import { BottomNav } from '../components/layout/BottomNav';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { Sheet } from '../components/Sheet';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface ActivityScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const ActivityScreen: React.FC<ActivityScreenProps> = ({ onNavigate, onEnterScreen }) => {
  const {
    transactions,
    activityFilter,
    setActivityFilter,
    loading,
    error,
    fetchTransactions,
    fetchPayoutTracker,
    trackerData,
    showTrackerModal,
    setShowTrackerModal,
  } = useTransactions();

  // Helper to format date header: "Today", "Yesterday", or date string
  const getDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    if (dateStr === today || dateStr.toLowerCase().includes('today')) return 'Today';
    if (dateStr === yesterday || dateStr.toLowerCase().includes('yesterday')) return 'Yesterday';
    return dateStr;
  };

  // Group transactions by date label
  const groupedTransactions = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const label = getDateLabel(tx.date || 'Recent');
    if (!acc[label]) acc[label] = [];
    acc[label].push(tx);
    return acc;
  }, {});

  return (
    <div className="screen-container">
      {/* Top bar with plain title (24px Bricolage) */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--type-24)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Activity
        </div>

        {/* Single-row filter control (All / In / Out) as Ghost segments */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
            alignItems: 'center',
          }}
        >
          {(['all', 'in', 'out'] as const).map((filter) => {
            const isActive = activityFilter === filter;
            const label = filter === 'all' ? 'All' : filter === 'in' ? 'Received' : 'Sent';
            return (
              <button
                key={filter}
                onClick={() => {
                  triggerLightHaptic();
                  setActivityFilter(filter);
                }}
                style={{
                  background: isActive ? 'rgba(53, 217, 208, 0.15)' : 'transparent',
                  color: isActive ? 'var(--accent-teal)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '6px 14px',
                  fontSize: 'var(--type-13)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {loading && transactions.length === 0 ? (
          <LoadingState rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchTransactions()} />
        ) : transactions.length === 0 ? (
          <EmptyState message="Nothing yet — your activity will show up here." />
        ) : (
          <div>
            {Object.entries(groupedTransactions).map(([dateLabel, txList]) => (
              <div key={dateLabel} style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    fontSize: 'var(--type-11)',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                    marginBottom: '8px',
                    textTransform: 'none',
                  }}
                >
                  {dateLabel}
                </div>
                {txList.map((tx) => {
                  const isIncoming = tx.type === 'INBOUND';
                  const formattedAmount = `${isIncoming ? '+' : '-'}${tx.symbol}${tx.amount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`;

                  return (
                    <ListRow
                      key={tx.id}
                      icon={isIncoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      title={tx.title}
                      meta={`${tx.subtitle} · ${tx.time || tx.date}`}
                      amount={formattedAmount}
                      isIncoming={isIncoming}
                      onClick={() => {
                        triggerLightHaptic();
                        fetchPayoutTracker(tx.id);
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail / Tracker Sheet */}
      <Sheet
        isOpen={showTrackerModal}
        onClose={() => setShowTrackerModal(false)}
        title="Payment details"
      >
        {trackerData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-body)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)' }}>Reference</span>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-primary)', fontWeight: 500 }}>{trackerData.uetrReference || trackerData.payoutId}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)' }}>Status</span>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--accent-teal)', fontWeight: 700 }}>{trackerData.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)' }}>Network</span>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-primary)', fontWeight: 500 }}>{trackerData.clearingNetwork}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)' }}>Estimated delivery</span>
              <span style={{ fontSize: 'var(--type-13)', color: 'var(--text-primary)', fontWeight: 500 }}>{trackerData.estimatedDelivery}</span>
            </div>
          </div>
        )}
      </Sheet>

      {/* Floating Bottom Nav */}
      <BottomNav active="activity" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};
