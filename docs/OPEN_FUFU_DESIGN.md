# Open Fufu — Canonical Design Contract

## Status and ownership

This document is the **canonical owner for Open Fufu's high-level product design, cross-system invariants, Population model, land-operation architecture, automatic-defense model, and other game-wide rules that do not belong to a focused subsystem owner**.

It is not a second copy of focused mechanics. Exact subsystem rules live with their canonical owners listed in [`README.md`](./README.md). The OpenFront → Open Fufu migration is owned by [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

---

# 1. Product identity

Open Fufu is a browser-viewable territorial strategy game/autobattler in which the player **programs the battler**.

The player does not normally issue moment-to-moment commands during a match. Before a match the player selects:

- an immutable version of their faction controller;
- one immutable Origin, official or custom;
- a PvE Echo loadout where applicable;
- lobby/game configuration.

Once the match begins, the controller governs the faction.

The game should reward programming and strategy rather than manual reaction speed.

## 1.1 Low floor, high ceiling

The controller surface must support both:

- a low entry floor where a player can modify a simple working controller without computational geometry or cell-by-cell micromanagement; and
- a high skill ceiling where advanced controllers can reason directly about cells, Segments, Contacts, frontage, statistics, optimization, weighting, and custom abstractions.

The engine should expose strategy-neutral primitives rather than privileged policies such as `blitzkrieg()` or `turtle()`.

## 1.2 Transparent mechanics

Strategically meaningful modifiers should come from explicit surfaced rule-bearing sources such as terrain, structures, Origins, Echoes, or ruleset values.

Do not add hidden reserve bonuses, hidden faction-size correction, invisible AI cheats, or similar outcome-steering mechanics.

## 1.3 Three complementary power axes

```text
Controller = how the faction thinks and decides
Origin     = what kind of faction it fundamentally is
Echoes     = collectible modifiers used to specialize the build
```

Origins and Echoes must not replace controller quality as the primary strategy/intelligence layer.

## 1.4 Match duration

A broad range of roughly **15 minutes to 2 hours** is acceptable, with ordinary games preferably finishing in under an hour. Exact pacing is balance work.

---

# 2. Relationship to OpenFront and Foof

Open Fufu is a fork of OpenFront. OpenFront is a technical starting point, not an authoritative target ruleset.

Useful inherited systems should be retained where they fit the target design; inherited behavior is not authoritative merely because it already exists.

Open Fufu remains a separate game/service from `foof-bot`.

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

Foof may use generic Open Fufu integration/game APIs for Discord-facing workflows, but must not execute player controllers, import simulation internals as its own game logic, or manipulate Open Fufu persistence directly as a substitute for the game API.

Open Fufu must remain independently coherent when Foof is absent.

Authentication and identity boundaries are owned by [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md).

The fork must preserve applicable OpenFront licensing and attribution obligations. Inherited proprietary assets must not be assumed reusable merely because they are present in the fork.

---

# 3. Authoritative simulation

Each match has one canonical authoritative simulation running server-side. A browser must not be required for the match to progress.

The architecture must support:

- unattended matches;
- headless simulations;
- accelerated simulations;
- controller certification/testing;
- tournaments and batch runs;
- deterministic replay/analysis;
- browser disconnects without match interruption.

The browser is primarily a viewer/editor/debugging surface, not the authority for world state.

Player controller code is untrusted and executes behind an isolation boundary. Official PvE AI may be trusted operational code but receives no gameplay-information privileges unavailable to lawful player controllers at the equivalent rules level.

Implementation/process topology belongs to the migration/architecture plan rather than this design contract.

## 3.1 Logical ownership versus rendered appearance

The browser's accepted logical political-ownership state and its rendered political-map appearance are separate. Once a complete lawful ownership update or replacement baseline has been accepted, that logical state is current immediately. The renderer may visually converge toward the latest logical state rather than requiring every affected cell to snap to its new appearance in one frame.

Political-ownership presentation is **latest-target presentation**, not queued revision playback. If a newer accepted logical ownership state arrives before the current visual transition completes, presentation retargets from its current appearance toward the newest target and discards superseded visual targets. Installing a replacement ownership baseline, including after resynchronization, establishes the new target directly rather than requiring discarded presentation history to be replayed. Discrete transport batching alone must not produce presentation flicker.

For very large ownership changes, presentation may use deterministic spatial staggering or coarse-region variation where useful. Such staggering is presentation only: it does not represent authoritative capture order, simulation timing, or an intermediate ownership state.

Visual lag must remain bounded under sustained ownership churn. Presentation must be able to catch up rather than accumulate an unbounded animation backlog.

Rendered transitional appearance has no game-semantic authority. Gameplay, controller or AI decisions, targeting truth, inspection, selection, tooltips, diagnostics, validation, and other stateful surfaces consume accepted logical state rather than transitional rendered appearance. Presentation consumes only the lawful browser state supplied through the applicable projection/stream boundary and must not bypass visibility or authorization rules.

The exact easing function, transition duration, stagger function, catch-up or visual-lag threshold, GPU/CPU representation, and other visual tuning values remain implementation and visual-testing concerns rather than V1 game semantics.

---

# 4. Determinism, versioning, and replayability

Historical matches must remain reproducible.

A match must bind every rule-bearing input needed to define what that match meant, including identities equivalent to:

- match seed;
- map identity/version/hash;
- simulation ruleset version;
- controller runtime/API version;
- exact immutable player-controller versions;
- exact official-AI preset versions;
- exact Origin definitions and relevant catalogue version;
- equipped Echo identity/magnitude configuration and relevant catalogue/naming/acquisition-rule versions;
- spawn mode/configuration and resolver version;
- any other versioned data that materially changes deterministic simulation.

Changing a mechanic, controller API, AI preset, Origin, Echo rule, spawn resolver, or map later must not silently change historical matches.

Archival replay is deterministic-input/action replay rather than periodic full-world-state dumping. Playback reconstructs the match from bound versioned inputs and accepted simulation-affecting actions; it does not require re-executing player controllers or persisting private controller thought state.

Persistence/schema details belong to the migration architecture.

---

# 5. Controller model

The V1 controller language is **TypeScript**, with ordinary JavaScript-style code naturally usable.

Players may maintain multiple controller presets. Drafts may be edited repeatedly; published controller versions are immutable and matches bind an exact published version.

The public TypeScript surface is owned by [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts). Persistent memory semantics are owned by [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md).

## 5.1 Observation/action philosophy

Controllers receive immutable deterministic observations and submit declarative desired directives/commands. They do not receive mutable canonical engine objects or unrestricted engine internals.

The conceptual read surface includes game state, factions, cells, Segments, Contacts, operations, structures, units, navigation, economy, rules/mechanics, events, deterministic random, limits, and previous-decision status.

The conceptual action surface includes lawful primitives for:

- offensive and neutral-expansion Population commitments;
- spatial intent/weighting;
- passive defensive priorities;
- active counter-responses;
- deliberate territory relinquishment;
- construction/upgrades;
- unit and naval intent;
- strategic-weapon use;
- bounded team signals where legal;
- surrender/capitulation where legal.

There is no controller primitive for manually assigning passive defensive Population quantities across owned cells. Passive defensive quantity is automatic; the controller may influence priority only.

### 5.1.1 Tactical visibility projection

Tactical operational visibility is **requester-relative**. A viewer always knows its own operational state. For every other unit, persistent structure, manifested operation, and derived operational fact, the authoritative simulation applies one lawful visibility projection before any player controller, Official AI, player/controller-facing debug surface, event/contact projection, mechanics lookup, or entity-addressed convenience API is materialized.

For non-self operational state, V1 visibility precedence is exactly:

```text
EXPLICIT_PUBLIC
    >
DIRECT_REVEAL
    >
CONCEALMENT / BLACKOUT
    >
REMOTE_OBSERVATION
    >
UNREVEALED
```

Multiple applicable concealment/blackout predicates compose as a boolean union. They do not stack into concealment strength. Remote observation never defeats an applicable concealment/blackout; an explicit-public rule or an active source-specific direct reveal does.

A **direct hostile manifestation** occurs only when the authoritative simulation actually resolves a hostile effect from an identifiable unit, structure, or operation against another faction. Target selection, tracking, prospective acquisition, rejected/failed actions, movement, and other private intent are not manifestations and reveal nothing. Each faction to which that resolved manifestation itself is lawfully observable receives the direct reveal independently. An affected faction is therefore a recipient, and an independent third-party witness receives the reveal only when the same manifestation is lawfully observable to that viewer; a faction that does not lawfully observe the manifestation receives no reveal merely because the action occurred.

Direct reveal exposes the **source itself at its complete ordinary visible representation**, exactly as that unit, structure, or operation would be surfaced outside concealment. It does not reveal neighboring units, structures, operations, same-cell contents, or any other concealed state. The reveal follows source identity as it moves rather than leaving a marker at the manifestation location.

The V1 direct-reveal lifetime is exactly:

```text
15.0 seconds
= 150 simulation ticks at the V1 10 Hz cadence
```

The ruleset resolves the duration onto its deterministic tick lattice. A manifestation committed/resolved at tick `T` produces an exclusive expiry at `T + directRevealDurationTicks`; the reveal is active while `currentTick < expiryExclusiveTick`. Another qualifying manifestation by the same source against the same viewer refreshes that viewer/source expiry from the new manifestation tick. Movement, being attacked, or ordinary observation does not refresh it.

Same-tick ordering is authoritative-action resolution, manifestation identification/direct-reveal refresh, completion of canonical tick state, then requester-relative projection. The attacker is therefore visible in the observation produced from the attack tick. When the reveal expires, visibility is immediately reevaluated from the source's current location/state; it may reconceal immediately if concealment still applies, remain visible through ordinary observation, or otherwise disappear from current observation. Destruction never creates a ghost entity lasting until the reveal timer expires.

Current observation contains no engine-created `lastKnown` substitute for a subject that has reconcealed. Controllers may retain lawful historical knowledge in their own memory. A previously learned entity ID is not a visibility capability: `get`, list, mechanics, legality/quote, contact, event, debug, or other ID-addressable/derived surfaces must not disclose current existence, location, state, or a distinguishable failure solely because an otherwise hidden subject still exists. Blind cell-targeted actions remain legal when their own subsystem permits them, but their legality/quote result must not disclose concealed contents of the target cell.

The public controller contract expresses visibility primarily by lawful presence/absence of ordinary views rather than a global mutable `hidden` field. The internal projection reason is not itself required to be public. Origin-owned concealment transformations such as P45/P49 are defined by `ORIGIN_TRAIT_CATALOGUE.md`; Observation Post baseline behavior and authoritative structure-field geometry are owned by `TERRAIN_AND_STRUCTURES.md`.

## 5.2 Starter controller

Every player begins with a minimal complete working controller. It should demonstrate lawful basic mechanics while remaining strategically weak and understandable.

## 5.3 Browser authoring

The browser should provide controller editing, draft storage, API documentation/types, certification/benchmarking, diagnostics/replays, immutable publication, preset/version selection, and debug visualization.

Controller projects may contain multiple local TypeScript modules; publication may compile/typecheck/bundle them into one immutable certified artifact.

## 5.4 Invocation semantics

Each invocation observes one immutable deterministic authoritative snapshot. Returned collection ordering and observable iteration behavior must be deterministic.

A controller invocation proposes one transactional desired decision set rather than an order-sensitive imperative script over canonical state.

Persistent directives remain active until changed/ended. One-shot commands execute once. A command may not depend on another object being created earlier in the same decision unless that command contract explicitly permits it.

Runtime faults must not crash/corrupt the match. Ordinary stale-state/gameplay-legality rejection is a structured game result, not a controller runtime fault.

Exact public types, resource limits, receipts, and lifecycle behavior belong to the controller contract/runtime owners rather than being duplicated here.

---

# 6. Spatial ontology

## 6.1 Cells

Cells are the finest meaningful territorial simulation resolution. Ownership, terrain, capture, structures, and local combat geometry ultimately resolve through cells.

Ordinary V1 maps use **exactly 4,800,000 raster cells**. Width, height, aspect ratio, and population-bearing share may vary, but V1 does not support multiple gameplay map-resolution scales.

## 6.2 Segments

Segments are immutable deterministic map-compiled strategic regions used for querying/indexing/strategy rather than simulation buckets. Exact Segment generation and invariants are owned by [`SEGMENTS.md`](./SEGMENTS.md).

## 6.3 Contacts

**TerritorialContact** is derived adjacency geometry between differently owned cells.

**OperationalContact** is broader runtime interaction/visibility state created by territorial contact, combat, naval encounters, amphibious arrival, or other operational interaction.

## 6.4 Fronts

There is no engine-level canonical `Front` object that dictates strategy. Controllers may derive fronts from cells, Segments, Contacts, factions, terrain, ownership, and visibility.

## 6.5 Physical navigation

Simulation-owned physical route selection minimizes **expected traversal time** across legal transitions under the moving subject's current effective movement profile. Focused terrain, unit, naval, rail, Origin, and other mechanic owners remain authoritative for transition legality and movement rates; generic navigation must not invent or shadow-copy those rules.

Physical routing does not fold strategic danger, desirability, target value, or other controller/AI preferences into traversal time unless an explicit focused mechanic makes such a factor part of physical movement. Equal-traversal-time alternatives resolve deterministically.

---

# 7. Population model

## 7.1 One global Population resource

Each faction has one global **Total Population** used for offensive land operations, neutral expansion, counter-responses, Transport payloads, automatic defense while Available, and casualties.

There is no separate civilian/army/manpower resource or hidden mobilizable fraction.

## 7.2 Population Capacity

Population Capacity is exactly the number of owned population-bearing cells:

```text
1 owned population-bearing cell = 1 Population Capacity
```

Terrain determines whether a cell is population-bearing. Structures, Origins, Echoes, or hidden modifiers do not increase the Capacity value of an already population-bearing cell unless a future explicit rule changes the model.

Current Population may temporarily exceed Capacity after territorial loss; positive ordinary growth is then zero until the relationship recovers.

## 7.3 Available and committed Population

Conceptually:

```text
Total Population
= Available Population
+ committed offensive Population
+ committed counter-response Population
+ Population aboard Transports
```

Available Population is the pool eligible for new commitments and automatic defense.

Public Population quantities are non-negative whole integers. Deterministic fixed-point/residual state may exist internally for fractional recurring mechanics; such residuals must not be escapable through operation churn.

### 7.3.1 One-shot Population losses, grants, and transfers

A focused mechanic may remove, grant, or transfer Population at one authoritative lifecycle transition. Unless that mechanic explicitly defines a different rule, V1 uses these accounting invariants:

- the resolved one-shot amount is a non-negative whole integer before authoritative mutation; no implicit fractional residual is carried into later unrelated events;
- removing Population from a named committed bucket removes the same amount from Total Population in that atomic transition;
- a direct grant or transfer receipt enters Available Population unless the focused mechanic explicitly names another destination;
- Population Capacity is **not** a universal receipt cap: a direct grant or transfer may raise Total Population above Capacity unless the focused mechanic explicitly defines a Capacity clamp;
- an over-Capacity faction remains legal and simply receives zero ordinary positive Population growth until ordinary growth eligibility returns;
- a transfer freezes its authoritative amount before either side is mutated, then applies the source debit and recipient credit exactly once as one deterministic consequence; it must not duplicate Population or silently discard transfer overflow.

The focused mechanic owns its trigger, source bucket, amount/rounding, recipient, and whether the result is a loss, grant, or conserved transfer. This section owns only the common Population-accounting behavior once those inputs are known.

## 7.4 Initial Population

Ordinary V1 Initial Territory is **1,000 population-bearing cells**. Starting Population is **50% of final modified Initial Territory** before explicit Starting-Population modifiers, giving an ordinary unmodified start of `500 / 1,000`.

Strategic Spawn geometry and Origin spawn transformations are owned by [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) and [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

## 7.5 Population growth

The ordinary V1 base-growth equation is:

```text
BaseGrowthPerSecond
= 0.05 × PopulationCapacity^0.75
```

Let:

```text
u = TotalPopulation / PopulationCapacity
```

The ordinary utilization multiplier `U(u)` uses piecewise-linear interpolation through these anchors:

| Utilization | `U(u)` |
| ---: | ---: |
| 0% | **20%** |
| 10% | **45%** |
| 20% | **70%** |
| 30% | **88%** |
| 40% | **100%** |
| 50% | **100%** |
| 60% | **100%** |
| 70% | **85%** |
| 80% | **60%** |
| 90% | **35%** |
| 100% | **0%** |

For `u >= 1`, ordinary positive growth is zero. If Capacity is zero, ordinary growth is zero.

```text
ActualGrowthPerSecond
= BaseGrowthPerSecond
× U(u)
× explicitGrowthMultiplier
```

Newly grown Population enters Available Population.

Origin-specific growth-profile transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`. Utilization evaluation follows the exact-rational materialization convention in `RULE_COMPOSITION.md`: `TotalPopulation / PopulationCapacity`, breakpoint comparisons, horizontal remaps, and piecewise interpolation remain exact rational arithmetic until the owning growth domain materializes the final finite gameplay number. The effective utilization multiplier used by the authoritative simulation is also the multiplier surfaced by controller mechanics; controllers and Official AI must not reconstruct a separate approximation.

---

# 8. Land operations and frontage

Offensive Population is attached primarily to operations rather than permanently allocated to cells.

Creating/changing/ending an operation's Population occurs immediately when a valid controller decision commits. V1 has no generic land Deployment/Redeployment delay system.

Spatial intent may use target factions, Segments, Contacts, cells/areas, terrain, objectives, and strategy-neutral weights.

The simulation resolves intent into legal **engagement lanes** for each tick. One lane is one attacking source cell pressing one adjacent target cell for that faction during that tick.

Within one faction's resolved frontage:

- one source cell presses at most one target cell per tick;
- one target cell is not duplicated by multiple source cells from that faction in the same tick;
- different hostile factions may contest the same target cell;
- engagement geometry is frozen for the tick, so newly captured cells do not create same-tick chain conquest.

An operation cannot engage more lanes than its committed Population:

```text
engagedFrontage <= committedPopulation
```

Finite committed Population is distributed deterministically across engaged lanes according to legal weighting. Splitting one strategy across several operation objects must not manufacture additional pressure.

Land pressure affects only cells actionable through current territorial adjacency. Remote coast becomes actionable through explicit amphibious mechanics.

### Canonical operation-selector key

Where an authoritative land-operation resolver needs a representation-independent ordering key for the public `CellSelector` shape, V1 uses one canonical structural normalization and serialization. This key exists only for deterministic ordering, hashing, and replay; it is not a gameplay priority rule and does not attempt arbitrary set-equivalence simplification.

Normalize recursively before serialization:

- `CELLS`: sort stable `CellId` values ascending and remove duplicates.
- `UNION` / `INTERSECTION`: recursively normalize every child, flatten nested children of the same kind, sort children by canonical serialized form, and remove byte-identical duplicate children.
- `DIFFERENCE`: recursively normalize both operands while preserving left/right order.
- scalar selector variants (`OWNER`, `SEGMENT`, `TERRAIN`, `FALLOUT`, `POPULATION_BEARING`, `CONQUERABLE`, `COAST`, `SHORELINE`, `CIRCLE`, `STRUCTURE_FIELD`, `STRUCTURE_FIELD_INSTANCE`) preserve their selector kind and values; fields serialize in the fixed public-contract order for that variant. `STRUCTURE_FIELD` serializes `field`, `referenceFactionId`, then `affiliation`; `STRUCTURE_FIELD_INSTANCE` serializes its public fields in their declared contract order.
- stable IDs and finite numeric values use their canonical deterministic scalar encoding; strings use the canonical UTF-8/string encoding.

The serialized form is the selector-kind tag followed by its normalized fields/children in that order. Source spellings covered by the normalization above therefore produce the same key. Distinct normalized syntax trees may still happen to select the same runtime cell set; V1 does not solve general selector-algebra equivalence for this ordering key.

When two operations have byte-identical canonical target and source selector keys, the stable controller-authored directive key is the final projection-only tie-break. It must never affect faction-wide pressure, ownership, Total/Available/aggregate committed Population, residual state, or casualty totals; changing only that key may change which otherwise selector-equivalent operation object reflects a local decrement, but not any faction-level mechanical result. Operation ID, creation time, controller command ordering, and object-registration order are never tie-breakers.

## 8.1 Neutral expansion

Neutral territory has no automatic Population defender.

A successfully acquired neutral population-bearing cell costs **1 Population** from the expansion commitment under the baseline ruleset. This is settlement/occupation cost, not combat against a phantom defender.

Whether settlement Population cost applies is snapshotted from the target cell's effective **pre-acquisition** population-bearing state. An ownership-dependent transformation that makes the cell population-bearing only after it becomes owned therefore does not retroactively add settlement cost to that same acquisition.

When an explicit rule makes the effective settlement cost fractional, V1 keeps all public Population quantities whole and stores only the minimum deterministic faction-level residual needed by that rule. The current half-cost contract uses exactly:

```text
neutralSettlementHalfResidual = 0 | 1
```

where `1` represents one accrued half-Population of settlement cost. The residual is faction state, not operation state. It is serialized/replayed directly and survives ending, splitting, recreating, or renaming neutral-expansion operations.

For an effective `0.5 Population` settlement cost, every successful qualifying settlement advances the faction ledger exactly once:

```text
residual 0 -> 1 : debit 0 whole Population
residual 1 -> 0 : debit 1 whole Population
```

If several qualifying neutral cells would settle for one faction in the same simulation tick, their settlement facts are processed in stable ascending target `cellId`. Operation ID, controller command ordering, object-registration order, and operation partitioning are not tie-breakers for the faction ledger.

A whole debit produced by that sequence is first charged against the faction's **aggregate surviving neutral-expansion committed Population**, after earlier settlement debits in the same batch. Whether the pair-closing acquisition succeeds depends only on whether that aggregate contains at least one whole Population; it never depends on which operation object happened to own the pair-closing lane. Settlement ownership change, residual transition, and the aggregate debit are one authoritative transaction. If the aggregate contains less than one Population, that ownership transition does not commit and the residual does not advance; completed acquisition progress remains saturated at its required threshold and may resolve on a later legal tick.

After an aggregate debit succeeds, the one-unit reduction is projected back onto concrete neutral-expansion commitments deterministically. The pair-closing lane is considered first; remaining currently resolved neutral-expansion lanes follow in stable `(targetCellId, sourceCellId)` order. The first lane whose backing commitment still has surviving committed Population absorbs the decrement. If aggregate committed Population remains but no currently resolved lane can absorb it, remaining neutral-expansion commitments are ordered by the canonical operation-selector key above: target selector first, source selector second, with the stable directive key used only to break a byte-identical selector-key tie. The first commitment in that order with surviving committed Population absorbs the decrement. Operation ID, creation time, controller command order, and object-registration order are never tie-breakers. This projection may identify a different concrete operation after a legal split/recreation, but it must not change the faction's ownership result, Total/Available/aggregate committed Population, residual state, or aggregate same-tick neutral-expansion pressure. The resolver never substitutes Available Population, a hostile-attack commitment, a counter-response, or a Transport payload for this settlement debit.

Acquisition pacing is owned by [`COMBAT_TUNING.md`](./COMBAT_TUNING.md); terrain modifiers are owned by `TERRAIN_AND_STRUCTURES.md`.

---

# 9. Automatic defense and counter-response

## 9.1 Binary automatic defense

Available Population automatically defends threatened owned cells without persistent manual placement.

For each tick, a threatened owned target cell receives either:

```text
0 or 1 automatic defensive Population
```

No threatened cell receives more than one automatic defender from this system.

Therefore:

```text
automaticallyDefendedCells
= min(AvailablePopulation, threatenedOwnedCells)
```

A merely adjacent inactive border consumes no defender. Available Population must never be duplicated across cells/contacts/attackers.

When Available Population is insufficient, scarce defense slots are apportioned across active incoming fronts and then assigned using the controller's strategy-neutral defensive-priority policy. Equal-priority fallback behavior must remain deterministic.

For this automatic-defense apportionment only, a V1 **active incoming front** is one maximal 4-neighbor-connected component of the threatened owned target cells in the frozen tick geometry. It is a resolver partition, not the strategic `Front` object rejected in §6.4. Operation identity, controller directive identity, attacker registration order, and the number of attacking operation objects do not split or merge these components.

Let `S = min(AvailablePopulation, threatenedOwnedCells)`, let `n_i` be the threatened-cell count of front `i`, and let `N = sum(n_i)`. Front `i` first receives `floor(S × n_i / N)` automatic-defense slots. Any remaining slots are assigned by largest fractional remainder; equal remainders are ordered by the lowest stable `cellId` in the front. Within each front's resulting quota, cells are chosen by defensive-priority weight descending and then stable `cellId` ascending. The sum of all front quotas is exactly `S`, so this stage cannot duplicate Available Population. Legal splitting or recreation of equivalent incoming operations does not change the apportionment.

Terrain, structures, Origins, Echoes, and other explicit modifiers may alter the effectiveness of the one defender; they do not silently create additional defenders.

## 9.2 Active counter-response

A controller may commit Available Population to a counter-response against a specific incoming hostile operation.

Counter-response Population leaves Available while committed and fights the incoming operation directly; it does not reinforce passive cell defense.

Exact counter-response arithmetic and provisional constants are owned only by [`COMBAT_TUNING.md`](./COMBAT_TUNING.md).

Ending/reducing a surviving counter-response returns surviving Population to Available immediately on a valid decision.

---

# 10. Cell capture and land casualties

Combat is deterministic and cell-resolved.

A target cell may change political owner at most once per simulation tick. Newly captured cells do not open same-tick chain conquest.

Exact capture-progress arithmetic is owned by `COMBAT_TUNING.md`.

Ordinary hostile land casualties are capture-coupled rather than continuous ambient attrition.

For every successfully captured hostile cell under the baseline rule:

- the winning offensive commitment loses **1 Population**, regardless of terrain, Population Capacity, population-bearing status, or whether the cell had an automatic defender;
- if the cell had one automatic Population defender, the previous owner also loses that defender unless an explicit rule preserves it;
- Capacity changes only according to the captured cell's effective population-bearing ownership state.

The mandatory winning-offense debit and the hostile ownership transfer are one authoritative transaction. If the winning commitment cannot supply that 1 Population after earlier same-tick losses, the ownership transfer does not commit; completed capture progress remains saturated at its required threshold and may resolve on a later legal tick.

A hostile cell without an automatic defender therefore still costs the attacker 1 Population to capture; it causes no baseline defender casualty because no automatic defender existed. Other explicit mechanics may add Population consequences independently.

In multi-faction combat, finite same-faction pressure is aggregated before resolution. A cell changes owner at most once per tick; deterministic simultaneous-resolution rules choose the successful claimant. Unsuccessful third-party claimants do not lose Population merely because they contested the same cell.

## 10.1 Explicit post-capture Population consequences

An explicit mechanic may add a capturing-faction Population consequence after a successful territorial capture. Such a consequence resolves **after ordinary capture casualties** and does not retroactively change the successful claimant or ownership transfer.

For the current one-extra-Population Marsh consequence, every qualifying capture requests exactly one additional capturing-faction casualty even when the target had no automatic defender. Within the capture-resolution batch, all qualifying requests are aggregated **per capturing faction before payment**. Let `R` be that request count, and let `W` be the aggregate surviving committed Population, after ordinary capture casualties, across the distinct winning offensive commitments that produced at least one of those qualifying captures. The winning-commitment source class pays `min(R, W)` first. Only the remaining `R - winningLoss` may then be debited from that faction's Available Population.

The already-determined `winningLoss` is then projected onto the distinct qualifying winning commitments without changing that faction-level amount. Order those commitments by the lexicographically earliest qualifying capture fact they produced, using ascending `(targetCellId, sourceCellId)`; if a true tie remains, use the canonical operation-selector key above only as a projection tie-break. Starting with `remainingWinningLoss = winningLoss`, each commitment in that order pays `min(remainingWinningLoss, survivingCommittedPopulation)` and reduces `remainingWinningLoss` by the amount paid. Continue until `remainingWinningLoss = 0`. Because `winningLoss <= W`, this projection must always exhaust the full already-computed winning loss. Operation ID, creation time, controller command order, and object-registration order never decide the faction-wide loss. Splitting or recreating a legally equivalent attack therefore cannot reduce or increase the capturing faction's total P47 casualty; only the aggregate surviving Population of qualifying winning commitments and Available Population matter.

The resolver stops there. It never drains offensive commitments that produced no qualifying P47 capture, counter-response commitments, or Population aboard Transports. If the qualifying winning commitments plus Available Population cannot supply the full requested total, the unsatisfied remainder is discarded rather than becoming debt.

The extra consequence is capture-triggered. Deliberate relinquishment or a separate mechanic that neutralizes territory without a hostile successful capture does not generate it. A rule that changes capture speed/timing without changing the eventual successful hostile capture does not suppress it.

The same requested amount and debit order must be surfaced through controller mechanics and consumed by Official AI forecasting; neither layer may invent a different casualty source. In the current public controller contract, the debit-pool label `WINNING_OFFENSIVE_COMMITMENTS` denotes this aggregate qualifying-winning-commitment source class.

---

# 11. Retreat and territorial abandonment

Ending/reducing an offensive or counter-response commitment returns surviving Population to Available immediately on a successful controller decision.

Deliberately relinquishing owned territory is a separate political/spatial action. It must not be represented indirectly through withdrawal side effects.

A relinquishment command resolves its selected cells from one immutable pre-command snapshot. Every selected cell must currently belong to the issuing faction and must be legally relinquishable. **Any selected cell containing a persistent structure makes the whole relinquishment command illegal.** This applies equally to completed, damaged, fresh-under-construction, and upgrading structures. V1 does not silently demolish a structure and does not create ownerless persistent structures as a side effect of abandonment.

A successful relinquishment atomically changes every selected cell from the issuer to neutral ownership and then recomputes ordinary derived Capacity, terrain shares, Contacts, and other ownership-derived state. It creates no hostile capture result, no ordinary capture casualty, no nuclear casualty, and no structure-capture consequence. Creating disconnected surviving territory is legal; V1 has no generic connectivity requirement for relinquishment.

Mobile units and operation commitments are faction-owned state rather than ownership-bound cell contents. Relinquishing the ground beneath them does not by itself destroy or casualty that state; normal unit pathing and next-tick operation-lane legality resolve against the resulting map. Likewise, a Capacity decrease from relinquishment never directly kills Population. Total Population may temporarily exceed the new Capacity under the ordinary rule in §7.2.

Existing terrain overlays on a successfully relinquished cell persist unless an explicit rule transforms them. Origin-specific post-relinquishment effects such as adding Fallout are owned by `ORIGIN_TRAIT_CATALOGUE.md` and execute only after ordinary relinquishment succeeds.

---

# 12. Teams, diplomacy, and hostility state

Fixed-team modes use explicit immutable team membership for the match.

Open Fufu V1 has no declaration-of-war, treaty, negotiated-peace, relation-score, war-score, or mutable-diplomacy subsystem. `atWar` is instead a **symmetric deterministic state of recent controller-directed hostility** used by mechanics that need a stable notion of active war.

## 12.1 Hostility sides and symmetry

For war-state purposes, each active faction belongs to exactly one **hostility side**:

```text
HostilitySide(faction)
= fixed team identity, when the faction belongs to a fixed team
= faction identity, otherwise
```

For any two distinct active factions, the game-wide diplomatic relation is derived only from those immutable sides: members of the same `HostilitySide` are **allies**, and members of different `HostilitySide`s are **enemies**. V1 has no neutral or third diplomatic relation, and this ally/enemy relation does not change during the match. It is independent of `atWar`.

An unteamed Minor Faction is therefore its own hostility side. Members of the same hostility side can never be `atWar` with one another.

`atWar(sideA, sideB)` is symmetric. Controller-facing faction-pair queries normalize through these hostility sides, so if one member of Team A deliberately enters war with one member of Team B, every cross-team faction pair observes the same Team-A ↔ Team-B war state.

## 12.2 What creates directed hostility

War state is created or maintained only by an **accepted controller-facing action whose canonical semantics deliberately direct hostile force against an opposing side**. The V1 sources are:

- an active hostile Population `ATTACK` operation against a resolved target faction/side;
- an active hostile amphibious Transport operation whose accepted target was owned by an opposing side;
- an active controller-directed counter-response against an incoming operation from an opposing side;
- an accepted strategic-weapon launch deliberately targeted at an opposing side;
- any future controller-facing action only when its own public contract explicitly classifies it as direct hostility.

A persistent directed-hostility source has one resolved target hostility side when it commits. Later autonomous execution, ownership changes, collateral effects, or local target acquisition must not silently create an additional war relation with a different side. Re-targeting or newly directing hostile force against another side requires another accepted controller-facing hostile action under the relevant subsystem contract.

Rejected/invalid controller proposals never create or refresh `atWar`.

## 12.3 Autonomous violence is not war initiation

The following do **not** create or refresh `atWar` merely because they are violent or economically hostile:

- controller `MOVE_UNIT` strategic repositioning;
- autonomous Warship target acquisition, firing, Transport destruction, Trade-Ship capture, or recapture;
- autonomous Tank/Heavy-Artillery anti-armor combat;
- autonomous Train interception;
- autonomous SAM ship attack where an explicit rule permits it;
- collateral strategic-weapon damage to a side that was not the deliberately targeted side;
- Territorial/Operational Contact, observation, scouting, prospective targeting, or other non-committed intent.

Therefore two opposing autonomous military formations may fight while their hostility sides are not `atWar`, and autonomous fighting that continues during a post-war grace period does not keep the war state alive.

This distinction is intentional: `atWar` represents deliberate controller-directed faction hostility, not every consequence of autonomous weapons already operating in the world.

## 12.4 Persistent sources and 600-tick grace

The V1 post-hostility grace period is exactly:

```text
600 simulation ticks
= 60 seconds at the V1 10 Hz simulation cadence
```

This value is a ruleset-owned mechanic and is reproduced from the bound `ruleset_version`, never wall-clock time.

Conceptually, for one unordered pair of hostility sides:

```text
atWar
= at least one active persistent directed-hostility source
  OR currentTick < expiresAtTickExclusive
```

When a one-shot directed-hostility action such as a strategic-weapon launch commits at tick `t`:

```text
expiresAtTickExclusive
= max(expiresAtTickExclusive, t + 600)
```

While at least one persistent directed-hostility source remains active, the relation cannot expire. When the **last** persistent source between the two sides ends at tick `t`, the post-hostility grace begins:

```text
expiresAtTickExclusive = max(expiresAtTickExclusive, t + 600)
```

A newly accepted persistent or one-shot directed-hostility action during that grace keeps or returns the relation to active war and applies the same rules. Autonomous combat does not modify the expiry.

At exactly `currentTick == expiresAtTickExclusive`, and with no active persistent directed-hostility source, the relation is no longer `atWar`.

## 12.5 Unit consequences do not redefine the state

Focused unit/economy owners consume `atWar`; they do not own its timer or initiation rules.

In particular, baseline Tank/Heavy-Artillery autonomous Population attacks require the owner and target hostility sides to be currently `atWar`, while their autonomous anti-armor combat and Train interception do not. Warship autonomous combat/piracy similarly does not require or create `atWar`. External Trade/Train economic events consume the current relation when their subsystem says wartime treatment applies.

Origin/ruleset transformations may modify a consumer effect such as a wartime trade multiplier, but do not alter this lifecycle unless they explicitly define a game-wide hostility-state transformation.

## 12.6 Public observation and aggression history

Current `atWar` relations are coarse public match state. Player controllers and Official AI receive the same lawful pairwise query and transition information.

The public state does **not** expose or store as war-state semantics:

- who originally aggressed;
- retaliation rights or moral responsibility;
- a war score;
- last-hostile-action tick;
- the internal expiry tick;
- a treaty/peace state.

Characters/controllers that care who initiated aggression must retain that conclusion from lawful observed/controller history rather than treating `atWar` as an aggressor label.

## 12.7 Defeat and terminal cleanup

A hostility side participates in live `atWar` state only while it contains at least one `ACTIVE` faction.

Defeat/capitulation of one fixed-team member does not clear the team's relations while another member remains active. When the final active faction on a hostility side ceases to be active, all live `atWar` relations involving that side end immediately. Historical/replay records remain unchanged.

At terminal match completion, live war-state queries are no longer gameplay-relevant; replay reconstruction reproduces all prior transitions from the accepted controller actions, deterministic operation lifecycle, ticks, and bound ruleset.

Team communication available to controllers must be bounded, deterministic, and rules-visible rather than an unrestricted side channel.

---

# 13. Defeat and victory

Capitulation/defeat, remaining-territory ownership, team victory, and scenario victory are authoritative simulation outcomes rather than browser/client decisions.

Minor Factions do not participate as major victory contenders; their detailed behavior is owned by [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md).

Map/ruleset-specific victory thresholds must be deterministic and versioned. Systems that change the set of conquerable cells, such as optional permanent terrain conversion, therefore change the live victory denominator according to their canonical mechanics.

---

# 14. Focused gameplay systems

The following concerns are intentionally **not specified again here**:

- terrain, persistent structures, baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- territorial capture/counter-response arithmetic: [`COMBAT_TUNING.md`](./COMBAT_TUNING.md);
- FFY, Factory Trains, Trade Ships, piracy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Warships, Transports, strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Strategic Spawn: [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md);
- Segments: [`SEGMENTS.md`](./SEGMENTS.md);
- Minor Factions: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md).

Those documents own their mechanics and values.

---

# 15. Origins

An Origin defines what kind of faction a player is running. It is immutable for the match and uses the same public builder rules whether official or custom.

Origins may alter values or transform rules only through explicit rule-bearing traits. All legal trait combinations must resolve deterministically; the system must not depend on hidden hand-authored compatibility exceptions.

Exact trait definitions, costs, transformations, composition rules, and combination semantics are owned by [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md). The curated Official Origin roster is owned by [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md).

Origin mechanics must be surfaced through effective rules/mechanics so both player controllers and Official AI can reason about them without recreating hidden engine arithmetic.

---

# 16. Echoes

Echoes are collectible generated-name mechanical modifiers used primarily for build specialization rather than Origin-scale rule transformation.

Standard PvE may equip an Echo loadout according to the Echo subsystem's rules. Echo identity, acquisition, rolled magnitudes, duplicate handling, reward settlement, naming, collection behavior, persistence boundaries, and Gacha are owned only by [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md).

The design invariant retained here is simply that Echoes remain a specialization/progression axis distinct from controller skill and Origin identity.

---

# 17. Official PvE AI

Official AI uses the same surfaced game information and legal action model as player controllers. It receives no hidden strategic information merely because it is server-authored.

Baseline/character architecture, preset difficulties, allowed Origin pools, trait support, and character behavior are owned by the [`official-ai`](./official-ai/README.md) documentation/configuration family.

Echo reward consequences of defeating AI are owned by `ECHO_CATALOGUE.md`, not by the AI documents or this design contract.

---

# 18. Observability and debugging

The game should support structured diagnostics for controller development, certification, replay analysis, and authoritative runtime failures.

Player-facing/controller-facing debug information must respect the same visibility/security boundaries as ordinary observations. Debugging must not become a side channel for hidden state.

The browser may visualize controller-authored annotations and server diagnostics, but debug surfaces are non-authoritative.

---

# 19. Authentication and external integration

Open Fufu authenticates pre-provisioned external identities and does not own admission policy. Normal login must not require runtime access to Foof, Fufubox control infrastructure, or another external policy service.

Exact identity/session/provisioning semantics are owned by [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md).

The external/browser/game service API and participant protocol require their own canonical target contract; they must not be improvised by spreading endpoint/protocol fragments through unrelated design files.

---

# 20. Design invariants

The following are the game-wide invariants this document owns:

1. The player programs a controller rather than manually micro-managing the faction during ordinary play.
2. One server-side authoritative simulation owns each match.
3. Player controllers are untrusted and operate only through deterministic surfaced observations/actions.
4. Historical matches bind versioned rule-bearing inputs and remain deterministically replayable.
5. The controller, Origin, and Echoes are distinct power-expression layers.
6. Population is one global faction resource; Population Capacity comes from owned population-bearing cells.
7. Land offense uses finite operation commitments and cell-resolved actionable frontage.
8. Passive automatic defense is binary per threatened owned cell and consumes Available Population without manual defensive quantity allocation.
9. Active counter-response is a separate operation-vs-operation Population commitment, not passive cell reinforcement.
10. Ordinary hostile land casualties are capture-coupled unless another explicit mechanic says otherwise.
11. There is no privileged engine-level `Front` strategy object; controllers derive higher-level strategy from surfaced primitives.
12. Strategically meaningful modifiers come from explicit surfaced rule-bearing sources rather than hidden corrective bonuses.
13. Focused subsystem documents own their detailed mechanics; this contract does not shadow-copy them.
14. `atWar` is symmetric team-normalized recent controller-directed hostility with a ruleset-bound 600-tick post-hostility grace; autonomous unit violence does not itself create or refresh it.
15. Tactical operational visibility is requester-relative and uses one authoritative projection with explicit-public/direct-reveal/concealment/remote-observation precedence; player controllers, Official AI, derived/debug surfaces, and ID-addressable helpers receive no hidden-state bypass.