/**
 * NEAR Auth Login Button Component
 * Uses useFastAuth and useIsLoggedIn hooks from @fast-auth-near/react-sdk
 */

import React from 'react';
import { useFastAuth, useIsLoggedIn } from '@fast-auth-near/react-sdk';

interface NearAuthLoginButtonProps {
  onLoginSuccess?: (accountId: string) => void;
  onLoginError?: (error: Error) => void;
}

export function NearAuthLoginButton({ onLoginSuccess, onLoginError }: NearAuthLoginButtonProps) {
  const { client } = useFastAuth();
  const { isLoggedIn, refetch } = useIsLoggedIn();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = async () => {
    if (!client) {
      onLoginError?.(new Error('NEAR Auth client not available'));
      return;
    }

    setIsLoading(true);
    try {
      // client.login() opens an Auth0 popup or full-page redirect
      await client.login();
      
      // After redirect completes, refetch to update UI state
      await refetch();
      
      if (isLoggedIn) {
        onLoginSuccess?.('near-auth-user');
      }
    } catch (error: any) {
      onLoginError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoggedIn) {
    return <span>You're signed in with NEAR Auth</span>;
  }

  return (
    <button 
      onClick={handleLogin}
      disabled={isLoading || !client}
      style={{
        padding: '12px 24px',
        backgroundColor: '#0072ff',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isLoading || !client ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        fontWeight: '600',
      }}
    >
      {isLoading ? 'Signing in...' : 'Sign in with NEAR Auth'}
    </button>
  );
}
