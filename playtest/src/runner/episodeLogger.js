const fs = require('node:fs');
const path = require('node:path');
const { ensureDir, hashValue, repoRoot } = require('../util/files');

class JsonlEpisodeLogger {
  constructor(outputDir, episodeId) {
    this.outputDir = path.resolve(repoRoot, outputDir);
    this.episodeId = episodeId;
    ensureDir(this.outputDir);
    this.filePath = path.join(this.outputDir, `${episodeId}.jsonl`);
    this.stream = fs.createWriteStream(this.filePath, { flags: 'w' });
  }

  write(record) {
    this.stream.write(`${JSON.stringify({
      schemaVersion: 1,
      episodeId: this.episodeId,
      ...record
    })}\n`);
  }

  writeSetup(state, metadata) {
    this.write({
      recordType: 'setup',
      metadata,
      round: state.round,
      stateHash: hashValue(state)
    });
  }

  writeDecision(record) {
    this.write({
      recordType: 'decision',
      round: record.observation.round,
      actor: record.actor,
      agentId: record.agentId,
      observationHash: hashValue(record.observation),
      legalActionHash: hashValue(record.legalActions),
      legalActionCount: record.legalActions.length,
      decision: record.decision,
      validation: record.validation
    });
  }

  writeTransition(record) {
    this.write({
      recordType: 'transition',
      round: record.round,
      seed: record.seed,
      actions: record.actions,
      logs: record.logs,
      invariantFailures: record.invariantFailures,
      stateDelta: record.stateDelta
    });
  }

  writeSummary(record) {
    this.write({
      recordType: 'episode-summary',
      winners: record.winners,
      terminalReason: record.terminalReason,
      roundsCompleted: record.roundsCompleted,
      finalStateHash: hashValue(record.finalState),
      invariantFailures: record.invariantFailures
    });
  }

  close() {
    return new Promise(resolve => {
      this.stream.end(resolve);
    });
  }
}

module.exports = {
  JsonlEpisodeLogger
};
