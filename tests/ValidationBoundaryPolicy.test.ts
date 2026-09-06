import { describe, expect, it } from "vitest";
import {
  isExecutableCodePath,
  validateChangedPaths,
  validateOwnershipDelta,
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
  it("treats common repository source formats and tests as code-bearing artifacts", () => {
    expect(isExecutableCodePath("src/core/Owned.ts")).toBe(true);
    expect(isExecutableCodePath("tests/Owned.test.ts")).toBe(true);
    expect(isExecutableCodePath("map-generator/main.go")).toBe(true);
    expect(isExecutableCodePath("scripts/tool.py")).toBe(true);
    expect(isExecutableCodePath("scripts/tool.sh")).toBe(true);
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

  it("rejects manifest-only revival of an inherited test after bootstrap", () => {
    const headManifest: ValidationManifest = {
      ...manifest,
      ownedTests: [...manifest.ownedTests, "tests/LegacyRevival.test.ts"],
    };

    const errors = validateOwnershipDelta(
      [{ status: "M", path: "validation/open-fufu-owned.json" }],
      headManifest,
      manifest,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("manifest-only registration");
  });

  it("rejects newly adopted source code that only points at an untouched validator", () => {
    const headManifest: ValidationManifest = {
      ...manifest,
      ownedSources: [
        ...manifest.ownedSources,
        {
          path: "src/core/NewOwned.ts",
          validators: ["tests/Owned.test.ts"],
        },
      ],
    };

    const errors = validateOwnershipDelta(
      [
        { status: "M", path: "validation/open-fufu-owned.json" },
        { status: "M", path: "src/core/NewOwned.ts" },
      ],
      headManifest,
      manifest,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("no validator added or modified");
  });

  it("allows intentional adoption when its registered validator changes with it", () => {
    const headManifest: ValidationManifest = {
      ...manifest,
      ownedSources: [
        ...manifest.ownedSources,
        {
          path: "src/core/NewOwned.ts",
          validators: ["tests/Owned.test.ts"],
        },
      ],
    };

    expect(
      validateOwnershipDelta(
        [
          { status: "M", path: "validation/open-fufu-owned.json" },
          { status: "M", path: "src/core/NewOwned.ts" },
          { status: "M", path: "tests/Owned.test.ts" },
        ],
        headManifest,
        manifest,
      ),
    ).toEqual([]);
  });

  it("permits the one-time ownership-manifest bootstrap", () => {
    expect(
      validateOwnershipDelta(
        [{ status: "A", path: "validation/open-fufu-owned.json" }],
        manifest,
        null,
      ),
    ).toEqual([]);
  });

  it("keeps the repository's live validation wiring inside the owned boundary", () => {
    expect(validateStaticPolicy()).toEqual([]);
  });
});
