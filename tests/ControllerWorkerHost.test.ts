import type { ControllerDecision } from "../src/core/controller/ControllerApi";
import type { LawfulControllerObservation } from "../src/simulation/ControllerRuntime";
import {
  ProductionControllerHost,
  PRODUCTION_CONTROLLER_LIMITS,
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

const artifact: ControllerRuntimeArtifact = Object.freeze({
  moduleSource: "export function decide() { return { commands: [] }; }",
  entrypoints: Object.freeze({ decide: "decide" }),
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

function expectSuccessOutput(
  result: Awaited<ReturnType<ProductionControllerHost["invoke"]>>,
): ControllerDecision | undefined {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected successful controller invocation");
  return result.output;
}

describe("production controller worker host", () => {
  it("routes ordinary callbacks through the worker boundary with copied legal state and canonical limits", async () => {
    const original = ordinaryObservation();
    const pool = new RecordingPool((request) => {
      expect(request.hook).toBe("DECIDE");
      expect(request.timeoutMs).toBe(PRODUCTION_CONTROLLER_LIMITS.decideTimeoutMs);
      expect(request.moduleEvaluationTimeoutMs).toBe(
        PRODUCTION_CONTROLLER_LIMITS.moduleEvaluationTimeoutMs,
      );
      expect(request.isolateMemoryMb).toBe(
        PRODUCTION_CONTROLLER_LIMITS.isolateMemoryMb,
      );
      expect(request.memoryJson).toBe("{}");
      expect(request.context).toEqual(original);
      expect(request.context).not.toBe(original);
      expect(Object.isFrozen(request.context)).toBe(true);
      expect(Object.isFrozen((request.context as LawfulControllerObservation).me)).toBe(
        true,
      );
      return {
        ok: true,
        output: { commands: [] },
        usage: { queries: 0, materializedCells: 0 },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expect(await host.invoke("alpha", original)).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(pool.requests).toHaveLength(1);
  });

  it("keeps canonical controller memory outside the worker and commits it only after a valid response", async () => {
    let invocation = 0;
    const seenMemoryJson: string[] = [];
    const pool = new RecordingPool((request) => {
      seenMemoryJson.push(request.memoryJson);
      invocation += 1;
      if (invocation === 1) {
        return {
          ok: true,
          output: { commands: [], memory: { z: 1, a: 2 } },
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: { queries: 0, materializedCells: 0 },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expectSuccessOutput(await host.invoke("alpha", ordinaryObservation()));
    expectSuccessOutput(await host.invoke("alpha", ordinaryObservation()));

    expect(seenMemoryJson).toEqual(["{}", '{"a":2,"z":1}']);
  });

  it("discards oversized output and over-budget reported query/materialization usage without committing memory", async () => {
    let invocation = 0;
    const seenMemoryJson: string[] = [];
    const pool = new RecordingPool((request) => {
      seenMemoryJson.push(request.memoryJson);
      invocation += 1;
      if (invocation === 1) {
        return {
          ok: true,
          output: {
            commands: [],
            log: "x".repeat(PRODUCTION_CONTROLLER_LIMITS.serializedDecisionBytes),
            memory: { mustNotCommit: true },
          },
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      if (invocation === 2) {
        return {
          ok: true,
          output: { commands: [], memory: { mustNotCommit: true } },
          usage: {
            queries: PRODUCTION_CONTROLLER_LIMITS.queriesPerDecision + 1,
            materializedCells: 0,
          },
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: {
          queries: 0,
          materializedCells:
            PRODUCTION_CONTROLLER_LIMITS.materializedCellsPerDecision + 1,
        },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    const oversized = await host.invoke("alpha", ordinaryObservation());
    const tooManyQueries = await host.invoke("alpha", ordinaryObservation());
    const tooManyCells = await host.invoke("alpha", ordinaryObservation());

    expect(oversized).toEqual({ ok: false, fault: { code: "RUNTIME_ERROR" } });
    expect(tooManyQueries).toEqual({ ok: false, fault: { code: "RUNTIME_ERROR" } });
    expect(tooManyCells).toEqual({ ok: false, fault: { code: "RUNTIME_ERROR" } });
    expect(seenMemoryJson).toEqual(["{}", "{}", "{}"]);
  });

  it("enforces output-count and log ceilings before returning a worker result to simulation", async () => {
    const outputs: ControllerDecision[] = [
      {
        commands: Array.from(
          { length: PRODUCTION_CONTROLLER_LIMITS.commandsPerDecision + 1 },
          (_, index) => ({
            kind: "CAPITULATE" as const,
            key: `command-${index}`,
          }),
        ),
      },
      {
        directives: {
          end: Array.from(
            { length: PRODUCTION_CONTROLLER_LIMITS.directiveUpdatesPerDecision + 1 },
            (_, index) => `directive-${index}`,
          ),
        },
      },
      {
        debug: Array.from(
          { length: PRODUCTION_CONTROLLER_LIMITS.debugItemsPerDecision + 1 },
          (_, index) => ({
            kind: "METRIC" as const,
            name: `debug-${index}`,
            value: index,
          }),
        ),
      },
      { log: "é".repeat(PRODUCTION_CONTROLLER_LIMITS.logBytesPerDecision) },
    ];
    let cursor = 0;
    const pool = new RecordingPool(() => ({
      ok: true,
      output: outputs[cursor++],
      usage: { queries: 0, materializedCells: 0 },
    }));
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    for (let index = 0; index < outputs.length; index += 1) {
      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "RUNTIME_ERROR" },
      });
    }
  });

  it("enforces the aggregate spatial-policy rule ceiling", async () => {
    const rules = Array.from(
      { length: PRODUCTION_CONTROLLER_LIMITS.policyRulesPerDecision + 1 },
      (_, index) => ({
        selector: {
          kind: "OWNER" as const,
          factionId: index % 2 === 0 ? "alpha" : "beta",
        },
        weight: index + 1,
      }),
    );
    const output: ControllerDecision = {
      directives: {
        set: [
          {
            kind: "DEFENSE_PRIORITY",
            key: "policy-overflow",
            priority: { rules },
          },
        ],
      },
    };
    const pool = new RecordingPool(() => ({
      ok: true,
      output,
      usage: { queries: 0, materializedCells: 0 },
    }));
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
  });

  it("preserves public worker-fault categories while containing worker death", async () => {
    const workerFaults: readonly [ControllerWorkerResponse, string][] = [
      [{ ok: false, fault: "TIMEOUT" }, "TIMEOUT"],
      [{ ok: false, fault: "MEMORY_LIMIT" }, "MEMORY_LIMIT"],
      [{ ok: false, fault: "SANDBOX_VIOLATION" }, "SANDBOX_VIOLATION"],
      [{ ok: false, fault: "INVALID_OUTPUT" }, "RUNTIME_ERROR"],
      [{ ok: false, fault: "WORKER_DIED" }, "RUNTIME_ERROR"],
      [{ ok: false, fault: "RUNTIME_ERROR" }, "RUNTIME_ERROR"],
    ];
    let cursor = 0;
    const pool = new RecordingPool(() => workerFaults[cursor++]?.[0] ?? {
      ok: false,
      fault: "RUNTIME_ERROR",
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    for (const [, expectedCode] of workerFaults) {
      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: expectedCode },
      });
    }
  });

  it("normalizes thrown worker transport failures and worker death to runtime error without exposing process details", async () => {
    let invocation = 0;
    const pool = new RecordingPool(() => {
      invocation += 1;
      if (invocation === 1) throw new Error("socket closed: pid 12345");
      return { ok: false, fault: "WORKER_DIED" };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
  });

  it("maps malformed memory to runtime error and memory quota overflow to memory limit without committing either", async () => {
    let invocation = 0;
    const seenMemoryJson: string[] = [];
    const pool = new RecordingPool((request) => {
      seenMemoryJson.push(request.memoryJson);
      invocation += 1;
      if (invocation === 1) {
        return {
          ok: true,
          output: { commands: [], memory: { invalid: Number.NaN } },
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      if (invocation === 2) {
        return {
          ok: true,
          output: {
            commands: [],
            memory: {
              oversized: "x".repeat(PRODUCTION_CONTROLLER_LIMITS.persistentMemoryBytes),
            },
          },
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: { queries: 0, materializedCells: 0 },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "MEMORY_LIMIT" },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemoryJson).toEqual(["{}", "{}", "{}"]);
  });

  it("enforces the canonical TEAM_SIGNAL payload byte limit without charging key or channel bytes", async () => {
    const payloads = [
      "x".repeat(1021),
      "x".repeat(1022),
      "x".repeat(1023),
      "é".repeat(511),
      "é".repeat(512),
    ];
    let cursor = 0;
    const pool = new RecordingPool(() => ({
      ok: true,
      output: {
        commands: [
          {
            kind: "TEAM_SIGNAL",
            key: "k".repeat(4096),
            channel: "c".repeat(4096),
            payload: payloads[cursor++],
          },
        ],
      },
      usage: { queries: 0, materializedCells: 0 },
    }));
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: {
        commands: [
          {
            kind: "TEAM_SIGNAL",
            key: "k".repeat(4096),
            channel: "c".repeat(4096),
            payload: payloads[0],
          },
        ],
      },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: {
        commands: [
          {
            kind: "TEAM_SIGNAL",
            key: "k".repeat(4096),
            channel: "c".repeat(4096),
            payload: payloads[1],
          },
        ],
      },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: {
        commands: [
          {
            kind: "TEAM_SIGNAL",
            key: "k".repeat(4096),
            channel: "c".repeat(4096),
            payload: payloads[3],
          },
        ],
      },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
  });

  it("rejects malformed nested decisions as runtime faults rather than treating copied data as typed decisions", async () => {
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
        usage: { queries: 0, materializedCells: 0 },
      }));
      const host = new ProductionControllerHost(pool, { alpha: artifact });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "RUNTIME_ERROR" },
      });
    }
  });

  it("rejects malformed normal output before committing its proposed memory", async () => {
    let invocation = 0;
    const seenMemoryJson: string[] = [];
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
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: { queries: 0, materializedCells: 0 },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemoryJson).toEqual(["{}", "{}"]);
  });

  it("rejects malformed Spawn output before committing its proposed memory", async () => {
    const spawnArtifact: ControllerRuntimeArtifact = Object.freeze({
      moduleSource: "export function chooseInfluence() { return { centers: [] }; }",
      entrypoints: Object.freeze({
        decide: "decide",
        chooseInfluence: "chooseInfluence",
      }),
    });
    let invocation = 0;
    const seenMemoryJson: string[] = [];
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
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: { queries: 0, materializedCells: 0 },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: spawnArtifact });

    expect(
      await host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      ),
    ).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemoryJson).toEqual(["{}", "{}"]);
  });
});
