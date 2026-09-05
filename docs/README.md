# Open Fufu documentation map

This directory contains canonical design, implementation, API, subsystem, and catalogue documentation. Do not treat every file here as an unrelated standalone document: follow subsystem gateways and ownership links before editing a system.

## Major entry points

- [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) — canonical target game-design contract.
- [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) — canonical migration/implementation direction from inherited OpenFront.
- [`official-ai/README.md`](./official-ai/README.md) — **Official PvE AI subsystem gateway**. Start here for Official-AI architecture, configuration, Origin support, preset pools, character profiles, or design-time AI config work.
- [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md) — canonical Official-Origin roster/content.
- [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) — canonical Origin-trait mechanics/cost catalogue.
- [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md) — Echo mechanics/content catalogue.

Other focused documents such as controller memory, strategic spawn, terrain/structures, naval/strategic weapons, economy, segments, identity/auth, API, and persistence-related design own their named concerns and should link back to broader owners where relevant.

## Subsystem-folder rule

When a subsystem accumulates several dedicated documents, prefer a directory with a `README.md` gateway instead of adding an indefinitely growing family of similarly named files to this root. The gateway should:

1. identify the broad/father design document;
2. map narrower concerns to one canonical owner each;
3. link to exact code/configuration owners;
4. identify relevant neighboring gameplay/system authorities outside the folder;
5. provide task-specific reading trails when cross-document synchronization is important.

The gateway is navigation, not a duplicate rules document. Repository-wide requirements for canonical ownership, stale-reference audits, and cross-layer synchronization are defined in [`../AGENTS.md`](../AGENTS.md).
