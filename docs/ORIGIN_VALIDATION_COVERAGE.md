# Open Fufu — Origin Validation Coverage Contract

## Status and authority

This file is the **canonical owner for Origin-trait validation coverage, validation-domain assignment, mechanical dependency traces, required integration seams, external semantic dependencies, explicit Origin-interaction obligations, and validation-level negative assertions**.

It does **not** own Origin mechanics, costs, builder legality, subsystem baselines, resolver algorithms, lifecycle rules, or project/blocker status. Those remain with their focused canonical owners:

- Origin mechanics/costs/composition: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- game-wide Population/territory/combat invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- game-wide effective-rule composition: [`RULE_COMPOSITION.md`](./RULE_COMPOSITION.md);
- migration validation architecture/deployment eligibility: [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md);
- Strategic Spawn: [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md);
- FFY/Train/Trade economy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- terrain/persistent structures/baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Warships/Transports/strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- combat tuning: [`COMBAT_TUNING.md`](./COMBAT_TUNING.md);
- Minor Factions: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md);
- controller-visible public surface: [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts).

This contract says **what relationships and interaction boundaries must be validated**. It deliberately does not copy formulas, constants, geometry tables, charge algorithms, transaction ordering, or other detailed mechanics from those owners. If a focused owner changes, validation derives the expected result from that owner rather than maintaining a synchronized second formula here.

GitHub issues and pull requests own work/progress state. If a focused mechanic is not yet deterministic enough for certification, the validation result may report that dependency externally; this canonical contract does not maintain a live blocker ledger.

---

# 1. Validation relationship model

Every deployed trait must resolve to at least one direct validation owner or be explicitly intrinsic-only. A missing direct owner is a certification defect.

For every trait, distinguish four relationships:

1. **Direct transformation** — the gameplay owner whose canonical rule/value/permission/state the trait changes. That owner supplies the expected behavior for conformance.
2. **Required integration seam** — trait-specific state/event flow crosses a subsystem boundary and therefore requires explicit integration coverage.
3. **External semantic dependency** — the trait reads canonical state/mechanics owned elsewhere without owning them.
4. **Ordinary downstream consumption** — valid canonical output is consumed normally downstream and does not justify a redundant trait-specific implementation or test family by itself.

Every trait audit also accounts for:

- meaningful same-axis and cross-system interactions;
- cross-faction interactions when one faction's trait changes state another trait explicitly queries;
- hard-prohibition, hard-zero, cap, admission, or replacement precedence;
- negative assertions that prevent an implementation from broadening the trait beyond its canonical mechanic;
- deterministic save/load/replay expectations where the trait introduces or consumes persistent state.

A dedicated interaction is required when one trait changes a value, state, geometry, legality result, event, or lifecycle point another trait directly consumes, or when precedence must be proven. Do **not** generate an all-pairs matrix merely because two traits can coexist.

---

# 2. Validation-domain catalogue

The current Origin catalogue resolves onto these recurring gameplay validation domains:

| Domain | Origin conformance concern |
| --- | --- |
| **Spawn / pre-match initialization** | spawn profiles, exact origins, generated starting footprints, initial ownership/Population, start-state grants, deterministic resolver/replay |
| **Population state/accounting** | Capacity/Total/Available/committed Population, growth, peak-state entitlements, settlement accounting, casualties/transfers, Population-derived passive effects |
| **Land combat / capture resolution** | offensive/defensive pressure, counter-response, acquisition progress, automatic defense, capture casualties, post-capture consequences, structure-capture consequence dispatch |
| **Terrain / territorial mutation** | faction-effective terrain classification, acquisition rules, Fallout overlays, abandonment/neutralization, construction permissions |
| **Persistent structures / transactions / lifecycle** | purchase/upgrade/grant/capture admission, hard caps/prohibitions, provenance, active level/state, effective fields, charge-bearing structures, destruction/transfer |
| **FFY economy / physical logistics** | FFY source/event families, modifier ordering, spatial yields/hard zero, passive sources, Train/Trade lifecycle, piracy, explicit costs/losses/snapshots |
| **Naval / amphibious lifecycle** | Warship/Transport admission and profiles, movement, rank/caps, repair, embarkation, landing/abort/destruction, carried Population |
| **Strategic weapons / interception** | launcher legality, weapon access/cost, launch transactionality, projectile motion/classification, blast realization, SAM interception/anti-ship behavior |
| **Observation / concealment** | lawful observation/reveal/blackout/concealment geometry, hostile-manifestation exceptions, controller/AI-visible projection |

## 2.1 Admission / legality is a stage, not a tenth domain

Hard prohibitions, ownership caps, permissions, entitlements, and alternate purchase paths are enforced inside the domain that owns the action/state being admitted.

```text
request / input
    ↓
canonical legality / admission
    ↓
effective transaction / profile
    ↓
authoritative resolution
    ↓
cross-system consequences
```

A prohibition or cap must fail before resources, entitlements, construction slots, or other transactional state are consumed. Discounts, zero-cost transforms, grants, terrain permissions, or later runtime effects cannot bypass an earlier hard legality constraint unless the focused mechanic owner explicitly defines such an exception.

---

# 3. Per-trait coverage registry

The entries below intentionally identify **validation relationships**, not duplicate mechanic definitions. Exact values and algorithms are read from the named owners at validation time.

## 3.1 Positive traits P01–P10

- **P01 — Domain Expansion** — Direct owner: `STRATEGIC_SPAWN.md`. Validate that the effective starting-territory quota is consumed by footprint generation before final ownership feeds Population initialization. Explicit interactions: P39 split-footprint handling, P54 geometry, P48 faction-effective population-bearing classification.
- **P02 — The Era of Humans** — Direct owner: `OPEN_FUFU_DESIGN.md`, composed through `RULE_COMPOSITION.md`. Validate the replacement Population-growth utilization profile while preserving independent growth inputs. Explicit interaction: N01; include Capacity states affected by P48 as ordinary upstream state.
- **P03 — Imagine Breaker** — Direct owners: land combat plus the Fort field supplied by `TERRAIN_AND_STRUCTURES.md`. Validate suppression of the hostile Fort-derived defensive component only. Explicit interactions: P09, N08, N10; negative assertion that P51/other non-Fort defense remains.
- **P04 — Level 0** — Direct owner: `COMBAT_TUNING.md`. Validate the authored response-side counter-response transformation across representative attacker/responder imbalances without altering attack-side semantics.
- **P05 — Big Shot** — Direct seam: structure-capture result -> `FFY_ECONOMY.md`. Validate exactly-one qualifying conquest event only after a successful structure transfer; non-transfer results do not emit it. Explicit interactions: N17, N07, P34, P14/N04, P24/N11. Expected value/location/sampling comes only from the FFY owner.
- **P06 — See You, Space Cowboy** — Direct owner: `FFY_ECONOMY.md` Trade-Ship movement. Validate effective physical speed through pursuit/capture geometry while preserving route/cargo/event semantics. No bespoke P08 interaction is required.
- **P07 — Galaxy Express 999** — Direct owner: `FFY_ECONOMY.md` Factory/Train scheduler. Validate owner-epoch scheduler persistence, bonus-Train lifecycle, transfer/reset behavior, and replay from the canonical owner. Explicit interactions: P33, P34, N09, N17.
- **P08 — Tea Time** — Direct owner: `FFY_ECONOMY.md`, consuming the canonical `atWar` relation from the game-wide hostility contract. Validate current relation state at event resolution for both maritime and rail external trade. Explicit interaction: N14/N16 voyage snapshots must not be retroactively revalued.
- **P09 — Wall Maria** — Direct owners: `TERRAIN_AND_STRUCTURES.md` Fort profile/transactions and land-combat pressure composition. Validate effective Fort coverage, defensive contribution, and price through their normal pipelines. Explicit interactions: P03, P18, P24, P50, N08, N10, P21.
- **P10 — Scorpion's Tail** — Direct owner: Origin rule composition; projectile taxonomy/motion is `NAVAL_AND_STRATEGIC_WEAPONS.md`. Validate the authored modifier against the canonical warhead projectile class, physical interception window, MIRV carrier exclusion, and blast-profile independence from travel time.

## 3.2 Positive traits P11–P20

- **P11 — Level Upper** — Direct owners: Population peak-state entitlement plus SAM admission/transaction state in `TERRAIN_AND_STRUCTURES.md`. Validate permanent entitlement growth and admission across all structure-acquisition paths. Explicit interactions: N07, P40, P27, P21; multiple caps compose through `RULE_COMPOSITION.md`.
- **P12 — Somewhere Not Here** — Direct owner: `NAVAL_AND_STRATEGIC_WEAPONS.md` Transport movement. Validate physical travel/abort-return speed through interception and landing timing. P32/P37/N13/N15 remain independent Transport axes.
- **P13 — Mountain Training Arc** — Direct owner: land-combat terrain defense. Validate Mountain target qualification and ordinary composition with independent defensive sources; P03 must not suppress this terrain-derived component.
- **P14 — 60 Billion Double Dollars** — Direct owner: `FFY_ECONOMY.md`. Validate Desert qualification from the event owner's canonical location and ordinary FFY composition. Explicit interactions: P24, N11, P05, N14/N16 snapshot valuation.
- **P15 — The High Ground** — Direct owner: land-combat source pressure. Validate Highland qualification from the attacking source cell and representative composition with independent offensive sources.
- **P16 — Poison Taster** — Direct owner: terrain/acquisition progress. Validate removal of only the ordinary Fallout resistance component. Explicit precedence: N05 prohibition still wins; N18 remains active on non-Fallout; P35/P44-created Fallout uses the ordinary shared overlay.
- **P17 — Ten Billion Percent** — Direct owner: `TERRAIN_AND_STRUCTURES.md` upgrade transaction pricing, with deterministic dynamic composition through `RULE_COMPOSITION.md`. Validate the current structure-count dependency and ordinary ownership-state updates. Explicit interactions: N06, P09, P41.
- **P18 — The Best Defense** — Direct seam: effective Fort coverage -> land-combat source offense. Validate self/fixed-teammate field qualification and non-stacking qualification semantics from the focused owners. Explicit interactions: P09, N10, N08, P50.
- **P19 — The Weak Die First** — Direct seam: current Territorial Contact state -> land-combat offense. Validate distinct active-faction contact counting, disappearance/reappearance, fixed teammate behavior, and Minor-Faction contact through `MINOR_FACTIONS.md`. Other pressure sources use representative composition suites.
- **P20 — A Miracle Is Merely a Miscalculation** — Direct seams: `STRATEGIC_SPAWN.md` start-state ordering -> `TERRAIN_AND_STRUCTURES.md` grant admission/lifecycle -> strategic launcher consumption. Validate one faction-wide grant at the canonical primary origin slot, no purchase entitlement consumption, and ordinary persistent-Silo state. Explicit interactions: P21, P53, N07, N06, P39.

## 3.3 Positive traits P21–P30

- **P21 — Fun Things Are Fun** — Direct owner: `TERRAIN_AND_STRUCTURES.md` purchase transactions. Validate per-type first-successful-purchase entitlement after ordinary legality/affordability and no entitlement consumption on failed attempts, grants, or captures. Explicit interactions: P20, P37, P11, P09, P41, N07/N09/P46.
- **P22 — Limit Break** — Direct owner: `NAVAL_AND_STRATEGIC_WEAPONS.md` Warship rank/XP lifecycle. Validate progression through the extended rank ceiling and ordinary rank-derived profile projection. Explicit interactions: P29, P23, P30.
- **P23 — Space Battleship Yamato** — Direct owner: `NAVAL_AND_STRATEGIC_WEAPONS.md` Warship profile/admission. Validate effective combat/movement profile plus one-Warship admission including committed construction. Explicit interactions: P22, P30, P42, P29.
- **P24 — A King's Price** — Direct owner: `FFY_ECONOMY.md`, consuming effective Fort geometry from `TERRAIN_AND_STRUCTURES.md`. Validate event-location field membership and ordinary FFY composition. Explicit interactions: P09, N10, N08, P14, N11, P05, N14/N16.
- **P25 — EXPLOSION!** — Direct Origin owner: `ORIGIN_TRAIT_CATALOGUE.md`; strategic realization: `NAVAL_AND_STRATEGIC_WEAPONS.md`. Validate weapon-family legality, transaction transform, deterministic blast realization and Water-Nukes geometry identity without copying blast algorithms here. Explicit interactions: P26, P29, P10.
- **P26 — Serious Punch** — Direct owner: strategic-weapon entitlement/transaction. Validate one successful MIRV entitlement, failed-attempt non-consumption, ordinary charge/launcher/hostility behavior, and zero-FFY transaction semantics. Explicit interactions: P25 prohibition, P29 launcher access, P53 charge-state consequence.
- **P27 — Only My Railgun** — Direct owner: SAM/strategic-weapon behavior in `NAVAL_AND_STRATEGIC_WEAPONS.md`. Validate anti-ship target legality, damage/cadence, charge arbitration and priority exactly as that owner defines them. Explicit interactions: P11, P40, P32.
- **P28 — Blood Devil** — Direct seam: Transport destruction -> Population accounting. Validate exactly-once carried-Population transfer using the canonical destruction attribution and recipient-accounting rules. Explicit interactions: P32, P27, N13; strategic-destruction qualification follows the focused attribution contract.
- **P29 — The Kaiser** — Direct Origin transform: Warship -> strategic launcher; physical launcher/charge transaction owner: `NAVAL_AND_STRATEGIC_WEAPONS.md`. Validate physical-identity-bound mobile state, dynamic effective launcher level, movement persistence, destruction cleanup, replay and ordinary launch transactionality. Explicit interactions: P22, P25, P26, P53 exclusion.
- **P30 — The Conman** — Direct owners: Warship profile/action legality plus piracy in `FFY_ECONOMY.md`. Validate physical speed, naval-gun prohibition without suppressing legal Trade capture or strategic launch, and terminal piracy transformation. Explicit interactions: P23, P22, P29, N14/N16.

## 3.4 Positive traits P31–P40

- **P31 — Heart-Under-Blade** — Direct seam: Port repair field -> Warship repair/operation. Validate Warship-specific effective field/rate, strongest same-type field handling, health clamping, and continued ordinary Warship operation while repairing. Explicit interactions: P29, P22/P23; negative assertion that P32 Transports receive only ordinary eligible repair.
- **P32 — Armored Titan** — Direct owners: Transport embark-source admission and Transport health-bearing chassis. Validate owned-active-Port embark source, health-based destruction, ordinary repair eligibility and carried-Population destruction semantics. Explicit interactions: P12, P28, P37, N13, N15, P27; P31 enhancement remains Warship-only.
- **P33 — Misaka Network** — Direct seam: canonical Train station event -> Population accounting for the City owner. Validate event ownership/current City level/Capacity clamp independently of the FFY amount. Explicit interactions: P07, P41, P08, P14/P24/N11, P34.
- **P34 — Spoils of the Empire** — Direct owners: captured-Factory acquisition provenance plus the Factory profile in `FFY_ECONOMY.md`. Validate current-owner capture provenance, transfer/destruction distinction, effective Factory consumers, snapshot persistence and replay. Explicit interactions: P05, N09, N17, N07, P07, P33, P43.
- **P35 — It's a Matter of Visualization** — Direct owners: deliberate abandonment plus Fallout overlay. Validate that ordinary relinquishment consequences resolve first and the resulting neutral cell receives the shared Fallout state without becoming a capture event. Explicit interactions: P16, N05, N18, P36, P44.
- **P36 — Half-Priced Bento** — Direct owner: Population neutral-settlement accounting. Validate faction-persistent fractional settlement accounting through concurrent/serial operations using the canonical debit destination and deterministic aggregation. Explicit interactions: N18, P16, P35, P48 classification timing.
- **P37 — The City Mouse** — Direct owners: Transport embark transaction plus exact-cell Fort grant after successful landing. Validate ordinary landing/capture resolution before grant admission, no fallback placement, failed-grant non-rollback, and purchase-entitlement separation. Explicit interactions: N15, P21, P32, N13, N17, N07.
- **P38 — Return by Death** — Direct owner: automatic-defense capture casualty/Population accounting. Validate exactly-once automatic-defender survival on successful capture without changing ownership or attacker consequences. Explicit interaction: P47; include defended zero-Capacity terrain cases.
- **P39 — Stereo Separation** — Direct owner: `STRATEGIC_SPAWN.md`. Validate stable two-origin slots across Strategic/Random/Fixed, simultaneous split-footprint growth, one final faction quota/ownership result, one global Starting Population pool, and replay binding. Explicit interactions: P01, P54, P20, P48.
- **P40 — Barrier Magic** — Direct owner: SAM effective profile/interception state. Validate effective range/charge/recharge through the ordinary deterministic interception system. Explicit interactions: P11, P27, P10, N11; no controller-driven interception action is introduced.

## 3.5 Positive traits P41–P54

- **P41 — Level 5** — Direct owner: `TERRAIN_AND_STRUCTURES.md` City purchase/construction. Validate one direct high-level purchase action, one construction lifecycle, in-progress state, capture preservation and later ordinary completed-City effects. Explicit interactions: P21, N06, P17, P33, N01, P46, N07.
- **P42 — The Price of Empire** — Direct owners: Warship purchase transaction plus Warship attack-range axis. Validate Population-funded purchase atomically through ordinary Warship admission and the effective range through composition. Explicit interactions: P23, P29, P30, P22, N12, P31.
- **P43 — The Devil of the Rhine** — Direct owner: transformed Tank chassis/Factory production and combat profile. Validate one complete effective chassis projection, ordinary Tank-count pricing basis, combat/terrain barriers, attack-set differences, Factory repair, and projectile/chassis path distinction. Explicit interactions: P44, P34, N09, visibility consumers.
- **P44 — Nobel Prize** — Direct seam: successful Tank-chassis Population attack -> deterministic territorial neutralization/Fallout. Validate eligible-cell selection from the canonical owner, neutralization rather than capture, shared Fallout semantics, and no structure-capture consequences. Explicit interactions: P43, P16, N05, P35; cross-faction P44 attacker -> P48 defender; negative P47 assertion.
- **P45 — Hidden Leaf Village** — Direct owner: observation/concealment projection. Validate Forest-owned concealment, exposed boundary behavior, ordinary observation filtering, ownership changes and hostile-manifestation exception using the canonical observation contract. Explicit interaction: P49 union; combat systems receive no hidden-state bypass.
- **P46 — Northern Lands** — Direct owner: `TERRAIN_AND_STRUCTURES.md` faction-effective structure-build terrain eligibility. Validate Tundra permission changes only construction eligibility, with every non-terrain admission rule still active and existing captured structures remaining usable. Explicit interactions: P41, N09, N07, P11, P21.
- **P47 — This Is Poison** — Direct owner: successful hostile capture casualty/Population accounting. Validate the extra capturing-faction casualty only after genuine successful Marsh capture, using the focused Population debit rule. Explicit interactions: P38, P35, cross-faction N18 attacker -> P47 defender; P44 neutralization must not trigger it.
- **P48 — Aqua's Blessing** — Direct owner: faction-effective terrain classification/Population Capacity. Validate owner-relative Shallow-Water population-bearing state across acquisition/loss, Spawn quota accounting, terrain-share denominators and controller projection. Explicit interactions: P01/P39, P02, P36 neutral-target timing, P44 attacker -> P48 defender, P52.
- **P49 — Laughing Man** — Direct owner: Observation-Post effective observation profile. Validate reveal-to-blackout transformation, faction-specific concealment, overlap union, ownership transfer and hostile-manifestation exception through the canonical observation projection. Explicit interactions: P45, P46, N17.
- **P50 — Iserlohn Fortress** — Direct seam: effective Fort profile -> offensive support field. Validate use of the effective Fort magnitude/coverage, same-type field handling and the focused Fort/Command cross-type composition rule. Explicit interactions: P09, N08, N10, P18, P51; P03 must not suppress offensive support.
- **P51 — One Flag Beneath the Stars** — Direct seam: effective Command-Post profile -> defensive support field. Validate actual-defender requirement, same-type field handling and the focused Fort/Command cross-type composition rule. Explicit interactions: P50, P03, P09, N08, N10.
- **P52 — Humanity Has Declined** — Direct seam: current authoritative Population state -> global passive FFY source. Validate current-state consumption, non-negative source behavior and global/general FFY classification through `FFY_ECONOMY.md`. Explicit interactions: P48, P01, P02, P33, P42; ordinary cross-faction Population/Capacity mutations propagate through state only.
- **P53 — Money Is Everything** — Direct seam: persistent-Silo READY projection -> global passive FFY source. Validate only the canonical persistent-Silo input and ordinary launch/upgrade/capture/save-load state from the focused owners. Explicit interactions: P20, P26, N07; explicit exclusions: P29 mobile launcher and SAM state.
- **P54 — Starlight Breaker** — Direct owner: `STRATEGIC_SPAWN.md`. Validate the canonical star priority field/resolver through that owner's versioned geometry/golden vectors, generated-footprint quota preservation, all spawn modes and replay binding. Explicit interactions: P39, P01, P48. Validation must not duplicate the star template or resolver constants here.

## 3.6 Negative traits N01–N18

- **N01 — The Lost Decade** — Direct owner: City-derived Population-growth contribution. Validate the City contribution transform without changing structure level or unrelated growth inputs. Explicit interactions: P02, P41, P33.
- **N02 — Flat Is Justice** — Direct owner: Plains source offensive-pressure component. Validate per-lane source-terrain qualification and representative multi-source pressure composition; P15 is terrain-disjoint on one source cell.
- **N03 — I Hate Sand** — Direct owner: Desert target defensive-pressure component. Validate per-lane target-terrain qualification while independent Fort/P51 defense remains active.
- **N04 — Northern Expedition** — Direct owner: `FFY_ECONOMY.md` spatial event yield. Validate Mountain event-location qualification from the event owner. Explicit interactions: P24, N11, P14 terrain disjointness, P05 canonical location.
- **N05 — Curse of the Abyss** — Direct owner: territorial-acquisition legality. Validate Fallout prohibition before capture/settlement progress and consistent controller/runtime legality. Explicit precedence: N05 over P16; interactions P35, P44, N18.
- **N06 — No Second Season** — Direct owner: structure-upgrade admission. Validate paid upgrade rejection before payment while purchases, capture/grants and existing levels remain separate. Explicit interactions: P41, P17, P21, P20/P37 grants.
- **N07 — One Piece** — Direct owner: persistent-structure ownership admission. Validate the per-type cap across purchase, grant, capture-transfer, committed construction/reservations and atomic decisions. Explicit interactions: P11, P20, P21, P37, P34, P46.
- **N08 — It's Just Decoration** — Direct owner: Fort effective defensive profile. Validate Fort defensive hard zero while preserving coverage and independent Fort functions. Explicit interactions: P03, P09, P18, P24, P50, P51, N10.
- **N09 — Medieval Isekai** — Direct owner: Factory build admission. Validate hard build prohibition before payment while legally acquired existing Factories remain usable. Explicit interactions: P46, P21, P34/P07/P43, N17.
- **N10 — Domain Contraction** — Direct owner: Fort effective coverage axis. Validate one resolved effective field consumed consistently by all Fort-area consumers. Explicit interactions: P09, P03, P18, P24, P50, P51, N08, P37.
- **N11 — Absolute Territory** — Direct owner: `FFY_ECONOMY.md` spatial hard-zero stage using canonical SAM-area membership. Validate terminal zero after ordinary yield transforms while preserving event identity/non-FFY effects. Explicit interactions: N04, P14, P24, P40, P33, P05.
- **N12 — Panzer Vor!** — Direct owner: Warship build admission. Validate hard prohibition before FFY/Population consumption or construction. Explicit precedence: N12 over P42; P23/P22/P29/P30/P31 do not create a build bypass.
- **N13 — Beach Episode Gone Wrong** — Direct owner: amphibious landing Population resolution. Validate casualty at the canonical landing lifecycle point using canonical deterministic rounding, only on an actual landing path. Explicit interactions: P37, P32, P12, N15.
- **N14 — To Them Words Are Merely a Means to Deceive** — Direct owner: `FFY_ECONOMY.md` first-hostile-capture voyage transaction. Validate one-time original-owner debit from the immutable launch-time voyage reference and persistent first-capture state. Explicit interactions: N16, P30 and launch-time valuation consumers.
- **N15 — King's Ransom** — Direct owner: Transport embark transaction. Validate additive embark-cost composition, failed-attempt non-consumption and independence from later movement/landing. Explicit interactions: P37, P32, P12, N13.
- **N16 — Insurance Fraud** — Direct owner: `FFY_ECONOMY.md` voyage terminal/capture transaction. Validate uncaptured-success replacement and one-time first-hostile-capture credit from the immutable voyage reference without reprocessing signed transactions through positive-event modifiers. Explicit interactions: N14, P30 and launch-time valuation consumers.
- **N17 — I Can Cut It** — Direct owner: `TERRAIN_AND_STRUCTURES.md` structure-capture disposition. Validate transfer-to-destruction transformation while the political cell capture remains successful and transfer-only consequences are suppressed. Explicit interactions: P05, P34, N07, P49/P50/P51, cross-faction P47/P38.
- **N18 — I Have No Enemies** — Direct owner: final territorial capture/settlement progress. Validate the non-Fallout structural post-multiplier at the canonical final-progress stage while Fallout is exempt. Explicit interactions: P16, N05, P36, P35/P44, cross-faction P47; terrain progress inputs remain ordinary upstream state.

---

# 4. Explicit interaction registry

This registry identifies relationships that need dedicated conformance beyond independent per-trait tests. Exact numeric expectations always come from the focused mechanic owner and `RULE_COMPOSITION.md`.

## Spawn / initial state

- P01 + P39 — modified total starting quota is split only after the total transformation.
- P01 + P54 — geometry changes without losing the transformed total quota.
- P39 + P54 — each stable split footprint uses the canonical star priority field while preserving one faction quota/Population pool.
- P39 + P20 — one singular starting-Silo grant remains bound to the canonical primary origin slot.
- P48 with P01/P39/P54 — Spawn quota accounting consumes faction-effective population-bearing classification.

## Population / growth / settlement

- P02 + N01 — utilization-profile replacement and City-growth contribution transform remain separate hooks.
- P11 + N07 — all applicable ownership caps/entitlements must pass; neither replaces the other.
- P36 + N18 — settlement Population cost and final progress transform remain independent.
- P52 + P48 — passive FFY consumes the Capacity resulting from faction-effective terrain classification.

## Land combat / terrain / capture

- P03 with P09/N08/N10 — suppress only the effective Fort-derived defensive component.
- Independent pressure modifiers use representative aggregate-composition suites rather than an all-pairs matrix.
- P16 + N05 — hard acquisition prohibition wins over Fallout-resistance removal.
- P16 + N18 — Fallout exemption/non-Fallout progress transform remain distinct.
- P18 with P09/N10 — consume the final effective Fort geometry.
- P19 -> Territorial Contact / Minor-Faction lifecycle — consume canonical contact state rather than duplicating it.
- P44 attacker -> P48 defender — target eligibility uses the defender's faction-effective population-bearing classification.
- N18 attacker -> P47 defender — progress transformation and post-capture casualty occur in their separate authored stages.
- N17 with P05/P34 — transfer-dependent effects are suppressed by destruction-on-capture while political cell capture remains successful.

## Structure fields / transactions

- P09 + N10 — same-axis Fort coverage composition is owned by `RULE_COMPOSITION.md`; geometry is consumed from the structure owner.
- P09 with P24/P50/P51 — downstream field consumers use the transformed Fort profile/geometry.
- P50 + N08 — P50 derives from the effective Fort magnitude, so an effective zero remains zero.
- P50/P51 with ordinary reciprocal Fort/Command fields — use the focused cross-type composition rule, not a validation-owned formula.
- P20/P37 + P21 — grants do not consume first-purchase entitlements.
- P20/P37 + N07 — grants pass ordinary structure admission; rejection does not roll back the triggering spawn/landing result.
- P37 landing-cell structure disposition — structure capture/occupancy resolves before the independent exact-cell Fort grant.
- P41 + N06 — direct high-level City purchase remains a purchase rather than hidden upgrade transactions.
- N09 + P34/P07/P43 — build prohibition does not suppress transformations/services on a Factory obtained through another legal path.

## FFY / Train / Trade

- P05 + N17 — no transfer means no transfer-triggered conquest event.
- P05 + P34 — a successful Factory transfer may independently produce conquest FFY and establish captured-Factory provenance.
- P07 + P33 — bonus Trains create ordinary qualifying Train events.
- P07 + P34 — Factory scheduler cadence and dispatch-time economic profile remain separate.
- P14 + P24 — independent eligible spatial FFY modifiers compose through the ordinary FFY pipeline.
- P14/P24/N04 + N11 — terminal hard zero cannot be resurrected by ordinary yield transforms.
- N14 + N16 — first-hostile-capture original-owner signed consequences must net deterministically while cargo continues normally.
- P08 -> canonical `atWar` — external relation dependency is consumed at event resolution rather than reimplemented in validation.
- N14/N16 with P08/spatial valuation — immutable launch-time voyage reference and later event-resolution state remain separate.

## Naval / strategic weapons

- P22 + P29 — Warship rank changes the effective mobile-launcher input consumed by the naval launcher lifecycle.
- P23 + P42 — Warship hard cap remains admission-critical; same-axis range composition comes from `RULE_COMPOSITION.md`.
- N12 + P42 — Warship build prohibition wins before Population-funded purchase can consume resources.
- P27 + P40 — anti-ship SAM behavior uses the same effective range/charge/recharge state as the SAM owner defines.
- P32/P37/N13/N15 Transport combinations — preserve source legality, embark transaction, physical lifecycle, landing casualty and post-success grant as separate ordered concerns.
- P29 with P25/P26 — exact physical mobile launcher consumes the ordinary Origin weapon transforms/entitlements.
- P10 with MIRV/SAM interception — consume canonical projectile taxonomy/motion and physical interception.
- P25 + Water Nukes — effect-mode changes do not create a second blast-geometry resolver.
- P53 with P20/upgrade/capture — consume ordinary persistent-Silo READY state after each lifecycle transition.
- P53 vs P29/SAM — explicitly reject non-persistent-Silo charge state.
- P30 with N14/N16 — hostile piracy payout and original-owner voyage transactions remain separate amounts/lifecycles.

## Observation / concealment

- P45 + P49 — concealment predicates compose as continued concealment/union through one lawful visibility projection, not numeric stacking.
- P45/P49 hostile-manifestation exceptions consume the canonical observation payload/precedence contract.

---

# 5. Certification and maintenance rules

- Validation metadata must point to the focused owner for exact mechanics instead of copying its formulas/constants/resolver tables.
- A newly discovered semantic ambiguity is reported to the responsible owner/work item; it is not solved inside validation metadata.
- Project status (`blocked`, `resolved`, completion counts, issue numbers, candidate-SHA state) belongs in GitHub issues/PRs and test/CI output, not this contract.
- Runtime certification should be projection/domain based. Named Origins are compositions of trait coverage, not a reason to duplicate a full validation suite per named Origin.
- Expensive fixtures may be pre-generated or accelerated, but deterministic save/load/replay and controller-visible projection must still validate the same canonical state.
- When a trait or focused mechanic changes, update this file only when the **validation relationship or required interaction coverage** changes. Numerical/mechanical changes that preserve the relationship stay in their mechanic owner and executable tests.
