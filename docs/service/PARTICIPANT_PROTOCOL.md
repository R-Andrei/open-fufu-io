# Open Fufu — V1 Participant Protocol

## Status and ownership

This file is the **canonical V1 owner for the live browser participant/spectator stream** between the Open Fufu service and an authorized viewer of one match.

It owns connection semantics, protocol negotiation, message envelopes, snapshot/delta ordering, reconnect/resync behavior, match/spawn lifecycle messages, and stream errors.

Authentication/session/Origin checks are owned only by [`../AUTH_AND_IDENTITY.md`](../AUTH_AND_IDENTITY.md). Gameplay remains controller/server-driven; this protocol is not a manual gameplay command API.

---

# 1. Transport and authentication

A live match advertises a WebSocket endpoint equivalent to:

```text
/api/v1/matches/{match_id}/stream
```

The browser authenticates the WebSocket exactly as defined by `AUTH_AND_IDENTITY.md`. No session/JWT credential is placed in the query string.

After authentication, the service resolves one immutable viewer authorization for the connection, for example:

- participant/faction viewer;
- fixed teammate-shared viewer where canonical visibility permits it;
- spectator/replay-like viewer where the lobby/match permits it.

The match process receives only the resulting internal viewer identity/projection policy, not browser cookies/OAuth/integration credentials.

---

# 2. Protocol negotiation

V1 uses semantic protocol version:

```text
participantProtocolVersion = "1"
```

The first client message is:

```json
{
  "type": "HELLO",
  "protocol_version": "1",
  "resume": null
}
```

A reconnect may instead provide:

```json
{
  "type": "HELLO",
  "protocol_version": "1",
  "resume": {
    "stream_id": "opaque-stream-id",
    "after_seq": 1842
  }
}
```

Unsupported versions close with a stable protocol error; the server does not silently reinterpret another version.

HELLO outcome/control replies such as `RESUME_ACCEPTED` and `RESYNC_REQUIRED` are **unsequenced connection-control frames**. They do not consume or alter a projection stream's `seq` space. Ordered state/event delivery begins or resumes only through the server envelope in §3.

Binary compression/encoding may later wrap these semantic messages without changing protocol meaning. An encoding change that alters field/event semantics requires a protocol version change.

---

# 3. Server envelope

Every ordered server **state/event** message after successful negotiation uses one envelope:

```json
{
  "protocol_version": "1",
  "stream_id": "opaque-stream-id",
  "seq": 1843,
  "tick": 9021,
  "type": "STATE_DELTA",
  "payload": {}
}
```

Rules:

- `stream_id` identifies one projection stream generation;
- `seq` starts at 1 and increases by exactly 1 for every ordered envelope on that stream;
- `tick` is the authoritative simulation tick relevant to the envelope, or the latest authoritative tick for non-simulation lifecycle messages;
- envelope order is authoritative;
- sequence numbers are transport/projection ordering, not simulation event IDs;
- clients must not apply an envelope with a sequence gap;
- unsequenced HELLO/resume/resync control replies are not part of this envelope stream and never advance `seq`.

Different viewers may receive different payloads/sequence histories because legal projection differs. A stream sequence is never a global hidden-state counter.

---

# 4. Initial synchronization

A newly accepted stream receives ordered envelopes:

1. `STREAM_READY` at `seq = 1`;
2. one complete `STATE_SNAPSHOT` for the viewer's current legal projection;
3. subsequent ordered deltas/events.

`STREAM_READY` identifies:

- match public ID;
- stream ID;
- participant protocol version;
- viewer mode/faction where legally revealable;
- current match lifecycle phase;
- exact match binding summary needed by the viewer/replay/debugger.

`STATE_SNAPSHOT` is a complete replacement baseline for **currently authorized live state**, not a replay of historical actions.

It includes enough state to render and inspect the match at that point, such as legally visible:

- map/ownership projection;
- factions/teams;
- Population/FFY summaries allowed to the viewer;
- structures and units;
- manifested operations/Contacts;
- surfaced match/spawn state;
- result state if terminal.

It never contains controller memory, another player's controller source, hidden unmanifested plans, integration credentials, or state outside the canonical visibility projection.

---

# 5. Incremental state

Normal synchronization uses:

```text
STATE_DELTA
```

A delta is interpreted only relative to the immediately preceding state of the same stream and may contain additions, changes, and removals to the legal projected state.

The server may coalesce multiple internal simulation changes into one delta, but must preserve the same resulting authoritative viewer state and monotonically increasing tick/sequence semantics.

A client never infers canonical state from missing fields in a delta; omitted state is unchanged unless the payload explicitly removes/replaces it according to the versioned delta schema.

Transient presentation-only hints may be separate events, but a reconnect/resync must not depend on receiving them to reconstruct canonical current state.

---

# 6. Events

V1 stream events include the minimum lifecycle classes below. Payload schemas are versioned with the protocol rather than independently improvised by UI modules.

## 6.1 Match lifecycle

```text
MATCH_PHASE_CHANGED
MATCH_ENDED
```

`MATCH_ENDED` carries the caller-authorized terminal result and the match resource/replay references needed for post-match navigation. It does not perform Echo settlement through the WebSocket; account progression uses the service API.

## 6.2 Strategic Spawn

Strategic Spawn may emit:

```text
SPAWN_PHASE_CHANGED
SPAWN_INFLUENCE_REVEALED
SPAWN_ORIGINS_RESOLVED
SPAWN_INITIAL_TERRITORY_RESOLVED
```

These messages expose only the information that the canonical Spawn protocol says is public at that phase.

Controller submissions themselves travel through the controller runtime, not the browser stream. A participant browser cannot submit a replacement spawn choice manually through this protocol.

Random/Fixed modes emit only lifecycle/resolution information applicable to those modes. Their interactions with spawn-transforming Origins are owned by [`../STRATEGIC_SPAWN.md`](../STRATEGIC_SPAWN.md), not this protocol.

## 6.3 Diagnostics

Authorized controller-development/debug views may receive bounded surfaced diagnostics derived from the controller contract, such as debug points/regions/metrics/annotations and invocation status.

Private controller memory is never included.

---

# 7. Reconnect and resume

A server retains a bounded recent envelope window per active stream/projection.

When HELLO supplies `resume.stream_id` + `after_seq`, the server chooses one of two outcomes:

### Resume accepted

If:

- the stream generation is still valid;
- the viewer authorization/projection has not changed incompatibly;
- every envelope after `after_seq` is still retained;

then the server sends an unsequenced control reply equivalent to:

```json
{
  "type": "RESUME_ACCEPTED",
  "protocol_version": "1",
  "stream_id": "opaque-stream-id",
  "after_seq": 1842
}
```

It then retransmits the retained ordered envelopes beginning at `after_seq + 1` with their **original** sequence numbers before continuing live delivery. The control reply itself does not consume a sequence number.

### Fresh resync

Otherwise the server sends an unsequenced `RESYNC_REQUIRED` control reply, creates a new `stream_id`, and starts a fresh ordered stream with `STREAM_READY` at `seq = 1` followed by `STATE_SNAPSHOT`.

A reconnect therefore never requires replaying the entire match history.

A stream ID from one user/viewer authorization cannot be used to obtain another viewer's retained projection.

---

# 8. Gap detection and explicit resync

If a client receives sequence `N+2` while expecting `N+1`, it must stop applying stream state and send:

```json
{
  "type": "RESYNC_REQUEST",
  "stream_id": "opaque-stream-id",
  "last_applied_seq": 1842
}
```

The server may resume the retained gap using an unsequenced `RESUME_ACCEPTED` reply followed by the original missing envelopes, or issue an unsequenced `RESYNC_REQUIRED` reply and a fresh stream using the same rules as reconnect.

The client must not guess, skip a delta, or continue applying later messages across a known gap.

---

# 9. Backpressure and slow viewers

The authoritative match never waits for a browser viewer.

Per-connection outbound buffering is bounded. When a viewer falls far enough behind that retaining/delivering every delta would threaten service health, the server may discard that connection's pending incremental stream and force a fresh resync.

Backpressure behavior must not:

- pause or slow the authoritative simulation;
- drop actions from the controller/runtime;
- change another viewer's state;
- expose hidden global queue information.

Repeated inability to consume snapshots/live state may close the WebSocket with a stable `slow_consumer` reason.

---

# 10. Client messages

After HELLO, V1 accepts only protocol-maintenance/viewer messages such as:

```text
RESYNC_REQUEST
PING
```

and explicitly versioned diagnostic/view preferences that do not mutate gameplay.

There is no generic `INTENT`, `TURN`, `MOVE`, `ATTACK`, `BUILD`, spawn-choice, or simulation-mutation client message. Open Fufu gameplay mutations originate from validated controller decisions inside the authoritative match architecture.

Lobby/account/editor mutations use the HTTP service API instead.

---

# 11. Errors and closure

Recoverable request/protocol errors use:

```json
{
  "type": "ERROR",
  "code": "stable_machine_code",
  "message": "human-readable explanation"
}
```

Fatal protocol/auth/projection errors close the socket after the error where safe.

Stable V1 classes include:

```text
unsupported_protocol
unauthorized_viewer
match_not_live
invalid_resume
invalid_message
rate_limited
slow_consumer
internal_error
```

A server restart/match-process loss is never disguised as normal sequence completion. The service either restores/continues the match according to runtime policy or exposes a terminal/unavailable match state through the ordinary service contract.

---

# 12. Replay relationship

The live participant stream is **not** the archival replay format.

A live snapshot/delta stream is viewer-specific, may omit hidden state, and may be coalesced/resynchronized. The canonical replay instead records deterministic authoritative inputs/version bindings required to reconstruct the match under the integration plan.

The replay viewer may reuse the same browser rendering/update adapters after reconstruction, but that implementation reuse does not make live deltas the historical source of truth.

---

# 13. Validation expectations

Protocol tests must cover at minimum:

- initial HELLO → `STREAM_READY(seq=1)` → snapshot → deltas;
- contiguous sequence enforcement;
- resume/resync control replies do not consume ordered stream sequence numbers;
- reconnect with retained resume success and original sequence replay;
- reconnect after retention expiry → fresh stream at `seq = 1`;
- explicit gap-triggered resync;
- changed viewer authorization invalidating an old stream ID;
- participant versus spectator projection differences;
- Strategic Spawn reveal ordering without premature information;
- no browser simulation mutation messages;
- slow-consumer resync/close without match slowdown;
- terminal result followed by ordinary HTTP settlement/replay workflows.