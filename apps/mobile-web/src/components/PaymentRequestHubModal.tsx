import React, { useState, useEffect } from 'react';
import { UniversalIdentityCard, ResolvedIdentity } from './UniversalIdentityCard';

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
      const token = localStorage.getItem('payit_session_token');
      const res = await fetch(`/api/payments/requests?entityId=${encodeURIComponent(entityId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
      const token = localStorage.getItem('payit_session_token');
      const res = await fetch(`/api/users/resolve-identity?query=${encodeURIComponent(recipientQuery.trim())}&entityId=${encodeURIComponent(entityId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
      const token = localStorage.getItem('payit_session_token');
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      const token = localStorage.getItem('payit_session_token');
      const res = await fetch('/api/payments/fulfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      const token = localStorage.getItem('payit_session_token');
      await fetch('/api/payments/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      backgroundColor: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '24px',
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#F8FAFC',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Payment Requests</h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '2px 0 0 0' }}>Request & fulfill peer-to-peer payments</p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#1E293B',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#94A3B8',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1E293B', backgroundColor: '#0F172A' }}>
          <button
            onClick={() => setActiveTab('INBOX')}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'INBOX' ? '#38BDF8' : '#64748B',
              borderBottom: activeTab === 'INBOX' ? '2px solid #38BDF8' : 'none',
              cursor: 'pointer',
            }}
          >
            Inbound Inbox ({trustedRequests.length + strangerRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('OUTBOUND')}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'OUTBOUND' ? '#38BDF8' : '#64748B',
              borderBottom: activeTab === 'OUTBOUND' ? '2px solid #38BDF8' : 'none',
              cursor: 'pointer',
            }}
          >
            Sent Requests ({outboundRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('CREATE')}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '14px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: activeTab === 'CREATE' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
              color: '#0EA5E9',
              borderBottom: activeTab === 'CREATE' ? '2px solid #0EA5E9' : 'none',
              cursor: 'pointer',
            }}
          >
            + Request Money
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '12px', color: '#F87171', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '12px', color: '#34D399', fontSize: '13px', marginBottom: '16px' }}>
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
                    backgroundColor: inboxSubTab === 'TRUSTED' ? '#1E293B' : 'transparent',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: inboxSubTab === 'TRUSTED' ? '#F8FAFC' : '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  🟢 Contacts ({trustedRequests.length})
                </button>
                <button
                  onClick={() => setInboxSubTab('STRANGERS')}
                  style={{
                    backgroundColor: inboxSubTab === 'STRANGERS' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    border: inboxSubTab === 'STRANGERS' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #334155',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: inboxSubTab === 'STRANGERS' ? '#F87171' : '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  🔴 Strangers ({strangerRequests.length})
                </button>
              </div>

              {inboxSubTab === 'STRANGERS' && strangerRequests.length > 0 && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#F87171' }}>
                  ⚠️ <strong>Stranger Protection Warning:</strong> These payment requests are from users not saved in your contacts. Always verify the requester's identity before fulfilling requests.
                </div>
              )}

              {/* Requests List */}
              {isLoading ? (
                <p style={{ textAlign: 'center', color: '#64748B', fontSize: '14px' }}>Loading requests...</p>
              ) : (inboxSubTab === 'TRUSTED' ? trustedRequests : strangerRequests).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📬</span>
                  <p style={{ fontSize: '14px', margin: 0 }}>No pending payment requests in this tab.</p>
                </div>
              ) : (
                (inboxSubTab === 'TRUSTED' ? trustedRequests : strangerRequests).map((req) => (
                  <div key={req.id} style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{req.requester.legalName}</h4>
                        <p style={{ fontSize: '12px', color: '#38BDF8', margin: '2px 0 0 0' }}>{req.requester.username}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC' }}>{req.currency} {parseFloat(req.amount).toLocaleString()}</span>
                      </div>
                    </div>
                    {req.narration && (
                      <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 12px 0', fontStyle: 'italic' }}>"{req.narration}"</p>
                    )}
                    {req.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          style={{ flex: 1, backgroundColor: '#334155', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '600', color: '#F87171', cursor: 'pointer' }}
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => setSelectedFulfillRequest(req)}
                          style={{ flex: 2, backgroundColor: '#10B981', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}
                        >
                          Pay {req.currency} {parseFloat(req.amount).toLocaleString()}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: req.status === 'PAID' ? '#34D399' : '#94A3B8' }}>Status: {req.status}</span>
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
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                  <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📤</span>
                  <p style={{ fontSize: '14px', margin: 0 }}>You haven't sent any payment requests yet.</p>
                </div>
              ) : (
                outboundRequests.map((req) => (
                  <div key={req.id} style={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#94A3B8' }}>Request ID: {req.id.slice(-8)}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: req.status === 'PAID' ? '#34D399' : '#FDE047' }}>{req.status}</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#F8FAFC' }}>{req.currency} {parseFloat(req.amount).toLocaleString()}</div>
                    {req.narration && <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0 0' }}>"{req.narration}"</p>}
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
