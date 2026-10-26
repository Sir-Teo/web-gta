import {physicalCanBeDamaged,type PhysicalProofs} from '../combat/nativePhysicalProofs';

/** The damage-bearing part of a mission ped retained while its physical body is disabled in a vehicle. */
export interface ScriptRiderDamageState {health:number;invulnerable:boolean;proofs?:PhysicalProofs;diedInSeat?:boolean}
/** GenerateDamageEvent accepts a corpse before AffectsPed; live occupants retain CPhysical's weapon proofs and
 * only-damaged-by-player gate. The host's existing seat task consumes diedInSeat after a fatal accepted hit. */
export function scriptRiderShot(rider:ScriptRiderDamageState,damage:number,weapon:number,byPlayer:boolean,onKill?:()=>void):'hit'|'killed'|undefined{
 if(rider.health<=0)return 'killed';
 if(rider.invulnerable&&!byPlayer||!physicalCanBeDamaged(rider.proofs,weapon))return undefined;
 rider.health=Math.max(0,rider.health-damage);
 if(rider.health>0)return 'hit';
 rider.diedInSeat=true;onKill?.();return 'killed';
}
