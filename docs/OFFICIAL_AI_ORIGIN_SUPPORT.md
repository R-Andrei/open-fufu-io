# Open Fufu — Official AI Origin Support Contract

## Status and authority

This document is the canonical generic V1 contract for how Official AI understands and adapts to its randomly selected allowed Origin.

It defines **architecture, shared literals, object shapes, composition rules, boundaries, and validation requirements only**. It intentionally does not define any individual Origin trait's support configuration, any named Origin's composed configuration, or any character's concrete Origin-adaptation configuration. Those are content mappings authored after this contract.

It complements:

- `OFFICIAL_AI_ARCHITECTURE.md` for the whole controller architecture;
- `OFFICIAL_AI_CONFIGURATION.md` for the shared Signals, Goals, Doctrine, planners, Expression, persistence, and CharacterProfile contract;
- `OFFICIAL_AI_PRESETS.md` for character allowed-Origin pools;
- `ORIGIN_TRAIT_CATALOGUE.md` and `OFFICIAL_ORIGINS.md` for actual Origin mechanics/content.

Nothing here changes game mechanics. The authoritative mechanical truth always comes from the final effective rules exposed by the game/controller mechanics layer.

---

## 1. Core principle

The Origin system uses three distinct layers:

```text
actual Origin mechanics
        ↓
reusable Trait / Combination Support
        ↓
OriginStrategicProfile
        ↓
character OriginAdaptationProfile
        ↓
ordinary Doctrine / Goals / Arbiter / planners / Expression / Persistence
```

The canonical rule is:

> **Origin Trait Support teaches strategic literacy; Character Origin Adaptation decides what that character does with the literacy.**

Equivalently:

```text
Origin mechanics say what is possible.
Capability says what the controller can understand/conceive.
Personality says what the character chooses to do with it.
```

Trait Support is therefore **knowledge/support infrastructure**, not a complete strategy and not an Origin-specific replacement brain.

---

## 2. Hard Origin-selection rule

Each Official character preset owns a curated, non-empty set of allowed Official Origins.

For V1:

- human controller / Origin / Echo choices lock first;
- the match seed selects **uniformly at random** from the character's allowed Origin set;
- selection occurs before Strategic Spawn;
- the selected Origin becomes mechanically public before Strategic Spawn;
- the selection is deterministic/replayable from versioned match state;
- no Origin receives a weight;
- no map-conditioned selector exists;
- no character/controller logic chooses which allowed Origin it receives.

The randomization is deliberate anti-counter-picking design. Character intelligence begins **after** the Origin has been selected.

---

## 3. Effective rules remain the mechanical source of truth

Official AI must not rebuild Origin arithmetic in a parallel AI rules engine.

The game composes:

```text
ruleset
+ Origin traits
+ Echoes
+ terrain / structures / situational rules
→ final EffectiveRulesView
```

AI support reads those final values.

Do not copy numeric mechanics such as damage, cost, range, growth multipliers, settlement cost, blast radius, charge capacity, or structure level values into `OriginTraitSupport` merely so the AI can know them.

Trait Support stores **strategic semantics that cannot be obtained cleanly from the numbers alone**.

---

## 4. Origin support mode

Every deployed Origin trait must declare exactly one AI support mode:

```ts
type OriginSupportMode =
  | "GENERIC"
  | "EXTENDED";
```

### `GENERIC`

The existing shared evaluators/planners can use the trait coherently by reading final effective mechanics, aided only by declarative strategic semantics.

A `GENERIC` support entry may contain themes, affordances, cautions, and synergy tags but requires no bespoke evaluator/planner hook.

### `EXTENDED`

The trait structurally changes the strategic meaning of a game system enough that one or more reusable support hooks are required.

An `EXTENDED` support entry must register at least one `signalSupport` or `plannerSupport` hook.

`EXTENDED` does **not** imply that the trait is stronger than a `GENERIC` trait. It only means ordinary shared reasoning cannot model the transformation adequately without support code.

---

## 5. Strategic themes

`StrategicTheme` answers:

> What broad style of strategy does this mechanic tend to reward?

Canonical V1 values:

```ts
type StrategicTheme =
  | "EXPANSION"
  | "GROWTH"
  | "ECONOMIC_COMPOUNDING"
  | "INDUSTRIALIZATION"
  | "TRADE"
  | "INFRASTRUCTURE"
  | "FORTIFICATION"
  | "ATTRITION"
  | "FORCE_PRESERVATION"
  | "DECISIVE_FORCE"
  | "MOBILITY"
  | "SIEGE"
  | "RAIDING"
  | "AMPHIBIOUS"
  | "NAVAL_PROJECTION"
  | "DETERRENCE"
  | "ESCALATION"
  | "TERRITORIAL_SHAPING"
  | "POSITIONAL_CONTROL"
  | "SACRIFICE"
  | "DISTRIBUTED_PLAY"
  | "INFORMATION"
  | "SPECIALIZATION";
```

Themes are broad strategic identity metadata. They are not instructions, utilities, or personality values.

---

## 6. Strategic affordances

`StrategicAffordance` answers:

> What strategic action/opportunity does this mechanic make meaningfully possible or unusually attractive?

Canonical V1 values:

```ts
type StrategicAffordance =
  | "EXPAND_CHEAPLY"
  | "EXPAND_WITH_LOW_POPULATION"

  | "HOLD_GROUND"
  | "TRADE_GROUND_FOR_CASUALTIES"
  | "PRESERVE_FORCE"
  | "LURE_OVEREXTENSION"

  | "FIGHT_FROM_RANGE"
  | "SIEGE_STATIC_POSITIONS"
  | "CREATE_BREAKTHROUGH"
  | "RAID_INFRASTRUCTURE"

  | "DENY_AREA"
  | "SHAPE_TERRITORY"
  | "CUT_CONNECTIVITY"
  | "ERODE_TERRITORY_AT_RANGE"

  | "FORTIFY_BEACHHEAD"
  | "PROJECT_FROM_SEA"
  | "CREATE_SECOND_FRONT"

  | "INTERCEPT_OVER_LARGE_AREA"
  | "PROTECT_HIGH_VALUE_ASSET"

  | "SCALE_GROWTH"
  | "SCALE_ECONOMY"
  | "SCALE_INDUSTRY"
  | "SCALE_TRADE"
  | "BUILD_HIGH_LEVEL_INFRASTRUCTURE"

  | "EXPLOIT_TERRAIN"

  | "DISTRIBUTE_START"
  | "MULTI_THEATER_ACCESS"

  | "LAUNCH_FROM_MOBILE_PLATFORM"
  | "REDUCE_INTERCEPTION_WINDOW"
  | "FORCE_ENEMY_RESPONSE"
  | "RETALIATE_EFFICIENTLY"

  | "GAIN_INFORMATION_ADVANTAGE";
```

Affordances are reusable vocabulary for character adaptation, synergy composition, goal generation, and planner support. They do not automatically create Goals.

---

## 7. Strategic cautions

`StrategicCaution` answers:

> What recurring strategic downside or usage hazard should competent reasoning know about?

Canonical V1 values:

```ts
type StrategicCaution =
  | "HIGH_UPFRONT_COST"
  | "HIGH_LIQUIDITY_NEED"
  | "LONG_PAYBACK"

  | "LOW_MOBILITY"
  | "LOW_THROUGHPUT"
  | "LONG_RELOAD"
  | "CLOSE_RANGE_VULNERABILITY"

  | "SETUP_TIME"
  | "COUNTERATTACK_WINDOW"

  | "OVEREXTENSION_RISK"
  | "SPLIT_FRONT_RISK"
  | "ISOLATED_CORE_RISK"

  | "REQUIRES_GIVING_GROUND"

  | "INFRASTRUCTURE_DEPENDENCE"
  | "TERRAIN_DEPENDENCE"
  | "COAST_DEPENDENCE"
  | "REQUIRES_VETERANCY"

  | "EXPENSIVE_FAILURE"
  | "BAITABLE_DEFENSE"
  | "SELF_GEOMETRY_RISK";
```

Knowing a caution does not mean the character must avoid it. Character adaptation determines whether a caution is ignored, tolerated, respected, or actively avoided.

---

## 8. Synergy tags

`OriginSynergyTag` is a lower-level semantic key used to detect important trait combinations without hardcoding every pair of trait IDs.

Canonical V1 values:

```ts
type OriginSynergyTag =
  | "INITIAL_TERRITORY"
  | "STARTING_POPULATION"
  | "NEUTRAL_EXPANSION"

  | "POPULATION_GROWTH"
  | "ECONOMY"
  | "INDUSTRIAL_ECONOMY"
  | "TRADE_ECONOMY"
  | "TRAIN_ECONOMY"

  | "TERRAIN_SPECIALIZATION"

  | "OFFENSE"
  | "DEFENSE"
  | "COUNTER_RESPONSE"
  | "DEFENDER_SURVIVAL"

  | "ARMOR"
  | "POPULATION_ATTACK"
  | "LONG_RANGE_ATTACK"
  | "HIGH_ALPHA"

  | "FALLOUT"
  | "TERRITORY_NEUTRALIZATION"

  | "AMPHIBIOUS_LANDING"
  | "FORT_CREATION"

  | "NAVAL"
  | "WARSHIP"

  | "MISSILE_LAUNCHER"
  | "STRATEGIC_WEAPON"

  | "SAM_INTERCEPTION"
  | "SINGLE_CHARGE_DEFENSE"

  | "CITY_PURCHASE"

  | "MULTI_SPAWN"

  | "OBSERVATION";
```

Synergy tags are internal AI-support metadata and are not player-facing mechanics.

---

## 9. Evaluator support

Some traits change what shared evaluators should notice or how consequences should be forecast.

Canonical evaluator domains:

```ts
type OriginEvaluatorDomain =
  | "TERRITORY"
  | "ECONOMY"
  | "THREAT"
  | "OPPORTUNITY"
  | "FORECAST";
```

Support registration:

```ts
interface OriginSignalSupport {
  evaluator: OriginEvaluatorDomain;
  hookId: OriginSignalSupportId;
}
```

An Origin signal-support hook may:

- discover additional legitimate Signals;
- enrich interpretation of an existing factual situation;
- improve forecasting of consequences created by the trait.

It may not:

- choose strategic Goals;
- issue controller commands/directives;
- alter character Doctrine;
- expose hidden information;
- silently raise evaluator sophistication beyond the character's selected evaluator capability.

Support therefore teaches a low-tier evaluator enough to avoid mechanically nonsensical behavior while leaving sophisticated exploitation to higher-tier reasoning.

---

## 10. Planner support

Canonical planner-support domains:

```ts
type OriginPlannerDomain =
  | "SPAWN"
  | "EXPANSION"
  | "LAND_WAR"
  | "DEFENSE"
  | "COUNTER_RESPONSE"
  | "RETREAT"
  | "SPENDING"
  | "INFRASTRUCTURE"
  | "UPGRADE"
  | "ARMOR"
  | "NAVAL"
  | "AMPHIBIOUS"
  | "STRATEGIC_WEAPONS"
  | "OBSERVATION"
  | "TEAM";
```

Canonical phases:

```ts
type OriginPlannerSupportPhase =
  | "ENRICH_INPUT"
  | "AUGMENT_CANDIDATES"
  | "EVALUATE_CANDIDATES";
```

Registration:

```ts
interface OriginPlannerSupport {
  domain: OriginPlannerDomain;
  phase: OriginPlannerSupportPhase;
  hookId: OriginPlannerSupportId;
}
```

### `ENRICH_INPUT`

Provides an additional derived fact/representation needed by the normal planner to understand the transformed mechanic.

### `AUGMENT_CANDIDATES`

Proposes legal candidate solution forms the vanilla planner would not ordinarily generate.

The normal planner still decides viability and quality according to its capability.

### `EVALUATE_CANDIDATES`

Explains how the Origin mechanic changes the strategic quality/consequence of otherwise ordinary candidates.

Planner support may not issue actions directly or bypass the normal PlanCandidate/Expression/commit path.

---

## 11. Trait-support object

Canonical shape:

```ts
interface OriginTraitSupport {
  traitId: OriginTraitId;
  mode: OriginSupportMode;

  themes: readonly StrategicTheme[];
  affordances: readonly StrategicAffordance[];
  cautions: readonly StrategicCaution[];
  synergyTags: readonly OriginSynergyTag[];

  signalSupport?: readonly OriginSignalSupport[];
  plannerSupport?: readonly OriginPlannerSupport[];
}
```

Every deployed Origin trait has **exactly one** support entry.

A support entry may legitimately have empty theme/affordance/caution/tag arrays if the mechanic truly has no useful value in that category, but this should be deliberate rather than omitted by accident.

---

## 12. Combination support

Trait support is expected to compose normally, but some combinations create a genuinely new strategic possibility that cannot be expressed well by considering each trait independently.

Canonical combination-support shape:

```ts
interface OriginCombinationSupport {
  id: OriginCombinationSupportId;
  match: OriginCombinationMatch;

  addsThemes?: readonly StrategicTheme[];
  addsAffordances?: readonly StrategicAffordance[];
  addsCautions?: readonly StrategicCaution[];

  signalSupport?: readonly OriginSignalSupport[];
  plannerSupport?: readonly OriginPlannerSupport[];
}

interface OriginCombinationMatch {
  allTraitIds?: readonly OriginTraitId[];
  allSynergyTags?: readonly OriginSynergyTag[];
}
```

At least one matcher field must be non-empty. If both are present, both must match.

### 12.1 No recursive inference engine

`allSynergyTags` matches only tags emitted **directly by the Origin's trait-support entries**.

Combination-support entries do not emit new synergy tags and cannot recursively trigger additional combination-support entries.

This prevents order-dependent or difficult-to-debug inference chains.

### 12.2 Combination support is additive

Combination support may add themes, affordances, cautions, evaluator support, and planner support.

It may not delete or overwrite trait support.

If two support definitions are mechanically/semantically contradictory enough that both cannot be valid simultaneously, the support catalogue is defective and must be fixed before deployment.

---

## 13. Composed OriginStrategicProfile

After an allowed Origin is selected, compose its reusable strategic profile:

```ts
interface OriginStrategicProfile {
  originId: OfficialOriginId;
  traitIds: readonly OriginTraitId[];

  themes: readonly StrategicTheme[];
  affordances: readonly StrategicAffordance[];
  cautions: readonly StrategicCaution[];
  synergyTags: readonly OriginSynergyTag[];

  signalSupport: readonly OriginSignalSupport[];
  plannerSupport: readonly OriginPlannerSupport[];

  combinationSupportIds: readonly OriginCombinationSupportId[];
}
```

Composition inputs:

```text
selected Origin trait IDs
+ every trait's OriginTraitSupport
+ every matching OriginCombinationSupport
= OriginStrategicProfile
```

All set-like arrays are:

- deduplicated;
- deterministic;
- canonically ordered;
- semantically independent of source-array order.

The profile is immutable for the match because the selected Origin is immutable.

---

## 14. Capability boundary

Origin support provides complete reusable literacy but does **not** create a separate support profile per Difficulty.

A support hook receives the character's active evaluator/planner capability and must respect it.

Conceptually:

```ts
interface OriginSupportContext {
  effectiveRules: EffectiveRulesView;
  evaluators: EvaluatorProfile;
  planners: PlannerProfile;
  origin: OriginStrategicProfile;
}
```

The rule is:

> A low-difficulty controller may use a trait poorly, but it should not use the trait nonsensically because it still thinks the transformed mechanic is the vanilla mechanic.

Origin support may teach **basic operational semantics** at every difficulty. Sophisticated tactical/strategic exploitation remains constrained by the selected evaluator/planner tier.

---

## 15. Character Origin adaptation

`OriginAdaptationProfile` belongs to the character, not the Origin.

It answers:

> Given this character's personality and reasoning capability, how does this character value and exploit the strategic toolbox described by `OriginStrategicProfile`?

Canonical caution responses:

```ts
type CautionResponse =
  | "IGNORE"
  | "TOLERATE"
  | "RESPECT"
  | "AVOID";
```

Semantics:

- `IGNORE` — the downside is effectively not used as a reason to alter strategy;
- `TOLERATE` — recognized but accepted readily for meaningful gain;
- `RESPECT` — normal rational treatment;
- `AVOID` — strongly prefer solutions that keep the downside from becoming relevant.

Canonical profile shape:

```ts
interface OriginAdaptationProfile {
  themes?: Partial<Record<StrategicTheme, DoctrineJudgment>>;
  affordances?: Partial<Record<StrategicAffordance, DoctrineJudgment>>;
  cautions?: Partial<Record<StrategicCaution, CautionResponse>>;

  hooks?: OriginAdaptationHooks;

  traitOverrides?: readonly CharacterTraitOverride[];
  originOverrides?: readonly CharacterOriginOverride[];
}
```

Default semantics when a character provides no override:

```text
StrategicTheme      → ACCEPT
StrategicAffordance → ACCEPT
StrategicCaution    → RESPECT
```

Thus even a mostly generic character can operate a supported Origin coherently.

---

## 16. Character Origin-adaptation hook stages

Canonical hook stages:

```ts
interface OriginAdaptationHooks {
  spawn?: readonly OriginSpawnAdaptationHookId[];
  signalInterpretation?: readonly OriginSignalInterpretationHookId[];
  goalGeneration?: readonly OriginGoalHookId[];
  arbitration?: readonly OriginArbitrationHookId[];
  planRanking?: readonly OriginPlanPreferenceHookId[];
  persistence?: readonly OriginPersistenceHookId[];
}
```

### Spawn

Changes how the character interprets the rolled Origin when ranking legal spawn solutions. It cannot change the Origin-selection result.

### Signal interpretation

Changes character-relative significance of legitimate Origin-enabled findings without changing the factual evaluator output.

### Goal generation

May generate character-appropriate candidate Goals from Origin affordances/themes.

### Arbitration

May alter how Origin-enabled Goals compete for strategic attention/resources.

### Plan ranking

May prefer one viable use of an Origin mechanic over another.

### Persistence

May influence whether a character continues, escalates, replans, or abandons an Origin-dependent Plan.

These hooks plug into the ordinary character architecture; they do not form a parallel Origin controller.

---

## 17. Sparse character-specific overrides

Generic adaptation should handle most cases, but genuinely distinctive interactions are allowed.

Trait-specific character override:

```ts
interface CharacterTraitOverride {
  traitId: OriginTraitId;
  hooks: OriginAdaptationHooks;
}
```

Named-Origin-specific character override:

```ts
interface CharacterOriginOverride {
  originId: OfficialOriginId;
  hooks: OriginAdaptationHooks;
}
```

Preferred hierarchy, from most reusable to most bespoke:

```text
1. final effective mechanics
2. generic OriginTraitSupport
3. semantic/composed trait support
4. rare OriginCombinationSupport
5. character OriginAdaptationProfile
6. sparse character × trait override
7. very rare character × named-Origin override
```

Later layers are escape hatches, not expected requirements for every pairing.

---

## 18. Hard personality boundary

Origin Trait/Combination Support may:

- explain strategic meaning;
- expose themes/affordances/cautions;
- add evaluator-support hooks;
- enrich planner inputs;
- add planner candidate forms;
- improve candidate evaluation.

Origin Trait/Combination Support may **not**:

- choose character strategic Goals;
- alter Doctrine values;
- alter Arbiter personality;
- alter Persistence temperament;
- alter character Expression identity;
- issue gameplay directives/commands directly;
- grant hidden information;
- reimplement authoritative game mechanics;
- silently upgrade a character's reasoning tier.

Character Origin Adaptation may:

- interpret support differently;
- prefer/avoid themes/affordances;
- react differently to cautions;
- generate character-specific Goals from Origin capabilities;
- reprioritize Origin-enabled strategies;
- choose characterful uses of the mechanic;
- change persistence around Origin-dependent Plans.

Character Origin Adaptation may **not**:

- change Origin mechanics;
- change the Origin-selection result;
- bypass action legality;
- grant candidate strategies the selected planner cannot conceptually produce except through a registered planner-support extension that remains constrained by that planner tier.

---

## 19. CharacterProfile integration

The canonical `CharacterProfile` from `OFFICIAL_AI_CONFIGURATION.md` includes:

```ts
interface CharacterProfile {
  id: CharacterProfileId;

  evaluators: EvaluatorProfile;
  planners: PlannerProfile;

  doctrine: DoctrineProfile;
  goalGenerator: GoalGeneratorProfile;
  arbiter: ArbiterProfile;
  persistence: PersistenceProfile;
  expression: ExpressionProfile;

  originAdaptation: OriginAdaptationProfile;

  fidelity: FidelityProfile;
}
```

Difficulty remains preset metadata/source-of-truth and is not duplicated into the profile.

---

## 20. Validation requirements

### 20.1 Trait support

Every deployed Origin trait must have exactly one `OriginTraitSupport` entry.

Validation checks:

- trait exists in the deployed/versioned catalogue;
- all enum/literal values exist;
- every referenced evaluator/planner hook exists;
- every hook declares a supported domain/phase;
- `GENERIC` may contain no hooks;
- `EXTENDED` contains at least one signal/planner hook;
- no duplicate support entry exists for the same trait/version.

### 20.2 Combination support

Every combination-support entry must:

- use a non-empty matcher;
- reference only known trait IDs/synergy tags;
- reference only registered hooks;
- be deterministic;
- be additive;
- avoid recursive combination triggering.

### 20.3 Preset/Origin matrix

Every Official character preset must have:

- at least one allowed Origin;
- no duplicate Origin IDs in its pool;
- only legal active Official Origins;
- an implementation capable of loading all trait support used by every allowed Origin.

---

## 21. Test categories

The character × allowed-Origin matrix is **tested**, not implemented as a bespoke matrix.

For every allowed pairing, accelerated tests should verify at minimum:

- the controller starts successfully;
- Strategic Spawn succeeds;
- normal controller execution completes representative matches;
- transformed mechanics do not cause repeated impossible vanilla behavior;
- structures/units/actions granted or transformed by the Origin are understood at a basic operational level;
- no repeated illegal-action spam occurs;
- Origin-specific capabilities can be exercised under scenarios where they are relevant;
- character fidelity remains recognizable under the Origin.

Separate targeted tests should validate specific Origin-support hooks and combination-support behavior.

These tests are distinct from:

- **capability benchmarking** — how strong the controller is at winning;
- **character fidelity benchmarking** — how well the controller matches its authored character fantasy.

---

## 22. Content-authoring ownership and batching

This document owns the generic support language only.

Concrete mappings should be maintained separately so the generic contract does not become an unreadable trait/origin/character catalogue.

Recommended canonical content appendices:

- `OFFICIAL_AI_TRAIT_SUPPORT.md` — one complete support configuration for every deployed Origin trait plus explicit combination-support definitions;
- `OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md` — composed/Origin-specific strategic configuration and validation for every Official Origin;
- `OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md` — Baseline plus every character `CharacterProfile`, including Origin adaptation and fidelity expectations.

Author/review these mappings in batches of **ten**:

```text
traits:     10 → review → next 10
Origins:    10 → review → next 10
characters: 10 → review → next 10
```

After each batch, run a small semantic/coverage consistency check against the already-authored entries before continuing.

The batch process is organizational only. The final versioned documents are the canonical whole-system configuration.