import type {Vec3} from '../core/math';
export interface HunterGunMatrix {right:Vec3;forward:Vec3;up:Vec3;position:Vec3}
const f=Math.fround;
/** CVehicle::m_nGunFiringTime: native uint32 add then unsigned comparison, including wraparound behavior. */
export function vehicleGunReady(nowMs:number,lastShotMs:number,rateMs:number){return (nowMs>>>0)>((lastShotMs+rateMs)>>>0);}
/** FIRE_HUNTER_GUN, iOS 0x1001e569c: Hunter offset through the current matrix, then a frame of native move speed.
 * The handler itself has no model, health, occupancy or player-control gate. */
export function hunterGunOrigin(matrix:HunterGunMatrix,moveSpeed:Vec3,timeStep:number):Vec3{
 const offset=[0,f(4.8),f(-1.3)],t=f(timeStep);
 const axis=(key:'x'|'y'|'z')=>f(f(f(f(f(matrix.right[key])*offset[0])+f(f(matrix.forward[key])*offset[1]))+f(f(matrix.up[key])*offset[2]))+f(matrix.position[key]));
 return {x:f(axis('x')+f(f(moveSpeed.x)*t)),y:f(axis('y')+f(f(moveSpeed.y)*t)),z:f(axis('z')+f(f(moveSpeed.z)*t))};
}
