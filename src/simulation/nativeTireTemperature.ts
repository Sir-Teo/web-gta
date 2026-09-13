import {requireAsset} from '../assets/binary';
import type {NativeWheelState} from './nativeWheelResponse';
/** Rear wheel-pair temperature update, after both rear wheel states are stored.
 * NOS reuses this field and bypasses the tire heating/cooling branch entirely. */
export function nativeTireTemperature(temperature:number,timeStep:number,handlingFlags:number,driveType:string,burnout:boolean,rearLeft:NativeWheelState,rearRight:NativeWheelState){
  const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite tire temperature.');return r;};
  const old=f(temperature),dt=f(timeStep);
  requireAsset(dt>=0&&dt<=3&&Number.isInteger(handlingFlags)&&handlingFlags>=0&&handlingFlags<=0xffffffff,'Invalid tire temperature update.');
  requireAsset(['F','R','4'].includes(driveType),'Invalid tire drive type.');
  if(handlingFlags&0x80000)return old;
  requireAsset(old>=0,'Negative tire temperature requires NOS.');
  if(burnout&&driveType!=='F'&&(rearLeft==='spinning'||rearRight==='spinning'))return Math.min(f(old+f(dt/1000)),3);
  return old>1?f(f(f(Math.pow(f(.995),dt))*f(old-1))+1):old;
}
