/** Player locomotion engine — full-game port facade.
 *
 * Provenance: speeds from ped.ifp root motion via `Simulation.ts`
 * (WALK 1.556 / RUN 5.706 / SPRINT 9.562 / CROUCH 3.74), blend targets
 * 1.0/1.8/2.5 with 0.07/frame slew via `nativePlayerLocomotion.ts`,
 * stamina drain 7/s + regen 10/22 via `Simulation.ts`, CTaskSimpleJump::Launch's
 * 8.5 / 70 units per frame against 0.008 gravity via `nativePlayerLocomotion.ts`.
 * This facade re-exports the authorities so gameplay and tests share one import.
 */
export {
  NATIVE_WALK_SPEED,
  NATIVE_RUN_SPEED,
  NATIVE_SPRINT_SPEED,
  NATIVE_CROUCH_WALK_SPEED,
} from '../simulation/Simulation';
export {
  NATIVE_BLEND_WALK,
  NATIVE_BLEND_RUN,
  NATIVE_BLEND_SPRINT,
  NATIVE_BLEND_SLEW_PER_SECOND,
  NATIVE_JUMP_VERTICAL_VELOCITY,
  NATIVE_JUMP_GRAVITY,
} from '../simulation/nativePlayerLocomotion';
export { SWIM_STOP_TIME, swimEntry, swimSurfaceState } from '../simulation/nativeSwim';

export const STAMINA_DRAIN = 7;
export const STAMINA_REGEN_MOVE = 10;
export const STAMINA_REGEN_IDLE = 22;
export const STAMINA_EXHAUST_FLOOR = 30;

/** Stamina tick shared by player controller and tests. */
export function stepStamina(stamina: number, sprinting: boolean, moving: boolean, dt: number): number {
  if (sprinting) return Math.max(0, Math.min(100, stamina - STAMINA_DRAIN * dt));
  if (moving) return Math.max(0, Math.min(100, stamina + STAMINA_REGEN_MOVE * dt));
  return Math.max(0, Math.min(100, stamina + STAMINA_REGEN_IDLE * dt));
}
