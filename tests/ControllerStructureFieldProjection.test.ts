import { readFileSync } from "node:fs";
import {
  STRUCTURE_FIELD_AFFILIATIONS as CONTROLLER_FIELD_AFFILIATIONS,
  STRUCTURE_FIELD_IDS as CONTROLLER_FIELD_IDS,
} from "../src/core/controller/ControllerApi";
import {
  STRUCTURE_FIELD_AFFILIATIONS,
  STRUCTURE_FIELD_IDS,
} from "../src/core/rules/RuleComposition";

describe("controller structure-field projection", () => {
  it("re-exports the exact rule-condition field vocabulary", () => {
    expect(CONTROLLER_FIELD_IDS).toBe(STRUCTURE_FIELD_IDS);
    expect(CONTROLLER_FIELD_AFFILIATIONS).toBe(STRUCTURE_FIELD_AFFILIATIONS);
  });

  it("surfaces one opaque authoritative STRUCTURE_FIELD selector", () => {
    const source = readFileSync("src/core/controller/ControllerApi.ts", "utf8");
    expect(source).toContain('readonly kind: "STRUCTURE_FIELD";');
    expect(source).toContain("readonly field: ControllerStructureFieldId;");
    expect(source).toContain("readonly referenceFactionId: FactionId;");
    expect(source).toContain(
      "readonly affiliation: StructureFieldAffiliation;",
    );
    expect(source).toContain(
      "controllers must not approximate this with CIRCLE",
    );
  });

  it("surfaces authoritative per-structure field selection for P27", () => {
    const source = readFileSync("src/core/controller/ControllerApi.ts", "utf8");
    expect(source).toContain('readonly kind: "STRUCTURE_FIELD_INSTANCE";');
    expect(source).toContain("readonly structureId: StructureId;");
    expect(source).toContain("readonly field: StructureFieldId;");
    expect(source).toContain(
      'readonly eligibilityField: Extract<StructureFieldId, "SAM">;',
    );
    expect(source).toContain("numeric interceptionRange is ergonomic only");
  });
});
