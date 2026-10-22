/** CPed::CreateDeadPedPickupCoors (GET_DEAD_CHAR_PICKUP_COORDS, and where a dead ped's weapons land). SA hands it to
 * CPickups::CreatePickupCoorsCloseToCoors (PC 0x458A80, iOS 0x1001c416c). Seventeen executable captures establish
 * the shared random angle, float32 arithmetic and retry decisions. Native axes, Z up.
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
const ATTEMPTS=32,f=Math.fround,ANGLE_STEP=f(Math.PI*2/256);
export function deadPedPickupCoors(ped:{x:number;y:number;z:number},player:{x:number;y:number},world:DeadPedPickupWorld){
 const px=f(ped.x),py=f(ped.y),pz=f(ped.z),playerX=f(player.x),playerY=f(player.y);
 for(let i=0;i<ATTEMPTS;i++){
  const angle=f((world.random256()&255)*ANGLE_STEP),x=f(f(f(Math.sin(angle))*1.5)+px),y=f(f(f(Math.cos(angle))*1.5)+py);
  const ground=world.groundZ(x,y,pz);if(ground===undefined)continue;
  const pickup={x,y,z:f(f(ground)+.5)},middle={x:px,y:py,z:f(pz+f(.3))};
  const d={x:f(x-px),y:f(y-py),z:f(pickup.z-middle.z)},length=f(Math.sqrt(f(f(f(d.x*d.x)+f(d.y*d.y))+f(d.z*d.z))));
  // The pickup's outer edge, 0.4 further out along the line from the ped.
  const k=f(f(length+f(.4))/length),edge={x:f(px+f(d.x*k)),y:f(py+f(d.y*k)),z:f(middle.z+f(d.z*k))};
  const late=i>ATTEMPTS/2;
  const dx=f(x-playerX),dy=f(y-playerY),distance=f(Math.sqrt(f(f(dx*dx)+f(dy*dy))));
  if(!(distance>2||late))continue;
  if(!late&&world.pickupsInBubble(pickup,f(1.3)))continue;
  if(!world.lineOfSightClear(edge,middle,i<ATTEMPTS/2))continue;
  if(!late&&world.vehicleInSphere(pickup,f(1.2)))continue;
  return pickup;
 }
 return {x:px,y:py,z:f(pz+f(.4))};
}
