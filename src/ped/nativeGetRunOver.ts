/* A pedestrian in the path of a moving vehicle, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 *
 * - CEventHandler::ComputeVehiclePotentialCollisionResponse (Events/EventHandler.cpp, 0x4C0C80)
 *   answers CEventPotentialGetRunOver. It is fully reversed and needs no decision maker:
 *   evasive steps, dives, raised hands, shaken fists and flights from a honking player.
 * - CVehiclePotentialCollisionScanner::ScanForVehiclePotentialCollisionEvents (0x603720), which
 *   raises the event, is a retail stub. `potentialGetRunOver` stands in with the test of its Vice
 *   City ancestor, CCarCtrl::SlowCarDownForPedsSectorList (reVC, src/control/CarCtrl.cpp): peds
 *   inside an 11-unit box around the vehicle, within 4 units of height, ahead of its front, due
 *   to be reached within 4 s and no further to the side than half its width plus 0.5.
 * - CPedGeometryAnalyser::ComputeMoveDirToAvoidEntity (0x5F3730) is a stub too: `avoidDirection`
 *   points straight out of the vehicle's path on the ped's side.
 * Vectors here are on the ground plane of one frame; the vehicle's `forward` and `right` are unit
 * vectors in that frame and its bounds are the collision model's local X (width) and Y (length). */

type V2={x:number;z:number};
const dot=(a:V2,b:V2)=>a.x*b.x+a.z*b.z;

/** DISTANCE_TO_SCAN_FOR_PED_DANGER in the Vice City scan. */
export const PED_DANGER_SCAN_DISTANCE=11;
export interface GetRunOverVehicle {
 position:V2;height:number;forward:V2;right:V2;
 boundsMin:{x:number;y:number};boundsMax:{x:number;y:number};
 /** Move speed along the forward vector, units per 1/50 s frame. */
 forwardSpeed:number;
 /** CVehicle::m_HornCounter is running. */
 horn:boolean;
 /** STATUS_PLAYER: the player is driving. */
 playerDriven:boolean;
 bike?:boolean;
}

/** The scanner stand-in: whether the vehicle raises CEventPotentialGetRunOver on the ped. */
export function potentialGetRunOver(ped:V2&{height:number},v:GetRunOverVehicle){
 const to={x:ped.x-v.position.x,z:ped.z-v.position.z};
 if(Math.abs(to.x)>PED_DANGER_SCAN_DISTANCE||Math.abs(to.z)>PED_DANGER_SCAN_DISTANCE||Math.abs(ped.height-v.height)>=4)return false;
 // Reversing vehicles lead with their back.
 const sign=v.forwardSpeed<0?-1:1,along=dot(to,v.forward)*sign,front=sign>0?v.boundsMax.y:-v.boundsMin.y;
 if(along<=front)return false;
 const untilHit=along-front,perSecond=Math.abs(v.forwardSpeed)*50;
 if(4*perSecond<=untilHit)return false;
 const side=v.boundsMax.x*(v.bike?1.6:1);
 return Math.abs(dot(to,v.right))<=side+.5;
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
