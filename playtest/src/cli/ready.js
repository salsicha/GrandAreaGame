#!/usr/bin/env node
const { runReadinessCheck } = require('../checks/readiness');

const result = runReadinessCheck();

console.log('Grand Area Qwen/Ollama playtest readiness');
console.log(`Actors: ${result.actors.length}`);
console.log(`Legal action counts: ${JSON.stringify(result.legalActionCounts)}`);
if (result.ollamaVersion) console.log(`Ollama command: ${result.ollamaVersion}`);
for (const warning of result.warnings) console.log(`[WARN] ${warning}`);
for (const error of result.errors) console.error(`[ERROR] ${error}`);

if (!result.ok) process.exit(1);
console.log('Ready: configs, prompts, schema, observations, legal actions, and engine adapter are valid.');
