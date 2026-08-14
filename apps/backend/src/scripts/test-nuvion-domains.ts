import 'dotenv/config';
import axios from 'axios';

async function testDomains() {
  const apiKey = 'nv_live_sk_4ea3d0fa0eb2db510c142108f9143d5d';
  const candidateUrls = [
    'https://api.nuvion.dev',
    'https://api.nuvion.co',
    'https://sandbox-api.nuvion.co',
    'https://sandbox-api.nuvion.dev',
    'https://api.sandbox.nuvion.co',
    'https://api.sandbox.nuvion.dev',
    'https://sandbox.nuvion.co',
    'https://sandbox.nuvion.dev',
    'https://api.nuvion.com',
  ];

  for (const url of candidateUrls) {
    console.log(`Testing: ${url}`);
    try {
      const res = await axios.get(`${url}/entities`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        timeout: 8000,
      });
      console.log(`🎉 SUCCESS ON ${url}! Status: ${res.status}`);
      console.log('Response:', JSON.stringify(res.data).slice(0, 300));
      return;
    } catch (err: any) {
      if (err.code === 'ENOTFOUND') {
        console.log(`   ❌ ${url}: DNS ENOTFOUND`);
      } else if (err.response) {
        console.log(`   ⚠️ ${url}: HTTP ${err.response.status} - ${JSON.stringify(err.response.data)}`);
      } else {
        console.log(`   ❌ ${url}: ${err.message}`);
      }
    }
  }
}

testDomains().catch(console.error).finally(() => process.exit(0));
