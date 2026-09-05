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
Character profiles:    10 / 20 complete
Remaining characters:  10
```

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

This is not random stupidity or a flat retaliation scalar. It is a hard target-eligibility distinction plus persistent historical memory and strong de-escalation after settlement.

Across Origins, Thorfinn prioritizes Population/force preservation, defensible growth, efficient retaliation, and territorial trades that save people. Transformative aggressive mechanics remain usable against legal aggressor targets but do not bypass the innocent-target prohibition.

**Identity test:** peaceful expansion and defense by default; ferocious but bounded retaliation when attacked; no innocent wars.

## Askeladd

Askeladd is a strategic predator rather than a generic aggressive controller. His adaptive opponent model looks for distraction, dependency, weak infrastructure, exposed geography, and situations where the opponent can be manipulated into a worse exchange.

His bespoke rules deliberately permit territorial/resource sacrifice when it creates leverage. Retreat is not failure if it opens a better attack, isolates an asset, diverts the opponent, or preserves the ability to strike somewhere weaker.

Across Origins he preferentially converts raiding, information denial, conquest economy, piracy, and sacrificial mechanics into asymmetric pressure. A strong Origin does not make him seek an honorable head-on contest when a cheaper exploit exists.

**Identity test:** manipulate and exploit the strategic contest; attack weakness rather than prove strength.

## Reinhard von Lohengramm

Reinhard is the D5 global-expansion benchmark. He evaluates local actions through their effect on global position, access, economic scaling, multiple theaters, and the path to decisive superiority.

`REINHARD_GLOBAL_CAMPAIGN_MODEL` and the portfolio hooks permit coordinated parent objectives with dependent theater Goals. He can abandon a locally winning plan if another campaign materially improves the global route to supremacy.

Origin adaptation asks how the rolled toolbox accelerates positional dominance: infrastructure becomes the base for expansion, distributed starts become theater access, conquest mechanics become campaign momentum, and specialist force mechanics become tools for decisive overmatch.

**Identity test:** several-front global optimization whose end state is strategic supremacy, not isolated tactical brilliance.

## Yang Wen-li

Yang uses D5 cognition for almost the opposite strategic objective. He minimizes unnecessary wars, preserves future options, values retreat and territorial sacrifice when they improve geometry, and actively looks for opponent overextension.

His counteroffensive rules should create the characteristic sequence:

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

Low visible urgency must not mean inactivity: Background and Secondary preparation Goals should continue building future advantage while immediate pressure remains modest.

When the preparation/advantage case matures, her controller should switch cleanly from patient accumulation to decisive execution rather than continuing to wait forever.

Origins with long setup, compounding infrastructure, information, standoff force, or strategic weapons are therefore especially natural, but she still uses any allowed Origin through the generic support layer.

**Identity test:** patient enough to wait when time helps her, decisive enough to end the matter when preparation is complete.

## Übel

Übel is a D4 controller with intentionally unusual **risk interpretation**. She has strong strategic opportunity recognition but accepts high-upside lines that another expert controller may discard as too strange, exposed, indirect, or fragile.

The bespoke opportunity and Expression hooks may widen the set of planner-near-best candidates she will actually choose, especially for breakthroughs, deception, surprise landings, topology attacks, sacrificial lines, and other unconventional openings.

This is not literal randomness. Plans must still be legal, viable, generated by her actual planner tiers, and supported by observed state. Her distinction is willingness to trust a dangerous but coherent opening.

**Identity test:** frightening intuition and ruthless exploitation, not incompetent recklessness.

## Tanya Degurechaff

Tanya is an expected-value military optimizer. Her ruthlessness is expressed through willingness to spend lives/resources when the forecast justifies it, while pointless waste and spectacle are explicitly rejected.

Her custom model emphasizes force concentration, timing, artillery/standoff mechanics, strategic weapons, preparation, opportunity cost, and cancellation of operations whose expected return has collapsed. Sunk cost alone is not a reason to continue.

Origin adaptation strongly values breakthrough creation and military efficiency while respecting transformed-unit cautions such as reload, mobility, expensive failure, and counterattack windows.

**Identity test:** ruthless because she calculates, not because she enjoys waste.

## Kiss-Shot Acerola-Orion Heart-Under-Blade

Kiss-Shot is a D3 dominance/snowball controller. She prefers conspicuous overwhelming commitments and presses an advantage harder than a cautious peer, but she is not given D4/D5 global optimization simply because her preferred solutions are powerful.

Her most distinctive resource behavior is around elite/irreplaceable assets. Origins that create one flagship, veteran centerpiece, or other uniquely valuable force receive strong preservation treatment even while ordinary resources remain expendable in pursuit of dominance.

**Identity test:** extravagant overwhelming strength with surprising care for the singular asset embodying that strength.

## Hanekawa Tsubasa

Hanekawa is an information-first D4 analyst. `HANEKAWA_ANALYTICAL_STATE_SYNTHESIS` treats new observed evidence as a reason to update opponent/state interpretation rather than cling to a previously elegant theory.

Her controller values observation, counterintelligence, efficient infrastructure, broad preparation, low-casualty solutions, and clean responses. Risky commitments should normally follow adequate information rather than precede it.

This separates her from Frieren: Frieren's signature is patience across time; Hanekawa's signature is active acquisition and synthesis of information.

**Identity test:** understand the situation, update when evidence changes, then choose the efficient response.

## Kaiki Deishuu

Kaiki is an economy/opportunism specialist whose core question is whether the conflict is **worth paying for**.

His profitability model prefers weak/exposed targets, deception, indirect operations, piracy/raiding, liquidity, and wars whose gains fund or exceed their costs. He disengages readily when the expected margin disappears.

This intentionally separates him from Askeladd. Askeladd sacrifices and manipulates to win a larger strategic contest; Kaiki manipulates so he does not have to pay the full price of that contest in the first place.

Origins are valued chiefly for profitable economy, trade, cheap asymmetric pressure, information advantage, and preservation of expensive resources.

**Identity test:** never fight fairly when a cheaper profitable arrangement exists.

---

## First-batch consistency result

The first ten profiles use the already-closed gameplay mechanics, Origin trait support, named-Origin configurations, and generic character architecture without requiring a new gameplay mechanic, Origin trait, named Origin, shared AI literal, or Origin-support rule.

No first-batch character currently requires a `CharacterTraitOverride` or `CharacterOriginOverride`; broad `OriginAdaptationProfile` preferences plus character-owned hooks are sufficient. This is desirable and should remain the default unless a later character exposes a genuinely irreducible interaction.

The first ten remain deliberately differentiated even where capability tiers overlap:

- Reinhard vs Yang — global supremacy vs option-preserving defensive genius;
- Askeladd vs Kaiki — strategic predation vs profitable avoidance;
- Frieren vs Hanekawa — time/accumulation vs information/adaptation;
- Übel vs Tanya — high-upside intuition vs quantified expected-value warfare.

The next ten must preserve the same capability/personality separation rather than using difficulty as personality.
