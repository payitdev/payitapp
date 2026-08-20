async function testFastNearRest() {
  const accounts = [
    'igbozeigboze.proxim.testnet',
    'igbozeigboze-biz.proxim.testnet',
    'payitdev.proxim.testnet',
    'payitdev-biz.proxim.testnet',
    'ppdotfun.proxim.testnet',
    'ppdotfun-biz.proxim.testnet',
  ];

  console.log('Testing FastNEAR REST API:\n');

  for (const acc of accounts) {
    try {
      const res = await fetch(`https://testnet.api.fastnear.com/v1/account/${acc}`);
      const data: any = await res.json();
      console.log(`   ✅ '${acc}':`, data);
    } catch (e: any) {
      console.log(`   ❌ '${acc}':`, e.message);
    }
  }

  console.log('\nTesting NEAR Blocks API:\n');

  for (const acc of accounts) {
    try {
      const res = await fetch(`https://api-testnet.nearblocks.io/v1/account/${acc}`);
      const data: any = await res.json();
      if (data.account && data.account.length > 0) {
        console.log(`   ✅ '${acc}' ON NEARBLOCKS: Balance: ${parseFloat(data.account[0].amount) / 1e24} NEAR`);
      } else {
        console.log(`   ❌ '${acc}' NEARBlocks status:`, data);
      }
    } catch (e: any) {
      console.log(`   ❌ '${acc}' NEARBlocks error:`, e.message);
    }
  }
}

testFastNearRest();
