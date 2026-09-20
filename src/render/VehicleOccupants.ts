import {Vector3,type Scene} from 'three';
import {openWorldPedestrians} from '../assets/worldPedestrians';
import type {NativeAnimation} from '../assets/ifp';
import {modelObject} from '../assets/ModelObjects';
import {NativeCharacter,type CharacterSource} from './NativeCharacter';
import type {WorldCar} from '../simulation/WorldCar';
/** Native front-seat dummy is mirrored for the driver, as in GetSeatPositionInVehicle. */
export function driverSeat(car:WorldCar){const dummy=car.car.root.getObjectByName('ped_frontseat');if(!dummy)return;car.car.root.updateWorldMatrix(true,true);const seat=car.car.root.worldToLocal(dummy.getWorldPosition(new Vector3()));seat.x=-Math.abs(seat.x);return seat;}
/** One NPC in or leaving a car: a civilian roster index or a named pedestrian model, pinned in native car space. */
export interface OccupantPose {key:string;car:WorldCar;model:number|string;local:{x:number;y:number;z:number};clip:string;seconds:number;animation?:NativeAnimation;gun?:{model:Parameters<typeof modelObject>[0];textures:Parameters<typeof modelObject>[1]}}
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
 private assigned=new Map<number,number|string>();
 /** The pedestrian model a car's driver uses, shared with the ped that leaves it: chosen from the zone roster when
  * the car first shows a driver, the packaged roster index by car model otherwise. */
 driverModel(car:WorldCar){
  const handle=car.car.body.handle,known=this.assigned.get(handle);if(known!==undefined)return known;
  const model=this.pickDriver?.(car)??(this.catalog?car.modelId%this.catalog.models.length:0);
  this.assigned.set(handle,model);return model;
 }
 /** CAR_sit in the driver's seat of every NPC-driven car not handled elsewhere. */
 drivers(cars:Iterable<WorldCar>,skip:(car:WorldCar)=>boolean=()=>false):OccupantPose[]{
  return [...cars].filter(c=>!!c.autopilot&&!c.occupied&&!c.wrecked&&!c.driverOut&&!skip(c)).flatMap(car=>{const seat=car.seat('left');return seat?[{key:`driver:${car.car.body.handle}`,car,model:this.driverModel(car),local:seat,clip:'car_sit',seconds:0}]:[];});
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
  if(this.assigned.size>64){const live=new Set(poses.map(p=>p.car.car.body.handle));for(const handle of [...this.assigned.keys()])if(!live.has(handle))this.assigned.delete(handle);}
  for(const pose of poses){
   let entry=this.views.get(pose.key);
   if(entry&&(entry.model!==pose.model||(entry.gun?.model??null)!==(pose.gun?.model??null))){entry.gun?.dispose();entry.view.dispose();this.views.delete(pose.key);entry=undefined;}
   if(!entry){const source=this.source(pose.model);if(!source)continue;const view=new NativeCharacter(source);view.installVehicleClips(Object.fromEntries(['car_sit','car_sitp'].filter(n=>catalog.animations[n]).map(n=>[n,catalog.animations[n]])));this.scene.add(view.root);entry={view,model:pose.model};this.views.set(pose.key,entry);}
   const {view}=entry;view.setAmbient(ambient);view.setNight(night);
   if(pose.animation)view.installVehicleClips({[pose.clip]:pose.animation});
   // Drive-by shooters keep their gun in the firing hand (officer pattern).
   if(pose.gun&&!entry.gun){
    const gun=modelObject(pose.gun.model,pose.gun.textures);gun.root.rotation.set(0,0,0);
    gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&pose.gun!.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});
    view.hand()?.add(gun.root);entry.gun={model:pose.gun.model,root:gun.root,dispose:()=>gun.dispose()};
   }else if(!pose.gun&&entry.gun){entry.gun.dispose();entry.gun=undefined;}
   view.updateVehicle({vehicle:pose.car.car.root,local:pose.local},{clip:pose.clip,seconds:pose.seconds});
  }
 }
 snapshot(){return {drivers:this.views.size,ready:!!this.catalog,error:this.error??null};}
 dispose(){this.disposed=true;for(const {view,gun} of this.views.values()){gun?.dispose();view.dispose();}this.views.clear();}
}
