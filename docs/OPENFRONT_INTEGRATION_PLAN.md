# Open Fufu — Canonical OpenFront Integration Plan

## Status and authority

This document is the **single canonical Open Fufu integration, migration, and upgrade plan** for transforming the current OpenFront fork into Open Fufu.

The target game design is defined by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), which remains the single canonical Open Fufu design contract and takes precedence over this document if the two ever conflict.

This document defines **how the existing OpenFront codebase should be reused, adapted, replaced, or extended to reach that target**.

Future accepted migration decisions must update this file rather than creating competing Open Fufu upgrade-plan documents. Older inherited OpenFront architecture/refactor documents remain useful evidence of the current/upstream implementation but are not normative for Open Fufu.

No gameplay implementation is authorized merely by the existence of this plan. Major migration stages still require explicit implementation approval.

Sections marked **Accepted** are settled migration direction. **Open** items remain to be decided or measured before implementation reaches them.

---

## 1. Audit conclusion — Accepted

The current fork is a strong basis for Open Fufu and should **not** be rewritten from scratch.

The migration strategy is:

> Keep OpenFront's dense cell/map engine, deterministic Execution machinery, pathfinding, generic units/structures, substantial naval/rail/strategic-weapon infrastructure, renderer foundations, useful lobby/network infrastructure, and test/performance tooling. Replace client authority, old combat/resource semantics, mutable diplomacy, and progression assumptions. Adapt the existing scalar troop/attack shape into Open Fufu's global Population plus sparse operation/frontage model rather than building a dense faction-by-cell Population field.

A useful inherited seam already exists between high-level inputs and deterministic `Execution` objects that mutate game state.

Current conceptual path:

```text
human input
→ Intent
→ Turn
→ Execution
→ Game mutation
```

Target conceptual path:

```text
controller observation
→ transactional controller decision
→ validated operation/action changes
→ deterministic simulation work
→ canonical Game mutation
```

---

## 2. Accepted subsystem classification

| Area | Migration classification |
| --- | --- |
| Dense cell/map representation | **Keep / Adapt** |
| Deterministic tick and Execution machinery | **Keep / Adapt** |
| Pathfinding, water connectivity, rail graph | **Keep** |
| Generic unit/build lifecycle | **Keep / Adapt** |
| Renderer, camera, map visualization foundations | **Keep heavily** |
| Lobby/roster/socket/routing/telemetry infrastructure | **Keep / Adapt** |
| Client-authoritative simulation | **Replace** |
| Turn relay as simulation authority | **Replace** |
| Client hash/winner/live-stat consensus as authority | **Remove** |
| Scalar `troops` storage concept | **Adapt into global whole-integer Population** |
| Current `Attack` object/lifecycle shape | **Reuse selectively** |
| Current `AttackExecution` combat semantics | **Replace substantially** |
| Passive worker gold | **Remove** |
| Current troop growth/capacity formulas | **Replace** |
| Global Easy/Medium/Hard gameplay difficulty scalar | **Remove** |
| Official-AI simulation cheats | **Remove** |
| Mutable alliances/relations diplomacy | **Remove** |
| Current partial-territory/overtime/doomsday victory rules | **Replace / Remove** |
| Dense defensive Population allocation field | **Do not build** |
| Desired/actual cell Redeployment subsystem | **Do not build** |
| Deployment/Redeployment Rate system | **Do not build** |
| Available/Committed Population accounting | **New / Adapt scalar troop plumbing** |
| Sparse offensive operations with spatial intent | **New / Adapt attack plumbing** |
| One-to-one engaged frontage lanes | **New / Adapt border plumbing** |
| Automatic contact-surface defense | **New** |
| Active counter-responses | **New** |
| Capture-coupled ordinary land casualties | **New** |
| Immutable strategic Segments | **New** |
| Runtime-derived Contacts | **New** |
| Secure operational visibility/observation model | **New** |
| Player controller runtime/sandbox | **New** |
| Controller publishing/certification/memory/diagnostics | **New** |
| Open Fufu FFY/items/progression | **New** |
| Open Fufu-owned SQLite persistence | **New / Adapt surrounding session infrastructure** |

---

## 3. Core/headless boundary — Accepted

OpenFront's shared deterministic core should remain the simulation foundation, but it must become genuinely browser-independent.

Required dependency direction:

```text
core simulation
    ↑
authoritative match runtime
    ↑
validated controller decisions

core-derived observer protocol
    ↓
browser participants
```

Existing imports from `src/client` into shared simulation code should be removed or moved behind neutral formatting/event interfaces.

### Acceptance condition

A Node/headless process can load a map, run a complete match, determine its result, produce a replay record, and replay that match without importing DOM/browser presentation code.

---

## 4. Server authority and process topology — Accepted

Each live match has exactly **one canonical authoritative server simulation**. Browsers never determine simulation progress, canonical hashes, winner state, or authoritative statistics.

### 4.1 V1 process model

The accepted V1 topology is **one OS child process per active authoritative match**.

```text
Browser / Foof
      |
   HTTPS / WS
      |
Open Fufu gateway/API/lobby
      |
Match supervisor
   |       |       |
Match A  Match B  Match C
process  process  process
```

Reasons include independent V8 heaps/GC, match-level crash containment, simple process termination/resource accounting, straightforward profiling/logging, multi-core CPU use, and acceptable fixed overhead for the expected small deployment.

Worker threads or pooled multi-match processes remain possible future optimizations only if measurements justify changing the topology.

### 4.2 Expected operating envelope

Planning assumptions:

- **1–3 concurrent matches** is normal;
- **4** should be rare;
- **5** should be very rare;
- higher numbers are not a useful V1 design target;
- total live human/browser participants/viewers across the service are expected to be roughly **5 or fewer** most of the time.

### 4.3 Benchmark before capacity claims

Benchmark the real authoritative Open Fufu simulation on Fufubox for at least 1, 3, and 5 simultaneous matches, controller runtime overhead, observer delta construction, and accelerated certification/batch mode.

Record mean/p50/p95/p99/max tick time, missed 100 ms tick budgets at provisional 10 Hz, CPU, RSS/PSS/heap, GC, active operation/frontage counts, observer bandwidth, and controller runtime cost.

The existing `tests/perf/fullgame` tooling is a strong starting point but will need adaptation.

---

## 5. Controller-runtime isolation — Accepted initial implementation direction

Player controller code must not execute with unrestricted access inside the canonical match process.

```text
Authoritative Match
       |
immutable legal observation
       |
controller worker-process pool
       |
V8 isolate (`isolated-vm` initially)
       |
proposed transactional decision
       |
validation
       |
canonical commit/reject
```

The accepted **first implementation to try** is `isolated-vm` inside separate dedicated controller-runtime worker processes, with explicit isolate memory/time/output/action limits and ordinary Linux process hardening. The match processes themselves do not host user isolates.

Do not grant untrusted code Node capabilities such as `require`, `process`, filesystem/network access, arbitrary host references, environment variables, or system time.

This is a pragmatic choice for a tiny authenticated friends-oriented service, not a claim that the package is an absolute security boundary. Benchmark and harden it before relying on it. A QuickJS-family runtime remains a possible later alternative if security/maintenance/performance measurements justify switching.

Do **not** assume one permanent OS process per controller. A reusable worker pool is preferred because persistent controller state is explicitly serialized by the game contract.

### Deterministic parallel execution

Controllers at the same decision tick may execute concurrently against immutable snapshots of the same canonical tick. Completion order must not create gameplay advantage; results are collected and committed deterministically.

---

## 6. Tick, decision, and Execution model — Accepted

Retain the deterministic Execution pattern rather than replacing it wholesale.

Open Fufu distinguishes lifecycle/admin commands, controller strategic decisions, and simulation state transitions.

A controller invocation operates transactionally against one immutable legal observation. On success, memory/operation/action changes commit together. On failure, temporary output is discarded.

Population commitment changes take effect immediately on successful decision commit; no land Deployment/Redeployment queue exists.

Provisional cadence remains:

```text
simulation: 10 Hz
controller decisions: 2 Hz
```

Accelerated simulations execute the same logical ticks without real-time waiting.

---

## 7. Map, cells, terrain, and Segments — Accepted

Retain/adapt the current dense integer `TileRef`/typed-array map substrate, compact terrain/state storage, deterministic adjacency, ownership mutation, water/pathfinding, authored map compilation/loading, impassables, and map-scale optimized iteration.

### 7.1 Segment layer

Add compact immutable Segment identity for every real map cell, including water and impassable terrain, plus immutable Segment metadata/adjacency. Segments remain query/strategy indexes rather than physical simulation buckets.

Dynamic terrain changes such as nuke-created waste/water do not regenerate Segment identity.

### 7.2 Future procedural maps

Procedural/random map generation is new and must deterministically produce terrain plus the same immutable Segment model from seed/version.

---

## 8. Ownership and neutral expansion — Accepted

Retain/adapt low-level cell ownership and incremental territory/border bookkeeping. Existing `conquer()`/`relinquish()`-style primitives remain useful.

Neutral expansion becomes an operation using ordinary Population and spatial intent. Neutral cells have no automatic Population defense and settlement does not inherit arbitrary old troop deaths.

---

## 9. Population state — Accepted

### 9.1 Global whole-integer Population

Adapt OpenFront's useful scalar troop-storage shape into one global deterministic whole-integer Population value per faction.

Faction Population state centers on:

```text
Total Population
Available Population
Committed offensive Population
Committed counter-response Population
Population aboard transports
Population Capacity
Growth state
```

```text
Total
= Available
+ attacks/expansion operations
+ counter-responses
+ transports
```

No separate Reserve pool exists.

### 9.2 Capacity from owned cells

```text
Capacity = owned population-bearing cells
```

For V1, one ordinary conquerable land cell contributes exactly one Capacity. Existing incremental territory counts should make this a cheap derived/read value.

Remove/avoid City Capacity bonuses, item max-Population/Capacity bonuses, terrain Capacity multipliers, and hidden faction Capacity multipliers. Cities move to growth effects.

### 9.3 Representation

Authoritative Population values should normally use `uint32`-compatible non-negative whole integers. Use deterministic fixed-point/residual state only where formulas require sub-unit precision.

---

## 10. No defensive occupancy field — Accepted

Do not implement persistent defensive Population on cells, Segments, Contacts, or fronts.

Available Population is one finite automatic defensive pool. Capacity creates no free defense: if current defensive Population is zero, baseline Population defense is zero even if territory remains.

Simulation should iterate primarily over active operations, their engaged frontier lanes/cells, active counter-responses, units, structures, and economic events rather than `factions × map cells`.

No dense Population matrix should exist.

---

## 11. Offensive operations, frontage, and land combat — Accepted

The OpenFront `Attack` concept is structurally closer to the target now, but its existing combat semantics are not authoritative.

### 11.1 Reuse selectively

Potentially reuse/adapt attack identity, owner/target linkage, committed scalar Population, lifecycle/execution plumbing, border/actionability helpers, deterministic cell traversal, and capture notifications.

Do not inherit old global defender formulas, old casualty formulas, bulk-conquest shortcuts, hidden large-faction bonuses, bot difficulty modifiers, or mutable-relation side effects.

### 11.2 Operation model

Conceptually:

```text
committedPopulation
target
spatialIntent
activeFrontGeometry
```

Population commitment changes are instantaneous at controller decision commit.

### 11.3 One-to-one engagement lanes

Resolve each operation's legal intent into one-to-one source→adjacent-target engagement lanes each tick.

Within one faction's resolved frontage:

- a source cell attacks at most one target cell in that tick;
- the same target cell is not duplicated by multiple source cells from that faction;
- other hostile factions may independently contest the same target cell;
- newly captured cells do not create additional same-tick lanes.

The number of engaged lanes is bounded by committed Population:

```text
engagedFrontage <= committedPopulation
```

If 800 Population is committed against a selected 1,000-cell legal frontier, at most 800 lanes engage. If 100k Population is committed across only 300 lanes, the excess Population creates concentration/pressure on those 300 lanes.

Operation pressure is distributed over engaged lanes according to controller weighting.

### 11.4 Contact-surface automatic defense

For a defender, count all currently incoming engaged hostile lanes. Spread finite Available Population across that engaged contact surface before applying terrain/structure/item modifiers.

```text
baseDefensePerIncomingLane
= AvailablePopulation / totalIncomingEngagedLanes
```

Therefore 300 Fufu lanes plus 100 Ski lanes naturally split Tanya's base defensive pool 3:1.

Inactive geometric border cells consume no defense.

A targeted counter-response removes Population from Available and adds finite targeted defensive pressure against one incoming operation.

### 11.5 Capture throughput

Freeze engagement geometry at tick start. A target cell changes owner at most once per tick and one lane yields at most one capture that tick.

Therefore an operation with 300 engaged lanes cannot capture more than 300 cells in one tick. Actual capture count is usually lower according to pressure advantage, terrain, structures, and tuning.

### 11.6 Capture-coupled ordinary land casualties

Delete the previous continuous casualty direction such as `2AD/(A+D)`.

For each **defended population-bearing cell** that changes owner:

- previous owner loses 1 current Population from Population participating in that defense;
- winning attacker loses 1 current Population from the capturing offensive commitment;
- previous owner Capacity -1;
- winner Capacity +1.

An undefended capture causes no ordinary land-combat Population casualty. Stalled/failed ordinary land pressure does not independently create Population attrition.

Other explicit mechanics such as nukes and transport destruction may reduce Population without a cell ownership change.

### 11.7 Multi-faction handling

Aggregate same-faction local pressure before resolution. Resolve all claimants from the same pre-state; strongest successful claimant wins a contested cell deterministically. The cell still flips only once.

The ordinary defended-capture casualty pair applies between previous owner and winning claimant. Other unsuccessful claimants gain no territory from that cell.

### Acceptance conditions

- same Population cannot be duplicated across operations/cells/opponents;
- 800 committed Population cannot produce more than 800 simultaneous engagement lanes;
- same-faction operation fragmentation cannot manufacture pressure;
- newly captured cells cannot chain-capture within one tick;
- zero current defense means zero baseline Population defense.

---

## 12. Population growth and Cities — Accepted

Replace current OpenFront troop growth/cap formulas.

Canonical direction:

```text
BaseGrowth
= Gref × Capacity^0.75

ActualGrowth
= BaseGrowth
× utilizationMultiplier
× explicitGrowthModifiers
```

Cities contribute to growth, **not Capacity**. Population-growth items may contribute explicit growth modifiers but Capacity/max Population remains territory-derived.

If Capacity is zero, growth is zero and no division by zero occurs.

Remove passive worker-gold coupling from Population entirely.

---

## 13. Structures — Accepted

Retain useful generic spatial structure lifecycle infrastructure: build legality, construction duration, under-construction state, ownership/capture, levels/upgrades, health/destruction, and type-specific behavior.

Initial semantic direction:

| Structure | Migration direction |
| --- | --- |
| City | **Growth**, not Capacity |
| Defense Post | Explicit local defense modifier |
| Port | Keep naval role; adapt trade/FFY |
| Factory | Preserve rail/economic identity initially |
| Missile Silo | Preserve weapon infrastructure |
| SAM Launcher | Preserve interception identity |
| Upgrades/levels | Keep framework |

No structure recreates hidden global Military Power.

---

## 14. Generic units, naval, amphibious, trade, and rail — Accepted

Retain/adapt the generic unit framework: stable IDs, ownership, movement, target state, health, deletion, transfer, construction, upgrades, and type-specific runtime state.

### Transport ships

Current transport payload maps naturally to committed Population. Carried Population is not Available for defense; a legal landing joins local offensive engagement. Transport destruction can explicitly kill carried Population.

### Trade ships and Ports

Retain the physical world-event model:

```text
Port
→ TradeShip
→ physical route
→ arrival/capture
→ FFY event
```

Replace alliance/embargo assumptions with fixed-team/FFA/`atWar` rules.

### Trains and rail

Retain useful physical/economic rail infrastructure and stop/arrival events. There is no hidden or explicit V1 land Deployment Rate for rail to modify.

### Warships

Retain/adapt patrol, combat, transport interception, piracy, retreat/repair, health, and veterancy where compatible.

---

## 15. Strategic weapons and SAM — Accepted core rule

Retain deterministic launch/trajectory/interception infrastructure: silos, missile flight, warning/visibility where allowed, SAM interception, detonation geometry, and structure/unit/terrain effects.

Replace old scalar-troop/attack-stack casualty handling and mutable-alliance side effects.

For nuclear-style terrain destruction:

> Each owned population-bearing cell turned into non-population-bearing nuclear waste/destroyed terrain removes **1 Capacity and 1 current Total Population** from that faction, capped at zero.

Cities do not add extra Population casualties; they affect growth, not Capacity.

Physical units, fleets, transports, structures, or offensive forces directly hit by the weapon may take their own explicit local damage in addition to this terrain-linked rule.

Exact radii, interception, physical-unit lethality, and terrain-destruction values remain tuning/translation work.

---

## 16. Teams, diplomacy, `atWar`, defeat, capitulation, and victory — Accepted

Retain fixed pre-match teams. Remove mutable alliance/relation diplomacy. FFA opponents remain legally attackable regardless of `atWar`; `atWar` is symmetric recent-hostility state rather than a permission gate.

Trade with enemies remains possible with the canonical explicit wartime penalty rather than ordinary embargo prohibition. Do not inherit troop/gold donations automatically.

### Defeat

After all same-tick ownership changes resolve, **zero owned population-bearing territory means immediate defeat**, regardless of remaining Population, operations, fleets, or transports. No comeback/dispossessed state exists.

### Resignation/capitulation

A resigned/capitulated faction keeps its owned territory, static structures, and surviving Population.

On resignation/capitulation:

- growth becomes permanently zero;
- controller decisions permanently stop;
- active land offensive/counter-response operations cease and surviving Population returns to Available;
- remaining Available Population continues automatic passive defense;
- territory remains capturable normally;
- no new strategic actions occur.

Exact inert/passive handling of inherited mobile units is deferred to unit translation, but they must not become new controller-driven activity.

Replace old partial-territory/overtime/doomsday victory rules with the canonical 100%-territory/opposition-defeated rules.

Detailed lobby UI/UX remains later product work.

---

## 17. Visibility and participant viewing — Accepted

OpenFront's client-replicated full simulation cannot securely enforce hidden operational information.

The authoritative match process generates legal controller/browser projections **before** information reaches the gateway/browser.

```text
canonical match state
    |
    ├─ Fufu legal observation
    ├─ Ski legal observation
    └─ official-AI legal observation
```

Use the same underlying projection rules for player controllers, official AI, and browser participant views.

There is **no ordinary third-party live spectator mode**. Users may view only matches they are actually participating in, including their own PvE matches, from their legal participant perspective.

Internal benchmark/certification/development tooling may use trusted omniscient observation where needed.

The gateway forwards legal projections rather than mirroring full secret state for client-side filtering.

---

## 18. Browser synchronization and rendering — Accepted

Keep OpenFront's rendering/camera/map/unit visualization foundations heavily where useful. Remove authoritative browser simulation responsibility.

The browser becomes primarily:

```text
participant match viewer
controller editor
debugger
replay viewer
loadout UI
lobby UI
```

Live connection/reconnect uses:

```text
authoritative legal snapshot
→ incremental observer deltas
→ fresh snapshot on resync if needed
```

Do not require a reconnecting browser to replay the entire historical turn stream.

Observer publishing must be optional in headless certification/batch simulations.

---

## 19. Replay, records, and crash behavior — Accepted direction

Preserve deterministic archive/replay philosophy but make the server the source of canonical state/hashes.

Archive exact committed controller decisions/operation changes so ordinary replay does **not** need to re-execute historical untrusted controller code. A stronger verification/debug mode may separately re-run archived controller/runtime versions and compare outputs.

V1 may treat an authoritative match-process crash as:

```text
match aborted
no progression reward
detailed crash record retained
```

Architect records so later replay-to-last-tick/checkpoint recovery remains possible, but crash-resume is not V1-required.

---

## 20. Authentication and identity — Accepted V1 direction

Open Fufu owns an internal user identity independent of a single provider.

V1 ordinary login uses **Discord OAuth2**:

```text
Discord identity
    ↓
Open Fufu OAuth callback
    ↓
internal OpenFufuUser
    ↓
Open Fufu session
    ↓
API / WebSocket
```

Do not use Discord's raw ID as the universal primary key for game data.

A later Fufubox/fufu-control challenge credential may link to the same internal user rather than creating a separate account universe.

Discord is used for login/session establishment or refresh, not every match tick/message; live matches must survive a Discord outage.

Match processes receive only internal game-facing identity/configuration data, never Discord access tokens.

Foof uses a scoped service/API credential rather than database access.

Exact cookie/session encoding, CSRF handling, expiry/refresh policy, and optional later Fufubox linking mechanics remain implementation work.

---

## 21. Persistence — Accepted SQLite direction

Open Fufu owns its persistent state rather than depending on OpenFront's external account/archive backend.

Use **SQLite** as the V1 authoritative structured store, with normal migrations, foreign keys, and WAL-style deployment where appropriate.

Persistent concepts include:

- internal users/linked identities;
- sessions/auth metadata;
- controller drafts;
- immutable published controller versions;
- certification status;
- active presets;
- item catalogue version;
- owned items;
- loadouts;
- duplicate/gambling currency;
- official AI versions;
- matches/results;
- replay metadata;
- progression/rewards.

Large replay/log artifacts may be stored as compressed files with path/hash/version metadata in SQLite rather than bloating the database unnecessarily.

Exact schema, indexes, backup/retention policy, and replay-file layout remain implementation work.

---

## 22. Deployment and maintenance — Accepted simple model

Open Fufu does **not** require zero-downtime old/new-build draining for V1.

Planned deployments may use ordinary maintenance windows:

```text
announce maintenance
ask players not to begin long matches beforehand
stop Open Fufu
deploy / migrate
restart
verify health
```

Do not add multi-build draining/routing complexity unless future usage genuinely requires it.

Historical replay/version identity remains necessary even though live deployment may use downtime.

---

## 23. Build, tests, benchmarks, and performance tooling — Accepted direction

Retain useful TypeScript/build/test infrastructure where compatible but expect substantial changes.

Useful inherited foundations include TypeScript checking, Vite/browser build, Node server tooling, Vitest, server/lobby tests, full-game performance tooling, GC/heap profiling, replay harnesses, and the Go map generator.

Remove tests that assert intentionally removed OpenFront behavior and replace them with Open Fufu invariants.

### Required performance/logic coverage

Performance and simulation tests should cover:

- process-per-match overhead;
- 1/3/5 simultaneous authoritative matches;
- `isolated-vm` controller worker-pool overhead;
- whole-integer Population accounting;
- 800-Population / 1,000-cell frontier frontage cap;
- one-to-one source/target engagement-lane resolution;
- contact-surface defense such as 300:100 fronts;
- zero-Population defense;
- same-faction operation aggregation;
- no same-tick chain conquest;
- capture-coupled casualties;
- counter-responses;
- controller execution;
- participant projection/deltas;
- accelerated/headless runs;
- long-match memory/GC.

### Key performance invariant

Simulation work must scale primarily with **active strategic work and engaged frontier geometry**, not full `factions × cells` products.

No persistent defensive occupancy, dense Population matrices, or land Deployment queues should exist.

---

## 24. Proprietary assets — Accepted removal plan, do not delete yet

The inherited `proprietary/` directory is not a safe long-term Open Fufu dependency and should eventually be removed/replaced, but **do not delete it until all references are identified and replacements are ready**.

Current inventory:

### Font

- `proprietary/fonts/OpenFront.ttf`

### Branding / logo / favicon images

- `proprietary/images/Favicon.svg`
- `proprietary/images/OF.png`
- `proprietary/images/OF.webp`
- `proprietary/images/OpenFront.png`
- `proprietary/images/OpenFront.webp`
- `proprietary/images/OpenFrontLogo.png`
- `proprietary/images/OpenFrontLogo.svg`
- `proprietary/images/OpenFrontLogoDark.svg`

### Music

- `proprietary/sounds/music/evan.mp3`
- `proprietary/sounds/music/of2.mp3`
- `proprietary/sounds/music/of4.mp3`
- `proprietary/sounds/music/openfront.mp3`
- `proprietary/sounds/music/war.mp3`
- `proprietary/sounds/music/win.mp3`

No proprietary gameplay map corpus, unit-art library, or large gameplay-SFX collection was found in this directory during the audit.

Replacement work focuses on Open Fufu branding/favicon/logo assets, an original/permissively licensed UI font, original/permissively licensed soundtrack, removing code/build references, then deleting `proprietary/`.

Keep attribution/provenance review for the separate non-proprietary resource/map corpus.

---

## 25. Licensing — Accepted constraint

OpenFront code is AGPL-3.0 and applicable source/attribution obligations must be preserved. Non-proprietary map/resource assets have their own provenance/licenses and require continued attribution review.

Do not conflate code licensing with permission to reuse inherited `proprietary/` assets.

---

## 26. Migration dependency spine — Accepted high-level order

```text
1. HEADLESS CORE CLEANUP
       ↓
2. AUTHORITATIVE MATCH PROCESS + SUPERVISOR
       ↓
3. OPEN FUFU FACTION/POPULATION/GROWTH STATE
       ↓
4. SEGMENTS + CONTACT/OBSERVATION MODEL
       ↓
5. OFFENSIVE OPERATIONS + ENGAGED FRONTAGE + AUTOMATIC DEFENSE
       ↓
6. CONTROLLER DECISION CONTRACT
       ↓
7. ISOLATED-VM CONTROLLER WORKER POOL + CERTIFICATION
       ↓
8. STRUCTURE / NAVAL / RAIL / WEAPON TRANSLATION
       ↓
9. MATCH LIFECYCLE + REPLAY / PARTICIPANT PROTOCOL
       ↓
10. SQLITE / DISCORD AUTH / PROGRESSION / FOOF API
       ↓
11. BROWSER EDITOR / DEBUG / FINAL LOBBY UX
```

Some workstreams may overlap, but downstream systems must not force premature contracts onto unresolved upstream mechanics.

---

## 27. Remaining open integration questions

After the authority and Population/frontage simplifications, the legitimately open questions are narrower:

1. **Exact TypeScript controller API names/types and ergonomics.**
2. **Real Fufubox performance capacity** after a representative authoritative simulation exists.
3. **`isolated-vm` production benchmark/hardening details** — concrete time/memory/output limits, worker-pool size, lifecycle/recycling policy, and whether later QuickJS testing is worthwhile.
4. **Exact SQLite schema/index/backup/retention details.**
5. **Exact Discord session/cookie/expiry/CSRF implementation** and optional later Fufubox credential linking.
6. **Exact structure/naval/rail/weapon values and remaining translation details** where the canonical design deliberately leaves tuning open.
7. **Passive/inert mobile-unit behavior after resignation/capitulation.**
8. **Detailed lobby/UI/UX redesign.**
9. **Replacement asset creation and final proprietary-directory removal.**
10. **Normal gameplay tuning** — capture progress/speed, terrain/structure multipliers, growth reference values/interpolation, FFY payouts, AI reward values, Segment scale, weapon radii/effects, and related balance constants.

These should be resolved by updating this same canonical integration plan rather than creating additional migration-plan documents.
