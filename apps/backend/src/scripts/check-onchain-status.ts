import dotenv from 'dotenv';
dotenv.config();

import { createDbClient, eq } from '@payit/db';
import { users, entities } from '@payit/db/schema';

const db = createDbClient();

const networkId = process.env.NEAR_NETWORK_ID || 'mainnet';
const rpcEndpoints = networkId === 'mainnet'
  ? [
      process.env.NEAR_RPC_URL,
      'https://archival-rpc.mainnet.near.org',
      'https://rpc.mainnet.near.org',
    ].filter(Boolean) as string[]
  : [
      process.env.NEAR_RPC_URL,
      'https://archival-rpc.testnet.near.org',
      'https://rpc.testnet.pagoda.co',
    ].filter(Boolean) as string[];

async function checkAccountOnChain(accountId: string) {
  for (const ep of rpcEndpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'audit',
          method: 'query',
          params: {
            request_type: 'view_account',
            finality: 'final',
            account_id: accountId,
          },
        }),
      });
      const data: any = await res.json();
      if (data.result?.amount) {
        return { exists: true, balance: parseFloat(data.result.amount) / 1e24 };
      }
      if (data.error?.cause?.name === 'UNKNOWN_ACCOUNT') {
        return { exists: false };
      }
    } catch (e) {
      // try next provider
    }
  }
  return { exists: false, error: 'RPC Rate Limited' };
}

async function auditAllEntities() {
  const allUsers = await db.select().from(users);
  console.log(`\n======================================================`);
  console.log(`🔍 MULTI-ENTITY ON-CHAIN AUDIT (${networkId}, ${allUsers.length} Users Total)`);
  console.log(`======================================================\n`);

  for (const user of allUsers) {
    const userEntities = await db.select().from(entities).where(eq(entities.userId, user.id));
    if (userEntities.length === 0) continue;

    console.log(`👤 User: ${user.email} (Privy: ${user.privyUserId})`);

    for (const ent of userEntities) {
      const nearAddress = ent.nearDepositAddress;
      if (!nearAddress) continue;

      await new Promise(r => setTimeout(r, 250)); // delay

      const result = await checkAccountOnChain(nearAddress);
      if (result.exists) {
        console.log(`   ✅ [${ent.kind.padEnd(8)}] Handle: '${nearAddress}' | Balance: ${result.balance} NEAR`);
      } else if (result.error) {
        console.log(`   ⚠️ [${ent.kind.padEnd(8)}] Handle: '${nearAddress}' | ${result.error}`);
      } else {
        console.log(`   ❌ [${ent.kind.padEnd(8)}] Handle: '${nearAddress}' | NOT CREATED ON-CHAIN`);
      }
    }
    console.log('');
  }
  process.exit(0);
}

auditAllEntities();
