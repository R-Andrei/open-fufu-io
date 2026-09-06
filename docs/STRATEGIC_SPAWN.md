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

P20 therefore requests exactly one starting Missile Silo grant at `originSlot 0` after Initial-Territory ownership is established. P39 + P20 still requests one Silo, not one per core. Generic structure admission/materialization and persistent-Silo level/charge/readiness lifecycle are owned by `TERRAIN_AND_STRUCTURES.md`; strategic launch transactionality is owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`.

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

For each faction/origin slot, legal-spawn-seed candidates are ranked independently by:

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
  cellId
)
```

All required slots across all factions then resolve through one deterministic **round-based simultaneous allocation**:

1. Every unresolved origin slot advances through its ranked candidate list until it finds the first candidate that is legal against all origins committed in earlier rounds: it must preserve foreign 50-cell spacing and must not duplicate a committed same-faction origin. That candidate becomes the slot's proposal for this round.
2. Sort all proposing slots globally by:

```text
(
  stableTie32(
    "random-origin-priority",
    spawnResolverVersion,
    matchSeed,
    factionId,
    originSlot
  ),
  factionId,
  originSlot
)
```

3. Scan proposals in that priority order into a temporary accepted set. Accept a proposal only when it is compatible with every proposal already accepted this round: foreign proposals must remain at least 50 cells apart, while same-faction P39 proposals need only use distinct `CellId`s.
4. Commit all accepted proposals **simultaneously** at the end of the round.
5. Every rejected proposal advances past that candidate on the next round; every committed slot leaves the unresolved set.
6. Repeat until every required origin slot is committed.

The temporary scan is only a deterministic arbitration rule for simultaneous proposals; it is not service/controller execution order and does not expose intermediate winners to participants. Faction enumeration order, controller presence, browser timing, and service iteration order therefore cannot create spawn priority.

If any unresolved slot exhausts the compiled legal-spawn seed set without a candidate compatible with the already committed result, emit `RANDOM_ORIGIN_ALLOCATION_UNFILLABLE` and reject spawn initialization as a deterministic map/ruleset/lobby configuration failure. Random Spawn never relaxes foreign spacing, duplicates a same-faction origin, or silently drops an origin slot to force initialization to continue.

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

### 0.4.1 Fixed Spawn service/configuration input contract

Fixed Spawn is configured by the match/service fixture layer, not by Controller API callbacks. Its minimum canonical semantic shape is:

```ts
interface FixedSpawnFactionInput {
  readonly factionId: FactionId;
  readonly origins: readonly CellId[];
}

interface FixedSpawnConfiguration {
  readonly factions: readonly FixedSpawnFactionInput[];
}
```

The concrete service serialization may use an equivalent schema, but it must preserve these semantics exactly:

- there is exactly one `FixedSpawnFactionInput` for every participating faction and no entry for a non-participant;
- `origins.length` must equal that faction's already-resolved effective `SpawnProfile.exactOriginCount`;
- **array index is canonical `originSlot` identity** and must survive unchanged into the resolved spawn result;
- therefore ordinary profiles use `origins[0] = PRIMARY`, while P39 uses `origins[0] = PRIMARY` and `origins[1] = SECONDARY`;
- the fixture/service must never geographically sort, relabel, normalize, or otherwise infer slot identity from the authored cells;
- all faction entries and origin slots are validated as **one atomic configuration** after effective profiles are known, including seed legality, same-faction distinctness, and foreign-faction spacing across the complete authored set;
- if any entry/slot is invalid, the entire Fixed configuration is rejected before any faction receives Initial Territory or start-state effects;
- validation performs no per-slot fallback, displacement, substitution, defaulting, or partial acceptance;
- after successful validation, the authored cells become the resolved exact origins with replay source `FIXED_CONFIGURATION` and enter the ordinary mode-independent footprint/start-state pipeline unchanged.

This contract is service/configuration input only. It does not add Fixed-Spawn selection callbacks to `ControllerApi.ts` and does not allow the service layer to redefine SpawnProfile, footprint, P39 slot, P20 grant, or P54 geometry semantics.

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

## 3.1 `stableTie32` — resolver-v1 exact tie primitive

Resolver version `1` binds one exact non-cryptographic 32-bit tie primitive:

```text
stableTie32Id = "FNV1A32_LENPREFIX_V1"
```

`stableTie32(domain, spawnResolverVersion, matchSeed, ...canonicalKeys)` accepts only canonical strings and exact integers. Each argument, including `domain`, version, and seed, is converted to a payload as follows:

- a string payload is its exact UTF-8 byte sequence; no Unicode normalization/case folding is performed;
- an integer payload is base-10 ASCII with no leading `+` or leading zeroes (`0` is exactly `"0"`; negative values use one leading `-`);
- floating-point/non-integer numeric keys are forbidden.

Each payload is serialized as:

```text
uint32LE(payloadByteLength) || payloadBytes
```

The complete hash input is the concatenation of those encoded fields in call order. No separators, terminators, implicit locale formatting, or host-language object serialization are added.

The hash itself is canonical FNV-1a 32-bit:

```text
h = 2166136261  // 0x811C9DC5
for each input byte b in order:
    h = h XOR b
    h = (h * 16777619) mod 2^32  // 0x01000193
return h as unsigned uint32
```

Implementations must use exact low-32-bit multiplication semantics (`Math.imul` + `>>> 0` is suitable in TypeScript); ordinary IEEE-754 multiplication followed by ad-hoc rounding is not the contract.

### Canonical resolver tuple ordering

All resolver tuples in this document are compared lexicographically, field by field, using one resolver-v1 comparator:

- integer fields sort by ascending exact numerical value;
- string fields sort by ascending lexicographic order of their raw UTF-8 byte sequences, comparing bytes as unsigned `0..255`;
- when one string's UTF-8 byte sequence is an exact prefix of the other, the shorter sequence sorts first;
- no locale-aware comparison, Unicode normalization, case folding, or host-language default string collation is permitted.

The same string rule applies to `FactionId`, stable effect IDs, and any future string-valued deterministic fallback key used by resolver-v1. Canonical `stableTie32` collisions are therefore harmless because every resolver ordering appends semantic fallback keys such as `FactionId`, slot index, or `CellId` after the tie value, and those fallback keys now have an exact cross-platform comparison rule.

### Resolver-v1 `stableTie32` golden vectors

These values use match seed `seed-0001` and are normative:

| Call | Expected uint32 | Hex |
| --- | ---: | --- |
| `stableTie32("exact-origin-priority", "1", "seed-0001", "F-A", 0)` | `753298903` | `0x2CE66DD7` |
| `stableTie32("exact-origin-priority", "1", "seed-0001", "F-A", 1)` | `736521284` | `0x2BE66C44` |
| `stableTie32("random-origin-priority", "1", "seed-0001", "F-A", 0)` | `3352854808` | `0xC7D88118` |
| `stableTie32("random-exact-origin", "1", "seed-0001", "F-A", 0, 12345)` | `887248552` | `0x34E256A8` |
| `stableTie32("exact-origin-cell", "1", "seed-0001", "F-A", 1, 12345)` | `88442828` | `0x054587CC` |
| `stableTie32("exact-origin-global-cell", "1", "seed-0001", "F-A", 1, 12345)` | `2434573459` | `0x911CA493` |
| `stableTie32("default-influence-center", "1", "seed-0001", "F-A", 0, 12345)` | `1179902534` | `0x4653E246` |
| `stableTie32("spawn-footprint-cell", "1", "seed-0001", 12345, "F-A", 0)` | `1594207403` | `0x5F05ACAB` |
| `stableTie32("spawn-star-cell", "1", "seed-0001", "F-A", 0, 12345)` | `1777288741` | `0x69EF4625` |
| `stableTie32("spawn-compact-cell", "1", "seed-0001", "F-A", 0, 12345)` | `786146991` | `0x2EDBA6AF` |

For the first vector, the canonical serialized input bytes are:

```text
1500000065786163742d6f726967696e2d7072696f72697479
0100000031
09000000736565642d30303031
03000000462d41
0100000030
```

Changing field canonicalization, length endianness, FNV constants/order, unsigned overflow behavior, tuple comparison, or any tie domain used by resolver-v1 requires a new `spawnResolverVersion`; it must not silently redefine version `1`.

Cryptographic SHA-256 remains appropriate for stored integrity/cell-set hashes; that is a different purpose.

## 3.2 Strategic hook defaults

Missing, structurally malformed, or runtime-faulting Strategic Spawn hooks use these deterministic defaults:

- **`chooseInfluence()`**: for each required influence slot, rank the compiled legal-spawn seed set by `(stableTie32("default-influence-center", version, matchSeed, factionId, influenceSlot, cellId), cellId)` and choose the first candidate not already used by an earlier slot of that same faction; fallback slots are processed in ascending `influenceSlot` only for this within-faction default selection. Using a legal seed as center guarantees at least one legal origin candidate lies inside the area.
- **`reconsiderInfluence()`**: retain that faction's successfully resolved Phase-1 influence center(s) unchanged.
- **`chooseOrigins()`**: for each required slot, choose the legal origin inside its final influence region nearest to that influence center, using the canonical tie ordering below.

For `chooseOrigins()`, **whole-hook defaulting is structural, not a penalty for requesting a mechanically illegal location**. The whole callback result defaults only when it is missing/faulted or cannot be interpreted as the required Phase-3 decision, including wrong origin count, non-integer cell identifiers, identifiers that do not name a real map cell, or another malformed return shape. Once the callback supplies the required number of real map `CellId`s, those cells are the faction's requested origins even when one or more are outside influence, spawn-ineligible, same-faction duplicates, or later lose foreign-spacing arbitration. Those semantic placement failures are repaired per slot by Sections 3.3–3.5; they do not discard otherwise usable sibling-slot requests.

`SpawnOriginApi.isValidOriginChoice()` and `validateOriginChoices()` are therefore **local preflight helpers**. They report whether a prospective choice/set would pass local Phase-3 placement rules without authoritative resolver repair. A locally invalid result for `OUTSIDE_INFLUENCE`, `SPAWN_INELIGIBLE`, or `DUPLICATE_ORIGIN` does not mean a structurally valid `chooseOrigins()` callback result will be thrown away. Foreign spacing remains unknowable to those helpers until simultaneous resolution.

A hook fallback does not by itself fault the controller for normal match play. Successfully committed controller memory from earlier lifecycle callbacks remains available under `CONTROLLER_MEMORY.md`.

## 3.3 Strategic global priority resolution

A structurally malformed Phase-3 decision uses the deterministic `chooseOrigins()` whole-hook default defined in Section 3.2. A correctly shaped Phase-3 decision containing the required number of real map `CellId`s is instead preserved as the faction's requested slot set and enters the authoritative resolver even when local placement validation would report a semantic failure.

The resulting requested origin slots resolve together with every other faction through one **global** priority order:

```text
(
  stableTie32("exact-origin-priority", version, matchSeed, factionId, originSlot),
  factionId,
  originSlot
)
```

Process all requested slots in that canonical order. For each slot:

1. retain its requested cell exactly when the cell is a valid legal Initial-Territory seed inside that slot's final influence region, remains at least 50 cells from every already resolved foreign-faction origin, and does not duplicate an already resolved origin slot of the same faction;
2. otherwise resolve that slot through the Section 3.4 nearest-in-region fallback before proceeding to the next slot.

Therefore P39 same-faction origins have **no 50-cell spacing constraint against each other**, but two P39 slots requesting the exact same cell are not ambiguous: whichever slot comes first in the seeded global priority keeps that requested cell and the later slot deterministically falls back to another distinct cell. Likewise, if only one P39 slot requests an outside-influence or spawn-ineligible real map cell, the other locally legal sibling request remains intact rather than being replaced by a whole-hook default.

Connected conflict components may be used internally as an optimization/diagnostic aid only when they are proven to produce the exact same final result as this global priority scan. Component discovery or iteration order is **not** a resolver-v1 semantic input.

Because priority is bound to match seed + faction/slot identity rather than submission arrival or service enumeration, browser/controller timing and implementation iteration order cannot decide who retains a conflicting requested origin.

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
4. not duplicate an already resolved origin slot of the same faction.

Because the ordinary influence radius is only 400 cells, exhaustive bounded scanning is preferred over a more complex spatial structure unless profiling later proves it necessary.

A well-formed requested cell that is outside its influence region, spawn-ineligible, foreign-spacing-conflicting, or a same-faction exact duplicate is displaced through this same fallback path; those cases do not acquire separate unspecified repair rules.

## 3.5 Strategic global emergency fallback

If no valid candidate exists inside a final influence region, search the compiled global legal-spawn seed set using:

```text
(
  squaredEuclideanDistanceFromFinalInfluenceCenter,
  stableTie32("exact-origin-global-cell", version, matchSeed, factionId, originSlot, cellId),
  cellId
)
```

The chosen global candidate must still preserve foreign 50-cell spacing and same-faction exact distinctness against every already resolved origin. This is an emergency map/ruleset-defect path, not expected ordinary behavior, and it emits `ORIGIN_GLOBAL_FALLBACK` when used.

If even the global legal-seed set contains no candidate satisfying those invariants, emit `ORIGIN_GLOBAL_UNFILLABLE` and reject spawn initialization deterministically as a map/ruleset/lobby configuration failure. Resolver-v1 never silently relaxes foreign spacing or duplicates an origin slot merely to force the match to start.

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
- multiple proposals, whether from foreign factions or from two footprints of the same P39 faction: winner is selected by the same deterministic tuple

```text
(
  stableTie32("spawn-footprint-cell", version, matchSeed, cellId, factionId, footprintSlot),
  factionId,
  footprintSlot
)
```

For a foreign contest, only the winning faction claims the cell. For a same-faction P39 contest, political ownership is already the same faction; only the winning footprint receives that cell for its own quota/frontier accounting, while the losing footprint continues elsewhere. The seeded tie prevents PRIMARY/slot `0` from gaining an additional automatic geometry advantage merely because of its slot number.

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

The two same-faction footprint queues still grow separately under the simultaneous resolver. When both propose the same cell, the exact Section 4.2 `spawn-footprint-cell` tuple decides which footprint receives quota/frontier accounting; politically the cell belongs to the same faction either way. The losing queue continues elsewhere.

Starting Population remains one global pool calculated from the final total Initial Territory. P39 never creates local Population pools.

These footprint/quota semantics are identical in Strategic, Random, and Fixed Spawn. Only the source of the two exact origins changes.

# 5. P54 — star-shaped Initial Territory

P54 is a **spawn-geometry transformation**, not an acquisition-speed stat bonus.

The faction keeps exactly the same final Initial-Territory population-bearing-cell quota it would otherwise receive. Each generated footprint uses a deliberately thin-bodied, long-armed five-point-star **priority field** centered on the exact origin instead of the ordinary compact radial priority.

P54 applies after exact-origin resolution in **Strategic, Random, and Fixed Spawn**. Fixed authored origins do not disable or replace the star profile.

The ideal star is a target preference field, **not a guaranteed final polygon and not an eligibility mask**. The authoritative footprint is always the connected cell-by-cell result of the Section 4 frontier resolver against real terrain, topology, competing footprints, and the final quota.

## 5.1 Resolver-v1 canonical star template

Resolver version `1` binds the immutable shape identity:

```text
shapeTemplateId = "P54_STAR_V1"
fixedPointUnit  = 4096  // Q12-style integer template unit
+x              = map east
+y              = map north
winding         = clockwise
vertex 0        = north-facing outer tip
```

The ten authoritative integer vertices are:

| Vertex | Role | x | y |
| ---: | --- | ---: | ---: |
| `v0` | outer | `0` | `24576` |
| `v1` | inner | `2408` | `3314` |
| `v2` | outer | `23373` | `7594` |
| `v3` | inner | `3896` | `-1266` |
| `v4` | outer | `14445` | `-19882` |
| `v5` | inner | `0` | `-4096` |
| `v6` | outer | `-14445` | `-19882` |
| `v7` | inner | `-3896` | `-1266` |
| `v8` | outer | `-23373` | `7594` |
| `v9` | inner | `-2408` | `3314` |

They were selected from the accepted regular alternating-ray `6:1` outer/inner design at Q12 precision. **The integer table above is authoritative**; implementations must not regenerate it with runtime/platform trigonometry, and the prose ratio is no longer a source from which different implementations may derive alternate rounded vertices.

The canonical UTF-8 template serialization contains no trailing newline:

```text
P54_STAR_V1|q=4096|winding=CW|axis=+X_EAST,+Y_NORTH|v=0,24576;2408,3314;23373,7594;3896,-1266;14445,-19882;0,-4096;-14445,-19882;-3896,-1266;-23373,7594;-2408,3314
```

Its SHA-256 is:

```text
52318cc016a674164fc4861468e29b24b177b8fc35287337a55a11d1b6773440
```

Changing any template integer, orientation, winding convention, shape-score rule, or authoritative serialization requires a new `spawnResolverVersion`; it must not silently redefine resolver `1`.

## 5.2 Exact star-shape score

Let the candidate cell offset from its exact origin be:

```text
p = (dx, dy)
```

Define the integer cross product:

```text
cross((ax, ay), (bx, by)) = ax * by - ay * bx
```

For `p = (0, 0)`, define the star score as the exact rational `0/1`.

For every other offset, find the **lowest edge index** `i` in `0..9` for which, with:

```text
a = v[i]
b = v[(i + 1) mod 10]
```

the clockwise radial-sector test is true:

```text
cross(a, p) <= 0
cross(p, b) <= 0
```

Every nonzero direction belongs to exactly one sector except a vertex ray, which belongs to its two adjacent sectors. The lowest matching edge index is canonical; in particular the `v0` ray chooses edge `0` rather than edge `9`.

Then compute:

```text
N = -(cross(p, b) + cross(a, p))
D = -cross(a, b)
```

For the canonical clockwise template, `N >= 0` and `D > 0`. The exact shape score is the rational:

```text
starScaleScore(p) = N / D
```

Geometrically this is the minimum uniform scale of the canonical ideal star at which the candidate offset lies on/inside the corresponding star edge. Only the ordering matters; quota determines how large the realized footprint ultimately becomes.

Two scores `N1/D1` and `N2/D2` are compared **exactly** by integer cross multiplication:

```text
N1 * D2  <=>  N2 * D1
```

The authoritative comparison must not first round/quantize the ratio or convert it to an approximate floating-point score. An implementation may use fixed-width integer arithmetic only when validated map-coordinate bounds prove every intermediate product cannot overflow that representation; otherwise it must use a sufficiently wide/arbitrary-precision integer representation.

P54 candidate ordering is therefore:

```text
(
  exactRationalStarScaleScore,
  stableTie32("spawn-star-cell", version, matchSeed, factionId, footprintSlot, cellId),
  cellId
)
```

### Resolver-v1 golden shape vectors

These raw vectors are part of the executable geometry specification. `edge` is the canonical selected edge; `N/D` is the unreduced exact score pair.

| Offset `p` | edge | `N` | `D` |
| --- | ---: | ---: | ---: |
| `(0, 0)` | — | `0` | `1` |
| `(0, 1)` | `0` | `2408` | `59179008` |
| `(1, -1)` | `3` | `8067` | `59172902` |
| `(1, 0)` | `2` | `8860` | `59176442` |
| `(0, -1)` | `4` | `14445` | `59166720` |
| `(1, 1)` | `1` | `16685` | `59171770` |
| `(-1, 0)` | `7` | `8860` | `59176442` |
| `(-1, 1)` | `8` | `16685` | `59171770` |
| `v0 = (0, 24576)` | `0` | `59179008` | `59179008` |
| `v1 = (2408, 3314)` | `0` | `59179008` | `59179008` |
| `v5 = (0, -4096)` | `4` | `59166720` | `59166720` |

These vectors also imply, by exact rational comparison:

```text
score(0,1)
< score(1,-1)
< score(1,0)
< score(0,-1)
< score(1,1)
< score(v0) = score(v1) = score(v5) = 1
```

An implementation that disagrees with the template SHA or any golden vector is not resolver-v1 compatible.

## 5.3 Runtime cell-by-cell construction and deformation

P54 uses the same connected simultaneous frontier resolver as ordinary spawning. The star score changes **which legal frontier cell is preferred next**; it does not pre-rasterize a fixed polygon and it does not reserve a finite set of star cells.

There is no maximum permitted star scale and no hard `inside/outside star` eligibility boundary. Every otherwise legal reachable frontier cell has a score. Therefore:

- on unobstructed geography, low-score cells naturally grow toward the canonical star;
- if an arm reaches Deep Water, Impassable terrain, a coastline, or another unavailable topology, that arm simply stops producing legal frontier candidates there;
- the remaining frontier continues into progressively higher-score legal cells elsewhere until the required population-bearing quota is filled;
- the result may be visibly asymmetric or substantially deformed when geography removes much of the ideal star;
- P54 never reduces the faction's quota merely because the ideal target shape cannot be realized exactly;
- disconnected painting/teleporting is never permitted to rescue a blocked arm.

The candidate must remain cardinally adjacent to the already claimed footprint. The ordinary quota and simultaneous-collision rules remain unchanged:

- population-bearing cells consume quota;
- naturally included ownable `0 Capacity` cells do not consume quota;
- barriers/topology may deform individual arms;
- simultaneous foreign-faction cell collisions use the Section 4 resolver.

Thus the ten-vertex template answers **what shape the resolver prefers**; the frontier algorithm answers **what legal starting territory is actually constructed on this map**.

P54 changes only generated starting-footprint geometry. It does not alter:

- final Initial Territory;
- Starting Population;
- Population Capacity per cell;
- ordinary capture/settlement progress coefficients;
- neutral-settlement Population cost;
- later territorial growth shape.

Its advantage comes from the ordinary combat/acquisition system seeing the longer/differently distributed boundary that the realized starting footprint actually produced.

## 5.4 P54 + P39

P39 and P54 are ordinary legal catalogue traits and combine without a compatibility exception.

When both are selected:

- the effective profile has two exact origins in every spawn mode;
- under Strategic Spawn, P39 additionally provides two half-area influence regions;
- final modified Initial Territory is divided between the two stable footprint slots;
- **each split footprint uses the same `P54_STAR_V1` priority field independently around its own origin**;
- Starting Population remains one global pool.

Thus the combination produces two independently deformable star-biased starts rather than one star receiving the full quota twice.

---

# 6. Singular start-state grants and spawn immunity

After all Initial-Territory footprints finish and political ownership is established, faction-singular start-state effects resolve once per faction in deterministic stable effect-ID order under the Section 3.1 canonical resolver tuple/string comparator unless a mechanic explicitly owns another order.

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
ORIGIN_GLOBAL_UNFILLABLE
RANDOM_ORIGIN_RESOLVED
RANDOM_ORIGIN_ALLOCATION_UNFILLABLE
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
stableTie32Id = FNV1A32_LENPREFIX_V1
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
  P54 shapeTemplateId + template SHA-256 when shape = STAR
  final resolved starting cell IDs
  cell-set SHA-256

resolved singular start-state effects/grants
```

For resolver-v1 P54, the bound shape metadata is exactly:

```text
shapeTemplateId     = P54_STAR_V1
shapeTemplateSha256 = 52318cc016a674164fc4861468e29b24b177b8fc35287337a55a11d1b6773440
```

Strategic Spawn additionally records its actual three-phase semantic inputs/outputs:

```text
Phase-1 submitted/resolved influence centers
Phase-2 submitted/resolved/final revealed influence centers
Phase-3 requested exact origins
```

Random and Fixed modes do **not** fabricate empty/fake Strategic phases. Their replay source metadata records how their real exact origins were obtained.

Final footprint cell IDs are sorted ascending, delta-encoded, and compressed inside the `.ofr.zst` replay. Starting footprints are spatially coherent and only thousands of cells per faction, so this remains small while allowing playback to restore the exact authoritative starting state.

SQLite `match_factions.spawn_snapshot_json` should retain compact semantic/resolution summaries, resolved origin slots, singular-grant summaries, shape-template identity/hash, and cell-set hashes; the replay file carries the full footprint cell list.

Determinism tests may independently regenerate the spawn from map + match seed + bound rules/Origins + mode-specific origin inputs + resolver version and compare the regenerated origins, shape-template identity, cell sets, grants, and hashes to the authoritative replay record.

---

# 8. Validation expectations

Before V1 release, deterministic/accelerated tests should cover at least:

- every Section 3.1 `stableTie32` golden vector reproduces the exact unsigned uint32 result, and the first vector reproduces the exact canonical serialized bytes;
- `stableTie32` field-length endianness, integer canonicalization, UTF-8 handling, and low-32-bit multiplication semantics are identical across TypeScript/server/replay-verifier implementations;
- forced-equal primary tie values exercise the Section 3.1 fallback comparator: ASCII ordering (`"A" < "B"`), prefix ordering (`"F" < "F-A"`), unsigned UTF-8 byte ordering (including a non-ASCII string), and numeric slot ordering (`0 < 1`) must reproduce identically across implementations without locale/default string comparison;
- deterministic multi-slot `chooseInfluence()` fallback reproduces `default-influence-center` ordering and distinct within-faction fallback centers independent of service iteration order;
- dense overlapping Strategic influence regions;
- a missing/runtime-faulting or structurally malformed `chooseOrigins()` result (including wrong count, non-integer/non-map CellId, or malformed return shape) uses the whole-hook deterministic default;
- a correctly shaped `chooseOrigins()` result containing real map CellIds is preserved as the requested slot set even when local preflight reports outside-influence, spawn-ineligible, or duplicate-own-slot placement; only the affected slots are repaired through authoritative resolution;
- a P39 request with one locally legal slot and one semantic-placement-invalid real map cell preserves the legal sibling request rather than replacing the entire faction decision;
- many Strategic exact-origin conflicts resolved identically regardless of faction/component/service enumeration order;
- P39 Strategic same-faction duplicate requests deterministically retain one requested cell and displace the other through ordinary fallback without imposing own-faction 50-cell spacing;
- a Strategic fallback from an earlier global-priority slot cannot make component iteration order change a later slot's result;
- coastal/island Strategic influence centers;
- ordinary and P39 Strategic fallback resolution;
- deterministic `ORIGIN_GLOBAL_UNFILLABLE` failure when no globally legal candidate preserves required invariants;
- ordinary Random Spawn -> one deterministic origin;
- P39 Random Spawn -> two deterministic distinct same-faction origins;
- Random foreign-origin conflicts resolve through the exact round/global-priority algorithm independent of faction/service enumeration order;
- Random same-faction P39 proposals may be within 50 cells but may never share the exact same `CellId`;
- Random loser slots advance deterministically across rounds without exposing intermediate arbitration to controllers;
- deterministic `RANDOM_ORIGIN_ALLOCATION_UNFILLABLE` failure when a required slot exhausts the legal seed set;
- Fixed ordinary profiles require exactly one authored legal origin;
- Fixed P39 profiles require exactly two authored legal distinct origins;
- Fixed P39 preserves authored `origins[]` order as canonical origin-slot identity end-to-end; swapping the two authored cells swaps PRIMARY/SECONDARY semantics rather than geographically re-sorting them, including odd-quota remainder and P20 slot-0 placement;
- Fixed whole-configuration validation is atomic across every participating faction; one invalid faction/slot rejects the entire fixture with no partial spawn state;
- invalid Fixed count, terrain, duplicate-slot, or foreign-spacing fixtures reject deterministically with no repair/fallback;
- exact 1,000-cell and modified Initial-Territory quota fulfillment;
- odd P39 population-bearing quota assigns its remainder to `originSlot 0`;
- repeated same-faction P39 footprint collisions use the exact `spawn-footprint-cell` tuple and reproduce identical per-footprint quota/frontier accounting across reruns;
- Tundra/Shallow-Water inclusion without consuming ordinary quota;
- `P54_STAR_V1` canonical serialization hashes to `52318cc016a674164fc4861468e29b24b177b8fc35287337a55a11d1b6773440`;
- every Section 5.2 golden offset reproduces the exact edge/`N`/`D` vector and exact ordering;
- an unobstructed P54 fixture produces a connected star-biased footprint and fills the exact quota;
- coastline/Deep-Water obstruction removes unavailable arm growth but reallocates the full reachable quota into higher-score legal frontier cells elsewhere;
- narrow-land-bridge/Impassable fixtures never teleport/disconnect cells merely to preserve the ideal star;
- foreign footprint collisions deform P54 through the ordinary simultaneous resolver rather than execution order;
- P54 identical map/profile/exact-origin inputs produce identical realized footprint/cell-set hash regardless of whether the origin source was Strategic, Random, or Fixed;
- P39 + P54 resolves two independent `P54_STAR_V1` fields in Strategic, Random, and Fixed modes;
- modified P54 quota (for example P01) changes only how far the priority field is consumed, not the template itself;
- P20 + P39 creates exactly one starting Silo request at `originSlot 0`;
- spawn-time singular effects never multiply merely because a profile has multiple origins;
- Strategic-only AI/controller candidate hooks are never invoked by Random/Fixed Spawn;
- replay regeneration/hash stability of every mode, origin source, bound resolver/tie/template identity, realized footprint, and singular start-state effect.

Full realized cell-set golden hashes belong to the executable Spawn implementation/certification fixtures because they additionally depend on a concrete canonical map/`CellId` fixture and the executable resolver harness. Resolver-v1's tie primitive, origin arbitration, footprint arbitration, star geometry, and ordering rules are now exact and independently reproducible; runtime certification must publish and lock representative fixture cell-set hashes when that resolver is implemented.

Retuning radius, pointiness, or spacing after map benchmarks is ordinary versioned balance/geometry iteration. Changing resolver ordering/hash/fallback/rasterization semantics requires an explicit new `spawnResolverVersion`; silent sequential spawn priority or arbitrary controller-painted starting territory is never permitted.