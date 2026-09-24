import {NativeAudioEnvironment,SOUND,type NativeAudioEntity,type NativePhysicalEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
import {randomFloat,resolveProbability,type AudioRandom} from './nativeAudioUtility';
/** eAudioEvents used by weapons and explosions. */
export const AE_WEAPON={fire:145,reloadA:146,reloadB:147,firePlane:149,fireMinigunAmmo:150,fireMinigunNoAmmo:151,fireMinigunPlane:152,chainsawIdle:153,chainsawActive:154,chainsawCutting:155,stealthKill:156,fireMinigunStop:157,flamethrowerIdle:158,explosion:129} as const;
const CAT={tail:1,flame:2,spray:3,ext:4,minigunSpin:5,minigunFire:6,minigunTail:7,minigunStop:8,chainsawIdle:9,chainsawActive:10,chainsawStop:12,stealthKnifeIn:13,stealthKnifeOut:14} as const;
const MINIGUN={spinning:0,firing:1,stopping:2,stopped:3} as const;
const CHAINSAW={idle:0,active:1,cutting:2,stopping:3,stopped:4} as const;
const BANK_CHAINSAW_P=36;
type GunSounds=readonly [dry:number,sub:number,left:number,right:number,tail:number,volume?:number,speed?:number,tailSpeed?:number];
/** CAEWeaponAudioEntity::WeaponFire (0x504F80) PlayGunSounds arguments by eWeaponType. */
const GUNS:Readonly<Record<number,GunSounds>>={
 22:[52,53,6,7,8,0,1.41421],23:[76,77,24,24,-1,-7],24:[52,53,6,7,8,0,.94387001],25:[73,74,21,22,23,0],27:[73,74,21,22,23,0],26:[73,74,21,22,23,0,.79369998,.93],
 28:[29,30,0,1,2],29:[29,30,17,18,2],30:[33,53,3,4,5],31:[33,53,3,4,5],32:[29,30,0,1,2,0,1.25992],33:[52,53,26,27,23,0,.89],34:[52,53,26,27,23],40:[49,-1,-1,-1,-1,-14],
};
/** WeaponReload (0x503690): [reload A, reload B, volume offset]. */
const RELOADS:Readonly<Record<number,readonly [number,number,number?]>>={22:[55,66],23:[55,66],24:[55,51],25:[72,71],27:[72,71],26:[70,69],28:[85,84],29:[85,84],32:[85,84],30:[32,31],31:[32,31],33:[32,-1,-6],34:[55,32]};
/** CAEWeaponAudioEntity (gta-reversed 0076f901) with CAEPedWeaponAudioEntity::AddAudioEvent. */
export class NativeWeaponAudio implements NativeAudioEntity {
 /** CGame::CanSeeOutSideFromCurrArea, which the host keeps (false in an interior area). */
 static canSeeOutside:()=>boolean=()=>true;
 private minigun:number=MINIGUN.stopped;private chainsaw:number=CHAINSAW.stopped;
 private lastGunFire=0;private lastFlame=0;private lastSpray=0;private lastExtinguisher=0;private lastMinigun=0;private lastChainsaw=0;private planeFrequency=0;
 private minigunFireActive=false;private minigunSpinActive=false;private gasLoop?:NativeSound;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private random:AudioRandom,private defaultVolume:(event:number)=>number){}
 private get time(){return this.manager.clock.timeMs;}
 private weaponsLoaded(){if(this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen))return true;this.bank.loadSoundBank(BANK.weapons,SLOT.weaponGen);return false;}
 private play(entity:NativePhysicalEntity,p:{slot?:number;sound:number;volume:number;rollOff?:number;speed?:number;doppler?:number;flags?:number;event?:number;speedVariance?:number;clientVariable?:number;position?:NativeVec}){
  const position=p.position??entity.position();if(!position)return;
  const tied=((p.flags??0)&SOUND.lifespanTiedToEntity)!==0;
  return this.manager.playSound({slot:p.slot??SLOT.weaponGen,sound:p.sound,entity:this,position,volume:p.volume,rollOff:p.rollOff,speed:p.speed,doppler:p.doppler,flags:p.flags,event:p.event,speedVariance:p.speedVariance,clientVariable:p.clientVariable,physical:tied?entity:undefined});
 }
 /** CAEPedWeaponAudioEntity::AddAudioEvent (0x4E69F0). */
 addAudioEvent(event:number,weapon:number,entity:NativePhysicalEntity){
  if(weapon===0)return;
  if(event===AE_WEAPON.fire||event===AE_WEAPON.fireMinigunAmmo||event===AE_WEAPON.fireMinigunNoAmmo||event===AE_WEAPON.firePlane)this.weaponFire(weapon,entity,event);
  else if(event===AE_WEAPON.reloadA||event===AE_WEAPON.reloadB)this.weaponReload(weapon,entity,event);
  else if(event===AE_WEAPON.chainsawIdle||event===AE_WEAPON.chainsawActive||event===AE_WEAPON.chainsawCutting)this.reportChainsawEvent(entity,event);
  else if(event===AE_WEAPON.stealthKill)this.reportStealthKill(weapon,entity,event);
 }
 /** WeaponFire (0x504F80). */
 weaponFire(weapon:number,entity:NativePhysicalEntity,event:number){
  const gun=GUNS[weapon];
  if(gun)return this.playGunSounds(entity,gun[0],gun[1],gun[2],gun[3],gun[4],event,gun[5]??0,gun[6]??1,gun[7]??1);
  if(weapon===37){if(!this.lastFlame)this.playFlameThrowerSounds(entity,83,26,event,-14,1);this.lastFlame=this.time;}
  else if(weapon===38)this.playMiniGunFireSounds(entity,event);
  else if(weapon===41){if(!this.lastSpray)this.playWeaponLoopSound(entity,28,event,-20,1,CAT.spray);this.lastSpray=this.time;}
  else if(weapon===42){if(!this.lastExtinguisher)this.playWeaponLoopSound(entity,9,event,-20,.79369998,CAT.ext);this.lastExtinguisher=this.time;}
  else if(weapon===43)this.playCameraSound(entity,event);
  else if(weapon===44||weapon===45)this.playGoggleSound(64,event);
 }
 /** WeaponReload (0x503690). */
 weaponReload(weapon:number,entity:NativePhysicalEntity,event:number){
  const reload=RELOADS[weapon];if(!reload||!this.weaponsLoaded())return;
  const sound=event===AE_WEAPON.reloadA?reload[0]:reload[1];if(sound<0)return;
  this.play(entity,{sound,volume:this.defaultVolume(event)+(reload[2]??0),rollOff:2/3,flags:SOUND.lifespanTiedToEntity});
 }
 /** PlayGunSounds (0x503CE0): dry and low layers at the gun, the main shot both at the gun and as a front-end stereo pair that crossfades out by 12 units, and a rolled-off stereo tail. */
 playGunSounds(entity:NativePhysicalEntity,dry:number,sub:number,left:number,right:number,tail:number,event:number,volumeOffset=0,primarySpeed=1,tailSpeed=1){
  if(!this.weaponsLoaded()||this.time<this.lastGunFire+25)return;
  this.lastGunFire=this.time;
  const position=entity.position();if(!position)return;
  let volume=this.defaultVolume(event)+volumeOffset,rollOff=1,speed=primarySpeed;
  if(event===AE_WEAPON.firePlane){this.planeFrequency=(this.planeFrequency+1)%2;rollOff=1.6;speed=[1.08,1][this.planeFrequency]*primarySpeed*.7937;}
  else if(event===AE_WEAPON.fireMinigunPlane){rollOff=1.8;speed=primarySpeed*.7937;}
  const minigun=event===AE_WEAPON.fireMinigunPlane||event===AE_WEAPON.fireMinigunAmmo,plane=event===AE_WEAPON.firePlane||event===AE_WEAPON.fireMinigunPlane;
  const tied=SOUND.lifespanTiedToEntity|SOUND.requestUpdates;
  if(dry!==-1)this.play(entity,{sound:dry,volume,rollOff:rollOff*(2/3),speed,doppler:0,flags:tied,event:minigun?CAT.minigunFire:-1});
  if(sub!==-1)this.play(entity,{sound:sub,volume,rollOff:rollOff*.9,speed,doppler:0,flags:tied,event:minigun?CAT.minigunFire:-1});
  let frontEnd=-100;
  if(!plane){
   const rel=this.manager.env.positionRelativeToCamera(position),dist=Math.hypot(rel.x,rel.y,rel.z)/(rollOff*1.25),near=5/rollOff,far=12/rollOff;
   if(dist<near){volume-=3;frontEnd=volume+NativeAudioEnvironment.distanceAttenuation(dist);}
   // The decompiled ramp divides by 12/r and then subtracts 5/r; the crossfade fraction between 5 and 12 units is used.
   else if(dist<far){const t=(far-dist)/(far-near);frontEnd=volume+NativeAudioEnvironment.distanceAttenuation(dist)+Math.log10(t*Math.SQRT1_2)*20;volume+=Math.log10((1-t)*.2929+Math.SQRT1_2)*20;}
  }
  const mainSpeed=(randomFloat(this.random,-.02,.02)+1)*speed;
  for(const [sfx,side] of [[left,-1],[right,1]] as const){
   if(sfx===-1)continue;
   this.play(entity,{sound:sfx,position:{x:side,y:0,z:0},volume:frontEnd,rollOff:rollOff*1.25,speed:mainSpeed,doppler:0,flags:SOUND.forcedFront|SOUND.requestUpdates|SOUND.frontEnd,event:minigun?CAT.minigunFire:-1});
   this.play(entity,{sound:sfx,volume,rollOff:rollOff*1.25,speed:mainSpeed,doppler:0,flags:tied,event:minigun?CAT.minigunFire:-1});
  }
  if(tail!==-1&&!plane){
   const tailRollOff=rollOff*3.5,rel=this.manager.env.positionRelativeToCamera(position);
   const tailVolume=NativeAudioEnvironment.distanceAttenuation(Math.hypot(rel.x,rel.y,rel.z)/tailRollOff)+volume-20;
   let a=1,b=1.1892101;if(resolveProbability(this.random,.5))[a,b]=[b,a];
   for(const [side,mult] of [[-1,a],[1,b]] as const)this.play(entity,{sound:tail,position:{x:side,y:0,z:0},volume:tailVolume,rollOff:tailRollOff,speed:tailSpeed*mult,doppler:0,flags:SOUND.forcedFront|SOUND.rolledOff|SOUND.requestUpdates|SOUND.frontEnd,event:event===AE_WEAPON.fireMinigunAmmo?CAT.minigunTail:CAT.tail});
  }
 }
 /** ReportStealthKill (0x503B20). */
 reportStealthKill(weapon:number,entity:NativePhysicalEntity,event:number){
  if(weapon!==4||!this.weaponsLoaded())return;
  const flags=SOUND.lifespanTiedToEntity|SOUND.requestUpdates;
  this.play(entity,{sound:81,volume:this.defaultVolume(event)-6,speed:0,flags,event:CAT.stealthKnifeIn,clientVariable:this.time});
  if(!this.bank.isSoundBankLoaded(BANK.collisions,SLOT.collisions)){this.bank.loadSoundBank(BANK.collisions,SLOT.collisions);return;}
  this.play(entity,{slot:SLOT.collisions,sound:471,volume:this.defaultVolume(event),speed:0,flags,event:CAT.stealthKnifeOut,clientVariable:this.time});
 }
 /** ReportChainsawEvent (0x503910): the chainsaw bank loads into the player engine slot. */
 reportChainsawEvent(entity:NativePhysicalEntity,event:number){
  if(!this.bank.isSoundBankLoaded(BANK_CHAINSAW_P,SLOT.playerEngine)){if(this.manager.areSoundsPlayingInBankSlot(SLOT.playerEngine))this.manager.cancelSoundsInBankSlot(SLOT.playerEngine,false);this.bank.loadSoundBank(BANK_CHAINSAW_P,SLOT.playerEngine);return;}
  const playIfSilent=(sound:number,rollOff:number,category:number)=>{if(!this.manager.areSoundsOfThisEventPlayingForThisEntity(category,this))this.play(entity,{slot:SLOT.playerEngine,sound,volume:this.defaultVolume(event),rollOff,doppler:0,flags:SOUND.lifespanTiedToEntity|SOUND.requestUpdates,event:category});};
  if(event===AE_WEAPON.chainsawIdle&&(this.chainsaw===CHAINSAW.stopped||this.chainsaw===CHAINSAW.idle)){playIfSilent(1,2/3,CAT.chainsawIdle);this.chainsaw=CHAINSAW.idle;this.lastChainsaw=this.time;}
  else if(event===AE_WEAPON.chainsawActive&&(this.chainsaw===CHAINSAW.stopping||this.chainsaw===CHAINSAW.active||this.chainsaw===CHAINSAW.idle)){playIfSilent(0,1.25,CAT.chainsawActive);this.chainsaw=CHAINSAW.active;this.lastChainsaw=this.time;}
  else if(event===AE_WEAPON.chainsawCutting&&(this.chainsaw===CHAINSAW.active||this.chainsaw===CHAINSAW.cutting)){this.chainsaw=CHAINSAW.cutting;this.lastChainsaw=this.time;}
 }
 private playWeaponLoopSound(entity:NativePhysicalEntity,sound:number,event:number,volumeOffset:number,speed:number,category:number){
  if(!this.weaponsLoaded())return;
  this.play(entity,{sound,volume:this.defaultVolume(event)+volumeOffset,speed,flags:SOUND.lifespanTiedToEntity|SOUND.startPercentage|SOUND.requestUpdates,event:category});
 }
 private playMiniGunStopSound(entity:NativePhysicalEntity|undefined){
  if(!entity){this.minigun=MINIGUN.stopped;return;}
  if(this.minigun===MINIGUN.stopping||!this.weaponsLoaded())return;
  this.play(entity,{sound:63,volume:this.defaultVolume(AE_WEAPON.fireMinigunStop),rollOff:2/3,speed:1,flags:SOUND.lifespanTiedToEntity|SOUND.requestUpdates,event:CAT.minigunStop});
  this.minigun=MINIGUN.stopping;
 }
 private playMiniGunFireSounds(entity:NativePhysicalEntity,event:number){
  const fire=(gunEvent:number)=>{this.minigun=MINIGUN.firing;if(!this.minigunFireActive){this.minigunFireActive=true;this.playGunSounds(entity,15,16,11,12,13,gunEvent,0,1,1);}};
  if(event===AE_WEAPON.fire||event===AE_WEAPON.fireMinigunAmmo)fire(AE_WEAPON.fireMinigunAmmo);
  else if(event===AE_WEAPON.firePlane)fire(AE_WEAPON.fireMinigunPlane);
  else if(event===AE_WEAPON.fireMinigunNoAmmo){
   if(!this.minigunSpinActive){if(!this.weaponsLoaded()){this.lastMinigun=this.time;return;}this.play(entity,{sound:14,volume:this.defaultVolume(AE_WEAPON.fireMinigunNoAmmo),rollOff:2/3,speed:1,doppler:0,flags:SOUND.lifespanTiedToEntity|SOUND.requestUpdates,event:CAT.minigunSpin});this.minigunSpinActive=true;}
   this.minigun=MINIGUN.spinning;
  }
  this.lastMinigun=this.time;
 }
 private playGoggleSound(sound:number,event:number){
  if(!this.weaponsLoaded())return;
  const swap=resolveProbability(this.random,.5);
  for(const [x,speed] of [[-1,swap?1.1892101:1],[1,swap?1:1.1892101]] as const)this.manager.playSound({slot:SLOT.weaponGen,sound,entity:this,position:{x,y:0,z:0},volume:this.defaultVolume(event)-9,speed,flags:SOUND.frontEnd|SOUND.forcedFront});
 }
 private playFlameThrowerSounds(entity:NativePhysicalEntity,dry:number,flame:number,event:number,volumeOffset:number,speed:number){
  if(!this.weaponsLoaded())return;
  const flags=SOUND.lifespanTiedToEntity|SOUND.requestUpdates;
  this.play(entity,{sound:dry,volume:this.defaultVolume(event)+volumeOffset-6,rollOff:2/3,speed,speedVariance:.02,flags});
  if(!this.bank.isSoundBankLoaded(BANK.vehicleGen,SLOT.vehicleGen))return;
  this.play(entity,{slot:SLOT.vehicleGen,sound:flame,volume:this.defaultVolume(event)+volumeOffset-20,rollOff:2,speed:speed*.79369998,flags,event:CAT.flame});
 }
 /** CAEPedWeaponAudioEntity::Service (0x4E6AE0): the flamethrower's idle gas loop while it is the active weapon;
  * `blocked` (in a vehicle, or swimming as CTaskSimpleSwim stops it) stops it. */
 service(weapon:number,entity:NativePhysicalEntity,blocked=false){
  if(weapon!==37||blocked){if(this.gasLoop){const s=this.gasLoop;this.gasLoop=undefined;s.stopSoundAndForget();}return;}
  if(!this.gasLoop&&this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen))this.gasLoop=this.play(entity,{sound:10,volume:this.defaultVolume(AE_WEAPON.flamethrowerIdle),rollOff:2/3,flags:SOUND.lifespanTiedToEntity|SOUND.requestUpdates});
 }
 private playChainsawStopSound(entity:NativePhysicalEntity|undefined){
  if(entity&&this.bank.isSoundBankLoaded(BANK_CHAINSAW_P,SLOT.playerEngine)){
   if(this.chainsaw!==CHAINSAW.stopping)this.play(entity,{slot:SLOT.playerEngine,sound:2,volume:this.defaultVolume(AE_WEAPON.chainsawActive),rollOff:2/3,flags:SOUND.lifespanTiedToEntity|SOUND.requestUpdates,event:CAT.chainsawStop});
   this.chainsaw=CHAINSAW.stopping;
  }else this.chainsaw=CHAINSAW.stopped;
 }
 private playCameraSound(entity:NativePhysicalEntity,event:number){
  if(!this.weaponsLoaded())return;
  this.play(entity,{sound:45,volume:this.defaultVolume(event),rollOff:2/3,flags:SOUND.lifespanTiedToEntity|SOUND.unpausable,event:CAT.chainsawStop});
 }
 /** UpdateParameters (0x504B70). */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition===-1){if(sound===this.gasLoop)this.gasLoop=undefined;else if(sound.event===CAT.minigunStop&&this.minigun===MINIGUN.stopping)this.minigun=MINIGUN.stopped;return;}
  const t=this.time;
  switch(sound.event){
   // Indoors a gunshot's tail loses 1 dB each update.
   case CAT.tail:if(!NativeWeaponAudio.canSeeOutside())sound.volume-=1;break;
   case CAT.flame:if(this.lastFlame+300>=t)sound.volume=Math.min(this.defaultVolume(AE_WEAPON.fire)-14,sound.volume+2);else{sound.stopSoundAndForget();this.lastFlame=0;}break;
   case CAT.spray:if(this.lastSpray+300<t){sound.stopSoundAndForget();this.lastSpray=0;}break;
   case CAT.ext:if(this.lastExtinguisher+300>=t)sound.speed=Math.min(.85,sound.speed+.01);else{sound.stopSoundAndForget();this.lastExtinguisher=0;}break;
   case CAT.minigunSpin:if(this.lastMinigun+300<t)this.playMiniGunStopSound(sound.physical);if(this.minigun===MINIGUN.stopping||this.minigun===MINIGUN.stopped){sound.stopSoundAndForget();this.minigunSpinActive=false;}break;
   case CAT.minigunFire:if(this.lastMinigun+300<t)this.playMiniGunStopSound(sound.physical);if(this.minigun!==MINIGUN.firing){sound.stopSoundAndForget();this.minigunFireActive=false;}break;
   case CAT.minigunTail:if(this.minigun!==MINIGUN.firing){if(sound.volume<=-30)sound.stopSoundAndForget();else sound.volume-=1.5;}break;
   case CAT.chainsawIdle:if(this.lastChainsaw+300<t)this.chainsaw=CHAINSAW.stopped;if(this.chainsaw!==CHAINSAW.idle)sound.stopSoundAndForget();break;
   case CAT.chainsawActive:
    if(this.chainsaw===CHAINSAW.cutting){if(this.lastChainsaw+400>=t)sound.speed=Math.max(.85,sound.speed-.15);else{this.lastChainsaw=t;this.chainsaw=CHAINSAW.active;}}
    else if(this.chainsaw===CHAINSAW.active){sound.speed=Math.min(1,sound.speed+.03);if(this.lastChainsaw+300<t)this.playChainsawStopSound(sound.physical);}
    else sound.stopSoundAndForget();
    break;
   case CAT.chainsawStop:if(this.chainsaw===CHAINSAW.stopping&&playPosition>1000)this.chainsaw=CHAINSAW.idle;break;
   case CAT.stealthKnifeIn:if(sound.clientVariable+820<t)sound.speed=.84;break;
   case CAT.stealthKnifeOut:if(sound.clientVariable+2200<t)sound.speed=1;break;
   default:if(sound.volume>0)sound.volume=Math.max(0,sound.volume-2.5);
  }
 }
}
/** CAEExplosionAudioEntity (0x4DCBE0): three positional layers and a rolled-off front-end stereo boom. */
export class NativeExplosionAudio implements NativeAudioEntity {
 private variation=0;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private random:AudioRandom,private defaultVolume:(event:number)=>number){}
 addAudioEvent(position:NativeVec,volume=0){
  volume+=this.defaultVolume(AE_WEAPON.explosion);
  if(!this.bank.isSoundBankLoaded(BANK.explosions,SLOT.explosions)){this.bank.loadSoundBank(BANK.explosions,SLOT.explosions);return;}
  this.variation=(this.variation+1)%3;const speed=[1.12,1,.88][this.variation];
  for(const [sound,rollOff] of [[4,2],[3,4],[2,7.5]] as const)this.manager.playSound({slot:SLOT.explosions,sound,entity:this,position,volume,rollOff,speed,flags:SOUND.requestUpdates,speedVariance:.06});
  const rel=this.manager.env.positionRelativeToCamera(position),front=volume+NativeAudioEnvironment.distanceAttenuation(Math.hypot(rel.x,rel.y,rel.z)/12)-3,variance=resolveProbability(this.random,.5);
  for(const [x,boost] of [[-1,variance],[1,!variance]] as const)this.manager.playSound({slot:SLOT.explosions,sound:1,entity:this,position:{x,y:0,z:0},volume:front,rollOff:12,speed:speed*(boost?Math.sqrt(Math.SQRT2):1),flags:SOUND.forcedFront|SOUND.rolledOff|SOUND.requestUpdates|SOUND.frontEnd,speedVariance:.06});
 }
 updateParameters(sound:NativeSound,playPosition:number){if(playPosition>0&&sound.volume>0)sound.volume=Math.max(sound.volume-1,0);}
}
export interface NativeAmbientInput {region:number;camera:NativeVec;player:NativeVec;foggynessSF:number}
const WEATHER_REGION_LA=1,WEATHER_REGION_LV=2,WEATHER_REGION_DESERT=4;
const FOG_HORNS:readonly NativeVec[]=[{x:-2683,y:1445,z:37},{x:-2683,y:1804,z:69}];
const WATERFALLS:readonly NativeVec[]=[{x:2075.3,y:1925.9,z:13},{x:2085.8,y:1905.5,z:11.3},{x:2091.5,y:1888.9,z:11.1}];
const AMBIENT={initial:0,gunshots:1,fogHorn0:2,fogHornWait:3,fogHorn1:4,waterfall:5} as const;
/** CAEGlobalWeaponAudioEntity (0x4DEF90-0x4DFAA0): projectile launches, aircraft guns and CAudioEngine's ambient gunfire, SF fog horns and the LV waterfall. */
export class NativeGlobalWeaponAudio extends NativeWeaponAudio {
 private rocketVariation=0;private ambient:number=AMBIENT.initial;private shots=0;private ambientWeapon=22;private delay=0;private lastTime=0;
 private fogHorn?:NativeSound;private waterfalls:(NativeSound|undefined)[]=[undefined,undefined,undefined];
 private gunfire={at:{x:0,y:0,z:0} as NativeVec,position:()=>this.gunfire.at};
 constructor(private owner:NativeSoundManager,private banks:NativeBankLoader,private rng:AudioRandom,private volumes:(event:number)=>number){super(owner,banks,rng,volumes);}
 /** ProjectileFire (0x4DF060): rocket launch plus the thrust layer. */
 projectileFire(weapon:number,entity:NativePhysicalEntity){
  if(weapon!==35&&weapon!==36)return;
  this.rocketVariation=(this.rocketVariation+1)%3;
  if(!this.banks.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen)){this.banks.loadSoundBank(BANK.weapons,SLOT.weaponGen);return;}
  const position=entity.position();if(!position)return;
  const speed=[1.08,1,.92][this.rocketVariation];
  for(const [slot,sound,mult,offset] of [[SLOT.weaponGen,68,1,-8],[SLOT.vehicleGen,26,1.25,0]] as const)
   this.owner.playSound({slot,sound,entity:this,position,volume:this.volumes(148)+offset,rollOff:3,speed:speed*mult,flags:SOUND.lifespanTiedToEntity,speedVariance:.02,physical:entity});
 }
 private pickAmbientGunFire(){
  const pistol=this.rng()<.5;
  this.shots=pistol?randomIntIn(this.rng,2,4):randomIntIn(this.rng,4,14);this.ambientWeapon=pistol?22:30;this.delay=pistol?randomIntIn(this.rng,500,1200):randomIntIn(this.rng,90,350);
 }
 /** ServiceAmbientGunFire (0x4DF210), once per frame. */
 serviceAmbient(input:NativeAmbientInput){
  const time=this.owner.clock.timeMs,frame=this.owner.clock.frame;
  const dist2=(a:NativeVec,b:NativeVec)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
  switch(this.ambient){
   case AMBIENT.initial:
    if(input.region===WEATHER_REGION_LA){
     if(frame%1024)return;
     const a=this.rng()*Math.PI*2,r=40+this.rng()*40;
     this.gunfire.at={x:input.camera.x+Math.cos(a)*r,y:input.camera.y+Math.sin(a)*r,z:Math.min(input.camera.z,20)};
     this.pickAmbientGunFire();this.ambient=AMBIENT.gunshots;
    }else if(input.region===WEATHER_REGION_LV){
     if(!this.banks.isSoundBankLoaded(BANK.collisions,SLOT.collisions)||this.waterfalls.some(Boolean)||dist2(WATERFALLS[1],input.camera)>=100*100)return;
     WATERFALLS.forEach((position,i)=>{this.waterfalls[i]=this.owner.playSound({slot:SLOT.collisions,sound:3,entity:this,position,volume:-3,rollOff:2.5,speed:[1,1.01,.99][i],flags:SOUND.requestUpdates});});
     this.ambient=AMBIENT.waterfall;
    }else if(input.region!==WEATHER_REGION_DESERT){
     if(input.foggynessSF<.5||frame%1024||dist2(input.camera,FOG_HORNS[0])>2000*2000||this.fogHorn)return;
     this.fogHorn=this.owner.playSound({slot:SLOT.hornAndSiren,sound:13,entity:this,position:FOG_HORNS[0],volume:0,rollOff:60,flags:SOUND.requestUpdates});
     this.ambient=AMBIENT.fogHorn0;this.lastTime=time;
    }
    break;
   case AMBIENT.gunshots:
    if(this.lastTime+this.delay>=time)return;
    // The decompiled test keeps shots within 24 units of the player, but the burst is placed 40-80 units away; distant bursts are played.
    if(dist2(input.player,this.gunfire.at)>24*24){
     this.weaponFire(this.ambientWeapon,this.gunfire,AE_WEAPON.fire);
     if(--this.shots)this.delay=this.ambientWeapon===22?randomIntIn(this.rng,500,1200):randomIntIn(this.rng,90,450);
     else if(this.rng()<.6)this.ambient=AMBIENT.initial;
     else this.pickAmbientGunFire();
    }else this.ambient=AMBIENT.initial;
    this.lastTime=time;break;
   case AMBIENT.fogHorn0:case AMBIENT.fogHorn1:
    if(time>this.lastTime+5000){this.fogHorn?.stopSound();this.ambient=this.ambient===AMBIENT.fogHorn0?AMBIENT.fogHornWait:AMBIENT.initial;}
    break;
   case AMBIENT.fogHornWait:
    if(this.lastTime+6500<time||!this.banks.isSoundBankLoaded(BANK.frontendGame,SLOT.frontendGame))return;
    if(!this.fogHorn){this.fogHorn=this.owner.playSound({slot:SLOT.hornAndSiren,sound:13,entity:this,position:FOG_HORNS[1],volume:0,rollOff:60,speed:1.2,flags:SOUND.requestUpdates});this.ambient=AMBIENT.fogHorn1;this.lastTime=time;}
    break;
   case AMBIENT.waterfall:
    if(input.region!==WEATHER_REGION_LV||dist2(input.camera,WATERFALLS[1])>100*100){for(let i=0;i<3;i++){const s=this.waterfalls[i];this.waterfalls[i]=undefined;s?.stopSound();}this.ambient=AMBIENT.initial;}
    break;
  }
 }
 override updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition!==-1)return;
  if(sound===this.fogHorn)this.fogHorn=undefined;else for(let i=0;i<3;i++)if(this.waterfalls[i]===sound)this.waterfalls[i]=undefined;
 }
}
const randomIntIn=(random:AudioRandom,min:number,max:number)=>min+Math.floor(random()*(max-min+1));
