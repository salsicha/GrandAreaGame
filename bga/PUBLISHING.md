# Publishing Grand Area to Board Game Arena — Step-by-Step

Everything that can be prepared in this repository has been prepared: the `bga/`
folder is a complete BGA Studio project in the required layout, self-contained
(no reads outside the game folder), with a working commit/reveal client, a
guaranteed round limit, zombie handling, and placeholder art. The steps below
are the parts only you (the account holder / rights holder) can do. Work top to
bottom; each step tells you what to check before moving on.

## 1. Get a BGA Studio developer account

1. Create a normal Board Game Arena account at <https://boardgamearena.com> if
   you do not have one.
2. Apply for Studio access at <https://studio.boardgamearena.com> (there is a
   short form; mention you are the designer of an original game). Approval is
   manual and can take a few days.
3. When approved you receive:
   - a Studio login (your BGA username, Studio password is separate),
   - SFTP credentials for uploading game files,
   - a set of test accounts (`yourname0`, `yourname1`, ... ) for multiplayer
     testing in Studio.

## 2. Reserve the project

1. In the Studio control panel, create a new game project named exactly
   `grandareagame` (lowercase, no spaces — this must match
   `getGameName()` in `grandareagame.game.php` and the ajax URLs in
   `grandareagame.js`).
2. Because Grand Area is an original design, you are the rights holder. BGA
   will ask you to confirm licensing when you first create the project and
   again at release time; as designer you can grant this yourself.

## 3. Upload the module

1. Connect to the Studio SFTP with the credentials from step 1
   (host `1.studio.boardgamearena.com`, or as given in your welcome email).
2. Upload the **contents** of this repo's `bga/` directory into the
   `grandareagame/` project folder (so `dbmodel.sql` sits at the project
   root — do not upload the `bga/` folder itself, and do not upload anything
   from outside `bga/`).
3. `README_BGA.md` and `PUBLISHING.md` are documentation; uploading them is
   harmless but unnecessary.

If you later change game data (territories, cards, balance) or the map in this
repo, regenerate the embedded copies before re-uploading:

```
node tools/generate-bga-material.js   # rebuilds bga/material.inc.php
node tools/generate-bga-board.js      # rebuilds the board template from frontend/map.svg
npm test                              # verifies embedded material matches the JSON sources
```

## 4. First boot in Studio

1. In Studio, open **Manage games → grandareagame → Test** and create a table
   ("Express start" with 4 players is the fastest first test).
2. The framework creates the database from `dbmodel.sql` at table creation.
   If you change `dbmodel.sql` later you must delete and recreate your test
   tables (or write the migration in `upgradeTableDb`).
3. First things to verify on the very first table:
   - The table reaches the **Crisis** phase automatically (the state machine
     wires `gameSetup → crisis → tribute → actionSubmission`).
   - The map renders with ten colored regions and clicking a region fills the
     territory inspector.
   - The log shows the crisis draw and tribute lines.

## 5. Play a full round with test accounts

Open the same table in two browsers (main account + a `yourname0` test
account) and walk through one round:

1. **Submission phase**: pick an action/target/framing, press *Commit secret
   action*. Status bar should show the commit; the other player sees "a player
   locked in a secret action" without seeing what it is.
   **Check the reveal immediately in the same round the first time**: the
   commit hash is computed client-side over the exact payload string, so if
   the framework's `AT_json` argument handling ever rewrites the payload in
   transit, every reveal fails with "Reveal does not match commit". If that
   happens, it is a framework-encoding issue in `reveal()` — compare the
   payload logged by the client against what `revealActionPayload` received.
2. **Reveal phase**: press *Reveal committed action* in the same browser you
   committed from (the secret payload is stored in that browser's
   localStorage). Verify a player who never committed is auto-skipped.
3. **Resolution/cleanup**: check the log for the resolution lines and the map
   for updated colors/strokes (defiant = red fill, invaded = red stroke,
   protected = green stroke).
4. Play a card from the hand panel and verify opponents see the effect but
   not your remaining hand.
5. Let a round-limit game finish (create a table with the *Short (12 rounds)*
   option) and confirm scores appear and the game ends normally.
6. Test abandonment: have a test account quit; the zombie player should be
   auto-skipped in later rounds and the game should still finish.

Known first-deployment risks (all documented in `README_BGA.md`): framework
message strings, `argGameEnd` cosmetics, and reflexion-time tuning may need
small fixes — these can only be discovered inside Studio.

## 6. Replace the placeholder art

`img/game_box.png`, `img/game_icon.png`, and `img/game_banner.png` are
map-derived placeholders. Before review you need real art that you own the
rights to:

- `game_box.png` — box/cover art (BGA displays it at several sizes; upload at
  least 512×512).
- `game_icon.png` — small icon, 50×50.
- `game_banner.png` — wide banner used on the game page.

Check the current exact size requirements on the BGA Studio wiki page
"Game art: img directory" — they change occasionally, and the reviewer will
check them. Upload replacements over SFTP into `img/`.

## 7. Fill in the game metadata

In the Studio control panel for the project:

1. Complete the **game presentation** (short description, long description,
   strategy tips). The satirical framing matters here: present it as a
   geopolitics/hierarchy engine ("families", tribute, defiance) — BGA review
   reads this text.
2. Set player counts (2–5), estimated duration (~90 min), and complexity to
   match `gameinfos.inc.php` (players 2–5, complexity 4, strategy 5,
   diplomacy 5, luck 2).
3. Write the **rules summary** page (BGA hosts a wiki-style rules page per
   game). `RULES.md` in this repo is written to be pasted there nearly
   verbatim — trim the "Prototype mapping" implementation notes.
4. Mark the game as **beta** initially (`is_beta` is already `1` in
   `gameinfos.inc.php`).

## 8. Translations

All player-visible state descriptions use `clienttranslate()` /
`totranslate()` already. After your first Studio deployment, open the
translation module once so the strings register; BGA's community translates
from English source strings. Notification log lines are currently plain
English — acceptable for alpha, but wrap any final phrasing you settle on in
`clienttranslate()` before requesting review (listed in `README_BGA.md` under
Remaining BGA Work).

## 9. Request review

1. In Studio, run the built-in pre-release checks (control panel → *Go to
   review*). Fix anything it flags.
2. Play at least the required number of complete games on Studio (the review
   form asks for evidence of full playthroughs at different player counts —
   do 2, 4, and 5 players at minimum, plus one Short-length game).
3. Submit for review. A BGA reviewer will play the game and file issues;
   expect one or two iterations. After approval the game goes to **alpha**
   (invite-only), then **beta**, then public release — you control the
   promotion pace from the control panel.

## 10. After each repo change

Keep this loop for any future rules/balance/map change:

1. Edit `frontend/rules.js` / `frontend/data/*.json` / `frontend/map.svg`.
2. Mirror rule changes in `bga/modules/php/GrandAreaRules.php` (and
   `constants.inc.php` thresholds).
3. Regenerate embedded material and the board template (commands in step 3).
4. `npm test` — the suite checks JS/PHP lint, embedded-material checksums,
   and the rules engine.
5. Re-upload changed files over SFTP and re-test in Studio.
