# Open Fufu — Canonical OpenFront Integration Plan

## Status and authority

This document is the **single canonical Open Fufu integration, migration, and upgrade plan** for transforming the current OpenFront fork into Open Fufu.

It is deliberately a work in progress. Sections marked **Accepted** record migration decisions that have already been agreed. Sections marked **Provisional** or **Open** must not be treated as implementation authorization or settled architecture.

The target game design is defined by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), which remains the single canonical Open Fufu design contract and takes precedence over this document if the two ever conflict.

This document defines **how the existing OpenFront codebase should be reused, adapted, replaced, or extended to reach that target**.

Future accepted migration decisions should update this file rather than creating competing Open Fufu upgrade-plan documents. Older OpenFront architecture/refactor documents may remain useful historical or upstream references, but they are not normative for the Open Fufu migration.

No gameplay implementation is authorized merely by the existence of this plan. Major migration stages require explicit implementation approval.

---

## 1. Audit conclusion — Accepted

The current fork is a strong basis for Open Fufu and should **not** be rewritten from scratch.

The broad migration strategy is:

> Keep OpenFront's cell/map engine, deterministic execution machinery, pathfinding, many unit/structure mechanics, rendering foundations, substantial lobby/network infrastructure, and test/performance tooling. Replace the client-authoritative match model and the central scalar-troop/attack/resource semantics. Build Open Fufu's Population, controller, visibility, progression, and persistence systems around the retained deterministic core.

The useful architectural seam already present in the codebase is the separation between high-level input and deterministic `Execution` objects that mutate canonical game state.

Conceptually, the current path is approximately:

```text
human input
→ Intent
→ Turn
→ Execution
→ Game mutation
```

The intended Open Fufu path should instead become conceptually:

```text
controller observation
→ transactional controller decision
→ validated directives/actions
→ deterministic simulation work
→ canonical Game mutation
```

The exact server/controller boundary is still open and is treated separately below.

---

## 2. Accepted subsystem classification

| Area | Migration classification |
| --- | --- |
| Dense cell/map representation | **Keep / Adapt** |
| Deterministic tick and Execution machinery | **Keep / Adapt** |
| Pathfinding, water connectivity, rail graph | **Keep** |
| Generic unit/build lifecycle | **Keep / Adapt** |
| Renderer, camera, map visualization foundations | **Keep heavily** |
| Server lobby/roster/socket/auth-gate/telemetry infrastructure | **Keep / Adapt** |
| Client-authoritative simulation | **Replace** |
| Turn relay as simulation authority | **Replace** |
| Client hash/winner/live-stat consensus as authority | **Remove** |
| Scalar `troops` warfare model | **Replace** |
| Current `Attack` / `AttackExecution` land-war semantics | **Replace** |
| Passive worker gold | **Remove** |
| Current troop growth/capacity model | **Replace** |
| Global Easy/Medium/Hard gameplay difficulty scalar | **Remove** |
| Official-AI simulation cheats | **Remove** |
| Mutable alliances/relations diplomacy | **Remove** |
| Current partial-territory/overtime/doomsday victory rules | **Replace / Remove** |
| Spatial Population commitment and Redeployment | **New** |
| Immutable strategic Segments | **New** |
| Runtime-derived territorial Contacts | **New** |
| Secure operational visibility/observation model | **New** |
| Player controller runtime/sandbox | **New** |
| Controller publishing/certification/memory/diagnostics | **New** |
| Open Fufu FFY/account item/progression systems | **New** |
| Open Fufu-owned persistent backend | **New / Adapt surrounding auth/session infrastructure** |

---

## 3. Core/headless boundary — Accepted

OpenFront's shared deterministic core should be retained as the foundation, but it must become genuinely browser-independent.

The desired dependency direction is:

```text
core simulation
    ↑
authoritative match runtime
    ↑
controller execution

core-derived observer protocol
    ↓
browser viewers
```

The core must not depend on browser presentation helpers. Existing imports from `src/client` into shared simulation code should be removed or moved behind neutral formatting/event interfaces as part of the migration.

### Acceptance condition

A Node/headless process can load a map, run an entire match, determine its result, produce a replay record, and replay the match without importing DOM/browser/client-presentation code.

---

## 4. Simulation authority — Open, with accepted requirements

The **exact server authority architecture is intentionally not yet locked**. It is the next major design/engineering question to settle before this plan becomes a staged implementation roadmap.

However, the following product requirements are already accepted and constrain every valid solution:

- a match must continue without any connected browser;
- browser disconnects must not determine simulation progress or outcome;
- Foof or another trusted service must be able to start matches without a browser player acting as authority;
- headless tournaments and batch simulations must be possible;
- deterministic replay/testing must not depend on a live browser;
- player controller code must not receive privileged access merely because it runs close to authoritative state;
- normal browser clients should eventually become viewers/editor/debugger surfaces rather than moment-to-moment authoritative command clients.

The current OpenFront architecture does not satisfy these requirements because the game server primarily relays turns while clients run the simulation and participate in hash/winner/live-stat consensus.

### Performance implications of authority choices

The current OpenFront **server** is exceptionally cheap per match because it does not run the map simulation. That does not mean the current **match as a whole** is cheap: every participating player or spectator runs a duplicate full simulation.

A server-authoritative architecture moves CPU and memory cost onto the game host but removes duplicated client simulations.

Conceptually:

```text
Current 4-player + 3-spectator match
≈ relay server + 7 full simulations

Single-authority target
≈ 1 canonical simulation + controller runtimes + 7 lightweight observer streams
```

Expected resource direction:

| Resource | Current model | Server-authoritative direction |
| --- | --- | --- |
| Game-server CPU | Very low | **Higher** |
| Game-server RAM | Very low | **Higher** |
| Client CPU | Full simulation per viewer | **Much lower** |
| Client RAM | Full simulation state per viewer | **Lower** |
| Total duplicated simulation work | Scales with viewers | **Usually much lower** |
| Outbound server bandwidth | Mostly compact turns/intents | **Likely higher** because state projections/deltas must be sent |
| Headless/no-client execution | Poor fit | **Natural** |
| Hidden-information security | Cannot be robust | **Can be enforced** |

For a one-player/headless match, a single-authority design approximately moves the one simulation from a browser to the server and adds controller-runtime overhead. As player/spectator count rises, total-system compute increasingly favors one canonical simulation rather than N replicas.

This comparison is independent of one additional fact: **Open Fufu's cell-level Population model will itself be more expensive than OpenFront's scalar troop model**, regardless of authority. We therefore must not infer Fufubox match capacity from current OpenFront server load.

Before locking worker counts or simultaneous-match capacity, we require real measurements on the intended server hardware for:

- one live authoritative Open Fufu match;
- multiple simultaneous matches;
- accelerated headless matches;
- controller-runtime overhead;
- Population-field memory;
- observer projection/delta construction;
- controller certification workloads.

No fixed concurrency target is accepted yet.

---

## 5. Tick, decision, and Execution model — Accepted

The deterministic Execution pattern should be retained rather than replaced wholesale.

Open Fufu must distinguish three layers:

```text
lifecycle/admin commands
controller strategic decisions
simulation executions/state transitions
```

Player controllers must not simply become another source of today's browser wire intents.

A controller invocation operates transactionally against one legal immutable observation. On successful validation, its memory/directive changes commit together. On failure, all temporary changes are discarded and the match continues according to the controller failure rules in the design contract.

The existing execution/state-mutation machinery should be reused wherever its semantics still match the new game.

### Acceptance condition

Controller failure cannot partially mutate authoritative match state, and deterministic state mutation remains centrally ordered.

---

## 6. Map, cells, terrain, and topology — Accepted

The current dense integer `TileRef`/typed-array map substrate is a primary reuse target.

Retain and adapt:

- integer cell references;
- compact terrain storage;
- deterministic adjacency;
- ownership lookup/mutation infrastructure;
- water-component/pathfinding support;
- authored map compilation/loading;
- impassable terrain support;
- map-scale optimized iteration patterns.

### New static Segment layer

Every initial map cell, including water and impassable cells, will belong to one immutable Segment generated or compiled from static geography.

Likely supporting data includes a compact `segmentIdByTile` representation plus immutable Segment metadata and adjacency information. Exact representation remains an implementation decision.

Segments are a controller/query lens and **must not become the physical simulation resolution**.

Dynamic terrain changes such as strategic-weapon effects must not silently regenerate Segment identity.

### Random maps

Procedural/random map generation is a new Open Fufu capability. The existing authored-map compiler is retained, while the procedural generation pipeline will eventually need to produce terrain and the same immutable Segment model deterministically from a seed/version.

### Acceptance condition

Changing only artificial Segment boundaries cannot alter a match unless a controller itself changes behavior in response to the changed metadata.

---

## 7. Ownership and neutral expansion — Accepted

Retain and adapt the low-level cell ownership machinery, including incremental territory/border bookkeeping.

Do not retain old attack semantics merely because ownership changes currently flow through them.

Neutral expansion becomes an ordinary result of Population commitment and cell-level simulation rather than a special old `AttackExecution` path.

V1 neutral settlement must not inherit arbitrary automatic colonization deaths.

### Acceptance condition

Ownership changes remain deterministic and incremental, but all neutral capture/expansion rules come from the Open Fufu Population model.

---

## 8. Faction resources and Population state — Accepted

The existing scalar troop/gold gameplay model is a semantic replacement zone.

The future faction state is centered on at least:

- Population;
- Population Capacity;
- Growth Potential;
- reserve Population;
- desired spatial Population commitments;
- actual spatial Population commitments;
- FFY;
- structures and mobile units;
- fixed team state;
- derived `atWar` state;
- exact controller version binding;
- PvE loadout where applicable.

The current scalar `troops` value must not remain the authoritative military representation.

`gold` may be mechanically migrated toward FFY storage, but generic passive population/worker income must be removed. FFY is produced by explicit economic/world events defined by the design contract.

Difficulty-specific hidden Population/growth multipliers for official AI must also be removed.

---

## 9. Land combat — Accepted

The current `Attack`/`AttackExecution` land-war model should be replaced rather than incrementally mutated into Open Fufu warfare.

Open Fufu resolves military effects at the finest meaningful world resolution: cells.

Reusable lower-level primitives include:

- cell adjacency;
- terrain lookup;
- cell ownership mutation;
- nearby-structure queries;
- deterministic iteration/event infrastructure.

The old global attack-stack model, global defender troop-density substitute, bulk conquest semantics, and hidden large-territory combat bonuses must not leak into the replacement combat system.

### Acceptance condition

Authoritative land combat never substitutes a faction-wide troop scalar for actual local Population commitment/pressure.

---

## 10. Spatial Population commitment and Redeployment — Accepted

This is a new core subsystem.

The system must represent, per faction, the relationship among:

- desired Population distribution;
- actual Population distribution;
- reserve;
- deficits/excesses awaiting movement;
- explicit Redeployment capacity/rate.

The exact internal representation is not yet locked.

### Critical performance invariant

OpenFront maps may contain millions of cells, so a naive dense allocation matrix of:

```text
number of factions × number of cells × desired/actual values
```

is not acceptable.

The implementation should be sparse or otherwise compact over strategically active/non-zero commitments, with efficient indexes for both faction-oriented and cell-oriented simulation/query work.

Segments and runtime Contacts may provide efficient higher-level query/indexing views without becoming simulation buckets.

### Acceptance condition

Stress testing must demonstrate that Population-allocation memory does not scale as a full dense `players × mapCells` matrix.

---

## 11. Structures — Accepted

Retain the generic spatial structure lifecycle where useful:

- build legality;
- construction duration;
- under-construction state;
- ownership/capture;
- levels/upgrades;
- health/destruction;
- type-specific execution behavior.

Individual semantics will be adapted to Open Fufu rather than inherited blindly.

Initial direction:

| Structure | Migration direction |
| --- | --- |
| City | Adapt toward explicit Capacity/Growth effects |
| Defense Post | Adapt toward surfaced local defensive effects |
| Port | Keep naval role; adapt trade/FFY rules |
| Factory | Preserve rail/economic identity initially |
| Missile Silo | Preserve strategic-weapon infrastructure |
| SAM Launcher | Preserve interception identity |
| Structure upgrades/levels | Keep framework |

No structure should recreate a hidden global Military Power stat.

Any future rail/structure Redeployment modifier must be explicit and surfaced rather than silently inherited.

---

## 12. Generic units/mobile objects — Accepted

Retain and adapt the existing generic unit framework rather than replacing it during the first migration.

Useful retained concepts include:

- stable unit IDs;
- owner;
- current/previous cell;
- movement;
- target tile/unit information;
- health;
- deletion;
- ownership transfer;
- construction state;
- upgrades/levels;
- type-specific runtime state.

Transport unit troop payloads map naturally to **carried Population** under the new model.

Presentation/client dependencies must be removed from authoritative unit logic.

---

## 13. Naval, amphibious, trade, and rail — Accepted

These systems are substantially reusable but require semantic adaptation.

### Transport ships

Retain physical carried Population, deterministic water pathing, interception/destruction, retreat, and landing movement.

Replace the current landing transition into old `AttackExecution` with normal Open Fufu cell-level operational commitment/combat.

### Trade ships

Retain the core world-event model:

```text
Port
→ TradeShip
→ physical route
→ successful arrival/capture
→ economic event
```

Convert rewards to FFY and apply the explicit Open Fufu wartime trade rules rather than mutable alliance/embargo rules.

### Trains and rail

Retain physical train/rail infrastructure and explicit economic stop/arrival events where compatible.

Do not automatically grant rail a Redeployment advantage in V1. Any such effect must be added later as an explicit designed modifier.

### Warships

Retain and adapt physical patrol, combat, transport interception, piracy, retreat/repair, health, and veterancy mechanics where they remain useful.

Friend/enemy decisions must be translated to the fixed-team/FFA/derived-`atWar` Open Fufu relationship model.

---

## 14. Strategic weapons and SAM — Accepted

Retain strategic weapon physical identity and substantial existing deterministic infrastructure:

- silo launch;
- missile flight/trajectory;
- warning/visibility events where allowed;
- SAM interception;
- detonation radius;
- spatial structure/unit/terrain effects.

Replace old damage semantics that operate directly on global troop/attack-stack state or mutable alliances.

Population casualties must be expressed through the new explicit Population model.

### Acceptance condition

Strategic weapon execution no longer depends on old scalar-troop warfare or mutable alliance APIs.

---

## 15. Teams, diplomacy, trade relationships, and `atWar` — Accepted

Retain fixed pre-match teams.

Remove mutable alliance/relation diplomacy as a core match system.

FFA opponents remain attackable regardless of `atWar`.

`atWar` becomes symmetric derived recent-hostility state as defined by the design contract rather than a permission gate.

Wartime trade remains possible and receives explicit Open Fufu penalties/modifiers rather than being represented as ordinary embargo prohibition.

Existing troop/gold donation mechanics must not survive merely because they exist upstream. Any future team transfer mechanic requires a deliberate Open Fufu design decision.

---

## 16. Visibility and observer projection — Provisional pending authority decision

The product requirement is accepted: knowing global geography/ownership/public macro statistics must not imply access to hidden enemy operational deployment or controller state.

The exact implementation depends on the server-authority architecture still to be settled.

A likely conceptual separation is:

```text
Global public information
    terrain
    ownership
    immutable Segments
    Population
    Territory %
    FFY

Faction operational observation
    own detailed state
    legally visible local enemy pressure
    legally visible mobile units/structures
    runtime contact information

Private controller state
    never exposed to opponents/ordinary viewers
```

The controller must receive a legal observation surface rather than unrestricted direct access to complete simulation internals.

Official PvE AI should obey the same gameplay-information boundary even if its trusted implementation does not require the same hostile-code sandbox.

This section will be finalized alongside the authority architecture.

---

## 17. Official AI and player controller boundary — Accepted

OpenFront's compositional AI behavior pattern is useful design precedent, but existing Nation AI must not remain the privileged gameplay API.

Player controllers and official PvE controllers should reason over substantially the same primitive game observation/action contract.

The trust distinction is expected to be:

```text
player controller
→ hostile/untrusted sandbox

official controller
→ trusted runtime
```

not:

```text
official controller
→ omniscient/cheating simulation access
```

Global Easy/Medium/Hard gameplay difficulty and hidden AI resource multipliers are not part of Open Fufu.

---

## 18. Lobby, match lifecycle, and UI — Accepted direction; presentation details deferred

Substantial lobby/roster/network lifecycle infrastructure may be reusable internally, but Open Fufu's **lobby UI and user experience are expected to change significantly**.

Do not preserve existing lobby presentation or interaction flows merely because their backend machinery is retained.

Useful backend concepts may include:

- roster management;
- players vs spectators/viewers;
- private/public match lifecycle primitives;
- fixed-team assignment;
- reconnect/session handling;
- match creation/start lifecycle;
- trusted service/API-driven match creation.

The eventual Open Fufu lobby UX, controller selection, loadout selection, PvE setup, Foof integration, and viewer flow will be designed separately.

### Victory/lifecycle rules

Replace inherited partial-territory/overtime/doomsday victory behavior with the Open Fufu victory/capitulation/resignation rules in the design contract.

No match should end because an inherited OpenFront 80/95% threshold, overtime rule, or Doomsday mechanic fired.

Exact defeat-state cleanup/inheritance behavior for remaining territory/structures is still an implementation/design detail to settle.

---

## 19. Replay, records, determinism, and observability — Provisional pending authority decision

Retain the strong deterministic replay philosophy and existing headless replay/performance tooling as foundations.

The exact live-record format depends on the authority architecture still to be settled.

Historical match identity must eventually bind every rule-bearing input required for deterministic reconstruction, including at least the versioned inputs defined by the design contract:

- ruleset version;
- map and Segment generator/version/hash;
- controller runtime/API version;
- exact player controller versions;
- official AI versions/presets;
- item identities and generator version;
- rule-bearing lobby configuration;
- deterministic seed/input data.

It is likely useful to archive committed controller outputs and controller failure/diagnostic events so ordinary replay does not require executing historical untrusted code merely to watch a match. That is not yet locked as the final record format.

This section will be finalized with the authority architecture.

---

## 20. Browser role — Accepted direction; protocol details deferred

The browser should evolve away from being the authoritative simulation/player-command surface and toward being principally:

- a live match viewer;
- controller editor;
- controller debugger/diagnostics UI;
- replay viewer;
- loadout/progression UI;
- lobby/match-setup UI.

Rendering, camera, map visualization, animation/motion-plan concepts, and other presentation infrastructure should be retained heavily where practical.

The exact live state snapshot/delta protocol depends on the server-authority decision.

Late join/reconnect should not require replaying an entire long match from turn zero merely to reconstruct present state if the chosen authoritative architecture can provide checkpoints/snapshots efficiently.

---

## 21. Authentication and identity — Open; current preference recorded

Open Fufu authentication has **not yet been formally designed or locked**.

The current OpenFront authentication backend should therefore not be treated as the target architecture merely because some surrounding session/JWT patterns are reusable.

Current preferred starting direction:

- **Discord authorization is the leading candidate for the initial universal login path**, potentially for all users at first;
- users with Fufubox access may later also authenticate through the existing Fufubox/Foof/fufu-control challenge/trust model;
- the exact relationship between Discord identity and Fufubox identity is deferred;
- Open Fufu itself should own its controller/progression/match data rather than Foof directly manipulating a game database.

This section remains **Open** until the identity/auth contract is explicitly discussed.

---

## 22. Persistence and Foof service boundary — Accepted direction

Open Fufu will require its own persistent backend for game-specific state. Exact storage technology is not yet selected by this plan.

Expected persistent concepts eventually include:

- users/linked external identities;
- controller drafts;
- immutable published controller versions;
- certification state/results;
- active/default controller selection;
- item catalogue/version metadata;
- owned items/loadouts;
- duplicate/gambling currency;
- match records/replays;
- progression/rewards;
- official AI/version metadata.

Foof remains a Discord-facing management/integration service and must call Open Fufu through a game API rather than directly owning or mutating the game database.

Conceptually:

```text
Discord
  ↓
Foof
  ↓ Open Fufu API
Open Fufu service
  ├ authoritative match runtime
  ├ controller system
  ├ persistence
  ├ PvE/progression
  └ replay/history
```

Foof disappearing must not destroy Open Fufu's ownership of its own game/account/controller/progression state.

---

## 23. Tests, benchmarks, build tooling, and deployment — Accepted direction; concrete tooling changes expected

Existing tests, replay harnesses, performance suites, map tools, TypeScript checks, and server/client build machinery are valuable migration assets, **not sacred interfaces**.

Many tests and benchmarks will necessarily change because they currently encode mechanics that Open Fufu is deliberately replacing. Some build/deployment tooling will also change when the server starts carrying authoritative map/simulation state.

The migration should therefore classify tests individually:

- retain tests that protect still-valid deterministic/core behavior;
- adapt tests around reused systems whose semantics change;
- replace tests for removed OpenFront mechanics with Open Fufu contract tests;
- preserve historical removed tests only when useful as migration evidence, not as permanent requirements.

### Mandatory performance work before capacity claims

Benchmark on the intended Fufubox/server environment:

- baseline headless OpenFront core;
- authoritative Open Fufu core once viable;
- Population allocation memory/CPU;
- cell combat;
- controller invocation/sandbox cost;
- observer projection/network serialization;
- accelerated simulations;
- concurrent live matches;
- controller certification batches;
- long-match memory/GC behavior.

Do not choose production worker counts from the current OpenFront server topology, because that server currently does not simulate maps.

---

## 24. Proprietary asset removal gate — Accepted

The `proprietary/` directory should ultimately be removed from Open Fufu rather than relied upon as product content.

**Do not delete it yet.** Before removal, each asset must be inventoried and an original or appropriately licensed replacement must exist, or the code referencing the asset must be deliberately removed.

Current repository inventory:

### Font

- `proprietary/fonts/OpenFront.ttf`

Replacement requirement: an original/Open-Fufu-appropriate UI/display font strategy. A bespoke icon/font replacement may be required depending on how the file is used; usage must be audited before deletion.

### Branding/images

- `proprietary/images/Favicon.svg`
- `proprietary/images/OF.png`
- `proprietary/images/OF.webp`
- `proprietary/images/OpenFront.png`
- `proprietary/images/OpenFront.webp`
- `proprietary/images/OpenFrontLogo.png`
- `proprietary/images/OpenFrontLogo.svg`
- `proprietary/images/OpenFrontLogoDark.svg`

These appear to be OpenFront branding/logo/favicon assets rather than core gameplay artwork. They should be replaced by original Open Fufu branding assets before deletion.

### Music

- `proprietary/sounds/music/evan.mp3`
- `proprietary/sounds/music/of2.mp3`
- `proprietary/sounds/music/of4.mp3`
- `proprietary/sounds/music/openfront.mp3`
- `proprietary/sounds/music/war.mp3`
- `proprietary/sounds/music/win.mp3`

These require an original or otherwise appropriately licensed Open Fufu soundtrack/replacement set, or removal of music playback until replacements exist.

### Current conclusion

The proprietary inventory is relatively narrow: one font, OpenFront branding imagery, and six music tracks. No proprietary gameplay unit sprites, map corpus, or large sound-effect library have been identified under this directory.

### Removal acceptance condition

`proprietary/` is deleted only after:

1. all runtime/build references are enumerated;
2. every required visual/font/music role has an approved replacement or deliberate removal decision;
3. the production build no longer copies or references the directory;
4. build/tests pass without the directory.

---

## 25. Licensing/attribution — Accepted

Retain AGPL obligations and OpenFront attribution as required.

Do not assume every non-`proprietary/` asset is restriction-free. Maps/data/assets with their own licenses and attribution requirements must remain tracked through `CREDITS.md` or its eventual Open Fufu successor.

The proprietary removal work above is separate from the attribution/provenance audit for reusable third-party assets.

---

## 26. Dependency facts already established

Although exact implementation phases will be written only after the authority question is settled, the audit established several dependency constraints that the final staged roadmap must respect:

- server/headless authority choices affect visibility, replay, browser protocol, deployment, and controller placement;
- the new Population representation must exist before final cell-combat and Population-damage semantics can be completed;
- structure/naval/weapon modifiers should be translated after their target Population/FFY/combat concepts exist, rather than implemented twice;
- the controller API must be designed against the legal observation/action model rather than unrestricted `GameImpl` access;
- sandbox/certification depend on a stable-enough controller observation/action/runtime contract;
- persistence/progression/Foof integration depend on stable match/controller identities and record formats;
- production concurrency/process topology must wait for authoritative-core and controller benchmarks.

A provisional dependency spine is therefore:

```text
authority + headless/core boundary
        ↓
Open Fufu faction/ruleset foundations
        ↓
Segments + observation/visibility model
        ↓
Population allocation + Redeployment
        ↓
cell expansion/combat
        ↓
controller decision API/runtime contract
        ↓
sandbox + certification
        ↓
structure/naval/rail/weapon semantic translation
        ↓
match record/replay finalization
        ↓
persistence/progression/Foof integration
        ↓
final browser editor/debug/lobby experience
```

This is a dependency map, not yet the authorized implementation phase schedule.

---

## 27. Open questions that block the next plan revision

The next canonical revision should settle the **server authority family of decisions together**, because they are tightly coupled.

### A. Authority/process topology

Decide the exact authoritative match architecture, including:

- where the canonical simulation runs;
- whether one process owns one or many matches;
- how controller runtimes are isolated from the simulation process;
- failure containment between controller, match, and server worker;
- live-match tick scheduling versus accelerated/headless scheduling;
- restart/crash-recovery expectations for live matches.

### B. Observer state protocol and visibility enforcement

Once authority is selected, define:

- snapshot/checkpoint representation;
- incremental state delta/update representation;
- per-viewer visibility projection;
- spectator/public-view semantics;
- reconnect/catch-up behavior;
- whether controller observations share internal projection infrastructure with browser observations.

### C. Replay/record architecture

Choose whether the canonical historical record stores:

- controller decision outputs;
- controller source/version only;
- periodic checkpoints;
- authoritative state hashes;
- observer events separately from simulation events;
- enough data for ordinary replay without historical untrusted-code execution.

### D. Authentication

Discuss and lock the initial identity model, with Discord OAuth currently the leading starter option and Fufubox challenge/trust integration deferred or layered later.

### E. Server performance budget

After an authority candidate is concrete enough to prototype, benchmark it on Fufubox before locking simultaneous-match targets or worker topology.

---

## 28. Next work items

1. Discuss and settle the authority/process architecture and its failure-containment model.
2. Update this **same document** with the accepted authority choice and the resulting visibility/replay/browser/deployment decisions.
3. Convert the dependency map into explicit implementation phases with affected subsystems/files, invariants, validation gates, rollback/checkpoint expectations, and tests.
4. Audit all code references to `proprietary/` and prepare an exact replacement checklist before any proprietary asset deletion.
5. Only after the migration plan is complete and approved, begin implementation in explicitly approved stages.
