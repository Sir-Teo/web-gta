/* CCarCtrl::GenerateOneRandomCar (PC 0x430050, a raw call in gta-reversed; iOS 0x10018dfa4), the parts of it that do
 * not depend on how far out a car is made: the bearing the spawn point is asked on, the node pair's spawn
 * probability, the lane rules, the cruise speed, how far along its link a car of its length may stand, the speed the
 * node flags give, and the test that the car is closing on the player. The distances themselves (the 160-unit
 * in-view circle, and the 150 to 170 window on screen that RemoveDistantCars answers) are the browser's budget. */
type V2={x:number;y:number};
export interface CreationBearing {dirX:number;dirY:number;minDot:number;dotAbove:boolean}
/** GenerateOneRandomCar's bearing (iOS, the arguments of its GenerateCarCreationCoors2 call at 0x10018e350):
 * - a camera looking straight down (forward z under -0.9): any bearing;
 * - in a vehicle moving faster than 0.4 a frame across the ground: its way, within 0.85 (frames 0 and 1 of four),
 *   0.707 (frame 2), or outside 0.707 (frame 3); faster than 0.1: 0.85 (frame 0), 0.707 (1), outside 0.707 (2, 3);
 * - otherwise the camera's way, within 0.707 on even frames and outside it on odd ones. */
export function randomCarCreationBearing(o:{cameraForwardZ:number;cameraFront:V2;vehicleVelocity?:V2;frameCounter:number}):CreationBearing{
 if(o.cameraForwardZ< -.9)return {dirX:.707,dirY:.707,minDot:-1,dotAbove:true};
 const v=o.vehicleVelocity,sp=v?Math.hypot(v.x,v.y):0;
 if(v&&sp>.1){
  const k=o.frameCounter&3,dirX=v.x/sp,dirY=v.y/sp;
  if(sp>.4)return k<2?{dirX,dirY,minDot:.85,dotAbove:true}:{dirX,dirY,minDot:.707,dotAbove:k===2};
  return k===0?{dirX,dirY,minDot:.85,dotAbove:true}:{dirX,dirY,minDot:.707,dotAbove:k===1};
 }
 return {dirX:o.cameraFront.x,dirY:o.cameraFront.y,minDot:.707,dotAbove:(o.frameCounter&1)===0};
}
/** The node pair's spawn probability: a car is made unless rand() & 15 exceeds the lower of the two (0 to 15), so a
 * pair of 0 still makes one a sixteenth of the time. */
export const spawnProbabilityPasses=(rand:number,a:number,b:number)=>!((rand&15)>Math.min(a,b));
export const MODEL_BUS=431,MODEL_COACH=437;
/** The lanes the car's way has: none makes nothing; a BMX keeps off roads of two lanes or more, and a bus or a
 * coach off roads of fewer. */
export function laneCountAllows(lanes:number,modelId:number,bmx:boolean){
 if(lanes>=2&&bmx)return false;
 if(lanes<2&&(modelId===MODEL_BUS||modelId===MODEL_COACH))return false;
 return lanes!==0;
}
/** CAutoPilot::m_nCruiseSpeed for a random car (iOS GenerateOneRandomCar): 13 to 20 (21 at rand()'s very top, which rounds to 1 in float; `random` an integer from 0 to 0x7fffffff,
 * scaled by 4.6566129e-10), three quarters of it for a vehicle longer than 10 units, and a third of that for the
 * tractor, the combine harvester and a BMX. (Vice City's, which the port first took, was 9 to 14 by the car's
 * class.) */
export function randomCarCruiseSpeed(random:number,length:number,modelId:number,bmx:boolean){
 let cruise=Math.trunc(Math.fround(Math.fround(random*4.6566129e-10)*8)+13)&0xff;
 if(!(length<=10))cruise=cruise*3>>2;
 if(modelId===531||modelId===532||bmx)cruise=Math.trunc(cruise/3);
 return cruise;
}
/** How far along the link (0 at node1, 1 at node2) a car of this length stands: half its length and a unit clear
 * of either node, or the middle of a link too short for that. */
export function clampCreationT(t:number,length:number,nodeDistance:number){
 const f=Math.fround,half=f(f(length*.5)+1);
 if(f(nodeDistance*.5)<half)return .5;
 const edge=f(half/nodeDistance);
 return Math.min(Math.max(t,edge),f(1-edge));
}
/** CCarCtrl::FindSpeedMultiplierWithSpeedFromNodes (iOS 0x100191398, table 0x100592e80): 0.5 for code −1, 0.65 for
 * 0, 1 and 2.3 for 1 and 2, and 1 otherwise. */
export const speedMultiplierFromNodes=(code:number)=>code>=-1&&code<=2?[.5,.65,1,2.3][code+1]:1;
/** The speed code PickNextNodeAccordingStrategy (iOS 0x1001936c0) takes from the node a car reaches: bits 12 and 13
 * of its flags, or −1 at a node of behaviour type 8 or 9 (bits 21 to 23 = 4). GenerateOneRandomCar takes bits 12
 * and 13 alone (`reached` false). */
export const nodeSpeedCode=(flags:number,reached=true)=>reached&&((flags>>>21)&7)===4?-1:(flags>>>12)&3;
/** CAutoPilot::m_SpeedMult GenerateOneRandomCar gives a car starting towards a node: 0.65 on an ordinary road, 1 and
 * 2.3 and 1 for codes 1 to 3. */
export const nodeSpeedMultiplier=(flags:number)=>speedMultiplierFromNodes(nodeSpeedCode(flags,false));
/** The last test before the car goes in: its speed (units a frame) less the player's must not point away from the
 * centre, or the car would only be leaving. */
export function approachesPlayer(carVelocity:V2,playerVelocity:V2,carPosition:V2,centre:V2){
 return (carVelocity.x-playerVelocity.x)*(carPosition.x-centre.x)+(carVelocity.y-playerVelocity.y)*(carPosition.y-centre.y)<0;
}
