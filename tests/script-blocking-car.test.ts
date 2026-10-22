import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[51],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x987)!;

test('the actual SCRASH3 instruction reads the stored blocker, adopts its stable handle and writes -1 when clear',async()=>{
 const car={},target={};let blocked=false;const read=vi.fn(()=>blocked?{entity:target,model:400}:undefined);
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{spawnScriptVehicle:async()=>car,scriptVehiclePosition:()=>({x:1,y:2,z:3}),scriptVehicleHeading:()=>0,scriptVehicleBlockingCar:read} as any),h=m.vehicles.create(411,{x:0,y:0,z:0});await m.vehicles.whenSettled(h);
 const globals=new DataView(m.runtime.scriptSpace.buffer);globals.setInt32(7468,h,true);const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
 const query=()=>{const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.run(1000,100,1);return globals.getInt32(43004,true);};
 expect(query()).toBe(-1);blocked=true;const blocker=query();expect(blocker).toBeGreaterThan(1);expect(m.vehicles.entity(blocker)).toBe(target);expect(query()).toBe(blocker);expect(m.vehicles.modelOf(blocker)).toBe(400);blocked=false;expect(query()).toBe(-1);
 expect(read.mock.calls).toEqual([[car],[car],[car],[car]]);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
