# Open Fufu — Provisional Origin Trait Catalogue

## Status

This file is a **provisional working catalogue**, not a third canonical game-design contract.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical migration/implementation authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

This file exists so Origin traits can be iterated aggressively without bloating the canonical design document with names, values, and content that are explicitly expected to change.

Nothing in this file authorizes gameplay implementation.

Trait names are intentionally left as `X` until the mechanics settle. Temporary IDs (`Pxx` and `Nxx`) exist only so individual candidates can be discussed unambiguously before final anime/JRPG reference names are chosen.

---

## Settled creator direction for this working catalogue

Current builder numbers:

```text
Base Origin Points:       10
Maximum selected traits:   5
Maximum drawback refund:  10
Maximum positive spend:   20
```

The catalogue follows these accepted Origin-system invariants:

- Official and Custom Origins use the same public trait catalogue and the same builder rules.
- No trait tiers.
- No Major/Minor taxonomy.
- No hidden categories, incompatibility families, pairwise exclusions, or runtime combination vetoes.
- Players select only creator-authored traits; they never supply formulas or arbitrary trait parameters.
- Every combination that satisfies the public budget, trait-count, and drawback-refund rules must be legal in production.
- Candidate catalogues must be exhaustively tested before deployment; broken legal combinations are a catalogue-design failure and must be fixed before shipping.
- Origins should prefer playstyle-changing mechanics, tradeoffs, rule transformations, geography interactions, and hard constraints over ordinary generic `+X% to everything` stat bonuses better suited to Echoes.

All costs, refunds, names, and tuning values in this file remain provisional unless/until explicitly canonized.

---

## Positive / cost traits — provisional

| ID | Name | Effect | Cost |
| --- | --- | --- | ---: |
| P01 | **X** | `+15% Initial Territory` | 7 |
| P02 | **X** | Replaces the ordinary Population-utilization growth curve with the 30–70% profile | 9 |
| P03 | **X** | `Ignores enemy Fort defensive-pressure bonuses` | 7 |
| P04 | **X** | `Response-side counter-response effectiveness is fixed at 100% (1.0), ignoring the normal force-imbalance bonus/penalty curve` | 3 |
| P05 | **X** | `Capturing enemy structures generates military/conquest FFY events` | 8 |
| P06 | **X** | `+25% Trade Ship speed` | 5 |
| P07 | **X** | `+25% amount of trains spawned` | 4 |
| P08 | **X** | Ordinary wartime trade multiplier becomes `1.0` instead of `0.5` | 4 |
| P09 | **X** | `+10% Fort coverage area, +9% Fort defensive pressure, -8% Fort cost` | 5 |
| P10 | **X** | `+100% warhead projectile speed` | 4 |
| P11 | **X** | `SAM Launchers cost 0 FFY to build/upgrade; each 25,000 peak Total Population reached unlocks one SAM Launcher slot` | 8 |
| P12 | **X** | `Transport Ships are 25% faster` | 6 |
| P13 | **X** | `Mountains offer 33% increased defensive pressure` | 4 |
| P14 | **X** | `FFY events located on Desert yield +33% FFY` | 4 |
| P15 | **X** | `33% increased offensive pressure on Highlands` | 4 |
| P16 | **X** | `Ignores ordinary Fallout capture resistance` | 4 |
| P17 | **X** | `Structure upgrade FFY cost × 0.99 per owned structure` | 7 |
| P18 | **X** | `+100% offensive pressure for engagement lanes whose attacking source cell lies inside a self/fixed-teammate Fort area` | 5 |
| P19 | **X** | `+5% offensive pressure per distinct other faction with which you currently have at least one Territorial Contact` | 7 |
| P20 | **X** | `Start the game with a free Missile Silo` | 7 |
| P21 | **X** | `First purchase of each structure consumes 0 FFY`* | 7 |
| P22 | **X** | `+2 to maximum Warship rank` | 6 |
| P23 | **X** | `Warships +20% range, +20% damage, +20% speed, but you may only own one` | 8 |
| P24 | **X** | `FFY events located inside Fort areas yield +20% FFY` | 7 |
| P25 | **X** | `Cannot use Atom Bomb or MIRV; Hydrogen Bomb blast area +50% and FFY cost +50%` | 10 |
| P26 | **X** | `You may use MIRV at most once; that MIRV requires ordinary affordability but consumes 0 FFY` | 8 |
| P27 | **X** | `SAM Launchers may attack ships` | 9 |
| P28 | **X** | `Destroying Transport Ships steals their Population` | 9 |
| P29 | **X** | `Warships may serve as Missile Silo launch platforms from their current cell` | 9 |
| P30 | **X** | `Warships move +50% faster and piracy FFY is tripled, but Warships cannot fire on other ships; they may still pursue/capture Trade Ships` | 6 |
| P31 | **X** | `Ports project an expanded repair zone; Warships inside receive strong active repair without docking and may remain operational` | 6 |
| P32 | **X** | `Transport Ships may embark only from owned active Ports, but become armored/health-bearing instead of ordinary fragile Transports` | 6 |
| P33 | **X** | `When a train stops at an owned City, that City owner gains X Available Population` | 6 |
| P34 | **X** | `Factories acquired from another faction by conquest operate at 2× ordinary Factory effect while you own them` | 6 |
| P35 | **X** | `Cells you deliberately relinquish become Fallout while neutral` | 6 |

### Positive-trait notes

* **P21:** the player must still hold at least the ordinary required amount of FFY to satisfy the purchase affordability/legality gate. The successful first **purchase** of each structure consumes `0 FFY`. Starting structures, captured structures, or otherwise granted structures do not consume the first-purchase entitlement because they were not purchased.

P30–P35 costs are especially provisional and exist only to keep the catalogue testable while mechanics are reviewed.

---

## Negative / refund traits — provisional

| ID | Name | Effect | Refund |
| --- | --- | --- | ---: |
| N01 | **X** | `Cities contribute 20% less Population Growth` | -4 |
| N02 | **X** | `25% reduced Plains offensive pressure` | -4 |
| N03 | **X** | `33% reduced Desert defensive pressure` | -4 |
| N04 | **X** | `FFY events located on Mountain yield 50% less FFY` | -4 |
| N05 | **X** | `Cannot capture Fallout terrain` | -5 |
| N06 | **X** | `Cannot spend FFY to upgrade buildings` | -5 |
| N07 | **X** | `Cannot own more than 1 of each building` | -10 |
| N08 | **X** | `Forts provide no defensive-pressure bonus` | -4 |
| N09 | **X** | `Cannot build Factories` | -6 |
| N10 | **X** | `25% reduced Fort coverage area` | -4 |
| N11 | **X** | `FFY events located inside SAM Launcher area yield 0 FFY` | -7 |
| N12 | **X** | `Cannot build Warships` | -6 |
| N13 | **X** | `50% of Transport Ship Population dies when landing` | -7 |
| N14 | **X** | `Lose (1% of)/X FFY when a Trade Ship gets captured`* | -4 |
| N15 | **X** | `Transport Ships cost 500 FFY` | -5 |
| N16 | **X** | `Your Trade Ships lose FFY on successful uncaptured voyages; if one is captured by another faction, you instead regain its snapshotted voyage value once` | -6 |
| N17 | **X** | `Enemy structures you would normally capture are destroyed instead of transferred to you` | -4 |

### Negative-trait notes

* **N14:** exact value/formula TBD.

N16/N17 refunds are provisional.

---

## Settled semantic decisions from catalogue review

### S1 — Fallout terminology

Open Fufu's nuclear model does **not** treat Fallout as phantom defensive Population/pressure. Fallout remains conquerable population-bearing land with explicit capture resistance/speed effects.

Therefore P16 ignores ordinary **Fallout capture resistance**, and N05 is a hard inability to capture Fallout terrain.

### S2 — Desert is a V1 terrain

Open Fufu V1 will include **Desert** as a real terrain type/map input. The inherited OpenFront enum does not contain it yet, so P14/N03 are implementation-blocked until the V1 terrain pipeline is extended, but they are not speculative future-only traits.

Exact baseline Desert mechanics/values remain separate tuning work.

### S3 — enemy-structure capture FFY baseline

Ordinary enemy-structure capture does **not** inherently award FFY merely because the structure changed hands.

P05 creates the alternate Origin rule: capturing an enemy structure generates a military/conquest FFY event. Exact payout remains tuning data.

### S4 — P17 uses safe multiplicative compounding

If `S` is the number of currently owned structures, P17 uses:

```text
upgradeCostMultiplier = 0.99^S
```

This naturally diminishes without requiring a hidden zero/negative-cost clamp.

### S5 — P18 is source-cell Fort support

P18 applies to an engagement lane when its **attacking source cell** lies inside at least one Fort area belonging to the faction or a fixed teammate. Overlapping qualifying Forts do not multiply the P18 bonus.

### S6 — P19 counts distinct factions

P19 counts distinct other factions with which the faction currently has at least one Territorial Contact. Multiple disconnected Contact components with the same faction count only once.

Unless later revised, "other faction" is literal and may include a fixed teammate as well as an opponent.

### S7 — P25 modifies literal blast area

P25's `+50%` refers to **affected Hydrogen Bomb blast area**, not `radius × 1.5`. The implementation derives the versioned geometry/radius needed to produce the intended area increase.

### S8 — P11 uses peak Total Population as a permanent unlock track

Each full `25,000` of **peak Total Population reached during the match** unlocks one SAM Launcher ownership/build slot. Population falling later does not revoke slots or destroy existing SAMs. Starting Population contributes immediately to the initial peak.

P11 is genuinely free: if a slot is unlocked and non-FFY build legality is satisfied, build/upgrade cost is `0 FFY` and ordinary SAM affordability is irrelevant.

### S9 — P04 fixes only response-side effectiveness

Under P04, the **response-side effectiveness multiplier is always exactly `1.0`**. It loses both the normal response-side bonus when overmatching and the normal penalty when understrength. Attack-side effectiveness remains ordinary unless another rule changes it.

### S10 — free/granted/purchase semantics

- **P20:** the starting Missile Silo is genuinely free and does not consume P21's first-Silo purchase entitlement.
- **P21:** ordinary affordability is required, but the first purchased instance of each structure type consumes `0 FFY`.
- **P26:** ordinary MIRV affordability/legality is required, but the one permitted MIRV consumes `0 FFY`.
- **P11:** SAMs are genuinely `0 FFY`; the peak-Population unlock track is the limiter.

### S11 — common spatial FFY-event model

An FFY-generating event may carry an optional **location cell** when it has a meaningful world-space origin/destination. Spatial Origin/Echo/ruleset modifiers inspect that location. Non-spatial rewards have no location and receive no spatial modifier.

Examples:

- structure-capture FFY uses the captured structure cell;
- train-arrival/stop FFY uses the rewarding station cell;
- Trade Ship arrival FFY uses the receiving Port cell.

For one trait/effect, overlapping qualifying areas do not multiply the same modifier. Distinct independent spatial modifiers may still combine through the published modifier-composition rules.

### S12 — P29 makes Warships nuclear launch platforms

P29 makes each owned Warship a valid nuclear launch platform from its **current cell**. Ordinary weapon costs/restrictions remain in force unless another explicit trait changes them. Each Warship has its own Missile-Silo-style launch cooldown/reload state. A P29 Warship is not a structure for unrelated rules.

**Baseline controller rule:** strategic-weapon commands must identify/select the legal launcher when launch origin matters. Ordinary Missile Silos are selectable launchers for every faction; P29 adds Warships to that launcher set. The engine must not arbitrarily choose among multiple Silos/Warships.

### S13 — P30 pirate-Warship conversion

P30 is a role conversion rather than a generic naval buff:

- Warship movement speed is `+50%`;
- piracy FFY is `+200%` versus baseline, i.e. `3×` the ordinary piracy payout;
- Warships cannot use naval gunfire against Warships, Transport Ships, or other ship targets;
- they may still pursue and capture Trade Ships through the ordinary piracy/capture mechanic.

The intended tradeoff is extreme piracy mobility/economy in exchange for giving up ordinary naval combat and Transport interception.

### S14 — N16 inverts the owner's Trade Ship economy

For each of the faction's Trade Ships, snapshot a deterministic **ordinary voyage value** at launch from its intended route/rules.

- If the ship completes its voyage without hostile capture, its original owner loses that snapshotted FFY value instead of receiving the ordinary owner-side Trade Ship reward.
- If the ship is first captured by another faction, the original owner gains that snapshotted value once.
- The captor may still earn ordinary piracy reward under the normal captured-ship rules.
- Other factions' ordinary destination-side rewards are not automatically removed merely because the originating faction has N16.

This drawback can be strategically avoided by refusing to invest in Ports/trade, which is why its refund should remain below a truly unavoidable economy penalty.

### S15 — P31 turns Port repair into a forward repair zone

Baseline Warships already have modest passive repair near owned Ports and stronger docked repair. P31 intentionally changes the role of that area:

- each owned active Port projects a substantially larger repair zone;
- Warships inside it receive strong active repair without entering the docked state;
- a Warship may continue normal movement/combat behavior while benefiting;
- multiple overlapping Ports do not multiply the same Warship's repair rate in one tick.

Exact repair radius/rate remain tuning data.

### S16 — P32 creates armored Port-launched Transports

P32 changes both Transport deployment and durability:

- Transport Ships may embark only from an explicitly selected owned active Port with legal water access;
- ordinary shoreline/non-Port embarkation is unavailable;
- the Transport becomes health-bearing/armored and therefore can survive ordinary interception that would destroy a baseline fragile Transport;
- exact health, armor/damage interaction, and repair behavior remain tuning/mechanics work.

The controller must be able to choose the source Port when several legal embarkation Ports exist.

### S17 — P33 creates Population at City train stops

When any valid train stops at a City owned by the trait-holder, that City owner gains a provisional `X` **Available Population**.

- Intermediate City stops count, not only final destinations.
- The gain belongs to the City owner, regardless of who owns the train, unless later balance testing requires narrowing it.
- Direct Population gain cannot raise Total Population above current Capacity.
- Exact Population amount remains TBD.

### S18 — P34 rewards conquered Factories without duplicating N09

A Factory **acquired by conquest from another faction** operates at `2×` the ordinary Factory effect while owned by the trait-holder. Factories the faction builds or receives without conquest operate normally.

P34 deliberately does **not** include `Cannot build Factories`, because N09 already supplies that drawback. Combining P34 + N09 is therefore the legal conquest-only industrial build: the player cannot build Factories, but any Factory successfully conquered is unusually valuable.

The exact meaning of `2× Factory effect` follows the final Open Fufu Factory/rail translation and must be published explicitly before deployment.

### S19 — P35 creates a programmable scorched-earth Fallout perimeter

When the trait-holder **deliberately relinquishes** an owned cell through the controller's relinquishment action, that cell becomes neutral Fallout rather than ordinary neutral terrain.

Provisional anti-abuse semantics:

- this trait-generated Fallout applies only to deliberate relinquishment, never ordinary enemy capture;
- the act itself does not create nuke casualties or pretend a nuclear strike occurred;
- trait-generated Fallout remains while the cell is neutral and **clears on the next successful capture** of that cell;
- ordinary Fallout capture resistance applies while neutral unless another rule such as P16 changes it.

The clear-on-capture rule is provisional but prevents permanent map painting while preserving the intended high-skill 1–2-cell scorched perimeter strategy.

### S20 — N17 destroys conquest spoils

When the trait-holder captures enemy territory containing a structure that would ordinarily transfer ownership, that structure is destroyed instead.

This is a drawback on **the trait-holder's ability to acquire enemy structures**, not a defensive benefit that destroys the trait-holder's structures when enemies capture them.

It intentionally makes combinations such as N17 + P05/P34 strategically poor but still legal and mechanically safe.

---

## Catalogue coverage decisions / deliberately deferred areas

### Starting Population belongs primarily to Echoes

A simple increase to starting Population is intentionally **not** being added as an Origin trait at this stage. It is straightforward numerical power and is better suited to Echoes unless a future Origin changes opening Population through a more structural rule.

### Neutral expansion still needs an Origin-worthy rule

Neutral expansion is a real remaining catalogue gap, but do not fill it with a boring generic `+X% neutral expansion pressure` trait merely for symmetry. Keep it open until there is a worthwhile rule-changing mechanic.

### Recon / visibility is deferred until the Open Fufu visibility model is testable

OpenFront is broadly visible and Open Fufu's operational visibility/fog-of-war behavior is not yet implemented/tested enough to design good information-oriented Origin traits. Revisit after the visibility system can be played and inspected.

---

## Combination-safety notes

No compatibility matrix is allowed. Deliberately foolish or partially inert combinations remain legal if they satisfy the public builder rules.

Examples include:

- P22/P23/P29/P30 + N12 (`Cannot build Warships`);
- P07/P34 + N09 (`Cannot build Factories`);
- P17 + N06 (`Cannot spend FFY to upgrade buildings`);
- P26 + P25 (MIRV boon plus MIRV prohibition);
- P35 + N05 (creating Fallout that the faction itself cannot capture);
- P33 + N09 where fewer/no player-built Factories may make train traffic harder to establish;
- N17 + P05/P34, where structures are destroyed before those capture-dependent boons can benefit.

Important potentially strong but valid combinations include:

- **P30 + P29:** fast pirate Warships that cannot contest ships with gunfire but can act as mobile nuclear launchers;
- **P31 + P23:** one unusually powerful Warship supported by forward Port repair zones;
- **P32 + P12:** fast armored Port-launched Transports;
- **P33 + P07:** more train activity feeding City Population replenishment;
- **P34 + N09:** conquest-only industrialization;
- **P35 + P16:** a faction highly capable of creating and then later reclaiming a scorched Fallout perimeter.

The exhaustive deployment test must prove all builder-legal combinations deterministic and engine-safe; it must not turn these observations into hidden incompatibility rules.

---

## Upstream feasibility notes

These notes are implementation evidence only and do not make inherited mechanics authoritative for Open Fufu.

### Port repair zones

Current `WarshipExecution` already checks whether a Warship lies within `warshipPassiveHealingRange()` of an owned Port and grants passive repair there; docked ships receive separate active repair. P31 therefore extends an existing Port-repair seam rather than inventing a new spatial system.

### Transport embarkation / armor

Current Transport execution resolves a source tile before constructing a real Transport unit carrying its Population payload. P32 can replace ordinary shoreline source resolution with explicit owned-Port legality and add health/armor to that real unit without changing the fundamental transport-accounting model.

### Train stop Population

Current train execution calls the station stop handler at each station reached, including intermediate stops. City/Port stops already have typed economic handling at the station cell. P33 can attach Population gain to the same City-stop event.

### Trade inversion / piracy

Current Trade Ship execution already tracks original owner, capture state, route travel and piracy payout separately from normal arrival payout. N16 and P30 therefore have natural hooks, though Open Fufu should define a versioned route-value snapshot rather than depending accidentally on inherited late-route arithmetic.

### Factory conquest bonus

Current Factories create rail-station behavior and drive train spawning through Factory station execution. P34 has a natural rule hook, but `2× Factory effect` must be translated to whatever final Factory mechanics Open Fufu actually retains.

### SAM attacks against ships

For P27, extract/reuse Warship naval target-selection/gunnery behavior from the current Warship implementation rather than literally spawning a hidden Warship unit inside the SAM.

### Warships as nuclear launchers

Current nuke execution already supports an explicit source cell, so P29 can launch from the selected Warship's current cell while reusing ordinary strategic-weapon trajectory/interception behavior.

---

## Next catalogue work

Before creating Official Origins or anime-reference trait names:

1. continue the mechanic-coverage audit and look for any remaining important systems with no interesting Origin expression;
2. invent an Origin-worthy neutral-expansion mechanic or consciously leave that family empty;
3. revisit visibility/recon only after the fog-of-war model is playable;
4. review all candidates for effects that are too Echo-like, redundant, disproportionately exploitable, or too dependent on rare map conditions;
5. polish final player-facing wording as mechanics stabilize;
6. then assign anime/JRPG reference names;
7. only after that build the first Official Origins from this same catalogue;
8. before deployment, exhaustively enumerate every builder-legal combination under the final catalogue and builder rules.
