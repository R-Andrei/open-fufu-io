# Official AI design-time configuration

This directory owns the **code-readable concrete Official-AI configuration authored during the design phase**.

It is intentionally outside runtime `src/` until Official-AI implementation begins. Files here should remain valid TypeScript and migrate cleanly into runtime configuration/registries later, but their presence does **not** authorize or imply gameplay implementation.

## Mandatory documentation entry point

Before changing any file in this directory, start at:

```text
docs/official-ai/README.md
```

Then read the configuration file's specific documentation owner below. Official-AI configuration must not be edited as an isolated data catalogue; the repository-wide mechanics ↔ Origins ↔ character-AI synchronization audit in `AGENTS.md` still applies.

## Canonical ownership and documentation map

Keep one canonical configuration file per concern:

```text
origin-trait-support.config.ts
  exact ownership:
    all OriginTraitSupport mappings
    all additive OriginCombinationSupport mappings
    all OriginSupportSuppression rules
  documentation:
    docs/official-ai/OFFICIAL_AI_ORIGIN_SUPPORT.md
    docs/official-ai/OFFICIAL_AI_TRAIT_SUPPORT.md
  gameplay inputs:
    docs/ORIGIN_TRAIT_CATALOGUE.md

origin-configurations.config.ts
  exact ownership:
    all named Official-Origin AI configurations
    profile assertions / required reusable support
    rare named-Origin support when genuinely necessary
  documentation:
    docs/official-ai/OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md
    docs/official-ai/OFFICIAL_AI_ORIGIN_SUPPORT.md
  gameplay input:
    docs/OFFICIAL_ORIGINS.md

character-configurations.config.ts
  exact ownership:
    Difficulty-0 Baseline
    all 20 character CharacterProfile mappings
    character-specific fidelity/signature hook identities
  documentation:
    docs/official-ai/OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md
    docs/official-ai/OFFICIAL_AI_CONFIGURATION.md
    docs/official-ai/OFFICIAL_AI_PRESETS.md
```

The broad subsystem/father design is:

```text
docs/official-ai/OFFICIAL_AI_ARCHITECTURE.md
```

The directory gateway at `docs/official-ai/README.md` is the canonical navigation map between all of these owners.

Do **not** create batch/range shards such as `*.p41-p50.config.ts` merely to make incremental authoring easier. Batches are a review process; accepted entries are appended to the canonical file. Internal constants/grouping inside one file are fine for readability.

A separate configuration file requires a real runtime/loading, generation, ownership, or lifecycle boundary. File length alone is not a reason to split the catalogue.

## Documentation/configuration boundary

```text
docs/official-ai/
  subsystem gateway, architecture, contracts, rationale, strategic philosophy,
  preset registry, and boundaries

design/official-ai/*.config.ts
  exact concrete AI mappings and registered support-hook identities
```

Gameplay mechanics remain authoritative in the canonical gameplay/rules documents. These configuration files must not duplicate mechanical arithmetic that belongs to `EffectiveRulesView` or other game-rule sources of truth.

## Origin composition order

```text
selected trait support
  → apply support-suppression rules
  → derive active direct support / synergy tags
  → apply matching additive combination support
  → apply rare named-Origin support
  → OriginStrategicProfile
```

Support suppression changes only AI semantic metadata made impossible or exactly neutralized by the selected effective trait combination. It never changes gameplay mechanics or trait legality.

## Cross-layer completion rule

Any edit here is incomplete until the task records the three-layer impact audit:

```text
- Mechanics: updated / reviewed-no-change
- Origins/traits: updated / reviewed-no-change
- Character AI: updated / reviewed-no-change
- Character × Origin validation: updated / rerun / not required
```

This applies in both directions. A character hook may reveal missing generic Origin support; an Origin-support edit may expose a gameplay-mechanics problem; a numerical mechanic rebalance may change character valuation even when the config schema does not change.

## Review batching

Traits, Origins, and characters may still be authored/reviewed in batches of ten. That batching must not create permanent repository fragments. The checked-in tree should always converge back to the canonical files above.
