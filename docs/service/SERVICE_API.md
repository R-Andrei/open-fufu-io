# Open Fufu — V1 Service API

## Status and ownership

This file is the **canonical V1 owner for Open Fufu's HTTP/control-plane resource API** used by the browser and game-facing integrations.

It owns resource paths, request/result semantics, idempotency, pagination, and service-level errors. It does not own authentication/session mechanics, gameplay mechanics, the controller SDK, live match streaming, persistence layout, or internal process IPC.

Authentication and identity behavior is defined only in [`../AUTH_AND_IDENTITY.md`](../AUTH_AND_IDENTITY.md). The live stream is defined only in [`PARTICIPANT_PROTOCOL.md`](./PARTICIPANT_PROTOCOL.md).

All routes below are relative to:

```text
/api/v1
```

The identity-provisioning routes owned by `AUTH_AND_IDENTITY.md` remain separate integration routes and are not redefined here.

---

# 1. Common contract

## 1.1 Resource IDs

Public HTTP resources use opaque public IDs. Internal SQLite integer IDs, external provider subjects, controller-memory contents, and other private implementation identifiers are never accepted as actor identity.

The authenticated session/integration identity determines the caller. A client must not send `user_id` to assert ownership.

## 1.2 JSON and time

Unless an endpoint explicitly returns a file, request and response bodies use JSON with UTF-8 encoding. Timestamps are ISO-8601 UTC strings at the HTTP boundary.

## 1.3 Success and errors

Ordinary successful mutation responses use the resulting canonical resource representation rather than a second ad-hoc acknowledgement shape.

Errors use:

```json
{
  "error": {
    "code": "stable_machine_code",
    "message": "human-readable explanation",
    "request_id": "opaque-request-id",
    "details": {}
  }
}
```

`details` is optional. Stable codes are part of the API contract; English messages are not.

Baseline HTTP mapping:

| HTTP | Meaning |
| ---: | --- |
| 400 | malformed request / invalid resource transition |
| 401 | unauthenticated |
| 403 | authenticated but not allowed |
| 404 | resource absent or deliberately undisclosed |
| 409 | state/version conflict |
| 422 | structurally valid request that fails domain validation |
| 429 | bounded service limit exceeded |
| 500 | unexpected server failure |

## 1.4 Idempotency

Every retry-sensitive `POST` that creates a durable resource, spends account state, starts a match, publishes immutable content, or applies a durable settlement requires an `Idempotency-Key` header. In V1 this includes:

- `POST /controller-projects`;
- controller publication;
- `POST /origins`;
- `POST /echo-sets`;
- Gacha pulls;
- reward-settlement resolution;
- `POST /lobbies`;
- lobby start.

Operations whose resource transition is naturally idempotent need not require a key merely because they use `POST`. In particular, repeated join by an already-present participant, repeated leave by an absent participant, and repeated archive of an already-archived resource must converge on the same canonical state rather than creating duplicate membership/effects.

The key is scoped to authenticated caller + endpoint operation. Repeating the same key with the same canonical request returns the original result. Reusing it with a different request returns `409 idempotency_conflict`.

## 1.5 Optimistic mutation

Mutable editor/account resources expose an opaque `revision`. A mutation that can overwrite another edit requires `If-Match: <revision>` and returns `409 revision_conflict` when stale.

Immutable published controller versions, Custom Origin definitions used by history, matches, and replays are never edited in place.

## 1.6 Pagination

Collection endpoints that may grow without a small hard bound use opaque cursor pagination:

```json
{
  "items": [],
  "next_cursor": null
}
```

Clients pass `?cursor=<opaque>` and must not construct or parse cursors.

---

# 2. Bootstrap and selectable match content

```text
GET /bootstrap
```

Returns the minimum account/application state needed after browser login:

- current user public profile;
- whether a pending reward settlement blocks another reward-bearing match/Gacha pull;
- current service/API version identifiers needed by the browser;
- references to the currently selectable controller/Origin/Echo catalogue versions.

Authentication/session details remain owned by `AUTH_AND_IDENTITY.md`.

The browser discovers selectable match-level resources through:

```text
GET /maps
GET /rulesets
GET /official-ai-presets
```

These endpoints return stable selectable IDs, the relevant version identity, and only the presentation/compatibility metadata needed to construct a legal lobby. They do **not** duplicate map mechanics, ruleset mechanics, AI behavior, allowed-Origin arithmetic, or other canonical subsystem rules.

`GET /official-ai-presets` exposes the selectable Difficulty-0 Baseline entry plus the currently selectable character presets under one explicit `ai_preset_version`. The Baseline remains a distinct non-character entry; exact Baseline role, character preset identity/difficulty/allowed-Origin pools, and seeded Origin-selection behavior remain owned by [`../official-ai/OFFICIAL_AI_PRESETS.md`](../official-ai/OFFICIAL_AI_PRESETS.md) and its code-readable configuration.

---

# 3. Controller projects and immutable versions

A **project** is mutable authoring state. A **published controller version** is immutable.

```text
GET    /controller-projects
POST   /controller-projects
GET    /controller-projects/{project_id}
PATCH  /controller-projects/{project_id}
GET    /controller-projects/{project_id}/draft
PUT    /controller-projects/{project_id}/draft
GET    /controller-projects/{project_id}/versions
POST   /controller-projects/{project_id}/publish
GET    /controller-versions/{version_id}
```

`PATCH /controller-projects/{project_id}` is metadata only: rename/archive/unarchive. `PUT .../draft` replaces the project's current source package under optimistic concurrency.

Publication accepts the explicit API target:

```json
{ "controller_api_version": "<supported-version>" }
```

Publication:

1. snapshots the current draft;
2. compiles/typechecks it against the requested service-supported controller API version;
3. runs the required certification contract;
4. on success creates one new immutable version number/artifact recording that `controller_api_version`;
5. never mutates an earlier published version.

A failed publication attempt returns its certification report without creating a published version.

A match selection always references a published `controller_version_id`, never a mutable project/draft. V1 has one match-wide `controller_api_version`, so every selected published human controller must use the lobby's candidate controller API version unless a future explicitly versioned compatibility adapter is introduced.

---

# 4. Origins

The public catalogue and builder mechanics remain owned by the Origin documents; this API only exposes and stores selections/definitions.

```text
GET  /origin-catalogue
GET  /origins
POST /origins
GET  /origins/{origin_id}
POST /origins/{origin_id}/archive
```

`GET /origin-catalogue` returns the currently selectable catalogue identity plus player-facing trait/Official-Origin data appropriate to the caller.

`POST /origins` creates one immutable Custom Origin definition from:

- display name;
- explicit `catalogue_version`;
- selected trait IDs.

The service validates the builder rules against that catalogue and stores the canonical definition hash. Editing a definition means creating another Custom Origin definition; a historical definition is never silently rewritten. Archive only removes it from ordinary selection.

Official Origins are catalogue content and are not created through these routes.

---

# 5. Echo collection, sets, and acquisition settlements

Echo mechanics remain owned by [`../ECHO_CATALOGUE.md`](../ECHO_CATALOGUE.md).

```text
GET    /echoes
PUT    /echoes/{echo_ref}/favorite
GET    /echo-sets
POST   /echo-sets
GET    /echo-sets/{set_id}
PUT    /echo-sets/{set_id}
DELETE /echo-sets/{set_id}
GET    /reward-settlements/pending
GET    /reward-settlements/{settlement_id}
POST   /reward-settlements/{settlement_id}/resolve
POST   /gacha/pulls
```

`GET /echoes` supports bounded filtering/sorting plus cursor pagination; it returns an opaque inventory reference, the retained roll, catalogue identity, tier/presentation data derivable for that roll, and favorite state. `PUT .../favorite` accepts `{ "favorite": true|false }` and changes only that account presentation flag; it does not alter Echo mechanics or the retained roll.

An Echo Set stores references to retained inventory identities/slots. It does not copy Echo mechanics.

## 5.1 Pending settlement

A match-reward or Gacha acquisition batch that requires duplicate/Pareto resolution is represented as a durable reward settlement. Closing the browser does not discard it.

`GET /reward-settlements/pending` returns zero or one unresolved settlement for the caller.

`POST .../resolve` submits the caller's legal retain/default choices. The service atomically applies inventory, Middle Fingers, pity/audit effects and marks the settlement applied. Retrying the idempotent request cannot apply the same settlement twice.

While an unresolved pending settlement exists, the service rejects another reward-bearing match start or Gacha pull as required by the Echo owner.

## 5.2 Gacha

`POST /gacha/pulls` accepts only:

```json
{ "count": 1 }
```

or

```json
{ "count": 10 }
```

The service evaluates affordability and paid-pull pity using the caller's bound Gacha rules. Ten pulls are processed sequentially by the canonical Echo rules, not as a discounted/parallel special case.

The result is either an already-applied acquisition result or a pending settlement when player resolution is required. The endpoint never lets the client provide rolled magnitudes, pity results, or Echo identities.

---

# 6. Lobbies and match selection

```text
GET   /lobbies
POST  /lobbies
GET   /lobbies/{lobby_id}
PATCH /lobbies/{lobby_id}
POST  /lobbies/{lobby_id}/join
POST  /lobbies/{lobby_id}/leave
PUT   /lobbies/{lobby_id}/selection
POST  /lobbies/{lobby_id}/start
```

The lobby resource is the canonical pre-match control-plane object. It contains:

- lobby status and configuration;
- map/scenario identity;
- spawn mode/configuration;
- fixed teams where applicable;
- human and Official-AI slots visible to the caller;
- each caller-visible ready state and surfaced selection metadata;
- the candidate controller/catalogue/rules/AI versions required for new selections.

Only service-authorized configuration fields are mutable through `PATCH`; authorization does not come from a client-supplied role field. Host-authorized lobby configuration may add/remove/configure Official-AI slots by `official_ai_preset_id`. The browser never chooses an Official AI's Origin directly.

`PUT .../selection` replaces the calling human participant's lobby selection atomically and may reference:

- one immutable controller version compatible with the lobby's candidate controller API version;
- one legal Official/Custom Origin definition;
- one Echo Set where the mode permits Echoes;
- ready/not-ready state.

The server validates compatibility against the lobby's bound candidate rules. Selecting a resource does not copy its definition into the client request.

`POST .../start` is authoritative. On success it freezes the lobby into one match, binds every required immutable/versioned input, and returns the created match resource. A start fails if required participants are not ready/valid, an account has a blocking pending settlement, or the lobby cannot form a deterministic match configuration.

For Official-AI slots, match creation freezes the exact `ai_preset_version` and selected AI entry IDs. Character presets then perform the seeded allowed-Origin selection/reveal sequence owned by [`../official-ai/OFFICIAL_AI_PRESETS.md`](../official-ai/OFFICIAL_AI_PRESETS.md); the service does not invent that step for the distinct Difficulty-0 Baseline or any future AI entry whose canonical definition does not use a character allowed-Origin pool.

Random/Fixed Spawn interactions with spawn-transforming Origins are not defined here; the service applies only combinations and resolved results permitted by [`../STRATEGIC_SPAWN.md`](../STRATEGIC_SPAWN.md).

---

# 7. Matches

```text
GET /matches?cursor=...
GET /matches/{match_id}
```

The match representation exposes caller-authorized metadata including:

- lifecycle state;
- map identity/hash;
- bound deterministic game/controller/catalogue/resolver versions;
- participant/slot metadata legally visible to the caller;
- final result when known;
- replay availability/metadata when present.

It never exposes another participant's controller source, controller memory, hidden operational state, or service-internal IDs.

Live state is not polled through this resource. Use the participant protocol.

---

# 8. Replays

```text
GET /matches/{match_id}/replay
GET /matches/{match_id}/replay/file
```

The metadata endpoint returns:

- replay format version;
- exact match/version binding summary;
- integrity hash;
- compressed size;
- retention/availability state.

The file endpoint returns the canonical replay artifact when retained and authorized. Replay semantics/storage are owned by the integration plan; this API only exposes the resource.

Expired replay payloads return a stable `replay_expired`/unavailable result rather than fabricating a replay from current state.

---

# 9. Live participant entry

The HTTP match representation advertises the live stream endpoint and currently supported participant protocol version(s) for that service deployment. Participant-protocol negotiation is a live transport contract; it is not silently conflated with the match's deterministic simulation-version bindings. The WebSocket/authentication binding and all live message semantics are owned by [`PARTICIPANT_PROTOCOL.md`](./PARTICIPANT_PROTOCOL.md).

No gameplay command channel is added to the browser by this API. Player gameplay is driven by the bound controller and authoritative match runtime.

---

# 10. Integration clients

External systems such as Foof use the same game-facing resource model where suitable. Machine identity/provisioning/authentication remains owned by `AUTH_AND_IDENTITY.md`.

Integration clients may create/read permitted game resources according to their configured authorization, but may not:

- execute player controllers themselves;
- submit arbitrary simulation mutations;
- write SQLite directly;
- impersonate a user by supplying an account ID;
- bypass immutable controller/Origin/version binding.

Adding an integration-specific endpoint requires a capability that cannot be represented safely through the ordinary resource API; convenience alone is not sufficient reason for a second game API.