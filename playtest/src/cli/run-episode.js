#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { OllamaAgent, buildOllamaAgentFromConfig } = require('../agents/ollamaAgent');
const { JavaScriptGameAdapter } = require('../engine/jsAdapter');
const { JsonlEpisodeLogger } = require('../runner/episodeLogger');
const { runEpisode } = require('../runner/episodeRunner');
const { fromRepo } = require('../util/files');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

// Relative --config/--experiment paths resolve against the caller's working
// directory, so both `npm run playtest:qwen` (repo root) and `npm run qwen`
// (playtest/) work. Defaults are absolute repo paths.
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

async function main() {
  const configPath = argValue('--config', fromRepo('playtest', 'configs', 'qwen3.6-agents.json'));
  const experimentPath = argValue('--experiment', fromRepo('playtest', 'configs', 'experiments.json'));
  const config = loadJson(configPath);
  const experiments = loadJson(experimentPath);
  const experiment = experiments.defaultExperiment;
  if (!experiment) throw new Error(`Experiment config ${experimentPath} is missing defaultExperiment`);
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
  let result;
  try {
    result = await runEpisode(adapter, experiment, agents, logger, {
      experimentId: experiment.experimentId,
      engine: experiment.engine,
      agentConfig: configPath,
      model: process.env.GRANDAREA_OLLAMA_MODEL || config.ollama.model
    });
  } catch (error) {
    // Flush and close the JSONL stream before exiting so partial episodes
    // are not truncated mid-line.
    await logger.close();
    throw error;
  }

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
