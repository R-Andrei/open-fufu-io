# Open Fufu — Official AI documentation gateway

This directory is the mandatory **entry point for work on Official PvE AI**.

Do not open one detailed AI document, decide the others look unrelated, and edit in isolation. Official AI deliberately spans gameplay mechanics, Origin mechanics/support, named-Origin composition, character controller configuration, preset pools, and replay/versioned content. Changes can propagate in either direction.

## Start here

For any Official-AI task, read this file first, then read [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md). The architecture document is the **father / grand design document** for this subsystem: it owns the broad controller model, boundaries, pipeline, capability separation, and the map of subordinate concerns.

Then follow the task-specific owner trail below.

## Canonical reading map

| Concern | Canonical documentation | Exact code-readable owner |
| --- | --- | --- |
| Whole Official-AI architecture | [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md) | runtime implementation when it exists |
| Shared Signals / Goals / Doctrine / planners / persistence / Expression / profile contract | [`OFFICIAL_AI_CONFIGURATION.md`](./OFFICIAL_AI_CONFIGURATION.md) | shared runtime types/components when implementation begins |
| Preset roster, difficulty, rewards, allowed-Origin pools | [`OFFICIAL_AI_PRESETS.md`](./OFFICIAL_AI_PRESETS.md) | preset registry when implementation begins |
| Generic Origin literacy, composition, suppression, character adaptation | [`OFFICIAL_AI_ORIGIN_SUPPORT.md`](./OFFICIAL_AI_ORIGIN_SUPPORT.md) | [`../../design/official-ai/origin-trait-support.config.ts`](../../design/official-ai/origin-trait-support.config.ts) plus runtime support implementation |
| Exact Origin-trait AI mappings and reusable combination/suppression support | [`OFFICIAL_AI_TRAIT_SUPPORT.md`](./OFFICIAL_AI_TRAIT_SUPPORT.md) | [`../../design/official-ai/origin-trait-support.config.ts`](../../design/official-ai/origin-trait-support.config.ts) |
| Exact named Official-Origin AI compositions | [`OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md`](./OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md) | [`../../design/official-ai/origin-configurations.config.ts`](../../design/official-ai/origin-configurations.config.ts) |
| Baseline + character controller mappings, fidelity, quirks/signatures | [`OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md`](./OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md) | [`../../design/official-ai/character-configurations.config.ts`](../../design/official-ai/character-configurations.config.ts) |
| Actual Origin gameplay roster | [`../OFFICIAL_ORIGINS.md`](../OFFICIAL_ORIGINS.md) | gameplay Origin registry when implemented |
| Actual Origin trait mechanics/costs | [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md) | gameplay trait/rules implementation when implemented |
| General game/controller mechanics | [`../OPEN_FUFU_DESIGN.md`](../OPEN_FUFU_DESIGN.md) | authoritative simulation/rules implementation |
| Migration / implementation direction | [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md) | implementation plan |
| Controller persistent-memory contract | [`../CONTROLLER_MEMORY.md`](../CONTROLLER_MEMORY.md) | controller runtime/API implementation |

The design-time TypeScript configuration directory has its own code-facing index at [`../../design/official-ai/README.md`](../../design/official-ai/README.md). Documentation and configuration must point at each other rather than becoming independent islands.

## Mandatory task trails

### Changing a gameplay mechanic or numerical balance

Read/check, in order:

1. the mechanic's canonical gameplay owner;
2. `OFFICIAL_AI_ORIGIN_SUPPORT.md` and affected trait support;
3. every affected named Origin configuration;
4. every character whose Doctrine, Origin adaptation, signature logic, or allowed-Origin pool may value the mechanic differently;
5. fidelity/benchmark expectations if the strategic value changed.

A numerical change may require **no AI edit**, but the inspection is mandatory. “Reviewed; no change required” is a valid result. Skipping the review is not.

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
2. the exact candidate Origin definitions;
3. their complete trait-support/composition results;
4. whether every resulting character × Origin pairing is coherent and retains both mechanical literacy and character identity.

## Bidirectional synchronization invariant

The repository-wide rule is:

```text
mechanics / rules
      ↕
Origin traits + named Origins + AI Origin support
      ↕
character AI + preset pools + character adaptation
```

Any change originating at **any** layer must inspect both directions before completion. Do not repair a generic mechanics/Origin problem solely with a character exception; do not change mechanics or balance without checking whether existing AI valuation became stale; do not change character assumptions without checking that the underlying mechanic/Origin still means what the character code thinks it means.

This rule is also enforced in `AGENTS.md`.

## Documentation ownership rule

This directory is a subsystem, not a pile of independent essays.

- `README.md` is navigation/integration policy.
- `OFFICIAL_AI_ARCHITECTURE.md` is the broad father design.
- Each other document owns one narrower concern.
- Exact tables/mappings live in the listed TypeScript configs, not duplicated in prose.
- Gameplay mechanics stay outside this directory in their gameplay owners.
- Every new AI document must have a genuinely distinct ownership boundary and must be added to this map.
- If a concern already has an owner, update it instead of creating another file.

## Current V1 design status

```text
shared architecture/configuration contracts: complete
Origin trait AI support:                 72 / 72
Official Origin AI configuration:         49 / 49
Difficulty-0 Baseline:                     1 / 1
character profiles:                       20 / 20
character signature/quirk pass:          complete
```

Remaining work is primarily cross-profile / character × Origin validation, capability benchmarking, thematic/fidelity benchmarking, runtime implementation, and version/hash integration—not another round of parallel design documents.