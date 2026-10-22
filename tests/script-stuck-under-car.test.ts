import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('095D reads the live player/NPC get-up flags and honors negation without recomputing collision',()=>{
 let player=false,npc=false;const ped={},playerFlag=vi.fn(()=>player),pedFlag=vi.fn((p:unknown)=>{expect(p).toBe(ped);return npc;});
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{playerStuckUnderCar:playerFlag,scriptPedStuckUnderCar:pedFlag} as any),h=m.peds.adopt(ped,4,7,{x:0,y:0,z:0},0);
 const query=(handle:number,negate=false)=>{const code=new Uint8Array([0x5d,negate?0x89:9,1,0,0,0,0,0x4e,0]);new DataView(code.buffer).setInt32(3,handle,true);const slot=m.runtime.start(0,[],{space:code});slot.thread.run(1000,100,1);return slot.thread.condition;};
 expect(query(1)).toBe(false);expect(query(h)).toBe(false);player=true;expect(query(1)).toBe(true);expect(query(h)).toBe(false);npc=true;expect(query(h)).toBe(true);expect(query(h,true)).toBe(false);npc=false;expect(query(h,true)).toBe(true);
 expect(playerFlag).toHaveBeenCalledTimes(2);expect(pedFlag).toHaveBeenCalledTimes(5);
});
