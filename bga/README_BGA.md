# BGA Integration Notes

This folder is the production-facing BGA scaffold. The browser prototype can preview play, but authoritative game resolution belongs to `GrandAreaRules.php` and `GrandAreaGame`.

## Current Server Flow

1. `setupNewGame()` loads prototype material JSON, assigns families, initializes territories, builds decks, and persists runtime state.
2. Players submit SHA-256 commits for secret actions through `submitCommit`.
3. Players reveal payload plus nonce through `reveal`; the server recomputes the commit hash and validates action, target, phase, and family ownership.
4. `stResolution()` gathers revealed payloads, creates a logged deterministic seed, calls `GrandAreaRules::resolveTurn()`, runs cleanup, and persists public map state.
5. Notifications publish crisis draws, tribute results, commit/reveal status, resolution logs, and round advancement.

## Hidden Information

- `secret_submissions.commit_hash` is public proof that a player committed.
- `secret_submissions.reveal_payload` is hidden until reveal succeeds.
- `player_state.hand_json` stores each player's private hand; spectator and opponent views should only receive counts unless a card is revealed.
- `game_runtime` stores deck order, discards, current crisis, and revealed payload audit data.
- Public notifications must never include unrevealed hand contents or unrevealed payloads.

## Material Migration

Prototype JSON remains the source for initial BGA material during this scaffold stage:

- `frontend/data/territories.json` maps to `territories`.
- `frontend/data/crisis.json` maps to `game_runtime.crisis_draw` and crisis metadata.
- `frontend/data/playercards.json` maps to `game_runtime.player_deck` and player hands.

When the module stabilizes, move these JSON records into BGA-native PHP constants in `material.inc.php` and keep a migration script or checklist for syncing changes.

## Validation Rules

- Commit hashes must match `GRANDAREA_COMMIT_HASH_REGEX`.
- Reveal payloads are size-limited and JSON-decoded server-side.
- Actions must be in `grandarea_allowed_actions()`.
- Actor family must match the current player's assigned family.
- Targets must exist in the current territory state unless the action targets self.

## Remaining BGA Work

- Replace placeholder client UI with a full Dojo interface.
- Add translation strings for every visible notification.
- Add spectator-specific and opponent-specific payload shaping.
- Wire state transitions to active-player completion in a real BGA sandbox.
