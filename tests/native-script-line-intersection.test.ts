import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import fixture from './fixtures/native-script-line-intersection.json';
import {nativeScriptLineIntersection} from '../src/engine/nativeScriptLineIntersection';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
for(const row of fixture.cases)test(`native segment intersection: ${row.input.name}`,()=>{
 const result=nativeScriptLineIntersection(row.input.segments);expect(result.intersects).toBe(row.intersects);expect([result.x,result.y]).toEqual(row.point);
});
test('POOL2’s original intersection instruction updates its condition, stores sentinel misses and supports negation',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(bytes).missions[8],site=decodeScmInstructions(bytes,block.start,block.end).find(i=>i.offset===414183)!,m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]}as any,{}as any);
 for(const name of ['pool-back-line','parallel'])for(const negate of [false,true]){
  const row=fixture.cases.find(c=>c.input.name===name)!,code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));if(negate)code[1]|=128;code.set([78,0],code.length-2);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;
  for(let i=0;i<8;i++)slot.thread.locals.setFloat32([571,572,574,575,577,578,580,581][i]*4,row.input.segments[i],true);slot.thread.run(1000,100,1);
  const globals=new DataView(m.runtime.scriptSpace.buffer,m.runtime.scriptSpace.byteOffset,m.runtime.scriptSpace.byteLength);expect([globals.getFloat32(292,true),globals.getFloat32(296,true)]).toEqual(row.point);expect(slot.thread.condition).toBe(negate?!row.intersects:row.intersects);
 }
 expect(m.skipped.size).toBe(0);expect(m.gaveUp).toEqual([]);
});
