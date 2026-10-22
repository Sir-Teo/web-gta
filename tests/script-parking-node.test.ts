import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[51],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x810)!;

test('SCRASH3’s original parking box writes float coordinates and shares its cursor across script threads',()=>{
 let areas:any=new Map([[2,{vehicleCount:2,nodes:[{behaviour:2,position:[-1740,1000,20]},{behaviour:2,position:[-1730,1010,21]}]}]]);
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{carPathAreas:()=>areas} as any),globals=new DataView(m.runtime.scriptSpace.buffer),code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
 const query=()=>{const slot=m.runtime.start(0,[],{space:code});slot.thread.run(1000,100,1);return [292,296,300].map(n=>globals.getFloat32(n,true));};
 expect(query()).toEqual([-1740,1000,20]);expect(query()).toEqual([-1730,1010,21]);expect(query()).toEqual([-1740,1000,20]);areas=undefined;expect(query()).toEqual([0,0,0]);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
