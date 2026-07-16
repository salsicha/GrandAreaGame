define([
  'dojo',
  'dojo/_base/declare',
  'ebg/core/gamegui',
  'ebg/counter'
], function(dojo, declare) {
  return declare('bgagame.grandareagame', ebg.core.gamegui, {
    constructor: function() {
      this.pendingAction = null;
    },

    setup: function(gamedatas) {
      this.gamedatas = gamedatas;
      this.renderRound(gamedatas.round);
      this.renderCrisis(gamedatas.current_crisis);

      var endTurnButton = dojo.byId('grandarea_endturn');
      if (endTurnButton) {
        dojo.connect(endTurnButton, 'onclick', this, 'onEndTurnClick');
      }

      this.setupNotifications();
    },

    onEnteringState: function(stateName, args) {
      this.setPhaseLabel(stateName);
    },

    onLeavingState: function(stateName) {
    },

    onUpdateActionButtons: function(stateName, args) {
    },

    // ------------------------------------------------------------------
    // Server calls
    // ------------------------------------------------------------------

    submitCommit: function(hash) {
      this.ajaxcall('/grandareagame/grandareagame/submitCommit.html', {
        lock: true,
        hash: hash
      }, this, function() {}, function() {});
    },

    reveal: function(payload, nonce) {
      this.ajaxcall('/grandareagame/grandareagame/reveal.html', {
        lock: true,
        payload: payload,
        nonce: nonce
      }, this, function() {}, function() {});
    },

    playCard: function(cardId, target) {
      this.ajaxcall('/grandareagame/grandareagame/playCard.html', {
        lock: true,
        card_id: cardId,
        target: target
      }, this, function() {}, function() {});
    },

    endTurn: function() {
      this.ajaxcall('/grandareagame/grandareagame/endTurn.html', {
        lock: true
      }, this, function() {}, function() {});
    },

    onEndTurnClick: function(evt) {
      if (evt) {
        dojo.stopEvent(evt);
      }
      if (!this.checkAction('endTurn', true)) {
        return;
      }
      this.endTurn();
    },

    // ------------------------------------------------------------------
    // DOM helpers
    // ------------------------------------------------------------------

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

    setPhaseLabel: function(label) {
      var node = dojo.byId('grandarea_phase');
      if (node) {
        node.innerHTML = this.escapeText(label);
      }
    },

    renderRound: function(round) {
      var node = dojo.byId('grandarea_round');
      if (node) {
        node.innerHTML = this.escapeText('Round ' + (round || 1));
      }
    },

    renderCrisis: function(crisisId) {
      var node = dojo.byId('grandarea_crisis');
      if (node) {
        node.innerHTML = crisisId ? this.escapeText('Crisis: ' + crisisId) : '';
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
      this.renderCrisis(notif.args.card_id);
      this.logLine(notif.args.card_id
        ? 'Crisis drawn: ' + notif.args.card_id
        : 'No crisis card available this round.');
    },

    notif_tributeResolved: function(notif) {
      this.logLines(notif.args.logs || []);
    },

    notif_actionSubmissionOpen: function(notif) {
      this.logLine('Secret action submission is open.');
    },

    notif_revealOpen: function(notif) {
      this.logLine('Reveal phase is open.');
    },

    notif_narrativeBattle: function(notif) {
      this.logLine('Narrative battle: make your case at the table.');
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
      this.gamedatas.hand = notif.args.hand || [];
      var node = dojo.byId('grandarea_hidden_info');
      if (node) {
        node.innerHTML = this.escapeText('Your hand: '
          + (this.gamedatas.hand.length ? this.gamedatas.hand.join(', ') : 'empty'));
      }
    },

    notif_handCounts: function(notif) {
      this.gamedatas.hand_counts = notif.args.hand_counts || {};
    },

    notif_roundResolved: function(notif) {
      this.renderCrisis(null);
      this.logLines(notif.args.resolution_logs || []);
    },

    notif_cleanupResolved: function(notif) {
      this.logLines(notif.args.logs || []);
    },

    notif_roundAdvanced: function(notif) {
      this.renderRound(notif.args.round);
      this.logLine('Round ' + notif.args.round + ' begins.');
    },

    notif_gameEnded: function(notif) {
      this.logLine('The game is over.');
    }
  });
});
