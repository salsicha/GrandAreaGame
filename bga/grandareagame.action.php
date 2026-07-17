<?php
/**
 * BGA AJAX action entrypoints.
 *
 * This file intentionally delegates validation and persistence to
 * GrandAreaGame so action handlers remain thin and non-authoritative.
 */

class action_grandareagame extends APP_GameAction
{
    public function __default()
    {
        if (self::isArg('notifwindow')) {
            $this->view = 'common_notifwindow';
            $this->viewArgs['table'] = self::getArg('table', AT_posint, true);
        } else {
            $this->view = 'grandareagame_grandareagame';
        }
    }

    public function submitCommit()
    {
        self::setAjaxMode();
        $hash = self::getArg('hash', AT_alphanum, true);
        $this->game->submitCommit($hash);
        self::ajaxResponse();
    }

    public function reveal()
    {
        self::setAjaxMode();
        $payload = self::getArg('payload', AT_json, true);
        $nonce = self::getArg('nonce', AT_alphanum, true);
        $this->game->revealActionPayload($payload, $nonce);
        self::ajaxResponse();
    }

    public function playCard()
    {
        self::setAjaxMode();
        $cardId = self::getArg('card_id', AT_alphanum, true);
        $target = self::getArg('target', AT_alphanum, true);
        $this->game->playCard($cardId, $target);
        self::ajaxResponse();
    }

    public function submitSpin()
    {
        self::setAjaxMode();
        $stance = self::getArg('stance', AT_alphanum, true);
        $target = self::getArg('target', AT_alphanum, true);
        $this->game->submitSpin($stance, $target);
        self::ajaxResponse();
    }

    public function endTurn()
    {
        self::setAjaxMode();
        $this->game->endTurn();
        self::ajaxResponse();
    }
}
