import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq } from '@payit/db';
import { entities, accounts, archivedAccounts } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();
const nuvion = new NuvionClient();

async function backfillAnisaLive() {
  console.log('================================================================');
  console.log(' 🚀 LIVE NUVION BACKFILL FOR: Anisa Lounge and Restaurant Limited');
  console.log('================================================================\n');

  const targetEntityId = '01KZGKFS9XGTFX26BKYJYDWZEA';
  const entityRows = await db.select().from(entities).where(eq(entities.id, targetEntityId)).limit(1);

  if (entityRows.length === 0) {
    console.error('Anisa entity not found in Neon DB!');
    process.exit(1);
  }

  const ent = entityRows[0];
  const realNuvionEntityId = ent.nuvionEntityId || '01KX6JRFSQ97ARZFKBY6R31VJ7';
  console.log(`Entity ID: ${ent.id} | LegalName: "${ent.legalName}"`);
  console.log(`Using Nuvion Entity ID: ${realNuvionEntityId}\n`);

  // 1. Fetch current DB accounts for archiving
  const currentAccs = await db.select().from(accounts).where(eq(accounts.entityId, ent.id));
  console.log(`Found ${currentAccs.length} legacy account rows in DB.`);

  for (const oldAcc of currentAccs) {
    await db.insert(archivedAccounts).values({
      id: ulid(),
      entityId: ent.id,
      nuvionAccountId: oldAcc.nuvionAccountId,
      accountNumber: oldAcc.accountNumber,
      bankName: oldAcc.bankName,
      accountHolderName: oldAcc.accountHolderName,
      currency: oldAcc.currency,
      archivedReason: 'MISASSIGNED_MERCHANT_ACCOUNT_BACKFILL',
      archivedAt: new Date(),
    });
    console.log(`  📦 Archived old account: [${oldAcc.currency}] BAN: ${oldAcc.accountNumber}`);
  }

  // Remove old accounts from active table
  if (currentAccs.length > 0) {
    await db.delete(accounts).where(eq(accounts.entityId, ent.id));
  }

  // 2. Fetch existing real Nuvion accounts directly from Nuvion API for entity
  console.log(`Fetching existing real Nuvion accounts for entity_id: ${realNuvionEntityId}...`);
  const rawRes = await nuvion.getAccountsForEntity(realNuvionEntityId);
  const nuvionAccounts = rawRes?.data?.data?.accounts || rawRes?.data?.accounts || rawRes?.data?.data || (Array.isArray(rawRes?.data) ? rawRes.data : (Array.isArray(rawRes) ? rawRes : []));
  
  const createdAccounts: any[] = [];

  if (Array.isArray(nuvionAccounts) && nuvionAccounts.length > 0) {
    console.log(`✓ Nuvion returned ${nuvionAccounts.length} real entity accounts.`);

    for (const a of nuvionAccounts) {
      let accNum = a.nuvion_ban || a.account_number;
      let bankName = a.bank_name || 'Nuvion Partner Bank';

      if (!accNum && a.id) {
        try {
          const detail = await nuvion.createAccountDetails(a.id);
          accNum = detail.accountNumber;
          if (detail.bankName) bankName = detail.bankName;
        } catch (detailErr: any) {
          console.warn(`Could not fetch details for Nuvion account ${a.id}: ${detailErr.message}`);
        }
      }

      if (accNum && a.id) {
        const newAccRow = {
          id: ulid(),
          entityId: ent.id,
          nuvionAccountId: String(a.id),
          accountNumber: String(accNum),
          bankName: String(bankName),
          accountHolderName: ent.legalName,
          currency: (a.currency || 'USD').toUpperCase(),
          status: (a.status || 'active').toLowerCase(),
          createdAt: new Date(),
        };

        await db.insert(accounts).values(newAccRow);
        createdAccounts.push(newAccRow);
        console.log(`  + Saved Real Nuvion DB Account: [${newAccRow.currency}] AccountNo: ${newAccRow.accountNumber} | Bank: ${newAccRow.bankName} | NuvionId: ${newAccRow.nuvionAccountId}`);
      }
    }
  }

  // 3. Mark entity backfilled in DB
  await db
    .update(entities)
    .set({
      nuvionEntityId: realNuvionEntityId,
      nuvionStatus: 'approved',
      nuvionTier: 2,
      accountBackfilled: 1,
      accountBackfilledAt: new Date(),
    })
    .where(eq(entities.id, ent.id));

  console.log('\n================================================================');
  console.log(' ✅ ANISA LOUNGE BACKFILL COMPLETED SUCCESSFULLY');
  console.log(` Total Real Nuvion Accounts Linked in DB: ${createdAccounts.length}`);
  console.log('================================================================\n');
}

backfillAnisaLive().catch(console.error).finally(() => process.exit(0));
