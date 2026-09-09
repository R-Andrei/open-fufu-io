import {
  OWNERSHIP_PLANE_SCHEMA_VERSION,
  OwnershipPlaneCache,
  OwnershipPlanePublisher,
  decodeOwnershipFrame,
  type DecodedOwnershipFrame,
  type OwnershipPublication,
} from "../src/participant/OwnershipPlane";

const V1_CELL_COUNT = 4_800_000;

function requirePublication(
  publication: OwnershipPublication | null,
): OwnershipPublication {
  if (publication === null) throw new Error("expected ownership publication");
  return publication;
}

function decodedTypedArrayBytes(frame: DecodedOwnershipFrame): number {
  if (frame.kind === "SNAPSHOT") return frame.codes.byteLength;
  let bytes = 0;
  for (const chunk of frame.chunks) {
    if (chunk.mode === "SPARSE") {
      bytes += chunk.offsets.byteLength + chunk.codes.byteLength;
    } else if (chunk.mode === "RUN") {
      bytes += chunk.runs.byteLength;
    } else {
      bytes += chunk.codes.byteLength;
    }
  }
  return bytes;
}

function decodeBenchmark(publication: OwnershipPublication) {
  const started = performance.now();
  const decoded = decodeOwnershipFrame(publication.bytes);
  const decodeMs = performance.now() - started;
  return {
    decoded,
    decodeMs,
    decodedTypedArrayBytes: decodedTypedArrayBytes(decoded),
  };
}

function assertCacheMatches(
  cache: OwnershipPlaneCache,
  expected: readonly (string | null)[],
): void {
  expect(cache.cellCount()).toBe(expected.length);
  for (let cellId = 0; cellId < expected.length; cellId += 1) {
    expect(cache.ownerAt(cellId)).toBe(expected[cellId]);
  }
}

function alternatingOwnership(cellCount: number): (string | null)[] {
  const ownership = new Array<string | null>(cellCount);
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    ownership[cellId] = cellId % 2 === 0 ? "alpha" : "beta";
  }
  return ownership;
}

function invertedOwnership(cellCount: number): (string | null)[] {
  const ownership = new Array<string | null>(cellCount);
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    ownership[cellId] = cellId % 2 === 0 ? "beta" : "alpha";
  }
  return ownership;
}

describe("ownership-plane adversarial certification", () => {
  it("rejects a fresh ownership stream that skips ordered sequence one", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    publisher.observe(Object.freeze(alternatingOwnership(128)), 0);
    const baseline = requirePublication(publisher.flush());

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({
        streamId: "fresh-gap",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: false, reason: "SEQUENCE_GAP", resyncRequired: true });
    expect(cache.revision()).toBe(0);
    expect(cache.cellCount()).toBe(0);
  });

  it("binds a coalesced ownership publication to the authoritative tick of its final observation", () => {
    const publisher = new OwnershipPlanePublisher({ chunkSize: 32 });
    const initial = Object.freeze(alternatingOwnership(128));
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());
    expect(baseline.tick).toBe(0);

    const first = initial.slice();
    first[2] = "beta";
    publisher.observe(Object.freeze(first), 4);
    const second = first.slice();
    second[2] = null;
    publisher.observe(Object.freeze(second), 4);
    const final = second.slice();
    final[2] = "beta";
    publisher.observe(Object.freeze(final), 5);

    const delta = requirePublication(publisher.flush());
    expect(delta.tick).toBe(5);
    expect(delta.revision).toBe(2);
    expect(() => publisher.observe(Object.freeze(final.slice()), 4)).toThrow(
      /tick must not regress/,
    );
    expect(() => publisher.observe(Object.freeze(final.slice()), -1)).toThrow(
      /non-negative safe integer/,
    );

    const cache = new OwnershipPlaneCache();
    expect(
      cache.applyEnvelope({ streamId: "tick-bound", seq: 1, tick: 0 }),
    ).toEqual({ ok: true, revision: 0 });
    expect(
      cache.applyEnvelope({
        streamId: "tick-bound",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(cache.tick()).toBe(0);
    expect(
      cache.applyEnvelope({ streamId: "tick-bound", seq: 3, tick: 4 }),
    ).toEqual({ ok: true, revision: 1 });
    expect(cache.tick()).toBe(0);
    expect(
      cache.applyEnvelope({
        streamId: "tick-bound",
        seq: 4,
        tick: delta.tick,
        bytes: delta.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    expect(cache.tick()).toBe(5);
    expect(cache.ownerAt(2)).toBe("beta");
    expect(
      cache.applyEnvelope({ streamId: "tick-bound", seq: 5, tick: 4 }),
    ).toEqual({ ok: false, reason: "INVALID_PAYLOAD", resyncRequired: true });
    expect(cache.tick()).toBe(5);
  });

  it("encodes identical logical revisions byte-for-byte deterministically", () => {
    const initial = Object.freeze(
      Array.from({ length: 8_192 }, (_, cellId) =>
        cellId % 5 === 0 ? "βeta" : cellId % 2 === 0 ? "zeta" : "alpha",
      ),
    );
    const nextMutable = initial.slice();
    nextMutable.fill("alpha", 1_024, 2_048);
    nextMutable[4_097] = "βeta";
    const next = Object.freeze(nextMutable);

    const publications: OwnershipPublication[][] = [];
    for (let run = 0; run < 3; run += 1) {
      const publisher = new OwnershipPlanePublisher({ chunkSize: 1_024 });
      publisher.observe(initial, 0);
      const baseline = requirePublication(publisher.flush());
      publisher.observe(next, 0);
      const delta = requirePublication(publisher.flush());
      publications.push([baseline, delta]);
    }

    for (let run = 1; run < publications.length; run += 1) {
      expect(publications[run][0].bytes).toEqual(publications[0][0].bytes);
      expect(publications[run][1].bytes).toEqual(publications[0][1].bytes);
      expect(publications[run][1].chunkModes).toEqual(
        publications[0][1].chunkModes,
      );
    }
  });

  it("selects and applies whole-chunk REPLACE when it is the cheapest incremental representation", () => {
    const cellCount = 16_384;
    const chunkSize = 4_096;
    const initialMutable = new Array<string | null>(cellCount).fill("alpha");
    initialMutable[cellCount - 1] = "beta";
    const initial = Object.freeze(initialMutable);

    const publisher = new OwnershipPlanePublisher({ chunkSize });
    publisher.observe(initial, 0);
    const baseline = requirePublication(publisher.flush());

    const nextMutable = initial.slice();
    for (let cellId = chunkSize; cellId < chunkSize * 2; cellId += 1) {
      nextMutable[cellId] = cellId % 2 === 0 ? "alpha" : "beta";
    }
    const next = Object.freeze(nextMutable);
    publisher.observe(next, 0);
    const delta = requirePublication(publisher.flush());

    expect(delta.kind).toBe("DELTA");
    expect(delta.chunkModes).toContain("REPLACE");
    expect(delta.stats.encodedBytes).toBeLessThan(
      delta.stats.fullReplacementEncodedBytes,
    );

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope({ streamId: "replace", seq: 1, tick: 0 })).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "replace",
        seq: 2,
        tick: baseline.tick,
        bytes: baseline.bytes,
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(
      cache.applyEnvelope({
        streamId: "replace",
        seq: 3,
        tick: delta.tick,
        bytes: delta.bytes,
      }),
    ).toEqual({ ok: true, revision: 2 });
    assertCacheMatches(cache, next);
  });

  it("rejects an unsupported ownership schema version before logical application", () => {
    const publisher = new OwnershipPlanePublisher();
    publisher.observe(Object.freeze(["alpha", null, "beta"]), 0);
    const baseline = requirePublication(publisher.flush());
    const unsupported = baseline.bytes.slice();
    unsupported[4] = OWNERSHIP_PLANE_SCHEMA_VERSION + 1;

    expect(() => decodeOwnershipFrame(unsupported)).toThrow(
      /unsupported ownership-plane schema version/,
    );

    const cache = new OwnershipPlaneCache();
    expect(cache.applyEnvelope({ streamId: "schema", seq: 1, tick: 0 })).toEqual({
      ok: true,
      revision: 0,
    });
    expect(
      cache.applyEnvelope({
        streamId: "schema",
        seq: 2,
        tick: baseline.tick,
        bytes: unsupported,
      }),
    ).toEqual({ ok: false, reason: "INVALID_PAYLOAD", resyncRequired: true });
    expect(cache.revision()).toBe(0);
    expect(cache.cellCount()).toBe(0);
  });

  it("benchmarks production-scale sparse, contiguous, and near-global churn across chunk sizes", () => {
    const chunkSizes = [1_024, 4_096, 16_384] as const;
    const rows: unknown[] = [];

    for (const chunkSize of chunkSizes) {
      const publisher = new OwnershipPlanePublisher({ chunkSize });
      let current = alternatingOwnership(V1_CELL_COUNT);
      publisher.observe(Object.freeze(current), 0);
      const baseline = requirePublication(publisher.flush());
      const baselineDecoded = decodeBenchmark(baseline);
      expect(baselineDecoded.decoded.kind).toBe("SNAPSHOT");
      expect(baseline.stats.rawPlaneBytes).toBe(V1_CELL_COUNT);
      expect(baselineDecoded.decodedTypedArrayBytes).toBe(V1_CELL_COUNT);
      rows.push({
        chunkSize,
        case: "baseline",
        kind: baseline.kind,
        changedCells: baseline.stats.changedCells,
        encodedBytes: baseline.stats.encodedBytes,
        rawPlaneBytes: baseline.stats.rawPlaneBytes,
        encodeMs: baseline.stats.encodeMs,
        decodeMs: Number(baselineDecoded.decodeMs.toFixed(3)),
        decodedTypedArrayBytes: baselineDecoded.decodedTypedArrayBytes,
        logicalPlaneBytes: V1_CELL_COUNT,
      });

      let next = current.slice();
      for (let index = 0; index < 256; index += 1) {
        const cellId = Math.floor((index * (V1_CELL_COUNT - 1)) / 255);
        next[cellId] = next[cellId] === "alpha" ? "beta" : "alpha";
      }
      publisher.observe(Object.freeze(next), 0);
      const sparse = requirePublication(publisher.flush());
      const sparseDecoded = decodeBenchmark(sparse);
      expect(sparse.kind).toBe("DELTA");
      expect(sparse.chunkModes).toContain("SPARSE");
      expect(sparse.stats.encodedBytes).toBeLessThan(
        sparse.stats.fullReplacementEncodedBytes,
      );
      rows.push({
        chunkSize,
        case: "sparse-256",
        kind: sparse.kind,
        changedCells: sparse.stats.changedCells,
        encodedBytes: sparse.stats.encodedBytes,
        rawPlaneBytes: sparse.stats.rawPlaneBytes,
        encodeMs: sparse.stats.encodeMs,
        decodeMs: Number(sparseDecoded.decodeMs.toFixed(3)),
        decodedTypedArrayBytes: sparseDecoded.decodedTypedArrayBytes,
        logicalPlaneBytes: V1_CELL_COUNT,
      });
      current = next;

      const contiguousStart = 1_200_000;
      const contiguousEnd = 1_800_000;
      next = current.slice();
      next.fill("alpha", contiguousStart, contiguousEnd);
      publisher.observe(Object.freeze(next), 0);
      requirePublication(publisher.flush());
      current = next;

      next = current.slice();
      next.fill("beta", contiguousStart, contiguousEnd);
      publisher.observe(Object.freeze(next), 0);
      const contiguous = requirePublication(publisher.flush());
      const contiguousDecoded = decodeBenchmark(contiguous);
      expect(contiguous.kind).toBe("DELTA");
      expect(contiguous.chunkModes).toContain("RUN");
      expect(contiguous.stats.changedCells).toBe(contiguousEnd - contiguousStart);
      expect(contiguous.stats.encodedBytes).toBeLessThan(
        contiguous.stats.richJsonEstimateBytes,
      );
      rows.push({
        chunkSize,
        case: "contiguous-600k",
        kind: contiguous.kind,
        changedCells: contiguous.stats.changedCells,
        encodedBytes: contiguous.stats.encodedBytes,
        rawPlaneBytes: contiguous.stats.rawPlaneBytes,
        encodeMs: contiguous.stats.encodeMs,
        decodeMs: Number(contiguousDecoded.decodeMs.toFixed(3)),
        decodedTypedArrayBytes: contiguousDecoded.decodedTypedArrayBytes,
        logicalPlaneBytes: V1_CELL_COUNT,
      });
      current = next;

      next = invertedOwnership(V1_CELL_COUNT);
      publisher.observe(Object.freeze(next), 0);
      const nearGlobal = requirePublication(publisher.flush());
      const nearGlobalDecoded = decodeBenchmark(nearGlobal);
      expect(nearGlobal.stats.changedCells).toBeGreaterThan(2_000_000);
      expect(nearGlobal.stats.encodedBytes).toBeLessThanOrEqual(
        nearGlobal.stats.fullReplacementEncodedBytes,
      );
      expect(nearGlobal.stats.encodedBytes).toBeLessThanOrEqual(
        nearGlobal.stats.incrementalCandidateBytes,
      );
      expect(nearGlobal.stats.encodedBytes).toBeLessThanOrEqual(
        nearGlobal.stats.rawPlaneBytes + 1_024,
      );
      rows.push({
        chunkSize,
        case: "near-global",
        kind: nearGlobal.kind,
        changedCells: nearGlobal.stats.changedCells,
        encodedBytes: nearGlobal.stats.encodedBytes,
        rawPlaneBytes: nearGlobal.stats.rawPlaneBytes,
        encodeMs: nearGlobal.stats.encodeMs,
        decodeMs: Number(nearGlobalDecoded.decodeMs.toFixed(3)),
        decodedTypedArrayBytes: nearGlobalDecoded.decodedTypedArrayBytes,
        logicalPlaneBytes: V1_CELL_COUNT,
      });
    }

    console.info("ownership-sync certification benchmark", JSON.stringify(rows));
  }, 40_000);
});
