import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {build} from 'rolldown';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {readHandling} from '../src/assets/handling';
import {readVehicleAnimGroups} from '../src/assets/vehicleAnimGroups';
import {advancePlaneEntry,planeEntrySlots} from '../src/simulation/WorldPlane';

const groups=()=>{
  const handling=readHandling(readFileSync('public/play/world/files/vehicles/handling.cfg','utf8'));
  return readVehicleAnimGroups(handling.supplements);
};

test('entry clips resolve through the handling anim group flags',()=>{
  const table=groups();
  // Rustler/Hunter/Cropduster/Stuntplane: file align, file climb.
  expect(planeEntrySlots(table.get(14),'getin')).toEqual([{file:'rustler',name:'Plane_align_LHS'},{file:'rustler',name:'Plane_getin'}]);
  expect(planeEntrySlots(table.get(14),'getout')).toEqual([{file:'rustler',name:'Plane_getout'}]);
  // Hydra: ped align, file climb.
  expect(planeEntrySlots(table.get(27),'getin')).toEqual([{file:'ped',name:'CAR_align_LHS'},{file:'rustler',name:'Plane_getin'}]);
  // Shamal: file throughout.
  expect(planeEntrySlots(table.get(26),'getin')).toEqual([{file:'shamal',name:'SHAMAL_align'},{file:'shamal',name:'SHAMAL_getin_LHS'}]);
  // Nevada: ped align, file climb.
  expect(planeEntrySlots(table.get(29),'getin')).toEqual([{file:'ped',name:'CAR_align_LHS'},{file:'nevada',name:'NEVADA_getin'}]);
  // Helicopters: ped throughout.
  expect(planeEntrySlots(table.get(0),'getin')).toEqual([{file:'ped',name:'CAR_align_LHS'},{file:'ped',name:'CAR_getin_LHS'}]);
  // Beagle/Dodo: ped throughout.
  expect(planeEntrySlots(table.get(13),'getin')).toEqual([{file:'ped',name:'CAR_align_LHS'},{file:'ped',name:'CAR_getin_LHS'}]);
  expect(planeEntrySlots(undefined,'getin')).toBeUndefined();
});

test('entry sequences complete step by step',{timeout:30000},()=>{
  const entry={phase:'getin' as const,steps:[{clip:{duration:.5} as never,clipName:'a'},{clip:{duration:1} as never,clipName:'b'}],index:0,time:0};
  expect(advancePlaneEntry(entry,.4)).toBe(false);
  expect(advancePlaneEntry(entry,.2)).toBe(false);
  expect(entry.index).toBe(1);expect(entry.time).toBeCloseTo(.1,10);
  expect(advancePlaneEntry(entry,.9)).toBe(true);
  expect(advancePlaneEntry({phase:'getout' as const,steps:[{clip:{duration:0} as never,clipName:'z'}],index:0,time:0},0)).toBe(false);
});

test('every resolved clip exists in its packaged IFP',{timeout:60000},async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'web-gta-plane-entry-'));
  try{
    await build({input:resolve('src/assets/ifp.ts'),platform:'node',output:{file:join(temporary,'ifp.mjs'),format:'esm'}});
    const {readIfp}=await import(pathToFileURL(join(temporary,'ifp.mjs')).href);
    const table=groups(),packs=new Map<string,Set<string>>();
    for(const id of [0,13,14,26,27,29])for(const phase of ['getin','getout'] as const)
      for(const s of planeEntrySlots(table.get(id),phase)??[]){
        let names=packs.get(s.file);
        if(!names){const path=s.file==='ped'?'public/play/world/files/animations/ped.ifp':`public/play/world/files/animations/${s.file}.ifp`;names=new Set(readIfp(new Uint8Array(readFileSync(path))).animations.map((a:{name:string})=>a.name.toLowerCase()));packs.set(s.file,names);}
        expect(names,s.file).toContain(s.name.toLowerCase());
      }
  }finally{await rm(temporary,{recursive:true,force:true});}
});
