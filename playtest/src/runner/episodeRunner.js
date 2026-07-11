const { validateSelectedAction } = require('../engine/jsAdapter');

function assertNoFatalInvariants(failures) {
  const fatal = failures.filter(failure => failure.severity === 'fatal');
  if (fatal.length > 0) {
    throw new Error(`Fatal invariant failure: ${JSON.stringify(fatal[0])}`);
  }
}

async function runEpisode(adapter, config, agents, logger, metadata = {}) {
  let state = adapter.createInitialState({ maxRounds: config.maxRounds }, config.episodeSeed);
  let transitionIndex = 0;
  const allFailures = [];

  logger.writeSetup(state, metadata);
  let failures = adapter.checkInvariants(state);
  allFailures.push(...failures);
  assertNoFatalInvariants(failures);

  while (!adapter.isTerminal(state)) {
    const actors = adapter.getPendingActors(state);
    if (actors.length === 0) throw new Error('Nonterminal state has no pending actors');

    const decisionResults = await Promise.all(actors.map(async actor => {
      const agent = agents.get(actor);
      if (!agent) throw new Error(`Missing agent for ${actor}`);
      const observation = adapter.getObservation(state, actor);
      const legalActions = adapter.listLegalActions(state, actor);
      if (legalActions.length === 0) throw new Error(`${actor} has no legal actions`);
      const decision = await agent.choose({ observation, legalActions });
      const action = validateSelectedAction(decision.actionId, legalActions);
      logger.writeDecision({
        actor,
        agentId: agent.id,
        observation,
        legalActions,
        decision,
        validation: {
          parsed: true,
          schemaValid: true,
          legal: true,
          fallbackUsed: !!decision.fallbackUsed
        }
      });
      return { actor, action };
    }));

    const decisions = new Map(decisionResults.map(result => [result.actor, result.action]));
    const transitionSeed = `${config.episodeSeed}:transition:${transitionIndex}`;
    const transition = adapter.advance(state, decisions, transitionSeed);
    failures = adapter.checkInvariants(transition.state);
    allFailures.push(...failures);
    logger.writeTransition({
      round: state.round,
      seed: transitionSeed,
      actions: decisionResults.map(result => ({ actor: result.actor, actionId: result.action.id, type: result.action.type, target: result.action.target })),
      logs: transition.logs,
      invariantFailures: failures,
      stateDelta: transition.stateDelta
    });
    assertNoFatalInvariants(failures);
    state = transition.state;
    transitionIndex += 1;
    if (transitionIndex > config.maxRounds) throw new Error(`Episode exceeded configured maxRounds ${config.maxRounds}`);
  }

  const winners = adapter.getWinners(state);
  const result = {
    winners,
    terminalReason: winners.length > 0 ? 'victory' : 'round-limit',
    roundsCompleted: transitionIndex,
    finalState: state,
    invariantFailures: allFailures
  };
  logger.writeSummary(result);
  await logger.close();
  return result;
}

module.exports = {
  assertNoFatalInvariants,
  runEpisode
};
