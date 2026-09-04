import React, { useState } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  id,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 'var(--type-13)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={{
          background: 'var(--surface)',
          border: error
            ? '1.5px solid var(--danger)'
            : isFocused
            ? '1.5px solid var(--accent-teal)'
            : '1px solid var(--hairline)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          fontSize: 'var(--type-15)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
          outline: 'none',
          boxSizing: 'border-box',
          width: '100%',
          ...style,
        }}
        onFocus={(e) => {
          setIsFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (onBlur) onBlur(e);
        }}
        {...props}
      />
      {error && (
        <div
          style={{
            fontSize: 'var(--type-13)',
            color: 'var(--danger)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
