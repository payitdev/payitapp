import React, { useState, useEffect, useRef } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { triggerLightHaptic } from '../hooks/useHaptics';
import { apiFetch } from '../apiClient';

interface TelegramManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramManagerModal: React.FC<TelegramManagerModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'unlinked' | 'linked' | 'error'>('unlinked');
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await apiFetch('/api/auth/telegram/link/status');
      const data = await res.json();
      if (data.success && data.linked) {
        setStatus('linked');
        setTelegramUsername(data.telegramUsername || null);
      } else {
        setStatus('unlinked');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Unable to check status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    } else {
      // Clear any ongoing poll when modal closes
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setLoading(false);
      }
    }
  }, [isOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleConnect = async () => {
    triggerLightHaptic();
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await apiFetch('/api/auth/telegram/link/start', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.botUrl) {
        // Open Telegram deep link in a new tab (preserves web app session)
        window.open(data.botUrl, '_blank', 'noopener,noreferrer');
        // Start polling for confirmation
        pollForLinkConfirmation();
      }
    } catch {
      setErrorMessage('We could not start the linking process. Please try again.');
      setLoading(false);
    }
  };

  const pollForLinkConfirmation = () => {
    let attempts = 0;
    const maxAttempts = 20;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await apiFetch('/api/auth/telegram/link/status');
        const data = await res.json();
        if (data.success && data.linked) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setStatus('linked');
          setTelegramUsername(data.telegramUsername || null);
          setLoading(false);
        } else if (attempts >= maxAttempts) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setLoading(false);
          setErrorMessage('Telegram was not linked in time. Please try again.');
        }
      } catch {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setLoading(false);
      }
    }, 3000);
  };

  const handleRevoke = async () => {
    triggerLightHaptic();
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await apiFetch('/api/auth/telegram/unlink', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || 'Revoke failed. Please try again.');
        setLoading(false);
        return;
      }
      setStatus('unlinked');
      setTelegramUsername(null);
    } catch {
      setErrorMessage('We could not revoke access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Telegram">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-body)' }}>
        {loading ? (
          <div
            style={{
              fontSize: 'var(--type-13)',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '32px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--hairline)',
                borderTopColor: 'var(--accent-teal)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>Just a moment...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : status === 'linked' ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: 'rgba(53, 217, 208, 0.06)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(53, 217, 208, 0.2)',
              }}
            >
              {/* Telegram icon placeholder */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--accent-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 20,
                }}
              >
                ✈️
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)' }}>
                  Connected as
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-15)',
                    fontWeight: 700,
                    color: 'var(--accent-teal)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {telegramUsername ? `@${telegramUsername}` : 'Telegram account'}
                </div>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--accent-teal)',
                  background: 'rgba(53, 217, 208, 0.12)',
                  borderRadius: '20px',
                  padding: '3px 10px',
                }}
              >
                Active
              </div>
            </div>
            <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Your Proxim account is connected to this Telegram account. You can send money, check balances, and manage cards directly in the bot using your 6-digit PIN.
            </div>
            {errorMessage && (
              <div style={{ fontSize: 'var(--type-13)', color: 'var(--danger)', padding: '12px', background: 'rgba(255,80,80,0.06)', borderRadius: 'var(--radius-lg)' }}>
                {errorMessage}
              </div>
            )}
            <button
              onClick={handleRevoke}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--danger, #ef4444)',
                fontSize: 'var(--type-15)',
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              Revoke access
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div style={{ fontSize: 48, lineHeight: 1 }}>✈️</div>
            </div>
            <div style={{ fontSize: 'var(--type-15)', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
              Connect Telegram
            </div>
            <div style={{ fontSize: 'var(--type-13)', color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
              Link your Telegram account to manage your money, get payment alerts, and use the Proxim bot — all secured with your 6-digit PIN.
            </div>
            {errorMessage && (
              <div style={{ fontSize: 'var(--type-13)', color: 'var(--danger)', padding: '12px', background: 'rgba(255,80,80,0.06)', borderRadius: 'var(--radius-lg)' }}>
                {errorMessage}
              </div>
            )}
            <Button variant="primary" fullWidth onClick={handleConnect}>
              Connect Telegram
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
};
