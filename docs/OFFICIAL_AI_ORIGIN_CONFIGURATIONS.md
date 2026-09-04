# Open Fufu — Official AI Origin Configuration Rationale

## Status and authority

This document is the canonical **design/rationale companion** for named Official-Origin AI configuration.

Concrete code-readable mappings live under:

- `design/official-ai/origin-configurations*.config.ts`

Those `.config.ts` files are authoritative for exact AI-facing Origin configuration. `OFFICIAL_ORIGINS.md` remains authoritative for the actual Origin roster, trait membership, names, and gameplay content. `OFFICIAL_AI_ORIGIN_SUPPORT.md` remains authoritative for composition semantics.

A named Origin configuration does **not** duplicate its whole derived `OriginStrategicProfile`. Instead it records:

- the canonical trait IDs expected from `OFFICIAL_ORIGINS.md`;
- required reusable combination-support IDs;
- any genuinely Origin-specific support, normally `null`;
- partial golden profile assertions used to catch composition regressions;
- validation focuses for accelerated AI tests.

The complete strategic profile is derived from trait support, suppression, combination support, and final effective rules.

---

## Progress

```text
Configured Official Origins: 10 / 49
Current canonical roster range: O08–O17 (first 10 in library/UI order)
Remaining Official Origins: 39
```

O35 is retired; the canonical roster contains 49 active Official Origins.

---

## First 10 Official Origins

### O08 — Business as Usual

Near-vanilla generalist support. Faster Trade Ships and improved Forts compose normally; no special combination or named-Origin hook is required.

**AI identity:** reliable trade throughput plus broadly useful defensive infrastructure without forcing a specialist strategy.

### O09 — Head Start

Larger Initial Territory and faster trade are paired with weaker City growth. The AI should exploit the stronger opening without pretending the long-term demographic penalty does not exist.

**AI identity:** convert an early geographic/trade lead into position before weaker City growth matters.

### O10 — Home Field Advantage

Fort improvements, Mountain defense, Highland offense, and Plains-offense weakness produce a terrain-sensitive prepared-position Origin. Normal terrain/Fort reasoning is sufficient; no explicit combination hook is necessary.

**AI identity:** choose where to fight carefully and make prepared/high-ground geography do more of the work.

### O11 — Light Music Club

Fast Trade Ships, full wartime trade value, and extra Train throughput create a resilient mixed commerce/rail economy, offset by weaker City growth. The combination remains ordinary additive composition.

**AI identity:** maintain high economic throughput even while conflict disrupts less specialized economies.

### O12 — One Punch

P23 and P22 activate `ELITE_SINGLE_FLAGSHIP_PROGRESSION`. The one-Warship cap and extended rank ceiling create a genuinely combined strategy centered on one increasingly valuable veteran flagship.

**AI identity:** preserve, position, and grow one elite naval asset rather than distribute power across a fleet.

### O13 — Bomb Girl

A single transformative trait defines the whole Origin: only Hydrogen Bombs remain available, with larger blast area and higher cost. No named-Origin support is required.

**AI identity:** accept strategic-weapon specialization and commit only when an oversized Hydrogen strike justifies the price.

### O14 — Bocchi Time

P39 alone structurally replaces ordinary Strategic Spawn with two half-area regions and two origins. Its trait support already contains the required pair-generation/evaluation behavior.

**AI identity:** use two starting footholds coherently while respecting split-front and isolated-core risk.

### O15 — Kessoku Band

P50 and P51 activate `DUAL_GENERAL_SUPPORT_NETWORK`. Forts support offense while Command Posts support defense, making both structures complementary general-support anchors.

**AI identity:** build a positional infrastructure network where defensive and offensive support roles overlap rather than remain siloed.

### O16 — The Art of Surviving

P38 alone defines the Origin. Automatic defenders survive loss of defended cells, enabling Population-preserving territorial trades and elastic defense when the character/controller is capable and willing to exploit them.

**AI identity:** value survival of fighting Population separately from ownership of every individual cell.

### O17 — Section 9

P49 and P45 activate `LAYERED_COUNTERINTELLIGENCE`, while N02 weakens straightforward Plains offense. Observation Posts become blackout infrastructure and Forest interiors provide a second concealment layer.

**AI identity:** shape operations around information denial and concealed staging rather than assuming conventional observation/control geometry.

---

## Batch consistency result

All ten Origins compose successfully from the completed trait-support catalogue.

- **3/10** require reusable combination support: O12, O15, O17.
- **0/10** require a named-Origin-specific support hook.
- **0/10** trigger a support-suppression rule.
- all ten have explicit profile assertions and validation focuses in the code-readable config.

This is the desired architecture: named-Origin exceptions remain rare because reusable trait/combination support carries most of the strategic literacy.
