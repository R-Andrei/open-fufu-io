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
  async chooseInfluence(context) {
    const candidatesPromise: Promise<
      Awaited<ReturnType<typeof context.cells.query>>
    > = context.cells.query(
      { kind: "POPULATION_BEARING", value: true },
      context.profile.influenceSlotCount,
    );
    const candidates = await candidatesPromise;

    return {
      centers: candidates.items.map((cell) => cell.id),
      memory: {
        ...context.memory,
        lastDecisionNumber: context.game.decisionNumber,
      },
    };
  },

  async reconsiderInfluence(context) {
    const getPromise: Promise<
      Awaited<ReturnType<typeof context.cells.get>>
    > = context.cells.get(context.currentInfluenceCenters[0] ?? -1);
    const neighborsPromise: Promise<
      Awaited<ReturnType<typeof context.cells.neighbors>>
    > = context.cells.neighbors(context.currentInfluenceCenters[0] ?? 0);
    const distancePromise: Promise<
      Awaited<ReturnType<typeof context.cells.distance>>
    > = context.cells.distance(0, 0);
    await Promise.all([getPromise, neighborsPromise, distancePromise]);

    return {
      centers: context.currentInfluenceCenters,
      memory: {
        ...context.memory,
        lastDecisionNumber: context.game.decisionNumber,
      },
    };
  },

  async chooseOrigins(context) {
    const countPromise: Promise<
      Awaited<ReturnType<typeof context.cells.count>>
    > = context.cells.count({ kind: "POPULATION_BEARING", value: true });
    const boundaryPromise: Promise<
      Awaited<ReturnType<typeof context.cells.boundary>>
    > = context.cells.boundary({ kind: "CELLS", ids: context.influenceCenters });
    const componentsPromise: Promise<
      Awaited<ReturnType<typeof context.cells.connectedComponents>>
    > = context.cells.connectedComponents({
      kind: "CELLS",
      ids: context.influenceCenters,
    });
    await Promise.all([countPromise, boundaryPromise, componentsPromise]);

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

  async decide(context) {
    const segmentGetPromise: Promise<
      Awaited<ReturnType<typeof context.segments.get>>
    > = context.segments.get(0);
    const segmentListPromise: Promise<
      Awaited<ReturnType<typeof context.segments.list>>
    > = context.segments.list();
    const segmentSelector: CellSelector = context.segments.cells(0);
    await Promise.all([segmentGetPromise, segmentListPromise]);
    void segmentSelector;

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
