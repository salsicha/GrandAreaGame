<?php
// Exercise the real server entry points without a running BGA table. The Table
// double supplies fixture reads and records writes/notifications for assertions.
function expect($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

class BgaUserException extends Exception {}

class Table
{
    public static $players;
    public static $territories;
    public static $currentPlayer = 1;
    public static $notifications = array();
    public static $writes = array();
    public static $commit = null;
    public static $secretSalt = 'regression-secret-salt';
    public $gamestate;
    public $territoryMaterial;
    public $crisisMaterial;
    public $playerCardMaterial;
    public $setupMaterial;
    public $balanceMaterial;
    public $agendaMaterial;
    public $allowedActions;
    public $roundPhases;

    public function __construct()
    {
        require __DIR__ . '/../bga/material.inc.php';
        $this->gamestate = new class {
            public function nextState($transition) {}
            public function setPlayerNonMultiactive($playerId, $transition) {}
        };
    }

    public static function initGameStateLabels($labels) {}
    public static function checkAction($action) {}
    public static function incStat($amount, $name, $playerId = null) {}
    public static function setGameStateValue($name, $value) {}
    public static function getGameStateValue($name) { return 1; }
    public static function getCurrentPlayerId() { return self::$currentPlayer; }
    public static function escapeStringForDB($value) { return str_replace("'", "''", $value); }
    public static function DbQuery($sql) { self::$writes[] = $sql; }

    public static function getObjectListFromDB($sql)
    {
        if (strpos($sql, 'FROM player_state') !== false) {
            return self::$players;
        }
        if (strpos($sql, 'FROM secret_submissions') !== false) {
            return array();
        }
        if (strpos($sql, 'FROM territories') !== false) {
            $rows = array();
            foreach (self::$territories as $key => $data) {
                $data['game_id'] = 0;
                $data['territory_key'] = $key;
                foreach (array('resources' => 'resources_json', 'resourceNeeds' => 'resource_needs_json', 'neighbors' => 'neighbors_json') as $field => $column) {
                    $data[$column] = json_encode(isset($data[$field]) ? $data[$field] : array());
                    unset($data[$field]);
                }
                foreach (array('protected', 'invaded', 'sanctioned', 'failedState') as $field) {
                    $data[$field] = !empty($data[$field]) ? 1 : 0;
                }
                $rows[] = $data;
            }
            return $rows;
        }
        throw new RuntimeException('Unexpected query: ' . $sql);
    }

    public static function getObjectFromDb($sql, $single = false)
    {
        if (strpos($sql, 'FROM game_runtime') !== false) {
            if (strpos($sql, "'secret_salt'") !== false) return array('state_json' => json_encode(self::$secretSalt));
            return null;
        }
        if (strpos($sql, 'FROM secret_submissions') !== false) {
            return self::$commit;
        }
        if (strpos($sql, 'FROM player_state') !== false) {
            preg_match('/player_id = (\d+)/', $sql, $match);
            foreach (self::$players as $player) {
                if ($player['player_id'] === intval($match[1])) {
                    return $player;
                }
            }
            return null;
        }
        throw new RuntimeException('Unexpected query: ' . $sql);
    }

    public static function getCollectionFromDb($sql)
    {
        return array(1 => array('id' => 1, 'name' => 'Alice'), 2 => array('id' => 2, 'name' => 'Bob'));
    }

    public static function notifyAllPlayers($type, $message, $args)
    {
        self::$notifications[] = array('recipient' => null, 'type' => $type, 'args' => $args);
    }

    public static function notifyPlayer($playerId, $type, $message, $args)
    {
        self::$notifications[] = array('recipient' => $playerId, 'type' => $type, 'args' => $args);
    }
}

require __DIR__ . '/../bga/grandareagame.game.php';

class TestGame extends GrandAreaGame
{
    public function snapshot() { return $this->getAllDatas(); }
}

function resetGame()
{
    $game = new TestGame();
    Table::$players = array(
        array('player_id' => 1, 'family_name' => 'USA', 'hand_json' => '["counterintelligence"]', 'agenda_id' => 'arsenal'),
        array('player_id' => 2, 'family_name' => 'China', 'hand_json' => '[]', 'agenda_id' => 'shadow_banker')
    );
    Table::$territories = $game->territoryMaterial;
    Table::$currentPlayer = 1;
    Table::$notifications = array();
    Table::$writes = array();
    Table::$commit = null;
    return $game;
}

function expectVisibility($state, $family)
{
    foreach ($state as $key => $data) {
        $owns = $family !== null && $data['family'] === $family;
        expect(array_key_exists('blackBudget', $data) === $owns, 'Wrong Black Budget visibility for ' . $key);
        expect(isset($data['wealth']), 'Public wealth missing for ' . $key);
    }
}

function notification($type, $recipient = null)
{
    foreach (Table::$notifications as $entry) {
        if ($entry['type'] === $type && $entry['recipient'] === $recipient) {
            return $entry['args'];
        }
    }
    throw new RuntimeException('Missing notification: ' . $type);
}

function expectNotificationPrivacy($type)
{
    foreach (Table::$notifications as $entry) {
        expect(strpos(json_encode($entry['args']), Table::$secretSalt) === false, 'Secret salt leaked in ' . $entry['type']);
        expect(strpos(json_encode($entry['args']), 'Using replay seed:') === false, 'Replay seed leaked in ' . $entry['type']);
    }
    expectVisibility(notification($type)['territories'], null);
    expectVisibility(notification('privateTerritories', 1)['territories'], 'USA');
    expectVisibility(notification('privateTerritories', 2)['territories'], 'China');
}

$game = resetGame();
foreach (array(1 => 'USA', 2 => 'China', 99 => null) as $playerId => $family) {
    Table::$currentPlayer = $playerId;
    $snapshot = $game->snapshot();
    expectVisibility($snapshot['territories'], $family);
    expect(count($snapshot['hand']) === ($playerId === 1 ? 1 : 0), 'Private hand visibility changed');
    expect(($snapshot['agenda'] !== null) === ($family !== null), 'Private agenda visibility changed');
}
// Ownership can change after a coup. The former owner must lose visibility.
Table::$territories['NorthAmerica']['family'] = 'China';
Table::$currentPlayer = 1;
expectVisibility($game->snapshot()['territories'], 'USA');
Table::$currentPlayer = 2;
expectVisibility($game->snapshot()['territories'], 'China');
echo "[PASS] Server snapshots protect Black Budget for owners, opponents, spectators, and coups\n";

$game = resetGame();
$game->stTribute();
expectNotificationPrivacy('tributeResolved');
$public = notification('tributeResolved')['territories'];
expect($public['LatinAmerica']['wealth'] === 84, 'Tribute notification omitted updated client wealth');
expect($public['NorthAmerica']['wealth'] === 243, 'Tribute notification omitted updated overlord wealth');

$game = resetGame();
$game->playCard('counterintelligence', 'Self');
expectNotificationPrivacy('cardPlayed');
$private = notification('privateTerritories', 1)['territories'];
expect($private['NorthAmerica']['blackBudget'] === 38, 'Card notification omitted updated private budget');
expect(notification('cardPlayed')['territories']['NorthAmerica']['factionalDivision'] === 20, 'Card notification omitted public effect');
expect(notification('handUpdate', 1)['hand'] === array(), 'Played card not removed from hand');

$game = resetGame();
$game->resolveRevealedRound();
expectNotificationPrivacy('roundResolved');
$game = resetGame();
$game->stCleanup();
expectNotificationPrivacy('cleanupResolved');
echo "[PASS] Tribute, cards, resolution, and cleanup refresh state without leaking budgets\n";

$game = resetGame();
$endGame = new ReflectionMethod(GrandAreaGame::class, 'maybeEndGame');
$endGame->setAccessible(true);
$state = Table::$territories;
$state['WesternEurope']['politicalCapital'] = 140;
$state = GrandAreaRules::evaluateObjectives($state)['newState'];
expect($state['WesternEurope']['outcome'] === 'Won', 'NPC victory fixture did not meet its objective');
expect($endGame->invoke($game, $state) === false, 'Unassigned EU ended a USA/China game');
expect(count(Table::$writes) === 0, 'NPC victory changed player scores');
$state['EastAsia']['outcome'] = 'Won';
expect($endGame->invoke($game, $state) === true, 'Participating winner did not end the game');
expect(notification('gameEnded')['summary'][1]['won'] === true, 'Participating winner missing from summary');
$game = resetGame();
expect($endGame->invoke($game, Table::$territories, true) === true, 'Round limit no longer ends the game');
$game = resetGame();
$state = Table::$territories;
$state['EastAsia']['outcome'] = 'Lost';
expect($endGame->invoke($game, $state) === true, 'Last surviving player no longer ends the game');
echo "[PASS] Only participating winners end games; round limits and elimination still work\n";

$game = resetGame();
$payload = json_encode(array('family' => 'USA', 'action' => 'Invade', 'target' => 'EastAsia', 'framing' => 5));
$nonce = 'testnonce';
Table::$commit = array('commit_hash' => hash('sha256', '1|' . $payload . '|' . $nonce), 'revealed' => 0);
$game->revealActionPayload($payload, $nonce);
$reveal = notification('playerRevealed');
expect($reveal['player_id'] === 1, 'Reveal omitted player identity');
expect($reveal['action']['family'] === 'NorthAmerica', 'Reveal omitted acting territory');
expect($reveal['action']['framing'] === 5, 'Reveal omitted framing');
expect($reveal['action']['target'] === 'EastAsia', 'Reveal omitted target');
echo "[PASS] Reveals publish actor identity, target, and framing\n";

$game = resetGame();
expect($game->snapshot()['commit_hash'] === null, 'Absent commitment must be null');
Table::$commit = array('commit_hash' => str_repeat('a', 64));
expect($game->snapshot()['commit_hash'] === str_repeat('a', 64), 'Reconnect omitted accepted commitment hash');
echo "[PASS] Reconnect snapshots identify the accepted commitment without exposing its preimage\n";
