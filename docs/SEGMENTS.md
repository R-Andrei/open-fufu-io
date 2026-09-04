# Open Fufu — Strategic Segments

## Status and authority

This file is the **canonical detailed V1 specification for immutable strategic Segment generation, membership, sizing policy, connectivity, IDs, compilation, and validation**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for the overall spatial ontology and the rule that Segments are a strategy/query lens rather than simulation physics. [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) governs implementation.

Nothing in this file authorizes gameplay implementation.

---

## 1. Purpose

Cells remain Open Fufu's physical territorial resolution. Segments provide a more ergonomic intermediate geographic vocabulary for controllers that need richer spatial control than faction-level commands but should not have to hand-manage thousands of individual cells.

Useful controller reasoning should include operations such as:

- selecting nearby mostly-Mountain Segments;
- finding Shallow-Water or Deep-Water regions;
- prioritizing a narrow pass, ridge, river-like waterway, island, peninsula, coast, basin, or broad plain;
- weighting/targeting whole strategic regions while retaining cell-level access when needed.

Segments are not provinces, ownership buckets, combat zones, or engine-authored strategic recommendations.

---

## 2. Hard invariants

Every compiled V1 map satisfies all of the following:

1. every real raster cell belongs to **exactly one** Segment, including Deep Water and Impassable terrain;
2. Segment membership is immutable for that compiled map artifact;
3. each Segment is **cardinally 4-connected**;
4. Segment IDs/membership/adjacency do not change during a match;
5. Segment borders have no intrinsic combat, capture, movement, economy, visibility, or other physical effect;
6. dynamic terrain/state changes such as Fallout or a rule that later converts a cell to Deep Water do not regenerate Segment membership;
7. generation is deterministic for one map-source input plus one Segment-generator version.

### 2.1 Meaning of cardinal 4-connectivity

4-connected does **not** mean every cell has four neighbors inside its Segment.

It means that from any cell in the Segment, every other cell in that Segment can be reached through a path of cells in the same Segment using only north/south/east/west adjacency.

A one-cell-wide winding river or a Segment touching a map edge/corner is therefore valid. Two disconnected blobs or blobs touching only diagonally are not one Segment.

---

## 3. Geography outranks size

The ordinary V1 **target** is approximately:

```text
4,096 cells per Segment
```

This is a soft compiler target only. V1 has:

- **no hard minimum Segment size**;
- **no hard maximum Segment size**;
- **no aspect-ratio restriction**;
- **no compactness requirement**.

A coherent 2,000-cell thin winding waterway may remain one Segment. A 9,000-cell long waterway may sensibly become several rope-like Segments along its length. A small island, narrow mountain pass, long ridge, crescent coast, or other strategically meaningful feature may legitimately be far below 4,096 cells. A large coherent basin or broad natural region may legitimately exceed it.

The target matters most where geography offers no more useful boundary—for example, subdividing a very large homogeneous plain.

The ordering of compiler priorities is:

```text
geographic/terrain coherence
> meaningful topology and chokepoints
> terrain homogeneity/useful strategic boundaries
> approximate 4,096-cell target
```

Never destroy a useful geographic feature merely to satisfy the target size.

---

## 4. Terrain/topology treatment

The compiler should generally make Segment boundaries follow visible/mechanical terrain geometry where possible.

Deep Water, Shallow Water, and Impassable terrain are strong distinct geographic domains and should not be casually absorbed into ordinary land Segments. Other terrain changes—especially Mountain/ridge-like geography, Marsh, Forest, Highland, Desert, and similar coherent formations—are strong boundary/subdivision evidence rather than mandatory one-terrain-per-Segment partitions.

A Segment may contain multiple terrain types when geography/topology makes that representation more useful. `terrainCounts` exists precisely so controllers can reason about mixtures such as “mostly Mountain.”

V1 does **not** add semantic geographic tags such as `RIVER`, `RIDGE`, `STRAIT`, `ISLAND`, `COAST`, or `PASS` to `SegmentView`. Controllers use Segment geometry/adjacency plus existing terrain information, including Shallow Water and Deep Water. Geographic tags may be reconsidered in a future API version but are not a V1 dependency.

If current terrain changes after map compilation, Segment membership remains fixed; runtime terrain summaries over a Segment must reflect the legally observable current terrain rather than pretending membership needs to be regenerated.

---

## 5. Feature significance and raster noise

The compiler should preserve **strategically coherent features**, not every isolated raster blemish.

A small feature may deserve its own Segment because of shape, linear extent, terrain contrast, boundary role, chokepoint/topological effect, or obvious geographic coherence even when its area is tiny. Conversely, an isolated one-cell or otherwise meaningless terrain speck need not become a standalone Segment merely because its terrain enum differs from its surroundings.

There is intentionally no universal `if area < N then merge` rule. Feature significance is a deterministic map-compiler heuristic operating under the hard invariants and geography-first priorities in this document.

Those feature-detection weights/heuristics are compiler implementation parameters, not live gameplay rules. They are versioned through the Segment-generator/map artifact, and the final compiled membership is authoritative for that map version.

---

## 6. Accepted compiler pipeline

The V1 compiler should use the following deterministic geography-first pipeline:

```text
terrain/topology raster
→ identify connected coherent terrain/topology features
→ preserve meaningful narrow/topological features
→ subdivide oversized featureless interiors toward ~4,096 cells
→ merge meaningless raster fragments where appropriate
→ enforce/repair cardinal connectivity
→ assign stable Segment IDs
→ compile membership + metadata + adjacency into map artifact
```

### 6.1 Feature-first extraction

Connected terrain/topology evidence is evaluated before generic size balancing. Long narrow features remain long and narrow when that is the useful geographic representation.

### 6.2 Subdivision of featureless/oversized areas

Where geography supplies no better internal boundary, use a deterministic balanced geographic flood/Voronoi-style subdivision targeting roughly 4,096 cells.

Seed placement should be deterministic and geography-aware (for example deterministic farthest-point placement rather than random per-match seeds). The subdivision should prefer terrain transitions, barriers, ridges and chokepoints as boundaries when available.

A long coherent feature that is worth subdividing should normally be split **along its length** into several coherent pieces rather than padded sideways with unrelated neighboring terrain to manufacture compact shapes.

### 6.3 Fragment cleanup

Meaningless isolated fragments may merge into an adjacent Segment selected deterministically using shared-boundary/topological/terrain fit. Fragment cleanup must never break cardinal connectivity or erase a strategically meaningful narrow feature merely because that feature is small.

### 6.4 No match-seeded segmentation

The match seed never participates in Segment generation. Segment membership is a property of the compiled map, not a match.

---

## 7. Stable IDs and compiled representation

After final membership is complete:

1. choose each Segment's representative ordering key as its **smallest CellId**;
2. sort Segments ascending by that key;
3. assign dense `SegmentId` values `0, 1, 2, ...` in that order.

Final V1 Segment count must remain below **65,536**, allowing compact per-cell membership such as a `Uint16Array`.

At 4.8 million cells, a two-byte Segment membership buffer costs about **9.6 MB** before any asset-level compression, which is acceptable for the authoritative map representation.

The compiled map artifact contains at least:

- `segmentGeneratorVersion`;
- per-cell Segment membership;
- stable Segment IDs;
- immutable Segment cell counts/membership metadata;
- Segment adjacency;
- terrain/geography metadata needed for efficient public summaries.

The Segment layer contributes to the canonical map artifact/hash. Never load an old terrain raster and silently regenerate its Segments with a newer generator.

Changing Segment-generation heuristics produces a new compiled map artifact/version; historical matches keep their old map hash and old Segment partition.

---

## 8. Runtime/public behavior

`SegmentView` remains a factual strategic summary. Runtime owner shares and legally observable terrain summaries are derived over immutable Segment membership; they are not stored as immutable ownership facts in the map.

Segment lookup must be cheap enough for ordinary controller use:

```text
cell → SegmentId: O(1)
SegmentId → cell selector: cheap immutable/indexed view
Segment adjacency: precompiled/indexed
```

V1 may later add non-semantic API ergonomics such as a representative cell/center, but no such addition is required to implement the accepted Segment model.

---

## 9. Validation expectations

Every compiled map must validate at least:

- exactly one Segment assignment for every one of the 4,800,000 real raster cells;
- no invalid/missing Segment IDs;
- cardinal 4-connectivity of every Segment;
- symmetric/consistent Segment adjacency;
- no Segment count >= 65,536;
- deterministic byte-identical membership for the same map input + generator version;
- stable ID ordering by smallest CellId;
- sensible preservation of representative rivers/waterways, ridges/mountains, islands/coasts, passes/chokepoints, and featureless plains in map-compiler fixtures;
- no arbitrary hard failure merely because a useful Segment is much smaller/larger/longer/thinner than 4,096 cells.

The distribution around 4,096 cells should be reported as a compiler diagnostic, not enforced as a gameplay legality gate.
