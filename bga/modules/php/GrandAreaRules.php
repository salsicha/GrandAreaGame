<?php

require_once __DIR__ . '/constants.inc.php';

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

    public static function normalizeAction($payload)
    {
        $action = isset($payload['action']) ? strval($payload['action']) : 'Pass';
        if (!in_array($action, self::allowedActions(), true)) {
            throw new InvalidArgumentException('Illegal action: ' . $action);
        }

        $family = isset($payload['family']) ? strval($payload['family']) : '';
        if ($family === '') {
            throw new InvalidArgumentException('Missing acting family');
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
                throw new InvalidArgumentException('Unknown acting family: ' . $action['family']);
            }
            if ($action['target'] !== $action['family'] && !isset($state[$action['target']])) {
                throw new InvalidArgumentException('Unknown target: ' . $action['target']);
            }
            $action['order'] = $idx;
            $out[] = $action;
        }
        return $out;
    }

    public static function resolveTribute($state)
    {
        $logs = array('--- Phase 2: The Tribute ---');
        $newState = self::cloneTerritories($state);

        foreach ($newState as $key => &$territory) {
            if (!self::isTerritory($territory) || self::isEliminated($territory)) {
                continue;
            }
            if ($territory['type'] === 'Head' || $territory['type'] === 'Regional') {
                continue;
            }

            $overlord = isset($territory['clientOf']) ? $territory['clientOf'] : 'USA';
            if (self::num($territory, 'tributeHoliday') > 0) {
                $territory['tributeHoliday'] = max(0, self::num($territory, 'tributeHoliday') - 1);
                $logs[] = 'Tribute holiday: ' . $territory['family'] . ' (in ' . $key . ') skips tribute to ' . $overlord;
                continue;
            }
            if (self::num($territory, 'defiance') > 0) {
                $logs[] = $territory['family'] . ' (in ' . $key . ') refuses tribute to ' . $overlord;
                continue;
            }

            $amount = intval(floor(self::num($territory, 'wealth') * 0.20));
            if ($amount <= 0) {
                continue;
            }

            $territory['wealth'] = self::num($territory, 'wealth') - $amount;
            $overlordKey = self::findTerritoryByFamily($newState, $overlord);
            if ($overlordKey !== null) {
                $newState[$overlordKey]['wealth'] = self::num($newState[$overlordKey], 'wealth') + $amount;
            }
            $logs[] = $territory['family'] . ' (in ' . $key . ') pays ' . $amount . ' tribute to ' . $overlord;
        }
        unset($territory);

        return array('newState' => $newState, 'logs' => $logs);
    }

    public static function resolveTurn($state, $actions, $seed)
    {
        $logs = array('Using replay seed: ' . $seed);
        $newState = self::cloneTerritories($state);
        $normalized = self::validateActions($newState, $actions);

        usort($normalized, function ($a, $b) use ($newState) {
            return GrandAreaRules::compareActions($a, $b, $newState);
        });

        $logs[] = 'Resolving actions (wealth, role, action priority, family id)';
        foreach ($normalized as $idx => $entry) {
            $actor = $entry['family'];
            $target = $entry['target'];
            $action = $entry['action'];
            $logs[] = $actor . ' => ' . $action . ' -> ' . $target;

            if (!isset($newState[$actor]) || self::isEliminated($newState[$actor])) {
                $logs[] = $actor . ' cannot act';
                continue;
            }

            if (!isset($newState[$target])) {
                $target = $actor;
            }

            self::resolveAction($newState, $actor, $action, $target, $entry, $seed, $idx, $logs);
            self::clampCommon($newState[$actor]);
            if (isset($newState[$target])) {
                self::clampCommon($newState[$target]);
            }
        }

        return array('newState' => $newState, 'logs' => $logs);
    }

    public static function resolveCleanup($state, $seed)
    {
        $logs = array('Using replay seed: ' . $seed, '--- Phase 7: Cleanup ---');
        $newState = self::cloneTerritories($state);

        foreach ($newState as $key => &$data) {
            if (!self::isTerritory($data) || self::isEliminated($data)) {
                continue;
            }

            if (self::num($data, 'stash') <= 0 || self::num($data, 'politicalCapital') <= 0 || self::num($data, 'socialCapital') <= 0) {
                $data['family'] = 'Collapsed';
                $data['wealth'] = 0;
                $data['stash'] = 0;
                $logs[] = 'GAME OVER for ' . $key . ': capital exhausted.';
                continue;
            }

            $data['protectionDeal'] = max(0, self::num($data, 'protectionDeal') - 1);
            $data['realignmentPressure'] = max(0, self::num($data, 'realignmentPressure') - 1);
            $data['rivalryPressure'] = max(0, self::num($data, 'rivalryPressure') - 1);

            if (self::num($data, 'happiness') < self::num($data, 'stash') && self::seededRoll($seed, $key) < 0.5) {
                $data['family'] = 'Anarchy';
                $data['wealth'] = 0;
                $data['stash'] = 0;
                $data['invaded'] = false;
                $logs[] = 'UPRISING in ' . $key . ': family control falls.';
            }
        }
        unset($data);

        return array('newState' => $newState, 'logs' => $logs);
    }

    private static function resolveAction(&$state, $actorKey, $action, $targetKey, $entry, $seed, $idx, &$logs)
    {
        $A =& $state[$actorKey];
        $T =& $state[$targetKey];

        switch ($action) {
            case 'Skim':
                $taken = min(10, self::num($T, 'wealth'));
                $T['wealth'] = self::num($T, 'wealth') - $taken;
                $A['stash'] = self::num($A, 'stash') + $taken;
                $T['happiness'] = self::num($T, 'happiness') - 6;
                $logs[] = $actorKey . ' skimmed ' . $taken . ' from ' . $targetKey;
                break;
            case 'Propaganda':
                if (self::num($A, 'stash') < 8) {
                    $logs[] = $actorKey . ' failed Propaganda';
                    break;
                }
                $A['stash'] = self::num($A, 'stash') - 8;
                $T['happiness'] = self::num($T, 'happiness') + 10;
                break;
            case 'Invade':
                if (self::num($A, 'armies') < 1 || self::num($A, 'wealth') < 12) {
                    $logs[] = $actorKey . ' failed Invade';
                    break;
                }
                $framing = min(self::num($A, 'socialCapital'), isset($entry['framing']) ? intval($entry['framing']) : 0);
                $A['socialCapital'] = self::num($A, 'socialCapital') - $framing - max(0, 15 - intval(floor($framing / 2)));
                $A['wealth'] = self::num($A, 'wealth') - 12;
                $A['armies'] = self::num($A, 'armies') - 1;
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                $T['invaded'] = true;
                $T['protected'] = false;
                $T['protectedBy'] = null;
                $T['happiness'] = self::num($T, 'happiness') - max(8, 25 - $framing);
                $T['wealth'] = self::num($T, 'wealth') - 10;
                $T['fear'] = self::num($T, 'fear') + 10;
                $T['governanceChangeSentiment'] = self::num($T, 'governanceChangeSentiment') + 8;
                if (self::str($T, 'type') === 'Client') {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                break;
            case 'Sanction':
                if (self::num($A, 'politicalCapital') < 5) {
                    $logs[] = $actorKey . ' failed Sanction';
                    break;
                }
                $loss = min(18, self::num($T, 'wealth'));
                $A['politicalCapital'] = self::num($A, 'politicalCapital') - 5;
                $A['wealth'] = self::num($A, 'wealth') + intval(floor($loss * 0.25));
                $T['wealth'] = self::num($T, 'wealth') - $loss;
                $T['happiness'] = self::num($T, 'happiness') - 12;
                $T['development'] = self::num($T, 'development') - 5;
                $T['governanceChangeSentiment'] = self::num($T, 'governanceChangeSentiment') + 5;
                $T['sanctioned'] = true;
                break;
            case 'Protect':
            case 'ProtectionDeal':
                $stashCost = $action === 'Protect' ? 6 : 4;
                $wealthCost = $action === 'Protect' ? 8 : 6;
                if (self::num($A, 'stash') < $stashCost || self::num($A, 'wealth') < $wealthCost) {
                    $logs[] = $actorKey . ' failed ' . $action;
                    break;
                }
                $A['stash'] = self::num($A, 'stash') - $stashCost;
                $A['wealth'] = self::num($A, 'wealth') - $wealthCost;
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + ($action === 'Protect' ? 5 : 4);
                $T['protected'] = true;
                $T['protectedBy'] = self::str($A, 'family');
                $T['happiness'] = self::num($T, 'happiness') + ($action === 'Protect' ? 8 : 6);
                $T['protectionDeal'] = max(self::num($T, 'protectionDeal'), $action === 'Protect' ? 1 : 2);
                if (self::str($T, 'type') === 'Client' && self::str($T, 'clientOf') !== self::str($A, 'family')) {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                    $T['realignmentPressure'] = self::num($T, 'realignmentPressure') + 8;
                }
                break;
            case 'TributeHoliday':
                if (self::str($T, 'type') !== 'Client' || self::str($T, 'clientOf') !== self::str($A, 'family') || self::num($A, 'wealth') < 8) {
                    $logs[] = $actorKey . ' failed TributeHoliday';
                    break;
                }
                $A['wealth'] = self::num($A, 'wealth') - 8;
                $A['socialCapital'] = self::num($A, 'socialCapital') + 4;
                $T['tributeHoliday'] = max(self::num($T, 'tributeHoliday'), 1);
                $T['happiness'] = self::num($T, 'happiness') + 6;
                $T['defiance'] = max(0, self::num($T, 'defiance') - 1);
                break;
            case 'DebtShakedown':
                if (self::num($A, 'politicalCapital') < 8) {
                    $logs[] = $actorKey . ' failed DebtShakedown';
                    break;
                }
                $collected = min(20, self::num($T, 'wealth'));
                $A['politicalCapital'] = self::num($A, 'politicalCapital') - 8;
                $A['wealth'] = self::num($A, 'wealth') + $collected;
                $T['wealth'] = self::num($T, 'wealth') - $collected;
                $T['debt'] = self::num($T, 'debt') + $collected;
                $T['happiness'] = self::num($T, 'happiness') - 12;
                $T['governanceChangeSentiment'] = self::num($T, 'governanceChangeSentiment') + 7;
                if (self::str($T, 'type') === 'Client') {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                break;
            case 'EconomicExploitation':
                if (self::num($A, 'socialCapital') < 4) {
                    $logs[] = $actorKey . ' failed EconomicExploitation';
                    break;
                }
                $extracted = min(12, self::num($T, 'wealth'));
                $A['socialCapital'] = self::num($A, 'socialCapital') - 4;
                $A['wealth'] = self::num($A, 'wealth') + $extracted;
                $A['stash'] = self::num($A, 'stash') + intval(floor($extracted / 2));
                $T['wealth'] = self::num($T, 'wealth') - $extracted;
                $T['development'] = self::num($T, 'development') - 8;
                $T['happiness'] = self::num($T, 'happiness') - 8;
                $T['governanceChangeSentiment'] = self::num($T, 'governanceChangeSentiment') + 6;
                if (self::str($T, 'type') === 'Client') {
                    $T['defiance'] = self::num($T, 'defiance') + 1;
                }
                break;
            case 'ClientRealignment':
                $eligible = self::num($T, 'defiance') > 0 || self::num($T, 'independenceSentiment') >= 50 || self::num($T, 'realignmentPressure') >= 8;
                if (self::str($T, 'type') !== 'Client' || !$eligible || self::num($A, 'politicalCapital') < 12) {
                    $logs[] = $actorKey . ' failed ClientRealignment';
                    break;
                }
                $A['politicalCapital'] = self::num($A, 'politicalCapital') - 12;
                $A['socialCapital'] = self::num($A, 'socialCapital') - 4;
                $T['clientOf'] = self::str($A, 'family');
                $T['protected'] = true;
                $T['protectedBy'] = self::str($A, 'family');
                $T['realignmentPressure'] = 0;
                $T['defiance'] = 0;
                $T['happiness'] = self::num($T, 'happiness') + 4;
                $T['independenceSentiment'] = self::num($T, 'independenceSentiment') + 10;
                break;
            case 'RegionalRivalry':
                if (self::str($A, 'type') !== 'Regional' || self::str($T, 'type') !== 'Regional' || $actorKey === $targetKey || self::num($A, 'politicalCapital') < 6) {
                    $logs[] = $actorKey . ' failed RegionalRivalry';
                    break;
                }
                $A['politicalCapital'] = self::num($A, 'politicalCapital') - 6;
                $A['rivalryPressure'] = self::num($A, 'rivalryPressure') + 4;
                $T['rivalryPressure'] = self::num($T, 'rivalryPressure') + 10;
                $T['politicalCapital'] = self::num($T, 'politicalCapital') - 10;
                $T['factionalDivision'] = self::num($T, 'factionalDivision') + 8;
                break;
            case 'Coup':
                if (self::num($A, 'blackBudget') < 10) {
                    $logs[] = $actorKey . ' failed Coup';
                    break;
                }
                $A['blackBudget'] = self::num($A, 'blackBudget') - 10;
                $base = 0.5 + (self::num($A, 'politicalCapital') - self::num($T, 'politicalCapital')) / 200.0;
                $base += (self::num($T, 'governanceChangeSentiment') + self::num($T, 'factionalDivision') - self::num($T, 'fear')) / 300.0;
                $base = max(0.1, min(0.95, $base));
                if (self::seededRoll($seed, $idx) < $base) {
                    $T['family'] = self::str($A, 'family');
                    $T['happiness'] = self::num($T, 'happiness') - 20;
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') + 10;
                } else {
                    $A['politicalCapital'] = self::num($A, 'politicalCapital') - 15;
                    $A['socialCapital'] = self::num($A, 'socialCapital') - 20;
                }
                break;
            case 'FalseFlag':
                if (self::num($A, 'blackBudget') < 8) {
                    $logs[] = $actorKey . ' failed FalseFlag';
                    break;
                }
                $A['blackBudget'] = self::num($A, 'blackBudget') - 8;
                $A['socialCapital'] = self::num($A, 'socialCapital') + 50;
                break;
            case 'CovertInfluence':
                if (self::num($A, 'blackBudget') < 6) {
                    $logs[] = $actorKey . ' failed CovertInfluence';
                    break;
                }
                $A['blackBudget'] = self::num($A, 'blackBudget') - 6;
                $T['defiance'] = self::num($T, 'defiance') + 1;
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                break;
            case 'MakeExample':
                if (self::num($T, 'defiance') <= 0) {
                    $logs[] = $actorKey . ' failed MakeExample';
                    break;
                }
                $T['defiance'] = 0;
                $T['happiness'] = self::num($T, 'happiness') - 20;
                $A['socialCapital'] = self::num($A, 'socialCapital') - 10;
                $A['politicalCapital'] = self::num($A, 'politicalCapital') + 5;
                break;
            case 'Concession':
                if (self::num($T, 'defiance') <= 0 || self::num($A, 'wealth') < 10) {
                    $logs[] = $actorKey . ' failed Concession';
                    break;
                }
                $A['wealth'] = self::num($A, 'wealth') - 10;
                $A['politicalCapital'] = self::num($A, 'politicalCapital') - 5;
                $A['socialCapital'] = self::num($A, 'socialCapital') + 5;
                $T['defiance'] = 0;
                $T['happiness'] = self::num($T, 'happiness') + 10;
                break;
            case 'Educate':
                if (self::num($A, 'wealth') < 8) {
                    $logs[] = $actorKey . ' failed Educate';
                    break;
                }
                $A['wealth'] = self::num($A, 'wealth') - 8;
                $A['education'] = self::num($A, 'education') + 10;
                $A['development'] = self::num($A, 'development') + 3;
                $A['governanceChangeSentiment'] = self::num($A, 'governanceChangeSentiment') + 2;
                if (self::str($A, 'type') === 'Client') {
                    $A['independenceSentiment'] = self::num($A, 'independenceSentiment') + 2;
                }
                break;
            case 'Develop':
                if (self::num($A, 'wealth') < 10) {
                    $logs[] = $actorKey . ' failed Develop';
                    break;
                }
                $resources = self::availableResourcesFor($actorKey, $state);
                if (!in_array('Industry', $resources, true) && !in_array('Technology', $resources, true)) {
                    $logs[] = $actorKey . ' failed Develop';
                    break;
                }
                $A['wealth'] = self::num($A, 'wealth') - 5;
                $A['development'] = self::num($A, 'development') + 10;
                $A['happiness'] = self::num($A, 'happiness') + 3;
                break;
            case 'Pass':
            default:
                break;
        }
    }

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

    private static function isEliminated($data)
    {
        return self::str($data, 'family') === 'Anarchy' || self::str($data, 'family') === 'Collapsed';
    }

    private static function findTerritoryByFamily($state, $family)
    {
        foreach ($state as $key => $territory) {
            if (self::str($territory, 'family') === $family) {
                return $key;
            }
        }
        return null;
    }

    private static function availableResourcesFor($key, $state)
    {
        $data = isset($state[$key]) ? $state[$key] : array();
        $resources = self::resourceList($data, 'resources');
        foreach ($state as $other) {
            if (!self::isTerritory($other) || self::str($other, 'type') !== 'Client') {
                continue;
            }
            if (self::str($other, 'clientOf') !== self::str($data, 'family') || self::num($other, 'defiance') > 0) {
                continue;
            }
            $resources = array_merge($resources, self::resourceList($other, 'resources'));
        }
        return array_values(array_unique($resources));
    }

    private static function resourceList($data, $field)
    {
        if (!isset($data[$field])) {
            return array();
        }
        if (is_array($data[$field])) {
            return $data[$field];
        }
        return array_filter(array_map('trim', explode('/', strval($data[$field]))));
    }

    private static function clampCommon(&$data)
    {
        $fields = array('wealth', 'happiness', 'stash', 'blackBudget', 'socialCapital', 'politicalCapital', 'armies', 'education', 'development', 'debt', 'defiance');
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = max(0, intval($data[$field]));
            }
        }
        foreach (array('education', 'development') as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = min(150, $data[$field]);
            }
        }
        foreach (array('happiness') as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = min(200, $data[$field]);
            }
        }
        foreach (array('independenceSentiment', 'governanceChangeSentiment', 'factionalDivision', 'fear') as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = max(0, min(100, intval($data[$field])));
            }
        }
    }

    private static function num($data, $field)
    {
        return isset($data[$field]) ? intval($data[$field]) : 0;
    }

    private static function str($data, $field)
    {
        return isset($data[$field]) ? strval($data[$field]) : '';
    }
}
