import type {
  CellSelector,
  ControllerMemory,
  OpenFufuController,
  PersistentDirective,
} from "src/core/controller/ControllerApi";

type FixtureMemory = ControllerMemory & {
  readonly lastDecisionNumber: number;
};

function ownTerritory(factionId: string): CellSelector {
  return { kind: "OWNER", factionId };
}

export const controllerApiContractFixture: OpenFufuController<FixtureMemory> = {
  chooseInfluence(context) {
    const candidates = context.cells.query(
      { kind: "POPULATION_BEARING", value: true },
      context.profile.influenceSlotCount,
    );

    return {
      centers: candidates.items.map((cell) => cell.id),
      memory: {
        ...context.memory,
        lastDecisionNumber: context.game.decisionNumber,
      },
    };
  },

  reconsiderInfluence(context) {
    return {
      centers: context.currentInfluenceCenters,
      memory: {
        ...context.memory,
        lastDecisionNumber: context.game.decisionNumber,
      },
    };
  },

  chooseOrigins(context) {
    const proposed = context.influenceCenters.slice(
      0,
      context.profile.exactOriginCount,
    );
    const validation = context.spawn.validateOriginChoices(proposed);

    return {
      origins: validation.valid ? proposed : [],
      memory: {
        ...context.memory,
        lastDecisionNumber: context.game.decisionNumber,
      },
    };
  },

  decide(context) {
    const defensePriority: PersistentDirective = {
      kind: "DEFENSE_PRIORITY",
      key: "fixture:defense",
      priority: {
        rules: [{ selector: ownTerritory(context.me.id), weight: 1 }],
      },
    };

    const otherFaction = context.factions
      .list()
      .find(
        (faction) =>
          faction.id !== context.me.id && faction.status === "ACTIVE",
      );
    const atWar = otherFaction
      ? context.factions.atWar(context.me.id, otherFaction.id)
      : false;

    return {
      memory: {
        ...context.memory,
        lastDecisionNumber: context.game.decisionNumber,
      },
      directives: { set: [defensePriority] },
      commands: [
        {
          kind: "TEAM_SIGNAL",
          key: "fixture:signal",
          channel: "contract-fixture",
          payload: { atWar, tick: context.game.tick },
        },
      ],
      debug: [{ kind: "METRIC", name: "fixture.atWar", value: atWar }],
    };
  },
};
