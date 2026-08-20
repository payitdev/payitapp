/**
 * Privy Provider with Proxim Brand Guide Integration
 * 
 * Wraps the app with Privy authentication and multi-chain settlement functionality
 */

import React, { createContext, useContext, useState } from 'react';
import { PrivyProvider as BasePrivyProvider, usePrivy as usePrivyBase } from '@privy-io/react-auth';

// Environment variables
const PRIVY_APP_ID = (import.meta as any).env?.VITE_PRIVY_APP_ID || '';
const PRIVY_CLIENT_ID = (import.meta as any).env?.VITE_PRIVY_CLIENT_ID || '';

interface PrivyContextType {
  authenticated: boolean;
  user: any;
  nearAccount: any;
  logout: () => Promise<void>;
}

const PrivyContext = createContext<PrivyContextType | null>(null);

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [nearAccount, setNearAccount] = useState<any>(null);

  const handleLoginSuccess = async (privyUser: any) => {
    console.log('User logged in with Privy:', privyUser);
    setUser(privyUser);
    setAuthenticated(true);
    
    try {
      const email = privyUser.email?.address || privyUser.google?.email || privyUser.apple?.email || `${privyUser.id}@privy.user`;
      const walletAddress = privyUser.wallet?.address;

      const res = await fetch('/api/auth/privy/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyUserId: privyUser.id,
          email,
          walletAddress,
        }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('proxim_session_token', data.token);
        localStorage.setItem('payit_session_token', data.token);
        localStorage.setItem('proxim_current_user', JSON.stringify(data.user));
        localStorage.setItem('payit_current_user', JSON.stringify(data.user));
        console.log('✅ Session token synced with Proxim backend.');
      }
    } catch (err: any) {
      console.error('Failed to sync Privy session with backend:', err.message);
    }
  };

  const handleLogout = async () => {
    console.log('User logged out');
    setUser(null);
    setAuthenticated(false);
    setNearAccount(null);
    localStorage.removeItem('proxim_session_token');
    localStorage.removeItem('payit_session_token');
    localStorage.removeItem('proxim_current_user');
    localStorage.removeItem('payit_current_user');
  };

  return (
    <PrivyContext.Provider
      value={{
        authenticated,
        user,
        nearAccount,
        logout: handleLogout,
      }}
    >
      <BasePrivyProvider
        appId={PRIVY_APP_ID}
        clientId={PRIVY_CLIENT_ID}
        config={{
          appearance: {
            theme: 'dark',
            accentColor: '#16C7B7',
            logo: '/proxim-icon.png',
            showWalletLoginFirst: false,
          },
        }}
      >
        {children}
      </BasePrivyProvider>
    </PrivyContext.Provider>
  );
}

export function useProximPrivy() {
  const context = useContext(PrivyContext);
  if (!context) {
    return {
      authenticated: false,
      user: null,
      nearAccount: null,
      logout: async () => {},
    };
  }
  return context;
}

export { usePrivyBase as usePrivy };