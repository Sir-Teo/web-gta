/** CTaskSimpleSwim/CTaskComplexInWater movement core (gta-reversed, fully reversed):
 * six swim states, the entry depth rule, resistance blending, the submerge
 * servo and breath/drowning. Animation selection, input mapping, FX and audio
 * arrive in later slices; speeds come from the swim clips' root motion. */
export const SWIM={tread:0,sprint:1,sprinting:2,diveUnderwater:3,underwaterSprinting:4,backToSurface:5} as const;
/** The surface strokes' root-motion speeds, measured from swim.ifp (m/s): Swim_Breast 3.011 m over 1.3 s, SWIM_crawl
 * 2.505 m over 0.9 s. */
export const SWIM_BREAST_SPEED=2.316,SWIM_CRAWL_SPEED=2.783;
/** CTaskSimpleSwim for a ped the game drives (ProcessControlAI, 0x689640, and ProcessSwimAnims, 0x6899F0): the state by
 * the distance to its point (treading within a unit, the breaststroke beyond, the crawl past two units when its swim
 * speed m_fAnimSpeed, -1 until SET_SWIM_SPEED, is over 1), the stroke's playback rate (the breaststroke at the swim
 * speed when it is in (0, 1], the crawl at min(1.5, speed - 1)), and the stroke's speed over the ground (m/s): the clip's
 * shift over a 30 fps frame taken as a speed per 50th, as the player's is, and halved for a ped whose speed was never
 * set (m_vecAnimMovingShiftLocal / 2). */
export function aiSwimStroke(distance:number,animSpeed:number){
 const state:SwimState=distance>1?(animSpeed>1&&distance>2?SWIM.sprinting:SWIM.sprint):SWIM.tread;
 const rate=state===SWIM.sprint?(animSpeed>0&&animSpeed<=1?animSpeed:1):state===SWIM.sprinting?Math.min(1.5,animSpeed-1):1;
 const clip=state===SWIM.sprint?SWIM_BREAST_SPEED:state===SWIM.sprinting?SWIM_CRAWL_SPEED:0;
 return {state,rate,speed:clip*rate*50/30*(animSpeed<0?.5:1)};
}
export type SwimState=typeof SWIM[keyof typeof SWIM];
/** CTaskSimpleSwim::SWIM_STOP_TIME, in native time units (50 per second).
 * CPed::ProcessBuoyancy increments m_fSwimStopTime by CTimer::GetTimeStep. */
export const SWIM_STOP_TIME=15;
/** CPed::GetPosition is the ped's origin: the COL bounds run from z −1 to 0.95, so it sits a unit above the feet
 * the simulation tracks. Every native water depth compares against this origin. */
export const PED_ORIGIN_HEIGHT=1;
/** Where a ped's origin settles in water without the swim servo (CPed::ProcessBuoyancy against CPhysical gravity
 * 0.008 a step): buoyancy immersion × 1.1 × mass/125 (1.8 dead) balances mass × 0.008 at immersion 1/1.1 (1/1.8),
 * and cBuoyancy's ped immersion is (water − origin + 1)/1.9, so the origin floats 0.727 under alive and 0.056 dead. */
export function pedFloatDepth(alive:boolean){return 1.9/(alive?1.1:1.8)-1;}
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

/** CTaskSimpleSwim::ProcessSwimmingResistance's m_fRotationX update while SWIM_UNDERWATER_SPRINTING (gta-reversed
 * 0x68A8E0): with the ped origin within 0.65 of the surface, m_fStateChanger ramps up by a tenth of the frame's
 * seconds (to 0.025 pitched up, 0.05 pitched down, easing by 0.95 a frame above those) and turns the swimmer up by
 * it a frame, so he tips toward the surface until past 45 degrees, where the task treads; deeper, it dies away.
 * `origin` is the ped origin height, `timeStep` 1/50 s frames. The dive-in's negative changer is not modelled. */
export function swimRotationTowardSurface(pitch:number,changer:number,origin:number,water:number|undefined,timeStep:number,seconds:number){
 if(water===undefined||changer<0)return {pitch,changer};
 const decay=()=>changer>.001?changer*Math.pow(.95,timeStep):0;
 if(pitch>=0){
  if(origin+.65<=water)return {pitch,changer:changer<=.001?0:changer*Math.pow(.95,timeStep)};
  const min=.05*.5;
  if(changer>min)changer*=Math.pow(.95,timeStep);
  if(changer<min)changer=Math.min(min,changer+seconds/10);
  return {pitch:pitch+timeStep*changer,changer};
 }
 if(origin-Math.sin(pitch)+.65<=water)return {pitch,changer:decay()};
 changer=Math.min(changer+seconds/10,.05);
 return {pitch:pitch+timeStep*changer,changer};
}

/** CTaskSimpleSwim::ProcessSwimAnims in SWIM_BACK_TO_SURFACE: SWIM_JUMPOUT, handed over to CLIMB_jump once a quarter of
 * it has played (m_fTotalTime / 4). `seconds` counts from the jump-out's start. */
export function swimJumpoutPose(seconds:number,jumpoutDuration:number){
 const quarter=jumpoutDuration/4;
 return seconds<quarter?{clip:'swim_jumpout' as const,seconds}:{clip:'climb_jump' as const,seconds:seconds-quarter};
}
