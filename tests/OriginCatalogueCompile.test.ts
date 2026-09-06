import { readFileSync } from "node:fs";
import {
  ORIGIN_RULE_MANIFEST,
  originCustomRuleDomains,
  originDynamicRuleProviders,
  originRuleContributions,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import {
  compileRuleProfile,
  validateRuleProfile,
  type RuleProfileInput,
} from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type {
  DynamicRuleProvider,
  RuleContribution,
  RuleCustomDomainDeclaration,
} from "../src/core/rules/RuleComposition";

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
    "proves every current builder-legal complete rule profile is statically composable",
    () => {
      const traits = parseBuilderTraits();
      expect(traits).toHaveLength(72);
      expect(new Set(traits.map((trait) => trait.id)).size).toBe(72);
      expect(ORIGIN_RULE_MANIFEST).toHaveLength(72);

      const contributionMap = new Map<OriginTraitId, readonly RuleContribution[]>(
        traits.map((trait) => [trait.id, originRuleContributions([trait.id])]),
      );
      const dynamicMap = new Map<OriginTraitId, readonly DynamicRuleProvider[]>(
        traits.map((trait) => [trait.id, originDynamicRuleProviders([trait.id])]),
      );
      const customMap = new Map<OriginTraitId, readonly RuleCustomDomainDeclaration[]>(
        traits.map((trait) => [trait.id, originCustomRuleDomains([trait.id])]),
      );

      const profileFor = (ids: readonly OriginTraitId[]): RuleProfileInput => ({
        contributions: ids.flatMap((id) => contributionMap.get(id) ?? []),
        dynamicProviders: ids.flatMap((id) => dynamicMap.get(id) ?? []),
        customDomains: ids.flatMap((id) => customMap.get(id) ?? []),
      });

      const pairConflicts = new Set<string>();
      for (let i = 0; i < traits.length; i += 1) {
        for (let j = i + 1; j < traits.length; j += 1) {
          const left = traits[i];
          const right = traits[j];
          if (left === undefined || right === undefined) continue;
          const issues = validateRuleProfile(
            RULE_AXIS_REGISTRY,
            profileFor([left.id, right.id]),
          );
          if (issues.length > 0) pairConflicts.add(pairKey(left.id, right.id));
        }
      }

      const exhaustiveCompile =
        process.env.RULE_COMPOSITION_EXHAUSTIVE === "1";

      const emptyProfile = compileRuleProfile(RULE_AXIS_REGISTRY, profileFor([]));
      expect(emptyProfile.contributions).toEqual([]);
      expect(emptyProfile.dynamicProviders).toEqual([]);
      expect(emptyProfile.customDomains).toEqual([]);

      let checkedLegalOrigins = 1;
      let compiledLegalOrigins = exhaustiveCompile ? 1 : 0;
      const selected: BuilderTrait[] = [];
      const selectedContributions: RuleContribution[] = [];
      const selectedDynamic: DynamicRuleProvider[] = [];
      const selectedCustom: RuleCustomDomainDeclaration[] = [];

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
                throw new Error(
                  `Builder-legal Origin contains compiler-conflicting pair ${key}`,
                );
              }
            }
          }

          if (exhaustiveCompile) {
            const input: RuleProfileInput = {
              contributions: selectedContributions,
              dynamicProviders: selectedDynamic,
              customDomains: selectedCustom,
            };
            const profile = compileRuleProfile(RULE_AXIS_REGISTRY, input);
            compiledLegalOrigins += 1;
            if ((checkedLegalOrigins & 0xfff) === 0) {
              const reversed = compileRuleProfile(RULE_AXIS_REGISTRY, {
                contributions: [...selectedContributions].reverse(),
                dynamicProviders: [...selectedDynamic].reverse(),
                customDomains: [...selectedCustom].reverse(),
              });
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
          const beforeDynamicCount = selectedDynamic.length;
          const beforeCustomCount = selectedCustom.length;
          selectedContributions.push(...(contributionMap.get(trait.id) ?? []));
          selectedDynamic.push(...(dynamicMap.get(trait.id) ?? []));
          selectedCustom.push(...(customMap.get(trait.id) ?? []));
          visit(index + 1, nextPositive, nextRefund);
          selectedContributions.length = beforeContributionCount;
          selectedDynamic.length = beforeDynamicCount;
          selectedCustom.length = beforeCustomCount;
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
