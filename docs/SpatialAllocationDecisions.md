# Open Fufu — Spatial Allocation and Visibility Decisions

## Status and precedence

This document records accepted gameplay decisions for Open Fufu's spatial-control model. It supplements `docs/OpenFufuDesign.md`, `docs/GameMechanics.md`, and `docs/PopulationEconomyDecisions.md`.

Where this document makes a concrete decision that an older document still describes as unresolved or tentative, this document takes precedence.

This is a game-design document, not an implementation plan.

---

## 1. Global geography versus local operational intelligence

Open Fufu distinguishes **knowing that a place exists** from **knowing the detailed military state of that place**.

The following are globally known to controllers:

- static map geography;
- terrain;
- coastlines and oceans;
- impassable cells/areas;
- territory ownership;
- political boundaries;
- the broad spatial shape of every faction;
- the small globally public macro-stat set defined elsewhere.

This means a controller may reason about and route toward any known geographical part of another faction even if the two factions do not currently share a land border there.

For example, if Fufu and Tanya share one land front but Tanya also owns a distant coastline facing another faction, Fufu may deliberately route transports around the map and attempt an amphibious landing on that distant Tanya coastline.

The fact that Fufu lacks operational intelligence there does **not** prevent it from selecting that location as an objective.

---

## 2. Operational contact and fog of war

Detailed military/operational information is local to **operational contact**, not merely land-border adjacency.

Operational contact can arise through situations such as:

- adjacent hostile territories;
- active land combat;
- naval units encountering one another;
- transports or warships reaching a hostile coast;
- amphibious landing attempts;
- other unit interactions that make local combat state relevant.

Where operational contact exists, controllers may receive the local information necessary to reason about the encounter, such as:

- local population commitment/pressure;
- visible local structures;
- local combat modifiers;
- terrain and geometry;
- relevant unit activity;
- other tactical state required by the final combat model.

Distant operational information remains hidden even though geography and territory ownership are globally visible.

Enemy mobile units should not be assumed globally visible merely because political territory is globally visible. Exact mobile-unit visibility rules remain tunable, but the design must preserve the possibility of genuine surprise naval/amphibious attacks.

The accepted visibility principle is therefore:

```text
GLOBAL
    terrain
    political ownership
    boundary geometry
    public macro stats

LOCAL / OPERATIONAL CONTACT
    local force allocation
    combat pressure
    visible dynamic units
    visible local defenses
    tactical modifiers

PRIVATE
    controller memory
    desired future allocation
    intended targets
    internal decision state
```

---

## 3. Segments are the primary geometric abstraction

A **segment** is the accepted baseline spatial abstraction for controller-facing geometry.

A segment is a contiguous, game-generated portion of a meaningful territorial boundary. Segments aggregate many cells into a manageable spatial object so ordinary users do not need to reason cell-by-cell.

Segments may represent boundaries such as:

- faction-to-faction land boundaries;
- faction-to-neutral boundaries;
- coastlines;
- other meaningful boundary classes if later useful.

Segments exist independently of whether combat is currently occurring.

Examples:

```text
Fufu | Tanya   -> faction boundary segment
Fufu | neutral -> expansion boundary segment
Fufu | ocean   -> coastal segment
```

A controller may query global segment geometry even for distant enemy territory. This is what allows intentional routing toward a remote hostile coastline or other surprise objective without revealing detailed local military state.

---

## 4. Fronts are higher-level interpretations of segments

A **front** is not the fundamental spatial primitive.

A front is a useful higher-level grouping/interpretation of one or more relevant hostile/contact segments.

Conceptually:

```text
Front against Tanya
    segments:
        #17
        #18
        #19
```

The same faction boundary segment can exist while no fighting occurs and later become part of an active front when hostilities occur.

This avoids changing the underlying geometric object merely because war state changes.

Controllers may operate at either level:

- high-level faction/front reasoning;
- lower-level segment reasoning.

---

## 5. Segment generation and granularity

Segments must not degenerate into one-cell objects, because that would recreate the original accessibility problem.

The game should automatically subdivide long or irregular boundaries into manageable segments using meaningful geometry.

Potential segmentation signals include:

- disconnected boundary components;
- major direction/curvature changes;
- substantial terrain changes;
- chokepoints;
- structure/area-of-influence transitions;
- boundary type changes such as land-to-coast;
- maximum useful segment length.

The exact segmentation algorithm and thresholds remain unresolved/tunable.

The design requirement is that segmentation should produce useful aggregates that are stable enough for controller reasoning while responding naturally to changing territory.

---

## 6. Segment identity and lineage

Controllers should **not** be encouraged to depend permanently on fixed segment IDs, because territorial geometry is dynamic and segments may split, merge, appear, or disappear.

Normal controller logic should re-select current segments by properties, for example:

- weakest visible enemy segment;
- mountain-heavy segment;
- farthest enemy coastal segment;
- segment nearest a target structure;
- highest-threat segment.

However, the simulation must preserve **internal lineage/continuity** when segmentation changes so geometry changes do not falsely trigger population redeployment.

### Split example

If one segment carrying 20,000 actual committed population becomes two segments because the boundary changes, the new segments inherit that existing local commitment according to their geometric continuity/overlap.

This is a repartition of existing spatial state, **not a redeployment event**.

### Merge example

If two adjacent segments carrying 8,000 and 12,000 committed population merge into one segment, the resulting segment carries the combined 20,000 actual commitment without imposing a redeployment cost.

The controller's desired policy can then be recomputed normally on the next decision cycle.

Exact overlap/matching algorithms are implementation topics; the gameplay requirement is continuity of actual commitment across harmless segment recomputation.

---

## 7. Population remains globally owned

Open Fufu V1 uses the accepted **global-population allocation** model.

Population does not physically reside in individual cells or regions as a demographic simulation.

A faction has one total current Population value. Controller allocations assign literal portions of that total population to strategic purposes.

If total population is 100,000, then a 55% commitment literally represents 55,000 current population.

There is no hidden mobilization ratio or separate manpower pool.

---

## 8. Hierarchical population allocation

Population control should have a low entry floor and high skill ceiling.

The accepted conceptual hierarchy is:

```text
TOTAL POPULATION
        ↓
faction / neutral-expansion budgets
        ↓
fronts
        ↓
segments
        ↓
operations / spatial weighting
        ↓
cell-level simulation pressure
```

A beginner should be able to express strategy at the top of this hierarchy, while advanced users may refine lower layers.

### High-level example

A controller may allocate literal percentages such as:

```text
50% against Tanya
25% against Ski
15% neutral expansion
10% unassigned/reserve
```

If Tanya touches the faction in several disconnected places, a documented built-in policy distributes Tanya's budget among those fronts/segments competently unless the controller overrides it.

### Lower-level refinement

More advanced controllers may weight individual fronts or segments, select objectives, concentrate force, hold certain segments, withdraw, or apply custom spatial weighting.

All helper APIs must ultimately resolve to the same underlying population allocation/spatial weighting system; helpers must not provide hidden combat powers unavailable to advanced controllers.

---

## 9. Front/segment weighting

For sub-allocation within a larger population budget, **weights** are preferred over requiring users to manually provide nested percentages that sum to 100%.

Example:

```text
Tanya budget: 50,000
segment/front weights: 5 : 2 : 2 : 1

result:
25,000
10,000
10,000
 5,000
```

The engine performs normalization of weights within the already valid parent budget.

This is different from top-level total-population allocation, where commitments may not exceed 100% of total current population.

If the controller requests invalid top-level allocation above 100%, the engine should not silently normalize away the error. Exact fail-safe behavior remains to be finalized, but invalid requests must be explicit and debuggable.

---

## 10. Operations within segments/fronts

Operations determine **how an already assigned population budget is spatially applied**, not how much additional population exists.

Useful operation concepts include:

- broad push;
- focused push toward an objective;
- hold;
- withdraw/fall back;
- amphibious/naval landing objective;
- protect an objective;
- custom segment/spatial weighting.

A blitzkrieg-like strategy remains emergent: concentrate a front's assigned population into a narrow set of segments/objective corridors and aggressively exploit territorial changes.

There is no privileged `blitzkrieg()` combat rule required.

---

## 11. Surprise naval/amphibious attacks

The spatial/visibility model must explicitly support surprise attacks against remote hostile territory.

Because global political geography and segment geometry are known, a controller can select a distant enemy coastline even if the faction has no local land contact there.

For example, a controller may reason conceptually:

```text
find Tanya coastal segments
    ↓
prefer segments farthest from our current Tanya front
    ↓
route transport/naval operation there
    ↓
land and create new operational contact/front
```

The attacker does not gain detailed advance knowledge of the defender's local population commitment or hidden tactical state merely because it knows the coastline exists.

This creates genuine strategic uncertainty: the controller can infer that a remote coast may be weak, but must take the risk of testing that assumption.

---

## 12. Desired versus actual population allocation

Controllers express a **desired allocation**.

The simulation maintains an **actual allocation** that moves toward the desired state over time.

This prevents instant teleportation of effective fighting power across the map.

Conceptually:

```text
DESIRED
Tanya    50%
Ski      25%
Expand   15%
Reserve  10%

ACTUAL
Tanya    30%
Ski      40%
Expand   20%
Reserve  10%
```

Actual allocation converges toward desired allocation subject to Redeployment Rate.

When total population changes, percentage-based desired allocations automatically represent the corresponding new absolute population values.

---

## 13. Redeployment Rate

Open Fufu V1 should have **one explicit Redeployment Rate mechanic** governing how quickly actual population allocation may change toward desired allocation.

Do not add hidden special-case modifiers such as:

- reserve-to-front bonus speed;
- front-to-front penalty;
- emergency reinforcement speed;
- home-territory redeployment bonus.

Any modifier to redeployment should come from an explicit gameplay source such as:

- an item;
- a structure;
- terrain;
- rail infrastructure;
- a future class/faction effect;
- another clearly surfaced mechanic.

The base numeric Redeployment Rate remains unresolved balance data.

Distance-based routing/logistics is **not required for the initial model**. The V1 purpose of Redeployment Rate is simply to prevent instantaneous strategic reorientation without prematurely introducing a supply/logistics simulation.

Redeployment Rate is a valid future item/stat family.

---

## 14. Reserve

Reserve is not a separate resource and receives no hidden mechanical advantage.

Reserve simply means:

> population currently not assigned to exert expansion or combat pressure.

Reserve remains part of total population and obeys the same Redeployment Rate rules when reassigned.

The reason to keep reserve is strategic flexibility chosen by the controller, not an undocumented engine bonus.

---

## 15. Redeploying population

Population currently changing from one allocation to another may be represented as a transient **redeploying** portion of the same total population.

Redeploying population is not a new resource.

It represents population temporarily between its previous actual assignment and its intended destination while actual allocation converges toward desired allocation.

The exact tick-level accounting remains to be defined, but the invariant is:

```text
total population
    = actual active commitments
    + reserve
    + currently redeploying population
```

No hidden population should appear or disappear as allocation changes.

---

## 16. FFY remains event-driven

FFY generation is not a passive tax derived directly from total population.

FFY is produced by explicit economic reward events in the world.

Examples include:

- successful trade completion;
- train/station economic events;
- capturing valuable assets;
- piracy/capture events;
- other inherited or future infrastructure/economic events.

A gold/FFY-focused controller therefore optimizes the frequency, value, risk, placement, and protection of economic events rather than merely maximizing a passive income stat.

Structures may alter the strength/frequency of events. For example, a high-level dock could create fewer but more valuable concentrated trade events, while several lower-level docks could distribute risk across more trade attempts.

Terrain-based FFY bonuses should preferably modify relevant economic events/structures rather than make ordinary land passively emit currency without an explicit mechanic.

---

## 17. Derived war state

For non-team factions, `atWar` is a **derived state describing current/recent hostilities**, not a diplomatic permission flag.

FFA opponents remain legally attackable regardless of whether `atWar` is currently true.

Hostile action can set `atWar = true` for both factions.

If neither side performs hostile actions for a sufficiently long period, `atWar` may return to false.

This allows emergent ceasefires or informal coalitions without dynamic alliance mechanics.

`atWar` may also drive explicit systems such as reduced trade profitability during active hostilities.

The exact inactivity duration/transition rule remains unresolved balance data.

---

## 18. Open questions remaining in this subsystem

The spatial model is now conceptually accepted. The remaining questions are narrower:

1. exact automatic segment-generation rules and granularity;
2. exact front grouping rules over segments;
3. exact built-in default population-routing policy;
4. exact controller API for high-level allocations, front weights, segment weights, and operations;
5. exact invalid-allocation fail-safe behavior;
6. exact base Redeployment Rate and how it is applied per tick;
7. exact transient redeploying-population accounting;
8. exact mobile-unit operational-visibility rules;
9. exact rules for when new operational contact reveals local state;
10. exact combat equations that consume the resulting spatial population pressure.

Supply/connectivity remains deliberately deferred.