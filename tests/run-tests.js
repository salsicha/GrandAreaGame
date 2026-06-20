const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tests = [];
const skips = [];

function fromRoot(...parts) {
  return path.join(repoRoot, ...parts);
}

function readText(...parts) {
  return fs.readFileSync(fromRoot(...parts), 'utf8');
}

function readJson(...parts) {
  return JSON.parse(readText(...parts));
}

function test(name, fn) {
  tests.push({ name, fn });
}

function skip(name, reason) {
  skips.push({ name, reason });
}

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function commandExists(command) {
  const result = runCommand(command, ['--version']);
  return result.status === 0;
}

function loadRules(randomValues = []) {
  const math = Object.create(Math);
  math.random = () => (randomValues.length ? randomValues.shift() : 0.99);
  const context = {
    window: {},
    Math: math
  };
  vm.runInNewContext(readText('frontend', 'rules.js'), context, {
    filename: 'frontend/rules.js'
  });
  return context.window.Rules;
}

function territory(overrides = {}) {
  return {
    family: 'TestFamily',
    type: 'Client',
    clientOf: 'USA',
    resources: 'Grain',
    wealth: 100,
    happiness: 100,
    stash: 20,
    socialCapital: 50,
    politicalCapital: 50,
    development: 50,
    defiance: 0,
    invaded: false,
    ...overrides
  };
}

function unique(values) {
  return Array.from(new Set(values));
}

test('frontend JavaScript parses', () => {
  for (const file of ['frontend/app.js', 'frontend/rules.js']) {
    const result = runCommand('node', ['--check', file]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test('frontend app references defined static DOM ids', () => {
  const app = readText('frontend', 'app.js');
  const html = readText('frontend', 'index.html');
  const referencedIds = unique(
    Array.from(app.matchAll(/q\(['"]([^'"]+)['"]\)/g), match => match[1])
  );
  const definedIds = new Set(
    Array.from(html.matchAll(/id=["']([^"']+)["']/g), match => match[1])
  );
  const dynamicIds = new Set(['briefcase-container']);
  const missing = referencedIds.filter(id => !definedIds.has(id) && !dynamicIds.has(id));
  assert.deepEqual(missing, []);
});

test('map interactions bind only territory elements', () => {
  const app = readText('frontend', 'app.js');
  assert.doesNotMatch(app, /querySelectorAll\(\s*['"`]\[data-country\],\s*\[id\]['"`]\s*\)/);
  assert.match(app, /container\.querySelectorAll\(\s*['"`]\[data-country\]['"`]\s*\)/);
});

test('territory clicks do not bubble to parent SVG groups', () => {
  const app = readText('frontend', 'app.js');
  assert.match(app, /el\.addEventListener\(\s*['"`]click['"`]\s*,\s*\(ev\)\s*=>\s*{/);
  assert.match(app, /ev\.stopPropagation\(\);/);
});

test('frontend territory iteration uses territoryKeys helper', () => {
  const app = readText('frontend', 'app.js');
  assert.match(app, /function territoryKeys\(\)/);
  assert.match(app, /function isTerritoryState\(value\)/);
  assert.doesNotMatch(app, /Object\.keys\(state\)\.forEach\(k=>\{\s*if\(k==='pendingActions'/);
  assert.match(app, /const families = territoryKeys\(\);/);
});

test('existing turn manager controls are wired', () => {
  const app = readText('frontend', 'app.js');
  assert.match(app, /q\(['"]advance-phase['"]\)\.addEventListener\(['"]click['"],\s*advancePhase\)/);
  assert.match(app, /q\(['"]reveal-resolve['"]\)\.addEventListener\(['"]click['"],\s*revealAndResolve\)/);
  assert.match(app, /q\(['"]reset-round['"]\)\.addEventListener\(['"]click['"],\s*resetRound\)/);
  assert.doesNotMatch(app, /Resolve Turn \(Phase 3 & 4\)/);
});

test('rules reference defines playable roles', () => {
  const rules = readText('RULES.md');
  for (const heading of ['Head Family', 'Regional Family', 'Client Family', 'Independent/Defiant State']) {
    assert.match(rules, new RegExp(`## ${heading}`));
  }
  for (const field of ['`family`', '`type`', '`clientOf`', '`defiance`']) {
    assert.ok(rules.includes(field), `missing ${field} in rules reference`);
  }
});

test('actions are consolidated into the turn manager', () => {
  const app = readText('frontend', 'app.js');
  const html = readText('frontend', 'index.html');
  assert.doesNotMatch(app, /function wireButtons\(/);
  assert.doesNotMatch(app, /action-skim|action-prop|action-invade/);
  assert.doesNotMatch(html, /id=["']actions["']|action-skim|action-prop|action-invade/);
  assert.match(app, /const ACTIONS = \['Pass','Skim','Propaganda','Invade','Sanction','Protect','Coup','FalseFlag'\]/);
});

test('JSON data files parse and contain expected shapes', () => {
  const dataDir = fromRoot('frontend', 'data');
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  assert.ok(files.length > 0, 'expected JSON fixtures in frontend/data');

  for (const file of files) {
    assert.doesNotThrow(() => readJson('frontend', 'data', file), file);
  }

  const territories = readJson('frontend', 'data', 'territories.json');
  assert.ok(Object.keys(territories).length > 0, 'expected at least one territory');

  for (const [key, data] of Object.entries(territories)) {
    assert.ok(key.length > 0, 'territory keys must be non-empty');
    assert.equal(typeof data.family, 'string', `${key}.family`);
    assert.ok(!['Head', 'Regional', 'Client'].includes(data.family), `${key}.family must be a family name, not a role`);
    assert.ok(['Head', 'Regional', 'Client'].includes(data.type), `${key}.type`);
    if (data.type === 'Client') {
      assert.equal(typeof data.clientOf, 'string', `${key}.clientOf`);
      assert.ok(data.clientOf.length > 0, `${key}.clientOf`);
    } else {
      assert.ok(data.clientOf == null, `${key}.clientOf should be null or omitted`);
    }
    assert.equal(typeof data.resources, 'string', `${key}.resources`);
    for (const field of ['wealth', 'happiness', 'stash', 'socialCapital', 'politicalCapital', 'development', 'defiance']) {
      assert.equal(typeof data[field], 'number', `${key}.${field}`);
    }
  }

  const crisisCards = readJson('frontend', 'data', 'crisis.json');
  assert.ok(Array.isArray(crisisCards), 'crisis deck must be an array');
  assert.equal(unique(crisisCards.map(card => card.id)).length, crisisCards.length, 'crisis ids must be unique');
  for (const card of crisisCards) {
    assert.equal(typeof card.id, 'string');
    assert.equal(typeof card.title, 'string');
    assert.equal(typeof card.description, 'string');
    assert.equal(typeof card.type, 'string');
  }

  const playerCards = readJson('frontend', 'data', 'playercards.json');
  assert.ok(Array.isArray(playerCards), 'player cards must be an array');
  assert.equal(unique(playerCards.map(card => card.id)).length, playerCards.length, 'player card ids must be unique');
  for (const card of playerCards) {
    assert.equal(typeof card.id, 'string');
    assert.equal(typeof card.title, 'string');
    assert.equal(typeof card.desc, 'string');
    assert.ok(['Self', 'Other'].includes(card.target), `${card.id}.target`);
  }
});

test('SVG territories and mapping fixtures match territory data', () => {
  const territories = readJson('frontend', 'data', 'territories.json');
  const territoryKeys = Object.keys(territories);
  const svg = readText('frontend', 'map.svg');
  const svgCountries = unique(
    Array.from(svg.matchAll(/data-country=["']([^"']+)["']/g), match => match[1])
  );

  assert.deepEqual(svgCountries.filter(key => !territories[key]), []);
  assert.deepEqual(territoryKeys.filter(key => !svgCountries.includes(key)), []);

  const svgIds = new Set(
    Array.from(svg.matchAll(/\sid=["']([^"']+)["']/g), match => match[1])
  );
  const mapping = readJson('frontend', 'data', 'mapping-example.json');
  for (const [svgId, territoryKey] of Object.entries(mapping)) {
    assert.ok(svgIds.has(svgId), `mapping id ${svgId} must exist in map.svg`);
    assert.ok(territories[territoryKey], `mapping target ${territoryKey} must exist in territories.json`);
  }
});

test('all player card data ids have rule handlers', () => {
  const playerCards = readJson('frontend', 'data', 'playercards.json');
  const rulesSource = readText('frontend', 'rules.js');
  for (const card of playerCards) {
    assert.ok(
      rulesSource.includes(`case '${card.id}':`),
      `missing resolveCard handler for ${card.id}`
    );
  }
});

test('tribute transfers wealth from compliant clients to overlord', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', wealth: 100 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', wealth: 50 })
  };

  const result = Rules.resolveTribute(state);
  assert.equal(result.newState.Clientia.wealth, 40);
  assert.equal(result.newState.USA.wealth, 110);
});

test('defiant clients refuse tribute', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', wealth: 100 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', wealth: 50, defiance: 1 })
  };

  const result = Rules.resolveTribute(state);
  assert.equal(result.newState.Clientia.wealth, 50);
  assert.equal(result.newState.USA.wealth, 100);
  assert.ok(result.logs.some(line => line.includes('REFUSES tribute')));
});

test('contagion uses territory type instead of family name', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'Reformer Family', type: 'Client', happiness: 115 }),
    Beta: territory({ family: 'Neighbor Family', type: 'Client', happiness: 80 }),
    Gamma: territory({ family: 'Regional Family', type: 'Regional', happiness: 80 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Propaganda', target: 'Self' }]);
  assert.equal(result.newState.Alpha.happiness, 125);
  assert.equal(result.newState.Beta.defiance, 1);
  assert.equal(result.newState.Gamma.defiance, 0);
});

test('regional families do not pay tribute even when their family name is not hardcoded', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', wealth: 100 }),
    Regionalia: territory({ family: 'Regional Family', type: 'Regional', clientOf: null, wealth: 50 })
  };

  const result = Rules.resolveTribute(state);
  assert.equal(result.newState.Regionalia.wealth, 50);
  assert.equal(result.newState.USA.wealth, 100);
});

test('rules engine excludes runtime metadata from resolved state', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', wealth: 100 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', wealth: 50 }),
    crisisDeck: { drawPile: [], discard: [] },
    cardDefs: [],
    hands: { USA: ['promoting_democracy'] },
    deck: ['offshore_haven'],
    submissions: { USA: { sealed: true } },
    pendingActions: {},
    locks: {}
  };

  const result = Rules.resolveTribute(state);
  assert.deepEqual(Object.keys(result.newState).sort(), ['Clientia', 'USA']);
});

test('global austerity crisis lowers territory happiness', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ happiness: 30 }),
    Beta: territory({ happiness: 5 }),
    crisis: {
      id: 'global_austerity',
      effect: { happiness_delta: -10 }
    }
  };

  const result = Rules.resolveTurn(state, []);
  assert.equal(result.newState.Alpha.happiness, 20);
  assert.equal(result.newState.Beta.happiness, 0);
});

test('skim moves wealth to stash and lowers target happiness', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ wealth: 50, stash: 5, happiness: 50 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Skim', target: 'Self' }]);
  assert.equal(result.newState.Alpha.wealth, 40);
  assert.equal(result.newState.Alpha.stash, 15);
  assert.equal(result.newState.Alpha.happiness, 44);
});

test('invasion with cover marks target invaded and spends social capital', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ socialCapital: 50 }),
    Beta: territory({ happiness: 80 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Invade', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.socialCapital, 40);
  assert.equal(result.newState.Beta.happiness, 65);
  assert.equal(result.newState.Beta.invaded, true);
});

test('coup success and failure are deterministic when random is controlled', () => {
  const successRules = loadRules([0.1]);
  const successState = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 100, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90 })
  };
  const success = successRules.resolveTurn(successState, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(success.newState.Beta.family, 'AlphaFamily');
  assert.equal(success.newState.Beta.happiness, 70);
  assert.equal(success.newState.Alpha.socialCapital, 55);

  const failureRules = loadRules([0.99]);
  const failureState = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 50, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90 })
  };
  const failure = failureRules.resolveTurn(failureState, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(failure.newState.Beta.family, 'BetaFamily');
  assert.equal(failure.newState.Alpha.politicalCapital, 35);
  assert.equal(failure.newState.Alpha.socialCapital, 60);
});

test('cleanup collapses families with exhausted capital', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ stash: 0, wealth: 80, politicalCapital: 50, socialCapital: 50 })
  };

  const result = Rules.resolveCleanup(state);
  assert.equal(result.newState.Alpha.family, 'Collapsed');
  assert.equal(result.newState.Alpha.wealth, 0);
  assert.equal(result.newState.Alpha.stash, 0);
});

test('cleanup uprising can remove a family when happiness is below stash', () => {
  const Rules = loadRules([0.1]);
  const state = {
    Alpha: territory({ family: 'AlphaFamily', happiness: 10, stash: 30 })
  };

  const result = Rules.resolveCleanup(state);
  assert.equal(result.newState.Alpha.family, 'Anarchy');
  assert.equal(result.newState.Alpha.wealth, 0);
  assert.equal(result.newState.Alpha.invaded, false);
});

test('asymmetric objectives award role-specific wins', () => {
  const Rules = loadRules();

  const head = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, wealth: 300 }),
    Clientia: territory({ family: 'Client Family', type: 'Client', clientOf: 'Head Family', defiance: 0 })
  });
  assert.equal(head.newState.Headland.outcome, 'Won');

  const regional = Rules.evaluateObjectives({
    Regionalia: territory({ family: 'Regional Family', type: 'Regional', clientOf: null, wealth: 260, politicalCapital: 120 })
  });
  assert.equal(regional.newState.Regionalia.outcome, 'Won');

  const client = Rules.evaluateObjectives({
    Clientia: territory({ family: 'Client Family', type: 'Client', defiance: 1, happiness: 120, development: 70 })
  });
  assert.equal(client.newState.Clientia.outcome, 'Won');
});

test('asymmetric objectives apply role-specific losses', () => {
  const Rules = loadRules();

  const head = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null }),
    ClientA: territory({ family: 'Client A', type: 'Client', clientOf: 'Head Family', defiance: 1 }),
    ClientB: territory({ family: 'Client B', type: 'Client', clientOf: 'Head Family', defiance: 1 })
  });
  assert.equal(head.newState.Headland.outcome, 'Lost');

  const regional = Rules.evaluateObjectives({
    Regionalia: territory({ family: 'Regional Family', type: 'Regional', clientOf: null, happiness: 20 })
  });
  assert.equal(regional.newState.Regionalia.outcome, 'Lost');

  const client = Rules.evaluateObjectives({
    Clientia: territory({ family: 'Client Family', type: 'Client', wealth: 0, happiness: 80 })
  });
  assert.equal(client.newState.Clientia.outcome, 'Lost');
});

test('player cards apply implemented effects', () => {
  const Rules = loadRules();
  const baseState = {
    Alpha: territory({ wealth: 100, stash: 20, socialCapital: 20 }),
    Beta: territory({ wealth: 80, happiness: 100 })
  };

  assert.equal(Rules.resolveCard(baseState, 'promoting_democracy', 'Alpha', 'Alpha').newState.Alpha.socialCapital, 40);
  assert.equal(Rules.resolveCard(baseState, 'rotten_apple', 'Alpha', 'Beta').newState.Beta.happiness, 50);
  assert.equal(Rules.resolveCard(baseState, 'structural_adjustment', 'Alpha', 'Beta').newState.Alpha.wealth, 110);
  assert.equal(Rules.resolveCard(baseState, 'false_flag', 'Alpha', 'Alpha').newState.Alpha.socialCapital, 70);
  assert.equal(Rules.resolveCard(baseState, 'offshore_haven', 'Alpha', 'Alpha').newState.Alpha.stash, 40);
});

if (commandExists('php')) {
  test('BGA PHP files pass syntax lint', () => {
    const phpFiles = fs.readdirSync(fromRoot('bga')).filter(file => file.endsWith('.php'));
    assert.ok(phpFiles.length > 0, 'expected PHP files in bga/');
    for (const file of phpFiles) {
      const result = runCommand('php', ['-l', path.join('bga', file)]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
  });
} else {
  skip('BGA PHP files pass syntax lint', 'php command is not installed');
}

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

for (const { name, reason } of skips) {
  console.log(`[SKIP] ${name} (${reason})`);
}

console.log(`\n${tests.length - failed}/${tests.length} tests passed, ${skips.length} skipped.`);

if (failed > 0) {
  process.exit(1);
}
