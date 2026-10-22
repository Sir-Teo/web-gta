import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {syncFrozenVehicle} from '../src/simulation/nativeFrozenVehicle';
let world:RAPIER.World|undefined;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
function setup(type=RAPIER.RigidBodyType.Dynamic){world=new RAPIER.World({x:0,y:-9.81,z:0});const body=world.createRigidBody(new RAPIER.RigidBodyDesc(type).setTranslation(0,2,0)),collider=world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1),body);return {world,body,collider};}

test('a frozen vehicle retains solid collision and its pose under gravity, then resumes dynamic movement',()=>{
 const {world,body,collider}=setup();body.setLinvel({x:10,y:0,z:0},true);body.setAngvel({x:0,y:3,z:0},true);syncFrozenVehicle(body,true);const pose={...body.translation()},rotation={...body.rotation()};
 for(let i=0;i<120;i++)world.step();expect(body.translation()).toEqual(pose);expect(body.rotation()).toEqual(rotation);expect(body.isEnabled()).toBe(true);
 expect(world.castRay(new RAPIER.Ray({x:0,y:10,z:0},{x:0,y:-1,z:0}),20,true)?.collider.handle).toBe(collider.handle);
 syncFrozenVehicle(body,false);expect(body.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic);body.setLinvel({x:2,y:0,z:0},true);for(let i=0;i<30;i++)world.step();expect(body.translation().x).toBeGreaterThan(.5);expect(body.translation().y).toBeLessThan(pose.y);
});

test('a moving physical body collides with the held vehicle instead of passing through it',()=>{
 const {world,body}=setup();world.gravity={x:0,y:0,z:0};syncFrozenVehicle(body,true);const other=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-4,2,0).setLinvel(8,0,0));world.createCollider(RAPIER.ColliderDesc.ball(.3).setRestitution(0),other);
 for(let i=0;i<60;i++)world.step();expect(other.translation().x).toBeLessThan(-1.25);expect(body.translation()).toEqual({x:0,y:2,z:0});
});

test('repeated freezes restore the prior mode and preserve a later playback or attachment owner',()=>{
 const {body}=setup();syncFrozenVehicle(body,true);syncFrozenVehicle(body,true);syncFrozenVehicle(body,false);expect(body.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic);
 syncFrozenVehicle(body,true);body.setBodyType(RAPIER.RigidBodyType.KinematicVelocityBased,true);syncFrozenVehicle(body,true);syncFrozenVehicle(body,false);expect(body.bodyType()).toBe(RAPIER.RigidBodyType.KinematicVelocityBased);
 body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);syncFrozenVehicle(body,true);syncFrozenVehicle(body,false,true);syncFrozenVehicle(body,false);expect(body.bodyType()).toBe(RAPIER.RigidBodyType.KinematicPositionBased);
});

test('freezing leaves independent body/collider disabling intact and restores an originally fixed body',()=>{
 const {body,collider}=setup(RAPIER.RigidBodyType.Fixed);collider.setEnabled(false);body.setEnabled(false);syncFrozenVehicle(body,true);expect(body.isEnabled()).toBe(false);expect(collider.isEnabled()).toBe(false);syncFrozenVehicle(body,false);expect(body.bodyType()).toBe(RAPIER.RigidBodyType.Fixed);expect(body.isEnabled()).toBe(false);expect(collider.isEnabled()).toBe(false);
});

test('a freeze cancels queued movement but permits explicit script teleports while held',()=>{
 const {world,body}=setup(RAPIER.RigidBodyType.KinematicPositionBased);body.setNextKinematicTranslation({x:50,y:2,z:0});syncFrozenVehicle(body,true);world.step();expect(body.translation()).toEqual({x:0,y:2,z:0});body.setTranslation({x:3,y:4,z:5},true);syncFrozenVehicle(body,true);world.step();expect(body.translation()).toEqual({x:3,y:4,z:5});syncFrozenVehicle(body,false);expect(body.bodyType()).toBe(RAPIER.RigidBodyType.KinematicPositionBased);
});
