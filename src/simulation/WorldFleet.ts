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
 private zones?:WorldZones;
 private currentZone?:{infoLabel:string;textLabel:string;zoneInfoIndex:number;level:number};
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
  void openStaticWorld(base).then(openStaticWorldVehicles).then(catalog=>{if(!this.disposed)this.catalog=catalog;}).catch(error=>this.failures.set('catalog',String(error)));
 }
 setGenerators(records:readonly WorldCarGenerator[]){this.records=records;}
 get occupied(){return [...this.cars].find(car=>car.occupied);}
 nearest(){return this.occupied??[...this.cars].sort((a,b)=>a.distance()-b.distance())[0];}
 snapshot(){return {zone:this.currentZone??null,records:this.records.length,pending:this.busy,failures:[...this.failures].map(([id,message])=>({id,message})),cars:[...this.cars].map(car=>({id:this.generated.get(car)??'starter',modelId:car.modelId,name:car.name,occupied:car.occupied,position:{...car.car.body.translation()}}))};}
 update(now:number){
  if(this.disposed||now<this.nextCheck)return;this.nextCheck=now+500;
  if(this.zones){const p=this.sim.player.position,point:[number,number,number]=[p.x,-p.z,p.y],zone=worldZoneAt(this.zones,point);this.currentZone={infoLabel:zone.infoLabel,textLabel:zone.textLabel,zoneInfoIndex:zone.zoneInfoIndex,level:worldLevelAt(this.zones,point)};}
  // Keep the occupied car and starter. Released native cars retire outside the
  // loaded neighborhood; a generator is used once per browser session.
  for(const [car] of this.generated)if(!car.occupied&&car.distance()>140){this.cars.delete(car);this.generated.delete(car);car.dispose();}
  if(this.busy||!this.catalog||this.cars.size>=6)return;
  const p=this.sim.player.position,catalog=this.catalog;
  const candidates=this.records.filter(record=>!this.attempted.has(record.id)&&Math.hypot(record.position[0]-p.x,-record.position[1]-p.z)<75).sort((a,b)=>Math.hypot(a.position[0]-p.x,-a.position[1]-p.z)-Math.hypot(b.position[0]-p.x,-b.position[1]-p.z));
  const groundAt=(record:WorldCarGenerator)=>{
   const [x,y,z]=record.position,top=z>-100?z+1:1000;
   return this.sim.world.castRay(new RAPIER.Ray({x,y:top,z:-y},{x:0,y:-1,z:0}),top+1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  };
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
 dispose(){this.disposed=true;for(const car of this.cars)car.dispose();this.cars.clear();this.generated.clear();this.catalog=undefined;}
}
