# Open Fufu — Official AI Configuration Contract

## Status and authority

This document is the canonical V1 configuration contract for composing Open Fufu Official-AI controllers from the accepted architecture in [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md).

It defines the shared Signals, forecasts, Goals, Doctrine vocabulary, arbitration, Plan lifecycle, Expression vocabulary, component profiles, difficulty templates, CharacterProfile shape, and fidelity metadata.

Generic Origin support/adaptation is defined separately in [`OFFICIAL_AI_ORIGIN_SUPPORT.md`](./OFFICIAL_AI_ORIGIN_SUPPORT.md).

Individual trait mappings, named-Origin configurations, and concrete character profiles are content work and are intentionally not defined here.

Nothing in this document authorizes gameplay implementation.

---

## 1. Configuration philosophy

Official AI is creator-owned trusted TypeScript.

Use:

```text
shared typed components
+ typed declarative configuration where configuration is natural
+ sparse named trusted-code hooks where genuine reasoning/personality cannot be represented honestly as data
```

Do **not** build a second JSON/YAML behavior-programming language with arbitrary nested conditions and homemade expression evaluation.

Named hooks remain versioned Official-AI implementation code and receive no gameplay privileges.

---

## 2. Common literals

```ts
type Difficulty = 0 | 1 | 2 | 3 | 4 | 5;
type Horizon = "NOW" | "SOON" | "LATER";
type StrategicScale = "LOCAL" | "THEATER" | "GLOBAL";
type Urgency = "ROUTINE" | "IMPORTANT" | "URGENT" | "CRITICAL";
type FactionRelation = "SELF" | "TEAMMATE" | "OPPONENT";
```

Cross-domain Signal tags:

```ts
type SignalTag =
  | "PEACEFUL"
  | "STARTS_HOSTILITY"
  | "ESCALATES_HOSTILITY"
  | "DEFENSIVE"
  | "RETALIATORY"
  | "ALLY_SUPPORT"
  | "SACRIFICE";
```

Tags describe cross-cutting strategic circumstances. Domain identity belongs in typed Signal/Goal domains instead of being duplicated as tags.

Controller-side subject references:

```ts
type SubjectRef =
  | { type: "SELF" }
  | { type: "FACTION"; id: FactionId }
  | { type: "SEGMENT"; id: SegmentId }
  | { type: "CONTACT"; id: ContactId }
  | { type: "REGION"; id: RegionId }
  | { type: "STRUCTURE"; id: StructureId }
  | { type: "UNIT"; id: UnitId }
  | { type: "OPERATION"; id: OperationId }
  | { type: "CELL"; id: CellId }
  | { type: "CANDIDATE"; id: CandidateId }
  | { type: "GLOBAL" };
```

`REGION` is an AI-side derived grouping/abstraction, not a new authoritative game-world object.

---

## 3. Signal contract

```ts
interface Signal {
  id: SignalId;
  kind: SignalKind;
  subject: SubjectRef;

  strength: number;   // integer 0..100
  confidence: number; // integer 0..100

  horizon: Horizon;
  tags: readonly SignalTag[];
}
```

`strength` means significance **inside the evaluator's own domain**, not universal desirability.

`confidence` means certainty.

Broad interpretation:

```text
0..19   weak/minor
20..39  modest
40..59  meaningful
60..79  strong
80..100 exceptional/critical
```

Evaluator output must preserve useful diversity across Signal kinds rather than returning only the largest global scores.

### 3.1 Territory Signal kinds

```text
FREE_LAND_AVAILABLE
CAPACITY_VALUE
DEFENSIVE_TERRAIN_VALUE
OFFENSIVE_TERRAIN_VALUE
ECONOMIC_TERRAIN_VALUE
CHOKEPOINT_VALUE
MOBILITY_CORRIDOR_VALUE
COASTAL_ACCESS_VALUE
CONNECTIVITY_VALUE
ACCESS_DENIAL_VALUE
BORDER_EXPOSURE
SALIENT_RISK
ISOLATION_RISK
ENCIRCLEMENT_RISK
DISPOSABLE_TERRITORY
GLOBAL_POSITION_VALUE
```

### 3.2 Economy Signal kinds

```text
LIQUIDITY_PRESSURE
LIQUIDITY_SURPLUS
AFFORDABLE_DEVELOPMENT
HIGH_RETURN_INVESTMENT
UPGRADE_RETURN
NETWORK_RETURN
MILITARY_SPENDING_PRESSURE
FUTURE_LIQUIDITY_NEED
ECONOMIC_OVEREXTENSION
ECONOMIC_MOMENTUM
ENEMY_ECONOMIC_ADVANTAGE
ENEMY_ECONOMIC_VULNERABILITY
```

### 3.3 Opponent-model Signal kinds

```text
AGGRESSION_TENDENCY
RETALIATION_TENDENCY
OVERCOMMITMENT_TENDENCY
WITHDRAWAL_TENDENCY
DEFENSIVE_TENDENCY
RAIDING_TENDENCY
ECONOMIC_FOCUS
LAND_WAR_FOCUS
NAVAL_FOCUS
STRATEGIC_WEAPON_FOCUS
TARGETING_PATTERN
BEHAVIOR_SHIFT
PREDICTABILITY
```

These are beliefs inferred from legitimate observations; `confidence` is especially important.

### 3.4 Threat Signal kinds

```text
ACTIVE_LAND_ATTACK
FRONT_COLLAPSE_RISK
STRUCTURE_LOSS_RISK
ARMOR_THREAT
NAVAL_THREAT
AMPHIBIOUS_THREAT
STRATEGIC_WEAPON_THREAT
ECONOMIC_THREAT
ISOLATION_THREAT
ENCIRCLEMENT_THREAT
MULTI_FRONT_OVERLOAD
POWER_SPIKE_THREAT
ALLY_COLLAPSE_THREAT
ESCALATION_THREAT
```

### 3.5 Opportunity Signal kinds

```text
FREE_EXPANSION
WEAK_OPPONENT
EXPOSED_STRUCTURE
FAVORABLE_FRONTAGE
DISTRACTED_OPPONENT
BREAKTHROUGH_WINDOW
RAID_WINDOW
COUNTERATTACK_WINDOW
NAVAL_OPENING
AMPHIBIOUS_OPENING
ECONOMIC_INVESTMENT
INFRASTRUCTURE_WINDOW
UPGRADE_WINDOW
INFORMATION_WINDOW
TOPOLOGY_GAIN
ACCESS_DENIAL_WINDOW
STRATEGIC_WEAPON_WINDOW
SACRIFICE_FOR_POSITION
FORCE_RESPONSE
THIRD_PARTY_EXPLOIT
ALLY_SUPPORT_WINDOW
```

---

## 4. Minimal hypothetical candidate and Forecast contract

A lightweight hypothetical candidate may be represented as:

```ts
interface Candidate {
  id: CandidateId;
  kind: string;
  subject: SubjectRef;
  tags: readonly SignalTag[];
}
```

Forecasting uses a distinct typed result rather than pretending hypothetical consequences are ordinary Signals:

```ts
type ForecastEffectKind =
  | "TERRITORY"
  | "POPULATION"
  | "FFY"
  | "POSITION"
  | "HOSTILITY"
  | "INFORMATION"
  | "CAPABILITY"
  | "TIME"
  | "FAILURE_RISK";

type ForecastDirection =
  | "GAIN"
  | "LOSS"
  | "INCREASE"
  | "DECREASE"
  | "NEUTRAL";

interface ForecastEffect {
  kind: ForecastEffectKind;
  direction: ForecastDirection;
  subject?: SubjectRef;
  magnitude: number;  // 0..100, domain-normalized
  confidence: number; // 0..100
  horizon: Horizon;
}

interface ForecastBranch {
  probabilityWeight: number; // relative deterministic weight
  effects: readonly ForecastEffect[];
}

interface CandidateForecast {
  candidateId: CandidateId;
  primary: readonly ForecastEffect[];
  alternativeBranches?: readonly ForecastBranch[];
}
```

Low-tier forecasting may return only `primary`. Scenario forecasting may produce several plausible response branches.

---

## 5. Goal contract

### 5.1 Goal domains

```ts
type GoalDomain =
  | "TERRITORY"
  | "ECONOMY"
  | "INFRASTRUCTURE"
  | "LAND_WAR"
  | "DEFENSE"
  | "COUNTER_RESPONSE"
  | "ARMOR"
  | "NAVAL"
  | "AMPHIBIOUS"
  | "STRATEGIC_WEAPONS"
  | "OBSERVATION"
  | "TEAM";
```

### 5.2 Goal kinds

```ts
type GoalKind =
  | "SURVIVE"
  | "STABILIZE"
  | "EXPAND"
  | "SECURE"
  | "DEFEND"
  | "WITHDRAW"
  | "SACRIFICE"
  | "DEVELOP"
  | "PREPARE"
  | "COUNTER"
  | "REPEL"
  | "RETALIATE"
  | "PRESSURE"
  | "RAID"
  | "BREAKTHROUGH"
  | "WEAKEN"
  | "ELIMINATE"
  | "CONTROL"
  | "DENY"
  | "ESTABLISH_BEACHHEAD"
  | "STRIKE"
  | "SUPPORT_ALLY";
```

Kind and domain compose instead of creating one literal for every mechanical combination.

### 5.3 Goal motives

```ts
type GoalMotive =
  | "SURVIVAL"
  | "PRESERVATION"
  | "SECURITY"
  | "STABILITY"
  | "GROWTH"
  | "PROSPERITY"
  | "EFFICIENCY"
  | "PREPARATION"
  | "POSITION"
  | "ACCESS"
  | "DENIAL"
  | "INFORMATION"
  | "LEVERAGE"
  | "OPPORTUNISM"
  | "RETALIATION"
  | "PUNISHMENT"
  | "DOMINANCE"
  | "ELIMINATION"
  | "ALLY_SUPPORT"
  | "SPECTACLE"
  | "CURIOSITY";
```

Motive explains **why** a mechanical Goal exists and is an important personality/fidelity surface.

### 5.4 Goal shape

```ts
interface Goal {
  id: GoalId;

  kind: GoalKind;
  domain: GoalDomain;
  target: SubjectRef;

  motives: readonly GoalMotive[];
  tags: readonly SignalTag[];

  horizon: Horizon;
  urgency: Urgency;
  scale: StrategicScale;

  sourceSignalIds: readonly SignalId[];

  parentGoalId?: GoalId;
  dependencies?: readonly GoalId[];
}
```

Higher-capability controllers may retain broad parent Goals while replacing subordinate Goals/Plans.

---

## 6. Doctrine contract

Canonical judgments:

```ts
type DoctrineJudgment =
  | "FORBID"
  | "IGNORE"
  | "DISLIKE"
  | "ACCEPT"
  | "PREFER"
  | "REQUIRE";
```

Semantics:

- `FORBID` — do not voluntarily pursue this behavior;
- `IGNORE` — does not independently justify a Goal;
- `DISLIKE` — legal but requires stronger justification;
- `ACCEPT` — no Doctrine preference;
- `PREFER` — actively favored when context is reasonable;
- `REQUIRE` — when the trigger applies, a legal meaningful response must survive into candidate-Goal arbitration; this does **not** mean immediate suicidal execution.

Strategic resources:

```ts
type StrategicResource =
  | "POPULATION"
  | "FFY"
  | "TERRITORY"
  | "INFRASTRUCTURE"
  | "ARMOR"
  | "NAVAL_ASSETS"
  | "STRATEGIC_WEAPON_CHARGES"
  | "ALLY_POSITION";
```

Resource attitudes:

```ts
type ResourceAttitude =
  | "PROTECT"
  | "CONSERVE"
  | "TRADE"
  | "SPEND"
  | "BURN";
```

Conceptual shape:

```ts
interface DoctrineProfile {
  defaultJudgment: DoctrineJudgment;

  goalKinds?: Partial<Record<GoalKind, DoctrineJudgment>>;
  domains?: Partial<Record<GoalDomain, DoctrineJudgment>>;
  motives?: Partial<Record<GoalMotive, DoctrineJudgment>>;
  tags?: Partial<Record<SignalTag, DoctrineJudgment>>;

  resourceAttitudes: Partial<
    Record<StrategicResource, ResourceAttitude>
  >;

  conditionalRules?: readonly DoctrineRuleId[];
  customHooks?: readonly DoctrineHookId[];
}
```

---

## 7. Goal generation

Canonical shared recipe sets:

```ts
type GoalRuleSetId =
  | "CORE_SURVIVAL"
  | "CORE_EXPANSION"
  | "CORE_ECONOMY"
  | "CORE_INFRASTRUCTURE"
  | "CORE_DEFENSE"
  | "CORE_COUNTER_RESPONSE"
  | "CORE_LAND_WAR"
  | "CORE_ARMOR"
  | "CORE_NAVAL"
  | "CORE_AMPHIBIOUS"
  | "CORE_STRATEGIC_WEAPONS"
  | "CORE_OBSERVATION"
  | "CORE_TEAM_SUPPORT";
```

Conceptual profile:

```ts
interface GoalGeneratorProfile {
  ruleSets: readonly GoalRuleSetId[];
  customRules?: readonly GoalRuleId[];
}
```

Shared recipes translate legitimate evaluator findings into plausible Goals. Character-specific rules are allowed when the character genuinely interprets circumstances differently.

Generating no new Goal and continuing current Plans is always valid.

---

## 8. Arbitration

Canonical vocabulary:

```ts
type IntentTier =
  | "PRIMARY"
  | "SECONDARY"
  | "BACKGROUND";

type GoalDisposition =
  | "ACTIVATE"
  | "DEFER"
  | "REJECT";

type ResourcePosture =
  | "PRESERVE"
  | "CAUTIOUS"
  | "BALANCED"
  | "COMMIT"
  | "ALL_IN";
```

Arbiter capability:

```ts
type ArbiterKind =
  | "SIMPLE_PRIORITY"
  | "CONTEXTUAL"
  | "STRATEGIC_PORTFOLIO";
```

- `SIMPLE_PRIORITY` — mostly fixed hierarchy and few simultaneous concerns;
- `CONTEXTUAL` — current pressure, opportunity cost, reserves, several simultaneous Goals, deferment;
- `STRATEGIC_PORTFOLIO` — dependencies, contingencies, sacrifice, multiple theaters, future resources, coordinated objectives.

```ts
interface ArbiterProfile {
  kind: ArbiterKind;

  maxPrimary: number;
  maxSecondary: number;
  maxBackground: number;

  defaultResourcePosture: ResourcePosture;

  customRules?: readonly ArbiterRuleId[];
  customHooks?: readonly ArbiterHookId[];
}
```

These maxima are cognitive/strategic attention budgets, not simulation action limits.

---

## 9. PlanCandidates and Expression

```ts
interface PlanCandidate {
  id: CandidateId;
  goalId: GoalId;
  domain: GoalDomain;

  viable: boolean;

  // Comparable only among candidate solutions to the same Goal/planner.
  domainQuality: number; // integer 0..100

  traits: readonly SolutionTrait[];
  forecast?: CandidateForecast;

  implementation: OpaquePlanSpec;
}
```

`domainQuality` is never universal strategic utility. The Arbiter compares Goals; a domain planner compares alternatives for one Goal.

### 9.1 Expression preference and leeway

```ts
type ExpressionPreference =
  | "AVOID"
  | "LIKE"
  | "STRONGLY_LIKE"
  | "SIGNATURE";

type ExpressionLeeway =
  | "STRICT"
  | "NARROW"
  | "MODERATE"
  | "WIDE"
  | "SIGNATURE";
```

V1 leeway from the planner's best viable candidate:

```text
STRICT      0 domain-quality points
NARROW      5
MODERATE   12
WIDE       20
SIGNATURE  35
```

Expression may never resurrect a non-viable candidate.

```ts
interface ExpressionRule {
  trait: SolutionTrait;
  preference: ExpressionPreference;
  leeway?: ExpressionLeeway;
}

interface ExpressionProfile {
  defaultLeeway: ExpressionLeeway;
  rules: readonly ExpressionRule[];
  hooks?: readonly ExpressionHookId[];
}
```

Sparse bespoke Expression hooks may augment or rank candidates but may not issue actions directly, bypass legality/viability, read hidden information, change mechanics, or grant reasoning sophistication beyond the planner.

### 9.2 Reusable SolutionTraits

Infrastructure:

```text
EFFICIENT
COMPACT
SYMMETRIC
REDUNDANT
DISTRIBUTED
PROTECTED
NETWORK_DENSE
VISUALLY_COHERENT
MINIMALIST
DEVELOPMENT_HEAVY
```

Land warfare:

```text
CONCENTRATED
BROAD_PRESSURE
INDIRECT
RAIDING
OVERWHELMING
LOW_CASUALTY
HIGH_TEMPO
PATIENT
DECEPTIVE
SACRIFICIAL
PICK_WEAK_TARGET
CHALLENGE_STRONG_TARGET
MULTI_FRONT
ENCIRCLEMENT
```

Territory:

```text
COMPACT_BORDER
NATURAL_BARRIER
CONTIGUOUS
BUFFERED
COASTAL_ACCESS
CHOKEPOINT_CONTROL
ACCESS_DENIAL
DISPERSED_POSITION
HIGH_GROUND
LOW_EXPOSURE
```

Economy:

```text
LIQUIDITY_HEAVY
HIGH_ROI
LONG_HORIZON
INDUSTRIAL_NETWORK
TRADE_NETWORK
SELF_SUFFICIENT
MILITARY_FIRST
GROWTH_FIRST
```

Armor:

```text
ARMOR_CONCENTRATION
ARMOR_SCREEN
ARMOR_RAID
ARMOR_BREAKTHROUGH
ARMOR_PRESERVATION
```

Naval:

```text
SEA_CONTROL
PIRACY
FLAGSHIP
COMMERCE_PROTECTION
COASTAL_DEFENSE
NAVAL_RAID
```

Amphibious:

```text
SAFE_LANDING
SURPRISE_LANDING
DEEP_STRIKE
MULTI_LANDING
FORTIFIED_BEACHHEAD
```

Strategic weapons:

```text
DETERRENT
RETALIATORY_STRIKE
PRECISION_STRIKE
MASS_STRIKE
COUNTERFORCE
ECONOMIC_TARGETING
TOPOLOGY_STRIKE
```

Observation/information:

```text
BROAD_COVERAGE
THREAT_FOCUSED
INFORMATION_DENIAL
COUNTERINTELLIGENCE
DECEPTIVE_INFORMATION_POSTURE
```

Spawn:

```text
SAFE_SPAWN
DEFENSIBLE_SPAWN
GROWTH_RICH_SPAWN
ISOLATED_SPAWN
CENTRAL_SPAWN
COASTAL_SPAWN
TERRAIN_SYNERGY_SPAWN
NEAR_OPPONENT_SPAWN
FAR_FROM_OPPONENT_SPAWN
```

---

## 10. Goal/Plan lifecycle and persistence

Goal state:

```ts
type GoalState =
  | "CANDIDATE"
  | "ACTIVE"
  | "DEFERRED"
  | "SATISFIED"
  | "DROPPED";
```

Plan state:

```ts
type PlanState =
  | "ACTIVE"
  | "PAUSED"
  | "SUCCEEDED"
  | "FAILED"
  | "ABANDONED"
  | "REPLACED";
```

Progress:

```ts
type PlanProgress =
  | "ADVANCING"
  | "STALLED"
  | "REGRESSING"
  | "BLOCKED";
```

Persistence decision:

```ts
type PersistenceDecision =
  | "CONTINUE"
  | "ESCALATE"
  | "REDUCE"
  | "PAUSE"
  | "RESUME"
  | "REPLAN"
  | "ABANDON"
  | "COMPLETE";
```

`REPLAN` retains the strategic Goal while replacing its current execution solution.

Persistence capability:

```ts
type PersistencePolicyKind =
  | "REACTIVE"
  | "CONTEXTUAL"
  | "STRATEGIC";
```

Temperament:

```ts
type PersistenceTemperament =
  | "VOLATILE"
  | "FLEXIBLE"
  | "STEADY"
  | "STUBBORN"
  | "OBSESSIVE";
```

Capability and temperament are independent.

```ts
interface PersistenceProfile {
  kind: PersistencePolicyKind;
  temperament: PersistenceTemperament;
  rules?: readonly PersistenceRuleId[];
  hooks?: readonly PersistenceHookId[];
}
```

---

## 11. Evaluator and planner profiles

```ts
interface EvaluatorProfile {
  territory: "LOCAL" | "OPERATIONAL" | "STRATEGIC_GEOMETRY";
  economy: "BUDGET" | "RETURN_AWARE" | "STRATEGIC";
  opponent: "NONE" | "BEHAVIOR_HISTORY" | "ADAPTIVE";
  forecast: "IMMEDIATE" | "SHORT_HORIZON" | "SCENARIO";
  threat: "IMMEDIATE" | "OPERATIONAL" | "STRATEGIC_PREDICTIVE";
  opportunity: "OBVIOUS" | "OPERATIONAL" | "STRATEGIC";
}
```

```ts
interface PlannerProfile {
  expansion: "NEAREST" | "TERRAIN_AWARE" | "STRATEGIC";
  landWar: "DIRECT" | "OPERATIONAL" | "MULTI_FRONT_STRATEGIC";
  defense: "EVEN" | "VALUE_AWARE" | "PREDICTIVE";
  counterResponse: "SIMPLE" | "EXCHANGE_AWARE" | "STRATEGIC";
  retreat: "EMERGENCY" | "DEFENSIBLE" | "STRATEGIC_SACRIFICE";
  spending: "BASIC" | "PRIORITY" | "OPPORTUNITY_COST";
  infrastructure: "USEFUL" | "NETWORK_AWARE" | "STRATEGIC_OPTIMIZER";
  upgrade: "AFFORDABLE" | "VALUE" | "STRATEGIC_TIMING";
  armor: "LOCAL" | "OPERATIONAL" | "STRATEGIC";
  naval: "LOCAL" | "SEA_CONTROL" | "STRATEGIC";
  amphibious: "BASIC" | "OPPORTUNITY" | "STRATEGIC";
  strategicWeapons: "OBVIOUS_TARGET" | "OPERATIONAL" | "STRATEGIC";
  observation: "COVERAGE" | "THREAT_FOCUSED" | "STRATEGIC_INFORMATION";
  team: "BASIC" | "OBJECTIVE" | "STRATEGIC";
  spawn: "SAFE" | "TERRAIN_AWARE" | "STRATEGIC";
  spawnReconsider: "STATIC" | "THREAT_AWARE" | "ADVERSARIAL";
}
```

Difficulty does not mechanically select component tiers. Character profiles may have specialist strengths and weaknesses.

---

## 12. Difficulty templates

Difficulty templates describe normal capability expectations, not rigid component locks.

### Difficulty 0 — Baseline

- low-tier evaluators/planners throughout;
- no meaningful opponent model;
- immediate forecasting;
- `SIMPLE_PRIORITY` Arbiter;
- roughly one Primary and one Background concern;
- `REACTIVE` persistence;
- complete but intentionally unsophisticated game play.

### Difficulty 1

- mostly low-tier components;
- `NOW` plus limited `SOON` reasoning;
- roughly one Primary, one Secondary, one Background concern;
- characterful preferences may be strong despite low strategic sophistication.

### Difficulty 2

- selected mid-tier evaluators/planners, especially in specialties;
- short-horizon forecasting in important domains;
- optional/simple BehaviorHistory modeling;
- `CONTEXTUAL` arbitration/persistence;
- roughly one Primary, two Secondary, one/two Background concerns.

### Difficulty 3

- broadly operational reasoning;
- BehaviorHistory opponent model;
- ShortHorizon forecasting;
- operational planners across relevant domains;
- contextual multi-goal management;
- selective `LATER` reasoning.

### Difficulty 4

- strategic reasoning in major domains;
- Adaptive opponent model;
- Scenario forecasting;
- high-tier major planners;
- `STRATEGIC_PORTFOLIO` arbitration;
- strategic persistence;
- intentional sacrifice, multi-theater coordination, preparation, third-party exploitation.

### Difficulty 5

- strongest broad use of the same architecture, not a cheat tier;
- strategic evaluators/planners across domains;
- broad Scenario reasoning and Adaptive opponent modeling;
- multiple simultaneous major objectives/dependencies;
- deliberate forcing moves, third-party reactions, global positional planning, stronger cross-domain coordination.

D4→D5 is especially a breadth/coordination distinction rather than a magical additional mechanics layer.

---

## 13. Fidelity contract

Canonical generic axes:

```ts
type FidelityAxis =
  | "HOSTILITY_INITIATION"
  | "RETALIATION"
  | "POPULATION_PRESERVATION"
  | "TERRITORIAL_RISK"
  | "WITHDRAWAL"
  | "SACRIFICE"
  | "PLAN_PERSISTENCE"
  | "OPPORTUNISM"
  | "ECONOMIC_INVESTMENT"
  | "INFRASTRUCTURE_EFFICIENCY"
  | "ALLY_SUPPORT"
  | "WEAK_TARGET_PREFERENCE"
  | "STRONG_TARGET_PREFERENCE"
  | "NAVAL_USAGE"
  | "STRATEGIC_WEAPON_USAGE"
  | "EXPRESSION_SIGNATURE";
```

Expectation:

```ts
type FidelityExpectation =
  | "VERY_LOW"
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "VERY_HIGH";
```

```ts
interface FidelityRule {
  axis: FidelityAxis;
  expectation: FidelityExpectation;
}

interface FidelityProfile {
  rules: readonly FidelityRule[];
  customChecks?: readonly FidelityCheckId[];
}
```

Fidelity metadata is benchmark/test input, not controller decision input.

Capability and fidelity remain separate measurements.

---

## 14. CharacterProfile

Canonical conceptual shape:

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

`OriginAdaptationProfile` is defined in `OFFICIAL_AI_ORIGIN_SUPPORT.md`.

Difficulty remains Official-AI preset metadata/source-of-truth and is not duplicated into `CharacterProfile`.

Display identity, source-work metadata, allowed-Origin pools, presentation, quotes, Echo rewards, Origin mechanics, Echo mechanics, and loadout content are not part of the intelligence profile.

---

## 15. Allowed-Origin selection

Every character preset has an authored set of allowed Official Origins.

After human controller/Origin/Echo choices lock, the match seed selects **uniformly at random** from that set before Strategic Spawn.

There are:

- no Origin weights;
- no map-conditioned Origin selection;
- no character-controller Origin selection.

The selected Origin is revealed before Strategic Spawn under ordinary transparency rules.

The AI must then use that Origin coherently through the canonical Origin-support/adaptation architecture.

---

## 16. Content mapping and closure

The shared configuration language is now closed enough for concrete content mapping.

Concrete canonical content is authored separately in this order:

1. every deployed Origin trait's AI support configuration, including explicit combination support;
2. every Official Origin's composed/Origin-specific configuration;
3. Baseline AI and every character's concrete CharacterProfile, including Origin adaptation and fidelity expectations.

For reviewability these mappings are authored in batches of ten with a consistency check after each batch.

New shared literals should not be added casually during content mapping. If a concrete trait/Origin/character truly exposes a missing generic concept, the generic contract must be explicitly amended and prior mappings re-audited for consistency.