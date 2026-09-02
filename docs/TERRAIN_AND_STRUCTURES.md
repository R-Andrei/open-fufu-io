# Open Fufu — Canonical Terrain and Structure Registry

## Status and authority

This file is the **canonical data registry for Open Fufu terrain, persistent structures, and the baseline Factory-produced Tank unit**.

It is a detailed data appendix to [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), especially §18, and does not replace that document as the overall game-design authority. If this registry and the canonical design contract ever conflict, the design contract wins and this registry must be corrected.

The purpose of this file is to keep concrete terrain/structure/unit tables, values, capabilities, and later balance revisions in one place rather than scattering numeric content across multiple design documents.

Nothing in this file authorizes gameplay implementation.

The rules and values below are the **accepted provisional V1 baseline**. Numeric values may change through development, simulation, balance testing, or playtesting without reopening the underlying terrain, structure, or Tank identities.

---

# 1. Terrain model

## 1.1 Core terminology

Each base terrain may define:

- whether the cell is **conquerable** and may have political ownership;
- whether it is **population-bearing** and therefore contributes Population Capacity while owned;
- whether ordinary land operations may traverse/attack through it;
- whether naval units may traverse it;
- whether persistent structures may be built on it;
- whether it may be used for Initial Territory / exact spawn-origin placement;
- a **capture / settlement speed multiplier** for acquisition of a target cell;
- a **source offensive-pressure modifier** for attacks whose source cell is that terrain;
- a **target defensive-pressure modifier** for an automatic defender standing on that terrain;
- an optional faction-wide effect based on the faction's owned terrain composition.

### Capture / settlement speed

`Capture / settlement speed` is not a resource. It multiplies the rate at which a legally contested/acquired target cell accumulates ownership-change progress after local attack/defense pressure has been resolved.

Conceptually:

```text
finalCaptureOrSettlementProgress
= ordinaryProgressFromPressure
× targetTerrainCaptureSettlementMultiplier
× other explicit progress modifiers
```

It applies to both hostile territorial capture and neutral settlement/expansion. It does **not** by itself change Population casualties or neutral-settlement Population cost.

### Source offense / target defense

Terrain offensive pressure is determined by the **attacking source cell's base terrain**. Terrain defensive pressure is determined by the **target/defended cell's base terrain**.

Terrain never creates an automatic Population defender. If the target receives no automatic defender, a percentage defensive-pressure modifier alone creates no Population or phantom defense.

### Terrain-share effects

For faction-wide terrain-composition effects:

```text
terrainShare(T)
= owned population-bearing cells of terrain T
  / all owned population-bearing cells
```

If the faction owns no population-bearing cells, terrain-share bonuses are zero. Conquerable but non-population-bearing cells such as Tundra and Shallow Water do not enter this denominator and do not dilute Plains/Desert share.

---

## 1.2 Canonical base-terrain table

| Terrain | Ownable | Population-bearing | Capacity | Land traversal | Naval traversal | Structures | Spawn eligible | Capture / settlement speed | Source offense | Target defense | Faction-wide effect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **Plains** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **110%** | `100%` | `100%` | **Population Growth `+6% × Plains share`** |
| **Highland** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **100%** | **`+8%`** | `100%` | — |
| **Mountain** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **80%** | `100%` | **`+15%`** | — |
| **Desert** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **90%** | `100%` | `100%` | **All FFY event yield `+6% × Desert share`** |
| **Forest** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **90%** | **`-5%`** | **`+10%`** | — |
| **Tundra** | Yes | **No** | **`0`** | Yes | No | **No** | **No** | **80%** | `100%` | **`+5%`** | — |
| **Marsh** | Yes | Yes | `+1/cell` | Yes | No | Yes | Yes | **70%** | **`-10%`** | **`-10%`** | — |
| **Shallow Water** | **Yes** | **No** | **`0`** | **Yes** | **Yes** | **No** | **No** | **70%** | **`-15%`** | **`-15%`** | — |
| **Deep Water** | No | No | `0` | No | **Yes** | No | No | — | — | — | — |
| **Impassable** | No | No | `0` | No | No | No | No | — | — | — | — |

---

## 1.3 Terrain identities

| Terrain | Mechanical identity |
| --- | --- |
| **Plains** | Fertile/common land: faster territorial acquisition plus a small faction Population-Growth benefit. |
| **Highland** | Offensive terrain: attacks sourced from Highland fight more effectively. |
| **Mountain** | Defensive/slow terrain: harder to acquire and stronger for an actual automatic defender. |
| **Desert** | Economic terrain: somewhat slower to acquire, but a large Desert share improves FFY-event yield. |
| **Forest** | Defender-favored attritional terrain. |
| **Tundra** | Cursed/low-value land without an active ownership penalty: conquerable, but **0 Capacity and unbuildable**. |
| **Marsh** | Universally awkward fighting terrain: very slow acquisition and poor attack/defense performance. |
| **Shallow Water** | Conquerable river/ford/coastal terrain traversable by ordinary territorial operations and naval units, but **0 Capacity and unbuildable**. |
| **Deep Water** | Naval-only, unconquerable water. |
| **Impassable** | Hard map topology: neither conquerable nor traversable. |

---

## 1.4 Conquerable non-population-bearing terrain

Tundra and Shallow Water are conquerable territory but contribute `0` Population Capacity.

They may matter for borders, routes, victory territory, Segments, and controller strategy, but owning them never reduces existing Population or Growth merely because the land was acquired.

The baseline `1 Population per successfully settled neutral cell` cost applies only to population-bearing neutral cells. Neutral Tundra and Shallow Water therefore cost `0 Population` to acquire while still requiring ordinary settlement/capture progress and time.

A hostile automatically defended Tundra/Shallow-Water cell still produces the ordinary successful-capture casualties:

```text
defender Population casualty = 1
attacker Population casualty = 1
```

but transfers `0` Capacity.

---

## 1.5 Tundra-specific rules

| Property | Tundra rule |
| --- | --- |
| Conquerable | Yes |
| Population Capacity | **0/cell** |
| Population Growth penalty for owning it | **None** |
| Structure construction | **Forbidden** |
| Initial Territory / exact spawn | Forbidden |
| Capture / settlement speed | **80%** |
| Source offense | 100% |
| Target defense | **+5%** |

---

## 1.6 Shallow Water and Deep Water

### Shallow Water

| Property | Shallow Water rule |
| --- | --- |
| Conquerable / ownable | **Yes** |
| Counts toward conquerable-territory / victory geography | **Yes** |
| Population-bearing / Capacity | **No / 0** |
| Ordinary land operation may enter/cross | **Yes** |
| Transport required merely to cross | **No** |
| Naval traversal | **Yes** |
| Structure construction | **Forbidden** |
| Initial Territory / exact spawn | Forbidden |
| Capture / settlement speed | **70%** |
| Source offense | **-15%** |
| Target defense | **-15%** |

Shallow Water political ownership allows rivers to become real controllable fronts. Heavy land units such as Tanks have their own traversal rules and are **not** automatically permitted merely because ordinary territorial operations may cross.

### Deep Water

`Deep Water` is the canonical mechanical name for the inherited generic Ocean role.

| Property | Deep Water rule |
| --- | --- |
| Conquerable / ownable | No |
| Population-bearing / Capacity | No / 0 |
| Ordinary land traversal | No |
| Naval traversal | Yes |
| Structure construction | Forbidden |
| Initial Territory / exact spawn | Forbidden |

Optional water-nuke terrain conversion creates **Deep Water**, not Shallow Water.

---

## 1.7 Fallout is an overlay, not a replacement base terrain

Fallout is a persistent overlay/state on legal conquerable land, not a mutually exclusive base terrain replacing Plains/Mountain/etc. The underlying terrain retains its Capacity status, traversal rules, structure-buildability rule, source-offense modifier, target-defense modifier, and terrain-share identity.

The provisional ordinary Fallout acquisition modifier is:

```text
capture / settlement speed × 0.50
```

The accepted Origin effect that ignores ordinary Fallout capture resistance removes/bypasses this `×0.50` penalty while retaining the underlying terrain modifiers.

Fallout never creates phantom Population defenders.

A rule may explicitly **neutralize an owned cell and apply Fallout**. In that case Capacity is lost because ownership is removed, not because the Fallout overlay itself changes the underlying terrain's Capacity classification.

---

## 1.8 Terrain modifier composition

Unless an explicit typed rule states otherwise, terrain percentages compose through the canonical modifier system rather than hidden special cases.

Terrain data and effective modifiers must be available through the legal controller observation/rules/mechanics API so a controller is never required to reverse-engineer these values from outcomes.

---

# 2. Persistent structures — canonical provisional V1 baseline

Open Fufu V1 has **eight canonical persistent structures**:

1. City
2. Fort
3. Port
4. Factory
5. Missile Silo
6. SAM Launcher
7. Observation Post
8. Command Post

All persistent structures have levels `1–5`. A normal purchase creates L1. Level 5 is a hard maximum.

The inherited OpenFront `Defense Post` is implementation ancestry for the public Open Fufu **Fort**, not an additional structure.

## 2.1 Construction and upgrade rules

- Every structure has a fixed FFY price for each target level shown below.
- Prices depend on **structure type + target level**, not on how many other structures or constructed levels the faction owns.
- Port and Factory therefore do **not** share the inherited OpenFront price counter.
- Building L1 takes the structure's listed build time.
- Every L2–L5 upgrade takes **the same build time as that structure's L1 construction**.
- A newly built structure is inactive until construction completes.
- During an upgrade, the structure remains operational at its previous completed level; the new level and effects activate atomically when the upgrade completes.
- Ordinary structure placement requires an owned cell whose base terrain allows structures. Port additionally requires a legal coast/water interface.
- Same-type area effects never add together on one cell; the strongest applicable same-type effect wins.

## 2.2 Structure costs and build/upgrade times

| Structure | Time per build/upgrade | L1 | L2 | L3 | L4 | L5 | L1→L5 total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **City** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |
| **Fort** | **5s** | 50k | 100k | 150k | 200k | 250k | **750k** |
| **Port** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |
| **Factory** | **10s** | 150k | 300k | 600k | 900k | 1.20m | **3.15m** |
| **Missile Silo** | **15s** | 1.00m | 2.00m | 3.00m | 4.00m | 5.00m | **15.00m** |
| **SAM Launcher** | **15s** | 1.00m | 2.00m | 3.00m | 4.00m | 5.00m | **15.00m** |
| **Observation Post** | **5s** | 50k | 100k | 200k | 300k | 400k | **1.05m** |
| **Command Post** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |

These are ordinary FFY costs before explicit Origin/Echo modifiers.

## 2.3 Level effects

| Effect | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **City — faction Population Growth contribution** | +1% | +2% | +3% | +4% | **+5%** |
| **Fort — defensive pressure** | +10% | +15% | +20% | +25% | **+30%** |
| **Fort — coverage radius** | 30 | 35 | 40 | 45 | **50** |
| **Port — passive naval repair radius** | 20 | 25 | 30 | 35 | **40** |
| **Port — passive naval repair rate** | 1.00× | 1.25× | 1.50× | 1.75× | **2.00×** |
| **Factory — industrial/train FFY event value** | 100% | 110% | 120% | 130% | **140%** |
| **Factory — simultaneous Tank repair capacity** | 1 | 2 | 3 | 4 | **5** |
| **Missile Silo — simultaneous charges** | 1 | 2 | 3 | 4 | **5** |
| **SAM Launcher — simultaneous charges** | 1 | 2 | 3 | 4 | **5** |
| **SAM Launcher — interception range** | 70 | 80 | 90 | 100 | **105** |
| **Observation Post — observation radius** | 40 | 55 | 70 | 85 | **100** |
| **Command Post — source offensive pressure** | +5% | +10% | +15% | +20% | **+25%** |
| **Command Post — coverage radius** | 20 | 25 | 30 | 35 | **40** |

## 2.4 Structure-specific rules

### City

Each completed City contributes its listed percentage additively to the faction's explicit City-derived Population Growth modifier. Cities never increase Population Capacity. Cities remain valid train trade stations in the rail economy.

### Fort

A Fort never creates Population defenders. Its defensive-pressure effect applies only to a real automatic defender on a covered cell. Overlapping friendly Forts use the strongest applicable Fort effect rather than adding percentages.

### Port

Ports remain Trade-Ship origins/destinations and the naval repair infrastructure for Warships. Port level's canonical V1 progression is repair radius/rate; inherited OpenFront trade-spawn scaling by Port level is not part of the canonical Open Fufu progression unless later added explicitly.

### Factory

Factories remain the industrial/rail source that generates trains and Factory-driven FFY events. Factory level multiplies the FFY value/effectiveness of those events; it does not inherently increase train count. Factories also construct and repair the baseline Tank unit defined in §3.

### Missile Silo

Ordinary strategic-weapon access by completed Silo level:

| Completed level | Weapon access |
| ---: | --- |
| L1–L2 | Atom Bomb |
| L3–L4 | Atom Bomb + Hydrogen Bomb |
| L5 | Atom Bomb + Hydrogen Bomb + MIRV |

Charge capacity equals completed level. Baseline recharge cooldown is **9 seconds per expended charge**.

### SAM Launcher

SAM targeting/interception is automatic. Charge capacity equals completed level. Baseline recharge cooldown is **9 seconds per expended charge**. Completed-level range is exactly `70 / 80 / 90 / 100 / 105`.

### Observation Post

An Observation Post reveals legally revealable operational state inside its completed-level radius, including hostile mobile units, persistent structures, and active visible operations needed for tactical targeting/decision-making.

It never reveals controller memory, unmanifested plans, hidden private state, or information outside the surfaced visibility model. Observation from multiple Posts does not stack; coverage is boolean.

### Command Post

A completed Command Post gives its listed offensive-pressure modifier to an ordinary land engagement lane when that lane's **attacking source cell** lies inside friendly Command-Post coverage.

It modifies ordinary Population-based land offensive pressure only. It does **not** modify Tank/Heavy-Artillery weapon damage, Warship damage, strategic weapons, or unrelated FFY effects unless another explicit rule says so.

Overlapping friendly Command Posts use only the strongest applicable Command-Post modifier.

---

# 3. Factory mobile land unit — Tank

The **Tank** is the sole baseline persistent land military unit. One map Tank represents an abstract armored formation rather than one literal vehicle.

Its strategic identity is the land analogue of a Warship: an expensive, persistent autonomous raider/interdictor that fights enemy armor, raids economic traffic, and inflicts direct Population casualties without capturing territory.

## 3.1 Production and persistence

| Property | Baseline Tank rule |
| --- | --- |
| Produced by | Active owned **Factory** |
| Factory level required | L1+ |
| Build time | **10s** |
| Concurrent Tank builds per Factory | **1** |
| Purchase resource | FFY |
| Max owned Tanks | No hard cap |
| Counts transformed Heavy Artillery as Tanks | **Yes** |
| Captures territory | **No** |
| Carries Population | **No** |
| Generic structure damage | **No** |
| Max health | **1,000** |
| Automatic repair-retreat threshold | **50% health** |
| Repair structure | Factory |
| Factory repair radius | **5 cells** |
| Repair rate | **100 HP/s per repairing Tank** |
| Simultaneous repairs per Factory | Factory completed level (`1–5`) |

Tank construction does not pause the Factory's ordinary train-generation logic in V1.

### Purchase-cost curve

The next Tank's ordinary cost depends on the faction's currently active Tank/Heavy-Artillery count:

```text
TankCost = min(1,000,000 FFY, 250,000 FFY × (activeTanks + 1))
```

| Active Tanks before purchase | Next Tank cost |
| ---: | ---: |
| 0 | **250k** |
| 1 | **500k** |
| 2 | **750k** |
| 3+ | **1.00m** |

Destroyed Tanks stop counting, so replacement cost may fall.

## 3.2 Movement and terrain

Baseline Plains movement speed is **5 cells/second**. Terrain multiplies that speed as follows:

| Terrain | Tank traversal | Speed multiplier | Derived speed |
| --- | ---: | ---: | ---: |
| **Plains** | Yes | 100% | **5.00 cells/s** |
| **Highland** | Yes | 80% | **4.00 cells/s** |
| **Mountain** | **Blocked** | — | — |
| **Desert** | Yes | 90% | **4.50 cells/s** |
| **Forest** | Yes | 65% | **3.25 cells/s** |
| **Tundra** | Yes | 75% | **3.75 cells/s** |
| **Marsh** | Yes | 50% | **2.50 cells/s** |
| **Shallow Water** | **Blocked** | — | — |
| **Deep Water** | Blocked | — | — |
| **Impassable** | Blocked | — | — |

Tanks may path through friendly-owned traversable terrain and through traversable territory belonging to a faction they are legally hostile to. Neutral/Terra-Nullius land does not serve as a Tank path; ordinary territorial control must establish a corridor first.

Mountains and Shallow Water therefore form genuine armored barriers even though ordinary Population-based territorial warfare may cross Shallow Water.

## 3.3 Strategic control

Tank control is strategic, not RTS micro.

The controller assigns a Tank a patrol/raid anchor or legal area/target. Baseline patrol/raid leash is **100 cells** from its assigned anchor. Pathing, local pursuit, target selection, firing, and repair retreat are autonomous.

No V1 controller action exists for turret rotation, per-shot firing, frame-by-frame kiting, or other micro-control.

Tank attacks require the target to be legally observed under the surfaced visibility model.

## 3.4 Combat and raiding

| Attack mode | Range | Damage / result | Cooldown |
| --- | ---: | ---: | ---: |
| **vs enemy Tank/Heavy Artillery** | **30 cells** | **250 HP** | **1s** |
| **vs enemy Train** | **30 cells** | Train intercepted/destroyed in one successful attack | **1s weapon cadence** |
| **vs enemy Population** | **30 cells** | **250 Population casualties** | **3s** |

Population attacks never capture the target cell and do not inherently alter Capacity or terrain.

Tank-vs-Tank target selection and Train pursuit are autonomous inside the assigned legal operational area. Exact tie-breaking is deterministic.

### Train interception / land piracy

A Train carries a deterministic snapshotted **current cargo FFY value** for its next eligible paying stop/event. If a hostile Tank intercepts the Train before that payout:

- the Train is removed;
- its pending ordinary payout is canceled;
- the Tank owner receives **100% of that snapshotted current cargo value** as a raiding FFY event;
- already-earned prior Train FFY is never clawed back.

This is the terrestrial economic-raiding analogue of Warship piracy against Trade Ships.

---

# 4. Tank Origin transformations

The Origin catalogue defines the authoritative trait IDs/costs. This section records the Tank-side mechanical data those traits use.

## 4.1 Heavy Artillery transformation

A Heavy-Artillery Origin does not create a second baseline unit. It **transforms every Tank owned/built by the faction into Heavy Artillery**.

| Stat / capability | Baseline Tank | Heavy Artillery |
| --- | ---: | ---: |
| Purchase cost | 1.00× Tank curve | **1.50×** |
| Max health | 1,000 | **1,000** |
| Movement | terrain table | **0.50× final Tank movement speed** |
| Anti-armor range | 30 | **45** |
| Anti-armor damage | 250 | **1,000** |
| Anti-armor cooldown | 1s | **12s** |
| Population range | 30 | **45** |
| Population damage / shot | 250 | **1,000** |
| Population cooldown | 3s | **12s** |
| Train interception / raiding | Yes | **Disabled** |
| Territory capture | No | No |
| Terrain traversal barriers | Tank rules | **Same Tank barriers** |
| Projectile blocked by Mountain/Shallow Water | — | **No** |

Heavy Artillery projectiles may cross terrain the unit itself cannot traverse, including Mountain and Shallow Water. Range is measured normally and the target must still be legally observed.

The transformation intentionally adds no health. Range/alpha are its protection; exposed artillery is meant to die quickly to Tanks.

### Baseline matchup benchmark

With unmodified baseline stats and a prepared first shot:

| Engagement | Intended result |
| --- | --- |
| **1 Heavy Artillery vs 1 Tank** | Heavy Artillery favored; its 1,000-damage opening shot kills a baseline Tank |
| **1 Heavy Artillery vs 2 Tanks** | Tanks strongly favored after the first Tank is killed; the survivor can close and destroy the Artillery before its 12s reload |
| **2 Heavy Artillery vs 3 Tanks** | Tanks favored: two Tanks may die to the opening volley, but the survivor's 250 damage/s can destroy both 1,000-HP Artillery pieces before the 12s reload |
| **Artillery caught exposed / during reload** | Tank-favored |
| **Prepared Artillery firing across open approach** | Dangerous/expensive for Tanks |
| **Artillery attempting to retreat from pursuing Tanks** | Usually unfavorable because Artillery movement is halved |

This matchup is an emergent consequence of health, damage, range, reload, and movement rather than a hidden outnumbered/combat-ratio modifier.

## 4.2 Radioactive Munitions

Radioactive Munitions modifies **successful Population attacks only**.

It does not affect Tank-vs-Tank/Artillery attacks or Train interception.

On a successful affected Population attack:

1. ordinary Population damage is resolved;
2. eligible enemy-owned population-bearing cells in the attack footprint are neutralized;
3. those neutralized cells receive the Fallout overlay;
4. the former owner immediately loses the Capacity those cells contributed because ownership was removed.

The Fallout overlay itself is not what removes Capacity; **neutralization is**.

### Fallout footprint

| Unit form | Fallout footprint per successful Population attack |
| --- | --- |
| **Baseline Tank + Radioactive Munitions** | **Target cell only: up to 1 cell** |
| **Heavy Artillery + Radioactive Munitions** | **Manhattan radius 1: target + four cardinal neighbors, up to 5 cells** |

Only enemy-owned **population-bearing** cells are eligible. Non-population terrain such as Tundra/Shallow Water is skipped. Structure-occupied cells are skipped by this trait in V1; Radioactive Munitions does not gain implicit structure-destruction capability.

If part of the footprint is ineligible, fewer cells are neutralized; the footprint does not expand outward to compensate.

Direct Population damage remains the unit's ordinary Population-attack damage (`250` Tank / `1,000` Heavy Artillery). Radioactive Munitions does not add a second Population-damage multiplier.

Heavy Artillery and Radioactive Munitions are independent Origin traits and may be legally combined, producing **nuclear Heavy Artillery** with the Heavy-Artillery combat profile and the five-cell Fallout footprint.

---

# 5. Next design work

Before recomputing the exhaustive Echo catalogue:

1. add appropriate Origin traits for the expanded terrain/structure library without proliferating redundant numerical traits better suited to Echoes;
2. expand the Echo stat/scope pool to cover Forest, Tundra, Marsh, Shallow Water, Observation Post, Command Post, Tank, and any accepted Tank-related numerical axes;
3. audit all builder-legal Origin combinations involving Heavy Artillery / Radioactive Munitions;
4. recompute the exhaustive whole-percentage Echo mechanical catalogue after the final modifier-key pool is settled;
5. tune structure/Tank numerical values through simulation/playtesting while preserving these accepted provisional identities.
