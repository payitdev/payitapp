import React from 'react';
import { 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Users, 
  ShieldCheck, 
  Briefcase 
} from 'lucide-react';
import { StatusBar } from '../components/layout/StatusBar';
import { AuroraBar } from '../components/layout/AuroraBar';
import { BottomNav } from '../components/layout/BottomNav';
import { StatusCard } from '../components/StatusCard';
import { ListRow } from '../components/ListRow';
import { useAccount, getLegalDisplayName, getLegalFirstName } from '../context/AccountContext';
import { useTransactions } from '../hooks/useTransactions';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface HomeScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
  formatDisplayBalance: () => string;
  getTrueUsdcBalance: () => string;
  getAssetSummary: () => string | null;
  onChainBalanceError: string | null;
  selectedCurrency: string;
  onOpenCurrencyPicker: () => void;
  onOpenSend: () => void;
  onOpenReceive: () => void;
  onOpenRequest: () => void;
  onOpenContacts: () => void;
  onOpenSave: () => void;
  onOpenKyc: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onEnterScreen,
  formatDisplayBalance,
  selectedCurrency,
  onOpenCurrencyPicker,
  onOpenSend,
  onOpenReceive,
  onOpenRequest,
  onOpenContacts,
  onOpenSave,
  onOpenKyc,
}) => {
  const { accountType, activeEntity, currentUser, kycStatus, kycTier, toggleAccountMode } = useAccount();
  const { transactions } = useTransactions();

  const displayName = getLegalDisplayName(activeEntity, currentUser);
  const firstName = getLegalFirstName(activeEntity, currentUser);
  const avatarInitial = (displayName.charAt(0) || 'P').toUpperCase();

  return (
    <div className="screen-container">
      <StatusBar brand="Proxim" />

      {/* Top greeting bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--type-15)',
              fontWeight: 800,
              color: 'var(--accent-teal)',
            }}
          >
            {avatarInitial}
          </div>
          <div>
            <div style={{ fontSize: 'var(--type-11)', color: 'var(--text-muted)', fontWeight: 700 }}>
              {accountType === 'PERSONAL' ? 'Good day' : 'Corporate Treasury'}
            </div>
            <div style={{ fontSize: 'var(--type-15)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {firstName}
            </div>
          </div>
        </div>

        {/* Account Mode Switcher */}
        <button
          onClick={() => {
            triggerLightHaptic();
            toggleAccountMode();
          }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: 'var(--type-13)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            transition: 'background 150ms ease',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: accountType === 'PERSONAL' ? 'var(--accent-teal)' : 'var(--accent-indigo)',
              boxShadow: `0 0 8px ${accountType === 'PERSONAL' ? 'var(--accent-teal)' : 'var(--accent-indigo)'}`,
            }}
          />
          {accountType === 'PERSONAL' ? 'Personal' : 'Business'}
        </button>
      </div>

      <div style={{ flex: 1, paddingBottom: 24 }}>
        {/* Verification Banner */}
        <div style={{ padding: '0 20px 14px' }}>
          {kycStatus === 'pending' && (
            <StatusCard
              tone="pending"
              title="Verification in review"
              subtitle="Your accounts will activate once confirmed."
            />
          )}
          {kycStatus === 'approved' && (
            <StatusCard
              tone="success"
              title={`Verified ${accountType === 'PERSONAL' ? 'Personal' : 'Business'} Account`}
              subtitle={`Tier ${kycTier} · Full limit access active`}
            />
          )}
          {kycStatus === 'unverified' && (
            <StatusCard
              tone="action"
              title="Verify your identity"
              subtitle="Unlock your dedicated local account in 60 seconds."
              cta={{
                label: 'Verify ID',
                onClick: onOpenKyc,
              }}
            />
          )}
        </div>

        {/* Hero Balance Card */}
        <div
          style={{
            margin: '0 20px',
            padding: '20px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <AuroraBar sweep />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--type-11)', fontWeight: 700 }}>
              {accountType === 'PERSONAL' ? 'Available Balance' : 'Corporate Treasury Balance'}
            </span>
            <button
              onClick={() => {
                triggerLightHaptic();
                onOpenCurrencyPicker();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                color: 'var(--text-primary)',
                fontSize: 'var(--type-11)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              aria-label="Switch active currency"
            >
              <span>{selectedCurrency}</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div
            className="num"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: accountType === 'PERSONAL' ? 'var(--type-42)' : 'var(--type-34)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.8px',
              margin: '8px 0 2px',
              lineHeight: 1.1,
            }}
          >
            {formatDisplayBalance()}
          </div>

          <div style={{ color: 'var(--accent-teal)', fontSize: 'var(--type-13)', fontWeight: 700, marginTop: 4 }}>
            Ready when you are
          </div>

          {/* Quick Actions Component */}
          <div style={{ marginTop: 20 }}>
            {accountType === 'BUSINESS' ? (
              <div>
                {/* Primary Button */}
                <button
                  onClick={() => {
                    triggerLightHaptic();
                    onOpenReceive();
                  }}
                  style={{
                    width: '100%',
                    height: 48,
                    background: 'var(--gradient-aurora)',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    color: '#ffffff',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--type-15)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    marginBottom: 14,
                  }}
                >
                  <ArrowDownLeft size={18} strokeWidth={2.2} />
                  <span>Receive Payment</span>
                </button>

                {/* Secondary Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
                  <QuickCircleButton
                    icon={<FileText size={20} strokeWidth={1.8} />}
                    label="Invoices"
                    onClick={() => onNavigate('invoices' as PrimaryScreen)}
                  />
                  <QuickCircleButton
                    icon={<Briefcase size={20} strokeWidth={1.8} />}
                    label="Payroll"
                    onClick={() => onNavigate('payroll' as PrimaryScreen)}
                  />
                  <QuickCircleButton
                    icon={<ArrowUpRight size={20} strokeWidth={1.8} />}
                    label="Send"
                    onClick={onOpenSend}
                  />
                </div>
              </div>
            ) : (
              <div>
                {/* Primary Button */}
                <button
                  onClick={() => {
                    triggerLightHaptic();
                    onOpenSend();
                  }}
                  style={{
                    width: '100%',
                    height: 48,
                    background: 'var(--gradient-aurora)',
                    borderRadius: 'var(--radius-pill)',
                    border: 'none',
                    color: '#ffffff',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--type-15)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    marginBottom: 14,
                  }}
                >
                  <ArrowUpRight size={18} strokeWidth={2.2} />
                  <span>Send Money</span>
                </button>

                {/* Secondary Circular Actions Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 12 }}>
                  <QuickCircleButton
                    icon={<ArrowDownLeft size={20} strokeWidth={1.8} />}
                    label="Receive"
                    onClick={onOpenReceive}
                  />
                  <QuickCircleButton
                    icon={<FileText size={20} strokeWidth={1.8} />}
                    label="Request"
                    onClick={onOpenRequest}
                  />
                  <QuickCircleButton
                    icon={<Users size={20} strokeWidth={1.8} />}
                    label="Contacts"
                    onClick={onOpenContacts}
                  />
                  <QuickCircleButton
                    icon={<ShieldCheck size={20} strokeWidth={1.8} />}
                    label="Vault"
                    onClick={onOpenSave}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div style={{ marginTop: 24, padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--type-20)',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Recent activity
            </h3>
            {transactions.length > 0 && (
              <button
                onClick={() => {
                  triggerLightHaptic();
                  onNavigate('activity');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-teal)',
                  fontSize: 'var(--type-13)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                See all
              </button>
            )}
          </div>

          {transactions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 0',
                color: 'var(--text-muted)',
                fontSize: 'var(--type-13)',
              }}
            >
              Nothing yet — your activity will show up here.
            </div>
          ) : (
            <div>
              {transactions.slice(0, 5).map((tx) => (
                <ListRow
                  key={tx.id}
                  icon={tx.type === 'INBOUND' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  title={tx.title}
                  meta={`${tx.date} · ${tx.subtitle}`}
                  amount={`${tx.type === 'INBOUND' ? '+' : '-'}${tx.symbol || ''}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  isIncoming={tx.type === 'INBOUND'}
                  onClick={() => onNavigate('activity')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="home" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};

const QuickCircleButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={() => {
      triggerLightHaptic();
      onClick();
    }}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary)',
        transition: 'transform 100ms ease, background 150ms ease',
      }}
    >
      {icon}
    </div>
    <span style={{ fontSize: 'var(--type-11)', color: 'var(--text-muted)', fontWeight: 500 }}>
      {label}
    </span>
  </button>
);
