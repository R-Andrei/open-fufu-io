# Open Fufu — Provisional Combat Tuning Appendix

## Status and authority

This file is the **canonical detailed numeric appendix for accepted provisional V1 territorial-capture pacing and active counter-response tuning**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for the underlying combat architecture, Population model, offensive operations, automatic defense, capture-coupled casualties, multi-faction resolution, and counter-response semantics. This appendix does **not** introduce a competing combat system; it pins the exact provisional constants for formulas already defined there.

[`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) remains authoritative for terrain-specific capture/settlement multipliers and structure/unit data. Origin/Echo effects compose through their existing surfaced modifier hooks.

Nothing in this file authorizes gameplay implementation.

All values are provisional V1 balance values and may later be retuned through implementation-stage accelerated simulation and playtesting without reopening the underlying mechanics.

---

# 1. Territorial capture / settlement pacing

## 1.1 Required progress

A political ownership change requires:

```text
requiredCaptureProgress = 1.0
```

Capture/settlement progress is deterministic fixed-point state. A cell still changes political owner at most once per simulation tick and newly captured cells do not open same-tick chain conquest, as defined in the main design.

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

The accepted provisional V1 base coefficient is therefore exactly:

```text
maximum ordinary pressure-derived progress
= 1.0 progress / second
```

before terrain and other explicit capture/settlement-progress modifiers.

## 1.3 Final progress rate

The ordinary final claimant progress rate is conceptually:

```text
finalCaptureOrSettlementProgressPerSecond
= max(0, advantage)
× targetTerrainCaptureSettlementMultiplier
× other explicit progress modifiers
```

Same-axis ordinary percentage modifiers compose through the canonical surfaced modifier-stacking rules. Structural rules such as Fallout resistance, P16, N18, or another explicit profile transformation use their authored hooks rather than being silently folded into pressure.

Examples on otherwise unmodified `1.00×` terrain:

| Effective pressure ratio `A:D` | Advantage | Approx. time from 0 → 1.0 |
| ---: | ---: | ---: |
| `1:1` | `0.0000` | stalled |
| `1.1:1` | `0.0476` | `21.0s` |
| `1.25:1` | `0.1111` | `9.0s` |
| `1.5:1` | `0.2000` | `5.0s` |
| `2:1` | `0.3333` | `3.0s` |
| `3:1` | `0.5000` | `2.0s` |
| `5:1` | `0.6667` | `1.5s` |
| undefended, `A>0` | `1.0000` | `1.0s` |

The table is explanatory, not a second set of constants.

## 1.4 Neutral settlement uses the same pace equation

Neutral territory has no automatic Population defender. For an otherwise legal neutral acquisition with positive claimant pressure:

```text
D = 0
A > 0
advantage = 1.0
```

Therefore baseline neutral settlement runs at the same maximum ordinary `1.0 progress/s` before target-terrain/Fallout/Origin/Echo progress modifiers.

There is no separate hidden neutral-settlement speed constant. Neutral population-bearing cells still consume the canonical ordinary `1 Population/cell` settlement cost on successful acquisition unless an explicit rule such as P36 changes that cost.

Examples at maximum ordinary neutral pressure using current terrain multipliers:

```text
Plains 1.10×  → ~0.91s
Highland 1.00× → 1.00s
Mountain 0.80× → 1.25s
Marsh 0.70×    → ~1.43s
```

Ordinary Fallout applies its existing `0.50×` acquisition-progress effect on top of the underlying terrain unless an explicit rule such as P16 ignores that Fallout penalty.

## 1.5 Partial-progress decay

Partially accumulated claimant progress does not persist forever after pressure disappears.

When a claimant has **no positive effective advantage** on that cell—including no longer actively pressing it—its stored progress decays toward zero at:

```text
captureProgressDecay = 0.50 progress / second
```

Decay never drives progress below zero.

Examples:

```text
0.80 stored progress
→ 1.60s with no positive advantage to decay to 0

0.25 stored progress
→ 0.50s to decay to 0
```

This prevents intermittent microscopic attacks from banking capture progress indefinitely while still allowing a brief disruption to preserve some momentum.

A successful ownership change clears stale pre-capture claimant progress on that cell. Existing multi-faction simultaneous-resolution/tie-breaking rules from `OPEN_FUFU_DESIGN.md` remain authoritative; this appendix changes only the rate/decay constants.

---

# 2. Active counter-response tuning

The main design defines counter-response Population as a separate targeted operation-vs-operation exchange against one incoming hostile offensive operation. It does not reinforce the binary automatic defender on territorial cells.

Let:

```text
A = Population currently committed to the incoming attack
R = Population currently committed to the active counter-response
```

Counter-response exchange uses the accepted main-design formulas with the following exact provisional V1 constants:

```text
simulation rate = 10 ticks / second
k = 0.005 per simulation tick
p = 2.0
M = 1.5
```

Therefore:

```text
B = 0.005 × min(A, R)

d = (R - A) / (R + A)

s = sign(d) × |d|^2

h = (M - 1) / (M + 1)
  = (1.5 - 1) / (1.5 + 1)
  = 0.2

responseMultiplier = 1 + 0.2 × s
attackMultiplier   = 1 - 0.2 × s

attackPopulationLost   = B × responseMultiplier
responsePopulationLost = B × attackMultiplier
```

Casualties resolve simultaneously from the same pre-tick state with deterministic fixed-point/residual accounting and are capped so neither side loses more Population than it has.

At exact parity (`A == R`):

```text
d = 0
s = 0
both multipliers = 1.0
```

so each side loses a base `0.5%` of the smaller/equal committed force per simulation tick, approximately `5%` of that scale per second before compounding.

The `p=2` curve intentionally makes efficiency differences small near parity; the primary benefit of numerical superiority is having more Population committed, not receiving an additional enormous hidden quality multiplier. `M=1.5` caps the extreme advantaged/disadvantaged casualty-efficiency ratio while preserving the main design's relative-force behavior across early and late game scales.

P04 and future explicit side-specific mechanics continue to use the separate attack-side/response-side effectiveness hooks defined in the main design. P04 fixing response-side effectiveness at `1.0` does not erase the ordinary attack-side calculation or the base `B = k × min(A,R)` exchange volume.

---

# 3. Validation status

These values are **design-closed provisionally** and no longer block implementation architecture.

Post-implementation / pre-V1 validation should benchmark representative early/mid/late force sizes, terrain and structure pressure modifiers, asymmetric counter-responses, multi-front territorial throughput, and Origin/Echo combinations. Retuning a numeric coefficient after those benchmarks is ordinary balance work rather than a redesign of capture or counter-response semantics.
