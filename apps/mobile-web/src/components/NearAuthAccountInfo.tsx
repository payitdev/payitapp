/**
 * NEAR Auth Account Info Component
 * Uses useSigner and usePublicKey hooks to derive the user's NEAR public key
 */

import React from 'react';
import { useSigner, usePublicKey } from '@fast-auth-near/react-sdk';

export function NearAuthAccountInfo() {
  const { signer, isLoading, error } = useSigner();
  const { publicKey } = usePublicKey();

  if (isLoading) {
    return <div>Loading signer...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!signer) {
    return <div>Please log in first</div>;
  }

  return (
    <div>
      <h3>NEAR Auth Account Info</h3>
      <div>
        <strong>Public Key:</strong>{' '}
        <code>{publicKey?.toString() || 'Not available'}</code>
      </div>
      <div>
        <strong>Signer Status:</strong> {signer ? 'Active' : 'Inactive'}
      </div>
    </div>
  );
}
