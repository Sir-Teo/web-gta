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
 * - `CTaskSimpleJump::Launch` (0x679B80) applies the player's 8.5 upward
 *   force to the 70-unit ped mass and sets the ground speed along the heading:
 *   0.1 units per frame, 0.1-0.17 over the RUN association's blend, or
 *   0.17-0.22 over SPRINT's. `CPhysical::ApplyGravity` takes 0.008 units per
 *   frame² off the rise.
 * - `CTaskSimpleJump::StartLaunchAnim` (0x67D7A0) refuses the launch on
 *   steep slopes or against a blocked forward direction.
 */
export const NATIVE_BLEND_WALK = 1.0;
export const NATIVE_BLEND_RUN = 1.8;
export const NATIVE_BLEND_SPRINT = 2.5;
/** 0.07 blend units per 60 Hz frame. */
export const NATIVE_BLEND_SLEW_PER_SECOND = 0.07 * 60;
/** CTaskSimpleJump::Launch: ApplyMoveForce(0, 0, 8.5) on the 70-unit ped mass, 0.121 units per frame, in m/s. */
export const NATIVE_JUMP_VERTICAL_VELOCITY = 8.5 / 70 * 50;
/** CPhysical::ApplyGravity: 0.008 units per frame², in m/s². */
export const NATIVE_JUMP_GRAVITY = 0.008 * 50 * 50;
/** CPed's m_fAirResistance: CPhysical::ApplyAirResistance scales the move speed by (1 − |v| / 175)^TimeStep. */
export const NATIVE_PED_AIR_RESISTANCE = 1 / 175;
/** CTaskSimpleInAir keeps a rising jump moving forward at 0.05 units per frame for its first 1000 ms. */
export const NATIVE_JUMP_MIN_FORWARD_SPEED = .05 * 50;
/** Launch's ground speed in units per frame from the move associations' blends: SPRINT's when it plays, else RUN's. */
export function nativeJumpGroundSpeed(associations: { run?: number; sprint?: number }): number {
  if (associations.sprint !== undefined) return .17 + (.22 - .17) * associations.sprint;
  if (associations.run !== undefined) return .1 + (.17 - .1) * associations.run;
  return .1;
}
/** Crouch root-motion parity: GunCrouchFwd 3.74 m/s drives the crouch gait. */
export const NATIVE_CROUCH_SPEED = 3.74;

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
