# Open Fufu — Official AI Trait Support Rationale

## Status and authority

This document is the single canonical **rationale/strategic-intent companion** for Official-AI Origin-trait support.

Exact code-readable mappings live only in:

- `design/official-ai/origin-trait-support.config.ts`

That file is authoritative for exact support modes, themes, affordances, cautions, synergy tags, hook IDs, additive combination support, and support-suppression rules.

This document owns only:

- why a trait needs the kind of AI literacy it does;
- the strategic philosophy a competent controller should be able to derive from it;
- important semantic boundaries and non-obvious interactions.

It does **not** repeat complete configuration objects or gameplay arithmetic.

Other authorities remain separate because they own different concerns:

- `ORIGIN_TRAIT_CATALOGUE.md` — actual trait mechanics, costs/refunds, and gameplay semantics;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` — reusable support/composition/adaptation contract;
- `OFFICIAL_AI_CONFIGURATION.md` — shared AI signal/goal/planner/profile vocabulary.

Any trait change must update the gameplay trait catalogue, this rationale when strategic intent changes, the canonical config mapping, and affected combination/suppression cases in the same change.

---

# Positive traits

## P01 — Domain Expansion

Strategic Spawn must reason from the larger real starting footprint rather than assume baseline size. More starting geography is positional opportunity, not an automatic mandate to create more fronts.

**Strategic philosophy:** begin with more geography and exploit the positional head start.

## P02 — The Era of Humans

The wider Population-utilization sweet spot makes demographic recovery and sustained growth more forgiving. Shared economy/forecast reasoning should use the actual effective growth function rather than a trait-specific demographic brain.

**Strategic philosophy:** sustain growth across a broader Population-utilization range.

## P03 — Imagine Breaker

Enemy Fort defensive pressure constrains this faction less than normal. That makes prepared positions easier to challenge without implying that Forts should always be attacked.

**Strategic philosophy:** static Fort defense is less capable of dictating where the faction may fight.

## P04 — Level 0

Counter-response effectiveness no longer follows the ordinary response-side imbalance curve. The controller must judge the actual exchange rather than assume vanilla rewards for numerical overcommitment.

**Strategic philosophy:** counter effectively without needing numerical overcommitment to gain response efficiency.

## P05 — Big Shot

Capturing hostile structures becomes conquest, capability denial, and immediate FFY generation at once. This cross-domain consequence must be visible to target selection and forecasting.

**Strategic philosophy:** conquest can finance further conquest.

## P06 — See You, Space Cowboy

Trade Ships move faster without changing their fundamental role. Shared economic reasoning should turn the real travel-time improvement into higher trade throughput.

**Strategic philosophy:** faster trade cycles increase the value of trade-oriented development.

## P07 — Galaxy Express 999

The Factory/Train economy produces more ordinary Train traffic. This should increase the value of productive rail networks without creating a separate Train-control doctrine.

**Strategic philosophy:** increase industrial-network throughput.

## P08 — Tea Time

War no longer suppresses ordinary trade yield. The faction can maintain commerce through conflict, but the mechanic does not itself make initiating wars desirable.

**Strategic philosophy:** war and commerce need not be mutually exclusive.

## P09 — Wall Maria

Forts become broader, stronger, and cheaper. The ordinary infrastructure/territory stack should see the actual improved Fort values rather than receiving a bespoke Fort doctrine.

**Strategic philosophy:** static defensive investment buys more protection for less FFY.

## P10 — Scorpion's Tail

Faster strategic warheads compress the physical opportunity available for interception. This is delivery reliability, not a change to interception rules themselves.

**Strategic philosophy:** reduce the defender's interception window.

## P11 — Level Upper

Peak Population thresholds permanently unlock free-SAM ownership/build slots. AI must value progress toward future unlocks as well as the completed defense network.

**Strategic philosophy:** convert demographic growth into progressively broader strategic defense.

## P12 — Somewhere Not Here

Transport speed improves without changing Transport role. Shared amphibious reasoning should recognize shorter transit, lower exposure duration, and more viable distant operations.

**Strategic philosophy:** shorten amphibious transit and make distant sea-borne operations more practical.

## P13 — Mountain Training Arc

Mountains become unusually strong defensive ground. The bonus matters only when the geography itself is strategically useful.

**Strategic philosophy:** use Mountain geography as efficient defensive terrain.

## P14 — 60 Billion Double Dollars

Located FFY events on Desert become more valuable. Economy and geography should combine naturally rather than producing a hard-coded preference for Desert everywhere.

**Strategic philosophy:** turn useful Desert geography into an unusually profitable economic surface.

## P15 — The High Ground

Highlands become stronger offensive staging ground. The controller should exploit them when fighting, not seek conflict merely because a Highland bonus exists.

**Strategic philosophy:** acquire and exploit Highlands for offensive pressure.

## P16 — Poison Taster

Ordinary Fallout acquisition resistance is ignored. Territorial reasoning should use the real capture progress and recognize that contaminated terrain is relatively easier for this faction to consume.

**Strategic philosophy:** Fallout does not slow territorial acquisition.

## P17 — Ten Billion Percent

Upgrade cost improves as owned structure count rises, creating a sequencing problem between construction now and modernization later. This is a genuine long-horizon infrastructure optimization relationship.

**Strategic philosophy:** broaden the infrastructure base to compound into cheaper modernization.

## P18 — The Best Defense

Fort-covered attacking source cells gain offensive support, so Fort placement can prepare future attacks as well as defense.

**Strategic philosophy:** fortify the ground from which you intend to project force.

## P19 — The Weak Die First

Current Territorial Contact count increases offensive pressure globally. Another contact may increase strength elsewhere while also creating another exposed border.

**Strategic philosophy:** convert geopolitical exposure into offensive momentum without blindly maximizing fronts.

## P20 — A Miracle Is Merely a Miscalculation

The faction begins with strategic-launch infrastructure already present. Once granted, the Silo follows ordinary strategic-weapon planning.

**Strategic philosophy:** exploit earlier access to strategic-launch capability.

## P21 — Fun Things Are Fun

The first purchase of each structure type remains subject to affordability/legality but consumes no FFY. AI must distinguish having enough money to qualify from actually spending that money.

**Strategic philosophy:** turn sufficient liquidity into unusually efficient first-time infrastructure.

## P22 — Limit Break

Warships may rank beyond the ordinary ceiling. The extra value appears over time, increasing the importance of veteran-ship preservation.

**Strategic philosophy:** invest in veteran Warships with a higher long-run ceiling.

## P23 — Space Battleship Yamato

The faction is limited to one stronger Warship. Naval power therefore becomes concentrated into one globally important asset whose position and survival matter far more than an ordinary hull.

**Strategic philosophy:** concentrate naval power into one elite flagship.

## P24 — A King's Price

FFY events inside Fort coverage gain extra yield. Fort placement therefore affects economic geography as well as defense.

**Strategic philosophy:** turn Fort coverage into protected higher-yield territory.

## P25 — EXPLOSION!

Strategic-weapon access specializes around larger, more expensive Hydrogen Bombs while Atom Bomb and MIRV access disappear. Ordinary weapon legality/cost/blast reasoning should operate on that specialized arsenal.

**Strategic philosophy:** trade weapon variety for exceptional Hydrogen-strike area.

## P26 — Serious Punch

MIRV becomes a single-use strategic opportunity whose successful use consumes no FFY but still requires ordinary affordability and legality. Timing the irreplaceable opportunity is the strategic problem.

**Strategic philosophy:** preserve and spend one decisive MIRV opportunity only when its value is exceptional.

## P27 — Only My Railgun

SAM Launchers may also attack ships. Coastal SAM placement becomes a cross-domain decision between strategic interception and naval denial.

**Strategic philosophy:** make SAM infrastructure double as coastal area denial.

## P28 — Blood Devil

Destroying hostile Transports transfers their carried Population to this faction. Cargo-bearing invasion forces become potential demographic prizes without granting hidden cargo knowledge.

**Strategic philosophy:** convert destroyed invasion Population into your own available force.

## P29 — The Kaiser

Warships may act as mobile Missile Silo launch platforms. Naval position, veterancy, survival, and strategic-weapon access become directly coupled.

**Strategic philosophy:** turn veteran Warships into mobile strategic-launch infrastructure.

## P30 — The Conman

Warships become faster, highly profitable piracy platforms but lose ordinary naval gunfire against ships. They must be understood as a transformed economic-raiding role, not ordinary combat Warships with better speed.

**Strategic philosophy:** replace conventional naval battle with high-speed economic predation.

## P31 — Heart-Under-Blade

Port repair fields become stronger operational sustain zones for Warships while ships remain active. Ports gain value as naval bases, fallback points, and sustained-combat anchors.

**Strategic philosophy:** fight around prepared naval bases and preserve expensive Warships through repair coverage.

## P32 — Armored Titan

Transports gain real health but may embark only from owned active Ports. Amphibious strategy trades launch flexibility for survivability and infrastructure dependence.

**Strategic philosophy:** organize durable invasion shipping around Port infrastructure.

## P33 — Misaka Network

Train-triggered City events also replenish Population and scale with City level. Train/City network topology becomes a demographic engine as well as an economic network.

**Strategic philosophy:** convert productive rail infrastructure into Population replenishment.

## P34 — Spoils of the Empire

Conquered Factories operate better than ordinary domestic Factories. Provenance matters: hostile industry can become an unusually valuable conquest target.

**Strategic philosophy:** seize enemy industry intact and make conquest outperform equivalent domestic production.

## P35 — It's a Matter of Visualization

Deliberately relinquished cells become neutral Fallout. Retreat can therefore reshape geography and create temporary denial, at the cost of making your own future reacquisition less convenient.

**Strategic philosophy:** weaponize retreat by trading ownership for temporary denial and positional distortion.

## P36 — Half-Priced Bento

Neutral settlement costs half the ordinary Population. Shared expansion reasoning should simply use the lower real Population cost.

**Strategic philosophy:** convert neutral geography into Capacity with unusually low Population expenditure.

## P37 — The City Mouse

Amphibious embarkation costs more FFY, while a successful landing creates an exact-cell Fort grant opportunity. A competent forecast must value the Fort only when canonical occupancy, placement, and ownership admission will actually allow the grant; an inadmissible Fort does not undo the landing.

**Strategic philosophy:** pay more to invade, but exploit successful landings as durable fortified second fronts when the beachhead can actually admit the Fort.

## P38 — Return by Death

Automatic defenders survive when their defended cell is captured. The controller can distinguish losing territory from losing the fighting Population attached to that territory.

**Strategic philosophy:** preserve fighting Population even when ground is lost.

## P39 — Stereo Separation

P39 gives the faction two starting cores in every spawn mode. Strategic Spawn must generate and evaluate the pair; Random and Fixed Spawn provide resolved origins, after which the same two-core position, coordination, and isolation reasoning applies. Starting Population remains global.

**Strategic philosophy:** begin from two strategic footholds, trading coordination risk for broader access and multi-theater possibility.

## P40 — Barrier Magic

SAMs become large-area, exactly-one-charge shields with slower recharge. Coverage is exceptional, throughput is poor, and wasting the lone charge can be strategically serious.

**Strategic philosophy:** protect a large area with a sparse shield whose single charge must matter.

## P41 — Level 5

A purchased City uses one ordinary City construction interval and then completes directly at level 5, without intermediate level builds/upgrades. The decision combines high upfront liquidity with a short inactive setup window followed by a mature high-level payoff.

**Strategic philosophy:** concentrate City investment into one-step mature infrastructure while accounting for the ordinary construction delay before the L5 payoff becomes active.

## P42 — The Price of Empire

Warships cost no FFY but permanently consume Available Population and have reduced range. Sea power is purchased with demographics instead of money.

**Strategic philosophy:** convert Population into naval power, accepting demographic sacrifice and shorter reach.

## P43 — The Devil of the Rhine

All Tanks become Heavy Artillery: slower, more expensive, long-ranged, high-alpha, long-reload units that cannot raid Trains. They require standoff literacy and must never be driven as vanilla Tanks.

**Strategic philosophy:** replace mobile Tank pressure with artillery built around range, timing, and positioning.

## P44 — Nobel Prize

Successful armor Population attacks neutralize cells and apply Fallout. Firepower becomes territorial shaping, connectivity denial, and Capacity destruction as well as direct damage.

**Strategic philosophy:** use armor fire to damage the strategic usefulness of enemy geography itself.

## P45 — Hidden Leaf Village

Owned Forest interiors deny enemy tactical observation while necessary boundary/manifested information remains visible. Forest becomes concealed operational space rather than simply combat terrain.

**Strategic philosophy:** use Forest as protected staging space that denies the opponent information.

## P46 — Northern Lands

Persistent structures may be built on owned Tundra while Tundra retains its other ordinary limitations. This creates genuinely new placement candidates on otherwise infrastructure-hostile terrain.

**Strategic philosophy:** exploit Tundra as a strategic construction surface without pretending it becomes ordinary productive land.

## P47 — This Is Poison

Enemy capture of this faction's Marsh cells inflicts additional Population loss on the captor. Selected Marsh territory can become an attritional trap and sometimes be worth trading.

**Strategic philosophy:** make Marsh conquest painful enough that some territorial losses become useful exchanges.

## P48 — Aqua's Blessing

Owned Shallow Water contributes Population Capacity while retaining unusual traversal/buildability rules. It is demographic territory, not ordinary land.

**Strategic philosophy:** expand Population Capacity through owned Shallow Water.

## P49 — Laughing Man

Observation Posts stop granting own tactical observation and instead create enemy-intelligence blackout zones. Observation infrastructure becomes counterintelligence infrastructure.

**Strategic philosophy:** deny information rather than gather it.

## P50 — Iserlohn Fortress

Forts also project offensive pressure throughout their coverage. They become general force-support anchors rather than purely defensive infrastructure.

**Strategic philosophy:** turn Fort coverage into general-purpose battle-space support.

## P51 — One Flag Beneath the Stars

Command Posts also project defensive pressure. Command coverage therefore contributes to protection as well as offensive support.

**Strategic philosophy:** make Command coverage a two-way force-support network.

## P52 — Humanity Has Declined

Unused Population Capacity generates passive FFY. The gap between Capacity and Total Population becomes an economic state variable rather than merely unused growth room.

**Strategic philosophy:** monetize underpopulation and make empty Capacity an economic asset.

## P53 — Money Is Everything

Ready charges on persistent Missile Silos generate passive FFY. A ready charge is simultaneously strategic capability and productive capital, so firing it creates an economic opportunity cost until replenished.

**Strategic philosophy:** balance the value of using strategic weapons against the income generated by keeping them ready.

## P54 — Starlight Breaker

Initial Territory uses the same thin five-point-star geometry in every spawn mode. Strategic Spawn values candidate star positions before resolution; Random and Fixed Spawn receive resolved origins but still evaluate the resulting frontage, exposure, reach, and corridors rather than treating the shape as a circular start.

**Strategic philosophy:** trade compactness for directional reach and unusual starting geometry.

---

# Negative / drawback traits

Drawbacks receive full AI literacy. A low-difficulty controller may adapt badly, but it should not repeatedly plan around actions or effects the drawback makes impossible.

## N01 — The Lost Decade

Cities contribute less Population Growth.

**Strategic consequence:** City-centered demographic scaling is less efficient.

## N02 — Flat Is Justice

Plains provide reduced offensive pressure.

**Strategic consequence:** Plains are comparatively weak offensive staging ground.

## N03 — I Hate Sand

Desert provides reduced defensive pressure.

**Strategic consequence:** Desert is comparatively poor defensive ground.

## N04 — Northern Expedition

Located FFY events on Mountain yield less.

**Strategic consequence:** Mountain geography is economically inefficient for located FFY events.

## N05 — Curse of the Abyss

Fallout cannot be captured at all. Fallout can therefore become a hard ownership/route barrier rather than merely difficult terrain.

**Strategic consequence:** plans that require owning Fallout are impossible until some other state change removes the barrier.

## N06 — No Second Season

FFY cannot be spent to upgrade buildings. Upgrade illegality should remove ordinary paid-upgrade plans while leaving other legal development paths intact.

**Strategic consequence:** development must rely on construction and non-FFY development paths rather than ordinary paid modernization.

## N07 — One Piece

The faction may own at most one of each structure type. Every structure-type slot becomes globally scarce, making placement and preservation unusually important.

**Strategic consequence:** concentrate each infrastructure role into one carefully chosen asset.

## N08 — It's Just Decoration

Forts provide no ordinary defensive-pressure bonus. Other independently legal Fort roles can still remain useful.

**Strategic consequence:** do not value Forts for a defensive-pressure effect that no longer exists.

## N09 — Medieval Isekai

Factories cannot be built, though legally acquired industry may still be owned and used.

**Strategic consequence:** domestic industrial development cannot rely on constructing Factories.

## N10 — Domain Contraction

Fort coverage is smaller.

**Strategic consequence:** Fort influence is more spatially constrained.

## N11 — Absolute Territory

Located FFY events inside owned SAM coverage yield zero. SAM placement therefore creates a direct defense-versus-economy geography tradeoff.

**Strategic consequence:** strategic-defense coverage can sterilize the economy beneath it.

## N12 — Panzer Vor!

Warships cannot be built.

**Strategic consequence:** self-built Warship strategies and Warship-dependent positive support may become unreachable.

## N13 — Beach Episode Gone Wrong

Half of Transport Population dies on landing.

**Strategic consequence:** amphibious landings require substantially more Population commitment for the same delivered force.

## N14 — To Them Words Are Merely a Means to Deceive

The first hostile capture of a Trade voyage inflicts an additional owner-side FFY loss equal to the voyage's snapshotted ordinary value.

**Strategic consequence:** exposed commerce can turn hostile capture into a direct financial liability.

## N15 — King's Ransom

Transport embarkation costs substantially more FFY.

**Strategic consequence:** every amphibious commitment carries a higher liquidity cost.

## N16 — Insurance Fraud

Successful uncaptured Trade voyages cost the owner their snapshotted value, while hostile capture returns that value once. This deliberately inverts the normal interpretation of trade outcomes.

**Strategic consequence:** ordinary trade success becomes a liability and hostile capture can be comparatively preferable.

## N17 — I Can Cut It

Enemy structures that would ordinarily transfer on conquest are destroyed instead. Hostile infrastructure remains a denial target, but plans must not forecast captured ownership, conquest-spoils FFY, or conquered-Factory production that no longer occurs.

**Strategic consequence:** conquest razes enemy infrastructure instead of turning it into spoils.

## N18 — I Have No Enemies

Final acquisition progress against non-Fallout targets is halved while Fallout is exempt. Shared territorial reasoning should compare real progress by target state.

**Strategic consequence:** conventional territorial acquisition takes more setup/time, making target state and opportunity timing unusually important.

---

# Catalogue-wide composition rationale

## Additive combinations that need explicit reusable support

Most trait combinations are correctly handled by ordinary composition. Explicit combination support is reserved for cases where the pair creates a new planning loop or candidate semantics greater than simply adding two understood effects.

The current V1 sweep identified:

- **P07 + P33:** increased Train throughput directly accelerates the Train-driven Population engine;
- **P05 + P34:** structure-capture income and superior conquered Factories create a conquest/industry snowball;
- **P34 + N09:** Factories cannot be built, making conquest the faction's route to industrial capacity;
- **P16 + P35:** self-created Fallout buffers become comparatively easier for the creator to reacquire;
- **P22 + P29:** the extended Warship rank ceiling enables exceptionally capable veteran mobile strategic launchers;
- **P43 + P44:** Heavy Artillery applies radioactive territorial erosion from standoff range;
- **P11 + P40:** Population-unlocked free SAM slots compose with giant single-charge shields into a sparse large-area network;
- **P22 + P23:** one stronger flagship plus an extended rank ceiling creates a singular veteran-flagship progression strategy;
- **P50 + P51:** Forts and Command Posts become complementary two-way support infrastructure;
- **P45 + P49:** Forest concealment and Observation-post blackouts create layered counterintelligence geometry;
- **P39 + P54:** both split starting footprints use star geometry; Strategic Spawn evaluates the paired star placement, while Random/Fixed consume the resolved split-star state without inventing a spawn-position choice.

Strong but straightforward arithmetic inheritance does **not** need its own combination entry. If final effective mechanics and existing support already produce the correct result, adding a named combination would only duplicate knowledge.

## Support suppression

Legal trait combinations can make another trait's **AI semantics** unreachable or exactly neutralized without making the gameplay combination illegal. Suppression removes only stale AI-support contributions before composition; it never alters actual mechanics or selected trait IDs.

The current V1 sweep identified:

- P25 makes P26's MIRV support unreachable because MIRV access is removed;
- N05 makes P16's Fallout-resistance bypass irrelevant because Fallout cannot be captured at all;
- N06 makes P17's paid-upgrade strategy unreachable;
- N12 makes Warship-dependent support from P22/P23/P29/P30/P31/P42 unreachable when no legal Warship source remains;
- N17 removes P05/P34 capture-spoils semantics because structures are razed rather than transferred;
- N14 + N16 exactly cancel N14's separate first-capture owner-side consequence;
- N06 removes only P53's Silo-upgrade planning support while leaving its base ready-charge economy intact.

Exact suppression targets and hook IDs remain canonical only in `design/official-ai/origin-trait-support.config.ts`.
