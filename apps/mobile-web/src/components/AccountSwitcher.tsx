import React from 'react';
import { triggerLightHaptic } from '../hooks/useHaptics';

export interface AccountSwitcherProps {
  accountType: 'PERSONAL' | 'BUSINESS';
  onToggle: () => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ accountType, onToggle }) => {
  const handleToggle = () => {
    triggerLightHaptic();
    onToggle();
  };

  const isPersonal = accountType === 'PERSONAL';

  return (
    <div
      onClick={handleToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-pill)',
        padding: '3px',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          padding: '5px 12px',
          borderRadius: 'var(--radius-pill)',
          background: isPersonal ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          color: isPersonal ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 'var(--type-11)',
          fontWeight: 700,
          transition: 'all 150ms ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {isPersonal && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--accent-teal)',
            }}
          />
        )}
        Personal
      </div>
      <div
        style={{
          padding: '5px 12px',
          borderRadius: 'var(--radius-pill)',
          background: !isPersonal ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          color: !isPersonal ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 'var(--type-11)',
          fontWeight: 700,
          transition: 'all 150ms ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {!isPersonal && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--accent-teal)',
            }}
          />
        )}
        Business
      </div>
    </div>
  );
};
