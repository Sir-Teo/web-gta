import { clamp } from '../../../src/core/math';

export interface PathPoint { x: number; z: number }
// Authored corridor follows the existing sidewalk through the turning head.
// The two ends stay on their own side of the cross street; road crossings need signals.
export const sidewalk: PathPoint[] = [{ x: -8.7, z: 145 }, { x: -8.7, z: 15.52 }];
const join = Math.asin(8.7 / 17.8);
for (let i = 1; i <= 30; i++) {
  const angle = -join - (Math.PI * 2 - join * 2) * i / 30;
  sidewalk.push({ x: Math.sin(angle) * 17.8, z: Math.cos(angle) * 17.8 });
}
sidewalk.push({ x: 8.7, z: 145 });
const lengths = sidewalk.slice(1).map((p, i) => Math.hypot(p.x - sidewalk[i].x, p.z - sidewalk[i].z));
export const sidewalkLength = lengths.reduce((a, b) => a + b, 0);
export function sidewalkPoint(distance: number): PathPoint {
  let remaining = clamp(distance, 0, sidewalkLength);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = remaining / lengths[i], a = sidewalk[i], b = sidewalk[i + 1];
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    remaining -= lengths[i];
  }
  return { ...sidewalk[0] };
}
export function nearestSidewalk(position: PathPoint) {
  let best = { distance: 0, separation: Infinity, point: sidewalk[0] }, offset = 0;
  for (let i = 0; i < lengths.length; i++) {
    const a = sidewalk[i], b = sidewalk[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((position.x - a.x) * dx + (position.z - a.z) * dz) / lengths[i] ** 2, 0, 1);
    const point = { x: a.x + dx * t, z: a.z + dz * t };
    const separation = Math.hypot(position.x - point.x, position.z - point.z);
    if (separation < best.separation) best = { distance: offset + lengths[i] * t, separation, point };
    offset += lengths[i];
  }
  return best;
}
