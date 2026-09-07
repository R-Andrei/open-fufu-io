import type {
  CellSelector,
  ControllerStructureFieldId,
  ObservationStructureEffect,
} from "../src/core/controller/ControllerApi";
import { STRUCTURE_FIELD_IDS } from "../src/core/rules/RuleComposition";

describe("Observation structure-field query vocabulary", () => {
  it("surfaces Observation to controller queries without widening rule-condition fields", () => {
    const field: ControllerStructureFieldId = "OBSERVATION";
    const selector: CellSelector = {
      kind: "STRUCTURE_FIELD",
      field,
      referenceFactionId: "A",
      affiliation: "SELF",
    };

    expect(selector.field).toBe("OBSERVATION");
    expect(STRUCTURE_FIELD_IDS).not.toContain("OBSERVATION");
  });

  it("surfaces ordinary reveal and transformed blackout effects", () => {
    const reveal: ObservationStructureEffect = "REVEAL";
    const blackout: ObservationStructureEffect = "ENEMY_BLACKOUT";

    expect(reveal).toBe("REVEAL");
    expect(blackout).toBe("ENEMY_BLACKOUT");
  });
});
