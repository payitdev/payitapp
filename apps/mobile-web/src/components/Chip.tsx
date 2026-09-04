import React from 'react';

export interface ChipProps {
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'teal';
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Chip: React.FC<ChipProps> = ({
  tone = 'neutral',
  children,
  onClick,
  style,
}) => {
  const getToneStyles = (): { bg: string; color: string; border?: string } => {
    switch (tone) {
      case 'success':
        return {
          bg: 'rgba(22, 199, 183, 0.15)',
          color: 'var(--accent-teal-deep)',
        };
      case 'warning':
        return {
          bg: 'rgba(214, 182, 90, 0.15)',
          color: 'var(--warning)',
        };
      case 'danger':
        return {
          bg: 'rgba(255, 77, 77, 0.15)',
          color: 'var(--danger)',
        };
      case 'teal':
        return {
          bg: 'rgba(53, 217, 208, 0.15)',
          color: 'var(--accent-teal)',
        };
      case 'neutral':
        return {
          bg: 'var(--surface)',
          color: 'var(--text-muted)',
          border: '1px solid var(--hairline)',
        };
    }
  };

  const { bg, color, border } = getToneStyles();

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 'var(--radius-pill)',
        background: bg,
        color: color,
        border: border || 'none',
        fontSize: 'var(--type-11)',
        fontWeight: 700,
        fontFamily: 'var(--font-body)',
        textTransform: 'none', // sentence case always
        letterSpacing: 'normal',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </span>
  );
};
