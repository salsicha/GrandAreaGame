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

function listFilesRecursive(dir, predicate = () => true) {
  const root = fromRoot(dir);
  const out = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (predicate(full)) {
        out.push(path.relative(repoRoot, full));
      }
    }
  }
  visit(root);
  return out.sort();
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
    resources: ['Grain'],
    resourceNeeds: [],
    armies: 1,
    wealth: 100,
    happiness: 100,
    stash: 20,
    blackBudget: 20,
    socialCapital: 50,
    politicalCapital: 50,
    education: 50,
    development: 50,
    debt: 0,
    tributeHoliday: 0,
    protectionDeal: 0,
    realignmentPressure: 0,
    rivalryPressure: 0,
    independenceSentiment: 0,
    governanceChangeSentiment: 0,
    factionalDivision: 0,
    fear: 0,
    defiance: 0,
    invaded: false,
    ...overrides
  };
}

function unique(values) {
  return Array.from(new Set(values));
}

test('frontend JavaScript parses', () => {
  const jsFiles = [
    'frontend/app.js',
    'frontend/rules.js',
    'bga/grandareagame.js',
    'tools/simulate-balance.js',
    'tools/generate-bga-material.js',
    'tools/generate-bga-board.js',
    'tests/run-tests.js',
    ...listFilesRecursive('playtest', file => file.endsWith('.js'))
  ];
  for (const file of jsFiles) {
    const result = runCommand('node', ['--check', file]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test('package exposes verification lint and format scripts', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.scripts.test, 'node tests/run-tests.js');
  assert.ok(pkg.scripts.verify, 'missing verify script');
  assert.ok(pkg.scripts.lint, 'missing lint script');
  assert.ok(pkg.scripts['format:check'], 'missing format:check script');
  assert.equal(pkg.scripts.simulate, 'node tools/simulate-balance.js');
  assert.equal(pkg.scripts['playtest:ready'], 'node playtest/src/cli/ready.js');
  assert.match(pkg.scripts['playtest:qwen'], /playtest\/src\/cli\/run-episode\.js/);
  assert.match(pkg.scripts['playtest:qwen'], /qwen3\.6-agents\.json/);
});

test('Qwen Ollama playtest harness is configured without running agents', () => {
  const config = readJson('playtest', 'configs', 'qwen3.6-agents.json');
  const experiments = readJson('playtest', 'configs', 'experiments.json');
  const decisionSchema = readJson('playtest', 'schemas', 'decision.schema.json');
  const territories = readJson('frontend', 'data', 'territories.json');

  assert.equal(config.ollama.model, 'qwen3.6');
  assert.equal(experiments.defaultExperiment.engine, 'javascript');
  assert.equal(typeof experiments.defaultExperiment.maxRounds, 'number');
  assert.ok(experiments.defaultExperiment.maxRounds > 0);
  assert.ok(decisionSchema.required.includes('action_id'));
  assert.ok(decisionSchema.required.includes('confidence'));

  for (const promptPath of Object.values(config.promptFiles)) {
    assert.ok(fs.existsSync(fromRoot(promptPath)), `missing prompt ${promptPath}`);
    const promptText = readText(promptPath);
    assert.ok(promptText.trim().length >= 80, `prompt ${promptPath} is too short to be real guidance`);
    if (promptPath.includes('player-base')) {
      assert.ok(promptText.includes('action_id'), `prompt ${promptPath} must describe the decision contract`);
    }
  }

  const assignedActors = new Set(config.seatAssignments.map(assignment => assignment.actor));
  assert.deepEqual(Array.from(assignedActors).sort(), Object.keys(territories).sort());
  for (const assignment of config.seatAssignments) {
    assert.ok(config.agentProfiles[assignment.agentId], `missing profile ${assignment.agentId}`);
  }
});

test('playtest readiness check validates engine observations and legal actions', () => {
  const result = runCommand('node', ['playtest/src/cli/ready.js']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Ready:/);
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
  const svg = readText('frontend', 'map.svg');
  const css = readText('frontend', 'style.css');
  assert.match(app, /el\.addEventListener\(\s*['"`]click['"`]\s*,\s*\(ev\)\s*=>\s*{/);
  assert.match(app, /ev\.stopPropagation\(\);/);
  assert.match(svg, /\.label\{[^}]*pointer-events:none/);
  assert.match(css, /\.label\{[^}]*pointer-events:none/);
});

test('frontend territory iteration uses territoryKeys helper', () => {
  const app = readText('frontend', 'app.js');
  assert.match(app, /const gameState = \{/);
  assert.match(app, /const state = gameState\.territories;/);
  assert.match(app, /function territoryKeys\(\)/);
  assert.match(app, /function isTerritoryState\(value\)/);
  assert.doesNotMatch(app, /state\.(crisisDeck|cardDefs|hands|deck|submissions|pendingActions|locks)/);
  assert.match(app, /gameState\.runtime\.pendingActions/);
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
  for (const field of ['`family`', '`type`', '`clientOf`', '`resources`', '`resourceNeeds`', '`armies`', '`blackBudget`', '`education`', '`development`', '`debt`', '`tributeHoliday`', '`protectionDeal`', '`realignmentPressure`', '`rivalryPressure`', '`independenceSentiment`', '`governanceChangeSentiment`', '`factionalDivision`', '`fear`', '`defiance`']) {
    assert.ok(rules.includes(field), `missing ${field} in rules reference`);
  }
});

test('actions are consolidated into the turn manager', () => {
  const app = readText('frontend', 'app.js');
  const html = readText('frontend', 'index.html');
  assert.doesNotMatch(app, /function wireButtons\(/);
  assert.doesNotMatch(app, /action-skim|action-prop|action-invade/);
  assert.doesNotMatch(html, /id=["']actions["']|action-skim|action-prop|action-invade/);
  assert.match(app, /const ACTIONS = \['Pass','Skim','Propaganda','Invade','Sanction','Protect','TributeHoliday','ProtectionDeal','ClientRealignment','RegionalRivalry','DebtShakedown','EconomicExploitation','Coup','FalseFlag','CovertInfluence','CounterIntel','Fortify','MakeExample','Concession','Educate','Develop'\]/);
  assert.match(app, /const ROUND_PHASES = \['Crisis','Tribute','Secret Action Submission','Reveal','Narrative Battle','Resolution','Cleanup'\]/);
  assert.match(app, /phases: ROUND_PHASES\.slice\(\)/);
});

test('frontend UX exposes panel overlays action previews and safe notices', () => {
  const app = readText('frontend', 'app.js');
  const html = readText('frontend', 'index.html');
  const css = readText('frontend', 'style.css');

  for (const id of ['role', 'client-of', 'social-capital', 'political-capital', 'education', 'development', 'overlay-mode', 'notice', 'confirm-dialog']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  for (const mode of ['owner', 'role', 'resource', 'happiness', 'defiance', 'invaded', 'sanctioned', 'protected']) {
    assert.match(html, new RegExp(`value=["']${mode}["']`), `missing overlay mode ${mode}`);
  }

  assert.match(app, /function applyOverlay\(\)/);
  assert.match(app, /const ACTION_RULES = \{/);
  assert.match(app, /function legalActionsFor\(family\)/);
  assert.match(app, /function targetKeysForAction\(family, action\)/);
  assert.match(app, /function updateActionPreview\(preview, family, action, target, framing\)/);
  assert.match(app, /function notify\(message, kind='info'\)/);
  assert.match(app, /function confirmAction\(message, onConfirm\)/);
  assert.doesNotMatch(app, /alert\(|confirm\(/);
  assert.doesNotMatch(app, /cardEl\.innerHTML|container\.innerHTML \+=/);
  assert.doesNotMatch(html, /style=["']/);
  assert.doesNotMatch(app, /style\.(margin|fontWeight|opacity|background|border|padding)/);

  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test('JSON data files parse and contain expected shapes', () => {
  const dataDir = fromRoot('frontend', 'data');
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));
  assert.ok(files.length > 0, 'expected JSON fixtures in frontend/data');

  for (const file of files) {
    assert.doesNotThrow(() => readJson('frontend', 'data', file), file);
  }

  const territories = readJson('frontend', 'data', 'territories.json');
  assert.ok(Object.keys(territories).length >= 10, 'expected expanded territory set');
  for (const key of ['NorthAmerica', 'LatinAmerica', 'WesternEurope', 'EasternEurope', 'NorthAfrica', 'SubSaharanAfrica', 'MiddleEast', 'SouthAsia', 'EastAsia', 'Oceania']) {
    assert.ok(territories[key], `missing territory ${key}`);
  }

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
    assert.ok(Array.isArray(data.resources), `${key}.resources`);
    assert.ok(Array.isArray(data.resourceNeeds), `${key}.resourceNeeds`);
    assert.equal(typeof data.armies, 'number', `${key}.armies`);
    for (const field of ['wealth', 'happiness', 'stash', 'blackBudget', 'socialCapital', 'politicalCapital', 'education', 'development', 'debt', 'tributeHoliday', 'protectionDeal', 'realignmentPressure', 'rivalryPressure', 'independenceSentiment', 'governanceChangeSentiment', 'factionalDivision', 'fear', 'defiance']) {
      assert.equal(typeof data[field], 'number', `${key}.${field}`);
    }
    assert.ok(Array.isArray(data.neighbors), `${key}.neighbors`);
    for (const neighbor of data.neighbors) {
      assert.ok(territories[neighbor], `${key}.neighbors references missing territory ${neighbor}`);
    }
  }

  const crisisCards = readJson('frontend', 'data', 'crisis.json');
  assert.ok(Array.isArray(crisisCards), 'crisis deck must be an array');
  assert.ok(crisisCards.length >= 10, 'crisis deck should contain expanded content');
  assert.equal(unique(crisisCards.map(card => card.id)).length, crisisCards.length, 'crisis ids must be unique');
  for (const card of crisisCards) {
    assert.equal(typeof card.id, 'string');
    assert.equal(typeof card.title, 'string');
    assert.equal(typeof card.description, 'string');
    assert.equal(typeof card.type, 'string');
    assert.equal(typeof card.targeting, 'object', `${card.id}.targeting`);
    assert.equal(typeof card.targeting.scope, 'string', `${card.id}.targeting.scope`);
    assert.equal(typeof card.escalation, 'number', `${card.id}.escalation`);
    assert.equal(typeof card.era, 'string', `${card.id}.era`);
    assert.ok(Array.isArray(card.tags), `${card.id}.tags`);
    assert.equal(typeof card.effect, 'object', `${card.id}.effect`);
    if (card.target) assert.ok(territories[card.target], `${card.id}.target references missing territory`);
    if (card.targeting.territory) assert.ok(territories[card.targeting.territory], `${card.id}.targeting.territory references missing territory`);
  }

  const playerCards = readJson('frontend', 'data', 'playercards.json');
  assert.ok(Array.isArray(playerCards), 'player cards must be an array');
  assert.ok(playerCards.length >= 16, 'player deck should contain expanded content');
  assert.equal(unique(playerCards.map(card => card.id)).length, playerCards.length, 'player card ids must be unique');
  const categories = new Set(playerCards.map(card => card.category));
  for (const category of ['spin', 'leverage', 'intelligence', 'retaliation']) {
    assert.ok(categories.has(category), `missing player card category ${category}`);
  }
  for (const card of playerCards) {
    assert.equal(typeof card.id, 'string');
    assert.equal(typeof card.title, 'string');
    assert.equal(typeof card.category, 'string');
    assert.equal(typeof card.desc, 'string');
    assert.ok(['Self', 'Other'].includes(card.target), `${card.id}.target`);
  }

  const setups = readJson('frontend', 'data', 'setups.json');
  for (const count of ['2', '3', '4', '5']) {
    assert.equal(setups[count].players, Number(count), `setup ${count}.players`);
    assert.ok(Array.isArray(setups[count].families), `setup ${count}.families`);
    for (const assigned of Object.values(setups[count].territories).flat()) {
      assert.ok(assigned === 'Neutral' || territories[assigned], `setup ${count} references missing territory ${assigned}`);
    }
  }

  const balance = readJson('frontend', 'data', 'balance.json');
  for (const field of ['wealth', 'happiness', 'stash', 'socialCapital', 'politicalCapital', 'education', 'development', 'resources', 'armies']) {
    if (field === 'resources') continue;
    assert.equal(typeof balance.numericRanges[field].min, 'number', `range ${field}.min`);
    assert.equal(typeof balance.numericRanges[field].max, 'number', `range ${field}.max`);
  }
  assert.equal(balance.actionEconomy.actionsPerPlayerPerRound, 1);
  assert.equal(balance.clientVictoryPath.minimumIndependenceSentiment, 60);
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

test('contagion only pressures nearby or related clients', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'Alpha Client', type: 'Client', clientOf: 'USA', happiness: 115, neighbors: ['Beta'] }),
    Beta: territory({ family: 'Nearby Client', type: 'Client', clientOf: 'EU', happiness: 80, neighbors: ['Alpha'] }),
    Gamma: territory({ family: 'Related Client', type: 'Client', clientOf: 'USA', happiness: 80, neighbors: [] }),
    Delta: territory({ family: 'Unrelated Client', type: 'Client', clientOf: 'China', happiness: 80, neighbors: [] })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Propaganda', target: 'Self' }]);
  assert.equal(result.newState.Beta.defiance, 1);
  assert.equal(result.newState.Gamma.defiance, 1);
  assert.equal(result.newState.Delta.defiance, 0);
});

test('successful client breakaway emits contagion', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'Alpha Client', type: 'Client', clientOf: 'USA', defiance: 1, happiness: 125, development: 75, independenceSentiment: 65 }),
    Beta: territory({ family: 'Related Client', type: 'Client', clientOf: 'USA', defiance: 0, happiness: 80 })
  };

  const result = Rules.resolveTurn(state, []);
  assert.equal(result.newState.Alpha.outcome, 'Won');
  assert.equal(result.newState.Beta.defiance, 1);
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

test('global austerity is harsher when critical resources are missing', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ happiness: 100, resources: [], resourceNeeds: ['Grain'] }),
    crisis: {
      id: 'global_austerity',
      effect: { happiness_delta: -10 }
    }
  };

  const result = Rules.resolveTurn(state, []);
  assert.equal(result.newState.Alpha.happiness, 85);
});

test('crisis targeting can select resource needs and highest debt', () => {
  const Rules = loadRules();
  const resourceShock = Rules.applyCrisis({
    Alpha: territory({ wealth: 100, resources: [], resourceNeeds: ['Oil'] }),
    Beta: territory({ wealth: 100, resources: [], resourceNeeds: [] })
  }, {
    id: 'oil_test',
    targeting: { scope: 'resourceNeed', resource: 'Oil' },
    effect: { wealth_delta: -12 },
    escalation: 1
  });
  assert.equal(resourceShock.newState.Alpha.wealth, 88);
  assert.equal(resourceShock.newState.Beta.wealth, 100);

  const debtShock = Rules.applyCrisis({
    Alpha: territory({ debt: 5, happiness: 100 }),
    Beta: territory({ debt: 25, happiness: 100 })
  }, {
    id: 'debt_test',
    targeting: { scope: 'highestDebt' },
    effect: { happiness_delta: -10 },
    escalation: 1
  });
  assert.equal(debtShock.newState.Alpha.happiness, 100);
  assert.equal(debtShock.newState.Beta.happiness, 90);
});

test('resource pressure reduces wealth development and happiness', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ wealth: 100, development: 50, happiness: 50, resources: [], resourceNeeds: ['Industry'] })
  };

  const result = Rules.resolveResourcePressure(state);
  assert.equal(result.newState.Alpha.wealth, 95);
  assert.equal(result.newState.Alpha.development, 49);
  assert.equal(result.newState.Alpha.happiness, 48);
});

test('missing oil adds army upkeep pressure', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ wealth: 100, development: 50, happiness: 50, armies: 3, resources: [], resourceNeeds: ['Oil'] })
  };

  const result = Rules.resolveResourcePressure(state);
  assert.equal(result.newState.Alpha.wealth, 92);
  assert.equal(result.newState.Alpha.development, 49);
  assert.equal(result.newState.Alpha.happiness, 48);
});

test('compliant clients provide resources and defiant clients do not', () => {
  const Rules = loadRules();
  const compliant = Rules.resolveResourcePressure({
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, resources: [], resourceNeeds: ['Minerals'], wealth: 100 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', resources: ['Minerals'], resourceNeeds: [], defiance: 0 })
  });
  assert.equal(compliant.newState.USA.wealth, 100);

  const defiant = Rules.resolveResourcePressure({
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, resources: [], resourceNeeds: ['Minerals'], wealth: 100 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', resources: ['Minerals'], resourceNeeds: [], defiance: 1 })
  });
  assert.equal(defiant.newState.USA.wealth, 95);
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

test('invasion without framing marks target invaded and takes full backlash', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ socialCapital: 50 }),
    Beta: territory({ happiness: 80 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Invade', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.socialCapital, 35);
  assert.equal(result.newState.Beta.happiness, 55);
  assert.equal(result.newState.Beta.invaded, true);
});

test('framing spend mitigates invasion target backlash', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ socialCapital: 50 }),
    Beta: territory({ happiness: 80 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Invade', target: 'Beta', framing: 10 }]);
  assert.equal(result.newState.Alpha.socialCapital, 30);
  assert.equal(result.newState.Beta.happiness, 65);
  assert.equal(result.newState.Beta.invaded, true);
  assert.ok(result.logs.some(line => line.includes('spent 10 Social Capital on framing')));
});

test('sanctions spend political capital and damage target economy', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ politicalCapital: 50, wealth: 100 }),
    Beta: territory({ wealth: 80, happiness: 100, development: 50, governanceChangeSentiment: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Sanction', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.politicalCapital, 45);
  assert.equal(result.newState.Alpha.wealth, 104);
  assert.equal(result.newState.Beta.wealth, 62);
  assert.equal(result.newState.Beta.happiness, 88);
  assert.equal(result.newState.Beta.development, 45);
  assert.equal(result.newState.Beta.governanceChangeSentiment, 5);
  assert.equal(result.newState.Beta.sanctioned, true);
});

test('protection offers cost resources and can encourage client defiance', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'AlphaFamily', wealth: 100, stash: 20, politicalCapital: 50 }),
    Beta: territory({ type: 'Client', clientOf: 'OtherFamily', happiness: 80, fear: 10, defiance: 0, independenceSentiment: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Protect', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.wealth, 92);
  assert.equal(result.newState.Alpha.stash, 14);
  assert.equal(result.newState.Alpha.politicalCapital, 55);
  assert.equal(result.newState.Beta.protected, true);
  assert.equal(result.newState.Beta.protectedBy, 'AlphaFamily');
  assert.equal(result.newState.Beta.happiness, 88);
  assert.equal(result.newState.Beta.fear, 5);
  assert.equal(result.newState.Beta.defiance, 1);
  assert.equal(result.newState.Beta.independenceSentiment, 5);
});

test('debt shakedown creates debt and backlash', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ wealth: 100, politicalCapital: 50 }),
    Beta: territory({ type: 'Client', wealth: 80, happiness: 100, debt: 5, governanceChangeSentiment: 0, defiance: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'DebtShakedown', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.wealth, 120);
  assert.equal(result.newState.Alpha.politicalCapital, 42);
  assert.equal(result.newState.Beta.wealth, 60);
  assert.equal(result.newState.Beta.debt, 25);
  assert.equal(result.newState.Beta.happiness, 92);
  assert.equal(result.newState.Beta.governanceChangeSentiment, 7);
  assert.equal(result.newState.Beta.defiance, 1);
});

test('economic exploitation extracts wealth and damages development', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ wealth: 100, stash: 10, socialCapital: 50 }),
    Beta: territory({ type: 'Client', wealth: 80, happiness: 100, development: 50, governanceChangeSentiment: 0, defiance: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'EconomicExploitation', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.wealth, 112);
  assert.equal(result.newState.Alpha.stash, 16);
  assert.equal(result.newState.Alpha.socialCapital, 46);
  assert.equal(result.newState.Beta.wealth, 68);
  assert.equal(result.newState.Beta.happiness, 92);
  assert.equal(result.newState.Beta.development, 42);
  assert.equal(result.newState.Beta.governanceChangeSentiment, 6);
  assert.equal(result.newState.Beta.defiance, 1);
});

test('tribute holidays skip one tribute payment', () => {
  const Rules = loadRules();
  const actionResult = Rules.resolveTurn({
    Europe: territory({ family: 'EU', type: 'Regional', clientOf: null, wealth: 100, socialCapital: 20 }),
    Africa: territory({ family: 'African Client Bloc', type: 'Client', clientOf: 'EU', wealth: 80, happiness: 70, defiance: 1 })
  }, [{ family: 'Europe', action: 'TributeHoliday', target: 'Africa' }]);
  assert.equal(actionResult.newState.Europe.wealth, 92);
  assert.equal(actionResult.newState.Europe.socialCapital, 24);
  assert.equal(actionResult.newState.Africa.tributeHoliday, 1);
  assert.equal(actionResult.newState.Africa.defiance, 0);

  const tributeResult = Rules.resolveTribute(actionResult.newState);
  assert.equal(tributeResult.newState.Europe.wealth, 92);
  assert.equal(tributeResult.newState.Africa.wealth, 80);
  assert.equal(tributeResult.newState.Africa.tributeHoliday, 0);
});

test('protection deals and client realignment change client relationships', () => {
  const Rules = loadRules();
  const protectedState = Rules.resolveTurn({
    Asia: territory({ family: 'China', type: 'Regional', clientOf: null, wealth: 100, stash: 20, politicalCapital: 60 }),
    Africa: territory({ family: 'African Client Bloc', type: 'Client', clientOf: 'EU', wealth: 80, realignmentPressure: 0, defiance: 0 })
  }, [{ family: 'Asia', action: 'ProtectionDeal', target: 'Africa' }]);
  assert.equal(protectedState.newState.Asia.wealth, 94);
  assert.equal(protectedState.newState.Asia.stash, 16);
  assert.equal(protectedState.newState.Africa.protectionDeal, 2);
  assert.equal(protectedState.newState.Africa.realignmentPressure, 8);
  assert.equal(protectedState.newState.Africa.defiance, 1);

  const realigned = Rules.resolveTurn(protectedState.newState, [{ family: 'Asia', action: 'ClientRealignment', target: 'Africa' }]);
  assert.equal(realigned.newState.Africa.clientOf, 'China');
  assert.equal(realigned.newState.Africa.protectedBy, 'China');
  assert.equal(realigned.newState.Asia.politicalCapital, 52);
});

test('regional rivalry damages rival political position', () => {
  const Rules = loadRules();
  const state = {
    Europe: territory({ family: 'EU', type: 'Regional', clientOf: null, politicalCapital: 70 }),
    Asia: territory({ family: 'China', type: 'Regional', clientOf: null, politicalCapital: 80, factionalDivision: 20 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Europe', action: 'RegionalRivalry', target: 'Asia' }]);
  assert.equal(result.newState.Europe.politicalCapital, 64);
  assert.equal(result.newState.Europe.rivalryPressure, 4);
  assert.equal(result.newState.Asia.politicalCapital, 70);
  assert.equal(result.newState.Asia.rivalryPressure, 10);
  assert.equal(result.newState.Asia.factionalDivision, 28);
});

test('action resolution uses deterministic tie breakers', () => {
  const Rules = loadRules();
  const state = {
    Beta: territory({ wealth: 100 }),
    Alpha: territory({ wealth: 100 })
  };

  const result = Rules.resolveTurn(state, [
    { family: 'Beta', action: 'Pass', target: 'Self' },
    { family: 'Alpha', action: 'Pass', target: 'Self' }
  ]);
  assert.ok(result.logs.indexOf('Alpha => Pass -> Alpha') < result.logs.indexOf('Beta => Pass -> Beta'));
});

test('seeded random makes rule resolution replayable', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 50, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90 })
  };
  const actions = [{ family: 'Alpha', action: 'Coup', target: 'Beta' }];

  const first = Rules.resolveTurn(state, actions, { seed: 'round-1' });
  const second = Rules.resolveTurn(state, actions, { seed: 'round-1' });
  assert.deepEqual(first.newState, second.newState);
  assert.deepEqual(first.logs, second.logs);

  const rng = Rules.createSeededRandom('round-1');
  assert.equal(rng(), Rules.createSeededRandom('round-1')());
});

test('balance simulation harness runs deterministic sample games', () => {
  const first = runCommand('node', ['tools/simulate-balance.js', '2', 'test-seed']);
  const second = runCommand('node', ['tools/simulate-balance.js', '2', 'test-seed']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  const result = JSON.parse(first.stdout);
  assert.equal(result.rounds, 2);
  assert.equal(result.seed, 'test-seed');
  assert.equal(typeof result.totals.wealth, 'number');
  assert.equal(typeof result.roundsPlayed, 'number');
  assert.ok(result.roundsPlayed >= 1);
  assert.ok(Array.isArray(result.winners));
  assert.ok(Array.isArray(result.deaths));
  for (const death of result.deaths) {
    assert.equal(typeof death.seat, 'string');
    assert.equal(typeof death.round, 'number');
    assert.equal(typeof death.cause, 'string');
  }
  assert.ok(Array.isArray(result.crisesDrawn));
  assert.ok(result.crisesDrawn.length >= 1, 'expected at least one crisis draw');
  for (const role of ['Head', 'Regional', 'Client']) {
    for (const outcome of ['won', 'lost', 'collapsed', 'active']) {
      assert.equal(typeof result.outcomesByRole[role][outcome], 'number', `outcomesByRole.${role}.${outcome}`);
    }
  }
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
  assert.equal(success.newState.Alpha.blackBudget, 10);

  const failureRules = loadRules([0.99]);
  const failureState = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 50, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90 })
  };
  const failure = failureRules.resolveTurn(failureState, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(failure.newState.Beta.family, 'BetaFamily');
  assert.equal(failure.newState.Alpha.politicalCapital, 35);
  assert.equal(failure.newState.Alpha.socialCapital, 60);
  assert.equal(failure.newState.Alpha.blackBudget, 10);
});

test('coup odds use governance change factional division and fear', () => {
  const Rules = loadRules([0.7]);
  const state = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 50, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90, governanceChangeSentiment: 80, factionalDivision: 70, fear: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(result.newState.Beta.family, 'AlphaFamily');
});

test('coup requires Black Budget', () => {
  const Rules = loadRules([0.1]);
  const state = {
    Alpha: territory({ family: 'AlphaFamily', blackBudget: 0, politicalCapital: 100, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(result.newState.Beta.family, 'BetaFamily');
  assert.ok(result.logs.some(line => line.includes('insufficient Black Budget')));
});

test('covert influence spends Black Budget and raises target defiance', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'AlphaFamily', blackBudget: 20, politicalCapital: 50 }),
    Beta: territory({ family: 'BetaFamily', defiance: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'CovertInfluence', target: 'Beta' }]);
  assert.equal(result.newState.Alpha.blackBudget, 14);
  assert.equal(result.newState.Alpha.politicalCapital, 55);
  assert.equal(result.newState.Beta.defiance, 1);
});

test('make example suppresses a defiant client at social cost', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, socialCapital: 50, politicalCapital: 50 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', defiance: 2, happiness: 100 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'USA', action: 'MakeExample', target: 'Clientia' }]);
  assert.equal(result.newState.Clientia.defiance, 0);
  assert.equal(result.newState.Clientia.happiness, 80);
  assert.equal(result.newState.USA.socialCapital, 40);
  assert.equal(result.newState.USA.politicalCapital, 55);
});

test('concession suppresses a defiant client at wealth and political cost', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, wealth: 100, socialCapital: 50, politicalCapital: 50 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', defiance: 2, happiness: 100 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'USA', action: 'Concession', target: 'Clientia' }]);
  assert.equal(result.newState.Clientia.defiance, 0);
  assert.equal(result.newState.Clientia.happiness, 110);
  assert.equal(result.newState.USA.wealth, 90);
  assert.equal(result.newState.USA.socialCapital, 55);
  assert.equal(result.newState.USA.politicalCapital, 45);
});

test('education investment raises education and political side pressure', () => {
  const Rules = loadRules();
  const state = {
    Clientia: territory({ type: 'Client', wealth: 100, education: 60, development: 40, independenceSentiment: 0, governanceChangeSentiment: 0 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Clientia', action: 'Educate', target: 'Self' }]);
  assert.equal(result.newState.Clientia.wealth, 92);
  assert.equal(result.newState.Clientia.education, 70);
  assert.equal(result.newState.Clientia.development, 43);
  assert.equal(result.newState.Clientia.independenceSentiment, 2);
  assert.equal(result.newState.Clientia.governanceChangeSentiment, 2);
});

test('development investment requires industry or technology access', () => {
  const Rules = loadRules();

  const blocked = Rules.resolveTurn({
    Alpha: territory({ wealth: 100, resources: [], resourceNeeds: [] })
  }, [{ family: 'Alpha', action: 'Develop', target: 'Self' }]);
  assert.equal(blocked.newState.Alpha.development, 50);
  assert.ok(blocked.logs.some(line => line.includes('requires Industry or Technology access')));

  const allowed = Rules.resolveTurn({
    Alpha: territory({ wealth: 100, resources: ['Technology'], resourceNeeds: [] })
  }, [{ family: 'Alpha', action: 'Develop', target: 'Self' }]);
  assert.equal(allowed.newState.Alpha.wealth, 95);
  assert.equal(allowed.newState.Alpha.development, 60);
  assert.equal(allowed.newState.Alpha.happiness, 103);
});

test('unanswered defiance penalizes the overlord', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, socialCapital: 50, politicalCapital: 50 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', defiance: 1 })
  };

  const result = Rules.resolveTurn(state, []);
  assert.equal(result.newState.USA.socialCapital, 47);
  assert.equal(result.newState.USA.politicalCapital, 47);
});

test('unanswered defiance pressure is capped per overlord', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, socialCapital: 50, politicalCapital: 50 }),
    C1: territory({ family: 'C1 Family', type: 'Client', clientOf: 'USA', defiance: 1 }),
    C2: territory({ family: 'C2 Family', type: 'Client', clientOf: 'USA', defiance: 2 }),
    C3: territory({ family: 'C3 Family', type: 'Client', clientOf: 'USA', defiance: 1 }),
    C4: territory({ family: 'C4 Family', type: 'Client', clientOf: 'USA', defiance: 3 })
  };

  const result = Rules.applyUnansweredDefiancePressure(state);
  assert.equal(result.newState.USA.socialCapital, 41);
  assert.equal(result.newState.USA.politicalCapital, 41);
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

test('uprisings are only risked below the happiness safe floor', () => {
  const Rules = loadRules([0.1, 0.1]);
  const state = {
    Risky: territory({ family: 'Risky Family', happiness: 45, stash: 60 }),
    Safe: territory({ family: 'Safe Family', happiness: 55, stash: 60 })
  };

  const result = Rules.resolveCleanup(state);
  assert.equal(result.newState.Risky.family, 'Anarchy');
  assert.equal(result.newState.Safe.family, 'Safe Family');
});

test('cleanup recovery regenerates wealth stash capitals and happiness', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ wealth: 40, stash: 10, development: 45, happiness: 80, socialCapital: 50, politicalCapital: 149 }),
    Beta: territory({ wealth: 5, stash: 30, development: 0, happiness: 40, socialCapital: 150, politicalCapital: 160 })
  };

  const result = Rules.applyCleanupRecovery(state);
  // Production 3 + floor(45 / 20) = 5, then 2 wealth trickles into stash.
  assert.equal(result.newState.Alpha.wealth, 43);
  assert.equal(result.newState.Alpha.stash, 12);
  // Civic regeneration: +2 each while below the 150 cap.
  assert.equal(result.newState.Alpha.socialCapital, 52);
  assert.equal(result.newState.Alpha.politicalCapital, 150);
  assert.equal(result.newState.Alpha.happiness, 80);
  // Beta: base production only, no trickle at stash 30, capitals at/over cap
  // untouched, unrest recovery below the 70 happiness ceiling.
  assert.equal(result.newState.Beta.wealth, 8);
  assert.equal(result.newState.Beta.stash, 30);
  assert.equal(result.newState.Beta.socialCapital, 150);
  assert.equal(result.newState.Beta.politicalCapital, 160);
  assert.equal(result.newState.Beta.happiness, 44);
});

test('cleanup recovery cannot rescue a capital already at zero', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ socialCapital: 0, happiness: 100, stash: 20 })
  };

  const result = Rules.resolveCleanup(state);
  assert.equal(result.newState.Alpha.family, 'Collapsed');
});

test('a family that already won cannot collapse in the same cleanup', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'AlphaFamily', outcome: 'Won', stash: 0, socialCapital: 0 })
  };

  const result = Rules.resolveCleanup(state);
  assert.equal(result.newState.Alpha.family, 'AlphaFamily');
  assert.equal(result.newState.Alpha.outcome, 'Won');
});

test('sentiment tracks update from defiance happiness stash and fear', () => {
  const Rules = loadRules();
  const state = {
    Clientia: territory({
      type: 'Client',
      defiance: 2,
      happiness: 50,
      stash: 80,
      fear: 25,
      independenceSentiment: 10,
      governanceChangeSentiment: 20
    })
  };

  const result = Rules.resolveSentiment(state);
  assert.equal(result.newState.Clientia.independenceSentiment, 20);
  assert.equal(result.newState.Clientia.governanceChangeSentiment, 29);
});

test('education changes sentiment based on happiness and client status', () => {
  const Rules = loadRules();
  const state = {
    Clientia: territory({ type: 'Client', education: 75, happiness: 100, independenceSentiment: 0, governanceChangeSentiment: 0 }),
    Unsettled: territory({ type: 'Regional', education: 75, happiness: 80, independenceSentiment: 0, governanceChangeSentiment: 0 })
  };

  const result = Rules.resolveSentiment(state);
  assert.equal(result.newState.Clientia.independenceSentiment, 3);
  assert.equal(result.newState.Clientia.governanceChangeSentiment, 0);
  assert.equal(result.newState.Unsettled.independenceSentiment, 0);
  assert.equal(result.newState.Unsettled.governanceChangeSentiment, 3);
});

test('head runaway wealth creates comeback pressure', () => {
  const Rules = loadRules();
  const state = {
    NorthAmerica: territory({ family: 'USA', type: 'Head', clientOf: null, wealth: 310, socialCapital: 80 }),
    LatinAmerica: territory({ family: 'Latin Client Coalition', type: 'Client', clientOf: 'USA', happiness: 70, defiance: 0, independenceSentiment: 40 }),
    Oceania: territory({ family: 'Pacific Client Bloc', type: 'Client', clientOf: 'USA', happiness: 95, defiance: 0, independenceSentiment: 40 }),
    EastAsia: territory({ family: 'China', type: 'Regional', clientOf: null, politicalCapital: 90, rivalryPressure: 0 })
  };

  const result = Rules.applyComebackPressure(state);
  assert.equal(result.newState.NorthAmerica.socialCapital, 74);
  // Only the unhappiest client of the runaway head is emboldened.
  assert.equal(result.newState.LatinAmerica.defiance, 1);
  assert.equal(result.newState.LatinAmerica.independenceSentiment, 45);
  assert.equal(result.newState.Oceania.defiance, 0);
  assert.equal(result.newState.Oceania.independenceSentiment, 40);
  assert.equal(result.newState.EastAsia.politicalCapital, 94);
  assert.equal(result.newState.EastAsia.rivalryPressure, 2);
});

test('asymmetric objectives award role-specific wins', () => {
  const Rules = loadRules();

  const head = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, wealth: 400 }),
    Clientia: territory({ family: 'Client Family', type: 'Client', clientOf: 'Head Family', defiance: 0 })
  });
  assert.equal(head.newState.Headland.outcome, 'Won');

  const headWithDefiantRival = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, wealth: 400 }),
    Clientia: territory({ family: 'Client Family', type: 'Client', clientOf: 'Head Family', defiance: 0 }),
    Rivalia: territory({ family: 'Rival Client', type: 'Client', clientOf: 'Other Family', defiance: 2 })
  });
  assert.equal(headWithDefiantRival.newState.Headland.outcome, 'Won');

  const headWithOwnDefiance = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, wealth: 400 }),
    Clientia: territory({ family: 'Client Family', type: 'Client', clientOf: 'Head Family', defiance: 1 })
  });
  assert.notEqual(headWithOwnDefiance.newState.Headland.outcome, 'Won');

  const regional = Rules.evaluateObjectives({
    Regionalia: territory({ family: 'Regional Family', type: 'Regional', clientOf: null, wealth: 320, politicalCapital: 130 })
  });
  assert.equal(regional.newState.Regionalia.outcome, 'Won');

  const client = Rules.evaluateObjectives({
    Clientia: territory({ family: 'Client Family', type: 'Client', defiance: 1, happiness: 120, development: 70, independenceSentiment: 60 })
  });
  assert.equal(client.newState.Clientia.outcome, 'Won');

  const cosmeticClient = Rules.evaluateObjectives({
    Clientia: territory({ family: 'Client Family', type: 'Client', defiance: 1, happiness: 130, development: 80, independenceSentiment: 20 })
  });
  assert.notEqual(cosmeticClient.newState.Clientia.outcome, 'Won');
});

test('asymmetric objectives apply role-specific losses', () => {
  const Rules = loadRules();

  const head = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, defianceMajorityRounds: 2 }),
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
  assert.equal(Rules.resolveCard(baseState, 'structural_adjustment', 'Alpha', 'Beta').newState.Beta.education, 40);
  assert.equal(Rules.resolveCard(baseState, 'false_flag', 'Alpha', 'Alpha').newState.Alpha.socialCapital, 70);
  assert.equal(Rules.resolveCard(baseState, 'false_flag', 'Alpha', 'Alpha').newState.Alpha.blackBudget, 12);
  assert.equal(Rules.resolveCard(baseState, 'media_blitz', 'Alpha', 'Alpha').newState.Alpha.politicalCapital, 55);
  assert.equal(Rules.resolveCard(baseState, 'debt_trap', 'Alpha', 'Beta').newState.Beta.debt, 15);
  assert.equal(Rules.resolveCard(baseState, 'covert_files', 'Alpha', 'Beta').newState.Beta.governanceChangeSentiment, 10);
  assert.equal(Rules.resolveCard(baseState, 'sanctions_package', 'Alpha', 'Beta').newState.Beta.wealth, 68);
  assert.equal(Rules.resolveCard(baseState, 'offshore_haven', 'Alpha', 'Alpha').newState.Alpha.stash, 40);
});

test('eliminated actors cannot act', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'AlphaFamily', type: 'Head', clientOf: null, outcome: 'Lost', politicalCapital: 50, wealth: 100 }),
    Beta: territory({ family: 'BetaFamily', wealth: 50 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Sanction', target: 'Beta' }]);
  assert.equal(result.newState.Beta.wealth, 50);
  assert.ok(result.logs.some(line => line.includes('eliminated and cannot act')));
});

test('head loses only to a strict majority of its own defiant clients', () => {
  const Rules = loadRules();
  const base = {
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, defianceMajorityRounds: 2 }),
    C1: territory({ family: 'C1 Family', type: 'Client', clientOf: 'Head Family', defiance: 1 }),
    C2: territory({ family: 'C2 Family', type: 'Client', clientOf: 'Head Family', defiance: 1 }),
    C3: territory({ family: 'C3 Family', type: 'Client', clientOf: 'Head Family', defiance: 0 }),
    C4: territory({ family: 'C4 Family', type: 'Client', clientOf: 'Head Family', defiance: 0 })
  };

  const half = Rules.evaluateObjectives(base);
  assert.notEqual(half.newState.Headland.outcome, 'Lost');

  const majority = Rules.evaluateObjectives({
    ...base,
    C3: territory({ family: 'C3 Family', type: 'Client', clientOf: 'Head Family', defiance: 1 })
  });
  assert.equal(majority.newState.Headland.outcome, 'Lost');

  // Rival hierarchies' defiant clients no longer count against the head.
  const rivalDefiance = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, defianceMajorityRounds: 2 }),
    C1: territory({ family: 'C1 Family', type: 'Client', clientOf: 'Head Family', defiance: 0 }),
    R1: territory({ family: 'R1 Family', type: 'Client', clientOf: 'Other Family', defiance: 3 }),
    R2: territory({ family: 'R2 Family', type: 'Client', clientOf: 'Other Family', defiance: 3 })
  });
  assert.notEqual(rivalDefiance.newState.Headland.outcome, 'Lost');

  // A single defiant client can never topple the head on its own.
  const lonely = Rules.evaluateObjectives({
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, defianceMajorityRounds: 2 }),
    C1: territory({ family: 'C1 Family', type: 'Client', clientOf: 'Head Family', defiance: 5 })
  });
  assert.notEqual(lonely.newState.Headland.outcome, 'Lost');
});

test('defiant-client majority must persist through two cleanups to topple the head', () => {
  const Rules = loadRules();
  const state = {
    Headland: territory({ family: 'Head Family', type: 'Head', clientOf: null, wealth: 100, happiness: 100, stash: 20 }),
    C1: territory({ family: 'C1 Family', type: 'Client', clientOf: 'Head Family', defiance: 1 }),
    C2: territory({ family: 'C2 Family', type: 'Client', clientOf: 'Head Family', defiance: 1 })
  };

  const first = Rules.resolveCleanup(state);
  assert.equal(first.newState.Headland.defianceMajorityRounds, 1);
  assert.notEqual(first.newState.Headland.outcome, 'Lost');

  const second = Rules.resolveCleanup(first.newState);
  assert.equal(second.newState.Headland.defianceMajorityRounds, 2);
  assert.equal(second.newState.Headland.outcome, 'Lost');

  // Breaking the majority in time resets the counter and spares the head.
  const answered = Rules.resolveCleanup({
    ...first.newState,
    C1: { ...first.newState.C1, defiance: 0 }
  });
  assert.equal(answered.newState.Headland.defianceMajorityRounds, 0);
  assert.notEqual(answered.newState.Headland.outcome, 'Lost');
});

test('an eliminated defiant client stops bleeding its overlord', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, socialCapital: 40, politicalCapital: 40 }),
    Ruins: territory({ family: 'Anarchy', type: 'Client', clientOf: 'USA', defiance: 2 })
  };

  const result = Rules.applyUnansweredDefiancePressure(state);
  assert.equal(result.newState.USA.socialCapital, 40);
  assert.equal(result.newState.USA.politicalCapital, 40);
});

test('offensive actions cannot target self', () => {
  const Rules = loadRules();
  const state = {
    Alpha: territory({ family: 'AlphaFamily', wealth: 100, armies: 2, blackBudget: 20, politicalCapital: 50 })
  };

  const invade = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Invade', target: 'Alpha' }]);
  assert.equal(invade.newState.Alpha.invaded, false);
  assert.ok(invade.logs.some(line => line.includes('failed Invade (cannot target self)')));

  const coup = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Coup', target: 'Self' }]);
  assert.equal(coup.newState.Alpha.blackBudget, 20);
  assert.ok(coup.logs.some(line => line.includes('failed Coup (cannot target self)')));
});

test('defiance responses are restricted to the overlord', () => {
  const Rules = loadRules();
  const state = {
    Meddler: territory({ family: 'Meddler Family', type: 'Regional', clientOf: null, socialCapital: 50, politicalCapital: 50 }),
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, socialCapital: 50, politicalCapital: 50 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', defiance: 1, happiness: 100 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'Meddler', action: 'MakeExample', target: 'Clientia' }]);
  assert.equal(result.newState.Clientia.defiance, 1);
  assert.equal(result.newState.Clientia.happiness, 100);
  assert.equal(result.newState.Meddler.politicalCapital, 50);
  assert.ok(result.logs.some(line => line.includes('failed MakeExample (Clientia is not their client)')));
});

test('an overlord cannot realign its own client to launder defiance', () => {
  const Rules = loadRules();
  const state = {
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, politicalCapital: 50, socialCapital: 50 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', defiance: 2 })
  };

  const result = Rules.resolveTurn(state, [{ family: 'USA', action: 'ClientRealignment', target: 'Clientia' }]);
  assert.equal(result.newState.Clientia.defiance, 2);
  assert.equal(result.newState.Clientia.clientOf, 'USA');
  assert.ok(result.logs.some(line => line.includes('failed ClientRealignment (Clientia is already their client)')));
});

test('happiness is capped at 200', () => {
  const Rules = loadRules();
  const propaganda = Rules.resolveTurn({
    Alpha: territory({ stash: 20, happiness: 195, defiance: 0 })
  }, [{ family: 'Alpha', action: 'Propaganda', target: 'Self' }]);
  assert.equal(propaganda.newState.Alpha.happiness, 200);

  const concession = Rules.resolveTurn({
    USA: territory({ family: 'USA', type: 'Head', clientOf: null, wealth: 100, politicalCapital: 50, socialCapital: 50 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', defiance: 1, happiness: 198 })
  }, [{ family: 'USA', action: 'Concession', target: 'Clientia' }]);
  assert.equal(concession.newState.Clientia.happiness, 200);
});

test('defiance contagion is independent of territory key order', () => {
  const Rules = loadRules();
  const build = order => {
    const src = {
      Spark: territory({ family: 'Spark Family', type: 'Client', clientOf: 'USA', defiance: 3, neighbors: ['Mid'] }),
      Mid: territory({ family: 'Mid Family', type: 'Client', clientOf: 'EU', defiance: 2, neighbors: ['Spark', 'Far'] }),
      Far: territory({ family: 'Far Family', type: 'Client', clientOf: 'China', defiance: 0, neighbors: ['Mid'] })
    };
    const out = {};
    order.forEach(key => { out[key] = src[key]; });
    return out;
  };
  const original = {
    Spark: { defiance: 2, happiness: 100 },
    Mid: { defiance: 2, happiness: 100 },
    Far: { defiance: 0, happiness: 100 }
  };

  const forward = Rules.applyDefianceContagion(build(['Spark', 'Mid', 'Far']), original);
  const reversed = Rules.applyDefianceContagion(build(['Far', 'Mid', 'Spark']), original);
  assert.equal(forward.newState.Mid.defiance, reversed.newState.Mid.defiance);
  assert.equal(forward.newState.Far.defiance, reversed.newState.Far.defiance);
  assert.equal(forward.newState.Mid.defiance, 3);
  assert.equal(forward.newState.Far.defiance, 0);
});

test('tribute lapses when the overlord has no surviving territory', () => {
  const Rules = loadRules();
  const state = {
    Ruins: territory({ family: 'Collapsed', type: 'Head', clientOf: null, wealth: 0 }),
    Clientia: territory({ family: 'Clientia', type: 'Client', clientOf: 'USA', wealth: 50 })
  };

  const result = Rules.resolveTribute(state);
  assert.equal(result.newState.Clientia.wealth, 50);
  assert.ok(result.logs.some(line => line.includes('Tribute lapses')));
});

test('protection deters invasion and expires with the deal counter', () => {
  const Rules = loadRules();
  const deter = Rules.resolveTurn({
    Aggressor: territory({ family: 'Aggressor Family', wealth: 100, armies: 2, socialCapital: 50, politicalCapital: 50 }),
    Shielded: territory({ family: 'Shielded Family', happiness: 80, protected: true, protectedBy: 'Guardian Family' })
  }, [{ family: 'Aggressor', action: 'Invade', target: 'Shielded' }]);
  assert.equal(deter.newState.Aggressor.socialCapital, 30);
  assert.equal(deter.newState.Aggressor.politicalCapital, 50);
  assert.ok(deter.logs.some(line => line.includes('extra backlash for invading protected')));

  const expiring = Rules.resolveCleanup({
    Sheltered: territory({ family: 'Sheltered Family', protectionDeal: 1, protected: true, protectedBy: 'Guardian Family', happiness: 100, stash: 20 })
  });
  assert.equal(expiring.newState.Sheltered.protected, false);
  assert.equal(expiring.newState.Sheltered.protectedBy, null);
  assert.ok(expiring.logs.some(line => line.includes('Protection expired')));
});

test('compliant clients use overlord and bloc-mate resources', () => {
  const Rules = loadRules();
  const compliant = {
    Patron: territory({ family: 'Patronia', type: 'Regional', clientOf: null, resources: ['Industry'] }),
    Little: territory({ family: 'Little Family', type: 'Client', clientOf: 'Patronia', resources: [], resourceNeeds: ['Industry', 'Grain'], defiance: 0, wealth: 100 }),
    Sibling: territory({ family: 'Sibling Family', type: 'Client', clientOf: 'Patronia', resources: ['Grain'], defiance: 0 })
  };
  const shared = Rules.resolveResourcePressure(compliant);
  assert.equal(shared.newState.Little.wealth, 100);

  const defiant = {
    ...compliant,
    Little: territory({ family: 'Little Family', type: 'Client', clientOf: 'Patronia', resources: [], resourceNeeds: ['Industry', 'Grain'], defiance: 1, wealth: 100 })
  };
  const cutOff = Rules.resolveResourcePressure(defiant);
  assert.equal(cutOff.newState.Little.wealth, 90);
});

test('no seat can win on the first round from the starting setup', () => {
  const Rules = loadRules();
  const territories = readJson('frontend', 'data', 'territories.json');
  const objectives = Rules.OBJECTIVES;

  const tribute = Rules.resolveTribute(territories);
  const evaluated = Rules.evaluateObjectives(tribute.newState);
  for (const [key, data] of Object.entries(evaluated.newState)) {
    assert.notEqual(data.outcome, 'Won', `${key} can win from setup plus one tribute phase`);
  }

  const maxSingleActionPoliticalGain = 10;
  for (const [key, data] of Object.entries(tribute.newState)) {
    if (data.type === 'Regional') {
      assert.ok(
        data.wealth < objectives.regionalWealthWin || data.politicalCapital + maxSingleActionPoliticalGain < objectives.regionalPoliticalWin,
        `${key} is within one action of the regional win`
      );
    }
    if (data.type === 'Head') {
      assert.ok(data.wealth + 25 < objectives.headWealthWin, `${key} is within one action of the head wealth win`);
    }
    if (data.type === 'Client') {
      assert.ok(
        data.happiness + 15 < objectives.clientHappinessWin || data.development + 10 < objectives.clientDevelopmentWin,
        `${key} is within one action of the client win`
      );
    }
  }
});

if (commandExists('php')) {
  test('BGA PHP files pass syntax lint', () => {
    const phpFiles = listFilesRecursive('bga', file => file.endsWith('.php'));
    assert.ok(phpFiles.length > 0, 'expected PHP files in bga/');
    for (const file of phpFiles) {
      const result = runCommand('php', ['-l', file]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
  });
} else {
  skip('BGA PHP files pass syntax lint', 'php command is not installed');
}

test('lightweight lint and format checks pass for source files', () => {
  const sourceFiles = [
    ...listFilesRecursive('frontend', file => /\.(js|css|json|svg|html)$/.test(file)),
    ...listFilesRecursive('bga', file => /\.(php|js|css|tpl|sql)$/.test(file)),
    ...listFilesRecursive('playtest', file => /\.(js|json|md)$/.test(file)),
    ...listFilesRecursive('tools', file => /\.js$/.test(file)),
    'README.md',
    'RULES.md',
    'TODO.md',
    'CHANGELOG.md',
    'package.json',
    'tests/run-tests.js'
  ];

  for (const file of sourceFiles) {
    const text = readText(file);
    assert.ok(text.endsWith('\n'), `${file} must end with a newline`);
    assert.doesNotMatch(text, /[ \t]+$/m, `${file} has trailing whitespace`);
  }

  for (const file of listFilesRecursive('frontend', file => file.endsWith('.css')).concat(listFilesRecursive('bga', file => file.endsWith('.css')))) {
    const text = readText(file);
    const opens = (text.match(/{/g) || []).length;
    const closes = (text.match(/}/g) || []).length;
    assert.equal(opens, closes, `${file} has unbalanced CSS braces`);
  }

  const sql = readText('bga', 'dbmodel.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS territories/);
  assert.doesNotMatch(sql, /DROP TABLE/i);

  const bgaAction = readText('bga', 'grandareagame.action.php');
  const bgaGame = readText('bga', 'grandareagame.game.php');
  assert.doesNotMatch(bgaAction + bgaGame, /addslashes/);
  assert.match(bgaAction, /class action_grandareagame extends APP_GameAction/);
  assert.match(bgaGame, /GrandAreaRules::resolveTurn/);
  assert.match(bgaGame, /setupNewGame/);
});

test('balance.json documentation blocks match the engine constants', () => {
  const Rules = loadRules();
  const balance = readJson('frontend', 'data', 'balance.json');
  // JSON round-trip: vm-realm objects have foreign prototypes that fail deepStrictEqual.
  assert.deepEqual(balance.cleanupRecovery, JSON.parse(JSON.stringify(Rules.RECOVERY)),
    'balance.json cleanupRecovery drifted from RECOVERY in rules.js');
  assert.deepEqual(balance.defiancePressure, JSON.parse(JSON.stringify(Rules.DEFIANCE_PRESSURE)),
    'balance.json defiancePressure drifted from DEFIANCE_PRESSURE in rules.js');
  const source = readText('frontend', 'rules.js');
  assert.ok(source.includes(`UPRISING_HAPPINESS_SAFE_FLOOR = ${balance.uprising.happinessSafeFloor};`),
    'balance.json uprising.happinessSafeFloor drifted from rules.js');
  assert.ok(source.includes(`HEAD_DEFIANCE_MAJORITY_ROUNDS_TO_LOSE = ${balance.headDefianceMajority.cleanupsToLose};`),
    'balance.json headDefianceMajority.cleanupsToLose drifted from rules.js');
});

test('eliminated players cannot play cards', () => {
  const Rules = loadRules();
  const state = {
    Ghost: territory({ family: 'GhostFam', outcome: 'Lost', blackBudget: 20 }),
    Victim: territory({ family: 'VictimFam', happiness: 100 })
  };
  const result = Rules.resolveCard(state, 'rotten_apple', 'Ghost', 'Victim');
  assert.equal(result.newState.Victim.happiness, 100);
  assert.ok(result.logs.some(line => line.includes('eliminated and cannot play cards')));
});

test('a successful coup resets the defiance-majority counter', () => {
  const Rules = loadRules([0.1]);
  const state = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 100, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', type: 'Head', clientOf: null, politicalCapital: 50, happiness: 90, defianceMajorityRounds: 1 })
  };
  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(result.newState.Beta.family, 'AlphaFamily');
  assert.equal(result.newState.Beta.defianceMajorityRounds, 0);
});

test('counterintelligence foils coups and covert influence', () => {
  const Rules = loadRules([0.1]);
  const state = {
    Plotter: territory({ family: 'PlotterFam', blackBudget: 20, politicalCapital: 100, socialCapital: 50 }),
    Wary: territory({ family: 'WaryFam', blackBudget: 10, politicalCapital: 50, socialCapital: 50 })
  };

  const result = Rules.resolveTurn(state, [
    { family: 'Plotter', action: 'Coup', target: 'Wary' },
    { family: 'Wary', action: 'CounterIntel', target: 'Self' }
  ]);
  assert.equal(result.newState.Wary.family, 'WaryFam');
  assert.equal(result.newState.Wary.blackBudget, 6);
  assert.equal(result.newState.Wary.politicalCapital, 55);
  assert.equal(result.newState.Plotter.blackBudget, 10);
  assert.equal(result.newState.Plotter.socialCapital, 42);
  assert.ok(result.logs.some(line => line.includes('foiled by counterintelligence')));
  assert.equal(result.newState.Wary.counterIntelActive, undefined);

  const covert = Rules.resolveTurn(state, [
    { family: 'Plotter', action: 'CovertInfluence', target: 'Wary' },
    { family: 'Wary', action: 'CounterIntel', target: 'Self' }
  ]);
  assert.equal(covert.newState.Wary.defiance, 0);
  assert.equal(covert.newState.Plotter.socialCapital, 42);
});

test('fortify blunts invasions and self-covert-influence is never foiled', () => {
  const Rules = loadRules();
  const invasion = Rules.resolveTurn({
    Raider: territory({ family: 'RaiderFam', wealth: 100, armies: 2, socialCapital: 50, politicalCapital: 50 }),
    Bunker: territory({ family: 'BunkerFam', type: 'Client', clientOf: 'RaiderFam', wealth: 80, happiness: 100, defiance: 0 })
  }, [
    { family: 'Raider', action: 'Invade', target: 'Bunker' },
    { family: 'Bunker', action: 'Fortify', target: 'Self' }
  ]);
  assert.equal(invasion.newState.Bunker.happiness, 87); // ceil(25/2) = 13 instead of 25
  assert.equal(invasion.newState.Bunker.wealth, 80 - 6 - 5); // fortify cost + halved damage
  assert.equal(invasion.newState.Bunker.defiance, 0);
  assert.equal(invasion.newState.Raider.politicalCapital, 50); // no rally for the invader
  assert.equal(invasion.newState.Bunker.fortified, undefined);

  const selfStoke = Rules.resolveTurn({
    Rebel: territory({ family: 'RebelFam', type: 'Client', clientOf: 'USA', blackBudget: 12, politicalCapital: 50 })
  }, [{ family: 'Rebel', action: 'CovertInfluence', target: 'Self' }]);
  assert.equal(selfStoke.newState.Rebel.defiance, 1);
});

test('a failed coup rallies the target', () => {
  const Rules = loadRules([0.99]);
  const state = {
    Alpha: territory({ family: 'AlphaFamily', politicalCapital: 50, socialCapital: 80 }),
    Beta: territory({ family: 'BetaFamily', politicalCapital: 50, happiness: 90, fear: 10 })
  };
  const result = Rules.resolveTurn(state, [{ family: 'Alpha', action: 'Coup', target: 'Beta' }]);
  assert.equal(result.newState.Beta.family, 'BetaFamily');
  assert.equal(result.newState.Beta.politicalCapital, 55);
  assert.equal(result.newState.Beta.fear, 14);
  assert.ok(result.logs.some(line => line.includes('rallies around the flag')));
});

test('narrative smears and whitewashes adjust framing and capital', () => {
  const Rules = loadRules();
  const state = {
    Raider: territory({ family: 'RaiderFam', wealth: 100, armies: 2, socialCapital: 50, politicalCapital: 50 }),
    Victim: territory({ family: 'VictimFam', type: 'Regional', clientOf: null, wealth: 80, happiness: 100 }),
    Critic: territory({ family: 'CriticFam', socialCapital: 40, politicalCapital: 50 })
  };

  // Raider invades with framing 10; Critic smears the invasion coverage.
  const smeared = Rules.resolveTurn(state, [
    { family: 'Raider', action: 'Invade', target: 'Victim', framing: 10 }
  ], { narrative: [{ family: 'Critic', stance: 'smear', target: 'Raider' }] });
  // effective framing 10 - 8 = 2 -> happiness loss 23 instead of 15
  assert.equal(smeared.newState.Victim.happiness, 77);
  assert.equal(smeared.newState.Critic.socialCapital, 36);
  assert.equal(smeared.newState.Raider.politicalCapital, 50 - 3 + 5);

  // Whitewash instead: effective framing 10 + 8 = 18 -> happiness loss 8 (floor)
  const washed = Rules.resolveTurn(state, [
    { family: 'Raider', action: 'Invade', target: 'Victim', framing: 10 }
  ], { narrative: [{ family: 'Critic', stance: 'whitewash', target: 'Raider' }] });
  assert.equal(washed.newState.Victim.happiness, 92);
  assert.equal(washed.newState.Raider.socialCapital, 50 - 10 - Math.max(0, 15 - Math.floor(18 / 2)) + 2);
});

test('narrative plays are validated and limited to one per family', () => {
  const Rules = loadRules();
  const state = {
    Loud: territory({ family: 'LoudFam', socialCapital: 6, politicalCapital: 50 }),
    Broke: territory({ family: 'BrokeFam', socialCapital: 3, politicalCapital: 50 }),
    Mark: territory({ family: 'MarkFam', socialCapital: 50, politicalCapital: 50 })
  };

  const result = Rules.resolveTurn(state, [], { narrative: [
    { family: 'Loud', stance: 'smear', target: 'Mark' },
    { family: 'Loud', stance: 'smear', target: 'Broke' },
    { family: 'Broke', stance: 'smear', target: 'Mark' },
    { family: 'Mark', stance: 'smear', target: 'Mark' }
  ] });
  assert.equal(result.newState.Loud.socialCapital, 2); // paid once
  assert.equal(result.newState.Mark.politicalCapital, 47); // smeared once, not twice
  assert.equal(result.newState.Broke.politicalCapital, 50); // Loud's second play ignored
  assert.ok(result.logs.some(line => line.includes('already made a narrative play')));
  assert.ok(result.logs.some(line => line.includes('failed a narrative play (insufficient Social Capital)')));
  assert.ok(result.logs.some(line => line.includes('failed Smear (cannot smear yourself)')));
});

test('BGA module matches the Studio project layout', () => {
  const required = [
    'bga/dbmodel.sql',
    'bga/gameinfos.inc.php',
    'bga/gameoptions.inc.php',
    'bga/material.inc.php',
    'bga/states.inc.php',
    'bga/stats.inc.php',
    'bga/grandareagame.game.php',
    'bga/grandareagame.action.php',
    'bga/grandareagame.view.php',
    'bga/grandareagame.js',
    'bga/grandareagame.css',
    'bga/grandareagame_grandareagame.tpl',
    'bga/img/game_box.png',
    'bga/img/game_icon.png',
    'bga/img/game_banner.png'
  ];
  for (const file of required) {
    assert.ok(fs.existsSync(fromRoot(file)), `missing BGA Studio file ${file}`);
  }
  assert.ok(!fs.existsSync(fromRoot('bga', 'client')), 'bga/client should not exist in the Studio layout');
  const game = readText('bga', 'grandareagame.game.php');
  assert.match(game, /public function zombieTurn/);
  assert.match(game, /public function upgradeTableDb/);
  assert.match(game, /protected function getAllDatas/);
  assert.match(game, /public function getGameProgression/);
});

test('BGA module is self-contained (no reads outside the game folder)', () => {
  const phpFiles = listFilesRecursive('bga', file => file.endsWith('.php'));
  for (const file of phpFiles) {
    const text = readText(file);
    assert.doesNotMatch(text, /file_get_contents/, `${file} reads external files at runtime`);
    assert.doesNotMatch(text, /dirname\(__DIR__\)\s*\.\s*'\/frontend/, `${file} references the frontend folder`);
  }
});

test('BGA embedded material matches the frontend data fixtures', () => {
  const crypto = require('node:crypto');
  const sources = ['territories.json', 'crisis.json', 'playercards.json', 'setups.json', 'balance.json'];
  const joined = sources.map(name => readText('frontend', 'data', name)).join('\n');
  const expected = crypto.createHash('sha256').update(joined).digest('hex');
  const material = readText('bga', 'material.inc.php');
  const match = material.match(/source-checksum: ([a-f0-9]{64})/);
  assert.ok(match, 'material.inc.php is missing its source-checksum header');
  assert.equal(match[1], expected,
    'bga/material.inc.php is stale — regenerate with: node tools/generate-bga-material.js');
  for (const marker of ['territoryMaterial', 'crisisMaterial', 'playerCardMaterial', 'setupMaterial', 'balanceMaterial']) {
    assert.ok(material.includes(`$this->${marker}`), `material.inc.php missing ${marker}`);
  }
});

test('BGA board template embeds the world map safely', () => {
  const tpl = readText('bga', 'grandareagame_grandareagame.tpl');
  const territories = readJson('frontend', 'data', 'territories.json');
  assert.match(tpl, /\{OVERALL_GAME_HEADER\}/);
  assert.match(tpl, /\{OVERALL_GAME_FOOTER\}/);
  for (const key of Object.keys(territories)) {
    assert.ok(tpl.includes(`data-country="${key}"`), `template missing region ${key}`);
  }
  assert.doesNotMatch(tpl, /<style>/, 'inline <style> blocks break the BGA template engine');
});

const cliArgs = process.argv.slice(2);
const formatOnly = cliArgs.includes('--format-check');
const lintOnly = !formatOnly && cliArgs.includes('--lint');

const LINT_TEST_NAMES = new Set([
  'frontend JavaScript parses',
  'BGA PHP files pass syntax lint',
  'lightweight lint and format checks pass for source files'
]);
const FORMAT_TEST_NAMES = new Set([
  'lightweight lint and format checks pass for source files'
]);

let selected = tests;
if (formatOnly) {
  selected = tests.filter(entry => FORMAT_TEST_NAMES.has(entry.name));
} else if (lintOnly) {
  selected = tests.filter(entry => LINT_TEST_NAMES.has(entry.name));
}

(async () => {
  let failed = 0;
  for (const { name, fn } of selected) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`[FAIL] ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (!lintOnly && !formatOnly) {
    for (const { name, reason } of skips) {
      console.log(`[SKIP] ${name} (${reason})`);
    }
  }

  const mode = formatOnly ? ' (format-check mode)' : lintOnly ? ' (lint mode)' : '';
  console.log(`\n${selected.length - failed}/${selected.length} tests passed${mode}, ${lintOnly || formatOnly ? 0 : skips.length} skipped.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
})();
