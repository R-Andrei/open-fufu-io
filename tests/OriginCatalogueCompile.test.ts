import { readFileSync } from "node:fs";
import {
  ORIGIN_RULE_MANIFEST,
  originRuleContributions,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { validateRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";

interface BuilderTrait {
  readonly id: OriginTraitId;
  readonly positiveCost: number;
  readonly drawbackRefund: number;
}

function catalogueSection(
  source: string,
  startHeading: string,
  endHeading: string,
): string {
  const start = source.indexOf(startHeading);
  const end = source.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) throw new Error(`Missing catalogue section ${startHeading}`);
  return source.slice(start, end);
}

function parseBuilderTraits(): readonly BuilderTrait[] {
  const source = readFileSync("docs/ORIGIN_TRAIT_CATALOGUE.md", "utf8");
  const positive = catalogueSection(
    source,
    "## Positive / cost traits",
    "## Negative / refund traits",
  );
  const negative = catalogueSection(
    source,
    "## Negative / refund traits",
    "## Canonical trait semantics and composition",
  );
  const result: BuilderTrait[] = [];
  for (const line of positive.split("\n")) {
    const match = line.match(/^\|\s*(P\d{2})\s*\|.*\|\s*(\d+)\s*\|\s*$/);
    if (match === null) continue;
    result.push({
      id: match[1] as OriginTraitId,
      positiveCost: Number(match[2]),
      drawbackRefund: 0,
    });
  }
  for (const line of negative.split("\n")) {
    const match = line.match(/^\|\s*(N\d{2})\s*\|.*\|\s*-(\d+)\s*\|\s*$/);
    if (match === null) continue;
    result.push({
      id: match[1] as OriginTraitId,
      positiveCost: 0,
      drawbackRefund: Number(match[2]),
    });
  }
  return result;
}

function pairKey(a: OriginTraitId, b: OriginTraitId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

describe("builder-legal Origin composition space", () => {
  it("proves every current builder-legal trait combination is statically composable", () => {
    const traits = parseBuilderTraits();
    expect(traits).toHaveLength(72);
    expect(new Set(traits.map((trait) => trait.id)).size).toBe(72);
    expect(ORIGIN_RULE_MANIFEST).toHaveLength(72);

    // All current compiler conflicts are pairwise by construction: singleton
    // overlap or mixed operators on one overlapping axis/stage. Precompute the
    // compiler result once per pair, then enumerate the full public builder
    // space without re-running an allocation-heavy compiler 1M+ times.
    const pairConflicts = new Set<string>();
    for (let i = 0; i < traits.length; i += 1) {
      for (let j = i + 1; j < traits.length; j += 1) {
        const left = traits[i];
        const right = traits[j];
        if (left === undefined || right === undefined) continue;
        const issues = validateRuleProfile(
          RULE_AXIS_REGISTRY,
          originRuleContributions([left.id, right.id]),
        );
        if (issues.length > 0) pairConflicts.add(pairKey(left.id, right.id));
      }
    }

    let checkedLegalOrigins = 0;
    const selected: BuilderTrait[] = [];
    const visit = (
      startIndex: number,
      positiveSpend: number,
      drawbackRefund: number,
    ): void => {
      if (selected.length > 0 && positiveSpend <= 10 + drawbackRefund) {
        checkedLegalOrigins += 1;
        for (let i = 0; i < selected.length; i += 1) {
          for (let j = i + 1; j < selected.length; j += 1) {
            const left = selected[i];
            const right = selected[j];
            if (left === undefined || right === undefined) continue;
            const key = pairKey(left.id, right.id);
            if (pairConflicts.has(key)) {
              throw new Error(`Builder-legal Origin contains compiler-conflicting pair ${key}`);
            }
          }
        }
      }
      if (selected.length === 5) return;
      for (let index = startIndex; index < traits.length; index += 1) {
        const trait = traits[index];
        if (trait === undefined) continue;
        const nextPositive = positiveSpend + trait.positiveCost;
        const nextRefund = drawbackRefund + trait.drawbackRefund;
        if (nextPositive > 20 || nextRefund > 10) continue;
        selected.push(trait);
        visit(index + 1, nextPositive, nextRefund);
        selected.pop();
      }
    };

    visit(0, 0, 0);
    // Protect against a parser or recursion regression that accidentally turns
    // the exhaustive proof into a tiny sample.
    expect(checkedLegalOrigins).toBeGreaterThan(1_000_000);
  });
});
