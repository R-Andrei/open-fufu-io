import type {
  CellSelector,
  ControllerStructureFieldId,
  ObservationStructureEffect,
} from "../src/core/controller/ControllerApi";
import { controllerOutputHasExpectedStructure } from "../src/core/controller/ControllerOutputValidation";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { STRUCTURE_FIELD_IDS } from "../src/core/rules/RuleComposition";
import {
  InProcessTestControllerHost,
  type ControllerHost,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

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

  it("resolves an acquired OperationRef to trusted internal identity before applying a counter-response", () => {
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "counter-response-ref-resolution",
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: "counter-response-ref-resolution" },
    );
    match.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 10,
    });
    match.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "beta",
      amount: 10,
    });
    match.tick();

    const attackReceipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION" as const,
                  key: "incoming-attack",
                  operation: "ATTACK" as const,
                  population: 1,
                  targetFactionId: "beta",
                  source: { kind: "CELLS" as const, ids: [0] },
                  target: { kind: "CELLS" as const, ids: [1] },
                },
              ],
            },
          };
        },
      }),
    );
    expect(attackReceipts).not.toBeInstanceOf(Promise);
    expect(
      (attackReceipts as readonly {
        factionId: string;
        receipt: { accepted: boolean };
      }[]).find((entry) => entry.factionId === "alpha")?.receipt.accepted,
    ).toBe(true);

    match.tick();

    let incomingOperationRef: string | undefined;
    const counterHost: ControllerHost = {
      invoke(factionId, _observation, querySession) {
        if (factionId !== "beta") return Object.freeze({ ok: true as const });
        const incoming = querySession?.operations.incoming() ?? [];
        expect(incoming).toHaveLength(1);
        incomingOperationRef = incoming[0]!.ref;
        return Object.freeze({
          ok: true as const,
          output: {
            directives: {
              set: [
                {
                  kind: "COUNTER_RESPONSE" as const,
                  key: "counter-by-ref",
                  incomingOperation: incomingOperationRef,
                  population: 1,
                },
              ],
            },
          } as unknown as never,
        });
      },
      chooseInfluence() {
        return Object.freeze({ ok: true as const });
      },
      reconsiderInfluence() {
        return Object.freeze({ ok: true as const });
      },
      chooseOrigins() {
        return Object.freeze({ ok: true as const });
      },
    };
    const counterReceipts = match.runControllerRound(counterHost);
    expect(counterReceipts).not.toBeInstanceOf(Promise);
    expect(incomingOperationRef).toEqual(expect.any(String));
    expect(
      (counterReceipts as readonly {
        factionId: string;
        receipt: { accepted: boolean };
      }[]).find((entry) => entry.factionId === "beta")?.receipt.accepted,
    ).toBe(true);

    const trustedDirective = match
      .acceptedInputs()
      .flatMap((input) =>
        input.action.type === "APPLY_PERSISTENT_DIRECTIVES"
          ? (input.action.changes.set ?? [])
          : [],
      )
      .find((directive) => directive.key === "counter-by-ref") as
      | Readonly<Record<string, unknown>>
      | undefined;
    expect(trustedDirective).toMatchObject({
      kind: "COUNTER_RESPONSE",
      incomingOperationId: expect.any(String),
      population: 1,
    });
    expect(trustedDirective).not.toHaveProperty("incomingOperation");
    expect(trustedDirective?.incomingOperationId).not.toBe(incomingOperationRef);
  });
});