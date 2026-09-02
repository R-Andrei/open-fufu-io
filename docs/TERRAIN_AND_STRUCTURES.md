# Open Fufu — Canonical Terrain and Structure Registry

## Status and authority

This file is the **canonical detailed data registry for Open Fufu terrain, persistent structures, and baseline mobile-unit content covered here**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains the overarching game-design contract. **Within this registry's domain, this file is authoritative for the concrete terrain/structure/mobile-unit roster, numeric baselines, construction times, level tables, and detailed mechanical data.** A shorter or older summary in the high-level design/integration documents does not override this registry's more specific data; those summaries must instead be synchronized to this registry when touched.

Concrete Origin trait IDs/costs remain in [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

Nothing in this file authorizes gameplay implementation.

The rules and values below are the **accepted provisional V1 baseline**. Numeric values may change through development, simulation, balance testing, or playtesting without reopening the underlying identities.

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
- a **capture / settlement speed multiplier**;
- a **source offensive-pressure modifier**;
- a **target defensive-pressure modifier**;
- an optional faction-wide effect based on owned terrain composition.

### Capture / settlement speed

`Capture / settlement speed` multiplies the rate at which a legally contested/acquired target cell accumulates ownership-change progress after local attack/defense pressure has been resolved.

```text
finalCaptureOrSettlementProgress
= ordinaryProgressFromPressure
× targetTerrainCaptureSettlementMultiplier
× other explicit progress modifiers
```

It applies to hostile capture and neutral settlement. It does not itself change Population casualties or settlement Population cost.

### Source offense / target defense

Terrain offensive pressure is determined by the **attacking source cell's base terrain**. Terrain defensive pressure is determined by the **target/defended cell's base terrain**.

Terrain never creates an automatic Population defender.

### Terrain-share effects

```text
terrainShare(T)
= owned population-bearing cells of terrain T
  / all owned population-bearing cells
```

If the faction owns no population-bearing cells, terrain-share bonuses are zero. Tundra and Shallow Water do not enter this denominator.

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

## 1.3 Terrain identities

| Terrain | Mechanical identity |
| --- | --- |
| **Plains** | Fertile/common land: fast acquisition plus a small Population-Growth benefit. |
| **Highland** | Offensive terrain. |
| **Mountain** | Defensive and slow to acquire. |
| **Desert** | Economic terrain with slower acquisition. |
| **Forest** | Defender-favored attritional terrain. |
| **Tundra** | Low-value/cursed land without an active ownership penalty: conquerable, **0 Capacity, unbuildable**. |
| **Marsh** | Very slow acquisition with poor attack and defense performance. |
| **Shallow Water** | Conquerable river/ford/coastal terrain; ordinary land operations and naval units may traverse it, but it has **0 Capacity and is unbuildable**. |
| **Deep Water** | Naval-only unconquerable water. |
| **Impassable** | Hard map topology. |

## 1.4 Conquerable non-population-bearing terrain

Tundra and Shallow Water are conquerable but contribute `0` Population Capacity.

The baseline `1 Population per successfully settled neutral cell` cost applies only to population-bearing neutral cells. Neutral Tundra/Shallow Water therefore cost `0 Population` to acquire while still requiring ordinary acquisition progress/time.

A hostile automatically defended Tundra/Shallow-Water cell still produces ordinary successful-capture casualties:

```text
defender Population casualty = 1
attacker Population casualty = 1
```

but transfers `0` Capacity.

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

## 1.6 Shallow Water / Deep Water

| Property | Shallow Water | Deep Water |
| --- | ---: | ---: |
| Ownable | **Yes** | No |
| Capacity | `0` | `0` |
| Ordinary land operation traversal | **Yes** | No |
| Naval traversal | **Yes** | Yes |
| Structures | No | No |
| Initial Territory / exact spawn | No | No |
| Capture / settlement speed | **70%** | — |
| Source offense | **-15%** | — |
| Target defense | **-15%** | — |

Heavy land units have their own traversal table and are not automatically allowed to cross Shallow Water merely because Population-based territorial operations may do so.

Optional water-nuke terrain conversion creates **Deep Water**.

## 1.7 Fallout overlay

Fallout is an overlay on legal conquerable terrain, not a replacement base terrain.

```text
ordinary Fallout capture / settlement speed × 0.50
```

The underlying terrain retains its Capacity classification, traversal, structure-buildability, source offense, target defense, and terrain-share identity.

Fallout never creates phantom Population defenders.

A rule may explicitly **neutralize an owned cell and apply Fallout**. Capacity is then lost because ownership was removed; the Fallout overlay itself does not redefine the base terrain's Capacity.

P16 ignores the ordinary Fallout acquisition penalty while preserving the underlying terrain modifiers.

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

All persistent structures have levels `1–5`; normal purchases create L1 and L5 is the hard maximum. The inherited OpenFront `Defense Post` is implementation ancestry for the public **Fort**, not another structure.

## 2.1 Construction / upgrade rules

- Every structure has a fixed FFY cost by **structure type + target level**.
- Costs do not scale with the number of structures/levels already owned unless an explicit Origin modifies them.
- Port and Factory do **not** share OpenFront's inherited price counter.
- Building L1 takes the listed time.
- Every L2–L5 upgrade takes **the same time as that structure's L1 build**.
- A new structure is inactive until construction completes.
- During an upgrade the structure remains operational at its previous completed level; the new level activates atomically when construction finishes.
- Ordinary placement requires owned buildable terrain; Port additionally requires a legal coast/water interface.
- Same-type area effects do not stack; the strongest applicable same-type effect wins.

## 2.2 Costs and times

| Structure | Time per build/upgrade | L1 | L2 | L3 | L4 | L5 | L1→L5 total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **City** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |
| **Fort** | **5s** | 50k | 100k | 150k | 200k | 250k | **750k** |
| **Port** | **5s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |
| **Factory** | **10s** | 150k | 300k | 600k | 900k | 1.20m | **3.15m** |
| **Missile Silo** | **15s** | 1.00m | 2.00m | 3.00m | 4.00m | 5.00m | **15.00m** |
| **SAM Launcher** | **15s** | 1.00m | 2.00m | 3.00m | 4.00m | 5.00m | **15.00m** |
| **Observation Post** | **5s** | 50k | 100k | 200k | 300k | 400k | **1.05m** |
| **Command Post** | **10s** | 100k | 200k | 400k | 600k | 800k | **2.10m** |

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
| **Factory — simultaneous Tank/Heavy-Artillery repair capacity** | 1 | 2 | 3 | 4 | **5** |
| **Missile Silo — simultaneous charges** | 1 | 2 | 3 | 4 | **5** |
| **SAM Launcher — simultaneous charges** | 1 | 2 | 3 | 4 | **5** |
| **SAM Launcher — interception range** | 70 | 80 | 90 | 100 | **105** |
| **Observation Post — observation radius** | 40 | 55 | 70 | 85 | **100** |
| **Command Post — source offensive pressure** | **+3%** | **+6%** | **+9%** | **+12%** | **+15%** |
| **Command Post — coverage radius** | **30** | **35** | **40** | **45** | **50** |

## 2.4 Structure-specific rules

### City

Each completed City contributes its listed percentage additively to the faction's explicit City-derived Population Growth modifier. Cities never increase Population Capacity. Cities remain valid train trade stations.

### Fort

A Fort never creates Population defenders. Its defensive-pressure effect applies only to a real automatic defender on a covered cell.

### Port

Ports remain Trade-Ship origins/destinations and naval repair infrastructure. Port level's canonical progression is repair radius/rate; inherited OpenFront Port-level Trade-Ship-spawn scaling is not part of canonical Open Fufu unless later added explicitly.

Ports also construct Warships. A baseline Warship purchase has a **5-second construction time** before the Warship becomes active; it no longer appears instantly. Origin effects that alter Warship purchase resource/cost do not bypass this time unless explicitly stated.

### Factory

Factories generate trains and Factory-driven industrial/train FFY events. Factory level multiplies those FFY events but does not inherently increase train count.

Factories also construct and repair Tanks/Heavy Artillery.

### Missile Silo

| Completed level | Weapon access |
| ---: | --- |
| L1–L2 | Atom Bomb |
| L3–L4 | Atom Bomb + Hydrogen Bomb |
| L5 | Atom Bomb + Hydrogen Bomb + MIRV |

Charge capacity equals completed level. Baseline recharge cooldown is **9s per expended charge**.

### SAM Launcher

Targeting/interception is automatic. Charge capacity equals completed level. Baseline recharge cooldown is **9s per expended charge**. Range is exactly `70 / 80 / 90 / 100 / 105`.

### Observation Post

Reveals legally revealable operational state inside its completed-level radius, including hostile mobile units, persistent structures, and manifested operations needed for tactical targeting/decisions.

It never reveals controller memory, unmanifested plans, hidden private state, or information outside the surfaced visibility model. Observation coverage is boolean; overlapping Posts do not stack.

### Command Post

A completed Command Post gives its listed offensive-pressure modifier to an ordinary Population-based land engagement lane when the lane's **attacking source cell** lies inside friendly Command-Post coverage.

It does not modify Tank/Heavy-Artillery weapon damage, Warship damage, strategic weapons, or unrelated FFY effects.

Its **10-second construction/upgrade time is intentional strategic telegraphing**: offensive infrastructure is meant to be planned and gives opponents time to observe/react rather than appearing immediately before an attack.

---

# 3. Factory mobile land unit — Tank

The **Tank** is the sole baseline persistent land military unit. One map Tank represents an abstract armored formation, not one literal vehicle.

Its role is the land analogue of a Warship: autonomous raiding/interdiction, fighting enemy armor, attacking economic traffic, and causing direct Population casualties without capturing territory.

## 3.1 Production and persistence

| Property | Baseline Tank rule |
| --- | --- |
| Produced by | Active owned **Factory** |
| Factory level required | L1+ |
| Build time | **5s** |
| Concurrent Tank builds per Factory | **1** |
| Purchase resource | FFY |
| Max owned Tanks | No hard cap |
| Heavy Artillery counts as Tanks for ownership/cost curve | **Yes** |
| Captures territory | **No** |
| Carries Population | **No** |
| Generic structure damage | **No** |
| Max health | **1,000** |
| Automatic repair-retreat threshold | **50% health** |
| Repair structure | Factory |
| Factory repair radius | **5 cells** |
| Repair rate | **100 HP/s per repairing unit** |
| Simultaneous repairs per Factory | completed Factory level (`1–5`) |

Tank construction does not pause ordinary train-generation logic.

### Purchase-cost curve

```text
TankCost = min(1,000,000 FFY, 250,000 FFY × (activeTanks + 1))
```

| Active Tanks/Heavy Artillery before purchase | Next baseline Tank cost |
| ---: | ---: |
| 0 | **250k** |
| 1 | **500k** |
| 2 | **750k** |
| 3+ | **1.00m** |

Destroyed units stop counting.

## 3.2 Movement and terrain

Baseline Plains movement speed is **5 cells/s**.

| Terrain | Traversal | Speed multiplier | Derived Tank speed |
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

Tanks may path through friendly traversable territory and traversable territory belonging to a faction they are legally hostile to. Neutral/Terra-Nullius cells do not form a Tank corridor; ordinary territorial control must establish one first.

Mountain and Shallow Water are genuine armored barriers.

## 3.3 Strategic control

Tank control is strategic rather than RTS micro.

The controller assigns a Tank a patrol/raid anchor or legal area/target. Baseline leash is **100 cells** from the assigned anchor. Pathing, local pursuit, target choice, firing, and repair retreat are autonomous.

No V1 controller action exists for per-shot firing, turret control, frame-by-frame kiting, or equivalent micro.

Tank attacks require legal observation under the surfaced visibility model.

## 3.4 Combat and raiding

| Attack mode | Range | Damage / result | Cooldown |
| --- | ---: | ---: | ---: |
| **vs enemy Tank/Heavy Artillery** | **30** | **250 HP** | **1s** |
| **vs enemy Train** | **30** | Train intercepted/destroyed | **1s weapon cadence** |
| **vs enemy Population** | **30** | **250 Population casualties** | **3s** |

Population attacks never capture territory by themselves.

### Train interception / land piracy

A Train carries a deterministic snapshotted **current cargo FFY value** for its next eligible paying stop/event. If intercepted before that payout:

- the Train is removed;
- its pending ordinary payout is canceled;
- the Tank owner receives **100% of that snapshotted current cargo value** as a raiding FFY event;
- previously earned Train FFY is not clawed back.

---

# 4. Tank Origin transformations

The Origin catalogue defines trait IDs/costs. This section defines the unit-side mechanical contract.

## 4.1 Heavy Artillery transformation

Heavy Artillery is **not a second baseline unit**. P43 transforms every Tank owned/built by the faction.

| Stat / capability | Baseline Tank | Heavy Artillery |
| --- | ---: | ---: |
| Build time | **5s** | **10s** |
| Purchase cost | 1.00× Tank curve | **1.50×** |
| Max health | 1,000 | **1,000** |
| Movement | terrain table | **0.50× final Tank movement** |
| Anti-armor range | 30 | **45** |
| Anti-armor damage | 250 | **1,000** |
| Anti-armor cooldown | 1s | **12s** |
| Population range | 30 | **45** |
| Population damage / shot | 250 | **1,000** |
| Population cooldown | 3s | **12s** |
| Train interception / raiding | Yes | **Disabled** |
| Territory capture | No | No |
| Traversal barriers | Tank rules | **Same Tank barriers** |
| Projectiles blocked by Mountain/Shallow Water | — | **No** |

Heavy-Artillery projectiles may cross terrain the unit cannot traverse, including Mountain and Shallow Water, provided range, observation, and target legality succeed.

No extra health is granted; range and alpha are the unit's protection.

### Matchup benchmark

With unmodified baseline stats and a prepared first shot:

| Engagement | Intended result |
| --- | --- |
| **1 Heavy Artillery vs 1 Tank** | Heavy Artillery favored; opening shot kills the Tank |
| **1 Heavy Artillery vs 2 Tanks** | Tanks strongly favored after one dies |
| **2 Heavy Artillery vs 3 Tanks** | Tanks favored after the opening volley |
| **Artillery caught exposed / reloading** | Tank-favored |
| **Prepared Artillery across open approach** | Dangerous for Tanks |
| **Artillery retreating from Tanks** | Usually unfavorable |

These outcomes are emergent from range, alpha, reload, movement, and health; there is no hidden outnumbered modifier.

## 4.2 Radioactive Munitions

P44 applies only to **successful Population attacks**, never anti-armor combat or Train interception.

After ordinary Population damage resolves, the attack neutralizes enemy-owned population-bearing cells and applies Fallout. Capacity is removed because those cells become neutral.

### Deterministic Fallout/Capacity footprint

| Unit form | Candidate footprint | Maximum cells neutralized per successful Population shot |
| --- | --- | ---: |
| **Tank + Radioactive Munitions** | target-centered **Manhattan radius 2** | **10 cells / 10 Capacity** |
| **Heavy Artillery + Radioactive Munitions** | target-centered **Manhattan radius 5** | **50 cells / 50 Capacity** |

Resolution:

1. collect enemy-owned population-bearing candidate cells inside the listed radius;
2. exclude structure-occupied cells and all non-population-bearing terrain;
3. order candidates deterministically by Manhattan distance from the target, then stable cell/tile ID;
4. neutralize/apply Fallout to the first `10` or `50` candidates respectively.

If fewer eligible cells exist inside the footprint, only those cells are affected; the search does not expand beyond the listed radius.

Direct Population damage remains ordinary: `250` for Tank and `1,000` for Heavy Artillery. P44 adds no second Population-damage multiplier.

P43 and P44 are independent and explicitly legal together, producing **radioactive Heavy Artillery**.

---

# 5. Mobile-unit production timings

| Unit | Production source | Baseline construction time |
| --- | --- | ---: |
| **Warship** | Port | **5s** |
| **Tank** | Factory | **5s** |
| **Heavy Artillery (P43 Tank transformation)** | Factory | **10s** |

Construction time is a real delay before the purchased unit becomes active. Purchase-resource/cost transformations do not bypass it unless explicitly stated.

---

# 6. Next design work

Before recomputing the exhaustive Echo catalogue:

1. add appropriate Origin traits for the expanded terrain/structure library without duplicating simple Echo-style tuning;
2. expand the Echo stat/scope pool for Forest, Tundra, Marsh, Shallow Water, Observation Post, Command Post, Tank, and accepted Tank-related axes;
3. audit all builder-legal P43/P44 combinations;
4. recompute the exhaustive whole-percentage Echo catalogue after the modifier-key pool is settled;
5. tune values through simulation/playtesting while preserving the accepted identities.
