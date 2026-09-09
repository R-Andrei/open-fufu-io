import {
  OWNERSHIP_PLANE_SCHEMA_VERSION,
  OwnershipPlaneCache,
  OwnershipPlanePublisher,
  decodeOwnershipFrame,
} from "../src/participant/OwnershipPlane";
import { OwnershipFanout } from "../src/server/participant/OwnershipFanout";

const V1_CELL_COUNT = 4_800_000;

function requirePublication<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected ownership publication");
  }
  return value;
}

describe("participant ownership-plane synchronization", () => {
  it("reconstructs an exact 4.8M-cell complete baseline without rich per-cell records", () => {
    const ownership = new Array<string | null>(V1_CELL_COUNT).fill(null);
    ownership[0] = "alpha";
    ownership[2_400_000] = "beta";
    ownership[V1_CELL_COUNT - 1] = "alpha";

    const publisher = new OwnershipPlanePublisher();
    publisher.observe(Object.freeze(ownership));
    const baseline = requirePublication(publisher.flush());

    expect(baseline.schemaVersion).toBe(OWNERSHIP_PLANE_SCHEMA_VERSION);
    expect(baseline.kind).toBe("SNAPSHOT");
    expect(baseline.revision).toBe(1);
    expect(baseline.stats.cellCount).toBe(V1_CELL_COUNT);
    expect(baseline.stats.richCellRecords).toBe(0);

    const decoded = decodeOwnershipFrame(baseline.bytes);
    expect(decoded.kind).toBe("SNAPSHOT");
    expect(decoded.cellCount).toBe(V1_CELL_COUNT);

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "stream-a", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(cache.cellCount()).toBe(V1_CELL_COUNT);
    expect(cache.ownerAt(0)).toBe("alpha");
    expect(cache.ownerAt(1)).toBeNull();
    expect(cache.ownerAt(2_400_000)).toBe("beta");
    expect(cache.ownerAt(V1_CELL_COUNT - 1)).toBe("alpha");
  }, 20_000);

  it("uses a compact sparse chunk update for low churn and reconstructs exactly", () => {
    const initial = Object.freeze(new Array<string | null>(8_192).fill("alpha"));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 1_024 });
    publisher.observe(initial);
    const baseline = requirePublication(publisher.flush());

    const next = initial.slice();
    next[17] = "beta";
    next[2_050] = null;
    next[8_191] = "beta";
    publisher.observe(Object.freeze(next));
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    expect(delta.baseRevision).toBe(1);
    expect(delta.revision).toBe(2);
    expect(delta.chunkModes).toContain("SPARSE");
    expect(delta.stats.encodedBytes).toBeLessThan(
      delta.stats.fullReplacementEncodedBytes,
    );

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "stream-a", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({ streamId: "stream-a", seq: 3, bytes: delta.bytes }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(16)).toBe("alpha");
    expect(cache.ownerAt(17)).toBe("beta");
    expect(cache.ownerAt(2_050)).toBeNull();
    expect(cache.ownerAt(8_191)).toBe("beta");
  });

  it("uses run encoding for a large contiguous change", () => {
    const initial = Object.freeze(new Array<string | null>(16_384).fill("alpha"));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 4_096 });
    publisher.observe(initial);
    requirePublication(publisher.flush());

    const next = initial.slice();
    next.fill("beta", 4_400, 7_600);
    publisher.observe(Object.freeze(next));
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    expect(delta.chunkModes).toContain("RUN");
    expect(delta.stats.encodedBytes).toBeLessThan(
      delta.stats.richJsonEstimateBytes,
    );
  });

  it("falls back to a complete replacement when near-global churn is cheaper", () => {
    const initial = Object.freeze(new Array<string | null>(V1_CELL_COUNT).fill("alpha"));
    const publisher = new OwnershipPlanePublisher();
    publisher.observe(initial);
    const baseline = requirePublication(publisher.flush());

    const next = new Array<string | null>(V1_CELL_COUNT);
    for (let cellId = 0; cellId < V1_CELL_COUNT; cellId += 1) {
      next[cellId] = cellId % 2 === 0 ? "beta" : null;
    }
    publisher.observe(Object.freeze(next));
    const replacement = requirePublication(publisher.flush());

    expect(replacement.kind).toBe("SNAPSHOT");
    expect(replacement.revision).toBe(2);
    expect(replacement.stats.encodedBytes).toBeLessThanOrEqual(
      replacement.stats.incrementalCandidateBytes,
    );

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "stream-heavy", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({
        streamId: "stream-heavy",
        seq: 3,
        bytes: replacement.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(0)).toBe("beta");
    expect(cache.ownerAt(1)).toBeNull();
    expect(cache.ownerAt(V1_CELL_COUNT - 1)).toBeNull();

    console.info(
      "ownership-sync benchmark",
      JSON.stringify({
        initial: baseline.stats,
        nearGlobal: replacement.stats,
      }),
    );
  }, 20_000);

  it("coalesces multiple observed internal transitions to the final published owner", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(["alpha", "alpha", null, null]));
    const baseline = requirePublication(publisher.flush());

    publisher.observe(Object.freeze(["alpha", "beta", null, null]));
    publisher.observe(Object.freeze(["alpha", null, null, null]));
    publisher.observe(Object.freeze(["alpha", "beta", null, null]));
    const delta = requirePublication(publisher.flush());

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "stream-c", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({ streamId: "stream-c", seq: 3, bytes: delta.bytes }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(1)).toBe("beta");
    expect(publisher.flush()).toBeNull();
  });

  it("fails closed across sequence and ownership-revision gaps without partial mutation", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(["alpha", "alpha", "alpha", "alpha"]));
    const baseline = requirePublication(publisher.flush());

    publisher.observe(Object.freeze(["alpha", "beta", "alpha", "alpha"]));
    const firstDelta = requirePublication(publisher.flush());
    publisher.observe(Object.freeze(["alpha", "beta", "beta", "alpha"]));
    const secondDelta = requirePublication(publisher.flush());

    const sequenceGap = new OwnershipPlaneCache();
    expect(
      sequenceGap.applyEnvelope({ streamId: "stream-gap", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      sequenceGap.applyEnvelope({
        streamId: "stream-gap",
        seq: 4,
        bytes: firstDelta.bytes,
      }),
    ).toEqual({ ok: false, reason: "SEQUENCE_GAP", resyncRequired: true });
    expect(sequenceGap.revision()).toBe(1);
    expect(sequenceGap.ownerAt(1)).toBe("alpha");
    expect(
      sequenceGap.applyEnvelope({
        streamId: "stream-gap",
        seq: 3,
        bytes: firstDelta.bytes,
      }),
    ).toEqual({ ok: false, reason: "RESYNC_REQUIRED", resyncRequired: true });

    const revisionGap = new OwnershipPlaneCache();
    expect(
      revisionGap.applyEnvelope({ streamId: "stream-rev", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      revisionGap.applyEnvelope({
        streamId: "stream-rev",
        seq: 3,
        bytes: secondDelta.bytes,
      }),
    ).toEqual({
      ok: false,
      reason: "REVISION_MISMATCH",
      resyncRequired: true,
    });
    expect(revisionGap.revision()).toBe(1);
    expect(revisionGap.ownerAt(2)).toBe("alpha");
  });

  it("rejects truncated ownership data before mutating the installed logical plane", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(["alpha", null, null, null]));
    const baseline = requirePublication(publisher.flush());
    publisher.observe(Object.freeze(["alpha", "beta", null, null]));
    const delta = requirePublication(publisher.flush());

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "stream-malformed", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });

    const truncated = delta.bytes.slice(0, Math.max(0, delta.bytes.length - 1));
    expect(
      cache.applyEnvelope({
        streamId: "stream-malformed",
        seq: 3,
        bytes: truncated,
      }),
    ).toEqual({ ok: false, reason: "INVALID_PAYLOAD", resyncRequired: true });
    expect(cache.revision()).toBe(1);
    expect(cache.ownerAt(1)).toBeNull();
  });

  it("installs a fresh replacement stream after a resync without replaying match history", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(["alpha", null, null, null]));
    const baseline = requirePublication(publisher.flush());

    publisher.observe(Object.freeze(["beta", "beta", null, null]));
    requirePublication(publisher.flush());
    const fresh = publisher.currentSnapshot();

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "old-stream", seq: 2, bytes: baseline.bytes }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({ streamId: "new-stream", seq: 2, bytes: fresh.bytes }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(0)).toBe("beta");
    expect(cache.ownerAt(1)).toBe("beta");
  });

  it("fans one public ownership publication out identically and forces slow viewers to resync synchronously", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(["alpha", null, "beta", null]));
    const publication = requirePublication(publisher.flush());

    const fastA: unknown[] = [];
    const fastB: unknown[] = [];
    let slowResyncs = 0;
    const fanout = new OwnershipFanout();
    fanout.addSink("participant-a", {
      tryEnqueue(value) {
        fastA.push(value);
        return true;
      },
      requestResync() {},
    });
    fanout.addSink("spectator-b", {
      tryEnqueue(value) {
        fastB.push(value);
        return true;
      },
      requestResync() {},
    });
    fanout.addSink("slow-c", {
      tryEnqueue() {
        return false;
      },
      requestResync() {
        slowResyncs += 1;
      },
    });

    const result = fanout.publish(publication);
    expect(result).toEqual({ delivered: 2, resyncRequired: 1 });
    expect(result).not.toBeInstanceOf(Promise);
    expect(fastA).toHaveLength(1);
    expect(fastB).toHaveLength(1);
    expect(fastA[0]).toBe(fastB[0]);
    expect(slowResyncs).toBe(1);
  });
});
