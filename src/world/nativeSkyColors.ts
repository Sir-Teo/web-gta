import { timecycleInterval } from '../assets/timecycle';
export type SkyRGB = [number, number, number];
export interface NativeSkyColors { top: SkyRGB; bottom: SkyRGB }
export interface SkyWeather { foggyness: number; underwaterness: number }
const graySamples = [30, 30, 30, 50, 60, 60, 50, 35];
const byte = (value: number) => ((Math.trunc(value) % 256) + 256) % 256;

/** Pinned PC source byte-cast transcription; original platform rounding remains unverified. */
export function belowHorizonColor(minutes: number, altitude: number, bottom: SkyRGB,
  weather: SkyWeather): SkyRGB {
  if (!Number.isFinite(altitude) || [weather.foggyness, weather.underwaterness].some(v => !Number.isFinite(v) || v < 0 || v > 1))
    throw new Error('Invalid native sky atmosphere.');
  const { current, next, blend } = timecycleInterval(minutes);
  const gray = graySamples[current] * (1 - blend) + graySamples[next] * blend;
  const factor = Math.max(Math.min(1, Math.max(0, (altitude - 25) / 80)), weather.foggyness);
  return bottom.map(channel => {
    const underwater = byte(gray * (1 - weather.underwaterness) + channel * weather.underwaterness);
    return byte(underwater + byte(factor * (channel - underwater)));
  }) as SkyRGB;
}
