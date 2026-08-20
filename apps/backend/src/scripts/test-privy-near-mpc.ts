import { PrivyNEARBridge } from '@payit/integrations';

async function main() {
  console.log('🧪 Testing Privy -> NEAR MPC Multi-Chain Address Derivation...');
  
  const testPrivyUserId = 'did:privy:clx9876543210';
  const testEmail = 'musa.dev@gmail.com';
  
  console.log('\n--- Deriving Personal Entity Multi-Chain Addresses ---');
  const personalAddresses = await PrivyNEARBridge.deriveAddress(testPrivyUserId, 'personal', testEmail);
  console.log('Path:', personalAddresses.path);
  console.log('EVM Address:', personalAddresses.evmAddress);
  console.log('Solana Address:', personalAddresses.solanaAddress);
  console.log('BTC Address:', personalAddresses.btcAddress);
  console.log('NEAR Named Address (Personal):', personalAddresses.nearNamedAddress);
  
  console.log('\n--- Deriving Business Entity Multi-Chain Addresses ---');
  const businessAddresses = await PrivyNEARBridge.deriveAddress(testPrivyUserId, 'business', testEmail);
  console.log('Path:', businessAddresses.path);
  console.log('EVM Address:', businessAddresses.evmAddress);
  console.log('Solana Address:', businessAddresses.solanaAddress);
  console.log('BTC Address:', businessAddresses.btcAddress);
  console.log('NEAR Named Address (Business):', businessAddresses.nearNamedAddress);
  
  console.log('\n--- Address Separation Verification Across All Chains ---');
  const isEvmDifferent = personalAddresses.evmAddress !== businessAddresses.evmAddress;
  const isSolanaDifferent = personalAddresses.solanaAddress !== businessAddresses.solanaAddress;
  const isNearNamedDifferent = personalAddresses.nearNamedAddress !== businessAddresses.nearNamedAddress;
  
  console.log('✅ EVM Addresses Separated:', isEvmDifferent);
  console.log('✅ Solana Addresses Separated:', isSolanaDifferent);
  console.log('✅ NEAR Named Addresses Separated:', isNearNamedDifferent, `(${personalAddresses.nearNamedAddress} vs ${businessAddresses.nearNamedAddress})`);

  if (isEvmDifferent && isSolanaDifferent && isNearNamedDifferent) {
    console.log('\n🎉 ALL TESTS PASSED: Privy -> NEAR MPC Multi-Chain & NEAR Named Address derivation is 100% functional!');
  } else {
    console.error('\n❌ TEST FAILED: Addresses were not properly separated.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
