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
            'headWealthWin' => 360,
            'regionalWealthWin' => 320,
            'regionalPoliticalWin' => 130,
            'clientHappinessWin' => 120,
            'clientDevelopmentWin' => 70,
            'clientIndependenceWin' => 60,
            'headRunawayWealth' => 300
        );
    }
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
            'MakeExample',
            'Concession',
            'Educate',
            'Develop'
        );
    }
}
