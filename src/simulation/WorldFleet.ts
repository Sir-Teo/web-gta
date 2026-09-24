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
import {loadFixedWorldBike} from '../assets/fixedWorldBike';
import {WorldBike,PLAYABLE_BIKES} from './WorldBike';
import {WEATHER_REGION,nativeWeatherRegion} from '../world/weatherRegion';
import {rollDoorLock,rollAlarm,generatorFlags,parkedCarLimit,generatorInRange,GENERATOR_RANGE,GENERATE_EVEN_IF_CLOSE_FRAMES,GENERATOR_TAKEN_WAIT_MS} from '../assets/worldCarGenerators';
import {populationCycleAt,pickPopulationCarModel,gangCarShare,dominantGang,copCarShare,populationTargets} from '../assets/populationCycle';
import {GangCarRoster} from './nativePedRoster';
import { trafficDriverBudget, clampBudget } from '../world/popcycle';
import type {WorldCarGenerator} from '../assets/worldCarGenerators';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
/** Resolve one random-model generator against a membership pool (CCarGenerator
 * model -1): uniform pick, keeping the record identity for once-per-session
 * ownership. Empty pools leave the generator for a later window. */
export function resolveRandomParkedRecord(record:WorldCarGenerator,pool:readonly number[],random:()=>number=Math.random){
 if(record.modelId!==-1||!pool.length)return undefined;
 return {...record,modelId:pool[Math.floor(random()*pool.length)%pool.length]};
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
  /** VEHICLES.IDE class of a model (normal, poorfamily, executive, big, ...), once the catalog has loaded. */
  vehicleClass(modelId:number){return this.catalog?.definitions.find(v=>v.id===modelId)?.vehicleClass;}
  /** VEHICLES.IDE model name of a model id, once the catalog has loaded. */
  modelName(modelId:number){return this.catalog?.definitions.find(v=>v.id===modelId)?.model;}
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
  /** Ambient traffic driver cap: the popcycle car maximum for the zone and hour, ceiling 14. */
  trafficDrivers(){
   const row=this.popRow();
   if(!row)return undefined;
   return Math.max(2,trafficDriverBudget(row.maxCars));
  }
  private randomParkedRecord(candidates:readonly WorldCarGenerator[],groundAt:(record:WorldCarGenerator)=>unknown){
  const record=candidates.find(record=>record.modelId===-1&&groundAt(record));
  if(!record)return undefined;
  // DoInternalProcessing keeps the model it picked (-actualModelId) for the next time, until the player takes the car,
  // and the colours its first car got.
  const kept=this.randomModels.get(record.id);
  if(kept)return {...record,modelId:kept.model,primaryColor:kept.colours?.[0]??-1,secondaryColor:kept.colours?.[1]??-1};
  const resolved=resolveRandomParkedRecord(record,this.parkedPool(),Math.random);
  if(resolved)this.randomModels.set(record.id,{model:resolved.modelId});
  return resolved&&{...resolved,primaryColor:-1,secondaryColor:-1};
 }
 /** Current popcycle car membership for parked picks (fixed trio fallback). */
 private parkedPool(){
  const catalog=this.catalog,popType=this.currentZone?.populationType;
  try{
   if(catalog&&Number.isInteger(popType)&&popType!>=0&&popType!<20){
    const models=[...catalog.populationCarModelsAt(popType!,this.sim.weekDay,Math.floor(this.sim.timeMinutes/60)%24)].filter(id=>isBuildableCar(catalog,catalog.definitions.find(v=>v.id===id)));
    if(models.length)return models;
   }
  }catch{/* fall through to the fixed trio */}
  return [492,404,551];
 }
 private records:readonly WorldCarGenerator[]=[];
 /** Records mid-spawn (their asset load is pending). */
 private attempted=new Set<string>();
 private generated=new Map<WorldCar,string>();
 /** CCarGenerator's m_nNextGenTime and bWaitUntilFarFromPlayer per record. */
 private generatorState=new Map<string,{nextGen:number;waitFar:boolean}>();
 /** CTheCarGenerators::GenerateEvenIfPlayerIsCloseCounter: the start window lets nearby generators fill at once. */
 private closeCounter=GENERATE_EVEN_IF_CLOSE_FRAMES;
 /** The start window's frames, counted down once a frame (CTheCarGenerators::Process), not per 500 ms update. */
 tickFrame(){if(this.closeCounter>0)this.closeCounter--;}
 /** The model a random-model generator picked (saved as -actualModelId), kept until the player takes its car, and the
  * colours its first car got (m_nPrimaryColor and m_nSecondaryColor, from -1). */
 private randomModels=new Map<string,{model:number;colours?:[number,number]}>();
 /** Reopen the start window (a teleport or a fresh spawn), as CCarCtrl::GenerateRandomCars does at the start. */
 generateEvenIfClose(){this.closeCounter=GENERATE_EVEN_IF_CLOSE_FRAMES;}
 private failures=new Map<string,string>();
 private busy=false;
 private disposed=false;
 private nextCheck=0;
 private catalog?:Awaited<ReturnType<typeof openStaticWorldVehicles>>;
 constructor(private sim:Simulation,private scene:Scene,private road:Awaited<ReturnType<typeof loadWorldRoadMaterials>>,starter:WorldCar|undefined,base:string){
  if(starter){starter.playerVehicle=()=>this.occupied;this.cars.add(starter);}
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
   const body='car' in vehicle?vehicle.car.body:vehicle.body,b=vehicle.assets.collision?.bounds;
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
   const car=new WorldCar(this.sim,this.scene,assets,{...position,y:ground-assets.collision.bounds.min[2]+.1},this.road,heading);car.fadeIn();car.otherCar=handle=>this.carByBody(handle);
   car.trafficOrigin=true;car.playerVehicle=()=>this.occupied;car.waterLevel=this.waterLevel;this.cars.add(car);return car;
 }
 /** CCarCtrl::CreateCarForScript (0x431F80): the model loaded and the car set down where the script says, with
  * a z at or below the map's low limit dropped to the ground first, lifted off the base of its model, locked,
  * engine off and abandoned. Unlike the traffic spawn it does not refuse a spot that is taken: the original
  * clears the space with CTheScripts::ClearSpaceForMissionEntity rather than declining to make the car. */
 async spawnScriptCar(modelId:number,position:{x:number;y:number;z:number},heading:number){
  const catalog=await this.catalogReady;
  const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1,plateRegion:nativeWeatherRegion(this.sim.player.position.x,-this.sim.player.position.z),raining:this.raining?.()??false,playerColours:this.playerColours()});
  if(this.disposed)return undefined;
  let ground=position.y;
  if(ground<=MAP_Z_LOW_LIMIT){
   // CWorld::FindGroundZForCoord, from high above the point looking down.
   const top=1000,hit=this.sim.world.castRay(new RAPIER.Ray({x:position.x,y:top,z:position.z},{x:0,y:-1,z:0}),2000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   ground=hit?top-hit.timeOfImpact:0;
  }
  const car=new WorldCar(this.sim,this.scene,assets,{x:position.x,y:ground-assets.collision.bounds.min[2],z:position.z},this.road,heading);
  car.fadeIn();car.otherCar=handle=>this.carByBody(handle);
  car.playerVehicle=()=>this.occupied;car.waterLevel=this.waterLevel;
  // bIsLocked and STATUS_ABANDONED: nobody drives it and nobody gets in until the script says so.
  car.locked=true;
  this.cars.add(car);return car;
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
  const next=[rows[0],rows[1],rows[2],rows[3]] as const;
  car.assets.colors=next as unknown as typeof colors;car.car.setColors(car.assets.colors);return true;
 }
 /** CWorld::Remove through a script's DELETE_CAR, for a car the streamer never owned. */
 removeScriptCar(car:WorldCar){if(this.cars.delete(car))car.dispose();}
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
   return this.spawnBike(modelId,player.x+forward.x*d,player.z+forward.z*d,rotZ);
  }
  const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1,plateRegion:nativeWeatherRegion(this.sim.player.position.x,-this.sim.player.position.z),raining:this.raining?.()??false,playerColours:this.playerColours()});
  if(this.disposed)throw new Error('World fleet disposed.');
  const d=assets.collision.bounds.radius+2,position={x:player.x+forward.x*d,y:player.y,z:player.z+forward.z*d};
  const top=position.y+4,hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({...position,y:top},{x:0,y:-1,z:0}),10,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  if(!hit)return undefined;
  const ground=top-hit.timeOfImpact;
  const at={...position,y:ground-assets.collision.bounds.min[2]+.1};
  this.clearSpaceFor(at,rotZ,assets.collision.bounds);
  const car=new WorldCar(this.sim,this.scene,assets,at,this.road,rotZ);car.fadeIn();car.otherCar=handle=>this.carByBody(handle);
  car.playerVehicle=()=>this.occupied;car.waterLevel=this.waterLevel;this.cars.add(car);return car;
 }
 /** Removes a street ped by its collider handle (CPopulation::RemovePed for ClearSpaceForMissionEntity). */
 clearPed?:(colliderHandle:number)=>boolean;
 /** Dev: the last clearSpaceFor result. */
 lastClear?:{cars:number;peds:number;center:{x:number;y:number;z:number};half:{x:number;y:number;z:number}};
 /** CTheScripts::ClearSpaceForMissionEntity: every deletable car (not the player's, not locked) and every ped whose
  * collision the new car's bounding box overlaps at its spawn pose is removed, occupants included. */
 clearSpaceFor(position:{x:number;y:number;z:number},heading:number,bounds:{min:readonly number[];max:readonly number[]}){
  const half={x:(bounds.max[0]-bounds.min[0])/2,y:(bounds.max[2]-bounds.min[2])/2,z:(bounds.max[1]-bounds.min[1])/2};
  const local={x:(bounds.max[0]+bounds.min[0])/2,y:(bounds.max[2]+bounds.min[2])/2,z:-(bounds.max[1]+bounds.min[1])/2};
  const s=Math.sin(heading),c=Math.cos(heading),center={x:position.x+c*local.x+s*local.z,y:position.y+local.y,z:position.z-s*local.x+c*local.z};
  const rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};
  const cars=new Set<WorldCar>(),peds:number[]=[];
  this.sim.world.intersectionsWithShape(center,rotation,new RAPIER.Cuboid(half.x,half.y,half.z),collider=>{
   const body=collider.parent();const car=body?this.carByBody(body.handle):undefined;
   if(car){if(!car.occupied&&!car.locked)cars.add(car);}
   else if(collider.handle!==this.sim.playerCollider.handle)peds.push(collider.handle);
   return true;
  });
  for(const car of cars){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  for(const handle of peds)this.clearPed?.(handle);
  this.lastClear={cars:cars.size,peds:peds.length,center,half};
  return this.lastClear;
 }
 /** CWorld::ClearExcitingStuffFromArea's vehicle pass: every car within the radius on the plane that is not
  * the player's, not locked and not a script's own goes, with whoever is in it. The garage and boat exemptions
  * the routine also makes have nothing here to exempt. */
 clearCarsInArea(point:{x:number;z:number},radius:number){
  const doomed:WorldCar[]=[];
  for(const car of this.cars){
   if(car.occupied||car.locked||car.disposed)continue;
   const at=car.car.body.translation();
   if(Math.hypot(at.x-point.x,at.z-point.z)>=radius)continue;
   doomed.push(car);
  }
  for(const car of doomed){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  return doomed.length;
 }
 removeTrafficCar(car:WorldCar){if(car.trafficOrigin&&this.cars.delete(car))car.dispose();}
 setGenerators(records:readonly WorldCarGenerator[]){this.records=records;}
  get occupiedPlane(){for(const plane of this.planes)if(plane.occupied)return plane;return undefined;}
  nearestPlane(){
    const occupied=this.occupiedPlane;
    if(occupied)return occupied;
    let best:WorldPlane|undefined;
    let bestDist=Infinity;
    for(const plane of this.planes){const d=plane.distance();if(d<bestDist){bestDist=d;best=plane;}}
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
  nearestBoat(){
    const occupied=this.occupiedBoat;
    if(occupied)return occupied;
    let best:WorldBoat|undefined;
    let bestDist=Infinity;
    for(const boat of this.boats){const d=boat.distance();if(d<bestDist){bestDist=d;best=boat;}}
    return best;
  }
  get occupiedBike(){for(const bike of this.bikes)if(bike.occupied)return bike;return undefined;}
  nearestBike(){
    const occupied=this.occupiedBike;
    if(occupied)return occupied;
    let best:WorldBike|undefined;
    let bestDist=Infinity;
    for(const bike of this.bikes){const d=bike.distance();if(d<bestDist){bestDist=d;best=bike;}}
    return best;
  }
 private bikeCursor=0;
 async spawnBike(modelId:number,x:number,z:number,heading:number){
  const catalog=await this.catalogReady,assets=await loadFixedWorldBike(catalog,{modelId,primaryColor:-1,secondaryColor:-1});if(this.disposed)throw new Error('World fleet disposed.');
  // Query around the native elevation so bridges/garages keep their own floor.
  const top=1000,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),top+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  if(!hit)throw new Error('No bike terrain beneath the spawn.');
  const ground=top-hit.timeOfImpact,rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};
  const blocker=this.sim.world.intersectionWithShape({x,y:ground+1,z},rotation,new RAPIER.Cuboid(.6,.8,1.4));
  if(blocker){this.failures.set(`bike:${modelId}`,`spot taken at (${x.toFixed(1)}, ${(ground+1).toFixed(1)}, ${z.toFixed(1)}) by collider ${blocker.handle}${blocker.isSensor()?' (sensor)':''}${blocker.parent()?.isFixed()?' (fixed)':''}`);return undefined;}
  const bike=new WorldBike(this.sim,this.scene,assets,{x,y:ground-assets.collision.bounds.min[2]+.1,z},heading);this.bikes.add(bike);return bike;
 }
 /** Flat open ground near the player for one parked bike (authored spawner;
  * native bike generators are not local). Returns a browser-space spot or undefined. */
 bikeGroundSpot(){
  const p=this.sim.player.position;
  for(const radius of [12,20,30])for(let i=0;i<12;i++){
   const a=i/12*Math.PI*2,x=p.x+Math.cos(a)*radius,z=p.z+Math.sin(a)*radius;
   const hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:p.y+10,z},{x:0,y:-1,z:0}),20,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(!hit||hit.normal.y<.8)continue;
   const ground=p.y+10-hit.timeOfImpact;
   if(this.sim.world.intersectionWithShape({x,y:ground+1,z},{x:0,y:0,z:0,w:1},new RAPIER.Cuboid(.6,.8,1.4)))continue;
   if([...this.bikes].some(b=>{const q=b.body.translation();return Math.hypot(q.x-x,q.z-z)<15;}))continue;
   return {x,z};
  }
  return undefined;
 }
 private boatCursor=0;
 async spawnBoat(modelId:number,x:number,z:number,heading:number){
  const catalog=await this.catalogReady,assets=await catalog.load(modelId);if(this.disposed)throw new Error('World fleet disposed.');
  if(assets.vehicle.type!=='boat')throw new Error('Not a boat definition.');
  const boat=new WorldBoat(this.sim,this.scene,assets,{x,y:1,z},heading,rotatedColours(catalog,assets.vehicle.model));boat.waterLevel=this.waterLevel;this.boats.add(boat);return boat;
 }
 /** Open water near the player for one beached-range runabout (authored spawner;
  * native boat generators are not local). Returns a browser-space spot or undefined. */
 boatWaterSpot(){
  const level=this.waterLevel;if(!level)return undefined;
  const p=this.sim.player.position;
  for(const radius of [25,40,60])for(let i=0;i<12;i++){
   const a=i/12*Math.PI*2,x=p.x+Math.cos(a)*radius,z=p.z+Math.sin(a)*radius,water=level(x,-z);
   if(water===undefined)continue;
   const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:water+10,z},{x:0,y:-1,z:0}),20,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(hit&&water+10-hit.timeOfImpact>water+.5)continue;
   if(this.sim.world.intersectionWithShape({x,y:water+1,z},{x:0,y:0,z:0,w:1},new RAPIER.Cuboid(2,1,5)))continue;
   if([...this.boats].some(b=>{const q=b.body.translation();return Math.hypot(q.x-x,q.z-z)<15;}))continue;
   return {x,z,water};
  }
  return undefined;
 }
  snapshot(){return {lastClear:this.lastClear??null,gangCars:this.gangCars?.loaded??[],planes:[...this.planes].map(p=>p.snapshot()),boats:[...this.boats].map(b=>b.snapshot()),bikes:[...this.bikes].map(b=>b.snapshot()),zone:this.currentZone??null,records:this.records.length,pending:this.busy,failures:[...this.failures].map(([id,message])=>({id,message})),closeCounter:this.closeCounter,parkedLimit:parkedCarLimit(Math.floor(this.sim.timeMinutes/60)%24),cars:[...this.cars].map(car=>({handle:car.car.body.handle,plate:car.assets.plate??null,alarm:+car.alarm.toFixed(2),alarmArmed:car.alarmArmed,id:this.generated.get(car)??(car.trafficOrigin?`traffic:${car.car.body.handle}`:'starter'),modelId:car.modelId,name:car.name,health:car.health,wrecked:car.wrecked,locked:car.locked,onFire:car.onFire,damage:{panels:[...car.damageState.panels],doors:[...car.damageState.doors]},autopilot:!!car.autopilot,occupied:car.occupied,position:{...car.car.body.translation()},heading:+(q=>Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z)))(car.car.body.rotation()).toFixed(3)}))};}
 /** CGame::CanSeeOutSideFromCurrArea: nothing generates inside an interior. */
 outside:()=>boolean=()=>true;
 update(now:number){
  if(this.disposed||now<this.nextCheck)return;this.nextCheck=now+500;
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
  for(const [car,id] of this.generated){
   // CCarGenerator::Process: the player took the car, so the generator waits a minute and until he is far away.
   if(car.occupied||car.disposed){this.generated.delete(car);if(car.occupied){this.generatorState.set(id,{nextGen:(this.generatorState.get(id)?.nextGen??now)+GENERATOR_TAKEN_WAIT_MS,waitFar:true});this.randomModels.delete(id);}continue;}
   if(car.distance()>140&&this.canChangePopulation(car.car.body.translation(),6)){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  }
  for(const plane of this.planes)if(!plane.occupied&&!plane.policeHeli&&plane.distance()>350){plane.dispose();this.planes.delete(plane);}
  for(const boat of this.boats)if(!boat.occupied&&boat.distance()>350){boat.dispose();this.boats.delete(boat);}
  for(const bike of this.bikes)if(!bike.occupied&&bike.distance()>350){bike.dispose();this.bikes.delete(bike);}
  if(this.busy||!this.catalog||this.cars.size+this.planes.size+this.boats.size+this.bikes.size>=14)return;
  // CCarGenerator::Process: generators under 950 work while the player is outside, those at 950 or higher (the
  // interiors) while he is inside. The browser's own parked bike and boat are for the outside.
  const outside=this.outside();
  if(outside){
  // One parked bike on flat ground near the player when roaming without one (BMX first).
  if(!this.bikes.size&&!this.occupiedBike){
   const spot=this.bikeGroundSpot();
   if(spot){const models=Object.keys(PLAYABLE_BIKES).map(Number).sort((a,b)=>(a===481?0:1)-(b===481?0:1)||a-b),model=models[(this.bikeCursor++)%models.length];this.busy=true;void this.spawnBike(model,spot.x,spot.z,0).catch(error=>{if(!this.disposed)this.failures.set(`bike:${model}`,error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;});return;}
  }
  if(!this.boats.size&&!this.occupiedBoat){
   const spot=this.boatWaterSpot();
   if(spot){const models=Object.keys(PLAYABLE_BOATS).map(Number),model=models[(this.boatCursor++)%models.length];this.busy=true;void this.spawnBoat(model,spot.x,spot.z,0).catch(error=>{if(!this.disposed)this.failures.set(`boat:${model}`,error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;});return;}
  }
  }
  const p=this.sim.player.position,catalog=this.catalog;
  // FindPlayerSpeed: the occupied car's velocity, or the on-foot displacement (only its direction matters).
  const occ=this.occupied,vel=occ&&!occ.disposed?occ.car.body.linvel():{x:p.x-this.sim.player.previous.x,z:p.z-this.sim.player.previous.z};
  const live=new Set(this.generated.values()),speed={x:vel.x,y:-vel.z};
  const parkedLimit=parkedCarLimit(Math.floor(this.sim.timeMinutes/60)%24),parked=this.generated.size;
  const candidates=this.records.filter(record=>{
   if(this.attempted.has(record.id)||live.has(record.id))return false;
   if((record.position[2]<950)!==outside)return false;
   // A script generator runs only while its count is not 0 (off until SWITCH_CAR_GENERATOR turns it on).
   if(record.generateCount&&record.generateCount()===0)return false;
   const state=this.generatorState.get(record.id)??{nextGen:0,waitFar:false};
   // The start window lets a generator spawn whatever its timer says.
   if(state.nextGen>now&&this.closeCounter===0)return false;
   const flags=generatorFlags(record.flags);
   const range=generatorInRange({x:p.x-record.position[0],y:-p.z-record.position[1]},p.y-record.position[2],speed,state.waitFar,flags.forceSpawn,this.closeCounter);
   if(range.waitFar!==state.waitFar)this.generatorState.set(record.id,{...state,waitFar:range.waitFar});
   if(!range.eligible)return false;
   return flags.ignorePopulationLimit||parked<parkedLimit;
  }).sort((a,b)=>Math.hypot(a.position[0]-p.x,-a.position[1]-p.z)-Math.hypot(b.position[0]-p.x,-b.position[1]-p.z));
  const groundAt=(record:WorldCarGenerator)=>{
   const [x,y,z]=record.position,top=z>-100?z+1:1000;
   return this.sim.world.castRay(new RAPIER.Ray({x,y:top,z:-y},{x:0,y:-1,z:0}),top+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  };
  const planeRecord=candidates.find(record=>PLAYABLE_PLANES[record.modelId]&&groundAt(record));
  if(planeRecord&&this.planes.size<3){this.busy=true;this.attempted.add(planeRecord.id);void this.spawnPlane(planeRecord.modelId,planeRecord.position[0],-planeRecord.position[1],planeRecord.angle).catch(error=>this.failures.set(planeRecord.id,String(error))).finally(()=>{this.busy=false;});return;}
  if(this.cars.size>=9)return;
  const record=candidates.find(record=>isBuildableCar(catalog,catalog.definitions.find(v=>v.id===record.modelId))&&groundAt(record))
   ??this.randomParkedRecord(candidates,groundAt);
  if(!record)return;
  // Query around the native elevation so bridges/garages keep their own floor.
  const [x,nativeY,nativeZ]=record.position,z=-nativeY,top=nativeZ>-100?nativeZ+1:1000;
  const ground=()=>groundAt(record);
  this.busy=true;this.attempted.add(record.id);
  void loadFixedWorldCar(catalog,record).then(assets=>{
   if(this.disposed)return;
   // A fresh random pick longer than 8 units (its bounding box's y extent) is dropped, to be picked again.
   const random=this.randomModels.get(record.id);
   if(random&&!random.colours){const b=assets.collision.bounds;if(b.max[1]-b.min[1]>8){this.randomModels.delete(record.id);return;}}
   if(Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>=GENERATOR_RANGE+5){this.attempted.delete(record.id);return;}
   const hit=ground();if(!hit){this.attempted.delete(record.id);return;}
   // Something stands where the car would go: try again 4 ms on, once the player has been far away.
   if(this.blocked(record.position,assets.collision.bounds)){const state=this.generatorState.get(record.id)??{nextGen:0,waitFar:false};this.generatorState.set(record.id,{nextGen:state.nextGen+4,waitFar:true});return;}
   const angle=Math.trunc(record.angle*256/(Math.PI*2))*Math.PI*2/256;
   const car=new WorldCar(this.sim,this.scene,assets,{x,y:top-hit.timeOfImpact-assets.collision.bounds.min[2],z},this.road,angle);car.fadeIn();car.otherCar=handle=>this.carByBody(handle);
   car.playerVehicle=()=>this.occupied;car.waterLevel=this.waterLevel;car.locked=rollDoorLock(record.doorLockChance);car.alarmArmed=rollAlarm(record.alarmChance);{const c=assets.colourIndices;if(random&&!random.colours&&c)random.colours=[c[0],c[1]];}this.cars.add(car);this.generated.set(car,record.id);this.generatorState.set(record.id,{nextGen:now+4,waitFar:this.generatorState.get(record.id)?.waitFar??false});record.spent?.();
  }).catch(error=>{if(!this.disposed)this.failures.set(record.id,error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;this.attempted.delete(record.id);});
 }
 dispose(){this.disposed=true;for(const plane of this.planes)plane.dispose();this.planes.clear();for(const boat of this.boats)boat.dispose();this.boats.clear();for(const bike of this.bikes)bike.dispose();this.bikes.clear();for(const car of this.cars)car.dispose();this.cars.clear();this.generated.clear();this.catalog=undefined;}
}
