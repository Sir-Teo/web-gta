import {beforeAll,afterEach,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
let sim:Simulation;beforeAll(async()=>RAPIER.init());afterEach(()=>sim?.dispose());
const sun={x:0,y:10,z:0},camera={x:0,y:0,z:0};
test('static world shapes obstruct only within the sun-to-camera segment and removal restores sight',()=>{
  sim=new Simulation(true);expect(sim.sunObstructed(sun,camera)).toBe(false);
  const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2,2).setTranslation(0,5,0));sim.world.step();
  expect(sim.sunObstructed(sun,camera)).toBe(true);sim.world.removeCollider(wall,true);sim.world.step();expect(sim.sunObstructed(sun,camera)).toBe(false);
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2,2).setTranslation(0,-2,0));sim.world.step();expect(sim.sunObstructed(sun,camera)).toBe(false);
});
test('dynamic actors, kinematic actors and fixed sensors do not obstruct the corona',()=>{
  sim=new Simulation(true);
  for(const desc of [RAPIER.RigidBodyDesc.dynamic(),RAPIER.RigidBodyDesc.kinematicPositionBased()]){
    const body=sim.world.createRigidBody(desc.setTranslation(0,5,0));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2,2),body);
  }
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2,2).setTranslation(0,3,0).setSensor(true));sim.world.step();
  expect(sim.sunObstructed(sun,camera)).toBe(false);
});
test('fixed bodies and triangle collision obstruct the corona without using visual meshes',()=>{
  sim=new Simulation(true);const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  sim.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array([-2,5,-2,2,5,-2,0,5,2]),new Uint32Array([0,1,2])),body);sim.world.step();
  expect(sim.sunObstructed(sun,camera)).toBe(true);expect(sim.sunObstructed(camera,camera)).toBe(false);
  expect(()=>sim.sunObstructed({x:NaN,y:0,z:0},camera)).toThrow();
});
