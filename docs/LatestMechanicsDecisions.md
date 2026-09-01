# Open Fufu — Latest Mechanics Decisions Addendum

## Status and precedence

This document records the latest accepted game-mechanics decisions from the ongoing pre-implementation design discussion.

It supplements `docs/OpenFufuDesign.md`, `docs/GameMechanics.md`, `docs/PopulationEconomyDecisions.md`, and `docs/SpatialAllocationDecisions.md`.

Where this document makes a concrete decision that an older document still describes as tentative, candidate, or unresolved, **this document takes precedence**. It deliberately does not settle the segment ontology, controller primitive API, validation-simulation design, or nonlinear Redeployment Rate formula, which remain active discussion topics.

This is a game-design document, not an implementation plan.

---

## 1. Globally public faction macro statistics are fixed

Every surviving faction exposes exactly these three macro-level values globally:

- **Population**;
- **Territory %**;
- **FFY**.

These values exist to support macro threat assessment, leader identification, opportunistic targeting, and emergent coalition-like behavior while detailed operational information remains subject to the local-contact visibility rules documented elsewhere.

---

## 2. Randomly generated maps are a desired game option

Open Fufu should support **randomly generated maps as an optional map source** in addition to authored/static maps.

Any accepted segment representation must therefore work equally well for authored maps and deterministic procedurally generated maps.

The relationship between segment generation and map generation remains unresolved and is intentionally not fixed here.

---

## 3. Local-pressure combat direction accepted

Combat should be driven by **local effective population pressure/density**, not merely by faction-wide or front-wide absolute population totals.

Population assigned to a broad border should not exert the same local force as the same population concentrated into a narrow breakthrough.

Conceptually:

```text
segment/front commitment
        + spatial distribution / operation
        -> local population pressure
        x explicit attack/defense modifiers
        -> effective local pressure
```

Explicit modifiers may come from terrain, structures, items, future factions/classes, and other surfaced mechanics.

The precise deterministic casualty/capture equations remain open.

---

## 4. Neutral expansion uses the same allocation philosophy

Neutral expansion should use allocated Population and spatial weighting rather than an unrelated expansion resource.

A controller may devote a literal portion of total Population to neutral expansion. That commitment is then distributed over relevant neutral-border geometry and affects expansion pressure/capture speed.

V1 should not invent automatic population deaths merely for settling neutral land. The primary cost of expansion commitment is opportunity cost: Population used there is not simultaneously exerting pressure elsewhere.

Terrain may explicitly modify neutral expansion efficiency.

---

## 5. Naval/amphibious operations use committed Population

Amphibious operations should carry/use part of the faction's ordinary Population commitment rather than a separate manpower resource.

Conceptually:

```text
Population assigned to amphibious operation
        -> transport capacity / naval movement
        -> remote coastal objective
        -> landing creates or joins operational contact/front
```

Population being transported is not simultaneously exerting land pressure elsewhere. Destruction of transports may destroy the carried Population according to the inherited/final naval combat rules.

Exact capacities and transport timing remain balance/implementation details.

---

## 6. Derived war-state semantics accepted

For non-team factions, `atWar` is a symmetric **derived state describing current/recent hostilities**, not permission to attack.

FFA opponents remain legally attackable whether `atWar` is true or false.

Clearly hostile actions such as land attacks, amphibious attacks, destructive naval attacks, territorial capture, or direct destructive weapons set `atWar = true` for the pair.

If neither side performs relevant hostile actions for a rules-defined inactivity period, `atWar` returns to false.

The exact inactivity timeout remains balance data.

---

## 7. Wartime trade remains available; default penalty is 50%

Trade with enemies remains allowed.

The accepted V1 starting point is a **50% wartime trade penalty** while `atWar` is true.

This is a surfaced game modifier and may later be altered by explicit factions/classes/items/structures or other mechanics. For example, a future faction could reduce or remove the default wartime trade penalty.

Naval interdiction/warships can further reduce realized trade profitability through actual in-world disruption, so the effective economic damage of war may exceed the base 50% modifier.

---

## 8. Visibility boundary reaffirmed

Globally visible:

- terrain/static geography;
- territorial ownership;
- boundary/segment geometry;
- Population, Territory %, and FFY for each surviving faction.

Operational/local rather than globally exposed:

- enemy Population commitment;
- local combat pressure;
- mobile enemy units;
- detailed enemy combat/economic structure state where local visibility rules require contact;
- other tactical state.

Private:

- controller memory;
- future intended allocations/orders;
- internal controller decision state.

This preserves intentional remote routing and surprise amphibious attacks without granting advance tactical intelligence about the target.

---

## 9. Item presentation includes flavor and visual identity

A generated item should include more than its mechanical effect.

In addition to deterministic mechanical identity/stat data, an item should have deterministic presentation metadata including approximately:

- a **name**;
- a **dialogue/flavor line or description**;
- a **visual asset/identity**, with SVG or an equivalent lightweight deterministic visual representation as the current direction.

The exact visual-generation/art pipeline is an implementation/content question.

---

## 10. Duplicate items are automatically converted; owned items cannot be manually sold

Normal PvE reward rolls may produce duplicates.

If a reward is an item the player already owns, the duplicate is **automatically converted into gambling-store currency**. The player does not choose whether to keep a duplicate copy.

Players may **not manually sell owned items**. This prevents players from liquidating weak items and repeatedly gambling their collection in pursuit of stronger items.

The duplicate-conversion system exists as bad-luck protection, not as a player-driven item marketplace.

Currency/store numbers should remain deliberately small and human-readable. A conceptual scale discussed is roughly:

- one gambling-store roll around `10` currency;
- ordinary duplicate values around the same order of magnitude;
- lower-rarity duplicates somewhat below that;
- very rare duplicates somewhat above it.

Exact values remain unresolved, including whether every duplicate should guarantee at least enough currency for one immediate store roll.

The store continues to exclude items the player currently owns from its eligible results.

---

## 11. PvE AI reward rolls depend on match composition, not elimination credit

An approved AI preset contributes its configured `+X rolls` reward modifier by **being part of the won PvE match**.

The winning player/team does not need to personally deliver the elimination/capitulation of that AI.

Conceptually:

```text
base victory rolls
+ all applicable approved AI-preset roll modifiers present in the match
= final roll count
```

The match then rolls the item table that many times and awards the rarest result, following the previously accepted reward model.

This intentionally treats a lobby full of stronger AI presets as a more difficult overall battle-royale environment even when those AIs also fight one another.

---

## 12. Team PvE may award progression loot

Team PvE is allowed to award PvE progression loot.

Because multiple human controllers can cooperate, team rewards should be **reduced relative to equivalent solo/FFA PvE** rather than disabled entirely.

A current candidate direction is:

```text
calculate the lobby's normal available roll count
reduce/cap it for team play (for example approximately half)
perform the reduced roll process separately for each participating human player
```

The exact reduction/cap formula is not yet fixed. The purpose is to let friends play together and both receive progression without requiring a highly punitive anti-carry system.

---

## 13. Still-open questions from this discussion

The following remain deliberately unresolved and should be discussed before being promoted into accepted mechanics:

1. **Segment ontology:** whether segments are immutable/generated map regions or dynamically recomputed boundary aggregates; how terrain patches, partial ownership, coastlines, rivers, and procedural map generation interact with them.
2. **Front definition:** defer until the segment model is concrete enough to determine whether fronts are necessary as separate controller-facing objects.
3. **Controller API philosophy:** whether Open Fufu should expose only small composable primitives and leave higher-order policies entirely to player code, versus shipping built-in policy helpers/reference strategies.
4. **Controller validation simulation:** exact design of a mandatory fast pre-publication simulation/test that rejects controllers which encounter runtime/API/math errors before they can be saved/published.
5. **Redeployment scaling:** a larger faction should redeploy more absolute Population than a smaller faction, but Redeployment Rate should have diminishing/sublinear scaling so population advantage does not create an excessive positive feedback loop.
6. **Exact combat/casualty/capture equations:** local-pressure direction is accepted; formulas remain open.
7. **Exact duplicate-store values:** including whether every duplicate guarantees at least one store gamble.
8. **Exact team-PvE reward reduction/cap.**
