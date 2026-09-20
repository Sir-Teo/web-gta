/* A ped shot in a car (gta-reversed ead3051). CWorld::ProcessLineOfSight tests the seated ped's own collision, the
 * three CTempColModels::ms_colModelPed1 spheres of radius 0.35 at z −0.2, 0.2 and 0.6 about the ped origin, which
 * sits at the seat dummy, so a bullet through the open window reaches the driver. CTaskComplexDie then runs
 * CTaskComplexDieInCar: death by explosion, in an aircraft, or with the car already still (CVehicle::CanPedStepOutCar)
 * ends in the seat or straight out of the door; otherwise PreparePedVehicleForPedDeath drops the cruise speed to zero,
 * the driver keeps the wheel for 2000 ms, and then he leaves and dies (CTaskComplexLeaveCarAndDie) if the car can be
 * stepped out of, or dies in the seat (CTaskSimpleDieInCar, CAR_dead_LHS) if it is still moving. Native units. */
export type V3={x:number;y:number;z:number};
export const SEATED_PED_SPHERE_RADIUS=0.35,SEATED_PED_SPHERE_OFFSETS=[-0.2,0.2,0.6] as const;
export const DIE_IN_CAR_OFFSET_MS=2000;
/** The entry distance of a ray into a sphere, or undefined. */
export function raySphere(origin:V3,direction:V3,center:V3,radius:number){
 const ox=origin.x-center.x,oy=origin.y-center.y,oz=origin.z-center.z;
 const b=ox*direction.x+oy*direction.y+oz*direction.z,c=ox*ox+oy*oy+oz*oz-radius*radius;
 const disc=b*b-c;if(disc<0)return undefined;
 const t=-b-Math.sqrt(disc);return t>=0?t:c<=0?0:undefined;
}
/** The nearest hit among the seated ped's spheres (world centres), within `range`. */
export function seatedPedHit(origin:V3,direction:V3,centers:readonly V3[],range:number){
 let best:number|undefined;
 for(const c of centers){const t=raySphere(origin,direction,c,SEATED_PED_SPHERE_RADIUS);if(t!==undefined&&t<=range&&(best===undefined||t<best))best=t;}
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
