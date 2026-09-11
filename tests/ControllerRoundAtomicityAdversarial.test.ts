import type { ControllerDecision } from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  InProcessTestControllerHost,
  projectLawfulControllerObservation,
  type ControllerHost,
  type ControllerHostInvocationResult,
  type ControllerRoundReceipt,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function runtime() {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed: "controller-round-atomicity-adversarial",
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function structureRuntime(seed: string) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function grantedFortRuntime(seed: string, level: 1 | 2 | 3 | 4 | 5 = 1) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "fort-alpha-internal",
          ownerId: "alpha",
          type: "FORT",
          cellId: 0,
          level,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function twoBuildRuntime(seed: string) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "beta"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function hostWithInvoke(
  invoke: ControllerHost["invoke"],
): ControllerHost {
  return {
    invoke,
    chooseInfluence: () => ({ ok: true }),
    reconsiderInfluence: () => ({ ok: true }),
    chooseOrigins: () => ({ ok: true }),
  };
}

function capitulate(key: string): ControllerHostInvocationResult<ControllerDecision> {
  return Object.freeze({
    ok: true as const,
    output: Object.freeze({
      commands: Object.freeze([
        Object.freeze({ kind: "CAPITULATE" as const, key }),
      ]),
    }),
  });
}

function syncReceipts(
  value:
    | readonly ControllerRoundReceipt[]
    | Promise<readonly ControllerRoundReceipt[]>,
): readonly ControllerRoundReceipt[] {
  expect(value).not.toBeInstanceOf(Promise);
  return value as readonly ControllerRoundReceipt[];
}

function receiptFor(
  receipts: readonly ControllerRoundReceipt[],
  factionId: string,
) {
  const receipt = receipts.find((entry) => entry.factionId === factionId)?.receipt;
  if (receipt === undefined) throw new Error(`missing ${factionId} receipt`);
  return receipt;
}

function buildFortHost(key: string) {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        commands: [
          {
            kind: "BUILD_STRUCTURE" as const,
            key,
            structure: "FORT" as const,
            cellId: 0,
          },
        ],
      };
    },
  });
}

function upgradeFortHost(key: string) {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        commands: [
          {
            kind: "UPGRADE_STRUCTURE",
            key,
            cellId: 0,
          },
        ],
      } as unknown as ControllerDecision;
    },
  });
}

function legacyUpgradeHost(key: string) {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        commands: [
          {
            kind: "UPGRADE_STRUCTURE",
            key,
            structureId: "fort-alpha-internal",
          },
        ],
      } as unknown as ControllerDecision;
    },
  });
}

function buildAction(match: MatchRuntime) {
  const action = match
    .acceptedInputs()
    .map((input) => input.action)
    .find((candidate) => candidate.type === "PURCHASE_STRUCTURE_BUILD");
  if (action === undefined || action.type !== "PURCHASE_STRUCTURE_BUILD") {
    throw new Error("missing accepted structure build action");
  }
  return action;
}

function upgradeAction(match: MatchRuntime) {
  const action = match
    .acceptedInputs()
    .map((input) => input.action)
    .find((candidate) => candidate.type === "PURCHASE_STRUCTURE_UPGRADE");
  if (action === undefined || action.type !== "PURCHASE_STRUCTURE_UPGRADE") {
    throw new Error("missing accepted structure upgrade action");
  }
  return action;
}

describe("controller-round transaction adversarial behavior", () => {
  it("rejects external authoritative input admission while an async controller round is pending", async () => {
    const match = runtime();
    let resolveAlpha!: (
      result: ControllerHostInvocationResult<ControllerDecision>,
    ) => void;
    const pendingAlpha = new Promise<ControllerHostInvocationResult<ControllerDecision>>(
      (resolve) => {
        resolveAlpha = resolve;
      },
    );

    const round = match.runControllerRound(
      hostWithInvoke((factionId) =>
        factionId === "alpha" ? pendingAlpha : Object.freeze({ ok: true as const }),
      ),
    );
    expect(round).toBeInstanceOf(Promise);

    expect(() =>
      match.acceptAction({
        type: "SET_TEST_MARKER",
        factionId: "beta",
        value: 91,
      }),
    ).toThrow(/controller round is in progress/i);
    expect(match.acceptedInputs()).toEqual([]);

    resolveAlpha(Object.freeze({ ok: true as const }));
    await round;
    expect(match.acceptedInputs()).toEqual([]);
  });

  it("rejects reentrant authoritative input admission from a synchronous controller host", () => {
    const match = runtime();
    let reentrantError: unknown;

    match.runControllerRound(
      hostWithInvoke((factionId) => {
        if (factionId === "alpha") {
          try {
            match.acceptAction({
              type: "SET_TEST_MARKER",
              factionId: "beta",
              value: 33,
            });
          } catch (error) {
            reentrantError = error;
          }
        }
        return Object.freeze({ ok: true as const });
      }),
    );

    expect(reentrantError).toBeInstanceOf(Error);
    expect(String(reentrantError)).toMatch(/controller round is in progress/i);
    expect(match.acceptedInputs()).toEqual([]);
  });

  it("projects authoritative self FFY/economy while keeping foreign FFY absent", () => {
    const match = structureRuntime("controller-economy-projection-red");
    const observation = projectLawfulControllerObservation(
      match.snapshot(),
      "alpha",
      0,
    ) as unknown as {
      readonly me: { readonly ffy: number };
      readonly factions: readonly {
        readonly id: string;
        readonly ffy?: number;
      }[];
      readonly economy: {
        readonly ffy: number;
        readonly passiveFfyPerSecond: number;
      };
    };

    expect(observation.me.ffy).toBe(25_000);
    expect(observation.economy).toEqual({
      ffy: 25_000,
      passiveFfyPerSecond: 1_000,
    });
    expect(Object.isFrozen(observation.economy)).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        observation.factions.find((faction) => faction.id === "beta"),
        "ffy",
      ),
    ).toBe(false);
  });

  it("routes an affordable BUILD_STRUCTURE through the authoritative purchase action with engine-owned deterministic identity", () => {
    const first = structureRuntime("controller-build-route-red");
    const second = structureRuntime("controller-build-route-red");
    for (let tick = 0; tick < 250; tick += 1) {
      first.tick();
      second.tick();
    }

    const firstReceipts = syncReceipts(
      first.runControllerRound(buildFortHost("controller-key-a")),
    );
    const secondReceipts = syncReceipts(
      second.runControllerRound(buildFortHost("different-controller-key")),
    );

    expect(receiptFor(firstReceipts, "alpha")).toMatchObject({ accepted: true });
    expect(receiptFor(secondReceipts, "alpha")).toMatchObject({ accepted: true });

    const firstAction = buildAction(first);
    const secondAction = buildAction(second);
    expect(firstAction).toMatchObject({
      ownerId: "alpha",
      structureType: "FORT",
      cellId: 0,
    });
    expect(firstAction.structureId).not.toBe("controller-key-a");
    expect(secondAction.structureId).not.toBe("different-controller-key");
    expect(secondAction.structureId).toBe(firstAction.structureId);
  });

  it("returns precise authoritative structure rejection without admitting or mutating an unaffordable build", () => {
    const match = structureRuntime("controller-build-rejection-red");

    const receipts = syncReceipts(
      match.runControllerRound(buildFortHost("unaffordable-fort")),
    );

    expect(receiptFor(receipts, "alpha")).toMatchObject({
      accepted: false,
      failure: {
        code: "INSUFFICIENT_FFY",
        key: "unaffordable-fort",
      },
    });
    expect(match.acceptedInputs()).toEqual([]);
    expect(match.snapshot().structures).toEqual([]);
  });

  it("accepts UPGRADE_STRUCTURE by public cell and resolves the authoritative internal structure identity", () => {
    const match = grantedFortRuntime("controller-upgrade-cell-route-red");
    for (let tick = 0; tick < 750; tick += 1) match.tick();

    const receipts = syncReceipts(
      match.runControllerRound(upgradeFortHost("upgrade-fort-by-cell")),
    );

    expect(receiptFor(receipts, "alpha")).toMatchObject({ accepted: true });
    expect(upgradeAction(match)).toEqual({
      type: "PURCHASE_STRUCTURE_UPGRADE",
      structureId: "fort-alpha-internal",
      ownerId: "alpha",
    });
  });

  it("returns precise MAX_LEVEL for an owned completed L5 structure targeted by cell", () => {
    const match = grantedFortRuntime("controller-upgrade-max-level-red", 5);

    const receipts = syncReceipts(
      match.runControllerRound(upgradeFortHost("upgrade-max-level-fort")),
    );

    expect(receiptFor(receipts, "alpha")).toMatchObject({
      accepted: false,
      failure: {
        code: "MAX_LEVEL",
        key: "upgrade-max-level-fort",
      },
    });
    expect(match.acceptedInputs()).toEqual([]);
  });

  it("treats legacy internal-ID UPGRADE_STRUCTURE output as malformed controller output", () => {
    const match = grantedFortRuntime("controller-upgrade-legacy-id-red");

    const receipts = syncReceipts(
      match.runControllerRound(legacyUpgradeHost("legacy-id-upgrade")),
    );

    expect(receiptFor(receipts, "alpha")).toMatchObject({
      accepted: false,
      failure: { code: "RUNTIME_ERROR" },
      faultCount: 1,
      faulted: false,
    });
    expect(match.acceptedInputs()).toEqual([]);
  });

  it("rolls back an entire proposal when an earlier affordable build consumes FFY needed by a later build", () => {
    const match = twoBuildRuntime("controller-two-build-aggregate-red");
    for (let tick = 0; tick < 250; tick += 1) match.tick();
    const host = new InProcessTestControllerHost({
      alpha() {
        return {
          commands: [
            {
              kind: "BUILD_STRUCTURE" as const,
              key: "first-fort",
              structure: "FORT" as const,
              cellId: 0,
            },
            {
              kind: "BUILD_STRUCTURE" as const,
              key: "second-fort",
              structure: "FORT" as const,
              cellId: 1,
            },
          ],
        };
      },
    });

    const receipts = syncReceipts(match.runControllerRound(host));

    expect(receiptFor(receipts, "alpha")).toMatchObject({
      accepted: false,
      failure: { code: "INSUFFICIENT_FFY", key: "second-fort" },
    });
    expect(match.acceptedInputs()).toEqual([]);
    expect(match.snapshot().structures).toEqual([]);
  });

  it("turns commit-time stale gameplay rejection into a structured per-controller receipt without partial proposal admission", () => {
    const match = runtime();
    const preexisting = match.acceptAction({
      type: "CAPITULATE_FACTION",
      factionId: "beta",
    });

    const receipts = syncReceipts(
      match.runControllerRound(
        hostWithInvoke((factionId) => capitulate(`${factionId}-capitulate`)),
      ),
    );

    expect(receiptFor(receipts, "alpha")).toMatchObject({ accepted: true });
    expect(receiptFor(receipts, "beta")).toMatchObject({
      accepted: false,
      failure: { code: "INVALID_TARGET", key: "beta-capitulate" },
    });
    expect(match.acceptedInputs()).toEqual([
      preexisting,
      expect.objectContaining({
        sequence: 1,
        action: { type: "CAPITULATE_FACTION", factionId: "alpha" },
      }),
    ]);

    const afterRejection = match.acceptAction({
      type: "SET_TEST_MARKER",
      factionId: "alpha",
      value: 17,
    });
    expect(afterRejection.sequence).toBe(2);
  });
});
