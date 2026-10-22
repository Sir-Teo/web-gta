import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[125],sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x866);

test('both original BURGJB loot queries return a live object handle and -1 when it is no longer liftable',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),objects=m.runtime.game.objects,options={external:false,missionCleanup:false},junk=objects.create('kmb_woodenbox',{x:100,y:200,z:300},options),loot=objects.create('kmb_woodenbox',{x:101,y:200,z:300},options);loot.stealable=true;
 expect(sites).toHaveLength(2);
 for(const site of sites){
  const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
  const query=()=>{const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;[100,200,300].forEach((n,k)=>slot.thread.locals.setFloat32((63+k)*4,n,true));slot.thread.run(1000,100,1);return slot.thread.locals.getInt32(49*4,true);};
  loot.stealable=true;expect(query()).toBe(loot.handle);loot.stealable=false;expect(query()).toBe(-1);
  junk.stealable=true;expect(query()).toBe(junk.handle);junk.stealable=false;
 }
 expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
