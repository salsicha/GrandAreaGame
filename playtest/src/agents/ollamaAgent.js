const http = require('node:http');
const https = require('node:https');
const { chooseHeuristicAction } = require('./heuristicAgent');
const { readJson, readText } = require('../util/files');

function validateDecisionShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('decision must be an object');
  if (typeof value.action_id !== 'string' || value.action_id.length === 0) throw new Error('action_id must be a nonempty string');
  if (typeof value.reason !== 'string' || value.reason.length > 240) throw new Error('reason must be a string of at most 240 chars');
  if (!Array.isArray(value.plan_tags) || value.plan_tags.length > 6 || value.plan_tags.some(tag => typeof tag !== 'string' || tag.length > 40)) {
    throw new Error('plan_tags must be an array of up to six short strings');
  }
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) throw new Error('confidence must be 0..1');
  if (!(value.rule_question === null || (typeof value.rule_question === 'string' && value.rule_question.length <= 300))) {
    throw new Error('rule_question must be null or a short string');
  }
  return value;
}

function postJson(urlString, payload, timeoutMs) {
  const url = new URL(urlString);
  const body = JSON.stringify(payload);
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Ollama returned HTTP ${res.statusCode}: ${text}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`Ollama returned invalid JSON: ${error.message}`));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Ollama request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderTurnPrompt(input, profilePrompt, rolePrompt, correction) {
  return [
    'PLAYER_PROFILE',
    profilePrompt,
    '',
    'ROLE_GUIDANCE',
    rolePrompt,
    '',
    'OBSERVATION',
    JSON.stringify(input.observation, null, 2),
    '',
    'RECENT_EVENTS',
    JSON.stringify(input.observation.recentEvents || [], null, 2),
    '',
    'STRATEGIC_FEATURES',
    JSON.stringify(input.observation.strategicFeatures || {}, null, 2),
    '',
    'LEGAL_ACTIONS',
    JSON.stringify(input.legalActions, null, 2),
    '',
    correction || '',
    '',
    'Select one exact action_id and return only the required JSON object.'
  ].join('\n');
}

class OllamaAgent {
  constructor(options) {
    this.id = options.id;
    this.model = process.env.GRANDAREA_OLLAMA_MODEL || options.model;
    this.host = process.env.OLLAMA_HOST || options.host || 'http://127.0.0.1:11434';
    this.temperature = options.temperature == null ? 0.1 : options.temperature;
    this.timeoutMs = options.timeoutMs || 120000;
    this.maxRetries = options.maxRetries == null ? 1 : options.maxRetries;
    this.retryBackoffMs = options.retryBackoffMs == null ? 500 : options.retryBackoffMs;
    this.keepAlive = options.keepAlive || '30m';
    this.systemPrompt = options.systemPrompt;
    this.rolePrompt = options.rolePrompt;
    this.profilePrompt = options.profilePrompt;
    this.decisionSchema = options.decisionSchema || readJson('playtest', 'schemas', 'decision.schema.json');
  }

  async choose(input) {
    let correction = '';
    let failureReason = null;
    let parsed = false;
    let schemaValid = false;
    let legal = false;
    let attempts = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      attempts = attempt + 1;
      if (attempt > 0 && this.retryBackoffMs > 0) await delay(this.retryBackoffMs * attempt);

      let response;
      try {
        response = await postJson(`${this.host.replace(/\/$/, '')}/api/chat`, {
          model: this.model,
          stream: false,
          keep_alive: this.keepAlive,
          format: this.decisionSchema,
          options: {
            temperature: this.temperature
          },
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: renderTurnPrompt(input, this.profilePrompt, this.rolePrompt, correction) }
          ]
        }, this.timeoutMs);
      } catch (error) {
        // Transport failures (connection refused, timeout, HTTP 5xx) are
        // retried with backoff and never abort the episode.
        parsed = false;
        schemaValid = false;
        legal = false;
        failureReason = `transport: ${error.message}`;
        continue;
      }

      parsed = false;
      schemaValid = false;
      legal = false;
      const rawContent = response.message && response.message.content;
      let candidate;
      try {
        candidate = JSON.parse(rawContent);
        parsed = true;
        validateDecisionShape(candidate);
        schemaValid = true;
      } catch (error) {
        failureReason = `${parsed ? 'schema' : 'parse'}: ${error.message}`;
        correction = `Previous response failed JSON/schema validation: ${error.message}. Return only valid JSON.`;
        continue;
      }
      if (!input.legalActions.some(action => action.id === candidate.action_id)) {
        failureReason = `illegal-action: ${candidate.action_id}`;
        correction = `Previous action_id "${candidate.action_id}" was not listed in LEGAL_ACTIONS. Return one exact listed ID.`;
        continue;
      }
      legal = true;
      return {
        actionId: candidate.action_id,
        confidence: candidate.confidence,
        reason: candidate.reason,
        tags: candidate.plan_tags,
        ruleQuestion: candidate.rule_question,
        rawResponse: rawContent,
        fallbackUsed: false,
        validation: {
          parsed: true,
          schemaValid: true,
          legal: true,
          fallbackUsed: false,
          reason: null,
          attempts
        }
      };
    }

    const fallback = chooseHeuristicAction(input.legalActions, input.observation);
    return {
      actionId: fallback.id,
      confidence: 0,
      reason: 'Heuristic fallback after model failure.',
      tags: ['model-fallback'],
      ruleQuestion: null,
      fallbackUsed: true,
      validation: {
        parsed,
        schemaValid,
        legal,
        fallbackUsed: true,
        reason: failureReason,
        attempts
      }
    };
  }
}

function buildOllamaAgentFromConfig(agentId, profile, config) {
  const prompts = config.promptFiles;
  const roleKey = profile.role.toLowerCase();
  return new OllamaAgent({
    id: agentId,
    model: profile.model || config.ollama.model,
    host: config.ollama.host,
    temperature: config.ollama.temperature,
    timeoutMs: config.ollama.timeoutMs,
    maxRetries: config.ollama.maxRetries,
    retryBackoffMs: config.ollama.retryBackoffMs,
    keepAlive: config.ollama.keepAlive,
    systemPrompt: readText(prompts.base),
    rolePrompt: readText(prompts[roleKey]),
    profilePrompt: readText(prompts[profile.profile])
  });
}

module.exports = {
  OllamaAgent,
  buildOllamaAgentFromConfig,
  renderTurnPrompt,
  validateDecisionShape
};
