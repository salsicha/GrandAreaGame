GrandAreaGame
=============

Turn based strategy game based on Chomsky political theory

Rules reference: [RULES.md](RULES.md)


cd frontend
python3 -m http.server 8000


Open http://localhost:8000
Use "Pulse Low Happiness" to animate territories with happiness < 80, or "Pulse Invaded" after resolving an invasion through the turn manager.


Click "Shuffle Deck", "Draw Card" to draw a crisis; the card description appears and the engine will use state.crisis during resolution.
Use "Discard Current" to discard the active card.

Development checks
------------------

Install PHP for BGA syntax checks:

```bash
brew install php
```

Run the test suite:

```bash
npm test
```

Other verification entrypoints:

```bash
npm run verify
npm run lint
npm run format:check
```

Automated Qwen/Ollama playtesting
---------------------------------

The playtest harness in `playtest/` is configured for Qwen3.6 agents running through local Ollama. The readiness command validates configs, prompts, legal-action enumeration, observations, and the JavaScript engine adapter without running agents:

```bash
npm run playtest:ready
```

When Ollama is running and `qwen3.6` is available locally, start one agent-driven episode:

```bash
npm run playtest:qwen
```

Production notes
----------------

- The browser prototype is useful for playtesting, but production BGA resolution belongs to `bga/modules/php/GrandAreaRules.php`.
- Secret action commit/reveal, seeded replay, and persisted map state are scaffolded in `bga/grandareagame.game.php`.
- See `bga/README_BGA.md` for hidden-information handling and material migration notes.
