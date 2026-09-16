/** Native melee combos from the original melee.dat (noclip public dataset).
 *
 * Standard fist combo UNARMED_1, animgrp melee_1, RANGES 1.6:
 *   ATTACK1 hit 5.0  chain 10.0 radius 0.4 H damage 6
 *   ATTACK2 hit 8.0  chain 17.0 radius 0.4 H damage 9
 *   ATTACK3 hit 10.0 chain 20.0 radius 0.4 H damage 15
 *   AGROUND hit 10.5 chain 20.0 radius 0.4 G damage 25 (downed victims)
 *   AMOVING hit 7.0  chain 10.0 radius 0.4 HL damage 5 (attacker sprinting)
 * Weapon combos follow the same layout (hit/chain frames at 30 fps):
 *   BBALLBAT 11/22/18, 14/28/18, 13/99/25 (golf, nightstick, bat, shovel, cue)
 *   KNIFE 8/20/10, 9/24/10, 10/99/25 (knife, white dildo, vibrator)
 *   SWORD 11/20/10, 15/22/15, 12/99/25 (katana, cane)
 *   DILDO 11/22/18, 15/28/18, 13/99/25 (purple dildo, vibrator)
 *   FLOWERS 6/21/18, 15/28/18, 13/99/25
 * The weapon.dat melee rows map each weapon ID to its baseCombo; the browser
 * resolves that name here. CTaskSimpleFight applies damage on the hit frame
 * and opens the next chain at the chain frame; unarmed strikes queue so
 * animation and damage stay aligned, while swung weapons keep the existing
 * immediate cast with native damage, chain windows and 1.6 m reach.
 */
export interface NativeMeleeStage { hit: number; chain: number; radius: number; damage: number }
export interface NativeMeleeCombo { range: number; stages: [NativeMeleeStage, NativeMeleeStage, NativeMeleeStage]; ground: { hit: number; damage: number }; moving: { hit: number; damage: number } }
const FPS = 30;
const stage = (hit: number, chain: number, radius: number, damage: number): NativeMeleeStage => ({ hit: hit / FPS, chain: chain / FPS, radius, damage });
export const NATIVE_MELEE_COMBOS: Record<string, NativeMeleeCombo> = {
  UNARMED: { range: 1.6, stages: [stage(5, 10, 0.4, 6), stage(8, 17, 0.4, 9), stage(10, 20, 0.4, 15)], ground: { hit: 10.5 / FPS, damage: 25 }, moving: { hit: 7 / FPS, damage: 5 } },
  BBALLBAT: { range: 1.6, stages: [stage(11, 22, 0.5, 18), stage(14, 28, 0.5, 18), stage(13, 99, 0.5, 25)], ground: { hit: 18 / FPS, damage: 25 }, moving: { hit: 11 / FPS, damage: 10 } },
  KNIFE: { range: 1.6, stages: [stage(8, 20, 0.4, 10), stage(9, 24, 0.4, 10), stage(10, 99, 0.4, 25)], ground: { hit: 11 / FPS, damage: 25 }, moving: { hit: 6 / FPS, damage: 10 } },
  SWORD: { range: 1.6, stages: [stage(11, 20, 0.5, 10), stage(15, 22, 0.5, 15), stage(12, 99, 0.5, 25)], ground: { hit: 18 / FPS, damage: 25 }, moving: { hit: 8 / FPS, damage: 10 } },
  DILDO: { range: 1.6, stages: [stage(11, 22, 0.5, 18), stage(15, 28, 0.5, 18), stage(13, 99, 0.5, 25)], ground: { hit: 18 / FPS, damage: 25 }, moving: { hit: 11 / FPS, damage: 10 } },
  FLOWERS: { range: 1.6, stages: [stage(6, 21, 0.5, 18), stage(15, 28, 0.5, 18), stage(13, 99, 0.5, 25)], ground: { hit: 18 / FPS, damage: 25 }, moving: { hit: 11 / FPS, damage: 10 } },
};
/** Resolve a weapon.dat baseCombo to its melee.dat table (CHAINSAW keeps its authored grind). */
export function meleeComboFor(baseCombo: string | undefined): NativeMeleeCombo | undefined {
  if (!baseCombo || baseCombo === 'CHAINSAW') return undefined;
  return NATIVE_MELEE_COMBOS[baseCombo];
}
export const NATIVE_UNARMED_RANGE = NATIVE_MELEE_COMBOS.UNARMED.range;
export const NATIVE_UNARMED_STAGES: NativeMeleeStage[] = NATIVE_MELEE_COMBOS.UNARMED.stages;
export const NATIVE_UNARMED_GROUND_DAMAGE = NATIVE_MELEE_COMBOS.UNARMED.ground.damage;
export const NATIVE_UNARMED_MOVING_DAMAGE = NATIVE_MELEE_COMBOS.UNARMED.moving.damage;
export const NATIVE_UNARMED_GROUND_HIT = NATIVE_MELEE_COMBOS.UNARMED.ground.hit;
export const NATIVE_UNARMED_MOVING_HIT = NATIVE_MELEE_COMBOS.UNARMED.moving.hit;

/** CPlayerPed::FindPedToAttack line distance with the gang discount. */
export function attackLineDistance(origin: { x: number; z: number }, forward: { x: number; z: number }, point: { x: number; z: number }, gang: boolean): number {
  const fx = forward.x, fz = forward.z;
  const fl = Math.hypot(fx, fz) || 1;
  const nx = fx / fl, nz = fz / fl;
  const rx = point.x - origin.x, rz = point.z - origin.z;
  const along = rx * nx + rz * nz;
  const lateral = Math.abs(rx * nz - rz * nx);
  const pointDist = Math.hypot(rx, rz);
  let dist = along < 0 ? pointDist + Math.abs(along) : lateral;
  if (pointDist > 20) dist += (pointDist - 20) / 5;
  if (gang) dist = Math.max(0, dist / 2 - 2);
  return dist;
}
