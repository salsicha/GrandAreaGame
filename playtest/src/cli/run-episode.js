#!/usr/bin/env node
const path = require('node:path');
const { OllamaAgent, buildOllamaAgentFromConfig } = require('../agents/ollamaAgent');
const { JavaScriptGameAdapter } = require('../engine/jsAdapter');
const { JsonlEpisodeLogger } = require('../runner/episodeLogger');
const { runEpisode } = require('../runner/episodeRunner');
const { readJson, repoRoot } = require('../util/files');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

async function main() {
  const configPath = argValue('--config', 'playtest/configs/qwen3.6-agents.json');
  const experimentPath = argValue('--experiment', 'playtest/configs/experiments.json');
  const config = readJson(path.relative(repoRoot, path.resolve(repoRoot, configPath)));
  const experiments = readJson(path.relative(repoRoot, path.resolve(repoRoot, experimentPath)));
  const experiment = experiments.defaultExperiment;
  const adapter = new JavaScriptGameAdapter({ maxRounds: experiment.maxRounds });
  const agents = new Map();

  for (const assignment of config.seatAssignments) {
    const profile = config.agentProfiles[assignment.agentId];
    if (!profile) throw new Error(`Missing agent profile ${assignment.agentId}`);
    if (profile.type !== 'ollama') throw new Error(`Unsupported agent type ${profile.type}`);
    const agent = buildOllamaAgentFromConfig(assignment.agentId, profile, config);
    if (!(agent instanceof OllamaAgent)) throw new Error(`Failed to build Ollama agent ${assignment.agentId}`);
    agents.set(assignment.actor, agent);
  }

  const episodeId = `${experiment.experimentId}-${Date.now()}`;
  const logger = new JsonlEpisodeLogger(experiment.outputDir, episodeId);
  const result = await runEpisode(adapter, experiment, agents, logger, {
    experimentId: experiment.experimentId,
    engine: experiment.engine,
    agentConfig: configPath,
    model: process.env.GRANDAREA_OLLAMA_MODEL || config.ollama.model
  });

  console.log(JSON.stringify({
    episodeId,
    winners: result.winners,
    terminalReason: result.terminalReason,
    roundsCompleted: result.roundsCompleted,
    output: path.join(experiment.outputDir, `${episodeId}.jsonl`)
  }, null, 2));
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
