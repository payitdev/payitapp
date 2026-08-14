import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';

const nuvion = new NuvionClient();

async function inspectCurrentSubmission() {
  const entityId = '01KZPEHENTCYC3ZZ408GENNGNH';
  console.log(`Inspecting full Nuvion entity payload for ${entityId}...`);

  try {
    const liveRes = await (nuvion as any).nuvionGet(`/entities/${entityId}`);
    console.log(JSON.stringify(liveRes, null, 2));
  } catch (err: any) {
    console.error('Error fetching entity:', err.message);
  }
}

inspectCurrentSubmission().catch(console.error).finally(() => process.exit(0));
