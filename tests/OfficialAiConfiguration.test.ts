import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT,
  OFFICIAL_AI_ORIGIN_SUPPORT_SUPPRESSIONS,
  OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT,
} from "../design/official-ai/origin-trait-support.config";
import { OFFICIAL_AI_ORIGIN_CONFIGURATIONS } from "../design/official-ai/origin-configurations.config";
import {
  OFFICIAL_AI_BASELINE_CHARACTER_PROFILE,
  OFFICIAL_AI_CHARACTER_CONFIGURATIONS,
} from "../design/official-ai/character-configurations.config";
import { EXPECTED_ORIGIN_TRAIT_IDS } from "../src/core/rules/OriginRuleManifest";

function expectUnique(values: readonly string[], label: string): void {
  expect(new Set(values).size, `${label} must not contain duplicates`).toBe(
    values.length,
  );
}

describe("Official AI code-readable configuration", () => {
  it("has exactly one support mapping for every active Origin trait", () => {
    const supportTraitIds = OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT.map(
      (entry) => entry.traitId,
    );

    expectUnique(supportTraitIds, "Origin trait support IDs");
    expect([...supportTraitIds].sort()).toEqual(
      [...EXPECTED_ORIGIN_TRAIT_IDS].sort(),
    );
  });

  it("keeps combination and suppression relationships internally resolvable", () => {
    const traitIds = new Set(
      OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT.map((entry) => entry.traitId),
    );
    const combinationIds = OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT.map(
      (entry) => entry.id,
    );
    const suppressionIds = OFFICIAL_AI_ORIGIN_SUPPORT_SUPPRESSIONS.map(
      (entry) => entry.id,
    );

    expectUnique(combinationIds, "combination-support IDs");
    expectUnique(suppressionIds, "support-suppression IDs");

    for (const entry of OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT) {
      expectUnique(entry.match.allTraitIds, `${entry.id} match trait IDs`);
      for (const traitId of entry.match.allTraitIds) {
        expect(
          traitIds.has(traitId),
          `${entry.id} references unknown trait ${traitId}`,
        ).toBe(true);
      }
    }

    for (const entry of OFFICIAL_AI_ORIGIN_SUPPORT_SUPPRESSIONS) {
      expectUnique(entry.match.allTraitIds, `${entry.id} match trait IDs`);
      expectUnique(
        entry.suppresses.map((suppression) => suppression.traitId),
        `${entry.id} suppressed trait IDs`,
      );

      for (const traitId of entry.match.allTraitIds) {
        expect(
          traitIds.has(traitId),
          `${entry.id} references unknown match trait ${traitId}`,
        ).toBe(true);
      }
      for (const suppression of entry.suppresses) {
        expect(
          traitIds.has(suppression.traitId),
          `${entry.id} suppresses unknown trait ${suppression.traitId}`,
        ).toBe(true);
      }
    }
  });

  it("keeps named Origin configurations linked to registered support", () => {
    const traitIds = new Set(
      OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT.map((entry) => entry.traitId),
    );
    const combinationIds = new Set(
      OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT.map((entry) => entry.id),
    );
    const originIds = OFFICIAL_AI_ORIGIN_CONFIGURATIONS.map(
      (entry) => entry.originId,
    );

    expectUnique(originIds, "Official AI Origin IDs");

    for (const origin of OFFICIAL_AI_ORIGIN_CONFIGURATIONS) {
      expectUnique(origin.traitIds, `${origin.originId} trait IDs`);
      expectUnique(
        origin.requiredCombinationSupportIds,
        `${origin.originId} required combination IDs`,
      );

      for (const traitId of origin.traitIds) {
        expect(
          traitIds.has(traitId),
          `${origin.originId} references unsupported trait ${traitId}`,
        ).toBe(true);
      }
      for (const combinationId of origin.requiredCombinationSupportIds) {
        expect(
          combinationIds.has(combinationId),
          `${origin.originId} requires unknown combination ${combinationId}`,
        ).toBe(true);
      }
    }
  });

  it("keeps the Baseline plus 20 character profiles structurally distinct", () => {
    const profileIds = OFFICIAL_AI_CHARACTER_CONFIGURATIONS.map(
      (profile) => profile.id,
    );

    expect(OFFICIAL_AI_CHARACTER_CONFIGURATIONS).toHaveLength(21);
    expect(OFFICIAL_AI_CHARACTER_CONFIGURATIONS[0]).toBe(
      OFFICIAL_AI_BASELINE_CHARACTER_PROFILE,
    );
    expect(OFFICIAL_AI_BASELINE_CHARACTER_PROFILE.id).toBe("BASELINE_D0");
    expectUnique(profileIds, "Official AI character profile IDs");

    for (const profile of OFFICIAL_AI_CHARACTER_CONFIGURATIONS) {
      expectUnique(
        profile.goalGenerator.ruleSets,
        `${profile.id} goal rule-set IDs`,
      );
      expectUnique(
        profile.expression.rules.map((rule) => rule.trait),
        `${profile.id} expression traits`,
      );
      expectUnique(
        profile.fidelity.rules.map((rule) => rule.axis),
        `${profile.id} fidelity axes`,
      );
      expectUnique(
        profile.fidelity.customChecks,
        `${profile.id} fidelity custom checks`,
      );
    }
  });

  it("makes canonical Official-AI design configuration available before the production Docker build", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
    const buildStageStart = dockerfile.indexOf("FROM base AS build");
    const prodDepsStageStart = dockerfile.indexOf("FROM base AS prod-deps");

    expect(buildStageStart).toBeGreaterThanOrEqual(0);
    expect(prodDepsStageStart).toBeGreaterThan(buildStageStart);

    const buildStage = dockerfile.slice(buildStageStart, prodDepsStageStart);
    const buildCommandIndex = buildStage.indexOf("RUN npm run build-prod");
    const designCopyMatch = /^COPY\s+design\/?\s+\.\/design\/?\s*$/m.exec(
      buildStage,
    );

    expect(buildCommandIndex).toBeGreaterThanOrEqual(0);
    expect(designCopyMatch).not.toBeNull();
    expect(designCopyMatch!.index).toBeLessThan(buildCommandIndex);
  });
});
