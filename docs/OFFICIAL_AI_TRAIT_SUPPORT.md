# Open Fufu — Official AI Trait Support Rationale

## Status and authority

This document is the canonical **design/rationale companion** for Official-AI Origin-trait support.

Concrete code-readable trait mappings live in the sharded design-time configuration set:

- [`../design/official-ai/origin-trait-support.config.ts`](../design/official-ai/origin-trait-support.config.ts)
- [`../design/official-ai/origin-trait-support.p41-p50.config.ts`](../design/official-ai/origin-trait-support.p41-p50.config.ts)
- future `origin-trait-support*.config.ts` shards as the catalogue grows.

The `.config.ts` files are the source of truth for exact trait-support entries, hook IDs, themes, affordances, cautions, synergy tags, and future `OriginCombinationSupport` entries. This document explains **why** mappings exist, their strategic philosophy, important exclusions/boundaries, and likely future synergy questions. It should not duplicate the complete configuration objects.

It remains subordinate to:

- `ORIGIN_TRAIT_CATALOGUE.md` for actual Origin mechanics;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` for generic support vocabulary, composition rules, hook boundaries, and character-adaptation architecture;
- `OFFICIAL_AI_CONFIGURATION.md` for shared AI signal/goal/planner/profile vocabulary.

Nothing here changes Origin mechanics. Numeric mechanical truth remains in the authoritative game/rules documents and final effective rules.

---

## Progress

```text
Configured traits: 50 / 72
Current range:      P01–P50
Remaining:          P51–P54, N01–N18
```

No explicit Origin-combination support is closed yet. Cross-trait interactions are deliberately retained for the global synergy sweep after all individual trait mappings exist.

---

# P01 — Domain Expansion

P01 changes the real starting footprint size without creating a new action form. Strategic Spawn should reason about the actual final footprint rather than assume the ordinary baseline. A somewhat larger footprint does not inherently imply another theater or overextension; those are map-dependent consequences for normal geography reasoning.

**Strategic philosophy:** begin with more geography and exploit the positional head start.

---

# P02 — The Era of Humans

The widened Population-utilization sweet spot makes Population recovery and sustained demographic efficiency more forgiving. Shared economy/forecast reasoning should use the faction's actual effective growth function rather than inventing a trait-specific demographic planner.

**Strategic philosophy:** a wider demographic sweet spot rewards sustained growth and recoverable Population management.

---

# P03 — Imagine Breaker

P03 makes enemy Fort-supported positions materially less capable of dictating attack geometry against this faction. It does not tell the controller to attack Forts or start wars; Doctrine and arbitration retain that responsibility.

**Strategic philosophy:** enemy static Fort pressure is less able to constrain where the faction can attack.

---

# P04 — Level 0

P04 particularly helps relatively small counter-responses because the response side no longer suffers the ordinary numerical-imbalance penalty. Conversely, massively overcommitting no longer earns the normal response-side overmatch bonus. Shared counter-response mechanics should expose the actual exchange result.

**Strategic philosophy:** counter effectively without needing numerical overcommitment to win the response-side efficiency curve.

---

# P05 — Big Shot

P05 creates a genuine cross-domain relationship: capturing hostile infrastructure is simultaneously conquest, enemy-capability denial, and immediate FFY generation. Reusable support therefore teaches Opportunity/Forecast/LandWar reasoning about the extra conquest-economy consequence while leaving payout arithmetic to authoritative mechanics.

**Strategic philosophy:** conquest can finance further conquest; hostile infrastructure is simultaneously military, territorial, and liquid economic value.

---

# P06 — See You, Space Cowboy

P06 increases ordinary trade throughput without turning Trade Ships into a combat-control system. Trade remains semantically distinct from military naval strategy, and shared economy/infrastructure reasoning should consume the actual travel timing.

**Strategic philosophy:** faster trade cycles increase the value and throughput of trade-oriented development.

---

# P07 — Galaxy Express 999

P07 increases Factory/Train economic throughput without transforming Train control. If shared AI cannot value additional Train throughput, that is a generic Factory/Train-model weakness rather than a reason for a P07-only planner. P33 is an obvious later synergy partner.

**Strategic philosophy:** Factories and the infrastructure they feed generate more economic throughput.

---

# P08 — Tea Time

P08 preserves full trade value during war. It makes commerce more durable through conflict but does not imply that initiating war is desirable. P06 + P08 remains an obvious compositional trade synergy for the later sweep.

**Strategic philosophy:** war and commerce need not be mutually exclusive.

---

# P09 — Wall Maria

P09 is a multi-axis improvement to ordinary Fort investment: broader coverage, stronger defense, and lower cost. Shared Infrastructure/Defense/Territory reasoning should already see those effective values; better Forts do not mandate turtling.

**Strategic philosophy:** static defensive investment buys more protection for less FFY.

---

# P10 — Scorpion's Tail

P10 established the reusable `REDUCE_INTERCEPTION_WINDOW` affordance. Strategic-weapon forecasting should already reason from actual projectile speed, physical path, SAM coverage, and interception opportunity regardless of the modifier source.

**Strategic philosophy:** deliver strategic weapons faster and reduce the defender's physical interception opportunity.

---

# P11 — Level Upper

P11 couples peak Population thresholds to permanent free-SAM ownership/build slots. Extended support is needed chiefly so the AI can value progress toward the next permanent unlock before the SAM exists and then value the resulting no-FFY interception network.

**Strategic philosophy:** demographic growth permanently converts into broader strategic defense.

---

# P12 — Somewhere Not Here

P12 improves Transport transit speed without changing landing rules, capacity, or survivability. Shared amphibious reasoning should use the real speed when evaluating travel time, interception exposure, and distant second-front feasibility.

**Strategic philosophy:** shorten amphibious transit so distant sea-borne operations can arrive before conditions change.

---

# P13 — Mountain Training Arc

P13 makes Mountains unusually strong defensive ground. `TERRAIN_DEPENDENCE` is deliberate because the trait requires useful Mountain geography, but the AI should not occupy strategically worthless Mountains merely because the bonus exists.

**Strategic philosophy:** use Mountain geography as unusually efficient defensive terrain.

---

# P14 — 60 Billion Double Dollars

P14 makes FFY events located on Desert more valuable. Generic Economy/Territory reasoning should combine actual event-yield mechanics with Desert geography rather than receive a special Desert-money brain.

**Strategic philosophy:** turn Desert geography into an unusually profitable economic surface.

---

# P15 — The High Ground

P15 strengthens offensive pressure from Highlands. The implication is positional rather than a blanket aggression mandate: when the faction intends to fight, Highland control can improve staging and breakthrough geometry.

**Strategic philosophy:** acquire and exploit Highlands as offensive staging ground.

---

# P16 — Poison Taster

P16 removes ordinary Fallout acquisition resistance for this faction without changing unrelated Fallout semantics. Ordinary expansion/war reasoning should simply see the faction's actual capture progress.

**Strategic philosophy:** Fallout-contaminated territory does not slow this faction's territorial acquisition.

---

# P17 — Ten Billion Percent

P17 creates a sequencing relationship because upgrade cost improves as owned structure count rises. Extended support lets Economy/Forecast/Spending/Upgrade reasoning compare upgrading now against expanding the structure base first and modernizing later. It must not encourage junk construction without ordinary utility/cost justification.

**Strategic philosophy:** a broader infrastructure base compounds into progressively cheaper future modernization.

---

# P18 — The Best Defense

P18 turns Fort coverage into offensive staging support when attacking source cells lie inside qualifying Fort areas. Extended support therefore teaches LandWar and Infrastructure reasoning that Fort placement can have future offensive value as well as ordinary defensive value.

**Strategic philosophy:** fortify the ground from which you intend to project force.

---

# P19 — The Weak Die First

P19 converts current Territorial Contact count into global offensive pressure. Creating another border can therefore increase offense elsewhere, but chasing contact count can create dangerous front exposure; `SPLIT_FRONT_RISK` is intentional.

**Strategic philosophy:** convert geopolitical exposure into offensive momentum without blindly maximizing the number of fronts.

---

# P20 — A Miracle Is Merely a Miscalculation

P20 grants a free starting Missile Silo. Once present, it is ordinary launch infrastructure governed by normal weapon level gates, visibility, defense, and strategic-weapon planning.

**Strategic philosophy:** begin with strategic-launch infrastructure already established and exploit earlier weapon access.

---

# P21 — Fun Things Are Fun

P21 distinguishes affordability from consumption: the first purchase of each structure type must still be affordable/legal, but successful purchase consumes no FFY. Extended support tracks remaining first-purchase opportunities and values preserved liquidity without encouraging useless one-of-everything construction.

**Strategic philosophy:** turn sufficient liquidity into unusually efficient first-time infrastructure without exhausting the stockpile.

---

# P22 — Limit Break

P22 raises the Warship rank ceiling without changing how rank is earned. Its value is delayed and therefore legitimately carries `REQUIRES_VETERANCY`; preserving experienced ships becomes more valuable. P22 + P29 is an important future synergy because rank can expand mobile-launch capability.

**Strategic philosophy:** invest in veteran Warships that can continue scaling beyond the ordinary ceiling.

---

# P23 — Space Battleship Yamato

P23 concentrates naval power into one improved flagship. Extended support is required because the one-Warship cap creates theater-allocation and catastrophic-loss considerations that are not equivalent to simple stat bonuses.

**Strategic philosophy:** concentrate naval power into one elite flagship and make its positioning, preservation, and commitment count.

---

# P24 — A King's Price

P24 makes Fort coverage an economic geography: FFY events occurring inside it are more valuable. Infrastructure placement therefore acquires cross-domain economic value as well as defense.

**Strategic philosophy:** turn strategically placed Fort coverage into protected, higher-yield economic territory.

---

# P25 — EXPLOSION!

P25 specializes strategic weapons around larger, more expensive Hydrogen Bombs while removing Atom Bomb and MIRV access. Because legality, cost, blast geometry, and Water-Nuke interaction are all surfaced by ordinary mechanics, the trait remains generic.

**Strategic philosophy:** trade weapon variety for fewer, larger, more expensive Hydrogen strikes with exceptional area impact.

---

# P26 — Serious Punch

P26 turns MIRV access into a singular strategic resource: one legal use, still requiring ordinary affordability/launcher conditions, but consuming no FFY on success. Extended support handles both liquidity reservation and the timing value of an irreplaceable one-shot opportunity.

**Strategic philosophy:** preserve the conditions for one decisive MIRV use and spend the unique opportunity only when its value is exceptional.

---

# P27 — Only My Railgun

P27 lets SAM Launchers attack ships, making coastal SAM placement a cross-domain defense problem. Extended support teaches Threat/Opportunity/Infrastructure/Defense reasoning about anti-ship coverage without turning the SAM into a naval unit.

**Strategic philosophy:** make strategic-interception infrastructure double as coastal area denial.

---

# P28 — Blood Devil

P28 turns destroyed enemy Transports into Population prizes because carried Population is transferred rather than merely removed. Extended support values cargo-dependent gains without granting hidden cargo information beyond the legal observation model.

**Strategic philosophy:** punish amphibious commitment by converting destroyed invasion Population into your own available force.

---

# P29 — The Kaiser

P29 turns sufficiently ranked Warships into mobile Missile Silo launchers. This couples naval position, Warship survival/veterancy, launcher level gates, and strategic-weapon timing, so both Naval and StrategicWeapon planners need explicit support.

**Strategic philosophy:** use veteran naval assets as mobile strategic-launch infrastructure.

---

# P30 — The Conman

P30 transforms Warships from line combatants into fast piracy platforms: piracy is much more profitable, but ordinary ship-to-ship gunfire is unavailable. Extended support therefore changes legal role assumptions, target valuation, and threat handling rather than merely applying a speed bonus.

**Strategic philosophy:** replace conventional naval battle with high-speed economic predation.

---

# P31 — Heart-Under-Blade

P31 makes active Port repair fields stronger operational fleet-support zones and allows Warships to remain active while receiving the improved repair. Naval/Retreat/Infrastructure reasoning should therefore value repair coverage as sustain, fallback, and fleet-base geometry.

**Strategic philosophy:** fight around prepared naval bases and preserve expensive Warships through sustained operational repair.

---

# P32 — Armored Titan

P32 gives Transports health but makes owned active Ports mandatory embarkation nodes. Extended support must understand both the new survivability model and the new launch-geometry dependency.

**Strategic philosophy:** trade launch flexibility for durable invasion shipping organized around Port infrastructure.

---

# P33 — Misaka Network

P33 makes Train-triggered City events generate Capacity-capped Population in addition to ordinary economic effects, with output scaling by City level. Infrastructure and Upgrade planners therefore need to understand Train–City topology as a demographic engine. P07 is an obvious synergy partner.

**Strategic philosophy:** convert a productive Train-and-City network into Population replenishment.

---

# P34 — Spoils of the Empire

P34 makes conquered Factories operate at double ordinary effect. Hostile Factories can therefore be worth more to this faction than equivalent domestic industry, so Opportunity/Forecast/LandWar reasoning needs provenance-sensitive target value.

**Strategic philosophy:** seize enemy industry intact and turn conquest into superior productive capacity.

---

# P35 — It's a Matter of Visualization

P35 turns deliberate relinquishment into territorial shaping because abandoned cells become neutral Fallout until recaptured. Retreat planning may therefore create contaminated buffers or distorted corridors, while `SELF_GEOMETRY_RISK` captures the danger of poisoning ground the faction later wants back.

**Strategic philosophy:** weaponize retreat by trading immediate ownership for temporary area denial and positional distortion.

---

# P36 — Half-Priced Bento

P36 simply halves neutral settlement Population cost. The normal Expansion/Economy stack can read that effective cost directly, leaving more Population available for defense, offense, growth, or further expansion.

**Strategic philosophy:** convert neutral geography into owned Capacity with unusually low Population expenditure.

---

# P37 — The City Mouse

P37 makes amphibious embarkation more expensive but grants a permanent level-1 Fort after successful landing. Extended support therefore evaluates a landing as an immediately fortified beachhead rather than only as captured coastal territory.

**Strategic philosophy:** pay more to invade, but make successful landings harder to uproot and better able to sustain a second front.

---

# P38 — Return by Death

P38 lets automatic defenders survive the capture of defended cells. Forecast/Defense/Retreat reasoning can therefore distinguish losing territory from losing both territory and its defender, enabling much stronger elastic-defense possibilities without requiring the character to embrace them.

**Strategic philosophy:** preserve the fighting population even when ground is lost.

---

# P39 — Stereo Separation

P39 structurally changes Strategic Spawn to two half-area influence regions and two exact origins while retaining one global Starting-Population pool. Spawn planning therefore must generate and compare legal pairs rather than a single point and must later account for split-core opportunity and exposure.

**Strategic philosophy:** begin from two strategic footholds, accepting coordination risk for broader access and multi-theater possibility.

---

# P40 — Barrier Magic

P40 turns ordinary SAM progression into a large-area, exactly-one-charge shield with slower recharge. Extended support must track charge state, broad coverage, poor throughput, and bait risk rather than treating the larger radius as an unconditional upgrade.

**Strategic philosophy:** protect a very large area with a sparse interception shield whose single charge must matter.

---

# P41 — Level 5

P41 changes a City purchase into an immediate level-5 City at a discounted fraction of the cumulative ordinary build-and-upgrade cost. This is more than a scalar discount: one build action now delivers the full high-level City result immediately, so Infrastructure/Spending/Forecast reasoning must understand both the high upfront liquidity requirement and the immediate completed-level payoff.

The support must consume authoritative City costs, levels, build legality, and resulting mechanics rather than reproducing the cumulative-cost formula. P17 and any upgrade-restriction drawback are important later synergy partners.

**Strategic philosophy:** concentrate City investment into expensive one-step purchases that immediately deliver mature growth infrastructure.

---

# P42 — The Price of Empire

P42 replaces Warship FFY purchase cost with a permanent 2,000 Available-Population sacrifice and also shortens Warship attack range. This is a true cross-resource substitution: Spending/Naval reasoning must compare military sea power against demographic strength rather than treating the ship as “free.”

Extended support therefore forecasts the permanent Population loss, exposes the altered purchase semantics, and evaluates the shorter-range Warship role. `EXPENSIVE_FAILURE` reflects the irrecoverable Population committed when a purchased Warship is later lost.

**Strategic philosophy:** build sea power by permanently converting Population into Warships, accepting demographic sacrifice and shorter reach in exchange for zero-FFY fleet acquisition.

---

# P43 — The Devil of the Rhine

P43 fully transforms Tanks into Heavy Artillery. The unit is slower and more expensive, fires very high-damage anti-armor and Population shots at long range on a long reload, cannot raid Trains, and can fire across terrain barriers it cannot itself traverse. Treating it as an ordinary Tank with adjusted stats would produce nonsensical behavior.

Extended Armor support therefore teaches standoff positioning, reload vulnerability, target selection, inability to Train-raid, and the distinction between projectile reach and movement reach. Higher planner tiers may use the same literacy for siege support, breakthrough timing, or more sophisticated force shaping.

**Strategic philosophy:** replace mobile Tank pressure with slow, high-alpha standoff artillery that dominates through range, positioning, and timing rather than close maneuver.

---

# P44 — Nobel Prize

P44 makes successful Tank/Heavy-Artillery Population attacks neutralize enemy population-bearing cells and apply Fallout. This turns armor fire into territorial shaping, not merely damage, so the AI must recognize area denial, connectivity cuts, Capacity denial, and the possibility of damaging geography it might later want to own.

Extended Territory/Opportunity/Forecast/Armor support models these consequences from authoritative attack geometry. P43 is an obvious synergy partner because Heavy Artillery can apply the same effect from much longer range and across a much larger affected-cell budget.

**Strategic philosophy:** use armor attacks to destroy the strategic usefulness and connectivity of enemy territory, not merely its Population.

---

# P45 — Hidden Leaf Village

P45 conceals the interior of owned Forest from enemy tactical observation while leaving exposed boundary information and directly manifested hostile state minimally visible. This is a counterintelligence/positioning mechanic whose value depends on Forest geography, not an ordinary combat scalar.

Extended support lets Territory/Defense/LandWar reasoning value Forest as concealed staging/protection and Forecast reasoning understand when actions will expose previously hidden state. The existing `GAIN_INFORMATION_ADVANTAGE` affordance is used in the relative sense: the faction gains an information advantage by denying the opponent equivalent visibility.

**Strategic philosophy:** use owned Forest as concealed operational space, forcing opponents to reason with less information until activity becomes directly relevant.

---

# P46 — Northern Lands

P46 allows persistent structures on owned Tundra while leaving Tundra's ordinary zero-Capacity, spawn, terrain-combat, acquisition, and movement semantics intact. This creates genuinely new infrastructure-placement candidates rather than changing structure strength.

Extended Infrastructure support therefore generates legal Tundra build candidates and evaluates whether otherwise low-economic terrain creates useful defensive, positional, coastal, observation, or strategic-weapon geometry. `TERRAIN_DEPENDENCE` reflects that the additional placement freedom matters only where useful Tundra exists.

**Strategic philosophy:** exploit normally infrastructure-hostile Tundra as a new strategic construction surface without pretending it becomes ordinary productive land.

---

# P47 — This Is Poison

P47 charges the capturing enemy an additional Population loss whenever one of this faction's Marsh cells is successfully captured. Marsh territory can therefore become an attritional trap whose loss hurts the attacker more than ordinary geography would suggest.

Extended Forecast/Defense/Retreat support can value Marsh as territory that is sometimes worth contesting, trading, or allowing an opponent to take when the resulting Population tax improves the wider position. Character Doctrine decides whether to deliberately lean into sacrificial use.

**Strategic philosophy:** make Marsh conquest painful enough that selected territorial losses can become attritional exchanges rather than pure defeat.

---

# P48 — Aqua's Blessing

P48 makes owned Shallow Water population-bearing and grants +1 Population Capacity per cell while retaining all other Shallow-Water movement/buildability rules. The result is unusual Capacity geography: water can support Population without becoming normal land or infrastructure space.

Extended Territory/Economy/Forecast/Expansion support therefore values Shallow Water as Capacity-bearing territory while preserving its traversal/build restrictions. `TERRAIN_DEPENDENCE` is necessary because map water distribution directly controls the trait's strategic ceiling.

**Strategic philosophy:** turn owned Shallow Water into demographic territory, expanding Capacity through geography that remains operationally unlike land.

---

# P49 — Laughing Man

P49 replaces the normal information role of Observation Posts. They no longer grant tactical observation; their completed-level radius instead becomes an enemy-intelligence blackout that conceals this faction's units, structures, and manifested operational state inside it.

This requires a transformed Observation planner, not a normal coverage planner with different numbers. Extended support must understand the loss of own observation benefit, generate blackout-oriented placements, value protected assets/staging areas, and forecast what remains concealed or becomes exposed. `GAIN_INFORMATION_ADVANTAGE` again describes the relative advantage created by denying the opponent information.

**Strategic philosophy:** use Observation infrastructure as counterintelligence cover rather than reconnaissance, creating zones where the opponent knows less about your actual operational state.

---

# P50 — Iserlohn Fortress

P50 makes Forts project offensive pressure equal to their ordinary defensive-pressure magnitude across existing Fort coverage. Unlike P18's source-cell-specific doubled offensive lane rule, P50 turns the Fort's whole coverage area into general offensive support geometry.

Extended Opportunity/Forecast/LandWar/Infrastructure support therefore values Fort placement as simultaneous defense and broad attack support without converting Forts into a mandate to initiate war. P09, P18, P24, and P37 are especially important later synergy partners because they all alter the value or creation of the same Fort system.

**Strategic philosophy:** turn Forts into general-purpose command anchors that support both holding ground and projecting force across their coverage.

---

## Batch consistency notes

### Batch 1 — P01–P10

Nine are generic mechanics-aware cases; only P05 requires extended support. P10 added the reusable `REDUCE_INTERCEPTION_WINDOW` affordance.

### Batch 2 — P11–P20

P11, P17, P18, and P19 are extended because they create threshold, sequencing, cross-domain geometry, or contact-count relationships. The rest are generic.

### Batch 3 — P21–P30

P21, P23, P24, P26, P27, P28, P29, and P30 are extended because they create sequencing, role transformation, one-shot timing, cross-domain economics, or mobile-launch semantics. P22 and P25 remain generic.

### Batch 4 — P31–P40

P31–P35 and P37–P40 are extended; P36 is generic. Important future combinations include P07+P33, P05+P34, P16+P35, the Fort family, P11/P27/P40 SAM interactions, and P12/P32/P37 Transport interactions.

### Batch 5 — P41–P50

All ten require extended support. This is expected: the batch is dominated by role transformations, cross-resource purchases, transformed information systems, terrain-reclassification/buildability changes, and infrastructure whose strategic role changes rather than simple exposed scalar modifiers.

No new generic support literal is required. P45 and P49 both fit the existing `INFORMATION` theme, `GAIN_INFORMATION_ADVANTAGE` affordance, and `OBSERVATION` synergy vocabulary; their much more specific counterintelligence semantics remain in typed support hooks rather than expanding the global enum catalogue prematurely.

No explicit `OriginCombinationSupport` entry is closed yet. Especially important candidates retained for the mandatory post-trait sweep now include P17+P41, P43+P44, P45/P49 information-denial interactions, P46 with terrain-sensitive structure mechanics, P48 with Population-growth mechanics, and P09/P18/P24/P37/P50 Fort combinations.
