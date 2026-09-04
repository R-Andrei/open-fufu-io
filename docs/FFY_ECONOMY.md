# Open Fufu — FFY Economy Registry

## Status and authority

This file is the **canonical detailed working registry for Open Fufu FFY economy semantics and provisional FFY values**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains the overarching game-design contract. [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) remains authoritative for structure/unit data and the physical Factory Train service. [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) remains authoritative for deployed Origin trait IDs, costs, and trait mechanics.

Within the FFY-economy domain, this file records the more specific accepted provisional values and semantics as they are settled. Older high-level summaries must be synchronized when touched.

Nothing in this file authorizes gameplay implementation.

---

# 1. V1 economy baseline

FFY is Open Fufu's primary in-match currency.

The ordinary V1 economy remains recognizably descended from OpenFront. In particular, the baseline game does **not** add a controller mechanic that explicitly assigns Population to an `economy` bucket in exchange for FFY.

The provisional ordinary starting balance and universal passive floor are:

```text
Starting FFY = 25,000
Baseline passive FFY income = 1,000 FFY / second
```

The passive source is deliberately flat: it does not scale with Population, Population Capacity, territory, Cities, Factories, Ports, structures, military units, or player/controller allocation. It exists as a bootstrap and small universal economic floor so every faction can eventually reach productive infrastructure without already owning productive infrastructure.

The passive source is a **global/non-spatial general FFY source**. Ordinary All-FFY modifiers may affect it; Industrial, Naval/trade, Military/conquest, terrain-location, Fort-area, SAM-area, and other source/location-specific modifiers do not apply unless an explicit future rule says otherwise.

At the current structure prices, 25,000 Starting FFY cannot immediately purchase a level-1 Fort or other persistent structure. With no other income/modifier, the ordinary 1,000 FFY/s floor reaches 50,000 after 25 seconds, 100,000 after 75 seconds total match time, and 150,000 after 125 seconds total match time.

The intended early-game pacing is therefore:

- neutral expansion and Population management dominate immediately;
- the player cannot instantly place an offensive/defensive Fort at match start merely because of Starting FFY;
- saving for the first infrastructure purchase remains a real timing decision;
- developed Train/Trade/Origin economies should eventually dwarf the flat baseline.

---

# 2. Broad FFY event families

Ordinary yield modifiers use a small set of broad source families:

- **All FFY**;
- **Military / conquest FFY**;
- **Naval / trade FFY**;
- **Industrial FFY**.

Individual event identities remain distinct internally for simulation/replay/debugging even when they share one modifier family.

Ordinary same-axis FFY yield percentages add before multiplication unless an explicit structural rule says otherwise.

---

# 3. Modifier ordering and loss/cost semantics

For an ordinary **positive FFY event**:

```text
1. determine the event's base value;
2. apply explicit structural/event multipliers or transformations;
3. collect eligible ordinary FFY-yield percentages;
4. add percentages on the same yield axis;
5. apply the resulting yield multiplier;
6. clamp ordinary positive-event yield at >= 0;
7. apply explicit hard-zero rules where applicable.
```

Examples of structural/event rules include Origin transformations such as P34 or P30 and the ordinary wartime external-trade multiplier. Examples of ordinary yield percentages include All-FFY, the relevant broad source family, and eligible spatial modifiers such as Desert/Fort-area effects.

FFY-yield modifiers affect **positive income events**. They do not automatically modify:

- structure/unit/weapon prices;
- Transport embarkation costs;
- explicit FFY penalties/losses;
- N14's captured-voyage loss;
- other negative currency transactions;

unless the specific mechanic explicitly says otherwise.

Thus an All-FFY bonus does not make an N14 loss larger merely because the faction earns FFY more efficiently.

---

# 4. Factory Train FFY events

The physical Train routing/service rules are defined in [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md).

Each qualifying City/Port pass produces one **Industrial FFY** event whose base value is determined by the originating Factory's completed level:

| Factory level | Base Train event value |
| ---: | ---: |
| **L1** | **10,000 FFY** |
| **L2** | **11,250 FFY** |
| **L3** | **12,500 FFY** |
| **L4** | **13,750 FFY** |
| **L5** | **15,000 FFY** |

This is the Factory-level progression itself, not a second multiplier applied on top of another 10,000-FFY base.

The physical event rule remains intentionally permissive:

- selected route targets count;
- incidental eligible City/Port passes count;
- repeated eligible passes during the same finite tour count again;
- there is no hard economic-event cap per Train tour.

## 4.1 Train-event recipient ownership

The ordinary Train FFY event belongs to the **Train owner**.

```text
Fufu Train passes Fufu City/Port
→ Fufu receives the Train FFY event

Fufu Train passes Tanya City/Port
→ Fufu receives the Train FFY event
→ Tanya receives no automatic FFY merely for owning the station
```

A foreign station still matters because it is physical rail-network geography and may make an external Train event eligible; it does not passively grant the station owner a second economy funded by another faction's rail specialization.

If the qualifying station is externally owned and the Train owner is currently `atWar` with that station owner, the Train owner's external-trade payout receives the ordinary wartime `0.50×` multiplier unless P08 restores the holder's wartime trade multiplier to `1.00×`.

## 4.2 Train interception / land piracy

For its next eligible paying stop, a Train carries a snapshotted **pending base cargo value** equal to the originating Factory-level Train value above.

If a hostile Tank successfully intercepts the Train before that payout:

- the pending ordinary Industrial event is canceled;
- the Train is destroyed;
- the Tank owner receives a **Military / conquest FFY event** whose base value equals **100% of the pending base cargo**;
- the raider applies its own eligible Military/conquest, All-FFY, spatial, and other ordinary yield modifiers;
- the raider does not inherit the Train owner's Industrial modifiers;
- previously resolved Train events and P33 Population gains are not clawed back.

---

# 5. Trade Ship ordinary traffic and cargo

## 5.1 Baseline speed and dispatch cadence

The provisional ordinary Trade Ship speed is:

```text
10 water cells / second
```

P06's accepted `+25% Trade Ship speed` therefore produces `12.5 cells/second` before any other legal modifier.

Every active Port with at least one legal reachable foreign Trade destination maintains its **own independent deterministic dispatch timer**.

For the initial dispatch after the Port becomes active and after every successful dispatch, the next ordinary dispatch delay is a deterministic match-RNG value in:

```text
20–30 seconds
mean target: 25 seconds
```

The exact integer/fixed-point sampling convention and keyed deterministic RNG identity are implementation/versioning details; the gameplay invariant is an independent deterministic roughly-25-second Port cadence.

Ordinary dispatch frequency is **not throttled by**:

- how many Trade Ships that Port already has in flight;
- how many Trade Ships the faction already owns;
- how many Trade Ships exist globally;
- route length;
- previous-voyage completion time;
- Port level.

Long voyages naturally create more simultaneous shipping traffic because ships remain physically in flight longer. They are also naturally more exposed to Warship interception for longer. V1 does not add a second route-length penalty by reducing their launch frequency.

If no legal foreign destination exists when a dispatch would occur, no ship is created; the Port continues/retries under the deterministic dispatch policy rather than creating an invalid voyage. Exact retry scheduling is implementation detail so long as it cannot be exploited to manufacture extra dispatches when a destination appears.

Port level's canonical identity remains naval repair radius/rate; inherited OpenFront Port-level Trade-Ship-frequency scaling is not part of ordinary V1.

## 5.2 Raw cargo value

The provisional ordinary Trade Ship cargo formula is:

```text
rawCargo = 150 FFY × planned water-route length in cells
```

The planned route length and raw cargo are snapshotted when the voyage launches for deterministic accounting.

Examples before modifiers:

| Planned route length | Raw cargo |
| ---: | ---: |
| 100 cells | 15,000 FFY |
| 250 cells | 37,500 FFY |
| 500 cells | 75,000 FFY |
| 1,000 cells | 150,000 FFY |
| 1,500 cells | 225,000 FFY |
| 2,000 cells | 300,000 FFY |

Long-distance trade is intentionally allowed to be substantially more lucrative in ideal uncontested conditions. Balance intervention should come from benchmark/playtest evidence; if the `150` coefficient or distance curve proves pathological, retune the value curve rather than suppressing world traffic through active-ship caps or distance-based spawn throttling.

## 5.3 Successful ordinary voyage

On successful ordinary completion, the **source Trade Ship owner** receives the Naval/trade FFY event derived from that voyage.

The destination Port owner receives **no automatic FFY simply for being selected as the destination**.

Conceptually:

```text
Fufu Trade Ship reaches Tanya Port
→ Fufu receives the Trade FFY event
→ Tanya receives no automatic Trade FFY
```

This prevents an Industry-focused faction from gaining a second large passive maritime economy merely because a Trade-specialized opponent repeatedly sends ships to its Ports.

The source-owner success value applies the source owner's eligible Naval/trade, All-FFY, source-side spatial, wartime, and other ordinary yield rules.

## 5.4 External wartime trade

External trade remains possible while at war.

The ordinary wartime external-trade multiplier is:

```text
0.50×
```

P08 changes the trait-holder's own wartime trade multiplier to:

```text
1.00×
```

The wartime rule applies to the earning vehicle owner's external maritime and external rail Trade events. It does not create or modify a nonexistent destination/station-owner payout.

---

# 6. Trade Ship capture, recapture, and piracy

Hostile capture does **not** immediately mint piracy FFY.

A Trade Ship carries one physical cargo object/value through its voyage. There can be at most **one terminal cargo payout** from that cargo.

## 6.1 Capture prerequisite

A hostile Warship may capture a Trade Ship only when the Warship's faction currently has at least one **reachable owned active Port** on the relevant water network/component to which captured cargo can legally be delivered.

If that prerequisite is not met, ordinary capture is unavailable; other legal destruction/combat rules remain whatever the Warship's current doctrine permits.

## 6.2 First hostile capture converts the voyage into captured cargo

On the first hostile capture:

- the original ordinary source-to-destination commercial completion is spoiled/canceled;
- the cargo remains physically aboard the captured vessel;
- no piracy FFY is paid immediately;
- N14/N16 first-hostile-capture effects resolve from their already snapshotted owner-side value;
- subsequent recaptures do not retrigger those first-hostile-capture owner effects.

After first hostile capture, the vessel/cargo is routed toward a legal reachable owned active Port of its **current holder**.

If the current delivery Port becomes invalid, captured cargo retargets another legal reachable owned active Port. If none exists, the vessel/cargo remains physically in play without paying out and may later resume delivery if a legal Port becomes available, be recaptured, or be destroyed. Cargo never teleports into an FFY balance.

## 6.3 Terminal captured-cargo payout

When captured cargo is successfully delivered to a legal owned active Port of the current holder:

```text
base captured-cargo value = original rawCargo
```

If the final delivering holder is hostile to the original owner, this is a **Naval/trade piracy FFY event** for that holder. The holder applies its own eligible Naval/trade, All-FFY, Port/location, and explicit piracy modifiers. P30 applies its accepted `3× piracy FFY` multiplier here.

If the original owner recaptures its own spoiled cargo and successfully brings it to an owned active Port, it may recover the same one cargo value as a Naval/trade recovery event, but P30's hostile-piracy multiplier does not apply merely because the cargo was once captured.

Examples:

```text
1,000-cell original voyage
rawCargo = 150,000

ordinary uncaptured completion:
original owner gets the ordinary 150,000-base Trade event

hostile capture + successful hostile delivery:
original ordinary completion = 0
final hostile holder gets a 150,000-base piracy event

P30 hostile holder:
150,000 × 3 = 450,000 structural piracy base before ordinary yield modifiers
```

If the cargo changes hands repeatedly, only the faction that ultimately completes a legal captured-cargo delivery receives the terminal cargo payout. If the vessel/cargo is destroyed first, the cargo pays `0`.

## 6.4 Snapshotted owner-side success value; N14/N16

For every launched ordinary Trade voyage, define:

```text
Vowner = the FFY amount the source owner would receive if that snapshotted voyage completed successfully under the launch-time rules/state
```

`Vowner` is snapshotted at launch and is not recomputed from later rerouting, later distance, capture ownership, or capture-delivery movement.

N14 uses exactly that value:

```text
first hostile capture
→ original owner loses Vowner FFY
```

N16 uses the same canonical snapshot under its already accepted success/capture inversion rules.

Later recaptures/transfers of the same cargo do not retrigger N14/N16's first-hostile-capture owner-side effects.

---

# 7. Structure-conquest FFY — P05

Ordinary structure capture does **not** inherently award a universal FFY bounty.

P05 explicitly creates a Military/conquest FFY event when the trait-holder successfully captures an enemy persistent structure.

The event's base value is:

```text
10% × canonical cumulative completed-level FFY cost of the captured structure
```

Use the canonical ordinary structure cost table, not the historical amount actually paid by that particular owner. Discounts, free purchases/grants, P21, and similar purchase-history effects therefore do not make an otherwise valuable conquered structure worth zero.

The event is located at the captured structure's cell for ordinary spatial FFY modifiers.

Examples under the current structure table:

| Captured structure | L1 P05 base | L5 P05 base |
| --- | ---: | ---: |
| Fort | 5,000 | 75,000 |
| City | 10,000 | 210,000 |
| Port | 10,000 | 210,000 |
| Factory | 15,000 | 315,000 |
| Observation Post | 5,000 | 105,000 |
| Command Post | 10,000 | 210,000 |
| Missile Silo | 100,000 | 1,500,000 |
| SAM Launcher | 100,000 | 1,500,000 |

---

# 8. Faction elimination

Ordinary faction defeat/elimination gives:

```text
0 universal FFY
```

The defeated faction's remaining unspent FFY is not awarded through a universal last-hit bounty.

This intentionally avoids arbitrary/last-hit-sensitive kill stealing. Conquest value already comes from territory, structures, strategic position, and explicit mechanics such as P05. Scenario/objective-specific FFY rewards may still exist when an explicit scenario defines them.

---

# 9. Origin-specific passive-economy hooks

The deployed/public definitions and point values for Origin traits live in `ORIGIN_TRAIT_CATALOGUE.md`. Two accepted provisional economic hooks intentionally create strange alternate economies rather than replacing the ordinary universal 1,000-FFY/s floor.

## 9.1 Underpopulation / empty-Capacity income

The corresponding Origin trait uses:

```text
emptyCapacity = max(0, PopulationCapacity - TotalPopulation)
bonusFFYPerSecond = emptyCapacity / 250
```

This is a global/non-spatial general FFY source. It rewards operating a large underpopulated state and naturally weakens as Population fills the available Capacity. It produces no negative income when Total Population exceeds Capacity.

Examples before All-FFY modifiers:

| Empty Capacity | Bonus FFY/s |
| ---: | ---: |
| 500 | 2 |
| 12,500 | 50 |
| 50,000 | 200 |
| 500,000 | 2,000 |
| 1,000,000 | 4,000 |
| 2,000,000 | 8,000 |

Deterministic fixed-point/residual accounting may be used internally so the formula need not quantize strategic state into coarse 250-Population steps.

## 9.2 Strategic-stockpile / Silo income

The corresponding Origin trait counts **ready launch charges on owned active persistent Missile Silo structures only**:

```text
bonusFFYPerSecond
= 2,000 × readyPersistentSiloCharges
```

Warships that become strategic-weapon launch platforms through P29 do not count as persistent Missile Silo structures for this income source.

This is a global/non-spatial general FFY source. Expending a Silo charge immediately removes that charge's contribution until the charge is ready again. The temporary income loss while firing is an internal guns-versus-butter tension, **not** the defining downside of the intended nuclear-expansion doctrine.

The corresponding severe non-Fallout acquisition drawback is separately defined in the Origin catalogue so it can compose legally with P16, P35, P44, P20, and other public traits rather than being hidden inside one bespoke Official Origin.

---

# 10. Remaining FFY-economy questions

The following remain open and should not be silently inferred from inherited OpenFront behavior:

- final deterministic Trade Ship destination-selection/routing policy among legal foreign Ports;
- exact retry behavior when a dispatch timer fires with no legal destination;
- benchmark/playtest retuning of the provisional `20–30s`, `10 cells/s`, and `150 × route cells` Trade values;
- accelerated simulation benchmarks comparing baseline passive income, optimized industry, maritime trade, piracy, P07/P33, Factory levels, and relevant Origin/Echo combinations;
- benchmark/playtest retuning of the underpopulation and Silo-economy coefficients and their Origin point values.
