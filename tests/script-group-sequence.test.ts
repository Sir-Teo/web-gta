import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {NativePedGroup} from '../src/ped/nativePedGroup';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[27],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x87d)!;

test('TWAR7’s original group-sequence command stores a resolved slot without issuing individual ped tasks',()=>{
 const give=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{giveScriptPedSequence:give,givePlayerOrders:give} as any),w=m.runtime.world!,sequences=m.runtime.game.sequences,group=w.createGroup!(0),other=w.createGroup!(0),groups=(m as any).groups as Map<number,NativePedGroup>;
 w.setGroupLeader!(group,1);w.setGroupMember!(group,2);
 const sequence=sequences.open();sequences.addTaskToActiveSequence({kind:'standStill',time:1000});sequences.close(sequence);
 const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
 const query=(handle:number)=>{const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;new DataView(m.runtime.scriptSpace.buffer).setInt32(44,group,true);slot.thread.locals.setInt32(147*4,handle,true);slot.thread.run(1000,100,1);};
 query(sequence);expect(groups.get(group)?.scriptSequence).toBe(sequences.index(sequence));expect(groups.get(other)?.scriptSequence).toBe(-1);expect(give).not.toHaveBeenCalled();
 sequences.clear(sequence);const replacement=sequences.open();sequences.close(replacement);expect(sequences.index(replacement)).toBe(0);query(sequence);expect(groups.get(group)?.scriptSequence).toBe(-1);
 query(replacement);expect(groups.get(group)?.scriptSequence).toBe(0);query(-1);expect(groups.get(group)?.scriptSequence).toBe(-1);
 w.setGroupSequence!(999999,replacement);expect(groups.has(999999)).toBe(false);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('flushing group membership also resets the native stored sequence slot',()=>{
 const group=new NativePedGroup();expect(group.scriptSequence).toBe(-1);group.setLeader(1);group.addFollower(2);group.scriptSequence=3;group.flush();expect(group.countMembers()).toBe(0);expect(group.scriptSequence).toBe(-1);
});
