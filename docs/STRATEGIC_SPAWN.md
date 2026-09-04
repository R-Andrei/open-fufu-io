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

# 3. Deterministic exact-origin conflict resolution

Exact origins resolve simultaneously; controller execution order never decides who wins a collision.

If submitted exact origins already satisfy all legality/spacing rules, they are retained exactly.

When a set of submitted origins conflicts, resolve the conflicting component with a deterministic match-seeded stable priority independent of controller execution timing.

For each later origin in that deterministic priority, choose the nearest fallback cell that:

1. is legal Initial-Territory seed terrain;
2. remains inside that faction's own final influence region;
3. is at least 50 cells from every already resolved foreign-faction origin.

Fallback candidates sort first by geometric displacement from the requested origin, then by a stable deterministic seeded cell tie-break. The exact hash/RNG representation is implementation/versioning detail; the gameplay invariant is deterministic nearest legal displacement rather than source-order privilege.

Map/ruleset validation should make a no-fallback case extraordinarily rare. If no legal cell inside the final influence region exists, use a logged deterministic global legal-spawn fallback rather than hanging/faulting the match.

---

# 4. Ordinary Initial-Territory footprint

The exact origin is a **seed**, not permission for the controller to hand-paint starting territory.

Ordinary V1 Initial Territory remains **1,000 population-bearing cells** before explicit surfaced modifiers. After all Initial-Territory modifiers are applied, the final value is the target number of population-bearing cells that the generated starting footprint must contain.

Ordinary footprint construction uses a deterministic compact approximately circular geodesic/raster wavefront around the exact origin.

Important quota semantics:

- population-bearing owned cells count toward the Initial-Territory quota;
- legal ownable `0 Capacity` terrain such as ordinary Tundra/Shallow Water may be included when naturally encountered/enclosed by footprint growth;
- those `0 Capacity` cells do **not** consume the population-bearing quota;
- Deep Water/Impassable and other non-ownable barriers are not painted merely to preserve visual circularity;
- terrain/topology may deform the ideal shape, but the algorithm keeps expanding when legal geography exists until the population-bearing quota is filled.

All major-faction starting footprints grow/reserve cells under one simultaneous deterministic resolver. A contested starting cell is never awarded by controller/source execution order. If one faction loses a contested candidate cell, its wavefront continues elsewhere until its legal quota is filled whenever the map can support it.

P39 first computes the faction's final modified Initial Territory, then divides that quota approximately equally between its primary and secondary origins. An odd one-cell remainder goes to the deterministic primary origin. Each footprint grows under the same simultaneous global resolver.

Starting Population remains calculated from the final total Initial Territory under the canonical global Starting-Population rules. P39 never creates local Population pools.

---

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

The generator scales/rasterizes the ideal star envelope outward from the exact origin until the connected legal footprint contains the faction's required population-bearing quota.

The same quota rules as ordinary spawning apply:

- population-bearing cells consume quota;
- naturally included ownable `0 Capacity` cells do not consume quota;
- barriers/topology may deform individual arms;
- the generator continues expanding the star profile where legal geography exists rather than reducing the faction's Initial Territory merely because one point hits water/Impassable terrain;
- simultaneous foreign-faction footprint collisions use the same deterministic cell resolver as ordinary spawning.

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

# 7. Validation expectations

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

Retuning radius, pointiness, or spacing after map benchmarks is ordinary balance/geometry iteration; silent sequential spawn priority or arbitrary controller-painted starting territory is not.
