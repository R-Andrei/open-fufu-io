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

## 4.1 Train FFY event value

Each qualifying station event is an **Industrial FFY** event owned by the Train owner. Its base value is determined by the originating Factory's completed level:

| Factory level | Base Train event value |
| ---: | ---: |
| **L1** | **10,000 FFY** |
| **L2** | **11,250 FFY** |
| **L3** | **12,500 FFY** |
| **L4** | **13,750 FFY** |
| **L5** | **15,000 FFY** |

A foreign station does not receive an automatic payout merely for being traversed.

If a qualifying external station belongs to a faction currently `atWar` with the Train owner, the earning-side event uses the ordinary wartime external-trade multiplier from §6.

## 4.2 Train interception / land piracy

For its next eligible paying stop, a Train carries a snapshotted pending base cargo value equal to its originating Factory-level event value.

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

## 5.3 Destination selection

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

If the destination changes owner but remains active, reachable, and foreign, the vessel continues to that physical Port. If it becomes invalid, the ship reroutes using the same policy without recomputing the voyage's snapshotted cargo value.

If no legal foreign destination remains during an uncaptured voyage, the Trade Ship returns to a reachable owned active Port and terminates without an ordinary Trade payout.

## 5.4 Ordinary completion

On successful ordinary completion, the Trade Ship owner receives one **Naval / trade FFY** event derived from the voyage. The destination Port owner receives no automatic payout merely for being the destination.

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

A Trade Ship carries one physical cargo through its voyage. Hostile capture does **not** mint FFY immediately, and one cargo can produce at most one terminal cargo payout.

## 7.1 Capture prerequisite

A hostile Warship may capture a Trade Ship only when the Warship's faction has at least one reachable owned active Port on the relevant water network/component to which the cargo can legally be delivered.

## 7.2 Captured cargo lifecycle

On first hostile capture:

- the original ordinary commercial completion is canceled;
- the cargo remains aboard the vessel;
- no piracy FFY is paid immediately;
- the vessel routes toward a legal reachable owned active Port of its current holder.

If the delivery Port becomes invalid, captured cargo retargets another legal reachable owned active Port. If none exists, it remains physically in play without paying out until delivery again becomes possible, it is recaptured, or it is destroyed.

## 7.3 Terminal captured-cargo payout

Successful captured-cargo delivery uses:

```text
base captured-cargo value = original rawCargo
```

A hostile final holder receives a **Naval / trade piracy FFY** event and applies its own eligible modifiers. If the original owner recaptures and returns the spoiled cargo, it may recover the same one cargo value as a Naval/trade recovery event.

If cargo changes hands repeatedly, only the faction that ultimately completes legal delivery receives the terminal cargo payout. Destruction before delivery yields `0`.

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
- benchmark/playtest retuning of provisional Train/Trade values;
- accelerated simulation benchmarks across baseline passive income, optimized industry, maritime trade, piracy, Factory levels, and relevant Origin/Echo combinations.