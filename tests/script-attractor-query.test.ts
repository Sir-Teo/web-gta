import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),block=readScmHeader(script).missions[90],sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x642);
function setup(){
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{giveScriptPedSequence:(p:any)=>{p.running=true;p.progress=0;},giveScriptPedOrder:(p:any)=>{p.running=true;p.progress=-1;},scriptPedSequenceProgress:(p:any)=>p.progress,scriptPedHasOrder:(p:any)=>p.running,scriptPedHealth:(p:any)=>p.health,scriptPedAlive:()=>true,scriptPedPosition:()=>({x:0,y:0,z:0}),scriptPedHeading:()=>0} as any),w=m.runtime.world!,sequence=m.runtime.game.sequences.open();m.runtime.game.sequences.addTaskToActiveSequence({kind:'standStill',time:50000});m.runtime.game.sequences.close(sequence);
 const a={health:100,running:false,progress:-1},b={...a},ha=m.peds.adopt(a,4,7,{x:0,y:0,z:0},0),hb=m.peds.adopt(b,4,7,{x:0,y:0,z:0},0),attr=w.addAttractor!(0,0,0,0,180,sequence);
 const query=(siteIndex:number,ped:number,attractor=attr,negate=false)=>{const site=sites[siteIndex],code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));if(negate)code[1]|=0x80;code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(39*4,ped,true);slot.thread.locals.setInt32(289*4,0,true);slot.thread.locals.setInt32(53*4,ped,true);slot.thread.locals.setInt32(205*4,attractor,true);slot.thread.run(1000,100,1);return slot.thread.condition;};
 return {m,w,a,b,ha,hb,attr,query};
}

test('both original CASINO6 queries read arrived ownership after walking and heading, without a distance test',()=>{
 const {m,w,a,ha,hb,attr,query}=setup();expect(sites).toHaveLength(2);w.taskUseAttractor!(ha,attr);
 for(const n of [0,1]){expect(query(n,ha)).toBe(false);a.progress=1;expect(query(n,ha)).toBe(false);a.progress=2;expect(query(n,ha)).toBe(true);expect(query(n,hb)).toBe(false);expect(query(n,-1)).toBe(true);expect(query(n,ha,attr,true)).toBe(false);a.progress=0;}
 expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('scripted ownership expires on completion, task replacement, death and attractor deletion',()=>{
 const {w,a,b,ha,hb,attr,query}=setup();w.taskUseAttractor!(ha,attr);a.progress=2;expect(query(0,ha)).toBe(true);
 w.taskUseAttractor!(hb,attr);b.progress=2;expect(query(0,hb)).toBe(false);expect(query(0,ha)).toBe(true);
 a.running=false;expect(query(0,-1)).toBe(false);w.taskUseAttractor!(hb,attr);b.progress=2;expect(query(0,hb)).toBe(true);
 w.givePedScriptedTask!(hb,{kind:'standStill',time:1000},0x5ba);expect(query(0,-1)).toBe(false);
 w.taskUseAttractor!(ha,attr);a.progress=2;a.health=0;expect(query(0,-1)).toBe(false);a.health=100;w.taskUseAttractor!(ha,attr);a.progress=2;expect(query(0,ha)).toBe(true);
 w.clearAttractor!(attr);expect(query(0,ha)).toBe(false);expect(query(0,999999)).toBe(false);
});

test('the iOS handler distinguishes -1 wildcard from an invalid ped’s null-pointer comparison',()=>{
 const {w,a,ha,attr,query}=setup();expect(query(0,-1)).toBe(false);expect(query(0,999999)).toBe(true);expect(query(0,ha)).toBe(false);expect(query(0,-1,-1)).toBe(false);
 w.taskUseAttractor!(ha,attr);a.progress=2;expect(query(0,999999)).toBe(false);expect(query(0,-1)).toBe(true);
});
