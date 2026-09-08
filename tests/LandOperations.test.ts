import type { CellSelector } from "../src/core/controller/ControllerApi";
import {
  calculateCounterResponseTick,
  canonicalCellSelectorKey,
  landTerrainBaseSpec,
} from "../src/simulation/LandOperations";

describe("land-operation focused contracts", () => {
  it("canonicalizes selector structure independently of source spelling", () => {
    const left: CellSelector = {
      kind: "UNION",
      selectors: [
        { kind: "CELLS", ids: [3, 1, 3] },
        {
          kind: "UNION",
          selectors: [
            { kind: "TERRAIN", terrain: "MARSH" },
            { kind: "CELLS", ids: [1, 3] },
          ],
        },
      ],
    };
    const right: CellSelector = {
      kind: "UNION",
      selectors: [
        { kind: "TERRAIN", terrain: "MARSH" },
        { kind: "CELLS", ids: [3, 1] },
      ],
    };

    expect(canonicalCellSelectorKey(left)).toBe(canonicalCellSelectorKey(right));
    expect(canonicalCellSelectorKey({ kind: "CELLS", ids: [9, 2, 9] })).toBe(
      canonicalCellSelectorKey({ kind: "CELLS", ids: [2, 9] }),
    );
  });

  it("uses the canonical terrain baselines for land acquisition and pressure", () => {
    expect(landTerrainBaseSpec("MARSH")).toEqual({
      conquerable: true,
      populationBearing: true,
      landTraversable: true,
      acquisitionProgressMultiplier: 0.7,
      offensivePressureMultiplier: 0.9,
      defensivePressureMultiplier: 0.9,
    });
    expect(landTerrainBaseSpec("SHALLOW_WATER")).toMatchObject({
      conquerable: true,
      populationBearing: false,
      landTraversable: true,
      acquisitionProgressMultiplier: 0.7,
      offensivePressureMultiplier: 0.85,
      defensivePressureMultiplier: 0.85,
    });
    expect(landTerrainBaseSpec("DEEP_WATER")).toMatchObject({
      conquerable: false,
      populationBearing: false,
      landTraversable: false,
    });
  });

  it("resolves parity counter-response from one immutable pre-tick state", () => {
    expect(calculateCounterResponseTick(100, 100)).toEqual({
      attackingPopulationLost: 0.5,
      respondingPopulationLost: 0.5,
      attackEffectiveness: 1,
      responseEffectiveness: 1,
    });
  });
});
