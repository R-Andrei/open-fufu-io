# Open Fufu documentation map

Use this file to find the canonical owner of a concern. It is navigation only; it does not restate subsystem rules. Repository-wide ownership policy is defined in [`../AGENTS.md`](../AGENTS.md).

## Canonical target owners

| Concern | Canonical owner |
| --- | --- |
| High-level Open Fufu target design and cross-system invariants | [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) |
| OpenFront → Open Fufu migration and implementation sequencing | [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) |
| Combat/capture/counter-response tuning | [`COMBAT_TUNING.md`](./COMBAT_TUNING.md) |
| Terrain, persistent structures, Tanks, and structure-bound unit profiles | [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) |
| Naval units and strategic weapons | [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md) |
| FFY economy, Trains, Trade Ships, payouts, and economic source families | [`FFY_ECONOMY.md`](./FFY_ECONOMY.md) |
| Strategic Spawn | [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md) |
| Segments | [`SEGMENTS.md`](./SEGMENTS.md) |
| Controller persistent memory | [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md) |
| Controller public TypeScript surface | [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts) |
| Authentication, identity, sessions, and provisioning boundary | [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md) |
| Origin trait mechanics/cost catalogue | [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) |
| Official Origin roster/content | [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md) |
| Echo identities, acquisition, rewards, progression, naming, and Gacha | [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md) |
| Official PvE AI subsystem | [`official-ai/README.md`](./official-ai/README.md) |
| Minor Factions / Goons | [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md) |

## Known target-documentation gap

Open Fufu's external/browser/game service API and participant protocol do not yet have a canonical target contract. The inherited [`API.md`](./API.md) is not that owner. This gap is intentionally tracked for the next architecture batch rather than filled by scattered additions to unrelated documents.

## Inherited/current-state references

These describe inherited OpenFront behavior or historical implementation context. They are useful migration evidence but are not Open Fufu target authorities:

- [`API.md`](./API.md)
- [`Architecture.md`](./Architecture.md)
- [`Auth.md`](./Auth.md)
- [`GameServerRefactor.md`](./GameServerRefactor.md)
- [`Maps.md`](./Maps.md)

## Subsystem gateways

A subsystem that grows into several independently owned documents may use a directory `README.md` as an ownership/navigation gateway. A gateway must not duplicate mechanics from its child documents.

The current example is [`official-ai/README.md`](./official-ai/README.md).
