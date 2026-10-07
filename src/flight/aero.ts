/** Aero engine — full-game port facade.
 *
 * Provenance: fixed-wing forces via `simulation/nativeFlyingControl.ts` (the iOS
 * CVehicle::FlyingControl plane branch), heli lift via the same module's heli branch, gear via `simulation/nativePlaneGear.ts`,
 * buoyancy via `simulation/nativeBuoyancy.ts` (WATER.DAT).
 */
export type { PlaneControls } from '../simulation/nativeFlyingControl';
export { bikeLeanTarget, approachBikeLean } from '../simulation/nativeBikeLean';
export { nativeBoatDrive } from '../simulation/nativeBoatDrive';
export type { NativeBoatDriveInput, NativeBoatDriveOutput } from '../simulation/nativeBoatDrive';

/** Stall authority factor: full control above stall, fading below. */
export function stallAuthority(speed: number, stallSpeed: number): number {
  if (stallSpeed <= 0) return 1;
  return Math.max(0.3, Math.min(1, speed / stallSpeed));
}
