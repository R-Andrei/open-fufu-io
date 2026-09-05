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
Configured Official Origins: 40 / 49
Current canonical roster coverage: first 40 in library/UI order
Remaining Official Origins: 9
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

## O37 — Hacker's Paradise

P49 and P45 reuse `LAYERED_COUNTERINTELLIGENCE`: Observation Posts create blackout zones while owned Forest interiors provide concealed staging space. P17 adds long-horizon upgrade optimization, while N07 sharply constrains infrastructure count and makes every structure slot globally important.

P17 + N07 does not require a special combination rule. The upgrade planner already reasons from the actual owned structure count, so the one-per-type cap simply limits how far the structure-count discount can scale. The AI must not forecast discounts from structures it can never legally own.

**AI identity:** combine layered information denial with a small, carefully placed infrastructure base whose modernization is optimized around the real constrained structure count.

## O38 — I Don't Know Everything

P17 rewards sequencing construction before upgrades, P21 makes each structure type's first purchase consume no FFY while still requiring affordability, and P04 stabilizes response-side counter-response. The result is an infrastructure-preparation build with competent reactive warfare rather than a new transformed mechanic.

N01 and N04 weaken City growth and Mountain FFY respectively, so economic optimization must use the actual terrain and demographic returns rather than assuming every efficient-looking build step compounds equally.

**AI identity:** prepare efficiently, exploit first-purchase and upgrade sequencing, and respond to attacks without requiring a universal omniscient strategy.

## O02 — Fuwa Fuwa Time

Fast Trade Ships, full wartime trade, increased Train throughput, and direct-L5 City purchases create a concentrated high-throughput economy. N07 means only one of each structure type may be owned, turning the City and other infrastructure choices into unusually important placement decisions.

No special combination hook is required. Trade, Train, direct-L5 City, and unique-structure support all act on ordinary economic/infrastructure candidates and can be composed by the existing planners.

**AI identity:** build a compact rich city-state whose few structures deliver unusually high commercial, rail, and City value even during war.

## O39 — A Mere Ten Years

P17, P21, P41, and N07 create one of the strongest infrastructure-sequencing Origins in the library. The first purchase of a City remains subject to P21 affordability, but if legal it consumes no FFY and P41 makes the purchased City immediately level 5. N07 means this may also be the faction's only City.

This still does not require a bespoke combination adapter. P21 already modifies first-purchase cost semantics, P41 already defines the resulting City state, and N07 already defines ownership scarcity. The ordinary infrastructure candidate can therefore carry all three consequences simultaneously, while P17 continues to optimize upgrades for structures that actually have legal upgrade paths.

**AI identity:** turn a tiny infrastructure roster into immediately mature, highly optimized assets through careful purchase and upgrade sequencing.

## O40 — Efficiency Above All

A wide Population-utilization growth profile, structure-count upgrade discounts, and increased Train throughput reward systemic economic optimization. N07 limits the infrastructure roster to one of each type, so P17's discount must be calculated from the real constrained structure count rather than an imagined mass-building strategy.

No combination support is needed because all four effects remain visible to the ordinary economy, infrastructure, and upgrade planners.

**AI identity:** extract maximum efficiency from a deliberately small infrastructure network, balancing Population utilization, rail throughput, and the upgrade discount available from the structures that can legally exist.

## O41 — There Is No Time to Waste

P17, P07, and P41 create rapid continental development: more Train throughput, cheaper upgrades as the infrastructure base grows, and direct-L5 City purchases. P41 also means a newly purchased City has no ordinary paid City-upgrade path left for P17 to optimize; the AI must not invent one.

N13 makes amphibious landings costly in Population, keeping the Origin's development advantage primarily continental unless a sea-borne operation remains worthwhile after the real landing loss.

**AI identity:** accelerate mature land development and rail throughput without wasting planning effort on development paths that direct-L5 Cities have already bypassed.

## O42 — The Stars Are Within My Grasp

Larger Initial Territory provides a broader starting position, while P17 and P07 reward subsequent infrastructure/rail scaling. N01 weakens City growth and N04 reduces Mountain FFY, making the larger opening valuable without making every part of it equally productive.

The ordinary spawn, economy, and infrastructure layers can compose these effects directly.

**AI identity:** convert a broad opening footprint into fast infrastructure and rail scaling while steering development away from comparatively weak demographic/economic surfaces.

## O07 — The Fake Is of Far Greater Value

P30 transforms Warships into fast piracy platforms that cannot use ordinary naval gunfire against ships. P31 gives those Warships stronger Port repair sustain, while P06 improves the faction's own Trade Ship throughput. N13 makes amphibious landing projection costly.

P30 + P31 does not need a dedicated combination hook. P30 already generates/evaluates piracy routes and transformed Warship behavior; P31 already values repair fields and repair-oriented retreat. A capable Naval planner can therefore route piracy around sustainable Port access without a new candidate type.

**AI identity:** run a fast commerce-and-piracy economy whose Warships survive through prepared repair bases rather than conventional fleet combat.

## O05 — The Country Mouse

P37, P32, and P12 all feed the same amphibious planning stack: Transports are faster and armored, must embark from Ports, cost extra FFY to launch under P37, and successful landings create level-1 Forts. The combination is powerful but remains an ordinary amphibious candidate with richer route, survivability, cost, and beachhead consequences.

N12 prevents Warship construction but does **not** suppress Transport/amphibious support. `NO_WARSHIPS_SUPPRESSES_WARSHIP_DEPENDENT_SUPPORT` only removes support belonging to Warship-dependent positive traits; P12, P32, and P37 remain fully active. N01 weakens City growth.

**AI identity:** conduct fast armored Port-launched invasions that pay more upfront but arrive with durable fortified beachheads, despite having no conventional Warship fleet.

## O43 — King of Apparitions

P23 + P22 reuses `ELITE_SINGLE_FLAGSHIP_PROGRESSION`: one stronger Warship can progress beyond the normal rank ceiling. P31 then gives that unique flagship stronger Port repair sustain, while N07 means only one Port may be owned.

No extra flagship-repair combination is necessary. P23/P22 already establish the extreme value of preserving the veteran flagship, P31 already values repair coverage and repair retreats, and N07 already makes Port placement globally scarce. Those independent support components converge on the same naval plan naturally.

**AI identity:** preserve one irreplaceable veteran flagship around one exceptionally important naval base, treating both ship and Port as globally strategic assets.

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
- O33 requires `REVERSIBLE_SCORCHED_EARTH` plus the reusable `RADIOACTIVE_FALLOUT_ADVANCE` combination;
- O34 also requires `RADIOACTIVE_FALLOUT_ADVANCE`;
- 0/10 need named-Origin-specific support;
- O26, O27, O29, O30, O33, and O34 contain N12, but none selects a Warship-dependent positive trait, so its generic suppression matcher removes no otherwise-active support.

### Fourth 10

All fourth-batch Origins compose successfully from the existing support system without adding another generic literal, trait hook, combination rule, suppression rule, or named-Origin escape hatch.

- O37 reuses `LAYERED_COUNTERINTELLIGENCE`;
- O43 reuses `ELITE_SINGLE_FLAGSHIP_PROGRESSION`;
- O39's P21 + P41 + N07 interaction is deliberately handled through ordinary infrastructure-candidate composition rather than a bespoke combination rule;
- O07's piracy + Port-repair interaction and O05's armored/fast/fortified amphibious interaction likewise remain ordinary planner composition rather than new candidate types;
- O05 contains N12, but its selected positive traits are Transport/amphibious traits rather than Warship-dependent traits, so their support remains active;
- 0/10 need named-Origin-specific support.

Across the first 40 Origins, named-Origin-specific support remains **0/40**. The reusable support architecture continues to absorb substantial build variety without producing a characterless per-Origin controller layer.
