import {WEAPON} from '../combat/nativeDamageAnim';
import {pedTypeName,type Acquainted} from './nativeAcquaintance';

/** CEventDamage::AffectsPed (PC 0x4B35A0) for a raw nonplayer ped damaging FindPlayerPed.
 * GANG2's grenade-and-higher weapons require its KillPedOnFoot task to target CJ. A live groupmate
 * cannot damage him except by explosion. Raw vehicle creators do not enter either ped-only gate. */
export function npcPedCanDamagePlayer(source:Acquainted|undefined,weapon:number,context:{sameGroup?:boolean;killTaskTargetsPlayer?:boolean}={}){
 if(!source)return true;
 if(pedTypeName(source)==='GANG2'&&weapon>=WEAPON.grenade&&!context.killTaskTargetsPlayer)return false;
 return !context.sameGroup||weapon===WEAPON.explosion;
}
