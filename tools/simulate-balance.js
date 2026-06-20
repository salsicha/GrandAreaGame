const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');

function readText(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
}

function readJson(...parts) {
  return JSON.parse(readText(...parts));
}

function loadRules() {
  const context = { window: {}, Math };
  vm.runInNewContext(readText('frontend', 'rules.js'), context, { filename: 'frontend/rules.js' });
  return context.window.Rules;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function chooseAction(key, state, round) {
  const data = state[key];
  if (!data || data.family === 'Collapsed' || data.family === 'Anarchy') return { family: key, action: 'Pass', target: 'Self' };
  if (data.type === 'Client' && data.independenceSentiment >= 55 && data.happiness >= 90) {
    return { family: key, action: 'Educate', target: 'Self' };
  }
  if (data.type === 'Head' && round % 3 === 0) {
    const client = Object.keys(state).find(k => state[k].type === 'Client' && state[k].clientOf === data.family);
    return { family: key, action: client ? 'Concession' : 'Pass', target: client || 'Self' };
  }
  if ((data.resources || []).includes('Technology') || (data.resources || []).includes('Industry')) {
    return { family: key, action: 'Develop', target: 'Self' };
  }
  return { family: key, action: 'Pass', target: 'Self' };
}

function runSimulation(rounds = 6, seed = 'balance') {
  const Rules = loadRules();
  let state = clone(readJson('frontend', 'data', 'territories.json'));
  const logs = [];

  for (let round = 1; round <= rounds; round += 1) {
    const tribute = Rules.resolveTribute(state);
    state = tribute.newState;
    const actions = Object.keys(state).map(key => chooseAction(key, state, round));
    const resolved = Rules.resolveTurn(state, actions, { seed: `${seed}:round:${round}` });
    const cleanup = Rules.resolveCleanup(resolved.newState, { seed: `${seed}:round:${round}:cleanup` });
    state = cleanup.newState;
    logs.push({ round, actions, events: resolved.logs.length + cleanup.logs.length });
  }

  const totals = Object.values(state).reduce((acc, data) => {
    acc.wealth += data.wealth || 0;
    acc.defiance += data.defiance || 0;
    acc.development += data.development || 0;
    return acc;
  }, { wealth: 0, defiance: 0, development: 0 });

  return { rounds, seed, totals, logs };
}

if (require.main === module) {
  const rounds = Number(process.argv[2] || 6);
  const seed = process.argv[3] || 'balance';
  console.log(JSON.stringify(runSimulation(rounds, seed), null, 2));
}

module.exports = { runSimulation };
