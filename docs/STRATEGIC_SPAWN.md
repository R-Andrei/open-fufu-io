# Open Fufu — Strategic Spawn

## Status and authority

This file is the **canonical owner for Strategic Spawn protocol, public spawn-profile behavior, influence/origin geometry, deterministic exact-origin resolution, Initial-Territory footprint construction, spawn-time singular-effect ordering, spawn immunity, diagnostics, replay representation, and Random/Fixed spawn-mode semantics**.

Origin trait identities/costs remain owned by [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md). The public TypeScript hook shapes remain owned by [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts). Generic persistent-structure grant admission remains owned by [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md). Game-wide Population semantics remain owned by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md).

Nothing in this file authorizes gameplay implementation.

All numeric values here are accepted provisional V1 balance/geometry values. They may be benchmark-retuned later without reopening the simultaneous reveal/commit fairness model or the distinction between influence area, exact origin, and generated Initial Territory.

---

# 0. Spawn profiles, modes, and lifecycle

Open Fufu supports:

- **Strategic Spawn** — the ordinary three-phase controller-driven mode;
- **Random Spawn** — deterministic match-seeded legal placement that bypasses controller Strategic Spawn choices;
- **Fixed Spawn** — exact configured starts for benchmarks, certification, debugging, tournaments/scenarios, and reproducible tests.

The faction's **effective spawn profile is mode-independent**. Rules/Origins determine:

```text
influenceSlotCount
exactOriginCount
influenceAreaCells[]
final Initial-Territory population-bearing quota
footprint shape profile
```

Spawn mode determines **how exact origins are supplied**, not whether spawn-transforming Origin mechanics exist.

Stable origin-slot identity is part of the profile/result:

```text
originSlot 0 = PRIMARY
originSlot 1 = SECONDARY
```

Slot identity comes from the deterministic profile decision/configuration and is never recomputed from geography. A location becoming more northern, western, isolated, valuable, etc. does not relabel the slots.

## 0.1 Canonical start-state ordering

Match initialization uses this order:

```text
1. resolve exact origins
2. generate all Initial-Territory footprints
3. establish political ownership
4. resolve faction-singular start-state effects/grants
5. freeze the authoritative spawn snapshot
6. begin spawn immunity / ordinary match startup
```

A faction-singular start-state effect executes **once per faction** unless its own mechanic explicitly says `per origin` or `per footprint`. A multi-origin profile such as P39 never implicitly duplicates a singular effect.

P20 therefore requests exactly one starting Missile Silo grant at `originSlot 0` after Initial-Territory ownership is established. P39 + P20 still requests one Silo, not one per core. Generic structure admission/materialization is owned by `TERRAIN_AND_STRUCTURES.md`; Silo charge/readiness state is owned by the strategic-launcher closure tracked in #46.

## 0.2 Strategic Spawn hooks

Strategic Spawn uses the specialized pre-match controller hooks `chooseInfluence`, `reconsiderInfluence`, and `chooseOrigins`.

Random and Fixed Spawn do **not** invoke these hooks and do not gain parallel controller callbacks. Controllers still receive ordinary surfaced match/Origin/mechanics state once normal play begins.

Before Strategic Phase 1, every participant receives the static map/Segments, ruleset and lobby constraints, legal spawn-space information, every participant's surfaced Origin, Initial Territory value, Starting Population effects, effective spawn profile, and other strategically relevant public spawn-affecting modifiers.

## Phase 1 — initial influence choice

Every participant simultaneously submits the broad influence center(s) required by its public spawn profile.

Submissions remain hidden until every participant has committed or fallen back. The complete resolved Phase-1 influence set is then revealed simultaneously.

Influence regions are legal search spaces for later exact origins, not territorial reservations. Foreign regions may overlap freely.

## Phase 2 — one reconsideration round

After seeing the complete Phase-1 influence set, every participant receives one simultaneous opportunity to retain or revise its influence center(s).

Phase-2 submissions remain hidden until every participant has committed or fallen back. The resulting final influence regions are then revealed simultaneously.

There is no iterative live-response bidding after seeing another participant's Phase-2 submission.

## Phase 3 — exact origin choice

Every participant simultaneously submits the exact origin cell(s) required by its spawn profile inside its final influence region(s).

Submissions remain hidden until all participants have committed or fallen back. The deterministic exact-origin resolver then resolves legality/conflicts simultaneously. Final exact origins are public before Initial-Territory footprints are generated and normal play begins.

A multi-slot spawn profile such as P39 participates in the same phase/reveal structure; its required slots are one faction decision, not independent sequential turns.

## 0.3 Random Spawn

Random Spawn bypasses controller spawn hooks but applies the same effective spawn profile.

- ordinary profiles resolve exactly one origin slot;
- P39 profiles resolve exactly two origin slots as one faction spawn decision;
- P39 same-faction slots must be distinct but are not subject to the foreign-faction 50-cell spacing rule;
- foreign-faction spacing remains identical to Strategic Spawn.

Random origins are selected from the compiled legal-spawn seed set by a deterministic resolver-versioned ordering. For each faction/origin slot, candidate ordering is conceptually:

```text
(
  stableTie32(
    "random-exact-origin",
    spawnResolverVersion,
    matchSeed,
    factionId,
    originSlot,
    cellId
  ),
  factionId,
  originSlot,
  cellId
)
```

All required slots across all factions are resolved as one deterministic simultaneous allocation problem. Faction enumeration order, controller presence, browser timing, and service iteration order cannot create spawn priority.

When a first-ranked random candidate conflicts with an already winning foreign origin under the deterministic resolver order, the slot advances through its ranked legal candidates until one satisfies all required foreign spacing and same-faction distinctness constraints. Validated production maps/rulesets must provide enough legal candidates for every legal lobby/profile configuration.

## 0.4 Fixed Spawn

Fixed Spawn consumes authored exact-origin arrays and does not repair them.

For each faction, the authored origin count must equal the effective profile's `exactOriginCount`:

```text
ordinary profile -> exactly 1 authored origin
P39 profile      -> exactly 2 authored origins
```

A Fixed configuration is invalid when any authored origin:

- is not a legal Initial-Territory seed cell;
- is Impassable, Deep Water, or otherwise spawn-ineligible;
- duplicates another origin slot of the same faction;
- violates the foreign-faction 50-cell spacing rule;
- provides the wrong number of origins for the effective spawn profile.

Fixed Spawn performs **no displacement, fallback, nearest-cell repair, or silent profile downgrade**. Certification/benchmark/scenario fixtures either use the authored cells exactly or fail deterministic configuration validation.

P54 changes the generated footprint shape around those authored origins exactly as it does in every other mode; Fixed Spawn fixes origin locations, not faction mechanics.

---

# 1. Ordinary Strategic influence region

Ordinary Strategic Spawn uses one circular broad influence region with radius **400 raster cells**.

For an influence center `(cx, cy)`, a raster cell `(x, y)` lies inside the ordinary region when:

```text
dx = x - cx
dy = y - cy

dx² + dy² <= 160,000
```

The influence region is a **search space**, not owned territory and not a reservation. Different factions' regions may overlap freely.

The influence center itself does not have to be legal Initial-Territory land. It may be placed offshore or over otherwise spawn-ineligible geography when doing so deliberately positions the legal search area around islands/coasts. The later exact origin must itself be legal.

Influence regions are a Strategic-Spawn concept. Random and Fixed modes do not fabricate influence regions merely to imitate the three-phase protocol.

## 1.1 P39 split Strategic influence area

Under Strategic Spawn, P39 uses two influence regions, each exactly **50% of ordinary area**.

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

Every resolved exact origin in every mode must:

- be a legal Initial-Territory seed cell under the surfaced terrain/map rules;
- not be Impassable, Deep Water, or otherwise explicitly spawn-ineligible;
- satisfy the foreign-origin spacing rule after deterministic simultaneous resolution/validation.

Strategic Spawn additionally requires each exact origin to lie inside that slot's final influence region. Random and Fixed Spawn have no influence-region membership requirement because those modes do not create influence regions.

Different factions' resolved exact origins must be at least **50 cells Euclidean distance** apart:

```text
dx² + dy² >= 2,500
```

P39's two origins belong to the same faction and are therefore exempt from the foreign-faction 50-cell spacing requirement. They must still be two distinct legal origin cells.

This spacing is deliberately much larger than the equivalent radius of an ordinary 1,000-population-bearing-cell compact start. Close/counter-spawning remains strategically meaningful without permitting nearly coincident foreign starting seeds.

---

# 3. Deterministic Strategic exact-origin resolver

Strategic exact origins resolve simultaneously; controller execution order never decides who wins a collision. The V1 resolver algorithm is versioned independently as:

```text
spawnResolverVersion = "1"
```

Random Spawn uses the same bound resolver version and deterministic tie primitive. Fixed Spawn binds the same version for profile/footprint/replay semantics even though authored exact origins are validated rather than displaced.

The match binds that version. Algorithm changes require a new resolver version; ordinary balance-number changes use the appropriate ruleset/catalogue version rather than silently redefining resolver `1`.

## 3.1 Stable deterministic tie primitive

Use one reusable non-cryptographic deterministic 32-bit tie primitive conceptually equivalent to:

```text
stableTie32(domain, spawnResolverVersion, matchSeed, ...canonical keys)
```

It must use fixed 32-bit integer operations with cross-platform deterministic output. It exists only to shuffle otherwise equal candidates; it is not a security hash.

Every ordering also has semantic fallback keys (such as `FactionId`, slot index, `CellId`) after the tie value so a hash collision can never make behavior undefined.

Cryptographic SHA-256 remains appropriate for stored integrity/cell-set hashes; that is a different purpose.

## 3.2 Strategic hook defaults

Missing, malformed, rejected, or runtime-faulting Strategic Spawn hooks use these deterministic defaults:

- **`chooseInfluence()`**: for each required influence slot, choose a deterministic legal spawn-seed cell ranked from the compiled legal-seed set using match seed + faction ID + slot + resolver version. Multi-slot profiles choose distinct fallback centers. Using a legal seed as center guarantees at least one legal origin candidate lies inside the area.
- **`reconsiderInfluence()`**: retain that faction's successfully resolved Phase-1 influence center(s) unchanged.
- **`chooseOrigins()`**: for each required slot, choose the legal origin inside its final influence region nearest to that influence center, using the canonical tie ordering below.

A hook fallback does not by itself fault the controller for normal match play. Successfully committed controller memory from earlier lifecycle callbacks remains available under `CONTROLLER_MEMORY.md`.

## 3.3 Strategic conflict graph and priority

If all requested Strategic exact origins already satisfy legality/spacing, retain them exactly.

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

## 3.4 Strategic nearest in-region fallback

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

## 3.5 Strategic global emergency fallback

If no valid candidate exists inside a final influence region, search the compiled global legal-spawn seed set deterministically, preserving foreign 50-cell spacing where possible and prioritizing candidates nearest that influence center with the same stable tie mechanism.

This is an emergency map/ruleset-defect path, not expected ordinary behavior. It must emit an explicit diagnostic and must never hang/fault the match.

# 4. Initial-Territory footprint resolver

The exact origin is a **seed**, not permission for the controller, Random resolver, or Fixed fixture to hand-paint starting territory.

Ordinary V1 Initial Territory remains **1,000 population-bearing cells** before explicit surfaced modifiers. After all Initial-Territory modifiers are applied, the final value is the target number of population-bearing cells that the generated starting footprint must contain.

All faction footprints in all modes use one deterministic **round-based simultaneous multi-frontier resolver**. Each footprint owns:

```text
originSlot
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

No faction receives a complete 1,000-cell footprint before another faction begins growing. Spawn mode, faction enumeration order, controller execution order, and service iteration order never create starting-territory priority.

## 4.3 Quota semantics

- population-bearing claimed cells consume the Initial-Territory quota;
- legal ownable `0 Capacity` terrain such as ordinary Tundra/Shallow Water may be claimed while traversing/growing and does **not** consume the population-bearing quota;
- Deep Water/Impassable and other non-ownable barriers are never painted merely to preserve a visual shape;
- if one candidate/arm is blocked, the frontier continues elsewhere until the population-bearing quota is filled whenever reachable legal geography exists.

If a footprint exhausts all legal reachable frontier candidates before filling quota, emit `FOOTPRINT_QUOTA_UNFILLABLE`; validated production maps should make this impossible for legal configurations.

## 4.4 P39 split footprints and slot identity

P39 first computes the faction's final modified total Initial Territory, then divides the population-bearing quota approximately equally between the stable primary/secondary slots:

```text
originSlot 0 = PRIMARY
originSlot 1 = SECONDARY
```

An odd one-cell remainder goes to `originSlot 0`.

The two same-faction footprint queues still grow separately under the simultaneous resolver. If both propose the same cell, deterministic footprint-slot ordering decides which queue receives that cell for quota/frontier accounting; politically the cell belongs to the same faction either way. The losing queue continues elsewhere.

Starting Population remains one global pool calculated from the final total Initial Territory. P39 never creates local Population pools.

These footprint/quota semantics are identical in Strategic, Random, and Fixed Spawn. Only the source of the two exact origins changes.

# 5. P54 — star-shaped Initial Territory

P54 is a **spawn-geometry transformation**, not an acquisition-speed stat bonus.

The faction keeps exactly the same final Initial-Territory population-bearing-cell quota it would otherwise receive. Instead of an ordinary approximately circular footprint, each of its starting footprints uses a deliberately thin-bodied, long-armed **five-point star** target geometry centered on the exact origin.

P54 applies after exact-origin resolution in **Strategic, Random, and Fixed Spawn**. Fixed authored origins do not disable or replace the star profile.

## 5.1 Ideal star profile

The ideal profile has:

- **5 outward points**;
- 10 alternating outer/inner vertices at equal angular intervals;
- one outer point aligned to the canonical map north axis, giving one deterministic orientation without adding another spawn-control input;
- accepted **6:1 outer-tip radius to inner-valley radius** intent.

The extreme tip-to-valley ratio is deliberate. At the ordinary roughly 1,000-cell scale, the intent is a small central body with long, thin territorial arms extending much farther from the origin than an equal-area circular start.

At equal idealized area, a five-point `6:1` star has roughly three-and-a-half times the perimeter of the equivalent circle before raster/geography deformation. That additional boundary is the only intended mechanical benefit: more neutral cells can be simultaneously adjacent/actionable under ordinary expansion rules.

P54 therefore does **not** guarantee faster expansion. It merely creates more potential starting contact surface if geography and Population allocation allow the controller to exploit it. Terrain can blunt, bend, or waste individual arms.

## 5.2 Raster/geography construction

P54 uses the same connected simultaneous frontier resolver as ordinary spawning, but replaces the compact radial priority with one canonical versioned **fixed-point five-point-star shape score**.

Resolver version `1` must commit one exact ten-vertex normalized integer/fixed-point star template: five alternating outer/inner vertices, map-north outer-point orientation, and an exact canonical realization of the accepted 6:1 intent. Runtime/platform trigonometry is forbidden for authoritative rasterization.

**#32 remaining geometry closure:** the exact resolver-v1 integer scale, ten `(x,y)` constants, winding convention, and golden template/hash vectors must be frozen before resolver `1` is certified. Until those constants are committed, the descriptive 6:1 geometry is design intent rather than a sufficient independent executable specification.

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

- the effective profile has two exact origins in every spawn mode;
- under Strategic Spawn, P39 additionally provides two half-area influence regions;
- final modified Initial Territory is divided between the two stable footprint slots;
- **each split footprint uses the P54 star geometry**;
- Starting Population remains one global pool.

Thus the combination produces two smaller needle-like starts rather than one star receiving the full quota twice.

---

# 6. Singular start-state grants and spawn immunity

After all Initial-Territory footprints finish and political ownership is established, faction-singular start-state effects resolve once per faction in deterministic stable effect-ID order unless a mechanic explicitly owns another order.

For P20:

```text
requested structure: MISSILE_SILO
requested level:     1
requested cell:      resolved exact origin at originSlot 0
cardinality:         once per faction
```

The request then uses generic structure admission. If generic admission rejects the exact-cell grant, the spawn/territory result is not rolled back and the Spawn subsystem does not search for another Silo cell. P20's trait owner may define only the grant request/result identity; generic placement/admission remains the structure owner's concern.

After singular start-state grants finish resolving and the authoritative spawn snapshot is frozen, every faction receives **5 seconds** of ordinary spawn immunity.

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
RANDOM_ORIGIN_RESOLVED
FIXED_ORIGIN_ACCEPTED
FIXED_CONFIGURATION_INVALID
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
originSlot
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

Every archival replay/spawn snapshot records the common semantic inputs and authoritative outputs:

```text
spawnMode
spawnResolverVersion
effective SpawnProfile per faction

for each origin slot:
  originSlot
  resolvedExactOrigin
  source = STRATEGIC_SUBMISSION | RANDOM_RESOLUTION | FIXED_CONFIGURATION
  resolution/fallback reason where applicable

for each footprint:
  footprintSlot
  population-bearing quota
  shape profile/version
  final resolved starting cell IDs
  cell-set SHA-256

resolved singular start-state effects/grants
```

Strategic Spawn additionally records its actual three-phase semantic inputs/outputs:

```text
Phase-1 submitted/resolved influence centers
Phase-2 submitted/resolved/final revealed influence centers
Phase-3 requested exact origins
```

Random and Fixed modes do **not** fabricate empty/fake Strategic phases. Their replay source metadata records how their real exact origins were obtained.

Final footprint cell IDs are sorted ascending, delta-encoded, and compressed inside the `.ofr.zst` replay. Starting footprints are spatially coherent and only thousands of cells per faction, so this remains small while allowing playback to restore the exact authoritative starting state.

SQLite `match_factions.spawn_snapshot_json` should retain compact semantic/resolution summaries, resolved origin slots, singular-grant summaries, and cell-set hashes; the replay file carries the full footprint cell list.

Determinism tests may independently regenerate the spawn from map + match seed + bound rules/Origins + mode-specific origin inputs + resolver version and compare the regenerated origins, cell sets, grants, and hashes to the authoritative replay record.

---

# 8. Validation expectations

Before V1 release, deterministic/accelerated tests should cover at least:

- dense overlapping Strategic influence regions;
- many Strategic exact-origin collision components;
- coastal/island Strategic influence centers;
- ordinary and P39 Strategic fallback resolution;
- ordinary Random Spawn -> one deterministic origin;
- P39 Random Spawn -> two deterministic distinct same-faction origins;
- Random foreign-origin conflicts resolve deterministically independent of faction/service enumeration order;
- P39 same-faction Random origins may be within 50 cells but may never duplicate;
- Fixed ordinary profiles require exactly one authored legal origin;
- Fixed P39 profiles require exactly two authored legal distinct origins;
- invalid Fixed count, terrain, duplicate-slot, or foreign-spacing fixtures reject deterministically with no repair/fallback;
- exact 1,000-cell and modified Initial-Territory quota fulfillment;
- odd P39 population-bearing quota assigns its remainder to `originSlot 0`;
- Tundra/Shallow-Water inclusion without consuming ordinary quota;
- P54 star footprints against coastlines, narrow land bridges, barriers, and foreign footprint collisions in every spawn mode;
- P39 + P54 interaction in Strategic, Random, and Fixed modes;
- P20 + P39 creates exactly one starting Silo request at `originSlot 0`;
- spawn-time singular effects never multiply merely because a profile has multiple origins;
- Strategic-only AI/controller candidate hooks are never invoked by Random/Fixed Spawn;
- replay regeneration/hash stability of every mode, origin source, footprint, and singular start-state effect.

The exact P54 resolver-v1 integer template and its golden deterministic vectors remain the next #32 geometry closure item and must be added to this list before issue completion.

Retuning radius, pointiness, or spacing after map benchmarks is ordinary versioned balance/geometry iteration. Changing resolver ordering/hash/fallback/rasterization semantics requires an explicit new `spawnResolverVersion`; silent sequential spawn priority or arbitrary controller-painted starting territory is never permitted.
