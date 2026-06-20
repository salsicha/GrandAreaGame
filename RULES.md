# Grand Area Rules Reference

This file defines the playable roles used by the prototype. `GEMINI.md` is the broader design notebook; this file is the shorter rules reference for implementation and playtesting.

## Territory Role Model

Each territory record separates identity, role, and dependency:

- `family`: the controlling family or faction name, such as `USA`, `EU`, or `African Client Bloc`.
- `type`: the playable role category. Current values are `Head`, `Regional`, and `Client`.
- `clientOf`: the controlling family or bloc that receives tribute from a client. This is required for `Client` territories and should be `null` or omitted for `Head` and `Regional` territories.
- `defiance`: the current refusal pressure. `0` means compliant. A value above `0` means the territory is defiant and refuses tribute.

## Head Family

The Head Family is the top-level power in the hierarchy.

- Does not pay tribute.
- Collects tribute from direct or indirect clients.
- Uses sanctions, coups, invasions, protection, narrative cover, and client management to preserve the hierarchy.
- Loses strategic position when social capital, political capital, or domestic happiness collapses.
- Must respond to defiance because an unpunished client can encourage other clients to refuse tribute.

Prototype mapping: `type: "Head"` and `clientOf: null`.

Win condition in the prototype:

- Win when wealth is at least `300` and every active client is compliant.

Loss conditions in the prototype:

- Lose when personal, political, or social capital reaches `0`.
- Lose when an uprising collapses family control.
- Lose when a majority of active clients are defiant.

## Regional Family

Regional Families are middle powers. They are not direct clients, but they do not fully control the global order.

- Do not pay tribute in the current prototype.
- Can enforce the Head Family's order, compete with other regional families, or build influence over clients.
- Can become a rival pole of power if future victory rules allow a regional family to challenge the Head Family.
- Are exposed to reputation costs and domestic instability when they overuse coercive actions.

Prototype mapping: `type: "Regional"` and `clientOf: null`.

Win condition in the prototype:

- Win when wealth is at least `260` and political capital is at least `120`.

Loss conditions in the prototype:

- Lose when personal, political, or social capital reaches `0`.
- Lose when an uprising collapses family control.
- Lose when national happiness is `20` or lower.

## Client Family

Client Families are dependent powers tied to an overlord through tribute.

- Pay tribute to `clientOf` during the tribute phase unless defiant.
- Can comply, seek protection, build domestic legitimacy, or attempt to break away.
- Are vulnerable to sanctions, coups, invasions, and coercive pressure from stronger families.
- Become strategically dangerous when high happiness, development, or independence sentiment makes them a good example for other clients.

Prototype mapping: `type: "Client"` and `clientOf` set to the overlord family or bloc.

Win condition in the prototype:

- Win when defiant, national happiness is at least `120`, and development is at least `70`.

Loss conditions in the prototype:

- Lose when personal, political, or social capital reaches `0`.
- Lose when an uprising collapses family control.
- Lose when wealth or national happiness reaches `0`.

## Independent/Defiant State

Defiance is a status, not a separate `type` in the current prototype.

- A defiant client refuses tribute while `defiance > 0`.
- Defiance should force the overlord to choose between punishment, concessions, or accepting contagion risk.
- Independent status is the intended long-term result of successful defiance, but the prototype does not yet implement a separate `Independent` type.
- Until independence rules are implemented, treat independent/defiant play as a client-state path that begins with tribute refusal and escalates through contagion and response pressure.

Prototype mapping: `type: "Client"` with `defiance > 0` for defiance. A future implementation can add `type: "Independent"` once setup, tribute, victory, and targeting rules support it.

In the current prototype, the defiant-client win condition is the independent-state path.

## Current Prototype Examples

- `Americas`: Head Family territory controlled by `USA`.
- `Europe`: Regional Family territory controlled by `EU`.
- `Africa`: Client Family territory controlled by `African Client Bloc`, client of `EU`.
- `Asia`: Regional Family territory controlled by `China`.
- `Oceania`: Client Family territory controlled by `Pacific Client Bloc`, client of `USA`.
