# Open Fufu — Official AI Configuration Contract

## Status and authority

This document is the canonical V1 configuration contract for composing Open Fufu Official-AI controllers from the accepted architecture in [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md).

It closes the previously-open general configuration-language work for signals, goals, Doctrine, arbitration, plan persistence, Expression, capability profiles, difficulty templates, and fidelity metadata. Per-character mappings remain future content work.

The one remaining general architecture question before character mapping is the **Origin adaptation/support layer**: how an Official AI uses whichever allowed Official Origin it randomly receives without creating a bespoke character × Origin implementation matrix.

Nothing in this document authorizes implementation.

---

## 1. Configuration philosophy

Official AI is creator-owned trusted TypeScript. Use typed declarative configuration where configuration is natural, plus small named trusted-code rules/hooks where genuine character reasoning cannot be represented honestly as data.

Do **not** build a second JSON/YAML behavior-programming language with arbitrary nested boolean expressions.

Conceptually:

```text
shared typed components
+ typed character configuration
+ sparse named character hooks where necessary
```

Character-specific hooks remain versioned Official-AI implementation code and receive no gameplay privileges.

---

## 2. Common literals

```ts
type Difficulty = 0 | 1 | 2 | 3 | 4 | 5;
type Horizon = "NOW" | "SOON" | "LATER";
type StrategicScale = "LOCAL" | "THEATER" | "GLOBAL";
type Urgency = "ROUTINE" | "IMPORTANT" | "URGENT" | "CRITICAL";
type FactionRelation = "SELF" | "TEAMMATE" | "OPPONENT";
```

Cross-domain signal tags:

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

Tags describe cross-cutting strategic circumstances Doctrine may care about. Domain identity such as naval/economic/armor belongs in typed kinds/domains rather than being duplicated as tags.

Controller-side subject references may include a derived strategic `REGION`:

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

`REGION` is an AI-side grouping/abstraction, not a new authoritative game-world object.

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

`strength` is evaluator-domain significance, not universal goodness/desirability. `confidence` is certainty. A high-strength aggressive opportunity is never itself an instruction to attack.

Broad score interpretation remains:

```text
0..19   weak/minor
20..39  modest
40..59  meaningful
60..79  strong
80..100 exceptional/critical
```

Evaluator pruning must preserve several kinds of finding rather than globally returning only the highest scores.

### 3.1 Territory signal kinds

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

### 3.2 Economy signal kinds

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

### 3.3 Opponent-model signal kinds

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

These are beliefs inferred from legal observations; `confidence` is especially important.

### 3.4 Threat signal kinds

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

### 3.5 Opportunity signal kinds

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

## 4. Forecast contract

Forecasting uses its own typed result rather than pretending every hypothetical consequence is an ordinary signal.

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
  magnitude: number;  // 0..100 domain-normalized
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

Low-tier forecasting may return only `primary`; scenario forecasting may compare several plausible branches.

---

## 5. Goal contract

### 5.1 Goal domains

```text
TERRITORY
ECONOMY
INFRASTRUCTURE
LAND_WAR
DEFENSE
COUNTER_RESPONSE
ARMOR
NAVAL
AMPHIBIOUS
STRATEGIC_WEAPONS
OBSERVATION
TEAM
```

### 5.2 Goal kinds

```text
SURVIVE
STABILIZE
EXPAND
SECURE
DEFEND
WITHDRAW
SACRIFICE
DEVELOP
PREPARE
COUNTER
REPEL
RETALIATE
PRESSURE
RAID
BREAKTHROUGH
WEAKEN
ELIMINATE
CONTROL
DENY
ESTABLISH_BEACHHEAD
STRIKE
SUPPORT_ALLY
```

Kind and domain compose instead of creating one literal for every combination. `DEVELOP + ECONOMY`, `CONTROL + NAVAL`, `RETALIATE + LAND_WAR`, and `STRIKE + STRATEGIC_WEAPONS` are ordinary examples.

### 5.3 Goal motives

```text
SURVIVAL
PRESERVATION
SECURITY
STABILITY
GROWTH
PROSPERITY
EFFICIENCY
PREPARATION
POSITION
ACCESS
DENIAL
INFORMATION
LEVERAGE
OPPORTUNISM
RETALIATION
PUNISHMENT
DOMINANCE
ELIMINATION
ALLY_SUPPORT
SPECTACLE
CURIOSITY
```

Motive explains *why* the same broad mechanical goal exists and is an important personality/fidelity surface.

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

Higher-capability controllers may retain broad parent goals while replacing subordinate goals/plans.

---

## 6. Doctrine contract

Doctrine judgments:

```text
FORBID
IGNORE
DISLIKE
ACCEPT
PREFER
REQUIRE
```

These are semantic decisions, not six positions on one numeric slider.

- `FORBID` — do not voluntarily pursue this behavior.
- `IGNORE` — it does not independently justify a goal.
- `DISLIKE` — allowed but requires stronger justification.
- `ACCEPT` — no doctrine preference.
- `PREFER` — actively favored when context is reasonable.
- `REQUIRE` — when its trigger applies, a legal meaningful response must survive into candidate-goal arbitration; it does not mean immediate suicidal execution.

Strategic resources:

```text
POPULATION
FFY
TERRITORY
INFRASTRUCTURE
ARMOR
NAVAL_ASSETS
STRATEGIC_WEAPON_CHARGES
ALLY_POSITION
```

Resource attitudes:

```text
PROTECT
CONSERVE
TRADE
SPEND
BURN
```

These range from requiring extraordinary justification for loss (`PROTECT`) through ordinary strategic exchange (`TRADE`) to aggressive expenditure for fitting objectives (`BURN`).

Conceptually:

```ts
interface DoctrineProfile {
  defaultJudgment: DoctrineJudgment;
  goalKinds?: Partial<Record<GoalKind, DoctrineJudgment>>;
  domains?: Partial<Record<GoalDomain, DoctrineJudgment>>;
  motives?: Partial<Record<GoalMotive, DoctrineJudgment>>;
  tags?: Partial<Record<SignalTag, DoctrineJudgment>>;
  resourceAttitudes: Partial<Record<StrategicResource, ResourceAttitude>>;
  conditionalRules?: readonly DoctrineRuleId[];
  customHooks?: readonly DoctrineHookId[];
}
```

Named rules/hooks are trusted creator-owned code, not a new player-facing scripting language.

---

## 7. Goal generation and arbitration

Shared goal-recipe sets may be roughly equivalent to:

```text
CORE_SURVIVAL
CORE_EXPANSION
CORE_ECONOMY
CORE_INFRASTRUCTURE
CORE_DEFENSE
CORE_COUNTER_RESPONSE
CORE_LAND_WAR
CORE_ARMOR
CORE_NAVAL
CORE_AMPHIBIOUS
CORE_STRATEGIC_WEAPONS
CORE_OBSERVATION
CORE_TEAM_SUPPORT
```

Ordinary shared recipes translate evaluator findings into plausible candidate goals. Character-specific named rules are allowed where the character genuinely interprets circumstances differently.

Arbitration vocabulary:

```text
IntentTier:
PRIMARY | SECONDARY | BACKGROUND

GoalDisposition:
ACTIVATE | DEFER | REJECT

ResourcePosture:
PRESERVE | CAUTIOUS | BALANCED | COMMIT | ALL_IN
```

These separately describe whether a goal is pursued, how much strategic attention it has, and how aggressively resources may be committed.

Arbiter capability kinds:

```text
SIMPLE_PRIORITY
CONTEXTUAL
STRATEGIC_PORTFOLIO
```

- `SIMPLE_PRIORITY` mainly uses a fixed hierarchy and few simultaneous concerns.
- `CONTEXTUAL` handles current pressure, opportunity cost, reserves, several simultaneous goals, and deferment.
- `STRATEGIC_PORTFOLIO` handles dependencies, contingencies, deliberate sacrifice, multiple theaters, future resource needs, and coordinated objectives.

Conceptually:

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

These goal counts are cognitive/strategic attention budgets, not simulation action limits.

---

## 8. Plan candidates and Expression

```ts
interface PlanCandidate {
  id: CandidateId;
  goalId: GoalId;
  domain: GoalDomain;
  viable: boolean;
  domainQuality: number; // 0..100; comparable only among alternatives for this goal/planner
  traits: readonly SolutionTrait[];
  forecast?: CandidateForecast;
  implementation: OpaquePlanSpec;
}
```

`domainQuality` is never a universal strategic utility score. The Arbiter compares goals; a domain planner compares alternative solutions to one goal.

Expression preference:

```text
AVOID | LIKE | STRONGLY_LIKE | SIGNATURE
```

Expression leeway:

```text
STRICT | NARROW | MODERATE | WIDE | SIGNATURE
```

Initial V1 interpretation of how far below the planner's best candidate Expression may choose:

```text
STRICT     0 domain-quality points
NARROW     5
MODERATE  12
WIDE      20
SIGNATURE 35
```

These thresholds are versioned tuning semantics. Expression can never resurrect a candidate the planner marks non-viable.

This is the accepted mechanism for coherent character suboptimality: Yui may choose a somewhat less efficient heart-like rail network because it remains a viable network, but she does not choose a catastrophically dysfunctional layout merely because it resembles a heart.

### 8.1 Reusable SolutionTraits

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

### 8.2 Sparse bespoke Expression hooks

Allowed phases:

```text
AUGMENT_CANDIDATES
RANK_CANDIDATES
```

An augment hook may propose another legal candidate for an already-active goal (for example `YUI_HEART_RAIL`); the ordinary planner still evaluates viability/quality. A rank hook may recognize a signature property not worth generalizing into the shared motif catalogue.

Expression hooks may not issue game commands directly, read hidden state, bypass planner legality/viability, change mechanics, or grant reasoning capability the selected planner does not possess.

---

## 9. Goal/plan lifecycle and persistence

Goal state:

```text
CANDIDATE
ACTIVE
DEFERRED
SATISFIED
DROPPED
```

Plan state:

```text
ACTIVE
PAUSED
SUCCEEDED
FAILED
ABANDONED
REPLACED
```

Progress:

```text
ADVANCING
STALLED
REGRESSING
BLOCKED
```

Persistence decisions:

```text
CONTINUE
ESCALATE
REDUCE
PAUSE
RESUME
REPLAN
ABANDON
COMPLETE
```

`REPLAN` preserves the strategic Goal while replacing the current execution solution.

Persistence capability kinds:

```text
REACTIVE
CONTEXTUAL
STRATEGIC
```

Temperament:

```text
VOLATILE
FLEXIBLE
STEADY
STUBBORN
OBSESSIVE
```

Capability and temperament are independent.

Conceptually:

```ts
interface PersistenceProfile {
  kind: PersistencePolicyKind;
  temperament: PersistenceTemperament;
  rules?: readonly PersistenceRuleId[];
  hooks?: readonly PersistenceHookId[];
}
```

---

## 10. Concrete component-profile IDs

Evaluator profile IDs:

```text
territory: LOCAL | OPERATIONAL | STRATEGIC_GEOMETRY
economy: BUDGET | RETURN_AWARE | STRATEGIC
opponent: NONE | BEHAVIOR_HISTORY | ADAPTIVE
forecast: IMMEDIATE | SHORT_HORIZON | SCENARIO
threat: IMMEDIATE | OPERATIONAL | STRATEGIC_PREDICTIVE
opportunity: OBVIOUS | OPERATIONAL | STRATEGIC
```

Planner profile IDs:

```text
expansion: NEAREST | TERRAIN_AWARE | STRATEGIC
landWar: DIRECT | OPERATIONAL | MULTI_FRONT_STRATEGIC
defense: EVEN | VALUE_AWARE | PREDICTIVE
counterResponse: SIMPLE | EXCHANGE_AWARE | STRATEGIC
retreat: EMERGENCY | DEFENSIBLE | STRATEGIC_SACRIFICE
spending: BASIC | PRIORITY | OPPORTUNITY_COST
infrastructure: USEFUL | NETWORK_AWARE | STRATEGIC_OPTIMIZER
upgrade: AFFORDABLE | VALUE | STRATEGIC_TIMING
armor: LOCAL | OPERATIONAL | STRATEGIC
naval: LOCAL | SEA_CONTROL | STRATEGIC
amphibious: BASIC | OPPORTUNITY | STRATEGIC
strategicWeapons: OBVIOUS_TARGET | OPERATIONAL | STRATEGIC
observation: COVERAGE | THREAT_FOCUSED | STRATEGIC_INFORMATION
team: BASIC | OBJECTIVE | STRATEGIC
spawn: SAFE | TERRAIN_AWARE | STRATEGIC
spawnReconsider: STATIC | THREAT_AWARE | ADVERSARIAL
```

Difficulty does not mechanically select a component tier. Characters may have specialist strengths and weaknesses.

---

## 11. Difficulty templates

### Difficulty 0 — Baseline

- low-tier evaluators/planners throughout;
- no meaningful opponent model;
- immediate forecasting;
- `SIMPLE_PRIORITY` Arbiter;
- roughly one Primary and one Background concern;
- `REACTIVE` persistence;
- plays the whole game coherently but does not meaningfully strategize.

### Difficulty 1

- mostly low-tier components;
- simple `NOW` plus limited `SOON` reasoning;
- one Primary, roughly one Secondary and one Background concern;
- characterful preferences can exist despite low strategic sophistication.

### Difficulty 2

- selected mid-tier evaluators/planners, especially in character specialties;
- short-horizon forecasting in important domains;
- optional/simple behavior-history modeling;
- `CONTEXTUAL` arbitration/persistence;
- roughly one Primary, two Secondary and one/two Background concerns.

### Difficulty 3

- broadly operational reasoning;
- behavior-history opponent modeling;
- short-horizon forecasting;
- operational planners across relevant domains;
- contextual multi-goal management;
- selective later-horizon reasoning.

### Difficulty 4

- strategic geometry/economy/threat/opportunity in major domains;
- adaptive opponent modeling;
- scenario forecasting;
- high-tier major planners;
- `STRATEGIC_PORTFOLIO` arbitration and strategic persistence;
- intentional sacrifice, multi-theater coordination, preparation, and third-party exploitation.

### Difficulty 5

- strongest broad use of the same architecture, not a cheat tier;
- strategic evaluators/planners across domains;
- broad scenario reasoning and adaptive opponent modeling;
- multiple simultaneous major objectives and dependencies;
- deliberate forcing moves, third-party reactions, global positional planning, and stronger cross-domain coordination.

The D4→D5 distinction is especially breadth/coordination depth rather than a magical extra mechanics layer.

---

## 12. CharacterProfile and fidelity

Conceptually:

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
  hooks?: {
    doctrine?: readonly DoctrineHookId[];
    goals?: readonly GoalRuleId[];
    arbitration?: readonly ArbiterHookId[];
    persistence?: readonly PersistenceHookId[];
    expression?: readonly ExpressionHookId[];
  };
  fidelity: FidelityProfile;
}
```

Difficulty remains preset metadata/source-of-truth rather than being copied into `CharacterProfile`.

Display identity, source work, allowed Origins, art, quotes, reward-facing metadata, Origin mechanics, Echo mechanics, and loadout content are not part of the intelligence profile.

Representative fidelity axes:

```text
HOSTILITY_INITIATION
RETALIATION
POPULATION_PRESERVATION
TERRITORIAL_RISK
WITHDRAWAL
SACRIFICE
PLAN_PERSISTENCE
OPPORTUNISM
ECONOMIC_INVESTMENT
INFRASTRUCTURE_EFFICIENCY
ALLY_SUPPORT
WEAK_TARGET_PREFERENCE
STRONG_TARGET_PREFERENCE
NAVAL_USAGE
STRATEGIC_WEAPON_USAGE
EXPRESSION_SIGNATURE
```

Expectations:

```text
VERY_LOW | LOW | NORMAL | HIGH | VERY_HIGH
```

Character-specific deterministic checks may supplement generic axes. Fidelity metadata is benchmark/test input, not controller decision input. Capability and fidelity remain separate measurements.

---

## 13. Allowed-Origin selection — accepted hard rule

Every character preset has an authored **set of allowed Official Origins** chosen because those Origins fit the character fantasy and can plausibly be supported by that controller.

For V1, after human controller/Origin/Echo choices lock, the match seed selects **uniformly at random from that allowed set** before Strategic Spawn.

There are:

- **no per-Origin weights**;
- **no map-conditioned Origin selection**;
- **no character-controller logic choosing among its allowed Origins**.

This is deliberate anti-counter-picking design. A player must not be able to infer that a known character will deterministically pick one particular Origin on a particular map and build an effectively AFK hard counter around that prediction.

The selected Origin is still revealed mechanically before Strategic Spawn under the ordinary transparency rules. The uncertainty is only pre-lock selection, not hidden gameplay information.

Random selection does not excuse poor Origin use: every preset must use every Origin in its allowed pool coherently and recognizably.

---

## 14. Remaining design item — Origin adaptation/support

The AI needs Origin-specific strategic knowledge after its Origin is selected. This may include understanding:

- changed starting-state/spawn rules;
- altered terrain incentives;
- transformed structures/units;
- strategic-weapon access or launcher transformations;
- economic/growth tradeoffs;
- unusual defensive/offensive mechanics;
- explicit disadvantages that should change ordinary planning;
- synergies that require Origin-specific candidates.

The remaining architecture task is to decide how this Origin knowledge plugs into the accepted character controller without either:

```text
character × Origin bespoke implementations everywhere
```

or:

```text
one generic modifier sheet that knows the numbers but not how to exploit transformative Origin mechanics
```

The likely direction is reusable Origin-support logic that contributes Origin-specific reasoning/candidates while remaining subordinate to the character's Doctrine, Arbiter, persistence, and Expression identity. This Origin-support layer is not yet accepted and should be settled before per-character mapping begins.
