import { execFileSync } from 'node:child_process';

const forbiddenFiles = /(^|\/)(\.env($|\.)|.*backup.*\.(json|sql)|.*export.*\.json|.*\.log|\.json\.json|\.exe)$/i;
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:sk_live|sk_test|nv_live|nv_test)_[A-Za-z0-9_-]{16,}/,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  /(?:DATABASE_URL|PRIVATE_KEY|WEBHOOK_SECRET|JWT_SECRET|BRAILS_API_KEY|NEAR_RELAYER_PRIVATE_KEY|EASEID_API_KEY)\s*=\s*['"]?(?!your[_-]|change[_-]|replace[_-]|example[_-]|test[_-]|<|process\.env|['"]?\$\{)[^\s'"`]{12,}/i,
  /postgresql:\/\/(?!postgres:postgres@localhost)[^:]+:[^@]+@/,
];

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

const stagedFiles = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split(/\r?\n/).filter(Boolean);
const forbidden = stagedFiles.filter(file => forbiddenFiles.test(file));

const secretHits = [];
for (const file of stagedFiles) {
  // Skip documentation and example config files
  if (file.endsWith('.md') || file === '.env.example') continue;
  const fileDiff = runGit(['diff', '--cached', '--binary', '--unified=0', '--', file]);
  const addedLines = fileDiff.split(/\r?\n/).filter(line => line.startsWith('+') && !line.startsWith('+++'));
  for (const line of addedLines) {
    // Ignore test mock keys (e.g. ed25519:111111...)
    if (file.includes('test') && line.includes('11111111111111111111111111111111')) continue;
    // Ignore references to process.env
    if (line.includes('process.env.')) continue;
    if (secretPatterns.some(pattern => pattern.test(line))) {
      secretHits.push(`${file}: ${line.slice(0, 160)}`);
    }
  }
}

if (forbidden.length || secretHits.length) {
  console.error('Secret scan failed. Remove sensitive files or values before committing.');
  for (const file of forbidden) console.error(`Sensitive path: ${file}`);
  for (const hit of secretHits) console.error(`Secret-shaped added content: ${hit}`);
  process.exit(1);
}

console.log(`Secret scan passed (${stagedFiles.length} staged files checked).`);
