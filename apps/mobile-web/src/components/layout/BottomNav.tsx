import React from 'react';
import type { PrimaryScreen } from '../../types/navigation';
import { HomeIcon, ActivityIcon, InvestIcon, VaultIcon, CardsIcon, ProfileIcon } from './NavIcons';
import { triggerLightHaptic } from '../../hooks/useHaptics';

interface BottomNavProps {
  active: PrimaryScreen;
  onNavigate: (screen: PrimaryScreen) => void;
  onEnterScreen?: Partial<Record<PrimaryScreen, () => void>>;
}

const NAV_ITEMS: Array<{ screen: PrimaryScreen; label: string; icon: React.FC }> = [
  { screen: 'home', label: 'Home', icon: HomeIcon },
  { screen: 'activity', label: 'Activity', icon: ActivityIcon },
  { screen: 'stocks', label: 'Invest', icon: InvestIcon },
  { screen: 'savings', label: 'Vault', icon: VaultIcon },
  { screen: 'cards', label: 'Cards', icon: CardsIcon },
  { screen: 'profile', label: 'Profile', icon: ProfileIcon },
];

export const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate, onEnterScreen }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 16,
        right: 16,
        maxWidth: 408,
        margin: '0 auto',
        height: 64,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-pill)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 6px',
        zIndex: 900,
        boxSizing: 'border-box',
      }}
    >
      {NAV_ITEMS.map(({ screen, label, icon: Icon }) => {
        const isActive = active === screen;
        return (
          <button
            key={screen}
            onClick={() => {
              triggerLightHaptic();
              onNavigate(screen);
              onEnterScreen?.[screen]?.();
            }}
            style={{
              flex: 1,
              height: 48,
              background: isActive ? 'rgba(53, 217, 208, 0.15)' : 'transparent',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 200ms ease, color 200ms ease',
              color: isActive ? 'var(--accent-teal)' : 'var(--text-muted)',
              padding: 0,
            }}
          >
            <Icon />
            {isActive && (
              <span
                style={{
                  fontSize: 'var(--type-11)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
