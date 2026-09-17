/** Gunnery engine — full-game port facade.
 *
 * Provenance: lock-on scoring via `weapons/nativeLockOn.ts`
 * (140° cone, distance falloff, armed>officer>attacker priority),
 * projectile gravity/drag/bounce/fuse via `weapons/nativeProjectile.ts`
 * (`CProjectileInfo`), NPC cadence/dispersion via `simulation/npcGun.ts`,
 * melee baseCombo resolution via `simulation/nativeMelee.ts`.
 */
export { lockScore, lockPriority, acquireLock, LOCK_VIEW_ANGLE } from './nativeLockOn';
export type { LockCandidate, LockTargetKind } from './nativeLockOn';
export { projectileTuning, launchVelocity, stepProjectile } from '../weapons/nativeProjectile';
export { stepNpcGun, npcWeaponSpread } from '../simulation/npcGun';
export type { NpcGunState } from '../simulation/npcGun';
export { npcAimSpread } from '../simulation/npcGun';
export { meleeComboFor, NATIVE_MELEE_COMBOS } from '../simulation/nativeMelee';

/** Proficiency spread multiplier (FireInstantHit): pro tightens, poor widens. */
export function proficiencySpread(skill: 'poor' | 'std' | 'pro'): number {
  if (skill === 'pro') return 0.7;
  if (skill === 'poor') return 1.4;
  return 1;
}
