/**
 * Development Script: Fetch Real Ondo Stocks/ETFs from Pods API
 * 
 * This script helps identify the available stocks/ETFs and their strategy IDs
 * Run with: pnpm tsx src/scripts/fetch-ondo-stocks.ts
 * 
 * IMPORTANT: Requires PODS_API_KEY to be set in environment
 */

import { OndoClient } from '@payit/integrations';

async function fetchOndoStocks() {
  console.log('🔍 Fetching real Ondo stocks/ETFs from Pods Finance...\n');

  try {
    // Use API key from environment or fall back to hardcoded for testing
    const apiKey = process.env.PODS_API_KEY || 'ae8cfd3360fa4ce7b639812a06dec1aa';
    const ondo = new OndoClient(apiKey);

    // Fetch available stocks/ETFs on BSC
    console.log('📊 Fetching available stocks/ETFs on BSC...\n');
    const tokens = await ondo.listStocksAndETFs();
    
    console.log(`✅ Found ${tokens.length} stocks/ETFs on BSC:\n`);
    
    tokens.forEach((token, index) => {
      const price = parseFloat(token.priceInUSD);
      console.log(`${index + 1}. ${token.symbol} - ${token.name}`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Chain: BSC (Chain ID: ${token.chainId})`);
      console.log(`   Price: $${price.toFixed(2)}`);
      console.log(`   Category: ${token.category.join(', ')}`);
      console.log('');
    });

    // Resolve strategy IDs for each token
    console.log('\n🔍 Resolving strategy IDs for each token...\n');
    
    const stocksWithStrategies = await Promise.all(
      tokens.map(async (token) => {
        const strategyId = await ondo.resolveStrategyId(token.address);
        return {
          ...token,
          strategyId,
          hasStrategy: !!strategyId,
        };
      })
    );

    console.log('\n📋 Stocks/ETFs with Strategy IDs:\n');
    
    stocksWithStrategies.forEach((stock, index) => {
      const price = parseFloat(stock.priceInUSD);
      console.log(`${index + 1}. ${stock.symbol} - ${stock.name}`);
      console.log(`   Strategy ID: ${stock.strategyId || 'NOT FOUND'}`);
      console.log(`   Has Strategy: ${stock.hasStrategy ? '✅' : '❌'}`);
      console.log(`   Price: $${price.toFixed(2)}`);
      console.log('');
    });

    const withStrategies = stocksWithStrategies.filter(s => s.hasStrategy);
    console.log(`\n✅ ${withStrategies.length} stocks/ETFs have Ondo strategies available`);
    console.log(`❌ ${stocksWithStrategies.length - withStrategies.length} stocks/ETFs do not have strategies\n`);

    // Test market status for a few tickers
    console.log('\n🔍 Testing market status for sample tickers...\n');
    
    const sampleTickers = stocksWithStrategies.slice(0, 3);
    for (const stock of sampleTickers) {
      try {
        const marketStatus = await ondo.getMarketStatus(stock.symbol);
        console.log(`${stock.symbol}:`);
        console.log(`   Open: ${marketStatus.isOpen ? '✅' : '❌'}`);
        console.log(`   Tradable: ${marketStatus.asset?.tradable ? '✅' : '❌'}`);
        if (!marketStatus.asset?.tradable) {
          console.log(`   Blocking Reason: ${marketStatus.asset.blockingReason?.message}`);
        }
        console.log('');
      } catch (error: any) {
        console.log(`${stock.symbol}: ❌ Failed to fetch market status - ${error.message}\n`);
      }
    }

    console.log('✅ Ondo stock fetch complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchOndoStocks();