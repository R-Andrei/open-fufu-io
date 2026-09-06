# Open Fufu — Official AI Origin Support Contract

## Status and authority

This document is the single canonical generic V1 contract for how Official AI understands and adapts to its randomly selected allowed Origin.

It owns:

- the reusable trait-support vocabulary;
- additive trait-combination support semantics;
- AI-support suppression semantics;
- `OriginStrategicProfile` composition;
- the capability boundary between support literacy and reasoning sophistication;
- character-side Origin adaptation and its escape hatches;
- validation requirements for those systems.

It does **not** own exact trait or Origin mappings. Those live only in:

```text
design/official-ai/origin-trait-support.config.ts
design/official-ai/origin-configurations.config.ts
```

Exact character mappings live in `design/official-ai/character-configurations.config.ts`.

Neighboring authorities:

- `OFFICIAL_AI_ARCHITECTURE.md` — whole-controller architecture;
- `OFFICIAL_AI_CONFIGURATION.md` — Signals, Goals, Doctrine, planners, Expression, persistence, component profiles, and `CharacterProfile`;
- `OFFICIAL_AI_PRESETS.md` — character roster, difficulty targets, and allowed-Origin pools;
- `../ECHO_CATALOGUE.md` — Echo reward accounting, including any use of bound AI difficulty;
- `../ORIGIN_TRAIT_CATALOGUE.md` — actual Origin trait mechanics/costs;
- `../OFFICIAL_ORIGINS.md` — actual named Official-Origin roster and trait membership;
- `OFFICIAL_AI_TRAIT_SUPPORT.md` — trait-level AI rationale;
- `OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md` — named-Origin AI rationale.

Nothing here changes game mechanics. Final effective game rules remain mechanically authoritative.

---

## 1. Core principle

```text
actual Origin mechanics
        ↓
reusable Trait Support
        ↓
support suppression
        ↓
reusable Combination Support
        ↓
rare named-Origin support
        ↓
OriginStrategicProfile
        ↓
character OriginAdaptationProfile
        ↓
ordinary Doctrine / Goals / Arbiter / planners / Expression / Persistence
```

Canonical rule:

> **Origin Trait Support teaches strategic literacy; Character Origin Adaptation decides what that character does with the literacy.**

Equivalently:

```text
Origin mechanics say what is possible.
Capability says what the controller can understand and conceive.
Personality says what the character chooses to do with it.
```

Trait support is knowledge/support infrastructure, not an Origin-specific replacement brain.

---

## 2. Hard Origin-selection boundary

Each Official character preset owns a curated non-empty set of allowed Official Origins.

V1 selection order:

```text
1. human controller / Origin / Echo choices lock
2. match seed selects uniformly from each AI preset's allowed Origin set
3. selected AI Origins become mechanically public
4. Strategic Spawn begins
```

Rules:

- selection is uniform;
- no Origin weights exist;
- no map-conditioned selector exists;
- no character/controller logic chooses among allowed Origins;
- selection is deterministic/replayable from versioned match state;
- difficulty belongs to the preset, not the selected Origin; reward accounting that consumes difficulty is owned by `ECHO_CATALOGUE.md`.

Character intelligence begins **after** the Origin roll.

---

## 3. Effective rules remain the mechanical source of truth

Official AI must not rebuild Origin arithmetic in a parallel AI rules engine.

Conceptually:

```text
ruleset
+ Origin traits
+ Echoes
+ terrain / structures / situational rules
→ final EffectiveRulesView
```

AI support reads the final values.

Do not copy damage, cost, range, growth multipliers, settlement cost, blast radius, charge capacity, structure level values, or similar arithmetic into AI support merely so the AI can know them. Support stores strategic semantics that numbers/legality alone do not express cleanly.

---

## 4. Support modes

```ts
type OriginSupportMode =
  | "GENERIC"
  | "EXTENDED";
```

### `GENERIC`

Shared evaluators/planners can use the mechanic coherently from final effective mechanics plus declarative support metadata. No bespoke evaluator/planner hook is required.

### `EXTENDED`

The mechanic structurally changes the strategic meaning of a system enough that reusable evaluator/planner support is required.

An `EXTENDED` mapping must register at least one signal-support or planner-support hook.

Support mode describes modeling requirements, **not power level**.

---

## 5. Strategic themes

A theme answers:

> What broad style of strategy does this mechanic tend to reward?

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

Themes are strategic-identity metadata, not orders or utilities.

---

## 6. Strategic affordances

An affordance answers:

> What strategic action/opportunity does this mechanic make meaningfully possible or unusually attractive?

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

Affordances may inform character adaptation, goal generation, and planner support, but do not automatically create Goals.

---

## 7. Strategic cautions

A caution answers:

> What recurring downside or usage hazard should competent reasoning know about?

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

Knowing a caution does not mean avoiding it. Character adaptation decides whether it is ignored, tolerated, respected, or actively avoided.

---

## 8. Synergy tags

Tags are lower-level internal semantic keys for composition. They are not player-facing mechanics.

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

---

## 9. Evaluator support

```ts
type OriginEvaluatorDomain =
  | "TERRITORY"
  | "ECONOMY"
  | "THREAT"
  | "OPPORTUNITY"
  | "FORECAST";

interface OriginSignalSupport {
  evaluator: OriginEvaluatorDomain;
  hookId: OriginSignalSupportId;
}
```

Signal-support hooks may:

- discover additional legitimate Signals;
- enrich interpretation of factual state;
- improve forecasting of consequences created by the supported mechanic.

They may not choose Goals, issue commands, alter Doctrine, expose hidden information, or silently increase evaluator sophistication.

---

## 10. Planner support

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

type OriginPlannerSupportPhase =
  | "ENRICH_INPUT"
  | "AUGMENT_CANDIDATES"
  | "EVALUATE_CANDIDATES";

interface OriginPlannerSupport {
  domain: OriginPlannerDomain;
  phase: OriginPlannerSupportPhase;
  hookId: OriginPlannerSupportId;
}
```

- `ENRICH_INPUT` adds derived facts/representations needed to understand the mechanic.
- `AUGMENT_CANDIDATES` adds legal candidate forms the ordinary planner would not otherwise generate.
- `EVALUATE_CANDIDATES` explains how the mechanic changes candidate quality/consequences.

Planner support never bypasses normal viability, Expression, legality, or commit paths.

---

## 11. Trait-support object

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

Every deployed trait/version has exactly one mapping in `design/official-ai/origin-trait-support.config.ts`.

Empty arrays are legal when deliberate.

---

## 12. Additive combination support

Most traits should compose from their independent support. Explicit combination support exists only when a combination creates strategic possibilities or planner semantics greater than the ordinary sum of the pieces.

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

At least one matcher is non-empty. If both fields are provided, both must match.

`allSynergyTags` considers only active direct trait-support tags. Combination support does not recursively emit tags or trigger another combination rule.

`allTraitIds` means the traits are selected and their whole support contribution has not been suppressed.

---

## 13. Support suppression

Legal trait combinations can make another selected trait's **AI support semantics** impossible or exactly neutralized while the gameplay combination remains legal.

Suppression cleans up the composed support profile; it never changes mechanics or selected trait IDs.

```ts
interface OriginSupportSuppressionRule {
  id: OriginSupportSuppressionRuleId;
  match: OriginCombinationMatch;
  suppresses: readonly OriginSupportSuppressionTarget[];
}

type OriginSupportSuppressionTarget = {
  traitId: OriginTraitId;

  wholeTraitSupport?: true;

  themes?: readonly StrategicTheme[];
  affordances?: readonly StrategicAffordance[];
  cautions?: readonly StrategicCaution[];
  synergyTags?: readonly OriginSynergyTag[];

  signalHookIds?: readonly OriginSignalSupportId[];
  plannerHookIds?: readonly OriginPlannerSupportId[];
};
```

Use whole-trait suppression only when the effective combination makes the trait's strategic consequence wholly unreachable or exactly neutralized. Use field/hook suppression when only one interpretation becomes invalid.

The exact current suppression registry lives only in `design/official-ai/origin-trait-support.config.ts`; rationale is summarized in `OFFICIAL_AI_TRAIT_SUPPORT.md`.

---

## 14. Composition order and `OriginStrategicProfile`

Canonical order:

```text
1. load selected trait-support entries
2. apply matching support-suppression rules to source contributions
3. collect active direct themes/affordances/cautions/tags/hooks
4. match/apply additive OriginCombinationSupport
5. apply rare named-Origin support
6. deduplicate and canonically order set-like fields
7. freeze OriginStrategicProfile for the match
```

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

  suppressionRuleIds: readonly OriginSupportSuppressionRuleId[];
  combinationSupportIds: readonly OriginCombinationSupportId[];
}
```

`traitIds` always retains every actual selected trait, including traits whose AI-support contribution is suppressed.

All set-like fields are deterministic, deduplicated, canonically ordered, and independent of source-array order.

---

## 15. Named-Origin configuration

Official Origins are curated trait combinations, so the default named-Origin config should be small.

Conceptually each entry records:

```ts
interface OfficialAiOriginConfiguration {
  originId: OfficialOriginId;
  traitIds: readonly OriginTraitId[];

  requiredCombinationSupportIds: readonly OriginCombinationSupportId[];

  originSpecificSupport: NamedOriginSupport | null;

  profileAssertions: OriginProfileAssertions;
  validationFocus: readonly OriginValidationFocusId[];
}
```

`traitIds` must match `OFFICIAL_ORIGINS.md` exactly.

Named-Origin support is a final escape hatch for a strategy that cannot be expressed honestly through trait or reusable combination support. It should remain rare.

Exact entries live only in `design/official-ai/origin-configurations.config.ts`.

---

## 16. Capability boundary

Support is complete/reusable and is **not** authored separately by Difficulty.

Conceptually:

```ts
interface OriginSupportContext {
  effectiveRules: EffectiveRulesView;
  evaluators: EvaluatorProfile;
  planners: PlannerProfile;
  origin: OriginStrategicProfile;
}
```

Rule:

> A low-difficulty controller may exploit a trait poorly, but it should not use the trait nonsensically because it still assumes vanilla mechanics.

Support provides operational literacy. Evaluator/planner tier determines how much sophisticated strategic use the controller can derive from that literacy.

Origin support may not silently upgrade the selected reasoning tier.

---

## 17. Character Origin adaptation

Origin adaptation belongs to the **character**, not the Origin.

```ts
type CautionResponse =
  | "IGNORE"
  | "TOLERATE"
  | "RESPECT"
  | "AVOID";
```

Semantics:

- `IGNORE` — do not use the caution as a reason to change strategy;
- `TOLERATE` — recognize it but accept it readily for meaningful gain;
- `RESPECT` — ordinary rational treatment;
- `AVOID` — strongly prefer solutions that prevent the downside from becoming relevant.

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

This guarantees coherent generic use while allowing characters to interpret the same toolbox differently.

---

## 18. Character Origin-adaptation hooks

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

These stages may change character-relative interpretation, goal generation, arbitration, viable-plan preference, and persistence. They remain inside the normal AI pipeline and cannot change Origin selection or mechanics.

Sparse escape hatches:

```ts
interface CharacterTraitOverride {
  traitId: OriginTraitId;
  hooks: OriginAdaptationHooks;
}

interface CharacterOriginOverride {
  originId: OfficialOriginId;
  hooks: OriginAdaptationHooks;
}
```

Preferred hierarchy:

```text
final effective mechanics
→ trait support
→ support suppression
→ combination support
→ rare named-Origin support
→ character OriginAdaptationProfile
→ sparse character × trait override
→ very rare character × named-Origin override
```

The further down the hierarchy, the rarer the mechanism should be.

---

## 19. Hard personality boundary

Trait/combination/named-Origin support may:

- explain strategic meaning;
- expose themes/affordances/cautions;
- add evaluator support;
- enrich planner inputs;
- add legal candidate forms;
- improve candidate evaluation.

It may **not**:

- choose character strategic Goals;
- alter Doctrine personality;
- alter Arbiter personality;
- alter Persistence temperament;
- alter Expression identity;
- issue commands directly;
- grant hidden information;
- reimplement game rules;
- raise reasoning tier.

Character Origin Adaptation may interpret/prioritize the supported possibilities differently, but may not alter mechanics, Origin selection, legality, or magically create reasoning beyond available planner capability.

---

## 20. CharacterProfile integration

`OFFICIAL_AI_CONFIGURATION.md` owns the full `CharacterProfile` contract. Origin support contributes exactly one field:

```ts
originAdaptation: OriginAdaptationProfile;
```

Difficulty remains preset metadata and is not duplicated into the profile.

---

## 21. Validation

### Trait support

Require:

- exactly one mapping per deployed trait/version;
- known canonical literals;
- registered hook IDs;
- valid hook domain/phase;
- every `EXTENDED` mapping has at least one support hook;
- no duplicate trait IDs.

### Combination and suppression support

Require:

- non-empty matchers;
- known trait IDs/tags/hooks;
- deterministic, order-independent behavior;
- no recursive combination inference;
- suppression modifies AI support only;
- no combination depends on a wholly suppressed required trait;
- suppression is no broader than necessary.

### Named Origins

Require:

- configured trait IDs exactly match `OFFICIAL_ORIGINS.md`;
- every trait has support;
- expected suppression/combination IDs resolve exactly;
- named-Origin support is justified rather than duplicating reusable support;
- golden profile assertions pass.

### Character × allowed-Origin matrix

Every allowed pairing must pass accelerated checks for:

- controller startup;
- Strategic Spawn success;
- legal transformed behavior;
- no repeated impossible-action loops;
- relevant Origin capabilities exercised in suitable scenarios;
- recognizable character fidelity.

These checks are distinct from capability/win-rate benchmarking and character-fidelity benchmarking.

---

## 22. Content-authoring rule

Traits, Origins, and characters may be **reviewed in batches of ten**, but batch boundaries are never permanent file boundaries.

Accepted content lives in these single canonical configuration files:

```text
design/official-ai/origin-trait-support.config.ts
design/official-ai/origin-configurations.config.ts
design/official-ai/character-configurations.config.ts
```

Rationale stays in one document per entity type:

```text
docs/official-ai/OFFICIAL_AI_TRAIT_SUPPORT.md
docs/official-ai/OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md
docs/official-ai/OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md
```

Do not create permanent range/batch shards for either configuration or rationale. Repository history preserves incremental authoring history.
