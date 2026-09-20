/* CTaskSimpleGetUp (gta-reversed ead3051): the get-up at the end of a fall. StartAnim blends GETUP_FRONT when the
 * clump's first association carries ANIMATION_IS_FRONT (the ped lies on its front) and GETUP otherwise, at a 1000
 * blend; the ped counts as fallen (bFallenDown) until the clip passes three quarters of its length. Before the clip
 * starts, CPedPlacement::IsPositionClearOfCars tests a 0.25 sphere at the ped's origin against the vehicles: a car
 * over the ped (unless it is a bike or quad, the entity the ped is attached to or the one it stands on) keeps the ped
 * down with bStuckUnderCar set. A stuck player takes WEAPON_RUNOVERBYCAR damage of the time step every frame (fifty
 * a second); a stuck NPC takes none while the player has controls, and a thousand once they are disabled. The
 * ANIMATION_IS_FRONT descriptors come from CAnimManager's default group table. */
export const GET_UP_CLEAR_RADIUS=0.25,GET_UP_FALLEN_FRACTION=0.75,GET_UP_BLEND=1000;
/** Default-group clips flagged ANIMATION_IS_FRONT (ped.ifp names, lower case). */
export const FRONT_CLIPS:ReadonlySet<string>=new Set(['ko_shot_front','ko_skid_back','floor_hit_f','car_rollout_lhs','car_rollout_rhs','getup_front','fall_front','ev_dive','car_jackedlhs','car_jackedrhs']);
export function isFrontClip(clip:string|undefined){return !!clip&&FRONT_CLIPS.has(clip.toLowerCase());}
/** The get-up clip for the clip the ped fell with: GETUP_FRONT after a front fall, GETUP (on the back) otherwise. */
export function getUpClip(fallClip:string|undefined):'getup_front'|'getup'{return isFrontClip(fallClip)?'getup_front':'getup';}
export interface CarOverPed {bike:boolean;standingOn:boolean;attached:boolean}
/** Whether the vehicle found over the ped's origin sphere holds the get-up back (bStuckUnderCar). */
export function getUpBlockedBy(over:CarOverPed|undefined){return !!over&&!over.bike&&!over.standingOn&&!over.attached;}
/** The health a ped stuck under a car loses in a frame of `steps` native time steps. */
export function stuckUnderCarDamage(steps:number,player:boolean,playerControlsDisabled=false){
 if(player)return steps>0?steps:0;
 return playerControlsDisabled?1000:0;
}
/** Whether the ped still counts as fallen `seconds` into a get-up clip of `duration`. */
export function fallenDuringGetUp(seconds:number,duration:number){return seconds<duration*GET_UP_FALLEN_FRACTION;}
