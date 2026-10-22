import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {decodeScmInstructions,readScmHeader,type ScmInstruction} from '../src/assets/scm';
import {ScmMission} from '../src/simulation/ScmMission';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(script),block=header.missions[80],sites=decodeScmInstructions(script,block.start,block.end);
const queries=sites.filter(i=>i.opcode===0xa3a),clear=sites.find(i=>i.opcode===0xa3b)!;
const run=(m:ScmMission,i:ScmInstruction,negated=false)=>{const code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));if(negated)code[1]|=0x80;code.set([0x4e,0],i.end-i.offset);const slot=m.runtime.start(0,[],{space:code});slot.thread.run(1000,100,1);return slot.thread.condition;};

test('DESERT9 resolves all three used-object models, compares without consuming the record, and clears only the requested player',()=>{
 const names=queries.map(i=>header.objectNames[-(i.parameters[1].value as number)]),ids=new Map(names.map((n,k)=>[n,10000+k]));expect(queries).toHaveLength(3);
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{modelIndex:(name:string)=>ids.get(name)??-1} as any),info=m.runtime.game.playerInfo;
 new DataView(m.runtime.scriptSpace.buffer).setInt32(8,0,true);expect([...info.lastBuildingModelsShot]).toEqual([-1,-1]);
 for(const q of queries)expect(run(m,q)).toBe(false);
 for(let k=0;k<queries.length;k++){info.lastBuildingModelsShot[0]=10000+k;for(let j=0;j<queries.length;j++)expect(run(m,queries[j])).toBe(k===j);expect(run(m,queries[k])).toBe(true);expect(run(m,queries[k],true)).toBe(false);}
 info.lastBuildingModelsShot[1]=123;run(m,clear);expect([...info.lastBuildingModelsShot]).toEqual([-1,123]);expect(run(m,queries[2])).toBe(false);
 new DataView(m.runtime.scriptSpace.buffer).setInt32(8,1,true);run(m,clear);expect([...info.lastBuildingModelsShot]).toEqual([-1,-1]);
});

test('a missing model index does not match the initial -1 sentinel',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{modelIndex:()=>-1} as any);new DataView(m.runtime.scriptSpace.buffer).setInt32(8,0,true);
 expect(run(m,queries[0])).toBe(false);
});
