/** Aero engine — full-game port facade.
 *
 * Provenance: fixed-wing forces via `simulation/planeFlight.ts`
 * (authored FlyingControl approximation: thrust/drag, stall authority, ground effect,
 * crosswind coupling), heli lift via `simulation/hoverFlight.ts` (authored
 * collective + CHeli rotor-gated model), gear via `simulation/nativePlaneGear.ts`,
 * buoyancy via `simulation/nativeBuoyancy.ts` (WATER.DAT).
 */
export type { PlaneControls } from '../simulation/planeFlight';
export { planeFlight } from '../simulation/planeFlight';
export { hoverFlight } from '../simulation/hoverFlight';
export { bikeLeanTarget, approachBikeLean } from '../simulation/nativeBikeLean';
export { nativeBoatDrive } from '../simulation/nativeBoatDrive';
export type { NativeBoatDriveInput, NativeBoatDriveOutput } from '../simulation/nativeBoatDrive';

/** Stall authority factor: full control above stall, fading below. */
export function stallAuthority(speed: number, stallSpeed: number): number {
  if (stallSpeed <= 0) return 1;
  return Math.max(0.3, Math.min(1, speed / stallSpeed));
}
