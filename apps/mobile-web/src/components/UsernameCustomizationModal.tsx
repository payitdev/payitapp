import React, { useState, useEffect } from 'react';
import { apiFetch } from '../apiClient';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

interface Props {
  isOpen: boolean;
  entityId: string;
  currentUsername?: string;
  onSuccess: (newUsername: string) => void;
  onClose?: () => void;
}

export const UsernameCustomizationModal: React.FC<Props> = ({
  isOpen,
  entityId,
  currentUsername,
  onSuccess,
  onClose,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<{ available?: boolean; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (currentUsername) {
      const clean = currentUsername.startsWith('@') ? currentUsername.slice(1) : currentUsername;
      setUsernameInput(clean);
    }
  }, [currentUsername]);

  if (!isOpen) return null;

  const handleInputChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    setUsernameInput(clean);
    setAvailabilityMessage(null);
    setErrorMsg('');
  };

  const checkAvailability = async () => {
    if (usernameInput.length < 3) {
      setAvailabilityMessage({ available: false, text: 'Username must be at least 3 characters long.' });
      return;
    }

    setIsChecking(true);
    setErrorMsg('');
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/users/check-username?username=${encodeURIComponent(usernameInput)}`);
      const data = await res.json();
      if (res.ok) {
        setAvailabilityMessage({ available: data.available, text: data.message });
      } else {
        setAvailabilityMessage({ available: false, text: data.error || 'Invalid username' });
      }
    } catch {
      setAvailabilityMessage({ available: false, text: 'Unable to verify availability' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleClaim = async () => {
    if (!usernameInput || usernameInput.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/users/update-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId,
          newUsername: `@${usernameInput}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update username');
      }

      onSuccess(data.username);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not claim username. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(6, 27, 24, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #0B2924 0%, #061B18 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '28px',
        boxShadow: '0 0 32px rgba(22, 199, 183, 0.15)',
        color: '#F7F8F4',
        fontFamily: "'Satoshi', sans-serif",
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(22, 199, 183, 0.15)',
            border: '1px solid #35D9D0',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 0 20px rgba(22, 199, 183, 0.25)',
          }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#35D9D0' }}>@</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.02em', color: '#F7F8F4' }}>
            Claim Your Unique Proxim Handle
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(247, 248, 244, 0.7)', margin: 0, lineHeight: '1.5' }}>
            Your handle allows anyone to send or request money instantly across any currency.
          </p>
        </div>

        {/* Notice Badge */}
        <div style={{
          backgroundColor: 'rgba(214, 182, 90, 0.1)',
          border: '1px solid rgba(214, 182, 90, 0.3)',
          borderRadius: '14px',
          padding: '12px 14px',
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D6B65A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p style={{ fontSize: '12px', color: '#D6B65A', margin: 0, lineHeight: '1.4', fontWeight: 500 }}>
            <strong>One-Time Setting:</strong> Once confirmed, your handle is locked permanently for your account security.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(247, 248, 244, 0.6)', marginBottom: '8px' }}>
            Proxim Handle
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{
              position: 'absolute',
              left: '16px',
              color: '#35D9D0',
              fontSize: '16px',
              fontWeight: 700,
            }}>@</span>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={checkAvailability}
              placeholder="alex_smith"
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: availabilityMessage?.available === false ? '1px solid #FF5DA8' : availabilityMessage?.available === true ? '1px solid #16C7B7' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '14px',
                padding: '12px 16px 12px 38px',
                fontSize: '15px',
                fontWeight: 500,
                color: '#F7F8F4',
                outline: 'none',
                transition: 'all 0.15s ease-out',
                fontFamily: "'Satoshi', sans-serif",
              }}
            />
          </div>

          {/* Availability Status */}
          {isChecking && (
            <p style={{ fontSize: '12px', color: '#35D9D0', marginTop: '6px', marginBottom: 0 }}>Checking availability...</p>
          )}

          {availabilityMessage && !isChecking && (
            <p style={{
              fontSize: '12px',
              fontWeight: 500,
              marginTop: '6px',
              marginBottom: 0,
              color: availabilityMessage.available ? '#35D9D0' : '#FF5DA8',
            }}>
              {availabilityMessage.text}
            </p>
          )}

          {errorMsg && (
            <p style={{ fontSize: '12px', color: '#FF5DA8', marginTop: '6px', marginBottom: 0 }}>{errorMsg}</p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'rgba(247, 248, 244, 0.8)',
                cursor: 'pointer',
                fontFamily: "'Satoshi', sans-serif",
                transition: 'all 0.15s ease-out',
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleClaim}
            disabled={isSubmitting || availabilityMessage?.available === false || !usernameInput}
            style={{
              flex: 2,
              backgroundColor: isSubmitting || availabilityMessage?.available === false || !usernameInput ? 'rgba(255, 255, 255, 0.1)' : '#16C7B7',
              border: 'none',
              borderRadius: '999px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 700,
              color: isSubmitting || availabilityMessage?.available === false || !usernameInput ? 'rgba(247, 248, 244, 0.4)' : '#061B18',
              cursor: isSubmitting || availabilityMessage?.available === false || !usernameInput ? 'not-allowed' : 'pointer',
              boxShadow: isSubmitting || availabilityMessage?.available === false || !usernameInput ? 'none' : '0 0 20px rgba(22, 199, 183, 0.25)',
              transition: 'all 0.15s ease-out',
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            {isSubmitting ? 'Confirming...' : 'Claim & Confirm Handle'}
          </button>
        </div>
      </div>
    </div>
  );
};

