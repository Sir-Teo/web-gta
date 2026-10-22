import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {attachedDiveDirection,attachedDiveFootprint,attachedDiveHitSide,type AttachedDiveVehicle} from '../src/ped/nativeAttachedDive';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
const vehicle=(extra:Partial<AttachedDiveVehicle>={}):AttachedDiveVehicle=>({position:{x:0,y:0,z:0},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},bounds:{min:{x:-1,y:-2,z:-.5},max:{x:1,y:2,z:1}},moveSpeed:{x:0,y:0,z:0},...extra});

test('native attached dives select the diagonal sector of the padded vehicle footprint',()=>{
 const v=vehicle(),corners=attachedDiveFootprint(v,3);expect(corners.map(p=>p.z)).toEqual([3,3,3,3]);expect(corners[0].x).toBeCloseTo(-1.35,6);expect(corners[0].y).toBeCloseTo(2.35,6);
 for(const [p,side,dir] of [[{x:0,y:3,z:3},0,v.forward],[{x:-2,y:0,z:3},1,{x:-1,y:-0,z:-0}],[{x:0,y:-3,z:3},2,{x:-0,y:-1,z:-0}],[{x:2,y:0,z:3},3,v.right]] as const){expect(attachedDiveHitSide(p,corners)).toBe(side);expect(attachedDiveDirection(p,v)).toEqual(dir);}
 expect(attachedDiveHitSide({x:0,y:0,z:0},corners)).toBe(0);
});

test('a front/back dive along positive vehicle motion switches to the nearest side, with right winning a tie',()=>{
 const v=vehicle({moveSpeed:{x:0,y:.2,z:0}});expect(attachedDiveDirection({x:0,y:2,z:2},v)).toEqual(v.right);
 expect(attachedDiveDirection({x:-.8,y:2,z:2},v)).toEqual({x:-1,y:-0,z:-0});expect(attachedDiveDirection({x:.8,y:2,z:2},v)).toEqual(v.right);
 expect(attachedDiveDirection({x:0,y:-2,z:2},v)).toEqual({x:-0,y:-1,z:-0});v.moveSpeed.y=0;expect(attachedDiveDirection({x:0,y:2,z:2},v)).toEqual(v.forward);
});

test('the footprint uses projected box axes for a rolled vehicle, and directions retain their full native axes',()=>{
 const v=vehicle({right:{x:0,y:0,z:1},up:{x:-1,y:0,z:0}}),corners=attachedDiveFootprint(v,8);
 expect(Math.min(...corners.map(p=>p.x))).toBeCloseTo(-1.35,6);expect(Math.max(...corners.map(p=>p.x))).toBeCloseTo(.85,6);
 expect(attachedDiveDirection({x:2,y:0,z:8},v)).toEqual(v.right);
 const turned=vehicle({right:{x:0,y:1,z:0},forward:{x:-1,y:0,z:0}});expect(attachedDiveDirection({x:-3,y:0,z:3},turned)).toEqual(turned.forward);
});

const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function setup(){
 const v=vehicle(),car={},spawned:any[]=[],orders:any[]=[],rider={health:100,heading:90,position:{x:-.5,y:2,z:4},running:false,gone:false};
 const host={spawnScriptVehicle:async()=>car,scriptVehicleAlive:()=>true,scriptVehiclePosition:()=>v.position,scriptVehicleHeading:()=>0,scriptVehicleMatrix:()=>v,scriptVehicleBounds:()=>v.bounds,scriptVehicleVelocity:()=>({x:0,y:0,z:0}),spawnScriptPedOnCar:async()=>rider,
  spawnScriptPed:async(_type:number,_model:unknown,p:any)=>{const e={...rider,gone:false,position:{...p,z:p.z+1},heading:0};spawned.push({entity:e,feet:p});return e;},scriptPedAlive:(p:any)=>!p.gone,scriptPedHealth:(p:any)=>p.health,setScriptPedHealth:(p:any,h:number)=>p.health=h,scriptPedPosition:(p:any)=>p.position,scriptPedHeading:(p:any)=>p.heading,setScriptPedHeading:(p:any,h:number)=>p.heading=h,scriptPedHeadingRate:()=>.1,removeScriptPed:(p:any)=>p.gone=true,playScriptRiderClip:()=>{},clearScriptRiderClip:()=>{},clearScriptPedTasks:(p:any)=>p.running=false,giveScriptPedOrder:(p:any,o:any)=>{p.running=true;orders.push(o);},scriptPedHasOrder:(p:any)=>p.running};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),w=m.runtime.world!,carHandle=m.vehicles.create(400,{x:0,y:0,z:0});await m.vehicles.whenSettled(carHandle);const ped=m.peds.createOnCar(4,7,carHandle,{x:-.5,y:2,z:4});await flush();expect(m.peds.entity(ped)).toBe(rider);
 return {m,w,ped,rider,spawned,orders,carHandle};
}

test('CASINO1’s original instruction keeps the attachment through the turn, then detaches in place before diving',async()=>{
 const {m,w,ped,rider,spawned,orders}=await setup(),block=readScmHeader(script).missions[84],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x6a5)!;expect(site.offset).toBe(2089844);
 const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(324*4,ped,true);slot.thread.run(1000,100,1);
 expect(w.scriptTaskStatus!(ped,0x6a5)).toBe(0);expect(w.pedPosition!(ped)).toEqual(rider.position);(m as any).processRunners(.01);expect(m.peds.rideOf(ped)?.offset).toBeDefined();expect(spawned).toEqual([]);expect(orders).toEqual([]);
 for(let i=0;i<100&&m.peds.rideOf(ped);i++)(m as any).processRunners(.1);
 await flush();expect(m.peds.rideOf(ped)).toBeUndefined();expect(spawned[0].feet).toEqual({x:-.5,y:2,z:3});expect(spawned[0].entity.position).toEqual({x:-.5,y:2,z:4});expect(rider.gone).toBe(true);
 (m as any).processRunners(.01);expect(orders).toEqual([{kind:'diveAndGetUp',x:0,y:1,seconds:10}]);(m as any).processTaskRecords();expect(w.scriptTaskStatus!(ped,0x6a5)).toBe(1);
 spawned[0].entity.running=false;(m as any).processRunners(.01);(m as any).processTaskRecords();expect(w.scriptTaskStatus!(ped,0x6a5)).toBe(7);expect(m.snapshot().skipped).toEqual([]);
});

test('the attachment dive records in a sequence and cancellation cannot detach the former rider later',async()=>{
 const {m,w,ped,spawned}=await setup();w.givePedSequence!(ped,[{kind:'diveFromAttachmentAndGetUp',time:1000},{kind:'standStill',time:1000}],false,0x618);
 expect(w.pedSequenceProgress!(ped)).toBe(0);(m as any).processRunners(.01);w.clearPedTasks!(ped);for(let i=0;i<100;i++)(m as any).processRunners(.1);await flush();expect(m.peds.rideOf(ped)?.offset).toBeDefined();expect(spawned).toEqual([]);
});

test('the original task also records character -1 in an open sequence without starting a ped',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),seq=m.runtime.game.sequences.open(),block=readScmHeader(script).missions[84],site=decodeScmInstructions(script,block.start,block.end).find(i=>i.opcode===0x6a5)!,code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(324*4,-1,true);slot.thread.run(1000,100,1);m.runtime.game.sequences.close(seq);
 expect(m.runtime.game.sequences.sequenceFor(seq)!.sequence.tasks).toEqual([{kind:'diveFromAttachmentAndGetUp',time:10000}]);
});

test('without an attachment the native task uses the ped’s current forward direction',async()=>{
 const {m,w,orders}=await setup(),p={health:100,heading:90,position:{x:0,y:0,z:1},running:false,gone:false},h=m.peds.adopt(p,4,7,p.position,90);w.givePedScriptedTask!(h,{kind:'diveFromAttachmentAndGetUp',time:500},0x6a5);
 expect(orders[0]).toMatchObject({kind:'diveAndGetUp',seconds:.5});expect(orders[0].x).toBeCloseTo(-1);expect(orders[0].y).toBeCloseTo(0);
});

test('plain detachment also preserves the attached origin and heading through the feet-based rebuild',async()=>{
 const {m,w,ped,spawned}=await setup(),origin=w.pedPosition!(ped),heading=m.peds.headingOf(ped);w.detachPedFromCar!(ped);await flush();expect(spawned[0].feet.z).toBe(origin.z-1);expect(w.pedPosition!(ped)).toEqual(origin);expect(m.peds.headingOf(ped)).toBe(heading);
 w.detachPedFromCar!(ped);expect(spawned).toHaveLength(1);
});
