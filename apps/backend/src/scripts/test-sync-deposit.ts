import dotenv from 'dotenv';
dotenv.config();

import { createDbClient, eq } from '@payit/db';
import { users, entities, transfers } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

async function runDepositTest() {
  console.log('🔍 Testing NEAR On-Chain Deposit Sync directly in Database...\n');

  const userRows = await db.select().from(users).where(eq(users.email, 'payitdev@gmail.com'));
  const user = userRows[0];

  const userEntities = await db.select().from(entities).where(eq(entities.userId, user.id));

  for (const ent of userEntities) {
    const nearAddress = ent.nearDepositAddress;
    console.log(`👤 Checking ${ent.kind} entity (${ent.id}) | Address: ${nearAddress}`);
    if (!nearAddress) continue;

    const res = await fetch(`https://api-testnet.nearblocks.io/v1/account/${nearAddress}`);
    const data: any = await res.json();

    if (data.account && data.account.length > 0) {
      const nearAmount = Number(BigInt(data.account[0].amount)) / 1e24;
      console.log(`   💰 On-chain balance: ${nearAmount} NEAR`);

      if (nearAmount > 0.06) {
        const depositNear = nearAmount - 0.05;
        const nearNgnRate = 5000;
        const ngnValue = (depositNear * nearNgnRate).toFixed(2);
        const refTag = `near_dep_${nearAddress}_${depositNear.toFixed(2)}`;

        const existing = await db.select().from(transfers).where(eq(transfers.dueTransferId, refTag));
        if (existing.length === 0) {
          await db.insert(transfers).values({
            id: ulid(),
            entityId: ent.id,
            dueTransferId: refTag,
            sourceCurrency: 'NEAR',
            targetCurrency: 'NGN',
            sourceAmount: depositNear.toFixed(4),
            targetAmount: ngnValue,
            feeAmount: '0.00',
            status: 'completed',
          });
          console.log(`   ✅ SUCCESS! Recorded on-chain deposit: ${depositNear.toFixed(4)} NEAR -> ₦${ngnValue}`);
        } else {
          console.log(`   ℹ️ Deposit ALREADY recorded in DB table transfers: ID ${existing[0].id}`);
        }
      }
    }
  }

  console.log('\n📊 Updated Activity Feed Records in DB:');
  const allTxs = await db.select().from(transfers);
  for (const tx of allTxs) {
    console.log(`   • Tx ${tx.id}: ${tx.sourceAmount} ${tx.sourceCurrency} -> ₦${tx.targetAmount} (Status: ${tx.status})`);
  }

  process.exit(0);
}

runDepositTest();
