import {resolveCarColors} from '../assets/carColors';
import {WorldPlane,PLAYABLE_PLANES} from './WorldPlane';
import {worldZoneAt,worldLevelAt,type WorldZones} from '../assets/worldZones';
import RAPIER from '@dimforge/rapier3d-compat';
import type {Scene} from 'three';
import type {Simulation} from './Simulation';
import {WorldCar} from './WorldCar';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {loadFixedWorldCar,FIXED_CAR_HANDLING_IDS} from '../assets/fixedWorldCar';
import type {WorldCarGenerator} from '../assets/worldCarGenerators';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
/** Bounded browser lifecycle for native fixed-model parked cars. Native generator
 * scheduling/population RNG, alarms and locks are not yet simulated. */
export class WorldFleet {
 readonly cars=new Set<WorldCar>();
 readonly planes=new Set<WorldPlane>();
 private catalogReady:Promise<Awaited<ReturnType<typeof openStaticWorldVehicles>>>;
 private zones?:WorldZones;
 private currentZone?:{infoLabel:string;textLabel:string;zoneInfoIndex:number;level:number;populationType?:number};
 setZones(zones:WorldZones){this.zones=zones;}
 private records:readonly WorldCarGenerator[]=[];
 private attempted=new Set<string>();
 private generated=new Map<WorldCar,string>();
 private failures=new Map<string,string>();
 private busy=false;
 private disposed=false;
 private nextCheck=0;
 private catalog?:Awaited<ReturnType<typeof openStaticWorldVehicles>>;
 constructor(private sim:Simulation,private scene:Scene,private road:Awaited<ReturnType<typeof loadWorldRoadMaterials>>,starter:WorldCar|undefined,base:string){
  if(starter)this.cars.add(starter);
  this.catalogReady=openStaticWorld(base).then(openStaticWorldVehicles);
  void this.catalogReady.then(catalog=>{if(!this.disposed)this.catalog=catalog;}).catch(error=>this.failures.set('catalog',String(error)));
 }
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
  const plane=new WorldPlane(this.sim,this.scene,assets,{x,y:1000-groundDistance-assets.collision.bounds.min[2]+1,z},heading,resolveCarColors(catalog.colors,assets.vehicle.model,0).colors);this.planes.add(plane);return plane;
 }
 get occupied(){return [...this.cars].find(car=>car.occupied);}
 nearest(){return this.occupied??[...this.cars].sort((a,b)=>a.distance()-b.distance())[0];}
 snapshot(){return {planes:[...this.planes].map(p=>p.snapshot()),zone:this.currentZone??null,records:this.records.length,pending:this.busy,failures:[...this.failures].map(([id,message])=>({id,message})),cars:[...this.cars].map(car=>({id:this.generated.get(car)??'starter',modelId:car.modelId,name:car.name,occupied:car.occupied,position:{...car.car.body.translation()}}))};}
 update(now:number){
  if(this.disposed||now<this.nextCheck)return;this.nextCheck=now+500;
  if(this.zones){const p=this.sim.player.position,point:[number,number,number]=[p.x,-p.z,p.y],zone=worldZoneAt(this.zones,point);this.currentZone={infoLabel:zone.infoLabel,textLabel:zone.textLabel,zoneInfoIndex:zone.zoneInfoIndex,level:worldLevelAt(this.zones,point),populationType:this.zones.population?.[zone.zoneInfoIndex]?.popType};}
  // Keep the occupied car and starter. Released native cars retire outside the
  // loaded neighborhood; a generator is used once per browser session.
  for(const [car] of this.generated)if(!car.occupied&&car.distance()>140){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  for(const plane of this.planes)if(!plane.occupied&&plane.distance()>350){plane.dispose();this.planes.delete(plane);}
  if(this.busy||!this.catalog||this.cars.size+this.planes.size>=8)return;
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
   this.cars.add(car);this.generated.set(car,record.id);
  }).catch(error=>{if(!this.disposed)this.failures.set(record.id,error instanceof Error?error.message:String(error));}).finally(()=>{this.busy=false;});
 }
 dispose(){this.disposed=true;for(const plane of this.planes)plane.dispose();this.planes.clear();for(const car of this.cars)car.dispose();this.cars.clear();this.generated.clear();this.catalog=undefined;}
}
