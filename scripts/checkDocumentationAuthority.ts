import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const REPO_ROOT = process.cwd();
const OWNER_MAP_PATH = "docs/README.md";

/**
 * RULE_COMPOSITION.md is introduced by the long-running #43 branch while the
 * repository-wide legacy cleanup is intentionally tracked separately. Remove
 * this exemption when that cleanup makes strict mode pass repository-wide.
 */
const TRANSITIONAL_NEW_OWNER_EXEMPTIONS = new Set([
  "docs/RULE_COMPOSITION.md",
]);

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

function issueReferenceCounts(markdown: string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const issueRef = /(^|[^A-Za-z0-9_])#(\d+)\b/gm;
  for (const match of markdown.matchAll(issueRef)) {
    const issue = match[2];
    if (issue === undefined) continue;
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return counts;
}

function canonicalMarkdownOwners(
  owners: readonly CanonicalOwner[],
): readonly CanonicalOwner[] {
  return owners.filter((owner) => owner.path.endsWith(".md"));
}

function assertOwnerMapIntegrity(owners: readonly CanonicalOwner[]): void {
  for (const owner of owners) readCurrent(owner.path);
}

function assertStrictNoIssueReferences(owners: readonly CanonicalOwner[]): void {
  const violations: string[] = [];
  for (const owner of canonicalMarkdownOwners(owners)) {
    const counts = issueReferenceCounts(readCurrent(owner.path));
    for (const [issue, count] of counts) {
      violations.push(`${owner.path}: #${issue} (${count} occurrence${count === 1 ? "" : "s"})`);
    }
  }
  if (violations.length > 0) {
    fail(
      `strict mode forbids GitHub issue-number status/dependency references in canonical docs:\n${violations
        .sort()
        .map((entry) => `  - ${entry}`)
        .join("\n")}`,
    );
  }
}

function assertNoNewIssueReferences(
  owners: readonly CanonicalOwner[],
  baseRef: string,
): void {
  const baseMap = readAtGitRef(baseRef, OWNER_MAP_PATH);
  const baseOwners = baseMap === undefined ? [] : parseCanonicalOwners(baseMap);
  const paths = new Set([
    ...canonicalMarkdownOwners(baseOwners).map((owner) => owner.path),
    ...canonicalMarkdownOwners(owners).map((owner) => owner.path),
  ]);
  const violations: string[] = [];

  for (const path of paths) {
    const current = existsSync(resolve(REPO_ROOT, path)) ? readCurrent(path) : undefined;
    if (current === undefined) continue;
    const base = readAtGitRef(baseRef, path);
    if (base === undefined && TRANSITIONAL_NEW_OWNER_EXEMPTIONS.has(path)) {
      console.warn(
        `documentation-authority: transitional exemption for newly introduced canonical owner ${path}`,
      );
      continue;
    }

    const baseCounts = issueReferenceCounts(base ?? "");
    const currentCounts = issueReferenceCounts(current);
    for (const [issue, currentCount] of currentCounts) {
      const baseCount = baseCounts.get(issue) ?? 0;
      if (currentCount > baseCount) {
        violations.push(
          `${path}: #${issue} increased from ${baseCount} to ${currentCount}`,
        );
      }
    }
  }

  if (violations.length > 0) {
    fail(
      `canonical docs may not add mutable GitHub issue-number status/dependency copies:\n${violations
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
  assertStrictNoIssueReferences(currentOwners);
} else if (baseRef !== undefined) {
  assertNoNewIssueReferences(currentOwners, baseRef);
}

console.log(
  `documentation-authority: OK (${currentOwners.length} canonical concerns; mode=${
    strict ? "strict" : baseRef === undefined ? "map" : `incremental:${baseRef}`
  })`,
);
