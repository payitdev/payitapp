import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';

const client = new NuvionClient();

const ANISA_NUVION_ACCOUNT_IDS = [
  '01KZHJFTPQS8JW0CKS88XNMXVF', // EUR
  '01KZHJFV2G392GW1JX022KQ7AR', // GBP
  '01KZHJFVNQ7YD3KP9MFYWP7G4V', // NGN
];

async function inspectAnisaNuvionDetails() {
  console.log('===========================================================');
  console.log(' PULLING EXACT NUVION ISSUED ACCOUNT DETAILS FOR ANISA    ');
  console.log('===========================================================\n');

  for (const accId of ANISA_NUVION_ACCOUNT_IDS) {
    try {
      console.log(`Querying Nuvion API: GET /accounts/${accId}...`);
      const res = await client.getAccountById(accId);
      console.log(`\nRAW NUVION RESPONSE FOR ${accId}:`);
      console.log(JSON.stringify(res?.data || res, null, 2));
      console.log('\n-----------------------------------------------------------\n');
    } catch (err: any) {
      console.error(`Error querying account ${accId}:`, err.message);
    }
  }
}

inspectAnisaNuvionDetails().catch(console.error).finally(() => process.exit(0));
