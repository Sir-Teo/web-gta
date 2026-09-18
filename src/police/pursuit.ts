/** Pursuit engine — full-game port facade.
 *
 * Provenance: dispatch rows and helis via `police/dispatch.ts`
 * (mirroring `nativeWanted.ts` chaos rows), heli orbit inputs via
 * `simulation/policeHeli.ts` (30 m hover, 14 m orbit, CHeli collective),
 * the on-foot arrest and nightstick combo via `police/nativeArrest.ts` and the `WorldPedestrians.ts` officer branch,
 * roadblock pairing via `WorldPolice.ts` (longest link + paired car, dissolve <3).
 */
export { dispatchForChaos, helisRequired, roadblockAllowed } from '../police/dispatch';
export { helisRequired as heliCount, HELI_HOVER_HEIGHT, HELI_ORBIT_RADIUS, policeHeliInputs } from '../simulation/policeHeli';

export const BUST_FEE = 100;

