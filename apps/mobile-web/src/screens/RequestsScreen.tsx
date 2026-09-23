import React from 'react';
import { Bell } from 'lucide-react';
import { useRequests } from '../hooks/useRequests';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { Sheet } from '../components/Sheet';
import { Input } from '../components/Input';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface RequestsScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const RequestsScreen: React.FC<RequestsScreenProps> = ({ onNavigate, onEnterScreen }) => {
  const {
    pendingRequests,
    allRequestsList,
    requestsFilter,
    setRequestsFilter,
    requestPayer,
    setRequestPayer,
    requestAmount,
    setRequestAmount,
    requestNarration,
    setRequestNarration,
    isSubmittingRequest,
    requestStatusMsg,
    setRequestStatusMsg,
    handleCreatePaymentRequest,
    handleFulfillRequest,
    fetchRequests,
    loading,
    error,
  } = useRequests(undefined);

  const [showCreateSheet, setShowCreateSheet] = React.useState(false);

  const filtered = allRequestsList.filter(
    (r: any) => requestsFilter === 'all' || r.status === requestsFilter
  );

  const getStatusChip = (status: string) => {
    if (status === 'paid') return <Chip tone="success">Paid</Chip>;
    if (status === 'pending') return <Chip tone="warning">Pending</Chip>;
    if (status === 'declined') return <Chip tone="danger">Declined</Chip>;
    return <Chip tone="neutral">{status}</Chip>;
  };

  return (
    <div className="screen-container">
      <ScreenHeader title="Requests" onBack={() => onNavigate('home')} />

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {/* Primary action */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            triggerLightHaptic();
            setShowCreateSheet(true);
          }}
          style={{ marginBottom: 20 }}
        >
          Request money
        </Button>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['all', 'pending', 'paid', 'declined'] as const).map((f) => {
            const isActive = requestsFilter === f;
            const label = f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <button
                key={f}
                onClick={() => {
                  triggerLightHaptic();
                  setRequestsFilter(f);
                }}
                style={{
                  background: isActive ? 'rgba(53, 217, 208, 0.15)' : 'transparent',
                  color: isActive ? 'var(--accent-teal)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '6px 12px',
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

        {/* List */}
        {loading && allRequestsList.length === 0 ? (
          <LoadingState rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchRequests()} />
        ) : filtered.length === 0 ? (
          <EmptyState message="Nothing here yet — send a payment request to get started." />
        ) : (
          <div>
            {filtered.map((req: any) => (
              <ListRow
                key={req.id}
                icon={<Bell size={16} />}
                title={req.requesterUsername || 'A contact'}
                meta={req.narration || 'Payment request'}
                amount={`${req.currency ?? ''} ${req.amount ?? ''}`.trim()}
                isIncoming={req.status === 'paid'}
                statusChip={getStatusChip(req.status)}
                onClick={req.status === 'pending' ? () => {
                  triggerLightHaptic();
                  handleFulfillRequest(req.id);
                } : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheet: Create request */}
      <Sheet
        isOpen={showCreateSheet}
        onClose={() => {
          setShowCreateSheet(false);
          setRequestStatusMsg(null);
        }}
        title="Request money"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreatePaymentRequest(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <Input
            id="request-payer"
            label="Who are you requesting from?"
            type="text"
            placeholder="Enter their Proxim username"
            value={requestPayer}
            onChange={(e) => setRequestPayer(e.target.value)}
            required
          />
          <Input
            id="request-amount"
            label="How much?"
            type="number"
            step="0.01"
            min="1"
            placeholder="5,000.00"
            value={requestAmount}
            onChange={(e) => setRequestAmount(e.target.value)}
            required
          />
          <Input
            id="request-narration"
            label="What's it for? (optional)"
            type="text"
            placeholder="Dinner at Cactus Club"
            value={requestNarration}
            onChange={(e) => setRequestNarration(e.target.value)}
          />
          {requestStatusMsg && (
            <div
              style={{
                fontSize: 'var(--type-13)',
                color: requestStatusMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                fontFamily: 'var(--font-body)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: requestStatusMsg.type === 'success'
                  ? 'rgba(74, 222, 128, 0.08)'
                  : 'rgba(255, 77, 77, 0.08)',
              }}
            >
              {requestStatusMsg.text}
            </div>
          )}
          <Button variant="primary" type="submit" fullWidth disabled={isSubmittingRequest}>
            {isSubmittingRequest ? 'Sending request…' : 'Send request'}
          </Button>
        </form>
      </Sheet>
    </div>
  );
};
