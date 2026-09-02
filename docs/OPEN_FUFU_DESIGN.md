# Open Fufu — Canonical Design Contract

## Status

This document is the **single canonical Open Fufu target-design contract and game-design source of truth**.

It defines **what Open Fufu is intended to be**. The separate [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) defines how the inherited OpenFront codebase should be migrated to this target.

Historical or superseded proposals do not override this contract. Future accepted Open Fufu design changes must update this document rather than creating competing mechanics documents.

Where this document distinguishes between **design rules**, **provisional tuning values**, **implementation choices**, **audit-dependent inherited behavior**, and **deliberately deferred systems**, those distinctions are intentional.

---

## 1. Product identity

Open Fufu is a browser-viewable territorial strategy game/autobattler in which the player **programs the battler**.

The player does not normally issue moment-to-moment commands during a match. Before the match the player selects:

- an immutable version of their faction controller;
- one immutable **Origin**, official or custom;
- a PvE **Echo** loadout where applicable;
- the lobby/game configuration.

Once the match begins, the controller governs the faction.

The controller is expected to reason about systems such as:

- neutral expansion;
- enemy target selection;
- offensive Population commitments;
- attack concentration, frontage, and geometry;
- passive defensive priorities;
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

- a **low entry floor**, where an ordinary player can modify a simple working controller without learning computational geometry or manipulating thousands of cells directly; and
- a **high skill ceiling**, where advanced players can reason directly about cells, Segments, Contacts, frontage, statistics, optimization, weighting, and custom abstractions.

The engine should expose low-level strategy-neutral primitives while still allowing useful higher-level geographic queries. Segments, Contacts, ordinary query/select/filter primitives, spatial weights, documentation, examples, and the starter controller should make sensible behavior approachable without granting privileged strategic powers.

### 1.2 Transparent mechanics

Open Fufu should strongly prefer explicit, surfaced mechanics over hidden modifiers and corrective special cases.

If a modifier materially affects Population growth, combat, trade, structure behavior, spawning, or another strategic quantity, it should normally come from a visible rule-bearing source such as terrain, a structure, an Origin trait, an Echo, a ruleset value, or another explicit mechanic.

Do not quietly grant hidden reserve bonuses, hidden large/small-faction bonuses, invisible AI cheats, or similar behavior merely to steer outcomes.

### 1.3 Three complementary power-expression axes

Open Fufu intentionally separates three different ways a player expresses power and strategy:

```text
Controller
= how the faction thinks and decides

Origin
= what kind of faction it fundamentally is

Echoes
= collectible dialogue-line modifiers used to specialize the build
```

Origins and Echoes must not become substitutes for controller quality. The controller remains the primary strategic/intelligence layer.

### 1.4 Match-duration target

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
   |- Origins / Echoes / progression
   |- matches / replays / logs
   `- browser viewer/editor/debugger
```

Foof may own Discord-facing commands, identity handoff, lobby/match initiation, controller/Origin/Echo-loadout selection where useful, links into browser surfaces, and result/reward presentation.

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

Exact process topology, protocol, persistence, and sandbox technology are integration architecture and are specified in the integration plan rather than this design contract.

---

## 4. Determinism, versioning, and replayability

Historical matches must remain reproducible.

A match must bind every rule-bearing input needed to define what that match meant, including identities equivalent to:

- match seed;
- map identity/version/hash;
- Segment/map-generation version where relevant;
- simulation ruleset version;
- controller runtime/API version;
- exact immutable player-controller versions;
- exact official PvE AI preset versions;
- exact Origin definition/version for every faction;
- Origin-trait catalogue/version where relevant;
- equipped Echo identities/seeds;
- Echo-generator/catalogue versions;
- spawn-mode/configuration and spawn-resolution version where relevant;
- any other versioned data that materially changes deterministic simulation.

Changing a combat formula, controller API, AI preset, Origin trait, Echo generator, spawn resolver, or map later must not silently change historical matches.

Replay/debug tooling should eventually expose:

- deterministic replay;
- committed controller decision/event logs;
- optional controller debug logs;
- action/rejection/failure history;
- Population/FFY/territory histories;
- relevant operation/contact histories;
- controller runtime/CPU/resource-budget information;
- post-match summaries.

---

## 5. Controller language and authoring model

### 5.1 V1 language

The V1 controller language is **TypeScript**, with ordinary JavaScript-style code naturally usable.

### 5.2 Controller presets and immutable versions

Players may maintain multiple controller presets/strategies. Drafts may be edited repeatedly. Published controller versions are immutable. A match binds the exact published controller version selected at match start.

### 5.3 Primitive-oriented API philosophy

The controller API should expose **small, composable, strategy-neutral primitives**.

The engine should not provide privileged strategic policies such as `blitzkrieg()`, `turtle()`, `weakestPointPolicy()`, or `threatWeightedStrategy()`.

The conceptual read surface includes areas such as:

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
rules / mechanics
events / lastDecision
random / limits
```

The conceptual write/action surface includes low-level legal operations such as:

- creating/changing/ending offensive Population commitments;
- specifying offensive spatial intent/weighting;
- specifying passive defensive cell priorities/weights;
- creating/changing/ending active counter-responses;
- neutral expansion intent;
- deliberate territory relinquishment/retreat;
- construction;
- upgrades;
- unit creation;
- unit movement/targeting;
- naval/amphibious operations;
- strategic weapon use;
- bounded team signals where applicable;
- surrender/capitulation where applicable.

There is **no controller primitive for manually allocating passive defensive Population quantities across owned cells**. Passive defense quantity is automatic; the controller may only influence which threatened cells receive scarce automatic defenders through strategy-neutral priorities/weights.

The public controller contract must not expose mutable canonical `Game`, `Player`, `Unit`, `GameMap`, raw tile-state buffers, `Execution` objects, or equivalent engine internals. The controller receives legal observations and submits declarative directives/commands.

### 5.4 Starter controller

Every player begins with one **minimal complete working controller**. It should demonstrate lawful/basic mechanics while remaining strategically weak. It may expand monotonously, launch simple opportunistic attacks with simple weighting, use an even-spread defensive priority policy, use a basic counter-response rule, build/upgrade evenly, and avoid sophisticated doctrine, prediction, or threat analysis.

A minimal controller must be viable without scanning every cell, implementing graph algorithms, manually allocating defenders, reproducing formulas, or manually tracking engine operation identities.

### 5.5 Browser authoring surface

The browser should be the primary rich authoring/debugging surface. It should support capabilities equivalent to editing controller source, saving incomplete drafts, inspecting API documentation/types, certification/benchmarking, diagnostics/replays, publishing immutable certified versions, selecting controller presets/versions, and visualizing controller debug overlays.

### 5.6 Multi-file source packages

Controller projects may contain multiple local TypeScript modules. Publication compiles/typechecks/bundles the source package plus the official controller SDK into one immutable certified artifact. Runtime filesystem/import access is not required.

---

## 6. Controller invocation contract

### 6.1 Immutable observation snapshots

Each controller invocation receives one immutable deterministic observation snapshot corresponding to a specific authoritative simulation state. The simulation does not advance underneath the controller while that invocation executes. Returned collection ordering and other observable iteration behavior must be deterministic.

### 6.2 Provisional cadence

Current provisional starting values:

```text
Authoritative simulation: 10 ticks/second
Controller decision cadence: every 5 simulation ticks
Controller decisions: 2/second
```

Cadence is deterministic and expressed in simulation ticks, not wall-clock time. Accelerated/headless matches process the same logical ticks faster rather than changing game time.

### 6.3 Persistent per-match controller memory

Each player controller has explicit deterministic **per-match persistent memory**. It is private, transactionally committed with successful decisions, rolled back on failure/rejection, deterministically serializable, size-limited, not shared between matches, and provides no external I/O.

The allowed data model is approximately JSON-like:

```text
null
boolean
finite number
string
arrays
plain structured objects
```

Controllers must not rely on mutable module/global runtime state surviving between invocations. Only explicit controller memory is guaranteed writable persistence.

Current provisional memory limit: **128 KiB serialized per faction per match**.

### 6.4 Decision-as-set semantics

A controller invocation proposes one **transactional desired decision set**, not an order-sensitive imperative script over canonical state.

If one decision reduces one Population commitment and increases another, validation considers the proposed final commitment state rather than making source-code call order a hidden gameplay mechanic. One-shot commands are validated against the same observation snapshot and may not depend on a structure/unit created earlier in that same decision unless a future command explicitly documents otherwise.

Persistent directives remain active when the controller does not mention them on the next invocation. One-shot commands execute only once.

---

## 7. Controller certification, safety, and failure handling

### 7.1 Mandatory certification

Broken/incomplete drafts may be saved. Only controller versions that pass mandatory certification may be published/used in real matches.

Certification should exercise startup, neutral expansion, hostile contact, multiple enemies, partial Segment ownership, Population/FFY changes, disappearing/capitulating opponents, naval/amphibious opportunities, construction success/failure, rapid territory changes, `atWar` transitions, very low Population, simultaneous attacks, invalid commitments, target races, spawn lifecycle fallbacks where applicable, and runtime resource limits.

Certification rejects syntax/type/compile errors, runtime exceptions, timeout/memory violations, non-finite numeric output, invalid API arguments, malformed decisions, impossible commitments, and other controller-contract violations.

### 7.2 Transactional execution

Each invocation is all-or-nothing over controller memory mutations, persistent operation/directive changes, and proposed game actions. No partial decision cycle is applied.

Population commitment changes from one valid decision take effect **immediately at that decision commit**. There is no Deployment/Redeployment delay system in V1.

### 7.3 Structured gameplay failure

Lawful API use should normally produce structured results/rejections such as:

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

Ordinary game-state races should not require blanket `try/catch` logic.

### 7.4 Invalid decisions

A complete invalid controller decision, such as simultaneous commitments exceeding legal Available Population, is rejected as a whole. The engine does not silently normalize or partially apply it.

### 7.5 Runtime failure behavior

A controller exception, timeout, sandbox violation, malformed output, or invalid decision must never crash/corrupt the match.

On failure:

- output/memory from that invocation is discarded;
- the faction keeps its last successfully committed operations/directives;
- existing attacks, counter-responses, builds, units, and other prior valid actions continue under normal simulation rules;
- the failure is logged;
- later controller invocations are attempted again.

If the **first-ever normal match invocation** fails:

```text
all Population is Available
no offensive commitments
no active counter-responses
no new actions/orders/directives
```

The faction still receives normal automatic defense. Persistent failures trigger a deterministic circuit breaker; sufficiently persistent failure marks the controller **FAULTED** for the remainder of the match. No replacement AI takes over.

Pre-match spawn-hook failure is handled by deterministic spawn defaults and does not by itself fault an otherwise valid controller.

### 7.6 Diagnostics

`lastDecision` exposes deterministic previous-decision status/rejection metadata useful for programmatic recovery. Human-facing diagnostics should show relevant codes, exception/stack information for real program errors, transaction rollback status, active prior directives, and retry/faulted status.

---

## 8. Controller sandbox and security

Player controller code must be treated as hostile even though the intended user group is small and authenticated.

It must not receive unrestricted access to filesystem, network, subprocesses, environment variables, system clock, arbitrary native modules, host process objects, or unrestricted CPU/memory.

The runtime must provide deterministic game RNG rather than uncontrolled randomness. CPU, memory, output/logging, persistent-memory, query/materialization, directive, and action budgets must be explicit.

Raw `eval` and Node `vm` alone are not sufficient security boundaries. The initial implementation choice is described in the integration plan.

---

## 9. Spatial ontology

### 9.1 Cells

Cells are the finest meaningful territorial simulation resolution. Ownership, terrain, capture, structures, and local combat geometry ultimately resolve through cells.

### 9.2 Segments

A Segment is an immutable deterministic strategic geographic region generated/compiled with the map. Every real map cell belongs to exactly one Segment, including ordinary land, water, and impassable terrain.

Segments are a query/index/strategy lens, **not a simulation bucket**. Segment borders have no intrinsic combat, capture, movement, or physical effect.

Segment count is derived from map scale/geography rather than fixed. Major boundaries such as coasts, rivers, ridges, mountains, chokepoints, islands, and impassables should influence generation.

### 9.3 Contacts

**TerritorialContact** is derived adjacency geometry between differently owned cells.

**OperationalContact** is broader runtime interaction/visibility state created by territorial contact, combat, naval encounters, amphibious arrival, or other operational interaction.

### 9.4 Fronts

There is no engine-level canonical `Front` object that dictates strategy. Controllers may derive fronts from cells, Segments, Contacts, factions, terrain, ownership, and visibility.

---

## 10. Population model

### 10.1 One global Population resource

Each faction has one global **Total Population** used for offensive land operations, neutral expansion, counter-responses, transport payloads, automatic defense while Available, and casualties.

There is no separate civilian/army/manpower resource and no hidden mobilizable fraction.

### 10.2 Population Capacity is exactly territory-derived

**Population Capacity is exactly the number of owned population-bearing cells.**

For V1, population-bearing cells are ordinary conquerable land cells, including conquerable fallout land, unless an explicit terrain rule says otherwise.

```text
1 owned population-bearing cell = 1 Population Capacity
```

No structure, Echo, Origin trait, faction trait, terrain multiplier, or hidden modifier increases the Capacity value of an already owned cell while this rule is in force.

Cities do **not** increase Capacity. Echoes and Origins must not provide `+Population Capacity`, `+Max Population`, or equivalent per-territory effects.

A surfaced **Initial Territory** starting-state modifier is compatible with this invariant because it changes how many population-bearing cells the faction owns at match start. Those additional owned cells then contribute ordinary Capacity at exactly one Capacity each. The modifier changes starting ownership, not Capacity-per-cell.

Territorial loss may leave current Population above Capacity. Capacity loss does not itself delete excess Population; ordinary positive growth is suppressed until sustainable again, except where the same event explicitly causes Population casualties under another rule.

### 10.3 Available and Committed Population

```text
Total Population
= Available Population
+ offensive commitments
+ active counter-responses
+ Population aboard transports
```

There is no persistent `Reserve` resource.

**Available Population** is Population not currently committed to an active operation/transport. It forms the faction's automatic defensive pool and may be recommitted instantly by a valid controller decision.

### 10.4 No defensive occupancy

There is **no persistent defensive Population allocation by cell, Segment, Contact, or front**. Controllers cannot stack passive defenders onto selected owned cells.

Automatic defense is an ephemeral per-tick use of Available Population. One unit of Available Population may defend at most one threatened owned cell in that tick, and one threatened owned cell may receive at most **1 automatic defensive Population** regardless of how much Population the faction has.

Capacity is a ceiling, not free defensive strength. A faction with territory but **0 Available Population has 0 baseline Population defense**. Terrain/structure percentage modifiers do not create Population out of nothing; only an explicit future mechanic that supplies independent flat defense could do so.

### 10.5 Quantized Population and deterministic fractional costs

Authoritative Population quantities exposed to controllers and used for allocations/commitments are non-negative whole integers and should normally use a `uint32`-compatible representation.

Deterministic fixed-point/residual accumulators may be used internally where formulas or explicit mechanics need sub-unit precision. A mechanic such as **0.5 Population settlement cost per neutral cell** therefore does not make public Population fractional: two half-cost settlement events consume one whole Population through deterministic residual accounting.

A residual associated with a faction-level recurring cost must not be erased by ending/recreating an operation. In particular, any fractional neutral-settlement residual is **faction-level persistent match state**, preventing operation churn from avoiding payment.

---

## 11. Population growth

Capacity says how much Population can be sustainably supported. Growth says how quickly Population recovers/grows toward that limit.

The accepted conceptual model is:

```text
BaseGrowth
= Gref × PopulationCapacity^0.75

ActualGrowth
= BaseGrowth
× utilizationMultiplier
× explicitGrowthModifiers
```

The exact exponent is tuning data, with roughly `0.7–0.8` a reasonable test range.

Cities and allowed Population-growth Origin traits/Echoes contribute through explicit growth modifiers or explicit Origin growth-profile rules rather than Capacity.

Let:

```text
u = TotalPopulation / PopulationCapacity
```

Useful provisional utilization anchors remain:

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

Exact interpolation is balance work.

If `PopulationCapacity == 0`, ordinary Population growth is exactly zero and no division by zero is performed.

Newly grown Population enters **Available Population**.

---

## 12. Offensive operations and engaged frontage

### 12.1 Instant operation commitment

Offensive Population is attached primarily to operations rather than cells.

Conceptually:

```text
AttackOperation {
    committedPopulation
    target
    spatialIntent
    activeFrontGeometry
}
```

Creating, changing, ending, or reallocating an operation's Population occurs immediately when a valid controller decision commits. V1 has no Deployment/Redeployment Rate or gradual land mobilization queue.

### 12.2 Spatial intent

Spatial intent may use target factions, Segments, Contacts, explicit cells/areas, controller-defined cell sets, terrain, objectives, and weights.

The engine resolves intent into legal **engagement lanes** for each simulation tick.

An engagement lane is one attacking source cell pressing one adjacent target cell for that faction during that tick.

Within one faction's resolved frontage:

- one source cell may press at most one target cell in that tick;
- the same target cell is not duplicated by multiple source cells from that faction in that tick;
- different hostile factions may still contest the same target cell from different sides;
- engagement geometry is frozen for the tick, so newly captured cells do not create same-tick chain conquest.

### 12.3 Population bounds frontage

An operation cannot actively press more engagement lanes than its committed Population.

```text
engagedFrontage
<= committedPopulation
```

If an operation commits 800 Population against 1,000 otherwise legal selected boundary cells, at most 800 engagement lanes are active; its weighting determines which legal lanes are selected.

If it commits 100,000 Population across only 300 engaged lanes, all 300 may be active and the surplus Population increases concentration/pressure on those lanes.

### 12.4 Finite offensive pressure

An operation's finite committed Population is distributed deterministically across its engaged lanes according to its legal weights. Uniform weighting means approximately:

```text
raw attack pressure per lane
= committedPopulation / engagedFrontage
```

Multiple same-faction operations contributing to the same local combat are aggregated into one faction-local pressure before combat resolution. Splitting one strategy into many operation objects must never manufacture power.

### 12.5 Actionability

Land pressure only affects cells actionable through current territorial adjacency. Selecting a remote objective does not teleport land pressure there. Remote hostile coast becomes actionable through explicit amphibious transport/landing mechanics.

### 12.6 Neutral expansion

Neutral expansion uses ordinary Population through an offensive/expansion operation.

Neutral cells have **no automatic Population defender**, but neutral settlement is neither free nor instantaneous. A neutral population-bearing cell must still receive sufficient legal settlement/capture progress, and **each successfully acquired neutral population-bearing cell costs 1 Population from the expansion commitment** under the baseline ruleset.

The settlement casualty is a colonization/occupation cost, not a phantom neutral defender: there is no neutral defending Population to kill and no defender-side Population accounting.

Explicit surfaced mechanics may modify neutral-settlement Population cost. A fractional cost such as `0.5 Population per cell` is handled through the faction-level deterministic residual mechanism in §10.5 while controller-visible Population and commitments remain whole integers.

Neutral fallout remains neutral/conquerable population-bearing land and additionally applies its explicit fallout capture-resistance/progress rule.

---

## 13. Automatic defense, defensive priorities, and counter-responses

### 13.1 Binary contact-surface defense

Available Population automatically defends without persistent defensive placement.

For each simulation tick, derive the defender's distinct owned target cells currently pressed by incoming engaged hostile lanes. Automatic cell defense is **binary**:

```text
0 or 1 automatic defensive Population per threatened owned cell
```

No threatened cell may receive more than 1 automatic defender, even when Available Population greatly exceeds the engaged frontage.

Therefore:

```text
automaticallyDefendedCells
= min(AvailablePopulation, threatenedOwnedCells)
```

If Tanya has 100,000 Available Population and only 1,000 threatened cells, all 1,000 may receive one automatic defender and the remaining Population stays Available. It does not create additional hidden defensive pressure.

If Available Population is lower than the threatened surface, the finite defense slots are apportioned across incoming contacts/operations approximately in proportion to their engaged lane counts. Thus a 300-lane Fufu attack plus a 100-lane Ski attack against Tanya receives a 3:1 share of Tanya's scarce automatic defense slots before cell-priority selection.

A merely adjacent but inactive border does not consume defense. The same Available Population must never be duplicated across cells, contacts, or attackers. If multiple hostile operations contest the same owned target cell, that cell still receives at most one automatic defender.

Terrain, Forts, Origins, Echoes, and other explicit local modifiers may modify the effectiveness of that one defender; they do not increase the automatic Population count above one.

If Available Population is zero, baseline Population defense is zero.

### 13.2 Defensive priority policy

Controllers may provide strategy-neutral defensive priorities/weights that determine **which threatened cells receive scarce automatic defenders**. They do not choose how many Population units automatic defense receives and cannot assign more than one automatic defender to a cell.

A controller may, for example, prioritize mountains, Forts, Cities, chokepoints, selected Segments, objectives, or arbitrary legal cell sets. The controller can construct any higher-level defensive doctrine from these primitives.

The default policy is an **Even Spread** policy. Equal-priority cells use deterministic seeded tie-breaking derived from rule-bearing match state rather than uncontrolled randomness. The deterministic tie-break may rotate over time so the default does not permanently leave the same arbitrary cells undefended.

Defensive priorities are updated through ordinary controller decisions and then consumed cheaply by the simulation between controller invocations. Newly threatened cells without an explicit priority fall back to the default priority.

### 13.3 Active counter-response

A controller may instantly commit Available Population to an **active counter-response** against a specific incoming hostile operation.

Counter-response Population leaves the generic Available pool while committed. It does **not** reinforce passive cell defense and cannot raise a threatened cell above the one-defender automatic cap.

Instead, counter-response Population directly engages the incoming operation's committed Population as a targeted operation-vs-operation fight. Counter-response combat may therefore reduce Population even when no cell changes owner.

Let:

```text
A = Population currently committed to the incoming attack
R = Population currently committed to the counter-response
```

If either side is zero, no counter-response exchange occurs and the zero-strength operation ends as appropriate. Otherwise, counter-response combat resolves simultaneously from the same pre-tick `A` and `R`.

The shared **base exchange volume** is proportional to the smaller force:

```text
B = k × min(A, R)
```

where `k` is a ruleset/tuning rate.

Force-size advantage is determined from **relative**, not absolute, imbalance:

```text
d = (R - A) / (R + A)
```

so `d` lies between `-1` and `+1` and behaves the same at early-game and late-game scales. The imbalance is then deliberately flattened near parity with a nonlinear shape:

```text
s = sign(d) × |d|^p
```

with `p > 1`; **`p = 2` is the provisional V1 starting value**.

Let `M` be the maximum permitted casualty-efficiency ratio between the advantaged and disadvantaged side. **`M = 1.5` is the provisional V1 starting cap.** Define:

```text
h = (M - 1) / (M + 1)
```

The default mirrored V1 multipliers are:

```text
responseMultiplier = 1 + h × s
attackMultiplier   = 1 - h × s
```

and the simultaneous casualties are conceptually:

```text
attackPopulationLost   = B × responseMultiplier
responsePopulationLost = B × attackMultiplier
```

with deterministic fixed-point/residual handling and hard caps so neither side loses more Population than it actually has.

The ruleset exposes **attack-side** and **response-side** counter-combat effectiveness curves/parameters as semantically separate hooks even when their default V1 behavior is mirrored. Future explicit Origin/Echo/ruleset mechanics may favor overwhelming attack or overwhelming response differently.

Ending/changing a surviving counter-response is instantaneous on a valid controller decision and returns its surviving Population to Available. A counter-response is tied to one incoming operation and cannot duplicate the same committed Population across multiple targets.

Exact `k`, final `M`, final `p`, and future explicit side-specific modifiers are balance data rather than architectural questions.

---

## 14. Cell combat, capture, and ordinary land casualties

Combat is deterministic and cell-resolved.

For each engaged target cell, local effective attack pressure is derived from finite attacker pressure and explicit modifiers. Local automatic defense is either zero or one Population before terrain/structure/Origin/Echo modifiers. Counter-response combat against the offensive operation is separate from passive cell defense.

### 14.1 Capture direction

The accepted pressure-advantage direction remains a useful starting point for capture progress/speed:

```text
advantage = (A - D) / (A + D)
```

where `A` and `D` are local effective pressures after explicit modifiers. If both are zero, there is no combat capture.

Exact capture-progress/rate coefficients are tuning data.

### 14.2 Frontage bounds territorial throughput

A target cell can change political owner at most once per simulation tick.

Because engagement geometry is frozen at tick start, one active engagement lane can yield at most one cell capture during that tick and newly captured cells cannot open additional same-tick captures.

Therefore an operation with 300 engaged lanes cannot capture more than 300 cells in that tick. Actual captures may be much lower according to pressure advantage, terrain, structures, and capture-rate tuning.

### 14.3 Ordinary hostile land casualties are capture-coupled

V1 does **not** use a separate continuous land attrition formula such as `2AD/(A+D)` for ordinary hostile cell capture.

For each successfully captured **automatically defended population-bearing hostile cell** under the baseline rule:

- the previous owner loses the **1 current Population** that was automatically defending that cell;
- the winning attacker loses **1 current Population** from the capturing offensive commitment;
- the previous owner's Population Capacity falls by 1 because the cell was lost;
- the new owner's Population Capacity rises by 1 because the cell was gained.

The consumed defender is normally removed from Available Population. An explicit Origin trait may instead cause that automatic defender to **survive the territorial loss and remain/return Available**; that exception does not cancel the attacker's ordinary 1-Population capture casualty, the ownership change, or the Capacity transfer.

If a hostile-owned cell had zero automatic Population defense, its capture causes **no ordinary hostile cell-capture Population casualty** for either side. This zero-casualty rule does **not** make neutral expansion free: neutral settlement follows the separate explicit settlement-cost rule in §12.6.

Ordinary stalled/failed land pressure does not by itself create Population attrition. Population can still change without a cell changing owner through other explicit mechanics such as counter-response combat, nuclear strikes, neutral settlement, transport destruction, or other specifically defined effects.

Casualties are capped by the finite Population actually available/committed to the relevant combat; Population never becomes negative.

### 14.4 Multi-faction combat

FFA remains genuinely competitive among all non-team factions in the same local operational space.

Finite same-faction pressure is aggregated before resolution and is never duplicated once per opponent. If several hostile factions are valid claimants for one cell, local pressures are resolved from the same pre-state and the strongest successful claimant wins deterministically.

A cell still changes owner at most once that tick. For a defended capture, the ordinary one-for-one capture casualty pair applies only between the previous owner and the winning claimant, subject to any explicit defender-survival modifier above. Unsuccessful third-party claimants lose **no Population merely for contesting that same cell** and gain no territory from it.

Attackers on completely separate fronts do not magically fight one another merely because they share an enemy.

---

## 15. Retreat and deliberate territorial abandonment

Controllers must have an explicit primitive to deliberately relinquish owned territory rather than relying on withdrawal side effects.

Ending or reducing an offensive/counter commitment returns that Population to Available immediately on a successful controller decision. Deliberate territory relinquishment is a separate political/spatial action.

Exact inherited consequences for structures/units on deliberately abandoned territory remain integration-dependent.

---

## 16. Naval and amphibious Population

Transport ships carry explicitly committed Population.

While aboard a transport, carried Population:

- is not Available for automatic land defense;
- does not exert ordinary land pressure;
- may be lost if the transport is destroyed;
- becomes eligible to participate locally when a legal amphibious landing reaches its target.

A landing makes the coastal target operationally actionable; carried Population then joins the local offensive engagement rather than teleporting land pressure to a remote coast.

### 16.1 Transport embarkation FFY costs

The baseline Transport embarkation FFY cost is **0 FFY**. Explicit Origin/Echo/ruleset effects that add Transport cost compose as **additive embarkation-cost modifiers**, rather than competing absolute replacement prices.

For example, the accepted fortified-landing Origin trait adds `+250 FFY` and the existing Transport-cost drawback adds `+500 FFY`; if both are present, the Transport embarkation cost is `750 FFY`.

This additive model is the canonical combination-safe rule for those traits.

### 16.2 Fortified amphibious landing trait

An accepted Origin trait changes amphibious doctrine as follows:

- Transport embarkation costs **+250 FFY**;
- a Transport that successfully establishes its amphibious landing grants a **permanent level-1 Fort** at the landing location;
- a Transport destroyed/aborted before successfully establishing land ownership grants no Fort;
- the Fort is an ordinary spatial Fort after creation and may later be upgraded under the standard structure rules;
- because it is a granted structure rather than a purchase, it does not consume an unrelated `first Fort purchase is free` entitlement.

The coastal position naturally limits the value of the granted Fort because part of its normal coverage may lie over unusable water. No temporary pseudo-terrain or separate controller-only beachhead command is required.

---

## 17. Strategic weapons

Strategic weapons may target strategically meaningful geography, infrastructure, Cities, difficult terrain, fleets, transports, operations, and other physical objectives according to their specific rules.

They may also reduce Population without requiring defensive cell occupancy.

### 17.1 Missile Silo level gates

Missile Silos use the canonical five-level structure model in §18.

Weapon access is gated by the firing Silo's current level:

```text
Missile Silo level 1+ → Atom Bomb
Missile Silo level 3+ → Hydrogen Bomb
Missile Silo level 5  → MIRV
```

Higher Silo levels also increase launch-charge capacity under the normal Silo rules. A freshly built level-1 Silo therefore cannot immediately launch the strongest strategic weapon.

An Origin/Echo effect that grants a weapon for free does not bypass launcher legality. In particular, an effect granting one free MIRV still requires an otherwise legal **level-5** launcher and any ordinary non-price legality requirements. If that effect is defined as a purchase-cost waiver, the player must satisfy any authored affordability/precondition check but the successful granted launch/purchase consumes `0 FFY` as specified by the trait.

A starting Silo granted by an Origin begins at **level 1** unless the granting trait explicitly says otherwise.

### 17.2 MIRV power target

MIRVs remain intentionally frightening late-game strategic weapons, but they must not remain an almost deterministic `delete the current leader` button merely because a much smaller faction obtained one.

Open Fufu therefore uses **both** access and power controls:

- MIRV access requires a level-5 Missile Silo (or an explicitly equivalent legal launcher);
- inherited MIRV devastation is moderately reduced during balance translation.

The exact reduction is tuning work. The inherited implementation's very high warhead count should be retuned; a rough **250–300 warhead** test range is a reasonable provisional starting point rather than a canonical final number.

### 17.3 Warships that count as Missile Silos

Where an Origin trait grants Warships Missile-Silo capability, a Warship's **effective Missile Silo level equals its Warship rank/veterancy, with a minimum effective level of 1**.

This means an ordinary maximum-rank-3 nuclear Warship may reach Hydrogen-Bomb legality but not MIRV legality. If another legal trait raises maximum Warship rank by +2, a sufficiently veteran rank-5 Warship may become MIRV-capable.

Weapon price, range, charge/cooldown, and other ordinary legality still apply unless another explicit trait says otherwise.

### 17.4 Standard nuclear fallout

The standard nuclear terrain rule follows the useful inherited OpenFront political behavior while translating its Population semantics:

- each affected owned population-bearing land cell is immediately relinquished by its owner and becomes neutral;
- the former owner loses **1 current Total Population** for each such affected owned cell, capped so Population never becomes negative;
- because ownership is lost, the former owner's Population Capacity falls by 1 per affected population-bearing cell;
- the cell remains land, remains conquerable, remains part of conquerable territory, and remains population-bearing if later reconquered;
- the cell receives an explicit **fallout** terrain state/modifier that makes it substantially harder/slower to capture than ordinary plains without inventing Population defense.

A later faction that reconquers fallout land gains the normal +1 Population Capacity from owning that population-bearing cell but receives no free current Population; ordinary growth must refill Population.

Fallout therefore does not permanently reduce the denominator for 100%-of-conquerable-territory victory.

Exact fallout capture-resistance values and any other fallout side effects are tuning/translation work.

### 17.5 Optional water-nuke mode

Open Fufu retains the inherited **water-nukes** concept as an optional ruleset mode.

When enabled, affected land that would ordinarily become neutral fallout may instead be permanently converted to water according to the weapon/ruleset. Converted water is non-population-bearing and no longer ordinary conquerable land, so it is excluded from the current conquerable-territory denominator after conversion.

The same owned-cell Population casualty/Capacity-loss event still applies when the strike destroys the owner's population-bearing land. Segment identity remains immutable even when terrain is converted to water.

A City does not create extra Population casualties merely because it is a City; Cities modify growth, not Capacity/current-Population-per-cell semantics.

Physical units, transports, structures, fleets, and offensive forces actually affected by the weapon may take their own explicit local damage in addition to the terrain-linked Population rule.

Exact weapon radii, lethality against physical units, interception, and terrain-destruction values are tuning/translation work.

---

## 18. Terrain and structures

Terrain is strategically meaningful rather than cosmetic and may explicitly affect attack/capture efficiency, defensive pressure, movement/pathing, naval behavior, or future expansion rules.

Fallout is an explicit conquerable land state whose capture resistance applies even when the cell is neutral; it must not be implemented as phantom defensive Population.

### 18.1 Canonical persistent structures and five-level cap

Open Fufu's canonical V1 persistent structure concepts are:

- **City**;
- **Fort** — the public Open Fufu defensive structure concept adapted from inherited Defense Post infrastructure;
- **Port**;
- **Factory**;
- **Missile Silo**;
- **SAM Launcher**.

All six are upgradeable persistent structures with exactly **five legal levels, 1 through 5**. Level 5 is a hard maximum. Structures are built at level 1 unless an explicit surfaced rule says otherwise.

The inherited effectively unbounded generic-upgrade behavior is not authoritative for Open Fufu.

Each level must have deliberate mechanical meaning rather than existing only as an uncapped cost sink:

| Structure | Canonical level progression direction |
| --- | --- |
| **City** | higher level increases explicit Population Growth contribution; never Capacity |
| **Fort** | higher level increases both defensive-pressure effectiveness and Fort coverage area, with exact values tuned moderately |
| **Factory** | higher level increases Factory-driven industrial/train FFY event value |
| **Port** | higher level increases passive naval repair radius and passive repair rate; close/docked fast repair remains useful at all levels |
| **SAM Launcher** | higher level increases interception range and ordinary interception-charge capacity |
| **Missile Silo** | higher level increases launch-charge capacity and unlocks weapon tiers as specified in §17.1 |

Whether Port level additionally keeps/inherits a Trade-Ship frequency effect is deliberately left for naval/economy translation; the repair progression above is the canonical level identity.

No structure recreates hidden global Military Power.

### 18.2 Forts

Forts modify the effectiveness of actual one-Population automatic defenders inside their coverage; they do not create passive Population by themselves.

Upgrading a Fort increases **both** its coverage and defensive-pressure bonus. Exact level-by-level radii/pressure values are balance data. A level-5 Fort should be materially more important than a level-1 Fort without covering an absurd fraction of the map.

Origin/Echo modifiers may explicitly alter Fort coverage or defensive pressure and compose through surfaced rules.

### 18.3 SAM charges, range, and transformed shield behavior

Under ordinary rules, SAM level increases both interception range and charge capacity. The intended simple capacity direction is one available interception charge per level, subject to final cooldown/range tuning.

SAM target selection/interception remains an automatic structure behavior governed by ordinary legal targeting rules; controllers decide whether/where/how far to upgrade SAMs, not whether to execute a bespoke Origin-only `sacrifice shield now` action for every incoming weapon.

An accepted Origin trait transforms SAMs into a **giant single-charge shield**:

- interception range is increased substantially; **+50% is the provisional starting value**;
- the SAM has **exactly one interception charge regardless of level**;
- recharge cooldown is **2× ordinary** as the provisional starting value;
- upgrading still increases the underlying/rule-composed interception range but never adds charges.

Thus the transformed SAM trades throughput for a much larger defensive umbrella. The automatic targeting system remains responsible for choosing among legally interceptable weapons, so baiting a shield remains possible counterplay without permanently deleting the SAM.

### 18.4 Fully developed City purchase trait

An accepted Origin trait changes **purchased Cities only**:

- a City cannot be purchased at levels 1–4;
- each purchased City is created directly at **level 5**;
- its purchase price is **95% of the ordinary cumulative level-1 build price plus the ordinary level-2-through-level-5 upgrade prices**;
- the faction must satisfy the full discounted purchase-price requirement before construction may begin.

This is one direct City purchase, not four separate upgrade actions. Therefore a drawback that forbids spending FFY on upgrades does not by itself forbid this purchase.

A captured City below level 5 remains at its captured level and may be upgraded normally unless another rule prevents upgrades; the trait does not magically promote captured Cities.

If another effect makes the first City purchase free, the faction must still satisfy the authored full-price/precondition check if that effect is defined that way, but the successful purchase consumes `0 FFY`. This preserves the high early access threshold while allowing the free-purchase interaction.

---

## 19. Visibility and viewing

Knowing global geography/ownership is not the same as knowing hidden operational state.

### 19.1 Globally visible gameplay information

At minimum:

- static terrain/geography;
- coast/ocean/impassables;
- current territorial ownership;
- Segment definitions;
- broad faction shape;
- faction Total Population;
- Territory %;
- FFY;
- the faction's selected Origin and full mechanical Origin-trait sheet;
- active public mechanical modifier sheets/rule-bearing faction effects.

Mechanical modifiers should not need to be reverse-engineered from outcomes. Exact Echo dialogue/cosmetic presentation may be presented separately, but strategically relevant active modifiers are surfaced.

For Strategic Spawn, every participant's Origin, Initial Territory, starting-state effects, and other strategically relevant public spawn-affecting modifiers are visible before Phase 1.

### 19.2 Operational/local information

Detailed local information may depend on OperationalContact/visibility, including active enemy operations/pressure, counter-responses, mobile units, structures/defenses, and tactical modifiers where allowed.

Fixed teammates share the union of legally observable operational information. This prevents autonomous teammate controllers from being artificially less able to coordinate than humans who could simply relay legally observed information outside the game.

### 19.3 Private

At minimum: controller memory, unpublished source, intentions/plans, and unobservable strategic targeting/decision state.

### 19.4 No third-party live spectating

Ordinary users do **not** spectate unrelated third-party matches.

A player may view a match they are actually participating in, including their own PvE match, from the legal perspective available to that participant. Internal benchmark/certification/development tooling may use trusted omniscient observation where required.

The authoritative server enforces these information boundaries; browser-only hiding is insufficient. Derived queries/calculators must never leak hidden information that raw legal observations would withhold.

---

## 20. FFY economy and trade

FFY is the primary in-match currency and is **not** passive `Population → money per second` income.

It is generated through explicit world/economic events such as trade ship success/capture, trains/station economics, configured territorial/objective captures, piracy/capture, hostile structure capture, faction elimination, and future explicit economic events.

Population committed to warfare does not secretly reduce FFY through an unstated labor penalty.

Trade with enemies remains possible. Default wartime economic penalty direction is **50%**, subject to explicit modifiers.

### 20.1 Broad FFY modifier surfaces

For modifier design, FFY should expose a **small set of broad economic source families** rather than turning every individual FFY event into a separate build-stat axis. Exact final naming belongs to implementation, but the intended shape is roughly:

- generic/overall FFY;
- military/conquest FFY;
- naval/trade FFY;
- industrial FFY.

Individual events still retain their precise event identity internally for simulation, replay, and debugging. Origin/Echo modifiers normally target the broad economic family relevant to that event rather than a large catalogue of hyper-granular event-specific multipliers.

Explicit identity-defining rule exceptions may still exist as curated Origin traits. For example, an Origin may explicitly alter or remove the ordinary wartime trade penalty. Such exceptions are authored mechanics, not arbitrary player formulas.

The Origin and Echo catalogues should be curated so a narrow Echo does not trivially erase the defining drawback that makes an Origin strategically distinct. This is a catalogue-design responsibility, not a hidden Origin/Echo incompatibility rule.

---

## 21. Teams, hostility, defeat, capitulation, and victory

### 21.1 Teams and `atWar`

Team relationships are fixed pre-match. FFA has no formal mutable alliances and non-team factions remain legally attackable regardless of `atWar`.

`atWar` is a symmetric derived recent-hostility state, not a permission gate. Hostile land/amphibious/naval/territorial/strategic-weapon actions may establish or refresh it. Exact timeout is tuning data.

Fixed human-controller teams may use a small deterministic bounded **team signal channel** for controller-to-controller coordination. Signals contain bounded JSON-like data, become visible to teammates on a later deterministic decision boundary rather than creating same-tick ordering races, and do not grant additional hidden information.

### 21.2 Defeat at zero territory

After all simultaneous ownership changes for a simulation tick are resolved, a faction that owns **zero population-bearing territory is immediately defeated**, regardless of remaining Population, active operations, transports, fleets, or other recovery potential.

There is no dispossessed/comeback state.

On defeat, remaining controller activity and military commitments terminate according to deterministic cleanup rules. Exact inherited visual/unit cleanup details belong to integration work, but defeat itself is immediate and final.

### 21.3 Capitulation and resignation

Humans may resign. Official AI may capitulate according to its controller logic.

A resigned/capitulated faction becomes a **passive territorial remnant** rather than instantly neutralizing/gifting its land.

Upon resignation/capitulation:

- Population growth becomes permanently **0**;
- the controller becomes permanently inactive and issues no further decisions;
- active land offensive/counter-response commitments cease and their surviving Population becomes Available;
- all owned **mobile units are removed from the simulation immediately**, including warships, trade ships, trains, transport ships, and equivalent future independently mobile units;
- Population carried by a removed transport returns to the faction's Available Population rather than being killed;
- removed mobile units provide no FFY/resource refund;
- in-flight offensive projectiles/strategic weapons owned by that faction are cancelled/removed and do not later detonate or resolve offensively;
- owned territory and static structures remain in place;
- static **passive** effects may continue where their mechanic explicitly permits it, such as a Fort modifying an actual automatic defender;
- static **active** behaviors cease: the capitulated faction launches no missiles, performs no SAM firing, spawns no new trade ships/trains/units, and initiates no other autonomous strategic action;
- remaining Available Population continues automatic passive defense under the normal one-defender-per-threatened-cell rules;
- the territory may subsequently be conquered normally;
- the faction receives no new strategic actions of any kind.

This state intentionally leaves geography and surviving Population to be consumed by normal conquest while removing zombie mobile forces and post-capitulation offensive behavior.

### 21.4 Victory

FFA victory occurs when a faction controls 100% of conquerable territory or all other factions have resigned/capitulated/been defeated.

Team victory occurs when all non-team opposition is defeated/capitulated or the team collectively controls all conquerable territory.

If a human faction is eliminated earlier but their human team ultimately wins, that human still receives the team win and applicable team-PvE reward.

Team PvE is available only with multiple **human** players; AI teammates cannot create a solo team-progression farm.

---

## 22. Official PvE AI

Official PvE AI presets are creator-authored, not uploaded by ordinary players.

Official AI obeys the same gameplay rules as player controllers: same visibility, Population/FFY, Origins/Echoes, structures/units, legal actions, combat equations, and no hidden resource multipliers, omniscience, or teleportation.

Official AI factions select/bind Origins under the same game rules. Official Origins do not receive privileged hidden bonuses merely because they are creator-authored.

Trusted runtime execution is allowed operationally; difficulty comes from strategy quality. Reusable internal strategy components are encouraged but do not become privileged player-facing policies.

Reference personalities may include Tanya-style concentrated breakthrough, Reinhard-style economic/threat optimization, and Thorfinn-style retaliation/non-aggression.

---

## 23. Origins, Echoes, loadouts, rarity, and PvE progression

### 23.1 Origins

An **Origin** defines a faction's fundamental mechanical identity for the match. Exactly one Origin is selected for each faction before Strategic Spawn and remains immutable for that match.

Open Fufu supports:

- **Official Origins** authored/curated by the game creator; and
- **Custom Origins** assembled by players through the Origin creator.

Official and Custom Origins use the **same public trait catalogue, the same point accounting, the same trait-count limit, and the same drawback-refund rule**. Official Origins receive no hidden points, secret traits, invisible modifiers, privileged formulas, or creator-only gameplay exceptions.

An Official Origin is therefore a curated example of an interesting legal build from the same creator available to players, not a mechanically privileged faction class.

A Custom Origin is declarative/versioned data, not executable code. It contains a chosen set of server-defined trait identities plus presentation metadata such as a user-facing name/visual identity where supported.

Origins are fully mechanically public during the match and before Strategic Spawn.

### 23.2 Origin trait catalogue and creator

Origin traits come only from a **curated server-defined trait catalogue**. Players select traits supplied by the game; they do not supply formulas, scripts, callbacks, or arbitrary numeric parameters.

Each trait is one authored mechanical package with one authored point cost or drawback refund. Trait prices are deliberately hand-designed and later playtested rather than derived from a claim that every percentage point has a universally calculable value.

There are **no trait tiers**. If the catalogue contains a strong Initial Territory trait and a different milder trait, they are distinct authored traits rather than `Trait I / II / III` levels of one effect.

There is **no Major/Minor trait taxonomy**, no required trait categories, no hidden incompatibility families, and no combination-specific exclusion matrix. Mechanically transformative traits and simpler scalar traits are all simply Origin traits; their effect and authored cost communicate their significance.

Traits may modify explicit typed game-rule hooks, including structural profiles rather than only scalar percentages. Examples of legal design space include:

- increased Initial Territory paired with another drawback;
- a higher Starting Population percentage paired with weaker long-term growth;
- replacing the ordinary Population-utilization growth profile with a wider optimal band and harsher penalties outside it;
- stronger military/conquest FFY and weaker peaceful/general economy;
- stronger trade/naval FFY;
- an explicit Origin rule that changes/removes the normal wartime trade penalty;
- stronger automatic defensive pressure with weaker offensive pressure, or the reverse;
- other explicit surfaced rule transformations compatible with the canonical mechanics.

The player chooses only the curated trait. The underlying trait may alter several typed rules/parameters, but the player never provides the formula itself.

### 23.3 Simple public construction constraints

Custom Origin construction intentionally remains simple. The creator exposes only a small set of universal constraints:

1. a base **Origin Point** budget;
2. a maximum number of selected traits;
3. a maximum amount of additional spend that may be financed by negative-trait refunds.

Exact numerical values are tuning data.

Negative traits may finance stronger specialization, but their total refundable contribution is capped so a player cannot stack a large pile of irrelevant drawbacks to create an extreme positive budget. The small overall trait-count cap also keeps Origins readable and prevents giant modifier spreadsheets.

An Origin is not required to spend every point or fill every trait slot.

Balance is not required to make every trait mathematically identical by a universal metric. Small power differences are acceptable. The design goal is that every trait offers something meaningful, legal combinations remain sane, and different builds produce genuinely different controller problems/playstyles.

### 23.4 Every public-legal trait combination is legal

This is a hard design invariant:

> **If a trait exists in the deployed Origin catalogue, every combination of deployed traits that satisfies the published point budget, trait-count limit, and drawback-refund limit is a legal Origin.**

There are no hidden production compatibility checks and no runtime `trait A cannot be combined with trait B` escape hatch.

Production validation may reject only ordinary structural invalidity such as:

- an unknown/removed trait ID;
- a mismatched catalogue/version identity;
- exceeding the published Origin Point budget;
- exceeding the published trait-count limit;
- exceeding the published maximum drawback refund;
- malformed Origin data.

It must not reject an otherwise public-legal combination because development later discovered that two catalogue traits interact badly. If such an interaction exists, the catalogue is defective and must be fixed before deployment.

### 23.5 Exhaustive pre-deployment Origin-catalogue testing

Origin combination safety is a **development/deployment-gate responsibility**, not a gameplay restriction.

Because the trait catalogue and creator constraints are deterministic and the trait-count cap keeps the state space bounded, automated tests should enumerate **every legal trait combination** in each candidate catalogue version before that catalogue can ship.

The exhaustive suite should verify, at minimum:

- every public-legal combination constructs successfully;
- every combination serializes/hashes deterministically;
- no combination produces non-finite, negative, structurally invalid, or engine-unsafe rule values;
- Population growth profiles remain mathematically valid;
- offense/defense/counter-response hooks remain within deliberate engine-safe domains;
- FFY multipliers/rule exceptions remain valid;
- Initial Territory/Starting Population effects remain compatible with spawn/map invariants;
- structure-level transformations, launcher-equivalence rules, transport-cost stacking, and fractional settlement residuals remain valid under every legal combination;
- Origin + ruleset composition preserves canonical invariants;
- representative Origin + Echo composition does not violate engine invariants;
- every Official Origin is itself an ordinary legal combination from the same catalogue.

If any legal combination fails, the candidate catalogue/version **does not deploy**. The correct fix is to redesign/reprice/remove a trait or otherwise repair the catalogue/public budget, not add a secret combination restriction in production.

Property/fuzz tests may supplement this exhaustive suite, but they do not replace exhaustive enumeration of legal Origin combinations.

### 23.6 Origin versus Echo design space

Origins and Echoes intentionally overlap in the mechanics they can influence but serve different design roles.

Origins are few, defining, immutable-for-match faction traits and may change starting state, economic identity, growth profiles, combat tradeoffs, or other rule shapes.

Echoes are collectible anime-dialogue-line modifiers equipped in a multi-slot loadout. They should generally be narrower and more build-oriented. The Echo catalogue should be curated so ordinary Echo combinations do not trivially erase the defining drawback that gives an Origin its identity.

This separation is achieved by responsible catalogue design rather than hidden Origin/Echo incompatibility restrictions.

### 23.7 Echo catalogue

The collectible system formerly called **items** is canonically named **Echoes**.

An Echo is an anime/JRPG/gacha-flavored collectible represented by a dialogue line or equivalent character-flavor text and carrying one or two deterministic mechanical modifiers.

The game may contain a very large deterministic/versioned Echo catalogue. Each Echo has stable identity tied to an Echo seed/identity and generator/catalogue version, and intentionally duplicate complete mechanical signatures should be rejected.

Echoes may contain one or two modifiers, positive effects, drawbacks, mixed combinations, deterministic dialogue/flavor/visual identity, and a positive sampling weight.

Echoes must **not** modify Population Capacity / maximum Population per owned cell while Capacity remains exactly territory-derived.

Allowed Echo modifier families may include:

- Population growth;
- offensive pressure;
- defensive pressure;
- broad FFY/trade/economic multipliers;
- structures;
- naval/unit behavior;
- terrain interactions;
- explicit starting-state modifiers such as **Initial Territory**, which change starting owned-cell count rather than Capacity-per-cell;
- other explicit surfaced mechanics that do not undermine the intended Origin/Echo separation.

### 23.8 Modifier stacking and rule composition

For ordinary flat/percentage modifier calculations:

```text
final = (base + sum(flat)) × (1 + sum(percentage))
```

Percentage modifiers in the same calculation are additive before multiplication unless an explicit mechanic says otherwise.

Conceptually, effective rules compose from surfaced sources such as:

```text
ruleset base
→ Origin structural rules / modifiers
→ Echo modifiers
→ terrain / structures / situational effects
→ effective mechanic
```

This is not intended as a universal literal implementation ordering for every mechanic; explicit typed rule hooks define exact semantics. Structural Origin traits such as replacing a Population-growth profile operate through those explicit rule hooks rather than pretending to be ordinary percentage modifiers.

The public mechanical sheet should expose effective values and their relevant surfaced sources.

### 23.9 Echo sampling weights and rarity

Every normally droppable Echo has positive sampling weight:

```text
P(Echo) = EchoWeight / sum(eligibleWeights)
```

Lower weight means rarer. Conventional rarity tiers are not required. Power should influence rarity, while deterministic collectible/flavor variation may also influence weight.

Displayed inherent rarity is based on the normal global table, not a temporary filtered store table.

### 23.10 PvE rewards

A won configured PvE match awards independent Echo rolls determined by the configured opposing official AI presets. The player keeps the rarest result according to normal drop probability/weight.

AI contribution depends on being present in the won match, not personal kill credit.

For team PvE:

```text
perHumanRolls = max(1, ceil(soloEquivalentRolls / numberHumanPlayers))
```

Example for solo-equivalent 9:

```text
1 human → 9 rolls
2 humans → 5 each
3 humans → 3 each
```

### 23.11 Duplicate Echoes and gambling currency

Normal PvE drops may produce duplicate Echoes. A duplicate automatically converts into persistent gambling-store currency; there are no multiple owned copies and no required manual sale flow.

Every duplicate should fund at least one store attempt. The Echo store excludes already owned Echoes, renormalizes remaining eligible weights, preserves displayed inherent rarity, and uses currency separate from FFY.

The final thematic name of the duplicate/store currency remains presentation work.

### 23.12 Echo loadouts

Standard PvE Echo loadout size is **7 Echoes**. PvP progression/loadout standardization remains deliberately deferred.

### 23.13 Accepted first-catalogue mechanics from the current design pass

The following Origin mechanics are now accepted catalogue content. Final player-facing names/IDs and the global builder budget remain catalogue work; point values marked provisional remain subject to playtesting without reopening the mechanic itself.

#### Neutral settlement efficiency — provisional 5 points

Neutral settlement costs **0.5 Population per successfully acquired population-bearing neutral cell instead of 1**. Payment uses the faction-level persistent fractional residual from §10.5; ending/recreating expansion operations cannot erase the unpaid half.

#### Fortified amphibious landings — provisional 7 points

Transport embarkation receives a **+250 FFY** cost modifier and each successful amphibious landing grants a permanent level-1 Fort as defined in §16.2.

This modifier stacks additively with the existing `+500 FFY Transport embarkation cost` drawback, producing `750 FFY` when both are selected.

#### Elastic automatic defense — 10 points

When one of the faction's automatically defended population-bearing cells is captured, its one automatic defender **survives and remains/returns Available** instead of being killed.

The attacker still pays the ordinary 1-Population defended-capture casualty, ownership still transfers, and Capacity still transfers normally. The trait therefore lets the faction trade geography for enemy Population without receiving free territory or free defensive pressure.

#### Split strategic origin — 10 points

The faction uses **two spawn influence areas**, each with **50% of the normal influence area**, and chooses one exact origin inside each final area.

If the ordinary influence shape is circular, half the area corresponds to approximately `70.71%` of the ordinary radius; the trait halves **area**, not radius.

The faction's final Initial Territory quota is split approximately equally between two compact starting footprints around the two origins. Its total Starting Population remains **one unchanged global Population pool**; there are no local Population stores tied to the two blobs.

The two influence areas/origins may be far apart or close together. If footprints grow into one another they may merge normally. The split creates strategic risk through two borders/geographic problems rather than through an artificial Population penalty.

For deterministic placement of singular granted start-state structures/effects, the two origins are ordered as **primary** and **secondary** unless the granting effect defines another rule.

#### Giant single-charge SAM shield — provisional 6 points

SAM Launchers use the transformed shield behavior from §18.3: provisionally +50% range, exactly one charge at every level, and 2× ordinary recharge cooldown. Upgrades continue to improve range but never add charges. No bespoke controller interception command is introduced.

#### Fully developed City purchases — provisional 6 points

Purchased Cities follow §18.4: they can only be bought directly at level 5 for 95% of the ordinary cumulative level-1-through-level-5 cost. Captured lower-level Cities are not auto-promoted.

### 23.14 Accepted cross-trait interaction rules

Combination legality remains universal; these interactions are therefore part of the public rules rather than compatibility exceptions:

- Transport FFY-cost traits stack **additively** from the baseline 0-FFY embarkation cost.
- A granted fortified-landing Fort does not consume a separate `first Fort purchase free` entitlement.
- A free starting Missile Silo begins at **level 1** unless its granting trait explicitly changes level.
- A free-MIRV effect does **not** bypass the level-5 launcher requirement.
- A Warship granted Missile-Silo capability uses **Warship rank as effective Silo level, minimum 1**; a legal +2 maximum-rank modifier can therefore allow rank-5/MIRV-capable Warships.
- A direct level-5 City purchase is a **purchase**, not a sequence of upgrade expenditures, for interactions with traits that prohibit FFY spending on upgrades.
- A first-City-purchase-free effect may waive the final FFY consumption while retaining the fully developed City's authored purchase/precondition threshold where specified.
- Initial Territory bonuses apply to the faction's **final** Initial Territory total before the split-origin trait divides that total between its two footprints; they do not duplicate the bonus once per blob.

---

## 24. Match observability

Because programming is the gameplay, observability is first-class. The system should expose replay, controller decisions/logs within limits, action failures/rejections, CPU/runtime-budget information, Population/FFY/territory histories, operation/counter-response histories, and post-match summaries.

Headless accelerated testing uses the same logical game rules as live matches.

### 24.1 Controller debug annotations

Controller debugging is core V1 authoring infrastructure. A controller may emit bounded **private debug annotations** that do not affect simulation state, including concepts equivalent to:

- named scalar/string metrics;
- log messages;
- cell/region highlights;
- Segment highlights;
- operation/unit/structure annotations;
- labels or markers for controller-derived concepts.

These annotations are visible only to the controller owner through the browser/replay debugger and must obey explicit output/size/count limits. They must not create public gameplay information or become a simulation input.

---

## 24A. Controller API contract — Accepted V1 direction

The controller API is the primary gameplay language. Its design objective is:

> **Expose facts, legality, geometry, generic algorithms, deterministic rules, and mechanical arithmetic generously; expose strategic judgments and future-state oracles sparingly or not at all.**

Players should win through better strategy and abstractions, not because they reimplemented flood-fill, A*, legality checks, blast geometry, or published combat equations.

### 24A.1 One deterministic entry point and explicit memory

The normal runtime model is one controller `decide(context)`-style entry point operating on an immutable observation and explicit persistent `memory`. Exact TypeScript names remain API implementation work, but the conceptual context is equivalent to:

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

The API may use an official `defineController` helper or equivalent authoring wrapper, but that wrapper must not hide privileged strategy.

Faction observations expose public Origin identity/traits and effective mechanical modifier sheets. Controllers should not need to infer an opponent's Origin mechanics from outcomes.

### 24A.2 Persistent directives versus one-shot commands

The contract distinguishes:

- **persistent directives**, which remain active until changed, completed, invalidated, or explicitly ended; and
- **one-shot commands**, which are attempted once in the current transaction.

Persistent examples include offensive operations, neutral expansion, counter-responses, defense-priority policy, and ongoing unit movement/patrol/targeting.

One-shot examples include building/upgrading a structure, launching a strategic weapon, deliberate territorial relinquishment, team signaling, and capitulation.

Omitting an existing persistent directive from a later controller invocation does **not** implicitly cancel it.

### 24A.3 Controller-owned directive keys

Controllers may assign bounded stable string keys to their own persistent directives so ordinary code can update an operation without maintaining a fragile engine-generated ID solely for ownership bookkeeping.

The engine still maintains immutable internal operation IDs for observation, replay, incoming enemy-operation references, and deterministic identity.

### 24A.4 Population updates are explicit set-now changes

When a controller changes an operation to `N` committed Population, that decision sets the operation's current commitment to `N` immediately if valid. Combat casualties may later reduce it below `N`; the engine does **not** automatically refill the operation back to a desired target.

Replenishment requires a later explicit controller decision. This preserves instant commitment without reintroducing desired/actual Deployment machinery.

### 24A.5 Geographic data and selectors

The API should make raw strategic geography available without requiring computational-geometry boilerplate.

At minimum, legal cell facts include concepts equivalent to:

- stable cell ID and coordinates;
- terrain;
- Segment identity;
- ownership;
- fallout;
- population-bearing/conquerable/impassable/coast/shoreline facts;
- legally visible structures or tactical state where permitted.

The API should provide **serializable declarative selectors/regions** that can be composed from strategy-neutral mechanical predicates such as:

- explicit IDs;
- owner;
- Segment;
- terrain/fallout;
- coast/shoreline;
- conquerable/population-bearing state;
- simple geometric areas;
- unions/intersections/differences;
- legally visible structure/unit sets where appropriate.

Persistent simulation directives consume compiled/bounded selector data, not arbitrary user JavaScript callbacks executed by the 10 Hz simulation loop.

### 24A.6 Generic geographic queries are quality-of-life, not strategy

The engine/SDK should provide bounded deterministic factual operations equivalent to:

- neighbor/adjacency queries;
- boundary extraction;
- connected components/flood-fill;
- ordinary distance queries;
- generic land/naval/rail reachability and pathfinding;
- nearest/reachable queries;
- Segment/owner/terrain histograms and summaries;
- legal structure sites;
- legal transport/coast destinations;
- other generic geometry/legality calculations.

These do **not** include strategic judgments such as `weakestPoint`, `bestTarget`, `bestNukeTarget`, `optimalAttackPopulation`, `safestTradeRoute`, or `biggestThreat`.

Advanced controllers may request bounded batch/materialized cell data for custom analysis, but materialization/output limits are explicit and deterministic. The API should not encourage object-per-cell scans of the entire map every decision.

### 24A.7 Segments and Contacts are first-class

Segments must be convenient enough that a competent controller can remain mostly Segment-level. Segment observations should expose factual summaries such as cell/terrain counts, ownership shares, adjacency, coast/fallout counts, and selectors for their cells.

Territorial Contacts are also first-class factual adjacency geometry. The API may expose contact size, disconnected components, involved Segments, terrain composition, and boundary selectors.

It must not expose a canonical strategic `Front`, `weakest contact`, `best breakthrough`, or similar policy judgment.

### 24A.8 Offensive spatial control has selection and weighting

Land operations conceptually expose two distinct strategy-neutral spatial controls:

1. **engagement priority** — which legal candidate lanes/cells are selected when committed Population cannot engage the whole candidate frontage; and
2. **pressure weighting** — how finite committed Population is distributed across the engaged geometry.

Both receive deterministic defaults so simple attacks need specify neither. Advanced controllers may express bounded rules over selectors/regions rather than enormous per-cell maps.

### 24A.9 Defense exposes priorities, not quantities

The defense API exposes only priorities/weights deciding **which threatened cells receive scarce one-Population automatic defenders**.

It cannot directly choose defensive Population quantities, stack multiple passive defenders on one cell, or arbitrarily divert the automatic contact-surface apportionment toward a chosen enemy.

Explicit counter-responses are the mechanism for deliberately spending extra Population against an incoming operation.

### 24A.10 Counter-response API remains simple

A controller counter-response identifies an incoming operation and commits Population to it. The nonlinear exchange math remains an engine rule; controllers are not required to reproduce it merely to use the mechanic.

### 24A.11 Public rules and pure mechanics calculators

The API exposes the current match's actual rule-bearing constants/feature flags and **pure deterministic mechanical calculators** for published arithmetic/geometry, such as concepts equivalent to:

- Population growth arithmetic, including the faction's Origin-defined growth profile;
- neutral-settlement progress and effective Population cost, including fractional residual semantics;
- capture-advantage arithmetic;
- counter-response exchange arithmetic;
- structure/unit/weapon costs, level gates, and legality;
- weapon blast/range geometry;
- explicit terrain/structure/Origin/Echo modifiers.

These calculators operate only on supplied/legal information and must not leak hidden canonical state.

Do **not** provide future-state strategic simulators/search oracles such as `simulateNextMinute`, `expectedWinner`, `bestAttack`, or `optimalCounterSize`.

### 24A.12 Public structures, units, and weapons follow game concepts

The public API should expose distinct game-level structure/unit/weapon concepts even if inherited engine internals share one implementation class.

Own objects expose the state needed to control them; enemy objects expose only legally observable state.

Movement and routing APIs are intent-oriented: controllers choose destination/patrol/target and the engine performs ordinary pathfinding/mechanical movement.

Structure observations/legality expose the canonical level range `1..5`, effective level-dependent mechanics, and any surfaced Origin transformations such as single-charge SAMs or direct level-5 City purchases.

### 24A.13 Corresponding legality queries

Major player actions should have factual legality/cost helpers where useful. A player should be able to ask whether/where a structure can be built, whether a weapon is in range, whether a coast is reachable, what an upgrade costs, what Transport embarkation costs after modifiers, or which launcher level a weapon requires without attempting actions blindly.

These helpers answer **what is legal**, not **what is strategically best**.

### 24A.14 Events since the previous decision

Controllers receive a bounded typed event stream covering legally observable meaningful changes since the previous controller invocation, such as territory changes, Population losses, neutral-settlement costs, operation lifecycle events, structure completion/destruction/level changes, unit changes, FFY events, hostility changes, faction defeat/capitulation, amphibious Fort creation, and strategic-weapon events.

This is quality-of-life so every controller does not need to diff the entire world snapshot manually. Persistent long-term interpretation remains controller strategy/memory.

### 24A.15 Decision receipts and directive lifecycle

`lastDecision` or equivalent exposes structured transaction status and per-command/rejection metadata. Ordinary gameplay failures are data rather than exceptions.

Persistent directives expose deterministic lifecycle/status such as active, blocked/no-actionable-geometry, completed, target-defeated, or otherwise invalidated. Obviously dead directives are garbage-collected by the engine and surviving committed Population returns according to ordinary rules; controllers are not required to manually collect stale engine records.

### 24A.16 Deterministic randomness

Randomized controller strategy is allowed through deterministic match-bound randomness. `Math.random()` may be replaced/seeded deterministically inside the sandbox, and the API should also provide **keyed deterministic randomness** so unrelated random calls do not perturb every later strategic choice.

No uncontrolled entropy or real system clock is exposed.

### 24A.17 Runtime/controller limits are public

Deterministic structural limits such as operation count, command count, selector/policy-rule count, materialized-cell/query limits, memory and debug/log budgets are visible to the controller/API documentation.

Controllers must not branch on nondeterministic wall-clock CPU time remaining. Human diagnostics may report CPU/runtime usage separately.

### 24A.18 Team coordination

Fixed teammates share legal operational observations as defined above and may exchange small bounded deterministic JSON-like team signals. Team signals are delayed to a deterministic later decision boundary so same-tick execution order does not matter.

There is no unrestricted shared mutable controller memory.

### 24A.19 SDK convenience versus strategy

The official SDK may provide pure helpers/builders for selectors, priorities, deterministic math, common collection manipulation, percentages/ratios, and other neutral ergonomics.

It should not ship privileged strategy functions such as `pickWeakestEnemy`, `turtle`, `blitz`, `bestNukeTarget`, or equivalent doctrine. Players may freely build those abstractions themselves.

### 24A.20 Three-phase strategic spawning

Ordinary Open Fufu games should generally use a **three-phase strategic spawn protocol**. Random and fixed spawn modes remain supported alternatives.

The normal strategic protocol is:

```text
STATIC MAP / MATCH CONFIG
        ↓
PHASE 1 — initial broad influence choice
        ↓
all Phase-1 influence areas are revealed
        ↓
PHASE 2 — optional simultaneous reconsideration
        ↓
all final influence areas are revealed
        ↓
PHASE 3 — exact spawn-origin choice inside final influence area
        ↓
exact origins resolve simultaneously and are revealed
        ↓
initial territory footprints are generated
        ↓
MATCH STARTS
```

#### Phase 1 — initial broad influence choice

Each participant receives the static map, Segments, ruleset/lobby constraints, legal spawn-space information, **every participant's surfaced Origin, Initial Territory value, Starting Population effects, and any other strategically relevant public spawn-affecting modifiers**, and other pre-match public facts. Each simultaneously chooses a broad **spawn influence area** or its anchor using a ruleset-defined shape/scale.

Influence areas are **not exclusive claims or territory**. They are legal search spaces for the later exact spawn origin, and they are allowed—indeed expected—to overlap with other participants' influence areas.

After every Phase-1 choice resolves, all participants see every participant's Phase-1 influence area.

The accepted **split strategic origin** trait changes this participant-specific profile from one ordinary influence area to **two influence areas, each 50% of ordinary area**. Both Phase-1 areas are submitted simultaneously and both are revealed with the rest of the Phase-1 set. If the shape is circular, each split area's radius is approximately 70.71% of ordinary radius.

#### Phase 2 — optional reconsideration

Each participant gets exactly one simultaneous chance to keep or change their broad influence choice using the newly revealed information about everyone else's Phase-1 intent.

Participants do **not** see other Phase-2 revisions while choosing their own. After Phase 2 locks, all final influence areas are revealed together. There is no endless counter-picking loop.

This second broad-choice round exists specifically so one unlucky or poorly informed initial preference does not feel like an irreversible pre-match mistake.

A split-origin faction likewise keeps/revises its **pair** of influence areas simultaneously; it does not receive extra sequential reaction rounds.

#### Phase 3 — exact spawn origin

Each ordinary participant simultaneously chooses an exact legal **spawn origin cell** inside their final influence area while knowing all final influence areas.

A split-origin faction instead chooses **one exact legal origin in each of its two final influence areas**, submitted simultaneously. The two origins may be near each other or far apart and are not forced into different map regions merely to make the trait dramatic.

Exact-origin conflicts/collisions are resolved deterministically from the simultaneous submissions. All final exact origins are then revealed before the first normal simulation decision, consistent with globally visible territorial ownership once the match begins.

The controller chooses origin cells, not arbitrary hand-painted starting territory.

### 24A.21 Initial Territory and starting footprint

Each faction has a surfaced **Initial Territory** starting-state value equal to the target number of population-bearing cells it should own when the match begins.

The ruleset provides the ordinary base value. Explicit Origin traits, Echoes, or other surfaced starting-state modifiers may change that value in modes where such modifiers are allowed.

After exact spawn origins resolve, the engine deterministically paints a **compact, connected, roughly circular starting footprint** outward from each ordinary origin using nearby legal population-bearing cells.

For a split-origin faction, compute its **final Initial Territory value after all ordinary modifiers**, then divide that quota approximately equally between the two origins and grow two compact footprints simultaneously with every other faction's footprint. A one-cell remainder uses a deterministic primary/secondary rule. The two footprints may later meet/merge.

Important rules:

- broad spawn influence areas do not reserve cells and overlap between influence areas does not itself reduce anyone's Initial Territory;
- competing starting footprints are resolved simultaneously rather than by player/controller execution order;
- when the legal map topology can support it, footprint resolution continues outward as necessary so each faction receives its full Initial Territory count even when nearby footprints compete for cells;
- the footprint algorithm must remain deterministic, versioned, and independent of controller execution timing;
- the final number of owned population-bearing cells becomes the faction's ordinary starting Population Capacity under the existing `1 owned cell = 1 Capacity` rule;
- an Initial Territory bonus does **not** change the Capacity value of individual cells and is not duplicated once per split-origin footprint;
- starting **current Population** is a separate ruleset quantity and is not implicitly required to equal Initial Territory unless a later explicit rule chooses that relationship;
- a split-origin faction still has the **same one global Starting Population pool** it would otherwise have; Starting Population is not divided into local stores;
- an Origin/Echo may explicitly modify starting Population as a percentage or other surfaced starting-state rule without changing Capacity-per-cell;
- Initial Territory does not automatically enlarge the broad spawn-influence radius unless an explicit future modifier says so.

For deterministic singular start-state grants on a split-origin faction, origins are ordered primary/secondary and the grant uses the primary origin unless the grant defines a different public rule.

Exact compact-growth geometry, tie-breaking, minimum legal origin separation, fallback movement of colliding origins, influence-area radius/shape, and numeric Initial Territory/Starting Population values are implementation/tuning details so long as the invariants above hold.

### 24A.22 Spawn modes and controller lifecycle

Open Fufu supports at least:

- **Strategic Spawn** — the three-phase protocol above and the ordinary preferred mode;
- **Random Spawn** — deterministic match-seeded legal placement that bypasses controller strategic spawn choices;
- **Fixed Spawn** — exact configured starts for benchmarks, certification, debugging, tournaments/scenarios, and reproducible tests.

Strategic-spawn controller hooks are specialized **pre-match lifecycle hooks**, separate from the normal `decide()` loop. Exact TypeScript names are implementation work, but the conceptual phases correspond to initial influence choice, optional reconsideration, and exact-origin choice.

The spawn API must represent the faction's effective public **spawn profile**: ordinary factions submit one area/origin while a split-origin faction submits the required pair through the same phase semantics. This must not require a second controller program or an out-of-band manual action.

A controller is not required to implement spawn-specific logic. Missing, malformed, rejected, or failed spawn-hook output falls back to a deterministic legal default policy appropriate to that faction's spawn profile rather than faulting the controller for the match.

---

## 25. Deliberately deferred or implementation-level systems

The following remain intentionally outside the settled design contract unless otherwise stated above:

- exact final TypeScript API names/types and ergonomic naming after prototype pressure-testing, including spawn-hook names/types;
- exact Origin Point budget, trait-count cap, maximum drawback refund, final player-facing names/IDs, and final balancing of provisional Origin-trait point costs;
- exact first Official Origin names/builds;
- exact strategic-spawn ordinary influence radius/shape, exact-origin collision resolver, compact-footprint growth/tie-breaking algorithm, and base Initial Territory/starting-Population values, including low-level implementation details for the accepted split-origin profile;
- exact sandbox hardening/resource-budget values;
- exact SQLite schema and retention policy;
- exact wire protocol/session encoding;
- exact deterministic memory codec;
- exact controller query/materialization/debug-output limits;
- exact capture-progress coefficients;
- exact Population-growth coefficients/interpolation;
- exact counter-response casualty/rate coefficients;
- exact Segment size heuristics;
- exact terrain/fallout values;
- exact FFY payouts and final broad FFY-source naming;
- exact AI reward values;
- exact level-by-level structure costs/radii/multipliers/cooldowns beyond the settled five-level semantics;
- exact MIRV nerf values/warhead count beyond the settled level-5 access gate and moderate-power-reduction direction;
- exact inherited naval/rail/strategic-weapon numerical translations where not specified;
- detailed lobby/UI experience;
- final thematic name of Echo duplicate/store currency;
- supply/logistics connectivity as a separate system.

Supply is explicitly deferred from V1. Do not introduce hidden supply roots, path-distance logistics, or supply penalties under another name.

---

## 26. Canonical invariants summary

1. **The server owns the match.** Browsers are not simulation authorities.
2. **The controller may fail; the match must continue deterministically.**
3. **Controllers receive deterministic immutable observations and explicit persistent per-match memory.**
4. **The public controller API exposes legal observations and declarative directives/commands, not mutable engine internals.**
5. **Generic geometry, pathfinding, connected-components, legality, and published formula calculation are quality-of-life primitives; strategic recommendations/oracles are not.**
6. **Persistent directives survive omitted future decisions; one-shot commands do not.**
7. **Controller decisions validate as a transaction/final desired set rather than source-order simulation mutations.**
8. **Cells are the physical territorial resolution; Segments are immutable strategic lenses.**
9. **Every real map cell belongs to exactly one Segment.**
10. **Population is one global whole-integer faction resource; explicit fractional mechanic costs use deterministic hidden residuals rather than fractional public allocations.**
11. **Population Capacity equals owned population-bearing cells exactly.**
12. **Initial Territory may change starting owned-cell count but never changes the one-Capacity-per-owned-cell rule.**
13. **There is no persistent defensive cell Population allocation.**
14. **Automatic defense is binary per threatened owned cell: 0 or 1 Population, never more than 1.**
15. **Available Population limits how many threatened cells may receive that one automatic defender; surplus Population does not stack passive defense.**
16. **Controller defensive priorities choose which scarce threatened cells are defended, not raw defensive Population quantities.**
17. **Counter-responses spend committed Population to fight an incoming operation's committed Population directly; they do not reinforce passive cell defense.**
18. **Offensive Population is committed instantly to sparse operations with spatial intent.**
19. **An operation's engaged frontage cannot exceed its committed Population.**
20. **One faction's source cell attacks at most one adjacent target cell per tick, and same-faction pressure is never duplicated.**
21. **A cell changes political owner at most once per tick; new captures do not chain within that same tick.**
22. **Baseline neutral settlement takes capture progress/time and costs one Population from the expansion commitment per successfully acquired population-bearing neutral cell.**
23. **Neutral territory has no phantom automatic Population defender; fractional settlement modifiers use faction-level persistent residual accounting.**
24. **Ordinary hostile defended-cell capture costs one Population to the previous owner and one to the winning attacker, unless an explicit defender-survival trait preserves the automatic defender; the attacker's casualty remains.**
25. **Hostile undefended territorial capture causes no ordinary capture-coupled Population casualty; this does not waive neutral-settlement cost.**
26. **An unsuccessful third-party claimant on the same contested cell takes no capture-coupled casualty merely for contesting it.**
27. **Other explicit mechanics such as counter-responses, nukes, neutral settlement, and transport destruction may reduce Population without ordinary hostile defended-cell capture.**
28. **Standard nuclear strikes neutralize affected owned land, cause one current-Population loss per affected owned population-bearing cell, and leave conquerable population-bearing fallout terrain.**
29. **Fallout changes capture resistance, not automatic defensive Population, and remains in the conquerable-territory denominator.**
30. **Optional water-nuke rules may convert land to non-population-bearing water and thereby remove it from the conquerable-territory denominator.**
31. **Terrain/structures/Origins/Echoes affect mechanics only through explicit surfaced rules.**
32. **The six canonical V1 persistent structures—City, Fort, Port, Factory, Missile Silo, SAM Launcher—are upgradeable from level 1 through a hard maximum of level 5.**
33. **City levels increase Growth, Fort levels increase defense/coverage, Factory levels increase industrial FFY events, Port levels increase repair capability, SAM levels increase normal range/charges, and Silo levels increase charges/weapon access.**
34. **Missile Silo level 1 unlocks Atom Bomb, level 3 unlocks Hydrogen Bomb, and level 5 unlocks MIRV. Free/granted weapons do not bypass launcher legality.**
35. **MIRVs remain powerful but receive a moderate inherited-power reduction in addition to the level-5 access gate.**
36. **Where a Warship is granted Missile-Silo capability, its effective Silo level equals Warship rank with a minimum of 1.**
37. **Transport embarkation begins at 0 FFY and explicit Transport-cost trait modifiers stack additively.**
38. **The accepted fortified-landing trait adds +250 FFY and grants a permanent level-1 Fort only after a successful landing.**
39. **Every faction binds exactly one immutable Origin for a match.**
40. **Official Origins and Custom Origins obey the same public Origin-builder rules and use the same deployed trait catalogue.**
41. **Origin traits are curated server-defined packages with authored costs; players never supply Origin formulas or arbitrary trait code.**
42. **Origins have no tiers, Major/Minor taxonomy, category maze, or hidden pairwise incompatibility system.**
43. **Every deployed trait combination satisfying the public budget, trait-count, and drawback-refund limits is legal.**
44. **Every candidate Origin catalogue is exhaustively tested across all public-legal trait combinations before deployment; a failing combination blocks/fixes the catalogue rather than becoming a production exclusion.**
45. **The accepted split-origin trait uses two half-area influence regions and two exact origins, splits final Initial Territory between two footprints, and still uses one unchanged global Starting Population pool.**
46. **The accepted elastic-defense trait preserves the automatic defender when a defended cell is captured while retaining the attacker's ordinary casualty and all ownership/Capacity effects.**
47. **The accepted giant-SAM trait transforms SAM throughput/range without adding a bespoke controller interception action.**
48. **The accepted fully-developed-City trait makes purchased Cities direct level-5 purchases at 95% cumulative ordinary level-1-through-level-5 cost.**
49. **Echoes are the canonical collectible dialogue-line modifier system; standard PvE loadouts contain 7 Echoes.**
50. **Origins define faction identity while Echoes provide narrower collectible specialization; catalogue curation, not hidden compatibility rules, preserves meaningful tradeoffs.**
51. **Strategically relevant active mechanical modifiers, Origins, and Origin trait sheets are publicly surfaced.**
52. **Derived controller helpers never leak information outside the controller's legal observation projection.**
53. **Fixed teammates share legal operational observations and may exchange bounded deterministic delayed team signals.**
54. **Controller debugging/visual annotations are private, bounded, deterministic output and never simulation input.**
55. **FFY is event-driven, not passive Population taxation, and build-facing FFY modifiers prefer broad source families over hyper-granular event-specific knobs.**
56. **FFA is truly competitive among non-team factions; fixed teams are the only formal alliance relationship.**
57. **Zero population-bearing territory after tick resolution means immediate defeat.**
58. **Capitulated/resigned factions stop growth and decision-making, remove mobile/offensive active behavior, but retain territory and surviving passive Population defense until conquered.**
59. **Official AI obeys the same gameplay information and mechanics as player controllers.**
60. **Ordinary users cannot live-spectate unrelated matches.**
61. **Historical matches bind exact rule-bearing versions.**
62. **Ordinary Strategic Spawn uses two simultaneous broad-choice rounds with a reveal between them, followed by simultaneous exact-origin choice; broad influence areas may overlap and are not territorial reservations.**
63. **A public spawn-profile modifier may change one ordinary area/origin into the accepted two-half-area/two-origin profile without changing the phase/reveal fairness model.**
64. **Initial territory is generated deterministically as compact footprint(s) around the exact spawn origin(s) and should preserve each faction's legal Initial Territory quota whenever the map can support it.**
65. **Random and Fixed spawn modes remain supported alongside Strategic Spawn.**
66. **One canonical design document governs the target; one canonical integration plan governs the migration.**
