// Exact executable owner for the OPEN_FUFU_MAP package schema, canonical
// serialization/content identity, terrain-code encoding, artifact validation,
// and map-artifact binding. Broader migration/version-binding architecture is
// owned by docs/OPENFRONT_INTEGRATION_PLAN.md; the raster-cell invariant and
// spatial ontology by docs/OPEN_FUFU_DESIGN.md; terrain mechanics by
// docs/TERRAIN_AND_STRUCTURES.md; Segment semantics by docs/SEGMENTS.md.

import type { TerrainType } from "../core/controller/ControllerApi";
import {
  SEGMENT_ADJACENCY_ENCODING,
  SEGMENT_ADJACENCY_OFFSETS_ENCODING,
  SEGMENT_COUNT_LIMIT,
  SEGMENT_GENERATOR_VERSION,
  SEGMENT_MEMBERSHIP_ENCODING,
  SEGMENT_METADATA_ENCODING,
  materializeSegmentArtifact,
} from "./Segments";
import { createSimulationMap, type SimulationMap } from "./SimulationMap";

export const OPEN_FUFU_MAP_FORMAT = "OPEN_FUFU_MAP" as const;
/** Backward-compatible name for the original terrain-only format. */
export const OPEN_FUFU_MAP_FORMAT_VERSION = 1 as const;
export const OPEN_FUFU_MAP_FORMAT_VERSION_V1 = 1 as const;
export const OPEN_FUFU_MAP_FORMAT_VERSION_V2 = 2 as const;
export const OPEN_FUFU_MAP_FORMAT_VERSION_V3 = 3 as const;
export const OPEN_FUFU_MAP_CELL_COUNT = 4_800_000 as const;
export const OPEN_FUFU_TERRAIN_ENCODING = "TERRAIN_U8_V1" as const;
export const OPEN_FUFU_RAIL_TOPOLOGY_ENCODING = "RAIL_TOPOLOGY_U8_V1" as const;
export const SEGMENT_MEMBERSHIP_PATH = "segments/membership.bin" as const;
export const SEGMENT_METADATA_PATH = "segments/metadata.bin" as const;
export const SEGMENT_ADJACENCY_OFFSETS_PATH =
  "segments/adjacency-offsets.bin" as const;
export const SEGMENT_ADJACENCY_PATH = "segments/adjacency.bin" as const;
export const RAIL_TOPOLOGY_PATH = "rail/topology.bin" as const;

export interface MapArtifactBinding {
  readonly mapId: string;
  readonly mapVersion: string;
  readonly mapHash: string;
}

export interface MapArtifactFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface MapArtifactPackage {
  readonly files: readonly MapArtifactFile[];
}

export interface MapArtifactResolver {
  resolve(binding: MapArtifactBinding): MapArtifactPackage | undefined;
}

export interface OpenFufuMapSectionV1 {
  readonly id: "terrain";
  readonly encoding: typeof OPEN_FUFU_TERRAIN_ENCODING;
  readonly path: "terrain.bin";
}

export interface OpenFufuSegmentMembershipSectionV1 {
  readonly id: "segmentMembership";
  readonly encoding: typeof SEGMENT_MEMBERSHIP_ENCODING;
  readonly path: typeof SEGMENT_MEMBERSHIP_PATH;
}

export interface OpenFufuSegmentMetadataSectionV1 {
  readonly id: "segmentMetadata";
  readonly encoding: typeof SEGMENT_METADATA_ENCODING;
  readonly path: typeof SEGMENT_METADATA_PATH;
}

export interface OpenFufuSegmentAdjacencyOffsetsSectionV1 {
  readonly id: "segmentAdjacencyOffsets";
  readonly encoding: typeof SEGMENT_ADJACENCY_OFFSETS_ENCODING;
  readonly path: typeof SEGMENT_ADJACENCY_OFFSETS_PATH;
}

export interface OpenFufuSegmentAdjacencySectionV1 {
  readonly id: "segmentAdjacency";
  readonly encoding: typeof SEGMENT_ADJACENCY_ENCODING;
  readonly path: typeof SEGMENT_ADJACENCY_PATH;
}

export interface OpenFufuRailTopologySectionV1 {
  readonly id: "railTopology";
  readonly encoding: typeof OPEN_FUFU_RAIL_TOPOLOGY_ENCODING;
  readonly path: typeof RAIL_TOPOLOGY_PATH;
}

export interface OpenFufuMapManifestV1 {
  readonly format: typeof OPEN_FUFU_MAP_FORMAT;
  readonly formatVersion: typeof OPEN_FUFU_MAP_FORMAT_VERSION_V1;
  readonly mapId: string;
  readonly mapVersion: string;
  readonly width: number;
  readonly height: number;
  readonly sections: readonly [OpenFufuMapSectionV1];
}

export interface OpenFufuMapManifestV2 {
  readonly format: typeof OPEN_FUFU_MAP_FORMAT;
  readonly formatVersion: typeof OPEN_FUFU_MAP_FORMAT_VERSION_V2;
  readonly mapId: string;
  readonly mapVersion: string;
  readonly width: number;
  readonly height: number;
  readonly segmentGeneratorVersion: typeof SEGMENT_GENERATOR_VERSION;
  readonly segmentCount: number;
  readonly sections: readonly [
    OpenFufuMapSectionV1,
    OpenFufuSegmentMembershipSectionV1,
    OpenFufuSegmentMetadataSectionV1,
    OpenFufuSegmentAdjacencyOffsetsSectionV1,
    OpenFufuSegmentAdjacencySectionV1,
  ];
}

export interface OpenFufuMapManifestV3 {
  readonly format: typeof OPEN_FUFU_MAP_FORMAT;
  readonly formatVersion: typeof OPEN_FUFU_MAP_FORMAT_VERSION_V3;
  readonly mapId: string;
  readonly mapVersion: string;
  readonly width: number;
  readonly height: number;
  readonly segmentGeneratorVersion: typeof SEGMENT_GENERATOR_VERSION;
  readonly segmentCount: number;
  readonly sections: readonly [
    OpenFufuMapSectionV1,
    OpenFufuSegmentMembershipSectionV1,
    OpenFufuSegmentMetadataSectionV1,
    OpenFufuSegmentAdjacencyOffsetsSectionV1,
    OpenFufuSegmentAdjacencySectionV1,
    OpenFufuRailTopologySectionV1,
  ];
}

export type OpenFufuMapManifest =
  | OpenFufuMapManifestV1
  | OpenFufuMapManifestV2
  | OpenFufuMapManifestV3;

const TERRAIN_BY_CODE = Object.freeze([
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
  "SHALLOW_WATER",
  "DEEP_WATER",
  "IMPASSABLE",
] as const satisfies readonly TerrainType[]);

const PACKAGE_KEYS = ["files"] as const;
const FILE_KEYS = ["path", "bytes"] as const;
const MANIFEST_V1_KEYS = [
  "format",
  "formatVersion",
  "mapId",
  "mapVersion",
  "width",
  "height",
  "sections",
] as const;
const MANIFEST_V2_KEYS = [
  "format",
  "formatVersion",
  "mapId",
  "mapVersion",
  "width",
  "height",
  "segmentGeneratorVersion",
  "segmentCount",
  "sections",
] as const;
const SECTION_KEYS = ["id", "encoding", "path"] as const;
const REQUIRED_V1_FILE_PATHS = ["manifest.json", "terrain.bin"] as const;
const REQUIRED_V2_FILE_PATHS = [
  "manifest.json",
  "terrain.bin",
  SEGMENT_MEMBERSHIP_PATH,
  SEGMENT_METADATA_PATH,
  SEGMENT_ADJACENCY_OFFSETS_PATH,
  SEGMENT_ADJACENCY_PATH,
] as const;
const REQUIRED_V3_FILE_PATHS = [
  ...REQUIRED_V2_FILE_PATHS,
  RAIL_TOPOLOGY_PATH,
] as const;
const KNOWN_FILE_PATHS = new Set<string>(REQUIRED_V3_FILE_PATHS);
const MAP_HASH_PATTERN = /^[0-9a-f]{64}$/;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) &&
    Object.prototype.toString.call(value) === "[object Uint8Array]"
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported canonical map manifest value: ${typeof value}`);
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(input: Uint8Array): string {
  const bitLength = input.byteLength * 8;
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(input);
  message[input.byteLength] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(
    paddedLength - 8,
    Math.floor(bitLength / 0x1_0000_0000),
    false,
  );
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]!;
      const right = words[index - 2]!;
      const sigma0 =
        rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 =
        rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] =
        (words[index - 16]! + sigma0 + words[index - 7]! + sigma1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_K[index]! + words[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}

function framedPackageBytes(files: readonly MapArtifactFile[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  for (const file of [...files].sort((left, right) => compareStrings(left.path, right.path))) {
    const pathBytes = UTF8_ENCODER.encode(file.path);
    const pathLength = UTF8_ENCODER.encode(`${pathBytes.byteLength}:`);
    const contentLength = UTF8_ENCODER.encode(`${file.bytes.byteLength}:`);
    for (const chunk of [pathLength, pathBytes, contentLength, file.bytes]) {
      totalLength += chunk.byteLength;
      if (!Number.isSafeInteger(totalLength)) {
        throw new Error("map artifact package is too large to hash safely");
      }
      chunks.push(chunk);
    }
  }
  const framed = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    framed.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return framed;
}

export function mapArtifactHash(files: readonly MapArtifactFile[]): string {
  return sha256Hex(framedPackageBytes(files));
}

export function validateMapArtifactBinding(binding: MapArtifactBinding): void {
  if (typeof binding.mapId !== "string") {
    throw new Error("mapId must be a string");
  }
  if (binding.mapId.length === 0) {
    throw new Error("mapId must be a non-empty string");
  }
  if (typeof binding.mapVersion !== "string") {
    throw new Error("mapVersion must be a string");
  }
  if (binding.mapVersion.length === 0) {
    throw new Error("mapVersion must be a non-empty string");
  }
  if (typeof binding.mapHash !== "string" || !MAP_HASH_PATTERN.test(binding.mapHash)) {
    throw new Error("mapHash must be a 64-character lowercase hexadecimal SHA-256 digest");
  }
}

function validatedPackageFiles(rawPackage: unknown): readonly MapArtifactFile[] {
  if (!isRecord(rawPackage)) {
    throw new Error("map artifact package must be an object");
  }
  if (!hasExactKeys(rawPackage, PACKAGE_KEYS)) {
    throw new Error("map artifact package must contain exactly the package keys");
  }
  if (!Array.isArray(rawPackage.files)) {
    throw new Error("map artifact files must be an array");
  }

  const files: MapArtifactFile[] = [];
  const seen = new Set<string>();
  for (const rawFile of rawPackage.files) {
    if (!isRecord(rawFile) || !hasExactKeys(rawFile, FILE_KEYS)) {
      throw new Error("map artifact file must contain exactly path and bytes");
    }
    if (typeof rawFile.path !== "string") {
      throw new Error("map artifact file path must be a string");
    }
    if (!isUint8Array(rawFile.bytes)) {
      throw new Error(`map artifact file ${rawFile.path} bytes must be Uint8Array`);
    }
    if (seen.has(rawFile.path)) {
      throw new Error(`map artifact has duplicate file path: ${rawFile.path}`);
    }
    seen.add(rawFile.path);
    if (!KNOWN_FILE_PATHS.has(rawFile.path)) {
      throw new Error(`unknown artifact file: ${rawFile.path}`);
    }
    files.push({ path: rawFile.path, bytes: rawFile.bytes });
  }

  for (const path of REQUIRED_V1_FILE_PATHS) {
    if (!seen.has(path)) {
      throw new Error(`map artifact ${path} is required`);
    }
  }
  return Object.freeze(files);
}

function validateExactFileSet(
  files: readonly MapArtifactFile[],
  requiredPaths: readonly string[],
  versionLabel: string,
): void {
  const seen = new Set(files.map((file) => file.path));
  for (const path of requiredPaths) {
    if (!seen.has(path)) {
      throw new Error(`map artifact ${versionLabel} requires ${path}`);
    }
  }
  if (files.length !== requiredPaths.length) {
    throw new Error(
      `map artifact ${versionLabel} package must contain exactly ${requiredPaths.length} files`,
    );
  }
}

function decodeCanonicalManifest(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    throw new Error("manifest.json must contain valid UTF-8");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("manifest.json must contain valid JSON");
  }

  let canonical: string;
  try {
    canonical = canonicalJson(parsed);
  } catch {
    throw new Error("manifest.json contains a value unsupported by canonical JSON");
  }
  if (text !== canonical) {
    throw new Error("manifest.json must use canonical JSON bytes");
  }
  return parsed;
}

function validateCommonManifestFields(raw: Record<string, unknown>): {
  readonly mapId: string;
  readonly mapVersion: string;
  readonly width: number;
  readonly height: number;
} {
  if (raw.format !== OPEN_FUFU_MAP_FORMAT) {
    throw new Error(`map artifact manifest format must be ${OPEN_FUFU_MAP_FORMAT}`);
  }
  if (typeof raw.mapId !== "string") {
    throw new Error("map artifact manifest mapId must be a string");
  }
  if (raw.mapId.length === 0) {
    throw new Error("map artifact manifest mapId must be a non-empty string");
  }
  if (typeof raw.mapVersion !== "string") {
    throw new Error("map artifact manifest mapVersion must be a string");
  }
  if (raw.mapVersion.length === 0) {
    throw new Error("map artifact manifest mapVersion must be a non-empty string");
  }
  if (!Number.isSafeInteger(raw.width) || (raw.width as number) <= 0) {
    throw new Error("map artifact manifest width must be a positive safe integer");
  }
  if (!Number.isSafeInteger(raw.height) || (raw.height as number) <= 0) {
    throw new Error("map artifact manifest height must be a positive safe integer");
  }
  const width = raw.width as number;
  const height = raw.height as number;
  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount !== OPEN_FUFU_MAP_CELL_COUNT) {
    throw new Error("ordinary Open Fufu maps must contain exactly 4,800,000 raster cells");
  }
  return { mapId: raw.mapId, mapVersion: raw.mapVersion, width, height };
}

function validateSection(
  raw: unknown,
  expected: { readonly id: string; readonly encoding: string; readonly path: string },
  label: string,
): void {
  if (!isRecord(raw) || !hasExactKeys(raw, SECTION_KEYS)) {
    throw new Error(`map artifact ${label} section must contain exactly the section keys`);
  }
  if (raw.id !== expected.id) {
    throw new Error(`map artifact ${label} section id must be ${expected.id}`);
  }
  if (raw.encoding !== expected.encoding) {
    throw new Error(`map artifact ${label} encoding must be ${expected.encoding}`);
  }
  if (raw.path !== expected.path) {
    throw new Error(`map artifact ${label} section path must be ${expected.path}`);
  }
}

function terrainSection(): OpenFufuMapSectionV1 {
  return Object.freeze({
    id: "terrain",
    encoding: OPEN_FUFU_TERRAIN_ENCODING,
    path: "terrain.bin",
  });
}

const SEGMENT_SECTIONS = Object.freeze([
  Object.freeze({
    id: "segmentMembership",
    encoding: SEGMENT_MEMBERSHIP_ENCODING,
    path: SEGMENT_MEMBERSHIP_PATH,
  }),
  Object.freeze({
    id: "segmentMetadata",
    encoding: SEGMENT_METADATA_ENCODING,
    path: SEGMENT_METADATA_PATH,
  }),
  Object.freeze({
    id: "segmentAdjacencyOffsets",
    encoding: SEGMENT_ADJACENCY_OFFSETS_ENCODING,
    path: SEGMENT_ADJACENCY_OFFSETS_PATH,
  }),
  Object.freeze({
    id: "segmentAdjacency",
    encoding: SEGMENT_ADJACENCY_ENCODING,
    path: SEGMENT_ADJACENCY_PATH,
  }),
] as const);

const RAIL_SECTION = Object.freeze({
  id: "railTopology",
  encoding: OPEN_FUFU_RAIL_TOPOLOGY_ENCODING,
  path: RAIL_TOPOLOGY_PATH,
} as const);

function validateSegmentManifestFields(raw: Record<string, unknown>): {
  readonly segmentGeneratorVersion: typeof SEGMENT_GENERATOR_VERSION;
  readonly segmentCount: number;
} {
  if (raw.segmentGeneratorVersion !== SEGMENT_GENERATOR_VERSION) {
    throw new Error(
      `map artifact manifest segmentGeneratorVersion ${String(raw.segmentGeneratorVersion)} is unsupported`,
    );
  }
  if (
    !Number.isSafeInteger(raw.segmentCount) ||
    (raw.segmentCount as number) <= 0 ||
    (raw.segmentCount as number) >= SEGMENT_COUNT_LIMIT
  ) {
    throw new Error("map artifact manifest segmentCount must be a positive integer below 65,536");
  }
  return {
    segmentGeneratorVersion: SEGMENT_GENERATOR_VERSION,
    segmentCount: raw.segmentCount as number,
  };
}

function validateManifestV1(raw: Record<string, unknown>): OpenFufuMapManifestV1 {
  if (!hasExactKeys(raw, MANIFEST_V1_KEYS)) {
    throw new Error("map artifact manifest must contain exactly the V1 manifest keys");
  }
  const common = validateCommonManifestFields(raw);
  if (!Array.isArray(raw.sections)) {
    throw new Error("map artifact manifest sections must be an array");
  }
  if (raw.sections.length === 0) {
    throw new Error("map artifact manifest terrain section is required");
  }
  if (raw.sections.length !== 1) {
    throw new Error("map artifact manifest sections for V1 must contain exactly one terrain section");
  }
  validateSection(
    raw.sections[0],
    { id: "terrain", encoding: OPEN_FUFU_TERRAIN_ENCODING, path: "terrain.bin" },
    "terrain",
  );
  return Object.freeze({
    format: OPEN_FUFU_MAP_FORMAT,
    formatVersion: OPEN_FUFU_MAP_FORMAT_VERSION_V1,
    ...common,
    sections: Object.freeze([terrainSection()]) as readonly [OpenFufuMapSectionV1],
  });
}

function validateManifestV2(raw: Record<string, unknown>): OpenFufuMapManifestV2 {
  if (!hasExactKeys(raw, MANIFEST_V2_KEYS)) {
    throw new Error(
      "map artifact manifest formatVersion 2 is unsupported without the complete V2 Segment manifest keys",
    );
  }
  const common = validateCommonManifestFields(raw);
  const segment = validateSegmentManifestFields(raw);
  if (!Array.isArray(raw.sections)) {
    throw new Error("map artifact manifest sections must be an array");
  }
  if (raw.sections.length !== 5) {
    throw new Error("map artifact manifest sections for V2 must contain exactly five typed sections");
  }

  const expectedSections = [
    { id: "terrain", encoding: OPEN_FUFU_TERRAIN_ENCODING, path: "terrain.bin" },
    ...SEGMENT_SECTIONS,
  ] as const;
  for (let index = 0; index < expectedSections.length; index += 1) {
    validateSection(raw.sections[index], expectedSections[index]!, expectedSections[index]!.id);
  }

  const sections = Object.freeze([
    terrainSection(),
    ...SEGMENT_SECTIONS,
  ]) as OpenFufuMapManifestV2["sections"];

  return Object.freeze({
    format: OPEN_FUFU_MAP_FORMAT,
    formatVersion: OPEN_FUFU_MAP_FORMAT_VERSION_V2,
    ...common,
    ...segment,
    sections,
  });
}

function validateManifestV3(raw: Record<string, unknown>): OpenFufuMapManifestV3 {
  if (!hasExactKeys(raw, MANIFEST_V2_KEYS)) {
    throw new Error(
      "map artifact manifest formatVersion 3 is unsupported without the complete V3 Segment/rail manifest keys",
    );
  }
  const common = validateCommonManifestFields(raw);
  const segment = validateSegmentManifestFields(raw);
  if (!Array.isArray(raw.sections)) {
    throw new Error("map artifact manifest sections must be an array");
  }
  if (raw.sections.length !== 6) {
    throw new Error("map artifact manifest sections for V3 must contain exactly six typed sections");
  }

  const expectedSections = [
    { id: "terrain", encoding: OPEN_FUFU_TERRAIN_ENCODING, path: "terrain.bin" },
    ...SEGMENT_SECTIONS,
    RAIL_SECTION,
  ] as const;
  for (let index = 0; index < expectedSections.length; index += 1) {
    validateSection(raw.sections[index], expectedSections[index]!, expectedSections[index]!.id);
  }

  const sections = Object.freeze([
    terrainSection(),
    ...SEGMENT_SECTIONS,
    RAIL_SECTION,
  ]) as OpenFufuMapManifestV3["sections"];

  return Object.freeze({
    format: OPEN_FUFU_MAP_FORMAT,
    formatVersion: OPEN_FUFU_MAP_FORMAT_VERSION_V3,
    ...common,
    ...segment,
    sections,
  });
}

function validateManifest(raw: unknown): OpenFufuMapManifest {
  if (!isRecord(raw)) {
    throw new Error("map artifact manifest must be an object");
  }
  if (raw.formatVersion === OPEN_FUFU_MAP_FORMAT_VERSION_V1) {
    return validateManifestV1(raw);
  }
  if (raw.formatVersion === OPEN_FUFU_MAP_FORMAT_VERSION_V2) {
    return validateManifestV2(raw);
  }
  if (raw.formatVersion === OPEN_FUFU_MAP_FORMAT_VERSION_V3) {
    return validateManifestV3(raw);
  }
  throw new Error(
    `map artifact manifest formatVersion ${String(raw.formatVersion)} is unsupported`,
  );
}

function terrainFromBytes(bytes: Uint8Array): readonly TerrainType[] {
  if (bytes.byteLength !== OPEN_FUFU_MAP_CELL_COUNT) {
    throw new Error(
      "terrain.bin length must be exactly 4,800,000 bytes (one byte per raster cell)",
    );
  }
  const terrain = new Array<TerrainType>(bytes.byteLength);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const code = bytes[index]!;
    const value = TERRAIN_BY_CODE[code];
    if (value === undefined) {
      throw new Error(`unsupported terrain code ${code} at CellId ${index}`);
    }
    terrain[index] = value;
  }
  return Object.freeze(terrain);
}

function fileBytes(files: readonly MapArtifactFile[], path: string): Uint8Array {
  const file = files.find((candidate) => candidate.path === path);
  if (file === undefined) throw new Error(`map artifact ${path} is required`);
  return file.bytes;
}

export function materializeMapArtifact(
  binding: MapArtifactBinding,
  rawPackage: unknown,
): SimulationMap {
  validateMapArtifactBinding(binding);
  const files = validatedPackageFiles(rawPackage);
  const actualHash = mapArtifactHash(files);
  if (actualHash !== binding.mapHash) {
    throw new Error(
      `map artifact hash mismatch: expected ${binding.mapHash}, received ${actualHash}`,
    );
  }

  const manifest = validateManifest(
    decodeCanonicalManifest(fileBytes(files, "manifest.json")),
  );
  if (manifest.formatVersion === OPEN_FUFU_MAP_FORMAT_VERSION_V1) {
    validateExactFileSet(files, REQUIRED_V1_FILE_PATHS, "V1");
  } else if (manifest.formatVersion === OPEN_FUFU_MAP_FORMAT_VERSION_V2) {
    validateExactFileSet(files, REQUIRED_V2_FILE_PATHS, "V2");
  } else {
    validateExactFileSet(files, REQUIRED_V3_FILE_PATHS, "V3");
  }
  if (manifest.mapId !== binding.mapId) {
    throw new Error(
      `map artifact mapId mismatch: expected ${binding.mapId}, received ${manifest.mapId}`,
    );
  }
  if (manifest.mapVersion !== binding.mapVersion) {
    throw new Error(
      `map artifact mapVersion mismatch: expected ${binding.mapVersion}, received ${manifest.mapVersion}`,
    );
  }

  const terrain = terrainFromBytes(fileBytes(files, "terrain.bin"));
  const segments =
    manifest.formatVersion !== OPEN_FUFU_MAP_FORMAT_VERSION_V1
      ? materializeSegmentArtifact({
          generatorVersion: manifest.segmentGeneratorVersion,
          segmentCount: manifest.segmentCount,
          width: manifest.width,
          height: manifest.height,
          terrain,
          membershipBytes: fileBytes(files, SEGMENT_MEMBERSHIP_PATH),
          metadataBytes: fileBytes(files, SEGMENT_METADATA_PATH),
          adjacencyOffsetsBytes: fileBytes(files, SEGMENT_ADJACENCY_OFFSETS_PATH),
          adjacencyBytes: fileBytes(files, SEGMENT_ADJACENCY_PATH),
        })
      : undefined;
  const railTopology =
    manifest.formatVersion === OPEN_FUFU_MAP_FORMAT_VERSION_V3
      ? fileBytes(files, RAIL_TOPOLOGY_PATH)
      : undefined;

  return createSimulationMap({
    source: "ARTIFACT",
    formatVersion: manifest.formatVersion,
    mapId: manifest.mapId,
    mapVersion: manifest.mapVersion,
    mapHash: binding.mapHash,
    width: manifest.width,
    height: manifest.height,
    terrain,
    segments,
    railTopology,
  });
}
