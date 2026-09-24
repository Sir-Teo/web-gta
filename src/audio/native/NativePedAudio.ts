import {SOUND,type NativeAudioEntity,type NativePhysicalEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import type {NativeBankLoader} from './NativeBankLoader';
import {BANK,SLOT} from './NativeBankLoader';
import {randomInt,type AudioRandom} from './nativeAudioUtility';
import type {SurfaceAudioFlags} from '../../assets/surfaceAudio';
/** eSoundBankSlot and eSoundBank values for ped sounds. */
const SLOT_FOOTSTEPS_PLAYER=30,SLOT_SWIMMING=32,SLOT_FOOTSTEPS_GENERIC=41;
const FEET={generic:0,grass:1,gravel:2,metal:3,sand:4,tile:5,wood:6} as const,BANK_SWIMMING=128;
export const AE_PED={footstepLeft:54,footstepRight:55,landOnFeetAfterFall:58,collapseAfterFall:59,swimStrokeSplash:74,swimDiveSplash:75,swimWake:76} as const;
/** CPed::DoFootLanded footstep event volume and speed by movement. */
export function nativeFootstepLevel(move:'walk'|'run'|'sprint',ducking:boolean,sneaking=false):[number,number]{
 if(ducking)return [-18,.8];
 const [v,s]=move==='sprint'?[0,1.2]:move==='run'?[-6,1.1]:[-12,.9];
 return sneaking?[v-6,s-.1]:[v,s];
}
/** CAEPedAudioEntity footstep and landing events (gta-reversed 0076f901, 0x4E13A0 and 0x4E18E0). */
export class NativePedAudio implements NativeAudioEntity {
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private random:AudioRandom,private defaultVolume:(event:number)=>number,private ped:NativePhysicalEntity&{player:boolean}){
  // CAEPedAudioEntity::StaticInitialise
  bank.loadSoundBank(FEET.generic,SLOT_FOOTSTEPS_GENERIC);bank.loadSoundBank(BANK_SWIMMING,SLOT_SWIMMING);
 }
 /** Footstep samples this entity actually started, for diagnostics. */
 footstepsPlayed=0;
 private play(slot:number,sound:number,volume:number,speed:number,playTime=0){
  const position=this.ped.position();if(!position)return;
  this.manager.playSound({slot,sound,entity:this,position,volume,speed,flags:SOUND.startPercentage,speedVariance:.0588,playTime,physical:this.ped});
 }
 /** HandleFootstepEvent: generic steps for other peds and concrete, surface banks for the player's own slot. */
 footstep(event:number,volume:number,speed:number,surface:SurfaceAudioFlags|undefined,inAir=false){
  volume+=this.defaultVolume(event);if(inAir)return;
  // The decompiled helper tests FEET_GENERIC in every slot, which would mute the player's surface banks; the requested bank is tested.
  const playFoot=(bank:number,slot:number,sound:number,playTime=0)=>{if(this.bank.isSoundBankLoaded(bank,slot)){this.play(slot,sound,volume,speed,playTime);this.footstepsPlayed++;}else this.bank.loadSoundBank(bank,slot);};
  const generic=()=>playFoot(FEET.generic,SLOT_FOOTSTEPS_GENERIC,randomInt(this.random,1,5));
  if(!this.ped.player){generic();return;}
  const player=(bank:number,slot:number,sound:number,cancel=false)=>{
   if(this.bank.isSoundBankLoaded(bank,slot)){playFoot(bank,slot,sound);return;}
   if(cancel&&this.manager.areSoundsPlayingInBankSlot(slot)-1<=1)this.manager.cancelSoundsInBankSlot(slot,false);
   this.bank.loadSoundBank(bank,slot);generic();
  };
  if(surface?.water)player(BANK_SWIMMING,SLOT_SWIMMING,randomInt(this.random,0,4));
  else if(surface?.concrete)generic();
  else if(surface?.grass||surface?.longGrass)player(FEET.grass,SLOT_FOOTSTEPS_PLAYER,randomInt(this.random,0,4),true);
  else if(surface?.sand)player(FEET.sand,SLOT_FOOTSTEPS_PLAYER,randomInt(this.random,0,3),true);
  else if(surface?.gravel)player(FEET.gravel,SLOT_FOOTSTEPS_PLAYER,randomInt(this.random,0,4),true);
  else if(surface?.wood)player(FEET.wood,SLOT_FOOTSTEPS_PLAYER,randomInt(this.random,0,4),true);
  else if(surface?.tile)player(FEET.tile,SLOT_FOOTSTEPS_PLAYER,randomInt(this.random,0,4),true);
  else if(surface?.metal)player(FEET.metal,SLOT_FOOTSTEPS_PLAYER,randomInt(this.random,0,4),true);
  else generic();
 }
 /** HandleLandingEvent: generic landing (6) or collapse (0), or a swim splash on water. */
 landing(event:number,surface:SurfaceAudioFlags|undefined){
  const volume=this.defaultVolume(event);
  if(surface?.water){if(this.bank.isSoundBankLoaded(BANK_SWIMMING,SLOT_SWIMMING))this.play(SLOT_SWIMMING,randomInt(this.random,0,4),Math.max(0,volume),1,50);else this.bank.loadSoundBank(BANK_SWIMMING,SLOT_SWIMMING);}
  else if(this.bank.isSoundBankLoaded(FEET.generic,SLOT_FOOTSTEPS_GENERIC))this.play(SLOT_FOOTSTEPS_GENERIC,event===AE_PED.landOnFeetAfterFall?6:0,volume,1);
  else this.bank.loadSoundBank(FEET.generic,SLOT_FOOTSTEPS_GENERIC);
 }
 /** HandleSwimSplash: stroke and dive splashes cycle the swimming bank. */
 swimSplash(event:number){
  if(!this.bank.isSoundBankLoaded(BANK_SWIMMING,SLOT_SWIMMING)){this.bank.loadSoundBank(BANK_SWIMMING,SLOT_SWIMMING);return;}
  const position=this.ped.position();if(!position)return;
  // HandleSwimSplash plays physically, from a start percentage, unduckable (bit 0x100). The reversed m_nSfxId + 1 runs
  // past the bank, so the sample stays the port's pick.
  this.manager.playSound({slot:SLOT_SWIMMING,sound:randomInt(this.random,0,4),entity:this,position,volume:this.defaultVolume(event),speed:1,flags:SOUND.playPhysically|SOUND.startPercentage|SOUND.unduckable,speedVariance:.0588,physical:this.ped});
 }
 /** NPC wading/water-entry splash (CAEPedAudioEntity reporter shared with the
  * player bank; NPC steps otherwise stay generic per source). */
 npcSplash(position:NativeVec){
  if(!this.bank.isSoundBankLoaded(BANK_SWIMMING,SLOT_SWIMMING)){this.bank.loadSoundBank(BANK_SWIMMING,SLOT_SWIMMING);return;}
  this.manager.playSound({slot:SLOT_SWIMMING,sound:randomInt(this.random,0,4),entity:this,position,volume:this.defaultVolume(AE_PED.swimStrokeSplash),speed:1,flags:SOUND.startPercentage,speedVariance:.0588,physical:this.ped});
 }
 /** HandlePedHit vocals: pain cry on damage, block clack on defended melee. */
 pedHit(blocked:boolean,weapon=0){
  const position=this.ped.position();if(!position)return;
  if(this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen))this.manager.playSound({slot:SLOT.weaponGen,sound:30+(weapon%6)+(blocked?5:0),entity:this,position,volume:this.defaultVolume(blocked?112:110),speed:1,physical:this.ped});
 }
 /** HandleSwimWake (0x4E2790): the sprint wake loop on the collisions bank, tied to the ped, started at default − 20;
  * each call marks the wake as triggered (m_LastSwimWakeTriggerTimeMs). */
 private lastSwimWake=0;
 swimWake(){
  if(!this.bank.isSoundBankLoaded(BANK.collisions,SLOT.collisions)){this.bank.loadSoundBank(BANK.collisions,SLOT.collisions);return;}
  const position=this.ped.position();if(!position)return;
  if(!this.manager.areSoundsOfThisEventPlayingForThisEntity(AE_PED.swimWake,this))
   this.manager.playSound({slot:SLOT.collisions,sound:3,entity:this,position,volume:this.defaultVolume(AE_PED.swimWake)-20,rollOff:1,speed:.75,flags:SOUND.requestUpdates|SOUND.lifespanTiedToEntity,event:AE_PED.swimWake,physical:this.ped});
  this.lastSwimWake=this.manager.clock.timeMs;
 }
 /** UpdateParameters' AE_PED_SWIM_WAKE (0x4E1A40): while a wake was triggered in the last 100 ms the loop rises 0.6 dB
  * an update to the default volume, otherwise it sinks 0.6 dB an update and stops at default − 20. The reversed code
  * snaps to the default within 0.6 but loses the plain rise; its fall mirrors it, so the rise is kept. */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition===-1||sound.event!==AE_PED.swimWake)return;
  const volume=this.defaultVolume(AE_PED.swimWake);
  if(this.manager.clock.timeMs<=this.lastSwimWake+100){if(sound.volume<volume)sound.volume=Math.min(volume,sound.volume+.6);}
  else if(sound.volume<=volume-20){sound.stopSoundAndForget();this.lastSwimWake=0;}
  else sound.volume=Math.max(sound.volume-.6,volume-20);
 }
}
export type {NativeVec};
