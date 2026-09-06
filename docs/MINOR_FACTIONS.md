# Open Fufu — Minor Factions / Goons

## Status and authority

This file is the **canonical detailed V1 appendix for non-major territorial actors** referred to mechanically as **Minor Factions** and player-facing as **Goons**.

The inherited OpenFront implementation calls this class of simple bot actor a `Tribe`. Open Fufu does **not** surface `Tribe` as the player-facing term.

Canonical terminology:

```text
mechanical / API / design class: Minor Faction / MinorFaction
player-facing singular:           Goon
player-facing plural:             Goons
```

The intentionally silly public label does not imply that Goons are literally subordinates or henchmen of another faction. They are independent minor territorial actors. The word is used in the broad familiar sense of low-level disposable background opposition, with the modern internet double meaning fitting Open Fufu's tone.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for ordinary Population, territory, capture, defense, victory, and reward rules. [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) defines the universal foreign-origin minimum, deterministic spawn primitives, starting-footprint resolver, and replay/spawn representation used here. [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) defines Origin traits such as P19.

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

## 1.2 Minor Faction / Goon

A Minor Faction—surfaced to players as a **Goon**—is a deliberately primitive territorial Population actor used to populate the world with independent early-game resistance/opportunity.

It uses ordinary territorial mechanics but does **not** become a smaller copy of a full human/Official-AI economy.

A Goon has:

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

The intent is not to make Goons weak through a secret global combat debuff. Their weakness comes from small starting scale and deliberately limited decision/system access.

---

# 2. Ordinary Goon density

Ordinary V1 matches derive the default requested Minor-Faction/Goon count from **population-bearing map cells**:

```text
requestedMinorFactionCount
= floor(populationBearingMapCells / 20,000)
```

Because each Goon uses the ordinary vanilla **1,000 population-bearing-cell** Initial Territory baseline, the requested count corresponds to approximately **5% of population-bearing land at match start** before placement/topology constraints.

Examples:

| Population-bearing map cells | Requested Goons | Approx. requested initial Goon-owned population-bearing land |
| ---: | ---: | ---: |
| 500,000 | 25 | 25,000 = 5% |
| 1,000,000 | 50 | 50,000 = 5% |
| 2,000,000 | 100 | 100,000 = 5% |
| 3,000,000 | 150 | 150,000 = 5% |
| 4,500,000 | 225 | 225,000 = 5% |

The formula is a requested count, not permission to violate legal placement constraints. The deterministic placement resolver in Section 3 may reduce the resolved count when legal geography cannot accommodate every requested Goon.

Fixed benchmark/scenario rulesets may explicitly disable or override Minor-Faction count, but the formula above is the ordinary V1 default.

---

# 3. Goon starting state and placement

Goons are generated, resolved, and painted **before Strategic Spawn Phase 1**.

Their completed visible starting territories therefore form part of the public geography that Major-Faction controllers see before choosing broad influence regions and later exact origins. Major factions may deliberately seek, avoid, surround, or squeeze between those pre-existing Goon territories.

Baseline per Goon:

```text
Initial Territory = 1,000 population-bearing cells
Starting Population = 500
```

Their starting Population therefore follows the same ordinary vanilla 50%-of-Initial-Territory relationship as a Major Faction with no starting-state modifiers.

## 3.1 Two spacing rules

The universal V1 foreign-origin legality floor remains owned by `STRATEGIC_SPAWN.md`:

```text
foreign faction origin distance >= 50 cells
```

That minimum applies to Major↔Major and Major↔Goon origins exactly as it does to any other two foreign factions.

Goon generation has an additional, stricter placement policy:

```text
Goon ↔ Goon origin distance >= 100 cells
```

The 100-cell value is a **hard minimum, not a target lattice distance**. Goon origins should usually end up farther apart when geography permits. The purpose is to distribute the pre-spawn Goon ecology broadly enough that Major factions still have meaningful legal gaps and strategic choices during their later spawn phase while preserving local variation in Goon density.

Goon placement does not reserve explicit future Major spawn slots or guarantee that every pair of Goons has a usable midpoint. Major controllers remain responsible for choosing legal and strategically useful spawn areas from the public resolved geography.

## 3.2 Deterministic dispersion-first origin placement

Goon exact origins use the map's compiled legal Initial-Territory seed set. Placement is match-seeded, deterministic, and **dispersion-first**.

The first Goon origin is selected deterministically from the legal seed set using the canonical spawn deterministic tie primitive from `STRATEGIC_SPAWN.md` and stable `CellId` fallback.

For every later placement ordinal, consider every legal seed whose squared Euclidean distance from every already placed Goon origin is at least:

```text
100^2 = 10,000
```

For each candidate, compute its distance to its nearest already placed Goon. Choose the candidate that **maximizes that nearest-Goon distance**. Equal-distance candidates use deterministic match-seeded tie ordering and then stable `CellId` fallback.

Conceptually, each new Goon chooses the legal candidate with tuple priority equivalent to:

```text
(
  maximum nearest-existing-Goon distance,
  deterministic seeded tie,
  CellId
)
```

This is a deterministic maximin/farthest-point placement policy. It intentionally prefers empty legal geography before packing another Goon close to an existing one, without imposing a regular grid or exact pairwise spacing.

An implementation may use deterministic spatial indexing/acceleration rather than rescanning every seed naively, but it must produce the same canonical candidate ordering and result.

## 3.3 Count reduction; spacing never degrades

If no legal candidate satisfying the **100-cell Goon↔Goon floor** remains before the requested count is reached:

```text
resolvedMinorFactionCount = number of successfully placed Goons
```

The ordinary match proceeds with that smaller count.

The resolver must **not**:

- reduce the Goon↔Goon spacing floor below 100 merely to preserve count;
- violate the universal 50-cell foreign-origin legality floor;
- use nondeterministic retries;
- fail an otherwise valid ordinary match solely because the requested ambient Goon count cannot fit.

Emit a stable compact diagnostic equivalent to:

```text
MINOR_FACTION_COUNT_REDUCED
requestedCount
resolvedCount
reason = LEGAL_ORIGIN_CAPACITY_EXHAUSTED
```

Do not log every rejected seed.

## 3.4 Starting footprints and later Major spawning

After Goon origins are resolved, their ordinary compact starting footprints are generated before Strategic Spawn begins. Goon footprints use the ordinary deterministic simultaneous starting-footprint machinery from `STRATEGIC_SPAWN.md`; Goons have no Origin geometry transformations.

Later Major exact-origin resolution treats every resolved Goon origin as an already-fixed foreign origin that must satisfy the universal **50-cell** minimum. Goon origins are not movable participants in the later Major conflict resolver.

Later Major starting-footprint generation treats already-owned Goon territory as unavailable foreign-owned starting geography; a Major footprint does not overwrite a pre-painted Goon footprint.

A pathological `FOOTPRINT_QUOTA_UNFILLABLE` condition remains owned by the general spawn resolver. Valid production maps should make it exceptional rather than creating a second Minor-specific footprint repair algorithm here.

---

# 4. Territorial mechanics

Goons participate in the same physical territorial system as Major Factions.

Their cells:

- have ordinary ownership;
- contribute ordinary conquerable territory;
- contribute Capacity when population-bearing;
- may be attacked/captured under ordinary hostile territorial rules;
- use ordinary terrain offense/defense/capture multipliers;
- may receive one automatic defender per threatened owned population-bearing cell when Population is available;
- lose Population/Capacity through ordinary defended capture, nuclear effects, Fallout-related ownership loss, and other universal territorial mechanics.

There is no special `Goon cells take double capture damage` or similar hidden shortcut.

If a Goon captures a persistent structure that would ordinarily transfer ownership, the structure is **destroyed instead of becoming functional Goon infrastructure**. This preserves the intended territorial-only actor class and adapts the useful inherited behavior where simple tribe bots dispose of acquired structures.

A Goon cannot deliberately construct replacement infrastructure afterward.

---

# 5. P19 Territorial Contact interaction

P19 explicitly **does count Goons / Minor Factions**.

The trait remains:

```text
+5% offensive pressure
per distinct currently active other faction
with current Territorial Contact
```

The count is current, not historical. Touching a faction at some earlier point does not permanently retain a bonus after the Territorial Contact disappears or that faction stops being an active territorial actor.

A currently active Goon with current Territorial Contact counts exactly once, regardless of how many disconnected Contact components exist between the two actors.

Therefore an early-game faction simultaneously bordering many Goons can receive a very large P19 bonus. This is intentional emergent synergy rather than an interaction to suppress. The bonus naturally tends to shrink as Goons are absorbed/eliminated and the number of active neighboring actors falls.

P19 consumes **actual resolved active Goons**, not the requested pre-placement count. A Goon that could not be legally placed does not exist and cannot contribute Territorial Contact.

P19's catalogue cost is provisionally **8 Origin points** to recognize the larger early-game contact ecology while preserving this intended interaction.

The existing literal `other faction` semantics otherwise remain; this document does not add a Goon exclusion.

---

# 6. Engine-owned behavior

Goon strategy is intentionally tiny and deterministic. It is **not** the Difficulty-0 Baseline controller, a hidden player controller, or part of the Official-AI character architecture. The engine-owned policy chooses only **when to create a territorial commitment, how much Population to request, and which legal target class/faction to request**. Ordinary game systems own commitment legality, operation representation/aggregation, frontage allocation, capture arithmetic, casualties, and repeated commitments against the same target.

## 6.1 Allocation trigger and amount

A Goon has no fixed five-second decision cadence.

After deterministic Population/operation state updates, the Goon policy may emit at most one new territorial allocation for that simulation tick when both conditions hold:

```text
AvailablePopulation >= 0.50 × PopulationCapacity
AvailablePopulation >= floor(0.20 × TotalPopulation)
```

The second condition merely ensures the requested allocation is legal even in unusual over-Capacity states after territorial loss.

The requested new commitment is exactly:

```text
newTerritorialCommitment
= floor(0.20 × TotalPopulation)
```

If that quantity is `0`, no allocation is emitted.

There is no additional cooldown. In ordinary growth-driven cases the new commitment immediately reduces Available Population below the 50%-of-Capacity threshold; if an unusual state transition leaves the Goon above the threshold after one legal allocation, another allocation may occur on a later simulation tick rather than recursively issuing multiple allocations inside one policy evaluation.

## 6.2 Neutral expansion always has first priority

When a new allocation is eligible and legally actionable neutral territory exists, the Goon always directs that allocation to ordinary neutral expansion.

The Goon does not compare neutral value against hostile value, terrain quality, strategic shape, or future payoff. Neutral land simply wins the policy branch whenever a legal neutral expansion opportunity exists.

The ordinary land-operation/acquisition system determines the actionable lanes, settlement Population costs, acquisition pacing, and any aggregation with existing legal neutral-expansion commitments.

## 6.3 Hostile target pool and random choice

Only when no legally actionable neutral territory exists does the Goon consider hostile territorial expansion.

The hostile candidate set is the set of **currently ACTIVE other factions with current Territorial Contact**.

Partition that candidate set into:

```text
touchingGoons
touchingMajorFactions
```

Selection is:

```text
if touchingGoons is non-empty:
    candidatePool = touchingGoons
else:
    candidatePool = touchingMajorFactions
```

Therefore a Goon strongly prefers other Goons: it never deliberately chooses a touching Major Faction while at least one touching Goon is available.

Within the chosen candidate pool, select one faction by a deterministic match-seeded uniform draw keyed by stable Goon identity plus that Goon's monotonically increasing territorial-allocation ordinal. Candidate iteration/order must not bias the draw. Replay of the same bound inputs must choose the same target.

The Goon performs **no** strength, weakness, progress, elimination, revenge, geography-value, or strategic-finish evaluation. It may choose a different touching target on the next allocation or happen to choose the same target again.

## 6.4 What an attack request means

A hostile allocation is conceptually only:

```text
commit <newTerritorialCommitment> Population to attack <targetFaction>
```

The Goon does not choose individual cells or calculate how multiple commitments should combine.

If the same target faction receives several legal Goon commitments over time, the Goon policy does not merge, resize, or recompute them. The ordinary game systems own operation arithmetic, effective aggregation, finite Population accounting, and deterministic distribution across all currently actionable Territorial Contact geometry with that target.

Disconnected borders against the same target therefore do not create bespoke Goon armies or front logic. Ordinary land-operation/frontage semantics decide how finite committed Population acts.

## 6.5 Defense, counter-response, and retreat

Goons never create active counter-response commitments and never deliberately allocate Population in reaction to being attacked.

Their defense consists only of the ordinary automatic-defense system using Population that remains Available. Ordinary defended-cell capture casualties and all other universal capture rules apply unchanged.

A Goon also has **no intelligent retreat policy**. It does not withdraw because of losses, poor terrain, enemy strength, unfavorable exchange, lack of progress, or strategic danger.

If an existing Goon operation becomes mechanically impossible—for example because its target is no longer ACTIVE or no actionable Territorial Contact remains—the ordinary operation lifecycle may close that invalid operation and return surviving committed Population to Available. That is mechanical cleanup, not Goon strategic retreat.

A Goon may later randomly attack a faction that previously attacked it, but there is no retaliation/counterattack memory or causal preference. Any such selection is simply the ordinary target-pool draw.

## 6.6 `atWar`

Engine-owned Goon allocations are **not controller-facing directed-hostility actions**. They therefore do not themselves create or refresh the game-wide `atWar` state defined by `OPEN_FUFU_DESIGN.md`.

A Major controller that deliberately attacks a Goon, launches another controller-directed hostile action against it, or actively counter-responds where legal may create Major↔Goon `atWar` through the ordinary game-wide rule. The Goon policy does not redefine that lifecycle.

Goons do **not**:

- build or upgrade infrastructure;
- use FFY;
- operate mobile military units;
- launch strategic weapons;
- use Transports;
- conduct diplomacy;
- join teams;
- create active counter-responses;
- execute long-horizon strategic planning;
- receive hidden map information unavailable to ordinary legal territorial observation.

---

# 7. Rewards and progression

Goons are **not qualifying PvE reward opponents**.

Therefore:

```text
Goon defeated → 0 Echo rolls
Goon difficulty → none
Goon special-AI reward → none
Goon Origin → none
Goon Echo loadout → none
```

Destroying/conquering a Goon may still be strategically valuable because its territory/Capacity/geography become available through ordinary conquest. There is simply no meta-progression reward layered on top.

A Goon never counts as an Official AI preset and never acquires a difficulty merely because it is engine-controlled.

---

# 8. Victory participation

Goon-owned cells remain real owned/conquerable territory and therefore matter for ordinary territory-percentage calculations while they exist.

However, Goons are **not Major-Faction victory participants** and do not block the separate victory route based on all opposing Major Factions being defeated/capitulated.

Consequences:

- if one Major Faction/team remains after all other Major opposition is gone, surviving scattered Goons do not force a mandatory global cleanup campaign before that Major side can win through the all-Major-opposition-defeated condition;
- a Major side may still interact with/conquer Goon territory normally before that point;
- Goons themselves cannot satisfy a Major-Faction victory condition or become the winner of the match.

If Goons eliminate the final remaining Major faction/team, the Major side has lost; the game does not crown a Goon as a progression-bearing winner.

---

# 9. Naming

The public flavor term is:

```text
Goon / Goons
```

The internal/mechanical class remains **Minor Faction / `MinorFaction`** so code, save schemas, and design prose are not forced to use a joke-facing label.

The inherited word **Tribe** should not be surfaced in Open Fufu's final player UI merely because inherited migration code uses `TribeExecution` / `TribeSpawner` internally.

Intended UI examples include:

```text
Nearby Goons: 7
Goon defeated
Territorial Contact: 4 Goons
```

Generated individual Goons may still receive map-appropriate/generated faction names; `Goon` describes their actor class rather than requiring every map label literally to be `Goon ID 37`.

---

# 10. Diagnostics, replay, and validation expectations

Minor placement uses the match-bound spawn resolver/versioning architecture rather than introducing a separate Minor-placement version field.

The authoritative spawn/replay summary must retain enough information to reproduce and independently verify the resolved Minor ecology, including at least:

```text
requestedMinorFactionCount
resolvedMinorFactionCount
resolved Goon origin IDs/cells
MINOR_FACTION_COUNT_REDUCED diagnostic when applicable
ordinary per-footprint quota/shape/hash summaries
```

The replay's full starting-state representation follows `STRATEGIC_SPAWN.md`; this document does not define a second replay container.

Before V1 release, accelerated tests should cover at least:

- derived requested counts on representative maps;
- deterministic placement of dozens/hundreds of Goons;
- exact 100-cell minimum Goon↔Goon origin spacing;
- dispersion/maximin behavior on open, coastal, island, and fragmented legal geography;
- deterministic count reduction with no spacing degradation when the requested count cannot fit;
- later Major origins respecting the universal 50-cell minimum from fixed Goon origins;
- Goon territories fully visible before Strategic Spawn Phase 1;
- Major starting footprints never overwriting pre-painted Goon territory;
- ordinary Population growth/automatic defense/capture with no hidden modifiers;
- structure destruction on Goon capture;
- neutral expansion winning whenever it is legally actionable at allocation time;
- allocation eligibility at 50% Available/Capacity and exact 20%-of-Total requested commitment;
- deterministic Goon-first hostile candidate-pool selection and seeded uniform choice within that pool;
- multiple legal commitments to the same or different target factions without Goon-owned aggregation arithmetic;
- no active counter-response or strategic retreat behavior;
- invalid/dead/disconnected operation cleanup returning surviving Population through the ordinary lifecycle;
- engine-owned Goon attacks not creating/refreshing `atWar`;
- P19 with 0, 1, many, disappearing, and reappearing current Goon contacts;
- large early-game P19 bonuses without permanent historical-contact retention;
- no Echo/difficulty/reward contribution from Goon defeats;
- Major victory with surviving Goons;
- stable replay reproduction of Minor placement and deterministic target draws.
