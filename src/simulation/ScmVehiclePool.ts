import {requireAsset} from '../assets/binary';
import {ScmEntityPool} from './ScmEntityPool';
/* The cars a script creates, held for a browser whose spawning is asynchronous.
 *
 * CCarCtrl::CreateCarForScript hands the script a handle immediately, and the script uses it on the very next
 * instruction: it sets a heading, locks the doors, marks the car as no longer needed. The browser cannot build
 * a car that fast, because the model has to be streamed first. ScmEntityPool carries the handle across that
 * gap; what is here is the part that is a car's, which is where it is and which way it faces. */
export interface ScmVehiclePoolHost<Car>{
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
/** What the script said about a car, which answers for it until the browser has built one. */
interface ScriptCar<Car>{model:number|string;position:{x:number;y:number;z:number};heading:number;moved:boolean;
 /** For a move made before the car was built: how far its own model lifts it off the point, known on arrival. */
 lift?:(car:Car)=>number}
export class ScmVehiclePool<Car>{
 private readonly pool:ScmEntityPool<Car>;
 private readonly said=new Map<number,ScriptCar<Car>>();
 constructor(private readonly host:ScmVehiclePoolHost<Car>,first=1){this.pool=new ScmEntityPool(host,first);}
 get count(){return this.pool.count;}
 /** The handles the script holds, in the order it was given them. */
 get handles(){return this.pool.handles;}
 /** CREATE_CAR: the handle comes back at once and the car follows. */
 create(model:number|string,position:{x:number;y:number;z:number},heading=0,spawn?:()=>Promise<Car|undefined>){
  requireAsset([position.x,position.y,position.z,heading].every(Number.isFinite),'Invalid script car placement.');
  const said:ScriptCar<Car>={model,position:{...position},heading,moved:false};
  const handle=this.pool.create(spawn??(()=>this.host.spawn(model,{...said.position},said.heading)));
  this.said.set(handle,said);
  return handle;
 }
 /** Handles given to vehicles the script did not make, which go once their vehicle has: a handle whose vehicle is
  * gone names nothing whether or not its record stays, so the pool does not grow with every car the player drives. */
 private readonly adopted=new Set<number>();
 /** The handle for a vehicle the browser made itself (a train's carriage, the car the player took), made the first
  * time it is asked for. */
 handleFor(entity:Car,model:number|string){
  const known=this.pool.handleOf(entity);if(known!==undefined)return known;
  for(const old of this.adopted)if(!this.pool.exists(old)){this.adopted.delete(old);this.pool.forget(old);this.said.delete(old);}
  const handle=this.pool.adopt(entity);this.adopted.add(handle);
  this.said.set(handle,{model,position:this.host.positionOf(entity),heading:this.host.headingOf(entity),moved:false});
  return handle;
 }
 private word(handle:number){const said=this.said.get(handle);requireAsset(said,'Script car handle names nothing.');return said!;}
 /** DOES_VEHICLE_EXIST: a handle the script still holds whose car has not failed and has not gone. */
 exists(handle:number){return this.pool.exists(handle);}
 /** The car once its making has settled (CREATE_CHAR_INSIDE_CAR on a car still being built waits for it). */
 whenSettled(handle:number){return this.pool.whenSettled(handle);}
 /** The browser's own car, once it has built one. */
 entity(handle:number){return this.pool.entity(handle);}
 /** The handle that names that entity, or nothing when no handle does. */
 handleOf(entity:unknown){return this.pool.handleOf(entity as never);}
 /** Whether the making has finished, whether or not it produced anything. */
 settledFor(handle:number){return this.pool.settled(handle);}
 /** GET_CAR_MODEL: the model the script asked for, which is the one the car was made from. */
 modelOf(handle:number){return this.word(handle).model;}
 /** Where the car is: its own place once it exists, and what the script last set until then. */
 positionOf(handle:number){const said=this.word(handle);return this.pool.read(handle,car=>this.host.positionOf(car),()=>({...said.position}));}
 headingOf(handle:number){const said=this.word(handle);return this.pool.read(handle,car=>this.host.headingOf(car),()=>said.heading);}
 /** SET_CAR_COORDINATES: the car moves and keeps the heading it has now, not the one the script last gave it.
  * `lift`, for a car not built yet, is the rise off the point that only the arrived car's model can say
  * (GetDistanceFromCentreOfMassToBaseOfModel); without it the car went down with its wheels in the road. */
 setPosition(handle:number,position:{x:number;y:number;z:number},lift?:(car:Car)=>number){
  const said=this.said.get(handle);if(!said)return;
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid script car position.');
  said.heading=this.headingOf(handle);said.position={...position};said.moved=true;said.lift=this.pool.entity(handle)?undefined:lift;this.replace(handle,said);
 }
 /** SET_CAR_HEADING (CPlaceable::SetHeading): the car turns where it stands now, not where the script last put it. */
 setHeading(handle:number,heading:number){
  const said=this.said.get(handle);if(!said)return;
  requireAsset(Number.isFinite(heading),'Invalid script car heading.');
  said.heading=heading;
  // A car still being built that the script has not moved turns, on arrival, where its spawning set it down. The
  // point CREATE_CAR named is on the ground, not lifted off the base of the model: putting the car back there
  // sank its wheels into the road, and INTRO1's BMX, turned the instruction after it was made, was thrown on its
  // end against the alley's ledge and could not be ridden.
  if(!said.moved&&!this.pool.entity(handle)){this.pool.apply(handle,car=>{this.host.place(car,this.host.positionOf(car),heading);});return;}
  said.position=this.positionOf(handle);said.moved=true;this.replace(handle,said);
 }
 /* A car nobody has touched keeps the placement its own spawning chose, which is the one settled on the ground
  * and lifted off the base of the model, as CCarCtrl::CreateCarForScript leaves it; the raw point the script
  * named is not that placement, so it is not re-applied. */
 private replace(handle:number,said:ScriptCar<Car>){
  if(said.moved)this.pool.apply(handle,car=>{const up=said.lift?.(car)??0;this.host.place(car,{...said.position,z:said.position.z+up},said.heading);});
 }
 /** DELETE_CAR: the car goes now if it is here, and is refused on arrival if it is not. */
 delete(handle:number){this.pool.delete(handle);this.said.delete(handle);}
 /** MARK_CAR_AS_NO_LONGER_NEEDED: the car stays in the world for the streamer to reclaim, and the script stops
  * being able to address it. */
 markNoLongerNeeded(handle:number){this.pool.markNoLongerNeeded(handle);this.said.delete(handle);}
}
