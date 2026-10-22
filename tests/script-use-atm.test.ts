import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {scriptedPedOrder} from '../src/simulation/nativeScriptedPedTasks';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

test('HEIST2’s original TASK_USE_ATM records the task for -1 instead of trying to resolve an NPC',()=>{
 const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[98],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x5c7)!,give=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{giveScriptPedOrder:give} as any),sequences=m.runtime.game.sequences,handle=sequences.open();
 const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(1000,100,1);sequences.close(handle);
 expect(sequences.sequenceFor(handle)?.sequence.tasks).toEqual([{kind:'useAtm'}]);expect(give).not.toHaveBeenCalled();expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('the ATM task uses the one-shot default-group clip for player and NPC without a held frame or arbitrary timeout',()=>{
 const expected={kind:'playAnim',file:'PED',name:'ATM',loop:false,keepLastFrame:false,seconds:Infinity};
 expect(scriptedPedOrder({kind:'useAtm'},{isPlayer:false} as any)).toEqual(expected);expect(scriptedPedOrder({kind:'useAtm'},{isPlayer:true} as any)).toEqual(expected);
});

test('HEIST2’s complete original seven-task repeat sequence retains the ATM step between its gestures',()=>{
 const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[98],instructions=decodeScmInstructions(script,block.start,block.end),site=instructions.findIndex(i=>i.opcode===0x5c7);let first=site;while(instructions[first].opcode!==0x615)first--;let last=site;while(instructions[last].opcode!==0x616)last++;
 const a=instructions[first].offset,b=instructions[last].end,code=new Uint8Array(b-a+2);code.set(script.subarray(a,b));code.set([0x4e,0],b-a);const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.run(1000,100,1);
 const sequence=m.runtime.game.sequences.sequenceFor(slot.thread.locals.getInt32(184*4,true))!.sequence;
 expect(sequence.tasks.map(t=>t.kind)).toEqual(['followPathNodesToCoord','achieveHeading','duck','scratchHead','playAnim','useAtm','scratchHead']);expect(sequence.repeatMode).toBe(1);expect(sequence.opened).toBe(false);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
