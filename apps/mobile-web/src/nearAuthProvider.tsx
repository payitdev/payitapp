/**
 * NEAR Auth Provider Configuration
 * Wraps the app with FastAuthProvider for NEAR Auth integration
 * Supports all login methods: Google, Apple, email/password, and passkey
 */

import React from 'react';
import { FastAuthProvider } from "@fast-auth-near/react-sdk";
import { JavascriptProvider } from "@fast-auth-near/javascript-provider";

const NETWORK = "testnet";
const CLIENT_ID = (import.meta as any).env?.VITE_AUTH_NEAR_CLIENT_ID_TESTNET || "np8paqIpMWmNbzT4xAvOOapZBjsOpptl";

const provider = new JavascriptProvider({
  network: NETWORK,
  clientId: CLIENT_ID,
});

export function NearAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <FastAuthProvider
      providerConfig={{ provider }}
      network={NETWORK}
      connection={null as any}
    >
      {children}
    </FastAuthProvider>
  );
}
