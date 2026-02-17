/*
  Simple rules engine for GrandArea prototype.
  Exposes window.Rules.resolveTurn(state, actions)
  - state: current game state object (territory keys -> {wealth,happiness,stash,invaded,...})
  - actions: array of { family, action, target }
  Returns: { newState, logs }

  This engine produces a new shallow-copied state for territories (does not clone metadata like pendingActions).
  It's intentionally small and synchronous for use in the browser prototype.
*/
(function(){
  function cloneTerritories(state){
    const out = {};
    Object.keys(state).forEach(k=>{
      if(k === 'pendingActions' || k === 'locks' || k === 'submissions') return;
      out[k] = Object.assign({}, state[k]);
    });
    return out;
  }

  function clamp(v, min, max){ if(v == null) return v; if(min != null) v = Math.max(min, v); if(max != null) v = Math.min(max, v); return v; }

  function resolveTurn(state, actions){
    const logs = [];
    const newState = cloneTerritories(state);
    const original = cloneTerritories(state);

    // apply crisis card if present on state.crisis (simple built-in handlers)
    if(state.crisis && state.crisis.id){
      logs.push(`Applying crisis card: ${state.crisis.id}`);
      switch(state.crisis.id){
        case 'global_austerity':
          Object.keys(newState).forEach(k=>{ newState[k].happiness = clamp((newState[k].happiness||0) + (state.crisis.effect && state.crisis.effect.happiness_delta || -10), 0); });
          logs.push('All territories: happiness adjusted by crisis');
          break;
        case 'guatemala1954':
          const tgt = state.crisis.target || 'Africa';
          if(newState[tgt]){ newState[tgt].defiance = (newState[tgt].defiance||0) + (state.crisis.effect && state.crisis.effect.defiance_increase || 1); logs.push(`${tgt} defiance increased by crisis`); }
          break;
        default:
          logs.push('Unknown crisis card effect');
      }
    }

    // normalize targets, default Self -> actor
    const normalized = actions.map(a=> ({ family:a.family, action:a.action || 'Pass', target: (a.target === 'Self' || !a.target) ? a.family : a.target }));

    // order: weakest (lowest wealth) first
    normalized.sort((a,b)=> (newState[a.family].wealth||0) - (newState[b.family].wealth||0));
    logs.push('Resolving actions (weakest → strongest)');

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

      // helper: violent action requires benevolent cover (socialCapital)
      const requireCover = (actionName)=>{
        const coverNeeded = 20;
        if((A.socialCapital||0) < coverNeeded){ logs.push(`${actor} lacks benevolent cover for ${actionName} (socialCapital ${(A.socialCapital||0)})`); return false; }
        return true;
      };

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
          if(!requireCover('Invade')){ // insufficient cover -> harsher backlash
            if(T){ T.happiness = clamp((T.happiness||0) - 25, 0); A.socialCapital = clamp((A.socialCapital||0) - 15, 0); logs.push(`${actor} invaded ${target} without cover — heavy backlash`); }
          } else {
            if(T){ T.invaded = true; T.happiness = clamp((T.happiness||0) - 15, 0); A.socialCapital = clamp((A.socialCapital||0) - 10, 0); logs.push(`${actor} invaded ${target}`); }
          }
          break;
        }
        case 'Sanction':{
          if(T){ const loss = Math.min(15, T.wealth||0); T.wealth = clamp((T.wealth||0) - loss, 0); A.wealth = (A.wealth||0) + Math.floor(loss * 0.2); T.happiness = clamp((T.happiness||0) - 10, 0); logs.push(`${actor} sanctioned ${target} (-${loss} wealth)`); }
          break;
        }
        case 'Protect':{
          const cost = 6;
          if((A.stash||0) < cost){ logs.push(`${actor} failed Protect (insufficient stash)`); }
          else { A.stash -= cost; if(T){ T.happiness = (T.happiness||0) + 8; logs.push(`${actor} protected ${target}`); } }
          break;
        }
        case 'Coup':{
          // success probability depends on political capital comparison
          if(!T){ logs.push(`${actor} attempted coup against missing target ${target}`); break; }
          const ap = (A.politicalCapital||0); const tp = (T.politicalCapital||0);
          let base = 0.5 + (ap - tp) / 200.0; base = clamp(base, 0.1, 0.95);
          const roll = Math.random();
          if(roll < base){
            // successful coup: replace target's family control (simplified)
            T.family = A.family || T.family;
            T.happiness = clamp((T.happiness||0) - 20, 0);
            A.socialCapital = clamp((A.socialCapital||0) - 25, 0);
            A.politicalCapital = (A.politicalCapital||0) + 10;
            logs.push(`${actor} successfully executed a coup against ${target}`);
          } else {
            // failed coup
            A.politicalCapital = clamp((A.politicalCapital||0) - 15, 0);
            A.socialCapital = clamp((A.socialCapital||0) - 20, 0);
            logs.push(`${actor} failed coup against ${target}`);
          }
          break;
        }
        case 'FalseFlag':{
          // Sacrifice small wealth to increase social cover (Benevolent Cover)
          const cost = 10;
          if((A.wealth||0) < cost){ logs.push(`${actor} failed FalseFlag (insufficient wealth)`); }
          else { A.wealth = clamp((A.wealth||0) - cost, 0); A.socialCapital = (A.socialCapital||0) + 50; logs.push(`${actor} performed a FalseFlag — socialCapital +50`); }
          break;
        }
        case 'Pass': default: logs.push(`${actor} passed`); break;
      }

      // clamp common values
      if(T){ T.wealth = clamp(T.wealth, 0); T.happiness = clamp(T.happiness, 0); T.defiance = Math.max(0, T.defiance || 0); }
      A.wealth = clamp(A.wealth, 0); A.stash = clamp(A.stash, 0); A.socialCapital = clamp(A.socialCapital, 0); A.politicalCapital = clamp(A.politicalCapital, 0);
    });

    // Contagion: if any client territory crossed a happiness threshold upward, increase defiance on other clients
    const H_THRESHOLD = 120;
    Object.keys(newState).forEach(k=>{
      const orig = original[k]; const cur = newState[k];
      if(!orig || !cur) return;
      // treat 'Client' family as prone to contagion
      if((orig.family === 'Client' || cur.family === 'Client') && (orig.happiness || 0) < H_THRESHOLD && (cur.happiness || 0) >= H_THRESHOLD){
        // contagion effect
        Object.keys(newState).forEach(o=>{
          if(o===k) return;
          if(newState[o] && newState[o].family === 'Client'){
            newState[o].defiance = (newState[o].defiance||0) + 1;
            logs.push(`Contagion: ${o} defiance +1 due to ${k}`);
          }
        });
      }
    });

    return { newState, logs };
  }

  function resolveCleanup(state){
    const logs = [];
    const newState = cloneTerritories(state);

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

      // 2. Uprising Check: Happiness < Personal Capital (Stash)
      if((data.happiness || 0) < (data.stash || 0)){
        // Design: "If you fail, your people revolt." (Simulated with 50% chance)
        if(Math.random() < 0.5){
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

    return { newState, logs };
  }

  function resolveTribute(state){
    const logs = [];
    const newState = cloneTerritories(state);
    logs.push('--- Phase 2: The Tribute ---');

    // Define hierarchy for prototype (Head Families do not pay tribute)
    const HEAD_FAMILIES = ['USA', 'China', 'Russia', 'EU', 'UK']; 
    
    Object.keys(newState).forEach(key => {
      const t = newState[key];
      // Skip if not a valid territory or has no family
      if(!t || !t.family) return;
      
      // If family is a Head Family, they don't pay tribute
      if(t.type === 'Head' || t.type === 'Regional' || HEAD_FAMILIES.includes(t.family)) return;
      
      // Skip if eliminated
      if(t.family === 'Anarchy' || t.family === 'Collapsed') return;

      // Determine who they pay (Default to 'USA' for prototype)
      const overlord = t.clientOf || 'USA'; 
      
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
            const stolen = Math.min(amt, T.wealth||0);
            T.wealth = (T.wealth||0) - stolen;
            A.wealth = (A.wealth||0) + stolen;
            logs.push(`${actor} drains ${stolen} Wealth from ${target}`);
        }
        break;
      case 'false_flag':
        if(A){
            A.wealth = Math.max(0, (A.wealth||0) - 10);
            A.socialCapital = (A.socialCapital||0) + 50;
            logs.push(`${actor} pays 10 Wealth for +50 Social Capital`);
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

  window.Rules = { resolveTurn, resolveCleanup, resolveTribute, resolveCard };
})();
