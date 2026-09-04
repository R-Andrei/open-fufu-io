# Open Fufu — FFY Economy Registry

## Status and authority

This file is the **canonical detailed working registry for Open Fufu FFY economy semantics and provisional FFY values**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains the overarching game-design contract. [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) remains authoritative for structure/unit data and the physical Factory Train service. [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) remains authoritative for deployed Origin trait IDs, costs, and trait mechanics.

Within the FFY-economy domain, this file records the more specific accepted provisional values and semantics as they are settled. Older high-level summaries must be synchronized when touched.

Nothing in this file authorizes gameplay implementation.

---

# 1. V1 economy direction

FFY is Open Fufu's primary in-match currency.

The ordinary V1 economy should remain recognizably descended from OpenFront. In particular, the baseline game does **not** add a controller mechanic that explicitly assigns Population to an `economy` bucket in exchange for FFY. A universal bootstrap income mechanism is still required because a faction must eventually be able to reach productive City/Port/Factory infrastructure without already owning productive infrastructure; the exact bootstrap rule/rate remains open.

The provisional ordinary starting balance is:

```text
Starting FFY = 50,000
```

This intentionally permits an immediate level-1 Fort purchase but does not permit immediate City, Port, Factory, Tank, Warship, Silo, or SAM spam under the current structure/unit prices.

The intended early-game pacing is that neutral expansion and Population management dominate first, while deciding when/how to begin developing FFY income remains a meaningful transition rather than an automatic opening building queue.

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

Exact recipient semantics for externally owned Train stations remain part of the current FFY-economy discussion and are not silently inferred from inherited OpenFront behavior.

## 4.1 Train interception / land piracy

For its next eligible paying stop, a Train carries a snapshotted **pending base cargo value** equal to the originating Factory-level Train value above.

If a hostile Tank successfully intercepts the Train before that payout:

- the pending ordinary Industrial event is canceled;
- the Train is destroyed;
- the Tank owner receives a **Military / conquest FFY event** whose base value equals **100% of the pending base cargo**;
- the raider applies its own eligible Military/conquest, All-FFY, spatial, and other ordinary yield modifiers;
- the raider does not inherit the Train owner's Industrial modifiers;
- previously resolved Train events and P33 Population gains are not clawed back.

---

# 5. Trade Ship ordinary cargo value

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

## 5.1 Successful ordinary voyage

On successful ordinary completion, the **source Trade Ship owner** receives the Naval/trade FFY event derived from that voyage.

The destination Port owner receives **no automatic FFY simply for being selected as the destination**. This avoids a faction passively gaining a second major economy merely because another faction specialized heavily into maritime trade and repeatedly sends ships to it.

The source-owner success value applies the source owner's eligible Naval/trade, All-FFY, spatial, wartime, and other ordinary yield rules.

## 5.2 External wartime trade

External trade remains possible while at war.

The ordinary wartime external-trade multiplier is:

```text
0.50×
```

P08 changes the trait-holder's own wartime trade multiplier to:

```text
1.00×
```

The wartime rule applies to external maritime trade and to external rail trade where an FFY payout is otherwise earned. It does not by itself create a payout for the foreign destination/station owner.

## 5.3 Traffic constraint already settled

V1 Trade Ship traffic must **not** be controlled through:

- a hard active-Trade-Ship cap per Port;
- a hard active-Trade-Ship cap per faction;
- a global active-Trade-Ship cap used as ordinary economic throttling;
- a route-length rule that deliberately slows launch frequency merely because the destination is farther away.

Longer voyages are already more exposed to hostile Warship interception because each ship remains physically vulnerable for longer. The traffic model should not add a second route-length penalty by making long routes launch fewer ships as well.

The exact independent per-Port spawn/dispatch cadence remains open. A roughly 20–30-second ordinary cadence is a current design direction, not yet an accepted exact constant.

Port level's canonical identity remains naval repair radius/rate; no Port-level Trade-Ship-frequency progression is accepted merely because inherited OpenFront had one.

---

# 6. Trade Ship capture and piracy

Hostile capture does **not** immediately mint piracy FFY.

A captured Trade Ship/cargo remains a physical object in the world. Piracy income is realized only after the captured vessel/cargo is successfully delivered to a legal owned active Port of the current hostile holder according to the final captured-ship routing rules.

The exact ordinary piracy payout multiple/base remains open in the current FFY pass; P30's accepted `3× piracy FFY` transformation will apply to the eventual ordinary piracy event.

## 6.1 Snapshotted owner-side success value; N14/N16

For every launched ordinary Trade voyage, define:

```text
Vowner = the FFY amount the source owner would receive if that snapshotted voyage completed successfully under the launch-time rules/state
```

`Vowner` is snapshotted at launch and is not recomputed from later rerouting, later distance, or subsequent capture movement.

N14 uses exactly that value:

```text
first hostile capture
→ original owner loses Vowner FFY
```

N16 uses the same canonical snapshot under its already accepted success/capture inversion rules.

Later recaptures/transfers do not retrigger N14/N16's first-hostile-capture owner-side effects.

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

# 9. Future Origin-economy design hooks — accepted direction, not deployed traits

Two future Origin-economy directions are intentionally preserved for later catalogue work:

1. **Underpopulation / empty-Capacity economy** — passive income derived from some explicit measure related to the gap between Population Capacity and current Population, creating a deliberately strange incentive to operate a large underpopulated state.
2. **Strategic-stockpile / Silo economy** — income derived from Missile Silos, ready strategic capacity, or a related nuclear-stockpile state.

These are **not yet catalogue traits** and have no accepted point values/formulas.

The Silo/nuclear direction must receive a real strategic downside that pushes the faction away from ordinary fast territorial expansion. Merely losing income while Silo charges are briefly on cooldown is not a sufficient drawback because firing the arsenal is already an overwhelmingly favorable exchange in many situations. A future nuclear-expansion Origin may combine strong Silo-linked economy with severely impaired ordinary acquisition and unusually strong Fallout-based expansion, creating a weak/awkward early game that can transition into a doomsday-style late game if it survives.

---

# 10. Remaining FFY-economy questions

The following remain open and should not be silently inferred from inherited OpenFront behavior:

- universal V1 FFY bootstrap source/rate beyond the accepted 50,000 starting balance;
- exact Trade Ship independent per-Port spawn/dispatch cadence;
- exact Trade Ship speed if changed from inherited behavior;
- exact ordinary piracy payout/base and recapture/delivery edge cases;
- exact Train-event recipient semantics when a Train passes a station owned by another faction;
- final Trade Ship destination-selection/routing policy and destination disappearance/ownership-change handling;
- accelerated simulation benchmarks comparing optimized industry, maritime trade, piracy, P07/P33, Factory levels, and relevant Origin/Echo combinations.
