/** CTaskSimpleSwim/CTaskComplexInWater movement core (gta-reversed, fully reversed):
 * six swim states, the entry depth rule, resistance blending, the submerge
 * servo and breath/drowning. Animation selection, input mapping, FX and audio
 * arrive in later slices; speeds come from the swim clips' root motion. */
export const SWIM={tread:0,sprint:1,sprinting:2,diveUnderwater:3,underwaterSprinting:4,backToSurface:5} as const;
export type SwimState=typeof SWIM[keyof typeof SWIM];
/** CTaskSimpleSwim::SWIM_STOP_TIME, in native time units (50 per second).
 * CPed::ProcessBuoyancy increments m_fSwimStopTime by CTimer::GetTimeStep. */
export const SWIM_STOP_TIME=15;
/** CPed::GetPosition is the ped's origin: the COL bounds run from z −1 to 0.95, so it sits a unit above the feet
 * the simulation tracks. Every native water depth compares against this origin. */
export const PED_ORIGIN_HEIGHT=1;
/** CPed::ProcessBuoyancy: the ped stops standing and starts the in-water task once its origin is 0.6 under the
 * surface (the buoyancy-force trigger, immersion over 0.909 at 70 kg, would only fire 0.13 deeper). */
export function swimEntry(feetY:number,waterLevel:number|undefined){
 return waterLevel!==undefined&&feetY+PED_ORIGIN_HEIGHT+0.6<waterLevel;
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
/** ProcessSwimmingResistance's submerge depth for the surface states: 0.55 of what neither the breaststroke nor the
 * crawl blend covers, 0.4 of the breaststroke blend and 0.2 of the crawl blend (the origin sits that far under). */
export function swimSubmergeZ(breastBlend:number,crawlBlend:number){
 const difference=Math.max(0,1-breastBlend-crawlBlend);
 return difference*.55+breastBlend*.4+crawlBlend*.2;
}
/** Vertical servo toward the waterline minus the submerge depth, with the
 * source's double clamp (per-frame then per-second). `posZ` is the ped origin. Returns the new Z speed. */
export function swimSubmergeVelocity(posZ:number,waterLevel:number,submergeZ:number,velZ:number,timeStep:number,timeStepSec:number){
 let target=(waterLevel-submergeZ-posZ)/timeStep;
 target=Math.max(-timeStep*.1,Math.min(timeStep*.1,target))-velZ;
 target=Math.max(-timeStepSec,Math.min(timeStepSec,target));
 return velZ+target;
}
export interface SwimStrokeAssociation {speed:number;blend:number}
/** CTaskSimpleSwim::ProcessPed samples the existing SWIM_UNDER association
 * before ProcessSwimAnims. Surface states and missing associations use 1. */
export function swimBreathMultiplier(state:number,under?:SwimStrokeAssociation){
 return state===SWIM.underwaterSprinting&&under?1+under.speed*under.blend:1;
}
/** CPlayerPed::HandlePlayerBreath (0x60A8D0), pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166. Recovery may overshoot the
 * capacity; the damage-event argument truncates to an integer. The default
 * capacity remains an approximation until STAT_MOD_AIR_IN_LUNG is ported. */
export function swimBreath(breath:number,decrease:boolean,multiplier:number,timeStep:number,lungCap=100,infiniteOxygen=false,drownsInWater=true){
 const amount=timeStep*multiplier;
 if(!decrease||infiniteOxygen)return {breath:lungCap>breath?breath+amount*2:breath,damage:0};
 if(breath>0&&drownsInWater)return {breath:Math.max(0,breath-amount),damage:0};
 return {breath,damage:Math.trunc(amount*3)};
}
