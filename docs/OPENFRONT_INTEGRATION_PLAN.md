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

> Keep OpenFront's dense cell/map engine, deterministic Execution machinery, pathfinding, generic units/structures, substantial naval/rail/strategic-weapon infrastructure, renderer foundations, useful lobby/network infrastructure, and test/performance tooling. Replace client authority, old combat/resource semantics, mutable diplomacy, and progression assumptions. Adapt the existing scalar troop/attack shape into Open Fufu's global Population plus sparse offensive-operation model rather than building a dense faction-by-cell Population field.

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
| Scalar `troops` storage concept | **Adapt into global quantized Population** |
| Current `Attack` object/lifecycle shape | **Reuse selectively** |
| Current `AttackExecution` combat semantics | **Replace substantially** |
| Passive worker gold | **Remove** |
| Current troop growth/capacity formulas | **Replace** |
| Global Easy/Medium/Hard gameplay difficulty scalar | **Remove** |
| Official-AI simulation cheats | **Remove** |
| Mutable alliances/relations diplomacy | **Remove** |
| Current partial-territory/overtime/doomsday victory rules | **Replace / Remove** |
| Dense defensive Population allocation field | **Do not build** |
| Old desired/actual cell Redeployment subsystem | **Do not build** |
| Available/Committed Population accounting | **New / Adapt scalar troop plumbing** |
| Sparse offensive operations with spatial intent | **New / Adapt attack plumbing** |
| Automatic shared defense | **New** |
| Active counter-responses | **New** |
| Deployment Rate | **New** |
| Immutable strategic Segments | **New** |
| Runtime-derived Contacts | **New** |
| Secure operational visibility/observation model | **New** |
| Player controller runtime/sandbox | **New** |
| Controller publishing/certification/memory/diagnostics | **New** |
| Open Fufu FFY/items/progression | **New** |
| Open Fufu-owned persistent backend | **New / Adapt surrounding session infrastructure** |

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
browser viewers
```

Existing imports from `src/client` into shared simulation code should be removed or moved behind neutral formatting/event interfaces.

### Acceptance condition

A Node/headless process can load a map, run a complete match, determine its result, produce a replay record, and replay that match without importing DOM/browser presentation code.

---

## 4. Server authority and process topology — Accepted

Each live match has exactly **one canonical authoritative server simulation**.

Browsers never determine simulation progress, canonical hashes, winner state, or authoritative statistics.

### 4.1 V1 process model

The accepted V1 topology is **one OS child process per active authoritative match**.

Conceptually:

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

Reasons:

- independent V8 heaps/GC;
- one match crash does not kill unrelated matches;
- simple process termination and resource accounting;
- straightforward per-match profiling/logging;
- multi-core CPU use without serializing all matches through one Node event loop;
- fixed process overhead is acceptable for the expected small concurrency envelope.

Worker threads or pooled multi-match processes remain possible future optimizations only if measurements justify changing the topology.

### 4.2 Expected operating envelope

Open Fufu is intentionally a small friends-oriented deployment.

Current realistic planning assumptions are:

- **1–3 concurrent matches** is the normal meaningful envelope;
- **4 concurrent matches** should be rare;
- **5 concurrent matches** should be very rare;
- higher numbers are not a useful V1 design target;
- total live human/browser viewers across the service are expected to be roughly **5 or fewer** most of the time.

These are planning assumptions, not hard protocol limits.

### 4.3 Benchmark before capacity claims

Do not derive production capacity from current OpenFront relay-server load.

Before setting hard limits, benchmark the real authoritative Open Fufu simulation on Fufubox at least for:

- 1 live match;
- 3 simultaneous matches;
- 5 simultaneous matches as a stress case;
- controller-runtime overhead;
- observer projection/delta construction;
- accelerated certification/batch mode.

Record at minimum:

- mean/p50/p95/p99/max tick time;
- ticks exceeding the 100 ms budget at provisional 10 Hz;
- CPU utilization;
- process RSS/PSS/heap;
- GC pauses/churn;
- active operation/front counts;
- observer bandwidth;
- controller runtime cost.

The existing `tests/perf/fullgame` tooling is a strong starting point but will need adaptation for Open Fufu mechanics and authoritative process topology.

---

## 5. Controller-runtime isolation — Accepted direction

Player controller code must not execute with unrestricted access inside the canonical match process.

Conceptually:

```text
Authoritative Match
       |
immutable legal observation
       |
Controller runtime isolation
       |
proposed transactional decision
       |
validation
       |
canonical commit/reject
```

Controller failure must never become match-process corruption.

Do **not** assume one permanent OS process per controller. A reusable isolated controller-runtime pool is preferred if compatible with the selected sandbox technology, because per-match persistent controller state is explicitly serialized by the game contract and does not require a warm process per faction.

Exact sandbox/runtime technology remains **Open**.

### Deterministic parallel controller execution

Controllers at the same decision tick may execute concurrently against immutable snapshots of the same canonical tick.

Completion order must not create gameplay advantage. Results are collected and validated/committed according to deterministic rules.

---

## 6. Tick, decision, and Execution model — Accepted

Retain the deterministic Execution pattern rather than replacing it wholesale.

Open Fufu distinguishes:

```text
lifecycle/admin commands
controller strategic decisions
simulation executions/state transitions
```

Player controllers must not simply become another source of today's browser wire intents.

A controller invocation operates transactionally against one immutable legal observation. On success, memory/operation/action changes commit together. On failure, all temporary output is discarded.

Provisional cadence remains:

```text
simulation: 10 Hz
controller decisions: 2 Hz
```

Both are logical-tick rules. Accelerated simulations execute the same logical ticks without real-time waiting.

---

## 7. Map, cells, terrain, and Segments — Accepted

The current dense integer `TileRef`/typed-array map substrate is a primary reuse target.

Retain/adapt:

- integer cell references;
- compact terrain/state storage;
- deterministic adjacency;
- ownership lookup/mutation;
- water/pathfinding support;
- authored map compilation/loading;
- impassable terrain;
- map-scale optimized iteration patterns.

### 7.1 Segment layer

Add a compact immutable Segment identity for every real map cell, including water and impassable terrain, plus immutable Segment metadata/adjacency.

Segments remain strategic/query indexes rather than physical simulation buckets.

Dynamic terrain changes such as nuke-created water do not regenerate Segment identity.

### 7.2 Future procedural maps

Procedural/random map generation is new. It must deterministically produce terrain plus the same immutable Segment model from seed/version.

---

## 8. Ownership and neutral expansion — Accepted

Retain and adapt low-level cell ownership and incremental territory/border bookkeeping.

Current `conquer()`/`relinquish()`-style primitives are useful infrastructure.

Neutral expansion should no longer inherit old arbitrary troop-death behavior. It becomes an operation using ordinary Population and spatial intent, with capture still resolving through cells.

---

## 9. Population state — Accepted, redesigned

The earlier planned faction-by-cell Population field is removed from the migration target.

### 9.1 Global quantized Population

Adapt the useful scalar shape of OpenFront troop storage into one global deterministic quantized Population value per faction.

Faction Population state centers on:

```text
Total Population
Available Population
Committed offensive Population
Committed counter-response Population
Population aboard transports
Population Capacity
Growth Potential
Deployment Rate
```

Conceptually:

```text
Total
= Available
+ attacks/expansion operations
+ counter-responses
+ transports
```

There is no separate persistent Reserve pool.

### 9.2 Capacity from owned cells

Population Capacity becomes an extremely simple derived quantity:

```text
Capacity = owned population-bearing cells
```

For V1, one ordinary conquerable land cell contributes exactly one Capacity.

The existing incremental territory count should make Capacity an O(1)-style derived/read value rather than requiring map scans.

Remove/avoid:

- City Capacity bonuses;
- item max-Population/Capacity bonuses;
- terrain Capacity multipliers;
- hidden faction Capacity multipliers.

Cities move to growth effects.

### 9.3 Quantization

Prefer integer/packed Population representation in authoritative state.

The map-derived Capacity bound makes 32-bit/fixed-point approaches practical for ordinary V1 values. Exact encoding must be selected during implementation, but do not store large Population systems as object-heavy arbitrary floats unless profiling justifies it.

---

## 10. No defensive occupancy field — Accepted

Do not implement persistent defensive Population values on cells, Segments, Contacts, or fronts.

This removes the previously proposed data structures for:

- desired defensive cell allocation;
- actual defensive cell allocation;
- per-cell excess/deficit tracking;
- defensive cell-to-cell Redeployment.

Available Population is one shared automatic defensive pool.

When several incoming operations attack a defender simultaneously, derive the defender's finite available defensive pressure across them proportionally to incoming effective pressure. The same defenders must never count in full against every front.

Apply local terrain/structure defensive modifiers after deriving the finite shared defensive response.

The derivation must be resistant to attack-fragmentation exploits.

### Performance consequence

This is a major simplification relative to the previous audit plan.

The authoritative simulation should iterate primarily over:

- active operations;
- their currently actionable front cells;
- active counter-responses;
- active units/structures/economic events;

rather than over `factions × map cells`.

No dense Population matrix should exist.

---

## 11. Offensive operations and land combat — Accepted

The OpenFront `Attack` concept is now closer to the target than under the superseded defensive-cell model, but its existing semantics are still not authoritative.

### 11.1 Reuse selectively

Potentially reuse/adapt useful structural ideas such as:

- attack/operation identity;
- owner/target linkage;
- committed scalar Population;
- lifecycle/execution plumbing;
- border/actionability helpers;
- deterministic cell traversal/capture notifications.

Do not inherit blindly:

- old global defender troop formulas;
- old attack casualty formulas;
- bulk-conquest shortcuts;
- hidden large-faction bonuses;
- bot difficulty modifiers;
- mutable-relation side effects.

### 11.2 Target operation model

An operation should conceptually contain:

```text
committedPopulation
target
spatialIntent
activeFrontGeometry
```

Spatial intent may target/filter/weight Segments, Contacts, cells, controller-defined areas, terrain, or objectives.

Local operation pressure is **derived** over currently actionable front cells rather than persisted as Population occupancy per cell.

A finite operation's Population cannot be duplicated across every cell or opponent.

### 11.3 Automatic defense

Available Population automatically defends.

The defender's finite automatic defensive response is shared among simultaneous incoming operations according to the canonical design rule rather than manually allocated by the controller.

### 11.4 Counter-responses

Add an explicit counter-response operation type allowing the controller to commit Available Population against a particular incoming hostile operation.

Counter-response Population leaves the generic Available defensive pool while committed and is subject to Deployment Rate.

### 11.5 Combat math

Replace old OpenFront combat coefficients with the canonical Open Fufu local effective-pressure model, including separate casualty and capture outcomes and all-vs-all local multi-faction handling.

### Acceptance condition

No authoritative combat path duplicates the same Available defenders or committed attackers merely because multiple fronts/operations exist.

---

## 12. Deployment Rate — Accepted

Do not build the superseded desired/actual cell Redeployment system.

Implement one explicit Deployment Rate controlling Population entering/leaving active commitments such as:

- Available ↔ attack/expansion operation;
- Available ↔ counter-response;
- Available ↔ transport payload.

Passive automatic defense is exempt because Available Population defends by definition.

V1 has no land strategic-distance cost in Deployment Rate.

The previously accepted sublinear scaling direction may be retained as provisional tuning:

```text
R(P) = Rref × (P / Pref)^(2/3)
```

Exact reference values are balance work.

---

## 13. Population growth and Cities — Accepted

Replace current OpenFront troop growth/cap formulas.

Capacity is territory count, while Population growth remains a separate system.

Preserve the accepted sublinear growth direction and utilization curve from the canonical design.

Cities should contribute to Population growth, **not Capacity**.

Items may modify explicit growth/Deployment rules but must not modify Capacity/max Population while the one-cell-one-Capacity invariant is active.

Remove passive worker-gold coupling from Population entirely.

---

## 14. Structures — Accepted

Retain useful generic spatial structure lifecycle infrastructure:

- build legality;
- construction duration;
- under-construction state;
- ownership/capture;
- levels/upgrades;
- health/destruction;
- type-specific execution behavior.

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

Structures must not recreate a hidden global Military Power stat.

---

## 15. Generic units, naval, amphibious, trade, and rail — Accepted

Retain/adapt the generic unit framework: stable IDs, ownership, movement, target state, health, deletion, transfer, construction, upgrades, and type-specific runtime state.

### Transport ships

Current transport payload maps naturally to committed Population.

Carried Population is not Available for defense while aboard the ship. On legal landing it joins the local offensive engagement rather than triggering old attack semantics unchanged.

### Trade ships and Ports

The inherited physical trade-event model is a strong fit:

```text
Port
→ TradeShip
→ physical route
→ arrival/capture
→ FFY event
```

Replace alliance/embargo assumptions with Open Fufu fixed-team/FFA/`atWar` trade rules.

### Trains and rail

Retain useful physical/economic rail infrastructure and explicit stop/arrival events.

Do not give rail hidden Deployment advantages in V1. Any future effect must be explicit.

### Warships

Retain/adapt patrol, combat, transport interception, piracy, retreat/repair, health, and veterancy where compatible.

---

## 16. Strategic weapons and SAM — Accepted infrastructure, one open semantic detail

Retain substantial deterministic launch/trajectory/interception infrastructure:

- silos;
- missile flight;
- warning/visibility events where allowed;
- SAM interception;
- detonation geometry;
- structure/unit/terrain effects.

Replace old scalar-troop/attack-stack casualty handling and mutable-alliance side effects.

### Open: non-front Population casualty mapping

Because passive defenders no longer occupy cells, strategic weapons that should kill ordinary home/available Population require an explicit deterministic casualty rule that does not pretend defensive Population has hidden cell positions.

Do not solve this by silently reintroducing defensive occupancy. The exact rule remains **Open** for later mechanics review.

---

## 17. Teams, diplomacy, `atWar`, trade, and victory — Accepted

Retain fixed pre-match teams.

Remove mutable alliance/relation diplomacy as a core match system.

FFA opponents remain legally attackable regardless of `atWar`.

`atWar` becomes symmetric recent-hostility state rather than a permission gate.

Trade with enemies remains possible with the canonical explicit wartime penalty rather than ordinary embargo prohibition.

Do not inherit troop/gold donations automatically.

Replace old partial-territory/overtime/doomsday victory rules with the canonical 100%-territory / opposition-defeated rules.

Human resignation and AI capitulation are explicit lifecycle operations.

Detailed lobby UI/UX is expected to diverge substantially from OpenFront and remains later product work even where backend lobby primitives are reused.

---

## 18. Visibility and observer projection — Accepted architecture

OpenFront's client-replicated full simulation cannot securely enforce Open Fufu's hidden operational information.

The authoritative match process must generate legal observer/controller projections **before** information reaches the gateway/browser.

Conceptually:

```text
canonical match state
    |
    ├─ Fufu legal observation
    ├─ Ski legal observation
    ├─ official-AI legal observation
    └─ spectator/public observation
```

Use the same underlying visibility/projection rules for player controllers, official AI, and browser faction views so one surface cannot reveal information another hides accidentally.

The gateway should forward projections rather than mirror full secret world state for filtering.

Compute one projection per perspective/state version and fan it out to multiple viewers rather than recomputing identical perspectives for each socket.

The new hybrid Population model simplifies visibility because there is no hidden defensive cell deployment; hidden operational information mainly concerns active operations, counter-responses, mobile units, structures/details, and controller intent.

Exact spectator policy remains **Open** (omniscient, delayed, faction perspective, public-only, etc.).

---

## 19. Browser synchronization and rendering — Accepted architecture

Keep OpenFront's rendering/camera/map/unit visualization foundations heavily where useful.

Remove the browser's authoritative simulation responsibility.

The target browser becomes primarily:

```text
viewer
controller editor
debugger
replay viewer
loadout UI
lobby UI
```

### Snapshot + deltas

Live connection/reconnect should use:

```text
authoritative legal snapshot
→ incremental observer deltas
→ fresh snapshot on resync if needed
```

Do not require a reconnecting browser to replay the entire historical turn stream to catch up.

Static map/terrain resources can remain separately cached/versioned; live snapshots should focus on dynamic observed state.

Observer publishing must be optional in headless certification/batch simulations so accelerated runs do not spend CPU/network work producing renderer payloads nobody consumes.

---

## 20. Replay, records, and crash behavior — Accepted direction

Preserve OpenFront's deterministic archive/replay philosophy but make the server the source of canonical state/hashes.

### Normal replay

Archive the exact committed controller decisions/operation changes that drove the simulation so ordinary replay does **not** need to re-execute historical untrusted controller code.

A stronger verification/debug mode may separately re-run the exact archived controller/runtime and compare its outputs with committed decisions.

Historical records must bind all canonical design version inputs.

### Controller crash/failure

Controller failure never crashes the match and follows the canonical transactional/fault policy.

### Match-process crash

V1 may treat an authoritative engine/process crash as:

```text
match aborted
no progression reward
detailed crash record retained
```

Architect the record format so later deterministic replay-to-last-tick or periodic-checkpoint recovery remains possible, but crash-resume is not required for the first playable version.

---

## 21. Authentication and identity — Accepted initial direction

Open Fufu should own an internal user identity independent of any single authentication provider.

Preferred V1 authentication is **Discord authorization/OAuth**, potentially as the only ordinary login method initially.

Conceptually:

```text
Discord identity
    ↓
Open Fufu internal user
    ↓
Open Fufu session/token
    ↓
API / WebSocket
```

Do not make Discord's raw ID the universal primary key for all game data.

A later Fufubox/fufu-control challenge credential may be linked to the same internal Open Fufu user rather than creating a separate account universe.

Discord should be needed for login/refresh, not consulted on every match tick/message. Existing authenticated sessions and running matches should survive a temporary Discord outage.

Match processes receive only game-facing internal identity/configuration data, never Discord access tokens.

Foof should use a scoped service/API credential rather than database access.

Exact token/session implementation remains **Open**.

---

## 22. Persistence ownership — Accepted boundary

Open Fufu must own its persistent game state rather than depending on OpenFront's external account/archive backend.

Persistent concepts eventually include:

- internal users/linked identities;
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
- replay records;
- progression/rewards.

Exact database/storage technology remains **Open**.

---

## 23. Deployment and maintenance — Accepted simple model

Open Fufu does **not** require zero-downtime old/new-build draining for V1.

This is a small friends-oriented service. Planned deployments may use ordinary maintenance windows:

```text
announce maintenance
ask players not to begin long matches beforehand
stop Open Fufu
deploy / migrate
restart
verify health
```

Do not add multi-build match draining/routing complexity unless future usage genuinely requires it.

Historical replay/version identity remains necessary even though live deployments may use downtime.

---

## 24. Build, tests, benchmarks, and performance tooling — Accepted direction

Retain useful TypeScript/build/test infrastructure where compatible, but expect substantial changes because the architecture and core mechanics change.

Existing useful foundations include:

- TypeScript type checking;
- Vite/browser build;
- Node server tooling;
- Vitest;
- server/lobby tests;
- full-game performance tooling;
- GC/heap profiling;
- replay harnesses;
- Go map generator.

Do not preserve tests whose only purpose is asserting intentionally removed OpenFront behavior. Replace them with Open Fufu invariants.

### Required new performance coverage

Performance tests should specifically cover:

- process-per-match overhead;
- 1/3/5 simultaneous authoritative matches;
- quantized Population operations;
- number/size of active offensive fronts;
- automatic multi-front defense derivation;
- counter-responses;
- controller execution;
- observer projection/deltas;
- accelerated/headless runs;
- memory/GC under long matches.

### Key performance invariant

Simulation work must scale primarily with **active strategic work**, not full `factions × cells` products.

The new design intentionally avoids persistent defensive occupancy and dense Population matrices.

---

## 25. Proprietary assets — Accepted removal plan, do not delete yet

The inherited `proprietary/` directory is not a safe long-term Open Fufu dependency and should eventually be removed/replaced.

However, **do not delete it until all current references are identified and original/replacement assets are ready**.

Current inventory found during the audit:

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

Replacement work should therefore focus primarily on:

- Open Fufu branding/favicon/logo assets;
- an original/permissively licensed UI font;
- original/permissively licensed soundtrack replacement;
- removing all code/build references to the old assets;
- then deleting `proprietary/`.

Keep normal attribution/provenance review for the separate non-proprietary resource/map corpus.

---

## 26. Licensing — Accepted constraint

OpenFront code is AGPL-3.0 and applicable source/attribution obligations must be preserved.

Non-proprietary map/resource assets have their own provenance/licenses and require continued attribution review.

Do not conflate code licensing with permission to reuse the inherited `proprietary/` assets.

---

## 27. Migration dependency spine — Accepted high-level order

The audit establishes the following dependency order. This is not yet an implementation authorization checklist, but later implementation phases should respect these dependencies:

```text
1. HEADLESS CORE CLEANUP
       ↓
2. AUTHORITATIVE MATCH PROCESS + SUPERVISOR
       ↓
3. OPEN FUFU FACTION/POPULATION/GROWTH STATE
       ↓
4. SEGMENTS + CONTACT/OBSERVATION MODEL
       ↓
5. OFFENSIVE OPERATIONS + AUTOMATIC DEFENSE + DEPLOYMENT
       ↓
6. CONTROLLER DECISION CONTRACT
       ↓
7. CONTROLLER SANDBOX + CERTIFICATION
       ↓
8. STRUCTURE / NAVAL / RAIL / WEAPON TRANSLATION
       ↓
9. MATCH LIFECYCLE + REPLAY / OBSERVER PROTOCOL
       ↓
10. PERSISTENCE / AUTH / PROGRESSION / FOOF API
       ↓
11. BROWSER EDITOR / DEBUG / FINAL LOBBY UX
```

Some workstreams may overlap, but downstream systems must not force premature contracts onto unresolved upstream mechanics.

---

## 28. Remaining open integration questions

The following are still legitimately open after the authority and Population redesign:

1. **Controller sandbox implementation** — exact isolation/runtime technology and resource enforcement.
2. **Observer/spectator policy** — omniscient vs delayed vs faction/public perspectives.
3. **Strategic-weapon casualties without defensive occupancy** — explicit Population-loss rule for area weapons/special effects.
4. **Persistence technology/schema** — database/storage choices and record retention.
5. **Exact Discord/session implementation** and later optional Fufubox credential linking.
6. **Exact TypeScript controller API types/names.**
7. **Exact Population integer/fixed-point encoding.**
8. **Real Fufubox performance capacity** after a representative authoritative Open Fufu simulation exists.
9. **Exact structure/naval/rail/weapon balance translations** where the design contract leaves tuning/mechanic details open.
10. **Defeated-faction territory/structure cleanup semantics.**
11. **Detailed lobby/UI/UX redesign.**
12. **Replacement asset creation and final proprietary-directory removal.**

These should be resolved by updating this same canonical integration plan rather than creating additional migration-plan documents.
