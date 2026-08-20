import dotenv from 'dotenv';
dotenv.config();

import { createDbClient, eq } from '@payit/db';
import { users, entities } from '@payit/db/schema';
import { registerNearAccountOnChain, PrivyNEARBridge } from '@payit/integrations';

const db = createDbClient();

async function registerAllBusinessAndPersonalOnChain() {
  console.log('🚀 Registering ALL Personal & Business accounts on NEAR Testnet blockchain...');

  const allEntities = await db.select().from(entities);
  console.log(`Found ${allEntities.length} total entities in DB.`);

  for (const ent of allEntities) {
    const userRows = await db.select().from(users).where(eq(users.id, ent.userId));
    const user = userRows[0];
    
    const userEmail = user?.email || `${ent.userId}@proxim.app`;
    const identifier = user?.privyUserId || ent.userId;
    const context = ent.kind.toLowerCase() as 'personal' | 'business';

    console.log(`\nProcessing ${ent.kind} entity (${ent.id}) for user ${userEmail}...`);

    // Derive authentic multi-chain addresses for this entity context
    const derived = await PrivyNEARBridge.deriveAddress(identifier, context, userEmail);

    const nearAddress = derived.nearNamedAddress || (derived as any).nearAddress;

    // Update entity in PostgreSQL
    await db.update(entities)
      .set({
        evmDepositAddress: derived.evmAddress,
        solanaDepositAddress: derived.solanaAddress,
        btcDepositAddress: derived.btcAddress,
        tronDepositAddress: derived.tronAddress,
        tonDepositAddress: derived.tonAddress,
        nearDepositAddress: nearAddress,
        cosmosDepositAddress: derived.cosmosAddress,
        suiDepositAddress: derived.suiAddress,
        aptosDepositAddress: derived.aptosAddress,
        xrpDepositAddress: derived.xrpAddress,
      })
      .where(eq(entities.id, ent.id));

    console.log(`  📍 [${ent.kind}] Derived NEAR handle: ${nearAddress}`);
    console.log(`     EVM Address: ${derived.evmAddress}`);
    console.log(`     SOL Address: ${derived.solanaAddress}`);

    // Register on NEAR blockchain
    if (nearAddress) {
      console.log(`  🚀 Submitting transaction on NEAR Testnet for ${nearAddress}...`);
      const res = await registerNearAccountOnChain(nearAddress);
      console.log(`  Result for ${nearAddress}:`, res);
    }
  }

  console.log('\n🎉 ALL Personal and Business crypto accounts registered on-chain!');
  process.exit(0);
}

registerAllBusinessAndPersonalOnChain();
