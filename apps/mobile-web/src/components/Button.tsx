import React from 'react';
import { triggerLightHaptic } from '../hooks/useHaptics';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  fullWidth = false,
  children,
  onClick,
  style,
  disabled,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerLightHaptic();
    if (onClick) onClick(e);
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: disabled ? 'rgba(255, 255, 255, 0.1)' : 'var(--gradient-aurora)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-on-surface)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '14px 24px',
          fontSize: 'var(--type-15)',
          fontWeight: 700,
          minHeight: 48,
        };
      case 'secondary':
        return {
          background: 'var(--surface)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius-pill)',
          padding: '12px 20px',
          fontSize: 'var(--type-15)',
          fontWeight: 500,
          minHeight: 44,
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: disabled ? 'var(--text-muted)' : 'var(--accent-teal)',
          border: 'none',
          padding: '8px 12px',
          fontSize: 'var(--type-13)',
          fontWeight: 700,
          minHeight: 44,
        };
      case 'icon':
        return {
          background: 'var(--surface)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius-pill)',
          width: 44,
          height: 44,
          minWidth: 44,
          minHeight: 44,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        };
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'var(--font-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        outline: 'none',
        transition: 'transform 100ms ease, opacity 150ms ease',
        ...getVariantStyles(),
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'none';
      }}
      onTouchStart={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onTouchEnd={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'none';
      }}
      {...props}
    >
      {children}
    </button>
  );
};
