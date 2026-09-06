# Open Fufu — Rule Composition Contract and V1 Inventory

## Status and authority

This document is the **canonical owner for game-wide effective-rule composition architecture**: rule-axis identity, source/layer metadata, operator and reducer semantics, normalization order, terminal constraints, deterministic serialization requirements, and the V1 inventory used to prove that current rule-bearing content can be represented without ambiguous arithmetic.

It does **not** own the baseline mechanics or balance values of the systems it inventories. Those remain with their focused canonical owners:

- game-wide Population, land operations, automatic defense, hostility, and cross-system invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- capture/counter-response arithmetic: [`COMBAT_TUNING.md`](./COMBAT_TUNING.md);
- terrain, persistent structures, and baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Warships, Transports, and strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- FFY, Factory Trains, Trade Ships, and piracy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Strategic Spawn: [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md);
- Segments: [`SEGMENTS.md`](./SEGMENTS.md);
- Minor Factions / Goons: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md);
- Origin trait identities, values, and trait-specific mechanics: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- Echo identities, scopes, magnitudes, and Echo-specific rules: [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md).

The focused owner defines **what a rule means**. This document defines **how independently authored rule-bearing sources compose when they meet on the same effective rule surface**.

This inventory is intentionally game-wide. Origins and Echoes are consumers/producers of the same rule system as rulesets, terrain, structures, unit profiles, and situational effects; they do not define the vocabulary of the game by themselves.

The executable V1 realization lives under `src/core/rules/` and is bound by `RULE_COMPOSITION_VERSION = "1"`. The code-readable registry, manifests, normalizer, compiler, materializer, and validators implement this contract; drift between them and this document is a schema/documentation defect, not a second source of composition semantics.

---

# 1. V1 design rule: no global modifier priority numbers

Open Fufu V1 does not assign arbitrary `priority: N` values to ordinary modifiers.

A modifier is not interpreted as an instruction to mutate a value in source/insertion/trait-ID order. Instead it identifies:

1. a stable **rule axis** and typed scope;
2. its **source kind** and provenance;
3. an allowed semantic **slot** on that axis;
4. an allowed **operator**;
5. a typed value/unit where applicable;
6. an optional closed, typed eligibility-condition **conjunction** whose members are all required;
7. terminal/constraint behavior where applicable.

The **axis definition owns ordering**. Each slot owns an explicit executable reducer such as `SUM`, `PRODUCT`, `MIN`, `MAX`, `UNION`, `DIFFERENCE`, `ANY`, `PROHIBIT_WINS`, or `SINGLETON`.

Source IDs are allowed as canonical serialization/provenance keys. They must never silently decide which of two semantically conflicting replacements or structural transformations wins.

If two builder-legal/content-legal rules create a non-commutative conflict and no explicit composition rule exists, catalogue/ruleset validation fails. Runtime does not invent a winner.

---

# 2. Inventory classification

Not every gameplay number is a modifier axis. The V1 audit classifies rule-bearing surfaces into the following classes.

| Class | Meaning |
| --- | --- |
| **AXIS** | A deliberately modifiable effective-rule quantity/capability/profile with an explicit composition contract. |
| **PARAMETER** | A versioned baseline constant or table entry that currently has no generic modifier composition surface. It may become an axis only through an explicit future design change. |
| **DERIVED** | A value calculated from authoritative state/parameters/axes. Modifiers should target the correct inputs rather than mutate this output opportunistically. |
| **STATE** | Dynamic match state such as Population, ownership, rank, ready charges, or `atWar`; rules may consume it but it is not itself a modifier declaration. |
| **CUSTOM** | A structural, lifecycle, event, scheduler, transaction, geometry, or resolver mechanic that cannot be truthfully represented as ordinary scalar composition. It may consume/produce AXIS values. |
| **COMPILER / RESOLVER** | Deterministic map/spawn/compiler parameters and algorithms whose version binding is authoritative but which do not participate in the ordinary faction-effective modifier stack. |

A value being numeric does not make it an `AXIS`. For example, Segment target size, spawn tie/hash constants, MIRV target-distribution spacing, and Goon placement spacing are versioned rules but are not current ordinary modifier targets.

---

# 3. Rule-axis identity

A concrete rule axis is conceptually:

```text
axis family
+ typed scope
```

Examples:

```text
unit.attack.range
  { unit = WARSHIP, attack = NAVAL_GUN }

structure.field.coverageArea
  { structure = FORT, field = FORT_SUPPORT }

structure.transaction.buildCost
  { structure = FORT }

terrain.pressure.offense
  { terrain = FOREST }

weapon.projectileSpeed
  { weapon = HYDROGEN_BOMB }
  conditions = { PROJECTILE_IS_WARHEAD }
```

The implementation may expose ergonomic enums/types rather than these literal strings. Canonical serialization must nevertheless produce one stable, versioned identity for the same family+scope pair.

A typed **eligibility condition** is separate from axis identity when the same quantity is modified only in a particular context, for example:

- source cell is Highland;
- target has Fallout;
- event location lies inside an effective Fort field;
- current structure ownership was acquired through `CAPTURE_TRANSFER`;
- target unit is a Tank or Heavy-Artillery chassis;
- current Territorial Contact count is `N`.

One contribution may carry multiple conditions. They form a logical **AND** conjunction. Conditions are canonicalized as a set-like conjunction for stable serialization, and mutually exclusive conjunctions may prove that two singleton declarations cannot apply simultaneously.

Conditions must come from a closed creator-authored/engine-authored vocabulary. Player content does not supply arbitrary formulas, callbacks, or executable predicates. Equality conditions use concrete IDs; wildcard values such as `ALL` belong to axis scopes, not predicates such as `TARGET_UNIT_IS`.

A rule contribution may also identify a named **component/provenance tag** when another rule must suppress that exact component without suppressing unrelated contributors. Current examples include P03 suppressing hostile Fort-derived defensive pressure and P16 suppressing the ordinary Fallout acquisition-resistance component.

---

# 4. Source provenance is not semantic priority

Current useful source kinds include at least:

```text
BASE_RULESET
RULESET_TRANSFORM
ORIGIN
ECHO
TERRAIN
STRUCTURE
UNIT_PROFILE
SCENARIO
SITUATIONAL
```

This field answers **where a rule came from**. It does not by itself answer **when it executes**.

That distinction is required because an Origin may define a structural chassis transformation, a conditional terrain effect, a hard prohibition, or an ordinary numeric specialization. Those cannot all share one meaningful global `ORIGIN` execution position.

Likewise, terrain may establish a baseline component before an Origin transform on one axis while acting as a local eligibility condition on another axis.

---

# 5. Slots, operators, and reducers

## 5.1 Axis-owned slots

Each axis declares an ordered list of named semantic slots. There is no requirement that every axis use the same list.

A reusable numeric family may commonly contain slots conceptually equivalent to:

```text
BASE
STRUCTURAL / BASE_REPLACEMENT
FLAT_ADDITION
ORIGIN_PERCENT
ORIGIN_MULTIPLIER
ECHO_PERCENT
OTHER_EXPLICIT_SPECIALIZATION
DOMAIN_CONSTRAINT
TERMINAL
FINALIZE
```

That is a reusable pattern, not a universal hard-coded order. The axis registry is authoritative for the slots it actually allows.

## 5.2 Core executable operators/reducers

The literal V1 executable vocabulary is:

| Operator/reducer | V1 meaning |
| --- | --- |
| `ADD_FLAT` / `SUM` | Same-slot flat deltas sum. |
| `ADD_PERCENT` / `SUM` | Same-slot signed relative percentages sum, then apply once. |
| `MULTIPLY` / `PRODUCT` | Independent same-slot scalars multiply, then apply once. |
| `CAP_LIMIT` / `MIN` | Most restrictive upper cap wins. |
| `CAP_FLOOR` / `MAX` | Strongest lower floor wins. |
| `ADD_CAP` / `SUM` | Additive cap/rank deltas sum where the axis explicitly admits additive caps. |
| `ALLOW` + `PROHIBIT` / `PROHIBIT_WINS` | Any applicable hard prohibition makes the action illegal; otherwise an applicable allow may permit it. Numeric benefits cannot bypass prohibition. |
| `HARD_ZERO` / `ANY` | Any applicable hard-zero makes the numeric effective value exactly zero at the terminal stage. Later ordinary positive modifiers cannot resurrect it. |
| `REPLACE_BASE` / `SINGLETON` | Establishes a replacement base/profile before later ordinary specialization. Multiple simultaneously applicable replacements are invalid unless that axis names an explicit resolver. |
| `FINAL_OVERRIDE` / `SINGLETON` | Establishes a genuinely fixed final semantic value. Later ordinary specialization is inert unless the axis explicitly says otherwise. |
| `ADD_CAPABILITY` / `UNION` | Adds capability IDs to a typed capability set. |
| `REMOVE_CAPABILITY` / `DIFFERENCE` | Removes capability IDs from a typed capability set. |
| `REPLACE_CAPABILITIES` / `SINGLETON` | Replaces a capability set before later add/remove stages. |
| `STRUCTURAL_TRANSFORM` / `SINGLETON` | Replaces/reshapes a profile, event/lifecycle, or geometry before downstream consumers. Competing transforms require an explicit named composition rule. |
| `SUPPRESS_COMPONENT` / `UNION` | Adds exact component IDs to the suppression set while leaving unrelated components intact. |
| named domain reducer | Used only where the focused mechanic defines a non-generic aggregation law, e.g. Fort/Command cross-type complement composition. |

`REPLACE_BASE` and `FINAL_OVERRIDE` are intentionally distinct. Replacing a baseline curve/profile does not automatically make later explicit specialization illegal. A rule worded as a fixed final result may do so.

## 5.3 Same-slot commutativity

`SUM`, `PRODUCT`, `MIN`, `MAX`, `UNION`, `DIFFERENCE` (for the union of removal IDs), `ANY`, and `PROHIBIT_WINS` are order-independent under their declared V1 semantics. The normalizer must reduce all applicable contributions in the slot before moving to the next slot.

Do not perform intermediate rounding between members of a commutative slot.

If changing input order changes the normalized result, validation fails unless the axis explicitly owns a non-commutative named reducer/dependency.

## 5.4 Explicit dependencies for genuine non-commutativity

When one named transformation genuinely requires another named transformation to have completed first, encode the semantic dependency directly rather than assigning unexplained numeric ranks.

Conceptually:

```text
ECHO_TANK_SPECIALIZATION
  after ORIGIN_TANK_CHASSIS_PROFILE
```

Dependency graphs must be acyclic and deterministic. An unresolved cycle or competing non-commutative transform is a content/schema error.

---

# 6. Layer composition and ordinary numeric normalization

For current V1 content, the intended high-level specialization relationship is:

```text
baseline/profile
→ Origin structural profile and Origin same-slot normalization
→ Echo same-slot specialization
→ other explicitly ordered contextual/domain stages
→ constraints / hard terminal rules
→ finalization
```

This does **not** mean all Origin rules execute before all terrain or structure logic. Axis-specific slots still own the actual order.

Within one additive-percentage slot/layer:

```text
combinedPercent = sum(all applicable signed percentages)
value' = value × (1 + combinedPercent)
```

Across two separately ordered percentage-specialization slots, each slot acts once on the value produced by the previous slot.

Therefore Origin percentages that target the same Origin slot add with one another, while a later Echo specialization acts on the already-established Origin-effective profile.

Example:

```text
base Warship range = 130
P23 Origin range = +20%
P42 Origin range = -33%
Origin slot = -13%
Origin-effective range = 130 × 0.87 = 113.1
```

A later `+5%` Warship-range Echo would specialize that Origin-effective range rather than being inserted between P23 and P42.

Independent multiplicative scalars in one slot combine as a product before application. Because multiplication is commutative, they require no individual rank.

Flat surcharges that must remain immune to later discounts should not be disguised as ordinary same-axis flat additions. They should use a distinct transaction hook/slot whose immunity is explicit.

---

# 7. Numeric representation, dynamic providers, rounding, and serialization

Authored static percentages/scalars use canonical integer fixed-scale storage for versioning, hashing, and exact normalization. Basis points are sufficient for current authored percentage granularity:

```text
+20%  -> +2000 bp
-33%  -> -3300 bp
+9%   ->  +900 bp
```

A static scalar likewise uses the canonical 10,000 scale, for example `1.50× -> 15000`.

Dynamic rules are compiled as **symbolic typed providers**, not converted prematurely into approximate static modifiers. A provider records its axis/scope/stage/operator, authoritative state dependency, closed formula identity/parameters, result operand kind, source provenance, and condition conjunction. Current V1 examples deliberately exercise three result kinds:

- P11: integer count from `floor(peakTotalPopulation / 25,000)`;
- P17: exact rational multiplier `(99/100)^S`, retained as a reduced numerator/denominator rather than rounded to basis points;
- P19: integer basis-point contribution `500 × TerritorialContactCount`.

Exact rational products remain exact through normalization/provider evaluation. Conversion to a floating materialized gameplay quantity occurs only at an explicit owning-domain boundary and must reject non-finite conversion. Do not round after every modifier. Rounding/clamping/geometry rasterization belongs to the owning domain boundary and should happen at the explicitly defined finalization point.

Canonical serialization contains the complete rule profile:

```text
schema/algebra version
normalized static rules
symbolic dynamic providers
explicit custom-domain declarations
```

Within those sections, records are sorted by stable semantic keys such as axis family, scope, slot ordinal, canonical condition conjunction/component identity, source kind, and stable source/provenance identity. Set-valued operands are sorted and deduplicated before serialization.

That sort exists for byte-stable serialization/hash/debugging. It is not semantic conflict resolution.

A match must bind the effective-rule schema/algebra version directly or through an unambiguous bound ruleset/catalogue version so historical matches cannot silently acquire new composition semantics.

---

# 8. Base-game V1 inventory

This section inventories current target mechanics **before** Origin/Echo mapping. It distinguishes modifiable surfaces from parameters, derived values, state, and custom logic.

## 8.1 Population and game-wide state

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Initial Territory population-bearing quota | AXIS | `spawn.initialTerritoryQuota`; baseline 1,000; P01 modifies; P39/P54 consume final quota structurally. |
| Starting Population fraction of final Initial Territory/Capacity | AXIS | `population.startingFraction`; baseline 50%; Echo specializes. |
| Population Capacity | DERIVED | From current owned faction-effective population-bearing cells; P48 modifies classification, not Capacity by hidden scalar. |
| Population-bearing terrain classification | AXIS | `terrain.populationBearing`; typed terrain/faction-effective classification; P48 transforms Shallow Water. |
| Base growth coefficient/exponent | PARAMETER | `0.05 × Capacity^0.75`; no current ordinary modifier rewrites these constants. |
| Population utilization curve | AXIS | `population.growth.utilizationProfile`; baseline piecewise curve; P02 replaces profile. |
| Explicit Population Growth multiplier | AXIS | `population.growth.explicitMultiplier`; consumes terrain-share, City, Origin/Echo contributions through declared subcomponents/slots. |
| Current Total/Available/committed Population | STATE | Authoritative dynamic resource; P11/P52 etc. consume state. |
| Peak Total Population | STATE | Monotonic authoritative state consumed by P11's symbolic SAM ownership-cap provider. |
| Neutral settlement Population cost | AXIS | `population.neutralSettlementCost`; baseline 1/cell; P36 transforms with residual accounting. |
| Automatic defender count per threatened cell | PARAMETER / INVARIANT | Binary 0/1; current traits alter effectiveness/survival, not generic quantity. |
| Successful defended-capture baseline casualties | PARAMETER + CUSTOM lifecycle | Baseline defender -1/attacker -1; P38/P47 alter specific post-capture consequences rather than one generic damage scalar. |
| `atWar` grace duration | PARAMETER | 600 ticks; current Origins consume `atWar` effects but do not change the lifecycle timer. |
| Current `atWar` relation | STATE | Derived from active directed-hostility sources + grace; not a modifier declaration. |

## 8.2 Land capture, pressure, and counter-response

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Required capture progress | PARAMETER | Baseline `1.0`; no current generic modifier. |
| Pressure advantage `(A-D)/(A+D)` | DERIVED / formula | Canonical combat formula; modifiers target effective `A`, `D`, or progress multipliers. |
| Final offensive pressure | DERIVED from components | Do not treat every terrain/structure/Origin contribution as one unordered number; retain typed component provenance until domain aggregation. |
| Global offensive-pressure specialization | AXIS | `combat.pressure.offense.global`; Echo and applicable Origins may contribute. |
| Terrain offensive-pressure component | AXIS | `terrain.pressure.offense[terrain]`; baseline terrain table, terrain Echoes, N02 etc. |
| Structure offensive-pressure field magnitude | AXIS | `structure.field.pressureMagnitude[type,direction=OFFENSE]`; Command baseline; P50 mirrors Fort effective defense; Echo specializes Command magnitude. |
| Conditional Origin offense contributions | AXIS contribution / condition | P15/P18/P19 target pressure through typed conditions/providers rather than source-order callbacks. Component aggregation is defined in §13.1. |
| Global defensive-pressure specialization | AXIS | `combat.pressure.defense.global`. |
| Terrain defensive-pressure component | AXIS | `terrain.pressure.defense[terrain]`. |
| Structure defensive-pressure field magnitude | AXIS | `structure.field.pressureMagnitude[type,direction=DEFENSE]`; Fort baseline; P51 mirrors Command effective offense. |
| Acquisition/capture/settlement progress multiplier | AXIS | `combat.acquisitionProgressMultiplier`; terrain/Fallout/global/neutral-only effects are typed contributions/conditions. |
| Capture progress per second | DERIVED | Advantage × effective progress multipliers. |
| Partial-progress decay 0.50/s | PARAMETER | No current modifier. |
| Counter-response response-side effectiveness | AXIS | `combat.counterResponse.responseEffectiveness`; P04 is terminal `FINAL_OVERRIDE(1.0)`, so ordinary response-effectiveness Echo specialization is legal but inert while P04 applies. |
| Counter-response attack-side effectiveness | AXIS-capable / currently baseline | Surfaced effective hook; no current Echo counterpart. |
| Counter-response `k`, `p`, `M`, tick cadence | PARAMETER | Versioned combat constants, not ordinary current modifier axes. |

**Canonical finding:** pressure is not one scalar axis internally. Terrain components, structure-field magnitudes, conditional/global rule contributions, and selective component suppression retain distinct typed semantics through domain aggregation; P50/P51's cross-field reducer remains a named domain rule.

## 8.3 Terrain and overlays

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Conquerable/ownable terrain | AXIS-capable permission | `terrain.acquirePermission[terrain/overlay]`; N05 supplies Fallout hard prohibition. |
| Population-bearing classification | AXIS | P48 changes Shallow Water for holder. |
| Land/naval/heavy-unit traversal permission | AXIS-capable permission | `terrain.traversalPermission[movementClass,terrain]`; current P43 preserves Tank barriers rather than modifying them. |
| Movement multiplier by movement class/terrain | AXIS | `terrain.movementMultiplier[movementClass,terrain]`; participates in final unit speed. |
| Persistent-structure terrain eligibility | AXIS | `terrain.structureBuildEligibility[terrain]`; P46 allows Tundra, N09 remains separate Factory-type prohibition. |
| Spawn eligibility | AXIS-capable / currently baseline | `terrain.spawnEligibility[terrain]`; no current ordinary percentage modifier. |
| Terrain acquisition multiplier | AXIS | `terrain.acquisitionMultiplier[terrain]`. |
| Terrain offense/defense | AXIS | Component axes above. |
| Plains-share Growth / Desert-share FFY | AXIS contributions | Dynamic state-derived contributions into Growth/FFY axes, not new hidden final formulas. |
| Fallout capture multiplier 0.50× | AXIS component | Named overlay component so P16 can suppress exactly this factor. |
| Fallout overlay identity/persistence | STATE + CUSTOM | Overlay creation/removal lifecycle; P35/P44 produce it. |

## 8.4 Persistent structures

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Build FFY cost by type/target level | AXIS | `structure.transaction.buildCost[type]`; baseline table, Origin/Echo specialization, hard-zero transaction effects where applicable. |
| Upgrade FFY cost | AXIS | `structure.transaction.upgradeCost[type]`; separate from build cost because Echoes distinguish them and P17/P11 apply to upgrades. |
| Build/upgrade duration | AXIS | `structure.transaction.constructionTime[type]`; Echoes specialize. |
| Structure-produced unit construction work rate | AXIS | Factory-side producer-sensitive work-rate hook; P34 `×1.50` for Tank/Heavy-Artillery chassis from qualifying conquered Factories. |
| Resulting purchased level/profile | STRUCTURAL AXIS / CUSTOM transaction | P41 direct-L5 City purchase changes transaction shape, not four hidden upgrades. |
| Structure ownership cap | AXIS / hard constraint | `structure.ownershipCap[type]`; N07 static and P11 dynamic providers supply effective limits, while canonical acquisition admission and atomic slot reservation are owned by `TERRAIN_AND_STRUCTURES.md`. |
| Structure type build permission | AXIS / hard constraint | e.g. N09 Factory prohibition; separate from terrain eligibility and price. |
| City Growth contribution magnitude | AXIS | `structure.effect.cityGrowth[level]`; N01 Origin then Echo specialization. |
| Fort/Command coverage | AXIS in semantic **area** | `structure.field.coverageArea[type]`; baseline may be radius table, but generic modifiers authored as area remain area until geometry projection owned by `TERRAIN_AND_STRUCTURES.md`. |
| Fort defensive / Command offensive magnitude | AXIS | `structure.field.pressureMagnitude[type,direction]`. |
| Same-type overlapping field handling | DOMAIN REDUCER | Strongest applicable same-type field; not a generic percentage stack. |
| Fort+Command cross-type pressure handling | DOMAIN REDUCER | Complement formula when both distinct field types affect same direction. |
| Port/Factory repair radius | AXIS | `structure.repair.radius[type,service]`; supports post-Echo contextual specialization/final override by target unit where explicitly authored. |
| Port/Factory repair rate | AXIS | `structure.repair.rate[type,service]`; supports post-Echo contextual specialization by target unit. |
| Factory simultaneous repair capacity | PARAMETER / baseline | P34 does not change simultaneous repair capacity. |
| Silo/SAM charge capacity | AXIS | `structure.charge.capacity[type]`; P40 final one-charge profile. |
| Silo/SAM recharge time | AXIS | `structure.charge.rechargeTime[type]`; Echo and P40. |
| SAM interception range | AXIS | `structure.interception.range[SAM]`; P40 + Echo. |
| Observation radius | AXIS | `structure.observation.radius`; under P49 the same effective radius specializes blackout field. |
| Observation effect (`REVEAL`/`BLACKOUT`) | STRUCTURAL AXIS | P49 changes profile; numeric radius remains separately composable. |
| SAM ship-attack capability | CAPABILITY AXIS | P27 permits; exact weapon behavior remains owned by the focused SAM/strategic-weapons mechanic. |
| Silo weapon-access set | CAPABILITY AXIS | Level/profile + weapon restrictions such as P25. |
| Current ownership acquisition path | STATE | Exact owner-epoch provenance `PURCHASE_BUILD`, `GRANT`, or `CAPTURE_TRANSFER`; P34 consumes `CAPTURE_TRANSFER`. |

## 8.5 Tank / Heavy Artillery and generic mobile-unit surfaces

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Tank active-count purchase-cost curve | PARAMETER/profile feeding AXIS | Curve is baseline computation; final purchase FFY cost is `unit.transaction.purchaseCost[TANK]`. |
| Unit purchase FFY cost | AXIS | Origin profile transforms then Echo specialization; transaction hard-zero/prohibition remains explicit. |
| Unit purchase Population cost | AXIS / transaction resource | P42 introduces 2,000 Population for Warship; do not encode as negative FFY. |
| Build time | AXIS | P43 changes Tank-derived build time; producer-side P34 changes Factory construction work rate rather than subtracting duration. |
| Chassis/profile identity | STRUCTURAL AXIS | `unit.chassisProfile[TANK]`; P43 -> Heavy Artillery. |
| Movement class/traversal profile | STRUCTURAL / capability | Chassis owns class/barriers; terrain produces local movement multiplier. |
| Final movement speed | AXIS-derived profile | Base speed × terrain/profile transforms × later Echo specialization according to axis order. |
| Max health | AXIS | Rank/profile/Origin/Echo contributions as applicable. |
| Repair-retreat threshold | PARAMETER | 50% baseline; no current generic modifier. |
| Ownership cap | AXIS / constraint | P23 Warship cap; Tank baseline none. Warship build admission/reservation is owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`. |
| Maximum rank | AXIS | Warship baseline 3, P22 +2. |
| Attack range by attack identity | AXIS | Separate attack IDs prevent naval-gun range from modifying Trade capture distance or strategic launch semantics. |
| Numeric attack damage | AXIS | Separate from binary Train interception/destruction. |
| Attack cooldown | AXIS-capable | P43 structurally supplies 12s attacks; no current Echo cooldown. |
| Attack capability/target set | CAPABILITY AXIS | P30 removes Warship ship gunfire; P43 removes Train interception. |
| Autonomous leash | PARAMETER | 100 cells; no current modifier. |

## 8.6 Warships, Transports, and amphibious lifecycle

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Warship active-count purchase curve | PARAMETER/profile feeding purchase-cost AXIS | Same progressive baseline shape as Tank. |
| Warship speed/health/gun range/damage | AXIS | Origin/rank/Echo composition. |
| Warship shell cooldown | AXIS-capable / baseline | No current Echo; P30 prohibits use rather than modifying cadence. |
| Trade Ship capture distance | PARAMETER / distinct axis candidate | Baseline 5 cells; deliberately not `WARSHIP_ATTACK_RANGE`. |
| Warship rank | STATE | Starts 1; XP changes current rank. |
| Warship maximum rank | AXIS | P22. |
| Rank-derived health/damage | DERIVED profile contribution | Uses current rank before later effective profile specialization. |
| Naval XP awards | PARAMETER | 100/10/4; no current modifier. |
| Transport active cap | AXIS-capable | Baseline 3. |
| Transport embark source rule | STRUCTURAL AXIS | Coast/shore baseline; P32 -> owned active Port. |
| Transport embark FFY cost | AXIS | Baseline 0; P37 +250 and N15 +500 flat additions. |
| Transport movement speed | AXIS | P12. |
| Transport health/profile | STRUCTURAL AXIS | Baseline fragile/no pool; P32 -> 500 HP health-bearing. |
| Landing Population survival/casualty | AXIS + lifecycle boundary | N13 50% death; exact application/rounding point remains owned by the amphibious lifecycle. |
| Return Population survival fraction | AXIS-capable / baseline | 75%; no current modifier. |
| Successful-landing structure grant | CUSTOM lifecycle | P37 emits an exact-cell L1 Fort grant after successful landing/capture resolution; generic grant admission is owned by `TERRAIN_AND_STRUCTURES.md`. |
| Transport-destruction Population theft | CUSTOM lifecycle | P28. |

## 8.7 Strategic weapons and launchers

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Weapon FFY purchase cost | AXIS | `weapon.transaction.purchaseCost[type]`; P25/Echo/P26 transaction behavior. |
| Weapon-family use permission | CAPABILITY AXIS | P25 hard-prohibits Atom/MIRV. |
| Per-faction use count/limit | AXIS / entitlement | P26 MIRV once. |
| Projectile speed by weapon/stage | AXIS | P10 + Echo; exact P10 projectile classes are owned by the strategic-weapons subsystem. |
| Atom/Hydrogen blast **area** | AXIS | P25/Echo authored as area; inner/outer radius/raster projection remains weapon-domain geometry. |
| Baseline inner/outer radii | PARAMETER / geometry basis | Focused weapon owner. |
| MIRV max warheads, distribution radius, spacing | PARAMETER | No current generic modifier. |
| MIRV separation progress fraction | PARAMETER | No current generic modifier. |
| Water Nukes enabled/core geometry | RULESET PARAMETER / CUSTOM geometry | Not an ordinary Origin/Echo scalar. |
| Launcher weapon-access set | CAPABILITY AXIS | Silo level/P29/P25. |
| Launcher charge capacity/recharge | AXIS | Persistent structure axes; P29 creates mobile launcher profile. |
| Warship-as-launcher profile | STRUCTURAL AXIS / CUSTOM state | P29. |

## 8.8 FFY, Trains, Trade Ships, and piracy

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Starting FFY | PARAMETER | 25,000 baseline. |
| Passive FFY rate | PARAMETER + source providers | Baseline 1,000/s; P52/P53 add new sources rather than mutating one hidden scalar. |
| Positive FFY event yield | AXIS | `ffy.eventYield`; family/scope eligibility (All/Military/Naval/Industrial) plus spatial conditions. Existing canonical same-axis percentage rule is generalized here. |
| Explicit FFY loss/penalty | CUSTOM transaction | Not automatically modified by positive-yield percentages. |
| Hard-zero FFY event yield | TERMINAL AXIS rule | N11. |
| External wartime trade multiplier | AXIS | Baseline 0.50×; P08 base replacement to 1.00×. |
| Train speed | PARAMETER | 25 rail cells/s; no current modifier. |
| Train turnaround/dwell/target count | PARAMETER | 5s / 1.5s / up to five targets. |
| Factory Train event base value by level | PARAMETER feeding AXIS | 10k..15k baseline; qualifying P34 Factory contributes contextual `×1.50` before ordinary earning-side FFY yield. |
| Factory Train event base-value specialization | AXIS | Producer-scoped Factory hook snapshotted by each dispatched Train; P34 currently supplies `×1.50` under `CAPTURE_TRANSFER`. |
| Train dispatch scheduler | CUSTOM | P07 every-fourth normal-primary dispatch is owner-epoch scheduler state; not an unordered `+25%` scalar. |
| Train dispatch economic snapshot | CUSTOM lifecycle | A dispatched Train snapshots its Factory economic profile; P34's numeric base-value transform is an axis, while snapshot persistence remains Factory/FFY lifecycle state. |
| Trade Ship speed | AXIS | P06. |
| Trade dispatch cadence | PARAMETER / resolver | deterministic 20–30s; no current modifier. |
| Raw cargo | DERIVED | `150 × planned route length`. |
| Destination selection | CUSTOM deterministic policy | least-recently-selected. |
| Piracy payout multiplier | AXIS / event-specific structural multiplier | P30 `3×` on piracy event, then ordinary eligible yield specialization. |
| Voyage `Vowner` snapshot | CUSTOM/DERIVED boundary | N14/N16 consume the canonical launch-time owner-side voyage value owned by `FFY_ECONOMY.md`. |
| P52/P53 alternative passive sources | CUSTOM source providers | Produce All/general FFY source values from authoritative state. |

## 8.9 Strategic Spawn

| Surface | Class | Candidate effective-rule surface / note |
| --- | --- | --- |
| Spawn mode | RULESET PARAMETER / profile | STRATEGIC/RANDOM/FIXED. |
| Influence-area/profile shape | STRUCTURAL AXIS | Ordinary one-area profile; P39 split profile. |
| Exact-origin slot count/profile | STRUCTURAL AXIS | P39 two slots. |
| Initial-Territory quota | AXIS | Shared with Population initialization; P01. |
| Footprint geometry profile | STRUCTURAL AXIS | compact vs P54 star. |
| Population-bearing quota classification | Consumes terrain AXIS | P48 can alter Shallow-Water quota counting for holder. |
| Influence radius, foreign spacing, spawn immunity | PARAMETER | 400 / 50 / 5s under current V1. |
| Deterministic tie/hash/fallback algorithms | COMPILER / RESOLVER | Bound by `spawnResolverVersion`; not ordinary modifier axes. |
| Star template/rasterization constants | COMPILER / RESOLVER | Exact P54 realization is owned by `STRATEGIC_SPAWN.md`. |
| Random/Fixed × transforming-Origin profile | CUSTOM / RESOLVER | Mode-independent P39/P54 profile semantics and mode-specific origin resolution are owned by `STRATEGIC_SPAWN.md`. |

## 8.10 Minor Factions / Goons

Minor Factions intentionally consume the ordinary Population, terrain, acquisition, and defense rules. Their special ambient population/placement/decision policy is not a parallel modifier stack.

| Surface | Class | Note |
| --- | --- | --- |
| requested count formula | PARAMETER / DERIVED | `floor(populationBearingMapCells / 20,000)`. |
| Initial Territory / Starting Population | Shared base rules | 1,000 / 500 baseline; no Origin/Echo. |
| Goon↔Goon 100-cell placement floor | RESOLVER PARAMETER | Separate from universal foreign 50-cell floor. |
| deterministic farthest-point placement | RESOLVER | Versioned generation policy. |
| 50%-Capacity allocation trigger | CUSTOM engine policy | Not a generic faction modifier axis. |
| 20%-Total-Population allocation amount | CUSTOM engine policy | Not a generic faction modifier axis. |
| P19 contact counting | Shared STATE consumer | P19 consumes ordinary active faction/contact state including Goons. |

## 8.11 Segments

Segments expose no V1 gameplay modifier axes. Segment membership/borders have no intrinsic combat, capture, movement, economy, visibility, or other physical effect.

The ~4,096-cell target, geography heuristics, connectivity repair, stable-ID assignment, and `segmentGeneratorVersion` are **COMPILER / RESOLVER** concerns bound into the map artifact, not effective faction modifiers.

---

# 9. Origin P01–P54 classification

The table below maps every current positive Origin trait to the game-wide inventory. `CUSTOM` does not mean untyped: custom mechanics declare explicit domain boundaries, while static and dynamic axis-bearing behavior is represented directly in the compiled profile.

| ID | Classification | Primary rule target(s) / composition note |
| --- | --- | --- |
| P01 | NUMERIC AXIS | `spawn.initialTerritoryQuota`: Origin `+15%`. |
| P02 | BASE REPLACEMENT + CUSTOM BOUNDARY | `population.growth.utilizationProfile`: replacement curve; exact curve anchors remain Population-owned. |
| P03 | COMPONENT SUPPRESSION | Attacker suppresses hostile `FORT` defensive-pressure field component only. |
| P04 | FINAL OVERRIDE | `combat.counterResponse.responseEffectiveness = 1.0` as terminal `FINAL_OVERRIDE`; response-effectiveness Echoes remain legal but are inert while P04 applies. |
| P05 | CUSTOM event | successful qualifying structure capture -> Military/conquest FFY event; base value/location remain owned by `FFY_ECONOMY.md`. |
| P06 | NUMERIC AXIS | `unit.movementSpeed[TRADE_SHIP]`: Origin `+25%`. |
| P07 | CUSTOM scheduler | every fourth normal primary Factory Train dispatch in each ownership epoch creates a bonus Train; ownership transfer resets owner-scoped scheduler state under `FFY_ECONOMY.md`. |
| P08 | BASE REPLACEMENT | `ffy.externalWartimeTradeMultiplier`: `0.50 -> 1.00`. |
| P09 | MULTI-AXIS | Fort coverage area `+10%`; Fort effective defensive pressure `+9%`; Fort build/upgrade price `-8%` on applicable Fort transaction hooks. |
| P10 | NUMERIC AXIS | `weapon.projectileSpeed[...] +100%`; exact projectile class/stage scope remains strategic-weapons-owned. |
| P11 | DYNAMIC CAP + TERMINAL COST | SAM build **and upgrade** FFY cost `HARD_ZERO`; symbolic dynamic `structure.ownershipCap[SAM] = floor(peakTotalPopulation / 25,000)` provider composes with N07 through `MIN`. |
| P12 | NUMERIC AXIS | `unit.movementSpeed[TRANSPORT] +25%`. |
| P13 | CONDITIONAL PRESSURE | Mountain target defensive-pressure contribution `+33%`; combat aggregation retains terrain/source provenance. |
| P14 | CONDITIONAL FFY | Desert-located positive FFY event `+33%` ordinary yield contribution. |
| P15 | CONDITIONAL PRESSURE | Highland-source offensive pressure `+33%`. |
| P16 | COMPONENT SUPPRESSION | suppress ordinary Fallout acquisition-resistance multiplier; does not bypass N05 legality. |
| P17 | SYMBOLIC DYNAMIC MULTIPLIER | `structure.transaction.upgradeCost`: exact rational `(99/100)^S`, `S=current owned structures`; compiled symbolically and materialized without basis-point rounding. |
| P18 | CONDITIONAL PRESSURE | `+100%` offense when attacking source lies in qualifying self/team Fort area; one qualification regardless of overlapping Fort count. |
| P19 | SYMBOLIC DYNAMIC CONDITIONAL PRESSURE | `+500 bp` offense per distinct active other faction with current Territorial Contact; includes Goons and fixed teammate under current literal rule. |
| P20 | CUSTOM start grant | starting-structure grant boundary; exact Spawn placement/order is owned by `STRATEGIC_SPAWN.md`, while generic grant admission/materialization and persistent-Silo level/charge/readiness lifecycle are owned by `TERRAIN_AND_STRUCTURES.md`; strategic launch transactionality remains owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`. |
| P21 | CUSTOM transaction override | first successful purchase per structure type passes ordinary legality + affordability, then consumes `0 FFY`; grant/capture not purchase. |
| P22 | FLAT AXIS | `unit.maximumRank[WARSHIP] +2`. |
| P23 | MIXED | Warship range/damage/speed Origin `+20%` each; hard ownership cap `1`; canonical Warship build admission/reservation enforces the cap transactionally. |
| P24 | CONDITIONAL FFY | event inside qualifying Fort area `+20%`; Fort affiliation/field realization remains structure-owned. |
| P25 | MIXED | hard prohibit Atom/MIRV; Hydrogen FFY cost `+50%`; Hydrogen blast **area** `+50%`; geometry projection remains strategic-weapons-owned. |
| P26 | CUSTOM entitlement/transaction | at most one successful MIRV; ordinary affordability/legality remains; successful use consumes `0 FFY`; hard prohibitions still win. |
| P27 | CAPABILITY | SAM may attack ships; exact targeting/damage/cadence/charge arbitration remains focused SAM/strategic-weapons behavior. |
| P28 | CUSTOM destruction lifecycle | qualifying Transport destruction transfers carried Population; attribution/recipient/order remains amphibious-lifecycle behavior. |
| P29 | STRUCTURAL PROFILE | Warship becomes strategic launcher; effective Silo level `max(1, rank)`; mobile launcher charge/readiness lifecycle remains strategic-weapons-owned. |
| P30 | MIXED | Warship movement `+50%`; piracy event `3×`; hard prohibit Warship naval gunfire against ships while preserving Trade capture. |
| P31 | POST-ECHO CONDITIONAL SCALARS + CUSTOM | Warship-specific Port repair radius `2×` and rate `1.5×` run in `CONTEXTUAL_SCALAR` after ordinary Port/Echo specialization; operational-while-repairing remains an explicit non-scalar boundary. |
| P32 | STRUCTURAL PROFILE | Transport embark source -> owned active Port; Transport becomes health-bearing `500 HP`; otherwise ordinary Transport profile. |
| P33 | CUSTOM event side effect | qualifying Train event at owned City also grants `20 × City level` Available Population, Capacity-capped. |
| P34 | MIXED CAPTURED-FACTORY PROFILE | Under `CAPTURE_TRANSFER`, Factory Train-event base value `×1.50`; Tank/Heavy-Artillery Factory construction work rate `×1.50`; repair rate `×1.50`; repair radius `FINAL_OVERRIDE(8 cells)`. Train dispatch-time profile snapshot persistence remains the explicit Factory/FFY lifecycle boundary. |
| P35 | CUSTOM territorial lifecycle | deliberate relinquishment -> neutral Fallout; ordinary abandonment semantics remain terrain/territory-owned. |
| P36 | AXIS + residual lifecycle | neutral settlement Population cost `0.5/cell`; faction-level persistent residual accounting. |
| P37 | MIXED | Transport embark cost flat `+250 FFY`; successful landing can emit the authored Fort-grant boundary while amphibious execution and generic structure admission remain with their focused owners. |
| P38 | CUSTOM capture consequence | automatic defender survives successful capture and remains/returns Available. |
| P39 | STRUCTURAL SPAWN PROFILE | mode-independent two-origin/split-footprint profile; exact Strategic/Random/Fixed resolution is owned by `STRATEGIC_SPAWN.md`. |
| P40 | MIXED PROFILE | SAM range Origin `+50%`; charge capacity final/replacement `1`; recharge `2×`. |
| P41 | STRUCTURAL TRANSACTION | City purchase becomes one direct-L5 purchase at 95% cumulative ordinary cost; fresh construction targets L5 directly and completes after the canonical City build duration without hidden intermediate levels. |
| P42 | MIXED | Warship FFY purchase cost `HARD_ZERO`; purchase Population cost `2,000`; attack range Origin `-33%`. |
| P43 | STRUCTURAL CHASSIS PROFILE | Tank -> Heavy Artillery; establishes cost/build/speed/range/health/attack/capability profile before Tank-scoped Echo specialization. |
| P44 | CUSTOM attack aftermath | successful Tank-chassis Population attack neutralizes deterministic nearby cells + Fallout; not ordinary capture. |
| P45 | STRUCTURAL VISIBILITY | Forest-owned concealment filter; exact visibility/manifestation projection remains with the focused visibility owner. |
| P46 | PERMISSION | allow persistent structures on owned Tundra; separate structure-type prohibitions still win. |
| P47 | CUSTOM capture aftermath | enemy successfully capturing holder's Marsh -> capturer loses +1 Population after ordinary capture. |
| P48 | CLASSIFICATION AXIS | holder-owned Shallow Water becomes population-bearing / +1 Capacity per cell through normal Capacity derivation. |
| P49 | STRUCTURAL OBSERVATION PROFILE | Observation Post effect `REVEAL -> ENEMY_BLACKOUT`; same effective observation-radius axis specializes blackout radius. |
| P50 | STRUCTURAL FIELD PROJECTION | Fort also projects offense equal to **effective** Fort defensive magnitude; cross-type Fort/Command overlap uses domain complement reducer. |
| P51 | STRUCTURAL FIELD PROJECTION | Command Post also projects defense equal to **effective** Command offensive magnitude; cross-type reducer as above. |
| P52 | CUSTOM passive source | All/general FFY source `max(0, Capacity-TotalPopulation)/250`. |
| P53 | CUSTOM passive source | All/general FFY source `2,000/s × ready persistent Silo charges`; excludes P29/SAM charges. |
| P54 | STRUCTURAL SPAWN PROFILE | footprint shape compact -> canonical star profile; exact resolver realization is owned by `STRATEGIC_SPAWN.md`; quota/Starting Population unchanged. |

---

# 10. Origin N01–N18 classification

| ID | Classification | Primary rule target(s) / precedence note |
| --- | --- | --- |
| N01 | NUMERIC AXIS | City-derived Growth contribution `20% less`; level unchanged; later Echo City contribution specializes effective value. |
| N02 | CONDITIONAL TERRAIN PRESSURE | Plains source offensive-pressure component `-25%`. |
| N03 | CONDITIONAL TERRAIN PRESSURE | Desert target defensive-pressure component `-33%`. |
| N04 | CONDITIONAL FFY | Mountain-located positive event `-50%` ordinary yield contribution. |
| N05 | HARD PROHIBITION | Fallout territorial acquisition forbidden; P16 speed/resistance suppression cannot bypass. |
| N06 | HARD TRANSACTION PROHIBITION | cannot spend FFY on ordinary structure upgrades; discounts do not create permission. |
| N07 | HARD OWNERSHIP CAP | maximum one persistent structure of each type across purchase builds, grants, and capture transfers; canonical structure admission/reservation rejects oversubscription and converts failed capture transfer to destruction without undoing the territorial capture. |
| N08 | HARD ZERO | effective Fort defensive-pressure magnitude exactly zero; coverage remains; P09/Echo cannot resurrect; P50 mirrors effective zero. |
| N09 | HARD BUILD PROHIBITION | cannot build Factories; terrain permission/free price cannot bypass; acquired Factory may still function. |
| N10 | NUMERIC AXIS | Fort coverage **area** Origin `-25%`; same Origin slot as P09 area modifier. |
| N11 | TERMINAL HARD ZERO | qualifying FFY event inside applicable SAM area yields exactly zero after ordinary percentages; event identity/side effects remain. |
| N12 | HARD BUILD PROHIBITION | cannot build Warships; P42 Population funding/free FFY cannot bypass. |
| N13 | LANDING SURVIVAL/CUSTOM BOUNDARY | `50%` carried Population dies at landing; exact lifecycle point/rounding remains amphibious-lifecycle-owned. |
| N14 | CUSTOM Trade capture loss | first hostile capture: original owner `-Vowner` once; canonical snapshot definition remains `FFY_ECONOMY.md`-owned. |
| N15 | FLAT AXIS | Transport embarkation `+500 FFY`; same flat slot as P37 `+250`, producing +750 together. |
| N16 | CUSTOM Trade payout inversion | uncaptured success -> owner `-Vowner`; first hostile capture -> owner `+Vowner` once; canonical snapshot definition remains `FFY_ECONOMY.md`-owned. |
| N17 | STRUCTURAL CAPTURE OUTCOME | canonical structure-capture disposition transforms transfer to destruction; the territorial capture still succeeds and successful-transfer effects do not fire. |
| N18 | LATE CONDITIONAL MULTIPLIER | final capture/settlement progress against **non-Fallout** target `×0.50`; Fallout targets exempt. This is not an ordinary additive terrain percentage. |

---

# 11. Echo mapping — all 93 concrete stat/scope keys

Echo identity remains owned by `ECHO_CATALOGUE.md`. This section maps its full V1 concrete modifier pool onto game-wide axis families.

Echo modifiers are ordinary signed percentage specializations unless their Echo owner explicitly changes that rule. Beneficial/harmful **polarity** remains distinct from mathematical sign for costs/cooldowns.

| Echo family/stat | Concrete scopes | Count | Rule-axis family |
| --- | --- | ---: | --- |
| Population Growth | global | 1 | `population.growth.explicitMultiplier` |
| Starting Population | global fraction | 1 | `population.startingFraction` |
| Neutral settlement progress/speed | global | 1 | `combat.acquisitionProgressMultiplier` with `NEUTRAL` condition |
| Offensive pressure | global | 1 | `combat.pressure.offense.global` |
| Defensive pressure | global | 1 | `combat.pressure.defense.global` |
| Counter-response effectiveness while responding | global | 1 | `combat.counterResponse.responseEffectiveness` |
| Terrain offensive pressure | Plains/Highland/Mountain/Desert/Forest/Tundra/Marsh/Shallow Water | 8 | `terrain.pressure.offense[terrain]` |
| Terrain defensive pressure | same 8 terrains | 8 | `terrain.pressure.defense[terrain]` |
| Terrain capture/settlement speed | same 8 terrains | 8 | `terrain.acquisitionMultiplier[terrain]` |
| All FFY event yield | global | 1 | `ffy.eventYield[ALL]` |
| Military/conquest FFY | global | 1 | `ffy.eventYield[MILITARY_CONQUEST]` |
| Naval/trade FFY | global | 1 | `ffy.eventYield[NAVAL_TRADE]` |
| Industrial FFY | global | 1 | `ffy.eventYield[INDUSTRIAL]` |
| Structure build cost | all + 8 structure types | 9 | `structure.transaction.buildCost[scope]` |
| Structure upgrade cost | all + 8 structure types | 9 | `structure.transaction.upgradeCost[scope]` |
| Structure construction time | all + 8 structure types | 9 | `structure.transaction.constructionTime[scope]` |
| City Growth contribution | City | 1 | `structure.effect.cityGrowth` |
| Fort coverage area | Fort | 1 | `structure.field.coverageArea[FORT]` |
| Fort defensive pressure | Fort | 1 | `structure.field.pressureMagnitude[FORT,DEFENSE]` |
| Armored-unit repair radius | Factory | 1 | `structure.repair.radius[FACTORY,ARMORED]` |
| Armored-unit repair rate | Factory | 1 | `structure.repair.rate[FACTORY,ARMORED]` |
| Passive repair radius | Port | 1 | `structure.repair.radius[PORT,NAVAL]` |
| Passive repair rate | Port | 1 | `structure.repair.rate[PORT,NAVAL]` |
| Observation radius | Observation Post | 1 | `structure.observation.radius` — also blackout radius under P49 |
| Coverage area | Command Post | 1 | `structure.field.coverageArea[COMMAND_POST]` |
| Offensive-pressure magnitude | Command Post | 1 | `structure.field.pressureMagnitude[COMMAND_POST,OFFENSE]` |
| Interception range | SAM | 1 | `structure.interception.range[SAM]` |
| Recharge/cooldown time | SAM | 1 | `structure.charge.rechargeTime[SAM]` |
| Recharge/cooldown time | Silo | 1 | `structure.charge.rechargeTime[MISSILE_SILO]` |
| Mobile-unit FFY purchase cost | Warship/Tank | 2 | `unit.transaction.purchaseCost[unit]` |
| Mobile-unit movement speed | Warship/Tank | 2 | `unit.movementSpeed[unit]` |
| Mobile-unit attack range | Warship/Tank | 2 | typed ordinary attack-range set for each chassis; never Trade-capture/launcher range |
| Mobile-unit damage | Warship/Tank | 2 | numeric attack-damage set for each chassis; never binary Train destruction/P44 footprint |
| Mobile-unit maximum health | Warship/Tank | 2 | `unit.maxHealth[unit]` |
| Warhead projectile speed | all/Atom/Hydrogen/MIRV | 4 | `weapon.projectileSpeed[scope]` |
| Strategic-weapon FFY cost | Atom/Hydrogen/MIRV | 3 | `weapon.transaction.purchaseCost[type]` |
| Blast area | Atom/Hydrogen | 2 | `weapon.blastArea[type]` |
| **Total** |  | **93** |  |

The 12,927 derived Echo identities remain generated from these concrete keys and Echo shape rules; they are not 12,927 hand-authored modifier definitions.

### 11.1 Required Echo ordering examples

- Tank-scoped Echoes specialize the P43 Heavy-Artillery profile after the Origin structural transform.
- Observation-radius Echoes specialize the radius used by P49 blackout rather than restoring observation.
- Fort-pressure Echoes specialize the effective Fort magnitude; P50 mirrors that effective magnitude.
- Command-pressure Echoes specialize the effective Command magnitude; P51 mirrors that effective magnitude.
- P31's Warship-only Port repair scalar runs after ordinary Port repair Echo specialization.
- P34's Factory repair rate runs after ordinary Factory repair Echo specialization; its authored 8-cell repair radius is a conditional `FINAL_OVERRIDE` for qualifying Tank/Heavy-Artillery repair.
- A stat may become inert because a hard Origin rule removes the relevant capability. Inert is legal; it is not a hidden compatibility veto.
- A hard zero/prohibition remains terminal across ordinary Echo specialization. Examples include N08 Fort defensive pressure and N12 Warship build permission.
- Counter-response-effectiveness Echoes are legal with P04 but inert while P04's terminal `FINAL_OVERRIDE(1.0)` applies.

---

# 12. Authoritative composition cases

These are composition decisions owned by this contract rather than by a focused subsystem's geometry/lifecycle implementation.

## 12.1 P09 + N10 — Fort coverage area

Both are Origin-layer additive percentages on the same semantic **Fort coverage area** axis:

```text
+10% + (-25%) = -15%

effectiveFortCoverageArea
= ordinaryFortCoverageArea × 0.85
```

This contract stops at effective area. Deterministic area -> radius/raster realization is owned by `TERRAIN_AND_STRUCTURES.md`.

## 12.2 P23 + P42 — Warship ordinary attack range

Both are Origin-layer additive percentages on the same ordinary Warship naval-gun attack-range axis:

```text
+20% + (-33%) = -13%
```

With the current baseline 130-cell naval-gun range:

```text
effective Origin Warship gun range
= 130 × 0.87
= 113.1 cells
```

Trade Ship capture distance and strategic-launcher behavior are distinct hooks and are unchanged by this range arithmetic.

## 12.3 P09 Fort defensive pressure

P09's `+9% Fort defensive pressure` is a **relative percentage specialization of the effective level-dependent Fort pressure magnitude**, not `+9 percentage points`.

Current baseline -> P09 Origin-effective magnitude:

| Level | baseline | P09 |
| ---: | ---: | ---: |
| L1 | 10% | 10.90% |
| L2 | 15% | 16.35% |
| L3 | 20% | 21.80% |
| L4 | 25% | 27.25% |
| L5 | 30% | 32.70% |

If a future trait means percentage **points**, it must say so and use a flat/points unit rather than `ADD_PERCENT`.

## 12.4 N08 + P09 / Echo / P50

N08 is a terminal `HARD_ZERO` on the holder's Fort defensive-pressure magnitude.

Therefore:

- P09 may still modify Fort cost and coverage area;
- P09 cannot restore defensive pressure;
- Fort-pressure Echoes cannot restore defensive pressure;
- P50 reads the **effective** Fort defensive magnitude and therefore mirrors zero offense from that Fort pressure under N08;
- Fort coverage remains present for independent area consumers such as P18/P24 unless another rule removes it.

## 12.5 Hard legality versus ordinary benefits

Hard permission/admission rules use separate legality axes and are not numeric price/range values.

Canonical examples:

- N05 + P16: Fallout remains uncapturable; P16 only removes ordinary Fallout resistance when acquisition is otherwise legal.
- N09 + P46: Tundra terrain may become structure-eligible, but Factory construction remains forbidden by N09.
- N12 + P42: a Population-funded/zero-FFY Warship is still unbuildable.
- N06 + P17: a cheaper ordinary FFY upgrade remains a forbidden FFY upgrade transaction.
- P11 + N07: P11's dynamic SAM entitlement and N07's one-per-type cap both target `STRUCTURE_OWNERSHIP_CAP`; `MIN` produces the most restrictive currently applicable hard cap.

## 12.6 N11 hard-zero FFY

Eligible ordinary yield percentages normalize first. N11 then hard-zeroes the qualifying event's FFY result. No later ordinary positive yield specialization resurrects it.

## 12.7 P37 + N15 Transport embark cost

These are flat additions on the dedicated embark-cost hook:

```text
baseline 0 FFY
+ P37 250 FFY
+ N15 500 FFY
= 750 FFY
```

## 12.8 P50/P51 are a domain reducer, not the generic percent algebra

Same-type field overlap continues to use the structure owner's strongest-applicable rule.

Where distinct Fort and Command-Post field types both contribute to the same pressure direction, use the Origin catalogue's explicit complement reducer:

```text
combinedBonus = 1 - (1-A) × (1-B)
```

This is a named land-combat/structure-field aggregation rule. It must not be generalized into the default same-axis percentage behavior.

## 12.9 P34 captured-Factory profile

P34's player-facing `50% increased effectiveness` is projected into the exact Factory effects canonically defined by the Factory owner:

```text
Factory Train-event base value          ×1.50
Tank-chassis construction work rate     ×1.50
Tank/Heavy-Artillery repair rate        ×1.50
Tank/Heavy-Artillery repair radius      8 cells
```

Every contribution requires current ownership acquisition path `CAPTURE_TRANSFER`; the chassis-sensitive effects additionally require the target unit to be `TANK` or `HEAVY_ARTILLERY`. These are true AND-conjunctions, not synthetic composite condition IDs.

The Train base-value transform is snapshotted into a dispatched Train's Factory economic profile by the Factory/FFY lifecycle. That snapshot persistence is the remaining custom-domain boundary; the four numeric effects themselves are ordinary typed composition surfaces.

---

# 13. Settled composition decisions exposed by the inventory

The inventory exposed additional cross-source cases that are now explicit in the V1 contract and executable schema.

## 13.1 Pressure component algebra

Terrain pressure, global/conditional rule pressure, Fort/Command fields, P03 component suppression, and the P50/P51 complement reducer meet in one final `A`/`D` calculation but do **not** share one unordered percentage bucket.

The V1 contract is component-aware. Conceptually:

```text
raw lane pressure
× effective terrain component
× effective general/conditional-rule component
× effective structure-support component
= effective lane pressure
```

The typed rule surfaces preserve those distinctions:

- terrain offense/defense is specialized on terrain pressure axes;
- global and conditional rules such as P18 use global/contextual pressure stages rather than masquerading as terrain;
- Fort/Command pressure magnitudes are materialized independently, same-type overlap is resolved by the structure rule, and cross-type overlap uses the explicit complement reducer;
- P03 suppresses only the hostile Fort defensive-pressure component and therefore cannot erase Mountain/terrain defense, Command-derived defense, or global defensive specialization;
- P50/P51 consume **effective** structure magnitudes, so terminal rules such as N08 naturally propagate through mirrored fields.

Source provenance remains separate from semantic stage. In particular, an Origin-authored late contextual rule is legal when the axis explicitly admits it; N18 is the current motivating example.

## 13.2 P04 fixed response effectiveness versus Echo

P04 is canonically `FINAL_OVERRIDE(1.0)` on response-side counter-response effectiveness.

While P04 applies:

- the final response-side effectiveness is exactly `1.0`;
- response-effectiveness Echoes may still be legally equipped and compiled;
- those ordinary Echo specializations are inert on this hook because the terminal final override wins;
- no trait/Echo insertion order is consulted.

## 13.3 Origin profile transforms followed by Echo/contextual specialization

The following use explicit structural/Origin/Echo/contextual ordering unless a focused owner defines a named domain order:

- P43 Tank -> Heavy Artillery, then Tank-scoped cost/speed/range/damage/health Echoes;
- P49 Observation -> blackout, then Observation-radius Echo;
- P40 effective SAM range/recharge profile, then SAM range/recharge Echoes;
- P25 Hydrogen cost/blast-area Origin profile, then matching weapon Echo specialization;
- P31 consumes the already-effective Port repair field in `CONTEXTUAL_SCALAR`, after ordinary Port/Echo specialization;
- P34 Factory repair rate likewise runs contextually after ordinary Factory/Echo repair-rate specialization, while P34's 8-cell Factory repair radius is a conditional final override.

## 13.4 Hard-zero purchase/upgrade cost versus percentage cost modifiers

P11 SAM build/upgrade FFY cost and P42 Warship FFY purchase cost are true zero-cost Origin rules. Ordinary Echo/ruleset percentage cost modifiers must not turn zero back into a positive value.

P21/P26 are different: they are transaction-consumption rules that still require ordinary affordability before spending zero. They must not be encoded as the same `HARD_ZERO` price operator.

---

# 14. Focused subsystem ownership boundaries

The composition registry must not invent or duplicate focused subsystem realization. This contract owns **how** rule-bearing sources combine; exact geometry, lifecycle, transaction, scheduler, visibility, and resolver mechanics remain with the canonical owners listed at the top of this document and in [`docs/README.md`](./README.md).

Stable boundaries relevant to the current V1 profile include:

- Population/growth mechanics own P02's replacement-curve realization; this layer owns only the structural profile identity and composition position.
- `TERRAIN_AND_STRUCTURES.md` owns structure admission/capture, field geometry/affiliation, generic structure grant realization, and persistent Silo/SAM structure level, charge-capacity, recharge, and readiness lifecycle; this layer owns effective modifier axes and hard-cap/permission composition.
- `NAVAL_AND_STRATEGIC_WEAPONS.md` owns projectile/warhead realization, strategic-launch transactionality, mobile Warship launcher state, focused SAM weapon/interception behavior, and amphibious lifecycle details; this layer owns their exposed effective-rule surfaces and explicit custom boundaries.
- `FFY_ECONOMY.md` owns Factory/Train scheduler lifecycle, voyage snapshots, event values/locations, and payout realization; this layer owns the numeric composition surfaces and custom-domain declarations that those mechanics consume.
- `STRATEGIC_SPAWN.md` owns Strategic/Random/Fixed origin resolution, P39 slot/footprint realization, singular Spawn start-effect ordering, and P54 star geometry; this layer owns the structural Spawn profile IDs and their composition.
- Focused visibility/territory owners retain concealment, manifestation, abandonment, and other lifecycle realization where this inventory exposes only a profile/custom boundary.

Work/progress state for any focused subsystem belongs in GitHub issues and pull requests, not in this canonical mechanics contract. A focused owner becoming more complete does not require this document to mirror its implementation-status ledger; this document changes only when the composition interface or owned algebra changes.

---

# 15. Compiled, normalized, and materialized effective-rule representation

The machine-readable implementation compiles the **complete** rule-bearing profile before subsystem execution. Static contributions, symbolic dynamic providers, and explicit custom-domain declarations are all first-class compiled content.

A static normalized declaration contains the semantic equivalent of:

```text
schema/algebra version
axis family + typed scope
slot
operator/reducer-compatible operand
source kind + stable provenance ID
optional canonical typed condition conjunction/component ID
terminality/constraint metadata where applicable
```

Example authored contribution:

```text
source       = ORIGIN:P23
target       = unit.attack.range { WARSHIP, NAVAL_GUN }
slot         = ORIGIN_PERCENT
operation    = ADD_PERCENT
value        = +2000 bp
```

P42 contributes `-3300 bp` to the same slot. Normalization produces the canonical mathematical result for that slot while the compiled profile retains authored provenance for diagnostics.

A symbolic dynamic provider instead records the same target/stage/provenance identity plus an authoritative state dependency, closed formula, and result operand kind. It remains symbolic in canonical compilation; runtime materialization evaluates only that closed provider against authoritative state. P17's result is therefore an exact rational rather than an approximated basis-point scalar.

At runtime, an evaluated dynamic provider is converted into the same normalized reducer-term vocabulary used by static rules:

- `ADD_PERCENT + BASIS_POINTS` -> `SUM`;
- `MULTIPLY + exact rational` -> `PRODUCT`;
- `CAP_LIMIT + INTEGER` -> `MIN`.

Scope selection then combines matching static normalized rules and resolved dynamic terms in the axis's declared stage order. Wildcard authored scopes participate normally. Condition-bearing terms must be resolved against authoritative domain context before materialization; the generic materializer rejects unresolved conditions rather than guessing applicability.

Custom-domain declarations name the genuine lifecycle/resolver boundary instead of allowing an unimplemented axis effect to disappear behind a generic `CUSTOM` label.

Singleton stages are validated against **scope and typed-condition-conjunction overlap**, not merely axis/stage identity. Two singleton transforms whose conjunctions are provably mutually exclusive may coexist; transforms that may apply simultaneously remain a validation error.

Runtime scope/condition payloads use exact discriminated-union shapes. Unknown extra fields are rejected rather than being semantically ignored while still changing serialized bytes. Set-valued capability/component operands are sorted and deduplicated canonically.

Controllers should consume materialized typed effective mechanics/quotes such as the existing `MechanicsApi` contracts. They should not reconstruct raw precedence from Pxx/Nxx/Echo lists.

The generic `EffectiveModifierSheet` may remain useful for introspection/less common surfaced values, but first-class mechanics should prefer typed effective specs and action quotes.

---

# 16. Static validation requirements

Before a rule-bearing catalogue/ruleset version is deployable, static validation must prove at least:

1. every declaration/provider references a known axis family and valid exact-shape typed scope;
2. every operator is legal in the chosen axis slot;
3. every static operand unit/value and dynamic-provider result kind matches the axis/operator contract;
4. every slot has a declared reducer;
5. same-slot commutative inputs are independent of input/source order;
6. no arbitrary per-modifier numeric priority is accepted where the schema does not explicitly allow an ordered custom transform;
7. explicit dependency graphs are acyclic;
8. no content-legal combination creates two unresolved overlapping `SINGLETON` replacements/structural transforms on one facet, including conjunction-aware overlap;
9. hard prohibitions cannot be bypassed by price discounts, grants, terrain permissions, or numeric modifiers on other hooks unless an explicit mechanic says so;
10. hard-zero/final-override semantics cannot be resurrected by later ordinary modifiers;
11. every builder-legal Origin's **complete profile** — static rules, dynamic providers, and custom-domain declarations — compiles to one deterministic representation;
12. equivalent permutations of all raw profile streams serialize to byte-identical compiled output;
13. every current Echo concrete stat/scope key maps to exactly one valid game-wide axis target;
14. every Pxx/Nxx direct effect maps to one or more valid axes/constraints/dynamic providers or is explicitly registered under the exact custom lifecycle domain it requires;
15. representative golden combinations produce the authoritative results in §12;
16. source provenance is valid for the semantic stage it authors, while provenance and execution stage remain independent concepts;
17. malformed runtime scope/condition payloads, wildcard equality predicates, and noncanonical unknown fields are rejected;
18. set-valued operands have one canonical sorted/deduplicated identity;
19. focused subsystem ownership boundaries are surfaced explicitly rather than silently guessed by the normalizer or duplicated as secondary mechanics.

For the current finite Origin catalogue, the structural/static compiler enumerates **every builder-legal trait combination using the complete profile representation**. Expensive runtime/headless certification remains domain-focused under the existing Origin-validation architecture rather than simulating every possible dynamic state value or every named Origin instance.

Property tests additionally permute raw static/dynamic/custom input streams and prove canonical output is unchanged where semantics are commutative.

---

# 17. Implementation and conformance boundary

The V1 composition foundation defines and requires:

1. the V1 axis family/scope/type vocabulary derived from the game-wide inventory;
2. code-readable axis/slot/operator/unit/reducer types and registry;
3. explicit Origin manifests and the complete 93-key Echo -> axis mapping;
4. conjunction-capable exact-shape conditions and canonical acquisition-path provenance;
5. complete compiled profiles containing normalized static rules, symbolic dynamic providers, and exact custom-domain declarations;
6. exact rational dynamic evaluation where basis points cannot faithfully represent the formula;
7. runtime materialization that combines normalized static terms and authoritative-state-resolved dynamic terms through the same axis stage reducers;
8. canonical normalization/serialization and full profile validation;
9. exhaustive builder-legal **complete Origin-profile** compilation validation;
10. permutation/property and authoritative golden-case coverage;
11. provenance-vs-stage validation and conjunction-aware singleton-conflict validation;
12. explicit focused-subsystem ownership boundaries rather than guessed composition semantics.

Focused realization work named in §14 is deliberately not composition-layer work. Owning subsystem implementations consume this compiled/effective-rule contract as those mechanics are implemented.

A conforming composition implementation must satisfy this durable gate:

> **No ambiguous current Origin/Echo modifier definition remains in the composition layer; the complete current V1 modifiable-axis vocabulary is represented; every current static, dynamic, and explicitly custom rule declaration can be classified and compiled; normalization/serialization is deterministic; every builder-legal complete Origin profile statically compiles; and focused subsystem semantics remain explicit ownership boundaries rather than hidden arithmetic or duplicated status.**

Repository/test gates provide evidence that an implementation conforms to this contract; candidate-head or CI completion state belongs in GitHub/CI rather than in this canonical document.

---

## Downstream integration requirements

- Consume the compiled/effective-rule contract from each focused gameplay subsystem as that subsystem's implementation lands; do not reimplement Origin/Echo precedence locally.
- Keep focused mechanics with their canonical owners; do not copy GitHub blocker/progress state into this contract.
- Preserve the mandatory gameplay / Origins-traits / Character-AI cross-layer impact record when downstream mechanics begin consuming these effective rules.
- Increment `RULE_COMPOSITION_VERSION` only for a semantic/schema compatibility change that can alter normalized interpretation or replay identity.
