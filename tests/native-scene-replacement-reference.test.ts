import {openAsBlob} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {readScene} from '../src/assets/scene';
import {installNativeScene,type InstalledNativeScene} from '../src/simulation/nativeScene';
import {importedSpawn} from '../src/simulation/importedSpawn';

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
  current=installNativeScene(world,scene,before.scene);expect(current.instanceCount).toBe(203);
  const old=current,oldHandles=[...old.sources.keys()];
  current=old.replace(after.scene);expect(current.instanceCount).toBe(427);expect(old.sources.size).toBe(0);
  expect(world.colliders.len()).toBe(current.colliderCount+1);expect(scene.children).toEqual([current.root]);
  for(const handle of oldHandles)expect(world.getCollider(handle)).toBeNull();
  world.step();
  const spawn=importedSpawn(world,after.scene,new Set(current.sources.keys()),player,{x:-1750,z:1450});
  const hit=world.castRay(new RAPIER.Ray({x:spawn.x,y:spawn.y+1,z:spawn.z},{x:0,y:-1,z:0}),2,true)!;
  expect(hit).toBeTruthy();expect(current.sources.has(hit.collider.handle)).toBe(true);
  current=current.replace(before.scene);expect(current.instanceCount).toBe(203);expect(world.colliders.len()).toBe(current.colliderCount+1);
  current.dispose();expect(scene.children).toHaveLength(0);expect(world.colliders.len()).toBe(1);expect(world.bodies.len()).toBe(0);
 }finally{current?.dispose();world.free();}
},30000);
