import type { ControllerDecision } from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
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
});
