import type { SpawnInfluenceDecision } from "../src/core/controller/ControllerApi";
import { controllerOutputHasExpectedStructure } from "../src/core/controller/ControllerOutputValidation";
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

  it("contains a malformed partial worker success response as RUNTIME_ERROR", async () => {
    const pool: ControllerWorkerPool = {
      async invoke() {
        return { ok: true as const } as never;
      },
    };
    const host = new ProductionControllerHost(pool, { alpha: spawnArtifact });

    await expect(host.invoke("alpha", {} as never)).resolves.toEqual({
      ok: false,
      fault: { code: "RUNTIME_ERROR" },
    });
  });

  it("contains missing or unknown worker fault categories as RUNTIME_ERROR", async () => {
    for (const response of [
      { ok: false as const },
      { ok: false as const, fault: "UNKNOWN_WORKER_FAULT" },
    ]) {
      const pool: ControllerWorkerPool = {
        async invoke() {
          return response as never;
        },
      };
      const host = new ProductionControllerHost(pool, { alpha: spawnArtifact });

      await expect(host.invoke("alpha", {} as never)).resolves.toEqual({
        ok: false,
        fault: { code: "RUNTIME_ERROR" },
      });
    }
  });

  it("matches DebugSubject Segment identifiers to the public numeric SegmentId contract", () => {
    expect(
      controllerOutputHasExpectedStructure("DECIDE", {
        debug: [
          {
            kind: "ANNOTATION",
            subject: { kind: "SEGMENT", id: 7 },
            label: "segment",
          },
        ],
      }),
    ).toBe(true);

    expect(
      controllerOutputHasExpectedStructure("DECIDE", {
        debug: [
          {
            kind: "ANNOTATION",
            subject: { kind: "SEGMENT", id: "7" },
            label: "segment",
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects values outside closed public controller output vocabularies as malformed", () => {
    const malformedOutputs = [
      {
        debug: [
          {
            kind: "REGION",
            selector: { kind: "TERRAIN", terrain: "LAVA" },
          },
        ],
      },
      {
        debug: [
          {
            kind: "REGION",
            selector: {
              kind: "STRUCTURE_FIELD",
              field: "NOT_A_FIELD",
              referenceFactionId: "alpha",
              affiliation: "SELF",
            },
          },
        ],
      },
      {
        debug: [
          {
            kind: "REGION",
            selector: {
              kind: "STRUCTURE_FIELD",
              field: "FORT",
              referenceFactionId: "alpha",
              affiliation: "ENEMY",
            },
          },
        ],
      },
      {
        debug: [
          {
            kind: "REGION",
            selector: {
              kind: "STRUCTURE_FIELD_INSTANCE",
              structureId: "fort-1",
              field: "NOT_A_FIELD",
            },
          },
        ],
      },
      {
        commands: [
          {
            kind: "BUILD_STRUCTURE",
            key: "bad-structure",
            structure: "CASTLE",
            cellId: 0,
          },
        ],
      },
      {
        commands: [
          {
            kind: "BUILD_UNIT",
            key: "bad-unit",
            unit: "AIRPLANE",
            producerId: "factory-1",
          },
        ],
      },
      {
        commands: [
          {
            kind: "LAUNCH_WEAPON",
            key: "bad-weapon",
            launcherId: "silo-1",
            weapon: "LASER",
            targetCellId: 0,
          },
        ],
      },
    ];

    expect(
      malformedOutputs.map((output) =>
        controllerOutputHasExpectedStructure("DECIDE", output),
      ),
    ).toEqual(Array.from({ length: malformedOutputs.length }, () => false));
  });
});
