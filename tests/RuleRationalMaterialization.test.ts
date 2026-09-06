import { pow2 } from "../src/core/DetMath";
import { rationalToFiniteNumber } from "../src/core/rules/RuleComposition";

describe("deterministic rational materialization boundaries", () => {
  it("preserves exact powers of two throughout the IEEE-754 subnormal range", () => {
    expect(pow2(-1022)).toBe(2.2250738585072014e-308);
    expect(pow2(-1023)).toBe(1.1125369292536007e-308);
    expect(pow2(-1074)).toBe(Number.MIN_VALUE);
    expect(pow2(-1075)).toBe(0);
  });

  it("does not prematurely zero a representable exact rational", () => {
    expect(rationalToFiniteNumber(1n, 1n << 1023n)).toBe(
      1.1125369292536007e-308,
    );
    expect(rationalToFiniteNumber(1n, 1n << 1074n)).toBe(Number.MIN_VALUE);
  });
});
