import dotenv from 'dotenv';
dotenv.config();

import { PrivyNEARBridge } from '@payit/integrations';

async function testMultichainDerivation() {
  console.log('⚡ Auditing Multi-Chain Address Derivation & RPC Providers:\n');

  const testUser = 'payitdev@gmail.com';

  console.log(`👤 Testing User: ${testUser}`);

  const personal = await PrivyNEARBridge.deriveAddress('did:privy:cmsx4n3uy00fm0cjz4x7ny2av', 'personal', testUser);
  const business = await PrivyNEARBridge.deriveAddress('did:privy:cmsx4n3uy00fm0cjz4x7ny2av', 'business', testUser);

  console.log('\n--- 🏠 PERSONAL ACCOUNT ---');
  console.log('NEAR Handle  :', personal.nearNamedAddress);
  console.log('EVM Address  :', personal.evmAddress);
  console.log('SOL Address  :', personal.solanaAddress);
  console.log('BTC Address  :', personal.btcAddress);
  console.log('TRON Address :', personal.tronAddress);
  console.log('TON Address  :', personal.tonAddress);
  console.log('SUI Address  :', personal.suiAddress);

  console.log('\n--- 🏢 BUSINESS ACCOUNT ---');
  console.log('NEAR Handle  :', business.nearNamedAddress);
  console.log('EVM Address  :', business.evmAddress);
  console.log('SOL Address  :', business.solanaAddress);
  console.log('BTC Address  :', business.btcAddress);
  console.log('TRON Address :', business.tronAddress);
  console.log('TON Address  :', business.tonAddress);
  console.log('SUI Address  :', business.suiAddress);

  console.log('\n📡 RPC Endpoints Used for Chain Signature MPC Derivation:');
  console.log('  1. NEAR MPC Contract  : v1.signer-prod.testnet (Testnet) / v1.signer (Mainnet)');
  console.log('  2. NEAR RPC Provider  : https://archival-rpc.testnet.near.org');
  console.log('  3. Base EVM RPC       : https://mainnet.base.org');
  console.log('  4. BSC EVM RPC        : https://bsc-datase.binance.org');

  process.exit(0);
}

testMultichainDerivation();
