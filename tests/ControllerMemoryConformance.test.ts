import type {
  ControllerDecision,
  ControllerMemory,
} from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
  type ControllerWorkerPool,
  type ControllerWorkerRequest,
  type ControllerWorkerResponse,
} from "../src/server/controller-runtime/ProductionControllerHost";
import {
  canonicalizeControllerMemory,
  CONTROLLER_MEMORY_MAX_BYTES,
  ControllerMemoryLimitError,
  decodeControllerMemory,
  InProcessTestControllerHost,
  type LawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

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

function symbolKeyedMemory(): ControllerMemory {
  const memory: Record<PropertyKey, unknown> = { visible: 1 };
  Object.defineProperty(memory, Symbol("hidden"), {
    value: 2,
    enumerable: true,
  });
  return memory as ControllerMemory;
}

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

const artifact: ControllerRuntimeArtifact = Object.freeze({
  moduleSource: "export function decide() { return { commands: [] }; }",
  entrypoints: Object.freeze({ decide: "decide" }),
});

const spawnArtifact: ControllerRuntimeArtifact = Object.freeze({
  moduleSource: "export function decide() { return { commands: [] }; }",
  entrypoints: Object.freeze({
    decide: "decide",
    chooseInfluence: "chooseInfluence",
    reconsiderInfluence: "reconsiderInfluence",
    chooseOrigins: "chooseOrigins",
  }),
});

describe("canonical controller-memory conformance", () => {
  it("returns a fresh immutable decoded object graph for every callback projection", () => {
    const serialized = canonicalizeControllerMemory({
      nested: { values: [1, 2, 3] },
    });

    const first = decodeControllerMemory(serialized);
    const second = decodeControllerMemory(serialized);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.nested).not.toBe(first.nested);
    expect((second.nested as { values: unknown[] }).values).not.toBe(
      (first.nested as { values: unknown[] }).values,
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.nested)).toBe(true);
    expect(Object.isFrozen((first.nested as { values: unknown[] }).values)).toBe(
      true,
    );
  });

  it("measures the exact 131072-byte quota on canonical UTF-8 bytes for multibyte strings", () => {
    const encoder = new TextEncoder();
    const overhead = encoder.encode('{"x":""}').byteLength;
    const exactPayload = "é".repeat((CONTROLLER_MEMORY_MAX_BYTES - overhead) / 2);
    const exact = canonicalizeControllerMemory({ x: exactPayload });

    expect(encoder.encode(exact).byteLength).toBe(CONTROLLER_MEMORY_MAX_BYTES);
    expect(() => canonicalizeControllerMemory({ x: `${exactPayload}x` })).toThrow(
      ControllerMemoryLimitError,
    );
  });

  it("rejects symbol-keyed memory instead of silently omitting non-string keys", () => {
    expect(() => canonicalizeControllerMemory(symbolKeyedMemory())).toThrow();
  });

  it("rejects symbol-keyed memory through the in-process host without committing it", () => {
    const seenMemory: unknown[] = [];
    let invocation = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        decide(observation) {
          seenMemory.push({ ...observation.memory });
          invocation += 1;
          return invocation === 1
            ? ({ commands: [], memory: symbolKeyedMemory() } as ControllerDecision)
            : { commands: [] };
        },
      },
    });

    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemory).toEqual([{}, {}]);
  });

  it("uses whole-object replacement and retains memory when a callback omits it", () => {
    const seenMemory: unknown[] = [];
    let invocation = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        decide(observation) {
          seenMemory.push({ ...observation.memory });
          invocation += 1;
          if (invocation === 1) {
            return { commands: [], memory: { a: 1, b: 2 } };
          }
          if (invocation === 2) {
            return { commands: [], memory: { a: 3 } };
          }
          return { commands: [] };
        },
      },
    });

    for (let index = 0; index < 4; index += 1) {
      expect(host.invoke("alpha", ordinaryObservation()).ok).toBe(true);
    }

    expect(seenMemory).toEqual([
      {},
      { a: 1, b: 2 },
      { a: 3 },
      { a: 3 },
    ]);
  });

  it("commits valid memory even when the later game-facing proposal is rejected", async () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "memory-gameplay-rejection",
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const seenMemory: unknown[] = [];
    let invocation = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        decide(observation) {
          seenMemory.push({ ...observation.memory });
          invocation += 1;
          if (invocation === 1) {
            return {
              commands: [
                {
                  kind: "BUILD_STRUCTURE",
                  key: "unsupported",
                  structure: "CITY",
                  cellId: 0,
                },
              ],
              memory: { remembered: "rejected" },
            } as ControllerDecision;
          }
          return { commands: [] };
        },
      },
    });

    const first = await runtime.runControllerRound(host);
    expect(first.find((entry) => entry.factionId === "alpha")?.receipt).toMatchObject({
      accepted: false,
      failure: { code: "INVALID_COMMAND", key: "unsupported" },
    });

    runtime.tick();
    await runtime.runControllerRound(host);
    expect(seenMemory).toEqual([{}, { remembered: "rejected" }]);
  });

  it("uses the same replacement, omission, and runtime-fault preservation semantics in production", async () => {
    let invocation = 0;
    const pool = new RecordingPool(() => {
      invocation += 1;
      if (invocation === 1) {
        return {
          ok: true,
          output: { commands: [], memory: { a: 1, b: 2 } },
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      if (invocation === 2) {
        return {
          ok: true,
          output: { commands: [], memory: { a: 3 } },
          usage: { queries: 0, materializedCells: 0 },
        };
      }
      if (invocation === 4) {
        return { ok: false, fault: "TIMEOUT" };
      }
      return {
        ok: true,
        output: { commands: [] },
        usage: { queries: 0, materializedCells: 0 },
      };
    });
    const host = new ProductionControllerHost(pool, { alpha: artifact });

    await host.invoke("alpha", ordinaryObservation());
    await host.invoke("alpha", ordinaryObservation());
    await host.invoke("alpha", ordinaryObservation());
    expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "TIMEOUT" },
    });
    await host.invoke("alpha", ordinaryObservation());

    expect(pool.requests.map((request) => request.memoryJson)).toEqual([
      "{}",
      '{"a":1,"b":2}',
      '{"a":3}',
      '{"a":3}',
      '{"a":3}',
    ]);
  });

  it("rejects symbol-keyed memory through the production host without committing it", async () => {
    let invocation = 0;
    const pool = new RecordingPool(() => {
      invocation += 1;
      return invocation === 1
        ? {
            ok: true,
            output: { commands: [], memory: symbolKeyedMemory() },
            usage: { queries: 0, materializedCells: 0 },
          }
        : {
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
    expect(pool.requests.map((request) => request.memoryJson)).toEqual(["{}", "{}"]);
  });

  it("preserves one memory lifecycle across all Spawn hooks into the first normal decide", async () => {
    const seen: Array<[string, string]> = [];
    const pool = new RecordingPool((request) => {
      seen.push([request.hook, request.memoryJson]);
      switch (request.hook) {
        case "CHOOSE_INFLUENCE":
          return {
            ok: true,
            output: { centers: [11], memory: { phase: "influence" } },
            usage: { queries: 0, materializedCells: 0 },
          };
        case "RECONSIDER_INFLUENCE":
          return {
            ok: true,
            output: { centers: [12], memory: { phase: "reconsider" } },
            usage: { queries: 0, materializedCells: 0 },
          };
        case "CHOOSE_ORIGINS":
          return {
            ok: true,
            output: { origins: [13], memory: { phase: "origin" } },
            usage: { queries: 0, materializedCells: 0 },
          };
        case "DECIDE":
          return {
            ok: true,
            output: { commands: [] },
            usage: { queries: 0, materializedCells: 0 },
          };
      }
    });
    const host = new ProductionControllerHost(pool, { alpha: spawnArtifact });

    await host.chooseInfluence(
      "alpha",
      { phase: "INFLUENCE", memory: {} } as never,
    );
    await host.reconsiderInfluence(
      "alpha",
      {
        phase: "RECONSIDER",
        memory: {},
        currentInfluenceCenters: [11],
        revealedFactions: [],
      } as never,
    );
    await host.chooseOrigins(
      "alpha",
      {
        phase: "ORIGIN",
        memory: {},
        influenceCenters: [12],
        revealedFactions: [],
        spawn: {},
      } as never,
    );
    await host.invoke("alpha", ordinaryObservation());

    expect(seen).toEqual([
      ["CHOOSE_INFLUENCE", "{}"],
      ["RECONSIDER_INFLUENCE", '{"phase":"influence"}'],
      ["CHOOSE_ORIGINS", '{"phase":"reconsider"}'],
      ["DECIDE", '{"phase":"origin"}'],
    ]);
  });
});
