import {NativeDoorAudio} from './NativeDoorAudio';
import {NativeScriptAudio} from './NativeScriptAudio';
import {NativeAudioEnvironment,SOUND,type NativeCamera,type NativePhysicalEntity,type NativeVec} from './NativeSound';
import {gxtText} from '../../assets/gxt';
import {RADIO_ID,RADIO_TYPE,vehicleRadioSettings} from './vehicleRadio';
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
import {PAIN_CONTEXTS,PAIN_VOICE_CARL,painSound,type PainContext} from './painSpeech';
import {AE_CRIME_COMMITTED,NativePoliceScanner,type ScannerCrimeScene} from './NativePoliceScanner';
import type {AudioRandom} from './nativeAudioUtility';
import {NativeRadioTrackManager,type RadioTrackHardware,type RadioWorld} from './NativeRadioTrackManager';
/** Frame limiter default (RsGlobal.frameLimit = APP_MAX_FPS 30): per-frame audio steps keep their native pacing. */
export const NATIVE_AUDIO_FRAME_MS=1000/30;
/** eAudioEvents::AE_SPEECH_PED. */
const AE_SPEECH_PED=52;
/** gSpeechContextLookup's RepeatTime for the contexts the comment events stand for: PAIN_HIGH/LOW, RUN_FROM_FIGHT,
 * the abuse and insult contexts, JOIN_GANG_YES. */
const SPEECH_REPEAT_MS:Record<SpeechEvent,number>={pain:2000,flee:7000,threat:7000,greet:1500,busted:7000,wasted:7000,jacked:7000};
export interface NativeAudioFrame {
 camera:NativeCamera;vehicles:Iterable<readonly [object,number,NativeVehicleAudioInput]>;weather?:NativeWeatherAudioInput;ambient?:NativeAmbientInput;
 /** Active fires (burning cars, flame hazards) for CAEFireAudioEntity, keyed by owner. */
 fires?:Iterable<readonly [object,NativeVec]>;
 /** The player's active weapon for CAEPedWeaponAudioEntity::Service and chainsaw idle/attack events. */
 player?:{weapon:number;onFoot:boolean;attacking:boolean;radio?:boolean;swimming?:boolean;
  /** The player drives a vehicle: TurnOnRadioForVehicle has set s_pVehicleAudioSettingsForRadio, radio or not. */
  inVehicle?:boolean};
 /** TheCamera.m_bWideScreenOn: the widescreen bars of a scripted scene. */
 widescreen?:boolean;
 /** CClock's day of the month, month and hour, by which TrackRadioStation reckons a station's time away. */
 clock?:{days:number;month:number;hours:number};
 /** A mission audio line plays: UpdateRadioVolumes ducks the radio under it. */
 dialogue?:boolean;
 /** CGameLogic::LaRiotsActiveHere: the emergency channel's dispatcher talks of the riots. */
 laRiots?:boolean;
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
 /** Each garage's CAEDoorAudioEntity (CGarage::m_GarageAudio), by garage name, made as a garage's door first moves. */
 private readonly garageDoors=new Map<string,NativeDoorAudio>();
 garageDoor(garage:string){let door=this.garageDoors.get(garage);if(!door){door=new NativeDoorAudio(this.manager,this.bank,e=>this.defaultVolume(e));this.garageDoors.set(garage,door);}return door;}
 /** CAEScriptAudioEntity's ProcessMissionAudioEvent, for the scripts' REPORT_MISSION_AUDIO_EVENT_AT_*. */
 readonly scriptAudio:NativeScriptAudio;
 /** CWanted::m_PoliceScannerAudioEntity of the player, which plays the report of a crime that raised his level. */
 readonly policeScanner:NativePoliceScanner;
 /** CAEWaterCannonAudioEntity: the fire truck cannon's jet and splash voices. */
 readonly waterCannon:NativeWaterCannonAudio;
 /** CAERadioTrackManager, which plays the emergency channel in an emergency vehicle (NativeRadioTrackManager.ts), on
  * the track stream the audio system attaches (attachRadioStream). */
 readonly radioTracks:NativeRadioTrackManager;
 private radioStream?:{service():void;snapshot?():unknown};
 /** The player's vehicle's eAERadioType while StartRadio has it (StaticGetPlayerVehicleAudioSettingsForRadio). */
 private radioVehicleType?:number;
 private radioClock={days:1,month:1,hours:12};private radioInput?:NativeAudioFrame;
 readonly dummySlots=Array.from({length:SLOT.dummyEnd-SLOT.dummyFirst},()=>({bank:-1,refCount:0}));
  private entities=new Map<object,NativeVehicleAudio>();
  /** CAEFireAudioEntity per burning fire (cars on fire, flame hazards). */
  private fires=new Map<object,NativeFireAudio>();
 /** CAEPedAudioEntity per pedestrian, with the position its sounds follow. */
 private peds=new WeakMap<object,{audio:NativePedAudio;state:{position:NativeVec};pain:{next:number}}>();
 /** CAEVehicleAudioEntity::s_pVehicleAudioSettingsForRadio is set: the player drives a vehicle (TurnOnRadioForVehicle
  * sets it for every vehicle, radio or not). */
 private playerInVehicle=false;
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
  this.scriptAudio=new NativeScriptAudio(this.manager,bank,e=>this.defaultVolume(e),this.random,(event,volume,speed)=>this.frontend.addAudioEvent(event,volume,speed));
  this.policeScanner=new NativePoliceScanner(this.manager,bank,this.frontend,e=>this.defaultVolume(e),()=>this.playerInVehicle,random);
  this.waterCannon=new NativeWaterCannonAudio(this.manager,bank);
  this.radioTracks=new NativeRadioTrackManager(random);
  // CAEDoorAudioEntity::StaticInitialise: DOORS (51) into its slot (31).
  NativeDoorAudio.staticInitialise(bank);
  // CAEVehicleAudioEntity/CAEWeatherAudioEntity/CAEExplosionAudioEntity/CAECollisionAudioEntity::StaticInitialise bank loads.
  for(const [id,slot] of [[BANK.vehicleGen,SLOT.vehicleGen],[BANK.apacheD,SLOT.copHeli],[BANK.horn,SLOT.hornAndSiren],[BANK.rain,SLOT.weather],[BANK.collisions,SLOT.collisions],[BANK.bulletHits,SLOT.bulletHits],[BANK.explosions,SLOT.explosions],[BANK.weapons,SLOT.weaponGen],[BANK.frontendGame,SLOT.frontendGame]])bank.loadSoundBank(id,slot);
 }
 set renderer(renderer:NativeChannelRenderer|undefined){this.manager.hardware.renderer=renderer;}
 defaultVolume(event:number){return this.eventVolumes?.[event]??0;}
 rainVolume(){return this.weather.rainVolume;}
 underwaterness(){return 0;}
 static supports(modelId:number){const type=VEHICLE_AUDIO_SETTINGS[modelId-400]?.[0];return type===AE_VEHICLE.car||type===AE_VEHICLE.bike||type===AE_VEHICLE.bmx||type===AE_VEHICLE.boat||type===AE_VEHICLE.train||type===AE_VEHICLE.heli||type===AE_VEHICLE.plane||type===AE_VEHICLE.special;}
 /** The entity for a vehicle, created on first use (CVehicle constructor → Initialise). */
 vehicle(key:object,modelId:number){let e=this.entities.get(key);if(!e&&NativeAudioEngine.supports(modelId)){e=new NativeVehicleAudio(this,modelId);this.entities.set(key,e);}return e;}
 /** vehicleFlags.bAudioChangingGear as the vehicle's entity raised it, handed to CAutomobile::ProcessControl, which
  * clears it every step. Creates no entity. */
 takeChangingGear(key:object){const e=this.entities.get(key);if(!e?.audioChangingGear)return false;e.audioChangingGear=false;return true;}
 thunder(){this.pendingThunder=true;}
 /** CPlayerPed::ProcessControl's minigun spinning dry: AE_WEAPON_FIRE_MINIGUN_NO_AMMO each frame the use-gun task runs
  * without a shot. */
 minigunSpin(){if(this.player)this.playerWeapon.addAudioEvent(AE_WEAPON.fireMinigunNoAmmo,38,this.player);}
 /** The player ped for weapon and footstep sounds (native position getter). */
 setPlayer(position:()=>NativeVec|undefined){this.player={position};this.playerPed=new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:true,position});}
 /** CPed::DoFootLanded footsteps and TaskComplexInAirAndLand landings for the player. */
 footstep(move:'walk'|'run'|'sprint',ducking:boolean,surface:SurfaceAudioFlags|undefined){const [volume,speed]=nativeFootstepLevel(move,ducking);this.playerPed?.footstep(AE_PED.footstepLeft,volume,speed,surface);}
 /** A landing from FALL_FALL collapses (AE_PED_COLLAPSE_AFTER_FALL); any other is on the feet. */
 landing(surface:SurfaceAudioFlags|undefined,collapse=false){this.playerPed?.landing(collapse?AE_PED.collapseAfterFall:AE_PED.landOnFeetAfterFall,surface);}
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
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state,pain:{next:0}};this.peds.set(key,ped);}
  ped.state.position=position;const [volume,speed]=nativeFootstepLevel(move,false);
  ped.audio.footstep(foot==='left'?AE_PED.footstepLeft:AE_PED.footstepRight,volume,speed,undefined);
 }
 /** AE_PED_CRUNCH on a pedestrian killed by a fall. */
 pedCrunch(key:object,position:NativeVec){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state,pain:{next:0}};this.peds.set(key,ped);}
  ped.state.position=position;ped.audio.crunch(position);
 }
 /** NPC wading/water-entry splash through the shared swimming bank. */
 pedSplash(key:object,position:NativeVec){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state,pain:{next:0}};this.peds.set(key,ped);}
  ped.state.position=position;ped.audio.npcSplash(position);
 }
 /** CAEPedAudioEntity::HandlePedHit pain/block vocals. */
 pedHit(key:object,position:NativeVec,blocked:boolean,weapon=0){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state,pain:{next:0}};this.peds.set(key,ped);}
  ped.state.position=position;ped.audio.pedHit(blocked,weapon);
 }
 /** CAERadioTrackManager's requested eRadioID while the radio is on: 0 the emergency channel, 1-11 the stations, 13
  * off. */
 radioId:number=RADIO_ID.off;
 /** m_RequestedSettings.StationID, which StopRadio leaves: the station last asked for (GetCurrentRadioStationID, off
  * before any). */
 private requestedRadioId:number=RADIO_ID.off;
 /** IsRadioOn: a station, or the emergency channel's track manager. */
 get radioOn(){return this.radioId!==RADIO_ID.off||this.radioTracks.isRadioOn();}
 /** m_nSavedRadioStationId, m_nSavedTimeMs and the game hour and weekday saved with it. */
 private savedRadio?:{id:number;timeMs:number;hour:number;day:number};
 /** The station playing, when it is a music station (the beds stand in for the station's music). */
 get radio():RadioStation|undefined{return this.radioId>=1&&this.radioId<=11?RADIO_STATIONS[this.radioId-1]:undefined;}
 /** CAERadioTrackManager::DisplayRadioStationName's text: the GXT's FEA_R{id − 1}, or FEA_NON for off ("RADIO OFF");
  * none for the emergency channel. */
 get radioLabel(){
  if(this.radioHeld)return undefined;
  if(this.radioId===RADIO_ID.off)return gxtText('FEA_NON','Radio Off');
  const station=this.radio;return station&&gxtText(`FEA_R${this.radioId-1}`,station);
 }
 /** CAERadioTrackManager::StartRadio(settings) as the player takes a vehicle: the emergency channel for an
  * emergency vehicle, nothing for one with no civilian radio, and otherwise the vehicle's own station, or with
  * auto-tune the station last listened to when it was left under a minute and at most five game hours ago (with the
  * retune sound, which the port's frontend entity does not play). Returns whether a radio came on. */
 startRadio(modelId:number,nowMs:number,hour:number,day:number){
  const settings=vehicleRadioSettings(modelId);
  this.radioVehicleType=settings.type;this.radioModelId=modelId;
  // CAudioEngine::StartRadio: none while a beat track holds the stream (GetBeatTrackStatus); the radio waits for it.
  // Nor under an ambience track that overrides the radio, which waits for that track to stop.
  if(settings.type===RADIO_TYPE.emergency||settings.type===RADIO_TYPE.civilian){
   if(this.beatTrackHeld||!this.ambienceLetsRadioStart()){this.radioId=RADIO_ID.off;this.radioHeld=true;return true;}
   this.radioHeld=false;
  }
  if(settings.type===RADIO_TYPE.emergency){
   this.radioId=this.requestedRadioId=RADIO_ID.emergency;
   // StartRadio(RADIO_EMERGENCY_AA, the vehicle's bass setting, its factor (for the EQ, which is not ported), no skip).
   this.radioTracks.startRadio(RADIO_ID.emergency,settings.bass,0,false,this.radioWorld());
   return true;
  }
  if(settings.type!==RADIO_TYPE.civilian){this.radioId=RADIO_ID.off;return false;}
  const s=this.savedRadio,retune=!!s&&s.id!==settings.station&&s.id!==RADIO_ID.off&&s.id!==RADIO_ID.emergency&&nowMs<=s.timeMs+60000&&hour+24*((day-s.day+7)%7)-s.hour<=5;
  this.radioId=this.requestedRadioId=retune?s!.id:settings.station;
  return true;
 }
 /** StopRadio as the player leaves: the emergency channel's is the track manager's, which keeps its place; for a
  * station the port saves the station, as it keeps the fields for. */
 stopRadio(nowMs:number,hour:number,day:number){
  if(this.radioId!==RADIO_ID.emergency){if(!this.radioHeld)this.savedRadio={id:this.radioId,timeMs:nowMs,hour,day};}
  else this.radioTracks.stopRadio({radioStation:RADIO_ID.emergency,bassSetting:0},false,this.radioWorld());
  this.radioId=RADIO_ID.off;this.radioVehicleType=undefined;this.radioModelId=undefined;this.radioHeld=false;
 }
 /** GetBeatTrackStatus (CAECutsceneTrackManager::GetCutsceneTrackStatus), which holds StartRadio and RetuneRadio back
  * while a beat track is loading, loaded, playing or stopping: the host's. */
 beatTrackStatus?:()=>number;
 private get beatTrackHeld(){return (this.beatTrackStatus?.()??0)!==0;}
 /** DisplayRadioStationName, for the radio that comes back after a track (the host's HUD). */
 onRadioName?:(label:string)=>void;
 /** The driven vehicle's model while it has the radio, m_nCurrentRadioStationId (the station a track stopped, -1
  * none), and whether the radio is off for a track (a beat track, or an ambience track that overrides the radio). */
 private radioModelId?:number;private trackRadioStationId=-1;private radioHeld=false;
 /** CAudioEngine::PreloadBeatTrack's (and PreloadCutsceneTrack's) first step, as the original's one stream needs it: a
  * radio that is on stops (StopRadio with the vehicle's settings, during the pause), its station kept. Whether one was
  * on; when none is, the host stops the ambience track instead. */
 stopRadioForTrack(){
  if(this.radioId===RADIO_ID.off&&!this.radioTracks.isRadioOn())return false;
  this.trackRadioStationId=this.radioId;
  if(this.radioId===RADIO_ID.emergency)this.radioTracks.stopRadio({radioStation:RADIO_ID.emergency,bassSetting:0},true,this.radioWorld());
  this.radioId=RADIO_ID.off;this.radioHeld=true;return true;
 }
 /** The radio back after the track, in a vehicle with a radio (IsVehicleRadioActive): the kept station when the script
  * stops the track (StopCutsceneTrack's wait, which then forgets it), and when the mission-complete track has stopped
  * StartRadio with the vehicle's settings, which StopRadio left on the kept station; with none kept, the vehicle's
  * own. Its name shows, as the station starting sets m_bDisplayStationName. */
 restartRadioAfterTrack(keptStation:boolean){
  const type=this.radioVehicleType,model=this.radioModelId;
  if(model!==undefined&&(type===RADIO_TYPE.civilian||type===RADIO_TYPE.emergency||type===RADIO_TYPE.unknown)){
   const station=type===RADIO_TYPE.emergency?RADIO_ID.emergency:this.trackRadioStationId>=0?this.trackRadioStationId:vehicleRadioSettings(model).station;
   if(station!==RADIO_ID.off&&!this.ambienceLetsRadioStart()){this.radioId=RADIO_ID.off;this.radioHeld=true;}
   else{
    this.radioHeld=false;this.radioId=this.requestedRadioId=station;
    if(station===RADIO_ID.emergency)this.radioTracks.startRadio(RADIO_ID.emergency,vehicleRadioSettings(model).bass,0,false,this.radioWorld());
    const label=this.radioLabel;if(label)this.onRadioName?.(label);
   }
  }
  if(keptStation)this.trackRadioStationId=-1;
 }
 /** The ambience track manager, which on the original shares the radio's stream: whether a track plays
  * (IsAmbienceTrackActive), whether it overrides the radio (DoesAmbienceTrackOverrideRadio), and StopAmbienceTrack. */
 ambience?:{readonly active:boolean;readonly overrideRadio:boolean;stop():void};
 /** CAERadioTrackManager::StartRadio's word with the ambience track, for a station or the emergency channel: one that
  * overrides the radio keeps it from starting (reporting AE_FRONTEND_RADIO_RETUNE_STOP, whose static the port does not
  * play), and any other one stops for it. */
 private ambienceLetsRadioStart(){
  const a=this.ambience;if(!a?.active)return true;
  if(a.overrideRadio)return false;
  a.stop();return true;
 }
 /** The ambience's StopRadio(nullptr, false), for a track that overrides the radio: off until the ambience brings it
  * back (restartRadioAfterAmbience), the emergency channel's track manager keeping its place. */
 stopRadioForAmbience(){
  if(this.radioId===RADIO_ID.emergency)this.radioTracks.stopRadio(undefined,false,this.radioWorld());
  this.radioId=RADIO_ID.off;this.radioHeld=true;
 }
 /** The ambience's StartRadio(GetCurrentRadioStationID(), NORMAL) once its track has stopped, in a vehicle with a
  * radio (IsVehicleRadioActive): the station last asked for (off, if that was off), its name shown as the station
  * starting sets m_bDisplayStationName. None while a beat track holds the stream (CAudioEngine::StartRadio). */
 restartRadioAfterAmbience(){
  const type=this.radioVehicleType;
  if(this.radioModelId===undefined||type!==RADIO_TYPE.civilian&&type!==RADIO_TYPE.emergency&&type!==RADIO_TYPE.unknown)return;
  const station=this.requestedRadioId;
  if(this.beatTrackHeld||station!==RADIO_ID.off&&!this.ambienceLetsRadioStart())return;
  this.radioHeld=false;this.radioId=station;
  if(station===RADIO_ID.emergency)this.radioTracks.startRadio(RADIO_ID.emergency,0,0,false,this.radioWorld());
  const label=this.radioLabel;if(label)this.onRadioName?.(label);
 }
 /** The radio's stream (RadioStream.ts), which the audio system makes once it has a context. */
 attachRadioStream(stream:RadioTrackHardware&{service():void;snapshot?():unknown}){this.radioTracks.hardware=stream;this.radioStream=stream;}
 /** What the radio track manager reads of the game: the engine's clock (CTimer's, which stops with the game; the
  * port's pause suspends the audio, which holds the stream as CheckForPause's frequency of 0 does), the frame's game
  * clock, widescreen, dialogue and riots, and the effects level for the music's (the port has one level, so the
  * dialogue duck is its 9 dB). */
 private radioWorld(input=this.radioInput):RadioWorld{
  if(input?.clock)this.radioClock=input.clock;
  return {timeMs:this.timeMs,pauseTimeMs:this.timeMs,paused:false,clock:this.radioClock,widescreen:!!input?.widescreen,slowMotion:false,
   effectsLevel:1,musicLevel:1,dialogue:!!input?.dialogue,ambienceRadio:false,laRiotsHere:!!input?.laRiots,vehicleRadioType:this.radioVehicleType};
 }
 /** CAudioEngine::RetuneRadio (0x507E10) and CAERadioTrackManager::RetuneRadio: the script's station request; user
  * tracks with none loaded mean off; nothing while a beat track holds the stream (GetBeatTrackStatus), and
  * CheckForStationRetune takes no request on the emergency channel. The station starts as StartRadio starts it, so
  * not under an ambience track that overrides the radio. */
 retuneRadio(id:number){
  if(!Number.isInteger(id)||id<RADIO_ID.emergency||id>RADIO_ID.off||this.beatTrackHeld||this.radioId===RADIO_ID.emergency)return;
  const station=id===RADIO_ID.userTracks?RADIO_ID.off:id;
  if(station!==RADIO_ID.off&&!this.ambienceLetsRadioStart())return;
  this.radioId=this.requestedRadioId=station;
 }
 /** The player's retune: through the eleven stations and off; none on the emergency channel, nor while the radio is
  * off for a track; a station starts as StartRadio starts it, so not under an ambience track that overrides the
  * radio. */
 tuneRadio(dir=1){
  if(this.radioId===RADIO_ID.emergency||this.radioHeld)return undefined;
  const cycle=[1,2,3,4,5,6,7,8,9,10,11,RADIO_ID.off],i=Math.max(0,cycle.indexOf(this.radioId)),next=cycle[(i+dir+cycle.length)%cycle.length];
  if(next!==RADIO_ID.off&&!this.ambienceLetsRadioStart())return undefined;
  this.radioId=this.requestedRadioId=next;return this.radioLabel;
 }
 /** Ped speech comments (CAEPedSpeechAudioEntity) as combat-bank vocals. SetNextPlayTime spaces each context by its
  * gSpeechContextLookup repeat time plus 1 to 1000 ms: pain per ped (m_NextTimeCanSayPain), every other context once
  * for everyone (gGlobalSpeechContextNextPlayTime). I_PlayLoadedSound plays at AE_SPEECH_PED's volume, rolled off 3
  * while the player's vehicle sets the radio settings and 2 otherwise. */
 private speechNext=new Map<SpeechEvent,number>();
 /** `voice` gives a pain cry its PAIN_A voice and context: GetPainVoice's bank, loaded into a speech slot of its own
  * (AUTHORED: the original streams each line into one of six shared speech slots), and a sound from
  * gPainSpeechLookup's range. Until the bank is in, the cry is silent; a bank that cannot be had falls back to the
  * combat-bank vocal. */
 speech(event:SpeechEvent,position:NativeVec,seed=0,pain?:{next:number},voice?:{voice:number;context:PainContext}){
  const repeat=event==='pain'&&voice?PAIN_CONTEXTS[voice.context].repeatMs:SPEECH_REPEAT_MS[event];
  const next=this.timeMs+repeat+1+Math.floor(this.random()*1000);
  if(event==='pain'&&pain){if(this.timeMs<pain.next)return;pain.next=next;}
  else{if(this.timeMs<(this.speechNext.get(event)??0))return;this.speechNext.set(event,next);}
  if(event==='pain'&&voice){
   const pick=painSound(voice.context,voice.voice,this.random),slot=SLOT.speechFirst+voice.voice;
   if(pick){
    if(this.bank.isSoundBankLoaded(pick.bank,slot)){
     this.manager.playSound({slot,sound:pick.sound,position,volume:this.defaultVolume(AE_SPEECH_PED)+(PAIN_CONTEXTS[voice.context].volume??0),rollOff:this.playerInVehicle?3:2,speed:1,flags:SOUND.requestUpdates|SOUND.uncancellable});
     this.painCries++;return;
    }
    if(!this.bank.failures.has(pick.bank)){this.bank.loadSoundBank(pick.bank,slot);return;}
   }
  }
  const s=speechSample(event,seed);
  if(this.bank.isSoundBankLoaded(BANK.weapons,SLOT.weaponGen))this.manager.playSound({slot:SLOT.weaponGen,sound:s.sample,position,volume:this.defaultVolume(AE_SPEECH_PED),rollOff:this.playerInVehicle?3:2,speed:1,flags:SOUND.requestUpdates|SOUND.uncancellable});
 }
 /** An NPC speech comment through the shared ped entities. */
 /** CWanted::ReportCrimeNow's AddAudioEvent(AE_CRIME_COMMITTED, crimeType, posn) when a crime raised the level. */
 crimeReported(crimeType:number,scene:ScannerCrimeScene){this.policeScanner.addAudioEvent(AE_CRIME_COMMITTED,crimeType,scene);}
 /** Pain cries said from the PAIN_A banks. */
 painCries=0;
 /** CJ's pain (CPlayerPed's speech entity): his PAIN_A voice, at his position, with his own pain timer. */
 private playerPainTimer={next:0};
 playerPain(context:PainContext){
  const position=this.player?.position();if(!position)return;
  this.speech('pain',position,0,this.playerPainTimer,{voice:PAIN_VOICE_CARL,context});
 }
 pedSpeech(key:object,position:NativeVec,event:SpeechEvent,seed=0,voice?:{voice:number;context:PainContext}){
  let ped=this.peds.get(key);
  if(!ped){const state={position};ped={audio:new NativePedAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e),{player:false,position:()=>state.position}),state,pain:{next:0}};this.peds.set(key,ped);}
  ped.state.position=position;
  this.speech(event,position,seed,ped.pain,voice);
 }
 /** Vehicle radio bed (CAEVehicleAudioEntity radio): twin-loop bed per station while the player drives. */
 private radioBed?:NativeTwinLoopSound;
 private radioStation?:RadioStation;
 private serviceRadio(on:boolean,camera:NativeVec){
  if(!on){this.radioBed?.stopSoundAndForget();this.radioBed=undefined;this.radioStation=undefined;return;}
  const station=this.radio;
  if(!station){this.radioBed?.stopSoundAndForget();this.radioBed=undefined;this.radioStation=undefined;return;}
  if(!this.radioBed||this.radioStation!==station){
   this.radioBed??=new NativeTwinLoopSound(this.manager,this.random);
   const bed=radioBedParams(station);
   this.radioBed.initialise(SLOT.frontendGame,0,0,bed.swapMin,bed.swapMax,bed.offsetA,bed.offsetB);
   this.radioBed.playTwinLoopSound(camera,-30,bed.speed,0);
   this.radioStation=station;
  }else{
   const bed=radioBedParams(station);
   this.radioBed.updateTwinLoopSound(camera,-30,bed.speed);
  }
 }
 /** The frontend event for a collected SCM pickup category. A plain model (keycard, briefcase, clothes, other) that
  * GivePlayerGoodiesWithPickUpMI does not handle still plays the weapon chime from a ONCE-type pickup (3, 4, 5, 22),
  * CPickup::Update's `mi != MI_PICKUP_SAVEGAME` branch; on-street copies stay silent. */
  pickup(category:string,type?:number){
   const event=category==='weapon'?AE_FRONTEND.pickupWeapon:category==='health'?AE_FRONTEND.pickupHealth:category==='armour'?AE_FRONTEND.pickupBodyArmour:category==='adrenaline'?AE_FRONTEND.pickupAdrenaline:category==='money'||category==='propertyForSale'||category==='revenue'?AE_FRONTEND.pickupMoney:
   category==='horseshoe'||category==='oyster'||category==='snapshot'?AE_FRONTEND.pickupCollectable1:category==='bribe'||category==='info'?AE_FRONTEND.pickupInfo:
   (category==='keycard'||category==='briefcase'||category==='clothes'||category==='other')&&type!==undefined&&[3,4,5,22].includes(type)?AE_FRONTEND.pickupWeapon:undefined;
  if(event!==undefined)this.frontend.addAudioEvent(event);
 }
 /** Weapon, projectile, melee and explosion reports from the weapon system. */
 private npcWeapons=new Map<string,{audio:NativeWeaponAudio;entity:NativePhysicalEntity;lastUsed:number}>();
 combat(event:'fire'|'impact'|'reloadA'|'reloadB'|'explosion'|'pain'|'block',weapon:number,position:NativeVec,source:NativeCombatSource,shooterKey?:string,shooterEntity?:NativePhysicalEntity){
  const fixed:NativePhysicalEntity={position:()=>position},shooter=(source==='player'||source==='stealth')&&this.player?this.player:fixed;
  // An explosion's number is its volume in dB (CExplosion::AddExplosion's CreateAndPlayFxWithSound).
  if(event==='explosion')this.explosions.addAudioEvent(position,weapon);
  else if(event==='reloadA'||event==='reloadB')this.playerWeapon.addAudioEvent(event==='reloadA'?AE_WEAPON.reloadA:AE_WEAPON.reloadB,weapon,shooter);
  else if(event==='fire'){
   if(weapon===35||weapon===36)this.globalWeapon.projectileFire(weapon,source==='player'?shooter:fixed);
   // CVehicle::FireFixedMachineGuns reports AE_WEAPON_FIRE_PLANE with the minigun swapped for the M4.
   else if(source==='aircraft')this.globalWeapon.weaponFire(weapon===38?31:weapon,fixed,AE_WEAPON.firePlane);
   // Each ped keeps its own CAEPedWeaponAudioEntity: the 25 ms repeat limit, the minigun and flamethrower states and
   // sounds tied to the ped carry from shot to shot.
   else if(source==='npc'){
    let entry=shooterKey?this.npcWeapons.get(shooterKey):undefined;
    if(!entry){entry={audio:new NativeWeaponAudio(this.manager,this.bank,this.random,e=>this.defaultVolume(e)),entity:fixed,lastUsed:0};if(shooterKey){this.npcWeapons.set(shooterKey,entry);if(this.npcWeapons.size>32)for(const [k,v] of this.npcWeapons)if(v.lastUsed<performance.now()-10000)this.npcWeapons.delete(k);}}
    entry.lastUsed=performance.now();if(shooterEntity)entry.entity=shooterEntity;
    entry.audio.weaponFire(weapon,shooterKey?entry.entity:fixed,AE_WEAPON.fire);
   }
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
   const input=build();this.env.camera=input.camera;this.radioInput=input;
   // CAudioEngine::Service: the track stream's managers first, the radio's with the stream's play time.
   this.radioStream?.service();this.radioTracks.service(this.radioWorld(input));
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
   this.playerInVehicle=!!input.player?.inVehicle;
   if(input.player&&this.player){
    const p=input.player;this.playerWeapon.service(p.weapon,this.player,!p.onFoot||!!p.swimming);
    // CAEPedWeaponAudioEntity chainsaw sources: held on foot it idles, attacking revs it.
    if(p.weapon===9&&p.onFoot)this.playerWeapon.addAudioEvent(p.attacking?AE_WEAPON.chainsawActive:AE_WEAPON.chainsawIdle,9,this.player);
    this.serviceRadio(!!p.radio,input.camera.position);
   }else this.serviceRadio(false,input.camera.position);
   // The scrape stop reads this frame's clock, as CAECollisionAudioEntity::Service reads CTimer's.
   this.collisions.service(Math.round(this.timeMs));this.pendingThunder=false;
   this.policeScanner.widescreen=!!input.widescreen;
   this.manager.service(Math.round(this.timeMs));
   // CAudioEngine::Service runs the police scanner after the sound manager.
   this.policeScanner.service();
  }
  return frames;
 }
  /** Stop everything (CAESoundManager::Reset). */
  reset(){for(const e of this.entities.values())e.terminate();this.entities.clear();for(const e of this.fires.values())e.terminate();this.fires.clear();this.policeScanner.reset();this.radioTracks.reset();this.manager.reset();}
  snapshot(){const slots:Record<number,number>={};for(const sound of this.manager.sounds)if(sound.inUse)slots[sound.slot]=(slots[sound.slot]??0)+1;return {waterCannon:this.waterCannon.snapshot(),...this.manager.snapshot(),slots,footsteps:this.playerPed?.footstepsPlayed??0,painCries:this.painCries,scanner:this.policeScanner.snapshot(),script:this.scriptAudio.snapshot(),garageDoors:Object.fromEntries([...this.garageDoors].map(([name,door])=>[name,Object.fromEntries(door.told)])),radio:{...this.radioTracks.snapshot(),stream:this.radioStream?.snapshot?.()??null},banks:this.bank.snapshot(),vehicles:[...this.entities.values()].map(e=>e.snapshot()),fires:this.fires.size,weather:this.weather.snapshot()};}
}
