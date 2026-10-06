import {chooseVehicleColors,carColorVariationCount} from '../assets/carColors';
/** CVehicleModelInfo::ChooseVehicleColour for a boat or aircraft: the model's colour rotation picks the variation. */
function rotatedColours(catalog:{colors:Parameters<typeof carColorVariationCount>[0];colourRotation:{choose(model:string,count:number,o?:object):number}},model:string){
 const count=carColorVariationCount(catalog.colors,model);
 return chooseVehicleColors(catalog.colors,model,count?catalog.colourRotation.choose(model,count):0).colors;
}
/** CWorld's MAP_Z_LOW_LIMIT: a script coordinate at or under this asks for the ground instead. */
const MAP_Z_LOW_LIMIT=-100;
import {WorldPlane,PLAYABLE_PLANES} from './WorldPlane';
import {fixedGroundDistance} from './fixedGround';
import {WorldBoat,PLAYABLE_BOATS} from './WorldBoat';
import {worldZoneAt,worldLevelAt,type WorldZones} from '../assets/worldZones';
import RAPIER from '@dimforge/rapier3d-compat';
import type {Scene} from 'three';
import type {Simulation} from './Simulation';
import {WorldCar} from './WorldCar';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {loadFixedWorldCar,isBuildableCar} from '../assets/fixedWorldCar';
import {bikeRestBottom} from '../vehicle/nativeBikeWheels';
import {loadFixedWorldBike} from '../assets/fixedWorldBike';
import {WorldBike,PLAYABLE_BIKES} from './WorldBike';
import {WEATHER_REGION,nativeWeatherRegion} from '../world/weatherRegion';
import {rollDoorLock,rollAlarm,generatorFlags,parkedCarLimit,generatorInRange,GENERATOR_RANGE,GENERATE_EVEN_IF_CLOSE_FRAMES,GENERATOR_TAKEN_WAIT_MS,GENERATOR_PROCESS_MS} from '../assets/worldCarGenerators';
import {populationCycleAt,pickPopulationCarModel,gangCarShare,dominantGang,copCarShare,populationTargets} from '../assets/populationCycle';
import {GangCarRoster} from './nativePedRoster';
import { trafficDriverBudget, clampBudget } from '../world/popcycle';
import type {WorldCarGenerator} from '../assets/worldCarGenerators';
import {WorldTrain,trainCarriageModel} from './WorldTrain';
import {TRAIN_TYPES,TRAIN_TRACK_FILES,readTrainTrack,type TrainTrack} from './nativeTrainTracks';
import {createMissionTrain,type NativeTrainCarriage} from './nativeTrain';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
import {detonateStickyBomb} from '../vehicle/nativeCarBomb';
import {VehiclesOfInterest} from '../vehicle/vehiclesOfInterest';
import {EXHAUST_NODE,isValidModForVehicle,otherLinkedUpgrade,REPLACED_COMPONENT_FRAMES,upgradePositionFrame,vehicleModSlot} from '../vehicle/nativeVehicleUpgrades';
import {isRemapMaterial,remapColours,remapName} from '../vehicle/nativeVehicleRemap';
import {TexturePool} from '../assets/TexturePool';
import {MODEL_FLAG} from './nativeDoor';
import type {ModelTexture} from '../assets/modelTextures';
/** CCarCtrl::PruneVehiclesOfInterest drops a vehicle of interest 180000 ms after it was last registered. */
const VEHICLE_OF_INTEREST_MS=180000;
/** Resolve one random-model generator against a membership pool (CCarGenerator
 * model -1): uniform pick, keeping the record identity for once-per-session
 * ownership. Empty pools leave the generator for a later window. */
export function resolveRandomParkedRecord(record:WorldCarGenerator,pool:readonly number[],random:()=>number=Math.random,info?:(modelId:number)=>PickableCar|undefined){
 if(record.modelId!==-1||!pool.length)return undefined;
 const modelId=info?pickRandomCar(pool,info,random,true,true):pool[Math.floor(random()*pool.length)%pool.length];
 return modelId===undefined?undefined:{...record,modelId};
}
/** What CLoadedCarGroup::PickRandomCar reads of a model: its vehicles.ide class and frequency, whether the script
 * suppressed it, and how many of it are in the world (m_nRefCount). */
export interface PickableCar {vehicleClass:string;frequency:number;suppressed:boolean;instances:number}
/** CLoadedCarGroup::PickRandomCar (0x611C50): up to ten draws weighted by frequency (a draw in [0, sum) walks the
 * list, taking the first model whose frequency reaches what is left); a draw of a suppressed model, or of one with
 * more than two in the world when `notTooMany`, is thrown away. With `onlyNormal` only the normal, poor family,
 * rich family and motorbike classes take part. */
export function pickRandomCar(pool:readonly number[],info:(modelId:number)=>PickableCar|undefined,random:()=>number,notTooMany:boolean,onlyNormal:boolean){
 const choices=pool.filter(id=>{const i=info(id);return !!i&&(!onlyNormal||['normal','poorfamily','richfamily','motorbike'].includes(i.vehicleClass.toLowerCase()));});
 if(!choices.length)return undefined;
 const sum=choices.reduce((total,id)=>total+info(id)!.frequency,0);
 for(let tries=0;tries<10;tries++){
  let draw=Math.floor(random()*sum),picked=choices[choices.length-1];
  for(const id of choices){const frequency=info(id)!.frequency;if(frequency>=draw){picked=id;break;}draw-=frequency;}
  const i=info(picked)!;
  if(!i.suppressed&&(!notTooMany||i.instances<=2))return picked;
 }
 return undefined;
}
/** Native parked cars: fixed-model records plus random-model generators resolved through the popcycle car
 * membership, scheduled as CCarGenerator::Process does (the 140 to 160 unit approach band, the start window, the
 * day and night parked limits, a minute's wait after the player takes the car, regeneration once the car is gone)
 * and fitted with the record's door lock and alarm chances. */
export class WorldFleet {
 readonly cars=new Set<WorldCar>();
 /** CWeather's rainy state, for the ONLY_WHEN_RAINING extra component rule. */
 raining?:()=>boolean;
 /** The player's own vehicle paint, which ChooseVehicleColour avoids repeating on a new car of the same model. */
 private playerColours(){const car=this.occupied;const indices=car?.assets.colourIndices;return car&&indices?{model:car.assets.vehicle.model,indices}:undefined;}
 readonly planes=new Set<WorldPlane>();
 readonly boats=new Set<WorldBoat>();
 readonly bikes=new Set<WorldBike>();
 /** The trains' carriages (CTrain), engine first within each train, and the tracks they run on. */
 readonly trains=new Set<WorldTrain>();
 private tracks?:Promise<TrainTrack[]>;
 private loadedTracks?:TrainTrack[];
 private readonly trainOf=new Map<NativeTrainCarriage,WorldTrain>();
 private catalogReady:Promise<Awaited<ReturnType<typeof openStaticWorldVehicles>>>;
 private zones?:WorldZones;
 private currentZone?:{infoLabel:string;textLabel:string;zoneInfoIndex:number;level:number;populationType?:number;gangStrength?:readonly number[];dealerStrength?:number;noCops?:boolean;races?:number};
 private gangCars?:GangCarRoster;
 setZones(zones:WorldZones){this.zones=zones;}
  /** SUPPRESS_CAR_MODEL: the models CStreaming is told not to bring in for traffic, which the script sets and
   * clears. A suppressed model is passed over when a civilian car is drawn, as CStreaming would not have it
   * in memory to draw. */
  suppressedModels:()=>ReadonlySet<number|string>=()=>new Set();
  /** CTheZones' info record for a zone, as the running script has it. The browser's own copy was read out of
   * the script's bytes before anything ran them, so it is a new game's profile and nothing later; this is the
   * live one, and it answers first wherever it has a record. */
  scriptZoneInfo?:(zoneInfoIndex:number)=>{popType:number;gangStrength:readonly number[];dealerStrength:number;noCops:boolean;popRaces:number}|undefined;
  /** Native-coordinate WATER.DAT height query shared with spawned aircraft. */
  waterLevel?:(x:number,y:number)=>number|undefined;
  /** Native popcycle traffic models for the current zone, weekday and clock (a car group drawn by its
   * popcycle percentage, then a random model of it); the fixed trio covers missing zones, calendars and
   * unloadable models. */
  trafficModel(){return this.trafficPick().modelId;}
  /** CStreaming's resident gang car for a gang the current zone names (one random cargrp.dat model per gang). */
  gangCarModel(gang:number){
   const catalog=this.catalog;if(!catalog)return undefined;
   this.gangCars??=new GangCarRoster(catalog.carGroups,Math.random,id=>isBuildableCar(catalog,catalog.definitions.find(v=>v.id===id)));
   const strengths=this.currentZone?.gangStrength;
   this.gangCars.update(strengths?strengths.reduce((mask,value,index)=>value>0?mask|(1<<index):mask,0):0);
   return this.gangCars.model(gang);
  }
  /** A traffic car: the popcycle's gang share of the zone's cars comes from the dominant gang's resident car with
   * gang drivers (CCarCtrl::ChooseModel is a retail stub; the share is the m_NumGangs_Cars ratio, drawn per car),
   * the rest from the civilian car groups. */
  trafficPick():{modelId:number;gang?:number}{
   const row=this.popRow(),strengths=this.currentZone?.gangStrength;
   if(row&&strengths&&Math.random()<gangCarShare(row,strengths,this.currentZone?.populationType??-1,this.currentZone?.dealerStrength)){
    const gang=dominantGang(strengths),modelId=gang>=0?this.gangCarModel(gang):undefined;
    // A suppressed model is not in memory for the gang draw either, so that draw falls through to a civilian.
    if(modelId!==undefined&&!this.suppressedModels().has(modelId))return {modelId,gang};
   }
   return {modelId:this.civilianTrafficModel()};
  }
  /** Whether the next traffic car is a cruising patrol car: the popcycle's cop share of the zone's cars, drawn per
   * car (CCarCtrl::ChooseModel is a retail stub); never in a zone INITIAL marks no-cops. */
  patrolCarDue(){
   const row=this.popRow(),zone=this.currentZone;
   if(!row||!zone||zone.noCops||!Number.isInteger(zone.populationType))return false;
   return Math.random()<copCarShare(row,zone.populationType!,zone.gangStrength,zone.dealerStrength);
  }
  private civilianTrafficModel(){
   const catalog=this.catalog,zone=this.currentZone;
   let models:number[]|undefined;
   const popType=zone?.populationType;
   const suppressed=this.suppressedModels();
   const drivable=(id:number)=>!suppressed.has(id)&&!!catalog&&isBuildableCar(catalog,catalog.definitions.find(v=>v.id===id));
   if(catalog&&Number.isInteger(popType)&&popType!>=0&&popType!<20){
    // CStreaming::LoadZoneVehicle: a car group drawn by its popcycle percentage, then a random model of it.
    try{const row=populationCycleAt(catalog.populationCycle,popType!,this.sim.weekDay,Math.floor(this.sim.timeMinutes/60)%24);const weighted=pickPopulationCarModel(row,catalog.carGroups,Math.random,drivable);if(weighted!==undefined)return weighted;}catch{}
    try{models=[...catalog.populationCarModelsAt(popType!,this.sim.weekDay,Math.floor(this.sim.timeMinutes/60)%24)].filter(drivable);}catch{models=undefined;}
   }
   const fallback=[492,404,551].filter(id=>!suppressed.has(id));
   const pool=models?.length?models:fallback.length?fallback:[492,404,551];
   return pool[(this.trafficCursor++)%pool.length];
  }
  private trafficCursor=0;
  /** The fleet car whose rigid body has the handle, for vehicle collision records. */
  carByBody(handle:number){for(const c of this.cars)if(!c.disposed&&c.car.body.handle===handle)return c;return undefined;}
  /** A bike or boat by body handle (BlowUpCarsInPath touches every vehicle type). */
  vehicleByBody(handle:number){for(const b of this.bikes)if(!b.disposed&&b.body.handle===handle)return b;for(const b of this.boats)if(b.body.handle===handle)return b;return undefined;}
  /** VEHICLES.IDE class of a model (normal, poorfamily, executive, big, ...), once the catalog has loaded. */
  vehicleClass(modelId:number){return this.catalog?.definitions.find(v=>v.id===modelId)?.vehicleClass;}
  /** The catalog's upgrade tables by vehicle model id, for the mod shops' script questions; undefined until it is in. */
  upgradeTables(){
   const catalog=this.catalog;if(!catalog)return undefined;
   const name=(model:number)=>catalog.definitions.find(v=>v.id===model)?.model;
   return {
    upgradesOf:(model:number)=>{const n=name(model);return n?catalog.upgrades.upgradesOf(n):[];},
    modSlotOf:(model:number)=>vehicleModSlot(catalog.upgrades.placeOf(model)),
    remapCount:(model:number)=>{const n=name(model);return n?catalog.upgrades.remapsOf(n).length:0;},
    colourCount:(model:number)=>{const n=name(model);return n?carColorVariationCount(catalog.colors,n):0;},
    /** IsValidModForVehicle of an upgrade for a vehicle model. */
    isValidMod:(upgrade:number,model:number)=>{
     const n=name(model),definition=catalog.definitions.find(v=>v.id===model),set=definition?.wheelUpgradeClass;
     const wheels=set!==undefined&&set>=0?(catalog.upgrades.carMods.wheels.get(set)??[]).map(w=>catalog.upgrades.idOf(w)).filter((id):id is number=>id!==undefined):undefined;
     return isValidModForVehicle(upgrade,catalog.upgrades.placeOf(upgrade),n?catalog.upgrades.upgradesOf(n):[],wheels);
    },
    /** An upgrade's name (veh_mods.ide) and place. */
    upgradeName:(upgrade:number)=>catalog.upgrades.nameOf(upgrade),
    upgradePlace:(upgrade:number)=>catalog.upgrades.placeOf(upgrade),
   };
  }
  /** The cars a car park's script made (bIsCarParkVehicle, RANDOM_VEHICLE): removed far off as the parked ones are. */
  private carParkCars=new Set<WorldCar|WorldBike>();
  /** CCarCtrl::NumRandomCars: the traffic and the car parks' cars (the generators' are NumParkedCars). */
  get numRandomCars(){let n=this.carParkCars.size;for(const car of this.cars)if(car.trafficOrigin&&!car.disposed)n++;return n;}
  /** CREATE_RANDOM_CAR_FOR_CAR_PARK (the iOS executable's, 0x1001d95ac): with 44 random cars or fewer about, a car
   * CStreaming::ms_vehiclesLoaded.PickRandomCar gives (any number of it in the world, the normal, family and motorbike
   * classes only; here a draw from the zone's traffic cars, up to ten tries) set down at the point (renderer axes) its
   * base on it, turned to `heading` (CreateCarForScript's convention), the space cleared for it, RANDOM_VEHICLE and
   * STATUS_ABANDONED, engine off, bIsCarParkVehicle; a motorbike as a bike. Undefined when none is made. */
  async spawnCarParkCar(position:{x:number;y:number;z:number},heading:number){
   if(this.numRandomCars>44)return undefined;
   let model:number|undefined;
   for(let tries=0;tries<10&&model===undefined;tries++){
    const draw=this.civilianTrafficModel(),vehicleClass=draw===undefined?undefined:this.vehicleClass(draw)?.toLowerCase();
    if(draw!==undefined&&vehicleClass&&['normal','poorfamily','richfamily','motorbike'].includes(vehicleClass))model=draw;
   }
   if(model===undefined)return undefined;
   const vehicle=await this.spawnScriptVehicle(model,position,heading).catch(()=>undefined);
   if(!vehicle||!(vehicle instanceof WorldCar||vehicle instanceof WorldBike))return undefined;
   vehicle.missionCar=false;if(vehicle instanceof WorldCar){vehicle.driverless=true;vehicle.carParkVehicle=true;}
   this.carParkCars.add(vehicle);return vehicle;
  }
  /** VEHICLES.IDE model name of a model id, once the catalog has loaded. */
  modelName(modelId:number){return this.catalog?.definitions.find(v=>v.id===modelId)?.model;}
  /** CColModel::m_boundBox of a vehicle model (GET_MODEL_DIMENSIONS), native: read once from the loaded model and
   * kept; undefined while it loads (the first ask starts it), null for a model that is no vehicle. */
  private modelBoxes=new Map<number,{min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}}|null|'loading'>();
  modelBounds(modelId:number){
   const known=this.modelBoxes.get(modelId);if(known!==undefined)return known==='loading'?undefined:known;
   const catalog=this.catalog;if(!catalog)return undefined;
   if(!catalog.definitions.some(v=>v.id===modelId)){this.modelBoxes.set(modelId,null);return null;}
   this.modelBoxes.set(modelId,'loading');
   void catalog.load(modelId).then(a=>{const b=a.collision.bounds;this.modelBoxes.set(modelId,{min:{x:b.min[0],y:b.min[1],z:b.min[2]},max:{x:b.max[0],y:b.max[1],z:b.max[2]}});})
    .catch(error=>{this.modelBoxes.delete(modelId);this.failures.set(`bounds:${modelId}`,String(error));});
   return undefined;
  }
  /** CVehicleModelInfo::m_nVehicleType as vehicles.ide spells it (car, mtruck, quad, heli, plane, boat, train, bike,
   * bmx, trailer), by id or by dff name; undefined for a model that is no vehicle, null until the catalog loads. */
  vehicleIdeType(model:number|string){
   if(!this.catalog)return null;
   const name=typeof model==='string'?model.toLowerCase():undefined;
   return this.catalog.definitions.find(v=>name===undefined?v.id===model:v.model.toLowerCase()===name)?.type;
  }
  /** The player's zone level: 0 countryside, 1 Los Santos, 2 San Fierro, 3 Las Venturas. */
  zoneLevel(){return this.currentZone?.level??0;}
  private popRow(){
   const catalog=this.catalog,popType=this.currentZone?.populationType;
   if(!catalog||!Number.isInteger(popType)||popType!<0||popType!>=20)return undefined;
   try{return populationCycleAt(catalog.populationCycle,popType!,this.sim.weekDay,Math.floor(this.sim.timeMinutes/60)%24);}catch{return undefined;}
  }
  /** Popcycle density caps for the current zone and clock (native maxPeds/maxCars
   * ratios with a 36/44 device clamp; denser native peaks thin by distance band). */
  pedLimits(){
   const row=this.popRow();
   if(!row)return undefined;
   const { peds } = clampBudget(row.maxPeds, row.maxPeds + 8);
   return {civilians: peds,total: Math.min(44,peds+8)};
  }
  /** CWeather::Rain for the popcycle's other-peds damping (main wires the weather). */
  rain?:()=>number;
  /** CPopCycle::Update's ped targets for the zone and clock, with the zone's gang strengths for the gang picker. */
  pedTargets(){
   const row=this.popRow(),zone=this.currentZone;
   if(!row||!zone||!Number.isInteger(zone.populationType))return undefined;
   return {...populationTargets(row,zone.populationType!,zone.gangStrength,zone.dealerStrength,this.rain?.()??0),gangStrengths:zone.gangStrength,noCops:!!zone.noCops};
  }
  /** The popcycle zone type, city and group percentages for the civilian roster. CPopulation::CurrentWorldZone comes
   * from CWeather::WeatherRegion: San Fierro 1, Las Venturas 2, and Los Santos, the desert and the countryside 0. */
  pedZone(){
   const row=this.popRow(),zone=this.currentZone;if(!row||!zone)return undefined;
   const region=nativeWeatherRegion(this.sim.player.position.x,-this.sim.player.position.z);
   const city=(region===WEATHER_REGION.sf?1:region===WEATHER_REGION.lv?2:0) as 0|1|2;
   return {zoneType:row.zoneType,city,groups:row.groups,races:zone.races};
  }
  /** The browser's own population scale for traffic (the touch controls' Population setting; 1 elsewhere). */
  trafficScale=1;
  /** Ambient traffic driver cap: the popcycle car maximum for the zone and hour, ceiling 14, by trafficScale. */
  trafficDrivers(){
   const row=this.popRow();
   if(!row)return undefined;
   return Math.max(2,Math.round(trafficDriverBudget(row.maxCars)*this.trafficScale));
  }
  private randomParkedRecord(candidates:readonly WorldCarGenerator[],groundAt:(record:WorldCarGenerator)=>unknown){
  const record=candidates.find(record=>record.modelId===-1&&groundAt(record));
  if(!record)return undefined;
  // DoInternalProcessing keeps the model it picked (-actualModelId) for the next time, until the player takes the car,
  // and the colours its first car got.
  const kept=this.randomModels.get(record.id);
  if(kept)return {...record,modelId:kept.model,primaryColor:kept.colours?.[0]??-1,secondaryColor:kept.colours?.[1]??-1};
  const catalog=this.catalog,suppressed=this.suppressedModels();
  const info=(id:number):PickableCar|undefined=>{const v=catalog?.definitions.find(d=>d.id===id);if(!v)return undefined;
   let instances=0;for(const vehicle of [...this.cars,...this.bikes])if(vehicle.modelId===id)instances++;
   return {vehicleClass:v.vehicleClass,frequency:v.frequency,suppressed:suppressed.has(id)||suppressed.has(v.model.toLowerCase()),instances};};
  const resolved=resolveRandomParkedRecord(record,this.parkedPool(),Math.random,info);
  if(resolved)this.randomModels.set(record.id,{model:resolved.modelId});
  return resolved&&{...resolved,primaryColor:-1,secondaryColor:-1};
 }
 /** Current popcycle car membership for parked picks (fixed trio fallback). */
 private parkedPool(){
  const catalog=this.catalog,popType=this.currentZone?.populationType;
  try{
   if(catalog&&Number.isInteger(popType)&&popType!>=0&&popType!<20){
    const models=[...catalog.populationCarModelsAt(popType!,this.sim.weekDay,Math.floor(this.sim.timeMinutes/60)%24)].filter(id=>!!PLAYABLE_BIKES[id]||isBuildableCar(catalog,catalog.definitions.find(v=>v.id===id)));
    if(models.length)return models;
   }
  }catch{/* fall through to the fixed trio */}
  return [492,404,551];
 }
 private records:readonly WorldCarGenerator[]=[];
 /** Records mid-spawn (their asset load is pending). */
 private attempted=new Set<string>();
 /** Aircraft made by a generator, by the generator's id: culling one frees its generator. */
 private generatedPlanes=new Map<WorldPlane,string>();
 private generated=new Map<WorldCar,string>();
 /** The cars the player has driven (not the traffic's), with the last time he sat in it: the culling's side of CCarCtrl's
  * vehicles of interest, kept from removal for three minutes (PruneVehiclesOfInterest) and then an ordinary abandoned
  * car, removed far off. */
 private driven=new Map<WorldCar,number>();
 /** CCarCtrl's apCarsToKeep: the two vehicles he was last in, any kind and however made (the cull list above is the
  * port's own). */
 readonly vehiclesOfInterest=new VehiclesOfInterest<WorldCar|WorldBike|WorldBoat|WorldPlane>();
 /** CCarCtrl::IsThisVehicleInteresting. */
 isVehicleOfInterest(vehicle:WorldCar|WorldBike|WorldBoat|WorldPlane){return !vehicle.disposed&&this.vehiclesOfInterest.has(vehicle);}
 /** CCarCtrl::ClearInterestingVehicleList. */
 clearInterestingVehicleList(){this.vehiclesOfInterest.clear();}
 /** CWorld::RemoveVehicleAndItsOccupants's CGarages::StoreCarInNearestImpoundingGarage: a car or bike of interest an
  * area clear takes goes to the impound (then RemoveFromInterestingVehicleList). */
 onImpound?:(vehicle:WorldCar|WorldBike)=>void;
 private impoundIfInteresting(vehicle:WorldCar|WorldBike){if(this.isVehicleOfInterest(vehicle))this.onImpound?.(vehicle);this.vehiclesOfInterest.remove(vehicle);}
 /** CCarGenerator's m_nNextGenTime and bWaitUntilFarFromPlayer per record. */
 private generatorState=new Map<string,{nextGen:number;waitFar:boolean}>();
 /** Generators whose loading car a clear of its area has removed before it arrived. */
 private cleared=new Set<string>();
 /** CTheCarGenerators::GenerateEvenIfPlayerIsCloseCounter: the start window lets nearby generators fill at once. */
 private closeCounter=GENERATE_EVEN_IF_CLOSE_FRAMES;
 /** The start window's frames, counted down once a frame (CTheCarGenerators::Process), not per 500 ms update. */
 /** A game frame: the start window's count, and CPlayerPed::ProcessControl's RegisterVehicleOfInterest for the
  * vehicle he is in (`passengerOf`, the car he rides in as a passenger) with CCarCtrl::PruneVehiclesOfInterest. */
 tickFrame(frame=0,timeMs=0,passengerOf?:WorldCar){
  if(this.closeCounter>0)this.closeCounter--;
  const ridden=this.occupied??this.occupiedBike??this.occupiedBoat??this.occupiedPlane??passengerOf;
  if(ridden)this.vehiclesOfInterest.register(ridden,timeMs);
  this.vehiclesOfInterest.prune(timeMs,frame,this.sim.player.position.y);
 }
 /** The model a random-model generator picked (saved as -actualModelId), kept until the player takes its car, and the
  * colours its first car got (m_nPrimaryColor and m_nSecondaryColor, from -1). */
 private randomModels=new Map<string,{model:number;colours?:[number,number]}>();
 /** Reopen the start window (a teleport or a fresh spawn), as CCarCtrl::GenerateRandomCars does at the start. */
 generateEvenIfClose(){this.closeCounter=GENERATE_EVEN_IF_CLOSE_FRAMES;}
 private failures=new Map<string,string>();
 /** Generators whose spawn is still loading. */
 private get busy(){return this.attempted.size>0;}
 private disposed=false;
 private nextCheck=0;
 private catalog?:Awaited<ReturnType<typeof openStaticWorldVehicles>>;
 constructor(private sim:Simulation,private scene:Scene,private road:Awaited<ReturnType<typeof loadWorldRoadMaterials>>,starter:WorldCar|undefined,private readonly base:string){
  if(starter){starter.playerVehicle=()=>this.occupied;starter.playerBikeBody=()=>this.occupiedBike?.body.handle;this.cars.add(starter);}
  this.catalogReady=openStaticWorld(base).then(openStaticWorldVehicles);
  void this.catalogReady.then(catalog=>{if(!this.disposed)this.catalog=catalog;}).catch(error=>this.failures.set('catalog',String(error)));
 }
 canChangePopulation:(point:{x:number;y:number;z:number},radius:number)=>boolean=()=>true;
 /** The centres of the peds around, for CCarGenerator::CheckForBlockage (main wires the pedestrians). */
 pedCentres:()=>readonly {x:number;y:number;z:number}[]=()=>[];
 /** CCarGenerator::CheckForBlockage (0x6F32E0): a vehicle or ped whose bounding sphere reaches the new car's in 2D
  * (FindObjectsKindaColliding) and whose box comes within a unit of the new car's height span. Native point and bounds;
  * a ped stands in as a unit sphere with its box a unit either side of its centre. */
 private blocked(point:readonly [number,number,number],bounds:{radius:number;min:readonly number[];max:readonly number[]}){
  const hit=(p:{x:number;y:number;z:number},radius:number,minZ:number,maxZ:number)=>
   Math.hypot(p.x-point[0],-p.z-point[1])<bounds.radius+radius&&p.y+maxZ+1>point[2]+bounds.min[2]&&p.y+minZ-1<point[2]+bounds.max[2];
  for(const vehicle of [...this.cars,...this.bikes,...this.boats,...this.planes]){
   const body=vehicle.car.body,b=vehicle.assets.collision?.bounds;
   if(!b||!body.isEnabled())continue;
   if(hit(body.translation(),b.radius,b.min[2],b.max[2]))return true;
  }
  const player=this.sim.player.position;
  if(hit({x:player.x,y:player.y+1,z:player.z},1,-1,1))return true;
  return this.pedCentres().some(p=>hit(p,1,-1,1));
 }
 async spawnTrafficCar(modelId:number,position:{x:number;y:number;z:number},heading:number,canPublish:()=>boolean=()=>true){
  const catalog=await this.catalogReady;
  const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1,plateRegion:nativeWeatherRegion(this.sim.player.position.x,-this.sim.player.position.z),raining:this.raining?.()??false,playerColours:this.playerColours()});
  if(this.disposed)throw new Error('World fleet disposed.');
  if(!canPublish())return;
  // Asset loading can cross a terrain-streaming update; recheck support and
  // spawn clearance immediately before allocating physics and render resources.
  const top=position.y+3,hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({...position,y:top},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  if(!hit||hit.normal.y<.8)return;
  const ground=top-hit.timeOfImpact,rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};
  if(this.sim.world.intersectionWithShape({...position,y:ground+1},rotation,new RAPIER.Cuboid(1,.8,2.5)))return;
   const car=new WorldCar(this.sim,this.scene,assets,{...position,y:ground-assets.collision.bounds.min[2]+.1},this.road,heading);car.fadeIn();car.otherCar=handle=>this.carByBody(handle);car.otherVehicle=handle=>this.vehicleByBody(handle);
   car.trafficOrigin=true;car.playerVehicle=()=>this.occupied;car.playerBikeBody=()=>this.occupiedBike?.body.handle;car.waterLevel=this.waterLevel;this.cars.add(car);return car;
 }
 /** CCarCtrl::CreateCarForScript (0x431F80): the model loaded and the car set down where the script says, with
  * a z at or below the map's low limit dropped to the ground first, lifted off the base of its model, kept from
  * removal, engine off and abandoned. Unlike the traffic spawn it does not refuse a spot that is taken: the original
  * clears the space with CTheScripts::ClearSpaceForMissionEntity rather than declining to make the car. */
 async spawnScriptCar(modelId:number,position:{x:number;y:number;z:number},heading:number,componentsToUse?:readonly [number,number]){
  const catalog=await this.catalogReady;
  const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1,plateRegion:nativeWeatherRegion(this.sim.player.position.x,-this.sim.player.position.z),raining:this.raining?.()??false,playerColours:this.playerColours()});
  assets.componentsToUse=componentsToUse;
  if(this.disposed)return undefined;
  let ground=position.y,fellBack=false;
  if(ground<=MAP_Z_LOW_LIMIT){
   // CWorld::FindGroundZForCoord, from high above the point looking down, and 20 where nothing is hit.
   const top=1000,hit=this.sim.world.castRay(new RAPIER.Ray({x:position.x,y:top,z:position.z},{x:0,y:-1,z:0}),2000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   ground=hit?top-hit.timeOfImpact:20;fellBack=!hit;
  }
  const at={x:position.x,y:ground-assets.collision.bounds.min[2],z:position.z};
  // CreateCarForScript's CTheScripts::ClearSpaceForMissionEntity: SWEET1 makes Sweet's Greenwood where his switched-off
  // generator's own Greenwood stands, 10.2 units from the centre of its CLEAR_AREA of 10, and the two were forced apart
  // into the side yard.
  this.clearSpaceFor(at,heading,assets.collision.bounds);
  // CreateCarForScript sets no clump alpha: only CCarGenerator starts its car at 0 and fades it in. Faded, INTRO's
  // police car stood half-seen while its collision streamed in and then snapped solid.
  const car=new WorldCar(this.sim,this.scene,assets,at,this.road,heading);
  car.otherCar=handle=>this.carByBody(handle);car.otherVehicle=handle=>this.vehicleByBody(handle);
  car.playerVehicle=()=>this.occupied;car.playerBikeBody=()=>this.occupiedBike?.body.handle;car.waterLevel=this.waterLevel;
  // vehicleFlags.bIsLocked, which keeps the car from being removed (missionCar), and STATUS_ABANDONED: nobody drives
  // it. Its doors (m_nDoorLock) are left as they are, CARLOCK_UNLOCKED, for LOCK_CAR_DOORS to change.
  car.missionCar=true;car.waitForCollision(fellBack);
  this.cars.add(car);return car;
 }
 /** CCarCtrl::CreateCarForScript for any vehicle the script names: a bike, boat, plane or helicopter goes through
  * its own class, set down the same way as a car (a point at or below the map's low limit dropped to the ground,
  * then lifted off the base of its model) and kept as the mission's. Other kinds (trains are made by
  * CREATE_MISSION_TRAIN) are not built. */
 async spawnScriptVehicle(modelId:number,position:{x:number;y:number;z:number},heading:number,componentsToUse?:readonly [number,number]){
  const catalog=await this.catalogReady,definition=catalog.definitions.find(v=>v.id===modelId);
  if(!definition||!(PLAYABLE_BIKES[modelId]||PLAYABLE_BOATS[modelId]||PLAYABLE_PLANES[modelId]))return this.spawnScriptCar(modelId,position,heading,componentsToUse);
  const assets=PLAYABLE_BIKES[modelId]?await loadFixedWorldBike(catalog,{modelId,primaryColor:-1,secondaryColor:-1}):await catalog.load(modelId);
  if(this.disposed)return undefined;
  const bounds=assets.collision?.bounds;if(!bounds)return undefined;
  let ground=position.y;
  if(ground<=MAP_Z_LOW_LIMIT){
   const top=1000,hit=this.sim.world.castRay(new RAPIER.Ray({x:position.x,y:top,z:position.z},{x:0,y:-1,z:0}),2000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   ground=hit?top-hit.timeOfImpact:0;
  }
  const at={x:position.x,y:ground-bounds.min[2],z:position.z};
  // CreateCarForScript: ClearSpaceForMissionEntity for a bike, boat or aircraft too.
  this.clearSpaceFor(at,heading,bounds);
  if(PLAYABLE_BIKES[modelId]){const b=assets as Awaited<ReturnType<typeof loadFixedWorldBike>>;at.y=ground-bikeRestBottom(b.model,b.wheelFrames,bounds.min[2],b.vehicle.frontWheelSize,b.vehicle.rearWheelSize);const bike=new WorldBike(this.sim,this.scene,b,at,heading);bike.missionCar=true;bike.waterLevel=this.waterLevel;this.bikes.add(bike);return bike;}
  if(PLAYABLE_BOATS[modelId]){const boat=new WorldBoat(this.sim,this.scene,assets as ConstructorParameters<typeof WorldBoat>[2],at,heading,rotatedColours(catalog,assets.vehicle.model));boat.waterLevel=this.waterLevel;boat.missionCar=true;this.boats.add(boat);return boat;}
  const plane=new WorldPlane(this.sim,this.scene,assets as ConstructorParameters<typeof WorldPlane>[2],at,heading,rotatedColours(catalog,assets.vehicle.model));plane.waterLevel=this.waterLevel;plane.missionCar=true;this.planes.add(plane);return plane;
 }
 /** CHANGE_CAR_COLOUR: the two paint slots take the palette entries the script names, and the other two are
  * left as the car's own variation chose them. A slot the palette does not carry is left alone, which is what
  * the loader's own unresolved paint would have been. */
 recolourCar(car:WorldCar,primary:number,secondary:number){
  const palette=this.catalog?.colors.palette;if(!palette)return false;
  const colors=car.assets.colors;if(!colors)return false;
  const rows=colors.map(rgb=>[...rgb] as [number,number,number]);
  for(const [slot,index] of [primary,secondary].entries()){
   const rgb=palette[index]?.rgb;if(rgb)rows[slot]=[...rgb] as [number,number,number];
  }
  const next=[rows[0],rows[1],rows[2],rows[3]] as const,indices=car.assets.colourIndices;
  if(indices)car.assets.colourIndices=[palette[primary]?primary:indices[0],palette[secondary]?secondary:indices[1],indices[2],indices[3]];
  car.assets.colors=next as unknown as typeof colors;car.car.setColors(car.assets.colors);return true;
 }
 /** A Pay 'n' Spray's new paint (CGarage::Update's respray, iOS 0x1001b4c30): ChooseVehicleColour once, and the car
  * takes the colours when any of its four differs. (re3's III and VC case asked again up to ten times for new main
  * colours; SA does not.) True when they changed. */
 resprayCar(car:WorldCar){
  const catalog=this.catalog;if(!catalog)return false;
  const model=car.assets.vehicle.model,count=carColorVariationCount(catalog.colors,model),before=car.assets.colourIndices;
  const variation=count?catalog.colourRotation.choose(model,count):0,chosen=chooseVehicleColors(catalog.colors,model,variation);
  const changed=!before||chosen.indices.some((index,i)=>index!==before[i]);
  if(!changed)return false;
  car.assets.colors=chosen.colors;car.assets.colourIndices=chosen.indices;car.assets.colourVariation=variation;car.car.setColors(chosen.colors);
  return true;
 }
 /** CStoredCar::RestoreCar (iOS 0x1001b7f20): a hideout's kept car or bike made again where it stood, at its stored
  * place and turn, with no ClearSpaceForMissionEntity (it is not a script's), RANDOM_VEHICLE and abandoned, its paint
  * back. Undefined once the fleet is gone or for a boat or aircraft (no hideout keeps one). */
 async restoreStoredVehicle(modelId:number,at:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number;w:number},colours:readonly number[],placeOnRoad=false){
  const catalog=await this.catalogReady;
  if(PLAYABLE_BOATS[modelId]||PLAYABLE_PLANES[modelId]||!catalog.definitions.some(v=>v.id===modelId))return undefined;
  let vehicle:WorldCar|WorldBike;
  if(PLAYABLE_BIKES[modelId]){
   const paint=colours[0]>=0&&colours[1]>=0&&catalog.colors.palette[colours[0]]&&catalog.colors.palette[colours[1]];
   const assets=await loadFixedWorldBike(catalog,{modelId,primaryColor:paint?colours[0]:-1,secondaryColor:paint?colours[1]:-1});
   if(this.disposed)return undefined;
   const bike=new WorldBike(this.sim,this.scene,assets,at,0);bike.waterLevel=this.waterLevel;this.bikes.add(bike);vehicle=bike;
  }else{
   const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1,plateRegion:nativeWeatherRegion(at.x,-at.z),raining:this.raining?.()??false,playerColours:this.playerColours()});
   if(this.disposed)return undefined;
   const car=new WorldCar(this.sim,this.scene,assets,at,this.road,0);
   car.otherCar=handle=>this.carByBody(handle);car.otherVehicle=handle=>this.vehicleByBody(handle);
   car.playerVehicle=()=>this.occupied;car.playerBikeBody=()=>this.occupiedBike?.body.handle;car.waterLevel=this.waterLevel;
   // An impound's car waits for the floor under it and is then set on it, looked for from two units up (not from the
   // sky: the impounds lie under buildings).
   car.driverless=true;car.waitForCollision(placeOnRoad,false,placeOnRoad?at.y+2:undefined);this.cars.add(car);this.paintCar(car,colours);vehicle=car;
  }
  // An impound's car is set on its wheels (CAutomobile and CBike::PlaceOnRoadProperly): the ground under its middle,
  // looked for from two units up, under the base of its model.
  if(placeOnRoad){
   const hit=this.sim.world.castRay(new RAPIER.Ray({x:at.x,y:at.y+2,z:at.z},{x:0,y:-1,z:0}),20,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   const min=vehicle instanceof WorldCar?vehicle.assets.collision.bounds.min[2]:vehicle.assets.collision?.bounds.min[2]??0;
   if(hit)at={...at,y:at.y+2-hit.timeOfImpact-min};
  }
  vehicle.car.body.setTranslation(at,true);vehicle.car.body.setRotation(rotation,true);
  return vehicle;
 }
 /** The paintjob textures the cars wear, held while worn; each material's own texture, to put back. */
 private readonly remapPool=new TexturePool();
 private readonly remapped=new WeakMap<WorldCar,{texture:ModelTexture;map:unknown}>();
 private readonly remapOriginals=new WeakMap<object,unknown>();
 /** CVehicle::SetRemap (iOS 0x1004763c4) and CVehicle::PreRender's remap: the model's paintjob `index` (-1, or one
  * past its remaps, takes it off), its dictionary read and its texture put on every remappable material
  * (SetEditableMaterialsCB), the primary colour then white unless bDontSetColourWhenRemapping (not kept here).
  * GetRemapIndex answers the new index at once rather than once the dictionary has loaded. */
 setRemap(car:WorldCar,index:number){
  const catalog=this.catalog;if(!catalog)return;
  const name=remapName(catalog.upgrades.remapsOf(car.assets.vehicle.model),index);
  car.paintjob=name?index:-1;
  if(!name){this.applyRemap(car,undefined);return;}
  void catalog.upgrades.remapTexture(name).then(texture=>{
   if(car.disposed||car.paintjob!==index||!texture)return;
   this.applyRemap(car,texture);
   const indices=car.assets.colourIndices;if(indices)this.paintCar(car,remapColours(indices));
  }).catch(()=>{});
 }
 private applyRemap(car:WorldCar,texture:ModelTexture|undefined){
  const before=this.remapped.get(car);if(before?.texture===texture)return;
  const map=texture?this.remapPool.acquire(texture):undefined;
  this.remapMaterials(car,map);
  if(before)this.remapPool.release(before.texture);
  if(!texture){this.remapped.delete(car);return;}
  if(!before)car.whenDisposed(()=>{const worn=this.remapped.get(car);if(worn){this.remapPool.release(worn.texture);this.remapped.delete(car);}});
  this.remapped.set(car,{texture,map});
 }
 /** SetEditableMaterialsCB over the whole clump, the car's own atomics and its tuning parts: the remap texture on every
  * remappable material, or each one's own back. */
 private remapMaterials(car:WorldCar,map:unknown){
  for(const binding of car.car.materialBindings?.()??[]){
   if(!isRemapMaterial(binding.source.texture,binding.texture?.sourceDictionary))continue;
   const material=binding.material as {map:unknown};
   if(!this.remapOriginals.has(material))this.remapOriginals.set(material,material.map);
   material.map=map??this.remapOriginals.get(material)??null;
  }
 }
 /** The tuning parts drawn on each car, by upgrade model id: the frame they stand at (an upgrade position, or the
  * component they replace), and the calls that take them off once drawn (a part still being read is cancelled). */
 private readonly drawnParts=new WeakMap<WorldCar,Map<number,{frame:string;removes:(()=>void)[];cancelled?:boolean}>>();
 /** CVehicle::AddVehicleUpgrade's drawing (iOS 0x100480908): the upgrade, and the other half of a linked pair
  * (CLinkedUpgradeList::FindOtherUpgrade). A chassis part is drawn by CVehicle::AddUpgrade (0x100480f70) at the car's
  * upgrade position, which first takes off whatever part stood there (RemoveUpgradeCB, by position); a dummy part
  * (bUsesVehDummy) by 0x100480d44 in place of the component its CarMod names, whose own atomics (and an earlier
  * part's) it destroys, with a second, mirrored exhaust on a double-exhaust model. Nothing for a car without the
  * position or component, for the hydraulics or stereo, or (not yet) for wheels. */
 drawUpgradePart(car:WorldCar,id:number){
  const catalog=this.catalog;if(!catalog)return;
  for(const model of this.withLinkedUpgrade(id)){
   const place=catalog.upgrades.placeOf(model),replace=!!place?.dummy;
   const frame=replace?REPLACED_COMPONENT_FRAMES[place!.place]:upgradePositionFrame(place);
   if(!frame||!car.car.hasFrame(frame))continue;
   let drawn=this.drawnParts.get(car);if(!drawn){drawn=new Map();this.drawnParts.set(car,drawn);}
   for(const [fitted,part] of drawn)if(part.frame===frame){for(const remove of part.removes)remove();part.cancelled=true;drawn.delete(fitted);}
   const part:{frame:string;removes:(()=>void)[];cancelled?:boolean}={frame,removes:[]};drawn.set(model,part);
   // DOUBLE_EXHAUST (the handling's model flag 0x2000): the exhaust once more on a frame of its own, at -2 times the
   // exhaust frame's x, which puts it on the other side.
   const copies:{replace:boolean;offsetX?:number}[]=[{replace}];
   if(replace&&place!.place===EXHAUST_NODE&&car.modelFlags&MODEL_FLAG.doubleExhaust){const x=car.car.nativeFramePosition(frame)?.x;if(x!==undefined)copies.push({replace:false,offsetX:-2*x});}
   void catalog.upgrades.partAsset(model).then(asset=>{
    if(!asset||part.cancelled||car.disposed)return;
    for(const copy of copies){const remove=car.car.attachPart(asset.model,asset.textures,frame,copy);if(remove)part.removes.push(remove);}
    // A paintjob worn reaches the part's remappable materials too.
    const worn=this.remapped.get(car);if(worn)this.remapMaterials(car,worn.map);
   }).catch(()=>{});
  }
 }
 /** CVehicle::RemoveVehicleUpgrade's drawing: the part, and the other half of its pair, taken off (a replaced
  * component's own atomics shown again). */
 removeUpgradePart(car:WorldCar,id:number){
  const drawn=this.drawnParts.get(car);if(!drawn)return;
  for(const model of this.withLinkedUpgrade(id)){const part=drawn.get(model);if(!part)continue;for(const remove of part.removes)remove();part.cancelled=true;drawn.delete(model);}
 }
 /** The tuning parts drawn on a car, by upgrade model id. */
 drawnUpgradeParts(car:WorldCar){return [...(this.drawnParts.get(car)?.keys()??[])];}
 private withLinkedUpgrade(id:number){
  const upgrades=this.catalog?.upgrades,name=upgrades?.nameOf(id),other=name?otherLinkedUpgrade(upgrades!.carMods,name):undefined,otherId=other?upgrades!.idOf(other):undefined;
  return otherId!==undefined?[id,otherId]:[id];
 }
 /** A car's four paint slots set to these palette entries (an entry the palette lacks leaves its slot as it was). */
 paintCar(car:WorldCar,indices:readonly number[]){
  const palette=this.catalog?.colors.palette,colors=car.assets.colors;if(!palette||!colors)return;
  const rows=colors.map(rgb=>[...rgb] as [number,number,number]),before=car.assets.colourIndices;
  for(let slot=0;slot<4;slot++){const rgb=palette[indices[slot]]?.rgb;if(rgb)rows[slot]=[...rgb] as [number,number,number];}
  if(before)car.assets.colourIndices=[0,1,2,3].map(slot=>palette[indices[slot]]?indices[slot]:before[slot]) as unknown as typeof before;
  car.assets.colors=[rows[0],rows[1],rows[2],rows[3]] as unknown as typeof colors;car.car.setColors(car.assets.colors);
 }
 /** CWorld::UseDetonator's vehicle pass (0x5660B0) for the player: every car carrying a sticky bomb he had fitted
  * loses it and blows up half a second on, his doing. */
 useDetonator(){for(const car of this.cars)if(car.bombInstalledByPlayer&&detonateStickyBomb(car))car.bombDetonatedByPlayer=true;}
 /** CWorld::Remove of a vehicle the streamer or a generator may own, as the area clears take one. */
 removeVehicle(vehicle:WorldCar|WorldBike){
  if(vehicle instanceof WorldCar){if(this.cars.delete(vehicle)){this.generated.delete(vehicle);this.driven.delete(vehicle);vehicle.dispose();}return;}
  if(this.bikes.delete(vehicle)){this.generatedOther.delete(vehicle);vehicle.dispose();}
 }
 /** CWorld::Remove through a script's DELETE_CAR, for a car the streamer never owned. */
 removeScriptCar(car:WorldCar){if(this.cars.delete(car))car.dispose();}
 /** The same for a script's bike, boat or aircraft. */
 removeScriptVehicle(vehicle:WorldCar|WorldBike|WorldBoat|WorldPlane){
  if(vehicle instanceof WorldCar)return this.removeScriptCar(vehicle);
  if(vehicle instanceof WorldPlane){if(this.planes.has(vehicle))this.removePlane(vehicle);return;}
  const removed=vehicle instanceof WorldBike?this.bikes.delete(vehicle):this.boats.delete(vehicle);
  if(removed)vehicle.dispose();
 }
 /** Takes an aircraft out of the world. A generator's own aircraft frees its generator to make another (CCarGenerator
  * finds its vehicle handle gone from the pool). */
 removePlane(plane:WorldPlane){
  // The player still in the getout is set down where it ends (his collider back on) before the aircraft goes.
  plane.cancelEntry();plane.dispose();this.planes.delete(plane);
  const id=this.generatedPlanes.get(plane);if(id!==undefined){this.generatedPlanes.delete(plane);this.attempted.delete(id);}
 }
 /** CCheat::VehicleCheat (0x43A0B0): the model loaded and set down its bounding radius + 2 ahead of the player (renderer
  * position, heading), turned to face across the player's path (m_fCurrentRotation + π/2), abandoned and unlocked.
  * Aircraft go through spawnPlane. CTheScripts::ClearSpaceForMissionEntity then removes the deletable cars (with their
  * occupants) and peds the new car's bounds overlap. */
 async spawnCheatVehicle(modelId:number,player:{x:number;y:number;z:number},heading:number){
  try{return await this.placeCheatVehicle(modelId,player,heading);}
  catch(error){this.failures.set(`cheat:${modelId}`,error instanceof Error?error.message:String(error));return undefined;}
 }
 private async placeCheatVehicle(modelId:number,player:{x:number;y:number;z:number},heading:number){
  const catalog=await this.catalogReady,forward={x:Math.sin(heading),z:Math.cos(heading)},rotZ=heading+Math.PI*1.5;
  if(PLAYABLE_PLANES[modelId]){
   const assets=await catalog.load(modelId),d=(assets.collision?.bounds.radius??0)+2;
   return this.spawnPlane(modelId,player.x+forward.x*d,player.z+forward.z*d,rotZ);
  }
  if(PLAYABLE_BIKES[modelId]){
   const assets=await catalog.load(modelId),d=(assets.collision?.bounds.radius??0)+2;
   return this.spawnBike(modelId,player.x+forward.x*d,player.z+forward.z*d,rotZ,player.y);
  }
  const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1,plateRegion:nativeWeatherRegion(this.sim.player.position.x,-this.sim.player.position.z),raining:this.raining?.()??false,playerColours:this.playerColours()});
  if(this.disposed)throw new Error('World fleet disposed.');
  const d=assets.collision.bounds.radius+2,position={x:player.x+forward.x*d,y:player.y,z:player.z+forward.z*d};
  const top=position.y+4,hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({...position,y:top},{x:0,y:-1,z:0}),10,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  if(!hit)return undefined;
  const ground=top-hit.timeOfImpact;
  const at={...position,y:ground-assets.collision.bounds.min[2]+.1};
  this.clearSpaceFor(at,rotZ,assets.collision.bounds);
  // CCheat::VehicleCheat sets no clump alpha either.
  const car=new WorldCar(this.sim,this.scene,assets,at,this.road,rotZ);car.otherCar=handle=>this.carByBody(handle);car.otherVehicle=handle=>this.vehicleByBody(handle);
  // CCheat::VehicleCheat leaves it STATUS_ABANDONED, as CCarGenerator does its parked cars.
  car.driverless=true;car.playerVehicle=()=>this.occupied;car.playerBikeBody=()=>this.occupiedBike?.body.handle;car.waterLevel=this.waterLevel;this.cars.add(car);return car;
 }
 /** Removes a street ped by its collider handle (CPopulation::RemovePed for ClearSpaceForMissionEntity). */
 clearPed?:(colliderHandle:number)=>boolean;
 /** Dev: the last clearSpaceFor result. */
 lastClear?:{cars:number;peds:number;center:{x:number;y:number;z:number};half:{x:number;y:number;z:number}};
 /** CTheScripts::ClearSpaceForMissionEntity: every deletable car (not the player's, not a mission's) and every ped whose
  * collision the new car's bounding box overlaps at its spawn pose is removed, occupants included. */
 clearSpaceFor(position:{x:number;y:number;z:number},heading:number,bounds:{min:readonly number[];max:readonly number[]}){
  const half={x:(bounds.max[0]-bounds.min[0])/2,y:(bounds.max[2]-bounds.min[2])/2,z:(bounds.max[1]-bounds.min[1])/2};
  const local={x:(bounds.max[0]+bounds.min[0])/2,y:(bounds.max[2]+bounds.min[2])/2,z:-(bounds.max[1]+bounds.min[1])/2};
  const s=Math.sin(heading),c=Math.cos(heading),center={x:position.x+c*local.x+s*local.z,y:position.y+local.y,z:position.z-s*local.x+c*local.z};
  const rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};
  const cars=new Set<WorldCar>(),peds:number[]=[];
  this.sim.world.intersectionsWithShape(center,rotation,new RAPIER.Cuboid(half.x,half.y,half.z),collider=>{
   const body=collider.parent();const car=body?this.carByBody(body.handle):undefined;
   // CVehicle::CanBeDeleted: a car a mission made is not; a car with its doors locked is.
   if(car){if(!car.occupied&&!car.missionCar)cars.add(car);}
   else if(collider.handle!==this.sim.playerCollider.handle)peds.push(collider.handle);
   return true;
  });
  for(const car of cars){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  for(const handle of peds)this.clearPed?.(handle);
  // A generator car still loading onto the spot would have been there, and removed, in the original.
  const reach=Math.hypot(half.x,half.z);
  for(const record of this.records)if(this.attempted.has(record.id)&&Math.hypot(record.position[0]-center.x,-record.position[1]-center.z)<reach+2)this.cleared.add(record.id);
  this.lastClear={cars:cars.size,peds:peds.length,center,half};
  return this.lastClear;
 }
 /** CGarages::IsPointWithinHideOutGarage for a car's spot, in browser coordinates. */
 insideHideOutGarage?:(at:{x:number;y:number;z:number})=>boolean;
 /** CWorld::ClearExcitingStuffFromArea's vehicle pass: every car within the radius on the plane that is not
  * the player's, not locked, not a script's own and not in a safehouse garage goes, with whoever is in it. The
  * boat exemption the routine also makes has nothing here to exempt. */
 clearCarsInArea(point:{x:number;z:number},radius:number){
  const doomed:WorldCar[]=[];
  for(const car of this.cars){
   if(car.occupied||car.locked||car.disposed||car.missionCar)continue;
   if(this.insideHideOutGarage?.(car.car.body.translation()))continue;
   const at=car.car.body.translation();
   if(Math.hypot(at.x-point.x,at.z-point.z)>=radius)continue;
   doomed.push(car);
  }
  for(const car of doomed){this.impoundIfInteresting(car);this.cars.delete(car);this.generated.delete(car);this.driven.delete(car);car.dispose();}
  // A generator's car still loading within the area counts as one cleared.
  for(const record of this.records)if(this.attempted.has(record.id)&&Math.hypot(record.position[0]-point.x,-record.position[1]-point.z)<radius)this.cleared.add(record.id);
  // The pass walks the whole vehicle pool: bikes, boats and aircraft nobody rides and no script holds go too.
  let others=0;
  const near=(v:{car:{body:RAPIER.RigidBody}})=>{const at=v.car.body.translation();return Math.hypot(at.x-point.x,at.z-point.z)<radius;};
  for(const bike of [...this.bikes])if(!bike.occupied&&!bike.missionCar&&!bike.disposed&&near(bike)){this.impoundIfInteresting(bike);bike.dispose();this.bikes.delete(bike);this.generatedOther.delete(bike);others++;}
  for(const boat of [...this.boats])if(!boat.occupied&&!boat.missionCar&&!boat.disposed&&near(boat)){boat.dispose();this.boats.delete(boat);this.generatedOther.delete(boat);others++;}
  for(const plane of [...this.planes])if(!plane.occupied&&!plane.entryBusy&&!plane.missionCar&&!plane.disposed&&near(plane)){this.removePlane(plane);others++;}
  return doomed.length+others;
 }
 /** CWorld::ClearCarsFromArea (CLEAR_AREA_OF_CARS): every car inside the box (renderer corners) that is not the
  * player's, not locked and not a script's own goes. */
 clearCarsInBox(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
  const lo={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),z:Math.min(a.z,b.z)},hi={x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),z:Math.max(a.z,b.z)};
  const doomed:WorldCar[]=[];
  for(const car of this.cars){
   if(car.occupied||car.locked||car.disposed||car.missionCar)continue;
   const at=car.car.body.translation();
   if(at.x<lo.x||at.x>hi.x||at.y<lo.y||at.y>hi.y||at.z<lo.z||at.z>hi.z)continue;
   doomed.push(car);
  }
  for(const car of doomed){this.impoundIfInteresting(car);this.cars.delete(car);this.generated.delete(car);this.driven.delete(car);car.dispose();}
  // CWorld::ClearCarsFromArea walks the whole vehicle pool: the bikes, boats and aircraft go the same way when nobody
  // rides them and no script holds them.
  let others=0;
  const inBox=(v:{car:{body:RAPIER.RigidBody}})=>{const at=v.car.body.translation();return at.x>=lo.x&&at.x<=hi.x&&at.y>=lo.y&&at.y<=hi.y&&at.z>=lo.z&&at.z<=hi.z;};
  for(const bike of [...this.bikes])if(!bike.occupied&&!bike.missionCar&&!bike.disposed&&inBox(bike)){this.impoundIfInteresting(bike);bike.dispose();this.bikes.delete(bike);this.generatedOther.delete(bike);others++;}
  for(const boat of [...this.boats])if(!boat.occupied&&!boat.missionCar&&!boat.disposed&&inBox(boat)){boat.dispose();this.boats.delete(boat);this.generatedOther.delete(boat);others++;}
  for(const plane of [...this.planes])if(!plane.occupied&&!plane.entryBusy&&!plane.missionCar&&!plane.disposed&&inBox(plane)){this.removePlane(plane);others++;}
  return doomed.length+others;
 }
 /** A generator whose own model is the hot-dog van made one (CCarGenerator::DoInternalProcessing adds its vendor). */
 onHotdogVan?:(car:WorldCar)=>void;
 removeTrafficCar(car:WorldCar){if(car.trafficOrigin&&this.cars.delete(car))car.dispose();}
 setGenerators(records:readonly WorldCarGenerator[]){this.records=records;}
  get occupiedPlane(){for(const plane of this.planes)if(plane.occupied)return plane;return undefined;}
  /** The nearest plane; `forEntry` passes over one a script took out of the player's consideration. */
  nearestPlane(forEntry=false){
    const occupied=this.occupiedPlane;
    if(occupied)return occupied;
    let best:WorldPlane|undefined;
    let bestDist=Infinity;
    for(const plane of this.planes){if(forEntry&&plane.consideredByPlayer===false)continue;const d=plane.distance();if(d<bestDist){bestDist=d;best=plane;}}
    return best;
  }
  async spawnPlane(modelId:number,x:number,z:number,heading:number){
   const catalog=await this.catalogReady,assets=await catalog.load(modelId);if(this.disposed)throw new Error('World fleet disposed.');
   // Direct collider queries also see terrain installed while the simulation is paused.
   const groundDistance=fixedGroundDistance(this.sim.world,x,z);
  if(groundDistance===undefined)throw new Error('No runway terrain beneath the plane.');
  if(!assets.collision)throw new Error('Missing plane collision.');
  const plane=new WorldPlane(this.sim,this.scene,assets,{x,y:1000-groundDistance-assets.collision.bounds.min[2]+1,z},heading,rotatedColours(catalog,assets.vehicle.model));plane.waterLevel=this.waterLevel;this.planes.add(plane);return plane;
 }
  get occupied(){for(const car of this.cars)if(car.occupied)return car;return undefined;}
  /** The car a snapshot id names ('starter', a generator id or `traffic:<handle>`). */
  carById(id:string){for(const car of this.cars)if(`handle:${car.car.body.handle}`===id||(this.generated.get(car)??(car.trafficOrigin?`traffic:${car.car.body.handle}`:'starter'))===id)return car;return undefined;}
  nearest(){
    const occupied=this.occupied;
    if(occupied)return occupied;
    let best:WorldCar|undefined;
    let bestDist=Infinity;
    for(const car of this.cars){const d=car.distance();if(d<bestDist){bestDist=d;best=car;}}
    return best;
  }
  get occupiedBoat(){for(const boat of this.boats)if(boat.occupied)return boat;return undefined;}
  /** The nearest boat; `forEntry` passes over one a script took out of the player's consideration. */
  nearestBoat(forEntry=false){
    const occupied=this.occupiedBoat;
    if(occupied)return occupied;
    let best:WorldBoat|undefined;
    let bestDist=Infinity;
    for(const boat of this.boats){if(forEntry&&boat.consideredByPlayer===false)continue;const d=boat.distance();if(d<bestDist){bestDist=d;best=boat;}}
    return best;
  }
  get occupiedBike(){for(const bike of this.bikes)if(bike.occupied)return bike;return undefined;}
  /** The nearest bike; `forEntry` passes over one a script took out of the player's consideration, and `skip` over
   * any other the caller cannot board (a script ped's saddle), so a free bike parked beside a ridden one is found. */
  nearestBike(forEntry=false,skip?:(bike:WorldBike)=>boolean){
    const occupied=this.occupiedBike;
    if(occupied)return occupied;
    let best:WorldBike|undefined;
    let bestDist=Infinity;
    for(const bike of this.bikes){if(forEntry&&bike.consideredByPlayer===false||skip?.(bike))continue;const d=bike.distance();if(d<bestDist){bestDist=d;best=bike;}}
    return best;
  }
 /** Bikes and boats a generator made, by generator id. */
 private generatedOther=new Map<WorldBike|WorldBoat,string>();
 /** CCarGenerator::DoInternalProcessing for a bike or boat record. A boat sits at the generator's own height (or the
  * ground under it when that is below the map), a bike on the ground ProcessVerticalLine finds a unit above the record
  * (from 1000 when the record is below the map); either turns to the record's angle in 256ths of a circle, and a spot
  * CheckForBlockage finds taken waits four more milliseconds, far from the player. */
 private async generateBikeOrBoat(record:WorldCarGenerator,groundAt:(record:WorldCarGenerator)=>RAPIER.RayColliderHit|null){
  const catalog=await this.catalogReady;if(this.disposed)return;
  const boat=!!PLAYABLE_BOATS[record.modelId],assets=boat?await catalog.load(record.modelId):await loadFixedWorldBike(catalog,{modelId:record.modelId,primaryColor:record.primaryColor,secondaryColor:record.secondaryColor});
  if(this.disposed)return;
  const [x,nativeY,nativeZ]=record.position,z=-nativeY,player=this.sim.player.position;
  if(Math.hypot(x-player.x,z-player.z)>=GENERATOR_RANGE+5)return;
  const bounds=assets.collision?.bounds;if(!bounds)throw new Error('Generated vehicle has no collision bounds.');
  if(this.blocked(record.position,bounds)){const state=this.generatorState.get(record.id)??{nextGen:0,waitFar:false};this.generatorState.set(record.id,{nextGen:state.nextGen+4,waitFar:true});return;}
  const angle=Math.trunc(record.angle*256/(Math.PI*2))*Math.PI*2/256;
  let base:number;
  if(boat&&nativeZ>-100)base=nativeZ;
  else{const hit=groundAt(record);if(!hit)return;base=(nativeZ>-100?nativeZ+1:1000)-hit.timeOfImpact;}
  // A bike stands on its tyres (CBike::PlaceOnRoadProperly), a boat on its collision bottom.
  const b=boat?undefined:assets as Awaited<ReturnType<typeof loadFixedWorldBike>>;
  const at={x,y:base-(b?bikeRestBottom(b.model,b.wheelFrames,bounds.min[2],b.vehicle.frontWheelSize,b.vehicle.rearWheelSize):bounds.min[2]),z};
  const vehicle=boat?new WorldBoat(this.sim,this.scene,assets as ConstructorParameters<typeof WorldBoat>[2],at,angle,rotatedColours(catalog,assets.vehicle.model)):new WorldBike(this.sim,this.scene,assets as Awaited<ReturnType<typeof loadFixedWorldBike>>,at,angle);
  vehicle.waterLevel=this.waterLevel;if(vehicle instanceof WorldBoat)this.boats.add(vehicle);else this.bikes.add(vehicle);
  this.generatedOther.set(vehicle,record.id);
 }
 /** The cheat's bike: CCheat::VehicleCheat never refuses the spot. It clears the space with
  * CTheScripts::ClearSpaceForMissionEntity and CBike::PlaceOnRoadProperly sets it on the ground nearest the player's
  * own height (a vertical line 5 units up and down), so a bridge, roof or garage above him is not taken for the floor. */
 async spawnBike(modelId:number,x:number,z:number,heading:number,height?:number){
  const catalog=await this.catalogReady,assets=await loadFixedWorldBike(catalog,{modelId,primaryColor:-1,secondaryColor:-1});if(this.disposed)throw new Error('World fleet disposed.');
  const ground=this.groundNear(x,z,height);
  if(ground===undefined)throw new Error('No bike terrain beneath the spawn.');
  const at={x,y:ground-bikeRestBottom(assets.model,assets.wheelFrames,assets.collision.bounds.min[2],assets.vehicle.frontWheelSize,assets.vehicle.rearWheelSize)+.1,z};
  this.clearSpaceFor(at,heading,assets.collision.bounds);
  const bike=new WorldBike(this.sim,this.scene,assets,at,heading);bike.waterLevel=this.waterLevel;this.bikes.add(bike);return bike;
 }
 /** The fixed ground under (x, z): with a reference height, the surface nearest it within 5 units up or down (the
  * pair of vertical lines PlaceOnRoadProperly casts), otherwise the highest. */
 private groundNear(x:number,z:number,height?:number){
  const cast=(from:number,length:number,up=false)=>{const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:from,z},{x:0,y:up?1:-1,z:0}),length,true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?from+(up?1:-1)*hit.timeOfImpact:undefined;};
  if(height===undefined)return cast(1000,2000);
  const below=cast(height,5),above=cast(height,5,true);
  if(below===undefined)return above;if(above===undefined)return below;
  return Math.abs(above-height)<Math.abs(below-height)?above:below;
 }
 async spawnBoat(modelId:number,x:number,z:number,heading:number){
  const catalog=await this.catalogReady,assets=await catalog.load(modelId);if(this.disposed)throw new Error('World fleet disposed.');
  if(assets.vehicle.type!=='boat')throw new Error('Not a boat definition.');
  const boat=new WorldBoat(this.sim,this.scene,assets,{x,y:1,z},heading,rotatedColours(catalog,assets.vehicle.model));boat.waterLevel=this.waterLevel;this.boats.add(boat);return boat;
 }
  snapshot(){return {lastClear:this.lastClear??null,gangCars:this.gangCars?.loaded??[],planes:[...this.planes].map(p=>p.snapshot()),boats:[...this.boats].map(b=>b.snapshot()),bikes:[...this.bikes].map(b=>b.snapshot()),zone:this.currentZone??null,records:this.records.length,pending:this.busy,failures:[...this.failures].map(([id,message])=>({id,message})),closeCounter:this.closeCounter,parkedLimit:parkedCarLimit(Math.floor(this.sim.timeMinutes/60)%24),cars:[...this.cars].map(car=>({handle:car.car.body.handle,plate:car.assets.plate??null,alarm:+car.alarm.toFixed(2),alarmArmed:car.alarmArmed,id:this.generated.get(car)??(car.trafficOrigin?`traffic:${car.car.body.handle}`:'starter'),modelId:car.modelId,name:car.name,health:car.health,wrecked:car.wrecked,locked:car.locked,onFire:car.onFire,damage:{panels:[...car.damageState.panels],doors:[...car.damageState.doors]},autopilot:!!car.autopilot,occupied:car.occupied,position:{...car.car.body.translation()},heading:+(q=>Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z)))(car.car.body.rotation()).toFixed(3)}))};}
 /** CGame::CanSeeOutSideFromCurrArea: nothing generates inside an interior. */
 outside:()=>boolean=()=>true;
 /** TheCamera.IsSphereVisible for a boat generator's origin (browser coordinates), for the 240-unit visible range. */
 sphereVisible?:(x:number,y:number,z:number)=>boolean;
 update(now:number){
  if(this.disposed||now<this.nextCheck)return;this.nextCheck=now+GENERATOR_PROCESS_MS;
  if(this.zones){
   const p=this.sim.player.position,point:[number,number,number]=[p.x,-p.z,p.y],zone=worldZoneAt(this.zones,point);
   const live=this.scriptZoneInfo?.(zone.zoneInfoIndex),stored=this.zones.population?.[zone.zoneInfoIndex];
   this.currentZone={infoLabel:zone.infoLabel,textLabel:zone.textLabel,zoneInfoIndex:zone.zoneInfoIndex,
    level:worldLevelAt(this.zones,point),
    populationType:live?.popType??stored?.popType,
    gangStrength:live?live.gangStrength as number[]:stored?.gangStrength,
    dealerStrength:live?.dealerStrength??stored?.dealerStrength,
    noCops:live?.noCops??stored?.noCops,
    races:live?.popRaces??stored?.races};
  }
  // Keep the occupied car and starter. Released native cars retire outside the
  // loaded neighborhood; a generator is used once per browser session.
  // A car park's car the player has not taken goes far off as a generator's does (one he has taken is his to keep a while).
  for(const car of this.carParkCars){
   if(car.disposed||car.occupied||car instanceof WorldCar&&this.driven.has(car)){this.carParkCars.delete(car);continue;}
   const at=car.car.body.translation();
   if(car.distance()>140&&this.canChangePopulation(at,6)){this.carParkCars.delete(car);this.removeVehicle(car);}
  }
  for(const [car,id] of this.generated){
   // CCarGenerator::Process: the player took the car, so the generator waits a minute and until he is far away.
   if(car.occupied||car.disposed){this.generated.delete(car);if(car.occupied){this.generatorState.set(id,{nextGen:(this.generatorState.get(id)?.nextGen??now)+GENERATOR_TAKEN_WAIT_MS,waitFar:true});this.randomModels.delete(id);}continue;}
   if(car.distance()>140&&this.canChangePopulation(car.car.body.translation(),6)){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  }
  for(const car of this.cars)if(car.occupied&&!car.missionCar&&!car.trafficOrigin&&!this.generated.has(car))this.driven.set(car,now);
  for(const [car,last] of this.driven){
   if(car.disposed||!this.cars.has(car)||car.missionCar){this.driven.delete(car);continue;}
   if(!car.occupied&&now-last>VEHICLE_OF_INTEREST_MS&&car.distance()>140&&this.canChangePopulation(car.car.body.translation(),6)){this.cars.delete(car);this.driven.delete(car);car.dispose();}
  }
  // CWorld::RemoveFallenCars (World.cpp:1341): a car through the map (MAP_Z_LOW_LIMIT) that a script made (and is not
  // burnt out) or that the player is in goes three units over the nearest pedestrian node (to 0 where there is none)
  // with its speed gone; a random or parked one is removed.
  for(const car of [...this.cars]){
   if(car.disposed)continue;
   const body=car.car.body,t=body.translation();if(t.y>MAP_Z_LOW_LIMIT)continue;
   if(car.missionCar&&!car.wrecked||car.occupied){
    const node=this.sim.nearestPedNode?.({x:t.x,y:t.y,z:t.z}),to=node?{x:node.x,y:node.y+3,z:node.z}:{x:t.x,y:0,z:t.z};
    body.setTranslation(to,true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
   }else if(!car.missionCar){this.cars.delete(car);this.generated.delete(car);this.driven.delete(car);car.dispose();}
  }
  // A script's vehicles stay, however far off, until the script deletes them or lets them go (INTRO1 parks a homie's
  // BMX out of the way and uses it again; it used to be culled from under the script).
  for(const plane of [...this.planes])if(!plane.occupied&&!plane.policeHeli&&!plane.missionCar&&plane.distance()>350)this.removePlane(plane);
  for(const boat of this.boats)if(!boat.occupied&&!boat.missionCar&&boat.distance()>350){boat.dispose();this.boats.delete(boat);this.generatedOther.delete(boat);}
  for(const bike of this.bikes)if(!bike.occupied&&!bike.missionCar&&bike.distance()>350){bike.dispose();this.bikes.delete(bike);this.generatedOther.delete(bike);}
  if(!this.catalog)return;
  // CCarGenerator::Process: generators under 950 work while the player is outside, those at 950 or higher (the
  // interiors) while he is inside.
  const outside=this.outside();
  const p=this.sim.player.position,catalog=this.catalog;
  // FindPlayerSpeed: the occupied car's velocity, or the on-foot displacement (only its direction matters).
  const occ=this.occupied,vel=occ&&!occ.disposed?occ.car.body.linvel():{x:p.x-this.sim.player.previous.x,z:p.z-this.sim.player.previous.z};
  const live=new Set([...this.generated.values(),...this.generatedOther.values()]),speed={x:vel.x,y:-vel.z};
  // CCarCtrl::NumParkedCars counts every vehicle a generator made, bikes, boats and aircraft too, and the spawns
  // still loading stand for the cars they will be.
  const parkedLimit=parkedCarLimit(Math.floor(this.sim.timeMinutes/60)%24);let parked=this.generated.size+this.generatedOther.size+this.generatedPlanes.size+this.attempted.size;
  const candidates=this.records.filter(record=>{
   if(this.attempted.has(record.id)||live.has(record.id))return false;
   if((record.position[2]<950)!==outside)return false;
   // A script generator runs only while its count is not 0 (off until SWITCH_CAR_GENERATOR turns it on).
   if(record.generateCount&&record.generateCount()===0)return false;
   const state=this.generatorState.get(record.id)??{nextGen:0,waitFar:false};
   // The start window lets a generator spawn whatever its timer says.
   if(state.nextGen>now&&this.closeCounter===0)return false;
   const flags=generatorFlags(record.flags);
   // A boat generator the camera sees is in range out to 240 units (CheckIfWithinRangeOfAnyPlayers' bVisible).
   const boatVisible=!!PLAYABLE_BOATS[record.modelId]&&!!this.sphereVisible?.(record.position[0],record.position[2],-record.position[1]);
   const range=generatorInRange({x:p.x-record.position[0],y:-p.z-record.position[1]},p.y-record.position[2],speed,state.waitFar,flags.forceSpawn,this.closeCounter,1,boatVisible);
   if(range.waitFar!==state.waitFar)this.generatorState.set(record.id,{...state,waitFar:range.waitFar});
   return range.eligible;
  }).sort((a,b)=>Math.hypot(a.position[0]-p.x,-a.position[1]-p.z)-Math.hypot(b.position[0]-p.x,-b.position[1]-p.z));
  const groundAt=(record:WorldCarGenerator)=>{
   const [x,y,z]=record.position,top=z>-100?z+1:1000;
   return this.sim.world.castRay(new RAPIER.Ray({x,y:top,z:-y},{x:0,y:-1,z:0}),top+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  };
  // CTheCarGenerators::Process runs every generator in range this pass: each spawns unless the parked cap holds it
  // (DoInternalProcessing's 5 by day, 10 by night, which an ignore-population-limit record passes).
  for(const candidate of candidates){
   if(!generatorFlags(candidate.flags).ignorePopulationLimit&&parked>=parkedLimit)continue;
   if(PLAYABLE_PLANES[candidate.modelId]){
    if(!groundAt(candidate))continue;
    this.attempted.add(candidate.id);parked++;
    // The aircraft stands for its generator until it is culled; a spawn that fails frees the generator to try again after
    // the generator's wait, instead of keeping it blocked for the session.
    void this.spawnPlane(candidate.modelId,candidate.position[0],-candidate.position[1],candidate.angle).then(plane=>{this.generatedPlanes.set(plane,candidate.id);})
     .catch(error=>{this.failures.set(candidate.id,String(error));this.attempted.delete(candidate.id);this.generatorState.set(candidate.id,{nextGen:now+GENERATOR_TAKEN_WAIT_MS,waitFar:false});});
    continue;
   }
   // CCarGenerator::DoInternalProcessing makes a bike (on its side stand) or a boat from its record like any car; a
   // random generator's motorbike parks as a bike.
   let record:WorldCarGenerator|undefined=candidate;
   if(candidate.modelId===-1){record=this.randomParkedRecord([candidate],groundAt);if(!record)continue;}
   else if(!PLAYABLE_BIKES[record.modelId]&&!PLAYABLE_BOATS[record.modelId]&&!(isBuildableCar(catalog,catalog.definitions.find(v=>v.id===record!.modelId))&&groundAt(record)))continue;
   const chosen=record;
   if(PLAYABLE_BIKES[chosen.modelId]||PLAYABLE_BOATS[chosen.modelId]){
    this.attempted.add(chosen.id);parked++;
    void this.generateBikeOrBoat(chosen,groundAt).catch(error=>{if(!this.disposed)this.failures.set(chosen.id,error instanceof Error?error.message:String(error));}).finally(()=>{this.attempted.delete(chosen.id);});
    continue;
   }
   // Query around the native elevation so bridges/garages keep their own floor.
   const [x,nativeY,nativeZ]=chosen.position,z=-nativeY,top=nativeZ>-100?nativeZ+1:1000;
   const ground=()=>groundAt(chosen);
   this.attempted.add(chosen.id);parked++;
   void loadFixedWorldCar(catalog,chosen).then(assets=>{
    if(this.disposed)return;
    // CCarGenerator::DoInternalProcessing makes its car there and then, so a SWITCH_CAR_GENERATOR off or a clear of
    // the area after the pick finds a car it can remove. Here the car is still loading then: a load that lands
    // after either is dropped (INTRO2 switches Ryder's generator off and clears his driveway for the Picador it
    // creates there, and the late one landed in the mission car).
    if(this.cleared.delete(chosen.id)||chosen.generateCount&&chosen.generateCount()===0){this.generatorState.set(chosen.id,{nextGen:now+GENERATOR_TAKEN_WAIT_MS,waitFar:true});return;}
    // A fresh random pick longer than 8 units (its bounding box's y extent) is dropped, to be picked again.
    const random=this.randomModels.get(chosen.id);
    if(random&&!random.colours){const b=assets.collision.bounds;if(b.max[1]-b.min[1]>8){this.randomModels.delete(chosen.id);return;}}
    if(Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>=GENERATOR_RANGE+5)return;
    const hit=ground();if(!hit)return;
    // Something stands where the car would go: try again 4 ms on, once the player has been far away.
    if(this.blocked(chosen.position,assets.collision.bounds)){const state=this.generatorState.get(chosen.id)??{nextGen:0,waitFar:false};this.generatorState.set(chosen.id,{nextGen:state.nextGen+4,waitFar:true});return;}
    const angle=Math.trunc(chosen.angle*256/(Math.PI*2))*Math.PI*2/256;
    const car=new WorldCar(this.sim,this.scene,assets,{x,y:top-hit.timeOfImpact-assets.collision.bounds.min[2],z},this.road,angle);car.fadeIn();car.otherCar=handle=>this.carByBody(handle);car.otherVehicle=handle=>this.vehicleByBody(handle);
   car.driverless=true;car.playerVehicle=()=>this.occupied;car.playerBikeBody=()=>this.occupiedBike?.body.handle;car.waterLevel=this.waterLevel;car.locked=rollDoorLock(chosen.doorLockChance);car.alarmArmed=rollAlarm(chosen.alarmChance);{const c=assets.colourIndices;if(random&&!random.colours&&c)random.colours=[c[0],c[1]];}this.cars.add(car);this.generated.set(car,chosen.id);this.generatorState.set(chosen.id,{nextGen:now+4,waitFar:this.generatorState.get(chosen.id)?.waitFar??false});chosen.spent?.();if(chosen.modelId===588&&car.modelId===588)this.onHotdogVan?.(car);
   }).catch(error=>{if(!this.disposed)this.failures.set(chosen.id,error instanceof Error?error.message:String(error));}).finally(()=>{this.attempted.delete(chosen.id);this.cleared.delete(chosen.id);});
  }
 }
 /** CTrain::InitTrains' four track files, read once. */
 trainTracks(){
  return this.tracks??=Promise.all(TRAIN_TRACK_FILES.map(file=>fetch(new URL(`files/data/paths/${file}`,this.base).href).then(r=>r.ok?r.text():Promise.reject(new Error(`${file} ${r.status}`)))))
   .then(texts=>this.loadedTracks=texts.map(readTrainTrack));
 }
 /** CreateMissionTrain: the type's carriages on the track nearest the native point, the engine returned. */
 async spawnMissionTrain(type:number,point:{x:number;y:number;z:number},clockwise:boolean,nowMs:number){
  const layout=TRAIN_TYPES[type];if(!layout)return undefined;
  const [tracks,catalog]=await Promise.all([this.trainTracks(),this.catalogReady]);
  const assets=new Map<number,Awaited<ReturnType<typeof catalog.load>>>();
  for(const id of new Set(layout))assets.set(id,await catalog.load(id));
  if(this.disposed)return undefined;
  const carriages=createMissionTrain(tracks,point,clockwise,type,id=>trainCarriageModel(assets.get(id)!));
  for(const c of carriages)c.processControl(tracks,1,nowMs);
  const made=carriages.map(c=>{const asset=assets.get(c.model.model)!,t=new WorldTrain(this.sim.world,this.scene,asset,c,rotatedColours(catalog,asset.vehicle.model));this.trains.add(t);this.trainOf.set(c,t);return t;});
  return made[0];
 }
 /** The browser's carriage for a CTrain. */
 trainFor(carriage:NativeTrainCarriage|undefined){return carriage&&this.trainOf.get(carriage);}
 /** CTrain::ProcessControl for every carriage, each train from its engine back, then the bodies to their places. */
 stepTrains(timeStep:number,nowMs:number){
  const tracks=this.loadedTracks;if(!tracks)return;
  for(const t of this.trains){
   if(!t.carriage.isFront&&t.carriage.prev)continue;
   for(let c:NativeTrainCarriage|undefined=t.carriage;c;c=c.next){c.processControl(tracks,timeStep,nowMs);this.trainOf.get(c)?.applyPose();}
  }
 }
 /** SetNewTrainPosition: SetPosn, then FindPositionOnTrackFromCoors (unreversed), taken as the nearest node of the
  * carriage's own track, from which ProcessControl carries on. */
 setTrainPosition(train:WorldTrain,point:{x:number;y:number;z:number}){
  const tracks=this.loadedTracks,c=train.carriage;if(!tracks)return;
  const nodes=tracks[c.trackId].nodes;let best=0,bestDistance=Infinity;
  nodes.forEach((n,i)=>{const d=(n.x-point.x)**2+(n.y-point.y)**2+(n.z-point.z)**2;if(d<bestDistance){bestDistance=d;best=i;}});
  c.nodeIndex=best;c.railDistance=nodes[best].distance;c.position=[point.x,point.y,point.z];
 }
 /** A carriage leaves the world (CWorld::Remove and delete); its neighbours let go of it. */
 removeTrainCarriage(train:WorldTrain){
  const c=train.carriage;
  if(c.prev)c.prev.next=undefined;
  if(c.next){c.next.prev=undefined;}
  this.trains.delete(train);this.trainOf.delete(c);train.dispose();
 }
 /** RemoveOneMissionTrain: this carriage and every one behind it. */
 removeMissionTrain(train:WorldTrain){
  for(let c:NativeTrainCarriage|undefined=train.carriage;c;){const next:NativeTrainCarriage|undefined=c.next;const t=this.trainOf.get(c);if(t)this.removeTrainCarriage(t);c=next;}
 }
 /** RemoveMissionTrains: every mission train's carriages (the player's own vehicle aside, which is no train here). */
 removeMissionTrains(){for(const t of [...this.trains])if(t.carriage.missionTrain)this.removeTrainCarriage(t);}
 /** ReleaseOneMissionTrain and ReleaseMissionTrains: the carriages stop being the mission's. */
 releaseMissionTrain(train:WorldTrain){for(let c:NativeTrainCarriage|undefined=train.carriage;c;c=c.next)c.missionTrain=false;}
 releaseMissionTrains(){for(const t of this.trains)t.carriage.missionTrain=false;}
 /** RemoveAllTrains (unreversed): every train the world holds; the browser runs no random trains. */
 removeAllTrains(){for(const t of [...this.trains])this.removeTrainCarriage(t);}
 dispose(){this.disposed=true;for(const train of this.trains)train.dispose();this.trains.clear();for(const plane of this.planes)plane.dispose();this.planes.clear();for(const boat of this.boats)boat.dispose();this.boats.clear();for(const bike of this.bikes)bike.dispose();this.bikes.clear();for(const car of this.cars)car.dispose();this.cars.clear();this.generated.clear();this.catalog=undefined;}
}
