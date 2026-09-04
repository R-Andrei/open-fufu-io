# Open Fufu — Strategic Spawn Geometry

## Status and authority

This file is the **canonical detailed V1 appendix for Strategic Spawn geometry, exact-origin spacing, deterministic starting-footprint construction, and spawn-shape Origin transformations**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for the overall three-phase Strategic Spawn protocol, Initial Territory / Starting Population semantics, controller lifecycle, and general match rules. [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) remains authoritative for Origin trait IDs/costs.

Nothing in this file authorizes gameplay implementation.

All numeric values here are accepted provisional V1 balance/geometry values. They may be benchmark-retuned later without reopening the three-phase fairness model or the distinction between influence area, exact origin, and generated Initial Territory.

---

# 1. Ordinary influence region

Ordinary Strategic Spawn uses one circular broad influence region with radius **400 raster cells**.

For an influence center `(cx, cy)`, a raster cell `(x, y)` lies inside the ordinary region when:

```text
dx = x - cx
dy = y - cy

dx² + dy² <= 160,000
```

The influence region is a **search space**, not owned territory and not a reservation. Different factions' regions may overlap freely.

The influence center itself does not have to be legal Initial-Territory land. It may be placed offshore or over otherwise spawn-ineligible geography when doing so deliberately positions the legal search area around islands/coasts. The later exact origin must itself be legal.

## 1.1 P39 split influence area

P39 keeps its accepted rule of two influence regions, each exactly **50% of ordinary area**.

For circular regions, each P39 region therefore uses:

```text
dx² + dy² <= 80,000
```

Equivalent radius:

```text
sqrt(80,000) ~= 282.84 cells
```

Both P39 areas are submitted/revealed under the same simultaneous Phase-1 / Phase-2 rules as ordinary factions.

---

# 2. Exact-origin legality and spacing

An exact origin must:

- lie inside that faction's final influence region;
- be a legal Initial-Territory seed cell under the surfaced terrain/map rules;
- not be Impassable, Deep Water, or otherwise explicitly spawn-ineligible;
- satisfy the foreign-origin spacing rule after deterministic simultaneous resolution.

Different factions' resolved exact origins must be at least **50 cells Euclidean distance** apart:

```text
dx² + dy² >= 2,500
```

P39's two origins belong to the same faction and are therefore exempt from the foreign-faction 50-cell spacing requirement. They must still be two distinct legal origin cells.

This spacing is deliberately much larger than the equivalent radius of an ordinary 1,000-population-bearing-cell compact start. Close/counter-spawning remains strategically meaningful without permitting nearly coincident starting seeds.

---

# 3. Deterministic exact-origin resolver

Exact origins resolve simultaneously; controller execution order never decides who wins a collision. The V1 resolver algorithm is versioned independently as:

```text
spawnResolverVersion = "1"
```

The match binds that version. Algorithm changes require a new resolver version; ordinary balance-number changes use the appropriate ruleset/catalogue version rather than silently redefining resolver `1`.

## 3.1 Stable deterministic tie primitive

Use one reusable non-cryptographic deterministic 32-bit tie primitive conceptually equivalent to:

```text
stableTie32(domain, spawnResolverVersion, matchSeed, ...canonical keys)
```

It must use fixed 32-bit integer operations with cross-platform deterministic output. It exists only to shuffle otherwise equal candidates; it is not a security hash.

Every ordering also has semantic fallback keys (such as `FactionId`, slot index, `CellId`) after the tie value so a hash collision can never make behavior undefined.

Cryptographic SHA-256 remains appropriate for stored integrity/cell-set hashes; that is a different purpose.

## 3.2 Hook defaults

Missing, malformed, rejected, or runtime-faulting Strategic Spawn hooks use these deterministic defaults:

- **`chooseInfluence()`**: for each required influence slot, choose a deterministic legal spawn-seed cell ranked from the compiled legal-seed set using match seed + faction ID + slot + resolver version. Multi-slot profiles choose distinct fallback centers. Using a legal seed as center guarantees at least one legal origin candidate lies inside the area.
- **`reconsiderInfluence()`**: retain that faction's successfully resolved Phase-1 influence center(s) unchanged.
- **`chooseOrigins()`**: for each required slot, choose the legal origin inside its final influence region nearest to that influence center, using the canonical tie ordering below.

A hook fallback does not by itself fault the controller for normal match play. Successfully committed controller memory from earlier lifecycle callbacks remains available under `CONTROLLER_MEMORY.md`.

## 3.3 Conflict graph and priority

If all requested exact origins already satisfy legality/spacing, retain them exactly.

Otherwise construct an undirected conflict graph over requested origins. An edge exists between two **foreign-faction** origin slots whose requested cells violate:

```text
distance² < 2,500
```

P39 same-faction origins do not receive a foreign-spacing edge, but they must remain distinct legal cells.

Resolve each connected conflict component using priority sorted by:

```text
stableTie32("exact-origin-priority", version, matchSeed, factionId, originSlot)
factionId
originSlot
```

The first legal origin in that order keeps its requested cell. Each later origin is resolved against already resolved foreign origins.

## 3.4 Nearest in-region fallback

For a displaced otherwise well-formed requested origin, scan legal candidate cells inside that slot's final influence region and choose the minimum tuple:

```text
(
  squaredEuclideanDistanceFromRequestedOrigin,
  stableTie32("exact-origin-cell", version, matchSeed, factionId, originSlot, cellId),
  cellId
)
```

A candidate must:

1. be a valid map cell and legal Initial-Territory seed terrain;
2. lie inside that slot's own final influence region;
3. remain at least 50 cells from every already resolved foreign-faction origin;
4. not duplicate another origin slot of the same faction.

Because the ordinary influence radius is only 400 cells, exhaustive bounded scanning is preferred over a more complex spatial structure unless profiling later proves it necessary.

If the hook output is structurally malformed (wrong count, invalid/non-cell IDs, etc.), use the Phase-3 hook default rather than inventing geometric displacement from an invalid request.

## 3.5 Global emergency fallback

If no valid candidate exists inside a final influence region, search the compiled global legal-spawn seed set deterministically, preserving foreign 50-cell spacing where possible and prioritizing candidates nearest that influence center with the same stable tie mechanism.

This is an emergency map/ruleset-defect path, not expected ordinary behavior. It must emit an explicit diagnostic and must never hang/fault the match.

# 4. Ordinary Initial-Territory footprint resolver

The exact origin is a **seed**, not permission for the controller to hand-paint starting territory.

Ordinary V1 Initial Territory remains **1,000 population-bearing cells** before explicit surfaced modifiers. After all Initial-Territory modifiers are applied, the final value is the target number of population-bearing cells that the generated starting footprint must contain.

All faction footprints use one deterministic **round-based simultaneous multi-frontier resolver**. Each footprint owns:

```text
resolved origin
population-bearing quota
shape profile
claimed-cell set
candidate frontier priority queue
population-bearing claimed count
```

The origin is the first claimed cell and its legal cardinal neighbors seed that footprint's frontier.

## 4.1 Compact candidate priority

For an ordinary compact footprint, candidates use:

```text
(
  squaredEuclideanDistanceFromOrigin,
  stableTie32("spawn-compact-cell", version, matchSeed, factionId, footprintSlot, cellId),
  cellId
)
```

A candidate must be legally ownable starting geography and cardinally adjacent to that footprint's already claimed cells. The adjacency requirement prevents teleporting across barriers; geography naturally deforms the otherwise approximately circular growth.

## 4.2 Simultaneous growth rounds

In each resolver round every unfinished footprint proposes its best currently unclaimed legal frontier candidate. Stale/already-claimed candidates are discarded from that queue until a live proposal exists or the frontier is exhausted.

Group proposals by `CellId`.

- one proposal: that footprint claims the cell;
- multiple proposals from foreign factions: winner is selected by deterministic tuple

```text
(
  stableTie32("spawn-footprint-cell", version, matchSeed, cellId, factionId, footprintSlot),
  factionId,
  footprintSlot
)
```

All round winners commit simultaneously, then their newly exposed cardinal neighbors enter the appropriate frontiers.

No faction receives a complete 1,000-cell footprint before another faction begins growing. Source/controller execution order never creates starting-territory priority.

## 4.3 Quota semantics

- population-bearing claimed cells consume the Initial-Territory quota;
- legal ownable `0 Capacity` terrain such as ordinary Tundra/Shallow Water may be claimed while traversing/growing and does **not** consume the population-bearing quota;
- Deep Water/Impassable and other non-ownable barriers are never painted merely to preserve a visual shape;
- if one candidate/arm is blocked, the frontier continues elsewhere until the population-bearing quota is filled whenever reachable legal geography exists.

If a footprint exhausts all legal reachable frontier candidates before filling quota, emit `FOOTPRINT_QUOTA_UNFILLABLE`; validated production maps should make this impossible for legal configurations.

## 4.4 P39 split footprints

P39 first computes the faction's final modified total Initial Territory, then divides the population-bearing quota approximately equally between primary and secondary origins. An odd one-cell remainder goes to the deterministic primary origin.

The two same-faction footprint queues still grow separately under the simultaneous resolver. If both propose the same cell, deterministic footprint-slot ordering decides which queue receives that cell for quota/frontier accounting; politically the cell belongs to the same faction either way. The losing queue continues elsewhere.

Starting Population remains one global pool calculated from the final total Initial Territory. P39 never creates local Population pools.

# 5. P54 — star-shaped Initial Territory

P54 is a **spawn-geometry transformation**, not an acquisition-speed stat bonus.

The faction keeps exactly the same final Initial-Territory population-bearing-cell quota it would otherwise receive. Instead of an ordinary approximately circular footprint, each of its starting footprints uses a deliberately thin-bodied, long-armed **five-point star** target geometry centered on the exact origin.

## 5.1 Ideal star profile

The ideal profile has:

- **5 outward points**;
- 10 alternating outer/inner vertices at equal angular intervals;
- one outer point aligned to the canonical map north axis, giving one deterministic orientation without adding another spawn-control input;
- approximately **6:1 outer-tip radius to inner-valley radius**.

The extreme tip-to-valley ratio is deliberate. At the ordinary roughly 1,000-cell scale, the intent is a small central body with long, thin territorial arms extending much farther from the origin than an equal-area circular start.

At equal idealized area, a five-point `6:1` star has roughly three-and-a-half times the perimeter of the equivalent circle before raster/geography deformation. That additional boundary is the only intended mechanical benefit: more neutral cells can be simultaneously adjacent/actionable under ordinary expansion rules.

P54 therefore does **not** guarantee faster expansion. It merely creates more potential starting contact surface if geography and Population allocation allow the controller to exploit it. Terrain can blunt, bend, or waste individual arms.

## 5.2 Raster/geography construction

P54 uses the same connected simultaneous frontier resolver as ordinary spawning, but replaces the compact radial priority with one canonical versioned **fixed-point five-point-star shape score**.

Resolver version `1` commits one ten-vertex normalized star template: five alternating outer/inner vertices, map-north outer-point orientation, and the accepted `6:1` outer-tip-to-inner-valley ratio. The implementation must use committed integer/fixed-point template constants rather than platform runtime trigonometry so rasterization is byte-for-byte deterministic.

For a candidate offset `(dx, dy)`, compute the minimum fixed-point scale at which that offset lies inside the canonical star polygon. Candidate ordering is then:

```text
(
  starScaleScore,
  stableTie32("spawn-star-cell", version, matchSeed, factionId, footprintSlot, cellId),
  cellId
)
```

The candidate must still be cardinally adjacent to the already claimed footprint, so geography/barriers can bend, blunt, or waste an arm rather than allowing disconnected painted territory.

The same quota and simultaneous-collision rules as ordinary spawning apply:

- population-bearing cells consume quota;
- naturally included ownable `0 Capacity` cells do not consume quota;
- barriers/topology may deform individual arms;
- the frontier continues through other legal candidates rather than reducing the faction's Initial Territory merely because one point hits water/Impassable terrain;
- simultaneous foreign-faction cell collisions use the Section 4 resolver.

P54 changes **only generated starting-footprint geometry**. It does not alter:

- final Initial Territory;
- Starting Population;
- Population Capacity per cell;
- ordinary capture/settlement progress coefficients;
- neutral-settlement Population cost;
- later territorial growth shape.

Its advantage comes from the ordinary combat/acquisition system seeing a longer starting boundary/contact surface.

## 5.3 P54 + P39

P39 and P54 are ordinary legal catalogue traits and combine without a compatibility exception.

When both are selected:

- P39 still provides two half-area influence regions and two exact origins;
- final modified Initial Territory is still divided between the two footprints;
- **each split footprint uses the P54 five-point `6:1` star geometry**;
- Starting Population remains one global pool.

Thus the combination produces two smaller needle-like starts rather than one star receiving the full quota twice.

---

# 6. Spawn immunity

After all Initial-Territory footprints and singular start-state grants finish resolving, every faction receives **5 seconds** of ordinary spawn immunity.

During this window, hostile actions cannot successfully damage/capture the protected faction's starting state or use the protected faction as a legal hostile target. Neutral expansion, controller decisions, construction/economy setup, movement, and other non-hostile preparation may continue normally.

The immunity duration is global match-time protection, not ten special controller turns; at the accepted 2 decisions/second controller cadence it happens to provide roughly ten ordinary decisions before hostile interaction may resolve.

Minor-faction behavior obeys the same protection boundary and cannot bypass it merely because it is engine-owned.

---

# 7. Resolver diagnostics, replay, and version binding

The resolver emits stable machine-readable diagnostics rather than relying on prose logs.

Exact-origin/hook reason codes include at least:

```text
ORIGIN_ACCEPTED
ORIGIN_OUTSIDE_INFLUENCE
ORIGIN_ILLEGAL_TERRAIN
ORIGIN_DUPLICATE_OWN_SLOT
ORIGIN_FOREIGN_SPACING_CONFLICT
ORIGIN_IN_REGION_FALLBACK
ORIGIN_GLOBAL_FALLBACK
HOOK_MISSING
HOOK_MALFORMED
HOOK_RUNTIME_FAULT
```

Footprint summary codes include:

```text
FOOTPRINT_COMPLETE
FOOTPRINT_QUOTA_UNFILLABLE
```

Per-footprint diagnostics should retain compact summaries such as:

```text
populationBearingQuota
populationBearingClaimed
totalCellsClaimed
zeroCapacityCellsClaimed
contestsWon
contestsLost
boundingBox
cellSetSha256
```

Do not log every routine cell contest. A small bounded representative conflict sample may be retained for debugger presentation.

## 7.1 Replay representation

The minimal archival replay records Strategic Spawn semantic inputs and authoritative outputs because they are tiny and useful for independent verification:

```text
spawnResolverVersion
Phase-1 submitted/resolved influence centers
Phase-2 submitted/resolved/final revealed influence centers
Phase-3 requested exact origins
resolved exact origins + fallback reason codes
per-footprint quota + shape
final resolved starting cell IDs
cell-set SHA-256
```

Final footprint cell IDs are sorted ascending, delta-encoded, and compressed inside the `.ofr.zst` replay. Starting footprints are spatially coherent and only thousands of cells per faction, so this remains small while allowing playback to restore the exact authoritative starting state.

SQLite `match_factions.spawn_snapshot_json` should retain compact semantic/resolution summaries and cell-set hashes; the replay file carries the full footprint cell list.

Determinism tests may independently regenerate the spawn from map + match seed + bound rules/Origins + submissions + resolver version and compare the regenerated cell sets/hashes to the authoritative replay record.

---

# 8. Validation expectations

Before V1 release, deterministic/accelerated tests should cover at least:

- dense overlapping influence regions;
- many exact-origin collision components;
- coastal/island influence centers;
- ordinary and P39 fallback resolution;
- exact 1,000-cell and modified Initial-Territory quota fulfillment;
- Tundra/Shallow-Water inclusion without consuming ordinary quota;
- star footprints against coastlines, narrow land bridges, barriers, and foreign footprint collisions;
- P39 + P54 interaction;
- replay/hash stability of every spawn decision and fallback.

Retuning radius, pointiness, or spacing after map benchmarks is ordinary versioned balance/geometry iteration. Changing resolver ordering/hash/fallback/rasterization semantics requires an explicit new `spawnResolverVersion`; silent sequential spawn priority or arbitrary controller-painted starting territory is never permitted.
