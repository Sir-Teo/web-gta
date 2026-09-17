/** Weather engine — full-game port facade.
 *
 * Provenance: `world/nativeWeather.ts` (region hourly lists, rain/sandstorm/
 * fog factors, WINDYNESS table), `world/timecycle.ts` (old/new interpolation,
 * LA smog blend), `world/weatherRegion.ts` (decay/elusive regions for wanted).
 */
export { WEATHER, nativeWeatherBlend, NativeWeather } from '../world/nativeWeather';
export { GAME_MINUTES_PER_SECOND } from '../world/timecycle';

/** Wet-road factor 0..1 from rain amount (drives chassis wetGripFactor). */
export function wetRoadsFromRain(rain01: number): number {
  return Math.max(0, Math.min(1, rain01));
}
