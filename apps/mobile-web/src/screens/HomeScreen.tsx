import React from 'react';
import { Lock, Clock, CheckCircle2, ChevronDown } from 'lucide-react';
import { StatusBar } from '../components/layout/StatusBar';
import { AuroraBar } from '../components/layout/AuroraBar';
import { BottomNav } from '../components/layout/BottomNav';
import { useAccount, getLegalDisplayName, getLegalFirstName } from '../context/AccountContext';
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

/**
 * Behavior parity with the old inline `screen-home` block (App.tsx
 * ~1745-2050): same KYC banner states, same hero balance, same quick-action
 * row. What's different is structural — this file only knows about Home.
 * It can't accidentally break the Cards screen's nav highlight, because it
 * doesn't contain the Cards screen.
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onEnterScreen,
  formatDisplayBalance,
  getTrueUsdcBalance,
  getAssetSummary,
  onChainBalanceError,
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
  const assetSummary = getAssetSummary();

  return (
    <div className="screen active" id="screen-home">
      <StatusBar brand="Proxim" />

      <div className="topbar">
        <div className="greeting-block">
          <div className="avatar">{(getLegalDisplayName(activeEntity, currentUser).charAt(0) || 'P').toUpperCase()}</div>
          <div className="greeting-text">
            <div className="eyebrow">{accountType === 'PERSONAL' ? 'Good evening' : 'Corporate Account'}</div>
            <div className="name">{getLegalFirstName(activeEntity, currentUser)}</div>
          </div>
        </div>

        <div className={`switcher ${accountType === 'BUSINESS' ? 'flipped' : ''}`} onClick={toggleAccountMode}>
          <div className="switcher-inner">
            <div className="switcher-face front">
              <span className="dot" />Personal
            </div>
            <div className="switcher-face back">
              <span className="dot" />Business
            </div>
          </div>
        </div>
      </div>

      <div className="scroll">
        <KycBanner status={kycStatus} tier={kycTier} accountType={accountType} onVerify={onOpenKyc} />

        <div className="hero" style={{ fontFamily: 'var(--font-body)' }}>
          <div style={{ marginBottom: 16 }}>
            <AuroraBar sweep />
          </div>
          <div className="bal-head">
            <span className="label" style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
              {accountType === 'PERSONAL' ? 'Across 3 accounts · tap to switch' : 'Corporate Treasury Balance'}
            </span>
            <button
              className="ccy-tag"
              onClick={() => {
                triggerLightHaptic();
                onOpenCurrencyPicker();
              }}
              aria-label="Switch active currency"
            >
              <span>{selectedCurrency}</span>
              <ChevronDown size={14} style={{ display: 'inline', marginLeft: 2, verticalAlign: 'middle' }} />
            </button>
          </div>
          <div
            className="amount num"
            style={{ fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: accountType === 'PERSONAL' ? 42 : 34 }}
          >
            {formatDisplayBalance()}
          </div>
          <div className="true-balance" style={{ fontFamily: 'var(--font-body)' }}>
            {getTrueUsdcBalance()}
          </div>
          {assetSummary && (
            <div className="true-balance" style={{ fontFamily: 'var(--font-body)' }}>
              On-chain: {assetSummary}
            </div>
          )}
          {onChainBalanceError && (
            <div className="true-balance" style={{ fontFamily: 'var(--font-body)', color: 'var(--danger-soft)' }}>
              On-chain balance unavailable: {onChainBalanceError}
            </div>
          )}
          <div className="delta num" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>
            +₦0.00 today
          </div>

          <QuickActions
            accountType={accountType}
            onSend={onOpenSend}
            onReceive={onOpenReceive}
            onRequest={onOpenRequest}
            onContacts={onOpenContacts}
            onSave={onOpenSave}
            onGoInvoices={() => onNavigate('home' as PrimaryScreen) /* secondary nav wired at App level */}
          />
        </div>
      </div>

      <BottomNav active="home" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};

const KycBanner: React.FC<{
  status: 'unverified' | 'pending' | 'approved';
  tier: number;
  accountType: 'PERSONAL' | 'BUSINESS';
  onVerify: () => void;
}> = ({ status, tier, accountType, onVerify }) => {
  if (status === 'pending') {
    return (
      <BannerShell borderColor="rgba(214, 182, 90, 0.3)" bg="rgba(214, 182, 90, 0.12)">
        <Clock size={20} color="var(--warning)" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>Verification in review</div>
          <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.7)' }}>
            Your bank accounts will activate once confirmed.
          </div>
        </div>
      </BannerShell>
    );
  }

  if (status === 'approved') {
    return (
      <BannerShell borderColor="rgba(22, 199, 183, 0.3)" bg="rgba(22, 199, 183, 0.12)" justify="space-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={20} color="var(--accent-teal-deep)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-teal)' }}>
              Verified {accountType === 'PERSONAL' ? 'Personal Account' : 'Business Account'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.7)' }}>Tier {tier} · Bank accounts active</div>
          </div>
        </div>
        <div
          className="chip"
          style={{
            background: 'var(--accent-teal-deep)',
            color: 'var(--text-inverse)',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 11,
          }}
        >
          Verified
        </div>
      </BannerShell>
    );
  }

  return (
    <BannerShell borderColor="rgba(45,212,191,0.2)" bg="var(--gradient-verify-bg)" justify="space-between">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Lock size={18} color="var(--accent-cyan)" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-on-surface)' }}>Unlock your Naira account</div>
          <div style={{ fontSize: 11, color: 'rgba(247,248,244,0.6)' }}>Verify your identity in 60 seconds.</div>
        </div>
      </div>
      <button
        onClick={onVerify}
        style={{
          background: 'var(--gradient-aurora)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '7px 14px',
          color: '#fff',
          fontWeight: 700,
          fontSize: 11,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Verify ID
      </button>
    </BannerShell>
  );
};

const BannerShell: React.FC<{
  borderColor: string;
  bg: string;
  justify?: string;
  children: React.ReactNode;
}> = ({ borderColor, bg, justify = 'space-between', children }) => (
  <div
    style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      padding: 14,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: justify,
      fontFamily: 'var(--font-body)',
      gap: 10,
    }}
  >
    {children}
  </div>
);

const QuickActionIcon: React.FC<{ path: string }> = ({ path }) => (
  <div className="quick-icon-box">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  </div>
);

const QuickActions: React.FC<{
  accountType: 'PERSONAL' | 'BUSINESS';
  onSend: () => void;
  onReceive: () => void;
  onRequest: () => void;
  onContacts: () => void;
  onSave: () => void;
  onGoInvoices: () => void;
}> = ({ accountType, onSend, onReceive, onRequest, onContacts, onSave, onGoInvoices }) => {
  if (accountType === 'BUSINESS') {
    return (
      <div className="quick-row">
        <button className="quick-btn primary" onClick={onReceive}>
          <QuickActionIcon path="M17 7L7 17M7 17h8M7 17V9" />
          <span>Receive</span>
        </button>
        <button className="quick-btn" onClick={onGoInvoices}>
          <QuickActionIcon path="M6 3h9l3 3v15H6z M9 8h6M9 12h6M9 16h3" />
          <span>Invoices</span>
        </button>
      </div>
    );
  }

  return (
    <div className="quick-row">
      <button className="quick-btn primary" onClick={onSend}>
        <QuickActionIcon path="M7 17L17 7M17 7H9M17 7v8" />
        <span>Send</span>
      </button>
      <button className="quick-btn" onClick={onReceive}>
        <QuickActionIcon path="M17 7L7 17M7 17h8M7 17V9" />
        <span>Receive</span>
      </button>
      <button className="quick-btn" onClick={onRequest}>
        <QuickActionIcon path="M12 4a4 4 0 00-4 4v3.2c0 .9-.32 1.77-.9 2.46L6 15h12l-1.1-1.34a3.9 3.9 0 01-.9-2.46V8a4 4 0 00-4-4z M10 18a2 2 0 004 0" />
        <span>Request</span>
      </button>
      <button className="quick-btn" onClick={onContacts}>
        <QuickActionIcon path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z" />
        <span>Contacts</span>
      </button>
      <button className="quick-btn" onClick={onSave}>
        <QuickActionIcon path="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3" />
        <span>Vault</span>
      </button>
    </div>
  );
};
