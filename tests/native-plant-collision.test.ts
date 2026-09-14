import {prepareNativeProcRules} from '../src/world/nativeProcRules';
import {readProcObjects} from '../src/assets/vegetation';
import {readFileSync,openAsBlob} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {expect,test} from 'vitest';
import {Matrix4} from 'three';
import {readCol} from '../src/assets/col';
import {nativeSurfaceId,indexNativeSurfaceInfo} from '../src/assets/surfaceIds';
import {readSurfaceInfo,type SurfaceInfoRecord} from '../src/assets/surfaceInfo';
import {readPlants} from '../src/assets/vegetation';
import {initializeNativePlants} from '../src/world/nativeVegetation';
import {nativePlantCollisionCandidates} from '../src/world/nativePlantCollision';
import {NativePlantPool} from '../src/world/NativePlantPool';
import {NativeBuildingSectors} from '../src/world/NativeBuildingSectors';
import {NativePlantEntityCache} from '../src/world/NativePlantEntityCache';
import {nativeScenePlantEntities} from '../src/world/nativeScenePlants';
import {readObjectData,indexObjectData} from '../src/assets/objectData';
import {nativePlantTriangle} from '../src/world/nativePlantTriangle';
import {nativePlacementMatrix} from '../src/assets/placement';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {readScene} from '../src/assets/scene';
import {planSceneCollision} from '../src/assets/sceneCollision';

test('COL candidates retain triangle identity, lighting, source transforms and phase filtering',()=>{
 const col=readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],id=nativeSurfaceId('GRASS_SHORT_LUSH');
 col.flags=0;col.mesh={positions:new Float32Array([0,0,0,3,0,0,0,4,0]),indices:new Uint32Array([0,1,2,2,1,0]),materials:new Uint8Array([id,id]),lights:new Uint8Array([0x21,0xab])};
 const info=new Map([[id,{values:{procPlant:1,procObj:1}} as SurfaceInfoRecord]]);
 const plants=initializeNativePlants(readPlants('GRASS_SHORT_LUSH 0 0 0 1 220 210 165 160 22 40 .5 .51 1.5 .65 5 1 1'));
 const matrix=new Matrix4().makeTranslation(20,30,40),camera=[20,30,40] as const;
 const candidates=[...nativePlantCollisionCandidates(col,matrix,camera,info,plants)];
 expect(candidates).toHaveLength(2);expect(candidates[0]).toMatchObject({index:0,surface:id,lighting:0x21,createsPlants:true,createsObjects:true,counts:{maximum:[6,0,0]}});
 expect(candidates[0].triangle.vertices[0]).toEqual([20,30,40]);expect(candidates[1].lighting).toBe(0xab);
 expect([...nativePlantCollisionCandidates(col,matrix,camera,info,plants,1)].map(x=>x.index)).toEqual([1]);
 expect([...nativePlantCollisionCandidates(col,matrix,camera,info,plants,2)]).toEqual([]);
 col.flags=8;col.faceGroups=[{min:[0,0,0],max:[3,4,0],start:1,end:1}];
 expect([...nativePlantCollisionCandidates(col,matrix,camera,info,plants)].map(x=>x.index)).toEqual([1]);
 expect([...nativePlantCollisionCandidates(col,matrix,[1000,1000,1000],info,plants)]).toEqual([]);
 expect(()=>[...nativePlantCollisionCandidates(col,matrix,camera,info,new Map())]).toThrow('Missing grass');
 info.get(id)!.values.procPlant=0;
 expect([...nativePlantCollisionCandidates(col,matrix,camera,info,new Map())][0]).toMatchObject({createsPlants:false,createsObjects:true,slot:3});
 const large=nativePlantTriangle([-2000,0,0],[2000,0,0],[0,4000,0]);
 expect(large.near(large.center)).toBe(true);expect(large.retainedNear(large.center)).toBe(false);
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('real eastern countryside exposes native vegetation-bearing collision triangles',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa;
 const archive=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
 const files:WorldFolderFile[]=[{path:'depot/gta3.img',file:archive as File}];
 for(const kind of ['ide','ipl'])for(const path of manifest.paths[kind]){
  const relative=`${kind}/${path}.${kind}`;files.push({path:`depot/${relative}`,file:new File([await readFile(join(depot,relative))],basename(relative))});
 }
 const loaded=await readScene(await planWorldFolder(files,'chiliad-east')),plan=planSceneCollision(loaded.scene);
 const info=indexNativeSurfaceInfo(readSurfaceInfo(await readFile(join(depot,'surfinfo.dat'),'utf8')).records).byId;
 const plants=initializeNativePlants(readPlants(await readFile(join(depot,'plants.dat'),'utf8')));
 // A read-only candidate inventory, not native sector/pool traversal order.
 const candidates=[];
 let seedCalls=0;
 const pool=new NativePlantPool({randomSample:()=>{seedCalls++;return .5;},addObjects:()=>false,removeObjects:()=>{throw new Error('No procedural objects were created.');}});
 const batches=[];
 for(const [partIndex,part] of loaded.scene.entries())if(part.collision)for(const i of plan.indices[partIndex]){
  const batch=[...nativePlantCollisionCandidates(part.collision,nativePlacementMatrix(part.placements[i]),[-1750,-1450,35],info,plants)],entity=`${partIndex}:${i}`;
  batches.push({entity,batch});pool.updateEntity(entity,[-1750,-1450,35],batch);
  for(const candidate of batch)candidates.push({model:part.name,...candidate});
 }
 const proceduralRules=prepareNativeProcRules(readProcObjects(await readFile(join(depot,'procobj.dat'),'utf8')));
 // A procObj surface flag alone does not guarantee matching object rules.
 const objectSurfaces=[...new Set(candidates.filter(c=>c.createsObjects).map(c=>c.surface))].sort((a,b)=>a-b);
 expect(objectSurfaces).toEqual([99,150]);
 expect(proceduralRules.filter(rule=>objectSurfaces.includes(rule.surface))).toEqual([]);
 expect(candidates).toHaveLength(158);expect(candidates.filter(c=>c.createsPlants)).toHaveLength(142);
 expect(candidates.filter(c=>c.createsObjects)).toHaveLength(73);expect(new Set(candidates.map(c=>c.model)).size).toBe(3);
 expect(candidates.every(c=>c.triangle.near([-1750,-1450,35]))).toBe(true);
 // An explicit no-object manager and fixed samples isolate lifetime behavior;
 // this does not assert native entity traversal or random-stream parity.
 expect(pool.size).toBe(142);expect(seedCalls).toBe(426);
 const retained=pool.triangles();
 for(const {entity,batch} of batches)pool.updateEntity(entity,[-1750,-1450,35],batch);
 expect(pool.triangles()).toEqual(retained);expect(seedCalls).toBe(426);
 for(const {entity} of batches)pool.releaseEntity(entity);expect(pool.size).toBe(0);
 const objectRows=readObjectData(await readFile(join(depot,'object.dat'),'utf8'));
 const entities=nativeScenePlantEntities(loaded.scene,info,indexObjectData(objectRows),0);
 const sectors=new NativeBuildingSectors();for(const entity of entities)sectors.add(entity,false);
 const lookup=new Map(entities.map(entity=>[entity.identity,entity])),resolve=(identity:string)=>lookup.get(identity),cache=new NativePlantEntityCache(pool);
 cache.update([-1750,-1450,35],false,sectors.scan([-1750,-1450,35]),resolve);
 cache.process([-1750,-1450,35],resolve,info,plants);
 console.info(JSON.stringify({sceneVegetation:{objectRows:objectRows.length,entities:entities.length,cached:cache.identities().length,triangles:pool.size}}));
 expect(objectRows).toHaveLength(994);expect(entities).toHaveLength(36);expect(cache.identities()).toHaveLength(19);expect(pool.size).toBe(142);
 const sceneRetained=pool.triangles();cache.process([-1750,-1450,35],resolve,info,plants);expect(pool.triangles()).toEqual(sceneRetained);
 cache.clear();expect(pool.size).toBe(0);
 console.info(JSON.stringify({vegetationCandidates:{triangles:candidates.length,models:new Set(candidates.map(c=>c.model)).size,grass:candidates.filter(c=>c.createsPlants).length,objects:candidates.filter(c=>c.createsObjects).length}}));
},30000);
