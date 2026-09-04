# Open Fufu — Canonical Design Contract

## Status

This document is the **single canonical Open Fufu target-design contract and game-design source of truth**.

It defines **what Open Fufu is intended to be**. The separate [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) defines how the inherited OpenFront codebase should be migrated to this target.

Concrete accepted provisional terrain, persistent-structure, and Factory-produced land-unit values are maintained in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) as the canonical data appendix to this contract.

Historical or superseded proposals do not override this contract. Future accepted Open Fufu design changes must update this document rather than creating competing mechanics documents.

Where this document distinguishes between **design rules**, **provisional tuning values**, **implementation choices**, **audit-dependent inherited behavior**, and **deliberately deferred systems**, those distinctions are intentional.

---

## 1. Product identity

Open Fufu is a browser-viewable territorial strategy game/autobattler in which the player **programs the battler**.

The player does not normally issue moment-to-moment commands during a match. Before the match the player selects:

- an immutable version of their faction controller;
- one immutable **Origin**, official or custom;
- a PvE **Echo** loadout where applicable;
- the lobby/game configuration.

Once the match begins, the controller governs the faction.

The controller is expected to reason about systems such as:

- neutral expansion;
- enemy target selection;
- offensive Population commitments;
- attack concentration, frontage, and geometry;
- passive defensive priorities;
- active counter-responses;
- retreat and deliberate territorial abandonment;
- economy;
- construction and upgrades;
- unit and naval operations;
- threat assessment;
- fixed-team/FFA relationships;
- persistent in-match strategic memory.

The game should reward **programming and strategy**, not manual reaction speed.

Open Fufu is primarily designed around PvE, with PvP as a separate optional mode.

Normal matches should remain understandable as territorial strategy rather than becoming a pure optimization benchmark detached from geography.

### 1.1 Low floor, high ceiling

The programming surface must support both:

- a **low entry floor**, where an ordinary player can modify a simple working controller without learning computational geometry or manipulating thousands of cells directly; and
- a **high skill ceiling**, where advanced players can reason directly about cells, Segments, Contacts, frontage, statistics, optimization, weighting, and custom abstractions.

The engine should expose low-level strategy-neutral primitives while still allowing useful higher-level geographic queries. Segments, Contacts, ordinary query/select/filter primitives, spatial weights, documentation, examples, and the starter controller should make sensible behavior approachable without granting privileged strategic powers.

### 1.2 Transparent mechanics

Open Fufu should strongly prefer explicit, surfaced mechanics over hidden modifiers and corrective special cases.

If a modifier materially affects Population growth, combat, trade, structure behavior, spawning, or another strategic quantity, it should normally come from a visible rule-bearing source such as terrain, a structure, an Origin trait, an Echo, a ruleset value, or another explicit mechanic.

Do not quietly grant hidden reserve bonuses, hidden large/small-faction bonuses, invisible AI cheats, or similar behavior merely to steer outcomes.

### 1.3 Three complementary power-expression axes

Open Fufu intentionally separates three different ways a player expresses power and strategy:

```text
Controller
= how the faction thinks and decides

Origin
= what kind of faction it fundamentally is

Echoes
= collectible generated-name modifiers used to specialize the build
```

Origins and Echoes must not become substitutes for controller quality. The controller remains the primary strategic/intelligence layer.

### 1.4 Match-duration target

A broad range of roughly **15 minutes to 2 hours** is acceptable, with ordinary games preferably finishing in under an hour. Exact pacing is balance work rather than a hard design constant.

---

## 2. Relationship to OpenFront and Foof

Open Fufu is a fork of OpenFront and may reuse substantial inherited infrastructure, but OpenFront is a technical starting point rather than a ruleset or architecture that Open Fufu must preserve.

Useful inherited systems should be retained where they fit the target design. Existing behavior is not authoritative merely because it already exists.

Open Fufu remains a separate game/service from `foof-bot`.

Conceptually:

```text
Discord
   |
   v
Foof
   |
   | game-facing API
   v
Open Fufu service
   |- authoritative simulation
   |- controller execution
   |- official PvE AI
   |- controller versions
   |- Origins / Echoes / progression
   |- matches / replays / logs
   `- browser viewer/editor/debugger
```

Foof may own Discord-facing commands, identity handoff, lobby/match initiation, controller/Origin/Echo-loadout selection where useful, links into browser surfaces, and result/reward presentation.

Foof must not:

- import simulation internals as its own game logic;
- execute player controller code;
- manipulate Open Fufu persistence directly as a substitute for the game API.

Open Fufu should remain independently coherent if Foof is absent.

### 2.1 Licensing and attribution

The fork must preserve applicable OpenFront licensing and attribution obligations. Inherited proprietary assets must not be assumed usable merely because they exist in the fork; the integration plan owns the replacement/removal work.

---

## 3. Authoritative simulation architecture

Open Fufu requires a **single canonical authoritative simulation for each match running on the server/Fufubox**.

A browser must not be required for the match to progress.

The architecture must support:

- unattended matches;
- headless simulations;
- accelerated simulations;
- controller certification/testing;
- tournaments/batch runs;
- deterministic replay/analysis;
- browser disconnects without match interruption.

The browser is primarily a viewer/editor/debugging surface, not the authority for world state.

Player controller code is untrusted and must execute behind an isolation boundary. Official PvE AI may be trusted operational code but does not receive gameplay-information privileges.

Exact process topology, protocol, persistence, and sandbox technology are integration architecture and are specified in the integration plan rather than this design contract.

---

## 4. Determinism, versioning, and replayability

Historical matches must remain reproducible.

A match must bind every rule-bearing input needed to define what that match meant, including identities equivalent to:

- match seed;
- map identity/version/hash;
- Segment/map-generation version where relevant;
- simulation ruleset version;
- controller runtime/API version;
- exact immutable player-controller versions;
- exact official PvE AI preset versions;
- exact Origin definition/version for every faction;
- Origin-trait catalogue/version where relevant;
- equipped Echo identity IDs plus the exact retained magnitude configuration used by each faction;
- Echo mechanical identity-catalogue version, Echo naming/presentation version where historical wording/presentation requires it, and acquisition/roll-rules version where relevant;
- spawn-mode/configuration and spawn-resolution version where relevant;
- any other versioned data that materially changes deterministic simulation.

Changing a combat formula, controller API, AI preset, Origin trait, Echo identity catalogue, Echo acquisition/roll rule, spawn resolver, or map later must not silently change historical matches.

### 4.1 Minimal archival replay — Accepted V1

The canonical archival replay is a **minimal deterministic simulation-input/action record**, not a periodic dump of the 4.8-million-cell world state.

A replay binds the exact versioned match inputs above plus the authoritative Strategic Spawn record and the accepted simulation-affecting game-facing input stream in deterministic tick/order form. Playback re-runs the deterministic simulation from the beginning using those committed inputs; it does **not** need to re-execute player controller code or reconstruct private controller thought state.

The archival replay does not contain periodic full-state seek checkpoints. V1 seeking/late-position playback fast-forwards the deterministic simulation from match start, optionally without rendering intermediate frames. This keeps replay storage minimal; V1 does not trade large checkpoint storage for instant arbitrary seeking.

The canonical replay should not archive controller-memory snapshots, controller debug overlays, verbose controller logs, rejected no-effect proposals, browser render frames, or redundant per-tick copies of derived simulation state. Detailed controller diagnostics remain a separate short-retention debugging artifact. Post-match metadata/results remain in SQLite even after an ordinary replay file expires.

Strategic Spawn stores its small semantic submissions/resolved outputs plus the final resolved starting footprint representation required by `STRATEGIC_SPAWN.md`. During normal play, only committed simulation-affecting inputs need to drive archival replay. Deterministic integrity hashes may be recorded cheaply for validation without turning the replay into state snapshots.

Replay files remain compressed external artifacts (`.ofr.zst`) rather than SQLite BLOBs. Ordinary replay retention is 90 days; pinned/benchmark replays may be retained indefinitely as specified by the persistence contract.

---

## 5. Controller language and authoring model

### 5.1 V1 language

The V1 controller language is **TypeScript**, with ordinary JavaScript-style code naturally usable.

### 5.2 Controller presets and immutable versions

Players may maintain multiple controller presets/strategies. Drafts may be edited repeatedly. Published controller versions are immutable. A match binds the exact published controller version selected at match start.

### 5.3 Primitive-oriented API philosophy

The controller API should expose **small, composable, strategy-neutral primitives**.

The engine should not provide privileged strategic policies such as `blitzkrieg()`, `turtle()`, `weakestPointPolicy()`, or `threatWeightedStrategy()`.

The conceptual read surface includes areas such as:

```text
game
me
factions
cells
segments
contacts
operations
structures
units
navigation
economy
rules / mechanics
events / lastDecision
random / limits
```

The conceptual write/action surface includes low-level legal operations such as:

- creating/changing/ending offensive Population commitments;
- specifying offensive spatial intent/weighting;
- specifying passive defensive cell priorities/weights;
- creating/changing/ending active counter-responses;
- neutral expansion intent;
- deliberate territory relinquishment/retreat;
- construction;
- upgrades;
- unit creation;
- unit movement/targeting;
- naval/amphibious operations;
- strategic weapon use;
- bounded team signals where applicable;
- surrender/capitulation where applicable.

There is **no controller primitive for manually allocating passive defensive Population quantities across owned cells**. Passive defense quantity is automatic; the controller may only influence which threatened cells receive scarce automatic defenders through strategy-neutral priorities/weights.

The public controller contract must not expose mutable canonical `Game`, `Player`, `Unit`, `GameMap`, raw tile-state buffers, `Execution` objects, or equivalent engine internals. The controller receives legal observations and submits declarative directives/commands.

### 5.4 Starter controller

Every player begins with one **minimal complete working controller**. It should demonstrate lawful/basic mechanics while remaining strategically weak. It may expand monotonously, launch simple opportunistic attacks with simple weighting, use an even-spread defensive priority policy, use a basic counter-response rule, build/upgrade evenly, and avoid sophisticated doctrine, prediction, or threat analysis.

A minimal controller must be viable without scanning every cell, implementing graph algorithms, manually allocating defenders, reproducing formulas, or manually tracking engine operation identities.

### 5.5 Browser authoring surface

The browser should be the primary rich authoring/debugging surface. It should support capabilities equivalent to editing controller source, saving incomplete drafts, inspecting API documentation/types, certification/benchmarking, diagnostics/replays, publishing immutable certified versions, selecting controller presets/versions, and visualizing controller debug overlays.

### 5.6 Multi-file source packages

Controller projects may contain multiple local TypeScript modules. Publication compiles/typechecks/bundles the source package plus the official controller SDK into one immutable certified artifact. Runtime filesystem/import access is not required.

---

## 6. Controller invocation contract

### 6.1 Immutable observation snapshots

Each controller invocation receives one immutable deterministic observation snapshot corresponding to a specific authoritative simulation state. The simulation does not advance underneath the controller while that invocation executes. Returned collection ordering and other observable iteration behavior must be deterministic.

### 6.2 Provisional cadence

Current provisional starting values:

```text
Authoritative simulation: 10 ticks/second
Controller decision cadence: every 5 simulation ticks
Controller decisions: 2/second
```

Cadence is deterministic and expressed in simulation ticks, not wall-clock time. Accelerated/headless matches process the same logical ticks faster rather than changing game time.

### 6.3 Persistent per-match controller memory

Each player controller has explicit deterministic **per-match persistent memory**. The exact V1 codec/lifecycle is defined by [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md).

The public memory shape is the existing JSON-like root object from `ControllerApi.ts`. V1 canonicalizes it to compact UTF-8 JSON with recursively sorted object keys, finite numbers only, array order preserved, and a hard **131,072-byte** canonical uncompressed limit. Unsupported/exotic values, cycles, sparse holes, and non-finite numbers are invalid.

Returned memory is whole-object replacement, not deep merge. Omitting `memory` preserves the prior committed value. Memory begins as `{}` for every new match, flows through Strategic Spawn into normal `decide()` callbacks, is private to that controller/faction, and never persists between matches.

A structurally valid callback may commit valid new memory even when one or more ordinary game-facing actions/directives are rejected by deterministic gameplay validation. Runtime faults, malformed whole output, invalid memory, or memory-limit violations discard that invocation's proposed memory and preserve the previous successfully committed memory.

Controllers must not rely on mutable module/global runtime state surviving between invocations. Only this explicit memory is guaranteed writable persistence.

### 6.4 Decision-as-set semantics

A controller invocation proposes one **transactional desired decision set**, not an order-sensitive imperative script over canonical state.

If one decision reduces one Population commitment and increases another, validation considers the proposed final commitment state rather than making source-code call order a hidden gameplay mechanic. One-shot commands are validated against the same observation snapshot and may not depend on a structure/unit created earlier in that same decision unless a future command explicitly documents otherwise.

Persistent directives remain active when the controller does not mention them on the next invocation. One-shot commands execute only once.

---

## 7. Controller certification, safety, and failure handling

### 7.1 Mandatory certification

Broken/incomplete drafts may be saved. Only controller versions that pass mandatory certification may be published/used in real matches.

Certification should exercise startup, neutral expansion, hostile contact, multiple enemies, partial Segment ownership, Population/FFY changes, disappearing/capitulating opponents, naval/amphibious opportunities, construction success/failure, rapid territory changes, `atWar` transitions, very low Population, simultaneous attacks, invalid commitments, target races, spawn lifecycle fallbacks where applicable, and runtime resource limits.

Certification rejects syntax/type/compile errors, runtime exceptions, timeout/memory violations, non-finite numeric output, invalid API arguments, malformed decisions, impossible commitments, and other controller-contract violations.

### 7.2 Transactional execution

Controller callback validity and game-state mutation validity are deliberately separated.

A successful callback must first produce one structurally valid output; any returned memory must pass the canonical codec/quota. Valid returned memory then commits according to `CONTROLLER_MEMORY.md` even if later ordinary gameplay validation rejects a proposed action.

Game-facing persistent directive changes and one-shot commands are still validated against the immutable observation using their canonical transactional/final-desired-set semantics. The engine never silently normalizes an illegal game-state transaction merely to preserve part of it. Structured receipts report ordinary stale-state/legality rejection without turning that rejection into a controller runtime fault.

Population commitment changes from one valid committed game-facing decision take effect **immediately at that decision commit**. There is no Deployment/Redeployment delay system in V1.

### 7.3 Structured gameplay failure

Lawful API use should normally produce structured results/rejections such as:

```text
INVALID_TARGET
INSUFFICIENT_FFY
INSUFFICIENT_AVAILABLE_POPULATION
NO_LONGER_OWNED
OUT_OF_RANGE
TARGET_DESTROYED
COMMITMENT_LIMIT
...
```

Ordinary game-state races should not require blanket `try/catch` logic.

### 7.4 Invalid decisions

A complete invalid **game-facing mutation set**, such as simultaneous commitments exceeding legal Available Population, is rejected as a whole. The engine does not silently normalize or partially apply that mutation set. This does not roll back separately validated controller memory: valid memory from the same structurally valid callback remains committed under `CONTROLLER_MEMORY.md`.

### 7.5 Runtime failure behavior

A controller runtime fault must never crash or corrupt the match. Runtime faults are uncaught controller exceptions, timeout, malformed whole-decision/output, controller/isolate memory-limit violation, or sandbox violation.

Ordinary stale-state/gameplay-legality rejection is different: it produces a deterministic transaction/command receipt and is **not** a controller runtime fault.

On a runtime fault:

- output/memory from that invocation is discarded;
- the faction keeps its last successfully committed operations/directives;
- existing attacks, counter-responses, builds, units, and other prior valid actions continue under normal simulation rules;
- the fault is logged/counted;
- later controller invocations are attempted again until the circuit breaker trips.

If the **first-ever normal match invocation** faults:

```text
all Population is Available
no offensive commitments
no active counter-responses
no new actions/orders/directives
```

The faction still receives normal automatic defense.

The accepted V1 normal-runtime circuit breaker is deterministic:

```text
5 consecutive runtime faults
OR
20 total runtime faults in one match
→ controller FAULTED for the remainder of the match
```

A non-faulting normal invocation breaks a consecutive-fault run. Once FAULTED, no replacement AI takes over.

Pre-match spawn-hook failure/missing/malformed/rejected output is handled by the deterministic legal spawn default appropriate to the faction's spawn profile and does **not by itself** fault an otherwise valid controller for normal match play.

### 7.6 Diagnostics

`lastDecision` exposes deterministic previous-decision status/rejection metadata useful for programmatic recovery. Human-facing diagnostics should show relevant codes, exception/stack information for real program errors, transaction rollback status, active prior directives, and retry/faulted status.

---

## 8. Controller sandbox and security

Player controller code must be treated as hostile even though the intended user group is small and authenticated.

It must not receive unrestricted access to filesystem, network, subprocesses, environment variables, system clock, arbitrary native modules, host process objects, or unrestricted CPU/memory. The runtime provides deterministic game RNG rather than uncontrolled entropy.

Raw `eval` and Node `vm` alone are not sufficient security boundaries. The accepted V1 implementation uses `isolated-vm` isolates hosted in separate controller worker processes as specified in `OPENFRONT_INTEGRATION_PLAN.md`; QuickJS/WASM is only a future contingency if concrete operational evidence requires replacement.

The accepted V1 runtime-enforcement baseline is:

| Limit | V1 value |
| --- | ---: |
| Persistent controller memory | **128 KiB** |
| Isolate heap | **32 MiB** |
| Normal `decide()` callback | **20 ms max** |
| Strategic Spawn callback | **50 ms max** |
| Initial module evaluation | **100 ms max** |
| Serialized returned decision | **256 KiB max** |
| Queries per decision | **128** |
| Materialized cells per decision | **25,000** |
| Directive updates per decision | **128** |
| One-shot commands per decision | **64** |
| Total policy/weight rules | **256** |
| Debug overlay items | **256 per decision** |
| Controller log text | **8 KiB per decision** |
| Observable events delivered | **512 per decision**, then deterministic truncation; overflow is summarized in diagnostics/replay |
| Team-signal payload | **1 KiB** |

Structural limits are visible through the controller API where useful. Wall-clock/heap enforcement is **not** exposed as a gameplay-readable remaining-budget value. Benchmarking may justify later explicit/versioned runtime-limit changes; that is tuning, not an unanswered V1 architecture decision.

---

## 9. Spatial ontology

### 9.1 Cells

Cells are the finest meaningful territorial simulation resolution. Ownership, terrain, capture, structures, and local combat geometry ultimately resolve through cells.

### 9.2 Fixed V1 map raster

Ordinary Open Fufu V1 maps use **exactly 4,800,000 raster cells**. Map width, height, and aspect ratio may vary, but their final authored/compiled raster must contain exactly that many cells.

The 4.8-million-cell count includes all real map cells: population-bearing terrain, conquerable non-population-bearing terrain, water, and impassable terrain. The number and share of **population-bearing** cells is deliberately map-dependent and is not normalized across maps.

Therefore a water-heavy archipelago, a mixed continental map, and an almost-all-land **Endless Plains**-style map may support very different total Population Capacity while retaining the same physical simulation resolution. This is legitimate map identity rather than a balance error: some Origins/Echoes/strategies may naturally perform better or worse on different terrain compositions.

V1 does **not** support multiple gameplay map-resolution scales. Fixed raster scale keeps cell-based ranges, movement, structure radii, blast geometry, spawn footprints, railway distances, and other cell-space mechanics comparable across authored maps and simplifies map generation/validation.

Map validation must still prove that the authored terrain composition can support the configured participant count, required starting footprints, and other spawn constraints.

### 9.3 Segments

A Segment is an immutable deterministic strategic geographic region generated/compiled with the map. The detailed accepted V1 generation and sizing contract is [`SEGMENTS.md`](./SEGMENTS.md).

Every real map cell belongs to exactly one Segment, including ordinary land, Shallow Water, Deep Water, and Impassable terrain. Every Segment is cardinally 4-connected: any member cell can reach every other member cell through north/south/east/west member-cell steps. Segment membership/IDs/adjacency do not change during a match, even if dynamic terrain/state changes later occur.

Segments are a query/index/strategy lens, **not a simulation bucket**. Segment borders have no intrinsic combat, capture, movement, economy, visibility, or other physical effect.

V1 targets roughly **4,096 cells per Segment only when geography offers no better boundary**. There is no hard minimum, maximum, aspect-ratio, or compactness rule. Geography and useful terrain/topology dominate size: coherent rivers/waterways, ridges, islands, passes, coasts, basins and similar features may produce very small, very large, extremely long/thin, or otherwise irregular Segments.

The compiler preserves strategically meaningful features but may absorb meaningless isolated raster noise. Feature-significance heuristics are deterministic/versioned map-compiler parameters; final compiled Segment membership is part of the map artifact/hash and is never silently regenerated for historical maps.

V1 exposes terrain summaries rather than semantic geographic tags such as `RIVER`, `RIDGE`, or `STRAIT`. Shallow Water/Deep Water and the existing terrain vocabulary must suffice for V1; geographic tags may be reconsidered in a future API version.

### 9.4 Contacts

**TerritorialContact** is derived adjacency geometry between differently owned cells.

**OperationalContact** is broader runtime interaction/visibility state created by territorial contact, combat, naval encounters, amphibious arrival, or other operational interaction.

### 9.5 Fronts

There is no engine-level canonical `Front` object that dictates strategy. Controllers may derive fronts from cells, Segments, Contacts, factions, terrain, ownership, and visibility.

---

## 10. Population model

### 10.1 One global Population resource

Each faction has one global **Total Population** used for offensive land operations, neutral expansion, counter-responses, transport payloads, automatic defense while Available, and casualties.

There is no separate civilian/army/manpower resource and no hidden mobilizable fraction.

### 10.2 Population Capacity is exactly territory-derived

**Population Capacity is exactly the number of owned population-bearing cells.**

For V1, population-bearing status is an explicit terrain property. Ordinary conquerable land is population-bearing unless a canonical terrain rule says otherwise; for example, Tundra and Shallow Water are conquerable but intentionally non-population-bearing. Fallout is an overlay and follows the underlying terrain's population-bearing classification.

```text
1 owned population-bearing cell = 1 Population Capacity
```

No structure, Echo, Origin trait, faction trait, terrain multiplier, or hidden modifier increases the Capacity value of an already owned cell while this rule is in force.

Cities do **not** increase Capacity. Echoes and Origins must not provide `+Population Capacity`, `+Max Population`, or equivalent per-territory effects.

A surfaced **Initial Territory** starting-state modifier is compatible with this invariant because it changes how many population-bearing cells the faction owns at match start. Those additional owned cells then contribute ordinary Capacity at exactly one Capacity each. The modifier changes starting ownership, not Capacity-per-cell.

Territorial loss may leave current Population above Capacity. Capacity loss does not itself delete excess Population; ordinary positive growth is suppressed until sustainable again, except where the same event explicitly causes Population casualties under another rule.

#### 10.2.1 V1 starting territory and Starting Population relationship

The ordinary V1 base starting footprint is:

```text
Base Initial Territory = 1,000 population-bearing cells
```

The faction's **final Initial Territory** is calculated after explicit surfaced Initial-Territory modifiers such as P01. The resulting owned population-bearing cells become its starting Population Capacity under the ordinary `1 cell = 1 Capacity` rule.

Ordinary V1 Starting Population is then derived from that **final modified Initial Territory**:

```text
baseline Starting Population
= 50% × final Initial Territory
```

Thus an ordinary 1,000-cell start begins with 500 Population. If an Initial-Territory modifier changes the start to 1,150 population-bearing cells, the ordinary 50% baseline becomes 575 Population.

Initial-Territory modifiers and Starting-Population modifiers are still **separate modifier axes**. An Initial-Territory effect changes the starting owned-cell/Capacity quantity first; a Starting-Population effect then modifies the starting Population amount/fraction derived from that final territory rather than granting more territory.

Conceptually:

```text
base Initial Territory
→ Initial-Territory modifiers
→ final Initial Territory / starting Capacity
→ ordinary 50% Starting-Population baseline
→ explicit Starting-Population modifiers
→ final Starting Population
```

Whole-integer Population representation and deterministic fixed-point/rounding rules apply to any non-integer intermediate result.

A split-origin faction still receives **one global final Starting Population pool** calculated by this same rule. The pool is not divided into independent local Population stores merely because the territory is painted as two starting footprints.

### 10.3 Available and Committed Population

```text
Total Population
= Available Population
+ offensive commitments
+ active counter-responses
+ Population aboard transports
```

There is no persistent `Reserve` resource.

**Available Population** is Population not currently committed to an active operation/transport. It forms the faction's automatic defensive pool and may be recommitted instantly by a valid controller decision.

### 10.4 No defensive occupancy

There is **no persistent defensive Population allocation by cell, Segment, Contact, or front**. Controllers cannot stack passive defenders onto selected owned cells.

Automatic defense is an ephemeral per-tick use of Available Population. One unit of Available Population may defend at most one threatened owned cell in that tick, and one threatened owned cell may receive at most **1 automatic defensive Population** regardless of how much Population the faction has.

Capacity is a ceiling, not free defensive strength. A faction with territory but **0 Available Population has 0 baseline Population defense**. Terrain/structure percentage modifiers do not create Population out of nothing; only an explicit future mechanic that supplies independent flat defense could do so.

### 10.5 Quantized Population and deterministic fractional costs

Authoritative Population quantities exposed to controllers and used for allocations/commitments are non-negative whole integers and should normally use a `uint32`-compatible representation.

Deterministic fixed-point/residual accumulators may be used internally where formulas or explicit mechanics need sub-unit precision. A mechanic such as **0.5 Population settlement cost per neutral cell** therefore does not make public Population fractional: two half-cost settlement events consume one whole Population through deterministic residual accounting.

A residual associated with a faction-level recurring cost must not be erased by ending/recreating an operation. In particular, any fractional neutral-settlement residual is **faction-level persistent match state**, preventing operation churn from avoiding payment.

---

## 11. Population growth

Capacity says how much Population can be sustainably supported. Growth says how quickly Population recovers/grows toward that limit.

The accepted ordinary V1 base-growth equation is now exact:

```text
BaseGrowthPerSecond
= 0.05 × PopulationCapacity^0.75
```

`BaseGrowthPerSecond` is measured in **Population per real/simulation second**. The exponent is exactly `0.75` and the V1 reference coefficient is exactly `0.05` unless a future versioned balance change explicitly retunes the ruleset.

Let:

```text
u = TotalPopulation / PopulationCapacity
```

The ordinary utilization multiplier `U(u)` uses the following exact anchors with **piecewise-linear interpolation** between adjacent anchors:

| Utilization | `U(u)` |
| ---: | ---: |
| 0% | **20%** |
| 10% | **45%** |
| 20% | **70%** |
| 30% | **88%** |
| 40% | **100%** |
| 50% | **100%** |
| 60% | **100%** |
| 70% | **85%** |
| 80% | **60%** |
| 90% | **35%** |
| 100% | **0%** |

For `u >= 1`, ordinary positive Population growth is zero. If `PopulationCapacity == 0`, ordinary Population growth is exactly zero and no division by zero is performed.

The nonzero 0%-utilization anchor means a faction that still owns population-bearing territory but has reached 0 current Population is gravely weakened rather than mathematically incapable of ever regrowing Population.

Actual ordinary growth is conceptually:

```text
ActualGrowthPerSecond
= BaseGrowthPerSecond
× U(u)
× explicitGrowthMultiplier
```

where City, Echo, terrain-share, Origin, and other ordinary same-axis growth percentages compose through the canonical surfaced modifier-stacking rules unless an explicit structural growth-profile rule says otherwise.

Therefore **`1.0×` utilization means exactly 100% of `0.05 × Capacity^0.75`**, not 1% of Capacity and not a fixed Population-per-second quantity. For example, at 1,000,000 Capacity:

```text
BaseGrowthPerSecond
= 0.05 × 1,000,000^0.75
≈ 1,581 Population/s
```

At `U=1.0`, the utilization layer passes that full amount before explicit growth modifiers; at `U=0.60`, it passes approximately 949 Population/s before those modifiers.

An ordinary 1,000-cell V1 start therefore begins at 500 Population / 50% utilization, inside the maximum-growth band. With no immediate Population expenditure, it has time to grow through the 50–60% band before utilization begins reducing growth efficiency.

Newly grown Population enters **Available Population**.

### 11.1 P02 widened 30–70 utilization profile

P02 does not invent an unrelated second demographic equation. It replaces only the utilization-profile mapping so the faction has the same broad demographic shape but a much wider maximum-efficiency band.

Let `Uordinary(x)` be the ordinary piecewise-linear curve above. P02 uses:

```text
if u < 0.30:
    UP02(u) = Uordinary(u × 4/3)

if 0.30 <= u <= 0.70:
    UP02(u) = 1.0

if u > 0.70:
    UP02(u) = Uordinary(0.60 + (u - 0.70) × 4/3)
```

with ordinary zero-growth handling at/above full Capacity.

This horizontally remaps the ordinary 40–60% maximum-efficiency band into **30–70%** while retaining the ordinary low-utilization and high-utilization curve shapes outside it.

---

## 12. Offensive operations and engaged frontage

### 12.1 Instant operation commitment

Offensive Population is attached primarily to operations rather than cells.

Conceptually:

```text
AttackOperation {
    committedPopulation
    target
    spatialIntent
    activeFrontGeometry
}
```

Creating, changing, ending, or reallocating an operation's Population occurs immediately when a valid controller decision commits. V1 has no Deployment/Redeployment Rate or gradual land mobilization queue.

### 12.2 Spatial intent

Spatial intent may use target factions, Segments, Contacts, explicit cells/areas, controller-defined cell sets, terrain, objectives, and weights.

The engine resolves intent into legal **engagement lanes** for each simulation tick.

An engagement lane is one attacking source cell pressing one adjacent target cell for that faction during that tick.

Within one faction's resolved frontage:

- one source cell may press at most one target cell in that tick;
- the same target cell is not duplicated by multiple source cells from that faction in that tick;
- different hostile factions may still contest the same target cell from different sides;
- engagement geometry is frozen for the tick, so newly captured cells do not create same-tick chain conquest.

### 12.3 Population bounds frontage

An operation cannot actively press more engagement lanes than its committed Population.

```text
engagedFrontage
<= committedPopulation
```

If an operation commits 800 Population against 1,000 otherwise legal selected boundary cells, at most 800 engagement lanes are active; its weighting determines which legal lanes are selected.

If it commits 100,000 Population across only 300 engaged lanes, all 300 may be active and the surplus Population increases concentration/pressure on those lanes.

### 12.4 Finite offensive pressure

An operation's finite committed Population is distributed deterministically across its engaged lanes according to its legal weights. Uniform weighting means approximately:

```text
raw attack pressure per lane
= committedPopulation / engagedFrontage
```

Multiple same-faction operations contributing to the same local combat are aggregated into one faction-local pressure before combat resolution. Splitting one strategy into many operation objects must never manufacture power.

### 12.5 Actionability

Land pressure only affects cells actionable through current territorial adjacency. Selecting a remote objective does not teleport land pressure there. Remote hostile coast becomes actionable through explicit amphibious transport/landing mechanics.

### 12.6 Neutral expansion

Neutral expansion uses ordinary Population through an offensive/expansion operation.

Neutral cells have **no automatic Population defender**, but neutral settlement is neither free nor instantaneous. A neutral population-bearing cell must still receive sufficient legal settlement/capture progress, and **each successfully acquired neutral population-bearing cell costs 1 Population from the expansion commitment** under the baseline ruleset.

The settlement casualty is a colonization/occupation cost, not a phantom neutral defender: there is no neutral defending Population to kill and no defender-side Population accounting.

Explicit surfaced mechanics may modify neutral-settlement Population cost. A fractional cost such as `0.5 Population per cell` is handled through the faction-level deterministic residual mechanism in §10.5 while controller-visible Population and commitments remain whole integers.

Neutral Fallout follows the underlying base terrain's population-bearing classification and additionally applies its explicit Fallout capture-resistance/progress rule.

---

## 13. Automatic defense, defensive priorities, and counter-responses

### 13.1 Binary contact-surface defense

Available Population automatically defends without persistent defensive placement.

For each simulation tick, derive the defender's distinct owned target cells currently pressed by incoming engaged hostile lanes. Automatic cell defense is **binary**:

```text
0 or 1 automatic defensive Population per threatened owned cell
```

No threatened cell may receive more than 1 automatic defender, even when Available Population greatly exceeds the engaged frontage.

Therefore:

```text
automaticallyDefendedCells
= min(AvailablePopulation, threatenedOwnedCells)
```

If Tanya has 100,000 Available Population and only 1,000 threatened cells, all 1,000 may receive one automatic defender and the remaining Population stays Available. It does not create additional hidden defensive pressure.

If Available Population is lower than the threatened surface, the finite defense slots are apportioned across incoming contacts/operations approximately in proportion to their engaged lane counts. Thus a 300-lane Fufu attack plus a 100-lane Ski attack against Tanya receives a 3:1 share of Tanya's scarce automatic defense slots before cell-priority selection.

A merely adjacent but inactive border does not consume defense. The same Available Population must never be duplicated across cells, contacts, or attackers. If multiple hostile operations contest the same owned target cell, that cell still receives at most one automatic defender.

Terrain, Forts, Origins, Echoes, and other explicit local modifiers may modify the effectiveness of that one defender; they do not increase the automatic Population count above one.

If Available Population is zero, baseline Population defense is zero.

### 13.2 Defensive priority policy

Controllers may provide strategy-neutral defensive priorities/weights that determine **which threatened cells receive scarce automatic defenders**. They do not choose how many Population units automatic defense receives and cannot assign more than one automatic defender to a cell.

A controller may, for example, prioritize mountains, Forts, Cities, chokepoints, selected Segments, objectives, or arbitrary legal cell sets. The controller can construct any higher-level defensive doctrine from these primitives.

The default policy is an **Even Spread** policy. Equal-priority cells use deterministic seeded tie-breaking derived from rule-bearing match state rather than uncontrolled randomness. The deterministic tie-break may rotate over time so the default does not permanently leave the same arbitrary cells undefended.

Defensive priorities are updated through ordinary controller decisions and then consumed cheaply by the simulation between controller invocations. Newly threatened cells without an explicit priority fall back to the default priority.

### 13.3 Active counter-response

A controller may instantly commit Available Population to an **active counter-response** against a specific incoming hostile operation.

Counter-response Population leaves the generic Available pool while committed. It does **not** reinforce passive cell defense and cannot raise a threatened cell above the one-defender automatic cap.

Instead, counter-response Population directly engages the incoming operation's committed Population as a targeted operation-vs-operation fight. Counter-response combat may therefore reduce Population even when no cell changes owner.

Let:

```text
A = Population currently committed to the incoming attack
R = Population currently committed to the counter-response
```

If either side is zero, no counter-response exchange occurs and the zero-strength operation ends as appropriate. Otherwise, counter-response combat resolves simultaneously from the same pre-tick `A` and `R`.

The shared **base exchange volume** is proportional to the smaller force:

```text
B = k × min(A, R)
```

where `k` is a ruleset/tuning rate.

Force-size advantage is determined from **relative**, not absolute, imbalance:

```text
d = (R - A) / (R + A)
```

so `d` lies between `-1` and `+1` and behaves the same at early-game and late-game scales. The imbalance is then deliberately flattened near parity with a nonlinear shape:

```text
s = sign(d) × |d|^p
```

with `p > 1`; **`p = 2` is the provisional V1 starting value**.

Let `M` be the maximum permitted casualty-efficiency ratio between the advantaged and disadvantaged side. **`M = 1.5` is the provisional V1 starting cap.** Define:

```text
h = (M - 1) / (M + 1)
```

The default mirrored V1 multipliers are:

```text
responseMultiplier = 1 + h × s
attackMultiplier   = 1 - h × s
```

and the simultaneous casualties are conceptually:

```text
attackPopulationLost   = B × responseMultiplier
responsePopulationLost = B × attackMultiplier
```

with deterministic fixed-point/residual handling and hard caps so neither side loses more Population than it actually has.

The ruleset exposes **attack-side** and **response-side** counter-combat effectiveness curves/parameters as semantically separate hooks even when their default V1 behavior is mirrored. Future explicit Origin/Echo/ruleset mechanics may favor overwhelming attack or overwhelming response differently.

Ending/changing a surviving counter-response is instantaneous on a valid controller decision and returns its surviving Population to Available. A counter-response is tied to one incoming operation and cannot duplicate the same committed Population across multiple targets.

Exact `k`, final `M`, final `p`, and future explicit side-specific modifiers are balance data rather than architectural questions.

---

## 14. Cell combat, capture, and ordinary land casualties

Combat is deterministic and cell-resolved.

For each engaged target cell, local effective attack pressure is derived from finite attacker pressure and explicit modifiers. Local automatic defense is either zero or one Population before terrain/structure/Origin/Echo modifiers. Counter-response combat against the offensive operation is separate from passive cell defense.

### 14.1 Capture direction

The accepted pressure-advantage direction remains a useful starting point for capture progress/speed:

```text
advantage = (A - D) / (A + D)
```

where `A` and `D` are local effective pressures after explicit modifiers. If both are zero, there is no combat capture.

Exact capture-progress/rate coefficients are tuning data.

### 14.2 Frontage bounds territorial throughput

A target cell can change political owner at most once per simulation tick.

Because engagement geometry is frozen at tick start, one active engagement lane can yield at most one cell capture during that tick and newly captured cells cannot open additional same-tick captures.

Therefore an operation with 300 engaged lanes cannot capture more than 300 cells in that tick. Actual captures may be much lower according to pressure advantage, terrain, structures, and capture-rate tuning.

### 14.3 Ordinary hostile land casualties are capture-coupled

V1 does **not** use a separate continuous land attrition formula such as `2AD/(A+D)` for ordinary hostile cell capture.

For each successfully captured **automatically defended population-bearing hostile cell** under the baseline rule:

- the previous owner loses the **1 current Population** that was automatically defending that cell;
- the winning attacker loses **1 current Population** from the capturing offensive commitment;
- the previous owner's Population Capacity falls by 1 because the cell was lost;
- the new owner's Population Capacity rises by 1 because the cell was gained.

The consumed defender is normally removed from Available Population. An explicit Origin trait may instead cause that automatic defender to **survive the territorial loss and remain/return Available**; that exception does not cancel the attacker's ordinary 1-Population capture casualty, the ownership change, or the Capacity transfer.

If a hostile-owned cell had zero automatic Population defense, its capture causes **no ordinary hostile cell-capture Population casualty** for either side. This zero-casualty rule does **not** make neutral expansion free: neutral settlement follows the separate explicit settlement-cost rule in §12.6.

Ordinary stalled/failed land pressure does not by itself create Population attrition. Population can still change without a cell changing owner through other explicit mechanics such as counter-response combat, nuclear strikes, neutral settlement, transport destruction, Tank Population attacks, or other specifically defined effects.

Casualties are capped by the finite Population actually available/committed to the relevant combat; Population never becomes negative.

### 14.4 Multi-faction combat

FFA remains genuinely competitive among all non-team factions in the same local operational space.

Finite same-faction pressure is aggregated before resolution and is never duplicated once per opponent. If several hostile factions are valid claimants for one cell, local pressures are resolved from the same pre-state and the strongest successful claimant wins deterministically.

A cell still changes owner at most once that tick. For a defended capture, the ordinary one-for-one capture casualty pair applies only between the previous owner and the winning claimant, subject to any explicit defender-survival modifier above. Unsuccessful third-party claimants lose **no Population merely for contesting that same cell** and gain no territory from it.

Attackers on completely separate fronts do not magically fight one another merely because they share an enemy.

---

## 15. Retreat and deliberate territorial abandonment

Controllers must have an explicit primitive to deliberately relinquish owned territory rather than relying on withdrawal side effects.

Ending or reducing an offensive/counter commitment returns that Population to Available immediately on a successful controller decision. Deliberate territory relinquishment is a separate political/spatial action.

Exact inherited consequences for structures/units on deliberately abandoned territory remain integration-dependent.

---

## 16. Naval and amphibious Population

Transport ships carry explicitly committed Population.

While aboard a transport, carried Population:

- is not Available for automatic land defense;
- does not exert ordinary land pressure;
- may be lost if the transport is destroyed;
- becomes eligible to participate locally when a legal amphibious landing reaches its target.

A landing makes the coastal target operationally actionable; carried Population then joins the local offensive engagement rather than teleporting land pressure to a remote coast.

### 16.1 Transport embarkation FFY costs

The baseline Transport embarkation FFY cost is **0 FFY**. Explicit Origin/ruleset effects that add Transport cost compose as **additive embarkation-cost modifiers**, rather than competing absolute replacement prices.

For example, the accepted fortified-landing Origin trait adds `+250 FFY` and the existing Transport-cost drawback adds `+500 FFY`; if both are present, the Transport embarkation cost is `750 FFY`.

This additive model is the canonical combination-safe rule for those traits.

### 16.2 Fortified amphibious landing trait

An accepted Origin trait changes amphibious doctrine as follows:

- Transport embarkation costs **+250 FFY**;
- a Transport that successfully establishes its amphibious landing grants a **permanent level-1 Fort** at the landing location;
- a Transport destroyed/aborted before successfully establishing land ownership grants no Fort;
- the Fort is an ordinary spatial Fort after creation and may later be upgraded under the standard structure rules;
- because it is a granted structure rather than a purchase, it does not consume an unrelated `first Fort purchase is free` entitlement.

The coastal position naturally limits the value of the granted Fort because part of its normal coverage may lie over unusable water. No temporary pseudo-terrain or separate controller-only beachhead command is required.

### 16.3 Warship construction time

A purchased Warship is **under construction for 5 seconds** at its producing Port before becoming an active mobile unit. It does not appear instantly.

Origin traits that alter the Warship's purchase resource or purchase price do not bypass this construction time unless they explicitly say so.

---

## 17. Strategic weapons

Strategic weapons may target strategically meaningful geography, infrastructure, Cities, difficult terrain, fleets, transports, operations, and other physical objectives according to their specific rules.

They may also reduce Population without requiring defensive cell occupancy.

### 17.1 Missile Silo level gates

Missile Silos use the canonical five-level structure model in §18.

Weapon access is gated by the firing Silo's current level:

```text
Missile Silo level 1+ → Atom Bomb
Missile Silo level 3+ → Hydrogen Bomb
Missile Silo level 5  → MIRV
```

Higher Silo levels also increase launch-charge capacity under the normal Silo rules. A freshly built level-1 Silo therefore cannot immediately launch the strongest strategic weapon.

An Origin effect that grants a weapon for free does not bypass launcher legality. In particular, an effect granting one free MIRV still requires an otherwise legal **level-5** launcher and any ordinary non-price legality requirements. If that effect is defined as a purchase-cost waiver, the player must satisfy any authored affordability/precondition check but the successful granted launch/purchase consumes `0 FFY` as specified by the trait.

A starting Silo granted by an Origin begins at **level 1** unless the granting trait explicitly states otherwise.

### 17.2 MIRV power target

MIRVs remain intentionally frightening late-game strategic weapons, but they must not remain an almost deterministic `delete the current leader` button merely because a much smaller faction obtained one.

Open Fufu therefore uses **both** access and power controls:

- MIRV access requires a level-5 Missile Silo (or an explicitly equivalent legal launcher);
- inherited MIRV devastation is moderately reduced during balance translation.

The exact reduction is tuning work. The inherited implementation's very high warhead count should be retuned; a rough **250–300 warhead** test range is a reasonable provisional starting point rather than a canonical final number.

### 17.3 Warships that count as Missile Silos

Where an Origin trait grants Warships Missile-Silo capability, a Warship's **effective Missile Silo level equals its Warship rank/veterancy, with a minimum effective level of 1**.

This means an ordinary maximum-rank-3 nuclear Warship may reach Hydrogen-Bomb legality but not MIRV legality. If another legal trait raises maximum Warship rank by +2, a sufficiently veteran rank-5 Warship may become MIRV-capable.

Weapon price, range, charge/cooldown, and other ordinary legality still apply unless another explicit trait says otherwise.

### 17.4 Standard nuclear fallout

The standard nuclear terrain rule follows the useful inherited OpenFront political behavior while translating its Population semantics:

- each affected owned population-bearing land cell is immediately relinquished by its owner and becomes neutral;
- the former owner loses **1 current Total Population** for each such affected owned cell, capped so Population never becomes negative;
- because ownership is lost, the former owner's Population Capacity falls by 1 per affected population-bearing cell;
- the cell remains land, remains conquerable, remains part of conquerable territory, and remains population-bearing if its underlying terrain is population-bearing when later reconquered;
- the cell receives an explicit **Fallout overlay** that makes it substantially harder/slower to capture without inventing Population defense.

A later faction that reconquers fallout land gains the normal +1 Population Capacity only if the underlying terrain is population-bearing and receives no free current Population; ordinary growth must refill Population.

Fallout therefore does not permanently reduce the denominator for 100%-of-conquerable-territory victory.

Exact nuclear casualty geometry and other weapon-specific fallout creation behavior remain tuning/translation work; the ordinary Fallout acquisition multiplier and base-terrain values are recorded provisionally in `TERRAIN_AND_STRUCTURES.md`.

### 17.5 Optional water-nuke mode — Accepted V1

Open Fufu retains **Water Nukes** as an optional V1 ruleset mode. The mode is **OFF by default**.

When enabled, the **fully affected inner blast zone** of each resolved strategic-weapon explosion permanently converts eligible terrain to **Deep Water**. The irregular outer blast annulus retains the ordinary nuclear result: affected owned population-bearing land becomes neutral and receives Fallout while preserving its underlying terrain.

| Weapon | Permanent Deep-Water core | Ordinary neutral/Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | `0–12` cells | `12–30` cells |
| Hydrogen Bomb | `0–80` cells | `80–100` cells |
| MIRV warhead | `0–12` cells | `12–18` cells |

These radii reuse the already accepted ordinary weapon geometry. A surfaced modifier that changes ordinary blast geometry changes the water-conversion geometry through that same rule; P25's Hydrogen `+50% blast area` receives no separate hidden water-nuke multiplier.

Inside a water-nuke core:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → Deep Water / unchanged
Impassable      → unchanged
```

Ordinary nuclear ownership/Population/Capacity/unit/structure consequences resolve before terrain conversion. Converted cells are unowned, non-population-bearing, non-buildable, removed from ordinary conquerable territory, and carry no Fallout overlay.

Overlapping water-nuke explosions convert the **union of eligible inner-core cells**; processing order cannot change the final terrain result.

Converted Deep Water immediately changes ordinary movement/pathing, naval connectivity, coast/shore geometry, Population Capacity, future build/traversal legality, and the conquerable-territory denominator. Nuclear-created canals and coasts are real gameplay geography.

Segment identity remains immutable and Segments are not regenerated at runtime. Controllers observe changed terrain normally and may read the enabled mode through versioned `RulesView` values. V1 adds no separate geographic-tag system.

Water Nukes intentionally receive no hidden anti-cheese exception. If enabled by the lobby, erasing land, shrinking the victory denominator, cutting canals, isolating territory, and reshaping coastlines are legitimate consequences.

A City does not create extra Population casualties merely because it is a City. Physical units, transports, structures, fleets, and offensive forces actually affected by the weapon may take their own explicit local damage in addition to the terrain-linked Population rule.

---

## 18. Terrain and structures

Terrain is strategically meaningful rather than cosmetic. The accepted provisional V1 terrain library, traversal rules, capture/settlement-speed modifiers, offense/defense modifiers, terrain-share effects, and Fallout-overlay behavior are defined numerically in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md).

The V1 base terrain library includes **Plains, Highland, Mountain, Desert, Forest, Tundra, Marsh, Shallow Water, Deep Water, and Impassable**. Fallout is an overlay rather than a mutually exclusive base terrain.

Notably, Tundra and Shallow Water are conquerable but contribute **0 Population Capacity**; Tundra is unbuildable, and Shallow Water is unbuildable but may be crossed by ordinary Population-based territorial operations without a Transport. Heavy mobile units such as Tanks use separate traversal rules.

### 18.1 Canonical persistent structures and five-level cap

Open Fufu's canonical V1 persistent structure concepts are:

- **City**;
- **Fort** — the public Open Fufu defensive structure concept adapted from inherited Defense Post infrastructure;
- **Port**;
- **Factory**;
- **Missile Silo**;
- **SAM Launcher**;
- **Observation Post**;
- **Command Post**.

All eight are upgradeable persistent structures with exactly **five legal levels, 1 through 5**. Level 5 is a hard maximum. Structures are built at level 1 unless an explicit surfaced rule says otherwise.

The inherited effectively unbounded generic-upgrade behavior is not authoritative for Open Fufu.

Every structure has a fixed FFY cost for each target level. Building L1 takes the structure's authored construction time, and every L2–L5 upgrade takes that **same structure-specific construction time**. A new structure is inactive until completion; an upgrading structure keeps its previous completed-level effect until the new level completes atomically.

The accepted provisional costs, build/upgrade times, and level-by-level values are maintained in `TERRAIN_AND_STRUCTURES.md`.

Each level has deliberate mechanical meaning:

| Structure | Canonical level progression direction |
| --- | --- |
| **City** | higher level increases explicit Population Growth contribution; never Capacity |
| **Fort** | higher level increases both defensive-pressure effectiveness and Fort coverage area |
| **Factory** | higher level increases Factory-driven industrial/train FFY event value and Tank/Heavy-Artillery simultaneous repair capacity |
| **Port** | higher level increases passive naval repair radius and passive repair rate; close/docked fast repair remains useful at all levels |
| **SAM Launcher** | higher level increases interception range and ordinary interception-charge capacity |
| **Missile Silo** | higher level increases launch-charge capacity and unlocks weapon tiers as specified in §17.1 |
| **Observation Post** | higher level increases tactical observation radius |
| **Command Post** | higher level increases local source offensive-pressure support and coverage radius |

Whether Port level additionally keeps/inherits a Trade-Ship frequency effect is deliberately left for naval/economy translation; the repair progression above is the canonical level identity.

No structure recreates hidden global Military Power.

### 18.2 Forts

Forts modify the effectiveness of actual one-Population automatic defenders inside their coverage; they do not create passive Population by themselves.

The accepted provisional L1→L5 defensive-pressure progression is `+10 / +15 / +20 / +25 / +30%`, with coverage radius `30 / 35 / 40 / 45 / 50`. Same-type overlapping Fort effects use the strongest applicable Fort rather than stacking.

Origin/Echo modifiers may explicitly alter Fort coverage or defensive pressure and compose through surfaced rules.

### 18.3 SAM charges, range, and transformed shield behavior

Under ordinary rules, SAM level increases both interception range and charge capacity. Ordinary charge capacity is one charge per completed level. The accepted provisional L1→L5 range is `70 / 80 / 90 / 100 / 105`, with a baseline **9-second recharge per expended charge**.

SAM target selection/interception remains an automatic structure behavior governed by ordinary legal targeting rules; controllers decide whether/where/how far to upgrade SAMs, not whether to execute a bespoke Origin-only `sacrifice shield now` action for every incoming weapon.

An accepted Origin trait transforms SAMs into a **giant single-charge shield**:

- interception range is increased substantially; **+50% is the provisional starting value**;
- the SAM has **exactly one interception charge regardless of level**;
- recharge cooldown is **2× ordinary** as the provisional starting value;
- upgrading still increases the underlying/rule-composed interception range but never adds charges.

Thus the transformed SAM trades throughput for a much larger defensive umbrella. The automatic targeting system remains responsible for choosing among legally interceptable weapons, so baiting a shield remains possible counterplay without permanently deleting the SAM.

### 18.4 Fully developed City purchase trait

An accepted Origin trait changes **purchased Cities only**:

- a City cannot be purchased at levels 1–4;
- each purchased City is created directly at **level 5**;
- its purchase price is **95% of the ordinary cumulative level-1 build price plus the ordinary level-2-through-level-5 upgrade prices**;
- under the current provisional City cost table this is `0.95 × 2.10m = 1.995m FFY`;
- the faction must satisfy the full discounted purchase-price requirement before construction may begin.

This is one direct City purchase, not four separate upgrade actions. Therefore a drawback that forbids spending FFY on upgrades does not by itself forbid this purchase.

A captured City below level 5 remains at its captured level and may be upgraded normally unless another rule prevents upgrades; the trait does not magically promote captured Cities.

If another effect makes the first City purchase free, the faction must still satisfy the authored full-price/precondition check if that effect is defined that way, but the successful purchase consumes `0 FFY`. This preserves the high early access threshold while allowing the free-purchase interaction.

### 18.5 Observation Posts and Command Posts

An **Observation Post** is the V1 tactical-information structure. It reveals legally revealable operational state inside its radius, including hostile mobile units, persistent structures, and manifested operations needed for tactical decisions. It never reveals controller memory, unmanifested plans, private state, or information outside the canonical visibility projection. Its provisional L1→L5 radius is `40 / 55 / 70 / 85 / 100` and its build/upgrade time is **5 seconds**.

A **Command Post** is planned offensive infrastructure. An ordinary Population-based land engagement lane receives the Command Post's offensive-pressure bonus when its **attacking source cell** lies inside friendly Command-Post coverage. It does not modify Tank/Heavy-Artillery weapon damage, naval damage, strategic weapons, or unrelated FFY effects. Its provisional L1→L5 pressure bonus is `+3 / +6 / +9 / +12 / +15%`, its coverage radius is `30 / 35 / 40 / 45 / 50`, and its build/upgrade time is **10 seconds**.

The Command Post's 10-second construction time is intentional telegraphing: it is offensive infrastructure meant to be planned in advance and to give an observant opponent time to react rather than appearing immediately before an attack.

Same-type overlapping Observation Posts are simply redundant observation coverage; same-type overlapping Command Posts use the strongest applicable effect rather than adding bonuses.

### 18.6 Factory-produced Tank and Origin transformations

The **Tank** is the sole baseline persistent land military unit in V1. One Tank object represents an abstract armored formation rather than one literal vehicle.

Baseline identity:

- produced by an active owned Factory;
- **5-second construction time**;
- no hard ownership cap, with a progressively increasing purchase-cost curve defined in `TERRAIN_AND_STRUCTURES.md`;
- health-bearing and autonomously repaired at Factories;
- attacks hostile Tanks/Heavy Artillery;
- may intercept and destroy hostile Trains for their snapshotted pending cargo value;
- may directly attack hostile Population, causing Population casualties without capturing territory;
- never captures territory itself and carries no Population;
- controller interaction is strategic intent/patrol/raid targeting rather than per-shot or frame-by-frame RTS micro.

Tank geography is deliberately restrictive. The unit is blocked by **Mountain, Shallow Water, Deep Water, and Impassable** terrain and uses explicit speed multipliers on the other traversable terrains. Ordinary Population-based land warfare may cross Shallow Water even though Tanks cannot, allowing rivers and mountain chains to become genuine armored barriers.

The accepted **Heavy Artillery** Origin trait, P43, costs 8 points and transforms every Tank owned/built by the faction rather than creating a second baseline unit. Under the accepted provisional profile, Heavy Artillery has a **10-second build time**, `1.5×` Tank purchase cost, `0.5×` final Tank movement speed, `1.5×` range (`30 → 45`), `1,000` anti-armor damage per `12s`, `1,000` Population damage per `12s`, and no Train-raiding ability. It keeps Tank traversal barriers, but its projectiles may cross Mountain/Shallow Water and other terrain the unit itself cannot traverse when range/visibility/target legality succeeds. It receives no extra health.

The `1,000 Population / 12s` Population attack is intentionally retained for the provisional V1 baseline. Its sustained direct Population damage is exactly the same as the baseline Tank's `250 Population / 3s` (`83.33 Population/s`); the transformation trades cadence for large alpha and a long reload/vulnerability window rather than multiplying sustained Population DPS.

The intended unmodified matchup is emergent from those stats: one prepared Heavy Artillery is favored against one Tank; one Heavy Artillery is strongly unfavored against two Tanks after its opening shot; and two Heavy Artillery are intended to lose to three Tanks after the opening volley because the surviving Tank can destroy both during their long reload. There is no hidden outnumbered modifier.

The independent **Radioactive Munitions** Origin trait, P44, costs **9 points** and affects only successful Tank/Heavy-Artillery Population attacks. After ordinary Population damage resolves, eligible enemy-owned population-bearing cells are neutralized and receive Fallout; Capacity is lost because ownership was removed. A radioactive Tank considers a target-centered Manhattan-radius-2 footprint and neutralizes up to **10** eligible cells per successful Population attack. Radioactive Heavy Artillery uses Manhattan radius 5 and neutralizes up to **50** eligible cells. Structure-occupied and non-population-bearing cells are skipped, deterministic nearest-cell ordering is used, and the footprint does not expand beyond its authored radius to compensate for ineligible cells.

P43 and P44 are independent and legally combinable, producing radioactive Heavy Artillery. P44 adds no second direct Population-damage multiplier; direct Population damage remains the unit form's ordinary damage.

---

## 19. Visibility and viewing

Knowing global geography/ownership is not the same as knowing hidden operational state.

### 19.1 Globally visible gameplay information

At minimum:

- static terrain/geography;
- coast/ocean/impassables;
- current territorial ownership;
- Segment definitions;
- broad faction shape;
- faction Total Population;
- Territory %;
- FFY;
- the faction's selected Origin and full mechanical Origin-trait sheet;
- active public mechanical modifier sheets/rule-bearing faction effects.

Mechanical modifiers should not need to be reverse-engineered from outcomes. Echo generated names/quality visuals are presentation; strategically relevant active modifiers are surfaced directly.

For Strategic Spawn, every participant's Origin, Initial Territory, starting-state effects, and other strategically relevant public spawn-affecting modifiers are visible before Phase 1.

### 19.2 Operational/local information

Detailed local information may depend on OperationalContact/visibility and Observation-Post coverage, including active enemy operations/pressure, counter-responses, mobile units, structures/defenses, and tactical modifiers where allowed.

Fixed teammates share the union of legally observable operational information. This prevents autonomous teammate controllers from being artificially less able to coordinate than humans who could simply relay legally observed information outside the game.

### 19.3 Private

At minimum: controller memory, unpublished source, intentions/plans, and unobservable strategic targeting/decision state.

### 19.4 No third-party live spectating

Ordinary users do **not** spectate unrelated third-party matches.

A player may view a match they are actually participating in, including their own PvE match, from the legal perspective available to that participant. Internal benchmark/certification/development tooling may use trusted omniscient observation where required.

The authoritative server enforces these information boundaries; browser-only hiding is insufficient. Derived queries/calculators must never leak hidden information that raw legal observations would withhold.

---

## 20. FFY economy and trade

FFY is the primary in-match currency. Ordinary V1 begins with **25,000 FFY** and has a flat, non-spatial universal income floor of **1,000 FFY/s**. This baseline is independent of Population, territory, Cities, Factories, and explicit worker allocation: Open Fufu does not use passive `Population → money` taxation/assignment.

Developed FFY income comes primarily from explicit physical/economic events such as Train station service, Trade Ship voyages, piracy/captured cargo, and surfaced conquest/economy mechanics. Population committed to warfare does not secretly reduce FFY through an unstated labor penalty.

Detailed FFY/Trade/Train values and event semantics are canonical in [`FFY_ECONOMY.md`](./FFY_ECONOMY.md). Trade with enemies remains mechanically possible where route/relationship legality otherwise permits it; wartime external trade uses the accepted **0.50×** earning-side multiplier unless an explicit modifier such as P08 overrides it.

### 20.1 Broad FFY modifier surfaces

For modifier design, FFY exposes a **small set of broad economic source families** rather than turning every individual FFY event into a separate build-stat axis. The accepted V1 family shape is roughly:

- generic/overall FFY;
- military/conquest FFY;
- naval/trade FFY;
- industrial FFY.

Individual events still retain their precise event identity internally for simulation, replay, and debugging. Origin/Echo modifiers normally target the broad economic family relevant to that event rather than a large catalogue of hyper-granular event-specific multipliers.

The universal `1,000 FFY/s` floor and explicit global passive Origin-income sources are non-spatial. Spatial FFY modifiers do not apply merely because the faction owns qualifying geography somewhere.

Explicit identity-defining rule exceptions may still exist as curated Origin traits. For example, an Origin may explicitly alter or remove the ordinary wartime trade penalty. Such exceptions are authored mechanics, not arbitrary player formulas.

The Origin and Echo catalogues should be curated so a narrow Echo does not trivially erase the defining drawback that makes an Origin strategically distinct. This is a catalogue-design responsibility, not a hidden Origin/Echo incompatibility rule.

### 20.2 Canonical V1 Train service

Open Fufu keeps the inherited idea of physical rail networks and station-triggered economic events but replaces OpenFront's independent random Train spawning and station-hop routing with a deterministic finite **multi-stop Factory service tour**.

The design goal is deliberately permissive: coherent/deep rail webs and high-density optimized circuits should be economically valuable. The game does **not** impose a hidden hard stop cap merely to suppress clever layouts. A controller that arranges an unusually efficient circuit through many Cities/Ports is allowed to profit from that optimization unless real benchmark/playtest evidence shows pathological/game-breaking behavior.

Baseline service rules:

- **Train speed:** `25 rail cells/second`.
- **Primary Train occupancy:** each Factory supports at most **one active primary Train** at a time.
- A Factory may dispatch its next primary Train only after the prior primary Train **returns to its originating Factory or is destroyed**, then waits a **5-second turnaround**.
- A normal primary dispatch selects **up to five distinct connected eligible City/Port stations** as route-construction targets. Five is a **target count, not a payout/event cap**. If fewer than five eligible stations are connected, use the available set.
- Target selection uses a deterministic rotating/shuffled service queue so large connected rail networks are not permanently reduced to their nearest few stations.
- Route ordering/pathing then minimizes **expected travel time** for a finite closed tour starting and ending at the originating Factory and visiting all selected targets. With uniform rail speed this reduces to shortest physical rail distance between service points.
- The route generator does not intentionally add arbitrary loops solely to farm events; however, retracing produced naturally by the actual rail topology is legal.

The economic trigger is intentionally simple and physical:

> **Whenever a Train physically reaches/passes through an eligible City or Port station along its finite service route, that station triggers its ordinary Train FFY event.**

This rule is independent of whether the station was one of the route generator's selected targets. Incidental stations count. If the finite route physically reaches the same eligible station multiple times, **every qualifying pass triggers another event**.

Every paying station event imposes a **1.5-second dwell**, exactly 15 simulation ticks at the accepted 10 Hz baseline, before the Train continues. There is no hard per-tour economic-event cap. Travel distance plus station dwell plus the one-primary-Train/return/turnaround cycle provide natural throughput costs while preserving the reward for dense, well-designed rail networks.

Factory level does **not** increase ordinary Train count. The accepted provisional L1→L5 ordinary Train-event base values are:

```text
10,000 / 11,250 / 12,500 / 13,750 / 15,000 FFY
```

The physical service rules, payout ownership/modifier semantics, and broader FFY economy are specified in `FFY_ECONOMY.md`; the route mechanics, stop/event semantics, speed, dwell, occupancy, turnaround, P07 quantity behavior, P33 Population behavior, and level-specific base payouts are no longer open design questions.

#### P07 — +25% Trains

P07 modifies dispatch quantity rather than Train speed. Each Factory tracks its own normal primary dispatch count. **Every fourth normal primary dispatch simultaneously launches one additional bonus Train** using the same ordinary route-generation/service rules.

Thus four normal dispatch cycles yield four primary Trains plus one bonus Train: exactly `+25%` Train count over the sequence. The bonus Train has an independently generated deterministic route and does **not** occupy or delay the Factory's primary Train slot. Destruction does not reset the per-Factory sequence.

#### P33 — rail-demographic City events

Whenever a Train-triggered ordinary economic event occurs at a City owned by the P33 trait-holder, that City also grants:

```text
20 × completed City level
```

Available Population to its owner, Capacity-capped. The provisional L1→L5 event values are therefore:

```text
20 / 40 / 60 / 80 / 100 Population
```

P33 follows the same physical-event rule as ordinary Train economics: incidental City passes count, and repeated qualifying passes through the same City during one finite route trigger P33 again. Port events do not generate P33 Population.

Before V1 release, accelerated benchmark simulations should compare optimized rail-demographic strategies—including dense circuits, many Factories, P07/P33, and high City levels—against strong ordinary Population-growth/economic strategies across representative maps and game stages. Hyper-optimized rail being meaningfully stronger is acceptable; retuning is intended for pathological/game-breaking scaling, not for eliminating the reward for clever railway design.

---

## 21. Teams, hostility, defeat, capitulation, and victory

### 21.1 Teams and `atWar`

Team relationships are fixed pre-match. FFA has no formal mutable alliances and non-team factions remain legally attackable regardless of `atWar`.

`atWar` is a symmetric derived recent-hostility state, not a permission gate. Hostile land/amphibious/naval/territorial/strategic-weapon actions may establish or refresh it. Exact timeout is tuning data.

Fixed human-controller teams may use a small deterministic bounded **team signal channel** for controller-to-controller coordination. Signals contain bounded JSON-like data, become visible to teammates on a later deterministic decision boundary rather than creating same-tick ordering races, and do not grant additional hidden information.

### 21.2 Defeat at zero territory

After all simultaneous ownership changes for a simulation tick are resolved, a faction that owns **zero population-bearing territory is immediately defeated**, regardless of remaining Population, active operations, transports, fleets, or other recovery potential.

There is no dispossessed/comeback state.

On defeat, remaining controller activity and military commitments terminate according to deterministic cleanup rules. Exact inherited visual/unit cleanup details belong to integration work, but defeat itself is immediate and final.

### 21.3 Capitulation and resignation

Humans may resign. Official AI may capitulate according to its controller logic.

A resigned/capitulated faction becomes a **passive territorial remnant** rather than instantly neutralizing/gifting its land.

Upon resignation/capitulation:

- Population growth becomes permanently **0**;
- the controller becomes permanently inactive and issues no further decisions;
- active land offensive/counter-response commitments cease and their surviving Population becomes Available;
- all owned **mobile units are removed from the simulation immediately**, including warships, Tanks/Heavy Artillery, trade ships, trains, transport ships, and equivalent future independently mobile units;
- Population carried by a removed transport returns to the faction's Available Population rather than being killed;
- removed mobile units provide no FFY/resource refund;
- in-flight offensive projectiles/strategic weapons owned by that faction are cancelled/removed and do not later detonate or resolve offensively;
- owned territory and static structures remain in place;
- static **passive** effects may continue where their mechanic explicitly permits it, such as a Fort modifying an actual automatic defender;
- static **active** behaviors cease: the capitulated faction launches no missiles, performs no SAM firing, spawns no new trade ships/trains/units, and initiates no other autonomous strategic action;
- remaining Available Population continues automatic passive defense under the normal one-defender-per-threatened-cell rules;
- the territory may subsequently be conquered normally;
- the faction receives no new strategic actions of any kind.

This state intentionally leaves geography and surviving Population to be consumed by normal conquest while removing zombie mobile forces and post-capitulation offensive behavior.

### 21.4 Victory

FFA victory occurs when a faction controls 100% of conquerable territory or all other factions have resigned/capitulated/been defeated.

Team victory occurs when all non-team opposition is defeated/capitulated or the team collectively controls all conquerable territory.

For fixed human-team PvE reward accounting, the **human team is one reward entity**. If one human faction is eliminated while at least one human teammate remains active, the team reward entity remains active; that eliminated human still receives the same final accumulated reward pool as the surviving human teammates. If the team wins, every human teammate receives the full pool including the victory bonus rather than a divided share. If the team later loses, every human teammate receives the same pool accumulated before the team itself was eliminated.

Team PvE is available only with multiple **human** players; AI teammates cannot create a solo team-progression farm and do not become human reward recipients merely by being allied.

---

## 22. Official PvE AI

Official PvE AI presets are creator-authored, not uploaded by ordinary players.

Official AI obeys the same gameplay rules as player controllers: same visibility, Population/FFY, Origins/Echoes, structures/units, legal actions, combat equations, and no hidden resource multipliers, omniscience, or teleportation.

Official AI factions select/bind Origins under the same game rules. Official Origins do not receive privileged hidden bonuses merely because they are creator-authored.

Trusted runtime execution is allowed operationally; difficulty comes from strategy quality. Reusable internal strategy components are encouraged but do not become privileged player-facing policies.

The provisional V1 character roster, allowed shared Origin pools, provisional difficulty targets, and difficulty-derived Echo reward contribution are maintained in [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md). Difficulty is a property of the character/controller preset, not the randomly selected Origin. For reward accounting, an Official AI defeat contributes total Echo rolls equal to its bound difficulty: the ordinary qualifying-opponent `+1` plus a special-AI bonus of `difficulty - 1`.

---

## 23. Origins, Echoes, loadouts, and PvE progression

### 23.1 Origins

An **Origin** defines a faction's fundamental mechanical identity for the match. Exactly one Origin is selected for each faction before Strategic Spawn and remains immutable for that match.

Open Fufu supports:

- **Official Origins** authored/curated by the game creator; and
- **Custom Origins** assembled by players through the Origin creator.

Official and Custom Origins use the **same public trait catalogue, the same point accounting, the same trait-count limit, and the same drawback-refund rule**. Official Origins receive no hidden points, secret traits, invisible modifiers, privileged formulas, or creator-only gameplay exceptions.

An Official Origin is therefore a curated example of an interesting legal build from the same creator available to players, not a mechanically privileged faction class.

A Custom Origin is declarative/versioned data, not executable code. It contains a chosen set of server-defined trait identities plus presentation metadata such as a user-facing name/visual identity where supported.

Origins are fully mechanically public during the match and before Strategic Spawn.

### 23.2 Origin trait catalogue and creator

Origin traits come only from a **curated server-defined trait catalogue**. Players select traits supplied by the game; they do not supply formulas, scripts, callbacks, or arbitrary numeric parameters.

Each trait is one authored mechanical package with one authored point cost or drawback refund. Trait prices are deliberately hand-designed and later playtested rather than derived from a claim that every percentage point has a universally calculable value.

There are **no trait tiers**. If the catalogue contains a strong Initial Territory trait and a different milder trait, they are distinct authored traits rather than `Trait I / II / III` levels of one effect.

There is **no Major/Minor trait taxonomy**, no required trait categories, no hidden incompatibility families, and no combination-specific exclusion matrix. Mechanically transformative traits and simpler scalar traits are all simply Origin traits; their effect and authored cost communicate their significance.

Traits may modify explicit typed game-rule hooks, including structural profiles rather than only scalar percentages. Examples of legal design space include:

- increased Initial Territory paired with another drawback;
- a higher Starting Population percentage paired with weaker long-term growth;
- replacing the ordinary Population-utilization growth profile with a wider optimal band and harsher penalties outside it;
- stronger military/conquest FFY and weaker peaceful/general economy;
- stronger trade/naval FFY;
- an explicit Origin rule that changes/removes the normal wartime trade penalty;
- stronger automatic defensive pressure with weaker offensive pressure, or the reverse;
- transforming a baseline Tank into a Heavy-Artillery doctrine;
- giving Tank/Heavy-Artillery Population attacks radioactive territorial-neutralization behavior;
- other explicit surfaced rule transformations compatible with the canonical mechanics.

The player chooses only the curated trait. The underlying trait may alter several typed rules/parameters, but the player never provides the formula itself.

Anime dialogue/catchphrases/reference text may be used as authored presentation for Origin traits and Official Origins. This is intentionally the primary V1 home for authored anime-line content because the catalogue is small enough for deliberate curation; Echoes use deterministic generated names instead.

### 23.3 Simple public construction constraints

Custom Origin construction intentionally remains simple. The creator exposes only a small set of universal constraints:

1. a base **Origin Point** budget;
2. a maximum number of selected traits;
3. a maximum amount of additional spend that may be financed by negative-trait refunds.

Exact numerical values are tuning data.

Negative traits may finance stronger specialization, but their total refundable contribution is capped so a player cannot stack a large pile of irrelevant drawbacks to create an extreme positive budget. The small overall trait-count cap also keeps Origins readable and prevents giant modifier spreadsheets.

An Origin is not required to spend every point or fill every trait slot.

Balance is not required to make every trait mathematically identical by a universal metric. Small power differences are acceptable. The design goal is that every trait offers something meaningful, legal combinations remain sane, and different builds produce genuinely different controller problems/playstyles.

### 23.4 Every public-legal trait combination is legal

This is a hard design invariant:

> **If a trait exists in the deployed Origin catalogue, every combination of deployed traits that satisfies the published point budget, trait-count limit, and drawback-refund limit is a legal Origin.**

There are no hidden production compatibility checks and no runtime `trait A cannot be combined with trait B` escape hatch.

Production validation may reject only ordinary structural invalidity such as:

- an unknown/removed trait ID;
- a mismatched catalogue/version identity;
- exceeding the published Origin Point budget;
- exceeding the published trait-count limit;
- exceeding the published maximum drawback refund;
- malformed Origin data.

It must not reject an otherwise public-legal combination because development later discovered that two catalogue traits interact badly. If such an interaction exists, the catalogue is defective and must be fixed before deployment.

### 23.5 Exhaustive pre-deployment Origin-catalogue testing

Origin combination safety is a **development/deployment-gate responsibility**, not a gameplay restriction.

Because the trait catalogue and creator constraints are deterministic and the trait-count cap keeps the state space bounded, automated tests should enumerate **every legal trait combination** in each candidate catalogue version before that catalogue can ship.

The exhaustive suite should verify, at minimum:

- every public-legal combination constructs successfully;
- every combination serializes/hashes deterministically;
- no combination produces non-finite, negative, structurally invalid, or engine-unsafe rule values;
- Population growth profiles remain mathematically valid;
- offense/defense/counter-response hooks remain within deliberate engine-safe domains;
- FFY multipliers/rule exceptions remain valid;
- Initial Territory/Starting Population effects remain compatible with spawn/map invariants;
- structure-level transformations, launcher-equivalence rules, Transport-cost stacking, fractional settlement residuals, Tank transformations, and radioactive territorial-neutralization rules remain valid under every legal combination;
- Origin + ruleset composition preserves canonical invariants;
- representative Origin + Echo composition does not violate engine invariants;
- every Official Origin is itself an ordinary legal combination from the same catalogue.

If any legal combination fails, the candidate catalogue/version **does not deploy**. The correct fix is to redesign/reprice/remove a trait or otherwise repair the catalogue/public budget, not add a secret combination restriction in production.

Property/fuzz tests may supplement this exhaustive suite, but they do not replace exhaustive enumeration of legal Origin combinations.

### 23.6 Origin versus Echo design space

Origins and Echoes intentionally overlap in the mechanics they can influence but serve different design roles.

Origins are few, defining, immutable-for-match faction traits and may change starting state, economic identity, growth profiles, combat tradeoffs, or other rule shapes.

Echoes are collectible **deterministically named numeric modifiers** equipped in a multi-slot loadout. They should generally be narrower and more build-oriented. The Echo catalogue should be curated so ordinary Echo combinations do not trivially erase the defining drawback that gives an Origin its identity.

This separation is achieved by responsible catalogue design rather than hidden Origin/Echo incompatibility restrictions.

### 23.7 Echo identity catalogue and generated naming

The collectible system formerly called **items** is canonically named **Echoes**. The detailed working contract is [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md).

The current allowed modifier pool resolves to **93 concrete stat+scope keys** and exactly **12,927 permanent collectible mechanical Echo identities**:

```text
93 single-positive identities
4,278 dual-positive identities
8,556 mixed positive/harmful identities
= 12,927 total identities
```

Each mechanical identity permanently fixes:

- identity ID;
- shape;
- one or two concrete stat+scope keys;
- polarity implied by its shape/slot.

**Magnitude is not part of Echo identity.** Whenever an Echo identity is acquired, its legal integer magnitude or magnitudes are rolled for that acquisition. A later acquisition of the same Echo may therefore be weaker, stronger, or differently distributed while remaining the same collectible identity.

The permanent item table must not materialize every magnitude permutation as a separate collectible definition. The production registry should be deterministically derivable/materializable from the versioned concrete-key catalogue and shape rules rather than maintained as 12,927 hand-authored source-code constants.

V1 Echoes have **no authored anime dialogue/voice-line assignment system**. Instead their names are generated deterministically from a small versioned naming grammar:

```text
stable identity-level character possessive
+ stable concrete-stat name token(s)
+ roll-dependent magnitude descriptor(s)
```

Shape-specific character pools provide a stable anime-character possessive for each identity. Concrete stat+scope keys map to deliberately authored memorable noun/noun-phrase tokens. The system avoids awkward schema-label concatenation such as mechanically prefixing a scope solely to produce names like `Naval Guitar Solo`; every concrete key receives one authored player-facing phrase.

The accepted V1 10/10/10 shape-character pools and the complete 93-key stat-token mapping are maintained canonically in `ECHO_CATALOGUE.md`. High-level design does not duplicate all 93 assignments here.

Magnitude descriptors are universal and use beneficial/harmful **polarity**, not naive arithmetic sign. The accepted naming vocabulary is:

```text
-6 Catastrophic
-5 Cursed
-4 Wretched
-3 Dreadful
-2 Shoddy
-1 Questionable
+1 Decent
+2 Good
+3 Great
+4 Amazing
+5 Fantastic
+6 Absurd
```

For reverse-direction beneficial stats such as cost/cooldown reduction, a beneficial 4-point magnitude uses `Amazing` even though the displayed mechanical percentage may be negative.

Accepted shape grammar:

```text
Single:
<Character>'s <positive descriptor> <stat token>

Dual positive:
<Character>'s <descriptor1> <stat token1> of <descriptor2> <stat token2>

Mixed:
<Character>'s <positive descriptor> <positive stat token>
with a side of <negative descriptor> <harmful stat token>
```

Dual presentation order is deterministic. The character/stat components remain stable for one identity under a naming version, while magnitude adjectives may change when duplicate resolution changes the retained roll. Generated names should be computed from identity + retained magnitude(s) + naming version rather than stored as thousands of authored strings.

The public source repository may contain the reusable/versioned naming grammar, descriptor table, character pools, stat-token mapping, schemas/types, migrations, semantic identifiers, deterministic identity-generation/materialization logic, validation tooling, algorithms, UI/rendering code, and synthetic fixtures. Production account inventories, **Middle Fingers** balances, pity state, pending settlements, and other granular live progression records remain runtime/private data.

Echoes must **not** modify Population Capacity / maximum Population per owned cell while Capacity remains exactly territory-derived. The authoritative 93-key allowed pool and its exclusions are maintained in `ECHO_CATALOGUE.md`; high-level examples here do not create additional Echo stat families.

### 23.8 Modifier stacking and rule composition

For ordinary flat/percentage modifier calculations:

```text
final = (base + sum(flat)) × (1 + sum(percentage))
```

Percentage modifiers in the same calculation are additive before multiplication unless an explicit mechanic says otherwise.

Conceptually, effective rules compose from surfaced sources such as:

```text
ruleset base
→ Origin structural rules / modifiers
→ Echo modifiers
→ terrain / structures / situational effects
→ effective mechanic
```

This is not intended as a universal literal implementation ordering for every mechanic; explicit typed rule hooks define exact semantics. Structural Origin traits such as replacing a Population-growth profile operate through those explicit rule hooks rather than pretending to be ordinary percentage modifiers.

The public mechanical sheet should expose effective values and their relevant surfaced sources.

### 23.9 Echo acquisition, EchoScore, rolled naming, and quality

The number of identities inside each shape does **not** determine how often that shape is acquired. Each ordinary acquisition first selects shape using the accepted provisional distribution:

```text
Mixed positive/harmful: 50%
Dual positive:          35%
Single positive:        15%
```

After shape selection, the identity is chosen **uniformly among every registered identity in that shape**. V1 has no stat-family weighting, owned/unowned weighting, synergy weighting, or completion protection.

Legal integer magnitude configurations for that selected identity are then weighted by **EchoScore**. For a modifier with magnitude `x` and full single-positive maximum `M`, beneficial contribution is `+x/M`, harmful contribution is `-x/M`, and EchoScore is their sum. EchoScore deliberately ignores build-specific synergy and never overrides Pareto duplicate choice.

For non-negative scores, the V1 sampling weight is:

```text
weight(S) = 10^(-2S)
```

For negative scores, use the gentler logarithmically interpolated anchors maintained in `ECHO_CATALOGUE.md`, keeping score-zero rolls common while suppressing both spectacularly strong positive rolls and spectacularly bad mixed rolls. Under the current 93-key/maxima registry and `50/35/15` shape mix, deterministic enumeration gives a natural **Lucky-or-better rate of approximately 2.50%**, roughly one per 40 ordinary acquisitions before Gacha pity.

Rolled-quality tiers are:

```text
Trash         S < -0.50
Questionable -0.50 <= S < 0.50
Decent        0.50 <= S < 0.75
Not Bad       0.75 <= S < 1.00
Lucky         1.00 <= S < 1.25
Cheater       S >= 1.25
```

These are roll-quality/presentation tiers, not permanent identity rarity classes. The identity's character/stat-token components remain stable under the naming version, while its magnitude adjective(s) change with the retained roll. Separately, rolled quality controls the border/effects treatment. Questionable is intentionally dull gray/white, Lucky receives a restrained animated blue glow, and Cheater receives intentionally excessive bright pink/violet/rainbow/radiant presentation. The same identity can therefore change full generated wording and visual quality as its retained magnitudes improve while remaining the same mechanical collectible.

### 23.10 PvE reward roll pool and reward entities

PvE Echo rewards use an accumulated **reward roll pool**, not a victory-only `roll several candidates and keep the rarest` system.

The pool begins at **0**. While the relevant reward entity remains active:

- each qualifying opposing faction defeated contributes **+1 Echo roll**, regardless of who actually defeated it;
- defeating an Official AI contributes the ordinary +1 plus `difficulty - 1` additional rolls, so its total defeat contribution equals the bound preset difficulty from `OFFICIAL_AI_PRESETS.md`;
- victory contributes **+5 Echo rolls**.

Defeat does **not** erase already accumulated rolls. When the reward entity's run ends, every accumulated roll becomes an actual Echo acquisition. Thus 30 earned rolls produce 30 acquisitions; there is no keep-only-the-best filter.

For solo play, the human faction is the reward entity and stops accumulating when that faction is eliminated.

For fixed human teams, the **human team itself is the reward entity** until the human team as a whole is eliminated or the match ends. Every human teammate receives the **full final pool**, not a divided share. An early-eliminated human continues to share the team's later reward accumulation while another human teammate remains active. Fixed AI allies do not become additional human reward recipients.

The Official AI preset's bound difficulty is the single per-character reward source of truth. Do not maintain an independent per-character Echo-bonus table. Randomly selecting a different allowed Origin does not alter the preset's difficulty or reward contribution.

### 23.11 Owned Echoes, duplicates, reward settlement, and Gacha Store

An account retains at most **one magnitude configuration per Echo identity**. Owned identities remain eligible for future acquisition; receiving one again is a duplicate with a fresh magnitude roll.

The duplicate/Gacha currency is canonically named **Middle Fingers**. Every duplicate grants Middle Fingers based on the **new duplicate roll's quality tier**, regardless of whether the new roll is retained:

```text
Trash         1 Middle Finger
Questionable  2 Middle Fingers
Decent        3 Middle Fingers
Not Bad       4 Middle Fingers
Lucky         6 Middle Fingers
Cheater       8 Middle Fingers
```

Duplicate comparison uses Pareto dominance:

- if the new roll is at least as good on every axis and strictly better on at least one, it replaces the retained roll automatically;
- if it is no better on any axis and strictly worse on at least one, the old roll is retained automatically;
- if some axes improve while others worsen, the player chooses which roll to keep;
- for harmful modifiers, a smaller harmful magnitude is better.

Large reward/Gacha batches group all copies of the same identity, remove strictly dominated candidates, compute the Pareto frontier, and show **only surviving incomparable candidates** when player choice remains. The current retained copy is first/default when it survives. If it is dominated and multiple new candidates remain, highest EchoScore may supply the deterministic default without redefining superiority.

A reward/Gacha result with unresolved choices is persisted as one **pending settlement** until accepted. Closing/reconnecting does not lose it. V1 does not start another reward-bearing match or permit further Gacha pulls while such a settlement remains unresolved.

The store is intentionally framed as the **Gacha Store**. V1 uses:

```text
1 pull   = 10 Middle Fingers
10 pulls = 100 Middle Fingers
```

There is no ten-pull discount or bonus roll; a ten-pull is mechanically ten sequential singles sharing the same pity state.

Lucky-or-better means `EchoScore >= 1.00`. Gacha pity is **paid-pull-only**: match reward acquisitions neither advance nor reset it. Any natural or rescued Lucky/Cheater paid pull resets the counter.

V1 uses a **50-pull hard guarantee** and **power-12 nonlinear soft pity**. With `n` consecutive non-Lucky+ paid pulls already suffered:

```text
r(n) = (n / 49)^12
P_lucky+(n) = P0 + (1 - P0) × r(n)
```

for `0 <= n <= 49`, where `P0` is the ordinary generator's natural Lucky+ probability. The 50th consecutive paid pull is guaranteed Lucky-or-better if the ordinary roll does not qualify. Rescue/guarantee samples from the ordinary acquisition distribution conditioned on `EchoScore >= 1.00`.

There is **no Cheater pity or Cheater guarantee**. The relatively generous Lucky protection is intentional for the friends-oriented V1 and remains versioned balance data that may be retuned after playtesting without reopening Echo identity architecture.

### 23.12 Echo collection and saved sets

Standard PvE equipped set size is **7 Echoes**. Players may maintain multiple named saved seven-Echo configurations; **Echo Sets** is the accepted provisional V1 player-facing name.

An Echo Set references Echo identity IDs rather than frozen historical rolls. When duplicate resolution changes the retained roll for an identity, every Echo Set using that identity automatically uses the newly retained roll.

The player-facing collection surface is **Echoes**, not `Inventory`. It uses a card grid, supports search by generated name/character/stat-token text and mechanical effect/stat key, multi-select filtering by mechanical effect/stat key, favorites pinned/promoted ahead of ordinary results, and useful EchoScore/quality sorting. Unknown Echo silhouettes/Pokédex-style empty slots are not required.

PvP progression/loadout standardization remains deliberately deferred.

### 23.13 Accepted first-catalogue mechanics from the current design pass

The following Origin mechanics are now accepted catalogue content. The detailed catalogue, temporary IDs, current builder budget, and current point values are maintained in [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md); provisional values remain subject to playtesting without reopening the mechanic itself.

#### Neutral settlement efficiency — provisional 5 points

Neutral settlement costs **0.5 Population per successfully acquired population-bearing neutral cell instead of 1**. Payment uses the faction-level persistent fractional residual from §10.5; ending/recreating expansion operations cannot erase the unpaid half.

#### Fortified amphibious landings — provisional 7 points

Transport embarkation receives a **+250 FFY** cost modifier and each successful amphibious landing grants a permanent level-1 Fort as defined in §16.2.

This modifier stacks additively with the existing `+500 FFY Transport embarkation cost` drawback, producing `750 FFY` when both are selected.

#### Elastic automatic defense — 10 points

When one of the faction's automatically defended population-bearing cells is captured, its one automatic defender **survives and remains/returns Available** instead of being killed.

The attacker still pays the ordinary 1-Population defended-capture casualty, ownership still transfers, and Capacity still transfers normally. The trait therefore lets the faction trade geography for enemy Population without receiving free territory or free defensive pressure.

#### Split strategic origin — 10 points

The faction uses **two spawn influence areas**, each with **50% of the normal influence area**, and chooses one exact origin inside each final area.

If the ordinary influence shape is circular, half the area corresponds to approximately `70.71%` of the ordinary radius; the trait halves **area**, not radius.

The faction's final Initial Territory quota is split approximately equally between two compact starting footprints around the two origins. Its total Starting Population remains **one unchanged global Population pool** calculated from its final modified Initial Territory and Starting-Population modifiers; there are no local Population stores tied to the two blobs.

The two influence areas/origins may be far apart or close together. If footprints grow into one another they may merge normally. The split creates strategic risk through two borders/geographic problems rather than through an artificial Population penalty.

For deterministic placement of singular granted start-state structures/effects, the two origins are ordered as **primary** and **secondary** unless the granting effect defines another rule.

#### Giant single-charge SAM shield — provisional 6 points

SAM Launchers use the transformed shield behavior from §18.3: provisionally +50% range, exactly one charge at every level, and 2× ordinary recharge cooldown. Upgrades continue to improve range but never add charges. No bespoke controller interception command is introduced.

#### Fully developed City purchases — provisional 6 points

Purchased Cities follow §18.4: they can only be bought directly at level 5 for 95% of the ordinary cumulative level-1-through-level-5 cost. Captured lower-level Cities are not auto-promoted.

#### Heavy Artillery — provisional 8 points

Every baseline Tank is transformed according to §18.6: 10-second construction, `1.5×` purchase cost, half movement, 50% more range, enormous alpha with 12-second reload, and no Train raiding. This is a doctrine transformation of the one baseline Tank unit, not a separate normally purchasable unit class. Its `1,000 Population / 12s` attack intentionally retains the baseline Tank's `83.33 Population/s` sustained direct Population DPS while changing the cadence to large alpha/long reload.

#### Radioactive Munitions — provisional 9 points

Successful Tank/Heavy-Artillery Population attacks use the radioactive territorial-neutralization rule from §18.6: up to 10 affected population-bearing cells for a Tank and up to 50 for Heavy Artillery, with deterministic bounded target-centered footprints. The trait does not modify anti-armor attacks or Train raids and does not add a second direct Population-damage multiplier.

### 23.14 Accepted cross-trait interaction rules

Combination legality remains universal; these interactions are therefore part of the public rules rather than compatibility exceptions:

- Transport FFY-cost traits stack **additively** from the baseline 0-FFY embarkation cost.
- A granted fortified-landing Fort does not consume a separate `first Fort purchase free` entitlement.
- A free starting Missile Silo begins at **level 1** unless its granting trait explicitly changes level.
- A free-MIRV effect does **not** bypass the level-5 launcher requirement.
- A Warship granted Missile-Silo capability uses **Warship rank as effective Silo level, minimum 1**; a legal +2 maximum-rank modifier can therefore allow rank-5/MIRV-capable Warships.
- Warship purchase-resource transformations do not bypass the canonical **5-second Warship construction time**.
- A direct level-5 City purchase is a **purchase**, not a sequence of upgrade expenditures, for interactions with traits that prohibit FFY spending on upgrades.
- A first-City-purchase-free effect may waive the final FFY consumption while retaining the fully developed City's authored purchase/precondition threshold where specified.
- Initial Territory bonuses apply to the faction's **final** Initial Territory total before the split-origin trait divides that total between its two footprints; they do not duplicate the bonus once per blob.
- Starting Population is calculated from that final modified Initial Territory using the ordinary 50% baseline before explicit Starting-Population modifiers; the split-origin trait does not duplicate or localize the resulting pool.
- Heavy Artillery and Radioactive Munitions are independent legal traits and combine normally into radioactive Heavy Artillery; their current combined positive cost is 17.

---

## 24. Match observability

Because programming is the gameplay, observability is first-class. The system should expose replay, controller decisions/logs within limits, action failures/rejections, CPU/runtime-budget information, Population/FFY/territory histories, operation/counter-response histories, and post-match summaries.

Headless accelerated testing uses the same logical game rules as live matches.

### 24.1 Controller debug annotations

Controller debugging is core V1 authoring infrastructure. A controller may emit bounded **private debug annotations** that do not affect simulation state, including concepts equivalent to:

- named scalar/string metrics;
- log messages;
- cell/region highlights;
- Segment highlights;
- operation/unit/structure annotations;
- labels or markers for controller-derived concepts.

These annotations are visible only to the controller owner through the browser/replay debugger and must obey explicit output/size/count limits. They must not create public gameplay information or become a simulation input.

---

## 24A. Controller API contract — Accepted V1 direction

The controller API is the primary gameplay language. Its design objective is:

> **Expose facts, legality, geometry, generic algorithms, deterministic rules, and mechanical arithmetic generously; expose strategic judgments and future-state oracles sparingly or not at all.**

Players should win through better strategy and abstractions, not because they reimplemented flood-fill, A*, legality checks, blast geometry, or published combat equations.

### 24A.1 One deterministic entry point and explicit memory

The normal runtime model is the source-level contract already defined in `src/core/controller/ControllerApi.ts`: `decide(context)` operates on an immutable observation and explicit persistent `memory`. The public context is:

```text
game
me
factions
cells
segments
contacts
operations
structures
units
navigation
economy
rules
mechanics
events
lastDecision
random
limits
memory
directives
commands
debug
```

The API may use an official `defineController` helper or equivalent authoring wrapper, but that wrapper must not hide privileged strategy.

Faction observations expose public Origin identity/traits and effective mechanical modifier sheets. Controllers should not need to infer an opponent's Origin mechanics from outcomes.

### 24A.2 Persistent directives versus one-shot commands

The contract distinguishes:

- **persistent directives**, which remain active until changed, completed, invalidated, or explicitly ended; and
- **one-shot commands**, which are attempted once in the current transaction.

Persistent examples include offensive operations, neutral expansion, counter-responses, defense-priority policy, and ongoing unit movement/patrol/targeting.

One-shot examples include building/upgrading a structure, launching a strategic weapon, deliberate territorial relinquishment, team signaling, and capitulation.

Omitting an existing persistent directive from a later controller invocation does **not** implicitly cancel it.

### 24A.3 Controller-owned directive keys

Controllers may assign bounded stable string keys to their own persistent directives so ordinary code can update an operation without maintaining a fragile engine-generated ID solely for ownership bookkeeping.

The engine still maintains immutable internal operation IDs for observation, replay, incoming enemy-operation references, and deterministic identity.

### 24A.4 Population updates are explicit set-now changes

When a controller changes an operation to `N` committed Population, that decision sets the operation's current commitment to `N` immediately if valid. Combat casualties may later reduce it below `N`; the engine does **not** automatically refill the operation back to a desired target.

Replenishment requires a later explicit controller decision. This preserves instant commitment without reintroducing desired/actual Deployment machinery.

### 24A.5 Geographic data and selectors

The API should make raw strategic geography available without requiring computational-geometry boilerplate.

At minimum, legal cell facts include concepts equivalent to:

- stable cell ID and coordinates;
- terrain;
- Segment identity;
- ownership;
- fallout;
- population-bearing/conquerable/impassable/coast/shoreline facts;
- legally visible structures or tactical state where permitted.

The API should provide **serializable declarative selectors/regions** that can be composed from strategy-neutral mechanical predicates such as:

- explicit IDs;
- owner;
- Segment;
- terrain/fallout;
- coast/shoreline;
- conquerable/population-bearing state;
- simple geometric areas;
- unions/intersections/differences;
- legally visible structure/unit sets where appropriate.

Persistent simulation directives consume compiled/bounded selector data, not arbitrary user JavaScript callbacks executed by the 10 Hz simulation loop.

### 24A.6 Generic geographic queries are quality-of-life, not strategy

The engine/SDK should provide bounded deterministic factual operations equivalent to:

- neighbor/adjacency queries;
- boundary extraction;
- connected components/flood-fill;
- ordinary distance queries;
- generic land/naval/rail reachability and pathfinding;
- nearest/reachable queries;
- Segment/owner/terrain histograms and summaries;
- legal structure sites;
- legal transport/coast destinations;
- other generic geometry/legality calculations.

These do **not** include strategic judgments such as `weakestPoint`, `bestTarget`, `bestNukeTarget`, `optimalAttackPopulation`, `safestTradeRoute`, or `biggestThreat`.

Advanced controllers may request bounded batch/materialized cell data for custom analysis, but materialization/output limits are explicit and deterministic. The API should not encourage object-per-cell scans of the entire map every decision.

### 24A.7 Segments and Contacts are first-class

Segments must be convenient enough that a competent controller can remain mostly Segment-level. Segment observations should expose factual summaries such as cell/terrain counts, ownership shares, adjacency, coast/fallout counts, and selectors for their cells.

Territorial Contacts are also first-class factual adjacency geometry. The API may expose contact size, disconnected components, involved Segments, terrain composition, and boundary selectors.

It must not expose a canonical strategic `Front`, `weakest contact`, `best breakthrough`, or similar policy judgment.

### 24A.8 Offensive spatial control has selection and weighting

Land operations conceptually expose two distinct strategy-neutral spatial controls:

1. **engagement priority** — which legal candidate lanes/cells are selected when committed Population cannot engage the whole candidate frontage; and
2. **pressure weighting** — how finite committed Population is distributed across the engaged geometry.

Both receive deterministic defaults so simple attacks need specify neither. Advanced controllers may express bounded rules over selectors/regions rather than enormous per-cell maps.

### 24A.9 Defense exposes priorities, not quantities

The defense API exposes only priorities/weights deciding **which threatened cells receive scarce one-Population automatic defenders**.

It cannot directly choose defensive Population quantities, stack multiple passive defenders on one cell, or arbitrarily divert the automatic contact-surface apportionment toward a chosen enemy.

Explicit counter-responses are the mechanism for deliberately spending extra Population against an incoming operation.

### 24A.10 Counter-response API remains simple

A controller counter-response identifies an incoming operation and commits Population to it. The nonlinear exchange math remains an engine rule; controllers are not required to reproduce it merely to use the mechanic.

### 24A.11 Public rules and pure mechanics calculators

The API exposes the current match's actual rule-bearing constants/feature flags and **pure deterministic mechanical calculators** for published arithmetic/geometry, such as concepts equivalent to:

- Population growth arithmetic, including the faction's Origin-defined growth profile;
- neutral-settlement progress and effective Population cost, including fractional residual semantics;
- capture-advantage arithmetic;
- counter-response exchange arithmetic;
- structure/unit/weapon costs, level gates, construction times, and legality;
- weapon blast/range geometry;
- explicit terrain/structure/Origin/Echo modifiers.

These calculators operate only on supplied/legal information and must not leak hidden canonical state.

Do **not** provide future-state strategic simulators/search oracles such as `simulateNextMinute`, `expectedWinner`, `bestAttack`, or `optimalCounterSize`.

### 24A.12 Public structures, units, and weapons follow game concepts

The public API should expose distinct game-level structure/unit/weapon concepts even if inherited engine internals share one implementation class.

Own objects expose the state needed to control them; enemy objects expose only legally observable state.

Movement and routing APIs are intent-oriented: controllers choose destination/patrol/target and the engine performs ordinary pathfinding/mechanical movement. Tank/Heavy-Artillery movement and targeting remain strategic/autonomous rather than per-shot RTS micro.

Structure observations/legality expose the canonical level range `1..5`, effective level-dependent mechanics, construction/upgrade state, and surfaced Origin transformations such as single-charge SAMs or direct level-5 City purchases.

### 24A.13 Corresponding legality queries

Major player actions should have factual legality/cost helpers where useful. A player should be able to ask whether/where a structure can be built, whether a weapon/unit is in range, whether a coast is reachable, what an upgrade/unit purchase costs, what its construction time is, what Transport embarkation costs after modifiers, or which launcher level a weapon requires without attempting actions blindly.

These helpers answer **what is legal**, not **what is strategically best**.

### 24A.14 Events since the previous decision

Controllers receive a bounded typed event stream covering legally observable meaningful changes since the previous controller invocation, such as territory changes, Population losses, neutral-settlement costs, operation lifecycle events, structure completion/destruction/level changes, unit construction/combat/repair changes, FFY events, hostility changes, faction defeat/capitulation, amphibious Fort creation, and strategic-weapon events.

This is quality-of-life so every controller does not need to diff the entire world snapshot manually. Persistent long-term interpretation remains controller strategy/memory.

### 24A.15 Decision receipts and directive lifecycle

`lastDecision` or equivalent exposes structured transaction status and per-command/rejection metadata. Ordinary gameplay failures are data rather than exceptions.

Persistent directives expose deterministic lifecycle/status such as active, blocked/no-actionable-geometry, completed, target-defeated, or otherwise invalidated. Obviously dead directives are garbage-collected by the engine and surviving committed Population returns according to ordinary rules; controllers are not required to manually collect stale engine records.

### 24A.16 Deterministic randomness

Randomized controller strategy is allowed through deterministic match-bound randomness. `Math.random()` may be replaced/seeded deterministically inside the sandbox, and the API should also provide **keyed deterministic randomness** so unrelated random calls do not perturb every later strategic choice.

No uncontrolled entropy or real system clock is exposed.

### 24A.17 Runtime/controller limits are public

Deterministic **structural** limits are public controller/API facts. The V1 `ControllerLimitsView` values are:

| API field | V1 value |
| --- | ---: |
| `persistentMemoryBytes` | **131,072** |
| `queriesPerDecision` | **128** |
| `materializedCellsPerDecision` | **25,000** |
| `directiveUpdatesPerDecision` | **128** |
| `commandsPerDecision` | **64** |
| `policyRulesPerDecision` | **256** |
| `debugItemsPerDecision` | **256** |
| `logBytesPerDecision` | **8,192** |

The runtime also bounds observable events to **512 per decision** with deterministic overflow handling and team-signal payloads to **1 KiB**.

Controllers must not branch on nondeterministic wall-clock CPU time remaining. The accepted callback/module/heap/whole-output limits are runtime enforcement documented in Section 8 and the integration plan; human diagnostics may report runtime usage separately.

### 24A.18 Team coordination

Fixed teammates share legal operational observations as defined above and may exchange small bounded deterministic JSON-like team signals. Team signals are delayed to a deterministic later decision boundary so same-tick execution order does not matter.

There is no unrestricted shared mutable controller memory.

### 24A.19 SDK convenience versus strategy

The official SDK may provide pure helpers/builders for selectors, priorities, deterministic math, common collection manipulation, percentages/ratios, and other neutral ergonomics.

It should not ship privileged strategy functions such as `pickWeakestEnemy`, `turtle`, `blitz`, `bestNukeTarget`, or equivalent doctrine. Players may freely build those abstractions themselves.

### 24A.20 Three-phase strategic spawning

Ordinary Open Fufu games should generally use a **three-phase strategic spawn protocol**. Random and fixed spawn modes remain supported alternatives.

The normal strategic protocol is:

```text
STATIC MAP / MATCH CONFIG
        ↓
PHASE 1 — initial broad influence choice
        ↓
all Phase-1 influence areas are revealed
        ↓
PHASE 2 — optional simultaneous reconsideration
        ↓
all final influence areas are revealed
        ↓
PHASE 3 — exact spawn-origin choice inside final influence area
        ↓
exact origins resolve simultaneously and are revealed
        ↓
initial territory footprints are generated
        ↓
MATCH STARTS
```

#### Phase 1 — initial broad influence choice

Each participant receives the static map, Segments, ruleset/lobby constraints, legal spawn-space information, **every participant's surfaced Origin, Initial Territory value, Starting Population effects, and any other strategically relevant public spawn-affecting modifiers**, and other pre-match public facts. Each simultaneously chooses a broad **spawn influence area** or its anchor using a ruleset-defined shape/scale.

Influence areas are **not exclusive claims or territory**. They are legal search spaces for the later exact spawn origin, and they are allowed—indeed expected—to overlap with other participants' influence areas.

After every Phase-1 choice resolves, all participants see every participant's Phase-1 influence area.

The accepted **split strategic origin** trait changes this participant-specific profile from one ordinary influence area to **two influence areas, each 50% of ordinary area**. Both Phase-1 areas are submitted simultaneously and both are revealed with the rest of the Phase-1 set. If the shape is circular, each split area's radius is approximately 70.71% of ordinary radius.

#### Phase 2 — optional reconsideration

Each participant gets exactly one simultaneous chance to keep or change their broad influence choice using the newly revealed information about everyone else's Phase-1 intent.

Participants do **not** see other Phase-2 revisions while choosing their own. After Phase 2 locks, all final influence areas are revealed together. There is no endless counter-picking loop.

This second broad-choice round exists specifically so one unlucky or poorly informed initial preference does not feel like an irreversible pre-match mistake.

A split-origin faction likewise keeps/revises its **pair** of influence areas simultaneously; it does not receive extra sequential reaction rounds.

#### Phase 3 — exact spawn origin

Each ordinary participant simultaneously chooses an exact legal **spawn origin cell** inside their final influence area while knowing all final influence areas.

A split-origin faction instead chooses **one exact legal origin in each of its two final influence areas**, submitted simultaneously. The two origins may be near each other or far apart and are not forced into different map regions merely to make the trait dramatic.

Exact-origin conflicts/collisions are resolved deterministically from the simultaneous submissions. All final exact origins are then revealed before the first normal simulation decision, consistent with globally visible territorial ownership once the match begins.

The controller chooses origin cells, not arbitrary hand-painted starting territory.

### 24A.21 Initial Territory and starting footprint

Each faction has a surfaced **Initial Territory** starting-state value equal to the target number of population-bearing cells it should own when the match begins.

The ordinary V1 base value is **1,000 population-bearing cells**. Explicit Origin traits or other surfaced starting-state modifiers may change that value in modes where such modifiers are allowed.

After exact spawn origins resolve, the engine deterministically paints a **compact, connected, roughly circular starting footprint** outward from each ordinary origin using nearby legal population-bearing cells.

For a split-origin faction, compute its **final Initial Territory value after all ordinary modifiers**, then divide that quota approximately equally between the two origins and grow two compact footprints simultaneously with every other faction's footprint. A one-cell remainder uses a deterministic primary/secondary rule. The two footprints may later meet/merge.

Important rules:

- broad spawn influence areas do not reserve cells and overlap between influence areas does not itself reduce anyone's Initial Territory;
- competing starting footprints are resolved simultaneously rather than by player/controller execution order;
- when the legal map topology can support it, footprint resolution continues outward as necessary so each faction receives its full Initial Territory count even when nearby footprints compete for cells;
- the footprint algorithm must remain deterministic, versioned, and independent of controller execution timing;
- the final number of owned population-bearing cells becomes the faction's ordinary starting Population Capacity under the existing `1 owned cell = 1 Capacity` rule;
- an Initial Territory bonus does **not** change the Capacity value of individual cells and is not duplicated once per split-origin footprint;
- ordinary V1 **Starting Population equals 50% of final modified Initial Territory** before explicit Starting-Population modifiers, so a vanilla 1,000-cell start begins at 500 Population;
- Initial-Territory and Starting-Population modifiers are separate axes: Initial Territory changes starting owned cells/Capacity first, then Starting-Population modifiers specialize the Population amount derived from that final territory;
- a split-origin faction has the **same one global Starting Population pool** calculated from its final total; Starting Population is not divided into local stores;
- an Origin/Echo may explicitly modify Starting Population as a percentage or other surfaced starting-state rule without changing Capacity-per-cell;
- Initial Territory does not automatically enlarge the broad spawn-influence radius unless an explicit future modifier says so.

For deterministic singular start-state grants on a split-origin faction, origins are ordered primary/secondary and the grant uses the primary origin unless the grant defines a different public rule.

The accepted ordinary influence radius, exact-origin spacing, deterministic hook fallbacks, stable tie-hash domains/orderings, conflict resolution, simultaneous quota-limited multi-frontier footprint construction, fixed-point P54 star rasterization, diagnostics/replay binding, five-second spawn immunity, and resolver-version semantics are specified in [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md). Implementation may choose equivalent internal data structures only where they preserve that canonical observable ordering and output; the resolver algorithm is no longer an open design question.

### 24A.22 Spawn modes and controller lifecycle

Open Fufu supports at least:

- **Strategic Spawn** — the three-phase protocol above and the ordinary preferred mode;
- **Random Spawn** — deterministic match-seeded legal placement that bypasses controller strategic spawn choices;
- **Fixed Spawn** — exact configured starts for benchmarks, certification, debugging, tournaments/scenarios, and reproducible tests.

Strategic-spawn controller hooks are specialized **pre-match lifecycle hooks**, separate from the normal `decide()` loop. `src/core/controller/ControllerApi.ts` defines the V1 hooks as `chooseInfluence`, `reconsiderInfluence`, and `chooseOrigins`, corresponding to initial influence choice, optional reconsideration, and exact-origin choice.

The spawn API must represent the faction's effective public **spawn profile**: ordinary factions submit one area/origin while a split-origin faction submits the required pair through the same phase semantics. This must not require a second controller program or an out-of-band manual action.

A controller is not required to implement spawn-specific logic. Missing, malformed, rejected, or failed spawn-hook output falls back to a deterministic legal default policy appropriate to that faction's spawn profile rather than faulting the controller for the match.

---

## 25. Deliberately deferred or implementation-level systems

The following remain intentionally outside the settled design contract unless otherwise stated above:

- future controller-API-version additions or non-semantic ergonomic polish after implementation pressure-testing; the current V1 TypeScript contract itself is already defined in `src/core/controller/ControllerApi.ts`;
- later playtest repricing of provisional Origin-trait costs or future catalogue additions without reopening accepted mechanics;
- exact wire protocol/session encoding and the remaining Discord/session/auth transport details;
- playtest retuning of accepted provisional terrain, structure, economy, Population, combat, mobile-unit, naval, strategic-weapon, spawn-geometry, Origin, and Echo balance values after representative implementation exists;
- later benchmark-driven **versioned tuning** of the accepted controller runtime limits or worker-pool deployment settings; the V1 baseline values/architecture are not deferred;
- exact Echo visual recipe/rendering implementation and final card-motion/glow/aura/responsive/touch polish;
- executable/property-test implementation for Echo distribution, scoring, generated naming, Middle Fingers accounting, rewards, pending settlement, Pareto resolution, saved-set propagation, and Gacha pity;
- authored anime dialogue/catchphrase/reference curation for Origin traits and Official Origins; V1 Echoes deliberately do not depend on an anime quote/subtitle corpus;
- final Tank/Train pursuit/interception feel after implementing the settled physical Train and armored-unit rules;
- detailed lobby/UI implementation outside the settled gameplay/content concepts;
- supply/logistics connectivity as a separate system.

The concrete V1 controller API, sandbox/runtime budgets, worker-pool baseline, SQLite schema/index/backup/retention model, and the detailed gameplay values previously tracked as open are now accepted specifications. Their remaining work is implementation, validation, and later evidence-driven tuning rather than architecture selection.

Supply is explicitly deferred from V1. Do not introduce hidden supply roots, path-distance logistics, or supply penalties under another name.

---

## 26. Canonical invariants summary

1. **The server owns the match.** Browsers are not simulation authorities.
2. **The controller may fail; the match must continue deterministically.**
3. **Controllers receive deterministic immutable observations and explicit persistent per-match memory.**
4. **The public controller API exposes legal observations and declarative directives/commands, not mutable engine internals.**
5. **Generic geometry, pathfinding, connected-components, legality, and published formula calculation are quality-of-life primitives; strategic recommendations/oracles are not.**
6. **Persistent directives survive omitted future decisions; one-shot commands do not.**
7. **Controller decisions validate as a transaction/final desired set rather than source-order simulation mutations.**
8. **Cells are the physical territorial resolution; Segments are immutable strategic lenses.**
9. **Every real map cell belongs to exactly one Segment.**
10. **Population is one global whole-integer faction resource; explicit fractional mechanic costs use deterministic hidden residuals rather than fractional public allocations.**
11. **Population Capacity equals owned population-bearing cells exactly.**
12. **Initial Territory may change starting owned-cell count but never changes the one-Capacity-per-owned-cell rule.**
13. **There is no persistent defensive cell Population allocation.**
14. **Automatic defense is binary per threatened owned cell: 0 or 1 Population, never more than 1.**
15. **Available Population limits how many threatened cells may receive that one automatic defender; surplus Population does not stack passive defense.**
16. **Controller defensive priorities choose which scarce threatened cells are defended, not raw defensive Population quantities.**
17. **Counter-responses spend committed Population to fight an incoming operation's committed Population directly; they do not reinforce passive cell defense.**
18. **Offensive Population is committed instantly to sparse operations with spatial intent.**
19. **An operation's engaged frontage cannot exceed its committed Population.**
20. **One faction's source cell attacks at most one adjacent target cell per tick, and same-faction pressure is never duplicated.**
21. **A cell changes political owner at most once per tick; new captures do not chain within that same tick.**
22. **Baseline neutral settlement takes capture progress/time and costs one Population from the expansion commitment per successfully acquired population-bearing neutral cell.**
23. **Neutral territory has no phantom automatic Population defender; fractional settlement modifiers use faction-level persistent residual accounting.**
24. **Ordinary hostile defended-cell capture costs one Population to the previous owner and one to the winning attacker, unless an explicit defender-survival trait preserves the automatic defender; the attacker's casualty remains.**
25. **Hostile undefended territorial capture causes no ordinary capture-coupled Population casualty; this does not waive neutral-settlement cost.**
26. **An unsuccessful third-party claimant on the same contested cell takes no capture-coupled casualty merely for contesting it.**
27. **Other explicit mechanics such as counter-responses, nukes, neutral settlement, transport destruction, and Tank Population attacks may reduce Population without ordinary hostile defended-cell capture.**
28. **Standard nuclear strikes neutralize affected owned population-bearing land, cause one current-Population loss per affected owned population-bearing cell, and apply Fallout while preserving underlying terrain classification.**
29. **Fallout changes capture resistance, not automatic defensive Population, and is an overlay rather than a replacement base terrain.**
30. **Water Nukes are an optional default-OFF V1 ruleset: each weapon's fully affected inner blast zone converts eligible land/Shallow Water to permanent Deep Water, while the outer blast annulus keeps ordinary neutralization/Fallout; converted terrain immediately changes Capacity, conquest denominator, pathing/naval/coast topology while Segment identity remains immutable.**
31. **Terrain/structures/Origins/Echoes affect mechanics only through explicit surfaced rules.**
32. **The eight canonical V1 persistent structures—City, Fort, Port, Factory, Missile Silo, SAM Launcher, Observation Post, Command Post—are upgradeable from level 1 through a hard maximum of level 5.**
33. **City levels increase Growth, Fort levels increase defense/coverage, Factory levels increase industrial FFY and armored-unit repair capacity, Port levels increase repair capability, SAM levels increase normal range/charges, Silo levels increase charges/weapon access, Observation Post levels increase observation radius, and Command Post levels increase source-offense support/coverage.**
34. **Missile Silo level 1 unlocks Atom Bomb, level 3 unlocks Hydrogen Bomb, and level 5 unlocks MIRV. Free/granted weapons do not bypass launcher legality.**
35. **MIRV requires a level-5-equivalent launcher and uses the accepted static 50m FFY baseline, up to 250 independently resolving small warheads over the canonical 750-cell distribution radius; detailed projectile/interception values live in `NAVAL_AND_STRATEGIC_WEAPONS.md`.**
36. **Where a Warship is granted Missile-Silo capability, its effective Silo level equals Warship rank with a minimum of 1.**
37. **Transport embarkation begins at 0 FFY and explicit Transport-cost trait modifiers stack additively.**
38. **The accepted fortified-landing trait adds +250 FFY and grants a permanent level-1 Fort only after a successful landing.**
39. **Every faction binds exactly one immutable Origin for a match.**
40. **Official Origins and Custom Origins obey the same public Origin-builder rules and use the same deployed trait catalogue.**
41. **Origin traits are curated server-defined packages with authored costs; players never supply Origin formulas or arbitrary trait code.**
42. **Origins have no tiers, Major/Minor taxonomy, category maze, or hidden pairwise incompatibility system.**
43. **Every deployed trait combination satisfying the public budget, trait-count, and drawback-refund limits is legal.**
44. **Every candidate Origin catalogue is exhaustively tested across all public-legal trait combinations before deployment; a failing combination blocks/fixes the catalogue rather than becoming a production exclusion.**
45. **The accepted split-origin trait uses two half-area influence regions and two exact origins, splits final Initial Territory between two footprints, and still uses one global Starting Population pool calculated from the faction's final starting-state rules.**
46. **The accepted elastic-defense trait preserves the automatic defender when a defended cell is captured while retaining the attacker's ordinary casualty and all ownership/Capacity effects.**
47. **The accepted giant-SAM trait transforms SAM throughput/range without adding a bespoke controller interception action.**
48. **The accepted fully-developed-City trait makes purchased Cities direct level-5 purchases at 95% cumulative ordinary level-1-through-level-5 cost.**
49. **Echoes use 12,927 fixed mechanical identities built from 93 concrete stat+scope keys; identity fixes shape/stat keys/polarity, magnitudes reroll on every acquisition, standard PvE equips 7 Echoes, and names are deterministically generated from stable character/stat components plus roll-dependent magnitude descriptors rather than authored dialogue assignments.**
50. **Echo acquisition uses 50% mixed / 35% dual / 15% single shape selection, uniform identity selection within shape, EchoScore-weighted integer magnitude rolls, Trash→Cheater rolled-quality tiers, one retained roll per identity, tier-based Middle Fingers salvage, Pareto filtering with only incomparable survivors shown, pending batch settlement, all earned match rolls as drops even on defeat, fixed-human-team full-pool rewards, and a 10/100-Middle-Finger Gacha Store with paid-pull-only power-12 Lucky+ pity guaranteed by pull 50 and no Cheater guarantee.**
51. **V1 Echoes carry no authored anime dialogue/voice-line corpus. Their generated naming uses the accepted versioned 10/10/10 shape-character pools, one authored token per 93 concrete stat keys, the Catastrophic→Absurd `-6..+6` polarity-aware descriptor table, and fixed Single/Dual/Mixed grammars; authored anime dialogue/reference effort is reserved for Origin traits and Official Origins.**
52. **Saved seven-Echo configurations are provisionally named Echo Sets; replacing a retained roll automatically updates every Echo Set referencing that identity.**
53. **An Echo's mechanical identity plus character/stat naming components remain stable under a naming version; retained magnitude changes may alter its generated adjective(s), while rolled quality separately changes the border/effects treatment from dull Questionable to extravagant Cheater.**
54. **Strategically relevant active mechanical modifiers, Origins, and Origin trait sheets are publicly surfaced.**
55. **Derived controller helpers never leak information outside the controller's legal observation projection.**
56. **Fixed teammates share legal operational observations and may exchange bounded deterministic delayed team signals.**
57. **Controller debugging/visual annotations are private, bounded, deterministic output and never simulation input.**
58. **Ordinary FFY has a flat non-Population universal 1,000 FFY/s floor plus explicit event-driven economic sources; it is not passive Population taxation/assignment, and build-facing FFY modifiers prefer broad source families over hyper-granular event-specific knobs.**
59. **FFA is truly competitive among non-team factions; fixed teams are the only formal alliance relationship.**
60. **Zero population-bearing territory after tick resolution means immediate defeat.**
61. **Capitulated/resigned factions stop growth and decision-making, remove mobile/offensive active behavior, but retain territory and surviving passive Population defense until conquered.**
62. **Official AI obeys the same gameplay information and mechanics as player controllers; the provisional character roster, shared Origin pools, difficulty targets, and difficulty-derived Echo reward contribution live in `OFFICIAL_AI_PRESETS.md`.**
63. **Ordinary users cannot live-spectate unrelated matches.**
64. **Historical matches bind exact rule-bearing versions.**
65. **Ordinary Strategic Spawn uses two simultaneous broad-choice rounds with a reveal between them, followed by simultaneous exact-origin choice; broad influence areas may overlap and are not territorial reservations.**
66. **A public spawn-profile modifier may change one ordinary area/origin into the accepted two-half-area/two-origin profile without changing the phase/reveal fairness model.**
67. **Initial territory is generated deterministically around exact spawn origin(s), ordinarily as compact footprint(s) but with explicit public geometry transformations such as P54; every legal profile preserves the faction's Initial Territory quota whenever the map can support it.**
68. **Random and Fixed spawn modes remain supported alongside Strategic Spawn.**
69. **One canonical design document governs the target; one canonical integration plan governs the migration; `TERRAIN_AND_STRUCTURES.md` is the canonical detailed data appendix for accepted terrain/structure/Tank values.**
70. **Tundra and Shallow Water are conquerable but non-population-bearing; Tundra is unbuildable and Shallow Water is an unbuildable land-operation/naval crossing terrain.**
71. **The Tank is the sole baseline persistent land military unit: Factory-produced in 5 seconds, autonomous/strategic rather than RTS-microed, able to fight armor, raid Trains, and attack Population without capturing territory; Mountain and Shallow Water are armored barriers.**
72. **P43 transforms every Tank into 10-second Heavy Artillery with higher cost, half movement, longer range, huge alpha/long reload, disabled Train raiding, the same movement barriers, and projectiles that may cross those barriers; its 1,000/12s Population attack retains the Tank's sustained direct Population DPS rather than quadrupling it.**
73. **P44 costs 9 Origin points and makes successful Population attacks neutralize/apply Fallout to up to 10 eligible cells for Tanks or 50 for Heavy Artillery; it is independent of and legally combinable with P43.**
74. **Purchased Warships have a 5-second construction delay at a Port; purchase-resource/cost transformations do not bypass it unless explicitly stated.**
75. **Ordinary V1 maps have exactly 4,800,000 raster cells; population-bearing-cell count is map-dependent and alternate gameplay resolution scales are not supported.**
76. **Ordinary V1 Initial Territory is 1,000 population-bearing cells. Starting Population is 50% of final modified Initial Territory before explicit Starting-Population modifiers, so vanilla starts at 500/1,000.**
77. **Ordinary Population base growth is exactly `0.05 × Capacity^0.75` Population/s, with piecewise-linear utilization anchors and a 40–60% maximum-efficiency band; P02 horizontally widens that band to 30–70%.**
78. **Factory Trains use finite multi-stop closed service tours at a provisional 25 cells/s: one primary Train per Factory, up to five deterministic target stations per route-construction pass, every actual City/Port pass produces an event and 1.5s dwell with no hard event cap, the Factory waits 5s after return/destruction, P07 adds one bonus Train every fourth primary dispatch, P33 adds `20 × City level` Capacity-capped Population per qualifying City event, and the ordinary Factory-level Train-event FFY ladder is `10,000 / 11,250 / 12,500 / 13,750 / 15,000`.**
79. **Controller memory uses the accepted canonical compact UTF-8 JSON whole-object replacement codec with a 128 KiB canonical-byte limit; valid memory may commit across ordinary gameplay rejection, while runtime/malformed-output faults preserve the previous committed memory.**
80. **Segments are immutable map-compiled cardinally connected geography-first strategic regions with a soft ~4,096-cell target and no hard size/aspect-ratio/compactness limits; final membership is versioned in the map artifact, and V1 adds no semantic geographic tags.**
81. **Canonical archival replays are minimal compressed deterministic input/action records with no periodic full-state seek checkpoints; playback fast-forwards the deterministic simulation from match start and does not require re-executing player controllers or persisting controller memory/debug state.**