/** Traffic driving engine — full-game port facade.
 *
 * Provenance: recovery limits + siren yield via `simulation/WorldTraffic.ts`
 * (8 s dead-end/unloaded, 20 s jam, 25 m siren radius), signal stops via
 * `world/nativeSignalStop.ts` (autopilot link resolution), lane links via
 * `simulation/trafficRoute.ts`, budgets via `world/popcycle.ts`.
 */
export { recoveryLimit, sirenNear, SIREN_YIELD_RADIUS } from '../simulation/WorldTraffic';
export { trafficDriverBudget, clampBudget, spawnBand } from '../world/popcycle';

/** Whether a stopped driver should despawn (recovery elapsed). */
export function shouldRecover(stoppedFor: number, limit: number): boolean {
  return limit > 0 && stoppedFor >= limit;
}
