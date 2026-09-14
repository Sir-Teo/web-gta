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
 const geometry=candidates.filter(candidate=>candidate.createsObjects).flatMap(candidate=>rules.filter(rule=>rule.surface===candidate.surface).map(rule=>({rule,model:rule.modelName,triangle:nativeProcTriangle(candidate.triangle.vertices,rule,camera)})));
 const eligible=geometry.filter(row=>row.triangle.eligible&&row.triangle.density>0);
 const transforms=eligible.map(row=>{
  const asset=assets.find(asset=>asset.name===row.model)!;
  const transform=nativeProcTransform(row.rule,row.triangle.point(.5,.5),row.triangle.normal,asset.collision.bounds.min[2],asset.entityKind,[.25,.75,.5,.5]);
  expect(transform.entityMatrix.every(Number.isFinite)&&transform.renderMatrix.every(Number.isFinite)).toBe(true);
  if(asset.entityKind==='building')expect(transform.scaleApplied).toBe(false);
  return {model:asset.name,kind:asset.entityKind,aligned:transform.allocatedMatrix,scaled:transform.scaleApplied,entityMatrix:[...transform.entityMatrix],renderMatrix:[...transform.renderMatrix]};
 });
 await writeFile('/tmp/web-gta-verdant-procedural-transforms.json',JSON.stringify(transforms,null,2));
 expect(transforms).toHaveLength(160);
 await writeFile('/tmp/web-gta-verdant-procedural-coverage.json',JSON.stringify({entities:entities.length,matches,camera,candidateTriangles:candidates.length,ruleTrianglePairs:geometry.length,eligiblePairs:eligible.length,example:eligible[0]&&{model:eligible[0].model,center:eligible[0].triangle.center,normal:eligible[0].triangle.normal,density:eligible[0].triangle.density,point:eligible[0].triangle.point(.5,.5)}},null,2));
 expect(entities).toHaveLength(19);expect(matches).toHaveLength(17);expect(matches.reduce((sum,m)=>sum+m.surfaces.reduce((n,s)=>n+s.triangles,0),0)).toBe(1539);
 expect(candidates).toHaveLength(146);expect(geometry).toHaveLength(280);expect(eligible).toHaveLength(160);expect(eligible.every(row=>row.triangle.point(.5,.5).every(Number.isFinite))).toBe(true);
},30000);
