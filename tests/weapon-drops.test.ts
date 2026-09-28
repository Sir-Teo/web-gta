import { expect, test } from 'vitest';
import { Group } from 'three';
import { WeaponDrops, deadPedWeaponDrops } from '../src/simulation/WeaponDrops';

const fakeModel = () => ({ geometries: [{ positions: new Float32Array([0, 0, 0]), uvs: [], indices: new Uint32Array([]), materials: [], materialIds: new Uint8Array([]), flags: 0 }], frames: [], atomics: [] }) as any;
const setup = () => {
  const added: Group[] = [];
  const drops = new WeaponDrops({ add: (o: Group) => { added.push(o); } }, { load: async () => ({ asset: { model: fakeModel(), textures: [] } }) }, () => 0);
  return { drops, added };
};
const player = { position: { x: 0, y: 0, z: 0 }, alive: true, onFoot: true };

test('dropped guns ground themselves, hand over rounds once, then retire', async () => {
  const { drops, added } = setup();
  expect(await drops.report({ x: 0, y: 5, z: 0 }, 22, 9)).toBe(true);
  expect(added).toHaveLength(1);
  expect(drops.snapshot()).toMatchObject([{ weapon: 22, rounds: 9 }]);
  let collected: [number, number][] = [];
  drops.step(1, { ...player, position: { x: 0, y: 0, z: 10 } }, () => { throw new Error('out of reach'); });
  drops.step(1, player, (w, r) => { collected.push([w, r]); return 'Pistol'; });
  expect(collected).toEqual([[22, 9]]);
  expect(drops.snapshot()).toEqual([]);
});

test('CPed::CreateDeadPedWeaponPickups drops every weapon but fists and the detonator, guns only with ammo, up to twice the street amount', () => {
  expect(deadPedWeaponDrops([{ type: 22, totalAmmo: 1000 }, { type: 3, totalAmmo: 1000 }])).toEqual([{ weapon: 22, ammo: 60 }, { weapon: 3, ammo: 2 }]);
  expect(deadPedWeaponDrops([{ type: 31, totalAmmo: 25001 }])).toEqual([{ weapon: 31, ammo: 160 }]);
  expect(deadPedWeaponDrops([{ type: 22, totalAmmo: 7 }])).toEqual([{ weapon: 22, ammo: 7 }]);
  // An empty gun stays with the body; a melee weapon drops even with nothing counted.
  expect(deadPedWeaponDrops([{ type: 22, totalAmmo: 0 }, { type: 4, totalAmmo: 0 }, { type: 0, totalAmmo: 0 }, { type: 40, totalAmmo: 1 }])).toEqual([{ weapon: 4, ammo: 0 }]);
});

test('a same-weapon drop within 5 units takes the ammo instead of a new pickup (CPickups::TryToMerge_WeaponType)', async () => {
  const { drops, added } = setup();
  await Promise.all([drops.report({ x: 0, y: 0, z: 0 }, 22, 60), drops.report({ x: 3, y: 0, z: 0 }, 22, 60)]);
  expect(added).toHaveLength(1);
  expect(drops.snapshot()).toMatchObject([{ weapon: 22, rounds: 120 }]);
  await drops.report({ x: 3, y: 0, z: 0 }, 31, 160);
  await drops.report({ x: 6, y: 0, z: 0 }, 22, 60);
  expect(drops.snapshot().map(d => [d.weapon, d.rounds])).toEqual([[22, 120], [31, 160], [22, 60]]);
});

test('drops stay while the player is away, time out after 20 s, and are taken on foot within √1.8 across and 2 up', async () => {
  const { drops } = setup();
  await drops.report({ x: 0, y: 0, z: 0 }, 22, 5);
  drops.step(1, { ...player, position: { x: 500, y: 0, z: 0 } }, () => 'Pistol');
  expect(drops.snapshot()).toHaveLength(1);
  let calls = 0;
  drops.step(1, { ...player, onFoot: false }, () => { calls++; return 'Pistol'; });
  drops.step(1, { ...player, position: { x: 1.2, y: 0, z: .6 } }, () => { calls++; return 'Pistol'; });
  drops.step(1, { ...player, position: { x: 0, y: 2.2, z: 0 } }, () => { calls++; return 'Pistol'; });
  expect(calls).toBe(0);
  drops.step(1, { ...player, position: { x: 1, y: 1.8, z: .5 } }, () => { calls++; return 'Pistol'; });
  expect(calls).toBe(1);
  await drops.report({ x: 0, y: 0, z: 0 }, 22, 5);
  drops.step(21, { ...player, position: { x: 500, y: 0, z: 0 } }, () => 'Pistol');
  expect(drops.snapshot()).toEqual([]);
  drops.dispose();
});

test('a script ped whose death weapons persist drops PICKUP_ONCE_FOR_MISSION: no timeout and no merging',async()=>{
  const { drops } = setup();
  await drops.report({ x: 0, y: 0, z: 0 }, 22, 60, true);
  await drops.report({ x: 1, y: 0, z: 0 }, 22, 60);
  expect(drops.snapshot().map(d => d.rounds)).toEqual([60, 60]);
  drops.step(500, { ...player, position: { x: 500, y: 0, z: 0 } }, () => 'Pistol');
  expect(drops.snapshot()).toMatchObject([{ weapon: 22, rounds: 60 }]);
  drops.dispose();
});

// CWorld::ClearExcitingStuffFromArea's CPickups::RemoveUnnecessaryPickups takes the PICKUP_ONCE_TIMEOUT drops in the
// sphere; CPickups::PassTime runs their timeouts on (a passed minute is a second), so a long wait clears them.
test('clearing an area removes the dropped guns in it, and passed time ages them out', async () => {
  const { drops } = setup();
  await drops.report({ x: 0, y: 0, z: 0 }, 22, 9);await drops.report({ x: 50, y: 0, z: 0 }, 31, 60);
  drops.removeInSphere({ x: 0, y: 0, z: 0 }, 10);
  expect(drops.snapshot().map(d => d.weapon)).toEqual([31]);
  drops.passTime(360);drops.step(0, { ...player, position: { x: 0, y: 0, z: 100 } }, () => undefined);
  expect(drops.snapshot()).toEqual([]);
});
