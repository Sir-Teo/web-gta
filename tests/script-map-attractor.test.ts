import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {closestMapAttractor} from '../src/simulation/nativeMapAttractor';
import type {WorldAttractor} from '../src/simulation/nativeScene';
import {ScmMission} from '../src/simulation/ScmMission';
import {readImgEntry,readImgIndex} from '../src/assets/img';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
const effect=(key:string,x=0,z=0):WorldAttractor=>({key,model:'chair',modelId:123,type:5,scriptName:'PCUSTOM',probability:100,position:[x,0,z],queueDir:[0,1,0],useDir:[0,1,0],forwardDir:[0,1,0]});
function setup(){
 const candidates=[effect('a',2),effect('b',4)],a={position:{x:0,y:0,z:0},health:100,progress:-1,orders:[] as any[]},b={...a,position:{...a.position}},host={mapAttractorsNear:vi.fn(()=>candidates),giveScriptPedOrder:(p:typeof a,order:any)=>{p.orders=[order];p.progress=-1;},giveScriptPedSequence:(p:typeof a,orders:any[])=>{p.orders=orders;p.progress=0;},scriptPedSequenceProgress:(p:typeof a)=>p.progress,scriptPedHasOrder:(p:typeof a)=>p.progress>=0,scriptPedPosition:(p:typeof a)=>p.position,scriptPedHealth:(p:typeof a)=>p.health,scriptPedHeading:()=>0,scriptPedAlive:()=>true,clearScriptPedTasks:(p:typeof a)=>p.progress=-1};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),ha=m.peds.adopt(a,4,'MALE01',a.position,0,100),hb=m.peds.adopt(b,4,'MALE01',b.position,0,100),w=m.runtime.world!,tick=()=>(m as any).processMapAttractors();return{m,w,a,b,ha,hb,candidates,host,tick};
}
test('native map selection filters type, exact script name, model, prior effect and slot before strict 3D float ranking',()=>{
 const a=effect('a',1,4),b=effect('b',2),c=effect('c',-2),invalid=effect('invalid',0);invalid.type=1;
 expect(closestMapAttractor([invalid,a,b,c],{x:0,y:0,z:0},0,'PCUSTOM',undefined)?.key).toBe('b');expect(closestMapAttractor([b,c],{x:0,y:0,z:0},123,'PCUSTOM','b')?.key).toBe('c');expect(closestMapAttractor([b,c],{x:0,y:0,z:0},'CHAIR','PCUSTOM',undefined,e=>e.key!=='b')?.key).toBe('c');expect(closestMapAttractor([b],{x:0,y:0,z:0},124,'PCUSTOM',undefined)).toBeUndefined();expect(closestMapAttractor([b],{x:0,y:0,z:0},0,'pcustom',undefined)).toBeUndefined();expect(closestMapAttractor([effect('limit',10000)],{x:0,y:0,z:0},0,'PCUSTOM',undefined)).toBeUndefined();
});
test('reservations exclude occupied/current effects, register before arrival and release on travel cancellation or death',()=>{
 const {m,w,a,b,ha,hb,tick}=setup();expect(w.useClosestMapAttractor!(ha,100,0,999,999,999,'PCUSTOM')).toBe(true);expect(a.orders).toMatchObject([{kind:'goToPoint',x:2,radius:.125,moveState:4},{kind:'achieveHeading'}]);expect(w.pedUsesMapAttractor!(ha)).toBe(true);expect(w.closestMapAttractorUser!(0,0,0,100,0,'PCUSTOM')).toBe(-1);expect(w.useClosestMapAttractor!(hb,100,0,0,0,0,'PCUSTOM')).toBe(true);expect(b.orders[0].x).toBe(4);expect(w.useClosestMapAttractor!(ha,100,0,0,0,0,'PCUSTOM')).toBe(false);
 w.clearPedTasks!(ha);tick();expect(w.pedUsesMapAttractor!(ha)).toBe(false);b.health=0;tick();expect(m.mapAttractorsSnapshot()).toEqual([]);
});
test('arrival starts the registered original PCUSTOM brain and keeps occupancy across its own animation tasks',()=>{
 const {m,w,a,ha,tick}=setup();m.loadStreamedScripts(new Uint8Array(readFileSync('public/play/world/files/scripts/script.img')));m.runtime.game.scriptBrains.registerForCodeUse(42,'PCUSTOM',true);expect(w.useClosestMapAttractor!(ha,100,0,0,0,0,'PCUSTOM')).toBe(true);tick();expect(m.runtime.active).toHaveLength(0);a.position={x:2,y:0,z:0};a.progress=-1;tick();const brain=m.runtime.active[0].thread;expect(brain.isExternal).toBe(true);expect(brain.externalType).toBe(2);expect(brain.locals.getInt32(0,true)).toBe(ha);expect(brain.locals.getInt32(4,true)).toBe(0);expect(w.closestMapAttractorUser!(0,0,0,100,0,'PCUSTOM')).toBe(ha);m.runtime.currentThread=brain;try{w.givePedScriptedTask!(ha,{kind:'pause',time:100},0x5b9);}finally{m.runtime.currentThread=undefined;}tick();expect(w.pedUsesMapAttractor!(ha)).toBe(true);brain.terminated=true;tick();expect(w.pedUsesMapAttractor!(ha)).toBe(false);
});
test('all seven original streamed handoff instructions dispatch, find their named effect and return the real condition',async()=>{
 const {m,a,ha,candidates}=setup(),blob=new Blob([readFileSync('public/play/world/files/scripts/script.img')]),entries=await readImgIndex(blob),header=readScmHeader(script);let count=0;
 for(const block of header.streamed){const entry=entries.find(e=>e.name.toLowerCase()===`${block.name.toLowerCase()}.scm`);if(!entry)continue;const bytes=await readImgEntry(blob,entry);let ins;try{ins=decodeScmInstructions(bytes,0,block.size);}catch{continue;}
  for(const site of ins.filter(i=>i.opcode===0x8a0)){count++;candidates.splice(0,candidates.length,{...effect(`site-${count}`,2),scriptName:String(site.parameters[6].value)});(m as any).mapAttractorUses.clear();const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([78,0],code.length-2);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(0,ha,true);slot.thread.run(1000,100,1);expect(slot.thread.condition).toBe(true);expect(a.orders[0].x).toBe(2);}
 }
 expect(count).toBe(7);expect(m.snapshot().gaveUp).toEqual([]);expect(m.snapshot().skipped).toEqual([]);
});

test('an outside task replacement aborts arrived use while an unavailable effect returns false without changing the current task',()=>{
 const {m,w,a,ha,tick}=setup();m.loadStreamedScripts(new Uint8Array(readFileSync('public/play/world/files/scripts/script.img')));m.runtime.game.scriptBrains.registerForCodeUse(42,'PCUSTOM',true);w.useClosestMapAttractor!(ha,100,0,0,0,0,'PCUSTOM');a.progress=-1;tick();expect(w.pedUsesMapAttractor!(ha)).toBe(true);expect(w.useClosestMapAttractor!(ha,100,0,0,0,0,'missing')).toBe(false);expect(w.pedUsesMapAttractor!(ha)).toBe(true);w.givePedScriptedTask!(ha,{kind:'pause',time:100},0x5b9);expect(w.pedUsesMapAttractor!(ha)).toBe(false);expect(w.scriptTaskStatus!(ha,0x8a0)).toBe(7);
});

test('unloading the source entity aborts approach and arrived use, clearing the owned movement task',()=>{
 for(const arrived of [false,true]){
  const {m,w,a,ha,tick,host}=setup();m.loadStreamedScripts(new Uint8Array(readFileSync('public/play/world/files/scripts/script.img')));m.runtime.game.scriptBrains.registerForCodeUse(42,'PCUSTOM',true);let loaded=true;(host as any).mapAttractorExists=()=>loaded;w.useClosestMapAttractor!(ha,100,0,0,0,0,'PCUSTOM');if(arrived){a.progress=-1;tick();}loaded=false;tick();expect(w.pedUsesMapAttractor!(ha)).toBe(false);expect(a.progress).toBe(-1);expect(m.mapAttractorsSnapshot()).toEqual([]);
 }
});
