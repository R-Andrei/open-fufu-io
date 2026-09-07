import type { CellSelector } from "../src/core/controller/ControllerApi";
import {
  STRUCTURE_FIELD_IDS,
  isValidRuleCondition,
} from "../src/core/rules/RuleComposition";

describe("Observation structure-field vocabulary", () => {
  it("surfaces the authoritative Observation field through STRUCTURE_FIELD", () => {
    expect(STRUCTURE_FIELD_IDS).toContain("OBSERVATION");

    const selector: CellSelector = {
      kind: "STRUCTURE_FIELD",
      field: "OBSERVATION",
      referenceFactionId: "A",
      affiliation: "SELF",
    };
    expect(selector.field).toBe("OBSERVATION");
  });

  it("permits Observation field membership for event consumers but not pressure-source conditions", () => {
    expect(
      isValidRuleCondition({
        kind: "EVENT_INSIDE_FIELD",
        field: "OBSERVATION",
        affiliation: "SELF",
      }),
    ).toBe(true);
    expect(
      isValidRuleCondition({
        kind: "SOURCE_INSIDE_FIELD",
        field: "OBSERVATION",
        affiliation: "SELF",
      }),
    ).toBe(false);
  });
});
