import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('both original CASINO4 instructions set raw clump alpha on the live vehicle',async()=>{
 const car={},set=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{spawnScriptVehicle:async()=>car,setScriptVehicleClumpAlpha:set} as any),h=m.vehicles.create(411,{x:1,y:2,z:3});await m.vehicles.whenSettled(h);
 const b=readScmHeader(script).missions[88],sites=decodeScmInstructions(script,b.start,b.end).filter(i=>i.opcode===0x594);expect(sites).toHaveLength(2);
 for(const i of sites){const code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));code.set([0x4e,0],i.end-i.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(289*4,h,true);slot.thread.run(1000,100,1);}
 expect(set.mock.calls).toEqual([[car,0],[car,0]]);m.runtime.world!.setVehicleToFadeIn!(h,128);m.runtime.world!.setVehicleToFadeIn!(h,-1);expect(set.mock.calls.slice(2)).toEqual([[car,128],[car,-1]]);
});
