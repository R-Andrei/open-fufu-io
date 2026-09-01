# Open Fufu — Latest Mechanics Decisions Addendum

## Status and precedence

This document records the latest accepted game-mechanics decisions from the ongoing pre-implementation design discussion.

It supplements `docs/OpenFufuDesign.md`, `docs/GameMechanics.md`, `docs/PopulationEconomyDecisions.md`, and `docs/SpatialAllocationDecisions.md`.

Where this document makes a concrete decision that an older document still describes as tentative, candidate, or unresolved, **this document takes precedence**.

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

---

## 3. Segments are immutable strategic map regions

The accepted segment direction is that segments are **immutable deterministic geographical regions generated as part of map creation/preprocessing**, not dynamically recomputed pieces of the current political boundary.

Every land cell belongs to a stable segment. Segments are a coarser strategic lens over the cell map:

```text
cell lens
    fine-grained simulation cells

segment lens
    stable strategically meaningful geographic patches
```

Segment identity does not change merely because ownership changes or combat moves through the region.

A segment may therefore be partially owned by multiple factions. For example, a mountain segment can be 60% Fufu-owned and 40% Tanya-owned while the underlying mountain region itself remains the same segment.

Segments should be based only on relatively static map properties such as:

- terrain regions/boundaries;
- rivers;
- coastlines;
- impassable geography;
- chokepoints and major geographic shape;
- deterministic subdivision of excessively large homogeneous areas.

Dynamic properties such as current ownership, current structures, current combat, and current population allocation should **not** define segment identity.

This model applies equally to authored maps and random maps. A deterministic random-map pipeline may conceptually perform:

```text
map seed
    -> terrain/geography generation
    -> strategic segment generation
    -> immutable segment graph
```

The exact segmentation algorithm, target granularity, river treatment, maximum segment size, and geometric heuristics remain open and should be ironed out separately.

Because segment identity is stable, the previously discussed dynamic segment split/merge lineage problem largely disappears.

The exact need/definition of a separate `Front` abstraction remains deferred until the segment model is fully specified.

---

## 4. Local-pressure combat direction accepted

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

## 5. Neutral expansion uses the same allocation philosophy

Neutral expansion should use allocated Population and spatial weighting rather than an unrelated expansion resource.

A controller may devote a literal portion of total Population to neutral expansion. That commitment is then distributed over relevant neutral-border geometry and affects expansion pressure/capture speed.

V1 should not invent automatic population deaths merely for settling neutral land. The primary cost of expansion commitment is opportunity cost: Population used there is not simultaneously exerting pressure elsewhere.

Terrain may explicitly modify neutral expansion efficiency.

---

## 6. Naval/amphibious operations use committed Population

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

## 7. Derived war-state semantics accepted

For non-team factions, `atWar` is a symmetric **derived state describing current/recent hostilities**, not permission to attack.

FFA opponents remain legally attackable whether `atWar` is true or false.

Clearly hostile actions such as land attacks, amphibious attacks, destructive naval attacks, territorial capture, or direct destructive weapons set `atWar = true` for the pair.

If neither side performs relevant hostile actions for a rules-defined inactivity period, `atWar` returns to false.

The exact inactivity timeout remains balance data.

---

## 8. Wartime trade remains available; default penalty is 50%

Trade with enemies remains allowed.

The accepted V1 starting point is a **50% wartime trade penalty** while `atWar` is true.

This is a surfaced game modifier and may later be altered by explicit factions/classes/items/structures or other mechanics. For example, a future faction could reduce or remove the default wartime trade penalty.

Naval interdiction/warships can further reduce realized trade profitability through actual in-world disruption, so the effective economic damage of war may exceed the base 50% modifier.

---

## 9. Visibility boundary reaffirmed

Globally visible:

- terrain/static geography;
- territorial ownership;
- stable segment geometry;
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

## 10. Controller API should expose small composable primitives

Open Fufu should **not** make strategic policies such as `weakestPoint`, `turtle`, `blitz`, or `threatWeighted` privileged engine concepts.

The controller API should expose small, orthogonal, minimally opinionated primitives for:

- reading faction/map/segment/unit/economic state that is legally visible;
- assigning Population and spatial weights;
- constructing/upgrading structures;
- selecting legal targets/objectives;
- launching naval/amphibious operations;
- using inherited unit/building mechanics;
- performing other concrete mechanical actions.

Higher-order policy, doctrine, target selection, and strategy should be written by the player using those primitives.

Open Fufu may provide documentation and example snippets, but there is no need for a privileged built-in strategy/policy library.

### Starter controller

Every player should begin with a **minimal complete working controller** that demonstrates lawful use of the ordinary game primitives.

The starter controller should intentionally be strategically weak/simple rather than secretly competent. It may, for example:

- expand monotonously/thoughtlessly;
- allocate Population evenly;
- build/upgrade in a simple even pattern;
- exercise the major mechanics that an ordinary controller is expected to use;
- avoid sophisticated target selection, policy systems, threat analysis, or doctrine.

Its purpose is to provide a runnable starting point that players can understand and modify, not to provide a strong strategy. With such a controller, winning should be largely circumstantial/luck-based rather than the result of hidden built-in intelligence.

---

## 11. Controller drafts, certification, and publication

Players should be allowed to **save broken/incomplete drafts** while editing.

However, an immutable controller version must pass a mandatory fast **certification/validation simulation** before it can be published and used in real matches.

Conceptual lifecycle:

```text
edit
 -> save draft
 -> run certification
 -> pass
 -> publish immutable controller version
 -> usable in matches
```

Certification should use the real production controller API/runtime constraints and rapidly exercise a broad range of legal game situations, including combinations such as:

- neutral expansion;
- first enemy contact;
- multiple simultaneous opponents;
- partial segment ownership;
- rapidly changing Population;
- disappearing/capitulating opponents;
- naval/amphibious targets;
- structure construction with sufficient/insufficient FFY;
- war-state changes;
- extreme low-Population conditions;
- invalid/mathematically impossible requested operations;
- runtime/time/memory/output-limit violations.

Certification failure must return useful diagnostics and prevent publication until corrected.

Certification cannot mathematically prove arbitrary user code will never fail on every possible future state. It guarantees that the version compiles/validates, uses the contract lawfully in the certification cases, survives the certification gauntlet, and obeys controller resource limits.

The exact production-match behavior if a certified controller nevertheless throws, times out, or emits invalid output remains an open design question and must fail safely without crashing the match simulation.

---

## 12. Redeployment scaling is sublinear in Population

A larger faction should have greater absolute redeployment capacity than a smaller faction, but the relationship must be **sublinear** so size does not multiply both force advantage and strategic agility linearly.

The accepted starting direction is a normalized power curve approximately equivalent to:

```text
RedeploymentCapacity(P)
    = Rref * (P / Pref)^(2/3)
```

where `Pref` and `Rref` are ruleset/map balance constants.

The `2/3` exponent is the accepted V1 starting point, subject to later balance testing. It means, approximately:

```text
Population advantage      Redeployment-capacity advantage
2x                         1.59x
4x                         2.52x
8x                         4x
27x                        9x
```

This is not comeback/rubber-band logic. Larger factions remain faster in absolute redeployment, but become proportionally less agile as they scale.

The resulting Redeployment Rate/Capacity must be surfaced explicitly to the controller/player. Explicit items, structures, terrain, rail systems, factions/classes, etc. may modify it later under the normal modifier rules.

Exact reference values and tick-level application remain balance/mechanics details.

---

## 13. Item presentation includes flavor and visual identity

A generated item should include more than its mechanical effect.

In addition to deterministic mechanical identity/stat data, an item should have deterministic presentation metadata including approximately:

- a **name**;
- a **dialogue/flavor line or description**;
- a **visual asset/identity**, with SVG or an equivalent lightweight deterministic visual representation as the current direction.

The exact visual-generation/art pipeline is an implementation/content question.

---

## 14. Duplicate items are automatically converted; owned items cannot be manually sold

Normal PvE reward rolls may produce duplicates.

If a reward is an item the player already owns, the duplicate is **automatically converted into a separate persistent gambling-store currency**. This currency is not FFY; FFY remains the in-match economy currency.

Players may **not manually sell owned items**. This prevents players from liquidating weak items and repeatedly gambling their collection in pursuit of stronger items.

The duplicate-conversion system exists as bad-luck protection, not as a player-driven item marketplace.

Every duplicate should provide **at least enough gambling currency for one store roll**. More unusual/rare duplicates may provide somewhat more, potentially enough for multiple rolls.

Currency/store numbers should remain deliberately small and human-readable. A conceptual scale is roughly:

```text
one store gamble:         10 currency
low-rarity duplicate:     >= 10
ordinary duplicate:       ~11-13
rare duplicate:           ~15-18
extremely rare duplicate: ~20+
```

Exact values remain balance data.

The store excludes items the player currently owns from its eligible results.

---

## 15. PvE AI reward rolls depend on match composition, not elimination credit

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

## 16. Team PvE awards reduced progression loot per human

Team PvE may award progression loot.

The accepted starting rule is:

```text
solo-equivalent total rolls
/ number of participating human teammates
= rolls per human
```

Round up, with a minimum of one roll per human.

Each human independently performs that reduced number of rolls and receives the rarest result from their own roll set.

Example:

```text
lobby solo-equivalent reward: 9 rolls

1 human -> 9 rolls
2 humans -> 5 rolls each
3 humans -> 3 rolls each
```

This keeps cooperative play rewarding without multiplying total account progression simply because several humans are present. Exact anti-abuse details may remain lightweight because team PvE is primarily a friends/co-op mode rather than a tightly competitive economy.

---

## 17. Still-open questions from this discussion

The following remain deliberately unresolved and should be discussed before being promoted into accepted mechanics:

1. **Segment-generation specifics:** exact deterministic algorithm/granularity for immutable map segments, including homogeneous-area subdivision, rivers, coastlines, chokepoints, segment adjacency, and authored versus procedural-map preprocessing.
2. **Front definition:** defer until the segment model is concrete enough to determine whether fronts are necessary as separate controller-facing objects at all.
3. **Runtime controller failure behavior:** what deterministic safe fallback occurs if a published/certified controller throws, times out, violates limits, or emits invalid output during a real match, including failures very early or very late in a match.
4. **Exact combat/casualty/capture equations:** local-pressure direction is accepted; formulas remain open.
5. **Certification gauntlet coverage/details:** exact scenarios, duration, diagnostics, and publication UX remain to be specified even though mandatory certification is accepted.
6. **Redeployment constants/application:** `2/3` sublinear scaling is accepted; exact `Pref`, `Rref`, tick accounting, and interaction with explicit modifiers remain balance/mechanics work.
