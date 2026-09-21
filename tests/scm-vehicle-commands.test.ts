import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {GENERATE_ALWAYS} from '../src/engine/ScmCarGenerators';
import {scmOpcode} from '../src/engine/scmOpcodes';

function host(){
 const seen:Record<string,unknown>={};
 const world:ScmWorldCommands={
  fade(){},
  vehicleSpeed:()=>12.5,
  setVehicleDrivingStyle:(_h,style)=>{seen.style=style;},
  vehicleColours:()=>({primary:3,secondary:7,tertiary:11,quaternary:13}),
  popCarBoot:handle=>{seen.boot=handle;},
  skipTrainToNextStation:handle=>{seen.train=handle;},
  setHeliAudio:(_h,enabled)=>{seen.heliAudio=enabled;},
  clearHeliOrientation:handle=>{seen.heli=handle;},
  removeRCBuggy:()=>{seen.buggy=true;},
  vehicleIsInAirProper:()=>true,
 };
 return {seen,world};
}
function run(bytes:Uint8Array,world:ScmWorldCommands,game=new ScmGameState()){
 const threadHost:ScmThreadHost={startScript(){},game,world};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),threadHost);
 try{thread.run(1000,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,game};
}
function build(opcode:number,parts:{type:number;value:number}[]){
 const size=(type:number)=>type===4?2:type===3?3:5;
 const bytes=new Uint8Array(2+parts.reduce((n,part)=>n+size(part.type),0));
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
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

describe('more vehicle commands',()=>{
 test('the speed, driving style and paint answer from the world',()=>{
  const h=host();
  const speed=run(build(scmOpcode('GET_CAR_SPEED'),[int(1),local(2)]),h.world);
  expect(speed.thread.locals.getFloat32(2*4,true)).toBeCloseTo(12.5,4);
  run(build(scmOpcode('SET_CAR_DRIVING_STYLE'),[int(1),int(4)]),h.world);
  expect(h.seen.style).toBe(4);
  const extra=run(build(scmOpcode('GET_EXTRA_CAR_COLOURS'),[int(1),local(5),local(6)]),h.world);
  expect([5,6].map(index=>extra.thread.locals.getInt32(index*4,true))).toEqual([11,13]);
 });

 test('the train, the helicopter and the buggy each reach the world',()=>{
  const h=host();
  run(build(scmOpcode('SKIP_TO_NEXT_ALLOWED_STATION'),[int(9)]),h.world);
  run(build(scmOpcode('DISABLE_HELI_AUDIO'),[int(10),byte(0)]),h.world);
  run(build(scmOpcode('CLEAR_HELI_ORIENTATION'),[int(11)]),h.world);
  run(build(scmOpcode('REMOVE_RC_BUGGY'),[]),h.world);
  expect(h.seen).toMatchObject({train:9,heliAudio:false,heli:11,buggy:true});
  expect(run(build(scmOpcode('IS_CAR_IN_AIR_PROPER'),[int(1)]),h.world).thread.condition).toBe(true);
 });

 test('the rail resistance takes its default back for anything at or below nothing',()=>{
  const h=host();
  const raised=run(build(scmOpcode('SET_RAILTRACK_RESISTANCE_MULT'),[flt(2.5)]),h.world);
  expect(raised.game.railTrackResistanceMultiplier).toBe(2.5);
  const zero=run(build(scmOpcode('SET_RAILTRACK_RESISTANCE_MULT'),[flt(0)]),h.world,raised.game);
  expect(zero.game.railTrackResistanceMultiplier).toBe(1);
  const negative=run(build(scmOpcode('SET_RAILTRACK_RESISTANCE_MULT'),[flt(-3)]),h.world,zero.game);
  expect(negative.game.railTrackResistanceMultiplier).toBe(1);
 });

 test('a generator switched on always keeps that unless the count is a hundred or fewer',()=>{
  const h=host(),game=new ScmGameState();
  game.carGenerators.create({position:[0,0,0],angle:0,modelId:400,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0);
  game.carGenerators.switch(0,101,1000);
  expect(game.carGenerators.at(0).generateCount).toBe(GENERATE_ALWAYS);
  game.carGenerators.switch(0,150,1000);
  expect(game.carGenerators.at(0).generateCount).toBe(GENERATE_ALWAYS);
  game.carGenerators.switch(0,7,1000);
  expect(game.carGenerators.at(0).generateCount).toBe(7);
  game.carGenerators.switch(0,0,1000);
  expect(game.carGenerators.at(0).generateCount).toBe(0);
  run(build(scmOpcode('SET_HAS_BEEN_OWNED_FOR_CAR_GENERATOR'),[int(0),byte(1)]),h.world,game);
  expect(game.carGenerators.at(0).playerHasAlreadyOwnedCar).toBe(true);
 });
});
