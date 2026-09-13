import { readFileSync } from 'node:fs';
import { beforeAll, afterEach, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Scene, Group } from 'three';
import { readDff } from '../src/assets/dff';
import { readCol } from '../src/assets/col';
import { installNativeScene } from '../src/simulation/nativeScene';
import type { ScenePart } from '../src/assets/scene';
const makePart = (): ScenePart => ({
  model: readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),
  collision: readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],
  name: 'diagnostic_col3', textures: [], dictionaryNames: [], notices: [], collisionSource: 'diagnostic.col',
  placements: [0, 10].map(x => ({ modelId: 103, modelName: 'diagnostic_col3', instanceType: 0, interior: 0, position: [x, 0, 0], rotation: [0, 0, 0, 1], lodIndex: -1 })),
});
let world: RAPIER.World;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => world?.free());
test('native scene installs both visual instances and physical source metadata and unloads only its own objects', () => {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const scene = new Scene(), existing = new Group(); scene.add(existing);
  world.createCollider(RAPIER.ColliderDesc.ball(1).setTranslation(100, 0, 0));
  const installed = installNativeScene(world, scene, [makePart()]); world.step();
  expect(installed.instanceCount).toBe(2); expect(installed.colliderCount).toBe(6); expect(scene.children).toHaveLength(2);
  const hit = world.castRay(new RAPIER.Ray({ x: 10, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }), 10, true)!;
  expect(hit.timeOfImpact).toBeCloseTo(3.5, 4);
  expect(installed.sources.get(hit.collider.handle)).toMatchObject({ modelName: 'diagnostic_col3', source: { kind: 'sphere' }, placement: { position: [10, 0, 0] } });
  const meshes: any[] = []; installed.root.traverse(o => { if ((o as any).isMesh) meshes.push(o); });
  expect(meshes).toHaveLength(2); expect(meshes[0].geometry).toBe(meshes[1].geometry);
  installed.setNight(1); expect(meshes[0].geometry.getAttribute('color').array[0]).toBeLessThan(1);
  installed.dispose(); installed.dispose(); expect(scene.children).toEqual([existing]); expect(world.bodies.len()).toBe(0); expect(world.colliders.len()).toBe(1);
});
test('native scene rollback removes earlier objects when later visual bounds fail', () => {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); const scene = new Scene();
  const invalid = makePart(); invalid.placements[0].position[0] = 1e7;
  expect(() => installNativeScene(world, scene, [makePart(), invalid])).toThrow('bounds');
  expect(scene.children).toHaveLength(0); expect(world.bodies.len()).toBe(0); expect(world.colliders.len()).toBe(0);
});
test('missing collision and transformed scene roots are explicit installation decisions', () => {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); const scene = new Scene(), part = makePart(); part.collision = undefined;
  expect(() => installNativeScene(world, scene, [part])).toThrow('Missing collision');
  expect(world.bodies.len()).toBe(0);
  const visualOnly = installNativeScene(world, scene, [part], { allowMissingCollision: true }); expect(visualOnly.missingCollision).toEqual(['diagnostic_col3']); expect(visualOnly.colliderCount).toBe(0); visualOnly.dispose();
  const excessive = makePart(); excessive.placements = Array(4097).fill(excessive.placements[0]); expect(() => installNativeScene(world, scene, [excessive])).toThrow('limits');
  scene.position.x = 1; expect(() => installNativeScene(world, scene, [makePart()])).toThrow('untransformed');
});


test('timed scene visibility follows hour boundaries and midnight without reallocating collision', () => {
  world=new RAPIER.World({x:0,y:-9.81,z:0});const day=makePart(),night=makePart(),always=makePart();
  day.definition={id:103,model:day.name,dictionary:'x',section:'tobj',timeOn:6,timeOff:18};
  night.definition={...day.definition,timeOn:18,timeOff:6};
  const installed=installNativeScene(world,new Scene(),[day,night,always]);const colliders=world.colliders.len();
  for(const [minutes,dayVisible,nightVisible] of [[359.99,false,true],[360,true,false],[1079.99,true,false],[1080,false,true],[1440,false,true],[-1,false,true]] as const) {
    installed.setTime(minutes);expect(installed.root.children.map(o=>o.visible)).toEqual([dayVisible,nightVisible,true]);expect(installed.visibleInstanceCount).toBe(4);expect(world.colliders.len()).toBe(colliders);
  }
  expect(()=>installed.setTime(NaN)).toThrow('finite');expect(installed.root.children.map(o=>o.visible)).toEqual([false,true,true]);
  installed.dispose();installed.setTime(360);expect(installed.visibleInstanceCount).toBe(0);
});
test('equal timed hours are inactive, full-day ranges stay visible and invalid metadata fails before allocation', () => {
  world=new RAPIER.World({x:0,y:-9.81,z:0});const a=makePart(),b=makePart();a.definition={id:103,model:a.name,dictionary:'x',section:'tobj',timeOn:0,timeOff:0};b.definition={...a.definition,timeOff:24};
  const installed=installNativeScene(world,new Scene(),[a,b]);installed.setTime(720);expect(installed.root.children.map(o=>o.visible)).toEqual([false,true]);installed.dispose();
  a.definition.timeOff=undefined;expect(()=>installNativeScene(world,new Scene(),[a])).toThrow('on/off');expect(world.colliders.len()).toBe(0);
});

test('out-of-range timed visuals remain available until their registered counterpart is installed', () => {
  world=new RAPIER.World({x:0,y:-9.81,z:0});const day=makePart(),night=makePart();day.name='shop_dy';night.name='shop_nt';
  day.definition={id:1,model:day.name,dictionary:'x',section:'tobj',timeOn:6,timeOff:18};night.definition={...day.definition,id:2,model:night.name,timeOn:18,timeOff:6};day.timeCounterpart='shop_nt';night.timeCounterpart='shop_dy';
  const incomplete=installNativeScene(world,new Scene(),[day]);incomplete.setTime(1200);expect(incomplete.visibleInstanceCount).toBe(2);incomplete.dispose();
  const complete=installNativeScene(world,new Scene(),[day,night]);complete.setTime(1200);expect(complete.root.children.map(o=>o.visible)).toEqual([false,true]);
  complete.setTime(720);expect(complete.root.children.map(o=>o.visible)).toEqual([true,false]);complete.dispose();
});
