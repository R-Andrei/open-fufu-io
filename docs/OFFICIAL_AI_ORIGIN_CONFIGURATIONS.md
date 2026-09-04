# Open Fufu — Official AI Origin Configuration Rationale

## Status and authority

This document is the single canonical **rationale/strategic-intent companion** for named Official-Origin AI configuration.

Exact code-readable mappings live only in:

- `design/official-ai/origin-configurations.config.ts`

That configuration file is authoritative for exact AI-facing Origin mappings, required reusable combination-support IDs, profile assertions, validation focuses, and any rare named-Origin-specific support.

Other authorities remain separate because they own different concerns:

- `OFFICIAL_ORIGINS.md` — actual Official Origin roster, names, trait membership, and gameplay content;
- `ORIGIN_TRAIT_CATALOGUE.md` — actual trait mechanics/costs;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` — generic support composition/suppression/adaptation semantics;
- `OFFICIAL_AI_TRAIT_SUPPORT.md` — trait-level AI strategic rationale.

A named-Origin configuration does **not** duplicate the entire derived `OriginStrategicProfile`. The complete profile is derived from the Origin's canonical trait membership, trait support, support suppression, additive combination support, final effective rules, and only then any genuinely necessary named-Origin support.

## Progress

```text
Configured Official Origins: 10 / 49
Current canonical roster range: O08–O17 (first 10 in library/UI order)
Remaining Official Origins: 39
```

O35 is retired; the canonical roster currently contains 49 active Official Origins.

---

# Configured Official Origins

## O08 — Business as Usual

Faster Trade Ships and improved Forts compose normally. No special combination or named-Origin support is necessary.

**AI identity:** reliable trade throughput plus broadly useful defensive infrastructure without forcing a specialist strategy.

## O09 — Head Start

Larger Initial Territory and faster trade are paired with weaker City growth. The controller should exploit the stronger opening without forgetting the weaker long-term demographic contribution.

**AI identity:** convert an early geographic/trade lead into position before weaker City growth matters.

## O10 — Home Field Advantage

Improved Forts, Mountain defense, Highland offense, and weaker Plains offense create a terrain-sensitive prepared-position Origin. Normal terrain/Fort reasoning already composes the pieces correctly.

**AI identity:** choose where to fight carefully and make prepared/high-ground geography do more of the work.

## O11 — Light Music Club

Fast Trade Ships, full wartime trade value, and increased Train throughput create a resilient mixed commerce/rail economy, offset by weaker City growth.

**AI identity:** maintain high economic throughput even while conflict disrupts less specialized economies.

## O12 — One Punch

The one-Warship cap and extended Warship rank ceiling create a genuine combined strategy: a single increasingly valuable veteran flagship. This uses reusable trait-combination support rather than named-Origin code.

**AI identity:** preserve, position, and grow one elite naval asset rather than distribute power across a fleet.

## O13 — Bomb Girl

The Origin is defined by Hydrogen-only strategic-weapon specialization with larger blast area and higher cost. The single trait's support already describes the strategic problem.

**AI identity:** commit only when an oversized Hydrogen strike justifies its price.

## O14 — Bocchi Time

The split-start trait replaces ordinary Strategic Spawn with two half-area regions and two origins. Trait support already owns pair generation/evaluation, so no named-Origin support is necessary.

**AI identity:** use two starting footholds coherently while respecting split-front and isolated-core risk.

## O15 — Kessoku Band

Forts also support offense while Command Posts also support defense. Their reusable combination support treats them as complementary general-support infrastructure.

**AI identity:** build a positional support network in which offensive and defensive infrastructure roles overlap.

## O16 — The Art of Surviving

Automatic defenders survive loss of defended cells. The Origin's trait support already exposes Population-preserving territorial trade and elastic-defense possibilities.

**AI identity:** value survival of fighting Population separately from ownership of every individual cell.

## O17 — Section 9

Observation Posts become blackout infrastructure while owned Forest interiors provide another concealment layer; Plains offense is weaker. Reusable combination support handles the layered counterintelligence geometry.

**AI identity:** shape operations around information denial and concealed staging rather than conventional observation/control geometry.

---

## First-batch consistency result

All ten configured Origins compose successfully from the completed trait-support catalogue.

- 3/10 need reusable **trait-combination** support: O12, O15, O17;
- 0/10 need named-Origin-specific support;
- 0/10 trigger a support-suppression rule;
- all ten have code-readable profile assertions and validation focuses in the canonical Origin config.

This is the intended architecture: named-Origin exceptions stay rare because reusable trait and combination support carry most mechanical literacy.
