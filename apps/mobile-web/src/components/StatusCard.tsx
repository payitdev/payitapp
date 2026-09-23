import React from 'react';
import { Lock, Clock, CheckCircle2 } from 'lucide-react';

export interface StatusCardProps {
  tone: 'action' | 'pending' | 'success';
  title: string;
  subtitle: string;
  cta?: {
    label: string;
    onClick: () => void;
  } | React.ReactNode;
}

export const StatusCard: React.FC<StatusCardProps> = ({ tone, title, subtitle, cta }) => {
  const getToneStyles = () => {
    switch (tone) {
      case 'action':
        return {
          bg: 'rgba(53, 217, 208, 0.10)',
          border: '1px solid rgba(53, 217, 208, 0.20)',
          iconColor: 'var(--accent-teal)',
          Icon: Lock,
        };
      case 'pending':
        return {
          bg: 'rgba(214, 182, 90, 0.10)',
          border: '1px solid rgba(214, 182, 90, 0.20)',
          iconColor: 'var(--warning)',
          Icon: Clock,
        };
      case 'success':
        return {
          bg: 'rgba(22, 199, 183, 0.10)',
          border: '1px solid rgba(22, 199, 183, 0.20)',
          iconColor: 'var(--accent-teal-deep)',
          Icon: CheckCircle2,
        };
    }
  };

  const { bg, border, iconColor, Icon } = getToneStyles();

  return (
    <div
      style={{
        background: bg,
        border: border,
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <Icon size={18} color={iconColor} style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--type-15)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 'var(--type-13)',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
      {cta && (
        <div style={{ flexShrink: 0 }}>
          {React.isValidElement(cta) ? (
            cta
          ) : typeof cta === 'object' && 'label' in cta ? (
            <button
              onClick={cta.onClick}
              style={{
                background: tone === 'action' ? 'var(--gradient-aurora)' : 'transparent',
                border: tone === 'action' ? 'none' : `1px solid ${iconColor}`,
                color: tone === 'action' ? 'var(--text-on-surface)' : iconColor,
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                fontSize: 'var(--type-11)',
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              {cta.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
