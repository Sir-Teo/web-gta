/** Native population creation/removal rules.
 *
 * Sources:
 * - re3 `CPopulation` (GTA III-era, same lineage as SA `Population.cpp`):
 *   MIN_CREATION_DIST 40, CREATION_RANGE 10, OFFSCREEN_CREATION_MULT 0.5,
 *   PED_REMOVE_DIST 51, SPECIAL 65.
 * - gta-reversed `Population.cpp` (pinned 0076f901): PedCreationDistMultiplier
 *   1.0 on foot, 1.0-1.5 scaled by vehicle speed; ManagePed removal bands
 *   54.5/65 * GenerationDistMultiplier with on-screen fade vs off-screen
 *   removal and the 4 s (10 s cop) `m_nTimeTillWeNeedThisPed` grace;
 *   CanCameraSeeAPedHere 42.5 * PCDM visibility gate.
 * - gta-reversed `Wanted.cpp`: UpdateWantedLevel thresholds already mirrored
 *   in NativeWanted; the >2-star foot `addCop` path forces the onscreen
 *   40-50 m band.
 *
 * The browser keeps its bounded 12/18 ceilings and popcycle caps; this module
 * supplies the native distance bands and decisions so spawns stop popping in
 * at 7 m and cleanup stops deleting visible peds.
 */
export const NATIVE_MIN_CREATION_DIST = 40;
export const NATIVE_CREATION_RANGE = 10;
export const NATIVE_OFFSCREEN_MULT = 0.5;
export const NATIVE_PED_REMOVE_DIST = 51;
export const NATIVE_PED_REMOVE_SPECIAL = 65;
export const NATIVE_MANAGE_REMOVE = 54.5;
export const NATIVE_MANAGE_REMOVE_FAR = 65;
export const NATIVE_VISIBLE_SPAWN_GATE = 42.5;
export const NATIVE_PED_GRACE_MS = 4000;
export const NATIVE_COP_GRACE_MS = 10000;

/** 1.0 on foot, up to 1.5 with vehicle speed (CPopulation::PedCreationDistMultiplier). */
export function pedCreationDistMultiplier(vehicleSpeed2D: number): number {
  if (!(vehicleSpeed2D > 0)) return 1;
  return Math.min(1.5, Math.max(1, vehicleSpeed2D - 0.1 + 1));
}

/** Onscreen 40-50 m band scaled by PCDM and the camera generation multiplier. */
export function onscreenSpawnBand(pcdm: number, generationMult = 1): { min: number; max: number } {
  return { min: pcdm * NATIVE_MIN_CREATION_DIST * generationMult, max: pcdm * (NATIVE_MIN_CREATION_DIST + NATIVE_CREATION_RANGE) * generationMult };
}

/** Offscreen 15-25 m band (50*0.5=25 minus the 10 range). */
export function offscreenSpawnBand(pcdm: number): { min: number; max: number } {
  const max = pcdm * (NATIVE_MIN_CREATION_DIST + NATIVE_CREATION_RANGE) * NATIVE_OFFSCREEN_MULT;
  return { min: max - NATIVE_CREATION_RANGE, max };
}

/** Visible spawns must lie beyond 42.5*PCDM (CanCameraSeeAPedHere gate). */
export function visibleSpawnAllowed(distance2D: number, pcdm: number): boolean {
  return distance2D >= pcdm * NATIVE_VISIBLE_SPAWN_GATE;
}

/** Gang party size from AddToPopulation: 50% reject, else 1-4 (7/17/11/15%). */
export function gangPartySize(rand100: number): number {
  if (rand100 < 50) return 0;
  if (rand100 < 57) return 1;
  if (rand100 >= 74) return rand100 >= 85 ? 4 : 3;
  return 2;
}

/** >2-star foot `addCop` override (CPopulation::AddToPopulation). */
export function wantsCopOverride(o: { wanted: number; numCop: number; maxCops: number; playerInVehicle: boolean }): boolean {
  return o.wanted > 2 && o.numCop < o.maxCops && !o.playerInVehicle;
}

/** ManagePed removal decision. Returns 'keep' | 'fade' | 'remove'. */
export function managePed(o: {
  distance2D: number; pcdm: number; generationMult?: number; onScreen: boolean; farAwayCull: boolean;
  graceExpires: number; now: number; sniperMode: boolean; lookingAside: boolean;
}): 'keep' | 'fade' | 'remove' {
  const gen = o.generationMult ?? 1;
  const removal = o.distance2D / o.pcdm;
  const limit = gen * (o.farAwayCull ? NATIVE_MANAGE_REMOVE_FAR : NATIVE_MANAGE_REMOVE);
  if (limit <= removal) return o.onScreen ? 'fade' : 'remove';
  if (removal <= 25 || o.onScreen) return 'keep';
  if (o.now <= o.graceExpires) return 'keep';
  if (o.sniperMode || o.lookingAside) return 'keep';
  return 'remove';
}
