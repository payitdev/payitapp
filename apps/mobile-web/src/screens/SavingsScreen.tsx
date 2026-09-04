import React, { useState } from 'react';
import { useSavings, YieldOption } from '../hooks/useSavings';
import { useAccount } from '../context/AccountContext';
import { apiFetch } from '../apiClient';
import { BottomNav } from '../components/layout/BottomNav';
import { ListRow } from '../components/ListRow';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface SavingsScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const SavingsScreen: React.FC<SavingsScreenProps> = ({ onNavigate, onEnterScreen }) => {
  const { activeEntity } = useAccount();
  const {
    savingsPool,
    kaminoPositions,
    yieldOptions,
    autoSweepEnabled,
    setAutoSweepEnabled,
    triggerAutoSweep,
    isSweepingNow,
    sweepMessage,
    loading,
    error,
    loadAll,
  } = useSavings();

  const [selectedOption, setSelectedOption] = useState<YieldOption | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption || !depositAmount) return;
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsDepositing(true);
    setDepositError(null);
    setDepositSuccess(null);
    try {
      const res = await apiFetch('/api/kamino/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: activeEntity?.id,
          amountUsd: amountNum,
          lockDurationDays: 90,
          vaultId: selectedOption.id,
          strategy: selectedOption.provider === 'near_intent' ? 'near_intent' : 'kamino',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deposit into vault.');

      setDepositSuccess(`Successfully deposited $${amountNum.toFixed(2)} into ${selectedOption.name}`);
      await loadAll();
      setTimeout(() => {
        setSelectedOption(null);
        setDepositAmount('');
        setDepositSuccess(null);
      }, 1200);
    } catch (err: any) {
      setDepositError(err.message || 'Deposit could not be completed.');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="screen-container">
      {/* Top bar with title (24px Bricolage) */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--type-24)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Vault
        </div>
      </div>

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {/* Top: current locked total in 34px Bricolage */}
        <div
          style={{
            padding: '24px 20px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: 'var(--type-11)',
              fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              marginBottom: '6px',
            }}
          >
            Total active savings
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--type-34)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              letterSpacing: '-0.5px',
            }}
          >
            ${savingsPool.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            style={{
              fontSize: 'var(--type-13)',
              color: 'var(--accent-teal)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              marginTop: '6px',
            }}
          >
            Earn up to 11.2% APY across automated yield routes
          </div>
        </div>

        {/* Auto-sweep: single toggle row */}
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--type-15)',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Smart auto-sweep
            </span>
            <button
              onClick={() => {
                triggerLightHaptic();
                setAutoSweepEnabled(!autoSweepEnabled);
              }}
              style={{
                background: autoSweepEnabled ? 'rgba(53, 217, 208, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                border: autoSweepEnabled ? '1px solid var(--accent-teal)' : '1px solid var(--hairline)',
                color: autoSweepEnabled ? 'var(--accent-teal)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 12px',
                fontSize: 'var(--type-11)',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {autoSweepEnabled ? 'Active' : 'Paused'}
            </button>
          </div>
          <div
            style={{
              fontSize: 'var(--type-13)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.4,
            }}
          >
            Automatically sweeps idle cash above your liquid buffer into high-yield strategies.
          </div>
          {autoSweepEnabled && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant="ghost"
                disabled={isSweepingNow}
                onClick={() => {
                  triggerLightHaptic();
                  triggerAutoSweep();
                }}
                style={{ padding: '4px 10px', minHeight: 32 }}
              >
                {isSweepingNow ? 'Sweeping…' : 'Sweep now'}
              </Button>
              {sweepMessage && (
                <span style={{ fontSize: 'var(--type-11)', color: 'var(--text-muted)' }}>{sweepMessage}</span>
              )}
            </div>
          )}
        </div>

        {/* Section: Active Positions */}
        {kaminoPositions.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: 'var(--type-20)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)',
                marginBottom: '12px',
              }}
            >
              Active positions
            </div>
            <div>
              {kaminoPositions.map((pos) => {
                const principal = parseFloat(pos.principalAmountUsd || pos.principalUsd || '0');
                const apy = pos.userNetApy ? `${(parseFloat(pos.userNetApy) * 100).toFixed(1)}% APY` : '9.2% APY';
                return (
                  <ListRow
                    key={pos.id}
                    title={pos.name || 'USDC Yield Reserve'}
                    meta={`${apy} · ${pos.lockDurationDays || 30}-day term`}
                    amount={`$${principal.toFixed(2)}`}
                    isIncoming={true}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Yield Options */}
        <div>
          <div
            style={{
              fontSize: 'var(--type-20)',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              marginBottom: '12px',
            }}
          >
            Yield options
          </div>

          {loading && yieldOptions.length === 0 ? (
            <LoadingState rows={3} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadAll()} />
          ) : yieldOptions.length === 0 ? (
            <EmptyState message="No yield strategies available right now." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {yieldOptions.map((opt) => (
                <div
                  key={opt.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--type-15)',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {opt.name}
                      <Chip tone="teal">{opt.provider}</Chip>
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--type-13)',
                        color: 'var(--accent-teal)',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 700,
                        marginTop: '4px',
                      }}
                    >
                      {(opt.userNetApy || 8.5).toFixed(2)}% APY
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      triggerLightHaptic();
                      setSelectedOption(opt);
                    }}
                    style={{ padding: '8px 16px', minHeight: 36 }}
                  >
                    Deposit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deposit Sheet */}
      <Sheet
        isOpen={Boolean(selectedOption)}
        onClose={() => setSelectedOption(null)}
        title={selectedOption ? `Deposit into ${selectedOption.name}` : 'Deposit'}
      >
        <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selectedOption && (
            <div
              style={{
                background: 'rgba(53, 217, 208, 0.08)',
                border: '1px solid rgba(53, 217, 208, 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                fontSize: 'var(--type-13)',
                color: 'var(--text-primary)',
              }}
            >
              Estimated yield:{' '}
              <strong style={{ color: 'var(--accent-teal)' }}>{selectedOption.userNetApy.toFixed(2)}% APY</strong>
            </div>
          )}
          <Input
            id="deposit-amount"
            label="Amount (USD)"
            type="number"
            step="0.01"
            min="1"
            placeholder="100.00"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            required
          />
          {depositError && (
            <div style={{ background: 'rgba(255, 93, 168, 0.12)', border: '1px solid #FF5DA8', color: '#FF5DA8', padding: 12, borderRadius: 12, fontSize: 13 }}>
              {depositError}
            </div>
          )}
          {depositSuccess && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#10B981', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
              {depositSuccess}
            </div>
          )}
          <Button variant="primary" type="submit" fullWidth disabled={isDepositing}>
            {isDepositing ? 'Depositing…' : 'Deposit'}
          </Button>
        </form>
      </Sheet>

      {/* Floating Bottom Nav */}
      <BottomNav active="savings" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};
