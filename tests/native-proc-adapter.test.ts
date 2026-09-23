import type {InstalledCollisionSource} from '../src/simulation/nativeScene';
import {sampleNativeGroundLighting} from '../src/simulation/nativeContactLighting';
import {nativeShadowReceivers} from '../src/simulation/nativeShadowReceivers';
import {beforeAll,test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Matrix4,PerspectiveCamera,Mesh,type Material} from 'three';
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
 const asset={name:'diagnostic',definition:{id:103,drawDistance:50,flags:0},entityKind:'object',model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),collision:col(),textures:[]} as unknown as Awaited<ReturnType<typeof readNativeProcAssets>>[number];
 const sources=new Map<number,InstalledCollisionSource>(),adapter=new NativeProcObjects(world,[asset],sources);
 try{
  const handle=adapter.allocate({name:asset.name,id:103,kind:'object',minimumZ:asset.collision.bounds.min[2]},511);
  const entityMatrix=new Float32Array(new Matrix4().makeTranslation(10,20,3).elements);
  const renderMatrix=new Float32Array(new Matrix4().makeTranslation(10,20,3).multiply(new Matrix4().makeScale(2,2,3)).elements);
  adapter.install(handle,{entityMatrix,renderMatrix,allocatedMatrix:false,scaleApplied:true,xyScale:2,zScale:3,rotation:0,offset:0},{candidate:{lighting:0xab,surface:8}} as AllocatedPlantTriangle,1234);
  world.step();
  expect(adapter.snapshot()).toEqual({entities:1,colliders:3});expect(sources.size).toBe(3);
  expect([...sources.values()].every(record=>record.procedural&&record.entityKind==='object')).toBe(true);
  const player=world.createCollider(RAPIER.ColliderDesc.ball(.2).setTranslation(0,50,0));world.step();
  expect(sampleNativeGroundLighting(world,{x:11.5,y:3.05,z:-20},player,sources)).toMatchObject({material:10,light:0xc5,modelName:'diagnostic',faceIndex:0});
  world.removeCollider(player,false);
  const receivers=nativeShadowReceivers(world,sources,{center:{x:10,y:4,z:-20},side:{x:3,z:0},front:{x:0,z:3},depth:2});
  expect(receivers.candidateCount).toBe(1);expect(receivers.vertexCount).toBeGreaterThan(0);
  const points=receivers.chunks[0].geometry.positions;
  for(let i=0;i<points.length;i+=3){expect(points[i]).toBeGreaterThanOrEqual(8);expect(points[i]).toBeLessThanOrEqual(12);expect(points[i+1]).toBeCloseTo(3,5);}

  const visual=adapter.root.children[0];expect(visual.matrix.elements[0]).toBe(2);expect(visual.matrix.elements[9]).toBeCloseTo(3,6);for(const [i,value] of [10,3,-20].entries())expect(visual.matrix.elements[12+i]).toBeCloseTo(value,6);
  const hit=world.castRay(new RAPIER.Ray({x:10,y:8,z:-20},{x:0,y:-1,z:0}),10,true)!;
  expect(hit.timeOfImpact).toBeCloseTo(3.5,4);expect(hit.collider.shape.type).toBe(RAPIER.ShapeType.Ball);
  expect(visual.userData.nativeProcedural).toMatchObject({slot:511,seed:1234,lighting:0xab,surface:8,kind:'object'});
  const camera=new PerspectiveCamera(60,1,.1,500);
  const viewAt=(distance:number)=>{camera.position.set(10,3,-20+distance);camera.lookAt(10,3,-20);camera.updateMatrixWorld(true);adapter.updateView(camera);};
  viewAt(60);expect(visual.visible).toBe(true);
  const opacities:number[]=[];visual.traverse(node=>{if(node instanceof Mesh)for(const m of Array.isArray(node.material)?node.material:[node.material])opacities.push((m as Material).opacity);});
  expect(opacities.length).toBeGreaterThan(0);expect(opacities.every(alpha=>alpha<=127/255)).toBe(true);expect(Math.max(...opacities)).toBeCloseTo(127/255,6);
  viewAt(70);expect(visual.visible).toBe(false);expect(adapter.snapshot()).toEqual({entities:1,colliders:3});expect(sources.size).toBe(3);
  viewAt(40);expect(visual.visible).toBe(true);
  camera.lookAt(10,3,100);camera.updateMatrixWorld(true);adapter.updateView(camera);expect(visual.visible).toBe(false);
  viewAt(40);expect(visual.visible).toBe(true);

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

test('tree wind replaces only visual at components while paused, exploded and hidden entities retain their pose',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 const asset={name:'tree',definition:{id:103,drawDistance:50,flags:0x2000},entityKind:'object',model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),collision:col(),textures:[]} as unknown as Awaited<ReturnType<typeof readNativeProcAssets>>[number];
 const sources=new Map<number,InstalledCollisionSource>(),adapter=new NativeProcObjects(world,[asset],sources);
 try{
  const handle=adapter.allocate({name:'tree',id:103,kind:'object',minimumZ:asset.collision.bounds.min[2]},511);
  const entityMatrix=new Float32Array(new Matrix4().makeTranslation(10,20,3).elements);
  const renderMatrix=new Float32Array(new Matrix4().makeTranslation(10,20,3).multiply(new Matrix4().makeScale(2,2,3)).elements);
  // Nonzero original at-X/Y proves replacement instead of additive sway.
  renderMatrix[8]=.2;renderMatrix[9]=.3;
  adapter.install(handle,{entityMatrix,renderMatrix,allocatedMatrix:false,scaleApplied:true,xyScale:2,zScale:3,rotation:0,offset:0},{candidate:{lighting:0xab,surface:8}} as AllocatedPlantTriangle,1234);
  world.step();
  const visual=adapter.root.children[0],before=visual.matrix.clone();
  const collisionBefore=[...sources.values()].map(record=>record.matrix!.elements.slice());
  const state={milliseconds:0,wind:1,seed:0,address:0,direction:[1,-1] as const};
  const active={paused:false,exploded:false};
  expect(adapter.updateTreeWind(handle,state,active)).toBe(true);
  const native=new Matrix4().makeRotationX(Math.PI/2).multiply(visual.matrix);
  expect(native.elements[8]).toBeCloseTo(.03,7);expect(native.elements[9]).toBeCloseTo(-.03,7);
  for(let i=0;i<16;i++)if(i!==8&&i!==9)expect(native.elements[i]).toBeCloseTo(renderMatrix[i],7);
  expect(visual.matrix.equals(before)).toBe(false);
  const pose=visual.matrix.clone();
  adapter.updateTreeWind(handle,state,active);expect(visual.matrix.equals(pose)).toBe(true);
  for(const status of [{paused:true,exploded:false},{paused:false,exploded:true}]){
   expect(adapter.updateTreeWind(handle,{...state,milliseconds:1000},status)).toBe(false);
   expect(visual.matrix.equals(pose)).toBe(true);
  }
  visual.visible=false;expect(adapter.updateTreeWind(handle,state,active)).toBe(false);visual.visible=true;
  expect([...sources.values()].map(record=>record.matrix!.elements)).toEqual(collisionBefore);
  const hit=world.castRay(new RAPIER.Ray({x:10,y:8,z:-20},{x:0,y:-1,z:0}),10,true)!;
  expect(hit.timeOfImpact).toBeCloseTo(3.5,4);
  adapter.destroy(handle);expect(()=>adapter.updateTreeWind(handle,state,active)).toThrow('ownership');
 }finally{adapter.dispose();world.free();}
});

test('procedural generic lighting uses entity-kind factors and excludes diffuse light without native normals',()=>{
 const world=new RAPIER.World({x:0,y:0,z:0});
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')));
 for(const geometry of model.geometries)geometry.flags=(geometry.flags|0x20)&~0x10;
 for(const atomic of model.atomics)atomic.pipeline=undefined;
 const assets=(['building','object'] as const).map((kind,id)=>({name:kind,definition:{id,drawDistance:50,flags:0},entityKind:kind,model,collision:col(),textures:[]} as unknown as Awaited<ReturnType<typeof readNativeProcAssets>>[number]));
 const adapter=new NativeProcObjects(world,assets);
 try{
  adapter.setEntityLighting([.2,.4,.6],[.2,.3,.4],.8);
  for(const asset of assets){
   const handle=adapter.allocate({name:asset.name,id:asset.definition.id,kind:asset.entityKind,minimumZ:asset.collision.bounds.min[2]},1);
   handle.visual.root.traverse(node=>{
    if(!(node instanceof Mesh))return;
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
     expect(material.type).toBe('MeshLambertMaterial');
     const shader={uniforms:{},vertexShader:'',fragmentShader:''} as any;material.onBeforeCompile(shader,{} as any);
     const factor=asset.entityKind==='building'?.5:.43;
     expect(shader.uniforms.nativeDiffuse.value).toBe(0);
     expect(shader.uniforms.nativeContactMultiplier.value).toBeCloseTo(factor,6);
     expect(shader.uniforms.nativeAmbientColor.value.x).toBeCloseTo(.2*.8*factor,6);
    }
   });
  }
 }finally{adapter.dispose();world.free();}
});
