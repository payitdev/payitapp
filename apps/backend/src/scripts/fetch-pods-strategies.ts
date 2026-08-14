/**
 * Development Script: Fetch Real Base Strategies from Pods API
 * 
 * This script helps identify the actual strategy IDs available on Base network
 * Run with: pnpm tsx src/scripts/fetch-pods-strategies.ts
 * 
 * IMPORTANT: Requires PODS_API_KEY to be set in environment
 */

import { PodsClient } from '@payit/integrations';

async function fetchBaseStrategies() {
  console.log('🔍 Fetching real Base strategies from Pods Finance...\n');

  try {
    // Use API key from environment or fall back to hardcoded for testing
    const apiKey = process.env.PODS_API_KEY || 'ae8cfd3360fa4ce7b639812a06dec1aa';
    const pods = new PodsClient(apiKey);
    
    // Get all Base strategies
    const baseStrategies = await pods.getBaseStrategies();
    
    console.log(`✅ Found ${baseStrategies.length} Base strategies:\n`);
    
    // Display each strategy with key details
    baseStrategies.forEach((strategy, index) => {
      console.log(`${index + 1}. ${strategy.id}`);
      console.log(`   Protocol: ${strategy.protocol}`);
      console.log(`   Asset: ${strategy.assetName} (${strategy.asset})`);
      console.log(`   Network: ${strategy.network} (Chain ID: ${strategy.networkId})`);
      console.log(`   APY: ${(strategy.apy * 100).toFixed(2)}%`);
      console.log(`   Fee: ${strategy.fee} bps`);
      console.log(`   Paused: ${strategy.paused}`);
      console.log(`   Available Actions: ${strategy.availableActions.join(', ')}`);
      console.log('');
    });

    // Check for USDC/USDT matching strategies (for free tier determination)
    console.log('🔍 Checking for USDC/USDT matching strategies (free tier):\n');
    
    // Common Base USDC address (mainnet)
    const baseUSDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const baseUSDT = '0x50c7f4902095A4A7103E7E57B30b957c2380101C';
    
    const usdcStrategies = await pods.findStrategiesByToken(baseUSDC);
    const usdtStrategies = await pods.findStrategiesByToken(baseUSDT);
    
    console.log(`USDC Strategies on Base: ${usdcStrategies.length}`);
    usdcStrategies.forEach(s => console.log(`  - ${s.id} (${s.protocol})`));
    
    console.log(`\nUSDT Strategies on Base: ${usdtStrategies.length}`);
    usdtStrategies.forEach(s => console.log(`  - ${s.id} (${s.protocol})`));

    // Check for OpenCover strategies
    console.log('\n🔍 Checking for OpenCover-insured strategies:\n');
    
    const openCoverStrategies = await pods.findOpenCoverStrategies();
    console.log(`OpenCover Strategies on Base: ${openCoverStrategies.length}`);
    openCoverStrategies.forEach(s => console.log(`  - ${s.id} (${s.protocol})`));

    if (openCoverStrategies.length === 0) {
      console.log('⚠️  No OpenCover+Base strategies found - this gap should be reported');
    }

    // Check for OpenCover strategies across ALL networks
    console.log('\n🔍 Checking for OpenCover strategies across ALL networks:\n');
    
    try {
      // Get all strategies without network filter
      const allStrategies = await pods.getAllStrategies();
      
      const allOpenCoverStrategies = allStrategies.filter((s: any) => 
        s.id.toLowerCase().includes('covered') || 
        s.protocol.toLowerCase().includes('opencover') ||
        s.id.toLowerCase().includes('opencover')
      );
      
      console.log(`Total OpenCover Strategies across all networks: ${allOpenCoverStrategies.length}`);
      
      // Group by network
      const byNetwork: Record<string, any[]> = {};
      allOpenCoverStrategies.forEach((s: any) => {
        if (!byNetwork[s.network]) {
          byNetwork[s.network] = [];
        }
        byNetwork[s.network].push(s);
      });
      
      Object.entries(byNetwork).forEach(([network, strategies]) => {
        console.log(`\n${network.toUpperCase()} (${strategies.length} strategies):`);
        strategies.forEach((s: any) => {
          console.log(`  - ${s.id} (${s.protocol}) - APY: ${(s.apy * 100).toFixed(2)}% - Paused: ${s.paused}`);
        });
      });
      
      if (allOpenCoverStrategies.length === 0) {
        console.log('⚠️  No OpenCover strategies found on ANY network');
      }
      
    } catch (error: any) {
      console.error('Failed to fetch all-network OpenCover strategies:', error.message);
    }

    console.log('\n✅ Strategy fetch complete!');
    
  } catch (error: any) {
    console.error('❌ Error fetching strategies:', error.message);
    
    if (error.message.includes('PODS_API_KEY')) {
      console.error('\n⚠️  PODS_API_KEY is not set in environment.');
      console.error('Please set it before running this script.');
    }
  }
}

// Run the script
fetchBaseStrategies().catch(console.error);