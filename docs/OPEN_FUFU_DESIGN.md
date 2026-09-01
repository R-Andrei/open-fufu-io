# Open Fufu — Canonical Design Contract

## Status

This document is the **single canonical Open Fufu target-design contract and game-design source of truth**.

It defines **what Open Fufu is intended to be**. The separate [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) defines how the inherited OpenFront codebase should be migrated to this target.

Historical or superseded proposals do not override this contract. Future accepted Open Fufu design changes must update this document rather than creating competing mechanics documents.

Where this document distinguishes between **design rules**, **provisional tuning values**, **implementation choices**, **audit-dependent inherited behavior**, and **deliberately deferred systems**, those distinctions are intentional.

---

## 1. Product identity

Open Fufu is a browser-viewable territorial strategy game/autobattler in which the player **programs the battler**.

The player does not normally issue moment-to-moment commands during a match. Instead, before the match the player selects:

- an immutable version of their faction controller;
- a PvE item loadout where applicable;
- the lobby/game configuration.

Once the match begins, the controller governs the faction.

The controller is expected to reason about and control systems such as:

- neutral expansion;
- enemy target selection;
- offensive Population commitments;
- attack concentration and geometry;
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

- a **low entry floor**, where an ordinary player can modify a simple working controller without learning computational geometry or manually manipulating thousands of cells; and
- a **high skill ceiling**, where advanced players can reason directly about cells, Segments, Contacts, front geometry, statistics, optimization, weighting, and custom abstractions.

The engine should expose low-level strategy-neutral primitives while still allowing useful higher-level geographic queries. Raw cell-by-cell programming must not be the only practical way to play well.

Segments, Contacts, ordinary query/select/filter primitives, spatial weights, documentation, examples, and the starter controller should make sensible behavior approachable without granting privileged combat powers unavailable to advanced code.

### 1.2 Transparent mechanics

Open Fufu should strongly prefer explicit, surfaced mechanics over hidden modifiers and corrective special cases.

If a modifier materially affects Population growth, Deployment Rate, combat, trade, structure behavior, or another strategic quantity, it should normally come from a visible rule-bearing source such as terrain, a structure, an item, a ruleset value, or another explicit mechanic.

Do not quietly grant hidden reserve bonuses, hidden large/small-faction bonuses, invisible AI cheats, or similar behavior merely to steer outcomes.

### 1.3 Match-duration target

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
   |- progression / items
   |- matches / replays / logs
   `- browser viewer/editor/debugger
```

Foof may own Discord-facing concerns such as commands, identity handoff, lobby/match initiation, controller/loadout selection where useful, links into browser surfaces, and result/reward presentation.

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

Exact process topology, protocol, persistence, and sandbox technology are implementation architecture and are specified in the integration plan rather than this design contract.

---

## 4. Determinism, versioning, and replayability

Historical matches must remain reproducible.

A match must bind every rule-bearing input needed to define what that match meant, including identities equivalent to:

- match seed;
- map identity/version/hash;
- segment/map-generation version where relevant;
- simulation ruleset version;
- controller runtime/API version;
- exact immutable player-controller versions;
- exact official PvE AI preset versions;
- equipped item identities/seeds;
- item-generator versions;
- any other versioned data that materially changes deterministic simulation.

Changing a combat formula, controller API, AI preset, item generator, or map later must not silently change historical matches.

Replay/debug tooling should eventually expose:

- deterministic replay;
- committed controller decision/event logs;
- optional controller debug logs;
- action/rejection/failure history;
- Population/FFY/territory histories;
- relevant spatial/contact histories;
- controller runtime/CPU/resource-budget information;
- post-match summaries.

A player should be able to understand not only that their controller failed strategically or technically, but what it did and what the game/runtime rejected on the path to that result.

---

## 5. Controller language and authoring model

### 5.1 V1 language

The V1 controller language is **TypeScript**, with ordinary JavaScript-style code naturally usable.

The goal is a low entry floor with optional strong typing/autocomplete for advanced users.

### 5.2 Controller presets and immutable versions

Players may maintain multiple controller presets/strategies.

Drafts may be edited repeatedly. Published controller versions are immutable.

A match binds the exact published controller version selected at match start.

### 5.3 Primitive-oriented API philosophy

The controller API should expose **small, composable, strategy-neutral primitives**.

The engine should not provide privileged strategic policies such as `blitzkrieg()`, `turtle()`, `weakestPointPolicy()`, or `threatWeightedStrategy()`.

The conceptual read surface includes areas such as:

```text
game
factions
cells
segments
contacts
structures
units
economy
population
operations
runtime / lastDecision
```

The conceptual write/action surface includes low-level legal operations such as:

- creating/changing/withdrawing offensive Population commitments;
- specifying offensive spatial intent/weighting;
- creating/changing/withdrawing active counter-responses;
- neutral expansion intent;
- deliberate territory relinquishment/retreat;
- construction;
- upgrades;
- unit creation;
- unit movement/targeting;
- naval/amphibious operations;
- strategic weapon use;
- surrender/capitulation where applicable.

There is **no controller primitive for manually allocating passive defensive Population across owned cells**. Passive defense is automatic under the Population rules below.

Exact names and TypeScript types are API-design work.

### 5.4 Starter controller

Every player begins with one **minimal complete working controller**.

The starter controller should demonstrate lawful/basic use of major mechanics while being intentionally strategically unsophisticated. It may:

- expand monotonously;
- launch simple opportunistic attacks with simple spatial weighting;
- use a basic counter-response rule;
- build/upgrade in a simple even pattern;
- use ordinary available mechanics;
- avoid sophisticated doctrine, prediction, threat analysis, or policy systems.

It should function correctly but should not reliably win serious matches.

### 5.5 Browser authoring surface

The browser should be the primary rich authoring/debugging surface for player controllers rather than turning Foof/Discord into an IDE.

The intended product surface should support capabilities equivalent to:

- edit controller source;
- save incomplete drafts;
- inspect controller API documentation/types;
- run tests/certification/benchmarking;
- inspect diagnostics and replays;
- publish immutable certified versions;
- select/manage controller presets and versions.

---

## 6. Controller invocation contract

### 6.1 Immutable observation snapshots

Each controller invocation receives one immutable deterministic observation snapshot corresponding to a specific authoritative simulation state.

The simulation does not advance underneath the controller while that invocation executes.

Repeated reads during one invocation therefore see the same world. Returned collection ordering and other observable iteration behavior must be deterministic.

### 6.2 Provisional simulation/controller cadence

Current provisional starting values:

```text
Authoritative simulation: 10 ticks/second
Controller decision cadence: every 5 simulation ticks
Controller decisions: 2/second
```

These are provisional tuning values. The architectural rules are:

- cadence is deterministic;
- cadence is expressed in simulation ticks, not wall-clock time;
- controller cadence may be lower than simulation cadence;
- accelerated/headless matches process the same logical ticks faster rather than changing game time.

### 6.3 Persistent per-match controller memory

Each player controller has explicit deterministic **per-match persistent memory**.

The memory:

- survives successful controller invocations within that match;
- is private to that controller;
- is committed transactionally with a successful decision;
- rolls back if the invocation fails or the decision is rejected;
- is deterministically serializable;
- has an explicit size limit;
- is not shared between matches;
- provides no external I/O.

The allowed data model should be deliberately simple and deterministic, approximately equivalent to JSON-like data:

```text
null
boolean
finite number
string
arrays
plain structured objects
```

Controllers must not rely on mutable module/global runtime state surviving between invocations. Only the explicit memory contract is guaranteed writable persistence.

Current provisional memory limit: **128 KiB serialized per faction per match**.

Cross-match improvement belongs in controller source/version changes, not secret writable learning state.

---

## 7. Controller certification, safety, and failure handling

### 7.1 Mandatory certification before publication

Broken/incomplete drafts may be saved.

Only controller versions that pass mandatory certification may be published/used in real matches.

Certification should use the production controller contract/runtime constraints and rapidly exercise representative situations including:

- startup;
- neutral expansion;
- first hostile contact;
- multiple enemies;
- partial segment ownership;
- Population/FFY changes;
- disappearing/capitulating opponents;
- naval/amphibious opportunities;
- construction with sufficient/insufficient FFY;
- rapid territory changes;
- `atWar` transitions;
- very low Population;
- simultaneous attacks requiring automatic defense and counter-response decisions;
- invalid or impossible Population commitments;
- target disappearance and normal state races;
- runtime time/memory/output-limit conditions.

Certification must reject failures such as syntax/type/compile errors, runtime exceptions, timeout/memory violations, non-finite numeric output, invalid API arguments, malformed decisions, impossible commitments, and other controller-contract violations.

Certification failure blocks publication and returns useful diagnostics.

### 7.2 Transactional execution

Each invocation is all-or-nothing over:

- controller memory mutations;
- proposed persistent operation/directive changes;
- proposed game actions.

No partial decision cycle is applied.

### 7.3 Ordinary gameplay failure is structured

Lawful API use should normally produce structured game results/rejections when the world prevents an action.

Examples include:

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

Ordinary dynamic game-state races should not require blanket `try/catch` logic.

### 7.4 Invalid decisions

A complete invalid controller decision, such as requesting simultaneous commitments that exceed legal Available Population, is rejected as a whole.

The engine does not silently normalize or partially apply it.

### 7.5 Runtime failure behavior

A controller exception, timeout, sandbox violation, malformed output, or invalid decision must never crash/corrupt the match.

On failure:

- all output/memory from that invocation is discarded;
- the faction keeps the last successfully committed operations/directives;
- existing attacks, counter-responses, withdrawals, builds, units, and other previously valid actions continue under normal simulation rules;
- the failure is logged;
- later controller invocations are attempted again.

If the **first-ever invocation** fails before any valid directives exist, the deterministic baseline is:

```text
all Population is Available
no offensive commitments
no active counter-responses
no new actions/orders/directives
```

The faction therefore still receives its normal automatic defense, but takes no new strategic action until a later invocation succeeds. No starter controller or replacement AI takes over.

Repeated persistent failures trigger a deterministic circuit breaker. Exact retry thresholds/cooldowns are tuning/implementation values, but sufficiently persistent failure marks the controller **FAULTED** for the remainder of the match. A faulted faction continues its last valid operations, or the inert baseline if none ever committed.

### 7.6 `game.lastDecision`

The controller API should expose structured previous-decision information equivalent to `game.lastDecision`, including previous commit/reject state, structured rejection codes, request failure details where appropriate, and other deterministic metadata useful for programmatic recovery.

### 7.7 Human-facing diagnostics

Controller/runtime failures and decision rejections must produce useful human-facing diagnostics showing what failed, relevant structured codes, useful exception/stack information for real program errors, transaction rollback status, which previous valid directives remain active, and retry/faulted status where relevant.

---

## 8. Controller sandbox and security

Player controller code must be treated as hostile.

It must not receive unrestricted access to:

- filesystem;
- network;
- subprocesses;
- environment variables;
- system clock as a strategic information source;
- arbitrary native modules;
- host process objects;
- unrestricted memory or CPU.

The runtime must provide deterministic game RNG rather than exposing uncontrolled randomness.

CPU, memory, output/logging, persistent-memory, and action budgets must be explicit.

Raw `eval` and Node `vm` alone are not sufficient security boundaries. Exact sandbox technology is an implementation decision.

---

## 9. Spatial ontology

### 9.1 Cells

Cells are the finest meaningful territorial simulation resolution.

Ownership, terrain, capture, structures, and local combat geometry ultimately resolve through cells.

### 9.2 Segments

A Segment is an immutable deterministic strategic geographic region generated/compiled with the map.

Every real map cell belongs to exactly one Segment, including:

- ordinary land;
- water;
- impassable terrain.

Segments are a query/index/strategy lens, **not a simulation bucket**. Segment borders have no intrinsic combat, capture, movement, or physical effect.

Segment count is an output of map scale and geography rather than a fixed input. Generation should use approximate minimum/preferred/maximum useful area guidance while respecting major geographic boundaries such as coasts, rivers, ridges, mountains, chokepoints, islands, and impassables.

Future maps may contain richer water terrain types such as deep, shallow, turbulent, or clear water. The Segment ontology must not assume `segment == land`.

### 9.3 Contacts

**TerritorialContact** is derived adjacency geometry between differently owned cells.

**OperationalContact** is the broader runtime interaction/visibility state created by territorial contact, combat, naval encounters, amphibious arrival, or other operational interaction.

Exact API naming may change, but the conceptual distinction is accepted.

### 9.4 Fronts

There is no engine-level canonical `Front` object that dictates strategy.

Controllers may derive their own fronts from cells, Segments, Contacts, factions, terrain, ownership, and visibility. Documentation/SDK utilities may offer transparent grouping helpers, but no privileged front strategy is built into the engine.

---

## 10. Population model

### 10.1 One global Population resource

Each faction has one global **Total Population**.

Population is used for:

- offensive land operations;
- neutral expansion operations;
- active counter-responses;
- carried Population aboard transports;
- automatic defense while Available;
- casualties.

There is no separate civilian/army/manpower resource and no hidden mobilizable fraction.

### 10.2 Population Capacity is exactly territory-derived

**Population Capacity is exactly the number of owned population-bearing cells.**

For V1, population-bearing cells are ordinary conquerable land cells unless a future explicit terrain rule says otherwise.

Therefore:

```text
1 owned population-bearing cell = 1 Population Capacity
```

If a faction owns 125,000 eligible cells, its Capacity is 125,000.

No structure, item, faction trait, terrain productivity multiplier, or hidden modifier may increase Population Capacity while this rule is in force.

Cities therefore do **not** increase Capacity. Items must not provide `+Population Capacity`, `+Max Population`, or equivalent effects.

Territorial loss may leave current Population temporarily above Capacity. Capacity loss does not instantly kill the excess Population; ordinary positive growth is instead suppressed according to the growth rules until the faction returns to a sustainable state.

### 10.3 Available and Committed Population

Population is divided conceptually into:

```text
Total Population
= Available Population
+ offensive commitments
+ active counter-responses
+ Population aboard transports
```

There is no separate persistent `Reserve` resource.

**Available Population** is Population not currently committed to an active operation/transport. It automatically forms the faction's passive defensive pool and can also be deployed into new attacks, counter-responses, or transports.

### 10.4 No defensive cell allocation

There is **no persistent defensive Population allocation by cell, Segment, Contact, or front**.

Controllers cannot stack passive defenders onto selected owned cells.

A faction with 100,000 Available Population has a single 100,000-person automatic defensive pool. The simulation derives how much defensive pressure applies to simultaneous incoming attacks without creating persistent defensive occupancy records.

This is an intentional abstraction and performance/design simplification.

### 10.5 Quantized Population

Population should use deterministic quantized arithmetic rather than unconstrained floating-point quantities.

The public/controller-facing model should prefer whole Population units. Internal deterministic fixed-point residuals may be used where formulas require sub-unit precision.

Because Capacity is bounded by owned population-bearing cells, ordinary Population values have predictable map-derived numerical bounds.

---

## 11. Population growth

Population growth is separate from Population Capacity.

Capacity says **how much Population can be sustainably supported**. Growth systems say **how quickly Population recovers/grows toward that limit**.

Raw growth capacity comes from explicit sources such as:

- base territory-derived growth potential;
- Cities and other explicit growth structures;
- allowed item modifiers;
- future explicit faction/class modifiers.

Cities affect growth rather than Capacity.

### 11.1 Sublinear empire scaling

The accepted mathematical direction is sublinear growth scaling with population-bearing territory/Capacity, approximately:

```text
GrowthPotential ∝ PopulationCapacity^0.75
```

The exact exponent is tuning data, with roughly `0.7–0.8` considered a reasonable test range.

This prevents a faction with 10× the territory from automatically receiving 10× the absolute regeneration throughput.

### 11.2 Utilization curve

Let:

```text
u = TotalPopulation / PopulationCapacity
```

The accepted qualitative utilization curve is:

- broad full-growth optimum around roughly 40–60% utilization;
- progressively reduced growth below 40%, but never making recovery hopeless;
- progressively reduced growth above 60%, with harsher suppression toward Capacity;
- ordinary positive growth approaches zero at ~100% Capacity;
- no instantaneous Population deletion merely for being over Capacity.

Useful provisional anchors remain approximately:

| Utilization | Growth multiplier |
| ---: | ---: |
| 10% | 45% |
| 20% | 70% |
| 30% | 88% |
| 40% | 100% |
| 50% | 100% |
| 60% | 100% |
| 70% | 85% |
| 80% | 60% |
| 90% | 35% |
| 100% | 0% |

Exact interpolation and coefficients are balance work.

Conceptually:

```text
ActualGrowth
= GrowthPotential
× utilizationMultiplier(u)
× explicit growth modifiers
```

Newly grown Population enters **Available Population**.

---

## 12. Deployment Rate

The old concept of moving persistent defensive Population between cells is removed.

Instead, factions have one explicit **Deployment Rate** governing how quickly Population may move between Available Population and active strategic commitments.

Deployment Rate applies to transitions such as:

- Available → offensive operation;
- offensive operation → Available during withdrawal;
- Available → active counter-response;
- counter-response → Available during release/withdrawal;
- Available ↔ carried Population on transports where applicable.

Passive automatic defense does **not** consume Deployment Rate. Available Population defends automatically by definition.

V1 deliberately has no strategic distance cost for land deployment. Moving Population into an operation one cell away or across the empire uses the same throughput abstraction, subject to operation actionability rules.

The previously accepted scaling direction remains a provisional starting point:

```text
DeploymentRate(P) = Rref × (P / Pref)^(2/3)
```

Exact `Rref`, `Pref`, units, and modifiers are tuning data.

Items, structures, terrain, rail, or future faction mechanics may modify Deployment Rate only through explicit surfaced rules. V1 does not silently give rail or home defense a hidden deployment bonus.

---

## 13. Offensive operations and spatial intent

### 13.1 Operation-based Population commitment

Offensive Population is attached primarily to **operations**, not stored as persistent Population quantities on every affected cell.

Conceptually:

```text
AttackOperation {
    committedPopulation
    target
    spatialIntent
    activeFrontGeometry
}
```

The controller chooses how much Population to commit and where the operation should focus.

Spatial intent may be expressed through combinations of:

- target faction;
- target Segment(s);
- target Contact(s);
- explicit cells/areas;
- controller-defined cell sets;
- weights favoring particular approaches/terrain/objectives.

The engine derives the operation's local pressure over currently actionable cells from this finite committed Population and spatial intent. It does not need to persist a long-lived Population value for every front cell.

### 13.2 No duplicated attack power

One operation's finite committed Population cannot be counted in full against every cell/opponent simultaneously.

If an operation affects several active front cells, its pressure must be distributed deterministically across those cells according to its legal spatial intent/weighting.

Splitting one strategic attack into many tiny operation objects must not manufacture additional combat power.

### 13.3 Actionability and no teleporting land pressure

Land offensive pressure can only affect cells currently actionable through ordinary territorial/adjacency rules.

A controller may select a remote strategic objective, but selecting it does not create land combat pressure there.

Remote hostile coast becomes actionable through explicit amphibious transport/landing mechanics.

### 13.4 Neutral expansion

Neutral expansion uses ordinary Population through an expansion/offensive commitment rather than a separate colonist resource.

Neutral settlement does not cause arbitrary automatic Population deaths in V1.

Terrain may explicitly modify expansion/capture efficiency.

---

## 14. Automatic defense and counter-responses

### 14.1 Shared automatic defensive pool

Available Population automatically defends the faction.

When several independent attacks hit the same defender simultaneously, the same Available Population **must not be duplicated** across those attacks.

The accepted baseline rule is:

> Available Population is automatically divided into derived defensive pressure among simultaneous incoming hostile operations in proportion to their current incoming effective pressure, before local terrain/structure defensive modifiers are applied.

Example:

```text
Available defenders: 100,000
Incoming Fufu pressure: 75,000
Incoming Ski pressure: 25,000
```

The baseline automatic defensive split is approximately:

```text
75,000 defensive pressure against Fufu
25,000 defensive pressure against Ski
```

This split is derived for simulation purposes and is **not persistent defensive allocation state**.

If one attack disappears, the Available defensive pool automatically responds to the remaining threats on subsequent simulation steps.

The derivation must be resistant to attack-fragmentation exploits: dividing one attack into several equivalent operations must not force the defender to duplicate or inefficiently partition the same defensive Population.

### 14.2 Active counter-response

Controllers may deliberately commit Available Population to an **active counter-response** against a specific incoming hostile operation.

A counter-response is an explicit strategic commitment intended primarily to reduce/destroy the attacking commitment faster than passive defense alone.

Population committed to a counter-response is no longer part of the generic Available defensive pool while committed.

Therefore counter-response creates real risk/reward:

- committing more Population may break a dangerous attack faster;
- the same Population is unavailable for automatic defense elsewhere;
- Deployment Rate limits how quickly the commitment can be established or withdrawn.

Exact counter-response casualty/pressure coefficients are balance work.

---

## 15. Combat, casualties, and capture

Combat remains deterministic and cell-resolved even though passive defensive Population is not stored per cell.

The engine derives local effective attack/defense pressure from:

- operation committed Population;
- automatic shared defensive pressure;
- active counter-response pressure where relevant;
- operation spatial weighting/front geometry;
- terrain;
- structures;
- items;
- future explicit faction/class modifiers.

### 15.1 Territorial movement and casualties are separate outcomes

The accepted territorial-advantage direction remains:

```text
advantage = (A - D) / (A + D)
```

where `A` and `D` are local effective attack and defense pressure after legal explicit modifiers.

Capture/advance speed is based on positive advantage multiplied by explicit capture/movement rules.

Casualty-generation direction remains approximately:

```text
engagement ≈ 2AD / (A + D)
```

with casualty shares influenced by opposing pressure so stronger forces trade better but are not immune.

Qualitatively:

```text
equal forces      → high casualties, little movement
small superiority → slow movement, modest favorable trade
large superiority → faster movement, strongly favorable trade
undefended        → rapid capture, essentially no combat casualties
```

Exact coefficients are balance data.

### 15.2 Multi-faction combat

FFA remains genuinely all-vs-all.

If several hostile factions exert pressure in the same operational cells, each faction is hostile to every other non-team faction present.

A faction's finite pressure is not duplicated once per opponent. Multi-party engagement should distribute finite outgoing combat pressure proportionally among relevant opponents according to their local effective pressure.

If the current owner loses a cell under multi-party pressure, the strongest successful claimant receives the cell deterministically. Other hostilities remain active.

Attackers on completely separate fronts do not magically fight one another merely because they share an enemy.

### 15.3 Casualty accounting

Casualties reduce both the relevant committed/available pool and Total Population.

If casualties occur within an offensive operation, that operation loses Population and Total Population falls by the same amount.

If casualties occur through passive defense, Available Population and Total Population fall together.

The exact casualty mapping for strategic weapons and special effects that do not correspond to an ordinary land engagement remains mechanic-specific and must be explicit.

---

## 16. Retreat and deliberate territorial abandonment

Controllers must have an explicit primitive to deliberately relinquish owned territory rather than relying on withdrawal side effects.

The exact inherited consequences for structures, units, and cleanup are implementation/integration rules, but intentional abandonment is a real legal controller capability.

Offensive operation withdrawal and counter-response withdrawal are governed by Deployment Rate rather than instant Population teleportation.

---

## 17. Naval and amphibious Population

Transport ships carry explicitly committed Population.

While aboard a transport, carried Population:

- is not Available for automatic land defense;
- does not exert ordinary land pressure;
- may be lost if the transport is destroyed;
- becomes eligible to participate locally when a legal amphibious landing reaches its target.

A landing makes the coastal target operationally actionable; carried Population then becomes part of the local offensive engagement rather than teleporting land pressure to a remote coast.

Warships, ports, trade ships, trains, strategic weapons, and inherited unit/structure mechanics are retained or adapted where compatible as described in the integration plan.

---

## 18. Terrain and structures

Terrain is strategically meaningful rather than cosmetic.

Terrain may explicitly affect systems such as:

- attack/capture efficiency;
- defensive pressure;
- movement/pathing;
- naval behavior;
- future expansion rules.

Any meaningful modifier must be surfaced.

Structures are spatial game objects with explicit effects. Initial design direction includes:

- **Cities:** Population growth contribution, not Population Capacity;
- **Defense Posts:** local defensive modifier;
- **Ports:** naval and trade functionality;
- **Factories / train infrastructure:** economic/rail identity where retained;
- **Missile Silos / SAM:** strategic weapon and interception systems where retained.

Structures must not recreate a hidden global Military Power stat.

---

## 19. Visibility and information model

The central distinction is:

> knowing geography and political ownership is not the same as knowing local operational military state.

### 19.1 Globally visible

At minimum:

- static terrain/geography;
- coast/ocean/impassables;
- current territorial ownership;
- Segment definitions;
- broad faction shape;
- faction Total Population;
- Territory %;
- FFY.

### 19.2 Operational/local information

Detailed local information may depend on OperationalContact/visibility, including:

- active enemy offensive operations/pressure where observable;
- active counter-response information where observable;
- mobile units;
- defenses/structures where the visibility rules allow;
- local tactical modifiers/details.

### 19.3 Private

At minimum:

- controller memory;
- controller intentions/plans;
- unpublished controller source;
- unobservable strategic targeting/decision state.

The authoritative server must enforce information boundaries. The browser hiding information cosmetically is not sufficient.

---

## 20. FFY economy and trade

FFY is the primary in-match currency.

FFY is **not** passive `Population → money per second` income.

It is generated through explicit world/economic events such as:

- trade ship success/capture;
- trains/station economics;
- territorial/objective captures where configured;
- piracy/capture;
- future deliberate economy events.

The strategy should support tradeoffs among event frequency, event value, risk, and infrastructure investment.

Population committed to warfare does not secretly reduce FFY through an unstated labor penalty.

### 20.1 Wartime trade

Trade with enemies remains possible.

Default wartime economic penalty direction is **50%**, subject to explicit future modifiers.

Interdiction/warships may create in-world economic losses.

---

## 21. Teams, hostility, `atWar`, victory, and elimination

### 21.1 Teams and alliances

Team relationships are fixed pre-match.

FFA has no formal mutable alliances. Non-team factions remain legally attackable regardless of `atWar` state.

Emergent ceasefires or coalitions may arise purely from controller behavior rather than a mutable diplomacy system.

### 21.2 `atWar`

`atWar` is a symmetric derived recent-hostility state, not an attack-permission gate.

Hostile actions that may establish/refresh it include land attacks, amphibious attacks, destructive naval combat, territorial capture, and destructive strategic weapons.

It may affect controller/UI logic, trade penalties, statistics, or future explicit rules.

Exact timeout is tuning data.

### 21.3 Victory

FFA victory occurs when a faction:

- controls 100% of conquerable territory; or
- all other factions have resigned/capitulated/been defeated.

Team victory occurs when:

- all non-team opposition is defeated/capitulated; or
- the team collectively controls all conquerable territory.

If a human faction is eliminated before the end but their human team ultimately wins, that human still receives the team win and applicable team-PvE progression reward.

Team PvE is available only with multiple **human** players. A solo human cannot add AI teammates merely to farm team-PvE rewards.

Humans may resign. Official AI may capitulate according to its controller logic.

Exact defeated-faction territory/structure cleanup is integration-dependent and must not silently inherit incompatible OpenFront behavior.

---

## 22. Official PvE AI

Official PvE AI presets are authored by the game creator, not uploaded by ordinary players.

All shipped maps/modes/AI presets intended for PvE progression are legitimate progression content by design; there is no user-created reward-AI approval marketplace.

Official AI must obey the same gameplay rules as player controllers:

- same visibility/information restrictions;
- same Population/FFY;
- same structure/unit rules;
- same legal actions;
- same combat equations;
- no omniscience;
- no hidden resource multipliers;
- no teleportation or private simulation cheats.

Official AI may use trusted runtime code operationally, but difficulty should come from program/strategy quality rather than rule advantages.

Reusable internal strategy components are encouraged for maintainability, but they do not become privileged player-facing strategic policies.

Reference personalities may include Tanya-style concentrated breakthrough, Reinhard-style economic/threat optimization, and Thorfinn-style retaliation/non-aggression, with exact implementations/versioning owned by the game creator.

---

## 23. Items, loadouts, rarity, and PvE progression

### 23.1 Item catalogue

The game may contain a very large deterministic/versioned item catalogue.

Each item has deterministic identity tied to an item seed/identity and generator version.

The catalogue should avoid intentionally duplicate complete mechanical signatures.

Items may contain:

- one or two modifiers;
- positive effects;
- drawbacks;
- mixed positive/drawback combinations;
- deterministic names/flavor/dialogue/visual identity where applicable;
- a positive sampling weight.

V1 item mechanics must **not** include Population Capacity / maximum-Population modifiers while Capacity remains exactly territory-derived.

Allowed families may include explicit modifiers such as:

- Population growth;
- Deployment Rate;
- offensive pressure;
- defensive pressure;
- FFY/trade;
- structures;
- naval/unit behavior;
- terrain interactions;
- other surfaced mechanics.

Exact item family list is balance/content work.

### 23.2 Modifier stacking

The accepted stacking rule is:

```text
final = (base + sum(flat)) × (1 + sum(percentage))
```

Percentage modifiers in the same calculation are additive before multiplication unless a specific explicit mechanic says otherwise.

### 23.3 Sampling weights and rarity

Every normally droppable item has positive sampling weight.

For an eligible normal table:

```text
P(item) = itemWeight / sum(eligibleWeights)
```

Lower weight means rarer.

Rarity need not be divided into conventional rarity tiers. Item power should influence rarity, but rarity may also contain deterministic collectible/flavor randomness so mechanical power is not the only source of rarity.

Displayed inherent rarity is based on the item's normal global sampling probability/weight, not on a temporary store-filter probability.

### 23.4 PvE win rolls

A won configured PvE match awards a number of independent item rolls determined by the configured opposing official AI presets. The player keeps the rarest result according to normal drop probability/weight.

AI roll contribution depends on the AI being present in the won match, not on which human personally eliminated it.

### 23.5 Team PvE division rule

For team PvE, each human receives an independently sampled number of rolls:

```text
perHumanRolls = max(1, ceil(soloEquivalentRolls / numberHumanPlayers))
```

Examples:

```text
solo equivalent 9
1 human → 9 rolls
2 humans → 5 each
3 humans → 3 each
```

Only actual multi-human team PvE uses the divided team rule.

### 23.6 Duplicates and gambling currency

Normal PvE drops may produce duplicates.

A duplicate is automatically converted into a persistent gambling-store currency.

There are no multiple owned copies and no required manual sale flow.

Every duplicate should fund at least one gambling-store attempt.

The gambling store:

- excludes already owned items from the eligible purchase/roll table;
- renormalizes remaining eligible weights;
- does not change the displayed inherent rarity of an item;
- uses a persistent currency separate from in-match FFY.

### 23.7 Loadouts

Standard PvE loadout size is **7 items**.

PvP progression/loadout standardization remains deliberately deferred until PvP design is revisited.

---

## 24. Match observability

Observability is a first-class game feature because programming is the gameplay.

The system should expose enough deterministic information to debug strategy, including:

- replay;
- controller decisions;
- controller logs within explicit limits;
- action failures/rejections;
- CPU/runtime-budget information;
- Population history;
- FFY history;
- territory history;
- active-operation/counter-response history;
- post-match summaries.

Headless accelerated testing should use the same logical game rules as live matches.

---

## 25. Deliberately deferred or implementation-level systems

The following remain intentionally outside the settled design contract unless otherwise stated above:

- exact TypeScript API names/types;
- exact sandbox technology;
- exact persistence/database implementation;
- exact wire protocol;
- exact authentication mechanism;
- exact deterministic memory codec;
- exact casualty/capture coefficients;
- exact Deployment Rate reference values;
- exact Population-growth coefficients/interpolation;
- exact Segment size heuristics;
- exact terrain values;
- exact FFY payouts;
- exact AI reward values;
- exact inherited naval/rail/strategic-weapon translations where not specified;
- exact defeated-faction cleanup;
- detailed lobby/UI experience;
- supply/logistics connectivity as a separate system.

Supply is explicitly deferred from V1. Do not introduce hidden supply roots, path-distance logistics, or supply penalties under another name.

---

## 26. Canonical invariants summary

The following are intended as high-level invariants for future implementation/audit work:

1. **The server owns the match.** Browsers are not simulation authorities.
2. **The controller may fail; the match must continue deterministically.**
3. **Controllers receive deterministic immutable observations and explicit persistent per-match memory.**
4. **Cells are the physical territorial resolution; Segments are immutable strategic lenses.**
5. **Every real map cell belongs to exactly one Segment.**
6. **Population is one global quantized faction resource.**
7. **Population Capacity equals owned population-bearing cells exactly.**
8. **There is no persistent defensive cell Population allocation.**
9. **Available Population automatically forms one globally shared defensive pool.**
10. **Offensive Population is committed to sparse operations with spatial intent.**
11. **The same defenders or attackers may never be duplicated merely because several fronts/operations exist.**
12. **Controllers may actively counter an incoming operation by committing Population, at the cost of reducing Available defense elsewhere.**
13. **Deployment Rate limits Population entering/leaving active commitments, but passive defense is automatic.**
14. **Combat and ownership still resolve through cells.**
15. **Terrain/structures/items affect combat only through explicit surfaced rules.**
16. **FFY is event-driven, not passive Population taxation.**
17. **FFA is truly hostile among non-team factions; fixed teams are the only formal alliance relationship.**
18. **Official AI obeys the same gameplay information and mechanics as player controllers.**
19. **Historical matches bind exact rule-bearing versions.**
20. **One canonical design document governs the target; one canonical integration plan governs the migration.**
