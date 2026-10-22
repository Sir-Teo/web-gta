import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function setup(){
 const a={position:{x:0,y:0,z:1},health:100,heading:0,order:undefined as any,progress:undefined as number|undefined},b={...a,position:{x:4,y:0,z:1}},host={scriptPedAlive:()=>true,scriptPedPosition:(p:typeof a)=>({...p.position}),scriptPedHeading:(p:typeof a)=>p.heading,scriptPedHealth:(p:typeof a)=>p.health,giveScriptPedOrder:(p:typeof a,order:any)=>p.order=order,scriptPedHasOrder:(p:typeof a)=>!!p.order,scriptPedAnimProgress:(p:typeof a)=>p.progress,clearScriptPedTasks:(p:typeof a)=>p.order=undefined};
 const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,host as any),first=m.peds.adopt(a,25,'MALE01',a.position,0,100),second=m.peds.adopt(b,25,'MALE01',b.position,0,100),w=m.runtime.world!,tick=(dt=.05)=>(m as any).processGreetings(dt),settle=()=>{a.order=b.order=undefined;tick();},stage=()=>{settle();settle();settle();settle();};
 vi.spyOn(m as any,'randomSample16').mockReturnValue(0);
 return {m,w,a,b,first,second,tick,settle,stage};
}
test('SYN5’s original instruction coordinates both NPCs and keeps both task records through their handshake and postlude',()=>{
 const {m,w,a,b,first,second,tick,settle,stage}=setup(),block=readScmHeader(bytes).missions[64],site=decodeScmInstructions(bytes,block.start,block.end).find(i=>i.offset===1671665)!,code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([78,0],code.length-2);new DataView(m.runtime.scriptSpace.buffer,m.runtime.scriptSpace.byteOffset,m.runtime.scriptSpace.byteLength).setInt32(528,first,true);const thread=m.runtime.start(0,[],{space:code,mission:true}).thread;thread.usesMissionCleanup=false;thread.locals.setInt32(35*4,second,true);thread.run(1000,100,1);
 expect(a.order.kind).toBe('standStill');expect(b.order.kind).toBe('standStill');stage();expect(a.order).toMatchObject({kind:'playAnim',file:'GANGS',name:'hndshkfa'});expect(b.order).toMatchObject({kind:'playAnim',file:'GANGS',name:'hndshkfa'});
 a.progress=1;b.progress=.5;tick();expect(a.order.kind).toBe('playAnim');expect(w.scriptTaskStatus!(first,0x823)).not.toBe(7);expect(w.scriptTaskStatus!(second,0x823)).not.toBe(7);b.progress=1;tick();tick();expect(a.order.kind).toBe('standStill');expect(b.order.kind).toBe('standStill');for(let i=0;i<4;i++)settle();expect(w.scriptTaskStatus!(first,0x823)).toBe(7);expect(w.scriptTaskStatus!(second,0x823)).toBe(7);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
test('one partner waits for the other’s approach, and replacing either primary task cancels the paired greeting',()=>{
 const {w,a,b,first,second,tick,settle}=setup();w.taskGreetPartner!(first,second,.5,2);settle();a.order=undefined;tick();expect(b.order.kind).toBe('goToPoint');expect(a.order).toBeUndefined();b.order=undefined;tick();expect(a.order.kind).toBe('achieveHeading');w.givePedScriptedTask!(first,{kind:'standStill',time:1000},0x5ba);expect(w.scriptTaskStatus!(second,0x823)).toBe(7);expect(b.order).toBeUndefined();expect(a.order.kind).toBe('standStill');
});
test('an approach timeout or dead partner ends both records, while player participation fails explicitly',()=>{
 const {w,a,b,first,second,tick,settle}=setup();w.taskGreetPartner!(first,second,.5,5);settle();tick(5.1);expect(a.order).toBeUndefined();expect(b.order).toBeUndefined();expect(w.scriptTaskStatus!(first,0x823)).toBe(7);w.taskGreetPartner!(first,second,.5,5);a.health=0;tick();expect(w.scriptTaskStatus!(second,0x823)).toBe(7);expect(()=>w.taskGreetPartner!(1,second,.5,5)).toThrow('PLAYER_PARTNER_GREETING_NOT_PORTED');
});
