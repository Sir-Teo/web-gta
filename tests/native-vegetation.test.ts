import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {readPlants} from '../src/assets/vegetation';
import {nativeSurfaceId,NATIVE_SURFACE_NAMES,indexNativeSurfaceInfo} from '../src/assets/surfaceIds';
import {readSurfaceInfo} from '../src/assets/surfaceInfo';
import {initializeNativePlants,nativePlantCounts,nativeVegetationEligibility} from '../src/world/nativeVegetation';

const row=(surface='GRASS_SHORT_LUSH',cover=0,density=.08)=>`${surface} ${cover} 0 0 1 220 210 165 160 22 40 .5 .51 1.5 .65 5 1 ${density}`;
test('plant initialization applies native casts/defaults and preserves independent cover slots',()=>{
 const records=readPlants(row()+'\n'+row('GRASS_SHORT_LUSH',1));
 records[1].values.alpha=300;records[1].values.red=-1;records[1].values.slot=1;
 const surfaces=initializeNativePlants(records),surface=surfaces.get(nativeSurfaceId('GRASS_SHORT_LUSH'))!;
 expect(surfaces.size).toBe(1);expect(surface.slot).toBe(1);
 expect(surface.covers[0].color).toEqual([220,210,165,40]);expect(surface.covers[1].color).toEqual([255,210,165,44]);
 expect(surface.covers[0].scaleZ).toBe(Math.fround(.51));expect(surface.covers[2]).toMatchObject({model:65535,density:0,scaleXY:1,intensity:255});
 records[1].values.cover=-1;records[1].values.alpha=25;
 const replaced=initializeNativePlants(records).get(nativeSurfaceId('GRASS_SHORT_LUSH'))!;
 expect(replaced.covers[0].color[3]).toBe(25);expect(replaced.covers[1].model).toBe(65535);
 expect(records[0].values.scaleZ).toBe(.51);
});
test('plant triangle counts use float32 truncation and the native extra group of eight',()=>{
 const surface=initializeNativePlants(readPlants(row()+'\n'+row('GRASS_SHORT_LUSH',1,0))).values().next().value!;
 expect(nativePlantCounts(100,surface)).toEqual({maximum:[8,0,0],draw:[16,8,0]});
 expect(nativePlantCounts(0,surface)).toEqual({maximum:[0,0,0],draw:[0,0,0]});
 surface.covers[0].density=1;
 expect(nativePlantCounts(65535,surface)).toEqual({maximum:[65535,0,0],draw:[0,8,0]});
 expect(()=>nativePlantCounts(65536,surface)).toThrow('uint16');
 expect(()=>nativePlantCounts(Infinity,surface)).toThrow('area');
});
test('unsupported plant tables fail without using fallback surface zero or native out-of-bounds indices',()=>{
 for(const name of ['UNKNOWN','DEFAULT','RAILTRACK'])expect(()=>initializeNativePlants(readPlants(row(name)))).toThrow('surface');
 const records=readPlants(row());records[0].values.texture=4;expect(()=>initializeNativePlants(records)).toThrow('PC');
 expect(()=>initializeNativePlants(readPlants(NATIVE_SURFACE_NAMES.slice(1,59).map(name=>row(name)).join('\n')))).toThrow('57');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('actual grass tables initialize and surface flags independently gate vegetation',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!;
 const records=readPlants(await readFile(join(depot,'plants.dat'),'utf8')),surfaces=initializeNativePlants(records);
 expect(surfaces.size).toBe(42);
 const {byId}=indexNativeSurfaceInfo(readSurfaceInfo(await readFile(join(depot,'surfinfo.dat'),'utf8')).records);
 for(const [id,info] of byId)if(info.values.procPlant)expect(surfaces.has(id),info.name).toBe(true);
 for(const [id,surface] of surfaces){
  const flags=nativeVegetationEligibility(id,byId);expect(flags.plants).toBe(!!byId.get(id)!.values.procPlant);
  expect(flags.objects).toBe(!!byId.get(id)!.values.procObj);
  expect(nativePlantCounts(100,surface).maximum.every(n=>Number.isInteger(n)&&n>=0)).toBe(true);
 }
 const lush=nativeSurfaceId('GRASS_SHORT_LUSH'),original=byId.get(lush)!;
 expect(nativeVegetationEligibility(lush,new Map([[lush,{...original,values:{...original.values,procPlant:0,procObj:1}}]]))).toEqual({plants:false,objects:true});
 expect(nativeVegetationEligibility(lush,new Map())).toEqual({plants:false,objects:false});
});
