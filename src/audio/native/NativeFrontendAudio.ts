import {SOUND,type NativeAudioEntity,type NativeSound} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
/** Frontend pickup events reported by CPickup::Update, CPickups::GivePlayerGoodiesWithPickUpMI and the collectable counters. */
export const AE_FRONTEND={select:1,back:2,highlight:3,error:4,carNoCash:14,carIsHot:15,carRespray:16,purchaseWeapon:40,race321:44,raceGo:45,buyCarMod:46,fireFailSniper:41,fireFailRocket:42,pickupWeapon:6,pickupMoney:7,pickupHealth:8,pickupAdrenaline:9,pickupBodyArmour:10,pickupInfo:11,pickupDrugs:12,pickupCollectable1:13,
 bulletPassLeftRear:27,bulletPassLeftFront:28,bulletPassRightRear:29,bulletPassRightFront:30,timerCount:33,partMissionComplete:43,scannerNoiseStart:47,scannerNoiseStop:48,scannerClick:49} as const;
/** The menu events' FRONTEND_MENU sounds, left and right. */
const MENU_PAIRS:Readonly<Record<number,readonly [number,number]>>={1:[6,7],2:[0,1],3:[4,5],4:[2,3]};
/** SND_BANK_GENRL_BULLET_PASS_1 to _4 and SND_BANK_SLOT_BULLET_PASS. */
const BULLET_PASS_FIRST=28,BULLET_PASS_LAST=31,BULLET_PASS_SLOT=42;
const BULLET_PASS_POSITION:Readonly<Record<number,{x:number;y:number;z:number}>>={27:{x:-.1,y:-1,z:0},28:{x:-.1,y:1,z:0},29:{x:.1,y:-1,z:0},30:{x:.1,y:1,z:0}};
/** CAEFrontendAudioEntity::AddAudioEvent (0x4DD4A0) pickup cases: stereo front-end pairs from FRONTEND_GAME with a five-frame retrigger guard.
 * The function is still a plugin call upstream; its commented decompilation is followed. */
export class NativeFrontendAudio implements NativeAudioEntity {
 private lastGeneral=-5;private lastMissionComplete=-5;
 /** m_nLatestTimerCount: when AE_FRONTEND_TIMER_COUNT last found its sounds already playing. */
 private latestTimerCount=0;
 /** m_BulletPassBank, m_BulletPassCount and m_nLastFrameBulletPass. */
 private bulletPassBank=BULLET_PASS_FIRST;private bulletPassCount=0;private lastFrameBulletPass=0;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number,private random:()=>number=Math.random){
  // CAEFrontendAudioEntity::Initialise loads the menu bank and the first bullet-pass bank.
  bank.loadSoundBank(BANK.frontendMenu,SLOT.frontendMenu);
  bank.loadSoundBank(BULLET_PASS_FIRST,BULLET_PASS_SLOT);
 }
 addAudioEvent(event:number,volumeBoost=0,speed=1){
  const pass=BULLET_PASS_POSITION[event];
  if(pass){this.bulletPass(pass,this.defaultVolume(event)+volumeBoost);return;}
  // AE_FRONTEND_SCANNER_NOISE_STOP cancels the scanner's noise, loaded bank or not (arm64 0x1001478d0).
  if(event===AE_FRONTEND.scannerNoiseStop){this.manager.cancelSoundsOfThisEventPlayingForThisEntity(AE_FRONTEND.scannerNoiseStart,this);return;}
  // AE_FRONTEND_CAR_RESPRAY (arm64 0x1001481a4): WEAPONS sound 28 left and right, one of them (a coin toss which)
  // pitched up 1.189 (two semitones), once WEAPONS is in its slot.
  if(event===AE_FRONTEND.carRespray){
   if(!this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen))return;
   const volume=this.defaultVolume(event)+volumeBoost,leftHigh=this.random()<.5;
   for(const [x,high] of [[-1,leftHigh],[1,!leftHigh]] as const)this.manager.playSound({slot:SLOT.weaponGen,sound:28,entity:this,position:{x,y:0,z:0},volume,rollOff:1,speed:high?1.189:1,event,
    flags:SOUND.forcedFront|SOUND.unduckable|SOUND.playPhysically|SOUND.requestUpdates|SOUND.uncancellable|SOUND.frontEnd});
   return;
  }
  // AE_FRONTEND_SELECT, _BACK, _HIGHLIGHT and _ERROR: a pair from FRONTEND_MENU left and right, as the iOS executable
  // plays them (highlight 0x100147b44, select 0x100147c18: sounds 4 and 5, 6 and 7, roll-off 1, the highlight not
  // rolled off), which is gta-reversed's commented decompilation.
  const menu=MENU_PAIRS[event];
  if(menu){
   if(!this.bank.isSoundBankLoaded(BANK.frontendMenu,SLOT.frontendMenu))return;
   const volume=this.defaultVolume(event)+volumeBoost,flags=SOUND.forcedFront|SOUND.unduckable|SOUND.unpausable|SOUND.playPhysically|SOUND.uncancellable|SOUND.frontEnd|(event===AE_FRONTEND.highlight?0:SOUND.rolledOff);
   for(const [sound,x] of [[menu[0],-1],[menu[1],1]] as const)this.manager.playSound({slot:SLOT.frontendMenu,sound,entity:this,position:{x,y:0,z:0},volume,rollOff:1,speed,flags});
   return;
  }
  if(!this.bank.isSoundBankLoaded(BANK.frontendGame,SLOT.frontendGame)){this.bank.loadSoundBank(BANK.frontendGame,SLOT.frontendGame);return;}
  const frame=this.manager.clock.frame,volume=this.defaultVolume(event)+volumeBoost;
  const pairAt=(left:number,right:number,at:number)=>{for(const [sound,x] of [[left,-1],[right,1]] as const)this.manager.playSound({slot:SLOT.frontendGame,sound,entity:this,position:{x,y:0,z:0},volume,speed:at,flags:SOUND.forcedFront|SOUND.unduckable|SOUND.unpausable|SOUND.playPhysically|SOUND.uncancellable|SOUND.frontEnd});};
  const pair=(left:number,right:number)=>pairAt(left,right,speed);
  switch(event){
   case AE_FRONTEND.pickupWeapon:case AE_FRONTEND.purchaseWeapon:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pair(27,28);}break;
   // AE_FRONTEND_CAR_NO_CASH and _CAR_IS_HOT (arm64 0x1001471f0): the same pair at 0.841 speed, under the same guard.
   case AE_FRONTEND.carNoCash:case AE_FRONTEND.carIsHot:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pairAt(27,28,.841);}break;
   // AE_FRONTEND_RACE_321 and _RACE_GO (0x1001478e8, 0x1001484e4): frontend sounds 6 and 7, 12 and 13, rolled off.
   case AE_FRONTEND.race321:case AE_FRONTEND.raceGo:{
    const [left,right]=event===AE_FRONTEND.race321?[6,7]:[12,13];
    for(const [sound,x] of [[left,-1],[right,1]] as const)this.manager.playSound({slot:SLOT.frontendGame,sound,entity:this,position:{x,y:0,z:0},volume,rollOff:1,speed,flags:SOUND.forcedFront|SOUND.rolledOff|SOUND.unduckable|SOUND.unpausable|SOUND.playPhysically|SOUND.uncancellable|SOUND.frontEnd});
    break;
   }
   // AE_FRONTEND_BUY_CAR_MOD (0x1001485b8): frontend sound 9 ahead, with 0.0588 of speed variance.
   case AE_FRONTEND.buyCarMod:
    this.manager.playSound({slot:SLOT.frontendGame,sound:9,entity:this,position:{x:0,y:1,z:0},volume,rollOff:1,speed:1,speedVariance:.0588,flags:SOUND.unduckable|SOUND.unpausable|SOUND.playPhysically|SOUND.uncancellable|SOUND.frontEnd});
    break;
   case AE_FRONTEND.pickupMoney:case AE_FRONTEND.pickupHealth:case AE_FRONTEND.pickupAdrenaline:case AE_FRONTEND.pickupBodyArmour:if(frame>=this.lastGeneral+5){this.lastGeneral=frame;pair(16,17);}break;
   case AE_FRONTEND.pickupInfo:pair(14,15);break;
   // AE_FRONTEND_FIRE_FAIL_SNIPERRIFFLE / _ROCKET: frontend sound 10 or 11 ahead of the listener.
   case AE_FRONTEND.fireFailSniper:case AE_FRONTEND.fireFailRocket:
    this.manager.playSound({slot:SLOT.frontendGame,sound:event===AE_FRONTEND.fireFailSniper?10:11,entity:this,position:{x:0,y:1,z:0},volume,rollOff:1,speed,flags:SOUND.frontEnd|SOUND.uncancellable});break;
   // AE_FRONTEND_TIMER_COUNT: frontend sounds 4 and 5 left and right, kept going while the countdown reports every
   // frame; UpdateParameters stops them 100 ms after the last report.
   case AE_FRONTEND.timerCount:
    if(this.manager.areSoundsOfThisEventPlayingForThisEntity(AE_FRONTEND.timerCount,this)){this.latestTimerCount=this.manager.clock.timeMs;return;}
    for(const [sound,x] of [[4,-1],[5,1]] as const)this.manager.playSound({slot:SLOT.frontendGame,sound,entity:this,position:{x,y:0,z:0},volume,rollOff:1,speed,doppler:1,event:AE_FRONTEND.timerCount,
     flags:SOUND.forcedFront|SOUND.unduckable|SOUND.playPhysically|SOUND.requestUpdates|SOUND.uncancellable|SOUND.frontEnd});
    break;
   case AE_FRONTEND.pickupDrugs:case AE_FRONTEND.pickupCollectable1:case AE_FRONTEND.partMissionComplete:if(frame>=this.lastMissionComplete+5){this.lastMissionComplete=frame;pair(18,19);}break;
   // AE_FRONTEND_SCANNER_NOISE_START and _CLICK: the scanner's static loop (frontend sound 3) and its click (24) ahead
   // of the listener, one of each at a time (arm64 0x100147798 and 0x100147f68).
   case AE_FRONTEND.scannerNoiseStart:case AE_FRONTEND.scannerClick:
    if(this.manager.areSoundsOfThisEventPlayingForThisEntity(event,this))return;
    this.manager.playSound({slot:SLOT.frontendGame,sound:event===AE_FRONTEND.scannerClick?24:3,entity:this,position:{x:0,y:1,z:0},volume,rollOff:1,speed,doppler:1,event,
     flags:SOUND.frontEnd|SOUND.uncancellable|SOUND.unduckable});
    break;
  }
 }
 /** The bullet-pass cases (AE_FRONTEND_BULLET_PASS_*): one of three whizzes from the current bank, at most every five
  * frames. After ten, the next bank is loaded once the slot falls silent. */
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
 /** CAEFrontendAudioEntity::UpdateParameters (0x4DEDA0): the timer count stops 100 ms after its last report. */
 updateParameters(sound:NativeSound,playPosition:number){
  if(sound.event===AE_FRONTEND.timerCount&&playPosition>0&&this.manager.clock.timeMs>this.latestTimerCount+100)sound.stopSoundAndForget();
 }
}
