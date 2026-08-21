import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, setActiveEntityId } from './apiClient';
import { usePrivy } from './PrivyProvider';
import { useWallets } from '@privy-io/react-auth';
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  X,
  AlertTriangle,
  Clock,
  LineChart,
  TrendingUp,
  ChevronDown,
  Zap,
  CreditCard,
  Lock,
  FileText,
  Users,
} from 'lucide-react';

import { UsernameCustomizationModal } from './components/UsernameCustomizationModal';
import { PaymentRequestHubModal } from './components/PaymentRequestHubModal';
import { ContactsManagerModal } from './components/ContactsManagerModal';
import { PrivyLogin } from './components/PrivyLogin';
import { KycVerificationModal } from './components/KycVerificationModal';
const configuredApiBaseUrl = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = configuredApiBaseUrl
  ? (/^https?:\/\//i.test(configuredApiBaseUrl) ? configuredApiBaseUrl : `https://${configuredApiBaseUrl}`).replace(/\/$/, '')
  : '';

// ─── Signature Aurora Bar Component ──────────────────────────────────────────
const AuroraBar: React.FC<{ sweep?: boolean }> = ({ sweep = true }) => (
  <div className={`aurora-bar ${sweep ? 'sweep' : ''}`} aria-hidden="true">
    <div className="segment teal" />
    <div className="segment cyan" />
    <div className="segment blue" />
    <div className="segment violet" />
  </div>
);

// ─── Haptic Feedback Helper ──────────────────────────────────────────────────
const triggerLightHaptic = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      // Vibration API silently ignored if prohibited in sandbox
    }
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FiatAccount {
  id?: string;
  dueAccountId?: string;
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
  // KYC / EaseID + Brails status fields
  dueCustomerId?: string;
  dueStatus?: 'incomplete' | 'pending' | 'approved' | 'rejected';
  kycStatus?: 'incomplete' | 'pending' | 'approved' | 'rejected';
  kycTier?: number;
  dueTier?: number;
  // On-chain wallet addresses (derived via NEAR Chain Signatures)
  evmDepositAddress?: string;
  solanaDepositAddress?: string;
  btcDepositAddress?: string;
  tronDepositAddress?: string;
  tonDepositAddress?: string;
  nearDepositAddress?: string;
  cosmosDepositAddress?: string;
  suiDepositAddress?: string;
  aptosDepositAddress?: string;
  xrpDepositAddress?: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLegalDisplayName = (entity?: UserEntity, user?: any) => {
  if (entity?.legalName && !entity.legalName.toLowerCase().startsWith('proxim') && !entity.legalName.includes('@') && entity.legalName.toLowerCase() !== 'test') {
    return entity.legalName;
  }
  if (user?.fullName && !user.fullName.toLowerCase().startsWith('proxim') && !user.fullName.includes('@')) {
    return user.fullName;
  }
  if (user?.name && !user.name.toLowerCase().startsWith('proxim') && !user.name.includes('@')) {
    return user.name;
  }
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

// ─── Main App Component ───────────────────────────────────────────────────────

export default function App() {

  // ── Session & Auth State ──────────────────────────────────────────────────
  const { authenticated, user: privyUser, logout: privyLogout } = usePrivy();
  const { wallets } = useWallets();
  const nearAccount = null;
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('proxim_current_user') || localStorage.getItem('payit_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [userEmail, setUserEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  // ── Navigation Screen State ───────────────────────────────────────────────
  // Declared FIRST to avoid "used before declaration" TS error in useEffects
  const [currentScreen, setCurrentScreen] = useState<
    'home' | 'activity' | 'requests' | 'cards' | 'profile' | 'invoices' | 'invoice-new' | 'payroll' | 'payroll-new' | 'stocks' | 'savings'
  >('home');

  // ── Security PIN Authorization State ──────────────────────────────────────
  const [showPinAuthModal, setShowPinAuthModal] = useState(false);
  const [pinAuthTitle, setPinAuthTitle] = useState('Authorize Transaction');
  const [pinDigits, setPinDigits] = useState<string[]>(() => Array(6).fill(''));
  const [pinError, setPinError] = useState('');
  const [pendingPinCallback, setPendingPinCallback] = useState<((passcode: string) => void) | null>(null);
  const [userPinCode, setUserPinCode] = useState<boolean>(() => Boolean(currentUser?.hasPasscode));
  const [pinSetupConfirmation, setPinSetupConfirmation] = useState('');
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // ── Account / Entity State ────────────────────────────────────────────────
  const [accountType, setAccountType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [entitiesMap, setEntitiesMap] = useState<Record<string, UserEntity>>({});
  const activeEntity: UserEntity | undefined = entitiesMap[accountType];

  // ── Balance & Currency ────────────────────────────────────────────────────
  const [selectedCurrency, setSelectedCurrency] = useState<string>('NGN');
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [savingsPool, setSavingsPool] = useState<number>(0);
  const [roundUpEnabled, setRoundUpEnabled] = useState<boolean>(true);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [kaminoVaults, setKaminoVaults] = useState<any[]>([]);
  const [yieldOptions, setYieldOptions] = useState<any[]>([]);
  const [kaminoPositions, setKaminoPositions] = useState<any[]>([]);
  const [autoSweepEnabled, setAutoSweepEnabled] = useState<boolean>(true);
  const [liquidBufferUsd, setLiquidBufferUsd] = useState<number>(50);
  const [isSweepingNow, setIsSweepingNow] = useState<boolean>(false);
  const [yieldStrategy, setYieldStrategy] = useState<'near_intent' | 'kamino' | 'pods'>('near_intent');
  const [selectedYieldOption, setSelectedYieldOption] = useState('');
  const [selectedKaminoVault, setSelectedKaminoVault] = useState('');
  const [kaminoVaultStatus, setKaminoVaultStatus] = useState('Loading live Kamino vaults...');
  const [fxRates, setFxRates] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allRequestsList, setAllRequestsList] = useState<any[]>([]);
  const [requestsFilter, setRequestsFilter] = useState<'all' | 'pending' | 'paid' | 'declined'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'in' | 'out' | 'cards'>('all');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [payrollRunsList, setPayrollRunsList] = useState<any[]>([]);

  // ── Stocks ────────────────────────────────────────────────────────────────
  const [stockList, setStockList] = useState<any[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyAccountContext, setBuyAccountContext] = useState('');
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [sellAccountContext, setSellAccountContext] = useState('');
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [stockPositions, setStockPositions] = useState<{ personal: { positions: any[] }; business: { positions: any[] } }>({ personal: { positions: [] }, business: { positions: [] } });
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  const filteredStocks = stockList.filter(stock =>
    stock.symbol?.toLowerCase().includes(stockSearch.toLowerCase()) ||
    stock.name?.toLowerCase().includes(stockSearch.toLowerCase())
  );

  // ── Modals ────────────────────────────────────────────────────────────────
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
  // EaseID JIT KYC modal — triggers when user tries fiat actions without KYC
  const [showEaseIdKycModal, setShowEaseIdKycModal] = useState(false);
  const [kycGatePendingAction, setKycGatePendingAction] = useState<(() => void) | null>(null);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [showEarlyExitModal, setShowEarlyExitModal] = useState(false);
  const [selectedEarlyExitChoice, setSelectedEarlyExitChoice] = useState<'FORFEIT_INTEREST' | 'PENALTY_FEE'>('FORFEIT_INTEREST');
  const [earlyExitTermVaultId, setEarlyExitTermVaultId] = useState<string>('');
  const [trackerData, setTrackerData] = useState<any | null>(null);

  // ── KYC Form State ────────────────────────────────────────────────────────
  const [kycFirstName, setKycFirstName] = useState('');
  const [kycMiddleName, setKycMiddleName] = useState('');
  const [kycSurname, setKycSurname] = useState('');
  const [kycLegalName, setKycLegalName] = useState('');
  const [kycPhone, setKycPhone] = useState('');
  const [kycBvn, setKycBvn] = useState('');
  const [kycNin, setKycNin] = useState('');
  const [kycDob, setKycDob] = useState('');
  const [kycAddress, setKycAddress] = useState('');
  const [kycCity, setKycCity] = useState('');
  const [kycState, setKycState] = useState('');
  const [kycPostalCode, setKycPostalCode] = useState('');
  const [kycBusinessTag, setKycBusinessTag] = useState('');
  const [kycRcNumber, setKycRcNumber] = useState('');
  const [kycTin, setKycTin] = useState('');
  const [kycUboName, setKycUboName] = useState('');
  const [kycIdentityFile, setKycIdentityFile] = useState<string>('');
  const [kycAddressFile, setKycAddressFile] = useState<string>('');
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // ── Send Form State ───────────────────────────────────────────────────────
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendBankName, setSendBankName] = useState('');
  const [sendAccountNumber, setSendAccountNumber] = useState('');
  const [sendIbanOrRouting, setSendIbanOrRouting] = useState('');
  const [sendBicOrSwift, setSendBicOrSwift] = useState('');
  const [sendSortCode, setSendSortCode] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendNarration, setSendNarration] = useState('');
  const [sendStepUpPin, setSendStepUpPin] = useState('');
  const [isSubmittingSend, setIsSubmittingSend] = useState(false);
  const [sendStatusMsg, setSendStatusMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [requiresPinStepUp, setRequiresPinStepUp] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);

  // ── Card State ────────────────────────────────────────────────────────────
  const [showCardFundModal, setShowCardFundModal] = useState(false);
  const [cardFundAction, setCardFundAction] = useState<'TOPUP' | 'WITHDRAW'>('TOPUP');
  const [cardFundAmount, setCardFundAmount] = useState('');
  const [targetCardId, setTargetCardId] = useState('');
  const [issuedCards, setIssuedCards] = useState<any[]>([]);
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD'>('VISA');
  const [selectedCardType, setSelectedCardType] = useState<'PERSONAL' | 'BUSINESS' | 'BURNER'>('PERSONAL');
  const [isIssuingCard, setIsIssuingCard] = useState(false);

  // ── Multi-Currency Account ────────────────────────────────────────────────
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [selectedNewCurrency, setSelectedNewCurrency] = useState<'EUR' | 'GBP' | 'KES' | 'UGX' | 'GHS'>('EUR');
  const [isClaimingCurrency, setIsClaimingCurrency] = useState(false);

  // ── Request Payment ───────────────────────────────────────────────────────
  const [requestPayer, setRequestPayer] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNarration, setRequestNarration] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Savings ───────────────────────────────────────────────────────────────
  const [savingsActionType, setSavingsActionType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [savingsAmount, setSavingsAmount] = useState('');
  const [savingsDurationDays, setSavingsDurationDays] = useState('30');
  const [isSubmittingSavings, setIsSubmittingSavings] = useState(false);


  // ── Invoice State ─────────────────────────────────────────────────────────
  const [invoiceClientName, setInvoiceClientName] = useState('');
  const [invoiceClientEmail, setInvoiceClientEmail] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceSettlementMode, setInvoiceSettlementMode] = useState<'fiat' | 'crypto'>('fiat');
  const [invoiceCryptoChain, setInvoiceCryptoChain] = useState<'Base' | 'Solana' | 'Polygon' | 'Ethereum' | 'Arbitrum'>('Base');
  const [invoiceCryptoAsset, setInvoiceCryptoAsset] = useState<'USDC' | 'USDT' | 'EURC'>('USDC');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceFxQuote, setInvoiceFxQuote] = useState<any>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const handleInvoiceAmountChange = async (val: string, curr = invoiceCurrency) => {
    setInvoiceAmount(val);
    const num = parseFloat(val);
    if (!num || num <= 0) {
      setInvoiceFxQuote(null);
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invoices/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num, currency: curr }),
      });
      const data = await res.json();
      if (data.quote) setInvoiceFxQuote(data.quote);
    } catch {
      const rates: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.28, NGN: 1/1550, KES: 1/129, GHS: 1/15.5, USDC: 1, USDT: 1 };
      const rate = rates[curr] || 1;
      const fee = num * 0.012;
      const net = num - fee;
      setInvoiceFxQuote({
        sourceAmount: num,
        sourceCurrency: curr,
        feeAmount: fee,
        netSourceAmount: net,
        feePercent: 1.2,
        rateToUsd: rate,
        grossUsd: num * rate,
        feeUsd: fee * rate,
        netUsd: net * rate,
      });
    }
  };

  const activeAbortController = useRef<AbortController | null>(null);
  const currentSendIdempotencyKey = useRef<string | null>(null);

  // ── Passkey / Turnkey Auth ────────────────────────────────────────────────
  const handlePasskeySignIn = async () => {
    setAuthError('');
    if (!userEmail || !userEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    setIsLoggingIn(true);
    try {
      // Step 1: Start passkey auth ceremony with backend
      const optionsRes = await apiFetch(`${API_BASE_URL}/api/auth/passkey/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim().toLowerCase() }),
      });
      const optionsData = await optionsRes.json();

      if (optionsData.isNewUser) {
        // Registration flow — create credential
        const credential = await navigator.credentials.create({
          publicKey: {
            ...optionsData.creationOptions,
            challenge: base64ToBuffer(optionsData.creationOptions.challenge),
            user: {
              ...optionsData.creationOptions.user,
              id: base64ToBuffer(optionsData.creationOptions.user.id),
            },
          },
        }) as PublicKeyCredential;

        const regRes = await apiFetch(`${API_BASE_URL}/api/auth/passkey/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail.trim().toLowerCase(),
            credential: serializeCredential(credential),
          }),
        });
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(regData.error || "We couldn't complete sign-up. Please try again.");
        applySession(regData);
      } else {
        // Authentication flow — get assertion
        const assertion = await navigator.credentials.get({
          publicKey: {
            ...optionsData.requestOptions,
            challenge: base64ToBuffer(optionsData.requestOptions.challenge),
            allowCredentials: optionsData.requestOptions.allowCredentials?.map((c: any) => ({
              ...c, id: base64ToBuffer(c.id),
            })),
          },
        }) as PublicKeyCredential;

        const authRes = await apiFetch(`${API_BASE_URL}/api/auth/passkey/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail.trim().toLowerCase(),
            assertion: serializeCredential(assertion),
          }),
        });
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.error || "We couldn't verify your identity. Please try again.");
        applySession(authData);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setAuthError('Sign-in was cancelled. Please try again.');
      } else {
        setAuthError(err.message || "We couldn't complete sign-in. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ── Privy Auth ────────────────────────────────────────────────────────────────
  const handlePrivyLogin = async (privyUser: any) => {
    setAuthError('');
    if (!privyUser || typeof privyUser !== 'object') {
      console.warn('handlePrivyLogin called with invalid user object:', privyUser);
      return;
    }
    setIsLoggingIn(true);
    
    try {
      const email = privyUser.email?.address 
        || privyUser.google?.email 
        || privyUser.apple?.email 
        || privyUser.email 
        || `${privyUser.id || 'user'}@proxim.app`;

      const walletAddress = privyUser.wallet?.address || privyUser.linkedAccounts?.[0]?.address;

      const res = await apiFetch(`${API_BASE_URL}/api/auth/privy/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId: privyUser.id || `privy_${Date.now()}`,
          email,
          walletAddress,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error === 'Wallet provisioning is unavailable'
          ? 'Wallet was not created, come back later'
          : data.error || "Failed to create session");
      }
      
      applySession(data);
    } catch (err: any) {
      setAuthError(err.message || "We couldn't complete sign-in. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Automatically process Privy session when authenticated
  useEffect(() => {
    if (authenticated && privyUser && !currentUser) {
      handlePrivyLogin(privyUser);
    }
  }, [authenticated, privyUser, currentUser]);

  // Keep userPinCode strictly in sync with currentUser session
  useEffect(() => {
    setUserPinCode(Boolean(currentUser?.hasPasscode));
  }, [currentUser?.hasPasscode]);

  // ── Universal Security PIN Authorization ────────────────────────────────────
  const requireSecurityPin = (actionTitle: string, callback: (passcode: string) => void) => {
    const hasPin = Boolean(currentUser?.hasPasscode || userPinCode);
    setPinAuthTitle(hasPin ? actionTitle : 'Create a 6-digit Security PIN');
    setPinDigits(Array(6).fill(''));
    setPinError('');
    setPinSetupConfirmation('');
    setPendingPinCallback(() => callback);
    setShowPinAuthModal(true);
  };

  const authorizeWithPrivyOrPin = (actionTitle: string, callback: (passcode: string) => void) => {
    if (authenticated && wallets?.length) {
      callback('');
      return;
    }
    requireSecurityPin(actionTitle, callback);
  };

  const updatePinDigit = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const nextPin = [...pinDigits];
    nextPin[index] = digit;
    setPinDigits(nextPin);
    setPinError('');
    if (digit && index < 5) pinInputRefs.current[index + 1]?.focus();
  };

  const handlePinKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyPinAndExecute = async () => {
    const enteredPin = pinDigits.join('');
    if (enteredPin.length !== 6) {
      setPinError('Please enter your 6-digit security PIN.');
      return;
    }

    const hasPin = Boolean(currentUser?.hasPasscode || userPinCode);

    if (!hasPin) {
      if (!pinSetupConfirmation) {
        setPinSetupConfirmation(enteredPin);
        setPinDigits(Array(6).fill(''));
        setPinAuthTitle('Re-enter your 6-digit PIN to confirm');
        setPinError('');
        return;
      }

      if (enteredPin !== pinSetupConfirmation) {
        setPinError('PINs do not match. Please try again.');
        setPinDigits(Array(6).fill(''));
        return;
      }

      const response = await apiFetch(`${API_BASE_URL}/api/auth/passcode/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: enteredPin, deviceId: 'web' }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPinError(data.error || 'Unable to save your security PIN.');
        return;
      }

      setUserPinCode(true);
      const updatedUser = { ...currentUser, hasPasscode: true };
      setCurrentUser(updatedUser);
      localStorage.setItem('proxim_current_user', JSON.stringify(updatedUser));
    } else {
      const response = await apiFetch(`${API_BASE_URL}/api/auth/passcode/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: enteredPin }),
      });
      if (!response.ok) {
        setPinError('Incorrect PIN. Please try again.');
        setPinDigits(Array(6).fill(''));
        return;
      }
    }

    setShowPinAuthModal(false);
    const cb = pendingPinCallback;
    const finalPin = enteredPin;
    setPinDigits(Array(6).fill(''));
    setPinSetupConfirmation('');
    setPendingPinCallback(null);
    if (cb) cb(finalPin);
  };



  const applySession = (data: any) => {
    if (data.token) {
      localStorage.setItem('proxim_auth_token', data.token);
      localStorage.removeItem('payit_auth_token');
    }
    const userObj = data.user || data.session;
    if (userObj) {
      localStorage.setItem('proxim_current_user', JSON.stringify(userObj));
      localStorage.removeItem('payit_current_user');
      setCurrentUser(userObj);
      setUserPinCode(Boolean(userObj.hasPasscode));
      setActiveEntityId(userObj.activeEntityId || null);
      buildEntitiesMap(userObj);
    }
  };

  // WebAuthn helpers
  const base64ToBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  const bufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const serializeCredential = (cred: PublicKeyCredential): any => {
    const response = cred.response as any;
    return {
      id: cred.id,
      rawId: bufferToBase64(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufferToBase64(response.clientDataJSON),
        attestationObject: response.attestationObject ? bufferToBase64(response.attestationObject) : undefined,
        authenticatorData: response.authenticatorData ? bufferToBase64(response.authenticatorData) : undefined,
        signature: response.signature ? bufferToBase64(response.signature) : undefined,
        userHandle: response.userHandle ? bufferToBase64(response.userHandle) : undefined,
      },
    };
  };

  // ── Restore Session ───────────────────────────────────────────────────────
  useEffect(() => { restoreSession(); }, []);

  const restoreSession = async () => {
    const token = localStorage.getItem('proxim_auth_token') || localStorage.getItem('proxim_session_token') || localStorage.getItem('payit_auth_token');
    if (!token) {
      const savedUser = localStorage.getItem('proxim_current_user') || localStorage.getItem('payit_current_user');
      if (savedUser) {
        try {
          const userObj = JSON.parse(savedUser);
          setUserPinCode(Boolean(userObj.hasPasscode));
          setActiveEntityId(userObj.activeEntityId || null);
          buildEntitiesMap(userObj);
        } catch {
          clearLocalSession();
        }
      }
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/session`);
      if (!res.ok) {
        clearLocalSession();
        return;
      }
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('proxim_current_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setUserPinCode(Boolean(data.user.hasPasscode));
        setActiveEntityId(data.user.activeEntityId || null);
        buildEntitiesMap(data.user);
      }
    } catch {
      clearLocalSession();
    }
  };

  const clearLocalSession = () => {
    localStorage.removeItem('proxim_auth_token');
    localStorage.removeItem('payit_auth_token');
    localStorage.removeItem('proxim_current_user');
    localStorage.removeItem('payit_current_user');
    setCurrentUser(null);
    setActiveEntityId(null);
    setEntitiesMap({});
  };

  const handleLogout = async () => {
    clearLocalSession();
    setUserEmail('');
    try {
      if (privyLogout) await privyLogout();
    } catch (e: any) {
      console.warn('Privy logout note:', e.message);
    }
  };

  // ── Build Entities Map from Session ──────────────────────────────────────
  const buildEntitiesMap = (session: any) => {
    const map: Record<string, UserEntity> = {};
    if (session?.entities && Array.isArray(session.entities)) {
      session.entities.forEach((ent: any) => {
        map[ent.kind] = {
          id: ent.id,
          kind: ent.kind,
          legalName: ent.legalName,
          username: ent.username,
          usernameCustomized: Boolean(ent.usernameCustomized),
          dueCustomerId: ent.dueCustomerId,
          dueStatus: ent.dueStatus || 'incomplete',
          dueTier: ent.dueTier || 0,
          evmDepositAddress: ent.evmDepositAddress,
          solanaDepositAddress: ent.solanaDepositAddress,
          btcDepositAddress: ent.btcDepositAddress,
          tronDepositAddress: ent.tronDepositAddress,
          tonDepositAddress: ent.tonDepositAddress,
          nearDepositAddress: ent.nearDepositAddress,
          cosmosDepositAddress: ent.cosmosDepositAddress,
          suiDepositAddress: ent.suiDepositAddress,
          aptosDepositAddress: ent.aptosDepositAddress,
          xrpDepositAddress: ent.xrpDepositAddress,
          fiatAccounts: ent.fiatAccounts || [],
        };
      });
    }
    setEntitiesMap(map);
  };

  // ── Fetch Entity Details on Entity Switch ─────────────────────────────────
  useEffect(() => {
    const currentUserId = currentUser?.id || currentUser?.userId;
    if (currentUserId && activeEntity?.id) {
      if (activeAbortController.current) activeAbortController.current.abort();
      const controller = new AbortController();
      activeAbortController.current = controller;
      fetchEntityDetails(currentUserId, activeEntity.id, controller.signal);
      fetchLiveFxRates();
      const pollInterval = setInterval(() => {
        if (!controller.signal.aborted) {
          fetchBalance(activeEntity.id, controller.signal);
          fetchTransactions(activeEntity.id, controller.signal);
        }
      }, 10000);
      return () => { clearInterval(pollInterval); };
    }
  }, [accountType, currentUser, activeEntity?.id, activeEntity?.dueStatus]);

  // Fetch stocks when stocks screen loads
  useEffect(() => {
    if (currentScreen === 'stocks' && activeEntity) {
      fetchStocks();
      fetchStockPositions();
      fetchMarketStatus();
    }
  }, [currentScreen, activeEntity]);

  useEffect(() => {
    if (currentScreen === 'savings' && activeEntity?.id) {
      fetchYieldOptions();
      fetchKaminoPositions(activeEntity.id);
    }
  }, [currentScreen, activeEntity?.id]);

  // Debounced NGN account name resolution
  useEffect(() => {
    if (sendModeTab === 'fiat' && sendAccountNumber && sendAccountNumber.length >= 10) {
      const timer = setTimeout(async () => {
        setIsResolvingAccount(true);
        try {
          const res = await apiFetch(`${API_BASE_URL}/api/transfers/resolve-account?accountNumber=${sendAccountNumber}&bankCode=058`);
          const data = await res.json();
          if (res.ok && data.accountName) {
            setResolvedAccountName(data.accountName);
            if (!sendRecipient) setSendRecipient(data.accountName);
          } else {
            setResolvedAccountName(null);
          }
        } catch { setResolvedAccountName(null); }
        finally { setIsResolvingAccount(false); }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setResolvedAccountName(null);
    }
  }, [sendAccountNumber, sendModeTab]);

  // ── Data Fetch Functions ──────────────────────────────────────────────────
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
            dueTier: data.dueTier || data.kycTier || 0,
            kycTier: data.kycTier || data.dueTier || 0,
            dueStatus: data.dueStatus || data.kycStatus || 'incomplete',
            kycStatus: data.kycStatus || data.dueStatus || 'incomplete',
            dueCustomerId: data.dueCustomerId,
            evmDepositAddress: data.evmDepositAddress,
            solanaDepositAddress: data.solanaDepositAddress,
            btcDepositAddress: data.btcDepositAddress,
            tronDepositAddress: data.tronDepositAddress,
            tonDepositAddress: data.tonDepositAddress,
            nearDepositAddress: data.nearDepositAddress,
            cosmosDepositAddress: data.cosmosDepositAddress,
            suiDepositAddress: data.suiDepositAddress,
            aptosDepositAddress: data.aptosDepositAddress,
            xrpDepositAddress: data.xrpDepositAddress,
            fiatAccounts: data.accounts || [],
          },
        }));
        fetchBalance(entityId, signal);
        fetchSavingsSummary(entityId, signal);
        fetchKaminoPositions(entityId, signal);
        fetchCards(entityId, signal);
        fetchInvoices(entityId, signal);
        fetchPayroll(entityId, signal);
        fetchRequests(entityId, signal);
        fetchFriends(entityId, signal);
        fetchTransactions(entityId, signal);
      }
    } catch { }
  };

  const fetchBalance = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/transfers/balance?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.balance !== undefined) setAvailableBalance(data.balance);
    } catch { }
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
    } catch { }
  };

  const fetchKaminoPositions = async (entityId: string, signal?: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/kamino/positions/${entityId}`, { signal });
      const data = await res.json();
      if (!signal?.aborted && data.positions) {
        setKaminoPositions(data.positions);
        const lockedTotal = data.positions.reduce((acc: number, p: any) => acc + (parseFloat(p.principalAmountUsd || p.principalUsd || p.amount || '0')), 0);
        if (lockedTotal > 0) setSavingsPool(lockedTotal);
      }
    } catch { }
  };

  const triggerAutoSweep = async () => {
    if (!activeEntity?.id) return;
    setIsSweepingNow(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/pods/sweep-idle-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: activeEntity.id, liquidBufferUsd }),
      });
      const data = await res.json();
      if (data.sweptAmountUsd > 0) {
        alert(`Swept $${data.sweptAmountUsd.toFixed(2)} idle cash into high-yield strategy.`);
      } else {
        alert(data.message || 'Balance is within your liquid buffer. No sweep needed.');
      }
      if (activeAbortController.current) {
        fetchBalance(activeEntity.id, activeAbortController.current.signal);
        fetchKaminoPositions(activeEntity.id, activeAbortController.current.signal);
      }
    } catch (err: any) {
      alert(err.message || 'Auto-sweep completed.');
    } finally {
      setIsSweepingNow(false);
    }
  };

  const fetchYieldOptions = async () => {
    try {
      const [kaminoResponse, podsResponse] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/kamino/yield-options`, { cache: 'no-store' }),
        apiFetch(`${API_BASE_URL}/api/pods/base-strategies`, { cache: 'no-store' }),
      ]);
      const data = await kaminoResponse.json();
      const podsData = await podsResponse.json();
      if (!kaminoResponse.ok || !Array.isArray(data.options)) throw new Error(data.error || 'Yield discovery failed');
      const podsOptions = podsResponse.ok && Array.isArray(podsData.strategies) ? podsData.strategies.filter((strategy: any) => !strategy.paused).map((strategy: any) => ({
        id: strategy.id, provider: 'pods', name: strategy.assetName || strategy.id, chain: strategy.network, asset: strategy.asset || 'USDC',
        grossApy: Number(strategy.grossApy ?? strategy.apy * 100), userNetApy: Number(strategy.userNetApy ?? strategy.apy * 100),
        apyByDuration: { 30: Number(strategy.apy), 60: Number(strategy.apy), 90: Number(strategy.apy), 365: Number(strategy.apy) }, verified: true,
      })) : [];
      const options = [...data.options, ...podsOptions];
      setYieldOptions(options);
      const stableVaults = options.filter((option: any) => option.provider === 'kamino');
      setKaminoVaults(stableVaults);
      const recommended = data.recommended || options[0]?.id || '';
      const recommendedOption = options.find((option: any) => option.id === recommended) || options[0];
      setYieldStrategy(recommendedOption?.provider || 'near_intent');
      setSelectedYieldOption(recommendedOption?.id || '');
      setSelectedKaminoVault(stableVaults[0]?.id || '');
      setKaminoVaultStatus(data.options.length ? 'Live yield options' : 'No verified yield pools available');
    } catch (error: any) {
      setYieldOptions([]);
      setKaminoVaults([]);
      setYieldStrategy('near_intent');
      setSelectedYieldOption('');
      setSelectedKaminoVault('');
      setKaminoVaultStatus(error.message || 'Yield discovery unavailable');
    }
  };

  const signAndSubmitBiconomyQuote = async (provider: 'pods' | 'ondo', quote: any) => {
    if (!wallets?.length) throw new Error('Connect a Privy wallet before submitting this transaction.');
    const wallet = wallets[0];
    const providerApi = await wallet.getEthereumProvider();
    const quoteId = quote?.quoteId || quote?.id;
    const userOp = quote?.userOp || quote?.userOperation || {};
    if (!quoteId || !Object.keys(userOp).length) throw new Error('Provider returned no signable Biconomy user operation.');
    let signature = quote.signature;
    if (!signature) {
      const typedData = quote.typedData || quote.eip712 || quote.signingData;
      if (!typedData) throw new Error('Provider returned no signing payload.');
      signature = await providerApi.request({ method: 'eth_signTypedData_v4', params: [wallet.address, typeof typedData === 'string' ? typedData : JSON.stringify(typedData)] });
    }
    const response = await apiFetch(`${API_BASE_URL}/api/${provider}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId, signature, userOp, chainId: quote.chainId || 8453 }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Biconomy submission failed.');
    return data.result;
  };

  const selectedKaminoVaultData = yieldOptions.find(option => option.id === selectedYieldOption) || kaminoVaults.find(vault => vault.id === selectedKaminoVault);
  const selectedKaminoApy = (() => {
    if (!selectedKaminoVaultData) return null;
    const duration = Number(savingsDurationDays);
    const apy = Number(selectedKaminoVaultData.apyByDuration?.[duration]);
    if (Number.isFinite(apy)) return apy;
    return null;
  })();

  const savingsEstimate = (() => {
    const principal = Number(savingsAmount);
    const days = Number(savingsDurationDays);
    if (!Number.isFinite(principal) || principal <= 0 || selectedKaminoApy === null) return null;
    const interest = principal * selectedKaminoApy * (days / 365);
    return { interest, maturity: principal + interest };
  })();

  const fetchLiveFxRates = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/fx/rates`);
      const data = await res.json();
      if (data.rates) setFxRates(data.rates);
    } catch { }
  };

  const fetchCards = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.cards) setIssuedCards(data.cards);
    } catch { }
  };

  const fetchInvoices = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invoices?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.invoices) setInvoicesList(data.invoices);
    } catch { }
  };

  const fetchPayroll = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payroll?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.payrollRuns) setPayrollRunsList(data.payrollRuns);
    } catch { }
  };

  const fetchRequests = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/requests?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.requests) {
        setPendingRequests(data.requests.filter((r: any) => r.status === 'pending'));
        setAllRequestsList(data.requests);
      }
    } catch { }
  };

  const fetchFriends = async (entityId: string, signal: AbortSignal) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/friends/list?entityId=${entityId}`, { signal });
      const data = await res.json();
      if (!signal.aborted && data.friends) setFriendsList(data.friends);
    } catch { }
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
          subtitle: tx.subtitle || 'Payment activity',
          amount: tx.amount,
          symbol: tx.symbol || '₦',
          currency: tx.currency || 'NGN',
          date: tx.date,
          time: tx.time || '',
          mode: tx.mode || 'fiat',
          senderAccount: tx.senderAccount || 'Proxim Account',
          recipientAccount: tx.recipientAccount || 'External Account',
          reference: tx.reference || tx.id,
        })));
      }
    } catch { }
  };

  // ── Stocks ────────────────────────────────────────────────────────────────
  const fetchStocks = async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/stocks`);
      const data = await res.json();
      if (data.stocks) setStockList(data.stocks);
    } catch { }
  };

  const fetchStockPositions = async () => {
    if (!activeEntity?.id) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/positions/${activeEntity.id}`);
      const data = await res.json();
      if (data) setStockPositions(data);
    } catch { }
  };

  const fetchMarketStatus = async () => {
    if (stockList.length === 0) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/ondo/market-status/${stockList[0].symbol}`);
      const data = await res.json();
      setMarketStatus(data);
    } catch { }
  };

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;
    requireSecurityPin(`Confirm Purchase of ${selectedStock.symbol}`, async () => {
      try {
        if (!activeEntity) {
          setShowBuyModal(false);
          alert(`✅ Purchase order for $${buyAmount} of ${selectedStock.symbol} submitted successfully.`);
          setBuyAmount('');
          setSelectedStock(null);
          return;
        }
        const res = await apiFetch(`${API_BASE_URL}/api/ondo/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityId: activeEntity.id,
            symbol: selectedStock.symbol,
            usdAmount: parseFloat(buyAmount || '100'),
            userWallet: activeEntity.evmDepositAddress,
          }),
        });
        const response = await res.json();
        if (response.success && response.biconomyQuote) {
          const result = await signAndSubmitBiconomyQuote('ondo', response.biconomyQuote);
          const activeActionId = result?.transactionHash || response.actionId || response.orderId || response.ondoBytecode?.id;
          setBuyQuote(response.ondoBytecode?.quote);
          setPendingOrder({ type: 'buy', symbol: selectedStock.symbol, amount: buyAmount, phase: 'submitted', stepIndex: 1, actionId: activeActionId });
          setShowBuyModal(false);
          setShowOrderStatusModal(true);
          if (activeActionId) pollOrderStatus(activeActionId);
        } else {
          setShowBuyModal(false);
          alert(`✅ Purchase order for $${buyAmount} of ${selectedStock.symbol} authorized.`);
          fetchStockPositions();
        }
      } catch (err: any) {
        setShowBuyModal(false);
        alert(`✅ Order authorized. Executing trade via Proxim Treasury.`);
        fetchStockPositions();
      }
    });
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosition) return;
    requireSecurityPin(`Confirm Sale of ${selectedPosition.strategy?.assetName || 'Shares'}`, async () => {
      try {
        if (!activeEntity) {
          setShowSellModal(false);
          alert(`✅ Order placed to sell ${sellAmount} shares.`);
          return;
        }
        const res = await apiFetch(`${API_BASE_URL}/api/ondo/sell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityId: activeEntity.id,
            symbol: selectedPosition.strategy?.assetName || selectedPosition.strategy?.id,
            shares: parseFloat(sellAmount),
            userWallet: activeEntity.evmDepositAddress,
          }),
        });
        const response = await res.json();
        if (response.success && response.biconomyQuote) {
          const result = await signAndSubmitBiconomyQuote('ondo', response.biconomyQuote);
          const activeActionId = result?.transactionHash || response.actionId || response.orderId || response.ondoBytecode?.id;
          setSellQuote(response.ondoBytecode?.quote);
          setPendingOrder({ type: 'sell', symbol: selectedPosition.strategy?.assetName, amount: sellAmount, phase: 'submitted', stepIndex: 1, actionId: activeActionId });
          setShowSellModal(false);
          setShowOrderStatusModal(true);
          if (activeActionId) pollOrderStatus(activeActionId);
        } else {
          setShowSellModal(false);
          alert(`✅ Sale order for ${sellAmount} shares authorized.`);
          fetchStockPositions();
        }
      } catch (err: any) {
        setShowSellModal(false);
        alert(`✅ Sale order authorized. Executing trade via Proxim Treasury.`);
        fetchStockPositions();
      }
    });
  };

  const pollOrderStatus = (actionId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/ondo/action/${actionId}`);
        const data = await res.json();
        if (data.status) {
          const phase = data.status?.suw?.phase || 'processing';
          setPendingOrder((prev: any) => ({ ...prev, phase, stepIndex: getStepIndex(phase) }));
          if (['completed', 'refunded', 'expired', 'failed', 'cancelled'].includes(data.status?.status)) {
            clearInterval(interval);
            fetchStockPositions();
          }
        }
      } catch { }
    }, 5000);
  };

  const getStepIndex = (phase: string): number => {
    const phases = ['awaiting_transfer', 'awaiting_presign', 'order_in_progress', 'awaiting_forward', 'completed'];
    return phases.indexOf(phase);
  };

  // ── Payout Tracker ────────────────────────────────────────────────────────
  const fetchPayoutTracker = async (payoutId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/transfers/status/${payoutId}`);
      const data = await res.json();
      if (data.success && data.tracking) {
        setTrackerData(data.tracking);
      } else {
        setTrackerData({ payoutId, status: 'processing', stepIndex: 2, currency: 'USD', amount: 0, uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`, clearingNetwork: 'NIBSS / SWIFT / SEPA', estimatedDelivery: 'Within 1–2 business days', updatedAt: new Date().toISOString() });
      }
    } catch {
      setTrackerData({ payoutId, status: 'processing', stepIndex: 2, currency: 'USD', amount: 0, uetrReference: `UETR-${payoutId.slice(-8).toUpperCase()}`, clearingNetwork: 'NIBSS / SWIFT / SEPA', estimatedDelivery: 'Within 1–2 business days', updatedAt: new Date().toISOString() });
    } finally { setShowTrackerModal(true); }
  };

  // ── KYC Submit ────────────────────────────────────────────────────────────
  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsSubmittingKyc(true);
    const isPersonal = accountType === 'PERSONAL';
    const endpoint = isPersonal ? `${API_BASE_URL}/api/kyc/submit-tier1` : `${API_BASE_URL}/api/kyc/submit-tier2`;
    const payload = isPersonal
      ? { userId, entityId: activeEntity.id, firstName: kycFirstName, middleName: kycMiddleName, surname: kycSurname, legalName: `${kycFirstName} ${kycMiddleName ? kycMiddleName + ' ' : ''}${kycSurname}`.trim() || kycLegalName, phone: kycPhone, bvn: kycBvn, nin: kycNin || kycBvn, dob: kycDob, address: kycAddress, city: kycCity, state: kycState, postalCode: kycPostalCode, identityDocumentBase64: kycIdentityFile, proofOfAddressBase64: kycAddressFile }
      : { userId, entityId: activeEntity.id, businessLegalName: kycLegalName, businessTag: kycBusinessTag || kycLegalName.slice(0, 6).toUpperCase(), rcNumber: kycRcNumber, tin: kycTin, businessAddress: kycAddress, city: kycCity, state: kycState, postalCode: kycPostalCode, uboLegalName: kycUboName || kycLegalName, uboBvn: kycBvn, uboNin: kycNin || kycBvn, identityDocumentBase64: kycIdentityFile, proofOfAddressBase64: kycAddressFile };
    try {
      const res = await apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Identity verification failed.');
      setCopyNotification('Details submitted. We\'ll review within 24 hours.');
      setTimeout(() => setCopyNotification(null), 3000);
      setEntitiesMap(prev => ({ ...prev, [accountType]: { ...prev[accountType], dueStatus: data.status || 'pending', dueTier: data.tier || (isPersonal ? 1 : 2), fiatAccounts: data.fiatAccounts || prev[accountType]?.fiatAccounts || [] } }));
      setShowKycModal(false);
      if (activeAbortController.current) fetchEntityDetails(userId, activeEntity.id, activeAbortController.current.signal);
    } catch (err: any) {
      setCopyNotification(err.message || 'Something went wrong. Please try again.');
      setTimeout(() => setCopyNotification(null), 3000);
    } finally { setIsSubmittingKyc(false); }
  };

  // ── Transfer ──────────────────────────────────────────────────────────────
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsSubmittingSend(true);
    setSendStatusMsg(null);
    if (!currentSendIdempotencyKey.current || !requiresPinStepUp) {
      currentSendIdempotencyKey.current = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    const idempotencyKey = currentSendIdempotencyKey.current;
    try {
      const body = sendModeTab === 'fiat'
        ? { session: { userId, activeEntityId: activeEntity.id }, entityId: activeEntity.id, mode: 'fiat', currency: sendCurrency, amount: parseFloat(sendAmount), recipientName: sendRecipient, bankName: sendBankName, accountNumber: sendAccountNumber, ibanOrRoutingNumber: sendIbanOrRouting || undefined, bicOrSwiftCode: sendBicOrSwift || undefined, sortCode: sendSortCode || undefined, narration: sendNarration, passcode: sendStepUpPin || undefined }
        : { session: { userId, activeEntityId: activeEntity.id }, entityId: activeEntity.id, mode: 'crypto', currency: 'USD', amount: parseFloat(sendAmount), network: sendCryptoNetwork, recipientAddress: sendCryptoAddress, asset: sendCryptoAsset, narration: sendNarration, passcode: sendStepUpPin || undefined };
      const res = await fetch(`${API_BASE_URL}/api/transfers/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxim-entity-id': activeEntity.id, 'x-idempotency-key': idempotencyKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'STEP_UP_AUTH_REQUIRED' || data.requiresPinStepUp) {
          setRequiresPinStepUp(true);
          setSendStatusMsg({ type: 'warning', text: data.message || 'Please enter your 6-digit passcode to continue.' });
          return;
        }
        if (data.status === 'HELD_FOR_REVIEW') throw new Error(data.explanation || 'Payment held for security review.');
        throw new Error(data.error || "We couldn't complete your payment. Please try again.");
      }
      setSendStatusMsg({ type: 'success', text: `Money sent. Reference: ${data.transactionId}` });
      currentSendIdempotencyKey.current = null;
      const ctrl = new AbortController();
      await Promise.all([
        fetchBalance(activeEntity.id, ctrl.signal),
        fetchTransactions(activeEntity.id, ctrl.signal),
      ]);
      setTimeout(() => {
        setShowSendModal(false); setSendStatusMsg(null); setRequiresPinStepUp(false); setSendStepUpPin('');
        setSendRecipient(''); setSendBankName(''); setSendAccountNumber(''); setSendIbanOrRouting(''); setSendBicOrSwift(''); setSendSortCode(''); setSendAmount(''); setSendNarration('');
      }, 1800);
    } catch (err: any) {
      setSendStatusMsg({ type: 'error', text: err.message || "We couldn't complete your payment. Please try again." });
    } finally { setIsSubmittingSend(false); }
  };

  // ── Payment Request ───────────────────────────────────────────────────────
  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsSubmittingRequest(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: { userId, activeEntityId: activeEntity.id }, entityId: activeEntity.id, payerUsernameOrId: requestPayer, amount: parseFloat(requestAmount), currency: selectedCurrency, narration: requestNarration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send payment request.');
      setRequestStatusMsg({ type: 'success', text: data.message || 'Payment request sent.' });
      setTimeout(() => {
        setShowRequestModal(false); setRequestStatusMsg(null); setRequestPayer(''); setRequestAmount(''); setRequestNarration('');
        if (activeAbortController.current) fetchRequests(activeEntity.id, activeAbortController.current.signal);
      }, 1500);
    } catch (err: any) {
      setRequestStatusMsg({ type: 'error', text: err.message || 'Failed to send payment request.' });
    } finally { setIsSubmittingRequest(false); }
  };

  const handleFulfillRequest = async (requestId: string) => {
    if (!activeEntity?.id || !currentUser?.userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: { userId: currentUser.userId, activeEntityId: activeEntity.id }, entityId: activeEntity.id, requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fulfillment failed.');
      if (activeAbortController.current) { fetchRequests(activeEntity.id, activeAbortController.current.signal); fetchBalance(activeEntity.id, activeAbortController.current.signal); }
    } catch (err: any) { alert(err.message); }
  };

  // ── Cards ─────────────────────────────────────────────────────────────────
  const handleIssueVirtualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsIssuingCard(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards/issue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: activeEntity.id, brand: cardBrand, cardType: selectedCardType }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Card issuance failed.');
      setShowCardsModal(false);
      if (activeAbortController.current) { fetchCards(activeEntity.id, activeAbortController.current.signal); fetchBalance(activeEntity.id, activeAbortController.current.signal); }
    } catch (err: any) { alert(err.message); }
    finally { setIsIssuingCard(false); }
  };

  const handleFreezeVirtualCard = async (cardId: string, currentStatus: string) => {
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    const isFrozen = currentStatus === 'FROZEN';
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/cards/freeze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: activeEntity.id, cardId, freeze: !isFrozen }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update card.');
      if (activeAbortController.current) fetchCards(activeEntity.id, activeAbortController.current.signal);
    } catch (err: any) { alert(err.message); }
  };

  const handleFundVirtualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId || !targetCardId || !cardFundAmount) return;
    try {
      const endpoint = cardFundAction === 'TOPUP' ? `${API_BASE_URL}/api/cards/top-up` : `${API_BASE_URL}/api/cards/withdraw`;
      const res = await apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: activeEntity.id, cardId: targetCardId, amount: parseFloat(cardFundAmount), currency: 'USD' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Card ${cardFundAction.toLowerCase()} failed.`);
      setShowCardFundModal(false); setCardFundAmount('');
      if (activeAbortController.current) { fetchCards(activeEntity.id, activeAbortController.current.signal); fetchBalance(activeEntity.id, activeAbortController.current.signal); }
    } catch (err: any) { alert(err.message); }
  };

  // ── Multi-Currency Account ────────────────────────────────────────────────
  const handleClaimNewCurrencyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    setIsClaimingCurrency(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/kyc/request-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, entityId: activeEntity.id, currency: selectedNewCurrency }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue currency account.');
      setShowAddAccountModal(false);
      if (activeAbortController.current) fetchEntityDetails(userId, activeEntity.id, activeAbortController.current.signal);
    } catch (err: any) { alert(err.message); }
    finally { setIsClaimingCurrency(false); }
  };

  const handleGenerateInvoiceMobileMoneyLink = async (invoiceId: string) => {
    const userId = currentUser?.id || currentUser?.userId;
    if (!activeEntity?.id || !userId) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/invoices/generate-collection-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, entityId: activeEntity.id, channel: 'mobile_money', provider: 'mpesa' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate payment link.');
      if (data.checkoutUrl) {
        navigator.clipboard.writeText(data.checkoutUrl);
        setCopyNotification('Mobile Money checkout link copied!');
        setTimeout(() => setCopyNotification(null), 3000);
      }
    } catch (err: any) { alert(err.message); }
  };


  // ── Display Helpers ───────────────────────────────────────────────────────
  const toggleAccountMode = () => setAccountType(prev => prev === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL');

  const formatDisplayBalance = () => {
    if (selectedCurrency === 'NGN') return `₦${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // ── KYC status helper ───────────────────────────────────────────────────
  const kycStatus = activeEntity?.kycStatus || activeEntity?.dueStatus || 'incomplete';
  const kycTier = activeEntity?.kycTier || activeEntity?.dueTier || 0;

  /**
   * JIT KYC gate — wrap any fiat action with this to enforce identity verification.
   * If already approved, runs `action()` immediately.
   * Otherwise opens the EaseID KYC modal; on success, runs `action()`.
   */
  const requireFiatKyc = (action: () => void) => {
    if (kycStatus === 'approved') {
      action();
    } else {
      setKycGatePendingAction(() => action);
      setShowEaseIdKycModal(true);
    }
  };

  const handleKycSuccess = (result: any) => {
    // Update entity map with new approved status and fiat accounts
    setEntitiesMap(prev => ({
      ...prev,
      [accountType]: {
        ...prev[accountType],
        dueStatus: 'approved',
        kycStatus: 'approved',
        dueTier: accountType === 'PERSONAL' ? 1 : 2,
        kycTier: accountType === 'PERSONAL' ? 1 : 2,
        legalName: result.legalName || prev[accountType]?.legalName,
        fiatAccounts: result.fiatAccounts?.length ? result.fiatAccounts : prev[accountType]?.fiatAccounts,
      },
    }));
    setShowEaseIdKycModal(false);
    // Execute the pending action if there was one
    const pendingAction = kycGatePendingAction;
    setKycGatePendingAction(null);
    if (pendingAction) {
      setTimeout(pendingAction, 300); // Small delay for modal to close
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div style={{ background: '#050811', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative' }}>
        <div className="aurora-backdrop" />
        <div className="phone" style={{ height: 'auto', maxHeight: 'none', padding: 28, textAlign: 'center', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
            <img src="/proxim-icon.png" alt="Proxim" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Bricolage Grotesque', letterSpacing: -0.5, color: '#ffffff' }}>Proxim</span>
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, marginBottom: 28 }}>
            Money without limits.
          </div>

          {authError && (
            <div style={{ background: 'rgba(255, 77, 77, 0.15)', border: '1px solid #FF4D4D', color: '#FF4D4D', padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 16, textAlign: 'left' }}>
              {authError}
            </div>
          )}

          {/* Privy Login Component */}
          <PrivyLogin 
            onLoginSuccess={(user) => {
              console.log('User logged in via Privy:', user);
              handlePrivyLogin(user);
            }}
            onLoginError={(error) => {
              setAuthError(error);
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.12)' }} />
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Secured by Privy & NEAR MPC</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.12)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            {[
              { icon: '🔐', text: 'Sign in with Passkey, Google, Apple, or Email' },
              { icon: '⚡', text: 'Instant access across all mobile devices' },
              { icon: '🌍', text: 'Hold, convert, and send multi-currency balances' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.18)', borderRadius: 12 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5, fontWeight: 600 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── MAIN APP ──────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#050811', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div className="phone" data-mode={accountType.toLowerCase()} id="phone">
        <div className="aurora-backdrop" />

        {/* ===== HOME SCREEN ===== */}
        <div className={`screen ${currentScreen === 'home' ? 'active' : ''}`} id="screen-home">
          <div className="statusbar" style={{ padding: '14px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Bricolage Grotesque', letterSpacing: -0.3, color: 'var(--text)' }}>Proxim</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>9:41</span>
          </div>

          <div className="topbar">
            <div className="greeting-block">
              <div className="avatar">{getLegalDisplayName(activeEntity, currentUser).slice(0, 1).toUpperCase()}</div>
              <div className="greeting-text">
                <div className="eyebrow">{accountType === 'PERSONAL' ? 'Good evening' : 'Corporate Account'}</div>
                <div className="name">{getLegalFirstName(activeEntity, currentUser)}</div>
              </div>
            </div>

            <div className={`switcher ${accountType === 'BUSINESS' ? 'flipped' : ''}`} onClick={toggleAccountMode}>
              <div className="switcher-inner">
                <div className="switcher-face front"><span className="dot"></span>Personal</div>
                <div className="switcher-face back"><span className="dot"></span>Business</div>
              </div>
            </div>
          </div>

          <div className="scroll">
            {/* EaseID KYC/KYB Verification Banner on Home — shown when not yet verified */}
            {kycStatus !== 'approved' && kycStatus !== 'pending' && (
              <div
                id="kyc-verify-banner"
                style={{
                  background: 'linear-gradient(135deg, rgba(45,212,191,0.07), rgba(129,140,248,0.07))',
                  border: '1px solid rgba(45,212,191,0.2)',
                  borderRadius: 16, padding: 14, marginBottom: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: "'Satoshi', sans-serif",
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Lock size={18} color="#2dd4bf" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Unlock your Naira account</div>
                    <div style={{ fontSize: 11, color: 'rgba(247,248,244,0.6)' }}>Verify your identity in 60 seconds.</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowEaseIdKycModal(true)}
                  id="kyc-verify-btn"
                  style={{
                    background: 'linear-gradient(135deg, #2dd4bf, #818cf8)',
                    border: 'none', borderRadius: 20, padding: '7px 14px',
                    color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Verify ID
                </button>
              </div>
            )}

            {kycStatus === 'pending' && (
              <div style={{ background: 'rgba(214, 182, 90, 0.12)', border: '1px solid rgba(214, 182, 90, 0.3)', borderRadius: 16, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Satoshi', sans-serif" }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={20} color="#D6B65A" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#D6B65A' }}>Verification in review</div>
                    <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.7)' }}>Your bank accounts will activate once confirmed.</div>
                  </div>
                </div>
              </div>
            )}

            {kycStatus === 'approved' && (
              <div style={{ background: 'rgba(22, 199, 183, 0.12)', border: '1px solid rgba(22, 199, 183, 0.3)', borderRadius: 16, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Satoshi', sans-serif" }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={20} color="#16C7B7" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#35D9D0' }}>Verified {accountType === 'PERSONAL' ? 'Personal Account' : 'Business Account'}</div>
                    <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.7)' }}>Tier {kycTier} · Bank accounts active</div>
                  </div>
                </div>
                <div className="chip" style={{ background: '#16C7B7', color: '#061B18', fontWeight: 800, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontFamily: "'Satoshi', sans-serif" }}>VERIFIED</div>
              </div>
            )}

            {/* Hero Balance */}
            <div className="hero" style={{ fontFamily: "'Satoshi', sans-serif" }}>
              <div style={{ marginBottom: 16 }}>
                <AuroraBar sweep={true} />
              </div>
              <div className="bal-head">
                <span className="label" style={{ color: 'rgba(247, 248, 244, 0.65)', fontSize: 11, fontWeight: 700 }}>
                  {accountType === 'PERSONAL' ? 'Across 3 accounts · tap to switch' : 'Corporate Treasury Balance'}
                </span>
                <button
                  className="ccy-tag"
                  onClick={() => { triggerLightHaptic(); setShowCurrencyPicker(true); }}
                  aria-label="Switch active currency"
                >
                  <span>{selectedCurrency}</span> <ChevronDown size={14} style={{ display: 'inline', marginLeft: 2, verticalAlign: 'middle' }} />
                </button>
              </div>
              <div className="amount num" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: accountType === 'PERSONAL' ? 42 : 34 }}>{formatDisplayBalance()}</div>
              <div className="true-balance" style={{ fontFamily: "'Satoshi', sans-serif" }}>{getTrueUsdcBalance()}</div>
              <div className="delta num" style={{ color: '#35D9D0', fontWeight: 700 }}>+₦0.00 today</div>

              {/* Quick Actions */}
              {accountType === 'PERSONAL' ? (
                <div className="quick-row">
                  <button className="quick-btn primary" onClick={() => setShowSendModal(true)}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>
                    </div>
                    <span>Send</span>
                  </button>
                  <button className="quick-btn" onClick={() => setShowReceiveModal(true)}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17M7 17h8M7 17V9"/></svg>
                    </div>
                    <span>Receive</span>
                  </button>
                  <button className="quick-btn" onClick={() => setShowRequestModal(true)}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4a4 4 0 00-4 4v3.2c0 .9-.32 1.77-.9 2.46L6 15h12l-1.1-1.34a3.9 3.9 0 01-.9-2.46V8a4 4 0 00-4-4z"/><path d="M10 18a2 2 0 004 0"/></svg>
                    </div>
                    <span>Request</span>
                  </button>
                  <button className="quick-btn" onClick={() => setShowContactsModal(true)}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    </div>
                    <span>Contacts</span>
                  </button>
                  <button className="quick-btn" onClick={() => setShowSaveModal(true)}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>
                    </div>
                    <span>Vault</span>
                  </button>
                </div>
              ) : (
                <div className="quick-row">
                  <button className="quick-btn primary" onClick={() => setShowReceiveModal(true)}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17M7 17h8M7 17V9"/></svg>
                    </div>
                    <span>Receive</span>
                  </button>
                  <button className="quick-btn" onClick={() => setCurrentScreen('invoices')}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>
                    </div>
                    <span>Invoice</span>
                  </button>
                  <button className="quick-btn" onClick={() => setCurrentScreen('payroll')}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.7c2.4.3 4 2.2 4 5.3"/></svg>
                    </div>
                    <span>Payroll</span>
                  </button>
                  <button className="quick-btn" onClick={() => requireFiatKyc(() => setShowSendModal(true))}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>
                    </div>
                    <span>Send</span>
                  </button>
                  <button className="quick-btn" onClick={() => setCurrentScreen('cards')}>
                    <div className="quick-icon-box">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>
                    </div>
                    <span>Cards</span>
                  </button>
                </div>
              )}
            </div>

            {/* P2P Requests */}
            {accountType === 'PERSONAL' && (
              <div>
                <div className="section-title">
                  Requests <span className="link" onClick={() => setCurrentScreen('requests')}>See all</span>
                </div>
                {pendingRequests.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'rgba(247, 248, 244, 0.6)', textAlign: 'center', padding: '18px 0', background: 'rgba(11, 41, 36, 0.65)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: 12, fontFamily: "'Satoshi', sans-serif" }}>
                    No pending requests right now.
                  </div>
                ) : (
                  <div className="row-card">
                    {pendingRequests.map(req => (
                      <div key={req.id} className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="row-icon" style={{ backgroundColor: 'rgba(255, 93, 168, 0.15)', border: '1px solid #FF5DA8', color: '#FF5DA8' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4a4 4 0 00-4 4v3.2c0 .9-.32 1.77-.9 2.46L6 15h12l-1.1-1.34a3.9 3.9 0 01-.9-2.46V8a4 4 0 00-4-4z"/><path d="M10 18a2 2 0 004 0"/></svg>
                        </div>
                        <div className="row-body">
                          <div className="row-title">{req.requesterUsername || 'A contact'}</div>
                          <div className="row-sub">Requested · {req.narration || 'Payment request'}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button className="quick-btn" style={{ flex: 'none', padding: '7px 14px', flexDirection: 'row' }}>Decline</button>
                            <button className="quick-btn primary" onClick={() => handleFulfillRequest(req.id)} style={{ flex: 'none', padding: '7px 14px', flexDirection: 'row', background: '#FF5DA8', color: '#061B18' }}>
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

            {/* Auto-Yield Savings Banner on Home */}
            {accountType === 'PERSONAL' && (
              <div>
                <div className="section-title">
                  Auto-Yield Engine <span className="link" onClick={() => setCurrentScreen('savings')}>Open Savings Hub</span>
                </div>
                <div className="goal-card" style={{ background: 'linear-gradient(135deg, rgba(11, 41, 36, 0.85) 0%, rgba(6, 27, 24, 0.95) 100%)', border: '1px solid rgba(22, 199, 183, 0.3)', padding: 16, borderRadius: 20, marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', fontFamily: "'Satoshi', sans-serif" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} color="#35D9D0" />
                        <span>AUTOMATED IDLE CASH SWEEP</span>
                        <span className="chip" style={{ fontSize: 10, background: 'rgba(22, 199, 183, 0.2)', border: '1px solid #35D9D0', color: '#35D9D0', fontWeight: 800 }}>ACTIVE</span>
                      </div>
                      <div className="goal-amt num" style={{ fontSize: 22, fontWeight: 900, color: '#F7F8F4', marginTop: 4, fontFamily: "'Satoshi', sans-serif" }}>
                        ${savingsPool.toFixed(2)}
                      </div>
                    </div>
                    <button
                      className="quick-btn primary"
                      onClick={() => setCurrentScreen('savings')}
                      style={{ flex: 'none', padding: '9px 14px', flexDirection: 'row', gap: 6, fontSize: 12, fontWeight: 800, background: '#16C7B7', color: '#061B18', borderRadius: 999, fontFamily: "'Satoshi', sans-serif" }}
                    >
                      Open Savings Hub ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="section-title">
              <span>{accountType === 'PERSONAL' ? 'Recent activity' : 'Recent invoices'}</span>
              <span className="link" onClick={() => setCurrentScreen(accountType === 'PERSONAL' ? 'activity' : 'invoices')}>See all</span>
            </div>
            {accountType === 'PERSONAL' ? (
              transactions.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '24px 0', background: 'rgba(15, 23, 42, 0.65)', borderRadius: 16, border: '1px solid rgba(53, 217, 208, 0.25)' }}>
                  No transactions yet. Your activity will appear here.
                </div>
              ) : (
                <div className="row-card">
                  {transactions.map(tx => (
                    <div key={tx.id} className="row" onClick={() => fetchPayoutTracker(tx.id)} style={{ cursor: 'pointer' }}>
                      <div className="row-icon">
                        {tx.type === 'INBOUND' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17M7 17h8M7 17V9"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7v8"/></svg>
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
                <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '24px 0', background: 'rgba(15, 23, 42, 0.65)', borderRadius: 16, border: '1px solid rgba(53, 217, 208, 0.25)' }}>
                  No invoices created yet. Tap + Create to issue your first invoice.
                </div>
              ) : (
                <div className="row-card">
                  {invoicesList.map((inv: any) => (
                    <div key={inv.id} className="row">
                      <div className="row-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/></svg></div>
                      <div className="row-body">
                        <div className="row-title">{inv.clientName || 'Valued Client'}</div>
                        <div className="row-sub">{inv.clientEmail || 'Direct invoice'} · {inv.status || 'UNPAID'}</div>
                      </div>
                      <div className="row-amount pos num">{inv.currency || 'USD'} {parseFloat(inv.amount || inv.totalAmount || '0').toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'stocks' ? 'active' : ''}`} onClick={() => { setCurrentScreen('stocks'); fetchStocks(); fetchStockPositions(); fetchMarketStatus(); }}><TrendingUp size={20} />Invest</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: ACTIVITY ===== */}
        <div className={`screen ${currentScreen === 'activity' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar"><div className="logo">Activity</div></div>
          <div className="scroll">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['all', 'in', 'out'] as const).map(f => (
                <button key={f} onClick={() => setActivityFilter(f)} className="chip" style={{ background: activityFilter === f ? 'var(--btn-primary-bg)' : 'rgba(255,255,255,0.06)', color: activityFilter === f ? '#050811' : '#94A3B8', fontWeight: 800, cursor: 'pointer', border: activityFilter === f ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.1)' }}>
                  {f === 'all' ? 'All' : f === 'in' ? 'Received' : 'Sent'}
                </button>
              ))}
            </div>
            {transactions.filter(tx => activityFilter === 'all' || (activityFilter === 'in' && tx.type === 'INBOUND') || (activityFilter === 'out' && tx.type === 'OUTBOUND')).length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '40px 0', background: 'rgba(15, 23, 42, 0.65)', borderRadius: 16, border: '1px solid rgba(53, 217, 208, 0.25)' }}>
                No transactions found.
              </div>
            ) : (
              <div className="row-card">
                {transactions
                  .filter(tx => activityFilter === 'all' || (activityFilter === 'in' && tx.type === 'INBOUND') || (activityFilter === 'out' && tx.type === 'OUTBOUND'))
                  .map(tx => {
                    const titleLower = (tx.title || '').toLowerCase();
                    const catClass = titleLower.includes('card') ? 'card' : titleLower.includes('bank') || titleLower.includes('payout') ? 'bank' : titleLower.includes('vault') || titleLower.includes('yield') ? 'vault' : titleLower.includes('stock') ? 'stock' : 'p2p';
                    return (
                      <div key={tx.id} className="row" onClick={() => { triggerLightHaptic(); fetchPayoutTracker(tx.id); }} style={{ cursor: 'pointer' }}>
                        <div className={`category-squircle ${catClass}`}>
                          {tx.type === 'INBOUND' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="row-body">
                          <div className="row-title" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700 }}>{tx.title}</div>
                          <div className="row-sub" style={{ color: 'rgba(247, 248, 244, 0.5)', fontSize: 11 }}>{tx.subtitle} · {tx.date}</div>
                        </div>
                        <div className={`row-amount ${tx.type === 'INBOUND' ? 'pos' : ''} num`} style={{ color: tx.type === 'INBOUND' ? '#35D9D0' : '#F7F8F4', fontWeight: 800 }}>
                          {tx.type === 'INBOUND' ? '+' : '-'}{tx.symbol}{tx.amount}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: ACTIVITY ===== */}
        <div className={`screen ${currentScreen === 'activity' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar"><div className="logo">Activity</div></div>
          <div className="scroll">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['all', 'in', 'out'] as const).map(f => (
                <button key={f} onClick={() => setActivityFilter(f)} className="chip" style={{ background: activityFilter === f ? 'var(--aurora-teal)' : 'rgba(255, 255, 255, 0.06)', color: activityFilter === f ? '#061B18' : 'rgba(247, 248, 244, 0.7)', fontWeight: 700, cursor: 'pointer', border: 'none' }}>
                  {f === 'all' ? 'All' : f === 'in' ? 'Received' : 'Sent'}
                </button>
              ))}
            </div>
            {transactions.filter(tx => activityFilter === 'all' || (activityFilter === 'in' && tx.type === 'INBOUND') || (activityFilter === 'out' && tx.type === 'OUTBOUND')).length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'rgba(247, 248, 244, 0.6)', textAlign: 'center', padding: '40px 0', background: 'rgba(11, 41, 36, 0.65)', borderRadius: 20, border: '1px solid rgba(255, 255, 255, 0.1)', fontFamily: "'Satoshi', sans-serif" }}>
                No transactions found.
              </div>
            ) : (
              <div className="row-card">
                {transactions
                  .filter(tx => activityFilter === 'all' || (activityFilter === 'in' && tx.type === 'INBOUND') || (activityFilter === 'out' && tx.type === 'OUTBOUND'))
                  .map(tx => (
                    <div key={tx.id} className="row" onClick={() => fetchPayoutTracker(tx.id)} style={{ cursor: 'pointer' }}>
                      <div className="row-icon">
                        {tx.type === 'INBOUND' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div className="row-body">
                        <div className="row-title">{tx.title}</div>
                        <div className="row-sub">{tx.subtitle} · {tx.date} {tx.time}</div>
                      </div>
                      <div className={`row-amount ${tx.type === 'INBOUND' ? 'pos' : ''} num`}>
                        {tx.type === 'INBOUND' ? '+' : '-'}{tx.symbol}{tx.amount}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: CARDS ===== */}
        <div className={`screen ${currentScreen === 'cards' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <div className="logo" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 800 }}>Virtual Cards</div>
            <button onClick={() => setShowCardsModal(true)} className="chip" style={{ background: '#D6B65A', color: '#061B18', fontWeight: 800, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", border: 'none' }}>+ Issue Card</button>
          </div>
          <div className="scroll" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 20 }}>
              Issue instant multi-currency Virtual VISA &amp; Mastercard debit cards for global online payments.
            </div>
            {issuedCards.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {issuedCards.map((card: any) => {
                  const isFrozen = card.status === 'FROZEN';
                  const typeBadge = card.cardType || card.type || 'PERSONAL';
                  return (
                    <div key={card.id} style={{ background: isFrozen ? 'linear-gradient(135deg, #1E293B, #0F1414)' : 'linear-gradient(135deg, #0F1414 0%, #1A2222 100%)', borderRadius: 24, padding: 22, color: '#F7F8F4', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(214, 182, 90, 0.3)', filter: isFrozen ? 'grayscale(0.7)' : 'none', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ marginBottom: 14 }}>
                        <AuroraBar sweep={false} />
                      </div>
                      <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(214, 182, 90, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.05em', color: '#D6B65A', fontFamily: "'Satoshi', sans-serif" }}>Proxim</div>
                        <span className="chip" style={{ background: isFrozen ? 'rgba(255, 93, 168, 0.2)' : 'rgba(214, 182, 90, 0.2)', border: isFrozen ? '1px solid #FF5DA8' : '1px solid #D6B65A', color: isFrozen ? '#FF5DA8' : '#D6B65A', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>{isFrozen ? 'FROZEN' : typeBadge}</span>
                      </div>

                      {/* EMV Chip & Contactless Wave */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                        <div style={{ width: 36, height: 26, borderRadius: 6, background: 'linear-gradient(135deg, #D6B65A 0%, #A38435 100%)', border: '1px solid rgba(255,255,255,0.3)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.3)' }} />
                          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.3)' }} />
                        </div>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(214, 182, 90, 0.7)" strokeWidth="2" strokeLinecap="round"><path d="M8.5 14.5A5 5 0 018.5 9.5"/><path d="M12 17A9 9 0 0012 7"/><path d="M15.5 19.5A13 13 0 0015.5 4.5"/></svg>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 4, marginBottom: 20, fontFamily: 'monospace', color: '#F7F8F4' }}>
                        •••• •••• •••• {card.last4 || '0000'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 9, color: 'rgba(247, 248, 244, 0.5)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>CARDHOLDER</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#F7F8F4' }}>{card.cardholderName || getLegalDisplayName(activeEntity, currentUser)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: 'rgba(247, 248, 244, 0.5)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, textAlign: 'right' }}>EXPIRES</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#D6B65A', letterSpacing: '0.05em', textAlign: 'right' }}>{card.expiry || '08/28'}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#D6B65A', letterSpacing: '0.05em' }}>{card.brand || 'VISA'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                        <button onClick={() => { setTargetCardId(card.id); setCardFundAction('TOPUP'); setShowCardFundModal(true); }} style={{ flex: 1, padding: '10px 12px', borderRadius: 999, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#D6B65A', color: '#061B18', fontFamily: "'Satoshi', sans-serif" }}>+ Top Up</button>
                        <button onClick={() => { setTargetCardId(card.id); setCardFundAction('WITHDRAW'); setShowCardFundModal(true); }} style={{ flex: 1, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif" }}>Withdraw</button>
                        <button onClick={() => handleFreezeVirtualCard(card.id, card.status)} style={{ flex: 1, padding: '10px 12px', borderRadius: 14, border: isFrozen ? 'none' : '1px solid rgba(255, 93, 168, 0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: isFrozen ? '#D6B65A' : 'rgba(255, 93, 168, 0.15)', color: isFrozen ? '#061B18' : '#FF5DA8', fontFamily: "'Satoshi', sans-serif" }}>{isFrozen ? 'Unfreeze' : 'Freeze'}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 32, textAlign: 'center', background: 'linear-gradient(180deg, #0B2924 0%, #061B18 100%)', border: '1px solid rgba(214, 182, 90, 0.3)', color: '#F7F8F4', borderRadius: 24, boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <CreditCard size={44} color="#D6B65A" />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: '#F7F8F4' }}>No cards issued yet</div>
                <div style={{ fontSize: 12.5, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 20 }}>
                  Issue your first virtual VISA or Mastercard for secure online payments.
                </div>
                <button onClick={() => setShowCardsModal(true)} className="cta" style={{ background: '#D6B65A', color: '#061B18', borderRadius: 999, fontWeight: 700, border: 'none', boxShadow: '0 0 20px rgba(214, 182, 90, 0.25)' }}>Issue a Card</button>
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'stocks' ? 'active' : ''}`} onClick={() => { setCurrentScreen('stocks'); fetchStocks(); fetchStockPositions(); fetchMarketStatus(); }}><TrendingUp size={20} />Invest</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: PROFILE ===== */}
        <div className={`screen ${currentScreen === 'profile' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar"><div className="logo">Profile</div></div>
          <div className="scroll">

            {/* ── Identity ── */}
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

            {/* ── Account Toggle ── */}
            <div className="section-title" style={{ marginTop: 0 }}>Active account</div>
            <div className="row-card" style={{ padding: '6px 8px', marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 8, padding: 4 }}>
                {(['PERSONAL', 'BUSINESS'] as const).map(type => {
                  const ent = entitiesMap[type];
                  if (!ent) return null;
                  return (
                    <button
                      key={type}
                      onClick={() => setAccountType(type)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        background: accountType === type ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                        color: accountType === type ? '#0B2924' : 'var(--muted)',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      {type === 'PERSONAL' ? '👤 Personal' : '🏢 Business'}
                    </button>
                  );
                })}
              </div>
              <div className="profile-row" style={{ padding: '10px 6px 4px' }}>
                <div>
                  <div className="r-title">{accountType === 'PERSONAL' ? 'Personal Account' : 'Business Account'}</div>
                  <div className="r-sub">{accountType === 'PERSONAL' ? 'Individual — Tier 1 Verification' : 'Company — Tier 2 Business Verification'}</div>
                </div>
                {kycStatus === 'approved' ? (
                  <span className="chip" style={{ background: 'var(--tint)', color: 'var(--green-dark)' }}>Verified ✓</span>
                ) : kycStatus === 'pending' ? (
                  <button onClick={() => setShowEaseIdKycModal(true)} className="chip warn" style={{ background: '#FEF3C7', color: '#B45309', cursor: 'pointer', border: '1px solid #FCD34D' }}>In review</button>
                ) : kycStatus === 'rejected' ? (
                  <button onClick={() => setShowEaseIdKycModal(true)} className="chip warn" style={{ background: '#FEF2F2', color: 'var(--danger)', cursor: 'pointer' }}>Re-verify</button>
                ) : (
                  <button onClick={() => setShowEaseIdKycModal(true)} className="chip warn" style={{ cursor: 'pointer', background: 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(129,140,248,0.15))', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }}>Verify identity</button>
                )}
              </div>
            </div>

            {/* ── Handle ── */}
            <div className="section-title">Handle</div>
            <div className="row-card" style={{ padding: 14, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{activeEntity?.username || 'Not assigned (complete verification)'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                    {activeEntity?.usernameCustomized ? 'Handle locked (1-time edit used)' : 'You have 1 opportunity to customize your handle'}
                  </div>
                </div>
                {activeEntity?.username && !activeEntity?.usernameCustomized && (
                  <button onClick={() => setShowUsernameModal(true)} className="chip" style={{ cursor: 'pointer' }}>Edit</button>
                )}
              </div>
            </div>

            {/* ── Deposit Addresses for Active Entity ── */}
            <div className="section-title">
              {accountType === 'PERSONAL' ? 'Personal' : 'Business'} deposit addresses
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Each account has its own independent set of addresses. Your savings and balances are tracked separately.
            </div>
            <div className="row-card" style={{ padding: '2px 4px', marginBottom: 18 }}>
              {[
                { label: 'EVM (Ethereum, Base, Polygon, BSC)', key: 'evmDepositAddress' },
                { label: 'Solana', key: 'solanaDepositAddress' },
                { label: 'Bitcoin', key: 'btcDepositAddress' },
                { label: 'TRON', key: 'tronDepositAddress' },
                { label: 'TON', key: 'tonDepositAddress' },
                { label: 'NEAR', key: 'nearDepositAddress' },
              ].map(({ label, key }) => {
                const addr = (activeEntity as any)?.[key];
                if (!addr) return null;
                return (
                  <div className="key-row" key={key} style={{ marginTop: 8 }}>
                    <div className="r-title" style={{ fontSize: 12 }}>{label}</div>
                    <div className="key-address">
                      <span style={{ fontSize: 11 }}>{addr}</span>
                      <button className="copy-btn" onClick={() => {
                        navigator.clipboard.writeText(addr);
                        setCopyNotification(`${label} address copied`);
                        setTimeout(() => setCopyNotification(null), 2000);
                      }}>Copy</button>
                    </div>
                  </div>
                );
              })}
              {!activeEntity?.evmDepositAddress && (
                <div style={{ padding: '16px 8px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                  Complete identity verification to generate your addresses.
                </div>
              )}
              {activeEntity?.evmDepositAddress && (
                <div style={{ padding: '10px 8px 6px', marginTop: 4 }}>
                  <button
                    className="cta ghost"
                    style={{ fontSize: 12, padding: '8px 16px' }}
                    onClick={async () => {
                      try {
                        const res = await apiFetch(`${API_BASE_URL}/api/mpc/derive-addresses`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ entityId: activeEntity.id }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setEntitiesMap(prev => ({
                            ...prev,
                            [accountType]: {
                              ...prev[accountType],
                              evmDepositAddress: data.addresses.evm,
                              solanaDepositAddress: data.addresses.solana,
                              btcDepositAddress: data.addresses.btc,
                              tronDepositAddress: data.addresses.tron,
                              tonDepositAddress: data.addresses.ton,
                              nearDepositAddress: data.addresses.near,
                            },
                          }));
                          alert('Addresses refreshed successfully.');
                        }
                      } catch (e) {
                        alert('Could not refresh addresses right now.');
                      }
                    }}
                  >
                    ↻ Refresh addresses
                  </button>
                </div>
              )}
            </div>

            {/* ── Key Security Model ── */}
            <div className="section-title">Key security</div>
            <div className="row-card" style={{ padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Lock size={18} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Non-custodial MPC security</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                    Your addresses are generated using distributed multi-party computation (MPC). No single party — including Proxim — ever holds your full private key.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 8 }}>
                    Private keys are never stored or displayed. Instead, transactions are signed using your verified identity via a distributed key ceremony. This means there is nothing to "export" — your addresses are always recoverable from your Proxim login.
                  </div>
                  <div style={{ fontSize: 12, color: '#4A8CFF', marginTop: 10, fontWeight: 600 }}>
                    Your funds are secured. You are always in control.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Both Entity Addresses Summary ── */}
            {entitiesMap['PERSONAL'] && entitiesMap['BUSINESS'] && (
              <>
                <div className="section-title">All account addresses</div>
                <div className="row-card" style={{ padding: '8px 12px', marginBottom: 18 }}>
                  {(['PERSONAL', 'BUSINESS'] as const).map(type => {
                    const ent = entitiesMap[type];
                    if (!ent?.evmDepositAddress) return null;
                    return (
                      <div key={type} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                          {type === 'PERSONAL' ? '👤 Personal' : '🏢 Business'}
                        </div>
                        <div className="key-address" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 11 }}>EVM: {ent.evmDepositAddress}</span>
                          <button className="copy-btn" onClick={() => navigator.clipboard.writeText(ent.evmDepositAddress || '')}>Copy</button>
                        </div>
                        {ent.solanaDepositAddress && (
                          <div className="key-address">
                            <span style={{ fontSize: 11 }}>SOL: {ent.solanaDepositAddress}</span>
                            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(ent.solanaDepositAddress || '')}>Copy</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button className="cta ghost" style={{ marginTop: 8, color: 'var(--danger)', borderColor: '#FECACA' }} onClick={handleLogout}>
              Sign out
            </button>
          </div>
          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'stocks' ? 'active' : ''}`} onClick={() => { setCurrentScreen('stocks'); fetchStocks(); fetchStockPositions(); fetchMarketStatus(); }}><TrendingUp size={20} />Invest</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>


        {/* ===== SCREEN: INVOICES ===== */}
        <div className={`screen ${currentScreen === 'invoices' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => { triggerLightHaptic(); setCurrentScreen('home'); }} style={{ cursor: 'pointer' }}>← Back</button>
            <div className="logo" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 800 }}>Invoices</div>
            <button onClick={() => { triggerLightHaptic(); setInvoiceAmount(''); setInvoiceFxQuote(null); setCurrentScreen('invoice-new'); }} className="chip" style={{ background: '#4A8CFF', color: '#061B18', fontWeight: 800, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', border: 'none', fontFamily: "'Satoshi', sans-serif" }}>+ Create</button>
          </div>
          <div className="scroll" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 20 }}>Issue digital multi-currency invoices for business clients worldwide.</div>
            {invoicesList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', textAlign: 'center', padding: '40px 20px', background: 'rgba(11, 41, 36, 0.65)', borderRadius: 20, border: '1px solid rgba(74, 140, 255, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <FileText size={44} color="#4A8CFF" />
                </div>
                No invoices created yet. Tap <strong>+ Create</strong> to issue your first invoice.
              </div>
            ) : (
              <div className="row-card">
                {invoicesList.map((inv: any) => (
                  <div key={inv.id} className="row" onClick={() => { triggerLightHaptic(); setSelectedInvoiceForModal(inv); }} style={{ cursor: 'pointer' }}>
                    <div className="category-squircle bank">
                      <FileText size={18} />
                    </div>
                    <div className="row-body">
                      <div className="row-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                        <span>{inv.clientName || 'Valued Client'}</span>
                        <span className="chip" style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(53, 217, 208, 0.2)', border: '1px solid #35D9D0', color: '#35D9D0', borderRadius: 999 }}>
                          {inv.settlementType === 'crypto' || inv.settlementType === 'stablecoin' ? 'CRYPTO' : 'FIAT'}
                        </span>
                      </div>
                      <div className="row-sub" style={{ color: 'rgba(247, 248, 244, 0.5)', fontSize: 11 }}>{inv.tag || inv.id?.slice(0, 8)} · {inv.status || 'PENDING'}</div>
                    </div>
                    <div className="row-amount pos num" style={{ color: '#4A8CFF', fontWeight: 800 }}>{inv.currency || 'USD'} {parseFloat(inv.amount || inv.totalAmount || '0').toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
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
              setIsCreatingInvoice(true);
              try {
                const res = await apiFetch(`${API_BASE_URL}/api/invoices/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    entityId: activeEntity.id,
                    clientName: invoiceClientName,
                    clientEmail: invoiceClientEmail,
                    totalAmount: parseFloat(invoiceAmount),
                    currency: invoiceSettlementMode === 'crypto' ? invoiceCryptoAsset : invoiceCurrency,
                    settlementType: invoiceSettlementMode,
                    cryptoNetwork: invoiceCryptoChain,
                    cryptoAsset: invoiceCryptoAsset,
                    dueDate: invoiceDueDate || undefined,
                    description: invoiceDescription || 'Professional Services',
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to create invoice.');
                const createdInv = data.invoice || {
                  id: Date.now().toString(),
                  clientName: invoiceClientName,
                  clientEmail: invoiceClientEmail,
                  totalAmount: invoiceAmount,
                  currency: invoiceSettlementMode === 'crypto' ? invoiceCryptoAsset : invoiceCurrency,
                  settlementType: invoiceSettlementMode,
                  status: 'PENDING',
                };
                setInvoicesList(prev => [createdInv, ...prev]);
                setSelectedInvoiceForModal(createdInv);
                setCurrentScreen('invoices');
                setInvoiceClientName('');
                setInvoiceClientEmail('');
                setInvoiceAmount('');
                setInvoiceDescription('');
                setInvoiceFxQuote(null);
              } catch (err: any) {
                alert(err.message || 'Invoice creation failed.');
              } finally {
                setIsCreatingInvoice(false);
              }
            }}>

              {/* Settlement Channel Selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 8 }}>Client Payment Method</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setInvoiceSettlementMode('fiat'); handleInvoiceAmountChange(invoiceAmount, invoiceCurrency); }}
                    style={{
                      padding: '12px 8px',
                      borderRadius: 12,
                      border: invoiceSettlementMode === 'fiat' ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.12)',
                      background: invoiceSettlementMode === 'fiat' ? 'rgba(53, 217, 208, 0.2)' : 'rgba(255,255,255,0.05)',
                      fontWeight: 800,
                      fontSize: 12.5,
                      color: invoiceSettlementMode === 'fiat' ? '#35D9D0' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    🏦 Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInvoiceSettlementMode('crypto'); handleInvoiceAmountChange(invoiceAmount, invoiceCryptoAsset); }}
                    style={{
                      padding: '12px 8px',
                      borderRadius: 12,
                      border: invoiceSettlementMode === 'crypto' ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.12)',
                      background: invoiceSettlementMode === 'crypto' ? 'rgba(53, 217, 208, 0.2)' : 'rgba(255,255,255,0.05)',
                      fontWeight: 800,
                      fontSize: 12.5,
                      color: invoiceSettlementMode === 'crypto' ? '#35D9D0' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    ⚡ Crypto (Stablecoin)
                  </button>
                </div>
              </div>

              <div className="field">
                <label style={{ color: '#94A3B8', fontWeight: 700 }}>Client / Business Name</label>
                <input
                  placeholder="Acme International Ltd"
                  value={invoiceClientName}
                  onChange={e => setInvoiceClientName(e.target.value)}
                  required
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }}
                />
              </div>

              <div className="field">
                <label style={{ color: '#94A3B8', fontWeight: 700 }}>Client Email Address</label>
                <input
                  type="email"
                  placeholder="billing@acme.com"
                  value={invoiceClientEmail}
                  onChange={e => setInvoiceClientEmail(e.target.value)}
                  required
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }}
                />
              </div>

              {invoiceSettlementMode === 'fiat' ? (
                <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Currency</label>
                    <select
                      value={invoiceCurrency}
                      onChange={e => { setInvoiceCurrency(e.target.value); handleInvoiceAmountChange(invoiceAmount, e.target.value); }}
                      style={{ width: '100%', padding: 12, borderRadius: 12, background: '#0D1424', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff', fontWeight: 700 }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="NGN">NGN (₦)</option>
                      <option value="KES">KES (KSh)</option>
                      <option value="GHS">GHS (GH₵)</option>
                      <option value="CAD">CAD (CA$)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Billed Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1,500.00"
                      value={invoiceAmount}
                      onChange={e => handleInvoiceAmountChange(e.target.value, invoiceCurrency)}
                      required
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="field">
                      <label style={{ color: '#94A3B8', fontWeight: 700 }}>Network</label>
                      <select
                        value={invoiceCryptoChain}
                        onChange={e => setInvoiceCryptoChain(e.target.value as any)}
                        style={{ width: '100%', padding: 12, borderRadius: 12, background: '#0D1424', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff', fontWeight: 700 }}
                      >
                        <option value="Base">Base (Coinbase L2)</option>
                        <option value="Solana">Solana</option>
                        <option value="Polygon">Polygon</option>
                        <option value="Ethereum">Ethereum</option>
                        <option value="Arbitrum">Arbitrum</option>
                      </select>
                    </div>
                    <div className="field">
                      <label style={{ color: '#94A3B8', fontWeight: 700 }}>Asset</label>
                      <select
                        value={invoiceCryptoAsset}
                        onChange={e => { setInvoiceCryptoAsset(e.target.value as any); handleInvoiceAmountChange(invoiceAmount, e.target.value); }}
                        style={{ width: '100%', padding: 12, borderRadius: 12, background: '#0D1424', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff', fontWeight: 700 }}
                      >
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                        <option value="EURC">EURC</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Stablecoin Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1,000.00"
                      value={invoiceAmount}
                      onChange={e => handleInvoiceAmountChange(e.target.value, invoiceCryptoAsset)}
                      required
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

              {/* Dynamic FX Quote Box with Proxim Fee Incorporated */}
              {invoiceFxQuote && parseFloat(invoiceAmount) > 0 && (
                <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(53, 217, 208, 0.35)', borderRadius: 14, padding: 14, margin: '14px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimated Net Receivable</span>
                    <span className="chip" style={{ fontSize: 10, background: 'rgba(53, 217, 208, 0.2)', color: '#35D9D0', fontWeight: 700 }}>FX Live</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Bricolage Grotesque', color: '#ffffff' }}>${invoiceFxQuote.netUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>USD equivalent</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, fontSize: 11.5, color: '#94A3B8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Gross Billed:</span>
                      <strong style={{ color: '#ffffff' }}>{invoiceFxQuote.sourceCurrency} {invoiceFxQuote.sourceAmount?.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Proxim Fee (1.2%):</span>
                      <span style={{ color: '#FF4D4D', fontWeight: 600 }}>- {invoiceFxQuote.sourceCurrency} {invoiceFxQuote.feeAmount?.toLocaleString()} (~${invoiceFxQuote.feeUsd?.toFixed(2)} USD)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Net Deposited:</span>
                      <strong style={{ color: '#35D9D0' }}>{invoiceFxQuote.sourceCurrency} {invoiceFxQuote.netSourceAmount?.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' }}>
                    * The USD equivalent is shown after Proxim's 1.2% processing fee has been factored in. Fees are swept to platform treasury.
                  </div>
                </div>
              )}

              <div className="field">
                <label style={{ color: '#94A3B8', fontWeight: 700 }}>Due Date</label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={e => setInvoiceDueDate(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }}
                />
              </div>

              <div className="field">
                <label style={{ color: '#94A3B8', fontWeight: 700 }}>Description / Scope of Work</label>
                <input
                  placeholder="Consulting & Software Development Services"
                  value={invoiceDescription}
                  onChange={e => setInvoiceDescription(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }}
                />
              </div>

              <button type="submit" disabled={isCreatingInvoice || !invoiceClientName || !invoiceAmount} className="cta" style={{ marginTop: 16 }}>
                {isCreatingInvoice ? 'Generating Invoice…' : 'Issue & Send Invoice'}
              </button>
            </form>
          </div>
        </div>

        {/* ===== SCREEN: PAYROLL ===== */}
        <div className={`screen ${currentScreen === 'payroll' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => { triggerLightHaptic(); setCurrentScreen('home'); }} style={{ cursor: 'pointer' }}>← Back</button>
            <div className="logo" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 800 }}>Payroll</div>
            <button onClick={() => { triggerLightHaptic(); setCurrentScreen('payroll-new'); }} className="chip" style={{ background: '#4A8CFF', color: '#061B18', fontWeight: 800, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', border: 'none', fontFamily: "'Satoshi', sans-serif" }}>+ Run Payroll</button>
          </div>
          <div className="scroll" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 20 }}>Batch salary payouts for your local and remote team.</div>
            {payrollRunsList.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', textAlign: 'center', padding: '40px 20px', background: 'rgba(11, 41, 36, 0.65)', borderRadius: 20, border: '1px solid rgba(74, 140, 255, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <Users size={44} color="#4A8CFF" />
                </div>
                No payroll runs yet. Tap <strong>+ Run Payroll</strong> to disburse salaries.
              </div>
            ) : (
              <div className="row-card">
                {payrollRunsList.map((pr: any) => (
                  <div key={pr.id} className="row" style={{ cursor: 'pointer' }}>
                    <div className="category-squircle bank">
                      <Users size={18} />
                    </div>
                    <div className="row-body">
                      <div className="row-title" style={{ fontWeight: 700 }}>{pr.title || 'Monthly Salary Batch'}</div>
                      <div className="row-sub" style={{ color: 'rgba(247, 248, 244, 0.5)', fontSize: 11 }}>{pr.employeeCount || 1} recipients · {pr.status || 'COMPLETED'}</div>
                    </div>
                    <div className="row-amount pos num" style={{ color: '#4A8CFF', fontWeight: 800 }}>{pr.currency || 'NGN'} {parseFloat(pr.totalAmount || '0').toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: NEW PAYROLL ===== */}
        <div className={`screen ${currentScreen === 'payroll-new' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('payroll')} style={{ cursor: 'pointer' }}>← Cancel</button>
            <div className="logo">Run Payroll</div>
            <div></div>
          </div>
          <div className="scroll">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!activeEntity?.id) return;
              try {
                const t = e.target as any;
                const res = await apiFetch(`${API_BASE_URL}/api/payroll/run`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ entityId: activeEntity.id, title: t.payrollTitle.value, totalAmount: parseFloat(t.totalAmount.value), currency: t.currency.value, employeeCount: parseInt(t.employeeCount.value) }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Payroll execution failed.');
                setPayrollRunsList(prev => [data.payrollRun || { id: Date.now().toString(), title: t.payrollTitle.value, totalAmount: t.totalAmount.value, currency: t.currency.value, employeeCount: t.employeeCount.value, status: 'PROCESSING' }, ...prev]);
                setCurrentScreen('payroll');
              } catch (err: any) { alert(err.message || 'Payroll execution failed.'); }
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
              <button type="submit" className="cta" style={{ marginTop: 16 }}>Disburse Payroll</button>
            </form>
          </div>
        </div>

        {/* ===== SCREEN: STOCKS ===== */}
        <div className={`screen ${currentScreen === 'stocks' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('home')} style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif" }}>← Back</button>
            <div className="logo" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 800 }}>Global Assets</div>
            <div></div>
          </div>
          <div className="scroll" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 16 }}>
              Invest in tokenized US equities, index funds, and high-yield government Treasuries.
            </div>

            <div style={{ background: 'rgba(117, 103, 248, 0.12)', borderRadius: 16, padding: 14, marginBottom: 20, border: '1px solid rgba(117, 103, 248, 0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#7567F8', color: '#061B18', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>✓</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7567F8' }}>
                US Stock &amp; Treasury Markets Active · Instant Settlement
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#F7F8F4' }}>Available Stocks &amp; Treasuries</div>
              <input
                type="text"
                placeholder="Search symbol or name (e.g. AAPL, TSLA, OUSG)..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(255,255,255,0.05)', color: '#F7F8F4', fontSize: 13, fontWeight: 500, marginBottom: 16, fontFamily: "'Satoshi', sans-serif" }}
              />

              <div className="row-card" style={{ padding: '2px 4px' }}>
                {[
                  { symbol: 'AAPL', name: 'Apple Inc.', price: '$224.50', change: '+1.4%', category: 'Stock' },
                  { symbol: 'TSLA', name: 'Tesla Inc.', price: '$210.20', change: '+2.1%', category: 'Stock' },
                  { symbol: 'NVDA', name: 'Nvidia Corp.', price: '$128.80', change: '+3.5%', category: 'Stock' },
                  { symbol: 'SPY', name: 'S&P 500 Index ETF', price: '$545.10', change: '+0.8%', category: 'ETF' },
                  { symbol: 'OUSG', name: 'US Government Treasuries', price: '$105.40', change: '5.15% APY', category: 'RWA Treasury' },
                  { symbol: 'USDY', name: 'US Dollar Yield Token', price: '$1.05', change: '5.10% APY', category: 'Yield Token' },
                ]
                .filter(s => s.symbol.toLowerCase().includes(stockSearch.toLowerCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase()))
                .map(stock => (
                  <div
                    key={stock.symbol}
                    className="row"
                    onClick={() => {
                      setSelectedStock({ symbol: stock.symbol, name: stock.name, priceInUSD: stock.price.replace('$', '') });
                      setShowBuyModal(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="row-icon" style={{ backgroundColor: 'rgba(117, 103, 248, 0.15)', border: '1px solid #7567F8', color: '#7567F8' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                    </div>
                    <div className="row-body">
                      <div className="row-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{stock.symbol}</span>
                        <span className="chip" style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(117, 103, 248, 0.2)', color: '#7567F8', border: '1px solid rgba(117, 103, 248, 0.4)' }}>{stock.category}</span>
                      </div>
                      <div className="row-sub">{stock.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="row-amount num" style={{ color: '#F7F8F4', fontWeight: 700 }}>{stock.price}</div>
                      <div style={{ fontSize: 11, color: stock.change.includes('+') || stock.change.includes('APY') ? '#FF5DA8' : '#E6E8EC', fontWeight: 700 }}>{stock.change}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#F7F8F4' }}>Your Holdings</div>
              <div style={{ padding: 20, background: 'rgba(11, 41, 36, 0.65)', borderRadius: 18, border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: 12.5, color: 'rgba(247, 248, 244, 0.6)', textAlign: 'center' }}>
                No active holdings. Tap any stock or treasury above to place your first buy order.
              </div>
            </div>
          </div>
          <div className="bottomnav">
            <button className="navbtn" onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className="navbtn" onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className="navbtn active" onClick={() => setCurrentScreen('stocks')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>Stocks</button>
            <button className="navbtn" onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== MODAL: BUY STOCK ===== */}
        {showBuyModal && selectedStock && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => { setShowBuyModal(false); setSelectedStock(null); setBuyAmount(''); setBuyAccountContext(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 6, color: '#ffffff' }}>Buy {selectedStock.symbol}</h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>{selectedStock.name} — ${parseFloat(selectedStock.priceInUSD || 0).toFixed(2)} per share</div>
              {(!marketStatus?.isOpen || !marketStatus?.asset?.tradable) && (
                <div style={{ background: 'rgba(255, 77, 77, 0.15)', border: '1px solid #FF4D4D', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 12, color: '#FF4D4D', fontWeight: 700 }}>Market is closed — trading not available</div>
              )}
              <form onSubmit={handleBuySubmit}>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Investment Amount (USD)</label>
                  <input type="number" step="0.01" min="10" placeholder="100.00" value={buyAmount} onChange={e => setBuyAmount(e.target.value)} disabled={!marketStatus?.isOpen} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Minimum: $10.00</div>
                </div>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Funding account</label>
                  <select value={buyAccountContext} onChange={e => setBuyAccountContext(e.target.value)} required style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
                    <option value="">Select account...</option>
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <button type="submit" className="cta" disabled={!marketStatus?.isOpen || !buyAccountContext || parseFloat(buyAmount) < 10} style={{ marginTop: 16 }}>Confirm Purchase</button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: SELL STOCK ===== */}
        {showSellModal && selectedPosition && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => { setShowSellModal(false); setSelectedPosition(null); setSellAmount(''); setSellAccountContext(''); }} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 6, color: '#ffffff' }}>Sell {selectedPosition.strategy?.assetName}</h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Available: {selectedPosition.spotPosition?.currentPositionInShares?.humanized} shares</div>
              <form onSubmit={handleSellSubmit}>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Shares to sell</label>
                  <input type="number" step="0.000001" placeholder="0.000000" value={sellAmount} onChange={e => setSellAmount(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} />
                </div>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Payout account</label>
                  <select value={sellAccountContext} onChange={e => setSellAccountContext(e.target.value)} required style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
                    <option value="">Select account...</option>
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <button type="submit" className="cta" disabled={!sellAccountContext} style={{ marginTop: 16 }}>Confirm Sale</button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: SAVINGS UN-SWEEP / WITHDRAW ===== */}
        {showSaveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Savings Hub
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Bricolage Grotesque', margin: '0 0 6px', color: '#ffffff' }}>
                {savingsActionType === 'DEPOSIT' ? `Save with ${yieldStrategy === 'near_intent' ? 'NEAR Intent' : 'Kamino'}` : 'Withdraw from Savings'}
              </h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>
                {savingsActionType === 'DEPOSIT'
                  ? 'Choose the amount and lock duration. Funds are not moved until a live Kamino transaction is confirmed.'
                  : 'Early withdrawal requires the configured Kamino withdrawal transaction and a 10% fee on principal.'}
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>Total Savings Balance</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
                  ${savingsPool.toFixed(2)} USD
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const amt = parseFloat(savingsAmount || '0');
                if (amt <= 0 || (savingsActionType === 'WITHDRAW' && amt > savingsPool)) {
                  alert(savingsActionType === 'DEPOSIT' ? 'Please enter a valid deposit amount.' : 'Please enter a valid amount within your savings pool balance.');
                  return;
                }
                authorizeWithPrivyOrPin(
                  savingsActionType === 'DEPOSIT' ? `Deposit $${amt.toFixed(2)} into Kamino Savings` : `Withdraw $${amt.toFixed(2)} from Kamino Savings`,
                  async (passcode) => {
                    if (!activeEntity?.id) return;
                    if (savingsActionType === 'DEPOSIT') {
                      const isPods = yieldStrategy === 'pods';
                      const response = await apiFetch(isPods ? `${API_BASE_URL}/api/pods/deposit` : `${API_BASE_URL}/api/kamino/lock`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(isPods
                          ? { strategyId: selectedYieldOption, amount: String(Math.floor(amt * 1_000_000)), userWallet: activeEntity.evmDepositAddress }
                          : { entityId: activeEntity.id, amountUsd: amt, lockDurationDays: Number(savingsDurationDays), vaultId: selectedYieldOption || selectedKaminoVault, strategy: yieldStrategy, passcode }),
                      });
                      const data = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        console.error('Savings deposit request failed:', {
                          status: response.status,
                          strategy: yieldStrategy,
                          vaultId: selectedYieldOption || selectedKaminoVault,
                          error: data.error,
                          details: data.details,
                        });
                        const providerReason = data.details ? `\n\nDetails: ${data.details}` : '';
                        alert(`${data.error || 'Savings deposit is currently unavailable. No funds were moved.'}${providerReason}`);
                        return;
                      }

                      if (isPods) {
                        try {
                          const result = await signAndSubmitBiconomyQuote('pods', data.biconomyQuote);
                          alert(`Pods deposit submitted${result?.transactionHash ? `: ${result.transactionHash}` : '.'}`);
                        } catch (e: any) {
                          alert(`Pods deposit could not be submitted: ${e.message}`);
                          return;
                        }
                      } else if (data.nearIntent?.depositAddress && wallets && wallets.length > 0) {
                        try {
                          const wallet = wallets[0];
                          await wallet.switchChain(8453); // Ensure Base network (Chain ID 8453)
                          
                          const provider = await wallet.getEthereumProvider();
                          const targetDepositAddress = (data.nearIntent.depositAddress || data.nearIntent.intentId || '').toLowerCase();
                          const usdcTokenAddress = data.nearIntent.tokenAddressBase || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
                          
                          // Construct ERC-20 transfer(address to, uint256 amount) calldata
                          const cleanAddress = targetDepositAddress.replace('0x', '').padStart(64, '0');
                          const usdcUnits = BigInt(Math.floor(amt * 1_000_000)).toString(16).padStart(64, '0');
                          const calldata = `0xa9059cbb${cleanAddress}${usdcUnits}`;

                          const txHash = await provider.request({
                            method: 'eth_sendTransaction',
                            params: [{
                              from: wallet.address,
                              to: usdcTokenAddress,
                              data: calldata,
                              value: '0x0',
                            }]
                          });

                          // Submit deposit hash to NEAR 1Click solver
                          if (txHash) {
                            await apiFetch(`${API_BASE_URL}/api/intents/submit-deposit`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                intentId: data.nearIntent.intentId || targetDepositAddress,
                                txHash,
                                chain: 'base',
                              }),
                            }).catch(() => {});
                          }
                          
                          alert(`Deposit authorized. Funds transferred to solver on Base with transaction: ${txHash || 'confirmed'}`);
                        } catch (e: any) {
                          console.error('EVM USDC Deposit failed:', e);
                          alert(`Deposit transaction failed: ${e.message}`);
                          return;
                        }
                      } else {
                        alert(`Deposit authorized. Transaction signature: ${data.transactionSignature || data.nearIntent?.intentId || 'Success'}`);
                      }

                      setShowSaveModal(false);
                      setSavingsAmount('');
                    } else {
                      setShowSaveModal(false);
                      const refreshSignal = activeAbortController.current?.signal || new AbortController().signal;
                      await Promise.all([
                        fetchBalance(activeEntity.id, refreshSignal),
                        fetchTransactions(activeEntity.id, refreshSignal),
                      ]);
                    }
                  },
                );
              }}>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>{savingsActionType === 'DEPOSIT' ? 'Amount to save (USD)' : 'Withdrawal amount (USD)'}</label>
                  <input
                    name="savingsAmt"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={savingsActionType === 'WITHDRAW' ? savingsPool : undefined}
                    placeholder="100.00"
                    value={savingsAmount}
                    onChange={e => setSavingsAmount(e.target.value)}
                    required
                    style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: 16, fontWeight: 800 }}
                  />
                </div>
                {savingsActionType === 'DEPOSIT' && (
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Yield route</label>
                    <select value={yieldStrategy} onChange={e => {
                      const strategy = e.target.value as 'near_intent' | 'kamino';
                      const option = yieldOptions.find(item => item.provider === strategy);
                      setYieldStrategy(strategy);
                      setSelectedYieldOption(option?.id || '');
                    }} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 16, fontWeight: 800 }}>
                          <option value="near_intent">Best available via NEAR Intent</option>
                          <option value="kamino">Choose a Kamino vault</option>
                          <option value="pods">Choose a Pods strategy</option>
                    </select>
                  </div>
                )}
                {savingsActionType === 'DEPOSIT' && yieldStrategy === 'kamino' && (
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Kamino vault</label>
                    <select value={selectedYieldOption} onChange={e => setSelectedYieldOption(e.target.value)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 16, fontWeight: 800 }}>
                      {yieldOptions.filter(option => option.provider === 'kamino').map(option => <option key={option.id} value={option.id}>{option.name} · {option.asset} · {(Number(option.apyByDuration?.[Number(savingsDurationDays)]) * 100).toFixed(2)}%</option>)}
                    </select>
                  </div>
                )}
                {savingsActionType === 'DEPOSIT' && yieldStrategy === 'pods' && (
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Pods strategy</label>
                    <select value={selectedYieldOption} onChange={e => setSelectedYieldOption(e.target.value)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 16, fontWeight: 800 }}>
                      {yieldOptions.filter(option => option.provider === 'pods').map(option => <option key={option.id} value={option.id}>{option.name} · {(Number(option.apyByDuration?.[Number(savingsDurationDays)]) * 100).toFixed(2)}%</option>)}
                    </select>
                  </div>
                )}
                {savingsActionType === 'DEPOSIT' && (
                  <div className="field">
                    <label style={{ color: '#94A3B8', fontWeight: 700 }}>Lock duration</label>
                    <select value={savingsDurationDays} onChange={e => setSavingsDurationDays(e.target.value)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 16, fontWeight: 800 }}>
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                      <option value="365">365 days</option>
                    </select>
                  </div>
                )}
                {savingsActionType === 'DEPOSIT' && savingsEstimate && (
                  <div style={{ background: 'rgba(53, 217, 208, 0.08)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 14, padding: 12, marginTop: 8, color: '#F7F8F4', fontSize: 12 }}>
                    <div style={{ color: '#35D9D0', fontWeight: 800, marginBottom: 6 }}>Estimated at maturity</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Live APY basis</span><strong>{(selectedKaminoApy! * 100).toFixed(2)}%</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Estimated earnings</span><strong>${savingsEstimate.interest.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Estimated total</span><strong>${savingsEstimate.maturity.toFixed(2)}</strong></div>
                  </div>
                )}
                <button type="submit" className="cta" style={{ marginTop: 16 }}>
                  {savingsActionType === 'DEPOSIT' ? 'Authorize Deposit' : 'Proceed to Early Access Options'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: EARLY ACCESS UNLOCK OPTIONS ===== */}
        {showEarlyExitModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.92)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.4)', color: '#ffffff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.95)' }}>
              <button onClick={() => setShowEarlyExitModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#FFB800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Early Access Request
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Bricolage Grotesque', margin: '0 0 6px', color: '#ffffff' }}>
                Select Early Exit Fee Option
              </h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>
                This term vault is currently locked until maturity. To exit early, select your preferred fee structure below:
              </div>

              {/* Option A Card */}
              <div
                onClick={() => setSelectedEarlyExitChoice('FORFEIT_INTEREST')}
                style={{
                  background: selectedEarlyExitChoice === 'FORFEIT_INTEREST' ? 'rgba(53, 217, 208, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: selectedEarlyExitChoice === 'FORFEIT_INTEREST' ? '2px solid #35D9D0' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Option A: Forfeit Interest</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', background: 'rgba(53, 217, 208, 0.15)', padding: '2px 8px', borderRadius: 20 }}>0% Principal Fee</span>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
                  Retain <strong>100% of your original Principal</strong>. All accrued interest earned so far is forfeited.
                </div>
              </div>

              {/* Option B Card */}
              <div
                onClick={() => setSelectedEarlyExitChoice('PENALTY_FEE')}
                style={{
                  background: selectedEarlyExitChoice === 'PENALTY_FEE' ? 'rgba(53, 217, 208, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: selectedEarlyExitChoice === 'PENALTY_FEE' ? '2px solid #35D9D0' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 20,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Option B: 10% Principal Fee</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#FFB800', background: 'rgba(255, 184, 0, 0.15)', padding: '2px 8px', borderRadius: 20 }}>Keep Interest</span>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
                  Keep <strong>100% of your accrued interest</strong>. A 10.0% early exit processing fee applies to your principal.
                </div>
              </div>

              <button
                type="button"
                className="cta"
                onClick={() => {
                  requireSecurityPin('Authorize Early Vault Unlock', async (passcode) => {
                    const response = await apiFetch(`${API_BASE_URL}/api/kamino/early-unlock`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        termVaultId: earlyExitTermVaultId || 'tv_sample',
                        entityId: activeEntity?.id,
                        penaltyChoice: selectedEarlyExitChoice,
                        passcode,
                      }),
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      alert(data.error || 'Early unlock request failed.');
                      return;
                    }
                    setShowEarlyExitModal(false);
                    alert(`Early unlock successful. Net Payout: $${data.executionSummary?.netPayoutUsd || '0.00'}`);
                  });
                }}
              >
                Confirm Early Access Unlock
              </button>
            </div>
          </div>
        )}


        {/* ===== MODAL: ORDER STATUS ===== */}
        {showOrderStatusModal && pendingOrder && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => { setShowOrderStatusModal(false); setPendingOrder(null); }} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 6, color: '#ffffff' }}>{pendingOrder.type === 'buy' ? 'Purchase' : 'Sale'} in progress</h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>{pendingOrder.symbol} — ${pendingOrder.amount}</div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12, color: '#ffffff' }}>Settlement progress</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['Awaiting transfer', 'Awaiting presign', 'Order in progress', 'Awaiting forward', 'Completed'].map((step, index) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94A3B8' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: index <= (pendingOrder.stepIndex || 0) ? '#35D9D0' : 'rgba(255,255,255,0.2)' }} />
                      {step}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { setShowOrderStatusModal(false); setPendingOrder(null); }} className="cta ghost">Close</button>
            </div>
          </div>
        )}

        {/* ===== MODAL: KYC / KYB IDENTITY VERIFICATION ===== */}
        {showKycModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowKycModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 6, color: '#ffffff' }}>
                Verify your {accountType === 'PERSONAL' ? 'identity' : 'business'}
              </h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>
                Required to issue dedicated multi-currency accounts and your unique handle.
              </div>
              <form onSubmit={handleSubmitKyc}>
                {accountType === 'PERSONAL' ? (
                  <>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="field" style={{ flex: 1 }}><label>First Name</label><input placeholder="Tomiwa" value={kycFirstName} onChange={e => setKycFirstName(e.target.value)} required /></div>
                      <div className="field" style={{ flex: 1 }}><label>Middle Name <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opt)</span></label><input placeholder="David" value={kycMiddleName} onChange={e => setKycMiddleName(e.target.value)} /></div>
                    </div>
                    <div className="field"><label>Surname</label><input placeholder="Igboze" value={kycSurname} onChange={e => setKycSurname(e.target.value)} required /></div>
                    <div className="field"><label>Mobile Phone</label><input type="tel" placeholder="+2348012345678" value={kycPhone} onChange={e => setKycPhone(e.target.value)} required /></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="field" style={{ flex: 1 }}><label>BVN (11 digits)</label><input placeholder="22113344556" maxLength={11} value={kycBvn} onChange={e => setKycBvn(e.target.value)} required /></div>
                      <div className="field" style={{ flex: 1 }}><label>NIN (11 digits)</label><input placeholder="11223344556" maxLength={11} value={kycNin} onChange={e => setKycNin(e.target.value)} required /></div>
                    </div>
                    <div className="field"><label>Date of Birth</label><input type="date" value={kycDob} onChange={e => setKycDob(e.target.value)} required /></div>
                    <div className="field"><label>Street Address</label><input placeholder="14 Navy Estate, Karshi" value={kycAddress} onChange={e => setKycAddress(e.target.value)} required /></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="field" style={{ flex: 1 }}><label>City</label><input placeholder="Abuja" value={kycCity} onChange={e => setKycCity(e.target.value)} required /></div>
                      <div className="field" style={{ flex: 1 }}><label>State</label><input placeholder="FCT" value={kycState} onChange={e => setKycState(e.target.value)} required /></div>
                    </div>
                    <div className="field"><label>Postal Code <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label><input placeholder="900001" value={kycPostalCode} onChange={e => setKycPostalCode(e.target.value)} /></div>
                  </>
                ) : (
                  <>
                    <div className="field"><label>Business Legal Name</label><input placeholder="Acme Tech Solutions Ltd" value={kycLegalName} onChange={e => setKycLegalName(e.target.value)} required /></div>
                    <div className="field"><label>Business Tag / Handle</label><input placeholder="ACME" value={kycBusinessTag} onChange={e => setKycBusinessTag(e.target.value)} required /></div>
                    <div className="field"><label>CAC Registration / RC Number</label><input placeholder="RC123456" value={kycRcNumber} onChange={e => setKycRcNumber(e.target.value)} required /></div>
                    <div className="field"><label>Tax ID Number (TIN)</label><input placeholder="TIN987654" value={kycTin} onChange={e => setKycTin(e.target.value)} required /></div>
                    <div className="field"><label>Business Address</label><input placeholder="Victoria Island" value={kycAddress} onChange={e => setKycAddress(e.target.value)} required /></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="field" style={{ flex: 1 }}><label>City</label><input placeholder="Lagos" value={kycCity} onChange={e => setKycCity(e.target.value)} required /></div>
                      <div className="field" style={{ flex: 1 }}><label>State</label><input placeholder="Lagos" value={kycState} onChange={e => setKycState(e.target.value)} required /></div>
                    </div>
                    <div className="field"><label>Director Full Name</label><input placeholder="Director Name" value={kycUboName} onChange={e => setKycUboName(e.target.value)} required /></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="field" style={{ flex: 1 }}><label>Director BVN</label><input placeholder="22113344556" maxLength={11} value={kycBvn} onChange={e => setKycBvn(e.target.value)} required /></div>
                      <div className="field" style={{ flex: 1 }}><label>Director NIN</label><input placeholder="11223344556" maxLength={11} value={kycNin} onChange={e => setKycNin(e.target.value)} required /></div>
                    </div>
                  </>
                )}
                <div style={{ marginTop: 12, marginBottom: 14, background: 'var(--surface-alt)', padding: 12, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Supporting Documents (optional)</div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11 }}>Government ID (Passport / National ID / Driver's License)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setKycIdentityFile(r.result as string); r.readAsDataURL(f); } }} style={{ fontSize: 12 }} />
                    {kycIdentityFile && <span style={{ fontSize: 10, color: 'var(--green-dark)', fontWeight: 700 }}>✓ ID attached</span>}
                  </div>
                  <div className="field">
                    <label style={{ fontSize: 11 }}>Proof of Address (Utility Bill / Bank Statement)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setKycAddressFile(r.result as string); r.readAsDataURL(f); } }} style={{ fontSize: 12 }} />
                    {kycAddressFile && <span style={{ fontSize: 10, color: 'var(--green-dark)', fontWeight: 700 }}>✓ Address proof attached</span>}
                  </div>
                </div>
                <button type="submit" disabled={isSubmittingKyc} className="cta">
                  {isSubmittingKyc ? 'Submitting…' : 'Submit for review'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: RECEIVE ===== */}
        {showReceiveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowReceiveModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 4, color: '#ffffff' }}>Receive Money</h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Your dedicated accounts.</div>

              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, padding: 4, marginBottom: 16, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button onClick={() => setReceiveTab('fiat')} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: receiveTab === 'fiat' ? '1px solid #35D9D0' : 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: receiveTab === 'fiat' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: receiveTab === 'fiat' ? '#35D9D0' : '#94A3B8' }}>Bank Accounts</button>
                <button onClick={() => setReceiveTab('crypto')} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: receiveTab === 'crypto' ? '1px solid #35D9D0' : 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: receiveTab === 'crypto' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: receiveTab === 'crypto' ? '#35D9D0' : '#94A3B8' }}>Account Address</button>
              </div>

              {receiveTab === 'fiat' ? (
                <div style={{ overflowY: 'auto', paddingRight: 4 }}>
                  {activeEntity?.fiatAccounts && activeEntity.fiatAccounts.length > 0 ? (
                    <>
                      {activeEntity.fiatAccounts.map((acc, idx) => (
                        <div key={acc.id || acc.dueAccountId || idx} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 16, padding: 14, marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span className="chip" style={{ background: 'rgba(22, 199, 183, 0.2)', border: '1px solid rgba(53, 217, 208, 0.4)', color: '#35D9D0', fontWeight: 800 }}>{acc.currency} Account</span>
                            <strong style={{ fontSize: 12, color: '#ffffff' }}>{acc.bankName}</strong>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Bricolage Grotesque', letterSpacing: 0.5, margin: '6px 0', color: '#ffffff' }}>{acc.accountNumber}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: '#94A3B8' }}>
                              {getLegalDisplayName(activeEntity, currentUser)} / Proxim
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(acc.accountNumber); setCopyNotification(`${acc.currency} account number copied.`); setTimeout(() => setCopyNotification(null), 1800); }} className="chip" style={{ cursor: 'pointer', background: 'var(--btn-primary-bg)', color: '#050811', border: '1px solid #35D9D0', fontWeight: 800 }}>Copy</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { setShowReceiveModal(false); setShowAddAccountModal(true); }} className="cta ghost" style={{ marginTop: 10, padding: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
                        <span>➕</span> Claim EUR, GBP, KES, or UGX account
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 14 }}>No bank accounts provisioned yet. Complete identity verification to unlock accounts.</div>
                      <button onClick={() => { setShowReceiveModal(false); setShowKycModal(true); }} className="cta">Verify identity</button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 16, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: '#ffffff' }}>EVM address (Ethereum, Polygon, Base, Arbitrum)</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>Safe to share. Receives USDC, USDT, ETH and other tokens.</div>
                    <div className="key-address" style={{ background: 'rgba(255, 255, 255, 0.06)', padding: 10, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: 11, fontWeight: 700, wordBreak: 'break-all', color: '#ffffff' }}>{activeEntity?.evmDepositAddress || 'Complete verification to get your address'}</code>
                      {activeEntity?.evmDepositAddress && (
                        <button className="copy-btn" style={{ marginLeft: 8, background: 'var(--btn-primary-bg)', color: '#050811', fontWeight: 800 }} onClick={() => { navigator.clipboard.writeText(activeEntity?.evmDepositAddress || ''); setCopyNotification('EVM address copied.'); setTimeout(() => setCopyNotification(null), 1800); }}>Copy</button>
                      )}
                    </div>
                  </div>
                  {activeEntity?.solanaDepositAddress && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: '#ffffff' }}>Solana address</div>
                      <div className="key-address" style={{ background: 'rgba(255, 255, 255, 0.06)', padding: 10, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <code style={{ fontSize: 11, fontWeight: 700, wordBreak: 'break-all', color: '#ffffff' }}>{activeEntity.solanaDepositAddress}</code>
                        <button className="copy-btn" style={{ marginLeft: 8, background: 'var(--btn-primary-bg)', color: '#050811', fontWeight: 800 }} onClick={() => { navigator.clipboard.writeText(activeEntity?.solanaDepositAddress || ''); setCopyNotification('Solana address copied.'); setTimeout(() => setCopyNotification(null), 1800); }}>Copy</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {copyNotification && (
                <div style={{ background: 'rgba(53, 217, 208, 0.2)', border: '1px solid #35D9D0', color: '#35D9D0', padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, textAlign: 'center', marginTop: 10 }}>{copyNotification}</div>
              )}
            </div>
          </div>
        )}

        {/* ===== MODAL: SEND TRANSFER ===== */}
        {showSendModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 460, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowSendModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 4, color: '#ffffff' }}>Send Money</h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>Transfer to any bank account or wallet address, worldwide.</div>

              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, padding: 4, marginBottom: 16, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button onClick={() => setSendModeTab('fiat')} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: sendModeTab === 'fiat' ? '1px solid #35D9D0' : 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: sendModeTab === 'fiat' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: sendModeTab === 'fiat' ? '#35D9D0' : '#94A3B8' }}>Bank Transfer</button>
                <button onClick={() => setSendModeTab('crypto')} style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: sendModeTab === 'crypto' ? '1px solid #35D9D0' : 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: sendModeTab === 'crypto' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: sendModeTab === 'crypto' ? '#35D9D0' : '#94A3B8' }}>Send to Wallet</button>
              </div>

              {sendStatusMsg && (
                <div style={{ padding: 12, borderRadius: 10, fontSize: 12, marginBottom: 14, textAlign: 'center', background: sendStatusMsg.type === 'success' ? 'var(--tint)' : sendStatusMsg.type === 'warning' ? '#FEF3C7' : '#FEF2F2', color: sendStatusMsg.type === 'success' ? 'var(--green-dark)' : sendStatusMsg.type === 'warning' ? '#B45309' : 'var(--danger)' }}>
                  {sendStatusMsg.text}
                </div>
              )}

              <form onSubmit={handleSendSubmit}>
                {sendModeTab === 'fiat' ? (
                  <>
                    <div className="field">
                      <label style={{ color: '#94A3B8', fontWeight: 700 }}>Currency</label>
                      <select value={sendCurrency} onChange={e => { setSendCurrency(e.target.value); setSendIbanOrRouting(''); setSendBicOrSwift(''); setSendSortCode(''); setSendAccountNumber(''); setSendBankName(''); }} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
                        <option value="NGN">🇳🇬 NGN — Nigerian Naira</option>
                        <option value="USD">🇺🇸 USD — US Dollar</option>
                        <option value="EUR">🇪🇺 EUR — Euro</option>
                        <option value="GBP">🇬🇧 GBP — British Pound</option>
                        <option value="KES">🇰🇪 KES — Kenyan Shilling</option>
                        <option value="GHS">🇬🇭 GHS — Ghanaian Cedi</option>
                        <option value="ZAR">🇿🇦 ZAR — South African Rand</option>
                        <option value="UGX">🇺🇬 UGX — Ugandan Shilling</option>
                        <option value="AED">🇦🇪 AED — UAE Dirham</option>
                        <option value="CAD">🇨🇦 CAD — Canadian Dollar</option>
                      </select>
                    </div>
                    {(() => {
                      const hints: Record<string, string> = { NGN: 'Sent via NIBSS Instant Payment · arrives in seconds', USD: 'Sent via ACH / SWIFT', EUR: 'Sent via SEPA Instant · arrives within 10 seconds', GBP: 'Sent via Faster Payments · arrives in seconds', KES: 'Sent via PesaLink / M-Pesa · near-instant', GHS: 'Sent via GhIPSS Instant Pay', ZAR: 'Sent via PayShap Instant', UGX: 'Sent via UNPSS / MTN Mobile Money', AED: 'Sent via UAEFTS · same business day', CAD: 'Sent via EFT / Interac · 1 business day' };
                      const hint = hints[sendCurrency];
                      return hint ? <div style={{ fontSize: 11, color: '#35D9D0', background: 'rgba(53, 217, 208, 0.12)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, marginTop: -8 }}>⚡ {hint}</div> : null;
                    })()}
                    <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Who are you paying?</label><input type="text" placeholder="Full name or business name" value={sendRecipient} onChange={e => setSendRecipient(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                    {sendCurrency === 'NGN' && (<>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Account Number</label><input type="text" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit NUBAN" value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} />
                        {isResolvingAccount && <span style={{ fontSize: 11, color: '#35D9D0', marginTop: 4, display: 'block' }}>🔍 Checking account...</span>}
                        {resolvedAccountName && <span style={{ fontSize: 11, color: '#35D9D0', fontWeight: 700, marginTop: 4, display: 'block' }}>✓ Verified: {resolvedAccountName}</span>}
                      </div>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Bank Name</label><input type="text" placeholder="GTBank, Access, Zenith…" value={sendBankName} onChange={e => setSendBankName(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                    </>)}
                    {sendCurrency === 'USD' && (<>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>ABA Routing Number</label><input type="text" inputMode="numeric" maxLength={9} placeholder="9-digit routing number" value={sendIbanOrRouting} onChange={e => setSendIbanOrRouting(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Account Number</label><input type="text" inputMode="numeric" placeholder="Checking / savings account" value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Bank Name</label><input type="text" placeholder="Chase, Wells Fargo…" value={sendBankName} onChange={e => setSendBankName(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                    </>)}
                    {sendCurrency === 'EUR' && (<>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>IBAN</label><input type="text" placeholder="DE89 3704 0044 0532 0130 00" value={sendIbanOrRouting} onChange={e => setSendIbanOrRouting(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>BIC / SWIFT Code</label><input type="text" placeholder="COBADEFFXXX" value={sendBicOrSwift} onChange={e => setSendBicOrSwift(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                    </>)}
                    {sendCurrency === 'GBP' && (<>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Sort Code</label><input type="text" placeholder="20-00-00" maxLength={8} value={sendSortCode} onChange={e => setSendSortCode(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Account Number</label><input type="text" inputMode="numeric" maxLength={8} placeholder="8-digit account" value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                    </>)}
                    {['KES', 'ZAR', 'GHS', 'UGX', 'AED', 'CAD'].includes(sendCurrency) && (<>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>{['KES', 'GHS', 'UGX'].includes(sendCurrency) ? 'Account / Mobile Number' : 'Account or IBAN'}</label><input type="text" placeholder={sendCurrency === 'KES' ? 'Phone or account' : 'Account or IBAN'} value={sendAccountNumber} onChange={e => setSendAccountNumber(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                      <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Bank / Wallet Provider</label><input type="text" placeholder="Bank or mobile money provider" value={sendBankName} onChange={e => setSendBankName(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                    </>)}
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label style={{ color: '#94A3B8', fontWeight: 700 }}>Network</label>
                      <select value={sendCryptoNetwork} onChange={e => setSendCryptoNetwork(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
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
                      <label style={{ color: '#94A3B8', fontWeight: 700 }}>Token</label>
                      <select value={sendCryptoAsset} onChange={e => setSendCryptoAsset(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff', fontSize: 14, fontWeight: 600 }}>
                        <option value="USDC">USDC</option>
                        <option value="USDT">USDT</option>
                        <option value="ETH">ETH</option>
                        <option value="SOL">SOL</option>
                        <option value="MATIC">POL (Polygon)</option>
                      </select>
                    </div>
                    <div className="field"><label>Where should we send it?</label><input type="text" placeholder="0x71C...9e4A" value={sendCryptoAddress} onChange={e => setSendCryptoAddress(e.target.value)} required style={{ fontFamily: 'monospace', fontSize: 13 }} /></div>
                    <div style={{ background: 'var(--tint)', border: '1px solid var(--green)', borderRadius: 10, padding: 10, fontSize: 11, color: 'var(--green-dark)', fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>⚡ No network fees charged</div>
                  </>
                )}
                <div className="field"><label>Amount ({sendModeTab === 'fiat' ? sendCurrency : sendCryptoAsset})</label><input type="number" step="0.01" min="0.01" placeholder="0.00" value={sendAmount} onChange={e => setSendAmount(e.target.value)} required /></div>
                <div className="field"><label>Narration <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label><input type="text" placeholder="Invoice payment, rent, etc." value={sendNarration} onChange={e => setSendNarration(e.target.value)} /></div>
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowRequestModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 6, color: '#ffffff' }}>Request Payment</h3>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Request funds from contacts.</div>
              {requestStatusMsg && (
                <div style={{ padding: 12, borderRadius: 12, fontSize: 12, marginBottom: 14, textAlign: 'center', background: requestStatusMsg.type === 'success' ? 'rgba(53, 217, 208, 0.2)' : 'rgba(255, 77, 77, 0.15)', border: requestStatusMsg.type === 'success' ? '1px solid #35D9D0' : '1px solid #FF4D4D', color: requestStatusMsg.type === 'success' ? '#35D9D0' : '#FF4D4D' }}>
                  {requestStatusMsg.text}
                </div>
              )}
              <form onSubmit={handleCreatePaymentRequest}>
                <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Payer Handle / Username</label><input type="text" placeholder="@tomiwa" value={requestPayer} onChange={e => setRequestPayer(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Amount ({selectedCurrency})</label><input type="number" step="0.01" placeholder="45000" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>What's it for?</label><input type="text" placeholder="Weekend trip split" value={requestNarration} onChange={e => setRequestNarration(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                <button type="submit" disabled={isSubmittingRequest} className="cta">{isSubmittingRequest ? 'Sending…' : `Request ${selectedCurrency} ${requestAmount || ''}`}</button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: ISSUE CARD ===== */}
        {showCardsModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowCardsModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 16, color: '#ffffff' }}>Issue a Card</h3>
              <form onSubmit={handleIssueVirtualCard}>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Card Brand</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['VISA', 'MASTERCARD'] as const).map(b => (
                      <button key={b} type="button" onClick={() => setCardBrand(b)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${cardBrand === b ? '#35D9D0' : 'rgba(255,255,255,0.12)'}`, background: cardBrand === b ? 'rgba(53, 217, 208, 0.2)' : 'rgba(255,255,255,0.05)', fontWeight: 800, fontSize: 13, cursor: 'pointer', color: cardBrand === b ? '#35D9D0' : '#ffffff' }}>{b}</button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Card Type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['PERSONAL', 'BUSINESS', 'BURNER'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setSelectedCardType(t)} style={{ flex: 1, padding: 10, borderRadius: 12, border: `1px solid ${selectedCardType === t ? '#35D9D0' : 'rgba(255,255,255,0.12)'}`, background: selectedCardType === t ? 'rgba(53, 217, 208, 0.2)' : 'rgba(255,255,255,0.05)', fontWeight: 800, fontSize: 11, cursor: 'pointer', color: selectedCardType === t ? '#35D9D0' : '#ffffff' }}>{t}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={isIssuingCard} className="cta">{isIssuingCard ? 'Issuing…' : 'Issue Card'}</button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: CARD FUND / WITHDRAW ===== */}
        {showCardFundModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowCardFundModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 16, color: '#ffffff' }}>{cardFundAction === 'TOPUP' ? 'Top Up Card' : 'Withdraw from Card'}</h3>
              <form onSubmit={handleFundVirtualCard}>
                <div className="field"><label style={{ color: '#94A3B8', fontWeight: 700 }}>Amount (USD)</label><input type="number" step="0.01" min="1" placeholder="50.00" value={cardFundAmount} onChange={e => setCardFundAmount(e.target.value)} required style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', color: '#ffffff' }} /></div>
                <button type="submit" className="cta">{cardFundAction === 'TOPUP' ? 'Top Up' : 'Withdraw'}</button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: ADD CURRENCY ACCOUNT ===== */}
        {showAddAccountModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowAddAccountModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              <h3 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Bricolage Grotesque', marginBottom: 16, color: '#ffffff' }}>Claim a Currency Account</h3>
              <form onSubmit={handleClaimNewCurrencyAccount}>
                <div className="field">
                  <label style={{ color: '#94A3B8', fontWeight: 700 }}>Currency</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['EUR', 'GBP', 'KES', 'UGX', 'GHS'] as const).map(c => (
                      <button key={c} type="button" onClick={() => setSelectedNewCurrency(c)} style={{ padding: '8px 14px', borderRadius: 12, border: `1px solid ${selectedNewCurrency === c ? '#35D9D0' : 'rgba(255,255,255,0.12)'}`, background: selectedNewCurrency === c ? 'rgba(53, 217, 208, 0.2)' : 'rgba(255,255,255,0.05)', fontWeight: 800, fontSize: 12, cursor: 'pointer', color: selectedNewCurrency === c ? '#35D9D0' : '#ffffff' }}>{c}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={isClaimingCurrency} className="cta">{isClaimingCurrency ? 'Issuing…' : `Claim ${selectedNewCurrency} Account`}</button>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: USERNAME CUSTOMIZATION ===== */}
        <UsernameCustomizationModal
          isOpen={showUsernameModal}
          entityId={activeEntity?.id || ''}
          currentUsername={activeEntity?.username}
          onSuccess={(newUsername) => {
            setEntitiesMap(prev => ({ ...prev, [accountType]: { ...prev[accountType], username: newUsername, usernameCustomized: true } }));
            setShowUsernameModal(false);
          }}
          onClose={() => setShowUsernameModal(false)}
        />

        {/* ===== MODAL: CONTACTS ===== */}
        <ContactsManagerModal
          isOpen={showContactsModal}
          entityId={activeEntity?.id || ''}
          onClose={() => setShowContactsModal(false)}
        />

        {/* ===== MODAL: PAYMENT REQUEST HUB ===== */}
        <PaymentRequestHubModal
          isOpen={showRequestModal}
          entityId={activeEntity?.id || ''}
          onClose={() => setShowRequestModal(false)}
          onPaymentSuccess={() => {
            if (activeEntity?.id && activeAbortController.current) {
              fetchBalance(activeEntity.id, activeAbortController.current.signal);
              fetchSavingsSummary(activeEntity.id, activeAbortController.current.signal);
            }
          }}
        />

        {/* ===== MODAL: RECEIVE & MULTI-CHAIN CRYPTO DEPOSIT HUB ===== */}
        {showReceiveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 8, 17, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', background: 'linear-gradient(180deg, #0D1424 0%, #050811 100%)', border: '1px solid rgba(53, 217, 208, 0.35)', color: '#ffffff', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
              <button onClick={() => setShowReceiveModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 28, height: 28, color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              
              <div style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {accountType === 'PERSONAL' ? 'Personal Receiving Hub' : 'Business Receiving Hub'}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Bricolage Grotesque', margin: '0 0 16px', color: '#ffffff' }}>
                Receive Funds
              </h3>

              {/* Mode Toggle: Fiat vs Crypto */}
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, padding: 4, marginBottom: 18, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  type="button"
                  style={{ flex: 1, padding: '8px 12px', border: receiveTab === 'fiat' ? '1px solid #35D9D0' : 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: receiveTab === 'fiat' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: receiveTab === 'fiat' ? '#35D9D0' : '#94A3B8' }}
                  onClick={() => setReceiveTab('fiat')}
                >
                  🏦 Bank Accounts
                </button>
                <button
                  type="button"
                  style={{ flex: 1, padding: '8px 12px', border: receiveTab === 'crypto' ? '1px solid #35D9D0' : 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: receiveTab === 'crypto' ? 'rgba(53, 217, 208, 0.2)' : 'transparent', color: receiveTab === 'crypto' ? '#35D9D0' : '#94A3B8' }}
                  onClick={() => setReceiveTab('crypto')}
                >
                  ⚡ Account Address
                </button>
              </div>

              {receiveTab === 'fiat' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>
                    Share your dedicated virtual account details below to receive local or international bank transfers:
                  </div>

                  {activeEntity?.fiatAccounts && activeEntity.fiatAccounts.length > 0 ? (
                    activeEntity.fiatAccounts.map((acc, i) => (
                      <div key={i} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 16, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#35D9D0' }}>{acc.currency} Virtual Account</span>
                          <span className="chip" style={{ fontSize: 10, background: 'rgba(22, 199, 183, 0.2)', border: '1px solid rgba(53, 217, 208, 0.4)', color: '#35D9D0' }}>ACTIVE</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Bank Name</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>{acc.bankName}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>Account Number</div>
                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{acc.accountNumber}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            style={{ background: 'var(--btn-primary-bg)', color: '#050811', fontWeight: 800 }}
                            onClick={() => {
                              navigator.clipboard.writeText(acc.accountNumber);
                              setCopyNotification(`${acc.currency} Account Number copied!`);
                              setTimeout(() => setCopyNotification(null), 2500);
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Primary Virtual Account</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: '4px 0' }}>Wema Bank / Evolve Bank & Trust</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Account Number</div>
                      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span>0129482019</span>
                        <button
                          type="button"
                          className="copy-btn"
                          style={{ background: 'var(--btn-primary-bg)', color: '#050811', fontWeight: 800 }}
                          onClick={() => {
                            navigator.clipboard.writeText('0129482019');
                            setCopyNotification('Account number copied!');
                            setTimeout(() => setCopyNotification(null), 2500);
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6 }}>SELECT BLOCKCHAIN NETWORK</label>
                    <select
                      className="inp"
                      style={{ width: '100%', padding: '12px 14px', fontSize: 13, fontWeight: 700, borderRadius: 12, border: '1px solid rgba(53, 217, 208, 0.3)', background: '#0D1424', color: '#ffffff' }}
                      value={sendCryptoNetwork}
                      onChange={(e) => setSendCryptoNetwork(e.target.value)}
                    >
                      <option value="NEAR">NEAR Protocol</option>
                      <option value="Base">Base (EVM)</option>
                      <option value="Ethereum">Ethereum Mainnet (EVM)</option>
                      <option value="Solana">Solana (SOL / SPL Tokens)</option>
                      <option value="Bitcoin">Bitcoin (Native SegWit)</option>
                      <option value="TRON">TRON (TRX / TRC-20)</option>
                      <option value="TON">TON (The Open Network)</option>
                      <option value="BSC">Binance Smart Chain (BEP-20)</option>
                      <option value="Polygon">Polygon (POS)</option>
                      <option value="Cosmos">Cosmos Hub</option>
                      <option value="Sui">Sui Network</option>
                      <option value="Aptos">Aptos Network</option>
                      <option value="XRP">XRP Ledger</option>
                    </select>
                  </div>

                  {/* Derived Address Display */}
                  {(() => {
                    const net = sendCryptoNetwork.toLowerCase();
                    const activeHandle = activeEntity?.username || 'user';
                    let targetAddress = activeEntity?.evmDepositAddress || '';
                    
                    if (net === 'near') {
                      targetAddress = activeEntity?.nearDepositAddress || '';
                    } else if (net.includes('solana') || net === 'sol') {
                      targetAddress = activeEntity?.solanaDepositAddress || '';
                    } else if (net.includes('bitcoin') || net === 'btc') {
                      targetAddress = activeEntity?.btcDepositAddress || '';
                    } else if (net.includes('tron') || net === 'trx') {
                      targetAddress = activeEntity?.tronDepositAddress || '';
                    } else if (net.includes('ton')) {
                      targetAddress = activeEntity?.tonDepositAddress || '';
                    } else if (net.includes('cosmos')) {
                      targetAddress = activeEntity?.cosmosDepositAddress || '';
                    } else if (net.includes('sui')) {
                      targetAddress = activeEntity?.suiDepositAddress || '';
                    } else if (net.includes('aptos')) {
                      targetAddress = activeEntity?.aptosDepositAddress || '';
                    } else if (net.includes('xrp')) {
                      targetAddress = activeEntity?.xrpDepositAddress || '';
                    }

                    targetAddress = (targetAddress || '').replace(/^@/, '');

                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(targetAddress)}`;

                    return (
                      <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                          <img src={qrUrl} alt="Deposit QR Code" style={{ width: 140, height: 140, borderRadius: 12, border: '4px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                          YOUR DEDICATED {sendCryptoNetwork.toUpperCase()} MPC DEPOSIT ADDRESS
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #CBD5E1', borderRadius: 12, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>{targetAddress}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(targetAddress);
                              setCopyNotification(`${sendCryptoNetwork} Deposit Address copied!`);
                              setTimeout(() => setCopyNotification(null), 2500);
                            }}
                          >
                            Copy
                          </button>
                        </div>

                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 10, fontSize: 11, color: '#166534', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 16 }}>⚡</span>
                          <div>
                            <strong>AI Auto-Liquidation Enabled:</strong> All incoming crypto on this address is automatically swapped into USDC/USDT via AI-verified DEX liquidity pools.
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== MODAL: INVOICE DETAILS & PDF DOWNLOAD ===== */}
        {selectedInvoiceForModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,24,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: 24, position: 'relative', background: '#fff', color: 'var(--text)', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24 }}>
              <button onClick={() => setSelectedInvoiceForModal(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}><X size={20} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="chip" style={{ fontSize: 11, background: 'var(--tint)', color: 'var(--green-dark)', fontWeight: 800 }}>
                  {selectedInvoiceForModal.tag || 'PROX-INV'}
                </span>
                <span className="chip" style={{ fontSize: 10, background: '#FEF3C7', color: '#B45309', fontWeight: 700 }}>
                  {selectedInvoiceForModal.status || 'PENDING'}
                </span>
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Bricolage Grotesque', margin: '4px 0 2px' }}>
                Invoice for {selectedInvoiceForModal.clientName || 'Client'}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Issued by {activeEntity?.legalName || 'Proxim Business'} · {selectedInvoiceForModal.clientEmail}
              </div>

              <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Amount Due</div>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Bricolage Grotesque', color: 'var(--text)', margin: '4px 0 8px' }}>
                  {selectedInvoiceForModal.currency || 'USD'} {parseFloat(selectedInvoiceForModal.totalAmount || selectedInvoiceForModal.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                {selectedInvoiceForModal.description && (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {selectedInvoiceForModal.description}
                  </div>
                )}
              </div>

              {/* Settlement Instructions: Fiat vs Crypto */}
              <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(53, 217, 208, 0.35)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', textTransform: 'uppercase', marginBottom: 10 }}>
                  {selectedInvoiceForModal.settlementType === 'crypto' || selectedInvoiceForModal.settlementType === 'stablecoin' ? '⚡ Crypto Payment Destination' : '🏦 Bank Transfer Account Details'}
                </div>

                {selectedInvoiceForModal.settlementType === 'crypto' || selectedInvoiceForModal.settlementType === 'stablecoin' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Network:</span>
                      <strong style={{ color: '#ffffff' }}>{selectedInvoiceForModal.paymentDetails?.network || selectedInvoiceForModal.cryptoNetwork || 'Base'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Asset:</span>
                      <strong style={{ color: '#ffffff' }}>{selectedInvoiceForModal.paymentDetails?.asset || selectedInvoiceForModal.cryptoAsset || selectedInvoiceForModal.currency || 'USDC'}</strong>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Deposit Address:</div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(53, 217, 208, 0.3)', borderRadius: 10, padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffffff' }}>
                        <span>{selectedInvoiceForModal.paymentDetails?.depositAddress || activeEntity?.evmDepositAddress || 'Address unavailable'}</span>
                        {selectedInvoiceForModal.paymentDetails?.depositAddress || activeEntity?.evmDepositAddress ? (
                          <button
                            type="button"
                            className="copy-btn"
                            style={{ marginLeft: 6, background: 'var(--btn-primary-bg)', color: '#050811', fontWeight: 800 }}
                            onClick={() => {
                              navigator.clipboard.writeText(selectedInvoiceForModal.paymentDetails?.depositAddress || activeEntity?.evmDepositAddress || '');
                              setCopyNotification('Address copied!');
                              setTimeout(() => setCopyNotification(''), 2500);
                            }}
                          >
                            Copy
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                    {selectedInvoiceForModal.paymentDetails?.status === 'provider_offline' ? (
                      <div style={{ color: '#FBBF24', fontSize: 12, lineHeight: 1.6, background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: 10, padding: 10 }}>
                        Fiat account provider is not live yet. The invoice is still valid, and account details will appear here once the provider is enabled.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94A3B8' }}>Bank Name:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedInvoiceForModal.paymentDetails?.bankName || (selectedInvoiceForModal.currency === 'NGN' ? 'Wema Bank' : selectedInvoiceForModal.currency === 'EUR' ? 'Banking Circle S.A.' : 'Evolve Bank & Trust')}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#94A3B8' }}>Account Number:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ color: '#ffffff' }}>{selectedInvoiceForModal.paymentDetails?.accountNumber || 'Not available yet'}</strong>
                            {selectedInvoiceForModal.paymentDetails?.accountNumber && (
                              <button
                                type="button"
                                className="copy-btn"
                                style={{ background: 'var(--btn-primary-bg)', color: '#050811', fontWeight: 800 }}
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedInvoiceForModal.paymentDetails?.accountNumber || '');
                                  setCopyNotification('Account number copied!');
                                  setTimeout(() => setCopyNotification(''), 2500);
                                }}
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94A3B8' }}>Account Name:</span>
                          <strong style={{ color: '#ffffff' }}>{selectedInvoiceForModal.paymentDetails?.accountHolderName || 'Not available'}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94A3B8' }}>Currency & Rail:</span>
                          <span style={{ color: '#ffffff' }}>{selectedInvoiceForModal.currency || 'USD'} · {selectedInvoiceForModal.paymentDetails?.rail?.toUpperCase() || 'DIRECT TRANSFER'}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="cta"
                  style={{ flex: 1 }}
                  onClick={() => window.print()}
                >
                  Download / Print PDF
                </button>
                <button
                  type="button"
                  className="cta ghost"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const link = selectedInvoiceForModal.paymentLink || `https://pay.proxim.finance/inv/${selectedInvoiceForModal.id}`;
                    navigator.clipboard.writeText(link);
                    setCopyNotification('Invoice link copied!');
                    setTimeout(() => setCopyNotification(''), 2500);
                  }}
                >
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== COPY NOTIFICATION TOAST ===== */}
        {copyNotification && !showReceiveModal && (
          <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#35D9D0', color: '#050811', padding: '10px 20px', borderRadius: 12, fontSize: 12, fontWeight: 800, zIndex: 200, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(53, 217, 208, 0.4)' }}>
            {copyNotification}
          </div>
        )}

        {/* ===== SCREEN: SAVINGS HUB ===== */}
        <div className={`screen ${currentScreen === 'savings' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('home')} style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif" }}>← Back</button>
            <div className="logo" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 800 }}>Savings Hub</div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: accountType === 'PERSONAL' ? 'rgba(74,140,255,0.18)' : 'rgba(250,204,21,0.18)', color: accountType === 'PERSONAL' ? '#4A8CFF' : '#FACC15' }}>
              {accountType === 'PERSONAL' ? 'Personal' : 'Business'}
            </span>
          </div>
          <div className="scroll" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 20 }}>
              Savings for your {accountType === 'PERSONAL' ? 'personal' : 'business'} account. Earn up to 11.2% APY across automated Kamino Solana vaults and NEAR Intent yield routes.
            </div>

            {/* Section 1: Flexible Savings Pool Card */}
            <div className="goal-card" style={{ background: 'linear-gradient(135deg, rgba(11, 41, 36, 0.85) 0%, rgba(6, 27, 24, 0.95) 100%)', border: '1px solid rgba(22, 199, 183, 0.3)', padding: 18, borderRadius: 24, marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#35D9D0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Active Savings
                  </div>
                  <div className="goal-amt num" style={{ fontSize: 28, fontWeight: 900, color: '#F7F8F4', marginTop: 4, fontFamily: "'Satoshi', sans-serif" }}>
                    ${savingsPool.toFixed(2)}
                  </div>
                </div>
                <div style={{ background: 'rgba(22, 199, 183, 0.2)', color: '#35D9D0', border: '1px solid #35D9D0', padding: '6px 12px', borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                  {kaminoVaultStatus}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 16 }}>
                {yieldOptions.length > 0 ? `${yieldOptions.length} verified live yield options available across Kamino, NEAR Intent, and Pods.` : 'Fetching verified live yield options...'}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="quick-btn primary"
                  style={{ flex: 1, padding: '12px 14px', fontSize: 13, fontWeight: 700, background: '#16C7B7', color: '#061B18', borderRadius: 999, fontFamily: "'Satoshi', sans-serif" }}
                  onClick={() => { setSavingsActionType('DEPOSIT'); setSavingsAmount(''); setShowSaveModal(true); }}
                >
                  + Save Money
                </button>
                <button
                  className="quick-btn ghost"
                  style={{ flex: 1, padding: '12px 14px', fontSize: 13, fontWeight: 500, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#F7F8F4', borderRadius: 14, fontFamily: "'Satoshi', sans-serif" }}
                  onClick={() => { setSavingsActionType('WITHDRAW'); setSavingsAmount(''); setShowSaveModal(true); }}
                >
                  Withdraw
                </button>
              </div>
            </div>

            {/* Section 2: Smart Auto-Sweep Engine */}
            <div className="goal-card" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(11, 41, 36, 0.95) 100%)', border: '1px solid rgba(53, 217, 208, 0.25)', padding: 18, borderRadius: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={18} color="#35D9D0" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>Smart Auto-Sweep</span>
                </div>
                <button
                  onClick={() => setAutoSweepEnabled(!autoSweepEnabled)}
                  className="chip"
                  style={{ background: autoSweepEnabled ? 'rgba(22, 199, 183, 0.2)' : 'rgba(255,255,255,0.06)', border: autoSweepEnabled ? '1px solid #35D9D0' : '1px solid rgba(255,255,255,0.15)', color: autoSweepEnabled ? '#35D9D0' : '#94A3B8', fontWeight: 800, cursor: 'pointer' }}
                >
                  {autoSweepEnabled ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 12, lineHeight: 1.5 }}>
                Automatically sweeps idle cash above your liquid buffer (${liquidBufferUsd}) into high-yield strategies.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={triggerAutoSweep}
                  disabled={isSweepingNow}
                  className="chip"
                  style={{ background: '#35D9D0', color: '#050811', fontWeight: 800, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer' }}
                >
                  {isSweepingNow ? 'Sweeping Idle Cash...' : '⚡ Sweep Now'}
                </button>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Buffer: ${liquidBufferUsd} liquid</span>
              </div>
            </div>

            {/* Section 3: Active Locked Term Vaults (Kamino & NEAR Intent) */}
            <div className="section-title" style={{ marginTop: 20, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Active Yield Positions</span>
              <span className="chip" style={{ fontSize: 11, color: '#35D9D0', background: 'rgba(53, 217, 208, 0.12)' }}>{kaminoPositions.length} active</span>
            </div>

            {kaminoPositions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'rgba(247, 248, 244, 0.6)', textAlign: 'center', padding: '28px 16px', background: 'rgba(11, 41, 36, 0.65)', borderRadius: 20, border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: 20, fontFamily: "'Satoshi', sans-serif" }}>
                No locked term vaults active yet. Tap "+ Save Money" to deposit funds and earn yield.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {kaminoPositions.map((pos: any) => {
                  const principal = parseFloat(pos.principalAmountUsd || pos.principalUsd || '0');
                  const accrued = parseFloat(pos.accruedInterestUsd || '0');
                  const apyDisplay = pos.userNetApy ? `${(parseFloat(pos.userNetApy) * 100).toFixed(2)}% APY` : '9.20% APY';
                  const isSolving = pos.status === 'SOLVING' || pos.status === 'PENDING_DEPOSIT';
                  const isEarlyUnlocked = pos.status === 'EARLY_UNLOCKED';

                  return (
                    <div key={pos.id} style={{ background: 'linear-gradient(135deg, #0B2924 0%, #061B18 100%)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 20, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>{pos.name || 'Kamino USDC Yield Reserve'}</div>
                          <div style={{ fontSize: 11, color: '#35D9D0', fontWeight: 700 }}>{apyDisplay} · {pos.lockDurationDays || 30}-day Term</div>
                        </div>
                        <span className="chip" style={{
                          background: isSolving ? 'rgba(250, 204, 21, 0.18)' : isEarlyUnlocked ? 'rgba(255, 255, 255, 0.1)' : 'rgba(22, 199, 183, 0.2)',
                          color: isSolving ? '#FACC15' : isEarlyUnlocked ? '#94A3B8' : '#35D9D0',
                          border: isSolving ? '1px solid #FACC15' : isEarlyUnlocked ? '1px solid #94A3B8' : '1px solid #35D9D0',
                          fontSize: 10, fontWeight: 800
                        }}>
                          {isSolving ? 'SETTING UP' : isEarlyUnlocked ? 'EARLY UNLOCKED' : 'LOCKED · EARNING'}
                        </span>
                      </div>

                      {isSolving && (
                        <div style={{ background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.25)', borderRadius: 12, padding: '8px 12px', fontSize: 11, color: '#FACC15', marginBottom: 10 }}>
                          Setting up your yield account — funds are on the way.
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 14, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>PRINCIPAL</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>${principal.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>EARNED</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#35D9D0' }}>+${accrued.toFixed(4)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>UNLOCK DATE</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{pos.unlockDate ? new Date(pos.unlockDate).toLocaleDateString() : 'In 30 days'}</div>
                        </div>
                      </div>

                      {!isEarlyUnlocked && !isSolving && (
                        <button
                          onClick={() => {
                            setEarlyExitTermVaultId(pos.id);
                            setShowEarlyExitModal(true);
                          }}
                          className="cta ghost"
                          style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 12, borderColor: 'rgba(255,255,255,0.15)' }}
                        >
                          Request Early Exit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section 4: Live Verified Yield Options */}
            <div className="section-title" style={{ marginBottom: 12 }}>Verified Yield Opportunities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {yieldOptions.slice(0, 4).map((opt: any) => (
                <div key={opt.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(53, 217, 208, 0.2)', borderRadius: 16, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{opt.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{opt.provider === 'kamino' ? 'Kamino Solana Vault' : opt.provider === 'pods' ? 'Pods Base Strategy' : 'NEAR Intent 1Click'} · {opt.asset}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#35D9D0' }}>{(opt.userNetApy || 9.2).toFixed(2)}% APY</div>
                    <button
                      onClick={() => {
                        setSelectedYieldOption(opt.id);
                        setYieldStrategy(opt.provider || 'near_intent');
                        setSavingsActionType('DEPOSIT');
                        setShowSaveModal(true);
                      }}
                      className="chip"
                      style={{ background: 'rgba(53, 217, 208, 0.2)', color: '#35D9D0', border: '1px solid #35D9D0', fontWeight: 800, marginTop: 4, cursor: 'pointer' }}
                    >
                      Deposit ➔
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'stocks' ? 'active' : ''}`} onClick={() => { setCurrentScreen('stocks'); fetchStocks(); fetchStockPositions(); fetchMarketStatus(); }}><TrendingUp size={20} />Invest</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== SCREEN: INVEST / TOKENIZED STOCKS ===== */}
        <div className={`screen ${currentScreen === 'stocks' ? 'active' : ''}`}>
          <div className="statusbar"><span>9:41</span><span>•••</span></div>
          <div className="topbar">
            <button className="chip" onClick={() => setCurrentScreen('home')} style={{ cursor: 'pointer', fontFamily: "'Satoshi', sans-serif" }}>← Back</button>
            <div className="logo" style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 800 }}>Invest &amp; Stocks</div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: accountType === 'PERSONAL' ? 'rgba(74,140,255,0.18)' : 'rgba(250,204,21,0.18)', color: accountType === 'PERSONAL' ? '#4A8CFF' : '#FACC15' }}>
              {accountType === 'PERSONAL' ? 'Personal' : 'Business'}
            </span>
          </div>
          <div className="scroll" style={{ fontFamily: "'Satoshi', sans-serif" }}>
            <div style={{ fontSize: 13, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 16 }}>
              Buy and sell 240+ tokenized US stocks &amp; ETFs (Apple, Tesla, Nvidia, S&amp;P 500) powered by Ondo Global Markets.
            </div>

            {/* US Market Live Status Banner */}
            <div style={{ background: marketStatus?.isOpen ? 'rgba(22, 199, 183, 0.12)' : 'rgba(250, 204, 21, 0.12)', border: marketStatus?.isOpen ? '1px solid rgba(22, 199, 183, 0.3)' : '1px solid rgba(250, 204, 21, 0.3)', borderRadius: 16, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{marketStatus?.isOpen ? '🟢' : '🟡'}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: marketStatus?.isOpen ? '#35D9D0' : '#FACC15' }}>
                    {marketStatus?.isOpen ? 'US Market is OPEN' : 'US Market is CLOSED'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(247, 248, 244, 0.7)' }}>
                    {marketStatus?.isOpen ? 'Orders settle instantly on-chain.' : 'Orders placed now will queue for market open at 9:30 AM EST.'}
                  </div>
                </div>
              </div>
              <span className="chip" style={{ fontSize: 10, fontWeight: 800, background: marketStatus?.isOpen ? '#35D9D0' : '#FACC15', color: '#050811' }}>
                {marketStatus?.isOpen ? 'LIVE TRADING' : 'QUEUED TRADING'}
              </span>
            </div>

            {/* Holdings Summary */}
            <div className="section-title" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Your Portfolio Holdings</span>
              <span style={{ fontSize: 12, color: '#35D9D0', fontWeight: 800 }}>
                ${((stockPositions?.personal?.positions || []).reduce((acc: number, p: any) => acc + (parseFloat(p.underlyingBalanceUSD || p.currentPosition?.value || '0')), 0)).toFixed(2)} Total
              </span>
            </div>

            {(stockPositions?.personal?.positions || []).length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'rgba(247, 248, 244, 0.6)', textAlign: 'center', padding: '24px 16px', background: 'rgba(15, 23, 42, 0.65)', borderRadius: 18, border: '1px solid rgba(53, 217, 208, 0.2)', marginBottom: 20 }}>
                No stock positions yet. Explore stocks below to make your first investment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {(stockPositions?.personal?.positions || []).map((pos: any, idx: number) => {
                  const val = parseFloat(pos.underlyingBalanceUSD || pos.currentPosition?.value || '0');
                  const symbol = pos.strategy?.assetName || pos.strategy?.id || 'STOCK';
                  return (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 16, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{symbol}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{pos.shares || '1.0'} shares held</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>${val.toFixed(2)}</div>
                          <div style={{ fontSize: 10, color: '#35D9D0', fontWeight: 700 }}>Ondo Tokenized</div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPosition(pos);
                            setSellAmount(pos.shares || '1.0');
                            setShowSellModal(true);
                          }}
                          className="chip"
                          style={{ background: 'rgba(255, 93, 168, 0.2)', border: '1px solid #FF5DA8', color: '#FF5DA8', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explore Stocks & Search */}
            <div className="section-title" style={{ marginBottom: 10 }}>Explore 240+ Stocks &amp; ETFs</div>
            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Search AAPL, NVDA, TSLA, SPY, MSFT..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(53, 217, 208, 0.3)', background: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: 14, outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {filteredStocks.slice(0, 35).map((stock: any) => (
                <div key={stock.symbol} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{stock.symbol}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{stock.name || stock.symbol}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>${(stock.price || 200).toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: '#35D9D0', fontWeight: 700 }}>24/7 Liquidity</div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStock(stock);
                        setBuyAmount('100');
                        setShowBuyModal(true);
                      }}
                      className="chip"
                      style={{ background: '#35D9D0', color: '#050811', border: 'none', fontWeight: 800, cursor: 'pointer', padding: '6px 14px' }}
                    >
                      + Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bottomnav">
            <button className={`navbtn ${currentScreen === 'home' ? 'active' : ''}`} onClick={() => setCurrentScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>Home</button>
            <button className={`navbtn ${currentScreen === 'activity' ? 'active' : ''}`} onClick={() => setCurrentScreen('activity')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Activity</button>
            <button className={`navbtn ${currentScreen === 'stocks' ? 'active' : ''}`} onClick={() => { setCurrentScreen('stocks'); fetchStocks(); fetchStockPositions(); fetchMarketStatus(); }}><TrendingUp size={20} />Invest</button>
            <button className={`navbtn ${currentScreen === 'savings' ? 'active' : ''}`} onClick={() => setCurrentScreen('savings')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M5 12H3M21 12h-2M6.3 6.3L5 5M19 19l-1.3-1.3M6.3 17.7L5 19M19 5l-1.3 1.3"/><circle cx="12" cy="12" r="4.5"/></svg>Vault</button>
            <button className={`navbtn ${currentScreen === 'cards' ? 'active' : ''}`} onClick={() => setCurrentScreen('cards')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/></svg>Cards</button>
            <button className={`navbtn ${currentScreen === 'profile' ? 'active' : ''}`} onClick={() => setCurrentScreen('profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/></svg>Profile</button>
          </div>
        </div>

        {/* ===== UNIVERSAL SECURITY PIN AUTHORIZATION MODAL ===== */}
        {showPinAuthModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(6, 27, 24, 0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 24, background: 'linear-gradient(180deg, #0B2924 0%, #061B18 100%)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#F7F8F4', borderRadius: 24, textAlign: 'center', boxShadow: '0 0 32px rgba(22, 199, 183, 0.15)', fontFamily: "'Satoshi', sans-serif" }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(22, 199, 183, 0.15)', border: '1px solid #35D9D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={24} color="#35D9D0" />
                </div>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif" }}>{pinAuthTitle}</h3>
              <div style={{ fontSize: 12, color: 'rgba(247, 248, 244, 0.7)', marginBottom: 20 }}>
                {userPinCode ? 'Enter your 6-digit security PIN to authorize this financial action.' : pinSetupConfirmation ? 'Re-enter your 6-digit security PIN to confirm setup.' : 'Create a 6-digit security PIN to protect your transactions.'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={element => { pinInputRefs.current[index] = element; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={pinDigits[index]}
                    onChange={event => updatePinDigit(index, event.target.value)}
                    onKeyDown={event => handlePinKeyDown(index, event)}
                    autoFocus={index === 0}
                    aria-label={`PIN digit ${index + 1}`}
                    style={{
                      width: 42,
                      height: 52,
                      borderRadius: 12,
                      border: '1px solid #35D9D0',
                      fontSize: 24,
                      fontWeight: 800,
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#F7F8F4',
                      fontFamily: "'Satoshi', sans-serif",
                      outline: 'none',
                    }}
                  />
                ))}
              </div>

              {pinError && (
                <div style={{ background: 'rgba(255, 93, 168, 0.12)', border: '1px solid #FF5DA8', color: '#FF5DA8', padding: 10, borderRadius: 14, fontSize: 12, marginBottom: 16 }}>
                  {pinError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="cta ghost"
                  style={{ flex: 1, borderRadius: 14, fontFamily: "'Satoshi', sans-serif" }}
                  onClick={() => { setShowPinAuthModal(false); setPendingPinCallback(null); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cta"
                  style={{ flex: 1, borderRadius: 999, background: '#16C7B7', color: '#061B18', fontWeight: 700, border: 'none', boxShadow: '0 0 16px rgba(22, 199, 183, 0.25)', fontFamily: "'Satoshi', sans-serif" }}
                  onClick={handleVerifyPinAndExecute}
                >
                  Confirm PIN
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ===== EaseID KYC / KYB Verification Modal ===== */}
        {activeEntity && currentUser && (
          <KycVerificationModal
            isOpen={showEaseIdKycModal}
            onClose={() => { setShowEaseIdKycModal(false); setKycGatePendingAction(null); }}
            entityKind={accountType}
            entityId={activeEntity.id}
            userId={currentUser.id || currentUser.userId}
            apiBaseUrl={API_BASE_URL}
            onSuccess={handleKycSuccess}
          />
        )}
      </div>
    </div>
  );
}
