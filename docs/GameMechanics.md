# Open Fufu — Game Mechanics Decisions

## Status and precedence

This document records accepted gameplay/mechanics decisions for Open Fufu while the mechanics are being designed before implementation planning begins.

It supplements `docs/OpenFufuDesign.md`. Where this document makes a concrete decision that an older section of `OpenFufuDesign.md` still describes as a candidate or unresolved question, **this newer document takes precedence**. The broader design document should be consolidated later once the mechanics discussion stabilizes.

This is a game-design document, not an implementation plan.

---

## 1. Core gameplay identity

Open Fufu is an **autobattler in which the player programs the battler**.

The player does not manually intervene during a normal match. Before the match, the player chooses a versioned faction controller, PvE loadout where applicable, and lobby configuration. Once play begins, the controller is responsible for the faction.

The design should provide:

- a low entry floor for ordinary players who can write simple controller logic;
- useful high-level helpers and abstractions;
- a high skill ceiling for players who want to reason deeply about geometry, statistics, optimization, and strategy;
- no requirement that ordinary users manipulate individual map cells merely to express sensible strategy.

Advanced users may eventually access lower-level spatial controls, but cell-by-cell micromanagement must not be the only practical way to obtain good behavior.

---

## 2. Match victory and duration

A faction wins when either:

1. it owns **100% of conquerable territory**; or
2. every other faction has resigned/capitulated.

Human-controlled factions may surrender.

AI controllers may capitulate when their own strategy concludes that they have effectively no chance of winning. Capitulation should be a controller/game decision rather than a hidden global difficulty mechanic.

Match duration is not itself a hard gameplay rule. The intended practical range is broad:

- approximately 15 minutes to 2 hours is acceptable;
- most normal matches should preferably finish in under an hour;
- duration becomes a balance/design problem only if mechanics consistently produce games that are far too short or far too long.

---

## 3. Faction information and fog of war

Open Fufu should use a **hybrid information model** rather than either complete perfect information or complete fog of war.

### 3.1 Globally public information

Every controller should receive a very small set of macro-level public information about every surviving faction so it can make strategic decisions about the state of the overall match.

The final set should be approximately **1–3 public macro statistics**. Candidate statistics include:

- total population;
- percentage/share of territory;
- total FFY/economic wealth.

The exact final public set remains open, but there must be enough global information for strategies such as identifying a runaway leader, prioritizing a high-threat opponent, or informally coordinating pressure against the faction currently winning.

The broad political shape of the map is public: controllers may know which faction owns visible political territory and where faction borders exist.

Static geography/terrain should also be globally known. Fog of war is primarily about faction internals and local operational information, not about requiring controllers to rediscover mountains and coastlines.

### 3.2 Contact/local information

Detailed information about another faction is available only where the two factions actually interact/touch.

A controller should know the relevant characteristics of every enemy border/front it touches, including whatever local information the final combat model requires, for example:

- border/front geometry;
- terrain along the contact;
- visible structures affecting that contact;
- local enemy defensive/offensive presence or commitment;
- currently applied local combat modifiers;
- active pressure/hostilities;
- other local state required to make meaningful decisions.

The exact front properties remain dependent on the final population-distribution and combat model.

### 3.3 Hidden information

A faction should **not** automatically know detailed operational information about distant parts of another faction that it does not touch.

For example, if Fufu borders Tanya in the west while Tanya is fighting Ski on the opposite side of the map, Fufu may infer broad changes from Tanya's public macro statistics but should not automatically see Tanya's exact eastern deployments, fortification state, controller priorities, or local combat data.

Private controller memory, internal decision state, intended future targets, and similar internals are not public.

The resulting rule of thumb is:

> Political shape + a tiny macro scoreboard are global; detailed operational information is local to contact; internal controller state is private.

---

## 4. Fundamental resources and quantities

Open Fufu should avoid inventing redundant abstract resources merely to support a military/economic philosophy.

The current core quantities are:

- **Population** — the faction's demographic resource and fundamental source of fighting power;
- **FFY** — Fufu Yen, the single primary economic currency (analogous to JPY); this replaces the generic term `gold` in the Open Fufu product vocabulary;
- **Territory** — owned map cells/land;
- **Structures/units** — inherited OpenFront buildables and later Open Fufu additions;
- **Terrain** — spatial properties of cells that can modify growth, combat, movement, economy, or other systems.

There should not be a separate persistent `Military Power` statistic merely because warfare needs a number. Effective military strength should be **derived** from population plus spatial allocation, terrain, structures, items, and other applicable modifiers.

---

## 5. Population

Population is intended to remain the fundamental source of faction power rather than being split unnecessarily into population/manpower/army/military-power resources.

Population should matter to both development and warfare.

Expected relationships include:

- population grows over time;
- land ownership affects population growth and/or sustainable population;
- structures may increase population growth or capacity;
- terrain may modify population growth;
- warfare consumes/losses population;
- a faction must decide how much effective population/power is committed to different conflicts, borders, expansion, reserves, or other roles;
- the same population cannot provide full fighting power everywhere simultaneously.

### 5.1 Population growth

Population growth should not be a fixed `+X per second` independent of the world.

Growth should depend on factors such as:

- amount of land owned;
- relevant buildings/structures;
- terrain composition;
- item/loadout modifiers;
- future faction/class modifiers where appropriate.

Illustrative terrain identity:

- mountains may provide stronger defensive value;
- plains may provide stronger population-growth value;
- deserts may provide stronger FFY/economic value.

These examples express the desired trade-off philosophy, not final numeric balance.

### 5.2 Population distribution is intentionally unresolved

The exact mechanism by which population/fighting power is distributed spatially is a **major open design question**.

A simplistic four-direction system (`north/east/south/west`) is rejected because faction territory can have arbitrary topology: disconnected regions, multiple holes, narrow corridors, islands, irregular fronts, and bizarre shapes.

A raw requirement such as:

> allocate 55% of population to these exact 53 border cells

may be computationally expressive but creates too high an entry floor for ordinary players.

The final system must therefore satisfy both:

1. **low-floor control** — a normal user can express useful strategy with high-level concepts and without computational geometry expertise;
2. **high-ceiling control** — an advanced user can still reason about and influence spatial allocation in much greater detail.

Candidate concepts previously discussed include fronts, regions, objectives, attack corridors, focus points, weighting functions, and spatial policy fields. None is yet accepted as the final player-facing abstraction.

### 5.3 Reallocation / inertia

It is desirable that a faction cannot unrealistically teleport all effective population/strength from one distant front to another every tick.

However, the exact meaning of redeployment/reinforcement depends directly on the unresolved population-distribution model and therefore remains open.

We should not define reinforcement propagation before defining what is actually being distributed.

---

## 6. FFY economy

**FFY (Fufu Yen)** is the single primary economic currency.

Avoid introducing many conventional RTS resource types such as wood, stone, iron, food, oil, etc. unless a later design has a concrete reason to need them.

The core economic distinction is:

```text
warfare primarily costs population
infrastructure primarily costs FFY
```

FFY generation should depend on the state of the civilization rather than being detached from it. Relevant factors may include:

- population;
- structures;
- terrain;
- trade;
- item/loadout modifiers;
- future faction/class effects.

FFY is spent on the inherited OpenFront buildable/infrastructure systems and any later Open Fufu additions.

The exact generation formula remains a balance/mechanics question to be defined later.

---

## 7. Territory and terrain

Every traversable land cell is either neutral or owned by a faction.

Territory:

- defines political control;
- contributes to population growth/capacity;
- creates borders/fronts;
- provides locations for structures;
- provides connectivity/routes;
- contributes to economic potential;
- creates strategic geometry.

Territory is intentionally heterogeneous.

Open Fufu should retain/use terrain as a meaningful strategic variable. The inherited OpenFront terrain concepts include plains, highlands, mountains, ocean, and impassable areas; these may evolve later.

Terrain can influence multiple systems rather than only cosmetic appearance. Illustrative roles include:

- plains: easier/faster expansion and/or better population growth;
- highlands: moderate defensive benefit;
- mountains: strong defensive benefit and slower advance/redeployment;
- deserts or future terrain: stronger FFY/economic effects;
- ocean: naval/trade domain.

Exact numbers and even the final terrain list remain tunable.

---

## 8. Structures, units, rail, ships, and strategic weapons

For the first Open Fufu playable version, **do not aggressively remove inherited OpenFront structures/unit systems merely to simplify the design**.

Factories, railways/trains, boats/naval systems, nukes, SAM systems, and the other current OpenFront structures/buildables are considered important enough to retain initially. Removing them could alter the existing strategic balance in deep/subtle ways before Open Fufu's replacement systems are understood.

The inherited catalogue currently includes concepts such as:

- Cities;
- Defense Posts;
- Ports;
- Factories;
- Missile Silos;
- SAM Launchers;
- Transport Ships;
- Warships;
- trade/naval systems;
- trains/rail systems;
- Atom Bombs;
- Hydrogen Bombs;
- MIRVs;
- related missiles/projectiles.

The initial design principle is:

> preserve the existing structure/unit gameplay surface for V1 unless a specific incompatibility forces a change; redesign/add/remove structures later based on actual Open Fufu gameplay.

Open Fufu may later add new structures, alter areas of influence, rebalance trade, or remove systems once the new simulation can be tested coherently.

### 8.1 Local/area effects

Structures should be able to matter spatially.

Examples include defensive structures affecting nearby cells/fronts or economic/population structures affecting local regions. Exact areas of influence and inherited behavior are not fixed by this document.

---

## 9. Combat

Combat should derive local effective strength from population and contextual modifiers rather than a freestanding global military-power stat.

At a high level, a contested location/front compares something equivalent to:

```text
attacking committed population/pressure
× applicable attack modifiers

versus

defending committed population/pressure
× applicable defense modifiers
```

Possible modifiers include:

- terrain;
- structures and their areas of influence;
- PvE item/loadout bonuses;
- local geometry;
- isolation/connectivity if such a model is later accepted;
- future faction/class/doctrine effects.

The result drives population losses/casualties and territorial movement.

The precise pressure equations remain open.

A blitzkrieg-like attack, broad-front push, concentrated breakthrough, defensive contraction, or encirclement attempt should emerge from general spatial allocation and combat rules rather than from privileged named buttons.

---

## 10. Fronts

A **front** is a derived contiguous area of meaningful territorial contact/hostility between factions, not necessarily a permanent manually-authored game object.

Fronts are intended to become one important player/controller abstraction because they can turn arbitrary cell geometry into a more human-programmable unit of reasoning.

Potential front information/helpers include:

- opposing faction;
- cells/shape/length;
- terrain composition;
- local visible structures;
- own effective allocation/commitment;
- visible opposing allocation/pressure;
- attack/defense modifiers;
- local objectives/focus points;
- local war state.

The exact front segmentation algorithm and final API are unresolved and depend on the population-distribution discussion.

---

## 11. Supply/connectivity is deferred

Do **not** make a concrete supply/logistics model a V1 design commitment yet.

Supply could eventually provide useful emergent mechanics such as isolation and encirclement, but it ties heavily into whatever population distribution/redeployment model is chosen.

Until Open Fufu defines:

- what population allocation means spatially;
- what redeployment means;
- how local force exists/changes;

it is premature to define supply propagation, supply nodes, or isolation penalties.

The earlier idea of connectivity-driven supply remains a possible future direction, not an accepted V1 mechanic.

---

## 12. Team/FFA relationships and diplomacy

Open Fufu should **disable conventional in-match diplomacy changes**.

The game keeps team games and FFA, but players/controllers do not negotiate new formal alliances during the match.

### 12.1 Team games

Teams are configured before the match.

Team members are fixed friends/allies for that match. A primary use case is, for example, Fufu and Ski placing their controllers on the same team against AI factions and observing how their strategies cooperate.

### 12.2 FFA

FFA is the primary competitive/PvE-loot configuration.

There are no formal alliance changes during the match. Controllers may still produce **emergent informal cooperation** by independently choosing not to attack one another, focusing a runaway leader, or otherwise behaving as though they are temporarily cooperating.

That coordination is a consequence of programmed behavior, not a handshake/alliance button.

### 12.3 War state

A separate per-faction relationship such as `atWar` may represent whether active hostilities currently exist between two non-team factions.

This is distinct from formal friendship/team membership.

A controller may choose to begin hostilities, avoid hostilities, stop applying hostile pressure where rules allow, or focus elsewhere, but it cannot convert an FFA opponent into a formal teammate during the game.

This allows personality behaviors such as a Thorfinn-inspired controller that does not initiate wars and mainly fights factions that attack it, without requiring dynamic alliances.

---

## 13. Trade with enemies

Ports/docks/trade should not stop functioning merely because every relevant foreign faction is an FFA opponent or currently at war.

Open Fufu should allow trade with hostile/enemy factions as well as friendly/team factions.

War should reduce trade profitability rather than make trade impossible.

Current candidate penalty:

- approximately **50%–67% reduction** to trade effectiveness/revenue when trading with a faction currently at war with the trader.

The final penalty is unresolved.

This preserves economic/trade-focused strategies in FFA while still making peace/non-hostility economically preferable when the rules permit it.

---

## 14. PvE AI faction presets

There is no global Easy/Normal/Hard PvE difficulty selector.

PvE challenge is defined by the concrete AI faction presets/controllers added to the lobby.

Named AI factions should use reusable strategy components and the same legitimate game systems available to controllers rather than hidden simulation cheats.

Illustrative personalities remain:

### Tanya Degurechaff-inspired

- high-risk/high-reward;
- concentrated/narrow attacks;
- aggressive exploitation of breakthroughs;
- blitzkrieg-like preferences;
- willing to accept higher risk for decisive gains.

### Reinhard von Lohengramm-inspired

- strong economy optimization;
- identifies high-impact/high-threat targets;
- avoids scattered low-value aggression;
- prefers a small number of decisive targets;
- commits heavily when the predicted outcome is favorable.

### Thorfinn-inspired

With dynamic diplomacy removed, this archetype becomes:

- strongly non-aggressive;
- avoids initiating hostilities;
- tolerates other factions while they do not attack it;
- retaliates against aggressors;
- may stop focusing an opponent when continued war is strategically unnecessary, subject to the final war-state rules.

These names remain design references, not final shipped naming/content decisions.

---

## 15. PvE progression and loadouts

Persistent item progression is earned exclusively through PvE play.

The standard loadout contains **7 item slots**.

Only equipped items affect a match. The player's entire collection does not permanently stack onto account stats.

Future classes/factions may alter slot count or specialize loadouts, but that is explicitly beyond V1.

There is **no player-to-player item trading**.

PvP remains separate from PvE progression; competitive PvP should ultimately test controllers under progression-disabled or standardized conditions rather than reward PvE grinding.

---

## 16. Item generation and catalogue size

Items are deterministic and reproducible from their stable identity/seed plus generator version.

The design target is not literal mathematical infinity. It is a **very large, practically inexhaustible-feeling item catalogue** where finding an unusually strong, rare, amusing, or thematically pleasing item feels genuinely special.

The possible catalogue can grow extremely large through combinations of:

- many effect families;
- continuous/floating or finely quantized magnitudes within bounded legal intervals;
- items with one modifier;
- items with combinations of two modifiers;
- strong positive effects paired with smaller negative effects;
- future effect families and combinations;
- large deterministic naming/reference space.

Procedural generation remains constrained: every stat family still has legal ranges and hard balance caps.

### 16.1 Mechanical uniqueness

Two different item identities/seeds should **not intentionally represent mechanically identical items**.

For example, there should not be two different generated items whose entire mechanical effect is simply the same `+425 starting population` with no other mechanical distinction.

If the same item identity is rolled again, it is a duplicate of the same item.

The exact generator/catalogue technique used to enforce uniqueness is an implementation question.

---

## 17. Item stat stacking

Flat and percentage modifiers use a predictable universal ordering.

For a stat with both types of bonuses:

```text
final = (base + sum(flat bonuses)) × (1 + sum(percentage bonuses))
```

Example:

```text
base population = 10,000
flat bonuses     = +500, +425
percent bonuses  = +5%, +3%

final = (10,000 + 500 + 425) × 1.08
```

Percentage modifiers combine **additively with each other**, not multiplicatively.

This gives percentage modifiers meaningful interaction with large flat increases while avoiding compounding multiplicative escalation. Additional additive percentage bonuses provide decreasing relative improvement against an already boosted final value, which is the intended practical/effective diminishing-return behavior.

---

## 18. Normal PvE reward rolls

PvE loot is awarded on **victory**.

There are no separate concepts such as `high-quality rolls`.

A successful match produces a total number of ordinary item rolls:

```text
base victory rolls
+ explicit +X roll modifiers from defeated AI faction presets
= total rolls
```

The game rolls that many times and the player receives **the rarest result among those rolls**.

Example:

```text
base rolls        1
Tanya             +2 rolls
Reinhard          +3 rolls
other preset      +1 roll
                 --------
total              7 rolls

roll 7 times -> keep the rarest rolled item
```

Rarity is represented by the item's actual drop probability/weight characteristics rather than Common/Rare/Epic/Legendary labels.

The exact base number of rolls and each official AI preset's `+X rolls` value remain balance data.

Only legitimate/approved PvE configurations should award progression; user-created trivially suicidal opponents must not become a loot exploit. The exact eligibility mechanism is deferred.

---

## 19. Duplicates and gambling store

Normal PvE reward rolls **can produce an item the player already owns**.

Duplicate/unwanted items are useful because they can be sold for a separate meta-progression gambling currency.

That currency can be spent in a gambling store for random item rewards.

The gambling store follows a key rule:

> it does not drop items the player currently owns.

This creates the loop:

```text
PvE duplicate/unwanted item
        ↓
sell
        ↓
gambling currency
        ↓
store roll
        ↓
random currently-unowned item
```

Exact sale values, store prices, rarity weighting, and whether previously sold items immediately re-enter the store's eligible pool remain to be defined.

No player-to-player marketplace/trading system is planned.

---

## 20. Item names and references

Generated item names/descriptions may draw from:

- historical references;
- military/strategic references;
- literary references;
- anime-inspired catchphrases/references;
- jokes and incongruous names.

The naming pool should be large enough that a rare mechanically attractive item with a particularly good reference/name feels collectible and memorable.

Names may be semantically tagged so they loosely fit effects, but that is optional.

Actual shipped use of anime dialogue/references needs a deliberate content/copyright policy later; current character/catchphrase examples are design references rather than final approved content.

---

## 21. Controller language

The accepted V1 controller-language direction is **TypeScript with ordinary JavaScript-style code naturally supported**.

The goal is that a beginner can write simple code such as:

```ts
function tick(game) {
  // ordinary JavaScript-style controller logic
}
```

while advanced users can opt into TypeScript types, stronger editor assistance, and richer APIs.

Reasons for preferring one TS/JS runtime initially include:

- widely known and approachable;
- consistent with the inherited TypeScript codebase;
- strong typing/autocomplete can be offered without forcing it on beginners;
- one SDK/runtime/sandbox/documentation surface is substantially simpler than supporting several languages from day one.

Python is a reasonable future language if real demand exists, but is **not required for V1**. Rust/C/C++-style low-level languages are not desirable as the default player experience.

Sandbox technology and execution isolation remain implementation topics, not game-mechanics decisions.

---

## 22. Deterministic match versioning

Historical/replayable matches must bind immutable versions of every rule-bearing input required to reproduce them.

At minimum, the design should expect identities equivalent to:

- match seed;
- map + map version/hash;
- simulation ruleset version;
- controller runtime/API version;
- exact controller preset versions;
- exact PvE AI preset versions;
- equipped item identities/seeds and their generator versions;
- other versioned data that materially affects deterministic simulation.

Changing a combat formula or AI preset later must not silently change what an old recorded match means.

---

## 23. Explicitly unresolved mechanics for the next discussion

The next design conversation should focus on the actual mechanical ontology and relationships, especially:

1. **Population distribution:** what spatial thing is actually being allocated, and what high-level abstractions let ordinary users control it without cell-by-cell mathematics?
2. **Population roles:** does population committed to warfare still generate full FFY? Is there an explicit reserve? What does being `committed` mechanically mean?
3. **Redeployment/inertia:** once allocation exists, how quickly and through what rules can effective population move between fronts/regions?
4. **Population growth/capacity:** exact relationship between land, terrain, structures, current population, and growth.
5. **FFY generation:** exact relationship between population, structures, terrain, trade, and income.
6. **Front segmentation:** how arbitrary/disconnected borders are converted into stable, understandable controller objects.
7. **Combat equations:** how local population/pressure, attack/defense modifiers, casualties, and cell capture interact.
8. **War-state semantics:** exact transition rules for `atWar` and whether/when hostilities can cease in an FFA without formal diplomacy.
9. **Enemy trade penalty:** exact value/rules for trade while at war.
10. **Supply/connectivity:** intentionally deferred until population allocation/redeployment has a clear meaning.
11. **Loot sampling mathematics:** exact probability system that produces deterministic unique items and allows `rarest of N rolls` to be well-defined.
12. **Gambling-store economy:** sale values, prices, weighting, and eligibility after selling an owned item.

These are gameplay-design questions. Server migration, persistence/database selection, authentication, sandbox technology, Foof integration, and inherited-code migration strategy belong to the later implementation/integration conversation.
