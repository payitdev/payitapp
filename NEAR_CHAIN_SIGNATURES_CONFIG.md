# NEAR Chain Signatures Configuration Guide

## Overview
PayIT uses NEAR Chain Signatures for MPC signing on Base and BSC networks. This configuration supports both testnet and mainnet environments.

## Environment Variables

### Required for Pods/Ondo Integration
```bash
# Pods Finance API Key
PODS_API_KEY=your-pods-api-key

# NEAR Chain Signatures Relayer Account
NEAR_RELAYER_ACCOUNT_ID=your-near-relayer-account-id
NEAR_RELAYER_PRIVATE_KEY=your-near-relayer-private-key

# NEAR Network (testnet or mainnet)
NEAR_NETWORK_ID=testnet  # or mainnet
```

### Network-Specific Contract IDs
The system automatically selects the correct contract ID based on `NEAR_NETWORK_ID`:

| Network | Contract ID | Use Case |
|---------|-------------|----------|
| testnet | `v1.signer-prod.testnet` | Development and testing |
| mainnet | `v1.signer` | Production transactions |

## Testnet Configuration (Current)

```bash
NEAR_NETWORK_ID=testnet
NEAR_RELAYER_ACCOUNT_ID=your-testnet-relayer-account.near
NEAR_RELAYER_PRIVATE_KEY=ed25519:your-testnet-private-key
```

## Mainnet Configuration (When FastAuth Grants Access)

```bash
NEAR_NETWORK_ID=mainnet
NEAR_RELAYER_ACCOUNT_ID=your-mainnet-relayer-account.near
NEAR_RELAYER_PRIVATE_KEY=ed25519:your-mainnet-private-key
```

## Transition Steps from Testnet to Mainnet

1. **Obtain FastAuth Full Access**
   - Contact FastAuth team to request mainnet access
   - Ensure your relayer account is approved for mainnet operations

2. **Update Environment Variables**
   ```bash
   # Change network to mainnet
   NEAR_NETWORK_ID=mainnet
   
   # Update relayer credentials to mainnet account
   NEAR_RELAYER_ACCOUNT_ID=your-mainnet-relayer-account.near
   NEAR_RELAYER_PRIVATE_KEY=ed25519:your-mainnet-private-key
   ```

3. **Verify Configuration**
   - Restart the backend server
   - Check logs for: `✅ Using NEAR mainnet for production transactions`
   - Verify contract ID is `v1.signer`

4. **Test with Small Amounts**
   - Start with small test transactions on mainnet
   - Verify address derivation works correctly
   - Confirm transaction signing and broadcasting

## Important Notes

### Address Derivation
- The same derivation path (`payit-{context}-{userIdentifier}`) works on both testnet and mainnet
- Addresses are derived deterministically based on the path
- Testnet and mainnet will have different addresses (network-specific)

### Chain Configuration
- Base (chainId 8453): Used for Savings funding and Ondo buy operations
- BSC (chainId 56): Used for Ondo sell operations
- Both chains use the same NEAR MPC relayer for signing

### Validation
The system validates configuration on startup:
```typescript
validatePodsEnv() // Returns true if properly configured
```

Logs warnings if:
- PODS_API_KEY not set
- NEAR relayer credentials not set
- Currently on testnet (informational)

## Testing

### Testnet Testing
```bash
# Ensure testnet configuration
NEAR_NETWORK_ID=testnet

# Run strategy discovery script
pnpm tsx src/scripts/fetch-pods-strategies.ts
pnpm tsx src/scripts/fetch-ondo-stocks.ts
```

### Mainnet Testing (After Transition)
```bash
# Ensure mainnet configuration
NEAR_NETWORK_ID=mainnet

# Test with small amounts first
# Verify transaction signing works
# Check address derivation matches expectations
```

## Security Considerations

### Private Key Management
- Store NEAR_RELAYER_PRIVATE_KEY securely (environment variable or secret manager)
- Never commit private keys to version control
- Rotate keys periodically for production

### Relayer Account
- Use a dedicated relayer account for MPC operations
- Ensure account has sufficient NEAR balance for gas fees
- Monitor account activity for unusual transactions

### Network Separation
- Use separate relayer accounts for testnet and mainnet
- Never use mainnet credentials on testnet or vice versa
- Clearly label environments in your deployment configuration

## Troubleshooting

### Issue: Chain signatures not working
**Solution**: 
- Verify NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY are set
- Check logs for configuration warnings
- Ensure network ID is correct (testnet vs mainnet)

### Issue: Wrong contract ID
**Solution**:
- The system auto-selects contract ID based on NEAR_NETWORK_ID
- If manually set, remove NEAR_CONTRACT_ID from environment
- Check logs for the contract ID being used

### Issue: Address derivation mismatch
**Solution**:
- Ensure same derivation path is used consistently
- Verify userIdentifier is the same across operations
- Check that context (personal/business) is correct

## Current Status

✅ **Testnet Configuration**: Currently configured and ready for testing
⏳ **Mainnet Access**: Pending FastAuth team approval
🔄 **Transition Plan**: Ready to switch to mainnet once access is granted

## Support

For issues with:
- **NEAR Chain Signatures**: Check [chainsig.js documentation](https://neardefi.github.io/chainsig.js/)
- **FastAuth Access**: Contact FastAuth team
- **Pods/Ondo Integration**: See integration reports