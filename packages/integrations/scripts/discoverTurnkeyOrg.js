#!/usr/bin/env node
const { TurnkeyClient } = require('@turnkey/http');
const { ApiKeyStamper } = require('@turnkey/api-key-stamper');

const baseUrl = process.env.TURNKEY_BASE_URL || 'https://api.turnkey.com';
const publicKey = process.env.TURNKEY_API_PUBLIC_KEY;
const privateKey = process.env.TURNKEY_API_PRIVATE_KEY;

if (!publicKey || !privateKey) {
  console.error('Missing TURNKEY_API_PUBLIC_KEY or TURNKEY_API_PRIVATE_KEY');
  process.exit(2);
}

const candidateOrgs = process.argv.slice(2);
if (candidateOrgs.length === 0 && process.env.TURNKEY_ORGANIZATION_ID) {
  candidateOrgs.push(process.env.TURNKEY_ORGANIZATION_ID);
}

if (candidateOrgs.length === 0) {
  console.log('No candidate organization IDs provided as args or TURNKEY_ORGANIZATION_ID unset.');
  console.log('Usage: node discoverTurnkeyOrg.js <orgId1> [orgId2] ...');
  process.exit(2);
}

(async () => {
  const input = { apiKey: publicKey };
  for (const org of candidateOrgs) {
    console.log('\n== Trying organization:', org, '==');
    try {
      // set env for stamper if needed
      process.env.TURNKEY_ORGANIZATION_ID = org;
      const stamper = new ApiKeyStamper({ apiPublicKey: publicKey, apiPrivateKey: privateKey });
      const client = new TurnkeyClient({ baseUrl }, stamper);

      // attempt a live getApiKey call to see server response for this org
      console.log('Calling Turnkey getApiKey (network)');
      const resp = await client.getApiKey(input);
      console.log('Success for org', org);
      console.log(JSON.stringify(resp, null, 2));
    } catch (err) {
      if (err && err.response && err.response.data) {
        console.error('Turnkey API error for org', org + ':', JSON.stringify(err.response.data, null, 2));
      } else {
        console.error('Error for org', org + ':', err && err.message ? err.message : err);
      }
    }
  }
  process.exit(0);
})();
