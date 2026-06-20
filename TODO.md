# Grand Area TODO

Updated: 2026-06-20

This backlog is organized around two goals:

- Enrich the gameplay so the prototype expresses the full political strategy design.
- Move the codebase from static prototype toward a production-ready Board Game Arena implementation.

## P0: Current Blockers

- [x] Fix the frontend startup bug where `app.js` writes to `#defiance` but `index.html` does not define that element.
- [x] Restrict map click/hover binding to real territory elements, not every SVG element with an `id`.
- [x] Stop SVG click bubbling from selecting parent groups after a territory path is clicked.
- [x] Normalize the data model so `family`, `type`, and `clientOf` are separate concepts.
- [x] Keep runtime metadata (`crisisDeck`, `hands`, `deck`, `submissions`) out of territory/player iteration.
- [x] Wire or remove the existing `Advance Phase`, `Reveal & Resolve`, and `Reset Round` controls.
- [x] Decide whether the standalone action buttons and turn-manager actions are both needed, then consolidate the UI.
- [x] Add a single verification command that runs JS parse checks, JSON validation, and PHP linting.

## Gameplay Enrichment

- [x] Define playable roles clearly: Head Family, Regional Family, Client Family, and independent/defiant state.
- [x] Add asymmetric win and loss conditions for head, regional, and client players.
- [x] Implement the Ministry of Truth framing mechanic so players choose how much Social Capital/Benevolent Cover to spend on actions.
- [x] Expand Black Budget into a distinct hidden resource used for coups, false flags, covert influence, and deniable operations.
- [x] Add Defiance contagion: successful independence or high-happiness clients should pressure nearby or related clients.
- [x] Add an "Example" response loop where overlords must punish or accommodate defiant clients, with consequences either way.
- [x] Implement resources as real constraints: oil, minerals, grain, industry, shipping, finance, and technology.
- [x] Make resource access affect national income, development, army upkeep, and crisis vulnerability.
- [x] Add national sentiment tracks: independence desire, governance-change desire, factional division, and fear.
- [x] Add education and development as long-term investments with political side effects.
- [x] Add sanctions, coups, invasions, protection offers, debt shakedowns, and economic exploitation as fully balanced actions.
- [x] Build a larger crisis deck with event types, targeting rules, escalation pressure, and era/context tags.
- [x] Expand player cards from 5 prototype cards to a balanced deck with spin, leverage, intelligence, and retaliation cards.
- [x] Add negotiation hooks for tribute holidays, protection deals, client realignment, and regional-family rivalry.
- [x] Define round timing: crisis, tribute, secret action submission, reveal, narrative battle, resolution, cleanup.
- [x] Add deterministic tie breakers for action resolution and simultaneous effects.
- [x] Draft a short rules reference that can be playtested without reading `GEMINI.md`.

## Production Readiness

- [x] Move canonical game resolution to the backend; the browser should never be authoritative for production play.
- [x] Make all random results server-side and replayable from logged seeds or BGA-provided random APIs.
- [x] Replace ad hoc global frontend state with a structured state object and pure rule helpers.
- [x] Add unit tests for tribute, defiance, crisis effects, action resolution, cleanup, cards, and victory/loss checks.
- [x] Add data validation for territories, cards, crisis cards, and SVG territory mappings.
- [x] Add fixture-based tests that load all shipped JSON and verify every referenced id exists.
- [x] Add lint/format tooling for JS, CSS, JSON, PHP, and SQL.
- [x] Add a README section for required local tools, including PHP installed via Homebrew.
- [x] Add a changelog or release checklist before expanding content heavily.

## BGA Integration

- [x] Replace the PHP action scaffold with the proper BGA action class/entrypoint pattern.
- [x] Implement `setupNewGame()` to assign players, initialize territories, build decks, and persist starting state.
- [x] Implement BGA state transitions for crisis, tribute, action submission, reveal, resolution, cleanup, and end game.
- [x] Persist secret submissions, revealed payloads, round number, phase, deck order, discard piles, and public map state.
- [x] Validate commit/reveal payloads against allowed actions, legal targets, current phase, and current player.
- [x] Use BGA-safe database escaping/query helpers instead of manual `addslashes`.
- [x] Add notification payloads for state changes, card draws, action reveals, combat/coup results, and cleanup events.
- [x] Add `gameinfos.inc.php`, material definitions, translations, stats, preferences, and client assets expected by BGA.
- [x] Decide how hidden information is represented for spectators, opponents, and the active player.
- [x] Add migration notes for syncing prototype JSON into BGA material/PHP constants.

## Frontend UX

- [x] Add a clear territory panel that shows family, role, client relationship, resources, wealth, happiness, stash, capital, and defiance.
- [x] Show map overlays for owner, role, resource, happiness, defiance, invaded, sanctioned, and protected states.
- [x] Improve the action picker with legal-action filtering, target filtering, cost previews, and projected effects.
- [x] Add a briefcase/card UI that avoids inline HTML injection and supports hidden information cleanly.
- [x] Replace browser `alert`/`confirm` flow with in-app notices and confirmation dialogs.
- [x] Make the map and side panel usable on small screens.
- [x] Add accessible labels, keyboard navigation, visible focus states, and reduced-motion handling.
- [x] Replace inline styles with CSS classes and shared component styles.

## Content And Balance

- [x] Create a larger territory set with actual world regions or countries.
- [x] Define starting setups for 2, 3, 4, and 5 players.
- [x] Establish numeric ranges for wealth, happiness, stash, social capital, political capital, education, development, resources, and armies.
- [x] Build a balance spreadsheet or simulation harness for repeated test games.
- [x] Track action economy: how many actions per player, how many cards per round, and how fast capital changes.
- [x] Add comeback pressure and anti-runaway mechanics for the Head Family.
- [x] Add client-state paths to victory that are difficult but not cosmetic.

## Verification Checklist

- [x] `npm test`
- [x] `node --check frontend/app.js`
- [x] `node --check frontend/rules.js`
- [x] Static DOM id check for every `q(...)` reference in `frontend/app.js`.
- [x] Map interaction check that only `[data-country]` elements receive territory handlers.
- [x] SVG click propagation check for territory selection.
- [x] Territory iteration check that runtime metadata stays out of player/target/action lists.
- [x] JSON parse check for every file in `frontend/data/`
- [x] Territory schema check for separated `family`, `type`, and `clientOf` fields.
- [x] SVG/data consistency check for every `data-country` value.
- [x] Player card id check that every shipped card has a rule handler.
- [x] Rules unit tests for tribute, defiance, contagion, crisis effects, actions, cleanup, and card effects.
- [x] Rules state-shape check that `crisisDeck`, `hands`, `deck`, and `submissions` are excluded from resolved territory state.
- [x] PHP lint for every file in `bga/`.
- [x] Browser smoke test that loads `frontend/index.html`, selects a territory, runs tribute, submits actions, resolves, and verifies no console errors.
