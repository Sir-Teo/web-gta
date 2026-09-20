/* CAutomobile::TankControl (gta-reversed ead3051) for the Rhino under the player: with the camera on its string the
 * turret follows the camera front, yaw (m_fDoomVerticalRotation) at 0.015 a time step toward atan2(−front.x,
 * front.y) and pitch (m_fDoomHorizontalRotation) at 0.005 a step toward atan2(front.z, |front.xy|) + 15°, the yaw
 * wrapped to ±π, the pitch capped at 35° and floored at −7° (a floor that rises to −3° as the turret faces
 * backwards). The cannon fires every 800 ms along (sin −yaw, cos yaw, sin pitch) from the barrel node, kicks the
 * tank back by 0.1 × that vector a step, and puts EXPLOSION_TANK_FIRE where the 60-unit line first hits (pulled 4 %
 * back toward the muzzle). Native car space: x right, y forward, z up. */
export const TANK_YAW_RATE=0.015,TANK_PITCH_RATE=0.005,TANK_PITCH_MAX=35*Math.PI/180,TANK_PITCH_MIN=-7*Math.PI/180,TANK_PITCH_AIM_LIFT=15*Math.PI/180;
export const TANK_FIRE_INTERVAL_MS=800,TANK_SHOT_RANGE=60,TANK_RECOIL=0.1;
export const TANK_SHOT_DOOM_POS={x:0,y:-1.394,z:2.296},TANK_SHOT_DOOM_DEFAULT_TARGET={x:0,y:2.95,z:2.97};
export interface TankTurret {yaw:number;pitch:number}
export function initialTankTurret():TankTurret{return {yaw:0,pitch:0.05};}
const wrap=(a:number)=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
/** One frame of the camera-following aim; `steps` is the frame in native time steps (fiftieths of a second). */
export function stepTankTurret(t:TankTurret,front:{x:number;y:number;z:number},steps:number):TankTurret{
 let yawTarget=Math.atan2(-front.x,front.y);
 const pitchTarget=Math.atan2(front.z,Math.hypot(front.x,front.y))+TANK_PITCH_AIM_LIFT;
 if(yawTarget<t.yaw-Math.PI)yawTarget+=2*Math.PI;else if(yawTarget>t.yaw+Math.PI)yawTarget-=2*Math.PI;
 let yaw=t.yaw,pitch=t.pitch;
 const yawDiff=yawTarget-yaw,yawStep=steps*TANK_YAW_RATE;
 if(yawDiff<-yawStep)yaw-=yawStep;else if(yawDiff>yawStep)yaw+=yawStep;
 const pitchDiff=pitchTarget-pitch,pitchStep=steps*TANK_PITCH_RATE;
 if(pitchDiff>pitchStep)pitch+=pitchStep;else if(pitchDiff>=-pitchStep)pitch=pitchTarget;else pitch-=pitchStep;
 yaw=wrap(yaw);
 if(pitch>TANK_PITCH_MAX)pitch=TANK_PITCH_MAX;
 else if(yaw>Math.PI/2||yaw<-Math.PI/2){
  const cosYaw=Math.cos(yaw)*1.3;let floor=-3*Math.PI/180;
  if(cosYaw>=-1)floor=TANK_PITCH_MIN-cosYaw*(floor-TANK_PITCH_MIN);
  if(floor>pitch)pitch=floor;
 }else if(pitch<TANK_PITCH_MIN)pitch=TANK_PITCH_MIN;
 return {yaw,pitch};
}
/** The shot's direction in native car space (not normalised, as the native `point`). */
export function tankShotDirection(t:TankTurret){return {x:Math.sin(-t.yaw),y:Math.cos(t.yaw),z:Math.sin(t.pitch)};}
/** The muzzle in native car space when the model has no barrel node: the doom position swung by the yaw. */
export function tankDefaultMuzzle(t:TankTurret){
 const d={x:TANK_SHOT_DOOM_DEFAULT_TARGET.x-TANK_SHOT_DOOM_POS.x,y:TANK_SHOT_DOOM_DEFAULT_TARGET.y-TANK_SHOT_DOOM_POS.y,z:TANK_SHOT_DOOM_DEFAULT_TARGET.z-TANK_SHOT_DOOM_POS.z};
 const s=Math.sin(t.yaw),c=Math.cos(t.yaw);
 return {x:TANK_SHOT_DOOM_POS.x+c*d.x-s*d.y,y:TANK_SHOT_DOOM_POS.y+c*d.y+s*d.x,z:TANK_SHOT_DOOM_POS.z+d.z-1};
}
/** Native basis entries ([column, row, value]) turning a frame about its Z (the turret's yaw) or X (the barrel's pitch). */
export function yawBasis(yaw:number):[number,number,number][]{const c=Math.cos(yaw),s=Math.sin(yaw);return [[0,0,c],[0,1,s],[0,2,0],[1,0,-s],[1,1,c],[1,2,0],[2,0,0],[2,1,0],[2,2,1]];}
export function pitchBasis(pitch:number):[number,number,number][]{const c=Math.cos(pitch),s=Math.sin(pitch);return [[0,0,1],[0,1,0],[0,2,0],[1,0,0],[1,1,c],[1,2,s],[2,0,0],[2,1,-s],[2,2,c]];}
