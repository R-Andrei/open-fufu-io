# Open Fufu documentation map

Use this file to find the canonical owner of a concern. It is navigation only; it does not restate subsystem rules. Repository-wide ownership policy is defined in [`../AGENTS.md`](../AGENTS.md).

## Canonical target owners

| Concern | Canonical owner |
| --- | --- |
| High-level Open Fufu target design and cross-system invariants | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) |
| OpenFront → Open Fufu migration, runtime topology, persistence, version binding, source traceability, deployment, and implementation sequencing | [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) |
| HTTP/control-plane service API | [`service/SERVICE_API.md`](./service/SERVICE_API.md) |
| Live participant/spectator stream protocol | [`service/PARTICIPANT_PROTOCOL.md`](./service/PARTICIPANT_PROTOCOL.md) |
| Combat/capture/counter-response tuning | [`COMBAT_TUNING.md`](./COMBAT_TUNING.md) |
| Terrain, persistent structures, and baseline Tank | [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) |
| Warships, Transports, and strategic weapons | [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md) |
| FFY economy, Factory Trains, Trade Ships, and piracy | [`FFY_ECONOMY.md`](./FFY_ECONOMY.md) |
| Strategic Spawn | [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) |
| Segments | [`SEGMENTS.md`](./SEGMENTS.md) |
| Controller persistent memory | [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md) |
| Controller public TypeScript surface | [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts) |
| Authentication, identity, sessions, and provisioning | [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md) |
| Origin trait mechanics/cost catalogue | [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) |
| Origin trait validation coverage, dependency traces, integration seams, and certification blockers | [`origin-validation/README.md`](./origin-validation/README.md) |
| Official Origin roster/content | [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md) |
| Echo identities, acquisition, rewards, progression, naming, and Gacha | [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md) |
| Approved external fiction/media reference-source IPs/franchises | [`REFERENCE_SOURCES.md`](./REFERENCE_SOURCES.md) |
| Official PvE AI subsystem | [`official-ai/README.md`](./official-ai/README.md) |
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