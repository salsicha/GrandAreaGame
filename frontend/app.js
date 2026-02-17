// Load map SVG and territories metadata, then wire interactions
const state = {};
let selected = null;

function q(id){return document.getElementById(id)}

function log(msg){
  const d = document.createElement('div'); d.textContent = msg; q('log').prepend(d);
}

async function loadJSON(path){
  const r = await fetch(path);
  return r.json();
}

async function loadMap(){
  // load default map.svg and process it
  const svgText = await fetch('map.svg').then(r=>r.text());
  processSVG(svgText);
}

function processSVG(svgText){
  const container = q('map-container');
  container.innerHTML = svgText;
  // Attach handlers to elements that either have data-country or can be mapped by id
  document.querySelectorAll('[data-country], [id]').forEach(el=>{
    // normalize: prefer existing data-country attribute
    if(!el.dataset.country){
      // leave id mapping for later (mapping.json)
    }
    el.classList.add('territory');
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=>selectTerritory(el));
    // hover tooltip & highlight
    el.addEventListener('mouseenter', (ev)=>{ el.classList.add('hovered'); showTooltipFor(el, ev); });
    el.addEventListener('mousemove', (ev)=>{ moveTooltip(ev); });
    el.addEventListener('mouseleave', ()=>{ el.classList.remove('hovered'); hideTooltip(); });
  });
  // try to apply mapping.json if present
  fetch('data/mapping.json').then(r=>{ if(!r.ok) throw new Error('no mapping'); return r.json() }).then(map=>{
    Object.entries(map).forEach(([svgId, territoryKey])=>{
      const el = document.getElementById(svgId);
      if(el){ el.dataset.country = territoryKey; }
    });
  }).catch(()=>{/* no mapping.json provided — ok */});
}

function getTooltipEl(){ return q('tooltip'); }

function showTooltipFor(el, ev){
  const tooltip = getTooltipEl();
  const country = el.dataset.country || el.id || 'Unknown';
  const data = state[country] || {};
  tooltip.querySelector('.title').textContent = country;
  q('tt-family').textContent = data.family || '—';
  q('tt-resources').textContent = data.resources || '—';
  q('tt-wealth').textContent = data.wealth != null ? data.wealth : '—';
  q('tt-happiness').textContent = data.happiness != null ? data.happiness : '—';
  tooltip.style.display = 'block';
  moveTooltip(ev);
  tooltip.setAttribute('aria-hidden','false');
}

function moveTooltip(ev){
  const tooltip = getTooltipEl();
  if(!tooltip || tooltip.style.display==='none') return;
  const container = q('map-container');
  const rect = container.getBoundingClientRect();
  // position relative to container
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip(){ const t = getTooltipEl(); if(t){ t.style.display='none'; t.setAttribute('aria-hidden','true'); } }

function updatePanel(country){
  const data = state[country];
  q('country-name').textContent = country;
  const el = document.querySelector(`[data-country="${country}"]`);
  q('family').textContent = el ? el.dataset.family || data.family : data.family;
  q('resources').textContent = el ? el.dataset.resources || data.resources : data.resources;
  q('wealth').textContent = data.wealth;
  q('happiness').textContent = data.happiness;
  q('stash').textContent = data.stash;
}

function selectTerritory(el){
  const country = el.dataset.country;
  selected = country;
  document.querySelectorAll('[data-country]').forEach(t=>t.style.opacity = (t===el?1:0.9));
  updatePanel(country);
  log(`Selected ${country}`);
}

function wireButtons(){
  q('action-skim').addEventListener('click', ()=>{
    if(!selected){alert('Select a territory first');return}
    const t = state[selected];
    const amount = 10;
    t.wealth = Math.max(0, t.wealth - amount);
    t.stash += amount;
    t.happiness = Math.max(0, t.happiness - 6);
    updatePanel(selected);
    log(`${selected}: Skimmed ${amount} → stash now ${t.stash}`);
  });

  q('action-prop').addEventListener('click', ()=>{
    if(!selected){alert('Select a territory first');return}
    const t = state[selected];
    const cost = 8;
    if(t.stash < cost){ log(`${selected}: Not enough stash for propaganda`); return }
    t.stash -= cost; t.happiness = Math.min(200, t.happiness + 10);
    updatePanel(selected);
    log(`${selected}: Spent ${cost} on propaganda → happiness ${t.happiness}`);
  });

  q('action-invade').addEventListener('click', ()=>{
    if(!selected){alert('Select a territory first');return}
    const t = state[selected];
    t.invaded = !t.invaded;
    const el = document.querySelector(`[data-country="${selected}"]`);
    if(t.invaded){ el.classList.add('invaded'); log(`${selected}: Invaded — public outrage +15`); t.happiness = Math.max(0, t.happiness - 15);} 
    else { el.classList.remove('invaded'); log(`${selected}: Invasion withdrawn`); }
    updatePanel(selected);
  });
}

// Legend & animation controls
function renderLegend(){
  // nothing dynamic for now; buttons wired in init
}

function pulseTerritories(filterFn, duration=3000){
  const matches = Array.from(document.querySelectorAll('[data-country]')).filter(el=>{
    const key = el.dataset.country || el.id;
    const s = state[key];
    return s && filterFn(s, key);
  });
  matches.forEach(el=> el.classList.add('pulse'));
  setTimeout(()=>{ matches.forEach(el=> el.classList.remove('pulse')); }, duration);
}


async function init(){
  const data = await loadJSON('data/territories.json');
  // copy into state
  Object.keys(data).forEach(k=> state[k] = Object.assign({}, data[k], {invaded:false}));
  // load crisis deck
  try{ const crisis = await loadJSON('data/crisis.json'); state.crisisDeck = { drawPile: crisis.slice(), discard: [] }; } catch(e){ state.crisisDeck = { drawPile: [], discard: [] }; }
  await loadMap();
  // game flow state
  state.pendingActions = {}; // family -> {action,target,locked}
  state.locks = {};
  state.submissions = {}; // family -> {sealed:true, revealed:false}
  window.game = { round: 1, phaseIndex: 2, phases: ['Crisis','Tribute','Action Submission','Resolution'] };
  renderPlayersList();
  wireButtons();
  // wire upload control
  q('upload-svg').addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const text = await f.text();
    processSVG(text);
    log(`Loaded SVG from ${f.name}`);
  });
  q('load-default').addEventListener('click', ()=>{ loadMap(); });
  // crisis deck buttons
  q('shuffle-deck').addEventListener('click', ()=>{ shuffleDeck(); });
  q('draw-card').addEventListener('click', ()=>{ drawCard(); });
  q('discard-card').addEventListener('click', ()=>{ discardCurrent(); });
  renderCrisisUI();
  // legend buttons
  const toggle = q('toggle-legend');
  const legend = q('legend');
  toggle.addEventListener('click', ()=>{
    if(legend.style.display==='none'){ legend.style.display='block'; toggle.textContent='Hide Legend' }
    else { legend.style.display='none'; toggle.textContent='Show Legend' }
  });
  q('pulse-low').addEventListener('click', ()=>{
    pulseTerritories((s)=> (s.happiness||0) < 80, 3500);
  });
  q('pulse-invaded').addEventListener('click', ()=>{
    pulseTerritories((s)=> s.invaded === true, 3500);
  });
  // select first available territory
  const first = document.querySelector('[data-country]');
  if(first) selectTerritory(first);
}

// ------------------ Crisis deck functions ------------------
function shuffleDeck(){
  const deck = state.crisisDeck;
  if(!deck) return;
  // Fisher-Yates
  for(let i = deck.drawPile.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const tmp = deck.drawPile[i]; deck.drawPile[i] = deck.drawPile[j]; deck.drawPile[j] = tmp; }
  log('Crisis deck shuffled');
  renderCrisisUI();
}

function drawCard(){
  const deck = state.crisisDeck;
  if(!deck || deck.drawPile.length === 0){ log('No cards to draw'); return; }
  const card = deck.drawPile.shift();
  deck.current = card;
  // apply to state so rules engine can use it
  state.crisis = card;
  log(`Drew crisis card: ${card.title}`);
  renderCrisisUI();
}

function discardCurrent(){
  const deck = state.crisisDeck;
  if(!deck || !deck.current){ log('No current card to discard'); return; }
  deck.discard.push(deck.current);
  log(`Discarded crisis: ${deck.current.title}`);
  delete deck.current; delete state.crisis;
  renderCrisisUI();
}

function renderCrisisUI(){
  const cur = state.crisisDeck && state.crisisDeck.current;
  const el = q('current-crisis');
  const desc = q('current-crisis-desc');
  if(!el) return;
  if(cur){ el.querySelector('strong').textContent = cur.title; desc.textContent = cur.description || '';} else { el.querySelector('strong').textContent = 'No card drawn'; desc.textContent = ''; }
  // show counts
  const pileCount = (state.crisisDeck && state.crisisDeck.drawPile.length) || 0;
  const discCount = (state.crisisDeck && state.crisisDeck.discard.length) || 0;
  const meta = el.querySelector('.meta') || document.createElement('div'); meta.className = 'meta'; meta.textContent = `Deck: ${pileCount} · Discard: ${discCount}`;
  if(!el.querySelector('.meta')) el.appendChild(meta);
}

// ----------------------- Turn manager functions -----------------------
function idFromKey(key){ return `p_${key.replace(/\W+/g,'_')}` }

const ACTIONS = ['Pass','Skim','Propaganda','Invade','Sanction','Protect','Coup','FalseFlag'];

function renderPlayersList(){
  const container = q('players-list');
  container.innerHTML = '';
  // ensure view-as selector exists and is populated
  const viewAs = q('view-as');
  if(viewAs){
    const current = viewAs.value;
    viewAs.innerHTML = '';
    Object.keys(state).forEach(k=>{ if(k==='pendingActions' || k==='locks' || k==='submissions') return; const o=document.createElement('option'); o.value=k; o.textContent=k; viewAs.appendChild(o); });
    if(current) viewAs.value = current;
  }
  Object.keys(state).forEach(family=>{
    if(family === 'pendingActions' || family === 'locks') return;
    if(family === 'submissions') return;
    const row = document.createElement('div'); row.className='player-row'; row.id = idFromKey(family);
    const name = document.createElement('div'); name.className='name'; name.textContent = family;
    const actionSel = document.createElement('select'); actionSel.id = `action-${idFromKey(family)}`;
    ACTIONS.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; actionSel.appendChild(o); });
    const targetSel = document.createElement('select'); targetSel.id = `target-${idFromKey(family)}`;
    // targets: self + all territories
    const selfOpt = document.createElement('option'); selfOpt.value = 'Self'; selfOpt.textContent='Self'; targetSel.appendChild(selfOpt);
    Object.keys(state).forEach(k=>{ if(k==='pendingActions' || k==='locks') return; const o=document.createElement('option'); o.value=k; o.textContent=k; targetSel.appendChild(o); });
    const lockBtn = document.createElement('button'); lockBtn.textContent='Lock'; lockBtn.id = `lock-${idFromKey(family)}`;
    const submitBtn = document.createElement('button'); submitBtn.textContent='Submit Secret'; submitBtn.id = `submit-${idFromKey(family)}`;

    // if already submitted, reflect that
    const submitted = state.submissions && state.submissions[family];
    const viewer = (q('view-as') && q('view-as').value) || null;
    if(submitted){
      submitBtn.textContent = submitted.revealed ? `Submitted` : `Submitted`;
    }

    // restore existing pending action if any
    const pending = state.pendingActions[family];
    if(pending){ actionSel.value = pending.action || 'Pass'; targetSel.value = pending.target || 'Self'; if(pending.locked){ row.classList.add('locked'); lockBtn.textContent='Unlock'; actionSel.disabled=true; targetSel.disabled=true } }

    actionSel.addEventListener('change', ()=> submitAction(family, actionSel.value, targetSel.value));
    targetSel.addEventListener('change', ()=> submitAction(family, actionSel.value, targetSel.value));
    lockBtn.addEventListener('click', ()=>{ toggleLock(family, actionSel, targetSel, lockBtn, row); });
    submitBtn.addEventListener('click', ()=>{ submitSecret(family, actionSel, targetSel, submitBtn, row); });

    // if someone else submitted and viewer is not that family, hide their action selects
    if(state.submissions && state.submissions[family] && viewer && viewer !== family){
      const badge = document.createElement('div'); badge.textContent = 'Submitted'; badge.style.fontWeight='600'; row.appendChild(name); row.appendChild(badge);
    } else {
      row.appendChild(name); row.appendChild(actionSel); row.appendChild(targetSel); row.appendChild(lockBtn); row.appendChild(submitBtn);
    }
    container.appendChild(row);
  });
  q('round-num').textContent = window.game.round;
  q('phase-name').textContent = window.game.phases[window.game.phaseIndex];
}

function submitAction(family, action, target){
  state.pendingActions[family] = { action, target, locked: state.pendingActions[family] ? state.pendingActions[family].locked : false };
  log(`${family}: selected action ${action} → ${target}`);
}

function toggleLock(family, actionSel, targetSel, lockBtn, rowEl){
  const pending = state.pendingActions[family] || {action:'Pass', target:'Self', locked:false};
  const newLocked = !pending.locked;
  pending.locked = newLocked;
  state.pendingActions[family] = pending;
  if(newLocked){ rowEl.classList.add('locked'); lockBtn.textContent='Unlock'; actionSel.disabled=true; targetSel.disabled=true; log(`${family}: locked action`); }
  else { rowEl.classList.remove('locked'); lockBtn.textContent='Lock'; actionSel.disabled=false; targetSel.disabled=false; log(`${family}: unlocked action`); }
}

function submitSecret(family, actionSel, targetSel, submitBtn, rowEl){
  const action = actionSel.value || 'Pass';
  const target = targetSel.value || 'Self';
  // basic validation: require a target when action is not Pass
  if(action !== 'Pass' && !target){ alert('Select a target'); return; }
  // store the pending action (kept hidden in UI)
  state.pendingActions[family] = { action, target, locked: true };
  state.submissions = state.submissions || {};
  state.submissions[family] = { sealed: true, revealed: false, time: Date.now() };
  // update UI: disable selects and lock button
  actionSel.disabled = true; targetSel.disabled = true; submitBtn.textContent = 'Submitted'; rowEl.classList.add('locked');
  log(`${family}: secret action submitted`);
  // re-render players list so other viewers see 'Submitted'
  renderPlayersList();
}

function advancePhase(){
  window.game.phaseIndex = (window.game.phaseIndex + 1) % window.game.phases.length;
  q('phase-name').textContent = window.game.phases[window.game.phaseIndex];
  log(`Phase → ${window.game.phases[window.game.phaseIndex]}`);
}

function resetRound(){
  state.pendingActions = {};
  state.locks = {};
  // unlock UI rows
  document.querySelectorAll('.player-row').forEach(r=>{ r.classList.remove('locked'); r.querySelectorAll('select').forEach(s=>s.disabled=false); const b=r.querySelector('button'); if(b) b.textContent='Lock'; });
  log('Round reset — pending actions cleared');
}

function revealAndResolve(){
  // if not all submitted, warn and ask for confirmation
  const families = Object.keys(state).filter(k=> k!=='pendingActions' && k!=='locks' && k!=='submissions');
  const submittedCount = families.filter(f=> state.submissions && state.submissions[f]).length;
  if(submittedCount < families.length){ if(!confirm(`Only ${submittedCount}/${families.length} players submitted secret actions. Reveal anyway?`)) return; }

  // collect actions, default to Pass if missing
  const actions = families.map(k=>({ family:k, action: (state.pendingActions[k] && state.pendingActions[k].action) || 'Pass', target: (state.pendingActions[k] && state.pendingActions[k].target) || 'Self' }));
  // send actions to rules engine
  if(!window.Rules || !window.Rules.resolveTurn){ alert('Rules engine not available'); return; }
  const result = window.Rules.resolveTurn(state, actions);
  // apply newState into live state object
  Object.keys(result.newState).forEach(k=>{
    state[k] = Object.assign(state[k] || {}, result.newState[k]);
  });
  // mark submissions as revealed
  Object.keys(state.submissions || {}).forEach(f=>{ if(state.submissions[f]) state.submissions[f].revealed = true; });
  // show engine logs
  result.logs.forEach(line=> log(line));
  // update map visuals
  Object.keys(state).forEach(k=>{ if(k==='pendingActions' || k==='locks' || k==='submissions') return; const el = document.querySelector(`[data-country="${k}"]`); if(el){ if(state[k].invaded) el.classList.add('invaded'); else el.classList.remove('invaded'); } });
  // advance round and reset phase
  window.game.round += 1; window.game.phaseIndex = 0; q('round-num').textContent = window.game.round; q('phase-name').textContent = window.game.phases[window.game.phaseIndex];
  // clear pending actions after resolution
  state.pendingActions = {};
  // re-render players UI to clear locks and show revealed state
  renderPlayersList();
  log('Resolution complete');
}


init().catch(e=>{console.error(e); q('map-container').textContent = 'Failed to load map';});
