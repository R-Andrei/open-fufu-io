# Open Fufu — Official AI Trait Support Catalogue

## Status and authority

This document is the canonical content catalogue for concrete Official-AI support mappings for Origin traits.

It is subordinate to:

- `ORIGIN_TRAIT_CATALOGUE.md` for the actual Origin trait mechanics;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` for the generic support vocabulary, composition rules, hook boundaries, and character-adaptation architecture;
- `OFFICIAL_AI_CONFIGURATION.md` for the shared AI signal/goal/planner/profile vocabulary.

Nothing in this document changes Origin mechanics. Numeric mechanical truth remains in the authoritative game/rules documents and final effective rules. This file records only AI strategic-support metadata and hook requirements.

The catalogue is being authored in canonical trait-ID order in review batches of ten. A later global synergy sweep must review all traits together before the trait-support phase is considered complete.

---

## Progress

```text
Configured traits: 10 / 72
Current range:      P01–P10
Remaining:          P11–P54, N01–N18
```

No explicit `OriginCombinationSupport` entries are closed yet. Potential cross-trait interactions are intentionally deferred to the global synergy sweep after all individual trait mappings exist.

---

# P01 — Domain Expansion

Canonical mechanic: `+15% Initial Territory`.

```ts
{
  traitId: "P01",
  mode: "GENERIC",

  themes: [
    "EXPANSION",
    "POSITIONAL_CONTROL",
  ],

  affordances: [],
  cautions: [],

  synergyTags: [
    "INITIAL_TERRITORY",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P01 changes the actual starting footprint size but does not create a new action form or transformed mechanic. Strategic Spawn must evaluate the faction's real final Initial Territory footprint rather than assuming the ordinary baseline size.

Do not attach `MULTI_THEATER_ACCESS`: a 15% larger footprint does not inherently create another theater. Do not attach `OVEREXTENSION_RISK` merely because a larger footprint can sometimes expose more border; any such exposure is map-dependent and should be discovered by ordinary geography/territory reasoning.

Strategic philosophy: **begin with more geography and exploit the positional head start.**

---

# P02 — The Era of Humans

Canonical mechanic: replace the ordinary Population-utilization growth profile with the accepted widened `30–70%` maximum-efficiency band while retaining the ordinary underlying growth equation and zero-growth handling at full Capacity.

```ts
{
  traitId: "P02",
  mode: "GENERIC",

  themes: [
    "GROWTH",
    "ECONOMIC_COMPOUNDING",
    "FORCE_PRESERVATION",
  ],

  affordances: [
    "SCALE_GROWTH",
  ],

  cautions: [],

  synergyTags: [
    "POPULATION_GROWTH",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P02 makes Population recovery and sustained demographic efficiency unusually forgiving across a broad utilization range. `FORCE_PRESERVATION` reflects the increased long-term strategic value of keeping Population/Capacity in a healthy recoverable state; it does not mean Population expenditure is forbidden or intrinsically bad.

No bespoke support hook is required. Economy/forecast reasoning must use the faction's actual effective growth function when forecasting Population expenditure, recovery, Capacity gains/losses, and waiting time.

Strategic philosophy: **a wider demographic sweet spot rewards sustained growth and recoverable Population management.**

---

# P03 — Imagine Breaker

Canonical mechanic: ignore enemy Fort defensive-pressure bonuses.

```ts
{
  traitId: "P03",
  mode: "GENERIC",

  themes: [
    "SIEGE",
    "DECISIVE_FORCE",
  ],

  affordances: [
    "SIEGE_STATIC_POSITIONS",
    "CREATE_BREAKTHROUGH",
  ],

  cautions: [],

  synergyTags: [
    "OFFENSE",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P03 means Fort-supported positions are materially less capable of dictating attack geometry against this faction. It does not itself mean the AI should attack Forts; Doctrine/arbitration still decide whether a war or target is desirable.

No bespoke hook is required because ordinary LandWar/Territory/Opportunity reasoning should already consume actual effective offensive/defensive pressure.

Strategic philosophy: **enemy static Fort pressure is less able to constrain where the faction can attack.**

---

# P04 — Level 0

Canonical mechanic: response-side counter-response effectiveness is fixed at `1.0`, ignoring the normal response-side numerical-imbalance bonus/penalty. The attack-side calculation and base exchange volume remain ordinary.

```ts
{
  traitId: "P04",
  mode: "GENERIC",

  themes: [
    "ATTRITION",
    "FORCE_PRESERVATION",
  ],

  affordances: [
    "RETALIATE_EFFICIENTLY",
    "PRESERVE_FORCE",
  ],

  cautions: [],

  synergyTags: [
    "COUNTER_RESPONSE",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P04 is particularly valuable when using relatively small counter-responses against larger attacks because the response side no longer receives the ordinary disadvantage penalty. Conversely, massively overcommitting a response no longer earns the ordinary response-side imbalance bonus.

The existing CounterResponsePlanner should obtain the actual exchange behavior through public mechanics calculations and decide the appropriate Population commitment. No P04-specific planner is needed.

Strategic philosophy: **counter effectively without needing numerical overcommitment to win the response-side efficiency curve.**

The lost benefit from response-side numerical overmatch is real but does not cleanly map to an existing canonical `StrategicCaution`; it remains visible through actual mechanics estimation rather than receiving a misleading caution literal.

---

# P05 — Big Shot

Canonical mechanic: capturing enemy structures generates military/conquest FFY events. Ordinary structure capture does not otherwise inherently award FFY; payout uses the canonical structure-capture FFY rule from the economy contract.

```ts
{
  traitId: "P05",
  mode: "EXTENDED",

  themes: [
    "RAIDING",
    "EXPANSION",
    "ECONOMIC_COMPOUNDING",
  ],

  affordances: [
    "RAID_INFRASTRUCTURE",
  ],

  cautions: [],

  synergyTags: [
    "ECONOMY",
    "OFFENSE",
  ],

  signalSupport: [
    {
      evaluator: "OPPORTUNITY",
      hookId: "P05_STRUCTURE_CAPTURE_OPPORTUNITY",
    },
    {
      evaluator: "FORECAST",
      hookId: "P05_STRUCTURE_CAPTURE_FFY_FORECAST",
    },
  ],

  plannerSupport: [
    {
      domain: "LAND_WAR",
      phase: "EVALUATE_CANDIDATES",
      hookId: "P05_STRUCTURE_CAPTURE_TARGET_VALUE",
    },
  ],
}
```

## Hook semantics

### `P05_STRUCTURE_CAPTURE_OPPORTUNITY`

Allows the OpportunityEvaluator to recognize that a plausibly capturable enemy structure creates immediate conquest-economy value in addition to the ordinary territorial/structure-denial value.

It may enrich or emit legitimate findings such as `EXPOSED_STRUCTURE` or `RAID_WINDOW` where the ordinary visibility/reachability conditions support them.

Capability boundary:

- low-tier reasoning may notice an exposed valuable structure;
- operational reasoning may compare route/front cost against the additional conquest value;
- strategic reasoning may recognize chains where captured infrastructure helps finance subsequent operations.

The hook does not decide that the character should start a war.

### `P05_STRUCTURE_CAPTURE_FFY_FORECAST`

Adds the legitimate expected conquest FFY consequence when forecasting a plan that plausibly captures a structure.

The authoritative mechanics/economy layer calculates the payout. The AI hook must not duplicate the payout formula or structure-value arithmetic.

### `P05_STRUCTURE_CAPTURE_TARGET_VALUE`

Allows `LandWarPlanner` to incorporate P05's extra capture FFY when comparing alternative plans for the same active land-war goal.

Example: when two legal plans have similar military/territorial results but one plausibly captures valuable structures, P05 makes that plan materially better within the planner's own domain-quality comparison.

Doctrine and arbitration remain responsible for whether the broader war/goal is acceptable.

Strategic philosophy: **conquest can finance further conquest; enemy infrastructure is simultaneously military, territorial, and liquid economic value.**

---

# P06 — See You, Space Cowboy

Canonical mechanic: `+25% Trade Ship speed`.

```ts
{
  traitId: "P06",
  mode: "GENERIC",

  themes: [
    "TRADE",
    "MOBILITY",
    "ECONOMIC_COMPOUNDING",
  ],

  affordances: [
    "SCALE_TRADE",
  ],

  cautions: [],

  synergyTags: [
    "TRADE_ECONOMY",
    "ECONOMY",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

The mechanic increases ordinary trade throughput but does not transform Trade Ships into a new controller-owned military unit or introduce a novel action form. Generic Economy/Infrastructure reasoning should consume the effective trade timing/throughput.

Do not add the broad `NAVAL` synergy tag solely because Trade Ships move on water; that tag is reserved for military naval-strategy interactions where broad matching with Warship/naval support is semantically useful. `TRADE_ECONOMY` is the precise support key.

Strategic philosophy: **faster trade cycles increase the value and throughput of trade-oriented development.**

---

# P07 — Galaxy Express 999

Canonical mechanic: every fourth normal primary Train dispatch from each Factory simultaneously launches one additional bonus Train (`+25% trains spawned`).

```ts
{
  traitId: "P07",
  mode: "GENERIC",

  themes: [
    "INDUSTRIALIZATION",
    "INFRASTRUCTURE",
    "ECONOMIC_COMPOUNDING",
  ],

  affordances: [
    "SCALE_INDUSTRY",
    "SCALE_ECONOMY",
  ],

  cautions: [],

  synergyTags: [
    "TRAIN_ECONOMY",
    "INDUSTRIAL_ECONOMY",
    "ECONOMY",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P07 increases the throughput of the existing Factory/Train economy without changing the strategic control model for Trains themselves. Generic Economy/Infrastructure reasoning should evaluate the effective Factory dispatch behavior.

If generic AI cannot account for the higher effective Train throughput, that is a weakness in the shared Factory/Train economic model rather than justification for a P07-only planner.

P07 is an obvious future synergy participant with later Train-triggered mechanics such as P33; explicit combination support is deferred until the global trait-synergy sweep.

Strategic philosophy: **Factories and the infrastructure they feed generate more economic throughput.**

---

# P08 — Tea Time

Canonical mechanic: wartime trade multiplier becomes `1.0` instead of the ordinary `0.5`.

```ts
{
  traitId: "P08",
  mode: "GENERIC",

  themes: [
    "TRADE",
    "ECONOMIC_COMPOUNDING",
  ],

  affordances: [
    "SCALE_TRADE",
  ],

  cautions: [],

  synergyTags: [
    "TRADE_ECONOMY",
    "ECONOMY",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P08 means war no longer suppresses ordinary trade yield. Generic EconomyEvaluator/forecasting should naturally see the actual wartime multiplier and therefore understand that trade remains economically productive while at war.

Do not attach `ESCALATION`: the mechanic makes commerce less vulnerable to wartime penalties but does not itself say that initiating war is desirable.

Strategic philosophy: **war and commerce need not be mutually exclusive.**

P06 + P08 is an obvious compositional synergy candidate, but no explicit combination entry is currently required because faster trade and full wartime value are intelligible as the ordinary sum of their effects. Reassess during the global synergy sweep.

---

# P09 — Wall Maria

Canonical mechanic: Forts receive `+10% coverage area`, `+9% defensive pressure`, and `-8% FFY cost`.

```ts
{
  traitId: "P09",
  mode: "GENERIC",

  themes: [
    "FORTIFICATION",
    "INFRASTRUCTURE",
    "POSITIONAL_CONTROL",
  ],

  affordances: [
    "HOLD_GROUND",
    "PROTECT_HIGH_VALUE_ASSET",
  ],

  cautions: [],

  synergyTags: [
    "DEFENSE",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

P09 is a multi-axis scalar Fort improvement. Generic Infrastructure/Defense/Territory reasoning should already consume actual Fort cost, radius, and defensive-pressure effects and therefore needs no bespoke support hook.

Do not attach `INFRASTRUCTURE_DEPENDENCE`: the trait makes Fort investment better but does not mechanically create a new dependence or penalty when Forts are absent.

Likely cross-trait interactions with later Fort-based traits such as P18, P24 and P50 are deferred to the global synergy sweep.

Strategic philosophy: **static defensive investment buys more protection for less FFY.**

---

# P10 — Scorpion's Tail

Canonical mechanic: `+100%` strategic-warhead projectile speed. The actual projectile speeds and physical SAM-interception semantics remain defined by the strategic-weapon contract and final effective rules.

This trait introduced one accepted reusable support-vocabulary addition:

```ts
StrategicAffordance += "REDUCE_INTERCEPTION_WINDOW"
```

Semantic meaning:

> A mechanic reduces the time/opportunity available for ordinary interception of a moving strategic projectile without changing the interception rules themselves.

```ts
{
  traitId: "P10",
  mode: "GENERIC",

  themes: [
    "DETERRENCE",
    "ESCALATION",
    "DECISIVE_FORCE",
  ],

  affordances: [
    "REDUCE_INTERCEPTION_WINDOW",
  ],

  cautions: [],

  synergyTags: [
    "STRATEGIC_WEAPON",
  ],

  signalSupport: [],
  plannerSupport: [],
}
```

### Strategic-support rationale

Strategic-weapon forecasting/planning should already consume actual projectile speed, physical flight path, SAM coverage, and interception opportunity regardless of whether speed comes from an Origin, Echo, or another explicit modifier.

Therefore P10 remains `GENERIC`; a dedicated `P10_*_INTERCEPTION_FORECAST` hook would duplicate reasoning that should belong to ordinary strategic-weapon forecasting.

`REDUCE_INTERCEPTION_WINDOW` is preferred over forcing P10 into unrelated semantics such as `FORCE_ENEMY_RESPONSE` or `RETALIATE_EFFICIENTLY`.

Likely interactions with later Silo/weapon/launcher traits such as P20, P25, P26 and P29 are deferred to the global synergy sweep.

Strategic philosophy: **deliver strategic weapons faster and reduce the defender's physical interception opportunity.**

---

# Batch 1 consistency notes

Support modes:

```text
P01 GENERIC
P02 GENERIC
P03 GENERIC
P04 GENERIC
P05 EXTENDED
P06 GENERIC
P07 GENERIC
P08 GENERIC
P09 GENERIC
P10 GENERIC
```

Only P05 currently requires bespoke reusable evaluator/planner support. This is intentional and healthy: most scalar or surfaced mechanical modifiers should remain understandable through final effective mechanics rather than requiring trait-specific AI code.

No explicit `OriginCombinationSupport` entry is closed from P01–P10 alone. Candidate relationships are retained for the mandatory post-trait global synergy sweep.

The generic `StrategicAffordance` catalogue must include `REDUCE_INTERCEPTION_WINDOW` before this batch is considered fully synchronized with `OFFICIAL_AI_ORIGIN_SUPPORT.md`.
