/**
 * KycVerificationModal — Proxim Just-In-Time Identity Verification
 *
 * Triggered when a user attempts a fiat action (Deposit / Send to Bank)
 * or taps the Home banner. Covers two flows:
 *   - Personal KYC: NIN/BVN lookup + Liveness check
 *   - Business KYB: Director EaseID + CAC registration form
 *
 * Design: Proxim Aurora brand, dark glassmorphism, step-by-step
 */

import React, { useState, useCallback } from 'react';
import {
  Shield,
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  Building2,
  User,
  Fingerprint,
  ArrowRight,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KycVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Whether we are verifying the PERSONAL or BUSINESS entity */
  entityKind: 'PERSONAL' | 'BUSINESS';
  entityId: string;
  userId: string;
  apiBaseUrl: string;
  /** Called with the updated entity/accounts data when verification succeeds */
  onSuccess: (result: KycSuccessResult) => void;
}

interface KycSuccessResult {
  status: 'approved' | 'under_review';
  legalName: string;
  fiatAccounts: any[];
  message: string;
}

type PersonalStep = 'explain' | 'lookup' | 'preview' | 'liveness' | 'result';
type BusinessStep = 'explain' | 'director' | 'company' | 'result';

// ─── Personal KYC Steps ───────────────────────────────────────────────────────

const PERSONAL_STEPS: PersonalStep[] = ['explain', 'lookup', 'preview', 'liveness', 'result'];

// ─── Business KYB Steps ───────────────────────────────────────────────────────

const BUSINESS_STEPS: BusinessStep[] = ['explain', 'director', 'company', 'result'];

// ─── Main Component ───────────────────────────────────────────────────────────

export const KycVerificationModal: React.FC<KycVerificationModalProps> = ({
  isOpen,
  onClose,
  entityKind,
  entityId,
  userId,
  apiBaseUrl,
  onSuccess,
}) => {
  // ── State ────────────────────────────────────────────────────────────────
  const [personalStep, setPersonalStep] = useState<PersonalStep>('explain');
  const [businessStep, setBusinessStep] = useState<BusinessStep>('explain');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Personal lookup fields
  const [idType, setIdType] = useState<'nin' | 'bvn'>('nin');
  const [idValue, setIdValue] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [kycVerificationId, setKycVerificationId] = useState('');
  const [identityPreview, setIdentityPreview] = useState<any>(null);
  const [livenessSessionUrl, setLivenessSessionUrl] = useState('');
  const [livenessToken, setLivenessToken] = useState('');
  const [livenessPolling, setLivenessPolling] = useState(false);

  // Business KYB fields
  const [directorIdType, setDirectorIdType] = useState<'nin' | 'bvn'>('nin');
  const [directorIdValue, setDirectorIdValue] = useState('');
  const [businessLegalName, setBusinessLegalName] = useState('');
  const [businessTag, setBusinessTag] = useState('');
  const [rcNumber, setRcNumber] = useState('');
  const [rcType, setRcType] = useState<'RC' | 'BN' | 'IT'>('RC');
  const [tin, setTin] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [industryCategory, setIndustryCategory] = useState('');

  // Result
  const [successResult, setSuccessResult] = useState<KycSuccessResult | null>(null);

  const api = useCallback(
    async (endpoint: string, body: any) => {
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('proxim_auth_token') || ''}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      return data;
    },
    [apiBaseUrl],
  );

  const resetAll = () => {
    setPersonalStep('explain');
    setBusinessStep('explain');
    setErrorMsg('');
    setIdValue('');
    setVerificationId('');
    setKycVerificationId('');
    setIdentityPreview(null);
    setLivenessSessionUrl('');
    setLivenessToken('');
    setSuccessResult(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // ── Personal KYC Handlers ─────────────────────────────────────────────────

  const handleLookup = async () => {
    if (!idValue.trim()) {
      setErrorMsg(`Please enter your ${idType.toUpperCase()}.`);
      return;
    }
    const sanitized = idValue.replace(/\s+/g, '');
    if (idType === 'nin' && sanitized.length !== 11) {
      setErrorMsg('NIN must be exactly 11 digits.');
      return;
    }
    if (idType === 'bvn' && sanitized.length !== 11) {
      setErrorMsg('BVN must be exactly 11 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await api('/api/kyc/lookup', {
        userId,
        entityId,
        type: idType,
        value: sanitized,
      });

      setVerificationId(data.verificationId);
      setKycVerificationId(data.kycVerificationId);
      setIdentityPreview(data);
      setPersonalStep('preview');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLiveness = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await api('/api/kyc/liveness/create', {
        entityId,
        verificationId,
      });

      setLivenessSessionUrl(data.sessionUrl);
      setLivenessToken(data.sessionToken);
      setPersonalStep('liveness');

      // Open liveness URL in popup so user can complete the selfie
      window.open(data.sessionUrl, 'easeid_liveness', 'width=480,height=720,resizable=yes');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLiveness = async () => {
    setLivenessPolling(true);
    setErrorMsg('');
    try {
      const data = await api('/api/kyc/liveness/verify', {
        userId,
        entityId,
        sessionToken: livenessToken,
        verificationId,
        kycVerificationId,
        fullName: identityPreview?.fullName,
        firstName: identityPreview?.firstName,
        lastName: identityPreview?.lastName,
        dateOfBirth: identityPreview?.dateOfBirth,
        nin: idType === 'nin' ? idValue : undefined,
        bvn: idType === 'bvn' ? idValue : undefined,
        phone: identityPreview?.phoneNumber,
      });

      const result: KycSuccessResult = {
        status: data.status === 'approved' ? 'approved' : 'under_review',
        legalName: data.legalName || identityPreview?.fullName || '',
        fiatAccounts: data.fiatAccounts || [],
        message: data.message || 'Verification complete.',
      };
      setSuccessResult(result);
      setPersonalStep('result');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLivenessPolling(false);
    }
  };

  // ── Business KYB Handlers ─────────────────────────────────────────────────

  const handleBusinessSubmit = async () => {
    if (!businessLegalName.trim() || !rcNumber.trim()) {
      setErrorMsg('Business name and registration number are required.');
      return;
    }
    if (!directorIdValue.trim()) {
      setErrorMsg(`Director's ${directorIdType.toUpperCase()} is required.`);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await api('/api/kyc/submit-tier2', {
        userId,
        entityId,
        businessLegalName: businessLegalName.trim(),
        businessTag: businessTag.trim(),
        rcNumber: `${rcType}-${rcNumber.trim()}`,
        tin: tin.trim(),
        businessAddress: businessAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        industryCategory: industryCategory.trim(),
        uboNin: directorIdType === 'nin' ? directorIdValue : undefined,
        uboBvn: directorIdType === 'bvn' ? directorIdValue : undefined,
      });

      const result: KycSuccessResult = {
        status: data.status === 'approved' ? 'approved' : 'under_review',
        legalName: data.businessLegalName || businessLegalName,
        fiatAccounts: data.fiatAccounts || [],
        message: data.message || 'Business verification complete.',
      };
      setSuccessResult(result);
      setBusinessStep('result');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalDone = () => {
    if (successResult) {
      onSuccess(successResult);
    }
    handleClose();
  };

  // ── Render Guards ─────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // ─── Shared UI Primitives ─────────────────────────────────────────────────

  const TrustBadge: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.06)', borderRadius: 20,
      padding: '5px 12px', fontSize: 11, color: '#a0aec0',
    }}>
      {icon}<span>{label}</span>
    </div>
  );

  const StepDot: React.FC<{ active: boolean; done: boolean }> = ({ active, done }) => (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: done ? '#2dd4bf' : active ? '#818cf8' : 'rgba(255,255,255,0.15)',
      transition: 'background 0.3s ease',
    }} />
  );

  const personalStepIndex = PERSONAL_STEPS.indexOf(personalStep);
  const businessStepIndex = BUSINESS_STEPS.indexOf(businessStep);

  // ─── Render Content by Step ───────────────────────────────────────────────

  const renderPersonalContent = () => {
    switch (personalStep) {
      // ── Explain ─────────────────────────────────────────────────────────
      case 'explain':
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(129,140,248,0.15))',
                border: '1px solid rgba(45,212,191,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Shield size={28} color="#2dd4bf" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>
                Unlock Local Banking
              </h2>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                To issue your dedicated Naira account and enable instant bank transfers, we need to verify your identity. This takes about 60 seconds.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
              <TrustBadge icon={<Lock size={11} />} label="Bank-Grade Encryption" />
              <TrustBadge icon={<Shield size={11} />} label="NDPR Compliant" />
              <TrustBadge icon={<CheckCircle2 size={11} />} label="Verified by EaseID" />
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 12,
              padding: 16, marginBottom: 24, border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                What you'll get
              </p>
              {[
                'Dedicated Providus/Safehaven NGN account',
                'Instant USD account for international payments',
                'On/Off ramp fiat ↔ crypto conversion',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <CheckCircle2 size={14} color="#2dd4bf" />
                  <span style={{ fontSize: 13, color: '#cbd5e1' }}>{item}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              Your data is encrypted and only shared with{' '}
              <span style={{ color: '#818cf8' }}>EaseID</span> for verification purposes.
              We do not store or sell your identity data.
            </p>

            <button onClick={() => { setErrorMsg(''); setPersonalStep('lookup'); }} style={primaryBtn}>
              Continue <ArrowRight size={16} />
            </button>
          </>
        );

      // ── NIN / BVN Lookup ────────────────────────────────────────────────
      case 'lookup':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: '0 0 6px' }}>
              Enter your ID number
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Use your NIN (National Identification Number) or BVN.
            </p>

            {/* ID Type Toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['nin', 'bvn'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setIdType(t); setIdValue(''); setErrorMsg(''); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
                    fontSize: 13, transition: 'all 0.2s',
                    background: idType === t ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.04)',
                    color: idType === t ? '#2dd4bf' : '#94a3b8',
                    outline: idType === t ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{idType === 'nin' ? 'NIN (11 digits)' : 'BVN (11 digits)'}</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder={idType === 'nin' ? 'e.g. 12345678901' : 'e.g. 22198765432'}
                value={idValue}
                onChange={(e) => { setIdValue(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
                style={inputStyle}
              />
            </div>

            {errorMsg && <ErrorBanner msg={errorMsg} />}

            <button onClick={handleLookup} disabled={isLoading} style={primaryBtn}>
              {isLoading ? <><Loader2 size={16} className="spin" /> Verifying…</> : <>Verify Identity <ArrowRight size={16} /></>}
            </button>
          </>
        );

      // ── Identity Preview ────────────────────────────────────────────────
      case 'preview':
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <CheckCircle2 size={40} color="#2dd4bf" style={{ marginBottom: 12 }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>
                Identity Found
              </h2>
              <p style={{ fontSize: 13, color: '#64748b' }}>Please confirm your details are correct.</p>
            </div>

            <div style={{
              background: 'rgba(45,212,191,0.06)', borderRadius: 12,
              border: '1px solid rgba(45,212,191,0.15)', padding: 16, marginBottom: 20,
            }}>
              {[
                ['Full Name', identityPreview?.fullName],
                ['Date of Birth', identityPreview?.dateOfBirth],
                ['Gender', identityPreview?.gender],
                ['Phone', identityPreview?.phoneNumber],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                  <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
              Next, we'll do a quick liveness check to confirm you're the account owner.
            </p>

            {errorMsg && <ErrorBanner msg={errorMsg} />}

            <button onClick={handleCreateLiveness} disabled={isLoading} style={primaryBtn}>
              {isLoading ? <><Loader2 size={16} /> Starting check…</> : <><Eye size={16} /> Start Liveness Check</>}
            </button>
          </>
        );

      // ── Liveness Check ──────────────────────────────────────────────────
      case 'liveness':
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              }}>
                <Fingerprint size={26} color="#818cf8" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>
                Selfie Liveness Check
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                A secure window has opened for your selfie. Please complete the check, then tap the button below.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 20,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px', fontWeight: 600 }}>Tips for a successful check:</p>
              {['Good lighting on your face', 'Remove glasses if possible', 'Look directly at the camera'].map((tip) => (
                <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#2dd4bf', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#cbd5e1' }}>{tip}</span>
                </div>
              ))}
            </div>

            {errorMsg && <ErrorBanner msg={errorMsg} />}

            <button onClick={handleVerifyLiveness} disabled={livenessPolling} style={primaryBtn}>
              {livenessPolling ? <><Loader2 size={16} /> Verifying result…</> : <>I've completed the check <ArrowRight size={16} /></>}
            </button>

            <button
              onClick={() => window.open(livenessSessionUrl, 'easeid_liveness', 'width=480,height=720')}
              style={ghostBtn}
            >
              Re-open the selfie window
            </button>
          </>
        );

      // ── Result ──────────────────────────────────────────────────────────
      case 'result':
        return <SuccessView result={successResult} onDone={handleFinalDone} />;

      default:
        return null;
    }
  };

  const renderBusinessContent = () => {
    switch (businessStep) {
      case 'explain':
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(45,212,191,0.15))',
                border: '1px solid rgba(129,140,248,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Building2 size={28} color="#818cf8" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>
                Register your Business
              </h2>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Get a dedicated business banking account for payroll, invoices, and corporate transfers.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 12,
              padding: 16, marginBottom: 24, border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                What you'll need
              </p>
              {[
                'Director\'s NIN or BVN',
                'CAC Registration Number (RC / BN / IT)',
                'Business legal name as registered with CAC',
                'Business address and industry',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <ChevronRight size={14} color="#818cf8" />
                  <span style={{ fontSize: 13, color: '#cbd5e1' }}>{item}</span>
                </div>
              ))}
            </div>

            <button onClick={() => { setErrorMsg(''); setBusinessStep('director'); }} style={primaryBtn}>
              Continue <ArrowRight size={16} />
            </button>
          </>
        );

      case 'director':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>
              Director Identity
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              The director or signatory responsible for this business account.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['nin', 'bvn'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setDirectorIdType(t); setDirectorIdValue(''); setErrorMsg(''); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
                    fontSize: 13, transition: 'all 0.2s',
                    background: directorIdType === t ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: directorIdType === t ? '#818cf8' : '#94a3b8',
                    outline: directorIdType === t ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  Director {t.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{directorIdType === 'nin' ? 'Director NIN' : 'Director BVN'}</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder="11-digit number"
                value={directorIdValue}
                onChange={(e) => { setDirectorIdValue(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
                style={inputStyle}
              />
            </div>

            {errorMsg && <ErrorBanner msg={errorMsg} />}

            <button
              onClick={() => {
                if (!directorIdValue || directorIdValue.length !== 11) {
                  setErrorMsg(`Director ${directorIdType.toUpperCase()} must be 11 digits.`);
                  return;
                }
                setErrorMsg('');
                setBusinessStep('company');
              }}
              style={primaryBtn}
            >
              Next: Company Details <ArrowRight size={16} />
            </button>
          </>
        );

      case 'company':
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>
              Company Registration
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Details must match your CAC registration exactly.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Business Legal Name</label>
              <input
                placeholder="e.g. Acme Innovations Limited"
                value={businessLegalName}
                onChange={(e) => setBusinessLegalName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Registration Type & Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={rcType}
                  onChange={(e) => setRcType(e.target.value as any)}
                  style={{ ...inputStyle, width: 80, flexShrink: 0 }}
                >
                  <option value="RC">RC</option>
                  <option value="BN">BN</option>
                  <option value="IT">IT</option>
                </select>
                <input
                  placeholder="e.g. 1849201"
                  value={rcNumber}
                  onChange={(e) => setRcNumber(e.target.value.replace(/\D/g, ''))}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>TIN (Tax ID — optional)</label>
              <input
                placeholder="e.g. 02345678-0001"
                value={tin}
                onChange={(e) => setTin(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Business Address</label>
              <input
                placeholder="Street address"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>City</label>
                <input placeholder="e.g. Lagos" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input placeholder="e.g. Lagos" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Industry Category</label>
              <select value={industryCategory} onChange={(e) => setIndustryCategory(e.target.value)} style={inputStyle}>
                <option value="">Select industry…</option>
                {['Technology', 'Finance & Banking', 'E-Commerce', 'Healthcare', 'Agriculture', 'Logistics', 'Education', 'Real Estate', 'Entertainment', 'Manufacturing', 'Other'].map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            {errorMsg && <ErrorBanner msg={errorMsg} />}

            <button onClick={handleBusinessSubmit} disabled={isLoading} style={primaryBtn}>
              {isLoading ? <><Loader2 size={16} /> Submitting…</> : <>Submit for Verification <ArrowRight size={16} /></>}
            </button>
            <button onClick={() => setBusinessStep('director')} disabled={isLoading} style={ghostBtn}>
              ← Back
            </button>
          </>
        );

      case 'result':
        return <SuccessView result={successResult} onDone={handleFinalDone} />;

      default:
        return null;
    }
  };

  // ─── Modal Shell ──────────────────────────────────────────────────────────

  const isPersonal = entityKind === 'PERSONAL';
  const currentStepIndex = isPersonal ? personalStepIndex : businessStepIndex;
  const totalSteps = isPersonal ? PERSONAL_STEPS.length : BUSINESS_STEPS.length;
  const isOnResult = isPersonal ? personalStep === 'result' : businessStep === 'result';

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        {/* Aurora Top Bar */}
        <div style={{
          height: 3, borderRadius: '12px 12px 0 0', marginBottom: 0,
          background: 'linear-gradient(90deg, #2dd4bf, #818cf8, #6366f1, #2dd4bf)',
          backgroundSize: '200% 100%',
          animation: 'aurora-sweep 4s ease infinite',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isPersonal ? <User size={16} color="#2dd4bf" /> : <Building2 size={16} color="#818cf8" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: 0.5 }}>
              {isPersonal ? 'PERSONAL VERIFICATION' : 'BUSINESS VERIFICATION'}
            </span>
          </div>
          {!isOnResult && (
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={18} color="#475569" />
            </button>
          )}
        </div>

        {/* Step progress dots */}
        {!isOnResult && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '12px 24px 0' }}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <StepDot key={i} active={i === currentStepIndex} done={i < currentStepIndex} />
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '20px 24px 28px', overflowY: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
          {isPersonal ? renderPersonalContent() : renderBusinessContent()}
        </div>
      </div>

      <style>{`
        @keyframes aurora-sweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ─── Success View ─────────────────────────────────────────────────────────────

const SuccessView: React.FC<{ result: KycSuccessResult | null; onDone: () => void }> = ({ result, onDone }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: result?.status === 'approved'
        ? 'linear-gradient(135deg, rgba(45,212,191,0.2), rgba(129,140,248,0.2))'
        : 'rgba(251,191,36,0.15)',
      border: `1px solid ${result?.status === 'approved' ? 'rgba(45,212,191,0.4)' : 'rgba(251,191,36,0.3)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 20px',
    }}>
      {result?.status === 'approved'
        ? <CheckCircle2 size={32} color="#2dd4bf" />
        : <AlertCircle size={32} color="#fbbf24" />}
    </div>

    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>
      {result?.status === 'approved' ? 'You\'re verified.' : 'Under review.'}
    </h2>
    <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24, lineHeight: 1.6 }}>
      {result?.message || 'Verification complete.'}
    </p>

    {result?.status === 'approved' && result.fiatAccounts.length > 0 && (
      <div style={{
        background: 'rgba(45,212,191,0.06)', borderRadius: 12,
        border: '1px solid rgba(45,212,191,0.15)', padding: 16, marginBottom: 24, textAlign: 'left',
      }}>
        <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Your accounts are ready
        </p>
        {result.fiatAccounts.map((acc: any) => (
          <div key={acc.id || acc.currency} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{acc.bankName}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{acc.currency} · {acc.rail?.toUpperCase()}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2dd4bf', fontFamily: 'monospace' }}>
              {acc.accountNumber}
            </div>
          </div>
        ))}
      </div>
    )}

    <button onClick={onDone} style={primaryBtn}>
      {result?.status === 'approved' ? 'Go to dashboard' : 'Got it'} <ArrowRight size={16} />
    </button>
  </div>
);

// ─── Error Banner ─────────────────────────────────────────────────────────────

const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10, padding: '10px 14px', marginBottom: 16,
    display: 'flex', alignItems: 'flex-start', gap: 10,
  }}>
    <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
    <p style={{ fontSize: 13, color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>{msg}</p>
  </div>
);

// ─── Shared Styles ────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1200,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};

const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: 'linear-gradient(180deg, #0f172a 0%, #0a0f1e 100%)',
  borderRadius: '20px 20px 0 0',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
  maxHeight: '90vh',
  overflow: 'hidden',
};

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '14px', borderRadius: 12,
  background: 'linear-gradient(135deg, #2dd4bf, #818cf8)',
  border: 'none', cursor: 'pointer',
  color: '#fff', fontWeight: 700, fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  marginBottom: 10, transition: 'opacity 0.2s',
};

const ghostBtn: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 12,
  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer', color: '#64748b', fontWeight: 500, fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#e2e8f0', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};
