<?php
/*
 * states.inc.php
 * Defines game states and state machine for BGA
 */

// State constants
define('ST_CRISIS', 1);
define('ST_TRIBUTE', 2);
define('ST_ACTION_SUBMISSION', 10);
define('ST_REVEAL', 20);
define('ST_RESOLUTION', 30);
define('ST_CLEANUP', 40);

$machinestates = array(
  ST_CRISIS => array( 'name' => 'crisis', 'description' => clienttranslate('Crisis phase'), 'type' => 'manager' ),
  ST_TRIBUTE => array( 'name' => 'tribute', 'description' => clienttranslate('Tribute collection'), 'type' => 'game' ),
  ST_ACTION_SUBMISSION => array( 'name' => 'actionSubmission', 'description' => clienttranslate('Players submit actions (commit)'), 'type' => 'activeplayer' ),
  ST_REVEAL => array( 'name' => 'reveal', 'description' => clienttranslate('Reveal and verify'), 'type' => 'game' ),
  ST_RESOLUTION => array( 'name' => 'resolution', 'description' => clienttranslate('Resolve actions'), 'type' => 'game' ),
  ST_CLEANUP => array( 'name' => 'cleanup', 'description' => clienttranslate('Cleanup / end of round'), 'type' => 'game' ),
);
