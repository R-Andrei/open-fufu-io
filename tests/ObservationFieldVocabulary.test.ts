import type {
  CellSelector,
  ControllerStructureFieldId,
  ObservationStructureEffect,
} from "../src/core/controller/ControllerApi";
import { controllerOutputHasExpectedStructure } from "../src/core/controller/ControllerOutputValidation";
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

describe("CounterResponse public identity validation", () => {
  it("accepts the public OperationRef field", () => {
    expect(
      controllerOutputHasExpectedStructure("DECIDE", {
        directives: {
          set: [
            {
              kind: "COUNTER_RESPONSE",
              key: "counter-ref",
              incomingOperation: "ofr1:counter-response:o:000000000001",
              population: 10,
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it("rejects the trusted raw OperationId compatibility field on public output", () => {
    expect(
      controllerOutputHasExpectedStructure("DECIDE", {
        directives: {
          set: [
            {
              kind: "COUNTER_RESPONSE",
              key: "counter-raw-id",
              incomingOperationId: "operation-authoritative-1",
              population: 10,
            },
          ],
        },
      }),
    ).toBe(false);
  });
});