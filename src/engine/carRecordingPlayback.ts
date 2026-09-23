import {CAR_RECORDING_FRAME_BYTES,type CarRecordingFrame,type CarRecordingVector as V3} from '../assets/carRecordings';
import type {ScmPlayback,ScmVehicleRecordings} from './ScmVehicleRecordings';
/* A car driven along its recording, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166
 * (`VehicleRecording.cpp`, all registered reversed): SaveOrRetrieveDataForThisFrame 0x45A610, RestoreInfoForMatrix
 * 0x459960, RestoreInfoForCar 0x459A30, InterpolateInfoForCar 0x459B30 (with CMatrix Lerp, Core/Matrix.cpp),
 * SkipForwardInRecording 0x459D10, SetRecordingToPointClosestToCoors 0x45A1E0, SkipToEndAndStopPlaybackRecordedCar
 * 0x45A4A0, ChangeCarPlaybackToUseAI 0x45A360, and the vehicle half of StartPlaybackRecordedCar 0x45A980 and
 * StopPlaybackWithIndex 0x459440. The slots themselves are ScmVehicleRecordings'; `index` there is PlaybackIndex, a byte
 * offset (frame * 0x20) exactly as the source keeps it. Everything is native (Z up); the browser mapping is the host's.
 *
 * Not verifiable from the reversed source, so not modelled:
 * - bPlaybackPaused is set by PAUSE_PLAYBACK_RECORDED_CAR but nothing reversed reads it: SaveOrRetrieveDataForThisFrame
 *   advances a paused playback like any other, RestoreInfoForCar's `pause` argument is never passed true, and
 *   IsPlaybackPausedForCar always answers false. The port follows that.
 * - A playback using car AI (bUseCarAI) is skipped here; MISSION_FOLLOW_RECORDED_PATH's steering along the frames lives
 *   in CCarCtrl/CCarAI code that is not reversed, so how it reads PlaybackIndex is unknown.
 * - SetRecordingToPointClosestToCoors stores the frame number itself in PlaybackIndex, not frame * 0x20; kept as is.
 * - The vehicle side effects the source calls (ProcessControlCollisionCheck, RemoveAndAdd, UpdateRwMatrix/Frame, a
 *   train's FindPositionOnTrackFromCoors, MarkSurroundingEntitiesForCollisionWithTrain, SetCarMission, SetStatus) are
 *   the host's, reached through the optional hooks on CarRecordingVehicle. */
/** CMatrix's four rows as CVehicleRecording touches them. */
export interface CarRecordingMatrix {right:V3;forward:V3;up:V3;position:V3}
/** The CVehicle members recordings read and write. */
export interface CarRecordingVehicle {
 getMatrix():CarRecordingMatrix;setMatrix(matrix:CarRecordingMatrix):void;
 /** m_vecMoveSpeed, units per 50 fps frame. */
 getMoveSpeed():V3;setMoveSpeed(speed:V3):void;
 /** CPhysical::ResetTurnSpeed. */
 resetTurnSpeed():void;
 /** m_fSteerAngle, m_GasPedal, m_BrakePedal, vehicleFlags.bIsHandbrakeOn. */
 setSteerAngle(angle:number):void;setGasPedal(power:number):void;setBrakePedal(power:number):void;setHandbrake(on:boolean):void;
 /** physicalFlags.bRenderScorched: a burnt-out car stops its playback. */
 renderScorched?:boolean;
 /** CVehicle::ProcessControlCollisionCheck(false). */
 processControlCollisionCheck?():void;
 /** After a playback frame moved the car: a train's FindPositionOnTrackFromCoors, ProcessControlCollisionCheck(false),
  * RemoveAndAdd, UpdateRwMatrix, UpdateRwFrame and MarkSurroundingEntitiesForCollisionWithTrain(position, 5, car, true). */
 onPlaybackMoved?():void;
 /** physicalFlags.bDisableCollisionForce and bCollidable. */
 setDisableCollisionForce?(on:boolean):void;setCollidable?(on:boolean):void;
 /** m_autoPilot.m_vehicleRecordingId: the playback slot, -1 for none. */
 setRecordingId?(slot:number):void;
 /** m_autoPilot.SetCarMission(MISSION_FOLLOW_RECORDED_PATH). */
 followRecordedPath?():void;
 /** SetStatus(STATUS_PHYSICS). */
 setStatusPhysics?():void;
}
export interface CarRecordingPlaybackHost {
 recordings:ScmVehicleRecordings;
 /** The loaded frames of a file (CPath::m_pData), undefined while it is not loaded. */
 frames(fileNumber:number):readonly CarRecordingFrame[]|undefined;
 /** The car behind a script vehicle handle, undefined once it is gone. */
 vehicle(handle:number):CarRecordingVehicle|undefined;
}
const f32=Math.fround;
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const lerp=(a:V3,b:V3,t:number):V3=>[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t];
/** CVehicleRecording::GetCurrentFrameIndex: PlaybackIndex / sizeof(CVehicleStateEachFrame). */
export function currentFrameIndex(playback:ScmPlayback){return Math.trunc(playback.index/CAR_RECORDING_FRAME_BYTES);}
/** RestoreInfoForMatrix 0x459960: right and forward from the frame, up = right x forward, the frame's position. */
export function restoreInfoForMatrix(frame:CarRecordingFrame):CarRecordingMatrix{
 const right:V3=[...frame.right],forward:V3=[...frame.top];
 return {right,forward,up:cross(right,forward),position:[...frame.position]};
}
/** CMatrix Lerp: every row, the position included, scaled by 1 - t and t and summed. */
export function lerpMatrix(from:CarRecordingMatrix,to:CarRecordingMatrix,t:number):CarRecordingMatrix{
 return {right:lerp(from.right,to.right,t),forward:lerp(from.forward,to.forward,t),up:lerp(from.up,to.up,t),position:lerp(from.position,to.position,t)};
}
/** RestoreInfoForCar 0x459A30. The move speed is left alone unless paused. */
export function restoreInfoForCar(vehicle:CarRecordingVehicle,frame:CarRecordingFrame,pause:boolean){
 vehicle.setMatrix(restoreInfoForMatrix(frame));
 vehicle.resetTurnSpeed();
 vehicle.setSteerAngle(frame.steer);vehicle.setGasPedal(frame.gas);vehicle.setBrakePedal(frame.brake);
 vehicle.setHandbrake(pause||frame.handbrake);
 if(pause){vehicle.setSteerAngle(0);vehicle.setGasPedal(0);vehicle.setBrakePedal(0);vehicle.setMoveSpeed([0,0,0]);}
}
/** InterpolateInfoForCar 0x459B30: the matrix and move speed move `t` of the way from where they are to the frame. */
export function interpolateInfoForCar(vehicle:CarRecordingVehicle,frame:CarRecordingFrame,t:number){
 vehicle.setMatrix(lerpMatrix(vehicle.getMatrix(),restoreInfoForMatrix(frame),t));
 vehicle.setMoveSpeed(lerp(vehicle.getMoveSpeed(),frame.velocity,t));
}
/** StopPlaybackWithIndex 0x459440: the car forgets its slot and gets its collision force back; the slot empties. */
export function stopPlaybackWithIndex(host:CarRecordingPlaybackHost,slot:number){
 const playback=host.recordings.playbacks[slot];
 const vehicle=playback&&host.vehicle(playback.vehicle);
 if(vehicle){vehicle.setRecordingId?.(-1);vehicle.setDisableCollisionForce?.(false);}
 host.recordings.stopPlaybackWithIndex(slot);
}
/** StopPlaybackRecordedCar 0x45A280. */
export function stopPlaybackRecordedCar(host:CarRecordingPlaybackHost,handle:number){
 const slot=host.recordings.findVehicleRecordingIndex(handle);
 if(slot!==-1)stopPlaybackWithIndex(host,slot);
}
/** SetRecordingToPointClosestToCoors 0x45A1E0: the frame nearest `position` (3D, within 1,000,000), stored in
 * PlaybackIndex as the frame number itself, as the reversed source writes it. */
export function setRecordingToPointClosestToCoors(playback:ScmPlayback,frames:readonly CarRecordingFrame[],position:V3){
 let minDist=1_000_000;
 frames.forEach((frame,i)=>{
  const d=Math.hypot(frame.position[0]-position[0],frame.position[1]-position[1],frame.position[2]-position[2]);
  if(d<minDist){playback.index=i;minDist=d;}
 });
}
/** StartPlaybackRecordedCar 0x45A980: the slot (ScmVehicleRecordings.startPlayback), then the car. With car AI it
 * follows the recorded path from its nearest frame; without, collisions stop pushing it and it stops colliding. */
export function startPlaybackRecordedCar(host:CarRecordingPlaybackHost,handle:number,fileNumber:number,useCarAI:boolean,looped:boolean){
 const slot=host.recordings.startPlayback(handle,fileNumber,useCarAI,looped),vehicle=host.vehicle(handle);
 if(vehicle){
  if(useCarAI){vehicle.followRecordedPath?.();setRecordingToPointClosestToCoors(host.recordings.playbacks[slot]!,host.frames(fileNumber)??[],vehicle.getMatrix().position);}
  else{vehicle.setDisableCollisionForce?.(true);vehicle.setCollidable?.(false);}
  vehicle.setRecordingId?.(slot);
 }
 return slot;
}
/** SaveOrRetrieveDataForThisFrame 0x45A610, once per CWorld::Process. `timeSpanMs` is CTimer::GetTimeInMS() -
 * m_snPPPPreviousTimeInMilliseconds, the last four frames, hence the quarter. Each playback not using car AI runs its
 * clock on by that times PlaybackSpeed, finds the frame for the clock, puts the car on it and moves it toward the next;
 * on the last frame a looped playback starts over (the car is not moved that frame) and any other stops. */
export function saveOrRetrieveDataForThisFrame(host:CarRecordingPlaybackHost,timeSpanMs:number,replayPlayback=false){
 if(replayPlayback)return;
 host.recordings.playbacks.forEach((playback,slot)=>{
  if(!playback||host.recordings.playbacks[slot]!==playback)return;
  const vehicle=host.vehicle(playback.vehicle);
  if(!vehicle||vehicle.renderScorched){stopPlaybackWithIndex(host,slot);return;}
  if(playback.useCarAI)return;
  playback.runningTime=f32(playback.runningTime+f32(f32(f32(timeSpanMs>>>0)*playback.speed)/4));
  const frames=host.frames(playback.fileNumber)??[],start=currentFrameIndex(playback);
  let current=start;
  // The source binds `next` to frames[start + 1] once, so the walk runs to the end whenever that frame is behind the
  // clock and the second walk brings it back to the last frame not after the clock.
  const nextTime=frames[start+1]?.time;
  while(current+1<frames.length&&nextTime!<playback.runningTime)current++;
  while(current>start&&frames[current].time>playback.runningTime)current--;
  playback.index=current*CAR_RECORDING_FRAME_BYTES;
  if(current+1<frames.length){
   const frame=frames[current],next=frames[current+1];
   restoreInfoForCar(vehicle,frame,false);
   interpolateInfoForCar(vehicle,next,f32(f32(playback.runningTime-f32(frame.time))/f32((next.time-frame.time)>>>0)));
   vehicle.onPlaybackMoved?.();
  }else if(playback.looped){playback.runningTime=0;playback.index=0;}
  else stopPlaybackRecordedCar(host,playback.vehicle);
 });
}
/** SkipForwardInRecording 0x459D10 (unused by the game; the source notes it is untested): walk the frames on from the
 * current one until their 2D path length reaches `distance`, back off to not beyond it (never below frame 1), and set
 * the clock to that frame. PlaybackIndex is not moved. A car-AI playback is also put on the frame. The original reads
 * out of bounds for a car with no playback; the reversed source, and this, do nothing. */
export function skipForwardInRecording(host:CarRecordingPlaybackHost,handle:number,distance:number){
 const slot=host.recordings.findVehicleRecordingIndex(handle);
 if(slot===-1)return;
 const playback=host.recordings.playbacks[slot]!,frames=host.frames(playback.fileNumber)??[];
 const d2=(a:CarRecordingFrame,b:CarRecordingFrame)=>Math.hypot(b.position[0]-a.position[0],b.position[1]-a.position[1]);
 let index=currentFrameIndex(playback),pace=0;
 for(;pace<distance&&index+1<frames.length;index++)pace+=d2(frames[index],frames[index+1]);
 for(;pace>distance&&index>1;index--)pace-=d2(frames[index],frames[index-1]);
 if(!frames[index])return;
 playback.runningTime=f32(frames[index].time);
 const vehicle=host.vehicle(handle);
 if(playback.useCarAI&&vehicle){restoreInfoForCar(vehicle,frames[index],false);vehicle.processControlCollisionCheck?.();}
}
/** SkipToEndAndStopPlaybackRecordedCar 0x45A4A0 (unused by the game): the car stops colliding, is put on the last
 * frame, and the slot empties. Unlike StopPlaybackWithIndex its collision force is left as it was. */
export function skipToEndAndStopPlaybackRecordedCar(host:CarRecordingPlaybackHost,handle:number){
 const slot=host.recordings.findVehicleRecordingIndex(handle);
 if(slot===-1)return;
 const playback=host.recordings.playbacks[slot]!,frames=host.frames(playback.fileNumber)??[],vehicle=host.vehicle(handle);
 if(vehicle&&frames.length){vehicle.setCollidable?.(false);restoreInfoForCar(vehicle,frames[frames.length-1],false);vehicle.processControlCollisionCheck?.();}
 vehicle?.setRecordingId?.(-1);
 host.recordings.stopPlaybackWithIndex(slot);
}
/** ChangeCarPlaybackToUseAI 0x45A360: the playback hands the car to its autopilot along the recorded path, from the
 * frame nearest where the car is, and the car is a physical one again. */
export function changeCarPlaybackToUseAI(host:CarRecordingPlaybackHost,handle:number){
 const slot=host.recordings.findVehicleRecordingIndex(handle),vehicle=host.vehicle(handle);
 if(slot===-1||!vehicle)return;
 const playback=host.recordings.playbacks[slot]!;
 playback.useCarAI=true;
 vehicle.followRecordedPath?.();
 setRecordingToPointClosestToCoors(playback,host.frames(playback.fileNumber)??[],vehicle.getMatrix().position);
 vehicle.setDisableCollisionForce?.(false);
 vehicle.processControlCollisionCheck?.();
 vehicle.setStatusPhysics?.();
}
