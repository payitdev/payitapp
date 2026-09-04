import { existsSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
if (!existsSync(distDir)) {
  console.error('Build failed: dist directory not found');
  process.exit(1);
}

const serverFile = join(distDir, 'server.js');
if (!existsSync(serverFile)) {
  console.error('Build failed: server.js not found in dist');
  process.exit(1);
}

console.log('Build verified successfully.');
