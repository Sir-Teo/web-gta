/** Progression engine — full-game port facade.
 *
 * Provenance: cash/loadout/practice/driving skill via `simulation/Progression.ts`,
 * stunt jumps via `simulation/StuntJumps.ts` (70 script jumps, slow-mo +
 * fixed camera + rewards), pickups via `WorldPickups.ts`
 * (`CPickup::Update`, ON_STREET regen, bribes/horseshoes/oysters/snapshots),
 * save discs via `assets/scmSavePoints.ts`.
 */
export { Progression } from '../simulation/Progression';
export { StuntJumps } from '../simulation/StuntJumps';
export type { StuntJumpState } from '../simulation/StuntJumps';

