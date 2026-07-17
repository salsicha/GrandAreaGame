# Grand Area Rules Reference

This file defines the playable roles used by the prototype. `CONCEPT.md` is the broader design notebook; this file is the shorter rules reference for implementation and playtesting.

## Territory Role Model

Each territory record separates identity, role, and dependency:

- `family`: the controlling family or faction name, such as `USA`, `EU`, or `African Client Bloc`.
- `type`: the playable role category. Current values are `Head`, `Regional`, and `Client`.
- `clientOf`: the controlling family or bloc that receives tribute from a client. This is required for `Client` territories and should be `null` or omitted for `Head` and `Regional` territories.
- `resources`: resources controlled directly by the territory.
- `resourceNeeds`: resources required to keep the territory's economy and development stable.
- `armies`: military upkeep pressure. Missing `Oil` creates additional wealth loss based on armies.
- `blackBudget`: covert operating funds used for deniable actions.
- `education`: long-term human capacity. High education can increase independence or governance-change pressure depending on happiness and role.
- `development`: long-term productive capacity used by client good-example victory and reduced by resource shortages.
- `debt`: externally imposed obligations. Debt shakedowns raise this track and convert target wealth into actor wealth.
- `tributeHoliday`: tribute phases remaining where a client skips payment by negotiated agreement.
- `protectionDeal`: cleanup rounds remaining on a formal protection arrangement.
- `realignmentPressure`: pressure that makes a client eligible to switch patrons.
- `rivalryPressure`: pressure from regional-family rivalry.
- `independenceSentiment`: client pressure to break from the hierarchy.
- `governanceChangeSentiment`: public pressure to replace the current family.
- `factionalDivision`: internal division that makes coups easier.
- `fear`: coercive control that suppresses governance-change pressure and makes coups harder.
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

- Win when wealth is at least `400` and every active client of the Head family is compliant. Other families' defiant clients do not block the win. With no active clients left, the compliance requirement is trivially met.

Loss conditions in the prototype:

- Lose when personal, political, or social capital reaches `0`.
- Lose when an uprising collapses family control.
- Lose to a defiant-client majority: at least `2` of the Head family's own active clients are defiant, they form a strict majority of the Head's active clients, and that majority stands at `2` consecutive cleanup phases. The engine tracks this on the Head's `defianceMajorityRounds` counter: each cleanup with a standing majority raises it by `1`, any cleanup without one resets it to `0`, and the Head is marked Lost while a majority stands and the counter is `2` or higher. A single defiant client can never topple the Head on its own, and rival hierarchies' defiant clients no longer count against it.

## Regional Family

Regional Families are middle powers. They are not direct clients, but they do not fully control the global order.

- Do not pay tribute in the current prototype.
- Can enforce the Head Family's order, compete with other regional families, or build influence over clients.
- Can become a rival pole of power if future victory rules allow a regional family to challenge the Head Family.
- Are exposed to reputation costs and domestic instability when they overuse coercive actions.

Prototype mapping: `type: "Regional"` and `clientOf: null`.

Win condition in the prototype:

- Win when wealth is at least `320` and political capital is at least `130`.

Loss conditions in the prototype:

- Lose when personal, political, or social capital reaches `0`.
- Lose when an uprising collapses family control.
- Lose when national happiness is `20` or lower.

## Client Family

Client Families are dependent powers tied to an overlord through tribute.

- Pay tribute to `clientOf` during the tribute phase unless defiant. Tribute lapses (nothing is paid or lost) when the overlord has no surviving territory.
- Can comply, seek protection, build domestic legitimacy, or attempt to break away.
- Are vulnerable to sanctions, coups, invasions, and coercive pressure from stronger families.
- Become strategically dangerous when high happiness, development, or independence sentiment makes them a good example for other clients.

Prototype mapping: `type: "Client"` and `clientOf` set to the overlord family or bloc.

Win condition in the prototype:

- Win when defiant, national happiness is at least `120`, development is at least `70`, and independence sentiment is at least `60`.

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

## Ministry of Truth Framing

Framing is an explicit Social Capital spend chosen with a submitted action.

- Players can assign framing points before locking or submitting a turn-manager action.
- Framing is spent from Social Capital when the action resolves.
- Invade uses framing to reduce target happiness loss and public backlash.
- Coup uses framing to reduce the actor's Social Capital penalty on success or failure.
- Spending `0` framing means the action resolves without narrative cover and takes the full backlash.

## Black Budget

Black Budget is a separate hidden resource from family stash.

- Coup costs `10` Black Budget before the success roll.
- False Flag costs `8` Black Budget and creates Social Capital cover.
- Covert Influence costs `6` Black Budget, raises target defiance by `1`, and gives the actor political capital. A client may target itself with Covert Influence to deliberately stoke its own defiance and start down the independence path.
- Black Budget reaching `0` is not an immediate loss condition; it limits covert options.

## Defiance Contagion

Clients can spread defiance pressure to nearby or politically related clients.

- A client emits contagion when happiness crosses `120`, defiance reaches `3`, or the client wins through the defiant good-example path.
- Contagion targets clients with the same `clientOf` relationship or an adjacent `neighbors` relationship.
- Each affected target gains `1` defiance.
- Contagion resolves as a single deterministic wave per resolution: sources are fixed before any defiance is added, so a client pushed over a threshold by contagion only becomes a source in the next round.

## Example Response

Defiant clients require a response.

- `MakeExample` targets one of the actor's own defiant clients, resets defiance to `0`, lowers target happiness by `20`, costs the actor `10` Social Capital, and gives the actor `5` Political Capital. The full Social Capital cost must be affordable or the action fails.
- `Concession` targets one of the actor's own defiant clients, resets defiance to `0`, raises target happiness by `10`, costs the actor `10` wealth and `5` Political Capital, and gives the actor `5` Social Capital. Both costs must be affordable or the action fails.
- Only the client's overlord can respond with `MakeExample` or `Concession`; third parties cannot farm the response reward.
- Any defiant client left unanswered costs its overlord `3` Social Capital and `3` Political Capital during resolution, capped at `9` Social Capital and `9` Political Capital per overlord per resolution no matter how many clients are defiant. Eliminated clients and eliminated overlords are excluded from this pressure.

## Resources

Resources are constraints, not just labels.

- Territories use their own `resources` plus resources from compliant clients they control.
- Compliant clients also use their overlord family's resources and the resources of compliant bloc-mates (clients of the same overlord). Defiance cuts a client off from the bloc pool, so choosing independence means accepting shortage pressure.
- Missing each required resource costs `5` wealth, `1` development, and `2` happiness during cleanup.
- Missing `Oil` adds extra wealth loss equal to the territory's `armies`.
- Global austerity is harsher for territories missing `Grain` or `Finance`.

## Sentiment

Sentiment tracks political pressure inside a territory.

- Client defiance and high happiness increase `independenceSentiment`.
- Low happiness and excess family stash increase `governanceChangeSentiment`.
- Educated happy clients increase `independenceSentiment`; educated unhappy territories increase `governanceChangeSentiment`.
- `fear` suppresses governance-change growth.
- Coup odds increase with target `governanceChangeSentiment` and `factionalDivision`, and decrease with target `fear`.

## Cleanup Recovery And Collapse

Cleanup resolves in a fixed order: capital-zero checks, protection and pressure decay, uprising checks, resource pressure, sentiment, recovery, comeback pressure, the defiant-majority counter update, then objectives.

- Capital-zero checks run first: a family whose stash, Political Capital, or Social Capital is `0` at the start of cleanup collapses before any recovery applies. Recovery can slow a slide toward zero but never rescues a seat already at zero.
- A family that has already achieved its objective can no longer collapse; the game ended for them at the moment of victory.
- Uprisings are only risked when happiness is below both the family stash and the safe floor of `50`; a triggered check still has a `1 in 2` chance of collapse. A content public never revolts over a full family vault.
- Recovery then applies to every surviving territory:
  - Production: gain wealth equal to `3` plus `development / 20` (rounded down).
  - Stash trickle: if stash is below `25` and wealth is at least `10`, move `2` wealth into stash.
  - Civic regeneration: if happiness is at least `60`, gain `2` Social Capital and `2` Political Capital; regeneration never raises a capital above `150`.
  - Unrest recovery: if happiness is below `70`, gain `4` happiness.
- Recovery is deliberately smaller than any deliberate attack, so entropy no longer decides games but sustained pressure still does.

## Education And Development

Education and development are long-term investments with political side effects.

- `Educate` costs `8` wealth, adds `10` education and `3` development, and raises governance-change pressure by `2`.
- Client education also raises independence pressure by `2` when the action resolves.
- `Develop` costs `10` wealth, requires access to `Industry` or `Technology`, returns `5` wealth through productivity, adds `10` development, and adds `3` happiness.
- During cleanup, education at `70` or higher raises governance-change pressure when happiness is below `90`.
- During cleanup, client education at `70` or higher raises independence pressure when happiness is at least `100`.
- `Structural Adjustment` drains target education into actor wealth, representing brain drain and institution stripping rather than a simple cash transfer.

## Coercive And Economic Actions

Major actions are balanced around cost, target damage, and political side effects.

- Coercive and extractive actions (`Invade`, `Sanction`, `Coup`, `DebtShakedown`, `EconomicExploitation`, `Protect`, `ProtectionDeal`, `ClientRealignment`, `MakeExample`, `Concession`) cannot target the actor's own territory.
- `Invade` costs wealth and armies, marks the target invaded, damages wealth and happiness, raises fear and governance-change pressure, and increases client defiance. Invading a territory protected by another family costs the invader an extra `5` Political Capital and `5` Social Capital in backlash.
- `Sanction` costs Political Capital, damages target wealth, happiness, and development, and creates governance-change pressure.
- `Protect` costs wealth and stash, marks a protected relationship lasting `2` cleanup rounds, increases target happiness, reduces target fear, and can raise defiance if the target is another family's client. Protection expires when the `protectionDeal` counter reaches `0`.
- `Coup` uses Black Budget, Political Capital comparison, governance-change pressure, factional division, fear, and framing to determine success. A successful coup transfers family control and resets the territory's defiant-majority counter: the new ruling family starts with a fresh grace period. A failed coup rallies the target around the flag: the target gains `5` Political Capital and `4` fear.
- `DebtShakedown` costs Political Capital, converts target wealth into actor wealth, raises target debt, lowers happiness, and creates backlash.
- `EconomicExploitation` costs Social Capital, extracts wealth and stash value, lowers target development and happiness, and creates backlash.

## Defensive Stances

Stances are secret actions that spend your turn on protection instead of progress. They register before any offensive action resolves, regardless of turn order, and last only for the round they are played — so they reward reading your rivals and punish paranoia.

- `CounterIntel` costs `4` Black Budget. Any `Coup` or `CovertInfluence` targeting you this round is foiled before it takes effect: the attacker still pays their costs, is exposed for `8` Social Capital, and you gain `5` Political Capital per foiled operation. Self-targeted Covert Influence is never foiled by the actor's own sweep.
- `Fortify` costs `6` wealth. Invasions against you this round are blunted: happiness damage is halved (rounded up), territory wealth damage is halved, your client defiance does not rise, and the invader gains no Political Capital rally. The invader still pays full costs and backlash.
- A stance spent on a round where nobody attacks you is simply spent — the bluff is the point.

## Crisis Deck

Crisis cards carry both rules metadata and playtest context. The top card of the crisis deck is public knowledge: everyone sees next round's storm coming and can position for it, so crises are strategic weather rather than random punishment.

- `type` groups the crisis, such as defiance event, resource shock, financial crisis, legitimacy scandal, alignment crisis, or global economic pressure.
- `targeting` defines who is affected. Current scopes include `all`, `clients`, `defiantClients`, `resourceNeed`, `resourceHolder`, `highestDebt`, and `highestFactionalDivision`.
- `escalation` is a numeric pressure rating for how dangerous the event should feel in balance passes.
- `era` and `tags` provide context for playtest logs, filtering, and future scenario setup.
- `effect` applies deterministic deltas to territory fields such as wealth, happiness, development, education, debt, defiance, capital tracks, fear, and sentiment.

## Player Cards

Player cards are organized into four categories.

- `spin` cards create narrative cover, Social Capital, or domestic political lift.
- `leverage` cards turn debt, protection, contracts, and institutional pressure into concrete advantage.
- `intelligence` cards use Black Budget, covert files, kompromat, and counterintelligence to shift capital and faction pressure.
- `retaliation` cards punish targets through sanctions, proxies, direct strikes, or legitimacy attacks.

## Content And Balance

The prototype now uses ten playable world regions: `NorthAmerica`, `LatinAmerica`, `WesternEurope`, `EasternEurope`, `NorthAfrica`, `SubSaharanAfrica`, `MiddleEast`, `SouthAsia`, `EastAsia`, and `Oceania`.

- Starting setup fixtures exist for 2, 3, 4, and 5 players in `frontend/data/setups.json`.
- Numeric ranges, action economy, comeback pressure, and client-victory thresholds live in `frontend/data/balance.json`.
- `npm run simulate` runs a deterministic balance harness for repeated sample games and reports per-seat deaths with round and cause.
- When Head wealth reaches `300` or more, cleanup applies comeback pressure: the Head loses `6` Social Capital, the single unhappiest client of the Head family gains `1` defiance and `5` independence sentiment, and every regional family gains `4` Political Capital and `2` rivalry pressure. Emboldening only one client per cleanup keeps the pressure answerable with one response per round.

## Negotiation Hooks

The prototype represents negotiation with explicit action hooks so table deals have rule consequences.

- `TributeHoliday` lets an overlord waive one client tribute payment, lowering defiance at wealth cost.
- `ProtectionDeal` creates a temporary protection relationship and can create realignment pressure when used on another family's client.
- `ClientRealignment` lets a ready client switch `clientOf` to a new patron when defiance, independence sentiment, or realignment pressure is high enough. The target must belong to a different family's hierarchy: an overlord cannot "realign" its own client to launder away defiance.
- `RegionalRivalry` lets one regional family damage another regional family's Political Capital and factional stability.

## Round Timing

Each round uses seven phases:

1. Crisis
2. Tribute
3. Secret Action Submission
4. Reveal
5. Narrative Battle
6. Resolution
7. Cleanup

The current frontend combines reveal, resolution, and cleanup behind the `Reveal & Resolve` control, but the phase model is explicit for BGA state-machine work.

## Tie Breakers

Secret actions resolve deterministically.

- Lower-wealth actors resolve first.
- Ties use role order: Client, then Regional, then Head.
- Remaining ties use action priority, then family id, then original submission order.

## Current Prototype Examples

- `NorthAmerica`: Head Family territory controlled by `USA`.
- `WesternEurope`: Regional Family territory controlled by `EU`.
- `LatinAmerica`: Client Family territory controlled by `Latin Client Coalition`, client of `USA`.
- `EastAsia`: Regional Family territory controlled by `China`.
- `Oceania`: Client Family territory controlled by `Pacific Client Bloc`, client of `USA`.
