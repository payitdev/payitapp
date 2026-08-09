import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';

const client = new NuvionClient();

async function dumpRawNuvion() {
  console.log('====================================================');
  console.log('   QUERYING LIVE NUVION API FOR ALL RAW ACCOUNTS    ');
  console.log('====================================================\n');

  try {
    const res = await (client as any).nuvionGet('/accounts');
    const rawList = res?.data?.data?.data || res?.data?.data?.accounts || res?.data?.accounts || res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
    
    console.log(`Total accounts registered under Nuvion API Key: ${rawList.length}\n`);

    for (let i = 0; i < rawList.length; i++) {
      const acc = rawList[i];
      console.log(`--- Account #${i + 1} ---`);
      console.log(`ID: ${acc.id}`);
      console.log(`Display Name: "${acc.display_name}"`);
      console.log(`Currency: ${acc.currency}`);
      console.log(`Summary BAN (nuvion_ban): ${acc.nuvion_ban}`);
      console.log(`Bank Name: ${acc.bank_name}`);
      console.log(`Meta:`, JSON.stringify(acc.meta || {}, null, 2));

      // Query full individual account details from Nuvion
      try {
        const detailRes = await client.getAccountById(acc.id);
        const detailsData = detailRes?.data || detailRes;
        console.log(`Full Account Details Response for ${acc.id}:`);
        console.log(JSON.stringify(detailsData, null, 2));
      } catch (err: any) {
        console.log(`Could not fetch details for ${acc.id}: ${err.message}`);
      }
      console.log('\n----------------------------------------------------\n');
    }
  } catch (err: any) {
    console.error('Error fetching Nuvion accounts:', err.message);
  }
}

dumpRawNuvion().catch(console.error).finally(() => process.exit(0));
