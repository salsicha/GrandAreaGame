/*
  Simple rules engine for GrandArea prototype.
  Exposes window.Rules.resolveTurn(state, actions)
  - state: current game state object (territory keys -> {wealth,happiness,stash,invaded,...})
  - actions: array of { family, action, target }
  Returns: { newState, logs }

  This engine produces a new shallow-copied state for territories and leaves runtime metadata out.
  It's intentionally small and synchronous for use in the browser prototype.
*/
(function(){
  const OBJECTIVES = {
    headWealthWin: 300,
    regionalWealthWin: 260,
    regionalPoliticalWin: 120,
    clientHappinessWin: 120,
    clientDevelopmentWin: 70,
    clientIndependenceWin: 60,
    headRunawayWealth: 260
  };

  const ROUND_PHASES = ['Crisis','Tribute','Secret Action Submission','Reveal','Narrative Battle','Resolution','Cleanup'];

  const ROLE_ORDER = { Client: 0, Regional: 1, Head: 2 };

  const ACTION_PRIORITY = {
    Pass: 0,
    Concession: 1,
    TributeHoliday: 1,
    Protect: 2,
    ProtectionDeal: 2,
    Educate: 3,
    Develop: 3,
    Skim: 4,
    Propaganda: 4,
    DebtShakedown: 5,
    EconomicExploitation: 5,
    Sanction: 6,
    CovertInfluence: 7,
    RegionalRivalry: 7,
    ClientRealignment: 8,
    FalseFlag: 8,
    MakeExample: 9,
    Coup: 10,
    Invade: 11
  };

  function isTerritoryState(value){
    return value
      && typeof value === 'object'
      && typeof value.family === 'string'
      && typeof value.type === 'string'
      && typeof value.wealth === 'number'
      && typeof value.happiness === 'number';
  }

  function cloneTerritories(state){
    const out = {};
    Object.keys(state).forEach(k=>{
      if(isTerritoryState(state[k])) out[k] = Object.assign({}, state[k]);
    });
    return out;
  }

  function clamp(v, min, max){ if(v == null) return v; if(min != null) v = Math.max(min, v); if(max != null) v = Math.min(max, v); return v; }

  function normalizeSpend(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function createSeededRandom(seed){
    let value = 2166136261;
    String(seed).split('').forEach(ch=>{
      value ^= ch.charCodeAt(0);
      value = Math.imul(value, 16777619) >>> 0;
    });
    return function(){
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function randomFromOptions(options){
    if(options && typeof options.rng === 'function') return options.rng;
    if(options && options.seed != null) return createSeededRandom(options.seed);
    return function(){ return Math.random(); };
  }

  function resourceList(data, field){
    const value = data && data[field];
    if(Array.isArray(value)) return value;
    if(typeof value === 'string') return value.split('/').map(v=>v.trim()).filter(Boolean);
    return [];
  }

  function availableResourcesFor(key, state){
    const data = state[key];
    const resources = new Set(resourceList(data, 'resources'));
    Object.keys(state).forEach(otherKey=>{
      if(otherKey === key) return;
      const other = state[otherKey];
      if(!other || other.type !== 'Client') return;
      if(other.clientOf !== data.family || (other.defiance || 0) > 0) return;
      resourceList(other, 'resources').forEach(r=>resources.add(r));
    });
    return resources;
  }

  function missingResourcesFor(key, state){
    const needs = resourceList(state[key], 'resourceNeeds');
    const available = availableResourcesFor(key, state);
    return needs.filter(need=>!available.has(need));
  }

  function resolveResourcePressure(state){
    const logs = [];
    const newState = cloneTerritories(state);

    Object.keys(newState).forEach(key=>{
      const data = newState[key];
      if(isEliminated(data)) return;
      const missing = missingResourcesFor(key, newState);
      if(missing.length === 0) return;
      const wealthLoss = missing.length * 5 + (missing.includes('Oil') ? (data.armies || 0) : 0);
      const developmentLoss = missing.length * 2;
      const happinessLoss = missing.length * 2;
      data.wealth = clamp((data.wealth || 0) - wealthLoss, 0);
      data.development = clamp((data.development || 0) - developmentLoss, 0);
      data.happiness = clamp((data.happiness || 0) - happinessLoss, 0);
      logs.push(`${key} lacks ${missing.join(', ')} (-${wealthLoss} wealth, -${developmentLoss} development, -${happinessLoss} happiness)`);
    });

    return { newState, logs };
  }

  function resolveSentiment(state){
    const logs = [];
    const newState = cloneTerritories(state);

    Object.keys(newState).forEach(key=>{
      const data = newState[key];
      if(isEliminated(data)) return;

      let independenceDelta = 0;
      if(data.type === 'Client'){
        independenceDelta += (data.defiance || 0) * 5;
        if((data.happiness || 0) >= 120) independenceDelta += 5;
      }

      let governanceDelta = 0;
      if((data.happiness || 0) < 60) governanceDelta += 5;
      if((data.stash || 0) > (data.happiness || 0)) governanceDelta += 5;
      if((data.education || 0) >= 70 && (data.happiness || 0) < 90) governanceDelta += 3;
      governanceDelta -= Math.floor((data.fear || 0) / 25);
      if(data.type === 'Client' && (data.education || 0) >= 70 && (data.happiness || 0) >= 100) independenceDelta += 3;

      data.independenceSentiment = clamp((data.independenceSentiment || 0) + independenceDelta, 0, 100);
      data.governanceChangeSentiment = clamp((data.governanceChangeSentiment || 0) + governanceDelta, 0, 100);

      if(independenceDelta || governanceDelta){
        logs.push(`${key} sentiment changed (independence ${independenceDelta >= 0 ? '+' : ''}${independenceDelta}, governance ${governanceDelta >= 0 ? '+' : ''}${governanceDelta})`);
      }
    });

    return { newState, logs };
  }

  function clampField(field, value){
    const maxByField = {
      happiness: 200,
      education: 150,
      development: 150,
      independenceSentiment: 100,
      governanceChangeSentiment: 100,
      factionalDivision: 100,
      fear: 100
    };
    return clamp(value, 0, maxByField[field]);
  }

  function applyDelta(data, field, delta){
    if(!delta) return;
    data[field] = clampField(field, (data[field] || 0) + delta);
  }

  function crisisTargetKeys(crisis, state){
    const targeting = crisis.targeting || {};
    if(crisis.target && state[crisis.target]) return [crisis.target];
    if(targeting.territory && state[targeting.territory]) return [targeting.territory];

    const keys = Object.keys(state).filter(key=>isTerritoryState(state[key]) && !isEliminated(state[key]));
    switch(targeting.scope || (crisis.id === 'global_austerity' ? 'all' : 'territory')){
      case 'all':
        return keys;
      case 'clients':
        return keys.filter(key=>state[key].type === 'Client');
      case 'defiantClients':
        return keys.filter(key=>state[key].type === 'Client' && (state[key].defiance || 0) > 0);
      case 'resourceNeed':
        return keys.filter(key=>resourceList(state[key], 'resourceNeeds').includes(targeting.resource));
      case 'resourceHolder':
        return keys.filter(key=>resourceList(state[key], 'resources').includes(targeting.resource));
      case 'highestDebt': {
        const highest = Math.max(...keys.map(key=>state[key].debt || 0));
        return keys.filter(key=>(state[key].debt || 0) === highest).slice(0, 1);
      }
      case 'highestFactionalDivision': {
        const highest = Math.max(...keys.map(key=>state[key].factionalDivision || 0));
        return keys.filter(key=>(state[key].factionalDivision || 0) === highest).slice(0, 1);
      }
      default:
        return keys.filter(key=>key === targeting.territory);
    }
  }

  function applyCrisisEffect(data, effect){
    const fieldMap = {
      wealth_delta: 'wealth',
      happiness_delta: 'happiness',
      development_delta: 'development',
      education_delta: 'education',
      defiance_delta: 'defiance',
      defiance_increase: 'defiance',
      blackBudget_delta: 'blackBudget',
      socialCapital_delta: 'socialCapital',
      politicalCapital_delta: 'politicalCapital',
      independenceSentiment_delta: 'independenceSentiment',
      factionalDivision_delta: 'factionalDivision',
      governanceChangeSentiment_delta: 'governanceChangeSentiment',
      fear_delta: 'fear',
      debt_delta: 'debt'
    };
    Object.keys(fieldMap).forEach(key=>{
      if(Object.prototype.hasOwnProperty.call(effect, key)) applyDelta(data, fieldMap[key], effect[key]);
    });
  }

  function applyCrisis(state, crisis){
    const logs = [];
    const newState = cloneTerritories(state);
    if(!crisis || !crisis.id) return { newState, logs };

    logs.push(`Applying crisis card: ${crisis.id}`);
    const targets = crisisTargetKeys(crisis, newState);
    if(targets.length === 0){
      logs.push(`Crisis ${crisis.id} had no legal targets`);
      return { newState, logs };
    }

    targets.forEach(key=>{
      const data = newState[key];
      applyCrisisEffect(data, crisis.effect || {});
      if(crisis.id === 'global_austerity' || (crisis.effect && Array.isArray(crisis.effect.vulnerableResourceNeeds))){
        const vulnerableNeeds = crisis.effect && crisis.effect.vulnerableResourceNeeds || ['Grain', 'Finance'];
        const missing = missingResourcesFor(key, newState);
        if(vulnerableNeeds.some(resource=>missing.includes(resource))){
          applyDelta(data, 'happiness', crisis.effect && crisis.effect.vulnerability_happiness_delta || -5);
        }
      }
      logs.push(`${key} affected by ${crisis.id}`);
    });

    if(crisis.escalation) logs.push(`Escalation pressure: ${crisis.escalation}`);
    return { newState, logs };
  }

  function spendFraming(actorState, requested, actionName, logs){
    const requestedSpend = normalizeSpend(requested);
    if(requestedSpend <= 0) return 0;
    const available = actorState.socialCapital || 0;
    const spend = Math.min(requestedSpend, available);
    actorState.socialCapital = available - spend;
    logs.push(`${actionName}: spent ${spend} Social Capital on framing`);
    return spend;
  }

  function isEliminated(data){
    return data.family === 'Anarchy' || data.family === 'Collapsed' || data.outcome === 'Lost';
  }

  function markOutcome(logs, key, data, outcome, reason){
    if(data.outcome) return;
    data.outcome = outcome;
    logs.push(`${outcome}: ${key} - ${reason}`);
  }

  function actionRoleOrder(entry, state){
    const data = state[entry.family] || {};
    return ROLE_ORDER[data.type] == null ? 99 : ROLE_ORDER[data.type];
  }

  function actionPriority(action){
    return ACTION_PRIORITY[action] == null ? 50 : ACTION_PRIORITY[action];
  }

  function compareActions(a, b, state){
    const aState = state[a.family] || {};
    const bState = state[b.family] || {};
    return ((aState.wealth || 0) - (bState.wealth || 0))
      || (actionRoleOrder(a, state) - actionRoleOrder(b, state))
      || (actionPriority(a.action) - actionPriority(b.action))
      || String(a.family).localeCompare(String(b.family))
      || (a.order - b.order);
  }

  function evaluateObjectives(state){
    const logs = [];
    const newState = cloneTerritories(state);
    const entries = Object.entries(newState);
    const activeEntries = entries.filter(([, data]) => !isEliminated(data));
    const activeClients = activeEntries.filter(([, data]) => data.type === 'Client');
    const defiantClients = activeClients.filter(([, data]) => (data.defiance || 0) > 0);
    const clientDefianceMajority = activeClients.length > 0 && defiantClients.length >= Math.ceil(activeClients.length / 2);
    const allClientsCompliant = activeClients.length > 0 && defiantClients.length === 0;

    entries.forEach(([key, data])=>{
      if(data.family === 'Anarchy' || data.family === 'Collapsed'){
        markOutcome(logs, key, data, 'Lost', 'family control collapsed');
        return;
      }

      if(data.type === 'Head' && clientDefianceMajority){
        markOutcome(logs, key, data, 'Lost', 'a majority of active clients are defiant');
      } else if(data.type === 'Regional' && (data.happiness || 0) <= 20){
        markOutcome(logs, key, data, 'Lost', 'domestic happiness collapsed');
      } else if(data.type === 'Client' && ((data.wealth || 0) <= 0 || (data.happiness || 0) <= 0)){
        markOutcome(logs, key, data, 'Lost', 'client wealth or happiness collapsed');
      }

      if(data.outcome === 'Lost') return;

      if(data.type === 'Head' && (data.wealth || 0) >= OBJECTIVES.headWealthWin && allClientsCompliant){
        markOutcome(logs, key, data, 'Won', 'hierarchy is stable and head wealth target is met');
      } else if(data.type === 'Regional' && (data.wealth || 0) >= OBJECTIVES.regionalWealthWin && (data.politicalCapital || 0) >= OBJECTIVES.regionalPoliticalWin){
        markOutcome(logs, key, data, 'Won', 'regional wealth and political power targets are met');
      } else if(data.type === 'Client' && (data.defiance || 0) > 0 && (data.happiness || 0) >= OBJECTIVES.clientHappinessWin && (data.development || 0) >= OBJECTIVES.clientDevelopmentWin && (data.independenceSentiment || 0) >= OBJECTIVES.clientIndependenceWin){
        markOutcome(logs, key, data, 'Won', 'defiant client built a successful good example');
      }
    });

    return { newState, logs };
  }

  function areRelatedClients(sourceKey, source, targetKey, target){
    if(!source || !target || sourceKey === targetKey) return false;
    if(target.type !== 'Client') return false;
    const sourceNeighbors = Array.isArray(source.neighbors) ? source.neighbors : [];
    const targetNeighbors = Array.isArray(target.neighbors) ? target.neighbors : [];
    return source.clientOf === target.clientOf || sourceNeighbors.includes(targetKey) || targetNeighbors.includes(sourceKey);
  }

  function applyDefianceContagion(currentState, originalState){
    const logs = [];
    const newState = cloneTerritories(currentState);
    const H_THRESHOLD = 120;

    Object.keys(newState).forEach(sourceKey=>{
      const orig = originalState[sourceKey] || {};
      const source = newState[sourceKey];
      if(!source || source.type !== 'Client') return;

      const goodExample = (orig.happiness || 0) < H_THRESHOLD && (source.happiness || 0) >= H_THRESHOLD;
      const defianceBreakout = (orig.defiance || 0) < 3 && (source.defiance || 0) >= 3;
      const successfulBreakaway = source.outcome === 'Won' && orig.outcome !== 'Won';
      if(!goodExample && !defianceBreakout && !successfulBreakaway) return;

      Object.keys(newState).forEach(targetKey=>{
        const target = newState[targetKey];
        if(!areRelatedClients(sourceKey, source, targetKey, target)) return;
        target.defiance = (target.defiance || 0) + 1;
        logs.push(`Contagion: ${targetKey} defiance +1 due to ${sourceKey}`);
      });
    });

    return { newState, logs };
  }

  function findOverlordTerritory(state, client){
    if(!client || !client.clientOf) return null;
    if(state[client.clientOf]) return state[client.clientOf];
    const key = Object.keys(state).find(k=>state[k] && state[k].family === client.clientOf);
    return key ? state[key] : null;
  }

  function applyUnansweredDefiancePressure(state){
    const logs = [];
    const newState = cloneTerritories(state);

    Object.keys(newState).forEach(key=>{
      const client = newState[key];
      if(!client || client.type !== 'Client' || (client.defiance || 0) <= 0) return;
      const overlord = findOverlordTerritory(newState, client);
      if(!overlord) return;
      overlord.socialCapital = clamp((overlord.socialCapital || 0) - 5, 0);
      overlord.politicalCapital = clamp((overlord.politicalCapital || 0) - 5, 0);
      logs.push(`${client.clientOf} loses 5 Social Capital and 5 Political Capital for unanswered defiance in ${key}`);
    });

    return { newState, logs };
  }

  function applyComebackPressure(state){
    const logs = [];
    const newState = cloneTerritories(state);
    const runawayHeads = Object.keys(newState).filter(key=>{
      const data = newState[key];
      return data.type === 'Head' && !isEliminated(data) && (data.wealth || 0) >= OBJECTIVES.headRunawayWealth;
    });

    runawayHeads.forEach(headKey=>{
      const head = newState[headKey];
      head.socialCapital = clamp((head.socialCapital||0) - 6, 0);
      Object.keys(newState).forEach(key=>{
        const data = newState[key];
        if(isEliminated(data) || key === headKey) return;
        if(data.type === 'Client' && data.clientOf === head.family){
          data.defiance = (data.defiance||0) + 1;
          data.independenceSentiment = clamp((data.independenceSentiment||0) + 5, 0, 100);
        } else if(data.type === 'Regional'){
          data.politicalCapital = (data.politicalCapital||0) + 4;
          data.rivalryPressure = (data.rivalryPressure||0) + 2;
        }
      });
      logs.push(`Comeback pressure: ${headKey} runaway wealth strains the hierarchy`);
    });

    return { newState, logs };
  }

  function resolveTurn(state, actions, options){
    const logs = [];
    const random = randomFromOptions(options);
    let newState = cloneTerritories(state);
    const original = cloneTerritories(state);
    if(options && options.seed != null) logs.push(`Using replay seed: ${options.seed}`);

    // apply crisis card if present on state.crisis
    if(state.crisis && state.crisis.id){
      const crisisResult = applyCrisis(newState, state.crisis);
      newState = crisisResult.newState;
      logs.push(...crisisResult.logs);
    }

    // normalize targets, default Self -> actor
    const normalized = actions.map(a=> ({
      family: a.family,
      action: a.action || 'Pass',
      target: (a.target === 'Self' || !a.target) ? a.family : a.target,
      framing: normalizeSpend(a.framing),
      order: a.order || 0
    }));

    normalized.forEach((entry, index)=>{ entry.order = index; });
    normalized.sort((a,b)=>compareActions(a, b, newState));
    logs.push('Resolving actions (wealth, role, action priority, family id)');

    normalized.forEach(entry=>{
      const actor = entry.family; const act = entry.action; const target = entry.target || actor;
      logs.push(`${actor} => ${act} -> ${target}`);
      const A = newState[actor]; const T = newState[target];
      if(!A){ logs.push(`WARN: actor ${actor} missing in state`); return; }

      // Check if actor is eliminated
      if(A.family === 'Anarchy' || A.family === 'Collapsed'){
        logs.push(`${actor} is in ${A.family} and cannot act.`);
        return;
      }

      switch(act){
        case 'Skim':{
          const amt = 10;
          if(T){ const transferred = Math.min(amt, T.wealth||0); T.wealth = clamp((T.wealth||0) - transferred, 0); A.stash = (A.stash||0) + transferred; T.happiness = clamp((T.happiness||0) - 6, 0); logs.push(`${actor} skimmed ${transferred} from ${target}`); }
          break;
        }
        case 'Propaganda':{
          const cost = 8;
          if((A.stash||0) < cost){ logs.push(`${actor} failed Propaganda (insufficient stash)`); }
          else { A.stash -= cost; if(T){ T.happiness = (T.happiness||0) + 10; logs.push(`${actor} spent ${cost} on propaganda for ${target}`); } }
          break;
        }
        case 'Invade':{
          if(T){
            const wealthCost = 12;
            const armyCost = 1;
            if((A.armies||0) < armyCost){ logs.push(`${actor} failed Invade (insufficient armies)`); break; }
            if((A.wealth||0) < wealthCost){ logs.push(`${actor} failed Invade (insufficient wealth)`); break; }
            const framing = spendFraming(A, entry.framing, 'Invade', logs);
            const happinessLoss = Math.max(8, 25 - framing);
            const socialPenalty = Math.max(0, 15 - Math.floor(framing / 2));
            A.wealth = clamp((A.wealth||0) - wealthCost, 0);
            A.armies = clamp((A.armies||0) - armyCost, 0);
            A.politicalCapital = (A.politicalCapital||0) + 5;
            T.invaded = true;
            T.protected = false;
            T.protectedBy = null;
            T.happiness = clamp((T.happiness||0) - happinessLoss, 0);
            T.wealth = clamp((T.wealth||0) - 10, 0);
            T.fear = clamp((T.fear||0) + 10, 0, 100);
            T.governanceChangeSentiment = clamp((T.governanceChangeSentiment||0) + 8, 0, 100);
            if(T.type === 'Client') T.defiance = (T.defiance||0) + 1;
            A.socialCapital = clamp((A.socialCapital||0) - socialPenalty, 0);
            logs.push(`${actor} invaded ${target}${framing > 0 ? ' with framing' : ' without framing'} (-${wealthCost} wealth, -${armyCost} army, -${happinessLoss} happiness, -${socialPenalty} backlash)`);
          }
          break;
        }
        case 'Sanction':{
          if(!T){ logs.push(`${actor} attempted Sanction against missing target ${target}`); break; }
          const cost = 5;
          if((A.politicalCapital||0) < cost){ logs.push(`${actor} failed Sanction (insufficient Political Capital)`); break; }
          const loss = Math.min(18, T.wealth||0);
          A.politicalCapital = clamp((A.politicalCapital||0) - cost, 0);
          A.wealth = (A.wealth||0) + Math.floor(loss * 0.25);
          T.wealth = clamp((T.wealth||0) - loss, 0);
          T.happiness = clamp((T.happiness||0) - 12, 0);
          T.development = clamp((T.development||0) - 5, 0, 150);
          T.governanceChangeSentiment = clamp((T.governanceChangeSentiment||0) + 5, 0, 100);
          T.sanctioned = true;
          logs.push(`${actor} sanctioned ${target} (-${loss} wealth, -12 happiness, -5 development)`);
          break;
        }
        case 'Protect':{
          if(!T){ logs.push(`${actor} attempted Protect against missing target ${target}`); break; }
          const stashCost = 6;
          const wealthCost = 8;
          if((A.stash||0) < stashCost){ logs.push(`${actor} failed Protect (insufficient stash)`); }
          else if((A.wealth||0) < wealthCost){ logs.push(`${actor} failed Protect (insufficient wealth)`); }
          else {
            A.stash = clamp((A.stash||0) - stashCost, 0);
            A.wealth = clamp((A.wealth||0) - wealthCost, 0);
            A.politicalCapital = (A.politicalCapital||0) + 5;
            T.protected = true;
            T.protectedBy = A.family;
            T.happiness = clamp((T.happiness||0) + 8, 0, 200);
            T.fear = clamp((T.fear||0) - 5, 0, 100);
            if(T.type === 'Client' && T.clientOf && T.clientOf !== A.family){
              T.defiance = (T.defiance||0) + 1;
              T.independenceSentiment = clamp((T.independenceSentiment||0) + 5, 0, 100);
            }
            logs.push(`${actor} protected ${target} (-${wealthCost} wealth, -${stashCost} stash)`);
          }
          break;
        }
        case 'TributeHoliday':{
          if(!T){ logs.push(`${actor} attempted TributeHoliday against missing target ${target}`); break; }
          if(T.type !== 'Client'){ logs.push(`${actor} failed TributeHoliday (${target} is not a client)`); break; }
          if(T.clientOf !== A.family){ logs.push(`${actor} failed TributeHoliday (${target} is not their client)`); break; }
          const cost = 8;
          if((A.wealth||0) < cost){ logs.push(`${actor} failed TributeHoliday (insufficient wealth)`); break; }
          A.wealth = clamp((A.wealth||0) - cost, 0);
          A.socialCapital = (A.socialCapital||0) + 4;
          T.tributeHoliday = Math.max(T.tributeHoliday || 0, 1);
          T.happiness = clamp((T.happiness||0) + 6, 0, 200);
          T.defiance = Math.max(0, (T.defiance||0) - 1);
          logs.push(`${actor} grants ${target} a tribute holiday`);
          break;
        }
        case 'ProtectionDeal':{
          if(!T){ logs.push(`${actor} attempted ProtectionDeal against missing target ${target}`); break; }
          const stashCost = 4;
          const wealthCost = 6;
          if((A.stash||0) < stashCost){ logs.push(`${actor} failed ProtectionDeal (insufficient stash)`); break; }
          if((A.wealth||0) < wealthCost){ logs.push(`${actor} failed ProtectionDeal (insufficient wealth)`); break; }
          A.stash = clamp((A.stash||0) - stashCost, 0);
          A.wealth = clamp((A.wealth||0) - wealthCost, 0);
          A.politicalCapital = (A.politicalCapital||0) + 4;
          T.protected = true;
          T.protectedBy = A.family;
          T.protectionDeal = Math.max(T.protectionDeal || 0, 2);
          T.happiness = clamp((T.happiness||0) + 6, 0, 200);
          if(T.type === 'Client' && T.clientOf && T.clientOf !== A.family){
            T.realignmentPressure = (T.realignmentPressure||0) + 8;
            T.defiance = (T.defiance||0) + 1;
          }
          logs.push(`${actor} signs a protection deal with ${target}`);
          break;
        }
        case 'ClientRealignment':{
          if(!T){ logs.push(`${actor} attempted ClientRealignment against missing target ${target}`); break; }
          if(T.type !== 'Client'){ logs.push(`${actor} failed ClientRealignment (${target} is not a client)`); break; }
          const cost = 12;
          const eligible = (T.defiance||0) > 0 || (T.independenceSentiment||0) >= 50 || (T.realignmentPressure||0) >= 8;
          if(!eligible){ logs.push(`${actor} failed ClientRealignment (${target} is not ready to realign)`); break; }
          if((A.politicalCapital||0) < cost){ logs.push(`${actor} failed ClientRealignment (insufficient Political Capital)`); break; }
          const oldOverlord = T.clientOf || 'none';
          A.politicalCapital = clamp((A.politicalCapital||0) - cost, 0);
          A.socialCapital = clamp((A.socialCapital||0) - 4, 0);
          T.clientOf = A.family;
          T.protected = true;
          T.protectedBy = A.family;
          T.realignmentPressure = 0;
          T.defiance = 0;
          T.happiness = clamp((T.happiness||0) + 4, 0, 200);
          T.independenceSentiment = clamp((T.independenceSentiment||0) + 10, 0, 100);
          logs.push(`${actor} realigns ${target} from ${oldOverlord} to ${A.family}`);
          break;
        }
        case 'RegionalRivalry':{
          if(!T){ logs.push(`${actor} attempted RegionalRivalry against missing target ${target}`); break; }
          if(A.type !== 'Regional' || T.type !== 'Regional' || actor === target){ logs.push(`${actor} failed RegionalRivalry (requires a rival regional target)`); break; }
          const cost = 6;
          if((A.politicalCapital||0) < cost){ logs.push(`${actor} failed RegionalRivalry (insufficient Political Capital)`); break; }
          A.politicalCapital = clamp((A.politicalCapital||0) - cost, 0);
          A.rivalryPressure = (A.rivalryPressure||0) + 4;
          T.rivalryPressure = (T.rivalryPressure||0) + 10;
          T.politicalCapital = clamp((T.politicalCapital||0) - 10, 0);
          T.factionalDivision = clamp((T.factionalDivision||0) + 8, 0, 100);
          logs.push(`${actor} escalates regional rivalry with ${target}`);
          break;
        }
        case 'DebtShakedown':{
          if(!T){ logs.push(`${actor} attempted DebtShakedown against missing target ${target}`); break; }
          const cost = 8;
          if((A.politicalCapital||0) < cost){ logs.push(`${actor} failed DebtShakedown (insufficient Political Capital)`); break; }
          const collected = Math.min(20, T.wealth||0);
          A.politicalCapital = clamp((A.politicalCapital||0) - cost, 0);
          A.wealth = (A.wealth||0) + collected;
          T.wealth = clamp((T.wealth||0) - collected, 0);
          T.debt = (T.debt||0) + collected;
          T.happiness = clamp((T.happiness||0) - 12, 0);
          T.governanceChangeSentiment = clamp((T.governanceChangeSentiment||0) + 7, 0, 100);
          if(T.type === 'Client') T.defiance = (T.defiance||0) + 1;
          logs.push(`${actor} forced debt payments from ${target} (+${collected} wealth, target debt +${collected})`);
          break;
        }
        case 'EconomicExploitation':{
          if(!T){ logs.push(`${actor} attempted EconomicExploitation against missing target ${target}`); break; }
          const cost = 4;
          if((A.socialCapital||0) < cost){ logs.push(`${actor} failed EconomicExploitation (insufficient Social Capital)`); break; }
          const extracted = Math.min(12, T.wealth||0);
          A.socialCapital = clamp((A.socialCapital||0) - cost, 0);
          A.wealth = (A.wealth||0) + extracted;
          A.stash = (A.stash||0) + Math.floor(extracted / 2);
          T.wealth = clamp((T.wealth||0) - extracted, 0);
          T.development = clamp((T.development||0) - 8, 0, 150);
          T.happiness = clamp((T.happiness||0) - 8, 0);
          T.governanceChangeSentiment = clamp((T.governanceChangeSentiment||0) + 6, 0, 100);
          if(T.type === 'Client') T.defiance = (T.defiance||0) + 1;
          logs.push(`${actor} exploited ${target} (+${extracted} wealth, +${Math.floor(extracted / 2)} stash)`);
          break;
        }
        case 'Educate':{
          const cost = 8;
          if((A.wealth||0) < cost){
            logs.push(`${actor} failed Educate (insufficient wealth)`);
          } else {
            A.wealth = clamp((A.wealth||0) - cost, 0);
            A.education = clamp((A.education||0) + 10, 0, 150);
            A.development = clamp((A.development||0) + 3, 0, 150);
            A.governanceChangeSentiment = clamp((A.governanceChangeSentiment||0) + 2, 0, 100);
            if(A.type === 'Client') A.independenceSentiment = clamp((A.independenceSentiment||0) + 2, 0, 100);
            logs.push(`${actor} invested in education (+10 education, +3 development)`);
          }
          break;
        }
        case 'Develop':{
          const cost = 10;
          const available = availableResourcesFor(actor, newState);
          if((A.wealth||0) < cost){
            logs.push(`${actor} failed Develop (insufficient wealth)`);
          } else if(!available.has('Industry') && !available.has('Technology')){
            logs.push(`${actor} failed Develop (requires Industry or Technology access)`);
          } else {
            A.wealth = clamp((A.wealth||0) - cost + 5, 0);
            A.development = clamp((A.development||0) + 10, 0, 150);
            A.happiness = clamp((A.happiness||0) + 3, 0, 200);
            logs.push(`${actor} invested in development (+10 development, +3 happiness)`);
          }
          break;
        }
        case 'Coup':{
          // success probability depends on political capital comparison
          if(!T){ logs.push(`${actor} attempted coup against missing target ${target}`); break; }
          const coupCost = 10;
          if((A.blackBudget||0) < coupCost){ logs.push(`${actor} failed Coup (insufficient Black Budget)`); break; }
          A.blackBudget = (A.blackBudget||0) - coupCost;
          const framing = spendFraming(A, entry.framing, 'Coup', logs);
          const ap = (A.politicalCapital||0); const tp = (T.politicalCapital||0);
          const sentimentPressure = ((T.governanceChangeSentiment||0) + (T.factionalDivision||0) - (T.fear||0)) / 300.0;
          let base = 0.5 + (ap - tp) / 200.0 + sentimentPressure; base = clamp(base, 0.1, 0.95);
          const roll = random();
          if(roll < base){
            // successful coup: replace target's family control (simplified)
            T.family = A.family || T.family;
            T.happiness = clamp((T.happiness||0) - 20, 0);
            A.socialCapital = clamp((A.socialCapital||0) - Math.max(0, 25 - framing), 0);
            A.politicalCapital = (A.politicalCapital||0) + 10;
            logs.push(`${actor} successfully executed a coup against ${target}`);
          } else {
            // failed coup
            A.politicalCapital = clamp((A.politicalCapital||0) - 15, 0);
            A.socialCapital = clamp((A.socialCapital||0) - Math.max(0, 20 - framing), 0);
            logs.push(`${actor} failed coup against ${target}`);
          }
          break;
        }
        case 'FalseFlag':{
          const cost = 8;
          if((A.blackBudget||0) < cost){ logs.push(`${actor} failed FalseFlag (insufficient Black Budget)`); }
          else { A.blackBudget = (A.blackBudget||0) - cost; A.socialCapital = (A.socialCapital||0) + 50; logs.push(`${actor} performed a FalseFlag - Black Budget -${cost}, socialCapital +50`); }
          break;
        }
        case 'CovertInfluence':{
          const cost = 6;
          if(!T){ logs.push(`${actor} attempted CovertInfluence against missing target ${target}`); break; }
          if((A.blackBudget||0) < cost){ logs.push(`${actor} failed CovertInfluence (insufficient Black Budget)`); }
          else { A.blackBudget = (A.blackBudget||0) - cost; T.defiance = (T.defiance||0) + 1; A.politicalCapital = (A.politicalCapital||0) + 5; logs.push(`${actor} used CovertInfluence on ${target} (defiance +1, politicalCapital +5)`); }
          break;
        }
        case 'MakeExample':{
          if(!T){ logs.push(`${actor} attempted MakeExample against missing target ${target}`); break; }
          if((T.defiance||0) <= 0){ logs.push(`${actor} failed MakeExample (${target} is not defiant)`); break; }
          T.defiance = 0;
          T.happiness = clamp((T.happiness||0) - 20, 0);
          A.socialCapital = clamp((A.socialCapital||0) - 10, 0);
          A.politicalCapital = (A.politicalCapital||0) + 5;
          logs.push(`${actor} made an example of ${target} (defiance reset, happiness -20)`);
          break;
        }
        case 'Concession':{
          if(!T){ logs.push(`${actor} attempted Concession against missing target ${target}`); break; }
          if((T.defiance||0) <= 0){ logs.push(`${actor} failed Concession (${target} is not defiant)`); break; }
          const cost = 10;
          if((A.wealth||0) < cost){ logs.push(`${actor} failed Concession (insufficient wealth)`); break; }
          A.wealth = clamp((A.wealth||0) - cost, 0);
          A.politicalCapital = clamp((A.politicalCapital||0) - 5, 0);
          A.socialCapital = (A.socialCapital||0) + 5;
          T.defiance = 0;
          T.happiness = (T.happiness||0) + 10;
          logs.push(`${actor} granted concessions to ${target} (defiance reset, happiness +10)`);
          break;
        }
        case 'Pass': default: logs.push(`${actor} passed`); break;
      }

      // clamp common values
      if(T){ T.wealth = clamp(T.wealth, 0); T.happiness = clamp(T.happiness, 0); T.debt = clamp(T.debt || 0, 0); T.defiance = Math.max(0, T.defiance || 0); }
      A.wealth = clamp(A.wealth, 0); A.stash = clamp(A.stash, 0); A.blackBudget = clamp(A.blackBudget, 0); A.socialCapital = clamp(A.socialCapital, 0); A.politicalCapital = clamp(A.politicalCapital, 0); A.armies = clamp(A.armies, 0); A.education = clamp(A.education, 0, 150); A.development = clamp(A.development, 0, 150); A.debt = clamp(A.debt || 0, 0);
    });

    const pressureResult = applyUnansweredDefiancePressure(newState);
    newState = pressureResult.newState;
    logs.push(...pressureResult.logs);

    const objectiveResult = evaluateObjectives(newState);
    newState = objectiveResult.newState;
    logs.push(...objectiveResult.logs);

    const contagionResult = applyDefianceContagion(newState, original);
    newState = contagionResult.newState;
    logs.push(...contagionResult.logs);

    const finalObjectives = evaluateObjectives(newState);
    return { newState: finalObjectives.newState, logs: logs.concat(finalObjectives.logs) };
  }

  function resolveCleanup(state, options){
    const logs = [];
    const random = randomFromOptions(options);
    const newState = cloneTerritories(state);
    if(options && options.seed != null) logs.push(`Using replay seed: ${options.seed}`);

    logs.push('--- Phase 4: The Heat (Cleanup) ---');

    Object.keys(newState).forEach(family => {
      const data = newState[family];
      // Skip if not a valid territory object
      if(!data || typeof data.happiness === 'undefined') return;

      // Skip if already eliminated
      if(data.family === 'Anarchy' || data.family === 'Collapsed') return;

      // 1. Capital Checks (Zero Tolerance)
      // Design: "When any of their capital values reach zero they lose"
      if((data.stash||0) <= 0){
        logs.push(`☠️ GAME OVER for ${family}: Personal Capital (Stash) hit zero.`);
        data.family = 'Collapsed';
      } else if((data.politicalCapital||0) <= 0){
        logs.push(`☠️ GAME OVER for ${family}: Political Capital hit zero.`);
        data.family = 'Collapsed';
      } else if((data.socialCapital||0) <= 0){
        logs.push(`☠️ GAME OVER for ${family}: Social Capital hit zero.`);
        data.family = 'Collapsed';
      }

      if(data.family === 'Collapsed'){
        data.wealth = 0;
        data.stash = 0;
        return;
      }

      data.protectionDeal = Math.max(0, (data.protectionDeal || 0) - 1);
      data.realignmentPressure = Math.max(0, (data.realignmentPressure || 0) - 1);
      data.rivalryPressure = Math.max(0, (data.rivalryPressure || 0) - 1);

      // 2. Uprising Check: Happiness < Personal Capital (Stash)
      if((data.happiness || 0) < (data.stash || 0)){
        // Design: "If you fail, your people revolt." (Simulated with 50% chance)
        if(random() < 0.5){
          logs.push(`☠️ UPRISING in ${family}! Happiness (${data.happiness}) < Stash (${data.stash}). The Family falls!`);
          data.family = 'Anarchy';
          data.stash = 0;
          data.wealth = 0;
          data.invaded = false;
        } else {
          logs.push(`⚠️ Unrest in ${family} (Happiness < Stash), but the regime holds.`);
        }
      }
    });

    const resourceResult = resolveResourcePressure(newState);
    const sentimentResult = resolveSentiment(resourceResult.newState);
    const comebackResult = applyComebackPressure(sentimentResult.newState);
    const objectiveResult = evaluateObjectives(comebackResult.newState);
    return { newState: objectiveResult.newState, logs: logs.concat(resourceResult.logs, sentimentResult.logs, comebackResult.logs, objectiveResult.logs) };
  }

  function resolveTribute(state){
    const logs = [];
    const newState = cloneTerritories(state);
    logs.push('--- Phase 2: The Tribute ---');

    Object.keys(newState).forEach(key => {
      const t = newState[key];
      // Skip if not a valid territory or has no family
      if(!t || !t.family) return;

      // If territory is Head or Regional, it doesn't pay tribute
      if(t.type === 'Head' || t.type === 'Regional') return;

      // Skip if eliminated
      if(t.family === 'Anarchy' || t.family === 'Collapsed') return;

      // Determine who they pay (Default to 'USA' for prototype)
      const overlord = t.clientOf || 'USA';

      if((t.tributeHoliday||0) > 0){
        t.tributeHoliday = Math.max(0, (t.tributeHoliday||0) - 1);
        logs.push(`Tribute holiday: ${t.family} (in ${key}) skips tribute to ${overlord}`);
        return;
      }

      // Check for Defiance
      if(t.defiance && t.defiance > 0){
        logs.push(`🚫 ${t.family} (in ${key}) REFUSES tribute to ${overlord}! (Defiance: ${t.defiance})`);
        return;
      }

      // Calculate Tribute: 20% of Wealth
      const amount = Math.floor((t.wealth || 0) * 0.20);

      if(amount > 0){
        // Deduct from client
        t.wealth = (t.wealth || 0) - amount;

        // Add to overlord. Find a territory owned by the overlord to receive funds.
        let overlordTerritory = newState[overlord]; // Try direct key match
        if(!overlordTerritory){
            const overlordKey = Object.keys(newState).find(k => newState[k] && newState[k].family === overlord);
            if(overlordKey) overlordTerritory = newState[overlordKey];
        }

        if(overlordTerritory){
          overlordTerritory.wealth = (overlordTerritory.wealth || 0) + amount;
          logs.push(`💸 ${t.family} (in ${key}) pays ${amount} tribute to ${overlord}`);
        } else {
          logs.push(`💸 ${t.family} (in ${key}) pays ${amount} tribute (Overlord ${overlord} has no territory)`);
        }
      }
    });

    return { newState, logs };
  }

  function resolveCard(state, cardId, actor, target){
    const logs = [];
    const newState = cloneTerritories(state);
    const A = newState[actor];
    const T = newState[target]; // target might be null if Self

    logs.push(`🃏 ${actor} plays ${cardId} on ${target||'Self'}`);

    switch(cardId){
      case 'promoting_democracy':
        if(A){ A.socialCapital = (A.socialCapital||0) + 20; logs.push(`${actor} gains +20 Social Capital`); }
        break;
      case 'media_blitz':
        if(A){
            A.socialCapital = (A.socialCapital||0) + 15;
            A.politicalCapital = (A.politicalCapital||0) + 5;
            logs.push(`${actor} runs a Media Blitz (+15 Social Capital, +5 Political Capital)`);
        }
        break;
      case 'humanitarian_airlift':
        if(A && T){
            T.happiness = clamp((T.happiness||0) + 15, 0, 200);
            A.socialCapital = (A.socialCapital||0) + 5;
            logs.push(`${actor} sends a Humanitarian Airlift to ${target}`);
        }
        break;
      case 'patriotic_rally':
        if(A){
            A.politicalCapital = (A.politicalCapital||0) + 10;
            A.fear = clamp((A.fear||0) + 5, 0, 100);
            A.happiness = clamp((A.happiness||0) - 3, 0, 200);
            logs.push(`${actor} stages a Patriotic Rally (+10 Political Capital, +5 fear)`);
        }
        break;
      case 'rotten_apple':
        if(T){
            const lost = Math.floor((T.happiness||0) * 0.5);
            T.happiness = (T.happiness||0) - lost;
            logs.push(`${target} loses ${lost} Happiness`);
        }
        break;
      case 'structural_adjustment':
        if(A && T){
            const amt = 10;
            const stolen = Math.min(amt, T.education||0);
            T.education = (T.education||0) - stolen;
            A.wealth = (A.wealth||0) + stolen;
            logs.push(`${actor} drains ${stolen} Education from ${target}`);
        }
        break;
      case 'debt_trap':
        if(A && T){
            const debt = 15;
            T.debt = (T.debt||0) + debt;
            T.happiness = clamp((T.happiness||0) - 5, 0, 200);
            A.wealth = (A.wealth||0) + 10;
            logs.push(`${actor} traps ${target} in debt (+${debt} debt)`);
        }
        break;
      case 'protection_pact':
        if(A && T){
            const cost = 5;
            if((A.stash||0) < cost){ logs.push(`${actor} failed Protection Pact (insufficient stash)`); break; }
            A.stash = clamp((A.stash||0) - cost, 0);
            A.politicalCapital = (A.politicalCapital||0) + 5;
            T.protected = true;
            T.protectedBy = A.family;
            T.happiness = clamp((T.happiness||0) + 6, 0, 200);
            logs.push(`${actor} signs a Protection Pact with ${target}`);
        }
        break;
      case 'resource_contract':
        if(A && T){
            const extracted = Math.min(8, T.wealth||0);
            A.wealth = (A.wealth||0) + extracted;
            T.wealth = clamp((T.wealth||0) - extracted, 0);
            T.development = clamp((T.development||0) - 4, 0, 150);
            T.governanceChangeSentiment = clamp((T.governanceChangeSentiment||0) + 4, 0, 100);
            logs.push(`${actor} extracts ${extracted} wealth through a Resource Contract`);
        }
        break;
      case 'false_flag':
        if(A){
            if((A.blackBudget||0) < 8){ logs.push(`${actor} failed False Flag (insufficient Black Budget)`); break; }
            A.blackBudget = Math.max(0, (A.blackBudget||0) - 8);
            A.socialCapital = (A.socialCapital||0) + 50;
            logs.push(`${actor} pays 8 Black Budget for +50 Social Capital`);
        }
        break;
      case 'covert_files':
        if(T){
            T.governanceChangeSentiment = clamp((T.governanceChangeSentiment||0) + 10, 0, 100);
            T.factionalDivision = clamp((T.factionalDivision||0) + 5, 0, 100);
            logs.push(`${actor} leaks Covert Files on ${target}`);
        }
        break;
      case 'kompromat':
        if(A && T){
            T.politicalCapital = clamp((T.politicalCapital||0) - 12, 0);
            A.politicalCapital = (A.politicalCapital||0) + 5;
            logs.push(`${actor} uses Kompromat against ${target}`);
        }
        break;
      case 'counterintelligence':
        if(A){
            A.blackBudget = (A.blackBudget||0) + 6;
            A.factionalDivision = clamp((A.factionalDivision||0) - 8, 0, 100);
            logs.push(`${actor} runs Counterintelligence (+6 Black Budget, -8 factional division)`);
        }
        break;
      case 'sanctions_package':
        if(A && T){
            A.socialCapital = clamp((A.socialCapital||0) - 3, 0);
            T.wealth = clamp((T.wealth||0) - 12, 0);
            T.happiness = clamp((T.happiness||0) - 8, 0, 200);
            T.sanctioned = true;
            logs.push(`${actor} plays a Sanctions Package on ${target}`);
        }
        break;
      case 'proxy_network':
        if(A && T){
            const cost = 5;
            if((A.blackBudget||0) < cost){ logs.push(`${actor} failed Proxy Network (insufficient Black Budget)`); break; }
            A.blackBudget = clamp((A.blackBudget||0) - cost, 0);
            T.defiance = (T.defiance||0) + 2;
            T.factionalDivision = clamp((T.factionalDivision||0) + 8, 0, 100);
            logs.push(`${actor} activates a Proxy Network in ${target}`);
        }
        break;
      case 'retaliation_strike':
        if(A && T){
            const cost = 6;
            if((A.blackBudget||0) < cost){ logs.push(`${actor} failed Retaliation Strike (insufficient Black Budget)`); break; }
            A.blackBudget = clamp((A.blackBudget||0) - cost, 0);
            A.socialCapital = clamp((A.socialCapital||0) - 8, 0);
            T.wealth = clamp((T.wealth||0) - 10, 0);
            T.fear = clamp((T.fear||0) + 8, 0, 100);
            logs.push(`${actor} launches a Retaliation Strike against ${target}`);
        }
        break;
      case 'offshore_haven':
        if(A){
            A.stash = (A.stash||0) + 20;
            logs.push(`${actor} moves funds to Offshore Haven (+20 Stash)`);
        }
        break;
      default:
        logs.push(`Effect for ${cardId} not implemented.`);
    }
    return { newState, logs };
  }

  window.Rules = { ROUND_PHASES, createSeededRandom, resolveTurn, resolveCleanup, resolveTribute, resolveCard, evaluateObjectives, applyCrisis, applyDefianceContagion, applyUnansweredDefiancePressure, applyComebackPressure, resolveResourcePressure, resolveSentiment };
})();
