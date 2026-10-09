/** The damage a ped takes touching down, as the iOS ped's collision handling gives it (0x10032803c..0x1003282f4; the
 * routine is not reversed in gta-reversed): a WEAPON_FALL CEventDamage on the torso. Speeds come in as the browser's
 * units a second and are taken as the native units a 1/50 s frame, against the entity touched.
 * - Coming down faster than 0.375 (0.25 for a ped not in PEDSTATE_IDLE, which no ped on foot leaves in practice), or
 *   going across faster than 0.66 (0.33): max(across − 0.25, 0) × 100 + max(−0.25 − down, 0) × 400, both offsets 0.375
 *   on a soft-landing surface (surfinfo.dat's SoftLand); coming down faster than 0.6 is 500.
 * - Slower, a ped still in FALL_FALL that comes down at all (past 0.016) takes 15. */
export function landingDamage(verticalSpeed: number, o: { across?: number; soft?: boolean; fallFall?: boolean; idle?: boolean } = {}) {
  if (!Number.isFinite(verticalSpeed)) return 0;
  const down = verticalSpeed / 50, across = (o.across ?? 0) / 50, idle = o.idle ?? true;
  if (down < (idle ? -0.375 : -0.25) || across > (idle ? 0.66 : 0.33)) {
    if (down < -0.6) return 500;
    const offset = o.soft ? 0.375 : 0.25;
    return Math.max(across - offset, 0) * 100 + Math.max(-offset - down, 0) * 400;
  }
  return o.fallFall && down < -0.016 ? 15 : 0;
}
export const DEATH_RECOVERY_SECONDS = 4;
