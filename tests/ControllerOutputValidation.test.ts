import type {
  ControllerDecision,
  ControllerMemory,
  SpawnInfluenceDecision,
} from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  InProcessTestControllerHost,
  type LawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
  type ControllerWorkerPool,
  type ControllerWorkerRequest,
  type ControllerWorkerResponse,
} from "../src/server/controller-runtime/ProductionControllerHost";

function ordinaryObservation(): LawfulControllerObservation {
  return Object.freeze({
    tick: 7,
    decisionNumber: 3,
    me: Object.freeze({
      id: "alpha",
      status: "ACTIVE" as const,
      population: Object.freeze({
        total: 10,
        available: 8,
        committedOffense: 2,
        committedCounterResponse: 0,
        aboardTransports: 0,
        neutralSettlementHalfResidual: 0,
      }),
    }),
    factions: Object.freeze([
      Object.freeze({ id: "alpha", status: "ACTIVE" as const }),
      Object.freeze({ id: "beta", status: "ACTIVE" as const }),
    ]),
    cells: Object.freeze([]),
  });
}

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function twoFactionRuntime(seed: string): MatchRuntime {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

const artifact: ControllerRuntimeArtifact = Object.freeze({
  moduleSource: "export function decide() { return { commands: [] }; }",
  entrypoints: Object.freeze({
    decide: "decide",
    chooseInfluence: "chooseInfluence",
  }),
});

class RecordingPool implements ControllerWorkerPool {
  readonly requests: ControllerWorkerRequest[] = [];

  constructor(
    private readonly handler: (
      request: ControllerWorkerRequest,
    ) => ControllerWorkerResponse | Promise<ControllerWorkerResponse>,
  ) {}

  async invoke(request: ControllerWorkerRequest): Promise<ControllerWorkerResponse> {
    this.requests.push(request);
    return this.handler(request);
  }
}

const zeroUsage = Object.freeze({ queries: 0, materializedCells: 0 });

function expectInvalidOutput(result: unknown): void {
  expect(result).toEqual({ ok: false, fault: { code: "INVALID_OUTPUT" } });
}

describe("controller whole-output structural validation", () => {
  it("rejects malformed nested in-process normal output before committing proposed memory", () => {
    const seenMemory: ControllerMemory[] = [];
    let invocation = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        decide(observation) {
          seenMemory.push({ ...observation.memory });
          invocation += 1;
          if (invocation === 1) {
            return {
              commands: [null],
              memory: { mustNotCommit: true },
            } as unknown as ControllerDecision;
          }
          return { commands: [] };
        },
      },
    });

    expectInvalidOutput(host.invoke("alpha", ordinaryObservation()));
    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemory).toEqual([{}, {}]);
  });

  it("rejects malformed in-process Spawn output before committing proposed memory", () => {
    const seenMemory: ControllerMemory[] = [];
    let invocation = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence(context) {
          seenMemory.push({ ...context.memory });
          invocation += 1;
          if (invocation === 1) {
            return {
              centers: null,
              memory: { mustNotCommit: true },
            } as unknown as SpawnInfluenceDecision;
          }
          return { centers: [1] };
        },
        decide() {
          return { commands: [] };
        },
      },
    });

    expectInvalidOutput(
      host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      ),
    );
    expect(
      host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      ),
    ).toEqual({ ok: true, output: { centers: [1] } });
    expect(seenMemory).toEqual([{}, {}]);
  });

  it("rejects malformed nested production decisions rather than treating transport-safe data as a typed decision", async () => {
    const malformedOutputs: readonly unknown[] = [
      { commands: [null] },
      { commands: [{ kind: "CAPITULATE" }] },
      { directives: { set: [null] } },
      { directives: { end: [1] } },
      { debug: [null] },
    ];

    for (const output of malformedOutputs) {
      const pool = new RecordingPool(() => ({
        ok: true,
        output,
        usage: zeroUsage,
      }));
      const host = new ProductionControllerHost(pool, { alpha: artifact });
      expectInvalidOutput(await host.invoke("alpha", ordinaryObservation()));
    }
  });

  it("rejects malformed production normal output before committing proposed memory", async () => {
    const seenMemoryJson: string[] = [];
    let invocation = 0;
    const pool = new RecordingPool((request) => {
      seenMemoryJson.push(request.memoryJson);
      invocation += 1;
      if (invocation === 1) {
        return {
          ok: true,
          output: {
            commands: [null],
            memory: { mustNotCommit: true },
          },
          usage: zeroUsage,
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: zeroUsage,
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expectInvalidOutput(await host.invoke("alpha", ordinaryObservation()));
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemoryJson).toEqual(["{}", "{}"]);
  });

  it("rejects malformed production Spawn output before committing proposed memory", async () => {
    const seenMemoryJson: string[] = [];
    let invocation = 0;
    const pool = new RecordingPool((request) => {
      seenMemoryJson.push(request.memoryJson);
      invocation += 1;
      if (invocation === 1) {
        return {
          ok: true,
          output: {
            centers: null,
            memory: { mustNotCommit: true },
          },
          usage: zeroUsage,
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: zeroUsage,
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expectInvalidOutput(
      await host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      ),
    );
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemoryJson).toEqual(["{}", "{}"]);
  });

  it("contains malformed production output before it can throw inside authoritative MatchRuntime", async () => {
    const pool = new RecordingPool((request) => ({
      ok: true,
      output:
        request.factionId === "alpha"
          ? { commands: [null] }
          : { commands: [] },
      usage: zeroUsage,
    }));
    const host = new ProductionControllerHost(pool, {
      alpha: artifact,
      beta: artifact,
    });
    const runtime = twoFactionRuntime("malformed-production-containment");

    const receipts = await runtime.runControllerRound(host);
    const alpha = receipts.find((entry) => entry.factionId === "alpha")?.receipt;

    expect(alpha).toMatchObject({
      accepted: false,
      failure: { code: "RUNTIME_ERROR" },
      faultCount: 1,
    });
    expect(runtime.acceptedInputs()).toEqual([]);
  });
});
