<?php
/**
 * GENERATED FILE - do not edit by hand.
 *
 * Game material embedded from frontend/data/*.json so the BGA module is
 * self-contained. Regenerate after changing any source JSON with:
 *   node tools/generate-bga-material.js
 *
 * source-checksum: b5be4fb73a494414341cf27adbd9e374b6e267e5428eb4ebb51665d829531e19
 */

require_once 'modules/php/constants.inc.php';

$this->territoryMaterial = array(
    'NorthAmerica' => array(
        'family' => 'USA',
        'type' => 'Head',
        'clientOf' => null,
        'neighbors' => array(
            'LatinAmerica',
            'WesternEurope',
            'Oceania'
        ),
        'resources' => array(
            'Oil',
            'Grain',
            'Finance',
            'Technology'
        ),
        'resourceNeeds' => array(
            'Minerals',
            'Shipping'
        ),
        'armies' => 5,
        'wealth' => 200,
        'happiness' => 92,
        'stash' => 42,
        'blackBudget' => 32,
        'socialCapital' => 82,
        'politicalCapital' => 92,
        'education' => 78,
        'development' => 76,
        'debt' => 0,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 0,
        'governanceChangeSentiment' => 22,
        'factionalDivision' => 28,
        'fear' => 12,
        'defiance' => 0
    ),
    'LatinAmerica' => array(
        'family' => 'Latin Client Coalition',
        'type' => 'Client',
        'clientOf' => 'USA',
        'neighbors' => array(
            'NorthAmerica',
            'WesternEurope',
            'NorthAfrica'
        ),
        'resources' => array(
            'Grain',
            'Minerals'
        ),
        'resourceNeeds' => array(
            'Finance',
            'Technology'
        ),
        'armies' => 1,
        'wealth' => 105,
        'happiness' => 74,
        'stash' => 14,
        'blackBudget' => 7,
        'socialCapital' => 58,
        'politicalCapital' => 48,
        'education' => 50,
        'development' => 44,
        'debt' => 12,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 48,
        'governanceChangeSentiment' => 36,
        'factionalDivision' => 50,
        'fear' => 18,
        'defiance' => 0
    ),
    'WesternEurope' => array(
        'family' => 'EU',
        'type' => 'Regional',
        'clientOf' => null,
        'neighbors' => array(
            'NorthAmerica',
            'LatinAmerica',
            'EasternEurope',
            'NorthAfrica',
            'MiddleEast'
        ),
        'resources' => array(
            'Industry',
            'Finance',
            'Technology'
        ),
        'resourceNeeds' => array(
            'Oil',
            'Grain'
        ),
        'armies' => 3,
        'wealth' => 180,
        'happiness' => 108,
        'stash' => 50,
        'blackBudget' => 24,
        'socialCapital' => 110,
        'politicalCapital' => 92,
        'education' => 86,
        'development' => 92,
        'debt' => 0,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 0,
        'governanceChangeSentiment' => 16,
        'factionalDivision' => 22,
        'fear' => 6,
        'defiance' => 0
    ),
    'EasternEurope' => array(
        'family' => 'Eastern Client Bloc',
        'type' => 'Client',
        'clientOf' => 'EU',
        'neighbors' => array(
            'WesternEurope',
            'MiddleEast',
            'EastAsia'
        ),
        'resources' => array(
            'Grain',
            'Industry'
        ),
        'resourceNeeds' => array(
            'Finance',
            'Technology'
        ),
        'armies' => 2,
        'wealth' => 125,
        'happiness' => 82,
        'stash' => 18,
        'blackBudget' => 10,
        'socialCapital' => 64,
        'politicalCapital' => 58,
        'education' => 70,
        'development' => 58,
        'debt' => 8,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 38,
        'governanceChangeSentiment' => 32,
        'factionalDivision' => 42,
        'fear' => 16,
        'defiance' => 0
    ),
    'NorthAfrica' => array(
        'family' => 'Maghreb Client Bloc',
        'type' => 'Client',
        'clientOf' => 'EU',
        'neighbors' => array(
            'LatinAmerica',
            'WesternEurope',
            'SubSaharanAfrica',
            'MiddleEast'
        ),
        'resources' => array(
            'Oil',
            'Minerals'
        ),
        'resourceNeeds' => array(
            'Grain',
            'Industry'
        ),
        'armies' => 1,
        'wealth' => 110,
        'happiness' => 68,
        'stash' => 15,
        'blackBudget' => 8,
        'socialCapital' => 58,
        'politicalCapital' => 50,
        'education' => 46,
        'development' => 42,
        'debt' => 10,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 44,
        'governanceChangeSentiment' => 38,
        'factionalDivision' => 52,
        'fear' => 20,
        'defiance' => 0
    ),
    'SubSaharanAfrica' => array(
        'family' => 'Pan-African Client Bloc',
        'type' => 'Client',
        'clientOf' => 'EU',
        'neighbors' => array(
            'NorthAfrica',
            'MiddleEast',
            'SouthAsia'
        ),
        'resources' => array(
            'Minerals',
            'Grain'
        ),
        'resourceNeeds' => array(
            'Industry',
            'Finance'
        ),
        'armies' => 1,
        'wealth' => 92,
        'happiness' => 72,
        'stash' => 12,
        'blackBudget' => 6,
        'socialCapital' => 56,
        'politicalCapital' => 46,
        'education' => 38,
        'development' => 38,
        'debt' => 14,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 50,
        'governanceChangeSentiment' => 40,
        'factionalDivision' => 56,
        'fear' => 18,
        'defiance' => 0
    ),
    'MiddleEast' => array(
        'family' => 'Gulf Council',
        'type' => 'Regional',
        'clientOf' => null,
        'neighbors' => array(
            'WesternEurope',
            'EasternEurope',
            'NorthAfrica',
            'SubSaharanAfrica',
            'SouthAsia',
            'EastAsia'
        ),
        'resources' => array(
            'Oil',
            'Shipping',
            'Finance'
        ),
        'resourceNeeds' => array(
            'Grain',
            'Technology'
        ),
        'armies' => 3,
        'wealth' => 210,
        'happiness' => 90,
        'stash' => 48,
        'blackBudget' => 30,
        'socialCapital' => 88,
        'politicalCapital' => 96,
        'education' => 68,
        'development' => 76,
        'debt' => 0,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 0,
        'governanceChangeSentiment' => 30,
        'factionalDivision' => 34,
        'fear' => 22,
        'defiance' => 0
    ),
    'SouthAsia' => array(
        'family' => 'India',
        'type' => 'Regional',
        'clientOf' => null,
        'neighbors' => array(
            'SubSaharanAfrica',
            'MiddleEast',
            'EastAsia',
            'Oceania'
        ),
        'resources' => array(
            'Grain',
            'Industry',
            'Technology'
        ),
        'resourceNeeds' => array(
            'Oil',
            'Finance'
        ),
        'armies' => 3,
        'wealth' => 190,
        'happiness' => 96,
        'stash' => 36,
        'blackBudget' => 20,
        'socialCapital' => 92,
        'politicalCapital' => 94,
        'education' => 72,
        'development' => 74,
        'debt' => 0,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 0,
        'governanceChangeSentiment' => 26,
        'factionalDivision' => 36,
        'fear' => 12,
        'defiance' => 0
    ),
    'EastAsia' => array(
        'family' => 'China',
        'type' => 'Regional',
        'clientOf' => null,
        'neighbors' => array(
            'EasternEurope',
            'MiddleEast',
            'SouthAsia',
            'Oceania'
        ),
        'resources' => array(
            'Industry',
            'Technology',
            'Shipping'
        ),
        'resourceNeeds' => array(
            'Oil',
            'Minerals'
        ),
        'armies' => 4,
        'wealth' => 220,
        'happiness' => 98,
        'stash' => 45,
        'blackBudget' => 28,
        'socialCapital' => 95,
        'politicalCapital' => 104,
        'education' => 82,
        'development' => 88,
        'debt' => 0,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 0,
        'governanceChangeSentiment' => 26,
        'factionalDivision' => 32,
        'fear' => 16,
        'defiance' => 0
    ),
    'Oceania' => array(
        'family' => 'Pacific Client Bloc',
        'type' => 'Client',
        'clientOf' => 'USA',
        'neighbors' => array(
            'NorthAmerica',
            'SouthAsia',
            'EastAsia'
        ),
        'resources' => array(
            'Minerals',
            'Shipping'
        ),
        'resourceNeeds' => array(
            'Oil',
            'Finance'
        ),
        'armies' => 1,
        'wealth' => 110,
        'happiness' => 84,
        'stash' => 16,
        'blackBudget' => 6,
        'socialCapital' => 70,
        'politicalCapital' => 60,
        'education' => 48,
        'development' => 52,
        'debt' => 8,
        'tributeHoliday' => 0,
        'protectionDeal' => 0,
        'realignmentPressure' => 0,
        'rivalryPressure' => 0,
        'independenceSentiment' => 36,
        'governanceChangeSentiment' => 30,
        'factionalDivision' => 40,
        'fear' => 10,
        'defiance' => 0
    )
);

$this->crisisMaterial = array(
    array(
        'id' => 'guatemala1954',
        'title' => 'Guatemala 1954',
        'description' => 'A client land reform crisis raises defiance and tests whether the hierarchy responds with pressure or accommodation.',
        'type' => 'defiance_event',
        'targeting' => array(
            'scope' => 'territory',
            'territory' => 'LatinAmerica'
        ),
        'target' => 'LatinAmerica',
        'escalation' => 2,
        'era' => 'Cold War',
        'tags' => array(
            'land_reform',
            'client',
            'covert'
        ),
        'effect' => array(
            'defiance_increase' => 2,
            'governanceChangeSentiment_delta' => 4
        )
    ),
    array(
        'id' => 'global_austerity',
        'title' => 'Global Austerity',
        'description' => 'Worldwide austerity lowers happiness, with harsher pressure where grain or finance access is missing.',
        'type' => 'global_economic',
        'targeting' => array(
            'scope' => 'all'
        ),
        'escalation' => 1,
        'era' => 'Neoliberal',
        'tags' => array(
            'finance',
            'austerity',
            'global'
        ),
        'effect' => array(
            'happiness_delta' => -10,
            'vulnerableResourceNeeds' => array(
                'Grain',
                'Finance'
            ),
            'vulnerability_happiness_delta' => -5
        )
    ),
    array(
        'id' => 'oil_embargo',
        'title' => 'Oil Embargo',
        'description' => 'Territories that need oil lose wealth and development as upkeep and logistics spike.',
        'type' => 'resource_shock',
        'targeting' => array(
            'scope' => 'resourceNeed',
            'resource' => 'Oil'
        ),
        'escalation' => 2,
        'era' => 'Energy Crisis',
        'tags' => array(
            'oil',
            'logistics',
            'resource'
        ),
        'effect' => array(
            'wealth_delta' => -12,
            'development_delta' => -4,
            'happiness_delta' => -4
        )
    ),
    array(
        'id' => 'grain_price_spike',
        'title' => 'Grain Price Spike',
        'description' => 'Food import pressure turns economic weakness into street-level unrest.',
        'type' => 'resource_shock',
        'targeting' => array(
            'scope' => 'resourceNeed',
            'resource' => 'Grain'
        ),
        'escalation' => 2,
        'era' => 'Contemporary',
        'tags' => array(
            'grain',
            'unrest',
            'resource'
        ),
        'effect' => array(
            'happiness_delta' => -8,
            'governanceChangeSentiment_delta' => 6
        )
    ),
    array(
        'id' => 'debt_crisis',
        'title' => 'Debt Crisis',
        'description' => 'The most indebted territory absorbs a legitimacy shock and loses development momentum.',
        'type' => 'financial_crisis',
        'targeting' => array(
            'scope' => 'highestDebt'
        ),
        'escalation' => 3,
        'era' => 'Neoliberal',
        'tags' => array(
            'debt',
            'finance',
            'legitimacy'
        ),
        'effect' => array(
            'debt_delta' => 10,
            'happiness_delta' => -10,
            'development_delta' => -6,
            'governanceChangeSentiment_delta' => 8
        )
    ),
    array(
        'id' => 'shipping_chokepoint',
        'title' => 'Shipping Chokepoint',
        'description' => 'Shipping control becomes a crisis for economies that lack resilient logistics.',
        'type' => 'resource_shock',
        'targeting' => array(
            'scope' => 'resourceNeed',
            'resource' => 'Shipping'
        ),
        'escalation' => 2,
        'era' => 'Contemporary',
        'tags' => array(
            'shipping',
            'trade',
            'resource'
        ),
        'effect' => array(
            'wealth_delta' => -10,
            'development_delta' => -5
        )
    ),
    array(
        'id' => 'leaked_accounts',
        'title' => 'Leaked Accounts',
        'description' => 'Hidden family wealth becomes public and feeds governance-change sentiment.',
        'type' => 'legitimacy_scandal',
        'targeting' => array(
            'scope' => 'highestFactionalDivision'
        ),
        'escalation' => 1,
        'era' => 'Contemporary',
        'tags' => array(
            'corruption',
            'media',
            'legitimacy'
        ),
        'effect' => array(
            'socialCapital_delta' => -10,
            'governanceChangeSentiment_delta' => 10,
            'factionalDivision_delta' => 5
        )
    ),
    array(
        'id' => 'student_uprising',
        'title' => 'Student Uprising',
        'description' => 'Educated publics organize quickly when happiness is low and the state looks brittle.',
        'type' => 'governance_crisis',
        'targeting' => array(
            'scope' => 'all'
        ),
        'escalation' => 2,
        'era' => 'Contemporary',
        'tags' => array(
            'education',
            'governance',
            'street_pressure'
        ),
        'effect' => array(
            'governanceChangeSentiment_delta' => 4,
            'factionalDivision_delta' => 3
        )
    ),
    array(
        'id' => 'client_realignment',
        'title' => 'Client Realignment',
        'description' => 'Defiant clients test whether a rival patron can make independence credible.',
        'type' => 'alignment_crisis',
        'targeting' => array(
            'scope' => 'defiantClients'
        ),
        'escalation' => 3,
        'era' => 'Multipolar',
        'tags' => array(
            'client',
            'realignment',
            'defiance'
        ),
        'effect' => array(
            'independenceSentiment_delta' => 8,
            'politicalCapital_delta' => 4
        )
    ),
    array(
        'id' => 'tech_sanctions',
        'title' => 'Technology Sanctions',
        'description' => 'Technology access becomes a weapon against development and domestic legitimacy.',
        'type' => 'resource_shock',
        'targeting' => array(
            'scope' => 'resourceNeed',
            'resource' => 'Technology'
        ),
        'escalation' => 2,
        'era' => 'Contemporary',
        'tags' => array(
            'technology',
            'sanctions',
            'development'
        ),
        'effect' => array(
            'development_delta' => -8,
            'education_delta' => -3,
            'happiness_delta' => -4
        )
    )
);

$this->playerCardMaterial = array(
    array(
        'id' => 'promoting_democracy',
        'title' => 'Promoting Democracy',
        'category' => 'spin',
        'desc' => 'Gain +20 Social Capital.',
        'target' => 'Self'
    ),
    array(
        'id' => 'media_blitz',
        'title' => 'Media Blitz',
        'category' => 'spin',
        'desc' => 'Gain Social Capital and a small Political Capital lift.',
        'target' => 'Self'
    ),
    array(
        'id' => 'humanitarian_airlift',
        'title' => 'Humanitarian Airlift',
        'category' => 'spin',
        'desc' => 'Raise target happiness and gain narrative cover.',
        'target' => 'Other'
    ),
    array(
        'id' => 'patriotic_rally',
        'title' => 'Patriotic Rally',
        'category' => 'spin',
        'desc' => 'Convert domestic pressure into Political Capital at a small happiness cost.',
        'target' => 'Self'
    ),
    array(
        'id' => 'structural_adjustment',
        'title' => 'Structural Adjustment',
        'category' => 'leverage',
        'desc' => 'Drain 10 Education from target into actor wealth.',
        'target' => 'Other'
    ),
    array(
        'id' => 'debt_trap',
        'title' => 'Debt Trap',
        'category' => 'leverage',
        'desc' => 'Raise target debt, lower happiness, and gain wealth.',
        'target' => 'Other'
    ),
    array(
        'id' => 'protection_pact',
        'title' => 'Protection Pact',
        'category' => 'leverage',
        'desc' => 'Protect target and gain Political Capital at stash cost.',
        'target' => 'Other'
    ),
    array(
        'id' => 'resource_contract',
        'title' => 'Resource Contract',
        'category' => 'leverage',
        'desc' => 'Extract target wealth and development through an unequal contract.',
        'target' => 'Other'
    ),
    array(
        'id' => 'offshore_haven',
        'title' => 'Offshore Haven',
        'category' => 'leverage',
        'desc' => 'Move 20 in hidden funds into the family stash.',
        'target' => 'Self'
    ),
    array(
        'id' => 'false_flag',
        'title' => 'The False Flag',
        'category' => 'intelligence',
        'desc' => 'Pay Black Budget to gain Social Capital.',
        'target' => 'Self'
    ),
    array(
        'id' => 'covert_files',
        'title' => 'Covert Files',
        'category' => 'intelligence',
        'desc' => 'Expose target files to raise governance pressure and factional division.',
        'target' => 'Other'
    ),
    array(
        'id' => 'kompromat',
        'title' => 'Kompromat',
        'category' => 'intelligence',
        'desc' => 'Damage target Political Capital and gain leverage.',
        'target' => 'Other'
    ),
    array(
        'id' => 'counterintelligence',
        'title' => 'Counterintelligence',
        'category' => 'intelligence',
        'desc' => 'Restore Black Budget and reduce factional division.',
        'target' => 'Self'
    ),
    array(
        'id' => 'rotten_apple',
        'title' => 'The Rotten Apple',
        'category' => 'retaliation',
        'desc' => 'Target loses 50% Happiness.',
        'target' => 'Other'
    ),
    array(
        'id' => 'sanctions_package',
        'title' => 'Sanctions Package',
        'category' => 'retaliation',
        'desc' => 'Damage target wealth and happiness at Social Capital cost.',
        'target' => 'Other'
    ),
    array(
        'id' => 'proxy_network',
        'title' => 'Proxy Network',
        'category' => 'retaliation',
        'desc' => 'Spend Black Budget to raise target defiance and factional division.',
        'target' => 'Other'
    ),
    array(
        'id' => 'retaliation_strike',
        'title' => 'Retaliation Strike',
        'category' => 'retaliation',
        'desc' => 'Spend Black Budget for direct target wealth damage and fear.',
        'target' => 'Other'
    )
);

$this->setupMaterial = array(
    '2' => array(
        'players' => 2,
        'families' => array(
            'USA',
            'China'
        ),
        'territories' => array(
            'USA' => array(
                'NorthAmerica',
                'LatinAmerica',
                'Oceania'
            ),
            'China' => array(
                'EastAsia',
                'SouthAsia',
                'MiddleEast'
            ),
            'Neutral' => array(
                'WesternEurope',
                'EasternEurope',
                'NorthAfrica',
                'SubSaharanAfrica'
            )
        )
    ),
    '3' => array(
        'players' => 3,
        'families' => array(
            'USA',
            'EU',
            'China'
        ),
        'territories' => array(
            'USA' => array(
                'NorthAmerica',
                'LatinAmerica',
                'Oceania'
            ),
            'EU' => array(
                'WesternEurope',
                'EasternEurope',
                'NorthAfrica',
                'SubSaharanAfrica'
            ),
            'China' => array(
                'EastAsia',
                'SouthAsia',
                'MiddleEast'
            )
        )
    ),
    '4' => array(
        'players' => 4,
        'families' => array(
            'USA',
            'EU',
            'China',
            'India'
        ),
        'territories' => array(
            'USA' => array(
                'NorthAmerica',
                'LatinAmerica',
                'Oceania'
            ),
            'EU' => array(
                'WesternEurope',
                'EasternEurope',
                'NorthAfrica',
                'SubSaharanAfrica'
            ),
            'China' => array(
                'EastAsia'
            ),
            'India' => array(
                'SouthAsia',
                'MiddleEast'
            )
        )
    ),
    '5' => array(
        'players' => 5,
        'families' => array(
            'USA',
            'EU',
            'China',
            'India',
            'Gulf Council'
        ),
        'territories' => array(
            'USA' => array(
                'NorthAmerica',
                'LatinAmerica',
                'Oceania'
            ),
            'EU' => array(
                'WesternEurope',
                'EasternEurope',
                'NorthAfrica',
                'SubSaharanAfrica'
            ),
            'China' => array(
                'EastAsia'
            ),
            'India' => array(
                'SouthAsia'
            ),
            'Gulf Council' => array(
                'MiddleEast'
            )
        )
    )
);

$this->balanceMaterial = array(
    'numericRanges' => array(
        'wealth' => array(
            'min' => 0,
            'max' => 600,
            'starting' => array(
                80,
                220
            )
        ),
        'happiness' => array(
            'min' => 0,
            'max' => 200,
            'starting' => array(
                68,
                110
            )
        ),
        'stash' => array(
            'min' => 0,
            'max' => 80,
            'starting' => array(
                12,
                50
            )
        ),
        'blackBudget' => array(
            'min' => 0,
            'max' => 50,
            'starting' => array(
                6,
                32
            )
        ),
        'socialCapital' => array(
            'min' => 0,
            'max' => 150,
            'starting' => array(
                56,
                110
            )
        ),
        'politicalCapital' => array(
            'min' => 0,
            'max' => 150,
            'starting' => array(
                46,
                104
            )
        ),
        'education' => array(
            'min' => 0,
            'max' => 150,
            'starting' => array(
                38,
                86
            )
        ),
        'development' => array(
            'min' => 0,
            'max' => 150,
            'starting' => array(
                38,
                92
            )
        ),
        'debt' => array(
            'min' => 0,
            'max' => 100,
            'starting' => array(
                0,
                14
            )
        ),
        'armies' => array(
            'min' => 0,
            'max' => 8,
            'starting' => array(
                1,
                5
            )
        )
    ),
    'actionEconomy' => array(
        'actionsPerPlayerPerRound' => 1,
        'cardsDealtPerPlayerPerRound' => 1,
        'maxCardsInHand' => 5,
        'framingSpendPerAction' => array(
            'min' => 0,
            'max' => 50
        ),
        'capitalChangeBands' => array(
            'minor' => array(
                1,
                5
            ),
            'major' => array(
                6,
                15
            ),
            'crisis' => array(
                16,
                30
            )
        )
    ),
    'comebackPressure' => array(
        'headWealthThreshold' => 300,
        'clientDefianceGain' => 1,
        'emboldenedClients' => 'unhappiestOnly',
        'regionalPoliticalGain' => 4,
        'headSocialCapitalPenalty' => 6
    ),
    'cleanupRecovery' => array(
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
    ),
    'defiancePressure' => array(
        'socialPerClient' => 3,
        'politicalPerClient' => 3,
        'socialCapPerResolution' => 9,
        'politicalCapPerResolution' => 9
    ),
    'uprising' => array(
        'happinessSafeFloor' => 50,
        'chance' => 0.5
    ),
    'headDefianceMajority' => array(
        'scope' => 'ownClients',
        'minimumDefiantClients' => 2,
        'cleanupsToLose' => 2
    ),
    'clientVictoryPath' => array(
        'requiresDefiance' => true,
        'minimumHappiness' => 120,
        'minimumDevelopment' => 70,
        'minimumIndependenceSentiment' => 60
    )
);

$this->roundPhases = grandarea_round_phases();
$this->allowedActions = grandarea_allowed_actions();
