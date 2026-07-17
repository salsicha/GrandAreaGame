<?php

require_once __DIR__ . '/constants.inc.php';

/**
 * Server-side port of the reference rules engine in frontend/rules.js.
 *
 * Every per-action delta, pipeline stage, and clamp here mirrors the JS
 * engine. When the JS engine changes, this file must change with it.
 */
class GrandAreaRules
{
    private static $roleOrder = array('Client' => 0, 'Regional' => 1, 'Head' => 2);

    private static $actionPriority = array(
        'Pass' => 0,
        'Concession' => 1,
        'TributeHoliday' => 1,
        'Protect' => 2,
        'ProtectionDeal' => 2,
        'Educate' => 3,
        'Develop' => 3,
        'Skim' => 4,
        'Propaganda' => 4,
        'DebtShakedown' => 5,
        'EconomicExploitation' => 5,
        'Sanction' => 6,
        'CovertInfluence' => 7,
        'RegionalRivalry' => 7,
        'ClientRealignment' => 8,
        'FalseFlag' => 8,
        'MakeExample' => 9,
        'Coup' => 10,
        'Invade' => 11
    );

    public static function roundPhases()
    {
        return grandarea_round_phases();
    }

    public static function allowedActions()
    {
        return grandarea_allowed_actions();
    }

    public static function objectives()
    {
        return grandarea_objectives();
    }

    public static function recovery()
    {
        return grandarea_recovery();
    }

    public static function defiancePressure()
    {
        return grandarea_defiance_pressure();
    }

    /**
     * Strict validation used at reveal time. Throws a player-visible
     * exception on malformed payloads.
     */
    public static function normalizeAction($payload)
    {
        $action = isset($payload['action']) ? strval($payload['action']) : 'Pass';
        if (!in_array($action, self::allowedActions(), true)) {
            self::rejectAction('Illegal action: ' . $action);
        }

        $family = isset($payload['family']) ? strval($payload['family']) : '';
        if ($family === '') {
            self::rejectAction('Missing acting family');
        }

        $target = isset($payload['target']) ? strval($payload['target']) : 'Self';
        $framing = isset($payload['framing']) ? intval($payload['framing']) : 0;

        return array(
            'family' => $family,
            'action' => $action,
            'target' => $target === 'Self' || $target === '' ? $family : $target,
            'framing' => max(0, $framing)
        );
    }

    public static function validateActions($state, $actions)
    {
        $out = array();
        foreach ($actions as $idx => $payload) {
            $action = self::normalizeAction($payload);
            if (!isset($state[$action['family']])) {
                self::rejectAction('Unknown acting family: ' . $action['family']);
            }
            if ($action['target'] !== $action['family'] && !isset($state[$action['target']])) {
                self::rejectAction('Unknown target: ' . $action['target']);
            }
            $action['order'] = $idx;
            $out[] = $action;
        }
        return $out;
    }

    private static function rejectAction($message)
    {
        if (class_exists('BgaUserException')) {
            throw new BgaUserException($message);
        }
        throw new InvalidArgumentException($message);
    }

    /**
     * Lenient normalization used inside resolveTurn: mirrors the JS engine,
     * which never throws during resolution. Missing targets stay missing so
     * the per-action handlers can fail with a log.
     */
    private static function normalizeForResolve($actions)
    {
        $out = array();
        $index = 0;
        foreach ($actions as $payload) {
            if (!is_array($payload)) {
                continue;
            }
            $family = isset($payload['family']) ? strval($payload['family']) : '';
            if ($family === '') {
                continue;
            }
            $action = isset($payload['action']) ? strval($payload['action']) : 'Pass';
            if ($action === '') {
                $action = 'Pass';
            }
            $target = isset($payload['target']) ? strval($payload['target']) : '';
            $out[] = array(
                'family' => $family,
                'action' => $action,
                'target' => $target === 'Self' || $target === '' ? $family : $target,
                'framing' => isset($payload['framing']) ? max(0, intval($payload['framing'])) : 0,
                'order' => $index
            );
            $index++;
        }
        return $out;
    }

    // ------------------------------------------------------------------
    // Tribute
    // ------------------------------------------------------------------

    public static function resolveTribute($state)
    {
        $logs = array('--- Phase 2: The Tribute ---');
        $payments = array();
        $newState = self::cloneTerritories($state);

        foreach (array_keys($newState) as $key) {
            $territory =& $newState[$key];
            if (!self::isTerritory($territory) || self::str($territory, 'family') === '') {
                unset($territory);
                continue;
            }
            if (self::str($territory, 'type') === 'Head' || self::str($territory, 'type') === 'Regional') {
                unset($territory);
                continue;
            }
            if (self::isEliminated($territory)) {
                unset($territory);
                continue;
            }

            $overlord = self::str($territory, 'clientOf') !== '' ? self::str($territory, 'clientOf') : 'USA';
            if (self::num($territory, 'tributeHoliday') > 0) {
                $territory['tributeHoliday'] = max(0, self::num($territory, 'tributeHoliday') - 1);
                $logs[] = 'Tribute holiday: ' . self::str($territory, 'family') . ' (in ' . $key . ') skips tribute to ' . $overlord;
                unset($territory);
                continue;
            }
            if (self::num($territory, 'defiance') > 0) {
                $logs[] = self::str($territory, 'family') . ' (in ' . $key . ') REFUSES tribute to ' . $overlord . '! (Defiance: ' . self::num($territory, 'defiance') . ')';
                unset($territory);
                continue;
            }

            $amount = intval(floor(self::num($territory, 'wealth') * 0.20));
            if ($amount > 0) {
                $overlordKey = self::findOverlordKeyByName($newState, $overlord);
                if ($overlordKey !== null && !self::isEliminated($newState[$overlordKey])) {
                    $territory['wealth'] = self::num($territory, 'wealth') - $amount;
                    $newState[$overlordKey]['wealth'] = self::num($newState[$overlordKey], 'wealth') + $amount;
                    $logs[] = self::str($territory, 'family') . ' (in ' . $key . ') pays ' . $amount . ' tribute to ' . $overlord;
                    $payments[] = array('from_family' => self::str($territory, 'family'), 'to_family' => $overlord, 'amount' => $amount);
                } else {
                    $logs[] = 'Tribute lapses: ' . self::str($territory, 'family') . ' (in ' . $key . ') has no surviving overlord (' . $overlord . ')';
                }
            }
            unset($territory);
        }

        return array('newState' => $newState, 'logs' => $logs, 'payments' => $payments);
    }

    // ------------------------------------------------------------------
    // Crisis
    // ------------------------------------------------------------------

    public static function applyCrisis($state, $crisis)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        if (!is_array($crisis) || self::str($crisis, 'id') === '') {
            return array('newState' => $newState, 'logs' => $logs);
        }

        $crisisId = self::str($crisis, 'id');
        $logs[] = 'Applying crisis card: ' . $crisisId;
        $targets = self::crisisTargetKeys($crisis, $newState);
        if (count($targets) === 0) {
            $logs[] = 'Crisis ' . $crisisId . ' had no legal targets';
            return array('newState' => $newState, 'logs' => $logs);
        }

        $effect = isset($crisis['effect']) && is_array($crisis['effect']) ? $crisis['effect'] : array();
        foreach ($targets as $key) {
            self::applyCrisisEffect($newState[$key], $effect);
            $hasVulnerableList = isset($effect['vulnerableResourceNeeds']) && is_array($effect['vulnerableResourceNeeds']);
            if ($crisisId === 'global_austerity' || $hasVulnerableList) {
                $vulnerableNeeds = $hasVulnerableList ? $effect['vulnerableResourceNeeds'] : array('Grain', 'Finance');
                $missing = self::missingResourcesFor($key, $newState);
                if (count(array_intersect($vulnerableNeeds, $missing)) > 0) {
                    $delta = isset($effect['vulnerability_happiness_delta']) && $effect['vulnerability_happiness_delta']
                        ? intval($effect['vulnerability_happiness_delta']) : -5;
                    self::applyDelta($newState[$key], 'happiness', $delta);
                }
            }
            $logs[] = $key . ' affected by ' . $crisisId;
        }

        if (isset($crisis['escalation']) && $crisis['escalation']) {
            $logs[] = 'Escalation pressure: ' . strval($crisis['escalation']);
        }
        return array('newState' => $newState, 'logs' => $logs);
    }

    private static function crisisTargetKeys($crisis, $state)
    {
        $targeting = isset($crisis['targeting']) && is_array($crisis['targeting']) ? $crisis['targeting'] : array();
        $direct = self::str($crisis, 'target');
        if ($direct !== '' && isset($state[$direct]) && !self::isEliminated($state[$direct])) {
            return array($direct);
        }
        $territoryTarget = self::str($targeting, 'territory');
        if ($territoryTarget !== '' && isset($state[$territoryTarget]) && !self::isEliminated($state[$territoryTarget])) {
            return array($territoryTarget);
        }

        $keys = array();
        foreach ($state as $key => $data) {
            if (self::isTerritory($data) && !self::isEliminated($data)) {
                $keys[] = $key;
            }
        }

        $scope = self::str($targeting, 'scope');
        if ($scope === '') {
            $scope = self::str($crisis, 'id') === 'global_austerity' ? 'all' : 'territory';
        }

        switch ($scope) {
            case 'all':
                return $keys;
            case 'clients':
                return array_values(array_filter($keys, function ($key) use ($state) {
                    return GrandAreaRules::fieldStr($state[$key], 'type') === 'Client';
                }));
            case 'defiantClients':
                return array_values(array_filter($keys, function ($key) use ($state) {
                    return GrandAreaRules::fieldStr($state[$key], 'type') === 'Client'
                        && GrandAreaRules::fieldNum($state[$key], 'defiance') > 0;
                }));
            case 'resourceNeed':
                $resource = self::str($targeting, 'resource');
                return array_values(array_filter($keys, function ($key) use ($state, $resource) {
                    return in_array($resource, GrandAreaRules::resourceListPublic($state[$key], 'resourceNeeds'), true);
                }));
            case 'resourceHolder':
                $resource = self::str($targeting, 'resource');
                return array_values(array_filter($keys, function ($key) use ($state, $resource) {
                    return in_array($resource, GrandAreaRules::resourceListPublic($state[$key], 'resources'), true);
                }));
            case 'highestDebt':
                return self::firstKeyWithHighest($keys, $state, 'debt');
            case 'highestFactionalDivision':
                return self::firstKeyWithHighest($keys, $state, 'factionalDivision');
            default:
                $territory = self::str($targeting, 'territory');
                return array_values(array_filter($keys, function ($key) use ($territory) {
                    return $key === $territory;
                }));
        }
    }

    private static function firstKeyWithHighest($keys, $state, $field)
    {
        if (count($keys) === 0) {
            return array();
        }
        $highest = null;
        foreach ($keys as $key) {
            $value = self::num($state[$key], $field);
            if ($highest === null || $value > $highest) {
                $highest = $value;
            }
        }
        foreach ($keys as $key) {
            if (self::num($state[$key], $field) === $highest) {
                return array($key);
            }
        }
        return array();
    }

    private static function applyCrisisEffect(&$data, $effect)
    {
        $fieldMap = array(
            'wealth_delta' => 'wealth',
            'happiness_delta' => 'happiness',
            'development_delta' => 'development',
            'education_delta' => 'education',
            'defiance_delta' => 'defiance',
            'defiance_increase' => 'defiance',
            'blackBudget_delta' => 'blackBudget',
            'socialCapital_delta' => 'socialCapital',
            'politicalCapital_delta' => 'politicalCapital',
            'independenceSentiment_delta' => 'independenceSentiment',
            'factionalDivision_delta' => 'factionalDivision',
            'governanceChangeSentiment_delta' => 'governanceChangeSentiment',
            'fear_delta' => 'fear',
            'debt_delta' => 'debt'
        );
        foreach ($fieldMap as $effectKey => $field) {
            if (array_key_exists($effectKey, $effect)) {
                self::applyDelta($data, $field, intval($effect[$effectKey]));
            }
        }
    }

    private static function applyDelta(&$data, $field, $delta)
    {
        if (!$delta) {
            return;
        }
        $data[$field] = self::clampField($field, self::num($data, $field) + $delta);
    }

    private static function clampField($field, $value)
    {
        $maxByField = array(
            'happiness' => 200,
            'education' => 150,
            'development' => 150,
            'independenceSentiment' => 100,
            'governanceChangeSentiment' => 100,
            'factionalDivision' => 100,
            'fear' => 100
        );
        $value = max(0, intval($value));
        if (isset($maxByField[$field])) {
            $value = min($maxByField[$field], $value);
        }
        return $value;
    }

    // ------------------------------------------------------------------
    // Turn resolution pipeline
    // ------------------------------------------------------------------

    /**
     * Full resolution pipeline, matching frontend/rules.js resolveTurn:
     * crisis -> actions -> unanswered defiance -> objectives -> contagion
     * -> objectives.
     *
     * $crisis is an optional crisis card definition (already drawn).
     */
    public static function resolveTurn($state, $actions, $seed, $crisis = null)
    {
        $logs = array('Using replay seed: ' . $seed);
        $newState = self::cloneTerritories($state);
        $original = self::cloneTerritories($state);

        if (is_array($crisis) && self::str($crisis, 'id') !== '') {
            $crisisResult = self::applyCrisis($newState, $crisis);
            $newState = $crisisResult['newState'];
            $logs = array_merge($logs, $crisisResult['logs']);
        }

        $normalized = self::normalizeForResolve($actions);
        usort($normalized, function ($a, $b) use ($newState) {
            return GrandAreaRules::compareActions($a, $b, $newState);
        });

        $logs[] = 'Resolving actions (wealth, role, action priority, family id)';
        foreach ($normalized as $idx => $entry) {
            $actor = $entry['family'];
            $action = $entry['action'];
            $target = $entry['target'] !== '' ? $entry['target'] : $actor;
            $logs[] = $actor . ' => ' . $action . ' -> ' . $target;

            if (!isset($newState[$actor])) {
                $logs[] = 'WARN: actor ' . $actor . ' missing in state';
                continue;
            }
            if (self::isEliminated($newState[$actor])) {
                $logs[] = $actor . ' is eliminated and cannot act.';
                continue;
            }

            self::resolveAction($newState, $actor, $action, $target, $entry['framing'], $seed, $idx, $logs);
            self::clampActorCommon($newState[$actor]);
            if (isset($newState[$target])) {
                self::clampTargetCommon($newState[$target]);
            }
        }

        $pressureResult = self::applyUnansweredDefiancePressure($newState);
        $newState = $pressureResult['newState'];
        $logs = array_merge($logs, $pressureResult['logs']);

        $objectiveResult = self::evaluateObjectives($newState);
        $newState = $objectiveResult['newState'];
        $logs = array_merge($logs, $objectiveResult['logs']);

        $contagionResult = self::applyDefianceContagion($newState, $original);
        $newState = $contagionResult['newState'];
        $logs = array_merge($logs, $contagionResult['logs']);

        $finalObjectives = self::evaluateObjectives($newState);
        return array(
            'newState' => $finalObjectives['newState'],
            'logs' => array_merge($logs, $finalObjectives['logs'])
        );
    }

    private static function resolveAction(&$state, $actorKey, $action, $targetKey, $framingRequest, $seed, $idx, &$logs)
    {
        $A =& $state[$actorKey];
        $hasT = isset($state[$targetKey]);
        if ($hasT) {
            $T =& $state[$targetKey];
        } else {
            $T = null;
        }

        switch ($action) {
            case 'Skim':
                if ($hasT) {
                    $transferred = min(10, self::num($T, 'wealth'));
                    $T['wealth'] = max(0, self::num($T, 'wealth') - $transferred);
                    $A['stash'] = self::num($A, 'stash') + $transferred;
                    $T['happiness'] = max(0, self::num($T, 'happiness') - 6);
                    $logs[] = $actorKey . ' skimmed ' . $transferred . ' from ' . $targetKey;
                }
                break;
            case 'Propaganda':
                if (self::num($A, 'stash') < 8) {
                    $logs[] = $actorKey . ' failed Propaganda (insufficient stash)';
                    break;
                }
                $A['stash'] = self::num($A, 'stash') - 8;
                if ($hasT) {
                    $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 10));
                    $logs[] = $actorKey . ' spent 8 on propaganda for ' . $targetKey;
                }
                break;
            case 'Invade':
                if (!$hasT) {
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed Invade (cannot target self)';
                    break;
                }
                if (self::num($A, 'armies') < 1) {
                    $logs[] = $actorKey . ' failed Invade (insufficient armies)';
                    break;
                }
                if (self::num($A, 'wealth') < 12) {
                    $logs[] = $actorKey . ' failed Invade (insufficient wealth)';
                    break;
                }
                $protectedTarget = self::truthyField($T, 'protected')
                    && self::str($T, 'protectedBy') !== ''
                    && self::str($T, 'protectedBy') !== self::str($A, 'family');
                $framing = self::spendFraming($A, $framingRequest, 'Invade', $logs);
                $happinessLoss = max(8, 25 - $framing);
                $socialPenalty = max(0, 15 - intval(floor($framing / 2)));
                $A['wealth'] = max(0, self::num($A, 'wealth') - 12);
                $A['armies'] = max(0, self::num($A, 'armies') - 1);
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                $T['invaded'] = true;
                $T['protected'] = false;
                $T['protectedBy'] = null;
                $T['happiness'] = max(0, self::num($T, 'happiness') - $happinessLoss);
                $T['wealth'] = max(0, self::num($T, 'wealth') - 10);
                $T['fear'] = min(100, max(0, self::num($T, 'fear') + 10));
                $T['governanceChangeSentiment'] = min(100, max(0, self::num($T, 'governanceChangeSentiment') + 8));
                if (self::str($T, 'type') === 'Client') {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - $socialPenalty);
                $logs[] = $actorKey . ' invaded ' . $targetKey . ($framing > 0 ? ' with framing' : ' without framing')
                    . ' (-12 wealth, -1 army, -' . $happinessLoss . ' happiness, -' . $socialPenalty . ' backlash)';
                if ($protectedTarget) {
                    $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 5);
                    $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - 5);
                    $logs[] = $actorKey . ' suffers extra backlash for invading protected ' . $targetKey
                        . ' (-5 Political Capital, -5 Social Capital)';
                }
                break;
            case 'Sanction':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted Sanction against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed Sanction (cannot target self)';
                    break;
                }
                if (self::num($A, 'politicalCapital') < 5) {
                    $logs[] = $actorKey . ' failed Sanction (insufficient Political Capital)';
                    break;
                }
                $loss = min(18, self::num($T, 'wealth'));
                $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 5);
                $A['wealth'] = self::num($A, 'wealth') + intval(floor($loss * 0.25));
                $T['wealth'] = max(0, self::num($T, 'wealth') - $loss);
                $T['happiness'] = max(0, self::num($T, 'happiness') - 12);
                $T['development'] = min(150, max(0, self::num($T, 'development') - 5));
                $T['governanceChangeSentiment'] = min(100, max(0, self::num($T, 'governanceChangeSentiment') + 5));
                $T['sanctioned'] = true;
                $logs[] = $actorKey . ' sanctioned ' . $targetKey . ' (-' . $loss . ' wealth, -12 happiness, -5 development)';
                break;
            case 'Protect':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted Protect against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed Protect (cannot target self)';
                    break;
                }
                if (self::num($A, 'stash') < 6) {
                    $logs[] = $actorKey . ' failed Protect (insufficient stash)';
                    break;
                }
                if (self::num($A, 'wealth') < 8) {
                    $logs[] = $actorKey . ' failed Protect (insufficient wealth)';
                    break;
                }
                $A['stash'] = max(0, self::num($A, 'stash') - 6);
                $A['wealth'] = max(0, self::num($A, 'wealth') - 8);
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                $T['protected'] = true;
                $T['protectedBy'] = self::str($A, 'family');
                $T['protectionDeal'] = max(self::num($T, 'protectionDeal'), 2);
                $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 8));
                $T['fear'] = min(100, max(0, self::num($T, 'fear') - 5));
                if (self::str($T, 'type') === 'Client' && self::str($T, 'clientOf') !== '' && self::str($T, 'clientOf') !== self::str($A, 'family')) {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                    $T['independenceSentiment'] = min(100, max(0, self::num($T, 'independenceSentiment') + 5));
                }
                $logs[] = $actorKey . ' protected ' . $targetKey . ' (-8 wealth, -6 stash)';
                break;
            case 'TributeHoliday':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted TributeHoliday against missing target ' . $targetKey;
                    break;
                }
                if (self::str($T, 'type') !== 'Client') {
                    $logs[] = $actorKey . ' failed TributeHoliday (' . $targetKey . ' is not a client)';
                    break;
                }
                if (self::str($T, 'clientOf') !== self::str($A, 'family')) {
                    $logs[] = $actorKey . ' failed TributeHoliday (' . $targetKey . ' is not their client)';
                    break;
                }
                if (self::num($A, 'wealth') < 8) {
                    $logs[] = $actorKey . ' failed TributeHoliday (insufficient wealth)';
                    break;
                }
                $A['wealth'] = max(0, self::num($A, 'wealth') - 8);
                $A['socialCapital'] = self::num($A, 'socialCapital') + 4;
                $T['tributeHoliday'] = max(self::num($T, 'tributeHoliday'), 1);
                $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 6));
                $T['defiance'] = max(0, self::num($T, 'defiance') - 1);
                $logs[] = $actorKey . ' grants ' . $targetKey . ' a tribute holiday';
                break;
            case 'ProtectionDeal':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted ProtectionDeal against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed ProtectionDeal (cannot target self)';
                    break;
                }
                if (self::num($A, 'stash') < 4) {
                    $logs[] = $actorKey . ' failed ProtectionDeal (insufficient stash)';
                    break;
                }
                if (self::num($A, 'wealth') < 6) {
                    $logs[] = $actorKey . ' failed ProtectionDeal (insufficient wealth)';
                    break;
                }
                $A['stash'] = max(0, self::num($A, 'stash') - 4);
                $A['wealth'] = max(0, self::num($A, 'wealth') - 6);
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 4;
                $T['protected'] = true;
                $T['protectedBy'] = self::str($A, 'family');
                $T['protectionDeal'] = max(self::num($T, 'protectionDeal'), 2);
                $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 6));
                if (self::str($T, 'type') === 'Client' && self::str($T, 'clientOf') !== '' && self::str($T, 'clientOf') !== self::str($A, 'family')) {
                    $T['realignmentPressure'] = self::num($T, 'realignmentPressure') + 8;
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                $logs[] = $actorKey . ' signs a protection deal with ' . $targetKey;
                break;
            case 'ClientRealignment':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted ClientRealignment against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed ClientRealignment (cannot target self)';
                    break;
                }
                if (self::str($T, 'type') !== 'Client') {
                    $logs[] = $actorKey . ' failed ClientRealignment (' . $targetKey . ' is not a client)';
                    break;
                }
                if (self::str($T, 'clientOf') === self::str($A, 'family')) {
                    $logs[] = $actorKey . ' failed ClientRealignment (' . $targetKey . ' is already their client)';
                    break;
                }
                $eligible = self::num($T, 'defiance') > 0
                    || self::num($T, 'independenceSentiment') >= 50
                    || self::num($T, 'realignmentPressure') >= 8;
                if (!$eligible) {
                    $logs[] = $actorKey . ' failed ClientRealignment (' . $targetKey . ' is not ready to realign)';
                    break;
                }
                if (self::num($A, 'politicalCapital') < 12) {
                    $logs[] = $actorKey . ' failed ClientRealignment (insufficient Political Capital)';
                    break;
                }
                $oldOverlord = self::str($T, 'clientOf') !== '' ? self::str($T, 'clientOf') : 'none';
                $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 12);
                $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - 4);
                $T['clientOf'] = self::str($A, 'family');
                $T['protected'] = true;
                $T['protectedBy'] = self::str($A, 'family');
                $T['protectionDeal'] = max(self::num($T, 'protectionDeal'), 2);
                $T['realignmentPressure'] = 0;
                $T['defiance'] = 0;
                $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 4));
                $T['independenceSentiment'] = min(100, max(0, self::num($T, 'independenceSentiment') + 10));
                $logs[] = $actorKey . ' realigns ' . $targetKey . ' from ' . $oldOverlord . ' to ' . self::str($A, 'family');
                break;
            case 'RegionalRivalry':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted RegionalRivalry against missing target ' . $targetKey;
                    break;
                }
                if (self::str($A, 'type') !== 'Regional' || self::str($T, 'type') !== 'Regional' || $actorKey === $targetKey) {
                    $logs[] = $actorKey . ' failed RegionalRivalry (requires a rival regional target)';
                    break;
                }
                if (self::num($A, 'politicalCapital') < 6) {
                    $logs[] = $actorKey . ' failed RegionalRivalry (insufficient Political Capital)';
                    break;
                }
                $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 6);
                $A['rivalryPressure'] = self::num($A, 'rivalryPressure') + 4;
                $T['rivalryPressure'] = self::num($T, 'rivalryPressure') + 10;
                $T['politicalCapital'] = max(0, self::num($T, 'politicalCapital') - 10);
                $T['factionalDivision'] = min(100, max(0, self::num($T, 'factionalDivision') + 8));
                $logs[] = $actorKey . ' escalates regional rivalry with ' . $targetKey;
                break;
            case 'DebtShakedown':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted DebtShakedown against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed DebtShakedown (cannot target self)';
                    break;
                }
                if (self::num($A, 'politicalCapital') < 8) {
                    $logs[] = $actorKey . ' failed DebtShakedown (insufficient Political Capital)';
                    break;
                }
                $collected = min(20, self::num($T, 'wealth'));
                $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 8);
                $A['wealth'] = self::num($A, 'wealth') + $collected;
                $T['wealth'] = max(0, self::num($T, 'wealth') - $collected);
                $T['debt'] = self::num($T, 'debt') + $collected;
                $T['happiness'] = max(0, self::num($T, 'happiness') - 8);
                $T['governanceChangeSentiment'] = min(100, max(0, self::num($T, 'governanceChangeSentiment') + 7));
                if (self::str($T, 'type') === 'Client') {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                $logs[] = $actorKey . ' forced debt payments from ' . $targetKey . ' (+' . $collected . ' wealth, target debt +' . $collected . ')';
                break;
            case 'EconomicExploitation':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted EconomicExploitation against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed EconomicExploitation (cannot target self)';
                    break;
                }
                if (self::num($A, 'socialCapital') < 4) {
                    $logs[] = $actorKey . ' failed EconomicExploitation (insufficient Social Capital)';
                    break;
                }
                $extracted = min(12, self::num($T, 'wealth'));
                $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - 4);
                $A['wealth'] = self::num($A, 'wealth') + $extracted;
                $A['stash'] = self::num($A, 'stash') + intval(floor($extracted / 2));
                $T['wealth'] = max(0, self::num($T, 'wealth') - $extracted);
                $T['development'] = min(150, max(0, self::num($T, 'development') - 8));
                $T['happiness'] = max(0, self::num($T, 'happiness') - 8);
                $T['governanceChangeSentiment'] = min(100, max(0, self::num($T, 'governanceChangeSentiment') + 6));
                if (self::str($T, 'type') === 'Client') {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                $logs[] = $actorKey . ' exploited ' . $targetKey . ' (+' . $extracted . ' wealth, +' . intval(floor($extracted / 2)) . ' stash)';
                break;
            case 'Educate':
                if (self::num($A, 'wealth') < 8) {
                    $logs[] = $actorKey . ' failed Educate (insufficient wealth)';
                    break;
                }
                $A['wealth'] = max(0, self::num($A, 'wealth') - 8);
                $A['education'] = min(150, max(0, self::num($A, 'education') + 10));
                $A['development'] = min(150, max(0, self::num($A, 'development') + 3));
                $A['governanceChangeSentiment'] = min(100, max(0, self::num($A, 'governanceChangeSentiment') + 2));
                if (self::str($A, 'type') === 'Client') {
                    $A['independenceSentiment'] = min(100, max(0, self::num($A, 'independenceSentiment') + 2));
                }
                $logs[] = $actorKey . ' invested in education (+10 education, +3 development)';
                break;
            case 'Develop':
                $available = self::availableResourcesFor($actorKey, $state);
                if (self::num($A, 'wealth') < 10) {
                    $logs[] = $actorKey . ' failed Develop (insufficient wealth)';
                    break;
                }
                if (!in_array('Industry', $available, true) && !in_array('Technology', $available, true)) {
                    $logs[] = $actorKey . ' failed Develop (requires Industry or Technology access)';
                    break;
                }
                $A['wealth'] = max(0, self::num($A, 'wealth') - 10 + 5);
                $A['development'] = min(150, max(0, self::num($A, 'development') + 10));
                $A['happiness'] = min(200, max(0, self::num($A, 'happiness') + 3));
                $logs[] = $actorKey . ' invested in development (+10 development, +3 happiness)';
                break;
            case 'Coup':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted coup against missing target ' . $targetKey;
                    break;
                }
                if ($targetKey === $actorKey) {
                    $logs[] = $actorKey . ' failed Coup (cannot target self)';
                    break;
                }
                if (self::num($A, 'blackBudget') < 10) {
                    $logs[] = $actorKey . ' failed Coup (insufficient Black Budget)';
                    break;
                }
                $A['blackBudget'] = self::num($A, 'blackBudget') - 10;
                $framing = self::spendFraming($A, $framingRequest, 'Coup', $logs);
                $ap = self::num($A, 'politicalCapital');
                $tp = self::num($T, 'politicalCapital');
                $sentimentPressure = (self::num($T, 'governanceChangeSentiment') + self::num($T, 'factionalDivision') - self::num($T, 'fear')) / 300.0;
                $base = 0.5 + ($ap - $tp) / 200.0 + $sentimentPressure;
                $base = max(0.1, min(0.95, $base));
                $roll = self::seededRoll($seed, $idx);
                if ($roll < $base) {
                    $T['family'] = self::str($A, 'family') !== '' ? self::str($A, 'family') : self::str($T, 'family');
                    $T['defianceMajorityRounds'] = 0; // new ruling family gets a fresh grace period
                    $T['happiness'] = max(0, self::num($T, 'happiness') - 20);
                    $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - max(0, 25 - $framing));
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') + 10;
                    $logs[] = $actorKey . ' successfully executed a coup against ' . $targetKey;
                } else {
                    $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 15);
                    $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - max(0, 20 - $framing));
                    $logs[] = $actorKey . ' failed coup against ' . $targetKey;
                }
                break;
            case 'FalseFlag':
                if (self::num($A, 'blackBudget') < 8) {
                    $logs[] = $actorKey . ' failed FalseFlag (insufficient Black Budget)';
                    break;
                }
                $A['blackBudget'] = self::num($A, 'blackBudget') - 8;
                $A['socialCapital'] = self::num($A, 'socialCapital') + 50;
                $logs[] = $actorKey . ' performed a FalseFlag - Black Budget -8, socialCapital +50';
                break;
            case 'CovertInfluence':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted CovertInfluence against missing target ' . $targetKey;
                    break;
                }
                if (self::num($A, 'blackBudget') < 6) {
                    $logs[] = $actorKey . ' failed CovertInfluence (insufficient Black Budget)';
                    break;
                }
                $A['blackBudget'] = self::num($A, 'blackBudget') - 6;
                $T['defiance'] = self::num($T, 'defiance') + 1;
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                $logs[] = $actorKey . ' used CovertInfluence on ' . $targetKey . ' (defiance +1, politicalCapital +5)';
                break;
            case 'MakeExample':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted MakeExample against missing target ' . $targetKey;
                    break;
                }
                if (self::num($T, 'defiance') <= 0) {
                    $logs[] = $actorKey . ' failed MakeExample (' . $targetKey . ' is not defiant)';
                    break;
                }
                if (self::str($T, 'clientOf') !== self::str($A, 'family')) {
                    $logs[] = $actorKey . ' failed MakeExample (' . $targetKey . ' is not their client)';
                    break;
                }
                if (self::num($A, 'socialCapital') < 10) {
                    $logs[] = $actorKey . ' failed MakeExample (insufficient Social Capital)';
                    break;
                }
                $T['defiance'] = 0;
                $T['happiness'] = max(0, self::num($T, 'happiness') - 20);
                $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - 10);
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                $logs[] = $actorKey . ' made an example of ' . $targetKey . ' (defiance reset, happiness -20)';
                break;
            case 'Concession':
                if (!$hasT) {
                    $logs[] = $actorKey . ' attempted Concession against missing target ' . $targetKey;
                    break;
                }
                if (self::num($T, 'defiance') <= 0) {
                    $logs[] = $actorKey . ' failed Concession (' . $targetKey . ' is not defiant)';
                    break;
                }
                if (self::str($T, 'clientOf') !== self::str($A, 'family')) {
                    $logs[] = $actorKey . ' failed Concession (' . $targetKey . ' is not their client)';
                    break;
                }
                if (self::num($A, 'wealth') < 10) {
                    $logs[] = $actorKey . ' failed Concession (insufficient wealth)';
                    break;
                }
                if (self::num($A, 'politicalCapital') < 5) {
                    $logs[] = $actorKey . ' failed Concession (insufficient Political Capital)';
                    break;
                }
                $A['wealth'] = max(0, self::num($A, 'wealth') - 10);
                $A['politicalCapital'] = max(0, self::num($A, 'politicalCapital') - 5);
                $A['socialCapital'] = self::num($A, 'socialCapital') + 5;
                $T['defiance'] = 0;
                $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 10));
                $logs[] = $actorKey . ' granted concessions to ' . $targetKey . ' (defiance reset, happiness +10)';
                break;
            case 'Pass':
            default:
                $logs[] = $actorKey . ' passed';
                break;
        }
    }

    private static function spendFraming(&$actorState, $requested, $actionName, &$logs)
    {
        $requestedSpend = max(0, intval($requested));
        if ($requestedSpend <= 0) {
            return 0;
        }
        $available = self::num($actorState, 'socialCapital');
        $spend = min($requestedSpend, $available);
        $actorState['socialCapital'] = $available - $spend;
        $logs[] = $actionName . ': spent ' . $spend . ' Social Capital on framing';
        return $spend;
    }

    // ------------------------------------------------------------------
    // Systemic pressure stages
    // ------------------------------------------------------------------

    public static function applyUnansweredDefiancePressure($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        $pressure = self::defiancePressure();
        $defiantByOverlord = array();

        foreach (array_keys($newState) as $key) {
            $client = $newState[$key];
            if (self::str($client, 'type') !== 'Client' || self::num($client, 'defiance') <= 0) {
                continue;
            }
            if (self::isEliminated($client)) {
                continue;
            }
            $overlordKey = self::findOverlordKeyByName($newState, self::str($client, 'clientOf'));
            if ($overlordKey === null || self::isEliminated($newState[$overlordKey])) {
                continue;
            }
            $family = self::str($client, 'clientOf');
            $defiantByOverlord[$family] = (isset($defiantByOverlord[$family]) ? $defiantByOverlord[$family] : 0) + 1;
        }

        ksort($defiantByOverlord, SORT_STRING);
        foreach ($defiantByOverlord as $family => $count) {
            $overlordKey = self::findOverlordKeyByName($newState, $family);
            if ($overlordKey === null || self::isEliminated($newState[$overlordKey])) {
                continue;
            }
            $socialPenalty = min($pressure['socialCapPerResolution'], $pressure['socialPerClient'] * $count);
            $politicalPenalty = min($pressure['politicalCapPerResolution'], $pressure['politicalPerClient'] * $count);
            $newState[$overlordKey]['socialCapital'] = max(0, self::num($newState[$overlordKey], 'socialCapital') - $socialPenalty);
            $newState[$overlordKey]['politicalCapital'] = max(0, self::num($newState[$overlordKey], 'politicalCapital') - $politicalPenalty);
            $logs[] = $family . ' loses ' . $socialPenalty . ' Social Capital and ' . $politicalPenalty
                . ' Political Capital for unanswered defiance in ' . $count . ' client territor' . ($count === 1 ? 'y' : 'ies');
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    public static function evaluateObjectives($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        $objectives = self::objectives();

        // Snapshot of active clients taken before any outcomes are marked in
        // this pass, mirroring the entries/activeClients capture in
        // frontend/rules.js evaluateObjectives.
        $activeClients = self::activeClientSnapshot($newState);

        foreach (array_keys($newState) as $key) {
            $data =& $newState[$key];
            if (self::str($data, 'family') === 'Anarchy' || self::str($data, 'family') === 'Collapsed') {
                self::markOutcome($logs, $key, $data, 'Lost', 'family control collapsed');
                unset($data);
                continue;
            }

            $type = self::str($data, 'type');
            $family = self::str($data, 'family');
            if ($type === 'Head'
                && self::ownClientMajorityDefiant($activeClients, $family)
                && self::num($data, 'defianceMajorityRounds') >= GRANDAREA_HEAD_DEFIANCE_MAJORITY_ROUNDS_TO_LOSE) {
                self::markOutcome($logs, $key, $data, 'Lost', 'a majority of active clients are defiant');
            } elseif ($type === 'Regional' && self::num($data, 'happiness') <= 20) {
                self::markOutcome($logs, $key, $data, 'Lost', 'domestic happiness collapsed');
            } elseif ($type === 'Client' && (self::num($data, 'wealth') <= 0 || self::num($data, 'happiness') <= 0)) {
                self::markOutcome($logs, $key, $data, 'Lost', 'client wealth or happiness collapsed');
            }

            if (self::str($data, 'outcome') === 'Lost') {
                unset($data);
                continue;
            }

            $ownClientsCompliant = true;
            foreach ($activeClients as $client) {
                if ($client['clientOf'] === $family && $client['defiance'] > 0) {
                    $ownClientsCompliant = false;
                    break;
                }
            }
            if ($type === 'Head' && self::num($data, 'wealth') >= $objectives['headWealthWin'] && $ownClientsCompliant) {
                self::markOutcome($logs, $key, $data, 'Won', 'hierarchy is stable and head wealth target is met');
            } elseif ($type === 'Regional' && self::num($data, 'wealth') >= $objectives['regionalWealthWin'] && self::num($data, 'politicalCapital') >= $objectives['regionalPoliticalWin']) {
                self::markOutcome($logs, $key, $data, 'Won', 'regional wealth and political power targets are met');
            } elseif ($type === 'Client' && self::num($data, 'defiance') > 0
                && self::num($data, 'happiness') >= $objectives['clientHappinessWin']
                && self::num($data, 'development') >= $objectives['clientDevelopmentWin']
                && self::num($data, 'independenceSentiment') >= $objectives['clientIndependenceWin']) {
                self::markOutcome($logs, $key, $data, 'Won', 'defiant client built a successful good example');
            }
            unset($data);
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    private static function markOutcome(&$logs, $key, &$data, $outcome, $reason)
    {
        if (self::str($data, 'outcome') !== '') {
            return;
        }
        $data['outcome'] = $outcome;
        $logs[] = $outcome . ': ' . $key . ' - ' . $reason;
    }

    /**
     * clientOf/defiance snapshot of every active (non-eliminated) client,
     * captured before a pass mutates any territory.
     */
    private static function activeClientSnapshot($state)
    {
        $clients = array();
        foreach ($state as $data) {
            if (self::str($data, 'type') === 'Client' && !self::isEliminated($data)) {
                $clients[] = array(
                    'clientOf' => self::str($data, 'clientOf'),
                    'defiance' => self::num($data, 'defiance')
                );
            }
        }
        return $clients;
    }

    /**
     * A Head only counts defiance among its OWN active clients: at least two
     * defiant and a strict majority of the family's client roster.
     */
    private static function ownClientMajorityDefiant($activeClients, $family)
    {
        $own = 0;
        $defiant = 0;
        foreach ($activeClients as $client) {
            if ($client['clientOf'] !== $family) {
                continue;
            }
            $own++;
            if ($client['defiance'] > 0) {
                $defiant++;
            }
        }
        return $defiant >= 2 && $defiant * 2 > $own;
    }

    /**
     * Single deterministic contagion wave: sources are fixed against the
     * pre-turn snapshot before any defiance is added.
     */
    public static function applyDefianceContagion($currentState, $originalState)
    {
        $logs = array();
        $newState = self::cloneTerritories($currentState);
        $happinessThreshold = 120;

        $sortedKeys = array_keys($newState);
        sort($sortedKeys, SORT_STRING);

        $sourceKeys = array();
        foreach ($sortedKeys as $sourceKey) {
            $orig = isset($originalState[$sourceKey]) ? $originalState[$sourceKey] : array();
            $source = $newState[$sourceKey];
            if (self::str($source, 'type') !== 'Client' || self::isEliminated($source)) {
                continue;
            }
            $goodExample = self::num($orig, 'happiness') < $happinessThreshold && self::num($source, 'happiness') >= $happinessThreshold;
            $defianceBreakout = self::num($orig, 'defiance') < 3 && self::num($source, 'defiance') >= 3;
            $successfulBreakaway = self::str($source, 'outcome') === 'Won' && self::str($orig, 'outcome') !== 'Won';
            if ($goodExample || $defianceBreakout || $successfulBreakaway) {
                $sourceKeys[] = $sourceKey;
            }
        }

        foreach ($sourceKeys as $sourceKey) {
            $source = $newState[$sourceKey];
            foreach ($sortedKeys as $targetKey) {
                if (!self::areRelatedClients($sourceKey, $source, $targetKey, $newState[$targetKey])) {
                    continue;
                }
                if (self::isEliminated($newState[$targetKey])) {
                    continue;
                }
                $newState[$targetKey]['defiance'] = self::num($newState[$targetKey], 'defiance') + 1;
                $logs[] = 'Contagion: ' . $targetKey . ' defiance +1 due to ' . $sourceKey;
            }
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    private static function areRelatedClients($sourceKey, $source, $targetKey, $target)
    {
        if (!is_array($source) || !is_array($target) || $sourceKey === $targetKey) {
            return false;
        }
        if (self::str($target, 'type') !== 'Client') {
            return false;
        }
        $sourceNeighbors = isset($source['neighbors']) && is_array($source['neighbors']) ? $source['neighbors'] : array();
        $targetNeighbors = isset($target['neighbors']) && is_array($target['neighbors']) ? $target['neighbors'] : array();
        return self::str($source, 'clientOf') === self::str($target, 'clientOf')
            || in_array($targetKey, $sourceNeighbors, true)
            || in_array($sourceKey, $targetNeighbors, true);
    }

    public static function applyComebackPressure($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        $objectives = self::objectives();

        $runawayHeads = array();
        foreach ($newState as $key => $data) {
            if (self::str($data, 'type') === 'Head' && !self::isEliminated($data)
                && self::num($data, 'wealth') >= $objectives['headRunawayWealth']) {
                $runawayHeads[] = $key;
            }
        }

        $sortedKeys = array_keys($newState);
        sort($sortedKeys, SORT_STRING);

        foreach ($runawayHeads as $headKey) {
            $headFamily = self::str($newState[$headKey], 'family');
            $newState[$headKey]['socialCapital'] = max(0, self::num($newState[$headKey], 'socialCapital') - 6);
            // Only the unhappiest of the runaway Head's clients is emboldened,
            // so a Head can still answer the pressure with one response per
            // round (ties break on sorted key order).
            $emboldenedKey = null;
            foreach ($sortedKeys as $key) {
                if ($key === $headKey || self::isEliminated($newState[$key])) {
                    continue;
                }
                if (self::str($newState[$key], 'type') === 'Client' && self::str($newState[$key], 'clientOf') === $headFamily) {
                    if ($emboldenedKey === null
                        || self::num($newState[$key], 'happiness') < self::num($newState[$emboldenedKey], 'happiness')) {
                        $emboldenedKey = $key;
                    }
                } elseif (self::str($newState[$key], 'type') === 'Regional') {
                    $newState[$key]['politicalCapital'] = self::num($newState[$key], 'politicalCapital') + 4;
                    $newState[$key]['rivalryPressure'] = self::num($newState[$key], 'rivalryPressure') + 2;
                }
            }
            if ($emboldenedKey !== null) {
                $newState[$emboldenedKey]['defiance'] = self::num($newState[$emboldenedKey], 'defiance') + 1;
                $newState[$emboldenedKey]['independenceSentiment'] = min(100, max(0, self::num($newState[$emboldenedKey], 'independenceSentiment') + 5));
                $logs[] = 'Comeback pressure: ' . $emboldenedKey . ' is emboldened against ' . $headKey;
            }
            $logs[] = 'Comeback pressure: ' . $headKey . ' runaway wealth strains the hierarchy';
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    /**
     * Cleanup-phase recovery: a small deterministic economic and civic
     * regeneration. Mirrors applyCleanupRecovery in frontend/rules.js.
     */
    public static function applyCleanupRecovery($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        $recovery = self::recovery();

        foreach (array_keys($newState) as $key) {
            $data =& $newState[$key];
            if (self::isEliminated($data)) {
                unset($data);
                continue;
            }
            $parts = array();

            // 1. Production: every territory produces wealth from its development.
            $production = $recovery['productionBase']
                + intval(floor(self::num($data, 'development') / $recovery['productionDevelopmentDivisor']));
            $data['wealth'] = self::num($data, 'wealth') + $production;
            $parts[] = '+' . $production . ' wealth';

            // 2. Stash trickle: poor family coffers skim a little national wealth.
            if (self::num($data, 'stash') < $recovery['stashTrickleCeiling']
                && self::num($data, 'wealth') >= $recovery['stashTrickleMinWealth']) {
                $data['wealth'] = self::num($data, 'wealth') - $recovery['stashTrickle'];
                $data['stash'] = self::num($data, 'stash') + $recovery['stashTrickle'];
                $parts[] = '+' . $recovery['stashTrickle'] . ' stash from wealth';
            }

            // 3. Civic regeneration: content publics slowly rebuild capital.
            if (self::num($data, 'happiness') >= $recovery['capitalRegenHappinessFloor']) {
                if (self::num($data, 'socialCapital') < $recovery['capitalRegenCap']) {
                    $data['socialCapital'] = min($recovery['capitalRegenCap'], self::num($data, 'socialCapital') + $recovery['capitalRegen']);
                }
                if (self::num($data, 'politicalCapital') < $recovery['capitalRegenCap']) {
                    $data['politicalCapital'] = min($recovery['capitalRegenCap'], self::num($data, 'politicalCapital') + $recovery['capitalRegen']);
                }
                $parts[] = '+' . $recovery['capitalRegen'] . ' Social/Political Capital';
            }

            // 4. Unrest exhaustion: miserable publics drift back toward normalcy.
            if (self::num($data, 'happiness') < $recovery['happinessRecoveryCeiling']) {
                $data['happiness'] = min(200, max(0, self::num($data, 'happiness') + $recovery['happinessRecovery']));
                $parts[] = '+' . $recovery['happinessRecovery'] . ' happiness';
            }

            $logs[] = 'Recovery for ' . $key . ': ' . implode(', ', $parts);
            unset($data);
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    /**
     * A defiant-client majority must stand through consecutive cleanup phases
     * before it topples a Head. The counter rises by 1 per cleanup while the
     * majority holds and resets to 0 the moment it breaks. Mirrors
     * updateDefianceMajorityCounters in frontend/rules.js.
     */
    public static function updateDefianceMajorityCounters($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        $activeClients = self::activeClientSnapshot($newState);

        foreach (array_keys($newState) as $key) {
            $data =& $newState[$key];
            if (self::str($data, 'type') !== 'Head' || self::isEliminated($data)) {
                unset($data);
                continue;
            }
            $majority = self::ownClientMajorityDefiant($activeClients, self::str($data, 'family'));
            $previous = self::num($data, 'defianceMajorityRounds');
            $data['defianceMajorityRounds'] = $majority ? $previous + 1 : 0;
            if ($majority) {
                $logs[] = 'Defiant-client majority stands against ' . $key
                    . ' (cleanup ' . $data['defianceMajorityRounds'] . ' of ' . GRANDAREA_HEAD_DEFIANCE_MAJORITY_ROUNDS_TO_LOSE . ')';
            } elseif ($previous > 0) {
                $logs[] = 'Defiant-client majority broken before it could topple ' . $key;
            }
            unset($data);
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    public static function resolveResourcePressure($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);

        foreach (array_keys($newState) as $key) {
            if (self::isEliminated($newState[$key])) {
                continue;
            }
            $missing = self::missingResourcesFor($key, $newState);
            if (count($missing) === 0) {
                continue;
            }
            $wealthLoss = count($missing) * 5 + (in_array('Oil', $missing, true) ? self::num($newState[$key], 'armies') : 0);
            $developmentLoss = count($missing);
            $happinessLoss = count($missing) * 2;
            $newState[$key]['wealth'] = max(0, self::num($newState[$key], 'wealth') - $wealthLoss);
            $newState[$key]['development'] = max(0, self::num($newState[$key], 'development') - $developmentLoss);
            $newState[$key]['happiness'] = max(0, self::num($newState[$key], 'happiness') - $happinessLoss);
            $logs[] = $key . ' lacks ' . implode(', ', $missing)
                . ' (-' . $wealthLoss . ' wealth, -' . $developmentLoss . ' development, -' . $happinessLoss . ' happiness)';
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    public static function resolveSentiment($state)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);

        foreach (array_keys($newState) as $key) {
            $data =& $newState[$key];
            if (self::isEliminated($data)) {
                unset($data);
                continue;
            }

            $independenceDelta = 0;
            if (self::str($data, 'type') === 'Client') {
                $independenceDelta += self::num($data, 'defiance') * 5;
                if (self::num($data, 'happiness') >= 120) {
                    $independenceDelta += 5;
                }
            }

            $governanceDelta = 0;
            if (self::num($data, 'happiness') < 60) {
                $governanceDelta += 5;
            }
            if (self::num($data, 'stash') > self::num($data, 'happiness')) {
                $governanceDelta += 5;
            }
            if (self::num($data, 'education') >= 70 && self::num($data, 'happiness') < 90) {
                $governanceDelta += 3;
            }
            $governanceDelta -= intval(floor(self::num($data, 'fear') / 25));
            if (self::str($data, 'type') === 'Client' && self::num($data, 'education') >= 70 && self::num($data, 'happiness') >= 100) {
                $independenceDelta += 3;
            }

            $data['independenceSentiment'] = min(100, max(0, self::num($data, 'independenceSentiment') + $independenceDelta));
            $data['governanceChangeSentiment'] = min(100, max(0, self::num($data, 'governanceChangeSentiment') + $governanceDelta));

            if ($independenceDelta || $governanceDelta) {
                $logs[] = $key . ' sentiment changed (independence ' . ($independenceDelta >= 0 ? '+' : '') . $independenceDelta
                    . ', governance ' . ($governanceDelta >= 0 ? '+' : '') . $governanceDelta . ')';
            }
            unset($data);
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    /**
     * Cleanup pipeline, matching frontend/rules.js resolveCleanup:
     * capital checks / counters / protection expiry / uprising ->
     * resource pressure -> sentiment -> recovery -> comeback pressure ->
     * defiance-majority counters -> objectives.
     */
    public static function resolveCleanup($state, $seed)
    {
        $logs = array('Using replay seed: ' . $seed, '--- Phase 4: The Heat (Cleanup) ---');
        $newState = self::cloneTerritories($state);

        foreach (array_keys($newState) as $key) {
            $data =& $newState[$key];
            if (!self::isTerritory($data)) {
                unset($data);
                continue;
            }
            if (self::str($data, 'family') === 'Anarchy' || self::str($data, 'family') === 'Collapsed') {
                unset($data);
                continue;
            }

            // A family that has already achieved its objective can no longer
            // collapse: the game ended for them at the moment of victory.
            if (self::str($data, 'outcome') === 'Won') {
                unset($data);
                continue;
            }

            if (self::num($data, 'stash') <= 0) {
                $logs[] = 'GAME OVER for ' . $key . ': Personal Capital (Stash) hit zero.';
                $data['family'] = 'Collapsed';
            } elseif (self::num($data, 'politicalCapital') <= 0) {
                $logs[] = 'GAME OVER for ' . $key . ': Political Capital hit zero.';
                $data['family'] = 'Collapsed';
            } elseif (self::num($data, 'socialCapital') <= 0) {
                $logs[] = 'GAME OVER for ' . $key . ': Social Capital hit zero.';
                $data['family'] = 'Collapsed';
            }

            if (self::str($data, 'family') === 'Collapsed') {
                $data['wealth'] = 0;
                $data['stash'] = 0;
                unset($data);
                continue;
            }

            $hadProtection = self::num($data, 'protectionDeal') > 0;
            $data['protectionDeal'] = max(0, self::num($data, 'protectionDeal') - 1);
            if ($hadProtection && self::num($data, 'protectionDeal') === 0 && self::truthyField($data, 'protected')) {
                $data['protected'] = false;
                $data['protectedBy'] = null;
                $logs[] = 'Protection expired for ' . $key;
            }
            $data['realignmentPressure'] = max(0, self::num($data, 'realignmentPressure') - 1);
            $data['rivalryPressure'] = max(0, self::num($data, 'rivalryPressure') - 1);

            // Uprising check: Happiness < Personal Capital (Stash), but only
            // a genuinely miserable public revolts (below the safe floor).
            if (self::num($data, 'happiness') < self::num($data, 'stash')
                && self::num($data, 'happiness') < GRANDAREA_UPRISING_HAPPINESS_SAFE_FLOOR) {
                if (self::seededRoll($seed, $key) < 0.5) {
                    $logs[] = 'UPRISING in ' . $key . '! Happiness (' . self::num($data, 'happiness') . ') < Stash (' . self::num($data, 'stash') . '). The Family falls!';
                    $data['family'] = 'Anarchy';
                    $data['stash'] = 0;
                    $data['wealth'] = 0;
                    $data['invaded'] = false;
                } else {
                    $logs[] = 'Unrest in ' . $key . ' (Happiness < Stash), but the regime holds.';
                }
            }
            unset($data);
        }

        $resourceResult = self::resolveResourcePressure($newState);
        $sentimentResult = self::resolveSentiment($resourceResult['newState']);
        $recoveryResult = self::applyCleanupRecovery($sentimentResult['newState']);
        $comebackResult = self::applyComebackPressure($recoveryResult['newState']);
        $majorityResult = self::updateDefianceMajorityCounters($comebackResult['newState']);
        $objectiveResult = self::evaluateObjectives($majorityResult['newState']);

        return array(
            'newState' => $objectiveResult['newState'],
            'logs' => array_merge(
                $logs,
                $resourceResult['logs'],
                $sentimentResult['logs'],
                $recoveryResult['logs'],
                $comebackResult['logs'],
                $majorityResult['logs'],
                $objectiveResult['logs']
            )
        );
    }

    // ------------------------------------------------------------------
    // Player cards
    // ------------------------------------------------------------------

    /**
     * Port of frontend/rules.js resolveCard: all 17 player cards.
     */
    public static function resolveCard($state, $cardId, $actorKey, $targetKey)
    {
        $logs = array();
        $newState = self::cloneTerritories($state);
        $hasA = isset($newState[$actorKey]);
        $hasT = $targetKey !== null && isset($newState[$targetKey]);
        if ($hasA && self::isEliminated($newState[$actorKey])) {
            $logs[] = $actorKey . ' is eliminated and cannot play cards';
            return array('newState' => $newState, 'logs' => $logs);
        }
        if ($hasA) {
            $A =& $newState[$actorKey];
        } else {
            $A = null;
        }
        if ($hasT) {
            $T =& $newState[$targetKey];
        } else {
            $T = null;
        }

        $logs[] = $actorKey . ' plays ' . $cardId . ' on ' . ($targetKey !== null ? $targetKey : 'Self');

        switch ($cardId) {
            case 'promoting_democracy':
                if ($hasA) {
                    $A['socialCapital'] = self::num($A, 'socialCapital') + 20;
                    $logs[] = $actorKey . ' gains +20 Social Capital';
                }
                break;
            case 'media_blitz':
                if ($hasA) {
                    $A['socialCapital'] = self::num($A, 'socialCapital') + 15;
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                    $logs[] = $actorKey . ' runs a Media Blitz (+15 Social Capital, +5 Political Capital)';
                }
                break;
            case 'humanitarian_airlift':
                if ($hasA && $hasT) {
                    $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 15));
                    $A['socialCapital'] = self::num($A, 'socialCapital') + 5;
                    $logs[] = $actorKey . ' sends a Humanitarian Airlift to ' . $targetKey;
                }
                break;
            case 'patriotic_rally':
                if ($hasA) {
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') + 10;
                    $A['fear'] = min(100, max(0, self::num($A, 'fear') + 5));
                    $A['happiness'] = min(200, max(0, self::num($A, 'happiness') - 3));
                    $logs[] = $actorKey . ' stages a Patriotic Rally (+10 Political Capital, +5 fear)';
                }
                break;
            case 'rotten_apple':
                if ($hasT) {
                    $lost = intval(floor(self::num($T, 'happiness') * 0.5));
                    $T['happiness'] = self::num($T, 'happiness') - $lost;
                    $logs[] = $targetKey . ' loses ' . $lost . ' Happiness';
                }
                break;
            case 'structural_adjustment':
                if ($hasA && $hasT) {
                    $stolen = min(10, self::num($T, 'education'));
                    $T['education'] = self::num($T, 'education') - $stolen;
                    $A['wealth'] = self::num($A, 'wealth') + $stolen;
                    $logs[] = $actorKey . ' drains ' . $stolen . ' Education from ' . $targetKey;
                }
                break;
            case 'debt_trap':
                if ($hasA && $hasT) {
                    $T['debt'] = self::num($T, 'debt') + 15;
                    $T['happiness'] = min(200, max(0, self::num($T, 'happiness') - 5));
                    $A['wealth'] = self::num($A, 'wealth') + 10;
                    $logs[] = $actorKey . ' traps ' . $targetKey . ' in debt (+15 debt)';
                }
                break;
            case 'protection_pact':
                if ($hasA && $hasT) {
                    if (self::num($A, 'stash') < 5) {
                        $logs[] = $actorKey . ' failed Protection Pact (insufficient stash)';
                        break;
                    }
                    $A['stash'] = max(0, self::num($A, 'stash') - 5);
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                    $T['protected'] = true;
                    $T['protectedBy'] = self::str($A, 'family');
                    $T['protectionDeal'] = max(self::num($T, 'protectionDeal'), 2);
                    $T['happiness'] = min(200, max(0, self::num($T, 'happiness') + 6));
                    $logs[] = $actorKey . ' signs a Protection Pact with ' . $targetKey;
                }
                break;
            case 'resource_contract':
                if ($hasA && $hasT) {
                    $extracted = min(8, self::num($T, 'wealth'));
                    $A['wealth'] = self::num($A, 'wealth') + $extracted;
                    $T['wealth'] = max(0, self::num($T, 'wealth') - $extracted);
                    $T['development'] = min(150, max(0, self::num($T, 'development') - 4));
                    $T['governanceChangeSentiment'] = min(100, max(0, self::num($T, 'governanceChangeSentiment') + 4));
                    $logs[] = $actorKey . ' extracts ' . $extracted . ' wealth through a Resource Contract';
                }
                break;
            case 'false_flag':
                if ($hasA) {
                    if (self::num($A, 'blackBudget') < 8) {
                        $logs[] = $actorKey . ' failed False Flag (insufficient Black Budget)';
                        break;
                    }
                    $A['blackBudget'] = max(0, self::num($A, 'blackBudget') - 8);
                    $A['socialCapital'] = self::num($A, 'socialCapital') + 50;
                    $logs[] = $actorKey . ' pays 8 Black Budget for +50 Social Capital';
                }
                break;
            case 'covert_files':
                if ($hasT) {
                    $T['governanceChangeSentiment'] = min(100, max(0, self::num($T, 'governanceChangeSentiment') + 10));
                    $T['factionalDivision'] = min(100, max(0, self::num($T, 'factionalDivision') + 5));
                    $logs[] = $actorKey . ' leaks Covert Files on ' . $targetKey;
                }
                break;
            case 'kompromat':
                if ($hasA && $hasT) {
                    $T['politicalCapital'] = max(0, self::num($T, 'politicalCapital') - 12);
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                    $logs[] = $actorKey . ' uses Kompromat against ' . $targetKey;
                }
                break;
            case 'counterintelligence':
                if ($hasA) {
                    $A['blackBudget'] = self::num($A, 'blackBudget') + 6;
                    $A['factionalDivision'] = min(100, max(0, self::num($A, 'factionalDivision') - 8));
                    $logs[] = $actorKey . ' runs Counterintelligence (+6 Black Budget, -8 factional division)';
                }
                break;
            case 'sanctions_package':
                if ($hasA && $hasT) {
                    $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - 3);
                    $T['wealth'] = max(0, self::num($T, 'wealth') - 12);
                    $T['happiness'] = min(200, max(0, self::num($T, 'happiness') - 8));
                    $T['sanctioned'] = true;
                    $logs[] = $actorKey . ' plays a Sanctions Package on ' . $targetKey;
                }
                break;
            case 'proxy_network':
                if ($hasA && $hasT) {
                    if (self::num($A, 'blackBudget') < 5) {
                        $logs[] = $actorKey . ' failed Proxy Network (insufficient Black Budget)';
                        break;
                    }
                    $A['blackBudget'] = max(0, self::num($A, 'blackBudget') - 5);
                    $T['defiance'] = self::num($T, 'defiance') + 2;
                    $T['factionalDivision'] = min(100, max(0, self::num($T, 'factionalDivision') + 8));
                    $logs[] = $actorKey . ' activates a Proxy Network in ' . $targetKey;
                }
                break;
            case 'retaliation_strike':
                if ($hasA && $hasT) {
                    if (self::num($A, 'blackBudget') < 6) {
                        $logs[] = $actorKey . ' failed Retaliation Strike (insufficient Black Budget)';
                        break;
                    }
                    $A['blackBudget'] = max(0, self::num($A, 'blackBudget') - 6);
                    $A['socialCapital'] = max(0, self::num($A, 'socialCapital') - 8);
                    $T['wealth'] = max(0, self::num($T, 'wealth') - 10);
                    $T['fear'] = min(100, max(0, self::num($T, 'fear') + 8));
                    $logs[] = $actorKey . ' launches a Retaliation Strike against ' . $targetKey;
                }
                break;
            case 'offshore_haven':
                if ($hasA) {
                    $A['stash'] = self::num($A, 'stash') + 20;
                    $logs[] = $actorKey . ' moves funds to Offshore Haven (+20 Stash)';
                }
                break;
            default:
                $logs[] = 'Effect for ' . $cardId . ' not implemented.';
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    // ------------------------------------------------------------------
    // Ordering, RNG, shared helpers
    // ------------------------------------------------------------------

    public static function compareActions($a, $b, $state)
    {
        $aState = isset($state[$a['family']]) ? $state[$a['family']] : array();
        $bState = isset($state[$b['family']]) ? $state[$b['family']] : array();
        $diff = self::num($aState, 'wealth') - self::num($bState, 'wealth');
        if ($diff !== 0) {
            return $diff;
        }

        $aRole = isset(self::$roleOrder[self::str($aState, 'type')]) ? self::$roleOrder[self::str($aState, 'type')] : 99;
        $bRole = isset(self::$roleOrder[self::str($bState, 'type')]) ? self::$roleOrder[self::str($bState, 'type')] : 99;
        if ($aRole !== $bRole) {
            return $aRole - $bRole;
        }

        $aAction = isset(self::$actionPriority[$a['action']]) ? self::$actionPriority[$a['action']] : 50;
        $bAction = isset(self::$actionPriority[$b['action']]) ? self::$actionPriority[$b['action']] : 50;
        if ($aAction !== $bAction) {
            return $aAction - $bAction;
        }

        $familyCompare = strcmp(strval($a['family']), strval($b['family']));
        if ($familyCompare !== 0) {
            return $familyCompare;
        }

        return intval($a['order']) - intval($b['order']);
    }

    public static function seededRoll($seed, $step)
    {
        $hash = hash('sha256', strval($seed) . '|' . strval($step));
        $slice = substr($hash, 0, 8);
        $value = hexdec($slice);
        return $value / 0xffffffff;
    }

    /**
     * Resource pool for a territory: its own resources, plus compliant
     * clients it controls; compliant clients also draw on the overlord
     * family's territories and compliant bloc-mates. Eliminated territories
     * never contribute.
     */
    public static function availableResourcesFor($key, $state)
    {
        $data = isset($state[$key]) ? $state[$key] : array();
        $resources = self::resourceList($data, 'resources');
        $family = self::str($data, 'family');
        $clientOf = self::str($data, 'clientOf');
        $isCompliantClient = self::str($data, 'type') === 'Client' && $clientOf !== '' && self::num($data, 'defiance') === 0;

        foreach ($state as $otherKey => $other) {
            if ($otherKey === $key) {
                continue;
            }
            if (!self::isTerritory($other) || self::isEliminated($other)) {
                continue;
            }
            if (self::str($other, 'type') === 'Client' && self::str($other, 'clientOf') === $family && self::num($other, 'defiance') === 0) {
                $resources = array_merge($resources, self::resourceList($other, 'resources'));
            }
            if ($isCompliantClient) {
                $isOverlordTerritory = self::str($other, 'family') === $clientOf;
                $isBlocMate = self::str($other, 'type') === 'Client'
                    && self::str($other, 'clientOf') === $clientOf
                    && self::num($other, 'defiance') === 0;
                if ($isOverlordTerritory || $isBlocMate) {
                    $resources = array_merge($resources, self::resourceList($other, 'resources'));
                }
            }
        }
        return array_values(array_unique($resources));
    }

    public static function missingResourcesFor($key, $state)
    {
        $needs = self::resourceList(isset($state[$key]) ? $state[$key] : array(), 'resourceNeeds');
        $available = self::availableResourcesFor($key, $state);
        $missing = array();
        foreach ($needs as $need) {
            if (!in_array($need, $available, true)) {
                $missing[] = $need;
            }
        }
        return $missing;
    }

    /**
     * Overlord lookup: direct territory-key match first, then a family-name
     * scan (mirrors findOverlordTerritory in frontend/rules.js).
     */
    public static function findOverlordKeyByName($state, $overlordName)
    {
        if ($overlordName === null || $overlordName === '') {
            return null;
        }
        if (isset($state[$overlordName])) {
            return $overlordName;
        }
        foreach ($state as $key => $territory) {
            if (self::str($territory, 'family') === $overlordName) {
                return $key;
            }
        }
        return null;
    }

    private static function cloneTerritories($state)
    {
        $out = array();
        foreach ($state as $key => $value) {
            if (self::isTerritory($value)) {
                $out[$key] = $value;
            }
        }
        return $out;
    }

    private static function isTerritory($value)
    {
        return is_array($value)
            && isset($value['family'])
            && isset($value['type'])
            && array_key_exists('wealth', $value)
            && array_key_exists('happiness', $value);
    }

    public static function isEliminated($data)
    {
        return self::str($data, 'family') === 'Anarchy'
            || self::str($data, 'family') === 'Collapsed'
            || self::str($data, 'outcome') === 'Lost';
    }

    private static function resourceList($data, $field)
    {
        if (!isset($data[$field])) {
            return array();
        }
        if (is_array($data[$field])) {
            return array_values($data[$field]);
        }
        return array_values(array_filter(array_map('trim', explode('/', strval($data[$field])))));
    }

    /** Public wrappers used from closures (PHP 5.3-safe scope access). */
    public static function resourceListPublic($data, $field)
    {
        return self::resourceList($data, $field);
    }

    public static function fieldNum($data, $field)
    {
        return self::num($data, $field);
    }

    public static function fieldStr($data, $field)
    {
        return self::str($data, $field);
    }

    /**
     * Post-action clamps, identical to the inline clamp block at the end of
     * each action in frontend/rules.js resolveTurn.
     */
    private static function clampTargetCommon(&$data)
    {
        $data['wealth'] = max(0, self::num($data, 'wealth'));
        $data['happiness'] = min(200, max(0, self::num($data, 'happiness')));
        $data['debt'] = max(0, self::num($data, 'debt'));
        $data['defiance'] = max(0, self::num($data, 'defiance'));
    }

    private static function clampActorCommon(&$data)
    {
        foreach (array('wealth', 'stash', 'blackBudget', 'socialCapital', 'politicalCapital', 'armies', 'debt') as $field) {
            $data[$field] = max(0, self::num($data, $field));
        }
        $data['happiness'] = min(200, max(0, self::num($data, 'happiness')));
        $data['education'] = min(150, max(0, self::num($data, 'education')));
        $data['development'] = min(150, max(0, self::num($data, 'development')));
    }

    private static function truthyField($data, $field)
    {
        return isset($data[$field]) && $data[$field] ? true : false;
    }

    private static function num($data, $field)
    {
        return isset($data[$field]) ? intval($data[$field]) : 0;
    }

    private static function str($data, $field)
    {
        return isset($data[$field]) && $data[$field] !== null ? strval($data[$field]) : '';
    }
}
