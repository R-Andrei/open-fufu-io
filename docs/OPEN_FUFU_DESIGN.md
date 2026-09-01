# Open Fufu — Consolidated Design Contract

## Status

This document is the **consolidated Open Fufu target-design contract**.

It is the first full rewrite that combines the latest accepted decisions from the earlier provisional design documents into one coherent specification.

During this consolidation review, the older Open Fufu design/decision documents remain present only as temporary source material. Once this document has been reviewed for omissions and contradictions and is explicitly accepted as complete enough, it should become the **single canonical Open Fufu design source of truth**, and the provisional Open Fufu design documents should be deleted rather than retained as a precedence chain.

This document defines **what Open Fufu is intended to be**. It is not the OpenFront compatibility/migration plan. A separate compatibility audit will later compare the existing fork against this design and produce one integration/migration plan.

Where this document distinguishes between **design rules**, **provisional tuning values**, **implementation choices**, and **deliberately deferred systems**, those distinctions are intentional.

---

## 1. Product identity

Open Fufu is a browser-viewable territorial strategy game/autobattler in which the player **programs the battler**.

The player does not normally issue moment-to-moment commands during a match. Instead, before the match the player selects:

- an immutable version of their faction controller;
- a PvE item loadout where applicable;
- the lobby/game configuration.

Once the match begins, the controller governs the faction.

The controller is expected to be able to reason about and control areas such as:

- neutral expansion;
- target selection;
- spatial population allocation;
- attack concentration and geometry;
- defense;
- retreat/controlled abandonment;
- economy;
- construction and upgrades;
- unit/naval operations;
- threat assessment;
- fixed-team/FFA relationships;
- persistent in-match strategic state.

The game should reward **programming and strategy**, not manual reaction speed.

Open Fufu is primarily designed around PvE, with PvP as a separate optional mode.

Normal matches should remain understandable as territorial strategy rather than becoming a pure optimization benchmark detached from geography.

### 1.1 Match-duration target

Match duration is a practical pacing target rather than a hard rule.

A broad range of roughly **15 minutes to 2 hours** is acceptable, with ordinary games preferably finishing in under an hour. Exact pacing is balance work.

---

## 2. Relationship to OpenFront and Foof

Open Fufu is a fork of OpenFront and may reuse substantial inherited infrastructure, but OpenFront is a technical starting point rather than a ruleset or architecture that Open Fufu must preserve.

The project is expected to diverge substantially in areas including:

- player input;
- simulation authority;
- territorial expansion;
- combat;
- force/population allocation;
- AI architecture;
- persistence and progression;
- match orchestration.

Useful inherited systems should be retained where they fit the target design. Existing behavior is not authoritative merely because it already exists.

### 2.1 Foof boundary

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
   `- browser viewer/editor
```

Foof may own Discord-facing concerns such as:

- commands;
- identity handoff;
- lobby/match initiation;
- controller/loadout selection through Discord where useful;
- links into browser surfaces;
- result/reward presentation.

Foof must not:

- import simulation internals as its own game logic;
- execute player controller code;
- manipulate Open Fufu persistence directly as a substitute for the game API.

Open Fufu should remain independently coherent if Foof is absent.

### 2.2 Licensing/attribution

The fork must preserve applicable OpenFront licensing and attribution obligations. Exact compliance steps are part of the later compatibility/integration audit, but the target architecture must not assume inherited derivative game code can be hidden inside the private Foof repository.

---

## 3. Authoritative simulation architecture

Open Fufu requires a **canonical authoritative simulation running on the server/Fufubox**.

A browser must not be required for the match to progress.

Conceptually:

```text
                  Open Fufu server
                         |
              authoritative simulation
                         |
          +--------------+--------------+
          |              |              |
 player controller   player controller   PvE AI
          |              |              |
          +------- decisions/actions ----+
                         |
                      next state
                         |
                  canonical match state
                         |
              browser / Foof observers
```

This architecture must support:

- unattended matches;
- headless simulations;
- accelerated simulations;
- controller certification/testing;
- tournaments/batch runs;
- deterministic replay/analysis;
- browser disconnects without match interruption.

The browser is primarily a viewer/editor/debugging surface, not the authority for the world state.

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
- controller decision logs;
- controller debug logs where allowed;
- action/rejection/failure history;
- Population/FFY/territory histories;
- relevant spatial/contact histories;
- controller resource-budget information;
- post-match summaries.

---

## 5. Controller language and authoring model

### 5.1 V1 language

The V1 controller language is **TypeScript**, with ordinary JavaScript-style code naturally usable.

The goal is a low entry floor with optional strong typing/autocomplete for advanced users.

Alternate languages may be considered later if real demand exists; they are not a V1 requirement.

### 5.2 Controller presets and immutable versions

Players may maintain multiple controller presets/strategies.

Drafts may be edited repeatedly. Published controller versions are immutable.

A match binds the exact published controller version selected at match start.

### 5.3 Primitive-oriented API philosophy

The controller API should expose **small, composable, strategy-neutral primitives**.

The engine should not provide privileged strategic policies such as:

- `blitzkrieg()`;
- `turtle()`;
- `weakestPointPolicy()`;
- `threatWeightedStrategy()`.

Those are player strategy.

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
runtime / lastDecision
```

The conceptual write/action surface includes low-level legal operations such as:

- desired Population allocation/spatial weighting;
- deliberate territory relinquishment/retreat;
- construction;
- upgrades;
- unit creation;
- unit movement/targeting;
- naval/amphibious operations;
- strategic weapon use;
- surrender/capitulation where applicable.

Exact names and TypeScript types are API-design work.

### 5.4 Starter controller

Every player begins with one **minimal complete working controller**.

The starter controller should demonstrate lawful/basic use of the major mechanics while being intentionally strategically unsophisticated. It may:

- expand monotonously;
- distribute Population approximately evenly;
- build/upgrade in a simple even pattern;
- use ordinary available mechanics;
- avoid sophisticated doctrine, prediction, threat analysis, or policy systems.

It should function correctly but should not reliably win serious matches.

Documentation may contain examples/snippets, but the product should not substitute a large privileged built-in strategy library for player programming.

---

## 6. Controller invocation contract

### 6.1 Immutable observation snapshots

Each controller invocation receives one immutable deterministic observation snapshot corresponding to a specific authoritative simulation state.

The simulation does not advance underneath the controller while that invocation is executing.

Repeated reads during one invocation therefore see the same world.

Returned collection ordering and other observable iteration behavior must be deterministic.

### 6.2 Provisional simulation/controller cadence

Current provisional starting values:

```text
Authoritative simulation: 10 ticks/second
Controller decision cadence: every 5 simulation ticks
Controller decisions: 2/second
```

These are **provisional tuning values**, not sacred design constants.

The important architectural rules are:

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
number
string
arrays
plain structured objects
```

Controllers must not rely on mutable module/global runtime state surviving between invocations. The sandbox may recreate the execution environment; only the explicit memory contract is guaranteed writable persistence.

Current provisional memory limit: **128 KiB serialized per faction per match**.

Cross-match improvement belongs in controller source/version changes, not secret writable learning state.

---

## 7. Controller certification, safety, and failure handling

### 7.1 Mandatory certification before publication

Broken/incomplete drafts may be saved.

Only controller versions that pass mandatory certification may be published/used in real matches.

Conceptually:

```text
Edit
 -> save draft
 -> certification
 -> PASS
 -> publish immutable version
 -> eligible for matches
```

Certification should use the real production controller contract/runtime constraints and rapidly exercise representative legal situations including:

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
- invalid outputs/API arguments;
- timeout/memory/output limits.

The certification/benchmarking pipeline should make a first-turn runtime failure extremely unlikely in ordinary use, but certification is not a mathematical proof that arbitrary user code can never fail in every possible future state.

### 7.2 Controller execution is transactional

Each invocation is all-or-nothing over:

- controller memory mutations;
- proposed directives;
- proposed game actions.

Conceptually:

```text
canonical memory + snapshot
        |
     execute
        |
temporary memory + proposed decision
        |
     validate
      /    \
   pass    fail
    |       |
 commit   discard
```

No partial decision cycle is applied.

### 7.3 Ordinary gameplay failure is structured, not exceptional

Lawful API use should normally produce structured game results/rejections when the world prevents an action.

Examples:

```text
INVALID_TARGET
INSUFFICIENT_FFY
NO_LONGER_OWNED
OUT_OF_RANGE
TARGET_DESTROYED
ALLOCATION_LIMIT
...
```

Ordinary dynamic game-state races should not require blanket `try/catch` logic.

### 7.4 Invalid decisions

A complete invalid controller decision, such as top-level Population commitments exceeding 100%, is rejected as a whole.

The engine does not silently normalize or partially apply it.

### 7.5 Runtime failure behavior

A controller exception, timeout, sandbox violation, malformed output, or invalid decision must never crash/corrupt the match.

On failure:

- all output/memory from that invocation is discarded;
- the faction keeps the last successfully committed directives;
- actual allocation continues following the last valid desired state;
- the failure is logged;
- later controller invocations are attempted again.

If the **first-ever invocation** fails before any valid directives exist, the deterministic baseline is:

```text
100% Population in Reserve
no new actions/orders/directives
```

The faction remains inert under that baseline while the controller retries according to the normal failure policy. No starter controller or replacement AI takes over.

Repeated persistent failures trigger a deterministic circuit breaker:

- initial failures retry normally;
- persistent failures cause increasingly sparse retries;
- sufficiently persistent failure marks the controller **FAULTED** for the remainder of the match;
- a faulted faction continues on its last valid directives, or the initial inert baseline if none ever committed, rather than receiving a replacement built-in AI.

Early-match and late-match failures use the same rule.

### 7.6 `game.lastDecision`

The controller API should expose structured previous-decision information equivalent to:

```ts
game.lastDecision
```

This may include:

- previous commit/reject state;
- structured rejection codes;
- safe deterministic metadata useful for programmatic recovery.

Human-facing stack traces/debug diagnostics may be richer than what is exposed back into controller code.

### 7.7 Sandbox security boundary

Player code is untrusted and potentially malicious.

The execution boundary must prevent at minimum:

- host filesystem access;
- arbitrary networking;
- subprocess execution;
- environment-variable access;
- secret access;
- unrestricted native modules;
- unrestricted system/wall clock dependence;
- uncontrolled CPU/instruction/time use;
- uncontrolled memory use;
- uncontrolled action/output volume.

Game randomness must be deterministic and game-provided where randomness is allowed.

Raw `eval`, `Function`, or an ordinary in-process JavaScript VM wrapper alone is not an adequate security boundary.

Exact sandbox technology is implementation architecture, not game design.

---

## 8. Core world ontology

### 8.1 Cells are the authoritative spatial resolution

The authoritative territorial/combat simulation operates at the finest meaningful map resolution: **cells**.

Cell-level state may include things such as:

- terrain;
- political ownership where applicable;
- structures/spatial effects;
- faction Population commitment/pressure where applicable;
- local combat/capture state.

Higher-order concepts must not secretly replace cell-level simulation.

### 8.2 Segments are immutable map-wide spatial lenses

A **Segment** is an immutable deterministic strategic/geographical region generated as part of map creation/preprocessing.

Segments are not faction-owned simulation buckets.

**Every real map cell belongs to exactly one segment**, including land, water, and impassable cells.

Segment identity does not change merely because ownership/combat changes.

One segment may therefore be partially controlled by several factions and/or neutral territory simultaneously where ownership is applicable.

Segments are a controller-facing spatial index/lens over the underlying map.

A segment may expose aggregate information such as:

- stable identity;
- geometry/cells;
- adjacency;
- terrain composition;
- dominant terrain;
- ownership distribution where applicable;
- coastal/water relationships;
- impassable/geographical composition;
- other static or derived summaries.

Terrain remains fundamentally a cell property.

### 8.3 Segment count is derived, not prescribed

The map is **not** assigned an arbitrary fixed number of segments.

Likewise, segments are not a rigid uniform square grid.

Segment generation uses a roughly consistent strategic scale with variable shape/size:

- larger maps naturally yield more segments;
- smaller maps yield fewer;
- important geographic features may create small segments;
- large homogeneous areas are subdivided;
- tiny meaningless slivers should normally be merged sensibly.

Conceptually the generator may tune:

```text
minimum useful area
preferred area
maximum useful area
```

These are guidelines rather than absolute limits.

### 8.4 Geography guides segmentation

Strong segmentation boundaries should prefer features such as:

- ocean/coast relationships;
- impassable terrain;
- disconnected landmasses;
- major rivers;
- major ridges/mountain systems;
- strong chokepoints.

Soft preferences may include:

- terrain transitions;
- elevation change;
- geographic coherence.

Segments may contain mixed terrain where forcing purity would create pathological geometry.

### 8.5 Water terrain

V1 may continue using a simple ocean model, but the ontology must support future water terrain variants such as:

- deep water;
- shallow water;
- turbulent water;
- clear water;
- reefs/currents or similar future map features.

Such water types may later carry explicit naval/movement/combat modifiers.

### 8.6 Authored and procedural maps

Open Fufu should support both authored/static maps and optional deterministic procedural maps.

Conceptually:

```text
map seed/version
 -> terrain/geography
 -> deterministic segmentation
 -> immutable final map identity
```

Authored maps may eventually override/hand-author segment data if useful, but automatic segmentation must work as the baseline.

Exact generator heuristics and target area values are tuning/implementation work.

---

## 9. Contacts and visibility

### 9.1 TerritorialContact

`TerritorialContact` is derived political geometry, not stored segment identity.

A territorial contact exists where adjacent territorial cells are controlled by different factions, or faction/neutral ownership where useful for expansion reasoning.

It is derived at runtime from current ownership.

A connected territorial contact may cross several immutable segments; one segment may contain several independent contacts.

### 9.2 OperationalContact / operational visibility

`OperationalContact` is a broader visibility/combat concept.

Operational contact may arise through:

- hostile territorial adjacency;
- active land combat;
- naval units encountering one another;
- transports/warships reaching hostile coasts;
- amphibious landings;
- other direct unit interactions.

Operational contact determines when detailed local tactical information becomes available.

### 9.3 No canonical Front object

Open Fufu does **not** require an engine-defined first-class `Front` entity.

Players may define their own front concepts in controller code from:

- cells;
- segments;
- territorial/operational contacts;
- factions;
- ownership;
- terrain;
- visibility;
- arbitrary player-defined grouping logic.

Different controllers may define fronts differently or not use them at all.

If a common helper later becomes universally useful, it may be supplied transparently as example/SDK code without becoming a privileged simulation primitive.

### 9.4 Visibility model

Globally visible:

- static geography/terrain;
- territory ownership/political shape;
- stable segment geometry;
- exactly three macro faction statistics for each surviving faction:
  - **Population**;
  - **Territory %**;
  - **FFY**.

Operational/local rather than globally visible:

- enemy local Population commitment;
- local combat pressure;
- mobile enemy units;
- detailed local structures/defenses where visibility rules require contact;
- tactical modifiers/state.

Private:

- controller memory;
- desired future allocation/orders;
- intended future targets;
- internal decision state.

Knowing a distant coastline exists does not reveal its defense.

A controller may deliberately target/route toward known remote geography without possessing local operational intelligence there.

---

## 10. Population model

### 10.1 One global Population resource

Each faction has one total current **Population** value.

Do not introduce a hidden mobilizable fraction, civilian/military split, manpower resource, army resource, or freestanding Military Power stat for V1.

If total Population is 100,000 and a controller commits 55%, that means literally 55,000 current Population.

### 10.2 Population commitment is abstract effective presence

Population does **not** represent resident civilian population stored cell-by-cell.

Cell commitment is an abstract effective faction presence used for:

- defense;
- attack;
- neutral expansion;
- other territorial pressure.

Several factions may have effective commitment associated with the same contested cell.

Example:

```text
Cell X owner: Tanya

Tanya actual commitment: 4,000 -> defensive pressure
Fufu actual commitment:  5,500 -> attacking pressure
Ski actual commitment:   2,000 -> separate hostile pressure
```

Co-attacking enemies do not become allies merely because they are attacking the same owner.

### 10.3 Actionable-cell restriction

The controller may use arbitrary known geography as a strategic objective, but ordinary Population pressure cannot be teleported to arbitrary remote cells.

Owned eligible territorial cells may hold faction commitment.

Neutral/hostile cells may receive ordinary land attack/expansion commitment only when they are **actionable under the current territorial rules**, for example through valid land adjacency/contact.

Remote hostile cells require an explicit mechanic that makes them actionable, such as amphibious transport/landing.

### 10.4 Population allocation primitive

The universal underlying spatial-control mechanism is:

```text
Population budget
+ eligible/actionable cell set
+ per-cell weights
    -> normalized desired cell-level Population distribution
```

Higher-level reasoning via segments, contacts, factions, coastlines, objectives, or custom regions is merely a way to choose the cell set and weights.

The engine must not create separate privileged military mechanics for different high-level abstractions.

A beginner may distribute evenly. An advanced controller may construct arbitrary deterministic cell weighting.

### 10.5 Top-level allocation validity and Reserve

Top-level Population commitments may not exceed 100% of current total Population.

Requests above 100% are invalid and rejected transactionally rather than silently normalized.

Any unassigned Population is **Reserve**.

Reserve:

- is not a separate resource;
- provides no hidden combat/redeployment bonus;
- remains part of total Population;
- follows the same Redeployment Rate rules when assigned later.

### 10.6 Desired versus actual commitment

The controller defines a **desired** Population field.

The simulation maintains an **actual** Population field that converges toward desired over time.

This prevents instantaneous strategic reorientation.

Percentage-based desired allocations naturally recalculate against the current total Population when Population changes.

### 10.7 Initial allocation

Before normal game-time redeployment begins, the first valid controller allocation establishes the faction's initial actual allocation directly.

The opening state should not require every faction to spend time moving its initial Population out of an artificial fictional Reserve unless the controller deliberately chooses Reserve.

After initialization, changes are governed normally by Redeployment Rate.

### 10.8 Casualties

Casualties reduce both:

- the local faction actual commitment where the casualty occurred;
- the faction's total current Population.

The controller's existing desired percentage logic remains interpreted against the new lower total Population, and normal redeployment later moves actual allocation toward the resulting desired field.

### 10.9 Population growth enters Reserve

Newly generated Population enters **Reserve** first.

Population growth must not become a hidden bypass around Redeployment Rate by magically appearing at the desired combat location.

### 10.10 Redeployment Rate

Open Fufu V1 has one surfaced **Redeployment Rate/Capacity** governing how quickly a faction's actual Population commitment field may change.

It applies to any reassignment of effective commitment, including:

- reserve -> frontline;
- one conflict -> another;
- one cell concentration -> another;
- continuing an advance from a captured cell into the next target cell.

Capturing the cell underneath an already-existing commitment does not itself move that commitment. Further advance requires a new change in the field and therefore consumes redeployment throughput.

V1 deliberately has no intrinsic distance cost for ordinary redeployment.

Moving 10,000 commitment locally and moving 10,000 commitment across a larger land distance use the same throughput amount unless an explicit mechanic says otherwise.

Do not add hidden special cases such as reserve bonus speed, emergency reinforcement, or home-territory acceleration.

Explicit future items/structures/terrain/rail/faction effects may modify the surfaced mechanic.

### 10.11 Desired-to-actual transition

At each simulation interval:

- locations above desired contain `excess`;
- locations below desired contain `deficit`;
- the faction has a deterministic movement budget:

```text
movement budget = Redeployment Rate x dt
```

At most that amount of Population moves from excess allocation toward deficits.

With no V1 distance cost, deficit filling may be deterministic/proportional.

### 10.12 No separate V1 redeploying pool

Because V1 does not model physical travel time for ordinary land redeployment, no persistent `redeploying Population` pool is required.

Conceptually:

```text
Total Population
= actual active commitment
+ Reserve
```

Actual commitment changes only within Redeployment Rate throughput.

A true in-transit state may be introduced later if distance/logistics/rail/supply mechanics make physical travel time meaningful.

### 10.13 Sublinear redeployment scaling

Larger factions should have greater absolute redeployment capacity, but not linearly proportional strategic agility.

Accepted V1 starting direction:

```text
RedeploymentCapacity(P)
= Rref * (P / Pref)^(2/3)
```

The `2/3` exponent is a starting design direction subject to balance testing.

Approximate effect:

```text
2x Population  -> 1.59x redeployment capacity
4x             -> 2.52x
8x             -> 4x
27x            -> 9x
```

`Pref`, `Rref`, and exact application are tuning data.

---

## 11. Population Capacity and growth

### 11.1 Capacity and Growth Potential are separate

Population growth uses distinct concepts:

- **Population Capacity**: how much Population the faction's land/infrastructure can sustainably support;
- **raw Productive Growth Value**: productive demographic contribution of owned territory/infrastructure;
- **Growth Potential**: empire-level sublinearly scaled replacement/growth throughput;
- **utilization multiplier**: current Population relative to Capacity.

### 11.2 Capacity

Capacity may scale approximately linearly/generously with useful territory quality and explicit capacity-providing structures/items.

A larger successful empire may therefore sustain a substantially larger eventual Population.

### 11.3 Growth Potential is sublinear

Replacement/growth throughput should scale sublinearly with productive territorial value so large empires gain a strong advantage without multiplying replacement speed linearly with their size.

Accepted starting direction:

```text
GrowthPotential ~= ProductiveTerritory^0.75
```

Expected test range for the exponent is roughly `0.7-0.8`.

Exact coefficients/exponent remain balance values.

Growth-related structures should normally contribute to raw Capacity and/or raw Productive Growth Value before empire-wide sublinear scaling so they do not trivially bypass the anti-snowballing model.

### 11.4 Broad optimal utilization band

Define:

```text
utilization = current Population / current Population Capacity
```

Growth should have a broad comfortable plateau rather than one exact mathematical optimum.

Approximately **40-60% utilization** should realize 100% of Growth Potential.

Outside that range, efficiency falls smoothly.

Current tuning anchors:

```text
10% utilization  -> ~45%
20%              -> ~70%
30%              -> ~88%
40-60%           -> 100%
70%              -> ~85%
80%              -> ~60%
90%              -> ~35%
100%             -> 0%
```

These values are provisional tuning anchors; the accepted design is the broad plateau and soft asymmetric penalties.

Very low Population remains recoverable. Very high utilization suppresses replacement strongly but does not normally reach zero before full capacity.

### 11.5 Capacity loss does not kill Population instantly

If Capacity falls below current Population because territory/infrastructure is lost, excess Population is not automatically deleted.

Ordinary positive growth is suppressed until utilization becomes sustainable again through casualties, territorial recovery, new capacity, or other explicit mechanics.

### 11.6 No hidden losing-player growth bonus

There is no special `last place` or hidden rubber-band growth modifier.

Recovery emerges from universal Capacity/utilization rules and sublinear empire scaling.

---

## 12. Territorial combat and expansion

### 12.1 Cell-level local pressure

Combat, casualties, and territorial changes are resolved at cell level.

Segments, contacts, factions, and player-defined fronts remain reasoning/query abstractions only.

A useful invariant is:

> If a segment boundary is redrawn through otherwise identical cells and no controller changes its decisions because of that metadata, the authoritative match result should remain unchanged.

### 12.2 Effective local pressure

At a contested cell/location, conceptual effective pressure is:

```text
local actual committed Population
x explicit attack/defense modifiers
```

Explicit modifiers may come from:

- terrain;
- structures;
- items;
- future factions/classes;
- other clearly surfaced mechanics.

The engine should avoid hidden strategic bonuses unrelated to explicit mechanics.

### 12.3 Territorial advantage

Accepted V1 mathematical direction for a simple attacker/defender contest:

```text
advantage = (A - D) / (A + D)
```

where `A` and `D` are effective local attacking and defending pressures.

This bounded relative advantage provides diminishing returns to overwhelming superiority while preserving meaningful concentration advantage.

If both are zero, there is no combat advantage calculation/capture from combat pressure.

Territorial capture/advance speed should be driven by positive advantage multiplied by a base advance rate and explicit movement/capture modifiers.

Exact rate coefficients are balance data.

### 12.4 Casualties

Casualties and territorial movement are separate outcomes.

Accepted two-party casualty direction uses bilateral engagement intensity, approximately:

```text
engagement ~= 2AD / (A + D)
```

with casualty shares influenced by opposing effective pressure so stronger effective forces tend to trade favorably without becoming immune to losses.

Desired qualitative behavior:

```text
equal forces
 -> high casualties, little movement

small superiority
 -> slow progress, modestly favorable casualty exchange

large superiority
 -> faster progress, strongly favorable casualty exchange

undefended area
 -> rapid capture with essentially no combat casualties
```

Exact casualty coefficients are tuning data.

### 12.5 Multiple hostile factions: all-vs-all local combat

A contested cell in FFA is a genuine **all-vs-all** engagement. Co-attacking factions do not receive a temporary alliance, free gang-up, or immunity from one another merely because they currently share an owner as a target.

Every hostile faction present at the local contest is hostile to every other hostile faction present.

The accepted starting resolution direction is **pressure-proportional all-vs-all engagement**:

- each faction has one finite local effective combat-pressure budget;
- that budget is distributed across all other hostile factions in the cell in proportion to those opponents' effective local pressures;
- pairwise casualty effects are then resolved simultaneously;
- a faction's full pressure is therefore **not duplicated once per opponent**;
- no attackers are pooled into one allied super-force.

Example with effective local pressures:

```text
Tanya = 40
Fufu  = 30
Ski   = 30
```

Tanya faces two equally strong opponents, so her outgoing engagement pressure splits approximately:

```text
20 -> Fufu
20 -> Ski
```

Fufu distributes its 30 according to opponent pressure `40:30`:

```text
~17.1 -> Tanya
~12.9 -> Ski
```

Ski behaves symmetrically.

This is not a hard-coded `40/30/30` casualty rule; it is the natural result of the actual local effective pressures. Different pressure values produce different shares.

All multi-party local effects should be computed from the same pre-resolution state and committed simultaneously so iteration order cannot determine the winner.

The current owner retains political ownership until the capture/control rules cause it to lose the cell. If ownership is lost while multiple hostile claimants remain, the strongest successful surviving claimant receives the cell according to deterministic local control/capture rules; the other factions remain hostile and may immediately continue contesting it.

Exact multi-party casualty/capture coefficients remain ruleset tuning and may be adjusted after simulation testing, but the **all-vs-all, no-free-coalition** rule is a design invariant.

### 12.6 Neutral expansion

Neutral expansion uses the same ordinary Population-allocation philosophy rather than a separate expansion resource.

The controller assigns Population to actionable neutral-border cells through the same cell-weight system.

V1 does not impose automatic Population deaths simply for settling neutral land.

The principal cost is opportunity cost: Population exerting neutral expansion pressure is not simultaneously exerting pressure elsewhere.

Terrain and explicit modifiers may alter expansion efficiency.

### 12.7 Strategic doctrines remain emergent

Blitzkrieg-like concentration, broad pushes, compact defense, reserve-heavy behavior, opportunistic attacks, and other doctrines should emerge from player-written allocation/targeting logic and the common simulation rules.

There is no privileged named combat mechanic required for those doctrines.

### 12.8 Deliberate retreat and territory relinquishment

Controllers must have a mechanical primitive that allows them to **deliberately relinquish owned territory** rather than relying on the enemy to capture undefended cells incidentally.

This allows player code to express controlled retreat, salient abandonment, defensive contraction, and similar strategy directly.

Relinquishment changes political control according to the final legal retreat rule; it must not create hidden combat bonuses or teleport Population. Existing Population commitment still obeys the ordinary desired/actual allocation and Redeployment Rate rules.

The exact relinquishment speed, neutralization behavior, structure consequences, and other inherited interactions are ruleset/audit details to settle against the current OpenFront mechanics.

---

## 13. Naval and amphibious operations

Amphibious operations use the faction's ordinary Population rather than a separate manpower resource.

Conceptually:

```text
Population committed to amphibious operation
 -> loaded into transport capacity
 -> transported by naval unit
 -> remote coastal objective
 -> landing makes target locally actionable
 -> landed Population becomes ordinary local commitment
```

Population aboard transports is not simultaneously exerting ordinary land pressure elsewhere.

Transport destruction may kill carried Population according to the final inherited/transformed naval rules.

A controller may select a distant known coastline as an objective without knowing detailed defenses there.

Exact transport capacities, timing, naval combat, and inherited unit behavior are audit/tuning matters.

---

## 14. Economy and FFY

### 14.1 FFY

**FFY (Fufu Yen)** is the single primary in-match economic currency.

Do not introduce conventional piles of RTS resources such as wood/stone/iron/food unless later gameplay demonstrates a concrete need.

The broad distinction is:

```text
warfare primarily consumes Population
infrastructure primarily consumes FFY
```

### 14.2 FFY is event-driven

FFY is generated by explicit world/economic events rather than a generic passive `Population -> FFY/sec` tax.

Examples include:

- successful trade completion;
- train/station economic events;
- capture of valuable assets/objectives;
- piracy/capture events;
- inherited economic events that remain compatible;
- future deliberate economic events.

Economic strategy therefore optimizes event:

- frequency;
- value;
- risk;
- placement;
- protection.

Terrain-based FFY effects should preferably alter relevant events/structures rather than cause generic land tiles to emit passive currency without an explicit mechanic.

Warfare may produce some FFY-generating events, but pure aggression should not automatically be the optimal economy.

---

## 15. Teams, FFA, war state, and trade

### 15.1 Teams

Teams are selected before the match and remain fixed.

There are no conventional in-match alliance changes.

Team PvE is only available with **multiple human players** on the human team.

### 15.2 FFA

In FFA, every non-team faction is legally attackable at all times.

There are no formal alliances.

Controllers may still create emergent ceasefires/coalition-like behavior by independently choosing not to attack particular factions or by focusing a runaway leader.

Such strategic restraint does not change the local combat rule: if mutually hostile factions commit Population to the same contested cell, local combat remains all-vs-all.

### 15.3 Derived `atWar`

For non-team factions, `atWar` is a symmetric derived state describing current/recent hostilities, not permission to attack.

Hostile actions such as land attack, amphibious attack, destructive naval attack, territorial capture, or direct destructive weapons set `atWar = true` for the pair.

If neither side performs relevant hostile actions for a rules-defined inactivity period, it returns to false.

Exact timeout is balance data.

### 15.4 Trade during war

Trade with enemies remains legal.

Accepted V1 starting penalty while `atWar` is true: **50% wartime trade penalty**.

Explicit factions/items/structures/future mechanics may modify the penalty.

Actual wartime profitability may fall further through real in-world disruption such as warship interdiction.

---

## 16. Victory, defeat, and team results

### 16.1 FFA victory

A faction wins when either:

- it controls 100% of conquerable territory; or
- all other factions have resigned/capitulated/been defeated.

### 16.2 Team victory

A team wins when either:

- all non-team opposition has been defeated/capitulated; or
- the team collectively controls all conquerable territory.

An individual human faction may be eliminated before the end of the match. If that player's human team later wins, the eliminated human still receives the team victory and applicable team PvE progression reward.

Exact inherited behavior for what happens to a defeated faction's remaining territory/structures should be settled by the OpenFront compatibility audit rather than guessed here.

---

## 17. Inherited structures, units, and mechanics

Open Fufu should **not aggressively delete inherited OpenFront game concepts merely to simplify the fork**.

The intended first-playable approach is to preserve inherited gameplay concepts where they remain compatible, including concepts such as:

- Cities;
- Defense Posts;
- Ports;
- Factories;
- Missile Silos;
- SAM Launchers;
- Transport Ships;
- Warships;
- Trade Ships;
- trains/railways;
- Atom Bombs;
- Hydrogen Bombs;
- MIRVs and related strategic weapons.

However, their existing OpenFront semantics are not automatically canonical.

The later broad compatibility audit must classify inherited systems according to whether they are:

```text
A. retained essentially unchanged
B. retained but translated into Open Fufu mechanics
C. disabled/replaced because they are fundamentally incompatible
```

Likely directions, not yet source-audited final mappings, include:

```text
City
 -> Population Capacity / Growth contribution

Defense Post
 -> explicit local defensive-pressure modifier

Port
 -> naval access + trade FFY events

Trade Ship
 -> FFY-producing trade completion event

Train / station
 -> FFY economic events
 -> possible explicit future redeployment interaction

Transport Ship
 -> carries committed Population

Warship
 -> naval combat / trade interdiction

Missiles / strategic weapons
 -> explicit Population / structure / cell effects
```

The compatibility audit must be broader than structures/units and inspect the full inherited game and architecture.

---

## 18. Official PvE AI

### 18.1 AI presets, not global difficulty

PvE has no global Easy/Normal/Hard scalar.

Difficulty comes from the concrete official AI faction/controller presets placed in the lobby.

The game creator authors the official AI presets; players do **not** create new PvE AI presets.

There is therefore no user-authored PvE-AI approval marketplace or promotion pipeline to design.

### 18.2 Same game rules as players

Official PvE AI must obey the same gameplay rules available to player controllers:

- same Population rules;
- same FFY rules;
- same visibility/fog-of-war restrictions;
- same action legality;
- same combat/capture equations;
- same structures/units;
- no hidden teleports;
- no secret income multipliers;
- no omniscient enemy deployment information.

Official AI may be trusted executable code operationally and therefore does not necessarily require the same security sandbox as untrusted player code.

Its difficulty should come from strategy, not simulation cheats.

### 18.3 Creator-shipped PvE content is progression-valid

PvE maps, modes/configurations, and AI presets deliberately shipped by the game creator as normal progression content are legitimate progression sources by definition.

There is no separate approval status that player-authored AI presets can acquire, because players do not create PvE AI presets.

Player-controller testing, custom non-progression experiments, and PvP do not become PvE reward sources merely because they use the same simulation engine.

### 18.4 AI personality directions

Official presets may be built from reusable internal strategic components.

Illustrative design references include:

- **Tanya-like**: narrow concentration, aggressive breakthrough, high risk/reward;
- **Reinhard-like**: economy optimization, threat assessment, few decisive targets;
- **Thorfinn-like**: avoids initiating hostility, retaliates when attacked, may stop focusing enemies when continued war is unnecessary.

These names are design references rather than final shipped content policy.

---

## 19. PvE progression and item loadouts

Persistent collection/meta progression is earned through creator-shipped PvE progression content.

The standard PvE loadout contains **7 equipped item slots**.

Only equipped items affect the match; the player's entire collection does not stack permanently onto the account.

There is no player-to-player item trading.

PvP progression rules are separate; serious/ranked PvP should prioritize controller quality and should use progression-disabled or standardized loadouts. Exact PvP mode design remains deferred.

---

## 20. Deterministic item catalogue

### 20.1 Large versioned catalogue

Open Fufu does not require literal mathematical infinity.

The target is a very large deterministic catalogue that feels practically inexhaustible in ordinary play, potentially tens or hundreds of thousands of items per generator version.

Items are reproducible from stable identity/seed plus generator version.

New generator versions may expand the catalogue without mutating existing items.

### 20.2 Mechanical uniqueness

Two different item identities should not intentionally represent the same complete mechanical signature.

Catalogue generation should detect exact mechanical-signature collisions and reject/skip duplicates during generation.

### 20.3 Constrained numeric representation

Effect families have approved ranges, quantization, and hard balance caps.

Deterministic fixed-point/exact quantized representations are preferred for mechanical identity over arbitrary floating-point identity semantics.

### 20.4 Item shape

Generated items may include one or two mechanical modifiers, including combinations such as:

- one positive modifier;
- two positive modifiers;
- stronger positive modifier paired with a drawback/negative modifier;
- other bounded generator-approved combinations.

Exact effect-family distributions are balance/generator work.

### 20.5 Item presentation identity

Each item should have deterministic collectible presentation metadata including approximately:

- stable item identity/seed;
- generator version;
- mechanical modifiers;
- name;
- flavor/dialogue line or description;
- lightweight deterministic visual identity such as SVG or equivalent;
- rarity/drop-weight metadata.

The content/art pipeline is implementation/content work.

### 20.6 Stat stacking

For a stat with flat and percentage modifiers:

```text
final = (base + sum(flat bonuses)) x (1 + sum(percentage bonuses))
```

Percentage bonuses add to one another rather than multiplying independently.

---

## 21. Item rarity and reward sampling

### 21.1 Explicit weights

Every item has an explicit positive sampling weight in the normal PvE reward distribution.

Conceptually:

```text
P(item) = itemWeight / sum(all eligible normal-table item weights)
```

Lower weight means rarer.

There are no required Common/Rare/Epic/Legendary tiers.

Power should influence rarity, but rarity need not be a one-dimensional deterministic function of raw power.

Weight may depend on:

- effect family;
- modifier magnitude;
- number of modifiers;
- drawbacks;
- deterministic rarity/flavor factors;
- other generator metadata.

### 21.2 Rarest-of-N PvE rewards

For a won PvE match:

```text
base victory rolls
+ sum(all applicable official AI preset +X roll modifiers present)
= solo-equivalent roll count
```

The AI only needs to have been present in the won creator-shipped PvE match. The player/team does not need personal elimination credit for that AI.

The game samples independently that many times and awards the **rarest sampled item** according to its inherent normal-table rarity/weight.

There are no hidden high-quality rolls.

### 21.3 Team PvE reward division

Team PvE requires multiple human teammates.

For a human team victory:

```text
rollsPerHuman
= max(1, ceil(soloEquivalentRolls / participatingHumanCount))
```

Each participating human performs that many independent rolls and receives the rarest result from their own roll set.

A human whose faction was eliminated earlier still receives the victory/reward if their human team wins.

Example:

```text
solo-equivalent rolls: 9
1 human -> 9
2 humans -> 5 each
3 humans -> 3 each
```

This division rule is accepted; later balance testing may still change the broader reward economy if needed.

---

## 22. Duplicates and gambling store

Normal PvE reward sampling does **not** filter out currently owned items.

If the awarded item is already owned:

- the duplicate is automatically converted into a separate persistent gambling-store currency;
- the player does not keep multiple inventory copies;
- the player does not choose whether to convert the duplicate.

Players may **not manually sell owned items**.

The duplicate system is bad-luck protection, not a general player-controlled item market.

Every duplicate should be worth at least one immediate store gamble.

Current conceptual small-number scale:

```text
store gamble:             ~10 currency
low duplicate:            >=10
ordinary duplicate:       ~11-13
rare duplicate:           ~15-18
extremely rare duplicate: ~20+
```

Exact values and currency name are balance/content details.

The gambling store:

- excludes every currently owned item;
- renormalizes eligible weights for the store roll;
- does not change an item's displayed inherent normal-table rarity.

The persistent gambling currency is **not FFY**. FFY remains strictly the in-match economy currency.

---

## 23. Explicitly deferred systems

The following are deliberately **not** V1 design commitments unless the later compatibility audit reveals a minimal inherited form that must be preserved:

- full supply/connectivity/logistics simulation;
- distance-based ordinary land redeployment;
- detailed in-transit land Population;
- player-selectable factions/classes with unique rule exceptions;
- alternate controller languages;
- complex item crafting/upgrades/sockets/set bonuses;
- player-to-player item trading;
- final ranked PvP rules;
- advanced water-terrain catalogue/modifiers;
- major post-V1 terrain expansion.

Supply/connectivity may eventually support emergent isolation, encirclement, vulnerable spearheads, rail/logistics, and similar strategy, but it should not be invented prematurely.

---

## 24. Provisional tuning values versus design rules

The following are accepted **directions/current starting values** and should be versioned ruleset constants rather than treated as eternal product law:

- simulation cadence: currently 10 Hz;
- controller cadence: currently 2 Hz;
- controller memory limit: currently 128 KiB;
- redeployment exponent: currently `2/3`;
- redeployment `Pref`/`Rref`;
- population-growth exponent: currently approximately `0.75`;
- population utilization curve anchor percentages;
- base capture/advance rate;
- casualty-rate coefficient;
- multi-party pressure/casualty coefficients;
- terrain modifiers;
- structure values;
- Population Capacity values;
- FFY event payouts;
- `atWar` inactivity timeout;
- transport capacities/timing;
- official AI `+X rolls`;
- duplicate-currency values/store price;
- item catalogue size and weight-generation formulas;
- segment target/min/max size and generation heuristics.

Balance testing/headless simulation should tune these without rewriting the fundamental game ontology.

---

## 25. Open questions that remain after consolidation

The foundational game design is mostly settled. Remaining questions fall into three categories.

### 25.1 Balance/tuning questions

These do not block the OpenFront compatibility audit:

- exact combat casualty coefficient;
- exact territorial advance/capture speed;
- exact multi-party combat coefficient details;
- exact Population growth curve values;
- exact redeployment rate constants;
- exact segment target sizes/heuristics;
- exact terrain/structure modifiers;
- exact FFY payouts;
- exact AI reward values;
- exact item weight-generation balance.

### 25.2 API/implementation questions

These belong to architecture/integration planning rather than game-design ontology:

- exact TypeScript API names/types;
- exact controller sandbox technology;
- exact persistence/database design;
- exact authentication/identity implementation;
- exact process/container topology;
- exact replay/archive storage representation;
- exact deterministic memory codec;
- exact server/client transport/wire protocol.

### 25.3 Audit-dependent inherited behavior

These should be decided only after inspecting current OpenFront source rather than guessing:

- exact mapping of every inherited structure/unit;
- inherited naval/trade/rail mechanics;
- strategic weapon behavior;
- elimination/capitulation cleanup semantics;
- exact retreat/relinquishment interactions with inherited structures and territory state;
- current terrain/map representation compatibility;
- inherited match/config/player-count behavior;
- which current mechanics can remain unchanged versus require translation/replacement.

---

## 26. Next step: broad OpenFront compatibility audit

Once this consolidated document is reviewed and accepted as the sole Open Fufu design contract, the next major task is a **broad source-level OpenFront compatibility audit**.

That audit must compare this target design against the current fork across more than structures.

It should cover at least:

- current server/client authority model;
- game/tick/turn architecture;
- map and cell representation;
- terrain;
- ownership/neutral expansion;
- troops/population/gold/resource model;
- attack/combat/capture;
- structures and units;
- naval movement/combat/trade;
- trains/railways;
- strategic weapons;
- teams/alliances/relations;
- visibility/fog-of-war;
- bots/AI;
- victory/elimination/resignation;
- intents/executions;
- determinism/desync handling;
- match configuration/timing;
- replay/archive state;
- browser rendering assumptions;
- server orchestration;
- persistence/auth integration boundaries.

The audit should then produce **one separate integration/migration plan document** describing how to move the current fork toward this design while retaining useful inherited infrastructure and avoiding unnecessary rewrites.

The desired documentation end state is therefore conceptually:

```text
OPEN_FUFU_DESIGN.md
    What the game is supposed to be.

OPENFRONT_INTEGRATION_PLAN.md
    How the inherited fork will be transformed into it.
```

The provisional Open Fufu decision documents should be deleted after this design contract has been reviewed and confirmed to contain the latest accepted version of every decision.
