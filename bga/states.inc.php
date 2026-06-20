<?php
/*
 * BGA state machine for Grand Area.
 */

define('ST_CRISIS', 1);
define('ST_TRIBUTE', 2);
define('ST_ACTION_SUBMISSION', 10);
define('ST_REVEAL', 20);
define('ST_NARRATIVE_BATTLE', 25);
define('ST_RESOLUTION', 30);
define('ST_CLEANUP', 40);
define('ST_END_GAME', 99);

$machinestates = array(
    ST_CRISIS => array(
        'name' => 'crisis',
        'description' => clienttranslate('Crisis phase'),
        'type' => 'manager',
        'action' => 'stCrisis',
        'transitions' => array('next' => ST_TRIBUTE)
    ),
    ST_TRIBUTE => array(
        'name' => 'tribute',
        'description' => clienttranslate('Tribute collection'),
        'type' => 'game',
        'action' => 'stTribute',
        'transitions' => array('next' => ST_ACTION_SUBMISSION)
    ),
    ST_ACTION_SUBMISSION => array(
        'name' => 'actionSubmission',
        'description' => clienttranslate('Players submit secret actions'),
        'descriptionmyturn' => clienttranslate('Submit your secret action'),
        'type' => 'multipleactiveplayer',
        'possibleactions' => array('submitCommit', 'endTurn'),
        'action' => 'stActionSubmission',
        'transitions' => array('next' => ST_REVEAL)
    ),
    ST_REVEAL => array(
        'name' => 'reveal',
        'description' => clienttranslate('Players reveal committed actions'),
        'descriptionmyturn' => clienttranslate('Reveal your committed action'),
        'type' => 'multipleactiveplayer',
        'possibleactions' => array('reveal', 'endTurn'),
        'action' => 'stReveal',
        'transitions' => array('next' => ST_NARRATIVE_BATTLE)
    ),
    ST_NARRATIVE_BATTLE => array(
        'name' => 'narrativeBattle',
        'description' => clienttranslate('Narrative battle'),
        'type' => 'game',
        'transitions' => array('next' => ST_RESOLUTION)
    ),
    ST_RESOLUTION => array(
        'name' => 'resolution',
        'description' => clienttranslate('Resolve actions'),
        'type' => 'game',
        'action' => 'stResolution',
        'transitions' => array('next' => ST_CLEANUP)
    ),
    ST_CLEANUP => array(
        'name' => 'cleanup',
        'description' => clienttranslate('Cleanup and end of round'),
        'type' => 'game',
        'action' => 'stCleanup',
        'transitions' => array('next' => ST_CRISIS, 'endGame' => ST_END_GAME)
    ),
    ST_END_GAME => array(
        'name' => 'gameEnd',
        'description' => clienttranslate('End of game'),
        'type' => 'manager',
        'action' => 'stGameEnd',
        'args' => 'argGameEnd'
    )
);
