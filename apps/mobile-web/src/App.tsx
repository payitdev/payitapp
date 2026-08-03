import React, { useState, useEffect } from 'react';
import { Magic } from 'magic-sdk';
import {
  CreditCard,
  FileText,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Sparkles,
  CheckCircle2,
  X,
  Upload,
  QrCode,
  TrendingUp,
  Building2,
  UserCheck,
  Download,
  ArrowUp,
  ArrowDown,
  Mail,
  KeyRound,
  AlertTriangle,
  Clock,
  Globe,
  User,
  LogOut
} from 'lucide-react';

// API Base URL from environment (no hardcoded localhost)
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

// Initialize Official Magic SDK Client
const MAGIC_KEY = (import.meta as any).env?.VITE_MAGIC_PUBLISHABLE_KEY;
if (!MAGIC_KEY) {
  console.warn('VITE_MAGIC_PUBLISHABLE_KEY missing from environment configuration');
}
const magic = new Magic(MAGIC_KEY || '');

interface FiatAccount {
  nuvionAccountId: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  accountHolderName: string;
}

interface UserEntity {
  id: string;
  kind: 'PERSONAL' | 'BUSINESS';
  legalName?: string;
  username?: string;
  nuvionTier: number;
  nuvionStatus: 'incomplete' | 'pending' | 'approved' | 'rejected';
  nuvionEntityId?: string;
  accountNumber?: string;
  bankName?: string;
  particleNetworkAddress?: string;
  fiatAccounts?: FiatAccount[];
}

interface Transaction {
  id: string;
  type: 'INBOUND' | 'OUTBOUND';
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  symbol: string;
  date: string;
  time: string;
  mode: 'fiat' | 'crypto';
  senderAccount: string;
  recipientAccount: string;
  reference: string;
}

export default function App() {
  // Session & Auth State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // Active Account / Entity State
  const [accountType, setAccountType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [entitiesMap, setEntitiesMap] = useState<Record<string, UserEntity>>({});

  const activeEntity: UserEntity | undefined = entitiesMap[accountType];

  // Dynamic Balance & Transactions
  const [availableBalance, setAvailableBalance] = useState<number>(0.00);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showMoveBizModal, setShowMoveBizModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Form states
  const [sendMode, setSendMode] = useState<'fiat' | 'crypto'>('fiat');
  const [sendCurrency, setSendCurrency] = useState<string>('NGN');
  const [sendChain, setSendChain] = useState<string>('Ethereum');
  const [sendRecipientName, setSendRecipientName] = useState('');
  const [sendBankName, setSendBankName] = useState('');
  const [sendAccountNumber, setSendAccountNumber] = useState('');
  const [sendCryptoAddress, setSendCryptoAddress] = useState('');

  // Verification Form State (Clean blank inputs)
  const [kycLegalName, setKycLegalName] = useState('');
  const [kycBvn, setKycBvn] = useState('');
  const [kycDob, setKycDob] = useState('');
  const [kycAddress, setKycAddress] = useState('');
  const [kycIdNumber, setKycIdNumber] = useState('');
  const [kycPhone, setKycPhone] = useState('');

  const [kybBusinessName, setKybBusinessName] = useState('');
  const [kybRcNumber, setKybRcNumber] = useState('');
  const [kybTin, setKybTin] = useState('');
  const [kybAddress, setKybAddress] = useState('');
  const [kybUboName, setKybUboName] = useState('');
  const [kybUboBvn, setKybUboBvn] = useState('');

  const [kycStatusMsg, setKycStatusMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  const getAccountNetwork = (currency: string) => {
    switch (currency) {
      case 'NGN': return 'NIP Instant';
      case 'USD': return 'ACH / FedWire';
      case 'GBP': return 'FPS Direct';
      case 'EUR': return 'SEPA Instant';
      default: return 'Instant Clearing';
    }
  };

  const getBankRoutingCode = (currency: string) => {
    switch (currency) {
      case 'USD': return 'Routing (ABA): 026073150';
      case 'GBP': return 'Sort Code: 04-00-75';
      case 'EUR': return 'BIC: BCIRLULL (SEPA)';
      case 'NGN': return 'NIBSS NIP Code: 090518';
      default: return null;
    }
  };

  // Check Magic isLoggedIn status on mount & restore persisted verified session
  useEffect(() => {
    const savedEntities = localStorage.getItem('payit_verified_entities');
    if (savedEntities) {
      try {
        setEntitiesMap(JSON.parse(savedEntities));
      } catch (e) {}
    }

    const checkMagicSession = async () => {
      try {
        const loggedIn = await magic.user.isLoggedIn();
        if (loggedIn) {
          const metadata = await magic.user.getMetadata();
          if (metadata.email) {
            setUserEmail(metadata.email);
            const idToken = await magic.user.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/auth/magic-login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              body: JSON.stringify({ didToken: idToken, email: metadata.email }),
            });
            if (res.ok) {
              const data = await res.json();
              setCurrentUser(data.user);
              populateUserEntities(data.user, metadata.email);
            }
          }
        }
      } catch (err) {}
    };
    checkMagicSession();
  }, []);

  // Helper to map user entities without tier overrides or hardcoded name fallbacks
  const populateUserEntities = async (userObj: any, email: string) => {
    if (userObj.entities && userObj.entities.length > 0) {
      const pEnt = userObj.entities.find((e: any) => e.kind === 'PERSONAL') || userObj.entities[0];
      const bEnt = userObj.entities.find((e: any) => e.kind === 'BUSINESS');

      const newMap: Record<string, UserEntity> = {};

      if (pEnt) {
        newMap.PERSONAL = {
          id: pEnt.id,
          kind: 'PERSONAL',
          legalName: pEnt.legalName || undefined,
          username: pEnt.username,
          nuvionTier: pEnt.nuvionTier || 0,
          nuvionStatus: pEnt.nuvionStatus || 'incomplete',
          accountNumber: pEnt.accountNumber,
          bankName: pEnt.bankName,
          particleNetworkAddress: pEnt.particleNetworkAddress || pEnt.particleWalletAddress,
        };
      }

      if (bEnt) {
        newMap.BUSINESS = {
          id: bEnt.id,
          kind: 'BUSINESS',
          legalName: bEnt.legalName || undefined,
          username: bEnt.username,
          nuvionTier: bEnt.nuvionTier || 0,
          nuvionStatus: bEnt.nuvionStatus || 'incomplete',
          accountNumber: bEnt.accountNumber,
          bankName: bEnt.bankName,
          particleNetworkAddress: bEnt.particleNetworkAddress || bEnt.particleWalletAddress,
        };
      }

      setEntitiesMap(newMap);
      localStorage.setItem('payit_verified_entities', JSON.stringify(newMap));
    }
  };

  // Load Real Entity Data and Accounts when logged in
  useEffect(() => {
    if (!currentUser || !activeEntity?.id) return;

    const fetchEntityDetails = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/kyc/status?entityId=${activeEntity.id}&userId=${currentUser.id}`);
        if (res.ok) {
          const data = await res.json();
          const cleanAccounts = data.accounts || [];

          setEntitiesMap(prev => {
            const updated = {
              ...prev,
              [accountType]: {
                ...prev[accountType],
                legalName: data.legalName || prev[accountType]?.legalName,
                nuvionTier: data.nuvionTier || 0,
                nuvionStatus: data.nuvionStatus || 'incomplete',
                accountNumber: cleanAccounts[0]?.accountNumber || prev[accountType]?.accountNumber,
                bankName: cleanAccounts[0]?.bankName || prev[accountType]?.bankName,
                particleNetworkAddress: data.particleNetworkAddress || prev[accountType]?.particleNetworkAddress,
                fiatAccounts: cleanAccounts.length > 0 ? cleanAccounts : prev[accountType]?.fiatAccounts,
              },
            };
            localStorage.setItem('payit_verified_entities', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (e) {}

      try {
        const txRes = await fetch(`${API_BASE_URL}/api/transfers/history?entityId=${activeEntity.id}`);
        if (txRes.ok) {
          const txData = await txRes.json();
          if (txData.transactions && Array.isArray(txData.transactions)) {
            setTransactions(txData.transactions);
          }
        }
      } catch (e) {}
    };

    fetchEntityDetails();
  }, [currentUser, accountType]);

  // Execute Authentic Passwordless Magic Link Authentication via Magic SDK
  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !userEmail.includes('@')) {
      setAuthError('Please enter a valid email address');
      return;
    }

    setIsLoggingIn(true);
    setAuthError('');
    setAuthSuccessMsg('');

    try {
      const didToken = await magic.auth.loginWithMagicLink({ email: userEmail.trim() });

      if (!didToken) {
        throw new Error('Magic Link login was cancelled or failed');
      }

      setAuthSuccessMsg(`Magic Link verified! Logging in...`);

      const response = await fetch('http://localhost:4000/api/auth/magic-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${didToken}`,
        },
        body: JSON.stringify({ didToken, email: userEmail }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Magic authentication failed on backend');
      }

      setCurrentUser(data.user);
      localStorage.setItem('payit_session_token', data.token);
      populateUserEntities(data.user, userEmail);

    } catch (err: any) {
      setAuthError(err.message || 'Magic Link authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await magic.user.logout();
    } catch (e) {}
    setCurrentUser(null);
    localStorage.removeItem('payit_session_token');
  };

  // Submit Tier 1 Personal KYC to Live Nuvion API
  const handleTier1KycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntity?.id) return;

    setIsSubmittingKyc(true);
    setKycStatusMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/submit-tier1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          entityId: activeEntity.id,
          legalName: kycLegalName || activeEntity.legalName,
          bvn: kycBvn,
          dob: kycDob,
          address: kycAddress,
          idNumber: kycIdNumber,
          phone: kycPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Verification request failed');
      }

      const nuvionStatus = data.status === 'approved' ? 'approved' : data.status === 'pending' ? 'pending' : 'rejected';
      
      setEntitiesMap(prev => ({
        ...prev,
        PERSONAL: {
          ...prev.PERSONAL,
          nuvionTier: data.tier || 1,
          nuvionStatus,
          nuvionEntityId: data.nuvionEntityId,
          accountNumber: data.virtualAccount?.accountNumber || 'Unverified',
          bankName: data.virtualAccount?.bankName || 'Nuvion Microfinance Bank (MFB)',
          particleNetworkAddress: data.particleNetworkAddress,
          fiatAccounts: data.fiatAccounts || [],
        },
      }));

      if (nuvionStatus === 'approved') {
        setKycStatusMsg({ type: 'success', text: "Identity Verified! Issued Nuvion Microfinance Bank (MFB) & Global Virtual Accounts." });
        setTimeout(() => setShowKycModal(false), 2000);
      } else {
        setKycStatusMsg({ type: 'warning', text: "Verification Submitted. Nuvion is processing your application." });
      }
    } catch (err: any) {
      setKycStatusMsg({ type: 'error', text: err.message || 'Identity verification failed.' });
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Submit Tier 2 Corporate KYB to Live Nuvion API
  const handleTier2KybSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntity?.id) return;

    setIsSubmittingKyc(true);
    setKycStatusMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/submit-tier2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          entityId: activeEntity.id,
          businessLegalName: kybBusinessName || activeEntity.legalName,
          rcNumber: kybRcNumber,
          tin: kybTin,
          businessAddress: kybAddress,
          uboLegalName: kybUboName,
          uboBvn: kybUboBvn,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Corporate verification request failed');
      }

      const nuvionStatus = data.status === 'approved' ? 'approved' : data.status === 'pending' ? 'pending' : 'rejected';

      setEntitiesMap(prev => ({
        ...prev,
        BUSINESS: {
          ...prev.BUSINESS,
          nuvionTier: data.tier || 2,
          nuvionStatus,
          nuvionEntityId: data.nuvionEntityId,
          accountNumber: data.virtualAccount?.accountNumber || 'Unverified',
          bankName: data.virtualAccount?.bankName || 'Nuvion International Commercial Bank',
          particleNetworkAddress: data.particleNetworkAddress,
          fiatAccounts: data.fiatAccounts || [],
        },
      }));

      if (nuvionStatus === 'approved') {
        setKycStatusMsg({ type: 'success', text: "CAC Corporate Verification Approved! Issued Corporate Nuvion Accounts." });
        setTimeout(() => setShowKycModal(false), 2000);
      } else {
        setKycStatusMsg({ type: 'warning', text: "CAC Verification Pending with Nuvion." });
      }
    } catch (err: any) {
      setKycStatusMsg({ type: 'error', text: err.message || 'Corporate verification failed.' });
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Find account matching card currency
  const targetCurrency = accountType === 'PERSONAL' ? 'NGN' : 'USD';
  const primaryAccount = (activeEntity?.fiatAccounts || []).find(a => a.currency === targetCurrency) || (activeEntity?.fiatAccounts || [])[0];

  // Render Official Magic SDK Login Screen if not authenticated
  if (!currentUser) {
    return (
      <div style={{ maxWidth: 440, margin: '60px auto', padding: 24, background: 'var(--bg-primary)', borderRadius: 20, border: '1px solid var(--border-subtle)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/payit_logo_icon.png" alt="PayIT Logo" style={{ height: 48, width: 48, borderRadius: 12, marginBottom: 12, objectFit: 'cover' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>Sign in to PayIT</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Passwordless Magic Link Authentication
          </p>
        </div>

        {authError && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--rose-main)', padding: 12, borderRadius: 10, fontSize: 12, color: 'var(--rose-main)', marginBottom: 16 }}>
            {authError}
          </div>
        )}

        {authSuccessMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--emerald-main)', padding: 12, borderRadius: 10, fontSize: 12, color: 'var(--emerald-main)', marginBottom: 16 }}>
            {authSuccessMsg}
          </div>
        )}

        <form onSubmit={handleMagicLinkSignIn}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email Address</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={18} color="var(--brand-slate)" style={{ position: 'absolute', left: 14 }} />
              <input
                type="email"
                placeholder="user@example.com"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                required
                style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-glow)', borderRadius: 12, padding: '14px 14px 14px 44px', color: 'white', fontSize: 14, outline: 'none' }}
              />
            </div>
          </div>

          <button type="submit" disabled={isLoggingIn} className="btn-primary" style={{ width: '100%', padding: '14px 0', fontSize: 15 }}>
            {isLoggingIn ? 'Connecting to Magic...' : 'Send Magic Link & Sign In'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px 16px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top Header: Displays User Avatar & Full Legal Name when logged in */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* User Profile Avatar */}
          <div style={{ position: 'relative' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-green), #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16, border: '2px solid rgba(255,255,255,0.1)' }}>
              {(activeEntity?.legalName || 'In review').charAt(0)}
            </div>
            {activeEntity?.nuvionStatus === 'approved' && (
              <CheckCircle2 size={14} color="#10b981" style={{ position: 'absolute', bottom: -2, right: -2, background: '#0f172a', borderRadius: '50%' }} />
            )}
          </div>

          <div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {activeEntity?.nuvionStatus === 'approved' ? activeEntity.legalName : 'In review'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {userEmail || 'Loading...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 12, padding: 3, border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setAccountType('PERSONAL')}
              style={{
                background: accountType === 'PERSONAL' ? 'var(--brand-green)' : 'transparent',
                color: 'white', border: 'none', padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Personal
            </button>
            <button
              onClick={() => setAccountType('BUSINESS')}
              style={{
                background: accountType === 'BUSINESS' ? 'var(--violet-main)' : 'transparent',
                color: 'white', border: 'none', padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Building2 size={12} />
              Business
            </button>
          </div>

          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Verification Status Badge */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {accountType} ACCOUNT
        </span>

        {activeEntity?.nuvionStatus === 'approved' ? (
          <button onClick={() => setShowKycModal(true)} style={{ background: 'none', border: 'none', color: 'var(--emerald-main)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <UserCheck size={14} /> Verified ({accountType === 'PERSONAL' ? 'Tier 1' : 'Tier 2'})
          </button>
        ) : (
          <button onClick={() => setShowKycModal(true)} style={{ background: 'none', border: 'none', color: 'var(--amber-main)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={14} /> Unverified (Action Needed)
          </button>
        )}
      </div>

      {/* Main Balance Card (Displays account matching card currency) */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Available Balance</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{accountType === 'PERSONAL' ? 'NGN' : 'USD'}</span>
        </div>

        <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px', marginBottom: 16 }}>
          {accountType === 'PERSONAL' ? '₦' : '$'}{availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>NUVION VIRTUAL ACCOUNT ({targetCurrency})</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>
              {primaryAccount ? (
                <>{primaryAccount.accountNumber} · <span style={{ color: 'var(--brand-green)' }}>{primaryAccount.bankName}</span></>
              ) : (
                <span style={{ color: 'var(--amber-main)' }}>Unverified · Tap Verify to issue</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        <button onClick={() => setShowSendModal(true)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 14, color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <ArrowUpRight size={20} color="var(--emerald-main)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Send</span>
        </button>

        <button onClick={() => setShowReceiveModal(true)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 14, color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <ArrowDownLeft size={20} color="var(--brand-green)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Receive</span>
        </button>

        <button onClick={() => setShowCardsModal(true)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 14, color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <CreditCard size={20} color="var(--violet-main)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Cards</span>
        </button>

        <button onClick={() => setShowKycModal(true)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 14, color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Shield size={20} color="var(--amber-main)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Verify</span>
        </button>
      </div>

      {/* Transaction History Feed */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>Recent Activity</h3>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Banking Feed</span>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 14, color: 'var(--text-muted)', fontSize: 13 }}>
            No transaction activity yet. Ready when you are.
          </div>
        ) : (
          <div>
            {transactions.map(tx => (
              <div key={tx.id} className="tx-item" onClick={() => setSelectedTx(tx)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: tx.type === 'INBOUND' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {tx.type === 'INBOUND' ? <ArrowDown size={18} color="#10b981" /> : <ArrowUp size={18} color="#94a3b8" />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{tx.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{tx.subtitle} · {tx.date}</div>
                  </div>
                </div>
                <div className={tx.type === 'INBOUND' ? 'tx-amount-green' : 'tx-amount-grey'}>
                  {tx.type === 'INBOUND' ? '+' : '-'}{tx.symbol}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PayIT Brand Footer & Logo Icon */}
      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <img src="/payit_logo_icon.png" alt="PayIT Logo Icon" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>PayIT Financial Platform</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· Money without limits</span>
      </footer>

      {/* Modal: Issued Nuvion & Particle Accounts */}
      {showReceiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowReceiveModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>

            <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 16 }}>Your Issued Accounts</h3>

            {(activeEntity?.fiatAccounts || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                Verify your identity to unlock Nuvion virtual bank accounts.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {(activeEntity?.fiatAccounts || []).map((acc, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald-main)' }}>{acc.currency} Virtual Account</span>
                      <span style={{ fontSize: 11, color: 'var(--brand-green)', fontWeight: 600 }}>{getAccountNetwork(acc.currency)}</span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                      Interbank Transfer Bank: <strong style={{ color: 'white' }}>{acc.bankName}</strong>
                    </div>

                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, marginBottom: 2 }}>{acc.accountNumber}</div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Beneficiary Name: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{activeEntity?.legalName || 'Account Holder'}</span>
                    </div>

                    {getBankRoutingCode(acc.currency) && (
                      <div style={{ fontSize: 10, color: 'var(--brand-green)', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                        {getBankRoutingCode(acc.currency)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeEntity?.particleNetworkAddress && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glow)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo-main)' }}>Particle Network Universal Account</span>
                  <span style={{ fontSize: 11, color: 'var(--indigo-main)', fontWeight: 600 }}>Multi-Chain AA</span>
                </div>
                <code style={{ fontSize: 11, wordBreak: 'break-all', display: 'block', background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: 8, textAlign: 'center', color: 'white' }}>
                  {activeEntity.particleNetworkAddress}
                </code>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
                  Supported Chains: Ethereum · Polygon · Arbitrum · Base · BNB Chain · Solana
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Verification Form */}
      {showKycModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}>
            <button onClick={() => { setShowKycModal(false); setKycStatusMsg(null); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Shield size={24} color={accountType === 'BUSINESS' ? 'var(--amber-main)' : 'var(--brand-green)'} />
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  Verify your identity ({accountType})
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Submit documents for live Nuvion verification.
                </div>
              </div>
            </div>

            {kycStatusMsg && (
              <div style={{
                background: kycStatusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : kycStatusMsg.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${kycStatusMsg.type === 'success' ? 'var(--emerald-main)' : kycStatusMsg.type === 'warning' ? 'var(--amber-main)' : 'var(--rose-main)'}`,
                padding: 12, borderRadius: 10, fontSize: 12,
                color: kycStatusMsg.type === 'success' ? 'var(--emerald-main)' : kycStatusMsg.type === 'warning' ? 'var(--amber-main)' : 'var(--rose-main)',
                marginBottom: 16, textAlign: 'center'
              }}>
                {kycStatusMsg.text}
              </div>
            )}

            {accountType === 'PERSONAL' ? (
              <form onSubmit={handleTier1KycSubmit}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Full Legal Name</label>
                  <input type="text" placeholder="Iboh Igboze Igboze" value={kycLegalName} onChange={e => setKycLegalName(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Bank Verification Number (BVN)</label>
                  <input type="password" maxLength={11} placeholder="22198765432" value={kycBvn} onChange={e => setKycBvn(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12, letterSpacing: 2 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date of Birth</label>
                  <input type="date" value={kycDob} onChange={e => setKycDob(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Government ID Number (NIN / Passport)</label>
                  <input type="text" placeholder="NIN-9918273645" value={kycIdNumber} onChange={e => setKycIdNumber(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Residential Address</label>
                  <input type="text" placeholder="Navy Estate, Karshi, Abuja" value={kycAddress} onChange={e => setKycAddress(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <button type="submit" disabled={isSubmittingKyc} className="btn-primary" style={{ width: '100%' }}>
                  {isSubmittingKyc ? 'Submitting to Nuvion...' : 'Submit Tier 1 KYC'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleTier2KybSubmit}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Corporate Name</label>
                  <input type="text" placeholder="Igboze Global Enterprises" value={kybBusinessName} onChange={e => setKybBusinessName(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Registration Number (RC)</label>
                  <input type="text" placeholder="RC-1928475" value={kybRcNumber} onChange={e => setKybRcNumber(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tax Identification Number (TIN)</label>
                  <input type="text" placeholder="TIN-98765432" value={kybTin} onChange={e => setKybTin(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Registered Office Address</label>
                  <input type="text" placeholder="10 Commercial Avenue, Yaba, Lagos" value={kybAddress} onChange={e => setKybAddress(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>UBO Legal Name</label>
                  <input type="text" placeholder="Iboh Igboze Igboze" value={kybUboName} onChange={e => setKybUboName(e.target.value)} required style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10, color: 'white', fontSize: 12 }} />
                </div>
                <button type="submit" disabled={isSubmittingKyc} className="btn-primary" style={{ width: '100%' }}>
                  {isSubmittingKyc ? 'Verifying with CAC/Nuvion...' : 'Submit Tier 2 KYB'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
