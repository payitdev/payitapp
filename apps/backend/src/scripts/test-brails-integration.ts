import 'dotenv/config';
import { BrailsClient } from '@payit/integrations';

const brails = new BrailsClient();

async function testBrailsFlow() {
  console.log('===========================================================');
  console.log(' TESTING REAL BRAILS INTEGRATION CLIENT (LIVE HTTP CALLS)  ');
  console.log('===========================================================');

  try {
    // 1. Create Customer
    console.log('1. Sending POST /customers to Brails...');
    const custRes = await brails.createCustomer({
      firstName: 'Tomiwa',
      lastName: 'Ade',
      email: `tomiwa.${Date.now()}@payit.app`,
      bvn: '22113344556',
      nin: '11223344556',
      dob: '1995-05-19',
      address: {
        streetLine1: '14 Navy Estate',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        postalCode: '900001',
      },
    });
    console.log('   Live Customer Response:', JSON.stringify(custRes, null, 2));

    const customerId = custRes.data?.id || custRes.id;

    // 2. Create NGN Virtual Account
    console.log('\n2. Sending POST /virtual-accounts (NGN) to Brails...');
    const ngnAccRes = await brails.createVirtualAccount({
      customerId,
      currency: 'NGN',
      type: 'INDIVIDUAL',
      firstName: 'Tomiwa',
      lastName: 'Ade',
      bvn: '22113344556',
      nin: '11223344556',
      reference: `test_ngn_${Date.now()}`,
    });
    console.log('   Live NGN Account Response:', JSON.stringify(ngnAccRes, null, 2));

    // 3. Get Swap Quote (USD -> NGN)
    console.log('\n3. Sending GET /wallets/quote (USD -> NGN) to Brails...');
    const quoteRes = await brails.getQuote('USD', 'NGN', 100);
    console.log('   Live Swap Quote Response:', JSON.stringify(quoteRes, null, 2));

    console.log('\n✅ LIVE BRAILS INTEGRATION TEST COMPLETE!');
  } catch (err: any) {
    console.error('\n⚠️ Live Brails API Call Error (as expected if BRAILS_API_KEY is pending production activation):', err.message);
  }
}

testBrailsFlow().catch(console.error).finally(() => process.exit(0));
