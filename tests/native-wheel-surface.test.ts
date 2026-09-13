import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeCollisionSurface,sampleNativeWheelSurface} from '../src/simulation/nativeWheelSurface';
import {sampleNativeWheelContact} from '../src/simulation/nativeWheelContact';
import type {NativeCollisionSource} from '../src/simulation/nativeCollision';
import {readSurfaceInfo} from '../src/assets/surfaceInfo';
import {indexNativeSurfaceInfo} from '../src/assets/surfaceIds';
import {readSurfaceAdhesion,surfaceAdhesiveLimit} from '../src/assets/surfaceAdhesion';
let world:RAPIER.World;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>world?.free());
function setup(){
  world=new RAPIER.World({x:0,y:0,z:0});
  const source:NativeCollisionSource={kind:'mesh',mesh:{positions:new Float32Array([-2,0,-2,2,0,-2,2,0,2,-2,0,2]),indices:new Uint32Array([0,2,1,0,3,2]),materials:new Uint8Array([1,28]),lights:new Uint8Array([0x23,0xA7])}};
  const floor=world.createCollider(RAPIER.ColliderDesc.trimesh(source.mesh.positions,source.mesh.indices));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1,0));
  world.createCollider(RAPIER.ColliderDesc.ball(.1).setMass(1000),body);
  const controller=world.createVehicleController(body);controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
  for(const x of [1,-1]){
    const i=controller.numWheels();controller.addWheel({x,y:0,z:0},{x:0,y:-1,z:0},{x:-1,y:0,z:0},1,.2);
    controller.setWheelSuspensionStiffness(i,0);controller.setWheelMaxSuspensionForce(i,0);controller.setWheelFrictionSlip(i,0);controller.setWheelSideFrictionStiffness(i,0);
  }
  world.step();const chassisCollider=body.collider(0).handle;controller.updateVehicle(1/60,undefined,undefined,c=>c.handle!==chassisCollider);
  return {source,floor,controller,sources:new Map([[floor.handle,source]])};
}
test('two wheels on one real mesh select distinct source face materials and light bytes',()=>{
  const {controller,sources}=setup();
  expect(sampleNativeWheelContact(controller,0,{x:0,y:0,z:1},0,sources)?.surface).toEqual({material:1,light:0x23,faceIndex:0});
  expect(sampleNativeWheelSurface(controller,1,sources)).toEqual({material:28,light:0xA7,faceIndex:1});
  const row=(name:string,group:string)=>[name,group,1,0,'DEFAULT','NONE',...Array(29).fill(0),'NONE'].join(' ');
  const {byId}=indexNativeSurfaceInfo(readSurfaceInfo([row('WHEELBASE','RUBBER'),row('TARMAC','ROAD'),row('SAND_DEEP','SAND')].join('\n')).records);
  const {rows}=readSurfaceAdhesion('a 1\nb 2\nc 3\nd 4\ne 5\nf 6');
  expect([0,1].map(i=>surfaceAdhesiveLimit(rows,byId.get(60)!,byId.get(sampleNativeWheelSurface(controller,i,sources)!.material)!))).toEqual([3,5]);
});
test('real front and back ray hits resolve to the same source triangle',()=>{
  const {source,floor}=setup();
  for(const y of [1,-1]){
    const hit=floor.castRayAndGetNormal(new RAPIER.Ray({x:-1,y,z:0},{x:0,y:-y,z:0}),2,true)!;
    expect(hit.featureId).toBe(y===1?1:3);
    expect(nativeCollisionSurface(source,hit)).toEqual({material:28,light:0xA7,faceIndex:1});
  }
});
test('missing source, stale mesh geometry and invalid feature IDs never guess a material',()=>{
  const {controller,sources,source,floor}=setup();
  expect(sampleNativeWheelSurface(controller,0,new Map())).toBeUndefined();
  floor.setTranslation({x:0,y:-.1,z:0});expect(sampleNativeWheelSurface(controller,0,sources)).toBeUndefined();
  for(const featureId of [undefined,-1,4,.5,NaN])expect(nativeCollisionSurface(source,{featureType:RAPIER.FeatureType.Face,featureId})).toBeUndefined();
  expect(nativeCollisionSurface(source,{featureType:RAPIER.FeatureType.Edge,featureId:0})).toBeUndefined();
  expect(()=>sampleNativeWheelSurface(controller,2,sources)).toThrow(/index/);
});
test('primitive materials do not require triangle metadata and malformed mesh metadata rejects',()=>{
  const {source}=setup();
  expect(nativeCollisionSurface({kind:'box',index:0,surface:{material:9,light:0xBC,flags:0,brightness:0}})).toEqual({material:9,light:0xBC});
  if(source.kind==='mesh')source.mesh.materials=new Uint8Array(1);
  expect(()=>nativeCollisionSurface(source)).toThrow(/metadata/);
});
