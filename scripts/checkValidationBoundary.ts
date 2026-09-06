import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface OwnedSource {
  path: string;
  validators: string[];
}

export interface ValidationManifest {
  schemaVersion: number;
  policyDocument: string;
  ownedWorkflows: string[];
  ownedTests: string[];
  ownedSources: OwnedSource[];
}

export interface ChangedPath {
  status: string;
  path: string;
}

const MANIFEST_PATH = "validation/open-fufu-owned.json";
const EXECUTABLE_CODE = /\.(?:[cm]?[jt]s|[jt]sx|go|py|sh|bash|zsh|fish|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|cs|java|kt|kts|swift|lua|rb|php)$/;

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadValidationManifest(root = process.cwd()): ValidationManifest {
  return readJson<ValidationManifest>(resolve(root, MANIFEST_PATH));
}

export function loadValidationManifestAtRef(
  ref: string,
  root = process.cwd(),
): ValidationManifest | null {
  try {
    const content = execFileSync(
      "git",
      ["show", `${ref}:${MANIFEST_PATH}`],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(content) as ValidationManifest;
  } catch {
    return null;
  }
}

export function isExecutableCodePath(path: string): boolean {
  return EXECUTABLE_CODE.test(path);
}

export function validateManifest(
  manifest: ValidationManifest,
  root = process.cwd(),
): string[] {
  const errors: string[] = [];

  if (manifest.schemaVersion !== 1) {
    errors.push(`Unsupported validation manifest schema ${manifest.schemaVersion}.`);
  }

  if (!existsSync(resolve(root, manifest.policyDocument))) {
    errors.push(`Validation policy document is missing: ${manifest.policyDocument}`);
  }

  if (!unique(manifest.ownedTests)) {
    errors.push("ownedTests contains duplicate paths.");
  }
  if (!unique(manifest.ownedWorkflows)) {
    errors.push("ownedWorkflows contains duplicate paths.");
  }

  const sourcePaths = manifest.ownedSources.map((entry) => entry.path);
  if (!unique(sourcePaths)) {
    errors.push("ownedSources contains duplicate paths.");
  }

  const validValidators = new Set([
    ...manifest.ownedTests,
    ...manifest.ownedWorkflows,
  ]);

  for (const test of manifest.ownedTests) {
    if (!test.startsWith("tests/") || !/\.test\.[cm]?[jt]sx?$/.test(test)) {
      errors.push(`Owned test is not an explicit test file: ${test}`);
    }
    if (!existsSync(resolve(root, test))) {
      errors.push(`Owned test is missing: ${test}`);
    }
  }

  for (const workflow of manifest.ownedWorkflows) {
    if (!workflow.startsWith(".github/workflows/")) {
      errors.push(`Owned workflow is outside .github/workflows: ${workflow}`);
    }
    if (!existsSync(resolve(root, workflow))) {
      errors.push(`Owned workflow is missing: ${workflow}`);
    }
  }

  const workflowDirectory = resolve(root, ".github/workflows");
  if (existsSync(workflowDirectory)) {
    const registeredWorkflows = new Set(manifest.ownedWorkflows);
    for (const entry of readdirSync(workflowDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) {
        continue;
      }
      const workflowPath = `.github/workflows/${entry.name}`;
      if (!registeredWorkflows.has(workflowPath)) {
        errors.push(
          `Repository workflow is not registered as Open Fufu-owned: ${workflowPath}.`,
        );
      }
    }
  }

  for (const source of manifest.ownedSources) {
    if (!isExecutableCodePath(source.path)) {
      errors.push(`Owned source is not executable code: ${source.path}`);
    }
    if (!existsSync(resolve(root, source.path))) {
      errors.push(`Owned source is missing: ${source.path}`);
    }
    if (source.validators.length === 0) {
      errors.push(`Owned source has no registered validator: ${source.path}`);
    }
    if (!unique(source.validators)) {
      errors.push(`Owned source has duplicate validators: ${source.path}`);
    }
    for (const validator of source.validators) {
      if (!validValidators.has(validator)) {
        errors.push(
          `Owned source ${source.path} references an unregistered validator: ${validator}`,
        );
      }
    }
  }

  return errors;
}

export function validateChangedPaths(
  changes: ChangedPath[],
  manifest: ValidationManifest,
): string[] {
  const errors: string[] = [];
  const ownedTests = new Set(manifest.ownedTests);
  const ownedSources = new Set(manifest.ownedSources.map((entry) => entry.path));
  const ownedWorkflows = new Set(manifest.ownedWorkflows);

  for (const change of changes) {
    if (change.status.startsWith("D")) {
      // Deleting inherited code/tests is always allowed; deletion does not adopt it.
      continue;
    }

    if (change.path.startsWith("tests/") && isExecutableCodePath(change.path)) {
      if (!ownedTests.has(change.path)) {
        errors.push(
          `Changed test/test-infrastructure is not Open Fufu-owned: ${change.path}. ` +
            `Register intentional Open Fufu tests in ${MANIFEST_PATH}; do not maintain inherited tests by accident.`,
        );
      }
      continue;
    }

    if (change.path.startsWith(".github/workflows/")) {
      if (!ownedWorkflows.has(change.path)) {
        errors.push(
          `Changed workflow is not registered as Open Fufu-owned: ${change.path}.`,
        );
      }
      continue;
    }

    if (isExecutableCodePath(change.path) && !ownedSources.has(change.path)) {
      errors.push(
        `Changed executable code is not adopted by Open Fufu: ${change.path}. ` +
          `Either revert the inherited-code change or register the source with at least one owned validator in ${MANIFEST_PATH}.`,
      );
    }
  }

  return errors;
}

export function validateOwnershipDelta(
  changes: ChangedPath[],
  manifest: ValidationManifest,
  baseManifest: ValidationManifest | null,
): string[] {
  // The first introduction of the ownership manifest is the explicit bootstrap.
  // Once it exists on the target base, every later expansion must carry reviewable
  // validation evidence in the same change.
  if (baseManifest === null) {
    return [];
  }

  const errors: string[] = [];
  const changedPaths = new Set(
    changes
      .filter((change) => !change.status.startsWith("D"))
      .map((change) => change.path),
  );
  const baseTests = new Set(baseManifest.ownedTests);
  const baseWorkflows = new Set(baseManifest.ownedWorkflows);
  const baseSources = new Set(baseManifest.ownedSources.map((entry) => entry.path));

  for (const test of manifest.ownedTests) {
    if (!baseTests.has(test) && !changedPaths.has(test)) {
      errors.push(
        `Newly registered owned test was not added or modified in this change: ${test}. ` +
          "Do not revive an inherited test by manifest-only registration.",
      );
    }
  }

  for (const workflow of manifest.ownedWorkflows) {
    if (!baseWorkflows.has(workflow) && !changedPaths.has(workflow)) {
      errors.push(
        `Newly registered owned workflow was not added or modified in this change: ${workflow}.`,
      );
    }
  }

  for (const source of manifest.ownedSources) {
    if (baseSources.has(source.path)) {
      continue;
    }
    if (!source.validators.some((validator) => changedPaths.has(validator))) {
      errors.push(
        `Newly adopted source has no validator added or modified in this change: ${source.path}. ` +
          "Adoption must carry reviewable validation evidence; pointing at an untouched existing validator is insufficient.",
      );
    }
  }

  return errors;
}

function workflowCommandErrors(
  workflowPath: string,
  content: string,
  manifest: ValidationManifest,
): string[] {
  const errors: string[] = [];
  const forbidden: Array<[RegExp, string]> = [
    [/npm run build-(?:prod|dev)/, "repository-wide inherited build/typecheck"],
    [/npm run lint(?::github|:eslint|:oxlint)?(?:\s|$)/, "repository-wide inherited lint"],
    [/tests\/server(?:\/|\b)/, "inherited server tests"],
    [/tests\/matchmaking(?:\/|\b)/, "inherited matchmaking tests"],
    [/legacy:test/, "explicit legacy test command"],
    [/vitest run[^\n]*--exclude/, "broad Vitest discovery with exclusions"],
  ];

  for (const [pattern, description] of forbidden) {
    if (pattern.test(content)) {
      errors.push(`${workflowPath} invokes ${description}.`);
    }
  }

  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes("vitest run")) {
      continue;
    }

    const block: string[] = [lines[index]];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^\s{6}-\s/.test(lines[next]) || /^\s{2}[A-Za-z0-9_-]+:\s*$/.test(lines[next])) {
        break;
      }
      block.push(lines[next]);
    }
    const commandBlock = block.join("\n");
    if (!manifest.ownedTests.some((test) => commandBlock.includes(test))) {
      errors.push(
        `${workflowPath} contains a Vitest invocation without an explicitly registered Open Fufu test.`,
      );
    }
  }

  return errors;
}

export function validateStaticPolicy(root = process.cwd()): string[] {
  const manifest = loadValidationManifest(root);
  const errors = validateManifest(manifest, root);

  const packageJson = readJson<{ scripts?: Record<string, string> }>(
    resolve(root, "package.json"),
  );
  if (packageJson.scripts?.test !== "vitest run") {
    errors.push(
      'package.json "test" must remain the manifest-backed default: "vitest run".',
    );
  }
  if (packageJson.scripts?.["test:coverage"] !== "vitest run --coverage") {
    errors.push(
      'package.json "test:coverage" must remain the manifest-backed default: "vitest run --coverage".',
    );
  }

  const vitestConfig = readFileSync(resolve(root, "vitest.config.ts"), "utf8");
  if (!vitestConfig.includes("include: manifest.ownedTests")) {
    errors.push(
      "vitest.config.ts must set test.include from validation/open-fufu-owned.json.",
    );
  }
  if (vitestConfig.includes("exclude:")) {
    errors.push(
      "vitest.config.ts must use an owned-test allowlist, not an inherited-test exclusion list.",
    );
  }

  for (const workflow of manifest.ownedWorkflows) {
    const content = readFileSync(resolve(root, workflow), "utf8");
    errors.push(...workflowCommandErrors(workflow, content, manifest));
  }

  return errors;
}

export function parseGitChanges(base: string, root = process.cwd()): ChangedPath[] {
  const output = execFileSync(
    "git",
    ["diff", "--name-status", "--find-renames", `${base}...HEAD`],
    { cwd: root, encoding: "utf8" },
  ).trim();

  if (!output) {
    return [];
  }

  return output.split("\n").map((line) => {
    const fields = line.split("\t");
    const status = fields[0];
    const path = status.startsWith("R") || status.startsWith("C")
      ? fields[2]
      : fields[1];
    return { status, path };
  });
}

function readBaseArgument(argv: string[]): string | null {
  const index = argv.indexOf("--base");
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  if (!value) {
    throw new Error("--base requires a git ref.");
  }
  return value;
}

function main(): void {
  const root = process.cwd();
  const manifest = loadValidationManifest(root);
  const errors = validateStaticPolicy(root);
  const base = readBaseArgument(process.argv.slice(2));

  if (base) {
    const changes = parseGitChanges(base, root);
    errors.push(...validateChangedPaths(changes, manifest));
    errors.push(
      ...validateOwnershipDelta(
        changes,
        manifest,
        loadValidationManifestAtRef(base, root),
      ),
    );
  }

  if (errors.length > 0) {
    console.error("Open Fufu validation boundary failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    base
      ? `Open Fufu validation boundary passed against ${base}.`
      : "Open Fufu validation boundary static policy passed.",
  );
}

const invokedModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedModule) {
  main();
}
