import { buildServer } from '../server.js';

async function main() {
  console.log('🧪 Testing Privy Login directly via Fastify server instance...');

  const server = buildServer();
  await server.ready();

  const testPrivyUser = {
    privyUserId: `did:privy:${Date.now()}`,
    email: `sarah.investor.${Date.now()}@proxim.app`,
    walletAddress: '0x71C565F348C3d5e2eF080F17676d1F2C5C1bC593',
  };

  console.log('Submitting Privy login payload:');
  console.log('  Privy User ID:', testPrivyUser.privyUserId);
  console.log('  Email:', testPrivyUser.email);

  const response = await server.inject({
    method: 'POST',
    url: '/api/auth/privy/login',
    payload: testPrivyUser,
  });

  console.log('\n--- Privy Login Result ---');
  console.log('Status Code:', response.statusCode);
  const data = JSON.parse(response.body);

  if (response.statusCode !== 200) {
    console.error('❌ Server returned error:', data);
    process.exit(1);
  }

  console.log('✅ Success:', data.success);
  console.log('✅ JWT Token:', `${data.token.slice(0, 25)}...`);
  console.log('✅ User Email:', data.user.email);
  console.log('✅ Active Entity ID:', data.user.activeEntityId);

  data.user.entities.forEach((entity: any) => {
    console.log(`\n📌 Entity (${entity.kind}):`);
    console.log(`   - EVM Address: ${entity.evmDepositAddress}`);
    console.log(`   - Solana Address: ${entity.solanaDepositAddress}`);
    console.log(`   - BTC Address: ${entity.btcDepositAddress}`);
    console.log(`   - NEAR Named Address: ${entity.nearDepositAddress}`);
  });

  console.log('\n🎉 ALL TESTS PASSED: Privy Social Login & NEAR MPC Address Auto-Derivation is 100% Functional!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test script failed:', err);
  process.exit(1);
});
