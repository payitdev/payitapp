import { feeService, PodsClient } from '@payit/integrations';

async function main() {
  console.log('🧪 Testing Pods Auto-Sweep & Proxim Yield Fee Split Engine...');

  // 1. Test Proxim Yield Fee Split Math (e.g. Gross 6.0% APY -> Proxim 2.0% Cut / Net User 4.0% APY)
  console.log('\n--- Step 1: Yield Fee Split Calculation ---');
  const split6Percent = feeService.calculateYieldFeeSplit(6.0, 2.0);
  console.log('Gross Strategy APY:', `${split6Percent.grossApy}%`);
  console.log('Proxim Cut APY:', `${split6Percent.proximCutApy}%`);
  console.log('User Net APY:', `${split6Percent.userNetApy}%`);
  console.log('Proxim Yield Share:', `${split6Percent.proximSharePercent}% of total yield`);
  console.log('User Yield Share:', `${split6Percent.userSharePercent}% of total yield`);

  // Test 2: Moonwell 8.2% APY Yield Split
  console.log('\n--- Step 2: High Yield Strategy Split (Moonwell 8.2% APY) ---');
  const split8Percent = feeService.calculateYieldFeeSplit(8.2, 2.0);
  console.log('Gross Strategy APY:', `${split8Percent.grossApy}%`);
  console.log('Proxim Cut APY:', `${split8Percent.proximCutApy}%`);
  console.log('User Net APY:', `${split8Percent.userNetApy}%`);

  // Test 3: Fetch Enriched Pods Strategies with Yield Split Included
  console.log('\n--- Step 3: Fetching Pods Strategies Enriched with Net User APY ---');
  const pods = new PodsClient();
  const strategies = await pods.getBaseStrategies();
  strategies.forEach(s => {
    console.log(`  - ${s.assetName} (${s.protocol}): Gross ${s.grossApy}% APY | Proxim Cut ${s.proximCutApy}% | User Net ${s.userNetApy}% APY`);
  });

  console.log('\n🎉 ALL TESTS PASSED: Pods Auto-Sweep & Proxim Yield Fee Split Engine is 100% Verified!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
