import type { ControllerDecision } from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  type ControllerHost,
  type ControllerHostInvocationResult,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function runtime() {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
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

  it("does not partially admit earlier controller actions when a later commit action fails", () => {
    const match = runtime();
    const preexisting = match.acceptAction({
      type: "CAPITULATE_FACTION",
      factionId: "beta",
    });

    const host = hostWithInvoke((factionId) =>
      capitulate(`${factionId}-capitulate`),
    );

    expect(() => match.runControllerRound(host)).toThrow();
    expect(match.acceptedInputs()).toEqual([preexisting]);

    const afterFailure = match.acceptAction({
      type: "SET_TEST_MARKER",
      factionId: "alpha",
      value: 17,
    });
    expect(afterFailure.sequence).toBe(1);
  });
});
