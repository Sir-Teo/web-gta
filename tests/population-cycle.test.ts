import {test,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {readPopulationCycle,preparePopulationCycle,populationCycleAt,populationTimeSlot} from '../src/assets/populationCycle';
const source=()=>readFile('public/play/world/files/vehicles/popcycle.dat','utf8');
test('all native population rows preserve source order and scheduling identities',async()=>{
 const raw=readPopulationCycle(await source()),prepared=preparePopulationCycle(raw);
 expect(raw).toHaveLength(480);expect(raw.at(-1)).toMatchObject({zoneType:19,weekType:1,timeIndex:11});
 expect(populationCycleAt(prepared,0,2,0)).toMatchObject({maxPeds:3,maxCars:9,groups:[0,0,15,0,0,0,0,0,35,35,15,0,0,0,0,0,0,0]});
 expect(populationCycleAt(prepared,0,2,8)).toMatchObject({maxPeds:20,maxCars:18,timeIndex:4,weekType:0});
 expect(raw.filter(r=>r.groups.reduce((a,b)=>a+b,0)<100)).toHaveLength(15);
 for(let i=0;i<480;i++){const total=raw[i].groups.reduce((a,b)=>a+b,0);expect(prepared[i].groups).toEqual(raw[i].groups.map(v=>total<100?Math.floor(v*100/total):v));expect(prepared[i].groups).not.toBe(raw[i].groups);}
});
test('native weekly boundaries retain Monday daytime weekend and Saturday daytime weekday',()=>{
 expect(populationTimeSlot(1,19)).toEqual({weekType:1,timeIndex:9});expect(populationTimeSlot(1,20)).toEqual({weekType:0,timeIndex:10});
 expect(populationTimeSlot(6,19)).toEqual({weekType:0,timeIndex:9});expect(populationTimeSlot(6,20)).toEqual({weekType:1,timeIndex:10});
 for(const day of [0,7])expect(populationTimeSlot(day,0).weekType).toBe(1);
 expect(populationTimeSlot(5,23)).toEqual({weekType:0,timeIndex:11});
 for(const [day,hour] of [[8,0],[0,24],[0,-1],[1,1.5]])expect(()=>populationTimeSlot(day,hour)).toThrow();
});
test('incomplete, malformed and zero-weight population data cannot become usable tables',async()=>{
 const text=await source(),raw=readPopulationCycle(text);
 expect(()=>readPopulationCycle('1 2 3')).toThrow('24 byte');expect(()=>readPopulationCycle(text+'\n'+Array(24).fill(0).join(' '))).toThrow('Too many');
 expect(()=>readPopulationCycle(text.replace('    3     9','  256     9'))).toThrow('byte');
 const bad=structuredClone(raw);bad[0].groups.fill(0);expect(()=>preparePopulationCycle(bad)).toThrow('zero group');
 const reordered=[...raw];[reordered[0],reordered[1]]=[reordered[1],reordered[0]];expect(()=>preparePopulationCycle(reordered)).toThrow('layout');
 expect(()=>populationCycleAt(raw,20,2,8)).toThrow('zone');
});

import {pickPopulationCarModel} from '../src/assets/populationCycle';
test('pickPopulationCarModel draws a car group by its popcycle percentage and a random eligible model of it',()=>{
 const groups=Array.from({length:34},(_,index)=>({index,models:index===0?[100,101]:index===1?[200]:[]}));
 const row={line:1,zoneType:0,weekType:0 as const,timeIndex:0,maxPeds:5,maxCars:5,dealers:100,gangs:100,cops:100,other:100,groups:[75,25,...Array(16).fill(0)]};
 // The first draw lands in the 75% group (r=0.1), the second model of it (r=0.9).
 const seq=[0.1,0.9];expect(pickPopulationCarModel(row,groups,()=>seq.shift()??0,()=>true)).toBe(101);
 // r=0.8 crosses the first group's 75% into the second.
 const seq2=[0.8,0.3];expect(pickPopulationCarModel(row,groups,()=>seq2.shift()??0,()=>true)).toBe(200);
 // Nothing eligible after sixteen tries: undefined, and a weightless row never draws.
 expect(pickPopulationCarModel(row,groups,Math.random,()=>false)).toBeUndefined();
 expect(pickPopulationCarModel({...row,groups:Array(18).fill(0)},groups,Math.random,()=>true)).toBeUndefined();
});
