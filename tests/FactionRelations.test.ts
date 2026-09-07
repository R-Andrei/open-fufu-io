import {
  factionRelationBetween,
  hostilitySideOf,
} from "../src/core/FactionRelations";

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
