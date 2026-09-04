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
Configured traits: 20 / 72
Current range:      P01–P20
Remaining:          P21–P54, N01–N18
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

# P11 — Level Upper

P11 couples two otherwise separate systems: reaching new **peak Total Population** thresholds permanently unlocks additional SAM ownership/build slots, while those SAMs cost no FFY. Once a slot exists, ordinary Infrastructure/Defense reasoning can understand a free legal SAM. The non-obvious part is valuing progress toward the *next permanent unlock* before it exists.

Reusable support therefore exposes the next threshold as a legitimate future opportunity/forecast consequence and lets Infrastructure planning understand the resulting no-FFY interception-network expansion. The hook must not invent Population growth or threshold arithmetic; authoritative mechanics supply the actual next unlock state.

`INTERCEPT_OVER_LARGE_AREA` here means that repeated free SAM unlocks make broad interception coverage unusually accessible, not that each individual SAM receives P40-style giant range.

Likely synergy partners include Population-growth traits and later SAM transformations, especially P40.

**Strategic philosophy:** demographic growth permanently converts into a progressively broader strategic-defense network.

---

# P12 — Somewhere Not Here

P12 improves Transport movement without changing Transport control, landing rules, capacity, or survivability. Shared amphibious reasoning should therefore use the real effective transit speed when evaluating travel time, interception exposure, and whether a distant landing/second front is practical.

The trait is deliberately tagged around amphibious play rather than broad Warship strategy: faster Transports improve force projection from sea to land but do not make Warships themselves stronger.

Likely combination partners include P32 armored Port-launched Transports, P37 fortified landings, and Transport drawbacks.

**Strategic philosophy:** shorten amphibious transit and make distant sea-borne operations easier to execute before conditions change.

---

# P13 — Mountain Training Arc

P13 makes Mountains substantially stronger defensive positions. This remains a generic effective-pressure modifier: Territory, Defense, Retreat, and LandWar reasoning should already use the faction's real terrain-adjusted defensive pressure.

`TERRAIN_DEPENDENCE` is intentional here because the trait's strategic value genuinely depends on access to Mountain geography; the caution describes a conditional support requirement, not a hidden penalty.

The AI should prefer Mountains when they are strategically useful without becoming compelled to occupy worthless or disconnected Mountain cells merely because the bonus exists.

**Strategic philosophy:** use Mountain geography as unusually efficient defensive ground.

---

# P14 — 60 Billion Double Dollars

P14 makes FFY events located on Desert more valuable. Generic Economy/Territory reasoning should combine the actual event-yield modifier with the map's ordinary Desert economics rather than receiving a bespoke Desert-money planner.

The trait changes the strategic value of acquiring, retaining, and placing economically productive activity on Desert, while remaining conditional on relevant Desert geography. `TERRAIN_DEPENDENCE` therefore applies.

Potential combinations with other economic-event amplifiers or Desert-sensitive mechanics are deferred to the global synergy sweep.

**Strategic philosophy:** turn Desert geography into an unusually profitable economic surface.

---

# P15 — The High Ground

P15 makes Highland source positions materially stronger for offensive pressure. The normal combat and territory stack already has enough information to value that pressure change; no trait-specific attack engine is required.

The strategic implication is positional rather than a blanket aggression mandate: when the faction intends to fight, Highland control can create better attack lanes and breakthrough opportunities. Character Doctrine still decides whether such fighting is desirable.

`TERRAIN_DEPENDENCE` records that the trait needs useful Highland access to express its value.

**Strategic philosophy:** acquire and exploit Highland positions as offensive staging ground.

---

# P16 — Poison Taster

P16 removes the ordinary Fallout acquisition-resistance penalty for this faction. It does not change what Fallout is, make Fallout harmless in unrelated systems, or create a new capture action; ordinary expansion/war reasoning simply sees the faction's true effective capture progress.

The support intentionally does not invent a special “Fallout terrain” affordance because Fallout remains a persistent overlay/state rather than base terrain. The `FALLOUT` synergy tag is enough to make later Fallout-producing or Fallout-restricting interactions visible during the global sweep.

**Strategic philosophy:** Fallout-contaminated territory does not slow this faction's territorial acquisition.

---

# P17 — Ten Billion Percent

P17 is not merely “upgrades are cheaper.” The upgrade multiplier improves as the faction owns more structures, which creates a real sequencing relationship between **building additional structures now** and **upgrading infrastructure later**.

Current upgrade affordability remains generic mechanics-aware reasoning. Extended support exists so Economy/Forecast/Spending/Upgrade reasoning can recognize future compounding and compare plans such as “upgrade immediately” versus “expand the structure base first, then perform a cheaper upgrade program.”

The support must not blindly encourage junk construction to farm discounts: structure cost, utility, timing, and opportunity cost still pass through ordinary planners and character arbitration.

P17 is an obvious global-synergy-sweep partner for upgrade restrictions such as N06 and high-level structure mechanics such as P41.

**Strategic philosophy:** a broader infrastructure base compounds into progressively cheaper future modernization.

---

# P18 — The Best Defense

P18 makes Fort coverage an **offensive staging resource**: qualifying engagement lanes receive the bonus when their attacking source cell lies inside a self/fixed-teammate Fort area. That positional condition is strategically richer than a flat offense scalar.

Extended support therefore teaches Opportunity/LandWar reasoning to notice Fort-covered attack origins and Infrastructure planning to recognize that Fort placement may support future offense as well as ordinary defense.

The mechanic does not imply that every Fort should be placed aggressively or that the character should start wars. It adds offensive value to Fort geometry once ordinary strategic intent makes that value relevant.

P09 and later Fort-centered traits are important synergy-sweep partners.

**Strategic philosophy:** fortify the ground from which you intend to project force, turning defensive infrastructure into attack support.

---

# P19 — The Weak Die First

P19 globally increases offensive pressure according to the number of distinct active other factions currently in Territorial Contact, including Minor Factions and even a fixed teammate where the literal rule applies. This creates an unusual positional incentive: **contact geometry itself can alter the faction's offensive strength elsewhere**.

Extended support is required because ordinary expansion reasoning would normally treat creating another border only as access/exposure. With P19 it must also understand the global offensive consequence of gaining or losing a qualifying contact.

`SPLIT_FRONT_RISK` remains important: pursuing additional contacts merely for the bonus can create strategically dangerous exposure, and higher-tier controllers should weigh the bonus against that cost rather than maximizing contact count blindly.

Minor-Faction-heavy starts and future contact-changing mechanics should receive particular attention during the global synergy sweep.

**Strategic philosophy:** broad territorial contact converts geopolitical exposure into offensive momentum, but chasing that momentum can create too many fronts.

---

# P20 — A Miracle Is Merely a Miscalculation

P20 grants a free Missile Silo at match start. Once present, the structure is an ordinary visible launcher governed by the same level gates, costs, visibility, defense, and strategic-weapon planning as any other Silo.

The trait therefore remains generic: the AI must notice and use the starting asset, but there is no new action form or hidden relationship requiring a bespoke planner. Strategic-weapon affordability and timing remain ordinary planning problems.

The granted Silo creates obvious future relationships with P10 and later weapon/launcher traits, but those are deferred to the global synergy sweep unless their combined behavior proves more than additive.

**Strategic philosophy:** begin the match with strategic-launch infrastructure already established and plan around the earlier access it creates.

---

## Batch 1 consistency notes — P01–P10

Nine of the first ten traits are ordinary mechanics-aware support cases. P05 is the only one that needs reusable extended evaluator/planner support because it creates a cross-domain conquest-to-economy relationship that ordinary scalar reasoning would not necessarily capture.

The first ten traits currently require no explicit combination-support definition. Potential relationships are retained for the mandatory post-trait global synergy sweep rather than being prematurely encoded batch by batch.

---

## Batch 2 consistency notes — P11–P20

P11, P17, P18, and P19 require extended support because they create cross-domain or geometry-dependent strategic relationships that are not adequately represented by merely reading a current scalar value. P12–P16 and P20 remain generic mechanics-aware cases.

This batch does **not** require another expansion of the generic support vocabulary. Existing themes, affordances, cautions, and synergy tags are sufficient; where an interaction is too specific for the current synergy-tag vocabulary, the later global sweep can match exact trait IDs rather than adding one-off literals prematurely.

No explicit `OriginCombinationSupport` entry is closed yet.
