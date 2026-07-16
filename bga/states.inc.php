<?php
/*
 * BGA state machine for Grand Area.
 *
 * Round cycle: crisis -> tribute -> actionSubmission -> reveal ->
 * narrativeBattle -> resolution -> cleanup -> crisis. Resolution and
 * cleanup can both exit to gameEnd.
 */

if (!defined('ST_GAME_SETUP')) {
    define('ST_GAME_SETUP', 1);
    define('ST_CRISIS', 10);
    define('ST_TRIBUTE', 11);
    define('ST_ACTION_SUBMISSION', 12);
    define('ST_REVEAL', 13);
    define('ST_NARRATIVE_BATTLE', 14);
    define('ST_RESOLUTION', 15);
    define('ST_CLEANUP', 16);
    define('ST_END_GAME', 99);
}

$machinestates = array(
    ST_GAME_SETUP => array(
        'name' => 'gameSetup',
        'description' => '',
        'type' => 'manager',
        'action' => 'stGameSetup',
        'transitions' => array('' => ST_CRISIS)
    ),
    ST_CRISIS => array(
        'name' => 'crisis',
        'description' => clienttranslate('Crisis phase'),
        'type' => 'game',
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
        'action' => 'stActionSubmission',
        'possibleactions' => array('submitCommit', 'playCard', 'endTurn'),
        'transitions' => array('next' => ST_REVEAL)
    ),
    ST_REVEAL => array(
        'name' => 'reveal',
        'description' => clienttranslate('Players reveal committed actions'),
        'descriptionmyturn' => clienttranslate('Reveal your committed action'),
        'type' => 'multipleactiveplayer',
        'action' => 'stReveal',
        'possibleactions' => array('reveal', 'endTurn'),
        'transitions' => array('next' => ST_NARRATIVE_BATTLE)
    ),
    ST_NARRATIVE_BATTLE => array(
        'name' => 'narrativeBattle',
        'description' => clienttranslate('Narrative battle'),
        'type' => 'game',
        'action' => 'stNarrativeBattle',
        'transitions' => array('next' => ST_RESOLUTION)
    ),
    ST_RESOLUTION => array(
        'name' => 'resolution',
        'description' => clienttranslate('Resolve actions'),
        'type' => 'game',
        'action' => 'stResolution',
        'transitions' => array('next' => ST_CLEANUP, 'endGame' => ST_END_GAME)
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
