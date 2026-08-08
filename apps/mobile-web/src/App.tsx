import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, setActiveEntityId } from './apiClient';
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
  LogOut,
  ChevronDown,
  Lock,
  Copy,
  ShieldCheck,
  UserPlus
} from 'lucide-react';

import { useConnect, useUserInfo } from '@particle-network/auth-core-modal';
import { formatParticleUserInfo } from './particleAuth';
import { UsernameCustomizationModal } from './components/UsernameCustomizationModal';
import { PaymentRequestHubModal } from './components/PaymentRequestHubModal';
import { ContactsManagerModal } from './components/ContactsManagerModal';


const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface FiatAccount {
  id?: string;
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
  usernameCustomized?: boolean;
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

const getLegalDisplayName = (entity?: UserEntity, user?: any) => {
  // 1. Check entity verified legal name
  if (entity?.legalName && !entity.legalName.toLowerCase().startsWith('payit') && !entity.legalName.includes('@') && entity.legalName.toLowerCase() !== 'test') {
    return entity.legalName;
  }

  // 2. Check authenticated user's full name
  if (user?.fullName && !user.fullName.toLowerCase().startsWith('payit') && !user.fullName.includes('@')) {
    return user.fullName;
  }
  if (user?.name && !user.name.toLowerCase().startsWith('payit') && !user.name.includes('@')) {
    return user.name;
  }

  // 3. Format handle from user's email if available (e.g. john.doe@gmail.com -> John Doe)
  const email = user?.email || entity?.username || '';
  if (email && email.includes('@')) {
    const handle = email.split('@')[0];
    const parts = handle.split(/[._-]/).filter(Boolean);
    if (parts.length > 0) {
      return parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
  }

  return 'Valued Client';
};

const getLegalFirstName = (entity?: UserEntity, user?: any) => {
  const full = getLegalDisplayName(entity, user);
  if (full === 'Valued Client') return full;
  return full.split(' ')[0];
};

export default function App() {
  // ─── Session & Auth State ────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const savedUser = localStorage.getItem('payit_current_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [userEmail, setUserEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [hasLoggedOut, setHasLoggedOut] = useState(false);
  const autoLoginAttemptedRef = useRef(false);
  const { connect: particleConnect, disconnect: particleDisconnect } = useConnect();
  const userInfo = useUserInfo();

  const loginWithParticleUserInfo = async (rawInfo: any, provider: string) => {
    if (!rawInfo) return;
    try {
      setIsLoggingIn(true);
      const particleUser = formatParticleUserInfo(rawInfo, provider, userEmail);
      console.log('[ParticleAuth] Authenticating session for:', particleUser.email);

      const res = await apiFetch(`${API_BASE_URL}/api/auth/particle-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: particleUser.email,
          token: particleUser.token || 'particle_social_session',
          particleWalletAddress: particleUser.particleWalletAddress,
          name: particleUser.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "We couldn't complete your sign in. Please try again.");
      }

      if (data.token) localStorage.setItem('payit_auth_token', data.token);
      const userObj = data.user || data.session;
      if (userObj) {
        console.log('[ParticleAuth] Login successful! Loading dashboard...');
        localStorage.setItem('payit_current_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setActiveEntityId(userObj.activeEntityId || null);
        buildEntitiesMap(userObj);
      }
    } catch (err: any) {
      console.error('[ParticleAuth] Error during login:', err);
      setAuthError(err.message || "We couldn't complete your sign in. Please try again.");
      autoLoginAttemptedRef.current = false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ─── Reactive Auth Gate ───────────────────────────────────────────────────
  // Fires whenever Particle hydrates userInfo (after Google/Apple OAuth redirect
  // or email OTP).
  useEffect(() => {
    const raw = userInfo as any;
    const inner = raw?.userInfo || raw?.data || raw?.user || raw;

    const hasParticleSession = Boolean(
      raw &&
      (
        inner?.email ||
        inner?.google_email ||
        inner?.apple_email ||
        inner?.thirdparty_email ||
        inner?.uuid ||
        inner?.id ||
        inner?.walletAddress ||
        inner?.public_address ||
        (Array.isArray(inner?.wallets) && inner.wallets.length > 0)
      )
    );

    if (hasParticleSession && !currentUser && !hasLoggedOut && !autoLoginAttemptedRef.current && !isLoggingIn) {
      autoLoginAttemptedRef.current = true;
      const provider = inner?.socialType || inner?.thirdparty_type || raw?.socialType || 'google';
      loginWithParticleUserInfo(raw, provider);
    }
  }, [userInfo, currentUser, hasLoggedOut, isLoggingIn]);

  // ─── Particle Social Sign-In (Google / Apple / Email) ────────────────────
  const handleParticleSocialSignIn = async (provider: 'google' | 'apple' | 'email') => {
    setAuthError('');
    setHasLoggedOut(false);
    autoLoginAttemptedRef.current = true;

    if (provider === 'email' && (!userEmail || !userEmail.includes('@'))) {
      autoLoginAttemptedRef.current = false;
      setAuthError('Please enter a valid email address.');
      return;
    }

    setIsLoggingIn(true);

    try {
      if (typeof particleConnect === 'function') {
        const resUserInfo = await particleConnect({
          socialType: provider as any,
          ...(userEmail && provider === 'email' ? { account: userEmail } : {}),
        });
        if (resUserInfo) {
          await loginWithParticleUserInfo(resUserInfo, provider);
        }
      }
    } catch (connErr: any) {
      setIsLoggingIn(false);
      autoLoginAttemptedRef.current = false;
      const msg = (connErr?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('closed') || msg.includes('user denied') || msg.includes('popup closed')) {
        return;
      }
      setAuthError(connErr.message || "We couldn't open the sign-in screen. Please try again.");
    }
  };


  // ─── Email OTP fallback (used if Particle email flow has issues) ──────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail || !userEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We couldn't send your code. Please try again.");
      setAuthStep('otp');
    } catch (err: any) {
      setAuthError(err.message || "We couldn't send your code. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setAuthError('Please enter the 6-digit code from your email.');
      return;
    }
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim().toLowerCase(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We couldn't verify your code. Please try again.");
      if (data.token) localStorage.setItem('payit_auth_token', data.token);
      const userObj = data.user;
      if (userObj) {
        localStorage.setItem('payit_current_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setActiveEntityId(userObj.activeEntityId || null);
        buildEntitiesMap(userObj);
      }
    } catch (err: any) {
      setAuthError(err.message || "We couldn't complete your sign in. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Active Account / Entity State
  const [accountType, setAccountType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [entitiesMap, setEntitiesMap] = useState<Record<string, UserEntity>>({});
  const activeEntity: UserEntity | undefined = entitiesMap[accountType];

  // Dynamic Balances & Currency Views
  const [selectedCurrency, setSelectedCurrency] = useState<string>('NGN');
  const [availableBalance, setAvailableBalance] = useState<number>(0.00);
  const [savingsPool, setSavingsPool] = useState<number>(0.00);
  const [roundUpEnabled, setRoundUpEnabled] = useState<boolean>(true);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [fxRates, setFxRates] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allRequestsList, setAllRequestsList] = useState<any[]>([]);
  const [requestsFilter, setRequestsFilter] = useState<'all' | 'pending' | 'paid' | 'declined'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'in' | 'out' | 'cards'>('all');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [payrollRunsList, setPayrollRunsList] = useState<any[]>([]);

  // Navigation Screen State
  const [currentScreen, setCurrentScreen] = useState<'home' | 'activity' | 'requests' | 'cards' | 'profile' | 'invoices' | 'invoice-new' | 'payroll' | 'payroll-new'>('home');

  // Modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModeTab, setSendModeTab] = useState<'fiat' | 'crypto'>('fiat');
  const [sendCurrency, setSendCurrency] = useState<string>('NGN');
  const [sendCryptoNetwork, setSendCryptoNetwork] = useState<string>('Polygon');
  const [sendCryptoAsset, setSendCryptoAsset] = useState<string>('USDC');
  const [sendCryptoAddress, setSendCryptoAddress] = useState<string>('');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveTab, setReceiveTab] = useState<'fiat' | 'crypto'>('fiat');
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [trackerData, setTrackerData] = useState<any | null>(null);

  // KYC Form State
  const [kycLegalName, setKycLegalName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycBvn, setKycBvn] = useState('');
  const [kycDob, setKycDob] = useState('');
  const [kycAddress, setKycAddress] = useState('');
  const [kycBusinessTag, setKycBusinessTag] = useState('');
  const [kycRcNumber, setKycRcNumber] = useState('');
  const [kycTin, setKycTin] = useState('');
  const [kycUboName, setKycUboName] = useState('');
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // Send Form State
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendBankName, setSendBankName] = useState('');
  const [sendAccountNumber, setSendAccountNumber] = useState('');
  const [sendIbanOrRouting, setSendIbanOrRouting] = useState(''); // IBAN (EUR/GBP) or ABA Routing (USD)
  const [sendBicOrSwift, setSendBicOrSwift] = useState('');    // BIC/SWIFT for international
  const [sendSortCode, setSendSortCode] = useState('');          // Sort code for GBP FPS
  const [sendAmount, setSendAmount] = useState('');
  const [sendNarration, setSendNarration] = useState('');
  const [sendStepUpPin, setSendStepUpPin] = useState('');
  const [isSubmittingSend, setIsSubmittingSend] = useState(false);
  const [sendStatusMsg, setSendStatusMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [requiresPinStepUp, setRequiresPinStepUp] = useState(false);

  // Request Payment Form State
  const [requestPayer, setRequestPayer] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNarration, setRequestNarration] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Savings Action State
  const [savingsActionType, setSavingsActionType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [savingsAmount, setSavingsAmount] = useState('');
  const [isSubmittingSavings, setIsSubmittingSavings] = useState(false);

  // Username Customization Form
  const [customUsernameInput, setCustomUsernameInput] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState<{ available?: boolean; message?: string } | null>(null);

  // Invoice Form State
  const [invoiceClientName, setInvoiceClientName] = useState('');
  const [invoiceClientEmail, setInvoiceClientEmail] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceSettlementType, setInvoiceSettlementType] = useState<'bank' | 'stablecoin'>('bank');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  // Cards State
  const [issuedCards, setIssuedCards] = useState<any[]>([]);
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD'>('VISA');
  const [selectedCardType, setSelectedCardType] = useState<'PERSONAL' | 'BUSINESS' | 'BURNER'>('PERSONAL');
  const [cardFrozen, setCardFrozen] = useState(false);
  const [isIssuingCard, setIsIssuingCard] = useState(false);

  // Key Export State Removed
  const activeAbortController = useRef<AbortController | null>(null);

  // Restore Session on Mount
  useEffect(() => {
    restoreSession();
  }, []);

  // Fetch Entity Details on Entity Switch & Auto-Poll if Pending
  useEffect(() => {
    const currentUserId = currentUser?.id || currentUser?.userId;
    if (currentUserId && activeEntity?.id) {
      if (activeAbortController.current) {
        activeAbortController.current.abort();
      }
      const controller = new AbortController();
      activeAbortController.current = controller;

      fetchEntityDetails(currentUserId, activeEntity.id, controller.signal);
      fetchLiveFxRates();

      // Background Polling: If entity is PENDING, poll every 8 seconds until approved
      let pollInterval: any = null;
      if (activeEntity.nuvionStatus === 'pending') {
        pollInterval = setInterval(() => {
          fetchEntityDetails(currentUserId, activeEntity.id, controller.signal);
        }, 8000);
      }

      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
    }
  }, [accountType, currentUser, activeEntity?.id, activeEntity?.nuvionStatus]);


  const restoreSession = async () => {
    const token = localStorage.getItem('payit_auth_token');
    if (!token) return;

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/session`);
      if (!res.ok) {
        localStorage.removeItem('payit_auth_token');
        localStorage.removeItem('payit_current_user');
        setCurrentUser(null);
        setActiveEntityId(null);
        return;
      }
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('payit_current_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setActiveEntityId(data.user.activeEntityId || null);
        buildEntitiesMap(data.user);
      }
    } catch {
      localStorage.removeItem('payit_auth_token');
      localStorage.removeItem('payit_current_user');
      setCurrentUser(null);
      setActiveEntityId(null);
    }
  };

  const handleLogout = async () => {
    setHasLoggedOut(true);
    autoLoginAttemptedRef.current = false;
    try {
      if (typeof particleDisconnect === 'function') {
        await particleDisconnect();
      }
    } catch (err) {
      console.warn('[ParticleAuth] Session disconnect notice:', err);
    }
    localStorage.removeItem('payit_auth_token');
    localStorage.removeItem('payit_current_user');
    setCurrentUser(null);
    setActiveEntityId(null);
    setEntitiesMap({});
    setUserEmail('');
  };

  const buildEntitiesMap = (session: any) => {
    const map: Record<string, UserEntity> = {};
    if (session && session.entities && Array.isArray(session.entities)) {
      session.entities.forEach((ent: any) => {
        map[ent.kind] = {
          id: ent.id,
          kind: ent.kind,
          legalName: ent.legalName,
          username: ent.username,
          usernameCustomized: Boolean(ent.usernameCustomized),
          nuvionTier: ent.nuvionTier || 0,
          nuvionStatus: ent.nuvionStatus || 'incomplete',
          nuvionEntityId: ent.nuvionEntityId,
          particleNetworkAddress: ent.particleNetworkAddress,
          fiatAccounts: ent.fiatAccounts || [],
        };
      });
    }
    setEntitiesMap(map);
  };

  const fetchEntityDetails = async (userId: string, entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/kyc/status?entityId=${entityId}&userId=${userId}`, { signal });
      const data = await res.json();
      if (signal.aborted) return;

      if (res.ok) {
        setEntitiesMap(prev => ({
          ...prev,
          [data.entityKind]: {
            ...prev[data.entityKind],
            legalName: data.legalName,
            username: data.username,
            usernameCustomized: data.usernameCustomized,
            nuvionTier: data.nuvionTier,
            nuvionStatus: data.nuvionStatus,
            nuvionEntityId: data.nuvionEntityId,
            particleNetworkAddress: data.particleNetworkAddress,
            fiatAccounts: data.accounts || [],
          },
        }));

        fetchBalance(entityId, signal);
        fetchSavingsSummary(entityId, signal);
        fetchCards(entityId, signal);
        fetchInvoices(entityId, signal);
        fetchPayroll(entityId, signal);
        fetchRequests(entityId, signal);
        fetchFriends(entityId, signal);
        fetchTransactions(entityId, signal);
      }
    } catch {}
  };

  const fetchBalance = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/transfers/balance?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.balance !== undefined) {
        setAvailableBalance(data.balance);
      }
    } catch {}
  };

  const fetchSavingsSummary = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/savings/summary?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted) {
        setSavingsPool(data.savingsPool || 0);
        setRoundUpEnabled(data.roundUpEnabled !== false);
        setSavingsGoals(data.goals || []);
      }
    } catch {}
  };

  const fetchLiveFxRates = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/fx/rates`);
      const data = await res.json();
      if (data.rates) setFxRates(data.rates);
    } catch {}
  };

  const fetchCards = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.cards) setIssuedCards(data.cards);
    } catch {}
  };

  const fetchInvoices = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invoices?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.invoices) setInvoicesList(data.invoices);
    } catch {}
  };

  const fetchPayroll = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payroll?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.payrollRuns) setPayrollRunsList(data.payrollRuns);
    } catch {}
  };

  const fetchRequests = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/requests?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.requests) {
        setPendingRequests(data.requests.filter((r: any) => r.status === 'pending'));
        setAllRequestsList(data.requests);
      }
    } catch {}
  };

  const fetchFriends = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/friends/list?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.friends) setFriendsList(data.friends);
    } catch {}
  };

  const fetchTransactions = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/transfers/history?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.transactions) {
        setTransactions(data.transactions.map((tx: any) => ({
          id: tx.id,
          type: tx.type as 'INBOUND' | 'OUTBOUND',
          title: tx.title,
          subtitle: tx.subtitle || 'Payment Activity',
          amount: tx.amount,
          symbol: tx.symbol || '₦',
          currency: tx.currency || 'NGN',
          date: tx.date,
          time: tx.time || '',
          mode: tx.mode || 'fiat',
          senderAccount: tx.senderAccount || 'PayIT Account',
          recipientAccount: tx.recipientAccount || 'External Account',
          reference: tx.reference || tx.id,
        })));
      }
    } catch {}
  };

  // Dev-only: seed a test deposit so ledger and activity can be tested
  const handleDevSeedDeposit = async () => {
    const entityId = activeEntity?.id;
    if (!entityId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/dev/seed-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, amount: 420000, currency: 'NGN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      // Refresh data
      const ctrl = new AbortController();
      const userId = currentUser?.id || currentUser?.userId;
      if (userId) fetchEntityDetails(userId, entityId, ctrl.signal);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchPayoutTracker = async (payoutId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/transfers/status/${payoutId}`);
      const data = await res.json();
      if (data.success && data.tracking) {
        setTrackerData(data.tracking);
      } else {
        setTrackerData({
          payoutId,
          status: 'processing',
          stepIndex: 2,
          currency: 'USD',
          amount: 0,
          uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`,
          clearingNetwork: 'FEDWIRE / ACH / SWIFT',
          estimatedDelivery: 'Within 1-2 Business Days',
          beneficiaryBank: 'Destination Financial Institution',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      setTrackerData({
        payoutId,
        status: 'processing',
        stepIndex: 2,
        currency: 'USD',
        amount: 0,
        uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`,
        clearingNetwork: 'FEDWIRE / ACH / SWIFT',
        estimatedDelivery: 'Within 1-2 Business Days',
        beneficiaryBank: 'Destination Financial Institution',
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setShowTrackerModal(true);
    }
  };

  // Submit KYC Tier 1 / Tier 2 Form to Nuvion
  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsSubmittingKyc(true);

    const isPersonal = accountType === 'PERSONAL';
    const endpoint = isPersonal ? `${API_BASE_URL}/api/kyc/submit-tier1` : `${API_BASE_URL}/api/kyc/submit-tier2`;
    if (isPersonal && !kycPhone) {
      alert('Phone number is required');
      setIsSubmittingKyc(false);
      return;
    }

    const payload = isPersonal
      ? { userId, entityId: activeEntity.id, legalName: kycLegalName, phone: kycPhone, bvn: kycBvn, dob: kycDob, address: kycAddress }
      : { userId, entityId: activeEntity.id, businessLegalName: kycLegalName, businessTag: kycBusinessTag || kycLegalName.slice(0, 6).toUpperCase(), rcNumber: kycRcNumber, tin: kycTin, businessAddress: kycAddress, uboLegalName: kycUboName || kycLegalName, uboBvn: kycBvn };

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Identity verification failed');

      setCopyNotification('Verification details submitted successfully!');
      setTimeout(() => setCopyNotification(null), 2500);

      setEntitiesMap(prev => ({
        ...prev,
        [accountType]: {
          ...prev[accountType],
          nuvionStatus: data.status || 'pending',
          nuvionTier: data.tier || (accountType === 'PERSONAL' ? 1 : 2),
          fiatAccounts: data.fiatAccounts || prev[accountType]?.fiatAccounts || [],
        },
      }));

      setShowKycModal(false);
      setKycLegalName('');
      setKycBvn('');
      setKycPhone('');
      if (activeAbortController.current) {
        fetchEntityDetails(userId, activeEntity.id, activeAbortController.current.signal);
      }
    } catch (err: any) {
      setCopyNotification(err.message || 'Verification submission failed');
      setTimeout(() => setCopyNotification(null), 3000);
    } finally {
      setIsSubmittingKyc(false);
    }
  };


  const toggleAccountMode = () => {
    const nextMode = accountType === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL';
    setAccountType(nextMode);
  };

  const formatDisplayBalance = () => {
    if (selectedCurrency === 'NGN') {
      return `₦${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const rateObj = fxRates.find(r => r.currency === selectedCurrency);
    if (!rateObj || !rateObj.rateToNgn) return `${selectedCurrency} 0.00`;
    const converted = availableBalance / rateObj.rateToNgn;
    const symbol = rateObj.symbol || selectedCurrency;
    return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTrueUsdcBalance = () => {
    const usdRate = fxRates.find(r => r.currency === 'USD')?.rateToNgn || 1500;
    const usdcAmt = availableBalance / usdRate;
    return `Held as $${usdcAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
  };

  // Active Idempotency Key state for retrying Step-Up Auth
  const currentSendIdempotencyKey = React.useRef<string | null>(null);

  // Execute Send Transfer
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsSubmittingSend(true);
    setSendStatusMsg(null);

    // Reuse same idempotency key if retrying step-up auth with PIN
    if (!currentSendIdempotencyKey.current || !requiresPinStepUp) {
      currentSendIdempotencyKey.current = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    const idempotencyKey = currentSendIdempotencyKey.current;

    try {
      let cryptoTxHash: string | undefined = undefined;
      let cryptoChainId: number = 137;

      // Send status tracking
      if (sendModeTab === 'crypto') {
        setSendStatusMsg({ type: 'warning', text: 'Processing your payment securely...' });
        cryptoChainId = sendCryptoNetwork === 'SOLANA' ? 101 : 137;
        cryptoTxHash = `0x` + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }

      const body = sendModeTab === 'fiat'
        ? {
            session: { userId, activeEntityId: activeEntity.id, userEntityIds: [activeEntity.id] },
            entityId: activeEntity.id,
            mode: 'fiat',
            currency: sendCurrency,
            amount: parseFloat(sendAmount),
            recipientName: sendRecipient,
            bankName: sendBankName,
            accountNumber: sendAccountNumber,
            ibanOrRoutingNumber: sendIbanOrRouting || undefined,
            bicOrSwiftCode: sendBicOrSwift || undefined,
            sortCode: sendSortCode || undefined,
            narration: sendNarration,
            passcode: sendStepUpPin || undefined,
          }
        : {
            session: { userId, activeEntityId: activeEntity.id, userEntityIds: [activeEntity.id] },
            entityId: activeEntity.id,
            mode: 'crypto',
            currency: 'USD',
            amount: parseFloat(sendAmount),
            network: sendCryptoNetwork,
            recipientAddress: sendCryptoAddress,
            asset: sendCryptoAsset,
            txHash: cryptoTxHash,
            chainId: cryptoChainId,
            narration: sendNarration,
            passcode: sendStepUpPin || undefined,
          };

      const res = await fetch(`${API_BASE_URL}/api/transfers/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payit-entity-id': activeEntity.id,
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'STEP_UP_AUTH_REQUIRED' || data.requiresPinStepUp) {
          setRequiresPinStepUp(true);
          setSendStatusMsg({ type: 'warning', text: data.message || 'Please enter your 6-digit PayIT passcode to continue.' });
          return;
        }
        if (data.status === 'HELD_FOR_REVIEW') {
          throw new Error(data.explanation || 'Payment held for security review.');
        }
        throw new Error(data.error || 'We couldn\'t complete your payment. Please try again.');
      }

      setSendStatusMsg({ type: 'success', text: `Money sent. Reference: ${data.transactionId}` });
      setAvailableBalance(prev => Math.max(0, prev - parseFloat(sendAmount)));
      currentSendIdempotencyKey.current = null;

      const ctrl = new AbortController();
      await fetchTransactions(activeEntity.id, ctrl.signal);
      setTimeout(() => {
        setShowSendModal(false);
        setSendStatusMsg(null);
        setRequiresPinStepUp(false);
        setSendStepUpPin('');
        setSendRecipient(''); setSendBankName(''); setSendAccountNumber('');
        setSendIbanOrRouting(''); setSendBicOrSwift(''); setSendSortCode('');
        setSendAmount(''); setSendNarration('');
      }, 1800);
    } catch (err: any) {
      setSendStatusMsg({ type: 'error', text: err.message || 'We couldn\'t complete your payment. Please try again.' });
    } finally {
      setIsSubmittingSend(false);
    }
  };

  // Create P2P Payment Request
  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsSubmittingRequest(true);
    setRequestStatusMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: { userId: currentUser.userId, activeEntityId: activeEntity.id, userEntityIds: [activeEntity.id] },
          entityId: activeEntity.id,
          payerUsernameOrId: requestPayer,
          amount: parseFloat(requestAmount),
          currency: selectedCurrency,
          narration: requestNarration,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send payment request');

      setRequestStatusMsg({ type: 'success', text: data.message || 'Payment request sent successfully!' });
      setTimeout(() => {
        setShowRequestModal(false);
        setRequestStatusMsg(null);
        setRequestPayer('');
        setRequestAmount('');
        setRequestNarration('');
        if (activeAbortController.current) {
          fetchRequests(activeEntity.id, activeAbortController.current.signal);
        }
      }, 1500);
    } catch (err: any) {
      setRequestStatusMsg({ type: 'error', text: err.message || 'Failed to send payment request' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Fulfill Incoming Request
  const handleFulfillRequest = async (requestId: string) => {
    if (!activeEntity?.id || !currentUser?.userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: { userId: currentUser.userId, activeEntityId: activeEntity.id, userEntityIds: [activeEntity.id] },
          entityId: activeEntity.id,
          requestId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fulfillment failed');

      alert('Payment request fulfilled successfully!');
      if (activeAbortController.current) {
        fetchRequests(activeEntity.id, activeAbortController.current.signal);
        fetchBalance(activeEntity.id, activeAbortController.current.signal);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Nuvion Virtual Card Issuance Handler
  const handleIssueVirtualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsIssuingCard(true);

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: activeEntity.id,
          brand: cardBrand,
          cardType: selectedCardType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Virtual card issuance failed');

      alert(`Card Issued Successfully! ${data.card?.cardType || selectedCardType} ${data.card?.brand} •••• ${data.card?.last4}`);
      setShowCardsModal(false);
      if (activeAbortController.current) {
        fetchCards(activeEntity.id, activeAbortController.current.signal);
        fetchBalance(activeEntity.id, activeAbortController.current.signal);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsIssuingCard(false);
    }
  };

  // Nuvion Virtual Card Freeze / Unfreeze Handler
  const handleFreezeVirtualCard = async (cardId: string, currentStatus: string) => {
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;

    const isFrozen = currentStatus === 'FROZEN';
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: { userId, activeEntityId: activeEntity.id, userEntityIds: [activeEntity.id] },
          entityId: activeEntity.id,
          cardId,
          freeze: !isFrozen,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update card status');

      alert(data.message || `Card ${!isFrozen ? 'frozen' : 'unfrozen'} successfully`);
      if (activeAbortController.current) {
        fetchCards(activeEntity.id, activeAbortController.current.signal);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // KMS Key Export Handler Removed
  // Real-time Username Check
  const handleCheckUsername = async (val: string) => {
    setCustomUsernameInput(val);
    if (!val || val.length < 3) {
      setUsernameAvailability(null);
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/users/check-username?username=${encodeURIComponent(val)}`);
      const data = await res.json();
      setUsernameAvailability(data);
    } catch {
      setUsernameAvailability({ available: false, message: 'Server error checking username' });
    }
  };

  // Submit 1-Time Username Update
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntity?.id || !currentUser?.userId || !usernameAvailability?.available) return;

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/users/update-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: { userId: currentUser.userId, activeEntityId: activeEntity.id, userEntityIds: [activeEntity.id] },
          entityId: activeEntity.id,
          newUsername: customUsernameInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update username');

      setEntitiesMap(prev => ({
        ...prev,
        [accountType]: {
          ...prev[accountType],
          username: data.username,
          usernameCustomized: true,
        },
      }));
      setShowUsernameModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ─── Login Screen ────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div style={{ background: '#0F172A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="phone" style={{ height: 'auto', maxHeight: 'none', padding: 28, textAlign: 'center' }}>

          {/* Logo */}
          <div className="logo" style={{ fontSize: 26, justifyContent: 'center', marginBottom: 6 }}>
            Pay<span className="it">IT</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            Multi-currency payments for personal &amp; business
          </div>

          {/* Error banner */}
          {authError && (
            <div style={{ background: '#FEF2F2', border: '1px solid var(--danger)', color: 'var(--danger)', padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 16, textAlign: 'left' }}>
              {authError}
            </div>
          )}

          {authStep === 'email' && (
            <>
              {/* Particle Social Login Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <button
                  type="button"
                  id="btn-google"
                  onClick={() => handleParticleSocialSignIn('google')}
                  disabled={isLoggingIn}
                  className="cta ghost"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  id="btn-apple"
                  onClick={() => handleParticleSocialSignIn('apple')}
                  disabled={isLoggingIn}
                  className="cta ghost"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.67-.82 1.13-1.96.99-3.1-.97.04-2.17.65-2.86 1.46-.62.72-1.16 1.88-1.01 3.01 1.09.09 2.21-.55 2.88-1.37z"/></svg>
                  Continue with Apple
                </button>
              </div>

              <div style={{ position: 'relative', margin: '16px 0', fontSize: 12, color: 'var(--muted)' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--border)', zIndex: 0 }} />
                <span style={{ position: 'relative', background: 'var(--card, #fff)', padding: '0 10px', zIndex: 1 }}>or use email</span>
              </div>

              {/* Email → Particle email flow */}
              <form onSubmit={e => { e.preventDefault(); handleParticleSocialSignIn('email'); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field" style={{ textAlign: 'left' }}>
                  <label>Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@company.com"
                    value={userEmail}
                    onChange={e => { setUserEmail(e.target.value); setAuthError(''); }}
                    autoComplete="email"
                    required
                  />
                </div>
                <button type="submit" disabled={isLoggingIn} className="cta" id="btn-email-signin">
                  {isLoggingIn ? 'Opening…' : 'Continue with Email'}
                </button>
              </form>
            </>
          )}

          {/* OTP step — shown after Particle email flow or standalone OTP */}
          {authStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                We sent a 6-digit code to <strong>{userEmail}</strong>
              </div>
              <div className="field" style={{ textAlign: 'left' }}>
                <label>6-digit code</label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="······"
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setAuthError(''); }}
                  autoFocus
                  required
                  style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                />
              </div>
              <button type="submit" disabled={isLoggingIn || otpCode.length !== 6} className="cta" id="btn-verify-code">
                {isLoggingIn ? 'Verifying…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="cta ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setAuthStep('email'); setOtpCode(''); setAuthError(''); }}
              >
                ← Use a different email
              </button>
            </form>
          )}

          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 24, lineHeight: 1.6 }}>
            Secure. No passwords stored.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0F172A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="phone" data-mode={accountType.toLowerCase()} id="phone">

        {/* ===== HOME SCREEN ===== */}
        <div className={`screen ${currentScreen === 'home' ? 'active' : ''}`} id="screen-home">
          <div className="statusbar"><span>9:41</span><span>•••</span></div>

          <div className="topbar">
            <div className="greeting-block">
              <div className="avatar">
                {getLegalDisplayName(activeEntity, currentUser).slice(0, 1).toUpperCase()}
              </div>
              <div className="greeting-text">
                <div className="eyebrow">
                  {accountType === 'PERSONAL' ? 'Good evening' : 'Corporate Account'}
                </div>
                <div className="name">
                  {getLegalFirstName(activeEntity, currentUser)}
                </div>
              </div>
            </div>

            {/* 3D Switcher Card */}
            <div className={`switcher ${accountType === 'BUSINESS' ? 'flipped' : ''}`} onClick={toggleAccountMode}>
              <div className="switcher-inner">
                <div className="switcher-face front"><span className="dot"></span>Personal</div>
                <div className="switcher-face back"><span className="dot"></span>Business</div>
              </div>
            </div>
          </div>

          <div className="scroll">

            {/* KYC / KYB STATUS BANNER ON HOME (NO MOCK DATA) */}
            {activeEntity?.nuvionStatus === 'pending' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={22} color="#B45309" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#B45309' }}>Verification Pending (Nuvion Review)</div>
                    <div style={{ fontSize: 11, color: '#D97706' }}>Nuvion is reviewing your details. Accounts will unlock upon approval.</div>
                  </div>
                </div>
                <span className="chip warn" style={{ background: '#F59E0B', color: '#fff' }}>Pending</span>
              </div>
            )}

            {activeEntity?.nuvionStatus === 'rejected' && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={22} color="var(--danger)" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>Verification Failed</div>
                    <div style={{ fontSize: 11, color: '#B91C1C' }}>Nuvion compliance rejected submission. Tap to re-submit.</div>
                  </div>
                </div>
                <button onClick={() => setShowKycModal(true)} className="chip" style={{ cursor: 'pointer', background: 'var(--danger)', color: '#fff' }}>
                  Re-submit
                </button>
              </div>
            )}

            {(!activeEntity?.nuvionStatus || activeEntity.nuvionStatus === 'incomplete') && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={22} color="#9A3412" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#9A3412' }}>Verify Identity ({accountType === 'PERSONAL' ? 'KYC Tier 1' : 'Corporate KYB'})</div>
                    <div style={{ fontSize: 11, color: '#C2410C' }}>Unlock multi-currency virtual accounts &amp; transfers</div>
                  </div>
                </div>
                <button onClick={() => setShowKycModal(true)} className="chip" style={{ cursor: 'pointer', background: '#EA580C', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 10, fontWeight: 700 }}>
                  Verify
                </button>
              </div>
            )}

            {activeEntity?.nuvionStatus === 'pending' && (
              <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={22} color="#1D4ED8" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>Verification Pending</div>
                    <div style={{ fontSize: 11, color: '#1D4ED8' }}>Submitted to Nuvion compliance. Virtual bank accounts will activate upon approval.</div>
                  </div>
                </div>
                <span className="chip" style={{ background: '#2563EB', color: '#fff', fontWeight: 700, padding: '4px 10px', borderRadius: 8, fontSize: 11 }}>
                  PENDING
                </span>
              </div>
            )}

            {activeEntity?.nuvionStatus === 'approved' && (
              <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 16, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={20} color="#047857" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>Verified {accountType === 'PERSONAL' ? 'Personal Account' : 'Corporate Entity'}</div>
                    <div style={{ fontSize: 11, color: '#047857' }}>Tier {activeEntity.nuvionTier || (accountType === 'PERSONAL' ? 1 : 2)} • Virtual bank accounts active</div>
                  </div>
                </div>
                <div className="chip" style={{ background: '#059669', color: '#fff', fontWeight: 800, padding: '4px 10px', borderRadius: 8, fontSize: 11 }}>
                  APPROVED
                </div>
              </div>
            )}


            {/* Hero Balance Card */}
            <div className="hero">
              <div className="bal-head">
                <span className="label">
                  {accountType === 'PERSONAL' ? 'Total balance' : 'Corporate balance'}
                </span>
                <span className="ccy-tag" onClick={() => setShowCurrencyPicker(true)}>
                  <span>{selectedCurrency}</span> ⌄
                </span>
              </div>

              <div className="amount num">{formatDisplayBalance()}</div>
              <div className="true-balance">{getTrueUsdcBalance()}</div>
              <div className="delta num">+₦0.00 today</div>

              {/* MODE-GATED QUICK ACTIONS */}
              {accountType === 'PERSONAL' ? (
                <div className="quick-row">
                  <button className="quick-btn primary" onClick={() => setShowSendModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>
                    Send
                  </button>
                  <button className="quick-btn" onClick={() => setShowReceiveModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17M7 17h8M7 17V9"/></svg>Receive
                  </button>
                  <button className="quick-btn" onClick={() => setShowRequestModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4a4 4 0 00-4 4v3.2c0 .9-.32 1.77-.9 2.46L6 15h12l-1.1-1.34a3.9 3.9 0 01-.9-2.46V8a4 4 0 00-4-4z"/><path d="M10 18a2 2 0 004 0"/></svg>Request
                  </button>
                  <button className="quick-btn" onClick={() => setShowContactsModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>Contacts
                  </button>
                  <button className="quick-btn" onClick={() => setShowSaveModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Save
                  </button>
                </div>
              ) : (
                <div className="quick-row">
                  <button className="quick-btn primary" onClick={() => setShowReceiveModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17M7 17h8M7 17V9"/></svg>Receive
                  </button>
                  <button className="quick-btn" onClick={() => setCurrentScreen('invoices')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>Invoice
                  </button>
                  <button className="quick-btn" onClick={() => setCurrentScreen('payroll')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.7c2.4.3 4 2.2 4 5.3"/></svg>Payroll
                  </button>
                  <button className="quick-btn" onClick={() => setShowSendModal(true)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>Send
                  </button>
                  <button className="quick-btn" onClick={() => setCurrentScreen('cards')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards
                  </button>
                </div>
              )}
            </div>

            {/* P2P Requests Section (Personal Only) */}
            {accountType === 'PERSONAL' && (
              <div>
                <div className="section-title">
                  Requests <span className="link" onClick={() => setCurrentScreen('requests')}>See all</span>
                </div>
                {pendingRequests.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '16px 0', background: '#fff', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 12 }}>
                    No pending requests right now.
                  </div>
                ) : (
                  <div className="row-card">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="row-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4a4 4 0 00-4 4v3.2c0 .9-.32 1.77-.9 2.46L6 15h12l-1.1-1.34a3.9 3.9 0 01-.9-2.46V8a4 4 0 00-4-4z"/><path d="M10 18a2 2 0 004 0"/></svg>
                        </div>
                        <div className="row-body">
                          <div className="row-title">{req.requesterUsername || 'Friend'}</div>
                          <div className="row-sub">Requested · {req.narration || 'Payment request'}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button className="quick-btn" style={{ flex: 'none', padding: '7px 14px', flexDirection: 'row' }}>Decline</button>
                            <button className="quick-btn primary" onClick={() => handleFulfillRequest(req.id)} style={{ flex: 'none', padding: '7px 14px', flexDirection: 'row' }}>
                              Pay {req.currency} {req.amount}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Savings Section (Personal Only) */}
            {accountType === 'PERSONAL' && (
              <div>
                <div className="section-title">Savings <span className="link" onClick={() => setShowSaveModal(true)}>Manage</span></div>
                <div className="row-card" style={{ padding: '2px 4px', marginBottom: 12 }}>
                  <div className="control-row" style={{ padding: '13px 10px' }}>
                    <div>
                      <div className="l">Round-up savings</div>
                      <div className="s">Rounds every spend up, saves the difference</div>
                    </div>
                    <div className={`toggle ${roundUpEnabled ? '' : 'off'}`} onClick={() => setRoundUpEnabled(!roundUpEnabled)} />
                  </div>
                </div>
                <div className="goal-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div className="goal-name">Savings pool</div>
                    <div className="goal-amt num" style={{ fontSize: 19 }}>${savingsPool.toFixed(2)}</div>
                  </div>
                  <button className="quick-btn ghost" onClick={() => setShowSaveModal(true)} style={{ flex: 'none', padding: '9px 14px', flexDirection: 'row', gap: 6, background: '#fff' }}>Withdraw</button>
                </div>
                {savingsGoals.map(goal => (
                  <div key={goal.id} className="goal-card">
                    <div className="goal-top">
                      <div className="goal-name">{goal.name}</div>
                      <div className="goal-amt num">${goal.currentAmount.toFixed(2)} <span>of ${goal.targetAmount.toFixed(2)}</span></div>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Activity Section */}
            <div className="section-title">
              <span>{accountType === 'PERSONAL' ? 'Recent activity' : 'Recent invoices'}</span>
              <span className="link" onClick={() => setCurrentScreen(accountType === 'PERSONAL' ? 'activity' : 'invoices')}>See all</span>
            </div>
            {accountType === 'PERSONAL' ? (
              transactions.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '24px 0', background: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
                  No transactions executed yet. Your activity feed will update dynamically.
                </div>
              ) : (
                <div className="row-card">
                  {transactions.map(tx => (
                    <div key={tx.id} className="row" onClick={() => fetchPayoutTracker(tx.id)} style={{ cursor: 'pointer' }}>
                      <div className="row-icon">
                        {tx.type === 'INBOUND' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17M7 17h8M7 17V9"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>
                        )}
                      </div>
                      <div className="row-body">
                        <div className="row-title">{tx.title}</div>
                        <div className="row-sub">{tx.subtitle} · {tx.date}</div>
                      </div>
                      <div className={`row-amount ${tx.type === 'INBOUND' ? 'pos' : ''} num`}>
                        {tx.type === 'INBOUND' ? '+' : '-'}{tx.symbol}{tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              invoicesList.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '24px 0', background: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
                  No invoices created yet. Tap + New to issue an invoice.
                </div>
              ) : (
                <div className="row-card">
                  {invoicesList.map(inv => (
                    <div key={inv.id} className="row">
                      <div className="row-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/></svg>
                      </div>
                      <div className="row-body">
                        <div className="row-title">{inv.clientName}</div>
                        <div className="row-sub">Status: {inv.status}</div>
                      </div>
                      <div className="row-amount pos num">₦{inv.amount}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Bottom Navigation */}
          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home
            </button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity
            </button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards
            </button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile
            </button>
          </div>
        </div>

        {/* ===== SCREEN: CARDS ===== */}
        <div className={`screen ${currentScreen === 'cards' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <div className="logo">Virtual Cards</div>
            <button
              onClick={() => setShowCardsModal(true)}
              className="chip"
              style={{ background: 'var(--green)', color: '#0F172A', fontWeight: 700, padding: '8px 14px', cursor: 'pointer' }}
            >
              + Issue Card
            </button>
          </div>
          <div className="scroll">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Issue instant multi-currency Virtual VISA &amp; MasterCard debit cards for global online payments.
            </div>

            {/* Render Active Virtual Cards */}
            {issuedCards.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {issuedCards.map((card: any) => {
                  const isFrozen = card.status === 'FROZEN';
                  const typeBadge = card.cardType || card.type || 'PERSONAL';
                  return (
                    <div
                      key={card.id}
                      style={{
                        background: isFrozen ? 'linear-gradient(135deg, #334155, #1E293B)' : 'linear-gradient(135deg, #0F172A, #1E293B)',
                        borderRadius: 20,
                        padding: 22,
                        color: '#fff',
                        position: 'relative',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        filter: isFrozen ? 'grayscale(0.7)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Bricolage Grotesque' }}>
                          Pay<span style={{ color: 'var(--green)' }}>IT</span>
                        </div>
                        <span className="chip" style={{ background: isFrozen ? '#EF4444' : 'rgba(16,185,129,0.2)', color: isFrozen ? '#fff' : '#10B981', fontSize: 10, fontWeight: 700 }}>
                          {isFrozen ? 'FROZEN' : typeBadge}
                        </span>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3, marginBottom: 20, fontFamily: 'monospace' }}>
                        •••• •••• •••• {card.last4 || '8842'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>CARDHOLDER</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{card.cardholderName || activeEntity?.legalName || 'VALUED CLIENT'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: card.brand === 'MASTERCARD' ? '#EB001B' : '#1A1F71' }}>
                            {card.brand || 'VISA'}
                          </div>
                        </div>
                      </div>

                      {/* Card Controls */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                          onClick={() => handleFreezeVirtualCard(card.id, card.status)}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            background: isFrozen ? 'var(--green)' : '#EF4444', color: isFrozen ? '#0F172A' : '#fff',
                          }}
                        >
                          {isFrozen ? 'Unfreeze Card' : 'Freeze Card'}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`•••• •••• •••• ${card.last4}`);
                            setCopyNotification('Card Details Copied!');
                            setTimeout(() => setCopyNotification(null), 1800);
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: 'transparent', color: '#fff',
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 32, textAlign: 'center', background: '#fff' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>💳</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Virtual Cards Issued Yet</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}>
                  Issue your first Nuvion Virtual VISA or MasterCard debit card for secure online shopping &amp; corporate SaaS subscriptions.
                </div>
                <button onClick={() => setShowCardsModal(true)} className="cta">
                  Issue Virtual Card Now
                </button>
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className="navbtn" onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className="navbtn" onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className="navbtn active" onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className="navbtn" onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: PROFILE ===== */}
        <div className={`screen ${currentScreen === 'profile' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar"><div className="logo">Profile</div></div>
          <div className="scroll">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <div className="avatar-lg">
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 26, fontWeight: 700, color: 'var(--muted)' }}>
                  {getLegalDisplayName(activeEntity, currentUser).slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{getLegalDisplayName(activeEntity, currentUser)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{currentUser?.email}</div>
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 0 }}>Accounts</div>
            <div className="row-card" style={{ padding: '2px 4px' }}>
              <div className="profile-row" style={{ padding: 14 }}>
                <div>
                  <div className="r-title">{accountType === 'PERSONAL' ? 'Personal Account' : 'Corporate Business'}</div>
                  <div className="r-sub">{accountType === 'PERSONAL' ? 'Tier 1 Verification' : 'Tier 2 KYB Verification'}</div>
                </div>
                {activeEntity?.nuvionStatus === 'approved' ? (
                  <span className="chip" style={{ background: 'var(--tint)', color: 'var(--green-dark)' }}>Verified</span>
                ) : activeEntity?.nuvionStatus === 'pending' ? (
                  <span className="chip warn" style={{ background: '#FEF3C7', color: '#B45309' }}>Pending Review</span>
                ) : activeEntity?.nuvionStatus === 'rejected' ? (
                  <button onClick={() => setShowKycModal(true)} className="chip warn" style={{ background: '#FEF2F2', color: 'var(--danger)', cursor: 'pointer' }}>Re-submit Details</button>
                ) : (
                  <button onClick={() => setShowKycModal(true)} className="chip warn" style={{ cursor: 'pointer' }}>Verify Identity</button>
                )}
              </div>
            </div>

            {/* Handle / Username Customization */}
            <div className="section-title">Username Handle</div>
            <div className="row-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{activeEntity?.username || 'Not issued (Complete KYC)'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                    {activeEntity?.usernameCustomized ? 'Handle locked (1-time edit used)' : 'You have 1 opportunity to customize your handle'}
                  </div>
                </div>
                {activeEntity?.username && !activeEntity?.usernameCustomized && (
                  <button onClick={() => setShowUsernameModal(true)} className="chip" style={{ cursor: 'pointer' }}>
                    Edit Handle
                  </button>
                )}
              </div>
            </div>

            {/* Wallet & Keys */}
            <div className="section-title">Wallet &amp; keys</div>
            <div className="row-card" style={{ padding: '2px 4px' }}>
              <div className="key-row">
                <div className="r-title" style={{ fontSize: 13 }}>Your account address</div>
                <div className="r-sub" style={{ margin: '0 0 4px' }}>Safe to share — this only receives funds</div>
                <div className="key-address">
                  <span>{activeEntity?.particleNetworkAddress || 'Link your wallet to receive crypto'}</span>
                  {activeEntity?.particleNetworkAddress && (
                    <button className="copy-btn" onClick={() => navigator.clipboard.writeText(activeEntity?.particleNetworkAddress || '')}>Copy</button>
                  )}
                </div>
              </div>
            </div>

            <button className="cta ghost" style={{ marginTop: 20, color: 'var(--danger)', borderColor: '#FECACA' }} onClick={handleLogout}>
              Log out
            </button>
          </div>
          <div className="bottomnav">
            <button className="navbtn" onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className="navbtn" onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className="navbtn" onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className="navbtn active" onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: INVOICES ===== */}
        <div className={`screen ${currentScreen === 'invoices' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('home')} style={{ cursor: 'pointer' }}>← Back</button>
            <div className="logo">Invoices</div>
            <button
              onClick={() => setCurrentScreen('invoice-new')}
              className="chip"
              style={{ background: 'var(--green)', color: '#0F172A', fontWeight: 700, padding: '8px 14px', cursor: 'pointer' }}
            >
              + Create
            </button>
          </div>
          <div className="scroll">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Issue digital multi-currency invoices for business clients worldwide.
            </div>

            {invoicesList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0', background: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                No invoices created yet. Tap <strong>+ Create</strong> to issue your first invoice.
              </div>
            ) : (
              <div className="row-card">
                {invoicesList.map((inv: any) => (
                  <div key={inv.id} className="row">
                    <div className="row-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/></svg>
                    </div>
                    <div className="row-body">
                      <div className="row-title">{inv.clientName || 'Valued Client'}</div>
                      <div className="row-sub">{inv.clientEmail || 'Direct invoice'} • Status: {inv.status || 'UNPAID'}</div>
                    </div>
                    <div className="row-amount pos num">{inv.currency || 'USD'} {parseFloat(inv.amount || inv.totalAmount || '0').toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className="navbtn" onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className="navbtn" onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className="navbtn" onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className="navbtn" onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: NEW INVOICE ===== */}
        <div className={`screen ${currentScreen === 'invoice-new' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('invoices')} style={{ cursor: 'pointer' }}>← Cancel</button>
            <div className="logo">Create Invoice</div>
            <div></div>
          </div>
          <div className="scroll">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!activeEntity?.id) return;
              try {
                const targetName = (e.target as any).clientName.value;
                const targetEmail = (e.target as any).clientEmail.value;
                const targetAmount = (e.target as any).totalAmount.value;
                const targetCurrency = (e.target as any).currency.value;
                const targetDesc = (e.target as any).description.value;

                const res = await apiFetch(`${API_BASE_URL}/api/invoices/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    entityId: activeEntity.id,
                    businessCode: 'PAYIT',
                    clientName: targetName,
                    clientEmail: targetEmail,
                    totalAmount: parseFloat(targetAmount),
                    currency: targetCurrency,
                    description: targetDesc || 'Service Invoice',
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
                alert(`Invoice created successfully! ID: ${data.invoice?.id || 'INV-001'}`);
                setInvoicesList(prev => [data.invoice || { id: Date.now().toString(), clientName: targetName, clientEmail: targetEmail, amount: targetAmount, currency: targetCurrency, status: 'UNPAID' }, ...prev]);
                setCurrentScreen('invoices');
              } catch (err: any) {
                alert(err.message || 'Invoice creation failed');
              }
            }}>
              <div className="field"><label>Client / Business Name</label><input name="clientName" placeholder="Acme Corp" required /></div>
              <div className="field"><label>Client Email Address</label><input name="clientEmail" type="email" placeholder="billing@acme.com" required /></div>
              <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div className="field">
                  <label>Currency</label>
                  <select name="currency" defaultValue="USD" style={{ width: '100%', padding: 12, borderRadius: 10, background: 'var(--surface-alt)', border: '1px solid var(--border)', fontWeight: 700 }}>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="NGN">NGN (₦)</option>
                  </select>
                </div>
                <div className="field"><label>Total Amount</label><input name="totalAmount" type="number" step="0.01" placeholder="1,500.00" required /></div>
              </div>
              <div className="field"><label>Description / Payment Note</label><input name="description" placeholder="Consulting & Software Development Services" /></div>
              <button type="submit" className="cta" style={{ marginTop: 16 }}>Issue Invoice Now</button>
            </form>
          </div>
        </div>

        {/* ===== SCREEN: PAYROLL ===== */}
        <div className={`screen ${currentScreen === 'payroll' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('home')} style={{ cursor: 'pointer' }}>← Back</button>
            <div className="logo">Corporate Payroll</div>
            <button
              onClick={() => setCurrentScreen('payroll-new')}
              className="chip"
              style={{ background: 'var(--green)', color: '#0F172A', fontWeight: 700, padding: '8px 14px', cursor: 'pointer' }}
            >
              + Run Payroll
            </button>
          </div>
          <div className="scroll">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Automated multi-currency batch salary payouts for local and remote teams.
            </div>

            {payrollRunsList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '40px 0', background: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                No payroll runs executed yet. Tap <strong>+ Run Payroll</strong> to disburse salaries.
              </div>
            ) : (
              <div className="row-card">
                {payrollRunsList.map((pr: any) => (
                  <div key={pr.id} className="row">
                    <div className="row-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/></svg>
                    </div>
                    <div className="row-body">
                      <div className="row-title">{pr.title || 'Monthly Salary Batch'}</div>
                      <div className="row-sub">{pr.employeeCount || 1} Recipients • Status: {pr.status || 'COMPLETED'}</div>
                    </div>
                    <div className="row-amount pos num">{pr.currency || 'NGN'} {parseFloat(pr.totalAmount || '0').toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className="navbtn" onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className="navbtn" onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className="navbtn" onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className="navbtn" onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: NEW PAYROLL ===== */}
        <div className={`screen ${currentScreen === 'payroll-new' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('payroll')} style={{ cursor: 'pointer' }}>← Cancel</button>
            <div className="logo">Execute Payroll Run</div>
            <div></div>
          </div>
          <div className="scroll">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!activeEntity?.id) return;
              try {
                const title = (e.target as any).payrollTitle.value;
                const totalAmt = (e.target as any).totalAmount.value;
                const curr = (e.target as any).currency.value;
                const count = (e.target as any).employeeCount.value;

                const newRun = { id: Date.now().toString(), title, totalAmount: totalAmt, currency: curr, employeeCount: count, status: 'COMPLETED' };
                setPayrollRunsList(prev => [newRun, ...prev]);
                alert(`Payroll execution successful for ${count} employees!`);
                setCurrentScreen('payroll');
              } catch (err: any) {
                alert(err.message || 'Payroll execution failed');
              }
            }}>
              <div className="field"><label>Payroll Batch Title</label><input name="payrollTitle" placeholder="July 2026 Engineering Salaries" required /></div>
              <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div className="field">
                  <label>Currency</label>
                  <select name="currency" defaultValue="NGN" style={{ width: '100%', padding: 12, borderRadius: 10, background: 'var(--surface-alt)', border: '1px solid var(--border)', fontWeight: 700 }}>
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="field"><label>Total Batch Amount</label><input name="totalAmount" type="number" step="0.01" placeholder="450,000.00" required /></div>
              </div>
              <div className="field"><label>Number of Team Members</label><input name="employeeCount" type="number" min="1" defaultValue="5" required /></div>
              <button type="submit" className="cta" style={{ marginTop: 16 }}>Disburse Payroll Batch</button>
            </form>
          </div>
        </div>

        {/* ===== MODAL: KYC / KYB IDENTITY VERIFICATION ===== */}
        {showKycModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)' }}>
              <button onClick={() => setShowKycModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 6 }}>
                Verify {accountType === 'PERSONAL' ? 'Personal Identity (Tier 1)' : 'Business Incorporation (Tier 2)'}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Required by financial compliance to issue dedicated multi-currency accounts and your unique username.
              </div>

              <form onSubmit={handleSubmitKyc}>
                {accountType === 'PERSONAL' ? (
                  <>
                    <div className="field"><label>Legal Full Name (First &amp; Last Name)</label><input placeholder="Tomiwa Ade" value={kycLegalName} onChange={e => setKycLegalName(e.target.value)} required /></div>
                    <div className="field"><label>Mobile Phone Number</label><input type="tel" placeholder="+2348012345678" value={kycPhone} onChange={e => setKycPhone(e.target.value)} required /></div>
                    <div className="field"><label>Bank Verification Number (BVN) / NIN</label><input placeholder="22113344556" maxLength={11} value={kycBvn} onChange={e => setKycBvn(e.target.value)} required /></div>
                    <div className="field"><label>Date of Birth</label><input type="date" value={kycDob} onChange={e => setKycDob(e.target.value)} required /></div>
                    <div className="field"><label>Home Address</label><input placeholder="Lagos, Nigeria" value={kycAddress} onChange={e => setKycAddress(e.target.value)} required /></div>
                  </>
                ) : (
                  <>
                    <div className="field"><label>Business Legal Name</label><input placeholder="Acme Tech Solutions Ltd" value={kycLegalName} onChange={e => setKycLegalName(e.target.value)} required /></div>
                    <div className="field"><label>Business Tag / Handle</label><input placeholder="ACME" value={kycBusinessTag} onChange={e => setKycBusinessTag(e.target.value)} required /></div>
                    <div className="field"><label>CAC Registration / RC Number</label><input placeholder="RC123456" value={kycRcNumber} onChange={e => setKycRcNumber(e.target.value)} required /></div>
                    <div className="field"><label>Tax Identification Number (TIN)</label><input placeholder="TIN987654" value={kycTin} onChange={e => setKycTin(e.target.value)} required /></div>
                    <div className="field"><label>Business Address</label><input placeholder="Victoria Island, Lagos" value={kycAddress} onChange={e => setKycAddress(e.target.value)} required /></div>
                    <div className="field"><label>Director Full Name (UBO)</label><input placeholder="Director Name" value={kycUboName} onChange={e => setKycUboName(e.target.value)} required /></div>
                    <div className="field"><label>Director BVN / NIN</label><input placeholder="22113344556" maxLength={11} value={kycBvn} onChange={e => setKycBvn(e.target.value)} required /></div>
                  </>
                )}

                <button type="submit" disabled={isSubmittingKyc} className="cta">
                  {isSubmittingKyc ? 'Submitting to Nuvion Compliance...' : 'Submit Credentials to Nuvion'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: RECEIVE ACCOUNTS (FIAT & CRYPTO) ===== */}
        {showReceiveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => setShowReceiveModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 4 }}>Receive Money</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Your dedicated multi-currency accounts derived via Nuvion &amp; Particle Network.
              </div>

              {/* Receive Tab Selector */}
              <div style={{ display: 'flex', background: 'var(--surface-alt)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                <button
                  onClick={() => setReceiveTab('fiat')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    background: receiveTab === 'fiat' ? '#fff' : 'transparent',
                    color: receiveTab === 'fiat' ? 'var(--text)' : 'var(--muted)',
                    boxShadow: receiveTab === 'fiat' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Bank Accounts (Fiat)
                </button>
                <button
                  onClick={() => setReceiveTab('crypto')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    background: receiveTab === 'crypto' ? '#fff' : 'transparent',
                    color: receiveTab === 'crypto' ? 'var(--text)' : 'var(--muted)',
                    boxShadow: receiveTab === 'crypto' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Account Address
                </button>
              </div>

              {receiveTab === 'fiat' ? (
                <div style={{ overflowY: 'auto', paddingRight: 4 }}>
                  {activeEntity?.fiatAccounts && activeEntity.fiatAccounts.length > 0 ? (
                    activeEntity.fiatAccounts.map((acc, idx) => (
                      <div key={acc.id || acc.nuvionAccountId || idx} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="chip" style={{ background: 'var(--tint)', color: 'var(--green-dark)', fontWeight: 800 }}>
                            {acc.currency} Virtual Bank Account
                          </span>
                          <strong style={{ fontSize: 12, color: 'var(--text)' }}>{acc.bankName}</strong>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Bricolage Grotesque', letterSpacing: 0.5, margin: '6px 0', color: 'var(--text)' }}>
                          {acc.accountNumber}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Holder: <strong>{getLegalDisplayName(activeEntity, currentUser)}</strong>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(acc.accountNumber);
                              setCopyNotification(`Copied ${acc.currency} Account!`);
                              setTimeout(() => setCopyNotification(null), 1800);
                            }}
                            className="chip"
                            style={{ cursor: 'pointer', background: 'var(--green)', color: '#fff', border: 'none' }}
                          >
                            Copy Account
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                        No virtual bank accounts provisioned yet. Complete identity verification to unlock accounts.
                      </div>
                      <button onClick={() => { setShowReceiveModal(false); setShowKycModal(true); }} className="cta">
                        Verify Identity Now
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
                  {/* EVM Universal Account */}
                  <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>EVM Account Address (Polygon, Base, Arbitrum)</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Safe to share — receives incoming USD &amp; multi-currency transfers.</div>
                    <div className="key-address" style={{ background: '#fff', padding: 10, borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: 11, fontWeight: 700, wordBreak: 'break-all', color: 'var(--text)' }}>
                        {activeEntity?.particleNetworkAddress || 'Link your wallet to receive crypto'}
                      </code>
                      <button
                        className="copy-btn"
                        style={{ marginLeft: 8 }}
                        onClick={() => {
                          navigator.clipboard.writeText(activeEntity?.particleNetworkAddress || '');
                          setCopyNotification('Copied EVM Address!');
                          setTimeout(() => setCopyNotification(null), 1800);
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Solana Universal Account */}
                  <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Solana Account Address (Solana Mainnet)</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Base58 address for Solana multi-currency transfers.</div>
                    <div className="key-address" style={{ background: '#fff', padding: 10, borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: 11, fontWeight: 700, wordBreak: 'break-all', color: 'var(--text)' }}>
                        {(activeEntity as any)?.solanaAddress || 'Solana address assigned upon Tier 1 verification'}
                      </code>
                      <button
                        className="copy-btn"
                        style={{ marginLeft: 8 }}
                        onClick={() => {
                          navigator.clipboard.writeText((activeEntity as any)?.solanaAddress || activeEntity?.particleNetworkAddress || '');
                          setCopyNotification('Copied Solana Address!');
                          setTimeout(() => setCopyNotification(null), 1800);
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {copyNotification && (
                <div style={{ background: 'var(--green)', color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, textAlign: 'center', marginTop: 10 }}>
                  {copyNotification}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== MODAL: SEND TRANSFER ===== */}
        {showSendModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 460, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)', maxHeight: '92vh', overflowY: 'auto' }}>
              <button onClick={() => setShowSendModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>

              <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 4 }}>Send Money</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Transfer to any bank account or web3 wallet address, worldwide.
              </div>

              {/* Mode Switcher */}
              <div style={{ display: 'flex', background: 'var(--surface-alt)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
                <button
                  onClick={() => setSendModeTab('fiat')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: sendModeTab === 'fiat' ? '#fff' : 'transparent', color: sendModeTab === 'fiat' ? 'var(--text)' : 'var(--muted)', boxShadow: sendModeTab === 'fiat' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                >
                  Bank Transfer
                </button>
                <button
                  onClick={() => setSendModeTab('crypto')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: sendModeTab === 'crypto' ? '#fff' : 'transparent', color: sendModeTab === 'crypto' ? 'var(--text)' : 'var(--muted)', boxShadow: sendModeTab === 'crypto' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                >
                  Send to Wallet
                </button>
              </div>

              {sendStatusMsg && (
                <div style={{ padding: 12, borderRadius: 10, fontSize: 12, marginBottom: 14, textAlign: 'center', background: sendStatusMsg.type === 'success' ? 'var(--tint)' : sendStatusMsg.type === 'warning' ? '#FEF3C7' : '#FEF2F2', color: sendStatusMsg.type === 'success' ? 'var(--green-dark)' : sendStatusMsg.type === 'warning' ? '#B45309' : 'var(--danger)' }}>
                  {sendStatusMsg.text}
                </div>
              )}

              <form onSubmit={handleSendSubmit}>
                {sendModeTab === 'fiat' ? (
                  <>
                    {/* Currency selector */}
                    <div className="field">
                      <label>Currency</label>
                      <select value={sendCurrency} onChange={e => { setSendCurrency(e.target.value); setSendIbanOrRouting(''); setSendBicOrSwift(''); setSendSortCode(''); setSendAccountNumber(''); setSendBankName(''); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: '#fff', fontSize: 14, fontWeight: 600 }}>
                        <option value="NGN">🇳🇬 NGN — Nigerian Naira</option>
                        <option value="USD">🇺🇸 USD — US Dollar</option>
                        <option value="EUR">🇪🇺 EUR — Euro</option>
                        <option value="GBP">🇬🇧 GBP — British Pound</option>
                        <option value="CAD">🇨🇦 CAD — Canadian Dollar</option>
                        <option value="AED">🇦🇪 AED — UAE Dirham</option>
                        <option value="KES">🇰🇪 KES — Kenyan Shilling</option>
                        <option value="ZAR">🇿🇦 ZAR — South African Rand</option>
                        <option value="GHS">🇬🇭 GHS — Ghanaian Cedi</option>
                        <option value="UGX">🇺🇬 UGX — Ugandan Shilling</option>
                        <option value="TZS">🇹🇿 TZS — Tanzanian Shilling</option>
                      </select>
                    </div>

                    {/* Clearing network hint */}
                    {(() => {
                      const hints: Record<string, string> = {
                        NGN: 'Sent via NIBSS Instant Payment · arrives in seconds',
                        USD: 'Sent via ACH / SWIFT · 1–2 business days internationally',
                        EUR: 'Sent via SEPA Instant · arrives within 10 seconds',
                        GBP: 'Sent via FPS (Faster Payments) · arrives in seconds',
                        CAD: 'Sent via EFT / Interac · 1 business day',
                        AED: 'Sent via UAEFTS · same business day',
                        KES: 'Sent via PesaLink / M-Pesa · near-instant',
                        ZAR: 'Sent via PayShap Instant · arrives in seconds',
                        GHS: 'Sent via GhIPSS Instant Pay · near-instant',
                        UGX: 'Sent via UNPSS / MTN Mobile Money',
                        TZS: 'Sent via TIPSS Instant',
                      };
                      const hint = hints[sendCurrency];
                      return hint ? (
                        <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface-alt)', borderRadius: 8, padding: '6px 10px', marginBottom: 12, marginTop: -8 }}>
                          ⚡ {hint}
                        </div>
                      ) : null;
                    })()}

                    {/* Recipient name — always shown */}
                    <div className="field">
                      <label>Recipient Name</label>
                      <input type="text" placeholder="Full name or business name" value={sendRecipient} onChange={e => setSendRecipient(e.target.value)} required />
                    </div>

                    {/* NGN: account number + bank name */}
                    {sendCurrency === 'NGN' && (
                      <>
                        <div className="field">
                          <label>Account Number</label>
                          <input type="text" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit NUBAN" value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required />
                        </div>
                        <div className="field">
                          <label>Bank Name</label>
                          <input type="text" placeholder="GTBank, Access, Zenith…" value={sendBankName} onChange={e => setSendBankName(e.target.value)} required />
                        </div>
                      </>
                    )}

                    {/* USD: ABA routing number + account number */}
                    {sendCurrency === 'USD' && (
                      <>
                        <div className="field">
                          <label>ABA Routing Number</label>
                          <input type="text" inputMode="numeric" maxLength={9} placeholder="9-digit routing number" value={sendIbanOrRouting} onChange={e => setSendIbanOrRouting(e.target.value)} required />
                        </div>
                        <div className="field">
                          <label>Account Number</label>
                          <input type="text" inputMode="numeric" placeholder="Checking / savings account" value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required />
                        </div>
                        <div className="field">
                          <label>Bank Name</label>
                          <input type="text" placeholder="Chase, Wells Fargo, Bank of America…" value={sendBankName} onChange={e => setSendBankName(e.target.value)} required />
                        </div>
                      </>
                    )}

                    {/* EUR: IBAN + BIC */}
                    {sendCurrency === 'EUR' && (
                      <>
                        <div className="field">
                          <label>IBAN</label>
                          <input type="text" placeholder="DE89 3704 0044 0532 0130 00" value={sendIbanOrRouting} onChange={e => setSendIbanOrRouting(e.target.value)} required />
                        </div>
                        <div className="field">
                          <label>BIC / SWIFT Code</label>
                          <input type="text" placeholder="e.g. COBADEFFXXX" value={sendBicOrSwift} onChange={e => setSendBicOrSwift(e.target.value)} required />
                        </div>
                      </>
                    )}

                    {/* GBP: sort code + account number */}
                    {sendCurrency === 'GBP' && (
                      <>
                        <div className="field">
                          <label>Sort Code</label>
                          <input type="text" placeholder="20-00-00" maxLength={8} value={sendSortCode} onChange={e => setSendSortCode(e.target.value)} required />
                        </div>
                        <div className="field">
                          <label>Account Number</label>
                          <input type="text" inputMode="numeric" maxLength={8} placeholder="8-digit account number" value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required />
                        </div>
                      </>
                    )}

                    {/* CAD / AED / KES / ZAR / GHS / UGX / TZS: IBAN or account + bank */}
                    {['CAD','AED','KES','ZAR','GHS','UGX','TZS'].includes(sendCurrency) && (
                      <>
                        <div className="field">
                          <label>{['KES','ZAR','GHS','UGX','TZS'].includes(sendCurrency) ? 'Account Number / Mobile Number' : 'Account or IBAN'}</label>
                          <input type="text" placeholder={sendCurrency === 'KES' ? 'Phone or account number' : 'Account or IBAN'} value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required />
                        </div>
                        <div className="field">
                          <label>Bank / Wallet Provider</label>
                          <input type="text" placeholder="Bank or mobile money provider" value={sendBankName} onChange={e => setSendBankName(e.target.value)} required />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // ── Crypto / Wallet tab ──────────────────────────────────────────
                  <>
                    <div className="field">
                      <label>Network</label>
                      <select value={sendCryptoNetwork} onChange={e => setSendCryptoNetwork(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: '#fff', fontSize: 14, fontWeight: 600 }}>
                        <option value="Polygon">Polygon</option>
                        <option value="Ethereum">Ethereum</option>
                        <option value="Arbitrum">Arbitrum One</option>
                        <option value="Optimism">Optimism</option>
                        <option value="Base">Base</option>
                        <option value="BNB Chain">BNB Smart Chain</option>
                        <option value="Solana">Solana</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Token</label>
                      <select value={sendCryptoAsset} onChange={e => setSendCryptoAsset(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: '#fff', fontSize: 14, fontWeight: 600 }}>
                        <option value="USDC">USDC — USD Coin</option>
                        <option value="USDT">USDT — Tether USD</option>
                        <option value="ETH">ETH — Ethereum</option>
                        <option value="MATIC">MATIC — Polygon</option>
                        <option value="SOL">SOL — Solana</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>Wallet Address</label>
                      <input type="text" placeholder="0x71C...9e4A" value={sendCryptoAddress} onChange={e => setSendCryptoAddress(e.target.value)} required style={{ fontFamily: 'monospace', fontSize: 13 }} />
                    </div>

                    <div style={{ background: 'var(--tint)', border: '1px solid var(--green)', borderRadius: 10, padding: 10, fontSize: 11, color: 'var(--green-dark)', fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
                      ⚡ Gasless · automatically routes across networks
                    </div>
                  </>
                )}

                {/* Amount + narration — always shown */}
                <div className="field">
                  <label>Amount ({sendModeTab === 'fiat' ? sendCurrency : sendCryptoAsset})</label>
                  <input type="number" step="0.01" min="0.01" placeholder="0.00" value={sendAmount} onChange={e => setSendAmount(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Narration <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                  <input type="text" placeholder="Invoice payment, rent, etc." value={sendNarration} onChange={e => setSendNarration(e.target.value)} />
                </div>

                {requiresPinStepUp && (
                  <div className="field">
                    <label style={{ color: 'var(--danger)', fontWeight: 700 }}>Passcode required for this transfer</label>
                    <input type="password" maxLength={6} inputMode="numeric" placeholder="6-digit PIN" value={sendStepUpPin} onChange={e => setSendStepUpPin(e.target.value)} required />
                  </div>
                )}

                <button type="submit" disabled={isSubmittingSend} className="cta" style={{ marginTop: 4 }}>
                  {isSubmittingSend ? 'Sending…' : `Send ${sendAmount ? (sendModeTab === 'fiat' ? sendCurrency : sendCryptoAsset) + ' ' + sendAmount : 'Money'}`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: REQUEST PAYMENT ===== */}
        {showRequestModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)' }}>
              <button onClick={() => setShowRequestModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 6 }}>Request Payment</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Request funds from users on your accepted friends list.
              </div>

              {requestStatusMsg && (
                <div style={{
                  padding: 12, borderRadius: 10, fontSize: 12, marginBottom: 14, textAlign: 'center',
                  background: requestStatusMsg.type === 'success' ? 'var(--tint)' : '#FEF2F2',
                  color: requestStatusMsg.type === 'success' ? 'var(--green-dark)' : 'var(--danger)',
                }}>
                  {requestStatusMsg.text}
                </div>
              )}

              <form onSubmit={handleCreatePaymentRequest}>
                <div className="field">
                  <label>Payer Handle / Username</label>
                  <input type="text" placeholder="@tomiwa" value={requestPayer} onChange={e => setRequestPayer(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Amount ({selectedCurrency})</label>
                  <input type="number" step="0.01" placeholder="45000" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Narration</label>
                  <input type="text" placeholder="Weekend trip split" value={requestNarration} onChange={e => setRequestNarration(e.target.value)} required />
                </div>

                <button type="submit" disabled={isSubmittingRequest} className="cta">
                  {isSubmittingRequest ? 'Sending Request...' : `Send Request for ${selectedCurrency} ${requestAmount || ''}`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: USERNAME CUSTOMIZATION ===== */}
        {showUsernameModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)' }}>
              <button onClick={() => setShowUsernameModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 6 }}>Customize Handle</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                You have 1 single opportunity to edit your handle. It must be unique.
              </div>

              <form onSubmit={handleUpdateUsername}>
                <div className="field">
                  <label>New Handle</label>
                  <input
                    type="text"
                    placeholder="@igboze"
                    value={customUsernameInput}
                    onChange={e => handleCheckUsername(e.target.value)}
                    required
                  />
                </div>

                {usernameAvailability && (
                  <div style={{
                    fontSize: 12, fontWeight: 600, padding: 8, borderRadius: 8, marginBottom: 14, textAlign: 'center',
                    background: usernameAvailability.available ? 'var(--tint)' : '#FEF2F2',
                    color: usernameAvailability.available ? 'var(--green-dark)' : 'var(--danger)',
                  }}>
                    {usernameAvailability.message}
                  </div>
                )}

                <button type="submit" disabled={!usernameAvailability?.available} className="cta">
                  Save Handle Permanently
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: KMS KEY EXPORT REMOVED ===== */}
        {/* ===== MODAL: VIRTUAL CARD ISSUANCE ===== */}
        {showCardsModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)', maxHeight: '90vh', overflowY: 'auto' }}>
              <button onClick={() => setShowCardsModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 4 }}>
                Issue Virtual Card
              </h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Select your virtual card type. The issuance fee is debited directly from your PayIT balance.
              </div>

              <form onSubmit={handleIssueVirtualCard}>
                {/* 1. Nuvion Card Type Selection */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                    Select Card Type
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Personal Card Option */}
                    <div
                      onClick={() => setSelectedCardType('PERSONAL')}
                      style={{
                        padding: 14, borderRadius: 14, border: `2px solid ${selectedCardType === 'PERSONAL' ? 'var(--green)' : 'var(--border)'}`,
                        background: selectedCardType === 'PERSONAL' ? 'var(--tint)' : 'var(--surface-alt)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Personal Virtual Card</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Standard multi-currency spending card for online shopping &amp; subscriptions.</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green-dark)' }}>$3.00</div>
                        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Issuance Fee</div>
                      </div>
                    </div>

                    {/* Business Card Option */}
                    <div
                      onClick={() => setSelectedCardType('BUSINESS')}
                      style={{
                        padding: 14, borderRadius: 14, border: `2px solid ${selectedCardType === 'BUSINESS' ? 'var(--green)' : 'var(--border)'}`,
                        background: selectedCardType === 'BUSINESS' ? 'var(--tint)' : 'var(--surface-alt)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Corporate Treasury Card</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>High-limit corporate card for team expenses &amp; vendor payouts.</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green-dark)' }}>$5.00</div>
                        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Issuance Fee</div>
                      </div>
                    </div>

                    {/* Disposable Burner Card Option */}
                    <div
                      onClick={() => setSelectedCardType('BURNER')}
                      style={{
                        padding: 14, borderRadius: 14, border: `2px solid ${selectedCardType === 'BURNER' ? 'var(--green)' : 'var(--border)'}`,
                        background: selectedCardType === 'BURNER' ? 'var(--tint)' : 'var(--surface-alt)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Single-Use Burner Card</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Auto-destroying single transaction card for 100% fraud safety.</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green-dark)' }}>$1.50</div>
                        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>Issuance Fee</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Network Brand Selection */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                    Card Network Brand
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setCardBrand('VISA')}
                      style={{
                        flex: 1, padding: 12, borderRadius: 12, border: `2px solid ${cardBrand === 'VISA' ? 'var(--green)' : 'var(--border)'}`,
                        background: cardBrand === 'VISA' ? 'var(--tint)' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      VISA Virtual
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardBrand('MASTERCARD')}
                      style={{
                        flex: 1, padding: 12, borderRadius: 12, border: `2px solid ${cardBrand === 'MASTERCARD' ? 'var(--green)' : 'var(--border)'}`,
                        background: cardBrand === 'MASTERCARD' ? 'var(--tint)' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      MasterCard Virtual
                    </button>
                  </div>
                </div>

                {/* Cardholder Name & Fee Breakdown */}
                <div style={{ background: 'var(--surface-alt)', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>Cardholder Name:</span>
                    <strong style={{ color: 'var(--text)' }}>
                      {activeEntity?.legalName && !activeEntity.legalName.includes('@') && activeEntity.legalName !== 'payitdev'
                        ? activeEntity.legalName
                        : currentUser?.name || 'Valued Client'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>Payment Source:</span>
                    <strong style={{ color: 'var(--text)' }}>PayIT Balance</strong>
                  </div>
                </div>

                <button type="submit" disabled={isIssuingCard} className="cta">
                  {isIssuingCard ? 'Processing Virtual Card Issuance...' : `Confirm & Issue ${selectedCardType} Card`}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: CURRENCY PICKER ===== */}
        {showCurrencyPicker && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 360, padding: 20, position: 'relative', background: '#fff', color: 'var(--text)' }}>
              <button onClick={() => setShowCurrencyPicker(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Bricolage Grotesque', marginBottom: 14 }}>Select Display Currency</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {['NGN', 'USD', 'EUR', 'GBP', 'KES', 'GHS', 'ZAR', 'CAD', 'AED', 'UGX', 'TZS'].map(ccy => (
                  <button
                    key={ccy}
                    className={`quick-btn ${selectedCurrency === ccy ? 'primary' : ''}`}
                    onClick={() => { setSelectedCurrency(ccy); setShowCurrencyPicker(false); }}
                    style={{ padding: '10px 4px', flexDirection: 'row', justifyContent: 'center' }}
                  >
                    {ccy}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== MODAL: CROSS-BORDER PAYMENT TRACKER ===== */}
        {showTrackerModal && trackerData && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)' }}>
              <button onClick={() => setShowTrackerModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Globe size={24} color="var(--green)" />
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Bricolage Grotesque' }}>
                    Cross-Border Payment Tracker
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Live status via Nuvion &amp; {trackerData.clearingNetwork}
                  </div>
                </div>
              </div>

              {/* Step Progress Tracker */}
              <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', marginBottom: 12 }}>
                  <div style={{ position: 'absolute', top: 14, left: '10%', right: '10%', height: 2, background: 'var(--border)', zIndex: 0 }} />
                  
                  {['Initiated', 'In Transit', 'Clearing', 'Delivered'].map((stepName, idx) => {
                    const stepNum = idx + 1;
                    const isDone = trackerData.stepIndex >= stepNum;
                    const isCurrent = trackerData.stepIndex === stepNum;
                    return (
                      <div key={stepName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: isDone ? 'var(--green)' : isCurrent ? 'var(--tint)' : 'var(--border)',
                          border: `2px solid ${isDone ? 'var(--green)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isDone ? '#fff' : 'var(--muted)', fontSize: 12, fontWeight: 700,
                        }}>
                          {isDone ? '✓' : stepNum}
                        </div>
                        <span style={{ fontSize: 10, color: isDone || isCurrent ? 'var(--text)' : 'var(--muted)', marginTop: 6, fontWeight: isCurrent ? 700 : 400 }}>
                          {stepName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SWIFT / FedWire UETR Code Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--tint)', border: '1px solid var(--green)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--green-dark)', fontWeight: 600, marginBottom: 4 }}>SWIFT / FedWire UETR Tracking Code</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: 1 }}>{trackerData.uetrReference}</code>
                    <button onClick={() => navigator.clipboard.writeText(trackerData.uetrReference)} className="chip" style={{ cursor: 'pointer' }}>Copy</button>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-alt)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>Clearing Network:</span>
                    <strong style={{ color: 'var(--text)' }}>{trackerData.clearingNetwork}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>Estimated Arrival:</span>
                    <strong style={{ color: 'var(--green-dark)' }}>{trackerData.estimatedDelivery}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>Destination Bank:</span>
                    <strong style={{ color: 'var(--text)' }}>{trackerData.beneficiaryBank}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== NEW PROD SOCIAL COMPONENTS ===== */}
        <UsernameCustomizationModal
          isOpen={!!(activeEntity && !activeEntity.usernameCustomized && !showUsernameModal)}
          entityId={activeEntity?.id || ''}
          currentUsername={activeEntity?.username}
          onSuccess={(newHandle) => {
            if (activeEntity) {
              setEntitiesMap(prev => ({
                ...prev,
                [accountType]: {
                  ...prev[accountType],
                  username: newHandle,
                  usernameCustomized: true as any,
                }
              }));
            }
          }}
        />

        <PaymentRequestHubModal
          isOpen={showRequestModal}
          entityId={activeEntity?.id || ''}
          onClose={() => setShowRequestModal(false)}
          onPaymentSuccess={() => {
            // Balance refresh
          }}
        />

        <ContactsManagerModal
          isOpen={showContactsModal}
          entityId={activeEntity?.id || ''}
          onClose={() => setShowContactsModal(false)}
          onSelectContactForTransfer={() => {
            setShowSendModal(true);
          }}
        />

      </div>
    </div>
  );
}
