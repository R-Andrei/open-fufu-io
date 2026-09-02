# Open Fufu — Canonical Terrain and Structure Registry

## Status and authority

This file is the **canonical data registry for Open Fufu terrain and persistent-structure content**.

It is a detailed data appendix to [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), especially §18, and does not replace that document as the overall game-design authority. If this registry and the canonical design contract ever conflict, the design contract wins and this registry must be corrected.

The purpose of this file is to keep concrete terrain/structure tables, values, capabilities, and later balance revisions in one place rather than scattering numeric content across multiple design documents.

Nothing in this file authorizes gameplay implementation.

The terrain rules below are the **accepted provisional V1 baseline**. Numeric values may change through development, simulation, balance testing, or playtesting without reopening the underlying terrain identities.

The structure section currently records only the already-accepted six-structure V1 baseline. The next design pass may expand or revise structure content; that work should update this same file rather than create another competing structure catalogue.

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

It applies to both:

- hostile territorial capture; and
- neutral settlement/expansion.

It does **not** by itself change Population casualties or neutral-settlement Population cost.

A `110%` terrain is acquired 10% faster than ordinary at the same pressure state. An `80%` terrain is acquired 20% slower.

### Source offense / target defense

Terrain offensive pressure is determined by the **attacking source cell's base terrain**.

Terrain defensive pressure is determined by the **target/defended cell's base terrain**.

Examples:

```text
Highland source
→ +8% source offensive pressure

Mountain target with an automatic defender
→ +15% target defensive pressure
```

Terrain never creates an automatic Population defender. If the target receives no automatic defender, a percentage defensive-pressure modifier alone creates no Population or phantom defense.

### Terrain-share effects

For faction-wide terrain-composition effects, define:

```text
terrainShare(T)
= owned population-bearing cells of terrain T
  / all owned population-bearing cells
```

If the faction owns no population-bearing cells, terrain-share bonuses are zero.

Conquerable but non-population-bearing cells such as Tundra and Shallow Water do not enter this denominator and do not dilute Plains/Desert share.

The provisional V1 share effects use bounded linear scaling rather than hidden diminishing-return curves. They may later be retuned if playtesting shows that a nonlinear curve is preferable.

---

## 1.2 Canonical base-terrain table

| Terrain | Conquerable / ownable | Population-bearing | Capacity while owned | Land traversal | Naval traversal | Structures buildable | Initial Territory / spawn eligible | Capture / settlement speed | Source offense | Target defense | Faction-wide ownership effect |
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

All percentage values in this table are provisional balance values but are accepted as the V1 implementation/testing baseline.

---

## 1.3 Terrain identities

| Terrain | Mechanical identity |
| --- | --- |
| **Plains** | Fertile/common land: faster territorial acquisition plus a small faction Population-Growth benefit when much of the faction's demographic territory is Plains. |
| **Highland** | Offensive terrain: attackers projecting pressure from Highland cells fight more effectively. |
| **Mountain** | Defensive/slow terrain: harder to acquire and stronger for an actual automatic defender. |
| **Desert** | Economic terrain: somewhat slower to acquire, but owning a large Desert share improves overall FFY-event yield. |
| **Forest** | Defender-favored attritional terrain: slower conquest, weaker attacks from inside it, stronger defense inside it. |
| **Tundra** | Cursed/low-value territorial land without an active ownership penalty: conquerable, but supplies **no Population Capacity and allows no structures**. |
| **Marsh** | Universally awkward fighting terrain: very slow acquisition and poor combat performance for both attackers and defenders. |
| **Shallow Water** | Conquerable crossing terrain for rivers/fords/coastal shallows: traversable by both land operations and naval units, but non-population-bearing, unbuildable, and tactically poor. |
| **Deep Water** | Naval-only water: not politically conquerable and not traversable by ordinary land operations. Replaces the old generic mechanical `Ocean` role. |
| **Impassable** | Hard map topology: neither conquerable nor traversable. |

---

## 1.4 Conquerable non-population-bearing terrain

Tundra and Shallow Water establish an explicit V1 distinction between **conquerable territory** and **population-bearing territory**.

For both terrains:

```text
owned cell
→ counts as owned/conquerable territory
→ contributes 0 Population Capacity
```

Therefore:

- they may matter for borders, routes, map control, victory-territory accounting, Segments, and controller strategy;
- owning them never reduces existing Population or Growth merely because the land was acquired;
- they simply provide no Capacity themselves;
- they are not eligible cells for Initial Territory footprint generation or exact spawn origins;
- owning only Tundra/Shallow Water does not prevent the canonical `zero population-bearing territory` defeat rule from triggering.

### Neutral acquisition cost

The baseline `1 Population per successfully settled neutral cell` colonization/occupation cost applies only to **population-bearing neutral cells**, as defined by the canonical Population model.

Therefore neutral Tundra and neutral Shallow Water:

- still require ordinary settlement/capture progress/time;
- use their terrain capture/settlement-speed multiplier;
- have **0 baseline neutral-settlement Population cost** because they are not population-bearing.

Explicit future rules may alter this only through surfaced mechanics.

### Hostile defended capture

Automatic defense may defend an owned conquerable cell even when that cell is not population-bearing.

When a hostile **automatically defended conquerable cell** is successfully captured under ordinary rules:

```text
defender Population casualty = 1
attacker Population casualty = 1
```

regardless of whether the terrain contributes Capacity.

Capacity transfer occurs only when the captured cell is population-bearing.

Thus capturing defended Tundra/Shallow Water can still cost military Population while transferring `0` Capacity.

---

## 1.5 Tundra-specific rules

Tundra is intentionally **low-value rather than actively harmful**.

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

The design goal is that a beginner who conquers Tundra does not accidentally damage their existing economy merely by owning it. The opportunity cost is that the land does not expand demographic Capacity and cannot host infrastructure.

---

## 1.6 Shallow Water and Deep Water

### Shallow Water

Shallow Water exists specifically so maps can represent rivers, fords, coastal shallows, deltas, and similar geography without requiring Transport Ships for every crossing.

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

Shallow Water political ownership allows rivers to become real controllable fronts rather than decorative lines or invisible movement penalties.

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

Large map bodies may still be presented visually/geographically as oceans or seas; the rules-level terrain identity is Deep Water.

Optional water-nuke terrain conversion creates **Deep Water**, not Shallow Water.

---

## 1.7 Fallout is an overlay, not a replacement base terrain

Fallout is a persistent **overlay/state on legal conquerable land**, not a mutually exclusive base terrain replacing Plains/Mountain/etc.

Conceptually:

```text
Plains + Fallout
Mountain + Fallout
Desert + Fallout
Forest + Fallout
Tundra + Fallout
...
```

The underlying base terrain remains available to terrain queries and retains its ordinary:

- population-bearing/Capacity status;
- traversal rules;
- structure-buildability rule unless the specific nuclear/structure mechanic says otherwise;
- source-offense modifier;
- target-defense modifier;
- terrain-share identity where applicable.

The provisional ordinary Fallout acquisition modifier is:

```text
capture / settlement speed × 0.50
```

This multiplier composes with the base terrain's own capture/settlement-speed multiplier.

Examples:

```text
Fallout Plains:   1.10 × 0.50 = 0.55 ordinary acquisition speed
Fallout Mountain: 0.80 × 0.50 = 0.40 ordinary acquisition speed
```

Fallout never creates phantom Population defenders.

The accepted Origin effect that ignores ordinary Fallout capture resistance removes/bypasses the Fallout `×0.50` acquisition penalty while retaining the underlying base terrain modifiers.

The accepted deliberate-relinquishment Fallout trait retains its separate clear-on-next-successful-capture semantics.

Standard nuclear Population casualties remain governed by the canonical nuclear rules; the Fallout overlay itself does not redefine Population accounting.

---

## 1.8 Terrain modifier composition

Unless an explicit typed rule states otherwise, terrain percentages compose through the canonical modifier system rather than hidden special cases.

Examples:

```text
Highland source offense
+ Origin Highland offense
+ Echo Highland offense
→ one surfaced effective Highland offensive-pressure calculation
```

and:

```text
Mountain capture speed
× Fallout capture-speed overlay
× any explicit Origin/Echo progress modifier
→ final surfaced capture/settlement-speed multiplier
```

Terrain data and the faction's effective modifiers must be available through the legal controller observation/rules/mechanics API so a controller is never required to reverse-engineer these values from outcomes.

---

# 2. Persistent structures — current canonical baseline

This section intentionally records **only the already-settled baseline** before the next structure-expansion design pass.

Open Fufu currently has six canonical persistent structures:

| Structure | Legal levels | Built at | Canonical core role | Canonical level progression |
| --- | ---: | ---: | --- | --- |
| **City** | `1–5` | L1 | Population development | Higher level increases explicit Population Growth contribution; never Population Capacity |
| **Fort** | `1–5` | L1 | Territorial defense | Higher level increases Fort coverage area and automatic-defender defensive-pressure effectiveness |
| **Port** | `1–5` | L1 | Naval/trade support | Higher level increases passive naval repair radius and passive repair rate; useful close/docked repair remains |
| **Factory** | `1–5` | L1 | Industry / rail economy | Higher level increases Factory-driven industrial/train FFY-event effectiveness |
| **Missile Silo** | `1–5` | L1 | Strategic offense | Higher level increases launch-charge capacity; L1 Atom, L3 Hydrogen, L5 MIRV |
| **SAM Launcher** | `1–5` | L1 | Strategic defense | Higher level increases ordinary interception range and charge capacity |

Level 5 is a hard maximum for every persistent structure.

The inherited OpenFront `Defense Post` is implementation ancestry for the public Open Fufu **Fort**, not a seventh public structure.

Exact per-level costs, build times, radii, multipliers, health, and other numerical values remain for the upcoming structure-design pass unless already specified by another canonical rule.

---

## 3. Next design work

Before returning to Origin/Echo catalogue expansion:

1. review the six current persistent structures as a **data table**, including build cost, upgrade cost, build time, placement restrictions, level-by-level bonuses, health/durability, cooldown/charge behavior, economic outputs, and special capabilities;
2. decide whether Open Fufu V1 needs additional persistent structure types;
3. canonize the resulting structure table in this same registry;
4. then expand Origin traits and Echo scopes/modifiers to cover the finalized terrain and structure library;
5. finally recompute the exhaustive Echo mechanical catalogue size after the terrain/structure modifier pool is settled.
