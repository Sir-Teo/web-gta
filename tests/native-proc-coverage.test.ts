import RAPIER from '@dimforge/rapier3d-compat';
import {NativeProcObjects} from '../src/render/NativeProcObjects';
import {NativeProcPlacementManager} from '../src/world/NativeProcPlacementManager';
import {NativePlantPool} from '../src/world/NativePlantPool';
import {NativeProcObjectPool} from '../src/world/NativeProcObjectPool';
import {distributeNativeProcRandom} from '../src/world/nativeProcDistribution';
import {WindowsCrtRandom} from '../src/core/WindowsCrtRandom';
import {nativeProcTransform} from '../src/world/nativeProcTransform';
import {readNativeProcAssets} from '../src/assets/nativeProcAssets';
import {readSceneCollisionSources} from '../src/assets/sceneCollisionSources';
import {openAsBlob} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {expect,test} from 'vitest';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readCol} from '../src/assets/col';
import {readSurfaceInfo} from '../src/assets/surfaceInfo';
import {indexNativeSurfaceInfo,NATIVE_SURFACE_NAMES} from '../src/assets/surfaceIds';
import {nativePlantCollisionCandidates} from '../src/world/nativePlantCollision';
import {initializeNativePlants} from '../src/world/nativeVegetation';
import {nativeProcTriangle} from '../src/world/nativeProcTriangle';
import {readPlants,readProcObjects} from '../src/assets/vegetation';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {readScene} from '../src/assets/scene';
import {nativeScenePlantEntities} from '../src/world/nativeScenePlants';
import {readObjectData,indexObjectData} from '../src/assets/objectData';
import {prepareNativeProcRules} from '../src/world/nativeProcRules';

test.skipIf(!process.env.GTA_CONTENT_DIR)('archive collision inventory locates surfaces with native procedural rules',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,archive=await openAsBlob(join(depot,'gta3.img'));
 const entries=(await readImgIndex(archive)).filter(entry=>entry.name.toLowerCase().endsWith('.col'));
 const info=indexNativeSurfaceInfo(readSurfaceInfo(await readFile(join(depot,'surfinfo.dat'),'utf8')).records).byId;
 const rules=prepareNativeProcRules(readProcObjects(await readFile(join(depot,'procobj.dat'),'utf8')));
 const models=[];let totalModels=0;
 for(const entry of entries)for(const model of readCol(await readImgEntry(archive,entry))){
  totalModels++;
  const surfaces=new Map<number,number>();
  for(const id of model.mesh.materials)if(info.get(id)?.values.procObj&&rules.some(rule=>rule.surface===id))surfaces.set(id,(surfaces.get(id)??0)+1);
  if(surfaces.size)models.push({archive:entry.name,model:model.name,surfaces:[...surfaces].map(([id,triangles])=>({id,name:NATIVE_SURFACE_NAMES[id],triangles,rules:rules.filter(rule=>rule.surface===id).map(rule=>rule.modelName)}))});
 }
 const result={collections:entries.length,totalModels,matchingModels:models.length,matchingTriangles:models.reduce((n,m)=>n+m.surfaces.reduce((s,v)=>s+v.triangles,0),0),models};
 await writeFile('/tmp/web-gta-procedural-coverage.json',JSON.stringify(result,null,2));
 expect(entries).toHaveLength(216);expect(totalModels).toBe(8255);expect(models).toHaveLength(446);expect(result.matchingTriangles).toBe(40529);
},30000);

test.skipIf(!process.env.GTA_CONTENT_DIR)('Verdant Meadows resolves procedural surfaces on native building placements',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa;
 const archive=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
 const files:WorldFolderFile[]=[{path:'depot/gta3.img',file:archive as File}];
 for(const kind of ['ide','ipl'])for(const path of manifest.paths[kind]){
  const relative=`${kind}/${path}.${kind}`;files.push({path:`depot/${relative}`,file:new File([await readFile(join(depot,relative))],basename(relative))});
 }
 const request=await planWorldFolder(files,'verdant-meadows'),loaded=await readScene(request);
 const info=indexNativeSurfaceInfo(readSurfaceInfo(await readFile(join(depot,'surfinfo.dat'),'utf8')).records).byId;
 const objects=indexObjectData(readObjectData(await readFile(join(depot,'object.dat'),'utf8')));
 const rules=prepareNativeProcRules(readProcObjects(await readFile(join(depot,'procobj.dat'),'utf8')));
 const entities=nativeScenePlantEntities(loaded.scene,info,objects,0),matches=[];
 for(const entity of entities){
  const surfaces=new Map<number,number>();
  for(const id of entity.collision.mesh.materials)if(info.get(id)?.values.procObj&&rules.some(rule=>rule.surface===id))surfaces.set(id,(surfaces.get(id)??0)+1);
  if(surfaces.size)matches.push({identity:entity.identity,model:entity.collision.name,position:entity.matrix.elements.slice(12,15),surfaces:[...surfaces].map(([id,triangles])=>({id,name:NATIVE_SURFACE_NAMES[id],triangles,models:rules.filter(rule=>rule.surface===id).map(rule=>rule.modelName)}))});
 }
 const modelNames=[...new Set(matches.flatMap(match=>match.surfaces.flatMap(surface=>surface.models)))];
 const collisionSources=await readSceneCollisionSources({file:request.file,allArchiveCollisions:true},await readImgIndex(request.file));
 const assetSource={file:request.file,associations:request.associations,parents:request.parents,collisions:collisionSources.models!,objects};
 const assets=await readNativeProcAssets(modelNames,assetSource);
 await writeFile('/tmp/web-gta-verdant-procedural-assets.json',JSON.stringify(assets.map(asset=>({name:asset.name,id:asset.definition.id,kind:asset.entityKind,dictionaries:asset.dictionaryNames,textures:asset.textures.length,collisionMinimum:asset.collision.bounds.min,triangles:asset.model.geometries.reduce((n,g)=>n+g.indices.length/3,0),notices:asset.notices})),null,2));
 expect(assets).toHaveLength(8);
 expect(assets.filter(asset=>asset.entityKind==='object').map(asset=>asset.name).sort()).toEqual(['sand_josh1','sand_josh2','sjmcacti2']);
 expect(assets.every(asset=>asset.notices.length===0)).toBe(true);
 expect(await readNativeProcAssets([],assetSource)).toEqual([]);
 expect(await readNativeProcAssets(['SAND_JOSH1','sand_josh1'],assetSource)).toHaveLength(1);
 await expect(readNativeProcAssets(['sand_josh1'],{...assetSource,collisions:[]})).rejects.toThrow('collision bounds');
 await expect(readNativeProcAssets(['sand_josh1'],{...assetSource,associations:[]})).rejects.toThrow('definition');
 const definition=assets.find(asset=>asset.name==='sand_josh1')!.definition;
 await expect(readNativeProcAssets(['sand_josh1'],{...assetSource,associations:[...assetSource.associations,{...definition,id:999}]})).rejects.toThrow('Ambiguous');
 await expect(readNativeProcAssets(['../sand_josh1'],assetSource)).rejects.toThrow('selection');

 const camera=[400,2500,20] as const,plants=initializeNativePlants(readPlants(await readFile(join(depot,'plants.dat'),'utf8')));
 const candidates=entities.flatMap(entity=>[...nativePlantCollisionCandidates(entity.collision,entity.matrix,camera,info,plants)]);
 const geometry=candidates.filter(candidate=>candidate.createsObjects).flatMap(candidate=>rules.filter(rule=>rule.surface===candidate.surface).map(rule=>({vertices:candidate.triangle.vertices,rule,model:rule.modelName,triangle:nativeProcTriangle(candidate.triangle.vertices,rule,camera)})));
 const eligible=geometry.filter(row=>row.triangle.eligible&&row.triangle.density>0);
 const transforms=eligible.map(row=>{
  const asset=assets.find(asset=>asset.name===row.model)!;
  const transform=nativeProcTransform(row.rule,row.triangle.point(.5,.5),row.triangle.normal,asset.collision.bounds.min[2],asset.entityKind,[.25,.75,.5,.5]);
  expect(transform.entityMatrix.every(Number.isFinite)&&transform.renderMatrix.every(Number.isFinite)).toBe(true);
  if(asset.entityKind==='building')expect(transform.scaleApplied).toBe(false);
  return {model:asset.name,kind:asset.entityKind,aligned:transform.allocatedMatrix,scaled:transform.scaleApplied,entityMatrix:[...transform.entityMatrix],renderMatrix:[...transform.renderMatrix]};
 });
 const random=new WindowsCrtRandom(1),distribution=[];
 let destroyed=0;const pool=new NativeProcObjectPool(rules.map(rule=>rule.surface),{temporaryObjects:0},()=>{destroyed++;});
 for(const row of geometry.filter(row=>row.rule.useGrid===0)){
  const asset=assets.find(asset=>asset.name===row.model)!;
  const placements:unknown[]=[];
  const result=distributeNativeProcRandom(row.vertices,row.rule,asset.definition.id,camera,random,(position,normal,rng)=>{
   return pool.allocate(rules.indexOf(row.rule),row.vertices,asset.entityKind,row.rule.align&&normal[2]<Math.fround(.95),()=>{
    rng.next(); // CEntity constructor seed, before transform draws.
    const transform=nativeProcTransform(row.rule,position,normal,asset.collision.bounds.min[2],asset.entityKind,[rng.nextUnit(),rng.nextUnit(),rng.nextUnit(),rng.nextUnit()]);
    expect(transform.renderMatrix.every(Number.isFinite)).toBe(true);placements.push([...transform.renderMatrix]);return transform;
   });
  });
  distribution.push({model:asset.name,...result,placements});
 }
 await writeFile('/tmp/web-gta-verdant-procedural-distribution.json',JSON.stringify({assumption:'Shared procedural pool, zero external temporary objects, successful entity constructors; no frame scheduling or grid rules',pool:pool.snapshot(),pairs:distribution.length,attempted:distribution.reduce((n,r)=>n+r.attempted,0),distribution},null,2));
 expect(distribution).toHaveLength(280);
 expect(distribution.reduce((n,r)=>n+r.attempted,0)).toBe(140);
 expect(pool.snapshot().active).toBe(distribution.reduce((n,r)=>n+r.added,0));
 for(const candidate of candidates)pool.removeTriangle(candidate.triangle.vertices,candidate.surface);
 expect(destroyed).toBe(140);expect(pool.snapshot()).toEqual({free:512,active:0,detached:0,matrices:0,temporaryObjects:0});
 const selectedRules=rules.filter(rule=>candidates.some(candidate=>candidate.surface===rule.surface));
 await RAPIER.init();const proceduralWorld=new RAPIER.World({x:0,y:-9.81,z:0}),adapter=new NativeProcObjects(proceduralWorld,assets);
 let installed=0,released=0;
 const manager=new NativeProcPlacementManager(selectedRules,assets.map(asset=>({name:asset.name,id:asset.definition.id,minimumZ:asset.collision.bounds.min[2],kind:asset.entityKind})),new WindowsCrtRandom(1),{temporaryObjects:0},()=>camera,{
  allocate:(model,slot)=>adapter.allocate(model,slot),install:(value,transform,triangle,seed)=>{adapter.install(value,transform,triangle,seed);installed++;expect(transform.renderMatrix.every(Number.isFinite)).toBe(true);},destroy:value=>{adapter.destroy(value);released++;},
 });
 const terrainPool=new NativePlantPool(manager);
 for(const entity of entities)terrainPool.updateEntity(entity.identity,camera,nativePlantCollisionCandidates(entity.collision,entity.matrix,camera,info,plants));
 proceduralWorld.step();
 const lifecycle={triangles:terrainPool.size,installed,pool:manager.snapshot(),adapter:adapter.snapshot()};
 expect(adapter.root.children).toHaveLength(140);expect(proceduralWorld.bodies.len()).toBe(140);expect(adapter.snapshot().colliders).toBeGreaterThan(0);
 adapter.setNight(1);adapter.setAmbient([.1,.2,.3]);
 expect(lifecycle).toMatchObject({triangles:63,installed:140,pool:{active:140,matrices:23,temporaryObjects:12}});
 for(const entity of entities)terrainPool.updateEntity(entity.identity,camera,nativePlantCollisionCandidates(entity.collision,entity.matrix,camera,info,plants));
 expect(installed).toBe(lifecycle.installed);
 for(const entity of entities)terrainPool.releaseEntity(entity.identity);
 expect(released).toBe(installed);expect(terrainPool.size).toBe(0);expect(manager.snapshot()).toEqual({free:512,active:0,detached:0,matrices:0,temporaryObjects:0});
 expect(adapter.snapshot()).toEqual({entities:0,colliders:0});expect(proceduralWorld.bodies.len()).toBe(0);expect(proceduralWorld.colliders.len()).toBe(0);adapter.dispose();proceduralWorld.free();
 await writeFile('/tmp/web-gta-verdant-procedural-lifecycle.json',JSON.stringify({...lifecycle,released,after:manager.snapshot()},null,2));

 await writeFile('/tmp/web-gta-verdant-procedural-transforms.json',JSON.stringify(transforms,null,2));
 expect(transforms).toHaveLength(160);
 await writeFile('/tmp/web-gta-verdant-procedural-coverage.json',JSON.stringify({entities:entities.length,matches,camera,candidateTriangles:candidates.length,ruleTrianglePairs:geometry.length,eligiblePairs:eligible.length,example:eligible[0]&&{model:eligible[0].model,center:eligible[0].triangle.center,normal:eligible[0].triangle.normal,density:eligible[0].triangle.density,point:eligible[0].triangle.point(.5,.5)}},null,2));
 expect(entities).toHaveLength(19);expect(matches).toHaveLength(17);expect(matches.reduce((sum,m)=>sum+m.surfaces.reduce((n,s)=>n+s.triangles,0),0)).toBe(1539);
 expect(candidates).toHaveLength(146);expect(geometry).toHaveLength(280);expect(eligible).toHaveLength(160);expect(eligible.every(row=>row.triangle.point(.5,.5).every(Number.isFinite))).toBe(true);
},30000);
