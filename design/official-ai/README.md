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

- `origin-trait-support.config.ts` — exact `OriginTraitSupport` mappings and `OriginCombinationSupport` entries;
- `origin-configurations.config.ts` — future exact named-Official-Origin configurations/composed exceptions;
- `character-configurations.config.ts` — future Baseline and character `CharacterProfile` mappings.

The authoritative game mechanics remain in the canonical gameplay documents/rules. These configuration files must not duplicate mechanical arithmetic that belongs to `EffectiveRulesView` or other game-rule sources of truth.

During the current design pass, configuration is authored/reviewed in batches of ten. Markdown rationale may be updated alongside each accepted batch, but the `.config.ts` files are the source of truth for exact mapping values.
