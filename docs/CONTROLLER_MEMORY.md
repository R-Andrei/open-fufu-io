# Open Fufu — Controller Memory Codec

## Status and authority

This file is the **canonical V1 owner for persistent player-controller memory representation, validation, serialization, lifecycle, and commit semantics**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) owns the surrounding controller architecture; [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) owns migration/runtime wiring; [`../src/core/controller/ControllerApi.ts`](../src/core/controller/ControllerApi.ts) owns the public TypeScript shape. None of those redefine the memory semantics below.

---

## 1. Scope

Controller memory is explicit private per-faction, per-match strategic state. It is the only game-facing mutable state that a player controller may rely on surviving across callbacks; module/global JavaScript state is not trusted persistence.

Memory begins as an empty object for every new match and never carries between matches.

The same memory lifecycle spans Strategic Spawn and normal play:

```text
{}
→ chooseInfluence()
→ reconsiderInfluence()
→ chooseOrigins()
→ decide()
→ decide()
→ ...
```

A callback that omits `memory` leaves the last successfully committed memory unchanged.

---

## 2. Exact V1 data model

The public API already defines a JSON-shaped root object:

```text
ControllerMemory = object<string, JsonValue>

JsonValue =
    null
  | boolean
  | finite number
  | string
  | JsonValue[]
  | object<string, JsonValue>
```

The root is always an object. Nested objects are plain structured records. Arrays preserve their authored order.

The following are not valid controller-memory values:

- `undefined`;
- `NaN`, `Infinity`, or `-Infinity`;
- `BigInt`;
- functions;
- symbols;
- class instances or other exotic host/runtime objects;
- `Date`, `Map`, `Set`, `RegExp`, typed arrays, or similar non-JSON containers;
- cyclic object graphs;
- sparse-array holes.

No custom binary-memory extension exists in V1.

---

## 3. Canonical serialization

V1 uses **canonical compact UTF-8 JSON** as the trusted persisted representation.

Canonicalization rules:

1. object keys are recursively sorted in ascending UTF-16 code-unit lexical order;
2. array element order is preserved;
3. no insignificant whitespace is emitted;
4. strings use normal JSON escaping and the resulting text is encoded as UTF-8;
5. numbers must be finite; ordinary deterministic JSON number formatting is used;
6. negative zero canonicalizes to `0`;
7. values outside the V1 data model are rejected rather than coerced silently.

Equivalent logical objects therefore produce identical canonical bytes regardless of property insertion order.

The authoritative V1 quota is measured on those canonical uncompressed bytes:

```text
canonical UTF-8 controller memory <= 131,072 bytes
```

Compression, if used internally for unrelated storage/transport purposes, never changes or circumvents the quota.

The host should retain the canonical byte representation as trusted controller state. Each callback receives a freshly decoded immutable/read-only projection rather than a mutable host object carried across isolates.

---

## 4. Whole-object replacement

Returned memory is **replacement state**, not an implicit merge or patch.

Example:

```text
previous = { "a": 1, "b": 2 }
returned = { "a": 3 }
committed = { "a": 3 }
```

The old `b` key is gone.

A callback that returns no `memory` field keeps the previous memory exactly.

V1 deliberately does not define deep-merge semantics, deletion sentinels, JSON Patch, or host-provided mutable memory methods.

---

## 5. Commit and rejection semantics

Controller-memory commit is separated from ordinary gameplay acceptance.

For a callback that executes successfully:

```text
callback returns
→ whole output is structurally valid
→ returned memory, if any, validates and canonicalizes within 128 KiB
→ memory commits
→ game-facing directives/commands receive their ordinary deterministic legality/transaction validation
→ receipts report accepted/rejected game-facing actions
```

Therefore an ordinary stale-state or gameplay-legality rejection **does not roll back valid new controller memory**. This is intentional: the next callback can inspect `lastDecision` and remember that an attempted action failed.

The game-facing directive/command transaction retains its own canonical validation semantics; controller memory is not an excuse to partially apply an otherwise invalid game-state mutation.

The following instead fault the callback/invocation and discard all newly proposed output, including memory:

- uncaught exception;
- timeout;
- sandbox violation;
- malformed whole callback output;
- invalid controller-memory representation;
- controller-memory quota violation;
- isolate memory-limit violation.

On such a fault, the previous successfully committed controller memory and previous successfully committed persistent directives remain authoritative.

An oversize memory proposal uses the existing memory-limit/runtime-fault path. A malformed memory value is a malformed whole output/runtime fault; V1 does not reopen the public `DecisionFailureCode` union solely to add a separate memory-code enum.

---

## 6. Strategic Spawn lifecycle

Spawn-hook memory uses the same codec, quota, and commit rules as normal `decide()` memory.

If a spawn hook succeeds and returns valid memory, that memory is visible to the next spawn phase and eventually to the first normal `decide()` callback.

If a spawn hook fails, times out, returns malformed memory, or exceeds the memory quota:

- that hook's proposed memory is discarded;
- the last successfully committed memory remains;
- Strategic Spawn uses the canonical deterministic fallback for that hook;
- the hook failure does not by itself fault the controller for the remainder of normal match play.

---

## 7. Persistence, replay, and diagnostics

Controller memory is **match runtime state**, not account progression. It is not written to SQLite after every callback and is not retained between matches.

The canonical archival replay also does **not** store controller-memory snapshots or memory contents. Replay records the minimal deterministic game-facing input/action stream needed to reproduce the authoritative simulation, so replay playback does not need to reconstruct the controller's private thought process.

Private short-retention diagnostics may record memory byte count and a deterministic/SHA integrity hash when useful for debugging, but should not retain arbitrary memory contents by default.

---

## 8. Validation expectations

Implementation/certification tests should cover at least:

- property-insertion-order independence;
- nested object-key ordering;
- arrays preserving order;
- Unicode keys/strings;
- negative zero;
- finite-number edge cases;
- rejection of non-finite numbers and unsupported value kinds;
- cyclic and sparse structures;
- exact 131,072-byte acceptance and one-byte-over rejection;
- whole-object replacement and omitted-memory preservation;
- ordinary game-action rejection with successful memory commit;
- runtime fault with previous-memory preservation;
- memory continuity across all three Strategic Spawn callbacks and first normal `decide()`.
