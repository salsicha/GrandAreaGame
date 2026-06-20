# Changelog

## Unreleased

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
