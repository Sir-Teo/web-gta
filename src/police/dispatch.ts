/** Police dispatch rules — Module 6 of the full-engine rewrite.
 *
 * Provenance: `CWanted::UpdateWantedLevel` rows mirrored in
 * `src/simulation/nativeWanted.ts` (chaos thresholds + cop/car caps +
 * roadblock chance). This module exposes the pure dispatch slice — caps,
 * heli requirement, nightstick-vs-gun rule, bust hold — so `WorldPolice`
 * and foot-officer logic share one source instead of inline branches.
 */
export interface WantedRow {
  level: number;
  roadblockChance: number;
  maxCops: number;
  maxCopCars: number;
}

/** Mirrors NativeWanted.updateWantedLevel rows [chaos, level, roadblock, cops, cars]. */
export function dispatchForChaos(chaos: number): WantedRow {
  const rows: [number, number, number, number, number][] = [
    [4600, 6, 30, 10, 3],
    [2400, 5, 24, 8, 3],
    [1200, 4, 18, 6, 2],
    [550, 3, 12, 4, 2],
    [180, 2, 0, 3, 2],
    [50, 1, 0, 1, 1],
  ];
  const row = rows.find((r) => chaos >= r[0]);
  if (!row) return { level: 0, roadblockChance: 0, maxCops: 0, maxCopCars: 0 };
  return { level: row[1], roadblockChance: row[2], maxCops: row[3], maxCopCars: row[4] };
}

/** CWanted::NumOfHelisRequired. */
export function helisRequired(level: number): number {
  if (level <= 2) return 0;
  if (level === 3) return 1;
  return 2;
}

/** 1-star vs unarmed player uses the nightstick beat-down, not guns. */
export function gunAllowed(level: number, playerArmed: boolean, surrendering: boolean): boolean {
  if (surrendering) return false;
  if (level <= 0) return false;
  if (level === 1 && !playerArmed) return false;
  return true;
}

/** Roadblocks dissolve below 3 stars (CreateRoadBlockBetween2Points unreversed). */
export function roadblockAllowed(level: number): boolean {
  return level >= 3;
}
