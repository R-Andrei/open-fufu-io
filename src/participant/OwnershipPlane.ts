export const OWNERSHIP_PLANE_SCHEMA_VERSION = 1;
export const MAX_OWNERSHIP_CELL_COUNT = 4_800_000;

const MAGIC = Uint8Array.of(0x4f, 0x46, 0x4f, 0x50);
const FRAME_SNAPSHOT = 0;
const FRAME_DELTA = 1;
const SNAPSHOT_RAW = 0;
const SNAPSHOT_RLE = 1;
const CHUNK_SPARSE = 0;
const CHUNK_RUN = 1;
const CHUNK_REPLACE = 2;
const DEFAULT_CHUNK_SIZE = 4_096;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

type OwnerCodePlane = Uint8Array | Uint16Array | Uint32Array;
export type OwnershipChunkMode = "SPARSE" | "RUN" | "REPLACE";

export type OwnershipPublicationStats = Readonly<{
  cellCount: number;
  changedCells: number;
  changedChunks: number;
  chunkSize: number;
  encodedBytes: number;
  rawPlaneBytes: number;
  fullReplacementEncodedBytes: number;
  incrementalCandidateBytes: number;
  richJsonEstimateBytes: number;
  richCellRecords: 0;
  encodeMs: number;
}>;

export type OwnershipPublication = Readonly<{
  schemaVersion: number;
  kind: "SNAPSHOT" | "DELTA";
  tick: number;
  revision: number;
  baseRevision?: number;
  bytes: Uint8Array;
  chunkModes: readonly OwnershipChunkMode[];
  stats: OwnershipPublicationStats;
}>;

export type DecodedOwnershipSnapshot = Readonly<{
  schemaVersion: number;
  kind: "SNAPSHOT";
  revision: number;
  cellCount: number;
  palette: readonly string[];
  codes: OwnerCodePlane;
}>;

type DecodedSparseChunk = Readonly<{
  chunkIndex: number;
  mode: "SPARSE";
  offsets: Uint32Array;
  codes: Uint32Array;
}>;

type DecodedRunChunk = Readonly<{
  chunkIndex: number;
  mode: "RUN";
  runs: Uint32Array;
}>;

type DecodedReplaceChunk = Readonly<{
  chunkIndex: number;
  mode: "REPLACE";
  codes: OwnerCodePlane;
}>;

type DecodedDeltaChunk = DecodedSparseChunk | DecodedRunChunk | DecodedReplaceChunk;

export type DecodedOwnershipDelta = Readonly<{
  schemaVersion: number;
  kind: "DELTA";
  revision: number;
  baseRevision: number;
  cellCount: number;
  chunkSize: number;
  palette: readonly string[];
  chunks: readonly DecodedDeltaChunk[];
}>;

export type DecodedOwnershipFrame = DecodedOwnershipSnapshot | DecodedOwnershipDelta;

class ByteWriter {
  private buffer: Uint8Array;
  private used = 0;

  constructor(initialCapacity = 256) {
    this.buffer = new Uint8Array(Math.max(1, initialCapacity));
  }

  byte(value: number): void {
    this.ensure(1);
    this.buffer[this.used] = value & 0xff;
    this.used += 1;
  }

  bytes(value: Uint8Array): void {
    this.ensure(value.byteLength);
    this.buffer.set(value, this.used);
    this.used += value.byteLength;
  }

  varuint(value: number): void {
    requireNonNegativeSafeInteger(value, "varuint");
    let remaining = value;
    while (remaining >= 0x80) {
      const low = remaining % 0x80;
      this.byte(low | 0x80);
      remaining = Math.floor(remaining / 0x80);
    }
    this.byte(remaining);
  }

  ownerCode(value: number, width: 1 | 2 | 4): void {
    if (width === 1) {
      this.byte(value);
      return;
    }
    if (width === 2) {
      this.byte(value);
      this.byte(value >>> 8);
      return;
    }
    this.byte(value);
    this.byte(value >>> 8);
    this.byte(value >>> 16);
    this.byte(value >>> 24);
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.used);
  }

  private ensure(extra: number): void {
    const required = this.used + extra;
    if (required <= this.buffer.byteLength) return;
    let nextLength = this.buffer.byteLength;
    while (nextLength < required) {
      nextLength = Math.max(required, nextLength * 2);
    }
    const next = new Uint8Array(nextLength);
    next.set(this.buffer.subarray(0, this.used));
    this.buffer = next;
  }
}

class ByteReader {
  private offset = 0;

  constructor(private readonly bytesValue: Uint8Array) {}

  get remaining(): number {
    return this.bytesValue.byteLength - this.offset;
  }

  get position(): number {
    return this.offset;
  }

  byte(): number {
    this.requireAvailable(1);
    const value = this.bytesValue[this.offset];
    this.offset += 1;
    return value;
  }

  bytes(length: number): Uint8Array {
    requireNonNegativeSafeInteger(length, "byte length");
    this.requireAvailable(length);
    const value = this.bytesValue.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  varuint(): number {
    let value = 0;
    let multiplier = 1;
    for (let index = 0; index < 8; index += 1) {
      const current = this.byte();
      value += (current & 0x7f) * multiplier;
      if (!Number.isSafeInteger(value)) {
        throw new Error("varuint exceeds safe integer range");
      }
      if ((current & 0x80) === 0) return value;
      multiplier *= 0x80;
      if (!Number.isSafeInteger(multiplier)) break;
    }
    throw new Error("invalid varuint");
  }

  ownerCode(width: 1 | 2 | 4): number {
    if (width === 1) return this.byte();
    const b0 = this.byte();
    const b1 = this.byte();
    if (width === 2) return b0 | (b1 << 8);
    const b2 = this.byte();
    const b3 = this.byte();
    return b0 + b1 * 0x100 + b2 * 0x10000 + b3 * 0x1000000;
  }

  rewind(position: number): void {
    requireNonNegativeSafeInteger(position, "reader position");
    if (position > this.bytesValue.byteLength) {
      throw new RangeError("reader position exceeds payload");
    }
    this.offset = position;
  }

  done(): boolean {
    return this.offset === this.bytesValue.byteLength;
  }

  private requireAvailable(length: number): void {
    if (length > this.remaining) throw new Error("truncated ownership payload");
  }
}

function requireNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function ownerCodeWidth(paletteLength: number): 1 | 2 | 4 {
  if (paletteLength <= 0xff) return 1;
  if (paletteLength <= 0xffff) return 2;
  return 4;
}

function allocateOwnerCodePlane(
  cellCount: number,
  paletteLength: number,
): OwnerCodePlane {
  if (paletteLength <= 0xff) return new Uint8Array(cellCount);
  if (paletteLength <= 0xffff) return new Uint16Array(cellCount);
  return new Uint32Array(cellCount);
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const common = Math.min(left.byteLength, right.byteLength);
  for (let index = 0; index < common; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.byteLength - right.byteLength;
}

function paletteFromOwnership(
  ownership: readonly (string | null)[],
): readonly string[] {
  const unique = new Map<string, Uint8Array>();
  for (const owner of ownership) {
    if (owner === null) continue;
    if (typeof owner !== "string") {
      throw new TypeError("ownership entries must be strings or null");
    }
    if (!unique.has(owner)) unique.set(owner, textEncoder.encode(owner));
  }
  const palette = [...unique.entries()]
    .sort((left, right) => compareBytes(left[1], right[1]))
    .map(([owner]) => owner);
  return Object.freeze(palette);
}

function palettesEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function ownershipToCodes(
  ownership: readonly (string | null)[],
  palette: readonly string[],
): OwnerCodePlane {
  if (ownership.length > MAX_OWNERSHIP_CELL_COUNT) {
    throw new RangeError(
      `ownership plane exceeds ${MAX_OWNERSHIP_CELL_COUNT} cells`,
    );
  }
  const codeByOwner = new Map<string, number>();
  for (let index = 0; index < palette.length; index += 1) {
    codeByOwner.set(palette[index], index + 1);
  }
  const codes = allocateOwnerCodePlane(ownership.length, palette.length);
  for (let cellId = 0; cellId < ownership.length; cellId += 1) {
    const owner = ownership[cellId];
    if (owner === null) continue;
    const code = codeByOwner.get(owner);
    if (code === undefined) throw new Error("owner missing from palette");
    codes[cellId] = code;
  }
  return codes;
}

function codePlanesEqual(left: OwnerCodePlane, right: OwnerCodePlane): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function writeHeader(
  writer: ByteWriter,
  kind: 0 | 1,
  revision: number,
  cellCount: number,
  palette: readonly string[],
): void {
  writer.bytes(MAGIC);
  writer.byte(OWNERSHIP_PLANE_SCHEMA_VERSION);
  writer.byte(kind);
  writer.varuint(revision);
  writer.varuint(cellCount);
  writer.varuint(palette.length);
  for (const owner of palette) {
    const encoded = textEncoder.encode(owner);
    writer.varuint(encoded.byteLength);
    writer.bytes(encoded);
  }
}

function snapshotRawBody(
  codes: OwnerCodePlane,
  paletteLength: number,
): Uint8Array {
  const width = ownerCodeWidth(paletteLength);
  const writer = new ByteWriter(2 + codes.length * width);
  writer.byte(SNAPSHOT_RAW);
  writer.byte(width);
  for (let index = 0; index < codes.length; index += 1) {
    writer.ownerCode(codes[index], width);
  }
  return writer.finish();
}

function snapshotRleBody(codes: OwnerCodePlane): Uint8Array {
  let runCount = 0;
  for (let start = 0; start < codes.length; ) {
    const code = codes[start];
    let end = start + 1;
    while (end < codes.length && codes[end] === code) end += 1;
    runCount += 1;
    start = end;
  }
  const writer = new ByteWriter();
  writer.byte(SNAPSHOT_RLE);
  writer.varuint(runCount);
  for (let start = 0; start < codes.length; ) {
    const code = codes[start];
    let end = start + 1;
    while (end < codes.length && codes[end] === code) end += 1;
    writer.varuint(end - start);
    writer.varuint(code);
    start = end;
  }
  return writer.finish();
}

function encodeSnapshot(
  revision: number,
  cellCount: number,
  palette: readonly string[],
  codes: OwnerCodePlane,
): Uint8Array {
  const raw = snapshotRawBody(codes, palette.length);
  const rle = snapshotRleBody(codes);
  const body = rle.byteLength < raw.byteLength ? rle : raw;
  const writer = new ByteWriter(body.byteLength + 64);
  writeHeader(writer, FRAME_SNAPSHOT, revision, cellCount, palette);
  writer.bytes(body);
  return writer.finish();
}

function encodeSparseCandidate(
  previous: OwnerCodePlane,
  next: OwnerCodePlane,
  start: number,
  end: number,
): Uint8Array {
  let count = 0;
  for (let cellId = start; cellId < end; cellId += 1) {
    if (previous[cellId] !== next[cellId]) count += 1;
  }
  const writer = new ByteWriter();
  writer.byte(CHUNK_SPARSE);
  writer.varuint(count);
  for (let cellId = start; cellId < end; cellId += 1) {
    if (previous[cellId] === next[cellId]) continue;
    writer.varuint(cellId - start);
    writer.varuint(next[cellId]);
  }
  return writer.finish();
}

function encodeRunCandidate(
  previous: OwnerCodePlane,
  next: OwnerCodePlane,
  start: number,
  end: number,
): Uint8Array {
  let runCount = 0;
  for (let cellId = start; cellId < end; ) {
    if (previous[cellId] === next[cellId]) {
      cellId += 1;
      continue;
    }
    const code = next[cellId];
    let runEnd = cellId + 1;
    while (
      runEnd < end &&
      previous[runEnd] !== next[runEnd] &&
      next[runEnd] === code
    ) {
      runEnd += 1;
    }
    runCount += 1;
    cellId = runEnd;
  }
  const writer = new ByteWriter();
  writer.byte(CHUNK_RUN);
  writer.varuint(runCount);
  for (let cellId = start; cellId < end; ) {
    if (previous[cellId] === next[cellId]) {
      cellId += 1;
      continue;
    }
    const code = next[cellId];
    let runEnd = cellId + 1;
    while (
      runEnd < end &&
      previous[runEnd] !== next[runEnd] &&
      next[runEnd] === code
    ) {
      runEnd += 1;
    }
    writer.varuint(cellId - start);
    writer.varuint(runEnd - cellId);
    writer.varuint(code);
    cellId = runEnd;
  }
  return writer.finish();
}

function encodeReplaceCandidate(
  next: OwnerCodePlane,
  paletteLength: number,
  start: number,
  end: number,
): Uint8Array {
  const width = ownerCodeWidth(paletteLength);
  const writer = new ByteWriter(3 + (end - start) * width);
  writer.byte(CHUNK_REPLACE);
  writer.byte(width);
  writer.varuint(end - start);
  for (let cellId = start; cellId < end; cellId += 1) {
    writer.ownerCode(next[cellId], width);
  }
  return writer.finish();
}

function modeForCode(code: number): OwnershipChunkMode {
  if (code === CHUNK_SPARSE) return "SPARSE";
  if (code === CHUNK_RUN) return "RUN";
  return "REPLACE";
}

function estimateRichJsonBytes(
  changedCells: number,
  cellCount: number,
  paletteLength: number,
): number {
  if (changedCells === 0) return 0;
  const cellDigits = Math.max(1, String(Math.max(0, cellCount - 1)).length);
  const ownerDigits = Math.max(1, String(paletteLength).length);
  return changedCells * (26 + cellDigits + ownerDigits);
}

type DeltaEncoding = Readonly<{
  bytes: Uint8Array;
  changedCells: number;
  changedChunks: number;
  chunkModes: readonly OwnershipChunkMode[];
}>;

function encodeDelta(
  baseRevision: number,
  revision: number,
  palette: readonly string[],
  previous: OwnerCodePlane,
  next: OwnerCodePlane,
  chunkSize: number,
): DeltaEncoding {
  const chunks: Array<
    Readonly<{
      index: number;
      body: Uint8Array;
      mode: OwnershipChunkMode;
    }>
  > = [];
  let changedCells = 0;
  const chunkCount = Math.ceil(next.length / chunkSize);
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(next.length, start + chunkSize);
    let chunkChanged = 0;
    for (let cellId = start; cellId < end; cellId += 1) {
      if (previous[cellId] !== next[cellId]) chunkChanged += 1;
    }
    if (chunkChanged === 0) continue;
    changedCells += chunkChanged;
    const candidates = [
      encodeSparseCandidate(previous, next, start, end),
      encodeRunCandidate(previous, next, start, end),
      encodeReplaceCandidate(next, palette.length, start, end),
    ];
    let bestIndex = 0;
    for (let index = 1; index < candidates.length; index += 1) {
      if (candidates[index].byteLength < candidates[bestIndex].byteLength) {
        bestIndex = index;
      }
    }
    chunks.push(
      Object.freeze({
        index: chunkIndex,
        body: candidates[bestIndex],
        mode: modeForCode(bestIndex),
      }),
    );
  }

  const writer = new ByteWriter();
  writeHeader(writer, FRAME_DELTA, revision, next.length, palette);
  writer.varuint(baseRevision);
  writer.varuint(chunkSize);
  writer.varuint(chunks.length);
  for (const chunk of chunks) {
    writer.varuint(chunk.index);
    writer.bytes(chunk.body);
  }
  return Object.freeze({
    bytes: writer.finish(),
    changedCells,
    changedChunks: chunks.length,
    chunkModes: Object.freeze(chunks.map((chunk) => chunk.mode)),
  });
}

function readMagic(reader: ByteReader): void {
  for (const byte of MAGIC) {
    if (reader.byte() !== byte) {
      throw new Error("invalid ownership payload magic");
    }
  }
}

function readPalette(reader: ByteReader, cellCount: number): readonly string[] {
  const count = reader.varuint();
  if (count > cellCount) throw new Error("ownership palette exceeds cell count");
  if (count > reader.remaining) {
    throw new Error("truncated ownership palette");
  }
  const palette: string[] = [];
  const seen = new Set<string>();
  let previousEncoded: Uint8Array | undefined;
  for (let index = 0; index < count; index += 1) {
    const byteLength = reader.varuint();
    const encoded = reader.bytes(byteLength);
    const owner = textDecoder.decode(encoded);
    if (seen.has(owner)) throw new Error("duplicate ownership palette entry");
    if (
      previousEncoded !== undefined &&
      compareBytes(previousEncoded, encoded) >= 0
    ) {
      throw new Error("ownership palette is not canonically ordered");
    }
    seen.add(owner);
    palette.push(owner);
    previousEncoded = encoded.slice();
  }
  return Object.freeze(palette);
}

function validateCode(code: number, paletteLength: number): void {
  if (!Number.isInteger(code) || code < 0 || code > paletteLength) {
    throw new Error("ownership owner code exceeds palette");
  }
}

function readSnapshotCodes(
  reader: ByteReader,
  cellCount: number,
  paletteLength: number,
): OwnerCodePlane {
  const mode = reader.byte();
  if (mode === SNAPSHOT_RAW) {
    const width = reader.byte();
    const expectedWidth = ownerCodeWidth(paletteLength);
    if (width !== expectedWidth) {
      throw new Error("non-canonical ownership code width");
    }
    const required = cellCount * expectedWidth;
    if (!Number.isSafeInteger(required) || reader.remaining < required) {
      throw new Error("truncated ownership raw plane");
    }
    const codes = allocateOwnerCodePlane(cellCount, paletteLength);
    for (let cellId = 0; cellId < cellCount; cellId += 1) {
      const code = reader.ownerCode(expectedWidth);
      validateCode(code, paletteLength);
      codes[cellId] = code;
    }
    return codes;
  }
  if (mode !== SNAPSHOT_RLE) {
    throw new Error("unknown ownership snapshot mode");
  }

  const runCountPosition = reader.position;
  const runCount = reader.varuint();
  if (runCount > cellCount) {
    throw new Error("ownership run count exceeds cell count");
  }
  if (runCount > Math.floor(reader.remaining / 2)) {
    throw new Error("truncated ownership RLE");
  }
  let cellId = 0;
  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const length = reader.varuint();
    const code = reader.varuint();
    if (length <= 0 || length > cellCount - cellId) {
      throw new Error("invalid ownership run length");
    }
    validateCode(code, paletteLength);
    cellId += length;
  }
  if (cellId !== cellCount) {
    throw new Error("ownership RLE does not cover the plane");
  }
  const validatedEnd = reader.position;

  reader.rewind(runCountPosition);
  const confirmedRunCount = reader.varuint();
  const codes = allocateOwnerCodePlane(cellCount, paletteLength);
  cellId = 0;
  for (let runIndex = 0; runIndex < confirmedRunCount; runIndex += 1) {
    const length = reader.varuint();
    const code = reader.varuint();
    codes.fill(code, cellId, cellId + length);
    cellId += length;
  }
  if (reader.position !== validatedEnd) {
    throw new Error("ownership RLE validation cursor mismatch");
  }
  return codes;
}

function readSparseChunk(
  reader: ByteReader,
  chunkIndex: number,
  chunkCellCount: number,
  paletteLength: number,
): DecodedSparseChunk {
  const countPosition = reader.position;
  const count = reader.varuint();
  if (count > chunkCellCount) {
    throw new Error("sparse ownership patch exceeds chunk");
  }
  if (count > Math.floor(reader.remaining / 2)) {
    throw new Error("truncated sparse ownership patch");
  }
  let previousOffset = -1;
  for (let index = 0; index < count; index += 1) {
    const offset = reader.varuint();
    const code = reader.varuint();
    if (offset >= chunkCellCount || offset <= previousOffset) {
      throw new Error("sparse ownership offsets must be ordered and unique");
    }
    validateCode(code, paletteLength);
    previousOffset = offset;
  }
  const validatedEnd = reader.position;

  reader.rewind(countPosition);
  const confirmedCount = reader.varuint();
  const offsets = new Uint32Array(confirmedCount);
  const codes = new Uint32Array(confirmedCount);
  for (let index = 0; index < confirmedCount; index += 1) {
    offsets[index] = reader.varuint();
    codes[index] = reader.varuint();
  }
  if (reader.position !== validatedEnd) {
    throw new Error("sparse ownership validation cursor mismatch");
  }
  return Object.freeze({ chunkIndex, mode: "SPARSE", offsets, codes });
}

function readRunChunk(
  reader: ByteReader,
  chunkIndex: number,
  chunkCellCount: number,
  paletteLength: number,
): DecodedRunChunk {
  const countPosition = reader.position;
  const count = reader.varuint();
  if (count > chunkCellCount) {
    throw new Error("ownership run patch exceeds chunk");
  }
  if (count > Math.floor(reader.remaining / 3)) {
    throw new Error("truncated ownership run patch");
  }
  let previousEnd = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = reader.varuint();
    const length = reader.varuint();
    const code = reader.varuint();
    if (
      length <= 0 ||
      offset < previousEnd ||
      offset + length > chunkCellCount
    ) {
      throw new Error("ownership runs overlap or exceed chunk");
    }
    validateCode(code, paletteLength);
    previousEnd = offset + length;
  }
  const validatedEnd = reader.position;

  reader.rewind(countPosition);
  const confirmedCount = reader.varuint();
  const runs = new Uint32Array(confirmedCount * 3);
  for (let index = 0; index < confirmedCount; index += 1) {
    const base = index * 3;
    runs[base] = reader.varuint();
    runs[base + 1] = reader.varuint();
    runs[base + 2] = reader.varuint();
  }
  if (reader.position !== validatedEnd) {
    throw new Error("ownership run validation cursor mismatch");
  }
  return Object.freeze({ chunkIndex, mode: "RUN", runs });
}

function readReplaceChunk(
  reader: ByteReader,
  chunkIndex: number,
  chunkCellCount: number,
  paletteLength: number,
): DecodedReplaceChunk {
  const width = reader.byte();
  const expectedWidth = ownerCodeWidth(paletteLength);
  if (width !== expectedWidth) {
    throw new Error("non-canonical ownership replacement width");
  }
  const encodedCellCount = reader.varuint();
  if (encodedCellCount !== chunkCellCount) {
    throw new Error("ownership replacement has wrong chunk length");
  }
  const required = chunkCellCount * expectedWidth;
  if (!Number.isSafeInteger(required) || reader.remaining < required) {
    throw new Error("truncated ownership replacement");
  }
  const codes = allocateOwnerCodePlane(chunkCellCount, paletteLength);
  for (let index = 0; index < chunkCellCount; index += 1) {
    const code = reader.ownerCode(expectedWidth);
    validateCode(code, paletteLength);
    codes[index] = code;
  }
  return Object.freeze({ chunkIndex, mode: "REPLACE", codes });
}

export function decodeOwnershipFrame(
  bytes: Uint8Array,
  expectedCellCount?: number,
): DecodedOwnershipFrame {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("ownership payload must be Uint8Array");
  }
  if (expectedCellCount !== undefined) {
    requirePositiveSafeInteger(expectedCellCount, "expected ownership cell count");
    if (expectedCellCount > MAX_OWNERSHIP_CELL_COUNT) {
      throw new RangeError("expected ownership cell count exceeds V1 bounds");
    }
  }
  const reader = new ByteReader(bytes);
  readMagic(reader);
  const schemaVersion = reader.byte();
  if (schemaVersion !== OWNERSHIP_PLANE_SCHEMA_VERSION) {
    throw new Error("unsupported ownership-plane schema version");
  }
  const kind = reader.byte();
  if (kind !== FRAME_SNAPSHOT && kind !== FRAME_DELTA) {
    throw new Error("unknown ownership frame kind");
  }
  const revision = reader.varuint();
  if (revision <= 0) throw new Error("ownership revision must be positive");
  const cellCount = reader.varuint();
  if (cellCount <= 0 || cellCount > MAX_OWNERSHIP_CELL_COUNT) {
    throw new Error("ownership cell count is outside V1 bounds");
  }
  if (expectedCellCount !== undefined && cellCount !== expectedCellCount) {
    throw new Error("ownership cell count does not match bound stream map");
  }
  const palette = readPalette(reader, cellCount);

  if (kind === FRAME_SNAPSHOT) {
    const codes = readSnapshotCodes(reader, cellCount, palette.length);
    if (!reader.done()) {
      throw new Error("unexpected trailing ownership snapshot data");
    }
    return Object.freeze({
      schemaVersion,
      kind: "SNAPSHOT" as const,
      revision,
      cellCount,
      palette,
      codes,
    });
  }

  const baseRevision = reader.varuint();
  if (baseRevision <= 0 || revision !== baseRevision + 1) {
    throw new Error("invalid ownership revision relationship");
  }
  const chunkSize = reader.varuint();
  if (chunkSize <= 0 || chunkSize > cellCount) {
    throw new Error("invalid ownership chunk size");
  }
  const totalChunkCount = Math.ceil(cellCount / chunkSize);
  const changedChunkCount = reader.varuint();
  if (changedChunkCount > totalChunkCount) {
    throw new Error("ownership changed-chunk count exceeds plane");
  }
  const chunks: DecodedDeltaChunk[] = [];
  let previousChunk = -1;
  for (let index = 0; index < changedChunkCount; index += 1) {
    const chunkIndex = reader.varuint();
    if (chunkIndex >= totalChunkCount || chunkIndex <= previousChunk) {
      throw new Error("ownership chunks must be ordered and unique");
    }
    const chunkStart = chunkIndex * chunkSize;
    const chunkCellCount = Math.min(chunkSize, cellCount - chunkStart);
    const mode = reader.byte();
    if (mode === CHUNK_SPARSE) {
      chunks.push(
        readSparseChunk(reader, chunkIndex, chunkCellCount, palette.length),
      );
    } else if (mode === CHUNK_RUN) {
      chunks.push(
        readRunChunk(reader, chunkIndex, chunkCellCount, palette.length),
      );
    } else if (mode === CHUNK_REPLACE) {
      chunks.push(
        readReplaceChunk(reader, chunkIndex, chunkCellCount, palette.length),
      );
    } else {
      throw new Error("unknown ownership chunk mode");
    }
    previousChunk = chunkIndex;
  }
  if (!reader.done()) {
    throw new Error("unexpected trailing ownership delta data");
  }
  return Object.freeze({
    schemaVersion,
    kind: "DELTA" as const,
    revision,
    baseRevision,
    cellCount,
    chunkSize,
    palette,
    chunks: Object.freeze(chunks),
  });
}

export class OwnershipPlanePublisher {
  private readonly chunkSizeValue: number;
  private observed?: readonly (string | null)[];
  private observedTick?: number;
  private publishedObservation?: readonly (string | null)[];
  private publishedCodes?: OwnerCodePlane;
  private publishedPalette: readonly string[] = Object.freeze([]);
  private publishedRevision = 0;
  private publishedTick?: number;

  constructor(options: Readonly<{ chunkSize?: number }> = {}) {
    this.chunkSizeValue = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    requirePositiveSafeInteger(this.chunkSizeValue, "ownership chunk size");
    if (this.chunkSizeValue > MAX_OWNERSHIP_CELL_COUNT) {
      throw new RangeError("ownership chunk size exceeds V1 plane size");
    }
  }

  observe(ownership: readonly (string | null)[], tick: number): void {
    if (!Array.isArray(ownership)) {
      throw new TypeError("ownership observation must be an array");
    }
    if (ownership.length <= 0 || ownership.length > MAX_OWNERSHIP_CELL_COUNT) {
      throw new RangeError("ownership observation has invalid cell count");
    }
    requireNonNegativeSafeInteger(tick, "ownership authoritative tick");
    if (this.observedTick !== undefined && tick < this.observedTick) {
      throw new RangeError("ownership authoritative tick must not regress");
    }
    this.observed = ownership;
    this.observedTick = tick;
  }

  flush(): OwnershipPublication | null {
    const ownership = this.observed;
    const tick = this.observedTick;
    if (ownership === undefined || tick === undefined) {
      return null;
    }
    if (ownership === this.publishedObservation) {
      this.publishedTick = tick;
      return null;
    }
    const started = Date.now();
    const palette = paletteFromOwnership(ownership);
    const nextCodes = ownershipToCodes(ownership, palette);

    if (
      this.publishedCodes !== undefined &&
      palettesEqual(palette, this.publishedPalette) &&
      codePlanesEqual(nextCodes, this.publishedCodes)
    ) {
      this.publishedObservation = ownership;
      this.publishedTick = tick;
      return null;
    }

    const revision = this.publishedRevision + 1;
    const fullBytes = encodeSnapshot(
      revision,
      nextCodes.length,
      palette,
      nextCodes,
    );
    let selectedBytes = fullBytes;
    let kind: "SNAPSHOT" | "DELTA" = "SNAPSHOT";
    let baseRevision: number | undefined;
    let changedCells = nextCodes.length;
    let changedChunks = Math.ceil(nextCodes.length / this.chunkSizeValue);
    let chunkModes: readonly OwnershipChunkMode[] = Object.freeze([]);
    let incrementalCandidateBytes = fullBytes.byteLength;

    if (
      this.publishedCodes !== undefined &&
      this.publishedCodes.length === nextCodes.length &&
      palettesEqual(palette, this.publishedPalette)
    ) {
      const delta = encodeDelta(
        this.publishedRevision,
        revision,
        palette,
        this.publishedCodes,
        nextCodes,
        this.chunkSizeValue,
      );
      incrementalCandidateBytes = delta.bytes.byteLength;
      changedCells = delta.changedCells;
      changedChunks = delta.changedChunks;
      if (delta.bytes.byteLength < fullBytes.byteLength) {
        selectedBytes = delta.bytes;
        kind = "DELTA";
        baseRevision = this.publishedRevision;
        chunkModes = delta.chunkModes;
      }
    }

    this.publishedObservation = ownership;
    this.publishedCodes = nextCodes;
    this.publishedPalette = palette;
    this.publishedRevision = revision;
    this.publishedTick = tick;
    const stats = Object.freeze({
      cellCount: nextCodes.length,
      changedCells,
      changedChunks,
      chunkSize: this.chunkSizeValue,
      encodedBytes: selectedBytes.byteLength,
      rawPlaneBytes: nextCodes.byteLength,
      fullReplacementEncodedBytes: fullBytes.byteLength,
      incrementalCandidateBytes,
      richJsonEstimateBytes: estimateRichJsonBytes(
        changedCells,
        nextCodes.length,
        palette.length,
      ),
      richCellRecords: 0 as const,
      encodeMs: Date.now() - started,
    });
    return Object.freeze({
      schemaVersion: OWNERSHIP_PLANE_SCHEMA_VERSION,
      kind,
      tick,
      revision,
      ...(baseRevision === undefined ? {} : { baseRevision }),
      bytes: selectedBytes,
      chunkModes,
      stats,
    });
  }

  currentSnapshot(): OwnershipPublication {
    if (
      this.publishedCodes === undefined ||
      this.publishedRevision <= 0 ||
      this.publishedTick === undefined
    ) {
      throw new Error("ownership publisher has no published state");
    }
    const started = Date.now();
    const bytes = encodeSnapshot(
      this.publishedRevision,
      this.publishedCodes.length,
      this.publishedPalette,
      this.publishedCodes,
    );
    return Object.freeze({
      schemaVersion: OWNERSHIP_PLANE_SCHEMA_VERSION,
      kind: "SNAPSHOT" as const,
      tick: this.publishedTick,
      revision: this.publishedRevision,
      bytes,
      chunkModes: Object.freeze([]),
      stats: Object.freeze({
        cellCount: this.publishedCodes.length,
        changedCells: this.publishedCodes.length,
        changedChunks: Math.ceil(
          this.publishedCodes.length / this.chunkSizeValue,
        ),
        chunkSize: this.chunkSizeValue,
        encodedBytes: bytes.byteLength,
        rawPlaneBytes: this.publishedCodes.byteLength,
        fullReplacementEncodedBytes: bytes.byteLength,
        incrementalCandidateBytes: bytes.byteLength,
        richJsonEstimateBytes: estimateRichJsonBytes(
          this.publishedCodes.length,
          this.publishedCodes.length,
          this.publishedPalette.length,
        ),
        richCellRecords: 0 as const,
        encodeMs: Date.now() - started,
      }),
    });
  }
}

type ApplyEnvelope = Readonly<{
  streamId: string;
  seq: number;
  tick: number;
  bytes?: Uint8Array;
}>;

type ApplyResult =
  | Readonly<{ ok: true; revision: number }>
  | Readonly<{
      ok: false;
      reason:
        | "INVALID_PAYLOAD"
        | "SEQUENCE_GAP"
        | "REVISION_MISMATCH"
        | "RESYNC_REQUIRED";
      resyncRequired: true;
    }>;

function applyFailure(
  reason: "INVALID_PAYLOAD" | "SEQUENCE_GAP" | "REVISION_MISMATCH" | "RESYNC_REQUIRED",
): ApplyResult {
  return Object.freeze({ ok: false, reason, resyncRequired: true });
}

export class OwnershipPlaneCache {
  private readonly expectedCellCountValue: number;
  private streamIdValue?: string;
  private lastSeq?: number;
  private lastEnvelopeTick?: number;
  private revisionValue = 0;
  private ownershipTickValue?: number;
  private palette: readonly string[] = Object.freeze([]);
  private codes?: OwnerCodePlane;
  private requiresResync = false;

  constructor(options: Readonly<{ expectedCellCount: number }>) {
    if (typeof options !== "object" || options === null) {
      throw new TypeError("ownership cache requires a stream map binding");
    }
    requirePositiveSafeInteger(
      options.expectedCellCount,
      "expected ownership cell count",
    );
    if (options.expectedCellCount > MAX_OWNERSHIP_CELL_COUNT) {
      throw new RangeError("expected ownership cell count exceeds V1 bounds");
    }
    this.expectedCellCountValue = options.expectedCellCount;
  }

  revision(): number {
    return this.revisionValue;
  }

  tick(): number | undefined {
    return this.ownershipTickValue;
  }

  cellCount(): number {
    return this.codes?.length ?? 0;
  }

  ownerAt(cellId: number): string | null | undefined {
    if (
      !Number.isSafeInteger(cellId) ||
      cellId < 0 ||
      this.codes === undefined ||
      cellId >= this.codes.length
    ) {
      return undefined;
    }
    const code = this.codes[cellId];
    return code === 0 ? null : this.palette[code - 1];
  }

  acceptResume(streamId: string, afterSeq: number): boolean {
    if (
      typeof streamId !== "string" ||
      streamId.length === 0 ||
      !Number.isSafeInteger(afterSeq) ||
      afterSeq < 0 ||
      !this.requiresResync ||
      this.streamIdValue !== streamId ||
      this.lastSeq !== afterSeq
    ) {
      return false;
    }
    this.requiresResync = false;
    return true;
  }

  applyEnvelope(envelope: ApplyEnvelope): ApplyResult {
    if (typeof envelope !== "object" || envelope === null) {
      this.requiresResync = true;
      return applyFailure("INVALID_PAYLOAD");
    }
    if (
      typeof envelope.streamId !== "string" ||
      envelope.streamId.length === 0 ||
      !Number.isSafeInteger(envelope.seq) ||
      envelope.seq <= 0 ||
      !Number.isSafeInteger(envelope.tick) ||
      envelope.tick < 0 ||
      (envelope.bytes !== undefined && !(envelope.bytes instanceof Uint8Array))
    ) {
      this.requiresResync = true;
      return applyFailure("INVALID_PAYLOAD");
    }

    const sameStream = this.streamIdValue === envelope.streamId;
    if (!sameStream && envelope.seq !== 1) {
      this.streamIdValue = envelope.streamId;
      this.lastSeq = 0;
      this.lastEnvelopeTick = undefined;
      this.revisionValue = 0;
      this.ownershipTickValue = undefined;
      this.palette = Object.freeze([]);
      this.codes = undefined;
      this.requiresResync = true;
      return applyFailure("SEQUENCE_GAP");
    }
    if (sameStream && this.requiresResync) {
      return applyFailure("RESYNC_REQUIRED");
    }
    if (
      sameStream &&
      this.lastSeq !== undefined &&
      envelope.seq !== this.lastSeq + 1
    ) {
      this.requiresResync = true;
      return applyFailure("SEQUENCE_GAP");
    }
    if (
      sameStream &&
      this.lastEnvelopeTick !== undefined &&
      envelope.tick < this.lastEnvelopeTick
    ) {
      this.requiresResync = true;
      return applyFailure("INVALID_PAYLOAD");
    }

    if (envelope.bytes === undefined) {
      if (!sameStream) {
        this.streamIdValue = envelope.streamId;
        this.lastSeq = envelope.seq;
        this.lastEnvelopeTick = envelope.tick;
        this.revisionValue = 0;
        this.ownershipTickValue = undefined;
        this.palette = Object.freeze([]);
        this.codes = undefined;
        this.requiresResync = false;
        return Object.freeze({ ok: true, revision: 0 });
      }
      this.lastSeq = envelope.seq;
      this.lastEnvelopeTick = envelope.tick;
      return Object.freeze({ ok: true, revision: this.revisionValue });
    }

    let decoded: DecodedOwnershipFrame;
    try {
      decoded = decodeOwnershipFrame(envelope.bytes, this.expectedCellCountValue);
    } catch {
      if (!sameStream) {
        this.streamIdValue = envelope.streamId;
        this.lastSeq = envelope.seq;
        this.lastEnvelopeTick = envelope.tick;
      }
      this.requiresResync = true;
      return applyFailure("INVALID_PAYLOAD");
    }

    if (!sameStream) {
      if (decoded.kind !== "SNAPSHOT") {
        this.streamIdValue = envelope.streamId;
        this.lastSeq = envelope.seq;
        this.lastEnvelopeTick = envelope.tick;
        this.requiresResync = true;
        return applyFailure("RESYNC_REQUIRED");
      }
      this.streamIdValue = envelope.streamId;
      this.lastSeq = envelope.seq;
      this.lastEnvelopeTick = envelope.tick;
      this.revisionValue = decoded.revision;
      this.ownershipTickValue = envelope.tick;
      this.palette = decoded.palette;
      this.codes = decoded.codes;
      this.requiresResync = false;
      return Object.freeze({ ok: true, revision: decoded.revision });
    }

    if (decoded.kind === "SNAPSHOT") {
      if (
        this.codes !== undefined &&
        decoded.revision !== this.revisionValue + 1
      ) {
        this.requiresResync = true;
        return applyFailure("REVISION_MISMATCH");
      }
      this.lastSeq = envelope.seq;
      this.lastEnvelopeTick = envelope.tick;
      this.revisionValue = decoded.revision;
      this.ownershipTickValue = envelope.tick;
      this.palette = decoded.palette;
      this.codes = decoded.codes;
      return Object.freeze({ ok: true, revision: decoded.revision });
    }

    if (
      this.codes === undefined ||
      decoded.cellCount !== this.codes.length ||
      decoded.baseRevision !== this.revisionValue ||
      !palettesEqual(decoded.palette, this.palette)
    ) {
      this.requiresResync = true;
      return applyFailure("REVISION_MISMATCH");
    }

    for (const chunk of decoded.chunks) {
      const start = chunk.chunkIndex * decoded.chunkSize;
      if (chunk.mode === "SPARSE") {
        for (let index = 0; index < chunk.offsets.length; index += 1) {
          this.codes[start + chunk.offsets[index]] = chunk.codes[index];
        }
      } else if (chunk.mode === "RUN") {
        for (let index = 0; index < chunk.runs.length; index += 3) {
          const offset = chunk.runs[index];
          const length = chunk.runs[index + 1];
          const code = chunk.runs[index + 2];
          this.codes.fill(code, start + offset, start + offset + length);
        }
      } else {
        this.codes.set(chunk.codes, start);
      }
    }
    this.lastSeq = envelope.seq;
    this.lastEnvelopeTick = envelope.tick;
    this.revisionValue = decoded.revision;
    this.ownershipTickValue = envelope.tick;
    return Object.freeze({ ok: true, revision: decoded.revision });
  }
}
