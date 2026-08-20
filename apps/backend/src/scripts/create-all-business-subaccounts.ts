import dotenv from 'dotenv';
dotenv.config();

import { createDbClient, eq } from '@payit/db';
import { users, entities } from '@payit/db/schema';

const db = createDbClient();

const relayerId = process.env.NEAR_RELAYER_ACCOUNT_ID;
const relayerKey = process.env.NEAR_RELAYER_PRIVATE_KEY;
const nearNetworkId = process.env.NEAR_NETWORK_ID || 'mainnet';

if (!relayerId || !relayerKey) {
  throw new Error('NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY are required');
}

async function createAllBusinessAccountsOnChain() {
  console.log(`🚀 Creating ALL Business accounts on NEAR ${nearNetworkId} RPC...`);

  const nearApiObj: any = await import('near-api-js');
  const { Account, JsonRpcProvider, KeyPair } = nearApiObj;

  const rpcUrl = process.env.NEAR_RPC_URL || (nearNetworkId === 'mainnet'
    ? 'https://archival-rpc.mainnet.near.org'
    : 'https://archival-rpc.testnet.near.org');
  const provider = new JsonRpcProvider({ url: rpcUrl });
  const masterAccount = new Account(relayerId, provider, relayerKey);

  const allBusinessEntities = await db.select().from(entities).where(eq(entities.kind, 'BUSINESS'));
  console.log(`Found ${allBusinessEntities.length} business entities in DB.\n`);

  for (const ent of allBusinessEntities) {
    const userRows = await db.select().from(users).where(eq(users.id, ent.userId));
    const user = userRows[0];

    const nearAddress = ent.nearDepositAddress;
    console.log(`👤 User: ${user?.email || ent.userId} | Business Handle: ${nearAddress}`);

    if (!nearAddress) {
      console.log(`   ❌ No NEAR deposit address found in DB!`);
      continue;
    }

    try {
      // Direct raw fetch to archival RPC
      const checkRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'check-biz',
          method: 'query',
          params: {
            request_type: 'view_account',
            finality: 'final',
            account_id: nearAddress,
          },
        }),
      });
      const checkData: any = await checkRes.json();

      if (checkData.result?.amount) {
        console.log(`   ✅ Account '${nearAddress}' ALREADY EXISTS on-chain! Balance: ${parseFloat(checkData.result.amount) / 1e24} NEAR`);
      } else {
        console.log(`   🚀 Creating sub-account '${nearAddress}' on NEAR ${nearNetworkId}...`);
        try {
          const newKeyPair = KeyPair.fromRandom('ed25519');
          const txRes = await masterAccount.createSubAccount({
            accountOrPrefix: nearAddress,
            publicKey: newKeyPair.getPublicKey(),
            nearToTransfer: BigInt(5e22), // 0.05 NEAR
          });
          const txHash = txRes.transaction?.hash || txRes.transaction_outcome?.id || 'Success';
          console.log(`   ✅ SUCCESS! Created '${nearAddress}' on-chain! Tx Hash: ${txHash}`);
        } catch (createErr: any) {
          if (createErr.message?.includes('already exists') || createErr.message?.includes('AccountAlreadyExists')) {
            console.log(`   ✅ Account '${nearAddress}' ALREADY EXISTS on-chain!`);
          } else {
            console.log(`   ❌ Failed to create sub-account '${nearAddress}': ${createErr.message}`);
          }
        }
      }
    } catch (err: any) {
      console.log(`   ❌ Error checking '${nearAddress}': ${err.message}`);
    }
  }

  console.log('\n🎉 Finished business account check & creation!');
  process.exit(0);
}

createAllBusinessAccountsOnChain();
