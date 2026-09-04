import React, { useState } from 'react';
import { apiFetch } from '../apiClient';
import { Landmark, Smartphone, Coins, ArrowRight, X, ExternalLink, CheckCircle2, AlertCircle, Copy, Check, ShieldCheck } from 'lucide-react';

interface Props {
  apiBaseUrl: string;
  entityId: string;
  accounts: any[];
  entity?: any;
  onClose: () => void;
  onSuccess?: () => void;
  onOpenKyc?: () => void;
}

export const NuvionFundingModal: React.FC<Props> = ({
  apiBaseUrl,
  entityId,
  accounts,
  entity,
  onClose,
  onSuccess,
  onOpenKyc,
}) => {
  const [fundingType, setFundingType] = useState<'open-banking' | 'momo' | 'crypto'>('open-banking');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [amount, setAmount] = useState<string>('100');
  const [narration, setNarration] = useState<string>('Deposit funds');

  // Multi-Chain MPC network selection
  const [selectedChain, setSelectedChain] = useState<'base' | 'solana' | 'tron' | 'btc' | 'near'>('base');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // MoMo State
  const [momoPhone, setMomoPhone] = useState<string>('254712345678');
  const [momoChannel, setMomoChannel] = useState<'KE-SAFARICOM-C2B' | 'TZ-AIRTEL-C2B' | 'TZ-TIGO-C2B'>('KE-SAFARICOM-C2B');

  // Status State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId) || accounts[0];
  const primaryVirtualAccount = accounts.find((acc) => acc.accountNumber) || null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getMpcAddress = (chain: 'base' | 'solana' | 'tron' | 'btc' | 'near'): string => {
    switch (chain) {
      case 'base':
        return entity?.evmDepositAddress || '0x438A...F019';
      case 'solana':
        return entity?.solanaDepositAddress || '8mN2...eR4X';
      case 'tron':
        return entity?.tronDepositAddress || 'TMpc...9qL2';
      case 'btc':
        return entity?.btcDepositAddress || 'bc1q...x9p3';
      case 'near':
        return entity?.nearDepositAddress || `${entity?.username || 'user'}.proxim.near`;
      default:
        return '';
    }
  };

  const getChainMeta = (chain: 'base' | 'solana' | 'tron' | 'btc' | 'near') => {
    switch (chain) {
      case 'base':
        return { name: 'USDC (Base)', asset: 'USDC', speed: 'Instant' };
      case 'solana':
        return { name: 'USDC (Solana)', asset: 'USDC / SOL', speed: '~5 sec' };
      case 'tron':
        return { name: 'USDT (Tron)', asset: 'USDT (TRC-20)', speed: '~1 min' };
      case 'btc':
        return { name: 'Bitcoin', asset: 'BTC', speed: '~15 min' };
      case 'near':
        return { name: 'NEAR Protocol', asset: 'NEAR / USDC', speed: 'Instant' };
    }
  };

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#0D1424', border: '1px solid rgba(53, 217, 208, 0.25)', borderRadius: 24, width: '100%', maxWidth: 490, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.8)', color: '#F7F8F4', fontFamily: "'Satoshi', sans-serif" }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ color: '#16C7B7', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>
              Add Money
            </span>
            <h3 style={{ color: '#F7F8F4', margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>Deposit Funds</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 0, color: '#94A3B8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255, 93, 168, 0.12)', border: '1px solid #FF5DA8', color: '#FF5DA8', fontSize: 13, marginBottom: 16 }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Funding Rails Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setFundingType('open-banking')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 6px',
              borderRadius: 14,
              border: fundingType === 'open-banking' ? '2px solid #16C7B7' : '1px solid rgba(255,255,255,0.08)',
              background: fundingType === 'open-banking' ? 'rgba(22, 199, 183, 0.12)' : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              color: '#F7F8F4',
              transition: 'all 0.15s ease',
            }}
          >
            <Landmark size={20} color={fundingType === 'open-banking' ? '#16C7B7' : '#94A3B8'} style={{ marginBottom: 6 }} />
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
              borderRadius: 14,
              border: fundingType === 'momo' ? '2px solid #16C7B7' : '1px solid rgba(255,255,255,0.08)',
              background: fundingType === 'momo' ? 'rgba(22, 199, 183, 0.12)' : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              color: '#F7F8F4',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={20} color={fundingType === 'momo' ? '#16C7B7' : '#94A3B8'} style={{ marginBottom: 6 }} />
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
              borderRadius: 14,
              border: fundingType === 'crypto' ? '2px solid #16C7B7' : '1px solid rgba(255,255,255,0.08)',
              background: fundingType === 'crypto' ? 'rgba(22, 199, 183, 0.12)' : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              color: '#F7F8F4',
              transition: 'all 0.15s ease',
            }}
          >
            <Coins size={20} color={fundingType === 'crypto' ? '#16C7B7' : '#94A3B8'} style={{ marginBottom: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Multi-Currency</span>
          </button>
        </div>

        {/* ── Tab 1: Bank Transfer (Brails NGN Account) ──────────────── */}
        {fundingType === 'open-banking' && (
          <div>
            {primaryVirtualAccount ? (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ShieldCheck size={18} color="#16C7B7" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#16C7B7' }}>Dedicated Settlement Account</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    Bank Name
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#F7F8F4' }}>
                    {primaryVirtualAccount.bankName || 'Providus Bank'}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    Account Number
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.5, fontFamily: 'monospace', color: '#F7F8F4' }}>
                      {primaryVirtualAccount.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryVirtualAccount.accountNumber, 'fiat-acc')}
                      style={{ background: 'rgba(22, 199, 183, 0.15)', border: 'none', color: '#16C7B7', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {copiedKey === 'fiat-acc' ? <Check size={14} /> : <Copy size={14} />}
                      {copiedKey === 'fiat-acc' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    Account Name
                  </div>
                  <div style={{ fontSize: 13, color: '#CBD5E1', fontWeight: 600 }}>
                    {primaryVirtualAccount.accountHolderName || entity?.legalName || 'Proxim Customer'}
                  </div>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5 }}>
                  Transfers to this Nigerian bank account automatically credit your Naira balance within seconds.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
                <Landmark size={36} color="#16C7B7" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Unlock Your Naira Account</h4>
                <p style={{ color: '#94A3B8', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 16px' }}>
                  Verify your identity in 60 seconds with Brails to receive a dedicated virtual bank account number for instant funding.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenKyc?.();
                  }}
                  style={{
                    background: '#16C7B7',
                    color: '#061B18',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 20px',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Verify with Brails <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Mobile Money (Nuvion Rail) ──────────────────────── */}
        {fundingType === 'momo' && (
          <form onSubmit={handleInitiate} style={{ display: 'grid', gap: 14 }}>
            <label style={{ color: '#CBD5E1', fontSize: 12 }}>
              Provider Network
              <select
                value={momoChannel}
                onChange={(e: any) => setMomoChannel(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#07101E', color: '#fff', marginTop: 4 }}
              >
                <option value="KE-SAFARICOM-C2B">Kenya - Safaricom (M-Pesa)</option>
                <option value="TZ-AIRTEL-C2B">Tanzania - Airtel Money</option>
                <option value="TZ-TIGO-C2B">Tanzania - Tigo Pesa</option>
              </select>
            </label>

            <label style={{ color: '#CBD5E1', fontSize: 12 }}>
              Phone Number
              <input
                value={momoPhone}
                onChange={(e) => setMomoPhone(e.target.value)}
                required
                placeholder="254712345678"
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#07101E', color: '#fff', marginTop: 4 }}
              />
            </label>

            <label style={{ color: '#CBD5E1', fontSize: 12 }}>
              Amount (KES)
              <input
                type="number"
                step="any"
                min="10"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#07101E', color: '#fff', marginTop: 4 }}
              />
            </label>

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
                background: isLoading ? 'rgba(255,255,255,0.2)' : '#16C7B7',
                color: '#061B18',
                fontWeight: 800,
                border: 0,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginTop: 6,
              }}
            >
              {isLoading ? 'Sending prompt...' : 'Authorize on Mobile Money'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* ── Tab 3: NEAR MPC Multi-Chain Wallet ─────────────────────── */}
        {fundingType === 'crypto' && (
          <div>
            {/* Chain Selector Pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
              {(['base', 'solana', 'tron', 'btc', 'near'] as const).map((chain) => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => setSelectedChain(chain)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: selectedChain === chain ? '1px solid #16C7B7' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedChain === chain ? 'rgba(22, 199, 183, 0.15)' : 'transparent',
                    color: selectedChain === chain ? '#16C7B7' : '#94A3B8',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {getChainMeta(chain).name}
                </button>
              ))}
            </div>

            {/* Address Card */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F7F8F4' }}>
                    {getChainMeta(selectedChain).asset} Deposit Address
                  </div>
                  <div style={{ fontSize: 11, color: '#16C7B7', fontWeight: 600 }}>
                    Settlement speed: {getChainMeta(selectedChain).speed}
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12, color: '#E2E8F0', marginBottom: 12 }}>
                {getMpcAddress(selectedChain)}
              </div>

              <button
                type="button"
                onClick={() => handleCopy(getMpcAddress(selectedChain), `mpc-${selectedChain}`)}
                style={{
                  width: '100%',
                  background: copiedKey === `mpc-${selectedChain}` ? '#10B981' : '#16C7B7',
                  color: '#061B18',
                  border: 'none',
                  borderRadius: 12,
                  padding: '11px 16px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {copiedKey === `mpc-${selectedChain}` ? <Check size={16} /> : <Copy size={16} />}
                {copiedKey === `mpc-${selectedChain}` ? 'Address Copied!' : 'Copy Deposit Address'}
              </button>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5 }}>
                Secured by NEAR MPC Chain Signatures. Inbound deposits are automatically reconciled and converted directly into your balance.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
