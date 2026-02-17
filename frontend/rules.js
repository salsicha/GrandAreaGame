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

  window.Rules = { resolveTurn };
})();
