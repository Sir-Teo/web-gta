import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {build} from 'rolldown';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {advancePlaneEntry,planeEntryClips} from '../src/simulation/WorldPlane';

test('plane entry clips map supported models to their verified IFP blocks',()=>{
  expect(planeEntryClips(476)).toEqual({file:'rustler',getin:'Plane_getin',getout:'Plane_getout'});
  expect(planeEntryClips(520)).toEqual({file:'rustler',getin:'Plane_getin',getout:'Plane_getout'});
  expect(planeEntryClips(519)).toEqual({file:'shamal',getin:'SHAMAL_getin_LHS',getout:'SHAMAL_getout_LHS'});
  expect(planeEntryClips(553)).toEqual({file:'nevada',getin:'NEVADA_getin',getout:'NEVADA_getout'});
  expect(planeEntryClips(487)).toBeUndefined();
  expect(planeEntryClips(593)).toBeUndefined();
});

test('entry phases complete when their clip duration elapses',{timeout:30000},()=>{
  const entry={phase:'getin' as const,time:0,clip:{duration:1.2} as never,clipName:'plane_getin'};
  expect(advancePlaneEntry(entry,.5)).toBe(false);
  expect(entry.time).toBeCloseTo(.5,10);
  expect(advancePlaneEntry(entry,.8)).toBe(true);
});

test('packaged entry IFPs contain every mapped clip',{timeout:60000},async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'web-gta-plane-entry-'));
  try{
    await build({input:resolve('src/assets/ifp.ts'),platform:'node',output:{file:join(temporary,'ifp.mjs'),format:'esm'}});
    const {readIfp}=await import(pathToFileURL(join(temporary,'ifp.mjs')).href);
    for(const modelId of [476,520,519,553]){
      const map=planeEntryClips(modelId)!;
      const names=readIfp(new Uint8Array(readFileSync(`public/play/world/files/animations/${map.file}.ifp`))).animations.map((a:{name:string})=>a.name.toLowerCase());
      expect(names).toContain(map.getin.toLowerCase());
      expect(names).toContain(map.getout.toLowerCase());
    }
  }finally{await rm(temporary,{recursive:true,force:true});}
});
