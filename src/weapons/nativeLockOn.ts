/** Native weapon lock-on (CPlayerPed::FindWeaponLockOnTarget family).
 *
 * Scoring mirrors EvaluateTarget: the view-angle multiplier over
 * PLAYER_MAX_TARGET_VIEW_ANGLE (140°) with a fourth-root distance falloff past
 * one metre. Per-type target priority (FindTargetPriority) is not reversed,
 * so every candidate weighs the same; line-of-sight stays with the caller,
 * which owns the physics world.
 */
export interface LockCandidate { handle: number; position: { x: number; y: number; z: number } }
export const LOCK_VIEW_ANGLE = 140;
export function lockScore(origin: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }, range: number): number {
  const dx = point.x - origin.x, dy = point.y - origin.y, dz = point.z - origin.z;
  const dist = Math.hypot(dx, dy, dz);
  if (!(dist > 0) || dist > range) return 0;
  const fl = Math.hypot(forward.x, forward.y, forward.z) || 1;
  const cos = (dx * forward.x + dy * forward.y + dz * forward.z) / (dist * fl);
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  const view = 1 - angleDeg / LOCK_VIEW_ANGLE;
  if (view <= 0) return 0;
  return view / (dist > 1 ? Math.sqrt(Math.sqrt(dist)) : 1);
}
/** Best lock-on candidate in the view cone (stable by handle on ties). */
export function acquireLock<T extends LockCandidate>(origin: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }, candidates: readonly T[], range: number, except?: number): T | undefined {
  let best: T | undefined, score = 0;
  for (const candidate of candidates) {
    if (candidate.handle === except) continue;
    const s = lockScore(origin, forward, candidate.position, range);
    if (s > score || s === score && best !== undefined && candidate.handle < best.handle) { score = s; best = candidate; }
  }
  return best;
}
