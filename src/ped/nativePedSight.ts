/* CPed::OurPedCanSeeThisEntity (0x5E1720), the part that needs no world: a ped sees a thing only when it is in
 * front of it and within forty units on the plane. What is left after that is the line of sight, which the
 * caller casts, because only the world knows what stands between them. */
export const PED_SIGHT_RANGE=40;
/** Whether the target is in front of the ped and near enough for the sight test to be worth casting. `forward`
 * is the ped's facing on the plane and both points are in the same axes. */
export function pedSightAngleAndRange(from:{x:number;y:number},forward:{x:number;y:number},to:{x:number;y:number}){
 const dx=to.x-from.x,dy=to.y-from.y;
 // Behind the ped, or past forty units: no sight, and the routine does not cast at all.
 if(dx*forward.x+dy*forward.y<0)return false;
 return dx*dx+dy*dy<PED_SIGHT_RANGE*PED_SIGHT_RANGE;
}
/** The point the sight is cast at: a ped is looked at a unit above its own position, which is its head. */
export const PED_SIGHT_TARGET_RAISE=1;
