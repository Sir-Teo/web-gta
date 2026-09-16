import { NATIVE_WALK_SPEED, NATIVE_RUN_SPEED, NATIVE_SPRINT_SPEED } from './Simulation';

/** Native on-foot blend model from the pinned gta-reversed sources.
 *
 * - `CTaskSimplePlayerOnFoot::PlayerControlZelda` (0x6883D0) builds
 *   `pedMoveBlendRatio` from the stick deflection and slews
 *   `m_fMoveBlendRatio` toward it by at most `0.07 * TimeStep` per frame.
 *   At 60 fps TimeStep is 1, so the browser slew is 4.2 blend units/s.
 * - `CPlayerPed::SetPlayerMoveBlendRatio` (0x60C520) uses the discrete
 *   targets WALK 1.0 / RUN 1.8 / SPRINT 2.5. The browser maps partial stick
 *   deflection proportionally onto those targets.
 * - `CTaskSimpleJump::Launch` (0x679B80) keeps the launch horizontal
 *   momentum (sprint 0.17-0.22 / run 0.10-0.17 blend bands) and applies the
 *   player 8.5 vertical force (`m_bHighJump` for the player group). The
 *   browser keeps its tuned 6.6 m/s vertical velocity through its 19.6 m/s^2
 *   gravity (same ~1.1 m hop) while preserving the native momentum rule.
 * - `CTaskSimpleJump::StartLaunchAnim` (0x67D7A0) refuses the launch on
 *   steep slopes or against a blocked forward direction.
 */
export const NATIVE_BLEND_WALK = 1.0;
export const NATIVE_BLEND_RUN = 1.8;
export const NATIVE_BLEND_SPRINT = 2.5;
/** 0.07 blend units per 60 Hz frame. */
export const NATIVE_BLEND_SLEW_PER_SECOND = 0.07 * 60;
/** Player vertical launch Lagr°c mapped from the native 8.5 force. */
export const NATIVE_JUMP_VERTICAL_VELOCITY = 6.6;
export const NATIVE_JUMP_GRAVITY = 19.6;

/** Discrete native blend target for the current input state. */
export function targetMoveBlend(length: number, walking: boolean, sprinting: boolean): number {
  if (length <= 0) return 0;
  const full = walking ? NATIVE_BLEND_WALK : sprinting ? NATIVE_BLEND_SPRINT : NATIVE_BLEND_RUN;
  return Math.min(length, 1) * full;
}

/** Slew-rate limited integrator matching PlayerControlZelda's 0.07*TimeStep clamp. */
export function stepMoveBlend(current: number, target: number, dt: number): number {
  const maxDelta = NATIVE_BLEND_SLEW_PER_SECOND * Math.max(0, dt);
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** Piecewise native blend -> ground speed (m/s) through the ped.ifp root-motion stops. */
export function blendToSpeed(blend: number): number {
  const b = Math.max(0, blend);
  if (b <= NATIVE_BLEND_WALK) return (b / NATIVE_BLEND_WALK) * NATIVE_WALK_SPEED;
  if (b <= NATIVE_BLEND_RUN)
    return NATIVE_WALK_SPEED + ((b - NATIVE_BLEND_WALK) / (NATIVE_BLEND_RUN - NATIVE_BLEND_WALK)) * (NATIVE_RUN_SPEED - NATIVE_WALK_SPEED);
  if (b <= NATIVE_BLEND_SPRINT)
    return NATIVE_RUN_SPEED + ((b - NATIVE_BLEND_RUN) / (NATIVE_BLEND_SPRINT - NATIVE_BLEND_RUN)) * (NATIVE_SPRINT_SPEED - NATIVE_RUN_SPEED);
  return NATIVE_SPRINT_SPEED;
}

/** Native turn damping: full 11 rad/s walk, 8 rad/s at sprint blend. */
export function blendTurnRate(blend: number): number {
  const t = Math.min(1, Math.max(0, blend / NATIVE_BLEND_SPRINT));
  return 11 - 3 * t;
}
