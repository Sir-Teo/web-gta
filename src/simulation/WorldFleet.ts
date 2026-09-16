import {resolveCarColors} from '../assets/carColors';
import {WorldPlane,PLAYABLE_PLANES} from './WorldPlane';
import {WorldBoat,PLAYABLE_BOATS} from './WorldBoat';
import {worldZoneAt,worldLevelAt,type WorldZones} from '../assets/worldZones';
import RAPIER from '@dimforge/rapier3d-compat';
import type {Scene} from 'three';
import type {Simulation} from './Simulation';
import {WorldCar} from './WorldCar';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {loadFixedWorldCar,FIXED_CAR_HANDLING_IDS} from '../assets/fixedWorldCar';
import {rollDoorLock} from '../assets/worldCarGenerators';
import {populationCycleAt} from '../assets/populationCycle';
import type {WorldCarGenerator} from '../assets/worldCarGenerators';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
/** Bounded browser lifecycle for native fixed-model parked cars. Native generator
 * scheduling/population RNG, alarms and locks are not yet simulated. */
export class WorldFleet {
 readonly cars=new Set<WorldCar>();
 readonly planes=new Set<WorldPlane>();
 readonly boats=new Set<WorldBoat>();
 private catalogReady:Promise<Awaited<ReturnType<typeof openStaticWorldVehicles>>>;
 private zones?:WorldZones;
 private currentZone?:{infoLabel:string;textLabel:string;zoneInfoIndex:number;level:number;populationType?:number};
 setZones(zones:WorldZones){this.zones=zones;}
  /** Native-coordinate WATER.DAT height query shared with spawned aircraft. */
  waterLevel?:(x:number,y:number)=>number|undefined;
  /** Native popcycle traffic models for the current zone and clock, cycling deterministically;
   * the fixed trio covers missing zones, calendars and unloadable models. Day is an authored
   * Wednesday (the world clock has no weekday); group weights select membership only. */
  trafficModel(){
   const catalog=this.catalog,zone=this.currentZone;
   let models:number[]|undefined;
   const popType=zone?.populationType;
   if(catalog&&Number.isInteger(popType)&&popType!>=0&&popType!<20){
    try{models=[...catalog.populationCarModelsAt(popType!,3,Math.floor(this.sim.timeMinutes/60)%24)].filter(id=>{const v=catalog.definitions.find(v=>v.id===id);return v?.type==='car'&&FIXED_CAR_HANDLING_IDS[v.handling]!==undefined;});}catch{models=undefined;}
   }
   const pool=models?.length?models:[492,404,551];
   return pool[(this.trafficCursor++)%pool.length];
  }
  private trafficCursor=0;
  private popRow(){
   const catalog=this.catalog,popType=this.currentZone?.populationType;
   if(!catalog||!Number.isInteger(popType)||popType!<0||popType!>=20)return undefined;
   try{return populationCycleAt(catalog.populationCycle,popType!,3,Math.floor(this.sim.timeMinutes/60)%24);}catch{return undefined;}
  }
  /** Popcycle density caps for the current zone and clock (authored Wednesday and
   * browser ceilings of 24 civilians / 30 total; AddToPopulation is not reversed). */
  pedLimits(){
   const row=this.popRow();
   if(!row)return undefined;
   const civilians=Math.min(24,row.maxPeds);
   return {civilians,total:Math.min(30,civilians+6)};
  }
  /** Ambient traffic driver cap from the popcycle car budget (authored mapping, ceiling 5). */
  trafficDrivers(){
   const row=this.popRow();
   if(!row)return undefined;
   return Math.max(2,Math.min(5,Math.round(row.maxCars/3)));
  }
 private records:readonly WorldCarGenerator[]=[];
 private attempted=new Set<string>();
 private generated=new Map<WorldCar,string>();
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
 async spawnTrafficCar(modelId:number,position:{x:number;y:number;z:number},heading:number){
  const catalog=await this.catalogReady;
  const assets=await loadFixedWorldCar(catalog,{modelId,primaryColor:-1,secondaryColor:-1});
  if(this.disposed)throw new Error('World fleet disposed.');
  // Asset loading can cross a terrain-streaming update; recheck support and
  // spawn clearance immediately before allocating physics and render resources.
  const top=position.y+3,hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({...position,y:top},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  if(!hit||hit.normal.y<.8)return;
  const ground=top-hit.timeOfImpact,rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};
  if(this.sim.world.intersectionWithShape({...position,y:ground+1},rotation,new RAPIER.Cuboid(1,.8,2.5)))return;
   const car=new WorldCar(this.sim,this.scene,assets,{...position,y:ground-assets.collision.bounds.min[2]+.1},this.road,heading);
   car.trafficOrigin=true;car.playerVehicle=()=>this.occupied;car.waterLevel=this.waterLevel;this.cars.add(car);return car;
 }
 removeTrafficCar(car:WorldCar){if(car.trafficOrigin&&this.cars.delete(car))car.dispose();}
 setGenerators(records:readonly WorldCarGenerator[]){this.records=records;}
 get occupiedPlane(){return [...this.planes].find(plane=>plane.occupied);}
 nearestPlane(){return this.occupiedPlane??[...this.planes].sort((a,b)=>a.distance()-b.distance())[0];}
 async spawnPlane(modelId:number,x:number,z:number,heading:number){
  const catalog=await this.catalogReady,assets=await catalog.load(modelId);if(this.disposed)throw new Error('World fleet disposed.');
  // Direct collider queries also see terrain installed while the simulation is paused.
  let groundDistance=Infinity;const ray=new RAPIER.Ray({x,y:1000,z},{x:0,y:-1,z:0});
  this.sim.world.forEachCollider(c=>{if(!c.isEnabled()||c.parent()&&!c.parent()!.isFixed())return;const hit=c.castRayAndGetNormal(ray,Math.min(2000,groundDistance),true);if(hit)groundDistance=Math.min(groundDistance,hit.timeOfImpact);});
  if(!Number.isFinite(groundDistance))throw new Error('No runway terrain beneath the plane.');
  if(!assets.collision)throw new Error('Missing plane collision.');
  const plane=new WorldPlane(this.sim,this.scene,assets,{x,y:1000-groundDistance-assets.collision.bounds.min[2]+1,z},heading,resolveCarColors(catalog.colors,assets.vehicle.model,0).colors);plane.waterLevel=this.waterLevel;this.planes.add(plane);return plane;
 }
 get occupied(){return [...this.cars].find(car=>car.occupied);}
 nearest(){return this.occupied??[...this.cars].sort((a,b)=>a.distance()-b.distance())[0];}
 get occupiedBoat(){return [...this.boats].find(boat=>boat.occupied);}
 nearestBoat(){return this.occupiedBoat??[...this.boats].sort((a,b)=>a.distance()-b.distance())[0];}
 private boatCursor=0;
 async spawnBoat(modelId:number,x:number,z:number,heading:number){
  const catalog=await this.catalogReady,assets=await catalog.load(modelId);if(this.disposed)throw new Error('World fleet disposed.');
  if(assets.vehicle.type!=='boat')throw new Error('Not a boat definition.');
  const boat=new WorldBoat(this.sim,this.scene,assets,{x,y:1,z},heading);boat.waterLevel=this.waterLevel;this.boats.add(boat);return boat;
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
  snapshot(){return {planes:[...this.planes].map(p=>p.snapshot()),boats:[...this.boats].map(b=>b.snapshot()),zone:this.currentZone??null,records:this.records.length,pending:this.busy,failures:[...this.failures].map(([id,message])=>({id,message})),cars:[...this.cars].map(car=>({id:this.generated.get(car)??(car.trafficOrigin?`traffic:${car.car.body.handle}`:'starter'),modelId:car.modelId,name:car.name,health:car.health,wrecked:car.wrecked,locked:car.locked,onFire:car.onFire,damage:{panels:[...car.damageState.panels],doors:[...car.damageState.doors]},autopilot:!!car.autopilot,occupied:car.occupied,position:{...car.car.body.translation()}}))};}
 update(now:number){
  if(this.disposed||now<this.nextCheck)return;this.nextCheck=now+500;
  if(this.zones){const p=this.sim.player.position,point:[number,number,number]=[p.x,-p.z,p.y],zone=worldZoneAt(this.zones,point);this.currentZone={infoLabel:zone.infoLabel,textLabel:zone.textLabel,zoneInfoIndex:zone.zoneInfoIndex,level:worldLevelAt(this.zones,point),populationType:this.zones.population?.[zone.zoneInfoIndex]?.popType};}
  // Keep the occupied car and starter. Released native cars retire outside the
  // loaded neighborhood; a generator is used once per browser session.
  for(const [car] of this.generated)if(!car.occupied&&car.distance()>140){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  for(const plane of this.planes)if(!plane.occupied&&plane.distance()>350){plane.dispose();this.planes.delete(plane);}
  for(const boat of this.boats)if(!boat.occupied&&boat.distance()>350){boat.dispose();this.boats.delete(boat);}
  if(this.busy||!this.catalog||this.cars.size+this.planes.size+this.boats.size>=9)return;
  // One runabout on open water near the shore when the player roams without one.
  if(!this.boats.size&&!this.occupiedBoat){
   const spot=this.boatWaterSpot();
   if(spot){const models=Object.keys(PLAYABLE_BOATS).map(Number),model=models[(this.boatCursor++)%models.length];this.busy=true;void this.spawnBoat(model,spot.x,spot.z,0).catch(error=>{if(!this.disposed)this.failures.set(`boat:${model}`,error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;});return;}
  }
  const p=this.sim.player.position,catalog=this.catalog;
  const candidates=this.records.filter(record=>!this.attempted.has(record.id)&&Math.hypot(record.position[0]-p.x,-record.position[1]-p.z)<75).sort((a,b)=>Math.hypot(a.position[0]-p.x,-a.position[1]-p.z)-Math.hypot(b.position[0]-p.x,-b.position[1]-p.z));
  const groundAt=(record:WorldCarGenerator)=>{
   const [x,y,z]=record.position,top=z>-100?z+1:1000;
   return this.sim.world.castRay(new RAPIER.Ray({x,y:top,z:-y},{x:0,y:-1,z:0}),top+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  };
  const planeRecord=candidates.find(record=>PLAYABLE_PLANES[record.modelId]&&groundAt(record));
  if(planeRecord&&this.planes.size<3){this.busy=true;this.attempted.add(planeRecord.id);void this.spawnPlane(planeRecord.modelId,planeRecord.position[0],-planeRecord.position[1],planeRecord.angle).catch(error=>this.failures.set(planeRecord.id,String(error))).finally(()=>{this.busy=false;});return;}
  if(this.cars.size>=6)return;
  const record=candidates.find(record=>{const v=catalog.definitions.find(v=>v.id===record.modelId);return v?.type==='car'&&FIXED_CAR_HANDLING_IDS[v.handling]!==undefined&&groundAt(record);});
  if(!record)return;
  // Query around the native elevation so bridges/garages keep their own floor.
  const [x,nativeY,nativeZ]=record.position,z=-nativeY,top=nativeZ>-100?nativeZ+1:1000;
  const ground=()=>groundAt(record);
  this.busy=true;this.attempted.add(record.id);
  void loadFixedWorldCar(catalog,record).then(assets=>{
   if(this.disposed)return;
   if(Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>=75){this.attempted.delete(record.id);return;}
   const hit=ground();if(!hit){this.attempted.delete(record.id);return;}
   const angle=Math.trunc(record.angle*256/(Math.PI*2))*Math.PI*2/256;
   const car=new WorldCar(this.sim,this.scene,assets,{x,y:top-hit.timeOfImpact-assets.collision.bounds.min[2],z},this.road,angle);
   car.playerVehicle=()=>this.occupied;car.waterLevel=this.waterLevel;car.locked=rollDoorLock(record.doorLockChance);this.cars.add(car);this.generated.set(car,record.id);
  }).catch(error=>{if(!this.disposed)this.failures.set(record.id,error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;});
 }
 dispose(){this.disposed=true;for(const plane of this.planes)plane.dispose();this.planes.clear();for(const boat of this.boats)boat.dispose();this.boats.clear();for(const car of this.cars)car.dispose();this.cars.clear();this.generated.clear();this.catalog=undefined;}
}
