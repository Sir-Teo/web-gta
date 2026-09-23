import {NativeAudioEnvironment,type NativeCamera,type NativePhysicalEntity,type NativeVec} from './NativeSound';
import {NativeWaterCannonAudio} from './NativeWaterCannonAudio';
import {AE_WEAPON,NativeExplosionAudio,NativeGlobalWeaponAudio,NativeWeaponAudio,type NativeAmbientInput} from './NativeWeaponAudio';
import {AE_PED,NativePedAudio,nativeFootstepLevel} from './NativePedAudio';
import {NativeCollisionAudio} from './NativeCollisionAudio';
import {AE_FRONTEND,NativeFrontendAudio} from './NativeFrontendAudio';
import type {SurfaceAudioFlags} from '../../assets/surfaceAudio';
import {NativeSoundManager,type NativeChannelRenderer} from './NativeSoundManager';
import {NativeFireAudio} from './NativeFireAudio';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
import {AE_VEHICLE,NativeVehicleAudio,type NativeVehicleAudioContext,type NativeVehicleAudioInput} from './NativeVehicleAudio';
import {NativeWeatherAudio,type NativeWeatherAudioInput} from './NativeWeatherAudio';
import {VEHICLE_AUDIO_SETTINGS} from './vehicleAudioSettings';
import {RADIO_STATIONS,nextStation,speechSample,radioBedParams,type RadioStation,type SpeechEvent} from './radioSpeech';
import {NativeTwinLoopSound} from './NativeTwinLoopSound';
import type {AudioRandom} from './nativeAudioUtility';
/** Frame limiter default (RsGlobal.frameLimit = APP_MAX_FPS 30): per-frame audio steps keep their native pacing. */
export const NATIVE_AUDIO_FRAME_MS=1000/30;
export interface NativeAudioFrame {
 camera:NativeCamera;vehicles:Iterable<readonly [object,number,NativeVehicleAudioInput]>;weather?:NativeWeatherAudioInput;ambient?:NativeAmbientInput;
 /** Active fires (burning cars, flame hazards) for CAEFireAudioEntity, keyed by owner. */
 fires?:Iterable<readonly [object,NativeVec]>;
 /** The player's active weapon for CAEPedWeaponAudioEntity::Service and chainsaw idle/attack events. */
 player?:{weapon:number;onFoot:boolean;attacking:boolean;radio?:boolean};
}
export type NativeCombatSource='player'|'npc'|'aircraft'|'stealth';
/** CAudioEngine subset: CAESoundManager, vehicle entities (serviced from CAutomobile::ProcessControl), CAEWeatherAudioEntity, CAEPedAudioEntity::HandlePedHit vocals, vehicle radio stations and CAEPedSpeech comments. */
export class NativeAudioEngine implements NativeVehicleAudioContext {
 readonly env=new NativeAudioEnvironment();
 readonly manager:NativeSoundManager;
 readonly weather:NativeWeatherAudio;
 /** CPlayerPed's CAEPedWeaponAudioEntity, CAudioEngine's global weapon entity and CAEExplosionAudioEntity. */
 readonly playerWeapon:NativeWeaponAudio;readonly globalWeapon:NativeGlobalWeaponAudio;readonly explosions:NativeExplosionAudio;
 private player?:NativePhysicalEntity;private playerPed?:NativePedAudio;
 /** CAudioEngine::m_CollisionAE with SURFAUD.DAT audio classes by surface id. */
 readonly collisions:NativeCollisionAudio;surfaceAudio?:ReadonlyMap<number,SurfaceAudioFlags>;
 /** CAudioEngine::m_FrontendAE (pickup sounds). */
 readonly frontend:NativeFrontendAudio;
 /** CAEWaterCannonAudioEntity: the fire truck cannon's jet and splash voices. */
 readonly waterCannon:NativeWaterCannonAudio;
 readonly dummySlots=Array.from({length:SLOT.dummyEnd-SLOT.dummyFirst},()=>({bank:-1,refCount:0}));
  private entities=new Map<object,NativeVehicleAudio>();
  /** CAEFireAudioEntity per burning fire (cars on fire, flame hazards). */
  private fires=new Map<object,NativeFireAudio>();
 /** CAEPedAudioEntity per pedestrian, with the position its sounds follow. */
 private peds=new WeakMap<object,{audio:NativePedAudio;state:{position:NativeVec}}>();
 private accumulator=0;private timeMs=0;private pendingThunder=false;
  /** EVENTVOL.DAT (45,402 signed dB bytes, retail XXH3 e95fc016454f961b): gta-reversed reads 45,401, dropping the last byte. */
  eventVolumes?:Int8Array;
 constructor(readonly bank:NativeBankLoader,renderer?:NativeChannelRenderer,readonly random:AudioRandom=Math.random){
  this.manager=new NativeSoundManager(this.env,bank,random,47,renderer);
  this.weather=new NativeWeatherAudio(this.manager,bank,random,e=>this.defaultVolume(e));
  this.playerWeapon=new NativeWeaponAudio(this.manager,bank,random,e=>this.defaultVolume(e));
  this.globalWeapon=new NativeGlobalWeaponAudio(this.manager,bank,random,e=>this.defaultVolume(e));
  this.explosions=new NativeExplosionAudio(this.manager,bank,random,e=>this.defaultVolume(e));
  this.collisions=new NativeCollisionAudio(this.manager,bank,random,e=>this.defaultVolume(e),id=>this.surfaceAudio?.get(id));
  this.frontend=new NativeFrontendAudio(this.manager,bank,e=>this.defaultVolume(e));
  this.waterCannon=new NativeWaterCannonAudio(this.manager,bank);
  // CAEVehicleAudioEntity/CAEWeatherAudioEntity/CAEExplosionAudioEntity/CAECollisionAudioEntity::StaticInitialise bank loads.
  for(const [id,slot] of [[BANK.vehicleGen,SLOT.vehicleGen],[BANK.apacheD,SLOT.copHeli],[BANK.horn,SLOT.hornAndSiren],[BANK.rain,SLOT.weather],[BANK.collisions,SLOT.collisions],[BANK.bulletHits,SLOT.bulletHits],[BANK.explosions,SLOT.explosions],[BANK.weapons,SLOT.weaponGen],[BANK.frontendGame,SLOT.frontendGame]])bank.loadSoundBank(id,slot);
 }
 set renderer(renderer:NativeChannelRenderer|undefined){this.manager.hardware.renderer=renderer;}
 defaultVolume(event:number){return this.eventVolumes?.[event]??0;}
 rainVolume(){return this.weather.rainVolume;}
 underwaterness(){return 0;}
 static supports(modelId:number){const type=VEHICLE_AUDIO_SETTINGS[modelId-400]?.[0];return type===AE_VEHICLE.car||type===AE_VEHICLE.heli||type===AE_VEHICLE.plane;}
 /** The entity for a vehicle, created on first use (CVehicle constructor → Initialise). */
 vehicle(key:object,modelId:number){let e=this.entities.get(key);if(!e&&NativeAudioEngine.supports(modelId)){e=new NativeVehicleAudio(this,modelId);this.entities.set(key,e);}return e;}
 /** vehicleFlags.bAudioChangingGear as the vehicle's entity raised it, handed to CAutomobile::ProcessControl, which
  * clears it every step. Creates no entity. */
 takeChangingGear(key:object){const e=this.entities.get(key);if(!e?.audioChangingGear)return false;e.audioChangingGear=false;return true;}
 thunder(){this.pendingThunder=true;}
 /** The player ped for weapon and footstep sounds (native position getter). */
 setPlayer(position:()=>NativeVec|undefined){this.player={position};this.playerPed=new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:true,position});}
 /** CPed::DoFootLanded footsteps and TaskComplexInAirAndLand landings for the player. */
 footstep(move:'walk'|'run'|'sprint',ducking:boolean,surface:SurfaceAudioFlags|undefined){const [volume,speed]=nativeFootstepLevel(move,ducking);this.playerPed?.footstep(AE_PED.footstepLeft,volume,speed,surface);}
 landing(surface:SurfaceAudioFlags|undefined){this.playerPed?.landing(AE_PED.landOnFeetAfterFall,surface);}
 /** CAEPedAudioEntity swim splash and sprint wake for the player. */
 swimSplash(dive:boolean){this.playerPed?.swimSplash(dive?AE_PED.swimDiveSplash:AE_PED.swimStrokeSplash);}
 swimWake(){this.playerPed?.swimWake();}
 /** CPhysical entities for vehicles reported by native position (water splashes). */
 private splashers=new WeakMap<object,{physical:NativePhysicalEntity;state:{position:NativeVec}}>();
 /** cBuoyancy::AddSplashParticles' AudioEngine.ReportWaterSplash(vehicle, -100, false). `moveSpeed` is native units per frame. */
 vehicleWaterSplash(key:object,position:NativeVec,moveSpeed:NativeVec){
  let entry=this.splashers.get(key);if(!entry){const state={position};entry={physical:{position:()=>state.position},state};this.splashers.set(key,entry);}
  entry.state.position=position;this.collisions.reportVehicleWaterSplash(entry.physical,moveSpeed);
 }
 /** A pedestrian's CPed::DoFootLanded event: other peds always use the generic footstep bank. */
 pedFootstep(key:object,position:NativeVec,move:'walk'|'run'|'sprint',foot:'left'|'right'){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state};this.peds.set(key,ped);}
  ped.state.position=position;const [volume,speed]=nativeFootstepLevel(move,false);
  ped.audio.footstep(foot==='left'?AE_PED.footstepLeft:AE_PED.footstepRight,volume,speed,undefined);
 }
 /** NPC wading/water-entry splash through the shared swimming bank. */
 pedSplash(key:object,position:NativeVec){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state};this.peds.set(key,ped);}
  ped.state.position=position;ped.audio.npcSplash(position);
 }
 /** CAEPedAudioEntity::HandlePedHit pain/block vocals. */
 pedHit(key:object,position:NativeVec,blocked:boolean,weapon=0){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state};this.peds.set(key,ped);}
  ped.state.position=position;ped.audio.pedHit(blocked,weapon);
 }
 /** Vehicle radio (CAEVehicleAudioEntity): station per car, wheel to change. */
 radio:RadioStation=RADIO_STATIONS[5];
 tuneRadio(dir=1){this.radio=nextStation(this.radio,dir);return this.radio;}
 /** Ped speech comments (CAEPedSpeechAudioEntity): combat-bank vocals, throttled to one comment per event every 2 s. */
 private speechAt=new Map<SpeechEvent,number>();
 speech(event:SpeechEvent,position:NativeVec,seed=0){
  if(this.timeMs-(this.speechAt.get(event)??-Infinity)<2000)return;
  this.speechAt.set(event,this.timeMs);
  const s=speechSample(event,seed);
  if(this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen))this.manager.playSound({slot:SLOT.weaponGen,sound:s.sample,position,volume:this.defaultVolume(110),speed:1});
 }
 /** An NPC speech comment through the shared ped entities. */
 pedSpeech(key:object,position:NativeVec,event:SpeechEvent,seed=0){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state};this.peds.set(key,ped);}
  ped.state.position=position;
  this.speech(event,position,seed);
 }
 /** Vehicle radio bed (CAEVehicleAudioEntity radio): twin-loop bed per station while the player drives. */
 private radioBed?:NativeTwinLoopSound;
 private radioStation?:RadioStation;
 private serviceRadio(on:boolean,camera:NativeVec){
  if(!on){this.radioBed?.stopSoundAndForget();this.radioBed=undefined;this.radioStation=undefined;return;}
  if(!this.radioBed||this.radioStation!==this.radio){
   this.radioBed??=new NativeTwinLoopSound(this.manager,this.random);
   const bed=radioBedParams(this.radio);
   this.radioBed.initialise(SLOT.frontendGame,0,0,bed.swapMin,bed.swapMax,bed.offsetA,bed.offsetB);
   this.radioBed.playTwinLoopSound(camera,-30,bed.speed,0);
   this.radioStation=this.radio;
  }else{
   const bed=radioBedParams(this.radio);
   this.radioBed.updateTwinLoopSound(camera,-30,bed.speed);
  }
 }
 /** The frontend event for a collected SCM pickup category. */
  pickup(category:string){
   const event=category==='weapon'?AE_FRONTEND.pickupWeapon:category==='health'?AE_FRONTEND.pickupHealth:category==='armour'?AE_FRONTEND.pickupBodyArmour:category==='adrenaline'?AE_FRONTEND.pickupAdrenaline:category==='money'||category==='propertyForSale'||category==='revenue'?AE_FRONTEND.pickupMoney:
   category==='horseshoe'||category==='oyster'||category==='snapshot'?AE_FRONTEND.pickupCollectable1:category==='bribe'||category==='info'?AE_FRONTEND.pickupInfo:undefined;
  if(event!==undefined)this.frontend.addAudioEvent(event);
 }
 /** Weapon, projectile, melee and explosion reports from the weapon system. */
 combat(event:'fire'|'impact'|'reloadA'|'reloadB'|'explosion'|'pain'|'block',weapon:number,position:NativeVec,source:NativeCombatSource){
  const fixed:NativePhysicalEntity={position:()=>position},shooter=(source==='player'||source==='stealth')&&this.player?this.player:fixed;
  if(event==='explosion')this.explosions.addAudioEvent(position);
  else if(event==='reloadA'||event==='reloadB')this.playerWeapon.addAudioEvent(event==='reloadA'?AE_WEAPON.reloadA:AE_WEAPON.reloadB,weapon,shooter);
  else if(event==='fire'){
   if(weapon===35||weapon===36)this.globalWeapon.projectileFire(weapon,source==='player'?shooter:fixed);
   // CVehicle::FireFixedMachineGuns reports AE_WEAPON_FIRE_PLANE with the minigun swapped for the M4.
   else if(source==='aircraft')this.globalWeapon.weaponFire(weapon===38?31:weapon,fixed,AE_WEAPON.firePlane);
   else if(source==='npc')new NativeWeaponAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e)).weaponFire(weapon,fixed,AE_WEAPON.fire);
   else this.playerWeapon.addAudioEvent(weapon===38?AE_WEAPON.fireMinigunAmmo:AE_WEAPON.fire,weapon,shooter);
  }else if(event==='impact'){
   if(source==='stealth')this.playerWeapon.addAudioEvent(AE_WEAPON.stealthKill,weapon,shooter);
   else if(weapon===9)this.playerWeapon.addAudioEvent(AE_WEAPON.chainsawCutting,9,shooter);
   // CAEPedAudioEntity::HandlePedHit: weapon-bank strike plus pain/block vocal.
   else if(this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen)){this.manager.playSound({slot:SLOT.weaponGen,sound:weapon===0?36:weapon===1?44:weapon===4?57:weapon===8?56:35,position,volume:0,speedVariance:.06});this.playerPed?.pedHit(false,weapon);}
  }else if(event==='pain'||event==='block'){
   this.playerPed?.pedHit(event==='block',weapon);
  }
 }
 /** Advance by real elapsed milliseconds; `build` is sampled once per native audio frame. */
 frame(elapsedMs:number,build:()=>NativeAudioFrame){
  this.accumulator=Math.min(this.accumulator+Math.max(0,elapsedMs),NATIVE_AUDIO_FRAME_MS*4);
  let frames=0;
  while(this.accumulator>=NATIVE_AUDIO_FRAME_MS&&frames<3){
   this.accumulator-=NATIVE_AUDIO_FRAME_MS;frames++;this.timeMs+=NATIVE_AUDIO_FRAME_MS;
   const input=build();this.env.camera=input.camera;
   const seen=new Set<object>();
   for(const [key,modelId,vehicle] of input.vehicles){const e=this.vehicle(key,modelId);if(!e)continue;seen.add(key);e.service(vehicle);}
    for(const [key,e] of this.entities)if(!seen.has(key)){e.terminate();this.entities.delete(key);}
    const seenFires=new Set<object>();
    if(input.fires)for(const [key,position] of input.fires){
     let e=this.fires.get(key);
     if(!e){e=new NativeFireAudio(this.manager,this.bank,ev=>this.defaultVolume(ev));this.fires.set(key,e);}
     seenFires.add(key);e.service(position);
    }
    for(const [key,e] of this.fires)if(!seenFires.has(key)){e.terminate();this.fires.delete(key);}
   if(input.weather){this.weather.service(input.weather);if(this.pendingThunder)this.weather.thunder();}
   if(input.ambient)this.globalWeapon.serviceAmbient(input.ambient);
   if(input.player&&this.player){
    const p=input.player;this.playerWeapon.service(p.weapon,this.player,!p.onFoot);
    // CAEPedWeaponAudioEntity chainsaw sources: held on foot it idles, attacking revs it.
    if(p.weapon===9&&p.onFoot)this.playerWeapon.addAudioEvent(p.attacking?AE_WEAPON.chainsawActive:AE_WEAPON.chainsawIdle,9,this.player);
    this.serviceRadio(!!p.radio,input.camera.position);
   }else this.serviceRadio(false,input.camera.position);
   this.collisions.service();this.pendingThunder=false;
   this.manager.service(Math.round(this.timeMs));
  }
  return frames;
 }
  /** Stop everything (CAESoundManager::Reset). */
  reset(){for(const e of this.entities.values())e.terminate();this.entities.clear();for(const e of this.fires.values())e.terminate();this.fires.clear();this.manager.reset();}
  snapshot(){const slots:Record<number,number>={};for(const sound of this.manager.sounds)if(sound.inUse)slots[sound.slot]=(slots[sound.slot]??0)+1;return {waterCannon:this.waterCannon.snapshot(),...this.manager.snapshot(),slots,footsteps:this.playerPed?.footstepsPlayed??0,banks:this.bank.snapshot(),vehicles:[...this.entities.values()].map(e=>e.snapshot()),fires:this.fires.size,weather:this.weather.snapshot()};}
}
