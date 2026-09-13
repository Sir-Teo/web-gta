import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {sampleNativeChassis} from '../src/simulation/nativeChassis';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
test('chassis snapshot converts identity axes and native linear/angular units',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());world.createCollider(RAPIER.ColliderDesc.ball(.1).setMass(1000),body);world.step();
  body.setLinvel({x:5,y:10,z:-15},true);body.setAngvel({x:1,y:2,z:3},true);const s=sampleNativeChassis(body);
  expect(s.forward.y).toBe(1);expect(s.right.x).toBe(1);expect(s.direction.z).toBe(-1);
  expect(s.linear.x).toBeCloseTo(.1,7);expect(s.linear.y).toBeCloseTo(.3,7);expect(s.linear.z).toBeCloseTo(.2,7);
  expect(s.angular.y).toBeCloseTo(-.06,7);expect(s.angular.z).toBeCloseTo(.04,7);expect(s.forwardSpeed).toBeCloseTo(.3,7);
});
test('rotated chassis axes and COM remain world-aligned rather than body-local',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10,20,30).setRotation(q));world.createCollider(RAPIER.ColliderDesc.ball(.1).setTranslation(.5,0,0).setMass(1000),body);world.step();
  const s=sampleNativeChassis(body);expect(s.right.z).toBeCloseTo(1,6);expect(s.direction.x).toBeCloseTo(1,6);expect(s.centerOfMass.z).toBeCloseTo(.5,5);
  body.setLinvel({x:50,y:0,z:0},true);expect(s.linear.x).toBe(0);
});
