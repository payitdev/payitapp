/**
 * Privy Login Component
 * 
 * Handles authentication via Privy (Google, Apple, Email)
 * Styled according to the Proxim Brand System
 */

import React, { useState } from 'react';
import { useLogin } from '@privy-io/react-auth';
import { ArrowRight, Lock } from 'lucide-react';

interface PrivyLoginProps {
  onLoginSuccess?: (user: any) => void;
  onLoginError?: (error: string) => void;
}

export function PrivyLogin({ onLoginSuccess, onLoginError }: PrivyLoginProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const { login } = useLogin({
    onComplete: ({ user }: any) => {
      console.log('✅ Proxim authentication completed:', user);
      setIsLoggingIn(false);
      if (user) {
        onLoginSuccess?.(user);
      }
    },
    onError: (error: any) => {
      console.error('Proxim login error:', error);
      setIsLoggingIn(false);
      const msg = typeof error === 'string' ? error : error?.message || 'Authentication failed';
      setLoginError(msg);
      onLoginError?.(msg);
    },
  });

  const handleLoginClick = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await login();
    } catch (err: any) {
      setIsLoggingIn(false);
      setLoginError(err.message || 'Failed to initialize authentication');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={handleLoginClick}
        disabled={isLoggingIn}
        className="cta"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 10,
          opacity: isLoggingIn ? 0.7 : 1,
          cursor: isLoggingIn ? 'not-allowed' : 'pointer',
          background: '#16C7B7',
          color: '#061B18',
          fontWeight: 700,
          padding: '14px 16px',
          borderRadius: 999,
          boxShadow: '0 0 20px rgba(22, 199, 183, 0.2)',
          fontFamily: "'Satoshi', sans-serif",
          border: 'none',
          transition: 'all 0.15s ease-out',
        }}
      >
        <Lock className="w-4 h-4" />
        {isLoggingIn ? 'Connecting...' : 'Sign in with Privy'}
        <ArrowRight className="w-4 h-4" />
      </button>
      
      <button
        onClick={handleLoginClick}
        disabled={isLoggingIn}
        className="cta ghost"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 10,
          opacity: isLoggingIn ? 0.7 : 1,
          cursor: isLoggingIn ? 'not-allowed' : 'pointer',
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#F7F8F4',
          fontWeight: 500,
          padding: '13px 16px',
          borderRadius: 14,
          fontFamily: "'Satoshi', sans-serif",
          transition: 'all 0.15s ease-out',
        }}
      >
        {isLoggingIn ? 'Connecting...' : 'Sign in with Google or Apple'}
      </button>

      {loginError && (
        <div style={{ 
          background: 'rgba(255, 93, 168, 0.12)', 
          border: '1px solid #FF5DA8', 
          color: '#FF5DA8', 
          padding: 12, 
          borderRadius: 14, 
          fontSize: 12, 
          textAlign: 'center',
          fontFamily: "'Satoshi', sans-serif",
        }}>
          {loginError}
        </div>
      )}
    </div>
  );
}