# Grand Area Qwen/Ollama Playtesting

This folder contains a push-button automated playtest harness based on `INSTRUCTIONS.md`.

The first implementation uses the existing deterministic JavaScript rules engine in `frontend/rules.js`, enumerates legal action IDs, gives each player agent only an observation plus legal choices, validates every selected ID, resolves the round through the authoritative engine adapter, checks invariants, and writes replayable JSON Lines episode logs.

## One-time local setup

Install and start Ollama, then pull the Qwen3.6 model tag you want to use:

```bash
ollama serve
ollama pull qwen3.6
```

If your local Ollama tag is different, keep the committed config intact and override at runtime:

```bash
GRANDAREA_OLLAMA_MODEL=qwen3.6:latest npm run playtest:qwen
```

## Readiness check

This validates configs, prompts, schemas, the JavaScript engine adapter, seat assignments, legal-action enumeration, and observation leak checks. It does not call the model or run player agents.

```bash
npm run playtest:ready
```

## Run one Qwen episode

This is the button to press when you are ready to actually run agents:

```bash
npm run playtest:qwen
```

Episode traces are written under `playtest/runs/episodes/` and are ignored by Git.

## Files

- `configs/qwen3.6-agents.json`: Qwen3.6 Ollama agent profiles, prompt paths, and seat assignments.
- `configs/experiments.json`: default experiment seed, max rounds, engine, and output path.
- `schemas/decision.schema.json`: structured JSON response schema sent to Ollama.
- `prompts/`: shared player prompt, role prompts, and profile prompts.
- `src/engine/jsAdapter.js`: deterministic adapter around `frontend/rules.js`.
- `src/agents/ollamaAgent.js`: local Ollama HTTP client and structured-output validation.
- `src/runner/`: episode loop and JSONL logger.
- `src/checks/readiness.js`: non-agent preflight checks.
