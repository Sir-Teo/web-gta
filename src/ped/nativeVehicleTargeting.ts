/** CPlayerPed::PedCanBeTargettedVehicleWise (PC 0x609D90).
 * CVehicle clears this flag at construction; bikes are eligible regardless of it.
 * This is an automatic ped-target rule, independent of bullets and heat-seeking missiles. */
export function pedCanBeTargettedVehicleWise(inVehicle:boolean,vehicle?:{bike?:boolean;pedTargetable?:boolean}){
 return !inVehicle||!!vehicle&&(!!vehicle.bike||vehicle.pedTargetable===true);
}
/** FireInstantHit's pIgnoreEntity selection (iOS 0x1004956bc / 0x100495efc).
 * A targetable occupied vehicle falls through to the attachment test; bikes have no special exception here. */
export function instantHitIgnoredVehicle<T extends {pedTargetable?:boolean}>(inVehicle:boolean,vehicle:T|undefined,attachedVehicle:T|undefined):T|undefined{
 if(inVehicle&&vehicle&&vehicle.pedTargetable!==true)return vehicle;
 return attachedVehicle&&attachedVehicle.pedTargetable!==true?attachedVehicle:undefined;
}
