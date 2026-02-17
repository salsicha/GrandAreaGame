 Write game design spec
 Design core game state & entities (JSON schema)
[in-progress] Implement rules engine (turn resolution library)
 Commit-reveal secret action system (client + verification)
 Implement backend API / BGA hooks (PHP)
[in-progress] Finish frontend map & UI (polish, accessibility)
 Crisis deck & card effects system (editor + engine)
 AI opponents / solo mode (heuristics + tuning)
 Assets, icons and art pipeline (SVGs, sprites)
 Testing & automated simulations (unit + integration)
 Multiplayer lobby + persistence (save/load)
 Security & anti-cheat (commit hashes, server checks)
 Package & deploy to BoardGameArena
 Docs, README, tutorials and playthroughs
 Polish: UX, performance, localization, accessibility



 PHP backend that integrates with BoardGameArena (BGA), plus the critical patterns you’ll need (commit‑reveal, state machine, notifications, security, packaging).

High level architecture
Server (PHP, BGA framework): authoritative game state, rules engine, DB, state machine, action handlers, notifications.
Client (BGA JS): view + interactions. The client sends actions (sealed or revealed) to PHP action endpoints; server verifies and broadcasts notifications.
Data: territories + family boards + crisis deck persisted in DB; rules engine runs on server to resolve turns.
BGA module files you’ll create
gamename.game.php (main game class; contains state machine and server-side game logic / rules calls)
gamename.action.php (AJAX action endpoints the client calls to submit/reveal actions)
states.inc.php (state machine definition: Crisis, Tribute, Action Submission, Resolution, etc.)
gamename.sql (DB schema for territories and game tables)
gi18n/*.php (translations)
client: gamename.js + gamename.html/css (BGA client side; follow BGA client skeleton)
meta files: gameinfos, studio config, readme, images, etc.
Core DB model (example columns)
table territories (game_id, territory_key, family, wealth, happiness, stash, socialCapital, politicalCapital, development, defiance, invaded)
table player_state (game_id, player_id, family_name, stash, socialCapital, politicalCapital, personal_hash?, etc.)
table secret_submissions (game_id, player_id, hash, submitted_at, revealed BOOLEAN, reveal_payload JSON NULL)
table crisis_deck (game_id, card_id, status) or keep deck in game state JSON
State machine & phases (states.inc.php)
Phase 1: Crisis (draw/apply crisis card)
Phase 2: Tribute (auto transfer or player choices)
Phase 3: Action Submission (players commit hashes / secrets)
Phase 4: Reveal & Resolution (players reveal, server verifies, runs rules engine, apply results)
Phase 5: Cleanup/Heat (Uprising checks, reputation checks), then back to Phase 1 next round
Commit‑Reveal pattern (server-side)
Client commit:
Client builds cleartext payload: JSON.stringify({ action, target, nonce }) where nonce is random per-submission.
Client computes hash = SHA256(gameId + playerId + payload) (do this client-side).
Client sends hash to server: POST gamename.action.php?cmd=submitCommit { hash }.
Server stores hash in secret_submissions (sealed) and notifies players "player X submitted (sealed)". DO NOT store the cleartext.
Client reveal:
Client sends reveal: POST gamename.action.php?cmd=reveal { payload, nonce }.
Server recomputes expectedHash = SHA256(gameId + playerId + payload) and checks equals stored hash.
If match → store revealed payload (or store action and discard hash), mark revealed=true, broadcast reveal notification (with payload or only to server then server resolves).
If mismatch → reject and log/penalize.
Action submission & reveal flow (authoritative server)
When reveal phase begins server can:
Require each player to call reveal (or allow timeout auto-resolve converting missing reveals to Pass).
Verify H(payload) == storedHash.
Move verified revealed actions into a canonical action list in DB.
Once all required actions are revealed (or timeout/force-reveal), server calls server-side rules engine to resolve actions (weakest→strongest).
Server writes resulting new territory/player state to DB and calls BGA notify/notifyAllPlayers to push changes to clients. BGA UI receives notifications and updates client views.
Rules engine
Implement the engine in PHP inside gamename.game.php (or separate PHP class file).
Input: canonical state (territories + players) and canonical action list (revealed).
Output: state delta (changes), event log entries (for client log) and list of notifications (e.g., which territories invaded).
Keep engine deterministic; use server RNG where needed (store RNG seed in DB for reproducibility).
Crisis deck integration
Store deck in DB or as JSON in game table.
On Crisis phase: server shuffles (Fisher‑Yates server-side), draws top card, sets state.crisis, optionally broadcasts card title/description (or keep secret if desired). Rules engine checks state.crisis and applies effects during resolution.
Notifications (BGA)
Use BGA notification API to broadcast small, structured events (submission status, reveal, applyEffect, logEntry, updateTerritory).
Client receives notifications and updates the UI with minimal diffs (not full state each time).
Also implement getAllData / getGameData endpoints for reconnects.
Security & anti-cheat
Server authoritative: never trust client payloads; always verify commits and revalidate reveals against stored hash.
Use prepared statements for DB and sanitize inputs.
Rate-limit actions, and implement server-side checks for impossible actions (e.g., negative wealth).
For stronger anti-tamper: require a signed reveal (HMAC with server secret) or store commit with nonce+timestamp; but standard commit‑reveal + server verification is sufficient for most BGA games.
Testing & dev workflow
Build BGA module locally with BGA Studio (the recommended way to iterate). BGA provides local dev / debugging environment and a test harness.
Unit test rules engine in PHP (PHPUnit/simple harness).
Create integration tests: simulate many rounds with scripted actions to verify stability.
Packaging & deployment to BGA
Follow BGA submission guidelines: zip module directory, include SQL schema, game info, images.
Use BGA Studio upload for validation and initial review.
Expect iterative fixes during BGA review (they check UI/translation/packaging).
Minimal example pseudo-code (submit commit handler)
gamename.action.php?action=submitCommit:

verify player is in correct phase and allowed to submit
insert into secret_submissions(game_id, player_id, hash, submitted_at)
self::notifyAllPlayers('playerSubmitted', player_id)
return success
gamename.action.php?action=reveal:

verify player previously committed
compute expected = sha256(gameId + playerId + payload)
if expected != stored_hash -> error
else mark revealed, parse payload to canonical action, store canonical action in DB
self::notifyAllPlayers('playerRevealed', {player, actionSummary})
if all revealed or timeout -> call resolveTurn()
Implementation priorities & next steps I can do for you
Scaffold BGA PHP module skeleton and states.inc.php for this game.

Implement server-side commit/reveal handlers (PHP) and DB SQL for secret_submissions + territories.
Port the current JS prototype into BGA client skeleton (work will include adapting to BGA JS conventions and dojo).
Write PHP rules engine unit tests.


