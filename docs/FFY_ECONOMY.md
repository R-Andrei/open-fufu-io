# Open Fufu — FFY Economy Registry

## Status and authority

This file is the **canonical owner for baseline Open Fufu FFY economy, Factory Train service/economic behavior, Trade Ship traffic/cargo, and piracy economics**.

Neighboring concerns are owned elsewhere:

- physical rail topology, station attachment, connectivity, and rail-routing semantics: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- persistent Factory/Port structure construction and level mechanics: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Warship combat and Transport/strategic-weapon mechanics: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Origin-specific economic transformations: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

The rules and values below are the accepted provisional V1 baseline. Numeric values may be retuned through versioned balance changes without reopening the subsystem architecture.

---

# 1. V1 economy baseline

FFY is Open Fufu's primary in-match currency.

The baseline game does **not** assign Population to an `economy` bucket in exchange for FFY.

```text
Starting FFY = 25,000
Baseline passive FFY income = 1,000 FFY / second
```

The passive source is flat and non-spatial. It does not intrinsically scale with Population, Capacity, territory, structures, units, or controller allocation.

It is an **All FFY** source. Ordinary faction-wide All-FFY modifiers remain eligible when their defining rule applies to this source. More specific Industrial, Naval/trade, or Military/conquest modifiers do not apply, and a non-spatial passive source cannot satisfy a modifier that requires an event location, unless an explicit rule establishes otherwise.

## 1.1 Passive tick resolution

Passive FFY resolves once per authoritative simulation tick. The simulation cadence itself is owned by [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md); at the current `10 Hz` cadence, the baseline `1,000 FFY / second` is a nominal `100 FFY / tick` before eligible earning-side modifiers and the whole-FFY finalization in §3.

For simulation tick `T`, passive earning uses one deterministic faction earning-state snapshot:

```text
1. apply accepted deterministic inputs scheduled for T
2. freeze the passive earning-state snapshot for T
3. resolve every passive source and eligible earning-side modifier from that same snapshot
4. only then run autonomous tick systems that may mutate earning-relevant state
```

Population, Capacity, territory, structures/charge state, faction status, or other earning-side state changed by autonomous resolution after that snapshot cannot retroactively change passive FFY for `T`; it first affects passive earning on `T + 1`.

Only a faction whose status is `ACTIVE` in the passive earning-state snapshot earns passive FFY. `CAPITULATED` and `DEFEATED` factions earn zero passive FFY. An accepted capitulation applied before the snapshot therefore suppresses passive earning on that same tick. A faction that becomes defeated only during later autonomous resolution has already resolved that tick's passive earning and stops receiving passive FFY from the next tick onward. Changing status does not by itself erase or reset an existing FFY balance.

Every source explicitly classified by its defining owner as a global/general passive FFY source uses this same passive snapshot and ordinary All-FFY earning path. The source-specific formula remains owned by the rule that defines that source. The baseline source being flat/non-spatial means only that it has no intrinsic Population/Capacity/territory/structure scaling and no event location; it does **not** exempt the source from explicit faction-wide All-FFY modifiers. Conversely, location-conditioned earning modifiers that require an event location cannot apply to a non-spatial passive source.

---

# 2. Broad FFY event families

Ordinary yield modifiers use four broad source families:

- **All FFY**;
- **Military / conquest FFY**;
- **Naval / trade FFY**;
- **Industrial FFY**.

Individual event identities remain distinct internally for simulation, replay, and debugging even when they share a modifier family.

Ordinary same-axis yield percentages add before multiplication unless an explicit structural rule says otherwise.

---

# 3. Modifier ordering and loss/cost semantics

For an ordinary positive FFY event:

```text
1. determine base event value
2. apply explicit structural/event transformations
3. collect eligible ordinary yield percentages
4. add percentages on the same yield axis
5. apply the resulting yield multiplier
6. clamp ordinary positive-event yield at >= 0
7. apply explicit hard-zero rules
8. floor the finalized award once to whole FFY
```

FFY-yield modifiers affect positive income events. They do not automatically modify purchase prices, Transport embarkation costs, explicit losses/penalties, or other negative currency transactions.

### Whole-FFY numeric finalization

Authoritative FFY is a **whole-unit integer currency**. Authoritative balances, finalized positive awards, stored finalized FFY reference values, and finalized affordability-gated costs contain no fractional FFY.

All arithmetic within one FFY calculation remains exact through the owning rule/effective-rule pipeline until the single finalization boundary. Implementations must not round after individual modifiers or make the canonical whole-FFY result depend on an approximate floating-point intermediate when exact rule operands are available.

Finalization is deterministic by economic class:

- an ordinary positive FFY award is **floored once** to whole FFY after all structural transformations, eligible yield composition, non-negative clamp, and hard-zero processing;
- an affordability-gated FFY cost is calculated through its owning cost rules first, then any positive exact cost is **ceiled once** to whole FFY before affordability and payment; an exact zero remains zero;
- an explicit signed FFY consequence remains exact through same-fact and same-tick aggregation, then the final same-tick signed delta is **truncated toward zero once** to whole FFY before the non-negative balance floor is applied.

Each distinct positive FFY earning source/event is its own finalization unit. Its complete applicable calculation is finalized once; distinct positive earnings are not pooled merely to recover fractional remainders that would otherwise be discarded.

There is no authoritative fractional balance, FFY subunit, residual/carry state, or cross-tick fractional accumulator. A fractional remainder discarded at one finalization boundary never contributes to a later tick/event/transaction. For example, an exact passive result of `0.75 FFY` for one tick awards `0 FFY` for that tick; the discarded `0.75` is not carried forward.

FFY balances are canonically **non-negative**. Explicit signed FFY consequences use a deterministic two-level aggregation rather than applying a balance floor to each debit/credit in incidental execution order.

First, one authoritative economic fact combines all of its own signed components exactly:

```text
factRequestedDelta
= sum(all signed FFY components for this atomic economic fact)
```

Then, for each faction and simulation tick `T`, all explicit signed FFY facts resolving on `T` are combined exactly into one tick-stage delta:

```text
tickSignedDelta[faction, T]
= sum(factRequestedDelta for that faction on T)

finalizedTickSignedDelta[faction, T]
= truncateTowardZero(tickSignedDelta[faction, T])
```

Ordinary positive FFY events resolving on `T` are finalized first. The signed stage then applies exactly once per faction:

```text
balanceAfterSignedStage
= max(0, balanceAfterOrdinaryPositiveEventsForTick + finalizedTickSignedDelta[faction, T])
```

The whole-unit truncation therefore occurs only after both **same-fact** component netting and **same-tick** signed-fact netting, and the balance floor occurs only after that finalization. Reordering signed facts within the tick cannot change the resulting balance. Explicit signed transactions are not ordinary positive FFY events and do not acquire positive-event yield modifiers merely because their net delta is positive.

Purchase prices, Transport embarkation costs, strategic-weapon costs, and other affordability-gated spending transactions are **not** folded into this signed-consequence stage; they retain their own canonical validation/payment transactions. Their effective positive FFY cost is ceiled once at the FFY payment boundary described above before affordability is tested. V1 creates no FFY debt, and subsequent affordability/spending consumes the resulting non-negative authoritative balance.

## 3.1 P05 structure-transfer conquest event

P05 **Big Shot** consumes the canonical persistent-structure capture result rather than defining another capture path.

Exactly one P05 **Military / conquest FFY** event is produced for each enemy persistent structure that reaches the canonical `STRUCTURE_TRANSFERRED` capture consequence for a P05 holder. A structure that is destroyed on capture, rejected by transfer admission, or otherwise never reaches `STRUCTURE_TRANSFERRED` produces no P05 event.

The event's ordinary base value is:

```text
P05BaseValue
= ordinary baseline L1 build price
  of capturedStructure.type
```

The structure price registry in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) is the single canonical owner of those prices. This document intentionally does not duplicate that table.

The P05 base value depends only on the physical structure type. It does **not** depend on:

- the structure's current completed level;
- an in-progress construction or upgrade target level;
- the amount any owner actually paid;
- purchase/upgrade discounts, free-purchase rules, grants, or other transaction history;
- current health/damage state;
- P34 conquered-Factory effectiveness or any other post-transfer structure profile.

Therefore an L1 and L5 structure of the same type produce the same P05 base value, and an existing physical structure that successfully transfers while construction or an upgrade is in progress still uses that type's ordinary L1 price.

The canonical P05 event location is the captured structure's **physical occupied cell**.

For simulation tick `T`, every P05 event caused by a successful territorial capture whose ownership change resolves on `T` evaluates **all mutable earning-side inputs** from the same authoritative **capture-tick earning-state snapshot** for its capturing faction. That snapshot is taken after the authoritative successful territorial-capture claimant/result set for `T` is fixed, but before **any** successful territorial ownership mutation for `T` — structure-bearing or structureless — and before any structure fate or capture consequence for `T` is committed.

The snapshot includes every mutable input that the ordinary positive-event pipeline would otherwise read while resolving P05, including faction-wide derived earning state such as terrain-share All-FFY effects, the captured cell's terrain identity, qualifying structure-field membership, and effective Origin/Echo/ruleset modifiers already in force for the capturing faction.

The structure-capture resolver may subsequently determine that a particular occupied-cell capture transfers or destroys its structure. Only final `STRUCTURE_TRANSFERRED` results emit P05, but every emitted P05 event still consumes the capturing faction's frozen earning-state view from the tick boundary above.

State changed or created by **any** ownership change on that same tick therefore cannot retroactively change a P05 event from that tick. In particular:

- gaining or losing a structureless Desert cell on `T` cannot change Desert-share All-FFY for a P05 event resolving on `T`;
- a captured Desert structure cell cannot first change Desert share and then alter its own or a sibling P05 payout;
- a newly captured Fort or SAM Launcher cannot make its own or a sibling P05 payout newly qualify for a Fort/SAM field merely because one internal consequence happened to process first.

The P05 event then follows the ordinary positive-event pipeline in this section using that frozen capture-tick earning-state snapshot. P14/N04 consume the captured cell's frozen underlying terrain identity; P24/N11 consume whatever qualifying effective Fort/SAM field the structure-field owner says existed at that cell in the same snapshot. Exact Fort/SAM field geometry and affiliation remain owned by `TERRAIN_AND_STRUCTURES.md` and its structure-field contract. This fixes P05's event location and temporal sampling boundary without duplicating Fort/SAM membership mechanics.

Given the same pre-mutation state and same authoritative territorial-capture results for `T`, P05 values are invariant to incidental ordering of structureless ownership commits, structure admission/fate resolution, and capture-consequence iteration.

---

# 4. Factory Train service

Physical rail topology, Factory-loop generation/regeneration, station attachment, shared-rail provenance, connectivity, and deterministic rail/path tie semantics are owned by [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md). This section consumes each Factory's stored ordered service loop and owns Train dispatch, movement/event timing, ownership epochs, and economics.

Factories produce autonomous physical Trains. Each dispatched Train snapshots the Factory's current ordered physical service loop and follows that exact loop for its lifetime; after dispatch it never asks the global rail graph which branch to choose at an intersection.

Baseline Train speed is **25 rail cells/second**. At the authoritative `10 Hz` simulation cadence, movement may use an exact integer work representation equivalent to `2.5 rail cells/tick`; no floating authoritative position is required.

Generated rail is capacity-free for Train traffic in V1. Multiple Trains may occupy the same rail cell or edge. Trains do not collide, block one another, signal, queue, or require right-of-way arbitration.

## 4.1 Factory Train-service ownership epoch and dispatch

Factory Train scheduling is owner-scoped operational state rather than an indivisible part of the physical structure state.

Each owned Factory has one current **Train-service ownership epoch** containing primary-service scheduler state and any owner-specific scheduler state such as P07's normal-primary-dispatch phase. The epoch is serialized/replayed as authoritative state; implementations must not reconstruct it from aggregate Train history.

Each ownership epoch supports at most **one active primary Train**. A freshly operational Factory or freshly created ownership epoch is immediately dispatch-ready once the Factory has a valid non-empty stored service loop. There is no artificial initial 5-second wait. If no service loop exists, no Train is created and the epoch remains dispatch-ready until a valid loop becomes available.

When a primary Train returns or is destroyed on tick `T`, its epoch starts a **50 active-scheduler-tick / 5-second turnaround**. If the Factory remains continuously active, the next primary becomes dispatch-eligible on exactly `T + 50`. Temporary Factory inactivity pauses the remaining turnaround and scheduler progression; inactive ticks do not consume the remaining wait. Inactivity does not freeze already-dispatched physical Trains.

Factory upgrades preserve the current service epoch. A successful Factory ownership transfer atomically closes the old owner's epoch and creates a fresh epoch for the new owner. The new epoch inherits no old-owner turnaround, primary occupancy, or P07 phase. The physical Factory and its current physical loop infrastructure remain governed by the physical-rail/structure owner.

Every dispatched Train snapshots both the Factory loop and the Factory economic profile that apply at dispatch. If the Factory later transfers while an old-owner Train is still in flight:

- the Train remains owned by its dispatching owner;
- it completes its snapshotted loop and retains its dispatch-time Factory economic profile;
- it does not occupy or block the new owner's primary-service slot;
- its return, termination, or destruction cannot mutate the new ownership epoch's turnaround or P07 phase;
- after completing its old-epoch loop it terminates normally rather than transferring ownership or attaching to the new epoch.

Origin-specific scheduler transformations, including P07, are owned by [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

## 4.2 Station traversal and dwell

A Train station event is triggered only by physical **entry into** the occupied cell of a currently active completed City or Port that lies on the Train's snapshotted loop. Adjacency never counts. Station ownership does not affect this physical qualification.

Current station existence, type, activity, completed state, and ownership are sampled when the event would resolve. A structure removed, inactive, or not yet completed at that traversal produces no Train station event and no paying dwell merely because its cell was present in the stored loop.

On a qualifying paying entry:

1. movement for that Train stops immediately for the current tick;
2. unused movement work for that tick is discarded;
3. the station event is created for same-tick economic settlement subject to §4.4 interception precedence;
4. dwell begins with `resumeAtTick = arrivalTick + 15`.

The Train performs no movement while `currentTick < resumeAtTick` and may resume on exactly `arrivalTick + 15`. Remaining on the station cell during dwell emits no additional event. Leaving and later re-entering the same qualifying station cell creates another event and another dwell. There is no hard per-tour payout/event cap.

A Factory loop may therefore service more than five stations when additional eligible structures lie incidentally on its physical path. The physical loop owner defines construction-target selection and loop regeneration; this economy consumes every qualifying station entry actually encountered by the Train.

## 4.3 Train FFY event value and state sampling

Each qualifying station event is an **Industrial FFY** event owned by the Train owner. The canonical event location is the traversed station structure's occupied `cellId` at event resolution.

Its ordinary base value is determined by the originating Factory's completed level at dispatch:

| Factory level | Base Train event value |
| ---: | ---: |
| **L1** | **10,000 FFY** |
| **L2** | **11,250 FFY** |
| **L3** | **12,500 FFY** |
| **L4** | **13,750 FFY** |
| **L5** | **15,000 FFY** |

Dispatch snapshots only the Factory-side base profile: the originating Factory's completed level plus any explicit Factory-specific transformation of Train-event **base value**. All station events and pending interception cargo for that Train use this dispatch-time Factory profile for the Train's lifetime. Later Factory upgrade, transfer, or loss of an owner-specific Factory transformation does not retroactively alter it.

P34 is the current V1 Factory-specific base-value transformation: a Train dispatched from a qualifying P34 conquered Factory snapshots a `1.50×` Factory Train-event base-value multiplier. That multiplier is applied at step 2 of the FFY ordering in §3, before ordinary earning-side yield percentages. P34 does not modify Train speed, physical loop geometry, dwell, turnaround, service capacity, or P07 cadence.

Ordinary earning-side state is **not** dispatch-snapshotted. At station-event resolution, evaluate the Train owner's then-current ordinary earning-side state at the canonical station cell, including applicable P14/N04 terrain qualification, P24/N11 structure-field qualification, All-FFY/Industrial-FFY yield state, and the current external `atWar` relation. A qualifying external station currently at war with the Train owner uses the ordinary wartime external-trade multiplier from §6. A foreign station receives no automatic payout merely for being traversed.

P33 consumes this same canonical Train economic-event identity. When the qualifying station is a City currently owned by a P33 holder, P33 grants `20 × current completed City level` Available Population to that current City owner, Capacity-capped, independently of the final FFY amount. Exact trait semantics remain owned by `ORIGIN_TRAIT_CATALOGUE.md`.

## 4.4 Train interception / land piracy

For its next eligible paying station entry, a Train carries pending base cargo equal to its dispatch-time Factory event base value after any explicit Factory-specific base-value transformation such as P34.

After Train movement for tick `T`, legal Tank/Train interception resolves **before** a pending Train station payout commits. Physical Tank interception legality, range, cadence, target selection, and chassis capability are owned by [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md).

If a Train enters a paying station on `T` and a hostile Tank legally intercepts it on that same tick before settlement:

- the pending Industrial event is canceled;
- the Train is destroyed;
- the Tank owner receives a **Military / conquest FFY** event whose base value equals the Train's pending base cargo;
- the raider's own eligible yield modifiers apply;
- previously resolved Train station events are not clawed back.

A Train destroyed away from a newly pending paying entry likewise cancels any still-pending next payout carried for interception purposes; destruction never retroactively reverses earlier settled events.

## 4.5 Same-tick autonomous order

For the Train/Factory seam, authoritative tick order is:

```text
accepted inputs
-> passive FFY snapshot/resolution
-> land/capture
-> structure lifecycle/transfer/completion
-> Factory loop/epoch reconciliation + dispatch
-> Train movement
-> legal Tank/Train interception
-> surviving Train station-event settlement
-> final authoritative state
```

Consequently:

- a Factory that becomes operational on tick `T` may reconcile/create its physical service loop and dispatch on `T`;
- a Factory transfer on `T` establishes the fresh owner epoch before Train dispatch for `T`;
- a City or Port completing on `T` is eligible for same-tick Factory-loop service/regeneration decisions;
- an old-owner in-flight Train remains bound only to its old loop/economic snapshots;
- same-tick legal interception outranks a newly pending station payout as specified in §4.4.

Origin-specific Train transformations are defined only in `ORIGIN_TRAIT_CATALOGUE.md`.

---

# 5. Trade Ship traffic and cargo

## 5.1 Speed and dispatch cadence

Baseline Trade Ship speed is:

```text
10 water cells / second
```

Baseline Trade Ship routing traverses **Deep Water only**. `SHALLOW_WATER` is not a legal Trade Ship route cell and does not contribute to Trade Ship reachability.

Every active Port with at least one legal reachable foreign Trade destination maintains its own independent deterministic dispatch timer.

After the Port becomes active and after every successful dispatch, the next ordinary dispatch delay is a deterministic match-RNG value in:

```text
20–30 seconds
mean target: 25 seconds
```

Dispatch frequency is not throttled by ships already in flight, faction/global Trade Ship count, route length, or previous-voyage completion time. Long routes therefore create more simultaneous traffic naturally because ships remain in flight longer.

If no legal foreign destination exists when a dispatch would occur, no ship is created; retry scheduling is deterministic and must not allow manufactured extra dispatches when a destination becomes available.

## 5.2 Raw cargo value

```text
rawCargo = 150 FFY × planned water-route length in cells
```

Planned route length and raw cargo are snapshotted when the voyage launches.

| Planned route length | Raw cargo |
| ---: | ---: |
| 100 | 15,000 FFY |
| 250 | 37,500 FFY |
| 500 | 75,000 FFY |
| 1,000 | 150,000 FFY |
| 1,500 | 225,000 FFY |
| 2,000 | 300,000 FFY |

## 5.3 Launch-time owner-success value (`Vowner`)

Every launched Trade voyage stores one immutable **owner-side success reference value**:

```text
Vowner
= the finalized ordinary positive uncaptured Trade-success value
  predicted once at launch from the original owner's launch-time state,
  using the launch-time planned destination cell as the valuation location,
  with the external wartime-trade multiplier stage omitted
```

`Vowner` begins from that voyage's snapshotted `rawCargo`. Its launch-time valuation then applies the ordinary positive-event semantics from §3 that are eligible for the original owner's ordinary Naval/trade success event, including:

- explicit owner-side structural/event transformations that belong before ordinary yield;
- ordinary eligible All-FFY and Naval/trade yield modifiers;
- ordinary eligible location-conditioned FFY modifiers evaluated at the **planned destination Port cell at launch**;
- the ordinary non-negative positive-event clamp and any applicable hard-zero rule.

`Vowner` intentionally excludes:

- the current `atWar` relation and the external wartime-trade multiplier from §6;
- P08's replacement of that wartime multiplier;
- N14 and N16 themselves;
- piracy/final-holder modifiers such as P30;
- destination-owner earning modifiers or any other rule that would not belong to the original owner's ordinary positive Trade-success event;
- any rule, territory, field, ownership, Origin/Echo state, or other modifier acquired only after launch.

The omission of wartime state is deliberate. Ordinary external Trade payout evaluates `atWar` at **event resolution**, while `Vowner` is a launch-time reference amount. Snapshotting the launch-time war relation into `Vowner` would silently turn an event-resolution rule into a launch rule.

The launch-time planned destination cell is the immutable `Vowner` valuation location. If the physical voyage later reroutes, changes destination ownership, or loses access to that original Port, neither the valuation cell nor `Vowner` is recomputed.

`ownerSuccessValueFfy` stores the canonical finalized **whole-FFY** amount produced by the launch-time ordinary positive-event calculation. `Vowner` does not define a second rounding policy: the calculation remains exact through the eligible §3 pipeline and is floored once at that section's ordinary positive-award finalization boundary before the value is stored.

The physical voyage/cargo identity serializes enough authoritative economic state to restore the immutable launch snapshot without consulting mutable current match state. At minimum the economic snapshot binds:

```text
TradeVoyageEconomicSnapshotV1 {
    originalOwnerId
    sourcePortId
    launchDestinationPortId
    valuationCellId
    plannedRouteLengthCells
    rawCargoFfy
    ownerSuccessValueFfy   // Vowner
}
```

The immutable economic snapshot is distinct from mutable voyage lifecycle state. Each in-flight voyage also serializes at least:

```text
TradeVoyageLifecycleStateV1 {
    firstHostileCaptureResolved: boolean
}
```

`firstHostileCaptureResolved` starts `false`, becomes `true` atomically when the first valid hostile capture resolves, and never returns to `false` on recapture or rerouting. Once it becomes `true`, the original uncaptured commercial-completion path is permanently canceled for that voyage.

Replay/regeneration from the same versioned launch state must reproduce the same `rawCargo` and `Vowner` and may verify them against the serialized values. Save/load restoration consumes the serialized economic snapshot rather than recalculating `Vowner` from present-day terrain, fields, ownership, or modifiers, and separately restores the serialized mutable voyage lifecycle state rather than inferring whether a first hostile capture already occurred from current ownership.

`Vowner` is **not** the authoritative later ordinary Trade payout. It is a fixed reference amount consumed only by rules that explicitly name the snapshotted owner-side voyage value. An uncaptured ordinary Trade completion still resolves its actual positive event at completion under the then-current ordinary event rules unless an Origin transformation replaces that completion consequence.

## 5.4 Destination selection

Each active source Port chooses among currently legal reachable **foreign** Ports using a deterministic least-recently-selected policy.

```text
eligibleDestinations
= reachable active Ports whose owner != source owner

destination
= eligible destination least recently selected by this source Port
```

A never-selected destination is older than every previously selected destination. Equal-age ties use a stable deterministic seeded order derived from rule-bearing match state and source/destination identities.

Distance does not affect destination selection. Peaceful factions, fixed teammates, and factions currently at war are all foreign destinations when otherwise legally reachable.

The selected destination and planned route length are snapshotted at launch.

If the destination changes owner but remains active, reachable, and foreign, the vessel continues to that physical Port. If it becomes invalid, the ship reroutes using the same policy without recomputing the voyage's snapshotted cargo value or `Vowner`.

If no legal foreign destination remains during an uncaptured voyage, the Trade Ship returns to a reachable owned active Port and terminates without an ordinary Trade payout.

## 5.5 Ordinary completion

On successful ordinary completion, the Trade Ship owner receives one **Naval / trade FFY** event derived from the voyage. The destination Port owner receives no automatic payout merely for being the destination.

The actual ordinary completion event is resolved at completion; it is not replaced by `Vowner`. In particular, current event-resolution `atWar` state and any other ordinary resolution-time inputs remain authoritative for the actual payout. `Vowner` exists only where an explicit trait consumes the launch-time reference value.

---

# 6. External wartime trade

External maritime and rail trade remains possible while `atWar`.

The ordinary earning-side wartime multiplier is:

```text
0.50×
```

The game-wide `atWar` lifecycle is owned by [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). Each qualifying external Train or Trade payout evaluates the current `atWar` relation at the moment that economic event resolves; launch/dispatch-time war state is not snapshotted for later payout.

Autonomous Train interception and autonomous Warship capture/recapture of Trade Ships do not themselves create or refresh `atWar`. They remain raiding/piracy behavior under their own mechanics while this economy consumes only the canonical game-wide war state.

Origin/ruleset transformations may explicitly modify this multiplier; those transformations are owned by their defining catalogue/ruleset.

---

# 7. Trade Ship capture, recapture, and piracy

A Trade Ship carries one physical cargo through its voyage. Hostile capture does **not** mint ordinary piracy FFY immediately, and one cargo can produce at most one terminal cargo payout.

## 7.1 Capture prerequisite

A hostile Warship may capture a Trade Ship only when the Warship's faction has at least one reachable owned active Port on the relevant water network/component to which the cargo can legally be delivered.

## 7.2 Captured cargo lifecycle

A hostile capture checks the voyage's serialized `firstHostileCaptureResolved` state.

When a valid hostile capture resolves while that state is `false`, the same atomic voyage transition:

- cancels the original ordinary commercial-completion path permanently;
- collects any first-hostile-capture signed owner-adjustment components supplied by the active Origin rules and processes them under §7.3;
- sets `firstHostileCaptureResolved = true`;
- leaves the physical cargo aboard the vessel;
- pays no ordinary piracy FFY immediately;
- routes the vessel toward a legal reachable owned active Port of its current holder.

When a later hostile capture or recapture occurs with `firstHostileCaptureResolved == true`, the physical ownership/routing transition proceeds normally but **no first-hostile-capture owner adjustment can fire again** and ordinary uncaptured commercial completion remains canceled.

If the delivery Port becomes invalid, captured cargo retargets another legal reachable owned active Port. If none exists, it remains physically in play without paying out until delivery again becomes possible, it is recaptured, or it is destroyed.

## 7.3 Original-owner signed voyage transactions

`ORIGIN_TRAIT_CATALOGUE.md` is the canonical owner of which Origin trait creates a signed voyage adjustment, its trigger, and its sign/reference amount. This FFY subsystem owns the `Vowner` reference, deterministic aggregation/execution of those signed components, the non-negative balance floor, lifecycle persistence, and separation from ordinary positive-event yield processing.

For one authoritative voyage fact, every applicable Origin-supplied signed component is first combined into that fact's requested delta:

```text
requestedOwnerDelta
= sum(applicable signed voyage components for this atomic fact)
```

That fact-level delta is then queued into the owner's `tickSignedDelta` under §3; it is **not** independently balance-floored at the point where the voyage fact is processed.

For the current catalogue, first hostile capture may supply `-Vowner` from N14 and `+Vowner` from N16. Those catalogue-owned components therefore derive these conformance results:

```text
N14 only       -> requestedOwnerDelta = -Vowner
N16 only       -> requestedOwnerDelta = +Vowner
N14 + N16      -> requestedOwnerDelta = 0
```

The combined N14+N16 result is one net signed transaction of the same first-capture fact. Implementations must not perform a balance-floor-sensitive debit followed by a separate credit and merely hope they cancel. When both components are present, the fact-level requested delta is `0` before same-tick aggregation or the balance floor is consulted.

Likewise, when an Origin rule replaces successful uncaptured Trade completion with an explicit signed owner transaction, FFY suppresses the ordinary positive Trade-success payout and queues the catalogue-supplied signed component through the same fact-net -> tick-net -> floor pipeline. The current N16 transformation supplies `-Vowner` on that successful uncaptured path. Paths that do not satisfy the catalogue-defined replacement trigger — such as destruction or return/termination without successful uncaptured completion — create no such replacement transaction.

These signed owner transactions are **not ordinary positive FFY events** and are not run through All-FFY, Naval/trade, P14/P24, N04/N11, P08, P30, or other positive-event yield transformations a second time. Any launch-time positive-event modifiers included in `Vowner` have already contributed exactly once to the stored reference amount.

The signed owner transaction does not change the physical cargo lifecycle. The same cargo remains available for recapture, destruction, or one terminal captured-cargo payout below.

## 7.4 Terminal captured-cargo payout

Successful captured-cargo delivery uses:

```text
base captured-cargo value = original rawCargo
```

A hostile final holder receives a **Naval / trade piracy FFY** event and applies its own eligible modifiers. If the original owner recaptures and returns the spoiled cargo, it may recover the same one cargo value as a Naval/trade recovery event.

`Vowner` is not substituted for this physical-cargo value. Origin-defined original-owner voyage adjustments and physical piracy/recovery are separate economic consequences; piracy/recovery continues to value the actual captured cargo from original `rawCargo` under the final holder's/recovering owner's ordinary eligible event rules.

If cargo changes hands repeatedly, only the faction that ultimately completes legal delivery receives the terminal cargo payout. Destruction before delivery yields `0` terminal cargo payout.

Origin-specific selection, trigger, and sign/reference semantics for capture/loss/inversion/piracy transformations are defined only in `ORIGIN_TRAIT_CATALOGUE.md`; this FFY owner defines the ordinary voyage/cargo lifecycle and execution of the resulting economic consequences.

---

# 8. Faction elimination

Ordinary faction defeat gives:

```text
0 universal FFY
```

Capitulation or defeat stops subsequent passive FFY accrual under §1.1 but does not erase or reset the faction's existing authoritative FFY balance. A later status transition does not retroactively cancel any already-valid same-tick economic fact unless that fact's owning mechanic explicitly specifies cancellation. Remaining unspent FFY is not awarded through a universal last-hit bounty. Explicit scenario/objective rewards may define their own events.