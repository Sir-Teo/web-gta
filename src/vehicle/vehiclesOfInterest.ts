/** CCarCtrl's apCarsToKeep and aCarsToKeepTime: the two vehicles of the player's the game keeps (IsThisVehicleInteresting),
 * which an area clear sends to the impound. RegisterVehicleOfInterest is unreversed in gta-reversed and follows the iOS
 * executable (0x1001a0c74); PruneVehiclesOfInterest (0x423F10), RemoveFromInterestingVehicleList and
 * ClearInterestingVehicleList are reversed. */
export class VehiclesOfInterest<T extends object>{
 readonly cars:(T|undefined)[]=[undefined,undefined];
 readonly times=[0,0];
 /** RegisterVehicleOfInterest, every frame CPlayerPed::ProcessControl finds him in a vehicle: a vehicle already kept
  * has its time renewed; otherwise it takes an empty place, or the place of the one he was in longer ago (the first's
  * on a tie). */
 register(vehicle:T,now:number){
  const kept=this.cars.indexOf(vehicle);if(kept>=0){this.times[kept]=now;return;}
  const empty=this.cars.findIndex(car=>!car);
  const at=empty>=0?empty:this.times[1]<this.times[0]?1:0;
  this.cars[at]=vehicle;this.times[at]=now;
 }
 /** PruneVehiclesOfInterest: on every 64th frame (the 19th of each 64) with the player outside the interiors (below
  * 950), a vehicle kept for over three minutes since he was last in it is let go. */
 prune(now:number,frame:number,playerZ:number){
  if(frame%64!==19||playerZ>=950)return;
  for(let i=0;i<2;i++)if(this.cars[i]&&now>this.times[i]+180000)this.cars[i]=undefined;
 }
 /** IsThisVehicleInteresting. */
 has(vehicle:T){return this.cars.includes(vehicle);}
 /** RemoveFromInterestingVehicleList. */
 remove(vehicle:T){const at=this.cars.indexOf(vehicle);if(at>=0)this.cars[at]=undefined;}
 /** ClearInterestingVehicleList. */
 clear(){this.cars[0]=this.cars[1]=undefined;}
}
