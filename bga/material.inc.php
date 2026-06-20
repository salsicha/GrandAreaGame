<?php

require_once 'modules/php/constants.inc.php';

$this->territoryMaterial = json_decode(file_get_contents(dirname(__DIR__) . '/frontend/data/territories.json'), true);
$this->crisisMaterial = json_decode(file_get_contents(dirname(__DIR__) . '/frontend/data/crisis.json'), true);
$this->playerCardMaterial = json_decode(file_get_contents(dirname(__DIR__) . '/frontend/data/playercards.json'), true);
$this->roundPhases = grandarea_round_phases();
$this->allowedActions = grandarea_allowed_actions();
