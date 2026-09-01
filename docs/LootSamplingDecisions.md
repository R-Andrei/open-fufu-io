# Open Fufu — Loot Sampling Decisions

## Status and precedence

This document records accepted loot-generation and reward-sampling decisions from the ongoing pre-implementation game-design discussion.

It supplements the broader Open Fufu design/mechanics documents. Where this document makes a concrete decision that an older document still describes as tentative, candidate, or unresolved, this document takes precedence.

This is a game-design document, not an implementation plan.

---

## 1. Large deterministic versioned item catalogue

Open Fufu does not require a literally infinite item universe.

The accepted target is a very large deterministic catalogue that feels practically inexhaustible in normal play.

Items are generated deterministically from stable identity/seed plus generator version. New generator versions may expand the catalogue later without mutating existing items.

A catalogue version may contain tens or hundreds of thousands of items if useful; the exact count is implementation/balance data rather than a product requirement.

---

## 2. Mechanical uniqueness

Different item identities/seeds must not intentionally produce the same complete mechanical signature.

During deterministic catalogue generation, each item's canonical mechanical signature is checked for collisions. If a candidate seed would create an already-existing mechanical signature, that candidate is rejected/skipped rather than creating a second mechanically identical item.

The exact collision-detection/generation procedure is an implementation detail.

---

## 3. Constrained deterministic numeric representation

Item modifiers remain bounded by approved effect-family limits and hard balance caps.

Fine-grained percentage values are allowed, but deterministic/fixed-point or otherwise exact quantized representations are preferred over unconstrained floating-point identity semantics so an item's mechanical signature is reproducible and comparable exactly.

The exact quantization step per effect family remains balance data.

---

## 4. Item presentation identity

Each deterministic item includes both mechanical and collectible presentation identity, including approximately:

- stable item identity/seed;
- generator version;
- mechanical modifier(s);
- deterministic name;
- deterministic dialogue/flavor line or description;
- deterministic lightweight visual identity such as SVG or an equivalent representation;
- rarity/drop weight metadata.

The exact content-generation/art pipeline is a later implementation/content question.

---

## 5. Explicit item weights and rarity

Each item has an explicit positive sampling weight in the normal PvE reward table.

Conceptually:

```text
P(item) = itemWeight / sum(all eligible normal-table item weights)
```

Lower weight means rarer.

Rarity is therefore a real numeric property of the normal item distribution rather than a conventional Common/Rare/Epic/Legendary tier.

Player-facing UI may eventually present exact/approximate probability or a human-readable equivalent such as `1 in N`.

---

## 6. Power and rarity relationship

Mechanical power should influence rarity, but rarity does not need to be a one-dimensional deterministic function of raw power.

An item's weight may derive from factors such as:

- effect-family base weighting;
- modifier magnitude;
- number of modifiers;
- positive/negative modifier combinations;
- drawbacks;
- deterministic rarity/flavor factors;
- future item-generation metadata.

Stronger items should generally trend rarer while still allowing two similarly powerful items to have different collectible rarity/identity.

---

## 7. Rarest-of-N PvE reward sampling

For an approved won PvE match:

```text
base victory rolls
+ all applicable approved AI-preset +X roll modifiers present in the match
= total normal rolls
```

The game independently samples the normal item distribution that many times and awards the rarest sampled result.

`Rarest` is determined by the item's inherent normal-table rarity/drop probability/weight, not by an additional hidden quality score.

There are no special high-quality rolls.

An approved AI preset contributes its roll modifier by being present in the won match; personal elimination credit is not required.

---

## 8. Normal rewards may roll duplicates

Normal PvE reward sampling does not filter out currently owned items.

If the awarded rarest result is already owned, it is a duplicate and is automatically converted into the separate gambling-store currency according to the accepted duplicate-conversion rules.

Players do not keep multiple inventory copies and may not manually sell owned items.

---

## 9. Gambling-store sampling

The gambling store uses the same underlying item rarity/weight philosophy but excludes every item the player currently owns from its eligible result set.

Eligible weights are renormalized for that store roll.

An item's inherent displayed rarity remains based on the normal/base item distribution rather than changing dynamically because the player's store eligibility set is smaller.

---

## 10. Separate persistent gambling currency

The duplicate/gambling-store currency is separate from in-match FFY.

FFY remains the match economic currency. Duplicate conversion must not overload FFY with a second persistent-account meaning.

The exact name of the persistent gambling currency remains open.

The accepted economic direction is intentionally generous bad-luck protection:

- every automatically converted duplicate should be worth at least one immediate store gamble;
- ordinary duplicate values should remain small and human-readable;
- rarer duplicates may fund more than one gamble;
- players cannot liquidate non-duplicate owned items to farm store rolls.

Exact small-number values remain balance data.

---

## 11. Team PvE reward split

Team PvE may award progression loot.

The accepted direction is to reduce each human player's roll count relative to the solo-equivalent lobby reward rather than disabling progression.

Conceptually:

```text
solo-equivalent lobby roll count / number of human teammates
= approximate rolls per player
```

Each participating human then performs their own independent reduced rarest-of-N reward process and receives their own item/duplicate conversion result.

Rounding/minimum-roll rules and exact caps remain balance data.

---

## 12. Remaining loot questions are balance/implementation details

The fundamental sampling model is accepted.

Remaining details include:

- exact catalogue size per generator version;
- exact per-family modifier quantization;
- exact weight-generation function;
- exact duplicate-currency values and gamble cost;
- exact team-PvE rounding/cap rules;
- player-facing rarity display format.

These no longer block the conceptual game-design contract.
