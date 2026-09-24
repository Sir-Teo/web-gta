import {SOUND,type NativeAudioEntity,type NativeSound} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
/** Frontend pickup events reported by CPickup::Update, CPickups::GivePlayerGoodiesWithPickUpMI and the collectable counters. */
export const AE_FRONTEND={fireFailSniper:41,fireFailRocket:42,pickupWeapon:6,pickupMoney:7,pickupHealth:8,pickupAdrenaline:9,pickupBodyArmour:10,pickupInfo:11,pickupDrugs:12,pickupCollectable1:13,
 bulletPassLeftRear:27,bulletPassLeftFront:28,bulletPassRightRear:29,bulletPassRightFront:30,partMissionComplete:43} as const;
/** SND_BANK_GENRL_BULLET_PASS_1 to _4 and SND_BANK_SLOT_BULLET_PASS. */
const BULLET_PASS_FIRST=28,BULLET_PASS_LAST=31,BULLET_PASS_SLOT=42;
const BULLET_PASS_POSITION:Readonly<Record<number,{x:number;y:number;z:number}>>={27:{x:-.1,y:-1,z:0},28:{x:-.1,y:1,z:0},29:{x:.1,y:-1,z:0},30:{x:.1,y:1,z:0}};
/** CAEFrontendAudioEntity::AddAudioEvent (0x4DD4A0) pickup cases: stereo front-end pairs from FRONTEND_GAME with a five-frame retrigger guard.
 * The function is still a plugin call upstream; its commented decompilation is followed. */
export class NativeFrontendAudio implements NativeAudioEntity {
 private lastGeneral=-5;private lastMissionComplete=-5;
 /** m_BulletPassBank, m_BulletPassCount and m_nLastFrameBulletPass. */
 private bulletPassBank=BULLET_PASS_FIRST;private bulletPassCount=0;private lastFrameBulletPass=0;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number,private random:()=>number=Math.random){
  // CAEFrontendAudioEntity::Initialise loads the first bullet-pass bank.
  bank.loadSoundBank(BULLET_PASS_FIRST,BULLET_PASS_SLOT);
 }
 addAudioEvent(event:number,volumeBoost=0,speed=1){
  const pass=BULLET_PASS_POSITION[event];
  if(pass){this.bulletPass(pass,this.defaultVolume(event)+volumeBoost);return;}
  if(!this.bank.isSoundBankLoaded(BANK.frontendGame,SLOT.frontendGame)){this.bank.loadSoundBank(BANK.frontendGame,SLOT.frontendGame);return;}
  const frame=this.manager.clock.frame,volume=this.defaultVolume(event)+volumeBoost;
  const pair=(left:number,right:number)=>{for(const [sound,x] of [[left,-1],[right,1]] as const)this.manager.playSound({slot:SLOT.frontendGame,sound,entity:this,position:{x,y:0,z:0},volume,speed,flags:SOUND.forcedFront|SOUND.unduckable|SOUND.unpausable|SOUND.playPhysically|SOUND.uncancellable|SOUND.frontEnd});};
  switch(event){
   case AE_FRONTEND.pickupWeapon:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pair(27,28);}break;
   case AE_FRONTEND.pickupMoney:case AE_FRONTEND.pickupHealth:case AE_FRONTEND.pickupAdrenaline:case AE_FRONTEND.pickupBodyArmour:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pair(16,17);}break;
   case AE_FRONTEND.pickupInfo:pair(14,15);break;
   // AE_FRONTEND_FIRE_FAIL_SNIPERRIFFLE / _ROCKET: frontend sound 10 or 11 ahead of the listener.
   case AE_FRONTEND.fireFailSniper:case AE_FRONTEND.fireFailRocket:
    this.manager.playSound({slot:SLOT.frontendGame,sound:event===AE_FRONTEND.fireFailSniper?10:11,entity:this,position:{x:0,y:1,z:0},volume,rollOff:1,speed,flags:SOUND.frontEnd|SOUND.uncancellable});break;
   case AE_FRONTEND.pickupDrugs:case AE_FRONTEND.pickupCollectable1:case AE_FRONTEND.partMissionComplete:if(frame>=this.lastMissionComplete+5){this.lastMissionComplete=frame;pair(18,19);}break;
  }
 }
 /** The bullet-pass cases (AE_FRONTEND_BULLET_PASS_*): one of three whizzes from the current bank, at most every five
  * frames. After ten, the next bank is loaded once the slot falls silent. The GENRL bullet-pass banks are not packaged
  * with the audio yet, so this stays quiet until they are. */
 private bulletPass(position:{x:number;y:number;z:number},volume:number){
  const frame=this.manager.clock.frame;
  if(!this.bank.isSoundBankLoaded(this.bulletPassBank,BULLET_PASS_SLOT)||frame<this.lastFrameBulletPass+5)return;
  if(this.bulletPassCount>10){
   if(!this.manager.areSoundsPlayingInBankSlot(BULLET_PASS_SLOT)){
    this.bulletPassBank=this.bulletPassBank>=BULLET_PASS_LAST?BULLET_PASS_FIRST:this.bulletPassBank+1;
    this.bank.loadSoundBank(this.bulletPassBank,BULLET_PASS_SLOT);this.bulletPassCount=0;
   }
   return;
  }
  this.lastFrameBulletPass=frame;
  this.manager.playSound({slot:BULLET_PASS_SLOT,sound:Math.floor(this.random()*3),entity:this,position,volume,rollOff:1,speed:1,doppler:1,flags:SOUND.requestUpdates|SOUND.frontEnd,speedVariance:.03125});
  this.bulletPassCount++;
 }
 updateParameters(_sound:NativeSound,_playPosition:number){}
}
