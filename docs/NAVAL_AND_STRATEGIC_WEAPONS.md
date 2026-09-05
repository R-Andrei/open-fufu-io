# Open Fufu — Naval Units and Strategic Weapons

## Status and authority

This file is the **canonical owner for baseline Warship, Transport Ship, Warship-rank, and strategic-weapon mechanics**.

Neighboring concerns are owned elsewhere:

- game-wide teams, controller-directed hostility, and `atWar` lifecycle: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- Port/Silo/SAM structure levels, charges, repair fields, and launcher access: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Trade Ship traffic, cargo, capture payout, and piracy economics: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Origin transformations of naval units, launchers, or weapons: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

The rules and values below are the accepted provisional V1 baseline. Numeric values may be retuned through versioned balance changes without changing subsystem ownership.

---

# 1. Strategic weapons

Launcher level/access rules are owned by `TERRAIN_AND_STRUCTURES.md`. A launch must use a legal launcher; grants and other transformations do not bypass launcher legality unless their canonical owner explicitly says so.

An accepted controller-directed strategic-weapon launch against an opposing faction applies the game-wide directed-hostility / `atWar` rule in `OPEN_FUFU_DESIGN.md`. The intended target side at accepted command commit is the hostility source; collateral damage to another side does not independently create or refresh `atWar` with that collateral side.

## 1.1 Baseline purchase costs

Strategic-weapon base prices are static per weapon:

```text
Atom Bomb     =  1,000,000 FFY
Hydrogen Bomb = 10,000,000 FFY
MIRV          = 50,000,000 FFY
```

They do not escalate based on prior launches.

## 1.2 Projectile speeds

| Projectile | Speed |
| --- | ---: |
| Atom Bomb | **100 cells/s** |
| Hydrogen Bomb | **100 cells/s** |
| MIRV carrier | **150 cells/s** |
| MIRV warhead after separation | **220 cells/s** |

## 1.3 Atom and Hydrogen blast geometry

| Weapon | Fully affected inner radius | Irregular outer radius |
| --- | ---: | ---: |
| Atom Bomb | **12** | **30** |
| Hydrogen Bomb | **80** | **100** |

The inner zone is fully affected. The annulus between inner and outer radius uses a deterministic irregular boundary/fill so the blast is not a perfect circle while remaining replay-stable.

## 1.4 Standard strategic-weapon effect

For each affected owned population-bearing land cell under standard non-water-nuke rules:

1. political ownership is removed and the cell becomes neutral;
2. the former owner loses `1 Total Population`, capped at zero;
3. Capacity falls because ownership of that population-bearing cell was lost;
4. underlying base terrain remains unchanged;
5. Fallout is applied.

A later reconquest restores ordinary Capacity from ownership but grants no free current Population.

A persistent structure or mobile unit whose physical cell lies inside the resolved blast footprint is destroyed unless an explicit rule makes it immune. Carried Population aboard a destroyed Transport resolves as Transport destruction rather than an additional per-cell nuclear casualty.

## 1.5 Optional Water Nukes

Water Nukes are a **default-OFF optional V1 ruleset**. When enabled, the fully affected inner blast zone also becomes a permanent Deep-Water conversion core; the irregular outer annulus keeps ordinary neutralization + Fallout.

| Weapon | Deep-Water core | Ordinary Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | **0–12** | **12–30** |
| Hydrogen Bomb | **0–80** | **80–100** |
| MIRV warhead | **0–12** | **12–18** |

For each eligible cell inside the core, apply ordinary nuclear ownership/Population/Capacity/unit/structure consequences first, then convert terrain:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → unchanged Deep Water
Impassable      → unchanged
```

A converted cell is unowned, non-population-bearing, non-buildable, removed from the ordinary conquerable-territory denominator, and has no Fallout overlay. Overlapping cores use the deterministic union of eligible core cells.

The resulting Deep Water immediately affects naval connectivity, pathing, coast/shore derivation, Capacity, and victory calculations. Segment membership remains immutable.

The ruleset intentionally provides no anti-cheese protection against terrain destruction.

---

# 2. MIRV

## 2.1 Baseline payload

One MIRV launch creates at most:

```text
250 independently resolving MIRV warheads
```

Each warhead uses:

```text
inner radius = 12
outer radius = 18
```

## 2.2 Target distribution

The launch selects one primary target cell and snapshots its target faction when faction-owned at launch.

```text
distribution radius = 750 cells
minimum warhead-center spacing = 55 cells
```

Warhead #1 targets the submitted primary target cell.

Remaining centers are chosen deterministically from legal land cells within 750 cells of the primary target that belong to the snapshotted target faction, respecting the 55-cell minimum spacing.

The resolver does not search beyond the authored distribution radius merely to fill all 250 warheads. If fewer legal spaced centers exist, fewer warheads resolve.

A later ownership change does not retarget the primary warhead. Ordinary collateral follows the physical resolved footprints.

## 2.3 Carrier separation and interception

Before separation, the MIRV carrier is one interceptable strategic projectile. Destroying it cancels the unresolved payload.

The carrier separates at approximately **50% of planned physical flight progress**. The exact deterministic motion-plan index/tick is implementation/versioning detail.

After separation:

- the carrier ceases to exist as one target;
- every spawned warhead is independently interceptable;
- destroying one warhead affects only that warhead.

SAM interception uses actual physical entry into SAM coverage.

---

# 3. Baseline Warship

One Warship represents an abstract naval combat formation rather than one literal ship.

## 3.1 Purchase and persistence

```text
WarshipCost = min(1,000,000 FFY, 250,000 FFY × (activeWarships + 1))
```

| Active Warships before purchase | Next Warship cost |
| ---: | ---: |
| 0 | **250k FFY** |
| 1 | **500k FFY** |
| 2 | **750k FFY** |
| 3+ | **1.00m FFY** |

Destroyed Warships stop counting toward the active-count curve.

| Property | Rule |
| --- | --- |
| Produced by | active owned Port |
| Construction time | **5 seconds** |
| Hard ownership cap | none |
| Base max health | **1,000 HP** |
| Base movement speed | **10 cells/s** |
| Base naval-gun range | **130 cells** |
| Base shell damage | **250 HP fixed** |
| Base shell cooldown | **2 seconds** |
| Autonomous operating leash | **100 cells** |
| Trade Ship capture distance | **5 cells** |
| Automatic repair-retreat threshold | **50% max health** |

Baseline shell damage is deterministic.

### 3.1.1 Warship build admission and ownership reservations

Warship construction uses the same transactional admission principle as persistent-structure acquisition, while this naval owner remains authoritative for Warship-specific producer/build lifecycle.

An effective hard Warship ownership cap, when supplied by an Origin/ruleset, counts:

```text
owned completed/active Warships
+ already committed Warships still under construction
+ temporary reservations created while validating the current atomic decision
```

The baseline cap is unbounded. P23 supplies an effective cap of one.

A successful Warship build admission reserves its ownership slot at transaction commit and holds it through the five-second construction lifecycle. Destruction/cancellation before completion or later destruction/loss releases the slot at the authoritative state transition. A failed proposal consumes no FFY/Population and leaves no reservation.

A mechanics quote is not a reservation. Consequently, with an effective cap of one and no existing Warship, two Port build quotes may each be legal against the same immutable snapshot while a decision containing both build commands is rejected atomically with `OWNERSHIP_CAP`. Command-array order must not decide which sibling purchase wins.

Hard build prohibitions are evaluated before transaction resources are committed and remain effective even when another rule changes the payment resource or makes the purchase free. Alternate payment therefore never bypasses a Warship build prohibition or ownership cap.

## 3.2 Strategic/autonomous control

Warships are autonomous combat formations rather than RTS-micro units.

The controller may issue a strategic **move destination**. An accepted move repositions the Warship and establishes that destination as its new operating anchor. The controller does not assign patrol modes, raid modes, attack modes, or individual targets.

Within ordinary operation the Warship wanders/searches for legal targets around its current operating anchor, with a baseline **100-cell leash**. Pathfinding, roaming, target acquisition, pursuit, firing, Trade-Ship capture behavior, and automatic repair retreat are simulation-owned.

Ordinary autonomous target priority within legal observation is:

```text
1. hostile Transport Ship
2. hostile Warship
3. legally capturable hostile Trade Ship
```

Autonomous Warship target acquisition, firing, Transport destruction, and Trade-Ship capture/recapture do **not** require, create, or refresh `atWar`. A controller-issued Warship move remains strategic repositioning rather than a direct attack order even when autonomous combat is a predictable consequence of moving into an opposing force's area.

Trade Ship capture/cargo semantics are owned by `FFY_ECONOMY.md`. Port repair mechanics are owned by `TERRAIN_AND_STRUCTURES.md`.

---

# 4. Warship ranks

Warships begin at rank **1** and ordinarily cap at rank **3**.

Each rank above 1 gives:

```text
+20% max health per rank
+20% shell damage per rank
```

When max health increases on rank-up, preserve current health percentage rather than granting a free heal equal to the added maximum health.

## 4.1 Naval XP

One rank step requires:

```text
100 Naval XP
```

| Event | Naval XP |
| --- | ---: |
| Destroy hostile Warship | **100** |
| Destroy hostile Transport | **10** |
| Successfully capture hostile Trade Ship | **4** |

XP above a threshold carries toward the next rank until the current rank cap is reached.

Origin-specific rank-cap or launcher transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

---

# 5. Transport Ships

Transport Ships carry explicitly committed Population and are amphibious-operation vehicles, not territorial owners.

| Property | Baseline rule |
| --- | --- |
| Active cap per faction | **3** |
| Embarkation FFY cost | **0 FFY** before explicit modifiers |
| Movement speed | **10 cells/s** |
| Ordinary embark source | legal owned coast/shore embarkation point |
| Baseline health | fragile / no persistent health pool |
| Baseline Warship interception | one successful hostile shell destroys Transport |
| Carried Population | controller-selected committed Population |

The three-Transport cap prevents fragmentation of one invasion into very large numbers of tiny boats solely to saturate autonomous targeting.

## 5.1 Embark and autonomous travel

The controller begins an amphibious operation by choosing a legal embark source, legal landing target, and Population commitment. The simulation creates the Transport and owns pathfinding/travel to that target; Transports do not accept generic controller movement orders.

When the accepted target is owned by an opposing hostility side, the resulting Transport operation is controller-directed hostility under `OPEN_FUFU_DESIGN.md` and maintains the corresponding `atWar` relation while that directed hostile operation remains active. The Transport's autonomous routing does not create additional war relations with third parties merely because ownership or nearby combat later changes.

## 5.2 Amphibious landing

Reaching a legal hostile/neutral landing coast does **not** award the target cell.

The Transport makes that local coast operationally actionable and its carried Population enters the ordinary local hostile/neutral territorial engagement under canonical capture, casualty, terrain, and defense rules.

The Transport itself never bypasses political ownership resolution merely by arriving.

## 5.3 Retreat / abort

The controller may abort an active owned Transport. The simulation then routes it autonomously toward a legal owned return point; the controller does not choose a return path or micro-manage the vessel.

On successful return:

```text
25% of carried Population is lost
75% returns to Available Population
```

Destruction before successful return loses the carried Population under ordinary Transport-destruction rules.

Ending the final controller-directed hostile Transport operation contributes to war-state cooldown only through the canonical game-wide `atWar` lifecycle; this document does not own that timer.

Origin-specific Transport transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

---

# 6. Validation expectations

Before V1 release, accelerated/headless tests should benchmark at minimum:

- fleet-vs-fleet time-to-kill across ordinary ranks;
- autonomous target priority around mixed Transport/Warship/Trade traffic;
- Warship move-anchor/leash behavior without patrol/raid/target controller modes;
- autonomous Warship combat/piracy continuing without creating or refreshing `atWar`;
- repair-retreat integration with canonical Port repair fields;
- effective Warship ownership caps counting committed constructions and rejecting aggregate oversubscription atomically;
- three-Transport amphibious throughput across representative coasts;
- autonomous Transport travel/abort/return behavior;
- hostile Transport operation start/end integration with canonical `atWar` state;
- Atom/Hydrogen blast impact on representative territories;
- MIRV target saturation on compact, fragmented, coastal, and very large factions;
- carrier interception versus post-separation SAM-charge saturation;
- strategic-weapon costs and projectile speeds under the ordinary surfaced modifier system.