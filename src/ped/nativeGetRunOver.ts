/* A pedestrian in the path of a moving vehicle, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 *
 * - CEventHandler::ComputeVehiclePotentialCollisionResponse (Events/EventHandler.cpp, 0x4C0C80)
 *   answers CEventPotentialGetRunOver. It is fully reversed and needs no decision maker:
 *   evasive steps, dives, raised hands, shaken fists and flights from a honking player.
 * - CVehiclePotentialCollisionScanner::ScanForVehiclePotentialCollisionEvents (0x603720) is a retail
 *   stub. The event is raised by the warning half of CCarCtrl::SlowCarDownForPedsSectorList, which
 *   `potentialGetRunOver` follows as the iOS executable has it (0x1001941b8, with ScanForPedDanger
 *   0x1001949b0 for the box): peds strictly inside a box of ±44 round the player's vehicle (±14 round
 *   one that ran FindMaximumSpeedForThisCarInTraffic, else ±11), under 6 above or below it and 3 off
 *   its slope; every one within 7 units of a honking player's vehicle; and, for a vehicle the player
 *   or the AI drives, one on its side of travel that it reaches within 1 s, moving faster than 0.05
 *   units a frame, no further to the side than half its width plus 0.35. (Vice City's had an 11-unit
 *   box, 4 units of height, 4 s and 0.5, and led a reversing vehicle with its back.)
 * - CPedGeometryAnalyser::ComputeMoveDirToAvoidEntity (0x5F3730) is a stub too: `avoidDirection`
 *   points straight out of the vehicle's path on the ped's side.
 * Vectors here are on the ground plane of one frame; the vehicle's `forward` and `right` are unit
 * vectors in that frame and its bounds are the collision model's local X (width) and Y (length). */

type V2={x:number;z:number};
const dot=(a:V2,b:V2)=>a.x*b.x+a.z*b.z;

/** ScanForPedDanger's half box: 11, or 44 round the player's vehicle. */
export const PED_DANGER_SCAN_DISTANCE=11,PLAYER_PED_DANGER_SCAN_DISTANCE=44;
export interface GetRunOverVehicle {
 position:V2;height:number;forward:V2;right:V2;
 /** The matrix's forward and right in the renderer's axes (y up); flat ones when absent. */
 forward3?:{x:number;y:number;z:number};right3?:{x:number;y:number;z:number};
 boundsMin:{x:number;y:number};boundsMax:{x:number;y:number};
 /** Move speed along the forward vector, units per 1/50 s frame. */
 forwardSpeed:number;
 /** CVehicle::m_HornCounter is running. */
 horn:boolean;
 /** STATUS_PLAYER: the player is driving. */
 playerDriven:boolean;
 /** The AI drives it under physics (a STOP_FOR_CARS car on rails, or one nobody drives, warns nobody). */
 aiDriven?:boolean;
 /** Half the scan box for an AI vehicle: 14 when it ran FindMaximumSpeedForThisCarInTraffic, else 11. */
 scanHalf?:number;
}

/** Whether the vehicle raises CEventPotentialGetRunOver on the ped. */
export function potentialGetRunOver(ped:V2&{height:number},v:GetRunOverVehicle){
 const to={x:ped.x-v.position.x,z:ped.z-v.position.z},dz=ped.height-v.height;
 const half=v.playerDriven?PLAYER_PED_DANGER_SCAN_DISTANCE:v.scanHalf??PED_DANGER_SCAN_DISTANCE;
 if(!(Math.abs(to.x)<half&&Math.abs(to.z)<half&&Math.abs(dz)<6))return false;
 const f=v.forward3??{x:v.forward.x,y:0,z:v.forward.z},r=v.right3??{x:v.right.x,y:0,z:v.right.z};
 if(!(Math.abs(dz-(to.x*f.x+to.z*f.z)*f.y)<3))return false;
 if(v.playerDriven&&v.horn&&to.x*to.x+to.z*to.z+dz*dz<49)return true;
 const speed=v.forwardSpeed;
 if(!(v.playerDriven||v.aiDriven)||speed===0)return false;
 const along=to.x*f.x+dz*f.y+to.z*f.z,front=v.boundsMax.y;
 if((along>=0?1:-1)!==(speed>=0?1:-1))return false;
 if(!(Math.abs(along)-front<Math.abs(speed)*50&&Math.abs(along)>front&&Math.abs(speed)>.05))return false;
 return Math.abs(to.x*r.x+dz*r.y+to.z*r.z)<=v.boundsMax.x+.35;
}

/** ComputeMoveDirToAvoidEntity stand-in: out of the vehicle's path, towards the ped's side. */
export function avoidDirection(ped:V2,v:{position:V2;right:V2}){
 const side=dot({x:ped.x-v.position.x,z:ped.z-v.position.z},v.right)>=0?1:-1;
 return {x:v.right.x*side,z:v.right.z*side};
}

export type GetRunOverResponse=
 {task:'none'}|
 {task:'evasiveStep'|'evasiveDive';avoid:V2}|
 /** CTaskSimpleHandsUp(3000) facing the vehicle. */
 {task:'handsUp'}|
 /** CTaskSimpleShakeFist, turned to the vehicle first when `face` is set. */
 {task:'shakeFist';face:boolean}|
 /** CTaskComplexFleeEntity from the vehicle, 60 units, 750 to 1250 ms. */
 {task:'flee';seconds:number}|
 /** CTaskSimpleAchieveHeading towards the vehicle. */
 {task:'face'};

/** ComputeVehiclePotentialCollisionResponse for a street ped (not the player). `random01` is
 * GetRandomNumberInRange(0.f, 1.f) and `randomInt1000` GetRandomNumberInRange(0, 1000). */
export function vehiclePotentialCollisionResponse(o:{ped:V2;inVehicle?:boolean;isCop:boolean;createdByGame:boolean;
 vehicle:GetRunOverVehicle;random01:number;randomInt1000:number;
 /** The event already being handled is a potential run-over. */
 respondingToRunOver:boolean;randomRange:(min:number,max:number)=>number}):GetRunOverResponse{
 const v=o.vehicle;if(o.inVehicle)return {task:'none'};
 const avoid=avoidDirection(o.ped,v);
 const speed=v.forwardSpeed,perSecond=speed*50;
 const centre=speed>0?{x:v.position.x+v.forward.x*v.boundsMax.y,z:v.position.z+v.forward.z*v.boundsMax.y}:{x:v.position.x+v.forward.x*v.boundsMin.y,z:v.position.z+v.forward.z*v.boundsMin.y};
 const toCentre={x:o.ped.x-centre.x,z:o.ped.z-centre.z},along=dot(toCentre,v.forward),across=dot(toCentre,v.right);
 if(Math.abs(along)<=Math.abs(2*perSecond)){
  if(Math.abs(speed)<=.05)return {task:'none'};
  const r=o.random01,slow=Math.abs(speed)<=.3;
  const evadeBack=slow?.02:.05,hornNeeded=slow?.05:.1,evadeFront=slow?.1:.2,margin=slow?.7:.175;
  if(dot({x:v.position.x-o.ped.x,z:v.position.z-o.ped.z},v.forward)>0){
   if(v.boundsMax.x-margin<Math.abs(across))return r>=evadeFront*.5?{task:'evasiveStep',avoid}:{task:'shakeFist',face:true};
   if(r<evadeFront)return {task:'handsUp'};
  }else{
   if(r>hornNeeded&&!v.horn)return {task:'none'};
   if(r>evadeBack)return {task:'evasiveStep',avoid};
  }
  return {task:'evasiveDive',avoid};
 }
 if(v.playerDriven&&o.createdByGame&&v.horn&&!o.respondingToRunOver){
  const n=o.randomInt1000;
  if(n<25&&!o.isCop)return {task:'flee',seconds:o.randomRange(750,1250)/1000};
  if(n<100)return {task:'shakeFist',face:true};
  // 100 to 399 look at the car (an IK request); 100 to 199 also turn to it.
  if(n<200)return {task:'face'};
 }
 return {task:'none'};
}
