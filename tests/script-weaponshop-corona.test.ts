import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[82],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x4d5)!;

test('the original DES10 corona uses native range/pull and stable per-thread/per-site identity',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),globals=new DataView(m.runtime.scriptSpace.buffer);globals.setFloat32(292,1,true);globals.setFloat32(296,2,true);globals.setFloat32(300,3,true);
 const length=site.end-site.offset,code=new Uint8Array(length+11);code.set(script.subarray(site.offset,site.end));code.set([1,0,4,0,2,0,1,0,0,0,0],length);
 const start=()=>{const s=m.runtime.start(0,[],{space:code,mission:true});s.thread.usesMissionCleanup=false;s.thread.locals.setFloat32(110*4,1.25,true);return s.thread;},a=start();a.run(1000,100,1);const first=m.takeScriptCoronas();a.run(1001,100,1);const again=m.takeScriptCoronas();start().run(1002,100,1);const other=m.takeScriptCoronas();
 expect(first).toHaveLength(1);expect(first[0]).toMatchObject({position:[1,2,3],size:1.25,color:[0,255,0],coronaType:2,flareType:2,range:150,pullTowardsCamera:Math.fround(.2)});
 expect(again[0].id).toBe(first[0].id);expect(other[0].id).not.toBe(first[0].id);expect(first[0].id).not.toBe(0);expect(m.takeScriptCoronas()).toEqual([]);
});

test('weapon-shop coronas narrow byte arguments and use the native inclusive -100 ground sentinel',()=>{
 const ground=vi.fn(()=>42),m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{groundLevel:ground} as any),w=m.runtime.world!;
 w.drawWeaponshopCorona!(1,2,-100,1,258,258,-1,511,256,1);w.drawWeaponshopCorona!(1,2,-99.999,1,2,2,0,255,0,2);
 const [a,b]=m.takeScriptCoronas();expect(a).toMatchObject({position:[1,2,42],coronaType:2,flareType:2,color:[255,255,0]});expect(b.position[2]).toBe(-99.999);expect(ground).toHaveBeenCalledExactlyOnceWith(1,2,1000);
 w.drawCorona!(1,2,3,1,0,0,255,255,255,3);expect(m.takeScriptCoronas()[0].range).toBeUndefined();
});
