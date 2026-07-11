const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function fromRepo(...parts) {
  return path.join(repoRoot, ...parts);
}

function readText(...parts) {
  return fs.readFileSync(fromRepo(...parts), 'utf8');
}

function readJson(...parts) {
  return JSON.parse(readText(...parts));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashValue(value) {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function hashText(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

module.exports = {
  ensureDir,
  fromRepo,
  hashText,
  hashValue,
  readJson,
  readText,
  repoRoot,
  stableStringify
};
