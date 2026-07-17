/**
 * Grand Area — BGA client.
 *
 * Renders the world map board, a territory inspector, the secret
 * commit/reveal action builder, the player hand, and a game log.
 * All rules enforcement is server-side; the legality logic here only
 * filters the UI to choices the server will accept.
 */
define([
  'dojo',
  'dojo/_base/declare',
  'ebg/core/gamegui',
  'ebg/counter'
], function(dojo, declare) {
  var TARGET_MODES = {
    Pass: 'self',
    Skim: 'any',
    Propaganda: 'any',
    Invade: 'other',
    Sanction: 'other',
    Protect: 'other',
    TributeHoliday: 'ownClient',
    ProtectionDeal: 'other',
    ClientRealignment: 'rivalClient',
    RegionalRivalry: 'regionalOther',
    DebtShakedown: 'other',
    EconomicExploitation: 'other',
    Coup: 'other',
    FalseFlag: 'self',
    CovertInfluence: 'any',
    CounterIntel: 'self',
    Fortify: 'self',
    MakeExample: 'ownDefiantClient',
    Concession: 'ownDefiantClient',
    Educate: 'self',
    Develop: 'self'
  };

  var STAT_FIELDS = [
    ['wealth', 'Wealth'],
    ['happiness', 'Happiness'],
    ['stash', 'Stash'],
    ['blackBudget', 'Black Budget'],
    ['socialCapital', 'Social Capital'],
    ['politicalCapital', 'Political Capital'],
    ['education', 'Education'],
    ['development', 'Development'],
    ['debt', 'Debt'],
    ['defiance', 'Defiance'],
    ['armies', 'Armies']
  ];

  return declare('bgagame.grandareagame', ebg.core.gamegui, {
    constructor: function() {
      this.territories = {};
      this.selectedTerritory = null;
      this.currentRound = 1;
      this.myFamily = null;
    },

    setup: function(gamedatas) {
      this.gamedatas = gamedatas;
      this.territories = gamedatas.territories || {};
      this.currentRound = parseInt(gamedatas.round, 10) || 1;
      this.myFamily = (gamedatas.families && gamedatas.families[this.player_id]) || null;

      this.renderRound();
      this.renderCrisisCard(gamedatas.current_crisis_card || null);
      this.renderForecast(gamedatas.next_crisis_card || null);
      this.renderTerritories();
      this.renderHand(gamedatas.hand || []);
      this.wireMap();
      this.wireControls();
      this.populateActionSelect();
      this.refreshCommitStatus();

      if (this.isSpectator || !this.myFamily) {
        dojo.style('grandarea_action_builder', 'display', 'none');
        dojo.style('grandarea_hand', 'display', 'none');
      }

      this.setupNotifications();
    },

    onEnteringState: function(stateName, args) {
      this.setPhaseLabel(stateName);
    },

    onLeavingState: function(stateName) {
    },

    onUpdateActionButtons: function(stateName, args) {
      if (this.isSpectator || !this.myFamily) {
        return;
      }
      if (stateName === 'actionSubmission') {
        this.addActionButton('btn_ga_commit', _('Commit secret action'), 'onCommitClick');
        this.addActionButton('btn_ga_pass', _('End turn'), 'onEndTurnClick', null, false, 'gray');
      } else if (stateName === 'reveal') {
        this.addActionButton('btn_ga_reveal', _('Reveal committed action'), 'onRevealClick');
        this.addActionButton('btn_ga_skip', _('End turn'), 'onEndTurnClick', null, false, 'gray');
      } else if (stateName === 'narrativeBattle') {
        this.addActionButton('btn_ga_smear', _('Smear selected territory'), 'onSmearClick', null, false, 'red');
        this.addActionButton('btn_ga_whitewash', _('Whitewash selected territory'), 'onWhitewashClick');
        this.addActionButton('btn_ga_spin_skip', _('Pass'), 'onEndTurnClick', null, false, 'gray');
      }
    },

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    wireMap: function() {
      var self = this;
      // NOTE: SVG nodes need classList — dojo's dom-class assigns
      // node.className, which is read-only on SVG elements.
      dojo.query('#grandarea_map [data-country]').forEach(function(node) {
        node.classList.add('territory');
        dojo.connect(node, 'onclick', function(evt) {
          dojo.stopEvent(evt);
          self.selectTerritory(node.getAttribute('data-country'));
        });
      });
    },

    wireControls: function() {
      var pairs = [
        ['grandarea_commit', 'onCommitClick'],
        ['grandarea_reveal', 'onRevealClick'],
        ['grandarea_endturn', 'onEndTurnClick']
      ];
      for (var i = 0; i < pairs.length; i++) {
        var node = dojo.byId(pairs[i][0]);
        if (node) {
          dojo.connect(node, 'onclick', this, pairs[i][1]);
        }
      }
      var actionSelect = dojo.byId('grandarea_action_select');
      if (actionSelect) {
        dojo.connect(actionSelect, 'onchange', this, 'populateTargetSelect');
      }
    },

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    renderRound: function() {
      var node = dojo.byId('grandarea_round');
      if (node) {
        var limit = this.gamedatas.round_limit ? ' / ' + this.gamedatas.round_limit : '';
        node.innerHTML = this.escapeText('Round ' + this.currentRound + limit);
      }
    },

    renderCrisisCard: function(card) {
      var node = dojo.byId('grandarea_crisis');
      if (!node) {
        return;
      }
      if (card && card.title) {
        node.innerHTML = this.escapeText('Crisis: ' + card.title + ' — ' + (card.description || ''));
      } else if (card && card.id) {
        node.innerHTML = this.escapeText('Crisis: ' + card.id);
      } else {
        node.innerHTML = this.escapeText('No active crisis.');
      }
    },

    renderForecast: function(card) {
      var node = dojo.byId('grandarea_forecast');
      if (!node) {
        return;
      }
      if (card && card.title) {
        node.innerHTML = this.escapeText('Next crisis: ' + card.title);
      } else {
        node.innerHTML = this.escapeText('Next crisis: deck reshuffles');
      }
    },

    renderTerritories: function() {
      var state = this.territories;
      var self = this;
      dojo.query('#grandarea_map [data-country]').forEach(function(node) {
        var key = node.getAttribute('data-country');
        var data = state[key];
        if (!data) {
          return;
        }
        // classList, not dojo dom-class: these are SVG elements.
        node.classList.remove('overlay-head', 'overlay-regional', 'overlay-client',
          'defiant', 'eliminated', 'invaded', 'sanctioned', 'protected');
        if (self.isEliminated(data)) {
          node.classList.add('eliminated');
        } else if ((parseInt(data.defiance, 10) || 0) > 0) {
          node.classList.add('defiant');
        } else if (data.type === 'Head') {
          node.classList.add('overlay-head');
        } else if (data.type === 'Regional') {
          node.classList.add('overlay-regional');
        } else {
          node.classList.add('overlay-client');
        }
        if (data.invaded) {
          node.classList.add('invaded');
        }
        if (data.sanctioned) {
          node.classList.add('sanctioned');
        }
        if (data['protected']) {
          node.classList.add('protected');
        }
        node.classList.toggle('selected', key === self.selectedTerritory);
      });
      this.renderSelectedPanel();
    },

    renderSelectedPanel: function() {
      var node = dojo.byId('grandarea_selected');
      if (!node) {
        return;
      }
      var key = this.selectedTerritory;
      var data = key ? this.territories[key] : null;
      if (!data) {
        node.innerHTML = this.escapeText('Select a territory on the map.');
        return;
      }
      var html = '<strong>' + this.escapeText(key) + '</strong> — '
        + this.escapeText(data.family + ' (' + data.type
        + (data.clientOf ? ', client of ' + data.clientOf : '') + ')');
      html += '<table>';
      for (var i = 0; i < STAT_FIELDS.length; i++) {
        var field = STAT_FIELDS[i][0];
        html += '<tr><td>' + this.escapeText(STAT_FIELDS[i][1]) + '</td><td>'
          + this.escapeText(String(data[field] != null ? data[field] : 0)) + '</td></tr>';
      }
      if (data.outcome) {
        html += '<tr><td>Outcome</td><td>' + this.escapeText(data.outcome) + '</td></tr>';
      }
      html += '</table>';
      node.innerHTML = html;
    },

    renderHand: function(hand) {
      var node = dojo.byId('grandarea_hand');
      if (!node) {
        return;
      }
      this.gamedatas.hand = hand;
      node.innerHTML = '<strong>' + this.escapeText('Your cards') + '</strong>';
      if (!hand.length) {
        node.innerHTML += '<div class="grandarea-panel-row">' + this.escapeText('No cards in hand.') + '</div>';
        return;
      }
      for (var i = 0; i < hand.length; i++) {
        var def = this.cardDefById(hand[i]) || { title: hand[i], desc: '', target: 'Self' };
        var card = dojo.create('div', { 'class': 'grandarea-card' }, node);
        dojo.create('strong', { innerHTML: this.escapeText(def.title) }, card);
        dojo.create('small', { innerHTML: this.escapeText(def.desc || '') }, card);
        var btn = dojo.create('a', {
          href: '#',
          'class': 'bgabutton bgabutton_blue',
          innerHTML: this.escapeText(_('Play'))
        }, card);
        this.connectCardButton(btn, hand[i], def);
      }
    },

    connectCardButton: function(node, cardId, def) {
      var self = this;
      dojo.connect(node, 'onclick', function(evt) {
        dojo.stopEvent(evt);
        self.onPlayCard(cardId, def);
      });
    },

    selectTerritory: function(key) {
      this.selectedTerritory = key;
      this.renderTerritories();
      this.populateTargetSelect();
    },

    setPhaseLabel: function(stateName) {
      var labels = {
        crisis: _('Crisis phase'),
        tribute: _('Tribute collection'),
        actionSubmission: _('Secret action submission'),
        reveal: _('Reveal committed actions'),
        narrativeBattle: _('Narrative battle'),
        resolution: _('Resolving actions'),
        cleanup: _('Cleanup'),
        gameEnd: _('Game over')
      };
      var node = dojo.byId('grandarea_phase');
      if (node) {
        node.innerHTML = this.escapeText('Phase: ' + (labels[stateName] || stateName));
      }
    },

    // ------------------------------------------------------------------
    // Action builder
    // ------------------------------------------------------------------

    myActorKey: function() {
      if (!this.myFamily) {
        return null;
      }
      if (this.territories[this.myFamily] && !this.isEliminated(this.territories[this.myFamily])) {
        return this.myFamily;
      }
      var keys = Object.keys(this.territories).sort();
      for (var i = 0; i < keys.length; i++) {
        var data = this.territories[keys[i]];
        if (data && data.family === this.myFamily && !this.isEliminated(data)) {
          return keys[i];
        }
      }
      return null;
    },

    isEliminated: function(data) {
      return data.family === 'Anarchy' || data.family === 'Collapsed' || data.outcome === 'Lost';
    },

    num: function(data, field) {
      return parseInt(data && data[field], 10) || 0;
    },

    isActionAffordable: function(action, me) {
      if (action === 'Coup') return this.num(me, 'blackBudget') >= 10;
      if (action === 'FalseFlag') return this.num(me, 'blackBudget') >= 8;
      if (action === 'CovertInfluence') return this.num(me, 'blackBudget') >= 6;
      if (action === 'CounterIntel') return this.num(me, 'blackBudget') >= 4;
      if (action === 'Fortify') return this.num(me, 'wealth') >= 6;
      if (action === 'Invade') return this.num(me, 'armies') >= 1 && this.num(me, 'wealth') >= 12;
      if (action === 'Develop') return this.num(me, 'wealth') >= 10;
      if (action === 'RegionalRivalry') return me.type === 'Regional' && this.num(me, 'politicalCapital') >= 6;
      if (action === 'Propaganda') return this.num(me, 'stash') >= 8;
      if (action === 'Sanction') return this.num(me, 'politicalCapital') >= 5;
      if (action === 'Protect') return this.num(me, 'stash') >= 6 && this.num(me, 'wealth') >= 8;
      if (action === 'ProtectionDeal') return this.num(me, 'stash') >= 4 && this.num(me, 'wealth') >= 6;
      if (action === 'TributeHoliday') return this.num(me, 'wealth') >= 8;
      if (action === 'ClientRealignment') return this.num(me, 'politicalCapital') >= 12;
      if (action === 'DebtShakedown') return this.num(me, 'politicalCapital') >= 8;
      if (action === 'EconomicExploitation') return this.num(me, 'socialCapital') >= 4;
      if (action === 'MakeExample') return this.num(me, 'socialCapital') >= 10;
      if (action === 'Concession') return this.num(me, 'wealth') >= 10 && this.num(me, 'politicalCapital') >= 5;
      if (action === 'Educate') return this.num(me, 'wealth') >= 8;
      return true;
    },

    targetKeysFor: function(action) {
      var mode = TARGET_MODES[action] || 'self';
      var actorKey = this.myActorKey();
      var me = actorKey ? this.territories[actorKey] : null;
      var myFamily = me ? me.family : null;
      if (mode === 'self') {
        return ['Self'];
      }
      var keys = Object.keys(this.territories).sort();
      var out = [];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var data = this.territories[key];
        if (!data || this.isEliminated(data)) {
          continue;
        }
        if (mode === 'any' && key === actorKey) {
          continue; // 'Self' entry covers the actor
        }
        if (mode !== 'any' && key === actorKey) {
          continue;
        }
        if (mode === 'ownClient' && !(data.type === 'Client' && data.clientOf === myFamily)) {
          continue;
        }
        if (mode === 'ownDefiantClient' && !(data.type === 'Client' && data.clientOf === myFamily && this.num(data, 'defiance') > 0)) {
          continue;
        }
        if (mode === 'rivalClient' && !(data.type === 'Client' && data.clientOf !== myFamily)) {
          continue;
        }
        if (mode === 'regionalOther' && data.type !== 'Regional') {
          continue;
        }
        out.push(key);
      }
      if (mode === 'any') {
        out.unshift('Self');
      }
      return out;
    },

    populateActionSelect: function() {
      var select = dojo.byId('grandarea_action_select');
      if (!select) {
        return;
      }
      var actorKey = this.myActorKey();
      var me = actorKey ? this.territories[actorKey] : null;
      var actions = this.gamedatas.allowed_actions || Object.keys(TARGET_MODES);
      var current = select.value;
      select.innerHTML = '';
      for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        if (me && !this.isActionAffordable(action, me)) {
          continue;
        }
        if (this.targetKeysFor(action).length === 0) {
          continue;
        }
        var option = document.createElement('option');
        option.value = action;
        option.textContent = action;
        select.appendChild(option);
      }
      if (current) {
        select.value = current;
      }
      if (!select.value && select.options.length) {
        select.value = select.options[0].value;
      }
      this.populateTargetSelect();
    },

    populateTargetSelect: function() {
      var select = dojo.byId('grandarea_target_select');
      var actionSelect = dojo.byId('grandarea_action_select');
      if (!select || !actionSelect) {
        return;
      }
      var action = actionSelect.value || 'Pass';
      var targets = this.targetKeysFor(action);
      var current = select.value;
      select.innerHTML = '';
      for (var i = 0; i < targets.length; i++) {
        var option = document.createElement('option');
        option.value = targets[i];
        option.textContent = targets[i];
        select.appendChild(option);
      }
      if (targets.indexOf(current) !== -1) {
        select.value = current;
      } else if (this.selectedTerritory && targets.indexOf(this.selectedTerritory) !== -1) {
        select.value = this.selectedTerritory;
      }
      var preview = dojo.byId('grandarea_action_preview');
      if (preview) {
        var key = select.value === 'Self' ? this.myActorKey() : select.value;
        var data = key ? this.territories[key] : null;
        preview.innerHTML = data
          ? this.escapeText('Target ' + key + ': wealth ' + this.num(data, 'wealth')
            + ', happiness ' + this.num(data, 'happiness') + ', defiance ' + this.num(data, 'defiance'))
          : '';
      }
    },

    // ------------------------------------------------------------------
    // Commit / reveal flow
    // ------------------------------------------------------------------

    storageKey: function(round) {
      var table = this.table_id || (this.gamedatas && this.gamedatas.tableid)
        || (window.location.href.replace(/\D/g, '').slice(-10)) || 'table';
      return 'grandarea_' + table + '_p' + this.player_id + '_r' + round;
    },

    refreshCommitStatus: function() {
      var node = dojo.byId('grandarea_commit_status');
      if (!node) {
        return;
      }
      var stored = null;
      try {
        stored = window.localStorage.getItem(this.storageKey(this.currentRound));
      } catch (e) {
        stored = null;
      }
      if (stored) {
        node.innerHTML = this.escapeText(_('Secret action stored in this browser — reveal it during the reveal phase.'));
      } else {
        node.innerHTML = '';
      }
    },

    sha256Hex: function(text, onDone, onError) {
      if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) {
        onError(new Error('This browser cannot compute SHA-256 hashes'));
        return;
      }
      var bytes = new TextEncoder().encode(text);
      window.crypto.subtle.digest('SHA-256', bytes).then(function(buffer) {
        var view = new Uint8Array(buffer);
        var hex = '';
        for (var i = 0; i < view.length; i++) {
          hex += ('0' + view[i].toString(16)).slice(-2);
        }
        onDone(hex);
      }, onError);
    },

    randomNonce: function() {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) {
        hex += ('0' + bytes[i].toString(16)).slice(-2);
      }
      return hex;
    },

    onCommitClick: function(evt) {
      if (evt) {
        dojo.stopEvent(evt);
      }
      if (!this.checkAction('submitCommit', true)) {
        return;
      }
      var actionSelect = dojo.byId('grandarea_action_select');
      var targetSelect = dojo.byId('grandarea_target_select');
      var framingInput = dojo.byId('grandarea_framing');
      var payload = {
        family: this.myFamily,
        action: (actionSelect && actionSelect.value) || 'Pass',
        target: (targetSelect && targetSelect.value) || 'Self',
        framing: Math.max(0, parseInt(framingInput && framingInput.value, 10) || 0)
      };
      var payloadStr = JSON.stringify(payload);
      var nonce = this.randomNonce();
      var round = this.currentRound;
      var self = this;
      this.sha256Hex(this.player_id + '|' + payloadStr + '|' + nonce, function(hash) {
        try {
          window.localStorage.setItem(self.storageKey(round), JSON.stringify({ payload: payloadStr, nonce: nonce }));
        } catch (e) {
          self.showMessage(_('Could not store the secret locally; you will not be able to reveal it.'), 'error');
          return;
        }
        self.ajaxcall('/grandareagame/grandareagame/submitCommit.html', {
          lock: true,
          hash: hash
        }, self, function() {
          self.refreshCommitStatus();
        }, function() {});
      }, function() {
        self.showMessage(_('Unable to compute the commitment hash in this browser.'), 'error');
      });
    },

    onRevealClick: function(evt) {
      if (evt) {
        dojo.stopEvent(evt);
      }
      if (!this.checkAction('reveal', true)) {
        return;
      }
      var stored = null;
      try {
        stored = window.localStorage.getItem(this.storageKey(this.currentRound));
      } catch (e) {
        stored = null;
      }
      var record = null;
      try {
        record = stored ? JSON.parse(stored) : null;
      } catch (e) {
        record = null;
      }
      if (!record || !record.payload || !record.nonce) {
        this.showMessage(_('No stored secret found in this browser for this round — use End turn instead.'), 'error');
        return;
      }
      this.ajaxcall('/grandareagame/grandareagame/reveal.html', {
        lock: true,
        payload: record.payload,
        nonce: record.nonce
      }, this, function() {}, function() {});
    },

    onSmearClick: function(evt) {
      if (evt) {
        dojo.stopEvent(evt);
      }
      this.submitSpin('smear');
    },

    onWhitewashClick: function(evt) {
      if (evt) {
        dojo.stopEvent(evt);
      }
      this.submitSpin('whitewash');
    },

    submitSpin: function(stance) {
      if (!this.checkAction('submitSpin', true)) {
        return;
      }
      if (!this.selectedTerritory) {
        this.showMessage(_('Select the territory whose story you want to spin.'), 'error');
        return;
      }
      if (stance === 'smear' && this.selectedTerritory === this.myActorKey()) {
        this.showMessage(_('You cannot smear your own story.'), 'error');
        return;
      }
      this.ajaxcall('/grandareagame/grandareagame/submitSpin.html', {
        lock: true,
        stance: stance,
        target: this.selectedTerritory
      }, this, function() {}, function() {});
    },

    onEndTurnClick: function(evt) {
      if (evt) {
        dojo.stopEvent(evt);
      }
      if (!this.checkAction('endTurn', true)) {
        return;
      }
      this.ajaxcall('/grandareagame/grandareagame/endTurn.html', { lock: true }, this, function() {}, function() {});
    },

    onPlayCard: function(cardId, def) {
      if (!this.checkAction('playCard', true)) {
        return;
      }
      var target = 'Self';
      if (def && def.target === 'Other') {
        if (!this.selectedTerritory) {
          this.showMessage(_('Select a target territory on the map first.'), 'error');
          return;
        }
        target = this.selectedTerritory;
      }
      this.ajaxcall('/grandareagame/grandareagame/playCard.html', {
        lock: true,
        card_id: cardId,
        target: target
      }, this, function() {}, function() {});
    },

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    cardDefById: function(cardId) {
      var defs = this.gamedatas.card_defs || [];
      for (var i = 0; i < defs.length; i++) {
        if (defs[i].id === cardId) {
          return defs[i];
        }
      }
      return null;
    },

    escapeText: function(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    logLine: function(text) {
      var container = dojo.byId('grandarea_log');
      if (!container) {
        return;
      }
      dojo.create('div', {
        'class': 'grandarea-log-entry',
        innerHTML: this.escapeText(text)
      }, container, 'first');
    },

    logLines: function(lines) {
      if (!lines || !lines.length) {
        return;
      }
      for (var i = 0; i < lines.length; i++) {
        this.logLine(lines[i]);
      }
    },

    applyTerritoryUpdate: function(territories) {
      if (territories) {
        this.territories = territories;
        this.renderTerritories();
        this.populateActionSelect();
      }
    },

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------

    setupNotifications: function() {
      dojo.subscribe('crisisDrawn', this, 'notif_crisisDrawn');
      dojo.subscribe('tributeResolved', this, 'notif_tributeResolved');
      dojo.subscribe('actionSubmissionOpen', this, 'notif_actionSubmissionOpen');
      dojo.subscribe('revealOpen', this, 'notif_revealOpen');
      dojo.subscribe('narrativeBattle', this, 'notif_narrativeBattle');
      dojo.subscribe('spinSubmitted', this, 'notif_spinSubmitted');
      dojo.subscribe('commitSubmitted', this, 'notif_commitSubmitted');
      dojo.subscribe('playerRevealed', this, 'notif_playerRevealed');
      dojo.subscribe('playerEndedTurn', this, 'notif_playerEndedTurn');
      dojo.subscribe('cardPlayed', this, 'notif_cardPlayed');
      dojo.subscribe('handUpdate', this, 'notif_handUpdate');
      dojo.subscribe('handCounts', this, 'notif_handCounts');
      dojo.subscribe('roundResolved', this, 'notif_roundResolved');
      dojo.subscribe('cleanupResolved', this, 'notif_cleanupResolved');
      dojo.subscribe('roundAdvanced', this, 'notif_roundAdvanced');
      dojo.subscribe('gameEnded', this, 'notif_gameEnded');
    },

    notif_crisisDrawn: function(notif) {
      this.renderCrisisCard(notif.args.card || null);
      this.renderForecast(notif.args.next_card || null);
      this.logLine(notif.args.card_id
        ? 'Crisis drawn: ' + (notif.args.card && notif.args.card.title ? notif.args.card.title : notif.args.card_id)
        : 'No crisis card available this round.');
    },

    notif_tributeResolved: function(notif) {
      this.logLines(notif.args.logs || []);
    },

    notif_actionSubmissionOpen: function(notif) {
      this.logLine('Secret action submission is open.');
      this.populateActionSelect();
    },

    notif_revealOpen: function(notif) {
      this.logLine('Reveal phase is open.');
    },

    notif_narrativeBattle: function(notif) {
      this.logLine('Narrative battle: spin a revealed story or pass.');
    },

    notif_spinSubmitted: function(notif) {
      var args = notif.args || {};
      this.logLine((args.family || 'A player') + ' ' + (args.stance === 'smear' ? 'smears' : 'whitewashes')
        + ' ' + (args.target || 'a story') + '.');
    },

    notif_commitSubmitted: function(notif) {
      this.logLine('A player locked in a secret action.');
    },

    notif_playerRevealed: function(notif) {
      var action = notif.args.action || {};
      this.logLine('A player revealed: ' + (action.action || 'Pass')
        + (action.target ? ' -> ' + action.target : ''));
    },

    notif_playerEndedTurn: function(notif) {
      this.logLine('A player finished the phase.');
    },

    notif_cardPlayed: function(notif) {
      this.logLines(notif.args.logs || []);
    },

    notif_handUpdate: function(notif) {
      this.renderHand(notif.args.hand || []);
    },

    notif_handCounts: function(notif) {
      this.gamedatas.hand_counts = notif.args.hand_counts || {};
    },

    notif_roundResolved: function(notif) {
      this.renderCrisisCard(null);
      this.logLines(notif.args.resolution_logs || []);
      this.applyTerritoryUpdate(notif.args.territories);
    },

    notif_cleanupResolved: function(notif) {
      this.logLines(notif.args.logs || []);
      this.applyTerritoryUpdate(notif.args.territories);
    },

    notif_roundAdvanced: function(notif) {
      this.currentRound = parseInt(notif.args.round, 10) || (this.currentRound + 1);
      this.renderRound();
      this.refreshCommitStatus();
      this.logLine('Round ' + this.currentRound + ' begins.');
    },

    notif_gameEnded: function(notif) {
      this.logLine('The game is over.');
      var summary = notif.args.summary || [];
      for (var i = 0; i < summary.length; i++) {
        var entry = summary[i];
        this.logLine((entry.family || '?') + ': ' + (entry.won ? 'objective met' : (entry.surviving ? 'survived' : 'eliminated'))
          + ' (wealth ' + entry.wealth + ')');
      }
    }
  });
});
