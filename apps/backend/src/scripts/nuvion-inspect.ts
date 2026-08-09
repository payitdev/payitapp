import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';

const db = createDbClient();
const client = new NuvionClient();

async function inspectNuvion() {
  console.log('--- FETCHING ALL NUVION ACCOUNTS FROM LIVE API ---');
  try {
    const res = await (client as any).nuvionGet('/accounts');
    const rawList = res?.data?.data?.data || res?.data?.data?.accounts || res?.data?.accounts || res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
    console.log(`Nuvion API returned ${rawList.length} accounts total.`);
    for (const acc of rawList) {
      console.log(`ID: ${acc.id} | DisplayName: "${acc.display_name}" | Currency: ${acc.currency} | BAN: ${acc.nuvion_ban} | Bank: ${acc.bank_name}`);
    }
  } catch (err: any) {
    console.error('Error querying Nuvion API:', err.message);
  }

  console.log('\n--- INSPECTING ANISA ENTITY IN NEON DB ---');
  const dbEntities = await db.select().from(entities);
  for (const e of dbEntities) {
    if (e.legalName && e.legalName.toLowerCase().includes('anisa')) {
      console.log(`\nFound Anisa Entity in DB: ID ${e.id} | LegalName: "${e.legalName}"`);
      const linkedAccs = await db.select().from(accounts).where(eq(accounts.entityId, e.id));
      console.log(`  Linked DB Accounts count: ${linkedAccs.length}`);
      for (const a of linkedAccs) {
        console.log(`    - ID: ${a.id} | Currency: ${a.currency} | BAN: ${a.accountNumber} | Bank: ${a.bankName} | Holder: "${a.accountHolderName}"`);
      }
    }
  }
}

inspectNuvion().catch(console.error).finally(() => process.exit(0));
