import type {InstalledCollisionSource} from '../src/simulation/nativeScene';
import {sampleNativeGroundLighting} from '../src/simulation/nativeContactLighting';
import {nativeShadowReceivers} from '../src/simulation/nativeShadowReceivers';
import {beforeAll,test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Matrix4} from 'three';
import {readCol} from '../src/assets/col';
import {readDff} from '../src/assets/dff';
import {NativeProcObjects} from '../src/render/NativeProcObjects';
import {installNativeCollisionMatrix} from '../src/simulation/nativeCollision';
import type {readNativeProcAssets} from '../src/assets/nativeProcAssets';
import type {AllocatedPlantTriangle} from '../src/world/NativePlantPool';
const col=()=>readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
beforeAll(async()=>{await RAPIER.init();});
test('procedural visual scale leaves native collision radii and contact positions unchanged',()=>{
 const world=new RAPIER.World({x:0,y:-9.81,z:0});
 const asset={name:'diagnostic',definition:{id:103},entityKind:'object',model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),collision:col(),textures:[]} as unknown as Awaited<ReturnType<typeof readNativeProcAssets>>[number];
 const sources=new Map<number,InstalledCollisionSource>(),adapter=new NativeProcObjects(world,[asset],sources);
 try{
  const handle=adapter.allocate({name:asset.name,id:103,kind:'object',minimumZ:asset.collision.bounds.min[2]},511);
  const entityMatrix=new Float32Array(new Matrix4().makeTranslation(10,20,3).elements);
  const renderMatrix=new Float32Array(new Matrix4().makeTranslation(10,20,3).multiply(new Matrix4().makeScale(2,2,3)).elements);
  adapter.install(handle,{entityMatrix,renderMatrix,allocatedMatrix:false,scaleApplied:true,xyScale:2,zScale:3,rotation:0,offset:0},{candidate:{lighting:0xab,surface:8}} as AllocatedPlantTriangle);
  world.step();
  expect(adapter.snapshot()).toEqual({entities:1,colliders:3});expect(sources.size).toBe(3);
  expect([...sources.values()].every(record=>record.procedural&&record.entityKind==='object')).toBe(true);
  const player=world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(0,50,0));world.step();
  expect(sampleNativeGroundLighting(world,{x:11.5,y:3.05,z:-20},player,sources)).toEqual({material:10,light:0xc5,modelName:'diagnostic',faceIndex:0});
  world.removeCollider(player,false);
  const receivers=nativeShadowReceivers(world,sources,{center:{x:10,y:4,z:-20},side:{x:3,z:0},front:{x:0,z:3},depth:2});
  expect(receivers.candidateCount).toBe(1);expect(receivers.vertexCount).toBeGreaterThan(0);
  const points=receivers.chunks[0].geometry.positions;
  for(let i=0;i<points.length;i+=3){expect(points[i]).toBeGreaterThanOrEqual(8);expect(points[i]).toBeLessThanOrEqual(12);expect(points[i+1]).toBeCloseTo(3,5);}

  const visual=adapter.root.children[0];expect(visual.matrix.elements[0]).toBe(2);expect(visual.matrix.elements[9]).toBeCloseTo(3,6);for(const [i,value] of [10,3,-20].entries())expect(visual.matrix.elements[12+i]).toBeCloseTo(value,6);
  const hit=world.castRay(new RAPIER.Ray({x:10,y:8,z:-20},{x:0,y:-1,z:0}),10,true)!;
  expect(hit.timeOfImpact).toBeCloseTo(3.5,4);expect(hit.collider.shape.type).toBe(RAPIER.ShapeType.Ball);
  expect(visual.userData.nativeProcedural).toMatchObject({slot:511,lighting:0xab,surface:8,kind:'object'});
  adapter.destroy(handle);adapter.destroy(handle);expect(sources.size).toBe(0);expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);expect(adapter.root.children).toHaveLength(0);
 }finally{adapter.dispose();world.free();}
});
test('collision matrix validation rejects scale, shear and reflection before allocating a body',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 try{
  const shear=new Matrix4();shear.elements[4]=.25;
  for(const matrix of [new Matrix4().makeScale(2,1,1),new Matrix4().makeScale(-1,1,1),shear])expect(()=>installNativeCollisionMatrix(world,col(),matrix)).toThrow('rigid transform');
  expect(world.bodies.len()).toBe(0);expect(world.colliders.len()).toBe(0);
 }finally{world.free();}
});
