import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[57],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x95c)!;

test('WUZI5’s original twelve local operands reach the smoke host without color scaling or coordinate conversion',()=>{
 const add=vi.fn(),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{addScriptSmokeParticle:add} as any),code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
 const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;const values=[10,20,30,-1.5,1.5,.75,0,0,0,.2,1,1];values.forEach((v,i)=>slot.thread.locals.setFloat32((144+i)*4,v,true));slot.thread.run(1000,100,1);
 expect(add).toHaveBeenCalledExactlyOnceWith([10,20,30],[-1.5,1.5,.75],0,0,0,Math.fround(.2),1,1);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
