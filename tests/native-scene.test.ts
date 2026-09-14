import { readFileSync } from 'node:fs';
import { beforeAll, afterEach, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Scene, Group, PerspectiveCamera } from 'three';
import type * as THREE from 'three';
import { readDff } from '../src/assets/dff';
import { readCol } from '../src/assets/col';
import { installNativeScene } from '../src/simulation/nativeScene';
import {nativeSceneDestination,assertNativeSceneSupport,assertInstalledSceneSupport} from '../src/simulation/nativeSceneDestination';
import type { ScenePart } from '../src/assets/scene';
import {readObjectData,indexObjectData} from '../src/assets/objectData';
import {planSceneCollision,isDistanceBigBuilding} from '../src/assets/sceneCollision';
const makePart = (): ScenePart => ({
  model: readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),
  collision: readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],
  name: 'diagnostic_col3', textures: [], dictionaryNames: [], notices: [], collisionSource: 'diagnostic.col',
  placements: [0, 10].map(x => ({ modelId: 103, modelName: 'diagnostic_col3', instanceType: 0, interior: 0, position: [x, 0, 0], rotation: [0, 0, 0, 1], lodIndex: -1 })),
});
let world: RAPIER.World;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => {world?.free();world=undefined!;});
test('object definitions reclassify owned collider metadata without replacing or removing physical collision',()=>{
  world=new RAPIER.World({x:0,y:-9.81,z:0});const installed=installNativeScene(world,new Scene(),[makePart()]);world.step();
  const handles=[...installed.sources.keys()],count=world.colliders.len();
  expect([...installed.sources.values()].every(s=>s.entityKind==='unknown')).toBe(true);
  installed.setObjectData(indexObjectData(readObjectData('diagnostic_col3 99999 20 .99 .1 50 0 1 0 0 0 0 0')));
  expect([...installed.sources.values()].every(s=>s.entityKind==='dummy')).toBe(true);expect([...installed.sources.keys()]).toEqual(handles);expect(world.colliders.len()).toBe(count);
  installed.setObjectData(new Map());expect([...installed.sources.values()].every(s=>s.entityKind==='building')).toBe(true);
  installed.setObjectData();expect([...installed.sources.values()].every(s=>s.entityKind==='unknown')).toBe(true);
  installed.dispose();installed.setObjectData(new Map());expect(installed.sources.size).toBe(0);
});
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
  expect(()=>installed.shadowReceivers({center:{x:0,y:1,z:0},side:{x:1,z:0},front:{x:0,z:1},depth:4})).toThrow('disposed');
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

test('resolved LOD targets need no collision and do not create duplicate physical instances', () => {
  world=new RAPIER.World({x:0,y:-9.81,z:0});const detail=makePart(),lod=makePart();lod.name='lod';lod.placements=lod.placements.slice(0,1);lod.collision=undefined;
  lod.sourceRefs=[{namespace:'static',index:0,format:'text',sourceName:'base.ipl'}];
  detail.sourceRefs=detail.placements.map((p,index)=>{p.lodIndex=0;return {namespace:'primary',index,format:'binary',sourceName:'stream.ipl',lodTarget:{namespace:'static',index:0}};});
  const installed=installNativeScene(world,new Scene(),[lod,detail]);expect(installed.instanceCount).toBe(3);expect(installed.colliderCount).toBe(6);expect(installed.missingCollision).toEqual([]);
  expect([...installed.sources.values()].every(s=>s.modelName===detail.name)).toBe(true);installed.dispose();
  lod.collision=makePart().collision;const withLodCol=installNativeScene(world,new Scene(),[lod,detail]);expect(withLodCol.colliderCount).toBe(6);withLodCol.dispose();
  detail.collision=undefined;expect(()=>installNativeScene(world,new Scene(),[lod,detail])).toThrow('Missing collision');expect(world.colliders.len()).toBe(0);
});
test('collision ownership is per placement and rejects cyclic or duplicate reference identity', () => {
  world=new RAPIER.World({x:0,y:-9.81,z:0});const part=makePart();part.placements[1].lodIndex=0;
  part.sourceRefs=[{namespace:'primary',index:0,format:'text',sourceName:'base.ipl'},{namespace:'primary',index:1,format:'text',sourceName:'base.ipl',lodTarget:{namespace:'primary',index:0}}];
  const installed=installNativeScene(world,new Scene(),[part]);expect(installed.colliderCount).toBe(3);expect([...installed.sources.values()].every(s=>s.placement===part.placements[1])).toBe(true);installed.dispose();
  part.sourceRefs[0].lodTarget={namespace:'primary',index:1};part.placements[0].lodIndex=1;expect(()=>installNativeScene(world,new Scene(),[part])).toThrow('Cyclic');
  part.sourceRefs[0].lodTarget=undefined;part.sourceRefs[1].index=0;expect(()=>installNativeScene(world,new Scene(),[part])).toThrow('Duplicate');expect(world.colliders.len()).toBe(0);
});

test('scene clock updates prelight within the same hour independently from timed visibility', () => {
  world=new RAPIER.World({x:0,y:-9.81,z:0}); const part=makePart(), installed=installNativeScene(world,new Scene(),[part]);
  const source=part.model.geometries[0], day=source.colors![0]/255, night=source.nightColors![0]/255;
  let color:any; installed.root.traverse(o=>{if(!color && (o as any).isMesh)color=(o as any).geometry.getAttribute('color');});
  installed.setTime(360);expect(color.array[0]).toBeCloseTo(night);
  installed.setTime(390);expect(color.array[0]).toBeCloseTo((day+night)/2);
  const version=color.version; installed.setTime(390);expect(color.version).toBe(version);
  installed.setTime(390.5);expect(color.version).toBeGreaterThan(version);expect(color.array[0]).toBeCloseTo(day+(night-day)*29.5/60);
  installed.setTime(420);expect(color.array[0]).toBeCloseTo(day);
  installed.setTime(1230);expect(color.array[0]).toBeCloseTo((day+night)/2);
  installed.setTime(1260);expect(color.array[0]).toBeCloseTo(night);
  expect(source.colors![0]/255).toBe(day);expect(source.nightColors![0]/255).toBe(night);
  installed.dispose();
});

test('imported building ambient override updates within the same hour and restores authored input',async()=>{
  const THREE=await import('three');const {sampleTimecycle}=await import('../src/world/timecycle');
  world=new RAPIER.World({x:0,y:-9.81,z:0});const part=makePart();part.model=readDff(new Uint8Array(readFileSync('tests/fixtures/walk-floor-building.dff')));
  const installed=installNativeScene(world,new Scene(),[part]);let material:THREE.Material|undefined;
  installed.root.traverse(o=>{if(o instanceof THREE.Mesh)material=(Array.isArray(o.material)?o.material[0]:o.material);});
  const shader={uniforms:{},vertexShader:'#include <color_vertex>',fragmentShader:'#include <color_fragment>\n#include <alphatest_fragment>'} as unknown as THREE.WebGLProgramParametersWithUniforms;
  material!.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  installed.setTime(720,[.1,.2,.3]);expect(shader.uniforms.buildingAmbient.value.toArray()).toEqual([.1,.2,.3]);
  installed.setTime(720,[.3,.2,.1]);expect(shader.uniforms.buildingAmbient.value.toArray()).toEqual([.3,.2,.1]);
  const input:[number,number,number]=[.5,.25,.125];installed.setTime(720,input,.6);
  expect(shader.uniforms.buildingAmbient.value.toArray()).toEqual([.3,.15,.075]);expect(input).toEqual([.5,.25,.125]);
  expect(()=>installed.setTime(720,input,NaN)).toThrow(/multiplier/);expect(shader.uniforms.buildingAmbient.value.toArray()).toEqual([.3,.15,.075]);
  installed.setTime(720);expect(shader.uniforms.buildingAmbient.value.toArray()).toEqual(sampleTimecycle(720).ambient);installed.dispose();
});

test('installed scene retains its selected area and rejects mixed or invalid areas before allocation',()=>{
  world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),part=makePart();
  part.placements.forEach(p=>p.interior=5);
  const installed=installNativeScene(world,scene,[part]);expect(installed.area).toBe(5);installed.dispose();
  for(const invalid of [0,-1,256,NaN,1.5]){
    part.placements[1].interior=invalid;expect(()=>installNativeScene(world,scene,[part])).toThrow(/area/);
    expect(scene.children).toHaveLength(0);expect(world.colliders.len()).toBe(0);expect(world.bodies.len()).toBe(0);
  }
});

test('oversized imported model sets fail before installing any visuals or colliders',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),part=makePart();
 expect(()=>installNativeScene(world,scene,Array.from({length:513},()=>part))).toThrow('1–512 model types');
 expect(scene.children).toHaveLength(0);expect(world.colliders.len()).toBe(0);
});

test('region replacement swaps owned collision and preserves clock, classifications and visibility',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),unrelated=new Group();scene.add(unrelated);
 const foreign=world.createCollider(RAPIER.ColliderDesc.ball(1).setTranslation(-100,0,0));
 const old=installNativeScene(world,scene,[makePart()]);
 old.setObjectData(indexObjectData(readObjectData('diagnostic_col3 99999 20 .99 .1 50 0 1 0 0 0 0 0')));
 old.setTime(1200,[.2,.3,.4],.8);
 const camera=new PerspectiveCamera(60,1,.1,1000);camera.position.set(30,10,20);camera.lookAt(30,0,0);camera.updateMatrixWorld(true);old.updateView(camera);
 const part=makePart();part.placements.forEach(p=>p.position[0]+=30);
 part.definition={id:103,model:part.name,dictionary:'x',section:'tobj',timeOn:6,timeOff:18};
 const next=old.replace([part]);
 expect(scene.children).toEqual([unrelated,next.root]);expect(old.sources.size).toBe(0);expect(old.visibleInstanceCount).toBe(0);
 expect(next.root.children[0].visible).toBe(false);expect(next.sources.size).toBe(6);
 expect([...next.sources.values()].every(s=>s.entityKind==='dummy')).toBe(true);
 expect(world.colliders.len()).toBe(7);expect(world.getCollider(foreign.handle)).toBeTruthy();
 world.step();
 expect(world.castRay(new RAPIER.Ray({x:0,y:5,z:0},{x:0,y:-1,z:0}),10,true)).toBeNull();
 const hit=world.castRay(new RAPIER.Ray({x:30,y:5,z:0},{x:0,y:-1,z:0}),10,true)!;
 expect(next.sources.has(hit.collider.handle)).toBe(true);
 expect(()=>old.replace([makePart()])).toThrow('disposed');old.dispose();expect(world.colliders.len()).toBe(7);
 next.setTime(720);expect(next.root.children[0].visible).toBe(true);next.dispose();expect(world.colliders.len()).toBe(1);
});

test('late replacement failure keeps original terrain, metadata and resources usable',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),old=installNativeScene(world,scene,[makePart()]);
 const handles=[...old.sources.keys()],invalid=makePart();invalid.placements[0].position[0]=1e7;
 expect(()=>old.replace([makePart(),invalid])).toThrow('bounds');
 expect(scene.children).toEqual([old.root]);expect([...old.sources.keys()]).toEqual(handles);expect(world.colliders.len()).toBe(6);
 world.step();const hit=world.castRay(new RAPIER.Ray({x:10,y:5,z:0},{x:0,y:-1,z:0}),10,true)!;
 expect(old.sources.has(hit.collider.handle)).toBe(true);expect(hit.timeOfImpact).toBeCloseTo(3.5,4);
 const next=old.replace([makePart()]);expect(next.instanceCount).toBe(2);expect(world.colliders.len()).toBe(6);next.dispose();
 expect(scene.children).toHaveLength(0);expect(world.colliders.len()).toBe(0);expect(world.bodies.len()).toBe(0);
});

test('destination validation uses isolated collision and rejects unsupported terrain before retirement',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),old=installNativeScene(world,scene,[makePart()]);
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,20,0));world.createCollider(RAPIER.ColliderDesc.ball(.2),body);
 const before=body.translation(),handles=[...old.sources.keys()];
 const unsupported=makePart();unsupported.collision={...unsupported.collision!,boxes:[],mesh:{...unsupported.collision!.mesh,indices:new Uint32Array()}};
 expect(()=>old.replace([unsupported],()=>nativeSceneDestination([unsupported]))).toThrow('No clear supported spawn');
 expect(scene.children).toEqual([old.root]);expect([...old.sources.keys()]).toEqual(handles);expect(body.translation()).toEqual(before);expect(world.colliders.len()).toBe(7);
 let spawn:ReturnType<typeof nativeSceneDestination>|undefined;
 const part=makePart();part.placements.forEach(p=>p.position[0]+=30);
 const next=old.replace([part],()=>{spawn=nativeSceneDestination([part],{x:30,z:0});});
 expect(spawn).toBeDefined();expect(spawn!.x).toBeGreaterThan(20);expect(body.translation()).toEqual(before);next.dispose();
});

test('retained-position checks use the actual standing or crouched capsule and never seek another floor',()=>{
 const part=makePart();part.placements=part.placements.slice(0,1);
 const surface={material:0,flags:0,brightness:0,light:0};
 part.collision={...part.collision!,spheres:[],boxes:[{min:[-20,-20,-1],max:[20,20,0],surface}],mesh:{positions:new Float32Array(),indices:new Uint32Array(),materials:new Uint8Array(),lights:new Uint8Array()}};
 const standing={x:0,y:.925,z:0};
 expect(assertNativeSceneSupport([part],standing,false).y).toBeCloseTo(.025);
 expect(standing).toEqual({x:0,y:.925,z:0});
 expect(()=>assertNativeSceneSupport([part],{x:100,y:.925,z:0},false)).toThrow('does not support');
 expect(()=>assertNativeSceneSupport([part],{x:0,y:5,z:0},false)).toThrow('does not support');
 expect(()=>assertNativeSceneSupport([part],{x:NaN,y:1,z:0},false)).toThrow('Invalid');
 part.collision.boxes.push({min:[-20,-20,1.5],max:[20,20,2],surface});
 expect(()=>assertNativeSceneSupport([part],standing,false)).toThrow('obstructs');
 expect(assertNativeSceneSupport([part],{x:0,y:.675,z:0},true).y).toBeCloseTo(.025);
});

const referencedPart=()=>{
 const part=makePart();part.sourceRefs=part.placements.map((_,index)=>({namespace:'primary',index,format:'text',sourceName:'base.ipl'}));return part;
};
test('unchanged source placements transfer collision ownership without duplicating bodies',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),old=installNativeScene(world,scene,[referencedPart()],{datasetIdentity:'fixture'}),handles=[...old.sources.keys()];
 const part=referencedPart();part.sourceRefs!.forEach(ref=>ref.namespace='district:1:primary');
 part.placements.push({...part.placements[0],position:[20,0,0]});part.sourceRefs!.push({namespace:'district:1:primary',index:2,format:'text',sourceName:'base.ipl'});
 const next=old.replace([part],candidate=>{expect(candidate.reusedPlacementCount).toBe(2);expect(candidate.reusedColliderCount).toBe(6);expect(world.colliders.len()).toBe(9);},'fixture');
 expect(world.bodies.len()).toBe(3);expect(world.colliders.len()).toBe(9);expect(old.sources.size).toBe(0);
 for(const handle of handles){expect(next.sources.has(handle)).toBe(true);expect(world.getCollider(handle)).toBeTruthy();}
 old.dispose();expect(world.colliders.len()).toBe(9);next.dispose();expect(world.colliders.len()).toBe(0);expect(world.bodies.len()).toBe(0);
});

test('failed validation keeps borrowed bodies with the old owner, including a disposed candidate',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),old=installNativeScene(world,scene,[referencedPart()],{datasetIdentity:'fixture'}),handles=[...old.sources.keys()];
 for(const disposeCandidate of [false,true]){
  const part=referencedPart();part.placements.push({...part.placements[0],position:[20,0,0]});part.sourceRefs!.push({namespace:'primary',index:2,format:'text',sourceName:'base.ipl'});
  expect(()=>old.replace([part],candidate=>{expect(candidate.reusedColliderCount).toBe(6);if(disposeCandidate)candidate.dispose();else throw new Error('Unsupported destination');},'fixture')).toThrow(disposeCandidate?'disposed during validation':'Unsupported destination');
  expect(scene.children).toEqual([old.root]);expect([...old.sources.keys()]).toEqual(handles);expect(world.colliders.len()).toBe(6);
  for(const handle of handles)expect(world.getCollider(handle)).toBeTruthy();
 }
 old.dispose();expect(world.bodies.len()).toBe(0);
});

test('dataset changes, absent identity and changed transforms prevent collision reuse',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene();
 for(const identity of ['another-fixture',undefined]){
  const old=installNativeScene(world,scene,[referencedPart()],{datasetIdentity:'fixture'}),handles=[...old.sources.keys()];
  const next=old.replace([referencedPart()],undefined,identity);expect(next.reusedColliderCount).toBe(0);for(const handle of handles)expect(world.getCollider(handle)).toBeNull();next.dispose();
 }
 const old=installNativeScene(world,scene,[referencedPart()],{datasetIdentity:'fixture'}),part=referencedPart();part.placements[0].position[0]=5;
 const next=old.replace([part],undefined,'fixture');expect(next.reusedPlacementCount).toBe(1);expect(next.reusedColliderCount).toBe(3);expect(world.colliders.len()).toBe(6);next.dispose();
});

test('new LOD children retire a former physical target instead of retaining duplicate collision',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),target=referencedPart();target.placements=target.placements.slice(0,1);target.sourceRefs=target.sourceRefs!.slice(0,1);
 const old=installNativeScene(world,scene,[target],{datasetIdentity:'fixture'}),handles=[...old.sources.keys()];
 const child=referencedPart();child.placements.forEach(p=>p.lodIndex=0);child.sourceRefs!.forEach(ref=>{ref.namespace='stream:1';ref.sourceName='stream.ipl';ref.lodTarget={namespace:'primary',index:0};});
 const next=old.replace([target,child],undefined,'fixture');expect(next.reusedColliderCount).toBe(0);expect(next.colliderCount).toBe(6);expect(world.colliders.len()).toBe(6);for(const handle of handles)expect(world.getCollider(handle)).toBeNull();next.dispose();
});

test('native draw-distance classification keeps original visuals and retires collision during replacement',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),part=referencedPart();
 part.definition={id:103,model:part.name,dictionary:'fixture',section:'objs',drawDistance:300};
 const old=installNativeScene(world,scene,[part],{datasetIdentity:'fixture'}),handles=[...old.sources.keys()];
 expect(old.colliderCount).toBe(6);
 const far={...part,definition:{...part.definition,drawDistance:400}};
 const next=old.replace([far],undefined,'fixture');
 expect(next.instanceCount).toBe(2);expect(next.colliderCount).toBe(0);expect(next.reusedColliderCount).toBe(0);
 expect(scene.children).toEqual([next.root]);expect(world.colliders.len()).toBe(0);
 for(const handle of handles)expect(world.getCollider(handle)).toBeNull();
 next.dispose();
 // A missing COL does not block an unlinked native big building, regardless of name.
 const visualOnly={...far,collision:undefined};
 expect(planSceneCollision([visualOnly]).missing).toEqual([]);
 const installed=installNativeScene(world,scene,[visualOnly]);expect(installed.instanceCount).toBe(2);installed.dispose();
 expect(()=>installNativeScene(world,scene,[{...visualOnly,definition:part.definition}])).toThrow('Missing collision');
});

test('big-building distance uses the strict native float threshold, never a model-name heuristic',()=>{
 expect(isDistanceBigBuilding(300)).toBe(false);expect(isDistanceBigBuilding(300.000001)).toBe(false);
 expect(isDistanceBigBuilding(300.0001)).toBe(true);expect(isDistanceBigBuilding(undefined)).toBe(false);
 const part=makePart();part.name='lod_unlinked';part.collision=undefined;
 expect(planSceneCollision([part]).missing).toEqual(['lod_unlinked']);
});

test('candidate support queries see unstepped colliders, ignore retiring terrain and do not advance the live body',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),surface={material:0,flags:0,brightness:0,light:0};
 const floor=makePart();floor.placements=floor.placements.slice(0,1);floor.placements[0].position=[30,0,0];
 floor.collision={...floor.collision!,spheres:[],boxes:[{min:[-20,-20,-1],max:[20,20,0],surface}],mesh:{positions:new Float32Array(),indices:new Uint32Array(),materials:new Uint8Array(),lights:new Uint8Array()}};
 const ceiling={...floor,collision:{...floor.collision,boxes:[{min:[-20,-20,1.5] as [number,number,number],max:[20,20,2] as [number,number,number],surface}]}};
 const old=installNativeScene(world,scene,[ceiling]);
 const moving=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(100,20,0));world.createCollider(RAPIER.ColliderDesc.ball(.2),moving);world.step();
 const position=moving.translation(),velocity=moving.linvel(),center={x:30,y:.925,z:0};
 expect(world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3))).toBeTruthy();
 const next=old.replace([floor],candidate=>{
  expect(world.castRay(new RAPIER.Ray({x:30,y:.225,z:0},{x:0,y:-1,z:0}),.4,true)).toBeNull();
  expect(assertInstalledSceneSupport(world,candidate.sources.keys(),center,false).y).toBeCloseTo(.025);
  expect(moving.translation()).toEqual(position);expect(moving.linvel()).toEqual(velocity);
 });
 expect(world.colliders.len()).toBe(2);next.dispose();expect(world.colliders.len()).toBe(1);
});

test('direct candidate clearance matches the isolated oracle for low ceilings and disabled collision',()=>{
 world=new RAPIER.World({x:0,y:-9.81,z:0});const scene=new Scene(),part=makePart(),surface={material:0,flags:0,brightness:0,light:0};
 part.placements=part.placements.slice(0,1);part.collision={...part.collision!,spheres:[],boxes:[{min:[-20,-20,-1],max:[20,20,0],surface},{min:[-20,-20,1.5],max:[20,20,2],surface}],mesh:{positions:new Float32Array(),indices:new Uint32Array(),materials:new Uint8Array(),lights:new Uint8Array()}};
 const installed=installNativeScene(world,scene,[part]);
 for(const crouched of [false,true]){
  const center={x:0,y:crouched?.675:.925,z:0};
  if(crouched)expect(assertInstalledSceneSupport(world,installed.sources.keys(),center,true)).toEqual(assertNativeSceneSupport([part],center,true));
  else{expect(()=>assertInstalledSceneSupport(world,installed.sources.keys(),center,false)).toThrow('obstructs');expect(()=>assertNativeSceneSupport([part],center,false)).toThrow('obstructs');}
 }
 for(const handle of installed.sources.keys())world.getCollider(handle).setEnabled(false);
 expect(()=>assertInstalledSceneSupport(world,installed.sources.keys(),{x:0,y:.675,z:0},true)).toThrow('does not support');
 const handles=[...installed.sources.keys()];installed.dispose();expect(()=>assertInstalledSceneSupport(world,handles,{x:0,y:.675,z:0},true)).toThrow('no longer available');
});
