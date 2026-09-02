# Open Fufu — Provisional Origin Trait Catalogue

## Status

This file is a **provisional working catalogue**, not a third canonical game-design contract.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical migration/implementation authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

This file exists so Origin traits can be iterated aggressively without bloating the canonical design document with names, values, and content that are explicitly expected to change.

Nothing in this file authorizes gameplay implementation.

Trait names are intentionally left as `X` until the mechanics settle. Temporary IDs (`Pxx` and `Nxx`) exist only so individual candidates can be discussed unambiguously before final anime/JRPG reference names are chosen.

---

## Settled creator direction for this working catalogue

Current builder numbers:

```text
Base Origin Points:       10
Maximum selected traits:   5
Maximum drawback refund:  10
Maximum positive spend:   20
```

The catalogue still follows the accepted Origin-system invariants:

- Official and Custom Origins use the same public trait catalogue and the same builder rules.
- No trait tiers.
- No Major/Minor taxonomy.
- No hidden categories, incompatibility families, pairwise exclusions, or runtime combination vetoes.
- Players select only creator-authored traits; they never supply formulas or arbitrary trait parameters.
- Every combination that satisfies the public budget, trait-count, and drawback-refund rules must be legal in production.
- Candidate catalogues must be exhaustively tested before deployment; broken legal combinations are a catalogue-design failure and must be fixed before shipping.
- Origins should prefer playstyle-changing mechanics, tradeoffs, rule transformations, geography interactions, and hard constraints over ordinary generic `+X% to everything` stat bonuses that are better suited to Echoes.

These numbers and trait effects remain subject to future balance revision unless/until copied into the canonical design contract as final values.

---

## Positive / cost traits — provisional

| ID | Name | Effect | Cost |
| --- | --- | --- | ---: |
| P01 | **X** | `+15% Initial Territory` | 7 |
| P02 | **X** | Replaces the ordinary Population-utilization growth curve with the 30–70% profile | 9 |
| P03 | **X** | `Ignores enemy Fort defensive-pressure bonuses` | 7 |
| P04 | **X** | `Response-side counter-response effectiveness is fixed at 100% (1.0), ignoring the normal force-imbalance bonus/penalty curve` | 3 |
| P05 | **X** | `Capturing enemy structures generates military/conquest FFY events` | 8 |
| P06 | **X** | `+25% Trade Ship speed` | 5 |
| P07 | **X** | `+25% amount of trains spawned` | 4 |
| P08 | **X** | Ordinary wartime trade multiplier becomes `1.0` instead of `0.5` | 4 |
| P09 | **X** | `+10% Fort coverage area, +9% Fort defensive pressure, -8% Fort cost` | 5 |
| P10 | **X** | `+100% warhead projectile speed` | 4 |
| P11 | **X** | `SAM Launchers cost 0 FFY to build/upgrade; each 25,000 peak Total Population reached unlocks one SAM Launcher slot` | 8 |
| P12 | **X** | `Transport Ships are 25% faster` | 6 |
| P13 | **X** | `Mountains offer 33% increased defensive pressure` | 4 |
| P14 | **X** | `FFY events located on Desert yield +33% FFY` | 4 |
| P15 | **X** | `33% increased offensive pressure on Highlands` | 4 |
| P16 | **X** | `Ignores ordinary Fallout capture resistance` | 4 |
| P17 | **X** | `Structure upgrade FFY cost × 0.99 per owned structure` | 7 |
| P18 | **X** | `+100% offensive pressure for engagement lanes whose attacking source cell lies inside a self/fixed-teammate Fort area` | 5 |
| P19 | **X** | `+5% offensive pressure per distinct other faction with which you currently have at least one Territorial Contact` | 7 |
| P20 | **X** | `Start the game with a free Missile Silo` | 7 |
| P21 | **X** | `First purchase of each structure consumes 0 FFY`* | 7 |
| P22 | **X** | `+2 to maximum Warship rank` | 6 |
| P23 | **X** | `Warships +20% range, +20% damage, +20% speed, but you may only own one` | 8 |
| P24 | **X** | `FFY events located inside Fort areas yield +20% FFY` | 7 |
| P25 | **X** | `Cannot use Atom Bomb or MIRV; Hydrogen Bomb blast area +50% and FFY cost +50%` | 10 |
| P26 | **X** | `You may use MIRV at most once; that MIRV requires ordinary affordability but consumes 0 FFY` | 8 |
| P27 | **X** | `SAM Launchers may attack ships` | 9 |
| P28 | **X** | `Destroying Transport Ships steals their Population` | 9 |
| P29 | **X** | `Warships may serve as Missile Silo launch platforms from their current cell` | 9 |

### Positive-trait notes

* P21: the player must still hold at least the ordinary required amount of FFY to satisfy the purchase affordability/legality gate. The successful first **purchase** of each structure consumes `0 FFY`. Starting structures, captured structures, or otherwise granted structures do not consume the first-purchase entitlement because they were not purchased.

---

## Negative / refund traits — provisional

| ID | Name | Effect | Refund |
| --- | --- | --- | ---: |
| N01 | **X** | `Cities contribute 20% less Population Growth` | -4 |
| N02 | **X** | `25% reduced Plains offensive pressure` | -4 |
| N03 | **X** | `33% reduced Desert defensive pressure` | -4 |
| N04 | **X** | `FFY events located on Mountain yield 50% less FFY` | -4 |
| N05 | **X** | `Cannot capture Fallout terrain` | -5 |
| N06 | **X** | `Cannot spend FFY to upgrade buildings` | -5 |
| N07 | **X** | `Cannot own more than 1 of each building` | -10 |
| N08 | **X** | `Forts provide no defensive-pressure bonus` | -4 |
| N09 | **X** | `Cannot build Factories` | -6 |
| N10 | **X** | `25% reduced Fort coverage area` | -4 |
| N11 | **X** | `FFY events located inside SAM Launcher area yield 0 FFY` | -7 |
| N12 | **X** | `Cannot build Warships` | -6 |
| N13 | **X** | `50% of Transport Ship Population dies when landing` | -7 |
| N14 | **X** | `Lose (1% of)/X FFY when a Trade Ship gets captured`* | -4 |
| N15 | **X** | `Transport Ships cost 500 FFY` | -5 |

### Negative-trait notes

* N14: exact value/formula TBD.

---

## Settled semantic decisions from catalogue review

### S1 — Fallout terminology

Open Fufu's nuclear model does **not** treat Fallout as phantom defensive Population/pressure. Fallout remains conquerable population-bearing land with explicit capture resistance/speed effects.

Therefore P16 is defined in terms of ignoring ordinary **Fallout capture resistance**, and N05 is defined as a hard inability to capture Fallout terrain.

### S2 — Desert is a V1 terrain

Open Fufu V1 will include **Desert** as a real terrain type/map input. The inherited OpenFront enum does not contain it yet, so P14/N03 are implementation-blocked until the V1 terrain pipeline is extended, but they are not speculative future-only traits.

Exact baseline Desert mechanics/values remain separate tuning work.

### S3 — enemy-structure capture FFY baseline

Ordinary enemy-structure capture does **not** inherently award FFY merely because the structure changed hands.

P05 creates the alternate Origin rule: capturing an enemy structure generates a military/conquest FFY event. Exact payout remains tuning data.

### S4 — P17 uses safe multiplicative compounding

P17 does not subtract one additive percentage point forever. If `S` is the number of currently owned structures, the applicable structure-upgrade cost multiplier is:

```text
0.99^S
```

Equivalently, each owned structure multiplies the current upgrade FFY cost by `0.99`.

This naturally diminishes without ever requiring a hidden zero/negative-cost clamp.

### S5 — P18 is source-cell Fort support

P18 applies to an engagement lane when its **attacking source cell** lies inside at least one Fort area belonging to the faction or a fixed teammate.

Overlapping qualifying Forts do not multiply the P18 bonus; Fort coverage is an eligibility condition for the lane.

### S6 — P19 counts distinct factions

P19 counts distinct other factions with which the faction currently has at least one Territorial Contact. Multiple disconnected Contact components with the same faction count only once.

Unless later revised, "other faction" is literal and may include a fixed teammate as well as an opponent.

### S7 — P25 modifies literal blast area

P25's `+50%` refers to **affected Hydrogen Bomb blast area**, not `radius × 1.5`. The implementation derives the appropriate versioned blast geometry/radius needed to produce the intended area increase.

### S8 — P11 uses peak Total Population as a permanent unlock track

P11's SAM entitlement is monotonic within the match:

> Each full `25,000` of **peak Total Population reached during the match** unlocks one SAM Launcher ownership/build slot.

Population falling later does not remove an unlocked slot and does not destroy an existing SAM. Starting Population contributes immediately to the initial peak.

P11 is deliberately **genuinely free** rather than purchase-discounted: if a SAM slot is unlocked and all non-FFY build legality conditions are satisfied, build/upgrade cost is `0 FFY` and the faction does not need to possess the ordinary SAM price first.

Exact `25,000` value remains balanceable catalogue data.

### S9 — P04 fixes only response-side effectiveness

The ordinary counter-response system may increase or reduce response-side effectiveness according to force imbalance. Under P04, the **response-side effectiveness multiplier is always exactly `1.0`** instead.

This intentionally removes both the normal response-side bonus when overmatching and the normal response-side penalty when understrength. It is therefore partly a boon and partly a drawback, which is why its provisional cost is only `3`.

The attack-side effectiveness calculation remains ordinary unless another explicit rule changes it.

### S10 — free/granted/purchase semantics

The currently accepted catalogue semantics are intentionally different for the four relevant traits:

- **P20 — starting Missile Silo:** the starting Silo is genuinely free. No ordinary affordability check applies. It is a granted starting structure, not a purchase, and therefore does **not** consume P21's first-Missile-Silo purchase entitlement.
- **P21 — first purchase of each structure:** the faction must first be able to afford the structure under ordinary purchase rules; if the purchase is otherwise legal, the first purchased instance of that structure type consumes `0 FFY`. Only purchases consume the entitlement.
- **P26 — one MIRV:** the faction must hold enough FFY to satisfy ordinary MIRV affordability/legality, but the one permitted MIRV consumes `0 FFY`. The faction may use MIRV at most once during the match under this trait.
- **P11 — SAM Launchers:** genuinely `0 FFY` with no ordinary affordability requirement, because the separate peak-Population unlock track is the controlling limiter.

These are intentional mechanical distinctions and should be surfaced plainly in the player-facing descriptions/tooltips rather than collapsed into one generic "free" modifier.

### S11 — common spatial FFY-event model

An FFY-generating event may carry an optional **location cell** when the event has a meaningful world-space origin/destination.

Spatial Origin/Echo/ruleset modifiers inspect that event location. Events with no meaningful location simply do not receive terrain/area-based FFY modifiers.

Current intended examples:

- enemy-structure capture FFY uses the captured structure's cell;
- train-arrival FFY uses the cell at which the rewarding arrival/stop occurs;
- Trade Ship arrival FFY uses the receiving Port's cell;
- other spatial event types define one explicit versioned location rule when introduced;
- global/non-spatial rewards have no location.

For one given trait/effect, overlapping multiple qualifying Fort or SAM areas do **not** multiply the modifier: the event either qualifies for that effect or it does not. Distinct independent modifiers may still combine through the ordinary published modifier-composition rules when the same event location qualifies for several of them—for example, an event on Desert that is also inside a qualifying Fort area.

This is one shared economy/event concept, not bespoke spatial-economy code per trait.

### S12 — P29 makes Warships nuclear launch platforms

P29 makes each owned Warship a valid **nuclear launch platform** for strategic weapons the faction is otherwise legally allowed to purchase/use.

A launch from a Warship:

- originates from the Warship's **current cell**;
- uses ordinary weapon cost/affordability rules unless another explicit trait changes them;
- obeys ordinary weapon-family restrictions, so P29 never restores a weapon prohibited by another trait/ruleset;
- uses the ordinary Missile-Silo-style per-launch cooldown/reload semantics independently for that Warship;
- does not transform the Warship into a building for structure counts, structure limits, Fort effects, purchase entitlements, or other unrelated rules.

P29 therefore enables mobile/surprise nuclear launch positioning without making nuclear weapons free.

Provisional cost: `9`.

---

## Remaining mechanical review notes

### R1 — intentionally poor combinations remain legal

Because the Origin system has no compatibility matrix, combinations such as:

- `+2 maximum Warship rank` + `Cannot build Warships`;
- `+25% trains spawned` + `Cannot build Factories`;
- upgrade-cost scaling + `Cannot spend FFY to upgrade buildings`;
- MIRV-only bonuses + an Origin trait that prohibits MIRVs;
- Warships-as-Missile-Silos + `Cannot build Warships`;

remain structurally legal unless the catalogue itself is redesigned.

These combinations may be strategically foolish or partly inert; that is different from being engine-invalid. The exhaustive deployment test must prove they remain deterministic and mechanically safe rather than forbidding them in production.

### R2 — custom/nonstandard lobby rules may invalidate balance, not legality

Some traits depend strongly on systems such as nukes, SAMs, naval play, or factories. A custom lobby that disables one of those mechanics can make a drawback irrelevant or a positive trait useless.

The Origin catalogue should be balanced primarily against the canonical supported ruleset(s). Nonstandard custom rules may deliberately produce unusual balance. Avoid introducing hidden Origin incompatibility restrictions merely to make every exotic custom lobby equally balanced.

---

## Upstream feasibility notes

These notes are implementation evidence only and do not make inherited mechanics authoritative for Open Fufu.

### Fort areas

Current attack resolution already asks whether a defender-owned Defense Post is within `defensePostRange()` of an attacked tile using `hasUnitNearby(...)`. The current configuration exposes explicit Defense Post range/bonus values.

This means Origin mechanics based on "inside Fort area" are technically natural to support; Open Fufu will translate the meaning of the Fort bonus, but it does not need to invent spatial Fort membership from nothing.

### SAM areas

Current SAM logic already has explicit launcher position, level-dependent/dynamic range calculations, and distance checks for interception. It does not stamp a persistent SAM-area field onto the map.

Spatial checks such as "event occurs inside a SAM area" are therefore feasible but should be implemented as explicit range/nearby-structure queries rather than a new dense per-cell state field.

### SAM attacks against ships

Warship naval targeting already searches nearby Transport Ships, Warships, and Trade Ships by range/priority and fires `ShellExecution` at eligible targets. The useful target-selection/gunnery behavior is currently embedded inside `WarshipExecution` alongside unrelated movement, patrol, healing, retreat, veterancy, and port logic.

For P27, prefer extracting/reusing the relevant **naval target-selection + gunnery behavior** and invoking it from the fixed SAM Launcher tile when the trait is active. Do **not** literally spawn a hidden Warship unit: doing so would unnecessarily entangle Warship ownership limits, stats, veterancy, rendering/visibility, targeting, destruction, and other Unit semantics.

The conceptual model may still be thought of as an immobile Warship-like anti-ship battery inside the SAM; the implementation should share the behavior rather than create a fake unit.

### Warships as Missile Silos

Current `NukeExecution` already accepts an explicit launch-source cell, and ordinary Missile Silo behavior is largely launch-source eligibility plus per-launch cooldown/reload state. Nuclear projectiles themselves are spawned separately and travel from their source to the target.

P29 should therefore be implemented by making an eligible Warship an alternate launcher/source and sharing the silo-style cooldown semantics on that Warship. Do not create a hidden Missile Silo building attached to the ship; that would unnecessarily contaminate structure ownership/count/build semantics.

The launch command/controller legality surface should identify the chosen eligible launcher when more than one Silo/Warship source exists, rather than relying on an opaque engine choice that would undermine the trait's positioning value.

### Transport Population theft

Transport Ships already carry explicit troop/Population payload state and destruction knows both destroyer and payload. P28 therefore has a strong existing implementation seam: Open Fufu can translate destruction from "payload dies" to "eligible destroyer receives payload" without inventing transport payload accounting from scratch.

---

## Next catalogue work

Before creating Official Origins or anime-reference trait names:

1. continue reviewing candidates for effects that still feel too Echo-like, redundant, excessively map-dependent, or unintentionally dominant;
2. resolve remaining unclear individual wording/value questions such as N14's Trade Ship-loss FFY penalty;
3. polish wording as individual mechanics stabilize;
4. then assign anime/JRPG reference names only after each effect is stable enough that the reference can match the mechanic;
5. only after that build the first Official Origins from this same pool;
6. before deployment, exhaustively enumerate every builder-legal combination under the final candidate catalogue and builder rules.
