import { createDbClient } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';

const db = createDbClient();

async function check() {
  const allEntities = await db.select().from(entities);
  console.log(`FOUND ${allEntities.length} ENTITIES IN NEON DB:`);
  for (const e of allEntities) {
    console.log(`\nEntity ID: ${e.id}`);
    console.log(`  Legal Name: "${e.legalName}"`);
    console.log(`  Kind: ${e.kind} | Status: ${e.nuvionStatus} | Tier: ${e.nuvionTier}`);
    console.log(`  NuvionEntityId: ${e.nuvionEntityId}`);

    const accs = await db.select().from(accounts).where((accounts as any).entityId ? (accounts as any).entityId : undefined);
    console.log(`  Linked Accounts:`);
    for (const a of accs) {
      if (a.entityId === e.id) {
        console.log(`    -> [${a.currency}] BAN: ${a.accountNumber} | Bank: ${a.bankName} | Holder: ${a.accountHolderName} | NuvionAccId: ${a.nuvionAccountId}`);
      }
    }
  }
}

check().catch(console.error).finally(() => process.exit(0));
