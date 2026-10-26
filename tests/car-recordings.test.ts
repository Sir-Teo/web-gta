import {describe,expect,test} from 'vitest';
import {openAsBlob} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {CAR_RECORDING_FRAME_BYTES,decodeCarRecordingFrames,findIndexWithFileNameNumber,findRecording,loadCarRecording,readCarRecording,readCarRecordingIndex,recordingFileNumber,type CarRecordingFrame,type CarRecordingVector} from '../src/assets/carRecordings';
import {readImgEntry} from '../src/assets/img';
import {ScmVehicleRecordings} from '../src/engine/ScmVehicleRecordings';
import {changeCarPlaybackToUseAI,currentFrameIndex,restoreInfoForMatrix,saveOrRetrieveDataForThisFrame,setRecordingToPointClosestToCoors,skipForwardInRecording,skipToEndAndStopPlaybackRecordedCar,startPlaybackRecordedCar,type CarRecordingMatrix,type CarRecordingPlaybackHost,type CarRecordingVehicle} from '../src/engine/carRecordingPlayback';

const archive=()=>openAsBlob('public/play/world/files/data/paths/carrec.img');
async function recording(fileNumber:number){
 const file=await archive(),index=await readCarRecordingIndex(file);
 return readCarRecording(file,findRecording(index,fileNumber)!);
}

describe('carrec.img',()=>{
 test('registers every .rrr in directory order under the number in its name',async()=>{
  const index=await readCarRecordingIndex(await archive());
  expect(index.length).toBe(426);
  expect(index.map(file=>file.streamingIndex)).toEqual(index.map((_,i)=>i));
  const numbers=index.map(file=>file.fileNumber);
  expect(numbers).toContain(706);expect(numbers).toContain(707);
  expect(numbers.slice(0,5)).toEqual([1,2,3,4,5]);expect(numbers.at(-1)).toBe(834);
  expect(new Set(numbers).size).toBe(numbers.length);
  expect(findIndexWithFileNameNumber(index,706)).toBe(394);
  // FindIndexWithFileNameNumber answers the first slot for a number nobody has; FindRecording tells them apart.
  expect(findIndexWithFileNameNumber(index,6)).toBe(0);
  expect(findRecording(index,6)).toBeUndefined();expect(findRecording(index,1)!.streamingIndex).toBe(0);
 });
 test('RegisterRecordingFile reads the number after carrec or CARREC, else 850',()=>{
  expect(recordingFileNumber('carrec001')).toBe(1);expect(recordingFileNumber('CARREC120')).toBe(120);
  expect(recordingFileNumber('Carrec7')).toBe(850);expect(recordingFileNumber('other')).toBe(850);
 });
 test('recording 706 loads pruned at the padding and smoothed',async()=>{
  const file=await archive(),entry=findRecording(await readCarRecordingIndex(file),706)!.entry;
  const raw=decodeCarRecordingFrames(await readImgEntry(file,entry));
  expect(raw.length).toBe(entry.length/CAR_RECORDING_FRAME_BYTES);expect(raw.length).toBe(128);
  const frames=await recording(706);
  expect(frames.length).toBe(115);
  expect(raw.slice(0,8).map(frame=>frame.time)).toEqual([0,204,408,612,817,1019,1258,1492]);
  // SmoothRecording: the first three and the last frame keep their times; the rest cascade.
  expect(frames.slice(0,8).map(frame=>frame.time)).toEqual([0,204,408,612,815,1036,1264,1484]);
  expect(frames.slice(-3).map(frame=>frame.time)).toEqual([24134,24342,24551]);
  const first=frames[0];
  expect(first.velocity[0]).toBeCloseTo(-1419/16383.5,6);expect(first.velocity[1]).toBeCloseTo(11/16383.5,6);expect(first.velocity[2]).toBeCloseTo(-6/16383.5,6);
  expect(first.right).toEqual([1/127,126/127,0].map(Math.fround));expect(first.top).toEqual([-126/127,1/127,0].map(Math.fround));
  expect(first.steer).toBe(0);expect(first.gas).toBe(Math.fround(0.34));expect(first.brake).toBe(0);expect(first.handbrake).toBe(false);
  expect(first.position[0]).toBeCloseTo(2431.6086,3);expect(first.position[1]).toBeCloseTo(-1254.0608,3);expect(first.position[2]).toBeCloseTo(23.5507,3);
  const last=frames[114];
  expect(last.velocity).toEqual([0,0,0]);expect(last.gas).toBe(0);
  expect(last.position[0]).toBeCloseTo(2300.959,3);expect(last.position[1]).toBeCloseTo(-1380.9451,3);expect(last.position[2]).toBeCloseTo(23.5693,3);
  expect((await recording(707)).length).toBe(147);
 });
 test('steering and reversing gas are signed bytes',async()=>{
  // Sweep every entry from one 2.3 MB snapshot; openAsBlob revalidates the disk file on each streamed slice.
  // The index and individual recording tests above retain the filesystem-backed Blob checks.
  const file=new Blob([await readFile('public/play/world/files/data/paths/carrec.img')]),index=await readCarRecordingIndex(file);let steer=[Infinity,-Infinity],gas=[Infinity,-Infinity];
  for(const entry of index)for(const frame of await readCarRecording(file,entry)){
   steer=[Math.min(steer[0],frame.steer),Math.max(steer[1],frame.steer)];gas=[Math.min(gas[0],frame.gas),Math.max(gas[1],frame.gas)];
  }
  expect(steer[0]).toBeLessThan(-0.5);expect(steer[1]).toBeGreaterThan(0.5);expect(Math.max(-steer[0],steer[1])).toBeLessThan(1);
  expect(gas[0]).toBeLessThan(0);expect(gas[1]).toBeLessThanOrEqual(1);
 });
});

const frame=(time:number,position:CarRecordingVector,extra:Partial<CarRecordingFrame>={}):CarRecordingFrame=>({time,velocity:[0,0,0],right:[1,0,0],top:[0,1,0],steer:0,gas:0,brake:0,handbrake:false,position,...extra});
function bytesOf(frames:CarRecordingFrame[],padding=0){
 const bytes=new Uint8Array((frames.length+padding)*32),view=new DataView(bytes.buffer);
 frames.forEach((f,i)=>{const at=i*32;view.setUint32(at,f.time,true);f.velocity.forEach((v,k)=>view.setInt16(at+4+k*2,Math.round(v*16383.5),true));
  f.right.forEach((v,k)=>view.setInt8(at+10+k,Math.round(v*127)));f.top.forEach((v,k)=>view.setInt8(at+13+k,Math.round(v*127)));
  view.setInt8(at+16,Math.round(f.steer*20));view.setInt8(at+17,Math.round(f.gas*100));view.setInt8(at+18,Math.round(f.brake*100));view.setUint8(at+19,f.handbrake?1:0);
  f.position.forEach((v,k)=>view.setFloat32(at+20+k*4,v,true));});
 return bytes;
}
interface TestVehicle extends CarRecordingVehicle {matrix:CarRecordingMatrix;moveSpeed:CarRecordingVector;steer:number;gas:number;brake:number;handbrake:boolean;recordingId:number;collidable:boolean;moved:number;status?:string}
function testVehicle(position:CarRecordingVector=[0,0,0]):TestVehicle{
 const v:TestVehicle={matrix:{right:[1,0,0],forward:[0,1,0],up:[0,0,1],position},moveSpeed:[0,0,0],steer:0,gas:0,brake:0,handbrake:false,recordingId:-1,collidable:true,moved:0,
  getMatrix:()=>v.matrix,setMatrix:m=>{v.matrix=m;},getMoveSpeed:()=>v.moveSpeed,setMoveSpeed:s=>{v.moveSpeed=s;},resetTurnSpeed(){},
  setSteerAngle:a=>{v.steer=a;},setGasPedal:p=>{v.gas=p;},setBrakePedal:p=>{v.brake=p;},setHandbrake:on=>{v.handbrake=on;},
  setRecordingId:id=>{v.recordingId=id;},setCollidable:on=>{v.collidable=on;},onPlaybackMoved:()=>{v.moved++;},setStatusPhysics:()=>{v.status='physics';}};
 return v;
}
function host(files:Record<number,CarRecordingFrame[]>,vehicles:Record<number,TestVehicle>):CarRecordingPlaybackHost{
 const recordings=new ScmVehicleRecordings();
 for(const n of Object.keys(files)){recordings.requestRecordingFile(Number(n));recordings.loadRecordingFile(Number(n));}
 return {recordings,frames:n=>files[n],vehicle:h=>vehicles[h]};
}

describe('playback',()=>{
 test('a synthetic recording round-trips through Load',()=>{
  const frames=loadCarRecording(bytesOf([frame(0,[0,0,0],{steer:-0.5,gas:-0.3}),frame(100,[10,0,0]),frame(200,[20,0,0])],3));
  expect(frames.length).toBe(3);expect(frames[0].steer).toBe(Math.fround(-0.5));expect(frames[0].gas).toBe(Math.fround(-0.3));
 });
 test('the car sits on the frame for the clock and moves toward the next',async()=>{
  const frames=await recording(706),car=testVehicle(),h=host({706:frames},{7:car});
  const slot=startPlaybackRecordedCar(h,7,706,false,false);
  expect(car.recordingId).toBe(slot);expect(car.collidable).toBe(false);
  // 1,200 ms over the last four frames at speed one: the clock runs on 300 ms, between frames 1 (204) and 2 (408).
  saveOrRetrieveDataForThisFrame(h,1200);
  const playback=h.recordings.playbacks[slot]!;
  expect(playback.runningTime).toBe(300);expect(currentFrameIndex(playback)).toBe(1);expect(playback.index).toBe(32);
  const t=(300-204)/(408-204);
  for(let k=0;k<3;k++){
   expect(car.matrix.position[k]).toBeCloseTo(frames[1].position[k]*(1-t)+frames[2].position[k]*t,3);
   expect(car.moveSpeed[k]).toBeCloseTo(frames[2].velocity[k]*t,6);
  }
  expect(car.gas).toBe(frames[1].gas);expect(car.moved).toBe(1);
  const up=restoreInfoForMatrix(frames[1]).up;expect(up[2]).toBeGreaterThan(0.9);
  // Speed two doubles the step.
  h.recordings.setSpeed(7,2);saveOrRetrieveDataForThisFrame(h,1200);
  expect(playback.runningTime).toBe(900);expect(frames[currentFrameIndex(playback)].time).toBeLessThanOrEqual(900);expect(frames[currentFrameIndex(playback)+1].time).toBeGreaterThan(900);
 });
 test('a paused playback keeps its clock and holds the car where the recording has it (iOS 0x1001c6244)',()=>{
  const frames=[frame(0,[0,0,0]),frame(100,[10,0,0]),frame(200,[20,0,0])];
  const car=testVehicle(),h=host({1:frames},{1:car});startPlaybackRecordedCar(h,1,1,false,false);
  saveOrRetrieveDataForThisFrame(h,4*50);
  const playback=h.recordings.playbacks[0]!;expect(playback.runningTime).toBe(50);
  h.recordings.setPaused(1,true);
  for(let i=0;i<5;i++)saveOrRetrieveDataForThisFrame(h,4*50);
  expect(playback.runningTime).toBe(50);expect(car.matrix.position[0]).toBeCloseTo(5,6);
  expect(h.recordings.isPlaybackGoingOn(1)).toBe(true);
  h.recordings.setPaused(1,false);saveOrRetrieveDataForThisFrame(h,4*50);
  expect(playback.runningTime).toBe(100);
 });
 test('interpolation between two frames',()=>{
  const frames=[frame(0,[0,0,0],{gas:1}),frame(100,[10,20,0],{velocity:[0.5,0,0],right:[0,1,0],top:[-1,0,0]}),frame(200,[20,20,0])];
  const car=testVehicle(),h=host({1:frames},{1:car});startPlaybackRecordedCar(h,1,1,false,false);
  saveOrRetrieveDataForThisFrame(h,4*25);
  expect(car.matrix.position).toEqual([2.5,5,0]);expect(car.moveSpeed).toEqual([0.125,0,0]);
  expect(car.matrix.right).toEqual([0.75,0.25,0]);expect(car.matrix.forward).toEqual([-0.25,0.75,0]);expect(car.matrix.up).toEqual([0,0,1]);
  expect(car.gas).toBe(1);expect(car.handbrake).toBe(false);
 });
 test('a looped playback starts over at the end and a plain one stops',()=>{
  const frames=[frame(0,[0,0,0]),frame(100,[10,0,0]),frame(200,[20,0,0])];
  const looped=testVehicle(),plain=testVehicle(),h=host({1:frames},{1:looped,2:plain});
  startPlaybackRecordedCar(h,1,1,false,true);startPlaybackRecordedCar(h,2,1,false,false);
  expect(h.recordings.references(1)).toBe(2);
  saveOrRetrieveDataForThisFrame(h,4*150);
  expect(looped.matrix.position[0]).toBeCloseTo(15);expect(plain.matrix.position[0]).toBeCloseTo(15);
  saveOrRetrieveDataForThisFrame(h,4*100);
  // 250 ms is past the last frame: the car is left where it was that frame.
  const loop=h.recordings.playbacks[0]!;
  expect(loop.runningTime).toBe(0);expect(loop.index).toBe(0);expect(looped.matrix.position[0]).toBeCloseTo(15);
  expect(h.recordings.isPlaybackGoingOn(2)).toBe(false);expect(plain.recordingId).toBe(-1);expect(h.recordings.references(1)).toBe(1);
  saveOrRetrieveDataForThisFrame(h,4*50);expect(looped.matrix.position[0]).toBeCloseTo(5);
 });
 test('a missing or burnt car and a car-AI playback',()=>{
  const frames=[frame(0,[0,0,0]),frame(100,[10,0,0])];
  const burnt=testVehicle(),ai=testVehicle([9,0,0]),h=host({1:frames},{1:burnt,3:ai});
  startPlaybackRecordedCar(h,1,1,false,false);startPlaybackRecordedCar(h,2,1,false,false);startPlaybackRecordedCar(h,3,1,true,false);
  burnt.renderScorched=true;saveOrRetrieveDataForThisFrame(h,100);
  expect(h.recordings.playing).toBe(1);
  const playback=h.recordings.playbacks[2]!;expect(playback.runningTime).toBe(0);expect(playback.index).toBe(1);
  expect(ai.matrix.position).toEqual([9,0,0]);
  saveOrRetrieveDataForThisFrame(h,100,true);expect(playback.runningTime).toBe(0);
 });
 test('SetRecordingToPointClosestToCoors, ChangeCarPlaybackToUseAI and the skips',()=>{
  const frames=[frame(0,[0,0,0]),frame(100,[10,0,0]),frame(200,[20,0,0]),frame(300,[30,0,0],{gas:0.5}),frame(400,[40,0,0])];
  const car=testVehicle(),h=host({1:frames},{1:car});startPlaybackRecordedCar(h,1,1,false,false);
  const playback=h.recordings.playbacks[0]!;
  setRecordingToPointClosestToCoors(playback,frames,[21,1,0]);expect(playback.index).toBe(2);
  playback.index=0;
  skipForwardInRecording(h,1,25);
  // Walks on to frame 3 (30 m), then backs off to frame 2 (20 m); the index is not moved.
  expect(playback.runningTime).toBe(200);expect(playback.index).toBe(0);
  car.matrix.position=[31,0,0];changeCarPlaybackToUseAI(h,1);
  expect(playback.useCarAI).toBe(true);expect(playback.index).toBe(3);expect(car.status).toBe('physics');
  skipToEndAndStopPlaybackRecordedCar(h,1);
  expect(car.matrix.position).toEqual([40,0,0]);expect(car.collidable).toBe(false);expect(car.recordingId).toBe(-1);
  expect(h.recordings.isPlaybackGoingOn(1)).toBe(false);expect(h.recordings.references(1)).toBe(0);
 });
});
