/** Progression engine — full-game port facade.
 *
 * Provenance: activities/cash/practice via `simulation/Progression.ts`,
 * stunt jumps via `simulation/StuntJumps.ts` (70 script jumps, slow-mo +
 * fixed camera + rewards), pickups via `WorldPickups.ts`
 * (`CPickup::Update`, ON_STREET regen, bribes/horseshoes/oysters/snapshots),
 * save discs via `assets/scmSavePoints.ts`.
 */
export { Progression, ACTIVITIES } from '../simulation/Progression';
export { StuntJumps } from '../simulation/StuntJumps';
export type { StuntJumpState } from '../simulation/StuntJumps';

/** One-time activity reward: paid once when target first reached. */
export function activityReward(reached: boolean, paid: boolean, amount: number): number {
  return reached && !paid ? amount : 0;
}
