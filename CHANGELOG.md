# Changelog

## Unreleased

- Narrative Battle is now a real phase — the fourth depth lever. After the reveal, each family may make one narrative play for 4 Social Capital: Smear a rival (−3 Political Capital now, −8 effective framing on their revealed action: uglier backlash, dirtier war) or Whitewash anyone including yourself (+2 Social Capital, +8 effective framing: sanitized coverage). Plays stack, are public, and effective framing clamps to 0–50. On BGA it runs as a proper multiactive phase between reveal and resolution (smear/whitewash the selected territory, or pass); the browser prototype collects spins alongside submissions. Implemented in both engines (16-scenario cross-engine parity), the frontend turn manager, and the BGA state machine, server, and client; documented in RULES.md ("Narrative Battle").
- Depth pass — counterplay and planning for the secret-action phase:
  - New defensive stances: `CounterIntel` (4 Black Budget; foils coups and covert influence against you for the round, exposing the attacker for 8 Social Capital and granting +5 Political Capital per foiled op) and `Fortify` (6 wealth; invasions are blunted — damage halved, no defiance bump, no invader rally). Stances register before any attack resolves regardless of turn order, are one-round only, and are wasted if nobody attacks — bluffing is the point.
  - Failed coups now rally the target around the flag (+5 Political Capital, +4 fear), making coups a real gamble.
  - The next crisis card is public knowledge in every surface (frontend deck panel, playtest observations, BGA panel and notifications), turning crises into strategic weather players position around.
  - Implemented across the JS engine, PHP port (14-scenario cross-engine parity verified), frontend turn manager, playtest adapter, and BGA client; documented in RULES.md ("Defensive Stances").
- Gameplay balance overhaul — games are now decided by play, not entropy (validated across a 10-seed × 25-round deterministic sweep: seats alive at end 0.2→9.5 of 10, winners in half the games across all three roles, deaths per 10 games 100→5):
  - New cleanup recovery step: development-scaled wealth production, a capped stash trickle, slow Social/Political Capital regeneration while happiness holds, and low-end happiness recovery.
  - Head defiant-majority loss now counts only the Head's own clients, needs at least 2 defiant, and must stand for 2 consecutive cleanups; the Head win (wealth 400) likewise only requires the Head's own clients to be compliant.
  - Unanswered-defiance bleed softened and capped (3+3 per defiant client, max 9+9 per resolution); uprisings only trigger below 50 happiness; objective winners are immune to same-turn collapse; comeback pressure emboldens only the unhappiest client; resource-shortage development loss halved; DebtShakedown happiness hit reduced.
  - Smarter simulator policies (defend happiness, answer defiance, role-appropriate win pursuit) plus per-seat death-cause reporting.
- Board Game Arena publication readiness:
  - Restructured `bga/` into the exact BGA Studio project layout (`dbmodel.sql`, root-level `grandareagame.js`/`.css`/`grandareagame_grandareagame.tpl`, `img/` placeholders) and removed the nonstandard translation file.
  - The module is fully self-contained: game material is embedded into `material.inc.php` by a new generator (`tools/generate-bga-material.js`) with a checksum test guarding drift; the board template embeds the world map via `tools/generate-bga-board.js`; no runtime reads outside the game folder.
  - Real Dojo client: world-map board with overlays and click-to-select, territory inspector, action builder, SHA-256 commit/reveal flow with per-round browser storage, hand rendering with card play, and a game log.
  - Framework conformance: `zombieTurn`, `upgradeTableDb`, round-limit "Game length" option (12/20/30) guaranteeing termination, progression tied to the limit, eliminated players auto-skipped in multiactive phases, wealth-based final scoring with objective winners on top.
  - New docs: `bga/PUBLISHING.md` (step-by-step path to publication) and a refreshed `bga/README_BGA.md`.
  - Post-review hardening: SVG map overlays use `classList` (Dojo's class API silently no-ops on SVG); eliminated players can no longer act, reveal, or play cards through a stale territory key (guards in both engines); multiactive phases activate exactly the eligible players in one call; the player-card deck reshuffles its discard instead of running dry mid-game; a successful coup resets the defiant-majority counter; tribute statistics credit the collecting overlord; a drift-guard test pins the documented balance knobs to the engine constants.
- Replaced the placeholder blob map with a real world map generated from Natural Earth 110m data (`tools/generate-world-map.mjs`): the ten regions are merged country geometries under the Natural Earth projection, with ocean, graticule, faint internal country borders, and haloed labels; tooltip rows gained proper spacing.
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
