<?php
/**
 * Main BGA server-side game class for Grand Area.
 *
 * The browser prototype can preview rules, but production BGA play resolves
 * actions through GrandAreaRules here and persists the resulting public state.
 */

require_once 'modules/php/constants.inc.php';
require_once 'modules/php/GrandAreaRules.php';
require_once 'states.inc.php';

class GrandAreaGame extends Table
{
    public function __construct()
    {
        parent::__construct();
        self::initGameStateLabels(array(
            'round_number' => 10,
            'phase_index' => 11,
            'resolution_seed' => 12
        ));
    }

    public function setupNewGame($players, $options = array())
    {
        $gameId = intval(self::getGameId());
        $territories = $this->loadMaterialJson('territories.json');
        $crisis = $this->loadMaterialJson('crisis.json');
        $cards = $this->loadMaterialJson('playercards.json');

        foreach ($territories as $key => $data) {
            $this->upsertTerritory($gameId, $key, $data);
        }

        foreach ($players as $playerId => $player) {
            $family = $this->assignFamilyForPlayer($playerId, $territories);
            $sql = "REPLACE INTO player_state (game_id, player_id, family_name, hand_json, stash, socialCapital, politicalCapital) VALUES ("
                . $gameId . ", "
                . intval($playerId) . ", "
                . $this->sqlString($family) . ", "
                . $this->sqlString('[]') . ", 0, 0, 0)";
            self::DbQuery($sql);
        }

        $this->persistRuntime('crisis_draw', $this->shuffleIds($crisis, 'setup-' . $gameId));
        $this->persistRuntime('crisis_discard', array());
        $this->persistRuntime('player_deck', $this->buildPlayerDeck($cards, 'cards-' . $gameId));
        $this->persistRuntime('revealed_payloads', array());

        self::setGameStateInitialValue('round_number', 1);
        self::setGameStateInitialValue('phase_index', 0);
        self::setGameStateInitialValue('resolution_seed', 0);
    }

    public function stCrisis()
    {
        $draw = $this->loadRuntime('crisis_draw', array());
        $discard = $this->loadRuntime('crisis_discard', array());
        $cardId = array_shift($draw);
        if ($cardId === null && count($discard) > 0) {
            $draw = $this->shuffleIdsFromIds($discard, $this->seedFor('crisis-reshuffle'));
            $discard = array();
            $cardId = array_shift($draw);
        }

        $this->persistRuntime('crisis_draw', $draw);
        $this->persistRuntime('crisis_discard', $discard);
        $this->persistRuntime('current_crisis', $cardId);
        self::notifyAllPlayers('crisisDrawn', '', array('card_id' => $cardId));
    }

    public function stTribute()
    {
        $result = GrandAreaRules::resolveTribute($this->loadTerritoryState());
        $this->persistTerritoryState($result['newState']);
        self::notifyAllPlayers('tributeResolved', '', array('logs' => $result['logs']));
    }

    public function stActionSubmission()
    {
        self::notifyAllPlayers('actionSubmissionOpen', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
    }

    public function stReveal()
    {
        self::notifyAllPlayers('revealOpen', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
    }

    public function stResolution()
    {
        $this->resolveRevealedRound();
    }

    public function stCleanup()
    {
        self::setGameStateValue('round_number', intval(self::getGameStateValue('round_number')) + 1);
        self::setGameStateValue('phase_index', 0);
        self::notifyAllPlayers('roundAdvanced', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
    }

    public function submitCommit($hash)
    {
        if (!preg_match(GRANDAREA_COMMIT_HASH_REGEX, $hash)) {
            throw new BgaUserException('Commit hash must be a lowercase SHA-256 hash');
        }

        $gameId = intval(self::getGameId());
        $playerId = intval(self::getCurrentPlayerId());
        $sql = "REPLACE INTO secret_submissions (game_id, player_id, commit_hash, submitted_at, revealed) VALUES ("
            . $gameId . ", "
            . $playerId . ", "
            . $this->sqlString($hash) . ", NOW(), 0)";
        self::DbQuery($sql);

        self::notifyAllPlayers('commitSubmitted', '', array('player_id' => $playerId));
    }

    public function revealActionPayload($payload, $nonce)
    {
        if (strlen($payload) > GRANDAREA_MAX_REVEAL_BYTES) {
            throw new BgaUserException('Reveal payload is too large');
        }

        $gameId = intval(self::getGameId());
        $playerId = intval(self::getCurrentPlayerId());
        $expected = hash('sha256', $gameId . '|' . $playerId . '|' . $payload . '|' . $nonce);
        $row = self::getObjectFromDb(
            "SELECT commit_hash FROM secret_submissions WHERE game_id = " . $gameId . " AND player_id = " . $playerId,
            true
        );
        $stored = $row ? $row['commit_hash'] : null;
        if (!$stored || $expected !== $stored) {
            throw new BgaUserException('Reveal does not match commit');
        }

        $decoded = json_decode($payload, true);
        $validated = $this->validateRevealPayload($decoded, $playerId);
        $sql = "UPDATE secret_submissions SET revealed = 1, reveal_payload = "
            . $this->sqlString(json_encode($validated))
            . " WHERE game_id = " . $gameId . " AND player_id = " . $playerId;
        self::DbQuery($sql);

        self::notifyAllPlayers('playerRevealed', '', array(
            'player_id' => $playerId,
            'action' => array('action' => $validated['action'], 'target' => $validated['target'])
        ));
    }

    public function playCard($cardId, $target)
    {
        $playerId = intval(self::getCurrentPlayerId());
        self::notifyPlayer($playerId, 'cardQueued', '', array(
            'card_id' => $cardId,
            'target' => $target
        ));
    }

    public function endTurn()
    {
        self::notifyAllPlayers('playerEndedTurn', '', array(
            'player_id' => intval(self::getCurrentPlayerId())
        ));
    }

    public function resolveRevealedRound()
    {
        $gameId = intval(self::getGameId());
        $rows = self::getCollectionFromDb(
            "SELECT player_id, reveal_payload FROM secret_submissions WHERE game_id = " . $gameId . " AND revealed = 1"
        );
        $actions = array();
        foreach ($rows as $row) {
            $payload = json_decode($row['reveal_payload'], true);
            if (is_array($payload)) {
                $actions[] = $payload;
            }
        }

        $seed = $this->seedFor('resolution');
        self::setGameStateValue('resolution_seed', crc32($seed));

        $state = $this->loadTerritoryState();
        $resolution = GrandAreaRules::resolveTurn($state, $actions, $seed);
        $cleanup = GrandAreaRules::resolveCleanup($resolution['newState'], $seed . ':cleanup');
        $this->persistTerritoryState($cleanup['newState']);
        $this->persistRuntime('revealed_payloads', $actions);

        self::notifyAllPlayers('roundResolved', '', array(
            'seed' => $seed,
            'resolution_logs' => $resolution['logs'],
            'cleanup_logs' => $cleanup['logs']
        ));
    }

    private function validateRevealPayload($decoded, $playerId)
    {
        if (!is_array($decoded)) {
            throw new BgaUserException('Reveal payload must be JSON');
        }

        $family = $this->familyForPlayer($playerId);
        $decoded['family'] = isset($decoded['family']) ? $decoded['family'] : $family;
        if ($decoded['family'] !== $family) {
            throw new BgaUserException('Reveal family does not match player assignment');
        }

        $state = $this->loadTerritoryState();
        $validated = GrandAreaRules::validateActions($state, array($decoded));
        return $validated[0];
    }

    private function loadTerritoryState()
    {
        $gameId = intval(self::getGameId());
        $rows = self::getCollectionFromDb("SELECT * FROM territories WHERE game_id = " . $gameId);
        $state = array();
        foreach ($rows as $row) {
            $key = $row['territory_key'];
            $row['resources'] = json_decode($row['resources_json'], true);
            $row['resourceNeeds'] = json_decode($row['resource_needs_json'], true);
            $row['neighbors'] = json_decode($row['neighbors_json'], true);
            $row['protected'] = intval($row['protected']) === 1;
            $row['invaded'] = intval($row['invaded']) === 1;
            $state[$key] = $row;
        }
        return $state;
    }

    private function persistTerritoryState($state)
    {
        $gameId = intval(self::getGameId());
        foreach ($state as $key => $data) {
            $this->upsertTerritory($gameId, $key, $data);
        }
    }

    private function upsertTerritory($gameId, $key, $data)
    {
        $columns = array(
            'game_id' => intval($gameId),
            'territory_key' => $this->sqlString($key),
            'family' => $this->sqlString($this->value($data, 'family', '')),
            'type' => $this->sqlString($this->value($data, 'type', '')),
            'clientOf' => $this->nullableSqlString($this->value($data, 'clientOf', null)),
            'resources_json' => $this->sqlString(json_encode($this->value($data, 'resources', array()))),
            'resource_needs_json' => $this->sqlString(json_encode($this->value($data, 'resourceNeeds', array()))),
            'neighbors_json' => $this->sqlString(json_encode($this->value($data, 'neighbors', array()))),
            'wealth' => intval($this->value($data, 'wealth', 0)),
            'happiness' => intval($this->value($data, 'happiness', 0)),
            'stash' => intval($this->value($data, 'stash', 0)),
            'blackBudget' => intval($this->value($data, 'blackBudget', 0)),
            'socialCapital' => intval($this->value($data, 'socialCapital', 0)),
            'politicalCapital' => intval($this->value($data, 'politicalCapital', 0)),
            'education' => intval($this->value($data, 'education', 0)),
            'development' => intval($this->value($data, 'development', 0)),
            'debt' => intval($this->value($data, 'debt', 0)),
            'tributeHoliday' => intval($this->value($data, 'tributeHoliday', 0)),
            'protectionDeal' => intval($this->value($data, 'protectionDeal', 0)),
            'realignmentPressure' => intval($this->value($data, 'realignmentPressure', 0)),
            'rivalryPressure' => intval($this->value($data, 'rivalryPressure', 0)),
            'independenceSentiment' => intval($this->value($data, 'independenceSentiment', 0)),
            'governanceChangeSentiment' => intval($this->value($data, 'governanceChangeSentiment', 0)),
            'factionalDivision' => intval($this->value($data, 'factionalDivision', 0)),
            'fear' => intval($this->value($data, 'fear', 0)),
            'defiance' => intval($this->value($data, 'defiance', 0)),
            'armies' => intval($this->value($data, 'armies', 0)),
            'invaded' => $this->truthy($this->value($data, 'invaded', false)),
            'protected' => $this->truthy($this->value($data, 'protected', false)),
            'protectedBy' => $this->nullableSqlString($this->value($data, 'protectedBy', null)),
            'sanctioned' => $this->truthy($this->value($data, 'sanctioned', false)),
            'outcome' => $this->nullableSqlString($this->value($data, 'outcome', null))
        );

        $sql = "REPLACE INTO territories (" . implode(', ', array_keys($columns)) . ") VALUES (" . implode(', ', array_values($columns)) . ")";
        self::DbQuery($sql);
    }

    private function loadMaterialJson($file)
    {
        $path = dirname(__DIR__) . '/frontend/data/' . $file;
        if (!file_exists($path)) {
            $path = __DIR__ . '/../frontend/data/' . $file;
        }
        $json = file_get_contents($path);
        $data = json_decode($json, true);
        if (!is_array($data)) {
            throw new BgaVisibleSystemException('Invalid material file: ' . $file);
        }
        return $data;
    }

    private function persistRuntime($key, $value)
    {
        $sql = "REPLACE INTO game_runtime (game_id, state_key, state_json) VALUES ("
            . intval(self::getGameId()) . ", "
            . $this->sqlString($key) . ", "
            . $this->sqlString(json_encode($value)) . ")";
        self::DbQuery($sql);
    }

    private function loadRuntime($key, $default)
    {
        $row = self::getObjectFromDb(
            "SELECT state_json FROM game_runtime WHERE game_id = " . intval(self::getGameId()) . " AND state_key = " . $this->sqlString($key),
            true
        );
        if (!$row) {
            return $default;
        }
        $decoded = json_decode($row['state_json'], true);
        return $decoded === null ? $default : $decoded;
    }

    private function buildPlayerDeck($cards, $seed)
    {
        $ids = array();
        foreach ($cards as $card) {
            for ($i = 0; $i < 3; $i++) {
                $ids[] = $card['id'];
            }
        }
        return $this->shuffleIdsFromIds($ids, $seed);
    }

    private function shuffleIds($records, $seed)
    {
        $ids = array();
        foreach ($records as $record) {
            $ids[] = $record['id'];
        }
        return $this->shuffleIdsFromIds($ids, $seed);
    }

    private function shuffleIdsFromIds($ids, $seed)
    {
        usort($ids, function ($a, $b) use ($seed) {
            $aRoll = GrandAreaRules::seededRoll($seed, $a);
            $bRoll = GrandAreaRules::seededRoll($seed, $b);
            if ($aRoll === $bRoll) {
                return strcmp($a, $b);
            }
            return $aRoll < $bRoll ? -1 : 1;
        });
        return $ids;
    }

    private function seedFor($purpose)
    {
        return intval(self::getGameId()) . ':' . intval(self::getGameStateValue('round_number')) . ':' . $purpose;
    }

    private function assignFamilyForPlayer($playerId, $territories)
    {
        $families = array();
        foreach ($territories as $territory) {
            $families[] = $territory['family'];
        }
        $families = array_values(array_unique($families));
        sort($families);
        return $families[intval($playerId) % count($families)];
    }

    private function familyForPlayer($playerId)
    {
        $row = self::getObjectFromDb(
            "SELECT family_name FROM player_state WHERE game_id = " . intval(self::getGameId()) . " AND player_id = " . intval($playerId),
            true
        );
        if (!$row) {
            throw new BgaUserException('Player has no assigned family');
        }
        return $row['family_name'];
    }

    private function sqlString($value)
    {
        return "'" . self::escapeStringForDB(strval($value)) . "'";
    }

    private function nullableSqlString($value)
    {
        return $value === null ? 'NULL' : $this->sqlString($value);
    }

    private function truthy($value)
    {
        return $value ? 1 : 0;
    }

    private function value($data, $key, $default)
    {
        return array_key_exists($key, $data) ? $data[$key] : $default;
    }
}
