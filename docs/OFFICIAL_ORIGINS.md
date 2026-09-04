# Open Fufu — Canonical Official Origin Roster

## Status and authority

This document is the **canonical content registry for Official Origins**.

It does not replace [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), which remains authoritative for game mechanics and Origin-system rules, or [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md), which remains authoritative for migration/implementation direction. Trait definitions/costs come from [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md). Official AI preset pools are maintained in [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md).

The roster below is the accepted **provisional V1 Official Origin library**. Mechanical combinations are provisional content baselines subject to playtest repricing/revision while remaining ordinary legal builds under the public Origin catalogue. Display names are also provisional thematic names and may receive a later wording/reference cleanup without silently changing mechanics.

Official Origins obey exactly the same public builder rules as Custom Origins. No Official Origin receives hidden points, hidden traits, compatibility exceptions, or creator-only mechanics.

Current builder constraints:

```text
Base Origin Points:       10
Maximum selected traits:   5
Maximum drawback refund:  10
Maximum positive spend:   20
```

---

## Default and authoring direction

**Business as Usual (O08)** is the provisional V1 **first-listed and default-selected Origin** in the player UI.

It exists for a player who does not yet want to solve an Origin buildcraft puzzle: it gives two broadly useful scalar improvements and otherwise stays close to ordinary Open Fufu play.

Official-Origin authoring follows these principles:

- **Simple does not mean intentionally weak.** A starter-friendly Origin should normally use roughly the ordinary 10-point base budget without forcing the player into several rule transformations.
- Leaving points or trait slots unused is legal and sometimes desirable.
- **9–10 positive spend is a healthy ordinary baseline.**
- An Official Origin with **8 or fewer positive points requires a specific design justification**; low complexity by itself is not enough reason to leave a large fraction of the base budget unused.
- Specialized Origins may spend well above 10 positive points by accepting coherent drawbacks, up to the normal public limits.
- Drawbacks for beginner-oriented Origins should prefer understandable scalar tradeoffs over mechanics that radically change the rules or demand specialized knowledge.
- Origins are a **global shared library**, not content owned by one AI character. Multiple AI presets may legally include the same Official Origin in their allowed pools even when the Origin name/reference has no lore relationship to that character.
- Duplicate mechanical builds under different presentation names are generally undesirable; **O35/O36 are currently a known provisional duplicate pair** and should be differentiated or consolidated before implementation if a good distinction is found.

The first three UI-facing starter choices are:

| Origin | Compact build | Intent |
| --- | --- | --- |
| **Business as Usual — DEFAULT** | **P06** (+25% Trade Ship speed) · **P09** (better/cheaper Forts) | Near-vanilla generalist; 10 positive points, no drawback. |
| **Head Start** | **P01** (+15% Initial Territory) · **P06** (+25% Trade Ship speed) · **N01** (-20% City Growth) | Stronger opening with a mild long-term scalar drawback. |
| **Home Field Advantage** | **P09** (better/cheaper Forts) · **P13** (+33% Mountain defense) · **P15** (+33% Highland offense) · **N02** (-25% Plains offense) | Easy-to-understand terrain/defense specialization. |

---

## Provisional V1 Official Origin library

**Spend** is shown as `positive / raw drawback refund` where applicable. At most 10 drawback points are usable under the builder even if raw drawbacks exceed 10.

| Official Origin | Traits — human-readable shorthand | Spend | Strategic fantasy |
| --- | --- | ---: | --- |
| **O08 — Business as Usual** | **P06** (+25% Trade Ship speed) · **P09** (better/cheaper Forts) | **10** | Default near-vanilla Origin: faster merchants and stronger/cheaper Forts. |
| **O09 — Head Start** | **P01** (+15% Initial Territory) · **P06** (+25% Trade Ship speed) · **N01** (-20% City Growth) | **12 / -4** | Bigger opening position and faster trade in exchange for mildly weaker long-term City growth. |
| **O10 — Home Field Advantage** | **P09** (better/cheaper Forts) · **P13** (+33% Mountain defense) · **P15** (+33% Highland offense) · **N02** (-25% Plains offense) | **13 / -4** | Prepared/high-ground warfare; strong Fort/Mountain/Highland play, weaker Plains offense. |
| **O11 — Fun Things Are Fun** | **P08** (no wartime trade penalty) · **P06** (+25% Trade Ship speed) · **P07** (+25% trains spawned) · **N01** (-20% City Growth) | **13 / -4** | Fast trade and rail that keep functioning through war, with mildly weaker City growth. |
| **O12 — One Punch** | **P23** (one Warship only; +20% range/damage/speed) · **P22** (+2 maximum Warship rank) · **N01** (-20% City Growth) | **14 / -4** | One extremely strong, high-rank flagship instead of an ordinary fleet. |
| **O13 — Bomb Girl** | **P25** (Hydrogen-only doctrine; +50% H-bomb area, +50% cost) | **10** | Simple self-contained Hydrogen-Bomb specialization. |
| **O14 — Bocchi Time** | **P39** (two half-area spawn regions / two exact origins) | **10** | Pure split-start Origin: one faction, two starting regions. |
| **O15 — Kessoku Band** | **P50** (Forts also support offense) · **P51** (Command Posts also support defense) | **10** | Forts and Command Posts become complementary all-purpose support infrastructure. |
| **O16 — The Art of Surviving** | **P38** (automatic defender survives captured cell) | **10** | One defining rule: automatic defenders survive losing their cells. |
| **O17 — To Them Words Are Merely a Means to Deceive** | **P49** (Observation Posts become intel-blackout zones) · **P45** (Forest concealment) · **N02** (-25% Plains offense) | **13 / -4** | Information warfare: blackout Observation Posts and concealed Forest interiors; weaker straightforward Plains offense. |
| **O01 — I Have No Enemies** | **P38** (automatic defender survives captured cell) · **P09** (better/cheaper Forts) · **P13** (+33% Mountain defense) · **N02** (-25% Plains offense) · **N13** (half Transport Population dies on landing) | **19 / -11 (10 usable)** | Extreme territorial defense and Population preservation; terrible open-terrain/amphibious projection. |
| **O18 — What Is a True Warrior?** | **P38** (automatic defender survives captured cell) · **P04** (response-side counter-response fixed at 1.0) · **P13** (+33% Mountain defense) · **N13** (half Transport Population dies on landing) | **17 / -7** | Preserve defenders, fight efficiently in direct counter-response and Mountains, project poorly overseas. |
| **O19 — The Magician** | **P04** (response-side counter-response fixed at 1.0) · **P08** (no wartime trade penalty) · **P38** (automatic defender survives captured cell) · **N07** (max one of each structure type) | **17 / -10** | Reactive defense and wartime economy under severe infrastructure concentration. |
| **O20 — A War Worth Avoiding** | **P08** (no wartime trade penalty) · **P02** (wide 30–70% Population-utilization growth profile) · **P21** (first purchase of each structure costs 0 FFY) · **N07** (max one of each structure type) | **20 / -10** | Prosper peacefully and remain economically functional when war is forced on you. |
| **O21 — Heart-Under-Blade** | **P38** (automatic defender survives captured cell) · **P02** (wide 30–70% Population-utilization growth profile) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Extremely persistent continental Population economy with weaker ordinary Cities. |
| **O22 — The Weak Die First** | **P19** (+5% offense per contacted faction) · **P03** (ignore enemy Fort defensive-pressure bonus) · **P15** (+33% Highland offense) · **N01** (-20% City Growth) · **N04** (-50% Mountain FFY) | **18 / -8** | Predatory multi-contact aggression that ignores Fort pressure and favors Highlands. |
| **O04 — Spoils of Empire** | **P05** (captured enemy structures generate conquest FFY) · **P34** (conquered Factories operate at 2× effect) · **P15** (+33% Highland offense) · **N09** (cannot build Factories) · **N02** (-25% Plains offense) | **18 / -10** | Conquest-fed economy that must seize industrial capacity rather than build it. |
| **O23 — Money Is Everything** | **P05** (captured enemy structures generate conquest FFY) · **P08** (no wartime trade penalty) · **P06** (+25% Trade Ship speed) · **N13** (half Transport Population dies on landing) | **17 / -7** | Both commerce and conquest are profit engines; amphibious projection is poor. |
| **O24 — The Devil of the Rhine** | **P43** (Heavy Artillery replaces Tanks) · **P15** (+33% Highland offense) · **P19** (+5% offense per contacted faction) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Continental Heavy-Artillery breakthrough warfare that escalates with multiple contacts. |
| **O25 — I Can Cut It** | **P03** (ignore enemy Fort defensive-pressure bonus) · **P43** (Heavy Artillery replaces Tanks) · **P15** (+33% Highland offense) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Fort-ignoring Heavy-Artillery assault doctrine for breaking prepared positions. |
| **O26 — A Rational War** | **P05** (captured enemy structures generate conquest FFY) · **P43** (Heavy Artillery replaces Tanks) · **P04** (response-side counter-response fixed at 1.0) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Heavy Artillery, disciplined counter-response, and conquest-funded warfare. |
| **O27 — Ordinary Offensive Magic** | **P43** (Heavy Artillery replaces Tanks) · **P25** (Hydrogen-only doctrine; +50% H-bomb area, +50% cost) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **18 / -10** | Long-range Heavy Artillery backed by oversized Hydrogen weapons. |
| **O28 — The Height of Magic** | **P25** (Hydrogen-only doctrine; +50% H-bomb area, +50% cost) · **P10** (+100% warhead projectile speed) · **P40** (giant single-charge SAM shields) · **N07** (max one of each structure type) | **20 / -10** | Concentrated strategic arsenal: huge/faster Hydrogen weapons and giant SAM shields. |
| **O29 — Serious Series** | **P43** (Heavy Artillery replaces Tanks) · **P44** (Radioactive Munitions) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **17 / -10** | Radioactive Heavy Artillery. |
| **O30 — A Miracle Is Merely a Miscalculation** | **P43** (Heavy Artillery replaces Tanks) · **P10** (+100% warhead projectile speed) · **P20** (free starting Missile Silo) · **N12** (cannot build Warships) · **N03** (-33% Desert defense) | **19 / -10** | Starts armed, fields Heavy Artillery, and launches exceptionally fast strategic weapons. |
| **O31 — Hell's Snipe** | **P20** (free starting Missile Silo) · **P25** (Hydrogen-only doctrine; +50% H-bomb area, +50% cost) · **N11** (FFY events inside SAM areas yield 0) | **17 / -7** | Free starting Silo into specialized long-range Hydrogen warfare with awkward SAM-area economy. |
| **O32 — Watchtower** | **P11** (Population-unlocked 0-FFY SAM slots) · **P40** (giant single-charge SAM shields) · **N11** (FFY events inside SAM areas yield 0) | **14 / -7** | Population-scaled free giant SAM shields whose coverage interferes with FFY events. |
| **O33 — It's a Matter of Visualization** | **P44** (Radioactive Munitions) · **P16** (ignore Fallout capture resistance) · **P35** (deliberately relinquished cells become Fallout) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Radioactive warfare plus Fallout-friendly scorched-earth geography. |
| **O34 — This Is Poison** | **P44** (Radioactive Munitions) · **P16** (ignore Fallout capture resistance) · **P47** (enemy Marsh captures cost +1 Population) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **17 / -10** | Radioactive weapons, Fallout tolerance, and punishing Marsh territory. |
| **O35 — Curiosity Killed the Cat** | **P16** (ignore Fallout capture resistance) · **P46** (may build on Tundra) · **P48** (owned Shallow Water gives +1 Capacity/cell) · **P36** (neutral settlement costs 0.5 Population/cell) · **N13** (half Transport Population dies on landing) | **17 / -7** | Treats Fallout, Tundra, Shallow Water, and neutral expansion as opportunities. |
| **O36 — Radical Edward** | **P46** (may build on Tundra) · **P48** (owned Shallow Water gives +1 Capacity/cell) · **P16** (ignore Fallout capture resistance) · **P36** (neutral settlement costs 0.5 Population/cell) · **N13** (half Transport Population dies on landing) | **17 / -7** | Bizarre-terrain settlement doctrine; currently mechanically identical to Curiosity Killed the Cat pending later differentiation. |
| **O37 — Hacker's Paradise** | **P49** (Observation Posts become intel-blackout zones) · **P45** (Forest concealment) · **P17** (structure-count upgrade discount) · **N07** (max one of each structure type) | **20 / -10** | Extreme information denial plus tightly concentrated infrastructure optimization. |
| **O38 — I Don't Know Everything** | **P17** (structure-count upgrade discount) · **P21** (first purchase of each structure costs 0 FFY) · **P04** (response-side counter-response fixed at 1.0) · **N01** (-20% City Growth) · **N04** (-50% Mountain FFY) | **17 / -8** | Preparation, efficient infrastructure, and stable counter-response rather than omniscience. |
| **O02 — Tea Time** | **P08** (no wartime trade penalty) · **P06** (+25% Trade Ship speed) · **P07** (+25% trains spawned) · **P41** (purchased Cities are direct L5 at 95% cumulative cost) · **N07** (max one of each structure type) | **19 / -10** | Concentrated rich city-state economy: fast trade/rail, direct-L5 Cities, but only one of each structure. |
| **O39 — A Mere Ten Years** | **P17** (structure-count upgrade discount) · **P21** (first purchase of each structure costs 0 FFY) · **P41** (purchased Cities are direct L5 at 95% cumulative cost) · **N07** (max one of each structure type) | **20 / -10** | Long-horizon infrastructure monster with free first purchases and direct-L5 Cities. |
| **O40 — Efficiency Above All** | **P02** (wide 30–70% Population-utilization growth profile) · **P17** (structure-count upgrade discount) · **P07** (+25% trains spawned) · **N07** (max one of each structure type) | **20 / -10** | Population-utilization, structure-upgrade, and rail optimization under infrastructure concentration. |
| **O41 — There Is No Time to Waste** | **P17** (structure-count upgrade discount) · **P07** (+25% trains spawned) · **P41** (purchased Cities are direct L5 at 95% cumulative cost) · **N13** (half Transport Population dies on landing) | **17 / -7** | Rapid continental development through cheaper upgrades, more trains, and direct-L5 Cities. |
| **O42 — The Stars Are Within My Grasp** | **P01** (+15% Initial Territory) · **P17** (structure-count upgrade discount) · **P07** (+25% trains spawned) · **N01** (-20% City Growth) · **N04** (-50% Mountain FFY) | **18 / -8** | Starts broad and scales infrastructure/rail aggressively, with weaker City/Mountain economy. |
| **O07 — The Conman** | **P30** (fast 3×-piracy Warships; no naval gunfire) · **P06** (+25% Trade Ship speed) · **P31** (expanded operational Port repair zones) · **N13** (half Transport Population dies on landing) | **17 / -7** | Piracy/trade economy whose Warships raid merchants rather than fight battle fleets. |
| **O05 — The Country Mouse and the City Mouse** | **P37** (+250 FFY embarkation; successful landing grants L1 Fort) · **P32** (Port-only armored Transports) · **P12** (+25% Transport speed) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Armored, fast, self-fortifying amphibious invasion without conventional Warships. |
| **O43 — King of Apparitions** | **P23** (one Warship only; +20% range/damage/speed) · **P22** (+2 maximum Warship rank) · **P31** (expanded operational Port repair zones) · **N07** (max one of each structure type) | **20 / -10** | One absurd high-rank flagship sustained by powerful Port repair support. |
| **O03 — Railgun** | **P02** (wide 30–70% Population-utilization growth profile) · **P07** (+25% trains spawned) · **P33** (City train stops grant Population) · **N01** (-20% City Growth) · **N12** (cannot build Warships) | **19 / -10** | Rail-driven demographic engine with broad utilization management; continental and weak at ordinary City growth. |
| **O44 — Hero for Fun** | **P21** (first purchase of each structure costs 0 FFY) · **P36** (neutral settlement costs 0.5 Population/cell) · **P01** (+15% Initial Territory) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Strong land-expansion generalist with cheap settlement and free first structures, but weak naval/City scaling. |
| **O06 — Somewhere Not Here** | **P39** (two half-area spawn regions / two exact origins) · **P01** (+15% Initial Territory) · **N07** (max one of each structure type) | **17 / -10** | Two starting homelands sharing one global economy and only one of each structure. |
| **O45 — Level 5** | **P11** (Population-unlocked 0-FFY SAM slots) · **P27** (SAMs may attack ships) · **N11** (FFY events inside SAM areas yield 0) | **17 / -7** | Population-unlocked free SAM network that can also attack ships, at an economic spatial cost. |
| **O46 — Nobel Prize** | **P19** (+5% offense per contacted faction) · **P44** (Radioactive Munitions) · **N13** (half Transport Population dies on landing) | **16 / -7** | Multi-contact aggression plus radioactive munitions; poor amphibious projection. |
| **O47 — Blood Devil** | **P28** (destroyed enemy Transports give carried Population) · **P38** (automatic defender survives captured cell) · **N12** (cannot build Warships) · **N01** (-20% City Growth) | **19 / -10** | Steals Transport Population while preserving its own automatic defenders; continental and City-light. |
| **O48 — Humanity Has Declined** | **P52** (FFY from empty Population Capacity) · **P02** (wide 30–70% Population-utilization growth profile) · **P36** (neutral settlement costs 0.5 Population/cell) · **N02** (-25% Plains offense) · **N12** (cannot build Warships) | **20 / -10** | Sprawling underpopulated society: settle neutral land cheaply, tolerate low utilization, and turn empty Capacity into income while remaining poor at conventional Plains/naval projection. |
| **O49 — Third Impact** | **P53** (FFY from ready persistent Missile-Silo charges) · **P20** (free starting Missile Silo) · **P16** (ignore ordinary Fallout acquisition resistance) · **N18** (non-Fallout acquisition progress ×0.50) · **N12** (cannot build Warships) | **19 / -14 (10 usable)** | Weak conventional territorial expansion that bootstraps a Silo-stockpile economy and eventually prefers an irradiated battlefield where Fallout is easier for it to consume than ordinary land. |

---

## Roster notes

### Existing seven-origin roster migration

The original seven Official Origin builds remain present mechanically, but have been absorbed into the expanded thematic library:

| Previous working name | Current provisional identity |
| --- | --- |
| Last Bastion | **O01 — I Have No Enemies** |
| Golden City | **O02 — Tea Time** |
| Rail-Demographic Origin | **O03 — Railgun** |
| Spoils of Empire | **O04 — Spoils of Empire** |
| Iron Tide | **O05 — The Country Mouse and the City Mouse** |
| Gemini | **O06 — Somewhere Not Here** |
| Corsair State | **O07 — The Conman** |

Their mechanics were not discarded merely because the presentation names changed.

### Global sharing

An Official Origin may appear in any number of Official AI preset pools. The Origin's name is a thematic identity for the build, **not a claim that the preset character said the line or belongs to the source work referenced by the Origin name**.

This is intentional. For example, an information-denial Origin may fit several ruthless/aloof/analytical characters even if only one—or none—has any literal relationship to the phrase used as its title.

### Player availability

Official Origins are ordinary legal public builds and should be selectable by human players as curated ready-made Origins. Custom Origin creation remains available separately under the same trait catalogue/builder constraints.

### No forced category symmetry

The library does not need a fixed quota of naval, economic, nuclear, defensive, or other Origin categories. New Official Origins should be added when a coherent mechanical fantasy or AI-pool need exists, not to fill an arbitrary taxonomy.

---

## Implementation/content work still open

The following remain implementation/content work rather than reasons to reopen the Origin-system architecture:

1. final display-name/reference cleanup;
2. differentiation or consolidation of the current O35/O36 duplicate build;
3. playtest repricing/revision if trait costs change;
4. UI art/presentation for Official Origins;
5. runtime data schema/import representation;
6. exhaustive legality/invariant validation against the deployed trait catalogue;
7. future additions where an AI preset or player-facing fantasy genuinely needs another build.

No gameplay implementation is authorized by this document alone.