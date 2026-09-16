/** CTaskSimpleSwim/CTaskComplexInWater movement core (gta-reversed, fully reversed):
 * six swim states, the entry depth rule, resistance blending, the submerge
 * servo and breath/drowning. Animation selection, input mapping, FX and audio
 * arrive in later slices; speeds come from the swim clips' root motion. */
export const SWIM={tread:0,sprint:1,sprinting:2,diveUnderwater:3,underwaterSprinting:4,backToSurface:5} as const;
export type SwimState=typeof SWIM[keyof typeof SWIM];
/** CTaskSimpleSwim::SWIM_STOP_TIME: standing time before the swim task ends. */
export const SWIM_STOP_TIME=15;
/** CPed buoyancy trigger (ProcessBuoyancy): feet 0.6 or more under the surface.
 * The buoyancy-ratio trigger needs ped buoyancy state and is not ported. */
export function swimEntry(feetY:number,waterLevel:number|undefined){
 return waterLevel!==undefined&&feetY+0.6<waterLevel;
}
/** Surface state from the move blend and the sprint button (ProcessControlInput). */
export function swimSurfaceState(moveBlend:number,sprintHeld:boolean):SwimState{
 if(sprintHeld)return SWIM.sprinting;
 return moveBlend>.5?SWIM.sprint:SWIM.tread;
}
/** Move-blend ramp toward the input magnitude (0.07 per native frame). */
export function swimBlendRatio(current:number,target:number,timeStep:number){
 const step=timeStep*.07;
 return target-current<=step?target:current+step;
}
/** ProcessSwimmingResistance blending: old velocity decays as 0.9^ts while the
 * clip's root-motion shift feeds in. Velocities are per-step displacements. */
export function swimResistance(velocity:{x:number;z:number},shift:{x:number;z:number},timeStep:number){
 const keep=Math.pow(.9,timeStep);
 return {x:velocity.x*keep+shift.x*(1-keep),z:velocity.z*keep+shift.z*(1-keep)};
}
/** Submerge depth for the surface states from the breast/crawl blend amounts. */
export function swimSubmergeZ(breastBlend:number,crawlBlend:number){
 const difference=Math.max(0,1-crawlBlend);
 return difference*.55+breastBlend*.4+crawlBlend*.2;
}
/** Vertical servo toward the waterline minus the submerge depth, with the
 * source's double clamp (per-frame then per-second). Returns the new Z speed. */
export function swimSubmergeVelocity(posZ:number,waterLevel:number,submergeZ:number,velZ:number,timeStep:number,timeStepSec:number){
 let target=(waterLevel-submergeZ-posZ)/timeStep;
 target=Math.max(-timeStep*.1,Math.min(timeStep*.1,target))-velZ;
 target=Math.max(-timeStepSec,Math.min(timeStepSec,target));
 return velZ+target;
}
/** CPlayerPed::HandlePlayerBreath: air recovers toward the lung-capacity
 * modifier (authored 100 without the stat modifier), underwater sprinting
 * drains it, and empty lungs take drowning damage. Returns breath and damage. */
export function swimBreath(breath:number,decrease:boolean,multiplier:number,timeStep:number,lungCap=100){
 const amount=timeStep*multiplier;
 if(!decrease)return {breath:lungCap>breath?Math.min(lungCap,breath+amount*2):breath,damage:0};
 if(breath>0)return {breath:Math.max(0,breath-amount),damage:0};
 return {breath:0,damage:amount*3};
}
