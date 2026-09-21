import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function pedHost(){
 const state={decisionMaker:0,area:-1,neverTargeted:false,weapon:-1,warpedInto:-1,warpedTo:{x:0,y:0,z:0},shutUp:false,anim:''};
 const damage=new Map<number,{ped?:number;vehicle?:number}>();
 const vehicles=new Map<number,number>();
 const world:ScmWorldCommands={
  fade(){},
  setPedDecisionMaker:(_h,maker)=>{state.decisionMaker=maker;},
  setPedAreaVisible:(_h,area)=>{state.area=area;},
  setPedNeverTargeted:(_h,enabled)=>{state.neverTargeted=enabled;},
  setPedCurrentWeapon:(_h,weapon)=>{state.weapon=weapon;},
  pedLastDamagedBy:handle=>damage.get(handle),
  pedVehicle:handle=>vehicles.get(handle),
  warpPedIntoCar:(_h,vehicle)=>{state.warpedInto=vehicle;},
  warpPedFromCarToCoord:(_h,x,y,z)=>{state.warpedTo={x,y,z};},
  pedIsPlayingAnim:(_h,animation)=>animation===state.anim,
  shutPedUpForScriptedSpeech:(_h,enabled)=>{state.shutUp=enabled;},
 };
 return {state,damage,vehicles,world};
}
function run(bytes:Uint8Array,world:ScmWorldCommands){
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
const ints=(opcode:number,values:number[])=>{
 const bytes=new Uint8Array(2+values.length*5);const view=new DataView(bytes.buffer);
 view.setUint16(0,opcode,true);
 values.forEach((value,k)=>{bytes[2+k*5]=1;view.setInt32(3+k*5,value,true);});
 return bytes;
};

describe('the rest of the ped commands',()=>{
 test('the decision maker, area, targeting and weapon each reach the ped',()=>{
  const host=pedHost();
  run(ints(scmOpcode('SET_CHAR_DECISION_MAKER'),[1,-1]),host.world);
  expect(host.state.decisionMaker).toBe(-1);
  run(ints(scmOpcode('SET_CHAR_AREA_VISIBLE'),[1,3]),host.world);
  expect(host.state.area).toBe(3);
  const flag=new Uint8Array(9);const view=new DataView(flag.buffer);
  view.setUint16(0,scmOpcode('SET_CHAR_NEVER_TARGETTED'),true);flag[2]=1;view.setInt32(3,1,true);flag[7]=4;flag[8]=1;
  run(flag,host.world);
  expect(host.state.neverTargeted).toBe(true);
  run(ints(scmOpcode('SET_CURRENT_CHAR_WEAPON'),[1,24]),host.world);
  expect(host.state.weapon).toBe(24);
 });

 test('damage counts from the ped itself or from the car it rides in',()=>{
  const host=pedHost();
  const command=ints(scmOpcode('HAS_CHAR_BEEN_DAMAGED_BY_CHAR'),[1,2]);
  expect(run(command,host.world).condition).toBe(false);
  host.damage.set(1,{ped:2});
  expect(run(command,host.world).condition).toBe(true);
  host.damage.set(1,{vehicle:55});
  expect(run(command,host.world).condition).toBe(false);
  host.vehicles.set(2,55);
  expect(run(command,host.world).condition).toBe(true);
 });

 test('a warp into a car and a warp out to a point both reach the world',()=>{
  const host=pedHost();
  run(ints(scmOpcode('WARP_CHAR_INTO_CAR'),[1,70]),host.world);
  expect(host.state.warpedInto).toBe(70);
  const warp=new Uint8Array(7+15);const view=new DataView(warp.buffer);
  view.setUint16(0,scmOpcode('WARP_CHAR_FROM_CAR_TO_COORD'),true);warp[2]=1;view.setInt32(3,1,true);
  [4,5,6].forEach((value,k)=>{warp[7+k*5]=6;view.setFloat32(8+k*5,value,true);});
  run(warp,host.world);
  expect(host.state.warpedTo).toEqual({x:4,y:5,z:6});
 });

 test('the animation question and the speech gate answer from the world',()=>{
  const host=pedHost();
  const name='walk_civi';
  const ask=new Uint8Array(7+1+name.length+1);const view=new DataView(ask.buffer);
  view.setUint16(0,scmOpcode('IS_CHAR_PLAYING_ANIM'),true);ask[2]=1;view.setInt32(3,1,true);
  ask[7]=14;ask[8]=name.length;for(let k=0;k<name.length;k++)ask[9+k]=name.charCodeAt(k);
  expect(run(ask,host.world).condition).toBe(false);
  host.state.anim=name;
  expect(run(ask,host.world).condition).toBe(true);
  const shut=new Uint8Array(9);const shutView=new DataView(shut.buffer);
  shutView.setUint16(0,scmOpcode('SHUT_CHAR_UP_FOR_SCRIPTED_SPEECH'),true);shut[2]=1;shutView.setInt32(3,1,true);shut[7]=4;shut[8]=1;
  run(shut,host.world);
  expect(host.state.shutUp).toBe(true);
 });
});
