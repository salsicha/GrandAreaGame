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

function grandarea_round_phases()
{
    return array('Crisis', 'Tribute', 'Secret Action Submission', 'Reveal', 'Narrative Battle', 'Resolution', 'Cleanup');
}

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
