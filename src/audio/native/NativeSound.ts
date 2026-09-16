import {SOUND_DIST_ATTENUATION} from './attenuationTable';
import {randomFloat,type AudioRandom} from './nativeAudioUtility';
/** Native coordinates: x east, y north, z up. */
export interface NativeVec {x:number;y:number;z:number}
/** eSoundEnvironment flags (AESound.h). Bit 0x2 is stored as m_IsUnancellable. */
export const SOUND={frontEnd:0x1,uncancellable:0x2,requestUpdates:0x4,playPhysically:0x8,unpausable:0x10,startPercentage:0x20,musicMastered:0x40,lifespanTiedToEntity:0x80,unduckable:0x100,incompressible:0x200,rolledOff:0x400,smoothDucking:0x800,forcedFront:0x1000} as const;
export interface NativeAudioEntity {updateParameters(sound:NativeSound,playPosition:number):void}
/** A CPhysical reference: `position` returns undefined once the entity is gone. */
export interface NativePhysicalEntity {position():NativeVec|undefined}
/** TheCamera state read by CAEAudioEnvironment. `right` is the on-screen right (the negated RenderWare camera right). */
export interface NativeCamera {position:NativeVec;right:NativeVec;forward:NativeVec;up:NativeVec;firstPerson:boolean;playerPosition?:NativeVec;justSwitched:boolean}
const dot=(a:NativeVec,b:NativeVec)=>a.x*b.x+a.y*b.y+a.z*b.z;
/** CAEAudioEnvironment (0x4D7E40-0x4D8340). */
export class NativeAudioEnvironment {
 camera:NativeCamera={position:{x:0,y:0,z:0},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},firstPerson:false,justSwitched:false};
 /** GetPositionRelativeToCamera: camera-space (right, forward, up) from a listener pulled toward the player, or 2 units behind first-person cameras. */
 positionRelativeToCamera(pt:NativeVec):NativeVec{
  const c=this.camera;let offset:number;
  if(c.firstPerson)offset=-2;
  else{const d=c.playerPosition?Math.hypot(c.position.x-c.playerPosition.x,c.position.y-c.playerPosition.y,c.position.z-c.playerPosition.z):.5;offset=Math.min(.5,Math.max(0,d-.5));}
  const v={x:pt.x-c.position.x-c.forward.x*offset,y:pt.y-c.position.y-c.forward.y*offset,z:pt.z-c.position.z-c.forward.z*offset};
  return {x:dot(v,c.right),y:dot(v,c.forward),z:dot(v,c.up)};
 }
 /** GetDistanceAttenuation (0x4D7F20). */
 static distanceAttenuation(dist:number){return dist<128?SOUND_DIST_ATTENUATION[Math.floor(Math.fround(dist/Math.fround(.1)))]:-100;}
 /** GetDirectionalMikeAttenuation (0x4D7F60): 0 dB in front, -6 dB behind, linear between ±sqrt(0.5). */
 static directionalMikeAttenuation(dir:NativeVec){
  const f=dir.y,cut=Math.SQRT1_2;
  if(f>=cut)return 0;if(f<=-cut)return -6;
  return (1-(f+cut)/(2*cut))*-6;
 }
 /** GetDopplerRelativeFrequency (0x4D7E40). */
 dopplerRelativeFrequency(prevDist:number,curDist:number,prevTime:number,curTime:number,scale:number){
  if(this.camera.justSwitched)return 1;
  const delta=curDist-prevDist;if(scale===0||delta===0||curTime<=prevTime)return 1;
  const doppler=delta*1000/(curTime-prevTime)*scale;if(Math.abs(doppler)>=340)return 1;
  return 340/(Math.min(35,Math.max(-35,doppler))+340);
 }
}
export interface NativeSoundClock {timeMs:number;frame:number}
export interface NativeSoundParams {
 slot:number;sound:number;entity?:NativeAudioEntity;position:NativeVec;volume:number;rollOff?:number;speed?:number;doppler?:number;
 frameDelay?:number;flags?:number;speedVariance?:number;playTime?:number;event?:number;clientVariable?:number;physical?:NativePhysicalEntity;
}
/** CAESound (0x4EF1A0-0x4EFFD0). */
export class NativeSound {
 slot=-1;sound=-1;entity?:NativeAudioEntity;physical?:NativePhysicalEntity;event=-1;clientVariable=-1;
 volume=0;rollOff=1;speed=1;speedVariance=0;doppler=1;frameDelay=0;flags=0;
 currPos:NativeVec={x:0,y:0,z:0};prevPos:NativeVec={x:0,y:0,z:0};lastFrameUpdatedAt=0;currTimeUpdateMs=0;prevTimeUpdateMs=0;currCamDist=0;prevCamDist=0;
 inUse=false;hardwareAware=false;playTime=0;physicallyPlaying=false;listenerVolume=-100;listenerSpeed=1;requestedStop=false;headroom=0;length=-1;
 constructor(private env:NativeAudioEnvironment,private clock:NativeSoundClock){}
 has(flag:number){return (this.flags&flag)!==0;}
 setFlags(flag:number,enabled:boolean){this.flags=enabled?this.flags|flag:this.flags&~flag;}
 /** Initialise: the constructor fields, SetPosition and the requested play time. */
 initialise(p:NativeSoundParams){
  this.slot=p.slot;this.sound=p.sound;this.entity=p.entity;this.volume=p.volume;this.rollOff=p.rollOff??1;this.speed=p.speed??1;this.doppler=p.doppler??1;
  this.frameDelay=p.frameDelay??0;this.flags=p.flags??0;this.speedVariance=p.speedVariance??0;this.event=p.event??-1;this.clientVariable=p.clientVariable??-1;
  this.lastFrameUpdatedAt=0;this.physical=undefined;this.listenerVolume=-100;this.listenerSpeed=1;this.length=-1;this.headroom=0;
  this.setPosition(p.position);this.playTime=p.playTime??0;
  if(this.has(SOUND.lifespanTiedToEntity)&&p.physical)this.physical=p.physical;
 }
 stopSound(){this.requestedStop=true;this.physical=undefined;}
 stopSoundAndForget(){this.setFlags(SOUND.requestUpdates,false);this.entity=undefined;this.stopSound();}
 /** UpdatePlayTime (0x4EF2E0) for virtual sounds. */
 updatePlayTime(length:number,loopStart:number,progress:number){
  this.length=length;if(this.physicallyPlaying)return;
  if(this.requestedStop){this.playTime=-1;return;}
  this.playTime=(this.playTime+Math.trunc(progress*this.listenerSpeed))<<16>>16;
  if(this.playTime<length)return;
  if(loopStart===-1){this.playTime=-1;return;}
  this.playTime=length>0?loopStart+this.playTime%length:loopStart;
 }
 relativePosition(){return this.has(SOUND.frontEnd)?{...this.currPos}:this.env.positionRelativeToCamera(this.currPos);}
 /** CalculateFrequency (0x4EF390). */
 calculateFrequency(random:AudioRandom){this.listenerSpeed=this.speedVariance<=0||this.speedVariance>=this.speed?this.speed:this.speed+randomFloat(random,-this.speedVariance,this.speedVariance);}
 relativePlaybackFrequencyWithDoppler(){return this.has(SOUND.frontEnd)?this.listenerSpeed:this.listenerSpeed*this.env.dopplerRelativeFrequency(this.prevCamDist,this.currCamDist,this.prevTimeUpdateMs,this.currTimeUpdateMs,this.doppler);}
 /** SetPosition (0x4EF880): previous samples roll over once per frame for the doppler estimate. */
 setPosition(pos:NativeVec){
  const c=this.env.camera.position,dist=Math.hypot(pos.x-c.x,pos.y-c.y,pos.z-c.z);
  if(!this.lastFrameUpdatedAt){this.prevCamDist=dist;this.prevPos={...pos};this.prevTimeUpdateMs=this.clock.timeMs;}
  else if(this.lastFrameUpdatedAt!==this.clock.frame){this.prevPos=this.currPos;this.prevCamDist=this.currCamDist;this.prevTimeUpdateMs=this.currTimeUpdateMs;}
  this.lastFrameUpdatedAt=this.clock.frame;this.currCamDist=dist;this.currPos={...pos};this.currTimeUpdateMs=this.clock.timeMs;
 }
 /** CalculateVolume (0x4EFA10). */
 calculateVolume(){
  this.listenerVolume=this.volume-this.headroom;
  if(!this.has(SOUND.frontEnd)){const rel=this.env.positionRelativeToCamera(this.currPos);this.listenerVolume+=NativeAudioEnvironment.directionalMikeAttenuation(rel)+NativeAudioEnvironment.distanceAttenuation(Math.hypot(rel.x,rel.y,rel.z)/this.rollOff);}
 }
 /** UpdateParameters (0x4EFF50). */
 updateParameters(playPosition:number){
  if(this.has(SOUND.lifespanTiedToEntity)){const p=this.physical?.position();if(p)this.setPosition(p);else this.requestedStop=true;}
  if(this.has(SOUND.requestUpdates)&&this.entity){this.entity.updateParameters(this,playPosition);if(this.speedVariance===0)this.listenerSpeed=this.speed;}
 }
 /** SoundHasFinished (0x4EFFD0). */
 soundHasFinished(){this.updateParameters(-1);this.physical=undefined;this.inUse=false;this.physicallyPlaying=false;this.playTime=0;}
}
