/* Aim assist for the touch controls. With a mouse the PC game aims freely: the crosshair is wherever the player puts it
 * (CCamera::m_bUseMouse3rdPerson). A pad, and the mobile ports' Aim button, lock on instead
 * (CPlayerPed::FindWeaponLockOnTarget), because a thumb cannot hold a crosshair on a moving ped the way a mouse can.
 * A finger dragging the camera is the thumb's case, so with the touch controls an aimed gun eases the crosshair onto
 * the ped nearest it in front: the shot still goes where the crosshair is, and a drag takes the camera back. */
type Point={x:number;y:number;z:number};
/** Where the third-person aimed crosshair sits on the screen in normalised device coordinates (53% across, 40% down:
 * the .weapon-crosshair placement); the gun's ray goes through it. */
export const AIM_CROSSHAIR_NDC={x:.06,y:.2};
export interface AimCandidate {handle:number;position:Point;crew?:boolean;down?:boolean;attacking?:boolean}
/** The angle from the aim ray within which a ped is taken, and within which the one already taken is kept. */
export const AIM_ASSIST_TAKE=.3,AIM_ASSIST_KEEP=.55;
/** The ped to ease the crosshair onto: alive (the list holds only those), not the player's own crew, not lying down,
 * within the gun's reach of the player and within AIM_ASSIST_TAKE of the ray from the camera through the crosshair.
 * The nearest to the ray wins, a ped attacking the player counting as nearer; the current target is kept while it
 * stays within AIM_ASSIST_KEEP, so two peds side by side do not trade the crosshair. `visible` is the line of sight. */
export function pickAimTarget(candidates:readonly AimCandidate[],ray:{origin:Point;direction:Point},player:Point,reach:number,current?:number,visible:(c:AimCandidate)=>boolean=()=>true){
 const d=ray.direction,length=Math.hypot(d.x,d.y,d.z)||1;
 const angleTo=(p:Point)=>{const x=p.x-ray.origin.x,y=p.y-ray.origin.y,z=p.z-ray.origin.z,l=Math.hypot(x,y,z)||1;return Math.acos(Math.max(-1,Math.min(1,(x*d.x+y*d.y+z*d.z)/(l*length))));};
 let best:AimCandidate|undefined,bestScore=Infinity;
 for(const c of candidates){
  if(c.crew||c.down)continue;
  if(Math.hypot(c.position.x-player.x,c.position.y-player.y,c.position.z-player.z)>reach)continue;
  const angle=angleTo(c.position),kept=c.handle===current;
  if(angle>(kept?AIM_ASSIST_KEEP:AIM_ASSIST_TAKE))continue;
  const score=kept?-1:angle*(c.attacking?.5:1);
  if(score<bestScore&&visible(c)){best=c;bestScore=score;}
 }
 return best;
}
/** The turn that moves a point seen at `ndc` toward the crosshair: yaw and pitch deltas in the follow camera's own
 * convention (yaw falls to turn right, pitch falls to look up), a `share` of the whole way, for a camera with a
 * vertical field of view `fovY` (radians) and an aspect ratio `aspect`. */
export function aimAssistTurn(ndc:{x:number;y:number},fovY:number,aspect:number,share:number){
 const tanX=Math.tan(fovY/2)*aspect,tanY=Math.tan(fovY/2);
 return {yaw:-(Math.atan(ndc.x*tanX)-Math.atan(AIM_CROSSHAIR_NDC.x*tanX))*share,pitch:-(Math.atan(ndc.y*tanY)-Math.atan(AIM_CROSSHAIR_NDC.y*tanY))*share};
}
