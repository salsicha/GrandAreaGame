<?php
/**
 * grandareagame.game.php
 * Minimal BGA server-side game class scaffold for Grand Area
 * Expand these methods with game logic, DB access, and state machine hooks.
 */

require_once 'modules/php/constants.inc.php';
require_once 'states.inc.php';

class GrandAreaGame extends Table{
    function __construct(){
        // constructor called by BGA framework
        parent::__construct();
        // load game data, init if new game
    }

    // --- Game setup
    function setupNewGame($players, $options = []){
        // Initialize territories, player boards, crisis deck, etc.
        // Use self::DbQuery(...) to run SQL
    }

    // --- State machine callbacks
    // Example: called when entering Crisis state
    function stCrisis(){
        // draw crisis card, notify players
    }

    function stActionSubmission(){
        // allow commit submissions
    }

    function stResolution(){
        // verify reveals, build canonical action list, call rules engine
        // apply resulting state updates and notify players
    }

    // --- AJAX / action helpers can call methods on this class
}
