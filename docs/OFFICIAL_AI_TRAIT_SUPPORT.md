# Open Fufu — Official AI Trait Support Rationale

## Status and authority

This document is the canonical **design/rationale companion** for Official-AI Origin-trait support.

Concrete code-readable mappings live in the sharded design-time configuration set under `design/official-ai/origin-trait-support*.config.ts`. Those `.config.ts` files are the source of truth for exact support entries, hook IDs, themes, affordances, cautions, synergy tags, and future `OriginCombinationSupport` entries.

This document explains **why** mappings exist, their strategic philosophy, important exclusions/boundaries, and future synergy questions. It intentionally does not duplicate full configuration objects.

It remains subordinate to:

- `ORIGIN_TRAIT_CATALOGUE.md` for actual Origin mechanics;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` for generic support vocabulary, composition rules, hook boundaries, and character-adaptation architecture;
- `OFFICIAL_AI_CONFIGURATION.md` for shared AI signal/goal/planner/profile vocabulary.

Nothing here changes Origin mechanics. Numeric/mechanical truth remains in authoritative game rules and the final `EffectiveRulesView`.

---

## Progress

```text
Configured traits: 70 / 72
Current range:      P01–P54, N01–N16
Remaining:          N17–N18
```

No explicit Origin-combination support is closed yet. Cross-trait relationships are retained for the mandatory global synergy/suppression sweep after all individual traits are mapped.

---

# Positive traits

## P01 — Domain Expansion

P01 changes the real starting footprint size without creating a new action form. Strategic Spawn should reason from the actual final footprint rather than assume the ordinary baseline.

**Strategic philosophy:** begin with more geography and exploit the positional head start.

## P02 — The Era of Humans

The widened Population-utilization sweet spot makes demographic recovery more forgiving. Shared economy/forecast reasoning should use the actual effective growth function rather than a trait-specific demographic model.

**Strategic philosophy:** sustain growth across a broader Population-utilization range.

## P03 — Imagine Breaker

Enemy Fort defensive pressure matters less to this faction. Ordinary combat/territory reasoning should consume the effective pressure result; the trait does not itself mandate attacking Forts.

**Strategic philosophy:** static Fort defense is less capable of dictating where the faction may fight.

## P04 — Level 0

Counter-response effectiveness no longer follows the ordinary response-side imbalance curve. Shared counter-response mechanics should expose the actual exchange rather than relying on vanilla numerical assumptions.

**Strategic philosophy:** counter effectively without needing numerical overcommitment to gain response efficiency.

## P05 — Big Shot

Capturing hostile structures becomes simultaneously conquest, capability denial, and immediate FFY generation. Extended support therefore teaches Opportunity/Forecast/LandWar reasoning about the conquest-economy consequence while leaving payout arithmetic authoritative.

**Strategic philosophy:** conquest can finance further conquest.

## P06 — See You, Space Cowboy

Trade Ships move faster without changing their role. Shared economy/infrastructure reasoning should consume actual travel timing and resulting throughput.

**Strategic philosophy:** faster trade cycles increase the value of trade-oriented development.

## P07 — Galaxy Express 999

The Factory/Train economy produces more ordinary Train traffic. If AI cannot value this, the generic Factory/Train model is deficient rather than P07 needing a bespoke brain.

**Strategic philosophy:** increase industrial-network throughput.

## P08 — Tea Time

War no longer halves ordinary trade yield. This preserves commerce through conflict but does not imply that starting war is desirable.

**Strategic philosophy:** war and commerce need not be mutually exclusive.

## P09 — Wall Maria

Forts become broader, stronger, and cheaper. Shared Infrastructure/Defense/Territory reasoning should already see all effective values.

**Strategic philosophy:** static defensive investment buys more protection for less FFY.

## P10 — Scorpion's Tail

Faster strategic warheads reduce the physical opportunity for interception. This established the reusable `REDUCE_INTERCEPTION_WINDOW` affordance.

**Strategic philosophy:** deliver strategic weapons faster and compress the defender's interception window.

## P11 — Level Upper

Peak Population thresholds permanently unlock free-SAM ownership/build slots. Extended support is needed chiefly to value progress toward future unlocks before the SAM exists.

**Strategic philosophy:** convert demographic growth into a progressively broader strategic-defense network.

## P12 — Somewhere Not Here

Transport speed improves without changing Transport role. Shared amphibious reasoning should use real transit time, exposure, and arrival timing.

**Strategic philosophy:** shorten amphibious transit and make distant sea-borne operations more practical.

## P13 — Mountain Training Arc

Mountains become unusually strong defensive ground. `TERRAIN_DEPENDENCE` records that useful Mountain access controls the trait's value.

**Strategic philosophy:** use Mountain geography as efficient defensive terrain.

## P14 — 60 Billion Double Dollars

FFY events located on Desert are more valuable. Generic Economy/Territory reasoning should combine actual event yield with Desert geography.

**Strategic philosophy:** turn Desert geography into an unusually profitable economic surface.

## P15 — The High Ground

Highlands become stronger offensive staging ground. The trait improves positional options without itself creating an aggression mandate.

**Strategic philosophy:** acquire and exploit Highlands for offensive pressure.

## P16 — Poison Taster

Ordinary Fallout acquisition resistance is ignored for this faction. Shared territorial reasoning simply uses the real effective capture progress.

**Strategic philosophy:** Fallout does not slow territorial acquisition.

## P17 — Ten Billion Percent

Upgrade cost improves as owned structure count rises, creating a real sequencing problem between building more infrastructure now and upgrading later. Extended Spending/Upgrade support compares those timing choices.

**Strategic philosophy:** broaden the infrastructure base to compound into cheaper modernization.

## P18 — The Best Defense

Fort-covered attacking source cells gain additional offensive pressure. Extended support therefore values Fort geometry as offensive staging as well as defense.

**Strategic philosophy:** fortify the ground from which you intend to project force.

## P19 — The Weak Die First

Current Territorial Contact count increases offensive pressure globally. Creating another border may therefore add strength elsewhere but can also create dangerous front exposure.

**Strategic philosophy:** convert geopolitical exposure into offensive momentum without blindly maximizing fronts.

## P20 — A Miracle Is Merely a Miscalculation

The faction starts with a free Missile Silo. Once present it is ordinary launch infrastructure governed by normal strategic-weapon planning.

**Strategic philosophy:** exploit earlier access to strategic-launch infrastructure.

## P21 — Fun Things Are Fun

The first purchase of each structure type must be affordable/legal but consumes no FFY. Extended support distinguishes affordability from actual liquidity consumption and values remaining first-purchase opportunities.

**Strategic philosophy:** turn sufficient liquidity into unusually efficient first-time infrastructure.

## P22 — Limit Break

Warships may rank beyond the ordinary ceiling. The value is delayed and favors preserving veteran ships; ordinary naval reasoning still handles rank mechanics.

**Strategic philosophy:** invest in veteran Warships with a higher long-run ceiling.

## P23 — Space Battleship Yamato

The faction is limited to one stronger Warship. Extended support handles concentrated fleet power, theater allocation, and the strategic cost of losing the flagship.

**Strategic philosophy:** concentrate naval power into one elite flagship.

## P24 — A King's Price

FFY events inside Fort coverage gain extra yield, making Fort placement economic geography as well as defensive geometry.

**Strategic philosophy:** turn Fort coverage into protected higher-yield territory.

## P25 — EXPLOSION!

Strategic-weapon access specializes around larger, more expensive Hydrogen Bombs while Atom Bomb and MIRV become unavailable. Ordinary legality/cost/blast reasoning is sufficient.

**Strategic philosophy:** trade weapon variety for exceptional Hydrogen-strike area.

## P26 — Serious Punch

MIRV becomes a single-use strategic opportunity whose successful use consumes no FFY but still requires ordinary affordability/legality. Extended support handles liquidity reservation and one-shot timing.

**Strategic philosophy:** preserve and spend one decisive MIRV opportunity only when its value is exceptional.

## P27 — Only My Railgun

SAM Launchers may attack ships, making coastal SAM placement a cross-domain defense problem. Extended support values both strategic interception and anti-ship denial.

**Strategic philosophy:** make SAM infrastructure double as coastal area denial.

## P28 — Blood Devil

Destroying hostile Transports transfers their carried Population to this faction. Extended support values cargo-dependent Population gain without granting hidden cargo information.

**Strategic philosophy:** convert destroyed invasion Population into your own available force.

## P29 — The Kaiser

Warships may act as mobile Missile Silo launch platforms. Naval position, veterancy, launcher access, and strategic-weapon timing therefore become directly coupled.

**Strategic philosophy:** turn veteran Warships into mobile strategic-launch infrastructure.

## P30 — The Conman

Warships become fast, lucrative piracy platforms but lose ordinary naval gunfire against ships. Extended support must understand the transformed role rather than treat this as a speed bonus.

**Strategic philosophy:** replace conventional naval battle with high-speed economic predation.

## P31 — Heart-Under-Blade

Port repair fields become stronger operational sustain zones and Warships may remain active while benefiting. Naval/Retreat/Infrastructure reasoning should value Ports as fleet anchors.

**Strategic philosophy:** fight around prepared naval bases and sustain expensive Warships through repair coverage.

## P32 — Armored Titan

Transports gain health but may embark only from owned active Ports. Extended support handles both the new survivability model and the new launch-node dependency.

**Strategic philosophy:** trade launch flexibility for durable invasion shipping organized around Ports.

## P33 — Misaka Network

Train-triggered City events generate Capacity-capped Population, scaling with City level. Infrastructure and Upgrade planning therefore treat Train–City topology as a demographic engine.

**Strategic philosophy:** convert productive rail infrastructure into Population replenishment.

## P34 — Spoils of the Empire

Conquered Factories operate at double ordinary effect. Extended support makes hostile Factory provenance strategically relevant when valuing attack targets.

**Strategic philosophy:** seize enemy industry intact and make conquest outperform equivalent domestic production.

## P35 — It's a Matter of Visualization

Deliberately relinquished cells become neutral Fallout. Retreat can therefore shape geography and deny space, while `SELF_GEOMETRY_RISK` captures the danger of contaminating territory the faction later wants back.

**Strategic philosophy:** weaponize retreat by trading ownership for temporary denial and positional distortion.

## P36 — Half-Priced Bento

Neutral settlement costs half the ordinary Population. Shared Expansion/Economy reasoning should simply consume the effective settlement cost.

**Strategic philosophy:** convert neutral geography into Capacity with unusually low Population expenditure.

## P37 — The City Mouse

Amphibious embarkation costs more FFY, but successful landings create a permanent level-1 Fort. Extended support evaluates the landing as an immediately fortified beachhead.

**Strategic philosophy:** pay more to invade, but make successful landings durable second fronts.

## P38 — Return by Death

Automatic defenders survive when their defended cell is captured. Forecast/Defense/Retreat reasoning can therefore value elastic defense and territorial trading without assuming Population loss accompanies every lost defended cell.

**Strategic philosophy:** preserve fighting Population even when ground is lost.

## P39 — Stereo Separation

Strategic Spawn uses two half-area influence regions and two exact origins while Starting Population remains global. Spawn planning must generate/evaluate legal pairs rather than one point.

**Strategic philosophy:** begin from two strategic footholds, trading coordination risk for broader access and multi-theater possibility.

## P40 — Barrier Magic

SAMs become large-area, exactly-one-charge shields with slower recharge. Extended support tracks charge state, broad coverage, poor throughput, and bait risk.

**Strategic philosophy:** protect a large area with a sparse shield whose single charge must matter.

## P41 — Level 5

A City purchase directly creates a level-5 City at the accepted cumulative-cost discount. Extended support handles high upfront liquidity and immediate mature-City payoff rather than treating this as a normal level-1 build.

**Strategic philosophy:** concentrate City investment into one-step mature infrastructure.

## P42 — The Price of Empire

Warships cost no FFY but permanently consume Available Population and have reduced range. Spending/Naval reasoning must treat this as cross-resource conversion rather than a free ship.

**Strategic philosophy:** convert Population into sea power, accepting demographic sacrifice and shorter reach.

## P43 — The Devil of the Rhine

All Tanks become Heavy Artillery: slow, expensive, long-ranged, high-alpha, long-reload units unable to raid Trains. Extended Armor support is mandatory so they are not used as vanilla Tanks.

**Strategic philosophy:** replace mobile Tank pressure with standoff artillery built around range, timing, and positioning.

## P44 — Nobel Prize

Successful armor Population attacks neutralize cells and apply Fallout, turning firepower into territorial shaping. Extended support values Capacity denial, connectivity cuts, area denial, and self-geometry risk.

**Strategic philosophy:** use armor fire to damage the strategic usefulness of enemy geography itself.

## P45 — Hidden Leaf Village

Owned Forest interiors deny enemy tactical observation while boundary/manifested information remains minimally visible. Extended support values concealment as staging/protection rather than a combat scalar.

**Strategic philosophy:** use Forest as concealed operational space.

## P46 — Northern Lands

Persistent structures may be built on owned Tundra while Tundra retains its other ordinary rules. Extended Infrastructure support must generate and value these newly legal placement candidates.

**Strategic philosophy:** exploit normally infrastructure-hostile Tundra as strategic construction surface.

## P47 — This Is Poison

Enemy capture of this faction's Marsh cells inflicts additional Population loss on the captor. Extended Defense/Retreat support can treat Marsh loss as an attritional exchange rather than pure territorial defeat.

**Strategic philosophy:** make selected Marsh territory costly for enemies to take.

## P48 — Aqua's Blessing

Owned Shallow Water becomes population-bearing Capacity while retaining its unusual traversal/buildability rules. Extended support values it as demographic territory without pretending it is normal land.

**Strategic philosophy:** expand Population Capacity through owned Shallow Water.

## P49 — Laughing Man

Observation Posts stop granting own tactical observation and instead create enemy-intelligence blackout zones. The Observation planner must therefore be transformed from coverage planning into counterintelligence placement.

**Strategic philosophy:** use observation infrastructure to deny information rather than gather it.

## P50 — Iserlohn Fortress

Forts project offensive pressure equal to their normal defensive-pressure magnitude throughout their coverage. Extended support values Forts as general offensive/defensive support anchors.

**Strategic philosophy:** turn Fort coverage into general-purpose force support.

## P51 — One Flag Beneath the Stars

Command Posts also project defensive pressure equal to their ordinary offensive-pressure magnitude. Their placement therefore acquires a genuine defensive role in addition to command/offensive support.

**Strategic philosophy:** make Command coverage a two-way force-support network rather than purely offensive infrastructure.

## P52 — Humanity Has Declined

Unused Population Capacity generates passive FFY, creating a direct economic value for the gap between Capacity and Total Population. Extended support must value expansion, Population expenditure, and recovery partly through their effect on that gap without blindly suppressing growth.

**Strategic philosophy:** monetize underpopulation and make empty Capacity an economic asset.

## P53 — Money Is Everything

Each ready charge on an owned active persistent Missile Silo generates substantial passive FFY. Extended support must value Silo construction/upgrades and the income opportunity cost of firing a ready charge; P29 mobile launchers explicitly do not qualify.

**Strategic philosophy:** turn strategic-weapon readiness into an economic stockpile whose charges are simultaneously weapons and income-producing assets.

## P54 — Starlight Breaker

Initial Territory footprints use the accepted thin five-point star geometry instead of the ordinary compact shape while total area remains unchanged. Spawn support must evaluate the changed border exposure, reach, corridors, and self-geometry rather than only origin-point quality.

**Strategic philosophy:** trade compactness for long directional reach and unusual starting geometry.

---

# Negative / drawback traits

Drawbacks still receive full AI literacy. A competent controller should understand the constraint and adapt around it; low difficulty may adapt poorly, but it should not repeatedly plan around mechanics that the drawback makes impossible.

## N01 — The Lost Decade

Cities contribute less Population Growth. This is a surfaced scalar reduction, so shared Economy/Forecast reasoning should simply use the effective growth value.

**Strategic philosophy:** City-based demographic scaling is less efficient than normal.

## N02 — Flat Is Justice

Plains provide reduced offensive pressure. Ordinary terrain-aware combat reasoning should use the effective pressure result.

**Strategic philosophy:** Plains are comparatively weak offensive staging ground.

## N03 — I Hate Sand

Desert provides reduced defensive pressure. Ordinary terrain-aware defense reasoning should use the effective pressure result.

**Strategic philosophy:** Desert is comparatively poor defensive ground.

## N04 — Northern Expedition

FFY events located on Mountain yield less. Generic economy/territory reasoning should treat Mountain economic events as lower-value without needing a bespoke planner.

**Strategic philosophy:** Mountain geography is economically inefficient for located FFY events.

## N05 — Curse of the Abyss

Fallout cannot be captured at all. Extended support is necessary because Fallout can become a hard ownership/route barrier rather than merely slower terrain; plans that require taking Fallout must be recognized as impossible.

**Strategic philosophy:** Fallout geometry can permanently obstruct territorial plans until another actor/state change removes the barrier.

## N06 — No Second Season

FFY cannot be spent to upgrade buildings. Upgrade illegality is authoritative and should naturally remove upgrade actions from ordinary planners.

The global synergy/suppression sweep must explicitly verify interactions such as P17+N06 so the composed strategic profile does not advertise upgrade strategies that final effective rules make impossible.

**Strategic philosophy:** infrastructure development must rely on construction and non-FFY upgrade paths rather than ordinary paid modernization.

## N07 — One Piece

The faction may own at most one of each structure type. This is more than an ordinary build cap: every structure type becomes a scarce strategic slot whose location and survival matter across the whole map.

Extended Infrastructure/Spending support therefore evaluates placement opportunity cost, competing theaters, and the loss risk of singular infrastructure. The cap itself remains authoritative game legality.

**Strategic philosophy:** concentrate each infrastructure role into one carefully chosen asset rather than a distributed network.

## N08 — It's Just Decoration

Forts provide no defensive-pressure bonus. This remains generic because shared reasoning should consume the Fort's actual effective outputs; a Fort may still retain other value from base mechanics or positive traits.

This is a key suppression-sweep case for P09/P18/P24/P37/P50: loss of ordinary defense must not erase other independently legal Fort roles.

**Strategic philosophy:** Forts cannot be valued for their ordinary defensive-pressure function.

## N09 — Medieval Isekai

Factories cannot be built. The restriction is ordinary authoritative legality; planners should simply stop generating self-built Factory plans rather than requiring a bespoke anti-Factory controller.

Captured or otherwise legally obtained industry must still be evaluated according to final effective rules, so the global sweep must distinguish “cannot build” from “cannot own/use.”

**Strategic philosophy:** domestic industrial development cannot rely on constructing Factories.

## N10 — Domain Contraction

Fort coverage area is smaller. This is a generic surfaced geometry modifier; every Fort-dependent planner should consume the reduced real coverage rather than assume vanilla radius/area.

**Strategic philosophy:** Fort influence is more spatially constrained.

## N11 — Absolute Territory

FFY events located inside owned SAM Launcher coverage yield zero. This creates a genuine cross-domain conflict between strategic defense geometry and economic-event geography.

Extended Economy/Forecast/Infrastructure/Defense support therefore prices the economic exclusion zone when placing SAMs or valuing defended regions instead of blindly maximizing coverage.

**Strategic philosophy:** strategic-defense coverage can sterilize the economy beneath it, forcing deliberate defense-versus-income tradeoffs.

## N12 — Panzer Vor!

Warships cannot be built. This is authoritative build legality and therefore GENERIC: Naval planning should not repeatedly propose impossible purchases.

The global suppression sweep must remove or deactivate Warship-dependent strategic semantics from positive traits when the final effective rules leave the faction with no legal way to obtain the required Warship capability.

**Strategic philosophy:** naval strategy cannot assume access to self-built Warships.

## N13 — Beach Episode Gone Wrong

Half of Transport Population dies on landing. This remains generic because ordinary amphibious forecasting should use the actual delivered Population after all effective landing mechanics rather than the nominal embarked amount.

If the shared planner cannot do that, it is a generic amphibious-model defect rather than a reason for N13-specific strategy code.

**Strategic philosophy:** amphibious landings require substantially more Population commitment for the same delivered force.

## N14 — To Them Words Are Merely a Means to Deceive

The first hostile capture of a Trade Ship voyage inflicts an FFY loss equal to that voyage's snapshotted ordinary owner-side success value. Capture risk therefore carries an additional economic penalty beyond loss of normal trade benefit.

Extended Economy/Threat/Forecast support makes trade-network value risk-adjusted without granting hidden information about future capture.

**Strategic philosophy:** exposed commerce can turn hostile capture into a direct financial liability.

## N15 — King's Ransom

Transport embarkation costs an additional 500 FFY. This is a generic surfaced cost modifier; amphibious planning should use the real effective embarkation cost.

**Strategic philosophy:** every amphibious commitment carries a substantially higher liquidity cost.

## N16 — Insurance Fraud

Ordinary successful uncaptured Trade Ship voyages cost the owner their snapshotted voyage value, while hostile capture instead returns that value once. This inverts the normal economic interpretation of Trade Ship outcomes and therefore requires explicit support.

Extended Economy/Opportunity/Forecast/Infrastructure reasoning must understand that a nominally successful voyage can be economically harmful while capture can be comparatively preferable. It must still obey normal legality, observation, and character Doctrine; the support does not automatically order sacrificial shipping.

**Strategic philosophy:** ordinary trade success becomes a liability, creating an intentionally perverse commerce model where hostile capture can be the less harmful outcome.

---

## Batch consistency notes

### Batch 1 — P01–P10

Nine GENERIC; P05 EXTENDED. P10 added `REDUCE_INTERCEPTION_WINDOW`.

### Batch 2 — P11–P20

P11, P17, P18, P19 EXTENDED; the remainder GENERIC.

### Batch 3 — P21–P30

P21, P23, P24, P26–P30 EXTENDED; P22 and P25 GENERIC.

### Batch 4 — P31–P40

P31–P35 and P37–P40 EXTENDED; P36 GENERIC.

### Batch 5 — P41–P50

All ten EXTENDED because the batch is dominated by role transformations, cross-resource purchases, information changes, terrain reclassification, and transformed infrastructure roles.

### Batch 6 — P51–P54 + N01–N06

P51–P54 and N05 EXTENDED; N01–N04 and N06 GENERIC. This batch exposed the first explicit **support-suppression** audit requirement: effective-rule prohibitions such as N06 can make positive-trait strategic semantics impossible even though both trait support entries remain individually valid.

### Batch 7 — N07–N16

N07, N11, N14, and N16 are EXTENDED. N08–N10, N12, N13, and N15 are GENERIC because their restrictions/modifiers should already be represented by final legality, geometry, cost, or outcome values.

No new generic support literal was required. This batch strengthens the mandatory post-trait suppression audit: N08, N09, and N12 can partially or wholly deactivate the practical value of positive Fort, Factory, or Warship support without necessarily making those positive trait definitions themselves invalid.

---

## Mandatory post-trait global sweep

After N17–N18 are mapped, perform one whole-catalogue pass covering both **synergy** and **suppression**.

The sweep must distinguish:

- additive synergy where two independently useful traits create a larger combined opportunity;
- emergent synergy requiring explicit `OriginCombinationSupport`;
- partial suppression where a drawback removes one use of a positive trait but leaves others valid;
- total suppression where final effective rules make a support affordance/hook mechanically unreachable;
- transformed interactions where the same mechanic remains legal but changes enough that composed support needs an explicit combination hook.

Important candidates already recorded include P07+P33, P05+P34, P17+P41, P17+N06, P22+P29, P43+P44, P45+P49, P16/P35/N05 Fallout relationships, P11/P27/P40 SAM relationships, P12/P32/P37/N13/N15 Transport relationships, the P09/P18/P24/P37/P50/N08/N10 Fort family, and Warship-positive traits against N12.
