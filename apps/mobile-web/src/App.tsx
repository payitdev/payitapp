import React, { useState, useCallback, useEffect } from "react";
import { usePrivy } from "./PrivyProvider";
import { useWallets } from "@privy-io/react-auth";
import { apiFetch, setActiveEntityId } from "./apiClient";
import { AccountProvider, useAccount } from "./context/AccountContext";
import { HomeScreen } from "./screens/HomeScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { CardsScreen } from "./screens/CardsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SavingsScreen } from "./screens/SavingsScreen";
import { StocksScreen } from "./screens/StocksScreen";
import { RequestsScreen } from "./screens/RequestsScreen";
import { InvoicesScreen } from "./screens/InvoicesScreen";
import { InvoiceNewScreen } from "./screens/InvoiceNewScreen";
import { PayrollScreen } from "./screens/PayrollScreen";
import { PayrollNewScreen } from "./screens/PayrollNewScreen";
import { UsernameCustomizationModal } from "./components/UsernameCustomizationModal";
import { PaymentRequestHubModal } from "./components/PaymentRequestHubModal";
import { ContactsManagerModal } from "./components/ContactsManagerModal";
import { PrivyLogin } from "./components/PrivyLogin";
import { KycVerificationModal } from "./components/KycVerificationModal";
import { BrailsKycModal } from "./components/BrailsKycModal";
import { PublicInvoiceCheckout } from "./components/PublicInvoiceCheckout";
import { BusinessBalanceSheetModal } from "./components/BusinessBalanceSheetModal";
import { DeveloperHubModal } from "./components/DeveloperHubModal";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { NuvionPayoutModal } from "./components/NuvionPayoutModal";
import { NuvionFundingModal } from "./components/NuvionFundingModal";
import { CurrencyConvertModal } from "./components/CurrencyConvertModal";
import type { PrimaryScreen, SecondaryScreen } from "./types/navigation";

const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, '')
  : '';

type ScreenId = PrimaryScreen | SecondaryScreen;

function AppContent() {
  const { authenticated, user: privyUser, logout: privyLogout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const {
    accountType,
    currentUser,
    setCurrentUser,
    activeEntity,
    setActiveEntity,
    setKycStatus,
    setKycTier,
  } = useAccount();
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [publicInvoiceId, setPublicInvoiceId] = useState<string | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);
  const [showEaseIdKycModal, setShowEaseIdKycModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showBalanceSheetModal, setShowBalanceSheetModal] = useState(false);
  const [showDeveloperHubModal, setShowDeveloperHubModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  /** Apply a successful backend auth response to the app state. */
  const applyBackendSession = useCallback((data: any) => {
    const { token, user } = data;
    if (token) localStorage.setItem('proxim_auth_token', token);
    const entities: any[] = user?.entities || [];
    const personalEntity = entities.find((e: any) => e.kind === 'PERSONAL') || entities[0] || null;
    const activeEntityId = user?.activeEntityId || personalEntity?.id || null;
    if (activeEntityId) setActiveEntityId(activeEntityId);
    setCurrentUser?.(user);
    setActiveEntity?.(personalEntity);
    // Reflect KYC status from entity
    const kycTierNum = personalEntity?.kycTier || 0;
    setKycTier?.(kycTierNum);
    if (personalEntity?.dueStatus === 'approved') {
      setKycStatus?.('approved');
    } else if (personalEntity?.dueStatus === 'pending') {
      setKycStatus?.('pending');
    } else {
      setKycStatus?.('unverified');
    }
  }, [setCurrentUser, setActiveEntity, setKycStatus, setKycTier]);

  /** Restore an existing session from localStorage on app load. */
  useEffect(() => {
    const storedToken = localStorage.getItem('proxim_auth_token');
    if (!storedToken || currentUser) return;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.success) applyBackendSession(data);
        } else {
          // Token expired or invalid — clear it
          localStorage.removeItem('proxim_auth_token');
        }
      } catch {
        // Network error, silently ignore
      }
    })();
  }, []);

  /** After Privy authenticates, exchange for a backend session JWT. */
  useEffect(() => {
    if (!authenticated || !privyUser || currentUser) return;
    (async () => {
      try {
        const privyToken = await getAccessToken();
        const res = await apiFetch('/api/auth/privy/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${privyToken}`,
          },
          body: JSON.stringify({ privyUserId: privyUser.id }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          applyBackendSession(data);
        } else {
          // Privy login failed on backend — fall back to Privy user data
          console.warn('[Auth] Backend Privy login failed, using Privy identity:', data.error);
          setCurrentUser?.(privyUser);
          setActiveEntity?.(privyUser as any);
        }
      } catch (err) {
        console.warn('[Auth] Could not reach backend for Privy login:', err);
        setCurrentUser?.(privyUser);
        setActiveEntity?.(privyUser as any);
      }
    })();
  }, [authenticated, privyUser, currentUser]);

  /** Demo / preview login — calls real backend endpoint. */
  const handleDemoLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        applyBackendSession(data);
      } else {
        // Fallback: use mock data if backend unreachable
        const fallback = { id: 'demo-user-1', email: 'alex.morgan@proxim.app', fullName: 'Alex Morgan', legalName: 'Alex Morgan', firstName: 'Alex' };
        setCurrentUser?.(fallback);
        setActiveEntity?.(fallback);
      }
    } catch {
      const fallback = { id: 'demo-user-1', email: 'alex.morgan@proxim.app', fullName: 'Alex Morgan', legalName: 'Alex Morgan', firstName: 'Alex' };
      setCurrentUser?.(fallback);
      setActiveEntity?.(fallback);
    } finally {
      setAuthLoading(false);
    }
  };

  const navigateTo = useCallback((screen: ScreenId) => {
    setCurrentScreen(screen);
    window.scrollTo(0, 0);
  }, []);

  // Check for public invoice deep-link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('invoice');
    if (invoiceId) setPublicInvoiceId(invoiceId);
  }, []);

  // Sync active entity when toggling between Personal and Business modes
  useEffect(() => {
    if (!currentUser?.entities) return;
    const targetEntity = currentUser.entities.find((e: any) => e.kind === accountType) || currentUser.entities[0];
    if (targetEntity && targetEntity.id !== activeEntity?.id) {
      setActiveEntity?.(targetEntity);
      setActiveEntityId(targetEntity.id);
    }
  }, [accountType, currentUser, activeEntity, setActiveEntity]);

  // Primary screens — receive `onNavigate` typed as primary-only
  const primaryScreens: Partial<Record<PrimaryScreen, React.FC<any>>> = {
    home: HomeScreen,
    activity: ActivityScreen,
    cards: CardsScreen,
    profile: ProfileScreen,
    savings: SavingsScreen,
    stocks: StocksScreen,
  };

  // Secondary screens — receive generic navigate
  const secondaryScreens: Partial<Record<SecondaryScreen, React.FC<any>>> = {
    requests: RequestsScreen,
    invoices: InvoicesScreen,
    'invoice-new': InvoiceNewScreen,
    payroll: PayrollScreen,
    'payroll-new': PayrollNewScreen,
  };

  // Public invoice checkout route
  if (publicInvoiceId) {
    return (
      <PublicInvoiceCheckout
        invoiceId={publicInvoiceId}
        onBack={() => {
          setPublicInvoiceId(null);
          if (typeof window !== 'undefined') window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // Login screen — uses design tokens throughout
  if (!currentUser) {
    return (
      <div
        style={{
          background: 'var(--bg-deep)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-16)',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: 'auto',
            maxHeight: 'none',
            padding: 28,
            textAlign: 'center',
            background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg-deep) 100%)',
            border: '1px solid rgba(53, 217, 208, 0.35)',
            color: 'var(--text-on-surface)',
            borderRadius: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            width: '100%',
            maxWidth: 440,
          }}
        >
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
            <img src="/proxim-icon.png" alt="Proxim" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span
              style={{
                fontSize: 28,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                letterSpacing: -0.5,
                color: 'var(--text-on-surface)',
              }}
            >
              Proxim
            </span>
          </div>
          <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 28, fontFamily: 'var(--font-body)' }}>
            Money without limits.
          </div>

          {authError && (
            <div
              style={{
                background: 'rgba(255, 77, 77, 0.15)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                padding: 12,
                borderRadius: 12,
                fontSize: 'var(--type-13)',
                marginBottom: 16,
                fontFamily: 'var(--font-body)',
              }}
            >
              {authError}
            </div>
          )}

          <PrivyLogin
            onLoginSuccess={(_privyUser) => {
              // The useEffect above handles the backend exchange for Privy auth.
              // onLoginSuccess fires BEFORE the useEffect runs, so we let the effect do the work.
            }}
            onLoginError={(error) => setAuthError(error)}
          />

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={authLoading}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '13px 16px',
              borderRadius: 14,
              background: 'rgba(53, 217, 208, 0.08)',
              border: '1px solid rgba(53, 217, 208, 0.25)',
              color: 'var(--accent-teal, #16C7B7)',
              fontSize: 'var(--type-13)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: authLoading ? 0.6 : 1,
            }}
          >
            {authLoading ? 'Loading preview…' : 'Explore preview demo →'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
            <span style={{ fontSize: 'var(--type-11)', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              End-to-end encrypted
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--hairline)' }} />
          </div>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            {[
              { icon: '🔐', text: 'Sign in securely with Google, Apple, or Email' },
              { icon: '⚡', text: 'Instant access across all mobile devices' },
              { icon: '🌍', text: 'Hold, convert, and send multi-currency balances' },
            ].map((item) => (
              <div
                key={item.text}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--hairline)',
                  border: '1px solid rgba(53, 217, 208, 0.18)',
                  borderRadius: 12,
                }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Determine active screen component
  const isPrimary = (s: ScreenId): s is PrimaryScreen => s in primaryScreens;
  const isSecondary = (s: ScreenId): s is SecondaryScreen => s in secondaryScreens;

  const renderScreen = () => {
    if (currentScreen === 'home') {
      const fiatAcc = (activeEntity as any)?.fiatAccounts?.[0];
      return (
        <HomeScreen
          onNavigate={navigateTo as any}
          formatDisplayBalance={() => {
            if (accountType === 'BUSINESS') {
              return '$125,480.00';
            }
            return fiatAcc ? '₦420,000.00' : '₦0.00';
          }}
          getTrueUsdcBalance={() => (accountType === 'BUSINESS' ? '125,480.00 USDC' : '300.00 USDC')}
          getAssetSummary={() => null}
          onChainBalanceError={null}
          selectedCurrency={accountType === 'BUSINESS' ? 'USD' : 'NGN'}
          onOpenCurrencyPicker={() => setShowConvertModal(true)}
          onOpenSend={() => setShowSendModal(true)}
          onOpenReceive={() => setShowReceiveModal(true)}
          onOpenRequest={() => setShowRequestModal(true)}
          onOpenContacts={() => setShowContactsModal(true)}
          onOpenSave={() => navigateTo('savings')}
          onOpenKyc={() => setShowEaseIdKycModal(true)}
        />
      );
    }
    if (isPrimary(currentScreen)) {
      const Screen = primaryScreens[currentScreen]!;
      return <Screen onNavigate={navigateTo as any} currentUser={currentUser} />;
    }
    if (isSecondary(currentScreen)) {
      const Screen = secondaryScreens[currentScreen]!;
      return <Screen onNavigate={navigateTo as any} />;
    }
    return null;
  };

  const resolvedEntityId = activeEntity?.id || currentUser?.id || '';

  return (
    <div
      style={{
        background: 'var(--bg-deep)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <div className="phone" data-mode={accountType.toLowerCase()} id="phone">
        <div className="aurora-backdrop" />

        {renderScreen()}

        {/* ── Modals ─────────────────────────────────────────────── */}
        {showUsernameModal && (
          <UsernameCustomizationModal
            isOpen={showUsernameModal}
            entityId={resolvedEntityId}
            onSuccess={() => setShowUsernameModal(false)}
            onClose={() => setShowUsernameModal(false)}
          />
        )}
        {showContactsModal && (
          <ContactsManagerModal
            isOpen={showContactsModal}
            entityId={resolvedEntityId}
            onClose={() => setShowContactsModal(false)}
          />
        )}
        {showRequestModal && (
          <PaymentRequestHubModal
            isOpen={showRequestModal}
            entityId={resolvedEntityId}
            onClose={() => setShowRequestModal(false)}
          />
        )}
        {showKycModal && (
          <KycVerificationModal
            isOpen={showKycModal}
            onClose={() => setShowKycModal(false)}
            entityKind={accountType}
            entityId={resolvedEntityId}
            userId={currentUser?.id || ''}
            apiBaseUrl={API_BASE_URL}
            onSuccess={() => setShowKycModal(false)}
          />
        )}
        {showEaseIdKycModal && (
          <BrailsKycModal
            isOpen={showEaseIdKycModal}
            onClose={() => setShowEaseIdKycModal(false)}
            entityId={resolvedEntityId}
            userId={currentUser?.id || ''}
            apiBaseUrl={API_BASE_URL}
            onSuccess={(result) => {
              setShowEaseIdKycModal(false);
              setKycStatus?.('approved');
              setKycTier?.(2);
              if (result.fiatAccounts && activeEntity) {
                setActiveEntity?.({
                  ...activeEntity,
                  fiatAccounts: result.fiatAccounts,
                  dueStatus: 'approved',
                });
              }
            }}
          />
        )}
        {showBalanceSheetModal && (
          <BusinessBalanceSheetModal
            entityId={resolvedEntityId}
            onClose={() => setShowBalanceSheetModal(false)}
          />
        )}
        {showDeveloperHubModal && (
          <DeveloperHubModal
            entityId={resolvedEntityId}
            onClose={() => setShowDeveloperHubModal(false)}
          />
        )}
        {showSendModal && (
          <NuvionPayoutModal
            apiBaseUrl={API_BASE_URL}
            entityId={resolvedEntityId}
            accounts={((activeEntity as any)?.fiatAccounts as any[]) || []}
            onClose={() => setShowSendModal(false)}
          />
        )}
        {showReceiveModal && (
          <NuvionFundingModal
            apiBaseUrl={API_BASE_URL}
            entityId={resolvedEntityId}
            accounts={((activeEntity as any)?.fiatAccounts as any[]) || []}
            entity={activeEntity}
            onClose={() => setShowReceiveModal(false)}
            onOpenKyc={() => setShowEaseIdKycModal(true)}
          />
        )}
        {showConvertModal && (
          <CurrencyConvertModal
            isOpen={showConvertModal}
            entityId={resolvedEntityId}
            onClose={() => setShowConvertModal(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AccountProvider>
        <AppContent />
      </AccountProvider>
    </ErrorBoundary>
  );
}
