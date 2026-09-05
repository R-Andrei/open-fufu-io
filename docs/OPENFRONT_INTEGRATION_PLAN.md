# Open Fufu — Canonical OpenFront Integration Plan

## Status and ownership

This document is the **canonical owner for transforming the current OpenFront fork into Open Fufu**. It owns migration strategy, implementation sequencing, authoritative-runtime topology, controller-runtime isolation, persistence architecture, deployment implications, and integration validation.

It does **not** restate target gameplay mechanics. Those belong to the focused canonical owners listed in [`README.md`](./README.md). The high-level target game is defined by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md).

Inherited OpenFront architecture documents remain current-state evidence only.

No gameplay implementation is authorized merely by this plan.

---

# 1. Migration strategy

The current fork is a strong basis for Open Fufu and should **not** be rewritten from scratch.

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

A useful implementation seam already exists between high-level input and deterministic state mutation.

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
legal controller observation / pre-match hooks
→ transactional controller decision
→ validated persistent directives + one-shot commands
→ deterministic simulation work
→ canonical Game mutation
```

Origins, Echoes, terrain, structures, units, and rulesets feed the same explicit rule-bearing simulation. They do not bypass the controller/action boundary.

---

# 2. Migration ownership matrix

| OpenFront/current area | Migration action | Open Fufu target owner |
| --- | --- | --- |
| Dense raster map/cells | Keep/adapt | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) |
| Deterministic tick/Execution machinery | Keep/adapt | this plan + `OPEN_FUFU_DESIGN.md` |
| Client-authoritative simulation | Replace | this plan |
| Browser rendering/camera/map visualization | Keep heavily | this plan |
| Pathfinding/water/rail graph | Keep/adapt | target subsystem owners |
| Generic unit/build lifecycle | Keep/adapt internally | target subsystem owners |
| Current spawn selection | Replace/adapt | [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) |
| Map strategic regions | Add | [`SEGMENTS.md`](./SEGMENTS.md) |
| Scalar troop state | Adapt into global Population | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) |
| Current Attack/combat semantics | Reuse structure selectively; replace rules | `OPEN_FUFU_DESIGN.md`, [`COMBAT_TUNING.md`](./COMBAT_TUNING.md) |
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
| Existing bots | Reuse strategy ideas selectively; replace privileged behavior | [`official-ai/README.md`](./official-ai/README.md) |
| Mutable alliances/relations | Remove/replace | `OPEN_FUFU_DESIGN.md` |
| Operational visibility | Replace with authoritative projection | `OPEN_FUFU_DESIGN.md` + target structure/controller contracts |
| Public controller surface | Add | [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts) |
| Controller persistent memory | Add | [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md) |
| External identity/authentication | Replace | [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md) |
| Open Fufu service/browser/game protocol | Add | **canonical target owner not yet established** |
| Open Fufu runtime persistence | Add | this plan |
| Proprietary OpenFront assets | Replace/remove after dependency audit | this plan |

This table identifies ownership. It does not substitute for the source-level current-owner traceability work required before implementation of each migration area.

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

The public TypeScript surface is [`ControllerApi.ts`](../src/core/controller/ControllerApi.ts). Its detailed contract reconciliation is separate from this migration plan; this document owns the runtime adapter and authoritative integration around that public surface, not a duplicate API definition.

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
- naval patrol/combat/repair lifecycle.

Public game concepts must not be forced to mirror inherited internal class names. In particular, inherited implementation ancestry may remain temporarily useful while the public target concept is different.

Typed effective-rule hooks should carry Origin/Echo/ruleset transformations rather than hard-coded pairwise compatibility exceptions in unit/structure implementations.

---

# 10. Origins, Echoes, and Official AI

## 10.1 Origins

Origins are declarative versioned rule data. Implement catalogue/builder/runtime projection from:

- [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md).

Production validation must enforce the public builder/catalogue rules without hidden pairwise compatibility tables. Effective Origin rules must serialize/hash deterministically and project through the ordinary rules/controller surface.

The exhaustive Origin deployment gate remains part of the migration dependency spine and validation work. Its exact staging relative to runtime mechanic completion is handled in the sequencing batch rather than duplicated as trait mechanics here.

## 10.2 Echoes

Implement Echo identity, acquisition, retained rolls, duplicate settlement, rewards, generated naming, Echo Sets, Middle Fingers, and Gacha only from [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md).

The public source repository may contain reusable Echo contracts/algorithms/versioned naming configuration. Live account progression remains runtime/private persistence.

This plan owns only the persistence/runtime integration required to support that canonical subsystem.

## 10.3 Official AI

Treat inherited Nation AI as behavioral/implementation reference, not as the target public contract.

Official PvE AI must consume lawful Open Fufu observations/actions and must not retain simulation cheats, hidden information access, or privileged gameplay rules.

The Official-AI subsystem is owned by [`official-ai/README.md`](./official-ai/README.md) and its canonical child/configuration files. Echo reward consequences are owned by `ECHO_CATALOGUE.md`.

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

Live/reconnect synchronization should use:

```text
authoritative legal snapshot
→ incremental observer deltas
→ fresh snapshot on resync when needed
```

A reconnecting browser should not replay the entire historical action stream merely to reconstruct current state.

Browser roles include match viewing, controller authoring/debugging, replay, Origin/Echo workflows, lobby/spawn UI, and diagnostics. Exact subsystem UI semantics come from their canonical owners.

## 11.3 Participant/service protocol

The concrete external/browser/game service API and participant protocol require one canonical contract. Do not distribute endpoint/event-envelope/reconnect semantics across unrelated subsystem documents.

This migration plan establishes the architectural boundary but does not own that missing protocol definition.

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
user_id              INTEGER NOT NULL REFERENCES users(id)
name                 TEXT NOT NULL
created_at_ms        INTEGER NOT NULL
updated_at_ms        INTEGER NOT NULL
archived_at_ms       INTEGER
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

Derived Echo quality/score is recomputed from retained magnitudes and the bound catalogue rather than stored as a second authority.

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
user_id              INTEGER NOT NULL REFERENCES users(id)
source_type          TEXT NOT NULL
source_id            TEXT NOT NULL
rules_version        TEXT NOT NULL
status               TEXT NOT NULL
payload_json         TEXT NOT NULL
created_at_ms        INTEGER NOT NULL
applied_at_ms        INTEGER

UNIQUE(user_id, source_type, source_id)
```

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
created_at_ms         INTEGER NOT NULL
expires_at_ms         INTEGER NOT NULL
revoked_at_ms         INTEGER
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

Current relevant inventory:

- `proprietary/fonts/OpenFront.ttf`;
- OpenFront/favicon/logo images under `proprietary/images/`;
- inherited music under `proprietary/sounds/music/`.

Replacement work is Open Fufu branding/favicon/logo, an original or permissively licensed UI font, original/permissively licensed music, removal of code/build references, then directory deletion.

Git history preserves the removed assets' repository history; the active tree should not retain obsolete dependencies for archival purposes.

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
- persistence migrations/transactions/backup/cleanup;
- authentication boundary integration without leaking credentials into matches;
- long-match memory/GC;
- representative 1/3/5-match capacity benchmarks.

Subsystem-specific mechanical tests belong with their canonical owners and implementation modules rather than being copied into this plan.

The key performance invariant is:

> Authoritative simulation work scales primarily with active strategic work and engaged geometry, not dense `factions × cells` state products.

---

# 16. Migration dependency spine

Current high-level implementation order:

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
8. ORIGIN CATALOGUE / CREATOR + EXHAUSTIVE DEPLOYMENT GATE
   + ECHO CORE REGISTRY / ACQUISITION
       ↓
9. STRATEGIC / RANDOM / FIXED SPAWN + INITIAL TERRITORY
       ↓
10. STRUCTURE / ECONOMY / NAVAL / RAIL / STRATEGIC-WEAPON / ARMOR TRANSLATION
       ↓
11. OFFICIAL PVE AI + MATCH LIFECYCLE + REPLAY / PARTICIPANT INTEGRATION
       ↓
12. SQLITE + AUTH/IDENTITY INTEGRATION + GAME/SERVICE API
       ↓
13. ECHO NAMING/PRESENTATION DATA
       ↓
14. BROWSER EDITOR / DEBUG / ORIGIN / ECHO / LOBBY UX
```

Some workstreams may overlap. Typed rule hooks should exist before content depends on them. This sequence is itself part of the migration plan and must be corrected when sequencing analysis identifies an impossible validation dependency rather than worked around during implementation.

---

# 17. Migration audit coverage

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

The concrete inherited **source-file owner → target owner** map remains a required implementation-traceability artifact for this same plan; it must be added here rather than creating another competing migration document.

---

# 18. Remaining migration work

The principal remaining work is implementation and the already-identified unresolved contract/mechanics closures, not creation of more overlapping documentation.

Before implementation begins in a subsystem:

1. identify the inherited concrete source owners;
2. identify the single target canonical owner;
3. verify the target owner is mechanically/architecturally closed enough for implementation;
4. implement through the dependency spine;
5. validate against that owner and cross-system invariants;
6. update this migration plan only for migration/sequencing/source-traceability changes.

Do not copy focused subsystem mechanics back into this file as implementation notes.
