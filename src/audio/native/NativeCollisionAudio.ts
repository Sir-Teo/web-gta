import {SOUND,type NativeAudioEntity,type NativePhysicalEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
import {COLLISION_LOOKUP} from './collisionLookup';
import {audioLog10,randomInt,resolveProbability,stepTo,type AudioRandom} from './nativeAudioUtility';
import type {SurfaceAudioFlags} from '../../assets/surfaceAudio';
export const SURFACE={glass:45,ped:62,car:63,rubber:67} as const;
const AE_GENERAL_COLLISION=116,AE_BULLET_HIT=117,AE_WATER_SPLASH=118;
const STATUS={inactive:0,oneShot:1,looping:2} as const;
/** One side of a CPhysical::ApplyCollision report. Speeds are native units per frame. */
export interface NativeCollider {key:unknown;surface:number;
 /** SURFINFO.DAT friction effect is sparks. */ sparks?:boolean;vehicle?:{up:NativeVec;moveSpeed:NativeVec;turnSpeed:NativeVec};building?:boolean}
interface Entry {a?:unknown;b?:unknown;surfaceA:number;surfaceB:number;sound?:NativeSound;status:number;loopStop:number}
/** CAECollisionAudioEntity (gta-reversed 0076f901, 0x4DA050-0x4DBDF0): one-shot impacts by surface, looping scrapes while contact continues, and bullet hits. */
export class NativeCollisionAudio implements NativeAudioEntity {
 private list:Entry[]=Array.from({length:300},()=>({surfaceA:195,surfaceB:195,status:STATUS.inactive,loopStop:0}));
 private history=new Int16Array(195).fill(255);private lastBulletHit=-1;private active=0;
 /** `surfaceFlags` reads SURFAUD.DAT classes (g_surfaceInfos audio flags) by surface id. */
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private random:AudioRandom,private defaultVolume:(event:number)=>number,private surfaceFlags:(surface:number)=>SurfaceAudioFlags|undefined){}
 private get time(){return this.manager.clock.timeMs;}
 private addToList(a:unknown,b:unknown,surfaceA:number,surfaceB:number,sound:NativeSound,status:number){
  const e=this.list.find(e=>!e.sound);if(!e)return;
  Object.assign(e,{a,b,surfaceA,surfaceB,sound,status,loopStop:status===STATUS.looping?this.time+100:0});this.active++;
 }
 private status(a:unknown,b:unknown):[number,number]{
  let status:number=STATUS.inactive;
  for(const [i,e] of this.list.entries())if(e.a===a&&e.b===b||e.a===b&&e.b===a){status=e.status;if(status===STATUS.looping)return [status,i];}
  return [status,-1];
 }
 private chooseSoundId(surface:number){
  const [min,max]=COLLISION_LOOKUP[surface];if(min===max)return min;
  for(let retry=0;retry<100;retry++){const id=randomInt(this.random,min,max);if(id!==this.history[surface])return id;}
  return min;
 }
 /** PlayOneShotCollisionSound (0x4DB150): the harder the impact, the earlier in the sample it starts. */
 private playOneShot(a:unknown,b:unknown,surfaceA:number,surfaceB:number,impulse:number,pos:NativeVec){
  const process=(sA:number,sB:number)=>{
   // Pool balls, basketballs and punch bags need mission banks that are not loaded.
   if(sB>=192)return false;
   const sound=this.chooseSoundId(sB);if(sound===-1)return true;
   let offset=COLLISION_LOOKUP[sA][3]*impulse/100;if(sB===188&&sA===SURFACE.ped)offset*=10;offset*=500;
   const startAt=100-Math.min(100,Math.floor(offset));if(startAt>=100)return true;
   const maxStart=COLLISION_LOOKUP[sB][2];
   const play=(volume:number,playTime:number)=>{
    volume+=this.defaultVolume(AE_GENERAL_COLLISION)-3;if(volume<=-100)return;
    const s=this.manager.playSound({slot:SLOT.collisions,sound,entity:this,position:pos,volume,rollOff:2,flags:SOUND.rolledOff|SOUND.startPercentage|SOUND.requestUpdates,speedVariance:.02,playTime});
    this.history[sB]=sound;if(s)this.addToList(a,b,sA,sB,s,STATUS.oneShot);
   };
   if(startAt>maxStart)play(audioLog10((100-startAt)/(100-maxStart))*20,maxStart);else play(0,startAt);
   return true;
  };
  if(process(surfaceA,surfaceB))process(surfaceB,surfaceA);
 }
 private loopingVolumeAndSpeed(a:NativeCollider,b:NativeCollider,forceLooping:boolean):[number,number]{
  const at=(v:NativeVec,t:NativeVec):[number,number]=>{
   const mag=Math.sqrt(Math.max(t.x*t.x+t.y*t.y+t.z*t.z,v.x*v.x+v.y*v.y+v.z*v.z));if(mag===0)return [-100,0];
   let speed=Math.min(Math.sqrt(mag*(COLLISION_LOOKUP[a.surface][3]*COLLISION_LOOKUP[b.surface][3]/10000))*3,.3);if(forceLooping)speed/=6;
   return [this.defaultVolume(AE_GENERAL_COLLISION)+audioLog10(Math.min(speed/.75,1)*20),speed];
  };
  const sub=(p:NativeVec,q:NativeVec)=>({x:p.x-q.x,y:p.y-q.y,z:p.z-q.z});
  if(a.surface===SURFACE.car&&b.surface===SURFACE.car&&a.vehicle&&b.vehicle)return at(sub(a.vehicle.moveSpeed,b.vehicle.moveSpeed),sub(a.vehicle.turnSpeed,b.vehicle.turnSpeed));
  if((b.surface!==SURFACE.ped&&a.surface===SURFACE.car||a.surface!==SURFACE.ped&&b.surface===SURFACE.car)&&a.vehicle)return at(a.vehicle.moveSpeed,a.vehicle.turnSpeed);
  return [-100,0];
 }
 private playLooping(a:NativeCollider,b:NativeCollider,pos:NativeVec,forceLooping:boolean){
  const [volume,speed]=this.loopingVolumeAndSpeed(a,b,forceLooping);
  const fa=a.surface<188?this.surfaceFlags(a.surface):undefined,fb=b.surface<188?this.surfaceFlags(b.surface):undefined;
  const sound=fa?.grass||fb?.grass?0:fa?.water||fb?.water?3:fa?.metal||fb?.metal?2:1;
  const s=this.manager.playSound({slot:SLOT.collisions,sound,entity:this,position:pos,volume,rollOff:2,speed:Math.max(speed,.75)*.8,flags:SOUND.requestUpdates});
  if(s)this.addToList(a.key,b.key,a.surface,b.surface,s,STATUS.looping);
 }
 /** ReportCollision (0x4DBA10). Vehicles resting on buildings use rubber unless the building surface sparks. */
 reportCollision(a:NativeCollider,b:NativeCollider,pos:NativeVec,normal:NativeVec|undefined,impulse:number,relVelSq:number,forceOneShot=false,forceLooping=false){
  if(!this.bank.isSoundBankLoaded(BANK.collisions,SLOT.collisions)||this.active>this.list.length||relVelSq<=0)return;
  const surfaceFor=(e:NativeCollider,other:NativeCollider)=>{
   if(!e.vehicle)return e.surface;
   if(other.building&&normal&&e.vehicle.up.x*normal.x+e.vehicle.up.y*normal.y+e.vehicle.up.z*normal.z>.6&&!other.sparks)return SURFACE.rubber;
   return SURFACE.car;
  };
  const ca={...a,surface:surfaceFor(a,b)},cb={...b,surface:surfaceFor(b,a)};
  if(forceOneShot){this.playOneShot(a.key,b.key,ca.surface,cb.surface,impulse,pos);return;}
  const [status,index]=this.status(a.key,b.key);
  if(status===STATUS.inactive){if(forceLooping)this.playLooping(ca,cb,pos,forceLooping);else this.playOneShot(a.key,b.key,ca.surface,cb.surface,impulse,pos);}
  else if(status===STATUS.oneShot)this.playLooping(ca,cb,pos,forceLooping);
  else{
   const e=this.list[index];e.loopStop=this.time+100;
   if(e.sound){const [volume,speed]=this.loopingVolumeAndSpeed(ca,cb,forceLooping);e.sound.speed=stepTo(Math.max(.75,speed),e.sound.speed,.1);e.sound.volume=stepTo(volume,e.sound.volume,1);e.sound.setPosition(pos);}
  }
 }
 /** ReportBulletHit (0x4DBDF0) and PlayBulletHitCollisionSound (0x4DB7C0): vehicles report SURFACE_CAR with its SURFAUD.DAT flags. `angle` is asin(-dir·normal) in degrees. */
 reportBulletHit(surface:number,pos:NativeVec,angle:number){
  if(!this.bank.isSoundBankLoaded(BANK.bulletHits,SLOT.bulletHits))return;
  const play=(min:number,max:number,volumeOffset=0,rollOff=1.5)=>{
   let id=randomInt(this.random,min,max);for(let retry=0;retry<100&&id===this.lastBulletHit;retry++)id=randomInt(this.random,min,max);
   this.lastBulletHit=id;this.manager.playSound({slot:SLOT.bulletHits,sound:id,entity:this,position:pos,volume:this.defaultVolume(AE_BULLET_HIT)+volumeOffset,rollOff,speedVariance:.02});
  };
  const f=surface<188?this.surfaceFlags(surface):undefined;
  if(surface===SURFACE.ped)play(7,9);
  else if(f?.water)play(16,18,6,2);
  else if(f?.wood)play(19,21);
  else if(f?.metal){if(resolveProbability(this.random,(90-angle)/180))play(10,12);else play(4,6);}
  else if(f?.gravel||f?.concrete||f?.tile)play(13,15);
  else play(1,3);
 }
 /** ReportWaterSplash(CPhysical*, -100, false) (0x4DAE40) for a vehicle: only while it falls faster than 0.1 units per frame and no splash of its
  * own is still playing, a pair of splash samples at 0.94 speed, louder with speed (20·log10(min(0.6, |v|)), at least −18 dB). */
  reportVehicleWaterSplash(physical:NativePhysicalEntity,moveSpeed:NativeVec){
   if(moveSpeed.z>-.1)return;
   if([1,2,3].some(event=>this.manager.areSoundsOfThisEventPlayingForThisEntityAndPhysical(event,this,physical)))return;
   if(!this.bank.isSoundBankLoaded(BANK.collisions,SLOT.collisions)){this.bank.loadSoundBank(BANK.collisions,SLOT.collisions);return;}
   const position=physical.position();if(!position)return;
   const volume=Math.max(audioLog10(Math.min(.6,Math.hypot(moveSpeed.x,moveSpeed.y,moveSpeed.z)))*20,-18)+this.defaultVolume(AE_WATER_SPLASH);
   this.manager.playSound({slot:SLOT.collisions,sound:67,entity:this,position,volume,rollOff:2.5,speed:.94,flags:SOUND.requestUpdates,event:1});
   this.manager.playSound({slot:SLOT.collisions,sound:66,entity:this,position,volume,rollOff:2.5,speed:.94,flags:SOUND.requestUpdates|SOUND.lifespanTiedToEntity,physical,event:3,clientVariable:this.time+248});
  }
  private waveLast=new Map<object,number>();
  /** AE_BOAT_HIT_WAVE (event 99) for hulls: the collisions-bank splash end (66)
   * at clamp(volume/800), at most every 1500 ms per hull. Volumes below 450 stay
   * silent; the underwater and frequency-variation branches are omitted. */
  reportBoatWaveHit(key:object,position:NativeVec,volume:number){
   if(volume<450)return;
   const vol=Math.min(volume/800,1);if(vol<=.00001)return;
   if(this.time<(this.waveLast.get(key)??-Infinity)+1500)return;
   if(!this.bank.isSoundBankLoaded(BANK.collisions,SLOT.collisions)){this.bank.loadSoundBank(BANK.collisions,SLOT.collisions);return;}
   this.waveLast.set(key,this.time);
   this.manager.playSound({slot:SLOT.collisions,sound:66,entity:this,position,volume:audioLog10(vol)*20,rollOff:2});
  }
 /** Service (0x4DA2C0): looping scrapes stop 100 ms after their last report. */
 service(){
  for(const e of this.list){
   if(e.status!==STATUS.looping||this.time<e.loopStop)continue;
   e.sound?.stopSoundAndForget();Object.assign(e,{a:undefined,b:undefined,sound:undefined,status:STATUS.inactive,loopStop:0,surfaceA:195,surfaceB:195});this.active--;
  }
 }
 /** Finished one-shots leave the list so a new impact can start (CAECollisionAudioEntity's UpdateParameters is not reversed). */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition!==-1)return;
  const e=this.list.find(e=>e.sound===sound);if(!e)return;
  Object.assign(e,{a:undefined,b:undefined,sound:undefined,status:STATUS.inactive,loopStop:0,surfaceA:195,surfaceB:195});this.active=Math.max(0,this.active-1);
 }
}
