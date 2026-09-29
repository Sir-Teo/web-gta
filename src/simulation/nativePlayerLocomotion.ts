import { NATIVE_WALK_SPEED, NATIVE_RUN_SPEED, NATIVE_SPRINT_SPEED } from './Simulation';

/** Native on-foot blend model from the pinned gta-reversed sources.
 *
 * - `CTaskSimplePlayerOnFoot::PlayerControlZelda` (0x6883D0) builds
 *   `pedMoveBlendRatio` from the stick deflection and slews
 *   `m_fMoveBlendRatio` toward it by at most `0.07 * TimeStep` per frame.
 *   TimeStep counts 1/50 s, so the slew is 3.5 blend units per second.
 * - PlayerControlZelda's target is the stick's deflection over 60 (a full pad
 *   of 128 gives 2.133), capped at 1 with the walk button; sprinting is a move
 *   state (PEDMOVE_SPRINT), not a larger ratio. `CPlayerPed::SetPlayerMoveBlendRatio`
 *   (0x60C520)'s WALK 1.0 / RUN 1.8 / SPRINT 2.5 are the scripted moves' stops.
 * - `CTaskSimpleJump::Launch` (0x679B80) applies the player's 8.5 upward
 *   force to the 70-unit ped mass and sets the ground speed along the heading:
 *   0.1 units per frame, 0.1-0.17 over the RUN association's blend, or
 *   0.17-0.22 over SPRINT's. `CPhysical::ApplyGravity` takes 0.008 units per
 *   frame² off the rise.
 * - `CTaskSimpleJump::StartLaunchAnim` (0x67D7A0) refuses the launch on
 *   steep slopes or against a blocked forward direction.
 */
export const NATIVE_BLEND_WALK = 1.0;
/** SetPlayerMoveBlendRatio's RUN and SPRINT stops (scripted moves). */
export const NATIVE_BLEND_RUN = 1.8;
export const NATIVE_BLEND_SPRINT = 2.5;
/** PlayerControlZelda: a full pad deflection of 128 over 60. */
export const NATIVE_BLEND_FULL_STICK = 128 / 60;
/** SetRealMoveAnim (reVC): RUN is fully in from ratio 2. */
export const NATIVE_BLEND_RUN_FULL = 2;
/** 0.07 blend units per 1/50 s TimeStep. */
export const NATIVE_BLEND_SLEW_PER_SECOND = 0.07 * 50;
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

/** PlayerControlZelda's pedMoveBlendRatio: the stick's deflection (0-1 here, 0-128 on the pad) over 60, and no more
 * than 1 with the walk button held. Sprinting does not change it. */
export function targetMoveBlend(length: number, walking: boolean, _sprinting = false): number {
  if (length <= 0) return 0;
  const target = Math.min(length, 1) * NATIVE_BLEND_FULL_STICK;
  return walking ? Math.min(NATIVE_BLEND_WALK, target) : target;
}

/** Slew-rate limited integrator matching PlayerControlZelda's 0.07*TimeStep clamp. */
export function stepMoveBlend(current: number, target: number, dt: number): number {
  const maxDelta = NATIVE_BLEND_SLEW_PER_SECOND * Math.max(0, dt);
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** The ground speed (m/s) SetRealMoveAnim's blends give through the ped.ifp root-motion stops (reVC: WALK below 1,
 * WALK into RUN from 1 to 2, RUN from 2, SPRINT in the sprint state). The rig's own root motion is what moves the
 * player; this is the speed without one. */
export function blendToSpeed(blend: number, sprinting = false): number {
  const b = Math.max(0, blend);
  if (b <= NATIVE_BLEND_WALK) return (b / NATIVE_BLEND_WALK) * NATIVE_WALK_SPEED;
  if (b < NATIVE_BLEND_RUN_FULL)
    return NATIVE_WALK_SPEED + (b - NATIVE_BLEND_WALK) / (NATIVE_BLEND_RUN_FULL - NATIVE_BLEND_WALK) * (NATIVE_RUN_SPEED - NATIVE_WALK_SPEED);
  return sprinting ? NATIVE_SPRINT_SPEED : NATIVE_RUN_SPEED;
}

/** pedstats.dat STAT_PLAYER's heading change rate: 9 degrees per 1/50 s TimeStep. CPed::CalculateNewVelocity is a retail
 * stub; its Vice City ancestor turns m_fRotationCur toward m_fRotationDest by at most DEGTORAD(rate) × TimeStep. */
export const NATIVE_PLAYER_HEADING_CHANGE_RATE = 9;
/** The largest turn toward the aimed heading this step (radians). */
export function playerTurnStep(dt: number, rate = NATIVE_PLAYER_HEADING_CHANGE_RATE): number {
  return rate * Math.PI / 180 * dt * 50;
}
/** The heading one step turns toward `target` at the player's heading change rate (m_fAimingRotation followed by
 * m_fCurrentRotation). */
export function turnToward(heading: number, target: number, dt: number): number {
  const d = Math.atan2(Math.sin(target - heading), Math.cos(target - heading)), turn = playerTurnStep(dt);
  return heading + Math.max(-turn, Math.min(turn, d));
}
