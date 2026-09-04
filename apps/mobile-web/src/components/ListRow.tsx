import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface ListRowProps {
  icon?: React.ReactNode;
  avatarText?: string;
  title: string;
  meta?: string;
  amount?: string;
  isIncoming?: boolean;
  statusChip?: React.ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
}

export const ListRow: React.FC<ListRowProps> = ({
  icon,
  avatarText,
  title,
  meta,
  amount,
  isIncoming,
  statusChip,
  showChevron,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--hairline)',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-body)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        {icon ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: isIncoming ? 'var(--accent-teal)' : 'var(--text-muted)',
            }}
          >
            {icon}
          </div>
        ) : avatarText ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--type-13)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              flexShrink: 0,
            }}
          >
            {avatarText}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 'var(--type-15)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {meta && (
            <div
              style={{
                fontSize: 'var(--type-13)',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {meta}
            </div>
          )}
        </div>
      </div>

      {(amount !== undefined || statusChip || showChevron) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px',
            flexShrink: 0,
            marginLeft: '12px',
          }}
        >
          {amount !== undefined && (
            <div
              style={{
                fontSize: 'var(--type-15)',
                fontWeight: 700,
                color: isIncoming ? 'var(--accent-teal)' : 'var(--text-primary)',
              }}
            >
              {amount}
            </div>
          )}
          {statusChip}
          {showChevron && <ChevronRight size={18} color="var(--text-muted)" />}
        </div>
      )}
    </div>
  );
};
