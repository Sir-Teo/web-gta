import {physicalCanBeDamaged,type PhysicalProofs} from '../combat/nativePhysicalProofs';
export type VehicleDamager={player?:true;ped?:unknown;car?:unknown};
export interface VehicleDamageState {health:number;occupied:boolean;canBeDamaged?:boolean;onlyDamagedByPlayer?:boolean;proofs?:PhysicalProofs;lastWeaponDamage?:number;lastDamagedBy?:VehicleDamager}
/** CVehicle::CanVehicleBeDamaged (iOS 0x1004780a8). An undefined attribution is an unknown host source;
 * false identifies a source other than the player or their vehicle. The optional attached-player gate is used
 * when the caller knows the player fired while attached to this vehicle. */
export function vehicleRefusesWeaponDamage(vehicle:VehicleDamageState,weapon:number,byPlayer?:boolean,attachedPlayer=false){
 return vehicle.canBeDamaged===false||!!vehicle.onlyDamagedByPlayer&&!vehicle.occupied&&byPlayer===false||
  attachedPlayer||!physicalCanBeDamaged(vehicle.proofs,weapon)||vehicle.occupied&&Math.fround(vehicle.health)<250&&firesExplodesOrShoots(weapon);
}
/** InflictDamage stores a weapon while health remains. A null native attacker preserves the old reference
 * (iOS 0x100478548–0x100478564); a known non-player attacker replaces it even when the host has no entity identity. */
export function recordVehicleDamage(vehicle:VehicleDamageState,weapon:number,byPlayer?:boolean,by?:VehicleDamager){
 if(vehicle.health<=0)return;
 vehicle.lastWeaponDamage=weapon;
 if(by!==undefined)vehicle.lastDamagedBy=by;
 else if(byPlayer!==undefined)vehicle.lastDamagedBy=byPlayer?{player:true}:undefined;
}
/** What CVehicle::InflictDamage asks of the game beyond the car:
 * - whether CStats::GetPercentageProgress has reached 100, which takes the player's own car's share of the damage
 *   from 0.95 to 0.42;
 * - the name of the head of CTheScripts::pActiveScripts (STRAP3 quarters it again);
 * - STAT_COST_OF_PROPERTY_DAMAGED, which the player's harm adds to.
 * The host sets them. */
export const carDamageHost={fullCompletion:():boolean=>false,headScriptName:():string|undefined=>undefined,addPropertyDamage:(_dollars:number)=>{}};
/** CVehicle::InflictDamage's share for the player's own vehicle (STATUS_PLAYER): a quarter first while strap3 heads
 * pActiveScripts (an iOS-only hack: strcmp with "strap3"), then 0.95, or 0.42 once progress reaches 100%. */
export function playerVehicleDamage(amount:number){
 if(carDamageHost.headScriptName()?.toLowerCase()==='strap3')amount*=.25;
 return amount*(carDamageHost.fullCompletion()?.42:.95);
}
/** CVehicle::InflictDamage: more than 10 of the player's harm, after that share, adds rand() % 20 + 5 dollars to
 * STAT_COST_OF_PROPERTY_DAMAGED (and 2 to the unused m_nHavocCaused). */
export function notePlayerVehicleHarm(amount:number,byPlayer:boolean|undefined){
 if(amount>10&&byPlayer===true)carDamageHost.addPropertyDamage(5+Math.floor(Math.random()*20));
}
/** CVehicle::InflictDamage's m_wBombTimer for a vehicle a blast (WEAPON_EXPLOSION) destroys: (rand() & 0x7FF) + 1000 ms,
 * which ProcessDelayedExplosion counts down to BlowUpCar. */
export function blastBombTimerMs(){return (Math.floor(Math.random()*0x8000)&0x7ff)+1000;}
/** CPhysical::CanPhysicalBeDamaged's flag (iOS jump table 0x100252b84): the weapons that count as fire, explosion or
 * bullet, which the player's own vehicle under 250 refuses (CVehicle::CanVehicleBeDamaged). The explosives, the
 * molotov, the guns from the pistol to the sniper rifle, the minigun and the drive-by Uzi; not the flamethrower. */
export function firesExplodesOrShoots(weapon:number){
 return weapon===16||weapon>=18&&weapon<=36||weapon>=38&&weapon<=40||weapon===51||weapon===52;
}
