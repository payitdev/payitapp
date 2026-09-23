import React from 'react';

export interface EmptyStateProps {
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'Nothing yet — your activity will show up here.',
}) => {
  return (
    <div
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        fontSize: 'var(--type-13)',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
};
