import {nativeContactBrightness} from '../assets/collisionLighting';
import {NATIVE_CAR_WHEELS,type WheelValues} from './nativeDriveContacts';
/** CVehicle constructor initializes all four collision-lighting bytes to 0x48. */
export function initialCarCollisionLighting():WheelValues{return {frontLeft:0x48,rearLeft:0x48,frontRight:0x48,rearRight:0x48};}
/** CVehicle::CalculateLightingFromCollision, in native FL/RL/FR/RR sum order. */
export function nativeCarContactBrightness(lighting:WheelValues,night:number){
 let sum=0;for(const wheel of NATIVE_CAR_WHEELS)sum=Math.fround(sum+nativeContactBrightness(lighting[wheel],night));
 return Math.fround(sum/4);
}
