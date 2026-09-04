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
Configured traits: 30 / 72
Current range:      P01–P30
Remaining:          P31–P54, N01–N18
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

# P21 — Fun Things Are Fun

P21 creates a sequencing and liquidity effect rather than a simple structure discount. The first purchase of every structure type must still pass ordinary affordability and legality, but a successful qualifying purchase consumes no FFY. The controller therefore needs to distinguish **having enough FFY to unlock the purchase** from **actually spending that FFY**.

Extended support tracks which first-purchase opportunities remain and lets Spending/Infrastructure reasoning value the preserved liquidity. `HIGH_LIQUIDITY_NEED` is intentional: a faction may need to accumulate a large balance to qualify for a purchase even though the balance survives afterward.

The trait should encourage useful infrastructure diversification when appropriate, not blind construction of one copy of everything merely because the first copy is free to consume.

**Strategic philosophy:** turn sufficient liquidity into unusually efficient first-time infrastructure without actually exhausting the stockpile.

---

# P22 — Limit Break

P22 raises the Warship rank ceiling without changing how Warships gain XP or how rank bonuses work. Shared naval reasoning should already use actual current/max rank and effective combat stats, so the trait itself remains generic.

The strategic value is delayed and therefore legitimately carries `REQUIRES_VETERANCY`: a newly built Warship has not yet realized the benefit. Preserving experienced ships becomes more valuable because their long-run ceiling is higher.

P22 and P29 are an especially important synergy-sweep pair because higher Warship rank can expand the effective Silo level of P29 mobile launchers.

**Strategic philosophy:** invest in veteran Warships that can continue scaling beyond the ordinary fleet ceiling.

---

# P23 — Space Battleship Yamato

P23 is more than three ordinary Warship stat bonuses because the faction may own only one Warship. Naval capability becomes concentrated into one stronger, faster, longer-ranged flagship that must be allocated between competing theaters rather than multiplied into a fleet.

Extended support therefore teaches Naval planning about the one-Warship cap, the strategic cost of losing the flagship, and the need to compare redeployment between theaters. `EXPENSIVE_FAILURE` describes concentrated strategic capability rather than a hidden increase to purchase price.

The support should not make the flagship timid by default; character adaptation decides whether it is preserved carefully, used as a decisive spearhead, or risked aggressively.

**Strategic philosophy:** concentrate naval power into one elite flagship and make its positioning, preservation, and commitment count.

---

# P24 — A King's Price

P24 makes Fort coverage an economic geography as well as a defensive geometry: qualifying FFY events inside Fort areas are more valuable. This creates a real cross-domain relationship between infrastructure placement and economic-event locations that is not captured by simply reading a cheaper/more-expensive structure number.

Extended support therefore lets Economy/Forecast reasoning value the location condition and lets Infrastructure planning consider economic coverage alongside ordinary defensive use. `INFRASTRUCTURE_DEPENDENCE` records that the bonus requires useful Fort coverage; it does not mean Fort-building is always correct.

P09, P18, and P50 are natural global-synergy-sweep partners because they change the value or purpose of the same Fort geometry.

**Strategic philosophy:** turn strategically placed Fort coverage into protected, higher-yield economic territory.

---

# P25 — EXPLOSION!

P25 specializes the faction's strategic-weapon portfolio around Hydrogen Bombs: Atom Bomb and MIRV are unavailable, while Hydrogen Bombs become larger and more expensive. All three changes are explicitly surfaced by ordinary weapon legality, blast geometry, and cost mechanics.

The trait therefore remains generic. A competent StrategicWeaponPlanner should already understand that only Hydrogen Bomb plans are legal and evaluate their true cost/area. `HIGH_UPFRONT_COST` captures the heavier commitment, while `SPECIALIZATION` captures the loss of cheaper/smaller and MIRV alternatives.

With Water Nukes enabled, the larger Hydrogen footprint also enlarges the terrain-conversion core through the same canonical geometry, so ordinary strategic-weapon forecasting must use the actual ruleset result rather than a P25-specific terrain simulator.

**Strategic philosophy:** abandon weapon variety in favor of fewer, larger, more expensive Hydrogen strikes with exceptional area impact.

---

# P26 — Serious Punch

P26 turns MIRV access into a singular strategic resource. The faction must satisfy ordinary MIRV affordability and launcher legality, but the one permitted successful use consumes no FFY. This creates both a **liquidity reservation problem** and a **one-shot timing problem** that ordinary cost-aware planning alone does not express well.

Extended support therefore lets StrategicWeapon/Spending reasoning preserve enough liquidity to make MIRV legal, recognize that the eventual successful purchase does not consume the stockpile, and value the fact that the one permitted MIRV opportunity cannot simply be repeated later.

`EXPENSIVE_FAILURE` is strategic rather than monetary: committing the unique MIRV opportunity at a poor time or into a highly interceptable situation can waste an irreplaceable capability.

**Strategic philosophy:** accumulate the right conditions for one decisive MIRV use, then spend the unique opportunity when its strategic value is exceptional.

---

# P27 — Only My Railgun

P27 transforms SAM placement into a cross-domain defensive problem because SAM Launchers may also attack ships. The structure remains a SAM rather than becoming a Warship, but coastal/littoral coverage can now deny hostile naval movement and protect valuable shore assets.

Extended support teaches Threat/Opportunity reasoning to include hostile ships in relevant SAM coverage and lets Infrastructure/Defense planning value coastal SAM locations for both ordinary interception and anti-ship denial.

`COAST_DEPENDENCE` applies to the *additional anti-ship value*, not to the SAM's ordinary strategic-projectile role away from water.

**Strategic philosophy:** turn the strategic-interception network into coastal area denial against hostile shipping as well.

---

# P28 — Blood Devil

P28 changes the strategic value of destroying enemy Transports because their carried Population is transferred rather than merely removed with the Transport. A Transport can therefore become a large Population prize whose value depends on its actual committed cargo.

Extended support lets Opportunity/Forecast/Naval reasoning account for that cargo-dependent gain when choosing patrol areas and evaluating Transport targets. It does not bypass ordinary observation: the controller may only reason from whatever Transport/cargo information the legal tactical-information rules actually expose.

The ordinary autonomous Warship target order already values hostile Transports highly; P28 support exists so the broader strategy understands *why and how much* a successful interception can change Population balance.

**Strategic philosophy:** punish amphibious commitment by converting destroyed enemy invasion Population into your own available force.

---

# P29 — The Kaiser

P29 turns sufficiently ranked Warships into mobile Missile Silo launch platforms. This couples naval positioning, Warship survival/veterancy, weapon level gates, launch geometry, and strategic-weapon timing in a way that cannot be represented as a simple Warship stat modifier.

Extended support therefore teaches StrategicWeapon planning that Warships are legal launchers at their current cells and teaches Naval planning that a Warship's location can be valuable for launch access in addition to ordinary naval combat. Exposure of a launcher-Warship also matters more than exposure of an ordinary ship.

`REQUIRES_VETERANCY` reflects rank-based effective Silo access. P22 is a particularly important synergy-sweep partner because its rank-5 ceiling can eventually make a P29 Warship MIRV-capable.

**Strategic philosophy:** use veteran naval assets as mobile strategic-launch infrastructure, turning sea position into weapon projection.

---

# P30 — The Conman

P30 changes the Warship's role rather than merely making it faster: piracy yield is tripled and speed increases sharply, but naval gunfire against ships is removed while Trade Ship pursuit/capture remains. A P30 Warship should therefore not be reasoned about as an ordinary line combatant with better movement.

Extended support teaches Naval planning the transformed legal role, identifies profitable piracy routes/targets, forecasts the increased FFY return, and treats hostile combat Warships as threats the pirate ship cannot simply duel with ordinary naval gunfire.

The lack of a generic caution literal for “cannot perform ordinary peer naval combat” is intentional here. The planner-support semantics can model the hard capability restriction directly rather than forcing it into an inaccurate caution label.

Likely synergy partners include Trade Ship/economy modifiers and Warship transformations; these remain for the global sweep.

**Strategic philosophy:** replace conventional naval combat with high-speed economic predation—avoid the battle line, hunt commerce, and make piracy pay.

---

## Batch 1 consistency notes — P01–P10

Nine of the first ten traits are ordinary mechanics-aware support cases. P05 is the only one that needs reusable extended evaluator/planner support because it creates a cross-domain conquest-to-economy relationship that ordinary scalar reasoning would not necessarily capture.

The first ten traits currently require no explicit combination-support definition. Potential relationships are retained for the mandatory post-trait global synergy sweep rather than being prematurely encoded batch by batch.

---

## Batch 2 consistency notes — P11–P20

P11, P17, P18, and P19 require extended support because they create cross-domain or geometry-dependent strategic relationships that are not adequately represented by merely reading a current scalar value. P12–P16 and P20 remain generic mechanics-aware cases.

This batch does **not** require another expansion of the generic support vocabulary. Existing themes, affordances, cautions, and synergy tags are sufficient; where an interaction is too specific for the current synergy-tag vocabulary, the later global sweep can match exact trait IDs rather than adding one-off literals prematurely.

No explicit `OriginCombinationSupport` entry is closed yet.

---

## Batch 3 consistency notes — P21–P30

P21, P23, P24, P26, P27, P28, P29, and P30 require extended support because they introduce sequencing, role transformation, cross-domain geometry/economy coupling, one-shot resource timing, cargo-dependent rewards, or mobile-launch semantics. P22 and P25 remain generic mechanics-aware cases.

Despite the high extended-support ratio, this batch still fits the existing generic support vocabulary. Several very specific concepts are better expressed through typed support hooks than by expanding the global enum catalogue with one-off affordances/cautions.

No explicit `OriginCombinationSupport` entry is closed yet. Important candidates retained for the later global sweep include P22+P29, Fort-centric P09/P18/P24/P50 relationships, and several strategic-weapon/naval combinations.
