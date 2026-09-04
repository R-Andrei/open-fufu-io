# Open Fufu — Minor Factions

## Status and authority

This file is the **canonical detailed V1 appendix for non-major territorial actors** currently referred to mechanically as **Minor Factions**.

The inherited OpenFront implementation calls this class of simple bot actor a `Tribe`. **`Tribe` is not the intended Open Fufu player-facing name.** The final public label remains deliberately open and should be replaced with an anime/gacha-flavored term rather than silently carrying the inherited vocabulary into the UI.

Until that naming pass, **Minor Faction** is the canonical neutral mechanical term used by design/API documentation.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for ordinary Population, territory, capture, defense, victory, and reward rules. [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) defines the accepted exact-origin spacing and starting-footprint geometry used here where applicable. [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) defines Origin traits such as P19.

Nothing in this file authorizes gameplay implementation.

---

# 1. Major versus Minor Factions

Open Fufu distinguishes two broad territorial actor classes.

## 1.1 Major Faction

A Major Faction is a normal human-controller or Official-AI faction participating in the full match game.

Major Factions may use, as allowed by mode/ruleset:

- Origins;
- Echoes/loadouts;
- FFY economy;
- structures;
- Tanks/Heavy Artillery;
- naval units;
- strategic weapons;
- the full controller/Official-AI decision model;
- PvE opponent/reward semantics;
- Major-Faction victory/defeat participation.

## 1.2 Minor Faction

A Minor Faction is a deliberately primitive territorial Population actor used to populate the world with independent early-game resistance/opportunity.

It uses ordinary territorial mechanics but does **not** become a smaller copy of a full human/Official-AI economy.

A Minor Faction has:

- territory;
- one global Population pool;
- Population Capacity from owned population-bearing cells;
- ordinary Population growth;
- ordinary terrain rules;
- ordinary capture/settlement progress;
- ordinary automatic defense;
- ordinary capture casualties;
- ordinary Fallout interaction;
- simple deterministic engine-owned territorial behavior.

It has **no**:

- Origin;
- Echoes;
- FFY balance/income;
- structure construction;
- structure upgrading;
- Ports/Factories/Cities/Forts/Silos/SAMs/Observation/Command Posts as owned functional infrastructure;
- Tanks/Heavy Artillery;
- Warships/Transports/Trade Ships/Trains;
- strategic weapons;
- alliances or fixed-team membership;
- full Official-AI controller/personality/difficulty package;
- PvE difficulty reward.

The intent is not to make Minor Factions weak through a secret global combat debuff. Their weakness comes from small starting scale and deliberately limited decision/system access.

---

# 2. Ordinary Minor-Faction density

Ordinary V1 matches derive the default Minor-Faction count from **population-bearing map cells**:

```text
minorFactionCount
= floor(populationBearingMapCells / 20,000)
```

Because each Minor Faction uses the ordinary vanilla **1,000 population-bearing-cell** Initial Territory baseline, this gives Minor Factions approximately **5% of population-bearing land at match start** before placement/topology constraints.

Examples:

| Population-bearing map cells | Default Minor Factions | Approx. initial Minor-owned population-bearing land |
| ---: | ---: | ---: |
| 500,000 | 25 | 25,000 = 5% |
| 1,000,000 | 50 | 50,000 = 5% |
| 2,000,000 | 100 | 100,000 = 5% |
| 3,000,000 | 150 | 150,000 = 5% |
| 4,500,000 | 225 | 225,000 = 5% |

Fixed benchmark/scenario rulesets may explicitly disable or override Minor-Faction count, but the formula above is the ordinary V1 default.

---

# 3. Minor-Faction starting state and placement

Minor Factions are generated/placed **before Strategic Spawn Phase 1**.

Their visible starting territories therefore form part of the public geography that Major-Faction controllers may deliberately seek, avoid, surround, or use when choosing broad influence regions.

Baseline per Minor Faction:

```text
Initial Territory = 1,000 population-bearing cells
Starting Population = 500
```

Their starting Population therefore follows the same ordinary vanilla 50%-of-Initial-Territory relationship as a Major Faction with no starting-state modifiers.

Minor-Faction exact origins/starting seeds use the accepted **50-cell foreign-origin spacing** from `STRATEGIC_SPAWN.md` against other Minor Factions and Major-Faction resolved origins.

Their generated starting footprint uses the ordinary compact starting-footprint rules rather than any Origin transformation; Minor Factions have no Origins.

Placement is deterministic and match-seeded. Map/ruleset validation should ensure the derived default count can be legally placed on the intended map. A pathological map-placement failure is handled by deterministic safe degradation/logging rather than nondeterministic retry order.

---

# 4. Territorial mechanics

Minor Factions participate in the same physical territorial system as Major Factions.

Their cells:

- have ordinary ownership;
- contribute ordinary conquerable territory;
- contribute Capacity when population-bearing;
- may be attacked/captured under ordinary hostile territorial rules;
- use ordinary terrain offense/defense/capture multipliers;
- may receive one automatic defender per threatened owned population-bearing cell when Population is available;
- lose Population/Capacity through ordinary defended capture, nuclear effects, Fallout-related ownership loss, and other universal territorial mechanics.

There is no special `Minor Faction cells take double capture damage` or similar hidden shortcut.

If a Minor Faction captures a persistent structure that would ordinarily transfer ownership, the structure is **destroyed instead of becoming functional Minor-Faction infrastructure**. This preserves the intended territorial-only actor class and adapts the useful inherited behavior where simple tribe bots dispose of acquired structures.

A Minor Faction cannot deliberately construct replacement infrastructure afterward.

---

# 5. P19 Territorial Contact interaction

P19 explicitly **does count Minor Factions**.

The trait remains:

```text
+5% offensive pressure
per distinct currently active other faction
with current Territorial Contact
```

The count is current, not historical. Touching a faction at some earlier point does not permanently retain a bonus after the Territorial Contact disappears or that faction stops being an active territorial actor.

A currently active Minor Faction with current Territorial Contact counts exactly once, regardless of how many disconnected Contact components exist between the two actors.

Therefore an early-game faction simultaneously bordering many Minor Factions can receive a very large P19 bonus. This is intentional emergent synergy rather than an interaction to suppress. The bonus naturally tends to shrink as Minor Factions are absorbed/eliminated and the number of active neighboring actors falls.

P19's catalogue cost is provisionally repriced from **7 to 8 Origin points** to recognize the larger early-game contact ecology while preserving this intended interaction.

The existing literal `other faction` semantics otherwise remain; this document does not add a Minor-Faction exclusion.

---

# 6. Engine-owned behavior

Minor-Faction strategy remains intentionally tiny and deterministic. This is **not** part of the postponed Official-AI controller-design project.

Baseline decision cadence:

```text
one territorial decision opportunity every 5 seconds
```

Each Minor Faction receives a deterministic match-seeded phase offset so hundreds of Minor Factions do not all make their decisions on the same simulation tick.

Behavioral direction:

1. if legally actionable neutral land is adjacent/reachable from the current territory, prefer neutral expansion;
2. otherwise choose one currently adjacent hostile territorial actor using deterministic simple ordering/seeded tie-breaking and launch a simple Population-based territorial attack;
3. use ordinary Population availability/commitment legality rather than free phantom forces.

Minor Factions do **not**:

- build or upgrade infrastructure;
- use FFY;
- operate mobile military units;
- launch strategic weapons;
- use Transports;
- conduct diplomacy;
- join teams;
- use explicit sophisticated counter-response strategy;
- execute long-horizon strategic planning;
- receive hidden map information unavailable to ordinary legal territorial observation.

Exact simple commitment percentage/rule may be implementation/benchmark tuned. The important invariant is **ordinary territorial mechanics + intentionally simple decision-maker**, not a second full AI stack.

---

# 7. Rewards and progression

Minor Factions are **not qualifying PvE reward opponents**.

Therefore:

```text
Minor Faction defeated → 0 Echo rolls
Minor Faction difficulty → none
Minor Faction special-AI reward → none
Minor Faction Origin → none
Minor Faction Echo loadout → none
```

Destroying/conquering a Minor Faction may still be strategically valuable because its territory/Capacity/geography become available through ordinary conquest. There is simply no meta-progression reward layered on top.

A Minor Faction never counts as an Official AI preset and never acquires a difficulty merely because it is engine-controlled.

---

# 8. Victory participation

Minor-Faction-owned cells remain real owned/conquerable territory and therefore matter for ordinary territory-percentage calculations while they exist.

However, Minor Factions are **not Major-Faction victory participants** and do not block the separate victory route based on all opposing Major Factions being defeated/capitulated.

Consequences:

- if one Major Faction/team remains after all other Major opposition is gone, surviving scattered Minor Factions do not force a mandatory global cleanup campaign before that Major side can win through the all-Major-opposition-defeated condition;
- a Major side may still interact with/conquer Minor territory normally before that point;
- Minor Factions themselves cannot satisfy a Major-Faction victory condition or become the winner of the match.

If Minor Factions eliminate the final remaining Major faction/team, the Major side has lost; the game does not crown a Minor Faction as a progression-bearing winner.

---

# 9. Naming status

`Minor Faction` is a mechanical/documentation term, not the intended final flavor label.

The inherited word **Tribe** should not be surfaced in Open Fufu's final player UI merely because the inherited code uses `TribeExecution` / `TribeSpawner` internally during migration.

The final public term should be:

- short enough to appear frequently in map/UI text;
- clearly understood as a small generic world actor rather than an Official AI character;
- compatible with dozens/hundreds of generated instances;
- thematically anime/gacha-flavored rather than historical/anthropological `Tribe` terminology.

Choosing that public label remains open content work and does not block the mechanical class defined here.

---

# 10. Validation expectations

Before V1 release, accelerated tests should cover at least:

- derived counts on representative maps;
- deterministic placement of dozens/hundreds of Minor Factions;
- 50-cell origin spacing against each other and later Major spawns;
- ordinary Population growth/automatic defense/capture with no hidden modifiers;
- structure destruction on Minor capture;
- P19 with 0, 1, many, disappearing, and reappearing current Minor-Faction contacts;
- large early-game P19 bonuses without permanent historical-contact retention;
- no Echo/difficulty/reward contribution from Minor defeats;
- Major victory with surviving Minor Factions;
- deterministic decision phase offsets and stable replays with hundreds of Minor actors.
