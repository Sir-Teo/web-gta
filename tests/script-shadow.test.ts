import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
import {NativeScriptShadowQueue,scriptShadow} from '../src/render/nativeScriptShadow';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[133],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x16f)!;

test('STUNT’s actual local-array operands produce its black ped blob for one frame',()=>{
 const mission=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
 const slot=mission.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(56*4,3,true);
 for(const [base,value] of [[127,10],[147,20],[167,30]])slot.thread.locals.setFloat32((base+3)*4,value,true);
 slot.thread.run(1000,100,1);expect(mission.takeScriptShadows()).toEqual([{id:0,textureType:2,position:[10,20,30],size:0,front:[-0,1],side:[1,0],intensity:150,color:[0,0,0],maxHeight:15,maxDistance:Infinity}]);
 expect(mission.takeScriptShadows()).toEqual([]);expect(mission.snapshot().skipped).toEqual([]);expect(mission.snapshot().gaveUp).toEqual([]);
});

test('script shadow geometry uses radians and float32 products with native parameter narrowing',()=>{
 const a=Math.fround(.7),length=Math.fround(3.2),sin=Math.fround(Math.fround(Math.sin(a))*length),cos=Math.fround(Math.fround(Math.cos(a))*length);
 expect(scriptShadow(258,1+1e-9,2,3,a,length,65535,-1,511,256)).toMatchObject({textureType:2,position:[1,2,3],front:[-sin,cos],side:[cos,sin],intensity:-1,color:[255,255,0]});
 for(const type of [0,7,255])expect(scriptShadow(type,0,0,0,0,1,255,0,0,0)).toBeUndefined();
});

test('stored script shadows stop at 48 and release every slot after rendering',()=>{
 const queue=new NativeScriptShadowQueue(),shadow=scriptShadow(2,0,0,10,0,1,150,0,0,0)!;
 for(let n=0;n<50;n++)queue.store({...shadow,position:[n,0,10]});const frame=queue.take();expect(frame).toHaveLength(48);expect(frame[47]).toMatchObject({id:47,position:[47,0,10]});expect(queue.take()).toEqual([]);
 queue.store(shadow);expect(queue.take()[0].id).toBe(0);
});
