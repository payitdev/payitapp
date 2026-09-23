import React from 'react';
import { CreditCard, Snowflake, ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react';
import { useCards } from '../hooks/useCards';
import { useTransactions } from '../hooks/useTransactions';
import { BottomNav } from '../components/layout/BottomNav';
import { ListRow } from '../components/ListRow';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Input } from '../components/Input';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface CardsScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

export const CardsScreen: React.FC<CardsScreenProps> = ({ onNavigate, onEnterScreen }) => {
  const {
    issuedCards,
    cardBrand,
    setCardBrand,
    selectedCardType,
    setSelectedCardType,
    isIssuingCard,
    showCardsModal,
    setShowCardsModal,
    showCardFundModal,
    setShowCardFundModal,
    cardFundAction,
    setCardFundAction,
    cardFundAmount,
    setCardFundAmount,
    targetCardId,
    setTargetCardId,
    loading,
    error,
    fetchCards,
    handleIssueVirtualCard,
    handleFreezeVirtualCard,
    handleFundVirtualCard,
  } = useCards();

  const { transactions } = useTransactions();
  const cardTransactions = transactions.filter(
    (tx) => tx.mode === 'fiat' && (tx.title.toLowerCase().includes('card') || tx.subtitle.toLowerCase().includes('card'))
  );

  const activeCard = issuedCards.length > 0 ? issuedCards[0] : null;

  return (
    <div className="screen-container">
      {/* Top bar with plain title (24px Bricolage) */}
      <div
        style={{
          padding: '20px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--type-24)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Cards
        </div>
        {activeCard && (
          <Button
            variant="ghost"
            onClick={() => {
              triggerLightHaptic();
              setShowCardsModal(true);
            }}
            style={{ padding: '4px 8px', minHeight: 36 }}
          >
            <Plus size={16} /> New card
          </Button>
        )}
      </div>

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {loading && issuedCards.length === 0 ? (
          <LoadingState rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchCards()} />
        ) : !activeCard ? (
          /* Empty Card State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--hairline)',
            }}
          >
            <CreditCard size={40} color="var(--accent-teal)" style={{ marginBottom: '16px' }} />
            <div
              style={{
                fontSize: 'var(--type-20)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Get your virtual card
            </div>
            <div
              style={{
                fontSize: 'var(--type-13)',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                maxWidth: 280,
                marginBottom: '24px',
              }}
            >
              Spend globally with real-time conversion and zero hidden fees.
            </div>
            <Button
              variant="primary"
              onClick={() => {
                triggerLightHaptic();
                setShowCardsModal(true);
              }}
            >
              Issue card
            </Button>
          </div>
        ) : (
          /* Visual Card Element (aurora gradient) */
          <div>
            <div
              style={{
                background: 'var(--gradient-aurora)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                minHeight: 190,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
                color: 'var(--text-on-surface)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {/* Card top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--type-15)',
                    fontWeight: 800,
                    letterSpacing: '-0.2px',
                  }}
                >
                  Proxim
                </span>
                <Chip tone={activeCard.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {activeCard.status === 'ACTIVE' ? 'Active' : 'Frozen'}
                </Chip>
              </div>

              {/* Card Number */}
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--type-20)',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  margin: '20px 0',
                }}
              >
                {activeCard.maskedPan || '•••• •••• •••• 4242'}
              </div>

              {/* Card bottom row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 'var(--type-11)', opacity: 0.8, textTransform: 'none' }}>Cardholder</div>
                  <div style={{ fontSize: 'var(--type-13)', fontWeight: 700 }}>
                    {activeCard.cardholderName || 'Proxim User'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--type-11)', opacity: 0.8, textTransform: 'none' }}>Expires</div>
                  <div style={{ fontSize: 'var(--type-13)', fontWeight: 700 }}>{activeCard.expiry || '12/28'}</div>
                </div>
                <div style={{ fontSize: 'var(--type-15)', fontWeight: 800 }}>{activeCard.brand}</div>
              </div>
            </div>

            {/* Action Ghost Buttons beneath card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginTop: '16px',
                padding: '8px 0',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <Button
                variant="ghost"
                onClick={() => {
                  triggerLightHaptic();
                  handleFreezeVirtualCard(activeCard.id, activeCard.status);
                }}
              >
                <Snowflake size={16} />
                {activeCard.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  triggerLightHaptic();
                  setTargetCardId(activeCard.id);
                  setCardFundAction('TOPUP');
                  setShowCardFundModal(true);
                }}
              >
                <ArrowDownCircle size={16} />
                Fund
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  triggerLightHaptic();
                  setTargetCardId(activeCard.id);
                  setCardFundAction('WITHDRAW');
                  setShowCardFundModal(true);
                }}
              >
                <ArrowUpCircle size={16} />
                Withdraw
              </Button>
            </div>

            {/* Card Activity Section */}
            <div style={{ marginTop: '24px' }}>
              <div
                style={{
                  fontSize: 'var(--type-20)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                }}
              >
                Card activity
              </div>
              {cardTransactions.length === 0 ? (
                <EmptyState message="Nothing yet — your card transactions will appear here." />
              ) : (
                <div>
                  {cardTransactions.map((tx) => (
                    <ListRow
                      key={tx.id}
                      icon={<CreditCard size={16} />}
                      title={tx.title}
                      meta={`${tx.subtitle} · ${tx.date}`}
                      amount={`-$${tx.amount.toFixed(2)}`}
                      isIncoming={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sheet: Issue Virtual Card */}
      <Sheet isOpen={showCardsModal} onClose={() => setShowCardsModal(false)} title="Issue virtual card">
        <form onSubmit={handleIssueVirtualCard} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div
              style={{
                fontSize: 'var(--type-13)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                marginBottom: '8px',
                fontWeight: 500,
              }}
            >
              Card brand
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['VISA', 'MASTERCARD'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    setCardBrand(b);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: cardBrand === b ? '1.5px solid var(--accent-teal)' : '1px solid var(--hairline)',
                    background: cardBrand === b ? 'rgba(53, 217, 208, 0.1)' : 'var(--surface)',
                    color: cardBrand === b ? 'var(--accent-teal)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 'var(--type-15)',
                    cursor: 'pointer',
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 'var(--type-13)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                marginBottom: '8px',
                fontWeight: 500,
              }}
            >
              Card type
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['PERSONAL', 'BUSINESS', 'BURNER'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    setSelectedCardType(t);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedCardType === t ? '1.5px solid var(--accent-teal)' : '1px solid var(--hairline)',
                    background: selectedCardType === t ? 'rgba(53, 217, 208, 0.1)' : 'var(--surface)',
                    color: selectedCardType === t ? 'var(--accent-teal)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 'var(--type-13)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <Button variant="primary" type="submit" fullWidth disabled={isIssuingCard}>
            {isIssuingCard ? 'Issuing card…' : 'Issue card'}
          </Button>
        </form>
      </Sheet>

      {/* Sheet: Fund / Withdraw Card */}
      <Sheet
        isOpen={showCardFundModal}
        onClose={() => setShowCardFundModal(false)}
        title={cardFundAction === 'TOPUP' ? 'Fund card' : 'Withdraw from card'}
      >
        <form onSubmit={handleFundVirtualCard} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            id="card-amount"
            label="Amount (USD)"
            type="number"
            step="0.01"
            min="1"
            placeholder="50.00"
            value={cardFundAmount}
            onChange={(e) => setCardFundAmount(e.target.value)}
            required
          />
          <Button variant="primary" type="submit" fullWidth>
            {cardFundAction === 'TOPUP' ? 'Top up card' : 'Withdraw funds'}
          </Button>
        </form>
      </Sheet>

      {/* Floating Bottom Nav */}
      <BottomNav active="cards" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};
