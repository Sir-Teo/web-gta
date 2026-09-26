/** CPed::CreateDeadPedPickupCoors (GET_DEAD_CHAR_PICKUP_COORDS, and where a dead ped's weapons land). SA hands it to
 * CPickups::CreatePickupCoorsCloseToCoors (0x458A80), which gta-reversed leaves unreversed; this is VC's own body of
 * the same function (reVC Pickups.cpp), which SA's grew out of. Native axes, Z up.
 *
 * Thirty-two tries at a random point 1.5 units round the ped, each dropped to the ground under it (FindGroundZFor3DCoord
 * from the ped's height) and lifted 0.5: a try is taken once it stands more than 2 units from the player, no pickup is
 * within 1.3 of it, the line from its outer edge back to the ped's middle is clear (of buildings, and of vehicles and
 * objects for the first sixteen tries), and no vehicle is within 1.2 of it; from the eighteenth try (i > 16) only the
 * ground and the line still count. None taken: the ped's own spot 0.4 up. */
export interface DeadPedPickupWorld {
 /** CWorld::FindGroundZFor3DCoord: the ground under the point, or undefined where there is none. */
 groundZ(x:number,y:number,z:number):number|undefined;
 /** CPickups::TestForPickupsInBubble. */
 pickupsInBubble(p:{x:number;y:number;z:number},radius:number):boolean;
 /** CWorld::GetIsLineOfSightClear with buildings always, vehicles and objects as asked. */
 lineOfSightClear(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},vehiclesAndObjects:boolean):boolean;
 /** CWorld::TestSphereAgainstWorld against vehicles only. */
 vehicleInSphere(p:{x:number;y:number;z:number},radius:number):boolean;
 /** CGeneral::GetRandomNumber() % 256. */
 random256():number;
}
const ATTEMPTS=32;
export function deadPedPickupCoors(ped:{x:number;y:number;z:number},player:{x:number;y:number},world:DeadPedPickupWorld){
 for(let i=0;i<ATTEMPTS;i++){
  const x=1.5*Math.sin(world.random256()/256*Math.PI*2)+ped.x,y=1.5*Math.cos(world.random256()/256*Math.PI*2)+ped.y;
  const ground=world.groundZ(x,y,ped.z);if(ground===undefined)continue;
  const pickup={x,y,z:ground+.5},middle={x:ped.x,y:ped.y,z:ped.z+.3};
  const d={x:pickup.x-middle.x,y:pickup.y-middle.y,z:pickup.z-middle.z},length=Math.hypot(d.x,d.y,d.z);
  // The pickup's outer edge, 0.4 further out along the line from the ped.
  const k=length>0?(length+.4)/length:1,edge={x:middle.x+d.x*k,y:middle.y+d.y*k,z:middle.z+d.z*k};
  const late=i>ATTEMPTS/2;
  if(!(Math.hypot(pickup.x-player.x,pickup.y-player.y)>2||late))continue;
  if(!late&&world.pickupsInBubble(pickup,1.3))continue;
  if(!world.lineOfSightClear(edge,middle,i<ATTEMPTS/2))continue;
  if(!late&&world.vehicleInSphere(pickup,1.2))continue;
  return pickup;
 }
 return {x:ped.x,y:ped.y,z:ped.z+.4};
}
