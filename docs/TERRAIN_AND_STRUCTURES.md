# Open Fufu — Canonical Terrain and Structure Registry

## Status and authority

This file is the **canonical owner for Open Fufu base terrain, physical rail topology, persistent structures, and the baseline Tank chassis**.

Neighboring concerns are owned elsewhere:

- game-wide teams, hostility, and `atWar` lifecycle: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- FFY, Factory Train service, and Trade Ship economics: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Warships, Transports, and strategic-weapon mechanics: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Origin transformations of terrain, structures, or units: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

The rules and values below are the accepted provisional V1 baseline. Numeric values may be retuned through versioned balance changes without changing subsystem ownership.

---

# 1. Terrain model

## 1.1 Core terminology

Each base terrain may define:

- whether the cell is conquerable;
- whether it is population-bearing and contributes Population Capacity while owned;
- ordinary land traversal;
- structure buildability;
- Initial Territory / exact-spawn eligibility;
- capture/settlement-speed multiplier;
- source offensive-pressure modifier;
- target defensive-pressure modifier;
- optional faction-wide effect based on owned terrain composition.

Water-unit traversal is unit/system-specific rather than one terrain-global naval permission. Warship/Transport traversal is owned by [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md); Trade Ship traversal/reachability is owned by [`FFY_ECONOMY.md`](./FFY_ECONOMY.md).

### Capture / settlement speed

```text
finalCaptureOrSettlementProgress
= ordinaryProgressFromPressure
× targetTerrainCaptureSettlementMultiplier
× other explicit progress modifiers
```

Terrain capture/settlement speed affects ownership-change progress, not Population casualties or settlement Population cost.

### Source offense / target defense

Terrain offense comes from the attacking source cell's base terrain. Terrain defense comes from the target cell's base terrain. Terrain never creates an automatic Population defender.

### Terrain-share effects

```text
terrainShare(T)
= owned population-bearing cells of terrain T
  / all owned population-bearing cells
```

If the faction owns no population-bearing cells, terrain-share bonuses are zero. Tundra and Shallow Water do not enter this denominator.

## 1.2 Canonical base-terrain table

| Terrain | Ownable | Population-bearing | Capacity | Land traversal | Structures | Spawn eligible | Capture / settlement speed | Source offense | Target defense | Faction-wide effect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **Plains** | Yes | Yes | `+1/cell` | Yes | Yes | Yes | **110%** | `100%` | `100%` | **Population Growth `+6% × Plains share`** |
| **Highland** | Yes | Yes | `+1/cell` | Yes | Yes | Yes | **100%** | **`+8%`** | `100%` | — |
| **Mountain** | Yes | Yes | `+1/cell` | Yes | Yes | Yes | **80%** | `100%` | **`+15%`** | — |
| **Desert** | Yes | Yes | `+1/cell` | Yes | Yes | Yes | **90%** | `100%` | `100%` | **All FFY event yield `+6% × Desert share`** |
| **Forest** | Yes | Yes | `+1/cell` | Yes | Yes | Yes | **90%** | **`-5%`** | **`+10%`** | — |
| **Tundra** | Yes | **No** | **`0`** | Yes | **No** | **No** | **80%** | `100%` | **`+5%`** | — |
| **Marsh** | Yes | Yes | `+1/cell` | Yes | Yes | Yes | **70%** | **`-10%`** | **`-10%`** | — |
| **Shallow Water** | **Yes** | **No** | **`0`** | **Yes** | **No** | **No** | **70%** | **`-15%`** | **`-15%`** | — |
| **Deep Water** | No | No | `0` | No | No | No | — | — | — | — |
| **Impassable** | No | No | `0` | No | No | No | — | — | — | — |

## 1.3 Terrain identities

| Terrain | Mechanical identity |
| --- | --- |
| **Plains** | Fertile/common land: fast acquisition plus a small Population-Growth benefit. |
| **Highland** | Offensive terrain. |
| **Mountain** | Defensive and slow to acquire. |
| **Desert** | Economic terrain with slower acquisition. |
| **Forest** | Defender-favored attritional terrain. |
| **Tundra** | Conquerable, 0 Capacity, unbuildable land. |
| **Marsh** | Very slow acquisition with poor attack and defense performance. |
| **Shallow Water** | Conquerable crossing terrain for ordinary land operations; 0 Capacity and unbuildable. Water-unit traversal is defined by the owning unit/economy subsystem. |
| **Deep Water** | Unconquerable water. Water-unit traversal is defined by the owning unit/economy subsystem. |
| **Impassable** | Hard map topology. |

## 1.4 Conquerable non-population-bearing terrain

Tundra and Shallow Water are conquerable but contribute `0` Population Capacity.

The baseline settlement Population cost applies only to population-bearing neutral cells. Neutral Tundra/Shallow Water therefore cost `0 Population` to acquire while still requiring ordinary acquisition progress/time.

A hostile capture of Tundra/Shallow Water transfers `0` Capacity. Game-wide hostile-capture Population consequences are owned by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md).

## 1.5 Tundra

| Property | Rule |
| --- | --- |
| Conquerable | Yes |
| Population Capacity | **0/cell** |
| Population Growth penalty for ownership | None |
| Structure construction | Forbidden |
| Initial Territory / exact spawn | Forbidden |
| Capture / settlement speed | **80%** |
| Source offense | 100% |
| Target defense | **+5%** |

## 1.6 Shallow Water / Deep Water

| Property | Shallow Water | Deep Water |
| --- | ---: | ---: |
| Ownable | **Yes** | No |
| Capacity | `0` | `0` |
| Ordinary land operation traversal | **Yes** | No |
| Structures | No | No |
| Initial Territory / exact spawn | No | No |
| Capture / settlement speed | **70%** | — |
| Source offense | **-15%** | — |
| Target defense | **-15%** | — |

Heavy land units use their own traversal table and do not inherit ordinary Population-operation traversal permissions. Water-unit traversal is likewise not inferred from this terrain table; use the Warship/Transport owner and Trade Ship owner linked above.

The general `COAST` spatial classification is **land-sided**. A coast cell must be a non-water ordinarily land-traversable cell with at least one cardinal neighbor whose base terrain is Shallow Water or Deep Water. A Shallow-Water or Deep-Water cell is never itself `COAST` merely because it borders another water type. This general classification is a public spatial fact and is distinct from the stricter Port-construction interface defined below.

## 1.7 Fallout overlay

Fallout is an overlay on legal conquerable terrain, not a replacement base terrain.

A Fallout-bearing cell is always politically neutral. Fallout and faction ownership cannot coexist in authoritative state. When Fallout is applied to an owned cell, that same authoritative transition neutralizes the cell's ownership.

A successful legal acquisition of a Fallout-bearing cell clears Fallout as part of the acquisition transaction. The new owner then owns the underlying base terrain normally, subject to that faction's effective terrain rules.

```text
ordinary Fallout capture / settlement speed × 0.50
```

The underlying terrain retains its Capacity classification, traversal, structure-buildability, source offense, target defense, and terrain-share identity. Fallout never creates Population defenders.

Origin-specific Fallout interactions are defined in `ORIGIN_TRAIT_CATALOGUE.md`.

## 1.8 Physical rail topology overlay

Rail is an immutable physical overlay on the simulation raster for the V1 baseline. The authoritative production rail topology is supplied by the bound production map artifact. Exact artifact package, manifest, encoding, serialization, content-identity, and validation details are owned by [`../src/simulation/MapArtifact.ts`](../src/simulation/MapArtifact.ts), not duplicated here.

Each rail node is exactly an existing simulation `cellId`; V1 creates no second rail coordinate or node space. Rail occupancy is a separate overlay field from base-terrain identity. This section does not add or infer terrain-specific rail purchase, build, placement, capture, removal, or generation rules.

Rail edges are explicit cardinal connections. A connection is legal only when both endpoint cells are valid rail cells, are cardinally adjacent on the raster, and both endpoints encode the reciprocal connection. Connections may not cross a map edge or wrap between raster rows. Every legal rail edge costs exactly one rail-cell step.

For deterministic rail adjacency and shortest-path enumeration, the canonical direction order is:

```text
top -> right -> bottom -> left
```

This ordering breaks equal-cost shortest-path ties. Rail routing must not derive ties from `Map`/`Set` insertion order, artifact enumeration order, or another incidental runtime order.

A City, Port, or Factory is attached to the rail network exactly when its physical occupied `cellId` is a rail cell. V1 defines no nearest-track snapping, off-cell connector, or secondary station-node mapping.

A rail route query distinguishes three outcomes:

- **invalid endpoint** — the requested endpoint is outside the map or is not a rail cell;
- **disconnected** — both endpoints are valid rail cells but lie in different rail connected components;
- **found** — a finite shortest rail path is returned, including both origin and destination cells.

For a valid rail source equal to its destination, the found path contains exactly that one cell and has distance `0`. Otherwise route distance is the number of traversed rail edges in rail-cell steps.

Natural retracing uses the same physical rail cells in reverse. The routing substrate must not fabricate a synthetic closure edge to close a higher-level Train tour.

Rail topology is immutable after map materialization in V1. Its authoritative identity is therefore bound through the production map artifact and the match's existing artifact/replay binding; this registry defines no mutable runtime rail state.

Factory Train target selection, dispatch, dwell, economic events, ownership epochs, turnaround, and interception economics are owned by [`FFY_ECONOMY.md`](./FFY_ECONOMY.md) and consume this physical topology rather than redefining it.

---

# 2. Persistent structures

Open Fufu V1 has eight canonical persistent structures:

1. City
2. Fort
3. Port
4. Factory
5. Missile Silo
6. SAM Launcher
7. Observation Post
8. Command Post

All persistent structures have levels `1–5`; normal purchases create L1 and L5 is the hard maximum. The inherited OpenFront Defense Post is implementation ancestry for the public **Fort**, not another structure.

## 2.1 Construction / upgrade rules

- Every structure has a fixed FFY cost by structure type + target level.
- Costs do not scale with previously owned structures/levels unless an explicit modifier says otherwise.
- Building L1 takes the listed time.
- Every L2–L5 upgrade takes the same structure-specific time as L1 construction.
- A new structure is inactive until construction completes.
- During an upgrade the previous completed level remains active; the new level activates atomically at completion.
- Ordinary placement requires owned buildable terrain; Port additionally requires the exact Deep-Water interface defined in its structure-specific rules.
- Same-type area effects use the strongest applicable same-type effect rather than stacking.

Construction state is represented independently from activity and completed level:

```text
fresh construction:
  completedLevel = none
  active = false
  construction.targetLevel = purchased/granted target
  construction.remainingTicks = remaining build time

upgrade in progress:
  completedLevel = previous completed level
  active = true
  construction.targetLevel = next target level
  construction.remainingTicks = remaining upgrade time

completed structure:
  completedLevel = completed target level
  construction = none
```

A rule such as P41 may change the fresh construction target without creating hidden intermediate levels. Its direct-L5 City therefore has no completed level during its five-second build, then atomically completes at L5.

### Effective tick-duration finalization

Persistent-structure construction and upgrade timing consumes the fully composed effective `STRUCTURE_CONSTRUCTION_TIME` value at the transition that begins the work. The owning lifecycle finalizes that tick-valued scalar exactly once:

```text
effectiveConstructionTicks
= ceil(fullyComposedEffectiveConstructionTimeTicks)
```

The fully composed value must be finite and strictly positive before it can enter authoritative state. `construction.remainingTicks` is the resulting positive integer and ordinary lifecycle progression subtracts exactly one tick per eligible simulation tick until completion. Rounding is not repeated after individual modifier stages.

Persistent-structure recharge transitions use the same tick-lattice finalization principle on `STRUCTURE_RECHARGE_TIME`:

```text
effectiveRechargeTicks
= ceil(fullyComposedEffectiveRechargeTimeTicks)
```

The fully composed recharge value must likewise be finite and strictly positive. The finalized integer duration is snapshotted when that recharge transition begins and determines its absolute deadline; later modifier changes do not retroactively move an existing deadline. This is the persistent-structure recharge boundary used by Silo/SAM charge transitions. It is distinct from the Tank-chassis construction **work-rate** formula in Section 3.1.

### 2.1.1 Canonical radial structure fields

Every circular persistent-structure field uses one authoritative V1 raster-membership contract:

```text
profileVersion = STRUCTURE_RADIAL_FIELD_V1
```

The field is centered on the structure cell. For a candidate cell with integer cell-center offset `(dx, dy)`:

```text
d2 = dx² + dy²
```

Membership uses exact integer/rational arithmetic and an **inclusive** outer boundary. Implementations must not use trigonometry, an intermediate floating-point radius, or consumer-specific rounding.

For a field whose generic modifier axis is semantic **area**—currently Fort and Command-Post coverage—let the baseline completed-level radius be `R` and the already-composed positive effective area factor be the reduced rational `p/q`. The exact field is:

```text
d2 × q <= R² × p
```

Thus area modifiers scale squared radial geometry. They do not apply the same percentage directly to radius and do not force the final lattice footprint to contain an exact proportional cell count.

For a field whose generic modifier axis is semantic **range/radius**—including SAM interception range, Observation radius, and ordinary repair radii—let its already-composed positive effective range factor be `p/q`. The exact field is:

```text
d2 × q² <= R² × p²
```

An explicitly zero effective field is **empty**, including at the structure's center cell. A negative effective area/range is invalid effective-rule state and must not be rasterized. Map edges merely clip the set because nonexistent cells are not candidates. Terrain, ownership boundaries, water, Fallout, and Impassable cells do not geometrically block or deform a structure field unless the focused mechanic explicitly says otherwise.

The authoritative effective profile is the reduced squared threshold plus `STRUCTURE_RADIAL_FIELD_V1`, not a rounded radius and not a precomputed bitmap. A cache or spatial index may materialize covered cells for performance, but it is derived data and must reproduce the same exact membership set.

#### 2.1.1.1 Activity, upgrades, capture, and replay

A fresh incomplete structure projects no active field. During an upgrade, the previous completed level remains active and therefore continues to project that level's current effective field. At upgrade completion the new completed-level profile becomes active atomically.

Successful `CAPTURE_TRANSFER` preserves the physical structure and location, but field-affecting Origin/Echo/ruleset modifiers are owner-effective rules. On the transfer tick, subsequent field queries therefore use the new owner's effective profile while preserving the structure's completed-level/construction state under the ordinary capture contract. No old-owner hidden radius persists.

Charge readiness is not field geometry. In particular, an active SAM whose charges are all RECHARGING still projects its current effective interception/economic area; readiness only determines whether the SAM can consume a charge when an eligible projectile enters it.

Historical reconstruction binds the structure identity/location, owner transitions, completed-level/activity state, effective rule profile/version, and `STRUCTURE_RADIAL_FIELD_V1`. Replay must reproduce field membership from those inputs; a serialized covered-cell bitmap is not required.

#### 2.1.1.2 Affiliation predicates

A mechanic that consumes a structure field must state which structure owners qualify. The closed current predicates used by Origin/effective-rule conditions are:

```text
SELF
SELF_OR_FIXED_TEAMMATE
```

`SELF` means the physical structure is owned by the mechanic/effect holder. `SELF_OR_FIXED_TEAMMATE` means `SELF` or a faction on the holder's immutable fixed team for that match. V1 does not infer field qualification from mutable diplomacy, historical ownership, proximity, or an unspecified notion of “friendly.”

Baseline subsystem effects may define another explicit subject/owner relation when their own mechanic requires it—for example, defensive pressure is resolved relative to the defended side—but no consumer may silently reinterpret an Origin condition's affiliation.

For boolean conditions such as “inside a qualifying Fort/SAM Launcher area,” same-type overlap is union/existence: one or more qualifying fields makes the condition true once. Overlap does not multiply P18/P24 and cannot make N11 “more zero.” Numeric pressure/support consumers separately retain the strongest-applicable same-type reducer and the canonical Fort/Command cross-type composition rule.

#### 2.1.1.3 Canonical consumers and controller projection

All authoritative consumers query the same effective field profile. Current required consequences include:

- P09/N10/Echo Fort coverage first compose on the semantic Fort **area** axis, then this owner projects the resulting exact area factor through `STRUCTURE_RADIAL_FIELD_V1`;
- P18 consumes self/fixed-teammate Fort membership;
- P24 consumes self-owned Fort membership;
- N11 consumes self-owned SAM Launcher membership;
- N11 uses the SAM Launcher's **current effective interception range geometry**, including P40 and ordinary SAM-range Echo specialization; it has no separate economic radius;
- P40 changes N11 geometry only because it changes that canonical effective SAM range; charge READY/RECHARGING state does not change membership.

Controller/Official-AI mechanics projection must expose the same authoritative physical-structure field as a queryable selector/helper. Numeric compatibility fields such as a displayed coverage radius or interception range are derived ergonomic information only; they must never become a second raster-membership authority, especially for area-scaled fields where an exact radius may be irrational.

Every physical persistent structure blocks deliberate relinquishment of its containing cell for as long as that structure exists, regardless of completed level, health, activity, or construction/upgrade state. This registry owns the structure-occupancy predicate only; the atomic relinquishment transaction, ownership result, and failure behavior are owned by `OPEN_FUFU_DESIGN.md`. Relinquishment never uses structure destruction or ownerless-structure state as an implicit workaround.

## 2.2 Canonical structure-acquisition admission

Every path that would make a persistent structure belong to a faction passes through one authoritative **structure-acquisition admission** contract. The acquisition path is explicit because construction-only restrictions are not ownership restrictions.

Canonical V1 acquisition paths are:

```text
PURCHASE_BUILD
GRANT
CAPTURE_TRANSFER
```

Start-state and scenario-created structures use the `GRANT` path; their owner decides when and where the grant request is generated. Runtime rewards such as a post-landing Fort also use `GRANT`.

Every successfully acquired physical structure records the **current ownership acquisition path** that produced its present owner. This owner-scoped provenance is deterministic serialized/replay state. `PURCHASE_BUILD` and `GRANT` initialize their corresponding provenance; every successful ownership transfer replaces the previous owner's provenance with `CAPTURE_TRANSFER`. The path describes the current ownership epoch rather than the structure's oldest historical origin.

Admission evaluates the effective rules for the prospective owner without mutating authoritative state. A successful result may then be committed by the owning transaction; a rejected result consumes no FFY, Population, purchase entitlement, construction/producer capacity, or ownership-slot reservation.

### 2.2.1 Common ownership constraints

Hard **ownership** constraints apply to every acquisition path. Examples include a one-per-type structure cap or an entitlement that limits how many SAM Launchers may be owned. A free price, grant, capture, alternate payment resource, or expanded terrain permission never bypasses a hard ownership limit.

Hard **build/purchase** constraints apply only to paths that actually build/purchase. For example, a rule that forbids building Factories prevents `PURCHASE_BUILD` but does not prevent a Factory from being acquired through an otherwise legal `CAPTURE_TRANSFER`.

Likewise, ordinary terrain/build permission, Port-interface requirements, construction-site occupancy, and purchase affordability are build/grant inputs; they are not retroactively re-applied to a physical structure already present during `CAPTURE_TRANSFER`.

### 2.2.2 Ownership-slot occupancy and reservations

After an admission commits, one intended future owned object consumes exactly one ownership slot throughout its lifecycle. Slot accounting therefore uses disjoint buckets:

```text
occupied slots
= currently owned physical structures of that type, including inactive/under-construction structures
+ committed admissions that reserved a slot but have not yet materialized a physical structure
+ temporary reservations created while validating the current atomic transaction
```

A materialized under-construction structure appears only in the first bucket; it is never counted again as a separate pending acquisition. An admitted construction occupies its ownership slot from transaction commit, not only from later activation. An upgrade does not create a new structure and consumes no additional ownership slot.

A controller/mechanics quote is informational only and does **not** reserve a slot. Several individually legal quotes may therefore form an illegal aggregate decision. Atomic decision validation must reserve slots against the complete proposal before commit so sibling commands cannot oversubscribe the same cap.

The slot is released when authoritative ownership of that physical structure ends, including successful transfer away or destruction/deletion. A committed pre-materialization reservation is released on authoritative cancellation/rollback. Failed admissions leave no phantom reservation.

## 2.3 Structure grants

A structure grant is an acquisition, not a purchase. Unless the grant's canonical owner explicitly says otherwise:

- it consumes no FFY and no purchase-only entitlement;
- it requires no producer;
- it requests one exact authored cell and never searches nearby for a fallback location;
- the target cell must satisfy ordinary physical structure-placement/occupancy rules for the recipient, including faction-effective terrain eligibility and any structure-specific placement geometry;
- it passes all hard ownership admission constraints;
- on success it materializes immediately as an **active completed structure at the authored level**, with no ordinary paid-construction delay;
- on failure nothing is created and the triggering gameplay result is not rolled back merely because the bonus grant failed.

The Origin catalogue owns which traits create grants. Strategic Spawn owns P20 start-state placement/order; this structure owner defines what happens once that exact grant request reaches admission. Once a granted Missile Silo materializes as active/completed, its initial charge state is the same fully loaded state defined by the Missile-Silo lifecycle below. P20 therefore produces an immediately ready `1/1` L1 Silo after a successful grant; it does not create a purchase transaction or a special delayed reload.

## 2.4 Structure capture resolution

A successful territorial capture of a cell containing an enemy persistent structure does **not** directly call a raw ownership setter. It creates a deterministic structure-capture resolution inside the same authoritative capture transaction.

Territorial capture success is already established before this resolver runs. Structure rules may determine the structure's fate and capture consequences, but they do not retroactively veto the successful cell capture unless a separate territorial-acquisition rule explicitly says so.

Canonical pipeline:

```text
successful territorial capture of occupied cell
    ↓
freeze StructureCaptureContext
    ↓
resolve capture-disposition transformations
    ↓
if disposition remains TRANSFER:
    evaluate CAPTURE_TRANSFER admission for prospective owner
    ↓
resolve final structure disposition
    ↓
resolve typed capture consequences from the final result
    ↓
commit cell ownership + structure fate + consequences atomically
    ↓
emit immutable StructureCaptureResolved fact
```

For the simulation tick that contains this capture, that entire territorial-capture/structure-fate transaction resolves **before** end-of-tick persistent-structure construction progression. The frozen capture context therefore observes the pre-progress `construction.remainingTicks`; a successful transfer preserves that exact value. Only after the capture transaction commits does lifecycle progression subtract the tick and perform any resulting completion. Consequently, a structure captured with `remainingTicks = 1` transfers while still incomplete and may then complete later in the same tick under the new owner. Post-transfer field queries use the new owner's effective rules at the structure's still-current completed level until any later atomic completion changes that level.

### 2.4.1 Capture context and disposition

The frozen capture context includes at minimum the physical structure identity/type/cell, previous owner, capturing faction, completed level when one exists, active state, health where applicable, and any in-progress construction target level plus remaining construction time.

V1 has exactly two generic final dispositions:

```text
TRANSFER
DESTROY
```

Default disposition is `TRANSFER`. An explicit rule may transform that proposed disposition before admission; for example, N17 is an Origin-owned `TRANSFER -> DESTROY` capture transformation.

If disposition remains `TRANSFER`, the resolver performs `CAPTURE_TRANSFER` admission for the prospective owner. A hard ownership rejection converts the final disposition to `DESTROY`; **the territorial cell capture still succeeds**. This is the generic resolution used when an N07-style cap is full.

A capture-time destruction is a distinct `DESTROYED_ON_CAPTURE` result, not an ordinary combat kill. Effects that require successful transfer do not fire merely because the structure existed, and ordinary combat-destruction rewards/side effects do not apply unless an explicit rule consumes this capture-destruction result.

### 2.4.2 Successful transfer preserves the physical structure

A successful transfer changes ownership atomically while preserving the physical structure and its ordinary persistent state unless the focused subsystem explicitly transforms one of its own fields. The generic transfer preserves:

- structure ID and type;
- cell/location;
- completed level when one exists;
- health/damage state where applicable;
- current active state;
- in-progress construction target level and remaining construction time when construction or an upgrade is underway;
- other subsystem-owned persistent state by identity rather than recreating a new structure.

Fresh construction therefore remains fresh construction after transfer, including a P41 City that is still targeting L5 with no completed level yet. An upgrading structure remains active at its previous completed level while its preserved construction state continues toward the same target level. Capture never silently converts pending work into a completed structure or discards its target level.

Build-only restrictions and terrain-placement legality are not re-applied. A faction that cannot build Factories may still acquire/use an otherwise admissible captured Factory, and a structure legally standing on terrain the new owner could not build on remains there after transfer.

Owner-scoped provenance and subsystem operational epochs are **not** old-owner physical state. On successful transfer, current ownership acquisition provenance becomes `CAPTURE_TRANSFER`, and a focused subsystem may close the previous owner's operational epoch and initialize the new owner's epoch while preserving the physical structure. Factory Train service uses exactly this rule: physical Factory structure state persists, while its owner-scoped Train scheduler/P07 phase resets under `FFY_ECONOMY.md` and `ORIGIN_TRAIT_CATALOGUE.md`. A Missile Silo's physical charge bank and existing absolute recharge deadlines are transfer-preserved state as defined by the Missile-Silo lifecycle below; capture does not reload the Silo or restart its cooling charges.

### 2.4.3 Typed capture consequences, not mutating event listeners

Gameplay systems that care about structure capture participate through typed deterministic resolver inputs/consequences rather than arbitrary post-hoc listeners that mutate canonical state in unspecified order.

The resolver distinguishes at least these trigger stages:

```text
STRUCTURE_PRESENT_ON_CAPTURE
STRUCTURE_TRANSFERRED
STRUCTURE_DESTROYED_ON_CAPTURE
```

A future rule may therefore punish/reward capturing a City merely because it was present, only when it is successfully acquired, or only when capture destroys it, without depending on listener registration order. Consequence producers return declarative effects; the capture transaction collects and commits those effects atomically with the structure fate.

Current examples are Origin-owned: P05 consumes `STRUCTURE_TRANSFERRED` to create its conquest FFY event, while P34 consumes a successfully transferred Factory as conquest acquisition/provenance. If N17 or failed transfer admission produces `STRUCTURE_DESTROYED_ON_CAPTURE`, those successful-transfer effects do not fire.

After commit, the simulation emits an immutable resolved fact suitable for replay, diagnostics, statistics, presentation, and lawful controller-event projection. Post-resolution observers cannot change the already committed structure fate.

### 2.4.4 Same-tick ownership-slot resolution

When one simulation tick contains multiple already-resolved territorial captures involving structures, ownership-slot accounting is deterministic and does not depend on controller command order or incidental execution registration order.

For cap accounting:

1. resolve direct capture-disposition transformations such as `DESTROY` that require no incoming ownership slot;
2. release slots for structures whose authoritative ownership is definitely leaving a faction in this tick because of successful territorial capture/destruction;
3. evaluate incoming `CAPTURE_TRANSFER` admissions against remaining ownership plus reservations;
4. when several incoming structures compete for fewer available slots, use stable ascending `cellId`, then stable `structureId` as the V1 tie-breaker;
5. reserve each admitted incoming slot immediately for the rest of this capture-resolution batch.

Therefore a capped faction that loses its existing Factory and captures one replacement Factory in the same tick may admit the incoming Factory. A capped faction with no Factory that captures two Factories in the same tick admits the deterministically first eligible transfer and destroys the other when the cap is one.

## 2.5 Costs and times

| Structure | Time per build/upgrade | L1 | L2 | L3 | L4 | L5 | L1→L5 total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **City** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |
| **Fort** | **5s** | 50k | 100k | 150k | 200k | 250k | **750k** |
| **Port** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |
| **Factory** | **10s** | 150k | 300k | 600k | 900k | 1.20m | **3.15m** |
| **Missile Silo** | **15s** | 1.00m | 2.00m | 3.00m | 4.00m | 5.00m | **15.00m** |
| **SAM Launcher** | **15s** | 1.00m | 2.00m | 3.00m | 4.00m | 5.00m | **15.00m** |
| **Observation Post** | **5s** | 50k | 100k | 200k | 300k | 400k | **1.05m** |
| **Command Post** | **10s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |

## 2.6 Level effects

| Effect | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **City — faction Population Growth contribution** | +1% | +2% | +3% | +4% | **+5%** |
| **Fort — defensive pressure** | +10% | +15% | +20% | +25% | **+30%** |
| **Fort — coverage radius** | 30 | 35 | 40 | 45 | **50** |
| **Port — passive naval repair radius** | 20 | 25 | 30 | 35 | **40** |
| **Port — passive naval repair rate** | 1.00× | 1.25× | 1.50× | 1.75× | **2.00×** |
| **Factory — broad armored-unit repair radius** | 20 | 40 | 60 | 80 | **100** |
| **Factory — broad armored-unit repair rate** | 10 HP/s | 20 HP/s | 30 HP/s | 40 HP/s | **50 HP/s** |
| **Factory — fast armored-unit repair rate** | 100 HP/s | 137.5 HP/s | 175 HP/s | 212.5 HP/s | **250 HP/s** |
| **Missile Silo — simultaneous charges** | 1 | 2 | 3 | 4 | **5** |
| **SAM Launcher — simultaneous charges** | 1 | 2 | 3 | 4 | **5** |
| **SAM Launcher — interception range** | 70 | 80 | 90 | 100 | **105** |
| **Observation Post — observation radius** | 40 | 55 | 70 | 85 | **100** |
| **Command Post — source offensive pressure** | **+3%** | **+6%** | **+9%** | **+12%** | **+15%** |
| **Command Post — coverage radius** | **30** | **35** | **40** | **45** | **50** |

## 2.7 Structure-specific rules

### City

Each completed City contributes its listed percentage additively to the faction's City-derived Population Growth modifier. Cities never increase Population Capacity. Cities are eligible Train stations under `FFY_ECONOMY.md`.

### Fort

A Fort never creates Population defenders. Its defensive-pressure effect applies only to a real automatic defender on a covered cell. Baseline Fort defensive pressure is owner-only: the Fort owner must be the defended faction. A fixed teammate's Fort does not provide this baseline defensive-pressure effect unless another explicit mechanic creates a separate cross-faction effect.

### Port

Ports are Trade Ship origins/destinations, naval repair infrastructure, and Warship production structures.

A Port purchase/grant requests one exact physical structure cell; Port placement does not search, snap, or substitute a nearby cell. The requested cell must first satisfy the ordinary effective ownership/buildability/occupancy rules for that acquisition path. In addition, it must have at least one **cardinally adjacent Deep Water** cell. Shallow-Water adjacency alone does not qualify, and diagonal Deep Water does not qualify. The Port itself occupies the requested buildable land-side cell, not the adjacent Deep Water. A rule that expands ordinary structure-build terrain eligibility changes only that ordinary buildability input; it does not waive the distinct Deep-Water Port-interface requirement unless the rule explicitly says so.

Port level affects passive naval repair only through the table above. The L1 baseline repair rate is **50 HP/s**, so the L1→L5 rates are:

```text
50 / 62.5 / 75 / 87.5 / 100 HP/s
```

Every eligible friendly health-bearing naval unit inside the repair field may receive repair in the same tick. Same-type overlapping Ports use the strongest applicable repair field rather than stacking.

Trade Ship service/economics are defined in `FFY_ECONOMY.md`. Warship production/unit mechanics are defined in `NAVAL_AND_STRATEGIC_WEAPONS.md`.

### Factory

Factories produce Trains and Tanks and repair Tank chassis.

Train routing, timing, station events, dispatch-time Factory economic snapshots, and Train-service ownership epochs are defined in `FFY_ECONOMY.md`.

Factory armored-unit repair has two non-stacking service tiers. The completed-level broad profile is listed in Section 2.6. Broad repair applies only to a chassis already assigned to that Factory for repair; while inside the Factory's current effective broad field, that chassis may continue moving toward fast service and receives the broad rate. Broad service has no Factory-level simultaneous-count cap: every chassis assigned to that Factory and currently inside its broad field is eligible unless that same chassis is receiving fast service that tick.

Fast service is the stationary queue tier:

```text
fast-service radius = 10 cells at every Factory level
fast-service capacity = 1 chassis at every Factory level
fast-service rate = completed-level rate from Section 2.6
```

A chassis selected for fast service receives the fast rate only; broad and fast repair never stack on the same chassis in one tick. A queued chassis not selected for the one fast slot receives broad repair when it lies inside the broad field. Repair from one assigned Factory does not stack with another Factory.

The ordinary Factory repair-radius rule axis modifies **broad repair radius only**. The ordinary Factory repair-rate axis scales **both broad and fast repair rates**. Fast-service radius and one-slot capacity are fixed baseline parameters rather than those axes. Factory consumers must request the effective typed repair profile rather than infer a generic `Factory effect multiplier`. Exact P34 transformation values and Origin interactions are owned by `ORIGIN_TRAIT_CATALOGUE.md`; Echo identities/scopes are owned by `ECHO_CATALOGUE.md`.

### Missile Silo

| Completed level | Weapon access |
| ---: | --- |
| L1–L2 | Atom Bomb |
| L3–L4 | Atom Bomb + Hydrogen Bomb |
| L5 | Atom Bomb + Hydrogen Bomb + MIRV |

Charge capacity equals completed level. Baseline recharge cooldown is **9s / 90 simulation ticks per charge**.

#### Persistent-Silo charge bank

Each active completed Missile Silo owns one deterministic physical charge bank. Capacity is the current completed level. Each authoritative charge slot has:

```text
slotId : exact non-negative integer local to this physical Silo
state  : READY
      | RECHARGING until absolute readyAtTick
```

For completed capacity `N`, the slot IDs are exactly `0..N-1`. Existing slots are never renumbered. Initial activation creates the complete current range in ascending ID order; a later capacity increase from `N` to `M` appends exactly `N..M-1` and leaves every earlier slot identity unchanged.

The controller-facing summary may expose only `ready`, `capacity`, and remaining recharge ticks. That projection is derived state. The authoritative simulation/replay retains every `slotId`, state, and absolute deadline so charge consumption cannot be ambiguous or duplicated.

A fresh Silo contributes **no active charge state while its first construction is incomplete**. When a newly materialized/completed Silo first becomes active, every slot in its current completed-level capacity starts **READY**. This applies equally to ordinary completed construction and to an immediate completed grant unless the grant's own canonical mechanic explicitly says otherwise. Consequently, a successful P20 L1 starting-Silo grant begins with slot `0` READY (`1/1`) immediately.

During an ordinary upgrade, the previous completed level and its existing charge bank remain active. At the exact tick the higher level activates atomically:

1. capacity becomes the new completed level;
2. every pre-existing slot keeps the same `slotId`, READY/recharge state, and existing deadline;
3. every newly added slot `oldCapacity..newCapacity-1` begins **RECHARGING**, not READY;
4. each new slot's deadline is `activationTick + effectiveRechargeTicks` using the effective recharge duration resolved for that transition under the Section 2.1 tick finalization rule.

Thus an ordinary L1→L2 activation at tick `T` preserves slot `0` and creates slot `1` with baseline `readyAtTick = T + 90`. Completing an upgrade never grants a free instant strategic launch, renumbers an existing slot, or resets an older cooling charge.

When a legal strategic launch spends a persistent-Silo charge, the canonical consumed charge is the **lowest `slotId` currently READY** on that exact physical Silo. Exactly that slot enters RECHARGING from the authoritative launch-commit tick. The effective recharge duration is resolved/snapshotted when the transition begins; later changes to a recharge modifier do not retroactively move its deadline. A slot becomes READY at the first simulation tick satisfying:

```text
currentTick >= readyAtTick
```

A successful `CAPTURE_TRANSFER` preserves the physical Silo's complete charge bank: every `slotId`, state, and absolute recharge deadline remains unchanged. Capture does not refill the Silo, renumber charges, or restart cooldowns. After transfer, the new owner's effective rules apply to **future** recharge transitions only.

Persistent-Silo charge state is deterministic serialized/replay state keyed by physical structure identity. Saving/reloading or replaying at any tick must reproduce the same capacity, ordered slot identities, READY count, per-slot deadlines, and next transition tick.

P53 reads this canonical state but does not alter it: its ready-charge income counts exactly the slots currently in READY across owned **active persistent Missile Silo structures**. Capacity without readiness, cooling slots, SAM charges, and P29 Warship-launcher charges do not become P53 income merely because they use a similar charge-state representation.

Strategic-launch transactionality, projectile/blast profiles, launcher-local accepted-launch identity, and P29 mobile-launcher charge behavior are defined in `NAVAL_AND_STRATEGIC_WEAPONS.md`.

Required Silo lifecycle validation includes at minimum:

- a newly completed ordinary L1 Silo creates slot `0` READY;
- a successfully granted P20 L1 Silo creates slot `0` READY;
- spending with multiple READY charges always consumes the lowest READY `slotId`;
- spending a charge preserves every sibling slot and makes exactly the selected slot unavailable for the full effective recharge duration;
- L1→L2 activation preserves slot `0` and creates slot `1` cooling for one full effective recharge duration;
- larger capacity increases append exactly the new `slotId` range without renumbering old slots;
- upgrading while an older charge is cooling preserves that older slot ID and deadline exactly;
- capture preserves slot identities, ready/cooling state, and deadlines;
- P53 income changes with current READY persistent-Silo slots and does not count new capacity until its new slot becomes ready;
- save/replay reproduces every slot identity and charge transition on the same tick.

### SAM Launcher

Targeting/interception is automatic. Charge capacity equals completed level. Baseline recharge cooldown is **9s per expended charge**. Range is `70 / 80 / 90 / 100 / 105`.

An active SAM Launcher considers an otherwise eligible strategic projectile for interception only when that projectile's owner is an **enemy** of the SAM owner under the game-wide ally/enemy relation owned by `OPEN_FUFU_DESIGN.md`. Self-owned and allied projectiles are ignored. This qualification is independent of the projectile's intended target, the territory beneath its path, and current `atWar` state. Geometry and readiness remain separate: field entry establishes spatial eligibility, while an actual interception still requires the focused weapon mechanic's ordinary readiness/charge conditions.

### Observation Post

An active Observation Post projects the canonical `OBSERVATION` structure field using its currently active completed-level effective observation radius and `STRUCTURE_RADIAL_FIELD_V1`. Its ordinary effect is `REVEAL`: inside that field, the owning faction gains remote observation of tactical operational state that is otherwise legally revealable under the requester-relative visibility projection in `OPEN_FUFU_DESIGN.md`, including hostile mobile units, persistent structures, and manifested operations needed for tactical decisions.

Observation is not a hidden-state bypass. An applicable concealment/blackout predicate remains higher-precedence than remote observation, and the Post never reveals controller memory, unmanifested plans, hidden private state, or information outside the surfaced visibility model. Observation coverage is boolean; overlapping Posts form a union and do not stack reveal strength.

Origin transformations may replace the Observation field's ordinary effect, but they consume this same effective `OBSERVATION` field rather than defining a second radius or raster footprint. Exact Origin transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

### Command Post

A completed Command Post gives its listed offensive-pressure modifier to an ordinary Population-based land engagement lane when the attacking source cell lies inside friendly Command-Post coverage.

It does not modify Tank weapon damage, Warship damage, strategic weapons, or unrelated FFY effects.

---

# 3. Baseline Tank

The **Tank** is the sole baseline persistent land military unit. One map Tank represents an abstract armored formation, not one literal vehicle.

It performs autonomous raiding/interdiction, fights hostile armor, intercepts Trains, and can cause direct Population casualties while the canonical war-state gate permits those Population attacks.

Origin transformations of the Tank chassis are defined only in `ORIGIN_TRAIT_CATALOGUE.md`.

## 3.1 Production and persistence

| Property | Baseline Tank rule |
| --- | --- |
| Produced by | active owned Factory |
| Factory level required | L1+ |
| Build time | **5s** |
| Concurrent Tank builds per Factory | **1** |
| Purchase resource | FFY |
| Max owned Tanks | No hard cap |
| Captures territory | No |
| Carries Population | No |
| Generic structure damage | No |
| Max health | **1,000** |
| Automatic repair-retreat threshold | **50% health** |
| Repair structure | Factory |

Tank-chassis construction-speed modifiers multiply construction **work rate**. They do not subtract the same percentage directly from duration. For a baseline build represented by `baseBuildTicks`, an isolated speed multiplier `S > 0` completes after:

```text
effectiveBuildTicks = ceil(baseBuildTicks / S)
```

The ceiling is authoritative so completion remains deterministic on the simulation tick lattice. P34's current `S = 1.50` therefore makes the ordinary 50-tick Tank build complete in 34 ticks; if P43 transforms the chassis to its 100-tick Heavy-Artillery baseline, the same P34 speed hook completes it in 67 ticks. Concurrent Tank-build capacity remains one unless an explicit rule changes that separate axis.

### Purchase-cost curve

```text
TankCost = min(1,000,000 FFY, 250,000 FFY × (activeTankChassis + 1))
```

| Active Tank chassis before purchase | Next baseline Tank cost |
| ---: | ---: |
| 0 | **250k** |
| 1 | **500k** |
| 2 | **750k** |
| 3+ | **1.00m** |

Origin-transformed Tank chassis count against the same active-chassis curve unless the Origin catalogue explicitly changes that rule.

## 3.2 Movement and terrain

Baseline Plains movement speed is **5 cells/s**.

| Terrain | Traversal | Speed multiplier | Derived Tank speed |
| --- | ---: | ---: | ---: |
| **Plains** | Yes | 100% | **5.00 cells/s** |
| **Highland** | Yes | 80% | **4.00 cells/s** |
| **Mountain** | **Blocked** | — | — |
| **Desert** | Yes | 90% | **4.50 cells/s** |
| **Forest** | Yes | 65% | **3.25 cells/s** |
| **Tundra** | Yes | 75% | **3.75 cells/s** |
| **Marsh** | Yes | 50% | **2.50 cells/s** |
| **Shallow Water** | **Blocked** | — | — |
| **Deep Water** | Blocked | — | — |
| **Impassable** | Blocked | — | — |

For one legal cardinal Tank edge from traversable cell `A` to traversable cell `B`, let `vA` and `vB` be that chassis's current effective movement speeds on the two endpoint terrains after all applicable chassis/Origin/Echo movement effects. The edge traversal time is symmetric half-edge time:

```text
edgeTime(A, B) = 0.5 / vA + 0.5 / vB
```

Authoritative routing accumulates this value with exact rational arithmetic; it must not round each edge through floating point. Therefore `A -> B` and `B -> A` have the same terrain-derived traversal time, and a same-terrain edge reduces exactly to `1 / v`. If either endpoint terrain is blocked for the chassis, or the territorial-corridor predicate rejects the transition, that edge is unavailable rather than assigned a finite traversal time.

Tanks may path through friendly traversable territory and traversable territory belonging to an opposing faction when ordinary unit-hostility rules permit it. `atWar` is not required merely for Tank movement through such territory. Neutral cells do not form a Tank corridor; ordinary territorial control must establish one first.

## 3.3 Strategic/autonomous control

Tanks are autonomous combat formations rather than RTS-micro units.

The controller may issue a strategic **move destination**. An accepted move repositions the Tank and establishes that destination as its new operating anchor. The controller does not assign patrol modes, raid modes, firing modes, or individual targets.

Within ordinary operation the Tank wanders/searches for legal targets around its current operating anchor, with a baseline **100-cell leash**. Pathfinding, roaming, local pursuit, target selection, firing, Train interception, Population attacks, and automatic repair retreat are simulation-owned. Tank attacks require legal observation.

## 3.4 Combat and raiding

| Attack mode | Range | Damage / result | Cooldown |
| --- | ---: | ---: | ---: |
| **vs hostile Tank chassis** | **30** | **250 HP** | **1s** |
| **vs hostile Train** | **30** | Train intercepted/destroyed | **1s weapon cadence** |
| **vs hostile Population** | **30** | **250 Population casualties** | **3s** |

Autonomous anti-armor combat and Train interception do **not** require, create, or refresh `atWar`. Autonomous Population attacks are legal only while the Tank owner's hostility side is currently `atWar` with the target faction's side under the canonical game-wide rule in `OPEN_FUFU_DESIGN.md`; they cease when that relation expires. Tank-derived Origin chassis inherit this gate unless an explicit Origin rule changes it.

Population attacks never capture territory by themselves.

Train interception payout semantics are owned by `FFY_ECONOMY.md`.

## 3.5 Deterministic production lifecycle

A Tank-production admission is one atomic transaction against the authoritative pre-state. It must validate the selected Factory's current ownership/activity and completed L1+ state, its free Tank-build slot, the faction's current active Tank-derived chassis count, the resulting effective chassis profile and purchase cost, and FFY affordability before committing anything. Rejection consumes no FFY and no slot. Acceptance debits the final FFY cost exactly once and creates exactly one Factory-owned production job.

For the purchase-cost curve, `activeTankChassis` means currently deployed, living `TANK` or Origin-transformed Tank-derived chassis such as `HEAVY_ARTILLERY` owned by that faction. In-progress jobs, completed output waiting for a deployment cell, and destroyed chassis do not count.

The accepted job snapshots the resulting chassis identity/profile and its finalized build duration at admission. Later rule/profile changes do not retroactively change that job's duration or resulting chassis. The finalized duration uses the Section 3.1 work-rate rule exactly once. An accepted job receives its first production-progress tick in that same authoritative tick's final production phase.

If the producing Factory still exists under the same owner but is temporarily ineligible/inactive, the job pauses with its remaining work unchanged. If that Factory is destroyed or changes owner, the unfinished job is cancelled; it is not transferred and its already committed FFY is not refunded.

When work is complete, deployment considers the Factory's cardinal neighbors that are currently owned by the job owner and traversable by the resulting chassis. The deployment cell is the lowest stable `cellId` among those legal neighbors. If no such cell exists, the completed output remains waiting at the Factory and continues occupying the Factory's one Tank-build slot until deployment becomes possible. Deployment creates exactly one chassis at full effective maximum health; the deployment cell is its initial operating anchor. A chassis deployed in the production phase cannot move, acquire a target, fire, receive repair, or otherwise act until the following simulation tick.

## 3.6 Autonomous intent, target selection, and pursuit

A deployed Tank-derived chassis resolves one movement intent per Tank stage in this priority order:

1. automatic repair retreat when the repair threshold is active;
2. pursuit of an already retained legal target;
3. a current controller-issued strategic move destination;
4. ordinary autonomous search/roaming around the operating anchor.

An accepted strategic move changes the operating anchor only when that strategic destination is reached. Repair movement never replaces the operating anchor.

When the chassis has no retained target, autonomous target acquisition considers lawfully observed, legal targets in this class priority:

```text
Tank-derived chassis
Warship
Train
Population
```

Within the first non-empty eligible class, choose the target requiring the least expected legal traversal time to a firing position under the chassis's current effective movement profile. A target already legally in range has traversal time zero. Equal traversal-time candidates break ties by stable target identity; Population-cell ties use ascending stable `cellId`.

The selected target is sticky. It remains retained rather than being replaced merely because another candidate later becomes nearer or belongs to a higher-priority class. Clear it only when the target is destroyed/ceases to exist, is no longer lawfully observed, is no longer a legal target, has no legal reachable firing position, or is outside the chassis's 100-cell operating leash. A new acquisition then repeats the class-priority and tie rules above.

The ordinary 100-cell leash is measured between cell centers around the current operating anchor. A target/firing-position pursuit may not cause the chassis to operate outside that leash. Autonomous roaming likewise remains inside it.

## 3.7 Range, attacks, and same-tick combat resolution

Every Tank-derived weapon range uses an inclusive cell-center circle. For attacker/target cell-center offsets `(dx, dy)` and effective range `R`, the target is in range exactly when:

```text
dx² + dy² <= R²
```

Range is geometric weapon reach, not path distance. Chassis path barriers therefore do not by themselves block a shot to an otherwise legal observed target in range. P43's explicit projectile-traversal rule remains owned by the Origin catalogue.

A hostile Warship is a legal anti-armor target between Tank-derived chassis and Train in the priority above. A baseline Tank attacks it with the ordinary anti-armor profile: effective Tank anti-armor range/damage/cooldown. This Tank-originated attack does not require, create, or refresh `atWar`. P43 applies its transformed anti-armor profile. This rule adds no reciprocal Warship-to-Tank behavior; Warship mechanics remain owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`.

A Population target is one enemy-owned population-bearing cell that is legally observed, within effective Population-weapon range, within the operating leash, and whose owning hostility side is currently `atWar` with the Tank owner's side. Direct Population damage is finalized once per committed shot after applicable damage modifiers and floored to a non-negative whole Population amount. The actual direct casualty debit is:

```text
min(finalPopulationDamage, targetFaction.AvailablePopulation)
```

Only Available Population pays this Tank attack. Committed offensive Population, committed counter-response Population, and Population aboard Transports are not debited by the direct shot. The selected Population cell remains the spatial target for any successful post-hit effect such as P44; P44's candidate ordering/footprint remains owned by `ORIGIN_TRAIT_CATALOGUE.md`. Direct Population casualties do not change ownership.

Tank combat uses a frozen **post-movement** combat snapshot. All attack eligibility, retained/acquired targets, range checks, cooldown readiness, and attack payloads for that combat phase are resolved from that snapshot before any same-phase damage/destruction is committed. Every admitted attack then resolves simultaneously. Therefore mutually lethal attackers both fire, and multiple attackers that selected the same target all retain their admitted shots even if aggregate damage is lethal.

After simultaneous direct attack effects are collected, apply chassis HP damage, physical Train/other-unit destruction results, and direct Population casualties, then remove destroyed mobile units. Successful Population-shot follow-up effects such as P44 resolve from the same post-direct-attack territorial/occupancy snapshot so their result is independent of attacker enumeration order; overlapping candidate cells do not become newly eligible merely because another same-phase P44 effect neutralized a nearer cell first.

A successful shot starts its authored cooldown from the current authoritative tick. It is next eligible on the first tick at or after `shotTick + effectiveCooldownTicks`. Cooldown state is authoritative replay state. No cooldown is consumed for a candidate attack that fails legality before commit.

Health and repair may retain deterministic fractional values where effective modifiers/rates require them; HP is clamped only at zero and the current effective maximum.

## 3.8 Automatic repair retreat and contention

At the intent phase, a living Tank-derived chassis at or below **50% of its current effective maximum health** enters automatic repair retreat unless an explicit effective rule changes that threshold. Repair retreat outranks combat pursuit and strategic movement.

Choose among active owned Factories whose current fast-service field contains at least one legally reachable cell. For each Factory, the route destination is the reachable cell inside that current fast-service field with the least expected legal traversal time under the chassis's current effective movement profile; equal-time destination cells tie by ascending stable `cellId`. Choose the Factory with the least such traversal time; Factory ties use stable ascending `structureId`. The selected Factory assignment is persistent rather than recomputed opportunistically. It is cleared/reselected only if that Factory is destroyed, changes owner, becomes ineligible, or no cell in its current fast-service field remains reachable.

Once assigned, the chassis receives that Factory's broad repair whenever it is inside the Factory's current effective broad field, including while it is still moving toward fast service. Broad repair does not stop movement. One chassis is assigned to at most one Factory, so overlapping Factory fields never stack repair from multiple Factories.

A chassis enters the Factory's fast-service queue when it reaches its selected eligible cell in the current fast-service field. Its stable queue key is `(repairArrivalTick, unitId)`. Queued chassis hold their arrival position while waiting; later arrivals cannot jump ahead because of insertion/enumeration order. Each Tank repair phase, exactly the first queued chassis receives the Factory's one fast-service slot regardless of Factory level. Other queued chassis continue to receive broad repair when they are within the broad field. The fast-serviced chassis receives fast repair only; broad and fast repair never stack in the same tick.

Service reads the Factory's current effective broad radius and repair-rate scale when repair is applied. The broad-radius axis changes broad geometry only; the repair-rate axis scales both broad and fast rates. The fast-service radius remains **10 cells** and fast-service capacity remains **1 chassis** unless a future explicit rule creates separate axes for those parameters. Repair is capped at the chassis's current effective maximum health.

On reaching full health, the chassis exits repair mode/queue and resumes ordinary intent toward its unchanged operating anchor. Factory repair never changes that anchor.

## 3.9 Authoritative Tank-stage ordering

For a simulation tick that contains these systems, the relevant authoritative order is:

```text
accepted simulation inputs / ordinary pre-land economy
    ↓
land resolution, including territorial capture and structure fate
    ↓
persistent-structure lifecycle progression/completion
    ↓
Tank intent / repair assignment / target retention-or-acquisition
    ↓
Tank movement
    ↓
freeze post-movement Tank combat snapshot
    ↓
simultaneous Tank attacks and direct effects
    ↓
destruction + Population/P44 follow-up consequences
    ↓
Factory Tank repair
    ↓
Tank production progress/completion/deployment
```

Thus a Factory that completes or upgrades during persistent-structure lifecycle progression is already active at its new completed level for same-tick Tank repair/production queries. Conversely, Tank production is the final Tank-local phase, so a chassis deployed there cannot participate in earlier phases until the following tick.

The Tank stage consumes the canonical land/capture, structure, hostility/visibility, Population, FFY, navigation, Origin/effective-rule, and mobile-unit states; it does not create parallel copies of those authorities.
