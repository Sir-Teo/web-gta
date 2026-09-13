import { clamp } from '../core/math';

// PC 1.0 reverse-engineering reference: CGame initializes CClock with 1000 ms/minute.
// docs/research/SOURCES.md records the provenance and platform limits.
export const GAME_MINUTES_PER_SECOND = 1;
export const wrapMinutes = (minutes: number) => ((minutes % 1440) + 1440) % 1440;
type RGB = [number, number, number];
interface Keyframe {
  hour: number; top: number; horizon: number; ambient: number; ground: number; sun: number;
  ambientIntensity: number; sunIntensity: number; fog: number; night: number;
}
// The sample hours follow the reference; all colors/intensities below are authored.
export const CLEAR_TIME_KEYS: readonly Keyframe[] = [
  { hour: 0, top: 0x101b2d, horizon: 0x343d48, ambient: 0x899bb5, ground: 0x515466, sun: 0xb2c4db, ambientIntensity: 0.65, sunIntensity: 0, fog: 0.0055, night: 1 },
  { hour: 5, top: 0x25344b, horizon: 0x736d79, ambient: 0x9aacc4, ground: 0x696471, sun: 0xe7b496, ambientIntensity: 0.8, sunIntensity: 0, fog: 0.006, night: 1 },
  { hour: 6, top: 0x627d92, horizon: 0xdfa080, ambient: 0xc7c3bc, ground: 0x877863, sun: 0xffb683, ambientIntensity: 1.2, sunIntensity: 0.1, fog: 0.0055, night: 0.5 },
  { hour: 7, top: 0x86a4b2, horizon: 0xe0c5a3, ambient: 0xd8d7c5, ground: 0x88816b, sun: 0xffd1a4, ambientIntensity: 1.8, sunIntensity: 1.7, fog: 0.0042, night: 0 },
  { hour: 12, top: 0x78a9bc, horizon: 0xc8d0ba, ambient: 0xd8e0d4, ground: 0x807c65, sun: 0xffedcd, ambientIntensity: 2, sunIntensity: 2.3, fog: 0.0036, night: 0 },
  { hour: 19, top: 0x847d83, horizon: 0xeeaa75, ambient: 0xdfc3ac, ground: 0x7b6859, sun: 0xffae72, ambientIntensity: 1.6, sunIntensity: 1.3, fog: 0.0048, night: 0 },
  { hour: 20, top: 0x3a435e, horizon: 0xa47d80, ambient: 0xa2a0b1, ground: 0x686074, sun: 0xe59375, ambientIntensity: 0.85, sunIntensity: 0, fog: 0.0052, night: 0.85 },
  { hour: 22, top: 0x131f34, horizon: 0x3e4456, ambient: 0x899bb5, ground: 0x515466, sun: 0xb2c4db, ambientIntensity: 0.65, sunIntensity: 0, fog: 0.0055, night: 1 },
];
function linearColor(hex: number): RGB {
  return [hex >> 16 & 255, hex >> 8 & 255, hex & 255].map(channel => {
    const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as RGB;
}
const keys = CLEAR_TIME_KEYS.map(key => ({ ...key, top: linearColor(key.top), horizon: linearColor(key.horizon),
  ambient: linearColor(key.ambient), ground: linearColor(key.ground), sun: linearColor(key.sun) }));
export function sampleTimecycle(minutes: number) {
  const hour = wrapMinutes(minutes) / 60;
  let index = keys.length - 1;
  for (let i = 0; i < keys.length - 1; i++) if (hour < keys[i + 1].hour) { index = i; break; }
  const a = keys[index], b = keys[(index + 1) % keys.length];
  const t = (hour - a.hour) / ((b.hour || 24) - a.hour);
  const blend = (x: number, y: number) => x + (y - x) * t;
  const color = (x: RGB, y: RGB): RGB => [blend(x[0], y[0]), blend(x[1], y[1]), blend(x[2], y[2])];
  // Authored directional-light/shadow path. The visible sun uses world/sun.ts separately.
  const angle = hour >= 6 && hour <= 20 ? (hour - 6) / 14 * Math.PI
    : (1 + ((hour < 6 ? hour + 24 : hour) - 20) / 10) * Math.PI;
  const direction = { x: Math.cos(angle) * 0.85, y: Math.sin(angle), z: 0.32 };
  const length = Math.hypot(direction.x, direction.y, direction.z);
  direction.x /= length; direction.y /= length; direction.z /= length;
  const horizonFade = clamp(direction.y / 0.12, 0, 1);
  return { top: color(a.top, b.top), horizon: color(a.horizon, b.horizon), ambient: color(a.ambient, b.ambient),
    ground: color(a.ground, b.ground), sun: color(a.sun, b.sun), direction,
    ambientIntensity: blend(a.ambientIntensity, b.ambientIntensity), sunIntensity: blend(a.sunIntensity, b.sunIntensity) * horizonFade,
    fog: blend(a.fog, b.fog), night: blend(a.night, b.night), hour };
}
