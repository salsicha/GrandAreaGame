# BGA Integration Notes

This folder is the production-facing BGA scaffold. The browser prototype can preview play, but authoritative game resolution belongs to `GrandAreaRules.php` and `GrandAreaGame`.

## Current Server Flow

1. `setupNewGame()` inserts players into the framework `player` table with colors, assigns families deterministically from `frontend/data/setups.json` by player order (territory order fallback), loads prototype material JSON, initializes territories, builds decks, deals starting hands, stores a secret per-game salt, and initializes statistics.
2. The state machine starts at the mandatory `gameSetup` state (id 1) and then cycles `crisis -> tribute -> actionSubmission -> reveal -> narrativeBattle -> resolution -> cleanup -> crisis`. Multiactive phases activate all players on entry and advance when every player has acted or ended their turn.
3. `stCrisis()` draws (reshuffling the discard when needed), publishes the drawn card, and deals each player a round card up to the hand limit from `frontend/data/balance.json`.
4. Players submit SHA-256 commits for secret actions through `submitCommit`; commits are scoped to the current round and are locked once any reveal has happened in the round.
5. Players reveal payload plus nonce through `reveal`; the server recomputes the commit hash, validates action, target, phase (via `checkAction`), and family ownership, and marks the player done with the phase.
6. `stResolution()` gathers revealed payloads and calls `GrandAreaRules::resolveTurn()`, which runs the full pipeline in the reference-engine order: crisis application, actions, unanswered-defiance pressure, objective evaluation, defiance contagion, and a final objective pass. The applied crisis card moves to the discard and the round's submissions are deleted.
7. `stCleanup()` calls `GrandAreaRules::resolveCleanup()` (capital checks, uprising, counter decay, protection expiry, resource-shortage pressure, sentiment growth, comeback pressure, objectives), persists outcomes, and advances the round.
8. Both resolution and cleanup check for game end (any `Won` outcome, or all but one player eliminated); winners score `1` and `player_score_aux` carries family wealth as the tiebreak.

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

## Material Migration

Prototype JSON remains the source for initial BGA material during this scaffold stage:

- `frontend/data/territories.json` maps to `territories`.
- `frontend/data/crisis.json` maps to `game_runtime.crisis_draw` and crisis metadata.
- `frontend/data/playercards.json` maps to `game_runtime.player_deck` and player hands (all 17 cards, 3 copies each).
- `frontend/data/balance.json` supplies the hand limit and per-round deal count.
- `frontend/data/setups.json` supplies family assignment fixtures for 2-5 players.

When the module stabilizes, move these JSON records into BGA-native PHP constants in `material.inc.php` and keep a migration script or checklist for syncing changes.

## Validation Rules

- Every AJAX entry point calls `checkAction()`, so actions are rejected outside their phase and from inactive players.
- Commit hashes must match `GRANDAREA_COMMIT_HASH_REGEX`; re-commits are rejected once any reveal has happened in the round.
- Reveal payloads are size-limited, JSON-decoded server-side, and verified against the stored commit for the current round.
- Actions must be in `grandarea_allowed_actions()`; actor family must match the current player's assigned family; targets must exist in the current territory state.
- Played cards must be in the acting player's hand and respect the card's Self/Other targeting.
- Player-facing validation failures throw `BgaUserException`.

## Rules Parity

`modules/php/GrandAreaRules.php` is a line-for-line port of `frontend/rules.js`: per-action math (including Coup/Invade framing, Protect vs ProtectionDeal, protected-target invasion backlash, overlord-only defiance responses), the shared resource-bloc model, crisis targeting scopes, contagion as a single deterministic wave, tribute lapses, eliminated-actor rules, objective thresholds (`grandarea_objectives()`), and the happiness cap of 200. RNG sequencing differs (the PHP side uses per-step SHA-256 rolls instead of the JS LCG), so replays are deterministic per engine but not cross-engine.

## Remaining BGA Work

- The Dojo client is still a minimal log/console view: it renders notifications, the round, the crisis, the player's own hand as text, and an End Turn button. It does not yet render the map, build commit hashes, or offer action/target pickers, so full games currently need a scripted or API-driven client.
- The state machine, multiactive handoffs, `getAllDatas()`, progression, and scoring follow documented Table APIs but have not been exercised inside a real BGA sandbox; expect framework-fit fixes (notification message strings, `argGameEnd`, reflexion time tuning) on first deployment.
- Translation strings exist only for state descriptions; visible notification text still needs `clienttranslate` wrapping once the client UI stabilizes.
- Spectator payload shaping beyond hand-count masking has not been tested.
- Material still loads from `frontend/data` JSON rather than `material.inc.php` constants.
