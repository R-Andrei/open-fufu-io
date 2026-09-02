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

> Keep OpenFront's dense cell/map engine, deterministic Execution machinery, pathfinding, generic units/structures, substantial naval/rail/strategic-weapon infrastructure, renderer foundations, useful lobby/network infrastructure, and test/performance tooling. Replace client authority, old combat/resource semantics, mutable diplomacy, and progression assumptions. Adapt the existing scalar troop/attack shape into Open Fufu's global Population plus sparse operation/frontage model rather than building a dense faction-by-cell Population field. Build a deliberately smaller public controller observation/directive API rather than exposing inherited mutable `Game`/`Player`/`Unit` internals.

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
→ validated persistent directives + one-shot commands
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
| Generic unit/build lifecycle | **Keep / Adapt internally** |
| Renderer, camera, map visualization foundations | **Keep heavily** |
| Lobby/roster/socket/routing/telemetry infrastructure | **Keep / Adapt** |
| Client-authoritative simulation | **Replace** |
| Turn relay as simulation authority | **Replace** |
| Client hash/winner/live-stat consensus as authority | **Remove** |
| Scalar `troops` storage concept | **Adapt into global whole-integer Population** |
| Current `Attack` object/lifecycle shape | **Reuse selectively** |
| Current `AttackExecution` combat semantics | **Replace substantially** |
| Inherited mutable `Game`/`Player`/`Unit` as player API | **Do not expose** |
| Public controller observation/directive contract | **New** |
| Serializable geographic selector/query layer | **New / adapt existing map algorithms** |
| Generic pathfinding/connected-components/legality helpers | **Reuse behind safe public QoL APIs** |
| Private controller visual debug annotations | **New** |
| Bounded deterministic team signal channel | **New** |
| Passive worker gold | **Remove** |
| Current troop growth/capacity formulas | **Replace** |
| Global Easy/Medium/Hard gameplay difficulty scalar | **Remove** |
| Existing Nation-AI behavior-composition pattern | **Keep selectively as reference/internal strategy components** |
| Official-AI simulation cheats / privileged information | **Remove** |
| Mutable alliances/relations diplomacy | **Remove** |
| Current partial-territory/overtime/doomsday victory rules | **Replace / Remove** |
| Dense defensive Population allocation field | **Do not build** |
| Desired/actual cell Redeployment subsystem | **Do not build** |
| Deployment/Redeployment Rate system | **Do not build** |
| Available/Committed Population accounting | **New / Adapt scalar troop plumbing** |
| Sparse offensive operations with spatial intent | **New / Adapt attack plumbing** |
| One-to-one engaged frontage lanes | **New / Adapt border plumbing** |
| Binary automatic cell defense (0/1 per threatened cell) | **New** |
| Controller defensive priorities/weights | **New** |
| Active direct counter-responses against hostile operations | **New** |
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

core-derived legal observations
    ↓
controller runtime / participant protocol
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

The accepted **first implementation to try** is `isolated-vm` inside separate dedicated controller-runtime worker processes, with explicit isolate memory/time/output/action/query limits and ordinary Linux process hardening. The match processes themselves do not host user isolates.

Do not grant untrusted code Node capabilities such as `require`, `process`, filesystem/network access, arbitrary host references, environment variables, or system time.

This is a pragmatic choice for a tiny authenticated friends-oriented service, not a claim that the package is an absolute security boundary. Benchmark and harden it before relying on it. A QuickJS-family runtime remains a possible later alternative if security/maintenance/performance measurements justify switching.

Do **not** assume one permanent OS process per controller. A reusable worker pool is preferred because persistent controller state is explicitly serialized by the game contract.

### Deterministic parallel execution

Controllers at the same decision tick may execute concurrently against immutable snapshots of the same canonical tick. Completion order must not create gameplay advantage; results are collected and committed deterministically.

---

## 6. Tick, decision, and Execution model — Accepted

Retain the deterministic Execution pattern rather than replacing it wholesale.

Open Fufu distinguishes lifecycle/admin commands, controller strategic decisions, and simulation state transitions.

A controller invocation operates transactionally against one immutable legal observation. On success, memory/directive/action changes commit together. On failure, temporary output is discarded.

Population commitment changes take effect immediately on successful decision commit; no land Deployment/Redeployment queue exists.

A controller decision is interpreted as a **proposed final decision set**, not a source-order sequence of direct canonical mutations. Reducing one commitment and increasing another in the same decision validates against the resulting final state. One-shot commands do not normally create objects that may then be consumed by another command in that same decision.

Provisional cadence remains:

```text
simulation: 10 Hz
controller decisions: 2 Hz
```

Accelerated simulations execute the same logical ticks without real-time waiting.

---

## 6A. Public controller API contract — Accepted direction

The public controller API is a deliberate game-facing contract and must **not** be the inherited `Game`, `Player`, `GameMap`, `Unit`, or `Execution` API.

The design principle is:

> Expose legal facts, legality, geometry, generic algorithms, actual rules, and pure mechanical calculations generously; do not expose strategic judgments, hidden canonical state, or future-state optimization oracles.

### 6A.1 Conceptual context surface

Exact final TypeScript names/types remain prototype work, but the public context should cover concepts equivalent to:

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

Own/private data and enemy/operational data are projected through the canonical visibility model before entering this contract.

### 6A.2 Persistent directives and one-shot commands

Model ongoing strategic intent as persistent directives and discrete actions as one-shot commands.

Persistent examples:

- attack/neutral-expansion operations;
- defense-priority policy;
- counter-responses;
- unit movement/patrol/targeting.

One-shot examples:

- build/upgrade;
- strategic-weapon launch;
- deliberate relinquishment;
- team signal;
- capitulation.

Persistent directives remain active if omitted from later decisions. Controllers may use bounded stable string keys for their own directives while the engine retains immutable internal IDs for replay/incoming-operation identity.

Setting an operation to `N` Population changes its current commitment immediately if valid; later casualties do not cause automatic refill back to `N`.

### 6A.3 Geographic selector/query layer

Reuse/adapt the efficient existing map substrate and graph algorithms behind a safe public layer.

Provide serializable bounded selectors/regions composable from mechanical predicates such as cell IDs, owner, Segment, terrain/fallout, coast/shoreline, population-bearing/conquerable state, simple geometry, and set union/intersection/difference.

Persistent 10 Hz simulation work consumes compiled selector data rather than invoking arbitrary controller callbacks over the map.

Provide bounded deterministic QoL queries such as:

- neighbors/adjacency;
- boundary extraction;
- connected components/flood fill;
- distance;
- generic land/naval/rail pathfinding and reachability;
- nearest/reachable queries;
- owner/terrain/Segment summaries and histograms;
- legal structure sites;
- legal coast/transport destinations.

These are factual/mechanical services, not strategy. Do not add `weakestPoint`, `bestTarget`, `bestNukeTarget`, `optimalCounterSize`, `safestTradeRoute`, or equivalent strategic scoring.

Permit bounded batch/materialized cell access for advanced controllers without encouraging whole-map object allocation every decision.

### 6A.4 Segments and Contacts

Expose Segments as first-class strategic query objects with factual summaries/selectors and adjacency. Expose Territorial Contacts as factual boundary/contact geometry with components, size, involved Segments and terrain summaries.

Do not create an engine-level strategic `Front` object or score contacts for strategic value.

### 6A.5 Offensive and defensive policy surfaces

Land attack directives should distinguish:

- **engagement priority** for selecting legal frontage when Population cannot cover every candidate lane; and
- **pressure weighting** for distributing finite committed Population across engaged geometry.

Both have deterministic defaults; advanced policy is expressed through bounded selector/weight rules rather than huge per-cell maps.

Defense exposes only priorities deciding which cells receive scarce one-Population automatic defenders. It cannot set passive defensive quantities.

Counter-response commands/directives identify one incoming operation and Population commitment; the engine owns the nonlinear exchange formula.

### 6A.6 Rules and pure mechanics calculators

Expose current ruleset/feature flags and exact public mechanical values. Expose pure deterministic calculators for published arithmetic/geometry such as growth, capture advantage, counter-response exchange, structure/unit costs and legality, range/blast geometry, and explicit terrain/item/structure modifiers.

Calculators may use only supplied/legal information. They must not become hidden-state oracles or future-state simulators.

### 6A.7 Public game concepts, not inherited implementation classes

Even if OpenFront internally represents structures, ships, trains, missiles, etc. through shared `UnitImpl` machinery, the public API should expose game-level **structures**, **mobile units**, and **weapons** as coherent public concepts.

Movement APIs are intent-oriented: the controller selects destination/patrol/target while the engine handles mechanical pathfinding/motion.

Major actions should have corresponding factual legality/cost/range helpers so users are not forced to submit blind actions merely to learn rules.

### 6A.8 Events and decision receipts

Build a bounded typed event stream for legally observable meaningful changes since the previous controller invocation. This avoids forcing every controller to diff complete snapshots to notice captures, losses, completed structures, operation lifecycle changes, FFY changes, hostility, defeat/capitulation, or strategic-weapon events.

Expose structured `lastDecision`/receipt information for transaction acceptance/rejection and per-command failures.

Persistent directives expose lifecycle/status and obvious dead directives are automatically terminated/cleaned by the engine with deterministic events/reasons.

### 6A.9 Deterministic randomness

Sandbox randomness is deterministic and match-bound. Support ordinary ergonomic deterministic `Math.random()` behavior and a keyed deterministic random facility so unrelated random calls need not perturb stable decisions.

Never expose uncontrolled entropy or system time.

### 6A.10 Controller limits and performance guardrails

Expose deterministic structural limits for operations, commands, selector/policy rules, materialized/query results, persistent memory and debug/log output.

Do not make remaining wall-clock CPU time a gameplay-readable variable.

### 6A.11 Debugging surface

Implement private bounded debug output as first-class authoring infrastructure, not only text logs. Support concepts equivalent to named metrics, cell/region/Segment highlights, and operation/unit/structure annotations for the controller owner in live/replay debugging.

Debug output never affects simulation and never becomes public gameplay information.

### 6A.12 Team coordination and information

Fixed teammates receive the union of legally observable team operational information. Provide a small bounded deterministic JSON-like team signal channel delivered on a later deterministic decision boundary to avoid same-tick ordering races.

Do not provide unrestricted shared mutable controller memory.

### 6A.13 Public mechanical modifiers

Project strategically relevant active mechanical modifier sheets publicly, consistent with the canonical transparent-mechanics rule. Controllers should not need to reverse-engineer hidden item/faction modifiers from combat outcomes.

### 6A.14 SDK and multi-file authoring

Allow multi-file local TypeScript controller projects that are compile/typechecked/bundled/certified into an immutable artifact.

The official SDK may provide neutral helpers/builders for selectors, priorities, deterministic math and ordinary collection ergonomics. It must not ship privileged doctrine such as weakest-enemy selection or best-target strategy.

### 6A.15 Spawn API remains intentionally unresolved

Do **not** finalize a `chooseSpawn` hook yet.

Random spawning remains supported, but ordinary Open Fufu games are expected to prefer non-random spawning with some controlled participant knowledge of other starting locations. Exact selection, information timing, collision/conflict handling, exact-cell versus region/preference selection, and controller lifecycle semantics require a dedicated design decision first.

---

## 7. Map, cells, terrain, and Segments — Accepted

Retain/adapt the current dense integer `TileRef`/typed-array map substrate, compact terrain/state storage, deterministic adjacency, ownership mutation, water/pathfinding, authored map compilation/loading, impassables, and map-scale optimized iteration.

### 7.1 Segment layer

Add compact immutable Segment identity for every real map cell, including water and impassable terrain, plus immutable Segment metadata/adjacency. Segments remain query/strategy indexes rather than physical simulation buckets.

Dynamic terrain changes such as nuke-created fallout/water do not regenerate Segment identity.

### 7.2 Future procedural maps

Procedural/random map generation is new and must deterministically produce terrain plus the same immutable Segment model from seed/version.

---

## 8. Ownership and neutral expansion — Accepted

Retain/adapt low-level cell ownership and incremental territory/border bookkeeping. Existing `conquer()`/`relinquish()`-style primitives remain useful internally.

Neutral expansion becomes an operation using ordinary Population and spatial intent. Neutral cells have no automatic Population defense and settlement does not inherit arbitrary old troop deaths. Neutral fallout remains conquerable land but applies its explicit capture-resistance rule.

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

For V1, one ordinary conquerable land cell, including conquerable fallout land, contributes exactly one Capacity while owned. Existing incremental territory counts should make this a cheap derived/read value.

Remove/avoid City Capacity bonuses, item max-Population/Capacity bonuses, terrain Capacity multipliers, and hidden faction Capacity multipliers. Cities move to growth effects.

### 9.3 Representation

Authoritative Population values should normally use `uint32`-compatible non-negative whole integers. Use deterministic fixed-point/residual state only where formulas require sub-unit precision.

---

## 10. No defensive occupancy field — Accepted

Do not implement persistent defensive Population on cells, Segments, Contacts, or fronts.

Available Population is one finite automatic defensive pool. Automatic assignment is ephemeral per tick and **binary per threatened owned cell**: zero or one Population, never more than one. One Available Population unit may participate in automatic defense on at most one threatened cell in that tick.

If Available Population exceeds the number of threatened cells, every threatened cell may receive one defender and the surplus remains Available; it does not stack into higher passive pressure. Capacity therefore creates no free or unbounded defense. If Available Population is zero, baseline Population defense is zero even if territory remains.

Simulation should iterate primarily over active operations, their engaged frontier lanes/cells, ephemeral threatened-cell defense assignment, active counter-responses, units, structures, and economic events rather than `factions × map cells`.

No dense Population matrix should exist.

---

## 11. Offensive operations, frontage, automatic defense, and land combat — Accepted

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

### 11.4 Binary contact-surface automatic defense and defensive priorities

For a defender, derive the distinct owned target cells currently pressed by incoming engaged hostile lanes.

Automatic passive defense is binary:

```text
0 or 1 Population per threatened owned cell
```

and therefore:

```text
automaticallyDefendedCells
= min(AvailablePopulation, threatenedOwnedCells)
```

If Tanya has 100,000 Available Population and 1,000 threatened cells, at most 1,000 Population participates in automatic cell defense that tick. The remaining 99,000 remains Available and creates no extra passive cell pressure.

When Available Population is lower than the threatened surface, defense slots are apportioned across incoming contacts/operations approximately in proportion to engaged lane counts. A 300-lane Fufu attack plus a 100-lane Ski attack therefore receives a 3:1 share of Tanya's scarce defense slots before selecting the actual defended cells.

The controller may provide defensive priorities/weights over legal cells/Segments/terrain/objectives. Those priorities choose **which cells receive scarce one-Population defenders**; they do not choose raw defensive Population quantities.

The default policy is deterministic **Even Spread**. Equal-priority cells use seeded deterministic tie-breaking, with deterministic rotation allowed so the same arbitrary holes need not remain undefended forever.

A cell contested by multiple hostile operations still consumes at most one automatic defense slot. The same Available Population may not be duplicated across cells or opponents.

Terrain, Defense Posts, items, and other explicit modifiers change the effectiveness of the one defender, not its Population count.

### 11.5 Direct active counter-responses

A targeted counter-response removes Population from Available and commits it against one incoming hostile operation. It does **not** add extra passive defenders to cells and cannot raise a threatened cell above the one-defender automatic cap.

Counter-response combat is a separate direct operation-vs-operation Population exchange and may cause casualties without any cell changing owner.

For incoming attack Population `A` and counter-response Population `R`, use a shared exchange volume based on the smaller force:

```text
B = k × min(A, R)
```

Then derive scale-free relative imbalance:

```text
d = (R - A) / (R + A)
s = sign(d) × |d|^p
```

with `p > 1`; provisional V1 starts at `p = 2`.

Let `M` be the maximum relative casualty-efficiency ratio between the advantaged and disadvantaged side; provisional V1 starts at `M = 1.5`. Define:

```text
h = (M - 1) / (M + 1)

responseMultiplier = 1 + h × s
attackMultiplier   = 1 - h × s
```

and resolve both casualty directions simultaneously from the same pre-tick state:

```text
attackPopulationLost   = B × responseMultiplier
responsePopulationLost = B × attackMultiplier
```

Use deterministic fixed-point/residual handling and cap casualties at the Population actually present.

Implement **attack-side** and **response-side** effectiveness curves/parameters as distinct ruleset hooks even though their V1 defaults mirror one another.

A counter-response is tied to one incoming hostile operation; its committed Population cannot be duplicated across targets. Ending/changing it is immediate on a successful controller decision and returns surviving Population to Available.

Exact `k`, final `M`, final `p`, and explicit side-specific modifier values are tuning data.

### 11.6 Capture throughput

Freeze engagement geometry at tick start. A target cell changes owner at most once per tick and one lane yields at most one capture that tick.

Therefore an operation with 300 engaged lanes cannot capture more than 300 cells in one tick. Actual capture count is usually lower according to pressure advantage, terrain, structures, and tuning.

### 11.7 Capture-coupled ordinary land casualties

Delete the previous continuous ordinary cell-capture casualty direction such as `2AD/(A+D)`.

For each **automatically defended population-bearing cell** that changes owner:

- previous owner loses the 1 current Population defending that cell;
- winning attacker loses 1 current Population from the capturing offensive commitment;
- previous owner Capacity -1;
- winner Capacity +1.

The consumed defender is removed from Available Population. The attacker's casualty is removed from that offensive operation.

An undefended capture causes no ordinary cell-capture Population casualty. Stalled/failed ordinary cell pressure does not independently create Population attrition.

Other explicit mechanics such as counter-response combat, nukes, and transport destruction may reduce Population without a cell ownership change.

### 11.8 Multi-faction handling

Aggregate same-faction local pressure before resolution. Resolve all claimants from the same pre-state; strongest successful claimant wins a contested cell deterministically. The cell still flips only once.

For a defended capture, the ordinary one-for-one casualty pair applies only between the previous owner and the winning claimant. **Unsuccessful third-party claimants lose no Population merely because they also contested that cell.**

### Acceptance conditions

- same Population cannot be duplicated across operations/cells/opponents;
- 800 committed Population cannot produce more than 800 simultaneous engagement lanes;
- same-faction operation fragmentation cannot manufacture pressure;
- newly captured cells cannot chain-capture within one tick;
- one threatened cell receives at most one automatic defensive Population;
- one Available Population unit automatically defends at most one threatened cell per tick;
- surplus Available Population does not stack passive defense above one per cell;
- defensive priorities affect cell selection, not automatic defensive quantity;
- counter-responses attack incoming committed Population directly rather than stacking passive defense;
- counter-response force advantage is scale-free, nonlinear, shallow near parity, and bounded by an explicit maximum relative casualty-efficiency ratio;
- attack-side and response-side counter-combat curves remain separately addressable rule hooks;
- zero Available Population means zero baseline Population defense.

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
| Defense Post | Explicit local modifier to the effectiveness of a one-Population automatic defender; does not add passive Population |
| Port | Keep naval role; adapt trade/FFY |
| Factory | Preserve rail/economic identity initially |
| Missile Silo | Preserve weapon infrastructure |
| SAM Launcher | Preserve interception identity |
| Upgrades/levels | Keep framework |

No structure recreates hidden global Military Power.

---

## 14. Generic units, naval, amphibious, trade, and rail — Accepted

Retain/adapt the generic unit framework internally: stable IDs, ownership, movement, target state, health, deletion, construction, upgrades, and type-specific runtime state. Do not expose this shared inherited implementation abstraction directly as the player-controller contract.

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

## 15. Strategic weapons and SAM — Accepted

Retain deterministic launch/trajectory/interception infrastructure: silos, missile flight, warning/visibility where allowed, SAM interception, detonation geometry, and structure/unit/terrain effects.

Replace old scalar-troop/attack-stack casualty handling and mutable-alliance side effects.

### 15.1 Standard nuclear fallout

The current OpenFront source already provides a useful political/terrain pattern to retain and translate:

```text
owned affected land
→ owner relinquishes cell
→ cell becomes neutral
→ ordinary mode marks land as fallout
→ fallout remains conquerable
```

Open Fufu standard nuclear semantics are therefore:

- each affected owned population-bearing land cell is relinquished and becomes neutral;
- the former owner loses 1 current Total Population per such affected owned cell, capped at zero;
- the former owner's Capacity falls by 1 because ownership of that population-bearing cell was lost;
- fallout remains land, remains population-bearing when owned, remains conquerable, and remains in the conquerable-territory denominator;
- fallout applies explicit capture resistance/capture-speed effects instead of phantom defensive Population.

A faction later reconquering fallout gains the ordinary +1 Capacity from ownership but no free current Population.

Do **not** blindly inherit OpenFront's exact current fallout coefficient; translate it into Open Fufu's explicit terrain/capture model and tune it separately.

### 15.2 Optional water-nuke mode

Retain OpenFront's `waterNukes` concept as an optional ruleset mode.

When enabled, affected land may be converted to water rather than ordinary fallout. Converted water is non-population-bearing and no longer ordinary conquerable territory, so the current victory denominator shrinks accordingly. Segment identity remains unchanged.

The owned-cell Population casualty and Capacity-loss event still applies to destroyed owned population-bearing land before/through conversion.

Cities do not add extra Population casualties; they affect growth, not Capacity.

Physical units, fleets, transports, structures, or offensive forces directly hit by the weapon may take their own explicit local damage in addition to the terrain-linked rule.

Exact radii, interception, physical-unit lethality, fallout resistance, and water-conversion geometry remain tuning/translation work.

---

## 16. Teams, diplomacy, `atWar`, defeat, capitulation, and victory — Accepted

Retain fixed pre-match teams. Remove mutable alliance/relation diplomacy. FFA opponents remain legally attackable regardless of `atWar`; `atWar` is symmetric recent-hostility state rather than a permission gate.

Trade with enemies remains possible with the canonical explicit wartime penalty rather than ordinary embargo prohibition. Do not inherit troop/gold donations automatically.

Fixed teammates share legal operational observations and may exchange bounded deterministic delayed team signals through the public controller contract.

### Defeat

After all same-tick ownership changes resolve, **zero owned population-bearing territory means immediate defeat**, regardless of remaining Population, operations, fleets, or transports. No comeback/dispossessed state exists.

### Resignation/capitulation

A resigned/capitulated faction becomes a passive territorial remnant and keeps its owned territory, static structures, and surviving Population.

On resignation/capitulation:

- growth becomes permanently zero;
- controller decisions permanently stop;
- active land offensive/counter-response operations cease and surviving Population returns to Available;
- all mobile units are removed immediately;
- Population aboard removed transports returns to Available rather than dying;
- removed mobile units provide no FFY/resource refund;
- in-flight offensive projectiles/strategic weapons are cancelled/removed;
- static passive effects may continue where explicitly legal;
- static active behaviors stop, including missile launches, SAM firing, trade/train/unit spawning, and other autonomous strategic actions;
- remaining Available Population continues ordinary passive defense;
- territory remains capturable normally;
- no new strategic actions occur.

Replace old partial-territory/overtime/doomsday victory rules with the canonical 100%-territory/opposition-defeated rules.

Detailed lobby UI/UX remains later product work.

---

## 16A. Official PvE AI migration — Accepted

The existing OpenFront Nation-AI code is useful as **behavioral reference and as an example of composing reusable strategy components**, not as the target gameplay contract.

Retain/reuse selectively:

- the general pattern of composing aggression, economy, construction, naval, retaliation, target-selection, and strategic-weapon behaviors;
- useful strategy-neutral helper logic that can be moved behind the Open Fufu observation/action contract;
- creator-authored preset/version concepts where they remain compatible.

Do not preserve:

- direct unrestricted access to canonical `Game` state when that exposes information a player controller cannot legally observe;
- global troop/Population reads that bypass the canonical visibility contract;
- Easy/Medium/Hard simulation modifiers or difficulty-dependent resource cheats;
- hidden reaction-speed, income, growth, omniscience, or legality advantages.

Official PvE AI should consume the same legal gameplay observation/action contract as player controllers. It may execute as trusted code and therefore need not use the hostile-code sandbox, but trusted execution must not create gameplay-information or rules privileges.

Exact official AI implementations are creator-owned, immutable/versioned when bound to a match, and may reuse internal strategy components without turning those components into privileged player-facing policy APIs.

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

Use the same underlying projection rules for player controllers, official AI, and browser participant views. Fixed teammates receive the legal union of their team's observable operational state.

Public projection includes strategically relevant active mechanical modifier sheets so hidden arithmetic does not need to be reverse-engineered from outcomes.

All derived query/calculator APIs operate strictly over legal projected information and must not create side-channel visibility leaks.

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
debugger / private controller-overlay viewer
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

Controller debug annotations are private participant/developer data, not public match state. They should be recorded/streamed through bounded dedicated diagnostics channels rather than mixed into authoritative gameplay state.

Observer publishing must be optional in headless certification/batch simulations.

---

## 19. Replay, records, and crash behavior — Accepted direction

Preserve deterministic archive/replay philosophy but make the server the source of canonical state/hashes.

Archive exact committed controller decisions/operation changes so ordinary replay does **not** need to re-execute historical untrusted controller code. A stronger verification/debug mode may separately re-run archived controller/runtime versions and compare outputs.

Retain enough bounded controller debug annotation/log history to support the programming debugger/replay experience without making debug output simulation-authoritative.

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
- controller drafts/source packages;
- immutable published controller bundles/versions;
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

Large replay/log/debug artifacts may be stored as compressed files with path/hash/version metadata in SQLite rather than bloating the database unnecessarily.

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

Useful inherited foundations include TypeScript checking, Vite/browser build, Node server tooling, Vitest, server/lobby tests, full-game performance tooling, GC/heap profiling, replay harnesses, map/pathfinding algorithms, and the Go map generator.

Remove tests that assert intentionally removed OpenFront behavior and replace them with Open Fufu invariants.

### 23.1 Authoritative map packaging

Current OpenFront production packaging assumes the server does not simulate and may therefore omit server-side map binaries/resources. That assumption is incompatible with Open Fufu authority.

The authoritative match runtime must have deterministic access to the exact map binary/data, Segment metadata, and other rule-bearing static map inputs bound to the match. Build/deployment work must therefore:

- package or otherwise make those authoritative map resources available to match processes;
- version/hash them as part of match identity;
- ensure live, headless, certification, and replay execution load the same rule-bearing map data;
- avoid blindly copying unrelated browser-only assets into the match runtime when they are not needed.

Do not preserve a Docker/build optimization whose premise is “the server never loads maps.”

### 23.2 Required performance/logic coverage

Performance and simulation tests should cover:

- process-per-match overhead;
- 1/3/5 simultaneous authoritative matches;
- `isolated-vm` controller worker-pool overhead;
- controller observation construction and serialization;
- selector/query/materialization budgets;
- generic geographic helper determinism;
- visibility-safe derived queries with no hidden-information oracle leakage;
- transaction/final-set semantics independent of directive call ordering;
- persistent directive lifecycle and controller-owned keys;
- event-stream correctness;
- deterministic normal and keyed randomness;
- debug annotation bounds and no simulation effect;
- team shared observation and delayed signal ordering;
- whole-integer Population accounting;
- 800-Population / 1,000-cell offensive frontage cap;
- one-to-one source/target engagement-lane resolution;
- low-Population binary defense, e.g. 800 Available across 1,000 threatened cells gives exactly 800 one-Population defenders and 200 undefended cells;
- surplus-Population defense cap, e.g. 100,000 Available across 1,000 threatened cells still gives exactly 1,000 one-Population defenders, not 100 per cell;
- 300:100 contact-surface apportionment when defense slots are scarce;
- deterministic Even Spread and controller defensive-priority ordering;
- multi-operation overlap without duplicate automatic defenders on one cell;
- zero-Available-Population defense;
- direct counter-response Population accounting/casualties and capped nonlinear ratio scaling;
- same-faction offensive operation aggregation;
- no same-tick chain conquest;
- capture-coupled casualties;
- third-party same-cell claimant casualty-free behavior;
- normal neutral fallout reconquest and fallout capture resistance;
- optional water-nuke conversion and victory-denominator updates;
- capitulation removal of mobile units/projectiles with transport Population return;
- participant projection/deltas;
- accelerated/headless runs;
- long-match memory/GC.

### Key performance invariant

Simulation work must scale primarily with **active strategic work and engaged frontier geometry**, not full `factions × cells` products.

No persistent defensive occupancy, dense Population matrices, land Deployment queues, or arbitrary user callbacks inside the 10 Hz map-resolution loop should exist.

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
5. OFFENSIVE OPERATIONS + ENGAGED FRONTAGE + BINARY AUTOMATIC DEFENSE
       ↓
6. CONTROLLER API CONTRACT IMPLEMENTATION
   (queries/selectors/directives/defense/counters/events/debug/team)
       ↓
7. ISOLATED-VM CONTROLLER WORKER POOL + CERTIFICATION
       ↓
8. OFFICIAL PVE AI PRESETS + STRUCTURE / NAVAL / RAIL / WEAPON TRANSLATION
       ↓
9. MATCH LIFECYCLE + REPLAY / PARTICIPANT PROTOCOL
       ↓
10. SQLITE / DISCORD AUTH / PROGRESSION / FOOF API
       ↓
11. BROWSER EDITOR / DEBUG / FINAL LOBBY UX
```

The spawn protocol must be settled before finalizing any spawn-related controller lifecycle API; it does not need to block the early headless/authority work.

Some workstreams may overlap, but downstream systems must not force premature contracts onto unresolved upstream mechanics.

---

## 27. OpenFront audit coverage cross-check — Accepted

This table is a traceability check against the source-level OpenFront compatibility audit. It exists so later edits do not accidentally drop an inherited subsystem from the migration record.

| Original audit area | Canonical integration coverage |
| --- | --- |
| 1. Repository / architectural map | §§1–3, 23–25 |
| 2. Simulation authority / client-server model | §4 |
| 3. Tick loop / intents / Executions / deterministic transitions | §§3, 6, 19 |
| 4. Map / cells / coordinates / terrain / topology | §§6A, 7, 23.1 |
| 5. Ownership / neutral expansion | §§6A, 8 |
| 6. Troops / gold / resources / player state | §§9, 12, 20–21 |
| 7. Land combat / casualties / territorial capture | §§6A, 11 |
| 8. Spatial Population / Redeployment | §§9–11; superseded dense model explicitly rejected |
| 9. Structures / spatial modifiers | §§6A, 13 |
| 10. Generic unit / mobile-object framework | §§6A, 14 |
| 11. Naval / amphibious / trade / rail | §§6A, 14 |
| 12. Strategic weapons / interception | §§6A, 15 |
| 13. Teams / alliances / diplomacy / `atWar` | §§6A, 16 |
| 14. Visibility / fog of war | §§6A, 17 |
| 15. Bots / official PvE AI / player-controller boundary | §§5, 6A, 16A, 17 |
| 16. Match lifecycle / lobby / spawn / defeat / resignation / victory | §§4, 6A.15, 16, 18 |
| 17. Replay / serialization / determinism / observability | §§3, 6, 6A, 19, 23 |
| 18. Browser rendering / interaction assumptions | §§17–18 |
| 19. Persistence / identity / authentication / Foof boundary | §§20–21 |
| 20. Build / deployment / tests / performance / licensing | §§22–25 |

If a future audit finding does not map to this plan, update this same document rather than creating a third Open Fufu migration source.

---

## 28. Remaining open integration/design questions

After the authority, Population/frontage, combat, capitulation, and controller-contract decisions, the legitimately open questions are now narrower:

1. **Spawn selection/information protocol** — ordinary games should generally support non-random spawning and some controlled information about other players' starts, while random spawn remains supported. Exact simultaneity, visibility timing, legal choice representation, collision/conflict resolution, exact-cell versus region/preference selection, and controller lifecycle need dedicated design.
2. **Exact final TypeScript names/types and ergonomic naming** after prototype pressure-testing of the accepted controller-contract shape.
3. **Real Fufubox performance capacity** after a representative authoritative simulation exists.
4. **`isolated-vm` production benchmark/hardening details** — concrete time/memory/output/query limits, worker-pool size, lifecycle/recycling policy, and whether later QuickJS testing is worthwhile.
5. **Exact SQLite schema/index/backup/retention details.**
6. **Exact Discord session/cookie/expiry/CSRF implementation** and optional later Fufubox credential linking.
7. **Exact structure/naval/rail/weapon values and remaining translation details** where the canonical design deliberately leaves tuning open.
8. **Detailed lobby/UI/UX redesign.**
9. **Replacement asset creation and final proprietary-directory removal.**
10. **Normal gameplay tuning** — capture progress/speed, counter-response casualty/rate coefficients, terrain/structure/fallout multipliers, growth reference values/interpolation, FFY payouts, AI reward values, Segment scale, weapon radii/effects, water-nuke conversion values, and related balance constants.
11. **Exact deterministic controller limits/diagnostic retention values** — materialized-cell/query budgets, policy-rule counts, log/debug-overlay budgets, command/directive caps, and replay retention. The existence and public visibility of these limits are settled; only values are open.

The public API philosophy, observation/directive split, geographic QoL layer, persistent-directive semantics, defense/counter surfaces, pure mechanics calculators, events/receipts, deterministic randomness, team signals/shared legal observation, public mechanical modifiers, multi-file authoring, and private debug overlays are now settled design direction. Spawn remains intentionally excluded from that settled surface until its gameplay protocol is designed.

These remaining questions should be resolved by updating these same canonical documents rather than creating additional migration-plan documents.