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

## 5.1 Public political ownership plane

Current political ownership is common public state, not requester-relative operational projection. For a given authoritative ownership revision, participant and spectator viewers receive the same logical `CellId -> owner` plane; requester-relative units, structures, operations, Contacts, diagnostics, and other tactical state remain independently projected.

The browser maintains ownership only as a non-authoritative logical mirror. Rendering may consume that mirror but does not participate in ownership synchronization or authority.

### 5.1.1 Tick, stream-sequence, and ownership-revision binding

A complete ownership baseline or ownership update is carried as part of an ordered `STATE_SNAPSHOT` or `STATE_DELTA` envelope. The envelope's `tick` is therefore the authoritative tick associated with that ownership publication; the ownership binary frame does not carry a second independent tick.

Ownership has its own positive monotonic publication revision in addition to the outer stream `seq`:

- a fresh stream's complete ownership baseline installs its current ownership revision `R`;
- an incremental ownership update declares `base_revision = R` and `revision = R + 1`;
- a same-stream complete ownership replacement also advances to the next ownership revision;
- an ordered envelope that contains no ownership component leaves the ownership revision unchanged even though outer `seq` still advances;
- a fresh resync stream may install the current complete ownership revision directly without replaying ownership history.

The two orderings protect different boundaries: outer `seq` protects the complete participant projection stream, while `base_revision` protects ownership-plane composition. A client applies an incremental ownership update only when the outer stream envelope is contiguous and its currently installed ownership revision exactly equals `base_revision`.

After a known outer-sequence or ownership-revision gap, later ownership state is not guessed or skipped. `RESUME_ACCEPTED` may unlock replay of the original retained same-stream envelopes beginning at the exact last applied `seq`; the control reply itself changes neither outer `seq` nor ownership revision. Otherwise the client waits for the fresh stream and complete replacement baseline defined by §§7–8.

The ownership `cell_count` must equal the raster cell count bound by the stream's map identity. Ordinary V1 maps contain exactly 4,800,000 cells. Cell position in the dense ownership plane is the canonical `CellId`.

### 5.1.2 Owner-index semantics

Ownership is represented as a dense owner-code plane plus a deterministic non-neutral owner palette:

- owner code `0` means neutral/unowned;
- owner codes `1..N` address palette entries `0..N-1`;
- every code must be within the current palette;
- palette entries are unique UTF-8 strings in strict lexicographic order of their encoded UTF-8 bytes.

The owner-code storage width is the smallest canonical width that can represent the palette: one byte through 255 palette entries, two bytes through 65,535 entries, otherwise four bytes. Fixed-width owner codes use little-endian byte order.

### 5.1.3 Ownership binary schema version 1

V1 ownership frames use:

```text
ownership_plane_schema_version = 1
```

The binary frame begins with this common header:

```text
"OFOP"                         4 ASCII bytes
schema_version                 u8 = 1
frame_kind                     u8: 0 = complete, 1 = delta
revision                       varuint
cell_count                     varuint
palette_count                  varuint
palette[palette_count]         varuint UTF-8-byte-length + UTF-8 bytes
```

`varuint` is unsigned base-128 with the least-significant seven-bit group first and bit `0x80` indicating continuation.

A **complete** frame then uses one of:

```text
raw:
  mode                         u8 = 0
  owner_code_width             u8 = 1 | 2 | 4
  codes[cell_count]            fixed-width owner codes

RLE:
  mode                         u8 = 1
  run_count                    varuint
  runs[run_count]              (length varuint, owner_code varuint)
```

An RLE frame must cover exactly `cell_count` cells in order. A later complete frame may be used as a whole-plane replacement; `frame_kind = complete` does not require the outer participant envelope itself to be an initial `STATE_SNAPSHOT`.

A **delta** frame continues after the common header with:

```text
base_revision                  varuint
chunk_size                     varuint
changed_chunk_count            varuint
changed_chunks[...]            ordered by chunk_index
```

Chunk `i` covers the deterministic linear `CellId` range beginning at `i * chunk_size`, truncated only at the end of the plane. Changed chunk indices are strictly increasing and unique. Each changed chunk begins with `chunk_index varuint` and one of:

```text
sparse patch:
  mode                         u8 = 0
  entry_count                  varuint
  entries[entry_count]         (offset varuint, owner_code varuint)

run patch:
  mode                         u8 = 1
  run_count                    varuint
  runs[run_count]              (offset varuint, length varuint, owner_code varuint)

whole-chunk replacement:
  mode                         u8 = 2
  owner_code_width             u8 = 1 | 2 | 4
  encoded_cell_count           varuint
  codes[encoded_cell_count]    fixed-width owner codes
```

Sparse offsets are strictly increasing and unique. Runs are ordered, non-overlapping, positive-length, and bounded by the chunk. Whole-chunk replacement contains exactly that chunk's cell count.

The producer may deterministically choose sparse, run, or whole-chunk replacement independently for each changed chunk, and may choose a complete ownership replacement when the aggregate incremental representation is no longer cheaper/useful. Exact chunk size, publication cadence, transport compression, and patch-versus-replacement thresholds are implementation/performance parameters rather than gameplay semantics; they must remain empirically justified. `chunk_size` is carried by each delta so it is not a hidden client assumption.

A V1 sender emits ownership schema version 1 and a receiver rejects unsupported ownership schema versions. A future representation-only binary revision requires explicit compatible schema handling; any change to ownership field/event semantics remains subject to the participant-protocol version rule in §2.

### 5.1.4 Validation and atomic application

Before changing the installed logical ownership mirror, the receiver validates the complete ownership frame, including schema version, map/cell-count binding, palette uniqueness/order, owner-code bounds, canonical width, revision relationship, chunk order/bounds, sparse/run ordering, exact replacement lengths, truncation, and trailing data.

Encoded counts and lengths must be bounded against the remaining frame and V1 plane limits before count-driven allocations cross the browser resource boundary. A malformed frame cannot partially mutate the installed logical plane or advance its ownership revision.

Incremental application may mutate the installed dense plane only after the entire frame is structurally valid and the exact `base_revision` check succeeds. A complete replacement is decoded and validated as a complete plane before it becomes the installed logical baseline.

Multiple authoritative ownership transitions between publications may be coalesced; the transmitted state is the final ownership required by the published revision, not a replay of intermediate captures.

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
- contiguous sequence enforcement, including ordered envelopes with no ownership component;
- complete 4,800,000-cell ownership baseline reconstruction;
- sparse, run, whole-chunk-replacement, and complete-replacement ownership equivalence;
- deterministic ownership encoding and ownership-revision composition;
- ownership schema rejection, malformed/truncated frame rejection, and no partial logical mutation;
- retained same-stream ownership recovery after `RESUME_ACCEPTED` and fresh ownership baseline after `RESYNC_REQUIRED`;
- production-scale ownership raw/encoded size, encode/decode cost, and logical/decode-memory evidence for sparse, contiguous, and multi-million-cell churn;
- identical public ownership publication across viewers while requester-relative operational projection remains independent;
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