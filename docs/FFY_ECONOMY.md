# Open Fufu — FFY Economy Registry

## Status and authority

This file is the **canonical owner for baseline Open Fufu FFY economy, Factory Train service/economic behavior, Trade Ship traffic/cargo, and piracy economics**.

Neighboring concerns are owned elsewhere:

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

The passive source is flat and non-spatial. It does not scale with Population, Capacity, territory, structures, units, or controller allocation.

It is an **All FFY** source. More specific Industrial, Naval/trade, Military/conquest, or spatial modifiers do not apply unless an explicit rule says otherwise.

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
```

FFY-yield modifiers affect positive income events. They do not automatically modify purchase prices, Transport embarkation costs, explicit losses/penalties, or other negative currency transactions.

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

Every P05 event in one deterministic capture-resolution batch evaluates **all mutable earning-side inputs** from one authoritative frozen **pre-transfer / pre-batch earning-state snapshot** taken before that batch's cell/structure ownership mutations and capture consequences are committed. The snapshot includes every mutable input that the ordinary positive-event pipeline would otherwise read while resolving P05, including faction-wide derived earning state such as terrain-share All-FFY effects, the captured cell's terrain identity, qualifying structure-field membership, and effective Origin/Echo/ruleset modifiers already in force for the capturing faction.

State changed or created by any capture in that same batch therefore cannot retroactively change any sibling P05 event. In particular, captured Desert territory cannot first change the capturer's Desert-share All-FFY bonus and then affect a later P05 consequence in the same batch, and a newly captured Fort or SAM Launcher cannot make its own or a sibling P05 payout newly qualify for a Fort/SAM field merely because the transfer has already been processed internally.

The P05 event then follows the ordinary positive-event pipeline in this section using that frozen earning-state snapshot. P14/N04 consume the captured cell's frozen underlying terrain identity; P24/N11 consume whatever qualifying effective Fort/SAM field the structure-field owner says existed at that cell in the same frozen snapshot. Exact Fort/SAM field geometry and affiliation remain owned by `TERRAIN_AND_STRUCTURES.md` and the focused structure-field closure. #48 therefore fixes P05's event location and temporal sampling boundary, but does not invent unresolved Fort/SAM membership rules.

Because every sibling P05 event in the batch consumes the same pre-batch earning-state snapshot, payouts are invariant to incidental consequence iteration order.

---

# 4. Factory Train service

Factories produce autonomous physical Trains. Each Factory supports at most **one active primary Train** at a time.

Baseline service rules:

- **Train speed:** `25 rail cells/second`.
- A Factory may dispatch its next primary Train only after the prior primary Train returns to the originating Factory or is destroyed, followed by a **5-second turnaround**.
- Each normal dispatch selects up to **five distinct connected eligible City/Port stations** as route-construction targets. Five is a target count, not an event cap.
- Target selection uses a deterministic rotating/shuffled service queue so large connected networks are not permanently reduced to the nearest few stations.
- Route ordering/path construction minimizes expected travel time for a finite closed tour beginning and ending at the originating Factory. With uniform rail speed this reduces to shortest physical rail distance between service points.
- The route generator does not intentionally add arbitrary loops solely to farm events; retracing produced naturally by the rail topology is legal.

Whenever a Train physically reaches or passes through an eligible City/Port station on its finite route, that station triggers one ordinary Train event whether or not it was a selected route target.

Every paying station event imposes a **1.5-second / 15-tick dwell** before the Train continues. Repeated qualifying passes through the same station trigger repeated events and dwells. There is no hard per-tour event cap.

Dense/highly optimized rail layouts are intentionally allowed to outperform ordinary layouts; balance intervention is reserved for demonstrated pathological scaling.

## 4.1 Factory Train-service ownership epoch

Factory Train scheduling is owner-scoped operational state rather than an indivisible part of the physical structure state.

Each owned Factory has one current **Train-service ownership epoch** containing the primary-service scheduler state and any owner-specific scheduler state such as P07's normal-primary-dispatch phase. The epoch is serialized/replayed as authoritative state; implementations must not reconstruct it from aggregate Train history.

A newly operational Factory begins its service through the ordinary deterministic initial-service path. Temporary inactivity pauses the current service epoch without discarding its scheduler state. Factory upgrades preserve the current service epoch.

A successful Factory ownership transfer atomically closes the previous owner's service epoch and creates a fresh epoch for the new owner. The new epoch does not inherit the previous owner's turnaround, active-primary occupancy, route queue position, or P07 dispatch phase. The physical Factory's structure identity, completed level, health, construction state, and other transfer-preserved structure state remain governed by `TERRAIN_AND_STRUCTURES.md`.

Every dispatched Train snapshots the Factory service epoch that created it. If the Factory later changes owner while that Train is still in flight:

- the Train remains owned by its dispatching owner and is not transferred with the Factory;
- it continues its already generated finite route and retains its dispatch-time economic profile;
- it no longer occupies or blocks the new owner's Factory primary-service slot;
- its later return, route termination, or destruction closes only its old dispatch and cannot mutate the new ownership epoch's primary scheduler, turnaround, route queue, or P07 phase.

At completion of an old-epoch route after the origin Factory has changed ownership, the Train terminates normally rather than transferring ownership or reattaching itself to the new epoch.

## 4.2 Train FFY event value and dispatch snapshot

Each qualifying station event is an **Industrial FFY** event owned by the Train owner. Its ordinary base value is determined by the originating Factory's completed level:

| Factory level | Base Train event value |
| ---: | ---: |
| **L1** | **10,000 FFY** |
| **L2** | **11,250 FFY** |
| **L3** | **12,500 FFY** |
| **L4** | **13,750 FFY** |
| **L5** | **15,000 FFY** |

At dispatch, each Train snapshots the originating Factory's completed level and any explicit Factory-specific transformation of the Train-event **base value**. All station events and pending interception cargo for that Train use this dispatch-time Factory economic profile for the Train's lifetime. A later Factory upgrade, ownership transfer, or loss of an owner-specific Factory transformation does not retroactively alter an already dispatched Train.

P34 is the current V1 Factory-specific base-value transformation: a Train dispatched from a qualifying P34 conquered Factory snapshots a `1.50×` Factory Train-event base-value multiplier. That multiplier is applied at step 2 of the FFY ordering in §3, before ordinary earning-side yield percentages. A P07 bonus Train dispatched simultaneously with a primary Train snapshots the same Factory economic profile while retaining its independently generated route.

A foreign station does not receive an automatic payout merely for being traversed.

If a qualifying external station belongs to a faction currently `atWar` with the Train owner, the earning-side event uses the ordinary wartime external-trade multiplier from §6.

## 4.3 Train interception / land piracy

For its next eligible paying stop, a Train carries a snapshotted pending base cargo value equal to the Train's dispatch-time Factory event base value after any explicit Factory-specific base-value transformation such as P34.

If a hostile Tank successfully intercepts the Train before that payout:

- the pending Industrial event is canceled;
- the Train is destroyed;
- the Tank owner receives a **Military / conquest FFY** event whose base value equals the pending base cargo;
- the raider's own eligible yield modifiers apply;
- previously resolved Train events are not clawed back.

Origin-specific Train transformations are defined only in `ORIGIN_TRAIT_CATALOGUE.md`.

---

# 5. Trade Ship traffic and cargo

## 5.1 Speed and dispatch cadence

Baseline Trade Ship speed is:

```text
10 water cells / second
```

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
= the ordinary positive uncaptured Trade-success value
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

The physical voyage/cargo identity serializes enough authoritative economic state to restore the snapshot without consulting mutable current match state. At minimum the snapshot binds:

```text
originalOwnerId
sourcePortId
launchDestinationPortId
valuationCellId
plannedRouteLengthCells
rawCargoFfy
ownerSuccessValueFfy   // Vowner
```

Replay/regeneration from the same versioned launch state must reproduce the same `rawCargo` and `Vowner` and may verify them against the serialized values. Save/load restoration consumes the serialized snapshot rather than recalculating `Vowner` from present-day terrain, fields, ownership, or modifiers.

`Vowner` is **not** the authoritative later ordinary Trade payout. It is a fixed reference amount consumed only by rules that explicitly name the snapshotted owner-side voyage value, currently N14/N16. An uncaptured ordinary Trade completion still resolves its actual positive event at completion under the then-current ordinary event rules.

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

On first hostile capture:

- the original ordinary commercial completion is canceled;
- the cargo remains aboard the vessel;
- no ordinary piracy FFY is paid immediately;
- the vessel routes toward a legal reachable owned active Port of its current holder;
- any original-owner N14/N16 first-capture adjustment resolves exactly once from the voyage's immutable `Vowner` under §7.3.

If the delivery Port becomes invalid, captured cargo retargets another legal reachable owned active Port. If none exists, it remains physically in play without paying out until delivery again becomes possible, it is recaptured, or it is destroyed.

## 7.3 N14/N16 owner-side voyage adjustments

N14 and N16 consume the exact same stored launch-time `Vowner`; they never recompute it when capture/completion occurs.

On the **first hostile capture only**, the original owner's signed FFY adjustment is resolved atomically as:

```text
firstCaptureOwnerDelta
= (N16 selected ? +Vowner : 0)
+ (N14 selected ? -Vowner : 0)
```

Therefore:

```text
N14 only       -> -Vowner
N16 only       -> +Vowner
N14 + N16      -> exactly 0
```

The combined N14+N16 result is one net signed consequence of the same first-capture fact. Implementations must not perform a balance-floor-sensitive debit followed by a separate credit and merely hope they cancel.

For N16, a **successful uncaptured** voyage suppresses the ordinary owner Trade-success payout and instead applies one explicit owner FFY delta of `-Vowner`. Destruction, return/termination without successful ordinary completion, or another path that never reaches successful uncaptured completion does not create that N16 success loss. Once first hostile capture has occurred, the uncaptured-success path is permanently canceled for that voyage.

The N14 loss, N16 first-capture return, and N16 uncaptured-success loss are explicit signed currency transactions. They are **not ordinary positive FFY events** and are not run through All-FFY, Naval/trade, P14/P24, N04/N11, P08, P30, or other positive-event yield transformations a second time. Any ordinary launch-time positive-event modifiers included in `Vowner` have already contributed exactly once to the stored reference amount.

These original-owner adjustments do not change the physical cargo lifecycle. The same cargo remains available for recapture, destruction, or one terminal captured-cargo payout below.

## 7.4 Terminal captured-cargo payout

Successful captured-cargo delivery uses:

```text
base captured-cargo value = original rawCargo
```

A hostile final holder receives a **Naval / trade piracy FFY** event and applies its own eligible modifiers. If the original owner recaptures and returns the spoiled cargo, it may recover the same one cargo value as a Naval/trade recovery event.

`Vowner` is not substituted for this physical-cargo value. N14/N16 are original-owner voyage adjustments; piracy/recovery continues to value the actual captured cargo from original `rawCargo` under the final holder's/recovering owner's ordinary eligible event rules.

If cargo changes hands repeatedly, only the faction that ultimately completes legal delivery receives the terminal cargo payout. Destruction before delivery yields `0` terminal cargo payout.

Origin-specific capture, loss, inversion, or piracy transformations are defined only in `ORIGIN_TRAIT_CATALOGUE.md`.

---

# 8. Faction elimination

Ordinary faction defeat gives:

```text
0 universal FFY
```

Remaining unspent FFY is not awarded through a universal last-hit bounty. Explicit scenario/objective rewards may define their own events.

---

# 9. Remaining implementation/validation work

The following are implementation or balance-validation details, not unresolved subsystem architecture:

- exact retry scheduling when a Trade Ship dispatch timer fires with no legal destination;
- exact deterministic hash/RNG representation for equal-age Trade destination ties and Train service queues;
- runtime/replay conformance for P05 frozen pre-batch earning-state qualification and the serialized Trade-voyage `Vowner` snapshot once the corresponding Open Fufu gameplay implementation exists;
- benchmark/playtest retuning of provisional Train/Trade values;
- accelerated simulation benchmarks across baseline passive income, optimized industry, maritime trade, piracy, Factory levels, and relevant Origin/Echo combinations.
