import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {readCol} from '../src/assets/col';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {installNativeVehicleBody} from '../src/simulation/nativeVehicleBody';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
const model=()=>readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
const handling=()=>prepareHandling(readHandling('TEST 1000 2000 0 .2 .3 -.4 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .25 -.25 .5 0 .25 .7 12345 0 0 1 2 3').records[0],0);
const pose={position:{x:10,y:3,z:-20},rotation:{x:0,y:0,z:0,w:1}},response={friction:.4,restitution:0};
test('dynamic COL preserves source shapes while handling owns mass and converted COM',()=>{
  world=new RAPIER.World({x:0,y:-9.81,z:0});const source=model(),installed=installNativeVehicleBody(world,source,handling(),pose,response);world.step();
  expect(installed.body.isDynamic()).toBe(true);expect(installed.body.mass()).toBeCloseTo(1000,3);const com=installed.body.localCom();expect(com.x).toBeCloseTo(.2,7);expect(com.y).toBeCloseTo(-.4,7);expect(com.z).toBeCloseTo(-.3,7);
  for(const inertia of Object.values(installed.body.principalInertia()))expect(inertia).toBeCloseTo(2000,3);expect(installed.body.gravityScale()).toBe(0);expect(installed.body.linearDamping()).toBe(0);expect(installed.sources.size).toBe(3);
  const hit=world.castRay(new RAPIER.Ray({x:10,y:8,z:-20},{x:0,y:-1,z:0}),10,true)!;expect(hit.timeOfImpact).toBeCloseTo(3.5,4);
  expect(installed.sources.get(hit.collider.handle)).toMatchObject({kind:'sphere',surface:{material:7}});
  const plane=world.castRay(new RAPIER.Ray({x:11.5,y:8,z:-20},{x:0,y:-1,z:0}),10,true)!;expect(plane.timeOfImpact).toBeCloseTo(5,4);expect(installed.sources.get(plane.collider.handle)?.kind).toBe('mesh');
  const box=world.castRay(new RAPIER.Ray({x:8,y:2.75,z:-20},{x:1,y:0,z:0}),5,true)!;expect(box.timeOfImpact).toBeCloseTo(1,4);expect(installed.sources.get(box.collider.handle)?.kind).toBe('box');
  source.spheres[0].surface.material=99;expect(installed.sources.get(hit.collider.handle)).toMatchObject({surface:{material:7}});
  installed.dispose();installed.dispose();expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);
});
test('partial invalid COL installation removes its body and colliders',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const source=model();source.boxes[0].max=[-100,-100,-100];
  expect(()=>installNativeVehicleBody(world,source,handling(),pose,response)).toThrow(/box/);expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);
});
