/** Pursuit engine — full-game port facade.
 *
 * Provenance: dispatch rows/helis/gun rule via `police/dispatch.ts`
 * (mirroring `nativeWanted.ts` chaos rows), heli orbit inputs via
 * `simulation/policeHeli.ts` (30 m hover, 14 m orbit, CHeli collective),
 * arrest hold 1.2 s + nightstick 12 dmg via `WorldPedestrians.ts` officer branch,
 * roadblock pairing via `WorldPolice.ts` (longest link + paired car, dissolve <3).
 */
export { dispatchForChaos, helisRequired, gunAllowed, roadblockAllowed } from '../police/dispatch';
export { helisRequired as heliCount, HELI_HOVER_HEIGHT, HELI_ORBIT_RADIUS, policeHeliInputs } from '../simulation/policeHeli';

export const ARREST_HOLD_SECONDS = 1.2;
export const NIGHTSTICK_DAMAGE = 12;
export const BUST_FEE = 100;

/** Arrest progress tick: builds while close + visible + surrendered/stopped. */
export function stepArrest(progress: number, dt: number, hold: boolean): number {
  return hold ? progress + dt : Math.max(0, progress - dt);
}
