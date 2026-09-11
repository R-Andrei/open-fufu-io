import {
  createUnitAttackResolvedEvent,
  createUnitDestroyedEvent,
} from "../src/simulation/SimulationEvents";

const train = Object.freeze({
  unitId: "unit:train",
  ownerId: "red",
  unitType: "TRAIN" as const,
  cellId: 7,
});
const blueTank = Object.freeze({
  unitId: "unit:0004",
  ownerId: "blue",
  unitType: "TANK" as const,
  cellId: 1,
});
const greenTank = Object.freeze({
  unitId: "unit:0009",
  ownerId: "green",
  unitType: "TANK" as const,
  cellId: 2,
});

describe("deterministic simulation events", () => {
  it("materializes an immutable lifecycle-safe resolved attack fact", () => {
    const event = createUnitAttackResolvedEvent({
      id: "opaque attack id",
      tick: 42,
      attacker: blueTank,
      target: train,
    });

    expect(event).toEqual({
      id: "opaque attack id",
      tick: 42,
      kind: "UNIT_ATTACK_RESOLVED",
      payload: {
        attacker: blueTank,
        target: train,
      },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event.payload.attacker)).toBe(true);
    expect(Object.isFrozen(event.payload.target)).toBe(true);
  });

  it("preserves every destruction cause in canonical order without universal credit or consumer payload", () => {
    const causes = [
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack:z",
        attacker: greenTank,
      },
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack:b",
        attacker: blueTank,
      },
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack:a",
        attacker: blueTank,
      },
    ];

    const event = createUnitDestroyedEvent({
      id: "opaque destruction id",
      tick: 42,
      unit: train,
      causes,
    });

    expect(event.kind).toBe("UNIT_DESTROYED");
    expect(
      event.payload.causes.map((cause) => [
        cause.attacker.unitId,
        cause.attackEventId,
      ]),
    ).toEqual([
      ["unit:0004", "attack:a"],
      ["unit:0004", "attack:b"],
      ["unit:0009", "attack:z"],
    ]);
    expect(causes.map((cause) => cause.attackEventId)).toEqual([
      "attack:z",
      "attack:b",
      "attack:a",
    ]);

    expect(Object.keys(event.payload).sort()).toEqual(["causes", "unit"]);
    expect(event.payload).not.toHaveProperty("killer");
    expect(event.payload).not.toHaveProperty("creditedOwnerId");
    expect(event.payload).not.toHaveProperty("baseCargoFfy");
    expect(event.payload).not.toHaveProperty("atWar");

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event.payload.unit)).toBe(true);
    expect(Object.isFrozen(event.payload.causes)).toBe(true);
    expect(event.payload.causes.every(Object.isFrozen)).toBe(true);
    expect(
      event.payload.causes.every((cause) => Object.isFrozen(cause.attacker)),
    ).toBe(true);
  });
});
