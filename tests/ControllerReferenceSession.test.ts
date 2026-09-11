import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  ControllerReferenceSession,
  type ControllerReferenceDomain,
} from "../src/simulation/ControllerReferenceSession";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function baseState(seed = "controller-reference-session"): MatchState {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 3,
      height: 1,
      initialOwners: ["alpha", "alpha", "alpha"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
      initialStructureGrants: [
        {
          structureId: "shared-structure-id",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          level: 1,
        },
      ],
    }),
  );
}

function stateWithUnit(state: MatchState): MatchState {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 1,
    },
  );
  return createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
  });
}

function operation(
  population: number,
  targetCellId = 2,
): MatchState["operations"][number] {
  return Object.freeze({
    id: 'land:["alpha","north"]',
    controllerKey: "north",
    kind: "NEUTRAL_EXPANSION" as const,
    ownerId: "alpha",
    committedPopulation: population,
    source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
    target: Object.freeze({
      kind: "CELLS" as const,
      ids: Object.freeze([targetCellId]),
    }),
  });
}

function withOperation(
  state: MatchState,
  population: number,
  targetCellId = 2,
): MatchState {
  return createProspectiveMatchState(state, {
    operations: Object.freeze([operation(population, targetCellId)]),
  });
}

function expectResolvable(
  session: ControllerReferenceSession,
  viewer: string,
  domain: ControllerReferenceDomain,
  authoritativeId: string,
): string {
  const ref = session.issue(viewer, domain, authoritativeId);
  expect(ref).toBeDefined();
  expect(session.resolve(viewer, domain, ref!)).toBe(authoritativeId);
  return ref!;
}

describe("controller reference session", () => {
  it("issues stable viewer-scoped refs without cross-domain, cross-viewer, fabricated, or cross-match aliasing", () => {
    const state = stateWithUnit(withOperation(baseState(), 2));
    const first = new ControllerReferenceSession("match-a", state);
    const second = new ControllerReferenceSession("match-b", state);

    const alphaStructure = expectResolvable(
      first,
      "alpha",
      "STRUCTURE",
      "shared-structure-id",
    );
    const alphaStructureAgain = expectResolvable(
      first,
      "alpha",
      "STRUCTURE",
      "shared-structure-id",
    );
    const betaStructure = expectResolvable(
      first,
      "beta",
      "STRUCTURE",
      "shared-structure-id",
    );
    const otherMatchStructure = expectResolvable(
      second,
      "alpha",
      "STRUCTURE",
      "shared-structure-id",
    );

    expect(alphaStructureAgain).toBe(alphaStructure);
    expect(betaStructure).not.toBe(alphaStructure);
    expect(otherMatchStructure).not.toBe(alphaStructure);
    expect(first.resolve("beta", "STRUCTURE", alphaStructure)).toBeUndefined();
    expect(first.resolve("alpha", "UNIT", alphaStructure)).toBeUndefined();
    expect(first.resolve("alpha", "STRUCTURE", "fabricated-ref")).toBeUndefined();
    expect(second.resolve("alpha", "STRUCTURE", alphaStructure)).toBeUndefined();
    expect(first.issue("alpha", "UNIT", "does-not-exist")).toBeUndefined();
  });

  it("keeps a unit ref across movement and never aliases a destroyed/recreated structure incarnation", () => {
    const initial = stateWithUnit(baseState("reference-lifecycle"));
    const session = new ControllerReferenceSession("lifecycle-match", initial);
    const unitId = initial.mobileUnits[0]!.id;
    const unitRef = expectResolvable(session, "alpha", "UNIT", unitId);
    const firstStructureRef = expectResolvable(
      session,
      "alpha",
      "STRUCTURE",
      "shared-structure-id",
    );

    const moved = createProspectiveMatchState(initial, {
      mobileUnits: Object.freeze([
        Object.freeze({ ...initial.mobileUnits[0]!, cellId: 2 }),
      ]),
    });
    session.reconcile(moved);
    expect(expectResolvable(session, "alpha", "UNIT", unitId)).toBe(unitRef);

    const destroyed = createProspectiveMatchState(moved, {
      structures: Object.freeze([]),
    });
    session.reconcile(destroyed);
    expect(
      session.resolve("alpha", "STRUCTURE", firstStructureRef),
    ).toBeUndefined();

    const recreated = createProspectiveMatchState(destroyed, {
      structures: initial.structures,
    });
    session.reconcile(recreated);
    const replacementRef = expectResolvable(
      session,
      "alpha",
      "STRUCTURE",
      "shared-structure-id",
    );
    expect(replacementRef).not.toBe(firstStructureRef);
    expect(
      session.resolve("alpha", "STRUCTURE", firstStructureRef),
    ).toBeUndefined();
  });

  it("keeps an OperationRef for continuous directive-key lifetime but replaces it after end/recreate", () => {
    const initial = withOperation(baseState("operation-reference-lifecycle"), 2);
    const session = new ControllerReferenceSession("operation-match", initial);
    const operationId = initial.operations[0]!.id;
    const firstRef = expectResolvable(
      session,
      "alpha",
      "OPERATION",
      operationId,
    );

    session.applyDirectiveChanges("alpha", {
      set: [
        {
          kind: "LAND_OPERATION",
          key: "north",
          operation: "NEUTRAL_EXPANSION",
          population: 3,
          source: { kind: "CELLS", ids: [0] },
          target: { kind: "CELLS", ids: [1] },
        },
      ],
    });
    const updated = withOperation(initial, 3, 1);
    session.reconcile(updated);
    expect(
      expectResolvable(session, "alpha", "OPERATION", updated.operations[0]!.id),
    ).toBe(firstRef);

    session.applyDirectiveChanges("alpha", { end: ["north"] });
    const ended = createProspectiveMatchState(updated, {
      operations: Object.freeze([]),
    });
    session.reconcile(ended);
    expect(session.resolve("alpha", "OPERATION", firstRef)).toBeUndefined();

    session.applyDirectiveChanges("alpha", {
      set: [
        {
          kind: "LAND_OPERATION",
          key: "north",
          operation: "NEUTRAL_EXPANSION",
          population: 1,
          source: { kind: "CELLS", ids: [0] },
          target: { kind: "CELLS", ids: [2] },
        },
      ],
    });
    const recreated = withOperation(ended, 1, 2);
    session.reconcile(recreated);
    const replacementRef = expectResolvable(
      session,
      "alpha",
      "OPERATION",
      recreated.operations[0]!.id,
    );
    expect(replacementRef).not.toBe(firstRef);
  });

  it("is MatchRuntime-owned, lifecycle-aware, and excluded from canonical replay/fingerprints", () => {
    const rules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "reference-runtime",
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });
    const runtime = new MatchRuntime(spec, {
      controllerReferenceNamespace: "live-match-a",
    });

    runtime.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 10,
    });
    runtime.tick();
    runtime.acceptAction({
      type: "APPLY_PERSISTENT_DIRECTIVES",
      factionId: "alpha",
      changes: {
        set: [
          {
            kind: "LAND_OPERATION",
            key: "north",
            operation: "NEUTRAL_EXPANSION",
            population: 2,
            source: { kind: "CELLS", ids: [0] },
            target: { kind: "CELLS", ids: [1] },
          },
        ],
      },
    });
    runtime.tick();

    const firstOperationId = runtime.snapshot().operations[0]!.id;
    const beforeIssueFingerprint = runtime.stateFingerprint();
    const firstRef = expectResolvable(
      runtime.controllerReferenceSession(),
      "alpha",
      "OPERATION",
      firstOperationId,
    );
    expect(runtime.stateFingerprint()).toBe(beforeIssueFingerprint);

    runtime.acceptAction({
      type: "APPLY_PERSISTENT_DIRECTIVES",
      factionId: "alpha",
      changes: {
        set: [
          {
            kind: "LAND_OPERATION",
            key: "north",
            operation: "NEUTRAL_EXPANSION",
            population: 3,
            source: { kind: "CELLS", ids: [0] },
            target: { kind: "CELLS", ids: [1] },
          },
        ],
      },
    });
    runtime.tick();
    expect(
      expectResolvable(
        runtime.controllerReferenceSession(),
        "alpha",
        "OPERATION",
        runtime.snapshot().operations[0]!.id,
      ),
    ).toBe(firstRef);

    runtime.acceptAction({
      type: "APPLY_PERSISTENT_DIRECTIVES",
      factionId: "alpha",
      changes: { end: ["north"] },
    });
    runtime.tick();
    expect(
      runtime
        .controllerReferenceSession()
        .resolve("alpha", "OPERATION", firstRef),
    ).toBeUndefined();

    runtime.acceptAction({
      type: "APPLY_PERSISTENT_DIRECTIVES",
      factionId: "alpha",
      changes: {
        set: [
          {
            kind: "LAND_OPERATION",
            key: "north",
            operation: "NEUTRAL_EXPANSION",
            population: 1,
            source: { kind: "CELLS", ids: [0] },
            target: { kind: "CELLS", ids: [1] },
          },
        ],
      },
    });
    runtime.tick();
    const replacementRef = expectResolvable(
      runtime.controllerReferenceSession(),
      "alpha",
      "OPERATION",
      runtime.snapshot().operations[0]!.id,
    );
    expect(replacementRef).not.toBe(firstRef);

    const regenerated = MatchRuntime.regenerate(
      spec,
      runtime.acceptedInputs(),
      runtime.snapshot().tick,
      { controllerReferenceNamespace: "live-match-b" },
    );
    const regeneratedRef = expectResolvable(
      regenerated.controllerReferenceSession(),
      "alpha",
      "OPERATION",
      regenerated.snapshot().operations[0]!.id,
    );
    expect(regeneratedRef).not.toBe(replacementRef);
    expect(
      regenerated
        .controllerReferenceSession()
        .resolve("alpha", "OPERATION", replacementRef),
    ).toBeUndefined();
    expect(regenerated.snapshot()).toEqual(runtime.snapshot());
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
  });
});
