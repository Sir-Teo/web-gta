/** Native unarmed combo from the original melee.dat (noclip public dataset).
 *
 * Standard fist combo UNARMED_1, animgrp melee_1, RANGES 1.6:
 *   ATTACK1 hit 5.0  chain 10.0 radius 0.4 H damage 6
 *   ATTACK2 hit 8.0  chain 17.0 radius 0.4 H damage 9
 *   ATTACK3 hit 10.0 chain 20.0 radius 0.4 H damage 15
 *   AGROUND hit 10.5 chain 20.0 radius 0.4 G damage 25 (downed victims)
 *   AMOVING hit 7.0  chain 10.0 radius 0.4 HL damage 5 (attacker sprinting)
 * Hit/chain frames run at 30 fps. CTaskSimpleFight applies damage on the
 * hit frame and opens the next chain at the chain frame; the browser queues
 * the strike so animation and damage stay aligned instead of instant.
 */
export interface NativeMeleeStage { hit: number; chain: number; radius: number; damage: number }
const FPS = 30;
export const NATIVE_UNARMED_RANGE = 1.6;
export const NATIVE_UNARMED_STAGES: NativeMeleeStage[] = [
  { hit: 5.0 / FPS, chain: 10.0 / FPS, radius: 0.4, damage: 6 },
  { hit: 8.0 / FPS, chain: 17.0 / FPS, radius: 0.4, damage: 9 },
  { hit: 10.0 / FPS, chain: 20.0 / FPS, radius: 0.4, damage: 15 },
];
export const NATIVE_UNARMED_GROUND_DAMAGE = 25;
export const NATIVE_UNARMED_MOVING_DAMAGE = 5;
export const NATIVE_UNARMED_GROUND_HIT = 10.5 / FPS;
export const NATIVE_UNARMED_MOVING_HIT = 7.0 / FPS;

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
