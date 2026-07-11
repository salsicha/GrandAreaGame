const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { JavaScriptGameAdapter } = require('../engine/jsAdapter');
const { fromRepo, readJson, readText } = require('../util/files');

const PROHIBITED_OBSERVATION_KEYS = [
  'pendingSecretActions',
  'commitmentPreimages',
  'otherPlayersPrivateCards',
  'futureCrisisOrder',
  'rngInternalState',
  'crisisDeck',
  'deck',
  'hands',
  'submissions'
];

function findKeyDeep(value, prohibited, path = '') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findKeyDeep(value[index], prohibited, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(value)) {
    if (prohibited.includes(key)) return path ? `${path}.${key}` : key;
    const found = findKeyDeep(value[key], prohibited, path ? `${path}.${key}` : key);
    if (found) return found;
  }
  return null;
}

function commandCheck(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) return { available: false, text: '', serviceWarning: false };
  const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const versionLine = lines.find(line => /version/i.test(line) && !/could not connect/i.test(line)) || lines[0] || '';
  return {
    available: true,
    text: versionLine.replace(/^Warning:\s*/, ''),
    serviceWarning: /could not connect/i.test(text)
  };
}

function runReadinessCheck(configPath = 'playtest/configs/qwen3.6-agents.json', experimentPath = 'playtest/configs/experiments.json') {
  const config = readJson(configPath);
  const experiments = readJson(experimentPath);
  const experiment = experiments.defaultExperiment;
  const errors = [];
  const warnings = [];

  if (!config.ollama || !config.ollama.model) errors.push('Missing ollama.model in agent config');
  if (config.ollama && config.ollama.model !== 'qwen3.6') warnings.push(`Configured model is ${config.ollama.model}; expected qwen3.6 for this setup`);
  if (!experiment || experiment.engine !== 'javascript') errors.push('Default experiment must use the javascript engine');

  Object.values(config.promptFiles || {}).forEach(promptPath => {
    if (!fs.existsSync(fromRepo(promptPath))) errors.push(`Missing prompt file ${promptPath}`);
    else if (readText(promptPath).trim().length === 0) errors.push(`Prompt file ${promptPath} is empty`);
  });

  const adapter = new JavaScriptGameAdapter({ maxRounds: experiment.maxRounds });
  const state = adapter.createInitialState({ maxRounds: experiment.maxRounds }, experiment.episodeSeed);
  const actors = adapter.getPendingActors(state);
  const assignments = new Map((config.seatAssignments || []).map(entry => [entry.actor, entry.agentId]));
  actors.forEach(actor => {
    if (!assignments.has(actor)) errors.push(`Missing seat assignment for ${actor}`);
    const legalActions = adapter.listLegalActions(state, actor);
    if (legalActions.length === 0) errors.push(`${actor} has no legal actions at setup`);
    const observation = adapter.getObservation(state, actor);
    const leakedPath = findKeyDeep(observation, PROHIBITED_OBSERVATION_KEYS);
    if (leakedPath) errors.push(`${actor} observation includes prohibited key ${leakedPath}`);
  });

  (config.seatAssignments || []).forEach(entry => {
    if (!actors.includes(entry.actor)) errors.push(`Seat assignment references unknown actor ${entry.actor}`);
    if (!config.agentProfiles || !config.agentProfiles[entry.agentId]) errors.push(`Seat assignment references missing agent ${entry.agentId}`);
  });

  const ollama = commandCheck('ollama', ['--version']);
  if (!ollama.available) warnings.push('ollama command was not found; install/start Ollama before running npm run playtest:qwen');
  if (ollama.available && ollama.serviceWarning) warnings.push('ollama command is installed, but the local service was not reachable; run ollama serve before npm run playtest:qwen');

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    actors,
    legalActionCounts: Object.fromEntries(actors.map(actor => [actor, adapter.listLegalActions(state, actor).length])),
    ollamaVersion: ollama.available ? ollama.text : null
  };
}

module.exports = {
  PROHIBITED_OBSERVATION_KEYS,
  findKeyDeep,
  runReadinessCheck
};
