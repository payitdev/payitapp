import { createDbClient, eq } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';

const db = createDbClient();

async function check() {
  const allEntities = await db.select().from(entities);
  console.log('--- ALL ENTITIES IN NEON DB ---');
  for (const e of allEntities) {
    console.log(`ID: ${e.id} | Kind: ${e.kind} | Name: ${e.legalName} | NuvionEntityId: ${e.nuvionEntityId}`);
    const accs = await db.select().from(accounts).where(eq(accounts.entityId, e.id));
    console.log(`  Linked Accounts (${accs.length}):`);
    for (const a of accs) {
      console.log(`    - [${a.currency}] BAN: ${a.accountNumber} | Bank: ${a.bankName} | Holder: ${a.accountHolderName}`);
    }
  }
}

check().catch(console.error).finally(() => process.exit(0));
