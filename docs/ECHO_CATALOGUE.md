# Open Fufu — Provisional Echo Catalogue Contract

## Status

This file is the **provisional working contract for V1 Echo generation/content**, analogous to `ORIGIN_TRAIT_CATALOGUE.md` for Origins.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical integration authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

Nothing in this file authorizes gameplay implementation.

The current first-version decisions are:

- Echoes are collectible anime/JRPG dialogue-line modifiers.
- Standard PvE loadout size remains **7 Echoes**.
- An Echo carries **one or two deterministic numeric modifiers**.
- Echoes specialize/tune a build; they should not normally introduce Origin-scale rule transformations, hard capabilities, alternate spawn topology, structure-count rules, free structures, or similar mechanics.
- Positive and negative variants may exist for allowed stats where meaningful.
- Exact value intervals, sign probabilities, one-vs-two-modifier probabilities, combination rules, rarity/weight formula, dialogue generation, and catalogue-generation algorithm are **not yet settled** and are the next design work.

---

## V1 allowed Echo modifier pool

The pool below is the accepted first V1 candidate set after intentionally removing many effects that overlap too heavily with Origins or would too easily erase defining Origin rules.

`City Growth contribution` is one stat and appears only once below; it is not duplicated as both a Population-family and City-family identifier.

| Family | Stat | Scope |
| --- | --- | --- |
| **Population** | Population Growth | global |
|  | Starting Population | starting fraction of Capacity |
| **Neutral expansion** | Neutral settlement progress/speed | global |
| **Land combat** | Offensive pressure | global |
|  | Defensive pressure | global |
|  | Counter-response effectiveness while responding | global |
|  | Terrain offensive pressure | Plains / Highlands / Mountain / Desert |
|  | Terrain defensive pressure | Plains / Highlands / Mountain / Desert |
| **FFY economy** | All FFY event yield | global |
|  | Military/conquest FFY | global |
|  | Naval/trade FFY | global |
|  | Industrial FFY | global |
| **Construction** | Structure build cost | all / City / Fort / Port / Factory / Silo / SAM |
|  | Structure upgrade cost | all / City / Fort / Port / Factory / Silo / SAM |
|  | Structure construction time | all / optionally individual structure |
| **City** | City Growth contribution | City |
| **Fort** | Fort coverage area | Fort |
|  | Fort defensive pressure | Fort |
| **Factory** | Factory FFY-event effectiveness | Factory |
| **Port** | Passive repair radius | Port |
|  | Passive repair rate | Port |
| **SAM** | Interception range | SAM |
|  | Recharge/cooldown time | SAM |
| **Missile Silo** | Recharge/cooldown time | Silo |
| **Warships** | FFY purchase cost | Warship |
|  | Movement speed | Warship |
|  | Attack range | Warship |
|  | Damage | Warship |
|  | Maximum health | Warship |
| **Strategic weapons** | Warhead projectile speed | all / Atom / Hydrogen / MIRV |
|  | FFY cost | Atom / Hydrogen / MIRV |
|  | Blast area | Atom / Hydrogen |

---

## Scope model

An Echo modifier is represented conceptually as:

```text
stat identity
+ optional scope
+ signed numeric value
```

Examples:

```text
Population Growth +X%
Starting Population +X percentage points / equivalent authored starting-fraction modifier
Offensive pressure on Highlands +X%
Fort build cost -X%
SAM recharge time +X%
Hydrogen Bomb blast area -X%
```

The exact value representation for each stat family will be settled together with its positive/negative interval. Cost/time stats require clear player-facing sign semantics so a beneficial reduction and harmful increase are never ambiguous.

---

## Echo / Origin boundary

The following are intentionally **not** part of the normal V1 Echo pool at this stage:

- Population Capacity / Max Population / Capacity per cell;
- Origin points, Origin trait slots, Echo slots;
- controller cadence, CPU, memory, query limits, or sandbox behavior;
- victory/defeat/capitulation rules;
- visibility/fog-of-war changes before that system is implemented and tested;
- automatic defender count above the canonical 0/1 rule;
- hard build/capability permissions such as `can build Warships`, `SAM may attack ships`, `Warships count as Silos`, weapon-family prohibitions, or launcher-tier requirements;
- split spawning, extra spawn origins, Initial Territory topology transformations, or other strategic-spawn rule changes;
- free structures/weapons, structure ownership caps, structure grants on landing, defender survival on capture, alternate Population-growth curves, Port-only Transport requirements, armored-Transport conversion, or equivalent structural Origin mechanics;
- direct creation of special FFY/Population event types that do not exist for ordinary factions;
- niche modifiers whose underlying mechanic exists only because one specific Origin enables it.

Echoes may partially improve or worsen a numeric stat that an Origin also modifies (for example Warship range), but the Origin rule remains the underlying faction identity and Echoes specialize the resulting profile through the published modifier-composition rules.

---

## Current generation questions — intentionally open

The next Echo-design pass must settle, in order:

1. **negative semantics** for every allowed stat — what a negative roll means, including inverse stats such as costs/cooldowns/construction time;
2. **positive and negative value intervals** for every stat/scope family;
3. **modifier-count rules** — when an Echo has one modifier versus two;
4. **sign-combination rules** — positive-only, negative-only, mixed positive/negative, and whether two modifiers may share a family/stat/scope;
5. **combination constraints/weights** so generated Echoes are interesting rather than redundant, contradictory, or trivial;
6. **power/rarity scoring** and conversion of the rolled modifier package into an Echo sampling weight;
7. **deterministic generation algorithm**, seed/version identity, duplicate-signature rejection, and catalogue-size/generation procedure;
8. dialogue/flavor/visual identity generation after the mechanical package is fixed.

No exact algorithm or roll interval should be treated as settled until those questions are explicitly resolved.
