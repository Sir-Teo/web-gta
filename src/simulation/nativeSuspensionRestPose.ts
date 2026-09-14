import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import type {NativeSuspensionLine} from './nativeSuspension';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite initial suspension pose.');return value;};
/** SetupSuspensionLines' CalculateHeightAboveRoad and initial m_wheelPosition.
 * Source deliberately uses FRONT height for all four initial wheel positions. */
export function nativeSuspensionRestPose(lines:Record<CarWheel,NativeSuspensionLine>,forceLevel:number){
 const force=f(forceLevel);requireAsset(force>0,'Initial suspension pose requires positive spring force.');
 const height=(wheel:CarWheel)=>{
  const line=lines[wheel],spring=f(line.springLength),radius=f(line.radius),start=f(line.start.z);
  requireAsset(spring>0&&radius>0,'Invalid initial suspension geometry.');
  return f(f(f(f(1-f(1/f(force*4)))*spring)+radius)-start);
 };
 const frontHeight=height('frontLeft'),rearHeight=height('rearLeft'),positions={} as Record<CarWheel,number>;
 for(const wheel of NATIVE_CAR_WHEELS){const radius=f(lines[wheel].radius);requireAsset(radius>0,'Invalid initial wheel radius.');positions[wheel]=f(radius-frontHeight);requireAsset(Math.abs(positions[wheel])<=1e7,'Initial wheel position exceeds the coordinate limit.');}
 return {frontHeight,rearHeight,positions};
}
