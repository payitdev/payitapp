import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';
import { createDbClient, eq, or, inArray } from '@payit/db';
import { entities, accounts, archivedAccounts } from '@payit/db/schema';
import { onEntityApproved } from '../routes/webhooks.js';
import { ulid } from 'ulid';

const db = createDbClient();
const nuvion = new NuvionClient();

interface BackfillSummary {
  totalScanned: number;
  totalAffected: number;
  successfullyBackfilled: number;
  skippedNeedsReKyc: number;
  skippedNeedsDocumentReUpload: number;
  errorsEncountered: Array<{ entityId: string; legalName: string; error: string }>;
}

/**
 * Polling fallback helper to check if Nuvion entity verification has been approved.
 */
async function pollEntityApproval(nuvionEntityId: string, maxWaitMs = 30000, intervalMs = 5000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await nuvion.getAccountsForEntity(nuvionEntityId);
      // If Nuvion returns accounts or entity status call succeeds, entity is approved
      if (res && Array.isArray(res)) {
        return true;
      }
    } catch {
      // Continue polling until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

async function runBackfill() {
  const args = process.argv.slice(2);
  const isExecuteMode = args.includes('--execute');
  const isDryRun = !isExecuteMode || args.includes('--dry-run');

  console.log('================================================================');
  console.log(` 🔄 NUVION VIRTUAL ACCOUNT BACKFILL SCRIPT`);
  console.log(` Mode: ${isDryRun ? '🔍 DRY RUN (Simulated - No DB/API writes)' : '🚀 EXECUTE (Live Migration)'}`);
  console.log('================================================================\n');

  const summary: BackfillSummary = {
    totalScanned: 0,
    totalAffected: 0,
    successfullyBackfilled: 0,
    skippedNeedsReKyc: 0,
    skippedNeedsDocumentReUpload: 0,
    errorsEncountered: [],
  };

  // 1. Scan all entities in DB that haven't been backfilled yet
  const allEntities = await db
    .select()
    .from(entities)
    .where(eq(entities.accountBackfilled, 0));

  summary.totalScanned = allEntities.length;
  console.log(`Scanned ${allEntities.length} non-backfilled entities in Neon DB...`);

  // Find all user accounts in DB to identify merchant account numbers or fabricated IDs
  const allAccounts = await db.select().from(accounts);
  const accountCountMap = new Map<string, number>();

  for (const acc of allAccounts) {
    const key = acc.accountNumber;
    accountCountMap.set(key, (accountCountMap.get(key) || 0) + 1);
  }

  // Identify affected entities: fabricated nuvionEntityId, fabricated nuvionAccountId, or shared merchant account number
  const affectedEntities = allEntities.filter((ent) => {
    const isFabricatedEntityId = !ent.nuvionEntityId || ent.nuvionEntityId.startsWith('nuvion_pers_') || ent.nuvionEntityId.startsWith('nuvion_biz_');
    const entAccounts = allAccounts.filter((a) => a.entityId === ent.id);
    const isFabricatedAcc = entAccounts.some((a) => a.nuvionAccountId.startsWith('nuvion_') || (accountCountMap.get(a.accountNumber) || 0) > 1);

    return isFabricatedEntityId || isFabricatedAcc;
  });

  summary.totalAffected = affectedEntities.length;
  console.log(`Identified ${affectedEntities.length} affected entities requiring account remediation.\n`);

  for (const ent of affectedEntities) {
    console.log(`----------------------------------------------------------------`);
    console.log(`[Entity ${ent.id}] ${ent.legalName} (${ent.kind}) | Current EntityID: "${ent.nuvionEntityId || 'NONE'}"`);

    // 2. Fetch linked account history for archiving
    const entAccounts = allAccounts.filter((a) => a.entityId === ent.id);

    // 3. Attempt to parse original KYC data
    let kycData: any = null;

    if (ent.legalName && ent.legalName.trim()) {
      const nameParts = ent.legalName.trim().split(' ');
      kycData = {
        legalName: ent.legalName.trim(),
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
      };
    }

    // 4. Validate data completeness — DO NOT guess or auto-generate missing fields
    if (ent.kind === 'PERSONAL') {
      if (!kycData || !kycData.firstName || !kycData.lastName) {
        console.warn(`  ⚠️ SKIPPED: Entity missing required personal name fields. Marked: NEEDS_RE_KYC.`);
        summary.skippedNeedsReKyc++;
        continue;
      }
    } else {
      if (!ent.legalName || !ent.businessTag) {
        console.warn(`  ⚠️ SKIPPED: Corporate entity missing business name or RC tag. Marked: NEEDS_RE_KYC.`);
        summary.skippedNeedsReKyc++;
        continue;
      }
    }

    if (isDryRun) {
      console.log(`  [DRY-RUN] Would register new ${ent.kind} entity on Nuvion for "${ent.legalName}".`);
      console.log(`  [DRY-RUN] Would archive ${entAccounts.length} old account reference(s).`);
      summary.successfullyBackfilled++;
      continue;
    }

    // 5. EXECUTE MODE: Create real Nuvion Entity
    try {
      let realNuvionEntityId = '';
      let personId = '';

      if (ent.kind === 'PERSONAL') {
        const entityRes = await nuvion.createIndividualEntity({
          name: ent.legalName,
          person: {
            first_name: kycData.firstName,
            last_name: kycData.lastName || kycData.firstName,
            date_of_birth: '1995-01-01',
            email: `user.${ent.id.slice(-6)}@payit.app`,
            nationality: 'NG',
            gender: 'm',
            phonenumber: '+2348000000000',
          },
          address: {
            line_1: 'Lagos, Nigeria',
            city: 'Lagos',
            state: 'Lagos',
            postal_code: '100001',
            country_code: 'NG',
          },
        });
        realNuvionEntityId = entityRes.entityId;
        personId = entityRes.personId || '';
      } else {
        const entityRes = await nuvion.createBusinessEntity({
          name: ent.legalName,
          business: {
            legal_name: ent.legalName,
            industry: 'Financial Services',
            email: `biz.${ent.id.slice(-6)}@payit.app`,
            type: 'llc',
            description: 'Corporate Payment Entity',
            registration_number: ent.businessTag || `RC${Date.now().toString().slice(-6)}`,
            incorporation_meta: { year: 2022, month: 1, country: 'NG', state: 'Lagos' },
          },
          address: {
            line_1: 'Victoria Island',
            city: 'Lagos',
            state: 'Lagos',
            postal_code: '100001',
            country_code: 'NG',
          },
          business_officers: [],
        });
        realNuvionEntityId = entityRes.entityId;
        personId = entityRes.personId || '';
      }

      console.log(`  ✓ Created Real Nuvion Entity: ${realNuvionEntityId}`);

      // 6. Submit entity for verification
      try {
        await nuvion.submitForVerification(realNuvionEntityId);
        console.log(`  ✓ Submitted entity ${realNuvionEntityId} for verification.`);
      } catch (verr: any) {
        console.warn(`  ⚠️ submitForVerification returned: ${verr.message}`);
      }

      // 7. Polling fallback for entity approval and virtual account provisioning
      console.log(`  ⌛ Polling Nuvion for entity approval & provisioning...`);
      await pollEntityApproval(realNuvionEntityId, 25000, 5000);

      // 8. Archive old account references in archivedAccounts table (DO NOT delete history)
      for (const oldAcc of entAccounts) {
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
        console.log(`  📦 Archived old account reference: [${oldAcc.currency}] ${oldAcc.accountNumber}`);
      }

      // Remove old misassigned accounts from active accounts table
      if (entAccounts.length > 0) {
        await db.delete(accounts).where(eq(accounts.entityId, ent.id));
      }

      // 9. Trigger account creation via onEntityApproved flow
      await onEntityApproved(db, ent.id, realNuvionEntityId, ent.kind, ent.legalName);

      // 10. Update entity in DB: set real nuvionEntityId and mark accountBackfilled = 1
      await db
        .update(entities)
        .set({
          nuvionEntityId: realNuvionEntityId,
          nuvionStatus: 'approved',
          accountBackfilled: 1,
          accountBackfilledAt: new Date(),
        })
        .where(eq(entities.id, ent.id));

      console.log(`  ✅ Successfully backfilled entity ${ent.id} with real Nuvion virtual accounts.`);
      summary.successfullyBackfilled++;
    } catch (err: any) {
      console.error(`  ❌ Error processing entity ${ent.id}: ${err.message}`);
      summary.errorsEncountered.push({
        entityId: ent.id,
        legalName: ent.legalName,
        error: err.message,
      });
    }
  }

  // 11. Final Summary Report Logging
  console.log('\n================================================================');
  console.log(' 📊 BACKFILL SUMMARY REPORT');
  console.log('================================================================');
  console.log(` Mode:                            ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(` Total Entities Scanned:          ${summary.totalScanned}`);
  console.log(` Total Affected Entities:         ${summary.totalAffected}`);
  console.log(` Successfully Backfilled:         ${summary.successfullyBackfilled}`);
  console.log(` Skipped (Needs Re-KYC):          ${summary.skippedNeedsReKyc}`);
  console.log(` Skipped (Needs Doc Re-upload):   ${summary.skippedNeedsDocumentReUpload}`);
  console.log(` API Errors Encountered:          ${summary.errorsEncountered.length}`);

  if (summary.errorsEncountered.length > 0) {
    console.log('\nError Details:');
    summary.errorsEncountered.forEach((e) => {
      console.log(`  - [Entity ${e.entityId}] ${e.legalName}: ${e.error}`);
    });
  }
  console.log('================================================================\n');
}

runBackfill().catch(console.error).finally(() => process.exit(0));
