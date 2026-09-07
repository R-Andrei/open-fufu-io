# Open Fufu — Canonical OpenFront Integration Plan

## Status and ownership

This document is the **canonical owner for transforming the OpenFront fork into Open Fufu**. It owns migration strategy, implementation sequencing, development-thread dependency/concurrency gates, authoritative-runtime topology, controller-runtime isolation, persistence architecture, deterministic version binding, inherited-source traceability, branch/cutover discipline, deployment implications, and integration validation.

It does **not** restate target gameplay mechanics. Those belong to the focused canonical owners listed in [`README.md`](./README.md). The high-level target game is defined by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). Repository validation ownership/adoption rules are defined by [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md). Effective-rule composition semantics are defined by [`RULE_COMPOSITION.md`](./RULE_COMPOSITION.md).

Inherited OpenFront architecture documents and executable code are migration evidence unless this repository explicitly adopts them into the maintained Open Fufu surface.

No gameplay implementation is authorized merely by this plan.

---

# 1. Migration strategy — new kernel with controlled salvage

Open Fufu is **not** an in-place conversion of OpenFront's domain/runtime model, and it is **not** a clean-room rewrite of every inherited algorithm and data structure.

The migration model is:

> Build a new authoritative Open Fufu simulation kernel alongside the inherited runtime, adopt existing Open Fufu-owned contracts directly, selectively extract proven low-level OpenFront engineering behind narrow dependency-neutral interfaces, and treat the remaining inherited domain/runtime architecture as reference until cutover and deletion.

The permanent target simulation namespace is:

```text
src/simulation/**
```

That namespace is the new authoritative simulation architecture. It is deliberately named for its permanent responsibility rather than as `new`, `v2`, or another migration-temporary concept.

Conceptually:

```text
                 canonical Open Fufu owners
                           |
                           v
                  Open Fufu-owned contracts
              rules / API / visibility / math
                           |
                           v
                  src/simulation/**
             new authoritative MatchRuntime
                           ^
                           |
            narrow dependency-neutral ports
                           ^
                           |
            selectively extracted algorithms
                           ^
                           |
                 inherited OpenFront

GameImpl / PlayerImpl / UnitImpl / AttackImpl /
ExecutionManager / GameRunner and equivalent
legacy domain objects remain reference by default.
```

## 1.1 Compatibility firewall

New Open Fufu simulation architecture must not use inherited OpenFront domain objects as its compatibility API.

`src/simulation/**` must not depend on broad inherited domain/runtime objects such as:

- `GameImpl` or the inherited giant `Game` interface family;
- `PlayerImpl`;
- `UnitImpl`;
- `AttackImpl` / inherited attack lifecycle as the target operation model;
- `AttackExecution`;
- `ExecutionManager` as the target command/system architecture;
- `GameRunner` as the target runtime;
- inherited Nation/bot objects as the target AI architecture.

When a useful inherited algorithm currently depends on one of those objects, migration should define the narrow capability the algorithm actually needs and extract or reimplement it against that capability.

Do **not** adapt new Open Fufu systems to legacy domain objects merely to make reuse easier.

## 1.2 Same repository, parallel implementation, one moving truth

The inherited runtime and the new kernel may coexist in the same repository during migration.

`main` remains the ordinary moving integration truth. New Open Fufu implementation lands through short-lived claimed topic branches and focused PRs rather than accumulating on a long-lived `rewrite`, `next`, or `v2` branch.

The inherited runtime remains runnable/referenceable while the new kernel grows. Adding a new simulation library does not require immediately deleting or rewiring the inherited application.

Before the first executable `src/simulation/**` implementation lands, create one immutable Git tag at the final pre-runtime `main` commit so the inherited/pre-runtime baseline remains permanently comparable without maintaining a second moving branch.

Legacy deletion follows:

```text
ADD
  ↓
TEST
  ↓
INTEGRATE
  ↓
CUT OVER
  ↓
DELETE
```

Delete-first migration is not the default.

## 1.3 Effective rules are foundational, not retrofit work

The current Open Fufu-owned rule compiler/composition/materialization infrastructure is part of the starting foundation.

Every new rule-bearing mechanic should consume the ordinary effective-rule surface from its first authoritative implementation. Do not implement a vanilla mechanic first and retrofit Origin/Echo/ruleset transformations after many systems already depend on hard-coded baselines.

Exact composition semantics remain owned by [`RULE_COMPOSITION.md`](./RULE_COMPOSITION.md); this plan owns only the migration requirement that new mechanics use that surface from the beginning.

---

# 2. Inherited-code disposition model

The old `keep/adapt` vocabulary is too broad. Every inherited area considered for reuse should be classified with one of these migration dispositions:

| Disposition | Meaning |
| --- | --- |
| **ADOPT** | Suitable Open Fufu code is intentionally part of the maintained target surface and is used directly. Existing Open Fufu-owned code remains adopted; inherited executable code becomes adopted only through the explicit process in `VALIDATION_POLICY.md`. |
| **EXTRACT** | Useful algorithm/data-structure engineering exists, but broad legacy dependencies must be removed. Define a narrow dependency-neutral interface, characterize the useful behavior, extract/reimplement, then deliberately adopt the resulting source with focused Open Fufu validation. |
| **REFERENCE** | Read/use as implementation evidence or algorithmic inspiration, but create no target architectural dependency by default. |
| **REPLACE** | The inherited semantics/authority/model conflict with Open Fufu and must not survive as target behavior. Useful sub-algorithms may still be independently extracted. |

Architectural disposition does not override validation ownership. `VALIDATION_POLICY.md` remains the sole authority on which executable files/tests are actually maintained Open Fufu code.

## 2.1 Migration ownership/disposition matrix

| Area | Default disposition | Open Fufu target owner / consequence |
| --- | --- | --- |
| Existing Open Fufu rule compiler/composition/materializer/registries | **ADOPT** | `RULE_COMPOSITION.md` + owned `src/core/rules/**` |
| `ControllerApi.ts` public contract | **ADOPT** | public controller surface |
| Tactical visibility primitive already explicitly owned | **ADOPT** | high-level design / controller projection |
| `DetMath` and other already adopted deterministic utilities | **ADOPT** | ordinary Open Fufu utility surface |
| `FactionRelations` where consistent with target rules | **ADOPT** | high-level design |
| Validation ownership/guard infrastructure | **ADOPT** | `VALIDATION_POLICY.md` |
| Dense raster/cell storage techniques | **EXTRACT** | new simulation map ports; do not expose legacy `Game` |
| Compact cell-reference arithmetic / deterministic adjacency | **EXTRACT** | map substrate ports |
| Authored map decoding/loading techniques | **EXTRACT** | versioned map-artifact boundary |
| A*/water/rail pathfinding algorithms and graph structures | **EXTRACT** | narrow navigation/map capabilities |
| Spatial indexes useful independently of legacy unit types | **EXTRACT** | neutral spatial interfaces |
| Trajectory/projectile/geometry/math algorithms | **EXTRACT** | focused physical-system ports |
| Renderer/camera/map visualization | **EXTRACT / REFERENCE** | retain techniques/components that consume legal projection; never constrain simulation architecture |
| Performance/replay harness techniques | **EXTRACT / REFERENCE** | new owned harnesses only when deliberately adopted |
| `GameImpl`, giant inherited `Game` interface family | **REFERENCE** | not target simulation API |
| `PlayerImpl` | **REFERENCE** | target faction/Population state is new |
| `UnitImpl` | **REFERENCE** | target units/structures use new canonical state/system boundaries |
| `AttackImpl`, `AttackExecution`, retreat lifecycle | **REFERENCE** | target operation/frontage model is new; extract only independent algorithms if useful |
| `ExecutionManager` / inherited `Intent -> Turn -> Execution` architecture | **REFERENCE** | new deterministic system/accepted-input architecture |
| `GameRunner` browser/shared runtime | **REFERENCE** | new `MatchRuntime` is authoritative foundation |
| Inherited Nation/bot architecture | **REFERENCE** | Official AI uses lawful target observation/actions |
| Browser/client simulation authority | **REPLACE** | one canonical server simulation |
| Inherited troop/gold/player economy model | **REPLACE** | Population + FFY owners |
| Inherited land-combat semantics | **REPLACE** | high-level design + combat owner |
| Mutable diplomacy/alliance behavior | **REPLACE** | high-level design |
| Inherited spawn semantics | **REPLACE** | `STRATEGIC_SPAWN.md` |
| Privileged hidden-information bot behavior | **REPLACE** | Official AI architecture |
| Client-produced canonical result/archive authority | **REPLACE** | authoritative runtime/replay |
| Inherited auth/service assumptions conflicting with Open Fufu contracts | **REPLACE** | auth/service owners |
| Proprietary inherited assets | **REPLACE after dependency audit** | §14 |

## 2.2 Extraction/adoption protocol

For inherited code worth salvaging:

```text
identify useful behavior
        ↓
characterization evidence/test for that behavior
        ↓
define narrow dependency-neutral interface
        ↓
extract or reimplement against that interface
        ↓
register/adopt source + focused validator under VALIDATION_POLICY
        ↓
add Open Fufu-specific contract/integration tests
```

If extraction requires pulling a large part of `GameImpl`, `PlayerImpl`, `UnitImpl`, `AttackImpl`, or another broad legacy domain hierarchy into the new kernel, prefer rewriting that component against the narrow interface instead.

---

# 3. Authoritative simulation kernel

OpenFront's existing shared runtime is **not** the target simulation foundation. The target foundation is a new browser-independent Open Fufu runtime library.

Conceptually:

```text
MatchSpec
   |
   v
MatchRuntime
   |
   +-- MatchState
   +-- deterministic TickEngine
   +-- deterministic systems
   +-- accepted simulation-affecting inputs
   +-- legal projection boundary
   +-- state fingerprint / replay evidence
```

The precise internal file/class decomposition may evolve, but the architectural responsibilities above are stable.

## 3.1 State/system style

Prefer explicit data-oriented stores and deterministic systems over recreating one giant OO `Game` / `Player` / `Unit` hierarchy. Do not introduce a generic ECS framework merely to satisfy this preference.

Conceptually:

```text
MatchState
├─ clock / deterministic scheduler
├─ map / terrain / ownership
├─ factions
│  ├─ Population
│  ├─ FFY
│  └─ EffectiveRules
├─ operations
├─ structures
├─ mobile units
├─ contacts / visibility state
├─ spawn state
└─ deterministic event/residual state
```

Focused canonical owners define what those states mean; this plan owns only the implementation topology.

## 3.2 First implementation — authoritative walking skeleton

The first executable implementation milestone is a **new Open Fufu `MatchRuntime` walking skeleton**, not cleanup/movement of inherited `GameRunner` or `GameImpl`.

Minimum foundation acceptance:

```text
MatchSpec
MatchRuntime
MatchState
deterministic TickEngine
tiny synthetic map support
at least two factions
EffectiveRules attached from the beginning
at least one accepted deterministic action/state transition
state fingerprint
fresh-runtime replay/regeneration equivalence
cheap scenario-authoring test harness
simulation dependency-firewall validation
owned source/test registration
```

The foundation deliberately does **not** require:

- DOM/browser code;
- a child process;
- SQLite;
- `isolated-vm`;
- production Segment compilation;
- Strategic Spawn;
- Random Spawn;
- production renderer integration;
- a real-world-scale map.

## 3.3 Dependency direction

```text
focused canonical rules/contracts
             |
             v
      src/simulation/**
             |
             +----> legal projections
             |
             +----> accepted deterministic inputs
             |
             v
    runtime/process adapters
```

Presentation, sandbox, service, and process adapters depend on the simulation boundary. The simulation must not depend on those operational adapters.

---

# 4. Authoritative server and process topology

Each live match has exactly **one canonical server simulation**. Browsers never determine simulation progress, winner state, canonical hashes, spawn resolution, or authoritative statistics.

The production process topology remains:

```text
Browser / external integration
            |
         HTTPS / WS
            |
Open Fufu gateway / API / lobby
            |
      match supervisor
        |    |    |
        A    B    C
      process process process
```

V1 uses **one OS child process per active authoritative match**. This gives match-level crash containment, independent V8 heaps/GC, simple termination/resource accounting, straightforward profiling, and natural multi-core use.

Worker-thread or pooled multi-match processes are future optimizations only if measurements justify them.

## 4.1 Sequencing rule — process isolation is an adapter, not the simulation foundation

The deterministic `MatchRuntime` must first exist as an ordinary in-process library/runtime object so game-domain tests can execute rapidly without process creation or IPC.

Only after the `MatchRuntime` lifecycle is stable should a child-process adapter/supervisor become a production integration layer around it.

Combat/mechanics tests must not require forking an OS process merely to exercise ordinary simulation behavior. Child-process transport, lifecycle, crash containment, and resource behavior receive separate focused tests.

## 4.2 Planning envelope

Initial deployment assumptions:

- 1–3 concurrent matches: normal;
- 4: rare;
- 5: very rare;
- roughly five or fewer simultaneous human/browser participants/viewers most of the time.

These assumptions are capacity-planning inputs, not gameplay rules.

## 4.3 Required benchmark

Before making capacity claims, benchmark representative authoritative Open Fufu builds at 1, 3, and 5 concurrent matches, including controller runtime and observer projection overhead.

Record at minimum:

- mean/p50/p95/p99/max tick time;
- missed simulation tick budgets;
- CPU;
- RSS/PSS/heap;
- GC behavior;
- active operation/frontage counts;
- observation/delta bandwidth;
- controller-runtime cost.

Inherited performance-harness techniques may be referenced/extracted where useful, but the resulting authoritative benchmark must be Open Fufu-owned under `VALIDATION_POLICY.md`.

---

# 5. Player-controller runtime isolation

Player controller code must not execute with unrestricted access inside the authoritative match process.

Production topology:

```text
Authoritative Match
       |
immutable legal observation
       |
controller worker-process pool
       |
V8 isolate (`isolated-vm`)
       |
proposed decision
       |
validation
       |
canonical commit/reject
```

The V1 isolation target is **`isolated-vm` inside dedicated controller-runtime worker processes**. Match processes themselves do not host untrusted user isolates.

Untrusted controller code receives no Node `require`, process access, filesystem/network access, environment variables, host object references, uncontrolled entropy, or system/real time.

Controller-persistent game-facing state uses the explicit memory contract in [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md); isolate/module globals are not trusted persistence.

For the deployed Node major, pin a compatible `isolated-vm` release and obey its documented process-launch requirements. Runtime compatibility details must be reverified when the Node or `isolated-vm` major changes.

## 5.1 Controller-host abstraction

The authoritative simulation integrates with controller execution through a narrow conceptual host boundary:

```text
ControllerHost.invoke(legalObservation) -> proposedDecision
```

The simulation must not care whether the implementation is:

- a fast deterministic in-process test controller host;
- trusted Official-AI execution;
- the production isolated worker pool;
- another future operational host with the same authoritative contract.

An `InProcessTestControllerHost` or equivalent is the normal foundation/micro-simulation tool. The production isolated host must satisfy the same applicable decision/projection contract tests plus its own sandbox/resource/fault tests.

## 5.2 V1 runtime limits

| Limit | V1 default |
| --- | ---: |
| Persistent controller memory | **128 KiB** |
| `isolated-vm` heap | **32 MiB per isolate** |
| Normal `decide()` execution | **20 ms max** |
| Spawn hook execution | **50 ms max** |
| Initial module evaluation | **100 ms max** |
| Serialized returned decision | **256 KiB max** |
| Queries per decision | **128** |
| Materialized cells per decision | **25,000** |
| Directive updates per decision | **128** |
| One-shot commands per decision | **64** |
| Total policy/weight rules | **256** |
| Debug objects | **256 per decision** |
| Controller log text | **8 KiB per decision** |
| Observable events delivered | **512 per decision** |
| Team-signal payload | **1 KiB** |

These are versioned runtime defaults and may be retuned only through an explicit runtime-contract change.

## 5.3 Runtime faults

Ordinary gameplay/stale-state rejection is a structured result, not a controller runtime fault.

Runtime faults include:

- uncaught exception;
- execution timeout;
- malformed whole output;
- isolate/controller memory-limit violation;
- sandbox violation.

A runtime fault discards temporary output/memory from that invocation and preserves the previous committed controller state/directives.

V1 circuit breaker:

```text
5 consecutive normal-runtime faults
OR
20 total normal-runtime faults in one match
→ controller FAULTED for the rest of that match
```

A non-faulting normal invocation resets the consecutive count. No replacement AI takes over. Pre-match spawn-hook failure uses the canonical deterministic spawn fallback rather than automatically faulting normal match play.

## 5.4 Worker pool

Initial Fufubox deployment baseline:

```text
4 controller worker processes
1 callback executing at a time per worker
```

A worker may service different controller isolates over time. Do not create one permanent OS process per controller.

Recycle an idle worker when:

- RSS exceeds **512 MiB**; or
- it has been alive for roughly **1 hour** and is idle.

Worker-pool sizing/recycling is deployment configuration rather than replay/game determinism.

## 5.5 Deterministic parallelism

Controllers may execute concurrently against immutable snapshots of the same canonical pre-state. Completion order must never create gameplay advantage; collected results commit/resolve deterministically.

---

# 6. Controller decision integration

Do **not** preserve inherited `Intent -> Turn -> Execution` classes as the target controller/simulation architecture merely because they already provide deterministic dispatch.

Reference or extract useful scheduling/order/transaction ideas when valuable, but the new `MatchRuntime` owns its accepted-input and deterministic-system architecture.

Open Fufu distinguishes:

- lifecycle/admin commands outside ordinary authoritative gameplay decisions;
- pre-match spawn decisions;
- controller strategic decisions;
- deterministic simulation transitions.

A normal controller callback observes one immutable legal projection and submits a proposed final decision set. The authoritative runtime validates and commits game-facing effects transactionally.

Persistent directives remain active until changed/ended. One-shot commands execute once. Source order inside one returned decision must not be treated as imperative mutation order unless an individual command contract explicitly says otherwise.

The public TypeScript surface is [`ControllerApi.ts`](../src/core/controller/ControllerApi.ts). This document owns the runtime adapter and authoritative integration around that public surface, not a duplicate API definition.

Controller memory uses only the canonical semantics from [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md).

Provisional cadence remains:

```text
simulation:           10 Hz
controller decisions:  2 Hz
```

Accelerated/headless simulation executes the same logical ticks without real-time waiting.

---

# 7. Map, terrain, Segments, navigation, and spawn migration

## 7.1 Simulation map ports first

The new kernel should define narrow map/terrain/ownership/navigation capabilities based on what the simulation actually needs.

Useful inherited compact-cell storage, adjacency, map decoding, connectivity, water/rail graph, pathfinding, and spatial algorithms may then be **extracted** behind those capabilities rather than making the new simulation depend on inherited `Game`/`Unit` types.

The target cell/terrain/ownership rules remain owned by the focused canonical design owners.

## 7.2 Tiny synthetic maps are the default development surface

Most mechanic tests should use tiny synthetic maps such as 5×5, 16×16, or 32×32 worlds where practical. Production-scale maps belong in explicit system/performance tiers, not the ordinary red/green loop.

The first authoritative walking skeleton and land vertical slice require only enough map support to exercise the targeted mechanics deterministically.

## 7.3 Segments are not a first-slice blocker

The immutable compiled Segment layer remains defined exclusively by [`SEGMENTS.md`](./SEGMENTS.md), but production Segment compilation is not on the critical path for the first fixed-map land slice.

The new map/query interfaces must be compatible with adding compiled Segment membership and Segment projections later without redesigning authoritative cells/ownership.

Segment compiler/runtime integration becomes available once stable map-artifact/query ports exist.

## 7.4 Spawn sequencing

Use Fixed Spawn/fixed initial ownership for foundation and early vertical-slice scenarios.

Strategic/Random Spawn becomes a later initialization workstream behind:

- a stable match initialization interface;
- relevant map/Segment support;
- the controller pre-match boundary;
- effective Origin spawn profiles where required.

The final Strategic Spawn resolver/protocol remains owned exclusively by [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md).

## 7.5 Terrain

Translate useful inherited terrain storage/loading only through the target base-terrain/Fallout semantics in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md).

Map compilation, pathing classes, ownership bookkeeping, rendering, observation projection, and replay must consume the same versioned target terrain semantics rather than independent inherited switch-table copies.

---

# 8. Population, operations, defense, and combat implementation

The global Population model, Capacity invariant, operation/frontage model, automatic defense, counter-response semantics, ordinary capture casualties, and game-wide land-combat invariants are owned by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). Exact capture/counter-response arithmetic is owned by [`COMBAT_TUNING.md`](./COMBAT_TUNING.md).

Implement those models **directly in the new kernel**.

Do not translate `_troops` inside `PlayerImpl` into the new Population architecture or adopt inherited `AttackImpl` identity/lifecycle as the target operation model merely to reduce initial edits. `PlayerImpl`, `AttackImpl`, `AttackExecution`, and related inherited combat code are reference surfaces unless a smaller independent algorithm is deliberately extracted.

The first gameplay vertical slice is:

```text
fixed initial state
        ↓
controller/legal test decision observes state
        ↓
operation commitment accepted
        ↓
Population accounting changes
        ↓
frontage/pressure resolves
        ↓
automatic defense resolves
        ↓
capture/casualty/accounting settlement
        ↓
ownership changes
        ↓
next legal observation reflects result
        ↓
fresh runtime reproduces result from same accepted inputs
```

This vertical slice is the first proof that Open Fufu is becoming a functioning game rather than merely a headless refactor of OpenFront.

Simulation work should scale primarily with active strategic work/frontage rather than dense faction×map products.

---

# 9. Structures, economy, units, naval, rail, and strategic weapons

Do not maintain target mechanics in this plan. Implement each subsystem from its focused owner:

- terrain, persistent structures, baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- FFY, Factory Trains, Trade Ships, piracy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Warships, Transports, strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Origin transformations: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) plus the ordinary effective-rule composition owner.

Implementation rule:

> Build the canonical Open Fufu state/system model first; reuse inherited engineering only at narrow algorithm/data-structure seams.

Useful extraction candidates may include:

- rail graph/path algorithms;
- water connectivity/pathfinding;
- trajectory/parabola/interception algorithms;
- independently useful spatial indexes;
- movement/route math;
- deterministic physical-traffic algorithms;
- performance-oriented data layouts.

Do not carry broad inherited `UnitImpl` state simply to inherit construction, transport, warship, train, missile, SAM, health, ownership-transfer, and update-generation behavior in one object. If only one portion is valuable, extract that portion.

Every new rule-bearing physical system consumes `EffectiveRules`/typed rule surfaces from its first authoritative implementation rather than adding Origin/Echo support later through pairwise exceptions.

---

# 10. Origins, Echoes, and Official AI

## 10.1 Origins

Origins are declarative versioned rule data. Implement catalogue/builder/runtime projection from:

- [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md).

Production validation must enforce the public builder/catalogue rules without hidden pairwise compatibility tables. Effective Origin rules must serialize/hash deterministically and project through the ordinary rules/controller surface.

Mechanical certification applies to the deployed trait catalogue and the distinct gameplay transformations/interactions that catalogue can produce, **not to each named Official or Custom Origin as a separate runtime artifact**. Creating or loading a legal named Origin from a certified catalogue requires only ordinary catalogue-version, trait-ID, builder-legality, canonical-composition, and serialization checks; live matches do not launch background/headless certification for previously unseen named combinations.

Origin validation is distributed to the gameplay domains that own the affected mechanics. Catalogue/intrinsic validation belongs with the Origin layer; runtime conformance belongs with the relevant subsystem; genuine cross-domain interactions receive explicit integration coverage. [`ORIGIN_VALIDATION_COVERAGE.md`](./ORIGIN_VALIDATION_COVERAGE.md) owns the concrete validation-domain assignments, dependency relationships, integration seams, and explicit interaction obligations. This plan owns the certification architecture and deployment-eligibility predicate in §15.3.

Existing Open Fufu-owned rule compiler/materialization/Origin manifest infrastructure is an adopted starting asset, not a future phase that waits until after basic gameplay.

## 10.2 Echoes

Implement Echo identity, acquisition, retained rolls, duplicate settlement, rewards, generated naming, Echo Sets, Middle Fingers, and Gacha only from [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md).

The public source repository may contain reusable Echo contracts/algorithms/versioned naming configuration. Live account progression remains runtime/private persistence.

This plan owns only the persistence/runtime/version-binding integration required to support that canonical subsystem.

## 10.3 Official AI

Treat inherited Nation AI as behavioral/implementation reference, not as the target public contract.

Official PvE AI must consume lawful Open Fufu observations/actions and must not retain simulation cheats, hidden information access, or privileged gameplay rules.

Official-AI work enters through [`official-ai/README.md`](./official-ai/README.md). Canonical architecture and each specific rationale/configuration concern are owned by the child/configuration owners registered in [`README.md`](./README.md); the gateway itself owns no subsystem mechanics.

Official AI may run as trusted operational code and therefore need not use the hostile-code sandbox, but trusted execution must not imply gameplay-information privilege.

---

# 11. Visibility, browser synchronization, participant protocol, and replay

## 11.1 Authoritative projection

OpenFront's replicated full client simulation cannot securely enforce hidden operational information.

The authoritative `MatchRuntime` must generate legal projections **before** information reaches a controller host, gateway, browser, or Official AI:

```text
canonical match state
    |
    ├─ participant A legal projection
    ├─ participant B legal projection
    └─ official-AI legal projection
```

Use one projection model for player controllers, official AI, and participant browser views. Team visibility combines only what the target rules explicitly permit.

All derived queries/calculators operate on legal projected information and must not become side-channel oracles.

## 11.2 Browser synchronization

Retain/extract OpenFront rendering/camera/map-visualization technology where useful, but remove browser authority.

Live/reconnect synchronization uses the semantic contract in [`service/PARTICIPANT_PROTOCOL.md`](./service/PARTICIPANT_PROTOCOL.md): authoritative legal snapshot, ordered incremental observer deltas, bounded resume, and fresh snapshot on resync when needed.

A reconnecting browser does not replay the entire historical action stream merely to reconstruct current state.

Browser roles include match viewing, controller authoring/debugging, replay, Origin/Echo workflows, lobby/spawn UI, and diagnostics. Exact subsystem UI semantics come from their canonical owners.

## 11.3 Participant/service protocol

The canonical external boundary is [`service/README.md`](./service/README.md):

- [`service/SERVICE_API.md`](./service/SERVICE_API.md) owns HTTP/control-plane resources;
- [`service/PARTICIPANT_PROTOCOL.md`](./service/PARTICIPANT_PROTOCOL.md) owns the live participant/spectator stream.

This migration plan owns only the runtime/process/persistence work needed to implement those contracts. It does not duplicate endpoint, message-envelope, or reconnect semantics.

## 11.4 Replay has a foundation layer and a product layer

Simulation reproducibility begins with the first walking skeleton:

```text
same MatchSpec
+ same accepted deterministic inputs
+ same bound rule-bearing versions
        ↓
fresh MatchRuntime
        ↓
same authoritative state/result/fingerprint
```

This fast in-process replay/regeneration proof is a foundation invariant and belongs in ordinary micro-simulation development where authoritative state changes.

The later archival replay product remains a compact deterministic record of exact versioned match bindings, authoritative pre-match/spawn resolution, and committed simulation-affecting inputs/actions required to reproduce the match from tick zero.

Ordinary playback does not re-execute historical player controllers and does not require controller-memory snapshots or periodic full-world-state checkpoints.

Detailed controller logs/debug annotations remain separate bounded diagnostic artifacts rather than canonical replay state.

---

# 12. Authentication and identity integration

Implement authentication, identity linking, sessions, OAuth-provider boundary, provisioning/revocation, CSRF/Origin enforcement, and WebSocket session binding from the canonical [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md) only.

Migration consequences:

- remove inherited auth/session assumptions that conflict with that contract;
- keep admission policy outside Open Fufu;
- give match processes only internal game-facing participant identity/configuration;
- never pass OAuth tokens, browser cookies, integration credentials, or external roles into match processes;
- prevent external systems from writing Open Fufu persistence directly as an integration mechanism.

Do not duplicate endpoint/cookie/OAuth details here.

---

# 13. Persistence — canonical V1 runtime architecture

Open Fufu owns its persistent runtime state.

Use **SQLite** through Node's built-in **`node:sqlite`** API for V1. Do not add an ORM solely to wrap this service.

Every normal writable connection applies:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA wal_autocheckpoint = 1000;
```

Schema changes use explicit SQL migrations committed to Git.

```text
src/server/persistence/
    Database.ts
    migrations/
        0001_initial.sql
        0002_...
```

Runtime layout:

```text
data/
    open-fufu.sqlite3
    replays/
    controller-logs/
    backups/
```

Reusable rule-bearing game data remains versioned source/game content rather than being duplicated wholesale into relational rows. Runtime/private account/progression records live in SQLite/files as specified below.

## 13.1 V1 relational schema

The initial V1 persistence model has **17 core tables**.

### 1. `schema_migrations`

```text
version              INTEGER PRIMARY KEY
name                 TEXT NOT NULL
applied_at_ms        INTEGER NOT NULL
app_git_sha          TEXT NOT NULL
```

### 2. `users`

```text
id                   INTEGER PRIMARY KEY
public_id            TEXT UNIQUE NOT NULL
display_name         TEXT NOT NULL
created_at_ms        INTEGER NOT NULL
deleted_at_ms        INTEGER
```

### 3. `linked_identities`

```text
provider             TEXT NOT NULL
provider_subject     TEXT NOT NULL
user_id              INTEGER NOT NULL REFERENCES users(id)
created_at_ms        INTEGER NOT NULL
revoked_at_ms        INTEGER

PRIMARY KEY(provider, provider_subject)
```

### 4. `controller_projects`

```text
id                   INTEGER PRIMARY KEY
public_id            TEXT UNIQUE NOT NULL
user_id               INTEGER NOT NULL REFERENCES users(id)
name                  TEXT NOT NULL
created_at_ms         INTEGER NOT NULL
updated_at_ms         INTEGER NOT NULL
archived_at_ms        INTEGER
```

### 5. `controller_drafts`

```text
project_id           INTEGER PRIMARY KEY REFERENCES controller_projects(id)
source_package_json  TEXT NOT NULL
updated_at_ms        INTEGER NOT NULL
```

### 6. `controller_versions`

Published versions are immutable.

```text
id                         INTEGER PRIMARY KEY
public_id                  TEXT UNIQUE NOT NULL
project_id                 INTEGER NOT NULL REFERENCES controller_projects(id)
version_no                 INTEGER NOT NULL
controller_api_version     TEXT NOT NULL
source_package_json        TEXT NOT NULL
source_sha256              TEXT NOT NULL
bundle_js                  TEXT NOT NULL
bundle_sha256              TEXT NOT NULL
compiler_version           TEXT NOT NULL
certification_status       TEXT NOT NULL
certification_report_json  TEXT
created_at_ms              INTEGER NOT NULL

UNIQUE(project_id, version_no)
```

### 7. `custom_origins`

```text
id                    INTEGER PRIMARY KEY
public_id             TEXT UNIQUE NOT NULL
user_id               INTEGER NOT NULL REFERENCES users(id)
name                  TEXT NOT NULL
catalogue_version     TEXT NOT NULL
trait_ids_json        TEXT NOT NULL
definition_sha256     TEXT NOT NULL
created_at_ms         INTEGER NOT NULL
archived_at_ms        INTEGER
```

A used Custom Origin definition is immutable for historical meaning; edits create a new definition/version.

### 8. `echo_inventory`

```text
user_id                 INTEGER NOT NULL REFERENCES users(id)
echo_catalogue_version  TEXT NOT NULL
echo_identity_id        INTEGER NOT NULL
magnitudes_json         TEXT NOT NULL
tier                     TEXT NOT NULL
favorite                 INTEGER NOT NULL DEFAULT 0
acquired_at_ms           INTEGER NOT NULL
updated_at_ms            INTEGER NOT NULL

PRIMARY KEY(user_id, echo_catalogue_version, echo_identity_id)
```

Derived Echo quality/score is recomputed from retained magnitudes and the bound catalogue rather than stored as a second authority. Generated display wording may use the currently selected naming configuration for ordinary account presentation; historical match/settlement presentation binds its naming version in the source record/payload when exact wording matters.

### 9. `echo_sets`

```text
id                    INTEGER PRIMARY KEY
public_id             TEXT UNIQUE NOT NULL
user_id               INTEGER NOT NULL REFERENCES users(id)
name                  TEXT NOT NULL
created_at_ms         INTEGER NOT NULL
updated_at_ms         INTEGER NOT NULL
```

### 10. `echo_set_members`

```text
echo_set_id             INTEGER NOT NULL REFERENCES echo_sets(id)
slot_index               INTEGER NOT NULL
echo_catalogue_version   TEXT NOT NULL
echo_identity_id         INTEGER NOT NULL

PRIMARY KEY(echo_set_id, slot_index)
```

### 11. `progression`

```text
user_id                     INTEGER PRIMARY KEY REFERENCES users(id)
middle_fingers              INTEGER NOT NULL DEFAULT 0
paid_non_lucky_plus_streak  INTEGER NOT NULL DEFAULT 0
gacha_rules_version         TEXT NOT NULL
updated_at_ms               INTEGER NOT NULL
```

### 12. `reward_settlements`

```text
id                   INTEGER PRIMARY KEY
public_id            TEXT UNIQUE NOT NULL
user_id               INTEGER NOT NULL REFERENCES users(id)
source_type          TEXT NOT NULL
source_id            TEXT NOT NULL
rules_version        TEXT NOT NULL
status               TEXT NOT NULL
payload_json         TEXT NOT NULL
created_at_ms        INTEGER NOT NULL
applied_at_ms        INTEGER

UNIQUE(user_id, source_type, source_id)
```

`rules_version` versions the **settlement application/state-machine contract**, not the gameplay/Echo/Gacha rules that produced the reward. `payload_json` snapshots the source-specific version bindings and deterministic generated result required to retry/resolve that settlement without consulting current defaults.

Apply one settlement atomically in one SQLite transaction so partial inventory/currency/pity/audit updates cannot commit independently.

### 13. `echo_events`

Append-only audit trail; current inventory is not reconstructed by replaying it.

```text
id                       INTEGER PRIMARY KEY
user_id                  INTEGER NOT NULL REFERENCES users(id)
settlement_id            INTEGER REFERENCES reward_settlements(id)
source_type              TEXT NOT NULL
source_id                TEXT NOT NULL
echo_catalogue_version   TEXT NOT NULL
echo_identity_id         INTEGER
rolled_magnitudes_json   TEXT
tier                     TEXT
outcome                  TEXT
middle_fingers_delta     INTEGER NOT NULL DEFAULT 0
pity_before              INTEGER
pity_after               INTEGER
created_at_ms            INTEGER NOT NULL
```

### 14. `matches`

```text
id                        INTEGER PRIMARY KEY
public_id                 TEXT UNIQUE NOT NULL
seed                      TEXT NOT NULL
status                    TEXT NOT NULL
map_id                    TEXT NOT NULL
map_hash                  TEXT NOT NULL
game_git_sha              TEXT NOT NULL
ruleset_version           TEXT NOT NULL
controller_api_version    TEXT NOT NULL
origin_catalogue_version  TEXT NOT NULL
echo_catalogue_version    TEXT NOT NULL
echo_naming_version       TEXT NOT NULL
ai_preset_version         TEXT NOT NULL
spawn_resolver_version    TEXT NOT NULL
lobby_config_json         TEXT NOT NULL
result_json               TEXT
started_at_ms             INTEGER
ended_at_ms               INTEGER
```

### 15. `match_factions`

```text
match_id                 INTEGER NOT NULL REFERENCES matches(id)
slot                     INTEGER NOT NULL
kind                     TEXT NOT NULL
user_id                  INTEGER REFERENCES users(id)
controller_version_id    INTEGER REFERENCES controller_versions(id)
official_ai_preset_id    TEXT
team_id                  TEXT
origin_snapshot_json     TEXT NOT NULL
echo_snapshot_json       TEXT NOT NULL
spawn_snapshot_json      TEXT
result                   TEXT
eliminated_at_tick       INTEGER

PRIMARY KEY(match_id, slot)
```

Snapshots intentionally preserve exact bound historical interpretation without assuming future catalogues still interpret an ID identically.

### 16. `replays`

Replay payloads live as files; SQLite stores metadata/integrity.

```text
match_id             INTEGER PRIMARY KEY REFERENCES matches(id)
format_version       TEXT NOT NULL
relative_path        TEXT NOT NULL
sha256               TEXT NOT NULL
compressed_bytes     INTEGER NOT NULL
created_at_ms        INTEGER NOT NULL
expires_at_ms        INTEGER
pinned               INTEGER NOT NULL DEFAULT 0
```

Ordinary layout:

```text
data/replays/YYYY/MM/<match-public-id>.ofr.zst
```

Do not put large replay/debug payloads into SQLite merely because SQLite supports BLOBs.

### 17. `sessions`

```text
id                   INTEGER PRIMARY KEY
user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_sha256         BLOB NOT NULL UNIQUE CHECK(length(token_sha256) = 32)
created_at_ms        INTEGER NOT NULL
expires_at_ms        INTEGER NOT NULL
revoked_at_ms        INTEGER
```

Authentication/session behavior itself remains owned by `AUTH_AND_IDENTITY.md`.

## 13.2 Accepted indexes

```text
controller_versions(project_id, version_no DESC)
echo_sets(user_id, updated_at_ms DESC)
echo_events(user_id, created_at_ms DESC)
reward_settlements(user_id, status, created_at_ms)
matches(ended_at_ms DESC)
match_factions(user_id, match_id)
replays(expires_at_ms)
sessions(user_id, expires_at_ms)
sessions(expires_at_ms)
```

Add further indexes only when measured query patterns justify them.

## 13.3 Retention and backups

Keep indefinitely:

- user/account state;
- published controller versions referenced by matches;
- Origin/Echo progression;
- match metadata/results;
- reward audit;
- pity state;
- current Echo inventory.

File retention:

- ordinary replay: **90 days**;
- pinned/benchmark replay: **indefinite**;
- detailed controller diagnostic logs: **7 days**;
- replay metadata may remain after replay-file expiry.

Routine SQLite backups:

```text
7 daily
4 weekly
6 monthly
```

Create an automatic database backup immediately before every schema migration.

Replay files require separate backup handling when retained replay payloads must survive primary-data loss.

## 13.4 Canonical version binding

A version field has one defined responsibility. Defaults are resolved only when creating a new match/transaction; retry/replay never silently substitutes today's default.

| Binding | Canonical meaning | Bound when | Stored/anchored in | Primary consumers |
| --- | --- | --- | --- | --- |
| `game_git_sha` | exact Open Fufu implementation build for deterministic simulation | match creation | `matches` + replay | authoritative runtime/replay |
| `map_id` + `map_hash` | exact compiled map artifact, including map-compiled strategic data | match creation | `matches` + replay | simulation/spawn/replay |
| `ruleset_version` | game-wide simulation rules not owned by a narrower catalogue/resolver | match creation | `matches` | simulation/replay |
| `controller_api_version` | public controller observation/action/runtime contract | controller publication and match creation | `controller_versions`, `matches` | certification/controller runtime/replay interpretation |
| `origin_catalogue_version` | complete Origin rules package for trait definitions and Official-Origin definitions selectable under that package | match creation / Custom-Origin definition creation | `matches`, `custom_origins`; exact selected definition snapshot in `match_factions` | effective rules/spawn/simulation/replay |
| `echo_catalogue_version` | complete **mechanical** Echo package: identities, roll/acquisition/quality/Pareto/duplicate rules and match-reward arithmetic | match creation or acquisition transaction | `matches`, `echo_inventory`, `echo_events`, settlement payload | Echo loadout/effective rules/reward generation/acquisition |
| `echo_naming_version` | generated Echo naming/presentation grammar only; never mechanical magnitude/quality meaning | match creation or acquisition presentation snapshot | `matches`; settlement/replay payload when historical wording matters | historical presentation/replay/result UI |
| `ai_preset_version` | Official-AI roster, preset difficulty, allowed-Origin pool and selection metadata | match creation | `matches` + selected preset snapshot/reference | Official AI runtime and match reward difficulty input |
| `spawn_resolver_version` | deterministic spawn conflict/fallback/footprint resolver algorithm identity where independently versioned | match creation | `matches` + spawn/replay snapshot | spawn/replay |
| `gacha_rules_version` | paid-Gacha purchase/pity policy only | each paid Gacha transaction; progression records active account version | `progression` + settlement payload | Gacha affordability/pity transition |
| `reward_settlements.rules_version` | settlement payload/application/state-machine schema; **not** reward-generation rules | settlement creation | `reward_settlements` | idempotent resolution/application |
| `replays.format_version` | replay container/record schema | replay creation | `replays` + file header | replay reader |

No separate `echo_acquisition_rules_version` is required in V1: `echo_catalogue_version` deliberately owns the complete mechanical Echo acquisition/reward contract. If that package ever becomes independently deployable in incompatible parts, split it with a schema/version migration rather than changing the meaning of an existing field.

Likewise, `echo_naming_version` is not required on every inventory row because ordinary collection presentation may use the current naming configuration. Exact historical wording is preserved only where it matters by the match/replay/settlement source binding.

### 13.4.1 Match reward settlement

At match creation, freeze all match bindings above. At match end, reward generation uses **that match's** `echo_catalogue_version` and, for Official AI, the bound `ai_preset_version` difficulty. It must never read the current AI preset or current Echo reward formula.

Before exposing a reward batch, create one durable `reward_settlements` row whose payload contains at minimum:

- source match public ID/user;
- exact match reward inputs and relevant match-bound versions;
- deterministic acquisition seed/input needed to reproduce the rolls;
- generated Echo identity/magnitude/tier candidates;
- duplicate/Pareto choices still requiring player resolution;
- relevant naming version/presentation snapshot when exact result wording must survive deployment change.

Retrying or resolving the settlement consumes that payload. It does not reroll and does not re-evaluate reward count under current rules.

### 13.4.2 Gacha settlement

A paid Gacha request snapshots the then-active:

- `gacha_rules_version`;
- `echo_catalogue_version`;
- naming version needed for its result presentation;
- pity state before the transaction.

The complete generated batch and resulting pity transition are written to the settlement/audit payload before player resolution. A process restart/retry cannot change the rolls, pity result, or duplicate choices.

Changing the deployed active `gacha_rules_version` must not silently reinterpret or reset a persisted pity counter created under another version. A rules change that requires different pity-state meaning uses an explicit deterministic progression migration. Until that migration is complete, a paid pull either continues under the stored still-supported account version or rejects with a stable version-migration error; it never applies new rules to old pity state by accident.

---

# 14. Deployment, assets, and licensing

## 14.1 Deployment

V1 does not require zero-downtime old/new-build draining.

Planned maintenance may use:

```text
announce maintenance
stop Open Fufu
deploy / migrate
restart
verify health
```

Do not add multi-build draining/routing complexity unless future usage requires it.

## 14.2 Authoritative resource packaging

Inherited production packaging may assume the server never loads map/game resources. That assumption must be removed.

Authoritative/headless processes require deterministic access to the exact map artifact and every rule-bearing static input bound to a match. Browser-only assets should not be copied into match processes when unnecessary.

## 14.3 Proprietary assets

The inherited `proprietary/` directory is not a safe long-term dependency. Do not delete it until references are audited and replacements exist.

Inherited dependency inventory to audit includes:

- `proprietary/fonts/OpenFront.ttf`;
- OpenFront/favicon/logo images under `proprietary/images/`;
- inherited music under `proprietary/sounds/music/`.

Replacement direction is Open Fufu branding/favicon/logo, an original or permissively licensed UI font, original/permissively licensed music, removal of code/build references, then directory deletion.

Git history preserves removed assets' repository history; the active tree should not retain obsolete dependencies for archival purposes.

## 14.4 Licensing

OpenFront code is AGPL-3.0; applicable source and attribution obligations must remain satisfied. Asset provenance/license review is separate from source-code license compliance.

---

# 15. Test-driven validation and performance

Repository validation ownership and executable-code adoption are defined exclusively by [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md). This plan defines implementation sequencing and the kind of evidence each migration stage should produce; it does not broaden the current owned test surface by prose.

Inherited OpenFront tests are migration/characterization evidence by default. They do not become merge gates merely because the implementation area is related. New/adopted authoritative Open Fufu executable code and its validators must be explicitly registered together as required by `VALIDATION_POLICY.md`.

The key performance invariant remains:

> Authoritative simulation work scales primarily with active strategic work and engaged geometry, not dense `factions × cells` state products.

## 15.1 Default implementation loop

For each authoritative behavior or implementation slice:

```text
RED
write/extend focused owned tests for the canonical contract
        ↓
GREEN
implement the minimum correct behavior
        ↓
INVARIANTS / PROPERTIES
conservation, bounds, ordering, legality, determinism
        ↓
MICRO-SIM
exercise through real MatchRuntime on a tiny synthetic world
        ↓
REPLAY / REGENERATION
when authoritative state changes, reproduce it in a fresh runtime
        ↓
INTEGRATE
cross-domain / Origin / projection / operational tests as applicable
```

`RED` describes the development order; it does not require merging intentionally failing commits.

When a higher-cost scenario discovers a bug, add the regression at the **lowest practical validation tier** with the smallest reproduction. Long full-match/system tests should not be the only regression for a local bug when a focused unit or micro-sim reproducer is possible.

## 15.2 Validation cost tiers

| Tier | Scope | Intended use |
| --- | --- | --- |
| **A — contract/unit** | pure calculations, rule composition/materialization, schemas, Population accounting, capture arithmetic, structure admission, geometry, codecs, import/dependency guards | dominant edit loop; very fast |
| **B — micro-simulation** | real `MatchRuntime`, tiny synthetic map, multiple deterministic ticks/systems/actions | primary gameplay integration surface |
| **C — accelerated scenario/system** | larger worlds, many ticks, multiple systems/controllers, replay/regeneration, broader cross-domain cases | broader PR/release evidence where appropriate |
| **D — operational/performance** | production map artifacts, child processes, isolate workers, SQLite, browser/service protocol, simultaneous matches, long memory/GC/load runs | selective/scheduled/pre-release or explicit operational work |

Normal mechanic development must not require browser startup, wall-clock waiting, OS child-process creation, SQLite, or production-scale maps when the contract can be proved at Tier A/B.

### 15.2.1 Useful invariant/property families

Where applicable, validation should cheaply assert properties including:

- Population partitions and transfers obey the canonical accounting invariants;
- authoritative quantities never enter illegal negative/out-of-range states;
- normalized effective rules are independent of input selection/order wherever composition is declared commutative;
- semantically equivalent rational inputs normalize identically;
- same seed/version/input stream produces the same state/result;
- same-tick iteration/container ordering cannot change authoritative outcome where order is not canonical input;
- replay/regeneration state equals the original authoritative state;
- legal projection/hidden identifiers cannot be used as state/existence oracles;
- illegal/rejected controller decisions cannot partially mutate authoritative state.

State fingerprints are useful determinism evidence, but should not be the only assertion when meaningful structural assertions can provide better diagnostics.

## 15.3 GitHub Actions / CI migration contract

CI configuration is executable repository policy and must not be mirrored here as a mutable list of current workflows or pass/fail results.

Durable migration rules are:

- obey the current owned validation boundary in `VALIDATION_POLICY.md`;
- do **not** reactivate repository-wide inherited build/typecheck/lint/test suites as ordinary merge gates merely because implementation has begun;
- adopt/register new or extracted authoritative sources and focused validators in the same change that makes them maintained Open Fufu code;
- add mechanic, determinism, replay, sandbox, participant/service, persistence, packaging, and capacity gates only when the corresponding authoritative implementation exists;
- do not add fake/pass-through jobs in advance merely to make future gate names appear green;
- inherited contribution/deployment/release/stale-management/external-review workflows are not automatically Open Fufu policy;
- subsystem-specific mechanical checks remain owned with their implementation/canonical contracts even when CI invokes them centrally;
- repository-wide checks may become blocking later only through an explicit validation-policy-compatible adoption decision.

A green CI result proves only the checks actually configured for that exact commit. It must never be described as proof that unimplemented Open Fufu contracts already exist.

Gate families become relevant when their target implementation exists:

| Gate family | Activation condition |
| --- | --- |
| Simulation dependency firewall | `src/simulation/**` exists |
| Authoritative kernel contract/micro-sim tests | first `MatchRuntime` implementation |
| Migrated mechanic unit/integration tests | corresponding target mechanic/subsystem is implemented |
| Replay/regeneration equivalence | first authoritative state transitions; expands with later domains |
| Origin catalogue/composition/conformance | relevant effective-rule/domain implementation exists |
| Strategic/Random/Fixed spawn determinism | target spawn resolver/initialization pipeline exists |
| Controller sandbox/certification | isolated controller runtime/resource/fault model exists |
| Participant/service contract integration | gateway/API + snapshot/delta/resume/idempotency/authorization exist |
| Persistence migration/transaction/backup | SQLite persistence and migration runner exist |
| Map/Segment artifact reproducibility | canonical compiled map/Segment model exists |
| Authoritative resource packaging | server/headless packaging has exact bound resources |
| Deployment/release | actual Open Fufu deployable product topology exists |
| Capacity/performance | representative authoritative 1/3/5-match workloads exist |

## 15.4 Origin validation and catalogue certification

Origin validation is a **pre-live automated certification system**. Its purpose is to prove that the deployed trait catalogue, trait mechanics, meaningful trait interactions, and materially distinct Origin-driven gameplay transformations are safe, deterministic, and semantically correct before they reach production. It does not continuously re-prove mechanics during live matches.

The certification unit is the **trait catalogue and the transformations it can produce**, not the population of named Origins created from it. Ten, five thousand, or five million named Custom Origins built from one certified catalogue do not create corresponding runtime-test obligations.

### 15.4.1 Validation flow

Use five layers, ordered from cheapest/broadest to most runtime-expensive:

```text
1. CATALOGUE / SCHEMA / INTRINSIC VALIDATION
        ↓
2. TRAIT → GAMEPLAY-DOMAIN CONFORMANCE
        ↓
3. EXPLICIT TRAIT / CROSS-DOMAIN INTERACTIONS
        ↓
4. GENERATED LEGAL-COMBINATION PROPERTY VALIDATION
        ↓
5. DISTINCT RUNTIME-PROJECTION CERTIFICATION
        ↓
   CATALOGUE VERSION CERTIFIED
```

#### Layer 1 — catalogue / schema / intrinsic validation

The Origin layer owns checks that do not require a gameplay subsystem to execute the trait:

- stable/unique trait IDs and valid references;
- public builder budget/count/refund legality;
- Official-Origin legality under the same public builder;
- absence of hidden pairwise incompatibility/runtime-veto tables;
- deterministic canonical ordering/composition independent of source selection order;
- deterministic effective-profile serialization, hashing, and round-trip behavior;
- valid enums/ranges/structural values, with no `NaN`, infinity, or otherwise invalid effective state;
- exact catalogue/version binding.

This layer may enumerate every builder-legal selection when computationally practical. If future catalogue growth makes exhaustive enumeration unreasonable, preserve exhaustive low-order/boundary coverage and use deterministic property-based/generated legal selections for the remaining structural space. This layer is cheap composition/invariant validation, not a full-match simulation per selection.

#### Layer 2 — trait → gameplay-domain conformance

Every deployed trait must declare the gameplay domain or domains whose mechanics it affects or interacts with, or be explicitly classified as intrinsic-only when no runtime mechanic is involved. The validation metadata must therefore provide a mechanically checkable coverage graph from each deployed trait to its conformance owner(s); an unowned trait is a certification failure rather than an implicit pass.

A gameplay domain owns both its ordinary mechanic and the tests proving that the mechanic behaves correctly under the Origin transformations visible to that domain. The concrete validation-domain catalogue, deployed trait assignments, dependency relationships, and required integration/interaction seams are owned by [`ORIGIN_VALIDATION_COVERAGE.md`](./ORIGIN_VALIDATION_COVERAGE.md). This migration plan defines the certification architecture and deployment boundary; it does not duplicate those assignments or focused mechanics.

The dependency is an intersection, not `Origin → subsystem` ownership:

```text
canonical gameplay mechanic ──┐
                              ├─→ domain Origin-conformance tests
Origin-derived transformation ┘
```

#### Layer 3 — explicit trait / cross-domain interactions

Do not create an all-pairs compatibility test matrix. Dedicated combined tests are required only where traits can materially influence the same effective mechanic or where one Origin behavior genuinely crosses subsystem ownership boundaries.

Required special interactions must be explicit validation metadata. Same-domain cases are owned by that domain; genuine cross-domain cases name all participating owners and become runnable when all required implementations exist. Unrelated traits rely on their independent domain conformance plus composition/property validation rather than redundant combined simulations.

#### Layer 4 — generated legal-combination property validation

Generate or enumerate large sets of builder-legal selections and cheaply assert properties such as:

- builder acceptance and canonicalization;
- deterministic composition independent of selected-trait input order;
- stable serialization/hash and serialize/deserialize round trip;
- complete trait/domain coverage resolution;
- absence of unsupported transformations or invalid effective values.

This layer protects the public promise that awkward, inert, unofficial, or previously unseen legal combinations remain supported. It **must not** turn each legal selection into a separate headless full-match test.

#### Layer 5 — distinct runtime-projection certification

For expensive runtime scenarios, each Origin-affected gameplay domain defines a canonical **Origin projection** containing every Origin-derived input that domain is allowed to observe. All legal/generated Origins are projected into those domain-specific states, canonicalized, and deduplicated. The domain executes its canonical runtime scenario suite once per materially distinct projection rather than once per complete named Origin.

```text
legal/generated Origins
        ↓
domain projection
        ↓
canonicalize + hash
        ↓
deduplicate equivalent domain states
        ↓
run domain runtime scenarios
```

Projection deduplication is valid only when the projection contains **all** Origin-derived information observable by that subsystem. Omitting an observable input and thereby merging mechanically different states is a validation defect.

A domain's scenario suite should exercise mechanically distinct states/fallbacks/boundaries, not arbitrary full-game permutations. Exact scenarios remain owned by the subsystem that owns the underlying mechanic.

### 15.4.2 Determinism and replay evidence

Where an Origin interaction changes authoritative replayable state, determinism/replay assertions are part of that domain or cross-domain conformance evidence rather than a separate late Origin test phase. Same bound inputs, seed, versions, and Origin projection must produce the same authoritative result; where replay/regeneration exists, the independently reproduced state/output/hash must agree with the original execution.

A domain cannot claim full conformance while required replay support is absent merely because the mechanical happy path passes.

### 15.4.3 Validation status

Each required validation unit reports one of:

```text
UNAVAILABLE  validator/system does not exist yet
BLOCKED      validator exists or is planned, but a canonical dependency/semantic is unresolved
FAIL         required validation executed and failed
PASS         all required evidence for that unit is available and successful
```

`UNAVAILABLE` and `BLOCKED` are never aliases for `PASS`. These are durable certification-state values, not a project-status ledger in this document.

### 15.4.4 Catalogue deployment eligibility

For candidate Origin catalogue version `C`, deployment eligibility is an aggregate release predicate over existing evidence, not another implementation/runtime-test phase:

```text
DEPLOYABLE(C)
=
  intrinsic catalogue validation PASS
  AND complete trait → validation-domain coverage
  AND every required domain conformance result PASS
  AND every required explicit cross-domain interaction PASS
  AND every required determinism/replay obligation PASS
  AND all evidence binds the exact relevant catalogue/mechanic/version inputs
```

Any required `UNAVAILABLE`, `BLOCKED`, or `FAIL` result means the candidate is **not deployable**. There is no numbered final Origin implementation phase after gameplay domains; deployment aggregates the evidence those implementations already own.

### 15.4.5 When validation runs

Use three practical execution bands; exact workflow wiring is executable repository policy rather than a duplicated status table here.

**Fast development/PR validation** covers catalogue/schema/builder/composition/serialization/unit/coverage checks and other cheap relevant tests.

**Domain integration validation** runs when a trait or affected gameplay subsystem changes and covers relevant micro-sim/scenarios, Origin-domain conformance, explicit interactions, and applicable determinism/replay assertions.

**Catalogue/release certification** runs before deploying a new mechanical catalogue/build and aggregates broad generated-combination properties plus all affected domain/cross-domain certification evidence.

Recertification is dependency-driven:

- adding/removing/changing a trait, builder rule, Origin composition algorithm, effective-rule schema, or mechanical Origin serialization/version contract triggers broad relevant Origin recertification;
- changing one gameplay subsystem invalidates and reruns that domain's conformance plus dependent cross-domain/replay cases, not unrelated domain suites;
- presentation-only changes do not trigger mechanical recertification.

Validation evidence is valid only for the relevant versions it actually certified. Stale evidence must never certify changed mechanical inputs accidentally.

### 15.4.6 Live Origin validation

Live creation/load/match-start validation remains deliberately cheap:

- catalogue version is known and allowed;
- selected trait IDs exist in that version;
- public trait-count/point/refund rules pass;
- canonical composition/effective profile can be produced deterministically;
- serialized definition/profile is valid and bound to the match.

A live server does **not** launch background fuzzing, projection certification, or a headless match merely because a legal named Origin combination is new. A legal Origin built from a certified catalogue is trusted mechanically.

### 15.4.7 Neighboring validation boundaries

Official-AI Origin support remains a separate validation layer. Mechanical certification asks whether the game implements an Origin correctly and safely; Official-AI validation asks whether AI understands/responds to those mechanics. AI strategic quality is not the mechanical Origin deployment predicate.

Origin/Echo composition remains part of integration validation, but large identity catalogues must use effect/projection equivalence and property coverage rather than a Cartesian `every Origin × every Echo identity × every runtime scenario` test explosion.

---

# 16. Planned development-thread dependency/concurrency map

This section is a **durable dependency architecture**, not a pre-created GitHub backlog.

The logical thread labels below are descriptive categories only. They do **not** assign issue numbers, create issues, or freeze eventual issue titles/scopes. Concrete issues should be created only when their prerequisite gate is sufficiently stable to scope the work correctly.

## 16.1 Gate graph

```text
                       FOUNDATION GATE
                             |
                             v
              authoritative simulation kernel
              deterministic tick/test harness
              tiny map + faction/state skeleton
              EffectiveRules integration
              replay/fingerprint skeleton
                             |
                             v
                    LAND-SLICE GATE
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
          Population      Operations     Projection/
           accounting      + defense      controller
                            + capture       adapter
              |              |              |
              +--------------+--------------+
                             |
                             v
                 PLAYABLE HEADLESS SLICE
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
    map/navigation      controller host      physical game
      extraction          + sandbox             systems
          |                  |             structures/economy
          |                  |
          +---------+--------+------------------+
                    |
        +-----------+-----------+
        |                       |
        v                       v
     Segments                 Spawn
        |                       |
        +-----------+-----------+
                    |
                    v
             broader match/content
                    |
       +------------+-------------+-------------+
       |                          |             |
       v                          v             v
    naval/rail/                service/     participant/
     weapons                   process/       browser
                              persistence
       |                          |             |
       +------------+-------------+-------------+
                    |
                    v
             APPLICATION CUTOVER
```

This graph is schematic. A thread may split into several focused issues or several small PRs once real implementation boundaries are known.

## 16.2 Foundation gate

The foundation gate is satisfied only when the §3.2 walking-skeleton acceptance is implemented and owned validation passes.

Before that gate, avoid broad parallel gameplay implementation because the simulation boundary, state representation, test harness, deterministic scheduling, rule attachment, and replay/fingerprint seams are still shared architectural hotspots.

## 16.3 Land-slice gate

After the foundation stabilizes, Population/state accounting, land operation/defense/capture behavior, and observation/action integration may proceed as tightly coordinated but separable workstreams.

The land-slice gate is satisfied when the §8 fixed-world vertical slice runs through the real `MatchRuntime`, returns lawful next-state observation, and reproduces deterministically in a fresh runtime.

This gate establishes the first genuinely playable headless Open Fufu semantics and unlocks broad parallel fan-out.

## 16.4 Thread/gate table

| Logical development thread | Earliest prerequisite gate | Concurrency | Important downstream gate / consumer |
| --- | --- | --- | --- |
| Authoritative simulation foundation | revised canonical integration architecture | initially serialized; only tightly coordinated supporting work | all executable gameplay/runtime work |
| Population/state accounting | foundation | operation system and projection adapter once shared state contracts settle | land slice; economy; transport |
| Land operations/automatic defense/capture | foundation + Population contracts | projection/controller integration | land slice; AI; combat conformance |
| Observation/action runtime integration | foundation + required state vocabulary | Population/land mechanics | land slice; controller host; Official AI; participant projection |
| Map/navigation extraction | stable simulation map/navigation ports | controller runtime, physical systems, platform work | production maps; naval; rail; spawn |
| Controller isolated host/worker runtime | stable `ControllerHost` contract | map extraction, physical systems, platform | untrusted-controller deployment/certification |
| Structures/economy | land-slice foundations + effective-rule/state contracts | sandbox, navigation extraction, platform | richer matches; naval/rail; Official AI |
| Segment compiler/runtime | stable map-artifact/query ports | sandbox and physical-system work | production observation, strategic planning, spawn |
| Spawn systems | match initialization interface + relevant map/Segment support + pre-match controller boundary | physical systems/platform work | normal match lifecycle |
| Naval/rail/strategic weapons | relevant navigation + structures/economy foundations | service/browser/platform | feature-complete physical simulation |
| Official AI | lawful observation/action surface; fidelity expands as mechanics arrive | controller/runtime and later domain work | PvE readiness / accelerated validation |
| Match child process/supervisor | stable `MatchRuntime` lifecycle | sandbox and gameplay fan-out | deployed authoritative runtime |
| Persistence/service/auth integration | stable runtime/service lifecycle contracts | gameplay/physical-system work | durable hosted product |
| Participant/browser integration | stable legal projection + participant protocol implementation boundary | platform/game-domain work | visible playable product |
| Archival replay/resource packaging | foundation replay semantics + stable version/resource bindings | service/process/persistence | historical playback/deployable matches |
| Final application cutover | sufficient simulation + participant + platform readiness | narrowly coordinated cutover work only | retirement of inherited simulation authority |
| Legacy deletion | corresponding target has cut over and references are audited | ordinary focused cleanup PRs | migration completion |

## 16.5 Parallel-work rule

A development “thread” means a stable ownership area and a sequence of short-lived tested PRs, **not** a giant long-lived branch.

Foundation work is intentionally more serialized while high-coupling interfaces settle. After the land slice, parallelism should increase by keeping map/navigation, controller-host, physical systems, process/service, AI, and participant/browser work behind narrow interfaces rather than having all contributors edit `GameImpl`, `PlayerImpl`, `UnitImpl`, `ExecutionManager`, or `GameRunner`.

## 16.6 Cutover is a bounded special gate

Ordinary development continues to `main` through short-lived PRs.

If final application rewiring requires several mutually dependent server/client/runtime changes that cannot individually leave `main` in an acceptable state, a **temporary cutover integration branch** may be used only when it has:

- explicit finite scope;
- explicit coordinated ownership;
- a known base;
- a concrete runnable/validation acceptance condition;
- no unrelated feature work;
- mandatory merge-or-abandon retirement and remote cleanup.

This exception is for bounded application cutover, not for months of new-kernel development.

---

# 17. Migration audit coverage and inherited-source traceability

The migration must account for every inherited subsystem before transformation is declared complete:

| Inherited area | Target migration concern |
| --- | --- |
| repository/shared architecture | new simulation dependency direction / explicit adoption boundary |
| simulation authority/networking | authoritative `MatchRuntime`, process adapter, gateway boundary |
| ticks/Intents/Turns/Executions | new deterministic accepted-input/system architecture |
| map/cells/terrain/topology | narrow map ports + target terrain/Segment model |
| ownership/neutral expansion | Population/operation rules |
| troops/gold/resources/player state | new Population + FFY state |
| land combat/capture | new operation/combat model |
| structures | target persistent-structure state/systems |
| generic units | target mobile-unit state/systems |
| naval/amphibious/trade/rail | focused owners + extracted low-level algorithms where useful |
| strategic weapons/SAM | focused owners + extracted trajectory/interception algorithms where useful |
| teams/diplomacy/hostility | target fixed-team/game-wide rules |
| visibility | authoritative legal projection |
| bots | Official AI subsystem |
| match lifecycle/lobby/spawn/victory | target design + spawn + service protocol |
| replay/serialization/determinism | foundation regeneration + archival version binding |
| browser assumptions | observer/editor/debugger model |
| persistence/authentication | SQLite owner + auth owner |
| build/deployment/performance/assets/licensing | this plan |

## 17.1 Concrete inherited source-owner map

Paths below identify principal inherited owners/entry points to inspect. They are not claims that every helper is listed and they are not target architecture dependencies.

| Concern | Principal inherited source owner(s) | Default disposition | Target consequence |
| --- | --- | --- | --- |
| Server lobby / turn relay / reconnect | `src/server/GameServer.ts`, `GameManager.ts`, `MasterLobbyService.ts`, `SocketIngress.ts`, `src/core/Schemas.ts`, `ZbinWire.ts` | **REFERENCE / EXTRACT** | extract useful ingress/lobby/wire techniques if appropriate; replace Turn relay/client consensus as authority with target service/projection/runtime boundaries |
| Browser-local simulation | `src/core/GameRunner.ts`, `src/core/worker/Worker.worker.ts`, `WorkerClient.ts`, `WorkerMessages.ts` | **REFERENCE / REPLACE** | new `MatchRuntime` is not a moved `GameRunner`; browser worker may retain presentation/decoding roles only after cutover |
| Core state / mutation | `src/core/game/Game.ts`, `GameImpl.ts`, `PlayerImpl.ts`, `UnitImpl.ts`, `UnitGrid.ts`, `GameUpdates.ts` | **REFERENCE**, with selective **EXTRACT** of neutral storage/index primitives | build new state/system model; never expose broad inherited domain objects to `src/simulation/**` |
| Intent / Execution dispatch | `src/core/execution/ExecutionManager.ts`, `src/core/GameRunner.ts` | **REFERENCE** | new kernel owns accepted-input/system scheduling; extract only independent deterministic ordering/queue techniques if valuable |
| Map / terrain substrate | `GameMap.ts`, `GameMapLoader.ts`, `BinaryLoaderGameMapLoader.ts`, `FetchGameMapLoader.ts`, `TerrainMapLoader.ts`, `Maps.gen.ts` | **EXTRACT** | narrow cell/map/artifact interfaces; exact target semantics from focused owners |
| Pathfinding / water / rail | pathfinding modules, `WaterManager.ts`, rail graph/path modules | **EXTRACT** | characterize algorithms; replace broad `Game`/legacy unit dependencies with narrow navigation capabilities |
| Land attacks / retreat | `AttackImpl.ts`, `AttackExecution.ts`, `RetreatExecution.ts`, `PlayerImpl.ts` | **REFERENCE** | do not adopt Attack identity/lifecycle as target operations; extract only genuinely independent geometry/iteration techniques |
| Spawn | `SpawnExecution.ts`, `SpawnTimerExecution.ts`, `execution/utils/PlayerSpawner.ts`, `GameRunner.init()` | **REFERENCE / REPLACE** | target Strategic/Random/Fixed initialization from focused owner; reuse only neutral placement algorithms if independently valid |
| Persistent structures | `ConstructionExecution.ts`, `UpgradeStructureExecution.ts`, `CityExecution.ts`, `DefensePostExecution.ts`, `FactoryExecution.ts`, `PortExecution.ts`, `UnitImpl.ts` | **REFERENCE**, selective **EXTRACT** | implement target registry/state/system directly; salvage independent spatial/build algorithms only |
| Warships / Transport | `WarshipExecution.ts`, `MoveWarshipExecution.ts`, `TransportShipExecution.ts`, `TransportShipUtils.ts`, `WaterManager.ts`, water pathfinders | **REFERENCE / EXTRACT** | new target naval state/behavior; extract water/path/motion algorithms behind neutral ports |
| Trade / rail economy | `TradeShipExecution.ts`, `TrainExecution.ts`, `TrainStationExecution.ts`, `RailNetworkImpl.ts`, `Railroad.ts`, `TrainStation.ts`, rail pathfinder | **REFERENCE / EXTRACT** | new FFY/traffic semantics; salvage rail/path/physical-route algorithms where useful |
| Strategic weapons / SAM | `NukeExecution.ts`, `MIRVExecution.ts`, `MissileSiloExecution.ts`, `SAMLauncherExecution.ts`, `SAMMissileExecution.ts`, `ShellExecution.ts`, air/parabola pathfinders | **REFERENCE / EXTRACT** | new target weapon/structure state; extract trajectory/interception/math algorithms where independently valid |
| Inherited major AI | `NationExecution.ts`, `game/NationCreation.ts`, `execution/nation/*`, `execution/utils/AiAttackBehavior.ts` | **REFERENCE** | strategy ideas only; target Official AI consumes lawful observation/action surface |
| Inherited simple tribes | `TribeExecution.ts`, `TribeSpawner.ts` | **REFERENCE** | possible implementation evidence only; canonical Minor-Faction mechanics own target behavior |
| Visibility / client deltas | `GameUpdates.ts`, `GameUpdateUtils.ts`, `WorkerClient.ts`, `WorkerMessages.ts`, `ZbinWire.ts` | **REFERENCE / EXTRACT** | extract packing/encoding ideas if useful; target legal projection is server-side authoritative |
| Lobby/account HTTP schemas | `src/core/ApiSchemas.ts`, `src/core/Schemas.ts`, inherited `docs/API.md`, server routes | **REFERENCE / REPLACE** | implement target service/auth contracts rather than extending inherited API by default |
| Replay / archive | `src/server/Archive.ts`, `tests/replay/ReplayGame.ts`, `src/core/Schemas.ts`, `GameRunner.ts` | **REFERENCE / EXTRACT** | salvage deterministic harness techniques; replace client-produced canonical archive with server-authored bound replay |
| Authentication / join authorization | `JoinVerify.ts`, `IntentAuthorization.ts`, `Roster.ts`, inherited identity fields in `Schemas.ts` | **REFERENCE / REPLACE** | target auth/session boundary only; match gets resolved internal identity/configuration |
| Build / deploy / assets / licensing | `.github/workflows/`, `Dockerfile`, `package.json`, `vite.config.ts`, deployment scripts/config, `LICENSE-ASSETS`, `LICENSING.md`, `proprietary/`, `resources/` | **REFERENCE / EXTRACT / REPLACE** by concern | explicit Open Fufu validation/deploy/resource packaging; preserve licensing; replace unsafe proprietary dependencies after audit |
| Victory / stats | `WinCheckExecution.ts`, `Stats.ts`, `StatsImpl.ts`, finalization in `GameServer.ts` | **REFERENCE** | target result/stat production is server-authoritative and follows target design |

Origins, Echo progression, Segments, controller sandbox/runtime, Open Fufu persistence, and the new authoritative kernel are primarily new systems. Do not invent an inherited owner merely to fill this table.

---

# 18. Migration execution discipline

## 18.1 Before implementing a subsystem

1. Freshly follow repository rules and ownership requirements.
2. Identify/read the focused canonical owner(s) from `docs/README.md`.
3. Consult §17.1 for inherited implementation evidence and inspect neighboring call sites only as useful.
4. Define the new Open Fufu boundary/state/port first; do not begin by editing a legacy parent object unless the explicit task is an extraction/adoption.
5. Write/extend the focused owned test or validator first where practical.
6. Implement through the earliest satisfied gate in §16.
7. Add invariant/property and micro-sim evidence at the lowest practical tier.
8. Add replay/regeneration evidence whenever authoritative replayable state changes.
9. Register/adopt any new or extracted executable source/tests exactly as `VALIDATION_POLICY.md` requires.
10. Add cross-domain/Origin/AI/participant/operational evidence only where the canonical dependency actually applies.

Update this migration plan only for migration strategy, sequencing, topology, persistence/versioning, branch/cutover, or source-traceability facts. Do not copy focused subsystem mechanics back into this file as implementation notes.

## 18.2 Legacy-extraction decision rule

```text
legacy component
      ↓
Is a narrow algorithm/data structure genuinely valuable?
      |
   no | yes
      |  ↓
      | characterize useful behavior
      |  ↓
      | define neutral port
      |  ↓
      | can it be extracted without dragging broad legacy domain state?
      |       | yes
      |       v
      |    extract/adopt + focused tests
      |
      | no
      v
rewrite/reference against the new port
```

Reuse is a means, not a goal. Fewer copied lines are not an architectural success if they preserve a domain model the target game is replacing.

## 18.3 Git/tag workflow

Ordinary migration workflow:

```text
main
  |
  +-- immutable pre-runtime baseline tag
  |
  +<- short-lived claimed topic PRs
  |
  +<- new kernel grows beside inherited runtime
  |
  +-- headless/playable milestone tags when useful
```

Do not create a long-lived parallel rewrite branch merely to keep old code comparable; Git history and the immutable baseline tag provide that comparison while `main` stays the single moving truth.

The pre-runtime baseline tag is created after this integration architecture is accepted on `main` and immediately before the first executable authoritative-simulation implementation begins.

## 18.4 Legacy deletion rule

A target replacement existing is not, by itself, sufficient reason to delete the inherited implementation.

Delete an inherited area when either:

1. target cutover means nothing useful still depends on/references it; or
2. continued presence creates material ambiguity/risk that new code will accidentally depend on the wrong architecture.

Before deletion, audit references and preserve any still-useful algorithm through the ordinary extraction/adoption path.

## 18.5 Application cutover

Final cutover means production/application authority begins flowing through the new kernel, for example:

- server/match process creates `MatchRuntime` rather than inherited simulation authority;
- participant/controller state comes from target legal projection;
- browser consumes authoritative target protocol/state rather than simulating canonical game logic;
- archival replay/result production is server-authored from target runtime bindings;
- inherited authority entrypoints become unused.

A bounded temporary cutover branch may be used only under §16.6. After cutover is validated and merged, remove the temporary branch and retire unused inherited authority in focused cleanup PRs.

## 18.6 Completion principle

The migration is complete when the active product no longer depends on inherited OpenFront authority/domain architecture for canonical Open Fufu semantics, all deliberately retained/extracted executable code is explicitly owned and validated, and remaining inherited code/assets are either intentionally retained for a documented compatible purpose or removed.
