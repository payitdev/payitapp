import React from 'react';
import { triggerLightHaptic } from '../../hooks/useHaptics';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 20px',
      width: '100%',
      boxSizing: 'border-box',
    }}
  >
    <button
      onClick={() => {
        triggerLightHaptic();
        onBack();
      }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-pill)',
        color: 'var(--text-muted)',
        fontSize: 'var(--type-11)',
        fontWeight: 700,
        fontFamily: 'var(--font-body)',
        padding: '6px 14px',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      Back
    </button>
    <div
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--type-24)',
        fontWeight: 800,
        color: 'var(--text-primary)',
        letterSpacing: '-0.3px',
      }}
    >
      {title}
    </div>
  </div>
);
