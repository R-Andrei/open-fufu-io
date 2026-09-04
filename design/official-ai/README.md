# Official AI design-time configuration

This directory owns **code-readable concrete Official-AI configuration authored during the design phase**.

It is intentionally outside runtime `src/` until Official-AI implementation begins. Files here should be valid TypeScript and should migrate cleanly into runtime configuration/registries later, but their presence does **not** authorize or imply implementation.

Ownership split:

```text
docs/OFFICIAL_AI_*.md
  architecture, contracts, rationale, strategic philosophy, boundaries

design/official-ai/*.config.ts
  exact concrete mappings and definitions
```

Concrete sources:

- `origin-trait-support*.config.ts` — exact `OriginTraitSupport` mappings and future `OriginCombinationSupport` entries; the catalogue may be sharded by stable trait-ID range during design to avoid rewriting one ever-growing file;
- `origin-configurations*.config.ts` — future exact named-Official-Origin configurations/composed exceptions;
- `character-configurations*.config.ts` — future Baseline and character `CharacterProfile` mappings.

All shards together form one canonical design-time configuration catalogue. Trait IDs must appear exactly once across the shard set, shard order has no semantic meaning, and the implementation phase may consolidate/re-export the shards behind runtime registries without changing their authored semantics.

The authoritative game mechanics remain in the canonical gameplay documents/rules. These configuration files must not duplicate mechanical arithmetic that belongs to `EffectiveRulesView` or other game-rule sources of truth.

During the current design pass, configuration is authored/reviewed in batches of ten. Markdown rationale may be updated alongside each accepted batch, but the `.config.ts` files are the source of truth for exact mapping values.
