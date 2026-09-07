// Structure-field consumer qualification only.
//
// Canonical mechanics ownership:
// - docs/OPEN_FUFU_DESIGN.md owns faction/team ally-enemy relations.
// - docs/TERRAIN_AND_STRUCTURES.md owns baseline Fort/SAM Launcher behavior.
//
// Callers must resolve game-wide faction relations before invoking the SAM helper;
// this module deliberately does not implement or reinterpret diplomacy/team rules.

export const STRUCTURE_FIELD_QUALIFICATION_VERSION =
  "STRUCTURE_FIELD_QUALIFICATION_V1" as const;

/** A Fort's defensive-pressure effect supports only its physical owner's defender. */
export function fortDefensivePressureQualifiesDefender(
  fortOwnerFactionId: string,
  defendedFactionId: string,
): boolean {
  return fortOwnerFactionId === defendedFactionId;
}

/**
 * An active SAM Launcher may intercept an eligible projectile exactly when the
 * projectile owner's game-wide relation to the launcher owner is ENEMY.
 * Intended target, territory underneath, and `atWar` are intentionally absent.
 */
export function samLauncherInterceptionQualifiesProjectile(
  projectileOwnerIsEnemy: boolean,
): boolean {
  return projectileOwnerIsEnemy;
}
