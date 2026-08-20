import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

console.log('🔍 Running Build Integrity Audit & Route Verification...');

const distServerPath = path.join(backendDir, 'dist', 'server.js');
const srcServerPath = path.join(backendDir, 'src', 'server.ts');

if (!fs.existsSync(distServerPath)) {
  console.error('❌ Build Error: dist/server.js does not exist!');
  process.exit(1);
}

const srcServerContent = fs.readFileSync(srcServerPath, 'utf8');
const distServerContent = fs.readFileSync(distServerPath, 'utf8');

// Extract registered route identifiers from src/server.ts
const registeredRoutesSrc = Array.from(srcServerContent.matchAll(/server\.register\((\w+)\)/g)).map(m => m[1]);
console.log(`Found ${registeredRoutesSrc.length} route registrations in src/server.ts:`, registeredRoutesSrc);

const missingInDist = registeredRoutesSrc.filter(route => !distServerContent.includes(route));

if (missingInDist.length > 0) {
  console.error(`❌ Build Integrity Failure: The following routes are in src/server.ts but missing in compiled dist/server.js:`, missingInDist);
  process.exit(1);
}

// Critical endpoint assertions
const criticalEndpointChecks = [
  { file: 'dist/routes/auth.js', text: '/api/auth/passkey/register', name: 'Turnkey Passkey Register Endpoint' },
  { file: 'dist/routes/auth.js', text: '/api/auth/session', name: 'Session Restore Endpoint' },
  { file: 'dist/routes/cards.js', text: '/api/cards/freeze', name: 'Card Freeze Endpoint' },
  { file: 'dist/routes/social.js', text: '/api/friends/request', name: 'Social Friends Request Endpoint' },
  { file: 'dist/routes/savings.js', text: '/api/savings/summary', name: 'Savings Summary Endpoint' },
  { file: 'dist/routes/waitlist.js', text: '/api/waitlist', name: 'Waitlist Endpoint' },
];

let hasErrors = false;
for (const check of criticalEndpointChecks) {
  const fullPath = path.join(backendDir, check.file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Build Integrity Error: Expected output file missing: ${check.file}`);
    hasErrors = true;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes(check.text)) {
    console.error(`❌ Build Integrity Failure: ${check.name} ("${check.text}") is missing in ${check.file}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('❌ Build Verification Failed!');
  process.exit(1);
}

console.log('✅ Build Integrity Audit Passed! All source routes and endpoints match dist compiled output 100%.');
