/* A ped shot in a car. A seated ped has no collision of its own (CCarEnterExit::SetPedInCarDirect turns it off), and
 * CWorld::ProcessLineOfSightSectorList (iOS 0x100270868, gta-reversed World.cpp) tests a ped without collision only when
 * it is attached, dead under bIncludeDeadPeds, or flagged bTestForShotInVehicle under bIncludeBikers. A bullet reaches a
 * car's occupant through CWeapon::CheckForShootingVehicleOccupant (iOS 0x100498190) alone: when the line's first hit is
 * the car, each occupant with bCanBeShotInVehicle on is one sphere of 0.2 about its head node lifted 0.1 (piece 9, the
 * head), tested along the whole line, and the nearest takes the hit. CTaskComplexDie then runs CTaskComplexDieInCar:
 * death by explosion, in an aircraft, or with the car already still (CVehicle::CanPedStepOutCar) ends in the seat or
 * straight out of the door; otherwise PreparePedVehicleForPedDeath drops the cruise speed to zero, the driver keeps the
 * wheel for 2000 ms, and then he leaves and dies (CTaskComplexLeaveCarAndDie) if the car can be stepped out of, or dies
 * in the seat (CTaskSimpleDieInCar, CAR_dead_LHS) if it is still moving. */
export type V3={x:number;y:number;z:number};
/** A muzzle line may meet an exposed biker before its first world/tyre hit, or transfer a vehicle hit to an occupant. */
export type SeatedShot=(from:V3,direction:V3,range:number,own:unknown,hitBody:unknown,first?:{distance:number;tyre:boolean;playerHit?:(damage:number,weapon:number,piece:number)=>boolean;shooter?:import('../ped/nativeAcquaintance').Acquainted&{follow?:boolean}})=>{t:number;direct?:boolean;victim?:unknown;hit:(damage:number,weapon:number)=>void}|undefined;
/** The occupant's sphere: its radius (iOS 0x10058ca0c) and the lift over the head node (0x10058cb80). */
export const OCCUPANT_HEAD_RADIUS=0.2,OCCUPANT_HEAD_LIFT=0.1;
export const DIE_IN_CAR_OFFSET_MS=2000;
/** The entry distance of a ray into a sphere, or undefined. */
export function raySphere(origin:V3,direction:V3,center:V3,radius:number){
 const ox=origin.x-center.x,oy=origin.y-center.y,oz=origin.z-center.z;
 const b=ox*direction.x+oy*direction.y+oz*direction.z,c=ox*ox+oy*oy+oz*oz-radius*radius;
 const disc=b*b-c;if(disc<0)return undefined;
 const t=-b-Math.sqrt(disc);return t>=0?t:c<=0?0:undefined;
}
/** The nearest of the occupants' head spheres (centres already lifted) the line enters within `range`, with its index. */
export function occupantHeadHit(origin:V3,direction:V3,heads:readonly V3[],range:number){
 let best:{t:number;index:number}|undefined;
 heads.forEach((c,index)=>{const t=raySphere(origin,direction,c,OCCUPANT_HEAD_RADIUS);if(t!==undefined&&t<=range&&(!best||t<best.t))best={t,index};});
 return best;
}
/** CVehicle::CanPedStepOutCar(false): still (speed under 0.01 a step in the plane, 0.05 vertically, turning under
 * 0.02 a step) whether upright or on its side. Boats always allow it (not modelled here). */
export function canPedStepOutCar(upZ:number,moveSpeed:V3,turnSpeed:V3){
 const planar=Math.hypot(moveSpeed.x,moveSpeed.y),turn2=turnSpeed.x*turnSpeed.x+turnSpeed.y*turnSpeed.y+turnSpeed.z*turnSpeed.z;
 void upZ;
 return Math.abs(moveSpeed.z)<=0.05&&planar<=0.01&&turn2<=0.0004;
}
/** CTaskComplexDieInCar::CreateFirstSubTask's choice for a driver shot in an automobile. */
export function dieInCarPlan(input:{explosion:boolean;aircraft:boolean;driver:boolean;canStepOut:boolean}):'seat'|'leaveAndDie'|'wait'{
 if(input.explosion||input.aircraft)return 'seat';
 if(input.canStepOut)return 'leaveAndDie';
 if(!input.driver)return 'seat';
 return 'wait';
}
