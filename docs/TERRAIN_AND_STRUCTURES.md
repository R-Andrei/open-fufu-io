# Open Fufu — Canonical Terrain and Structure Registry

## Status and authority

This file is the **canonical owner for Open Fufu base terrain, persistent structures, and the baseline Tank chassis**.

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
- ordinary land/naval traversal;
- structure buildability;
- Initial Territory / exact-spawn eligibility;
- capture/settlement-speed multiplier;
- source offensive-pressure modifier;
- target defensive-pressure modifier;
- optional faction-wide effect based on owned terrain composition.

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

| Terrain | Ownable | Population-bearing | Capacity | Land traversal | Naval traversal | Structures | Spawn eligible | Capture / settlement speed | Source offense | Target defense | Faction-wide effect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **Plains** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **110%** | `100%` | `100%` | **Population Growth `+6% × Plains share`** |
| **Highland** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **100%** | **`+8%`** | `100%` | — |
| **Mountain** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **80%** | `100%` | **`+15%`** | — |
| **Desert** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **90%** | `100%` | `100%` | **All FFY event yield `+6% × Desert share`** |
| **Forest** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **90%** | **`-5%`** | **`+10%`** | — |
| **Tundra** | Yes | **No** | **`0`** | Yes | No | **No** | **No** | **80%** | `100%` | **`+5%`** | — |
| **Marsh** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **70%** | **`-10%`** | **`-10%`** | — |
| **Shallow Water** | **Yes** | **No** | **`0`** | **Yes** | **Yes** | **No** | **No** | **70%** | **`-15%`** | **`-15%`** | — |
| **Deep Water** | No | No | `0` | No | **Yes** | No | No | — | — | — | — |
| **Impassable** | No | No | `0` | No | No | No | No | — | — | — | — |

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
| **Shallow Water** | Conquerable crossing terrain for ordinary land operations and naval units; 0 Capacity and unbuildable. |
| **Deep Water** | Naval-only unconquerable water. |
| **Impassable** | Hard map topology. |

## 1.4 Conquerable non-population-bearing terrain

Tundra and Shallow Water are conquerable but contribute `0` Population Capacity.

The baseline settlement Population cost applies only to population-bearing neutral cells. Neutral Tundra/Shallow Water therefore cost `0 Population` to acquire while still requiring ordinary acquisition progress/time.

A hostile automatically defended Tundra/Shallow-Water cell still produces ordinary successful-capture casualties but transfers `0` Capacity.

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
| Naval traversal | **Yes** | Yes |
| Structures | No | No |
| Initial Territory / exact spawn | No | No |
| Capture / settlement speed | **70%** | — |
| Source offense | **-15%** | — |
| Target defense | **-15%** | — |

Heavy land units use their own traversal table and do not inherit ordinary Population-operation traversal permissions.

## 1.7 Fallout overlay

Fallout is an overlay on legal conquerable terrain, not a replacement base terrain.

```text
ordinary Fallout capture / settlement speed × 0.50
```

The underlying terrain retains its Capacity classification, traversal, structure-buildability, source offense, target defense, and terrain-share identity. Fallout never creates Population defenders.

Origin-specific Fallout interactions are defined in `ORIGIN_TRAIT_CATALOGUE.md`.

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
- Ordinary placement requires owned buildable terrain; Port additionally requires a legal coast/water interface.
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
| **Factory — simultaneous Tank repair capacity** | 1 | 2 | 3 | 4 | **5** |
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

A Fort never creates Population defenders. Its defensive-pressure effect applies only to a real automatic defender on a covered cell.

### Port

Ports are Trade Ship origins/destinations, naval repair infrastructure, and Warship production structures.

Port level affects passive naval repair only through the table above. The L1 baseline repair rate is **50 HP/s**, so the L1→L5 rates are:

```text
50 / 62.5 / 75 / 87.5 / 100 HP/s
```

Every eligible friendly health-bearing naval unit inside the repair field may receive repair in the same tick. Same-type overlapping Ports use the strongest applicable repair field rather than stacking.

Trade Ship service/economics are defined in `FFY_ECONOMY.md`. Warship production/unit mechanics are defined in `NAVAL_AND_STRATEGIC_WEAPONS.md`.

### Factory

Factories produce Trains and Tanks and repair Tank chassis.

Train routing, timing, station events, dispatch-time Factory economic snapshots, and Train-service ownership epochs are defined in `FFY_ECONOMY.md`.

Baseline Tank repair:

```text
repair radius = 5 cells
repair rate = 100 HP/s per repairing Tank chassis
simultaneous repair capacity = completed Factory level
```

Factory consumers must request an **effective Factory profile** rather than infer a generic `Factory effect multiplier`. The current P34 conquest transformation is explicitly axis-specific: a qualifying conquered Factory uses `1.50×` Train-event base value, `1.50×` Tank-chassis construction speed, `150 HP/s` Tank repair, and an `8-cell` repair radius. Its primary Train-service capacity, turnaround, Tank-build concurrency, Tank purchase price, simultaneous repair capacity, Factory level, and Factory construction/upgrade rules remain ordinary. Exact Origin semantics and interactions are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

### Missile Silo

| Completed level | Weapon access |
| ---: | --- |
| L1–L2 | Atom Bomb |
| L3–L4 | Atom Bomb + Hydrogen Bomb |
| L5 | Atom Bomb + Hydrogen Bomb + MIRV |

Charge capacity equals completed level. Baseline recharge cooldown is **9s / 90 simulation ticks per charge**.

#### Persistent-Silo charge bank

Each active completed Missile Silo owns one deterministic physical charge bank. Capacity is the current completed level and each stable slot is in exactly one state:

```text
READY
or
RECHARGING until absolute readyAtTick
```

The controller-facing summary may expose only `ready`, `capacity`, and remaining recharge ticks; the authoritative simulation/replay retains enough per-slot state to prevent ambiguous or duplicated consumption.

A fresh Silo contributes **no active charge state while its first construction is incomplete**. When a newly materialized/completed Silo first becomes active, every slot in its current completed-level capacity starts **READY**. This applies equally to ordinary completed construction and to an immediate completed grant unless the grant's own canonical mechanic explicitly says otherwise. Consequently, a successful P20 L1 starting-Silo grant begins `1/1 READY` immediately.

During an ordinary upgrade, the previous completed level and its existing charge bank remain active. At the exact tick the higher level activates atomically:

1. capacity becomes the new completed level;
2. every pre-existing charge slot preserves its exact READY/recharge state and existing deadline;
3. every newly added slot begins **RECHARGING**, not READY;
4. each new slot's deadline is `activationTick + effectiveRechargeTicks` using the effective recharge duration resolved for that transition.

Thus an ordinary L1→L2 activation at tick `T` preserves slot 0 and creates slot 1 with baseline `readyAtTick = T + 90`. Completing an upgrade never grants a free instant strategic launch and never resets an older cooling charge.

When a legal strategic launch spends a ready persistent-Silo charge, that one slot begins recharging from the authoritative launch-commit tick. The effective recharge duration is resolved/snapshotted **when the recharge transition begins**; later changes to a recharge modifier do not retroactively move an existing deadline. A slot becomes READY at the first simulation tick satisfying:

```text
currentTick >= readyAtTick
```

A successful `CAPTURE_TRANSFER` preserves the physical Silo's complete charge bank and absolute recharge deadlines. Capture does not refill the Silo and does not restart its cooldowns. After transfer, the new owner's effective rules apply to **future** recharge transitions only.

Persistent-Silo charge state is deterministic serialized/replay state keyed by physical structure identity. Saving/reloading or replaying at any tick must reproduce the same capacity, ready count, per-slot deadlines, and next transition tick.

P53 reads this canonical state but does not alter it: its ready-charge income counts only currently READY charges across owned **active persistent Missile Silo structures**. Capacity without readiness, cooling slots, SAM charges, and P29 Warship-launcher charges do not become P53 income merely because they use a similar charge-state representation.

Strategic-launch transactionality, projectile/blast profiles, and P29 mobile-launcher charge behavior are defined in `NAVAL_AND_STRATEGIC_WEAPONS.md`.

Required Silo lifecycle validation includes at minimum:

- a newly completed ordinary L1 Silo starts `1/1 READY`;
- a successfully granted P20 L1 Silo starts `1/1 READY`;
- spending its charge makes it unavailable for the full effective recharge duration;
- L1→L2 activation preserves slot 0 and creates slot 1 cooling for one full effective recharge duration;
- upgrading while an older charge is cooling preserves that older deadline exactly;
- capture preserves both ready/cooling slot state and deadlines;
- P53 income changes with current READY persistent-Silo charges and does not count new capacity until its new slot becomes ready;
- save/replay reproduces every charge transition on the same tick.

### SAM Launcher

Targeting/interception is automatic. Charge capacity equals completed level. Baseline recharge cooldown is **9s per expended charge**. Range is `70 / 80 / 90 / 100 / 105`.

### Observation Post

Reveals legally revealable operational state inside its completed-level radius, including hostile mobile units, persistent structures, and manifested operations needed for tactical decisions.

It never reveals controller memory, unmanifested plans, hidden private state, or information outside the surfaced visibility model. Observation coverage is boolean; overlapping Posts do not stack.

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