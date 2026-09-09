import {
  OWNERSHIP_PLANE_SCHEMA_VERSION,
  OwnershipPlaneCache,
  OwnershipPlanePublisher,
  decodeOwnershipFrame,
} from "../src/participant/OwnershipPlane";
import { OwnershipFanout } from "../src/server/participant/OwnershipFanout";

const V1_CELL_COUNT = 4_800_000;
const OWNERSHIP_MAGIC = [0x4f, 0x46, 0x4f, 0x50] as const;

function requirePublication<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected ownership publication");
  }
  return value;
}

function alternatingOwnership(cellCount: number): (string | null)[] {
  const ownership = new Array<string | null>(cellCount);
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    ownership[cellId] = cellId % 2 === 0 ? "alpha" : "beta";
  }
  return ownership;
}

function encodeVaruint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= 0x80) {
    bytes.push((remaining % 0x80) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }
  bytes.push(remaining);
  return bytes;
}

function canonicalPaletteBytes(count: number): number[] {
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const owner = encoder.encode(`owner-${index.toString().padStart(3, "0")}`);
    bytes.push(...encodeVaruint(owner.byteLength), ...owner);
  }
  return bytes;
}

function malformedHugeRleSnapshot(): Uint8Array {
  const paletteCount = 256;
  return Uint8Array.from([
    ...OWNERSHIP_MAGIC,
    OWNERSHIP_PLANE_SCHEMA_VERSION,
    0,
    ...encodeVaruint(1),
    ...encodeVaruint(V1_CELL_COUNT),
    ...encodeVaruint(paletteCount),
    ...canonicalPaletteBytes(paletteCount),
    1,
    ...encodeVaruint(1),
    ...encodeVaruint(1),
    ...encodeVaruint(0),
  ]);
}

function malformedHugeSparseDelta(): Uint8Array {
  return Uint8Array.from([
    ...OWNERSHIP_MAGIC,
    OWNERSHIP_PLANE_SCHEMA_VERSION,
    1,
    ...encodeVaruint(2),
    ...encodeVaruint(V1_CELL_COUNT),
    ...encodeVaruint(0),
    ...encodeVaruint(1),
    ...encodeVaruint(V1_CELL_COUNT),
    ...encodeVaruint(1),
    ...encodeVaruint(0),
    0,
    ...encodeVaruint(V1_CELL_COUNT),
  ]);
}

function captureTypedArrayLengthAllocations(
  key: "Uint16Array" | "Uint32Array",
  callback: () => void,
): readonly number[] {
  const globals = globalThis as unknown as Record<string, unknown>;
  const original = globals[key] as Function;
  const allocations: number[] = [];
  const replacement = new Proxy(original, {
    construct(target, args) {
      if (typeof args[0] === "number") allocations.push(args[0]);
      return Reflect.construct(target, args, target);
    },
  });
  globals[key] = replacement;
  try {
    callback();
  } finally {
    globals[key] = original;
  }
  return allocations;
}

function sequenceOnlyEnvelope(streamId: string, seq: number) {
  return { streamId, seq, tick: 0 } satisfies Parameters<
    OwnershipPlaneCache["applyEnvelope"]
  >[0];
}

describe("participant ownership-plane synchronization", () => {
  it("reconstructs an exact 4.8M-cell complete baseline without rich per-cell records", () => {
    const ownership = new Array<string | null>(V1_CELL_COUNT).fill(null);
    ownership[0] = "alpha";
    ownership[2_400_000] = "beta";
    ownership[V1_CELL_COUNT - 1] = "alpha";

    const publisher = new OwnershipPlanePublisher();
    publisher.observe(Object.freeze(ownership), 0);
    const baseline = requirePublication(publisher.flush());

    expect(baseline.schemaVersion).toBe(OWNERSHIP_PLANE_SCHEMA_VERSION);
    expect(baseline.kind).toBe("SNAPSHOT");
    expect(baseline.tick).toBe(0);
    expect(baseline.revision).toBe(1);
    expect(baseline.stats.cellCount).toBe(V1_CELL_COUNT);
    expect(baseline.stats.richCellRecords).toBe(0);

    const decoded = decodeOwnershipFrame(baseline.bytes);
    expect(decoded.kind).toBe("SNAPSHOT");
    expect(decoded.cellCount).toBe(V1_CELL_COUNT);

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-a", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-a",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(cache.tick()).toBe(0);
    expect(cache.cellCount()).toBe(V1_CELL_COUNT);
    expect(cache.ownerAt(0)).toBe("alpha");
    expect(cache.ownerAt(1)).toBeNull();
    expect(cache.ownerAt(2_400_000)).toBe("beta");
    expect(cache.ownerAt(V1_CELL_COUNT - 1)).toBe("alpha");
  }, 20_000);

  it("uses a compact sparse chunk update for low churn and reconstructs exactly", () => {
    const initial = Object.freeze(alternatingOwnership(8_192));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 1_024 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const next = initial.slice();
    next[18] = "beta";
    next[2_050] = null;
    next[8_190] = "beta";
    publisher.observe(Object.freeze(next), 0);
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    expect(delta.baseRevision).toBe(1);
    expect(delta.revision).toBe(2);
    expect(delta.chunkModes).toContain("SPARSE");
    expect(delta.stats.encodedBytes).toBeLessThan(
      delta.stats.fullReplacementEncodedBytes,
    );

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-a", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-a",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({
        streamId: "stream-a",
        seq: 3,
        tick: delta.tick,
        bytes: delta.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(17)).toBe("beta");
    expect(cache.ownerAt(18)).toBe("beta");
    expect(cache.ownerAt(2_050)).toBeNull();
    expect(cache.ownerAt(8_190)).toBe("beta");
  });

  it("uses run encoding for a large contiguous change", () => {
    const initialMutable = alternatingOwnership(16_384);
    initialMutable.fill("alpha", 4_096, 8_192);
    const initial = Object.freeze(initialMutable);
    const publisher = new OwnershipPlanePublisher({ chunkSize: 4_096 });
    publisher.observe(initial, 0);
    requirePublication(publisher.flush());

    const next = initial.slice();
    next.fill("beta", 4_400, 7_600);
    publisher.observe(Object.freeze(next), 0);
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    expect(delta.chunkModes).toContain("RUN");
    expect(delta.stats.encodedBytes).toBeLessThan(
      delta.stats.richJsonEstimateBytes,
    );
  });

  it("falls back to a complete replacement when near-global churn is cheaper", () => {
    const initialMutable = new Array<string | null>(V1_CELL_COUNT).fill("alpha");
    initialMutable[V1_CELL_COUNT - 1] = "beta";
    const initial = Object.freeze(initialMutable);
    const publisher = new OwnershipPlanePublisher();
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const next = alternatingOwnership(V1_CELL_COUNT);
    publisher.observe(Object.freeze(next), 0);
    const replacement = requirePublication(publisher.flush());

    expect(replacement.kind).toBe("SNAPSHOT");
    expect(replacement.revision).toBe(2);
    expect(replacement.stats.encodedBytes).toBeLessThanOrEqual(
      replacement.stats.incrementalCandidateBytes,
    );

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-heavy", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-heavy",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({
        streamId: "stream-heavy",
        seq: 3,
        tick: replacement.tick,
        bytes: replacement.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(0)).toBe("alpha");
    expect(cache.ownerAt(1)).toBe("beta");
    expect(cache.ownerAt(V1_CELL_COUNT - 1)).toBe("beta");

    console.info(
      "ownership-sync benchmark",
      JSON.stringify({
        initial: baseline.stats,
        nearGlobal: replacement.stats,
      }),
    );
  }, 20_000);

  it("coalesces multiple observed internal transitions to the final published owner", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const first = initial.slice();
    first[2] = "beta";
    publisher.observe(Object.freeze(first), 0);
    const second = first.slice();
    second[2] = null;
    publisher.observe(Object.freeze(second), 0);
    const final = second.slice();
    final[2] = "beta";
    publisher.observe(Object.freeze(final), 0);
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-c", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-c",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({
        streamId: "stream-c",
        seq: 3,
        tick: delta.tick,
        bytes: delta.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(2)).toBe("beta");
    expect(publisher.flush()).toBeNull();
  });

  it("tracks participant sequence across non-ownership envelopes without inventing ownership gaps", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());
    const next = initial.slice();
    next[2] = "beta";
    publisher.observe(Object.freeze(next), 0);
    const delta = requirePublication(publisher.flush());

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-interleaved", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-interleaved",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-interleaved", 3))).toEqual({
      ok: true,
      revision: 1,
    });
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-interleaved", 4))).toEqual({
      ok: true,
      revision: 1,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-interleaved",
        seq: 5,
        tick: delta.tick,
        bytes: delta.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(2)).toBe("beta");
  });

  it("fails closed across sequence and ownership-revision gaps without partial mutation", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const first = initial.slice();
    first[2] = "beta";
    publisher.observe(Object.freeze(first), 0);
    const firstDelta = requirePublication(publisher.flush());
    const second = first.slice();
    second[4] = "beta";
    publisher.observe(Object.freeze(second), 0);
    const secondDelta = requirePublication(publisher.flush());

    expect(firstDelta.kind).toBe("DELTA");
    expect(secondDelta.kind).toBe("DELTA");

    const sequenceGap = new OwnershipPlaneCache();
    expect(sequenceGap.applyEnvelope(sequenceOnlyEnvelope("stream-gap", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      sequenceGap.applyEnvelope({
        streamId: "stream-gap",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      sequenceGap.applyEnvelope({
        streamId: "stream-gap",
        seq: 4,
        tick: firstDelta.tick,
        bytes: firstDelta.bytes,
      }),
    ).toEqual({ ok: false, reason: "SEQUENCE_GAP", resyncRequired: true });
    expect(sequenceGap.revision()).toBe(1);
    expect(sequenceGap.ownerAt(2)).toBe("alpha");
    expect(
      sequenceGap.applyEnvelope({
        streamId: "stream-gap",
        seq: 3,
        tick: firstDelta.tick,
        bytes: firstDelta.bytes,
      }),
    ).toEqual({ ok: false, reason: "RESYNC_REQUIRED", resyncRequired: true });

    const revisionGap = new OwnershipPlaneCache();
    expect(revisionGap.applyEnvelope(sequenceOnlyEnvelope("stream-rev", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      revisionGap.applyEnvelope({
        streamId: "stream-rev",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      revisionGap.applyEnvelope({
        streamId: "stream-rev",
        seq: 3,
        tick: secondDelta.tick,
        bytes: secondDelta.bytes,
      }),
    ).toEqual({
      ok: false,
      reason: "REVISION_MISMATCH",
      resyncRequired: true,
    });
    expect(revisionGap.revision()).toBe(1);
    expect(revisionGap.ownerAt(4)).toBe("alpha");
  });

  it("replays retained same-stream envelopes only after server-approved resume", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const first = initial.slice();
    first[2] = "beta";
    publisher.observe(Object.freeze(first), 0);
    const firstDelta = requirePublication(publisher.flush());
    const second = first.slice();
    second[4] = "beta";
    publisher.observe(Object.freeze(second), 0);
    const secondDelta = requirePublication(publisher.flush());

    expect(firstDelta.kind).toBe("DELTA");
    expect(secondDelta.kind).toBe("DELTA");

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-retained", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-retained",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({
        streamId: "stream-retained",
        seq: 4,
        tick: secondDelta.tick,
        bytes: secondDelta.bytes,
      }),
    ).toEqual({ ok: false, reason: "SEQUENCE_GAP", resyncRequired: true });
    expect(cache.revision()).toBe(1);

    const resumable = cache as unknown as {
      acceptResume(streamId: string, afterSeq: number): boolean;
    };
    expect(resumable.acceptResume("other-stream", 2)).toBe(false);
    expect(resumable.acceptResume("stream-retained", 1)).toBe(false);
    expect(resumable.acceptResume("stream-retained", 2)).toBe(true);

    expect(
      cache.applyEnvelope({
        streamId: "stream-retained",
        seq: 3,
        tick: firstDelta.tick,
        bytes: firstDelta.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(
      cache.applyEnvelope({
        streamId: "stream-retained",
        seq: 4,
        tick: secondDelta.tick,
        bytes: secondDelta.bytes,
      }),
    ).toEqual({ ok: true, revision: 3 });
    expect(cache.ownerAt(2)).toBe("beta");
    expect(cache.ownerAt(4)).toBe("beta");
  });

  it("rejects attacker-declared decode sizes before allocating from those counts", () => {
    const snapshot = malformedHugeRleSnapshot();
    const snapshotAllocations = captureTypedArrayLengthAllocations("Uint16Array", () => {
      expect(() => decodeOwnershipFrame(snapshot)).toThrow();
    });
    expect(snapshotAllocations).not.toContain(V1_CELL_COUNT);

    const sparseDelta = malformedHugeSparseDelta();
    const sparseAllocations = captureTypedArrayLengthAllocations("Uint32Array", () => {
      expect(() => decodeOwnershipFrame(sparseDelta)).toThrow();
    });
    expect(sparseAllocations).not.toContain(V1_CELL_COUNT);
  });

  it("rejects truncated ownership data before mutating the installed logical plane", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());
    const next = initial.slice();
    next[2] = "beta";
    publisher.observe(Object.freeze(next), 0);
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("stream-malformed", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "stream-malformed",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });

    const truncated = delta.bytes.slice(0, Math.max(0, delta.bytes.length - 1));
    expect(
      cache.applyEnvelope({
        streamId: "stream-malformed",
        seq: 3,
        tick: delta.tick,
        bytes: truncated,
      }),
    ).toEqual({ ok: false, reason: "INVALID_PAYLOAD", resyncRequired: true });
    expect(cache.revision()).toBe(1);
    expect(cache.ownerAt(2)).toBe("alpha");
  });

  it("fails closed for malformed envelope containers and requires a fresh stream after corruption", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const malformedContainer = new OwnershipPlaneCache();
    expect(malformedContainer.applyEnvelope(null as never)).toEqual({
      ok: false,
      reason: "INVALID_PAYLOAD",
      resyncRequired: true,
    });

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("new-stream", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "new-stream",
        seq: 2,
        tick: 0,
        bytes: Uint8Array.of(0),
      }),
    ).toEqual({ ok: false, reason: "INVALID_PAYLOAD", resyncRequired: true });
    expect(
      cache.applyEnvelope({
        streamId: "new-stream",
        seq: 3,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: false, reason: "RESYNC_REQUIRED", resyncRequired: true });
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("fresh-stream", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "fresh-stream",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
  });

  it("installs a fresh replacement stream after a resync without replaying match history", () => {
    const initial = Object.freeze(alternatingOwnership(128));
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const next = initial.slice();
    next[0] = "beta";
    next[2] = "beta";
    publisher.observe(Object.freeze(next), 0);
    requirePublication(publisher.flush());
    const fresh = publisher.currentSnapshot();

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("old-stream", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "old-stream",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(cache.applyEnvelope(sequenceOnlyEnvelope("new-stream", 1))).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "new-stream",
        seq: 2,
        tick: fresh.tick,
        bytes: fresh.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.ownerAt(0)).toBe("beta");
    expect(cache.ownerAt(2)).toBe("beta");
  });

  it("fans one public ownership publication out identically and forces slow viewers to resync synchronously", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(["alpha", null, "beta", null]), 0);
    const publication = requirePublication(publisher.flush());
    expect(publication.tick).toBe(0);

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
