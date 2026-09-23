import React, { useEffect, useState } from 'react';

interface StatusBarProps {
  brand?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ brand }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      style={{
        padding: '14px 20px 6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {brand ? (
        <span
          style={{
            fontSize: 'var(--type-15)',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.3px',
            color: 'var(--text-primary)',
          }}
        >
          {brand}
        </span>
      ) : (
        <span />
      )}
      <span
        style={{
          fontSize: 'var(--type-11)',
          fontWeight: 700,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {time}
      </span>
    </div>
  );
};
