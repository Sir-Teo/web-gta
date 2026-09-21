import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {TOTAL_VEHICLE_RECORDS} from '../src/engine/ScmVehicleRecordings';
import {scmOpcode} from '../src/engine/scmOpcodes';

function run(bytes:Uint8Array,game:ScmGameState){
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
function build(opcode:number,values:number[],floats:number[]=[]){
 const bytes=new Uint8Array(2+values.length*5+floats.length*5);
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 let at=2;
 for(const value of values){bytes[at]=1;view.setInt32(at+1,value,true);at+=5;}
 for(const value of floats){bytes[at]=6;view.setFloat32(at+1,value,true);at+=5;}
 return bytes;
}

describe('the recordings a script plays a car along',()=>{
 test('a requested file is not loaded until a host says so',()=>{
  const game=new ScmGameState();
  run(build(scmOpcode('REQUEST_CAR_RECORDING'),[101]),game);
  const asked=run(build(scmOpcode('HAS_CAR_RECORDING_BEEN_LOADED'),[101]),game);
  expect(asked.condition).toBe(false);
  game.vehicleRecordings.loadRecordingFile(101);
  const ready=run(build(scmOpcode('HAS_CAR_RECORDING_BEEN_LOADED'),[101]),game);
  expect(ready.condition).toBe(true);
 });

 test('playback takes a slot, holds the file, and gives both back when it stops',()=>{
  const game=new ScmGameState();
  game.vehicleRecordings.loadRecordingFile(101);
  run(build(scmOpcode('START_PLAYBACK_RECORDED_CAR'),[7,101]),game);
  expect(game.vehicleRecordings.playing).toBe(1);
  expect(game.vehicleRecordings.references(101)).toBe(1);
  const going=run(build(scmOpcode('IS_PLAYBACK_GOING_ON_FOR_CAR'),[7]),game);
  expect(going.condition).toBe(true);
  // A held file is not removed.
  run(build(scmOpcode('REMOVE_CAR_RECORDING'),[101]),game);
  expect(game.vehicleRecordings.hasRecordingFileBeenLoaded(101)).toBe(true);
  run(build(scmOpcode('STOP_PLAYBACK_RECORDED_CAR'),[7]),game);
  expect(game.vehicleRecordings.playing).toBe(0);
  expect(game.vehicleRecordings.references(101)).toBe(0);
  run(build(scmOpcode('REMOVE_CAR_RECORDING'),[101]),game);
  expect(game.vehicleRecordings.hasRecordingFileBeenLoaded(101)).toBe(false);
 });

 test('the three start forms differ only in the car AI and the loop',()=>{
  const game=new ScmGameState();
  game.vehicleRecordings.loadRecordingFile(5);
  run(build(scmOpcode('START_PLAYBACK_RECORDED_CAR'),[1,5]),game);
  run(build(scmOpcode('START_PLAYBACK_RECORDED_CAR_USING_AI'),[2,5]),game);
  run(build(scmOpcode('START_PLAYBACK_RECORDED_CAR_LOOPED'),[3,5]),game);
  const [first,second,third]=game.vehicleRecordings.playbacks;
  expect(first).toMatchObject({vehicle:1,useCarAI:false,looped:false,speed:1,index:0,paused:false});
  expect(second).toMatchObject({vehicle:2,useCarAI:true,looped:false});
  expect(third).toMatchObject({vehicle:3,useCarAI:false,looped:true});
 });

 test('pausing and the speed reach the car that is playing, and nothing else',()=>{
  const game=new ScmGameState();
  game.vehicleRecordings.loadRecordingFile(5);
  run(build(scmOpcode('START_PLAYBACK_RECORDED_CAR'),[4,5]),game);
  run(build(scmOpcode('PAUSE_PLAYBACK_RECORDED_CAR'),[4]),game);
  expect(game.vehicleRecordings.playbacks[0]!.paused).toBe(true);
  run(build(scmOpcode('UNPAUSE_PLAYBACK_RECORDED_CAR'),[4]),game);
  expect(game.vehicleRecordings.playbacks[0]!.paused).toBe(false);
  run(build(scmOpcode('SET_PLAYBACK_SPEED'),[4],[2.5]),game);
  expect(game.vehicleRecordings.playbacks[0]!.speed).toBe(2.5);
  // A car with no playback is left alone rather than failing.
  run(build(scmOpcode('STOP_PLAYBACK_RECORDED_CAR'),[99]),game);
  expect(game.vehicleRecordings.playing).toBe(1);
 });

 test('the sixteen slots fill up',()=>{
  const game=new ScmGameState();
  game.vehicleRecordings.loadRecordingFile(5);
  for(let i=0;i<TOTAL_VEHICLE_RECORDS;i++)game.vehicleRecordings.startPlayback(i,5,false,false);
  expect(game.vehicleRecordings.playing).toBe(TOTAL_VEHICLE_RECORDS);
  expect(()=>game.vehicleRecordings.startPlayback(99,5,false,false)).toThrow('slot is playing');
 });
});
