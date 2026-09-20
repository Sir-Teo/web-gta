import {worldZoneAt,type WorldZones} from '../assets/worldZones';
/** CDarkel::RegisterKillByPlayer: a player kill of a ped type from PED_TYPE_DEALER up (dealer, medic, fireman,
 * criminal, bum, prostitute, special and mission peds; the reversed source marks the comparison "BUG?") calls
 * CPopCycle::PlayerKilledADealer. */
export function pedTypeAtLeastDealer(pedType:string|undefined){return !!pedType&&/^(DEALER|MEDIC|FIREMAN|CRIMINAL|BUM|PROSTITUTE|SPECIAL|MISSION\d*)$/i.test(pedType);}
/** CPopCycle::PlayerKilledADealer: the zone the player stands in loses one dealer strength, never below 0.
 * `player` in native coordinates. Returns the strength left, or undefined when no zone info is known. */
export function playerKilledADealer(zones:WorldZones|undefined,player:{x:number;y:number;z:number}){
 if(!zones?.population)return undefined;
 let zone;try{zone=worldZoneAt(zones,[player.x,player.y,player.z],true);}catch{return undefined;}
 const info=zones.population[zone.zoneInfoIndex];if(!info)return undefined;
 if(info.dealerStrength>0)info.dealerStrength--;
 return info.dealerStrength;
}
