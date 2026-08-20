import { createDbClient } from '@payit/db';
import { users, entities, accounts, feeLedger } from '@payit/db/schema';

async function main() {
  const db = createDbClient();
  const allUsers = await db.select().from(users);
  const allEntities = await db.select().from(entities);
  const allAccounts = await db.select().from(accounts);
  const allFees = await db.select().from(feeLedger);

  console.log(`Users: ${allUsers.length}`);
  console.log(`Entities: ${allEntities.length}`);
  console.log(`Virtual Accounts: ${allAccounts.length}`);
  console.log(`Fee Ledger Entries: ${allFees.length}`);
}

main().catch(console.error);
