import {requireAsset} from '../assets/binary';
/* CVehicleRecording's script-facing half, pinned gta-reversed ead3051 (`VehicleRecording.cpp`:
 * `RequestRecordingFile` 0x45A020, `HasRecordingFileBeenLoaded` 0x45A060, `RemoveRecordingFile` 0x45A0A0,
 * `StartPlaybackRecordedCar` 0x45A980, `StopPlaybackRecordedCar` 0x45A280, `StopPlaybackWithIndex` 0x459440,
 * `PausePlaybackRecordedCar` 0x459740 and `SetPlaybackSpeed` 0x459660, all reversed): the recorded paths a
 * mission plays a car along. Reading the file and driving the car are the host's; this is the bookkeeping. */
/** CVehicleRecording::TOTAL_VEHICLE_RECORDS: sixteen cars can play a recording at once. */
export const TOTAL_VEHICLE_RECORDS=16;
export interface ScmRecordingFile {
 /** The number the script names the file by. */
 fileNumber:number;
 /** Whether the streamer has the data, and how many playbacks hold it. */
 loaded:boolean;references:number;
}
export interface ScmPlayback {
 vehicle:number;fileNumber:number;useCarAI:boolean;looped:boolean;
 /** PlaybackIndex: a byte offset into the recording (frame * 0x20), as the source keeps it; see carRecordingPlayback.ts. */
 index:number;
 /** PlaybackRunningTime (ms into the recording) and PlaybackSpeed. */
 runningTime:number;speed:number;paused:boolean;
}
export class ScmVehicleRecordings {
 private files:ScmRecordingFile[]=[];
 /** The sixteen playback slots, empty where nothing is going on. */
 readonly playbacks:(ScmPlayback|undefined)[]=Array(TOTAL_VEHICLE_RECORDS).fill(undefined);
 /** CVehicleRecording::FindRecording by the number the script uses. */
 private find(fileNumber:number){return this.files.find(file=>file.fileNumber===fileNumber);}
 /** REQUEST_CAR_RECORDING: the streamer is asked for the file and the slot starts empty. A host loads it. */
 requestRecordingFile(fileNumber:number){
  requireAsset(Number.isInteger(fileNumber),'Invalid recording file number.');
  let file=this.find(fileNumber);
  if(file){file.loaded=false;file.references=0;}
  else{file={fileNumber,loaded:false,references:0};this.files.push(file);}
  this.onRequest?.(fileNumber);
  return file;
 }
 /** CStreaming::RequestModel for the file's slot: the host streams it and calls loadRecordingFile. */
 onRequest?:(fileNumber:number)=>void;
 /** What a host calls once it has the data. */
 loadRecordingFile(fileNumber:number){const file=this.find(fileNumber)??this.requestRecordingFile(fileNumber);file.loaded=true;}
 /** HAS_CAR_RECORDING_BEEN_LOADED: the file is known and its data is there. */
 hasRecordingFileBeenLoaded(fileNumber:number){return !!this.find(fileNumber)?.loaded;}
 /** REMOVE_CAR_RECORDING: a loaded file with nothing holding it goes; one still in use stays. */
 removeRecordingFile(fileNumber:number){
  const file=this.find(fileNumber);
  if(file&&file.loaded&&file.references===0){file.loaded=false;}
 }
 references(fileNumber:number){return this.find(fileNumber)?.references??0;}
 /** START_PLAYBACK_RECORDED_CAR: the first idle slot takes the car, at speed one from the start, and the file
  * gains a reference. The source reads the first inactive slot without checking there is one. */
 startPlayback(vehicle:number,fileNumber:number,useCarAI:boolean,looped:boolean){
  const slot=this.playbacks.findIndex(playback=>!playback);
  requireAsset(slot>=0,'Every vehicle recording slot is playing.');
  this.playbacks[slot]={vehicle,fileNumber,useCarAI,looped,index:0,runningTime:0,speed:1,paused:false};
  const file=this.find(fileNumber);
  if(file)file.references++;
  return slot;
 }
 private slotOf(vehicle:number){return this.playbacks.findIndex(playback=>playback?.vehicle===vehicle);}
 /** CVehicleRecording::FindVehicleRecordingIndex: the car's playback slot, or -1. */
 findVehicleRecordingIndex(vehicle:number){return this.slotOf(vehicle);}
 /** IS_PLAYBACK_GOING_ON_FOR_CAR. */
 isPlaybackGoingOn(vehicle:number){return this.slotOf(vehicle)>=0;}
 /** STOP_PLAYBACK_RECORDED_CAR, which does nothing for a car that is not playing one. */
 stopPlayback(vehicle:number){
  const slot=this.slotOf(vehicle);
  if(slot>=0)this.stopPlaybackWithIndex(slot);
 }
 /** CVehicleRecording::StopPlaybackWithIndex's bookkeeping: the slot empties and the file loses its reference. */
 stopPlaybackWithIndex(slot:number){
  const playback=this.playbacks[slot];
  if(!playback)return;
  const file=this.find(playback.fileNumber);
  if(file&&file.references>0)file.references--;
  this.playbacks[slot]=undefined;
 }
 /** PAUSE_PLAYBACK_RECORDED_CAR and its unpause. */
 setPaused(vehicle:number,paused:boolean){const slot=this.slotOf(vehicle);if(slot>=0)this.playbacks[slot]!.paused=paused;}
 /** SET_PLAYBACK_SPEED. */
 setSpeed(vehicle:number,speed:number){
  requireAsset(Number.isFinite(speed),'Invalid playback speed.');
  const slot=this.slotOf(vehicle);if(slot>=0)this.playbacks[slot]!.speed=speed;
 }
 get playing(){return this.playbacks.filter(Boolean).length;}
}
