/* CTaskSimpleThrowProjectile (gta-reversed ead3051): the grenade, tear gas, molotov and satchel throw. The press
 * starts the task with the button time; WEAPON_start_throw blends in at 16 and, when it finishes, the throw clip:
 * WEAPON_throw unless there is a target entity further than 10 units, a target point further than 10 units, the
 * button is still held and the weapon is not the satchel charge, in which case WEAPON_throwu. The projectile leaves
 * at the clip's fire frame (weapon.dat anim loop 2 fire for WEAPON_throw, anim loop fire for WEAPON_throwu); for the
 * player the button counter is the milliseconds the button was held (released earlier or still down), capped at 533,
 * m_fAttackButtonCounter is that over 20 and CWeapon::Fire passes counter × 0.0375 as the projectile force. An NPC
 * throws with 0.3, or ((distance to the target − 10) / 10) clamped to 0.2..1 with a target point. The force's effect
 * on the flight is in CProjectileInfo::AddProjectile, a raw call in the reference, so it is exposed here and not yet
 * applied to the projectile's speed. */
export const THROW_BUTTON_CAP_MS=533,THROW_COUNTER_DIVISOR=20,THROW_FORCE_PER_COUNTER=0.0375,THROW_CLOSE_RANGE=10,THROW_NPC_FORCE=0.3;
export const THROW_START_BLEND=16,THROW_BLEND=1000;
export const THROW_START_CLIP='weapon_start_throw',THROW_CLIP='weapon_throw',THROW_UP_CLIP='weapon_throwu';
export type ThrowClip=typeof THROW_CLIP|typeof THROW_UP_CLIP;
/** m_fAttackButtonCounter at the fire frame: held milliseconds capped at 533, over 20. */
export function throwButtonCounter(heldMs:number){return Math.min(Math.max(0,heldMs),THROW_BUTTON_CAP_MS)/THROW_COUNTER_DIVISOR;}
/** The player's projectile force (CWeapon::Fire): the counter × 0.0375, so a full hold is just under 1. */
export function playerThrowForce(heldMs:number){return throwButtonCounter(heldMs)*THROW_FORCE_PER_COUNTER;}
/** An NPC's force: 0.3 without a target point, else the distance past 10 units over 10, clamped to 0.2..1. */
export function npcThrowForce(targetDistance?:number){return targetDistance===undefined?THROW_NPC_FORCE:Math.min(1,Math.max(.2,(targetDistance-THROW_CLOSE_RANGE)/THROW_CLOSE_RANGE));}
export interface ThrowChoice {
 /** Distance to m_TargetEntity, undefined without one. */
 targetEntityDistance?:number;
 /** Distance to m_TargetPos, undefined when the point is zero. */
 targetPointDistance?:number;
 buttonReleased:boolean;
 satchel:boolean;
}
/** StartAnim after WEAPON_start_throw: which throw clip plays. */
export function throwClip(c:ThrowChoice):ThrowClip{
 const close=(d:number|undefined)=>d!==undefined&&d*d<=THROW_CLOSE_RANGE*THROW_CLOSE_RANGE;
 if(c.targetEntityDistance===undefined||close(c.targetEntityDistance))return THROW_CLIP;
 if(c.targetPointDistance===undefined||close(c.targetPointDistance))return THROW_CLIP;
 if(c.buttonReleased||c.satchel)return THROW_CLIP;
 return THROW_UP_CLIP;
}
/** The clip time the projectile leaves at: anim loop 2 for WEAPON_throw, anim loop for WEAPON_throwu. */
export function throwFireTime(clip:ThrowClip,loops:{loop:{fire:number};loop2:{fire:number}}){return clip===THROW_CLIP?loops.loop2.fire:loops.loop.fire;}
/** ProcessPed's frame test: the fire time was crossed by this step. */
export function throwFiresNow(fireTime:number,current:number,step:number){return fireTime<current&&current-step<=fireTime;}
