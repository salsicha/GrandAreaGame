const vm = require('node:vm');
const { hashValue, readJson, readText } = require('../util/files');

const ACTION_RULES = {
  Pass: { target: 'self', cost: 'None', effect: 'No effect.', tags: ['safe'] },
  Skim: { target: 'any', cost: 'Target wealth', effect: 'Move 10 target wealth to stash; target happiness -6.', tags: ['economy', 'extraction'] },
  Propaganda: { target: 'any', cost: '8 stash', effect: 'Target happiness +10.', tags: ['happiness', 'public-order'] },
  Invade: { target: 'other', cost: '12 wealth, 1 army, backlash', effect: 'Target invaded, wealth -10, happiness loss, fear +10.', tags: ['military', 'coercion'] },
  Sanction: { target: 'other', cost: '5 Political Capital', effect: 'Target wealth, happiness, and development fall.', tags: ['economy', 'coercion'] },
  Protect: { target: 'other', cost: '8 wealth, 6 stash', effect: 'Target protected, happiness +8, fear reduced.', tags: ['protection', 'relationship'] },
  TributeHoliday: { target: 'controlledClient', cost: '8 wealth', effect: 'Client skips one tribute and loses 1 defiance.', tags: ['client-management'] },
  ProtectionDeal: { target: 'other', cost: '6 wealth, 4 stash', effect: 'Temporary protection; rival clients gain realignment pressure.', tags: ['relationship', 'realignment'] },
  ClientRealignment: { target: 'eligibleRivalClient', cost: '12 Political Capital, 4 Social Capital', effect: 'Eligible rival client switches patron.', tags: ['relationship', 'realignment'] },
  RegionalRivalry: { target: 'regionalOther', cost: '6 Political Capital', effect: 'Rival loses Political Capital and gains factional division.', tags: ['regional', 'competition'] },
  DebtShakedown: { target: 'other', cost: '8 Political Capital', effect: 'Extract up to 20 wealth and add target debt.', tags: ['economy', 'debt'] },
  EconomicExploitation: { target: 'other', cost: '4 Social Capital', effect: 'Extract wealth and stash; target development and happiness fall.', tags: ['economy', 'extraction'] },
  Coup: { target: 'other', cost: '10 Black Budget', effect: 'Seeded coup roll can replace target family control.', tags: ['covert', 'control'] },
  FalseFlag: { target: 'self', cost: '8 Black Budget', effect: 'Gain 50 Social Capital.', tags: ['covert', 'social-capital'] },
  CovertInfluence: { target: 'any', cost: '6 Black Budget', effect: 'Target defiance +1; actor Political Capital +5. Self-target is the client path to deliberate defiance.', tags: ['covert', 'defiance'] },
  MakeExample: { target: 'ownDefiantClient', cost: '10 Social Capital', effect: 'Reset own defiant client; target happiness -20.', tags: ['client-management', 'coercion'] },
  Concession: { target: 'ownDefiantClient', cost: '10 wealth, 5 Political Capital', effect: 'Reset own defiant client; target happiness +10.', tags: ['client-management', 'happiness'] },
  Educate: { target: 'self', cost: '8 wealth', effect: 'Education +10, development +3, political side pressure.', tags: ['education', 'development'] },
  Develop: { target: 'self', cost: '10 wealth; needs Industry or Technology', effect: 'Development +10, happiness +3, net wealth -5.', tags: ['development', 'economy'] }
};

const ACTIONS = Object.keys(ACTION_RULES);

const MAX_RECENT_EVENTS = 60;

const NOISE_EVENT_PATTERNS = [
  /^Using replay seed:/,
  /^Resolving actions \(/,
  /sentiment changed \(/
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadRules() {
  const context = { window: {}, Math };
  vm.runInNewContext(readText('frontend', 'rules.js'), context, { filename: 'frontend/rules.js' });
  if (!context.window.Rules) throw new Error('frontend/rules.js did not expose window.Rules');
  return context.window.Rules;
}

function isTerritoryState(value) {
  return value
    && typeof value === 'object'
    && typeof value.family === 'string'
    && typeof value.type === 'string'
    && typeof value.wealth === 'number'
    && typeof value.happiness === 'number';
}

function territoryKeys(state) {
  return Object.keys(state.territories).filter(key => isTerritoryState(state.territories[key]));
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

// Mirrors every affordability and actor-type gate in frontend/rules.js so that
// enumerated actions never resolve to a "failed <Action> (...)" engine log.
function isActionLegal(rules, state, actor, action) {
  const data = state.territories[actor] || {};
  if (isEliminated(data)) return action === 'Pass';
  switch (action) {
    case 'Pass': return true;
    case 'Skim': return true;
    case 'Propaganda': return (data.stash || 0) >= 8;
    case 'Invade': return (data.armies || 0) >= 1 && (data.wealth || 0) >= 12;
    case 'Sanction': return (data.politicalCapital || 0) >= 5;
    case 'Protect': return (data.stash || 0) >= 6 && (data.wealth || 0) >= 8;
    case 'TributeHoliday': return (data.wealth || 0) >= 8;
    case 'ProtectionDeal': return (data.stash || 0) >= 4 && (data.wealth || 0) >= 6;
    case 'ClientRealignment': return (data.politicalCapital || 0) >= 12;
    case 'RegionalRivalry': return data.type === 'Regional' && (data.politicalCapital || 0) >= 6;
    case 'DebtShakedown': return (data.politicalCapital || 0) >= 8;
    case 'EconomicExploitation': return (data.socialCapital || 0) >= 4;
    case 'Coup': return (data.blackBudget || 0) >= 10;
    case 'FalseFlag': return (data.blackBudget || 0) >= 8;
    case 'CovertInfluence': return (data.blackBudget || 0) >= 6;
    case 'MakeExample': return (data.socialCapital || 0) >= 10;
    case 'Concession': return (data.wealth || 0) >= 10 && (data.politicalCapital || 0) >= 5;
    case 'Educate': return (data.wealth || 0) >= 8;
    case 'Develop': {
      if ((data.wealth || 0) < 10) return false;
      const resources = rules.availableResourcesFor(actor, state.territories);
      return resources.has('Industry') || resources.has('Technology');
    }
    default: return false;
  }
}

// Mirrors the engine's relationship gates: offensive actions reject self-target,
// MakeExample/Concession only work on the actor's own defiant clients, and
// ClientRealignment only works on other families' eligible clients.
function targetKeysForAction(state, actor, action) {
  const rule = ACTION_RULES[action] || ACTION_RULES.Pass;
  const actorData = state.territories[actor] || {};
  const others = territoryKeys(state).filter(key => key !== actor && !isEliminated(state.territories[key]));
  if (rule.target === 'self') return ['Self'];
  if (rule.target === 'any') return ['Self'].concat(others);
  if (rule.target === 'other') return others;
  if (rule.target === 'controlledClient') {
    return others.filter(key => {
      const target = state.territories[key];
      return target.type === 'Client' && target.clientOf === actorData.family;
    });
  }
  if (rule.target === 'ownDefiantClient') {
    return others.filter(key => {
      const target = state.territories[key];
      return target.type === 'Client' && target.clientOf === actorData.family && (target.defiance || 0) > 0;
    });
  }
  if (rule.target === 'eligibleRivalClient') {
    return others.filter(key => {
      const target = state.territories[key];
      if (target.type !== 'Client' || target.clientOf === actorData.family) return false;
      return (target.defiance || 0) > 0
        || (target.independenceSentiment || 0) >= 50
        || (target.realignmentPressure || 0) >= 8;
    });
  }
  if (rule.target === 'regionalOther') return others.filter(key => state.territories[key].type === 'Regional');
  return ['Self'];
}

function framingOptionsFor(state, actor, action) {
  if (!['Invade', 'Coup'].includes(action)) return [0];
  const available = state.territories[actor].socialCapital || 0;
  return [0, 5, 10, 20].filter(value => value <= available);
}

function actionSummary(actor, action, target, framing) {
  const targetText = target === 'Self' ? actor : target;
  const suffix = framing > 0 ? ` Spend ${framing} Social Capital on framing.` : '';
  return `${actor}: ${action} -> ${targetText}. ${ACTION_RULES[action].effect}${suffix}`;
}

function salientEvents(logs, round) {
  return logs
    .filter(line => !NOISE_EVENT_PATTERNS.some(pattern => pattern.test(line)))
    .slice(-MAX_RECENT_EVENTS)
    .map((summary, index) => ({
      round,
      event: `round-${round}-${index}`,
      summary
    }));
}

class JavaScriptGameAdapter {
  constructor(options = {}) {
    this.rules = loadRules();
    this.maxRounds = options.maxRounds || 12;
    this.crisisCards = clone(readJson('frontend', 'data', 'crisis.json'));
    this.crisisById = new Map(this.crisisCards.map(card => [card.id, card]));
  }

  createInitialState(config = {}, seed = 'playtest') {
    const drawPile = seededShuffle(
      this.crisisCards.map(card => card.id),
      this.rules.createSeededRandom(`${seed}:crisis-deck`)
    );
    const state = {
      schemaVersion: 1,
      gameId: config.gameId || `grand-area-${seed}`,
      engine: 'javascript',
      phase: 'secret-action',
      round: 1,
      maxRounds: config.maxRounds || this.maxRounds,
      seed,
      territories: clone(readJson('frontend', 'data', 'territories.json')),
      recentEvents: [],
      crisisDeck: { drawPile, discard: [] },
      crisis: null
    };
    this.drawCrisis(state, `${seed}:crisis-reshuffle:setup`);
    return state;
  }

  drawCrisis(state, reshuffleSeed) {
    const deck = state.crisisDeck || { drawPile: [], discard: [] };
    let drawPile = deck.drawPile.slice();
    let discard = deck.discard.slice();
    if (drawPile.length === 0 && discard.length > 0) {
      drawPile = seededShuffle(discard, this.rules.createSeededRandom(reshuffleSeed));
      discard = [];
    }
    const nextId = drawPile.shift() || null;
    if (nextId) discard.push(nextId);
    state.crisisDeck = { drawPile, discard };
    state.crisis = nextId ? clone(this.crisisById.get(nextId)) : null;
    return state;
  }

  cloneState(state) {
    return clone(state);
  }

  getPendingActors(state) {
    if (this.isTerminal(state)) return [];
    return territoryKeys(state).filter(key => !isEliminated(state.territories[key]));
  }

  getObservation(state, actor) {
    const own = state.territories[actor];
    if (!own) throw new Error(`Unknown actor ${actor}`);
    const publicTerritories = {};
    territoryKeys(state).forEach(key => {
      const data = state.territories[key];
      publicTerritories[key] = {
        family: data.family,
        type: data.type,
        clientOf: data.clientOf || null,
        resources: data.resources || [],
        resourceNeeds: data.resourceNeeds || [],
        armies: data.armies || 0,
        wealth: data.wealth || 0,
        happiness: data.happiness || 0,
        socialCapital: data.socialCapital || 0,
        politicalCapital: data.politicalCapital || 0,
        education: data.education || 0,
        development: data.development || 0,
        debt: data.debt || 0,
        defiance: data.defiance || 0,
        invaded: !!data.invaded,
        sanctioned: !!data.sanctioned,
        protected: !!data.protected,
        outcome: data.outcome || null
      };
    });

    return {
      schemaVersion: 1,
      gameId: state.gameId,
      round: state.round,
      phase: state.phase,
      actor,
      role: own.type,
      crisis: state.crisis ? {
        id: state.crisis.id,
        title: state.crisis.title,
        description: state.crisis.description
      } : null,
      publicState: {
        territories: publicTerritories
      },
      privateState: {
        territory: actor,
        family: own.family,
        stash: own.stash || 0,
        blackBudget: own.blackBudget || 0
      },
      recentEvents: state.recentEvents.slice(-MAX_RECENT_EVENTS),
      strategicFeatures: this.getStrategicFeatures(state, actor)
    };
  }

  getStrategicFeatures(state, actor) {
    const data = state.territories[actor];
    const role = data.type;
    const objectives = this.rules.OBJECTIVES;
    const features = {
      availableActionCount: this.listLegalActions(state, actor).length,
      forcedPass: false,
      survivalRisk: Math.max(0, Math.min(1, (30 - Math.min(data.happiness || 0, data.stash || 0, data.socialCapital || 0, data.politicalCapital || 0)) / 30)),
      roundsRemainingEstimate: Math.max(0, state.maxRounds - state.round + 1)
    };
    if (role === 'Head') {
      features.wealthToVictory = Math.max(0, objectives.headWealthWin - (data.wealth || 0));
      features.compliantClients = territoryKeys(state).filter(key => state.territories[key].type === 'Client' && state.territories[key].clientOf === data.family && (state.territories[key].defiance || 0) === 0).length;
      features.defiantClients = territoryKeys(state).filter(key => state.territories[key].type === 'Client' && state.territories[key].clientOf === data.family && (state.territories[key].defiance || 0) > 0).length;
    } else if (role === 'Regional') {
      features.wealthToVictory = Math.max(0, objectives.regionalWealthWin - (data.wealth || 0));
      features.politicalCapitalToVictory = Math.max(0, objectives.regionalPoliticalWin - (data.politicalCapital || 0));
    } else {
      features.happinessToVictory = Math.max(0, objectives.clientHappinessWin - (data.happiness || 0));
      features.developmentToVictory = Math.max(0, objectives.clientDevelopmentWin - (data.development || 0));
      features.independenceToVictory = Math.max(0, objectives.clientIndependenceWin - (data.independenceSentiment || 0));
      features.defiant = (data.defiance || 0) > 0;
    }
    features.forcedPass = features.availableActionCount === 1;
    return features;
  }

  listLegalActions(state, actor) {
    const legal = [];
    ACTIONS.filter(action => isActionLegal(this.rules, state, actor, action)).forEach(action => {
      targetKeysForAction(state, actor, action).forEach(target => {
        framingOptionsFor(state, actor, action).forEach(framing => {
          const rule = ACTION_RULES[action];
          const id = `A${String(legal.length + 1).padStart(3, '0')}`;
          legal.push({
            id,
            actor,
            type: action,
            target,
            parameters: { framing },
            summary: actionSummary(actor, action, target, framing),
            cost: rule.cost,
            tags: rule.tags
          });
        });
      });
    });
    return legal;
  }

  advance(state, decisions, seed) {
    const chosen = Array.from(decisions.values()).map(action => ({
      family: action.actor,
      action: action.type,
      target: action.target,
      framing: action.parameters && action.parameters.framing || 0
    }));
    const beforeHash = this.hashState(state);
    const logs = [];
    const crisis = state.crisis ? clone(state.crisis) : null;
    if (crisis) logs.push(`Crisis drawn for round ${state.round}: ${crisis.id} (${crisis.title})`);
    const tribute = this.rules.resolveTribute(state.territories);
    const actionInput = { ...tribute.newState };
    if (crisis) actionInput.crisis = crisis;
    const resolved = this.rules.resolveTurn(actionInput, chosen, { seed: `${seed}:actions` });
    const cleanup = this.rules.resolveCleanup(resolved.newState, { seed: `${seed}:cleanup` });
    logs.push(...tribute.logs, ...resolved.logs, ...cleanup.logs);
    const nextState = {
      ...state,
      round: state.round + 1,
      territories: cleanup.newState,
      recentEvents: salientEvents(logs, state.round)
    };
    if (this.isTerminal(nextState)) {
      nextState.crisis = null;
      nextState.phase = 'complete';
    } else {
      this.drawCrisis(nextState, `${seed}:crisis-reshuffle`);
      nextState.phase = 'secret-action';
    }
    return {
      state: nextState,
      logs,
      stateDelta: {
        beforeStateHash: beforeHash,
        afterStateHash: this.hashState(nextState)
      },
      terminal: this.isTerminal(nextState),
      winners: this.getWinners(nextState)
    };
  }

  isTerminal(state) {
    return this.getWinners(state).length > 0 || state.round > state.maxRounds;
  }

  getWinners(state) {
    return territoryKeys(state).filter(key => state.territories[key].outcome === 'Won');
  }

  checkInvariants(state) {
    const failures = [];
    const families = new Set(territoryKeys(state).map(key => state.territories[key].family));
    territoryKeys(state).forEach(key => {
      const data = state.territories[key];
      for (const field of ['wealth', 'happiness', 'stash', 'blackBudget', 'socialCapital', 'politicalCapital', 'education', 'development', 'debt', 'defiance']) {
        if (!Number.isFinite(data[field])) {
          failures.push({ code: 'non_finite_number', severity: 'fatal', message: `${key}.${field} is not finite`, path: `territories.${key}.${field}` });
        }
        if (Number.isFinite(data[field]) && data[field] < 0) {
          failures.push({ code: 'negative_track', severity: 'error', message: `${key}.${field} is negative`, path: `territories.${key}.${field}` });
        }
      }
      if (data.type === 'Client' && data.clientOf && !families.has(data.clientOf)) {
        failures.push({ code: 'dangling_client_of', severity: 'error', message: `${key}.clientOf references missing family ${data.clientOf}`, path: `territories.${key}.clientOf` });
      }
    });
    return failures;
  }

  normalizeState(state) {
    return {
      schemaVersion: state.schemaVersion,
      gameId: state.gameId,
      round: state.round,
      phase: state.phase,
      crisis: state.crisis ? state.crisis.id : null,
      crisisDeck: state.crisisDeck || null,
      territories: state.territories
    };
  }

  hashState(state) {
    return hashValue(this.normalizeState(state));
  }
}

function validateSelectedAction(selectedId, legalActions) {
  const action = legalActions.find(candidate => candidate.id === selectedId);
  if (!action) throw new Error(`Agent selected illegal action ID: ${selectedId}`);
  return action;
}

module.exports = {
  ACTION_RULES,
  ACTIONS,
  JavaScriptGameAdapter,
  validateSelectedAction
};
