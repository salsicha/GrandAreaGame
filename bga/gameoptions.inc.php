<?php

$game_options = array(
    100 => array(
        'name' => totranslate('Scenario'),
        'values' => array(
            1 => array('name' => totranslate('Prototype five-region setup'), 'tmdisplay' => totranslate('Prototype setup'))
        ),
        'default' => 1
    )
);

$game_preferences = array(
    100 => array(
        'name' => totranslate('Hidden information reminders'),
        'needReload' => false,
        'values' => array(
            1 => array('name' => totranslate('Enabled'), 'cssPref' => 'reminders_on'),
            2 => array('name' => totranslate('Disabled'), 'cssPref' => 'reminders_off')
        ),
        'default' => 1
    )
);
