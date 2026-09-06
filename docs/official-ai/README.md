# Open Fufu — Official AI documentation gateway

This directory is the mandatory **entry point for work on Official PvE AI**. It is a navigation/integration gateway; it does not own gameplay mechanics, child-document contracts, exact configuration mappings, or project-completion state.

For any Official-AI task, read this file first, then [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md). Follow the task-specific owner trail below rather than editing AI documents in isolation.

## Canonical reading map

| Concern | Canonical documentation | Exact code-readable owner |
| --- | --- | --- |
| Whole Official-AI architecture | [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md) | runtime implementation when it exists |
| Shared Signals / Goals / Doctrine / planners / persistence / Expression / profile contract | [`OFFICIAL_AI_CONFIGURATION.md`](./OFFICIAL_AI_CONFIGURATION.md) | shared runtime types/components when implementation begins |
| Preset roster, difficulty targets, allowed-Origin pools | [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md) | preset registry when implementation begins |
| Generic Origin literacy, composition, suppression, character adaptation | [`OFFICIAL_AI_ORIGIN_SUPPORT.md`](./OFFICIAL_AI_ORIGIN_SUPPORT.md) | [`../../design/official-ai/origin-trait-support.config.ts`](../../design/official-ai/origin-trait-support.config.ts) plus runtime support implementation |
| Exact Origin-trait AI mappings and reusable combination/suppression support | [`OFFICIAL_AI_TRAIT_SUPPORT.md`](./OFFICIAL_AI_TRAIT_SUPPORT.md) | [`../../design/official-ai/origin-trait-support.config.ts`](../../design/official-ai/origin-trait-support.config.ts) |
| Exact named Official-Origin AI compositions | [`OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md`](./OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md) | [`../../design/official-ai/origin-configurations.config.ts`](../../design/official-ai/origin-configurations.config.ts) |
| Baseline + character controller mappings, fidelity, quirks/signatures | [`OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md`](./OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md) | [`../../design/official-ai/character-configurations.config.ts`](../../design/official-ai/character-configurations.config.ts) |
| Actual Official Origin roster | [`../OFFICIAL_ORIGINS.md`](../OFFICIAL_ORIGINS.md) | gameplay Origin registry when implemented |
| Actual Origin trait mechanics/costs | [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md) | gameplay trait/rules implementation when implemented |
| Echo reward accounting, including AI-difficulty bonus conversion | [`../ECHO_CATALOGUE.md`](../ECHO_CATALOGUE.md) | Echo reward implementation when it exists |
| High-level game/controller invariants | [`../OPEN_FUFU_DESIGN.md`](../OPEN_FUFU_DESIGN.md) | authoritative simulation/rules implementation |
| Migration / implementation direction | [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md) | migration plan |
| Controller persistent-memory contract | [`../CONTROLLER_MEMORY.md`](../CONTROLLER_MEMORY.md) | controller runtime/API implementation |

The design-time TypeScript configuration directory has its own code-facing index at [`../../design/official-ai/README.md`](../../design/official-ai/README.md). Documentation and configuration must point at each other rather than becoming independent islands.

## Mandatory task trails

### Changing a gameplay mechanic or numerical balance

Read/check, in order:

1. the mechanic's canonical gameplay owner;
2. `OFFICIAL_AI_ORIGIN_SUPPORT.md` and affected trait support;
3. every affected named Origin configuration;
4. every character whose Doctrine, Origin adaptation, signature logic, or allowed-Origin pool may value the mechanic differently;
5. fidelity/benchmark expectations if strategic value changed.

A numerical change may require **no AI edit**, but inspection is mandatory. “Reviewed; no change required” is valid; skipping the review is not.

### Changing an Origin trait

Read/check:

1. `../ORIGIN_TRAIT_CATALOGUE.md`;
2. `OFFICIAL_AI_TRAIT_SUPPORT.md` + `design/official-ai/origin-trait-support.config.ts`;
3. all named Origins containing the trait;
4. all characters allowed to roll those Origins or otherwise adapting to that support.

### Changing a named Official Origin

Read/check:

1. `../OFFICIAL_ORIGINS.md`;
2. all selected trait mechanics/support;
3. `OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md` + exact Origin config;
4. every character preset whose allowed-Origin pool contains it.

### Changing a character controller or signature

Read/check:

1. `OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md` + exact character config;
2. `OFFICIAL_AI_PRESETS.md` for difficulty and allowed-Origin pool;
3. every allowed Origin and its composed support;
4. underlying mechanics needed by character-specific hooks;
5. whether the proposed character rule is really generic planner/support behavior and belongs lower in the stack.

### Changing an allowed-Origin pool

Read/check:

1. the character's controller identity and Origin-adaptation behavior;
2. candidate Origin definitions;
3. complete trait-support/composition results;
4. whether every resulting character × Origin pairing remains coherent and retains both mechanical literacy and character identity.

### Changing AI difficulty

Read/check:

1. `OFFICIAL_AI_PRESETS.md` for the competence target;
2. character implementation/benchmark evidence;
3. [`../ECHO_CATALOGUE.md`](../ECHO_CATALOGUE.md) because reward accounting consumes the bound difficulty as an input.

Do **not** restate the Echo reward formula in AI documentation.

## Bidirectional synchronization invariant

```text
mechanics / rules
      ↕
Origin traits + named Origins + AI Origin support
      ↕
character AI + preset pools + character adaptation
```

Any strategically meaningful change originating at any layer must inspect both directions before completion. Do not repair a generic mechanics/Origin problem solely with a character exception; do not change mechanics/balance without checking AI valuation; do not change character assumptions without checking the underlying mechanic/Origin.

This repository-wide rule is also enforced in `AGENTS.md`.

## Documentation ownership rule

- `README.md` is navigation/integration policy only.
- `OFFICIAL_AI_ARCHITECTURE.md` owns broad Official-AI architecture.
- Each other document owns one narrower concern.
- Exact tables/mappings live in the listed TypeScript configs where identified, not duplicated in prose.
- Gameplay mechanics stay in their gameplay owners.
- Echo reward arithmetic stays in `ECHO_CATALOGUE.md`; AI docs expose difficulty as an input only.
- New AI documents require a genuinely distinct ownership boundary and must be added to this map and the repository-level owner map.
