# Changelog

## Unreleased

- Fixed full-repo review findings across the engine, frontend, BGA port, playtest harness, and tests:
  - Engine: eliminated players can no longer act or collect tribute; head defiant-majority loss uses a strict majority; defiance contagion is deterministic (single snapshot wave, sorted order); collapsed defiant clients stop bleeding their overlord; tribute lapses when the overlord is gone; happiness is capped at 200 everywhere; offensive actions reject self-targets; MakeExample/Concession are overlord-only with full affordability; ClientRealignment requires a new patron; protection now deters invasion and expires with its counter; crisis cards skip eliminated targets.
  - Balance: raised win thresholds (head 360, regional 320/130, runaway 300) and rebalanced starting stats so no seat can win on round 1; compliant clients now share overlord/bloc resources, giving clients a shortage remedy and a real development path; wired the orphaned `offshore_haven` card into the deck; fixed the LatinAmerica/WesternEurope adjacency asymmetry.
  - Frontend: crisis cards are discarded after resolution instead of re-applying every round; submissions reset each round; Reset Round restores controls correctly; the side panel refreshes after resolution and card play; hand limit enforced with honest deal logs.
  - Tests: real `--lint`/`--format-check` modes, async-safe runner, and regression tests for every engine fix plus a round-1 win guard.
  - BGA port: fixed territory loading collapsing to one row, stale secret submissions replaying across rounds, missing `checkAction` phase validation, and predictable coup/uprising seeds (secret per-game salt); ported the full rules pipeline (crisis effects and discard, contagion, unanswered defiance, resource pressure, sentiment, comeback pressure, objectives, all 17 cards) with a 58-scenario JS↔PHP parity check; added `gameSetup` state, wired state transitions, player setup, `getAllDatas`/`getGameProgression`, the missing view file, and a working client log.
  - Playtest harness: Ollama transport failures now retry and fall back to the heuristic instead of killing the episode; sequential agent calls; full affordability/relationship legality for every enumerated action; crisis phase drawn per round; opponents' revealed moves reach agent context; decision logs record real validation outcomes; stalemate states terminate cleanly; `simulate-balance` now reports per-role outcomes and winners.
- Added structured territory/player role model with head, regional, client, and defiant play.
- Added asymmetric objectives, richer action resolution, expanded crisis and player card decks, negotiation hooks, and deterministic tie breakers.
- Added backend BGA resolution scaffolding with commit/reveal validation and seeded replay support.
- Added local verification coverage for JS, JSON, PHP, data fixtures, rules behavior, and map wiring.

## Release Checklist

- Run `npm test`.
- Run browser smoke test against `frontend/index.html`.
- Confirm every shipped card id has a rule handler.
- Confirm every crisis card has targeting, escalation, era, tags, and effects.
- Confirm BGA PHP lint passes for every `.php` file under `bga/`.
- Confirm no hidden hand or unrevealed payload is sent through public notifications.
- Update `RULES.md` and `TODO.md` with any rule or scope changes.
