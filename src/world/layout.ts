export interface House {
  id: string; x: number; z: number; angle: number;
  width: number; depth: number; height: number;
  color: number; roof: number; porch: boolean;
}
export interface Solid { x: number; y: number; z: number; hx: number; hy: number; hz: number; angle?: number }
export const houses: House[] = [
  { id: 'johnson', x: -25, z: -13, angle: Math.PI / 2, width: 13, depth: 10, height: 5.6, color: 0x9d9984, roof: 0x534c42, porch: true },
  { id: 'north', x: -3, z: -31, angle: 0, width: 14, depth: 10, height: 3, color: 0xbdb6a0, roof: 0x655347, porch: true },
  { id: 'east', x: 25, z: -14, angle: -Math.PI / 2, width: 13, depth: 11, height: 3.1, color: 0xa8a493, roof: 0x635646, porch: true },
  ...Array.from({ length: 10 }, (_, i): House => ({
    id: `grove-${i}`, x: i % 2 ? 27 : -27, z: 16 + Math.floor(i / 2) * 22,
    angle: i % 2 ? -Math.PI / 2 : Math.PI / 2,
    width: 12 + (i % 3), depth: 10, height: i === 4 ? 5.1 : 2.9,
    color: [0xc5bd9d, 0x9aaca1, 0xb1ab9d, 0xa0a4a1, 0xb5a38b][i % 5],
    roof: [0x65574b, 0x695a48, 0x70534a][i % 3], porch: true,
  })),
];
export const solids: Solid[] = [
  { x: 0, y: -0.55, z: 40, hx: 250, hy: 0.5, hz: 250 },
  ...houses.map(h => ({ x: h.x, y: h.height / 2 + 0.2, z: h.z, hx: h.width / 2, hy: h.height / 2 + 0.2, hz: h.depth / 2, angle: h.angle })),
  // Bridge piers and deck are physically present, including the underside.
  ...[-42, -17, 17, 42].map(x => ({ x, y: 4.1, z: 113, hx: 0.75, hy: 4.1, hz: 3.8 })),
  { x: 0, y: 8.2, z: 113, hx: 95, hy: 0.65, hz: 5.5 },
];
export const SPAWN = { x: -3, y: 0.05, z: 5 };
export const VEHICLE_SPAWNS = [
  { id: 'greenwood', name: 'Greenwood', x: 6.5, z: 14, heading: Math.PI, color: 0x678778 },
  { id: 'sedan', name: 'Premier', x: -6.3, z: 52, heading: 0, color: 0xb7a589 },
];
