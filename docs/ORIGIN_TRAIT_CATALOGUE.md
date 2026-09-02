# Open Fufu — Provisional Origin Trait Catalogue

## Status

This file is the **provisional working catalogue for Origin traits**, not a competing game-design contract.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical migration/implementation authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md). The accepted first Official Origin roster is recorded in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md).

Nothing in this file authorizes gameplay implementation.

Trait names are intentionally left as `X` until the final anime/JRPG-reference naming pass. Temporary IDs (`Pxx` and `Nxx`) exist only so candidates can be discussed unambiguously.

---

## Builder direction

```text
Base Origin Points:       10
Maximum selected traits:   5
Maximum drawback refund:  10
Maximum positive spend:   20
```

Accepted catalogue invariants:

- Official and Custom Origins use the same public catalogue and builder rules.
- No trait tiers, Major/Minor taxonomy, hidden categories, pairwise exclusions, incompatibility families, or runtime vetoes.
- Players select creator-authored traits; they never provide formulas, scripts, or arbitrary numeric parameters.
- Every combination satisfying the public budget, trait-count, and drawback-refund rules must be legal in production.
- Candidate catalogue versions must be exhaustively tested before deployment; a broken legal combination is a catalogue-design failure, not justification for a hidden restriction.
- Origins should prefer playstyle-changing rules, tradeoffs, geography, and structural constraints over generic stat tuning better suited to Echoes.

Unless explicitly marked otherwise in the canonical design, costs/refunds and exact tuning values here remain provisional balance data.

---

## Positive / cost traits

| ID | Name | Effect | Cost |
| --- | --- | --- | ---: |
| P01 | **X** | `+15% Initial Territory` | 7 |
| P02 | **X** | Replace ordinary Population-utilization growth curve with the accepted 30–70% profile | 9 |
| P03 | **X** | Ignore enemy Fort defensive-pressure bonuses | 7 |
| P04 | **X** | Response-side counter-response effectiveness fixed at `1.0`, ignoring normal response-side imbalance bonus/penalty | 3 |
| P05 | **X** | Capturing enemy structures generates military/conquest FFY events | 8 |
| P06 | **X** | `+25% Trade Ship speed` | 5 |
| P07 | **X** | `+25% trains spawned` | 4 |
| P08 | **X** | Wartime trade multiplier becomes `1.0` instead of `0.5` | 4 |
| P09 | **X** | `+10% Fort coverage area, +9% Fort defensive pressure, -8% Fort cost` | 5 |
| P10 | **X** | `+100% warhead projectile speed` | 4 |
| P11 | **X** | SAMs cost `0 FFY`; each 25,000 peak Total Population unlocks one SAM ownership/build slot | 8 |
| P12 | **X** | `+25% Transport Ship speed` | 6 |
| P13 | **X** | Mountains provide `+33% defensive pressure` | 4 |
| P14 | **X** | FFY events located on Desert yield `+33% FFY` | 4 |
| P15 | **X** | `+33% offensive pressure on Highlands` | 4 |
| P16 | **X** | Ignore ordinary Fallout capture resistance | 4 |
| P17 | **X** | Structure upgrade cost multiplier is `0.99^S`, where `S` is currently owned structures | 7 |
| P18 | **X** | `+100% offensive pressure` for engagement lanes whose attacking source cell lies inside a self/fixed-teammate Fort area | 5 |
| P19 | **X** | `+5% offensive pressure` per distinct other faction with current Territorial Contact | 7 |
| P20 | **X** | Start with a free Missile Silo | 7 |
| P21 | **X** | First purchase of each structure consumes `0 FFY`, after ordinary affordability/legality succeeds | 7 |
| P22 | **X** | `+2 maximum Warship rank` | 6 |
| P23 | **X** | Warships `+20% range, +20% damage, +20% speed`, but may own only one | 8 |
| P24 | **X** | FFY events located inside Fort areas yield `+20% FFY` | 7 |
| P25 | **X** | Cannot use Atom Bomb or MIRV; Hydrogen Bomb blast area `+50%`, FFY cost `+50%` | 10 |
| P26 | **X** | May use MIRV at most once; ordinary affordability/legality required, successful MIRV consumes `0 FFY` | 8 |
| P27 | **X** | SAM Launchers may attack ships | 9 |
| P28 | **X** | Destroying Transport Ships steals their carried Population | 9 |
| P29 | **X** | Warships may serve as Missile Silo launch platforms from their current cell | 9 |
| P30 | **X** | Warships `+50% speed`, piracy FFY `3×`, but Warships cannot use naval gunfire against ships; Trade Ship pursuit/capture remains | 6 |
| P31 | **X** | Ports project expanded repair zones; Warships inside receive strong repair without docking and may remain operational | 6 |
| P32 | **X** | Transports may embark only from owned active Ports, but become armored/health-bearing | 6 |
| P33 | **X** | Train stops at an owned City generate `X` Available Population for that City owner, Capacity-capped | 6 |
| P34 | **X** | Factories acquired by conquest operate at `2×` ordinary Factory effect while owned | 6 |
| P35 | **X** | Deliberately relinquished cells become neutral Fallout until next successful capture | 6 |
| P36 | **X** | Neutral settlement costs `0.5 Population/cell` instead of `1`, using faction-level persistent residual accounting | 5 |
| P37 | **X** | Transport embarkation costs `+250 FFY`; each successful amphibious landing grants a permanent level-1 Fort at the landing location | 7 |
| P38 | **X** | When one of your automatically defended cells is captured, its automatic defender survives and remains/returns Available | 10 |
| P39 | **X** | Strategic Spawn uses two influence areas at 50% ordinary area each and two exact origins; final Initial Territory is split between two footprints; Starting Population remains one global pool | 10 |
| P40 | **X** | SAMs become giant single-charge shields: provisionally `+50% range`, exactly one charge at every level, `2×` recharge cooldown | 6 |
| P41 | **X** | Purchased Cities are created directly at level 5 for `95%` of cumulative ordinary level-1 build + level-2–5 upgrade cost | 6 |
| P42 | **X** | Warships cost `0 FFY`; each purchase permanently consumes `2,000 Available Population`; those Warships have `-33% attack range` | 9 |

P33's Population amount remains TBD. P30–P42 numerical costs are especially balance-sensitive, though several underlying mechanics are already accepted in the canonical design.

---

## Negative / refund traits

| ID | Name | Effect | Refund |
| --- | --- | --- | ---: |
| N01 | **X** | Cities contribute `20% less Population Growth` | -4 |
| N02 | **X** | `25% reduced Plains offensive pressure` | -4 |
| N03 | **X** | `33% reduced Desert defensive pressure` | -4 |
| N04 | **X** | FFY events located on Mountain yield `50% less FFY` | -4 |
| N05 | **X** | Cannot capture Fallout terrain | -5 |
| N06 | **X** | Cannot spend FFY to upgrade buildings | -5 |
| N07 | **X** | Cannot own more than one of each building/structure type | -10 |
| N08 | **X** | Forts provide no defensive-pressure bonus | -4 |
| N09 | **X** | Cannot build Factories | -6 |
| N10 | **X** | `25% reduced Fort coverage area` | -4 |
| N11 | **X** | FFY events located inside SAM Launcher area yield `0` | -7 |
| N12 | **X** | Cannot build Warships | -6 |
| N13 | **X** | `50%` of Transport Population dies when landing | -7 |
| N14 | **X** | Lose `(1% of)/X` FFY when a Trade Ship is captured; exact formula TBD | -4 |
| N15 | **X** | `+500 FFY` Transport embarkation cost | -5 |
| N16 | **X** | Successful uncaptured Trade Ship voyages cost the owner their snapshotted voyage value; hostile capture instead returns that value once | -6 |
| N17 | **X** | Enemy structures you would ordinarily capture are destroyed instead of transferred to you | -4 |

---

## Settled semantic decisions

### S1 — Fallout

Fallout is conquerable population-bearing land with explicit capture resistance/speed effects, not phantom defensive Population. P16 ignores that ordinary resistance; N05 prevents capture of Fallout entirely.

### S2 — Desert

Desert is a real V1 terrain/map input even though inherited OpenFront does not yet contain it. Exact baseline Desert values remain tuning work.

### S3 — structure-capture FFY

Ordinary structure capture does not inherently award FFY. P05 creates the alternate rule and uses the captured structure's cell as the located military/conquest FFY event.

### S4 — P17 compounding

```text
upgradeCostMultiplier = 0.99^S
```

No additive negative-cost clamp is required.

### S5 — P18 Fort support

P18 checks the attacking **source cell**. A lane qualifies if that source lies in at least one self/fixed-teammate Fort area. Multiple qualifying Forts do not multiply P18.

### S6 — P19 contact count

P19 counts distinct other factions, not disconnected Contact components. Unless later revised, `other faction` is literal and may include a fixed teammate.

### S7 — P25 blast area

The `+50%` applies to affected Hydrogen Bomb **area**, not radius × 1.5.

### S8 — P11 SAM unlocks

Each full 25,000 of **peak Total Population reached during the match** permanently unlocks one SAM ownership/build slot. Starting Population contributes to initial peak; later Population loss does not revoke slots. P11 is genuinely free in FFY terms; normal affordability is irrelevant once a slot is unlocked and non-FFY legality is satisfied.

### S9 — P04 response-side curve

P04 fixes only response-side counter-response effectiveness at `1.0`. Attack-side effectiveness remains ordinary unless another explicit mechanic changes it.

### S10 — free/grant/purchase semantics

- P20: free starting Silo is a grant, starts at level 1 under current canonical structure rules, and does not consume P21's first-Silo purchase entitlement.
- P21: ordinary affordability/legality is required, but the first successful purchase of each structure type consumes `0 FFY`.
- P26: ordinary MIRV affordability/legality, including a level-5-equivalent launcher, is required; the one permitted MIRV consumes `0 FFY`.
- P11: SAM FFY cost is genuinely zero; Population unlock slots are the limiter.
- P37: landing-created Fort is a grant, not a purchase, so it does not consume a first-Fort-purchase entitlement.

### S11 — spatial FFY-event model

An FFY event may carry an optional location cell when it has a meaningful world-space location. Spatial modifiers inspect that location; genuinely global/non-spatial rewards do not receive spatial modifiers.

Examples include captured-structure cell, rewarding train-station cell, and receiving Trade Ship Port cell. One effect qualifies once even if overlapping multiple areas of the same type; distinct independent modifiers may combine normally.

### S12 — P29 nuclear Warships and launcher choice

P29 adds owned Warships as valid strategic-weapon launch platforms from their current cells. Ordinary costs/restrictions remain unless another rule changes them.

Baseline Open Fufu controller rule: when launch origin matters, the strategic-weapon command identifies the chosen legal launcher. The engine never silently chooses among multiple Silos/Warships.

Under the canonical structure-level rules, a P29 Warship's effective Silo level equals `max(1, Warship rank)`. Ordinary rank-3 Warships may reach Hydrogen legality; P22 can make a rank-5 MIRV-capable Warship possible.

### S13 — P30 pirate conversion

P30 is a role conversion: very fast piracy vessels with `3×` piracy payout, but no naval gunfire against ships. Trade Ship pursuit/capture remains. The intended tradeoff is economic raiding in exchange for conventional naval-combat and Transport-interception capability.

### S14 — N16 trade inversion

Snapshot a deterministic ordinary voyage value at launch.

- successful uncaptured voyage: original owner loses that value instead of receiving ordinary owner-side Trade Ship reward;
- first hostile capture: original owner gains that snapshotted value once;
- captor may still receive ordinary piracy reward;
- destination-side rewards for other factions are not automatically removed.

The drawback can be avoided by declining to invest in trade, which is why its refund is below an unavoidable economy penalty.

### S15 — P31 Port repair

Owned active Ports project a substantially larger repair zone; Warships inside receive strong repair without docking and may continue normal operation. Overlapping Ports do not multiply the same repair effect in one tick.

### S16 — P32 armored Port-launched Transports

The controller must select an owned active Port as the Transport source. Ordinary shoreline/non-Port embarkation is unavailable. The Transport is health-bearing/armored and may survive interception that would destroy a baseline fragile Transport. Exact health/repair interaction remains tuning work.

### S17 — P33 train-stop Population

Any valid train stopping at a City owned by the trait-holder grants that City owner the trait-defined Available Population. Intermediate stops count. Gain is capped so Total Population cannot exceed current Capacity. Exact amount remains TBD.

### S18 — P34 conquered Factories

Only Factories acquired by conquest receive `2×` effect. Built/granted Factories are ordinary. P34 intentionally does not include N09; P34 + N09 is therefore the legal conquest-only industrial build.

### S19 — P35 scorched-earth Fallout

Only **deliberate relinquishment** creates this Fallout; ordinary enemy capture does not. It creates no nuke casualty event. Trait-created Fallout remains while neutral and clears on the next successful capture. Ordinary Fallout resistance applies while neutral unless another rule changes it.

### S20 — N17 conquest spoils destroyed

N17 destroys structures the trait-holder would have captured. It does not destroy the trait-holder's own structures when enemies conquer them. P05/P34 + N17 may be strategically poor but remain legal.

### S21 — P36 half-cost neutral settlement

Baseline neutral settlement costs one Population per successfully acquired population-bearing neutral cell. P36 changes the cost to `0.5` and uses faction-level deterministic residual accounting. Residual debt survives ending/recreating expansion operations and is match/replay state.

### S22 — P37 fortified amphibious landings

Baseline Transport embarkation cost is `0 FFY`. Transport-cost effects are additive. Therefore P37 `+250` plus N15 `+500` yields `750 FFY`.

A Fort appears only after the Transport successfully establishes the landing. Destruction/abort beforehand grants nothing. The Fort is a normal permanent level-1 Fort afterward.

### S23 — P38 elastic defense

On a successful capture of one of the trait-holder's automatically defended population-bearing cells, the one automatic defender survives and remains/returns Available. The winning attacker still loses its ordinary one Population, ownership changes, and Capacity transfers normally.

### S24 — P39 split Strategic Spawn

The faction submits two influence areas, each 50% of ordinary **area** (about 70.71% ordinary radius for circles), then one exact origin in each. Final Initial Territory after modifiers is divided approximately equally between the two footprints. Starting Population remains one global pool; there are no local Population stores. Origins are ordered primary/secondary for deterministic singular start-state grants.

### S25 — P40 giant SAM shield

SAM targeting remains automatic. P40 provisionally gives +50% interception range, exactly one charge regardless of level, and 2× recharge cooldown. Upgrades still improve range but never add charges. No bespoke controller-only interception action exists.

### S26 — P41 fully developed City purchases

Purchased Cities can only be bought directly at level 5 for 95% of cumulative ordinary L1 build + L2–L5 upgrade cost. This is one purchase transaction, not four upgrade spends. Captured lower-level Cities remain at their captured level and may be upgraded normally unless another rule forbids it.

### S27 — P42 Population-funded short-range Warships

P42 changes only the Warship purchase resource and attack range:

- ordinary Warship FFY purchase cost becomes `0`;
- each purchase permanently consumes exactly `2,000 Available Population` under the current provisional tuning;
- the Population is removed from Total Population, not stored as a recoverable crew pool;
- only Available Population may pay the cost; committed offensive/counter/Transport Population is not silently pulled out of active use;
- affected Warships have `-33% attack range`;
- health, damage, speed, veterancy, and all other Warship mechanics remain ordinary unless other explicit modifiers apply.

The range penalty is intentionally severe because inherited-style Warship combat strongly rewards first fire and range control. The expected identity is quantity over quality: many short-ranged ships that should lose ordinary equal-number fights but may overwhelm through numbers.

P29 remains legal with P42. Cheap hull creation does not itself create high-rank nuclear vessels; P29 weapon access still depends on Warship rank/effective Silo level.

Echoes may modify Warship range like any other allowed Echo stat. Origin structural/stat modifiers establish the underlying faction profile and Echo percentages specialize that profile; a range-focused Echo loadout may partially mitigate P42 without making the Origin/Echo combination illegal.

---

## Catalogue coverage decisions

### Starting Population is Echo territory

Simple Starting Population modification is intentionally kept out of the Origin catalogue; it is numerical build tuning and belongs in the V1 Echo modifier pool unless a future Origin changes it structurally.

### Neutral expansion is now covered

P36 provides an Origin-worthy neutral-expansion mechanic by changing Population efficiency rather than adding generic expansion pressure.

### Recon / visibility remains deferred

Do not add information/fog-of-war Origin traits until the Open Fufu visibility model exists and is playable enough to evaluate.

---

## Combination-safety notes

No compatibility matrix is allowed. Deliberately foolish, partially inert, or difficult combinations remain legal if they satisfy the public builder rules.

Examples:

- Warship boons + N12 (`Cannot build Warships`);
- P07/P34 + N09 (`Cannot build Factories`);
- P17 + N06 (`Cannot spend FFY to upgrade buildings`);
- P26 + P25 (MIRV boon plus MIRV prohibition);
- P35 + N05 (creates Fallout the faction itself cannot capture);
- N17 + P05/P34 (destroys the structure before capture-dependent rewards can apply);
- P37 + N15 (Transport cost becomes 750 FFY);
- P41 + N06 (direct L5 City purchase remains one purchase rather than upgrade spending);
- P42 + N12 (Population-funded Warship trait becomes inert because Warships cannot be built).

Potentially strong but valid combinations include:

- P29 + P22 for eventual rank-5/MIRV-capable Warships;
- P29 + P42 for numerous short-range low-rank nuclear-capable hulls;
- P30 + P42 for Population-funded pirate swarms;
- P23 + P42 for one powerful Warship whose purchase resource is Population but whose final stats combine both modifiers;
- P31 + P23 for a single strong Warship supported by forward Port repair zones;
- P32 + P12 for fast armored Port-launched Transports;
- P33 + P07 for increased train traffic feeding City Population;
- P34 + N09 for conquest-only industrialization;
- P35 + P16 for creating and later efficiently reclaiming a Fallout perimeter;
- P38 + P35 for an expensive elastic/scorched defensive doctrine.

The exhaustive deployment gate must prove every builder-legal combination deterministic and engine-safe; these notes never become hidden incompatibilities.

---

## Current first Official Origin roster

The accepted first roster is maintained in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md):

1. O01 — **Last Bastion** (temporary name): extreme Fort/Mountain defense and defender preservation, weak power projection.
2. O02 — **Golden City** (temporary name): concentrated one-of-each infrastructure and trade wealth.
3. O03 — **Rail-Demographic Origin** (temporary name): Population utilization plus train/City circulation.
4. O04 — **Spoils of Empire** (temporary name): conquest FFY and stolen industrial capacity.
5. O05 — **Iron Tide** (temporary name): armored, fast, self-fortifying amphibious invasion without Warships.
6. O06 — **Gemini** (temporary name): two strategic spawn origins/territorial blobs with one global resource pool.
7. O07 — **Corsair State** (temporary name): piracy/trade economy whose Warships are raiders rather than battle-fleet ships.

Their current mechanical builds are the accepted first Official roster; display names are expected to change later.

---

## Next Origin work

The Origin system now has a sufficiently broad first catalogue and seven provisional Official builds. Further Origin work should be driven by playtesting, final anime/JRPG naming, balance/repricing, and exhaustive legal-combination validation rather than continued trait proliferation for its own sake.
