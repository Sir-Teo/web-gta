import {SOUND,type NativeAudioEntity,type NativeSound} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
/** Frontend pickup events reported by CPickup::Update, CPickups::GivePlayerGoodiesWithPickUpMI and the collectable counters. */
export const AE_FRONTEND={pickupWeapon:6,pickupMoney:7,pickupHealth:8,pickupAdrenaline:9,pickupBodyArmour:10,pickupInfo:11,pickupDrugs:12,pickupCollectable1:13,partMissionComplete:43} as const;
/** CAEFrontendAudioEntity::AddAudioEvent (0x4DD4A0) pickup cases: stereo front-end pairs from FRONTEND_GAME with a five-frame retrigger guard.
 * The function is still a plugin call upstream; its commented decompilation is followed. */
export class NativeFrontendAudio implements NativeAudioEntity {
 private lastGeneral=-5;private lastMissionComplete=-5;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number){}
 addAudioEvent(event:number,volumeBoost=0,speed=1){
  if(!this.bank.isSoundBankLoaded(BANK.frontendGame,SLOT.frontendGame)){this.bank.loadSoundBank(BANK.frontendGame,SLOT.frontendGame);return;}
  const frame=this.manager.clock.frame,volume=this.defaultVolume(event)+volumeBoost;
  const pair=(left:number,right:number)=>{for(const [sound,x] of [[left,-1],[right,1]] as const)this.manager.playSound({slot:SLOT.frontendGame,sound,entity:this,position:{x,y:0,z:0},volume,speed,flags:SOUND.forcedFront|SOUND.unduckable|SOUND.unpausable|SOUND.playPhysically|SOUND.uncancellable|SOUND.frontEnd});};
  switch(event){
   case AE_FRONTEND.pickupWeapon:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pair(27,28);}break;
   case AE_FRONTEND.pickupMoney:case AE_FRONTEND.pickupHealth:case AE_FRONTEND.pickupAdrenaline:case AE_FRONTEND.pickupBodyArmour:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pair(16,17);}break;
   case AE_FRONTEND.pickupInfo:pair(14,15);break;
   case AE_FRONTEND.pickupDrugs:case AE_FRONTEND.pickupCollectable1:case AE_FRONTEND.partMissionComplete:if(frame>=this.lastMissionComplete+5){this.lastMissionComplete=frame;pair(18,19);}break;
  }
 }
 updateParameters(_sound:NativeSound,_playPosition:number){}
}
