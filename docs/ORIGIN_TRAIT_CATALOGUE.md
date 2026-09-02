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
| P02 | **X** | Replaces the ordinary utilization-growth curve with the 30–70% profile | 9 |
| P03 | **X** | `Ignores enemy Fort defensive-pressure bonuses` | 7 |
| P04 | **X** | `+15% counter-response effectiveness when responding` | 4 |
| P05 | **X** | `Captured enemy structures produce FFY events` | 8 |
| P06 | **X** | `+25% Trade Ship speed` | 5 |
| P07 | **X** | `+25% amount of trains spawned` | 4 |
| P08 | **X** | Ordinary wartime trade multiplier becomes `1.0` instead of `0.5` | 4 |
| P09 | **X** | `+10% Fort area, +9% Fort defensive pressure, -8% Fort cost` | 5 |
| P10 | **X** | `+100% warhead projectile speed` | 4 |
| P11 | **X** | `SAM Launcher free to build/upgrade, but you may only build 1 per 25k Population` | 8 |
| P12 | **X** | `Transport Ships are 25% faster` | 6 |
| P13 | **X** | `Mountains offer 33% increased defensive pressure` | 4 |
| P14 | **X** | `Desert offers 33% increased FFY events` | 4 |
| P15 | **X** | `33% increased offensive pressure on Highlands` | 4 |
| P16 | **X** | `Ignores nuclear-waste defensive pressure` | 4 |
| P17 | **X** | `-1% upgrade costs per owned structure` | 7 |
| P18 | **X** | `+100% offensive pressure inside allied Fort area` | 5 |
| P19 | **X** | `+5% offensive pressure per Contact with another faction` | 7 |
| P20 | **X** | `Start the game with a Missile Silo` | 7 |
| P21 | **X** | `First of each structure does not consume FFY`* | 7 |
| P22 | **X** | `+2 to maximum Warship rank` | 6 |
| P23 | **X** | `Warships +20% range, +20% damage, +20% speed, but you may only own one` | 8 |
| P24 | **X** | `+20% to FFY events inside Fort areas`** | 7 |
| P25 | **X** | `Cannot use Atom Bomb or MIRV; +50% area and cost of Hydrogen Bomb` | 10 |
| P26 | **X** | `MIRV consumes 0 FFY but may only be used once` | 8 |
| P27 | **X** | `SAM Battery may attack ships` | 9 |
| P28 | **X** | `Destroying Transport Ships steals their Population` | 9 |

### Positive-trait notes

* P21: the player must still reach the ordinary required amount of FFY to satisfy the affordability/legality gate; the successful first build does not consume that FFY. This prevents constructing everything at `0 FFY` while preserving the intended free-first-build identity.

** P24: retained provisionally because Fort-area membership appears mechanically practical; exact definition of which FFY events have a spatial location and whether allied/team Forts count remains to be settled.

---

## Negative / refund traits — provisional

| ID | Name | Effect | Refund |
| --- | --- | --- | ---: |
| N01 | **X** | `Cities offer -20% Population Growth` | -4 |
| N02 | **X** | `25% reduced Plains offensive pressure` | -4 |
| N03 | **X** | `33% reduced Desert defensive pressure` | -4 |
| N04 | **X** | `50% reduced effect of FFY events on Mountain` | -4 |
| N05 | **X** | `Cannot capture nuclear-waste terrain` | -5 |
| N06 | **X** | `Cannot spend FFY to upgrade buildings` | -5 |
| N07 | **X** | `Cannot own more than 1 of each building` | -10 |
| N08 | **X** | `Forts provide no defensive-pressure bonus` | -4 |
| N09 | **X** | `Cannot build Factories` | -6 |
| N10 | **X** | `25% reduced Fort area` | -4 |
| N11 | **X** | `0 FFY gained from events inside SAM Launcher area`** | -7 |
| N12 | **X** | `Cannot build Warships` | -6 |
| N13 | **X** | `50% of Transport Ship Population dies when landing` | -7 |
| N14 | **X** | `Lose (1% of)/X FFY when a Trade Ship gets captured`*** | -4 |
| N15 | **X** | `Transport Ships cost 500 FFY` | -5 |

### Negative-trait notes

** N11: retained provisionally because SAM range geometry already exists upstream; exact definition of spatial FFY-event membership in a SAM area remains to be settled.

*** N14: exact value/formula TBD.

---

## Mechanical review notes / unresolved wording

These are review notes, not silent changes to the candidate effects above.

### R1 — Fallout / "nuclear waste" wording

Open Fufu's settled nuclear model does **not** treat fallout as phantom defensive Population/pressure. Fallout is neutral/conquerable population-bearing land with explicit capture resistance/speed effects.

Therefore P16 should eventually be rewritten mechanically as something like:

> `Ignores ordinary Fallout capture resistance`

rather than `Ignores nuclear-waste defensive pressure`.

N05 remains mechanically coherent as a hard inability to capture Fallout terrain.

### R2 — Desert does not exist in the inherited terrain enum yet

Current inherited OpenFront terrain concepts are Plains, Highland, Mountain, Ocean, and Impassable. Desert-dependent P14/N03 therefore require Open Fufu to deliberately introduce Desert as a real terrain type/map input before those traits can ship.

Keep them in the candidate catalogue, but mark them blocked on the terrain decision rather than pretending Desert already exists.

### R3 — Structure-capture FFY baseline must be clarified

P05 only creates a distinct Origin identity if capturing enemy structures is **not already a universal baseline FFY payout** of the same kind.

The canonical FFY section currently lists hostile structure capture among possible explicit FFY events. Before P05 ships, decide whether:

- baseline structure capture gives no FFY and P05 enables it; or
- baseline capture gives one reward and P05 adds a distinct additional reward.

Do not leave this ambiguous.

### R4 — P17 must not become an unbounded negative cost

A literal additive `-1 percentage point per owned structure` eventually reaches zero/negative upgrade cost with enough structures.

Prefer a mathematically safe explicit formulation such as multiplicative compounding (`upgrade cost × 0.99` per owned structure) or another published bounded formula. Do not rely on a hidden runtime clamp.

### R5 — P18 needs a precise lane-side definition

For `+100% offensive pressure inside allied Fort area`, define whether Fort coverage is checked on the attacking source cell or target cell.

Current recommendation for later discussion: apply the bonus to an engagement lane when its **attacking source cell** lies inside a Fort area belonging to the faction or fixed teammate. This reads naturally as a supported sortie and avoids projecting the effect deep into enemy land merely because a Fort radius overlaps the target.

### R6 — P19 must count distinct factions, not Contact components

If `+5% offensive pressure per Contact` counts disconnected TerritorialContact components, a player could potentially manufacture fragmented borders to stack the trait.

Safer intended interpretation:

> `+5% offensive pressure per distinct other faction with which the faction currently has at least one Territorial Contact.`

Exact inclusion of fixed teammates versus only hostile/non-team factions remains to be decided.

### R7 — P25 "area" should mean area, not radius

If Hydrogen Bomb blast **radius** is increased by 50%, affected geometric area rises by roughly 125% before map/topology effects.

If the intended effect is literally `+50% blast area`, the implementation should derive the corresponding radius/geometry rather than blindly multiplying radius by `1.5`.

### R8 — P11 SAM cap semantics need one explicit rule

`1 SAM per 25k Population` needs a definition for Population changing after construction.

Recommended later direction: cap new construction from current rule-bearing Population at build time; already-existing legal SAMs are not automatically destroyed when Population subsequently falls, but no additional SAM can be built while over the current cap.

Exact use of current Total Population versus Capacity remains open.

### R9 — "free" trait interactions should be explicit, not accidental

P20/P21/P11/P26 can interact with starting structures and free-build entitlements. Examples:

- Does starting with a Missile Silo consume the "first Silo" entitlement from P21?
- Does P11's free SAM construction still require ordinary affordability before consuming zero FFY, or is it truly zero-cost at any FFY balance?
- Does P26 require ever possessing the normal MIRV cost, or is the one MIRV genuinely free?

These are catalogue semantics and should be explicit before the trait set is considered deployable.

### R10 — intentionally poor combinations remain legal

Because the Origin system has no compatibility matrix, combinations such as:

- `+2 maximum Warship rank` + `Cannot build Warships`;
- `+25% trains spawned` + `Cannot build Factories`;
- upgrade-cost scaling + `Cannot spend FFY to upgrade buildings`;
- MIRV-only bonuses + an Origin trait that prohibits MIRVs;

remain structurally legal unless the catalogue itself is redesigned.

These combinations may be strategically foolish or partly inert; that is different from being engine-invalid. The exhaustive deployment test must prove they remain deterministic and mechanically safe rather than forbidding them in production.

### R11 — custom/nonstandard lobby rules may invalidate balance, not legality

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

Current `SAMMissileExecution` explicitly whitelists nuclear targets and flies toward a precomputed interception tile. Letting SAMs attack moving ships is therefore **not** a one-line whitelist change: targeting/lead/interception behavior for moving naval units must be designed. The underlying missile/unit/pathing infrastructure is reusable, but P27 should be treated as a real translated mechanic rather than assumed-free implementation.

### Transport Population theft

Transport Ships already carry explicit troop/Population payload state and destruction knows both destroyer and payload. P28 therefore has a strong existing implementation seam: Open Fufu can translate destruction from "payload dies" to "eligible destroyer receives payload" without inventing transport payload accounting from scratch.

---

## Next catalogue work

Before creating Official Origins or anime-reference trait names:

1. review the candidate traits for desired semantics and remove/rewrite any that do not feel Origin-worthy;
2. settle the R1–R9 wording/mechanical ambiguities above;
3. decide whether Desert becomes an Open Fufu terrain type;
4. decide the baseline structure-capture FFY behavior needed by P05;
5. then assign final reference names only after the effects are stable enough that the reference can match the mechanic;
6. only after that build the first Official Origins from this same pool;
7. before deployment, exhaustively enumerate every builder-legal combination under the final candidate catalogue and builder rules.
