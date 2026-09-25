import {describe,expect,test} from 'vitest';
import {openAsBlob} from 'node:fs';
import {ScriptCarRecordingStore} from '../src/simulation/scriptCarRecordings';
import {nativeMatrixOf,rotationFromNativeRows} from '../src/simulation/recordingBody';
import {ScmEntityPending,ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';
import type {CarRecordingVehicle} from '../src/engine/carRecordingPlayback';

describe('the car recordings’ streaming',()=>{
 test('a requested file is read from carrec.img and reported loaded; asked again, it is loaded again from the cache',async()=>{
  let fetches=0;const store=new ScriptCarRecordingStore(async()=>{fetches++;return openAsBlob('public/play/world/files/data/paths/carrec.img');});
  const loaded:number[]=[];
  await new Promise<void>(resolve=>store.request(706,n=>{loaded.push(n);resolve();}));
  expect(loaded).toEqual([706]);expect(store.framesOf(706)?.length).toBe(115);
  await new Promise<void>(resolve=>store.request(706,n=>{loaded.push(n);resolve();}));
  expect(loaded).toEqual([706,706]);expect(fetches).toBe(1);
  // A number no entry has streams slot 0, as FindIndexWithFileNameNumber answers.
  await new Promise<void>(resolve=>store.request(6,()=>resolve()));
  expect(store.framesOf(6)).toBe(store.framesOf(1));
 });
});

describe('a vehicle body’s native rows',()=>{
 test('rows made into a rotation read back the same, right-handed',()=>{
  const c=Math.cos(.7),s=Math.sin(.7);
  // Heading .7 rad from north, nose tipped up a little.
  const forward=[-s*.98,c*.98,.2],right=[c,s,0];
  const q=rotationFromNativeRows(right,forward),m=nativeMatrixOf(q,{x:1,y:2,z:3});
  const len=Math.hypot(...forward);
  forward.forEach((v,i)=>expect(m.forward[i]).toBeCloseTo(v/len,5));
  expect(m.position).toEqual([1,-3,2]);
  const up=[m.right[1]*m.forward[2]-m.right[2]*m.forward[1],m.right[2]*m.forward[0]-m.right[0]*m.forward[2],m.right[0]*m.forward[1]-m.right[1]*m.forward[0]];
  up.forEach((v,i)=>expect(m.up[i]).toBeCloseTo(v,5));
  expect(m.up[2]).toBeGreaterThan(.9);
 });
});

function run(game:ScmGameState,world:Partial<ScmWorldCommands>,opcode:number,ints:number[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const v of ints){const b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,v,true);out.push(1,...b);}
 const space=new Uint8Array(256);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
describe('the playback commands',()=>{
 test('START_PLAYBACK_RECORDED_CAR takes the car’s side through the host; STOP gives it back',()=>{
  const game=new ScmGameState(),calls:string[]=[];
  const car:CarRecordingVehicle={getMatrix:()=>({right:[1,0,0],forward:[0,1,0],up:[0,0,1],position:[0,0,0]}),setMatrix(){},getMoveSpeed:()=>[0,0,0],setMoveSpeed(){},resetTurnSpeed(){},
   setSteerAngle(){},setGasPedal(){},setBrakePedal(){},setHandbrake(){},
   setDisableCollisionForce:on=>{calls.push(`force ${on}`);},setCollidable:on=>{calls.push(`collidable ${on}`);},setRecordingId:slot=>{calls.push(`slot ${slot}`);}};
  game.carRecordingVehicles={frames:()=>[],vehicle:h=>h===7?car:undefined};
  run(game,{},scmOpcode('START_PLAYBACK_RECORDED_CAR'),[7,706]);
  expect(game.vehicleRecordings.isPlaybackGoingOn(7)).toBe(true);
  expect(calls).toEqual(['force true','collidable false','slot 0']);
  run(game,{},scmOpcode('STOP_PLAYBACK_RECORDED_CAR'),[7]);
  expect(game.vehicleRecordings.isPlaybackGoingOn(7)).toBe(false);
  expect(calls.slice(3)).toEqual(['slot -1','force false']);
 });
 test('a car still being built holds the start until it is there',()=>{
  const game=new ScmGameState();
  const thread=run(game,{awaitVehicle:()=>{throw new ScmEntityPending('vehicle 7');}},scmOpcode('START_PLAYBACK_RECORDED_CAR'),[7,706]);
  expect(game.vehicleRecordings.isPlaybackGoingOn(7)).toBe(false);expect(thread.ip).toBe(0);
 });
});
