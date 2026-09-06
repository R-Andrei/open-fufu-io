import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OWNER_MAP_PATH = "docs/README.md";

interface CanonicalOwner {
  readonly concern: string;
  readonly path: string;
}

function fail(message: string): never {
  console.error(`documentation-authority: ${message}`);
  process.exit(1);
}

function normalizeRepoPath(fromFile: string, linkedPath: string): string {
  const absolute = resolve(REPO_ROOT, dirname(fromFile), linkedPath);
  const repoRelative = relative(REPO_ROOT, absolute).replaceAll("\\", "/");
  if (repoRelative.startsWith("../") || repoRelative === "..") {
    fail(`${fromFile} points outside the repository: ${linkedPath}`);
  }
  return repoRelative;
}

function parseCanonicalOwners(markdown: string): readonly CanonicalOwner[] {
  const owners: CanonicalOwner[] = [];
  const concerns = new Set<string>();
  const row = /^\|\s*(.*?)\s*\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|\s*$/gm;
  for (const match of markdown.matchAll(row)) {
    const concern = match[1]?.trim();
    const linkedPath = match[2]?.trim();
    if (concern === undefined || linkedPath === undefined) continue;
    if (concerns.has(concern)) {
      fail(`duplicate canonical concern in ${OWNER_MAP_PATH}: ${concern}`);
    }
    concerns.add(concern);
    owners.push({
      concern,
      path: normalizeRepoPath(OWNER_MAP_PATH, linkedPath),
    });
  }
  if (owners.length === 0) {
    fail(`${OWNER_MAP_PATH} yielded no canonical-owner rows`);
  }
  return owners;
}

function readCurrent(path: string): string {
  const absolute = resolve(REPO_ROOT, path);
  if (!existsSync(absolute)) fail(`canonical owner does not exist: ${path}`);
  return readFileSync(absolute, "utf8");
}

function readAtGitRef(ref: string, path: string): string | undefined {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

function mutableGitHubReferenceCounts(text: string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const add = (key: string): void => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  const shorthand = /(^|[^A-Za-z0-9_])#(\d+)\b/gm;
  for (const match of text.matchAll(shorthand)) {
    const number = match[2];
    if (number !== undefined) add(`#${number}`);
  }

  const githubWorkUrl =
    /https?:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/(?:issues|pull)\/(\d+)\b/gm;
  for (const match of text.matchAll(githubWorkUrl)) {
    const url = match[0];
    if (url !== undefined) add(`URL:${url}`);
  }

  return counts;
}

function assertOwnerMapIntegrity(owners: readonly CanonicalOwner[]): void {
  for (const owner of owners) readCurrent(owner.path);
}

function assertStrictNoMutableGitHubReferences(
  owners: readonly CanonicalOwner[],
): void {
  const violations: string[] = [];
  for (const owner of owners) {
    const counts = mutableGitHubReferenceCounts(readCurrent(owner.path));
    for (const [reference, count] of counts) {
      violations.push(
        `${owner.path}: ${reference} (${count} occurrence${count === 1 ? "" : "s"})`,
      );
    }
  }
  if (violations.length > 0) {
    fail(
      `strict mode forbids mutable GitHub issue/PR work-state references in canonical owners:\n${violations
        .sort()
        .map((entry) => `  - ${entry}`)
        .join("\n")}`,
    );
  }
}

function assertNoNewMutableGitHubReferences(
  owners: readonly CanonicalOwner[],
  baseRef: string,
): void {
  const baseMap = readAtGitRef(baseRef, OWNER_MAP_PATH);
  const baseOwners = baseMap === undefined ? [] : parseCanonicalOwners(baseMap);
  const paths = new Set([
    ...baseOwners.map((owner) => owner.path),
    ...owners.map((owner) => owner.path),
  ]);
  const violations: string[] = [];

  for (const path of paths) {
    const current = existsSync(resolve(REPO_ROOT, path)) ? readCurrent(path) : undefined;
    if (current === undefined) continue;
    const base = readAtGitRef(baseRef, path);
    const baseCounts = mutableGitHubReferenceCounts(base ?? "");
    const currentCounts = mutableGitHubReferenceCounts(current);
    for (const [reference, currentCount] of currentCounts) {
      const baseCount = baseCounts.get(reference) ?? 0;
      if (currentCount > baseCount) {
        violations.push(
          `${path}: ${reference} increased from ${baseCount} to ${currentCount}`,
        );
      }
    }
  }

  if (violations.length > 0) {
    fail(
      `canonical owners may not add mutable GitHub issue/PR work-state references:\n${violations
        .sort()
        .map((entry) => `  - ${entry}`)
        .join("\n")}`,
    );
  }
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const strict = process.argv.includes("--strict");
const baseRef = argumentValue("--base");
const currentMap = readCurrent(OWNER_MAP_PATH);
const currentOwners = parseCanonicalOwners(currentMap);

assertOwnerMapIntegrity(currentOwners);
if (strict) {
  assertStrictNoMutableGitHubReferences(currentOwners);
} else if (baseRef !== undefined) {
  assertNoNewMutableGitHubReferences(currentOwners, baseRef);
}

console.log(
  `documentation-authority: OK (${currentOwners.length} canonical concerns; mode=${
    strict ? "strict" : baseRef === undefined ? "map" : `incremental:${baseRef}`
  })`,
);
