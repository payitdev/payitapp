import React, { useState, useEffect } from 'react';
import { apiFetch } from '../apiClient';
import { CreditCard, Plus, Lock, Unlock, Eye, EyeOff, Shield, Sliders, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

interface Props {
  apiBaseUrl: string;
  entityId: string;
  accounts: any[];
}

export const NuvionCardHub: React.FC<Props> = ({ apiBaseUrl, entityId, accounts }) => {
  const [cards, setCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Issue Card Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [cardType, setCardType] = useState<'debit' | 'prepaid' | 'virtual'>('virtual');
  const [cardholderName, setCardholderName] = useState('');
  const [displayName, setDisplayName] = useState('Online Shopping');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [dailyLimit, setDailyLimit] = useState('1000');
  const [monthlyLimit, setMonthlyLimit] = useState('5000');
  const [internationalSpending, setInternationalSpending] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);

  // Momentary Details Reveal State (PAN / CVV for virtual cards)
  const [revealedDetails, setRevealedDetails] = useState<any | null>(null);

  // Limits Modal State
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [updateDailyLimit, setUpdateDailyLimit] = useState('');
  const [updateMonthlyLimit, setUpdateMonthlyLimit] = useState('');

  const loadCards = async () => {
    if (!entityId) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/cards?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success && data.cards) {
        setCards(data.cards);
        if (data.cards.length > 0 && !selectedCard) {
          setSelectedCard(data.cards[0]);
          loadTransactions(data.cards[0].cardId);
        }
      }
    } catch {
      setStatusMessage('Unable to load cards right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async (cardId: string) => {
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/cards/${cardId}/transactions?entityId=${encodeURIComponent(entityId)}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch {
      setTransactions([]);
    }
  };

  useEffect(() => {
    loadCards();
  }, [apiBaseUrl, entityId]);

  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsIssuing(true);
    setStatusMessage('');

    try {
      const payload: any = {
        type: cardType,
        account_id: accounts.find((a) => a.id === selectedAccountId)?.accountId || selectedAccountId,
        cardholder_name: cardholderName || 'Valued Client',
        display_name: displayName,
        spending_limits: {
          daily: parseFloat(dailyLimit) * 100,
          monthly: parseFloat(monthlyLimit) * 100,
        },
        international_spending: internationalSpending,
      };

      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localEntityId: entityId, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue card.');

      setShowIssueModal(false);
      if (cardType === 'virtual' && data.card) {
        setRevealedDetails(data.card);
      }
      await loadCards();
    } catch (err: any) {
      setStatusMessage(err.message || 'Card creation failed.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleToggleFreeze = async (card: any) => {
    const isFrozen = card.status === 'blocked';
    const action = isFrozen ? 'unblock' : 'block';

    try {
      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/cards/${card.cardId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localEntityId: entityId, reason: isFrozen ? 'User unblocked card' : 'User locked card' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed.');

      const updated = { ...card, status: isFrozen ? 'active' : 'blocked' };
      setSelectedCard(updated);
      setCards((prev) => prev.map((c) => (c.cardId === card.cardId ? updated : c)));
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to update card status.');
    }
  };

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;

    try {
      const res = await apiFetch(`${apiBaseUrl}/api/nuvion/cards/${selectedCard.cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localEntityId: entityId,
          spending_limits: {
            daily: parseFloat(updateDailyLimit) * 100,
            monthly: parseFloat(updateMonthlyLimit) * 100,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update limits.');

      setShowLimitsModal(false);
      await loadCards();
    } catch (err: any) {
      setStatusMessage(err.message || 'Unable to update limits.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header & New Card Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span style={{ color: '#d6b65a', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
            Cards
          </span>
          <h2 style={{ color: '#fff', margin: '4px 0 0', fontSize: 22 }}>Your Proxim Cards</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowIssueModal(true)}
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
          <Plus size={16} /> Issue Card
        </button>
      </div>

      {statusMessage && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,85,85,0.15)', color: '#ff7b72', fontSize: 13 }}>
          {statusMessage}
        </div>
      )}

      {/* Cards Display / Carousel */}
      {cards.length === 0 && !isLoading ? (
        <div style={{ padding: 32, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <CreditCard size={40} color="#9fb4b0" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ color: '#fff', margin: '0 0 6px' }}>No Cards Issued Yet</h4>
          <p style={{ color: '#9fb4b0', fontSize: 13, margin: '0 0 16px' }}>
            Issue a Virtual or Physical Debit Card to start spending globally from your account balance.
          </p>
          <button
            type="button"
            onClick={() => setShowIssueModal(true)}
            style={{ padding: '10px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}
          >
            Create Your First Card
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {cards.map((card) => {
            const isSelected = selectedCard?.cardId === card.cardId;
            const isBlocked = card.status === 'blocked';

            return (
              <div
                key={card.cardId || card.id}
                onClick={() => {
                  setSelectedCard(card);
                  loadTransactions(card.cardId);
                }}
                style={{
                  padding: 20,
                  borderRadius: 20,
                  background: isBlocked
                    ? 'linear-gradient(135deg, #1c2128 0%, #111418 100%)'
                    : card.type === 'debit'
                    ? 'linear-gradient(135deg, #0b332b 0%, #061814 100%)'
                    : card.type === 'prepaid'
                    ? 'linear-gradient(135deg, #2b220b 0%, #141006 100%)'
                    : 'linear-gradient(135deg, #182638 0%, #0d141e 100%)',
                  border: isSelected ? '2px solid #7ee2c3' : '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isSelected ? '0 10px 25px rgba(126,226,195,0.15)' : 'none',
                }}
              >
                {/* Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#d6b65a' }}>
                    {card.type} Card
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 12,
                      background: isBlocked ? 'rgba(255,85,85,0.2)' : 'rgba(126,226,195,0.2)',
                      color: isBlocked ? '#ff7b72' : '#7ee2c3',
                      fontWeight: 600,
                    }}
                  >
                    {isBlocked ? 'Frozen' : 'Active'}
                  </span>
                </div>

                {/* Masked Card Number */}
                <div style={{ fontSize: 18, letterSpacing: 3, fontFamily: 'monospace', color: '#fff', marginBottom: 18 }}>
                  •••• •••• •••• {card.lastFour || card.last_four || '8888'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#fff' }}>
                  <div>
                    <div style={{ color: '#9fb4b0', fontSize: 10, textTransform: 'uppercase' }}>Cardholder</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{card.cardholderName || card.cardholder_name || 'Client'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9fb4b0', fontSize: 10, textTransform: 'uppercase' }}>Expires</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{card.expiry || '12/28'}</div>
                  </div>
                  <strong style={{ fontSize: 15, letterSpacing: 1 }}>{card.brand || 'VISA'}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Card Controls & Transactions */}
      {selectedCard && (
        <div style={{ padding: 20, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h4 style={{ color: '#fff', margin: '0 0 4px' }}>{selectedCard.displayName || 'Card Controls'}</h4>
              <span style={{ color: '#9fb4b0', fontSize: 12 }}>Manage security, limits, and transactions</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleToggleFreeze(selectedCard)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: selectedCard.status === 'blocked' ? 'rgba(126,226,195,0.15)' : 'rgba(255,85,85,0.15)',
                  color: selectedCard.status === 'blocked' ? '#7ee2c3' : '#ff7b72',
                  border: 0,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {selectedCard.status === 'blocked' ? <Unlock size={14} /> : <Lock size={14} />}
                {selectedCard.status === 'blocked' ? 'Unfreeze' : 'Freeze'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUpdateDailyLimit(String((selectedCard.spendingLimits?.daily || 100000) / 100));
                  setUpdateMonthlyLimit(String((selectedCard.spendingLimits?.monthly || 500000) / 100));
                  setShowLimitsModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: 0,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Sliders size={14} /> Spending Limits
              </button>
            </div>
          </div>

          {/* Recent Card Transactions */}
          <div style={{ marginTop: 8 }}>
            <strong style={{ color: '#dce9e6', fontSize: 13, display: 'block', marginBottom: 10 }}>Card Activity</strong>
            {transactions.length === 0 ? (
              <div style={{ color: '#9fb4b0', fontSize: 12 }}>No recent purchases recorded for this card.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {transactions.map((tx: any, idx: number) => (
                  <div key={tx.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>{tx.merchant_name || 'Card Purchase'}</div>
                      <div style={{ color: '#9fb4b0', fontSize: 11 }}>{new Date(tx.created_at || Date.now()).toLocaleDateString()}</div>
                    </div>
                    <div style={{ color: '#fff', fontWeight: 700 }}>
                      ${(Number(tx.amount || 0) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issue Card Modal */}
      {showIssueModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#0a1a17', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, width: '100%', maxWidth: 440, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Issue New Card</h3>
              <button type="button" onClick={() => setShowIssueModal(false)} style={{ background: 'transparent', border: 0, color: '#9fb4b0', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleIssueCard} style={{ display: 'grid', gap: 14 }}>
              <label style={{ color: '#dce9e6', fontSize: 12 }}>Card Type
                <select value={cardType} onChange={(e: any) => setCardType(e.target.value)} style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }}>
                  <option value="virtual">Virtual Card (Instant digital spending)</option>
                  <option value="debit">Debit Card (Connected to checking balance)</option>
                  <option value="prepaid">Prepaid Card (Controlled spending)</option>
                </select>
              </label>

              <label style={{ color: '#dce9e6', fontSize: 12 }}>Card Label / Nickname
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Online Subscriptions" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>

              <label style={{ color: '#dce9e6', fontSize: 12 }}>Cardholder Name
                <input value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="John Doe" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>Daily Limit ($)
                  <input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="1000" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                </label>
                <label style={{ color: '#dce9e6', fontSize: 12 }}>Monthly Limit ($)
                  <input type="number" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} placeholder="5000" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid #38534f', background: '#071512', color: '#fff', marginTop: 4 }} />
                </label>
              </div>

              <button
                type="submit"
                disabled={isIssuing}
                style={{ padding: '12px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 800, border: 0, cursor: isIssuing ? 'not-allowed' : 'pointer', marginTop: 8 }}
              >
                {isIssuing ? 'Issuing...' : 'Create Card'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Momentary Details Modal */}
      {revealedDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#0a1a17', border: '1px solid #7ee2c3', borderRadius: 24, width: '100%', maxWidth: 420, padding: 24, textAlign: 'center' }}>
            <CheckCircle2 size={40} color="#7ee2c3" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ color: '#fff', margin: '0 0 4px' }}>Virtual Card Activated</h3>
            <p style={{ color: '#9fb4b0', fontSize: 12, margin: '0 0 16px' }}>Save your full details now. Sensitive numbers will not be shown again.</p>

            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,0,0,0.3)', textAlign: 'left', display: 'grid', gap: 8, fontSize: 13, color: '#fff' }}>
              <div><strong>Card Number:</strong> {revealedDetails.pan || `•••• •••• •••• ${revealedDetails.last_four || '1234'}`}</div>
              <div><strong>Expiry:</strong> {revealedDetails.expiry || '12/28'}</div>
              <div><strong>CVV:</strong> {revealedDetails.cvv || '•••'}</div>
            </div>

            <button
              type="button"
              onClick={() => setRevealedDetails(null)}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, background: '#d6b65a', color: '#061b18', fontWeight: 700, border: 0, cursor: 'pointer' }}
            >
              Done & Secured
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
