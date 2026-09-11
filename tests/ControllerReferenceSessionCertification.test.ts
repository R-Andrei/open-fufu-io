import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function collidingStructureState(structureId: string) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "controller-reference-value-collision",
      width: 1,
      height: 1,
      terrain: ["PLAINS"],
      initialOwners: ["alpha"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
      initialStructureGrants: [
        {
          structureId,
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          level: 1,
        },
      ],
    }),
  );
}

function operationBaseState(): MatchState {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "controller-reference-kind-replacement",
      width: 2,
      height: 1,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

describe("controller reference session certification", () => {
  it("never exposes the underlying authoritative identity as the public ref value", () => {
    const authoritativeId = "ofr1:collision-match:0:s:0";
    const session = new ControllerReferenceSession(
      "collision-match",
      collidingStructureState(authoritativeId),
    );

    const ref = session.issue("alpha", "STRUCTURE", authoritativeId);
    expect(ref).toBeDefined();
    expect(ref).not.toBe(authoritativeId);
    expect(session.resolve("alpha", "STRUCTURE", ref!)).toBe(authoritativeId);
  });

  it("requires every MatchRuntime to receive an explicit live-match reference namespace", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const spec = createMicroSimulationSpec({
      seed: "controller-reference-runtime-ownership",
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });

    expect(() => new MatchRuntime(spec)).toThrow(
      "controller reference namespace is required",
    );
  });

  it("ends an operation incarnation when the same key is replaced by another directive kind", () => {
    const base = operationBaseState();
    const incomingId = 'land:["beta","attack"]';
    const landId = 'land:["alpha","north"]';
    const counterId = 'counter:["alpha","north"]';
    const incoming = Object.freeze({
      id: incomingId,
      controllerKey: "attack",
      kind: "ATTACK" as const,
      ownerId: "beta",
      targetFactionId: "alpha",
      committedPopulation: 1,
      source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([1]) }),
      target: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
    });
    const initial = createProspectiveMatchState(base, {
      operations: Object.freeze([
        Object.freeze({
          id: landId,
          controllerKey: "north",
          kind: "NEUTRAL_EXPANSION" as const,
          ownerId: "alpha",
          committedPopulation: 1,
          source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
          target: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([1]) }),
        }),
        incoming,
      ]),
    });
    const session = new ControllerReferenceSession("kind-match", initial);
    const firstRef = session.issue("alpha", "OPERATION", landId);
    expect(firstRef).toBeDefined();

    session.applyDirectiveChanges("alpha", {
      set: [
        {
          kind: "COUNTER_RESPONSE",
          key: "north",
          incomingOperationId: incomingId,
          population: 1,
        },
      ],
    });
    const replaced = createProspectiveMatchState(initial, {
      operations: Object.freeze([
        Object.freeze({
          id: counterId,
          controllerKey: "north",
          kind: "COUNTER_RESPONSE" as const,
          ownerId: "alpha",
          incomingOperationId: incomingId,
          committedPopulation: 1,
        }),
        incoming,
      ]),
    });
    session.reconcile(replaced);

    const replacementRef = session.issue("alpha", "OPERATION", counterId);
    expect(replacementRef).toBeDefined();
    expect(replacementRef).not.toBe(firstRef);
    expect(session.resolve("alpha", "OPERATION", firstRef!)).toBeUndefined();
  });
});
