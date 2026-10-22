import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {scriptedPedOrder} from '../src/simulation/nativeScriptedPedTasks';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('both actual MAF4/DES10 sites dispatch the player jetpack through the scripted-task path',()=>{
 const give=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{givePlayerOrders:give} as any);new DataView(m.runtime.scriptSpace.buffer).setInt32(12,1,true);
 for(const mission of [81,82]){const block=readScmHeader(script).missions[mission],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x7a7)!,code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(1000,100,1);}
 expect(give.mock.calls).toEqual([[[{kind:'jetpack'}],false,false,0],[[{kind:'jetpack'}],false,false,0]]);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('jetpack assignment records into a sequence and NPC orders stay explicitly unsupported',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),id=m.runtime.game.sequences.open(),code=new Uint8Array([0xa7,7,4,255,0x4e,0]);m.runtime.start(0,[],{space:code}).thread.run(1000,100,1);m.runtime.game.sequences.close(id);
 expect(m.runtime.game.sequences.sequenceFor(id)?.sequence.tasks).toEqual([{kind:'jetpack'}]);expect(scriptedPedOrder({kind:'jetpack'},{self:()=>({x:0,y:0,z:0}),ped:()=>undefined})).toBeUndefined();
});

test('an order rejected by the live player task preserves the jetpack’s script-task record',()=>{
 const give=vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{givePlayerOrders:give} as any),w=m.runtime.world!;
 w.givePedScriptedTask!(1,{kind:'jetpack'},0x7a7);expect(w.scriptTaskStatus!(1,0x7a7)).toBe(0);w.givePedScriptedTask!(1,{kind:'standStill',time:100},0x5ba);expect(w.scriptTaskStatus!(1,0x7a7)).toBe(0);expect(w.scriptTaskStatus!(1,0x5ba)).toBe(7);
});
