/** A ped's answer to EVENT_DAMAGE from its temper, and the timers it sets (WorldPedestrians runs them).
 *
 * Provenance: the CEventDamage retaliation routing of gta-reversed, with pedstats.dat's temper deciding between
 * CTaskComplexFight and fleeing; the brawl and flee lengths are clean-room values tuned to the browser's reactions.
 */
export const BRAWL_SECONDS = 6;
export const FLEE_SECONDS = 8;

/** pedstats.dat temper routing for EVENT_DAMAGE (hotheads 60+ stand and fight). */
export function decideDamageResponse(o: {
  temper: number;
  officer: boolean;
  alreadyFighting: boolean;
  healthAfter: number;
}): 'fight' | 'flee' | 'none' {
  if (o.officer || o.healthAfter <= 0) return 'none';
  if (o.temper >= 60 || o.alreadyFighting) return 'fight';
  return 'flee';
}

/** Apply an EVENT_DAMAGE routing decision to a ped's retaliate and flee timers. */
export function applyDamageResponse(
  state: { retaliate: number; flee: number },
  decision: 'fight' | 'flee' | 'none',
): void {
  if (decision === 'fight') {
    state.retaliate = Math.max(state.retaliate, BRAWL_SECONDS);
    state.flee = 0;
  } else if (decision === 'flee') {
    state.flee = Math.max(state.flee, FLEE_SECONDS);
  }
}
