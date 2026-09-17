import {
  factionRelationBetween,
  hostilitySideOf,
} from "../src/core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import { CONTROLLER_QUERY_LIMITS } from "../src/simulation/ControllerRuntime";
import type { MatchSpec } from "../src/simulation/MatchSpec";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

const teamA1 = { factionId: "team-a-1", fixedTeamId: "team-a" } as const;
const teamA2 = { factionId: "team-a-2", fixedTeamId: "team-a" } as const;
const teamB1 = { factionId: "team-b-1", fixedTeamId: "team-b" } as const;
const minorA = { factionId: "minor-a" } as const;
const minorB = { factionId: "minor-b" } as const;

describe("game-wide immutable faction relation", () => {
  it("derives hostility sides from fixed-team membership or faction identity", () => {
    expect(hostilitySideOf(teamA1)).toEqual({
      kind: "FIXED_TEAM",
      id: "team-a",
    });
    expect(hostilitySideOf(minorA)).toEqual({
      kind: "FACTION",
      id: "minor-a",
    });
  });

  it("distinguishes self, fixed teammates, and different hostility sides", () => {
    expect(factionRelationBetween(teamA1, teamA1)).toBe("SELF");
    expect(factionRelationBetween(teamA1, teamA2)).toBe("ALLY");
    expect(factionRelationBetween(teamA1, teamB1)).toBe("ENEMY");
  });

  it("treats distinct unteamed factions, including Minors, as enemies", () => {
    expect(factionRelationBetween(minorA, minorA)).toBe("SELF");
    expect(factionRelationBetween(minorA, minorB)).toBe("ENEMY");
    expect(factionRelationBetween(teamA1, minorA)).toBe("ENEMY");
  });

  it("is invariant to hypothetical atWar state because atWar is not an input", () => {
    const observations = ([false, true] as const).map((_atWar) => ({
      teammate: factionRelationBetween(teamA1, teamA2),
      opponent: factionRelationBetween(teamA1, teamB1),
    }));

    expect(observations).toEqual([
      { teammate: "ALLY", opponent: "ENEMY" },
      { teammate: "ALLY", opponent: "ENEMY" },
    ]);
  });
});

describe("authoritative public faction metadata", () => {
  it("binds match metadata into state and projects it without placeholders", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const alphaOrigin = Object.freeze({
      id: "origin-alpha",
      displayName: "Alpha Origin",
      version: "1",
      positiveTraitIds: Object.freeze(["P01"]),
      negativeTraitIds: Object.freeze(["N01"]),
    });
    const base = createMicroSimulationSpec({
      seed: "controller-faction-metadata-certification",
      width: 1,
      height: 1,
      terrain: ["PLAINS"],
      initialOwners: ["alpha"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });
    const spec = Object.freeze({
      ...base,
      factions: Object.freeze([
        Object.freeze({
          ...base.factions[0]!,
          displayName: "Alpha Republic",
          isMinorFaction: false,
          origin: alphaOrigin,
        }),
        Object.freeze({
          ...base.factions[1]!,
          displayName: "Beta Goons",
          isMinorFaction: true,
        }),
      ]),
    }) as unknown as MatchSpec;
    const state = createInitialMatchState(spec);
    const references = new ControllerReferenceSession(
      "controller-faction-metadata-certification",
      state,
    );
    const alphaRef = references.issueFaction("alpha");
    const betaRef = references.issueFaction("beta");
    if (alphaRef === undefined || betaRef === undefined) {
      throw new Error("expected public faction refs");
    }
    const factions = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    ).factions;
    const alpha = factions.get(alphaRef) as unknown as Record<string, unknown>;
    const beta = factions.get(betaRef) as unknown as Record<string, unknown>;

    expect.soft(alpha).toMatchObject({
      displayName: "Alpha Republic",
      isMinorFaction: false,
      origin: alphaOrigin,
      score: 1000,
    });
    expect.soft(beta).toMatchObject({
      displayName: "Beta Goons",
      isMinorFaction: true,
    });
    expect.soft(Object.prototype.hasOwnProperty.call(beta, "score")).toBe(false);
    expect.soft(Object.prototype.hasOwnProperty.call(beta, "origin")).toBe(false);

    const serialized = JSON.parse(canonicalMatchStateSerialization(state)) as {
      factions: readonly Record<string, unknown>[];
    };
    expect.soft(serialized.factions.find((faction) => faction.id === "alpha")).toMatchObject({
      displayName: "Alpha Republic",
      isMinorFaction: false,
      origin: alphaOrigin,
    });
    expect.soft(serialized.factions.find((faction) => faction.id === "beta")).toMatchObject({
      displayName: "Beta Goons",
      isMinorFaction: true,
    });
  });
});