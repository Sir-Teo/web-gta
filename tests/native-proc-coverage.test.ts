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
 const loaded=await readScene(await planWorldFolder(files,'verdant-meadows'));
 const info=indexNativeSurfaceInfo(readSurfaceInfo(await readFile(join(depot,'surfinfo.dat'),'utf8')).records).byId;
 const objects=indexObjectData(readObjectData(await readFile(join(depot,'object.dat'),'utf8')));
 const rules=prepareNativeProcRules(readProcObjects(await readFile(join(depot,'procobj.dat'),'utf8')));
 const entities=nativeScenePlantEntities(loaded.scene,info,objects,0),matches=[];
 for(const entity of entities){
  const surfaces=new Map<number,number>();
  for(const id of entity.collision.mesh.materials)if(info.get(id)?.values.procObj&&rules.some(rule=>rule.surface===id))surfaces.set(id,(surfaces.get(id)??0)+1);
  if(surfaces.size)matches.push({identity:entity.identity,model:entity.collision.name,position:entity.matrix.elements.slice(12,15),surfaces:[...surfaces].map(([id,triangles])=>({id,name:NATIVE_SURFACE_NAMES[id],triangles,models:rules.filter(rule=>rule.surface===id).map(rule=>rule.modelName)}))});
 }
 const camera=[400,2500,20] as const,plants=initializeNativePlants(readPlants(await readFile(join(depot,'plants.dat'),'utf8')));
 const candidates=entities.flatMap(entity=>[...nativePlantCollisionCandidates(entity.collision,entity.matrix,camera,info,plants)]);
 const geometry=candidates.filter(candidate=>candidate.createsObjects).flatMap(candidate=>rules.filter(rule=>rule.surface===candidate.surface).map(rule=>({model:rule.modelName,triangle:nativeProcTriangle(candidate.triangle.vertices,rule,camera)})));
 const eligible=geometry.filter(row=>row.triangle.eligible&&row.triangle.density>0);
 await writeFile('/tmp/web-gta-verdant-procedural-coverage.json',JSON.stringify({entities:entities.length,matches,camera,candidateTriangles:candidates.length,ruleTrianglePairs:geometry.length,eligiblePairs:eligible.length,example:eligible[0]&&{model:eligible[0].model,center:eligible[0].triangle.center,normal:eligible[0].triangle.normal,density:eligible[0].triangle.density,point:eligible[0].triangle.point(.5,.5)}},null,2));
 expect(entities).toHaveLength(19);expect(matches).toHaveLength(17);expect(matches.reduce((sum,m)=>sum+m.surfaces.reduce((n,s)=>n+s.triangles,0),0)).toBe(1539);
 expect(candidates).toHaveLength(146);expect(geometry).toHaveLength(280);expect(eligible).toHaveLength(160);expect(eligible.every(row=>row.triangle.point(.5,.5).every(Number.isFinite))).toBe(true);
},30000);
