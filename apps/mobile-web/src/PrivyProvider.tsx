/**
 * Privy Provider with Proxim Brand Guide Integration
 * 
 * Wraps the app with Privy authentication and multi-chain settlement functionality
 */

import React from 'react';
import { PrivyProvider as BasePrivyProvider, usePrivy } from '@privy-io/react-auth';

// Environment variables
const PRIVY_APP_ID = (import.meta as any).env?.VITE_PRIVY_APP_ID || '';

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['google', 'apple', 'email'],
        appearance: {
          theme: 'dark',
          accentColor: '#16C7B7',
          logo: '/proxim-icon.png',
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}

export { usePrivy };