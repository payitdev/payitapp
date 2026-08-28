import React, { useState, useEffect } from 'react';
import { apiFetch } from '../apiClient';
import { PiggyBank, Plus, TrendingUp, Target, ArrowRight, X, CheckCircle2, Shield } from 'lucide-react';

interface Props {
  apiBaseUrl: string;
  entityId: string;
  accounts: any[];
}

export const NuvionSavingsHub: React.FC<Props> = ({ apiBaseUrl, entityId, accounts }) => {
  const [goals, setGoals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);

  // New Goal Form
  const [goalName, setGoalName] = useState('Emergency Fund');
  const [targetAmount, setTargetAmount] = useState('1000');
  const [targetDate, setTargetDate] = useState('2026-12-31');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadGoals = async () => {
    if (!entityId) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/savings?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success && data.goals) {
        setGoals(data.goals);
      }
    } catch {
      setStatusMessage('Unable to fetch savings goals right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, [apiBaseUrl, entityId]);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setStatusMessage('');

    try {
      const targetMinor = Math.round(parseFloat(targetAmount) * 100);
      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/savings/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localEntityId: entityId,
          accountId: accounts.find((a) => a.id === selectedAccountId)?.accountId || selectedAccountId,
          name: goalName,
          targetAmount: targetMinor,
          targetDate,
          currency: 'USD',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create savings goal.');

      setShowNewGoalModal(false);
      await loadGoals();
    } catch (err: any) {
      setStatusMessage(err.message || 'Savings goal creation failed.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ color: '#d6b65a', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
            Savings & Yield
          </span>
          <h2 style={{ color: '#fff', margin: '4px 0 0', fontSize: 22 }}>Earn on Your Money</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowNewGoalModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 12,
            background: '#d6b65a',
            color: '#061b18',
            fontWeight: 700,
            border: 0,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {/* High-Yield Promo Banner */}
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(126, 226, 195, 0.15) 0%, rgba(214, 182, 90, 0.1) 100%)',
          border: '1px solid rgba(126, 226, 195, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ color: '#7ee2c3', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} /> Up to 6.50% Annual Yield
          </div>
          <p style={{ color: '#fff', fontSize: 14, margin: '6px 0 0', lineHeight: 1.5 }}>
            Automate your savings and earn yield on your available balance. Withdraw whenever you need.
          </p>
        </div>
      </div>

      {/* Goals List */}
      {goals.length === 0 && !isLoading ? (
        <div style={{ padding: 32, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <PiggyBank size={40} color="#9fb4b0" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ color: '#fff', margin: '0 0 6px' }}>No Active Savings Goals</h4>
          <p style={{ color: '#9fb4b0', fontSize: 13, margin: '0 0 16px' }}>
            Set a target for an upcoming project, emergency fund, or travel goal to begin earning interest.
          </p>
          <button
            type="button"
            onClick={() => setShowNewGoalModal(true)}
            style={{ padding: '10px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}
          >
            Create a Goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {goals.map((goal) => {
            const target = Number(goal.targetAmountMinor || 0) / 100;
            const current = Number(goal.currentAmountMinor || 0) / 100;
            const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

            return (
              <div
                key={goal.id || goal.goalId}
                style={{
                  padding: 20,
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#fff', fontSize: 16 }}>{goal.name}</strong>
                  <span style={{ color: '#7ee2c3', fontSize: 12, fontWeight: 700 }}>
                    {goal.interestRate || '6.50'}% APY
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ color: '#9fb4b0', fontSize: 11 }}>Saved</div>
                    <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>${current.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#9fb4b0', fontSize: 11 }}>Target</div>
                    <div style={{ color: '#9fb4b0', fontSize: 14 }}>${target.toLocaleString()}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: '#7ee2c3', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Goal Modal */}
      {showNewGoalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#0a1a17', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, width: '100%', maxWidth: 440, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 18 }}>New Savings Goal</h3>
              <button type="button" onClick={() => setShowNewGoalModal(false)} style={{ background: 'transparent', border: 0, color: '#9fb4b0', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} style={{ display: 'grid', gap: 14 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Goal Name
                <input value={goalName} onChange={(e) => setGoalName(e.target.value)} required placeholder="Emergency Fund" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>

              <label style={{ color: '#dce9e6', fontSize: 12 }}>Target Amount ($)
                <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required placeholder="1000" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>

              <label style={{ color: '#dce9e6', fontSize: 12 }}>Target Completion Date
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>

              <button
                type="submit"
                disabled={isCreating}
                style={{ padding: '12px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 800, border: 0, cursor: isCreating ? 'not-allowed' : 'pointer', marginTop: 8 }}
              >
                {isCreating ? 'Creating...' : 'Start Earning'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
