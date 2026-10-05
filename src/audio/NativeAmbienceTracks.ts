/* CAEAmbienceTrackManager (Audio/Managers/AEAmbienceTrackManager.cpp), pinned gta-reversed: the looped ambience a club,
 * bar, casino or the like plays while the camera is in its audio zone, the sandstorm's, the riots' and the sea's.
 * Service and its status machine are reversed there. UpdateAmbienceTrackAndVolume is marked "bad" there (its sea
 * branch sits under a test that keeps it from ever running); it is the iOS port's (0x100140ac0 in its executable), as
 * is the hold on a track's start in Service (AmbienceWorld.trackHold):
 * - a zone's track (or the sandstorm's) starts at -34 dB and rises 1 dB a service to its volume; another one asked for
 *   fades the playing one down 0.4 dB a service to -40 dB and stops it, and the new one starts on the next service;
 * - where no zone has a track, the sea (174) plays while the camera is near water with waves (louder the nearer) or
 *   under water (at 14 dB and a sixteenth of the speed, which eases in a quarter a service), and else the riots (166)
 *   outdoors where they are on, rising to -12 dB; with neither, the playing track stops at once (fading only in a
 *   sandstorm that cannot be heard) and the vehicle's radio comes back;
 * - a track plays only while the radio is off: one that overrides the radio (the lowrider meet's, the stadiums')
 *   turns it off first;
 * - a track starts where it would have got to: at a random point the first time, else 7 s or more on from where it
 *   stopped (Service's PlayTrack offset), and it loops; zone 37's starts at the beginning.
 * AUTHORED: the zones that start a radio station (30, 52 to 62) start none, as the port has no stations, though the
 * ambience track stops there as it would for the station. A mission's own track (PlaySpecialMissionAmbienceTrack, from
 * the script audio entity's reported events) takes the place of the zone's, as the iOS function has it: from the
 * beginning, overriding the radio, started at -2 dB with no rise, and left alone while it plays; another track playing
 * fades out first. The tracks are the AMBIENCE pack's (audio/StreamTracks.ts). */
import {NativeAudioEnvironment} from './native/NativeSound';

/** The audio zones (Audiozon.ipl's ids) that play a track, and which. */
export const AMBIENCE_ZONE_TRACKS:Readonly<Record<number,number>>={
 4:143,5:140,8:165,10:139,12:168,13:157,15:164,17:146,19:138,20:136,21:135,23:148,24:159,25:158,26:154,28:147,29:147,
 34:162,36:155,37:144,39:163,41:169,44:152,48:137,50:173,51:156,64:151,66:170,67:171,
};
/** The sandstorm's, the riots' and the sea's tracks. */
export const SANDSTORM_TRACK=167,RIOT_TRACK=166,SEA_TRACK=174;
/** The zones whose track overrides the radio (the lowrider meet and the stadiums), the one whose track starts at the
 * beginning, and those whose volume falls with the camera's distance from the zone's sphere. */
const OVERRIDE_RADIO=new Set([13,41]),FROM_BEGINNING=new Set([37]),BY_DISTANCE=new Set([5,10,13]);
/** The zones that ask for a radio station: 30 the player's favourite (CStats::FindMostFavoriteRadioStation), 52 to 62
 * the stations 1 to 11. */
const stationZone=(id:number)=>id===30||id>=52&&id<=62;
const enum Status {STOPPED,STARTING,WAITING_TO_PLAY,READY_TO_PLAY,PLAYING,STOPPING,WAITING_TO_STOP}
/** The channel the tracks play on: it loads and starts a track at an offset (looping), sets its volume in dB and its
 * frequency factor (which, as the hardware channel's, carries on to the next track), stops it, and says how far into
 * the track it is. */
export interface AmbienceChannel {
 play(track:number,startMs:number):Promise<boolean>;
 setVolume(dB:number):void;
 setFrequency(factor:number):void;
 stop():void;
 playedMs():number|undefined;
}
/** CAudioEngine's radio, which on the original shares the ambience's stream. */
export interface AmbienceRadio {
 /** IsRadioOn. */
 readonly radioOn:boolean;
 /** StopRadio(nullptr, false). */
 stopRadioForAmbience():void;
 /** IsVehicleRadioActive, and then StartRadio(GetCurrentRadioStationID(), NORMAL). */
 restartRadioAfterAmbience():void;
}
/** What UpdateAmbienceTrackAndVolume and Service read of the world. */
export interface AmbienceWorld {
 /** CAudioZones' first active sphere (with its centre) or else first active box. */
 zone?:{id:number;center?:readonly [number,number,number]};
 camera:readonly [number,number,number];
 /** CWeather::Sandstorm. */
 sandstorm:number;
 /** CGame::CanSeeOutSideFromCurrArea. */
 outside:boolean;
 /** CCullZones::PlayerNoRain or CamNoRain: the sandstorm is not heard. */
 noRain?:boolean;
 /** CWeather::UnderWaterness. */
 underwaterness?:number;
 /** TheCamera.m_fDistanceToWater and m_fHeightOfNearestWater (world/nearestWater.ts); none is 1e7 away. */
 water?:{distance:number;height:number};
 /** CGameLogic::LaRiotsActiveHere. */
 riots?:boolean;
 radio?:AmbienceRadio;
 /** IsCutsceneTrackActive and CTimer::GetIsPaused: either holds the choice of track. */
 held:boolean;
 /** The iOS port's own IsCutsceneTrackActive (0x1001709a0): the cutscene track's, the widescreen bars, or 30 s from a
  * cutscene or beat track's preload. A track waits it out to start, and the sea to be chosen. */
 trackHold?:boolean;
 nowMs:number;
}
export class NativeAmbienceTracks {
 status=Status.STOPPED;
 /** m_RequestedSettings.TrackID, m_Volume (dB), m_FreqFactor and the volume a zone's track rises to. */
 trackId=-1;volume=-100;frequency=1;target=-6;
 /** m_OverrideRadio: the track asked for this service turns the radio off. */
 overrideRadio=false;
 /** m_AmbienceRadioStation: the station the zone asked for, -1 none. */
 private radioStation=-1;
 /** m_SpecialMissionAmbienceTrackID: the mission's own track, -1 none. */
 specialMissionTrack=-1;
 /** PlaySpecialMissionAmbienceTrack (0x4D6D50). */
 playSpecialMissionAmbienceTrack(track:number){this.specialMissionTrack=track;}
 /** StopSpecialMissionAmbienceTrack (0x4D6D60): ChangeStatusToStopped and Reset's fields (the iOS 0x100141488). */
 stopSpecialMissionAmbienceTrack(){
  if(this.status>=Status.STARTING&&this.status<=Status.PLAYING)this.status=Status.STOPPING;
  this.specialMissionTrack=-1;this.overrideRadio=false;this.startAtBeginning=false;this.radioStation=-1;
 }
 private startAtBeginning=false;private prevPlayMs=-1;private prevStopMs=0;private ready=false;private request=0;
 constructor(private channel:AmbienceChannel,private random:()=>number=Math.random){}
 /** StopAmbienceTrack (ChangeStatusToStopped). */
 stop(){if(this.status>=Status.STARTING&&this.status<=Status.PLAYING)this.status=Status.STOPPING;this.overrideRadio=false;this.startAtBeginning=false;}
 private fadeOutAndStop(){if(this.volume>-40)this.volume-=.4;else this.stop();}
 private start(track:number,volume:number,frequency:number){this.trackId=track;this.status=Status.STARTING;this.volume=volume;this.frequency=frequency;}
 /** The zone's (or the sandstorm's) track and its volume, with its radio station and its flags. */
 private chooseTrack(world:AmbienceWorld){
  if(world.sandstorm>0&&world.outside&&!world.noRain)return {track:SANDSTORM_TRACK,volume:20*Math.log10(world.sandstorm)-6};
  const zone=world.zone;if(!zone||zone.id<0)return undefined;
  // The favourite is one of the stations 1 to 11, which is all that matters here.
  if(stationZone(zone.id)){this.radioStation=zone.id===30?1:zone.id-51;return undefined;}
  const track=AMBIENCE_ZONE_TRACKS[zone.id];if(track===undefined)return undefined;
  if(OVERRIDE_RADIO.has(zone.id))this.overrideRadio=true;
  if(FROM_BEGINNING.has(zone.id))this.startAtBeginning=true;
  let volume=-6;
  if(zone.id===4){const z=world.camera[2];if(z<=1372)volume=(1372-z)*-9-6;}
  else if(BY_DISTANCE.has(zone.id)&&zone.center){
   const [x,y,z]=zone.center,c=world.camera;
   volume=NativeAudioEnvironment.distanceAttenuation(Math.hypot(x-c[0],y-c[1],z-c[2])/5)-6;
  }
  return {track,volume};
 }
 /** UpdateAmbienceTrackAndVolume. */
 private update(world:AmbienceWorld){
  const prevStation=this.radioStation;
  this.overrideRadio=false;this.startAtBeginning=false;this.radioStation=-1;
  // The mission's own track, in place of the zone's (and the sandstorm's): from the beginning, overriding the radio.
  const mission=this.specialMissionTrack;
  if(mission>=0){this.startAtBeginning=true;this.overrideRadio=true;}
  const chosen=mission>=0?undefined:this.chooseTrack(world),radio=world.radio;
  // The zone's station plays on the radio: AUTHORED, it is not started (see above), but the ambience track stops for
  // it as StartRadio stops it, and a radio that is on (not the zone's station) is stopped.
  if(this.radioStation>=0){if(radio?.radioOn)radio.stopRadioForAmbience();else this.stop();return;}
  if(prevStation>=0){if(radio?.radioOn)radio.stopRadioForAmbience();return;}
  // A track that overrides the radio turns it off (with AE_FRONTEND_RADIO_RETUNE_STOP, whose static the port does not
  // play) and plays from the next service; any other waits for the radio to be off.
  if(radio?.radioOn){if(this.overrideRadio)radio.stopRadioForAmbience();return;}
  if(mission>=0){
   if(this.status===Status.STOPPED)this.start(mission,-2,1);
   else if(this.trackId!==mission)this.fadeOutAndStop();
   return;
  }
  if(chosen){
   this.target=chosen.volume;
   if(this.status===Status.STOPPED)this.start(chosen.track,-34,1);
   else if(this.trackId===chosen.track)this.volume=this.volume+1<chosen.volume?this.volume+1:chosen.volume;
   else this.fadeOutAndStop();
   return;
  }
  const underwater=(world.underwaterness??0)>=.5,water=world.water??{distance:1e7,height:0};
  const dz=world.camera[2]-water.height;
  const seaVolume=underwater?14:NativeAudioEnvironment.distanceAttenuation(Math.sqrt(water.distance**2+dz*dz)/1.75)-12;
  if((underwater||seaVolume>-34)&&!world.trackHold){
   const frequency=underwater?.0625:1;
   if(this.status===Status.STOPPED)this.start(SEA_TRACK,-34,frequency);
   else if(this.trackId===SEA_TRACK)this.volume=seaVolume>this.volume?Math.min(this.volume+1,seaVolume):Math.max(this.volume-1,seaVolume);
   else this.fadeOutAndStop();
   this.frequency=frequency>this.frequency?Math.min(this.frequency+.25,frequency):Math.max(this.frequency-.25,frequency);
   return;
  }
  if(world.riots&&world.outside){
   if(this.status===Status.STOPPED)this.start(RIOT_TRACK,-34,1);
   else if(this.trackId===RIOT_TRACK)this.volume=Math.min(this.volume+1,-12);
   else this.fadeOutAndStop();
   return;
  }
  if(this.status===Status.STOPPED)return;
  // The sea out of earshot is silenced, and stops once well out of it.
  if(this.trackId===SEA_TRACK){if(seaVolume<-40)this.stop();this.volume=-100;this.frequency=1;return;}
  this.frequency=1;
  if(world.sandstorm>0&&this.volume>-40){this.volume-=.4;return;}
  this.stop();radio?.restartRadioAfterAmbience();
 }
 /** Service, once an audio frame. */
 service(world:AmbienceWorld){
  if(!world.held)this.update(world);
  switch(this.status){
   case Status.STARTING:{
    if(world.trackHold)break;
    const start=this.startAtBeginning?0:this.prevPlayMs<0?Math.floor(this.random()*600000)
     :this.prevPlayMs+Math.max(this.prevStopMs?world.nowMs-this.prevStopMs:0,7000);
    const request=++this.request;this.ready=false;
    void this.channel.play(this.trackId,start).then(ok=>{if(request===this.request&&ok)this.ready=true;},()=>undefined);
    this.status=Status.WAITING_TO_PLAY;break;
   }
   case Status.WAITING_TO_PLAY:if(this.ready)this.status=Status.READY_TO_PLAY;break;
   case Status.READY_TO_PLAY:this.channel.setVolume(this.volume);this.status=Status.PLAYING;break;
   // The game's pause suspends the port's audio, which holds the track as CheckForPause's frequency of 0 does.
   case Status.PLAYING:this.channel.setFrequency(this.frequency);this.channel.setVolume(this.volume);break;
   case Status.STOPPING:{
    // A mission's track leaves no place for the next one to resume from.
    const played=this.channel.playedMs();
    if(this.trackId===this.specialMissionTrack){this.prevPlayMs=-1;this.prevStopMs=0;}
    else if(played!==undefined){this.prevPlayMs=Math.trunc(played);this.prevStopMs=world.nowMs;}
    this.volume=-100;this.request++;this.channel.stop();this.status=Status.WAITING_TO_STOP;break;
   }
   case Status.WAITING_TO_STOP:this.status=Status.STOPPED;break;
  }
 }
 /** IsAmbienceTrackActive. */
 get active(){return this.status!==Status.STOPPED;}
 /** CAudioEngine::StopAmbienceTrack(true), as a beat or cutscene track takes the stream: StopAmbienceTrack, serviced
  * until it has stopped, where it had got to kept for the next start. */
 stopNow(nowMs:number){
  this.stop();if(this.status!==Status.STOPPING)return;
  const played=this.channel.playedMs();
  if(played!==undefined){this.prevPlayMs=Math.trunc(played);this.prevStopMs=nowMs;}
  this.volume=-100;this.request++;this.channel.stop();this.status=Status.STOPPED;
 }
 /** A track that is loading when it is asked to stop does not start. */
 reset(){this.request++;this.channel.stop();this.status=Status.STOPPED;this.trackId=-1;this.volume=-100;this.frequency=1;this.radioStation=-1;this.overrideRadio=false;}
}
