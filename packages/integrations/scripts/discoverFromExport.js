#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const exportPath = process.argv[2];
if (!exportPath) {
  console.error('Usage: node discoverFromExport.js <path-to-dashboard-export.json>');
  process.exit(2);
}

let content;
try {
  content = fs.readFileSync(path.resolve(exportPath), 'utf8');
} catch (err) {
  console.error('Failed to read file:', err.message);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(content);
} catch (err) {
  console.error('Failed to parse JSON:', err.message);
  process.exit(1);
}

// Collect any UUID-looking strings in the JSON by serializing and regex
const text = JSON.stringify(parsed);
const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const matches = Array.from(new Set((text.match(uuidRegex) || [])));

if (matches.length === 0) {
  console.log('No UUIDs found in export.');
  process.exit(0);
}

console.log('Found UUIDs:', matches);

// Call the existing discoverTurnkeyOrg.js script with the found UUIDs
const script = path.resolve(__dirname, 'discoverTurnkeyOrg.js');
const args = matches;
console.log('Invoking discoverTurnkeyOrg.js with extracted UUIDs...');
const res = spawnSync('node', [script, ...args], { stdio: 'inherit', env: process.env });
process.exit(res.status || 0);
