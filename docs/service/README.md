# Open Fufu — Service Contract Gateway

## Status and ownership

This directory owns Open Fufu's external application boundary.

- [`SERVICE_API.md`](./SERVICE_API.md) is the canonical V1 HTTP/control-plane contract for browser and integration-facing game resources.
- [`PARTICIPANT_PROTOCOL.md`](./PARTICIPANT_PROTOCOL.md) is the canonical V1 live participant/spectator stream contract.

This gateway is navigation only. It does not restate either contract.

Neighboring owners remain authoritative for their own concerns:

- authentication, browser sessions, CSRF/Origin enforcement, WebSocket authentication, and integration identity provisioning: [`../AUTH_AND_IDENTITY.md`](../AUTH_AND_IDENTITY.md);
- player-controller TypeScript surface: [`../../src/core/controller/ControllerApi.ts`](../../src/core/controller/ControllerApi.ts);
- match/runtime topology, persistence, replay storage, version binding, and OpenFront migration: [`../OPENFRONT_INTEGRATION_PLAN.md`](../OPENFRONT_INTEGRATION_PLAN.md);
- gameplay mechanics: the focused owners listed in [`../README.md`](../README.md).

The inherited [`../API.md`](../API.md) remains OpenFront current-state evidence only and is not an Open Fufu target contract.
