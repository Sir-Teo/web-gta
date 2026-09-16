import { expect, test } from 'vitest';
import { Group } from 'three';
import { WeaponDrops } from '../src/simulation/WeaponDrops';

const fakeModel = () => ({ geometries: [{ positions: new Float32Array([0, 0, 0]), uvs: [], indices: new Uint32Array([]), materials: [], materialIds: new Uint8Array([]), flags: 0 }], frames: [], atomics: [] }) as any;
const setup = () => {
  const added: Group[] = [];
  const drops = new WeaponDrops({ add: (o: Group) => { added.push(o); } }, { load: async () => ({ asset: { model: fakeModel(), textures: [] } }) }, () => 0);
  return { drops, added };
};
const player = { position: { x: 0, y: 0, z: 0 }, alive: true, onFoot: true };

test('dropped guns ground themselves, hand over rounds once, then retire', async () => {
  const { drops, added } = setup();
  expect(await drops.report({ x: 0, y: 5, z: 0 }, 22, 0)).toBe(false);
  expect(await drops.report({ x: 0, y: 5, z: 0 }, 22, 9)).toBe(true);
  expect(added).toHaveLength(1);
  expect(drops.snapshot()).toMatchObject([{ weapon: 22, rounds: 9 }]);
  let collected: [number, number][] = [];
  drops.step(1, { ...player, position: { x: 0, y: 0, z: 10 } }, () => { throw new Error('out of reach'); });
  drops.step(1, player, (w, r) => { collected.push([w, r]); return 'Pistol'; });
  expect(collected).toEqual([[22, 9]]);
  expect(drops.snapshot()).toEqual([]);
});

test('drops cap at eight, age out and stay out of vehicles', async () => {
  const { drops } = setup();
  for (let i = 0; i < 10; i++) await drops.report({ x: i * 100, y: 0, z: 0 }, 22, 5);
  expect(drops.snapshot()).toHaveLength(8);
  drops.step(121, player, () => 'Pistol');
  expect(drops.snapshot()).toEqual([]);
  await drops.report({ x: 0, y: 0, z: 0 }, 22, 5);
  let calls = 0;
  drops.step(1, { ...player, onFoot: false }, () => { calls++; return 'Pistol'; });
  expect(calls).toBe(0);
  expect(drops.snapshot()).toHaveLength(1);
  drops.dispose();
  expect(drops.snapshot()).toEqual([]);
});
