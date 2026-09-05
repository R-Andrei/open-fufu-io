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

Origin-specific growth-profile transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

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

## 8.1 Neutral expansion

Neutral territory has no automatic Population defender.

A successfully acquired neutral population-bearing cell costs **1 Population** from the expansion commitment under the baseline ruleset. This is settlement/occupation cost, not combat against a phantom defender.

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

For each successfully captured **automatically defended population-bearing hostile cell** under the baseline rule:

- the previous owner loses the one Population defending that cell;
- the winning offensive commitment loses one Population;
- Capacity transfers with population-bearing-cell ownership.

If the hostile-owned cell had no automatic Population defender, ordinary hostile cell capture causes no baseline capture casualty for either side. Other explicit mechanics may still cause Population loss independently.

In multi-faction combat, finite same-faction pressure is aggregated before resolution. A cell changes owner at most once per tick; deterministic simultaneous-resolution rules choose the successful claimant. Unsuccessful third-party claimants do not lose Population merely because they contested the same cell.

---

# 11. Retreat and territorial abandonment

Ending/reducing an offensive or counter-response commitment returns surviving Population to Available immediately on a successful controller decision.

Deliberately relinquishing owned territory is a separate political/spatial action. It must not be represented indirectly through withdrawal side effects.

---

# 12. Teams, diplomacy, and hostility state

Fixed-team modes use explicit immutable team membership for the match. Team members are allies rather than opponents for victory/reward accounting where the relevant subsystem says so.

Open Fufu V1 has no declaration-of-war, treaty, negotiated-peace, relation-score, war-score, or mutable-diplomacy subsystem. `atWar` is instead a **symmetric deterministic state of recent controller-directed hostility** used by mechanics that need a stable notion of active war.

## 12.1 Hostility sides and symmetry

For war-state purposes, each active faction belongs to exactly one **hostility side**:

```text
HostilitySide(faction)
= fixed team identity, when the faction belongs to a fixed team
= faction identity, otherwise
```

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