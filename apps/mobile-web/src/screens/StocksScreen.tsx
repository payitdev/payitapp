import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { useStocks } from '../hooks/useStocks';
import { ListRow } from '../components/ListRow';
import { BottomNav } from '../components/layout/BottomNav';
import { EmptyState } from '../components/layout/EmptyState';
import { LoadingState } from '../components/layout/LoadingState';
import { ErrorState } from '../components/layout/ErrorState';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Chip } from '../components/Chip';
import { triggerLightHaptic } from '../hooks/useHaptics';
import type { PrimaryScreen } from '../types/navigation';

interface StocksScreenProps {
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

type TabId = 'watchlist' | 'positions';

export const StocksScreen: React.FC<StocksScreenProps> = ({ onNavigate, onEnterScreen }) => {
  const {
    stockList,
    stockSearch,
    setStockSearch,
    filteredStocks,
    selectedStock,
    setSelectedStock,
    showBuyModal,
    setShowBuyModal,
    buyAmount,
    setBuyAmount,
    showSellModal,
    setShowSellModal,
    selectedPosition,
    setSelectedPosition,
    sellAmount,
    setSellAmount,
    stockPositions,
    handleBuySubmit,
    handleSellSubmit,
    fetchStocks,
    fetchStockPositions,
    fetchMarketStatus,
    marketStatus,
  } = useStocks(undefined);

  const [activeTab, setActiveTab] = useState<TabId>('watchlist');

  // Flatten personal + business positions into one list for display
  const allPositions = [
    ...(stockPositions?.personal?.positions ?? []),
    ...(stockPositions?.business?.positions ?? []),
  ];

  useEffect(() => {
    fetchStocks();
    fetchStockPositions();
    fetchMarketStatus();
  }, []);

  return (
    <div className="screen-container">
      {/* Top bar */}
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
          Invest
        </div>

        {/* Market status chip */}
        {marketStatus && (
          <div style={{ marginTop: 8 }}>
            <Chip tone={marketStatus.status === 'Open' || marketStatus.isOpen ? 'success' : 'neutral'}>
              Market {marketStatus.status || (marketStatus.isOpen ? 'Open' : 'Closed')}
            </Chip>
          </div>
        )}

        {/* Segment control */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {(['watchlist', 'positions'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  triggerLightHaptic();
                  setActiveTab(tab);
                }}
                style={{
                  background: isActive ? 'rgba(53, 217, 208, 0.15)' : 'transparent',
                  color: isActive ? 'var(--accent-teal)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '6px 16px',
                  fontSize: 'var(--type-13)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 150ms ease',
                }}
              >
                {tab === 'watchlist' ? 'Watchlist' : 'Positions'}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '0 20px 24px', flex: 1 }}>
        {activeTab === 'watchlist' ? (
          <>
            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <input
                placeholder="Search stocks…"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--type-15)',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {filteredStocks.length === 0 && !stockSearch ? (
              <EmptyState message="No stocks available right now." />
            ) : filteredStocks.length === 0 ? (
              <EmptyState message={`No results for "${stockSearch}".`} />
            ) : (
              <div>
                {filteredStocks.map((stock: any) => {
                  const priceChange = stock.changePercent ?? stock.change ?? 0;
                  const isPositive = priceChange >= 0;
                  return (
                    <ListRow
                      key={stock.symbol}
                      icon={isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      title={stock.name || stock.symbol}
                      meta={stock.symbol}
                      amount={`$${stock.price?.toFixed(2) ?? '—'}`}
                      isIncoming={isPositive}
                      onClick={() => {
                        triggerLightHaptic();
                        setSelectedStock(stock);
                        setShowBuyModal(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Positions tab */
          <>
            {allPositions.length === 0 ? (
              <EmptyState message="You don't hold any positions yet. Buy a stock to get started." />
            ) : (
              <div>
                {allPositions.map((pos: any) => (
                  <ListRow
                    key={pos.symbol || pos.id}
                    icon={<BarChart2 size={16} />}
                    title={pos.name || pos.symbol}
                    meta={`${pos.shares ?? pos.quantity ?? 0} shares`}
                    amount={`$${parseFloat(pos.currentValue ?? pos.value ?? 0).toFixed(2)}`}
                    isIncoming
                    onClick={() => {
                      triggerLightHaptic();
                      setSelectedPosition(pos);
                      setShowSellModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sheet: Buy Stock */}
      <Sheet
        isOpen={showBuyModal}
        onClose={() => {
          setShowBuyModal(false);
          setSelectedStock(null);
        }}
        title={selectedStock ? `Buy ${selectedStock.name || selectedStock.symbol}` : 'Buy stock'}
      >
        {selectedStock && (
          <form onSubmit={handleBuySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Current price
              </div>
              <div
                style={{
                  fontSize: 'var(--type-24)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                  marginTop: 2,
                }}
              >
                ${selectedStock.price?.toFixed(2) ?? '—'}
              </div>
            </div>
            <Input
              id="buy-amount"
              label="Amount (USD)"
              type="number"
              step="0.01"
              min="1"
              placeholder="100.00"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              required
            />
            <Button variant="primary" type="submit" fullWidth>
              Buy {selectedStock.symbol}
            </Button>
            <Button variant="ghost" type="button" fullWidth onClick={() => { setShowBuyModal(false); setSelectedStock(null); }}>
              Cancel
            </Button>
          </form>
        )}
      </Sheet>

      {/* Sheet: Sell Stock */}
      <Sheet
        isOpen={showSellModal}
        onClose={() => {
          setShowSellModal(false);
          setSelectedPosition(null);
        }}
        title={selectedPosition ? `Sell ${selectedPosition.name || selectedPosition.symbol}` : 'Sell position'}
      >
        {selectedPosition && (
          <form onSubmit={handleSellSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Current value
              </div>
              <div
                style={{
                  fontSize: 'var(--type-24)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-teal)',
                  marginTop: 2,
                }}
              >
                ${parseFloat(selectedPosition.currentValue ?? selectedPosition.value ?? 0).toFixed(2)}
              </div>
            </div>
            <Input
              id="sell-amount"
              label="Shares to sell"
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="1"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              required
            />
            <Button variant="primary" type="submit" fullWidth>
              Sell {selectedPosition.symbol}
            </Button>
            <Button variant="ghost" type="button" fullWidth onClick={() => { setShowSellModal(false); setSelectedPosition(null); }}>
              Cancel
            </Button>
          </form>
        )}
      </Sheet>

      {/* Floating Bottom Nav */}
      <BottomNav active="stocks" onNavigate={onNavigate} onEnterScreen={onEnterScreen} />
    </div>
  );
};
