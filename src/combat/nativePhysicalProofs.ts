/** The five proofs of CPhysical::physicalFlags that SET_CHAR_PROOFS and SET_CAR_PROOFS set. */
export interface PhysicalProofs {bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}

/** CPhysical::CanPhysicalBeDamaged (0x5449E0, reversed): which proof turns away damage from a weapon type, or
 * nothing when none can.
 * - The melee weapons (0 to 15) fall to bMeleeProof.
 * - The bombs, rockets and satchels, and WEAPON_EXPLOSION (51), fall to bExplosionProof.
 * - The molotov and the flamethrower fall to bFireProof.
 * - The guns, and WEAPON_UZI_DRIVEBY (52), fall to bBulletProof.
 * - WEAPON_RAMMEDBYCAR (49), WEAPON_RUNOVERBYCAR (50) and WEAPON_FALL (54) fall to bCollisionProof.
 * Tear gas, the spray can, the extinguisher, the camera, the goggles, the parachute and drowning always get
 * through. */
export function physicalProofFor(weapon:number):keyof PhysicalProofs|undefined{
 if(weapon>=0&&weapon<=15)return 'melee';
 switch(weapon){
  case 16:case 19:case 20:case 21:case 35:case 36:case 39:case 40:case 51:return 'explosion';
  case 18:case 37:return 'fire';
  case 22:case 23:case 24:case 25:case 26:case 27:case 28:case 29:case 30:case 31:case 32:case 33:case 34:case 38:case 52:return 'bullet';
  case 49:case 50:case 54:return 'collision';
  default:return undefined;
 }
}
/** Whether a weapon's damage reaches something with these proofs. */
export const physicalCanBeDamaged=(proofs:PhysicalProofs|undefined,weapon:number)=>{const proof=physicalProofFor(weapon);return !proof||!proofs?.[proof];};
