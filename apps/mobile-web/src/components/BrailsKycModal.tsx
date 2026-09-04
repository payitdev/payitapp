import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  X,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../apiClient';

export interface BrailsKycSuccessResult {
  status: 'approved' | 'under_review';
  legalName: string;
  fiatAccounts: any[];
  message: string;
}

interface BrailsKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  userId: string;
  apiBaseUrl: string;
  initialValues?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
  };
  onSuccess: (result: BrailsKycSuccessResult) => void;
}

interface KycSchemaField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
}

interface KycSchemaSection {
  id: string;
  title: string;
  description?: string;
  fields: KycSchemaField[];
}

interface KycSchema {
  title: string;
  description: string;
  estimatedTimeMinutes?: number;
  currenciesSupported?: string[];
  sections: KycSchemaSection[];
}

export const BrailsKycModal: React.FC<BrailsKycModalProps> = ({
  isOpen,
  onClose,
  entityId,
  userId,
  apiBaseUrl,
  initialValues,
  onSuccess,
}) => {
  const [schema, setSchema] = useState<KycSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [schemaError, setSchemaError] = useState('');

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  const [successResult, setSuccessResult] = useState<BrailsKycSuccessResult | null>(null);

  // Fetch schema dynamically from API
  const fetchSchema = useCallback(async () => {
    setLoadingSchema(true);
    setSchemaError('');
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/kyc/schema?accountType=personal`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'We could not load the verification schema.');
      }
      setSchema(data.schema);

      // Prepopulate form values
      const initial: Record<string, string> = {};
      data.schema.sections.forEach((s: KycSchemaSection) => {
        s.fields.forEach((f: KycSchemaField) => {
          if (f.name === 'bank' && f.options && f.options.length > 0) {
            initial[f.name] = f.options[0].value;
          } else if (f.name === 'email' && initialValues?.email) {
            initial[f.name] = initialValues.email;
          } else if (f.name === 'firstName' && initialValues?.firstName) {
            initial[f.name] = initialValues.firstName;
          } else if (f.name === 'lastName' && initialValues?.lastName) {
            initial[f.name] = initialValues.lastName;
          } else if (f.name === 'phoneNumber' && initialValues?.phoneNumber) {
            initial[f.name] = initialValues.phoneNumber;
          } else {
            initial[f.name] = '';
          }
        });
      });
      setFormData(initial);
    } catch (err: any) {
      console.error('[BrailsKycModal] Failed to fetch schema:', err);
      setSchemaError(err.message || 'We could not load the verification schema. Please try again.');
    } finally {
      setLoadingSchema(false);
    }
  }, [apiBaseUrl, initialValues]);

  useEffect(() => {
    if (isOpen) {
      setSuccessResult(null);
      setErrorMsg('');
      fetchSchema();
    }
  }, [isOpen, fetchSchema]);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  // Poll status after submission
  const pollStatus = async (verificationId: string, maxAttempts = 20) => {
    setPolling(true);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await new Promise(r => setTimeout(r, 1500));
        const res = await apiFetch(`${apiBaseUrl}/api/kyc/verification-status?verificationId=${verificationId}`);
        const data = await res.json();

        if (data.status === 'approved') {
          const fiatAccounts = data.fiatAccounts || (data.virtualAccount ? [data.virtualAccount] : []);
          const result: BrailsKycSuccessResult = {
            status: 'approved',
            legalName: `${formData.firstName || ''} ${formData.lastName || ''}`.trim(),
            fiatAccounts,
            message: data.message || 'Your verification is approved and your Naira account is ready.',
          };
          setSuccessResult(result);
          setPolling(false);
          return;
        }

        if (data.status === 'rejected') {
          setPolling(false);
          setErrorMsg(data.message || 'We could not complete your verification. Please check your details.');
          return;
        }
      } catch (pollErr: any) {
        console.warn('[BrailsKycModal] Polling error:', pollErr.message);
      }
    }
    setPolling(false);
    setErrorMsg('Verification is taking longer than usual. Please check back in a moment.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schema) return;

    setErrorMsg('');

    // Schema validation
    for (const section of schema.sections) {
      for (const field of section.fields) {
        const val = (formData[field.name] || '').trim();
        if (field.required && !val) {
          setErrorMsg(`${field.label} is required.`);
          return;
        }
        if (field.pattern && val) {
          const regex = new RegExp(field.pattern);
          if (!regex.test(val)) {
            setErrorMsg(field.help || `Please enter a valid ${field.label.toLowerCase()}.`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/kyc/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          accountType: 'personal',
          formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'We could not submit your verification. Please try again.');
      }

      const verificationId = data.verificationId;
      setSubmitting(false);

      if (verificationId) {
        await pollStatus(verificationId);
      } else {
        throw new Error('No verification ID was returned.');
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || 'We could not submit your verification. Please try again.');
    }
  };

  const handleCopyAccount = (accNo: string) => {
    navigator.clipboard.writeText(accNo);
    setCopiedAccount(accNo);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleFinish = () => {
    if (successResult) {
      onSuccess(successResult);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        {/* Aurora top highlight bar */}
        <div style={auroraBarStyle} />

        {/* Modal Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={iconBadgeStyle}>
              <Shield size={16} color="#2dd4bf" />
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Instant Banking Setup
              </span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {successResult ? "You're Verified" : schema?.title || 'Open Your Personal Account'}
              </h2>
            </div>
          </div>
          {!submitting && !polling && (
            <button
              onClick={onClose}
              id="brails-kyc-close-btn"
              style={closeBtnStyle}
              aria-label="Close"
            >
              <X size={18} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={contentStyle}>
          {loadingSchema ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 size={32} color="#2dd4bf" className="spin" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Pulling verification schema...</p>
            </div>
          ) : schemaError ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <AlertCircle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>{schemaError}</p>
              <button onClick={fetchSchema} style={primaryBtnStyle}>
                Try again
              </button>
            </div>
          ) : successResult ? (
            /* Success View */
            <div style={{ textAlign: 'center' }}>
              <div style={successIconContainerStyle}>
                <CheckCircle2 size={36} color="#2dd4bf" />
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#f8fafc', margin: '0 0 6px' }}>
                Your account is ready.
              </h3>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
                {successResult.message}
              </p>

              {successResult.fiatAccounts && successResult.fiatAccounts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  {successResult.fiatAccounts.map((acc: any, idx: number) => {
                    const accNum = acc.accountNumber || '';
                    const bName = acc.bankName || 'Providus Bank';
                    const cCurr = acc.currency || 'NGN';
                    const routing = acc.routingNumber ? ` • ${acc.routingNumber}` : '';
                    const isCopied = copiedAccount === accNum;
                    return (
                      <div key={acc.id || idx} style={accountCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={chipStyle}>
                            <Building2 size={12} style={{ marginRight: 4 }} />
                            {bName}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf', background: 'rgba(45, 212, 191, 0.1)', padding: '2px 8px', borderRadius: 10 }}>
                            {cCurr}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 1.2, color: '#f8fafc', wordBreak: 'break-all', textAlign: 'left' }}>
                            {accNum}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount(accNum)}
                            style={copyBtnStyle}
                          >
                            {isCopied ? <Check size={14} color="#2dd4bf" /> : <Copy size={14} color="#f8fafc" />}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'left', marginTop: 4 }}>
                          Account Name: <strong style={{ color: '#cbd5e1' }}>{successResult.legalName || 'Proxim User'}</strong>{routing}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleFinish}
                id="brails-kyc-done-btn"
                style={primaryBtnStyle}
              >
                Done <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Dynamic Form */
            <form onSubmit={handleSubmit}>
              <div style={infoBannerStyle}>
                <Lock size={14} color="#2dd4bf" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                  {schema?.description || 'Your details are encrypted and securely verified with Brails to generate your dedicated account.'}
                </p>
              </div>

              {schema?.sections.map((section) => (
                <div key={section.id} style={{ marginBottom: 16 }}>
                  {schema.sections.length > 1 && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 12 }}>
                      {section.title}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    {section.fields.map((field) => {
                      const val = formData[field.name] || '';
                      const isFullWidth = ['email', 'bank', 'bvn', 'phoneNumber'].includes(field.name);

                      if (field.type === 'select') {
                        return (
                          <div key={field.name} style={{ gridColumn: isFullWidth ? '1 / -1' : undefined }}>
                            <label style={labelStyle}>
                              {field.label} {field.required && <span style={{ color: '#2dd4bf' }}>*</span>}
                            </label>
                            <select
                              value={val}
                              onChange={(e) => handleChange(field.name, e.target.value)}
                              required={field.required}
                              style={selectStyle}
                              disabled={submitting || polling}
                            >
                              {field.options?.map((opt) => (
                                <option key={opt.value} value={opt.value} style={{ background: '#0f172a', color: '#fff' }}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {field.help && <span style={helpStyle}>{field.help}</span>}
                          </div>
                        );
                      }

                      return (
                        <div key={field.name} style={{ gridColumn: isFullWidth ? '1 / -1' : undefined }}>
                          <label style={labelStyle}>
                            {field.label} {field.required && <span style={{ color: '#2dd4bf' }}>*</span>}
                          </label>
                          <input
                            type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                            value={val}
                            placeholder={field.placeholder}
                            required={field.required}
                            maxLength={field.maxLength}
                            pattern={field.pattern}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            disabled={submitting || polling}
                            style={inputStyle}
                          />
                          {field.help && <span style={helpStyle}>{field.help}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {errorMsg && (
                <div style={errorBannerStyle}>
                  <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 13, color: '#fca5a5', lineHeight: 1.4 }}>{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                id="brails-kyc-submit-btn"
                disabled={submitting || polling}
                style={{
                  ...primaryBtnStyle,
                  opacity: submitting || polling ? 0.75 : 1,
                  cursor: submitting || polling ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting || polling ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>{polling ? 'Issuing your account…' : 'Submitting details…'}</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Get Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .spin {
          animation: proxim-spin 1s linear infinite;
        }
        @keyframes proxim-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  background: 'rgba(5, 8, 17, 0.85)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
};

const sheetStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: 'linear-gradient(180deg, #0d1424 0%, #060913 100%)',
  borderRadius: '24px 24px 0 0',
  border: '1px solid rgba(45, 212, 191, 0.25)',
  boxShadow: '0 -20px 60px rgba(0, 0, 0, 0.8)',
  maxHeight: '92vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const auroraBarStyle: React.CSSProperties = {
  height: 3,
  background: 'linear-gradient(90deg, #2dd4bf 0%, #818cf8 50%, #2dd4bf 100%)',
  backgroundSize: '200% 100%',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 24px 14px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
};

const iconBadgeStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'rgba(45, 212, 191, 0.12)',
  border: '1px solid rgba(45, 212, 191, 0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '50%',
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const contentStyle: React.CSSProperties = {
  padding: '20px 24px 28px',
  overflowY: 'auto',
};

const infoBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  background: 'rgba(45, 212, 191, 0.05)',
  border: '1px solid rgba(45, 212, 191, 0.15)',
  borderRadius: 12,
  padding: '10px 14px',
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: 6,
  letterSpacing: '0.03em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#f8fafc',
  fontSize: 13.5,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto',
  cursor: 'pointer',
};

const helpStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#64748b',
  marginTop: 4,
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, #2dd4bf 0%, #818cf8 100%)',
  border: 'none',
  color: '#050811',
  fontWeight: 800,
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 18,
  transition: 'transform 0.1s, opacity 0.2s',
};

const errorBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  background: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.25)',
  borderRadius: 10,
  padding: '10px 14px',
  marginTop: 14,
};

const successIconContainerStyle: React.CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: '50%',
  background: 'rgba(45, 212, 191, 0.12)',
  border: '1px solid rgba(45, 212, 191, 0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 16px',
};

const accountCardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(45, 212, 191, 0.25)',
  borderRadius: 16,
  padding: 18,
  marginBottom: 20,
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 14,
  background: 'rgba(45, 212, 191, 0.12)',
  border: '1px solid rgba(45, 212, 191, 0.25)',
  color: '#2dd4bf',
  fontSize: 11,
  fontWeight: 700,
};

const copyBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 12px',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
