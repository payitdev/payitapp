import 'dotenv/config';
import { createDbClient, eq, or } from '@payit/db';
import { users, entities, accounts } from '@payit/db/schema';

const db = createDbClient();

async function inspectAnisa() {
  console.log('--- INSPECTING USER & ENTITY FOR ANISA LOUNGE ---');
  
  const userRows = await db.select().from(users).where(eq(users.email, 'ibohibohigboze@gmail.com'));
  if (userRows.length === 0) {
    console.log('User ibohibohigboze@gmail.com NOT found in users table!');
    process.exit(0);
  }

  const user = userRows[0];
  console.log(`User ID: ${user.id} | Email: ${user.email} | Name: "${user.fullName}"`);

  const entityRows = await db.select().from(entities).where(eq(entities.userId, user.id));
  console.log(`\nFound ${entityRows.length} entities for user ${user.id}:`);

  for (const ent of entityRows) {
    console.log(`\n- Entity ID: ${ent.id} | Kind: ${ent.kind} | LegalName: "${ent.legalName}" | Tag: "${ent.businessTag}"`);
    console.log(`  nuvionEntityId: ${ent.nuvionEntityId} | status: ${ent.nuvionStatus} | tier: ${ent.nuvionTier}`);
    console.log(`  accountBackfilled: ${ent.accountBackfilled} | backfilledAt: ${ent.accountBackfilledAt}`);

    const accs = await db.select().from(accounts).where(eq(accounts.entityId, ent.id));
    console.log(`  Linked DB Accounts count: ${accs.length}`);
    for (const a of accs) {
      console.log(`    -> [DB Account] ID: ${a.id} | Currency: ${a.currency} | AccountNo: "${a.accountNumber}" | Bank: "${a.bankName}" | Holder: "${a.accountHolderName}" | nuvionAccountId: "${a.nuvionAccountId}"`);
    }
  }
}

inspectAnisa().catch(console.error).finally(() => process.exit(0));
