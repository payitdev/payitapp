import 'dotenv/config';
import { createDbClient, eq } from '@payit/db';
import { entities, accounts } from '@payit/db/schema';
import { ulid } from 'ulid';

const db = createDbClient();

async function addUsd() {
  const dbEntities = await db.select().from(entities);
  const anisaEntity = dbEntities.find(e => e.legalName && e.legalName.toLowerCase().includes('anisa'));
  if (!anisaEntity) return;

  const existingUsd = await db.select().from(accounts).where(eq(accounts.entityId, anisaEntity.id));
  const hasUsd = existingUsd.some(a => a.currency === 'USD');

  if (!hasUsd) {
    await db.insert(accounts).values({
      id: ulid(),
      entityId: anisaEntity.id,
      nuvionAccountId: `nuvion_usd_anisa_${Date.now()}`,
      accountNumber: '31988967026',
      bankName: 'Cross River Bank',
      accountHolderName: 'Anisa Lounge and Restaurant Limited',
      currency: 'USD',
      status: 'ACTIVE',
    });
    console.log('✓ Added dedicated USD account for Anisa Lounge and Restaurant Limited (31988967026).');
  }
}

addUsd().catch(console.error).finally(() => process.exit(0));
