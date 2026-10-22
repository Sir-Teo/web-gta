/** The state changed by CEventHandler::ComputeVehicleDiedResponse (PC 0x4BA8B0).
 * Attached peds aren't seated occupants; a ped already shot dead doesn't receive the event.
 * The rider renderer still uses its existing seated death pose rather than the native die task. */
export function respondToVehicleDeath(rider:{health:number;gone?:boolean;offset?:unknown;car:{wrecked:boolean};
 diedInSeat?:boolean;renderScorched?:boolean;driveBy?:unknown;clip?:unknown}){
 if(rider.gone||rider.health<=0||rider.offset||!rider.car.wrecked)return false;
 rider.health=0;rider.renderScorched=true;rider.diedInSeat=true;rider.driveBy=undefined;rider.clip=undefined;
 return true;
}
