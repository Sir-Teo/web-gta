import {PED_PIECE} from '../combat/nativeDamageAnim';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import {pedTypeName,type Acquainted} from './nativeAcquaintance';

/** ComputeWillForceDeath's nonplayer-source firearm branch, pinned iOS 0x10028a4b0.
 * PC 0x4AD610 remains a retail delegate. Actual player types never force a head death here;
 * rifles skip the draw and other guns take rand() & 7 even for body pieces.
 * Vehicle seats and player-creator aim branches are separate. */
export function npcFootBulletCritical(victim:Acquainted&{noCriticalHits?:boolean},weapon:number,piece:number,
 randomSample:()=>number=()=>Math.floor(Math.random()*(RANDOM_SAMPLE_MAX+1))){
 if(victim.noCriticalHits||!(weapon>=22&&weapon<=34||weapon===38||weapon===52))return false;
 const type=pedTypeName(victim);if(type==='PLAYER1'||type==='PLAYER2')return false;
 const critical=weapon===33||weapon===34?true:(randomSample()&7)===0;
 return piece===PED_PIECE.head&&critical;
}
