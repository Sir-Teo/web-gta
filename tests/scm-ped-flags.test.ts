import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function host(){
 const flags:Record<string,unknown>={};
 const peds=new Map<number,{position:{x:number;y:number;z:number};vehicle?:number;health:number;sitting?:number}>();
 const world:ScmWorldCommands={
  fade(){},
  pedPosition:handle=>peds.get(handle)!.position,
  pedVehicle:handle=>peds.get(handle)?.vehicle,
  pedHealth:handle=>peds.get(handle)!.health,
  pedIsSittingInCar:(handle,vehicle)=>peds.get(handle)?.sitting===vehicle,
  setPedStayInSamePlace:(_h,stay)=>{flags.stay=stay;},
  setPedSuffersCriticalHits:(_h,suffers)=>{flags.critical=suffers;},
  setPedCanBeShotInVehicle:(_h,can)=>{flags.shot=can;},
  setPedCantBeDraggedOut:(_h,cannot)=>{flags.dragged=cannot;},
  freezePedPosition:(_h,frozen)=>{flags.frozen=frozen;},
  setPedLoadsCollision:(_h,loads)=>{flags.collision=loads;},
  attachPedToCar:(_h,vehicle,offset,position,angleLimit,weapon)=>{flags.attach={vehicle,offset,position,angleLimit,weapon};},
  detachPedFromCar:()=>{flags.detached=true;},
 };
 return {flags,peds,world};
}
function run(bytes:Uint8Array,world:ScmWorldCommands){
 const threadHost:ScmThreadHost={startScript(){},game:new ScmGameState(),world};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),threadHost);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
function build(opcode:number,parts:{type:number;value:number}[]){
 const size=(type:number)=>type===4?2:type===3?3:5;
 const bytes=new Uint8Array(2+parts.reduce((n,part)=>n+size(part.type),0));
 const view=new DataView(bytes.buffer);
 view.setUint16(0,opcode,true);
 let at=2;
 for(const part of parts){
  bytes[at]=part.type;
  if(part.type===4)bytes[at+1]=part.value;
  else if(part.type===3)view.setUint16(at+1,part.value,true);
  else if(part.type===6)view.setFloat32(at+1,part.value,true);
  else view.setInt32(at+1,part.value,true);
  at+=size(part.type);
 }
 return bytes;
}
const int=(value:number)=>({type:1,value});
const flt=(value:number)=>({type:6,value});
const byte=(value:number)=>({type:4,value});
const local=(index:number)=>({type:3,value:index});

describe('ped flags, health, attachment and areas',()=>{
 test('each flag command reaches its own field',()=>{
  const h=host();
  run(build(scmOpcode('SET_CHAR_STAY_IN_SAME_PLACE'),[int(1),byte(1)]),h.world);
  run(build(scmOpcode('SET_CHAR_SUFFERS_CRITICAL_HITS'),[int(1),byte(0)]),h.world);
  run(build(scmOpcode('SET_CHAR_CAN_BE_SHOT_IN_VEHICLE'),[int(1),byte(1)]),h.world);
  run(build(scmOpcode('SET_CHAR_CANT_BE_DRAGGED_OUT'),[int(1),byte(1)]),h.world);
  run(build(scmOpcode('FREEZE_CHAR_POSITION'),[int(1),byte(1)]),h.world);
  run(build(scmOpcode('SET_LOAD_COLLISION_FOR_CHAR_FLAG'),[int(1),byte(0)]),h.world);
  expect(h.flags).toMatchObject({stay:true,critical:false,shot:true,dragged:true,frozen:true,collision:false});
 });

 test('the health comes back as a whole number',()=>{
  const h=host();
  h.peds.set(1,{position:{x:0,y:0,z:0},health:87.6});
  const reader=run(build(scmOpcode('GET_CHAR_HEALTH'),[int(1),local(4)]),h.world);
  expect(reader.locals.getInt32(4*4,true)).toBe(87);
 });

 test('sitting in a car is more than holding one',()=>{
  const h=host();
  h.peds.set(1,{position:{x:0,y:0,z:0},health:100,vehicle:9});
  expect(run(build(scmOpcode('IS_CHAR_SITTING_IN_CAR'),[int(1),int(9)]),h.world).condition).toBe(false);
  h.peds.get(1)!.sitting=9;
  expect(run(build(scmOpcode('IS_CHAR_SITTING_IN_CAR'),[int(1),int(9)]),h.world).condition).toBe(true);
 });

 test('the car a ped rides is stored, and a ped on foot stops the script',()=>{
  const h=host();
  h.peds.set(1,{position:{x:0,y:0,z:0},health:100});
  expect(()=>run(build(scmOpcode('STORE_CAR_CHAR_IS_IN'),[int(1),local(2)]),h.world)).toThrow('not in a vehicle');
  h.peds.get(1)!.vehicle=33;
  const reader=run(build(scmOpcode('STORE_CAR_CHAR_IS_IN'),[int(1),local(2)]),h.world);
  expect(reader.locals.getInt32(2*4,true)).toBe(33);
 });

 test('attaching passes the offset, position, angle in radians and weapon',()=>{
  const h=host();
  run(build(scmOpcode('ATTACH_CHAR_TO_CAR'),[int(1),int(9),flt(1),flt(2),flt(3),int(2),flt(180),int(22)]),h.world);
  expect(h.flags.attach).toEqual({vehicle:9,offset:{x:1,y:2,z:3},position:2,angleLimit:Math.PI,weapon:22});
  run(build(scmOpcode('DETACH_CHAR_FROM_CAR'),[int(1)]),h.world);
  expect(h.flags.detached).toBe(true);
 });

 test('the area tests take two corners in either order',()=>{
  const h=host();
  h.peds.set(1,{position:{x:5,y:5,z:5},health:100});
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_2D'),[int(1),flt(0),flt(0),flt(10),flt(10),byte(0)]),h.world).condition).toBe(true);
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_2D'),[int(1),flt(10),flt(10),flt(0),flt(0),byte(0)]),h.world).condition).toBe(true);
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_3D'),[int(1),flt(0),flt(0),flt(0),flt(10),flt(10),flt(1),byte(0)]),h.world).condition).toBe(false);
  // The on-foot and in-car forms gate on the ped's vehicle first.
  const box=[int(1),flt(0),flt(0),flt(0),flt(10),flt(10),flt(10),byte(0)];
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_ON_FOOT_3D'),box),h.world).condition).toBe(true);
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_IN_CAR_3D'),box),h.world).condition).toBe(false);
  h.peds.get(1)!.vehicle=7;
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_ON_FOOT_3D'),box),h.world).condition).toBe(false);
  expect(run(build(scmOpcode('IS_CHAR_IN_AREA_IN_CAR_3D'),box),h.world).condition).toBe(true);
 });
});
