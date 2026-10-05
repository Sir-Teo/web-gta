import {SOUND,type NativeAudioEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
import {NativeTwinLoopSound} from './NativeTwinLoopSound';
import {VEHICLE_AUDIO_SETTINGS} from './vehicleAudioSettings';
import {audioLog10,clamp,invLerp,lerp,piecewiseLinear,randomInt,resolveProbability,stepTo,type AudioRandom} from './nativeAudioUtility';
import {cullAirResistance} from '../../simulation/nativeAirResistance';
/** eAEVehicleSoundType. */
export const AE_VEHICLE={car:0,bike:1,bmx:2,boat:3,heli:4,plane:5,seaplane:6,oneGear:7,train:8,special:9,none:10} as const;
/** eAudioEvents used by vehicles and weather. */
export const AE={generalVehicleSound:77,carBonnetOpen:78,carBonnetClose:84,tyreBurst:90,windscreenShatter:91,lightSmash:92,carHorn:95,bikeBell:96,siren:97,nitroIgnition:102,startEngine:103,suspensionHydraulic:107,suspensionTrigger:109,suspensionOn:110,suspensionOff:111,pedCrunch:119,thunder:141,rainCollision:142,rain:143,cityNoise:144} as const;
/** eDummyEngineSoundType::AE_DUMMY_ID, the golf cart's loop. */
const ENGINE_DUMMY_ID=1;
const ENGINE={carRev:1,carId:2,playerCrz:3,playerAc:4,playerOff:5,nitro1:7,nitro2:8,steam:9,fucked:10} as const;
const AIRCRAFT={distant:1,front:2,near:3,rear:4,thrust:5,jetDistant:7} as const;
/** CAEVehicleAudioEntity::eAEState. */
export const AE_STATE={carOff:0,dummyId:1,dummyCrz:2,playerAcFull:3,playerWheelSpin:4,playerCrz:5,playerId:6,playerReverse:7,playerReverseOff:8,playerFailingToAc:9,numStates:10} as const;
const MODEL={dumper:406,firetruk:407,ambulan:416,mrwhoop:423,enforcer:427,predator:430,rhino:432,barracks:433,artict1:435,packer:443,pizzaboy:448,artict2:450,caddy:457,faggio:462,baggage:485,maverick:487,vcnmav:488,fbiranch:490,shamal:519,hydra:520,copbike:523,fbitruck:528,forklift:530,vortex:539,kart:571,mower:572,sweeper:574,at400:577,tug:583,petrotr:584,artict3:591,androm:592,copcarla:596,copcarsf:597,copcarvg:598,copcarru:599,swatvan:601} as const;
const HORN_PATTERN_SIZE=44;
/** HornPattern (0x862B9C): 8 × 44 booleans, stored as bit strings. */
const HORN_PATTERNS=[
 '00111000011110000111100000000001111111111100','00111111111100001111100001111111111111111100','00111110000111100001111111110000000001111100','00111100001111100000000000000000000000000000',
 '00000000001100001100001110000111100000000000','00111100001111100001110000111000001111111100','00111100001111100001111110000000000000111100','11110000111111111111111100111110111111110000',
].map(p=>p.slice(0,HORN_PATTERN_SIZE));
const CAR_WHEEL={frontLeft:0,rearLeft:1,frontRight:2,rearRight:3} as const;
/** eTrainEngineSoundType's engine sounds. */
const TRAIN={engine:1,track:2} as const;
/** TrainCarriagesNoise: the track sound's pitch by the carriage's place in its train. */
const TRAIN_CARRIAGES_NOISE=[1.08,.96,1.04,.92,1];
/** eBoatEngineSoundType's engine sounds. */
const BOAT={engine:2,distant:3,waterSkim:6} as const;
/** s_Config defaults (AEVehicleAudioEntity.h). */
const CFG={
 freqUnderwaterFactor:.7,idRollOff:2,
 train:{
  tram:{engineRollOff:4,trackRollOff:5,track:{volBase:10,frqMin:.8,frqMax:1.2},engine:{frqMin:.9,frqMax:1.1,frqSlopeFactor:-.35}},
  generic:{engineRollOff:4.5,trackRollOff:4.5,track:{volBase:6,frqMin:.8,frqMax:1.2},engine:{frqMin:.8,frqMax:1.2,frqSlopeFactor:-.6}}},
 boat:{engineRollOff:3.5,distantRollOff:5,waterSkimRollOff:2.5,frqEngineRollFactor:.1,frqEngineBase:.6,frqEngineOnWaterFactor:.4,frqEngineInAirFactor:.7,volBase:-3,volEngineSpeedFactor:3,
  overWater:{volBaseOfSeaplane:12,volBase:3,volUnderwaterOffset:6,frqBase:.8,frqSpeedFactor:.2,frqUnderwaterFactor:.185}},revRollOff:2,roadNoiseRollOff:3,flatTireRollOff:3,reverseGearRollOff:1,volOffsetOnGround:1.5,rotorVolTiltFactor:.67,
 gasPedal:{stepDown:.07,stepUp:.09},flatTyre:{volOffset:-9,frqGearVelocityFactor:.4},
 roadNoise:{volBase:-12,fadeOutDistance:72,grass:{frq:1.3,vol:0},wet:{frq:1,vol:4.5},std:{frq:1,vol:0}},
 skid:{volBase:0,volOffsetForPlaneOrHeli:12,grass:{vol:-12,frq:.9,wheel:.2},wet:{vol:-9,frq:.9,wheel:.2},std:{frqBikeFactor:1.2,vol:0,frq:.8,wheel:.125},drive:{spinning:1,skidding:1,stationary:1.2},nonDrive:{skidding:1,stationary:1.2}},
 horn:{doppler:.17,bikeBellFadeOut:1.5},siren:{doppler:.25},reverseGear:{frqBase:.75,frqRevs:.2,volBase:-6},rainOnVehicle:{volBase:0},
 nitro:{stepUp:.075,stepDown:.085,sounds:[{frqMin:.75,frqMax:.84,volMin:-6,volMax:2},{frqMin:.8,frqMax:1,volMin:-36,volMax:-9}]},
 engineDamage:{steam:{frqMin:.9,frqMax:1.1,volMin:-24,volMax:-21,rollOff:1},fucked:{frqMin:.9,frqMax:1.2,volMin:-24,volMax:-18,rollOff:2.5}},
 heli:{rotorFreqVariance:{min:-.1,max:.1,offset:.75},loSpeed:{up:.03,down:.03},hiSpeed:{up:.005,down:.005},copHeliVolOffset:6},
 dummyCar:{idleToIdle:{fadeIn:.1,fadeOut:.1},crzToCrz:{fadeIn:.05,fadeOut:.05}},
 dummyEngine:{volumeUnderwaterOffset:6,volumeTrailerOffset:6,id:{ratio:.2,volBase:-3,volMax:0,frqBase:.85,frqMax:1.2},rev:{ratio:.15,volBase:-4.5,volMax:0,frqBase:.9,frqMax:1.5},golfCart:{frqMin:.85,frqMax:1.2,volOffset:-3}},
 player:{frqBikeLeanFactor:.12,frqPlayerBikeBoostOffset:.1,crzSpeedOffset:.001,crzMaxCnt:150,zMoveSpeedThreshold:.2,maxAuGear:5,singleGearVolume:-2,frqWheelSpinFactor:.25,frqZMin:-.2,frqZMax:.2,frqZFactor:.15,
  rev:{frqWheelSpinFactor:.2,frqOffset:1,frqMin:.2,frqMax:.4,volMin:-4,volMax:0},id:{frqMin:.85,frqMax:1.5,volMin:-3.5,volMax:-1.5},
  crz:{frqSingleGear:1,frqMin:.925,frqMax:1.25,volMin:0,volMax:2,rollOff:2},
  ac:{frqSingleGear:1,frqMultiGearOffset:1,frqPerGear:[.4,.22,.13,.075,0,-.075],volMin:-2,volMax:0,rollOff:2,soundLength:1000,loopMaxPlayTimePercentage:80,loopInterval:120,loopFrameCnt:10,wheelSpinThreshold:150/255,speedOffset:.0015,inhibitForLowSpeedLimit:.1},
  off:{frqMin:.75,frqMax:1.25,rollOff:2}},
} as const;
export interface NativeTransmission {driveType:string;maxVelocity:number;maxReverseVelocity:number;numberOfGears:number;gears:readonly {maxVelocity:number;changeUpVelocity:number;changeDownVelocity:number}[]}
export type NativeWheelState='normal'|'spinning'|'skidding'|'fixed';
/** Per-frame CVehicle fields read by the entity. Speeds are native units per 50 Hz frame. */
export interface NativeVehicleAudioInput {
 position:NativeVec;right:NativeVec;forward:NativeVec;up:NativeVec;moveSpeed:NativeVec;
 status:'player'|'physics'|'simple'|'abandoned'|'wrecked';
 /** m_pDriver is the player; `playerInVehicle` covers passengers too. */
 playerDriver:boolean;playerInVehicle:boolean;playerAlive:boolean;
 engineOn:boolean;gasPedal:number;brakePedal:number;handbrake:boolean;gear:number;
 /** CPad accelerate/brake as 0..1 for the player's vehicle. */
 padAccelerate:number;padBrake:number;
 health:number;drowning:boolean;underwater:boolean;towing:boolean;
 /** handlingFlags.bNosInst with m_fTireTemperature below zero: the nitro is burning. */
 nitro?:boolean;
 /** m_HornCounter / m_HornPattern, written back by GetHornState. */
 horn:{counter:number;pattern:number};sirenOrAlarm:boolean;alarmState:number;
 autopilotSpeed?:number;transmission?:NativeTransmission;
 wheels?:{states:readonly NativeWheelState[];counts:readonly number[];contactWheels:number;driveOnGround:number;driveOnGroundLastFrame:number;spinForAudio:number;burst:readonly boolean[]};
 contactSurface?:{grass:boolean;wet:boolean};
 /** CHeli::m_fHeliRotorSpeed and CPlane::m_fPropSpeed. */
 rotorSpeed?:number;propSpeed?:number;
 /** COMPONENT_WING_RR world position for helicopters. */
 nearPosition?:NativeVec;
 /** CTrain's m_fTrainSpeed, bClockwiseDirection, bIsFrontCarriage and bNotOnARailRoad, and the carriage's place in its
  * train counted from the engine (itself and every m_pPrevCarriage, from 1). */
 train?:{speed:number;clockwise:boolean;front:boolean;notOnARailRoad:boolean;carriage:number};
 /** CBoat's m_EngineSpeed (the propeller's) and m_nBoatFlags.bBoatInWater, for a boat or a seaplane. */
 boat?:{engineSpeed:number;inWater:boolean};
 /** CBike's m_RideAnimData.LeanAngle (radians) and bikeFlags.bPlayerBoost, for a motorbike. */
 bike?:{leanAngle:number;playerBoost:boolean};
}
export interface NativeVehicleAudioContext {
 manager:NativeSoundManager;bank:NativeBankLoader;random:AudioRandom;
 defaultVolume(event:number):number;
 /** CAEWeatherAudioEntity::m_sfRainVolume and CWeather::UnderWaterness. */
 rainVolume():number;underwaterness():number;
 /** s_DummyEngineSlots (0xB6B9A0). */
 dummySlots:{bank:number;refCount:number}[];
}
const dot=(a:NativeVec,b:NativeVec)=>a.x*b.x+a.y*b.y+a.z*b.z;
/** CAEVehicleAudioEntity (gta-reversed 0076f901) for automobiles and aircraft; ProcessGenericJet follows gta-reversed PR #1225. */
export class NativeVehicleAudio implements NativeAudioEntity {
 readonly settings;readonly type:number;
 initialized=false;isPlayerDriver=false;isPlayerPassenger=false;playerDriverAboutToExit=false;wrecked=false;
 state:number=AE_STATE.carOff;auGear=0;crzCount=0;singleGear=false;rainDropCounter=0;stalledCount=0;swapStalledTime=0;silentStalled=false;
 hornOn=false;sirenOn=false;fastSirenOn=false;hornVolume=-100;hasSiren=false;
 timeBeforeAllowAccelerate=0;timeBeforeAllowCruise=0;eventVolume=0;
 dummyEngineBank=-1;playerEngineBank=-1;dummySlot=-1;
 readonly engineSounds:(NativeSound|undefined)[]=new Array(12).fill(undefined);
 private acPlayPositionThisFrame=-1;private acPlayPositionLastFrame=-1;private framesAgoACLooped=0;private acPlayPercentWhenStopped=0;private timeACStopped=0;private acPlayPositionWhenStopped=0;
 private surfaceSoundType=-1;private roadNoiseSoundType=-1;private roadNoiseSound?:NativeSound;private flatTireSoundType=-1;private flatTireSound?:NativeSound;
 private reverseGearSoundType=-1;private reverseGearSound?:NativeSound;hornSound?:NativeSound;sirenSound?:NativeSound;fastSirenSound?:NativeSound;
 readonly skid:NativeTwinLoopSound;
 currentRotorFrequency=-1;currentDummyEngineVolume=-100;currentDummyEngineFrequency=-1;fadeIn=1;fadeOut=0;
 /** CAutomobile::m_GasPedalAudioRevs and m_PrevSpeed. */
 gasPedalAudioRevs=0;prevSpeed=0;audioChangingGear=false;
 private vehicle!:NativeVehicleAudioInput;
 constructor(private ctx:NativeVehicleAudioContext,readonly modelId:number){
  const row=VEHICLE_AUDIO_SETTINGS[modelId-400];if(!row)throw new Error(`No vehicle audio settings for model ${modelId}.`);
  this.settings={type:row[0],playerBank:row[1],dummyBank:row[2],hornType:row[4],hornPitch:row[5],doorType:row[6],engineVolumeOffset:row[9]};this.type=row[0];
  this.skid=new NativeTwinLoopSound(ctx.manager,ctx.random);
  this.initialise();
 }
 private get manager(){return this.ctx.manager;}
 private get time(){return this.manager.clock.timeMs;}
 /** Initialise (0x4F7670). */
 private initialise(){
  const m=this.modelId,s=this.settings;
  this.hasSiren=m===MODEL.firetruk||m===MODEL.ambulan||m===MODEL.mrwhoop||(m!==MODEL.rhino&&([MODEL.enforcer,MODEL.predator,MODEL.rhino,MODEL.barracks,MODEL.fbiranch,MODEL.copbike,MODEL.fbitruck,MODEL.copcarla,MODEL.copcarsf,MODEL.copcarvg,MODEL.copcarru,MODEL.swatvan] as number[]).includes(m));
  this.eventVolume=this.ctx.defaultVolume(AE.generalVehicleSound);
  this.singleGear=([MODEL.pizzaboy,MODEL.caddy,MODEL.faggio,MODEL.baggage,MODEL.forklift,MODEL.vortex,MODEL.kart,MODEL.mower,MODEL.sweeper,MODEL.tug] as number[]).includes(m);
  this.playerEngineBank=s.playerBank;this.dummyEngineBank=s.dummyBank;
  switch(s.type){
   case AE_VEHICLE.car:this.eventVolume-=CFG.volOffsetOnGround;if(s.dummyBank!==-1&&s.dummyBank!==129)this.dummySlot=this.requestBankSlot(s.dummyBank);break;
   case AE_VEHICLE.bike:case AE_VEHICLE.bmx:if(s.type===AE_VEHICLE.bike)this.eventVolume-=CFG.volOffsetOnGround;if(s.dummyBank!==-1)this.dummySlot=this.requestBankSlot(s.dummyBank);break;
   case AE_VEHICLE.boat:case AE_VEHICLE.train:if(s.dummyBank!==-1&&s.dummyBank!==129)this.dummySlot=this.requestBankSlot(s.dummyBank);break;
   case AE_VEHICLE.plane:if(s.dummyBank!==-1)this.dummySlot=this.requestBankSlot(s.dummyBank);break;
   case AE_VEHICLE.special:this.eventVolume-=1.5;if(s.dummyBank!==-1)this.dummySlot=this.requestBankSlot(s.dummyBank);break;
  }
  this.initialized=true;
 }
 /** Terminate (0x4FB8C0). */
 terminate(){
  if(!this.initialized)return;
  for(let i=0;i<this.engineSounds.length;i++)this.gracefullyStop(i);
  this.stopNonEngineSounds();
  if(this.dummySlot!==-1){this.stoppedUsingBankSlot(this.dummySlot);this.dummySlot=-1;}
  this.dummyEngineBank=this.playerEngineBank=-1;this.state=AE_STATE.carOff;this.isPlayerDriver=this.isPlayerPassenger=this.playerDriverAboutToExit=false;this.initialized=false;
 }
 // Dummy bank slot management (0x4F4D10-0x4F4E60)
 private requestBankSlot(bank:number){
  const slots=this.ctx.dummySlots,used=slots.findIndex(s=>s.bank===bank);
  if(used>=0){slots[used].refCount++;return SLOT.dummyFirst+used;}
  const free=slots.findIndex(s=>s.refCount<1);if(free<0)return -1;
  this.manager.cancelSoundsInBankSlot(SLOT.dummyFirst+free,true);this.ctx.bank.loadSoundBank(bank,SLOT.dummyFirst+free);
  slots[free]={bank,refCount:1};return SLOT.dummyFirst+free;
 }
 private demandBankSlot(bank:number){
  const s=this.requestBankSlot(bank);if(s!==-1)return s;
  const slots=this.ctx.dummySlots;let least=0;for(let i=1;i<slots.length;i++)if(slots[i].refCount<slots[least].refCount)least=i;
  slots[least].refCount=0;return this.requestBankSlot(bank);
 }
 private stoppedUsingBankSlot(slot:number){const s=this.ctx.dummySlots[slot-SLOT.dummyFirst];if(s)s.refCount=Math.max(s.refCount-1,0);}
 private doesBankSlotContainThisBank(slot:number,bank:number){return this.ctx.dummySlots[slot-SLOT.dummyFirst]?.bank===bank;}
 private loaded(bank:number,slot:number){return this.ctx.bank.isSoundBankLoaded(bank,slot);}
 /** UpdateParameters (0x4FB6C0). */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition===-1){
   if(sound===this.roadNoiseSound)this.roadNoiseSound=undefined;else if(sound===this.flatTireSound)this.flatTireSound=undefined;
   else if(sound===this.reverseGearSound)this.reverseGearSound=undefined;else if(sound===this.hornSound)this.hornSound=undefined;
   else if(sound===this.sirenSound)this.sirenSound=undefined;else if(sound===this.fastSirenSound)this.fastSirenSound=undefined;
   else{const i=this.engineSounds.indexOf(sound);if(i>=0)this.engineSounds[i]=undefined;}
  }else if(this.isAircraft&&this.engineSounds[AIRCRAFT.near]===sound)sound.setPosition(this.aircraftNearPosition());
  else if(this.vehicle)sound.setPosition(this.vehicle.position);
  if((this.type===AE_VEHICLE.car||this.type===AE_VEHICLE.bike)&&sound===this.engineSounds[ENGINE.playerAc]){this.acPlayPositionLastFrame=this.acPlayPositionThisFrame;this.acPlayPositionThisFrame=playPosition;}
 }
 private get isAircraft(){return this.type===AE_VEHICLE.heli||this.type===AE_VEHICLE.plane||this.type===AE_VEHICLE.seaplane;}
 private aircraftNearPosition(){return this.type===AE_VEHICLE.heli?this.vehicle.nearPosition??this.vehicle.position:this.vehicle.position;}
 private play(slot:number,sound:number,volume:number,extra:Partial<Parameters<NativeSoundManager['playSound']>[0]>={}){
  return this.manager.playSound({slot,sound,entity:this,position:this.vehicle.position,volume,...extra});
 }
 /** AddAudioEvent (0x4F6420): doors, engine start, tyre burst and glass. */
 addAudioEvent(event:number){
  if(event===AE.pedCrunch){
   // COLCARPED; a second crunch while one plays starts 40% in at 0.8 speed. Bikes -3 dB, BMX -6 dB.
   if(!this.vehicle||!this.loaded(BANK.collisions,SLOT.collisions))return;
   const again=this.manager.areSoundsOfThisEventPlayingForThisEntity(AE.pedCrunch,this)>0;
   const volume=this.ctx.defaultVolume(AE.pedCrunch)-(this.type===AE_VEHICLE.bike?3:this.type===AE_VEHICLE.bmx?6:0);
   this.play(SLOT.collisions,0x1d,volume,{rollOff:1.5,speed:again?.8:.94,flags:SOUND.startPercentage,speedVariance:.06,playTime:again?40:0,event:AE.pedCrunch});
   return;
  }
  if(!this.vehicle||!this.loaded(BANK.vehicleGen,SLOT.vehicleGen)||!this.loaded(BANK.collisions,SLOT.collisions)||!this.loaded(BANK.bulletHits,SLOT.bulletHits))return;
  if(event>=AE.carBonnetOpen&&event<AE.carBonnetClose){
   const sfx=[0x27,0x29,0x28,0x2b,0x2a][this.settings.doorType]??0x28;
   this.play(SLOT.vehicleGen,sfx,this.ctx.defaultVolume(AE.carBonnetOpen),{speedVariance:.02});
  }else if(event>=AE.carBonnetClose&&event<=AE.carBonnetClose+5){
   const sfx=[0x20,0x22,0x21,0x24,0x23][this.settings.doorType]??0x21;
   this.play(SLOT.vehicleGen,sfx,this.ctx.defaultVolume(AE.carBonnetClose),{speedVariance:.02});
  }else if(event===AE.tyreBurst)this.play(SLOT.bulletHits,0,this.ctx.defaultVolume(AE.tyreBurst));
  else if(event===AE.windscreenShatter)this.play(SLOT.collisions,0x44,this.ctx.defaultVolume(AE.windscreenShatter));
  else if(event===AE.lightSmash)this.play(SLOT.collisions,0x35,this.ctx.defaultVolume(AE.lightSmash));
  // The hydraulic suspension (0x4F6F88-0x4F7183): the pump on vehicle_gen 0x26 (−6 dB, not restarted while it plays),
  // the trigger clunk 0x2C, SUSPENSION_ON the clunk and SUSPENSION_OFF the pump, each rolled off 2 with 0.05 variance.
  else if(event===AE.suspensionHydraulic){if(!this.manager.areSoundsOfThisEventPlayingForThisEntity(event,this))this.play(SLOT.vehicleGen,0x26,this.ctx.defaultVolume(event)-6,{rollOff:2,speedVariance:.05,event});}
  else if(event===AE.suspensionTrigger||event===AE.suspensionOn||event===AE.suspensionOff)
   this.play(SLOT.vehicleGen,event===AE.suspensionOff?0x26:0x2C,this.ctx.defaultVolume(event),{rollOff:2,flags:SOUND.startPercentage,speedVariance:.05,event});
  else if(event===AE.nitroIgnition){
   if(!this.loaded(BANK.weapons,SLOT.weaponGen)||this.manager.areSoundsOfThisEventPlayingForThisEntity(AE.nitroIgnition,this)>0)return;
   this.play(SLOT.weaponGen,83,this.ctx.defaultVolume(AE.nitroIgnition),{rollOff:2,speed:.89,speedVariance:.03,event:AE.nitroIgnition});
  }
  else if(event===AE.startEngine)this.play(SLOT.vehicleGen,0x25,this.ctx.defaultVolume(AE.startEngine),{rollOff:2,speedVariance:.05,event:AE.startEngine});
 }
 /** Service (0x502280), from CAutomobile::ProcessControl. */
 service(vehicle:NativeVehicleAudioInput){
  if(!this.initialized)return;this.vehicle=vehicle;
  if(this.isPlayerDriver&&!this.playerDriverAboutToExit&&!vehicle.playerAlive)this.playerAboutToExitVehicleAsDriver();
  const isWrecked=vehicle.status==='wrecked';if(!this.wrecked&&isWrecked)this.justWreckedVehicle();this.wrecked=isWrecked;
  const playerDriver=vehicle.playerDriver,playerPassenger=vehicle.playerInVehicle&&!playerDriver;
  if(playerDriver&&!this.isPlayerDriver)this.justGotInVehicleAsDriver();else if(!playerDriver&&this.isPlayerDriver)this.justGotOutOfVehicleAsDriver();
  this.isPlayerDriver=playerDriver;this.isPlayerPassenger=playerPassenger;
  this.processVehicle();
 }
 // Horn and siren (0x4F61E0-0x5002C0)
 private processVehicleSirenAlarmHorn(){
  const v=this.vehicle;let siren=false,fastSiren=false;
  if(!(this.wrecked||!this.hasSiren||!v.sirenOrAlarm)&&v.status!=='abandoned'){siren=true;fastSiren=v.horn.counter!==0&&this.modelId!==MODEL.mrwhoop;}
  let horn=false;
  if(!siren){
   if(!v.alarmState||v.alarmState===-1||v.status==='wrecked')horn=this.getHornState();
   else{const t=this.time;if(t>v.horn.counter)v.horn.counter=t+750;horn=v.horn.counter<t+375;}
  }
  this.playHornOrSiren(horn,siren,fastSiren);this.sirenOn=siren;this.fastSirenOn=fastSiren;this.hornOn=horn;
 }
 private getHornState(){
  const v=this.vehicle;
  if(this.wrecked||v.alarmState&&v.alarmState!==-1&&v.status!=='wrecked'||!v.horn.counter)return false;
  if(v.status==='player')return true;
  v.horn.counter=Math.min(HORN_PATTERN_SIZE,v.horn.counter);
  if(v.horn.counter===HORN_PATTERN_SIZE)v.horn.pattern=randomInt(this.ctx.random,0,7);
  return HORN_PATTERNS[v.horn.pattern][HORN_PATTERN_SIZE-v.horn.counter]==='1';
 }
 private playHornOrSiren(isHornOn:boolean,isSirenOn:boolean,isFastSirenOn:boolean){
  const s=this.settings;
  if(isHornOn&&!this.hornOn){
   const soundsLoaded=this.loaded(BANK.horn,SLOT.hornAndSiren)||this.loaded(BANK.vehicleGen,SLOT.vehicleGen);
   // A horn it cannot start yet, or one of no car kind, returns before the sirens are looked at this frame. The bike
   // bell is not ported: bikes have no entity.
   if(s.hornType<1||s.hornType>9)return;
   this.hornVolume=s.engineVolumeOffset+this.ctx.defaultVolume(AE.carHorn);
   if(!soundsLoaded||this.hornSound)return;
   this.hornSound=this.play(SLOT.hornAndSiren,s.hornType,this.hornVolume,{rollOff:2.5,speed:s.hornPitch,doppler:CFG.horn.doppler,flags:SOUND.requestUpdates});
  }else if(!isHornOn&&this.hornOn){this.hornSound?.stopSoundAndForget();this.hornSound=undefined;}
  const hornLoaded=this.loaded(BANK.horn,SLOT.hornAndSiren);
  const siren=(sid:number,slot:number=SLOT.hornAndSiren)=>this.play(slot,sid,this.ctx.defaultVolume(AE.siren),{rollOff:3,doppler:CFG.siren.doppler,flags:SOUND.requestUpdates});
  if(isFastSirenOn){if(!this.fastSirenOn&&!this.fastSirenSound&&hornLoaded)this.fastSirenSound=siren(11);}
  else{this.fastSirenSound?.stopSoundAndForget();this.fastSirenSound=undefined;}
  // Mr Whoopee's siren is its tune: SND_GENRL_HORN_HORNBMW328 (3) from its own ICEVAN_P bank in the player-engine slot,
  // and nothing until that bank is in.
  if(isSirenOn&&!isFastSirenOn){
   if((!this.sirenOn||this.fastSirenOn)&&!this.sirenSound&&hornLoaded){
    if(this.modelId===MODEL.mrwhoop){if(this.loaded(BANK.icevanP,SLOT.playerEngine))this.sirenSound=siren(3,SLOT.playerEngine);}
    else this.sirenSound=siren(10);
   }
  }
  else{this.sirenSound?.stopSoundAndForget();this.sirenSound=undefined;}
 }
 // Dummy engines (0x4FCA10-0x4F54F0)
 private processDummyStateTransition(newState:number,ratio:number){
  const oldState=this.state;this.state=newState;const cfg=CFG.dummyCar;
  if(oldState===AE_STATE.dummyId){
   if(newState===AE_STATE.dummyId){
    this.fadeIn=Math.min(1,this.fadeIn+cfg.idleToIdle.fadeIn);this.updateVehicleEngineSound(ENGINE.carId,this.frequencyForDummyIdle(ratio,this.fadeIn),this.volumeForDummyIdle(ratio,this.fadeIn));
    this.fadeOut=Math.min(1,this.fadeOut+cfg.idleToIdle.fadeOut);
    if(this.fadeOut<.99)this.updateVehicleEngineSound(ENGINE.carRev,this.frequencyForDummyRev(ratio,this.fadeOut),this.volumeForDummyRev(ratio,this.fadeOut));else this.gracefullyStop(ENGINE.carRev);
   }else if(newState===AE_STATE.carOff){this.gracefullyStop(ENGINE.carId);this.gracefullyStop(ENGINE.carRev);}
   else if(newState===AE_STATE.dummyCrz){
    // The decompiled transitions only update existing loops, which would silence a car after its first crossfade;
    // the loop the fade curves bring in (rev at -100 dB here, idle at -50 dB below) is started if it is missing.
    this.fadeOut=0;this.startVehicleEngineSound(ENGINE.carId,this.frequencyForDummyIdle(ratio,this.fadeOut),this.volumeForDummyIdle(ratio,0));
    this.fadeIn=0;this.startVehicleEngineSound(ENGINE.carRev,this.frequencyForDummyRev(ratio,this.fadeIn),this.volumeForDummyRev(ratio,0));
   }
  }else if(oldState===AE_STATE.dummyCrz){
   if(newState===AE_STATE.dummyId){
    this.fadeOut=0;this.startVehicleEngineSound(ENGINE.carRev,this.frequencyForDummyRev(ratio,this.fadeIn),this.volumeForDummyRev(ratio,0));
    this.fadeIn=0;this.startVehicleEngineSound(ENGINE.carId,this.frequencyForDummyIdle(ratio,this.fadeOut),this.volumeForDummyIdle(ratio,0));
   }else if(newState===AE_STATE.dummyCrz){
    this.fadeIn=Math.min(1,this.fadeIn+cfg.crzToCrz.fadeIn);this.updateVehicleEngineSound(ENGINE.carRev,this.frequencyForDummyRev(ratio,this.fadeIn),this.volumeForDummyRev(ratio,this.fadeIn));
    this.fadeOut=Math.min(1,this.fadeOut+cfg.crzToCrz.fadeOut);
    if(this.fadeOut<.99){if(this.fadeOut>.65&&this.fadeOut<.75)this.audioChangingGear=true;this.updateVehicleEngineSound(ENGINE.carId,this.frequencyForDummyIdle(ratio,this.fadeOut),this.volumeForDummyIdle(ratio,this.fadeOut));}
    else this.gracefullyStop(ENGINE.carId);
   }else if(newState===AE_STATE.carOff){this.cancelVehicleEngineSound(ENGINE.carRev);this.cancelVehicleEngineSound(ENGINE.carId);}
  }else if(oldState===AE_STATE.carOff||oldState===AE_STATE.numStates){
   if(newState===AE_STATE.dummyId||newState===AE_STATE.dummyCrz){
    if(oldState===AE_STATE.carOff)this.addAudioEvent(AE.startEngine);
    this.fadeOut=this.fadeIn=1;
    if(newState===AE_STATE.dummyId)this.startVehicleEngineSound(ENGINE.carId,this.frequencyForDummyIdle(ratio,1),this.volumeForDummyIdle(ratio,1));
    else this.startVehicleEngineSound(ENGINE.carRev,this.frequencyForDummyRev(ratio,1),this.volumeForDummyRev(ratio,1));
   }
  }
 }
 private volumeForDummyIdle(ratio:number,fade:number){
  const c=CFG.dummyEngine;if(this.modelId===MODEL.caddy)return c.id.volBase-30;
  let volume=lerp(c.id.volBase,c.id.volMax,clamp(ratio/c.id.ratio,0,1));
  if(this.state===AE_STATE.dummyCrz)volume+=audioLog10(piecewiseLinear([[0,1],[.3,1],[.5,1],[.7,.707],[1.0001,0]],fade))*20;
  else if(fade<=.99)volume+=audioLog10(fade)*10;
  return this.engineOffsets(volume);
 }
 private frequencyForDummyIdle(ratio:number,fade:number){
  const c=CFG.dummyEngine;if(this.modelId===MODEL.caddy)return 1;
  let f=lerp(c.id.frqBase,c.id.frqMax,clamp(ratio/c.id.ratio,0,1));
  if(this.state===AE_STATE.dummyCrz)f*=piecewiseLinear([[0,1],[.3,1],[.5,.85],[.7,.85],[1.0001,.85]],fade);
  return this.vehicle.drowning?f*CFG.freqUnderwaterFactor:f;
 }
 private volumeForDummyRev(ratio:number,fade:number){
  const c=CFG.dummyEngine;let volume=lerp(c.rev.volBase,c.rev.volMax,clamp(invLerp(c.rev.ratio,1,ratio),0,1));
  if(this.state!==AE_STATE.dummyCrz)volume+=audioLog10(1-fade)*10;
  else if(fade<=.99)volume+=audioLog10(piecewiseLinear([[0,0],[.3,0],[.5,.707],[.7,1],[1.0001,1]],fade))*20;
  return this.engineOffsets(volume);
 }
 private frequencyForDummyRev(ratio:number,fade:number){
  const c=CFG.dummyEngine;let f=lerp(c.rev.frqBase,c.rev.frqMax,clamp(invLerp(c.rev.ratio,1,ratio),0,1));
  if(this.state===AE_STATE.dummyCrz&&fade<.99)f*=piecewiseLinear([[0,1],[.5,1],[.7,1.2],[.85,1],[1.0001,1]],fade);
  return this.vehicle.drowning?f*CFG.freqUnderwaterFactor:f;
 }
 private engineOffsets(volume:number){
  if(this.vehicle.drowning)volume-=CFG.dummyEngine.volumeUnderwaterOffset;if(this.vehicle.towing)volume+=CFG.dummyEngine.volumeTrailerOffset;
  return volume+this.settings.engineVolumeOffset;
 }
 // Engine sound management (0x4F55C0-0x4F7F20)
 private gracefullyStop(st:number){const s=this.engineSounds[st];this.engineSounds[st]=undefined;if(s){s.setFlags(SOUND.requestUpdates,false);s.stopSound();}}
 private cancelVehicleEngineSound(st:number){
  const s=this.engineSounds[st],length=s?s.length:-1;this.gracefullyStop(st);
  if(st===ENGINE.playerAc){
   this.acPlayPositionWhenStopped=this.acPlayPositionThisFrame;this.timeACStopped=this.time;this.acPlayPositionThisFrame=this.acPlayPositionLastFrame=-1;
   this.acPlayPercentWhenStopped=length>0?Math.trunc(clamp(this.acPlayPositionWhenStopped/length,0,1)*100):0;
  }
 }
 /** CancelAllVehicleEngineSounds, keeping `except` playing. */
 private cancelAllVehicleEngineSounds(except?:number){for(let i=0;i<this.engineSounds.length;i++)if(i!==except)this.cancelVehicleEngineSound(i);}
 private updateVehicleEngineSound(st:number,speed:number,volume:number){return this.updateVehicleEngineSoundRawVolume(st,speed,this.eventVolume+volume);}
 private updateVehicleEngineSoundRawVolume(st:number,speed:number,volume:number){const s=this.engineSounds[st];if(!s)return false;s.speed=speed;s.volume=volume;return true;}
 private requestNewPlayerCarEngineSound(st:number,speed=1,volume=-100){
  volume+=this.eventVolume;if(this.dummySlot===-1)return;
  if(st===ENGINE.carRev||st===ENGINE.carId){if(!this.loaded(this.dummyEngineBank,this.dummySlot))return;}
  else if(!this.loaded(this.playerEngineBank,SLOT.playerEngine))return;
  const play=(slot:number,sfx:number,rollOff:number,flags=0,playTime=0)=>{this.engineSounds[st]=this.play(slot,sfx,volume,{rollOff,speed,flags:SOUND.requestUpdates|flags,playTime});};
  const p=CFG.player;
  if(st===ENGINE.carRev)play(this.dummySlot,0,CFG.revRollOff);
  else if(st===ENGINE.carId)play(this.dummySlot,1,CFG.idRollOff);
  else if(st===ENGINE.playerCrz)play(SLOT.playerEngine,1,p.crz.rollOff);
  else if(st===ENGINE.playerAc){
   this.framesAgoACLooped=0;const delta=this.time-this.timeACStopped;
   if(delta<=p.ac.soundLength){const pos=clamp(lerp(this.acPlayPercentWhenStopped,0,delta/p.ac.soundLength),0,p.ac.loopMaxPlayTimePercentage);if(pos>10)this.framesAgoACLooped=p.ac.loopFrameCnt+1;play(SLOT.playerEngine,0,p.ac.rollOff,SOUND.startPercentage,Math.trunc(pos));}
   else play(SLOT.playerEngine,0,p.ac.rollOff,SOUND.startPercentage,0);
  }else if(st===ENGINE.playerOff)play(SLOT.playerEngine,2,p.off.rollOff);
 }
 private startVehicleEngineSound(st:number,speed:number,volume:number){
  volume+=this.eventVolume;const s=this.engineSounds[st];if(s){s.volume=volume;s.speed=speed;return;}
  if(st===ENGINE.carId)this.engineSounds[st]=this.play(this.dummySlot,1,volume,{rollOff:CFG.idRollOff,speed,flags:SOUND.requestUpdates});
  else if(st===ENGINE.carRev)this.engineSounds[st]=this.play(this.dummySlot,0,volume,{rollOff:CFG.revRollOff,speed,flags:SOUND.requestUpdates});
 }
 private updateGenericVehicleSound(st:number,slot:number,bank:number,sfx:number,speed:number,volume:number,rollOff:number){
  volume+=this.eventVolume;const s=this.engineSounds[st];
  if(s){s.volume=volume;s.speed=speed;}else if(this.loaded(bank,slot))this.engineSounds[st]=this.play(slot,sfx,volume,{rollOff,speed,flags:SOUND.requestUpdates});
 }
 // Player transitions (0x4FD0B0-0x4F5E50)
 private justWreckedVehicle(){if(this.type!==AE_VEHICLE.none&&this.type!==AE_VEHICLE.oneGear)this.cancelAllVehicleEngineSounds();this.stopNonEngineSounds();}
 private justGotOutOfVehicleAsDriver(){
  this.playerDriverAboutToExit=false;
  if(this.type===AE_VEHICLE.car||this.type===AE_VEHICLE.bike){
   this.eventVolume=this.ctx.defaultVolume(AE.generalVehicleSound)-CFG.volOffsetOnGround;this.fadeIn=this.fadeOut=1;
   if(this.state===AE_STATE.playerId){this.cancelAllVehicleEngineSounds(ENGINE.carId);this.state=AE_STATE.dummyId;}
   else{this.cancelAllVehicleEngineSounds();if(this.state!==AE_STATE.carOff)this.state=AE_STATE.numStates;}
   this.playGeneric('reverse',-1);this.auGear=0;
  }else if(this.type===AE_VEHICLE.special)this.eventVolume=this.ctx.defaultVolume(AE.generalVehicleSound)-CFG.volOffsetOnGround;
  else if(this.isAircraft){this.cancelAllVehicleEngineSounds();this.currentRotorFrequency=-1;this.currentDummyEngineVolume=-100;}
 }
 private justGotInVehicleAsDriver(){
  this.playerDriverAboutToExit=false;
  const cancelPlayerEngine=()=>{if(this.manager.areSoundsPlayingInBankSlot(SLOT.playerEngine))this.manager.cancelSoundsInBankSlot(SLOT.playerEngine,false);};
  if(this.type===AE_VEHICLE.car||this.type===AE_VEHICLE.bike){
   this.eventVolume=this.ctx.defaultVolume(AE.generalVehicleSound);this.auGear=0;this.crzCount=0;this.acPlayPositionThisFrame=this.acPlayPositionLastFrame=-1;
   cancelPlayerEngine();if(this.dummyEngineBank===-1||this.playerEngineBank===-1)return;
   if(this.dummySlot===-1)this.dummySlot=this.demandBankSlot(this.dummyEngineBank);
   this.ctx.bank.loadSoundBank(this.playerEngineBank,SLOT.playerEngine);
   if(this.state!==AE_STATE.dummyId||this.dummySlot===-1){this.cancelAllVehicleEngineSounds();this.state=AE_STATE.carOff;}
   else{this.cancelAllVehicleEngineSounds(ENGINE.carId);this.state=AE_STATE.playerId;}
  }else if(this.isAircraft){
   this.cancelAllVehicleEngineSounds();
   if(this.playerEngineBank!==-1&&!this.loaded(this.playerEngineBank,SLOT.playerEngine)){cancelPlayerEngine();this.ctx.bank.loadSoundBank(this.playerEngineBank,SLOT.playerEngine);}
   if(this.dummyEngineBank!==-1&&this.dummySlot===-1)this.dummySlot=this.demandBankSlot(this.dummyEngineBank);
   this.currentRotorFrequency=-1;this.currentDummyEngineVolume=-100;
  }else if(this.type===AE_VEHICLE.boat){
   this.eventVolume=this.ctx.defaultVolume(AE.generalVehicleSound);
   if(this.dummySlot===-1)this.dummySlot=this.demandBankSlot(this.dummyEngineBank);
  }else if(this.type===AE_VEHICLE.special){
   this.eventVolume=this.ctx.defaultVolume(AE.generalVehicleSound);cancelPlayerEngine();this.cancelAllVehicleEngineSounds();
   if(this.dummyEngineBank!==-1&&this.dummySlot===-1){this.dummySlot=this.demandBankSlot(this.dummyEngineBank);this.ctx.bank.loadSoundBank(this.playerEngineBank,SLOT.playerEngine);}
  }
 }
 private playerAboutToExitVehicleAsDriver(){this.playerDriverAboutToExit=true;}
 private justFinishedAccelerationLoop(){
  const ac=CFG.player.ac;
  if(this.framesAgoACLooped<ac.loopFrameCnt){this.framesAgoACLooped++;return false;}
  if(this.acPlayPositionThisFrame<0||this.acPlayPositionLastFrame<0)return false;
  const s=this.engineSounds[ENGINE.playerAc];if(s&&this.acPlayPositionThisFrame+ac.loopInterval>s.length){this.framesAgoACLooped=0;return true;}
  return false;
 }
 // Surface, road noise, flat tyre and reverse sounds (0x4F8360-0x4F87D0)
 private playSkidSound(sfx:number,speed=1,volume=-100){
  volume+=this.eventVolume;
  if(this.surfaceSoundType===sfx){if(sfx!==-1)this.skid.updateTwinLoopSound(this.vehicle.position,volume,speed);return;}
  if(this.skid.active)this.skid.stopSoundAndForget();
  this.surfaceSoundType=sfx;
  if(sfx!==-1){this.skid.initialise(SLOT.vehicleGen,sfx,sfx+1,200,1000);this.skid.playTwinLoopSound(this.vehicle.position,volume,speed,2.5);}
 }
 private playGeneric(kind:'road'|'flat'|'reverse',sfx:number,speed=1,volume=-100){
  volume+=this.eventVolume;
  const key=kind==='road'?'roadNoise':kind==='flat'?'flatTire':'reverseGear',rollOff=kind==='road'?CFG.roadNoiseRollOff:kind==='flat'?CFG.flatTireRollOff:CFG.reverseGearRollOff;
  const typeKey=`${key}SoundType` as 'roadNoiseSoundType',soundKey=`${key}Sound` as 'roadNoiseSound';
  if(this[typeKey]!==sfx){
   const s=this[soundKey];this[soundKey]=undefined;if(s){s.setFlags(SOUND.requestUpdates,false);s.stopSound();}
   this[typeKey]=sfx;if(sfx!==-1)this[soundKey]=this.play(SLOT.vehicleGen,sfx,volume,{rollOff,speed,flags:SOUND.requestUpdates});
  }else{const s=this[soundKey];if(s&&sfx!==-1){s.speed=speed;s.volume=volume;}}
 }
 private stopNonEngineSounds(){
  if(this.vehicle)this.playSkidSound(-1);else if(this.skid.active)this.skid.stopSoundAndForget();this.surfaceSoundType=-1;
  for(const key of ['roadNoise','flatTire','reverseGear'] as const){const s=this[`${key}Sound`];this[`${key}Sound`]=undefined;if(s){s.setFlags(SOUND.requestUpdates,false);s.stopSound();}this[`${key}SoundType`]=-1;}
  for(const key of ['hornSound','sirenSound','fastSirenSound'] as const){this[key]?.stopSoundAndForget();this[key]=undefined;}
 }
 private contactWheels(){return this.vehicle.wheels?.contactWheels??4;}
 /** ProcessVehicleSkidding (0x4F8F10) for automobiles. */
 private processVehicleSkidding(speed:number){
  const w=this.vehicle.wheels,t=this.vehicle.transmission,bike=this.type===AE_VEHICLE.bike||this.type===AE_VEHICLE.bmx;let sum=0;
  // A CBike has two wheel states, front (0) and rear (1); the front test is CAR_WHEEL_FRONT_LEFT or _FRONT_RIGHT either way.
  const numWheels=bike?2:4;
  if(w&&t&&this.contactWheels()){
   const rearNotSkidding=bike?w.states[1]!=='skidding':w.states[CAR_WHEEL.rearLeft]!=='skidding'&&w.states[CAR_WHEEL.rearRight]!=='skidding';
   for(let i=0;i<numWheels;i++){
    const state=w.states[i],front=i===CAR_WHEEL.frontLeft||i===CAR_WHEEL.frontRight;
    if(state==='normal'||w.counts[i]<=0||rearNotSkidding&&front&&state==='skidding')continue;
    const drive=t.driveType==='4'||t.driveType==='F'&&front||t.driveType==='R'&&!front;
    sum+=drive?this.driveWheelSkidValue(state,speed):this.nonDriveWheelSkidValue(state,speed);
   }
  }
  if(sum<=0){this.playSkidSound(-1,1,-100);return;}
  const playSkid=(sfx:number,frq:number,volume:number)=>{const perWheel=sum/numWheels;if(perWheel>.00001){volume+=audioLog10(perWheel)*20+CFG.skid.volBase;if(volume>=-100){this.playSkidSound(sfx,frq,volume);return;}}this.playSkidSound(-1,1,-100);};
  const vol=this.type===AE_VEHICLE.plane||this.type===AE_VEHICLE.heli?CFG.skid.volOffsetForPlaneOrHeli:0,surface=this.vehicle.contactSurface;
  if(surface?.grass){const c=CFG.skid.grass;playSkid(6,c.frq+c.wheel*sum,c.vol+vol);}
  else if(surface?.wet){const c=CFG.skid.wet;playSkid(8,c.frq+c.wheel*sum,c.vol+vol);}
  // The reference scales the volume, not the frequency, by FrqFactorForBikes.
  else{const c=CFG.skid.std;playSkid(0x18,c.frq+c.wheel*sum,(vol+c.vol)*(this.type===AE_VEHICLE.bike?c.frqBikeFactor:1));}
 }
 private driveWheelSkidValue(state:NativeWheelState,speed:number){
  const c=CFG.skid.drive;
  if(state==='spinning')return this.gasPedalAudioRevs>.4?invLerp(.4,1,this.gasPedalAudioRevs)*.75*c.spinning:0;
  if(state==='skidding')return Math.min(1,Math.abs(speed))*.75*c.skidding;
  if(state==='fixed'){const s=Math.abs(speed);return s>=.04?Math.min(s*5,1)*c.stationary:0;}
  return 0;
 }
 private nonDriveWheelSkidValue(state:NativeWheelState,speed:number){
  const c=CFG.skid.nonDrive;
  if(state==='skidding')return Math.min(1,Math.abs(speed))*.75*c.skidding;
  if(state==='fixed'){let s=Math.abs(speed);if(s>=.04)s=Math.min(s*5,1);return s*c.stationary;}
  return 0;
 }
 /** ProcessVehicleFlatTyre (0x4F8940). */
 private processVehicleFlatTyre(speed:number){
  const w=this.vehicle.wheels,t=this.vehicle.transmission;
  // The reference compares the damage manager's wheel status (1, WHEEL_STATUS_BURST) with WHEEL_STATE_SPINNING's
  // value: any burst tyre touching the ground sounds, whatever the wheel is doing.
  const spinning=!!w&&[0,1,2,3].some(i=>w.counts[i]>0&&w.burst[i]);
  if(spinning&&t){const vf=Math.min(1,Math.abs(speed)/(t.maxVelocity*.3));this.playGeneric('flat',4,1+CFG.flatTyre.frqGearVelocityFactor*vf,vf>0?CFG.flatTyre.volOffset+audioLog10(vf)*20:-100);}
  else this.playGeneric('flat',-1);
 }
 /** ProcessVehicleRoadNoise (0x4F8B00). */
 private processVehicleRoadNoise(speed:number,cameraDistance:number){
  const m=this.modelId,cfg=CFG.roadNoise;
  const cancel=m===MODEL.artict1||m===MODEL.artict2||m===MODEL.petrotr||m===MODEL.artict3?!this.contactWheels():!this.vehicle.transmission;
  const absSpeed=Math.abs(speed);if(cancel||absSpeed<=0){this.playGeneric('road',-1);return;}
  const play=(sfx:number,frq:number,volume:number)=>{
   frq*=.75+Math.max(1,cameraDistance/cfg.fadeOutDistance)/2;
   const v=Math.min(1,2*absSpeed);volume=v>.0008?volume+cfg.volBase+audioLog10(v)*20:-100;
   this.playGeneric('road',sfx,frq,volume);
  };
  const s=this.vehicle.contactSurface;
  if(s?.grass)play(21,cfg.grass.frq,cfg.grass.vol);else if(s?.wet)play(22,cfg.wet.frq,cfg.wet.vol);else play(21,cfg.std.frq,cfg.std.vol);
 }
 /** ProcessReverseGear (0x4F8DF0), player-driven automobiles only. */
 private processReverseGear(speed:number){
  const v=this.vehicle,w=v.wheels,t=v.transmission,cfg=CFG.reverseGear;
  if(v.engineOn&&t&&(v.gasPedal<0||v.gear===0)){
   if(w&&!w.driveOnGround&&w.driveOnGroundLastFrame)this.gasPedalAudioRevs*=.4;
   const revs=w?.driveOnGround?speed/t.maxReverseVelocity:this.gasPedalAudioRevs;
   this.playGeneric('reverse',v.gasPedal>=0?20:19,cfg.frqBase+Math.abs(revs)*cfg.frqRevs,Math.abs(revs)>0?cfg.volBase+audioLog10(Math.abs(revs))*20:-100);
  }else this.playGeneric('reverse',-1,1,-100);
 }
 /** ProcessRainOnVehicle (0x4F92C0). */
 private processRainOnVehicle(){
  if(!this.loaded(BANK.rain,SLOT.weather)||this.ctx.rainVolume()<=-100)return;
  if(++this.rainDropCounter<3)return;this.rainDropCounter=0;
  this.manager.playSound({slot:SLOT.weather,sound:randomInt(this.ctx.random,12,15),entity:this,position:this.vehicle.position,volume:CFG.rainOnVehicle.volBase+this.ctx.rainVolume(),speedVariance:.1,event:AE.rainCollision});
 }
 /** tVehicleParams::ThisAccel: 0 unless ProcessPlayerVehicleEngine sampled the pad this frame. */
 private thisAccel=0;
 private nitroOnLastFrame=false;private currentNitroRatio=0;
 /** ProcessNitro (0x4FB070): the ignition shot as the burn starts, then two loops pitched and raised by the pad's
  * accelerate. The eased ratio is kept but, as in the reference, nothing reads it. */
 private processNitro(){
  const v=this.vehicle,cfg=CFG.nitro;
  if(v.nitro&&v.engineOn&&!v.drowning){
   if(!this.nitroOnLastFrame)this.addAudioEvent(AE.nitroIgnition);
   const nitro=this.thisAccel;
   this.currentNitroRatio=this.currentNitroRatio>=0?stepTo(this.currentNitroRatio,nitro,cfg.stepUp,cfg.stepDown):nitro;
   const [a,b]=cfg.sounds;
   this.updateGenericVehicleSound(ENGINE.nitro1,SLOT.weaponGen,BANK.weapons,10,lerp(a.frqMin,a.frqMax,nitro),lerp(a.volMin,a.volMax,nitro),3);
   this.updateGenericVehicleSound(ENGINE.nitro2,SLOT.vehicleGen,BANK.vehicleGen,26,lerp(b.frqMin,b.frqMax,nitro),lerp(b.volMin,b.volMax,nitro),3);
   this.nitroOnLastFrame=true;
  }else if(this.nitroOnLastFrame){this.gracefullyStop(ENGINE.nitro1);this.gracefullyStop(ENGINE.nitro2);this.nitroOnLastFrame=false;this.currentNitroRatio=-1;}
 }
 /** ProcessEngineDamage (0x4FAE20). */
 private processEngineDamage(speed:number){
  const v=this.vehicle,t=v.transmission,cfg=CFG.engineDamage;
  const fucked=!this.wrecked&&(v.health<390||v.drowning)&&this.type===AE_VEHICLE.car&&v.engineOn,steam=!this.wrecked&&v.health<650&&!v.drowning;
  const vf=t?clamp(Math.abs(speed/t.maxVelocity),0,1):0;
  if(steam)this.updateGenericVehicleSound(ENGINE.steam,SLOT.weaponGen,BANK.weapons,28,lerp(cfg.steam.frqMin,cfg.steam.frqMax,vf),lerp(cfg.steam.volMin,cfg.steam.volMax,vf),cfg.steam.rollOff);
  else this.gracefullyStop(ENGINE.steam);
  if(fucked)this.updateGenericVehicleSound(ENGINE.fucked,SLOT.vehicleGen,BANK.vehicleGen,28,lerp(cfg.fucked.frqMin,cfg.fucked.frqMax,vf),lerp(cfg.fucked.volMin,cfg.fucked.volMax,vf),cfg.fucked.rollOff);
  else this.gracefullyStop(ENGINE.fucked);
 }
 // Player car engine (0x4F5D00-0x4FBB10)
 private volForPlayerEngineSound(p:PlayerParams,st:number):number{
  const cfg=CFG.player;let volume=0;
  if(st===ENGINE.carRev)volume=lerp(cfg.rev.volMin,cfg.rev.volMax,p.realRevsRatio);
  else if(st===ENGINE.carId)volume=this.modelId===MODEL.caddy?cfg.id.volMin-30:lerp(cfg.id.volMin,cfg.id.volMax,p.realRevsRatio);
  else if(st===ENGINE.playerCrz)volume=this.singleGear?cfg.singleGearVolume:lerp(cfg.crz.volMin,cfg.crz.volMax,this.crzCount/cfg.crzMaxCnt);
  else if(st===ENGINE.playerAc)volume=this.singleGear?cfg.singleGearVolume:lerp(cfg.ac.volMin,cfg.ac.volMax,this.auGear/cfg.maxAuGear);
  else if(st===ENGINE.playerOff)return this.volForPlayerEngineSound(p,ENGINE.carId);
  return this.engineOffsets(volume);
 }
 private freqForPlayerEngineSound(p:PlayerParams,st:number){
  const cfg=CFG.player,t=this.vehicle.transmission!;let f:number;
  if(st===ENGINE.carId&&this.modelId===MODEL.caddy)f=0;
  else{
   let zf=p.zOverSpeed<=0?Math.max(cfg.frqZMin,p.zOverSpeed)/cfg.frqZMin:-(Math.min(cfg.frqZMax,p.zOverSpeed)/cfg.frqZMax);zf*=cfg.frqZFactor;if(p.speed<-.001)zf=-zf;
   const gf=Math.min(1,p.absSpeed/t.gears[1].changeUpVelocity);
   if(st===ENGINE.carRev)f=p.wheelSpin<=5?cfg.rev.frqOffset+p.wheelSpin/5*cfg.rev.frqWheelSpinFactor:cfg.rev.frqOffset+lerp(cfg.rev.frqMin,cfg.rev.frqMax,invLerp(5,10,p.wheelSpin));
   else if(st===ENGINE.carId)f=lerp(cfg.id.frqMin,cfg.id.frqMax,piecewiseLinear([[0,0],[.075,.7],[.15,1.1],[.25,1.25],[1,1.7]],p.speedRatio));
   else if(st===ENGINE.playerCrz)f=p.wheelSpin/5*cfg.frqWheelSpinFactor+(cfg.crz.frqMax-cfg.crz.frqMin)*this.crzCount/cfg.crzMaxCnt+(this.singleGear?cfg.crz.frqSingleGear:cfg.crz.frqMin);
   else if(st===ENGINE.playerAc)f=p.wheelSpin/5*cfg.frqWheelSpinFactor+(this.singleGear?cfg.ac.frqSingleGear:cfg.ac.frqPerGear[this.auGear]+cfg.ac.frqMultiGearOffset);
   else f=lerp(cfg.off.frqMin,cfg.off.frqMax,p.speedRatio);
   // A motorbike's lean and the player's boost raise it, in proportion to the gear factor.
   const b=this.type===AE_VEHICLE.bike?this.vehicle.bike:undefined,bf=b?(Math.sin(b.leanAngle)*cfg.frqBikeLeanFactor+(b.playerBoost?cfg.frqPlayerBikeBoostOffset:0))*gf:0;
   f*=(gf*zf+1)*(bf+1);
  }
  return this.vehicle.underwater?f*CFG.freqUnderwaterFactor:f;
 }
 private processPlayerVehicleEngine(speed:number){
  const v=this.vehicle,t=v.transmission,w=v.wheels,cfg=CFG.player;
  if(!t||!w||!this.loaded(this.dummyEngineBank,this.dummySlot))return;
  const [accel,brake]=this.accelAndBrake(),absSpeed=Math.abs(speed);this.thisAccel=accel;
  const p:PlayerParams={speed,absSpeed,accel,brake,speedRatio:clamp(absSpeed/t.maxVelocity,0,1),realGear:v.gear,handbrake:v.handbrake,realRevsRatio:0,wheelSpin:w.spinForAudio,numGears:t.numberOfGears,
   zOverSpeed:speed!==0?v.moveSpeed.z/speed:0,driveOnGround:w.driveOnGround,prevSpeed:this.prevSpeed};
  const gear=t.gears[p.realGear];p.realRevsRatio=p.realGear&&gear?invLerp(gear.changeDownVelocity,gear.maxVelocity,absSpeed):0;
  if(this.singleGear){p.realGear=p.realGear?1:0;p.numGears=1;}
  const request=(st:number)=>this.requestNewPlayerCarEngineSound(st,this.freqForPlayerEngineSound(p,st),this.volForPlayerEngineSound(p,st));
  const update=(st:number)=>this.updateVehicleEngineSound(st,this.freqForPlayerEngineSound(p,st),this.volForPlayerEngineSound(p,st));
  const updateOrRequest=(st:number)=>{if(this.engineSounds[st])update(st);else request(st);};
  const accInhibitedBackwards=()=>p.wheelSpin>5||!p.driveOnGround;
  const accInhibited=()=>!this.loaded(this.playerEngineBank,SLOT.playerEngine)||p.brake>0||p.handbrake||accInhibitedBackwards();
  const accInhibitedForLowSpeed=()=>!this.singleGear&&p.speed<cfg.ac.inhibitForLowSpeedLimit;
  // IsAccInhibitedForTime/IsCrzInhibitedForTime return true once the inhibit time has passed, as decompiled.
  const accInhibitedForTime=()=>this.timeBeforeAllowAccelerate<this.time,crzInhibitedForTime=()=>this.timeBeforeAllowCruise<this.time;
  const threshold=cfg.ac.wheelSpinThreshold,reversing=p.speed<-.001;
  const fullAcceleration=()=>{this.auGear=this.singleGear?1:clamp(Math.min(p.realGear,this.auGear),1,p.numGears-1);request(ENGINE.playerAc);this.state=AE_STATE.playerAcFull;};
  const toIdle=(cancel:number)=>{this.cancelVehicleEngineSound(cancel);request(ENGINE.playerOff);request(ENGINE.carId);this.state=AE_STATE.playerId;};
  switch(this.state){
   case AE_STATE.carOff:{
    if(!v.engineOn){this.cancelAllVehicleEngineSounds(ENGINE.steam);this.state=AE_STATE.carOff;break;}
    this.addAudioEvent(AE.startEngine);
    if(!reversing){
     if(p.accel<=0){this.requestNewPlayerCarEngineSound(ENGINE.carId,1,-100);this.state=AE_STATE.playerId;break;}
     if(!accInhibited()&&!accInhibitedForLowSpeed()){
      if(p.accel<=threshold){this.requestNewPlayerCarEngineSound(ENGINE.carId);this.state=AE_STATE.playerId;}
      else if(p.realGear<p.numGears&&cfg.crzSpeedOffset+p.prevSpeed>p.speed&&p.zOverSpeed>cfg.zMoveSpeedThreshold){this.audioChangingGear=true;request(ENGINE.playerCrz);this.state=AE_STATE.playerCrz;}
      else{this.cancelVehicleEngineSound(ENGINE.playerOff);request(ENGINE.playerAc);this.state=AE_STATE.playerAcFull;}
      break;
     }
    }
    if(p.accel<=threshold){request(ENGINE.carId);this.state=AE_STATE.playerId;}
    else{this.cancelVehicleEngineSound(ENGINE.playerOff);request(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;}
    break;
   }
   case AE_STATE.playerAcFull:{
    if(!v.engineOn){this.cancelAllVehicleEngineSounds();this.state=AE_STATE.carOff;break;}
    if(reversing){this.cancelVehicleEngineSound(ENGINE.playerAc);if(p.accel>threshold){request(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;}else{request(ENGINE.playerOff);request(ENGINE.carId);this.state=AE_STATE.playerId;}break;}
    if(p.accel<=0){toIdle(ENGINE.playerAc);break;}
    if(accInhibited()){this.cancelVehicleEngineSound(ENGINE.playerAc);if(p.accel<=threshold){request(ENGINE.playerOff);request(ENGINE.carId);this.state=AE_STATE.playerId;}else{request(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;}break;}
    if(accInhibitedForLowSpeed()||p.accel<=threshold){toIdle(ENGINE.playerAc);break;}
    // CCullZones::DoExtraAirResistanceForPlayer lets the engine drop to cruise and keeps it from changing up.
    if(p.realGear<p.numGears&&cfg.crzSpeedOffset+p.prevSpeed>p.speed&&(p.zOverSpeed>cfg.zMoveSpeedThreshold||cullAirResistance.multiplier!==1)&&!crzInhibitedForTime()){
     this.audioChangingGear=true;this.cancelVehicleEngineSound(ENGINE.playerAc);request(ENGINE.playerCrz);this.timeBeforeAllowCruise=this.time+2000;this.state=AE_STATE.playerCrz;break;
    }
    if(this.justFinishedAccelerationLoop()){
     const previousGear=this.auGear;this.auGear=Math.min(cfg.maxAuGear,this.auGear+1);
     if(previousGear+2<=p.numGears||p.realGear<p.numGears&&cullAirResistance.multiplier===1){this.audioChangingGear=true;update(ENGINE.playerAc);this.state=AE_STATE.playerAcFull;}
     else{if(!this.singleGear)this.audioChangingGear=true;this.cancelVehicleEngineSound(ENGINE.playerAc);request(ENGINE.playerCrz);this.state=AE_STATE.playerCrz;}
    }else updateOrRequest(ENGINE.playerAc);
    break;
   }
   case AE_STATE.playerWheelSpin:{
    if(!v.engineOn){this.cancelAllVehicleEngineSounds();this.state=AE_STATE.carOff;break;}
    if(reversing){if(p.accel>threshold){update(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;}else toIdle(ENGINE.carRev);break;}
    if(p.accel<=0){toIdle(ENGINE.carRev);break;}
    if(accInhibited()||accInhibitedForLowSpeed()){if(p.accel>threshold){update(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;break;}}
    else if(!accInhibitedForLowSpeed()&&p.accel>threshold){
     this.cancelVehicleEngineSound(ENGINE.carRev);
     if(p.realGear<p.numGears&&cfg.crzSpeedOffset+p.prevSpeed>p.speed&&p.zOverSpeed>cfg.zMoveSpeedThreshold){this.audioChangingGear=true;request(ENGINE.playerCrz);this.state=AE_STATE.playerCrz;}
     else fullAcceleration();
     break;
    }
    toIdle(ENGINE.carRev);break;
   }
   case AE_STATE.playerCrz:{
    if(!v.engineOn){this.cancelAllVehicleEngineSounds();this.state=AE_STATE.carOff;break;}
    const endCrz=()=>{this.crzCount=0;this.cancelVehicleEngineSound(ENGINE.playerCrz);};
    const crzToIdle=()=>{endCrz();request(ENGINE.playerOff);request(ENGINE.carId);this.state=AE_STATE.playerId;};
    const endWhenInhibited=()=>{if(p.accel<=threshold)crzToIdle();else{endCrz();request(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;}};
    if(reversing){endWhenInhibited();break;}
    if(p.accel<=0){crzToIdle();break;}
    if(accInhibited()||accInhibitedForLowSpeed()){endWhenInhibited();break;}
    if(!accInhibitedForLowSpeed()&&p.accel>threshold){
     if(p.realGear<p.numGears&&cfg.ac.speedOffset+p.prevSpeed<p.speed&&!accInhibitedForTime()&&cullAirResistance.multiplier===1){endCrz();this.timeBeforeAllowAccelerate=this.time+2000;fullAcceleration();}
     else{this.crzCount=p.speed<=p.prevSpeed-.05?Math.max(0,this.crzCount-.25):Math.min(this.crzCount+1,cfg.crzMaxCnt);update(ENGINE.playerCrz);this.state=AE_STATE.playerCrz;}
    }else crzToIdle();
    break;
   }
   case AE_STATE.playerId:{
    if(!v.engineOn){this.cancelAllVehicleEngineSounds();this.state=AE_STATE.carOff;break;}
    if(reversing){if(p.accel<=threshold){update(ENGINE.carId);this.state=AE_STATE.playerId;}else{this.cancelVehicleEngineSound(ENGINE.carId);this.cancelVehicleEngineSound(ENGINE.playerOff);request(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;}break;}
    if(p.accel<=0){update(ENGINE.carId);this.state=AE_STATE.playerId;break;}
    if(accInhibited()||accInhibitedForLowSpeed()){
     if(p.accel>threshold){this.cancelVehicleEngineSound(ENGINE.carId);this.cancelVehicleEngineSound(ENGINE.playerOff);request(ENGINE.carRev);this.state=AE_STATE.playerWheelSpin;break;}
    }else if(!accInhibitedForLowSpeed()&&p.accel>threshold){
     this.cancelVehicleEngineSound(ENGINE.carId);this.cancelVehicleEngineSound(ENGINE.playerOff);
     if(p.realGear<p.numGears&&p.prevSpeed+cfg.crzSpeedOffset>p.speed&&p.zOverSpeed>cfg.zMoveSpeedThreshold){this.audioChangingGear=true;request(ENGINE.carRev);this.state=AE_STATE.playerCrz;}
     else fullAcceleration();
     break;
    }
    update(ENGINE.carId);this.state=AE_STATE.playerId;break;
   }
   default:this.cancelAllVehicleEngineSounds();this.state=AE_STATE.carOff;
  }
 }
 /** GetAccelAndBrake (0x4F5080): the pad while the player drives, else nothing. Stored as 255ths. */
 private accelAndBrake():[number,number]{
  const v=this.vehicle;
  if(this.isPlayerDriver&&!this.playerDriverAboutToExit&&v.playerAlive)return [Math.trunc(clamp(v.padAccelerate,0,1)*255)/255,Math.trunc(clamp(v.padBrake,0,1)*255)/255];
  return [0,0];
 }
 /** ProcessDummyVehicleEngine (0x501480). */
 private processDummyVehicleEngine(speed:number){
  if(!this.ensureHasDummySlot()||!this.ensureSoundBankIsLoaded(true))return;
  const v=this.vehicle;
  if(!v.engineOn){this.transitionOrOff(AE_STATE.carOff,0);return;}
  const ratio=v.status!=='abandoned'&&v.transmission?clamp(Math.abs(speed/v.transmission.maxVelocity),0,1):0;
  let idling:boolean;
  if(this.state===AE_STATE.carOff||this.state===AE_STATE.dummyId||this.state===AE_STATE.numStates)idling=ratio<CFG.dummyEngine.id.ratio;
  else if(this.state===AE_STATE.dummyCrz)idling=ratio<CFG.dummyEngine.rev.ratio;
  else{this.transitionOrOff(AE_STATE.carOff,ratio);return;}
  this.processDummyStateTransition(idling?AE_STATE.dummyId:AE_STATE.dummyCrz,ratio);
 }
 /** Player engine states reaching the dummy path only record CAR_OFF. */
 private transitionOrOff(state:number,ratio:number){if(this.state>=AE_STATE.playerAcFull&&this.state<AE_STATE.numStates){this.state=state;return;}this.processDummyStateTransition(state,ratio);}
 private ensureHasDummySlot(){if(this.dummySlot===-1)this.dummySlot=this.requestBankSlot(this.dummyEngineBank);return this.dummySlot!==-1;}
 private ensureSoundBankIsLoaded(dummy:boolean,turnOff=true){
  const bank=dummy?this.dummyEngineBank:this.playerEngineBank,slot=dummy?this.dummySlot:SLOT.playerEngine;
  if(this.loaded(bank,slot))return true;
  if(!this.doesBankSlotContainThisBank(slot,bank)){this.dummySlot=this.requestBankSlot(bank);if(turnOff)this.state=AE_STATE.carOff;}
  return false;
 }
 private updateGasPedalAudio(){const current=Math.abs(this.vehicle.gasPedal),g=CFG.gasPedal;this.gasPedalAudioRevs=this.gasPedalAudioRevs<current?Math.min(current,this.gasPedalAudioRevs+g.stepUp):Math.max(current,this.gasPedalAudioRevs-g.stepDown);}
 /** ProcessVehicle (0x501E10). */
 private processVehicle(){
  const v=this.vehicle,simple=v.status==='simple';
  const speed=simple?(v.autopilotSpeed??0)/50:dot(v.moveSpeed,v.forward);
  this.thisAccel=0;
  switch(this.type){
   case AE_VEHICLE.car:{
    this.updateGasPedalAudio();if(this.wrecked)break;
    const c=this.manager.env.camera.position,cameraDistance=Math.hypot(c.x-v.position.x,c.y-v.position.y,c.z-v.position.z);
    this.processVehicleRoadNoise(speed,cameraDistance);
    if(this.isPlayerDriver)this.processReverseGear(speed);
    if(!simple){this.processVehicleSkidding(speed);this.processVehicleFlatTyre(speed);}
    this.processVehicleSirenAlarmHorn();
    if(this.isPlayerDriver)this.processPlayerVehicleEngine(speed);else this.processDummyVehicleEngine(speed);
    if(!simple)this.processEngineDamage(speed);
    this.processRainOnVehicle();
    this.processNitro();
    this.prevSpeed=speed;break;
   }
   case AE_VEHICLE.bike:{
    if(this.wrecked)break;
    this.updateGasPedalAudio();
    const c=this.manager.env.camera.position,cameraDistance=Math.hypot(c.x-v.position.x,c.y-v.position.y,c.z-v.position.z);
    this.processVehicleRoadNoise(speed,cameraDistance);
    if(!simple)this.processVehicleSkidding(speed);
    this.processVehicleSirenAlarmHorn();
    if(this.isPlayerDriver)this.processPlayerVehicleEngine(speed);else this.processDummyVehicleEngine(speed);
    if(!simple){this.processEngineDamage(speed);this.processVehicleFlatTyre(speed);}
    this.processRainOnVehicle();
    this.prevSpeed=speed;break;
   }
   case AE_VEHICLE.heli:this.updateGasPedalAudio();this.processAircraft();this.processRainOnVehicle();break;
   case AE_VEHICLE.plane:this.updateGasPedalAudio();this.processAircraft();this.processRainOnVehicle();break;
   case AE_VEHICLE.boat:this.processBoatEngine();this.processRainOnVehicle();this.processBoatMovingOverWater(speed);break;
   // ProcessPlayerTrainBrakes follows for a player-driven train; no one drives the port's trains.
   case AE_VEHICLE.train:this.processTrainTrackSound();this.processDummyTrainEngine();break;
   case AE_VEHICLE.seaplane:this.processAircraft();this.processRainOnVehicle();this.processBoatMovingOverWater(speed);break;
   case AE_VEHICLE.special:this.processSpecialVehicle(speed);break;
  }
 }
 private get trainConfig(){return this.dummyEngineBank===BANK.tramD?CFG.train.tram:CFG.train.generic;}
 /** ProcessDummyTrainEngine (0x500710): the front carriage's engine loop, pitched by its speed and the slope; a tram's
  * swells with its speed. */
 private processDummyTrainEngine(){
  const v=this.vehicle,t=v.train,tram=this.dummyEngineBank===BANK.tramD,cfg=this.trainConfig.engine;
  if(!t||!this.ensureHasDummySlot()||!this.ensureSoundBankIsLoaded(true,false))return;
  if(!t.front){this.gracefullyStop(TRAIN.engine);return;}
  const frq=clamp(v.forward.z,-.3,.3)*cfg.frqSlopeFactor;
  let speed=t.notOnARailRoad?0:t.speed;if(t.clockwise)speed=-speed;
  const sf=t.notOnARailRoad?0:clamp(Math.abs(speed),0,1);
  let volume=0;if(tram)volume+=audioLog10(sf)*20;
  this.updateTrainSound(TRAIN.engine,this.dummySlot,0,lerp(cfg.frqMin,cfg.frqMax,sf)*(1+frq),volume);
 }
 /** ProcessTrainTrackSound (0x4FA3F0): every carriage's wheels on the rails, sound 2 of the dummy bank. */
 private processTrainTrackSound(){
  const t=this.vehicle.train;
  if(!t||!this.ensureHasDummySlot()||!this.ensureSoundBankIsLoaded(true,false))return;
  const sf=Math.abs(t.speed);
  if(t.notOnARailRoad||sf<.00001){this.updateTrainSound(TRAIN.track,this.dummySlot,2,0,-100);return;}
  const cfg=this.trainConfig.track;
  this.updateTrainSound(TRAIN.track,this.dummySlot,2,lerp(cfg.frqMin,cfg.frqMax,sf)*TRAIN_CARRIAGES_NOISE[t.carriage%TRAIN_CARRIAGES_NOISE.length],cfg.volBase+audioLog10(sf)*20);
 }
 /** UpdateTrainSound (0x4FA1C0). As the reference has it, the event volume is added here and again by
  * UpdateVehicleEngineSound once the sound plays. */
 private updateTrainSound(st:number,slot:number,sfx:number,speed:number,volume:number){
  volume+=this.eventVolume;
  if(this.dummySlot===-1||this.updateVehicleEngineSound(st,speed,volume))return;
  if(!this.loaded(this.dummyEngineBank,this.dummySlot))return;
  const cfg=this.trainConfig;
  this.engineSounds[st]=this.play(slot,sfx,volume,{rollOff:st===TRAIN.engine?cfg.engineRollOff:cfg.trackRollOff,speed,flags:SOUND.requestUpdates});
 }
 /** ProcessBoatEngine (0x5003A0): one loop of the dummy bank pitched and swelled by the propeller's speed, and the
  * distant engine, which takes over under water. */
 private processBoatEngine(){
  const v=this.vehicle,b=v.boat,cfg=CFG.boat;
  if(!this.ensureHasDummySlot()||!this.ensureSoundBankIsLoaded(true))return;
  if(!v.engineOn||this.wrecked){this.gracefullyStop(BOAT.engine);this.gracefullyStop(BOAT.distant);return;}
  if(this.isPlayerDriver)this.thisAccel=this.accelAndBrake()[0];
  const es=clamp((b?.engineSpeed??0)*3,0,1),roll=Math.min(1,1-v.up.z);
  const speed=cfg.frqEngineBase+roll*cfg.frqEngineRollFactor+es*(b?.inWater?cfg.frqEngineOnWaterFactor:cfg.frqEngineInAirFactor);
  this.currentDummyEngineFrequency=this.currentDummyEngineFrequency>=0?stepTo(this.currentDummyEngineFrequency,speed,.02):speed;
  // As the reference has it: the volume steps only from 0 dB or above, else it is set outright.
  const volume=cfg.volBase+es*cfg.volEngineSpeedFactor;
  this.currentDummyEngineVolume=this.currentDummyEngineVolume>=0?stepTo(this.currentDummyEngineVolume,volume,3):volume;
  if(this.ctx.underwaterness()<.5){
   this.updateBoatSound(BOAT.engine,this.dummySlot,0,this.currentDummyEngineFrequency,this.currentDummyEngineVolume);
   this.updateBoatSound(BOAT.distant,SLOT.vehicleGen,28,1,-100);
  }else{
   this.updateBoatSound(BOAT.engine,this.dummySlot,0,1,-100);
   this.updateBoatSound(BOAT.distant,SLOT.vehicleGen,28,this.currentDummyEngineFrequency,this.currentDummyEngineVolume+6);
  }
 }
 /** ProcessBoatMovingOverWater (0x4FA0C0): the hull skimming the water, from COLLISIONS sound 3. */
 private processBoatMovingOverWater(speed:number){
  const cfg=CFG.boat.overWater,sf=Math.min(.75,Math.abs(speed))/.75;
  let volume=this.vehicle.boat?.inWater&&sf>=.00001?(this.type===AE_VEHICLE.seaplane?cfg.volBaseOfSeaplane:cfg.volBase)+audioLog10(sf)*20:-100,frequency=cfg.frqBase+cfg.frqSpeedFactor*sf;
  if(this.ctx.underwaterness()>=.5){volume+=cfg.volUnderwaterOffset;frequency*=cfg.frqUnderwaterFactor;}
  this.updateBoatSound(BOAT.waterSkim,SLOT.collisions,3,frequency,volume);
 }
 /** UpdateBoatSound (0x4F9E90). */
 private updateBoatSound(st:number,slot:number,sfx:number,speed:number,volume:number){
  const cfg=CFG.boat;volume+=this.eventVolume;
  if(this.type!==AE_VEHICLE.seaplane&&st!==BOAT.waterSkim&&this.dummySlot===-1)return;
  if(this.updateVehicleEngineSoundRawVolume(st,speed,volume))return;
  const loaded=st===BOAT.engine?this.loaded(this.dummyEngineBank,this.dummySlot):st===BOAT.distant?this.loaded(BANK.vehicleGen,SLOT.vehicleGen):this.loaded(BANK.collisions,SLOT.collisions);
  if(!loaded)return;
  const rollOff=st===BOAT.engine?cfg.engineRollOff:st===BOAT.distant?cfg.distantRollOff:cfg.waterSkimRollOff;
  this.engineSounds[st]=this.play(slot,sfx,volume,{rollOff,speed,flags:SOUND.requestUpdates});
 }
 /** ProcessSpecialVehicle (0x501AB0). The RC toys are not driven here, and the Vortex's ProcessDummyHovercraft
  * (0x500F50) is not reversed, so it plays only its rain and horn. */
 private processSpecialVehicle(speed:number){
  const v=this.vehicle,m=this.modelId,c=this.manager.env.camera.position,cameraDistance=()=>Math.hypot(c.x-v.position.x,c.y-v.position.y,c.z-v.position.z);
  switch(m){
   case MODEL.artict1:case MODEL.artict2:case MODEL.petrotr:case MODEL.artict3:this.processVehicleRoadNoise(speed,cameraDistance());this.processRainOnVehicle();break;
   case MODEL.caddy:
    this.processVehicleRoadNoise(speed,cameraDistance());this.processVehicleSkidding(speed);this.processVehicleFlatTyre(speed);
    this.processVehicleSirenAlarmHorn();this.processDummyGolfCart(speed);this.processRainOnVehicle();
    if(v.status!=='simple')this.processEngineDamage(speed);
    break;
   case MODEL.vortex:this.processRainOnVehicle();this.processVehicleSirenAlarmHorn();break;
  }
 }
 /** ProcessDummyGolfCart (0x501270), which the Caddy plays whoever drives it: one loop whose pitch and volume follow
  * the speed ratio from a twentieth up. */
 private processDummyGolfCart(speed:number){
  if(!this.ensureHasDummySlot()||!this.ensureSoundBankIsLoaded(true))return;
  const v=this.vehicle;
  if(!v.engineOn||this.wrecked){this.cancelAllVehicleEngineSounds();return;}
  const t=v.transmission&&v.status!=='abandoned'?clamp(Math.abs(speed/v.transmission.maxVelocity),0,1):0,cfg=CFG.dummyEngine.golfCart;
  if(t>=.05)this.updateGenericVehicleSound(ENGINE_DUMMY_ID,this.dummySlot,this.dummyEngineBank,0,lerp(cfg.frqMin,cfg.frqMax,t),
   audioLog10(piecewiseLinear([[0,0],[.05,0],[.1,.5],[1,1]],t))*20+cfg.volOffset,2);
  else this.gracefullyStop(ENGINE_DUMMY_ID);
 }
 // Aircraft (0x4F93C0-0x501C50)
 private updateRotorFreq(freq:number,stepUp:number,stepDown:number){
  const f=this.currentRotorFrequency;this.currentRotorFrequency=f<0?freq:f<freq?Math.min(freq,f+stepUp):Math.max(freq,f-stepDown);
 }
 private distantSoundVolume(base:number){
  const c=this.manager.env.camera.position,p=this.vehicle.position,distSq=(c.x-p.x)**2+(c.y-p.y)**2+(c.z-p.z)**2;
  if(distSq<=48*48)return -100;
  let vol=base;if(distSq<=128)vol+=invLerp(48,128,Math.sqrt(distSq));
  return audioLog10(vol)*20+8;
 }
 private cameraPoVFactor(){
  const c=this.manager.env.camera.position,p=this.vehicle.position,d={x:p.x-c.x,y:p.y-c.y,z:p.z-c.z},l=Math.hypot(d.x,d.y,d.z)||1;
  return (dot({x:d.x/l,y:d.y/l,z:d.z/l},this.vehicle.forward)+1)*.5;
 }
 private aircraftAcceleration(accel:number,brake:number){let s=accel>0?.1:0;if(brake>0)s-=.05;return s;}
 private processAircraft(){
  if(this.wrecked||!this.loaded(BANK.vehicleGen,SLOT.vehicleGen))return;
  const m=this.modelId;
  if(this.type===AE_VEHICLE.heli){if(this.isPlayerDriver)this.processDummyOrPlayerHeli(false);else if(this.vehicle.status==='physics')this.processAIHeli();else this.processDummyOrPlayerHeli(true);}
  else if(this.type===AE_VEHICLE.plane){
   if(m===MODEL.shamal||m===MODEL.hydra||m===MODEL.at400||m===MODEL.androm){if(this.isPlayerDriver)this.processPlayerJet();else this.processDummyJet();}
   else if(this.isPlayerDriver)this.processDummyOrPlayerProp(false);
   else if(this.vehicle.status==='physics')this.processAIProp();
   else this.processDummyOrPlayerProp(true);
  }
 }
 private playAircraftSound(st:number,slot:number,sfx:number,volume=-100,speed=1){
  if(this.updateVehicleEngineSoundRawVolume(st,speed,volume))return;
  const rollOff=st===AIRCRAFT.distant?6:st===AIRCRAFT.front||st===AIRCRAFT.rear?4:st===AIRCRAFT.near?1:st===AIRCRAFT.thrust?4.5:50;
  const doppler=st===AIRCRAFT.near?.4:1,position=st===AIRCRAFT.jetDistant?{x:0,y:1,z:0}:this.vehicle.position;
  this.engineSounds[st]=this.manager.playSound({slot,sound:sfx,entity:this,position,volume:this.eventVolume+volume,rollOff,speed,doppler,flags:SOUND.requestUpdates});
 }
 private propSpeedFactor(propSpeed:number){return piecewiseLinear([[0,0],[.15,.3],[1,1]],clamp(propSpeed,0,1));}
 private planePropFreq(accel:number){const v=this.vehicle;return Math.abs(v.right.z)*.1-v.forward.z*.15+accel+1;}
 private processAIProp(){
  if(this.dummyEngineBank===-1||!this.ensureHasDummySlot()||!this.ensureSoundBankIsLoaded(true)||!this.loaded(BANK.vehicleGen,SLOT.vehicleGen))return;
  if(!this.vehicle.engineOn){this.cancelAllVehicleEngineSounds();return;}
  const factor=this.propSpeedFactor((this.vehicle.propSpeed??0)/.34);
  this.updateRotorFreq(this.planePropFreq(0),1/187.5,1/187.5);
  this.playAircraftSound(AIRCRAFT.front,this.dummySlot,1,audioLog10(factor)*20+8,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.distant,this.dummySlot,0,this.distantSoundVolume(factor));
 }
 private processDummyOrPlayerProp(dummy:boolean){
  const v=this.vehicle;
  if(!this.loaded(BANK.vehicleGen,SLOT.vehicleGen)||!this.loaded(this.playerEngineBank,SLOT.playerEngine))return;
  if(!v.engineOn){this.cancelAllVehicleEngineSounds();return;}
  const [accel,brake]=dummy?[clamp(v.gasPedal,0,1),clamp(v.brakePedal,0,1)]:this.accelAndBrake();
  const factor=this.propSpeedFactor(clamp((v.propSpeed??0)/.34,0,1)),[stallVol,stallFreq]=this.propOrJetStall();
  this.updateRotorFreq(this.planePropFreq(this.aircraftAcceleration(accel,brake))*stallFreq,1/187.5,1/187.5);
  const pov=this.cameraPoVFactor();
  this.playAircraftSound(AIRCRAFT.front,SLOT.playerEngine,0,stallVol+audioLog10((1-CFG.rotorVolTiltFactor*pov)*factor)*20+8,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.rear,SLOT.playerEngine,1,stallVol+audioLog10((pov*.5+.5)*factor)*20+8,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.near,SLOT.vehicleGen,17,stallVol+audioLog10(factor)*20+8,1);
  this.playAircraftSound(AIRCRAFT.distant,SLOT.vehicleGen,16,this.distantSoundVolume(stallVol),1);
 }
 /** ProcessPropOrJetStall: health bands lower volume and pitch, with silent/audible stall swaps below 650. */
 private propOrJetStall():[number,number]{
  const hp=this.vehicle.health;
  let [vol,freq]=hp>=650?[0,1]:hp>=460?[-6,.95]:hp>=390?[-9,.9]:hp>=250?[-12,.85]:[-18,.8];
  if(hp>=650)return [vol,freq];
  if(this.time>=this.swapStalledTime){
   const table=this.silentStalled?{fast:.85,slow:[175,250],quick:[25,75]}:{fast:.95,slow:[400,420],quick:[75,175]};
   const range=resolveProbability(this.ctx.random,table.fast)?table.quick:table.slow;
   this.swapStalledTime=this.time+randomInt(this.ctx.random,range[0],range[1]);this.silentStalled=!this.silentStalled;
  }
  this.stalledCount=Math.max(0,this.stalledCount-1);
  if(this.silentStalled)vol=0;
  return [vol,freq];
 }
 private heliRotorFrequency(rotorSpeed:number,acceleration:number,dummy:boolean){
  const v=this.vehicle,cfg=CFG.heli;
  let f=((1-v.up.z)*.5*.2+1)*piecewiseLinear([[0,0],[.15,0],[.38,.6],[.63,1],[1,1]],rotorSpeed);
  if(!dummy)f*=acceleration+1;
  if(v.health<390)f*=this.ctx.random()*(cfg.rotorFreqVariance.max-cfg.rotorFreqVariance.min)+cfg.rotorFreqVariance.min+cfg.rotorFreqVariance.offset;
  const step=rotorSpeed<=.63?cfg.loSpeed:cfg.hiSpeed;this.updateRotorFreq(f,step.up,step.down);
 }
 private heliVolumeFactor(rotorSpeed:number){return piecewiseLinear([[0,0],[.15,0],[.38,.4],[.63,.7],[1,1]],rotorSpeed);}
 private processAIHeli(){
  if(!this.loaded(BANK.apacheD,SLOT.copHeli)||!this.loaded(BANK.vehicleGen,SLOT.vehicleGen))return;
  const rotorSpeed=clamp((this.vehicle.rotorSpeed??0)/.22,0,1);this.heliRotorFrequency(rotorSpeed,1,true);
  const pov=this.cameraPoVFactor(),factor=this.heliVolumeFactor(rotorSpeed);
  if(this.ctx.underwaterness()>=.5){this.cancelAllVehicleEngineSounds(AIRCRAFT.distant);this.playAircraftSound(AIRCRAFT.distant,SLOT.vehicleGen,3,audioLog10(factor)*20+8,1);}
  else if(this.playerEngineBank!==12){
   this.playAircraftSound(AIRCRAFT.front,SLOT.vehicleGen,5,audioLog10((1-pov)*factor)*20+8,this.currentRotorFrequency);
   this.playAircraftSound(AIRCRAFT.rear,SLOT.vehicleGen,18,audioLog10((pov*.5+.5)*factor)*20+8,this.currentRotorFrequency);
   this.playAircraftSound(AIRCRAFT.near,SLOT.vehicleGen,23,audioLog10(factor)*20+2,1);
   this.playAircraftSound(AIRCRAFT.distant,SLOT.vehicleGen,3,this.distantSoundVolume(factor),1);
  }else{
   this.playAircraftSound(AIRCRAFT.front,SLOT.copHeli,1,CFG.heli.copHeliVolOffset+audioLog10(factor)*20+8,this.currentRotorFrequency);
   this.playAircraftSound(AIRCRAFT.distant,SLOT.copHeli,0,CFG.heli.copHeliVolOffset+this.distantSoundVolume(factor),1);
  }
 }
 private processDummyOrPlayerHeli(dummy:boolean){
  if(!this.loaded(this.playerEngineBank,SLOT.playerEngine)||!this.loaded(BANK.vehicleGen,SLOT.vehicleGen))return;
  const rotorSpeed=clamp((this.vehicle.rotorSpeed??0)/.22,0,1),[accel,brake]=this.accelAndBrake();
  this.heliRotorFrequency(rotorSpeed,dummy?1:this.aircraftAcceleration(accel,brake),dummy);
  const pov=this.cameraPoVFactor(),factor=this.heliVolumeFactor(rotorSpeed);
  this.playAircraftSound(AIRCRAFT.front,SLOT.playerEngine,0,audioLog10((1-CFG.rotorVolTiltFactor*pov)*factor)*20+8,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.rear,SLOT.playerEngine,1,audioLog10((pov*.5+.5)*factor)*20+8,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.near,SLOT.playerEngine,3,audioLog10(factor)*20+2,1);
  this.playAircraftSound(AIRCRAFT.distant,SLOT.vehicleGen,3,this.distantSoundVolume(factor),1);
 }
 /** ProcessGenericJet (0x4FF900, reversed in gta-reversed PR #1225). */
 private processGenericJet(engineOn:boolean,engineSpeed:number,accel:number,brake:number,stalledVolume:number,stalledFrequency:number){
  if(!this.loaded(BANK.vehicleGen,SLOT.vehicleGen))return;
  const m=this.modelId;
  const bases=m===MODEL.shamal||m===MODEL.hydra?[8,0,8,-100]:m===MODEL.at400?[20,6,20,-8]:m===MODEL.androm?[8,0,8,-12]:undefined;
  if(!bases||!engineOn){this.cancelAllVehicleEngineSounds();return;}
  const [volFrontBase,volMaxThrust,volRearBase,distantVolume]=bases,v=this.vehicle,pov=this.cameraPoVFactor();
  let pitch=accel>0?.1:0;if(brake>0)pitch-=.05;
  const front=audioLog10((1-.67*pov)*engineSpeed)*20+volFrontBase,rear=audioLog10((pov*.5+.5)*engineSpeed)*20+volRearBase;
  this.currentDummyEngineVolume=accel<=0?this.currentDummyEngineVolume-1:volMaxThrust;
  const thrust=audioLog10(engineSpeed)*20+this.currentDummyEngineVolume,target=(Math.abs(v.right.z)*.1-v.forward.z*.15+pitch+1)*stalledFrequency;
  if(this.currentRotorFrequency<0)this.currentRotorFrequency=target;
  const step=1/187.5;
  if(target>this.currentRotorFrequency+step)this.currentRotorFrequency+=step;else if(target<this.currentRotorFrequency-step)this.currentRotorFrequency-=step;else this.currentRotorFrequency=target;
  this.playAircraftSound(AIRCRAFT.front,SLOT.vehicleGen,10,front,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.rear,SLOT.vehicleGen,11,rear,this.currentRotorFrequency);
  this.playAircraftSound(AIRCRAFT.thrust,SLOT.vehicleGen,26,thrust+stalledVolume,1);
  this.playAircraftSound(AIRCRAFT.jetDistant,SLOT.vehicleGen,14,distantVolume,1);
 }
 private processDummyJet(){
  const v=this.vehicle,prop=(v.propSpeed??0)/.34;
  this.processGenericJet(v.engineOn,(clamp(prop,.2,1)-.2)*1.25,clamp(v.gasPedal,0,1),clamp(v.brakePedal,0,1),0,1);
 }
 private processPlayerJet(){
  const v=this.vehicle,[accel,brake]=this.accelAndBrake(),speed=Math.max((clamp((v.propSpeed??0)/.34,.2,1)-.2)*1.25,.2),[stallVol,stallFreq]=this.propOrJetStall();
  this.processGenericJet(v.engineOn,speed,accel,brake,stallVol,stallFreq);
 }
 snapshot(){return {model:this.modelId,state:this.state,player:this.isPlayerDriver,dummySlot:this.dummySlot,sounds:this.engineSounds.map((s,i)=>s?i:-1).filter(i=>i>=0),horn:!!this.hornSound,siren:!!this.sirenSound||!!this.fastSirenSound,rotor:this.currentRotorFrequency,gear:this.auGear};}
}
interface PlayerParams {speed:number;absSpeed:number;accel:number;brake:number;speedRatio:number;realGear:number;handbrake:boolean;realRevsRatio:number;wheelSpin:number;numGears:number;zOverSpeed:number;driveOnGround:number;prevSpeed:number}
