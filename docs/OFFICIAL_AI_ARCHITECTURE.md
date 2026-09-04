# Open Fufu — Official AI Architecture

## Status and authority

This document is the canonical design appendix for the **architecture of Open Fufu's Official PvE AI controllers**.

It complements:

- `OPEN_FUFU_DESIGN.md` for game/controller rules;
- `OFFICIAL_AI_PRESETS.md` for the 20-character roster, difficulty targets, allowed Origin pools, and reward-facing preset identity;
- `CONTROLLER_MEMORY.md` for persistent per-match controller memory;
- the public `ControllerApi.ts` contract for legal observations and actions.

Nothing in this document authorizes gameplay implementation. It defines the accepted architecture and current planning vocabulary. Exact final enum/literal catalogues for goals, doctrine motifs, expression motifs, plan states, and character configurations remain the next design pass and must not be inferred as closed merely from illustrative examples here.

---

## 1. Core principles

### 1.1 Same game, same information

Official AI may be trusted operational code, but it receives **no gameplay-information or mechanics privilege** over player controllers. Any reasoning an Official AI performs must be derivable from the ordinary legal controller observation/mechanics surface.

No Official AI difficulty may come from:

- hidden Population/FFY bonuses or penalties;
- hidden combat modifiers;
- omniscience outside legal visibility;
- special action primitives unavailable to player controllers;
- arbitrary reaction delays;
- random forced stupidity.

### 1.2 Difficulty is authored capability, validated empirically

Difficulty `1..5` is a **target** for the implemented character controller. Benchmarking measures whether the implementation reaches that target; it does not casually redefine the character after the fact.

If Reinhard is authored as Difficulty 5 but an early implementation performs below Bocchi, the default conclusion is that Reinhard needs improvement, not that Reinhard should simply be relabeled Difficulty 1.

Difficulty should emerge primarily from:

- reasoning sophistication;
- planning horizon;
- breadth of consequences considered;
- multi-front/resource prioritization;
- adaptation;
- opponent modeling;
- quality of domain planning;
- character-specific limitations that produce coherent mistakes.

Low-difficulty controllers may make mistakes. The mistake should follow naturally from what the controller notices, understands, values, or prefers.

### 1.3 Difficulty 0 Baseline AI

Open Fufu additionally has a **Difficulty 0 Baseline AI** which is not one of the 20 character presets.

The Baseline AI is:

- generic and intentionally unopinionated;
- a minimal complete controller capable of playing the whole game coherently;
- roughly a more capable general-purpose relative of a Minor Faction/Goon controller;
- the default first-match opponent;
- the primary initial calibration zero for Official-AI capability benchmarking.

It should expand, defend obvious threats, build broadly useful infrastructure, use ordinary military systems simply, and attack obvious openings without sophisticated doctrine, prediction, or multi-stage planning.

### 1.4 Capability and personality are separate axes

A character is not a universal smart brain plus numeric personality sliders.

Conceptually:

```text
character controller
= capability profile
+ values/doctrine
+ execution style/expression
+ persistence/replanning behavior
```

Capability determines what the character can notice and what solutions it can conceive. Personality determines what the character cares about and which conceived solution feels appropriate to that character.

### 1.5 Reuse aggressively; bespoke character code selectively

Open Fufu should not create one implementation of every reasoning category per character. That would produce hundreds of near-duplicate components.

Most information gathering, evaluation, and domain planning should come from a modest shared library. Character-specific code is most justified where identity is directly visible:

- Doctrine;
- Goal generation rules;
- Plan arbitration;
- Plan persistence/reconsideration;
- sparse domain-specific Expression preferences.

---

## 2. High-level pipeline

```text
legal controller observation
        ↓
shared substrate
        ↓
reusable evaluators / forecasts
        ↓
character Doctrine
        ↓
GoalGenerator
        ↓
PlanArbiter
        ↓
active strategic goals
        ↓
reusable domain planners
        ↓
candidate solutions
        ↓
character ExpressionProfile
        ↓
selected solution
        ↓
public controller directives / commands

PlanPersistencePolicy spans the plan lifecycle and determines
when active plans continue, escalate, reduce, pause, or end.
```

This is a design decomposition, not a required class hierarchy.

---

## 3. Shared non-intelligence substrate

These components are mostly common across Official AI controllers and should not be treated as personality.

- **WorldIndex** — efficient indexes for factions, Segments, Contacts, structures, units, operations, and other ordinary observations.
- **GeographyAnalyzer** — reusable topology/border/connectivity/terrain/coast/path facts.
- **MechanicsEstimator** — safe use of public mechanics calculations and surfaced rules.
- **HistoryTracker** — compact deterministic event/history retention in controller memory.
- **VisibilityTracker** — distinguishes current observation from stale/unknown information.

A character should not become “smarter” merely because its copy of a generic Segment lookup is implemented better.

---

## 4. Shared evaluator vocabulary

Evaluators do **not** return one winner or one universal utility score. They return a bounded, diverse set of findings so character logic can decide what matters.

### 4.1 Shared signal shape

Current accepted semantic shape:

```ts
type Horizon = "NOW" | "SOON" | "LATER";

type SignalTag =
  | "PEACEFUL"
  | "STARTS_HOSTILITY"
  | "ESCALATES_HOSTILITY"
  | "DEFENSIVE"
  | "RETALIATORY"
  | "ALLY_SUPPORT"
  | "SACRIFICE";

type SubjectRef =
  | { type: "SELF" }
  | { type: "FACTION"; id: FactionId }
  | { type: "SEGMENT"; id: SegmentId }
  | { type: "CONTACT"; id: string }
  | { type: "STRUCTURE"; id: StructureId }
  | { type: "UNIT"; id: UnitId }
  | { type: "OPERATION"; id: OperationId }
  | { type: "CELL"; id: CellId }
  | { type: "CANDIDATE"; id: string }
  | { type: "GLOBAL" };

interface Signal {
  kind: string;
  subject: SubjectRef;
  strength: number;   // integer 0..100
  confidence: number; // integer 0..100
  horizon?: Horizon;
  tags?: readonly SignalTag[];
}
```

The exact source-code representation may change during implementation, but the semantics above are accepted.

### 4.2 Score meanings

`strength` means how strongly the evaluator believes that finding matters **within that evaluator's domain**. It is not universal goodness/desirability.

`confidence` describes certainty in the finding/inference.

Broad internal scale:

```text
0..19   weak/minor
20..39  modest
40..59  meaningful
60..79  strong
80..100 exceptional/critical
```

No universal formula such as `strength × confidence × aggression` is part of the architecture. Character decisions remain authored reasoning chains.

### 4.3 Output diversity

Evaluator pruning must preserve multiple categories of useful findings. Do not simply sort every finding globally and return the highest scores, because that may remove all peaceful/economic choices before a peaceful character sees them.

Conceptually:

```text
discover
→ score
→ group by kind
→ retain several strongest per kind
→ return diverse signal set
```

A provisional implementation target of roughly `<=24` findings per evaluator and `<=3` per kind was discussed, but those exact counts remain implementation tuning.

### 4.4 Minimal hypothetical candidate

Forecasting/planning may use a tiny candidate identity:

```ts
interface Candidate {
  id: string;
  kind: string;
  subject: SubjectRef;
  tags?: readonly SignalTag[];
}
```

Examples include attack-region, build-Factory, withdraw-front, counter-operation, upgrade-Silo, or expand-region candidates. Final literal catalogues remain open.

---

## 5. Evaluation component families

Component tiers describe **reasoning sophistication**, not mandatory difficulty locks. Characters may be uneven: a Difficulty-2 character can have unusually strong defense while remaining weak elsewhere.

### 5.1 TerritoryEvaluator

Purpose: identify geographic/territorial properties without deciding whether the character should conquer, defend, or abandon them.

Representative signal concepts include free land, Capacity value, terrain value, chokepoints, mobility corridors, coastal access, local exposure, strategic connectors/isolation, bad front topology, disposable territory, and global access value.

**LocalTerritoryEvaluator (~D0–1)**

- sees ownership, adjacency, nearby conquerable/free land, Capacity, and obvious accessibility;
- broadly sees useful land as valuable real estate;
- does not meaningfully reason about Mountain defense, Desert economic value, Forest combat effects, chokepoints, or border topology.

**OperationalTerritoryEvaluator (~D2–3)**

- understands terrain mechanics, capture difficulty, local chokepoints, movement barriers, coastlines, local border exposure, infrastructure access, and armor/naval accessibility;
- may still acquire locally excellent territory that creates a strategically terrible global frontier.

**StrategicGeometryEvaluator (~D4–5)**

- reasons about future border shapes, front count/length, salients, theater connectivity, isolation, enemy access denial, deliberate sacrifice, long-term coastline/connectivity, and Water-Nuke topology when enabled.

### 5.2 EconomyEvaluator

Purpose: describe economic position and consequences of spending/development without deciding what the character ultimately values.

**BudgetEconomyEvaluator (~D0–1)**

- current FFY/income;
- affordability;
- basic saving and obvious productive infrastructure.

**ReturnAwareEconomyEvaluator (~D2–3)**

- rough ROI/payback;
- new construction versus upgrades;
- Factory/Train and Port/trade network value;
- economy-versus-military tradeoffs.

**StrategicEconomyEvaluator (~D4–5)**

- long-horizon opportunity cost;
- liquidity/timing;
- network compounding;
- military/economic sequencing;
- enemy economic trajectory;
- future strategic spending requirements.

### 5.3 OpponentModel

Purpose: infer behavioral tendencies only from legally observed history/state.

**NoOpponentModel (~D0–1)**

- understands current observable state but does not meaningfully infer stable behavior.

**BehaviorHistoryModel (~D2–3)**

- remembers aggression, targeting, counter-response, withdrawal, building focus, overcommitment, and similar repeated behavior;
- tends to extrapolate past behavior simply.

**AdaptiveOpponentModel (~D4–5)**

- maintains/upgrades competing hypotheses;
- notices strategy changes;
- considers how an opponent may respond to the AI's own behavior;
- may cautiously infer future capability interests from legitimate evidence, with uncertainty represented by confidence rather than fake omniscience.

### 5.4 ForecastEngine

Purpose: estimate plausible consequences of a hypothetical candidate. It is not a hidden copy of the authoritative simulator and receives no future information.

**ImmediateConsequenceEstimator (~D0–1)**

- one direct consequence layer.

**ShortHorizonForecaster (~D2–3)**

- chains several likely near-term consequences and usually follows the most obvious continuation.

**ScenarioForecaster (~D4–5)**

- branches across multiple plausible responses/futures;
- compares consequences under different opponent/third-party reactions.

### 5.5 ThreatEvaluator

Purpose: identify plausible developments that can materially harm the faction. It does not decide how frightened the character should be or which response to choose.

**ImmediateThreatEvaluator (~D0–1)**

- active/incoming attacks;
- hostile units or strategic effects presenting actual current/near-immediate danger;
- obvious local force crises.

Mere theoretical exposure is not enough. For example, an exposed Factory becomes an immediate threat finding only when some manifested hostile force/operation can actually endanger it in the immediate horizon.

**OperationalThreatEvaluator (~D2–3)**

- reachable hostile forces;
- relative Population and local military capability;
- terrain/frontage;
- multiple fronts;
- plausible near-term infrastructure/naval threats.

**StrategicPredictiveThreatEvaluator (~D4–5)**

- future economic/military buildup;
- likely escalation;
- opponent-model hypotheses;
- second-order/third-party fronts;
- strategic isolation/encirclement;
- compound threats.

### 5.6 OpportunityEvaluator

Purpose: surface exploitable or constructive opportunities without deciding which are morally/personally desirable.

It must surface peaceful/developmental opportunities as well as aggressive ones when both exist.

**ObviousOpportunityEvaluator (~D0–1)**

- nearby free expansion;
- obvious affordable development;
- obviously weak current hostile target;
- clearly undefended immediate target;
- obvious defensive improvement.

**OperationalOpportunityEvaluator (~D2–3)**

- distracted opponents;
- favorable local frontage/superiority;
- infrastructure raids;
- terrain advantages;
- temporary naval/amphibious openings.

**StrategicOpportunityEvaluator (~D4–5)**

- multi-stage exploitation;
- forcing responses;
- third-party wars;
- economic timing;
- territorial sacrifice;
- topology gains;
- overextension traps and other long-horizon positional openings.

A high-strength aggressive opportunity never forces a peaceful Doctrine to use it.

---

## 6. Character-sensitive strategic layer

### 6.1 Doctrine

Doctrine answers:

> What does this character fundamentally value, dislike, permit, require, or forbid?

It interprets signals in character terms. It may veto classes of behavior, strongly prioritize others, distinguish defensive retaliation from opportunistic aggression, and encode character-specific values such as Population preservation, aversion to waste, desire for leverage, safety, spectacle, patience, etc.

Doctrine should use reusable rule helpers where useful, but unique combinations/exceptions are intentionally allowed.

Doctrine does **not** choose exact cells, attack widths, structure locations, or unit paths.

### 6.2 GoalGenerator

GoalGenerator turns signals + Doctrine + current plans into multiple candidate strategic objectives.

Examples of broad goal families include survival, defending a region, expansion, economic development, infrastructure, weakening/retaliating against/eliminating a faction, ally support, securing position, withdrawal, naval control, beachheads, or strategic-weapon development.

These examples are not yet a final `GoalKind` enum. The final goal literal catalogue is deliberately reserved for the next design pass.

Goal generation must allow **no new goal** / continue-current-plan as a valid outcome.

### 6.3 PlanArbiter

PlanArbiter decides which candidate goals receive attention/resources now.

This is a major personality surface. It should reason about competing objectives rather than simply sort by one score.

Lower-capability arbiters may use relatively fixed hierarchies and maintain few simultaneous goals. Higher-capability arbiters may coordinate several objectives, consider opportunity cost, preserve reserves, make deliberate sacrifices, and manage dependencies/contingencies.

### 6.4 PlanPersistencePolicy

PlanPersistencePolicy determines when an active plan continues, escalates, reduces, pauses, succeeds, fails, or is abandoned.

This is where character-visible patience/stubbornness/adaptation belongs. Examples:

- Askeladd may abandon a plan quickly when leverage disappears;
- Power may persist too long because backing down is undesirable to her;
- Yang may readily abandon a local objective while retaining a broader strategic intent;
- Reinhard may keep a major strategic objective while rapidly replacing subordinate execution plans;
- Thorfinn may end retaliation once the meaningful threat has genuinely ceased.

---

## 7. Character ExpressionProfile — explicit personality in execution

Doctrine explains **what/why** a character wants something. It is not enough to make the resulting play visibly characterful.

Open Fufu therefore has a sparse character **ExpressionProfile** concept:

> When several sufficiently valid solutions exist, what kind of solution does this character prefer?

This is the accepted “element X” that lets characters express actual authored personality inside shared domain planners.

### 7.1 Planner first, expression second

Conceptually:

```text
active goal
→ domain planner generates feasible candidate solutions
→ reject solutions below basic competence/legality threshold
→ ExpressionProfile prefers among viable candidates
```

Capability determines what solutions can be conceived. Expression cannot invent a brilliant encirclement if the selected LandWarPlanner is incapable of producing one.

### 7.2 Sparse and domain-specific

Expression should not become one giant `doEverything()` character class. A character profile may define only the domains in which unusual style matters.

Possible reusable motif families include:

- infrastructure: symmetry, compactness, redundancy, raw efficiency, visually coherent/pleasant networks, protected/distributed placement;
- warfare: decisive battle, raids, overwhelming force, low casualties, indirect approaches, retaliation, weak-target preference, spectacle;
- territory: compact borders, natural barriers, isolation, coastlines, buffers, continuity;
- economy: liquidity, long-term return, industrial networks, self-sufficiency, visible development, military spending;
- naval/amphibious/spawn/strategic-weapon motifs where a character actually needs them.

Most motifs should be reusable. Genuinely signature behavior may use small bespoke character hooks where abstraction would be fake or wasteful.

### 7.3 Yui example

A shared infrastructure planner might produce several economically adequate rail layouts. Yui's expression may prefer simple, coherent, symmetric/cute arrangements and recognize a heart-like route as especially appealing.

She may therefore choose a heart-shaped layout that is somewhat less efficient than the best alternative while rejecting a catastrophically bad heart-shaped layout.

The resulting weakness/personality is authored but natural: she prefers a valid charming solution, not a random bad action.

### 7.4 Same goal, different expression

For a shared goal such as weakening Tanya, one planner may generate direct assault, infrastructure raid, narrow breakthrough, and multi-front pressure candidates.

- Askeladd may prefer the cheap/indirect/exploitative raid.
- Reinhard may prefer the option that most decisively changes the global position.
- Power may prefer the loud direct confrontation and overcommit.

Same legal mechanics; same broad goal; visibly different characters.

---

## 8. Reusable domain planners

Domain planners should primarily encode competence, not personality styles that a competent planner should be able to choose situationally.

Current planned families:

### ExpansionPlanner

- `NearestExpansionPlanner` (~D0–1)
- `TerrainAwareExpansionPlanner` (~D2–3)
- `StrategicExpansionPlanner` (~D4–5)

### LandWarPlanner

- `DirectLandWarPlanner` (~D0–1)
- `OperationalLandWarPlanner` (~D2–3)
- `MultiFrontStrategicWarPlanner` (~D4–5)

A broad front versus concentrated attack is normally a decision produced by the planner, not a separate planner implementation.

### DefensePlanner

- `EvenDefensePlanner` (~D0–1)
- `ValueAwareDefensePlanner` (~D2–3)
- `PredictiveDefensePlanner` (~D4–5)

### CounterResponsePlanner

- `SimpleCounterPlanner` (~D0–1)
- `ExchangeAwareCounterPlanner` (~D2–3)
- `StrategicCounterPlanner` (~D4–5)

### RetreatPlanner

- `EmergencyRetreatPlanner` (~D0–1)
- `DefensibleWithdrawalPlanner` (~D2–3)
- `StrategicSacrificePlanner` (~D4–5)

### SpendingPlanner

- `BasicBudgetPlanner` (~D0–1)
- `PriorityBudgetPlanner` (~D2–3)
- `OpportunityCostPlanner` (~D4–5)

### InfrastructurePlanner

- `UsefulPlacementPlanner` (~D0–1)
- `NetworkAwareInfrastructurePlanner` (~D2–3)
- `StrategicInfrastructureOptimizer` (~D4–5)

### UpgradePlanner

- `AffordableUpgradePlanner` (~D0–1)
- `ValueUpgradePlanner` (~D2–3)
- `StrategicTimingUpgradePlanner` (~D4–5)

### ArmorPlanner

- `LocalArmorPlanner` (~D0–1)
- `OperationalArmorPlanner` (~D2–3)
- `StrategicArmorPlanner` (~D4–5)

### NavalPlanner

- `LocalNavalPlanner` (~D0–1)
- `SeaControlPlanner` (~D2–3)
- `StrategicNavalPlanner` (~D4–5)

### AmphibiousPlanner

- `BasicLandingPlanner` (~D1–2)
- `OpportunityLandingPlanner` (~D2–3)
- `StrategicAmphibiousPlanner` (~D4–5)

### StrategicWeaponPlanner

- `ObviousTargetWeaponPlanner` (~D1–2)
- `OperationalWeaponPlanner` (~D2–4)
- `StrategicWeaponPlanner` (~D4–5)

### ObservationPlanner

- `CoverageObservationPlanner` (~D0–1)
- `ThreatFocusedObservationPlanner` (~D2–3)
- `StrategicInformationPlanner` (~D4–5)

### TeamCoordinator

- `BasicTeamCoordinator` (~D0–1)
- `ObjectiveTeamCoordinator` (~D2–3)
- `StrategicTeamCoordinator` (~D4–5)

### Strategic Spawn

- `SafeSpawnPlanner` (~D0–1)
- `TerrainAwareSpawnPlanner` (~D2–3)
- `StrategicSpawnPlanner` (~D4–5)

Reconsideration:

- `StaticSpawnReconsiderer` (~D0–1)
- `ThreatAwareSpawnReconsiderer` (~D2–3)
- `AdversarialSpawnReconsiderer` (~D4–5)

The difficulty ranges are design guidance, not restrictions. A character may be unusually good or bad in one domain.

---

## 9. Unsupported/non-V1 AI domains

Do not invent major AI component families for mechanics that V1 does not actually support.

Not currently separate V1 controller domains:

- rich treaty/diplomatic negotiation;
- supply/logistics systems that do not exist;
- manual passive-defender quantity allocation;
- frame-by-frame RTS micro;
- privileged Train/Trade-Ship route micromanagement when routing is game-owned;
- hidden-information oracle reasoning.

If game mechanics/API later add such systems, the taxonomy can expand explicitly.

---

## 10. Benchmark architecture

Capability and thematic fidelity are separate measurements.

### 10.1 Capability benchmark

Question:

> How strong is this controller at winning the game?

Use deterministic batches across varied maps, seeds, Origins, opponents, and eventually teams/FFA. Relevant metrics may include win rate/rating, survival/placement, economy/territorial efficiency, performance by map/Origin/opponent style, and other game-relevant outcomes.

The Difficulty 0 Baseline AI is the first fixed reference opponent. Later benchmarking should expand beyond baseline-only matches.

Difficulty is an authored target; measured results drive controller tuning toward that target.

### 10.2 Thematic/fidelity benchmark

Question:

> Does this implementation behave like the authored character fantasy?

This is preset-specific and independent of capability. A very strong controller can be a bad Reinhard; a perfectly recognizable Power can still be strategically mediocre.

Fidelity metrics may inspect character-specific behavior such as aggression initiation, retaliation, ally support, sacrifice/withdrawal behavior, infrastructure choices, risk posture, persistence, and other doctrine/expression invariants.

Never collapse capability and fidelity into one score.

---

## 11. Difficulty and reward relationship

Official character presets retain Difficulty targets `1..5`. Baseline AI is Difficulty `0`.

Difficulty does not change the ordinary qualifying-opponent reward. Reward accounting is conceptually:

```text
ordinary qualifying opponent defeated → +1 Echo roll
Official/Baseline AI difficulty bonus  → +difficulty Echo rolls
```

Therefore:

```text
Baseline AI D0 → +1 ordinary, +0 bonus
D1 character   → +1 ordinary, +1 bonus
D2 character   → +1 ordinary, +2 bonus
...
D5 character   → +1 ordinary, +5 bonus
```

The bonus is simply `difficulty`. Do not describe this as `Difficulty 1 = two loot` as the primary rule; base opponent loot and difficulty bonus are separate concepts.

---

## 12. Open design work before character mapping

The next design pass should finalize the **configuration language** used to express character controllers. In particular:

1. exact final signal-kind literals where shared code needs a closed vocabulary;
2. final broad Goal/GoalKind vocabulary and Goal object shape;
3. Doctrine judgment/motive vocabulary and reusable doctrine primitives;
4. PlanArbiter intent/resource-posture vocabulary;
5. Plan state and persistence decisions;
6. reusable Expression motif catalogue plus rules for sparse bespoke hooks;
7. final `CharacterProfile`/configuration object shape;
8. typical Difficulty `0..5` capability profiles using the component library.

After those are settled, configure the Difficulty-0 Baseline AI, then map several anchor characters, then the remaining roster.

The final character mapping must remain recognizable across every allowed Origin in that preset's pool.
