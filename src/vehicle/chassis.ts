/** Vehicle chassis helpers — Module 5 of the full-engine rewrite.
 *
 * Provenance: `handling.cfg` units consumed verbatim by `nativeHandling.ts`;
 * `SURFINFO.DAT` wet-grip bytes via `nativeSurfaceGrip.ts`. This module holds
 * only the pure, testable math (wet-grip falloff, steer clamp, stop detection)
 * so the Raycast chassis wrapper stays thin. Full `CalculateNewVelocity` is
 * still an upstream executable call and stays marked unreversed.
 */
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
