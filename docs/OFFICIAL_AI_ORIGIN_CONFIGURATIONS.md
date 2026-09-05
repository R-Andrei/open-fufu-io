# Open Fufu — Official AI Origin Configuration Rationale

## Status and authority

This document is the single canonical **rationale/strategic-intent companion** for named Official-Origin AI configuration.

Exact code-readable mappings live only in:

- `design/official-ai/origin-configurations.config.ts`

That configuration file is authoritative for exact AI-facing Origin mappings, required reusable combination-support IDs, profile assertions, validation focuses, and any rare named-Origin-specific support.

Other authorities remain separate because they own different concerns:

- `OFFICIAL_ORIGINS.md` — actual Official Origin roster, names, trait membership, and gameplay content;
- `ORIGIN_TRAIT_CATALOGUE.md` — actual trait mechanics/costs;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` — generic support composition/suppression/adaptation semantics;
- `OFFICIAL_AI_TRAIT_SUPPORT.md` — trait-level AI strategic rationale.

A named-Origin configuration does **not** duplicate the entire derived `OriginStrategicProfile`. The complete profile is derived from the Origin's canonical trait membership, trait support, support suppression, additive combination support, final effective rules, and only then any genuinely necessary named-Origin support.

## Progress

```text
Configured Official Origins: 30 / 49
Current canonical roster coverage: first 30 in library/UI order
Remaining Official Origins: 19
```

O35 is retired; the canonical roster currently contains 49 active Official Origins.

---

# Configured Official Origins

## O08 — Business as Usual

Faster Trade Ships and improved Forts compose normally. No special combination or named-Origin support is necessary.

**AI identity:** reliable trade throughput plus broadly useful defensive infrastructure without forcing a specialist strategy.

## O09 — Head Start

Larger Initial Territory and faster trade are paired with weaker City growth. The controller should exploit the stronger opening without forgetting the weaker long-term demographic contribution.

**AI identity:** convert an early geographic/trade lead into position before weaker City growth matters.

## O10 — Home Field Advantage

Improved Forts, Mountain defense, Highland offense, and weaker Plains offense create a terrain-sensitive prepared-position Origin. Normal terrain/Fort reasoning already composes the pieces correctly.

**AI identity:** choose where to fight carefully and make prepared/high-ground geography do more of the work.

## O11 — Light Music Club

Fast Trade Ships, full wartime trade value, and increased Train throughput create a resilient mixed commerce/rail economy, offset by weaker City growth.

**AI identity:** maintain high economic throughput even while conflict disrupts less specialized economies.

## O12 — One Punch

The one-Warship cap and extended Warship rank ceiling create a genuine combined strategy: a single increasingly valuable veteran flagship. This uses reusable trait-combination support rather than named-Origin code.

**AI identity:** preserve, position, and grow one elite naval asset rather than distribute power across a fleet.

## O13 — Bomb Girl

The Origin is defined by Hydrogen-only strategic-weapon specialization with larger blast area and higher cost. The single trait's support already describes the strategic problem.

**AI identity:** commit only when an oversized Hydrogen strike justifies its price.

## O14 — Bocchi Time

The split-start trait replaces ordinary Strategic Spawn with two half-area regions and two origins. Trait support already owns pair generation/evaluation, so no named-Origin support is necessary.

**AI identity:** use two starting footholds coherently while respecting split-front and isolated-core risk.

## O15 — Kessoku Band

Forts also support offense while Command Posts also support defense. Their reusable combination support treats them as complementary general-support infrastructure.

**AI identity:** build a positional support network in which offensive and defensive infrastructure roles overlap.

## O16 — The Art of Surviving

Automatic defenders survive loss of defended cells. The Origin's trait support already exposes Population-preserving territorial trade and elastic-defense possibilities.

**AI identity:** value survival of fighting Population separately from ownership of every individual cell.

## O17 — Section 9

Observation Posts become blackout infrastructure while owned Forest interiors provide another concealment layer; Plains offense is weaker. Reusable combination support handles the layered counterintelligence geometry.

**AI identity:** shape operations around information denial and concealed staging rather than conventional observation/control geometry.

---

## O01 — A True Warrior Needs No Sword

Elastic automatic defense, improved Forts, and Mountain defense all reinforce Population-preserving territorial resistance. Weaker Plains offense and lethal amphibious attrition make projection substantially less attractive, but those drawbacks remain ordinary effective-mechanics literacy rather than requiring bespoke Origin logic.

The controller should not interpret the Origin as “never lose territory.” P38 specifically makes selective territorial loss more tolerable because the automatic defender survives, so a capable character may still trade ground when that preserves Population or creates a better defensive shape.

**AI identity:** preserve fighting Population behind strong prepared terrain and Forts, accepting that overseas and exposed-terrain projection is poor.

## O18 — What Is a True Warrior?

P38 defender survival combines naturally with P04's stable response-side counter-response and Mountain defense. The result strongly rewards defending reactively and efficiently without requiring a new combined mechanic: each support component already sees final effective exchange and terrain values.

N13 makes amphibious projection costly in delivered Population, so the Origin should normally prefer continental or already-established fronts unless a landing remains worthwhile after the real casualty forecast.

**AI identity:** survive, counter efficiently, and make defensible terrain expensive to attack rather than chase aggressive projection.

## O19 — The Magician

Stable counter-response, full wartime trade value, and defender survival create a resilient reactive economy/defense package, while N07 makes every owned structure type a unique strategic asset.

No new combination hook is necessary. N07's scarcity support already makes infrastructure placement/loss globally important, while ordinary trade and defensive support can reason around those unique assets.

**AI identity:** remain economically functional under pressure, preserve forces, and extract maximum value from a tiny set of irreplaceably important infrastructure roles.

## O20 — A War Worth Avoiding

Full wartime trade, a broad Population-utilization growth window, free-FFY first purchases, and one-per-type infrastructure create a peaceful-development Origin with unusually efficient initial infrastructure establishment.

P21 and N07 interact strongly, but do not require bespoke combination support: P21 already distinguishes legal affordability from actual zero-FFY consumption, while N07 already treats each structure-type slot as globally scarce. Their ordinary composition is sufficient for a planner to value the first-and-only purchase correctly.

**AI identity:** build a compact, efficient economy that prefers growth and commerce but stays financially functional if conflict is imposed on it.

## O21 — Iron-Blooded Vampire

Defender survival and the broad Population-utilization growth profile reinforce continental persistence. N12 removes self-built Warships and N01 weakens City-driven growth, so the controller must not assume naval projection or ordinary City scaling will solve strategic problems.

The generic `NO_WARSHIPS_SUPPRESSES_WARSHIP_DEPENDENT_SUPPORT` rule technically matches because N12 is present, but this Origin contains no Warship-dependent positive trait support to remove. The composed profile therefore loses no otherwise-active strategic contribution.

**AI identity:** survive and regenerate on land, making territorial conquest costly while accepting weak conventional naval reach and weaker City growth.

## O22 — Survival of the Fittest

Contact-count offense, Fort-pressure bypass, and Highland offense produce an aggressive geography-sensitive Origin. P19 rewards contact but its support explicitly retains split-front risk; the AI must not blindly maximize the number of neighbors merely because each active contact raises offense.

Reduced City growth and Mountain FFY further discourage treating all geography as equivalent. Highland attack staging can be excellent while Mountain-centered economic events are comparatively poor.

**AI identity:** seek advantageous aggressive contact and break prepared positions, but distinguish useful exposure from strategically suicidal overextension.

## O04 — Right of Conquest

This is the batch's only Origin that activates explicit reusable combination support, and it activates two entries.

`CONQUEST_FACTORY_SNOWBALL` combines P05 and P34: taking a hostile Factory produces conquest FFY while the captured Factory then operates at double effect. `CONQUEST_ONLY_INDUSTRY` combines P34 and N09: the faction cannot build Factories, so captured hostile industry is not merely a bonus but the principal route to Factory capability.

Highland offense helps create acquisition opportunities while weaker Plains offense makes route/terrain selection matter. No named-Origin-specific support is needed because the reusable combination layer already captures both strategic loops.

**AI identity:** fund expansion through conquest and seize enemy industrial capacity intact because domestic Factory construction is unavailable.

## O23 — Woolong Hustle

Conquest FFY, uninterrupted wartime trade value, and faster Trade Ships make both war and commerce potential profit engines. These systems remain independent enough that normal composition is sufficient; the AI can compare commercial and conquest opportunities through the shared economy/opportunity model.

N13 makes amphibious landings Population-inefficient, preventing the economic incentives from implying reckless overseas conquest.

**AI identity:** keep money moving through trade and opportunistic conquest while avoiding sea-borne commitments whose delivered Population does not justify the cost.

## O24 — 203rd Mage Battalion

Heavy Artillery replaces Tanks, Highland offense improves favorable staging, and P19 rewards broader active contact. Together they create a continental multi-front artillery doctrine without introducing a new transformed mechanic beyond P43 itself.

The controller must still respect Heavy Artillery's low mobility, long reload, close-range vulnerability, and expensive failure. P19's contact bonus should therefore encourage useful theaters and pressure, not unsupported artillery spread across every possible border.

N12 prevents Warship construction and N01 weakens City growth. As with O21, the generic no-Warships suppression rule has no positive Warship-dependent support to remove in this Origin.

**AI identity:** use positional long-range artillery to exploit selected high-value fronts, growing stronger from useful contact without confusing more fronts with automatically better strategy.

## O25 — If I Can Imagine It

P03 reduces the value of enemy Fort defensive pressure while P43 supplies long-range Heavy Artillery and P15 rewards Highland offensive staging. These mechanics compose directly: artillery planners use final effective target/terrain values and can prefer standoff positions from which prepared defenses matter less.

N12 removes self-built Warships and N01 weakens City growth. Again, no selected positive Warship support is present for the generic N12 suppression rule to remove.

No dedicated P03+P43 combination hook is needed because neither trait creates a new candidate form when combined; P43 already generates artillery plans and the ordinary effective combat model already reflects the Fort-pressure bypass.

**AI identity:** break prepared land positions from favorable terrain using Heavy Artillery while remaining fundamentally continental.

---

## O26 — A Rational War

Conquest FFY, Heavy Artillery, and fixed response-side counter-response compose into a disciplined continental war economy. There is no new mechanical loop that requires a combination adapter: P05 values captured structures, P43 owns artillery candidate generation/positioning, and P04 changes the real counter-response exchange curve.

N12 removes Warship construction and N01 weakens City growth; neither suppresses any selected positive support entry.

**AI identity:** prosecute deliberate artillery warfare in which captured infrastructure finances continued pressure and counter-response commitments remain economically measured.

## O27 — Ordinary Offensive Magic

Heavy Artillery and Hydrogen-only strategic weapons are two independent long-range force packages. They reinforce the same broad standoff fantasy, but do not create a transformed action or dependency that needs bespoke combination support.

The controller should compare artillery and Hydrogen expenditure through ordinary opportunity-cost/forecast reasoning rather than blindly stacking both forms of long-range force on the same target.

**AI identity:** solve hard land positions with standoff force, choosing between repeatable artillery pressure and expensive oversized Hydrogen strikes.

## O28 — The Height of Magic

Hydrogen-only strategic weapons gain faster projectile delivery while giant single-charge SAMs create unusually broad but low-throughput defense. N07 then makes the relevant infrastructure globally scarce because only one of each structure type may be owned.

No new combination hook is necessary: strategic-weapon forecasting already uses actual projectile speed, P40 already models single-charge shield behavior, and N07 already prices unique infrastructure placement/loss.

**AI identity:** concentrate strategic offense and defense into a small number of exceptionally consequential assets whose timing and placement must be deliberate.

## O29 — Serious Series

P43 + P44 activates the canonical `RADIOACTIVE_HEAVY_ARTILLERY` support. Heavy Artillery can therefore create Fallout and territorial neutralization from standoff range, turning artillery fire into geography manipulation rather than merely Population damage.

N12 keeps the build continental and N01 weakens ordinary City growth.

**AI identity:** erode enemy territory from range with radioactive Heavy Artillery, exploiting topology and denial opportunities without exposing slow artillery unnecessarily.

## O30 — Being X

The faction begins with a Missile Silo, launches strategic warheads at greatly increased speed, and replaces Tanks with Heavy Artillery. These advantages share a long-range theme but remain mechanically independent enough for ordinary composition.

N03 makes Desert defense weaker, so the existence of strong long-range tools must not make the controller indifferent to defensive geography.

**AI identity:** begin strategically armed and apply fast-delivery weapons plus artillery pressure while respecting weak Desert defensive positions.

## O31 — Hell's Snipe

A free starting Silo gives immediate access to the Origin's Hydrogen-only strategic doctrine. N11 creates a separate spatial tradeoff: FFY events occurring inside SAM coverage yield nothing.

This does not require a new strategic-weapon/SAM combination. The controller should independently value Hydrogen strike timing and SAM placement while accounting for the economic exclusion geometry created by defensive coverage.

**AI identity:** exploit immediate specialized Hydrogen access while placing defensive SAM coverage carefully enough not to sterilize valuable economic space.

## O32 — Watchtower

P11 + P40 activates `POPULATION_SCALED_GIANT_SAM_NETWORK`: Population growth unlocks additional zero-FFY SAM slots, while each SAM is a huge one-charge shield. N11 then makes every coverage decision economically costly because FFY events inside SAM areas yield zero.

N11 does not require a third bespoke combination rule. Its existing infrastructure/defense tradeoff hooks already evaluate the economic cost of the giant coverage produced by the P11+P40 network.

**AI identity:** build a Population-scaled strategic shield network, but treat every additional coverage footprint as a defense-versus-economy geometry decision.

## O33 — Everything Will Turn to Ash

This Origin activates two reusable Fallout combinations.

`REVERSIBLE_SCORCHED_EARTH` covers P16 + P35: deliberately relinquished cells become Fallout, while P16 makes later reacquisition comparatively easy. The newly added `RADIOACTIVE_FALLOUT_ADVANCE` covers P16 + P44: Radioactive Munitions can create Fallout during offensive territorial neutralization, while P16 prevents the faction from suffering the ordinary Fallout-capture resistance when following through that contaminated geography.

The combination support is reusable rather than Origin-specific because O34 shares the P16+P44 loop.

**AI identity:** treat Fallout as a controllable strategic medium—create it offensively or defensively, deny geography with it, and remain unusually capable of moving territorial ownership back through the contamination later.

## O34 — The Dose Makes the Poison

P44 + P16 activates the reusable `RADIOACTIVE_FALLOUT_ADVANCE` combination: radioactive Population attacks can reshape/contaminate enemy territory without imposing the ordinary Fallout-capture resistance on this faction's subsequent advance.

P47 adds a separate Marsh attrition tool, making some owned Marsh cells expensive for enemies to capture. This composes normally with the Fallout package rather than requiring a three-way adapter.

**AI identity:** make hostile geography costly in two different ways—Fallout shaping during offense and Population-taxing Marsh defense—while remaining unusually comfortable advancing through contaminated ground.

## O36 — Radical Edward

Tundra construction, Shallow-Water Capacity, Fallout-resistance bypass, and half-cost neutral settlement all broaden what the controller can regard as useful expansion geography. The traits modify different terrain/economy dimensions, so no bespoke combined mechanic is necessary.

N13 keeps amphibious projection risky despite the Origin's unusual relationship with Shallow Water; Capacity value must not be mistaken for safe Transport landings.

**AI identity:** find settlement and infrastructure value in terrain that ordinary factions treat as awkward, while distinguishing ownership value from amphibious safety.

---

## Batch consistency results

### First 10

All first ten configured Origins compose successfully from the completed trait-support catalogue.

- 3/10 need reusable **trait-combination** support: O12, O15, O17;
- 0/10 need named-Origin-specific support;
- 0/10 remove any support through suppression.

### Second 10

All next ten configured Origins also compose successfully from the existing trait-support catalogue.

- 1/10 needs reusable **trait-combination** support: O04;
- O04 requires two reusable combination entries: `CONQUEST_FACTORY_SNOWBALL` and `CONQUEST_ONLY_INDUSTRY`;
- 0/10 need named-Origin-specific support;
- O21, O24, and O25 contain N12, so the generic no-Warships suppression matcher applies, but none contains a Warship-dependent positive support entry; therefore no otherwise-active support contribution is removed.

### Third 10

All third-batch Origins compose successfully after one reusable omission from the trait-wide sweep was corrected.

- O29 requires the existing `RADIOACTIVE_HEAVY_ARTILLERY` combination;
- O32 requires the existing `POPULATION_SCALED_GIANT_SAM_NETWORK` combination;
- O33 requires `REVERSIBLE_SCORCHED_EARTH` plus the new reusable `RADIOACTIVE_FALLOUT_ADVANCE` combination;
- O34 also requires `RADIOACTIVE_FALLOUT_ADVANCE`, confirming that the new support belongs at trait-combination level rather than as named-Origin logic;
- 0/10 need named-Origin-specific support;
- O26, O27, O29, O30, O33, and O34 contain N12, but none selects a Warship-dependent positive trait, so its generic suppression matcher removes no otherwise-active support;
- no new strategic literal or named-Origin escape hatch was required.

Across the first 30 Origins, named-Origin-specific support remains **0/30**. The only architecture correction in this batch was adding one reusable P16+P44 combination that applies to multiple Origins.
