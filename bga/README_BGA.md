# BGA module scaffold for Grand Area

This folder contains a minimal scaffold for a BoardGameArena (BGA) module.

Files added:

- `grandareagame.game.php` — main server-side game class (skeleton)
- `grandareagame.action.php` — AJAX endpoints skeleton for client actions
- `states.inc.php` — state constants and a minimal `$machinestates` array
- `grandareagame.sql` — SQL scaffold for territories, player_state, secret_submissions

Next steps to integrate with BGA:

1. Follow BGA module layout and add `gameinfos` file, images, translation files, and client-side Dojo-based JS (`client/` folder with `grandareagame.js`).
2. Implement server-side logic in `grandareagame.game.php` for each state callback (stCrisis, stActionSubmission, stResolution, etc.).
3. Implement `grandareagame.action.php` handlers for `submitCommit`, `reveal`, and other player actions, using BGA APIs to notify players.
4. Add DB schema to module and test `setupNewGame()` to populate initial territory rows.

If you want, I can: scaffold `gameinfos` and a minimal `client` folder adapted to BGA's conventions, or implement the PHP commit/reveal handlers next.
