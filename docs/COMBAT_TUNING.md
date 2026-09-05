# Open Fufu — Combat Tuning Registry

## Status and authority

This file is the **canonical owner for exact V1 territorial-capture pacing and active counter-response arithmetic/constants**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) owns the higher-level combat architecture: Population commitments, automatic defense, capture casualties, operation semantics, and multi-faction resolution. Terrain-specific acquisition modifiers are owned by [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md). Origin transformations are owned by [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

The values below are accepted provisional V1 balance values and may later be retuned through versioned balance changes.

---

# 1. Territorial capture / settlement pacing

## 1.1 Required progress

```text
requiredCaptureProgress = 1.0
```

Capture/settlement progress is deterministic fixed-point state.

## 1.2 Pressure advantage

For one legal claimant against the current owner/defender:

```text
advantage = (A - D) / (A + D)
```

where:

```text
A = claimant's local effective attack/acquisition pressure
D = current owner's local effective defensive pressure
```

If `A == 0` and `D == 0`, no hostile combat capture progress is generated.

Only positive advantage generates acquisition progress:

```text
ordinaryProgressFromPressurePerSecond
= max(0, advantage)
```

Therefore maximum ordinary pressure-derived progress is exactly:

```text
1.0 progress / second
```

before terrain and other explicit progress modifiers.

## 1.3 Final progress rate

```text
finalCaptureOrSettlementProgressPerSecond
= max(0, advantage)
× targetTerrainCaptureSettlementMultiplier
× other explicit progress modifiers
```

| Effective pressure ratio `A:D` | Advantage | Approx. time from 0 → 1.0 on 1.00× terrain |
| ---: | ---: | ---: |
| `1:1` | `0.0000` | stalled |
| `1.1:1` | `0.0476` | `21.0s` |
| `1.25:1` | `0.1111` | `9.0s` |
| `1.5:1` | `0.2000` | `5.0s` |
| `2:1` | `0.3333` | `3.0s` |
| `3:1` | `0.5000` | `2.0s` |
| `5:1` | `0.6667` | `1.5s` |
| undefended, `A>0` | `1.0000` | `1.0s` |

## 1.4 Neutral settlement

Neutral territory has no automatic Population defender. For otherwise legal neutral acquisition with positive claimant pressure:

```text
D = 0
A > 0
advantage = 1.0
```

Baseline neutral settlement therefore runs at `1.0 progress/s` before terrain and other explicit progress modifiers.

Settlement Population cost is a separate mechanic from acquisition progress.

## 1.5 Partial-progress decay

When a claimant has no positive effective advantage, its stored progress decays toward zero at:

```text
captureProgressDecay = 0.50 progress / second
```

Decay never drives progress below zero. A successful ownership change clears stale pre-capture claimant progress on that cell.

---

# 2. Active counter-response arithmetic

Let:

```text
A = Population currently committed to the incoming attack
R = Population currently committed to the active counter-response
```

Exact provisional V1 constants:

```text
simulation rate = 10 ticks / second
k = 0.005 per simulation tick
p = 2.0
M = 1.5
```

Per simulation tick:

```text
B = 0.005 × min(A, R)

d = (R - A) / (R + A)

s = sign(d) × |d|^2

h = (M - 1) / (M + 1)
  = 0.2

responseMultiplier = 1 + 0.2 × s
attackMultiplier   = 1 - 0.2 × s

attackPopulationLost   = B × responseMultiplier
responsePopulationLost = B × attackMultiplier
```

Casualties resolve simultaneously from the same pre-tick state with deterministic fixed-point/residual accounting and are capped so neither side loses more Population than it has.

At parity (`A == R`), both multipliers equal `1.0`, so each side loses a base `0.5%` of the smaller/equal committed force per tick, approximately `5%` of that scale per second before compounding.

The `p=2` curve keeps efficiency differences small near parity. `M=1.5` bounds the extreme casualty-efficiency ratio.

Explicit Origin/Echo/ruleset transformations act through surfaced combat hooks; their definitions are not duplicated here.

---

# 3. Validation

Implementation validation should benchmark representative early/mid/late force sizes, terrain/structure pressure modifiers, asymmetric counter-responses, multi-front territorial throughput, and legal Origin/Echo compositions.
