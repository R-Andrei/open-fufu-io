# Open Fufu — Authoritative Faction Strength Score

## Status and authority

This file is the **canonical owner for the V1 Major-Faction combined strength score**: its component definitions, normalization, diminishing-return composition, score-specific lifetime-economy accounting boundary, Current-Power replacement-capital composition, lifecycle semantics, deterministic numeric result, and combined-score visibility contract.

Neighboring concerns remain owned elsewhere:

- base terrain ownability, persistent-structure mechanics/cost truth, and baseline Tank mechanics/cost truth: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- starting FFY, passive FFY, ordinary positive FFY classification/finalization, signed consequences, Factory Trains, Trade Ships, and piracy economics: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Warship, Transport, and strategic-weapon mechanics/cost truth: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Origin transformations, including transformed Tank-derived chassis: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- Minor-Faction/Goon mechanics and actor class: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md);
- game-wide public-information and faction-lifecycle invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- public controller TypeScript shape: [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts);
- authoritative persistence, replay architecture, and version binding: [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

This document consumes those owners as inputs. It does not duplicate their price tables, FFY source formulas, terrain table, Origin rules, naval mechanics, API structure, or versioning architecture.

---

# 1. Scope and public contract

V1 defines this score for **Major Factions only**.

A Major Faction exposes one combined non-negative integer strength score. The combined score is intentionally globally public strategic information and is not hidden by tactical visibility.

Only the combined result becomes public by virtue of this mechanic. The score does **not** independently expose:

- current FFY;
- lifetime FFY earned;
- owned-cell counts;
- structure or unit counts/types/levels;
- replacement-capital totals;
- strategic-weapon state;
- the raw Territory, Economy, or Current-Power values;
- normalized component ratios;
- per-component score contributions.

Any such fact is public only when another canonical owner independently makes it public. The controller API owner may project the trusted combined score, but it must not reimplement the formula or expose private component detail merely to provide that field.

Minor Factions/Goons have **no authoritative V1 score under this formula**. That is distinct from a score of zero. A future Minor-specific score requires its own explicit contract. Team-level score is also out of scope.

The score is a coarse strategic indicator. It is not a victory condition, matchmaking/tournament rating, persistent account progression value, or player-relative visibility variant.

---

# 2. Canonical formula

For one coherent authoritative Major-Faction snapshot, define:

- `O` = currently owned cells whose base terrain is ownable/conquerable under `TERRAIN_AND_STRUCTURES.md`;
- `M` = total cells on the bound map whose base terrain is ownable/conquerable under that same owner;
- `N` = fixed starting Major-Faction count for the match;
- `t` = authoritative simulation tick of the snapshot;
- `G` = authoritative lifetime gross positive FFY earned under §4;
- `F` = current authoritative FFY balance;
- `S` = eligible persistent-structure replacement capital under §5;
- `U` = eligible military replacement capital under §5;
- `C = F + S + U` = Current Power;
- `A` = the bound ruleset's canonical starting-FFY value from `FFY_ECONOMY.md`, used here as a normalization anchor;
- `b` = the bound ruleset's unmodified baseline passive FFY earned per authoritative simulation tick from `FFY_ECONOMY.md`.

Define the common economic reference:

```text
R(t) = A + b*t
```

Then the normalized component ratios are:

```text
T = O*N / M
E = (A + G) / R(t)
P = C / R(t)
```

The authoritative combined score is:

```text
score = floor(
    300 * sqrt(T)
  + 250 * sqrt(E)
  + 450 * sqrt(P)
)
```

The coefficients encode the approved **30% Territory / 25% Economy / 45% Current Power** reference weighting. Each normalized component receives its square-root diminishing-return transform independently before composition.

`A` in the Economy numerator is only the symmetric normalization anchor. Starting FFY is **not** added to `G` and is not classified as earned economy.

When `T = E = P = 1`, the score is exactly `1000`. `1000` is a nominal reference value, not a cap or maximum. Component ratios and the combined score are not artificially capped.

No component is independently rounded. There is exactly one final floor after the three unrounded transformed contributions are summed.

A scorable state requires `M > 0` and `N > 0`. An invalid state that lacks a positive ownable-map denominator or starting-Major count is rejected; it does not use an alternate score formula.

---

# 3. Territory

Territory measures current Major-Faction ownership relative to an equal starting-Major share of the bound map's base-ownable cells.

`M` is fixed by the bound map's base terrain classification. `N` is fixed by the starting Major-Faction roster. Neither denominator changes because of:

- later capitulation or defeat;
- current active-faction count;
- team membership;
- Minor Factions/Goons;
- Fallout overlays;
- Population Capacity;
- effective population-bearing/buildability transformations.

The exact base-terrain ownability classification remains owned by `TERRAIN_AND_STRUCTURES.md`; this document consumes its `conquerable`/ownable result rather than maintaining a second terrain list.

Score reads must not require an avoidable complete map scan per faction/read. Implementations may maintain or cache derived territory aggregates, but such acceleration is non-authoritative and must preserve the exact result for the immutable authoritative snapshot.

---

# 4. Economy — lifetime gross positive FFY

Each Major Faction has authoritative lifetime gross-positive earned FFY, `G`, initialized to `0`.

`G` increments only by the exact finalized whole-FFY award of an event/source that the FFY owner classifies as an **ordinary positive FFY award**. The increment occurs after all applicable structural/rule transformations and after the ordinary positive award's canonical whole-FFY finalization.

Therefore `G` follows the FFY owner's classification rather than inferring economy from balance changes. In particular, it excludes:

- starting FFY;
- purchases, costs, and other spending/debits;
- discounts or free purchases;
- refunds merely because they increase balance;
- explicit signed FFY facts/transactions, even when their finalized net delta is positive;
- reconstruction from current balance or transaction history.

Any future FFY source contributes to `G` only when its canonical owner explicitly classifies the finalized credit as an ordinary positive FFY award.

`G` is authoritative persisted/replay state and remains preserved after a faction capitulates or is defeated. Terminal status changes the live strength score under §6; it does not erase historical economic accounting.

---

# 5. Current Power — liquid FFY plus replacement capital

Current Power is:

```text
C = F + S + U
```

Replacement capital uses the **ordinary baseline replacement value of the current or already-committed physical state**, not the historical amount the current owner happened to pay. Purchase discounts, free/granted acquisition, capture history, and faction-specific purchase modifiers do not reduce replacement value for two physically equivalent states.

## 5.1 Persistent structures

`S` includes each owned persistent structure at cumulative ordinary baseline replacement cost through its score valuation target level:

- a completed structure uses its current completed level;
- paid construction or an upgrade in progress uses its committed target level.

This prevents paid FFY from disappearing from Current Power merely because liquid currency has already been converted into committed construction. Exact structure costs and construction/capture lifecycle remain owned by `TERRAIN_AND_STRUCTURES.md`.

## 5.2 Tank-derived chassis

`U` includes current Tank-derived military capital exactly once across deployed chassis and fully paid production jobs that have not yet materialized as deployed units.

Tank portfolios use the ordinary baseline sequential Tank replacement-cost curve owned by `TERRAIN_AND_STRUCTURES.md`. A transformed Heavy-Artillery chassis uses the canonical transformation defined by `ORIGIN_TRAIT_CATALOGUE.md`; this document does not redefine that transformation or its underlying purchase mechanics.

A production job becoming a deployed unit is a representation/lifecycle transition, not new capital. The same chassis must not be double-counted across job and unit state.

## 5.3 Warships

`U` also includes authoritative current Warship capital using the ordinary baseline sequential Warship replacement-cost curve owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`.

This score does not invent a private or speculative naval-production state. A future authoritative committed Warship-production state contributes only after its naval owner exists and this score contract is explicitly integrated with that state.

## 5.4 Explicit V1 exclusions

The following do not contribute separate Current-Power replacement capital in V1:

- autonomous Trains;
- Trade Ships;
- zero-FFY Transport Ships;
- strategic-weapon charges, projectile state, or charge readiness;
- cargo;
- health/damage percentage;
- ammunition/reload state;
- transient buffs/debuffs.

Health/damage and strategic-readiness state are deliberately excluded from this globally public coarse score; this metric must not become a tactical-state side channel merely because it values physical capital.

---

# 6. Major-Faction lifecycle

For a Major Faction:

```text
ACTIVE       -> calculate the live score normally
CAPITULATED  -> score = 0
DEFEATED     -> score = 0
```

The terminal zero represents current strategic strength, not deletion of historical state. Persisted `G` and other ordinary authoritative match history remain governed by their own lifecycle/persistence rules.

---

# 7. Determinism, snapshot coherence, and version binding

The score is derived from one immutable authoritative match-state snapshot. Territory, tick, FFY/accounting state, assets, and faction status used for one result must not be mixed across ticks or independently refreshed views.

`T`, `E`, and `P` are conceptually exact non-negative rational values. The authoritative result must equal the mathematical value specified in §2, including the single final floor. Implementations may use exact integer/rational interval methods or an exactly equivalent deterministic method; browser/locale behavior, insertion order, worker completion timing, or platform-sensitive floating approximation must not change the result.

Authoritative integer accumulation must not silently lose precision. A public score must be materialized as a checked non-negative safe integer; overflow is rejected rather than silently rounded, clamped, or wrapped.

Persisted score inputs, including lifetime gross-positive FFY, participate in canonical match serialization/replay. Balance/cost/formula meaning is bound to the match through the repository-wide game-build/ruleset version-binding architecture owned by `OPENFRONT_INTEGRATION_PLAN.md`. This mechanic does not create a second score-local version authority.

Derived caches are performance aids only. They are not serialized score truth and must invalidate/recompute whenever their authoritative snapshot inputs change.

---

# 8. Origins and Official AI

Origins and Echoes affect the score only through the authoritative state/results they already produce. Ordinary positive FFY awards enter `G` after their canonical finalization; acquisition discounts/free paths do not redefine baseline replacement capital; transformed physical chassis are valued according to their canonical physical form and the rules above.

No Origin or Official-AI configuration receives a private score component. Official AI, player controllers, and other lawful consumers receive only the same combined public score through the public API surface when that API exposes it.
