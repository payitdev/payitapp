import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq } from '@payit/db';
import { entities, users } from '@payit/db/schema';

const db = createDbClient();
const nuvion = new NuvionClient();

async function checkLatestKyc() {
  console.log('===========================================================');
  console.log(' CHECKING LATEST KYC SUBMISSION IN DB & LIVE NUVION API     ');
  console.log('===========================================================\n');

  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users in DB:`);
  for (const u of allUsers) {
    console.log(`  User ID: ${u.id} | Email: ${u.email} | Name: ${u.fullName}`);
  }

  const allEntities = await db.select().from(entities);
  console.log(`\nFound ${allEntities.length} entities in DB:`);
  for (const e of allEntities) {
    console.log(`  Entity ID: ${e.id} | User ID: ${e.userId} | Kind: ${e.kind} | LegalName: "${e.legalName}" | Handle: "${e.username}" | NuvionEntityId: ${e.nuvionEntityId} | NuvionStatus: ${e.nuvionStatus} | Tier: ${e.nuvionTier}`);

    if (e.nuvionEntityId) {
      try {
        const liveRes = await (nuvion as any).nuvionGet(`/entities/${e.nuvionEntityId}`);
        const data = liveRes?.data || liveRes;
        const liveEnt = data?.entity || data;
        const person = data?.person || {};
        const addrs = data?.addresses || [];
        const ident = data?.identification || {};
        console.log(`  >>> LIVE NUVION STATUS for ${e.nuvionEntityId}:`);
        console.log(`      Entity Status: "${liveEnt?.status}" | Type: ${liveEnt?.type} | UpdatedAt: ${liveEnt?.updated}`);
        console.log(`      Person Status: "${person?.status}" | Phone: ${person?.phonenumber}`);
        console.log(`      Address: ${JSON.stringify(addrs[0] || {})}`);
        console.log(`      Identification Status: "${ident?.verification_status}"`);
      } catch (err: any) {
        console.log(`  >>> Error fetching Nuvion entity ${e.nuvionEntityId}:`, err.message);
      }
    }
  }
}

checkLatestKyc().catch(console.error).finally(() => process.exit(0));
