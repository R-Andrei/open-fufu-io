# Open Fufu — Canonical OpenFront Integration Plan

## Status and authority

This document is the **single canonical Open Fufu integration, migration, and upgrade plan** for transforming the current OpenFront fork into Open Fufu.

The target game design is defined by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), which remains the single canonical Open Fufu design contract and takes precedence over this document if the two ever conflict.

Concrete accepted provisional terrain, persistent-structure, and Factory-produced land-unit data is maintained in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md). This migration plan must implement that registry rather than re-derive numerical defaults from inherited OpenFront behavior.

This document defines **how the existing OpenFront codebase should be reused, adapted, replaced, or extended to reach that target**.

Future accepted migration decisions must update this file rather than creating competing Open Fufu upgrade-plan documents. Older inherited OpenFront architecture/refactor documents remain useful evidence of the current/upstream implementation but are not normative for Open Fufu.

No gameplay implementation is authorized merely by the existence of this plan. Major migration stages still require explicit implementation approval.

Sections marked **Accepted** are settled migration direction. **Open** items remain to be decided or measured before implementation reaches them.

---

## 1. Audit conclusion — Accepted

The current fork is a strong basis for Open Fufu and should **not** be rewritten from scratch.

The migration strategy is:

> Keep OpenFront's dense cell/map engine, deterministic Execution machinery, pathfinding, generic units/structures, substantial naval/rail/strategic-weapon infrastructure, renderer foundations, useful lobby/network infrastructure, and test/performance tooling. Replace client authority, old combat/resource semantics, mutable diplomacy, and inherited progression assumptions. Adapt the existing scalar troop/attack shape into Open Fufu's global Population plus sparse operation/frontage model rather than building a dense faction-by-cell Population field. Build a deliberately smaller public controller observation/directive API rather than exposing inherited mutable `Game`/`Player`/`Unit` internals. Replace/extend the inherited spawn phase with Open Fufu's deterministic three-phase strategic spawn protocol, public spawn-profile transformations, and Initial Territory footprint generation. Extend the inherited terrain substrate with the accepted Open Fufu terrain library and Fallout overlay semantics. Adapt inherited structure/upgrading infrastructure into Open Fufu's deliberate eight-structure level-1-through-level-5 system, public Fort concept, Observation/Command Posts, launcher tier gates, and explicit naval/structure effects. Add the Factory-produced Tank as the sole baseline persistent land military unit and implement Heavy Artillery/Radioactive Munitions as typed Origin transformations of that same unit. Add Open Fufu's versioned **Origin** faction-identity system and the **Echo** system as 12,927 fixed mechanical collectible identities with rerolled EchoScore-weighted acquisition magnitudes, deterministic generated names, duplicate Pareto progression, accumulated match rewards, saved Echo Sets, pending reward settlement, Middle Fingers duplicate/Gacha currency, and the 10/100-Middle-Finger Gacha Store with paid-pull-only 50-pull power-12 Lucky+ pity through explicit typed/versioned rules rather than hidden faction bonuses. Keep production account/progression records in runtime/private data while the compact reusable Echo naming grammar/configuration may live as ordinary versioned game data. V1 Echoes require no anime quote/subtitle/MAL import pipeline.

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
controller observation / pre-match spawn hooks
→ transactional controller decision
→ validated persistent directives + one-shot commands
→ deterministic simulation work
→ canonical Game mutation
```

Origins and Echoes modify the explicit rule-bearing configuration consumed by the same authoritative simulation; they do not bypass the controller/action contract.

---

## 2. Accepted subsystem classification

| Area | Migration classification |
| --- | --- |
| Dense cell/map representation | **Keep / Adapt** |
| Deterministic tick and Execution machinery | **Keep / Adapt** |
| Pathfinding, water connectivity, rail graph | **Keep / Adapt for expanded terrain/traversal rules** |
| Generic unit/build lifecycle | **Keep / Adapt internally** |
| Renderer, camera, map visualization foundations | **Keep heavily** |
| Lobby/roster/socket/routing/telemetry infrastructure | **Keep / Adapt** |
| Current spawn-selection phase | **Replace / Adapt into three-phase strategic spawning plus public spawn-profile variants and Random/Fixed modes** |
| Initial territory footprint generation | **New / Adapt ownership/spawn plumbing; support one- and two-origin profiles** |
| Client-authoritative simulation | **Replace** |
| Turn relay as simulation authority | **Replace** |
| Client hash/winner/live-stat consensus as authority | **Remove** |
| Scalar `troops` storage concept | **Adapt into global whole-integer Population** |
| Fractional mechanical Population costs | **New deterministic faction-level residual accounting where explicitly required** |
| Current `Attack` object/lifecycle shape | **Reuse selectively** |
| Current `AttackExecution` combat semantics | **Replace substantially; retain neutral time/cost concept only through explicit Open Fufu rules** |
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
| Capture-coupled ordinary hostile land casualties | **New** |
| Neutral settlement cost/progress | **New explicit Open Fufu rule; baseline 1 Population per captured neutral population-bearing cell** |
| Expanded Open Fufu terrain library | **New / Adapt terrain enum/storage/pathing/rendering for Plains, Highland, Mountain, Desert, Forest, Tundra, Marsh, Shallow Water, Deep Water, Impassable** |
| Fallout terrain behavior | **Adapt into overlay/state over underlying conquerable terrain rather than replacement terrain/phantom defense** |
| Inherited Defense Post public concept | **Adapt/rename to Fort; reuse useful internals** |
| Persistent structure levels | **Adapt to universal hard cap 1–5 with deliberate type-specific effects** |
| Observation Post | **New visibility/observation structure with level-scaled radius** |
| Command Post | **New planned offensive-support structure with source-pressure/coverage progression and 10s build/upgrade telegraph** |
| Missile Silo weapon access | **Adapt to L1 Atom / L3 Hydrogen / L5 MIRV plus level-scaled charges** |
| SAM upgrades | **Adapt to level-scaled range/charges plus rule-transformable single-charge shield profile** |
| Factory-produced Tank | **New sole baseline persistent land military unit; autonomous strategic control, Train raiding, Population attack, anti-armor combat, terrain-specific traversal** |
| Heavy Artillery Origin transformation | **New typed Tank-profile transformation; not a second baseline unit** |
| Radioactive Munitions Origin transformation | **New typed Population-attack territorial-neutralization/Fallout hook for Tank/Heavy Artillery** |
| Warship construction time | **Adapt purchase lifecycle so Warships require 5s construction at Port instead of instant activation** |
| MIRV inherited power | **Retain system, moderately rebalance downward and gate at L5 launcher** |
| Transport FFY cost | **New additive embarkation-cost modifier surface; baseline 0 FFY** |
| Successful landing → granted Fort Origin rule | **New typed amphibious result hook** |
| Warship-as-Silo Origin rule | **New typed launcher-equivalence hook using Warship rank as effective Silo level** |
| Immutable strategic Segments | **New** |
| Runtime-derived Contacts | **New** |
| Secure operational visibility/observation model | **New; integrate Observation Post coverage** |
| Player controller runtime/sandbox | **New** |
| Controller publishing/certification/memory/diagnostics | **New** |
| Typed Origin/Echo rule-composition hooks | **New** |
| Official + Custom Origin definitions/creator | **New** |
| Exhaustive Origin-catalogue combination deployment gate | **New** |
| Open Fufu Echo identity catalogue/owned rolls/Echo Sets/rewards/pending settlement/Gacha Store | **New** |
| Deterministic Echo generated-name grammar/configuration | **New; small versioned character-pool/stat-token/descriptor configuration, no quote corpus required** |
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

A Node/headless process can load a map, bind exact terrain/structure/mobile-unit/Origin/Echo/ruleset configuration, resolve a configured spawn phase including any legal one-origin/two-origin spawn profile, run a complete match, determine its result, produce a replay record, and replay that match without importing DOM/browser presentation code.

---

## 4. Server authority and process topology — Accepted

Each live match has exactly **one canonical authoritative server simulation**. Browsers never determine simulation progress, canonical hashes, winner state, authoritative statistics, or spawn resolution.

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

Benchmark the real authoritative Open Fufu simulation on Fufubox for at least 1, 3, and 5 simultaneous matches, controller runtime overhead, observer delta construction, spawn-resolution overhead, Origin/Echo rule-projection overhead, and accelerated certification/batch mode.

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

Controllers at the same decision tick or the same simultaneous spawn phase may execute concurrently against immutable snapshots of the same canonical pre-state. Completion order must not create gameplay advantage; results are collected and committed/resolved deterministically.

---

## 6. Tick, decision, and Execution model — Accepted

Retain the deterministic Execution pattern rather than replacing it wholesale.

Open Fufu distinguishes lifecycle/admin commands, pre-match spawn lifecycle decisions, controller strategic decisions, and simulation state transitions.

A normal controller invocation operates transactionally against one immutable legal observation. On success, memory/directive/action changes commit together. On failure, temporary output is discarded.

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

Faction observations expose public Origin identity/traits and effective mechanical modifier sheets. Controllers should not need to reverse-engineer an opponent's Origin or relevant Echo-derived mechanical effects from outcomes.

### 6A.2 Persistent directives and one-shot commands

Model ongoing strategic intent as persistent directives and discrete actions as one-shot commands.

Persistent examples:

- attack/neutral-expansion operations;
- defense-priority policy;
- counter-responses;
- unit movement/patrol/targeting.

One-shot examples:

- build/upgrade;
- unit purchase/construction;
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
- generic land/naval/rail/path-class reachability and pathfinding;
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

Expose current ruleset/feature flags and exact public mechanical values. Expose pure deterministic calculators for published arithmetic/geometry such as growth, neutral-settlement progress/effective cost including residual semantics, capture advantage, counter-response exchange, terrain effects, structure/unit/weapon costs and legality, construction times, structure level gates, Transport embarkation costs, movement/pathing classes, range/blast geometry, spawn legality, and explicit terrain/structure/Origin/Echo modifiers.

Growth calculators use the faction's actual Origin-defined growth profile where applicable rather than forcing controllers to duplicate a transformed curve.

Calculators may use only supplied/legal information. They must not become hidden-state oracles or future-state simulators.

### 6A.7 Public game concepts, not inherited implementation classes

Even if OpenFront internally represents structures, ships, trains, missiles, Tanks, etc. through shared `UnitImpl` machinery, the public API should expose game-level **structures**, **mobile units**, and **weapons** as coherent public concepts.

The public defensive structure concept is **Fort**, even if inherited `DefensePost` classes/names remain temporarily useful internally during migration.

Movement APIs are intent-oriented: the controller selects destination/patrol/raid/target while the engine handles mechanical pathfinding/motion and autonomous local target/firing behavior. Do not expose Tank/Heavy-Artillery turret/fire cadence as frame-by-frame micro controls.

Major actions should have corresponding factual legality/cost/range/level/construction-time helpers so users are not forced to submit blind actions merely to learn rules.

### 6A.8 Events and decision receipts

Build a bounded typed event stream for legally observable meaningful changes since the previous controller invocation. This avoids forcing every controller to diff complete snapshots to notice captures, neutral-settlement Population costs, losses, completed/upgraded structures, completed mobile-unit construction, Tank/Warship combat or repair, amphibious Fort grants, operation lifecycle changes, FFY changes, hostility, defeat/capitulation, or strategic-weapon events.

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

Project strategically relevant active mechanical modifier sheets publicly, consistent with the canonical transparent-mechanics rule. Public projection includes the selected Origin and full Origin-trait sheet; relevant effective Echo/terrain/structure effects are surfaced so controllers do not need to infer hidden arithmetic.

This includes effective neutral-settlement cost, effective Transport embarkation cost, effective spawn profile, effective structure-level transformations, Observation/Command Post effects, Tank/Heavy-Artillery profile, radioactive Population-attack behavior, launcher-equivalence rules, SAM range/charge/cooldown rules, and strategic-weapon level requirements where altered by public mechanics.

### 6A.14 SDK and multi-file authoring

Allow multi-file local TypeScript controller projects that are compile/typechecked/bundled/certified into an immutable artifact.

The official SDK may provide neutral helpers/builders for selectors, priorities, deterministic math and ordinary collection ergonomics. It must not ship privileged doctrine such as weakest-enemy selection or best-target strategy.

### 6A.15 Three-phase Strategic Spawn — Accepted

Replace the final Open Fufu ordinary spawn flow with three deterministic pre-match phases:

```text
static map/config
→ Phase 1 broad influence choice
→ reveal all Phase-1 influence areas
→ Phase 2 optional broad re-pick
→ reveal all final influence areas
→ Phase 3 exact origin inside final influence area
→ simultaneous origin resolution + reveal
→ deterministic Initial Territory footprint generation
→ match start
```

#### Phase 1

Every participant gets the same public static map/ruleset/spawn-legality view, **every participant's surfaced Origin, Initial Territory value, Starting Population effects, effective spawn profile, and other strategically relevant public spawn-affecting modifiers**, and simultaneously submits the influence anchor(s) required by that profile using the ruleset-defined shape/scale.

Ordinary factions submit one broad influence area/anchor. The accepted split-origin trait requires **two areas, each 50% of the ordinary area**. If the ordinary shape is circular, each split area uses approximately 70.71% of the ordinary radius; it is area, not radius, that is halved.

These areas are **non-exclusive search spaces**, not ownership reservations. Overlap is legal and expected, including overlap between one faction's own two split areas.

After all Phase-1 choices resolve, reveal every Phase-1 influence area to every participant.

#### Phase 2

Every participant receives exactly one simultaneous opportunity to keep or revise the influence choice(s) required by its public spawn profile using the revealed Phase-1 intent of everyone else.

Do not stream Phase-2 revisions live. All participants choose against the same Phase-1 reveal; then reveal all final influence areas together. This prevents draft-order advantage and endless reactive counter-picking.

A split-origin faction revises its pair in the same one Phase-2 transaction; it receives no extra sequential counter-pick.

#### Phase 3

Every ordinary participant simultaneously chooses one exact legal spawn-origin cell inside its final influence area while knowing every final influence area.

A split-origin faction chooses **one exact legal origin in each final influence area**, simultaneously. Its two origins may be close or far apart; do not impose a hidden separation rule merely to force a particular playstyle.

Resolve duplicate/conflicting exact-origin submissions deterministically from the same pre-state, reveal final origins, generate starting footprint(s), then begin normal simulation/controller decisions.

The public API should therefore expose specialized pre-match lifecycle hooks capable of representing the faction's effective spawn profile rather than hard-coding exactly one anchor/origin into the protocol. Exact TypeScript names/types are implementation work.

Spawn-hook failure/missing output must use a deterministic legal fallback appropriate to the profile rather than faulting the controller for the match.

### 6A.16 Random and Fixed spawn modes — Accepted

Retain explicit alternatives:

- **Random Spawn:** match-seeded deterministic legal spawn selection that bypasses strategic controller choices;
- **Fixed Spawn:** exact configured starts for benchmarks, certification, debugging, scenarios/tournaments, and reproducible tests.

All exact final starts are revealed before the first normal match decision because ownership is globally visible once play begins.

Any mode that permits Origin spawn-profile mechanics must define deterministic Random/Fixed equivalents for the split-origin profile; scenario/fixed configuration may instead explicitly disable such modifiers where the ruleset publicly says so.

### 6A.17 Initial Territory footprint — Accepted

Add a surfaced **Initial Territory** starting-state quantity representing the target number of population-bearing cells each faction should own at match start.

The base comes from the ruleset. Explicit allowed Origin traits or other surfaced starting-state modifiers may change this quantity without changing Capacity-per-cell.

After exact origins resolve, deterministically grow compact connected roughly circular footprints outward from all origins **simultaneously** across legal population-bearing cells.

For a split-origin faction, compute the faction's final Initial Territory quota after all ordinary modifiers, split it approximately equally between its two ordered origins, and grow both footprints simultaneously with all other factions. A deterministic primary/secondary rule handles any odd-cell remainder. The footprints may touch/merge normally.

Required invariants:

- influence-area overlap does not consume or reserve Initial Territory;
- competing footprints are resolved independently of controller/process execution order;
- when topology permits, continue outward so every faction receives its full Initial Territory quota despite nearby competing footprints;
- final owned cells produce ordinary starting Capacity at one Capacity per population-bearing cell;
- Initial Territory does not itself determine starting current Population;
- the split-origin trait does **not** create local Population stores or duplicate Starting Population; the faction retains one unchanged global Starting Population pool;
- Origin/Echo rules may explicitly alter Starting Population without changing Capacity-per-cell;
- Initial Territory bonuses apply to the final faction quota before split, rather than once per split footprint;
- a larger Initial Territory value does not automatically enlarge broad influence area(s) unless an explicit separate rule says so;
- footprint generation and collision/tie-breaking are deterministic/versioned;
- singular granted starting structures/effects use a public deterministic primary-origin rule unless the granting mechanic specifies otherwise.

Exact growth geometry, collision/fallback algorithm, ordinary influence-area radius, minimum separation rules, base Initial Territory and starting Population values remain implementation/tuning details.

---

## 7. Map, cells, terrain, and Segments — Accepted

Retain/adapt the current dense integer `TileRef`/typed-array map substrate, compact terrain/state storage, deterministic adjacency, ownership mutation, water/pathfinding, authored map compilation/loading, impassables, and map-scale optimized iteration.

### 7.1 Segment layer

Add compact immutable Segment identity for every real map cell, including water and impassable terrain, plus immutable Segment metadata/adjacency. Segments remain query/strategy indexes rather than physical simulation buckets.

Dynamic terrain changes such as nuke-created Fallout/Deep Water do not regenerate Segment identity.

A temporary amphibious defensive state must not masquerade as a terrain type. The accepted fortified-landing design uses a real granted Fort instead, so terrain remains geography rather than short-lived tactical status.

### 7.2 Canonical terrain translation

The inherited OpenFront terrain substrate must be extended/reinterpreted to match `TERRAIN_AND_STRUCTURES.md`.

Canonical V1 base terrain concepts are:

```text
Plains
Highland
Mountain
Desert
Forest
Tundra
Marsh
Shallow Water
Deep Water
Impassable
```

`Deep Water` replaces the inherited generic public `Ocean` role. Fallout is **not** another mutually exclusive base-terrain enum; implement it as a persistent overlay/state on legal conquerable terrain so the underlying terrain's Capacity, traversal, buildability, offense/defense, and terrain-share identity remain queryable.

Required distinctions include:

- Tundra is conquerable but non-population-bearing, unbuildable, and not spawn-footprint eligible;
- Shallow Water is conquerable, non-population-bearing, unbuildable, ordinary-land-operation traversable, and naval traversable;
- Deep Water is naval traversable but unconquerable and not ordinary-land traversable;
- Mountain remains ordinary Population-based land-operation terrain but is a hard barrier to Tanks/Heavy Artillery;
- Shallow Water likewise blocks Tanks/Heavy Artillery even though ordinary territorial operations may cross it;
- optional water nukes create Deep Water, not Shallow Water.

Store the accepted provisional terrain values as versioned ruleset data rather than scattering them through switch statements that controllers must reverse-engineer.

### 7.3 Future procedural maps

Procedural/random map generation is new and must deterministically produce the same canonical terrain identities plus immutable Segment model from seed/version.

---

## 8. Ownership and neutral expansion — Accepted

Retain/adapt low-level cell ownership and incremental territory/border bookkeeping. Existing `conquer()`/`relinquish()`-style primitives remain useful internally.

Initial Territory footprint assignment is a pre-match ownership initialization path, distinct from neutral expansion and combat conquest.

Neutral expansion becomes an operation using ordinary Population and spatial intent. Neutral cells have **no automatic Population defender**, but settlement retains explicit progress/time and Population expenditure rather than becoming instant/free map paint.

Baseline Open Fufu rule:

```text
successfully acquired neutral population-bearing cell
→ expansion commitment loses 1 Population
→ ownership/Capacity transfer occurs
```

There is no neutral defender-side Population casualty because Terra Nullius is not a defending faction.

Conquerable **non-population-bearing** terrain such as Tundra/Shallow Water still requires acquisition progress/time but has zero baseline neutral-settlement Population cost because the 1-Population settlement rule is scoped to population-bearing cells.

Typed Origin/Echo/ruleset hooks may alter settlement progress/speed; structural settlement-cost changes such as the accepted Origin trait changing cost to `0.5 Population/cell` use their own typed hook. Implement fractional costs through deterministic faction-level residual accounting that survives ending/recreating expansion operations, preventing operation-churn exploits.

Neutral Fallout follows the underlying terrain's population-bearing classification and additionally applies its explicit acquisition-resistance/progress rule.

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

Population-bearing classification comes from the canonical terrain data. Ordinary population-bearing land contributes exactly one Capacity while owned; Tundra and Shallow Water explicitly contribute zero despite being conquerable. Fallout preserves the underlying terrain's classification.

Existing incremental territory counts should make this a cheap derived/read value, but victory/conquerable-territory accounting must remain separate from population-bearing/Capacity accounting because some conquerable terrain contributes zero Capacity.

Remove/avoid City Capacity bonuses, Echo/Origin max-Population or Capacity-per-cell bonuses, terrain Capacity multipliers, and hidden faction Capacity multipliers. Cities move to growth effects.

A surfaced Initial Territory modifier is allowed because it changes **starting ownership count of population-bearing cells**. Starting current Population remains a separate configured quantity unless an explicit surfaced Origin/Echo/ruleset rule ties it to Capacity or modifies its starting percentage.

### 9.3 Representation and fractional residuals

Authoritative Population values/controllers' allocations should normally use `uint32`-compatible non-negative whole integers.

Use deterministic fixed-point/residual state only where formulas or explicit mechanics require sub-unit precision. Fractional recurring costs such as `0.5 Population` neutral settlement do not expose fractional Available/Committed Population to controllers.

The neutral-settlement residual is faction-level persistent match state, not disposable operation-local state. Certification/replay/hash state must include it wherever required for determinism.

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

Potentially reuse/adapt attack identity, owner/target linkage, committed scalar Population, lifecycle/execution plumbing, border/actionability helpers, deterministic cell traversal, capture notifications, and the useful fact that inherited neutral conquest already consumes attacker resources/time.

Do not inherit old global defender formulas, old casualty formulas, exact inherited neutral troop-loss coefficients, bulk-conquest shortcuts, hidden large-faction bonuses, bot difficulty modifiers, or mutable-relation side effects.

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

Terrain, Forts, Origins, Echoes, and other explicit modifiers change the effectiveness of the one defender, not its Population count.

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

Implement **attack-side** and **response-side** effectiveness curves/parameters as distinct ruleset hooks even though their V1 defaults mirror one another. Origin/Echo/ruleset modifiers may address those hooks explicitly without replacing the core formula with arbitrary player code.

A counter-response is tied to one incoming hostile operation; its committed Population cannot be duplicated across targets. Ending/changing it is immediate on a successful controller decision and returns surviving Population to Available.

Exact `k`, final `M`, final `p`, and explicit side-specific modifier values are tuning data.

### 11.6 Capture throughput

Freeze engagement geometry at tick start. A target cell changes owner at most once per tick and one lane yields at most one capture that tick.

Therefore an operation with 300 engaged lanes cannot capture more than 300 cells in one tick. Actual capture count is usually lower according to pressure advantage, terrain, structures, and tuning.

### 11.7 Capture-coupled ordinary hostile land casualties

Delete the previous continuous ordinary hostile cell-capture casualty direction such as `2AD/(A+D)`.

For each **automatically defended population-bearing hostile cell** that changes owner under baseline rules:

- previous owner loses the 1 current Population defending that cell;
- winning attacker loses 1 current Population from the capturing offensive commitment;
- previous owner Capacity -1;
- winner Capacity +1.

The consumed defender is normally removed from Available Population. The accepted elastic-defense Origin trait instead preserves that automatic defender and leaves/returns it Available; attacker casualty, ownership transfer, and Capacity transfer remain unchanged.

A hostile-owned undefended capture causes no ordinary cell-capture Population casualty. This does **not** apply to Terra Nullius: neutral settlement follows §8 and consumes its explicit baseline settlement cost even though there is no neutral defender.

Conquerable non-population-bearing cells may still receive a real automatic defender and therefore still incur the ordinary defender/attacker one-for-one capture casualties when successfully captured, but they transfer zero Capacity.

Stalled/failed ordinary hostile cell pressure does not independently create Population attrition.

Other explicit mechanics such as counter-response combat, neutral settlement, nukes, Tank Population attacks, and transport destruction may reduce Population without ordinary hostile defended-cell capture.

### 11.8 Multi-faction handling

Aggregate same-faction local pressure before resolution. Resolve all claimants from the same pre-state; strongest successful claimant wins a contested cell deterministically. The cell still flips only once.

For a defended capture, the ordinary casualty pair applies only between the previous owner and the winning claimant, subject to any explicit defender-survival rule. **Unsuccessful third-party claimants lose no Population merely because they also contested that cell.**

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
- zero Available Population means zero baseline Population defense;
- neutral population-bearing settlement takes progress/time and consumes one baseline Population per captured cell;
- conquerable non-population-bearing settlement still takes progress/time but consumes zero baseline settlement Population;
- fractional settlement modifiers cannot be exploited by operation recreation;
- defender-survival traits never duplicate defenders or erase the winning attacker's ordinary defended-capture casualty.

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

Cities contribute to growth, **not Capacity**. Population-growth Origin traits/Echoes may contribute explicit growth modifiers, and Origin traits may replace the ordinary utilization profile through typed/versioned rule data, but Capacity/max Population remains territory-derived.

City structure level from 1 through 5 scales the City's explicit Growth contribution. The accepted fully-developed-City Origin transformation affects purchase/starting level and price, not the Capacity invariant.

If Capacity is zero, growth is zero and no division by zero occurs.

Remove passive worker-gold coupling from Population entirely.

---

## 13. Structures — Accepted

Retain useful generic spatial structure lifecycle infrastructure: build legality, construction duration, under-construction state, ownership/capture, levels/upgrades, health/destruction where relevant, and type-specific behavior.

### 13.1 Public structure concepts and hard five-level model

The canonical V1 public structures are:

- City;
- **Fort** (adapt inherited Defense Post internals as useful, but expose Fort as the Open Fufu concept);
- Port;
- Factory;
- Missile Silo;
- SAM Launcher;
- **Observation Post**;
- **Command Post**.

All eight are upgradeable and have legal levels **1–5 only**. Level 5 is a hard maximum. Build at level 1 unless an explicit surfaced rule grants another starting level.

Remove/override inherited effectively unbounded upgrade behavior.

Every structure uses the accepted fixed cost-by-type-and-target-level table from `TERRAIN_AND_STRUCTURES.md`. Do **not** preserve OpenFront's inherited constructed-level scaling as the authoritative price model, and specifically remove the inherited shared Port/Factory price counter. Each L2–L5 upgrade takes the same authored construction time as that structure's L1 build. New structures remain inactive until completion; an upgrading structure continues at its previous completed level until the new level activates atomically.

Canonical progression direction:

| Structure | Migration direction |
| --- | --- |
| City | level scales explicit Population Growth contribution; never Capacity |
| Fort | level scales both automatic-defender pressure modifier and coverage area |
| Port | level scales passive naval repair radius and passive repair speed; preserve useful docked/fast repair at low levels |
| Factory | level scales Factory-driven industrial/train FFY event value and simultaneous Tank/Heavy-Artillery repair capacity |
| Missile Silo | level scales charge capacity; L1 Atom, L3 Hydrogen, L5 MIRV |
| SAM Launcher | level scales ordinary interception range and charge capacity |
| Observation Post | level scales legally revealable tactical observation radius |
| Command Post | level scales ordinary land source offensive-pressure support and coverage radius |

The accepted provisional level values, build/upgrade times, and prices are versioned data in the canonical registry, not open-ended implementation guesses.

Whether Port level also retains inherited Trade-Ship-frequency scaling is open translation work; do not rely on it as the sole reason Port levels matter.

No structure recreates hidden global Military Power.

### 13.2 Fort implementation

Reuse/adapt Defense Post area/range and local-defense plumbing where useful, but translate it into Fort semantics under the one-Population automatic-defense model.

A Fort never creates phantom defenders. Its effect requires an actual automatic defender in the cell and modifies that defender's effectiveness.

Implement the accepted provisional L1→L5 pressure/radius data from the canonical registry. Same-type overlapping Forts use the strongest applicable effect rather than adding percentages.

The accepted fortified-amphibious-landing Origin trait needs a deterministic path to grant a normal permanent **level-1 Fort** after a successful landing without treating that grant as a purchase.

### 13.3 City direct-L5 purchase transformation

Implement the accepted Origin rule as a typed City-purchase transformation:

- purchased City level is fixed to 5;
- levels 1–4 are unavailable as purchase results for that faction;
- price is 95% of the ordinary cumulative L1 build + L2–L5 upgrade prices;
- under the accepted provisional City table this is `1.995m FFY`;
- this is one build/purchase transaction, not four upgrade-spend events;
- captured lower-level Cities retain their existing level and may use ordinary upgrades unless another rule forbids them.

This transformation must compose deterministically with free-first-purchase and no-upgrade-spend traits according to the canonical design, without a compatibility exception.

### 13.4 SAM transformed shield profile

Keep/adapt the existing automatic SAM targeting/interception infrastructure. Controllers should not need a new one-off Origin-only interception action.

Ordinary SAMs use one interception charge per completed level and the accepted provisional range/recharge table from the registry.

Support a typed Origin transformation that changes SAM rules to:

- substantially larger interception range (`+50%` provisional);
- exactly one charge regardless of level;
- doubled ordinary recharge cooldown (provisional);
- upgrades still improve range but never add charges.

Target selection remains automatic and legally observable through normal SAM mechanics; a bait weapon can therefore consume the single charge, but the structure itself is not permanently sacrificed.

### 13.5 Observation Post implementation

Add a persistent spatial Observation Post with accepted L1→L5 radius `40 / 55 / 70 / 85 / 100`, 5-second build/upgrade time, and the canonical cost table.

Its coverage participates in the authoritative visibility projection. It reveals only state the observation rules designate legally revealable—e.g. hostile mobile units, structures, and manifested operations—and must never bypass controller-memory/private-state boundaries.

Coverage is boolean; overlapping Observation Posts do not multiply information.

### 13.6 Command Post implementation

Add a persistent Command Post with accepted 10-second build/upgrade time, L1→L5 source-offensive-pressure support `+3 / +6 / +9 / +12 / +15%`, coverage radius `30 / 35 / 40 / 45 / 50`, and the canonical cost table.

The effect checks the **attacking source cell** of ordinary Population-based land engagement lanes. It does not modify Tank/Heavy-Artillery weapon damage, Warships, strategic weapons, or unrelated FFY effects.

Same-type overlapping Command Posts use the strongest applicable effect rather than stacking. The 10-second duration is intentional telegraphing and must not be optimized away into instant pre-attack placement.

---

## 14. Generic units, naval, amphibious, trade, rail, and armor — Accepted

Retain/adapt the generic unit framework internally: stable IDs, ownership, movement, target state, health, deletion, construction, upgrades where applicable, and type-specific runtime state. Do not expose this shared inherited implementation abstraction directly as the player-controller contract.

### Transport ships

Current transport payload maps naturally to committed Population. Carried Population is not Available for defense; a legal landing joins local offensive engagement. Transport destruction can explicitly kill carried Population.

The baseline Transport embarkation FFY cost is **0**. Implement a typed **additive embarkation-cost modifier** surface for Origin/ruleset effects rather than absolute replacement prices.

Accepted combination example:

```text
base Transport embarkation cost          0 FFY
fortified-landing Origin modifier      +250 FFY
existing Transport-cost drawback       +500 FFY
both together                           750 FFY
```

The fortified-landing trait creates its permanent level-1 Fort **only after a successful landing establishes the relevant land position**. Destruction/abort before successful landing creates no Fort. Because it is a grant rather than a purchase, it does not consume a separate free-Fort-purchase entitlement.

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

Adapt Port levels to the canonical naval-support progression: increasing passive repair radius and passive repair speed while preserving a useful close/docked fast-repair identity. Exact future retuning and whether trade spawning also scales with level remain tuning/translation work.

### Trains and rail

Retain useful physical/economic rail infrastructure and stop/arrival events. There is no hidden or explicit V1 land Deployment Rate for rail to modify.

Factory level feeds explicit Factory-driven industrial/train FFY event value rather than a hidden general multiplier.

A Train must expose/retain a deterministic snapshotted **current pending cargo FFY value** suitable for Tank interception. When a hostile Tank destroys/intercepts the Train before that payout, remove the Train, cancel the pending ordinary payout, and grant 100% of the snapshotted current cargo value to the Tank owner as the land-raiding FFY event. Previously earned Train FFY is never clawed back.

### Warships

Retain/adapt patrol, combat, transport interception, piracy, retreat/repair, health, and veterancy where compatible.

A purchased Warship now has a **5-second construction phase at its Port** before becoming active; remove the inherited effective instant-spawn behavior. A trait that changes Warship purchase resource/cost—such as population-funded Warships—does not bypass this time unless explicitly stated.

Add a generic typed **launcher-equivalence** hook for the accepted Origin mechanic that makes Warships count as Missile Silos. For such a Warship:

```text
effective Silo level = max(1, Warship rank/veterancy)
```

This allows ordinary rank-3 maximum Warships to reach Hydrogen legality but not MIRV; a separate +2 maximum-rank trait can produce a rank-5/MIRV-capable Warship without any hidden compatibility exception.

Do not hard-code this interaction into generic Warship code if it can live cleanly in effective-rule/launcher capability projection.

### Tanks

Add the **Tank** as the sole baseline persistent land military unit. One runtime Tank represents an armored formation rather than a literal one-vehicle simulation.

Canonical production/lifecycle direction:

- produced by an active owned Factory;
- **5-second construction time**;
- one concurrent Tank build per Factory;
- progressive active-count price curve from the canonical registry;
- health-bearing, with automatic retreat/repair behavior at Factories;
- no direct territorial capture and no carried Population;
- autonomous local pathing/target selection/firing under controller-assigned patrol/raid/area/target intent;
- no per-shot/turret/frame-by-frame controller micro.

Canonical baseline combat/economic roles:

- fight hostile Tanks/Heavy Artillery;
- intercept hostile Trains and capture their pending cargo value;
- directly attack hostile Population, causing current-Population casualties without capturing the cell.

Implement the terrain movement table from `TERRAIN_AND_STRUCTURES.md`. Mountain, Shallow Water, Deep Water, and Impassable are hard Tank barriers; other traversable terrains apply explicit speed multipliers. Neutral/Terra-Nullius cells do not form Tank transit corridors; ownership/hostility must make the path legal.

### Heavy Artillery — P43 Tank transformation

Do **not** add a second normally purchasable Artillery unit. P43 transforms the Tank profile for the entire faction.

Accepted provisional transformation:

```text
build time             5s → 10s
purchase cost          ×1.50
final movement         ×0.50
range                   30 → 45
max health              1000 unchanged
anti-armor              1000 damage / 12s
Population attack       1000 Population / 12s
Train raiding           disabled
movement barriers       same as Tank
projectiles             may cross terrain the unit itself cannot traverse
```

Preserve the intended emergent matchup without hidden ratio modifiers: one prepared Artillery beats one Tank; one Artillery loses to two Tanks after the opening shot; two Artillery are intended to lose to three Tanks after their opening volley; exposed/reloading Artillery is Tank-favored.

### Radioactive Munitions — P44 Population-attack transformation

Implement P44 as a typed post-success hook on **Population attacks only**. It never triggers from anti-armor combat or Train interception.

After ordinary Population damage resolves:

- Tank form: inspect target-centered Manhattan radius 2 and neutralize/apply Fallout to up to **10** eligible enemy-owned population-bearing cells;
- Heavy-Artillery form: inspect target-centered Manhattan radius 5 and neutralize/apply Fallout to up to **50** eligible enemy-owned population-bearing cells.

Skip structure-occupied and non-population-bearing cells. Order eligible candidates deterministically by distance then stable tile ID. If too few valid cells exist inside the radius, affect fewer cells rather than expanding the search.

Capacity loss comes from neutralization/removal of ownership, not from Fallout itself. P44 adds no second direct Population-damage multiplier. P43 and P44 must compose normally because both are ordinary independent legal traits.

---

## 15. Strategic weapons and SAM — Accepted

Retain deterministic launch/trajectory/interception infrastructure: silos, missile flight, warning/visibility where allowed, SAM interception, detonation geometry, and structure/unit/terrain effects.

Replace old scalar-troop/attack-stack casualty handling and mutable-alliance side effects.

### 15.1 Missile Silo levels and weapon gates

Adapt Missile Silo upgrade/charge plumbing to the universal level-1-through-level-5 structure model.

Canonical weapon requirement:

```text
Silo L1+ → Atom Bomb
Silo L3+ → Hydrogen Bomb
Silo L5  → MIRV
```

Higher Silo level also increases ordinary launch-charge capacity. A newly built or freely granted Silo starts at level 1 unless the granting effect explicitly states otherwise.

Strategic-weapon legality must resolve against the selected physical launcher. The controller/API should be able to identify the launcher used rather than silently selecting an arbitrary Silo when launcher state matters.

A free/granted MIRV does not bypass the L5 launcher requirement or other ordinary non-price legality. Preserve any explicitly authored affordability/precondition semantics while consuming zero FFY on the actual granted purchase/launch where that is the trait's rule.

Warship launchers use the effective-level rule in §14.

### 15.2 MIRV rebalancing

Retain MIRV as an exceptional late-game strategic threat, but reduce inherited devastation moderately in addition to the L5 access gate.

Do not blindly preserve the inherited ~350-warhead configuration. Benchmark/playtest a lower starting range, roughly **250–300 warheads** as an initial tuning candidate, and/or corresponding spread/effect adjustments.

The target is still `MIRV is terrifying`, not `a much smaller faction can reliably erase a dominant leader regardless of prior strategic state`.

### 15.3 Standard nuclear fallout

The current OpenFront source already provides a useful political pattern to retain and translate:

```text
owned affected population-bearing land
→ owner relinquishes cell
→ cell becomes neutral
→ ordinary mode applies Fallout overlay
→ underlying terrain remains queryable/conquerable according to its base rules
```

Open Fufu standard nuclear semantics are therefore:

- each affected owned population-bearing land cell is relinquished and becomes neutral;
- the former owner loses 1 current Total Population per such affected owned cell, capped at zero;
- the former owner's Capacity falls by 1 because ownership of that population-bearing cell was lost;
- Fallout remains an overlay and applies explicit capture resistance/capture-speed effects instead of phantom defensive Population;
- a later faction gains Capacity from reconquest only if the underlying terrain is population-bearing.

Do **not** blindly inherit OpenFront's exact current fallout coefficient; use the accepted provisional Fallout/base-terrain data from the canonical registry and keep future retuning versioned.

### 15.4 Optional water-nuke mode

Retain OpenFront's `waterNukes` concept as an optional ruleset mode.

When enabled, affected land may be converted to **Deep Water** rather than ordinary Fallout. Converted Deep Water is non-population-bearing and no longer ordinary conquerable territory, so the current victory denominator shrinks accordingly. Segment identity remains unchanged.

The owned-cell Population casualty and Capacity-loss event still applies to destroyed owned population-bearing land before/through conversion.

Cities do not add extra Population casualties; they affect growth, not Capacity.

Physical units, fleets, transports, structures, or offensive forces directly hit by the weapon may take their own explicit local damage in addition to the terrain-linked rule.

Exact weapon radii, physical-unit lethality, and final MIRV power numbers remain tuning/translation work.

---

## 16. Teams, diplomacy, `atWar`, defeat, capitulation, and victory — Accepted

Retain fixed pre-match teams. Remove mutable alliance/relation diplomacy. FFA opponents remain legally attackable regardless of `atWar`; `atWar` is symmetric recent-hostility state rather than a permission gate.

Trade with enemies remains possible with the canonical explicit wartime penalty rather than ordinary embargo prohibition. Do not inherit troop/gold donations automatically.

Fixed teammates share legal operational observations and may exchange bounded deterministic delayed team signals through the public controller contract.

### Defeat

After all same-tick ownership changes resolve, **zero owned population-bearing territory means immediate defeat**, regardless of remaining Population, operations, fleets, Tanks, Artillery, or transports. No comeback/dispossessed state exists.

### Resignation/capitulation

A resigned/capitulated faction becomes a passive territorial remnant and keeps its owned territory, static structures, and surviving Population.

On resignation/capitulation:

- growth becomes permanently zero;
- controller decisions permanently stop;
- active land offensive/counter-response operations cease and surviving Population returns to Available;
- all mobile units are removed immediately, including Warships, Tanks/Heavy Artillery, Trade Ships, Trains, and Transport Ships;
- Population aboard removed transports returns to Available rather than dying;
- removed mobile units provide no FFY/resource refund;
- in-flight offensive projectiles/strategic weapons are cancelled/removed;
- static passive effects may continue where explicitly legal;
- static active behaviors stop, including missile launches, SAM firing, trade/train/unit spawning, and other autonomous strategic actions;
- remaining Available Population continues ordinary passive defense;
- territory remains capturable normally;
- no new strategic actions occur.

Replace old partial-territory/overtime/doomsday victory rules with the canonical 100%-territory/opposition-defeated rules. Reward settlement is separate from victory: defeat preserves the Echo rolls already accumulated by the relevant solo or fixed-human-team reward entity, while victory adds the explicit +5-roll bonus.

Detailed lobby UI/UX remains later product work.

---

## 16A. Official PvE AI migration — Accepted

The existing OpenFront Nation-AI code is useful as **behavioral reference and as an example of composing reusable strategy components**, not as the target gameplay contract.

Retain/reuse selectively:

- the general pattern of composing aggression, economy, construction, naval, armor/raiding, retaliation, target-selection, and strategic-weapon behaviors;
- useful strategy-neutral helper logic that can be moved behind the Open Fufu observation/action contract;
- creator-authored preset/version concepts where they remain compatible.

Do not preserve:

- direct unrestricted access to canonical `Game` state when that exposes information a player controller cannot legally observe;
- global troop/Population reads that bypass the canonical visibility contract;
- Easy/Medium/Hard simulation modifiers or difficulty-dependent resource cheats;
- hidden reaction-speed, income, growth, omniscience, or legality advantages.

Official PvE AI should consume the same legal gameplay observation/action contract as player controllers, including Observation-Post visibility, Tank/Heavy-Artillery rules, and the same effective spawn-profile protocol in modes that use strategic spawning. It may execute as trusted code and therefore need not use the hostile-code sandbox, but trusted execution must not create gameplay-information or rules privileges.

Official AI factions bind an Origin and Echo loadout through the same legal mechanics. Official Origins are ordinary legal Origin builds from the same deployed trait catalogue, with no creator-only hidden points, traits, formulas, or bonuses.

The provisional V1 character-based preset roster and each character's shared allowed Origin pool are maintained in [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md). Human controller/Origin/Echo Set choices lock before the match seed resolves each AI preset's allowed Origin; the selected AI Origin is then surfaced before Strategic Spawn. The randomly selected Origin does not alter the preset's eventual difficulty/reward identity.

Exact official AI implementations are creator-owned, immutable/versioned when bound to a match, and may reuse internal strategy components without turning those components into privileged player-facing policy APIs. Difficulty belongs to the implemented controller's competence rather than lore power. Higher-difficulty/special AI presets may additionally carry explicit individually authored Echo reward bonuses; those bonuses are progression data, not hidden simulation advantages. Exact difficulty ratings and bonus values remain deliberately unset until the corresponding controllers are designed; the Echo system itself does not define a universal difficulty-tier reward multiplier.

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

Observation Post coverage is one explicit input to legally revealable tactical/operational state. Implement it server-side in the projection/visibility layer; it must not become browser-only hiding or a controller-side inferred hack.

Public projection includes the selected Origin and full mechanical Origin-trait sheet plus strategically relevant active mechanical modifier sheets so hidden arithmetic does not need to be reverse-engineered from outcomes.

That public mechanical projection includes spawn-profile changes, Initial Territory/Starting Population effects, neutral-settlement cost, Transport embarkation cost, structure-level transformations, Observation/Command Post values, Tank/Heavy-Artillery profile, Radioactive-Munitions footprint rules, launcher equivalence/weapon level requirements, and other strategically relevant Origin/Echo rules.

All derived query/calculator APIs operate strictly over legal projected information and must not create side-channel visibility leaks.

During Strategic Spawn, the pre-match information projection is explicitly phase-dependent: all participants' surfaced Origins, Initial Territory values, Starting Population effects, effective spawn profiles, and other strategically relevant public spawn modifiers are visible before Phase 1; Phase 1 choices are hidden until all are committed; the full Phase-1 influence set is then public for Phase 2; Phase-2 revisions are hidden until all are committed; final influence areas are then public for Phase 3; and exact origin(s) are revealed after simultaneous resolution before normal play begins.

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
Origin creator / Origin selection UI
Echoes collection / Echo Sets UI
Echo reward-batch / pending-settlement / duplicate-comparison UI
Gacha Store / paid-pull pity presentation UI
lobby / strategic-spawn UI
```

Live connection/reconnect uses:

```text
authoritative legal snapshot
→ incremental observer deltas
→ fresh snapshot on resync if needed
```

Do not require a reconnecting browser to replay the entire historical turn stream.

Controller debug annotations are private participant/developer data, not public match state. They should be recorded/streamed through bounded dedicated diagnostics channels rather than mixed into authoritative gameplay state.

Strategic spawn selections/reveals should be represented as explicit pre-match state/protocol messages rather than pretending they are ordinary simulation ticks. The UI must display one or two areas/origins according to each faction's public spawn profile without special manual intervention.

The Echo UI must implement the settled card/collection language: a searchable/filterable/favoritable **Echoes** grid; Echo Sets referencing identity IDs; deterministic generated names; tier-family border colors with continuous EchoScore gradients; responsive hover/focus card expansion with touch-safe alternatives; deliberately dull gray/white Questionable presentation with no special aura/effects; restrained animated Lucky glow; and intentionally excessive Cheater pink/violet/rainbow/radiant-beam presentation. The identity-level character/stat naming components remain recognizable across quality treatments and duplicate upgrades, while magnitude adjective(s) change with the retained roll.

Generated names are derived from a stable identity-level character possessive and concrete-stat token(s), plus polarity-aware magnitude descriptor(s). Mixed names use the accepted `with a side of` grammar. Exact mechanical modifiers remain displayed directly and are authoritative; the flavor name never replaces the stat sheet. Avoid mechanically assembling awkward scope prefixes into phrases such as `Naval Guitar Solo` when a deliberate concrete-key token/override would read better.

Large acquisition batches must group repeated identities, eliminate dominated duplicate rolls, and show only surviving incomparable Pareto-frontier choices. The current retained copy is the first/default choice when it survives; if it is dominated, the deterministic highest-EchoScore survivor may be the UI default without redefining Pareto superiority. The result remains a persistent pending settlement through reconnect until accepted, and V1 blocks another reward-bearing match or additional Gacha pulls while one remains unresolved.

Gacha presentation must reflect the actual settled mechanics: 10 Middle Fingers per pull, 100 Middle Fingers per ten-pull with no bonus/discount, one sequential paid-pull pity counter across singles/batches, Lucky+ at `EchoScore >= 1.00`, power-12 rescue toward the 50th-pull hard guarantee, match rewards having no effect on Gacha pity, and no Cheater guarantee.

The renderer/UI must gain clear state for the new terrain identities, Observation/Command Posts, Tank/Heavy-Artillery construction/combat/repair, and the difference between ordinary owned terrain, neutralized Fallout patches, and Deep/Shallow Water.

Observer publishing must be optional in headless certification/batch simulations.

---

## 19. Replay, records, and crash behavior — Accepted direction

Preserve deterministic archive/replay philosophy but make the server the source of canonical state/hashes.

Archive exact committed controller decisions/operation changes so ordinary replay does **not** need to re-execute historical untrusted controller code. A stronger verification/debug mode may separately re-run archived controller/runtime versions and compare outputs.

Record/bind the exact terrain/structure/unit ruleset version, Origin definition/version, Origin-trait catalogue identity where required, equipped Echo **identity IDs plus the exact retained magnitude configuration used for the match**, Echo mechanical-identity catalogue version, Echo naming/presentation version where historical wording/presentation needs it, applicable acquisition/roll-rules version, and enough spawn inputs/resolution identity to reproduce the same Strategic/Random/Fixed spawn outcome and Initial Territory footprint(s) without relying on later code defaults.

Replay/hash state must include rule-bearing residual/effective state such as faction-level fractional neutral-settlement residuals, mobile-unit construction state, Tank/Heavy-Artillery health/repair/targets, and any deterministic Radioactive-Munitions footprint resolution needed to affect later outcomes.

Retain enough bounded controller debug annotation/log history to support the programming debugger/replay experience without making debug output simulation-authoritative.

V1 may treat an authoritative match-process crash as:

```text
match aborted
no progression reward
detailed crash record retained
```

Architect records so later replay-to-last-tick/checkpoint recovery remains possible, but crash-resume is not V1-required.

---

## 19A. FFY modifier translation — Accepted

FFY remains event-driven, but Origin/Echo build modifiers should not expose every individual FFY event as a separate public build-stat axis.

Translate FFY modifier plumbing into a **small set of broad source families**, conceptually around:

- generic/overall FFY;
- military/conquest FFY;
- naval/trade FFY;
- industrial FFY.

Exact final naming/mapping is implementation/tuning work. Individual event identity is still preserved internally for simulation, replay, diagnostics, and reward attribution.

Factory level scales explicit Factory-driven industrial/train FFY event value through this economic-event system rather than recreating passive generic income. The base Factory-event payout itself is expected to be materially stronger than inherited OpenFront's current very weak Factory economy; exact FFY event amounts remain balance work.

Tank Train interception produces a land-raiding FFY event from the intercepted Train's snapshotted pending cargo value. It should map to an appropriate broad economic family while retaining precise event identity for replay/diagnostics.

Transport embarkation cost is an FFY **cost**, not an FFY income-source family. Compose Transport-cost traits additively on their dedicated cost hook.

Identity-defining exceptions such as changing/removing the ordinary wartime trade penalty may exist as explicit curated Origin traits. Do not create a generic arbitrary-formula facility for players, and do not rely on hidden Origin/Echo incompatibility rules to preserve intended tradeoffs; curate the deployed catalogues accordingly.

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

Use **SQLite** as the V1 authoritative structured runtime store, with normal migrations, foreign keys, and WAL-style deployment where appropriate.

### 21.0 Public source versus private/runtime data

The public `open-fufu-io` repository defines the reusable game implementation and data contracts. For Echoes, the compact generated-name grammar/configuration may also live in public/versioned game data; it is not a 12,927-row authored-name corpus and does not require a private copyrighted quote pack.

Public source should contain things such as:

- semantic stat/type definitions and stable identifiers;
- schemas and migrations;
- deterministic Echo identity-generation/materialization logic;
- EchoScore, acquisition, Pareto/duplicate, reward, Gacha, pity, and validation algorithms;
- generated-name grammar and the accepted magnitude descriptor table;
- versioned shape-character pools and concrete-stat token mappings once authored;
- UI/rendering implementation;
- synthetic/sample fixtures sufficient for development/tests.

The live installation consumes versioned runtime/private records including active granular Echo/rules configuration where data-driven, the production mechanical registry/materialization where useful, owned rolls, Echo Sets, Middle Fingers balances, pity state, pending settlements, and other account/progression records. Accepted V1 values may be documented here and in the design contract while the executable implementation loads corresponding active values from versioned data where practical rather than requiring source edits to retune them.

**V1 does not require or store an Echo anime-dialogue corpus, Echo-to-line assignments, MAL source catalogue, or quote/subtitle import metadata.** Authored anime dialogue/reference content is instead a much smaller Origin-trait / Official-Origin content concern and can use an implementation-appropriate authoring/revision workflow when that content is produced.

Persistent concepts include:

- internal users/linked identities;
- sessions/auth metadata;
- controller drafts/source packages;
- immutable published controller bundles/versions;
- certification status;
- active presets;
- ruleset/terrain/structure/mobile-unit data versions;
- Origin trait-catalogue versions;
- Official Origin definitions/versions;
- Custom Origin definitions bound to the exact catalogue/version they use;
- Echo mechanical-identity catalogue versions and acquisition/roll-rules versions;
- the 12,927 fixed mechanical Echo identity definitions or a versioned deterministic representation/materialization of them;
- **Echo naming versions/configuration**: shape-character pools, concrete-key stat tokens, polarity-aware magnitude descriptor table, grammar/order rules;
- owned Echo rolls: account + Echo identity ID + retained magnitude(s), at most one retained configuration per identity, plus favorite state where stored there or separately;
- saved named **Echo Sets** referencing owned Echo identity IDs rather than historical magnitude instances;
- **Middle Fingers** balance;
- Gacha Store paid-pull pity state: consecutive non-Lucky+ counter plus the versioned purchase/qualification/curve rules needed to interpret it;
- persistent pending reward/Gacha settlement state including surviving per-identity Pareto-frontier candidates, deterministic defaults, attributable Middle Fingers, source, and status;
- auditable Echo acquisition/reward events where useful, including source, rolled magnitudes, EchoScore/tier, duplicate/Middle-Fingers result, retained/rejected/chosen outcome, and pity before/after when applicable;
- official AI versions and configured special-AI Echo reward bonuses once those presets/controllers are assigned;
- matches/results;
- per-faction bound Origin and exact equipped Echo identity+magnitude set used by the match;
- reward-entity / accumulated Echo-roll result data needed for correct post-match settlement and audit;
- spawn configuration/resolution metadata required for replay, including effective one-/two-origin spawn profile where relevant;
- replay metadata;
- progression/rewards.

Generated Echo display-name strings generally need **not** be persisted because they can be reproduced from identity + retained magnitude(s) + naming version.

Large replay/log/debug artifacts may be stored as compressed files with path/hash/version metadata in SQLite rather than bloating the database unnecessarily.

Exact schema, indexes, backup/retention policy, Origin reference-content authoring format, and replay-file layout remain implementation work.

### 21.1 Origin definitions and production validation

Origins are declarative/versioned data, not executable player code.

Production needs ordinary structural validation for Custom Origins, including:

- all trait IDs exist in the bound deployed catalogue/version;
- the Origin obeys the published Origin Point budget;
- it obeys the published maximum trait count;
- it obeys the published maximum drawback-refund allowance;
- the serialized definition is well formed.

Production must **not** maintain a hidden pairwise compatibility matrix, trait-family exclusion table, or emergency rule saying an otherwise public-legal combination is forbidden because two traits interact badly.

Hard invariant:

> If traits are present in a deployed catalogue, every combination satisfying the public point/trait-count/drawback-refund rules is a valid selectable Origin.

This includes the accepted interactions among fractional neutral settlement, additive Transport cost, fortified landings, defender survival, split spawning, structure-level transformations, free/granted structures/weapons, Warship launcher equivalence, Warship construction delay, Tank transformations, Radioactive Munitions, and upgrade-spend constraints.

If that invariant cannot be maintained, the catalogue/version is defective and must be corrected before deployment.

Official Origins use exactly the same deployed catalogue and public builder constraints as Custom Origins. They receive no hidden points, creator-only traits, or privileged rule hooks.

### 21.2 Accepted catalogue mechanics now requiring typed rule data

The current accepted design passes introduce concrete catalogue mechanics that the rule schema must be able to represent without executable player code, including:

- neutral settlement cost `0.5 Population/cell` with faction-level residual accounting — **provisional 5 points**;
- fortified amphibious landing: `+250 FFY` Transport embarkation and successful-landing permanent L1 Fort — **provisional 7 points**;
- automatic defender survives defended-cell capture — **10 points**;
- split strategic origin: two half-area influence regions/origins and split Initial Territory, unchanged global Starting Population — **10 points**;
- giant single-charge SAM shield: provisional +50% range, one charge, 2× cooldown — **provisional 6 points**;
- purchased Cities direct to L5 at 95% cumulative ordinary L1→L5 cost — **provisional 6 points**;
- P43 Heavy Artillery: transform every Tank into the accepted slower/longer-range/high-alpha/no-Train-raiding profile with 10s construction — **provisional 8 points**;
- P44 Radioactive Munitions: successful Population attacks neutralize/apply Fallout to the deterministic 10-cell Tank / 50-cell Heavy-Artillery footprints — **provisional 9 points**.

The concrete catalogue is maintained in `ORIGIN_TRAIT_CATALOGUE.md`. Provisional point balancing may change through testing without changing these accepted mechanic identities.

### 21.3 Echo identity, ownership, rewards, collection, generated naming, and Gacha Store migration

The collectible system formerly referred to as **items** is canonically **Echoes**. Implement the model in [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md), not the retired magnitude-specific or dialogue-assignment catalogue model.

The persistent mechanical identity registry contains exactly **12,927 fixed identities** derived from the accepted 93 concrete stat+scope keys and three shapes. Mechanical identity fixes identity ID, shape, concrete key(s), and polarity. The production rows should be deterministically derivable/materializable from the versioned key catalogue and shape rules rather than maintained as 12,927 hand-authored source-code constants. Magnitudes are **acquisition-instance data** and reroll whenever that identity is acquired.

Implement the Echo display name as a deterministic function of identity + acquired/retained magnitudes + naming version. The naming configuration contains shape-specific anime-character possessive pools, one deliberately authored token/noun phrase per concrete stat key (or explicit concrete-key override), the accepted polarity-aware magnitude descriptors, and fixed grammar/order rules.

Accepted magnitude descriptors:

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

Descriptor sign follows **beneficial/harmful polarity rather than raw arithmetic sign**. For example, a beneficial `-4%` build-cost modifier uses `Amazing`; a harmful `+4%` build-cost modifier uses `Wretched`.

Accepted templates:

```text
Single:
<Character>'s <positive descriptor> <stat token>

Dual positive:
<Character>'s <descriptor1> <stat token1> of <descriptor2> <stat token2>

Mixed:
<Character>'s <positive descriptor> <positive stat token>
with a side of <negative descriptor> <harmful stat token>
```

Character/stat words remain stable for the identity under the naming version; magnitude adjective(s) may change when the retained roll changes. Dual stat order must be deterministic. Avoid mechanical-sounding scope-prefix assembly such as `Naval Guitar Solo` merely because a key is Warship-scoped; deliberately authored concrete-key phrases/overrides are preferred. Examples such as `Guitar Solo` remain illustrative until deliberately assigned in the naming config.

Ordinary acquisition must follow the settled probability pipeline:

1. choose shape `50% mixed / 35% dual / 15% single`;
2. choose uniformly among all registered identities in that selected shape;
3. enumerate that identity's legal integer magnitude configurations;
4. calculate EchoScore from signed `x/M` normalized contributions;
5. sample magnitudes using the published EchoScore weighting curve, including the gentler negative-score anchors;
6. derive the Trash / Questionable / Decent / Not Bad / Lucky / Cheater rolled-quality tier.

EchoScore may drive roll sampling, presentation, sorting, Middle Fingers salvage, and Gacha qualification, but must never override Pareto duplicate choice.

Persist at most one retained magnitude configuration per account+identity. Owned identities remain eligible to drop/pull again. Every duplicate awards **Middle Fingers** according to the newly acquired duplicate's tier:

```text
Trash         1 Middle Finger
Questionable  2 Middle Fingers
Decent        3 Middle Fingers
Not Bad       4 Middle Fingers
Lucky         6 Middle Fingers
Cheater       8 Middle Fingers
```

Then compare the new roll with the retained roll using canonical Pareto rules: strict dominance auto-upgrades, strict inferiority auto-rejects, and incomparable rolls require player choice. Batch acquisition processing groups repeated identities, reduces them to the Pareto frontier, and shows only surviving incomparable candidates. Persist unresolved results as a pending settlement through reconnect; V1 must not allow another reward-bearing match or further Gacha pulls while such a settlement remains unresolved.

Implement match rewards as an accumulated roll pool attached to the canonical reward entity:

- start at 0;
- +1 for each qualifying opponent defeated while the reward entity remains active, regardless of kill credit;
- configured special-AI preset bonus in addition to its ordinary +1, once assigned to that implemented preset/controller;
- +5 for victory;
- defeat preserves accumulated rolls;
- every accumulated roll becomes an Echo acquisition.

For fixed human teams, the human team is the reward entity and each human teammate receives the **full** final pool rather than a divided share; one human's early elimination does not stop team reward accumulation while another human teammate remains active.

Implement the **Gacha Store** exactly as the settled V1 baseline:

```text
1 pull   = 10 Middle Fingers
10 pulls = 100 Middle Fingers
```

There is no ten-pull discount or bonus. A ten-pull is ten sequential single pulls sharing one pity counter.

Lucky-or-better is `EchoScore >= 1.00`. Pity is **paid-pull-only**: match reward acquisitions neither advance nor reset it. After `n` consecutive non-Lucky+ paid pulls, use the power-12 rescue curve:

```text
r(n) = (n / 49)^12
P_lucky+(n) = P0 + (1 - P0) × r(n)
```

with the 50th consecutive paid pull guaranteed Lucky-or-better if the ordinary roll does not qualify. Any natural or rescued paid Lucky/Cheater resets the counter. Rescue/guarantee samples from the ordinary generator conditioned on `EchoScore >= 1.00`. There is **no Cheater pity or guarantee**.

The browser collection surface is **Echoes**, not Inventory. Implement the settled card grid, generated-name/character/stat-token search where useful, multi-select mechanical filtering, favorites, useful quality sorting, no unknown silhouettes, and multiple saved seven-Echo configurations provisionally named **Echo Sets** referencing identity IDs. Replacing a retained duplicate roll automatically updates every Echo Set that references that identity and may also change the generated magnitude adjective(s) shown for that same identity.

V1 has **no Echo dialogue-line/voice-line assignments, MAL Echo source catalogue, or quote/subtitle harvesting/import pipeline**. Authored anime dialogue/reference content belongs to the much smaller Origin-trait / Official-Origin presentation surface for V1 and may use its own lightweight curation process independently of Echo implementation.

Do not preserve stale persistence/UI/API naming merely because inherited or provisional code called these records `items`; internal transitional database/type names may be migrated pragmatically, but the public game concept is Echo.

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

A candidate Origin trait catalogue may deploy only after its exhaustive legal-combination test gate succeeds.

---

## 23. Build, tests, benchmarks, and performance tooling — Accepted direction

Retain useful TypeScript/build/test infrastructure where compatible but expect substantial changes.

Useful inherited foundations include TypeScript checking, Vite/browser build, Node server tooling, Vitest, server/lobby tests, full-game performance tooling, GC/heap profiling, replay harnesses, map/pathfinding algorithms, and the Go map generator.

Remove tests that assert intentionally removed OpenFront behavior and replace them with Open Fufu invariants.

### 23.1 Authoritative map packaging

Current OpenFront production packaging assumes the server does not simulate and may therefore omit server-side map binaries/resources. That assumption is incompatible with Open Fufu authority.

The authoritative match runtime must have deterministic access to the exact map binary/data, Segment metadata, terrain/structure/mobile-unit ruleset data, Origin/Echo data, and other rule-bearing static inputs bound to the match. Build/deployment work must therefore:

- package or otherwise make those authoritative resources available to match processes;
- version/hash them as part of match identity;
- ensure Strategic/Random/Fixed spawn resolution, live, headless, certification, and replay execution load the same rule-bearing data;
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
- Origin identity/trait sheets and relevant effective modifier projection;
- deterministic Origin rule composition and hashing/version binding;
- every Official Origin being an ordinary legal build under the same deployed catalogue/public constraints;
- **exhaustive enumeration of every Origin trait combination legal under the candidate catalogue's published point budget, trait-count limit, and drawback-refund limit before deployment**;
- every exhaustively enumerated legal Origin constructing/serializing/hashing successfully;
- exhaustive Origin combinations producing no non-finite, negative, structurally invalid, or engine-unsafe rule values;
- all exhaustively enumerated Origin growth profiles remaining mathematically valid;
- Origin offense/defense/counter-response/FFY/start-state/structure/naval/settlement/Tank hooks staying inside deliberate engine-safe domains;
- representative Origin + Echo compositions preserving canonical invariants;
- no hidden combination exclusion table being necessary for any deployed catalogue;
- Echo mechanical identity registry cardinality exactly `93 + C(93,2) + 93×92 = 12,927`, with dual identity order-insensitivity, mixed polarity distinction, and same-key mixed pairs rejected;
- deterministic Echo identity derivation/materialization from the versioned concrete-key catalogue and shape rules, without requiring 12,927 hand-authored source constants;
- development/test environments being able to run against synthetic/sample Echo naming configuration without any anime quote corpus;
- Echo acquisition shape selection using `50% mixed / 35% dual / 15% single` independently of raw per-shape identity cardinality;
- uniform identity selection within each selected shape, including statistical/property tests that no stat-family/scope/owned-state weighting leaks into V1;
- Echo magnitude rolls using whole integer percentages and the published dual-positive ceilings;
- EchoScore calculation from signed normalized `x/M` contributions and exact weighting against every legal magnitude configuration for an identity;
- positive magnitude-weight anchors following `10^(-2S)` and negative anchors using logarithmic weight interpolation;
- aggregate deterministic enumeration reproducing the expected current natural Lucky+ rate of approximately 2.50% within an appropriate exact/tolerance test derived from the current registry;
- exact rolled-quality tier boundaries: Trash / Questionable / Decent / Not Bad / Lucky / Cheater;
- repeated acquisition of one Echo identity rerolling magnitudes while preserving mechanical identity and stable character/stat naming components under the bound naming version;
- deterministic generated-name character token selection from the correct shape-specific pool;
- concrete-stat token mapping/override stability under a naming version and avoidance of schema-prefix-dependent identity changes;
- magnitude descriptors changing deterministically with the acquired/retained roll;
- descriptor lookup following beneficial/harmful polarity rather than naive arithmetic sign, including beneficial negative-percentage cost/cooldown/time cases;
- deterministic dual-positive stat-token display order;
- exact mixed-name grammar using the accepted `with a side of` connector and positive component first;
- naming-version binding reproducing historical wording where required;
- Questionable versus Cheater presentation changing only quality treatment, not mechanical identity/stable naming components, with no mechanically required information hidden behind hover;
- one retained roll per account+identity, exact Middle Fingers salvage `1/2/3/4/6/8` by newly acquired tier regardless of source/retention, and correct Pareto auto-upgrade/auto-reject/player-choice semantics including harmful-axis direction;
- batch duplicate grouping/Pareto-frontier reduction showing no dominated candidates and preserving Middle Fingers count;
- pending settlement persistence through disconnect/reconnect, deterministic default selection, atomic acceptance, and blocking of another reward-bearing match/Gacha pull until resolution;
- match reward pool starting at zero, +1 qualifying-opponent accounting independent of kill credit, configured per-special-AI preset bonuses where defined, and +5 victory;
- solo reward accumulation stopping after solo elimination, while defeat preserves already-earned rolls;
- fixed-human-team reward entity persistence through one human's early elimination, full final pool to every human teammate, and no reward division;
- every earned reward roll producing an actual Echo acquisition rather than a keep-best filter;
- Gacha Store exact 10-Middle-Finger single / 100-Middle-Finger ten-pull pricing with no hidden discount/bonus and sequential single/batch equivalence;
- one shared paid-pull pity counter across singles and ten-pulls;
- match reward acquisitions neither advancing nor resetting Gacha pity;
- Lucky+ qualification exactly `EchoScore >= 1.00`, with any natural/rescued paid Lucky/Cheater resetting pity;
- power-12 soft-pity calculation `r(n)=(n/49)^12` and effective Lucky+ probability composition against the current natural `P0`;
- hard pity guaranteeing the 50th consecutive paid pull after 49 non-Lucky+ misses;
- rescue/guarantee selecting only from the ordinary acquisition distribution conditioned on Lucky+ rather than statistical unusualness;
- no Cheater guarantee or progressive Cheater pity;
- Echo Sets referencing identity IDs so retained-roll replacement propagates automatically;
- Echo collection generated-name/character/stat-token search, mechanical filter/favorite behavior, and tier/card rendering semantics at the browser/UI test layer;
- explicit absence of Echo dialogue-assignment/MAL/source-import dependencies from V1 persistence and deployment;
- Strategic Spawn Phase-1 projection including all participants' public Origins, Initial Territory values, Starting Population effects, effective spawn profiles, and relevant spawn modifiers;
- Strategic Spawn Phase-1 simultaneous choice/reveal for ordinary one-area and split two-area profiles;
- split-origin half-area geometry (`50% area`, not `50% radius`) and deterministic public representation;
- Phase-2 single reconsideration round with no live reaction to Phase-2 submissions, including pair-wise split-origin revision;
- Phase-3 simultaneous exact-origin resolution, including two submitted origins for split-origin factions;
- split-origin starts using one unchanged global Starting Population pool rather than local pools;
- split-origin final Initial Territory modifiers applied once to the faction total before approximately equal footprint division;
- deterministic primary/secondary origin semantics for singular granted start-state structures/effects;
- overlapping broad influence areas without territorial reservation;
- deterministic spawn-hook fallback behavior for each spawn profile;
- Random and Fixed spawn modes;
- Initial Territory Origin/ruleset modifiers changing starting ownership rather than Capacity-per-cell;
- simultaneous compact footprint generation and full-quota preservation where topology permits;
- spawn collision/tie resolution independent of controller execution order;
- whole-integer controller-visible Population accounting;
- canonical terrain identities and terrain-property serialization/hash stability;
- Plains/Highland/Mountain/Desert/Forest/Tundra/Marsh/Shallow/Deep/Impassable acquisition/traversal/effect values matching the registry;
- Tundra and Shallow Water contributing zero Capacity while remaining conquerable;
- Tundra/Shallow neutral acquisition taking progress/time but zero baseline Population settlement cost;
- Fallout preserving underlying terrain identity and applying the versioned acquisition multiplier;
- baseline neutral population-bearing settlement taking nonzero progress/time and exactly 1 Population per successfully captured cell;
- `0.5 Population/cell` settlement modifier using deterministic faction-level residuals;
- repeated create/end expansion operations being unable to erase fractional settlement debt;
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
- hostile capture-coupled casualties distinct from neutral settlement costs;
- elastic-defense trait preserving defender while attacker still loses 1 Population and ownership/Capacity transfer normally;
- defended non-population-bearing conquerable cells still using ordinary capture casualties while transferring zero Capacity;
- third-party same-cell claimant casualty-free behavior;
- universal persistent-structure level bounds exactly 1–5 across **all eight structures**;
- build-at-L1 default and rejection of L6/unbounded inherited upgrades;
- fixed structure type+target-level price tables and removal of the shared Port/Factory inherited price counter;
- upgrades taking the same authored duration as the structure's L1 build and retaining previous completed-level effect until completion;
- City level scaling Growth only;
- Fort exact provisional coverage/defensive-pressure progression without creating Population;
- Factory level scaling configured industrial/train FFY event value and Tank repair capacity;
- Port level scaling passive repair radius/rate;
- Observation Post exact radius progression and visibility-projection behavior;
- Command Post `10s` telegraphed build/upgrade, `3/6/9/12/15%` source-offense progression, and `30/35/40/45/50` coverage;
- normal SAM level scaling range/charges using `70/80/90/100/105` and 9s recharge;
- giant-SAM trait enforcing exactly one charge, larger range, and longer cooldown without a new controller interception action;
- Missile Silo L1/L3/L5 Atom/Hydrogen/MIRV gates and level-scaled charge capacity;
- free starting Silo remaining L1 unless explicitly changed;
- free/granted MIRV failing legality without an L5-equivalent launcher;
- Warship-as-Silo effective level equal to rank, including rank-3 Hydrogen and rank-5 MIRV boundary cases;
- baseline Warship purchase requiring **5s construction** before activation, including under purchase-resource transformations;
- baseline Tank purchase requiring **5s construction** and Heavy Artillery **10s**;
- Tank progressive active-count purchase-cost curve and destroyed-unit count release;
- Tank terrain movement table, especially Mountain/Shallow-Water hard barriers and neutral-territory corridor prohibition;
- Tank anti-armor, Train-interception, Population-attack, autonomous targeting and Factory-repair behavior;
- one prepared Heavy Artillery beating one Tank but losing the intended 1v2 / 2v3 benchmark through actual alpha/reload/movement rather than hidden matchup modifiers;
- P43 removing Train raiding, retaining Tank barriers, and allowing projectiles across barriers;
- P44 triggering only on successful Population attacks;
- P44 deterministic radius-2/up-to-10 and radius-5/up-to-50 eligible-cell neutralization/Fallout footprints;
- P43+P44 combining into radioactive Heavy Artillery without a compatibility exception;
- MIRV translated power being meaningfully below inherited baseline while remaining strategically severe;
- baseline Transport embarkation cost 0 and additive cost stacking (`+250 + +500 = 750`);
- fortified landing granting exactly one permanent L1 Fort only on successful landing and not consuming purchase-only entitlements;
- direct-L5 City purchase costing 95% cumulative ordinary L1→L5 cost and remaining one purchase transaction for upgrade-spend interactions;
- captured lower-level City behavior under the direct-L5 purchase trait;
- normal neutral Fallout reconquest and Fallout capture resistance;
- optional water-nuke Deep-Water conversion and victory-denominator updates;
- capitulation removal of mobile units/projectiles including Tanks/Heavy Artillery, with transport Population return;
- participant projection/deltas;
- accelerated/headless runs;
- long-match memory/GC under the additional persistent Tank/visibility/structure state.

### 23.3 Origin-catalogue deployment gate

Origin combination safety is resolved **before production deployment**, not by runtime compatibility rules.

For each candidate Origin trait catalogue/version:

1. enumerate every trait subset that is legal under the candidate public point budget, maximum trait count, and maximum drawback refund;
2. construct the effective Origin rule configuration for every such combination;
3. run the deterministic structural/mathematical invariant suite over every combination, including settlement residuals, Transport cost composition, structure transformations, launcher equivalence, spawn profiles, Tank/Heavy-Artillery transformation, Radioactive Munitions, and grant/purchase interaction semantics;
4. verify all Official Origins are ordinary members of that same legal set;
5. fail the candidate catalogue deployment if any legal combination fails.

A failure means the candidate catalogue/public budget is revised—e.g. redesign, reprice, or remove a trait—and the exhaustive suite is rerun. Do **not** respond by adding a production-only incompatibility exception.

Property/fuzz testing and representative Origin+Echo scenario testing may supplement this gate but do not replace exhaustive enumeration of legal Origin combinations.

### Key performance invariant

Simulation work must scale primarily with **active strategic work and engaged frontier geometry**, not full `factions × cells` products.

No persistent defensive occupancy, dense Population matrices, land Deployment queues, or arbitrary user callbacks inside the 10 Hz map-resolution loop should exist.

Faction-level fractional settlement residuals are scalar state, structure levels are bounded 1–5, Tank/Heavy-Artillery objects are sparse mobile units, and spawn footprint generation/Origin catalogue validation are bounded pre-match/deployment operations; none justify persistent dense per-tick spatial Population state.

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
3. OPEN FUFU FACTION / POPULATION / GROWTH + TYPED ORIGIN/ECHO RULE HOOKS
   (including fractional settlement residuals and structure/spawn/unit rule profiles)
       ↓
4. SEGMENTS + EXPANDED TERRAIN + CONTACT / OBSERVATION MODEL
   (including Observation Post visibility semantics)
       ↓
5. OFFENSIVE OPERATIONS + ENGAGED FRONTAGE + BINARY AUTOMATIC DEFENSE
   + NEUTRAL SETTLEMENT ACCOUNTING
       ↓
6. CONTROLLER API CONTRACT IMPLEMENTATION
   (queries/selectors/directives/defense/counters/events/debug/team/spawn/unit hooks)
       ↓
7. ISOLATED-VM CONTROLLER WORKER POOL + CERTIFICATION
       ↓
8. ORIGIN CATALOGUE / CREATOR + EXHAUSTIVE DEPLOYMENT GATE
   + ECHO 12,927-IDENTITY REGISTRY / ECHOSCORE-WEIGHTED ACQUISITION RULES
       ↓
9. STRATEGIC / RANDOM / FIXED SPAWN RESOLVER + INITIAL TERRITORY FOOTPRINTS
   (including accepted split-origin spawn profile)
       ↓
10. EIGHT-STRUCTURE + NAVAL / RAIL / WEAPON / ARMOR TRANSLATION
    (Fort, Port repair, Factory FFY/Tank production+repair, Observation/Command Posts,
     SAM, Silo gates, MIRV rebalance, 5s Warships, Tanks, P43/P44, amphibious Fort grants)
       ↓
11. OFFICIAL PVE AI PRESETS + MATCH LIFECYCLE + REPLAY / PARTICIPANT PROTOCOL
    + REWARD-ENTITY / ECHO ROLL-POOL SETTLEMENT
       ↓
12. SQLITE / DISCORD AUTH / ECHO OWNED-ROLL+ECHO-SET
    + MIDDLE-FINGERS+PAID-PITY+PENDING-SETTLEMENT STATE / FOOF API
       ↓
13. ECHO GENERATED-NAMING CONFIG + GENERATOR
    (shape character pools, stat-token dictionary, polarity-aware descriptors, grammar/versioning)
       ↓
14. BROWSER EDITOR / DEBUG / ORIGIN CREATOR / ECHOES COLLECTION + ECHO SETS
    / CARD PRESENTATION / DUPLICATE SETTLEMENT / GACHA STORE / FINAL LOBBY UX
```

There is no V1 private Echo quote/MAL content-import stage. Authored anime dialogue/reference work belongs to the smaller Origin-trait / Official-Origin content pass and can proceed independently of Echo implementation.

Some workstreams may overlap. Typed rule hooks should exist before Origin traits depend on them. The terrain/structure/unit/weapon and spawn rule schemas must be able to express the accepted catalogue mechanics before the exhaustive Origin deployment gate can be meaningful. Downstream systems must not force premature retuning onto otherwise settled mechanic shapes.

---

## 27. OpenFront audit coverage cross-check — Accepted

This table is a traceability check against the source-level OpenFront compatibility audit. It exists so later edits do not accidentally drop an inherited subsystem from the migration record.

| Original audit area | Canonical integration coverage |
| --- | --- |
| 1. Repository / architectural map | §§1–3, 23–25 |
| 2. Simulation authority / client-server model | §4 |
| 3. Tick loop / intents / Executions / deterministic transitions | §§3, 6, 19 |
| 4. Map / cells / coordinates / terrain / topology | §§6A, 7, 23.1 |
| 5. Ownership / neutral expansion | §§6A, 8, 9.3, 11.7 |
| 6. Troops / gold / resources / player state | §§9, 12, 19A, 21 |
| 7. Land combat / casualties / territorial capture | §§6A, 11, 14 |
| 8. Spatial Population / Redeployment | §§9–11; superseded dense model explicitly rejected |
| 9. Structures / spatial modifiers | §§6A, 13, 21 |
| 10. Generic unit / mobile-object framework | §§6A, 14 |
| 11. Naval / amphibious / trade / rail | §§6A, 14, 19A |
| 12. Strategic weapons / interception | §§6A, 13.4, 14, 15 |
| 13. Teams / alliances / diplomacy / `atWar` | §§6A, 16, 19A |
| 14. Visibility / fog of war | §§6A, 13.5, 17 |
| 15. Bots / official PvE AI / player-controller boundary | §§5, 6A, 16A, 17 |
| 16. Match lifecycle / lobby / spawn / defeat / resignation / victory | §§4, 6A.15–17, 16, 18 |
| 17. Replay / serialization / determinism / observability | §§3, 6, 6A, 19, 21, 23 |
| 18. Browser rendering / interaction assumptions | §§17–18 |
| 19. Persistence / identity / authentication / Foof boundary | §§20–21 |
| 20. Build / deployment / tests / performance / licensing | §§22–25 |

If a future audit finding does not map to this plan, update this same document rather than creating a third Open Fufu migration source.

---

## 28. Remaining open integration/design questions

After the authority, Population/frontage, combat, capitulation, controller-contract, strategic-spawn, Origin/Echo, expanded-terrain, eight-structure, Tank/Heavy-Artillery, neutral-settlement, amphibious-Fort, SAM-shield, strategic-weapon-gating, Official-AI roster/Origin-pool, and Echo identity/reward/Gacha/generated-naming decisions, the legitimately open questions are now narrower:

1. **Exact final TypeScript names/types and ergonomic naming** after prototype pressure-testing of the accepted controller-contract shape, including pre-match spawn lifecycle hooks capable of expressing one- and two-origin public spawn profiles and public Origin/effective-modifier views.
2. **Origin creator tuning/content** — final player-facing trait names/IDs, anime dialogue/catchphrase/reference presentation where desired, further deployed trait content/costs, and future Official Origin revisions/additions. The current builder/catalogue values live in the Origin catalogue and remain playtest-repriceable without reopening accepted mechanics.
3. **Echo generated-name content authoring** — choose the exact shape-specific character pools and deliberately authored concrete-key stat-token dictionary. The naming grammar, polarity semantics, descriptor vocabulary, stable-vs-roll-dependent split, and no-awkward-scope-prefix direction are settled.
4. **Echo visual/UI implementation** — implement the exact visual recipe renderer, card motion, responsive/touch behavior, and effects consistent with stable character/stat naming components, roll-dependent magnitude adjectives, and the dull Questionable → extravagant Cheater quality treatment.
5. **Echo validation and later playtest tuning** — implement executable/property coverage for deterministic registry materialization, generated-name stability/versioning, uniform identity distribution, EchoScore-weighted magnitude sampling, quality tiers, exact Middle Fingers accounting, reward accounting, Pareto/pending settlement, Origin/Echo composition, Echo Set propagation, and paid-pull pity. The current V1 values (`50/35/15`, current score weights/tiers, `1/2/3/4/6/8` Middle Fingers salvage, `10/100` Middle Fingers Gacha, and 50-pull power-12 Lucky+ pity) are the implementation baseline; future playtest retuning remains possible without reopening the architecture.
6. **Exact special-AI Echo reward bonuses, when the provisional character controllers receive actual competence targets/difficulty ratings.** The character roster, allowed shared Origin pools, post-human-lock Origin roll/reveal timing, per-preset bonus hook, and ordinary +1/+5/team reward semantics are settled.
7. **Real Fufubox performance capacity** after a representative authoritative simulation exists.
8. **`isolated-vm` production benchmark/hardening details** — concrete time/memory/output/query limits, worker-pool size, lifecycle/recycling policy, and whether later QuickJS testing is worthwhile.
9. **Exact SQLite schema/index/backup/retention details**, including the concrete mechanical-identity/naming-version/owned-roll/Echo-Set/acquisition-event/Middle-Fingers/paid-pity/pending-settlement representation and any separate lightweight Origin reference-content authoring format.
10. **Exact Discord session/cookie/expiry/CSRF implementation** and optional later Fufubox credential linking.
11. **Playtest retuning of accepted provisional terrain/structure/mobile-unit numerical values** — the tables in `TERRAIN_AND_STRUCTURES.md` are the implementation baseline, not unanswered design placeholders; simulation/playtesting may revise costs, radii, pressure, FFY scaling, movement, damage, reload, repair, build times, and P44 footprint magnitudes while preserving the accepted identities.
12. **Exact MIRV power retuning** within the settled requirement that MIRV needs an L5-equivalent launcher and is moderately weaker than inherited behavior.
13. **Detailed lobby/UI/UX implementation polish**, including final Origin creator/preset presentation, expanded terrain/structure/unit displays, split-origin spawn visualization, and responsive execution of the already-settled Echoes collection, generated names, reward-card/Pareto-settlement, quality effects, Echo Sets, and Gacha/pity concepts.
14. **Replacement asset creation and final proprietary-directory removal.**
15. **Normal gameplay tuning not already given a provisional registry value** — capture-progress formula coefficients around the accepted terrain multipliers, neutral settlement progress coefficients, counter-response casualty/rate coefficients, growth reference values/interpolation, broad FFY-source mapping/naming and event payouts (especially the stronger intended Factory baseline), Segment scale, weapon radii/effects, water-nuke conversion geometry, ordinary Strategic-Spawn influence radius/shape, base Initial Territory/Starting Population, and related balance constants.
16. **Exact deterministic controller limits/diagnostic retention values** — materialized-cell/query budgets, policy-rule counts, log/debug-overlay budgets, command/directive caps, and replay retention. The existence and public visibility of these limits are settled; only values are open.
17. **Exact deterministic spawn-resolution implementation details** — exact-origin collision fallback, compact-footprint growth/tie-breaking details, and map-legality safeguards that ensure Initial Territory quotas whenever topology permits. The three-phase protocol, information timing, overlapping non-exclusive influence areas, accepted two-half-area split-origin profile, and Initial Territory semantics themselves are settled.
18. **Port trade-frequency level interaction** — whether inherited Port-level trade-spawn scaling remains in addition to the settled repair-range/repair-rate level identity.

The public API philosophy, observation/directive split, geographic QoL layer, persistent-directive semantics, defense/counter surfaces, pure mechanics calculators, events/receipts, deterministic randomness, team signals/shared legal observation, public mechanical modifiers, multi-file authoring, private debug overlays, three-phase Strategic Spawn, split-origin spawn profile, neutral-settlement Population cost/residual semantics, expanded terrain library and Fallout overlay, eight-structure model, accepted per-level structure baseline, Observation/Command Posts, Silo weapon gates, MIRV access/power direction, additive Transport costs, fortified amphibious Fort grants, 5-second Warship construction, Factory-produced Tank baseline, P43 Heavy-Artillery transformation, P44 Radioactive-Munitions transformation, Warship launcher-equivalence semantics, giant-SAM transformation, fully-developed-City purchase transformation, Origin system philosophy, exhaustive pre-deployment Origin combination guarantee, provisional character-based Official-AI roster/shared Origin pools, and the **12,927 fixed mechanical Echo identities + deterministic runtime materialization + uniform within-shape selection + rerolled EchoScore-weighted integer magnitudes + deterministic generated names with stable shape-character/stat components and Catastrophic→Absurd polarity-aware descriptors + `with a side of` mixed grammar + no V1 authored Echo dialogue/MAL import pipeline + Trash→Cheater quality tiers + Middle Fingers tier-based duplicate salvage + Pareto/pending-settlement progression + accumulated all-drop reward pool + fixed-human-team reward entity + searchable Echoes collection/Echo Sets + 10/100-Middle-Finger Gacha Store + paid-pull-only 50-pull power-12 Lucky+ pity with no Cheater guarantee** are now settled V1 design direction.

These remaining questions should be resolved by updating these same canonical documents rather than creating additional migration-plan documents.