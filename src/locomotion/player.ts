/** Player locomotion engine — full-game port facade.
 *
 * Provenance: speeds from ped.ifp root motion via `Simulation.ts`
 * (WALK 1.556 / RUN 5.706 / SPRINT 9.562 / CROUCH 3.74), blend targets
 * 1.0/1.8/2.5 with 0.07/frame slew via `nativePlayerLocomotion.ts`,
 * native sprint button state, stat-derived energy and recovery via `nativePlayerSprint.ts`, CTaskSimpleJump::Launch's
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

import {DEFAULT_SPRINT_CAPACITY,handleNativeSprintEnergy} from '../simulation/nativePlayerSprint';
export {controlNativeSprint,nativeSprintCapacity,nativeButtonSprintResult,SPRINT_MODE} from '../simulation/nativePlayerSprint';
/** Unboosted ground sprint and native recovery, in resource units per second. */
export const STAMINA_DRAIN=50,STAMINA_REGEN_IDLE=25,STAMINA_REGEN_RUN=7.5,STAMINA_EXHAUST_FLOOR=-150;
/** Scalar HandleSprintEnergy facade. The complete pad/controller path owns button memory in Simulation. */
export function stepStamina(stamina:number,sprinting:boolean,running:boolean,dt:number,capacity=DEFAULT_SPRINT_CAPACITY){
 const state={energy:stamina};handleNativeSprintEnergy(state,sprinting,sprinting?1:running?.3:1,dt*50,capacity);return state.energy;
}
