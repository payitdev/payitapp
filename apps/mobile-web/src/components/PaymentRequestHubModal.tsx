import React, { useState, useEffect } from 'react';
import { UniversalIdentityCard, ResolvedIdentity } from './UniversalIdentityCard';
import { apiFetch } from '../apiClient';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface PaymentRequestItem {
  id: string;
  amount: string;
  currency: string;
  narration?: string;
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'EXPIRED';
  createdAt: string;
  requester: {
    entityId: string;
    legalName: string;
    username: string;
  };
  isMutualContact: boolean;
}

interface Props {
  isOpen: boolean;
  entityId: string;
  onClose: () => void;
  onPaymentSuccess?: () => void;
}

export const PaymentRequestHubModal: React.FC<Props> = ({
  isOpen,
  entityId,
  onClose,
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'INBOX' | 'OUTBOUND' | 'CREATE'>('INBOX');
  const [inboxSubTab, setInboxSubTab] = useState<'TRUSTED' | 'STRANGERS'>('TRUSTED');

  const [trustedRequests, setTrustedRequests] = useState<PaymentRequestItem[]>([]);
  const [strangerRequests, setStrangerRequests] = useState<PaymentRequestItem[]>([]);
  const [outboundRequests, setOutboundRequests] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Request State
  const [recipientQuery, setRecipientQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedTarget, setResolvedTarget] = useState<ResolvedIdentity | null>(null);
  const [resolveError, setResolveError] = useState('');

  const [requestAmount, setRequestAmount] = useState('');
  const [requestCurrency, setRequestCurrency] = useState('NGN');
  const [requestNarration, setRequestNarration] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fulfill Modal State
  const [selectedFulfillRequest, setSelectedFulfillRequest] = useState<PaymentRequestItem | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);

  useEffect(() => {
    if (isOpen && entityId) {
      fetchRequests();
    }
  }, [isOpen, entityId]);

  if (!isOpen) return null;

  const fetchRequests = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/requests?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (res.ok) {
        setTrustedRequests(data.inbound?.trusted || []);
        setStrangerRequests(data.inbound?.strangers || []);
        setOutboundRequests(data.outbound || []);
      } else {
        setErrorMsg(data.error || 'Failed to load payment requests');
      }
    } catch {
      setErrorMsg('Network error while loading payment requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveRecipient = async () => {
    if (!recipientQuery.trim()) return;
    setIsResolving(true);
    setResolveError('');
    setResolvedTarget(null);

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/users/resolve-identity?query=${encodeURIComponent(recipientQuery.trim())}&entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (res.ok && data.found) {
        setResolvedTarget(data.identity);
      } else {
        setResolveError(data.message || 'PayIT user not found');
      }
    } catch {
      setResolveError('Failed to resolve PayIT identity');
    } finally {
      setIsResolving(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!resolvedTarget || !requestAmount || parseFloat(requestAmount) <= 0) {
      setErrorMsg('Please select a valid recipient and amount.');
      return;
    }

    setIsCreating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId,
          payerUsernameOrId: resolvedTarget.username,
          amount: parseFloat(requestAmount),
          currency: requestCurrency,
          narration: requestNarration || 'Payment Request',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send payment request');
      }

      setSuccessMsg(`Payment request for ${requestCurrency} ${requestAmount} sent to ${resolvedTarget.legalName}!`);
      setRequestAmount('');
      setRequestNarration('');
      setResolvedTarget(null);
      setRecipientQuery('');
      fetchRequests();
      setTimeout(() => setActiveTab('OUTBOUND'), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not send payment request.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFulfillRequest = async (reqItem: PaymentRequestItem) => {
    setIsFulfilling(true);
    setErrorMsg('');

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/payments/fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId,
          requestId: reqItem.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Payment fulfillment failed');
      }

      setSelectedFulfillRequest(null);
      fetchRequests();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment fulfillment failed');
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await apiFetch(`${API_BASE_URL}/api/payments/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entityId, requestId }),
      });
      fetchRequests();
    } catch {
      setErrorMsg('Failed to decline payment request');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(6, 27, 24, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #0B2924 0%, #061B18 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 32px rgba(255, 93, 168, 0.15)',
        color: '#F7F8F4',
        fontFamily: "'Satoshi', sans-serif",
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#F7F8F4' }}>Payment Requests</h2>
            <p style={{ fontSize: '13px', color: 'rgba(247, 248, 244, 0.7)', margin: '2px 0 0 0' }}>Request & fulfill peer-to-peer payments</p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#F7F8F4',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(6, 27, 24, 0.5)' }}>
          <button
            onClick={() => setActiveTab('INBOX')}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '13px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'INBOX' ? '#FF5DA8' : 'rgba(247, 248, 244, 0.6)',
              borderBottom: activeTab === 'INBOX' ? '2px solid #FF5DA8' : 'none',
              cursor: 'pointer',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            Inbox ({trustedRequests.length + strangerRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('OUTBOUND')}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '13px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'OUTBOUND' ? '#FF5DA8' : 'rgba(247, 248, 244, 0.6)',
              borderBottom: activeTab === 'OUTBOUND' ? '2px solid #FF5DA8' : 'none',
              cursor: 'pointer',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            Sent ({outboundRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('CREATE')}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '13px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: activeTab === 'CREATE' ? 'rgba(255, 93, 168, 0.12)' : 'transparent',
              color: '#FF5DA8',
              borderBottom: activeTab === 'CREATE' ? '2px solid #FF5DA8' : 'none',
              cursor: 'pointer',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            + New Request
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(255, 93, 168, 0.12)', border: '1px solid rgba(255, 93, 168, 0.3)', borderRadius: '14px', padding: '12px', color: '#FF5DA8', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ backgroundColor: 'rgba(22, 199, 183, 0.12)', border: '1px solid rgba(22, 199, 183, 0.3)', borderRadius: '14px', padding: '12px', color: '#35D9D0', fontSize: '13px', marginBottom: '16px' }}>
              {successMsg}
            </div>
          )}

          {/* TAB 1: INBOUND INBOX */}
          {activeTab === 'INBOX' && (
            <div>
              {/* Sub-tabs for Inbox */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  onClick={() => setInboxSubTab('TRUSTED')}
                  style={{
                    backgroundColor: inboxSubTab === 'TRUSTED' ? 'rgba(22, 199, 183, 0.15)' : 'transparent',
                    border: inboxSubTab === 'TRUSTED' ? '1px solid #35D9D0' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: inboxSubTab === 'TRUSTED' ? '#35D9D0' : 'rgba(247, 248, 244, 0.6)',
                    cursor: 'pointer',
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  Contacts ({trustedRequests.length})
                </button>
                <button
                  onClick={() => setInboxSubTab('STRANGERS')}
                  style={{
                    backgroundColor: inboxSubTab === 'STRANGERS' ? 'rgba(255, 93, 168, 0.15)' : 'transparent',
                    border: inboxSubTab === 'STRANGERS' ? '1px solid #FF5DA8' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: inboxSubTab === 'STRANGERS' ? '#FF5DA8' : 'rgba(247, 248, 244, 0.6)',
                    cursor: 'pointer',
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  Strangers ({strangerRequests.length})
                </button>
              </div>

              {inboxSubTab === 'STRANGERS' && strangerRequests.length > 0 && (
                <div style={{ backgroundColor: 'rgba(214, 182, 90, 0.12)', border: '1px solid rgba(214, 182, 90, 0.3)', borderRadius: '14px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#D6B65A', fontFamily: "'Satoshi', sans-serif" }}>
                  <strong>Stranger Protection Notice:</strong> These payment requests are from users not saved in your contacts. Always verify the requester's identity before fulfilling requests.
                </div>
              )}

              {/* Requests List */}
              {isLoading ? (
                <p style={{ textAlign: 'center', color: 'rgba(247, 248, 244, 0.5)', fontSize: '14px', fontFamily: "'Satoshi', sans-serif" }}>Loading requests...</p>
              ) : (inboxSubTab === 'TRUSTED' ? trustedRequests : strangerRequests).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(247, 248, 244, 0.5)', fontFamily: "'Satoshi', sans-serif" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(247, 248, 244, 0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <p style={{ fontSize: '14px', margin: 0 }}>No pending payment requests in this tab.</p>
                </div>
              ) : (
                (inboxSubTab === 'TRUSTED' ? trustedRequests : strangerRequests).map((req) => (
                  <div key={req.id} style={{ backgroundColor: 'rgba(11, 41, 36, 0.65)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '18px', padding: '16px', marginBottom: '12px', fontFamily: "'Satoshi', sans-serif" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#F7F8F4' }}>{req.requester.legalName}</h4>
                        <p style={{ fontSize: '12px', color: '#35D9D0', margin: '2px 0 0 0', fontWeight: '500' }}>{req.requester.username}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '18px', fontWeight: '700', color: '#F7F8F4' }}>{req.currency} {parseFloat(req.amount).toLocaleString()}</span>
                      </div>
                    </div>
                    {req.narration && (
                      <p style={{ fontSize: '13px', color: 'rgba(247, 248, 244, 0.7)', margin: '0 0 12px 0' }}>"{req.narration}"</p>
                    )}
                    {req.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid rgba(255, 93, 168, 0.4)', borderRadius: '14px', padding: '10px', fontSize: '13px', fontWeight: '600', color: '#FF5DA8', cursor: 'pointer', fontFamily: "'Satoshi', sans-serif" }}
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => setSelectedFulfillRequest(req)}
                          style={{ flex: 2, backgroundColor: '#16C7B7', border: 'none', borderRadius: '999px', padding: '10px', fontSize: '13px', fontWeight: '700', color: '#061B18', cursor: 'pointer', fontFamily: "'Satoshi', sans-serif", boxShadow: '0 0 16px rgba(22, 199, 183, 0.25)' }}
                        >
                          Pay {req.currency} {parseFloat(req.amount).toLocaleString()}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: req.status === 'PAID' ? '#16C7B7' : '#D6B65A' }}>Status: {req.status}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: SENT REQUESTS */}
          {activeTab === 'OUTBOUND' && (
            <div>
              {outboundRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(247, 248, 244, 0.5)', fontFamily: "'Satoshi', sans-serif" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(247, 248, 244, 0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  <p style={{ fontSize: '14px', margin: 0 }}>You haven't sent any payment requests yet.</p>
                </div>
              ) : (
                outboundRequests.map((req) => (
                  <div key={req.id} style={{ backgroundColor: 'rgba(11, 41, 36, 0.65)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '18px', padding: '16px', marginBottom: '12px', fontFamily: "'Satoshi', sans-serif" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'rgba(247, 248, 244, 0.6)' }}>Request ID: {req.id.slice(-8)}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: req.status === 'PAID' ? '#16C7B7' : '#D6B65A' }}>{req.status}</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#F7F8F4' }}>{req.currency} {parseFloat(req.amount).toLocaleString()}</div>
                    {req.narration && <p style={{ fontSize: '13px', color: 'rgba(247, 248, 244, 0.7)', margin: '4px 0 0 0' }}>"{req.narration}"</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CREATE PAYMENT REQUEST */}
          {activeTab === 'CREATE' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Who are you requesting money from?
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={recipientQuery}
                    onChange={(e) => setRecipientQuery(e.target.value)}
                    placeholder="Enter @username, Account Number, or Address"
                    style={{ flex: 1, backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '12px', color: '#F8FAFC', outline: 'none' }}
                  />
                  <button
                    onClick={handleResolveRecipient}
                    disabled={isResolving || !recipientQuery.trim()}
                    style={{ backgroundColor: '#0EA5E9', border: 'none', borderRadius: '12px', padding: '12px 16px', color: '#FFF', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {isResolving ? 'Searching...' : 'Find'}
                  </button>
                </div>
                {resolveError && <p style={{ fontSize: '12px', color: '#F87171', marginTop: '6px' }}>{resolveError}</p>}
              </div>

              {resolvedTarget && (
                <UniversalIdentityCard identity={resolvedTarget} />
              )}

              {resolvedTarget && (
                <div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Request Amount
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={requestCurrency}
                        onChange={(e) => setRequestCurrency(e.target.value)}
                        style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '12px', color: '#F8FAFC', fontWeight: '700' }}
                      >
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                      <input
                        type="number"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        placeholder="5,000"
                        style={{ flex: 1, backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '12px', color: '#F8FAFC', fontSize: '16px', fontWeight: '700', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Note / Narration (Optional)
                    </label>
                    <input
                      type="text"
                      value={requestNarration}
                      onChange={(e) => setRequestNarration(e.target.value)}
                      placeholder="e.g. Dinner split, Lunch, Invoice #104"
                      style={{ width: '100%', backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '12px', color: '#F8FAFC', outline: 'none' }}
                    />
                  </div>

                  <button
                    onClick={handleCreateRequest}
                    disabled={isCreating || !requestAmount}
                    style={{ width: '100%', backgroundColor: '#0EA5E9', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '700', color: '#FFF', cursor: 'pointer' }}
                  >
                    {isCreating ? 'Sending Request...' : `Send Request for ${requestCurrency} ${requestAmount || '0'}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fulfill Confirmation Sheet */}
        {selectedFulfillRequest && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
            <div style={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>Confirm Payment</h3>
              <p style={{ fontSize: '14px', color: '#94A3B8', margin: '0 0 20px 0' }}>
                You are sending <strong>{selectedFulfillRequest.currency} {parseFloat(selectedFulfillRequest.amount).toLocaleString()}</strong> to <strong>{selectedFulfillRequest.requester.legalName}</strong> ({selectedFulfillRequest.requester.username}).
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setSelectedFulfillRequest(null)} style={{ flex: 1, backgroundColor: '#334155', border: 'none', borderRadius: '12px', padding: '12px', color: '#94A3B8', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleFulfillRequest(selectedFulfillRequest)} disabled={isFulfilling} style={{ flex: 2, backgroundColor: '#10B981', border: 'none', borderRadius: '12px', padding: '12px', color: '#FFF', fontWeight: '700', cursor: 'pointer' }}>{isFulfilling ? 'Processing...' : 'Confirm & Pay'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
