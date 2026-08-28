import React, { useState } from 'react';
import { apiFetch } from '../apiClient';
import { Landmark, Smartphone, Coins, ArrowRight, X, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  apiBaseUrl: string;
  entityId: string;
  accounts: any[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const NuvionFundingModal: React.FC<Props> = ({ apiBaseUrl, entityId, accounts, onClose, onSuccess }) => {
  const [fundingType, setFundingType] = useState<'open-banking' | 'momo' | 'crypto'>('open-banking');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [amount, setAmount] = useState<string>('100');
  const [narration, setNarration] = useState<string>('Deposit funds');

  // MoMo State
  const [momoPhone, setMomoPhone] = useState<string>('254712345678');
  const [momoChannel, setMomoChannel] = useState<'KE-SAFARICOM-C2B' | 'TZ-AIRTEL-C2B' | 'TZ-TIGO-C2B'>('KE-SAFARICOM-C2B');

  // Status State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId) || accounts[0];

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSessionData(null);

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid positive amount.');
      }

      // Convert to minor units (e.g. 100 USD = 10000 cents, KES/TZS no decimals)
      const isZeroDecimal = selectedAccount?.currency === 'KES' || selectedAccount?.currency === 'TZS';
      const minorAmount = isZeroDecimal ? Math.round(amountNum) : Math.round(amountNum * 100);

      const payload: any = {
        localEntityId: entityId,
        accountId: selectedAccount?.accountId || selectedAccount?.id,
        amount: minorAmount,
        currency: selectedAccount?.currency || 'USD',
        fundingType,
        redirectUrl: typeof window !== 'undefined' ? `${window.location.origin}/checkout/complete` : 'https://proxim.app/checkout/complete',
        narration: narration || 'Deposit to account',
      };

      if (fundingType === 'momo') {
        payload.meta = {
          msisdn: momoPhone,
          channel: momoChannel,
        };
      }

      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/funding-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to create deposit session.');
      }

      setSessionData(data.session);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Deposit initiation failed.');
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
              Add Money
            </span>
            <h3 style={{ color: '#fff', margin: '4px 0 0', fontSize: 20 }}>Select Deposit Method</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 0, color: '#9fb4b0', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, background: 'rgba(255, 85, 85, 0.15)', border: '1px solid rgba(255, 85, 85, 0.3)', color: '#ff7b72', fontSize: 13, marginBottom: 16 }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Successful Session Created View */}
        {sessionData ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={44} color="#7ee2c3" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ color: '#fff', margin: '0 0 6px' }}>Deposit Initiated</h4>
            <p style={{ color: '#9fb4b0', fontSize: 13, margin: '0 0 20px' }}>
              {fundingType === 'momo'
                ? 'Check your mobile phone for the payment authorization prompt.'
                : 'Complete the deposit via the secure checkout portal.'}
            </p>

            {sessionData.checkout_url && (
              <a
                href={sessionData.checkout_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  borderRadius: 12,
                  background: '#d6b65a',
                  color: '#061b18',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: 14,
                }}
              >
                Open Checkout Portal <ExternalLink size={16} />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{ display: 'block', margin: '16px auto 0', background: 'transparent', border: 0, color: '#9fb4b0', cursor: 'pointer', fontSize: 13 }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleInitiate} style={{ display: 'grid', gap: 16 }}>
            {/* Funding Rails Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <button
                type="button"
                onClick={() => setFundingType('open-banking')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 6px',
                  borderRadius: 12,
                  border: fundingType === 'open-banking' ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.08)',
                  background: fundingType === 'open-banking' ? 'rgba(126, 226, 195, 0.12)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  color: '#fff',
                }}
              >
                <Landmark size={20} color={fundingType === 'open-banking' ? '#7ee2c3' : '#9fb4b0'} style={{ marginBottom: 6 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Bank Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setFundingType('momo')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 6px',
                  borderRadius: 12,
                  border: fundingType === 'momo' ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.08)',
                  background: fundingType === 'momo' ? 'rgba(126, 226, 195, 0.12)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  color: '#fff',
                }}
              >
                <Smartphone size={20} color={fundingType === 'momo' ? '#7ee2c3' : '#9fb4b0'} style={{ marginBottom: 6 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Mobile Money</span>
              </button>

              <button
                type="button"
                onClick={() => setFundingType('crypto')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 6px',
                  borderRadius: 12,
                  border: fundingType === 'crypto' ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.08)',
                  background: fundingType === 'crypto' ? 'rgba(126, 226, 195, 0.12)' : 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  color: '#fff',
                }}
              >
                <Coins size={20} color={fundingType === 'crypto' ? '#7ee2c3' : '#9fb4b0'} style={{ marginBottom: 6 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>USDC (Base)</span>
              </button>
            </div>

            {/* Account Selection */}
            <label style={{ color: '#dce9e6', fontSize: 12 }}>
              Destination Account
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.currency} ({acc.displayName || `${acc.currency} Account`})
                  </option>
                ))}
              </select>
            </label>

            {/* Amount */}
            <label style={{ color: '#dce9e6', fontSize: 12 }}>
              Amount ({selectedAccount?.currency || 'USD'})
              <input
                type="number"
                step="any"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4, fontSize: 16, fontWeight: 600 }}
              />
            </label>

            {/* MoMo Specific Fields */}
            {fundingType === 'momo' && (
              <>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>
                  Provider Network
                  <select
                    value={momoChannel}
                    onChange={(e: any) => setMomoChannel(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
                  >
                    <option value="KE-SAFARICOM-C2B">Kenya - Safaricom (M-Pesa)</option>
                    <option value="TZ-AIRTEL-C2B">Tanzania - Airtel Money</option>
                    <option value="TZ-TIGO-C2B">Tanzania - Tigo Pesa</option>
                  </select>
                </label>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>
                  Phone Number (International Format)
                  <input
                    value={momoPhone}
                    onChange={(e) => setMomoPhone(e.target.value)}
                    required
                    placeholder="254712345678"
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}
                  />
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '13px 20px',
                borderRadius: 12,
                background: isLoading ? '#9fb4b0' : '#d6b65a',
                color: '#061b18',
                fontWeight: 800,
                border: 0,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginTop: 8,
              }}
            >
              {isLoading ? 'Processing...' : 'Continue to Deposit'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
