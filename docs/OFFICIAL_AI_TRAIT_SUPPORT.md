# Open Fufu — Official AI Trait Support Rationale

## Status and authority

This document is the canonical **design/rationale companion** for Official-AI Origin-trait support.

Concrete code-readable mappings live in the sharded design-time configuration set under:

- `design/official-ai/origin-trait-support*.config.ts`;
- `design/official-ai/origin-combination-support.config.ts` for the completed global synergy/suppression registry.

Those `.config.ts` files are the source of truth for exact support entries, hook IDs, themes, affordances, cautions, synergy tags, combination support, and suppression rules.

This document explains why mappings exist, their strategic philosophy, important exclusions/boundaries, and the completed catalogue-wide composition result. It intentionally does not duplicate full configuration objects.

It remains subordinate to:

- `ORIGIN_TRAIT_CATALOGUE.md` for actual Origin mechanics;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` for generic support/composition/character-adaptation architecture;
- `OFFICIAL_AI_CONFIGURATION.md` for shared AI signal/goal/planner/profile vocabulary.

Nothing here changes Origin mechanics. Numeric/mechanical truth remains in authoritative game rules and final `EffectiveRulesView`.

---

## Progress

```text
Configured traits: 72 / 72
Positive traits:   P01–P54 complete
Drawbacks:         N01–N18 complete
Global synergy/suppression sweep: complete
```

The trait-support phase is closed for the current V1 catalogue. Future trait changes/additions must update both their individual support entry and the composition sweep.

---

# Positive traits

## P01 — Domain Expansion

Strategic Spawn reasons from the larger real footprint rather than assuming baseline size.

**Strategic philosophy:** begin with more geography and exploit the positional head start.

## P02 — The Era of Humans

The widened Population-utilization sweet spot makes demographic recovery more forgiving. Shared economy/forecast reasoning uses the actual effective growth function.

**Strategic philosophy:** sustain growth across a broader Population-utilization range.

## P03 — Imagine Breaker

Enemy Fort defensive pressure matters less to this faction. The trait does not itself mandate attacking Forts.

**Strategic philosophy:** static Fort defense is less capable of dictating where the faction may fight.

## P04 — Level 0

Counter-response effectiveness no longer follows the ordinary response-side imbalance curve. Shared counter-response mechanics expose the actual exchange.

**Strategic philosophy:** counter effectively without needing numerical overcommitment to gain response efficiency.

## P05 — Big Shot

Capturing hostile structures becomes simultaneously conquest, capability denial, and immediate FFY generation.

**Strategic philosophy:** conquest can finance further conquest.

## P06 — See You, Space Cowboy

Trade Ships move faster without changing role; shared economic reasoning consumes actual throughput.

**Strategic philosophy:** faster trade cycles increase the value of trade-oriented development.

## P07 — Galaxy Express 999

The Factory/Train economy produces more ordinary Train traffic.

**Strategic philosophy:** increase industrial-network throughput.

## P08 — Tea Time

War no longer halves ordinary trade yield.

**Strategic philosophy:** war and commerce need not be mutually exclusive.

## P09 — Wall Maria

Forts become broader, stronger, and cheaper.

**Strategic philosophy:** static defensive investment buys more protection for less FFY.

## P10 — Scorpion's Tail

Faster strategic warheads reduce physical interception opportunity and established the reusable `REDUCE_INTERCEPTION_WINDOW` affordance.

**Strategic philosophy:** compress the defender's interception window.

## P11 — Level Upper

Peak Population thresholds permanently unlock free-SAM ownership/build slots; support values future unlock progress.

**Strategic philosophy:** convert demographic growth into a progressively broader strategic-defense network.

## P12 — Somewhere Not Here

Transport speed improves without changing Transport role.

**Strategic philosophy:** shorten amphibious transit and make distant sea-borne operations more practical.

## P13 — Mountain Training Arc

Mountains become unusually strong defensive ground.

**Strategic philosophy:** use Mountain geography as efficient defensive terrain.

## P14 — 60 Billion Double Dollars

FFY events located on Desert are more valuable.

**Strategic philosophy:** turn Desert geography into an unusually profitable economic surface.

## P15 — The High Ground

Highlands become stronger offensive staging ground.

**Strategic philosophy:** acquire and exploit Highlands for offensive pressure.

## P16 — Poison Taster

Ordinary Fallout acquisition resistance is ignored.

**Strategic philosophy:** Fallout does not slow territorial acquisition.

## P17 — Ten Billion Percent

Upgrade cost improves as owned structure count rises, creating a sequencing problem between construction now and modernization later.

**Strategic philosophy:** broaden the infrastructure base to compound into cheaper modernization.

## P18 — The Best Defense

Fort-covered attacking source cells gain additional offensive pressure.

**Strategic philosophy:** fortify the ground from which you intend to project force.

## P19 — The Weak Die First

Current Territorial Contact count increases offensive pressure globally, making contact geometry strategically relevant beyond access alone.

**Strategic philosophy:** convert geopolitical exposure into offensive momentum without blindly maximizing fronts.

## P20 — A Miracle Is Merely a Miscalculation

The faction starts with a free Missile Silo.

**Strategic philosophy:** exploit earlier access to strategic-launch infrastructure.

## P21 — Fun Things Are Fun

The first purchase of each structure type must be affordable/legal but consumes no FFY, separating affordability from actual liquidity consumption.

**Strategic philosophy:** turn sufficient liquidity into unusually efficient first-time infrastructure.

## P22 — Limit Break

Warships may rank beyond the ordinary ceiling.

**Strategic philosophy:** invest in veteran Warships with a higher long-run ceiling.

## P23 — Space Battleship Yamato

The faction is limited to one stronger Warship, concentrating naval capability into one flagship.

**Strategic philosophy:** concentrate naval power into one elite asset whose position and survival matter globally.

## P24 — A King's Price

FFY events inside Fort coverage gain extra yield.

**Strategic philosophy:** turn Fort coverage into protected higher-yield territory.

## P25 — EXPLOSION!

Strategic-weapon access specializes around larger, more expensive Hydrogen Bombs while Atom Bomb and MIRV become unavailable.

**Strategic philosophy:** trade weapon variety for exceptional Hydrogen-strike area.

## P26 — Serious Punch

MIRV becomes a single-use strategic opportunity whose successful use consumes no FFY but still requires ordinary affordability/legality.

**Strategic philosophy:** preserve and spend one decisive MIRV opportunity only when its value is exceptional.

## P27 — Only My Railgun

SAM Launchers may attack ships.

**Strategic philosophy:** make SAM infrastructure double as coastal area denial.

## P28 — Blood Devil

Destroying hostile Transports transfers their carried Population to this faction.

**Strategic philosophy:** convert destroyed invasion Population into your own available force.

## P29 — The Kaiser

Warships may act as mobile Missile Silo launch platforms.

**Strategic philosophy:** turn veteran Warships into mobile strategic-launch infrastructure.

## P30 — The Conman

Warships become fast, lucrative piracy platforms but lose ordinary naval gunfire against ships.

**Strategic philosophy:** replace conventional naval battle with high-speed economic predation.

## P31 — Heart-Under-Blade

Port repair fields become stronger operational sustain zones for Warships.

**Strategic philosophy:** fight around prepared naval bases and sustain expensive Warships through repair coverage.

## P32 — Armored Titan

Transports gain health but may embark only from owned active Ports.

**Strategic philosophy:** trade launch flexibility for durable invasion shipping organized around Ports.

## P33 — Misaka Network

Train-triggered City events generate Capacity-capped Population, scaling with City level.

**Strategic philosophy:** convert productive rail infrastructure into Population replenishment.

## P34 — Spoils of the Empire

Conquered Factories operate at double ordinary effect.

**Strategic philosophy:** seize enemy industry intact and make conquest outperform equivalent domestic production.

## P35 — It's a Matter of Visualization

Deliberately relinquished cells become neutral Fallout.

**Strategic philosophy:** weaponize retreat by trading ownership for temporary denial and positional distortion.

## P36 — Half-Priced Bento

Neutral settlement costs half the ordinary Population.

**Strategic philosophy:** convert neutral geography into Capacity with unusually low Population expenditure.

## P37 — The City Mouse

Amphibious embarkation costs more FFY, but successful landings create a permanent level-1 Fort.

**Strategic philosophy:** pay more to invade, but make successful landings durable second fronts.

## P38 — Return by Death

Automatic defenders survive when their defended cell is captured.

**Strategic philosophy:** preserve fighting Population even when ground is lost.

## P39 — Stereo Separation

Strategic Spawn uses two half-area influence regions and two exact origins while Starting Population remains global.

**Strategic philosophy:** begin from two strategic footholds, trading coordination risk for broader access and multi-theater possibility.

## P40 — Barrier Magic

SAMs become large-area, exactly-one-charge shields with slower recharge.

**Strategic philosophy:** protect a large area with a sparse shield whose single charge must matter.

## P41 — Level 5

A City purchase directly creates a level-5 City at the accepted cumulative-cost discount.

**Strategic philosophy:** concentrate City investment into one-step mature infrastructure.

## P42 — The Price of Empire

Warships cost no FFY but permanently consume Available Population and have reduced range.

**Strategic philosophy:** convert Population into sea power, accepting demographic sacrifice and shorter reach.

## P43 — The Devil of the Rhine

All Tanks become Heavy Artillery: slow, expensive, long-ranged, high-alpha, long-reload units unable to raid Trains.

**Strategic philosophy:** replace mobile Tank pressure with standoff artillery built around range, timing, and positioning.

## P44 — Nobel Prize

Successful armor Population attacks neutralize cells and apply Fallout.

**Strategic philosophy:** use armor fire to damage the strategic usefulness of enemy geography itself.

## P45 — Hidden Leaf Village

Owned Forest interiors deny enemy tactical observation while direct boundary/manifested information remains minimally visible.

**Strategic philosophy:** use Forest as concealed operational space.

## P46 — Northern Lands

Persistent structures may be built on owned Tundra while Tundra retains its other ordinary rules.

**Strategic philosophy:** exploit normally infrastructure-hostile Tundra as strategic construction surface.

## P47 — This Is Poison

Enemy capture of this faction's Marsh cells inflicts additional Population loss on the captor.

**Strategic philosophy:** make selected Marsh territory costly for enemies to take.

## P48 — Aqua's Blessing

Owned Shallow Water becomes population-bearing Capacity while retaining unusual traversal/buildability rules.

**Strategic philosophy:** expand Population Capacity through owned Shallow Water.

## P49 — Laughing Man

Observation Posts stop granting own tactical observation and instead create enemy-intelligence blackout zones.

**Strategic philosophy:** use observation infrastructure to deny information rather than gather it.

## P50 — Iserlohn Fortress

Forts project offensive pressure equal to their normal defensive-pressure magnitude throughout coverage.

**Strategic philosophy:** turn Fort coverage into general-purpose force support.

## P51 — One Flag Beneath the Stars

Command Posts also project defensive pressure equal to their ordinary offensive-pressure magnitude.

**Strategic philosophy:** make Command coverage a two-way force-support network.

## P52 — Humanity Has Declined

Unused Population Capacity generates passive FFY.

**Strategic philosophy:** monetize underpopulation and make empty Capacity an economic asset.

## P53 — Money Is Everything

Each ready charge on an owned active persistent Missile Silo generates passive FFY.

**Strategic philosophy:** turn strategic readiness into an income-producing stockpile whose charges are simultaneously weapons and economic assets.

## P54 — Starlight Breaker

Initial Territory footprints use the accepted thin five-point star geometry instead of the ordinary compact shape while total area remains unchanged.

**Strategic philosophy:** trade compactness for long directional reach and unusual starting geometry.

---

# Negative / drawback traits

Drawbacks receive full AI literacy. A competent controller should understand and adapt around them; low difficulty may adapt poorly, but should not repeatedly plan around mechanics the drawback makes impossible.

## N01 — The Lost Decade

Cities contribute less Population Growth.

**Strategic philosophy:** City-based demographic scaling is less efficient than normal.

## N02 — Flat Is Justice

Plains provide reduced offensive pressure.

**Strategic philosophy:** Plains are comparatively weak offensive staging ground.

## N03 — I Hate Sand

Desert provides reduced defensive pressure.

**Strategic philosophy:** Desert is comparatively poor defensive ground.

## N04 — Northern Expedition

FFY events located on Mountain yield less.

**Strategic philosophy:** Mountain geography is economically inefficient for located FFY events.

## N05 — Curse of the Abyss

Fallout cannot be captured at all, turning it into a possible hard territorial barrier rather than merely slow terrain.

**Strategic philosophy:** Fallout geometry can obstruct territorial plans until another actor/state change removes the barrier.

## N06 — No Second Season

FFY cannot be spent to upgrade buildings.

**Strategic philosophy:** infrastructure development must rely on construction and non-FFY development paths rather than ordinary paid modernization.

## N07 — One Piece

The faction may own at most one of each structure type, making every structure-type slot globally scarce.

**Strategic philosophy:** concentrate each infrastructure role into one carefully chosen asset rather than a distributed network.

## N08 — It's Just Decoration

Forts provide no defensive-pressure bonus. Other independently legal Fort roles can remain useful.

**Strategic philosophy:** Forts cannot be valued for their ordinary defensive-pressure function.

## N09 — Medieval Isekai

Factories cannot be built, though legally acquired industry can still matter.

**Strategic philosophy:** domestic industrial development cannot rely on constructing Factories.

## N10 — Domain Contraction

Fort coverage area is smaller.

**Strategic philosophy:** Fort influence is more spatially constrained.

## N11 — Absolute Territory

FFY events located inside owned SAM Launcher coverage yield zero.

**Strategic philosophy:** strategic-defense coverage can sterilize the economy beneath it, forcing defense-versus-income tradeoffs.

## N12 — Panzer Vor!

Warships cannot be built.

**Strategic philosophy:** naval strategy cannot assume access to self-built Warships.

## N13 — Beach Episode Gone Wrong

Half of Transport Population dies on landing.

**Strategic philosophy:** amphibious landings require substantially more Population commitment for the same delivered force.

## N14 — To Them Words Are Merely a Means to Deceive

First hostile capture of a Trade Ship voyage inflicts an FFY loss equal to its snapshotted ordinary owner-side value.

**Strategic philosophy:** exposed commerce can turn hostile capture into a direct financial liability.

## N15 — King's Ransom

Transport embarkation costs an additional 500 FFY.

**Strategic philosophy:** every amphibious commitment carries a substantially higher liquidity cost.

## N16 — Insurance Fraud

Successful uncaptured Trade voyages cost the owner their snapshotted value, while hostile capture returns that value once.

**Strategic philosophy:** ordinary trade success becomes a liability, creating a deliberately inverted commerce model.

## N17 — I Can Cut It

Enemy structures that would ordinarily transfer on conquest are destroyed instead. Extended support must treat hostile infrastructure as something that can still be denied strategically, while not forecasting ownership, conquest FFY, or captured-Factory production that final mechanics no longer provide.

**Strategic philosophy:** conquest razes enemy infrastructure instead of turning it into spoils.

## N18 — I Have No Enemies

Final capture/settlement progress against non-Fallout targets is halved, while Fallout is exempt. This remains generic because territory planners should already compare actual effective progress by target state.

`LONG_PAYBACK` records that ordinary territorial acquisition takes substantially longer; the Fallout exception can make contaminated land relatively less impaired than normal terrain without granting a special capture action.

**Strategic philosophy:** conventional territorial acquisition is slow, making target-state and opportunity timing unusually important.

---

# Completed global synergy/suppression sweep

The whole 72-trait catalogue was reviewed after individual mapping.

## Explicit reusable combination support

The canonical combination registry currently closes these non-trivial strategies:

- `TRAIN_POPULATION_ENGINE_ACCELERATION` — P07 + P33;
- `CONQUEST_FACTORY_SNOWBALL` — P05 + P34;
- `CONQUEST_ONLY_INDUSTRY` — P34 + N09;
- `REVERSIBLE_SCORCHED_EARTH` — P16 + P35;
- `VETERAN_MOBILE_MIRV_PLATFORM` — P22 + P29;
- `RADIOACTIVE_HEAVY_ARTILLERY` — P43 + P44;
- `POPULATION_SCALED_GIANT_SAM_NETWORK` — P11 + P40;
- `ELITE_SINGLE_FLAGSHIP_PROGRESSION` — P22 + P23;
- `DUAL_GENERAL_SUPPORT_NETWORK` — P50 + P51;
- `LAYERED_COUNTERINTELLIGENCE` — P45 + P49;
- `SPLIT_STAR_START` — P39 + P54.

These exist because the combination creates a strategic loop, planning problem, or transformed candidate semantics greater than simply adding two independently understood modifiers.

Many strong combinations deliberately receive **no** explicit combination entry. Fort bonuses inherited by P37 landing-created Forts, faster P32 Transports, P53 income from a P20 starting Silo, P41/P33 high-level City interactions, and similar cases remain ordinary composition because the existing support hooks can read final effective mechanics correctly.

## Support suppression

Legal trait combinations may neutralize other support without becoming illegal. Suppression applies only to AI semantic contributions before profile composition; it never changes mechanics or trait legality.

Canonical suppression cases currently include:

- P25 suppresses P26's MIRV support because MIRV is unavailable;
- N05 suppresses P16 because Fallout cannot be captured at all;
- N06 suppresses P17's paid-upgrade strategy;
- N12 suppresses Warship-dependent support from P22/P23/P29/P30/P31/P42 when selected;
- N17 suppresses P05/P34 capture-spoils support because structures are razed instead of transferred;
- N14 + N16 suppresses N14's separate first-capture liability because the owner-side `-V + V` effects cancel exactly;
- N06 suppresses P53's Silo-upgrade planning hook while leaving P53's base ready-charge economy intact.

Partial-effect cases remain active and rely on final effective rules rather than over-aggressive suppression. For example N08 removes ordinary Fort defense but does not erase other legal Fort roles from P18/P24/P37/P50; N09 prevents Factory construction but does not prevent conquered Factory use; N10 changes Fort geometry without removing Fort support.

## Sweep result

The generic support vocabulary remains sufficient. No new theme, caution, affordance, or synergy-tag literal was required beyond the earlier `REDUCE_INTERCEPTION_WINDOW` addition from P10.

The one architectural extension required by the complete catalogue is the now-canonical **support-suppression layer before additive combination support**.

---

## Batch completion summary

```text
Batch 1: P01–P10         complete
Batch 2: P11–P20         complete
Batch 3: P21–P30         complete
Batch 4: P31–P40         complete
Batch 5: P41–P50         complete
Batch 6: P51–P54,N01–N06 complete
Batch 7: N07–N16         complete
Batch 8: N17–N18         complete
Global composition sweep  complete
```
