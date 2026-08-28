import React, { useState, useEffect } from 'react';
import { apiFetch } from '../apiClient';
import { Send, UserPlus, Users, ArrowRight, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  apiBaseUrl: string;
  entityId: string;
  accounts: any[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const NuvionPayoutModal: React.FC<Props> = ({ apiBaseUrl, entityId, accounts, onClose, onSuccess }) => {
  const [step, setStep] = useState<'select' | 'new_recipient' | 'amount' | 'confirm'>('select');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [counterparties, setCounterparties] = useState<any[]>([]);
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string>('');
  const [selectedPaymentDetailId, setSelectedPaymentDetailId] = useState<string>('');

  // New Recipient State
  const [recipientType, setRecipientType] = useState<'individual' | 'business'>('individual');
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [recipientLegalName, setRecipientLegalName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientRelationship, setRecipientRelationship] = useState<'vendor' | 'employee' | 'contractor' | 'family'>('vendor');
  const [recipientCountry, setRecipientCountry] = useState('NG');
  const [recipientCurrency, setRecipientCurrency] = useState('NGN');

  // Bank Coordinates
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingOrSort, setRoutingOrSort] = useState('');
  const [iban, setIban] = useState('');
  const [bankCode, setBankCode] = useState('');

  // Transfer Amount & Narration
  const [amount, setAmount] = useState('50');
  const [narration, setNarration] = useState('Invoice Settlement');

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  useEffect(() => {
    if (!entityId) return;
    apiFetch(`${apiBaseUrl}/api/nuvion/counterparties?entityId=${encodeURIComponent(entityId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.counterparties) {
          setCounterparties(data.counterparties);
          if (data.counterparties.length > 0) {
            setSelectedCounterpartyId(data.counterparties[0].counterpartyId);
          }
        }
      })
      .catch(() => {});
  }, [apiBaseUrl, entityId]);

  const handleCreateCounterparty = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const payload: any = {
        type: recipientType,
        profile: {
          relationship: recipientRelationship,
          email: recipientEmail,
          address: {
            line1: '123 Business Way',
            city: 'Lagos',
            country: recipientCountry,
          },
          identification: [
            {
              type: recipientType === 'individual' ? 'P' : 'L',
              number: 'ID999999',
              issuing_country: recipientCountry,
            },
          ],
        },
      };

      if (recipientType === 'individual') {
        payload.profile.first_name = recipientFirstName;
        payload.profile.last_name = recipientLastName;
        payload.nickname = `${recipientFirstName} ${recipientLastName}`;
      } else {
        payload.profile.legal_name = recipientLegalName;
        payload.nickname = recipientLegalName;
      }

      const cpRes = await apiFetch(`${apiBaseUrl}/api/nuvion/counterparties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localEntityId: entityId, payload }),
      });
      const cpData = await cpRes.json();
      if (!cpRes.ok) throw new Error(cpData.error || 'Failed to save recipient.');

      const cpId = cpData.counterpartyId;

      // Add Payment Details
      const pdPayload: any = {
        counterparty_id: cpId,
        payment_method: 'bank-transfer',
        currency: recipientCurrency,
        country: recipientCountry,
        account_holder_name: accountHolderName || (recipientType === 'individual' ? `${recipientFirstName} ${recipientLastName}` : recipientLegalName),
      };

      if (recipientCurrency === 'EUR') {
        pdPayload.iban = iban;
      } else if (recipientCurrency === 'GBP') {
        pdPayload.account_number = accountNumber;
        pdPayload.sort_code = routingOrSort;
      } else if (recipientCurrency === 'USD') {
        pdPayload.account_number = accountNumber;
        pdPayload.routing_number = routingOrSort;
      } else {
        pdPayload.account_number = accountNumber;
        pdPayload.bank_code = bankCode || undefined;
      }

      const pdRes = await apiFetch(`${apiBaseUrl}/api/nuvion/payment-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localEntityId: entityId, payload: pdPayload }),
      });
      const pdData = await pdRes.json();
      if (!pdRes.ok) throw new Error(pdData.error || 'Failed to add bank details.');

      setSelectedCounterpartyId(cpId);
      setSelectedPaymentDetailId(pdData.paymentDetailId);
      setStep('amount');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Recipient creation failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteTransfer = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount.');
      }

      const isZeroDecimal = selectedAccount?.currency === 'KES' || selectedAccount?.currency === 'TZS';
      const minorAmount = isZeroDecimal ? Math.round(amountNum) : Math.round(amountNum * 100);

      const payload = {
        localEntityId: entityId,
        payload: {
          account_id: selectedAccount?.accountId || selectedAccount?.id,
          counterparty_id: selectedCounterpartyId,
          payment_detail_id: selectedPaymentDetailId || 'default',
          amount: minorAmount,
          currency: selectedAccount?.currency || 'USD',
          payment_type: 'bank-transfer',
          narration: narration || 'Payout transfer',
          unique_reference: `payout-${Date.now()}`,
        },
      };

      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed.');

      setStatusMessage({ type: 'success', text: 'Transfer submitted for processing.' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Transfer failed.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#0a1a17', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ color: '#d6b65a', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
              Send Payout
            </span>
            <h3 style={{ color: '#fff', margin: '4px 0 0', fontSize: 20 }}>Bank Transfer Payout</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 0, color: '#9fb4b0', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {statusMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 10,
              background: statusMessage.type === 'error' ? 'rgba(255, 85, 85, 0.15)' : 'rgba(126, 226, 195, 0.15)',
              border: `1px solid ${statusMessage.type === 'error' ? 'rgba(255, 85, 85, 0.3)' : 'rgba(126, 226, 195, 0.3)'}`,
              color: statusMessage.type === 'error' ? '#ff7b72' : '#7ee2c3',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {statusMessage?.type === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '12px 24px', borderRadius: 12, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Step 1: Select Recipient */}
            {step === 'select' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>
                  Debiting Account
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.currency} (Available: {acc.balanceAvailableMinor || 0})
                      </option>
                    ))}
                  </select>
                </label>

                {counterparties.length > 0 && (
                  <label style={{ color: '#dce9e6', fontSize: 12 }}>
                    Select Saved Recipient
                    <select
                      value={selectedCounterpartyId}
                      onChange={(e) => setSelectedCounterpartyId(e.target.value)}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
                    >
                      {counterparties.map((cp) => (
                        <option key={cp.id} value={cp.counterpartyId}>
                          {cp.nickname || 'Beneficiary'} ({cp.type})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setStep('new_recipient')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <UserPlus size={16} /> Add New Recipient
                  </button>

                  <button
                    type="button"
                    disabled={!selectedCounterpartyId}
                    onClick={() => setStep('amount')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: selectedCounterpartyId ? '#d6b65a' : '#555',
                      color: '#061b18',
                      fontWeight: 700,
                      border: 0,
                      cursor: selectedCounterpartyId ? 'pointer' : 'not-allowed',
                      fontSize: 13,
                    }}
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: New Recipient & Bank Coordinates */}
            {step === 'new_recipient' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ color: '#dce9e6', fontSize: 12 }}>
                    Country
                    <select
                      value={recipientCountry}
                      onChange={(e) => {
                        setRecipientCountry(e.target.value);
                        if (e.target.value === 'NG') setRecipientCurrency('NGN');
                        if (e.target.value === 'KE') setRecipientCurrency('KES');
                        if (e.target.value === 'GB') setRecipientCurrency('GBP');
                        if (e.target.value === 'US') setRecipientCurrency('USD');
                      }}
                      style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
                    >
                      <option value="NG">Nigeria (NG)</option>
                      <option value="KE">Kenya (KE)</option>
                      <option value="US">United States (US)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="DE">Europe (EUR)</option>
                    </select>
                  </label>
                  <label style={{ color: '#dce9e6', fontSize: 12 }}>
                    Currency
                    <input value={recipientCurrency} readOnly style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ color: '#dce9e6', fontSize: 12 }}>First Name
                    <input value={recipientFirstName} onChange={(e) => setRecipientFirstName(e.target.value)} required placeholder="Jane" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                  </label>
                  <label style={{ color: '#dce9e6', fontSize: 12 }}>Last Name
                    <input value={recipientLastName} onChange={(e) => setRecipientLastName(e.target.value)} required placeholder="Smith" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                  </label>
                </div>

                <label style={{ color: '#dce9e6', fontSize: 12 }}>Account Holder Name (As shown on bank)
                  <input value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Jane Smith" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                </label>

                {recipientCurrency === 'EUR' ? (
                  <label style={{ color: '#dce9e6', fontSize: 12 }}>IBAN *
                    <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE89370400440532013000" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                  </label>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label style={{ color: '#dce9e6', fontSize: 12 }}>Account Number *
                      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                    </label>
                    <label style={{ color: '#dce9e6', fontSize: 12 }}>
                      {recipientCurrency === 'GBP' ? 'Sort Code' : recipientCurrency === 'USD' ? 'Routing Number' : 'Bank Code'}
                      <input value={routingOrSort} onChange={(e) => setRoutingOrSort(e.target.value)} placeholder={recipientCurrency === 'GBP' ? '123456' : '021000021'} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                    </label>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button type="button" onClick={() => setStep('select')} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', color: '#9fb4b0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleCreateCounterparty}
                    style={{ padding: '10px 18px', borderRadius: 8, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: isLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {isLoading ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Amount & Execution */}
            {step === 'amount' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>
                  Amount to Send ({selectedAccount?.currency || 'USD'})
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50"
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4, fontSize: 18, fontWeight: 700 }}
                  />
                </label>

                <label style={{ color: '#dce9e6', fontSize: 12 }}>
                  Narration / Reference Note
                  <input
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Payment for consulting"
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
                  />
                </label>

                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9fb4b0' }}>
                    <span>Estimated Fee:</span>
                    <span style={{ color: '#fff' }}>₦0.00 / Free Tier</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9fb4b0' }}>
                    <span>Estimated Delivery:</span>
                    <span style={{ color: '#7ee2c3' }}>Within 5-15 minutes</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button type="button" onClick={() => setStep('select')} style={{ padding: '10px 16px', borderRadius: 8, background: 'transparent', color: '#9fb4b0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleExecuteTransfer}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 22px',
                      borderRadius: 10,
                      background: isLoading ? '#9fb4b0' : '#d6b65a',
                      color: '#061b18',
                      fontWeight: 800,
                      border: 0,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Processing...' : 'Confirm & Send Money'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
