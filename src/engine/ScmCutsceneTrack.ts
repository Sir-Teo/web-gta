/* CAECutsceneTrackManager, pinned gta-reversed (Audio/Managers/AECutsceneTrackManager.cpp, reversed), which the beat
 * tracks go through (CAudioEngine::PreloadBeatTrack, PlayPreloadedBeatTrack, StopBeatTrack, PauseBeatTrack and
 * GetBeatTrackStatus). The status machine is the source's. The stream it drives is a host's (the BEATS pack's
 * tracks, audio/StreamTracks.ts) when one is attached, else a silent one:
 * - CAEStreamThread::GetTrackPlayTime answers -2 once a preloaded track is ready, the time played while it plays,
 *   and -6 once it has stopped;
 * - a track runs its length and then stops; a silent one, whose length is unknown, plays until it is stopped. */
export const BEAT_TRACK_LOADING=1,BEAT_TRACK_LOADED=2,BEAT_TRACK_PLAYING=3,BEAT_TRACK_STOPPING=4;
const S0=0,S1=1,S2=2,PLAYING=3,STOP_REQUESTED=4,S5=5,S6=6,S7=7,S8=8;
const TRACK_READY=-2,TRACK_STOPPED=-6;
/** gBeatTrackLookup (0x8AE538), read from the iOS port's executable: a beat track's number to its stream track. */
export const BEAT_TRACK_LOOKUP:readonly number[]=[180,175,178,179,178,175,175,175,175,176,184,183,182,181];
/** tTrackInfo::tBeat: a beat's time into the track in ms and its key (the dance's arrows, the lowrider's moves). */
export type TrackBeat=readonly [time:number,key:number];
/** The stream a host plays the tracks on: it loads a track (resolving with its beats and length, or nothing when it
 * cannot be had), starts, pauses and stops it, and says how far into it the audio is. */
export interface BeatTrackStream {
 load(track:number):Promise<{beats:readonly TrackBeat[];lengthMs:number}|undefined>;
 play():void;
 pause(paused:boolean):void;
 stop():void;
 /** How many ms of the started track have played. */
 playedMs():number|undefined;
}
/** CAudioEngine round the tracks, which on the original share one stream with the radio and the ambience: a preload
 * first stops the radio (keeping its station) or else the ambience track (PreloadBeatTrack, PreloadCutsceneTrack); the
 * radio comes back when the script stops the track (StopBeatTrack: StopCutsceneTrack's wait, to the kept station) and
 * once the mission-complete track has stopped (CAudioEngine::Service: StartRadio with the vehicle's settings). */
export interface TrackAudio {
 stopForTrack():void;radioAfterTrack(keptStation:boolean):void;
 /** The iOS port's PreloadCutsceneTrack also sets a flag of its CAudioEngine's for 30 s, which its own
  * IsCutsceneTrackActive reads: the ambience track waits it out (audio/NativeAmbienceTracks.ts). */
 holdAmbience?():void;
}
/** tBeatInfo: the beats around the play time (slot 9 the last, 10 the next) with times relative to it. */
export interface BeatInfo {window:{time:number;key:number}[];present:boolean;beatTypeThisFrame:number;beatNumber:number}
const WINDOW=20,PAST=9,NEXT=10,BEATS_PER_TRACK=1000;

export class ScmCutsceneTrack {
 /** m_nStatus: S8 is none active. */
 status=S8;
 /** The stream track preloaded (gBeatTrackLookup's value), -1 for none. */
 trackId=-1;playRequest=false;paused=false;
 /** The host's stream; without one the track is silent. */
 stream?:BeatTrackStream;
 /** The host's CAudioEngine side (TrackAudio). */
 audio?:TrackAudio;
 /** m_bPlayingMissionCompleteTrack: PlayPreloadedBeatTrack(true), the mission-passed tune. */
 missionComplete=false;
 private state:'none'|'loading'|'ready'|'playing'='none';private playedMs=0;
 private track?:{beats:readonly TrackBeat[];lengthMs:number};private request=0;
 /** CAEAudioHardware's gBeatInfo, which GetBeatInfo refreshes on every call. */
 readonly beatInfo:BeatInfo={window:Array.from({length:WINDOW},()=>({time:0,key:0})),present:false,beatTypeThisFrame:0,beatNumber:0};
 /** CAEAudioHardware::GetTrackPlayTime. */
 private trackPlayTime(){return this.state==='ready'?TRACK_READY:this.state==='playing'?Math.trunc(this.playedMs):TRACK_STOPPED;}
 /** CAudioEngine::PreloadBeatTrack: the radio or the ambience stops, then CAECutsceneTrackManager::PreloadBeatTrack
  * through gBeatTrackLookup, and PreloadCutsceneTrack without waiting. */
 preloadBeatTrack(beat:number){this.audio?.stopForTrack();this.trackId=BEAT_TRACK_LOOKUP[beat]??-1;this.status=S0;this.audio?.holdAmbience?.();}
 /** PlayPreloadedBeatTrack(missionComplete): PlayPreloadedCutsceneTrack. */
 play(missionComplete=false){this.playRequest=true;this.paused=false;this.missionComplete=missionComplete;}
 /** StopBeatTrack: StopCutsceneTrack(true), which waits the track out and brings the radio back. */
 stop(){
  if(this.status<=PLAYING)this.status=STOP_REQUESTED;this.playRequest=false;this.paused=false;
  this.audio?.radioAfterTrack(true);this.missionComplete=false;
 }
 /** PauseTrack: CheckForPause then holds the channel's frequency at zero, and with it the play time. */
 pause(pause:boolean){this.paused=pause;if(this.state==='playing')this.stream?.pause(pause);}
 /** IsCutsceneTrackActive. */
 get active(){return this.status!==S8;}
 /** GetCutsceneTrackStatus: 1 loading, 2 loaded, 3 playing, 4 stopping, else 0. */
 get reportedStatus(){
  switch(this.status){
   case S0:case S1:return BEAT_TRACK_LOADING;
   case S2:return BEAT_TRACK_LOADED;
   case PLAYING:return BEAT_TRACK_PLAYING;
   case STOP_REQUESTED:case S5:case S6:case S7:return BEAT_TRACK_STOPPING;
   default:return 0;
  }
 }
 /** AEAudioHardware.PlayTrack: the stream loads the track, ready by the next service, or once the host has it. */
 private loadTrack(){
  if(this.state==='playing'||this.state==='ready')this.stream?.stop();
  const request=++this.request;this.playedMs=0;this.track=undefined;
  if(!this.stream){this.state='ready';return;}
  this.state='loading';
  void this.stream.load(this.trackId).catch(()=>undefined).then(track=>{
   if(request!==this.request||this.state!=='loading')return;
   this.track=track;this.state='ready';
  });
 }
 private stopStream(){this.request++;if(this.state==='playing'||this.state==='ready')this.stream?.stop();this.state='none';this.track=undefined;}
 /** Service, once an audio frame; `dtMs` runs a silent stream's clock, which a pause holds. */
 service(dtMs:number,gamePaused=false){
  if(this.state==='playing'){
   const heard=this.stream&&this.track?this.stream.playedMs():undefined;
   if(heard!==undefined)this.playedMs=heard;
   else if(!gamePaused&&!this.paused)this.playedMs+=dtMs;
   // The stream runs out at the track's end.
   if(this.track&&this.track.lengthMs>0&&this.playedMs>=this.track.lengthMs)this.stopStream();
  }
  const time=this.trackPlayTime();
  switch(this.status){
   case S0:this.loadTrack();this.status=S1;break;
   case S1:if(time===TRACK_READY)this.status=S2;break;
   case S2:if(this.playRequest){
    this.state='playing';this.status=PLAYING;this.playRequest=false;
    if(this.track){this.stream?.play();if(this.paused)this.stream?.pause(true);}
   }break;
   case PLAYING:if(time===TRACK_STOPPED){
    this.status=S8;
    // CAudioEngine::Service: the mission-complete track finished (-4) and then stopped (-6).
    if(this.missionComplete){this.missionComplete=false;this.audio?.radioAfterTrack(false);}
   }break;
   // AEAudioHardware.StopTrack.
   case STOP_REQUESTED:case S6:this.stopStream();this.status=S7;break;
   case S5:this.status=S6;break;
   case S7:if(time===TRACK_STOPPED)this.status=S8;else if(time===TRACK_READY)this.stopStream();break;
  }
 }
 /** CAEAudioHardware::GetBeatInfo, as the iOS port's executable has it: the beats either side of the play time, a
  * beat still counting as the next one for 50 ms after it (once a beat number has been given out), and the next
  * beat's number (-1 once past the last). */
 getBeatInfo():BeatInfo{
  const info=this.beatInfo,clear=()=>{for(const slot of info.window){slot.time=0;slot.key=0;}info.present=false;info.beatTypeThisFrame=0;};
  if(this.state==='none'||this.state==='loading'){clear();return info;}
  const play=this.trackPlayTime(),beats=this.track?.beats??[];
  if(play<0||!beats.length||beats[0][0]<0){clear();return info;}
  const begin=info.beatNumber>=0?Math.max(0,play-50):play,previous=info.beatNumber;
  clear();info.present=true;info.beatNumber=-1;
  let i=0;while(i<beats.length&&i<BEATS_PER_TRACK&&beats[i][0]<begin)i++;
  for(let k=0;k<=PAST&&k<i;k++){const beat=beats[i-1-k];info.window[PAST-k].time=beat[0]-play;info.window[PAST-k].key=beat[1];}
  if(i<beats.length){
   if(i!==previous&&i>=1)info.beatTypeThisFrame=beats[i-1][1];
   for(let k=0;k<WINDOW-NEXT&&i+k<beats.length;k++){const beat=beats[i+k];info.window[NEXT+k].time=beat[0]-play;info.window[NEXT+k].key=beat[1];}
   info.beatNumber=i;
  }
  return info;
 }
 /** GET_BEAT_PROXIMITY's handler (the iOS port's; the PC's is unreversed): a beat's time from now, its key and its
  * number. Offset 0 is the nearer of the last and the next beat, a positive one the offset'th beat to come, a
  * negative one the offset'th gone. With no beat info all three read -1. */
 beatProximity(offset:number):{time:number;key:number;number:number}{
  const info=this.getBeatInfo();
  if(!info.present)return {time:-1,key:-1,number:-1};
  const at=(slot:number,number:number)=>{const beat=info.window[slot];return beat?{time:beat.time,key:beat.key,number}:{time:0,key:0,number};};
  if(offset>0)return at(PAST+offset,info.beatNumber);
  if(offset<0)return at(NEXT+offset,info.beatNumber);
  const next=info.window[NEXT],last=info.window[PAST];
  if(next.time!==0&&info.beatNumber!==0&&Math.abs(next.time)>Math.abs(last.time))return at(PAST,info.beatNumber-1);
  return at(NEXT,info.beatNumber);
 }
}
