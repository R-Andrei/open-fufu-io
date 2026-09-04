# Open Fufu — Official AI Trait Support Rationale

## Status and authority

This document is the canonical **design/rationale companion** for Official-AI Origin-trait support.

Concrete code-readable trait mappings live in:

- [`../design/official-ai/origin-trait-support.config.ts`](../design/official-ai/origin-trait-support.config.ts)

The configuration file is the source of truth for exact trait-support entries, hook IDs, themes, affordances, cautions, synergy tags, and future `OriginCombinationSupport` entries. It intentionally lives outside runtime `src/` during the design phase so the mappings remain code-ready without pretending Official-AI implementation has started.

This document explains **why** mappings exist, their intended strategic philosophy, important exclusions/boundaries, and likely future synergy questions. It should not duplicate the complete configuration objects.

It remains subordinate to:

- `ORIGIN_TRAIT_CATALOGUE.md` for actual Origin mechanics;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` for generic support vocabulary, composition rules, hook boundaries, and character-adaptation architecture;
- `OFFICIAL_AI_CONFIGURATION.md` for shared AI signal/goal/planner/profile vocabulary.

Nothing here changes Origin mechanics. Numeric mechanical truth remains in the authoritative game/rules documents and final effective rules.

---

## Progress

```text
Configured traits: 10 / 72
Current range:      P01–P10
Remaining:          P11–P54, N01–N18
```

No explicit Origin-combination support is closed yet. Cross-trait interactions are deliberately retained for the global synergy sweep after all individual trait mappings exist.

---

# P01 — Domain Expansion

P01 changes the real starting footprint size without creating a new action form or transformed mechanic. Strategic Spawn should reason about the actual final footprint rather than assuming the ordinary baseline.

A somewhat larger footprint does not inherently create a second theater or an overextension problem; those are map-dependent geographic consequences for ordinary territory reasoning to discover.

**Strategic philosophy:** begin with more geography and exploit the positional head start.

---

# P02 — The Era of Humans

The widened Population-utilization sweet spot makes Population recovery and sustained demographic efficiency more forgiving across a much broader state range. It increases the long-term value of maintaining a recoverable Population/Capacity relationship without implying that Population expenditure itself is undesirable.

Shared economy/forecast reasoning should use the faction's actual effective growth function; no trait-specific demographic planner should reproduce the growth formula.

**Strategic philosophy:** a wider demographic sweet spot rewards sustained growth and recoverable Population management.

---

# P03 — Imagine Breaker

P03 makes enemy Fort-supported positions materially less capable of dictating attack geometry against this faction. It does not itself tell the controller to attack Forts or start wars; character Doctrine and arbitration retain that responsibility.

The shared combat/territory machinery should already reason from actual effective pressure, so this remains ordinary mechanics-aware reasoning rather than a bespoke anti-Fort brain.

**Strategic philosophy:** enemy static Fort pressure is less able to constrain where the faction can attack.

---

# P04 — Level 0

P04 is particularly useful for relatively small counter-responses because the response side no longer suffers the ordinary numerical-imbalance efficiency penalty. Conversely, massively overcommitting a response no longer earns the ordinary response-side overmatch bonus.

The shared CounterResponsePlanner should discover the actual exchange consequences from the public mechanics calculation. The lost benefit from numerical overmatch is real but does not cleanly fit one of the current generic caution literals; it should remain visible through mechanics estimation rather than being mislabeled.

**Strategic philosophy:** counter effectively without needing numerical overcommitment to win the response-side efficiency curve.

---

# P05 — Big Shot

P05 is the first trait in catalogue order that genuinely creates a new cross-domain strategic relationship rather than merely changing a surfaced number: capturing hostile infrastructure is simultaneously territorial conquest, enemy capability denial, and immediate FFY generation.

Reusable support therefore needs to teach opportunity/forecast/land-war reasoning about the extra conquest-economy consequence while leaving payout arithmetic to the authoritative economy mechanics.

The support must never decide that the character should start a war. It only ensures that, once a character considers a legal attack, the economic value of capturing structures is not invisible to the controller.

Higher capability levels may understand progressively richer consequences—from “that exposed structure pays me when captured” to chains where successful conquest helps finance subsequent operations.

**Strategic philosophy:** conquest can finance further conquest; enemy infrastructure is simultaneously military, territorial, and liquid economic value.

---

# P06 — See You, Space Cowboy

P06 increases ordinary trade throughput without turning Trade Ships into a new combat-control system. Shared economy/infrastructure reasoning should consume the real effective travel timing and resulting throughput.

Trade is intentionally kept semantically distinct from military naval strategy: merely moving on water should not make every Trade Ship modifier trigger broad Warship/naval synergies.

**Strategic philosophy:** faster trade cycles increase the value and throughput of trade-oriented development.

---

# P07 — Galaxy Express 999

P07 increases the throughput of the existing Factory/Train economy without transforming Train strategic control. Shared economy/infrastructure reasoning should therefore understand the effective dispatch behavior rather than receiving a bespoke P07 planner.

If the generic AI cannot value additional Train throughput, that indicates a weakness in the shared Factory/Train economic model.

P07 is an obvious future participant in Train-triggered combinations, especially with later catalogue traits such as P33. Whether any such pairing requires explicit combination support is intentionally deferred to the global synergy sweep.

**Strategic philosophy:** Factories and the infrastructure they feed generate more economic throughput.

---

# P08 — Tea Time

P08 means war no longer suppresses ordinary trade yield. This makes trade infrastructure economically durable through wartime without implying that initiating war is itself desirable.

The distinction from P06 matters: P06 improves throughput in general; P08 preserves full trade value specifically under war conditions. Their effects appear naturally complementary, but currently remain understandable as ordinary composition rather than requiring a special combined strategy definition.

**Strategic philosophy:** war and commerce need not be mutually exclusive.

---

# P09 — Wall Maria

P09 is a multi-axis improvement to ordinary Fort investment: broader coverage, stronger defense, and lower cost. Shared Infrastructure/Defense/Territory reasoning should already see all three effective values.

Making Forts better does not itself create an infrastructure dependency or mandate turtling. The controller remains free to conclude that another strategy is better in the current situation.

Later Fort-centered traits such as P18, P24, and P50 are likely synergy-review partners.

**Strategic philosophy:** static defensive investment buys more protection for less FFY.

---

# P10 — Scorpion's Tail

P10 revealed one legitimate reusable gap in the generic support vocabulary: the strategic value of reducing the physical time/opportunity available for projectile interception. The accepted generic affordance `REDUCE_INTERCEPTION_WINDOW` captures that idea without pretending faster warheads are inherently retaliatory or force-response mechanics.

Strategic-weapon forecasting should already reason from actual projectile speed, physical path, SAM coverage, and interception opportunity regardless of whether the speed change comes from an Origin, Echo, or future explicit modifier. P10 therefore does not need its own interception simulator.

Its interactions with later Silo, launcher, and strategic-weapon traits remain candidates for the global synergy sweep.

**Strategic philosophy:** deliver strategic weapons faster and reduce the defender's physical interception opportunity.

---

## Batch 1 consistency notes

Nine of the first ten traits are ordinary mechanics-aware support cases. P05 is the only one that currently needs reusable extended evaluator/planner support because it creates a cross-domain conquest-to-economy relationship that ordinary scalar reasoning would not necessarily capture.

That ratio is intentional: Origin support should not become a bespoke adapter catalogue for every surfaced modifier.

The first ten traits currently require no explicit combination-support definition. Potential relationships are retained for the mandatory post-trait global synergy sweep rather than being prematurely encoded batch by batch.
