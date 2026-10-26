import {physicalCanBeDamaged,type PhysicalProofs} from '../combat/nativePhysicalProofs';
import {healthAfter,spendPedArmour} from '../ped/damage';

/** The damage-bearing part of a mission ped retained while its physical body is disabled in a vehicle. */
export interface ScriptRiderDamageState {health:number;armour?:number;defendMult?:number;invulnerable:boolean;proofs?:PhysicalProofs;diedInSeat?:boolean}
/** GenerateDamageEvent accepts a corpse before AffectsPed; live occupants retain CPhysical's weapon proofs and
 * only-damaged-by-player gate. The host's existing seat task consumes diedInSeat after a fatal accepted hit. */
export function scriptRiderShot(rider:ScriptRiderDamageState,damage:number,weapon:number,byPlayer:boolean,onKill?:()=>void,response?:{forceDeath?:boolean;friendlyFire?:boolean}):'hit'|'killed'|undefined{
 if(rider.health<=0)return 'killed';
 if(rider.invulnerable&&!byPlayer||!physicalCanBeDamaged(rider.proofs,weapon))return undefined;
 let scaled=damage*(rider.defendMult??1);
 if(response?.friendlyFire&&weapon!==37&&weapon!==51)scaled=Math.min(scaled*Math.fround(.1),12.5);
 const absorbed=spendPedArmour(scaled,rider.armour,weapon);rider.armour=absorbed.armour;
 rider.health=response?.forceDeath?0:healthAfter(rider.health,absorbed.damageHealth);
 if(rider.health>0)return 'hit';
 rider.diedInSeat=true;onKill?.();return 'killed';
}
