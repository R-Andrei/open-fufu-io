# Open Fufu — Provisional Origin Trait Catalogue

## Status

This file is the **provisional working catalogue for Origin traits**, not a competing game-design contract.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical migration/implementation authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md). The accepted first Official Origin roster is recorded in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md). Concrete terrain/structure/Tank data is recorded in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md). Detailed FFY economy semantics are recorded in [`FFY_ECONOMY.md`](./FFY_ECONOMY.md). Echo identity/acquisition/reward semantics are recorded in [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md). Detailed Strategic Spawn geometry is recorded in [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md). Detailed Warship/Transport/strategic-weapon values are recorded in [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md). Minor-Faction semantics are recorded in [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md).

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
| P07 | **X** | `+25% trains spawned`: every fourth normal primary Train dispatch from each Factory simultaneously launches one additional bonus Train | 4 |
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
| P19 | **X** | `+5% offensive pressure` per distinct currently active other faction with current Territorial Contact, including Minor Factions | 8 |
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
| P31 | **X** | Warships inside owned active Port repair fields receive `2×` ordinary Port repair radius and `1.5×` ordinary Port repair rate; they may remain operational while receiving it | 6 |
| P32 | **X** | Transports may embark only from owned active Ports, but become armored/health-bearing with `500 HP` | 6 |
| P33 | **X** | Every Train-triggered economic event at an owned City also grants `20 × completed City level` Available Population to that City owner, Capacity-capped | 6 |
| P34 | **X** | Factories acquired by conquest operate at `2×` ordinary Factory effect while owned | 6 |
| P35 | **X** | Deliberately relinquished cells become neutral Fallout until next successful capture | 6 |
| P36 | **X** | Neutral settlement costs `0.5 Population/cell` instead of `1`, using faction-level persistent residual accounting | 5 |
| P37 | **X** | Transport embarkation costs `+250 FFY`; each successful amphibious landing grants a permanent level-1 Fort at the landing location | 7 |
| P38 | **X** | When one of your automatically defended cells is captured, its automatic defender survives and remains/returns Available | 10 |
| P39 | **X** | Strategic Spawn uses two influence areas at 50% ordinary area each and two exact origins; final Initial Territory is split between two footprints; Starting Population remains one global pool | 10 |
| P40 | **X** | SAMs become giant single-charge shields: provisionally `+50% range`, exactly one charge at every level, `2×` recharge cooldown | 6 |
| P41 | **X** | Purchased Cities are created directly at level 5 for `95%` of cumulative ordinary level-1 build + level-2–5 upgrade cost | 6 |
| P42 | **X** | Warships cost `0 FFY`; each purchase permanently consumes `2,000 Available Population`; those Warships have `-33% attack range` | 9 |
| P43 | **X** | **Heavy Artillery:** all Tanks transform into Heavy Artillery: `10s` build time, `1.5×` purchase cost, `0.5×` movement, `1.5×` weapon range, `1,000` anti-armor damage / `12s`, `1,000` Population damage / `12s`, Train raiding disabled; same Tank terrain barriers; projectiles may cross terrain the unit cannot traverse | 8 |
| P44 | **X** | **Radioactive Munitions:** successful Tank/Heavy-Artillery Population attacks neutralize enemy population-bearing cells and apply Fallout; Tank affects up to `10` cells in Manhattan radius 2, Heavy Artillery up to `50` cells in Manhattan radius 5 | 9 |
| P45 | **X** | **Forest concealment:** enemy tactical observation cannot penetrate the interior of Forest cells owned by this faction; exposed Forest-front boundary cells remain observable and hostile manifestations reveal only the minimum directly relevant attacking state | 6 |
| P46 | **X** | May construct persistent structures on owned **Tundra**; Tundra otherwise retains its ordinary `0 Capacity`, spawn-ineligible, terrain-combat, acquisition, and movement rules | 4 |
| P47 | **X** | Whenever an enemy successfully captures one of this faction's **Marsh** cells, the capturing faction loses `+1 Population` after ordinary capture resolution | 4 |
| P48 | **X** | Owned **Shallow Water** is population-bearing for this faction and contributes `+1 Population Capacity/cell`; all other Shallow-Water terrain/traversal/buildability rules remain unchanged | 4 |
| P49 | **X** | **Counterintelligence Observation Posts:** owned Observation Posts no longer provide tactical observation; instead their ordinary completed-level radius becomes an enemy-intelligence blackout area that conceals this faction's units, structures, and manifested operational state inside it | 7 |
| P50 | **X** | **Fort general support:** Forts also project offensive pressure equal to their normal defensive-pressure magnitude across their existing Fort coverage area | 5 |
| P51 | **X** | **Command general support:** Command Posts also project defensive pressure equal to their normal offensive-pressure magnitude across their existing Command Post coverage area | 5 |
| P52 | **X** | **Underpopulation economy:** gain additional passive FFY at `max(0, Population Capacity - Total Population) / 250` FFY per second | 6 |
| P53 | **X** | **Strategic-stockpile economy:** gain `2,000 FFY/s` per ready launch charge on owned active persistent Missile Silo structures; P29 Warship launch capability does not count | 8 |
| P54 | **X** | **Star start:** each generated Initial-Territory footprint uses the accepted thin five-point `6:1` star geometry instead of the ordinary compact circular profile; final Initial Territory and Starting Population are unchanged | 5 |

P30–P54 numerical costs remain especially balance-sensitive, though the underlying mechanics are accepted as the provisional V1 catalogue baseline. P33's `20 × City level`, P52's `/250` empty-Capacity coefficient, P53's `2,000 FFY/s per ready Silo charge`, and P54's five-point `6:1` geometry are explicitly provisional balance/geometry data to benchmark before V1 release rather than unresolved mechanics.

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
| N14 | **X** | When one of your Trade Ships is first captured by a hostile faction, lose FFY equal to that voyage's snapshotted ordinary owner-side success value | -4 |
| N15 | **X** | `+500 FFY` Transport embarkation cost | -5 |
| N16 | **X** | Successful uncaptured Trade Ship voyages cost the owner their snapshotted voyage value; hostile capture instead returns that value once | -6 |
| N17 | **X** | Enemy structures you would ordinarily capture are destroyed instead of transferred to you | -4 |
| N18 | **X** | Final capture/settlement progress against **non-Fallout** target cells is multiplied by `0.50`; Fallout targets are exempt from this drawback | -8 |

---

## Settled semantic decisions

### S1 — Fallout

Fallout is a persistent overlay/state on legal conquerable terrain, not phantom defensive Population and not a replacement base terrain. Population-bearing/Capacity classification follows the underlying terrain. Ordinary Fallout applies the canonical acquisition-resistance/speed effect. P16 ignores that ordinary resistance; N05 prevents capture of Fallout entirely.

A mechanic may explicitly neutralize owned land and apply Fallout. In that case Capacity is lost because the cell becomes neutral, not because the Fallout overlay itself removes Capacity.

### S2 — Desert

Desert is a real V1 terrain/map input. Its accepted provisional baseline is recorded in `TERRAIN_AND_STRUCTURES.md`: 90% capture/settlement speed and faction-wide `+6% × Desert share` all-FFY event yield, before explicit modifiers such as P14.

### S3 — structure-capture FFY

Ordinary structure capture does not inherently award FFY. P05 creates the alternate rule and uses the captured structure's cell as the located military/conquest FFY event. Its provisional base payout is `10%` of the captured structure's canonical cumulative completed-level FFY value as specified in `FFY_ECONOMY.md`.

### S4 — P17 compounding

```text
upgradeCostMultiplier = 0.99^S
```

No additive negative-cost clamp is required.

### S5 — P18 Fort support

P18 checks the attacking **source cell**. A lane qualifies if that source lies in at least one self/fixed-teammate Fort area. Multiple qualifying Forts do not multiply P18.

### S6 — P19 current contact count

P19 counts **distinct currently active other factions with current Territorial Contact**, not disconnected Contact components and not historical contacts.

A faction stops contributing when the Territorial Contact disappears or that actor is no longer an active territorial faction. If contact later reappears while the actor is active, it contributes again.

`Other faction` remains literal and may include a fixed teammate. It also explicitly includes an active **Minor Faction** from `MINOR_FACTIONS.md`. One Minor Faction counts once regardless of how many disconnected contact components exist.

The possibility of very large early-game P19 bonuses from simultaneously contacting many Minor Factions is intentional. The catalogue cost is therefore provisionally **8 points** rather than 7, while the bonus remains allowed to decay naturally as Minor Factions disappear and active contact count falls.

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

Examples include captured-structure cell, rewarding Train-station cell, and receiving Trade Ship Port cell. One effect qualifies once even if overlapping multiple areas of the same type; distinct independent modifiers may combine normally.

The ordinary universal passive FFY floor and P52/P53 passive-origin sources are non-spatial and therefore cannot inherit Desert/Fort/SAM/location modifiers merely because the faction happens to own such geography.

### S12 — P29 nuclear Warships and launcher choice

P29 adds owned Warships as valid strategic-weapon launch platforms from their current cells. Ordinary costs/restrictions remain unless another rule changes them.

Baseline Open Fufu controller rule: when launch origin matters, the strategic-weapon command identifies the chosen legal launcher. The engine never silently chooses among multiple Silos/Warships.

Under the canonical Warship-rank rules in `NAVAL_AND_STRATEGIC_WEAPONS.md`, a P29 Warship's effective Silo level equals `max(1, Warship rank)`. Ordinary rank-3 Warships may reach Hydrogen legality; P22 can make a rank-5 MIRV-capable Warship possible.

### S13 — P30 pirate conversion

P30 is a role conversion: very fast piracy vessels with `3×` piracy payout, but no naval gunfire against ships. Trade Ship pursuit/capture remains. The intended tradeoff is economic raiding in exchange for conventional naval-combat and Transport-interception capability.

Captured Trade cargo must be physically delivered before piracy pays, as specified in `FFY_ECONOMY.md`.

### S14 — snapshotted Trade-voyage value; N14 and N16

Every Trade Ship voyage has one deterministic **ordinary owner-side success value** snapshotted at launch. Effects that refer to the economic value of that voyage use this same snapshot rather than recomputing value from later rerouting, capture, or distance traveled after launch.

For N14:

- a successful uncaptured voyage remains ordinary;
- on the **first hostile capture** of that voyage, subtract exactly the snapshotted owner-side success value from the original owner's current FFY balance;
- later recaptures/transfers of the same ship do not trigger N14 again;
- captor-side piracy/capture rewards remain governed by their ordinary rules unless another effect changes them.

For N16:

- successful uncaptured voyage: original owner loses that same snapshotted value instead of receiving the ordinary owner-side Trade Ship reward;
- first hostile capture: original owner gains that snapshotted value once;
- captor may still receive ordinary piracy reward.

If N14 and N16 are selected together, their original-owner first-capture effects cancel (`-V + V = 0`) without a special-case incompatibility. An uncaptured voyage still follows N16 and costs the owner `V`.

These trade drawbacks can be avoided by declining to invest in trade, which is why their refunds may remain below comparable unavoidable economy penalties.

### S15 — P31 Port repair

P31 is now numerically pinned rather than described as an open-ended “strong repair” effect.

For **Warships** receiving repair from an owned active Port:

```text
P31 repair radius = ordinary completed-level Port repair radius × 2.0
P31 repair rate   = ordinary completed-level Port repair rate × 1.5
```

Using the canonical Port baseline, this yields:

| Port level | P31 Warship repair radius | P31 Warship repair rate |
| ---: | ---: | ---: |
| L1 | **40** | **75 HP/s** |
| L2 | **50** | **93.75 HP/s** |
| L3 | **60** | **112.5 HP/s** |
| L4 | **70** | **131.25 HP/s** |
| L5 | **80** | **150 HP/s** |

Warships may continue ordinary movement/combat while receiving P31 repair. Same-type overlapping Ports still do not stack repair rates on one Warship; use the strongest applicable Port effect.

P31 does not silently turn every health-bearing naval unit into a P31 Warship. P32 armored Transports continue to receive ordinary eligible Port repair unless another explicit mechanic says otherwise.

### S16 — P32 armored Port-launched Transports

The controller must select an owned active Port as the Transport source. Ordinary shoreline/non-Port embarkation is unavailable.

The Transport has **500 HP** under the accepted provisional V1 baseline and is therefore health-bearing/armored rather than a fragile one-hit baseline Transport. Under an unmodified 250-damage Warship shell, a fresh P32 Transport requires two successful shells to destroy.

Because it is health-bearing, an owned P32 Transport may receive ordinary eligible Port repair. P32 + P12 remains legal and produces a 500-HP Port-only Transport moving at 12.5 cells/s before other modifiers.

### S17 — P33 train-stop Population

P33 attaches Population generation to the same physical City events produced by the canonical Train system. Whenever a Train reaches/passes through a City owned by the P33 trait-holder and that pass triggers the ordinary City Train economic event, the City owner also gains:

```text
P33PopulationGain = 20 × completedCityLevel
```

Therefore the provisional L1→L5 gain is exactly:

```text
20 / 40 / 60 / 80 / 100 Available Population
```

The gain is Capacity-capped and enters Available Population. The route planner's normal target count does **not** cap P33 events: incidental City passes count, and if a finite service route physically reaches the same City more than once, each qualifying pass/event triggers P33 again. A Train passing a Port does not trigger P33 because the trait is City-specific.

The coefficient is intentionally balance-sensitive. Before V1 release, accelerated simulations should compare optimized rail-demographic builds against strong ordinary Population-growth builds across representative map/geography/economy states. Hyper-optimized rail being meaningfully better is acceptable; only pathological or game-breaking throughput is a reason to nerf the mechanic.

### S18 — P34 conquered Factories

Only Factories acquired by conquest receive `2×` effect. Built/granted Factories are ordinary. P34 intentionally does not include N09; P34 + N09 is therefore the legal conquest-only industrial build.

For ordinary Train FFY, `2× Factory effect` multiplies the conquered Factory's current level-specific Train-event base value from `FFY_ECONOMY.md`.

### S19 — P35 scorched-earth Fallout

Only **deliberate relinquishment** creates this Fallout; ordinary enemy capture does not. It creates no nuke casualty event. Trait-created Fallout remains while neutral and clears on the next successful capture. Ordinary Fallout resistance applies while neutral unless another rule changes it.

### S20 — N17 conquest spoils destroyed

N17 destroys structures the trait-holder would have captured. It does not destroy the trait-holder's own structures when enemies conquer them. P05/P34 + N17 may be strategically poor but remain legal.

### S21 — P36 half-cost neutral settlement

Baseline neutral settlement costs one Population per successfully acquired population-bearing neutral cell. P36 changes the cost to `0.5` and uses faction-level deterministic residual accounting. Residual debt survives ending/recreating expansion operations and is match/replay state.

P36 changes **Population cost**, not acquisition speed. It therefore composes independently with N18's non-Fallout progress multiplier.

### S22 — P37 fortified amphibious landings

Baseline Transport embarkation cost is `0 FFY`. Transport-cost effects are additive. Therefore P37 `+250` plus N15 `+500` yields `750 FFY`.

A Fort appears only after the Transport successfully establishes the landing. Destruction/abort beforehand grants nothing. The Fort is a normal permanent level-1 Fort afterward.

### S23 — P38 elastic defense

On a successful capture of one of the trait-holder's automatically defended population-bearing cells, the one automatic defender survives and remains/returns Available. The winning attacker still loses its ordinary one Population, ownership changes, and Capacity transfers normally.

### S24 — P39 split Strategic Spawn

The faction submits two influence areas, each 50% of ordinary **area**, then one exact origin in each. Under the accepted ordinary 400-cell circular influence radius, each split region uses `dx² + dy² <= 80,000`, equivalent to about **282.84 cells radius**.

Final Initial Territory after modifiers is divided approximately equally between the two footprints. Starting Population remains one global pool; there are no local Population stores. Origins are ordered primary/secondary for deterministic singular start-state grants.

Exact-origin spacing/fallback and footprint construction are defined in `STRATEGIC_SPAWN.md`. P39 + P54 is legal: each split quota uses P54 star geometry rather than duplicating the full Initial-Territory quota.

### S25 — P40 giant SAM shield

SAM targeting remains automatic. P40 provisionally gives +50% interception range, exactly one charge regardless of level, and 2× recharge cooldown. Upgrades still improve range but never add charges. No bespoke controller-only interception action exists.

### S26 — P41 fully developed City purchases

Purchased Cities can only be bought directly at level 5 for 95% of cumulative ordinary L1 build + L2–L5 upgrade cost. Under the current canonical City prices this is `0.95 × 2.10m = 1.995m FFY`. This is one purchase transaction, not four upgrade spends. Captured lower-level Cities remain at their captured level and may be upgraded normally unless another rule forbids it.

### S27 — P42 Population-funded short-range Warships

P42 changes only the Warship purchase resource and attack range:

- ordinary Warship FFY purchase cost becomes `0`;
- each purchase permanently consumes exactly `2,000 Available Population` under the current provisional tuning;
- the Population is removed from Total Population, not stored as a recoverable crew pool;
- only Available Population may pay the cost; committed offensive/counter/Transport Population is not silently pulled out of active use;
- affected Warships have `-33% attack range`;
- health, damage, speed, veterancy, and all other Warship mechanics remain ordinary unless other explicit modifiers apply;
- the canonical **5-second Warship construction time still applies**.

P29 remains legal with P42. Cheap hull creation does not itself create high-rank nuclear vessels; P29 weapon access still depends on Warship rank/effective Silo level.

Echoes may modify Warship range like any other allowed Echo stat. Origin structural/stat modifiers establish the underlying faction profile and Echo percentages specialize that profile.

### S28 — P43 Heavy Artillery transformation

P43 transforms the faction's sole baseline land military unit rather than creating a separate unit type.

Starting from the canonical Tank baseline in `TERRAIN_AND_STRUCTURES.md`:

- construction time changes from `5s` to **`10s`**;
- purchase FFY cost `×1.50` after the ordinary Tank active-count price is calculated;
- final movement speed `×0.50` after terrain movement modifiers;
- weapon/Population-attack range `30 → 45` (`×1.50`);
- max health remains `1,000`;
- anti-armor attack becomes `1,000 damage` with `12s` cooldown;
- Population attack becomes `1,000 Population` with `12s` cooldown;
- Train interception/raiding is disabled;
- Tank terrain traversal barriers remain unchanged;
- projectiles may cross terrain the unit cannot traverse, including Mountain and Shallow Water, provided range/visibility/target legality succeeds.

The intended unmodified open-terrain benchmark is emergent rather than hard-coded: one prepared Heavy Artillery is favored against one Tank, one Heavy Artillery loses to two Tanks after its opening shot, and two Heavy Artillery are intended to lose to three Tanks because the surviving Tank can destroy both during their long reload.

The `1,000 Population / 12s` Population attack is intentionally retained for the provisional V1 baseline. Its sustained direct Population damage is the same `83.33 Population/s` as the baseline Tank's `250 / 3s`; Heavy Artillery converts that cadence into much larger alpha and a much longer vulnerability window rather than gaining four times the sustained Population DPS.

P43 adds no hidden outnumbered modifier and no extra health.

### S29 — P44 Radioactive Munitions

P44 costs **9 Origin points** and applies only to **successful Population attacks**, never Tank/Artillery combat or Train interception.

After ordinary Population damage resolves, eligible enemy-owned population-bearing cells in the footprint are neutralized and receive Fallout. Capacity disappears immediately because those cells lose ownership.

Deterministic footprint:

- baseline Tank: candidate cells inside target-centered **Manhattan radius 2**, neutralize up to **10** eligible cells;
- P43 Heavy Artillery: candidate cells inside target-centered **Manhattan radius 5**, neutralize up to **50** eligible cells.

Eligibility/resolution:

1. candidate must be enemy-owned and population-bearing;
2. structure-occupied and non-population-bearing cells are skipped;
3. candidates are ordered by Manhattan distance from the target, then stable cell/tile ID;
4. neutralize/apply Fallout to the first `10` or `50` eligible candidates;
5. if too few eligible cells exist inside the listed radius, affect fewer cells rather than expanding the footprint.

This means a successful radioactive Tank Population attack can remove up to **10 Population Capacity every 3 seconds**, while radioactive Heavy Artillery can remove up to **50 Capacity every 12 seconds**, before other modifiers.

P44 does not add a second direct Population-damage multiplier: direct damage remains `250` per baseline Tank Population shot or `1,000` per Heavy-Artillery Population shot.

P43 and P44 are independent and explicitly legal together, yielding radioactive Heavy Artillery. Their combined positive cost is `17`, so the pair is legal under the `20` positive-spend cap and requires at least `7` refunded points beyond the base 10-point budget if selected together without other point changes.

### S30 — P45 Forest concealment

P45 changes tactical visibility over **Forest owned by the trait-holder** rather than changing Forest combat percentages.

- Terrain type and political ownership remain public facts; the trait does not create hidden territory.
- Enemy tactical observation cannot reveal units, persistent structures, or manifested operational state in the **interior** of owned Forest.
- Forest cells on the exposed outer boundary where the trait-holder's Forest directly contacts an enemy territorial front remain normally observable so front geometry and direct territorial interaction are not hidden.
- Observation Posts and other ordinary tactical-observation sources do not penetrate the concealed Forest interior.
- A unit or other hostile source that directly attacks/manifests from concealment exposes only the minimum information mechanically necessary to identify and respond to that hostile manifestation; it does not reveal unrelated nearby contents or illuminate the Forest around it.

### S31 — P46 Tundra construction

P46 permits ordinary persistent-structure construction on owned Tundra.

Tundra otherwise remains Tundra: `0 Capacity`, non-population-bearing, Initial-Territory/spawn-ineligible, ordinarily slow to acquire, and subject to its normal combat/movement properties. The trait does not make Tundra equivalent to Plains.

A structure legally built there is an ordinary persistent structure afterward. If another faction captures it, normal structure-capture rules apply even if the new owner lacks P46; lacking P46 prevents new Tundra construction, not ownership/use of a structure already present there.

### S32 — P47 Marsh attrition

Whenever an enemy successfully captures one Marsh cell owned by the P47 faction, resolve the ordinary capture first and then remove **one additional Population** from the capturing faction.

The extra casualty comes from the terrain doctrine itself and does not require an automatic defender to have been present. It does not alter ownership transfer, Capacity transfer, ordinary capture casualties, or Marsh's baseline pressure/capture-speed modifiers.

### S33 — P48 population-bearing Shallow Water

For the P48 faction only, owned Shallow Water counts as population-bearing and contributes **`+1 Population Capacity per owned cell`**.

Consequences follow the ordinary population-bearing terrain rules for that faction:

- neutral Shallow Water costs `1 Population/cell` to settle rather than `0`;
- owned Shallow Water may receive ordinary automatic defense;
- losing it removes Capacity;
- effects requiring an enemy-owned population-bearing cell, including P44 Radioactive Munitions, may affect it when otherwise legal;
- it participates in the faction's population-bearing terrain-share denominator.

All other Shallow-Water identity remains unchanged: it is still unbuildable, still slow/poor terrain for ordinary land operations, still naval-traversable, and still blocks Tank/Heavy-Artillery traversal.

### S34 — P49 Counterintelligence Observation Posts

P49 inverts the tactical role of the faction's Observation Posts without creating a bespoke controller action.

- Owned active Observation Posts provide **no ordinary observation** to their owner.
- Their ordinary completed-level radius (`40 / 55 / 70 / 85 / 100`) instead becomes an enemy-intelligence blackout area.
- Enemy tactical observation cannot reveal the trait-holder's units, persistent structures, or manifested operational state inside that area through ordinary observation mechanics.
- The Observation Post itself remains publicly observable, and the existence/extent of its blackout field is mechanically knowable to affected opponents; the trait conceals contents rather than concealing the fact that counterintelligence is operating.
- Direct hostile manifestations from inside the blackout reveal the minimum information necessary for the attacked faction to identify/respond to the manifestation, without revealing unrelated contents of the field.
- Overlapping P49 Observation Posts do not create stronger concealment; they only extend the union of blackout coverage.

### S35 — P50/P51 reciprocal support fields

P50 and P51 reuse the existing Fort/Command Post pressure fields without creating any new controller commands, assignments, territorial-network rules, or special placement mechanics.

- **P50:** each owned active Fort additionally projects **offensive pressure equal to that Fort's ordinary defensive-pressure magnitude** across the Fort's existing completed-level coverage area. The Fort keeps its ordinary defensive pressure unchanged.
- **P51:** each owned active Command Post additionally projects **defensive pressure equal to that Command Post's ordinary offensive-pressure magnitude** across the Command Post's existing completed-level coverage area. The Command Post keeps its ordinary offensive pressure unchanged.
- Same-type overlapping fields continue to use the strongest applicable same-type effect rather than stacking.
- When a Fort field and a Command Post field both modify the same pressure direction on the same engagement, their distinct field bonuses combine with diminishing complement composition:

```text
combinedBonus = 1 - (1 - A) × (1 - B)
```

where `A` and `B` are decimal bonus magnitudes. Under the current L5 values, `30%` Fort support and `15%` Command support combine to **40.5%**, not 45% or 49.5%.
- The same cross-type composition rule applies whether the relevant direction is offense, defense, or—when both P50 and P51 are selected—both.

Taking both traits therefore turns both structures into general support fields while preserving their distinct baseline pressure strengths. Under the current provisional baseline, both structures use radius `30/35/40/45/50`; Forts provide the stronger `10/15/20/25/30%` field while Command Posts provide the weaker `3/6/9/12/15%` field. Any future decision to differentiate their coverage radii is a separate baseline-structure tuning change, not part of P50/P51.

### S36 — P07 deterministic +25% Train throughput

P07 modifies dispatch quantity rather than Train speed or the Factory's ordinary primary-Train occupancy rule.

Each Factory maintains its own deterministic count of **normal primary Train dispatches**. On every fourth normal primary dispatch, that Factory simultaneously launches one additional bonus Train using the same ordinary route-generation/service rules:

```text
4 normal primary dispatches
→ 4 primary Trains + 1 bonus Train
→ exactly +25% Train count over the dispatch sequence
```

The bonus Train does not occupy or delay the Factory's primary-Train slot. Its route/service targets are generated independently and deterministically. Train destruction does not reset the per-Factory dispatch sequence.

### S37 — P52 underpopulation economy

P52 adds a global non-spatial passive FFY source:

```text
emptyCapacity = max(0, PopulationCapacity - TotalPopulation)
P52BonusFFYPerSecond = emptyCapacity / 250
```

It is additive to the ordinary universal `1,000 FFY/s` floor. It is not an assignment of Population to workers/economy and consumes no Population.

The source is eligible for ordinary **All-FFY** yield modifiers but not Industrial, Naval/trade, Military/conquest, terrain-location, Fort-area, SAM-area, or other location/source-specific modifiers.

If Total Population exceeds Capacity, P52 contributes zero rather than negative income. Deterministic fixed-point/residual accounting may be used so income changes smoothly rather than jumping only when empty Capacity crosses multiples of 250.

P52 intentionally creates strange incentives: acquiring more Capacity can increase FFY, while later filling that Capacity with Population reduces the bonus. P02's wider efficient Population-utilization band may synergize strongly with P52; that combination is legal and should be benchmarked rather than prohibited.

### S38 — P53 strategic-stockpile economy

P53 adds a global non-spatial passive FFY source:

```text
readyPersistentSiloCharges
= sum of currently ready launch charges across owned active persistent Missile Silo structures

P53BonusFFYPerSecond
= 2,000 × readyPersistentSiloCharges
```

Only charges belonging to actual persistent **Missile Silo structures** count. Warships acting as launch platforms under P29 do not contribute P53 income.

The source is eligible for ordinary **All-FFY** yield modifiers but not Industrial, Naval/trade, Military/conquest, or spatial FFY modifiers.

Expending a Silo charge immediately removes that charge's income contribution until the charge becomes ready again. This creates a real guns-versus-butter tension, but temporary cooldown income loss is **not** treated as the doctrine's defining drawback.

P20's free starting level-1 Missile Silo is an ordinary owned active persistent Silo after spawn and therefore contributes one ready charge to P53 whenever that charge is ready. P53 + P20 is legal; its strength is controlled by ordinary point/refund constraints and benchmark balance rather than a hidden incompatibility.

### S39 — N18 non-Fallout acquisition penalty

N18 reuses the existing typed capture/settlement-progress system; it does not create a second acquisition mechanic.

For any target cell **without** a Fallout overlay, after ordinary pressure resolution and ordinary terrain/Echo/other acquisition-speed rules are calculated:

```text
finalCaptureOrSettlementProgress
*= 0.50
```

N18 applies to both:

- neutral settlement/acquisition; and
- hostile territorial capture.

It does **not** alter:

- offensive/defensive pressure itself;
- capture-coupled Population casualties;
- neutral-settlement Population cost;
- terrain identity;
- movement;
- structure legality.

If the target cell has Fallout, N18 does not apply at all. The ordinary Fallout acquisition-resistance multiplier still applies unless another rule such as P16 removes it.

Therefore, ignoring terrain-specific differences:

```text
N18 only:
non-Fallout acquisition = 0.50×
Fallout acquisition     = ordinary Fallout 0.50×

N18 + P16:
non-Fallout acquisition = 0.50×
Fallout acquisition     = 1.00×
```

This is the intended nuclear/Fallout expansion inversion: ordinary land is painfully slow while Fallout becomes relatively privileged terrain.

N18's `0.50×` is a structural post-multiplier. Ordinary terrain-capture/settlement Echo bonuses and terrain multipliers still calculate normally, then N18 halves the resulting progress on non-Fallout targets. P36 remains an independent Population-cost transformation.

### S40 — P54 star-shaped Initial Territory

P54 changes only generated **starting-footprint geometry**. It is not a positive capture-speed modifier.

Each Initial-Territory footprint uses the canonical five-point needle-star geometry from `STRATEGIC_SPAWN.md`:

- 5 outward points / 10 alternating vertices;
- fixed deterministic map-axis orientation;
- approximately `6:1` outer-tip radius to inner-valley radius;
- the same final population-bearing Initial-Territory quota the faction would otherwise receive.

The very long, thin arms create substantially more potential neutral boundary/contact surface, but this is only an opportunity to spend Population across more simultaneous neutral acquisition. P54 grants no extra Population, no extra territory, and no capture/settlement-speed stat. Terrain or collisions may substantially reduce the realized benefit.

P54 does not alter Starting Population, Capacity per cell, neutral-settlement Population cost, capture/settlement progress coefficients, or later territorial growth geometry.

P39 + P54 is legal. P39 still splits final Initial Territory between two exact origins; each split quota is generated as its own smaller five-point `6:1` star rather than duplicating the full quota. With the current costs, P39 + P54 totals **15 positive points** and therefore needs at least 5 usable drawback refund beyond the ordinary 10-point base budget.

---

## Catalogue coverage decisions

### Starting Population is Echo territory

Simple Starting Population modification is intentionally kept out of the Origin catalogue; it is numerical build tuning and belongs in the V1 Echo modifier pool unless a future Origin changes it structurally.

### Neutral expansion is covered structurally

P36 changes neutral-settlement Population efficiency, N18 supplies an Origin-scale structural acquisition-speed drawback that distinguishes ordinary versus Fallout terrain, and P54 changes only initial boundary geometry so ordinary expansion can engage more cells at once. Generic positive capture-speed tuning remains Echo territory.

### Alternate passive economies are Origin territory

The ordinary game keeps a simple flat universal FFY floor. P52 and P53 deliberately create unusual passive-economy identities from underpopulation and strategic stockpiles; they are Origin-scale rule changes rather than generic Echo percentage axes.

### Recon / visibility

Observation Posts establish the baseline structure-driven tactical observation mechanic. Generic numerical observation/range tuning remains Echo territory. P45 and P49 cover Origin-level information warfare through structural concealment/counterintelligence rules rather than simple range bonuses.

### Expanded terrain/structure coverage

The accepted terrain/support/economy library now has Origin-level coverage without introducing bespoke controller APIs or hidden incompatibility systems. Deep Water remains covered indirectly through the broader naval Origin ecosystem, while Impassable remains deliberate hard map topology rather than an Origin-transformable terrain class.

---

## Combination-safety notes

No compatibility matrix is allowed. Deliberately foolish, partially inert, or difficult combinations remain legal if they satisfy the public builder rules.

Examples:

- Warship boons + N12 (`Cannot build Warships`);
- P07/P34/P43/P44 + N09 (`Cannot build Factories`) — Tank traits may still matter if a Factory is later acquired through a legal non-build path;
- P17 + N06 (`Cannot spend FFY to upgrade buildings`);
- P26 + P25 (MIRV boon plus MIRV prohibition);
- P35 + N05 (creates Fallout the faction itself cannot capture);
- P44 + N05 (radioactive Tank/Artillery attacks create neutral Fallout the faction itself cannot later capture);
- **N18 + N05** (ordinary non-Fallout acquisition is halved and Fallout cannot be captured at all — severe but legal);
- N14 + N16 (first hostile capture has net-zero FFY effect for the original owner because `-V + V` cancels; an uncaptured N16 voyage still costs `V`);
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
- P33 + P07 for increased Train traffic feeding City Population;
- P34 + N09 for conquest-only industrialization;
- P35 + P16 for creating and later efficiently reclaiming a Fallout perimeter;
- P38 + P35 for an expensive elastic/scorched defensive doctrine;
- **P39 + P54 for two smaller star-shaped starting footprints**;
- **P43 + P44 for radioactive Heavy Artillery**;
- P44 + P16 for a doctrine that can later reclaim its own radioactive territorial damage efficiently if the front advances;
- P50 + P51 for reciprocal general-support Fort/Command fields, with cross-type pressure bonuses using the explicit diminishing-composition rule rather than additive stacking;
- **P52 + P02** for a low-utilization demographic/economic state that can remain near peak growth across a wider band;
- **P53 + P20** for an immediate ready-Silo passive-income start, if financed by sufficient legal drawbacks;
- **P53 + P16 + N18** as the core legal nuclear-expansion spine: Silo-stockpile economy, full-speed Fallout acquisition, and half-speed ordinary acquisition;
- P53 + P35/P44 + P16 + N18 for even stronger self-created-Fallout doctrines where point limits permit the exact build.

The exhaustive deployment gate must prove every builder-legal combination deterministic and engine-safe; these notes never become hidden incompatibilities.

---

## Current first Official Origin roster

The accepted first roster is maintained in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md). P52/P53/N18 are now explicitly showcased by **O48 Humanity Has Declined** and **O49 Third Impact**; P54 is showcased by **O50 Lucky Star**. These remain ordinary public catalogue builds rather than creator-only mechanics.

---

## Next Origin work

The expanded terrain/structure/Tank/economy/world-system pass now has provisional Origin coverage, and the corresponding Echo pool has already been expanded to the accepted **93 concrete stat+scope keys**. Echo identity/acquisition/reward tuning belongs in `ECHO_CATALOGUE.md`.

Remaining Origin-side priorities are final trait naming, balance/repricing, benchmark validation of balance-sensitive traits such as P19/P33/P52/P53/N18/P54, and exhaustive legal-combination validation rather than further trait proliferation for its own sake.
