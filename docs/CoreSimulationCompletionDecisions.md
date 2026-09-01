# Open Fufu — Core Simulation Completion Decisions

## Status and precedence

This document records the latest accepted foundational game-mechanics decisions from the pre-implementation Open Fufu design discussion.

It supplements `docs/OpenFufuDesign.md`, `docs/GameMechanics.md`, `docs/PopulationEconomyDecisions.md`, `docs/SpatialAllocationDecisions.md`, `docs/LatestMechanicsDecisions.md`, `docs/ControllerRuntimeDecisions.md`, `docs/SpatialSimulationGrowthDecisions.md`, and `docs/LootSamplingDecisions.md`.

Where this document makes a concrete decision that an older document still describes as tentative or unresolved, this document takes precedence.

This remains a game-design document, not an implementation plan.

---

## 1. Cell-level combat and territorial resolution

Authoritative combat, casualties, local pressure, and territorial ownership changes are resolved at cell level.

Segments, contacts, factions, and any player-defined higher-order concepts are controller-facing ways to reason about the map; they do not become simulation buckets.

Combat should be deterministic and based on local effective population pressure.

At a contested location, conceptual effective pressure is:

```text
local allocated Population density
    x explicit attack/defense modifiers
```

Explicit modifiers may come from terrain, structures, items, future factions/classes, and other clearly surfaced mechanics.

Casualty generation and territorial movement are separate outcomes.

### Territorial advantage

The accepted mathematical direction for relative local advantage is a bounded comparison such as:

```text
advantage = (A - D) / (A + D)
```

where `A` and `D` are effective local attacking and defending pressures.

This provides diminishing returns to overwhelming superiority while preserving meaningful concentration advantages.

Territorial capture/advance speed should be driven by positive local advantage multiplied by a base advance rate and explicit movement/capture modifiers.

### Casualties

Casualties should depend on bilateral engagement intensity rather than merely on capture outcome.

The accepted direction is an engagement function based on both participating pressures, such as:

```text
engagement ~= 2AD / (A + D)
```

with casualty shares then influenced by opposing effective pressure so the stronger side tends to trade favorably without becoming immune to losses.

Desired qualitative behavior:

```text
equal forces
    -> high casualties, little movement

small superiority
    -> slow movement, modestly favorable casualty exchange

large superiority
    -> faster movement, strongly favorable casualty exchange

undefended area
    -> rapid capture with essentially no combat casualties
```

Exact coefficients remain ruleset/balance data.

### Multiple hostile factions

Multiple factions may exert local pressure simultaneously.

Do not force all combat into artificial isolated pairwise duels or treat co-attacking enemies as allies.

If multiple hostile factions attack the current owner of a location, all relevant pressures participate in the local resolution. If the owner loses control, the strongest successful claimant takes the cell according to the deterministic combat/capture rules, while all other hostile relationships remain intact.

---

## 2. Universal spatial-allocation primitive

The underlying population-control mechanism is a desired population distribution over cells.

Higher-level controller logic must ultimately resolve into:

```text
Population budget
    + eligible cell set
    + per-cell weights
        -> normalized desired cell-level Population distribution
```

The engine must not contain separate privileged military mechanics for high-level helper concepts.

Segments, runtime-derived contacts, faction-level targeting, coastline queries, objectives, and player-defined abstractions are selectors or generators for the cell set and weights.

A simple controller may distribute Population evenly across relevant cells. An advanced controller may generate arbitrary deterministic spatial weighting over accessible cells.

The simulation therefore receives a cell-level desired Population field regardless of the abstraction used by the player to produce it.

---

## 3. Desired-to-actual redeployment transition

Each relevant cell/reserve allocation has a desired and actual Population commitment.

The simulation computes where actual commitment exceeds desired commitment (`excess`) and where it is below desired commitment (`deficit`).

Each simulation interval has a deterministic movement budget:

```text
movement budget = Redeployment Rate x dt
```

At most that amount of Population may move from excess allocation toward deficit allocation during the interval.

V1 has no intrinsic distance cost for redeployment. Movement toward deficits should therefore be deterministic and may be distributed proportionally across current deficits.

The already accepted Redeployment Rate remains the single surfaced intrinsic limiter, with sublinear scaling relative to total faction Population (accepted starting direction approximately `Population^(2/3)`).

### No explicit redeploying pool required in V1

Because V1 deliberately does not model physical redeployment travel time or distance, a separate persistent `redeploying` Population state is not required.

Population accounting may remain:

```text
Total Population
    = actual active allocations
    + reserve
```

while actual allocation changes only within the Redeployment Rate throughput budget.

If future logistics, distance, rail routing, transport, or supply mechanics introduce meaningful travel time, a true in-transit/redeploying state may be added then.

---

## 4. Segment-generation algorithm direction

Segments remain immutable deterministic geographical map regions and controller-facing spatial lenses.

Segment count is an output of map size and geography, not an arbitrary fixed count supplied per map.

Generation should use an approximate target scale with variable actual sizes.

Conceptually expose/tune:

```text
minimum useful segment area
preferred segment area
maximum useful segment area
```

These are guidelines rather than absolute constraints when geography creates a strategically meaningful exception.

### Strong geographical boundaries

Generation should strongly respect features such as:

- ocean/coast;
- impassable terrain;
- disconnected landmasses;
- major rivers;
- major mountain ridges;
- strong natural chokepoints.

### Soft geographical preferences

Generation may prefer, but need not rigidly obey:

- terrain transitions;
- elevation changes;
- geographical shape and coherence.

Oversized homogeneous regions should be split deterministically.

Tiny meaningless slivers should normally merge into the most geographically sensible neighboring segment.

Small but strategically/geographically meaningful features, such as a narrow mountain pass, may remain below the usual minimum area.

Automatic generation must work for both authored and procedural maps. Future authored maps may optionally override or hand-author segments, but automatic segmentation is the baseline requirement.

Exact area values and generator heuristics remain implementation/tuning details.

---

## 5. Population growth formula direction

Population growth uses the already accepted distinction between:

- Population Capacity;
- raw productive Growth Value;
- sublinearly scaled faction Growth Potential;
- current Population/Capacity utilization multiplier.

### Capacity

Population Capacity may scale approximately linearly with owned viable territory quality and explicit capacity-providing structures/items.

Larger empires can therefore sustain substantially larger eventual populations.

### Growth throughput

Replacement/growth throughput must scale sublinearly with productive territorial value so a larger empire gains an advantage without receiving proportional regeneration in every dimension.

Accepted starting balance direction:

```text
Growth Potential ~= Productive Territory^0.75
```

The precise exponent is tuning data; approximately `0.7-0.8` is the current expected test range.

### Utilization band

Growth efficiency has a broad optimal band rather than a single mathematical sweet spot.

Approximately 40-60% of current Population Capacity should provide full Growth Potential.

Below 40% and above 60%, growth efficiency falls smoothly rather than through hard thresholds.

Current tuning anchors are approximately:

```text
Population / Capacity    Growth efficiency
10%                      ~45%
20%                      ~70%
30%                      ~88%
40-60%                   100%
70%                      ~85%
80%                      ~60%
90%                      ~35%
100%                     0%
```

These percentages describe the accepted shape and strategic intent, not immutable final balance constants.

The high-population side may be penalized somewhat more strongly than the equivalent low-population side so badly damaged factions can recover without granting an explicit losing-player bonus.

No last-place/rubber-band growth modifier exists.

### Structures and modifiers

Growth-related structures should normally contribute to raw Capacity and/or raw Productive Growth Value before the empire-wide sublinear Growth Potential scaling, so flat structure bonuses do not trivially bypass the anti-snowballing model.

Items and future explicit modifiers may then affect surfaced Capacity/Growth stats according to the general item/stat system.

---

## 6. Inherited OpenFront mechanic compatibility audit is required

Open Fufu intends to retain the existing OpenFront structure/unit concepts for the first playable version unless a mechanic proves fundamentally incompatible.

Before implementation planning, perform a dedicated source-level compatibility audit of inherited mechanics and classify each as:

```text
A. preserved essentially unchanged

B. preserved but translated into Open Fufu's
   Population / FFY / cell-pressure model

C. temporarily disabled only if fundamentally incompatible
```

Likely conceptual translations include, but are not yet individually locked without the audit:

```text
City
    -> Population Capacity / Growth contribution

Defense Post
    -> explicit local defensive-pressure modifier

Port
    -> naval access + trade FFY events

Trade Ship
    -> FFY-producing successful-return event

Train / station
    -> FFY event generation
       possible explicit redeployment interaction later, but not hidden in V1

Transport Ship
    -> carries committed Population

Warship
    -> naval combat / trade interdiction

Factory
    -> preserve inherited production/economic role where compatible

Missiles / nuclear weapons
    -> explicit cell/structure/Population destruction
```

The exact mapping must be based on the current repository implementation, not memory or assumptions.

---

## 7. Controller-facing API direction

The controller API remains primitive-oriented and strategy-neutral.

### Read surface

The expected conceptual read surface centers on:

```text
game
factions
cells
segments
contacts
structures
units
economy
population
runtime / lastDecision
```

The exact names and type hierarchy are implementation/API-design work.

### Write/action primitives

The action surface should expose low-level legal game operations such as:

- desired Population allocation/spatial weighting;
- construction;
- upgrades;
- unit creation;
- unit movement/targeting;
- naval operations;
- missile/weapon use;
- surrender/capitulation where applicable.

Do not provide privileged built-in strategic policies.

### Immutable per-invocation snapshot

Each controller invocation receives one immutable deterministic observation snapshot corresponding to a specific authoritative simulation state.

The simulation does not advance underneath a controller invocation.

Conceptually:

```text
authoritative simulation state at tick N
        -> immutable observation snapshot
        -> controller executes
        -> transactional proposed decision
        -> validate
        -> commit or reject atomically
```

Repeated queries during one invocation therefore observe the same world state.

Returned collection ordering and other observable iteration behavior must be deterministic.

This requirement complements the transactional failure semantics already defined in `docs/ControllerRuntimeDecisions.md`.

---

## 8. Remaining work after these decisions

The foundational mechanics above are accepted.

The next major design/audit task should be the **inherited OpenFront structure/unit compatibility audit**, using the current repository source as authority.

Remaining unresolved details are primarily one of:

- ruleset/balance constants;
- concrete controller API naming/types;
- segment-generator implementation heuristics;
- exact compatibility translations discovered by the inherited-mechanics audit;
- implementation architecture and migration planning.

Supply/connectivity/logistics remains deliberately deferred.