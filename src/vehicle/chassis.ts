/** Vehicle chassis helpers — 1:1 track facade.
 *
 * Provenance: `handling.cfg` units consumed verbatim by `nativeHandling.ts`;
 * `SURFINFO.DAT` wet-grip bytes via `nativeSurfaceGrip.ts`; gear steps via
 * `nativeTransmission.ts`; steer maps via `nativeSteering.ts`; ray lines via
 * `nativeSuspension.ts`. This facade re-exports those authorities and keeps
 * only the small glue (wet falloff, stop detection) local. Full
 * `CalculateNewVelocity` remains an upstream executable call — marked
 * UNREVERSED wherever the Raycast wrapper approximates it.
 */
export type { TransmissionState, TransmissionInput } from '../simulation/nativeTransmission';
export { stepNativeTransmission } from '../simulation/nativeTransmission';
export type { NativeSteeringInput } from '../simulation/nativeSteering';
export { nativeSteering } from '../simulation/nativeSteering';
export { nativeSuspensionLine, nativeSuspensionCompression } from '../simulation/nativeSuspension';
export const WET_GRIP_MIN = 0.4;

/** Wet-road grip multiplier: 1 dry, down toward 0.4 fully wet by surface byte. */
export function wetGripFactor(wetGripByte: number, wetRoads01: number): number {
  const b = Math.max(0, Math.min(255, wetGripByte)) / 255;
  const wet = Math.max(0, Math.min(1, wetRoads01));
  return 1 - (1 - Math.max(WET_GRIP_MIN, 1 - b * 0.6)) * wet;
}

/** Clamp steering to handling maximum, scaled by speed sensitivity. */
export function clampSteer(requested: number, maxSteer: number, speedFactor01: number): number {
  const limit = Math.max(0, maxSteer) * (1 - 0.6 * Math.max(0, Math.min(1, speedFactor01)));
  return Math.max(-limit, Math.min(limit, requested));
}

/** Whether the chassis counts as stopped (entry/exit, siren, arrest logic). */
export function isStopped(speed2D: number, eps = 0.3): boolean {
  return speed2D < eps;
}
