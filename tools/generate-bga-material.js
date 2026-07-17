// Generates bga/material.inc.php from the prototype JSON fixtures so the BGA
// module is fully self-contained (BGA deploys only the game folder; it can
// never read ../frontend at runtime).
//
// Run: node tools/generate-bga-material.js
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const SOURCES = ['territories.json', 'crisis.json', 'playercards.json', 'setups.json', 'balance.json'];

function readSource(name) {
  return fs.readFileSync(path.join(repoRoot, 'frontend', 'data', name), 'utf8');
}

function phpValue(value, indent) {
  const pad = '    '.repeat(indent);
  const inner = '    '.repeat(indent + 1);
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === 'string') return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array()';
    const items = value.map(item => inner + phpValue(item, indent + 1));
    return 'array(\n' + items.join(',\n') + '\n' + pad + ')';
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return 'array()';
  const items = entries.map(([key, item]) => inner + phpValue(key, indent + 1) + ' => ' + phpValue(item, indent + 1));
  return 'array(\n' + items.join(',\n') + '\n' + pad + ')';
}

const raw = {};
for (const name of SOURCES) raw[name] = readSource(name);
const checksum = crypto.createHash('sha256').update(SOURCES.map(name => raw[name]).join('\n')).digest('hex');

const territories = JSON.parse(raw['territories.json']);
const crisis = JSON.parse(raw['crisis.json']);
const playercards = JSON.parse(raw['playercards.json']);
const setups = JSON.parse(raw['setups.json']);
const balance = JSON.parse(raw['balance.json']);

const out = [];
out.push('<?php');
out.push('/**');
out.push(' * GENERATED FILE - do not edit by hand.');
out.push(' *');
out.push(' * Game material embedded from frontend/data/*.json so the BGA module is');
out.push(' * self-contained. Regenerate after changing any source JSON with:');
out.push(' *   node tools/generate-bga-material.js');
out.push(' *');
out.push(` * source-checksum: ${checksum}`);
out.push(' */');
out.push('');
out.push("require_once 'modules/php/constants.inc.php';");
out.push('');
out.push('$this->territoryMaterial = ' + phpValue(territories, 0) + ';');
out.push('');
out.push('$this->crisisMaterial = ' + phpValue(crisis, 0) + ';');
out.push('');
out.push('$this->playerCardMaterial = ' + phpValue(playercards, 0) + ';');
out.push('');
out.push('$this->setupMaterial = ' + phpValue(setups, 0) + ';');
out.push('');
out.push('$this->balanceMaterial = ' + phpValue(balance, 0) + ';');
out.push('');
out.push('$this->roundPhases = grandarea_round_phases();');
out.push('$this->allowedActions = grandarea_allowed_actions();');
out.push('');

fs.writeFileSync(path.join(repoRoot, 'bga', 'material.inc.php'), out.join('\n'));
console.log('Wrote bga/material.inc.php (source-checksum ' + checksum.slice(0, 12) + '...)');
