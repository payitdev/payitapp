import React from 'react';

export interface LoadingStateProps {
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ rows = 3 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--surface)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  width: 120,
                  height: 14,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                }}
              />
              <div
                style={{
                  width: 80,
                  height: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                }}
              />
            </div>
          </div>
          <div
            style={{
              width: 60,
              height: 14,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
            }}
          />
        </div>
      ))}
    </div>
  );
};
