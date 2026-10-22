import {Vector3,type Scene} from 'three';
import {sitClip} from '../simulation/nativeDoor';
import {openWorldPedestrians} from '../assets/worldPedestrians';
import type {NativeAnimation} from '../assets/ifp';
import {modelObject} from '../assets/ModelObjects';
import {NativeCharacter,type CharacterSource} from './NativeCharacter';
import type {WorldCar} from '../simulation/WorldCar';
/** Native front-seat dummy is mirrored for the driver, as in GetSeatPositionInVehicle. */
export function driverSeat(car:WorldCar){const dummy=car.car.root.getObjectByName('ped_frontseat');if(!dummy)return;car.car.root.updateWorldMatrix(true,true);const seat=car.car.root.worldToLocal(dummy.getWorldPosition(new Vector3()));seat.x=-Math.abs(seat.x);return seat;}
/** One NPC in or leaving a car: a civilian roster index or a named pedestrian model, pinned in native car space. */
/** What an occupant sits on: the vehicle's root (renderer axes) and its body, a car's or a bike's. */
export interface OccupantVehicle {car:{root:import('three').Object3D;body:{handle:number}}}
export interface OccupantPose {key:string;car:OccupantVehicle;model:number|string;local:{x:number;y:number;z:number};clip:string;seconds:number;animation?:NativeAnimation;
 /** A turn about the vertical off the vehicle's own heading (an attached ped facing its side). */
 headingOffset?:number;scorched?:boolean;gun?:{model:Parameters<typeof modelObject>[0];textures:Parameters<typeof modelObject>[1]}}
/** NPC vehicle occupants: CAR_sit/CAR_sitp in their seats, or their exit clip while leaving. */
export class VehicleOccupants {
 private catalog?:Awaited<ReturnType<typeof openWorldPedestrians>>;
 private views=new Map<string,{view:NativeCharacter;model:number|string;gun?:{model:unknown;root:ReturnType<typeof modelObject>['root'];dispose:()=>void}}>();
 private named=new Map<string,CharacterSource>();
 private disposed=false;
 error?:string;
 constructor(private scene:Scene,base:string){void openWorldPedestrians(base).then(c=>{if(this.disposed)return;if(!c.animations.car_sit)throw new Error('Missing native driving pose.');this.catalog=c;}).catch(e=>this.error=String(e));}
 /** A zone roster's driver for a car (CPopulation::ChooseCivilianOccupationForVehicle), asked once per car. */
 pickDriver?:(car:WorldCar)=>string|undefined;
 /** Kept for as long as the car itself lives: a map pruned to the cars with a pose this frame let a car whose driver
  * was between his seat and the street (the frame his jacked clip ended) choose a new driver, so the man CJ pulled
  * out stood up as someone else. */
 private assigned=new WeakMap<WorldCar,number|string>();
 /** The pedestrian model a car's driver uses, shared with the ped that leaves it: chosen from the zone roster when
  * the car first shows a driver, the packaged roster index by car model otherwise. */
 driverModel(car:WorldCar){
  const known=this.assigned.get(car);if(known!==undefined)return known;
  const model=this.pickDriver?.(car)??(this.catalog?car.modelId%this.catalog.models.length:0);
  this.assigned.set(car,model);return model;
 }
 /** CAR_sit (CAR_Lsit in a low car) in the driver's seat of every NPC-driven car not handled elsewhere. */
 /** Drivers dead in their seats (CTaskSimpleDieInCar): CAR_dead_LHS held on its last frame. */
 private readonly deadInSeat=new WeakSet<WorldCar>();
 markDeadInSeat(car:WorldCar){this.deadInSeat.add(car);}
 drivers(cars:Iterable<WorldCar>,skip:(car:WorldCar)=>boolean=()=>false):OccupantPose[]{
  const dead=this.catalog?.animations.car_dead_lhs;
  return [...cars].filter(c=>!!c.autopilot&&!c.occupied&&!c.wrecked&&!c.driverOut&&!skip(c)).flatMap(car=>{const seat=car.seat('left');if(!seat)return [];
   if(this.deadInSeat.has(car)&&dead)return [{key:`driver:${car.car.body.handle}`,car,model:this.driverModel(car),local:seat,clip:'car_dead_lhs',seconds:dead.duration,animation:dead}];
   return [{key:`driver:${car.car.body.handle}`,car,model:this.driverModel(car),local:seat,clip:sitClip(car.modelFlags,true),seconds:0}];});
 }
 private source(model:number|string){
  const catalog=this.catalog!;if(typeof model==='number')return catalog.models[model%catalog.models.length];
  const loaded=this.named.get(model);if(!loaded)void catalog.character(model).then(source=>{if(!this.disposed)this.named.set(model,source);}).catch(e=>{this.error=String(e);});
  return loaded;
 }
 update(poses:readonly OccupantPose[],ambient:readonly number[]|undefined,night:number){
  const catalog=this.catalog;if(!catalog)return;
  const keys=new Set(poses.map(p=>p.key));
  for(const [key,entry] of this.views)if(!keys.has(key)){entry.gun?.dispose();entry.view.dispose();this.views.delete(key);}
  for(const pose of poses){
   let entry=this.views.get(pose.key);
   if(entry&&(entry.model!==pose.model||(entry.gun?.model??null)!==(pose.gun?.model??null))){entry.gun?.dispose();entry.view.dispose();this.views.delete(pose.key);entry=undefined;}
   if(!entry){const source=this.source(pose.model);if(!source)continue;const view=new NativeCharacter(source);view.installVehicleClips(Object.fromEntries(['car_sit','car_sitp','car_lsit','car_sitplo'].filter(n=>catalog.animations[n]).map(n=>[n,catalog.animations[n]])));this.scene.add(view.root);entry={view,model:pose.model};this.views.set(pose.key,entry);}
   const {view}=entry;view.setAmbient(ambient);view.setScorched(!!pose.scorched);view.setNight(night);
   if(pose.animation)view.installVehicleClips({[pose.clip]:pose.animation});
   else if(!view.hasVehicleClip(pose.clip)&&catalog.animations[pose.clip])view.installVehicleClips({[pose.clip]:catalog.animations[pose.clip]});
   // Drive-by shooters keep their gun in the firing hand (officer pattern).
   if(pose.gun&&!entry.gun){
    const gun=modelObject(pose.gun.model,pose.gun.textures);gun.root.rotation.set(0,0,0);
    gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&pose.gun!.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});
    view.hand()?.add(gun.root);entry.gun={model:pose.gun.model,root:gun.root,dispose:()=>gun.dispose()};
   }else if(!pose.gun&&entry.gun){entry.gun.dispose();entry.gun=undefined;}
   view.updateVehicle({vehicle:pose.car.car.root,local:pose.local,headingOffset:pose.headingOffset},{clip:pose.clip,seconds:pose.seconds});
  }
 }
 /** The head node of the occupant drawn under `key`, in the world (renderer axes), while it is drawn. */
 headOf(key:string){return this.views.get(key)?.view.headPosition();}
 snapshot(){return {drivers:this.views.size,ready:!!this.catalog,error:this.error??null};}
 dispose(){this.disposed=true;for(const {view,gun} of this.views.values()){gun?.dispose();view.dispose();}this.views.clear();}
}
