# BGA Integration Notes

This folder is a complete Board Game Arena Studio project laid out in BGA's required structure (`dbmodel.sql`, root-level `grandareagame.js` / `grandareagame.css` / `grandareagame_grandareagame.tpl`, `modules/php/`). The browser prototype can preview play, but authoritative game resolution belongs to `GrandAreaRules.php` and `GrandAreaGame`. For the step-by-step path to publication, see [PUBLISHING.md](PUBLISHING.md).

## Current Server Flow

1. `setupNewGame()` inserts players into the framework `player` table with colors, assigns families deterministically from the embedded setup fixtures by player order (territory order fallback), initializes territories from embedded material, builds decks, deals starting hands, stores a secret per-game salt, and initializes statistics.
2. The state machine starts at the mandatory `gameSetup` state (id 1) and then cycles `crisis -> tribute -> actionSubmission -> reveal -> narrativeBattle -> resolution -> cleanup -> crisis`. Multiactive phases activate exactly the eligible players in one exclusive call (living players for submission and narrative battle, committed players for reveal) and advance when every remaining player has acted or ended their turn. Narrative battle is a real phase: each living player may `submitSpin` (smear or whitewash a revealed story for 4 Social Capital) or pass; plays are public and feed `GrandAreaRules::resolveTurn` as post-reveal framing adjustments.
3. `stCrisis()` draws (reshuffling the discard when needed), publishes the drawn card, and deals each player a round card up to the embedded hand limit.
4. Players submit SHA-256 commits for secret actions through `submitCommit`; commits are scoped to the current round and are locked once any reveal has happened in the round.
5. Players reveal payload plus nonce through `reveal`; the server recomputes the commit hash, validates action, target, phase (via `checkAction`), and family ownership, and marks the player done with the phase.
6. `stResolution()` gathers revealed payloads and calls `GrandAreaRules::resolveTurn()`, which runs the full pipeline in the reference-engine order: crisis application, actions, unanswered-defiance pressure, objective evaluation, defiance contagion, and a final objective pass. The applied crisis card moves to the discard and the round's submissions are deleted.
7. `stCleanup()` calls `GrandAreaRules::resolveCleanup()` (capital checks, uprising, counter decay, protection expiry, resource-shortage pressure, sentiment growth, comeback pressure, objectives), persists outcomes, and advances the round.
8. Both resolution and cleanup check for game end (any `Won` outcome, all but one player eliminated, or the round limit from the "Game length" option reached — 12/20/30 rounds). Objective winners score `1000 + wealth`, other survivors score their family wealth, eliminated players score `0`; `player_score_aux` carries wealth as the tiebreak. The round limit guarantees every game terminates.

## Determinism And Seeds

- A secret per-game salt is generated at setup (`openssl_random_pseudo_bytes`, `random_bytes` fallback) and stored in `game_runtime`.
- Every deterministic seed (deck shuffles, resolution, cleanup) mixes in the salt, so players cannot precompute coup or uprising rolls from public identifiers.
- Notifications publish only a CRC32 checksum of the resolution seed (as an unsigned string); the full seed stays server-side in `game_runtime.last_resolution_seed`.

## Hidden Information

- `secret_submissions.commit_hash` is public proof that a player committed.
- `secret_submissions.reveal_payload` is hidden until reveal succeeds; rows are deleted after resolution.
- `player_state.hand_json` stores each player's private hand; `getAllDatas()` returns only hand counts for opponents and the full hand for the requesting player.
- `game_runtime` stores deck order, discards, the current crisis, the secret salt, and revealed payload audit data.
- Public notifications never include unrevealed hand contents or unrevealed payloads.

## Material

The module is fully self-contained: `material.inc.php` is GENERATED from the prototype JSON fixtures (`frontend/data/*.json`) and embeds territories, crisis cards, all 17 player cards, setup fixtures, and balance knobs as PHP arrays. Nothing under `bga/` reads outside the game folder at runtime.

After changing any source JSON, regenerate with:

```
node tools/generate-bga-material.js
```

The board template embeds `frontend/map.svg`; after regenerating the map, rebuild the template with:

```
node tools/generate-bga-board.js
```

A repo test verifies the embedded material checksum matches the JSON sources, so drift fails CI.

## Validation Rules

- Every AJAX entry point calls `checkAction()`, so actions are rejected outside their phase and from inactive players.
- Commit hashes must match `GRANDAREA_COMMIT_HASH_REGEX`; re-commits are rejected once any reveal has happened in the round.
- Reveal payloads are size-limited, JSON-decoded server-side, and verified against the stored commit for the current round.
- Actions must be in `grandarea_allowed_actions()`; actor family must match the current player's assigned family; targets must exist in the current territory state.
- Played cards must be in the acting player's hand and respect the card's Self/Other targeting.
- Player-facing validation failures throw `BgaUserException`.

## Rules Parity

`modules/php/GrandAreaRules.php` is a line-for-line port of `frontend/rules.js`: per-action math (including Coup/Invade framing, Protect vs ProtectionDeal, protected-target invasion backlash, overlord-only defiance responses), the shared resource-bloc model, crisis targeting scopes, contagion as a single deterministic wave, tribute lapses, eliminated-actor rules, objective thresholds (`grandarea_objectives()`), and the happiness cap of 200. RNG sequencing differs (the PHP side uses per-step SHA-256 rolls instead of the JS LCG), so replays are deterministic per engine but not cross-engine.

## Client

The Dojo client (`grandareagame.js` + `grandareagame_grandareagame.tpl` + `grandareagame.css`) renders the world-map board with role/status overlays and click-to-select, a territory inspector, an action builder (action/target/framing filtered to server-acceptable choices), the commit/reveal flow (SHA-256 via `crypto.subtle`, nonce + payload stored in `localStorage` per table/round), the player's hand with play buttons, and a running game log. A player who loses their stored secret (different browser/device) can always End Turn instead of revealing.

## Remaining BGA Work

- The state machine, multiactive handoffs, `getAllDatas()`, progression, and scoring follow documented Table APIs but have not been exercised inside a real BGA sandbox; expect framework-fit fixes (notification message strings, `argGameEnd`, reflexion time tuning) on first deployment. See PUBLISHING.md for the Studio test plan.
- Visible notification text still needs `clienttranslate` wrapping and message arguments once the interface stabilizes in Studio.
- Spectator payload shaping beyond hand-count masking has not been tested.
- `img/game_box.png`, `img/game_icon.png`, and `img/game_banner.png` are map-derived placeholders; replace them with real art before release (see PUBLISHING.md).
