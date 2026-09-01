# Open Fufu — Product and Architecture Direction

## Status

This document is the canonical early design baseline for the Open Fufu game project.

It records product and architecture decisions accepted before implementation begins. It is intentionally broader than an implementation plan and should evolve as the design is tested.

Open Fufu is a fork of OpenFront, but the project is expected to diverge substantially. OpenFront is a technical starting point and upstream reference, not a ruleset or architecture that Open Fufu must preserve indefinitely.

No implementation work is implied merely by this document.

---

## 1. Core product idea

Open Fufu is a browser-viewable territorial strategy game in which the player does not primarily issue moment-to-moment orders.

Instead, each player writes, versions, selects, and improves an AI/controller for their own faction. The controller determines how that faction behaves in a match.

The player is therefore programming the effective player of the game.

The long-term controller surface should be able to influence:

- expansion;
- attack target selection;
- attack geometry and force concentration;
- defense;
- retreat and controlled territory abandonment;
- resource allocation;
- economy;
- construction and infrastructure placement;
- threat assessment;
- diplomacy;
- logistics and supply;
- strategic state/memory.

The game is primarily PvE, with PvP as a separate optional mode.

---

## 2. Relationship to Foof

Open Fufu is a separate game/service and must not become part of the `foof-bot` codebase.

Foof should integrate with Open Fufu through an explicit game-facing API/service boundary.

Conceptually:

```text
Discord
   │
   ▼
Foof
   │
   │ game-facing API
   ▼
Open Fufu service
   │
   ├── authoritative simulation
   ├── player controller execution
   ├── PvE faction controllers
   ├── controller presets/versions
   ├── progression and item collection
   ├── match history/replays/logs
   └── browser viewer/editor
```

Foof should own Discord-native concerns such as commands, presentation, identity handoff, match initiation, selecting controller presets/loadouts, and displaying results/rewards.

Open Fufu should remain coherent if Foof is absent.

Foof should not import simulation internals, execute user controller code, or manipulate Open Fufu persistence directly.

---

## 3. Relationship to OpenFront upstream

The fork keeps OpenFront as the useful technical bootstrap for areas such as:

- map loading and map representation;
- territory rendering and visualization;
- browser camera/UI infrastructure;
- deterministic simulation concepts;
- selected game-object abstractions;
- selected WebSocket/networking infrastructure;
- selected map and structure concepts.

Open Fufu is expected to heavily replace or redesign:

- the player input model;
- server/client authority assumptions;
- territorial expansion;
- attack resolution;
- defensive simulation;
- force allocation;
- player controller architecture;
- PvE AI architecture;
- persistence;
- progression;
- match orchestration.

The project should preserve the legal licensing and attribution obligations inherited from OpenFront while allowing the game design to diverge freely.

Upstream compatibility is useful where practical but is not a governing design constraint.

---

## 4. Authoritative simulation

OpenFront currently relies on deterministic client-side simulation while the game server coordinates and relays intents.

Open Fufu should move toward a canonical authoritative simulation running on the server/Fufubox.

Matches must be able to start, progress, and finish even when no browser client is connected.

Conceptually:

```text
                  Open Fufu server
                         │
              ┌──────────▼──────────┐
              │ authoritative world │
              │     simulation      │
              └──────────┬──────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      player controller  player AI    PvE AI
            │            │            │
            └──── policy/intents ─────┘
                         │
                         ▼
                     next tick
                         │
                         ▼
                  canonical state
                         │
              browser/Foof outputs
```

This server authority also enables:

- accelerated simulations;
- unattended PvE matches;
- tournaments;
- controller testing;
- deterministic replay and analysis.

---

## 5. Player controller presets and versions

Players should be able to maintain multiple reusable controller presets, for example:

```text
greedy-expansion
compact-defense
high-risk-blitz
naval-islands
anti-swarm
competitive-current
```

Controller presets must be versioned.

When a match starts, the exact controller version used by that match becomes immutable for historical/replay purposes.

A later edit must never silently change the behavior of an old match.

A match should therefore bind information equivalent to:

```text
controller: greedy-expansion@v12
match seed: <seed>
controller runtime/API version: <version>
```

---

## 6. Controller security boundary

Player-authored controller code must be treated as potentially malicious.

It must never run with ordinary Foof authority, ordinary game-server host authority, or unrestricted access to Fufubox.

The eventual controller sandbox must enforce at minimum:

- no host filesystem access;
- no arbitrary networking;
- no subprocess execution;
- no environment-variable access;
- no access to Fufubox secrets;
- no unrestricted native modules;
- deterministic game-provided randomness where required;
- explicit memory limits;
- explicit CPU/instruction/time limits;
- explicit action/output limits;
- deterministic/safe timeout and failure behavior.

An in-process `eval`, `Function`, or nominal JavaScript VM wrapper is not sufficient as the security boundary.

TypeScript/JavaScript is a strong initial controller-language candidate because of the inherited TypeScript codebase and player accessibility, but the sandbox architecture is more important than the language choice.

---

## 7. Spatial territorial simulation

Open Fufu should not preserve the assumption that an attack is merely:

```text
attacker + target + troop amount
```

A faction should be able to choose not only **who** to attack, but **how force is distributed across space**.

The long-term territorial model should support concepts such as:

- local offensive pressure;
- local defensive pressure;
- force concentration;
- front segments;
- front geometry;
- local terrain/movement cost;
- reserves and reinforcement;
- supply/connectivity;
- local strategic value;
- retreat and deliberate abandonment;
- isolation and encirclement;
- front evolution over time.

The goal is for recognizable strategic doctrines to emerge from general simulation rules rather than from hard-coded named abilities.

A blitzkrieg-like strategy should not require a privileged `blitzkrieg()` action. It should emerge from concentrating force into a narrow corridor, accepting flank/supply risk, driving depth aggressively, and exploiting breakthroughs.

Likewise, a compact defensive strategy should be able to abandon unfavorable salients and reduce frontage/contact area in order to increase effective local defensive strength.

---

## 8. Several controller abstraction levels

Players should not be forced to write low-level computational geometry merely to participate.

The controller design should eventually support several abstraction levels over the same underlying simulation.

Conceptually:

```text
high-level strategy helpers
        ↓
operational directives
        ↓
spatial policy / force weighting
        ↓
territorial simulation
```

High-level helpers may eventually express concepts such as:

- attack a faction;
- defend a front;
- expand into neutral territory;
- retreat from a region;
- prioritize an objective.

Advanced controllers should be able to go deeper and influence:

- front weighting;
- attack corridors;
- target points;
- force concentration;
- reserves;
- retreat lines;
- offensive pressure;
- defensive priority;
- territory value;
- movement preference.

The lower-level engine must therefore not bake in the assumption that all attacks use the same expansion pattern.

---

## 9. Spatial policy / force-field direction

A promising abstraction is for controllers to produce or influence spatial policy fields that the simulation normalizes against actual available faction resources.

Possible fields include:

- offensive pressure;
- defensive pressure;
- movement preference;
- territory value;
- reinforcement priority.

High-level helpers can generate these fields for less advanced controllers, while advanced controllers can influence them more directly.

The territorial engine should not need to care whether the policy came from:

- a built-in helper;
- a player controller;
- a PvE faction controller;
- a tournament controller;
- a future alternate controller implementation.

---

## 10. Supply and encirclement

Supply/connectivity should eventually matter enough that territorial geometry has strategic consequences.

A narrow deep spearhead should be powerful but vulnerable to being cut off.

If connectivity to the faction interior is severed, isolated territory should suffer appropriate consequences such as reduced reinforcement, reduced effective pressure, reduced combat efficiency, or eventual collapse.

The system should remain simpler than a full grand-strategy logistics simulator unless testing demonstrates a need for more complexity.

The design goal is to make concepts such as encirclement, chokepoints, salients, secure depth, and controlled withdrawal emerge from understandable spatial rules.

---

## 11. PvE has faction presets, not global difficulty

Open Fufu should not have a global Easy / Normal / Hard PvE difficulty selector.

PvE difficulty should emerge from the specific AI faction/controller presets present in the lobby.

Adding AI factions to a PvE lobby should therefore mean selecting concrete AI personalities/controllers, not selecting a generic difficulty level.

Each AI faction preset can have its own expected challenge and reward contribution.

A lobby itself becomes the risk/reward configuration.

---

## 12. Reusable PvE strategy library

PvE factions should be built from reusable strategic behaviors rather than every named faction containing a fully separate monolithic AI implementation.

Possible reusable behaviors include:

- economy-first;
- high-risk breakthrough;
- opportunistic aggression;
- compact-front defense;
- retaliation-only diplomacy;
- weakest-neighbor targeting;
- highest-threat targeting;
- high-confidence attack thresholds;
- reserve-heavy defense;
- encirclement preference;
- supply-safe advance;
- sacrificial salient abandonment;
- alliance-seeking;
- coastal/naval preference;
- betrayal/treachery behavior if diplomacy supports it.

Named faction presets should combine and parameterize these strategies into recognizable personalities.

Illustrative directions discussed so far:

### Tanya Degurechaff-inspired

- high-risk/high-reward behavior;
- narrow concentrated attacks;
- aggressive breakthrough exploitation;
- blitzkrieg-like doctrine;
- willingness to accept substantial risk for decisive gains.

### Reinhard von Lohengramm-inspired

- strong economy optimization;
- identifies high-impact/high-threat targets;
- avoids low-value scattered aggression;
- commits large force to relatively few chosen targets;
- prefers favorable decisive engagements.

### Thorfinn-inspired

- strongly non-aggressive;
- attempts to befriend other factions;
- avoids initiating wars where possible;
- primarily attacks aggressors or unavoidable threats.

These names are design references, not yet a final shipped naming/content policy.

The important rule is that AI personalities should emerge from controller strategy, not secret faction-specific cheats in the simulation.

---

## 13. PvE-only meta progression

Persistent meta progression is earned exclusively through PvE play.

PvE and PvP should remain distinct modes with distinct purposes.

Winning PvE matches should provide deterministic item/reward rolls from an effectively unbounded item space.

Progression should expand the player's collection and available build choices rather than permanently stacking every acquired item bonus onto the account.

---

## 14. Loadout model

Only a small fixed number of collected items should affect a match.

The current design target is approximately **6–7 equipped items**, with the exact number unresolved. A symbolic/thematic slot count may be chosen later.

The collection itself may become very large, but only equipped items apply.

This allows progression without unbounded permanent stat inflation.

Loadouts should support recognizable builds such as:

- fast starting-population;
- population growth;
- economy-first;
- compact defense;
- offensive pressure;
- logistics/supply.

---

## 15. Item philosophy

Initial items should remain intentionally simple.

A V1 item should contain approximately:

```text
name
one stat modifier
exact generated magnitude
rarity/drop characteristic
deterministic seed
generator version
```

Do not initially add:

- conventional rarity tiers;
- item levels;
- sockets;
- crafting;
- upgrade trees;
- piles of secondary affixes;
- set bonuses;
- enchantments.

Items should modify fundamental simulation/economy parameters that the controller still has to exploit intelligently.

Useful initial effect families include:

### Population

- flat starting population;
- percentage starting population;
- population growth;
- maximum population.

### Military

- offensive pressure/power;
- defensive pressure/power;
- reinforcement effectiveness;
- force recovery;
- movement where appropriate.

### Economy

- starting gold/resources;
- gold/resource generation;
- construction efficiency/cost;
- economic growth.

### Logistics / territory

- supply range;
- supply throughput;
- reinforcement speed;
- strength retention while isolated;
- movement/expansion efficiency where appropriate.

---

## 16. Deterministic item generation

Items must be generated deterministically from a seed.

Conceptually:

```text
item seed
+ generator version
        ↓
name
effect family
magnitude
rarity/drop characteristic
future deterministic metadata
```

The same `(generator version, seed)` must always reproduce the same item.

Generator versioning is mandatory so later balance/generator changes do not silently mutate items that players already own.

Persistent ownership should therefore be able to store stable generated-item identity plus acquisition metadata rather than redundantly storing every derived field.

---

## 17. Constrained item stats

Procedural generation must not mean unconstrained arbitrary values.

Each effect family should define:

- approved minimum and maximum values;
- approved quantization/steps where appropriate;
- a controlled relationship between effect magnitude and rarity;
- hard balance caps.

For example, a flat starting-population effect might use a bounded stepped progression instead of arbitrary integers.

Likewise, percentage modifiers must be constrained so deterministic generation can never produce accidental game-breaking values.

The concrete balance table is deferred.

---

## 18. No conventional item rarity tiers

Items should not need labels such as Common, Rare, Epic, or Legendary.

Rarity should instead be expressed through the item's actual generated drop characteristics.

A stronger item may simply be much less likely to appear than a modest item.

The precise loot mathematics remain unresolved because an effectively unbounded generated item space cannot be represented naively as millions of independent static probabilities that all sum to 100%.

The eventual implementation must preserve the player-facing idea that each deterministic item has an understandable rarity/drop characteristic while using mathematically coherent sampling internally.

---

## 19. AI factions affect reward rolls

Because there is no global PvE difficulty, reward scaling should derive from the AI faction presets actually defeated.

Stronger or more demanding AI presets should improve the reward outcome.

One accepted direction is that selected AI faction presets contribute additional reward rolls when the player wins the match.

Conceptually:

```text
base PvE victory reward
+ reward contribution from AI preset A
+ reward contribution from AI preset B
+ reward contribution from AI preset C
```

The exact stacking rules, anti-exploit rules, and reward table remain unresolved.

Reward should primarily care about successful completion against the configured PvE opposition rather than raw match duration or easily farmed statistics.

---

## 20. Item naming direction

Generated items should have a very large deterministic naming space.

Candidate naming sources include:

- historical references;
- strategic/military references;
- literary references;
- anime-inspired references and catchphrase transformations;
- jokes and deliberate incongruities.

Names may eventually use semantic tags so names loosely match effect families instead of being fully random.

For example, a fortification-themed historical reference may be more likely to appear on defense/frontage-related effects, while a commitment/movement-themed reference may appear on offensive effects.

Any public release should use a deliberate content/copyright policy rather than blindly storing large verbatim dialogue libraries.

---

## 21. PvP separation

PvP is separate from PvE progression.

The default competitive PvP direction should prioritize controller quality rather than accumulated PvE collection power.

A likely long-term split is:

```text
PvE
    progression/loadouts enabled

PvP casual
    configurable rules

PvP ranked
    progression bonuses disabled or standardized
```

Exact PvP rules are deferred.

---

## 22. Match observability and debugging

Because the player's real work is programming a controller, match analysis should eventually be a first-class feature.

Useful outputs include:

- deterministic replays;
- decision/event logs;
- optional controller debug logs;
- territory/front history;
- resource history;
- action counts;
- failed/aborted actions;
- controller runtime/CPU budget statistics;
- post-match summaries.

A player should be able to understand not only that their faction failed, but why their controller made the decisions that led to failure.

---

## 23. Initial implementation philosophy

Open Fufu should not attempt to ship every long-term system at once.

However, early architecture should avoid interfaces that make the long-term direction impossible.

In particular:

- do not bake `attack = attacker + target + troop count` into the new simulation boundary;
- do not make browser presence necessary for simulation progress;
- do not treat PvE difficulty as one global scalar;
- do not make PvE AI personalities depend on hidden simulation cheats;
- do not permanently stack every collected item onto the player's account;
- do not let user controller code share ordinary server authority.

Simple V1 behavior is acceptable if the underlying contracts remain extensible toward the richer model above.

---

## 24. Major unresolved design questions

The following remain intentionally open and should be resolved before or during implementation planning:

1. Exact authoritative server migration strategy from inherited OpenFront architecture.
2. Exact controller API and tick/cadence model.
3. Exact sandbox technology and process/container boundary.
4. How controllers observe the map without exposing unnecessarily expensive raw state every tick.
5. Exact front-segmentation and spatial-policy representation.
6. Exact territorial pressure/combat equations.
7. Exact supply/connectivity model.
8. Exact economy/resource model beyond OpenFront's current rules.
9. Exact controller persistent-memory model and limits.
10. Exact item sampling mathematics for an effectively unbounded deterministic item space.
11. Exact item slot count and any thematic meaning attached to it.
12. Exact PvE AI reward-roll contribution system.
13. Persistence/database model for users, controllers, items, matches, and replays.
14. Authentication/identity contract between Open Fufu, the browser surface, and Foof.
15. How much inherited OpenFront code should be retained versus deliberately replaced during the first playable milestone.

---

## 25. Near-term next work

Before gameplay implementation, the next useful work is architectural analysis of the fork itself.

That analysis should identify:

- current core simulation boundaries;
- current territory ownership and expansion implementation;
- current attack/defense execution path;
- current bot/AI architecture;
- current map data structures;
- current game-loop/tick cadence;
- current client/server synchronization path;
- which modules can be retained as-is;
- which modules should become compatibility shims;
- which modules should be replaced entirely.

From that audit, Open Fufu can define a staged migration plan toward the authoritative programmable-faction architecture without blindly rewriting useful inherited infrastructure.