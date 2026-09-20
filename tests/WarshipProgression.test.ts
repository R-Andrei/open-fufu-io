import { describe, expect, test } from "vitest";
import {
  createWarshipProgressionState,
  awardWarshipNavalXp,
  warshipRankHealthScale,
} from "../src/simulation/WarshipProgression";

describe("Warship Naval XP progression", () => {
  test("starts rank 1 with zero carried XP and respects 99/100/carry thresholds", () => {
    const initial = createWarshipProgressionState("warship-a");
    expect(initial).toEqual({ unitId: "warship-a", rank: 1, navalXp: 0 });

    expect(awardWarshipNavalXp(initial, 99, 3)).toEqual({
      unitId: "warship-a",
      rank: 1,
      navalXp: 99,
    });
    expect(awardWarshipNavalXp(initial, 100, 3)).toEqual({
      unitId: "warship-a",
      rank: 2,
      navalXp: 0,
    });
    expect(awardWarshipNavalXp(initial, 150, 3)).toEqual({
      unitId: "warship-a",
      rank: 2,
      navalXp: 50,
    });
  });

  test("carries across multiple thresholds and clamps at ordinary/P22 caps", () => {
    const initial = createWarshipProgressionState("warship-a");
    expect(awardWarshipNavalXp(initial, 250, 3)).toEqual({
      unitId: "warship-a",
      rank: 3,
      navalXp: 0,
    });
    expect(awardWarshipNavalXp(initial, 450, 5)).toEqual({
      unitId: "warship-a",
      rank: 5,
      navalXp: 0,
    });
  });

  test("rank health scale is exact +20% per rank above one", () => {
    expect(warshipRankHealthScale(1)).toEqual({ numerator: 1n, denominator: 1n });
    expect(warshipRankHealthScale(2)).toEqual({ numerator: 6n, denominator: 5n });
    expect(warshipRankHealthScale(3)).toEqual({ numerator: 7n, denominator: 5n });
    expect(warshipRankHealthScale(5)).toEqual({ numerator: 9n, denominator: 5n });
  });
});
