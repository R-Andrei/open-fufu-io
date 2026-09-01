# Open Fufu — Spatial Simulation and Population Growth Decisions

## Status and precedence

This document records accepted game-design decisions from the ongoing pre-implementation mechanics discussion.

It supplements `docs/OpenFufuDesign.md`, `docs/GameMechanics.md`, `docs/PopulationEconomyDecisions.md`, `docs/SpatialAllocationDecisions.md`, `docs/LatestMechanicsDecisions.md`, `docs/ControllerRuntimeDecisions.md`, and `docs/LootSamplingDecisions.md`.

Where this document makes a concrete decision that an older document still describes as tentative, candidate, or unresolved, **this document takes precedence**.

This is a game-design document, not an implementation plan.

---

## 1. Segments are immutable map lenses, not simulation buckets

A **segment** is an immutable, deterministic strategic region generated as part of map creation/preprocessing.

Segments are not faction-owned objects and are not the fundamental combat/simulation resolution.

Every ordinary world cell belongs to a segment. Ownership remains a cell-level property, so one segment may be partially owned by several factions and/or remain partly neutral at the same time.

A segment is therefore a stable spatial index/lens over the underlying cell map.

Example:

```text
Segment 81
terrain composition:
    78% plains
    17% highland
     5% mountain

ownership:
    Fufu   57%
    Tanya  39%
    Neutral 4%
```

The segment itself has not changed; only its cell ownership has.

### 1.1 Segment count is derived from map size and geography

Do not choose an arbitrary fixed number of segments per map.

Likewise, do not use a rigid square grid where every segment has exactly the same dimensions.

The accepted direction is a hybrid biased toward a roughly consistent strategic scale:

- segment generation has a preferred useful area/scale;
- map geography determines actual segment shapes and local sizes;
- larger maps naturally produce more segments;
- smaller maps naturally produce fewer;
- important geographical features may produce smaller-than-normal segments;
- large homogeneous areas should be subdivided deterministically rather than becoming continent-sized segments;
- tiny/sliver regions should be merged sensibly where possible.

Conceptually, `segment count` is an **output of map generation**, not an input target.

### 1.2 Geography guides segment boundaries

Segment generation should strongly prefer meaningful static geographical boundaries such as:

- coastlines/oceans;
- impassable terrain;
- major rivers once represented;
- major ridges/mountain systems;
- obvious chokepoints;
- disconnected islands/landmasses.

Softer terrain transitions may influence segmentation without forcing pathological tiny regions.

Segments may contain mixed terrain. Terrain remains fundamentally a cell property; segment terrain values are aggregated summaries for controller reasoning.

### 1.3 Deterministic authored and random maps

The same segment-generation concept must work for:

- authored/static maps;
- optional randomly generated maps.

For procedural maps, the segment graph is generated deterministically from the map seed and map-generator version after terrain/geography generation.

The resulting segment definitions are part of the map identity/version used for deterministic replay.

---

## 2. Contact is derived runtime political/military geometry

**Contact is not a property stored inside a Segment.**

Segments are static geography; contact is dynamic political/military state.

A contact can be derived at runtime from current cell ownership and other relevant local interactions.

For land ownership, a Fufu/Tanya contact exists where adjacent cells currently have Fufu and Tanya ownership respectively.

A connected contact may cross several immutable segments. Likewise, one segment may contain several distinct contacts between different faction pairs.

A controller-facing `contact` representation, if exposed, should therefore be an ephemeral derived query/result rather than a permanent world entity.

Useful derived contact data may include:

- participating factions;
- current boundary cells/edges;
- contact length/geometry;
- terrain summaries;
- intersected segments;
- local visible pressure/commitment where fog-of-war rules allow it.

Exact runtime-query/API shape remains implementation/API design.

---

## 3. Front is not a canonical simulation concept

Open Fufu does **not** require a first-class engine-level `Front` entity.

Players may define their own idea of a front in controller code using exposed primitives such as cells, segments, contacts, factions, ownership, terrain, and visibility.

Different controller authors may reasonably group contacts differently or choose not to use a front abstraction at all.

The word `front` may still appear informally in design discussion/documentation, but the simulation should not require one canonical grouping rule.

If experience later shows that almost every player independently implements the same grouping helper, a transparent SDK/example utility may be added without making it a privileged simulation primitive.

---

## 4. Simulation remains cell-resolution

The authoritative game simulation should operate at the finest meaningful map resolution: **cells**.

Segments must have no intrinsic combat, movement, capture, or physics effect merely because a segment boundary exists.

A useful invariant is:

> If an artificial segment boundary is redrawn through otherwise identical cells and no controller changes its decisions because of the metadata difference, the authoritative match result should remain unchanged.

Segments are therefore controller-facing spatial indexes/lenses, not simulation buckets.

Controller reasoning may occur at any convenient level:

```text
faction-level reasoning
segment-level reasoning
contact-level reasoning
custom regions/"fronts"
cell-level reasoning
```

but controller decisions must ultimately resolve into the underlying cell-level desired spatial allocation/pressure field that the simulation consumes.

---

## 5. Population allocation ultimately becomes a cell-level pressure field

Population remains one global faction resource and controller commitments remain literal portions of total current Population.

Higher-level controller abstractions are conveniences for constructing spatial allocation, not alternate simulation resolutions.

Conceptually:

```text
Total Population
        ↓
controller strategy / allocation logic
        ↓
segments / contacts / custom regions / direct cell weighting
        ↓
desired cell-level population/pressure distribution
        ↓
Redeployment Rate moves actual distribution toward desired
        ↓
cell-level combat / expansion / capture
```

There is no authoritative value such as `Segment 81 military strength = 20,000` that replaces the cell simulation.

A request expressed using a segment merely selects/weights its underlying cells.

The accepted local-pressure combat direction remains: concentrating the same total Population into a narrower local area can create higher local effective pressure than spreading it broadly.

Exact casualty/capture equations remain open.

---

## 6. Population capacity and growth potential are separate concepts

Population growth should be based on two distinct aggregate concepts:

- **Population Capacity** — approximately how much Population the faction's current land/infrastructure can sustainably support;
- **Growth Potential** — the faction's base rate of adding Population when current Population utilization permits it.

Both may derive from explicit gameplay sources such as:

- owned territory;
- terrain composition;
- structures;
- items/loadout modifiers;
- future faction/class modifiers.

Population Capacity may scale relatively generously/approximately linearly with useful territory quality.

Growth Potential should scale **sublinearly** with total productive territory so large empires gain a strong demographic advantage without gaining proportionally identical replacement throughput.

A starting conceptual scaling direction is something like:

```text
GrowthPotential ∝ ProductiveTerritory^0.75
```

The exponent and coefficients are ruleset/balance data, not immutable design constants.

---

## 7. Growth uses a broad optimal utilization band

Define population utilization conceptually as:

```text
utilization = current Population / current Population Capacity
```

The accepted design goal is a **broad comfort/optimal band around approximately 40%–60% utilization**, rather than one mathematically mandatory exact optimum.

Inside that band, approximately 100% of available Growth Potential should be realized.

Outside it, growth should decline smoothly toward both extremes:

- very low utilization is penalized, but must remain playable and capable of recovery;
- very high utilization is penalized more strongly, but should not completely prevent growth before the actual capacity limit;
- at/above full capacity, ordinary positive growth may reach zero unless explicit mechanics say otherwise.

A representative starting tuning table for future simulation/testing is:

```text
10% utilization  -> ~45% of Growth Potential
20%              -> ~70%
30%              -> ~88%
40%              -> 100%
50%              -> 100%
60%              -> 100%
70%              -> ~85%
80%              -> ~60%
90%              -> ~35%
100%             -> 0%
```

These exact percentages are **not locked balance values**; the accepted decision is the shape and strategic intent: a broad 40–60% full-growth plateau with soft penalties outside it and harsher pressure near capacity than during low-population recovery.

The curve should be smoothly interpolated rather than implemented as abrupt hidden steps.

---

## 8. Population growth must not hard-delete population when capacity falls

If territorial loss or other changes reduce Population Capacity below current Population, the simulation should not instantly kill the excess Population merely to force it under capacity.

Instead, ordinary positive Population growth can be suppressed until utilization again falls into a sustainable range through casualties, territorial recovery, increased capacity, or other explicit mechanics.

This keeps capacity as a growth/sustainability mechanic rather than a hidden mass-death rule.

---

## 9. No explicit last-place rubber banding

Population growth and recovery should emerge from transparent universal mechanics such as:

- Population versus Capacity utilization;
- productive territory;
- structures;
- terrain;
- items;
- other surfaced modifiers.

Do not add a hidden bonus merely because a faction is currently losing or ranked last.

The broad low-utilization recovery behavior and sublinear large-empire Growth Potential are intended to reduce runaway positive feedback without removing the legitimate advantage of successful territorial expansion.

---

## 10. Remaining open mechanics in this area

The accepted ontology is now:

```text
CELL
    authoritative simulation resolution

SEGMENT
    immutable deterministic geographical lens/index

CONTACT
    ephemeral runtime-derived faction/interface query

FRONT
    optional player-defined concept, not engine ontology
```

The remaining game-design questions in this area are primarily:

1. exact cell-level territorial combat/casualty/capture equations;
2. exact deterministic map/segment-generation algorithm and preferred scale parameters;
3. exact Growth Potential terrain/structure inputs and balance coefficients;
4. exact utilization curve values after simulation/playtesting.

The broad mechanics and responsibilities above are accepted.