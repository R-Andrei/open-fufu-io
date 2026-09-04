# Official AI design-time configuration

This directory owns the **code-readable concrete Official-AI configuration authored during the design phase**.

It is intentionally outside runtime `src/` until Official-AI implementation begins. Files here should remain valid TypeScript and migrate cleanly into runtime configuration/registries later, but their presence does **not** authorize or imply gameplay implementation.

## Canonical ownership

Keep one canonical configuration file per concern:

```text
origin-trait-support.config.ts
  all OriginTraitSupport mappings
  all additive OriginCombinationSupport mappings
  all OriginSupportSuppression rules

origin-configurations.config.ts
  all named Official-Origin AI configurations
  profile assertions / required reusable support
  rare named-Origin support when genuinely necessary

character-configurations.config.ts
  future Difficulty-0 Baseline and all character CharacterProfile mappings
```

Do **not** create batch/range shards such as `*.p41-p50.config.ts` merely to make incremental authoring easier. Batches are a review process; accepted entries are appended to the canonical file. Internal constants/grouping inside one file are fine for readability.

A separate configuration file requires a real runtime/loading, generation, ownership, or lifecycle boundary. File length alone is not a reason to split the catalogue.

## Documentation/configuration boundary

```text
docs/OFFICIAL_AI_*.md
  architecture, contracts, rationale, strategic philosophy, boundaries

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

## Review batching

Traits, Origins, and characters may still be authored/reviewed in batches of ten. That batching must not create permanent repository fragments. The checked-in tree should always converge back to the canonical files above.
