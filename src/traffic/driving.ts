/** Traffic driving engine — full-game port facade.
 *
 * Provenance: authored recovery limits via `simulation/WorldTraffic.ts`
 * (8 s dead-end/unloaded, 20 s jam), CCarCtrl driving and the siren yield via `vehicle/nativeCarCtrl.ts`, signal stops via
 * `world/nativeSignalStop.ts` (autopilot link resolution), lane links via
 * `simulation/trafficRoute.ts`, budgets via `world/popcycle.ts`.
 */
export { recoveryLimit } from '../simulation/WorldTraffic';
export { trafficDriverBudget, clampBudget, spawnBand } from '../world/popcycle';

/** Whether a stopped driver should despawn (recovery elapsed). */
export function shouldRecover(stoppedFor: number, limit: number): boolean {
  return limit > 0 && stoppedFor >= limit;
}
