# Open Fufu — Official AI Character Configuration Rationale

## Status and authority

This document is the single canonical **rationale/behavioral-intent companion** for Baseline and character `CharacterProfile` configuration.

Exact code-readable mappings live only in:

```text
design/official-ai/character-configurations.config.ts
```

That configuration file is authoritative for exact evaluator/planner tiers, Doctrine mappings, GoalGenerator rules, Arbiter settings, Persistence, Expression, Origin adaptation, Fidelity expectations, and registered bespoke rule/hook IDs.

Neighboring authorities remain separate:

- `OFFICIAL_AI_PRESETS.md` — roster, difficulty, allowed-Origin pools, rewards;
- `OFFICIAL_AI_CONFIGURATION.md` — generic `CharacterProfile` contract and shared vocabularies;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` — generic Origin-support/adaptation contract;
- `OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md` — named-Origin strategic rationale;
- `OFFICIAL_AI_TRAIT_SUPPORT.md` — trait-support rationale;
- gameplay/rules documents — actual mechanics and numerical rules.

This rationale explains character intent and bespoke hook semantics. It must not become a duplicate table of exact configuration values.

## Progress

```text
Difficulty-0 Baseline: complete
Character profiles:    20 / 20 complete
Remaining characters:   0
```

The first full character-profile pass is closed. A separate fastfire **character-quirk/signature-move review** remains intentionally open; it may add sparse character-owned Expression/Goal/Arbiter hooks where those quirks materially improve identity, but must not reopen mechanics or Origin support without a real cross-layer reason.

---

## Difficulty-0 Baseline

Baseline is deliberately **not a character**. It exercises the complete ordinary game surface through low-tier evaluators/planners, simple arbitration, reactive persistence, strict planner-best Expression, and generic Origin literacy with no authored Origin preferences.

Its purpose is to establish the minimum coherent controller and benchmark floor, not to exhibit personality.

---

# First 10 character profiles

## Thorfinn Karlsefni

Thorfinn's defining rule is stronger than generic pacifism: **voluntary hostility against an innocent faction is forbidden**.

`THORFINN_AGGRESSOR_MEMORY` maintains a match-lifetime set of remembered aggressor faction IDs. A faction enters this set when it directly attacks Thorfinn or attacks one of Thorfinn's teammates while that teammate relationship exists. Once entered, the faction remains historically classified as an aggressor for the rest of the match even if active conflict later settles.

That memory changes eligibility, not automatic behavior:

- a faction that has never qualified as an aggressor may not be the target of a voluntary hostility-initiating Goal/Plan;
- an active aggressor may generate strong defense/repel/retaliation Goals;
- after a conflict settles, Thorfinn strongly prefers continued peace and ordinary retaliation Goals decay;
- a remembered aggressor may exceptionally become eligible for later renewed hostility through `THORFINN_RARE_REMEMBERED_AGGRESSOR_REENGAGEMENT`, but this path is deliberately rare, strategically gated, and never applies to an innocent faction;
- an ally's historical aggressor counts because the original aggression against the ally is itself remembered; the ally does not need to remain under immediate attack forever.

Across Origins, Thorfinn prioritizes Population/force preservation, defensible growth, efficient retaliation, and territorial trades that save people. Transformative aggressive mechanics remain usable against legal aggressor targets but do not bypass the innocent-target prohibition.

**Identity test:** peaceful expansion and defense by default; ferocious but bounded retaliation when attacked; no innocent wars.

## Askeladd

Askeladd is a strategic predator rather than a generic aggressive controller. His adaptive opponent model looks for distraction, dependency, weak infrastructure, exposed geography, and situations where the opponent can be manipulated into a worse exchange.

His bespoke rules deliberately permit territorial/resource sacrifice when it creates leverage. Retreat is not failure if it opens a better attack, isolates an asset, diverts the opponent, or preserves the ability to strike somewhere weaker.

Across Origins he preferentially converts raiding, information denial, conquest economy, piracy, and sacrificial mechanics into asymmetric pressure. A strong Origin does not make him seek an honorable head-on contest when a cheaper exploit exists.

**Identity test:** manipulate and exploit the strategic contest; attack weakness rather than prove strength.

## Reinhard von Lohengramm

Reinhard is the D5 global-expansion benchmark. He evaluates local actions through their effect on global position, access, economic scaling, multiple theaters, and the path to decisive superiority.

His campaign/portfolio hooks permit coordinated parent objectives with dependent theater Goals. He can abandon a locally winning plan if another campaign materially improves the global route to supremacy.

Origin adaptation asks how the rolled toolbox accelerates positional dominance: infrastructure becomes the base for expansion, distributed starts become theater access, conquest mechanics become campaign momentum, and specialist force mechanics become tools for decisive overmatch.

**Identity test:** several-front global optimization whose end state is strategic supremacy, not isolated tactical brilliance.

## Yang Wen-li

Yang uses D5 cognition for almost the opposite strategic objective. He minimizes unnecessary wars, preserves future options, values retreat and territorial sacrifice when they improve geometry, and actively looks for opponent overextension.

His characteristic sequence is:

```text
avoid unnecessary commitment
→ preserve options / defensible geometry
→ opponent overextends or creates a forcing vulnerability
→ concentrated efficient counterattack
→ stop when the strategic reason for continued war disappears
```

Origins are interpreted through preservation, defensive geometry, information, efficient response, and option value rather than as invitations to conquer merely because a mechanic is powerful.

**Identity test:** extraordinarily capable at winning wars he would prefer not to have needed.

## Frieren

Frieren is defined primarily by **time preference**, not merely intelligence. Her controller is unusually willing to defer marginal immediate value in exchange for preparation, infrastructure, knowledge, accumulated resources, and a much stronger later commitment.

Low visible urgency must not mean inactivity: Background and Secondary preparation Goals should continue building future advantage while immediate pressure remains modest. When the preparation/advantage case matures, her controller should switch cleanly from patient accumulation to decisive execution rather than continuing to wait forever.

**Identity test:** patient enough to wait when time helps her, decisive enough to end the matter when preparation is complete.

## Übel

Übel is a D4 controller with intentionally unusual **risk interpretation**. She has strong strategic opportunity recognition but accepts high-upside lines that another expert controller may discard as too strange, exposed, indirect, or fragile.

This is not literal randomness. Plans must still be legal, viable, generated by her actual planner tiers, and supported by observed state. Her distinction is willingness to trust a dangerous but coherent opening.

**Identity test:** frightening intuition and ruthless exploitation, not incompetent recklessness.

## Tanya Degurechaff

Tanya is an expected-value military optimizer. Her ruthlessness is expressed through willingness to spend lives/resources when the forecast justifies it, while pointless waste and spectacle are explicitly rejected.

Her custom model emphasizes force concentration, timing, artillery/standoff mechanics, strategic weapons, preparation, opportunity cost, and cancellation of operations whose expected return has collapsed. Sunk cost alone is not a reason to continue.

**Identity test:** ruthless because she calculates, not because she enjoys waste.

## Kiss-Shot Acerola-Orion Heart-Under-Blade

Kiss-Shot is a D3 dominance/snowball controller. She prefers conspicuous overwhelming commitments and presses an advantage harder than a cautious peer, but she is not given D4/D5 global optimization simply because her preferred solutions are powerful.

Her most distinctive resource behavior is around elite/irreplaceable assets. Origins that create one flagship, veteran centerpiece, or other uniquely valuable force receive strong preservation treatment even while ordinary resources remain expendable in pursuit of dominance.

**Identity test:** extravagant overwhelming strength with surprising care for the singular asset embodying that strength.

## Hanekawa Tsubasa

Hanekawa is an information-first D4 analyst. New observed evidence is a reason to update opponent/state interpretation rather than cling to a previously elegant theory.

Her controller values observation, counterintelligence, efficient infrastructure, broad preparation, low-casualty solutions, and clean responses. Risky commitments should normally follow adequate information rather than precede it.

This separates her from Frieren: Frieren's signature is patience across time; Hanekawa's signature is active acquisition and synthesis of information.

**Identity test:** understand the situation, update when evidence changes, then choose the efficient response.

## Kaiki Deishuu

Kaiki is an economy/opportunism specialist whose core question is whether the conflict is **worth paying for**.

His profitability model prefers weak/exposed targets, deception, indirect operations, piracy/raiding, liquidity, and wars whose gains fund or exceed their costs. He disengages readily when the expected margin disappears.

This intentionally separates him from Askeladd. Askeladd sacrifices and manipulates to win a larger strategic contest; Kaiki manipulates so he does not have to pay the full price of that contest in the first place.

**Identity test:** never fight fairly when a cheaper profitable arrangement exists.

---

# Characters 11–20

## Misaka Mikoto

Misaka is a direct, competent D3 problem-solver. She likes concentrated force, useful infrastructure, ranged pressure, defensive/interception coverage, and clear counterpressure. She is intentionally less interested in deception or complicated strategic theater than controllers such as Askeladd, Reze, or the D5s.

**Identity test:** understand the immediate strategic problem and hit it with a clean, forceful, technically sensible answer.

## Edward Wong Hau Pepelu Tivrusky IV

Ed's unpredictability comes from **curiosity and unusual preferences**, never random action selection. Ed values strange but useful geography, distributed positions, information, unconventional infrastructure, and opportunities that other D2 controllers may simply not find interesting.

The controller may switch attention relatively readily when a genuinely novel legal opportunity appears, but every action must still be viable and planner-generated.

**Identity test:** weird and exploratory without ever becoming dice-driven stupidity.

## Shaula

Shaula is a long-range guardian built around a **designated protected core**. Once a strategically sensible core is chosen, threats to it gain exceptional priority and she becomes unusually unwilling to abandon it.

Her first authored signature-move family is the **tower layout**. When SAM access, map geometry, cost, and tactical viability permit, `SHAULA_TOWER_PATTERN_CANDIDATES` should generate recognizable protected-core candidates such as:

```text
SAM  --------  CITY / CORE  --------  SAM
```

or a compact three-SAM line/tower interpretation where that is mechanically legal and preferable for the selected Origin. The exact geometry is a candidate family rather than a forced literal blueprint: terrain, legal placement, actual SAM coverage, and the selected Origin's limits remain authoritative.

`SHAULA_PROTECTED_CORE_RING_LAYOUT` then prefers other useful infrastructure toward the useful exterior/periphery of the resulting SAM-protected area rather than cluttering or destroying the readable central tower pattern. This is not permission to make economically or tactically worthless placements merely to draw a picture.

The designated core is the territory she will commit extraordinary resources to defend. “Die to protect” means her Arbiter/Persistence may escalate to unusually high commitment when the core is genuinely threatened; it does not bypass legality or make already-hopeless actions viable.

**Identity test:** a recognizable long-range protected tower/core that she treats as sacred ground.

## Hirasawa Yui

Yui is intentionally simple D1 cognition with high expressive personality. She likes comfortable growth, support, coherent infrastructure, symmetry, and low urgency.

Her existing **heart-layout** idea is canonical as a signature candidate family. `YUI_HEART_INFRASTRUCTURE_CANDIDATES` / `YUI_HEART_RAIL_SIGNATURE` may propose heart-like rail/infrastructure geometry when it remains within her broad Expression leeway and is still a genuinely viable network.

The heart shape never makes illegal, disconnected, or catastrophically inefficient infrastructure acceptable.

**Identity test:** low-complexity friendly play whose infrastructure sometimes becomes visibly and recognizably Yui's.

## Saitama

Saitama's low complexity must not be confused with timid or evenly matched combat. He does not need elaborate five-stage operational art to express the One Punch fantasy.

The intended attack pattern is:

```text
problem does not matter → low urgency
problem matters enough to attack → choose a simple viable solution
                              → commit overwhelming concentrated force
                              → finish the problem quickly
```

`SAITAMA_ONE_PUNCH_COMMITMENT` therefore strongly favors disproportionate force when he has decided to attack. He does not “seek fair fights”; fairness is simply irrelevant. The signature is that **when he attacks, he ATTACKS**.

**Identity test:** strategically simple, operationally decisive, disproportionately forceful once engaged.

## Ferdinand

Ferdinand is the D5 system/infrastructure optimizer. His objective is not Reinhard-style conquest for supremacy but the elimination of waste and the creation of a tightly optimized machine: infrastructure sequence, compounding returns, resource bottlenecks, timing, network shape, and opportunity cost all matter.

He should willingly replan when the system's true optimum changes and reject sunk-cost reasoning.

**Identity test:** if two strategies reach similar outcomes, Ferdinand's should look engineered.

## Power

Power is coherent D2 recklessness: greed, spectacle, bravado, visible gains, and violent overcommitment. She tolerates overextension and expensive failure far more readily than a sensible peer and may double down after a conspicuous commitment.

This still does not permit random actions. Her recklessness must be explainable by a real opportunity, dominance display, greed motive, or aggressive plan generated within D2 capability.

**Identity test:** the plan makes enough sense to exist, then Power makes it much louder and less cautious than necessary.

## Reze

Reze has a two-phase strategic rhythm: concealed/indirect approach followed by abrupt violent escalation when an attack window appears. Her amphibious specialization is intentionally above the rest of her general D3 planner set because infiltration and second-front attacks are core identity rather than general intelligence inflation.

**Identity test:** quiet positioning first; sudden breakthrough, landing, or strike second.

## Hitori Gotou

Bocchi maximizes safety far beyond an ordinary D2 controller, but not beyond usefulness. Her signature defensive behavior is to prefer **dense sensible Fort coverage along vulnerable territorial edges**, creating a fortified perimeter because exposed borders make her uncomfortable.

`BOCCHI_PERIMETER_FORT_SIGNATURE` may therefore keep considering useful edge Fort placements after a normal controller would consider its defense “good enough,” provided the placements actually protect vulnerable frontage, structures, or likely attack routes. It must never build Forts in strategically useless locations merely to satisfy the quirk.

Her second behavioral signature is a pressure-triggered panic spike: severe immediate danger can temporarily flip her from extreme avoidance into unusually committed response. This is event-driven, not random volatility.

**Identity test:** visibly over-secured borders, extreme avoidance, and occasional pressure-induced panic commitment.

## Maomao

Maomao is a D4 **causal-mechanics diagnostician**. Where Hanekawa synthesizes the broad information picture, Maomao tries to determine what specific rule, terrain interaction, status effect, resource mechanism, or opponent behavior is actually producing the observed result.

Her controller may form low-cost test actions, update its hypothesis from outcomes, then exploit the confirmed mechanism through terrain, Fallout/status geometry, denial, or targeted response.

**Identity test:** diagnose the mechanism causing the problem, verify it, then exploit the mechanism rather than merely react to the surface symptom.

---

## Signature moves and quirks — current architectural rule

The Shaula, Yui, Saitama, and Bocchi additions confirm that a separate generic “signature-move engine” is not currently necessary.

Character signatures should first use the existing character-owned surfaces:

```text
Expression SIGNATURE preferences
+ bespoke Expression candidate augmentation/ranking hooks
+ character Goal/Arbiter/Persistence hooks where the quirk changes strategic commitment
```

A signature move may generate or prefer unusual **legal viable candidates**. It may not:

- create mechanics or structures the selected Origin does not possess;
- bypass resource/placement/action legality;
- resurrect non-viable candidates;
- grant a low-difficulty character reasoning sophistication it otherwise lacks;
- force cosmetic geometry when it is strategically catastrophic.

This is the default for the upcoming 20-character fastfire quirk pass. A new shared subsystem should be added only if that pass exposes a recurring need the existing Expression/character-hook architecture genuinely cannot represent.

---

## Full character-pass consistency result

All 20 character profiles use the already-closed gameplay mechanics, Origin trait support, named-Origin configurations, and generic character architecture without requiring a new gameplay mechanic, Origin trait, named Origin, shared AI literal, or Origin-support rule.

No current character requires a `CharacterTraitOverride` or `CharacterOriginOverride`; broad `OriginAdaptationProfile` preferences plus character-owned hooks remain sufficient.

The principal intentional contrasts include:

- Reinhard vs Yang — global supremacy vs option-preserving defensive genius;
- Askeladd vs Kaiki — strategic predation vs profitable avoidance;
- Frieren vs Hanekawa — time/accumulation vs information/adaptation;
- Übel vs Tanya — high-upside intuition vs quantified expected-value warfare;
- Hanekawa vs Maomao — broad information synthesis vs causal-mechanics diagnosis;
- Power vs Saitama — loud reckless overcommitment vs simple deliberate overwhelming force;
- Shaula vs Bocchi — sacred-core obsessive defense vs generalized perimeter safety.

The next character-design step is the intentionally lightweight **quirk/signature-move pass across all 20 characters**, followed by the character × allowed-Origin validation/benchmark phase.
