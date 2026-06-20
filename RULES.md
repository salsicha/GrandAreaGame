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
- Covert Influence costs `6` Black Budget, raises target defiance by `1`, and gives the actor political capital.
- Black Budget reaching `0` is not an immediate loss condition; it limits covert options.

## Defiance Contagion

Clients can spread defiance pressure to nearby or politically related clients.

- A client emits contagion when happiness crosses `120`, defiance reaches `3`, or the client wins through the defiant good-example path.
- Contagion targets clients with the same `clientOf` relationship or an adjacent `neighbors` relationship.
- Each affected target gains `1` defiance.

## Example Response

Defiant clients require a response.

- `MakeExample` targets a defiant client, resets defiance to `0`, lowers target happiness by `20`, costs the actor `10` Social Capital, and gives the actor `5` Political Capital.
- `Concession` targets a defiant client, resets defiance to `0`, raises target happiness by `10`, costs the actor `10` wealth and `5` Political Capital, and gives the actor `5` Social Capital.
- Any defiant client left unanswered costs its overlord `5` Social Capital and `5` Political Capital during resolution.

## Resources

Resources are constraints, not just labels.

- Territories use their own `resources` plus resources from compliant clients they control.
- Missing each required resource costs `5` wealth, `2` development, and `2` happiness during cleanup.
- Missing `Oil` adds extra wealth loss equal to the territory's `armies`.
- Global austerity is harsher for territories missing `Grain` or `Finance`.

## Sentiment

Sentiment tracks political pressure inside a territory.

- Client defiance and high happiness increase `independenceSentiment`.
- Low happiness and excess family stash increase `governanceChangeSentiment`.
- Educated happy clients increase `independenceSentiment`; educated unhappy territories increase `governanceChangeSentiment`.
- `fear` suppresses governance-change growth.
- Coup odds increase with target `governanceChangeSentiment` and `factionalDivision`, and decrease with target `fear`.

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

- `Invade` costs wealth and armies, marks the target invaded, damages wealth and happiness, raises fear and governance-change pressure, and increases client defiance.
- `Sanction` costs Political Capital, damages target wealth, happiness, and development, and creates governance-change pressure.
- `Protect` costs wealth and stash, marks a protected relationship, increases target happiness, reduces target fear, and can raise defiance if the target is another family's client.
- `Coup` uses Black Budget, Political Capital comparison, governance-change pressure, factional division, fear, and framing to determine success.
- `DebtShakedown` costs Political Capital, converts target wealth into actor wealth, raises target debt, lowers happiness, and creates backlash.
- `EconomicExploitation` costs Social Capital, extracts wealth and stash value, lowers target development and happiness, and creates backlash.

## Crisis Deck

Crisis cards carry both rules metadata and playtest context.

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
- `npm run simulate` runs a deterministic balance harness for repeated sample games.
- When Head wealth reaches runaway levels, cleanup applies comeback pressure by reducing Head Social Capital, increasing direct-client defiance, and giving regional families rivalry momentum.

## Negotiation Hooks

The prototype represents negotiation with explicit action hooks so table deals have rule consequences.

- `TributeHoliday` lets an overlord waive one client tribute payment, lowering defiance at wealth cost.
- `ProtectionDeal` creates a temporary protection relationship and can create realignment pressure when used on another family's client.
- `ClientRealignment` lets a ready client switch `clientOf` to a new patron when defiance, independence sentiment, or realignment pressure is high enough.
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
