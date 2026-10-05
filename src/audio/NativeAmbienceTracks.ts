/* CAEAmbienceTrackManager (Audio/Managers/AEAmbienceTrackManager.cpp), pinned gta-reversed: the looped ambience a club,
 * bar, casino or the like plays while the camera is in its audio zone, and the sandstorm's. Service and its status
 * machine are reversed. UpdateAmbienceTrackAndVolume is marked "bad" there; what is taken from it is the audio zone's
 * track and volume, the sandstorm's, and the fades:
 * - a new track starts at -34 dB and rises 1 dB a service to its volume; another one asked for fades the playing one
 *   down 0.4 dB a service to -40 dB and stops it, and the new one starts on the next service;
 * - a track starts where it would have got to: at a random point the first time, else 7 s or more on from where it
 *   stopped (Service's PlayTrack offset), and it loops.
 * AUTHORED: the reversal's sea and underwater ambience (tracks 174 and 166) sits in a branch it cannot reach as
 * written, so no track plays where no zone asks for one; the zones that start a radio station (30, 52 to 62) do
 * nothing, as the port has no stations. The tracks are the AMBIENCE pack's (audio/StreamTracks.ts). */
import {NativeAudioEnvironment} from './native/NativeSound';

/** The audio zones (Audiozon.ipl's ids) that play a track, and which. */
export const AMBIENCE_ZONE_TRACKS:Readonly<Record<number,number>>={
 4:143,5:140,8:165,10:139,12:168,13:157,15:164,17:146,19:138,20:136,21:135,23:148,24:159,25:158,26:154,28:147,29:147,
 34:162,36:155,37:144,39:163,41:169,44:152,48:137,50:173,51:156,64:151,66:170,67:171,
};
/** The sandstorm's track. */
export const SANDSTORM_TRACK=167;
const enum Status {STOPPED,STARTING,WAITING_TO_PLAY,READY_TO_PLAY,PLAYING,STOPPING,WAITING_TO_STOP}
/** The channel the tracks play on: it loads and starts a track at an offset (looping), sets its volume in dB, stops
 * it, and says how far in it is. */
export interface AmbienceChannel {
 play(track:number,startMs:number):Promise<boolean>;
 setVolume(dB:number):void;
 stop():void;
 playedMs():number|undefined;
}
/** What UpdateAmbienceTrackAndVolume reads of the world each service. */
export interface AmbienceWorld {
 /** CAudioZones' first active sphere (with its centre) or else first active box. */
 zone?:{id:number;center?:readonly [number,number,number]};
 camera:readonly [number,number,number];
 /** CWeather::Sandstorm. */
 sandstorm:number;
 /** CGame::CanSeeOutSideFromCurrArea. */
 outside:boolean;
 /** IsCutsceneTrackActive and CTimer::GetIsPaused: either holds the choice of track. */
 held:boolean;
 nowMs:number;
}
export class NativeAmbienceTracks {
 status=Status.STOPPED;
 /** m_RequestedSettings.TrackID, m_Volume (dB) and the volume the track is rising to. */
 trackId=-1;volume=-100;target=-6;
 private startAtBeginning=false;private prevPlayMs=-1;private prevStopMs=0;private ready=false;private request=0;
 constructor(private channel:AmbienceChannel,private random:()=>number=Math.random){}
 /** StopAmbienceTrack (ChangeStatusToStopped). */
 private stopTrack(){if(this.status>=Status.STARTING&&this.status<=Status.PLAYING)this.status=Status.STOPPING;this.startAtBeginning=false;}
 private fadeOutAndStop(){if(this.volume>-40)this.volume-=.4;else this.stopTrack();}
 private wanted(world:AmbienceWorld){
  if(world.sandstorm>0)return world.outside?{track:SANDSTORM_TRACK,volume:Math.log10(2)*Math.log2(world.sandstorm)}:undefined;
  const zone=world.zone;if(!zone)return undefined;
  const track=AMBIENCE_ZONE_TRACKS[zone.id];if(track===undefined)return undefined;
  let volume=-6;
  if(zone.id===4){const z=world.camera[2];volume=z<=1372?-6-9*(1372-z):-6;}
  else if((zone.id===5||zone.id===10)&&zone.center){
   const [x,y,z]=zone.center,c=world.camera;
   volume=NativeAudioEnvironment.distanceAttenuation(Math.hypot(x-c[0],y-c[1],z-c[2])*.2)-6;
  }
  return {track,volume};
 }
 /** UpdateAmbienceTrackAndVolume's choice of track and the fades between them. */
 private update(world:AmbienceWorld){
  const want=this.wanted(world);
  if(!want){if(this.status!==Status.STOPPED)this.fadeOutAndStop();return;}
  this.target=want.volume;
  if(this.status===Status.STOPPED){this.trackId=want.track;this.status=Status.STARTING;this.volume=-34;}
  else if(this.trackId===want.track)this.volume=Math.min(this.volume+1,this.target);
  else this.fadeOutAndStop();
 }
 /** Service, once an audio frame. */
 service(world:AmbienceWorld){
  if(!world.held)this.update(world);
  switch(this.status){
   case Status.STARTING:{
    const start=this.startAtBeginning?0:this.prevPlayMs<0?Math.floor(this.random()*600000)
     :this.prevPlayMs+Math.max(this.prevStopMs?world.nowMs-this.prevStopMs:0,7000);
    const request=++this.request;this.ready=false;
    void this.channel.play(this.trackId,start).then(ok=>{if(request===this.request&&ok)this.ready=true;},()=>undefined);
    this.status=Status.WAITING_TO_PLAY;break;
   }
   case Status.WAITING_TO_PLAY:if(this.ready)this.status=Status.READY_TO_PLAY;break;
   case Status.READY_TO_PLAY:this.channel.setVolume(this.volume);this.status=Status.PLAYING;break;
   case Status.PLAYING:this.channel.setVolume(this.volume);break;
   case Status.STOPPING:{
    const played=this.channel.playedMs();
    if(played!==undefined){this.prevPlayMs=Math.trunc(played);this.prevStopMs=world.nowMs;}
    this.volume=-100;this.request++;this.channel.stop();this.status=Status.WAITING_TO_STOP;break;
   }
   case Status.WAITING_TO_STOP:this.status=Status.STOPPED;break;
  }
 }
 get active(){return this.status!==Status.STOPPED;}
 /** CAudioEngine::StopAmbienceTrack(true), as a beat or cutscene track takes the stream: StopAmbienceTrack, serviced
  * until it has stopped, where it had got to kept for the next start. */
 stopNow(nowMs:number){
  this.stopTrack();if(this.status!==Status.STOPPING)return;
  const played=this.channel.playedMs();
  if(played!==undefined){this.prevPlayMs=Math.trunc(played);this.prevStopMs=nowMs;}
  this.volume=-100;this.request++;this.channel.stop();this.status=Status.STOPPED;
 }
 /** A track that is loading when it is asked to stop does not start. */
 reset(){this.request++;this.channel.stop();this.status=Status.STOPPED;this.trackId=-1;this.volume=-100;}
}
