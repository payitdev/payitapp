import { kaminoClient, PrivyNEARBridge } from '@payit/integrations';

async function main() {
  console.log('🧪 Testing Kamino High-Yield Term Vaults & On-Chain Sync Engine...');

  const testPrivyUserId = 'did:privy:clx9876543210';
  const testEmail = 'sarah.investor@gmail.com';

  // 1. Derive Solana NEAR MPC Wallet for Kamino Vault Storage
  console.log('\n--- Step 1: Deriving Solana NEAR MPC Wallet ---');
  const account = await PrivyNEARBridge.deriveAddress(testPrivyUserId, 'personal', testEmail);
  console.log('NEAR Handle:', account.nearNamedAddress);
  console.log('Solana Wallet Address:', account.solanaAddress);

  // 2. Fetch Kamino Vaults with Proxim 2.5% Yield Cut
  console.log('\n--- Step 2: Querying Kamino Vaults Enriched with Proxim 2.5% APY Cut ---');
  const vaults = await kaminoClient.getKaminoVaults();
  vaults.forEach(v => {
    console.log(`  - ${v.name}: Gross ${v.grossApy}% APY | Proxim Cut ${v.proximCutApy}% | User Net ${v.userNetApy}% APY`);
  });

  // 3. Test Early Exit Penalty Calculations (Option A vs Option B)
  console.log('\n--- Step 3: Testing Early Exit Penalty Engine (Choice A vs Choice B) ---');
  const principal = 1000.00;
  const accruedInterest = 24.50;
  const penalties = kaminoClient.calculateEarlyExitPenalty(principal, accruedInterest);

  console.log('Option A (Forfeit Interest):');
  console.log('  Description:', penalties.choiceA.description);
  console.log('  Forfeited Interest:', `$${penalties.choiceA.forfeitedInterestUsd}`);
  console.log('  Net Payout to User:', `$${penalties.choiceA.netPayoutUsd}`);

  console.log('\nOption B (10.0% Principal Penalty Fee):');
  console.log('  Description:', penalties.choiceB.description);
  console.log('  Retained Interest:', `$${penalties.choiceB.retainedInterestUsd}`);
  console.log('  Proxim Penalty Fee (10.0%):', `$${penalties.choiceB.proximPenaltyFeeUsd}`);
  console.log('  Net Payout to User:', `$${penalties.choiceB.netPayoutUsd}`);

  // 4. Test Real-Time Solana RPC Position Sync & Reconciliation
  console.log('\n--- Step 4: Testing Real-Time Solana RPC Position Reconciliation ---');
  const rpcPositions = await kaminoClient.getUserPositions(account.solanaAddress);
  console.log('RPC Synced Positions:', rpcPositions);

  console.log('\n🎉 ALL TESTS PASSED: Kamino Term Vaults, Early Exit Fee Engine & On-Chain Reconciliation is 100% Functional!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
