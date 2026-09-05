# Open Fufu — Origin Validation Coverage Registry

## Status and authority

This file is the **canonical owner for Origin trait validation coverage, mechanical dependency traces, required integration seams, external validation dependencies, and explicit Origin-interaction test obligations**.

It does **not** own Origin mechanics, costs, builder legality, subsystem baselines, or unresolved gameplay semantics. Those remain with their existing canonical owners:

- Origin trait mechanics/costs/composition: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- game-wide Population/territory/combat invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- migration validation architecture and deployment eligibility: [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md);
- Strategic Spawn: [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md);
- FFY/Train/Trade economy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- terrain/persistent structures/baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Warships/Transports/strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- combat tuning: [`COMBAT_TUNING.md`](./COMBAT_TUNING.md);
- Minor Factions: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md).

Trait-effect wording in this file is explanatory shorthand only. If it disagrees with the Origin catalogue or a focused mechanic owner, the mechanic owner wins and this registry must be updated.

---

# 1. Coverage model

Do not model coverage as a flat `trait -> domains[]` tag list. Each trait is audited through four relationship classes:

## 1.1 Direct transformation

The trait directly changes a value, rule, permission, event, lifecycle, or state owned by a gameplay subsystem. That subsystem owns the corresponding Origin-conformance validation.

## 1.2 Required integration seam

The trait's direct transformation produces or consumes state across a subsystem boundary, and correctness at that boundary is not proven by either subsystem in isolation.

Examples:

```text
Spawn output -> Population initialization
structure capture -> FFY event generation
Fort field -> land-combat pressure
```

A required seam receives explicit integration coverage.

## 1.3 External semantic dependency

The trait reads or depends on another canonical mechanic without owning that mechanic. If the dependency is unresolved or unavailable, the trait's affected conformance may be `BLOCKED`/`UNAVAILABLE` under the validation status model in `OPENFRONT_INTEGRATION_PLAN.md`.

## 1.4 Ordinary downstream consumption

Do **not** recursively tag every subsystem that later consumes ordinary valid game state created by a trait. Once a seam has produced canonical state correctly, ordinary downstream consumers are covered by their normal subsystem invariants unless another trait creates a direct interaction.

Example:

```text
P01 -> larger Initial Territory -> larger Capacity/Starting Population
```

requires Spawn -> Population-initialization coverage. It does **not** make P01 a special-case combat, defense, or economy mechanic merely because those systems later consume ordinary Population values.

---

# 2. Trait audit procedure

For every `Pxx`/`Nxx` trait, record:

1. the canonical value/state/action the trait directly changes;
2. the subsystem(s) owning that mechanic;
3. outputs crossing into another subsystem that require explicit seam validation;
4. external canonical state the trait reads/depends upon;
5. other traits modifying the same effective hook/state that require explicit interaction consideration;
6. ordinary downstream consequences that must **not** become redundant trait-specific validation;
7. any discovered mechanic-definition hole that prevents honest certification.

A mechanic-definition hole is recorded here only as a **certification blocker/reference**. This registry must not invent the missing gameplay rule.

---

# 3. P01–P10 coverage

## P01 — Domain Expansion

### Direct transformation

- **Owner:** Strategic Spawn.
- Changes the faction's final modified Initial-Territory population-bearing quota from the ordinary value by the P01 modifier.
- Spawn must use the modified total as the actual footprint target, not apply the modifier after territory generation.

### Required integration seams

**Spawn -> territorial ownership / Population initialization**

After Spawn resolves the final population-bearing cells:

- ownership must contain the modified quota when legal reachable geography permits it;
- Population Capacity must reflect the resulting owned population-bearing cells;
- Starting Population must be calculated from the **final modified Initial Territory** under the game-wide initialization rule.

For the ordinary 1,000-cell baseline, P01 therefore implies the expected initialization case:

```text
Initial Territory     = 1,150 population-bearing cells
Population Capacity   = 1,150
Starting Population   = 575
```

provided the generated quota cells are population-bearing under that faction's effective classification.

### External semantic dependencies

- faction-specific effective population-bearing classification used by Spawn quota accounting;
- ordinary Starting-Population initialization semantics.

### Explicit interactions to cover

- **P01 + P39:** P39 must split the **modified total** quota rather than apply P01 independently to each ordinary footprint. For the current values, total 1,150 divides into 575 + 575 and Starting Population remains one global 575 pool.
- **P01 + P54:** P54 geometry must preserve the P01-modified total quota; P54 must not reset the target to the ordinary value.
- **P48:** inspect when P48 is audited because it changes faction-specific population-bearing classification for owned Shallow Water and may therefore affect Spawn quota accounting/initialization semantics.

`P01 + P39 + P54` is not currently builder-legal because positive spend exceeds the public 20-point cap; runtime certification must respect builder legality rather than test impossible public builds as if they were required combinations.

### Ordinary downstream consumption — no P01-specific validator

Once correct ownership, Capacity, and Starting Population exist, ordinary growth, automatic defense, commitments, and other Population consumers should handle those values through their normal invariants.

---

## P02 — The Era of Humans

### Direct transformation

- **Owner:** game-wide Population Growth.
- Replaces the ordinary Population-utilization growth curve `U(u)` while leaving the baseline Capacity exponent, base-growth equation, and unrelated explicit growth modifiers to their normal owners unless the canonical trait definition says otherwise.

### Required integration seams

**Population utilization curve -> final growth modifier pipeline**

Validation must prove that the replacement utilization curve still composes with ordinary explicit Population-Growth sources such as:

- terrain-share growth modifiers;
- City-derived growth modifiers;
- other separately surfaced growth modifiers.

P02 must not erase, duplicate, or reorder unrelated growth contributions merely because it replaces `U(u)`.

### External semantic dependencies

- `Total Population`;
- `Population Capacity`;
- the canonical final Population-Growth composition order.

### Explicit interactions to cover

- **P02 + N01:** P02 changes utilization behavior while N01 changes City Population-Growth contribution. Each must remain confined to its own hook in the final growth calculation.
- **P48:** inspect when P48 is audited because changing Capacity changes both base growth and utilization. This may prove to be ordinary state propagation rather than a special P02 implementation path.

### Certification blocker / mechanic-definition finding

The catalogue currently describes an accepted "30–70% profile". Certification requires the actual replacement curve/anchors to be canonically available to implementation; this validation registry does not invent them.

### Ordinary downstream consumption

Population produced by the resulting valid growth calculation is ordinary Available/Total Population and does not create P02-specific obligations for unrelated consumers.

---

## P03 — Imagine Breaker

### Direct transformation

- **Owner:** land-combat effective defensive-pressure composition.
- When the P03 holder attacks, hostile **Fort-derived defensive-pressure contribution** is ignored.
- P03 must not remove unrelated defensive-pressure sources.

### Required integration seams

**Fort effective field -> land-combat defensive pressure**

Validation must cover:

- target outside Fort coverage -> P03 has no Fort contribution to remove;
- target inside Fort coverage with no automatic defender -> the Fort already contributes no defensive pressure and P03 creates no special behavior;
- target inside Fort coverage with an actual automatic defender -> P03 removes the Fort-derived contribution;
- terrain/Command-Post/other non-Fort defense remains intact unless separately modified.

### External semantic dependencies

- effective Fort coverage;
- effective Fort defensive-pressure magnitude;
- ordinary rule that Fort pressure applies only when a real automatic defender exists.

### Explicit interactions to cover

- **P03 + P09:** P03 must ignore the effective P09-modified Fort contribution, not merely the baseline magnitude/coverage.
- **P03 + N08:** N08 already removes Fort defensive pressure; P03 becomes mechanically inert with respect to that removed source without creating an exception.
- **P03 + N10:** reduced Fort coverage changes where a Fort contribution exists for P03 to ignore.
- **Non-Fort defense negative assertion:** later defensive sources such as P51 Command-Post defense must not be accidentally filtered by P03 merely because they contribute to the same final defensive-pressure axis.

### Ordinary downstream consumption

Any resulting faster capture progress is ordinary combat output and does not require a separate P03 territorial-ownership validator.

---

## P04 — Level 0

### Direct transformation

- **Owner:** active counter-response combat.
- Fixes only the **response-side counter-response effectiveness** hook at `1.0`.
- The attack-side effectiveness calculation remains ordinary unless another explicit rule changes it.

### Required integration seams

No separate subsystem seam is currently required. The core conformance suite must cover representative attacker/response commitment relationships:

- parity;
- attacker larger than response;
- response larger than attacker;
- small imbalance;
- extreme imbalance.

The critical assertion is that P04 removes response-side imbalance bonus/penalty while leaving the attack-side calculation ordinary.

### External semantic dependencies

- canonical counter-response `A/R` imbalance calculation and deterministic residual/casualty accounting.

### Explicit interactions to cover

No mandatory Pxx/Nxx interaction has been identified yet. Future Echo/ruleset transformations of the same surfaced counter-response hooks belong to the general effective-rule/composition validation layer unless they create a specific mechanical interaction.

---

## P05 — Big Shot

### Direct transformation

P05 is cross-domain by construction:

- **trigger owner:** territorial/structure capture lifecycle;
- **output owner:** FFY economy event generation.

A qualifying successful enemy-structure capture generates a **Military / conquest FFY event**.

### Required integration seams

**Successful structure ownership transfer -> P05 conquest FFY event**

At minimum validate:

- failed capture -> no P05 event;
- captured cell with no qualifying enemy structure -> no P05 structure event;
- successful qualifying structure transfer -> exactly the canonical P05 event;
- capture prevented / structure destroyed instead of transferred -> no capture-dependent P05 event.

The generated event must then enter the ordinary Military/conquest FFY modifier pipeline rather than use a duplicate private payout system.

### External semantic dependencies

- canonical structure capture/transfer event identity;
- canonical P05 base event value;
- canonical P05 event location, if location-sensitive FFY modifiers can consume the event.

### Explicit interactions to cover

- **P05 + N17:** N17 destroys a structure the holder would otherwise capture; the catalogue explicitly requires capture-dependent Origin effects not to fire, so P05 must not generate the event.
- **P05 + P34:** a conquered Factory may simultaneously become a P34-transformed captured Factory while P05 generates the conquest event; both effects must coexist without duplicate/missing ownership transition.
- **P14 / P24:** inspect after P05 event-location semantics are canonically closed because those traits condition FFY yield on spatial location.

### Certification blocker / mechanic-definition finding

The currently inspected canonical material identifies the event family but does not close the P05 event's base-value rule or location semantics. Validation can map this dependency now but must not invent those mechanics.

---

## P06 — See You, Space Cowboy

### Direct transformation

- **Owner:** Trade Ship physical movement/lifecycle in the FFY/Trade subsystem.
- Applies `+25%` Trade Ship speed to the baseline physical vessel speed.

### Required integration seams

**Trade Ship motion -> Warship pursuit/capture**

The modified speed must be consumed by the actual physical movement simulation used by Warship pursuit and Trade-Ship capture. This proves the surfaced modifier is not a dead/display-only value.

### Required non-effect assertions

P06 must not by itself modify:

- planned route length;
- raw cargo value, which is route-length based;
- dispatch interval/cadence;
- destination-selection policy;
- payout multipliers.

### External semantic dependencies

- ordinary Trade Ship route/movement model;
- ordinary Warship pursuit/capture geometry.

### Explicit interactions to cover

No dedicated P06 + P08 case is required merely because both are trade traits: speed and wartime payout are independent hooks. Capture/piracy traits such as P30/N14/N16 should be inspected when those traits are audited for any genuine same-lifecycle interaction.

---

## P07 — Galaxy Express 999

### Direct transformation

- **Owner:** Factory Train dispatch scheduling / Train economy.
- Each Factory tracks its own count of normal primary Train dispatches; every fourth normal primary dispatch simultaneously launches one additional bonus Train.
- The bonus Train must not occupy/delay the primary slot and must receive an independently generated deterministic ordinary route.

### Required integration seams

**Persistent Factory lifecycle -> Train service scheduler**

The P07 per-Factory dispatch state must attach to the correct physical Factory lifecycle.

**Bonus Train -> ordinary Train lifecycle/economy**

A bonus Train must use the ordinary Train systems for:

- route generation;
- station events;
- dwell;
- destruction;
- interception;
- replay/determinism.

The expected primary-dispatch sequence includes:

```text
#1 -> 1 Train
#2 -> 1
#3 -> 1
#4 -> 2
#5 -> 1
#6 -> 1
#7 -> 1
#8 -> 2
```

with independent counters per Factory. Train destruction must not reset the sequence.

### External semantic dependencies

- persistent Factory identity/lifecycle;
- normal primary Train dispatch identity;
- canonical deterministic ordinary Train route generation.

### Explicit interactions to cover

- **P07 + P33:** extra Trains can generate extra qualifying Train events and therefore P33 Population events; the bonus Train must be treated as an ordinary qualifying Train.
- **P34:** inspect how `2x ordinary Factory effect` for conquered Factories composes with P07's explicit per-fourth-dispatch throughput transformation.
- **N09:** inability to build Factories does not by itself suppress P07 if a Factory is acquired through another legal path.
- **N17:** may prevent conquest acquisition by destroying the structure instead.

### Certification blocker / mechanic-definition finding

The per-Factory counter's ownership-transfer semantics should be canonically explicit before certification: if a physical Factory changes owner, validation must know whether the normal-primary-dispatch sequence persists with that Factory or resets under the new owner. This registry does not choose the rule.

---

## P08 — Tea Time

### Direct transformation

- **Owner:** FFY external-trade calculation.
- Changes the ordinary earning-side wartime external-trade multiplier from `0.50x` to `1.00x`.
- Applies wherever the canonical external wartime trade multiplier is consumed, including maritime Trade Ship completion and external Train station trade.

### Required integration seams

**`atWar` lifecycle -> maritime external-trade payout**

**`atWar` lifecycle -> rail external-trade payout**

When the canonical lifecycle exists, validation must include at minimum:

- peace;
- transition into `atWar`;
- sustained/refreshed `atWar`;
- expiration/exit from `atWar`;
- both maritime and rail external trade.

### External semantic dependencies

- canonical symmetric `atWar` lifecycle and timeout.

Until that mechanic is closed/implemented, affected P08 conformance is legitimately `BLOCKED`/`UNAVAILABLE`; validation must not invent a temporary hostility timeout solely to make the test pass.

### Explicit interactions to cover

- **N14/N16:** inspect when audited because they snapshot/use owner-side Trade-voyage value around capture; whether P08 influences those values must follow the canonical `Vowner` definition.

No bespoke P06/P07 combination test is required when those traits merely alter speed/count while P08 independently alters the wartime payout hook.

---

## P09 — Wall Maria

### Direct transformations

- **Owner:** persistent Fort structure profile / transaction semantics for Fort cost and Fort coverage.
- **Owner:** land-combat integration for the resulting Fort defensive-pressure contribution.

P09 modifies three distinct Fort properties:

- Fort coverage area;
- Fort defensive pressure;
- Fort FFY cost.

### Required integration seams

**Fort effective field -> automatic-defense / land-combat pressure**

Validation must prove:

- outside effective Fort coverage -> no Fort defensive effect;
- inside coverage with no automatic defender -> Fort does not manufacture a defender;
- inside coverage with a real automatic defender -> effective P09 Fort pressure applies through the ordinary defensive-pressure pipeline.

**Fort transaction -> structure affordability/payment**

The effective reduced Fort cost must be used by the canonical structure purchase/upgrade transaction. This is a structure transaction obligation; it does not make P09 a generic FFY-income mechanic.

### External semantic dependencies

- canonical level-dependent Fort coverage and defensive-pressure baselines;
- automatic-defender presence;
- structure transaction/cost composition order.

### Explicit interactions to cover

- **P03:** P03 must ignore the effective P09-enhanced Fort defensive contribution.
- **P18:** increased effective Fort coverage changes which attacking source cells qualify for P18.
- **P24:** increased Fort area changes which spatial FFY events qualify for P24.
- **P50:** P50 consumes the Fort's effective defensive-pressure magnitude and existing coverage to create offense; P09 changes both inputs.
- **N08:** removes Fort defensive-pressure benefit.
- **N10:** modifies Fort coverage area on the same structural axis.
- **P21:** inspect transaction composition because P21 still requires ordinary affordability/legality before zeroing the first successful purchase's FFY consumption.

### Certification blocker / mechanic-expression findings

Before implementation/certification, the canonical mechanic representation must make unambiguous:

- how authored `+10% Fort coverage area` maps to deterministic raster coverage when the baseline registry exposes radius values;
- how authored `+9% Fort defensive pressure` composes with level-dependent baseline Fort defensive-pressure values.

This registry records the need; it does not choose those formulas.

---

## P10 — Scorpion's Tail

### Direct transformation

- **Owner:** strategic-weapon projectile/motion mechanics.
- Applies `+100%` to the canonical projectile class or classes covered by the trait's `warhead projectile speed` definition.

### Required integration seams

**Projectile motion -> SAM interception**

The modified physical speed must reduce travel/interception time through the ordinary interception simulation rather than bypassing it.

**Projectile motion -> MIRV separation**

Where the affected projectile participates in MIRV carrier/separation semantics, changing speed must preserve the canonical physical separation position/fraction while changing elapsed travel time, unless the final canonical projectile classification excludes the carrier.

**Projectile motion -> replay/determinism**

Same bound inputs/version/seed must reproduce identical projectile trajectories, separation/interception outcomes, and authoritative results.

### Required non-effect assertions

P10 alone must not change:

- blast geometry/effect;
- weapon FFY cost;
- launcher legality;
- MIRV target distribution;
- payload/warhead count.

### External semantic dependencies

- canonical strategic-projectile classification;
- ordinary deterministic projectile motion;
- SAM physical-entry interception semantics;
- MIRV carrier/separation semantics where applicable.

### Certification blocker / mechanic-definition finding

The trait wording `warhead projectile speed` must canonically define whether it includes:

- Atom/Hydrogen projectiles;
- the pre-separation MIRV carrier;
- post-separation MIRV warheads.

The baseline strategic-weapon owner distinguishes carrier speed from post-separation warhead speed, so validation must not guess the affected set.

### Explicit interactions to cover

Later strategic-weapon/SAM traits must be inspected as they are audited, especially any trait altering weapon-family access, MIRV use, launcher identity, or SAM interception. No speculative all-pairs matrix is created here.

---

# 4. Running mechanic-closure findings

These are **not #31 validation-design decisions**. They are mechanic-definition questions discovered because honest certification requires a canonical answer.

| Trait | Finding | Validation consequence |
| --- | --- | --- |
| P02 | Exact replacement `30–70%` Population-utilization curve/anchors must be canonically available. | P02 semantic conformance cannot be finalized without the intended curve. |
| P05 | Structure-capture FFY event base value and location semantics are not closed in the inspected canonical material. | P05 payout and spatial-modifier integration cannot be fully certified. |
| P07 | Per-Factory normal-primary-dispatch counter behavior across Factory ownership transfer should be explicit. | Captured-Factory P07 lifecycle scenario cannot have a canonical expected result until defined. |
| P09 | `+10% Fort coverage area` needs deterministic representation against radius-based baseline data; `+9% Fort defensive pressure` needs unambiguous composition semantics. | Structure/combat projection cannot be finalized by guesswork. |
| P10 | `warhead projectile speed` must identify the exact affected strategic-projectile classes, especially MIRV carrier vs separated warheads. | P10 projectile/interception projection remains incomplete until classified. |

As later batches discover further blockers, append them here rather than silently resolving them in validation metadata.

---

## Next work items

- audit P11–P20 using the same dependency-trace procedure;
- continue through P54 and N01–N18 in bounded batches;
- derive the final validation-domain catalogue from the completed traces rather than forcing traits into a preselected taxonomy;
- derive the explicit interaction registry from actual same-hook/cross-system dependencies;
- convert accepted coverage into executable validation metadata/tests only after the relevant canonical mechanics are implementation-ready.
