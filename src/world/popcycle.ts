/** Population/traffic budgets — Module 7 of the full-engine rewrite.
 *
 * Provenance: `CPopulation`/`Population.cpp` bands and popcycle maxPeds/maxCars
 * ratios via `src/simulation/nativePopulation.ts`. This module owns the pure
 * budget math (device clamps, driver share, creation bands) so spawners and
 * tests share one source.
 */
export const DEVICE_MAX_PEDS = 36;
export const DEVICE_MAX_CARS = 44;
export const STREET_FALLBACK_PEDS = 18;
export const STREET_FALLBACK_CARS = 26;
export const PARKED_CAR_BUDGET = 9;

/** Traffic drivers share: maxCars/2 capped at 7 (browser ceiling). */
export function trafficDriverBudget(maxCars: number): number {
  return Math.min(7, Math.floor(maxCars / 2));
}

/** Clamp native popcycle counts to the browser device budget. */
export function clampBudget(nativePeds: number, nativeCars: number): { peds: number; cars: number } {
  return {
    peds: Math.min(nativePeds, DEVICE_MAX_PEDS),
    cars: Math.min(nativeCars, DEVICE_MAX_CARS),
  };
}

/** Onscreen spawn band scales with PedCreationDistMultiplier (40–50 m on foot). */
export function spawnBand(pcdm: number): { min: number; max: number } {
  return { min: 40 * pcdm, max: 50 * pcdm };
}
