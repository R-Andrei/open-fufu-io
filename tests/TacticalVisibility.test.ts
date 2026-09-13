import {
  DIRECT_REVEAL_DURATION_SECONDS,
  directRevealDurationTicks,
  directRevealExpiryExclusiveTick,
  directRevealRecipients,
  isDirectRevealActive,
  isOwnedForestConcealmentCell,
  pruneExpiredDirectReveals,
  refreshDirectReveal,
  refreshDirectRevealRecords,
  resolveTacticalVisibility,
} from "../src/core/visibility/TacticalVisibility";

describe("tactical visibility precedence", () => {
  it("keeps self-owned state visible regardless of concealment", () => {
    expect(
      resolveTacticalVisibility({
        selfOwned: true,
        explicitPublic: false,
        directRevealActive: false,
        concealed: true,
        remotelyObserved: false,
      }),
    ).toEqual({ visible: true, reason: "SELF" });
  });

  it("applies explicit-public > direct-reveal > concealment > remote observation", () => {
    expect(
      resolveTacticalVisibility({
        selfOwned: false,
        explicitPublic: true,
        directRevealActive: false,
        concealed: true,
        remotelyObserved: false,
      }).reason,
    ).toBe("EXPLICIT_PUBLIC");

    expect(
      resolveTacticalVisibility({
        selfOwned: false,
        explicitPublic: false,
        directRevealActive: true,
        concealed: true,
        remotelyObserved: true,
      }).reason,
    ).toBe("DIRECT_REVEAL");

    expect(
      resolveTacticalVisibility({
        selfOwned: false,
        explicitPublic: false,
        directRevealActive: false,
        concealed: true,
        remotelyObserved: true,
      }),
    ).toEqual({ visible: false, reason: "CONCEALMENT" });

    expect(
      resolveTacticalVisibility({
        selfOwned: false,
        explicitPublic: false,
        directRevealActive: false,
        concealed: false,
        remotelyObserved: true,
      }).reason,
    ).toBe("REMOTE_OBSERVATION");
  });
});

describe("P45 owned-Forest concealment geometry", () => {
  it("uses only terrain + political ownership, with no boundary classification", () => {
    expect(isOwnedForestConcealmentCell("FOREST", "A", "A")).toBe(true);
    expect(isOwnedForestConcealmentCell("FOREST", "B", "A")).toBe(false);
    expect(isOwnedForestConcealmentCell("PLAINS", "A", "A")).toBe(false);
    expect(isOwnedForestConcealmentCell("FOREST", undefined, "A")).toBe(false);
  });

  it("has no adjacency/map-edge input that could expose a Forest-front cell", () => {
    expect(isOwnedForestConcealmentCell.length).toBe(3);
    expect(isOwnedForestConcealmentCell("FOREST", "A", "A")).toBe(true);
  });
});

describe("direct hostile manifestation reveal", () => {
  it("uses the agreed 15-second duration and 150 V1 ticks", () => {
    expect(DIRECT_REVEAL_DURATION_SECONDS).toBe(15);
    expect(directRevealDurationTicks(10)).toBe(150);
  });

  it("uses an exclusive expiry tick and refreshes from the latest manifestation", () => {
    expect(directRevealExpiryExclusiveTick(100, 10)).toBe(250);
    expect(isDirectRevealActive(249, 250)).toBe(true);
    expect(isDirectRevealActive(250, 250)).toBe(false);

    expect(refreshDirectReveal("B", "UNIT", "tank-A", 220, 10)).toEqual({
      viewerFactionId: "B",
      sourceKind: "UNIT",
      sourceId: "tank-A",
      expiryExclusiveTick: 370,
    });
  });

  it("binds reveal to source identity/viewer rather than source location", () => {
    const record = refreshDirectReveal("B", "UNIT", "tank-A", 100, 10);
    expect(record.sourceId).toBe("tank-A");
    expect(record.viewerFactionId).toBe("B");
    expect(record).not.toHaveProperty("cellId");
  });

  it("reveals only after a hostile effect actually resolves from an identifiable source", () => {
    expect(
      directRevealRecipients({
        resolved: false,
        hostile: true,
        identifiableSource: true,
        attackedFactionIds: ["B"],
      }),
    ).toEqual([]);
    expect(
      directRevealRecipients({
        resolved: true,
        hostile: false,
        identifiableSource: true,
        attackedFactionIds: ["B"],
      }),
    ).toEqual([]);
    expect(
      directRevealRecipients({
        resolved: true,
        hostile: true,
        identifiableSource: false,
        attackedFactionIds: ["B"],
      }),
    ).toEqual([]);
  });

  it("reveals independently to directly attacked factions only", () => {
    expect(
      directRevealRecipients({
        resolved: true,
        hostile: true,
        identifiableSource: true,
        attackedFactionIds: ["C", "B", "B"],
      }),
    ).toEqual(["B", "C"]);
  });

  it("does not create a third-party witness recipient", () => {
    const recipients = directRevealRecipients({
      resolved: true,
      hostile: true,
      identifiableSource: true,
      attackedFactionIds: ["B"],
    });
    expect(recipients).toEqual(["B"]);
    expect(recipients).not.toContain("C");
  });

  it("refreshes only attacked-faction records and preserves unrelated reveals", () => {
    const refreshed = refreshDirectRevealRecords(
      [
        {
          viewerFactionId: "B",
          sourceKind: "UNIT",
          sourceId: "tank-A",
          expiryExclusiveTick: 250,
        },
        {
          viewerFactionId: "C",
          sourceKind: "STRUCTURE",
          sourceId: "silo-C",
          expiryExclusiveTick: 400,
        },
      ],
      {
        resolved: true,
        hostile: true,
        identifiableSource: true,
        attackedFactionIds: ["B"],
      },
      "UNIT",
      "tank-A",
      220,
      10,
    );

    expect(refreshed).toEqual([
      {
        viewerFactionId: "B",
        sourceKind: "UNIT",
        sourceId: "tank-A",
        expiryExclusiveTick: 370,
      },
      {
        viewerFactionId: "C",
        sourceKind: "STRUCTURE",
        sourceId: "silo-C",
        expiryExclusiveTick: 400,
      },
    ]);
  });

  it("creates no direct-reveal record for a third party", () => {
    expect(
      refreshDirectRevealRecords(
        [],
        {
          resolved: true,
          hostile: true,
          identifiableSource: true,
          attackedFactionIds: ["B"],
        },
        "UNIT",
        "tank-A",
        100,
        10,
      ),
    ).toEqual([
      {
        viewerFactionId: "B",
        sourceKind: "UNIT",
        sourceId: "tank-A",
        expiryExclusiveTick: 250,
      },
    ]);
  });

  it("drops a reveal exactly at its exclusive expiry tick", () => {
    const records = [
      {
        viewerFactionId: "B",
        sourceKind: "UNIT" as const,
        sourceId: "tank-A",
        expiryExclusiveTick: 250,
      },
      {
        viewerFactionId: "C",
        sourceKind: "UNIT" as const,
        sourceId: "tank-D",
        expiryExclusiveTick: 251,
      },
    ];
    expect(pruneExpiredDirectReveals(records, 249)).toEqual(records);
    expect(pruneExpiredDirectReveals(records, 250)).toEqual([records[1]]);
    expect(pruneExpiredDirectReveals(records, 251)).toEqual([]);
  });

  it("lets active direct reveal pierce overlapping concealment without exposing neighbors", () => {
    const source = resolveTacticalVisibility({
      selfOwned: false,
      explicitPublic: false,
      directRevealActive: true,
      concealed: true,
      remotelyObserved: false,
    });
    const neighboringSubject = resolveTacticalVisibility({
      selfOwned: false,
      explicitPublic: false,
      directRevealActive: false,
      concealed: true,
      remotelyObserved: true,
    });
    expect(source.visible).toBe(true);
    expect(neighboringSubject.visible).toBe(false);
  });
});
