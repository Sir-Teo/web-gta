import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {fixedGroundDistance} from '../src/simulation/fixedGround';

beforeAll(async()=>{await RAPIER.init();});

test('paused terrain replacement is queryable without advancing dynamic bodies',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 try{
  const old=world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10));
  const moving=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(150,100,-2500));
  world.createCollider(RAPIER.ColliderDesc.ball(1),moving);
  world.step();
  world.removeCollider(old,true);
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10).setTranslation(150,20,-2500));
  const before={...moving.translation()};
  expect(fixedGroundDistance(world,150,-2500)).toBeCloseTo(979,5);
  expect(fixedGroundDistance(world,0,0)).toBeUndefined();
  expect({...moving.translation()}).toEqual(before);
 }finally{world.free();}
});

test('spawn support excludes disabled colliders, sensors and moving bodies',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10).setTranslation(0,20,0).setSensor(true));
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10).setTranslation(0,15,0)).setEnabled(false);
  const disabled=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,10,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10),disabled);disabled.setEnabled(false);
  const moving=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,5,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10),moving);
  expect(fixedGroundDistance(world,0,0)).toBeUndefined();
  world.createCollider(RAPIER.ColliderDesc.cuboid(10,1,10));
  expect(fixedGroundDistance(world,0,0)).toBeCloseTo(999,5);
 }finally{world.free();}
});
