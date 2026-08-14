import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';

const nuvion = new NuvionClient();

async function testFullSubmissionWithDocs() {
  console.log('Testing Nuvion onboarding submission with document uploads...');

  // Sample 1x1 PNG base64 string
  const dummyDocBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    const res = await (nuvion as any).createIndividualEntity({
      name: 'Iboh Igboze Igboze',
      person: {
        first_name: 'Iboh',
        last_name: 'Igboze Igboze',
        date_of_birth: '1995-05-19',
        email: `iboh.${Date.now()}@payit.app`,
        nationality: 'NG',
        gender: 'm',
        phonenumber: '+2349121285147',
        bvn: '22113344556',
      },
      address: {
        line_1: 'Navy Estate, Karshi, Abuja',
        city: 'Abuja',
        state: 'FCT',
        postal_code: '900001',
        country_code: 'NG',
      },
      identification: {
        document: {
          type: 'national_id',
          number: '22113344556',
        },
        identity_numbers: [
          {
            type: 'BVN',
            value: '22113344556',
          },
        ],
      },
    });

    console.log('1. Created Entity ID:', res.entityId);

    const doc1 = await nuvion.uploadEntityDocument(
      res.entityId,
      'identity',
      dummyDocBase64,
      'Government Identity Document',
      { file_type: 'image/png' },
      res.personId
    );
    console.log('2. Identity Document Uploaded:', JSON.stringify(doc1));

    const doc2 = await nuvion.uploadEntityDocument(
      res.entityId,
      'proof_of_address',
      dummyDocBase64,
      'Proof of Address Document',
      { file_type: 'image/png' }
    );
    console.log('3. Proof of Address Document Uploaded:', JSON.stringify(doc2));

    const subRes = await nuvion.submitForVerification(res.entityId);
    console.log('4. Onboarding Submission Response:', JSON.stringify(subRes, null, 2));

    const liveEntity = await nuvion.getEntityById(res.entityId);
    console.log('5. Live Entity Status after Submission:', JSON.stringify(liveEntity, null, 2));

  } catch (err: any) {
    console.error('Error in flow:', err.message, err.response?.data || '');
  }
}

testFullSubmissionWithDocs().catch(console.error).finally(() => process.exit(0));
