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

function isTerritory(value) {
  return value
    && typeof value === 'object'
    && typeof value.family === 'string'
    && typeof value.type === 'string'
    && typeof value.wealth === 'number';
}

function territoryKeys(state) {
  return Object.keys(state).filter(key => isTerritory(state[key])).sort();
}

function isEliminated(data) {
  return data.family === 'Anarchy' || data.family === 'Collapsed' || data.outcome === 'Lost';
}

function seededShuffle(items, rng) {
  const out = items.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const held = out[index];
    out[index] = out[swap];
    out[swap] = held;
  }
  return out;
}

function firstKey(state, predicate) {
  return territoryKeys(state).find(key => predicate(state[key], key)) || null;
}

function richestKey(state, predicate) {
  let best = null;
  for (const key of territoryKeys(state)) {
    const data = state[key];
    if (isEliminated(data) || !predicate(data, key)) continue;
    if (!best || (data.wealth || 0) > (state[best].wealth || 0)) best = key;
  }
  return best;
}

function hasDevelopAccess(Rules, key, state) {
  const resources = Rules.availableResourcesFor(key, state);
  return resources.has('Industry') || resources.has('Technology');
}

// Shared survival branch: respond to own defiant clients first (they bleed
// capitals and can topple a Head), then defend own happiness before it slides
// toward uprising or collapse territory.
function chooseDefianceResponse(key, data, state, objectives) {
  let defiantClient = null;
  for (const otherKey of territoryKeys(state)) {
    const other = state[otherKey];
    if (other.type !== 'Client' || other.clientOf !== data.family || (other.defiance || 0) <= 0 || isEliminated(other)) continue;
    if (!defiantClient || (other.defiance || 0) > (state[defiantClient].defiance || 0)) defiantClient = otherKey;
  }
  if (!defiantClient) return null;
  // A client close to the good-example win gets punished, not rewarded:
  // Concession's happiness boost would push it across the line.
  if (nearClientWin(state[defiantClient], objectives) && (data.socialCapital || 0) >= 20) {
    return { family: key, action: 'MakeExample', target: defiantClient };
  }
  // Mild defiance gets the cheap de-escalation: a tribute holiday keeps the
  // client fed and buys back Social Capital instead of burning it.
  if ((state[defiantClient].defiance || 0) <= 2 && (data.wealth || 0) >= 8) {
    return { family: key, action: 'TributeHoliday', target: defiantClient };
  }
  if ((data.wealth || 0) >= 10 && (data.politicalCapital || 0) >= 15) return { family: key, action: 'Concession', target: defiantClient };
  if ((data.socialCapital || 0) >= 20) return { family: key, action: 'MakeExample', target: defiantClient };
  return null;
}

function chooseHappinessDefense(key, data) {
  if ((data.happiness || 0) < 70 && (data.stash || 0) >= 12) {
    return { family: key, action: 'Propaganda', target: 'Self' };
  }
  return null;
}

// A client this close to the good-example win should not be stoked or pumped
// by a rival patron: raising its defiance or happiness hands it the game.
function nearClientWin(data, objectives) {
  return (data.happiness || 0) >= objectives.clientHappinessWin - 30
    && (data.development || 0) >= objectives.clientDevelopmentWin - 15;
}

// Greedy deterministic head policy: keep clients compliant, keep survival
// capitals above collapse floors, then extract wealth toward the head win.
function chooseHeadAction(key, data, state, Rules) {
  if ((data.happiness || 0) < 60 && (data.stash || 0) >= 12) {
    return { family: key, action: 'Propaganda', target: 'Self' };
  }
  if ((data.socialCapital || 0) < 40 && (data.blackBudget || 0) >= 8) {
    return { family: key, action: 'FalseFlag', target: 'Self' };
  }
  const response = chooseDefianceResponse(key, data, state, Rules.OBJECTIVES);
  if (response) return response;
  const defense = chooseHappinessDefense(key, data);
  if (defense) return defense;
  if ((data.stash || 0) < 15) {
    const mark = richestKey(state, (other, otherKey) => otherKey !== key);
    if (mark) return { family: key, action: 'Skim', target: mark };
  }
  if ((data.politicalCapital || 0) >= 28) {
    const rival = richestKey(state, (other, otherKey) => otherKey !== key && other.type === 'Regional');
    if (rival) return { family: key, action: 'DebtShakedown', target: rival };
  }
  if ((data.socialCapital || 0) >= 24) {
    const rival = richestKey(state, (other, otherKey) => otherKey !== key && other.type === 'Regional');
    if (rival) return { family: key, action: 'EconomicExploitation', target: rival };
  }
  return { family: key, action: 'Pass', target: 'Self' };
}

// Greedy deterministic regional policy: keep own clients compliant, keep the
// public content, build political capital toward the regional win, shake down
// rivals for wealth, otherwise develop.
function chooseRegionalAction(key, data, state, Rules) {
  const objectives = Rules.OBJECTIVES;
  if ((data.happiness || 0) < 60 && (data.stash || 0) >= 12) {
    return { family: key, action: 'Propaganda', target: 'Self' };
  }
  const response = chooseDefianceResponse(key, data, state, objectives);
  if (response) return response;
  const defense = chooseHappinessDefense(key, data);
  if (defense) return defense;
  if ((data.politicalCapital || 0) >= 120) {
    const nearWinHead = richestKey(state, (other, otherKey) =>
      otherKey !== key && other.type === 'Head' && (other.wealth || 0) >= objectives.headWealthWin - 40);
    if (nearWinHead) return { family: key, action: 'Sanction', target: nearWinHead };
  }
  const ownClients = territoryKeys(state).filter(otherKey => {
    const other = state[otherKey];
    return other.type === 'Client' && other.clientOf === data.family && !isEliminated(other);
  });
  if (ownClients.length < 2 && (data.politicalCapital || 0) >= 60 && (data.socialCapital || 0) >= 24) {
    const poachable = richestKey(state, other =>
      other.type === 'Client' && other.clientOf && other.clientOf !== data.family && !other.protected && !nearClientWin(other, objectives)
      && ((other.defiance || 0) > 0 || (other.independenceSentiment || 0) >= 70 || (other.realignmentPressure || 0) >= 8));
    if (poachable) return { family: key, action: 'ClientRealignment', target: poachable };
  }
  if ((data.politicalCapital || 0) < objectives.regionalPoliticalWin + 10 && (data.blackBudget || 0) >= 6) {
    const rivalClient = firstKey(state, other =>
      other.type === 'Client' && other.clientOf && other.clientOf !== data.family && (other.defiance || 0) === 0 && !nearClientWin(other, objectives) && !isEliminated(other));
    if (rivalClient) return { family: key, action: 'CovertInfluence', target: rivalClient };
  }
  if ((data.politicalCapital || 0) < objectives.regionalPoliticalWin && (data.stash || 0) >= 12 && (data.wealth || 0) >= 20) {
    const rivalClient = firstKey(state, other =>
      other.type === 'Client' && other.clientOf && other.clientOf !== data.family && (other.defiance || 0) === 0 && !nearClientWin(other, objectives) && !isEliminated(other));
    if (rivalClient) return { family: key, action: 'ProtectionDeal', target: rivalClient };
  }
  if ((data.wealth || 0) < objectives.regionalWealthWin && (data.politicalCapital || 0) >= objectives.regionalPoliticalWin + 10) {
    const rival = richestKey(state, (other, otherKey) => otherKey !== key && (other.type === 'Regional' || other.type === 'Head'));
    if (rival) return { family: key, action: 'DebtShakedown', target: rival };
  }
  if ((data.wealth || 0) >= 20 && hasDevelopAccess(Rules, key, state)) {
    return { family: key, action: 'Develop', target: 'Self' };
  }
  return { family: key, action: 'Pass', target: 'Self' };
}

// Deterministic client policy pursuing the independence win: build development
// and happiness while compliant, flip to deliberate defiance through
// self-CovertInfluence once close, then keep happiness and wealth alive. The
// policy keeps a wealth reserve so investment never bleeds the seat to zero.
function chooseClientAction(key, data, state, Rules) {
  const objectives = Rules.OBJECTIVES;
  const defiant = (data.defiance || 0) > 0;
  if ((data.happiness || 0) < 60 && (data.stash || 0) >= 12) {
    return { family: key, action: 'Propaganda', target: 'Self' };
  }
  const winReady = (data.happiness || 0) >= objectives.clientHappinessWin
    && (data.development || 0) >= objectives.clientDevelopmentWin
    && (data.independenceSentiment || 0) >= objectives.clientIndependenceWin;
  if (!defiant && winReady && (data.blackBudget || 0) >= 6) {
    return { family: key, action: 'CovertInfluence', target: 'Self' };
  }
  if ((data.development || 0) < objectives.clientDevelopmentWin + 10 && (data.wealth || 0) >= 25 && hasDevelopAccess(Rules, key, state)) {
    return { family: key, action: 'Develop', target: 'Self' };
  }
  if ((data.happiness || 0) < objectives.clientHappinessWin + 10 && (data.stash || 0) >= 14) {
    return { family: key, action: 'Propaganda', target: 'Self' };
  }
  const available = Rules.availableResourcesFor(key, state);
  const missing = (data.resourceNeeds || []).filter(need => !available.has(need));
  if ((data.wealth || 0) >= 28 && (missing.length === 0 || (data.wealth || 0) >= 60)) {
    return { family: key, action: 'Educate', target: 'Self' };
  }
  return { family: key, action: 'Pass', target: 'Self' };
}

function chooseAction(key, state, Rules) {
  const data = state[key];
  if (!data || isEliminated(data)) return { family: key, action: 'Pass', target: 'Self' };
  if (data.type === 'Head') return chooseHeadAction(key, data, state, Rules);
  if (data.type === 'Regional') return chooseRegionalAction(key, data, state, Rules);
  return chooseClientAction(key, data, state, Rules);
}

function outcomeFor(data) {
  if (data.outcome === 'Won') return 'won';
  if (data.family === 'Collapsed' || data.family === 'Anarchy') return 'collapsed';
  if (data.outcome === 'Lost') return 'lost';
  return 'active';
}

const DEATH_PATTERNS = [
  { cause: 'stashZero', pattern: /GAME OVER for (\S+): Personal Capital \(Stash\) hit zero/ },
  { cause: 'politicalZero', pattern: /GAME OVER for (\S+): Political Capital hit zero/ },
  { cause: 'socialZero', pattern: /GAME OVER for (\S+): Social Capital hit zero/ },
  { cause: 'uprising', pattern: /UPRISING in (\S+)!/ },
  { cause: 'defianceMajority', pattern: /Lost: (\S+) - a majority of active clients are defiant/ },
  { cause: 'regionalHappinessCollapse', pattern: /Lost: (\S+) - domestic happiness collapsed/ },
  { cause: 'clientWealthOrHappiness', pattern: /Lost: (\S+) - client wealth or happiness collapsed/ },
  { cause: 'controlCollapsed', pattern: /Lost: (\S+) - family control collapsed/ }
];

function collectDeaths(lines, round, deaths, deadSeats) {
  for (const line of lines) {
    for (const { cause, pattern } of DEATH_PATTERNS) {
      const match = line.match(pattern);
      if (match && !deadSeats.has(match[1])) {
        deadSeats.add(match[1]);
        deaths.push({ seat: match[1], round, cause });
      }
    }
  }
}

function runSimulation(rounds = 6, seed = 'balance') {
  const Rules = loadRules();
  let state = clone(readJson('frontend', 'data', 'territories.json'));
  const crisisCards = clone(readJson('frontend', 'data', 'crisis.json'));
  const crisisById = new Map(crisisCards.map(card => [card.id, card]));
  let drawPile = seededShuffle(crisisCards.map(card => card.id), Rules.createSeededRandom(`${seed}:crisis-deck`));
  let discard = [];
  const crisesDrawn = [];
  const logs = [];
  const deaths = [];
  const deadSeats = new Set();
  let roundsPlayed = 0;

  for (let round = 1; round <= rounds; round += 1) {
    if (drawPile.length === 0 && discard.length > 0) {
      drawPile = seededShuffle(discard, Rules.createSeededRandom(`${seed}:crisis-reshuffle:${round}`));
      discard = [];
    }
    const crisisId = drawPile.shift() || null;
    if (crisisId) {
      discard.push(crisisId);
      crisesDrawn.push(crisisId);
    }

    const tribute = Rules.resolveTribute(state);
    state = tribute.newState;
    const actions = territoryKeys(state).map(key => chooseAction(key, state, Rules));
    const turnInput = { ...state };
    if (crisisId) turnInput.crisis = clone(crisisById.get(crisisId));
    const resolved = Rules.resolveTurn(turnInput, actions, { seed: `${seed}:round:${round}` });
    const cleanup = Rules.resolveCleanup(resolved.newState, { seed: `${seed}:round:${round}:cleanup` });
    state = cleanup.newState;
    collectDeaths(resolved.logs.concat(cleanup.logs), round, deaths, deadSeats);
    logs.push({ round, crisis: crisisId, actions, events: resolved.logs.length + cleanup.logs.length });
    roundsPlayed = round;
    if (territoryKeys(state).some(key => state[key].outcome === 'Won')) break;
  }

  const totals = { wealth: 0, defiance: 0, development: 0 };
  const seats = {};
  const outcomesByRole = {
    Head: { won: 0, lost: 0, collapsed: 0, active: 0 },
    Regional: { won: 0, lost: 0, collapsed: 0, active: 0 },
    Client: { won: 0, lost: 0, collapsed: 0, active: 0 }
  };
  const winners = [];
  const losers = [];

  for (const key of territoryKeys(state)) {
    const data = state[key];
    totals.wealth += data.wealth || 0;
    totals.defiance += data.defiance || 0;
    totals.development += data.development || 0;
    const outcome = outcomeFor(data);
    if (outcome === 'won') winners.push(key);
    if (outcome === 'lost' || outcome === 'collapsed') losers.push(key);
    if (outcomesByRole[data.type]) outcomesByRole[data.type][outcome] += 1;
    seats[key] = {
      role: data.type,
      family: data.family,
      outcome,
      wealth: data.wealth || 0,
      happiness: data.happiness || 0,
      development: data.development || 0,
      politicalCapital: data.politicalCapital || 0,
      defiance: data.defiance || 0
    };
  }

  return {
    rounds,
    seed,
    roundsPlayed,
    totals,
    winners,
    losers,
    outcomesByRole,
    seats,
    deaths,
    crisesDrawn,
    logs
  };
}

if (require.main === module) {
  const rounds = Number(process.argv[2] || 6);
  const seed = process.argv[3] || 'balance';
  console.log(JSON.stringify(runSimulation(rounds, seed), null, 2));
}

module.exports = { runSimulation };
