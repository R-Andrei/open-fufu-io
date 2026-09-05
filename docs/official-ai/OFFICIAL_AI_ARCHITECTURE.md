# Open Fufu — Official AI Architecture

## Status and authority

This document is the **canonical owner for the architecture of Open Fufu's Official PvE AI controllers**.

Neighboring concerns are owned separately:

- game/controller rules: [`../OPEN_FUFU_DESIGN.md`](../OPEN_FUFU_DESIGN.md);
- concrete shared Official-AI configuration vocabulary and object contracts: [`OFFICIAL_AI_CONFIGURATION.md`](./OFFICIAL_AI_CONFIGURATION.md);
- generic Origin-trait support/composition/adaptation: [`OFFICIAL_AI_ORIGIN_SUPPORT.md`](./OFFICIAL_AI_ORIGIN_SUPPORT.md);
- character roster, difficulty targets, and allowed-Origin pools: [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md);
- persistent per-match controller memory: [`../CONTROLLER_MEMORY.md`](../CONTROLLER_MEMORY.md);
- public controller observations/actions: [`../../src/core/controller/ControllerApi.ts`](../../src/core/controller/ControllerApi.ts);
- Echo reward accounting: [`../ECHO_CATALOGUE.md`](../ECHO_CATALOGUE.md).

Trait-by-trait support mappings, Origin-level compositions, and character profiles are content/configuration concerns that conform to this architecture rather than being redefined here.

---

## 1. Core principles

### 1.1 Same game, same information

Official AI may be trusted operational code but receives **no gameplay-information or mechanics privilege** over player controllers.

Official AI difficulty must not come from:

- hidden Population/FFY bonuses or penalties;
- hidden combat modifiers;
- omniscience outside legal visibility;
- special gameplay primitives unavailable to player controllers;
- artificial reaction delays;
- random forced stupidity.

Official AI reasons from the same legal observations, public mechanics, surfaced Origin/Echo/ruleset effects, and controller-facing action model available to ordinary controllers.

### 1.2 Difficulty is an authored capability target

Difficulty is a creator-authored target for the implemented controller and is validated empirically.

If a character authored as Difficulty 5 benchmarks below a Difficulty-2 character, the default response is to improve the Difficulty-5 implementation toward its target rather than casually relabeling the controller after the first result.

Difficulty should emerge from:

- reasoning sophistication;
- planning horizon;
- breadth of consequences considered;
- multi-front/resource prioritization;
- adaptation;
- opponent modeling;
- planner quality;
- character-consistent limitations and mistakes.

Low-difficulty characters may make serious mistakes, but those mistakes should follow naturally from what they notice, understand, value, or prefer rather than a `chanceToDoSomethingStupid` mechanic.

### 1.3 Difficulty-0 Baseline AI

Open Fufu has a generic **Difficulty 0 Baseline AI** separate from the character roster.

The Baseline AI is:

- generic and intentionally unopinionated;
- a minimal complete controller that can play the whole game;
- roughly a more capable general-purpose relative of a Minor Faction/Goon controller;
- the default first-match opponent;
- the initial fixed calibration reference for capability benchmarking.

It should expand, defend obvious threats, build broadly useful infrastructure, use ordinary military systems simply, and exploit obvious openings without sophisticated doctrine, prediction, or long-horizon planning.

### 1.4 Capability, values, and execution style are separate

A character is **not** a universal optimal brain plus numeric personality sliders.

Conceptually:

```text
character controller
= capability profile
+ Doctrine / values
+ Goal generation
+ arbitration
+ persistence/replanning behavior
+ execution style / Expression
+ Origin adaptation
```

Capability determines what the controller can perceive, infer, forecast, and conceive.

Doctrine and arbitration determine what the character cares about.

Expression determines how the character prefers to execute among sufficiently valid alternatives.

Origin adaptation determines how the character interprets and exploits the mechanical toolbox produced by the randomly selected allowed Origin.

### 1.5 Reuse aggressively; bespoke character logic selectively

Open Fufu must not create one implementation of every reasoning category per character.

Most information gathering, evaluation, forecasting, and domain planning should come from a modest reusable library.

Character-specific code is most justified in:

- Doctrine;
- Goal-generation exceptions;
- Plan arbitration;
- Plan persistence/reconsideration;
- sparse domain-specific Expression hooks;
- sparse Origin-adaptation hooks.

---

## 2. High-level pipeline

The accepted conceptual pipeline is:

```text
selected allowed Origin
        ↓
effective faction mechanics
        ↓
Origin trait support + combination support
        ↓
OriginStrategicProfile
        ↓
legal controller observation
        ↓
shared substrate
        ↓
reusable evaluators / forecasts
+ applicable Origin support
        ↓
Signals
        ↓
character Doctrine
        ↓
GoalGenerator
        ↓
PlanArbiter
        ↓
active strategic Goals
        ↓
reusable domain planners
+ applicable Origin planner support
        ↓
PlanCandidates
        ↓
character Expression
+ character Origin adaptation
        ↓
selected Plan
        ↓
public controller directives / commands
```

`PlanPersistencePolicy` spans the Goal/Plan lifecycle and decides when plans continue, escalate, reduce, pause, replan, or end.

This is a design decomposition, not a required class hierarchy.

---

## 3. Shared non-personality substrate

These components should normally be shared across Official AI controllers:

- **WorldIndex** — indexes factions, Segments, Contacts, structures, units, operations, and other observations;
- **GeographyAnalyzer** — reusable topology, border, connectivity, terrain, coast, and route facts;
- **MechanicsEstimator** — safe use of public mechanics calculations and effective rules;
- **HistoryTracker** — compact deterministic event/history retention in controller memory;
- **VisibilityTracker** — distinguishes current observation from stale/unknown information.

Information collection and basic state organization are specifically *not* intended to become one implementation per character.

---

## 4. Evaluators return rich bounded findings, not answers

Evaluators do not return one winner or universal utility score. They return a bounded, diverse set of structured findings using the shared `Signal` vocabulary from `OFFICIAL_AI_CONFIGURATION.md`.

`Signal.strength` expresses significance **within the evaluator's own domain**. It does not mean that the character should act on the signal.

`Signal.confidence` expresses certainty.

Evaluator pruning must preserve diversity across signal kinds rather than globally returning only the largest scores. A peaceful character must still be able to see a modest peaceful-development opportunity even when the map contains stronger aggressive opportunities that the character would reject.

### 4.1 TerritoryEvaluator

Purpose: identify geographic/territorial properties without deciding whether the character should conquer, defend, or abandon them.

**LocalTerritoryEvaluator (~D0–1)**

- sees ownership, adjacency, nearby conquerable/free land, Capacity, and obvious accessibility;
- broadly treats useful land as valuable real estate;
- does not meaningfully reason about Mountain defense, Desert economic value, Forest combat effects, chokepoints, or strategic border topology.

**OperationalTerritoryEvaluator (~D2–3)**

- understands terrain mechanics, capture difficulty, local chokepoints, movement barriers, coastlines, local exposure, infrastructure access, and armor/naval accessibility;
- may still acquire locally excellent land that creates a strategically terrible global frontier.

**StrategicGeometryEvaluator (~D4–5)**

- reasons about future border shape, number/length of fronts, salients, theater connectivity, isolation, enemy access denial, deliberate sacrifice, long-term coastline/connectivity, and dynamic topology such as Water Nukes when enabled.

### 4.2 EconomyEvaluator

**BudgetEconomyEvaluator (~D0–1)**

- current FFY/income;
- affordability;
- basic saving;
- obvious productive infrastructure.

**ReturnAwareEconomyEvaluator (~D2–3)**

- rough ROI/payback;
- construction versus upgrades;
- network value;
- economy-versus-military tradeoffs.

**StrategicEconomyEvaluator (~D4–5)**

- long-horizon opportunity cost;
- liquidity/timing;
- network compounding;
- military/economic sequencing;
- enemy economic trajectory;
- future strategic spending needs.

### 4.3 OpponentModel

**NoOpponentModel (~D0–1)**

- understands current visible state but does not meaningfully infer durable behavior.

**BehaviorHistoryModel (~D2–3)**

- remembers aggression, targeting, counter-response, withdrawal, build focus, overcommitment, and other repeated behavior;
- tends to extrapolate historical behavior simply.

**AdaptiveOpponentModel (~D4–5)**

- maintains and updates competing hypotheses;
- notices strategy shifts;
- considers how opponents may react to the AI's own actions;
- may form cautious future-capability hypotheses from legitimate evidence, with uncertainty represented explicitly rather than through omniscience.

### 4.4 ForecastEngine

Forecasting is a bounded hypothetical reasoner, not a secret authoritative future simulator.

**ImmediateConsequenceEstimator (~D0–1)** — one direct consequence layer.

**ShortHorizonForecaster (~D2–3)** — several likely near-term consequences, usually following the most obvious continuation.

**ScenarioForecaster (~D4–5)** — several plausible response/future branches, including opponent and third-party reactions.

### 4.5 ThreatEvaluator

Purpose: identify plausible developments that can materially harm the faction. It does not decide how frightened the character should be or which response to choose.

**ImmediateThreatEvaluator (~D0–1)**

- active/incoming attacks;
- hostile units or strategic effects presenting actual current/near-immediate danger;
- obvious local force crises.

Mere theoretical exposure is insufficient. An exposed Factory, for example, becomes an immediate threat only when a manifested hostile force/operation can actually endanger it in the immediate horizon.

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

### 4.6 OpportunityEvaluator

Purpose: surface exploitable or constructive opportunities without deciding which are personally desirable.

It must surface peaceful/developmental opportunities as well as aggressive opportunities when both exist.

**ObviousOpportunityEvaluator (~D0–1)**

- free nearby expansion;
- obvious affordable development;
- obviously weak current hostile targets;
- clearly undefended immediate targets;
- obvious defensive improvements.

**OperationalOpportunityEvaluator (~D2–3)**

- distracted opponents;
- favorable frontage/local superiority;
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
- deliberate overextension traps and other long-horizon positional openings.

---

## 5. Character-sensitive strategic layer

### 5.1 Doctrine

Doctrine answers:

> What does this character fundamentally value, dislike, permit, require, or forbid?

It interprets signals in character terms and may veto behavior, strongly prioritize other behavior, distinguish retaliation from opportunistic aggression, or express values such as preservation, leverage, safety, spectacle, patience, efficiency, etc.

Doctrine does not choose exact cells, attack widths, structure locations, or unit paths.

### 5.2 GoalGenerator

GoalGenerator turns Signals + Doctrine + current Goals/Plans into multiple candidate strategic objectives.

It must allow **no new goal / continue current plan** as a valid outcome.

Shared Goal recipes are preferred. Character-specific Goal rules are appropriate when the character genuinely interprets circumstances differently.

### 5.3 PlanArbiter

PlanArbiter decides which candidate Goals receive strategic attention/resources now.

It is one of the primary personality surfaces.

Lower-capability arbiters may use relatively fixed hierarchies and handle few simultaneous concerns. Higher-capability arbiters may coordinate several objectives, preserve reserves, reason about opportunity cost, make deliberate sacrifices, and manage dependencies/contingencies.

### 5.4 PlanPersistencePolicy

PlanPersistencePolicy governs when an active plan continues, escalates, reduces, pauses, resumes, replans, succeeds, or is abandoned.

This is where character-visible patience, stubbornness, sunk-cost behavior, opportunistic switching, de-escalation, and long-horizon commitment belong.

A capable controller may retain a high-level Goal while discarding and replacing a failed subordinate Plan.

---

## 6. Expression — explicit authored personality in execution

Doctrine explains **what/why** a character wants something. That alone is insufficient for visible personality.

`ExpressionProfile` answers:

> When several sufficiently valid solutions exist, what kind of solution feels like this character?

Domain planners first generate viable candidates. Expression then prefers among those candidates within the configured quality leeway.

Capability determines what solutions can be conceived. Expression cannot invent a brilliant strategy that the selected planner is incapable of producing.

Most Expression preferences should use reusable `SolutionTrait` motifs from `OFFICIAL_AI_CONFIGURATION.md`.

Sparse bespoke character hooks are explicitly allowed where abstraction would be fake or wasteful—for example, a Yui infrastructure hook may propose a heart-like rail layout, after which the ordinary InfrastructurePlanner still evaluates whether that layout is viable and sufficiently functional.

Expression may create natural character weaknesses. It may not bypass legality or deliberately resurrect non-viable plans.

---

## 7. Reusable domain planners

Domain planner variants primarily encode **reasoning sophistication**, not rigid personality styles.

A competent LandWarPlanner should be able to choose broad pressure or concentration depending on circumstance; those are candidate strategies, not separate planner classes.

Accepted planner families:

- **ExpansionPlanner** — `NEAREST` / `TERRAIN_AWARE` / `STRATEGIC`;
- **LandWarPlanner** — `DIRECT` / `OPERATIONAL` / `MULTI_FRONT_STRATEGIC`;
- **DefensePlanner** — `EVEN` / `VALUE_AWARE` / `PREDICTIVE`;
- **CounterResponsePlanner** — `SIMPLE` / `EXCHANGE_AWARE` / `STRATEGIC`;
- **RetreatPlanner** — `EMERGENCY` / `DEFENSIBLE` / `STRATEGIC_SACRIFICE`;
- **SpendingPlanner** — `BASIC` / `PRIORITY` / `OPPORTUNITY_COST`;
- **InfrastructurePlanner** — `USEFUL` / `NETWORK_AWARE` / `STRATEGIC_OPTIMIZER`;
- **UpgradePlanner** — `AFFORDABLE` / `VALUE` / `STRATEGIC_TIMING`;
- **ArmorPlanner** — `LOCAL` / `OPERATIONAL` / `STRATEGIC`;
- **NavalPlanner** — `LOCAL` / `SEA_CONTROL` / `STRATEGIC`;
- **AmphibiousPlanner** — `BASIC` / `OPPORTUNITY` / `STRATEGIC`;
- **StrategicWeaponPlanner** — `OBVIOUS_TARGET` / `OPERATIONAL` / `STRATEGIC`;
- **ObservationPlanner** — `COVERAGE` / `THREAT_FOCUSED` / `STRATEGIC_INFORMATION`;
- **TeamCoordinator** — `BASIC` / `OBJECTIVE` / `STRATEGIC`;
- **SpawnPlanner** — `SAFE` / `TERRAIN_AWARE` / `STRATEGIC`;
- **SpawnReconsiderer** — `STATIC` / `THREAT_AWARE` / `ADVERSARIAL`.

These tiers are guidance, not difficulty locks. Character capability profiles may be uneven.

---

## 8. Origin selection and adaptation boundary

Each character preset owns a curated set of allowed Official Origins.

After human controller/Origin/Echo choices lock, the match seed selects **uniformly at random** from the allowed set before Strategic Spawn.

There are no per-Origin weights, map-conditioned selection rules, or character-controller Origin-selection logic.

The selected Origin is revealed normally before Strategic Spawn.

The character must then use every Origin in its allowed pool coherently.

The generic support/adaptation architecture is canonical in `OFFICIAL_AI_ORIGIN_SUPPORT.md`. Its central rule is:

> **Origin Trait Support teaches strategic literacy; character Origin Adaptation decides what that character does with the literacy.**

Origin support may explain mechanics, strategic themes, affordances, cautions, synergy, evaluator implications, and planner requirements. It must not replace the character's Doctrine, Arbiter, Persistence, or Expression identity.

Character Origin adaptation may interpret the same Origin differently, but it cannot alter the Origin's mechanics, bypass legality, or grant reasoning sophistication beyond the selected evaluator/planner capability.

---

## 9. Unsupported/non-V1 AI domains

Do not invent major AI component families for mechanics that V1 does not support.

Not currently separate V1 controller domains:

- rich treaty/diplomatic negotiation;
- supply/logistics systems that do not exist;
- manual passive-defender quantity allocation;
- frame-by-frame RTS micro;
- privileged Train/Trade-Ship route micromanagement where routing is simulation-owned;
- hidden-information oracle reasoning.

---

## 10. Benchmark architecture

Capability and thematic fidelity are separate measurements.

### 10.1 Capability benchmark

Question:

> How strong is this controller at winning?

Use deterministic batches across varied maps, seeds, Origins, opponents, and eventually teams/FFA.

Relevant metrics may include win rate/rating, survival/placement, economy/territorial efficiency, and performance by map/Origin/opponent style.

Difficulty is an authored target; measured results drive tuning toward that target.

### 10.2 Thematic/fidelity benchmark

Question:

> Does this implementation behave like the authored character fantasy?

This is preset-specific and independent of capability.

A strong controller may be a poor characterization; a recognizably characterful controller may still be strategically weak.

Fidelity expectations and character-specific checks are defined through `FidelityProfile` in `OFFICIAL_AI_CONFIGURATION.md`.

Never collapse capability and fidelity into one score.

### 10.3 Origin-support correctness

Origin support receives a third, distinct correctness test category:

> Does the controller understand the mechanical toolbox it rolled well enough to operate it coherently at its authored capability level?

This tests transformed mechanics, planner legality, spawn behavior, and Origin-specific candidate generation. It is neither a capability rating nor a character-fidelity score.

---

## 11. Difficulty interface

Character presets use Difficulty `1..5`; Baseline AI uses Difficulty `0`.

The preset roster owns the bound difficulty values and competence targets in [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md). Difficulty is versioned preset metadata consumed by benchmarking and by other systems.

Echo reward accounting may consume that bound difficulty, but **all reward arithmetic is owned exclusively by [`../ECHO_CATALOGUE.md`](../ECHO_CATALOGUE.md)**. This architecture does not restate or redefine the conversion formula.

---

## 12. Content-authoring sequence

The generic Official-AI architecture and configuration language are closed enough for content mapping.

Canonical content completion proceeds in this order:

1. define every deployed Origin trait's AI support configuration;
2. define Origin-level composed/special combination support where trait composition requires it;
3. define the Difficulty-0 Baseline AI and every character's concrete `CharacterProfile`, including Origin adaptation;
4. benchmark capability, thematic fidelity, and Origin-support correctness separately;
5. perform a repository-wide stale/contradiction audit before merging the completed design batch.

For reviewability, trait, Origin, and character content should be authored in **batches of ten** with a consistency check between batches.

The batch boundary is organizational only; canonical behavior remains determined by the final versioned configuration.
