# Open Fufu — Official AI Origin Support Contract

## Status and authority

This document is the canonical generic V1 contract for how Official AI understands and adapts to its randomly selected allowed Origin.

It defines architecture, shared literals, object shapes, composition rules, boundaries, and validation requirements. Exact trait, combination, suppression, named-Origin, and character mappings live in code-readable design configuration under `design/official-ai/*.config.ts`.

It complements:

- `OFFICIAL_AI_ARCHITECTURE.md` — whole-controller architecture;
- `OFFICIAL_AI_CONFIGURATION.md` — Signals, Goals, Doctrine, planners, Expression, persistence, and `CharacterProfile`;
- `OFFICIAL_AI_PRESETS.md` — character allowed-Origin pools;
- `ORIGIN_TRAIT_CATALOGUE.md` and `OFFICIAL_ORIGINS.md` — actual Origin mechanics/content.

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
Capability says what the controller can understand/conceive.
Personality says what the character chooses to do with it.
```

Support is knowledge/infrastructure, not a replacement Origin brain.

---

## 2. Hard Origin-selection rule

Each Official character preset owns a curated non-empty allowed-Origin set.

For V1:

- human controller / Origin / Echo choices lock first;
- the match seed selects **uniformly at random** from the character's allowed set;
- selection occurs before Strategic Spawn;
- the selected Origin becomes public before Strategic Spawn;
- selection is deterministic/replayable from versioned match state;
- no weights exist;
- no map-conditioned selector exists;
- no controller logic chooses which allowed Origin it receives.

Character intelligence begins after Origin selection.

---

## 3. Effective rules remain mechanical truth

The game composes:

```text
ruleset
+ Origin traits
+ Echoes
+ terrain / structures / situational rules
→ final EffectiveRulesView
```

AI support reads the result. It must not duplicate damage, cost, range, growth, settlement, blast, charge, level, or stacking arithmetic merely to know the mechanic.

Support stores strategic semantics that cannot be obtained cleanly from numbers/legality alone.

---

## 4. Support modes

```ts
type OriginSupportMode =
  | "GENERIC"
  | "EXTENDED";
```

### `GENERIC`

Shared evaluators/planners can use the trait coherently by reading final effective mechanics plus declarative semantics. No bespoke evaluator/planner hook is required.

### `EXTENDED`

The trait transforms strategic meaning enough to require reusable support code. It must register at least one evaluator or planner hook.

`EXTENDED` means structurally unusual, not stronger.

---

## 5. Strategic themes

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

A theme answers: **what broad style of strategy does this mechanic tend to reward?** It is metadata, not an instruction or utility score.

---

## 6. Strategic affordances

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

An affordance answers: **what strategic action/opportunity does this mechanic make meaningfully possible or unusually attractive?** It does not automatically create a Goal.

---

## 7. Strategic cautions

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

A caution is a recurring downside/usage hazard. Character adaptation determines whether it is ignored, tolerated, respected, or avoided.

---

## 8. Synergy tags

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

Tags are internal semantic keys for composition, never player-facing mechanics.

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

Hooks may discover legitimate Signals, enrich factual interpretation, or improve forecasting. They may not choose Goals, issue commands, alter Doctrine, expose hidden information, or silently raise evaluator sophistication.

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
- `AUGMENT_CANDIDATES` adds legal candidate forms the vanilla planner would not normally generate.
- `EVALUATE_CANDIDATES` explains how the mechanic changes candidate quality/consequences.

Support never bypasses the normal planner/Expression/commit path.

---

## 11. Trait support

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

Every deployed trait has exactly one entry. Empty arrays are legal when deliberate.

---

## 12. Additive combination support

Some combinations create strategic possibilities greater than independent trait interpretation.

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

At least one matcher must be non-empty. If both are present, both must match.

Combination support is additive and does not recursively emit new synergy tags. `allSynergyTags` examines active direct trait-support tags only.

`allTraitIds` means the traits are selected **and their whole support contribution has not been suppressed**.

---

## 13. Support suppression

The complete legal trait catalogue includes combinations where one trait makes another trait's strategic semantics impossible or exactly neutralizes their practical consequence. This is not an incompatibility and must not change gameplay legality.

AI support therefore has a separate pre-combination suppression layer:

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

Suppression applies to the named trait's **AI-support contribution before deduplication/composition**. It never removes the actual selected trait or changes game rules.

Use whole-trait suppression only when the selected effective combination makes the trait's strategic effect wholly unreachable or exactly neutralized. Use field/hook suppression when only one strategic interpretation becomes impossible.

Examples in the canonical catalogue include:

- P25 removes MIRV access, so P26's one-shot-MIRV support is inactive;
- N05 makes P16's Fallout-resistance bypass irrelevant because Fallout cannot be captured;
- N06 makes P17's paid-upgrade strategy unreachable;
- N12 can make Warship-dependent positive-trait support unreachable;
- N14 + N16 exactly cancel the original-owner first-capture FFY effect, so N14 adds no separate strategic consequence in that combination.

Suppression is semantic cleanup, not hidden trait incompatibility.

---

## 14. Composition order and OriginStrategicProfile

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

`traitIds` always retains every selected trait, including traits whose AI support was suppressed, because it records actual Origin content rather than active semantic contributions.

---

## 15. Capability boundary

Support is complete and reusable; it is not authored separately by Difficulty.

```ts
interface OriginSupportContext {
  effectiveRules: EffectiveRulesView;
  evaluators: EvaluatorProfile;
  planners: PlannerProfile;
  origin: OriginStrategicProfile;
}
```

A low-difficulty controller may exploit a trait poorly, but should not use it nonsensically because it still assumes vanilla mechanics. Support teaches operational literacy; evaluator/planner tier controls strategic depth.

---

## 16. Character Origin adaptation

```ts
type CautionResponse =
  | "IGNORE"
  | "TOLERATE"
  | "RESPECT"
  | "AVOID";

interface OriginAdaptationProfile {
  themes?: Partial<Record<StrategicTheme, DoctrineJudgment>>;
  affordances?: Partial<Record<StrategicAffordance, DoctrineJudgment>>;
  cautions?: Partial<Record<StrategicCaution, CautionResponse>>;
  hooks?: OriginAdaptationHooks;
  traitOverrides?: readonly CharacterTraitOverride[];
  originOverrides?: readonly CharacterOriginOverride[];
}
```

Default semantics:

```text
StrategicTheme      → ACCEPT
StrategicAffordance → ACCEPT
StrategicCaution    → RESPECT
```

Character adaptation answers what **this character** does with the supported toolbox.

---

## 17. Character adaptation hook stages

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

These stages may change character-relative interpretation, goal generation, arbitration, viable-plan preference, and persistence. They remain part of the normal AI pipeline and cannot change Origin selection or mechanics.

Sparse escape hatches remain legal:

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
→ sparse character×trait override
→ very rare character×Origin override
```

---

## 18. Hard personality boundary

Trait/combination/named-Origin support may explain strategic meaning, expose semantics, add evaluator support, enrich planner inputs, generate legal candidate forms, and improve candidate evaluation.

It may not choose character Goals, alter Doctrine personality, alter Arbiter personality, alter Persistence temperament, alter Expression identity, issue commands directly, grant hidden information, reimplement game rules, or raise reasoning tier.

Character Origin Adaptation may interpret and prioritize supported possibilities differently, but may not change mechanics, selection, legality, or create cognition beyond available planner capability.

---

## 19. CharacterProfile integration

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

Difficulty remains preset metadata and is not duplicated into the profile.

---

## 20. Validation

Trait-support validation requires:

- exactly one entry per deployed trait/version;
- known literals and registered hooks;
- valid domain/phase registration;
- `EXTENDED` has at least one support hook;
- no duplicated trait support.

Combination/suppression validation requires:

- non-empty matchers;
- known trait IDs/tags/hooks;
- deterministic order-independent application;
- suppression applies only to source support, never gameplay mechanics;
- no recursive combination inference;
- no additive combination may depend on a wholly suppressed required trait.

Named-Origin validation requires:

- trait IDs exactly match `OFFICIAL_ORIGINS.md`;
- every trait has support;
- all expected suppression/combination IDs resolve exactly;
- rare named-Origin support is justified rather than duplicating reusable combination support;
- golden profile assertions pass.

Every character × allowed-Origin pairing must additionally pass accelerated smoke/behavior tests: controller startup, Strategic Spawn, legal transformed behavior, no impossible-action loops, relevant capability exercise, and recognizable character fidelity.

---

## 21. Concrete configuration ownership

Markdown owns architecture/rationale. Exact mappings live in:

```text
design/official-ai/origin-trait-support*.config.ts
design/official-ai/origin-combination-support.config.ts
design/official-ai/origin-configurations*.config.ts
design/official-ai/character-configurations*.config.ts
```

Companion rationale documents are:

- `OFFICIAL_AI_TRAIT_SUPPORT.md`;
- `OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md`;
- future `OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md`.

The design pass is authored/reviewed in batches of ten with a consistency check after each batch. Batch size is organizational only; the final versioned configuration is one canonical system.
