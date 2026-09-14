import {test,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {readInitialZonePopulation} from '../src/assets/scmZonePopulation';
import {readZones,prepareWorldZones,worldZoneAt} from '../src/assets/worldZones';
const source=()=>readFile('public/play/world/files/scripts/main.scm');
test('original SCM headers and all mission code decode on bounded instruction boundaries',async()=>{
 const bytes=await source(),header=readScmHeader(bytes);
 expect(header).toMatchObject({entry:55976,mainSize:194125,globalBytes:43800,largestMissionSize:68439,missionLocals:964});expect(header.objectNames).toHaveLength(389);expect(header.missions).toHaveLength(135);expect(header.streamed).toHaveLength(79);
 expect(decodeScmInstructions(bytes,header.entry,header.mainSize)).toHaveLength(16587);
 let count=0,zoneWrites=0;for(const mission of header.missions){const instructions=decodeScmInstructions(bytes,mission.start,mission.end);expect(instructions.at(-1)!.end).toBe(mission.end);count+=instructions.length;zoneWrites+=instructions.filter(i=>i.name==='SET_ZONE_POPULATION_TYPE').length;}
 expect(count).toBe(343852);expect(zoneWrites).toBe(340);expect(header.streamed[0].offset).toBe(bytes.length); // External streamed payload is not inside MAIN.SCM.
});
test('source initialization applies zone state, retaining unknown labels as diagnostics',async()=>{
 const zones=prepareWorldZones((await Promise.all(['map.zon','info.zon'].map(async n=>readZones(await readFile('public/play/world/files/zones/'+n,'utf8'),n)))).flat()),result=readInitialZonePopulation(await source(),zones);
 expect(result).toMatchObject({launchOffset:56361,blockStart:234130,blockEnd:240464});expect(result.counts).toEqual({SET_ZONE_POPULATION_TYPE:340,SET_ZONE_GANG_STRENGTH:72,SET_ZONE_POPULATION_RACE:26,SET_ZONE_DEALER_STRENGTH:37,SET_ZONE_NO_COPS:1});
 expect(result.unresolved).toEqual([]);
 const missing={...zones,infoLabels:zones.infoLabels.filter(label=>label!=='VERO2')};
 expect([...new Set(readInitialZonePopulation(await source(),missing).unresolved.map(r=>r.label))]).toEqual(['VERO2']);
 expect(result.population[worldZoneAt(zones,[2495,-1687,13]).zoneInfoIndex].popType).toBe(7);expect(result.population[worldZoneAt(zones,[-2493,379,28]).zoneInfoIndex].popType).toBe(4);expect(result.population[worldZoneAt(zones,[400,2500,30]).zoneInfoIndex].popType).toBe(5);
});
test('bad header chains, truncated operands and unknown opcodes cannot shift instruction boundaries',async()=>{
 const bytes=await source(),bad=bytes.slice();new DataView(bad.buffer,bad.byteOffset,bad.byteLength).setUint32(3,0,true);expect(()=>readScmHeader(bad)).toThrow('bounds');
 expect(()=>decodeScmInstructions(new Uint8Array([1,0,1,0]),0,4)).toThrow('Truncated');expect(()=>decodeScmInstructions(new Uint8Array([255,127]),0,2)).toThrow('Unknown');
 const args=new Uint8Array([79,0,1,10,0,0,0,4,255,0]);expect(decodeScmInstructions(args,0,args.length)[0].parameters.map(p=>p.value)).toEqual([10,-1]);
});
