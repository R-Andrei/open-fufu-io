import type { SpawnInfluenceDecision } from "../src/core/controller/ControllerApi";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
  type ControllerWorkerPool,
} from "../src/server/controller-runtime/ProductionControllerHost";
import {
  InProcessTestControllerHost,
  type ControllerHostInvocationResult,
} from "../src/simulation/ControllerRuntime";

const spawnArtifact: ControllerRuntimeArtifact = Object.freeze({
  moduleSource: "export function decide() {} export function chooseInfluence() {}",
  entrypoints: Object.freeze({
    decide: "decide",
    chooseInfluence: "chooseInfluence",
  }),
});

function faultClassification<T>(
  result: ControllerHostInvocationResult<T>,
): string | undefined {
  if (result.ok) throw new Error("expected controller-host fault");
  return (result.fault as { readonly classification?: string }).classification;
}

describe("controller-host internal fault classification", () => {
  it("retains malformed Spawn output identity in-process without changing the public runtime fault code", () => {
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence() {
          return { centers: null } as unknown as SpawnInfluenceDecision;
        },
      },
    });

    const result = host.chooseInfluence(
      "alpha",
      { phase: "INFLUENCE", memory: {} } as never,
    );

    expect(result).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(faultClassification(result)).toBe("INVALID_OUTPUT");
  });

  it("does not misclassify an actual in-process controller exception as malformed output", () => {
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence() {
          throw new Error("controller failure");
        },
      },
    });

    const result = host.chooseInfluence(
      "alpha",
      { phase: "INFLUENCE", memory: {} } as never,
    );

    expect(result).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(faultClassification(result)).toBeUndefined();
  });

  it("retains worker-reported malformed Spawn output identity in production without changing the public runtime fault code", async () => {
    const pool: ControllerWorkerPool = {
      async invoke() {
        return { ok: false as const, fault: "INVALID_OUTPUT" as const };
      },
    };
    const host = new ProductionControllerHost(pool, { alpha: spawnArtifact });

    const result = await host.chooseInfluence(
      "alpha",
      { phase: "INFLUENCE", memory: {} } as never,
    );

    expect(result).toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
    expect(faultClassification(result)).toBe("INVALID_OUTPUT");
  });
});
