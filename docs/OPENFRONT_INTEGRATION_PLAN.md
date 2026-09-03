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

> Keep OpenFront's dense cell/map engine, deterministic Execution machinery, pathfinding, generic units/structures, substantial naval/rail/strategic-weapon infrastructure, renderer foundations, useful lobby/network infrastructure, and test/performance tooling. Replace client authority, old combat/resource semantics, mutable diplomacy, and inherited progression assumptions. Adapt the existing scalar troop/attack shape into Open Fufu's global Population plus sparse operation/frontage model rather than building a dense faction-by-cell Population field. Build a deliberately smaller public controller observation/directive API rather than exposing inherited mutable `Game`/`Player`/`Unit` internals. Replace/extend the inherited spawn phase with Open Fufu's deterministic three-phase strategic spawn protocol, public spawn-profile transformations, and Initial Territory footprint generation. Extend the inherited terrain substrate with the accepted Open Fufu terrain library and Fallout overlay semantics. Adapt inherited structure/upgrading infrastructure into Open Fufu's deliberate eight-structure level-1-through-level-5 system, public Fort concept, Observation/Command Posts, launcher tier gates, and explicit naval/structure effects. Add the Factory-produced Tank as the sole baseline persistent land military unit and implement Heavy Artillery/Radioactive Munitions as typed Origin transformations of that same unit. Add Open Fufu's versioned **Origin** faction-identity system and the **Echo** system as 12,927 fixed mechanical collectible identities with rerolled EchoScore-weighted acquisition magnitudes, deterministic generated names, duplicate Pareto progression, accumulated match rewards, saved Echo Sets, pending reward settlement, Middle Fingers duplicate/Gacha currency, and the 10/100-Middle-Finger Gacha Store with paid-pull-only 50-pull power-12 Lucky+ pity through explicit typed/versioned rules rather than hidden faction bonuses. Keep production account/progression records in runtime/private data while the small reusable Echo naming grammar/configuration may live as ordinary versioned game data. V1 Echoes require no anime quote/subtitle/MAL import pipeline.

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

Provide bounded deterministic QoL queries such as neighbors/adjacency, boundary extraction, connected components/flood fill, distance, generic land/naval/rail reachability/pathfinding, nearest/reachable queries, owner/terrain/Segment summaries, legal structure sites, and legal coast/transport destinations.

These are factual/mechanical services, not strategy. Do not add `weakestPoint`, `bestTarget`, `bestNukeTarget`, `optimalCounterSize`, `safestTradeRoute`, or equivalent strategic scoring.

Permit bounded batch/materialized cell access for advanced controllers without encouraging whole-map object allocation every decision.

### 6A.4 Segments and Contacts

Expose Segments as first-class strategic query objects with factual summaries/selectors and adjacency. Expose Territorial Contacts as factual boundary/contact geometry with components, size, involved Segments and terrain summaries.

Do not create an engine-level strategic `Front` object or score contacts for strategic value.

### 6A.5 Offensive and defensive policy surfaces

Land attack directives should distinguish **engagement priority** for selecting legal frontage and **pressure weighting** for distributing finite committed Population across engaged geometry.

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

Every participant gets the same public map/ruleset/spawn-legality view plus surfaced Origin/Initial Territory/Starting Population/effective spawn-profile information. Ordinary factions submit one area/origin. The accepted split-origin trait submits two half-area regions/origins, with half **area** rather than half radius. Phase-1 choices are simultaneous then revealed; Phase 2 is one simultaneous reconsideration round; Phase 3 simultaneously selects exact origin(s). Conflict resolution, fallbacks, and footprint generation are deterministic/versioned and independent of controller execution order.

Spawn-hook failure/missing output must use a deterministic legal fallback appropriate to the profile rather than faulting the controller for the match.

### 6A.16 Random and Fixed spawn modes — Accepted

Retain explicit alternatives:

- **Random Spawn:** match-seeded deterministic legal spawn selection that bypasses strategic controller choices;
- **Fixed Spawn:** exact configured starts for benchmarks, certification, debugging, scenarios/tournaments, and reproducible tests.

All exact final starts are revealed before the first normal match decision because ownership is globally visible once play begins.

### 6A.17 Initial Territory footprint — Accepted

Add a surfaced **Initial Territory** starting-state quantity representing the target number of population-bearing cells each faction should own at match start.

After exact origins resolve, deterministically grow compact connected roughly circular footprints outward from all origins simultaneously. Split-origin factions compute final Initial Territory once, divide the quota approximately equally between ordered origins, and retain one unchanged global Starting Population pool.

Influence-area overlap does not reserve territory; footprint collision/tie handling is deterministic; full quotas should be preserved where topology permits; final owned population-bearing cells create ordinary one-per-cell Capacity; Initial Territory and Starting Population remain separate quantities.

---

## 7. Map, cells, terrain, and Segments — Accepted

Retain/adapt the current dense integer `TileRef`/typed-array map substrate, compact terrain/state storage, deterministic adjacency, ownership mutation, water/pathfinding, authored map compilation/loading, impassables, and map-scale optimized iteration.

### 7.1 Segment layer

Add compact immutable Segment identity for every real map cell, including water and impassable terrain, plus immutable Segment metadata/adjacency. Segments remain query/strategy indexes rather than physical simulation buckets.

Dynamic terrain changes such as nuke-created Fallout/Deep Water do not regenerate Segment identity.

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

`Deep Water` replaces the inherited generic public `Ocean` role. Fallout is a persistent overlay/state on legal conquerable terrain.

Required distinctions include Tundra/Shallow Water as conquerable but non-population-bearing, Deep Water as naval-only/unconquerable, Mountain and Shallow Water as Tank/Heavy-Artillery barriers, and optional water nukes creating Deep Water.

Store accepted provisional terrain values as versioned ruleset data rather than scattering them through switch statements.

### 7.3 Future procedural maps

Procedural/random map generation is new and must deterministically produce the same canonical terrain identities plus immutable Segment model from seed/version.

---

## 8. Ownership and neutral expansion — Accepted

Retain/adapt low-level cell ownership and incremental territory/border bookkeeping. Existing `conquer()`/`relinquish()`-style primitives remain useful internally.

Initial Territory footprint assignment is a pre-match ownership initialization path, distinct from neutral expansion and combat conquest.

Neutral expansion becomes an operation using ordinary Population and spatial intent. Neutral cells have **no automatic Population defender**, but settlement retains explicit progress/time and Population expenditure.

Baseline:

```text
successfully acquired neutral population-bearing cell
→ expansion commitment loses 1 Population
→ ownership/Capacity transfer occurs
```

Conquerable non-population-bearing terrain still requires acquisition progress/time but zero baseline neutral-settlement Population cost.

Typed Origin/Echo/ruleset hooks may alter settlement progress/speed. Structural fractional settlement-cost rules use deterministic faction-level residual accounting that survives operation recreation.

Neutral Fallout follows underlying terrain classification and explicit capture resistance.

---

## 9. Population state — Accepted

### 9.1 Global whole-integer Population

Adapt OpenFront's useful scalar troop-storage shape into one global deterministic whole-integer Population value per faction.

Faction Population state centers on Total/Available/Committed offensive/Committed counter-response/Transport Population, Capacity, and Growth state.

No separate Reserve pool exists.

### 9.2 Capacity from owned cells

```text
Capacity = owned population-bearing cells
```

Remove/avoid City Capacity bonuses, Echo/Origin max-Population or Capacity-per-cell bonuses, terrain Capacity multipliers, and hidden faction Capacity multipliers. Cities move to growth effects.

A surfaced Initial Territory modifier changes starting ownership count, not Capacity-per-cell. Starting Population remains separately configured/modifiable.

### 9.3 Representation and fractional residuals

Authoritative Population uses non-negative whole-integer values; deterministic fixed-point/residual state exists only where explicit mechanics require sub-unit precision. Settlement residuals are faction-level persistent state and must participate in determinism/certification/replay where relevant.

---

## 10. No defensive occupancy field — Accepted

Do not implement persistent defensive Population on cells, Segments, Contacts, or fronts.

Available Population is one finite automatic defensive pool. Automatic assignment is ephemeral per tick and **binary per threatened owned cell**: zero or one Population, never more than one.

Simulation should iterate primarily over active strategic work/frontage rather than `factions × map cells`. No dense Population matrix should exist.

---

## 11. Offensive operations, frontage, automatic defense, and land combat — Accepted

Reuse the useful structural shape of OpenFront Attack plumbing but replace inherited combat semantics.

Operations hold committed Population, target, spatial intent, and active front geometry. Commitment changes are instantaneous on valid decisions.

One-to-one source→adjacent-target engagement lanes are resolved each tick. A source attacks at most one target; same-faction duplicate targets are removed; newly captured cells do not chain in the same tick; engaged frontage cannot exceed committed Population; operation pressure is distributed across engaged lanes according to weights.

Automatic passive defense uses distinct threatened target cells with `0/1` defender each and finite Available Population. Scarce slots are apportioned across incoming contacts/operations approximately by engaged-lane counts, then controller defense priorities select actual cells. Same-cell overlap never duplicates defenders. Terrain/Forts/Origins/Echoes change effectiveness, not defender Population count.

Counter-response Population directly fights one incoming operation through the accepted bounded nonlinear exchange formula, does not reinforce passive defense, and returns surviving Population to Available when ended.

Ordinary hostile defended-cell capture uses capture-coupled one-for-one casualties between the previous owner and winning claimant, subject to the explicit defender-survival Origin exception. Undefended hostile captures have no ordinary capture casualty. Neutral settlement remains separately costed. Multi-faction same-cell losers take no ordinary capture casualty merely for contesting.

Required acceptance conditions include no duplicated Population/pressure/defense, deterministic tie handling, no same-tick chain conquest, scale-free bounded counter-response math, and legal fractional settlement accounting.

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

Cities contribute to growth, **not Capacity**. Population-growth Origin traits/Echoes may contribute explicit growth modifiers, and Origin traits may replace the ordinary utilization profile through typed/versioned rule data.

City level 1–5 scales City Growth contribution. If Capacity is zero, growth is zero. Remove passive worker-gold coupling from Population entirely.

---

## 13. Structures — Accepted

Retain useful generic spatial structure lifecycle infrastructure: build legality, construction duration, under-construction state, ownership/capture, levels/upgrades, health/destruction where relevant, and type-specific behavior.

Canonical V1 public structures are City, Fort, Port, Factory, Missile Silo, SAM Launcher, Observation Post, and Command Post. All eight have legal levels 1–5 only, with fixed authored type+target-level costs and structure-specific build/upgrade durations from `TERRAIN_AND_STRUCTURES.md`.

Forts modify actual automatic defenders rather than creating Population. Direct-L5 City purchase, giant single-charge SAM, Observation Post, and Command Post transformations/semantics follow the canonical design/catalogue. Same-type overlapping spatial bonuses use the accepted strongest/boolean rules rather than additive stacking where specified.

---

## 14. Generic units, naval, amphibious, trade, rail, and armor — Accepted

Retain/adapt generic unit lifecycle internals without exposing inherited classes directly to controllers.

Transport payload maps to committed Population; baseline embarkation cost is 0 FFY and explicit Origin/ruleset embarkation modifiers add. The fortified-landing trait grants one permanent L1 Fort only after successful landing.

Trade Ships/Ports remain physical economic world events; Ports gain accepted repair progression. Rail retains physical/economic stops and pending cargo values. Tanks may intercept Trains for their snapshotted pending cargo value.

Warships retain compatible patrol/combat/piracy/repair/veterancy behavior, gain 5-second construction, and may receive typed launcher-equivalence where an Origin makes Warships count as Silos with effective Silo level `max(1, rank)`.

The Tank is the sole baseline persistent land military unit. It is Factory-produced in 5 seconds, health-bearing, terrain-restricted, strategically/autonomously controlled, can fight armor, raid Trains, and attack Population without capturing territory.

P43 transforms every Tank into the accepted 10-second, slower, longer-range, high-alpha Heavy Artillery profile with no Train raiding; P44 adds deterministic Population-attack Fallout neutralization footprints. They combine normally.

---

## 15. Strategic weapons and SAM — Accepted

Retain deterministic launch/trajectory/interception infrastructure while translating troop/diplomacy effects.

Missile Silo gates are L1 Atom / L3 Hydrogen / L5 MIRV. Free/granted weapons do not bypass launcher legality. MIRV is moderately weaker than inherited behavior while remaining severe. Standard nukes neutralize affected owned population-bearing land, apply one current-Population loss per such cell, transfer Capacity through ownership loss, and apply Fallout overlay. Optional water nukes convert qualifying terrain to Deep Water under their rules.

---

## 16. Teams, diplomacy, `atWar`, defeat, capitulation, and victory — Accepted

Retain fixed pre-match teams. Remove mutable alliance diplomacy. FFA opponents remain attackable regardless of `atWar`; `atWar` is recent-hostility state.

Zero owned population-bearing territory means immediate defeat after same-tick ownership resolution. Resigned/capitulated factions become passive territorial remnants: growth/controller active behavior stops, mobile units/projectiles are removed, static territory/structures remain, Available Population can still passively defend, and territory remains conquerable.

Reward settlement is separate from victory: defeat preserves accumulated Echo rolls; victory adds +5.

---

## 16A. Official PvE AI migration — Accepted

The existing OpenFront Nation-AI code is useful as behavioral reference/internal component inspiration, not as the target gameplay contract.

Official AI consumes the same legal gameplay observation/action contract as players and receives no resource, information, legality, or simulation cheats. It may execute trusted code operationally.

Official AI factions bind ordinary legal Origins/Echo loadouts. The provisional character-based V1 roster and allowed shared Origin pools are maintained in `OFFICIAL_AI_PRESETS.md`. Human controller/Origin/Echo Set choices lock before the match seed resolves each AI's allowed Origin; selected AI Origins are then public before Strategic Spawn.

Exact AI implementations are versioned creator-owned content. Difficulty belongs to controller competence, not lore power or the randomly selected Origin. Special-AI Echo reward bonuses are explicit progression data, not hidden simulation advantages, and remain assigned when the actual controller/difficulty target is defined.

---

## 17. Visibility and participant viewing — Accepted

The authoritative match process creates legal per-participant projections before information reaches gateway/browser/controller. Player controllers, official AI, and participant viewers use the same underlying projection rules; fixed teammates receive the legal union of team observation.

Observation Post coverage participates server-side. Public projection includes Origin/trait sheets plus strategically relevant mechanical modifier sheets. Derived APIs cannot leak hidden state.

Strategic Spawn has explicit phase-dependent visibility. There is no ordinary third-party live spectator mode. Internal dev/certification tools may use trusted omniscience.

---

## 18. Browser synchronization and rendering — Accepted

Keep OpenFront rendering/camera/map/unit visualization foundations heavily where useful. Remove authoritative browser simulation responsibility.

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

Live connection/reconnect uses authoritative legal snapshots plus incremental deltas; reconnect need not replay the whole turn history.

The Echo UI must implement the settled card/collection language: searchable/filterable/favoritable **Echoes** grid; Echo Sets referencing identity IDs; deterministic generated names; tier-family border colors with continuous EchoScore gradients; responsive hover/focus with touch-safe alternatives; dull Questionable presentation, restrained Lucky glow, and excessive Cheater effects.

Generated names are derived from stable identity-level character/stat tokens plus retained-roll magnitude descriptors. Mixed names use the accepted `with a side of` grammar. When a duplicate replacement changes magnitudes, the same identity may receive new adjective(s) while remaining recognizable through stable character/stat components. Exact mechanical modifiers remain visible and authoritative; name tokens are flavor, not a replacement for stat text.

Large acquisition batches group repeated identities, reduce to Pareto frontiers, persist unresolved settlements, and block further reward-bearing matches/Gacha until accepted. Gacha presentation reflects the settled 10/100 Middle Fingers pricing, sequential paid-only pity, power-12 curve, 50-pull Lucky+ hard guarantee, and no Cheater guarantee.

Renderer/UI also gains clear state for expanded terrain, Observation/Command Posts, Tanks/Heavy Artillery, Fallout/Deep/Shallow Water. Observer publishing is optional in headless runs.

---

## 19. Replay, records, and crash behavior — Accepted direction

Preserve deterministic archive/replay philosophy but make the server the source of canonical state/hashes.

Archive exact committed controller decisions/operation changes so ordinary replay does **not** need to re-execute historical untrusted controller code.

Record/bind the exact terrain/structure/unit ruleset version, Origin definition/version, Origin-trait catalogue identity where required, equipped Echo identity IDs plus exact retained magnitude configuration, Echo mechanical-identity catalogue version, Echo naming/presentation version where historical wording/presentation matters, acquisition/roll-rules version, and enough spawn inputs/resolution identity to reproduce the same outcome.

Replay/hash state includes deterministic residual/effective simulation state. Bounded controller debug history may be retained separately.

V1 authoritative match-process crash may abort the match with no progression reward while retaining a detailed crash record; crash-resume is not V1-required.

---

## 19A. FFY modifier translation — Accepted

FFY remains event-driven. Origin/Echo modifiers expose a small set of broad source families around overall, military/conquest, naval/trade, and industrial FFY rather than every individual event as a build stat.

Individual event identity remains internally precise. Factory level scales explicit Factory-driven industrial/train FFY value. Tank Train interception yields the intercepted pending cargo as a land-raiding FFY event. Transport embarkation cost has its own dedicated cost hook.

Identity-defining exceptions such as wartime-trade rules may exist as curated Origin traits. Do not create arbitrary player formulas or hidden incompatibilities.

---

## 20. Authentication and identity — Accepted V1 direction

Open Fufu owns an internal user identity independent of a single provider. V1 ordinary login uses Discord OAuth2 mapped into an internal OpenFufuUser/session. Match processes receive only game-facing identity/configuration data, never Discord tokens. Foof uses a scoped service/API credential rather than database access.

Exact cookie/session/CSRF/expiry and optional Fufubox credential linking remain implementation work.

---

## 21. Persistence — Accepted SQLite direction

Open Fufu owns its persistent state rather than depending on OpenFront's external account/archive backend.

Use **SQLite** as the V1 authoritative structured runtime store, with normal migrations, foreign keys, and WAL-style deployment where appropriate.

### 21.0 Public source versus private/runtime data

The public `open-fufu-io` repository defines the reusable game implementation and data contracts. For Echoes, it may also contain the small versioned generated-name configuration because this is ordinary reusable presentation/game data rather than a huge copyrighted content corpus.

Public source should contain things such as:

- semantic stat/type definitions and stable identifiers;
- schemas and migrations;
- deterministic Echo identity-generation/materialization logic;
- EchoScore, acquisition, Pareto/duplicate, reward, Gacha, pity, and validation algorithms;
- generated-name grammar and the accepted magnitude descriptor table;
- versioned shape-character pools and concrete-stat token mappings once authored;
- UI/rendering implementation;
- synthetic/sample fixtures.

The live installation consumes runtime/private records including active granular balance/rules configuration where data-driven, materialized Echo identities where useful, owned rolls, Echo Sets, Middle Fingers balances, pity state, pending settlements, account/progression records, and official-AI reward configuration.

**V1 does not require or store an Echo anime-dialogue corpus, Echo-to-line assignments, MAL source catalogue, or subtitle/quote import metadata.** Authored anime dialogue/reference content is instead a much smaller Origin-trait / Official-Origin content concern and can use whatever lightweight versioned authoring approach is appropriate when that content is produced.

Persistent concepts include:

- internal users/linked identities;
- sessions/auth metadata;
- controller drafts/source packages and immutable published versions/certification;
- ruleset/terrain/structure/mobile-unit data versions;
- Origin trait-catalogue versions;
- Official and Custom Origin definitions/versions;
- Echo mechanical-identity catalogue versions and acquisition/roll-rules versions;
- the 12,927 fixed mechanical Echo identity definitions or deterministic representation/materialization;
- **Echo naming versions/configuration**: shape-character pools, concrete-key stat tokens, magnitude descriptor table, grammar/order rules;
- owned Echo rolls: account + Echo identity + retained magnitude(s), one retained configuration per identity, favorite state as appropriate;
- named Echo Sets referencing identity IDs rather than historical magnitude instances;
- Middle Fingers balance;
- paid-pull pity state;
- pending reward/Gacha settlement state;
- auditable acquisition/reward events where useful;
- official AI versions and configured special-AI Echo reward bonuses;
- matches/results, per-faction bound Origin and exact equipped Echo identity+magnitude set, reward-pool records, spawn resolution/replay metadata, progression/rewards.

Generated Echo display-name strings generally need **not** be persisted because they can be reproduced from identity + retained magnitude(s) + naming version.

Large replay/log/debug artifacts may remain compressed files referenced by SQLite. Exact schema/index/backup/retention details remain implementation work.

### 21.1 Origin definitions and production validation

Origins are declarative/versioned data, not executable player code.

Production validates known trait IDs/catalogue version, point budget, maximum trait count, maximum drawback refund, and structural well-formedness. It must not maintain hidden pairwise incompatibility rules.

Every combination satisfying public rules is valid; a broken legal combination means the catalogue must be repaired before deployment. Official Origins obey exactly the same public builder constraints.

### 21.2 Accepted catalogue mechanics now requiring typed rule data

The schema must represent the accepted neutral-settlement efficiency, fortified landing, defender survival, split strategic origin, giant-SAM, direct-L5 City, P43 Heavy Artillery, and P44 Radioactive Munitions mechanics described in the canonical Origin catalogue/design.

### 21.3 Echo identity, ownership, generated naming, rewards, collection, and Gacha Store migration

The collectible system formerly referred to as **items** is canonically **Echoes**. Implement [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md), not the retired magnitude-specific or dialogue-assignment catalogue model.

The persistent mechanical registry contains exactly **12,927 fixed identities** derived from 93 concrete stat+scope keys and three shapes. Identity fixes identity ID, shape, concrete key(s), and polarity. Production rows should be deterministically derivable/materializable rather than 12,927 hand-authored constants. Magnitudes are acquisition-instance data and reroll whenever the identity is acquired.

Implement generated naming as a deterministic versioned presentation function over identity + retained/acquired magnitudes:

```text
stable character possessive from the identity's shape-specific pool
+ stable concrete-key stat token(s)
+ magnitude adjective(s) from the retained roll
```

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

Descriptor sign follows **beneficial/harmful polarity**, not raw arithmetic sign. A beneficial cost/cooldown reduction uses a positive descriptor despite the displayed percentage being negative.

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

Dual stat order must be deterministic. Avoid automatically composing awkward scope labels such as `Naval Guitar Solo`; player-facing stat tokens should be deliberately authored per concrete key/override where needed. Design examples such as `Guitar Solo` are not binding assignments until present in the naming config.

V1 Echoes have **no anime dialogue-line/voice-line assignments** and require no MAL/quote/subtitle harvesting pipeline.

Ordinary acquisition follows `50% mixed / 35% dual / 15% single`, uniform identity choice within shape, EchoScore-weighted legal integer magnitudes, then Trash/Questionable/Decent/Not Bad/Lucky/Cheater quality derivation.

Persist at most one retained roll per account+identity. Reacquisition always rerolls magnitudes; duplicates grant tier-based Middle Fingers and use Pareto dominance/player choice. A retained-roll replacement automatically changes any magnitude adjective(s) in the generated display name and propagates through every Echo Set referencing that identity.

Match reward pool semantics, fixed-human-team reward entities, Middle Fingers salvage, Gacha 10/100 pricing, paid-pull-only power-12 Lucky+ pity, 50-pull hard guarantee, no Cheater pity, pending settlement, and Echo Sets all follow the settled Echo contract.

The browser collection surface is **Echoes**, not Inventory. Implement generated-name/character/stat-token search where useful in addition to mechanical filtering, favorites, quality sorting, and no unknown silhouettes.

Do not preserve stale `items` naming or stale dialogue-assignment persistence merely because inherited/provisional code once expected it.

---

## 22. Deployment and maintenance — Accepted simple model

Open Fufu does **not** require zero-downtime old/new-build draining for V1. Planned deployments may use ordinary maintenance windows. Historical replay/version identity remains necessary.

A candidate Origin trait catalogue may deploy only after its exhaustive legal-combination test gate succeeds.

---

## 23. Build, tests, benchmarks, and performance tooling — Accepted direction

Retain useful TypeScript/build/test infrastructure where compatible. Remove tests asserting intentionally removed OpenFront behavior and replace them with Open Fufu invariants.

### 23.1 Authoritative map packaging

The authoritative match runtime must deterministically access exact map/Segment/terrain/structure/mobile-unit/Origin/Echo/ruleset resources. Live, headless, certification, replay, and spawn resolution must load the same rule-bearing data.

### 23.2 Required performance/logic coverage

Coverage should include authoritative process/controller overhead; visibility/query determinism; controller transaction/directive/event/random/debug/team rules; public Origin/Echo modifier projection; exhaustive Origin legal-combination validation; all major Population/frontage/terrain/structure/unit/weapon/spawn semantics already enumerated by the canonical design; and the complete Echo system.

Echo-specific tests must include:

- exact identity cardinality `93 + C(93,2) + 93×92 = 12,927`;
- deterministic identity derivation/materialization;
- `50/35/15` shape selection and uniform within-shape selection;
- integer magnitude ceilings and EchoScore weighting/anchors;
- natural Lucky+ validation near the current ~2.50% result;
- exact quality boundaries;
- repeated acquisition preserving identity while rerolling magnitudes;
- **generated naming stability**: character token/stat token(s) stable for an identity under a naming version;
- magnitude adjectives changing deterministically with rolled/retained magnitudes;
- descriptor lookup using beneficial/harmful polarity rather than naive arithmetic sign, including beneficial negative-percent cost/cooldown cases;
- deterministic dual stat-token presentation order;
- mixed grammar using exactly the accepted `with a side of` connector;
- no requirement for Echo dialogue-line/MAL/source assignment records;
- naming vocabulary/config version binding and deterministic replay wording where required;
- Questionable/Cheater quality presentation changing visuals without changing mechanical identity;
- one retained roll, exact Middle Fingers salvage, Pareto semantics, batch frontier reduction, pending settlement;
- all reward-pool/team semantics;
- 10/100 Gacha pricing, sequential paid-only pity, power-12 rescue, 50-pull hard guarantee, no Cheater guarantee;
- Echo Set identity references and retained-roll propagation;
- collection search/filter/favorite/rendering semantics.

The remaining canonical simulation tests include Strategic Spawn visibility/reveal/collision/footprint rules, whole-integer Population/residual settlement accounting, terrain and Fallout semantics, binary defense/frontage/counter-response/capture rules, eight-structure level/cost/build semantics, SAM/Silo/Warship/Tank/P43/P44 rules, Transport/Fort interactions, nuke/water-nuke rules, capitulation cleanup, participant projection, accelerated/headless operation, and long-match memory/GC.

### 23.3 Origin-catalogue deployment gate

For each candidate Origin catalogue/version, enumerate every public-legal trait subset, construct its effective rule configuration, run deterministic structural/mathematical invariants, verify all Official Origins are ordinary legal members, and fail deployment if any legal combination fails. Do not add runtime incompatibility exceptions as a fix.

### Key performance invariant

Simulation work scales primarily with **active strategic work and engaged frontier geometry**, not full `factions × cells` products. No persistent defensive occupancy, dense Population matrices, land Deployment queues, or arbitrary user callbacks inside the 10 Hz map loop.

---

## 24. Proprietary assets — Accepted removal plan, do not delete yet

The inherited `proprietary/` directory is not a safe long-term dependency and should eventually be removed/replaced only after references/replacements are ready. Current proprietary content is branding/font/music rather than core gameplay maps/units; preserve appropriate licensing/provenance review for other assets.

---

## 25. Licensing — Accepted constraint

OpenFront code is AGPL-3.0 and applicable source/attribution obligations must be preserved. Non-proprietary map/resource assets have their own provenance/licenses and require continued attribution review. Do not conflate code licensing with inherited proprietary asset permission.

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
       ↓
5. OFFENSIVE OPERATIONS + ENGAGED FRONTAGE + BINARY AUTOMATIC DEFENSE
   + NEUTRAL SETTLEMENT ACCOUNTING
       ↓
6. CONTROLLER API CONTRACT IMPLEMENTATION
       ↓
7. ISOLATED-VM CONTROLLER WORKER POOL + CERTIFICATION
       ↓
8. ORIGIN CATALOGUE / CREATOR + EXHAUSTIVE DEPLOYMENT GATE
   + ECHO 12,927-IDENTITY REGISTRY / ECHOSCORE-WEIGHTED ACQUISITION RULES
       ↓
9. STRATEGIC / RANDOM / FIXED SPAWN RESOLVER + INITIAL TERRITORY FOOTPRINTS
       ↓
10. EIGHT-STRUCTURE + NAVAL / RAIL / WEAPON / ARMOR TRANSLATION
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

---

## 27. OpenFront audit coverage cross-check — Accepted

| Original audit area | Canonical integration coverage |
| --- | --- |
| Repository / architectural map | §§1–3, 23–25 |
| Simulation authority / client-server model | §4 |
| Tick / intents / Executions | §§3, 6, 19 |
| Map / cells / terrain / topology | §§6A, 7, 23.1 |
| Ownership / neutral expansion | §§6A, 8, 9, 11 |
| Resources / player state | §§9, 12, 19A, 21 |
| Land combat | §§6A, 11, 14 |
| Spatial Population / Redeployment | §§9–11; dense model rejected |
| Structures / spatial modifiers | §§6A, 13, 21 |
| Generic/mobile units | §§6A, 14 |
| Naval / amphibious / trade / rail | §§6A, 14, 19A |
| Strategic weapons / interception | §§6A, 13, 14, 15 |
| Teams / diplomacy | §§6A, 16, 19A |
| Visibility | §§6A, 13, 17 |
| Official PvE AI / controller boundary | §§5, 6A, 16A, 17 |
| Match lifecycle / spawn / victory | §§4, 6A, 16, 18 |
| Replay / determinism / observability | §§3, 6, 6A, 19, 21, 23 |
| Browser rendering | §§17–18 |
| Persistence / identity / auth / Foof | §§20–21 |
| Build / deployment / tests / licensing | §§22–25 |

If a future audit finding does not map to this plan, update this same document rather than creating a competing migration source.

---

## 28. Remaining open integration/design questions

After the settled authority, Population/frontage/combat, controller contract, strategic spawn, Origin/Echo, terrain, structure, Tank/Heavy-Artillery, AI-roster, and Echo generated-naming decisions, the legitimately open questions are narrower:

1. **Exact final TypeScript names/types and ergonomics** after prototype pressure-testing.
2. **Origin creator tuning/content** — final player-facing trait naming/reference content, further catalogue/cost tuning, and future Official Origin revisions/additions.
3. **Echo generated-name content authoring** — choose the exact shape-specific character pools and deliberately authored concrete-key stat-token dictionary. The naming grammar, polarity semantics, descriptor vocabulary, stable-vs-roll-dependent split, and no-awkward-scope-prefix direction are settled.
4. **Echo visual/UI implementation** — exact visual recipe renderer, card motion, responsive/touch behavior, and quality effects.
5. **Echo validation and later playtest tuning** — executable/property coverage for registry materialization, generated naming, distribution, EchoScore/magnitudes, quality, Middle Fingers, rewards, Pareto/settlement, Echo Sets, and paid-pull pity. No MAL spoiler-boundary/import testing remains in Echo scope.
6. **Exact special-AI Echo reward bonuses**, once the provisional character controllers receive actual competence targets/difficulty ratings.
7. **Real Fufubox performance capacity** after representative authoritative simulation exists.
8. **`isolated-vm` benchmark/hardening details** and controller resource limits.
9. **Exact SQLite schema/index/backup/retention details** for mechanical identities, naming-version references where needed, owned rolls, Echo Sets, Middle Fingers, pity, settlements, acquisition events, and other runtime state.
10. **Discord session/cookie/CSRF/expiry implementation** and optional later credential linking.
11. **Playtest retuning of terrain/structure/mobile-unit numerical values** without reopening accepted mechanic identities.
12. **Exact MIRV power retuning** within settled access/power direction.
13. **Detailed lobby/UI polish**, including Origin creator/preset presentation and already-settled Echo collection/reward/Gacha concepts.
14. **Replacement asset creation and proprietary-directory removal.**
15. **Normal gameplay tuning not already given a provisional registry value** — capture/growth/counter/FFY/Segment/weapon/spawn constants and similar balance data.
16. **Exact deterministic controller limits/diagnostic retention values.**
17. **Exact deterministic spawn-resolution implementation details.**
18. **Port trade-frequency level interaction.**

The public API philosophy, observation/directive split, geographic QoL layer, persistent-directive semantics, defense/counter surfaces, pure mechanics calculators, events/receipts, deterministic randomness, team signals/shared observation, public modifiers, multi-file authoring, private debug overlays, three-phase Strategic Spawn, split-origin profile, neutral-settlement residuals, expanded terrain/Fallout, eight-structure model, Silo/SAM/naval/Tank/P43/P44 rules, Origin philosophy/exhaustive deployment guarantee, provisional character-based Official-AI roster/shared Origin pools, and the **12,927 fixed mechanical Echo identities + uniform within-shape selection + rerolled EchoScore-weighted integer magnitudes + deterministic generated names with stable character/stat tokens and Catastrophic→Absurd polarity-aware magnitude descriptors + `with a side of` mixed grammar + no V1 authored Echo dialogue/MAL import pipeline + Trash→Cheater quality treatment + Middle Fingers duplicate/Pareto/pending-settlement progression + accumulated all-drop rewards + Echo Sets + 10/100-Middle-Finger Gacha Store + paid-pull-only 50-pull power-12 Lucky+ pity with no Cheater guarantee** are now settled V1 direction.

These remaining questions should be resolved by updating these same canonical documents rather than creating additional migration-plan documents.