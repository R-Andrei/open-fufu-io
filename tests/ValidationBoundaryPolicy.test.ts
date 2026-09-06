import { describe, expect, it } from "vitest";
import {
  isExecutableCodePath,
  validateChangedPaths,
  validateStaticPolicy,
  type ValidationManifest,
} from "../scripts/checkValidationBoundary";

const manifest: ValidationManifest = {
  schemaVersion: 1,
  policyDocument: "docs/VALIDATION_POLICY.md",
  ownedWorkflows: [".github/workflows/ci.yml"],
  ownedTests: ["tests/Owned.test.ts"],
  ownedSources: [
    {
      path: "src/core/Owned.ts",
      validators: ["tests/Owned.test.ts"],
    },
  ],
};

describe("Open Fufu validation ownership boundary", () => {
  it("treats executable source and test files as code-bearing artifacts", () => {
    expect(isExecutableCodePath("src/core/Owned.ts")).toBe(true);
    expect(isExecutableCodePath("tests/Owned.test.ts")).toBe(true);
    expect(isExecutableCodePath("docs/README.md")).toBe(false);
  });

  it("rejects modifications to inherited executable code until explicitly adopted", () => {
    const errors = validateChangedPaths(
      [{ status: "M", path: "src/inherited/OpenFrontThing.ts" }],
      manifest,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("not adopted by Open Fufu");
  });

  it("rejects new or modified tests that are not registered as Open Fufu-owned", () => {
    const errors = validateChangedPaths(
      [{ status: "A", path: "tests/LegacyRevival.test.ts" }],
      manifest,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("not Open Fufu-owned");
  });

  it("allows registered source, test, and workflow changes", () => {
    expect(
      validateChangedPaths(
        [
          { status: "M", path: "src/core/Owned.ts" },
          { status: "M", path: "tests/Owned.test.ts" },
          { status: "M", path: ".github/workflows/ci.yml" },
        ],
        manifest,
      ),
    ).toEqual([]);
  });

  it("allows deleting inherited code or tests without adopting them", () => {
    expect(
      validateChangedPaths(
        [
          { status: "D", path: "src/inherited/OpenFrontThing.ts" },
          { status: "D", path: "tests/OldOpenFront.test.ts" },
        ],
        manifest,
      ),
    ).toEqual([]);
  });

  it("keeps the repository's live validation wiring inside the owned boundary", () => {
    expect(validateStaticPolicy()).toEqual([]);
  });
});
