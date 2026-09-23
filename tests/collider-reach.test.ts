import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {installNativeCollision,colliderReach,forgetColliderReach} from '../src/simulation/nativeCollision';
import {assertInstalledSceneSupport} from '../src/simulation/nativeSceneDestination';
import type {ColModel} from '../src/assets/col';
import type {IplInstance} from '../src/assets/ipl';
beforeAll(async()=>RAPIER.init());
const placed=(x:number,y:number,z:number):IplInstance=>({modelId:1,modelName:'floor',instanceType:0,interior:0,position:[x,y,z],rotation:[0,0,0,1],lodIndex:-1});
/** A flat square of the given half size around the model origin, with COL bounds that enclose it. */
function floor(half:number):ColModel{
 return {name:'floor',id:1,version:3,flags:0,spheres:[],boxes:[],bounds:{min:[-half,-half,-1],max:[half,half,1],center:[0,0,0],radius:half*Math.SQRT2},
  mesh:{positions:new Float32Array([-half,-half,0,half,-half,0,half,half,0,-half,half,0]),indices:new Uint32Array([0,1,2,0,2,3]),materials:new Uint8Array([1,1]),lights:new Uint8Array([0,0])}} as unknown as ColModel;
}
test('support queries skip colliders out of reach but keep far-origin models whose bounds reach the player',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  // A 200-unit road whose origin is 90 units away still carries a player standing near its edge.
  const road=installNativeCollision(world,floor(100),placed(90,0,0));
  const handle=[...road.sources.keys()][0],reach=colliderReach(world,handle)!;
  expect(reach[0]).toBeCloseTo(90);expect(reach[3]).toBeGreaterThanOrEqual(100*Math.SQRT2);
  const center={x:0,y:.95,z:0};
  expect(assertInstalledSceneSupport(world,road.sources.keys(),center,false).y).toBeCloseTo(.05);
  // A small floor 50 units away cannot answer, so it is never queried; alone it supports nothing here.
  const far=installNativeCollision(world,floor(2),placed(50,0,0));
  expect(()=>assertInstalledSceneSupport(world,far.sources.keys(),center,false)).toThrow('does not support');
  // A moved (uprooted) collider has no recorded reach and is always queried.
  forgetColliderReach(world,far.sources.keys());expect(colliderReach(world,[...far.sources.keys()][0])).toBeUndefined();
  road.dispose();expect(colliderReach(world,handle)).toBeUndefined();
 }finally{world.free();}
});
