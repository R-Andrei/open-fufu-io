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

- `origin-trait-support*.config.ts` — exact `OriginTraitSupport` mappings, sharded by stable trait-ID range;
- `origin-combination-support.config.ts` — exact reusable additive `OriginCombinationSupport` entries plus support-suppression rules discovered by the global trait sweep;
- `origin-configurations*.config.ts` — exact named-Official-Origin AI configurations, profile assertions, required combination support, and rare Origin-specific support;
- `character-configurations*.config.ts` — future Baseline and character `CharacterProfile` mappings.

All shards together form one canonical design-time configuration catalogue. Trait IDs and Origin IDs must appear exactly once in their respective configuration shard sets. Shard order has no semantic meaning, and the implementation phase may consolidate/re-export the shards behind runtime registries without changing their authored semantics.

The authoritative game mechanics remain in the canonical gameplay documents/rules. These configuration files must not duplicate mechanical arithmetic that belongs to `EffectiveRulesView` or other game-rule sources of truth.

Origin composition order is:

```text
selected trait support
  → apply support-suppression rules
  → derive active direct support / synergy tags
  → apply matching additive combination support
  → apply rare named-Origin support
  → OriginStrategicProfile
```

Support suppression changes only AI semantic metadata made impossible or exactly neutralized by the selected effective trait combination. It never changes gameplay mechanics.

During the current design pass, configuration is authored/reviewed in batches of ten. Markdown rationale may be updated alongside each accepted batch, but the `.config.ts` files are the source of truth for exact mapping values.
