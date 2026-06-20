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
      this.setupNotifications();
    },

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

    setupNotifications: function() {
      dojo.subscribe('crisisDrawn', this, 'notif_crisisDrawn');
      dojo.subscribe('tributeResolved', this, 'notif_tributeResolved');
      dojo.subscribe('commitSubmitted', this, 'notif_commitSubmitted');
      dojo.subscribe('playerRevealed', this, 'notif_playerRevealed');
      dojo.subscribe('roundResolved', this, 'notif_roundResolved');
      dojo.subscribe('roundAdvanced', this, 'notif_roundAdvanced');
    },

    notif_crisisDrawn: function(notif) {
      this.addLogToClass('Crisis drawn: ' + notif.args.card_id, 'grandarea-log');
    },

    notif_tributeResolved: function(notif) {
      this.addLogToClass((notif.args.logs || []).join('<br>'), 'grandarea-log');
    },

    notif_commitSubmitted: function(notif) {
      this.addLogToClass('Player submitted a secret action.', 'grandarea-log');
    },

    notif_playerRevealed: function(notif) {
      this.addLogToClass('Player revealed an action.', 'grandarea-log');
    },

    notif_roundResolved: function(notif) {
      this.addLogToClass('Round resolved with seed ' + notif.args.seed, 'grandarea-log');
    },

    notif_roundAdvanced: function(notif) {
      this.addLogToClass('Round ' + notif.args.round + ' begins.', 'grandarea-log');
    }
  });
});
