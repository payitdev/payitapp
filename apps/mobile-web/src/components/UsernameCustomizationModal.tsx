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
      inset: 0,
      backgroundColor: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#F8FAFC',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.4)',
          }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFF' }}>@</span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Claim Your Unique PayIT @username
          </h2>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }}>
            Your handle allows anyone to send or request money instantly across any currency.
          </p>
        </div>

        {/* Notice Badge */}
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <p style={{ fontSize: '12px', color: '#FDE047', margin: 0, lineHeight: '1.4' }}>
            <strong>One-Time Setting:</strong> Once confirmed, your handle is locked permanently for your account security.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: '8px' }}>
            PayIT Handle
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{
              position: 'absolute',
              left: '16px',
              color: '#0EA5E9',
              fontSize: '18px',
              fontWeight: '700',
            }}>@</span>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={checkAvailability}
              placeholder="alex_smith"
              style={{
                width: '100%',
                backgroundColor: '#1E293B',
                border: availabilityMessage?.available === false ? '1px solid #EF4444' : availabilityMessage?.available === true ? '1px solid #10B981' : '1px solid #334155',
                borderRadius: '14px',
                padding: '14px 16px 14px 38px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#F8FAFC',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
            />
          </div>

          {/* Availability Status */}
          {isChecking && (
            <p style={{ fontSize: '12px', color: '#38BDF8', marginTop: '6px', marginBottom: 0 }}>Checking availability...</p>
          )}

          {availabilityMessage && !isChecking && (
            <p style={{
              fontSize: '12px',
              fontWeight: '500',
              marginTop: '6px',
              marginBottom: 0,
              color: availabilityMessage.available ? '#34D399' : '#F87171',
            }}>
              {availabilityMessage.available ? '✓ ' : '✕ '} {availabilityMessage.text}
            </p>
          )}

          {errorMsg && (
            <p style={{ fontSize: '12px', color: '#F87171', marginTop: '6px', marginBottom: 0 }}>{errorMsg}</p>
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
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#94A3B8',
                cursor: 'pointer',
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
              backgroundColor: isSubmitting || availabilityMessage?.available === false || !usernameInput ? '#334155' : '#0EA5E9',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: '700',
              color: '#FFFFFF',
              cursor: isSubmitting || availabilityMessage?.available === false || !usernameInput ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 20px -5px rgba(14, 165, 233, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {isSubmitting ? 'Confirming...' : 'Claim & Confirm Handle'}
          </button>
        </div>
      </div>
    </div>
  );
};
