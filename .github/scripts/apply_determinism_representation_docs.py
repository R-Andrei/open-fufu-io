from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def replace_section(text: str, start: str, end: str, new: str, label: str) -> str:
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f"{label}: start marker not found")
    j = text.find(end, i)
    if j < 0:
        raise RuntimeError(f"{label}: end marker not found")
    return text[:i] + new.rstrip() + "\n\n" + text[j:]


controller_memory = r'''# Open Fufu — Controller Memory Codec

## Status and authority

This file is the **canonical detailed V1 specification for persistent player-controller memory representation, validation, serialization, lifecycle, and commit semantics**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for the overall controller model and failure semantics. [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) governs implementation. `src/core/controller/ControllerApi.ts` defines the public TypeScript shape.

Nothing in this file authorizes gameplay implementation.

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
'''

segments = r'''# Open Fufu — Strategic Segments

## Status and authority

This file is the **canonical detailed V1 specification for immutable strategic Segment generation, membership, sizing policy, connectivity, IDs, compilation, and validation**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for the overall spatial ontology and the rule that Segments are a strategy/query lens rather than simulation physics. [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) governs implementation.

Nothing in this file authorizes gameplay implementation.

---

## 1. Purpose

Cells remain Open Fufu's physical territorial resolution. Segments provide a more ergonomic intermediate geographic vocabulary for controllers that need richer spatial control than faction-level commands but should not have to hand-manage thousands of individual cells.

Useful controller reasoning should include operations such as:

- selecting nearby mostly-Mountain Segments;
- finding Shallow-Water or Deep-Water regions;
- prioritizing a narrow pass, ridge, river-like waterway, island, peninsula, coast, basin, or broad plain;
- weighting/targeting whole strategic regions while retaining cell-level access when needed.

Segments are not provinces, ownership buckets, combat zones, or engine-authored strategic recommendations.

---

## 2. Hard invariants

Every compiled V1 map satisfies all of the following:

1. every real raster cell belongs to **exactly one** Segment, including Deep Water and Impassable terrain;
2. Segment membership is immutable for that compiled map artifact;
3. each Segment is **cardinally 4-connected**;
4. Segment IDs/membership/adjacency do not change during a match;
5. Segment borders have no intrinsic combat, capture, movement, economy, visibility, or other physical effect;
6. dynamic terrain/state changes such as Fallout or a rule that later converts a cell to Deep Water do not regenerate Segment membership;
7. generation is deterministic for one map-source input plus one Segment-generator version.

### 2.1 Meaning of cardinal 4-connectivity

4-connected does **not** mean every cell has four neighbors inside its Segment.

It means that from any cell in the Segment, every other cell in that Segment can be reached through a path of cells in the same Segment using only north/south/east/west adjacency.

A one-cell-wide winding river or a Segment touching a map edge/corner is therefore valid. Two disconnected blobs or blobs touching only diagonally are not one Segment.

---

## 3. Geography outranks size

The ordinary V1 **target** is approximately:

```text
4,096 cells per Segment
```

This is a soft compiler target only. V1 has:

- **no hard minimum Segment size**;
- **no hard maximum Segment size**;
- **no aspect-ratio restriction**;
- **no compactness requirement**.

A coherent 2,000-cell thin winding waterway may remain one Segment. A 9,000-cell long waterway may sensibly become several rope-like Segments along its length. A small island, narrow mountain pass, long ridge, crescent coast, or other strategically meaningful feature may legitimately be far below 4,096 cells. A large coherent basin or broad natural region may legitimately exceed it.

The target matters most where geography offers no more useful boundary—for example, subdividing a very large homogeneous plain.

The ordering of compiler priorities is:

```text
geographic/terrain coherence
> meaningful topology and chokepoints
> terrain homogeneity/useful strategic boundaries
> approximate 4,096-cell target
```

Never destroy a useful geographic feature merely to satisfy the target size.

---

## 4. Terrain/topology treatment

The compiler should generally make Segment boundaries follow visible/mechanical terrain geometry where possible.

Deep Water, Shallow Water, and Impassable terrain are strong distinct geographic domains and should not be casually absorbed into ordinary land Segments. Other terrain changes—especially Mountain/ridge-like geography, Marsh, Forest, Highland, Desert, and similar coherent formations—are strong boundary/subdivision evidence rather than mandatory one-terrain-per-Segment partitions.

A Segment may contain multiple terrain types when geography/topology makes that representation more useful. `terrainCounts` exists precisely so controllers can reason about mixtures such as “mostly Mountain.”

V1 does **not** add semantic geographic tags such as `RIVER`, `RIDGE`, `STRAIT`, `ISLAND`, `COAST`, or `PASS` to `SegmentView`. Controllers use Segment geometry/adjacency plus existing terrain information, including Shallow Water and Deep Water. Geographic tags may be reconsidered in a future API version but are not a V1 dependency.

If current terrain changes after map compilation, Segment membership remains fixed; runtime terrain summaries over a Segment must reflect the legally observable current terrain rather than pretending membership needs to be regenerated.

---

## 5. Feature significance and raster noise

The compiler should preserve **strategically coherent features**, not every isolated raster blemish.

A small feature may deserve its own Segment because of shape, linear extent, terrain contrast, boundary role, chokepoint/topological effect, or obvious geographic coherence even when its area is tiny. Conversely, an isolated one-cell or otherwise meaningless terrain speck need not become a standalone Segment merely because its terrain enum differs from its surroundings.

There is intentionally no universal `if area < N then merge` rule. Feature significance is a deterministic map-compiler heuristic operating under the hard invariants and geography-first priorities in this document.

Those feature-detection weights/heuristics are compiler implementation parameters, not live gameplay rules. They are versioned through the Segment-generator/map artifact, and the final compiled membership is authoritative for that map version.

---

## 6. Accepted compiler pipeline

The V1 compiler should use the following deterministic geography-first pipeline:

```text
terrain/topology raster
→ identify connected coherent terrain/topology features
→ preserve meaningful narrow/topological features
→ subdivide oversized featureless interiors toward ~4,096 cells
→ merge meaningless raster fragments where appropriate
→ enforce/repair cardinal connectivity
→ assign stable Segment IDs
→ compile membership + metadata + adjacency into map artifact
```

### 6.1 Feature-first extraction

Connected terrain/topology evidence is evaluated before generic size balancing. Long narrow features remain long and narrow when that is the useful geographic representation.

### 6.2 Subdivision of featureless/oversized areas

Where geography supplies no better internal boundary, use a deterministic balanced geographic flood/Voronoi-style subdivision targeting roughly 4,096 cells.

Seed placement should be deterministic and geography-aware (for example deterministic farthest-point placement rather than random per-match seeds). The subdivision should prefer terrain transitions, barriers, ridges and chokepoints as boundaries when available.

A long coherent feature that is worth subdividing should normally be split **along its length** into several coherent pieces rather than padded sideways with unrelated neighboring terrain to manufacture compact shapes.

### 6.3 Fragment cleanup

Meaningless isolated fragments may merge into an adjacent Segment selected deterministically using shared-boundary/topological/terrain fit. Fragment cleanup must never break cardinal connectivity or erase a strategically meaningful narrow feature merely because that feature is small.

### 6.4 No match-seeded segmentation

The match seed never participates in Segment generation. Segment membership is a property of the compiled map, not a match.

---

## 7. Stable IDs and compiled representation

After final membership is complete:

1. choose each Segment's representative ordering key as its **smallest CellId**;
2. sort Segments ascending by that key;
3. assign dense `SegmentId` values `0, 1, 2, ...` in that order.

Final V1 Segment count must remain below **65,536**, allowing compact per-cell membership such as a `Uint16Array`.

At 4.8 million cells, a two-byte Segment membership buffer costs about **9.6 MB** before any asset-level compression, which is acceptable for the authoritative map representation.

The compiled map artifact contains at least:

- `segmentGeneratorVersion`;
- per-cell Segment membership;
- stable Segment IDs;
- immutable Segment cell counts/membership metadata;
- Segment adjacency;
- terrain/geography metadata needed for efficient public summaries.

The Segment layer contributes to the canonical map artifact/hash. Never load an old terrain raster and silently regenerate its Segments with a newer generator.

Changing Segment-generation heuristics produces a new compiled map artifact/version; historical matches keep their old map hash and old Segment partition.

---

## 8. Runtime/public behavior

`SegmentView` remains a factual strategic summary. Runtime owner shares and legally observable terrain summaries are derived over immutable Segment membership; they are not stored as immutable ownership facts in the map.

Segment lookup must be cheap enough for ordinary controller use:

```text
cell → SegmentId: O(1)
SegmentId → cell selector: cheap immutable/indexed view
Segment adjacency: precompiled/indexed
```

V1 may later add non-semantic API ergonomics such as a representative cell/center, but no such addition is required to implement the accepted Segment model.

---

## 9. Validation expectations

Every compiled map must validate at least:

- exactly one Segment assignment for every one of the 4,800,000 real raster cells;
- no invalid/missing Segment IDs;
- cardinal 4-connectivity of every Segment;
- symmetric/consistent Segment adjacency;
- no Segment count >= 65,536;
- deterministic byte-identical membership for the same map input + generator version;
- stable ID ordering by smallest CellId;
- sensible preservation of representative rivers/waterways, ridges/mountains, islands/coasts, passes/chokepoints, and featureless plains in map-compiler fixtures;
- no arbitrary hard failure merely because a useful Segment is much smaller/larger/longer/thinner than 4,096 cells.

The distribution around 4,096 cells should be reported as a compiler diagnostic, not enforced as a gameplay legality gate.
'''

Path("docs/CONTROLLER_MEMORY.md").write_text(controller_memory)
Path("docs/SEGMENTS.md").write_text(segments)

# OPEN_FUFU_DESIGN.md
design_path = Path("docs/OPEN_FUFU_DESIGN.md")
design = design_path.read_text()

old_replay = '''Replay/debug tooling should eventually expose:

- deterministic replay;
- committed controller decision/event logs;
- optional controller debug logs;
- action/rejection/failure history;
- Population/FFY/territory histories;
- relevant operation/contact histories;
- controller runtime/CPU/resource-budget information;
- post-match summaries.'''
new_replay = '''### 4.1 Minimal archival replay — Accepted V1

The canonical archival replay is a **minimal deterministic simulation-input/action record**, not a periodic dump of the 4.8-million-cell world state.

A replay binds the exact versioned match inputs above plus the authoritative Strategic Spawn record and the accepted simulation-affecting game-facing input stream in deterministic tick/order form. Playback re-runs the deterministic simulation from the beginning using those committed inputs; it does **not** need to re-execute player controller code or reconstruct private controller thought state.

The archival replay does not contain periodic full-state seek checkpoints. V1 seeking/late-position playback fast-forwards the deterministic simulation from match start, optionally without rendering intermediate frames. This keeps replay storage minimal; V1 does not trade large checkpoint storage for instant arbitrary seeking.

The canonical replay should not archive controller-memory snapshots, controller debug overlays, verbose controller logs, rejected no-effect proposals, browser render frames, or redundant per-tick copies of derived simulation state. Detailed controller diagnostics remain a separate short-retention debugging artifact. Post-match metadata/results remain in SQLite even after an ordinary replay file expires.

Strategic Spawn stores its small semantic submissions/resolved outputs plus the final resolved starting footprint representation required by `STRATEGIC_SPAWN.md`. During normal play, only committed simulation-affecting inputs need to drive archival replay. Deterministic integrity hashes may be recorded cheaply for validation without turning the replay into state snapshots.

Replay files remain compressed external artifacts (`.ofr.zst`) rather than SQLite BLOBs. Ordinary replay retention is 90 days; pinned/benchmark replays may be retained indefinitely as specified by the persistence contract.'''
design = replace_once(design, old_replay, new_replay, "design replay contract")

memory_summary = r'''### 6.3 Persistent per-match controller memory

Each player controller has explicit deterministic **per-match persistent memory**. The exact V1 codec/lifecycle is defined by [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md).

The public memory shape is the existing JSON-like root object from `ControllerApi.ts`. V1 canonicalizes it to compact UTF-8 JSON with recursively sorted object keys, finite numbers only, array order preserved, and a hard **131,072-byte** canonical uncompressed limit. Unsupported/exotic values, cycles, sparse holes, and non-finite numbers are invalid.

Returned memory is whole-object replacement, not deep merge. Omitting `memory` preserves the prior committed value. Memory begins as `{}` for every new match, flows through Strategic Spawn into normal `decide()` callbacks, is private to that controller/faction, and never persists between matches.

A structurally valid callback may commit valid new memory even when one or more ordinary game-facing actions/directives are rejected by deterministic gameplay validation. Runtime faults, malformed whole output, invalid memory, or memory-limit violations discard that invocation's proposed memory and preserve the previous successfully committed memory.

Controllers must not rely on mutable module/global runtime state surviving between invocations. Only this explicit memory is guaranteed writable persistence.'''
design = replace_section(
    design,
    "### 6.3 Persistent per-match controller memory",
    "### 6.4 Decision-as-set semantics",
    memory_summary,
    "design controller memory",
)

transaction = r'''### 7.2 Transactional execution

Controller callback validity and game-state mutation validity are deliberately separated.

A successful callback must first produce one structurally valid output; any returned memory must pass the canonical codec/quota. Valid returned memory then commits according to `CONTROLLER_MEMORY.md` even if later ordinary gameplay validation rejects a proposed action.

Game-facing persistent directive changes and one-shot commands are still validated against the immutable observation using their canonical transactional/final-desired-set semantics. The engine never silently normalizes an illegal game-state transaction merely to preserve part of it. Structured receipts report ordinary stale-state/legality rejection without turning that rejection into a controller runtime fault.

Population commitment changes from one valid committed game-facing decision take effect **immediately at that decision commit**. There is no Deployment/Redeployment delay system in V1.'''
design = replace_section(
    design,
    "### 7.2 Transactional execution",
    "### 7.3 Structured gameplay failure",
    transaction,
    "design transactional execution",
)

segment_summary = r'''### 9.3 Segments

A Segment is an immutable deterministic strategic geographic region generated/compiled with the map. The detailed accepted V1 generation and sizing contract is [`SEGMENTS.md`](./SEGMENTS.md).

Every real map cell belongs to exactly one Segment, including ordinary land, Shallow Water, Deep Water, and Impassable terrain. Every Segment is cardinally 4-connected: any member cell can reach every other member cell through north/south/east/west member-cell steps. Segment membership/IDs/adjacency do not change during a match, even if dynamic terrain/state changes later occur.

Segments are a query/index/strategy lens, **not a simulation bucket**. Segment borders have no intrinsic combat, capture, movement, economy, visibility, or other physical effect.

V1 targets roughly **4,096 cells per Segment only when geography offers no better boundary**. There is no hard minimum, maximum, aspect-ratio, or compactness rule. Geography and useful terrain/topology dominate size: coherent rivers/waterways, ridges, islands, passes, coasts, basins and similar features may produce very small, very large, extremely long/thin, or otherwise irregular Segments.

The compiler preserves strategically meaningful features but may absorb meaningless isolated raster noise. Feature-significance heuristics are deterministic/versioned map-compiler parameters; final compiled Segment membership is part of the map artifact/hash and is never silently regenerated for historical maps.

V1 exposes terrain summaries rather than semantic geographic tags such as `RIVER`, `RIDGE`, or `STRAIT`. Shallow Water/Deep Water and the existing terrain vocabulary must suffice for V1; geographic tags may be reconsidered in a future API version.'''
design = replace_section(
    design,
    "### 9.3 Segments",
    "### 9.4 Contacts",
    segment_summary,
    "design Segment section",
)

design = replace_once(
    design,
    "- exact deterministic controller-memory codec;\n- exact Segment generation/size heuristics within the accepted Segment ontology;\n",
    "",
    "design deferred memory/Segment bullets",
)

invariant_anchor = "78. **Factory Trains use finite multi-stop closed service tours at a provisional 25 cells/s: one primary Train per Factory, up to five deterministic target stations per route-construction pass, every actual City/Port pass produces an event and 1.5s dwell with no hard event cap, the Factory waits 5s after return/destruction, P07 adds one bonus Train every fourth primary dispatch, P33 adds `20 × City level` Capacity-capped Population per qualifying City event, and the ordinary Factory-level Train-event FFY ladder is `10,000 / 11,250 / 12,500 / 13,750 / 15,000`.**"
if invariant_anchor not in design:
    raise RuntimeError("design invariant 78 anchor not found")
design = design.replace(
    invariant_anchor,
    invariant_anchor
    + "\n79. **Controller memory uses the accepted canonical compact UTF-8 JSON whole-object replacement codec with a 128 KiB canonical-byte limit; valid memory may commit across ordinary gameplay rejection, while runtime/malformed-output faults preserve the previous committed memory.**"
    + "\n80. **Segments are immutable map-compiled cardinally connected geography-first strategic regions with a soft ~4,096-cell target and no hard size/aspect-ratio/compactness limits; final membership is versioned in the map artifact, and V1 adds no semantic geographic tags.**"
    + "\n81. **Canonical archival replays are minimal compressed deterministic input/action records with no periodic full-state seek checkpoints; playback fast-forwards the deterministic simulation from match start and does not require re-executing player controllers or persisting controller memory/debug state.**",
    1,
)

design_path.write_text(design)

# OPENFRONT_INTEGRATION_PLAN.md
integration_path = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")
integration = integration_path.read_text()

memory_impl = r'''### 5.5 Controller-memory codec and lifecycle — Accepted V1

Implement the exact controller-memory contract from [`CONTROLLER_MEMORY.md`](./CONTROLLER_MEMORY.md): canonical compact UTF-8 JSON; recursively sorted object keys; finite JSON values only; whole-object replacement; **131,072 canonical uncompressed bytes** maximum; no cross-match persistence.

The trusted runtime state is the canonical serialized representation, not a mutable JavaScript object surviving inside a worker/isolate. Decode a fresh immutable projection for each callback; validate/canonicalize returned memory before accepting it.

Once a callback/output/memory is structurally valid, valid returned memory commits independently of later ordinary gameplay legality rejection. Runtime faults, malformed whole outputs, invalid memory, and memory/quota violations discard all newly proposed output and preserve the previous successfully committed memory/directives. Spawn hooks use the same memory lifecycle and carry successfully committed memory forward into the first normal decision.

Do not write controller memory to SQLite every decision and do not include controller-memory snapshots in the canonical archival replay.'''
marker = "### 5.4 Deterministic parallel execution"
pos = integration.find(marker)
if pos < 0:
    raise RuntimeError("integration 5.4 marker missing")
next_sep = integration.find("\n---\n\n## 6.", pos)
if next_sep < 0:
    raise RuntimeError("integration section 6 boundary missing")
integration = integration[:next_sep] + "\n\n" + memory_impl + integration[next_sep:]

integration = replace_once(
    integration,
    "Exact growth geometry, collision/fallback algorithm, ordinary influence-area radius, minimum separation rules, base Initial Territory and starting Population values remain implementation/tuning details.",
    "Strategic Spawn's ordinary radius, spacing, controller-hook fallbacks, conflict graph/priority, nearest legal displacement, simultaneous footprint growth, star rasterization, diagnostics, replay encoding, and resolver-version rules are now accepted in `STRATEGIC_SPAWN.md`. Remaining work is implementation/validation against that specification rather than choosing those algorithms during coding.",
    "integration stale Strategic Spawn sentence",
)

segment_impl = r'''### 7.1 Segment layer — Accepted V1 generation contract

Add compact immutable Segment identity for every real map cell, including water and impassable terrain, plus immutable membership/adjacency and efficient runtime factual summaries.

Implement [`SEGMENTS.md`](./SEGMENTS.md) as the source of truth:

- each Segment is cardinally 4-connected;
- geography/terrain/topology coherence outranks size;
- **~4,096 cells is a soft target only**, with no hard minimum/maximum/aspect-ratio/compactness constraint;
- meaningful narrow/irregular features may remain correspondingly narrow/irregular;
- large featureless regions use deterministic geography-aware balanced subdivision toward the target;
- meaningless raster fragments may be absorbed deterministically without erasing useful geographic features;
- no match seed participates;
- stable IDs are assigned by smallest member `CellId` order;
- compiled membership + `segmentGeneratorVersion` are part of the map artifact/hash and are never regenerated under a newer algorithm for an old map version;
- V1 exposes existing terrain summaries and does not require semantic `RIVER`/`RIDGE`/`STRAIT` geographic tags.

Dynamic terrain/state changes such as Fallout/Deep-Water conversion do not regenerate Segment membership. Runtime terrain summaries may change over the fixed membership.

A temporary amphibious defensive state must not masquerade as a terrain type. The accepted fortified-landing design uses a real granted Fort instead, so terrain remains geography rather than short-lived tactical status.'''
integration = replace_section(
    integration,
    "### 7.1 Segment layer",
    "### 7.2 Terrain extension",
    segment_impl,
    "integration Segment layer",
)

replay_after = '''Ordinary file layout:

```text
data/replays/YYYY/MM/<match-public-id>.ofr.zst
```

Do not put multi-megabyte replay/debug payloads into SQLite BLOBs merely because SQLite can store them.'''
replay_new = '''Ordinary file layout:

```text
data/replays/YYYY/MM/<match-public-id>.ofr.zst
```

The canonical V1 replay payload is intentionally **minimal**. It stores the exact versioned match bindings, authoritative Strategic Spawn record, and the committed simulation-affecting game-facing input/action stream needed to replay the deterministic simulation from match start. It does not periodically serialize the 4.8-million-cell world for seeking.

Replay playback/seek therefore fast-forwards simulation from tick zero (without needing to render intermediate frames). V1 has no periodic full-state seek checkpoints in the archival `.ofr.zst` format.

Do not archive controller-memory snapshots, verbose controller logs/debug overlays, rejected no-effect proposals, browser render frames, or redundant per-tick derived state in the canonical replay. Detailed controller logs remain separate short-retention artifacts. Playback does not need to re-execute player controller code because committed game-facing outputs are already recorded.

Do not put multi-megabyte replay/debug payloads into SQLite BLOBs merely because SQLite can store them.'''
integration = replace_once(integration, replay_after, replay_new, "integration replay semantics")

integration = replace_once(
    integration,
    "1. **Controller API runtime wiring/certification** — the V1 TypeScript contract is now defined in `src/core/controller/ControllerApi.ts`; remaining work is implementing the immutable observation projection, validated directive/command adapter, sandbox bridge, certification harness, and later non-semantic ergonomic polish.",
    "1. **Controller API runtime wiring/certification** — the V1 TypeScript contract and controller-memory codec/lifecycle are now defined; remaining work is implementing the immutable observation projection, canonical memory adapter, validated directive/command adapter, sandbox bridge, certification harness, and later non-semantic ergonomic polish.",
    "integration remaining item 1",
)

integration = replace_once(
    integration,
    "13. **Low-level implementation/versioning details for the settled Strategic Spawn resolver** — exact queue/data-structure/hash representation, map-validation diagnostics, and replay/version encoding. The 400-cell influence radius, 50-cell foreign-origin spacing, deterministic collision fallback, quota-limited footprint rules, P39 split profile, P54 star profile, and five-second immunity are already settled gameplay rules in `STRATEGIC_SPAWN.md`.\n14. **Optional ruleset minutiae not yet pinned**, especially water-nuke conversion geometry.",
    "13. **Strategic Spawn implementation/validation** — implement the now-closed `STRATEGIC_SPAWN.md` V1 resolver contract, including hook defaults, stable deterministic tie hashing, conflict components, nearest fallback, simultaneous footprint queues, replay/diagnostic encoding, version binding, and adversarial map validation.\n14. **Segment compiler implementation/validation** — implement the now-closed geography-first `SEGMENTS.md` compiler and map-artifact representation, then inspect representative generated maps for useful strategic segmentation without turning the soft 4,096-cell target into a hard geometry constraint.\n15. **Optional ruleset minutiae not yet pinned**, especially water-nuke conversion geometry.",
    "integration remaining spawn/segments items",
)

integration = replace_once(
    integration,
    "The following are no longer open design questions and must be implemented from their canonical appendices rather than re-derived from inherited OpenFront behavior: the 4.8m-cell map raster, 1,000-cell/50% start, Population growth/utilization curve, capture-progress and counter-response constants (`COMBAT_TUNING.md`), FFY/Trade/Train economics (`FFY_ECONOMY.md`), Strategic Spawn geometry (`STRATEGIC_SPAWN.md`), terrain/structures/Tank/Heavy-Artillery data (`TERRAIN_AND_STRUCTURES.md`), Warship/Transport/Port-repair and Atom/Hydrogen/MIRV data (`NAVAL_AND_STRATEGIC_WEAPONS.md`), Minor-Faction/Goon semantics (`MINOR_FACTIONS.md`), Official AI meta/reward settings, and the accepted Echo identity/naming/reward/Gacha rules.",
    "The following are no longer open design questions and must be implemented from their canonical documents rather than re-derived from inherited OpenFront behavior: the controller-memory codec/lifecycle (`CONTROLLER_MEMORY.md`), strategic Segment generation/representation (`SEGMENTS.md`), minimal fast-forward replay model, the 4.8m-cell map raster, 1,000-cell/50% start, Population growth/utilization curve, capture-progress and counter-response constants (`COMBAT_TUNING.md`), FFY/Trade/Train economics (`FFY_ECONOMY.md`), the complete Strategic Spawn resolver/geometry/versioning contract (`STRATEGIC_SPAWN.md`), terrain/structures/Tank/Heavy-Artillery data (`TERRAIN_AND_STRUCTURES.md`), Warship/Transport/Port-repair and Atom/Hydrogen/MIRV data (`NAVAL_AND_STRATEGIC_WEAPONS.md`), Minor-Faction/Goon semantics (`MINOR_FACTIONS.md`), Official AI meta/reward settings, and the accepted Echo identity/naming/reward/Gacha rules.",
    "integration no-longer-open summary",
)

integration_path.write_text(integration)

# STRATEGIC_SPAWN.md
spawn_path = Path("docs/STRATEGIC_SPAWN.md")
spawn = spawn_path.read_text()

resolver = r'''# 3. Deterministic exact-origin resolver

Exact origins resolve simultaneously; controller execution order never decides who wins a collision. The V1 resolver algorithm is versioned independently as:

```text
spawnResolverVersion = "1"
```

The match binds that version. Algorithm changes require a new resolver version; ordinary balance-number changes use the appropriate ruleset/catalogue version rather than silently redefining resolver `1`.

## 3.1 Stable deterministic tie primitive

Use one reusable non-cryptographic deterministic 32-bit tie primitive conceptually equivalent to:

```text
stableTie32(domain, spawnResolverVersion, matchSeed, ...canonical keys)
```

It must use fixed 32-bit integer operations with cross-platform deterministic output. It exists only to shuffle otherwise equal candidates; it is not a security hash.

Every ordering also has semantic fallback keys (such as `FactionId`, slot index, `CellId`) after the tie value so a hash collision can never make behavior undefined.

Cryptographic SHA-256 remains appropriate for stored integrity/cell-set hashes; that is a different purpose.

## 3.2 Hook defaults

Missing, malformed, rejected, or runtime-faulting Strategic Spawn hooks use these deterministic defaults:

- **`chooseInfluence()`**: for each required influence slot, choose a deterministic legal spawn-seed cell ranked from the compiled legal-seed set using match seed + faction ID + slot + resolver version. Multi-slot profiles choose distinct fallback centers. Using a legal seed as center guarantees at least one legal origin candidate lies inside the area.
- **`reconsiderInfluence()`**: retain that faction's successfully resolved Phase-1 influence center(s) unchanged.
- **`chooseOrigins()`**: for each required slot, choose the legal origin inside its final influence region nearest to that influence center, using the canonical tie ordering below.

A hook fallback does not by itself fault the controller for normal match play. Successfully committed controller memory from earlier lifecycle callbacks remains available under `CONTROLLER_MEMORY.md`.

## 3.3 Conflict graph and priority

If all requested exact origins already satisfy legality/spacing, retain them exactly.

Otherwise construct an undirected conflict graph over requested origins. An edge exists between two **foreign-faction** origin slots whose requested cells violate:

```text
distance² < 2,500
```

P39 same-faction origins do not receive a foreign-spacing edge, but they must remain distinct legal cells.

Resolve each connected conflict component using priority sorted by:

```text
stableTie32("exact-origin-priority", version, matchSeed, factionId, originSlot)
factionId
originSlot
```

The first legal origin in that order keeps its requested cell. Each later origin is resolved against already resolved foreign origins.

## 3.4 Nearest in-region fallback

For a displaced otherwise well-formed requested origin, scan legal candidate cells inside that slot's final influence region and choose the minimum tuple:

```text
(
  squaredEuclideanDistanceFromRequestedOrigin,
  stableTie32("exact-origin-cell", version, matchSeed, factionId, originSlot, cellId),
  cellId
)
```

A candidate must:

1. be a valid map cell and legal Initial-Territory seed terrain;
2. lie inside that slot's own final influence region;
3. remain at least 50 cells from every already resolved foreign-faction origin;
4. not duplicate another origin slot of the same faction.

Because the ordinary influence radius is only 400 cells, exhaustive bounded scanning is preferred over a more complex spatial structure unless profiling later proves it necessary.

If the hook output is structurally malformed (wrong count, invalid/non-cell IDs, etc.), use the Phase-3 hook default rather than inventing geometric displacement from an invalid request.

## 3.5 Global emergency fallback

If no valid candidate exists inside a final influence region, search the compiled global legal-spawn seed set deterministically, preserving foreign 50-cell spacing where possible and prioritizing candidates nearest that influence center with the same stable tie mechanism.

This is an emergency map/ruleset-defect path, not expected ordinary behavior. It must emit an explicit diagnostic and must never hang/fault the match.'''
spawn = replace_section(spawn, "# 3. Deterministic exact-origin conflict resolution", "# 4. Ordinary Initial-Territory footprint", resolver, "spawn resolver section")

footprint = r'''# 4. Ordinary Initial-Territory footprint resolver

The exact origin is a **seed**, not permission for the controller to hand-paint starting territory.

Ordinary V1 Initial Territory remains **1,000 population-bearing cells** before explicit surfaced modifiers. After all Initial-Territory modifiers are applied, the final value is the target number of population-bearing cells that the generated starting footprint must contain.

All faction footprints use one deterministic **round-based simultaneous multi-frontier resolver**. Each footprint owns:

```text
resolved origin
population-bearing quota
shape profile
claimed-cell set
candidate frontier priority queue
population-bearing claimed count
```

The origin is the first claimed cell and its legal cardinal neighbors seed that footprint's frontier.

## 4.1 Compact candidate priority

For an ordinary compact footprint, candidates use:

```text
(
  squaredEuclideanDistanceFromOrigin,
  stableTie32("spawn-compact-cell", version, matchSeed, factionId, footprintSlot, cellId),
  cellId
)
```

A candidate must be legally ownable starting geography and cardinally adjacent to that footprint's already claimed cells. The adjacency requirement prevents teleporting across barriers; geography naturally deforms the otherwise approximately circular growth.

## 4.2 Simultaneous growth rounds

In each resolver round every unfinished footprint proposes its best currently unclaimed legal frontier candidate. Stale/already-claimed candidates are discarded from that queue until a live proposal exists or the frontier is exhausted.

Group proposals by `CellId`.

- one proposal: that footprint claims the cell;
- multiple proposals from foreign factions: winner is selected by deterministic tuple

```text
(
  stableTie32("spawn-footprint-cell", version, matchSeed, cellId, factionId, footprintSlot),
  factionId,
  footprintSlot
)
```

All round winners commit simultaneously, then their newly exposed cardinal neighbors enter the appropriate frontiers.

No faction receives a complete 1,000-cell footprint before another faction begins growing. Source/controller execution order never creates starting-territory priority.

## 4.3 Quota semantics

- population-bearing claimed cells consume the Initial-Territory quota;
- legal ownable `0 Capacity` terrain such as ordinary Tundra/Shallow Water may be claimed while traversing/growing and does **not** consume the population-bearing quota;
- Deep Water/Impassable and other non-ownable barriers are never painted merely to preserve a visual shape;
- if one candidate/arm is blocked, the frontier continues elsewhere until the population-bearing quota is filled whenever reachable legal geography exists.

If a footprint exhausts all legal reachable frontier candidates before filling quota, emit `FOOTPRINT_QUOTA_UNFILLABLE`; validated production maps should make this impossible for legal configurations.

## 4.4 P39 split footprints

P39 first computes the faction's final modified total Initial Territory, then divides the population-bearing quota approximately equally between primary and secondary origins. An odd one-cell remainder goes to the deterministic primary origin.

The two same-faction footprint queues still grow separately under the simultaneous resolver. If both propose the same cell, deterministic footprint-slot ordering decides which queue receives that cell for quota/frontier accounting; politically the cell belongs to the same faction either way. The losing queue continues elsewhere.

Starting Population remains one global pool calculated from the final total Initial Territory. P39 never creates local Population pools.'''
spawn = replace_section(spawn, "# 4. Ordinary Initial-Territory footprint", "# 5. P54 — star-shaped Initial Territory", footprint, "spawn footprint section")

old_star = '''## 5.2 Raster/geography construction

The generator scales/rasterizes the ideal star envelope outward from the exact origin until the connected legal footprint contains the faction's required population-bearing quota.

The same quota rules as ordinary spawning apply:

- population-bearing cells consume quota;
- naturally included ownable `0 Capacity` cells do not consume quota;
- barriers/topology may deform individual arms;
- the generator continues expanding the star profile where legal geography exists rather than reducing the faction's Initial Territory merely because one point hits water/Impassable terrain;
- simultaneous foreign-faction footprint collisions use the same deterministic cell resolver as ordinary spawning.'''
new_star = '''## 5.2 Raster/geography construction

P54 uses the same connected simultaneous frontier resolver as ordinary spawning, but replaces the compact radial priority with one canonical versioned **fixed-point five-point-star shape score**.

Resolver version `1` commits one ten-vertex normalized star template: five alternating outer/inner vertices, map-north outer-point orientation, and the accepted `6:1` outer-tip-to-inner-valley ratio. The implementation must use committed integer/fixed-point template constants rather than platform runtime trigonometry so rasterization is byte-for-byte deterministic.

For a candidate offset `(dx, dy)`, compute the minimum fixed-point scale at which that offset lies inside the canonical star polygon. Candidate ordering is then:

```text
(
  starScaleScore,
  stableTie32("spawn-star-cell", version, matchSeed, factionId, footprintSlot, cellId),
  cellId
)
```

The candidate must still be cardinally adjacent to the already claimed footprint, so geography/barriers can bend, blunt, or waste an arm rather than allowing disconnected painted territory.

The same quota and simultaneous-collision rules as ordinary spawning apply:

- population-bearing cells consume quota;
- naturally included ownable `0 Capacity` cells do not consume quota;
- barriers/topology may deform individual arms;
- the frontier continues through other legal candidates rather than reducing the faction's Initial Territory merely because one point hits water/Impassable terrain;
- simultaneous foreign-faction cell collisions use the Section 4 resolver.'''
spawn = replace_once(spawn, old_star, new_star, "spawn star raster section")

validation_marker = "# 7. Validation expectations"
if validation_marker not in spawn:
    raise RuntimeError("spawn validation marker missing")
versioning = r'''# 7. Resolver diagnostics, replay, and version binding

The resolver emits stable machine-readable diagnostics rather than relying on prose logs.

Exact-origin/hook reason codes include at least:

```text
ORIGIN_ACCEPTED
ORIGIN_OUTSIDE_INFLUENCE
ORIGIN_ILLEGAL_TERRAIN
ORIGIN_DUPLICATE_OWN_SLOT
ORIGIN_FOREIGN_SPACING_CONFLICT
ORIGIN_IN_REGION_FALLBACK
ORIGIN_GLOBAL_FALLBACK
HOOK_MISSING
HOOK_MALFORMED
HOOK_RUNTIME_FAULT
```

Footprint summary codes include:

```text
FOOTPRINT_COMPLETE
FOOTPRINT_QUOTA_UNFILLABLE
```

Per-footprint diagnostics should retain compact summaries such as:

```text
populationBearingQuota
populationBearingClaimed
totalCellsClaimed
zeroCapacityCellsClaimed
contestsWon
contestsLost
boundingBox
cellSetSha256
```

Do not log every routine cell contest. A small bounded representative conflict sample may be retained for debugger presentation.

## 7.1 Replay representation

The minimal archival replay records Strategic Spawn semantic inputs and authoritative outputs because they are tiny and useful for independent verification:

```text
spawnResolverVersion
Phase-1 submitted/resolved influence centers
Phase-2 submitted/resolved/final revealed influence centers
Phase-3 requested exact origins
resolved exact origins + fallback reason codes
per-footprint quota + shape
final resolved starting cell IDs
cell-set SHA-256
```

Final footprint cell IDs are sorted ascending, delta-encoded, and compressed inside the `.ofr.zst` replay. Starting footprints are spatially coherent and only thousands of cells per faction, so this remains small while allowing playback to restore the exact authoritative starting state.

SQLite `match_factions.spawn_snapshot_json` should retain compact semantic/resolution summaries and cell-set hashes; the replay file carries the full footprint cell list.

Determinism tests may independently regenerate the spawn from map + match seed + bound rules/Origins + submissions + resolver version and compare the regenerated cell sets/hashes to the authoritative replay record.

---

# 8. Validation expectations'''
spawn = spawn.replace(validation_marker, versioning, 1)

spawn = spawn.replace(
    "Retuning radius, pointiness, or spacing after map benchmarks is ordinary balance/geometry iteration; silent sequential spawn priority or arbitrary controller-painted starting territory is not.",
    "Retuning radius, pointiness, or spacing after map benchmarks is ordinary versioned balance/geometry iteration. Changing resolver ordering/hash/fallback/rasterization semantics requires an explicit new `spawnResolverVersion`; silent sequential spawn priority or arbitrary controller-painted starting territory is never permitted.",
    1,
)
spawn_path.write_text(spawn)

# Maps.md
maps_path = Path("docs/Maps.md")
maps_text = maps_path.read_text()
maps_text = replace_once(
    maps_text,
    "This fixed physical resolution is intended to keep cell-space mechanics—movement speeds, structure radii, weapon/blast geometry, railway distances, spawn footprints, and similar rules—comparable across maps while still allowing maps to have very different terrain/population-capacity identities.",
    "This fixed physical resolution is intended to keep cell-space mechanics—movement speeds, structure radii, weapon/blast geometry, railway distances, spawn footprints, and similar rules—comparable across maps while still allowing maps to have very different terrain/population-capacity identities. The accepted Open Fufu Segment compilation contract is maintained in [`SEGMENTS.md`](./SEGMENTS.md).",
    "Maps Segment link",
)
maps_text = replace_once(
    maps_text,
    "The inherited tooling may need adaptation so generated Open Fufu maps satisfy the fixed 4.8-million-cell contract and later Open Fufu Segment/terrain-generation requirements.",
    "The inherited tooling must be adapted so generated Open Fufu maps satisfy the fixed 4.8-million-cell contract and compile the accepted geography-first Segment layer from `SEGMENTS.md` into the versioned/map-hashed artifact.",
    "Maps stale later Segment wording",
)
maps_path.write_text(maps_text)

# Repository-wide stale/contradiction checks over documentation.
stale = {
    "rolled back on failure/rejection": "old controller-memory rollback semantics",
    "exact deterministic controller-memory codec": "memory codec still marked deferred",
    "exact Segment generation/size heuristics": "Segments still marked deferred",
    "The exact hash/RNG representation is implementation/versioning detail": "spawn hash still open",
    "Exact growth geometry, collision/fallback algorithm": "spawn resolver still open",
    "Low-level implementation/versioning details for the settled Strategic Spawn resolver": "spawn resolver listed as open details",
    "later Open Fufu Segment/terrain-generation requirements": "Maps still calls Segment contract future",
}
all_docs = "\n".join(p.read_text(errors="ignore") for p in Path("docs").glob("*.md"))
for phrase, label in stale.items():
    if phrase in all_docs:
        raise RuntimeError(f"stale documentation survived ({label}): {phrase}")

required = {
    "CONTROLLER_MEMORY.md": ["canonical compact UTF-8 JSON", "131,072", "whole-object replacement", "ordinary gameplay acceptance"],
    "SEGMENTS.md": ["4,096", "no hard minimum", "cardinally 4-connected", "geography outranks size", "does **not** add semantic geographic tags"],
    "STRATEGIC_SPAWN.md": ["spawnResolverVersion = \"1\"", "stableTie32", "round-based simultaneous multi-frontier resolver", "ORIGIN_GLOBAL_FALLBACK", "delta-encoded"],
    "OPEN_FUFU_DESIGN.md": ["Minimal archival replay", "fast-forwards", "CONTROLLER_MEMORY.md", "SEGMENTS.md"],
    "OPENFRONT_INTEGRATION_PLAN.md": ["minimal", "canonical memory adapter", "Segment compiler implementation/validation"],
}
for filename, needles in required.items():
    body = Path("docs", filename).read_text()
    for needle in needles:
        if needle not in body:
            raise RuntimeError(f"{filename}: required accepted specification missing: {needle}")
