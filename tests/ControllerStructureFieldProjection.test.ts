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
  it("re-exports the exact canonical rule-condition field vocabulary", () => {
    expect(CONTROLLER_FIELD_IDS).toBe(STRUCTURE_FIELD_IDS);
    expect(CONTROLLER_FIELD_AFFILIATIONS).toBe(STRUCTURE_FIELD_AFFILIATIONS);
    expect([...CONTROLLER_FIELD_IDS]).toEqual([
      "FORT",
      "SAM_LAUNCHER",
      "COMMAND_POST",
    ]);
    expect(CONTROLLER_FIELD_IDS).not.toContain("SAM" as never);
  });

  it("surfaces one opaque authoritative STRUCTURE_FIELD selector", () => {
    const source = readFileSync(
      "src/core/controller/ControllerApi.ts",
      "utf8",
    );
    expect(source).toContain('readonly kind: "STRUCTURE_FIELD";');
    expect(source).toContain("readonly field: StructureFieldId;");
    expect(source).toContain("readonly referenceFactionId: FactionId;");
    expect(source).toContain("readonly affiliation: StructureFieldAffiliation;");
    expect(source).toContain(
      "controllers must not approximate this with CIRCLE",
    );
  });
});
