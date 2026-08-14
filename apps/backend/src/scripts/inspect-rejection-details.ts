import 'dotenv/config';
import { NuvionClient } from '@payit/integrations';

const nuvion = new NuvionClient();

async function inspectRejection() {
  const entityId = '01KZPD9WY32RAKDTBN7450040Y';
  console.log(`Inspecting full Nuvion entity payload for ${entityId}...`);

  try {
    const liveRes = await (nuvion as any).nuvionGet(`/entities/${entityId}`);
    console.log(JSON.stringify(liveRes, null, 2));
  } catch (err: any) {
    console.error('Error fetching entity:', err.message);
  }
}

inspectRejection().catch(console.error).finally(() => process.exit(0));
