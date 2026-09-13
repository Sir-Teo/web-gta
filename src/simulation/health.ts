// Authored impact response for the current character controller; reference calibration is pending.
export function landingDamage(verticalSpeed: number) {
  return Number.isFinite(verticalSpeed) ? Math.min(100, Math.max(0, -verticalSpeed - 10) * 8) : 0;
}
export const DEATH_RECOVERY_SECONDS = 4;
