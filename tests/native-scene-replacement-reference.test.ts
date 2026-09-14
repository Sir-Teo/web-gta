import {openAsBlob,mkdirSync,writeFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {readScene} from '../src/assets/scene';
import {installNativeScene,type InstalledNativeScene} from '../src/simulation/nativeScene';
import {importedSpawn} from '../src/simulation/importedSpawn';
import {nativeSceneDestination,assertNativeSceneSupport,assertInstalledSceneSupport} from '../src/simulation/nativeSceneDestination';

test.skipIf(!process.env.GTA_CONTENT_DIR)('replaces native mountain regions with supported collision and releases both generations',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa;
 const archive=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
 const files:WorldFolderFile[]=[{path:'depot/gta3.img',file:archive as File}];
 for(const kind of ['ide','ipl'])for(const path of manifest.paths[kind]){
  const relative=`${kind}/${path}.${kind}`;
  files.push({path:`depot/${relative}`,file:new File([await readFile(join(depot,relative))],basename(relative))});
 }
 const before=await readScene(await planWorldFolder(files,'mount-chiliad'));
 const after=await readScene(await planWorldFolder(files,'chiliad-east'));
 await RAPIER.init();const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new Scene();let current:InstalledNativeScene|undefined;
 try{
  const player=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.3).setTranslation(100000,100000,100000));
  current=installNativeScene(world,scene,before.scene,{datasetIdentity:'native-depot'});expect(current.instanceCount).toBe(203);
  const old=current,oldHandles=[...old.sources.keys()];
  const expected=nativeSceneDestination(after.scene,{x:-1750,z:1450}),center={...expected,y:expected.y+.9};
  current=old.replace(after.scene,candidate=>{expect(assertInstalledSceneSupport(world,candidate.sources.keys(),center,false)).toEqual(assertNativeSceneSupport(after.scene,center,false));},'native-depot');expect(current.reusedPlacementCount).toBe(48);
  const outcome=(query:()=>unknown)=>{try{return {foot:query()};}catch(error){return {error:(error as Error).message};}};
  for(const dx of [-5,0,5])for(const dz of [-5,0,5])for(const crouched of [false,true]){
   const position={x:center.x+dx,y:center.y-(crouched?.25:0),z:center.z+dz};
   expect(outcome(()=>assertInstalledSceneSupport(world,current!.sources.keys(),position,crouched))).toEqual(outcome(()=>assertNativeSceneSupport(after.scene,position,crouched)));
  }
  if(process.env.GTA_BENCHMARK==='1'){
   const isolated:number[]=[],direct:number[]=[];
   for(let i=-3;i<20;i++){
    let start=performance.now();assertNativeSceneSupport(after.scene,center,false);const a=performance.now()-start;
    start=performance.now();assertInstalledSceneSupport(world,current.sources.keys(),center,false);const b=performance.now()-start;
    if(i>=0){isolated.push(a);direct.push(b);}
   }
   const summarize=(samples:number[])=>{const sorted=[...samples].sort((a,b)=>a-b);return {medianMs:(sorted[9]+sorted[10])/2,p95Ms:sorted[18],samplesMs:samples};};
   const result={measuredAt:new Date().toISOString(),nodeVersion:process.version,platform:process.platform,architecture:process.arch,region:'chiliad-east',placements:current.instanceCount,colliders:current.colliderCount,samples:20,isolated:summarize(isolated),direct:summarize(direct)};
   mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/native-support-query-benchmark.json',JSON.stringify(result,null,2));
   console.info(JSON.stringify({region:result.region,colliders:result.colliders,isolatedMedianMs:result.isolated.medianMs,directMedianMs:result.direct.medianMs}));
  }
  expect(current.instanceCount).toBe(427);expect(old.sources.size).toBe(0);
  expect(world.colliders.len()).toBe(current.colliderCount+1);expect(scene.children).toEqual([current.root]);
  expect(oldHandles.filter(handle=>current!.sources.has(handle))).toHaveLength(current.reusedColliderCount);
  for(const handle of oldHandles)if(!current.sources.has(handle))expect(world.getCollider(handle)).toBeNull();
  world.step();
  const spawn=importedSpawn(world,after.scene,new Set(current.sources.keys()),player,{x:-1750,z:1450});
  const hit=world.castRay(new RAPIER.Ray({x:spawn.x,y:spawn.y+1,z:spawn.z},{x:0,y:-1,z:0}),2,true)!;
  expect(hit).toBeTruthy();expect(current.sources.has(hit.collider.handle)).toBe(true);
  current=current.replace(before.scene,undefined,'native-depot');expect(current.reusedPlacementCount).toBe(48);expect(current.instanceCount).toBe(203);expect(world.colliders.len()).toBe(current.colliderCount+1);
  current.dispose();expect(scene.children).toHaveLength(0);expect(world.colliders.len()).toBe(1);expect(world.bodies.len()).toBe(0);
 }finally{current?.dispose();world.free();}
},30000);
