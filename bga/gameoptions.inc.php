<?php

$game_options = array(
    100 => array(
        'name' => totranslate('Scenario'),
        'values' => array(
            1 => array('name' => totranslate('Prototype five-region setup'), 'tmdisplay' => totranslate('Prototype setup'))
        ),
        'default' => 1
    ),
    101 => array(
        'name' => totranslate('Game length'),
        'values' => array(
            1 => array('name' => totranslate('Standard (20 rounds)'), 'tmdisplay' => totranslate('Standard')),
            2 => array('name' => totranslate('Short (12 rounds)'), 'tmdisplay' => totranslate('Short')),
            3 => array('name' => totranslate('Long (30 rounds)'), 'tmdisplay' => totranslate('Long'))
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
