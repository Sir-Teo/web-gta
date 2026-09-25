/* CAECutsceneTrackManager, pinned gta-reversed (Audio/Managers/AECutsceneTrackManager.cpp, reversed), which the beat
 * tracks go through (CAudioEngine::PreloadBeatTrack, PlayPreloadedBeatTrack, StopBeatTrack and GetBeatTrackStatus).
 * The status machine is the source's; the stream it drives is silent, as the port ships none of the audio streams:
 * - CAEStreamThread::GetTrackPlayTime answers -2 once a preloaded track is ready, the time played while it plays,
 *   and -6 once it has stopped;
 * - a track's length is in the stream file, so a silent one plays until it is stopped. */
export const BEAT_TRACK_LOADING=1,BEAT_TRACK_LOADED=2,BEAT_TRACK_PLAYING=3,BEAT_TRACK_STOPPING=4;
const S0=0,S1=1,S2=2,PLAYING=3,STOP_REQUESTED=4,S5=5,S6=6,S7=7,S8=8;
const TRACK_READY=-2,TRACK_STOPPED=-6;

export class ScmCutsceneTrack {
 /** m_nStatus: S8 is none active. */
 status=S8;
 trackId=-1;playRequest=false;paused=false;
 /** Whether this port's silent stream has a track, and how long it has played. */
 private stream:'none'|'ready'|'playing'='none';private playedMs=0;
 /** CAEAudioHardware::GetTrackPlayTime for the silent stream. */
 private trackPlayTime(){return this.stream==='ready'?TRACK_READY:this.stream==='playing'?Math.trunc(this.playedMs):TRACK_STOPPED;}
 /** CAECutsceneTrackManager::PreloadBeatTrack through gBeatTrackLookup (whose values are the stream's; the silent
  * stream only keeps the number), then PreloadCutsceneTrack without waiting. */
 preloadBeatTrack(track:number){this.trackId=track;this.status=S0;}
 /** PlayPreloadedCutsceneTrack. */
 play(){this.playRequest=true;this.paused=false;}
 /** StopCutsceneTrack. */
 stop(){if(this.status<=PLAYING)this.status=STOP_REQUESTED;this.playRequest=false;this.paused=false;}
 pause(pause:boolean){this.paused=pause;}
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
 /** Service, once an audio frame; `dtMs` runs the silent stream's clock, which a pause holds. */
 service(dtMs:number,gamePaused=false){
  if(this.stream==='playing'&&!gamePaused&&!this.paused)this.playedMs+=dtMs;
  const time=this.trackPlayTime();
  switch(this.status){
   // AEAudioHardware.PlayTrack: the stream loads the track, ready by the next service.
   case S0:this.stream='ready';this.playedMs=0;this.status=S1;break;
   case S1:if(time===TRACK_READY)this.status=S2;break;
   case S2:if(this.playRequest){this.stream='playing';this.status=PLAYING;this.playRequest=false;}break;
   case PLAYING:if(time===TRACK_STOPPED)this.status=S8;break;
   // AEAudioHardware.StopTrack.
   case STOP_REQUESTED:case S6:this.stream='none';this.status=S7;break;
   case S5:this.status=S6;break;
   case S7:if(time===TRACK_STOPPED)this.status=S8;else if(time===TRACK_READY)this.stream='none';break;
  }
 }
}
