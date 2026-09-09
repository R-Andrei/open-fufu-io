import type {
  ControllerDecision,
  ControllerMemory,
  SpawnInfluenceDecision,
} from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalizeControllerMemory,
  CONTROLLER_MEMORY_MAX_BYTES,
  ControllerMemoryLimitError,
  decodeControllerMemory,
  InProcessTestControllerHost,
  type ControllerHost,
  type ControllerHostInvocationResult,
  type LawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function twoFactionRuntime(seed: string) {
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

function alphaReceipt(
  receipts: Awaited<ReturnType<MatchRuntime["runControllerRound"]>>,
) {
  const receipt = receipts.find((entry) => entry.factionId === "alpha")?.receipt;
  if (receipt === undefined) throw new Error("missing alpha controller receipt");
  return receipt;
}

function asyncCapitulationHost(completionOrder: string[]): ControllerHost {
  const host = {
    invoke(factionId: string, observation: LawfulControllerObservation) {
      const delayMs = factionId === "alpha" ? 5 : 0;
      return new Promise<ControllerHostInvocationResult<ControllerDecision>>(
        (resolve) => {
          setTimeout(() => {
            completionOrder.push(
              `${factionId}:${observation.factions.map((faction) => faction.status).join(",")}`,
            );
            resolve({
              ok: true,
              output: {
                commands: [
                  {
                    kind: "CAPITULATE",
                    key: `${factionId}-out`,
                  },
                ],
              },
            });
          }, delayMs);
        },
      );
    },
    chooseInfluence() {
      return Promise.resolve({ ok: true as const });
    },
    reconsiderInfluence() {
      return Promise.resolve({ ok: true as const });
    },
    chooseOrigins() {
      return Promise.resolve({ ok: true as const });
    },
  };
  return host as unknown as ControllerHost;
}

describe("controller runtime production-host foundation", () => {
  it("awaits asynchronous host results while preserving same-prestate deterministic commit order", async () => {
    const runtime = twoFactionRuntime("async-host-order");
    const completionOrder: string[] = [];

    const receipts = await runtime.runControllerRound(
      asyncCapitulationHost(completionOrder),
    );

    expect(completionOrder).toEqual([
      "beta:ACTIVE,ACTIVE",
      "alpha:ACTIVE,ACTIVE",
    ]);
    expect(receipts.map((entry) => [entry.factionId, entry.receipt.accepted])).toEqual([
      ["alpha", true],
      ["beta", true],
    ]);
    expect(runtime.acceptedInputs().map((input) => input.action)).toEqual([
      { type: "CAPITULATE_FACTION", factionId: "alpha" },
      { type: "CAPITULATE_FACTION", factionId: "beta" },
    ]);
  });

  it("keeps an asynchronous controller round atomic against tick and same-tick re-entry", async () => {
    const runtime = twoFactionRuntime("async-host-atomicity");
    let resolveAlpha: ((result: ControllerHostInvocationResult<ControllerDecision>) => void) | undefined;
    const host = {
      invoke(factionId: string) {
        if (factionId === "alpha") {
          return new Promise<ControllerHostInvocationResult<ControllerDecision>>(
            (resolve) => {
              resolveAlpha = resolve;
            },
          );
        }
        return Promise.resolve({ ok: true as const });
      },
      chooseInfluence() {
        return Promise.resolve({ ok: true as const });
      },
      reconsiderInfluence() {
        return Promise.resolve({ ok: true as const });
      },
      chooseOrigins() {
        return Promise.resolve({ ok: true as const });
      },
    } as unknown as ControllerHost;

    const pending = runtime.runControllerRound(host);

    expect(() => runtime.tick()).toThrow(/controller round.*in progress/i);
    expect(() => runtime.runControllerRound(host)).toThrow(
      /controller round.*in progress/i,
    );

    if (resolveAlpha === undefined) throw new Error("alpha invocation did not start");
    resolveAlpha({ ok: true });
    await pending;

    expect(runtime.snapshot().tick).toBe(0);
    expect(() => runtime.runControllerRound(host)).toThrow(/already executed/i);
  });

  it("preserves specific normal-runtime fault categories in the public DecisionReceipt", async () => {
    const faultCodes = [
      "TIMEOUT",
      "MEMORY_LIMIT",
      "SANDBOX_VIOLATION",
      "RUNTIME_ERROR",
    ] as const;

    for (const code of faultCodes) {
      const runtime = twoFactionRuntime(`controller-fault-category-${code}`);
      const host = {
        invoke(factionId: string) {
          return factionId === "alpha"
            ? { ok: false as const, fault: { code } }
            : { ok: true as const };
        },
        chooseInfluence() {
          return { ok: true as const };
        },
        reconsiderInfluence() {
          return { ok: true as const };
        },
        chooseOrigins() {
          return { ok: true as const };
        },
      } as unknown as ControllerHost;

      expect(alphaReceipt(await runtime.runControllerRound(host))).toMatchObject({
        accepted: false,
        failure: { code },
        faultCount: 1,
        faulted: false,
      });
    }
  });

  it("faults a controller on the fifth consecutive normal-runtime fault and skips later invocation", async () => {
    const runtime = twoFactionRuntime("controller-circuit-consecutive");
    let alphaInvocations = 0;
    const host = new InProcessTestControllerHost({
      alpha() {
        alphaInvocations += 1;
        throw new Error("normal runtime fault");
      },
    });

    let fifthReceipt;
    for (let index = 0; index < 5; index += 1) {
      fifthReceipt = alphaReceipt(await runtime.runControllerRound(host));
      runtime.tick();
    }

    expect(fifthReceipt).toMatchObject({
      faultCount: 5,
      faulted: true,
    });

    const afterFaulted = alphaReceipt(await runtime.runControllerRound(host));
    expect(alphaInvocations).toBe(5);
    expect(afterFaulted).toMatchObject({
      faultCount: 5,
      faulted: true,
    });
  });

  it("resets consecutive normal-runtime faults after a successful invocation", async () => {
    const runtime = twoFactionRuntime("controller-circuit-reset");
    let alphaInvocations = 0;
    const host = new InProcessTestControllerHost({
      alpha() {
        alphaInvocations += 1;
        if (alphaInvocations === 5) return { commands: [] };
        throw new Error("normal runtime fault");
      },
    });

    let fourthAfterSuccess;
    let fifthAfterSuccess;
    for (let index = 0; index < 10; index += 1) {
      const receipt = alphaReceipt(await runtime.runControllerRound(host));
      if (index === 8) fourthAfterSuccess = receipt;
      if (index === 9) fifthAfterSuccess = receipt;
      runtime.tick();
    }

    expect(fourthAfterSuccess).toMatchObject({
      faultCount: 8,
      faulted: false,
    });
    expect(fifthAfterSuccess).toMatchObject({
      faultCount: 9,
      faulted: true,
    });
  });

  it("faults a controller on its twentieth total normal-runtime fault even when faults are non-consecutive", async () => {
    const runtime = twoFactionRuntime("controller-circuit-total");
    let alphaInvocations = 0;
    const host = new InProcessTestControllerHost({
      alpha() {
        alphaInvocations += 1;
        if (alphaInvocations % 2 === 0) return { commands: [] };
        throw new Error("normal runtime fault");
      },
    });

    let twentiethFault;
    for (let index = 0; index < 39; index += 1) {
      twentiethFault = alphaReceipt(await runtime.runControllerRound(host));
      runtime.tick();
    }

    expect(twentiethFault).toMatchObject({
      faultCount: 20,
      faulted: true,
    });
  });

  it("keeps Strategic Spawn hook failures outside the normal-play circuit breaker", async () => {
    const runtime = twoFactionRuntime("spawn-fault-separation");
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence() {
          throw new Error("spawn hook fault");
        },
        decide() {
          return { commands: [] };
        },
      },
    });

    for (let index = 0; index < 20; index += 1) {
      const result = await host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      );
      expect(result.ok).toBe(false);
    }

    expect(alphaReceipt(await runtime.runControllerRound(host))).toMatchObject({
      faultCount: 0,
      faulted: false,
    });
  });

  it("rejects structurally malformed in-process normal output as a runtime error before committing proposed memory", () => {
    const seenMemory: unknown[] = [];
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

  it("rejects structurally malformed in-process Spawn output as a runtime error before committing proposed memory", () => {
    const seenMemory: unknown[] = [];
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

    expect(
      host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      ),
    ).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(
      host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      ),
    ).toEqual({ ok: true, output: { centers: [1] } });
    expect(seenMemory).toEqual([{}, {}]);
  });

  it("distinguishes malformed in-process memory from memory-quota overflow and commits neither", () => {
    const seenMemory: unknown[] = [];
    let invocation = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        decide(observation) {
          seenMemory.push({ ...observation.memory });
          invocation += 1;
          if (invocation === 1) {
            return {
              commands: [],
              memory: { invalid: Number.NaN },
            } as unknown as ControllerDecision;
          }
          if (invocation === 2) {
            return {
              commands: [],
              memory: { oversized: "x".repeat(131_072) },
            };
          }
          return { commands: [] };
        },
      },
    });

    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: false,
      fault: { code: "MEMORY_LIMIT" },
    });
    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(seenMemory).toEqual([{}, {}, {}]);
  });
});

describe("canonical controller-memory codec", () => {
  it("canonicalizes insertion order, nested keys, arrays, Unicode, and negative zero deterministically", () => {
    const first = {
      "é": "雪",
      z: -0,
      a: {
        β: "é",
        a: [3, 2, 1],
      },
    } as ControllerMemory;
    const second = {
      a: {
        a: [3, 2, 1],
        β: "é",
      },
      z: -0,
      "é": "雪",
    } as ControllerMemory;
    const expected = '{"a":{"a":[3,2,1],"β":"é"},"z":0,"é":"雪"}';

    expect(canonicalizeControllerMemory(first)).toBe(expected);
    expect(canonicalizeControllerMemory(second)).toBe(expected);

    const decoded = decodeControllerMemory(expected);
    expect(decoded).toEqual({
      a: { a: [3, 2, 1], β: "é" },
      z: 0,
      "é": "雪",
    });
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.a)).toBe(true);
    expect(Object.isFrozen((decoded.a as { a: unknown[] }).a)).toBe(true);
  });

  it("accepts deterministic finite-number edge cases", () => {
    const serialized = canonicalizeControllerMemory({
      max: Number.MAX_VALUE,
      min: Number.MIN_VALUE,
      safe: Number.MAX_SAFE_INTEGER,
      negative: -Number.MAX_VALUE,
    });

    expect(decodeControllerMemory(serialized)).toEqual({
      max: Number.MAX_VALUE,
      min: Number.MIN_VALUE,
      negative: -Number.MAX_VALUE,
      safe: Number.MAX_SAFE_INTEGER,
    });
  });

  it("rejects non-JSON values, exotic containers, cycles, and sparse arrays", () => {
    class MemoryClass {
      readonly value = 1;
    }

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = "present";

    const invalidMemories: unknown[] = [
      null,
      [],
      { bad: undefined },
      { bad: Number.NaN },
      { bad: Number.POSITIVE_INFINITY },
      { bad: Number.NEGATIVE_INFINITY },
      { bad: 1n },
      { bad: Symbol("bad") },
      { bad: () => 1 },
      { bad: new MemoryClass() },
      { bad: new Date(0) },
      { bad: new Map([["x", 1]]) },
      { bad: new Set([1]) },
      { bad: /x/ },
      { bad: new Uint8Array([1]) },
      cyclic,
      { bad: sparse },
    ];

    for (const memory of invalidMemories) {
      expect(() => canonicalizeControllerMemory(memory)).toThrow();
    }
  });

  it("accepts exactly 131072 canonical UTF-8 bytes and rejects one byte over", () => {
    const encoder = new TextEncoder();
    const emptySerialized = '{"x":""}';
    const overhead = encoder.encode(emptySerialized).byteLength;
    const exactMemory = {
      x: "x".repeat(CONTROLLER_MEMORY_MAX_BYTES - overhead),
    };
    const overMemory = {
      x: "x".repeat(CONTROLLER_MEMORY_MAX_BYTES - overhead + 1),
    };

    const exact = canonicalizeControllerMemory(exactMemory);
    expect(encoder.encode(exact).byteLength).toBe(CONTROLLER_MEMORY_MAX_BYTES);
    expect(() => canonicalizeControllerMemory(overMemory)).toThrow(
      ControllerMemoryLimitError,
    );
  });
});
