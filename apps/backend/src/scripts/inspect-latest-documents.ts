import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';

const nuvion = new NuvionClient();

async function inspectLatest() {
  const entityId = '01KZPM26QZBCNPQ9SJ7WEPCEVT';
  console.log(`Inspecting full Nuvion entity payload for latest entity ${entityId}...`);

  try {
    const liveRes = await (nuvion as any).nuvionGet(`/entities/${entityId}`);
    console.log(JSON.stringify(liveRes, null, 2));
  } catch (err: any) {
    console.error('Error fetching entity:', err.message);
  }
}

inspectLatest().catch(console.error).finally(() => process.exit(0));
