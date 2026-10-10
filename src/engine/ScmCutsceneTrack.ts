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
/** FindCutsceneAudioTrackId's table (iOS 0x1005b6930, the PC's 0x8D0AA8): a cutscene's stream track, its name compared
 * without case. The finale has none (CCutsceneMgr::IsPlayingCSTheFinale skips the preload). */
const CUTSCENE_AUDIO_TRACKS:readonly (readonly [string,number])[]=[
 ['BCESAR2',626],['BCESAR4',627],['BCESA4W',628],['BCESAR5',629],['BCESA5W',630],['BCRAS1',631],['BCRAS2',632],
 ['BHILL1',633],['BHILL2',634],['BHILL3a',635],['BHILL3b',636],['BHILL3c',637],['BHILL5a',638],['BHILL5b',639],
 ['CAS_1a',640],['CAS_1b',642],['CAS_2',643],['CAS_3',644],['CAS_4a',645],['CAS_4b',646],['CAS_4c',647],
 ['CAS_5a',648],['CAS_6a',649],['CAS6b_1',650],['CAS6b_2',651],['CAS_7b',652],['CAS_9a1',653],['CAS_9a2',654],
 ['CAS_11a',641],['CAT_1',655],['CAT_2',656],['CAT_3',657],['CAT_4',658],['CESAR1A',659],['CESAR2A',660],
 ['CRASH1A',661],['CRASH2A',662],['CRASH3A',663],['CRASHV1',664],['CRASv2a',665],['CRASv2b',666],['D10_ALT',667],
 ['D8_ALT',668],['DESERT1',671],['DESERT2',672],['DESERT3',673],['DESERT4',674],['DESERT6',675],['DESERT8',676],
 ['DESERT9',677],['DES_10A',678],['DES_10B',679],['DOC_2',680],['EPILOG',681],['FARL_2A',682],['FARL_3A',683],
 ['FARL_3B',684],['FARL_4A',685],['FARL_5A',686],['FINAL1A',687],['FINAL2A',688],['FINAL2B',689],['GARAG1B',690],
 ['GARAG1C',691],['GARAG3A',692],['GROVE1a',693],['GROVE1b',694],['GROVE1c',695],['GROVE2',696],['HEIST1a',697],
 ['HEIST2a',698],['HEIST4a',699],['HEIST5a',700],['HEIST6a',701],['HEIST8a',702],['INTRO1A',703],['INTRO1B',704],
 ['INTRO2A',705],['PROLOG1',706],['PROLOG2',707],['PROLOG3',708],['RIOT_1a',709],['RIOT_1b',710],['RIOT_2',711],
 ['RIOT_4a',712],['RIOT_4b',713],['RIOT_4c',714],['RIOT_4d',715],['RIOT4e1',716],['RIOT4e2',717],['RYDER1A',718],
 ['RYDER2A',719],['RYDER3A',720],['SCRASH1',721],['SCRASH2',722],['SMOKE1A',723],['SMOKE1B',724],['SMOKE2A',725],
 ['SMOKE2B',726],['SMOKE3A',727],['SMOKE4A',728],['STEAL_1',729],['STEAL_2',730],['STEAL_4',731],['STEAL_5',732],
 ['STRAP1A',733],['STRAP2A',734],['STRAP3A',735],['STRAP4A',736],['STRP4B1',737],['STRP4B2',738],['SWEET1A',739],
 ['SWEET1B',740],['SWEET1C',741],['SWEET2A',742],['SWEET2B',743],['SWEET3A',744],['SWEET3B',745],['SWEET4A',746],
 ['SWEET5A',747],['SWEET6A',748],['SWEET6B',749],['SWEET7A',750],['SYND_2A',751],['SYND_2B',752],['SYND_3A',753],
 ['SYND_4A',754],['SYND_4B',755],['SYND_7',756],['TRUTH_1',758],['TRUTH_2',757],['W2_ALT',759],['WOOZI1A',761],
 ['WOOZI1B',762],['WOOZIE2',760],['WOOZIE4',763],['ZERO_1',764],['ZERO_2',765],['ZERO_4',766],['DATE1a',670],
 ['DATE1b',669],['DATE2a',670],['DATE2b',669],['DATE3a',670],['DATE3b',669],['DATE4a',670],['DATE4b',669],
 ['DATE5a',670],['DATE5b',669],['DATE6a',670],['DATE6b',669]];
/** FindCutsceneAudioTrackId (gta-reversed CutsceneMgr.cpp 0x5AFA50): -1 for a cutscene with no track. */
export function findCutsceneAudioTrackId(name:string){const key=name.toLowerCase();return CUTSCENE_AUDIO_TRACKS.find(([n])=>n.toLowerCase()===key)?.[1]??-1;}
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
 /** CAudioEngine::PreloadCutsceneTrack: as a beat track's, with the cutscene's stream track itself. */
 preloadCutsceneTrack(track:number){this.audio?.stopForTrack();this.trackId=track;this.status=S0;this.audio?.holdAmbience?.();}
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
