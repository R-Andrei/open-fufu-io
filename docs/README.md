# Open Fufu documentation map

Use this file to find the canonical owner of a concern. It is navigation only; it does not restate subsystem rules. Automated-agent bootstrap/routing is defined in [`../AGENTS.md`](../AGENTS.md); detailed repository-process policies are registered below.

## Canonical target owners

| Concern | Canonical owner |
| --- | --- |
| Automated-agent bootstrap, universal communication/assumption/RED-first invariants, and mandatory protocol routing | [`../AGENTS.md`](../AGENTS.md) |
| Repository claim/session ownership, issue/branch/PR mutation authority, current-main branch reconciliation, and remote cleanup | [`REPOSITORY_OWNERSHIP_PROTOCOL.md`](./REPOSITORY_OWNERSHIP_PROTOCOL.md) |
| Documentation/configuration canonical-authority governance, duplicate/stale authority prevention, splitting, gateways, and canonical-overlap reconciliation | [`DOCUMENTATION_AUTHORITY_POLICY.md`](./DOCUMENTATION_AUTHORITY_POLICY.md) |
| Repository validation scope, test ownership, and executable-code adoption | [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md) |
| Issue-work specification/readiness gates, implementation-GREEN lifecycle, adversarial certification, and requirement-level completion evidence | [`ISSUE_WORK_PROTOCOL.md`](./ISSUE_WORK_PROTOCOL.md) |
| Game/Origin/Character-AI coupled-change audit and task-routing procedure | [`official-ai/README.md`](./official-ai/README.md) |
| High-level Open Fufu target design and cross-system invariants | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) |
| Game-wide effective-rule composition, rule-axis taxonomy, modifier algebra, normalization, and static composition validation | [`RULE_COMPOSITION.md`](./RULE_COMPOSITION.md) |
| OpenFront → Open Fufu migration, runtime topology, persistence, version binding, source traceability, deployment, and implementation sequencing | [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) |
| Deterministic simulation-domain event boundary, envelope, causal-event semantics, and in-tick delivery invariants | [`SIMULATION_EVENTS.md`](./SIMULATION_EVENTS.md) |
| Exact production map-artifact package/manifest schemas, canonical serialization/content identity, terrain-code encoding, and artifact validation | [`../src/simulation/MapArtifact.ts`](../src/simulation/MapArtifact.ts) |
| HTTP/control-plane service API | [`service/SERVICE_API.md`](./service/SERVICE_API.md) |
| Live participant/spectator stream protocol | [`service/PARTICIPANT_PROTOCOL.md`](./service/PARTICIPANT_PROTOCOL.md) |
| Combat/capture/counter-response tuning | [`COMBAT_TUNING.md`](./COMBAT_TUNING.md) |
| Terrain, physical rail topology, persistent structures, and baseline Tank | [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) |
| Warships, Transports, and strategic weapons | [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md) |
| FFY economy, Factory Trains, Trade Ships, and piracy | [`FFY_ECONOMY.md`](./FFY_ECONOMY.md) |
| Strategic Spawn | [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) |
| Segment concept, generation priorities/invariants, membership semantics, stable IDs, and validation contract | [`SEGMENTS.md`](./SEGMENTS.md) |
| Exact executable Segment generator profiles, compiled Segment binary payloads, and runtime Segment indexing | [`../src/simulation/Segments.ts`](../src/simulation/Segments.ts) |
| Controller persistent memory | [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md) |
| Controller public TypeScript surface | [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts) |
| Authentication, identity, sessions, and provisioning | [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md) |
| Origin trait mechanics/cost catalogue | [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) |
| Origin trait validation coverage, validation domains, dependency traces, integration seams, and explicit interaction obligations | [`ORIGIN_VALIDATION_COVERAGE.md`](./ORIGIN_VALIDATION_COVERAGE.md) |
| Official Origin roster/content | [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md) |
| Echo identities, acquisition, rewards, progression, naming, and Gacha | [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md) |
| Official-AI architecture | [`official-ai/OFFICIAL_AI_ARCHITECTURE.md`](./official-ai/OFFICIAL_AI_ARCHITECTURE.md) |
| Shared Official-AI configuration/profile contract | [`official-ai/OFFICIAL_AI_CONFIGURATION.md`](./official-ai/OFFICIAL_AI_CONFIGURATION.md) |
| Official-AI preset roster, difficulty targets, allowed-Origin pools, and Origin selection/reveal rules | [`official-ai/OFFICIAL_AI_PRESETS.md`](./official-ai/OFFICIAL_AI_PRESETS.md) |
| Generic Official-AI Origin support, composition, suppression, and character adaptation contract | [`official-ai/OFFICIAL_AI_ORIGIN_SUPPORT.md`](./official-ai/OFFICIAL_AI_ORIGIN_SUPPORT.md) |
| Official-AI Origin-trait strategic rationale | [`official-ai/OFFICIAL_AI_TRAIT_SUPPORT.md`](./official-ai/OFFICIAL_AI_TRAIT_SUPPORT.md) |
| Official-AI named-Origin strategic rationale | [`official-ai/OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md`](./official-ai/OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md) |
| Official-AI Baseline/character behavioral rationale and signature semantics | [`official-ai/OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md`](./official-ai/OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md) |
| Exact Official-AI trait-support, combination-support, and suppression mappings | [`../design/official-ai/origin-trait-support.config.ts`](../design/official-ai/origin-trait-support.config.ts) |
| Exact named Official-Origin mappings, assertions, and named support | [`../design/official-ai/origin-configurations.config.ts`](../design/official-ai/origin-configurations.config.ts) |
| Exact Difficulty-0 Baseline and Official character `CharacterProfile` mappings | [`../design/official-ai/character-configurations.config.ts`](../design/official-ai/character-configurations.config.ts) |
| Minor Factions / Goons | [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md) |

## Inherited/current-state references

These describe inherited OpenFront behavior or historical implementation context. They are useful migration evidence but are not Open Fufu target authorities:

- [`API.md`](./API.md)
- [`Architecture.md`](./Architecture.md)
- [`Auth.md`](./Auth.md)
- [`GameServerRefactor.md`](./GameServerRefactor.md)
- [`Maps.md`](./Maps.md)

## Subsystem gateways

A subsystem that grows into several independently owned documents may use a directory `README.md` as an ownership/navigation gateway. A gateway must not duplicate mechanics from its child documents.

Current gateways:

- [`official-ai/README.md`](./official-ai/README.md)
- [`origin-validation/README.md`](./origin-validation/README.md)
- [`service/README.md`](./service/README.md)