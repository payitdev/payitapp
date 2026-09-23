import React from 'react';
import { Users } from 'lucide-react';
import { usePayroll } from '../hooks/usePayroll';
import { ListRow } from '../components/ListRow';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen, SecondaryScreen } from '../types/navigation';

interface PayrollScreenProps {
  onNavigate: (screen: PrimaryScreen | SecondaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const PayrollScreen: React.FC<PayrollScreenProps> = ({ onNavigate }) => {
  const { payrollRunsList, fetchPayroll, loading, error } = usePayroll(undefined);

  const getStatusChip = (status: string) => {
    if (status?.toLowerCase() === 'completed') return <Chip tone="success">Completed</Chip>;
    if (status?.toLowerCase() === 'processing') return <Chip tone="warning">Processing</Chip>;
    if (status?.toLowerCase() === 'failed') return <Chip tone="danger">Failed</Chip>;
    return <Chip tone="neutral">{status || 'Pending'}</Chip>;
  };

  return (
    <div className="screen-container">
      <ScreenHeader title="Payroll" onBack={() => onNavigate('home')} />

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {/* Primary action */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            triggerLightHaptic();
            onNavigate('payroll-new');
          }}
          style={{ marginBottom: 20 }}
        >
          New payroll run
        </Button>

        <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginBottom: 20, lineHeight: 1.5 }}>
          Send salaries to your team in one batch payment.
        </div>

        {/* List */}
        {loading && payrollRunsList.length === 0 ? (
          <LoadingState rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPayroll()} />
        ) : payrollRunsList.length === 0 ? (
          <EmptyState message="No payroll runs yet — tap 'New payroll run' to get started." />
        ) : (
          <div>
            {payrollRunsList.map((pr: any) => (
              <ListRow
                key={pr.id}
                icon={<Users size={16} />}
                title={pr.title || 'Salary batch'}
                meta={`${pr.employeeCount || 1} recipients`}
                amount={`${pr.currency || 'NGN'} ${parseFloat(pr.totalAmount || '0').toLocaleString()}`}
                isIncoming={false}
                statusChip={getStatusChip(pr.status)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
