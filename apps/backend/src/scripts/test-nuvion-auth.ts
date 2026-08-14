import 'dotenv/config';
import axios from 'axios';

async function testAuth() {
  const apiKey = process.env.NUVION_API_KEY;
  const urls = ['https://api.nuvion.co', 'https://api.nuvion.dev'];

  for (const baseUrl of urls) {
    console.log(`Testing Nuvion auth on ${baseUrl}...`);
    try {
      const res = await axios.get(`${baseUrl}/entities`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });
      console.log(`✅ Auth successful on ${baseUrl}! Response count:`, Array.isArray(res.data?.data) ? res.data.data.length : 'OK');
    } catch (err: any) {
      console.error(`❌ Auth Failed on ${baseUrl}! Status:`, err.response?.status, err.response?.data || err.message);
    }
  }
}

testAuth().catch(console.error).finally(() => process.exit(0));
