import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthCoreContextProvider } from '@particle-network/auth-core-modal';
import App from './App';
import '@payit/ui/dist/index.css';

if (typeof window !== 'undefined') {
  if (!(window as any).Buffer) {
    (window as any).Buffer = Buffer;
  }
  if (!(window as any).global) {
    (window as any).global = window;
  }
}

const PROJECT_ID = (import.meta as any).env?.VITE_PARTICLE_PROJECT_ID || '75f2454c-1316-4d83-9a71-4ea850b261c2';
const CLIENT_KEY = (import.meta as any).env?.VITE_PARTICLE_CLIENT_KEY || 'cWSajgx7oVLlukErkSa9zkeF9yXOPg8nnU3Jtsx9';
const APP_ID = (import.meta as any).env?.VITE_PARTICLE_APP_ID || '229d322e-7d32-48c6-8e44-bf73ec47aa06';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthCoreContextProvider
      options={{
        projectId: PROJECT_ID,
        clientKey: CLIENT_KEY,
        appId: APP_ID,
        authTypes: ['email', 'google', 'apple'] as any,
        themeType: 'dark',
        fiatCoin: 'USD',
        promptSettingConfig: {
          promptPaymentPasswordSettingWhenSign: 0,
          promptMasterPasswordSettingWhenLogin: 0,
        },
        wallet: {
          visible: false,
          customStyle: {},
        },
      }}
    >
      <App />
    </AuthCoreContextProvider>
  </React.StrictMode>
);
