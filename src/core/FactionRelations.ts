// Game-wide immutable faction relation resolver.
//
// Canonical mechanics ownership: docs/OPEN_FUFU_DESIGN.md §12.
// Ally/enemy identity derives only from faction identity and immutable fixed-team
// membership. `atWar` is intentionally not an input to this module.

export type FactionRelation = "SELF" | "ALLY" | "ENEMY";

export interface FactionRelationIdentity {
  readonly factionId: string;
  readonly fixedTeamId?: string;
}

export type HostilitySideIdentity =
  | { readonly kind: "FIXED_TEAM"; readonly id: string }
  | { readonly kind: "FACTION"; readonly id: string };

export function hostilitySideOf(
  identity: FactionRelationIdentity,
): HostilitySideIdentity {
  if (identity.fixedTeamId !== undefined) {
    return { kind: "FIXED_TEAM", id: identity.fixedTeamId };
  }
  return { kind: "FACTION", id: identity.factionId };
}

export function factionRelationBetween(
  left: FactionRelationIdentity,
  right: FactionRelationIdentity,
): FactionRelation {
  if (left.factionId === right.factionId) return "SELF";

  const leftSide = hostilitySideOf(left);
  const rightSide = hostilitySideOf(right);
  return leftSide.kind === rightSide.kind && leftSide.id === rightSide.id
    ? "ALLY"
    : "ENEMY";
}
