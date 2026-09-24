import {WEAPON_FLAG} from './weaponData';

/* First-person weapon modes: the weapons weapon.dat flags b1stPerson (0x4). In the PC data these are the sniper rifle,
 * both rocket launchers and the camera.
 * - CTaskSimplePlayerOnFoot::ProcessPlayerWeapon (0x6859A0) sets the camera's weapon mode when the target button goes
 *   down and puts the ped in PEDSTATE_SNIPER_MODE. Outside that mode these weapons only get PlayerPassiveControlGun,
 *   and CWeapon::FireSniper, FireProjectile and the camera's fire refuse the player: they cannot fire.
 * - Releasing the target button leaves the mode. SA's code for it is a stub; the Vice City ancestor's
 *   CPlayerPed::PlayerControlSniper and PlayerControlM16 restore the previous state and clear the weapon mode.
 * - CCamera turns the ped to the camera's heading in these modes, PlayerControlZeldaWeapon refuses to jump, and the
 *   walk keys still strafe through ControlGunMove: with a mouse, CPad::GetPedWalkUpDown(ped) reads the left stick.
 * - Weapon cycling is ignored in these modes (the Vice City CPlayerPed::ProcessWeaponSwitch; SA's is a stub). The
 *   default PC bindings give the wheel to PED_SNIPER_ZOOM_IN (up) and ZOOM_OUT (down), with PgUp and PgDn.
 * Cameras:
 * - Rockets: CCam::Process_Rocket (0x511B50): FOV 70, the head bone plus 0.1 up, ClipAlpha's −85.5° to 60°, and a
 *   0.15 near clip plane.
 * - Sniper rifle and camera: SA's Process_M16_1stPerson (0x5105C0) is a stub, so they follow the Vice City
 *   CCam::Process_Sniper. The head plus 0.1 up, 0.19 behind it (ducked, 0.5 behind and 0.18 left); −89.5° to 60°.
 *   The zoom starts at DefaultFOV 70:
 *   - A wheel notch sets the target 10 from the current FOV, eased by WellBufferMe(0.5, 0.25) while more than 0.5 off.
 *   - A held zoom key scales the FOV by (255 × TimeStep + 10000) / 10000 per frame.
 *   - The FOV stays between 15 (3 for the camera) and 70.
 * - Mouse look turns by 3 × m_fMouseAccelHorzntl and 4 × m_fMouseAccelVertical per count, times FOV / 80. The Vice City
 *   third-person mouse camera turns by 2.5 and 4 at FOV 70 (SA's Process_FollowPedWithMouse is a stub). So first person
 *   runs at 1.2 × FOV / 70 and FOV / 70 of the browser's third-person rates. */

export type FirstPersonMode='sniper'|'rocket'|'rocketHs'|'camera'|'m16';
export const FIRST_PERSON_DEFAULT_FOV=70;
const DEG=Math.PI/180;

/** The camera's weapon mode for a b1stPerson weapon (ProcessPlayerWeapon's switch), else undefined. */
export function firstPersonMode(type:number,info?:{flags:number}):FirstPersonMode|undefined{
 if(!info||!(info.flags&WEAPON_FLAG.firstPerson))return undefined;
 return type===35?'rocket':type===36?'rocketHs':type===34?'sniper':type===43?'camera':'m16';
}
export const isRocketMode=(mode:FirstPersonMode)=>mode==='rocket'||mode==='rocketHs';
export const hasZoom=(mode:FirstPersonMode)=>mode==='sniper'||mode==='camera';

/** The camera source relative to the head bone, in the ped's frame: up, forward and right. */
export function firstPersonSourceOffset(mode:FirstPersonMode,ducked:boolean){
 if(isRocketMode(mode))return {up:.1,forward:0,right:0};
 return ducked?{up:.1,forward:-.5,right:-.18}:{up:.1,forward:-.19,right:0};
}
/** The camera's vertical angle range (radians, up positive). */
export function firstPersonAlphaRange(mode:FirstPersonMode){
 return isRocketMode(mode)?{min:-85.5*DEG,max:60*DEG}:{min:-89.5*DEG,max:60*DEG};
}
/** Mouse look per count as multiples of the third-person yaw (0.003) and pitch (0.002) rates. The absolute speed is the
 * port's own; CCam::Process_Rocket fixes the proportion: yaw 3 × 0.0025 and pitch 4 × 0.0015 per count, both × FOV / 80,
 * so the vertical turns at 0.8 of the horizontal rate at any FOV (1.44 × 0.002 = 0.8 × 1.2 × 0.003). */
export function firstPersonLookScale(fov:number){return {yaw:1.2*fov/FIRST_PERSON_DEFAULT_FOV,pitch:1.44*fov/FIRST_PERSON_DEFAULT_FOV};}

/** CCam::WellBufferMe for a non-angle value. */
export function wellBufferMe(target:number,value:{current:number;speed:number},maxSpeed:number,acceleration:number,timeStep:number){
 const targetSpeed=(target-value.current)*maxSpeed;
 value.speed+=acceleration*(targetSpeed-value.speed)*timeStep;
 if(targetSpeed<0&&value.speed<targetSpeed||targetSpeed>0&&value.speed>targetSpeed)value.speed=targetSpeed;
 value.current+=value.speed*Math.min(10,timeStep);
}

/** Process_Sniper's FOV, TargetFOV and FOVSpeed. */
export class FirstPersonZoom{
 fov=FIRST_PERSON_DEFAULT_FOV;target=FIRST_PERSON_DEFAULT_FOV;speed=0;
 reset(){this.fov=this.target=FIRST_PERSON_DEFAULT_FOV;this.speed=0;}
 /** One camera frame. `notch` is +1 for a wheel notch in and −1 out; `held` is +1 while zoom in is held, −1 out. */
 update(mode:FirstPersonMode,timeStep:number,notch=0,held=0){
  if(!hasZoom(mode)){this.fov=this.target=FIRST_PERSON_DEFAULT_FOV;this.speed=0;return this.fov;}
  if(notch)this.target=this.fov-10*Math.sign(notch);
  else if(held){
   const scale=(255*timeStep+10000)/10000;
   this.fov=held<0?this.fov*scale:this.fov/scale;this.target=this.fov;this.speed=0;
  }
  if(!held||notch){
   if(Math.abs(this.target-this.fov)>.5){const v={current:this.fov,speed:this.speed};wellBufferMe(this.target,v,.5,.25,timeStep);this.fov=v.current;this.speed=v.speed;}
   else this.speed=0;
  }
  this.fov=Math.max(mode==='camera'?3:15,Math.min(FIRST_PERSON_DEFAULT_FOV,this.fov));
  return this.fov;
 }
}
