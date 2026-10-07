/* CAERadioTrackManager (Audio/Managers/AERadioTrackManager.cpp, gta-reversed 01709e8e), ported from the iOS port's
 * executable (gta3sa.app 67f70cb72e, arm64) where gta-reversed calls into the retail one: Service (0x100150f34),
 * StartRadio (0x100153150), StopRadio (0x100152c3c), TrackRadioStation (0x100153f44), ChooseTracksForStation
 * (0x100154678), QueueUpTracksForStation (0x100152768), CheckForTrackConcatenation (0x100153710), UpdateRadioVolumes
 * (0x100153470), CheckForPause (0x100153384), ChooseMusicTrackIndex (0x100155010), ChooseIdentIndex (0x1001551e8),
 * ChooseAdvertIndex (0x1001553e8) and ChooseDJBanterIndex (0x100155834) with ChooseDJBanterIndexFromList
 * (0x100156300). What gta-reversed has reversed (StartRadio, ChooseTracksForStation, CheckForPause, the history
 * functions) the iOS functions match. The track tables are the executable's too (radioTables.ts).
 *
 * The port plays the emergency channel with it (eRadioID 0, the AA pack: the dispatcher between bursts of static), as an
 * emergency vehicle's radio does; the stations' packs are not published, for their size. So, not ported, as only
 * the emergency channel reaches them: the stations' own DJ banter (the time of day, the weather and
 * CheckForMissionStatsChanges' special lines), ChooseTalkRadioShow, the user tracks, CheckForStationRetune (which
 * returns at once on the emergency channel) and the hardware's bass EQ (UpdateRadioVolumes' trim for it is ported). */
import {randomInt,resolveProbability,type AudioRandom} from './nativeAudioUtility';
import {BANNED_TRACKS,EMERGENCY_DJ_BANTER,NO_TRACK,RADIO_ADVERTS,RADIO_IDENTS,RADIO_INTROS,RADIO_MUSIC_TRACKS,RADIO_OUTROS,RADIO_RESTRICTED_ADVERTS} from './radioTables';

/** eRadioTrackMode. */
export const RADIO_MODE={starting:0,waitingToPlay:1,playing:2,stopping:3,stoppingSilenced:4,stoppingChannelsStopped:5,waitingToStop:6,stopped:7} as const;
/** The track types of tRadioSettings' queue. */
export const TRACK_TYPE={ident:0,advert:1,djBanter:2,intro:3,track:4,outro:5,none:6,userTrack:7} as const;
const RADIO_EMERGENCY=0,RADIO_TALK=11,RADIO_USER_TRACKS=12,RADIO_OFF=13,RADIO_COUNT=14,NUM_TRACKS=5;
/** CClock::daysInMonth (the executable's 0x100649420). */
const DAYS_IN_MONTH=[31,29,31,30,31,30,31,31,30,31,30,31];
/** IsTrackBanned (0x100150e40): a track the iOS port removed. CAEStreamThread::PlayTrack refuses one too. */
/** CStats::FindMostFavoriteRadioStation (iOS 0x1002611d4) over FavoriteRadioStationList: the station of 1 to 12 with the
 * most listening time, the lower on a tie, and 1 when none has any. */
export function findMostFavoriteRadioStation(listenTimes:readonly number[]){
 let best=Math.max(listenTimes[1]??0,0),station=1;
 for(let id=2;id<=12;id++)if((listenTimes[id]??0)>best){best=listenTimes[id];station=id;}
 return station;
}
export const isTrackBanned=(id:number)=>BANNED_TRACKS.some(([first,count])=>id>=first&&id<first+count);

/** AEAudioHardware's track stream (CAEStreamThread and its CAEStreamingChannel), as the radio uses it. */
export interface RadioTrackHardware {
 /** PlayTrack: the track to play, from startMs modulo its length, and the one the stream moves on to without a gap. */
 playTrack(trackId:number,nextTrackId:number,startMs:number,flags:number,user:boolean,nextUser:boolean):void;
 /** StartTrackPlayback, once the track is ready (a play time of -2). */
 startTrackPlayback():void;
 stopTrack():void;
 /** GetTrackPlayTime: the playing track's time in ms, or the stream's state: -8 neither track could be prepared, -7
  * paused, -6 stopped, -5 stopping, -4 finished, -2 ready. */
 trackPlayTime():number;
 trackLengthMs():number;
 /** The track the stream's decoder holds (GetActiveTrackID, 0x10015bfd8), and the same only while it plays, stops or
  * finishes (GetPlayingTrackID, 0x10015bffc); -1 for none. */
 activeTrackId():number;
 playingTrackId():number;
 /** SetChannelVolume of the radio's channel, in dB. */
 setChannelVolume(dB:number):void;
 /** SetChannelFrequencyScalingFactor: 0 holds the track where it is. */
 setFrequencyScalingFactor(factor:number):void;
}
/** A stream that never readies: the manager's until one is attached. */
export const NO_RADIO_HARDWARE:RadioTrackHardware={playTrack(){},startTrackPlayback(){},stopTrack(){},trackPlayTime:()=>-6,trackLengthMs:()=>-1,
 activeTrackId:()=>-1,playingTrackId:()=>-1,setChannelVolume(){},setFrequencyScalingFactor(){}};

/** What the manager reads of the game each call. */
export interface RadioWorld {
 /** CTimer::m_snTimeInMilliseconds and m_snTimeInMillisecondsPauseMode. */
 timeMs:number;pauseTimeMs:number;
 /** CTimer::GetIsPaused. */
 paused:boolean;
 /** CClock::ms_nGameClockDays (from 1), ms_nGameClockMonth (from 1) and ms_nGameClockHours. */
 clock:{days:number;month:number;hours:number};
 /** TheCamera.m_bWideScreenOn and CTimer::GetIsSlowMotionActive. */
 widescreen:boolean;slowMotion:boolean;
 /** AEAudioHardware.GetEffectsMasterScalingFactor and GetMusicMasterScalingFactor. */
 effectsLevel:number;musicLevel:number;
 /** UpdateRadioVolumes' duck: a mission audio slot plays a line with no position or within 15 m of the camera, or
  * CAEPedSpeechAudioEntity::s_bForceAudible. */
 dialogue:boolean;
 /** CAudioEngine::IsAmbienceRadioActive. */
 ambienceRadio:boolean;
 /** CGameLogic::LaRiotsActiveHere. */
 laRiotsHere:boolean;
 /** CAEVehicleAudioEntity::StaticGetPlayerVehicleAudioSettingsForRadio's RadioType (eAERadioType), when it is set. */
 vehicleRadioType?:number;
}

/** tRadioSettings. */
export class RadioSettings {
 trackQueue=[-1,-1,-1,-1,-1];currTrackId=-1;prevTrackId=-1;playTime=0;trackLengthMs=0;trackFlags=2;
 bassSetting=0;bassGain=0;trackTypes=[6,6,6,6,6];currTrackType=6;prevTrackType=6;trackIndices=[-1,-1,-1,-1,-1];currTrackIdx=-1;prevTrackIdx=-1;
 constructor(public stationId=RADIO_OFF){}
 /** The queue cleared, as ChooseTracksForStation and TrackRadioStation clear it. */
 clearQueue(){this.trackQueue.fill(-1);this.trackTypes.fill(TRACK_TYPE.none);this.trackIndices.fill(-1);}
 copyFrom(o:RadioSettings){
  this.trackQueue=[...o.trackQueue];this.currTrackId=o.currTrackId;this.prevTrackId=o.prevTrackId;this.playTime=o.playTime;this.trackLengthMs=o.trackLengthMs;
  this.trackFlags=o.trackFlags;this.stationId=o.stationId;this.bassSetting=o.bassSetting;this.bassGain=o.bassGain;this.trackTypes=[...o.trackTypes];
  this.currTrackType=o.currTrackType;this.prevTrackType=o.prevTrackType;this.trackIndices=[...o.trackIndices];this.currTrackIdx=o.currTrackIdx;this.prevTrackIdx=o.prevTrackIdx;
 }
}
/** tRadioState: where a station was when the radio left it, for TrackRadioStation. */
class RadioState {
 elapsed=[0,0,0];timeInPauseModeMs=-1;timeMs=-1;trackPlayTime=-1;trackQueue=[-1,-1,-1];trackTypes=[6,6,6];gameClockDays=-1;gameClockHours=-1;
 /** StopRadio's reset of the three tracks it keeps. */
 clearTracks(){this.elapsed=[0,0,0];this.trackPlayTime=-1;this.trackQueue=[-1,-1,-1];this.trackTypes=[6,6,6];}
}
/** tRadioIndexHistory. */
class IndexHistory {
 indices:number[];
 constructor(length:number){this.indices=new Array<number>(length).fill(-1);}
 putAtFirst(index:number){this.indices.pop();this.indices.unshift(index);}
}
/** The queue's count, which QueueUpTracksForStation moves on. */
interface Count {n:number}
/** The vehicle's tVehicleAudioSettings, which StopRadio writes the station back to. */
export interface RadioVehicleSettings {radioStation:number;bassSetting:number}

export class NativeRadioTrackManager {
 hardware:RadioTrackHardware=NO_RADIO_HARDWARE;
 initialised=false;displayStationName=false;enabledInPauseMode=false;bassEnhance=true;pauseMode=false;retuneJustStarted=false;
 readonly tracksInARow=new Array<number>(RADIO_COUNT).fill(0);
 savedGameClockDays=-1;savedGameClockHours=-1;
 readonly listenTimes=new Array<number>(RADIO_COUNT).fill(0);
 savedTimeMs=0;retuneStartedTime=0;
 /** field_60: when the track last started playing. */
 playbackStartedMs=0;
 mode:number=RADIO_MODE.stopped;
 stationsListed=0;stationsListDown=0;savedRadioStationId=-1;menuRequest=-1;scriptRequest=-1;
 /** m_f80 and m_f84: the dialogue duck in dB and what it recovers by each service. */
 duck=0;duckRecovery=0;
 readonly requested=new RadioSettings();readonly active=new RadioSettings();
 readonly radioState=Array.from({length:RADIO_COUNT},()=>new RadioState());
 private readonly djBanterHistory=Array.from({length:RADIO_COUNT},()=>new IndexHistory(15));
 private readonly advertHistory=Array.from({length:RADIO_COUNT},()=>new IndexHistory(40));
 private readonly identHistory=Array.from({length:RADIO_COUNT},()=>new IndexHistory(8));
 private readonly musicHistory=Array.from({length:RADIO_COUNT},()=>new IndexHistory(20));
 constructor(private readonly random:AudioRandom=Math.random){}

 /** CAudioEngine::Reset's: the radio stopped outright, then Reset (0x4E7F80, reversed): the histories, the stations'
  * places and the requests forgotten. (Reset's random station, GetRandomRadioStation, is the one StartRadio replaces;
  * the port leaves it off.) */
 reset(){
  this.hardware.stopTrack();this.mode=RADIO_MODE.stopped;this.initialised=false;this.displayStationName=false;
  for(const h of [...this.djBanterHistory,...this.advertHistory,...this.identHistory,...this.musicHistory])h.indices.fill(-1);
  for(const r of this.radioState)Object.assign(r,new RadioState());
  this.requested.copyFrom(new RadioSettings());this.active.copyFrom(new RadioSettings());
  this.stationsListed=this.stationsListDown=0;this.playbackStartedMs=this.retuneStartedTime=0;this.enabledInPauseMode=false;
  this.savedGameClockDays=this.savedGameClockHours=-1;this.bassEnhance=true;this.savedRadioStationId=this.menuRequest=this.scriptRequest=-1;
  this.pauseMode=this.retuneJustStarted=false;this.duck=this.duckRecovery=0;
 }
 /** IsRadioOn (0x4E8350). */
 isRadioOn(){return this.mode!==RADIO_MODE.stopped||this.initialised||this.stationsListed!==0||this.stationsListDown!==0;}

 private addMusicTrackIndexToHistory(id:number,index:number){
  if(index>=0&&this.musicHistory[id].indices[0]!==index){this.musicHistory[id].putAtFirst(index);this.tracksInARow[id]++;}
 }
 private addIdentIndexToHistory(id:number,track:number){if(this.identHistory[id].indices[0]!==track)this.identHistory[id].putAtFirst(track);}
 private addAdvertIndexToHistory(id:number,track:number){if(this.advertHistory[id].indices[0]!==track){this.advertHistory[id].putAtFirst(track);this.tracksInARow[id]=0;}}
 private addDJBanterIndexToHistory(id:number,track:number){if(this.djBanterHistory[id].indices[0]!==track){this.djBanterHistory[id].putAtFirst(track);this.tracksInARow[id]=0;}}
 /** Service's history of what the stream plays: the track itself for an ident, an advert or DJ banter, its music
  * index for a music track's intro, body or outro (and a user track). */
 private addToHistory(id:number,type:number,track:number,index:number){
  if(type===TRACK_TYPE.ident)this.addIdentIndexToHistory(id,track);
  else if(type===TRACK_TYPE.advert)this.addAdvertIndexToHistory(id,track);
  else if(type===TRACK_TYPE.djBanter)this.addDJBanterIndexToHistory(id,track);
  else if(type!==TRACK_TYPE.none)this.addMusicTrackIndexToHistory(id,index);
 }

 /** ChooseMusicTrackIndex: a music track not among the last n - 2 (at most 20) for its first n tries, and not removed. */
 chooseMusicTrackIndex(id:number){
  // ChooseTalkRadioShow for WCTR is not ported (only the emergency channel plays).
  const tracks=RADIO_MUSIC_TRACKS[id],n=tracks.length;
  for(let attempt=0;;attempt++){
   const index=randomInt(this.random,0,n-1);
   let fresh=true;
   if(attempt<n&&n>=3)for(let i=0,limit=Math.min(n-2,20);i<limit;i++)if(this.musicHistory[id].indices[i]===index){fresh=false;break;}
   if(fresh&&!isTrackBanned(tracks[index]))return index;
  }
 }
 /** ChooseIdentIndex: none for a station without idents (the emergency channel). */
 chooseIdentIndex(id:number){
  const [first,last]=RADIO_IDENTS[id]??[NO_TRACK,NO_TRACK];
  if(first===NO_TRACK)return -1;
  // Radio Los Santos' ident 1100 waits on a stat (338); not ported, the station does not play.
  for(let attempt=0;;attempt++){
   const track=randomInt(this.random,first,last),span=last-first;
   let fresh=true;
   if(attempt<span&&span>=2)for(let i=0,limit=Math.min(span-1,8);i<limit;i++)if(this.identHistory[id].indices[i]===track){fresh=false;break;}
   if(fresh&&!isTrackBanned(track))return track;
  }
 }
 /** ChooseAdvertIndex: one of the shared adverts the station does not refuse, not among its last 40 for its first 40
  * tries. */
 chooseAdvertIndex(id:number){
  const restricted=RADIO_RESTRICTED_ADVERTS[id]??[];
  for(let attempt=0;;){
   const track=randomInt(this.random,RADIO_ADVERTS[0],RADIO_ADVERTS[1]);
   let fresh=false;
   if(!restricted.includes(track)){fresh=attempt>39||!this.advertHistory[id].indices.includes(track);attempt++;}
   if(fresh&&!isTrackBanned(track))return track;
  }
 }
 /** ChooseDJBanterIndex. The emergency channel's: the dispatcher, from the riots' lines while the riots are on where
  * the player is (m_nSpecialDJBanterPending stays 3, none, as CheckForMissionStatsChanges is not ported). The
  * stations' is not ported. */
 chooseDJBanterIndex(id:number,world:RadioWorld){
  if(id!==RADIO_EMERGENCY)return -1;
  return this.chooseDJBanterIndexFromList(id,world.laRiotsHere?EMERGENCY_DJ_BANTER.riots:EMERGENCY_DJ_BANTER.general);
 }
 /** ChooseDJBanterIndexFromList: from a random point of the run on, the first line not among the last 15 for 15
  * tries; the history's length is the station's general run's, whichever run it picks from. */
 private chooseDJBanterIndexFromList(id:number,[first,last]:readonly [number,number]){
  if(first===NO_TRACK)return -1;
  const span=last-first,start=randomInt(this.random,0,span);
  if(span<0)return -1;
  const general=id===RADIO_EMERGENCY?EMERGENCY_DJ_BANTER.general:[NO_TRACK,NO_TRACK],generalSpan=general[1]-general[0];
  for(let attempt=0;;attempt++){
   const track=(attempt+start)%(span+1)+first;
   let fresh=true;
   if(attempt<=14&&generalSpan>=2)for(let i=0,limit=Math.min(generalSpan-1,15);i<limit;i++)if(this.djBanterHistory[id].indices[i]===track){fresh=false;break;}
   if(fresh&&!isTrackBanned(track))return track;
   if(attempt>=span)return -1;
  }
 }

 /** QueueUpTracksForStation: puts a track of the type at the queue's count, a music track with its outro, an intro with
  * its music track and outro. */
 private queueUpTracksForStation(id:number,count:Count,type:number,s:RadioSettings,world:RadioWorld):boolean{
  const at=count.n;
  switch(type){
   case TRACK_TYPE.ident:{
    if(id===RADIO_USER_TRACKS)return false;
    const track=this.chooseIdentIndex(id);s.trackQueue[at]=track;if(track===-1)return false;
    s.trackTypes[at]=TRACK_TYPE.ident;count.n++;return true;
   }
   case TRACK_TYPE.advert:s.trackQueue[at]=this.chooseAdvertIndex(id);s.trackTypes[at]=TRACK_TYPE.advert;count.n++;return true;
   case TRACK_TYPE.djBanter:{
    if(id===RADIO_USER_TRACKS)return false;
    const track=this.chooseDJBanterIndex(id,world);s.trackQueue[at]=track;if(track===-1)return false;
    s.trackTypes[at]=TRACK_TYPE.djBanter;count.n++;return true;
   }
   case TRACK_TYPE.track:{
    // A user track (SelectUserTrackIndex) is not ported.
    if(id===RADIO_USER_TRACKS)return false;
    const index=this.chooseMusicTrackIndex(id);
    s.trackIndices[at]=index;s.trackQueue[at]=RADIO_MUSIC_TRACKS[id][index];s.trackTypes[at]=TRACK_TYPE.track;count.n++;
    const o=count.n;s.trackIndices[o]=s.trackIndices[o-1];
    const outros=RADIO_OUTROS[id][s.trackIndices[o]];
    // An outro the iOS port removed is drawn again, eleven times at most, and then none.
    let outro=randomInt(this.random,outros[0],outros[1]);
    for(let retry=0;isTrackBanned(outro);retry++){if(retry>=11){outro=-1;break;}outro=randomInt(this.random,outros[0],outros[1]);}
    s.trackQueue[o]=outro;s.trackTypes[o]=TRACK_TYPE.outro;count.n++;return true;
   }
   case TRACK_TYPE.intro:{
    if(id===RADIO_USER_TRACKS)return false;
    const index=this.chooseMusicTrackIndex(id),intros=RADIO_INTROS[id][index];
    s.trackIndices[at]=index;s.trackQueue[at]=randomInt(this.random,intros[0],intros[1]);s.trackTypes[at]=TRACK_TYPE.intro;count.n++;
    let n=count.n;s.trackIndices[n]=s.trackIndices[n-1];s.trackQueue[n]=RADIO_MUSIC_TRACKS[id][s.trackIndices[n]];s.trackTypes[n]=TRACK_TYPE.track;count.n++;
    n=count.n;s.trackIndices[n]=s.trackIndices[n-1];
    const outros=RADIO_OUTROS[id][s.trackIndices[n]];s.trackQueue[n]=randomInt(this.random,outros[0],outros[1]);s.trackTypes[n]=TRACK_TYPE.outro;count.n++;return true;
   }
   case TRACK_TYPE.outro:{
    if(id===RADIO_USER_TRACKS)return false;
    const index=this.chooseMusicTrackIndex(id),outros=RADIO_OUTROS[id][index];
    s.trackIndices[at]=index;s.trackQueue[at]=randomInt(this.random,outros[0],outros[1]);s.trackTypes[at]=TRACK_TYPE.outro;count.n++;return true;
   }
   default:return true;
  }
 }
 /** An outro and what follows it, as ChooseTracksForStation and TrackRadioStation's last window put it: on the
  * emergency channel the dispatcher, on a station an intro (after an ident half the time) or an ident and DJ banter
  * (or an advert). */
 private queueOutroAndAfter(id:number,s:RadioSettings,world:RadioWorld){
  const count:Count={n:0},index=this.chooseMusicTrackIndex(id),outros=RADIO_OUTROS[id][index];
  s.trackIndices[0]=index;s.trackQueue[0]=randomInt(this.random,outros[0],outros[1]);s.trackTypes[0]=TRACK_TYPE.outro;count.n=1;
  this.addMusicTrackIndexToHistory(id,s.trackIndices[0]);
  if(id===RADIO_EMERGENCY){
   const track=this.chooseDJBanterIndex(RADIO_EMERGENCY,world);s.trackQueue[1]=track;
   if(track!==-1){s.trackTypes[1]=TRACK_TYPE.djBanter;count.n=2;}
   return;
  }
  const intro=resolveProbability(this.random,.5),ident=resolveProbability(this.random,.5);
  if(ident){const track=this.chooseIdentIndex(id);s.trackQueue[1]=track;if(track!==-1){s.trackTypes[1]=TRACK_TYPE.ident;count.n=2;}}
  if(intro){this.queueUpTracksForStation(id,count,TRACK_TYPE.intro,s,world);return;}
  this.queueTalk(id,count,s,world);
 }
 /** DJ banter at the count, or an advert where there is none. */
 private queueTalk(id:number,count:Count,s:RadioSettings,world:RadioWorld){
  const at=count.n,track=id===RADIO_USER_TRACKS?-1:this.chooseDJBanterIndex(id,world);
  if(track!==-1){s.trackQueue[at]=track;s.trackTypes[at]=TRACK_TYPE.djBanter;}
  else{s.trackQueue[at]=this.chooseAdvertIndex(id);s.trackTypes[at]=TRACK_TYPE.advert;}
  count.n++;
 }
 /** ChooseTracksForStation: a station's opening queue, in m_RequestedSettings. */
 private chooseTracksForStation(id:number,world:RadioWorld){
  const s=this.requested,count:Count={n:0};
  s.clearQueue();
  if(resolveProbability(this.random,.95)){
   // User tracks (two of them and now and then an advert) are not ported.
   if(id===RADIO_USER_TRACKS)return;
   if(resolveProbability(this.random,.9)){this.queueUpTracksForStation(id,count,TRACK_TYPE.track,s,world);return;}
   if(resolveProbability(this.random,.5)){
    if(resolveProbability(this.random,.5)){const track=this.chooseIdentIndex(id);s.trackQueue[0]=track;if(track!==-1){s.trackTypes[0]=TRACK_TYPE.ident;count.n=1;}}
    this.queueUpTracksForStation(id,count,TRACK_TYPE.intro,s,world);return;
   }
   this.queueOutroAndAfter(id,s,world);return;
  }
  if(id===RADIO_EMERGENCY){
   const track=this.chooseDJBanterIndex(RADIO_EMERGENCY,world);s.trackQueue[0]=track;
   if(track!==-1){s.trackTypes[0]=TRACK_TYPE.djBanter;count.n=1;}
  }else{
   if(resolveProbability(this.random,.5)&&id!==RADIO_USER_TRACKS){const track=this.chooseIdentIndex(id);s.trackQueue[0]=track;if(track!==-1){s.trackTypes[0]=TRACK_TYPE.ident;count.n=1;}}
   this.queueTalk(id,count,s,world);
  }
  this.queueUpTracksForStation(id,count,id===RADIO_USER_TRACKS?TRACK_TYPE.track:TRACK_TYPE.intro,s,world);
 }
 /** TrackRadioStation: back on a station left at most five game hours before, the queue goes on from where the
  * station would be now (7 s on at least, past the track with skipTrack), from the three tracks StopRadio kept or, a
  * little after them, with a new intro, music track or outro. False when the station is to start afresh. */
 private trackRadioStation(id:number,skipTrack:boolean,world:RadioWorld):boolean{
  const state=this.radioState[id],s=this.requested,count:Count={n:0};
  if(state.gameClockHours>=0&&state.gameClockDays>=0){
   let days=world.clock.days-state.gameClockDays;
   if(days<0){const month=world.clock.month-1;days+=DAYS_IN_MONTH[month<0?world.clock.month+11:month];}
   if(world.clock.hours+24*days-state.gameClockHours>5)return false;
  }
  let elapsed=Math.trunc(Math.max(world.timeMs-state.timeMs,7000));
  if(skipTrack)elapsed=Math.trunc(Math.max(elapsed,state.elapsed[0]+1));
  s.clearQueue();
  const [e0,e1,e2]=state.elapsed;
  let i:number;
  if(elapsed<=e0){i=0;s.playTime=state.trackPlayTime+elapsed;}
  else if(elapsed<=e0+e1){i=1;s.playTime=elapsed-e0;}
  else{
   const end=e0+e1+e2,over=elapsed-end;
   if(over<=0){i=2;s.playTime=elapsed-(e0+e1);}
   else if(elapsed<=end+7000){this.queueUpTracksForStation(id,count,id===RADIO_USER_TRACKS?TRACK_TYPE.track:TRACK_TYPE.intro,s,world);s.playTime=Math.trunc(Math.min(over,5000));return true;}
   else if(elapsed<=end+155000){this.queueUpTracksForStation(id,count,TRACK_TYPE.track,s,world);s.playTime=elapsed-5000-end;return true;}
   else if(elapsed<=end+160000){if(id!==RADIO_USER_TRACKS)this.queueOutroAndAfter(id,s,world);s.playTime=elapsed-155000-end;return true;}
   else return false;
  }
  const type=state.trackTypes[i];
  switch(type){
   case TRACK_TYPE.ident:case TRACK_TYPE.advert:case TRACK_TYPE.djBanter:
    s.trackQueue[0]=state.trackQueue[i];s.trackTypes[0]=type;count.n=1;
    this.queueUpTracksForStation(id,count,id===RADIO_USER_TRACKS?TRACK_TYPE.track:TRACK_TYPE.intro,s,world);return true;
   case TRACK_TYPE.intro:case TRACK_TYPE.track:
    for(let k=0;k<(type===TRACK_TYPE.intro?3:2);k++){s.trackQueue[k]=state.trackQueue[i+k]??-1;s.trackTypes[k]=state.trackTypes[i+k]??TRACK_TYPE.none;}
    return true;
   case TRACK_TYPE.outro:
    s.trackQueue[0]=state.trackQueue[i];s.trackTypes[0]=type;count.n=1;
    if(id===RADIO_EMERGENCY){const track=this.chooseDJBanterIndex(RADIO_EMERGENCY,world);s.trackQueue[1]=track;if(track!==-1){s.trackTypes[1]=TRACK_TYPE.djBanter;count.n=2;}return true;}
    if(resolveProbability(this.random,.5)&&id!==RADIO_USER_TRACKS){const track=this.chooseIdentIndex(id);s.trackQueue[1]=track;if(track!==-1){s.trackTypes[1]=TRACK_TYPE.ident;count.n=2;}}
    this.queueTalk(id,count,s,world);return true;
   // A user track (7) is not ported; none (6) starts the station afresh.
   default:return false;
  }
 }
 /** StartRadio (0x4EB3C0 in gta-reversed, which this matches): asks for a station, kept where TrackRadioStation can
  * keep it, else chosen afresh at a random point up to 5 minutes in; a playing one stops first. */
 startRadio(stationId:number,bassSetting:number,bassGain:number,skipTrack:boolean,world:RadioWorld){
  const id=Math.min(stationId,RADIO_OFF);
  if(world.paused){
   this.enabledInPauseMode=true;
   if(this.isRadioOn()&&id===this.active.stationId){this.radioState[id].timeInPauseModeMs=world.pauseTimeMs;return;}
  }
  const s=this.requested;
  // The port's ambience tracks have a channel of their own, so none stands in the radio's way here (the original's
  // StartRadio waits out one that overrides the radio and else stops it).
  s.stationId=id;s.bassSetting=bassSetting;s.bassGain=bassGain;
  if(id===RADIO_OFF)s.clearQueue();
  else if(this.radioState[id].timeMs<0||!this.trackRadioStation(id,skipTrack,world)){this.chooseTracksForStation(s.stationId,world);s.playTime=randomInt(this.random,0,300000);}
  this.initialised=true;
  if(this.mode<=RADIO_MODE.playing)this.mode=RADIO_MODE.stopping;
  this.radioState[s.stationId].timeInPauseModeMs=-1;
 }
 /** StopRadio: the station's place is kept for TrackRadioStation (what plays and how far in, with a music track's
  * outro reckoned at 5 s and a track after an intro at 150 s), the vehicle's settings take the station, and leaving
  * the emergency channel puts a random station in its place. */
 stopRadio(settings:RadioVehicleSettings|undefined,duringPause:boolean,world:RadioWorld){
  const a=this.active;
  if(this.mode<=RADIO_MODE.playing){
   if(duringPause||!world.paused)this.mode=RADIO_MODE.stopping;
   const id=a.stationId,state=this.radioState[id];
   state.clearTracks();state.timeMs=world.timeMs;state.gameClockDays=world.clock.days;state.gameClockHours=world.clock.hours;
   if(state.timeInPauseModeMs>=0&&id!==RADIO_EMERGENCY&&id!==RADIO_OFF)this.listenTimes[id]+=world.pauseTimeMs-state.timeInPauseModeMs;
   if(id===RADIO_OFF)this.radioState[RADIO_OFF].elapsed[0]=0;
   else{
    state.elapsed[0]=a.trackLengthMs-100-a.playTime;
    const type=a.currTrackType;
    const keep=(n:number)=>{
     if(a.trackQueue[0]===a.currTrackId)for(let k=0;k<n;k++){state.trackQueue[k]=a.trackQueue[k];state.trackTypes[k]=a.trackTypes[k];}
     else{state.trackQueue[0]=a.currTrackId;state.trackTypes[0]=a.currTrackType;for(let k=1;k<n;k++){state.trackQueue[k]=a.trackQueue[k-1];state.trackTypes[k]=a.trackTypes[k-1];}}
    };
    if(type===TRACK_TYPE.ident||type===TRACK_TYPE.advert||type===TRACK_TYPE.djBanter||type===TRACK_TYPE.outro){
     state.trackPlayTime=a.playTime;state.trackQueue[0]=a.currTrackId;state.trackTypes[0]=type;
    }else if(type===TRACK_TYPE.track||type===TRACK_TYPE.userTrack){state.elapsed[1]=5000;state.trackPlayTime=a.playTime;keep(2);}
    else if(type===TRACK_TYPE.intro){
     // WCTR's talk show lengths (0x100646e28) are not ported; the station does not play.
     if(id!==RADIO_TALK)state.elapsed[1]=150000;
     state.elapsed[2]=5000;state.trackPlayTime=a.playTime;keep(3);
    }
   }
  }
  this.initialised=false;this.enabledInPauseMode=false;
  if(world.paused&&!duringPause){this.menuRequest=-1;this.retuneStartedTime=0;}
  if(settings){
   this.stationsListed=0;this.stationsListDown=0;this.scriptRequest=-1;this.displayStationName=false;this.retuneJustStarted=false;
   if(a.stationId===-1)a.stationId=RADIO_OFF;
   settings.radioStation=a.stationId;settings.bassSetting=a.bassSetting;
   if(this.isRadioOn()){this.savedTimeMs=world.timeMs;this.savedGameClockDays=world.clock.days;this.savedGameClockHours=world.clock.hours;this.savedRadioStationId=a.stationId;}
   if(a.stationId===RADIO_EMERGENCY)a.stationId=randomInt(this.random,1,13);
  }else if(duringPause){this.stationsListed=0;this.stationsListDown=0;this.retuneJustStarted=false;}
 }
 /** UpdateRadioVolumes: -4 dB, under dialogue ducked by the effects level against the music's less 9 dB (the duck
  * comes back by a fiftieth of itself each time the volume is set, twice a service while the radio plays), -16 dB in
  * the widescreen bars, -100 in slow motion, 20 dB less under an ambience radio; then the bass setting's trim. */
 private updateRadioVolumes(world:RadioWorld){
  let volume:number;
  if(world.paused&&this.enabledInPauseMode)volume=-4;
  else{
   let v=-4;
   if(world.slowMotion)v=-100;
   else if(world.widescreen)v=-16;
   else if(world.effectsLevel>0&&world.musicLevel>0){
    if(world.dialogue){
     const d=Math.min(20*Math.log10(world.effectsLevel/world.musicLevel)-9,0);
     this.duck=d;this.duckRecovery=d/-50;v=d-4;
    }else if(this.duck<0){this.duck=Math.min(this.duck+this.duckRecovery,0);v=this.duck-4;}
   }
   volume=world.ambienceRadio?v-20:v;
  }
  if(this.bassEnhance){if(this.active.bassSetting===1)volume-=2;else if(this.active.bassSetting===2)volume+=1.5;}
  this.hardware.setChannelVolume(volume);
 }
 /** CheckForPause: the stream holds while the game is paused (unless the radio was started in the pause), and the radio
  * stops when the player's vehicle has none. */
 private checkForPause(world:RadioWorld){
  if(world.paused){this.pauseMode=true;this.hardware.setFrequencyScalingFactor(this.enabledInPauseMode?1:0);return;}
  const type=world.vehicleRadioType;
  if(type===0||type===2||type===3||world.ambienceRadio){this.pauseMode=false;this.hardware.setFrequencyScalingFactor(1);return;}
  this.stopRadio(undefined,false,world);this.pauseMode=false;
 }
 /** CheckForTrackConcatenation: once the stream has moved on to the queue's next track, the queue moves up, and when
  * nothing is left after the playing track more is chosen (on the emergency channel the dispatcher after an intro,
  * a music track or an outro, and an intro, music track and outro after anything else); the stream is given the
  * next one. */
 private checkForTrackConcatenation(world:RadioWorld){
  const a=this.active,count:Count={n:1};
  // User tracks are not ported.
  const playing=this.hardware.activeTrackId();
  if(playing!==a.trackQueue[1]||a.trackQueue[1]<0)return;
  a.prevTrackId=a.trackQueue[0];a.prevTrackType=a.trackTypes[0];a.prevTrackIdx=a.trackIndices[0];
  a.trackQueue=[playing,a.trackQueue[2],a.trackQueue[3],a.trackQueue[4],-1];
  a.trackTypes=[...a.trackTypes.slice(1,NUM_TRACKS),TRACK_TYPE.none];a.trackIndices=[...a.trackIndices.slice(1,NUM_TRACKS),-1];
  if(a.trackQueue[1]===-1){
   const id=a.stationId,type=a.trackTypes[0];
   if(type>=TRACK_TYPE.intro&&type<=TRACK_TYPE.outro){
    if(id===RADIO_EMERGENCY){
     const track=this.chooseDJBanterIndex(RADIO_EMERGENCY,world);a.trackQueue[1]=track;
     if(track!==-1){a.trackTypes[1]=TRACK_TYPE.djBanter;count.n++;}
    }else if(this.tracksInARow[id]<=1&&resolveProbability(this.random,.5)){
     if(resolveProbability(this.random,.5)&&id!==RADIO_USER_TRACKS){const track=this.chooseIdentIndex(id);a.trackQueue[1]=track;if(track!==-1){a.trackTypes[1]=TRACK_TYPE.ident;count.n++;}}
     this.queueUpTracksForStation(id,count,TRACK_TYPE.intro,a,world);
    }else{
     if(resolveProbability(this.random,.5)&&id!==RADIO_USER_TRACKS){const track=this.chooseIdentIndex(id);a.trackQueue[count.n]=track;if(track!==-1){a.trackTypes[count.n]=TRACK_TYPE.ident;count.n++;}}
     this.queueTalk(id,count,a,world);
    }
   }else this.queueUpTracksForStation(id,count,TRACK_TYPE.intro,a,world);
  }
  this.hardware.playTrack(a.trackQueue[0],a.trackQueue[1],0,a.trackFlags,a.trackTypes[0]===TRACK_TYPE.userTrack,a.trackTypes[1]===TRACK_TYPE.userTrack);
 }
 /** Service, each audio frame, with the stream's play time (CAudioEngine::Service hands it AEAudioHardware's). */
 service(world:RadioWorld){
  const a=this.active,hw=this.hardware;
  a.playTime=hw.trackPlayTime();a.trackLengthMs=hw.trackLengthMs();a.currTrackId=hw.playingTrackId();
  // Paused, CheckForStationRetuneDuringPause, and else CheckForMissionStatsChanges and CheckForStationRetune: none
  // reaches the emergency channel.
  if(!world.paused)this.updateRadioVolumes(world);
  if(this.initialised&&this.mode===RADIO_MODE.stopped){
   a.copyFrom(this.requested);
   if(this.requested.stationId!==RADIO_OFF)this.mode=RADIO_MODE.starting;
   const type=world.vehicleRadioType;
   if(type===0||type===2||type===3)this.displayStationName=true;
   this.initialised=false;
  }
  switch(this.mode){
   case RADIO_MODE.starting:
    if(a.playTime<0)a.playTime=0;
    hw.playTrack(a.trackQueue[0],a.trackQueue[1],a.playTime,a.trackFlags,a.trackTypes[0]===TRACK_TYPE.userTrack,a.trackTypes[1]===TRACK_TYPE.userTrack);
    this.mode=RADIO_MODE.waitingToPlay;break;
   case RADIO_MODE.waitingToPlay:
    // Neither track could be prepared: an advert and a music track in their place.
    if(a.playTime===-8){
     if(a.currTrackId===a.trackQueue[1]||a.trackQueue[1]===-1&&a.currTrackId===a.trackQueue[0]){
      a.trackQueue[0]=this.chooseAdvertIndex(a.stationId);a.trackTypes[0]=TRACK_TYPE.advert;
      this.queueUpTracksForStation(a.stationId,{n:1},TRACK_TYPE.track,a,world);this.mode=RADIO_MODE.starting;
     }
     break;
    }
    if(a.playTime!==-2)break;
    // StartTrackPlayback (SetChannelFlags 55; the retune noise, which stops here, is not the port's).
    hw.startTrackPlayback();this.updateRadioVolumes(world);
    this.playbackStartedMs=world.timeMs;this.radioState[a.stationId].timeInPauseModeMs=world.pauseTimeMs;
    this.mode=RADIO_MODE.playing;break;
   case RADIO_MODE.playing:
    // The stream stopped under it: on from the next track, or two new music tracks.
    if(a.playTime===-6){
     if(hw.activeTrackId()===a.trackQueue[0]&&a.trackQueue[1]!==-1){
      a.trackQueue[0]=a.trackQueue[1];a.trackTypes[0]=a.trackTypes[1];a.trackIndices[0]=a.trackIndices[1];
      this.queueUpTracksForStation(a.stationId,{n:1},TRACK_TYPE.track,a,world);
     }else{const count:Count={n:0};this.queueUpTracksForStation(a.stationId,count,TRACK_TYPE.track,a,world);this.queueUpTracksForStation(a.stationId,count,TRACK_TYPE.track,a,world);}
     this.mode=RADIO_MODE.starting;break;
    }
    if(a.trackQueue[0]===a.currTrackId){this.addToHistory(a.stationId,a.trackTypes[0],a.currTrackId,a.trackIndices[0]);a.currTrackType=a.trackTypes[0];a.currTrackIdx=a.trackIndices[0];}
    else if(a.prevTrackId===a.currTrackId){this.addToHistory(a.stationId,a.prevTrackType,a.currTrackId,a.prevTrackIdx);a.currTrackType=a.prevTrackType;a.currTrackIdx=a.prevTrackIdx;}
    this.checkForPause(world);
    this.updateRadioVolumes(world);
    this.checkForTrackConcatenation(world);
    break;
   case RADIO_MODE.stopping:case RADIO_MODE.stoppingChannelsStopped:hw.stopTrack();this.mode=RADIO_MODE.waitingToStop;break;
   case RADIO_MODE.stoppingSilenced:this.mode=RADIO_MODE.stoppingChannelsStopped;break;
   case RADIO_MODE.waitingToStop:
    if(a.playTime===-8||a.playTime===-6)this.mode=RADIO_MODE.stopped;
    else if(a.playTime===-7||a.playTime===-2)hw.stopTrack();
    break;
  }
 }
 snapshot(){
  const a=this.active;
  return {mode:this.mode,station:a.stationId,queue:[...a.trackQueue],types:[...a.trackTypes],playing:a.currTrackId,playTime:a.playTime,
   banter:[...this.djBanterHistory[RADIO_EMERGENCY].indices.filter(t=>t>=0)],duck:+this.duck.toFixed(2)};
 }
}
