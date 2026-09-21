import type {NativeSoundManager} from './NativeSoundManager';
import {SOUND,type NativeSound,type NativeVec} from './NativeSound';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
/* CAEWaterCannonAudioEntity (gta-reversed ead3051): the fire truck's water cannon. Service keeps four sounds while
 * the frontend game and collision banks are loaded: two follow the jet's last section, the frontend bank's sound 0
 * at speed 1.78 and volume +6 and the collision bank's sound 3 at speed 0.5 and volume -9, and two more sit where
 * the jet last splashed, the same collision sound at speed 1 and volume -3 and again at half that speed and six
 * decibels quieter. Each is started once with SOUND_REQUEST_UPDATES and then has its volume, speed and position
 * moved every service; a sound that stops clears its slot. All four roll off at 2. The jet's pair plays while the
 * cannon's last section is in use and it has an id; the splash pair plays while CWaterCannon::Update has reported
 * a splash point, which it does where the jet's line first hits the world. */
export const CANNON_JET_SPEED=1.78,CANNON_JET_VOLUME=6,CANNON_HISS_SPEED=.5,CANNON_HISS_VOLUME=-9;
export const CANNON_SPLASH_SPEED=1,CANNON_SPLASH_VOLUME=-3,CANNON_SPLASH_TAIL_SPEED=.5,CANNON_SPLASH_TAIL_VOLUME=-9;
export const CANNON_ROLL_OFF=2;
/** The four voices in Service's order: the jet, its hiss, the splash and the splash tail. */
export const CANNON_VOICES=[
 {slot:SLOT.frontendGame,sound:0,speed:CANNON_JET_SPEED,volume:CANNON_JET_VOLUME,splash:false},
 {slot:SLOT.collisions,sound:3,speed:CANNON_HISS_SPEED,volume:CANNON_HISS_VOLUME,splash:false},
 {slot:SLOT.collisions,sound:3,speed:CANNON_SPLASH_SPEED,volume:CANNON_SPLASH_VOLUME,splash:true},
 {slot:SLOT.collisions,sound:3,speed:CANNON_SPLASH_TAIL_SPEED,volume:CANNON_SPLASH_TAIL_VOLUME,splash:true},
] as const;
export class NativeWaterCannonAudio {
 private sounds:(NativeSound|undefined)[]=[undefined,undefined,undefined,undefined];
 private splash?:{position:NativeVec;magnitude:number};
 /** Started voices, for a snapshot. */
 started=0;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader){}
 /** CWaterCannon::Update's SetSplashInfo where the jet's line first hits the world. */
 setSplash(position:NativeVec,magnitude:number){this.splash={position:{...position},magnitude};}
 clearSplash(){this.splash=undefined;}
 /** CAEAudioEntity::UpdateParameters: a sound that has stopped releases its slot. */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition!==-1)return;
  for(const [i,held] of this.sounds.entries())if(held===sound)this.sounds[i]=undefined;
 }
 private voice(index:number,enabled:boolean,position:NativeVec|undefined){
  const spec=CANNON_VOICES[index],sound=this.sounds[index];
  if(enabled&&position){
   if(sound){sound.volume=spec.volume;sound.speed=spec.speed;sound.setPosition(position);}
   else this.sounds[index]=this.manager.playSound({slot:spec.slot,sound:spec.sound,entity:this,position,volume:spec.volume,rollOff:CANNON_ROLL_OFF,speed:spec.speed,flags:SOUND.requestUpdates})??undefined,this.started++;
   return;
  }
  if(sound){sound.stopSound();this.sounds[index]=undefined;}
 }
 /** CAEWaterCannonAudioEntity::Service: `jet` is the cannon's last section point while it is firing. */
 service(jet:NativeVec|undefined){
  if(!this.bank.isSoundBankLoaded(BANK.frontendGame,SLOT.frontendGame)||!this.bank.isSoundBankLoaded(BANK.collisions,SLOT.collisions))return;
  for(const [i,spec] of CANNON_VOICES.entries()){
   const position=spec.splash?this.splash?.position:jet;
   this.voice(i,spec.splash?!!this.splash:!!jet,position);
  }
 }
 /** Every voice goes when the cannon does (Terminate). */
 terminate(){for(const [i,sound] of this.sounds.entries()){sound?.stopSound();this.sounds[i]=undefined;}this.splash=undefined;}
 snapshot(){return {playing:this.sounds.filter(Boolean).length,started:this.started,splash:!!this.splash};}
}
