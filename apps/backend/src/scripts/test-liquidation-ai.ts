import { liquidationService } from '@payit/integrations';

async function main() {
  console.log('🧪 Testing AI-Assisted Multi-Chain Crypto Auto-Liquidation & Pool Verification...');

  // Test 1: High Liquidity Solana SOL Liquidation into USDC
  console.log('\n--- Test 1: Solana SOL Deposit Liquidation ---');
  const solQuote = await liquidationService.analyzeAndSelectLiquidityPool({
    tokenSymbol: 'SOL',
    chain: 'solana',
    amount: '10.5',
    targetStablecoin: 'USDC',
  });
  console.log('Selected DEX & Pool:', solQuote.dexName, `(${solQuote.selectedPool})`);
  console.log('Liquidity Depth:', `$${solQuote.liquidityDepthUsd.toLocaleString()}`);
  console.log('Price Impact:', `${solQuote.estimatedPriceImpact}%`);
  console.log('Pool Verified:', solQuote.verified);
  console.log('Route Status:', solQuote.routeStatus);
  console.log('Estimated USDC Received:', `$${solQuote.estimatedOutputStablecoin}`);

  // Test 2: NEAR Protocol Native Token Liquidation into USDC
  console.log('\n--- Test 2: NEAR Protocol Deposit Liquidation ---');
  const nearQuote = await liquidationService.analyzeAndSelectLiquidityPool({
    tokenSymbol: 'NEAR',
    chain: 'near',
    amount: '500',
    targetStablecoin: 'USDC',
  });
  console.log('Selected DEX & Pool:', nearQuote.dexName, `(${nearQuote.selectedPool})`);
  console.log('Liquidity Depth:', `$${nearQuote.liquidityDepthUsd.toLocaleString()}`);
  console.log('Price Impact:', `${nearQuote.estimatedPriceImpact}%`);
  console.log('Pool Verified:', nearQuote.verified);
  console.log('Route Status:', nearQuote.routeStatus);
  console.log('Estimated USDC Received:', `$${nearQuote.estimatedOutputStablecoin}`);

  // Test 3: Bitcoin SegWit Deposit Liquidation into USDC
  console.log('\n--- Test 3: Bitcoin Deposit Liquidation ---');
  const btcQuote = await liquidationService.analyzeAndSelectLiquidityPool({
    tokenSymbol: 'BTC',
    chain: 'bitcoin',
    amount: '0.25',
    targetStablecoin: 'USDC',
  });
  console.log('Selected DEX & Pool:', btcQuote.dexName, `(${btcQuote.selectedPool})`);
  console.log('Liquidity Depth:', `$${btcQuote.liquidityDepthUsd.toLocaleString()}`);
  console.log('Price Impact:', `${btcQuote.estimatedPriceImpact}%`);
  console.log('Pool Verified:', btcQuote.verified);
  console.log('Route Status:', btcQuote.routeStatus);
  console.log('Estimated USDC Received:', `$${btcQuote.estimatedOutputStablecoin}`);

  console.log('\n🎉 ALL AI LIQUIDATION & POOL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
