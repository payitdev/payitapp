import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createDbClient, users, entities, ledgerAccounts, ledgerEntries, nuvionAccountDetails, nuvionCards, brailsCards, inArray } from '@payit/db';
import { like } from 'drizzle-orm';

const db = createDbClient();

async function clearTelegramUsers() {
  console.log('🧹 Clearing Telegram bot users and resetting state...');
  try {
    const tgUsers = await db.select().from(users).where(like(users.id, 'tg_%'));
    console.log(`Found ${tgUsers.length} telegram users to delete.`);

    for (const u of tgUsers) {
      console.log(`Deleting user: ${u.id} (${u.fullName} / ${u.email})`);
      const userEntities = await db.select().from(entities).where(like(entities.userId, u.id));
      const entityIds = userEntities.map(e => e.id);

      if (entityIds.length > 0) {
        console.log(`- Deleting related entity records for: ${entityIds.join(', ')}`);
        
        try {
          await db.delete(nuvionCards).where(inArray(nuvionCards.entityId, entityIds));
        } catch (e: any) {
          console.warn('nuvionCards note:', e.message);
        }

        try {
          await db.delete(nuvionAccountDetails).where(inArray(nuvionAccountDetails.entityId, entityIds));
        } catch (e: any) {
          console.warn('nuvionAccountDetails note:', e.message);
        }

        try {
          await db.delete(brailsCards).where(inArray(brailsCards.entityId, entityIds));
        } catch (e: any) {
          console.warn('brailsCards note:', e.message);
        }

        const accounts = await db.select().from(ledgerAccounts).where(inArray(ledgerAccounts.entityId, entityIds));
        const accountIds = accounts.map(a => a.id);
        if (accountIds.length > 0) {
          try {
            await db.delete(ledgerEntries).where(inArray(ledgerEntries.ledgerAccountId, accountIds));
          } catch (e: any) {
            console.warn('ledgerEntries note:', e.message);
          }
          try {
            await db.delete(ledgerAccounts).where(inArray(ledgerAccounts.id, accountIds));
          } catch (e: any) {
            console.warn('ledgerAccounts note:', e.message);
          }
        }

        await db.delete(entities).where(inArray(entities.id, entityIds));
      }

      await db.delete(users).where(like(users.id, u.id));
    }

    console.log('✅ All Telegram bot users, entities, and ledger accounts have been successfully purged.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error clearing Telegram users:', err.message);
    process.exit(1);
  }
}

clearTelegramUsers();
