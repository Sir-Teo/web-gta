import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[109],sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x98a);

test('RIOT2’s actual 15/-1/-1 instructions update one global event range without clamping or automatic cleanup reset',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any);expect(sites).toHaveLength(3);expect(m.runtime.game.gunshotSenseRangeForRiot2).toBe(-1);
 for(const [n,i] of sites.entries()){const code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));code.set([0x4e,0],i.end-i.offset);m.runtime.start(0,[],{space:code}).thread.run(1000,100,1);expect(m.runtime.game.gunshotSenseRangeForRiot2).toBe(n===0?15:-1);}
 m.runtime.world!.setGunshotSenseRangeForRiot2!(12+1e-8);expect(m.runtime.game.gunshotSenseRangeForRiot2).toBe(12);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
