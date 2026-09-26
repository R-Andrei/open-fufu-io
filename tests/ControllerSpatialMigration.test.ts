import { readFileSync } from "node:fs";
import { OFFICIAL_AI_BASELINE_CHARACTER_PROFILE } from "../design/official-ai/character-configurations.config";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { OfficialAiControllerHost } from "../src/official-ai/OfficialAiController";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  CONTROLLER_QUERY_LIMITS,
  InProcessTestControllerHost,
  projectLawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { createControllerSpatialSurface } from "../src/simulation/ControllerSpatialSurface";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function baselineFixture() {
  const match = new MatchRuntime(
    createMicroSimulationSpec({
      seed: "controller-spatial-migration",
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", null],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
    { controllerReferenceNamespace: "controller-spatial-migration" },
  );
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "alpha",
    amount: 1,
  });
  match.tick();
  return match;
}

type EntityReadView = Readonly<{
  ref: string;
  ownerId?: string;
  cellId: number;
  type: string;
}>;

type EntityReadSurface = Readonly<{
  factions: {
    find(filter?: unknown): readonly {
      ref: string;
      status: string;
      relation: string;
      territoryCells: number;
    }[];
    get(ref: string): { ref: string; relation: string } | undefined;
    proximity(ref: string): number | undefined;
  };
  cells: {
    get(id: number): Promise<Readonly<{ ownerId?: string }> | undefined>;
  };
  units: {
    get(locator: unknown): Promise<EntityReadView | undefined>;
    find(filter?: unknown): Promise<{
      items: readonly EntityReadView[];
      truncated: boolean;
    }>;
    count(filter?: unknown): Promise<number>;
  };
  structures: {
    get(locator: unknown): Promise<EntityReadView | undefined>;
    find(filter?: unknown): Promise<{
      items: readonly EntityReadView[];
      truncated: boolean;
    }>;
    count(filter?: unknown): Promise<number>;
  };
}>;

function asEntityReadSurface(
  session: ReturnType<typeof createControllerQuerySession>,
): EntityReadSurface {
  return createControllerSpatialSurface(session) as unknown as EntityReadSurface;
}

describe("controller spatial API migration", () => {
  it("removes the eager cell array from the raw lawful observation", () => {
    const match = baselineFixture();
    const observation = projectLawfulControllerObservation(
      match.snapshot(),
      "alpha",
      0,
      undefined,
      match.controllerReferenceSession(),
    );

    expect(Object.prototype.hasOwnProperty.call(observation, "cells")).toBe(false);
  });

  it("gives in-process controllers the current local map/cells/segments surface", () => {
    const match = baselineFixture();
    const alphaRef = match.controllerReferenceSession().issueFaction("alpha");
    if (alphaRef === undefined) throw new Error("expected Alpha FactionRef");
    let spatialSurfaceSeen = false;
    let observedOwner: string | null | undefined;

    const receipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha: {
          decide(context) {
            if (
              context.map === undefined ||
              context.cells === undefined ||
              context.segments === undefined
            ) {
              throw new Error("current controller spatial surface missing");
            }
            expect(Array.isArray(context.cells)).toBe(false);
            expect(context.map.cellCount).toBe(2);
            expect(context.map.terrainAt(0)).toBe("PLAINS");
            observedOwner = context.cells.owner(0);
            expect(context.cells.owner(1)).toBeNull();
            expect(context.cells.owner(2)).toBeUndefined();
            expect(context.segments.cellIds(0)).toBeUndefined();
            spatialSurfaceSeen = true;
            return {};
          },
        },
      }),
    );

    expect(spatialSurfaceSeen).toBe(true);
    expect(observedOwner).toBe(alphaRef);
    expect(observedOwner).not.toBe("alpha");
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
      true,
    );
  });

  it("projects Segment owner-share keys through FactionRef rather than raw faction IDs", async () => {
    const match = baselineFixture();
    const session = createControllerQuerySession(
      match.snapshot(),
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      match.controllerReferenceSession(),
    );
    const alphaRef = match.controllerReferenceSession().issueFaction("alpha");
    const betaRef = match.controllerReferenceSession().issueFaction("beta");
    if (alphaRef === undefined || betaRef === undefined) {
      throw new Error("expected faction refs for Segment ownership proof");
    }

    const rawSegment = Object.freeze({
      id: 0,
      cellCount: 2,
      populationBearingCellCount: 2,
      ownerShares: Object.freeze({ alpha: 0.5, beta: 0.5 }),
      adjacentSegmentIds: Object.freeze([]),
      terrainCounts: Object.freeze({ PLAINS: 2 }),
    });
    const segmentSession = Object.create(session) as ReturnType<
      typeof createControllerQuerySession
    >;
    Object.defineProperty(segmentSession, "segments", {
      value: Object.freeze({
        get: async (id: number) => (id === 0 ? rawSegment : undefined),
        list: async () => Object.freeze([rawSegment]),
        cells: (id: number) => ({ kind: "SEGMENT" as const, segmentId: id }),
      }),
      enumerable: true,
      configurable: false,
      writable: false,
    });

    const surface = createControllerSpatialSurface(segmentSession);
    const single = await surface.segments.get(0);
    const listed = await surface.segments.list();

    expect(single?.ownerShares).toEqual({
      [alphaRef]: 0.5,
      [betaRef]: 0.5,
    });
    expect(single?.ownerShares).not.toHaveProperty("alpha");
    expect(single?.ownerShares).not.toHaveProperty("beta");
    expect(listed[0]?.ownerShares).toEqual(single?.ownerShares);
  });

  it("backs ordinary MatchRuntime controller rounds with the match reference session", () => {
    const match = baselineFixture();
    const refsByFaction = new Map<string, readonly string[]>();
    const host = {
      invoke(
        factionId: string,
        _observation: unknown,
        querySession?: ReturnType<typeof createControllerQuerySession>,
      ) {
        if (querySession === undefined) {
          throw new Error("normal controller round query session missing");
        }
        refsByFaction.set(
          factionId,
          querySession.factions.find().map((faction) => faction.ref),
        );
        return Object.freeze({ ok: true as const });
      },
      chooseInfluence() {
        return Object.freeze({ ok: true as const });
      },
      reconsiderInfluence() {
        return Object.freeze({ ok: true as const });
      },
      chooseOrigins() {
        return Object.freeze({ ok: true as const });
      },
    } as unknown as Parameters<MatchRuntime["runControllerRound"]>[0];

    const receipts = match.runControllerRound(host);
    const references = match.controllerReferenceSession();
    const alphaRef = references.issueFaction("alpha");
    const betaRef = references.issueFaction("beta");
    if (alphaRef === undefined || betaRef === undefined) {
      throw new Error("expected match-global faction refs");
    }
    const expectedRefs = [alphaRef, betaRef].sort();

    expect(refsByFaction.get("alpha")).toEqual(expectedRefs);
    expect(refsByFaction.get("beta")).toEqual(expectedRefs);
    expect(receipts.every((entry) => entry.receipt.accepted)).toBe(true);
  });

  it("declares opaque public refs, dual locators, find filters, and entity materialization limits", () => {
    const source = readFileSync("src/core/controller/ControllerApi.ts", "utf8");

    expect(source).toContain("export type FactionRef");
    expect(source).toContain("export type UnitRef");
    expect(source).toContain("export type StructureRef");
    expect(source).toContain("export type UnitLocator");
    expect(source).toContain("export type StructureLocator");
    expect(source).toContain("readonly ref: UnitRef;");
    expect(source).toContain("readonly ref: StructureRef;");
    expect(source).toContain("find(filter?: UnitFindFilter)");
    expect(source).toContain("find(filter?: StructureFindFilter)");
    expect(source).toContain("find(filter?: FactionFindFilter)");
    expect(source).toContain("materializedEntityViewsPerDecision");
  });

  it("projects global faction refs and the unit/structure discovery namespaces from one trusted query session", async () => {
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-public-entity-read-surface",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta", null],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: "controller-public-entity-read-surface" },
    );
    const session = createControllerQuerySession(
      match.snapshot(),
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      match.controllerReferenceSession(),
    );
    const surface = asEntityReadSurface(session);

    const factions = surface.factions.find();
    expect(factions).toHaveLength(2);
    expect(factions.map((faction) => faction.ref)).not.toContain("alpha");
    expect(factions.map((faction) => faction.ref)).not.toContain("beta");
    const self = factions.find((faction) => faction.relation === "SELF");
    const enemy = factions.find((faction) => faction.relation === "ENEMY");
    expect(self).toMatchObject({ status: "ACTIVE", territoryCells: 1 });
    expect(enemy).toMatchObject({ status: "ACTIVE", territoryCells: 1 });
    expect(surface.factions.get(enemy!.ref)?.ref).toBe(enemy!.ref);
    expect(surface.factions.proximity(enemy!.ref)).toBe(1);
    expect((await surface.cells.get(0))?.ownerId).toBe(self!.ref);
    expect((await surface.cells.get(1))?.ownerId).toBe(enemy!.ref);
    expect((await surface.cells.get(0))?.ownerId).not.toBe("alpha");
    expect((await surface.cells.get(1))?.ownerId).not.toBe("beta");
    expect(await surface.units.find()).toEqual({ items: [], truncated: false });
    expect(await surface.structures.find()).toEqual({ items: [], truncated: false });
  });

  it("uses visibility-first entity discovery, dual locators, stable direct-reveal refs, and strict find limits", async () => {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-public-entity-read-behavior",
        width: 6,
        height: 1,
        terrain: Array.from({ length: 6 }, () => "PLAINS"),
        initialOwners: ["alpha", "alpha", null, null, "beta", "beta"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
        initialStructureGrants: [
          {
            structureId: "beta-fort",
            ownerId: "beta",
            type: "FORT",
            cellId: 5,
            level: 1,
          },
        ],
      }),
    );
    const ownerIds = base.factions.map((faction) => faction.id);
    const alphaUnit = createMobileUnit(
      base.map,
      ownerIds,
      base,
      { ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 1 },
    );
    const betaUnit = createMobileUnit(
      base.map,
      ownerIds,
      alphaUnit,
      { ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 4 },
    );
    const revealed = createProspectiveMatchState(base, {
      mobileUnits: betaUnit.mobileUnits,
      nextMobileUnitOrdinal: betaUnit.nextMobileUnitOrdinal,
      directReveals: [
        {
          viewerFactionId: "alpha",
          sourceKind: "UNIT",
          sourceId: betaUnit.unit.id,
          expiryExclusiveTick: 100,
        },
        {
          viewerFactionId: "alpha",
          sourceKind: "STRUCTURE",
          sourceId: "beta-fort",
          expiryExclusiveTick: 100,
        },
      ],
    });
    const references = new ControllerReferenceSession(
      "controller-public-entity-read-behavior",
      revealed,
    );
    const session = createControllerQuerySession(
      revealed,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const surface = asEntityReadSurface(session);
    const enemyFaction = surface.factions
      .find()
      .find((faction) => faction.relation === "ENEMY");
    const selfFaction = surface.factions
      .find()
      .find((faction) => faction.relation === "SELF");
    if (enemyFaction === undefined || selfFaction === undefined) {
      throw new Error("expected faction refs for entity ownership assertions");
    }

    const enemyUnits = await surface.units.find({ relation: "ENEMY", types: "TANK" });
    expect(enemyUnits).toMatchObject({ truncated: false });
    expect(enemyUnits.items).toHaveLength(1);
    expect(enemyUnits.items[0]).toMatchObject({
      cellId: 4,
      type: "TANK",
      ownerId: enemyFaction.ref,
    });
    expect(enemyUnits.items[0]!.ownerId).not.toBe("beta");
    expect(enemyUnits.items[0]!.ref).not.toBe(betaUnit.unit.id);
    expect(await surface.units.get({ cellId: 4 })).toEqual(enemyUnits.items[0]);
    expect(await surface.units.get({ ref: enemyUnits.items[0]!.ref })).toEqual(
      enemyUnits.items[0],
    );
    expect(
      await surface.units.get({
        ref: { type: "UNIT", token: "fabricated-unit-ref" },
      }),
    ).toBeUndefined();
    expect(await surface.units.count({ relation: "ENEMY" })).toBe(1);

    const firstUnit = await surface.units.find({ limit: 1 });
    expect(firstUnit.items.map((unit) => unit.cellId)).toEqual([1]);
    expect(firstUnit.items[0]?.ownerId).toBe(selfFaction.ref);
    expect(firstUnit.truncated).toBe(true);
    await expect(surface.units.find({ limit: 0 })).rejects.toThrow();
    await expect(surface.units.find({ limit: 129 })).rejects.toThrow();
    await expect(surface.units.find({ limit: 1.5 })).rejects.toThrow();
    await expect(surface.units.find({ limit: Number.NaN })).rejects.toThrow();

    const enemyStructures = await surface.structures.find({ relation: "ENEMY" });
    expect(enemyStructures.items).toHaveLength(1);
    expect(enemyStructures.items[0]).toMatchObject({
      cellId: 5,
      type: "FORT",
      ownerId: enemyFaction.ref,
    });
    expect(enemyStructures.items[0]!.ownerId).not.toBe("beta");
    expect(enemyStructures.items[0]!.ref).not.toBe("beta-fort");
    expect(await surface.structures.get({ cellId: 5 })).toEqual(
      enemyStructures.items[0],
    );
    expect(
      await surface.structures.get({ ref: enemyStructures.items[0]!.ref }),
    ).toEqual(enemyStructures.items[0]);

    const refreshed = createProspectiveMatchState(revealed, {
      directReveals: [
        {
          viewerFactionId: "alpha",
          sourceKind: "UNIT",
          sourceId: betaUnit.unit.id,
          expiryExclusiveTick: 200,
        },
      ],
    });
    references.reconcile(refreshed);
    const refreshedSurface = asEntityReadSurface(
      createControllerQuerySession(
        refreshed,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        references,
      ),
    );
    const refreshedEnemy = await refreshedSurface.units.find({ relation: "ENEMY" });
    expect(refreshedEnemy.items[0]!.ref).toBe(enemyUnits.items[0]!.ref);

    const concealedAgain = createProspectiveMatchState(refreshed, {
      directReveals: [],
    });
    references.reconcile(concealedAgain);
    const concealedSurface = asEntityReadSurface(
      createControllerQuerySession(
        concealedAgain,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        references,
      ),
    );
    expect(await concealedSurface.units.find({ relation: "ENEMY" })).toEqual({
      items: [],
      truncated: false,
    });
    expect(
      await concealedSurface.units.get({ ref: enemyUnits.items[0]!.ref }),
    ).toBeUndefined();
  });

  it("does not let hidden entities affect visible count or truncation", async () => {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-public-entity-visibility-first",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const ownerIds = base.factions.map((faction) => faction.id);
    const alphaUnit = createMobileUnit(base.map, ownerIds, base, {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const betaOne = createMobileUnit(base.map, ownerIds, alphaUnit, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 1,
    });
    const betaTwo = createMobileUnit(base.map, ownerIds, betaOne, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 2,
    });
    const state = createProspectiveMatchState(base, {
      mobileUnits: betaTwo.mobileUnits,
      nextMobileUnitOrdinal: betaTwo.nextMobileUnitOrdinal,
    });
    const references = new ControllerReferenceSession(
      "controller-public-entity-visibility-first",
      state,
    );
    const surface = asEntityReadSurface(
      createControllerQuerySession(
        state,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        references,
      ),
    );

    expect(await surface.units.find({ limit: 1 })).toMatchObject({
      items: [{ cellId: 0 }],
      truncated: false,
    });
    expect(await surface.units.count()).toBe(1);
  });

  it("shares the exact 512-view materialization budget across unit and structure reads while count stays free", async () => {
    const width = 514;
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-public-entity-materialization-budget",
        width,
        height: 1,
        terrain: Array.from({ length: width }, () => "PLAINS"),
        initialOwners: Array.from({ length: width }, (_, cellId) =>
          cellId === width - 1 ? "alpha" : null,
        ),
        factions: [{ id: "alpha", rules: emptyRules() }],
        initialStructureGrants: [
          {
            structureId: "budget-fort",
            ownerId: "alpha",
            type: "FORT",
            cellId: width - 1,
            level: 1,
          },
        ],
      }),
    );
    const ownerIds = ["alpha"];
    let units = {
      mobileUnits: base.mobileUnits,
      nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
    };
    for (let cellId = 0; cellId < 513; cellId += 1) {
      units = createMobileUnit(base.map, ownerIds, units, {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId,
      });
    }
    const state = createProspectiveMatchState(base, units);
    const references = new ControllerReferenceSession(
      "controller-public-entity-materialization-budget",
      state,
    );
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const surface = asEntityReadSurface(session);

    expect(await surface.units.count()).toBe(513);
    for (let page = 0; page < 4; page += 1) {
      const found = await surface.units.find({ limit: 128 });
      expect(found.items).toHaveLength(128);
      expect(found.truncated).toBe(true);
    }
    expect(
      (session.usage() as unknown as { materializedEntityViews: number })
        .materializedEntityViews,
    ).toBe(512);
    await expect(
      surface.structures.get({ cellId: width - 1 }),
    ).rejects.toThrow("materialization budget exhausted");
  });

  it("lets BASELINE_D0 preserve its existing expansion decision without the eager array", () => {
    const match = baselineFixture();
    const state = match.snapshot();
    const observation = projectLawfulControllerObservation(
      state,
      "alpha",
      0,
      undefined,
      match.controllerReferenceSession(),
    );
    const querySession = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      match.controllerReferenceSession(),
    );
    const host = new OfficialAiControllerHost([
      {
        factionId: "alpha",
        profile: OFFICIAL_AI_BASELINE_CHARACTER_PROFILE,
      },
    ]);

    const result = host.invoke("alpha", observation, querySession);

    expect(result).toEqual({
      ok: true,
      output: {
        directives: {
          set: [
            {
              kind: "LAND_OPERATION",
              key: "official-ai:BASELINE_D0:neutral-expansion",
              operation: "NEUTRAL_EXPANSION",
              population: 1,
              source: { kind: "CELLS", ids: [0] },
              target: { kind: "CELLS", ids: [1] },
            },
          ],
        },
      },
    });
  });
});