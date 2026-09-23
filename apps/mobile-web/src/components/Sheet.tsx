import React, { useEffect } from 'react';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 8, 17, 0.60)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 250ms ease',
        }}
      />

      {/* Sheet panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          margin: '0 auto',
          background: 'var(--surface)',
          borderTopLeftRadius: 'var(--radius-sheet)',
          borderTopRightRadius: 'var(--radius-sheet)',
          borderTop: '1px solid var(--hairline)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          animation: 'slideUp 250ms ease-out',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
          }}
        >
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255, 255, 255, 0.15)',
            }}
          />
        </div>

        {/* Title if provided */}
        {title && (
          <div
            style={{
              padding: '8px 20px 16px',
              fontSize: 'var(--type-20)',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            {title}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            padding: '16px 20px 32px',
            overflowY: 'auto',
            flex: 1,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
