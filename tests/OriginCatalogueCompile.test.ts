import { readFileSync } from "node:fs";
import {
  ORIGIN_RULE_MANIFEST,
  originRuleContributions,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import {
  compileRuleProfile,
  validateRuleProfile,
} from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleContribution } from "../src/core/rules/RuleComposition";

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
  if (start < 0 || end < 0) {
    throw new Error(`Missing catalogue section ${startHeading}`);
  }
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
    const match = line.match(
      /^\|\s*(P\d{2})\s*\|.*\|\s*(\d+)\s*\|\s*$/,
    );
    if (match === null) continue;
    result.push({
      id: match[1] as OriginTraitId,
      positiveCost: Number(match[2]),
      drawbackRefund: 0,
    });
  }
  for (const line of negative.split("\n")) {
    const match = line.match(
      /^\|\s*(N\d{2})\s*\|.*\|\s*-(\d+)\s*\|\s*$/,
    );
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
  it(
    "proves every current builder-legal trait combination is statically composable",
    () => {
      const traits = parseBuilderTraits();
      expect(traits).toHaveLength(72);
      expect(new Set(traits.map((trait) => trait.id)).size).toBe(72);
      expect(ORIGIN_RULE_MANIFEST).toHaveLength(72);

      const contributionMap = new Map<OriginTraitId, readonly RuleContribution[]>(
        traits.map((trait) => [
          trait.id,
          originRuleContributions([trait.id]),
        ]),
      );

      // Current compiler conflicts are pairwise by construction: overlapping
      // singleton stages or mixed operators on an overlapping axis/stage.
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
          if (issues.length > 0) {
            pairConflicts.add(pairKey(left.id, right.id));
          }
        }
      }

      const exhaustiveCompile =
        process.env.RULE_COMPOSITION_EXHAUSTIVE === "1";
      let checkedLegalOrigins = 0;
      let compiledLegalOrigins = 0;
      const selected: BuilderTrait[] = [];
      const selectedContributions: RuleContribution[] = [];

      const visit = (
        startIndex: number,
        positiveSpend: number,
        drawbackRefund: number,
      ): void => {
        if (
          selected.length > 0 &&
          positiveSpend <= 10 + drawbackRefund
        ) {
          checkedLegalOrigins += 1;
          for (let i = 0; i < selected.length; i += 1) {
            for (let j = i + 1; j < selected.length; j += 1) {
              const left = selected[i];
              const right = selected[j];
              if (left === undefined || right === undefined) continue;
              const key = pairKey(left.id, right.id);
              if (pairConflicts.has(key)) {
                throw new Error(
                  `Builder-legal Origin contains compiler-conflicting pair ${key}`,
                );
              }
            }
          }

          if (exhaustiveCompile) {
            const profile = compileRuleProfile(
              RULE_AXIS_REGISTRY,
              selectedContributions,
            );
            compiledLegalOrigins += 1;
            // Periodically prove the full compile/normalization serialization is
            // also invariant to authored input order without doubling all work.
            if ((checkedLegalOrigins & 0xfff) === 0) {
              const reversed = compileRuleProfile(
                RULE_AXIS_REGISTRY,
                [...selectedContributions].reverse(),
              );
              expect(profile.canonicalSerialization).toBe(
                reversed.canonicalSerialization,
              );
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
          const beforeContributionCount = selectedContributions.length;
          selectedContributions.push(
            ...(contributionMap.get(trait.id) ?? []),
          );
          visit(index + 1, nextPositive, nextRefund);
          selectedContributions.length = beforeContributionCount;
          selected.pop();
        }
      };

      visit(0, 0, 0);

      expect(checkedLegalOrigins).toBeGreaterThan(1_000_000);
      if (exhaustiveCompile) {
        expect(compiledLegalOrigins).toBe(checkedLegalOrigins);
      }
    },
    process.env.RULE_COMPOSITION_EXHAUSTIVE === "1" ? 600_000 : 15_000,
  );
});
