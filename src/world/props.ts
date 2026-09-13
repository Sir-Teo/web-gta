import { random } from '../core/math';
import type { House, Solid } from './layout';

export interface HousePart { id: string; material: 'concrete' | 'trim' | 'wood' | 'darkTrim' | 'mailbox'; x: number; y: number; z: number; w: number; h: number; d: number }
export function localToWorld(house: House, x: number, z: number) {
  return { x: house.x + Math.cos(house.angle) * x + Math.sin(house.angle) * z,
    z: house.z - Math.sin(house.angle) * x + Math.cos(house.angle) * z };
}
function outsideSidewalk(x: number, z: number) {
  return Math.hypot(x, z) >= 19.35 && !(Math.abs(x) < 10.65 && z > 0 && z < 150);
}
export function houseParts(house: House): HousePart[] {
  const d = house.depth, w = house.width;
  const parts: HousePart[] = [];
  const add = (id: string, material: HousePart['material'], x: number, y: number, z: number, width: number, height: number, depth: number) =>
    parts.push({ id: `${house.id}/${id}`, material, x, y, z, w: width, h: height, d: depth });
  add('foundation', 'concrete', 0, 0.13, 0, w + 0.3, 0.3, d + 0.3);
  add('porch', 'concrete', 0.1, 0.24, d / 2 + 1.3, 5.7, 0.48, 2.5);
  add('canopy', 'trim', 0.1, 2.8, d / 2 + 1.2, 6.1, 0.18, 2.8);
  for (const x of [-2.55, 2.75]) add(`porch-post-${x}`, 'trim', x, 1.55, d / 2 + 2.35, 0.14, 2.7, 0.14);
  for (let i = 0; i < 3; i++) add(`step-${i}`, 'concrete', 0, 0.07 + i * 0.08, d / 2 + 3.1 - i * 0.3, 2, 0.14 + i * 0.16, 0.4);
  for (const side of [-1, 1]) {
    const x = side * (w / 2 + 0.7), start = d / 2 + 0.25;
    let length = 5.5;
    // Keep the authored fence inside the lot where the turning head meets its front garden.
    while (length > 0.1) {
      const end = localToWorld(house, x, start + length);
      if (outsideSidewalk(end.x, end.z)) break;
      length -= 0.05;
    }
    if (length > 0.1) add(`fence-${side}`, 'wood', x, 0.65, start + length / 2, 0.1, 1.3, length);
    for (let z = 0; z <= length; z += 1.8) add(`fence-post-${side}-${z}`, 'darkTrim', x, 0.75, start + z, 0.13, 1.5, 0.13);
  }
  add('mailbox-post', 'darkTrim', 2.2, 0.6, d / 2 + 7.4, 0.09, 1.2, 0.09);
  add('mailbox', 'mailbox', 2.2, 1.25, d / 2 + 7.4, 0.38, 0.3, 0.54);
  return parts;
}
export function housePartSolid(house: House, part: HousePart): Solid {
  const point = localToWorld(house, part.x, part.z);
  return { id: part.id, ...point, y: part.y, hx: part.w / 2, hy: part.h / 2, hz: part.d / 2, angle: house.angle };
}
export const TURNING_CURB = { radius: 16.65, tube: 0.11, start: Math.PI / 2 + Math.asin(7.2 / 16.65), arc: Math.PI * 2 - 2 * Math.asin(7.2 / 16.65) };
const joinZ = Math.sqrt(TURNING_CURB.radius ** 2 - 7.2 ** 2);
export const STREET_CURBS = [-1, 1].flatMap(side => [
  { x: side * 7.2, y: 0.085, z: (joinZ + 160.5) / 2, w: 0.22, h: 0.2, d: 160.5 - joinZ },
  { x: side * 10.3, y: 0.07, z: (Math.sqrt(19 ** 2 - 10.3 ** 2) + 158.5) / 2, w: 0.18, h: 0.18, d: 158.5 - Math.sqrt(19 ** 2 - 10.3 ** 2) },
]);
// Raised pavement provides a landing surface behind the narrow curb edges.
export const SIDEWALK_SLABS = [
  ...[-1, 1].map(side => ({ x: side * 8.75, z: (joinZ + 149) / 2, w: 3.28, d: 149 - joinZ, angle: 0 })),
  ...Array.from({ length: 80 }, (_, i) => {
    const angle = TURNING_CURB.start + (i + 0.5) * TURNING_CURB.arc / 80;
    return { x: Math.cos(angle) * 17.825, z: Math.sin(angle) * 17.825,
      w: 2 * 19 * Math.sin(TURNING_CURB.arc / 160), d: 2.35, angle: Math.PI / 2 - angle };
  }),
].map(slab => ({ ...slab, y: 0.0625, h: 0.225 }));
export const UTILITY_POLES = [-12, 12].flatMap(x => Array.from({ length: 6 }, (_, i) => ({ x, z: i === 0 ? -Math.sqrt(19.8 ** 2 - x ** 2) : -8 + i * 30,
  nextZ: i < 5 ? -8 + (i + 1) * 30 : null })));
export const STREET_LIGHTS = [22, 55, 100].map(z => ({ x: 10.7, z, height: 7.4, lampX: 8.15 }));
function sceneryLayout() {
  const rand = random(191);
  const palms = [[-16, -25, 14], [18, -27, 16], [-41, -5, 17], [40, 5, 15], [-17, 23, 14], [18, 42, 17], [-19, 65, 16], [20, 85, 14]]
    .map(([x, z, height]) => ({ x, z, height, seed: x * z }));
  for (let i = 0; i < 24; i++) palms.push({ x: (rand() > 0.5 ? 1 : -1) * (48 + rand() * 65), z: -60 + rand() * 250, height: 11 + rand() * 9, seed: i + 5 });
  // Distant decoration must also respect the cross-street roadway and sidewalks.
  for (const palm of palms) if (palm.z > 147 && palm.z < 175) palm.z = palm.z < 161 ? 146 : 176;
  const towers = Array.from({ length: 22 }, () => ({ x: -170 - rand() * 90, z: 175 + rand() * 100, h: 8 + rand() ** 2 * 42, w: 8 + rand() * 14, d: 9 + rand() * 15 }));
  const hills = Array.from({ length: 9 }, (_, i) => ({ x: -220 + i * 60, z: -290 - rand() * 60, w: 70 + rand() * 50, h: 30 + rand() * 25 }));
  return { palms, towers, hills };
}
export const SCENERY = sceneryLayout();
export function propSolids(): Solid[] {
  const result: Solid[] = STREET_CURBS.map((c, i) => ({ id: `curb-${i}`, x: c.x, y: c.y, z: c.z, hx: c.w / 2, hy: c.h / 2, hz: c.d / 2 }));
  result.push(...SIDEWALK_SLABS.map((c, i) => ({ id: `sidewalk-${i}`, x: c.x, y: c.y, z: c.z, hx: c.w / 2, hy: c.h / 2, hz: c.d / 2, angle: c.angle })));
  // Short boxes follow the same corrected arc as the rendered curb.
  const count = 80, step = TURNING_CURB.arc / count;
  for (let i = 0; i < count; i++) {
    const angle = TURNING_CURB.start + (i + 0.5) * step;
    result.push({ id: `turning-curb-${i}`, x: Math.cos(angle) * TURNING_CURB.radius, y: 0.1, z: Math.sin(angle) * TURNING_CURB.radius,
      hx: TURNING_CURB.radius * Math.sin(step / 2) + 0.008, hy: 0.1, hz: 0.105, angle: Math.PI / 2 - angle });
  }
  for (const [i, p] of UTILITY_POLES.entries()) result.push({ id: `utility-pole-${i}`, shape: 'cylinder', x: p.x, y: 5, z: p.z, hx: 0.16, hy: 5, hz: 0.16 });
  for (const [i, p] of STREET_LIGHTS.entries()) result.push({ id: `street-lamp-${i}`, shape: 'cylinder', x: p.x, y: p.height / 2, z: p.z, hx: 0.08, hy: p.height / 2, hz: 0.08 });
  for (const [i, p] of SCENERY.palms.entries()) {
    const bend = random(p.seed)() * 0.9 - 0.45;
    result.push({ id: `palm-${i}`, shape: 'cylinder', x: p.x + bend * 0.5, y: p.height / 2, z: p.z, hx: 0.29, hy: p.height / 2, hz: 0.29, tilt: -bend / p.height });
  }
  for (const x of [-48, 48]) result.push({ id: `perimeter-fence-${x}`, x, y: 0.95, z: 45, hx: 0.025, hy: 0.9, hz: 90 });
  for (const z of [107.6, 118.4]) result.push({ id: `bridge-parapet-${z}`, x: 0, y: 9.3, z, hx: 95, hy: 0.55, hz: 0.175 });
  return result;
}
