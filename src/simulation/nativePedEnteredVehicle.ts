/** ComputePedEnteredVehicleResponse's leave delay (iOS 0x10029f874): a passenger the player did not drag out answers
 * CEventPedEnteredMyVehicle with a leave task by his own door after (int)((rand() & 0xffff) / 65536 × 300) + 300 ms,
 * here in seconds. */
export function pedEnteredVehicleLeaveDelay(sample16:number){
 return (Math.trunc(Math.fround(Math.fround((sample16&0xffff)*(1/65536))*300))+300)/1000;
}
