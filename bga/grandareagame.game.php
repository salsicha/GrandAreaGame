<?php
/**
 * Main BGA server-side game class for Grand Area.
 *
 * The browser prototype can preview rules, but production BGA play resolves
 * actions through GrandAreaRules here and persists the resulting public state.
 */

require_once 'modules/php/constants.inc.php';
require_once 'modules/php/GrandAreaRules.php';

class GrandAreaGame extends Table
{
    public function __construct()
    {
        parent::__construct();
        self::initGameStateLabels(array(
            'round_number' => 10,
            'game_length' => 101
        ));
    }

    protected function getGameName()
    {
        return 'grandareagame';
    }

    /**
     * Every BGA table runs in its own database, so a literal scope id is
     * sufficient; no undocumented framework accessors are needed.
     */
    private function gameId()
    {
        return 0;
    }

    /**
     * Hard round limit from the "Game length" option; guarantees the game
     * always terminates even when no family reaches an objective.
     */
    private function roundLimit()
    {
        $option = intval(self::getGameStateValue('game_length'));
        if ($option === 2) {
            return 12;
        }
        if ($option === 3) {
            return 30;
        }
        return 20;
    }

    public function setupNewGame($players, $options = array())
    {
        $gameId = $this->gameId();
        $territories = $this->territoryMaterial;
        $crisis = $this->crisisMaterial;
        $cards = $this->playerCardMaterial;

        // Framework player table: colors, canal, name, avatar.
        $gameinfos = self::getGameinfos();
        $defaultColors = $gameinfos['player_colors'];
        $values = array();
        foreach ($players as $playerId => $player) {
            $color = array_shift($defaultColors);
            $values[] = '(' . intval($playerId) . ', ' . $this->sqlString($color) . ', '
                . $this->sqlString($player['player_canal']) . ', '
                . $this->sqlString($player['player_name']) . ', '
                . $this->sqlString($player['player_avatar']) . ')';
        }
        self::DbQuery('INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar) VALUES ' . implode(', ', $values));
        self::reloadPlayersBasicInfos();

        foreach ($territories as $key => $data) {
            $this->upsertTerritory($gameId, $key, $data);
        }

        // Secret per-game salt: mixed into every deterministic seed so
        // players cannot precompute rolls from public identifiers.
        $salt = $this->generateSecretSalt();
        $this->persistRuntime('secret_salt', $salt);

        // Collision-free family assignment in player order, from the setup
        // fixture for this player count when one exists.
        $families = $this->familiesForPlayerCount($territories, count($players));
        $seat = 0;
        foreach ($players as $playerId => $player) {
            $family = $families[$seat % count($families)];
            $seat++;
            $sql = "REPLACE INTO player_state (game_id, player_id, family_name, hand_json) VALUES ("
                . $gameId . ", "
                . intval($playerId) . ", "
                . $this->sqlString($family) . ", "
                . $this->sqlString('[]') . ")";
            self::DbQuery($sql);
        }

        $this->persistRuntime('crisis_draw', $this->shuffleIds($crisis, 'setup-crisis:' . $gameId . ':' . $salt));
        $this->persistRuntime('crisis_discard', array());
        $this->persistRuntime('current_crisis', null);
        $this->persistRuntime('player_deck', $this->buildPlayerDeck($cards, 'setup-cards:' . $gameId . ':' . $salt));
        $this->persistRuntime('card_discard', array());
        $this->persistRuntime('revealed_payloads', array());

        self::setGameStateInitialValue('round_number', 1);

        // Statistics.
        self::initStat('table', 'rounds_played', 0);
        self::initStat('table', 'crises_resolved', 0);
        self::initStat('player', 'tribute_paid', 0);
        self::initStat('player', 'actions_resolved', 0);
        self::initStat('player', 'cards_played', 0);

        // Starting hands come from the shared player deck.
        $this->dealCards($this->balanceValue('cardsDealtPerPlayerPerRound', 1));

        $this->activeNextPlayer();
    }

    // ------------------------------------------------------------------
    // State machine entry points
    // ------------------------------------------------------------------

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

        self::notifyAllPlayers('crisisDrawn', '', array(
            'card_id' => $cardId,
            'card' => $cardId !== null ? $this->crisisCardById($cardId) : null,
            'next_card' => count($draw) > 0 ? $this->crisisCardById($draw[0]) : null,
            'round' => intval(self::getGameStateValue('round_number'))
        ));

        // Round-start card deal for every player, capped at the hand limit.
        $this->dealCards($this->balanceValue('cardsDealtPerPlayerPerRound', 1));

        $this->gamestate->nextState('next');
    }

    public function stTribute()
    {
        $result = GrandAreaRules::resolveTribute($this->loadTerritoryState());
        $this->persistTerritoryState($result['newState']);

        if (isset($result['payments'])) {
            $playersByFamily = $this->playerIdsByFamily();
            foreach ($result['payments'] as $payment) {
                // Credit the receiving overlord: client blocs are not player
                // families in the shipped setups, so 'from' never matches.
                if (isset($playersByFamily[$payment['to_family']])) {
                    self::incStat($payment['amount'], 'tribute_paid', $playersByFamily[$payment['to_family']]);
                }
            }
        }

        self::notifyAllPlayers('tributeResolved', '', array('logs' => $result['logs']));
        $this->gamestate->nextState('next');
    }

    public function stActionSubmission()
    {
        self::notifyAllPlayers('actionSubmissionOpen', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
        // Activate exactly the living players in one call: activating all
        // and skipping one-by-one could fire the transition mid-loop.
        $this->gamestate->setPlayersMultiactive($this->livingPlayerIds(), 'next', true);
    }

    public function stReveal()
    {
        self::notifyAllPlayers('revealOpen', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
        // Only players holding a commitment this round have anything to
        // reveal; a single exclusive activation avoids mid-loop transitions.
        $this->gamestate->setPlayersMultiactive($this->committedPlayerIds(), 'next', true);
    }

    public function stNarrativeBattle()
    {
        // Table-talk phase: no server-side effect in the current ruleset.
        self::notifyAllPlayers('narrativeBattle', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
        $this->gamestate->nextState('next');
    }

    public function stResolution()
    {
        $finalState = $this->resolveRevealedRound();
        if ($this->maybeEndGame($finalState)) {
            $this->gamestate->nextState('endGame');
            return;
        }
        $this->gamestate->nextState('next');
    }

    public function stCleanup()
    {
        $seed = $this->seedFor('cleanup');
        $cleanup = GrandAreaRules::resolveCleanup($this->loadTerritoryState(), $seed);
        $this->persistTerritoryState($cleanup['newState']);
        self::notifyAllPlayers('cleanupResolved', '', array(
            'logs' => $cleanup['logs'],
            'territories' => $cleanup['newState']
        ));

        self::incStat(1, 'rounds_played');

        $limitReached = intval(self::getGameStateValue('round_number')) >= $this->roundLimit();
        if ($this->maybeEndGame($cleanup['newState'], $limitReached)) {
            $this->gamestate->nextState('endGame');
            return;
        }

        self::setGameStateValue('round_number', intval(self::getGameStateValue('round_number')) + 1);
        self::notifyAllPlayers('roundAdvanced', '', array(
            'round' => intval(self::getGameStateValue('round_number'))
        ));
        $this->gamestate->nextState('next');
    }

    // ------------------------------------------------------------------
    // Player actions
    // ------------------------------------------------------------------

    public function submitCommit($hash)
    {
        self::checkAction('submitCommit');

        if (!preg_match(GRANDAREA_COMMIT_HASH_REGEX, $hash)) {
            throw new BgaUserException('Commit hash must be a lowercase SHA-256 hash');
        }

        $gameId = $this->gameId();
        $playerId = intval(self::getCurrentPlayerId());
        $round = intval(self::getGameStateValue('round_number'));

        $family = $this->familyForPlayer($playerId);
        if ($this->actorTerritoryKey($this->loadTerritoryState(), $family) === null) {
            throw new BgaUserException('Your family has been eliminated and cannot act');
        }

        // Once any reveal has happened this round the commitments are locked:
        // late re-commits could react to revealed information.
        $revealedCount = intval(self::getUniqueValueFromDB(
            "SELECT COUNT(*) FROM secret_submissions WHERE game_id = " . $gameId
            . " AND round_number = " . $round . " AND revealed = 1"
        ));
        if ($revealedCount > 0) {
            throw new BgaUserException('Commits are locked once any action has been revealed this round');
        }

        $sql = "REPLACE INTO secret_submissions (game_id, round_number, player_id, commit_hash, submitted_at, revealed, reveal_payload) VALUES ("
            . $gameId . ", "
            . $round . ", "
            . $playerId . ", "
            . $this->sqlString($hash) . ", NOW(), 0, NULL)";
        self::DbQuery($sql);

        self::notifyAllPlayers('commitSubmitted', '', array('player_id' => $playerId));
    }

    public function revealActionPayload($payload, $nonce)
    {
        self::checkAction('reveal');

        if (strlen($payload) > GRANDAREA_MAX_REVEAL_BYTES) {
            throw new BgaUserException('Reveal payload is too large');
        }

        $gameId = $this->gameId();
        $playerId = intval(self::getCurrentPlayerId());
        $round = intval(self::getGameStateValue('round_number'));
        $expected = hash('sha256', $playerId . '|' . $payload . '|' . $nonce);
        $row = self::getObjectFromDb(
            "SELECT commit_hash, revealed FROM secret_submissions WHERE game_id = " . $gameId
            . " AND round_number = " . $round . " AND player_id = " . $playerId,
            true
        );
        if (!$row) {
            throw new BgaUserException('No commitment found for this round');
        }
        if (intval($row['revealed']) === 1) {
            throw new BgaUserException('Action already revealed this round');
        }
        if ($expected !== $row['commit_hash']) {
            throw new BgaUserException('Reveal does not match commit');
        }

        $decoded = json_decode($payload, true);
        $validated = $this->validateRevealPayload($decoded, $playerId);
        $sql = "UPDATE secret_submissions SET revealed = 1, reveal_payload = "
            . $this->sqlString(json_encode($validated))
            . " WHERE game_id = " . $gameId . " AND round_number = " . $round . " AND player_id = " . $playerId;
        self::DbQuery($sql);

        self::notifyAllPlayers('playerRevealed', '', array(
            'player_id' => $playerId,
            'action' => array('action' => $validated['action'], 'target' => $validated['target'])
        ));

        // A revealed player is done with the reveal phase.
        $this->gamestate->setPlayerNonMultiactive($playerId, 'next');
    }

    public function playCard($cardId, $target)
    {
        self::checkAction('playCard');

        $gameId = $this->gameId();
        $playerId = intval(self::getCurrentPlayerId());
        $hand = $this->handForPlayer($playerId);
        $position = array_search($cardId, $hand, true);
        if ($position === false) {
            throw new BgaUserException('Card is not in your hand');
        }

        $cardDef = $this->playerCardById($cardId);
        if ($cardDef === null) {
            throw new BgaUserException('Unknown card');
        }

        $state = $this->loadTerritoryState();
        $family = $this->familyForPlayer($playerId);
        $actorKey = $this->actorTerritoryKey($state, $family);
        if ($actorKey === null) {
            throw new BgaUserException('No surviving territory for your family');
        }

        if (isset($cardDef['target']) && $cardDef['target'] === 'Self') {
            $targetKey = $actorKey;
        } else {
            $targetKey = strval($target);
            if ($targetKey === '' || $targetKey === 'Self') {
                $targetKey = $actorKey;
            }
            if (!isset($state[$targetKey])) {
                throw new BgaUserException('Unknown target territory');
            }
            if (isset($cardDef['target']) && $cardDef['target'] === 'Other' && $targetKey === $actorKey) {
                throw new BgaUserException('This card must target another territory');
            }
        }

        $result = GrandAreaRules::resolveCard($state, $cardId, $actorKey, $targetKey);
        $this->persistTerritoryState($result['newState']);

        array_splice($hand, $position, 1);
        $this->saveHandForPlayer($playerId, $hand);

        // Played cards cycle to a discard so the deck can reshuffle.
        $discard = $this->loadRuntime('card_discard', array());
        $discard[] = $cardId;
        $this->persistRuntime('card_discard', $discard);

        self::incStat(1, 'cards_played', $playerId);

        self::notifyAllPlayers('cardPlayed', '', array(
            'player_id' => $playerId,
            'card_id' => $cardId,
            'target' => $targetKey,
            'logs' => $result['logs']
        ));
        self::notifyPlayer($playerId, 'handUpdate', '', array('hand' => $hand));
        $this->notifyHandCounts();
    }

    public function endTurn()
    {
        self::checkAction('endTurn');
        $playerId = intval(self::getCurrentPlayerId());
        self::notifyAllPlayers('playerEndedTurn', '', array('player_id' => $playerId));
        $this->gamestate->setPlayerNonMultiactive($playerId, 'next');
    }

    // ------------------------------------------------------------------
    // Framework obligations
    // ------------------------------------------------------------------

    /**
     * Zombie handling: an absent player simply stops participating. In
     * multiactive phases they are marked done (their family Passes when
     * nothing was revealed); game-type states need no zombie action.
     */
    public function zombieTurn($state, $active_player)
    {
        if ($state['type'] === 'multipleactiveplayer') {
            $this->gamestate->setPlayerNonMultiactive(intval($active_player), 'next');
            return;
        }
        throw new feException('Zombie mode not supported at this game state: ' . $state['name']);
    }

    /**
     * Database migration hook for tables created before a code update.
     * No released tables exist yet, so there is nothing to migrate.
     */
    public function upgradeTableDb($from_version)
    {
    }

    // ------------------------------------------------------------------
    // Multiactive phase skips
    // ------------------------------------------------------------------

    /** Player ids whose family still controls a surviving territory. */
    private function livingPlayerIds()
    {
        $state = $this->loadTerritoryState();
        $rows = self::getObjectListFromDB(
            "SELECT player_id, family_name FROM player_state WHERE game_id = " . $this->gameId()
        );
        $ids = array();
        foreach ($rows as $row) {
            if ($this->actorTerritoryKey($state, $row['family_name']) !== null) {
                $ids[] = intval($row['player_id']);
            }
        }
        return $ids;
    }

    /** Player ids holding an unrevealed or revealed commitment this round. */
    private function committedPlayerIds()
    {
        $round = intval(self::getGameStateValue('round_number'));
        $rows = self::getObjectListFromDB(
            "SELECT player_id FROM secret_submissions WHERE game_id = " . $this->gameId()
            . " AND round_number = " . $round
        );
        $ids = array();
        foreach ($rows as $row) {
            $ids[] = intval($row['player_id']);
        }
        return $ids;
    }

    // ------------------------------------------------------------------
    // Resolution
    // ------------------------------------------------------------------

    public function resolveRevealedRound()
    {
        $gameId = $this->gameId();
        $round = intval(self::getGameStateValue('round_number'));
        $rows = self::getObjectListFromDB(
            "SELECT player_id, reveal_payload FROM secret_submissions WHERE game_id = " . $gameId
            . " AND round_number = " . $round . " AND revealed = 1"
        );
        $actions = array();
        foreach ($rows as $row) {
            $payload = json_decode($row['reveal_payload'], true);
            if (is_array($payload)) {
                $actions[] = $payload;
                self::incStat(1, 'actions_resolved', intval($row['player_id']));
            }
        }

        $seed = $this->seedFor('resolution');
        $this->persistRuntime('last_resolution_seed', $seed);

        $crisisId = $this->loadRuntime('current_crisis', null);
        $crisisCard = $crisisId !== null ? $this->crisisCardById($crisisId) : null;

        $state = $this->loadTerritoryState();
        $resolution = GrandAreaRules::resolveTurn($state, $actions, $seed, $crisisCard);
        $this->persistTerritoryState($resolution['newState']);
        $this->persistRuntime('revealed_payloads', $actions);

        // The applied crisis card cycles to the discard so reshuffles work.
        if ($crisisId !== null) {
            $discard = $this->loadRuntime('crisis_discard', array());
            $discard[] = $crisisId;
            $this->persistRuntime('crisis_discard', $discard);
            $this->persistRuntime('current_crisis', null);
            self::incStat(1, 'crises_resolved');
        }

        // Submissions are consumed: clear them so nothing stale re-executes.
        self::DbQuery("DELETE FROM secret_submissions WHERE game_id = " . $gameId);

        self::notifyAllPlayers('roundResolved', '', array(
            'seed_checksum' => sprintf('%u', crc32($seed)),
            'crisis_id' => $crisisId,
            'resolution_logs' => $resolution['logs'],
            'territories' => $resolution['newState']
        ));

        return $resolution['newState'];
    }

    // ------------------------------------------------------------------
    // Game end
    // ------------------------------------------------------------------

    /**
     * Ends the game when any territory has a Won outcome, when at most one
     * player still controls a surviving territory, or when $force is set
     * (round limit reached). Scores: objective winners 1000 + wealth,
     * other survivors their family wealth, eliminated players 0;
     * player_score_aux carries wealth as the tiebreak.
     */
    private function maybeEndGame($state, $force = false)
    {
        $gameId = $this->gameId();
        $anyWon = false;
        foreach ($state as $data) {
            if (isset($data['outcome']) && $data['outcome'] === 'Won') {
                $anyWon = true;
                break;
            }
        }

        $players = self::getObjectListFromDB(
            "SELECT player_id, family_name FROM player_state WHERE game_id = " . $gameId
        );
        $survivorCount = 0;
        $summary = array();
        foreach ($players as $playerRow) {
            $family = $playerRow['family_name'];
            $won = false;
            $surviving = false;
            $wealth = 0;
            foreach ($state as $data) {
                if (!isset($data['family']) || $data['family'] !== $family) {
                    continue;
                }
                $wealth += isset($data['wealth']) ? intval($data['wealth']) : 0;
                if (isset($data['outcome']) && $data['outcome'] === 'Won') {
                    $won = true;
                }
                if (!GrandAreaRules::isEliminated($data)) {
                    $surviving = true;
                }
            }
            if ($surviving) {
                $survivorCount++;
            }
            $summary[] = array(
                'player_id' => intval($playerRow['player_id']),
                'family' => $family,
                'won' => $won,
                'surviving' => $surviving,
                'wealth' => $wealth
            );
        }

        if (!$anyWon && $survivorCount > 1 && !$force) {
            return false;
        }

        foreach ($summary as $entry) {
            $score = 0;
            if ($entry['won']) {
                $score = 1000 + intval($entry['wealth']);
            } elseif ($entry['surviving']) {
                $score = intval($entry['wealth']);
            }
            self::DbQuery("UPDATE player SET player_score = " . intval($score)
                . ", player_score_aux = " . intval($entry['wealth'])
                . " WHERE player_id = " . intval($entry['player_id']));
        }

        self::notifyAllPlayers('gameEnded', '', array('summary' => $summary));
        return true;
    }

    // ------------------------------------------------------------------
    // Framework data providers
    // ------------------------------------------------------------------

    protected function getAllDatas()
    {
        $gameId = $this->gameId();
        $currentPlayerId = intval(self::getCurrentPlayerId());

        $result = array();
        $result['players'] = self::getCollectionFromDb(
            "SELECT player_id id, player_score score, player_name name, player_color color FROM player"
        );
        $result['round'] = intval(self::getGameStateValue('round_number'));
        $result['round_limit'] = $this->roundLimit();
        $result['territories'] = $this->loadTerritoryState();
        $result['current_crisis'] = $this->loadRuntime('current_crisis', null);
        $crisisId = $result['current_crisis'];
        $result['current_crisis_card'] = $crisisId !== null ? $this->crisisCardById($crisisId) : null;
        // The upcoming crisis is public knowledge: everyone sees the storm coming.
        $draw = $this->loadRuntime('crisis_draw', array());
        $result['next_crisis_card'] = count($draw) > 0 ? $this->crisisCardById($draw[0]) : null;
        // Public material the client needs for rendering (no hidden info).
        $result['card_defs'] = $this->playerCardMaterial;
        $result['allowed_actions'] = $this->allowedActions;

        // Hidden information: opponents only ever receive hand counts.
        $result['families'] = array();
        $result['hand_counts'] = array();
        $result['hand'] = array();
        $rows = self::getObjectListFromDB(
            "SELECT player_id, family_name, hand_json FROM player_state WHERE game_id = " . $gameId
        );
        foreach ($rows as $row) {
            $playerId = intval($row['player_id']);
            $hand = json_decode($row['hand_json'], true);
            if (!is_array($hand)) {
                $hand = array();
            }
            $result['families'][$playerId] = $row['family_name'];
            $result['hand_counts'][$playerId] = count($hand);
            if ($playerId === $currentPlayerId) {
                $result['hand'] = $hand;
            }
        }

        return $result;
    }

    public function getGameProgression()
    {
        $round = intval(self::getGameStateValue('round_number'));
        return max(0, min(100, intval(($round - 1) * 100 / $this->roundLimit())));
    }

    // ------------------------------------------------------------------
    // Validation helpers
    // ------------------------------------------------------------------

    private function validateRevealPayload($decoded, $playerId)
    {
        if (!is_array($decoded)) {
            throw new BgaUserException('Reveal payload must be JSON');
        }

        $family = $this->familyForPlayer($playerId);
        $state = $this->loadTerritoryState();
        $actorKey = $this->actorTerritoryKey($state, $family);
        if ($actorKey === null) {
            throw new BgaUserException('No surviving territory for your family');
        }

        $claimed = isset($decoded['family']) ? strval($decoded['family']) : $actorKey;
        if ($claimed !== $actorKey && $claimed !== $family) {
            throw new BgaUserException('Reveal family does not match player assignment');
        }
        $decoded['family'] = $actorKey;

        $validated = GrandAreaRules::validateActions($state, array($decoded));
        return $validated[0];
    }

    /**
     * Acting territory for a family: direct key match first, then the first
     * territory (sorted keys) controlled by the family. Eliminated
     * territories (collapsed, anarchy, or marked Lost) never qualify, so an
     * eliminated player cannot act and a multi-territory family falls back
     * to a surviving holding.
     */
    private function actorTerritoryKey($state, $family)
    {
        if (isset($state[$family]) && !GrandAreaRules::isEliminated($state[$family])) {
            return $family;
        }
        $keys = array_keys($state);
        sort($keys, SORT_STRING);
        foreach ($keys as $key) {
            if (isset($state[$key]['family']) && $state[$key]['family'] === $family
                && !GrandAreaRules::isEliminated($state[$key])) {
                return $key;
            }
        }
        return null;
    }

    private function familiesForPlayerCount($territories, $playerCount)
    {
        $setups = $this->setupMaterial;
        $key = strval($playerCount);
        if (isset($setups[$key]) && isset($setups[$key]['families']) && count($setups[$key]['families']) > 0) {
            return array_values($setups[$key]['families']);
        }
        $families = array();
        foreach ($territories as $territory) {
            $family = $territory['family'];
            if (!in_array($family, $families, true)) {
                $families[] = $family;
            }
        }
        return $families;
    }

    private function playerIdsByFamily()
    {
        $rows = self::getObjectListFromDB(
            "SELECT player_id, family_name FROM player_state WHERE game_id = " . $this->gameId()
        );
        $map = array();
        foreach ($rows as $row) {
            $map[$row['family_name']] = intval($row['player_id']);
        }
        return $map;
    }

    private function familyForPlayer($playerId)
    {
        $row = self::getObjectFromDb(
            "SELECT family_name FROM player_state WHERE game_id = " . $this->gameId() . " AND player_id = " . intval($playerId),
            true
        );
        if (!$row) {
            throw new BgaUserException('Player has no assigned family');
        }
        return $row['family_name'];
    }

    // ------------------------------------------------------------------
    // Hands and decks
    // ------------------------------------------------------------------

    private function dealCards($cardsPerPlayer)
    {
        if ($cardsPerPlayer <= 0) {
            return;
        }
        $gameId = $this->gameId();
        $deck = $this->loadRuntime('player_deck', array());
        $discard = $this->loadRuntime('card_discard', array());
        $maxHand = $this->balanceValue('maxCardsInHand', 5);

        $rows = self::getObjectListFromDB(
            "SELECT player_id, hand_json FROM player_state WHERE game_id = " . $gameId . " ORDER BY player_id"
        );
        foreach ($rows as $row) {
            $playerId = intval($row['player_id']);
            $hand = json_decode($row['hand_json'], true);
            if (!is_array($hand)) {
                $hand = array();
            }
            $dealt = false;
            for ($i = 0; $i < $cardsPerPlayer; $i++) {
                if (count($deck) === 0 && count($discard) > 0) {
                    // Reshuffle played cards back into the deck.
                    $deck = $this->shuffleIdsFromIds($discard, $this->seedFor('card-reshuffle'));
                    $discard = array();
                }
                if (count($hand) >= $maxHand || count($deck) === 0) {
                    break;
                }
                $hand[] = array_shift($deck);
                $dealt = true;
            }
            if ($dealt) {
                $this->saveHandForPlayer($playerId, $hand);
                self::notifyPlayer($playerId, 'handUpdate', '', array('hand' => $hand));
            }
        }
        $this->persistRuntime('player_deck', $deck);
        $this->persistRuntime('card_discard', $discard);
        $this->notifyHandCounts();
    }

    private function handForPlayer($playerId)
    {
        $row = self::getObjectFromDb(
            "SELECT hand_json FROM player_state WHERE game_id = " . $this->gameId() . " AND player_id = " . intval($playerId),
            true
        );
        if (!$row) {
            return array();
        }
        $hand = json_decode($row['hand_json'], true);
        return is_array($hand) ? $hand : array();
    }

    private function saveHandForPlayer($playerId, $hand)
    {
        self::DbQuery(
            "UPDATE player_state SET hand_json = " . $this->sqlString(json_encode(array_values($hand)))
            . " WHERE game_id = " . $this->gameId() . " AND player_id = " . intval($playerId)
        );
    }

    private function notifyHandCounts()
    {
        $rows = self::getObjectListFromDB(
            "SELECT player_id, hand_json FROM player_state WHERE game_id = " . $this->gameId()
        );
        $counts = array();
        foreach ($rows as $row) {
            $hand = json_decode($row['hand_json'], true);
            $counts[intval($row['player_id'])] = is_array($hand) ? count($hand) : 0;
        }
        self::notifyAllPlayers('handCounts', '', array('hand_counts' => $counts));
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
        $decorated = array();
        foreach (array_values($ids) as $index => $id) {
            $decorated[] = array(GrandAreaRules::seededRoll($seed, $id . ':' . $index), $index, $id);
        }
        usort($decorated, function ($a, $b) {
            if ($a[0] !== $b[0]) {
                return $a[0] < $b[0] ? -1 : 1;
            }
            return $a[1] - $b[1];
        });
        $out = array();
        foreach ($decorated as $entry) {
            $out[] = $entry[2];
        }
        return $out;
    }

    // ------------------------------------------------------------------
    // Persistence
    // ------------------------------------------------------------------

    private function loadTerritoryState()
    {
        $gameId = $this->gameId();
        $rows = self::getObjectListFromDB(
            "SELECT * FROM territories WHERE game_id = " . $gameId . " ORDER BY territory_key"
        );
        $state = array();
        foreach ($rows as $row) {
            $key = $row['territory_key'];
            unset($row['game_id'], $row['territory_key']);
            $row['resources'] = json_decode($row['resources_json'], true);
            $row['resourceNeeds'] = json_decode($row['resource_needs_json'], true);
            $row['neighbors'] = json_decode($row['neighbors_json'], true);
            unset($row['resources_json'], $row['resource_needs_json'], $row['neighbors_json']);
            $row['protected'] = intval($row['protected']) === 1;
            $row['invaded'] = intval($row['invaded']) === 1;
            $row['sanctioned'] = intval($row['sanctioned']) === 1;
            $state[$key] = $row;
        }
        return $state;
    }

    private function persistTerritoryState($state)
    {
        $gameId = $this->gameId();
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
            'defianceMajorityRounds' => intval($this->value($data, 'defianceMajorityRounds', 0)),
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

    private function crisisCardById($cardId)
    {
        foreach ($this->crisisMaterial as $card) {
            if (isset($card['id']) && $card['id'] === $cardId) {
                return $card;
            }
        }
        return null;
    }

    private function playerCardById($cardId)
    {
        foreach ($this->playerCardMaterial as $card) {
            if (isset($card['id']) && $card['id'] === $cardId) {
                return $card;
            }
        }
        return null;
    }

    private function balanceValue($key, $default)
    {
        $balance = $this->balanceMaterial;
        if (isset($balance['actionEconomy']) && isset($balance['actionEconomy'][$key])) {
            return intval($balance['actionEconomy'][$key]);
        }
        return $default;
    }

    private function persistRuntime($key, $value)
    {
        $sql = "REPLACE INTO game_runtime (game_id, state_key, state_json) VALUES ("
            . $this->gameId() . ", "
            . $this->sqlString($key) . ", "
            . $this->sqlString(json_encode($value)) . ")";
        self::DbQuery($sql);
    }

    private function loadRuntime($key, $default)
    {
        $row = self::getObjectFromDb(
            "SELECT state_json FROM game_runtime WHERE game_id = " . $this->gameId() . " AND state_key = " . $this->sqlString($key),
            true
        );
        if (!$row) {
            return $default;
        }
        $decoded = json_decode($row['state_json'], true);
        return $decoded === null ? $default : $decoded;
    }

    // ------------------------------------------------------------------
    // Seeds
    // ------------------------------------------------------------------

    private function generateSecretSalt()
    {
        if (function_exists('openssl_random_pseudo_bytes')) {
            $bytes = openssl_random_pseudo_bytes(16);
            if ($bytes !== false) {
                return bin2hex($bytes);
            }
        }
        return bin2hex(random_bytes(16));
    }

    /**
     * Deterministic but unpredictable: the secret per-game salt keeps players
     * from precomputing coup or uprising rolls before committing actions.
     */
    private function seedFor($purpose)
    {
        $salt = strval($this->loadRuntime('secret_salt', ''));
        return $this->gameId() . ':' . $salt . ':' . intval(self::getGameStateValue('round_number')) . ':' . $purpose;
    }

    // ------------------------------------------------------------------
    // SQL helpers
    // ------------------------------------------------------------------

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
