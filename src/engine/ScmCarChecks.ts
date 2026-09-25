/* CTheScripts' two car watches, pinned gta-reversed (UpsideDownCarCheck.cpp and StuckCarCheck.cpp, both reversed),
 * run by CTheScripts::Process before any script, once a frame.
 * - CUpsideDownCarCheck: six slots whose clocks count the time a car has spent upside down. The script reads them
 *   with IS_CAR_STUCK_ON_ROOF.
 * - CStuckCarCheck: sixteen slots.
 *   - Each checks every CheckTime whether a driven car has moved StuckRadius since the last check, which IS_CAR_STUCK
 *     reads.
 *   - The ones added WITH_WARP also put a car that is stuck, flipped or under water back on a road node out of sight.
 * The world is reached by vehicle handle, as the pools reach it. Positions are native (x east, y north, z up). */

/** A car the host can say these things about. */
export interface ScmCarCheckWorld {
 vehicleExists?(handle:number):boolean;
 vehiclePosition?(handle:number):{x:number;y:number;z:number};
 /** m_pDriver: someone at the wheel. */
 vehicleHasDriver?(handle:number):boolean;
 /** CUpsideDownCarCheck::IsCarUpsideDown. */
 vehicleIsUpsideDownForCheck?(handle:number):boolean;
 /** physicalFlags.bSubmergedInWater. */
 vehicleIsInWater?(handle:number):boolean;
 /** TheCamera.IsSphereVisible over the car's bounding sphere. */
 vehicleIsOnScreen?(handle:number):boolean;
 isSphereVisible?(point:{x:number;y:number;z:number},radius:number):boolean;
 pointIsObscuredByMissionEntity?(x:number,y:number,z:number,radiusX:number,radiusY:number,radiusZ:number):boolean;
 /** FindNodeCoorsForScript(m_currentAddress, m_startingRouteNode): the point on the car's own route, with its heading. */
 vehicleRouteNodeForScript?(handle:number):{x:number;y:number;z:number;heading:number}|undefined;
 /** FindNthNodeClosestToCoors(point, PATH_TYPE_VEH, 999999.88, …, nth) put through FindNodeCoorsForScript, with
  * FindNodeOrientationForCarPlacement's heading. */
 carPlacementNode?(point:{x:number;y:number;z:number},nth:number):{x:number;y:number;z:number;heading:number}|undefined;
 /** CCarCtrl::SetCoordsOfScriptCar(car, x, y, z, clear orientation, add the model's offset), then SetHeading. */
 warpVehicle?(handle:number,point:{x:number;y:number;z:number},headingDegrees:number):void;
}

interface UpsideDownCar {handle:number;time:number}
export const UPSIDE_DOWN_CAR_CHECK_SIZE=6;
/** CUpsideDownCarCheck::UPSIDE_DOWN_CAR_MIN_TIME. */
export const UPSIDE_DOWN_CAR_MIN_TIME=2000;

export class ScmUpsideDownCarCheck {
 readonly cars:UpsideDownCar[]=Array.from({length:UPSIDE_DOWN_CAR_CHECK_SIZE},()=>({handle:-1,time:0}));
 /** AddCarToCheck: the first free slot. (gta-reversed's reading has no break, filling every free slot, and an
  * UpdateTimers that leaves a vanished car's slot at 0, which AddCarToCheck never takes again; the check would stop
  * working after a frame. Vice City's, which reVC keeps, is followed.) */
 /** CUpsideDownCarCheck::Init: every slot free. */
 init(){for(const car of this.cars){car.handle=-1;car.time=0;}}
 add(handle:number){const car=this.cars.find(c=>c.handle<0);if(car){car.handle=handle;car.time=0;}}
 remove(handle:number){for(const car of this.cars)if(car.handle===handle){car.handle=-1;car.time=0;}}
 /** HasCarBeenUpsideDownForAWhile: the first slot with the car decides. */
 hasBeenUpsideDownForAWhile(handle:number){
  for(const car of this.cars)if(car.handle===handle)return car.time>UPSIDE_DOWN_CAR_MIN_TIME;
  return false;
 }
 /** UpdateTimers: a car upside down adds the frame's time to its clock and one the right way up starts it again; a
  * car that has gone frees its slot. */
 updateTimers(timeStepMs:number,world:ScmCarCheckWorld){
  for(const car of this.cars){
   if(car.handle<0)continue;
   if(world.vehicleExists?.(car.handle)){
    if(world.vehicleIsUpsideDownForCheck?.(car.handle))car.time=(car.time+Math.trunc(timeStepMs))>>>0;
    else car.time=0;
   }else{car.handle=-1;car.time=0;}
  }
 }
}

interface StuckCar {
 handle:number;lastPos:{x:number;y:number;z:number};lastChecked:number;stuckRadius:number;checkTime:number;
 carStuck:boolean;warpCar:boolean;warpIfStuck:boolean;warpIfFlipped:boolean;warpIfInWater:boolean;numberOfNodesToCheck:number;
}
export const STUCK_CAR_CHECK_SIZE=16;
const emptyStuckCar=():StuckCar=>({handle:-1,lastPos:{x:-5000,y:-5000,z:-5000},lastChecked:-1,stuckRadius:0,checkTime:0,
 carStuck:false,warpCar:false,warpIfStuck:false,warpIfFlipped:false,warpIfInWater:false,numberOfNodesToCheck:0});

export interface StuckCarWarp {stuck:boolean;flipped:boolean;inWater:boolean;nodesToCheck:number}

export class ScmStuckCarCheck {
 readonly cars:StuckCar[]=Array.from({length:STUCK_CAR_CHECK_SIZE},emptyStuckCar);
 /** AddCarToCheck: the first free slot, for a car that exists. */
 add(handle:number,position:{x:number;y:number;z:number},nowMs:number,stuckRadius:number,checkTime:number,warp?:StuckCarWarp){
  const car=this.cars.find(c=>c.handle===-1);if(!car)return;
  Object.assign(car,{handle,lastPos:{...position},lastChecked:nowMs|0,stuckRadius,checkTime:checkTime>>>0,carStuck:false,
   warpCar:!!warp,warpIfStuck:!!warp?.stuck,warpIfFlipped:!!warp?.flipped,warpIfInWater:!!warp?.inWater,
   // An int8 in the slot.
   numberOfNodesToCheck:warp?warp.nodesToCheck<<24>>24:0});
 }
 remove(handle:number){for(let i=0;i<this.cars.length;i++)if(this.cars[i].handle===handle)this.cars[i]=emptyStuckCar();}
 /** CStuckCarCheck::Init: every slot free. */
 init(){for(let i=0;i<this.cars.length;i++)this.cars[i]=emptyStuckCar();}
 clearStuckFlag(handle:number){for(const car of this.cars)if(car.handle===handle)car.carStuck=false;}
 /** HasCarBeenStuckForAWhile. */
 isStuck(handle:number){return this.cars.some(c=>c.handle===handle&&c.carStuck);}
 /** IsCarInStuckCarArray. */
 has(handle:number){return this.cars.some(c=>c.handle===handle);}
 /** Process. */
 process(nowMs:number,world:ScmCarCheckWorld){
  const now=nowMs>>>0;
  for(let i=0;i<this.cars.length;i++){
   const car=this.cars[i];
   if(car.handle<0)continue;
   if(!world.vehicleExists?.(car.handle)||!world.vehiclePosition){this.cars[i]=emptyStuckCar();continue;}
   const position=world.vehiclePosition(car.handle);
   // A car nobody drives is never stuck: its clock and place start again.
   if(!world.vehicleHasDriver?.(car.handle)){car.lastPos={...position};car.lastChecked=now|0;continue;}
   if(now>((car.lastChecked+car.checkTime)>>>0)){
    const moved=Math.hypot(position.x-car.lastPos.x,position.y-car.lastPos.y,position.z-car.lastPos.z);
    car.carStuck=moved<car.stuckRadius;car.lastPos={...position};car.lastChecked=now|0;
   }
   if(!car.warpCar)continue;
   const warp=car.warpIfStuck&&car.carStuck||car.warpIfFlipped&&!!world.vehicleIsUpsideDownForCheck?.(car.handle)
    ||car.warpIfInWater&&!!world.vehicleIsInWater?.(car.handle);
   if(!warp||world.vehicleIsOnScreen?.(car.handle)!==false)continue;
   if(car.numberOfNodesToCheck<0){
    const node=world.vehicleRouteNodeForScript?.(car.handle);
    if(node)this.attemptToWarpVehicle(car.handle,node,node.heading,world);
    continue;
   }
   for(let n=0;n<car.numberOfNodesToCheck;n++){
    const node=world.carPlacementNode?.(car.lastPos,n);
    if(node&&this.attemptToWarpVehicle(car.handle,node,node.heading,world))break;
   }
  }
 }
 /** AttemptToWarpVehicle: not while the camera sees a 4-unit sphere about the point, nor while a mission entity stands
  * within 4 units of it on each axis. */
 attemptToWarpVehicle(handle:number,origin:{x:number;y:number;z:number},heading:number,world:ScmCarCheckWorld){
  if(world.isSphereVisible?.(origin,4)!==false)return false;
  if(world.pointIsObscuredByMissionEntity?.(origin.x,origin.y,origin.z,4,4,4)!==false)return false;
  if(!world.warpVehicle)return false;
  world.warpVehicle(handle,origin,heading);
  return true;
 }
}
