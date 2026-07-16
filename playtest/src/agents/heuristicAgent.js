class HeuristicAgent {
  constructor(id = 'heuristic-fallback') {
    this.id = id;
  }

  async choose(input) {
    const action = chooseHeuristicAction(input.legalActions, input.observation);
    return {
      actionId: action.id,
      confidence: 0.5,
      reason: 'Deterministic heuristic fallback selected a legal action.',
      tags: ['heuristic']
    };
  }
}

function chooseHeuristicAction(legalActions, observation) {
  if (!legalActions.length) throw new Error('No legal actions supplied');
  const role = observation.role;
  const scored = legalActions.map(action => ({ action, score: scoreAction(action, role, observation.strategicFeatures) }));
  scored.sort((a, b) => b.score - a.score || a.action.id.localeCompare(b.action.id));
  return scored[0].action;
}

function scoreAction(action, role, features) {
  let score = action.type === 'Pass' ? 0 : 1;
  if (role === 'Head') {
    if (['Concession', 'MakeExample', 'TributeHoliday'].includes(action.type)) score += features.defiantClients > 0 ? 5 : 1;
    if (['Skim', 'DebtShakedown', 'EconomicExploitation'].includes(action.type)) score += features.wealthToVictory <= 80 ? 3 : 1;
  } else if (role === 'Regional') {
    if (['Develop', 'RegionalRivalry', 'ProtectionDeal', 'ClientRealignment'].includes(action.type)) score += 4;
    if (action.type === 'Skim' && features.wealthToVictory <= 60) score += 2;
  } else {
    // Client independence path: build development/education/happiness while
    // compliant, flip to deliberate defiance via self-CovertInfluence once the
    // happiness and development thresholds are close, then stay alive.
    const nearThresholds = features.happinessToVictory <= 15 && features.developmentToVictory <= 15;
    if (!features.defiant && nearThresholds && action.type === 'CovertInfluence' && action.target === 'Self') {
      score += 8;
    }
    if (features.defiant) {
      if (action.type === 'Propaganda' && action.target === 'Self') score += features.happinessToVictory > 0 ? 6 : 2;
      if (action.type === 'Develop') score += features.developmentToVictory > 0 ? 5 : 1;
      if (action.type === 'Educate') score += features.independenceToVictory > 0 ? 4 : 1;
    } else {
      if (action.type === 'Develop') score += features.developmentToVictory > 0 ? 5 : 1;
      if (action.type === 'Educate') score += features.independenceToVictory > 0 ? 4 : 1;
      if (action.type === 'Propaganda') score += features.happinessToVictory > 0 ? 3 : 1;
    }
  }
  if (action.tags.includes('covert')) score += 0.5;
  if (action.parameters && action.parameters.framing > 0) score -= 0.1 * action.parameters.framing;
  return score;
}

module.exports = {
  HeuristicAgent,
  chooseHeuristicAction
};
