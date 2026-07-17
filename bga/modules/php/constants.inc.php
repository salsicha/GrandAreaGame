<?php

if (!defined('GRANDAREA_VERSION')) {
    define('GRANDAREA_VERSION', '0.1.0');
}

if (!defined('GRANDAREA_COMMIT_HASH_REGEX')) {
    define('GRANDAREA_COMMIT_HASH_REGEX', '/^[a-f0-9]{64}$/');
}

if (!defined('GRANDAREA_MAX_REVEAL_BYTES')) {
    define('GRANDAREA_MAX_REVEAL_BYTES', 4096);
}

if (!function_exists('grandarea_round_phases')) {
    function grandarea_round_phases()
    {
        return array('Crisis', 'Tribute', 'Secret Action Submission', 'Reveal', 'Narrative Battle', 'Resolution', 'Cleanup');
    }
}

if (!function_exists('grandarea_objectives')) {
    /**
     * Victory / pressure thresholds. Must stay in sync with OBJECTIVES in
     * frontend/rules.js (the reference engine).
     */
    function grandarea_objectives()
    {
        return array(
            'headWealthWin' => 400,
            'regionalWealthWin' => 320,
            'regionalPoliticalWin' => 130,
            'clientHappinessWin' => 120,
            'clientDevelopmentWin' => 70,
            'clientIndependenceWin' => 60,
            'headRunawayWealth' => 300
        );
    }
}

if (!function_exists('grandarea_recovery')) {
    /**
     * Cleanup-phase recovery tuning. Must stay in sync with RECOVERY in
     * frontend/rules.js (the reference engine).
     */
    function grandarea_recovery()
    {
        return array(
            'productionBase' => 3,
            'productionDevelopmentDivisor' => 20,
            'stashTrickle' => 2,
            'stashTrickleCeiling' => 25,
            'stashTrickleMinWealth' => 10,
            'capitalRegen' => 2,
            'capitalRegenHappinessFloor' => 60,
            'capitalRegenCap' => 150,
            'happinessRecovery' => 4,
            'happinessRecoveryCeiling' => 70
        );
    }
}

if (!function_exists('grandarea_defiance_pressure')) {
    /**
     * Unanswered-defiance penalties. Must stay in sync with
     * DEFIANCE_PRESSURE in frontend/rules.js (the reference engine).
     */
    function grandarea_defiance_pressure()
    {
        return array(
            'socialPerClient' => 3,
            'politicalPerClient' => 3,
            'socialCapPerResolution' => 9,
            'politicalCapPerResolution' => 9
        );
    }
}

if (!function_exists('grandarea_narrative')) {
    /**
     * Narrative-battle tuning. Must stay in sync with NARRATIVE in
     * frontend/rules.js (the reference engine).
     */
    function grandarea_narrative()
    {
        return array(
            'cost' => 4,
            'framingSwing' => 8,
            'smearPoliticalPenalty' => 3,
            'whitewashSocialGain' => 2
        );
    }
}

if (!defined('GRANDAREA_UPRISING_HAPPINESS_SAFE_FLOOR')) {
    define('GRANDAREA_UPRISING_HAPPINESS_SAFE_FLOOR', 50);
}

if (!defined('GRANDAREA_HEAD_DEFIANCE_MAJORITY_ROUNDS_TO_LOSE')) {
    define('GRANDAREA_HEAD_DEFIANCE_MAJORITY_ROUNDS_TO_LOSE', 2);
}

if (!function_exists('grandarea_allowed_actions')) {
    function grandarea_allowed_actions()
    {
        return array(
            'Pass',
            'Skim',
            'Propaganda',
            'Invade',
            'Sanction',
            'Protect',
            'TributeHoliday',
            'ProtectionDeal',
            'ClientRealignment',
            'RegionalRivalry',
            'DebtShakedown',
            'EconomicExploitation',
            'Coup',
            'FalseFlag',
            'CovertInfluence',
            'CounterIntel',
            'Fortify',
            'MakeExample',
            'Concession',
            'Educate',
            'Develop'
        );
    }
}
