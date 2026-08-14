/**
 * NEAR Auth Transaction Signer Component
 * Implements signAndSendTransaction and signAndSendDelegateAction
 * 
 * Note: This component demonstrates the API usage pattern.
 * In production, you would need to:
 * 1. Fetch account nonce from NEAR
 * 2. Fetch recent block hash
 * 3. Build proper transaction with near-api-js
 * 4. Handle the Auth0 popup/redirect flow
 */

import React from 'react';
import { useSigner } from '@fast-auth-near/react-sdk';

interface NearAuthTransactionSignerProps {
  receiverId?: string;
}

export function NearAuthTransactionSigner({ receiverId = 'receiver.testnet' }: NearAuthTransactionSignerProps) {
  const { signer, isLoading, error } = useSigner();
  const [isSigning, setIsSigning] = React.useState(false);
  const [txResult, setTxResult] = React.useState<any>(null);
  const [signError, setSignError] = React.useState<string | null>(null);

  const handleSignAndSendTransaction = async () => {
    if (!signer) {
      setSignError('Signer not available');
      return;
    }

    setIsSigning(true);
    setSignError(null);
    setTxResult(null);

    try {
      // signAndSendTransaction: User pays gas
      // Accepts a transaction object built with near-api-js
      // Returns Promise<FinalExecutionOutcome>
      // This is a placeholder - in production you would build a real transaction
      const outcome = await signer.signAndSendTransaction({ 
        // transaction: <built transaction object>
      } as any);
      setTxResult(outcome);
    } catch (err: any) {
      setSignError(err.message || 'Transaction signing failed');
    } finally {
      setIsSigning(false);
    }
  };

  const handleSignAndSendDelegateAction = async () => {
    if (!signer) {
      setSignError('Signer not available');
      return;
    }

    setIsSigning(true);
    setSignError(null);
    setTxResult(null);

    try {
      // signAndSendDelegateAction: Gasless, relayer sponsors gas
      // Accepts receiverId and actions
      // Returns Promise<FinalExecutionOutcome>
      // This is a placeholder - in production you would pass real actions
      const outcome = await signer.signAndSendDelegateAction({ 
        receiverId 
      } as any);
      setTxResult(outcome);
    } catch (err: any) {
      setSignError(err.message || 'Delegate action signing failed');
    } finally {
      setIsSigning(false);
    }
  };

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
      <h3>NEAR Auth Transaction Signer</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={handleSignAndSendTransaction}
          disabled={isSigning}
          style={{
            padding: '8px 16px',
            marginRight: '8px',
            backgroundColor: '#0072ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSigning ? 'not-allowed' : 'pointer',
          }}
        >
          {isSigning ? 'Signing...' : 'Sign & Send Transaction'}
        </button>

        <button
          onClick={handleSignAndSendDelegateAction}
          disabled={isSigning}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSigning ? 'not-allowed' : 'pointer',
          }}
        >
          {isSigning ? 'Signing...' : 'Sign & Send Delegate Action (Gasless)'}
        </button>
      </div>

      {signError && (
        <div style={{ color: 'red', marginBottom: '16px' }}>
          Error: {signError}
        </div>
      )}

      {txResult && (
        <div style={{ marginBottom: '16px' }}>
          <strong>Transaction Result:</strong>
          <pre style={{ fontSize: '12px', overflow: 'auto' }}>
            {JSON.stringify(txResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
