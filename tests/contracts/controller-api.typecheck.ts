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

    const samSpec = context.mechanics.structureTypeSpec(
      "SAM_LAUNCHER",
      1,
      context.me.id,
    );
    const antiShipDamage = samSpec.antiShipAttack?.damage ?? 0;
    const activeSam = context.structures
      .list(context.me.id)
      .find(
        (structure) => structure.type === "SAM_LAUNCHER" && structure.active,
      );
    const antiShipCoveredCells =
      activeSam && samSpec.antiShipAttack
        ? context.cells.count({
            kind: "STRUCTURE_FIELD_INSTANCE",
            structureId: activeSam.id,
            field: samSpec.antiShipAttack.eligibilityField,
          })
        : 0;
    const landing = context.mechanics.transportLanding(5, context.me.id);
    const destruction = context.mechanics.transportDestructionSpec(context.me.id);
    const transferDestination =
      destruction.creditedPopulationTransfer?.destination ?? "NONE";

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
          payload: {
            atWar,
            tick: context.game.tick,
            antiShipDamage,
            antiShipCoveredCells,
            landingSurvivors: landing.survivingPopulation,
            transferDestination,
          },
        },
      ],
      debug: [
        { kind: "METRIC", name: "fixture.atWar", value: atWar },
        {
          kind: "METRIC",
          name: "fixture.antiShipCoveredCells",
          value: antiShipCoveredCells,
        },
        {
          kind: "METRIC",
          name: "fixture.landingSurvivors",
          value: landing.survivingPopulation,
        },
      ],
    };
  },
};
