# Open Fufu — Canonical OpenFront Integration Plan

## Status and ownership

This document is the **canonical owner for transforming the OpenFront fork into Open Fufu**. It owns migration strategy, implementation sequencing, authoritative-runtime topology, controller-runtime isolation, persistence architecture, deterministic version binding, inherited-source traceability, deployment implications, and integration validation.

It does **not** restate target gameplay mechanics. Those belong to the focused canonical owners listed in [`README.md`](./README.md). The high-level target game is defined by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md).

Inherited OpenFront architecture documents remain current-state evidence only.

No gameplay implementation is authorized merely by this plan.

---

# 1. Migration strategy

The OpenFront fork is a strong basis for Open Fufu and should **not** be rewritten from scratch.

Retain OpenFront's useful dense map/cell engine, deterministic Execution machinery, pathfinding/connectivity infrastructure, generic unit/structure lifecycle plumbing, renderer foundations, lobby/network infrastructure, and performance tooling where they fit the target design.

Replace or substantially adapt inherited assumptions that conflict with Open Fufu, especially:

- browser/client simulation authority;
- turn relay as authoritative simulation;
- inherited troop/gold/population formulas;
- inherited land-combat semantics;
- mutable diplomacy;
- inherited victory/progression assumptions;
- unrestricted engine objects as a player-controller API;
- inherited spawn semantics;
- inherited bot cheats/privileged state.

A useful implementation seam exists between high-level input and deterministic state mutation.

Inherited conceptual path:

```text
human input
→ Intent
→ Turn
→ Execution
→ Game mutation
```

Target conceptual path:

```text
legal controller observation / pre-match hooks
→ transactional controller decision
→ validated persistent directives + one-shot commands
→ deterministic simulation work
→ canonical Game mutation
```

Origins, Echoes, terrain, structures, units, and rulesets feed the same explicit rule-bearing simulation. They do not bypass the controller/action boundary.

---

# 2. Migration ownership matrix

| OpenFront/inherited area | Migration action | Open Fufu target owner |
| --- | --- | --- |
| Dense raster map/cells | Keep/adapt | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) |
| Deterministic tick/Execution machinery | Keep/adapt | this plan + `OPEN_FUFU_DESIGN.md` |
| Client-authoritative simulation | Replace | this plan |
| Browser rendering/camera/map visualization | Keep heavily | this plan |
| Pathfinding/water/rail graph | Keep/adapt | target subsystem owners |
| Generic unit/build lifecycle | Keep/adapt internally | target subsystem owners |
| Inherited spawn selection | Replace/adapt | [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) |
| Map strategic regions | Add | [`SEGMENTS.md`](./SEGMENTS.md) |
| Scalar troop state | Adapt into global Population | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) |
| Inherited Attack/combat semantics | Reuse structure selectively; replace rules | `OPEN_FUFU_DESIGN.md`, [`COMBAT_TUNING.md`](./COMBAT_TUNING.md) |
| Persistent defensive allocation / redeployment model | Do not build | `OPEN_FUFU_DESIGN.md` |
| Inherited worker/troop gold | Replace | [`FFY_ECONOMY.md`](./FFY_ECONOMY.md) |
| Terrain/public terrain semantics | Extend/translate | [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) |
| Structures / Defense Post | Adapt/extend | `TERRAIN_AND_STRUCTURES.md` |
| Factory land unit | Add baseline Tank chassis | `TERRAIN_AND_STRUCTURES.md` |
| Origin unit/structure transformations | Add typed rule hooks | [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) |
| Naval/amphibious/strategic weapons | Keep/adapt | [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md) |
| Trade Ships / Factory Trains / piracy economy | Keep/adapt | `FFY_ECONOMY.md` |
| Origin system | Add | `ORIGIN_TRAIT_CATALOGUE.md`, [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md) |
| Echo system | Add | [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md) |
| Existing bots | Reuse strategy ideas selectively; replace privileged behavior | [`official-ai/OFFICIAL_AI_ARCHITECTURE.md`](./official-ai/OFFICIAL_AI_ARCHITECTURE.md) |
| Mutable alliances/relations | Remove/replace | `OPEN_FUFU_DESIGN.md` |
| Operational visibility | Replace with authoritative projection | `OPEN_FUFU_DESIGN.md` + target structure/controller contracts |
| Public controller surface | Add | [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts) |
| Controller persistent memory | Add | [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md) |
| External identity/authentication | Replace | [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md) |
| Open Fufu service/browser/game protocol | Add | [`service/README.md`](./service/README.md) |
| Open Fufu runtime persistence | Add | this plan |
| Proprietary OpenFront assets | Replace/remove after dependency audit | this plan |

This table identifies ownership. Concrete inherited source ownership is mapped in §17.1.

---

# 3. Headless core boundary

OpenFront's shared deterministic core should remain the simulation foundation but must become browser-independent.

Required dependency direction:

```text
core simulation
    ↑
authoritative match runtime
    ↑
validated controller decisions

core-derived legal observations
    ↓
controller runtime / participant protocol
```

Imports from browser/client presentation code into shared simulation code must be removed or placed behind neutral interfaces.

## Acceptance condition

A Node/headless process can:

- load the exact versioned map/rules/configuration required by a match;
- execute pre-match initialization/spawn;
- run the complete authoritative simulation;
- determine the result;
- produce a deterministic replay record;
- replay the match;
- run without DOM/browser presentation imports.

---

# 4. Authoritative server and process topology

Each live match has exactly **one canonical server simulation**. Browsers never determine simulation progress, winner state, canonical hashes, spawn resolution, or authoritative statistics.

## 4.1 V1 process model

Use **one OS child process per active authoritative match**.

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

This gives match-level crash containment, independent V8 heaps/GC, simple termination/resource accounting, straightforward profiling, and natural multi-core use.

Worker-thread or pooled multi-match processes are future optimizations only if measurements justify them.

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

Adapt the inherited full-game performance harness where useful.

---

# 5. Player-controller runtime isolation

Player controller code must not execute with unrestricted access inside the authoritative match process.

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

## 5.1 V1 runtime limits

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

## 5.2 Runtime faults

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

## 5.3 Worker pool

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

## 5.4 Deterministic parallelism

Controllers may execute concurrently against immutable snapshots of the same canonical pre-state. Completion order must never create gameplay advantage; collected results commit/resolve deterministically.

---

# 6. Controller decision integration

Retain the useful deterministic Execution pattern rather than replacing it wholesale.

Open Fufu distinguishes:

- lifecycle/admin commands;
- pre-match spawn decisions;
- controller strategic decisions;
- deterministic simulation transitions.

A normal controller callback observes one immutable legal projection and submits a proposed final decision set. The authoritative runtime validates and commits game-facing effects transactionally.

Persistent directives remain active until changed/ended. One-shot commands execute once. Source order inside one returned decision must not be treated as imperative mutation order unless an individual command contract explicitly says otherwise.

Population commitment changes are immediate on successful decision commit; there is no generic land deployment/redeployment queue.

Provisional cadence:

```text
simulation:           10 Hz
controller decisions:  2 Hz
```

Accelerated/headless simulation executes the same logical ticks without real-time waiting.

The public TypeScript surface is [`ControllerApi.ts`](../src/core/controller/ControllerApi.ts). This document owns the runtime adapter and authoritative integration around that public surface, not a duplicate API definition.

Controller memory uses only the canonical semantics from [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md).

---

# 7. Map, spawn, Segments, and terrain migration

## 7.1 Dense map substrate

Retain/adapt OpenFront's compact integer cell references, typed-array map storage, deterministic adjacency, ownership mutation, water/pathfinding primitives, authored map loading, and optimized iteration.

The target cell/Population invariants are owned by `OPEN_FUFU_DESIGN.md`.

## 7.2 Strategic Spawn

Replace the inherited spawn phase with the deterministic protocol, resolver, fallback, conflict resolution, Initial Territory generation, replay binding, and profile semantics defined exclusively by [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md).

Migration work is to wire that contract into:

- pre-match participant/controller lifecycle;
- authoritative map ownership initialization;
- Origin effective spawn profiles;
- Random/Fixed alternatives;
- replay/diagnostics;
- browser participant state.

Do not re-derive spawn geometry in this plan.

## 7.3 Segments

Add the immutable map-compiled Segment layer defined exclusively by [`SEGMENTS.md`](./SEGMENTS.md).

Migration work includes compiler integration, map-artifact/version/hash binding, efficient runtime queries/summaries, and controller projection.

## 7.4 Terrain

Translate the inherited terrain substrate to the canonical base-terrain/Fallout model in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md).

Map compilation, pathing classes, ownership bookkeeping, rendering, observation projection, and replay must all consume the same versioned terrain semantics rather than independent switch-table copies.

Procedural/random map generation, if introduced, must produce the same canonical terrain/Segment artifact model deterministically from seed/version.

---

# 8. Population, operations, defense, and combat migration

The global Population model, Capacity invariant, operation/frontage model, automatic defense, counter-response semantics, ordinary capture casualties, and game-wide land-combat invariants are owned by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). Exact capture/counter-response arithmetic is owned by [`COMBAT_TUNING.md`](./COMBAT_TUNING.md).

Migration direction:

- adapt useful scalar troop storage into one global whole-integer Population state;
- add explicit Available/Committed/Transport accounting;
- keep fractional recurring mechanics in deterministic residual state where canonical rules require them;
- reuse Attack identity/lifecycle/border plumbing where useful, but replace inherited combat semantics;
- represent land action as sparse operations/frontage rather than a dense faction×cell Population field;
- derive binary automatic defense ephemerally from active threatened geometry and Available Population;
- add controller defensive priorities without persistent defensive allocation;
- add active counter-response as a separate operation-vs-operation commitment;
- remove inherited global defender/casualty/difficulty bonuses that are not part of the target rules;
- ensure same-faction operation fragmentation cannot manufacture pressure;
- ensure newly captured cells cannot create same-tick conquest chains;
- keep neutral-settlement accounting distinct from hostile combat.

Simulation cost must scale primarily with active strategic work/frontage rather than full faction×map products.

---

# 9. Structures, economy, units, naval, and strategic weapons

Do not maintain target mechanics in this plan. Implement each subsystem from its owner:

- terrain, persistent structures, baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- FFY, Factory Trains, Trade Ships, piracy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Warships, Transports, strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Origin transformations of those systems: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

Migration work should reuse OpenFront infrastructure where compatible:

- generic spatial structure build/upgrade/capture lifecycle;
- generic unit identity/movement/health/deletion state;
- rail graph and physical Train movement/events;
- water connectivity and naval pathing;
- missile trajectory/interception infrastructure;
- SAM targeting/interception machinery;
- physical Trade Ship world traffic;
- autonomous naval movement/combat/repair lifecycle.

Public game concepts must not be forced to mirror inherited internal class names. In particular, inherited implementation ancestry may remain temporarily useful while the public target concept is different.

Typed effective-rule hooks should carry Origin/Echo/ruleset transformations rather than hard-coded pairwise compatibility exceptions in unit/structure implementations.

---

# 10. Origins, Echoes, and Official AI

## 10.1 Origins

Origins are declarative versioned rule data. Implement catalogue/builder/runtime projection from:

- [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md).

Production validation must enforce the public builder/catalogue rules without hidden pairwise compatibility tables. Effective Origin rules must serialize/hash deterministically and project through the ordinary rules/controller surface.

Mechanical certification applies to the deployed trait catalogue and the distinct gameplay transformations/interactions that catalogue can produce, **not to each named Official or Custom Origin as a separate runtime artifact**. Creating or loading a legal named Origin from a certified catalogue requires only ordinary catalogue-version, trait-ID, builder-legality, canonical-composition, and serialization checks; live matches do not launch background/headless certification for previously unseen named combinations.

Origin validation is distributed to the gameplay domains that own the affected mechanics. Catalogue/intrinsic validation belongs with the Origin layer; runtime conformance belongs with the relevant subsystem; genuine cross-domain interactions receive explicit integration coverage. [`ORIGIN_VALIDATION_COVERAGE.md`](./ORIGIN_VALIDATION_COVERAGE.md) owns the concrete validation-domain assignments, dependency relationships, integration seams, and explicit interaction obligations. This plan owns the certification architecture and deployment-eligibility predicate in §15.2. There is no monolithic Origin runtime-validation phase in the dependency spine.

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

The authoritative match process must generate legal projections **before** information reaches a controller, gateway, or browser:

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

Retain OpenFront rendering/camera/map visualization heavily where useful, but remove browser authority.

Live/reconnect synchronization uses the semantic contract in [`service/PARTICIPANT_PROTOCOL.md`](./service/PARTICIPANT_PROTOCOL.md): authoritative legal snapshot, ordered incremental observer deltas, bounded resume, and fresh snapshot on resync when needed.

A reconnecting browser does not replay the entire historical action stream merely to reconstruct current state.

Browser roles include match viewing, controller authoring/debugging, replay, Origin/Echo workflows, lobby/spawn UI, and diagnostics. Exact subsystem UI semantics come from their canonical owners.

## 11.3 Participant/service protocol

The canonical external boundary is [`service/README.md`](./service/README.md):

- [`service/SERVICE_API.md`](./service/SERVICE_API.md) owns HTTP/control-plane resources;
- [`service/PARTICIPANT_PROTOCOL.md`](./service/PARTICIPANT_PROTOCOL.md) owns the live participant/spectator stream.

This migration plan owns only the runtime/process/persistence work needed to implement those contracts. It does not duplicate endpoint, message-envelope, or reconnect semantics.

## 11.4 Replay

The canonical archival replay is a compact deterministic record of exact versioned match bindings, authoritative pre-match/spawn resolution, and committed simulation-affecting inputs/actions required to reproduce the match from tick zero.

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

# 15. Validation and performance

Retain/adapt useful TypeScript/build/test infrastructure, Vitest/server tests, full-game performance tooling, replay harnesses, map/pathfinding algorithms, and profiling tools.

Remove tests that assert intentionally removed OpenFront behavior and replace them with Open Fufu owner-defined invariants.

The integration test strategy must cover:

- headless authoritative match execution;
- deterministic replay from exact bound inputs/actions;
- controller sandbox isolation/fault containment;
- immutable legal observation projection;
- transaction/decision commit semantics;
- authoritative resource packaging/version binding;
- cross-system Origin/Echo effective-rule composition;
- spawn/Segment/map artifact determinism;
- participant reconnect/snapshot/delta behavior;
- service-resource/idempotency behavior;
- persistence migrations/transactions/backup/cleanup;
- authentication boundary integration without leaking credentials into matches;
- long-match memory/GC;
- representative 1/3/5-match capacity benchmarks.

Subsystem-specific mechanical tests belong with their canonical owners and implementation modules rather than being copied into this plan.

The key performance invariant is:

> Authoritative simulation work scales primarily with active strategic work and engaged geometry, not dense `factions × cells` state products.

## 15.1 GitHub Actions / CI migration contract

CI configuration is executable repository policy and must not be mirrored here as a mutable list of currently active workflows or current check results.

Durable migration rules are:

- preserve a clean-install, build/typecheck, and lint baseline while inherited runtime behavior is being replaced;
- add mechanic, determinism, replay, sandbox, participant/service, persistence, packaging, and capacity gates when the implementation that makes those contracts authoritative exists;
- do not add fake/pass-through jobs in advance merely to make a future gate name appear green;
- inherited OpenFront contribution, deployment, release, stale-management, or external-review workflows are not automatically Open Fufu policy merely because they existed upstream;
- workflow-specific scripts with no remaining Open Fufu consumer should not be retained solely as historical evidence; Git history preserves them;
- repository-wide formatting/generated-artifact checks should become blocking only when the repository has an explicit compatible baseline, rather than forcing unrelated inherited drift into feature work;
- subsystem-specific mechanical checks remain owned with their implementation/canonical contracts even when CI invokes them centrally.

A green CI result proves only the checks actually configured for that exact commit. It must never be described as proof that unimplemented Open Fufu contracts, headless/replay/runtime architecture, deployment, or release packaging already exist.

The intended gate families are:

| Gate family | Activation condition |
| --- | --- |
| Baseline install/build/typecheck/lint | repository development baseline |
| Migrated mechanic unit/integration tests | corresponding target mechanic/subsystem is implemented |
| Origin catalogue/composition/conformance validation | relevant Origin/effective-rule and validation owners are executable |
| Strategic/Random/Fixed spawn determinism | target Spawn resolver and Initial-Territory pipeline exist |
| Headless full-match execution | authoritative match process can complete a match without browser/client authority |
| Replay hash equivalence | server-authored bound replay artifacts can reproduce canonical match state/results |
| Controller sandbox/certification | isolated controller runtime and resource/fault model exist |
| Participant/service contract integration | gateway/API plus snapshot/delta/resume/idempotency/authorization are implemented |
| Persistence migration/transaction/backup checks | SQLite persistence and migration runner exist |
| Map/Segment artifact reproducibility | canonical Open Fufu map compiler/artifact model exists |
| Authoritative resource packaging | headless/server packaging has exact rule/map resource inputs |
| Deployment/release checks | actual Open Fufu deployment/release topology is defined |
| Capacity/performance gates | representative authoritative workloads exist for the 1/3/5-match planning envelope |

When a new implementation creates authoritative behavior, its validation must land with it or before it becomes deployable. Changes to the cross-cutting CI architecture belong to this integration owner; individual workflow presence and pass/fail state remain in repository configuration/CI, not in this canonical plan.

## 15.2 Origin validation and catalogue certification

Origin validation is a **pre-live automated certification system**. Its purpose is to prove that the deployed trait catalogue, trait mechanics, meaningful trait interactions, and materially distinct Origin-driven gameplay transformations are safe, deterministic, and semantically correct before they reach production. It does not continuously re-prove mechanics during live matches.

The certification unit is the **trait catalogue and the transformations it can produce**, not the population of named Origins created from it. Ten, five thousand, or five million named Custom Origins built from one certified catalogue do not create corresponding runtime-test obligations.

### 15.2.1 Validation flow

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

### 15.2.2 Determinism and replay evidence

Where an Origin interaction changes authoritative replayable state, determinism/replay assertions are part of that domain or cross-domain conformance evidence rather than a separate late Origin test phase. Same bound inputs, seed, versions, and Origin projection must produce the same authoritative result; where replay/regeneration exists, the independently reproduced state/output/hash must agree with the original execution.

A domain cannot claim full conformance while required replay support is absent merely because the mechanical happy path passes.

### 15.2.3 Validation status

Each required validation unit reports one of:

```text
UNAVAILABLE  validator/system does not exist yet
BLOCKED      validator exists or is planned, but a canonical dependency/semantic is unresolved
FAIL         required validation executed and failed
PASS         all required evidence for that unit is available and successful
```

`UNAVAILABLE` and `BLOCKED` are never aliases for `PASS`. These are durable certification-state values, not a project-status ledger in this document.

### 15.2.4 Catalogue deployment eligibility

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

Any required `UNAVAILABLE`, `BLOCKED`, or `FAIL` result means the candidate is **not deployable**. There is no numbered "final Origin validation" subsystem after the gameplay implementations; deployment merely aggregates the conformance evidence those implementations already own.

### 15.2.5 When validation runs

Use three practical execution tiers; exact CI/workflow wiring is executable repository policy rather than a duplicated status table here.

**Fast development/PR validation** should cover catalogue/schema/builder/composition/serialization/unit/coverage checks and other cheap relevant tests.

**Domain integration validation** runs when a trait or affected gameplay subsystem changes and covers relevant headless scenarios, Origin-domain conformance, explicit interactions, and applicable determinism/replay assertions.

**Catalogue/release certification** runs before deploying a new mechanical catalogue/build and aggregates broad generated-combination properties plus all affected domain/cross-domain certification evidence.

Recertification should be dependency-driven:

- adding/removing/changing a trait, builder rule, Origin composition algorithm, effective-rule schema, or mechanical Origin serialization/version contract triggers broad relevant Origin recertification;
- changing one gameplay subsystem invalidates and reruns that domain's conformance plus dependent cross-domain/replay cases, not unrelated domain suites;
- presentation-only changes such as display wording, icons, or editor layout do not trigger mechanical recertification.

Validation evidence is valid only for the relevant versions it actually certified. The implementation may rerun suites rather than persist a complex certification database in V1, but stale evidence must never certify changed mechanical inputs accidentally.

### 15.2.6 Live Origin validation

Live creation/load/match-start validation remains deliberately cheap:

- catalogue version is known and allowed;
- selected trait IDs exist in that version;
- public trait-count/point/refund rules pass;
- canonical composition/effective profile can be produced deterministically;
- serialized definition/profile is valid and bound to the match.

A live server does **not** launch background fuzzing, projection certification, or a headless match merely because a legal named Origin combination is new. A legal Origin built from a certified catalogue is trusted mechanically.

### 15.2.7 Neighboring validation boundaries

Official-AI Origin support remains a separate validation layer. Mechanical certification asks whether the game implements an Origin correctly and safely; Official-AI validation asks whether AI understands/responds to those mechanics. The mandatory three-layer semantic audit still applies, but AI strategic quality is not the mechanical Origin deployment predicate.

Origin/Echo composition remains part of integration validation, but large identity catalogues must use effect/projection equivalence and property coverage rather than a Cartesian `every Origin × every Echo identity × every runtime scenario` test explosion.

CI/workflow selection, scheduling, and blocking-check policy are executable repository policy; §15.2 defines what evidence is meaningful, not how a particular CI provider executes it.

---

# 16. Migration dependency spine

High-level implementation order:

```text
1. HEADLESS CORE CLEANUP
       ↓
2. AUTHORITATIVE MATCH PROCESS + SUPERVISOR
       ↓
3. OPEN FUFU FACTION / POPULATION + TYPED EFFECTIVE-RULE HOOKS
       ↓
4. SEGMENTS + TERRAIN + CONTACT / OBSERVATION MODEL
       ↓
5. LAND OPERATIONS + FRONTAGE + AUTOMATIC DEFENSE + SETTLEMENT
       ↓
6. CONTROLLER API RUNTIME INTEGRATION
       ↓
7. CONTROLLER SANDBOX / WORKER POOL + CERTIFICATION
       ↓
8. ORIGIN CATALOGUE / CREATOR + INTRINSIC / COMPOSITION VALIDATION
   + ECHO CORE REGISTRY / ACQUISITION
       ↓
9. STRATEGIC / RANDOM / FIXED SPAWN + INITIAL TERRITORY
   + SPAWN ORIGIN-CONFORMANCE
       ↓
10. STRUCTURE / ECONOMY / NAVAL / RAIL / STRATEGIC-WEAPON / ARMOR TRANSLATION
    + DOMAIN-OWNED ORIGIN-CONFORMANCE AS EACH DOMAIN IS IMPLEMENTED
       ↓
11. OFFICIAL PVE AI + MATCH LIFECYCLE + REPLAY / PARTICIPANT INTEGRATION
    + APPLICABLE CROSS-DOMAIN / REPLAY CONFORMANCE
       ↓
12. SQLITE + AUTH/IDENTITY INTEGRATION + GAME/SERVICE API
       ↓
13. ECHO NAMING/PRESENTATION DATA
       ↓
14. BROWSER EDITOR / DEBUG / ORIGIN / ECHO / LOBBY UX
```

Some workstreams may overlap. Typed rule hooks should exist before content depends on them. Validation follows mechanic ownership: the Origin layer validates catalogue legality/composition, and each Origin-affected gameplay subsystem supplies its own conformance evidence when that subsystem exists. Genuine cross-domain cases become runnable when their participating systems exist.

There is deliberately **no second/final Origin implementation step** after the runtime domains. Origin-catalogue deployment eligibility is the aggregate release predicate in §15.2.4 over catalogue, domain, cross-domain, and determinism/replay evidence. The spine therefore does not require an impossible pre-implementation runtime certification and does not duplicate completed domain tests in a later monolithic gate.

The shorthand spine does not imply that an Origin interaction may be ignored merely because its gameplay owner is not named as a standalone numbered step. Every deployed trait must still have complete validation ownership. If required implementation/evidence is unavailable or a canonical semantic dependency is unresolved, its conformance result remains `UNAVAILABLE` or `BLOCKED` under §15.2.3; that status does not authorize changing the trait merely to make validation green. Exact mechanics remain with their focused canonical owners.

---

# 17. Migration audit coverage and source traceability

The migration must account for every inherited subsystem before implementation declares the transformation complete:

| Inherited area | Target migration concern |
| --- | --- |
| repository/shared architecture | headless/core dependency direction |
| simulation authority/networking | authoritative match process and gateway boundary |
| ticks/Intents/Turns/Executions | deterministic controller-decision integration |
| map/cells/terrain/topology | target map/terrain/Segment model |
| ownership/neutral expansion | Population/operation rules |
| troops/gold/resources/player state | Population + FFY replacement |
| land combat/capture | target operation/combat model |
| structures | target persistent-structure registry |
| generic units | target mobile-unit concepts |
| naval/amphibious/trade/rail | naval + FFY owners |
| strategic weapons/SAM | strategic-weapon + structure owners |
| teams/diplomacy/hostility | target fixed-team/game-wide rules |
| visibility | authoritative legal projection |
| bots | Official AI subsystem |
| match lifecycle/lobby/spawn/victory | target design + spawn + service protocol |
| replay/serialization/determinism | authoritative replay/version binding |
| browser assumptions | observer/editor/debugger model |
| persistence/authentication | SQLite owner + auth owner |
| build/deployment/performance/assets/licensing | this plan |

## 17.1 Concrete inherited source-owner map

Paths below identify the principal inherited owners/entry points to inspect; they are not claims that every helper used by the concern is listed. When an inherited path is moved or removed, update this source-traceability map rather than preserving a dead path for history.

| Concern | Principal inherited source owner(s) | Inherited role | Target owner | Migration consequence | Validation |
| --- | --- | --- | --- | --- | --- |
| Server lobby / turn relay / reconnect | `src/server/GameServer.ts`, `GameManager.ts`, `MasterLobbyService.ts`, `SocketIngress.ts`, `src/core/Schemas.ts`, `ZbinWire.ts` | admits clients, queues Intents, broadcasts Turns, reconnects clients, encodes inherited wire | this plan + `service/*` | retain useful ingress/lobby/wire plumbing, but remove Turn relay/client consensus as simulation authority; route live viewers through target participant projection | authoritative server match continues with zero browsers; reconnect snapshot/resume tests |
| Browser-local simulation | `src/core/GameRunner.ts`, `src/core/worker/Worker.worker.ts`, `WorkerClient.ts`, `WorkerMessages.ts` | browser worker reconstructs Game and executes received Turns locally | this plan | move GameRunner-like execution server-side/headless; remove `GameRunner` client/HUD dependency; browser worker may remain presentation/decoding only | headless full match without DOM/client imports; browser receives projection only |
| Core state / mutation substrate | `src/core/game/Game.ts`, `GameImpl.ts`, `PlayerImpl.ts`, `UnitImpl.ts`, `UnitGrid.ts`, `GameUpdates.ts` | inherited state interfaces, ownership/player/unit mutation and update generation | high-level/focused mechanics owners + this plan | retain/adapt efficient state containers/indexes; replace inherited troop/gold/diplomacy/mechanics semantics | owner invariants + deterministic state/replay tests |
| Intent → Execution dispatch | `src/core/execution/ExecutionManager.ts`, `src/core/GameRunner.ts` | converts inherited Turn Intents into deterministic Executions | this plan + `ControllerApi.ts` | keep Execution seam; replace external Intent/Turn authority with validated controller decisions + simulation transitions | atomic decision tests; deterministic execution ordering |
| Map / terrain substrate | `GameMap.ts`, `GameMapLoader.ts`, `BinaryLoaderGameMapLoader.ts`, `FetchGameMapLoader.ts`, `TerrainMapLoader.ts`, `Maps.gen.ts` | dense map storage/loading/topology | `OPEN_FUFU_DESIGN.md`, `TERRAIN_AND_STRUCTURES.md`, `SEGMENTS.md` | retain/adapt compact cell/map infrastructure; compile target terrain and Segment artifacts into exact map binding | map hash, terrain, Segment determinism |
| Land attacks / retreat | `AttackImpl.ts`, `AttackExecution.ts`, `RetreatExecution.ts`, `PlayerImpl.ts` | sparse attacks, border resolution, troop transfer/casualties | `OPEN_FUFU_DESIGN.md`, `COMBAT_TUNING.md` | reuse identity/lifecycle/border machinery selectively; replace rules with operations/frontage/automatic defense/counter-response/capture model | combat fixtures + anti-fragmentation/same-tick-chain tests |
| Spawn | `SpawnExecution.ts`, `SpawnTimerExecution.ts`, `execution/utils/PlayerSpawner.ts`, `GameRunner.init()` | inherited player/random spawn phase and placement | `STRATEGIC_SPAWN.md` | replace behavior with Strategic/Random/Fixed protocol and versioned resolver; reuse only suitable map-placement primitives | spawn resolver/reveal/fallback/footprint tests |
| Persistent structures | `ConstructionExecution.ts`, `UpgradeStructureExecution.ts`, `CityExecution.ts`, `DefensePostExecution.ts`, `FactoryExecution.ts`, `PortExecution.ts`, `UnitImpl.ts` | inherited build/upgrade/unit-backed structure lifecycle | `TERRAIN_AND_STRUCTURES.md` | reuse generic construction/unit plumbing where compatible; translate structure registry and remove inherited-only semantics | structure cost/time/placement/effect fixtures |
| Warships / Transport | `WarshipExecution.ts`, `MoveWarshipExecution.ts`, `TransportShipExecution.ts`, `TransportShipUtils.ts`, `WaterManager.ts`, water pathfinders | naval movement/combat/pathing and amphibious transport | `NAVAL_AND_STRATEGIC_WEAPONS.md` | reuse motion/water/pathing infrastructure; replace controller/control and exact target mechanics | autonomous targeting, move-only control, embark/landing/return tests |
| Trade / rail economy | `TradeShipExecution.ts`, `TrainExecution.ts`, `TrainStationExecution.ts`, `RailNetworkImpl.ts`, `Railroad.ts`, `TrainStation.ts`, rail pathfinder | physical Trade Ships, Trains, stations and rail graph | `FFY_ECONOMY.md` | retain useful physical traffic/rail graph; replace timing/cargo/FFY/piracy rules with canonical owner | deterministic routes/events/payout/interception tests |
| Strategic weapons / SAM | `NukeExecution.ts`, `MIRVExecution.ts`, `MissileSiloExecution.ts`, `SAMLauncherExecution.ts`, `SAMMissileExecution.ts`, `ShellExecution.ts`, air/parabola pathfinders | projectile, launch, interception and blast infrastructure | `NAVAL_AND_STRATEGIC_WEAPONS.md`, `TERRAIN_AND_STRUCTURES.md` | reuse trajectory/interception infrastructure selectively; replace costs/access/blast/charge semantics | weapon geometry/interception/charge/replay tests |
| Inherited major AI | `NationExecution.ts`, `game/NationCreation.ts`, `execution/nation/*`, `execution/utils/AiAttackBehavior.ts` | privileged engine-level Nation/bot behavior | `official-ai/OFFICIAL_AI_ARCHITECTURE.md` + registered child/config owners | retain algorithms/strategy ideas only; target Official AI must consume the lawful controller observation/action surface | same-information/action parity + character/Origin validation |
| Inherited simple tribes | `TribeExecution.ts`, `TribeSpawner.ts` | simple non-human territorial actors | `MINOR_FACTIONS.md` | possible implementation ancestry only; replace with canonical Minor-Faction mechanics | deterministic placement/behavior tests |
| Visibility / client deltas | `GameUpdates.ts`, `GameUpdateUtils.ts`, `WorkerClient.ts`, `WorkerMessages.ts`, `ZbinWire.ts` | full-client simulation update/packing and worker bridge | `OPEN_FUFU_DESIGN.md`, `service/PARTICIPANT_PROTOCOL.md` | reuse packing/encoding ideas where useful, but generate viewer-specific legal projections server-side | hidden-information, snapshot/delta/gap/resync tests |
| Lobby/account HTTP schemas | `src/core/ApiSchemas.ts`, `src/core/Schemas.ts`, inherited `docs/API.md`, server route modules | inherited OpenFront HTTP/game/lobby contracts | `service/SERVICE_API.md`, `AUTH_AND_IDENTITY.md` | treat old routes/schemas as evidence only; implement target resources/auth boundary instead of extending inherited public API by default | service contract/idempotency/authorization tests |
| Replay / archive | `src/server/Archive.ts`, `tests/replay/ReplayGame.ts`, `src/core/Schemas.ts`, `GameRunner.ts` | uploads client-produced GameRecord; headless harness replays archived Turns/hashes | this plan + `service/SERVICE_API.md` | keep deterministic replay-harness technique, replace external archive/client-consensus record with server-authored bound replay artifact | exact-version replay hash equivalence + retention/integrity tests |
| Authentication / join authorization | `JoinVerify.ts`, `IntentAuthorization.ts`, `Roster.ts`, inherited identity fields in `Schemas.ts` | inherited admission/session/intent authority | `AUTH_AND_IDENTITY.md` | replace conflicting auth assumptions; pass only resolved internal participant identity into match runtime | auth/session/Origin/CSRF/WS integration tests |
| Build / deploy / assets / licensing | `.github/workflows/`, `Dockerfile`, `package.json`, `vite.config.ts`, `build.sh`, `build-deploy.sh`, `deploy.sh`, `nginx.conf`, `supervisord.conf`, `LICENSE-ASSETS`, `LICENSING.md`, `proprietary/`, `resources/` | inherited/current build, workflow, deployment, process, asset, and license inputs | this plan | maintain meaningful baseline CI and add gates with authoritative implementations; adapt target packaging/deployment; replace proprietary dependencies after reference audit; preserve required source/asset licensing obligations | reproducible target build/deploy, authoritative resource-loading test, asset-reference/provenance audit, meaningful Open Fufu CI |
| Victory / stats | `WinCheckExecution.ts`, `Stats.ts`, `StatsImpl.ts`, finalization in `GameServer.ts` | inherited victory/stat collection and client-assisted final reporting | `OPEN_FUFU_DESIGN.md` + this plan | replace target victory semantics and make result/stat production server-authoritative | deterministic terminal result/stat/replay tests |

A row marked `add` in §2 with no inherited principal owner is a genuinely new subsystem; do not invent an OpenFront owner merely to fill the table. Origins, Echo progression, Segments, controller sandbox/runtime, and Open Fufu persistence are primarily new systems, though they integrate with the inherited seams above.

---

# 18. Migration execution discipline

Before implementation begins in a subsystem:

1. consult §17.1 for inherited principal source owners and inspect neighboring call sites as needed;
2. identify the single target canonical owner;
3. verify the target owner is mechanically/architecturally closed enough for implementation;
4. implement through the dependency spine;
5. validate against that owner and cross-system invariants;
6. update this migration plan only for migration/sequencing/source-traceability changes.

Do not copy focused subsystem mechanics back into this file as implementation notes.
