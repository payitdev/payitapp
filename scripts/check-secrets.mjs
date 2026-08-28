import { execFileSync } from 'node:child_process';

const forbiddenFiles = /(^|\/)(\.env($|\.)|.*backup.*\.(json|sql)|.*export.*\.json|.*\.log)$/i;
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:sk_live|sk_test)_[A-Za-z0-9_-]{16,}/,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  /(?:DATABASE_URL|PRIVATE_KEY|WEBHOOK_SECRET|JWT_SECRET|BRAILS_API_KEY)\s*=\s*['"]?(?!your_|change_|replace_|example|test_)[^\s'"`]{12,}/i,
];

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

const stagedFiles = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split(/\r?\n/).filter(Boolean);
const forbidden = stagedFiles.filter(file => forbiddenFiles.test(file));
const diff = runGit(['diff', '--cached', '--binary', '--unified=0']);
const addedLines = diff.split(/\r?\n/).filter(line => line.startsWith('+') && !line.startsWith('+++'));
const secretHits = [];
for (const line of addedLines) {
  if (secretPatterns.some(pattern => pattern.test(line))) secretHits.push(line.slice(0, 160));
}

if (forbidden.length || secretHits.length) {
  console.error('Secret scan failed. Remove sensitive files or values before committing.');
  for (const file of forbidden) console.error(`Sensitive path: ${file}`);
  for (const hit of secretHits) console.error(`Secret-shaped added content: ${hit}`);
  process.exit(1);
}

console.log(`Secret scan passed (${stagedFiles.length} staged files checked).`);
