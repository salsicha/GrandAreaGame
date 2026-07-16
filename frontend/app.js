// Load map SVG and territories metadata, then wire interactions
const ROUND_PHASES = ['Crisis','Tribute','Secret Action Submission','Reveal','Narrative Battle','Resolution','Cleanup'];
const gameState = {
  territories: {},
  runtime: {
    crisisDeck: { drawPile: [], discard: [] },
    crisis: null,
    cardDefs: [],
    hands: {},
    deck: [],
    pendingActions: {},
    locks: {},
    submissions: {}
  },
  ui: { selected: null },
  round: 1,
  phaseIndex: 2,
  phases: ROUND_PHASES.slice()
};
const state = gameState.territories;

function q(id){return document.getElementById(id)}

function log(msg){
  const d = document.createElement('div'); d.textContent = msg; q('log').prepend(d);
}

function notify(message, kind='info'){
  const el = q('notice');
  if(!el) return;
  el.textContent = message;
  el.className = kind === 'error' ? 'error' : '';
}

function confirmAction(message, onConfirm){
  const dialog = q('confirm-dialog');
  q('confirm-message').textContent = message;
  dialog.hidden = false;
  const yes = q('confirm-yes');
  const no = q('confirm-no');
  const cleanup = () => {
    dialog.hidden = true;
    yes.onclick = null;
    no.onclick = null;
  };
  yes.onclick = () => { cleanup(); onConfirm(); };
  no.onclick = cleanup;
  yes.focus();
}

function isTerritoryState(value){
  return value
    && typeof value === 'object'
    && typeof value.family === 'string'
    && typeof value.type === 'string'
    && typeof value.wealth === 'number'
    && typeof value.happiness === 'number';
}

function territoryKeys(){
  return Object.keys(state).filter(k=>isTerritoryState(state[k]));
}

function currentRulesState(){
  const rulesState = Object.assign({}, state);
  if(gameState.runtime.crisis) rulesState.crisis = gameState.runtime.crisis;
  return rulesState;
}

function formatResources(resources){
  return Array.isArray(resources) ? resources.join('/') : (resources || '—');
}

async function loadJSON(path){
  const r = await fetch(path);
  return r.json();
}

async function loadMap(){
  // load default map.svg and process it
  const svgText = await fetch('map.svg').then(r=>r.text());
  await processSVG(svgText);
}

async function processSVG(svgText){
  const container = q('map-container');
  container.innerHTML = svgText;
  await applyTerritoryMapping(container);
  bindTerritoryElements(container);
  applyOverlay();
}

async function applyTerritoryMapping(container){
  try{
    const r = await fetch('data/mapping.json');
    if(!r.ok) return;
    const map = await r.json();
    const elementsById = new Map(Array.from(container.querySelectorAll('[id]')).map(el=>[el.id, el]));
    Object.entries(map).forEach(([svgId, territoryKey])=>{
      const el = elementsById.get(svgId);
      if(el){ el.dataset.country = territoryKey; }
    });
  } catch(e){
    // no mapping.json provided — ok
  }
}

function bindTerritoryElements(container){
  container.querySelectorAll('[data-country]').forEach(el=>{
    el.classList.add('territory');
    el.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      selectTerritory(el);
    });
    // hover tooltip & highlight
    el.addEventListener('mouseenter', (ev)=>{ el.classList.add('hovered'); showTooltipFor(el, ev); });
    el.addEventListener('mousemove', (ev)=>{ moveTooltip(ev); });
    el.addEventListener('mouseleave', ()=>{ el.classList.remove('hovered'); hideTooltip(); });
  });
}

function getTooltipEl(){ return q('tooltip'); }

function showTooltipFor(el, ev){
  const tooltip = getTooltipEl();
  const country = el.dataset.country || el.id || 'Unknown';
  const data = state[country] || {};
  tooltip.querySelector('.title').textContent = country;
  q('tt-family').textContent = (data.family || '—') + (data.type === 'Client' ? ` → ${data.clientOf}` : '');
  q('tt-resources').textContent = formatResources(data.resources);
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
  if(!data){ notify(`No territory data for ${country}.`, 'error'); return; }
  q('country-name').textContent = country;
  const el = document.querySelector(`[data-country="${country}"]`);
  const famName = el ? el.dataset.family || data.family : data.family;
  q('family').textContent = famName;
  q('role').textContent = data.type || '—';
  q('client-of').textContent = data.type === 'Client' ? (data.clientOf || '—') : '—';
  q('resources').textContent = el ? el.dataset.resources || formatResources(data.resources) : formatResources(data.resources);
  q('wealth').textContent = data.wealth;
  q('happiness').textContent = data.happiness;
  q('stash').textContent = data.stash;
  q('black-budget').textContent = data.blackBudget;
  q('social-capital').textContent = data.socialCapital;
  q('political-capital').textContent = data.politicalCapital;
  q('education').textContent = data.education;
  q('development').textContent = data.development;
  q('defiance').textContent = data.defiance > 0 ? `${data.defiance}` : 'No';
}

function selectTerritory(el){
  const country = el.dataset.country;
  gameState.ui.selected = country;
  document.querySelectorAll('[data-country]').forEach(t=>{
    t.classList.toggle('selected', t === el);
    t.classList.toggle('dimmed', t !== el);
  });
  updatePanel(country);
  log(`Selected ${country}`);
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

const OVERLAY_CLASSES = [
  'overlay-head',
  'overlay-regional',
  'overlay-client',
  'overlay-owner-0',
  'overlay-owner-1',
  'overlay-owner-2',
  'overlay-owner-3',
  'overlay-owner-4',
  'overlay-resource',
  'overlay-happiness-high',
  'overlay-happiness-mid',
  'overlay-happiness-low',
  'overlay-defiant',
  'overlay-clear',
  'invaded',
  'sanctioned',
  'protected'
];

function ownerIndex(family){
  const owners = uniqueFamilies();
  return Math.max(0, owners.indexOf(family)) % 5;
}

function uniqueFamilies(){
  return Array.from(new Set(territoryKeys().map(k=>state[k].family))).sort();
}

function overlayClassFor(data, mode){
  if(!data) return 'overlay-clear';
  if(mode === 'owner') return `overlay-owner-${ownerIndex(data.family)}`;
  if(mode === 'resource') return (data.resources && data.resources.length) ? 'overlay-resource' : 'overlay-clear';
  if(mode === 'happiness'){
    if((data.happiness||0) >= 100) return 'overlay-happiness-high';
    if((data.happiness||0) >= 70) return 'overlay-happiness-mid';
    return 'overlay-happiness-low';
  }
  if(mode === 'defiance') return (data.defiance||0) > 0 ? 'overlay-defiant' : 'overlay-clear';
  if(mode === 'invaded') return data.invaded ? 'invaded' : 'overlay-clear';
  if(mode === 'sanctioned') return data.sanctioned ? 'sanctioned' : 'overlay-clear';
  if(mode === 'protected') return data.protected ? 'protected' : 'overlay-clear';
  if(data.type === 'Head') return 'overlay-head';
  if(data.type === 'Regional') return 'overlay-regional';
  return 'overlay-client';
}

function applyOverlay(){
  const mode = q('overlay-mode') ? q('overlay-mode').value : 'role';
  document.querySelectorAll('[data-country]').forEach(el=>{
    OVERLAY_CLASSES.forEach(cls=>el.classList.remove(cls));
    const key = el.dataset.country;
    el.classList.add(overlayClassFor(state[key], mode));
    el.classList.toggle('invaded', !!(state[key] && state[key].invaded));
    el.classList.toggle('sanctioned', !!(state[key] && state[key].sanctioned));
    el.classList.toggle('protected', !!(state[key] && state[key].protected));
  });
}


async function init(){
  const data = await loadJSON('data/territories.json');
  // copy into state
  Object.keys(data).forEach(k=> {
    const s = Object.assign({}, data[k], {invaded:false});
    if(s.type === 'Client' && !s.clientOf) throw new Error(`${k} is a Client territory without clientOf`);
    state[k] = s;
  });

  // load crisis deck
  try{ const crisis = await loadJSON('data/crisis.json'); gameState.runtime.crisisDeck = { drawPile: crisis.slice(), discard: [] }; } catch(e){ gameState.runtime.crisisDeck = { drawPile: [], discard: [] }; }
  // load player cards
  try{ gameState.runtime.cardDefs = await loadJSON('data/playercards.json'); } catch(e){ gameState.runtime.cardDefs=[]; }
  // load balance knobs (hand limit etc.)
  try{ gameState.runtime.balance = await loadJSON('data/balance.json'); } catch(e){ gameState.runtime.balance = null; }
  initDeck();

  await loadMap();
  // game flow state
  gameState.runtime.pendingActions = {}; // family -> {action,target,locked}
  gameState.runtime.locks = {};
  gameState.runtime.submissions = {}; // family -> {sealed:true, revealed:false}
  window.game = gameState;
  renderPlayersList();
  // wire upload control
  q('upload-svg').addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const text = await f.text();
    await processSVG(text);
    log(`Loaded SVG from ${f.name}`);
  });
  q('load-default').addEventListener('click', ()=>{ loadMap(); });
  q('overlay-mode').addEventListener('change', applyOverlay);
  // crisis deck buttons
  q('shuffle-deck').addEventListener('click', ()=>{ shuffleDeck(); });
  q('draw-card').addEventListener('click', ()=>{ drawCard(); });
  q('discard-card').addEventListener('click', ()=>{ discardCurrent(); });
  renderCrisisUI();
  // legend buttons
  const toggle = q('toggle-legend');
  const legend = q('legend');
  toggle.addEventListener('click', ()=>{
    if(legend.hidden){ legend.hidden=false; toggle.textContent='Hide Legend' }
    else { legend.hidden=true; toggle.textContent='Show Legend' }
  });
  q('pulse-low').addEventListener('click', ()=>{
    pulseTerritories((s)=> (s.happiness||0) < 80, 3500);
  });
  q('pulse-invaded').addEventListener('click', ()=>{
    pulseTerritories((s)=> s.invaded === true, 3500);
  });

  q('advance-phase').addEventListener('click', advancePhase);
  q('reveal-resolve').addEventListener('click', revealAndResolve);
  q('reset-round').addEventListener('click', resetRound);

  // Add Tribute Button
  const tributeBtn = document.createElement('button');
  tributeBtn.textContent = 'Run Tribute (Phase 2)';
  tributeBtn.className = 'utility-button';
  tributeBtn.addEventListener('click', runTribute);
  q('players-list').parentNode.insertBefore(tributeBtn, q('players-list'));

  // Add Deal Cards Button
  const dealBtn = document.createElement('button');
  dealBtn.textContent = 'Deal Cards';
  dealBtn.className = 'utility-button';
  dealBtn.addEventListener('click', dealRoundCards);
  tributeBtn.parentNode.insertBefore(dealBtn, tributeBtn.nextSibling);

  // select first available territory
  const first = document.querySelector('[data-country]');
  if(first) selectTerritory(first);
}

// ------------------ Crisis deck functions ------------------
function shuffleDeck(){
  const deck = gameState.runtime.crisisDeck;
  if(!deck) return;
  // Fisher-Yates
  for(let i = deck.drawPile.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const tmp = deck.drawPile[i]; deck.drawPile[i] = deck.drawPile[j]; deck.drawPile[j] = tmp; }
  log('Crisis deck shuffled');
  renderCrisisUI();
}

function drawCard(){
  const deck = gameState.runtime.crisisDeck;
  if(!deck || deck.drawPile.length === 0){ log('No cards to draw'); return; }
  // retire any current card to the discard pile so it is never lost
  if(deck.current){ deck.discard.push(deck.current); }
  const card = deck.drawPile.shift();
  deck.current = card;
  // apply to state so rules engine can use it
  gameState.runtime.crisis = card;
  log(`Drew crisis card: ${card.title}`);
  renderCrisisUI();
}

function discardCurrent(){
  const deck = gameState.runtime.crisisDeck;
  if(!deck || !deck.current){ log('No current card to discard'); return; }
  deck.discard.push(deck.current);
  log(`Discarded crisis: ${deck.current.title}`);
  delete deck.current; gameState.runtime.crisis = null;
  renderCrisisUI();
}

function renderCrisisUI(){
  const cur = gameState.runtime.crisisDeck && gameState.runtime.crisisDeck.current;
  const el = q('current-crisis');
  const desc = q('current-crisis-desc');
  if(!el) return;
  if(cur){ el.querySelector('strong').textContent = cur.title; desc.textContent = cur.description || '';} else { el.querySelector('strong').textContent = 'No card drawn'; desc.textContent = ''; }
  // show counts
  const pileCount = (gameState.runtime.crisisDeck && gameState.runtime.crisisDeck.drawPile.length) || 0;
  const discCount = (gameState.runtime.crisisDeck && gameState.runtime.crisisDeck.discard.length) || 0;
  const meta = el.querySelector('.meta') || document.createElement('div'); meta.className = 'meta'; meta.textContent = `Deck: ${pileCount} · Discard: ${discCount}`;
  if(!el.querySelector('.meta')) el.appendChild(meta);
}

// ------------------ Player Cards (Briefcase) ------------------
function initDeck(){
  gameState.runtime.hands = {};
  gameState.runtime.deck = [];
  if(!gameState.runtime.cardDefs) return;
  // Create a deck with 3 copies of each card
  for(let i=0; i<3; i++){
    gameState.runtime.cardDefs.forEach(c => gameState.runtime.deck.push(c.id));
  }
  // Shuffle
  for(let i=gameState.runtime.deck.length-1; i>0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.runtime.deck[i], gameState.runtime.deck[j]] = [gameState.runtime.deck[j], gameState.runtime.deck[i]];
  }
}

function dealRoundCards(){
  // Deal 1 card to every valid family, respecting the hand limit
  const balance = gameState.runtime.balance;
  const maxHand = (balance && balance.actionEconomy && balance.actionEconomy.maxCardsInHand) || 5;
  let dealt = 0, atLimit = 0, starved = 0;
  territoryKeys().forEach(k => {
    if(state[k] && state[k].family && state[k].family !== 'Anarchy' && state[k].family !== 'Collapsed'){
      if(!gameState.runtime.hands[k]) gameState.runtime.hands[k] = [];
      if(gameState.runtime.hands[k].length >= maxHand){ atLimit += 1; return; }
      if(gameState.runtime.deck.length === 0){ starved += 1; return; }
      gameState.runtime.hands[k].push(gameState.runtime.deck.pop());
      dealt += 1;
    }
  });
  const notes = [];
  if(atLimit) notes.push(`${atLimit} at hand limit`);
  if(starved) notes.push(`deck empty for ${starved}`);
  log(`Dealt ${dealt} card${dealt === 1 ? '' : 's'}${notes.length ? ` (${notes.join(', ')})` : ''}.`);
  renderBriefcase();
}

function playCard(family, cardId, target){
  if(!window.Rules || !window.Rules.resolveCard){ notify('Rules engine missing.', 'error'); return; }

  const result = window.Rules.resolveCard(state, cardId, family, target);

  // Apply state
  Object.keys(result.newState).forEach(k=>{
    state[k] = Object.assign(state[k] || {}, result.newState[k]);
  });

  // Remove card from hand
  const idx = gameState.runtime.hands[family].indexOf(cardId);
  if(idx > -1) gameState.runtime.hands[family].splice(idx, 1);

  result.logs.forEach(l => log(l));
  renderPlayersList();
  if(gameState.ui.selected) updatePanel(gameState.ui.selected);
  applyOverlay();
}

function renderBriefcase(){
  // Find or create briefcase container
  let container = q('briefcase-container');
  if(!container){
    container = document.createElement('div');
    container.id = 'briefcase-container';
    container.className = 'briefcase';
    q('players-list').parentNode.insertBefore(container, q('players-list'));
  }

  const viewer = (q('view-as') && q('view-as').value) || null;
  container.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = `The Briefcase (${viewer || 'None'})`;
  container.appendChild(title);

  if(!viewer || !gameState.runtime.hands || !gameState.runtime.hands[viewer] || gameState.runtime.hands[viewer].length === 0){
    const empty = document.createElement('div');
    empty.textContent = 'No cards.';
    container.appendChild(empty);
    return;
  }

  gameState.runtime.hands[viewer].forEach(cardId => {
    const def = gameState.runtime.cardDefs.find(c => c.id === cardId) || {title: cardId, desc: ''};
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    const cardTitle = document.createElement('strong');
    cardTitle.textContent = def.title;
    const desc = document.createElement('small');
    desc.textContent = def.desc;
    cardEl.appendChild(cardTitle);
    cardEl.appendChild(desc);

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.onclick = () => {
        // Simple target selection for prototype: use currently selected map territory or self
        const target = (def.target === 'Self') ? viewer : (gameState.ui.selected || viewer);
        if(def.target === 'Other' && target === viewer){
            notify('Select a different territory on the map to target.', 'error');
            return;
        }
        playCard(viewer, cardId, target);
    };
    cardEl.appendChild(playBtn);
    container.appendChild(cardEl);
  });
}

// ----------------------- Turn manager functions -----------------------
function idFromKey(key){ return `p_${key.replace(/\W+/g,'_')}` }

const ACTIONS = ['Pass','Skim','Propaganda','Invade','Sanction','Protect','TributeHoliday','ProtectionDeal','ClientRealignment','RegionalRivalry','DebtShakedown','EconomicExploitation','Coup','FalseFlag','CovertInfluence','MakeExample','Concession','Educate','Develop'];

const ACTION_RULES = {
  Pass: { target: 'self', cost: 'None', effect: 'No effect.' },
  Skim: { target: 'any', cost: 'Target wealth', effect: 'Move 10 target wealth to stash; target happiness -6.' },
  Propaganda: { target: 'any', cost: '8 stash', effect: 'Target happiness +10.' },
  Invade: { target: 'other', cost: '12 wealth, 1 army, backlash', effect: 'Target invaded, wealth -10, happiness loss, fear +10.' },
  Sanction: { target: 'other', cost: '5 Political Capital', effect: 'Target wealth, happiness, and development fall.' },
  Protect: { target: 'other', cost: '8 wealth, 6 stash', effect: 'Target protected, happiness +8, fear reduced.' },
  TributeHoliday: { target: 'controlledClient', cost: '8 wealth', effect: 'Client skips one tribute and loses 1 defiance.' },
  ProtectionDeal: { target: 'other', cost: '6 wealth, 4 stash', effect: 'Temporary protection; rival clients gain realignment pressure.' },
  ClientRealignment: { target: 'rivalClient', cost: '12 Political Capital, 4 Social Capital', effect: 'Eligible client of another family switches patron.' },
  RegionalRivalry: { target: 'regionalOther', cost: '6 Political Capital', effect: 'Rival loses Political Capital and gains factional division.' },
  DebtShakedown: { target: 'other', cost: '8 Political Capital', effect: 'Extract up to 20 wealth and add target debt.' },
  EconomicExploitation: { target: 'other', cost: '4 Social Capital', effect: 'Extract wealth and stash; target development and happiness fall.' },
  Coup: { target: 'other', cost: '10 Black Budget', effect: 'Seeded coup roll can replace target family control.' },
  FalseFlag: { target: 'self', cost: '8 Black Budget', effect: 'Gain 50 Social Capital.' },
  CovertInfluence: { target: 'any', cost: '6 Black Budget', effect: 'Target defiance +1; actor Political Capital +5. Self-target stokes deliberate defiance.' },
  MakeExample: { target: 'ownDefiantClient', cost: '10 Social Capital', effect: 'Reset own client defiance; target happiness -20.' },
  Concession: { target: 'ownDefiantClient', cost: '10 wealth, 5 Political Capital', effect: 'Reset own client defiance; target happiness +10.' },
  Educate: { target: 'self', cost: '8 wealth', effect: 'Education +10, development +3, political side pressure.' },
  Develop: { target: 'self', cost: '10 wealth; needs Industry or Technology', effect: 'Development +10, happiness +3, net wealth -5.' }
};

function legalActionsFor(family){
  return ACTIONS.filter(action=>isActionLegal(family, action) && targetKeysForAction(family, action).length > 0);
}

function isActionLegal(family, action){
  const data = state[family] || {};
  if(data.family === 'Collapsed' || data.family === 'Anarchy') return action === 'Pass';
  if(action === 'Coup') return (data.blackBudget||0) >= 10;
  if(action === 'FalseFlag') return (data.blackBudget||0) >= 8;
  if(action === 'CovertInfluence') return (data.blackBudget||0) >= 6;
  if(action === 'Invade') return (data.armies||0) >= 1 && (data.wealth||0) >= 12;
  if(action === 'Develop') return (data.wealth||0) >= 10 && hasDevelopmentResource(family);
  if(action === 'RegionalRivalry') return data.type === 'Regional' && (data.politicalCapital||0) >= 6;
  if(action === 'Propaganda') return (data.stash||0) >= 8;
  if(action === 'Sanction') return (data.politicalCapital||0) >= 5;
  if(action === 'Protect') return (data.stash||0) >= 6 && (data.wealth||0) >= 8;
  if(action === 'ProtectionDeal') return (data.stash||0) >= 4 && (data.wealth||0) >= 6;
  if(action === 'TributeHoliday') return (data.wealth||0) >= 8;
  if(action === 'ClientRealignment') return (data.politicalCapital||0) >= 12;
  if(action === 'DebtShakedown') return (data.politicalCapital||0) >= 8;
  if(action === 'EconomicExploitation') return (data.socialCapital||0) >= 4;
  if(action === 'MakeExample') return (data.socialCapital||0) >= 10;
  if(action === 'Concession') return (data.wealth||0) >= 10 && (data.politicalCapital||0) >= 5;
  if(action === 'Educate') return (data.wealth||0) >= 8;
  return true;
}

function hasDevelopmentResource(family){
  if(window.Rules && window.Rules.availableResourcesFor){
    const resources = window.Rules.availableResourcesFor(family, state);
    return resources.has('Industry') || resources.has('Technology');
  }
  return (state[family] && (state[family].resources || []).some(r=>r === 'Industry' || r === 'Technology')) || false;
}

function targetKeysForAction(family, action){
  const rule = ACTION_RULES[action] || ACTION_RULES.Pass;
  const all = territoryKeys();
  const ownFamily = state[family] && state[family].family;
  if(rule.target === 'self') return ['Self'];
  if(rule.target === 'other') return all.filter(k=>k !== family);
  if(rule.target === 'rivalClient') return all.filter(k=>k !== family && state[k].type === 'Client' && state[k].clientOf !== ownFamily);
  if(rule.target === 'controlledClient') return all.filter(k=>state[k].type === 'Client' && state[k].clientOf === ownFamily);
  if(rule.target === 'regionalOther') return all.filter(k=>k !== family && state[k].type === 'Regional');
  if(rule.target === 'ownDefiantClient') return all.filter(k=>state[k].type === 'Client' && state[k].clientOf === ownFamily && (state[k].defiance||0) > 0);
  return ['Self'].concat(all.filter(k=>k !== family));
}

function renderTargetOptions(targetSel, family, action){
  const current = targetSel.value;
  targetSel.innerHTML = '';
  const targets = targetKeysForAction(family, action);
  targets.forEach(k=>{
    const o = document.createElement('option');
    o.value = k;
    o.textContent = k;
    targetSel.appendChild(o);
  });
  if(targets.includes(current)) targetSel.value = current;
}

function updateActionPreview(preview, family, action, target, framing){
  const rule = ACTION_RULES[action] || ACTION_RULES.Pass;
  const targetKey = target === 'Self' ? family : target;
  const targetData = state[targetKey];
  const projected = targetData ? ` Target: ${targetKey} wealth ${targetData.wealth}, happiness ${targetData.happiness}, defiance ${targetData.defiance}.` : '';
  preview.textContent = `${rule.cost}. ${rule.effect} Framing: ${normalizeFraming(framing)}.${projected}`;
}

function toggleDefiance(family){
  const s = state[family];
  if(!s) return;
  s.defiance = s.defiance ? 0 : 1;
  log(`${family} is now ${s.defiance ? 'DEFIANT (Refusing Tribute)' : 'Compliant'}`);
  renderPlayersList();
  if(gameState.ui.selected === family) updatePanel(family);
  applyOverlay();
}

function renderPlayersList(){
  const container = q('players-list');
  container.innerHTML = '';
  // ensure view-as selector exists and is populated
  const viewAs = q('view-as');
  if(viewAs){
    // Hook change event to update briefcase
    if(!viewAs.hasAttribute('data-wired')){
        viewAs.addEventListener('change', renderBriefcase);
        viewAs.setAttribute('data-wired', 'true');
    }
    const current = viewAs.value;
    viewAs.innerHTML = '';
    territoryKeys().forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; viewAs.appendChild(o); });
    if(current && territoryKeys().includes(current)) viewAs.value = current;
  }
  territoryKeys().forEach(family=>{
    const data = state[family];

    const isDead = data.family === 'Collapsed' || data.family === 'Anarchy';

    const row = document.createElement('div'); row.className='player-row'; row.id = idFromKey(family);
    const name = document.createElement('div'); name.className='name'; name.textContent = family;

    // Add Client/Head info to name
    if(data.type === 'Client'){
        const client = document.createElement('small');
        client.textContent = ` (${data.clientOf})`;
        name.appendChild(client);
    }

    if(isDead){
      name.textContent += ` (${data.family})`;
      row.classList.add('disabled');
      row.appendChild(name);
      container.appendChild(row);
      return;
    }

    // Defiance Toggle (Only for Clients)
    if(data.type === 'Client'){
        const defBtn = document.createElement('button');
        const isDefiant = data.defiance > 0;
        defBtn.textContent = isDefiant ? 'Defiant' : 'Compliant';
        defBtn.title = isDefiant ? 'Refusing Tribute' : 'Paying Tribute';
        defBtn.className = `defiance-toggle${isDefiant ? ' defiant' : ''}`;
        defBtn.onclick = () => toggleDefiance(family);
        row.appendChild(defBtn);
    }

    const actionSel = document.createElement('select'); actionSel.id = `action-${idFromKey(family)}`;
    actionSel.setAttribute('aria-label', `${family} action`);
    legalActionsFor(family).forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; actionSel.appendChild(o); });
    const targetSel = document.createElement('select'); targetSel.id = `target-${idFromKey(family)}`;
    targetSel.setAttribute('aria-label', `${family} target`);
    const framingInput = document.createElement('input'); framingInput.id = `framing-${idFromKey(family)}`; framingInput.type = 'number'; framingInput.min = '0'; framingInput.max = '50'; framingInput.step = '1'; framingInput.value = '0'; framingInput.title = 'Social Capital to spend on framing';
    framingInput.className = 'framing';
    framingInput.setAttribute('aria-label', `${family} framing spend`);
    const lockBtn = document.createElement('button'); lockBtn.textContent='Lock'; lockBtn.id = `lock-${idFromKey(family)}`;
    const submitBtn = document.createElement('button'); submitBtn.textContent='Submit Secret'; submitBtn.id = `submit-${idFromKey(family)}`;
    const preview = document.createElement('div'); preview.className = 'preview';
    renderTargetOptions(targetSel, family, actionSel.value || 'Pass');
    updateActionPreview(preview, family, actionSel.value || 'Pass', targetSel.value || 'Self', framingInput.value);

    // if already submitted, reflect that
    const submitted = gameState.runtime.submissions && gameState.runtime.submissions[family];
    const viewer = (q('view-as') && q('view-as').value) || null;
    if(submitted){
      submitBtn.textContent = 'Submitted';
    }

    // restore existing pending action if any
    const pending = gameState.runtime.pendingActions[family];
    if(pending){
      actionSel.value = pending.action || 'Pass';
      renderTargetOptions(targetSel, family, actionSel.value);
      targetSel.value = pending.target || 'Self';
      framingInput.value = pending.framing || 0;
      updateActionPreview(preview, family, actionSel.value, targetSel.value, framingInput.value);
      if(pending.locked){ row.classList.add('locked'); lockBtn.textContent='Unlock'; actionSel.disabled=true; targetSel.disabled=true; framingInput.disabled=true }
    }

    actionSel.addEventListener('change', ()=>{
      renderTargetOptions(targetSel, family, actionSel.value);
      updateActionPreview(preview, family, actionSel.value, targetSel.value, framingInput.value);
      submitAction(family, actionSel.value, targetSel.value, framingInput.value);
    });
    targetSel.addEventListener('change', ()=>{
      updateActionPreview(preview, family, actionSel.value, targetSel.value, framingInput.value);
      submitAction(family, actionSel.value, targetSel.value, framingInput.value);
    });
    framingInput.addEventListener('change', ()=>{
      updateActionPreview(preview, family, actionSel.value, targetSel.value, framingInput.value);
      submitAction(family, actionSel.value, targetSel.value, framingInput.value);
    });
    lockBtn.addEventListener('click', ()=>{ toggleLock(family, actionSel, targetSel, framingInput, lockBtn, row); });
    submitBtn.addEventListener('click', ()=>{ submitSecret(family, actionSel, targetSel, framingInput, submitBtn, row); });

    // if someone else submitted and viewer is not that family, hide their action selects
    if(gameState.runtime.submissions && gameState.runtime.submissions[family] && viewer && viewer !== family){
      const badge = document.createElement('div'); badge.textContent = 'Submitted'; badge.className = 'submitted-badge'; row.appendChild(name); row.appendChild(badge);
    } else {
      row.appendChild(name); row.appendChild(actionSel); row.appendChild(targetSel); row.appendChild(framingInput); row.appendChild(lockBtn); row.appendChild(submitBtn); row.appendChild(preview);
    }
    container.appendChild(row);
  });
  q('round-num').textContent = window.game.round;
  q('phase-name').textContent = window.game.phases[window.game.phaseIndex];
  renderBriefcase();
}

function normalizeFraming(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function submitAction(family, action, target, framing=0){
  gameState.runtime.pendingActions[family] = {
    action,
    target,
    framing: normalizeFraming(framing),
    locked: gameState.runtime.pendingActions[family] ? gameState.runtime.pendingActions[family].locked : false
  };
  log(`${family}: selected action ${action} -> ${target} (framing ${gameState.runtime.pendingActions[family].framing})`);
}

function toggleLock(family, actionSel, targetSel, framingInput, lockBtn, rowEl){
  const pending = gameState.runtime.pendingActions[family] || {action:'Pass', target:'Self', framing:0, locked:false};
  const newLocked = !pending.locked;
  pending.locked = newLocked;
  gameState.runtime.pendingActions[family] = pending;
  if(newLocked){ rowEl.classList.add('locked'); lockBtn.textContent='Unlock'; actionSel.disabled=true; targetSel.disabled=true; framingInput.disabled=true; log(`${family}: locked action`); }
  else { rowEl.classList.remove('locked'); lockBtn.textContent='Lock'; actionSel.disabled=false; targetSel.disabled=false; framingInput.disabled=false; log(`${family}: unlocked action`); }
}

function submitSecret(family, actionSel, targetSel, framingInput, submitBtn, rowEl){
  const action = actionSel.value || 'Pass';
  const target = targetSel.value || 'Self';
  const framing = normalizeFraming(framingInput.value);
  // basic validation: require a target when action is not Pass
  if(action !== 'Pass' && !target){ notify('Select a target.', 'error'); return; }
  // store the pending action (kept hidden in UI)
  gameState.runtime.pendingActions[family] = { action, target, framing, locked: true };
  gameState.runtime.submissions = gameState.runtime.submissions || {};
  gameState.runtime.submissions[family] = { sealed: true, revealed: false, time: Date.now() };
  // update UI: disable selects and lock button
  actionSel.disabled = true; targetSel.disabled = true; framingInput.disabled = true; submitBtn.textContent = 'Submitted'; rowEl.classList.add('locked');
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
  gameState.runtime.pendingActions = {};
  gameState.runtime.locks = {};
  gameState.runtime.submissions = {};
  // full re-render restores every row's controls, labels, and enabled state
  renderPlayersList();
  log('Round reset — pending actions cleared');
}

function runTribute(){
  if(!window.Rules || !window.Rules.resolveTribute){ notify('Rules engine not available.', 'error'); return; }
  const result = window.Rules.resolveTribute(state);

  // Apply state
  Object.keys(result.newState).forEach(k=>{
    state[k] = Object.assign(state[k] || {}, result.newState[k]);
  });

  // Logs
  result.logs.forEach(line=> log(line));

  // Update visuals
  if(gameState.ui.selected) updatePanel(gameState.ui.selected);
  applyOverlay();

  log('Tribute phase complete');
}

function revealAndResolve(){
  // if not all submitted, warn and ask for confirmation
  const families = territoryKeys();
  const submittedCount = families.filter(f=> gameState.runtime.submissions && gameState.runtime.submissions[f]).length;
  if(submittedCount < families.length){
    confirmAction(`Only ${submittedCount}/${families.length} players submitted secret actions. Reveal anyway?`, ()=>resolveSubmittedActions(families));
    return;
  }
  resolveSubmittedActions(families);
}

function resolveSubmittedActions(families){
  // collect actions, default to Pass if missing
  const actions = families.map(k=>({
    family:k,
    action: (gameState.runtime.pendingActions[k] && gameState.runtime.pendingActions[k].action) || 'Pass',
    target: (gameState.runtime.pendingActions[k] && gameState.runtime.pendingActions[k].target) || 'Self',
    framing: (gameState.runtime.pendingActions[k] && gameState.runtime.pendingActions[k].framing) || 0
  }));
  const seed = JSON.stringify({ round: gameState.round, actions });
  gameState.runtime.lastResolutionSeed = seed;
  // send actions to rules engine
  if(!window.Rules || !window.Rules.resolveTurn){ notify('Rules engine not available.', 'error'); return; }
  const result = window.Rules.resolveTurn(currentRulesState(), actions, { seed });

  // Run Cleanup immediately after resolution for this prototype
  const cleanupResult = window.Rules.resolveCleanup(result.newState, { seed: `${seed}:cleanup` });

  // apply newState into live state object
  // Merge cleanup results into the final state
  Object.keys(cleanupResult.newState).forEach(k=>{
    state[k] = Object.assign(state[k] || {}, cleanupResult.newState[k]);
  });

  // discard the resolved crisis card so it cannot re-apply next round
  const crisisDeck = gameState.runtime.crisisDeck;
  if(crisisDeck && crisisDeck.current){ crisisDeck.discard.push(crisisDeck.current); delete crisisDeck.current; }
  gameState.runtime.crisis = null;
  renderCrisisUI();

  // show engine logs
  result.logs.forEach(line=> log(line));
  cleanupResult.logs.forEach(line=> log(line));

  // update map visuals and side panel
  applyOverlay();
  if(gameState.ui.selected) updatePanel(gameState.ui.selected);
  // advance round and reset phase
  window.game.round += 1; window.game.phaseIndex = 0; q('round-num').textContent = window.game.round; q('phase-name').textContent = window.game.phases[window.game.phaseIndex];
  // clear pending actions and submissions for the new round
  gameState.runtime.pendingActions = {};
  gameState.runtime.submissions = {};
  // re-render players UI so every family gets fresh controls
  renderPlayersList();
  log('Resolution complete');
}


init().catch(e=>{console.error(e); q('map-container').textContent = 'Failed to load map';});
