<?php
/**
 * grandareagame.action.php
 * Minimal action entrypoints for BGA client AJAX calls.
 * Implement endpoints: submitCommit, reveal, playCard, endTurn, etc.
 */

require_once 'modules/php/constants.inc.php';
require_once 'grandareagame.game.php';

$action = Utils::getParam('action', '');

switch($action){
    case 'submitCommit':{
        // Client submits a commit hash for their secret action
        // Params: hash
        $hash = Utils::getParam('hash', '');
        if($hash == ''){
            throw new BgaUserException('Missing commit hash');
        }

        $player_id = intval(self::getCurrentPlayerId());
        $game_id = intval(self::getGameId());

        // store or replace commit for this player
        $hash_esc = addslashes($hash);
        $sql = "REPLACE INTO secret_submissions (game_id, player_id, commit_hash, submitted_at, revealed) VALUES ($game_id, $player_id, '$hash_esc', NOW(), 0)";
        self::DbQuery($sql);

        // notify players (notification name should be defined in notifications.inc.php)
        self::notifyAllPlayers('commitSubmitted', $player_id, array('player_id' => $player_id));
        break;
    }
    case 'reveal':{
        // Client reveals their payload and nonce
        // Params: payload (JSON string), nonce
        $payload = Utils::getParam('payload', '');
        $nonce = Utils::getParam('nonce', '');
        if($payload == ''){
            throw new BgaUserException('Missing reveal payload');
        }

        $player_id = intval(self::getCurrentPlayerId());
        $game_id = intval(self::getGameId());

        // recompute expected hash. Use the same construction used on client: gameId|playerId|payload|nonce
        $expected = hash('sha256', $game_id . '|' . $player_id . '|' . $payload . '|' . $nonce);

        // fetch stored commit
        $sql = "SELECT commit_hash FROM secret_submissions WHERE game_id = $game_id AND player_id = $player_id";
        $row = self::getObjectFromDb($sql, true);
        $stored = $row ? $row['commit_hash'] : null;
        if(!$stored){
            throw new BgaUserException('No commit found for this player');
        }

        if($expected !== $stored){
            // mismatch: invalid reveal
            throw new BgaUserException('Reveal does not match commit');
        }

        // store revealed payload and mark revealed
        $payload_esc = addslashes($payload);
        $sql = "UPDATE secret_submissions SET revealed = 1, reveal_payload = '$payload_esc' WHERE game_id = $game_id AND player_id = $player_id";
        self::DbQuery($sql);

        // parse payload (expected JSON like {action:..., target:..., nonce:...}) for notification
        $actionSummary = null;
        $decoded = json_decode($payload, true);
        if($decoded && isset($decoded['action'])){
            $actionSummary = array('action' => $decoded['action'], 'target' => (isset($decoded['target']) ? $decoded['target'] : 'Self'));
        }

        self::notifyAllPlayers('playerRevealed', $player_id, array('player_id' => $player_id, 'action' => $actionSummary));

        break;
    }
    default:
        throw new BgaVisibleSystemException('Unknown action: '.$action);
}
