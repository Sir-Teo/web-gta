import {PED_PIECE} from '../combat/nativeDamageAnim';
import type {PhysicalProofs} from '../combat/nativePhysicalProofs';

/** Live damage protection retained when a pedestrian changes its host body for a vehicle seat. */
export interface BulletDamageProtection {proofs?:PhysicalProofs;onlyDamagedByPlayer?:boolean;bulletProofVest?:boolean}
/** WEAPON_FIRE_INSTANT_HIT guns in the host weapon table. */
export const isInstantHitGun=(weapon:number|undefined)=>weapon!==undefined&&(weapon>=22&&weapon<=34||weapon===38);
/** CEventDamage::AffectsPed (PC 0x4B35A0; iOS 0x10028acb4): bHasBulletProofVest stops instant-hit torso/ass wounds,
 * while heads and limbs remain exposed. FINALEA gives Big Smoke this separate flag. */
export function bulletProofVestStops(victim:Pick<BulletDamageProtection,'bulletProofVest'>,weapon:number|undefined,piece:number|undefined){
 return !!victim.bulletProofVest&&isInstantHitGun(weapon)&&(piece===PED_PIECE.torso||piece===PED_PIECE.ass);
}
