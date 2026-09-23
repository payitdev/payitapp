import React from 'react';
import { Button } from '../Button';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = "We couldn't load this information. Please try again.",
  onRetry,
}) => {
  return (
    <div
      style={{
        padding: '16px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--type-13)',
          color: 'var(--danger)',
          lineHeight: 1.4,
          flex: 1,
        }}
      >
        {message}
      </div>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry} style={{ padding: '4px 8px', minHeight: 36 }}>
          Retry
        </Button>
      )}
    </div>
  );
};
