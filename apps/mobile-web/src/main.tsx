import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TelegramKycApp } from './TelegramKycApp';
import { PrivyProvider } from './PrivyProvider';
import '@payit/ui/dist/index.css';

if (typeof window !== 'undefined') {
  if (!(window as any).Buffer) {
    (window as any).Buffer = Buffer;
  }
  if (!(window as any).global) {
    (window as any).global = window;
  }
}

const isTelegramMiniApp = typeof window !== 'undefined'
  && !new URLSearchParams(window.location.search).has('telegram_claim')
  && Boolean((window as any).Telegram?.WebApp?.initData);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isTelegramMiniApp ? <TelegramKycApp /> : <PrivyProvider><App /></PrivyProvider>}
  </React.StrictMode>
);
