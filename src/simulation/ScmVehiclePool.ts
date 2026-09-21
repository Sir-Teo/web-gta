import {requireAsset} from '../assets/binary';
/* The cars a script creates, held for a browser whose spawning is asynchronous.
 *
 * CCarCtrl::CreateCarForScript hands the script a handle immediately, and the script uses it on the very next
 * instruction: it sets a heading, locks the doors, marks the car as no longer needed. The browser cannot build
 * a car that fast, because the model has to be streamed first. So a handle is allocated at once and the car
 * arrives later, and everything the script says in between is remembered against the handle and applied when it
 * does. Reading back before it arrives gives what the script itself last set, which is what a synchronous
 * engine would have given, rather than a hole.
 *
 * A handle whose car never arrives, because the model does not exist or the spawn failed, stops existing: the
 * script's own DOES_VEHICLE_EXIST then answers no, which is the answer the original gives for a car it could
 * not make. */
export interface ScmPooledVehicle<Car> {
 handle:number;model:number|string;
 /** What the script asked for, kept whether or not the car has arrived. */
 position:{x:number;y:number;z:number};heading:number;
 /** The browser's own car once it exists, or nothing while it is still being made or after it failed. */
 car?:Car;
 /** Whether the spawn finished, and whether it produced a car. */
 settled:boolean;failed:boolean;
 /** Whether the script has deleted it, or let the streamer take it back. */
 deleted:boolean;noLongerNeeded:boolean;
 /** Whether the script has moved or turned it since it asked for it, which a car that has not yet arrived has
  * to be told about once it has. A car nobody has touched keeps the place its own spawning chose, which is the
  * one CCarCtrl::CreateCarForScript settles on the ground rather than the raw point the script named. */
 moved:boolean;
}
export interface ScmVehiclePoolHost<Car> {
 /** Build the car the script asked for, or nothing when it cannot be made. */
 spawn(model:number|string,position:{x:number;y:number;z:number},heading:number):Promise<Car|undefined>;
 /** Put an existing car where the script says, and point it where the script says. */
 place(car:Car,position:{x:number;y:number;z:number},heading:number):void;
 /** Where the car actually is, which is not where the script put it once it has been driven. */
 positionOf(car:Car):{x:number;y:number;z:number};
 headingOf(car:Car):number;
 /** Whether the browser still holds it, and how to let it go. */
 aliveOf(car:Car):boolean;
 remove(car:Car):void;
}
export class ScmVehiclePool<Car> {
 private readonly vehicles=new Map<number,ScmPooledVehicle<Car>>();
 private next=1;
 constructor(private readonly host:ScmVehiclePoolHost<Car>){}
 get count(){return this.vehicles.size;}
 get all():readonly ScmPooledVehicle<Car>[]{return [...this.vehicles.values()];}
 /** CREATE_CAR: the handle comes back at once and the car follows. */
 create(model:number|string,position:{x:number;y:number;z:number},heading=0){
  requireAsset([position.x,position.y,position.z,heading].every(Number.isFinite),'Invalid script car placement.');
  const handle=this.next++;
  const record:ScmPooledVehicle<Car>={handle,model,position:{...position},heading,settled:false,failed:false,
   deleted:false,noLongerNeeded:false,moved:false};
  this.vehicles.set(handle,record);
  void this.host.spawn(model,{...position},heading).then(car=>{
   record.settled=true;
   if(!car){record.failed=true;return;}
   // The script may have moved, turned or deleted it while the browser was still building it.
   if(record.deleted){this.host.remove(car);return;}
   record.car=car;
   if(record.moved)this.host.place(car,record.position,record.heading);
  }).catch(()=>{record.settled=true;record.failed=true;});
  return handle;
 }
 private at(handle:number){return this.vehicles.get(handle);}
 /** DOES_VEHICLE_EXIST: a handle the script still holds whose car has not failed and has not gone. */
 exists(handle:number){
  const record=this.at(handle);
  if(!record||record.deleted||record.failed)return false;
  return record.car?this.host.aliveOf(record.car):true;
 }
 /** Where the car is: its own place once it exists, and what the script last set until then. */
 positionOf(handle:number){
  const record=this.at(handle);
  requireAsset(record,'Script car handle names nothing.');
  return record!.car?this.host.positionOf(record!.car):{...record!.position};
 }
 headingOf(handle:number){
  const record=this.at(handle);
  requireAsset(record,'Script car handle names nothing.');
  return record!.car?this.host.headingOf(record!.car):record!.heading;
 }
 setPosition(handle:number,position:{x:number;y:number;z:number}){
  const record=this.at(handle);if(!record)return;
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid script car position.');
  record.position={...position};record.moved=true;
  if(record.car)this.host.place(record.car,record.position,record.heading);
 }
 setHeading(handle:number,heading:number){
  const record=this.at(handle);if(!record)return;
  requireAsset(Number.isFinite(heading),'Invalid script car heading.');
  record.heading=heading;record.moved=true;
  if(record.car)this.host.place(record.car,record.position,record.heading);
 }
 /** DELETE_CAR: the car goes now if it is here, and is refused on arrival if it is not. */
 delete(handle:number){
  const record=this.at(handle);if(!record)return;
  record.deleted=true;
  if(record.car){this.host.remove(record.car);record.car=undefined;}
  this.vehicles.delete(handle);
 }
 /** MARK_CAR_AS_NO_LONGER_NEEDED: the car stays in the world for the streamer to reclaim, and the script stops
  * being able to address it. */
 markNoLongerNeeded(handle:number){
  const record=this.at(handle);if(!record)return;
  record.noLongerNeeded=true;
  this.vehicles.delete(handle);
 }
}
